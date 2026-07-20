-- ===========================================================================
-- Phase 17: Custom Passwordless Email Login - SQL Migrations
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query).
-- ===========================================================================

-- 1. Create table login_tokens
CREATE TABLE IF NOT EXISTS public.login_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS on login_tokens
ALTER TABLE public.login_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for login_tokens:
-- Allow insert from public (so anonymous landing page can request tokens)
CREATE POLICY "Allow public insert to login_tokens" 
ON public.login_tokens 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Allow select to public (so verification page can validate token)
CREATE POLICY "Allow public select from login_tokens" 
ON public.login_tokens 
FOR SELECT 
TO public 
USING (true);

-- Allow update to public (so verification page can mark token as used)
CREATE POLICY "Allow public update to login_tokens" 
ON public.login_tokens 
FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);


-- 2. Add email and link code columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_link_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_link_expires_at TIMESTAMPTZ;


-- 3. Create the atomic merge_users function
CREATE OR REPLACE FUNCTION public.merge_users(target_id UUID, stale_id UUID)
RETURNS VOID AS $$
BEGIN
  -- 1. Deduplicate RSVPs where target already has one
  DELETE FROM public.rsvps
  WHERE user_id = stale_id
    AND trip_id IN (SELECT trip_id FROM public.rsvps WHERE user_id = target_id);
  
  -- 2. Update remaining RSVPs
  UPDATE public.rsvps
  SET user_id = target_id
  WHERE user_id = stale_id;

  -- 3. Deduplicate Splits where target already has one
  DELETE FROM public.splits
  WHERE user_id = stale_id
    AND expense_id IN (SELECT expense_id FROM public.splits WHERE user_id = target_id);
  
  -- 4. Update remaining splits
  UPDATE public.splits
  SET user_id = target_id
  WHERE user_id = stale_id;

  -- 5. Update Expenses paid by user
  UPDATE public.expenses
  SET paid_by = target_id
  WHERE paid_by = stale_id;

  -- 6. Deduplicate Votes where target already has one
  DELETE FROM public.votes
  WHERE user_id = stale_id
    AND option_id IN (SELECT option_id FROM public.votes WHERE user_id = target_id);
  
  -- 7. Update remaining votes
  UPDATE public.votes
  SET user_id = target_id
  WHERE user_id = stale_id;

  -- 8. Transfer Telegram details to target user if target doesn't have them
  UPDATE public.users t
  SET 
    telegram_id = COALESCE(t.telegram_id, s.telegram_id),
    username = COALESCE(t.username, s.username),
    first_name = COALESCE(t.first_name, s.first_name),
    last_name = COALESCE(t.last_name, s.last_name)
  FROM public.users s
  WHERE t.id = target_id AND s.id = stale_id;

  -- 9. Delete duplicate Telegram user profile
  DELETE FROM public.users
  WHERE id = stale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================================================
-- OPTION A: SQL-only Database Webhook trigger via pg_net (Resend Email Dispatch)
-- ===========================================================================
-- To use this option, replace '[YOUR_RESEND_API_KEY]' and '[YOUR_WEBAPP_URL]' 
-- with your Resend key (e.g. re_xxxx) and Webapp base URL (e.g. https://tripplanner.com).
-- Note: Make sure the 'pg_net' extension is enabled in Database -> Extensions.

/*
CREATE OR REPLACE FUNCTION public.send_magic_link_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.used = false THEN
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer [YOUR_RESEND_API_KEY]',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Trip Planner <onboarding@resend.dev>',
        'to', jsonb_build_array(NEW.email),
        'subject', 'Your Magic Login Link',
        'html', '<p>Click <a href="[YOUR_WEBAPP_URL]/verify?token=' || NEW.token || '">here</a> to log in to Trip Planner.</p><p>This link expires in 15 minutes.</p>'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_login_token_inserted
AFTER INSERT ON public.login_tokens
FOR EACH ROW
EXECUTE FUNCTION public.send_magic_link_trigger();
*/


-- ===========================================================================
-- OPTION B: Supabase Dashboard Webhook UI Setup (Recommended alternative to Option A)
-- ===========================================================================
-- 1. Go to Supabase Dashboard -> Database -> Webhooks.
-- 2. Click "Enable Webhooks" if not enabled.
-- 3. Click "Create Webhook".
-- 4. Set Name: "send_magic_link"
-- 5. Set Table: "login_tokens", Events: "INSERT"
-- 6. Set Method: "POST", URL: "https://api.resend.com/emails"
-- 7. Add HTTP Headers:
--    - "Authorization": "Bearer [YOUR_RESEND_API_KEY]"
--    - "Content-Type": "application/json"
-- 8. Add Parameters / JSON body properties or use default payload mapped through Edge Functions.
