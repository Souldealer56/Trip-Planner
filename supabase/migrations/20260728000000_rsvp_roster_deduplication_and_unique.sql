-- ============================================================================
-- Migration: 20260728000000_rsvp_roster_deduplication_and_unique.sql
-- Description: Deduplicates existing rows in public.rsvps and guarantees
--              a strict UNIQUE (trip_id, user_id) constraint.
-- ============================================================================

DO $$
BEGIN
  -- 1. Deduplicate any duplicate entries in public.rsvps
  -- Keep the latest entry based on created_at if available, or system ctid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'rsvps' AND column_name = 'created_at'
  ) THEN
    DELETE FROM public.rsvps a USING public.rsvps b
    WHERE a.trip_id = b.trip_id 
      AND a.user_id = b.user_id 
      AND (
        a.created_at < b.created_at 
        OR (a.created_at = b.created_at AND a.ctid < b.ctid)
      );
  ELSE
    DELETE FROM public.rsvps a USING public.rsvps b
    WHERE a.trip_id = b.trip_id 
      AND a.user_id = b.user_id 
      AND a.ctid < b.ctid;
  END IF;

  -- 2. Ensure UNIQUE (trip_id, user_id) constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.rsvps'::regclass 
      AND conname = 'rsvps_trip_id_user_id_key'
  ) THEN
    ALTER TABLE public.rsvps 
      ADD CONSTRAINT rsvps_trip_id_user_id_key UNIQUE (trip_id, user_id);
  END IF;
END $$;

