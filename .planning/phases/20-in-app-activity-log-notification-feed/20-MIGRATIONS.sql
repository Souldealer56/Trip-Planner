-- Create table activity_log
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public select from activity_log" ON public.activity_log;
DROP POLICY IF EXISTS "Allow public insert to activity_log" ON public.activity_log;
DROP POLICY IF EXISTS "Allow public delete from activity_log" ON public.activity_log;

-- RLS policies
CREATE POLICY "Allow public select from activity_log" ON public.activity_log FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert to activity_log" ON public.activity_log FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public delete from activity_log" ON public.activity_log FOR DELETE TO public USING (true);

-- Trigger function for RSVPs
CREATE OR REPLACE FUNCTION public.log_rsvp_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
BEGIN
  SELECT first_name INTO v_first_name FROM public.users WHERE id = NEW.user_id;
  INSERT INTO public.activity_log (trip_id, user_id, action_type, description)
  VALUES (
    NEW.trip_id,
    NEW.user_id,
    'update_rsvp',
    COALESCE(v_first_name, 'Someone') || ' updated RSVP to ' || NEW.status
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_log_rsvp ON public.rsvps;

-- Create RSVP trigger
CREATE TRIGGER trg_log_rsvp
AFTER INSERT OR UPDATE ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.log_rsvp_activity();

-- Trigger function for poll_options (option pitching)
CREATE OR REPLACE FUNCTION public.log_option_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
BEGIN
  SELECT first_name INTO v_first_name FROM public.users WHERE id = NEW.added_by;
  INSERT INTO public.activity_log (trip_id, user_id, action_type, description)
  VALUES (
    NEW.trip_id,
    NEW.added_by,
    'pitch_option',
    COALESCE(v_first_name, 'Someone') || ' pitched "' || NEW.option_text || '" in ' || NEW.category
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_log_option ON public.poll_options;

-- Create option trigger
CREATE TRIGGER trg_log_option
AFTER INSERT ON public.poll_options
FOR EACH ROW
EXECUTE FUNCTION public.log_option_activity();

-- Trigger function for expenses
CREATE OR REPLACE FUNCTION public.log_expense_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
BEGIN
  SELECT first_name INTO v_first_name FROM public.users WHERE id = NEW.paid_by;
  INSERT INTO public.activity_log (trip_id, user_id, action_type, description)
  VALUES (
    NEW.trip_id,
    NEW.paid_by,
    'add_expense',
    COALESCE(v_first_name, 'Someone') || ' logged expense "' || NEW.description || '" of ' || to_char(NEW.amount, 'FM999,999.00') || ' ' || COALESCE(NEW.currency, 'USD')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_log_expense ON public.expenses;

-- Create expense trigger
CREATE TRIGGER trg_log_expense
AFTER INSERT ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.log_expense_activity();
