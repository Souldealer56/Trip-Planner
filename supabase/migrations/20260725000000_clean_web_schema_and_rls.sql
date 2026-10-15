-- ============================================================================
-- Migration: 20260725000000_clean_web_schema_and_rls.sql
-- Description: Normalize database schema for standalone Web Application.
--              - Normalizes trips, users, rsvps, poll_options, and expenses.
--              - Replaces active_polls JSONB anti-pattern with relational option_votes.
--              - Provides atomic toggle_option_vote RPC function.
--              - Enforces ON DELETE CASCADE for all trip child records.
--              - Establishes performance indexes and Row Level Security (RLS).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. NORMALIZE TRIPS TABLE
-- ============================================================================

ALTER TABLE public.trips 
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- Migrate existing archived status encoded in vibe text tag
UPDATE public.trips 
SET is_archived = true, 
    vibe = NULLIF(TRIM(REGEXP_REPLACE(vibe, '\[ARCHIVED\]\s*', '', 'g')), '') 
WHERE vibe LIKE '%[ARCHIVED]%';

-- Drop legacy Telegram columns
ALTER TABLE public.trips 
  DROP COLUMN IF EXISTS group_chat_id CASCADE,
  DROP COLUMN IF EXISTS last_rsvp_nudge_at CASCADE;


-- ============================================================================
-- 2. NORMALIZE USERS TABLE
-- ============================================================================

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Enforce unique constraint on email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.users'::regclass 
      AND conname = 'users_email_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- Make telegram_id nullable and drop legacy link token columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'telegram_id'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN telegram_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.users 
  DROP COLUMN IF EXISTS telegram_link_code CASCADE,
  DROP COLUMN IF EXISTS telegram_link_expires_at CASCADE;


-- ============================================================================
-- 3. NORMALIZE RSVPS TABLE (FIX PRIVILEGE ESCALATION VULNERABILITY)
-- ============================================================================

ALTER TABLE public.rsvps 
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- Enforce valid roles: organizer, co_organizer, member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.rsvps'::regclass 
      AND conname = 'rsvps_role_check'
  ) THEN
    ALTER TABLE public.rsvps 
      ADD CONSTRAINT rsvps_role_check 
      CHECK (role IN ('organizer', 'co_organizer', 'member'));
  END IF;
END $$;

-- Migrate existing co-organizers from notes tag
UPDATE public.rsvps 
SET role = 'co_organizer', 
    notes = NULLIF(TRIM(REGEXP_REPLACE(notes, '\[(CO_ORGANIZER|ADMIN)\]\s*', '', 'g')), '') 
WHERE notes LIKE '%[CO_ORGANIZER]%' OR notes LIKE '%[ADMIN]%';

-- Migrate is_admin column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'rsvps' 
      AND column_name = 'is_admin'
  ) THEN
    EXECUTE 'UPDATE public.rsvps SET role = ''co_organizer'' WHERE is_admin = true AND role = ''member''';
  END IF;
END $$;

-- Promote primary trip creators to 'organizer' role in rsvps
UPDATE public.rsvps r
SET role = 'organizer'
FROM public.trips t
WHERE r.trip_id = t.id AND r.user_id = t.organizer_id;

-- Ensure unique constraint on (trip_id, user_id)
DO $$
BEGIN
  -- Deduplicate any duplicate entries using system ctid
  DELETE FROM public.rsvps a USING public.rsvps b
  WHERE a.trip_id = b.trip_id 
    AND a.user_id = b.user_id 
    AND a.ctid < b.ctid;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.rsvps'::regclass 
      AND conname = 'rsvps_trip_id_user_id_key'
  ) THEN
    ALTER TABLE public.rsvps 
      ADD CONSTRAINT rsvps_trip_id_user_id_key UNIQUE (trip_id, user_id);
  END IF;
END $$;


-- ============================================================================
-- 4. NORMALIZE POLL_OPTIONS & RELATIONAL OPTION_VOTES TABLE
-- ============================================================================

ALTER TABLE public.poll_options 
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing locked option IDs from active_polls JSONB voter_selections
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'active_polls'
  ) THEN
    UPDATE public.poll_options po
    SET is_locked = true
    FROM public.active_polls ap
    WHERE ap.voter_selections->>'_locked_option_id' IS NOT NULL
      AND po.id::text = ap.voter_selections->>'_locked_option_id';
  END IF;
END $$;

-- Create relational option_votes table (option_id is BIGINT matching poll_options.id)
CREATE TABLE IF NOT EXISTS public.option_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  option_id BIGINT NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT option_votes_option_id_user_id_key UNIQUE (option_id, user_id)
);

-- Migrate votes from legacy active_polls JSONB if available
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'active_polls'
  ) THEN
    INSERT INTO public.option_votes (trip_id, option_id, user_id)
    SELECT 
      ap.trip_id,
      po.id,
      u.id
    FROM public.active_polls ap,
    LATERAL jsonb_each(ap.voter_selections) AS kv(key, val),
    LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(kv.val) = 'array' THEN kv.val ELSE '[]'::jsonb END
    ) AS opt_id_elem
    JOIN public.poll_options po ON po.id::text = opt_id_elem::text
    JOIN public.users u ON u.id::text = kv.key
    WHERE kv.key != '_locked_option_id'
    ON CONFLICT (option_id, user_id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Gracefully proceed if legacy format cannot be cleanly cast
END $$;

-- Drop any previous UUID signature if it exists
DROP FUNCTION IF EXISTS public.toggle_option_vote(UUID, UUID, UUID);

-- Create atomic RPC function for voting toggle (p_option_id is BIGINT)
CREATE OR REPLACE FUNCTION public.toggle_option_vote(
  p_trip_id UUID,
  p_option_id BIGINT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_name TEXT := 'Someone';
  v_category TEXT := 'general';
  v_option_text TEXT := 'option';
BEGIN
  -- Determine whether vote currently exists
  SELECT EXISTS (
    SELECT 1 FROM public.option_votes
    WHERE option_id = p_option_id AND user_id = p_user_id
  ) INTO v_exists;

  -- Resolve traveler name for activity log
  SELECT COALESCE(first_name, username, 'Someone')
  INTO v_user_name
  FROM public.users
  WHERE id = p_user_id;

  -- Resolve option details for activity log
  SELECT category, option_text
  INTO v_category, v_option_text
  FROM public.poll_options
  WHERE id = p_option_id;

  IF v_exists THEN
    -- Delete existing vote
    DELETE FROM public.option_votes
    WHERE option_id = p_option_id AND user_id = p_user_id;

    -- Record retraction in activity log
    INSERT INTO public.activity_log (trip_id, user_id, action_type, description)
    VALUES (
      p_trip_id,
      p_user_id,
      'vote_option',
      v_user_name || ' removed vote on "' || COALESCE(v_option_text, 'option') || '" in ' || COALESCE(v_category, 'general')
    );

    RETURN FALSE;
  ELSE
    -- Record new vote
    INSERT INTO public.option_votes (trip_id, option_id, user_id)
    VALUES (p_trip_id, p_option_id, p_user_id);

    -- Record vote in activity log
    INSERT INTO public.activity_log (trip_id, user_id, action_type, description)
    VALUES (
      p_trip_id,
      p_user_id,
      'vote_option',
      v_user_name || ' voted on "' || COALESCE(v_option_text, 'option') || '" in ' || COALESCE(v_category, 'general')
    );

    RETURN TRUE;
  END IF;
END;
$$;


-- ============================================================================
-- 5. NORMALIZE EXPENSES TABLE
-- ============================================================================

-- If option_id was partially created as UUID, drop it before adding as BIGINT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'expenses' 
      AND column_name = 'option_id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.expenses DROP COLUMN option_id;
  END IF;
END $$;

ALTER TABLE public.expenses 
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS option_id BIGINT,
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14, 6) DEFAULT NULL;

-- Normalize any existing category values to lowercase before adding CHECK
UPDATE public.expenses
SET category = LOWER(TRIM(category))
WHERE category IS NOT NULL;

-- Enforce standard expense categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.expenses'::regclass 
      AND conname = 'expenses_category_check'
  ) THEN
    ALTER TABLE public.expenses 
      ADD CONSTRAINT expenses_category_check 
      CHECK (category IN ('accommodation', 'flights', 'activities', 'food', 'transport', 'other'));
  END IF;
END $$;

-- Enforce foreign key from expenses.option_id (BIGINT) to poll_options.id (BIGINT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.expenses'::regclass 
      AND conname = 'expenses_option_id_fkey'
  ) THEN
    ALTER TABLE public.expenses 
      ADD CONSTRAINT expenses_option_id_fkey 
      FOREIGN KEY (option_id) REFERENCES public.poll_options(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Clean legacy [Locked Option] prefix from expense descriptions
UPDATE public.expenses
SET description = TRIM(REGEXP_REPLACE(description, '^\[Locked Option\]\s*', '', 'i'))
WHERE description ILIKE '[Locked Option]%';


-- ============================================================================
-- 6. ENFORCE ON DELETE CASCADE ON ALL TRIP FOREIGN KEYS
-- ============================================================================

DO $$
DECLARE
  v_table TEXT;
  v_conname TEXT;
BEGIN
  FOR v_table IN VALUES ('rsvps'), ('poll_options'), ('option_votes'), ('expenses'), ('activity_log')
  LOOP
    -- Drop any existing foreign key constraint on trip_id
    FOR v_conname IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
      WHERE ns.nspname = 'public'
        AND cls.relname = v_table
        AND att.attname = 'trip_id'
        AND con.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_table, v_conname);
    END LOOP;

    -- Add normalized foreign key constraint specifying ON DELETE CASCADE
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE',
      v_table,
      v_table || '_trip_id_fkey'
    );
  END LOOP;
END $$;

-- Enforce ON DELETE CASCADE for expense_splits if table exists
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'expense_splits'
  ) THEN
    FOR v_conname IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
      WHERE ns.nspname = 'public'
        AND cls.relname = 'expense_splits'
        AND att.attname = 'expense_id'
        AND con.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.expense_splits DROP CONSTRAINT %I', v_conname);
    END LOOP;

    ALTER TABLE public.expense_splits 
      ADD CONSTRAINT expense_splits_expense_id_fkey 
      FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ============================================================================
-- 7. CONFIGURE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trips_is_archived ON public.trips (is_archived);
CREATE INDEX IF NOT EXISTS idx_rsvps_trip_user ON public.rsvps (trip_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_role ON public.rsvps (role);
CREATE INDEX IF NOT EXISTS idx_poll_options_trip_cat ON public.poll_options (trip_id, category);
CREATE INDEX IF NOT EXISTS idx_poll_options_is_locked ON public.poll_options (trip_id, is_locked);
CREATE INDEX IF NOT EXISTS idx_option_votes_trip_opt ON public.option_votes (trip_id, option_id);
CREATE INDEX IF NOT EXISTS idx_option_votes_user ON public.option_votes (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON public.expenses (trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (trip_id, category);
CREATE INDEX IF NOT EXISTS idx_activity_log_trip_created ON public.activity_log (trip_id, created_at DESC);


-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'active_polls') THEN
    ALTER TABLE public.active_polls ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_tokens') THEN
    ALTER TABLE public.login_tokens ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Purge legacy / insecure policies matching 'allow public' or 'public_all'
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname ILIKE '%allow%public%'
        OR policyname ILIKE '%public_all%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- A. STRICT POLICIES FOR SUPABASE AUTHENTICATED USERS (auth.uid())
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users are viewable by authenticated users" ON public.users;
CREATE POLICY "Users are viewable by authenticated users" 
  ON public.users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" 
  ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" 
  ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Trips viewable by participants" ON public.trips;
CREATE POLICY "Trips viewable by participants" 
  ON public.trips FOR SELECT TO authenticated 
  USING (
    organizer_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.rsvps 
      WHERE rsvps.trip_id = trips.id AND rsvps.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create trips" ON public.trips;
CREATE POLICY "Authenticated users can create trips" 
  ON public.trips FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Organizers and co-organizers can update trips" ON public.trips;
CREATE POLICY "Organizers and co-organizers can update trips" 
  ON public.trips FOR UPDATE TO authenticated 
  USING (
    organizer_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.rsvps 
      WHERE rsvps.trip_id = trips.id 
        AND rsvps.user_id = auth.uid() 
        AND rsvps.role IN ('organizer', 'co_organizer')
    )
  );

DROP POLICY IF EXISTS "Organizers can delete trips" ON public.trips;
CREATE POLICY "Organizers can delete trips" 
  ON public.trips FOR DELETE TO authenticated USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "RSVPs viewable by trip participants" ON public.rsvps;
CREATE POLICY "RSVPs viewable by trip participants" 
  ON public.rsvps FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = rsvps.trip_id 
        AND (t.organizer_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.rsvps r2 
          WHERE r2.trip_id = t.id AND r2.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Users can join trips via RSVP" ON public.rsvps;
CREATE POLICY "Users can join trips via RSVP" 
  ON public.rsvps FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update their own RSVP" ON public.rsvps;
CREATE POLICY "Participants can update their own RSVP" 
  ON public.rsvps FOR UPDATE TO authenticated 
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.trips t 
      WHERE t.id = rsvps.trip_id AND t.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can delete their own RSVP" ON public.rsvps;
CREATE POLICY "Participants can delete their own RSVP" 
  ON public.rsvps FOR DELETE TO authenticated 
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.trips t 
      WHERE t.id = rsvps.trip_id AND t.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Options viewable by trip participants" ON public.poll_options;
CREATE POLICY "Options viewable by trip participants" 
  ON public.poll_options FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.rsvps 
      WHERE rsvps.trip_id = poll_options.trip_id AND rsvps.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = poll_options.trip_id AND trips.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can pitch options" ON public.poll_options;
CREATE POLICY "Participants can pitch options" 
  ON public.poll_options FOR INSERT TO authenticated 
  WITH CHECK (
    added_by = auth.uid() 
    AND (
      EXISTS (
        SELECT 1 FROM public.rsvps 
        WHERE rsvps.trip_id = poll_options.trip_id AND rsvps.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.trips 
        WHERE trips.id = poll_options.trip_id AND trips.organizer_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Authors or organizers can update options" ON public.poll_options;
CREATE POLICY "Authors or organizers can update options" 
  ON public.poll_options FOR UPDATE TO authenticated 
  USING (
    added_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.rsvps 
      WHERE rsvps.trip_id = poll_options.trip_id 
        AND rsvps.user_id = auth.uid() 
        AND rsvps.role IN ('organizer', 'co_organizer')
    )
    OR EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = poll_options.trip_id AND trips.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors or organizers can delete options" ON public.poll_options;
CREATE POLICY "Authors or organizers can delete options" 
  ON public.poll_options FOR DELETE TO authenticated 
  USING (
    added_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = poll_options.trip_id AND trips.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Option votes viewable by trip participants" ON public.option_votes;
CREATE POLICY "Option votes viewable by trip participants" 
  ON public.option_votes FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.rsvps 
      WHERE rsvps.trip_id = option_votes.trip_id AND rsvps.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = option_votes.trip_id AND trips.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can cast votes" ON public.option_votes;
CREATE POLICY "Participants can cast votes" 
  ON public.option_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Participants can remove their own votes" ON public.option_votes;
CREATE POLICY "Participants can remove their own votes" 
  ON public.option_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Expenses viewable by trip participants" ON public.expenses;
CREATE POLICY "Expenses viewable by trip participants" 
  ON public.expenses FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.rsvps 
      WHERE rsvps.trip_id = expenses.trip_id AND rsvps.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = expenses.trip_id AND trips.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can log expenses" ON public.expenses;
CREATE POLICY "Participants can log expenses" 
  ON public.expenses FOR INSERT TO authenticated 
  WITH CHECK (
    paid_by = auth.uid() 
    AND (
      EXISTS (
        SELECT 1 FROM public.rsvps 
        WHERE rsvps.trip_id = expenses.trip_id AND rsvps.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.trips 
        WHERE trips.id = expenses.trip_id AND trips.organizer_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Payers or organizers can update expenses" ON public.expenses;
CREATE POLICY "Payers or organizers can update expenses" 
  ON public.expenses FOR UPDATE TO authenticated 
  USING (
    paid_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = expenses.trip_id AND trips.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Payers or organizers can delete expenses" ON public.expenses;
CREATE POLICY "Payers or organizers can delete expenses" 
  ON public.expenses FOR DELETE TO authenticated 
  USING (
    paid_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = expenses.trip_id AND trips.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Activity logs viewable by trip participants" ON public.activity_log;
CREATE POLICY "Activity logs viewable by trip participants" 
  ON public.activity_log FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.rsvps 
      WHERE rsvps.trip_id = activity_log.trip_id AND rsvps.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = activity_log.trip_id AND trips.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can insert activity logs" ON public.activity_log;
CREATE POLICY "Participants can insert activity logs" 
  ON public.activity_log FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Login Tokens (magic link auth flow)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_tokens') THEN
    DROP POLICY IF EXISTS "Anon insert tokens" ON public.login_tokens;
    CREATE POLICY "Anon insert tokens" ON public.login_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Anon verify tokens" ON public.login_tokens;
    CREATE POLICY "Anon verify tokens" ON public.login_tokens FOR SELECT TO anon, authenticated USING (true);

    DROP POLICY IF EXISTS "Anon consume tokens" ON public.login_tokens;
    CREATE POLICY "Anon consume tokens" ON public.login_tokens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- B. TRANSITIONAL ANON ROLE POLICIES (While using custom localStorage Auth)
--    Once native Supabase Auth JWTs are wired up, drop these 'Anon *' policies.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anon access trips" ON public.trips;
CREATE POLICY "Anon access trips" ON public.trips FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon access users" ON public.users;
CREATE POLICY "Anon access users" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon access rsvps" ON public.rsvps;
CREATE POLICY "Anon access rsvps" ON public.rsvps FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon access poll_options" ON public.poll_options;
CREATE POLICY "Anon access poll_options" ON public.poll_options FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon access option_votes" ON public.option_votes;
CREATE POLICY "Anon access option_votes" ON public.option_votes FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon access expenses" ON public.expenses;
CREATE POLICY "Anon access expenses" ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon access activity_log" ON public.activity_log;
CREATE POLICY "Anon access activity_log" ON public.activity_log FOR ALL TO anon USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'active_polls') THEN
    DROP POLICY IF EXISTS "Anon access active_polls" ON public.active_polls;
    CREATE POLICY "Anon access active_polls" ON public.active_polls FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;