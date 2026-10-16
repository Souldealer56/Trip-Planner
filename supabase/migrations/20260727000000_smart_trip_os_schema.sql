-- ============================================================================
-- Migration: 20260727000000_smart_trip_os_schema.sql
-- Description: Smart Relational Core linking Roster participants, Pitched Options,
--              and Expenses:
--              1. Adds arrival_date, departure_date, and dietary_tags to rsvps.
--              2. Adds cost_type, assigned_users, and metadata to poll_options.
--              3. Creates public.grocery_items with RLS policies and meal_option_id (BIGINT).
--              4. Ensures option_id (BIGINT) on public.expenses.
-- ============================================================================

BEGIN;

-- 1. Upgrade public.rsvps with arrival_date, departure_date, and dietary_tags
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS arrival_date DATE,
  ADD COLUMN IF NOT EXISTS departure_date DATE,
  ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] NOT NULL DEFAULT '{}';

-- 2. Upgrade public.poll_options with cost_type, assigned_users, and metadata
ALTER TABLE public.poll_options
  ADD COLUMN IF NOT EXISTS cost_type TEXT NOT NULL DEFAULT 'split_total' CHECK (cost_type IN ('split_total', 'per_person', 'per_night')),
  ADD COLUMN IF NOT EXISTS assigned_users JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Create public.grocery_items table
CREATE TABLE IF NOT EXISTS public.grocery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    meal_option_id BIGINT REFERENCES public.poll_options(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity TEXT,
    aisle TEXT NOT NULL DEFAULT 'other' CHECK (aisle IN ('produce', 'dairy_meat', 'dry_goods', 'drinks', 'household', 'other')),
    is_checked BOOLEAN NOT NULL DEFAULT false,
    added_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure meal_option_id is BIGINT if table already existed with UUID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'grocery_items'
      AND column_name = 'meal_option_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.grocery_items DROP COLUMN meal_option_id;
    ALTER TABLE public.grocery_items ADD COLUMN meal_option_id BIGINT REFERENCES public.poll_options(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grocery_items_trip ON public.grocery_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_grocery_items_meal ON public.grocery_items(meal_option_id);

-- 4. Ensure public.expenses has option_id referencing public.poll_options(id) as BIGINT
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS option_id BIGINT REFERENCES public.poll_options(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_option_id ON public.expenses(option_id);

-- Enable Row Level Security (RLS) on grocery_items
ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select grocery items" ON public.grocery_items;
CREATE POLICY "Public select grocery items"
  ON public.grocery_items FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Public insert grocery items" ON public.grocery_items;
CREATE POLICY "Public insert grocery items"
  ON public.grocery_items FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public update grocery items" ON public.grocery_items;
CREATE POLICY "Public update grocery items"
  ON public.grocery_items FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete grocery items" ON public.grocery_items;
CREATE POLICY "Public delete grocery items"
  ON public.grocery_items FOR DELETE TO public
  USING (true);

-- Add grocery_items to supabase_realtime publication if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.grocery_items;
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
END $$;

ALTER TABLE public.grocery_items REPLICA IDENTITY FULL;

-- Notify postgrest to reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
