-- ============================================================================
-- Migration: 20260726000000_supabase_native_auth_and_realtime.sql
-- Description: Transition from custom login_tokens to native Supabase Auth (auth.users).
--              1. Drop legacy login_tokens infrastructure.
--              2. Add ON UPDATE CASCADE to all foreign keys referencing public.users(id).
--              3. Create automatic identity reconciliation trigger (auth.users -> public.users)
--                 including JSONB UUID migration inside expenses.split_users.
--              4. Helper functions & strict auth.uid() Row Level Security (RLS) policies.
--              5. Enable supabase_realtime publication on core trip tables.
-- ============================================================================

BEGIN;

-- Ensure auth schema and helper stubs exist for environments without preloaded Supabase auth
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $func$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $func$;
  END IF;
END $$;

-- ============================================================================
-- 1. DROP LEGACY CUSTOM TOKEN INFRASTRUCTURE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_tokens') THEN
    DROP TRIGGER IF EXISTS on_login_token_created ON public.login_tokens CASCADE;
    DROP TRIGGER IF EXISTS send_magic_link_trigger ON public.login_tokens CASCADE;
    DROP TRIGGER IF EXISTS send_magic_link_email_trigger ON public.login_tokens CASCADE;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.send_magic_link_trigger() CASCADE;
DROP TABLE IF EXISTS public.login_tokens CASCADE;


-- ============================================================================
-- 2. ADD ON UPDATE CASCADE TO ALL FOREIGN KEYS REFERENCING public.users(id)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Dynamically identify and drop any existing foreign key constraint referencing public.users(id)
  FOR r IN (
    SELECT cls.relname AS table_name, con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE ns.nspname = 'public'
      AND con.contype = 'f'
      AND (
        (cls.relname = 'trips' AND att.attname = 'organizer_id') OR
        (cls.relname = 'rsvps' AND att.attname = 'user_id') OR
        (cls.relname = 'poll_options' AND att.attname = 'added_by') OR
        (cls.relname = 'option_votes' AND att.attname = 'user_id') OR
        (cls.relname = 'expenses' AND att.attname = 'paid_by') OR
        (cls.relname = 'activity_log' AND att.attname = 'user_id')
      )
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
  END LOOP;

  -- Ensure named constraints are dropped if still lingering
  EXECUTE 'ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_organizer_id_fkey';
  EXECUTE 'ALTER TABLE public.rsvps DROP CONSTRAINT IF EXISTS rsvps_user_id_fkey';
  EXECUTE 'ALTER TABLE public.poll_options DROP CONSTRAINT IF EXISTS poll_options_added_by_fkey';
  EXECUTE 'ALTER TABLE public.option_votes DROP CONSTRAINT IF EXISTS option_votes_user_id_fkey';
  EXECUTE 'ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_fkey';
  EXECUTE 'ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey';

  -- Recreate foreign key constraints with ON UPDATE CASCADE
  ALTER TABLE public.trips 
    ADD CONSTRAINT trips_organizer_id_fkey 
    FOREIGN KEY (organizer_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

  ALTER TABLE public.rsvps 
    ADD CONSTRAINT rsvps_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

  ALTER TABLE public.poll_options 
    ADD CONSTRAINT poll_options_added_by_fkey 
    FOREIGN KEY (added_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

  ALTER TABLE public.option_votes 
    ADD CONSTRAINT option_votes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

  ALTER TABLE public.expenses 
    ADD CONSTRAINT expenses_paid_by_fkey 
    FOREIGN KEY (paid_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

  ALTER TABLE public.activity_log 
    ADD CONSTRAINT activity_log_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
END $$;


-- ============================================================================
-- 3. AUTOMATIC IDENTITY RECONCILIATION TRIGGER (auth.users -> public.users)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_first_name TEXT;
  v_username TEXT;
  v_email_prefix TEXT;
  v_existing_id UUID;
BEGIN
  -- Normalize email from auth.users record
  v_email := LOWER(TRIM(COALESCE(NEW.email, '')));

  IF v_email LIKE '%@%' THEN
    v_email_prefix := SPLIT_PART(v_email, '@', 1);
  ELSE
    v_email_prefix := 'traveler';
  END IF;

  -- Extract default traveler first_name
  v_first_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    INITCAP(v_email_prefix),
    'Traveler'
  );

  -- Extract default username
  v_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    NULLIF(LOWER(REGEXP_REPLACE(v_email_prefix, '[^a-zA-Z0-9_]', '', 'g')), ''),
    'traveler'
  );

  IF v_email <> '' THEN
    SELECT id INTO v_existing_id
    FROM public.users
    WHERE LOWER(email) = v_email
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Reconcile existing historical profile ID with new auth.users ID.
      -- 1) ON UPDATE CASCADE on all child tables preserves memberships, votes, and paid_by.
      -- 2) Explicitly update JSONB split_users in expenses so owed shares are preserved!
      IF v_existing_id <> NEW.id THEN
        UPDATE public.users
        SET id = NEW.id
        WHERE LOWER(email) = v_email;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'split_users'
        ) THEN
          EXECUTE format(
            'UPDATE public.expenses SET split_users = REPLACE(split_users::text, %L, %L)::jsonb WHERE split_users IS NOT NULL AND split_users::text LIKE %L',
            v_existing_id::text,
            NEW.id::text,
            '%' || v_existing_id::text || '%'
          );
        END IF;
      END IF;
    ELSE
      -- Prevent username uniqueness collision if another user already has v_username
      IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(v_username)) THEN
        v_username := v_username || '_' || SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 4);
      END IF;

      -- Insert new public profile for first-time traveler
      INSERT INTO public.users (id, email, first_name, username)
      VALUES (NEW.id, v_email, v_first_name, v_username)
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(v_username)) THEN
      v_username := v_username || '_' || SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 4);
    END IF;

    INSERT INTO public.users (id, email, first_name, username)
    VALUES (NEW.id, NULL, v_first_name, v_username)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sync();


-- ============================================================================
-- 4. HELPER FUNCTIONS & STRICT auth.uid() RLS POLICIES
-- ============================================================================

-- Helper: Check if user is a trip member (or primary organizer)
CREATE OR REPLACE FUNCTION public.is_trip_member(
  p_trip_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_trip_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = p_trip_id AND t.organizer_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.rsvps r
    WHERE r.trip_id = p_trip_id AND r.user_id = p_user_id
  );
END;
$$;

-- Helper: Check if user is a trip admin (organizer or co_organizer)
CREATE OR REPLACE FUNCTION public.is_trip_admin(
  p_trip_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_trip_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = p_trip_id AND t.organizer_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.rsvps r
    WHERE r.trip_id = p_trip_id 
      AND r.user_id = p_user_id 
      AND r.role IN ('organizer', 'co_organizer')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_trip_admin(UUID, UUID) TO authenticated, anon;

-- Enable RLS across all application tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Purge existing policies on core tables to cleanly apply strict auth policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'trips', 'rsvps', 'poll_options', 'option_votes', 'expenses', 'activity_log')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4.1 USERS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users are viewable by authenticated users"
  ON public.users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 4.2 TRIPS POLICIES
-- ----------------------------------------------------------------------------
-- Allow reading trip metadata for members and for invite link preview (/join/:tripId)
CREATE POLICY "Trips viewable by members or invite preview"
  ON public.trips FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can create trips"
  ON public.trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Trip admins can update trips"
  ON public.trips FOR UPDATE TO authenticated
  USING (public.is_trip_admin(id))
  WITH CHECK (public.is_trip_admin(id));

CREATE POLICY "Trip admins can delete trips"
  ON public.trips FOR DELETE TO authenticated
  USING (public.is_trip_admin(id));

-- ----------------------------------------------------------------------------
-- 4.3 RSVPS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "RSVPs viewable by trip members"
  ON public.rsvps FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id) OR user_id = auth.uid());

CREATE POLICY "Authenticated users can insert their own RSVP"
  ON public.rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users and admins can update RSVPs"
  ON public.rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_trip_admin(trip_id))
  WITH CHECK (user_id = auth.uid() OR public.is_trip_admin(trip_id));

CREATE POLICY "Users and admins can delete RSVPs"
  ON public.rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_trip_admin(trip_id));

-- ----------------------------------------------------------------------------
-- 4.4 POLL_OPTIONS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Poll options viewable by trip members"
  ON public.poll_options FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can insert poll options"
  ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (public.is_trip_member(trip_id) AND (added_by = auth.uid() OR added_by IS NULL));

CREATE POLICY "Trip members can update poll options"
  ON public.poll_options FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "Authors or admins can delete poll options"
  ON public.poll_options FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.is_trip_admin(trip_id));

-- ----------------------------------------------------------------------------
-- 4.5 OPTION_VOTES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Option votes viewable by trip members"
  ON public.option_votes FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can insert their own option votes"
  ON public.option_votes FOR INSERT TO authenticated
  WITH CHECK (public.is_trip_member(trip_id) AND user_id = auth.uid());

CREATE POLICY "Trip members can update their own option votes"
  ON public.option_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Trip members can delete their own option votes"
  ON public.option_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_trip_admin(trip_id));

-- ----------------------------------------------------------------------------
-- 4.6 EXPENSES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Expenses viewable by trip members"
  ON public.expenses FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can insert expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can update expenses"
  ON public.expenses FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id))
  WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "Payers or admins can delete expenses"
  ON public.expenses FOR DELETE TO authenticated
  USING (paid_by = auth.uid() OR public.is_trip_admin(trip_id));

-- ----------------------------------------------------------------------------
-- 4.7 ACTIVITY_LOG POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Activity logs viewable by trip members"
  ON public.activity_log FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id));

CREATE POLICY "Trip members can insert activity logs"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (public.is_trip_member(trip_id));

CREATE POLICY "Trip admins can delete activity logs"
  ON public.activity_log FOR DELETE TO authenticated
  USING (public.is_trip_admin(trip_id));


-- ============================================================================
-- 5. ENABLE SUPABASE REALTIME PUBLICATION
-- ============================================================================

DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  -- Ensure publication exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOR v_tbl IN VALUES 
    ('trips'), 
    ('rsvps'), 
    ('poll_options'), 
    ('option_votes'), 
    ('expenses'), 
    ('activity_log')
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;

ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER TABLE public.rsvps REPLICA IDENTITY FULL;
ALTER TABLE public.poll_options REPLICA IDENTITY FULL;
ALTER TABLE public.option_votes REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;

COMMIT;