import pg8000.dbapi
import ssl
import os
from dotenv import load_dotenv

env_path = r"c:\Users\alex_\Documents\Trip Planner\.env"
load_dotenv(env_path)

host = "aws-1-us-west-2.pooler.supabase.com"
project_id = "obilxzpljuphlkkchnam"
user = f"postgres.{project_id}"
port = 5432
password = os.getenv("SUPABASE_DB_PASSWORD")

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

conn = pg8000.dbapi.connect(
    host=host,
    port=port,
    database="postgres",
    user=user,
    password=password,
    ssl_context=ssl_context
)
conn.autocommit = True
cur = conn.cursor()

# Ensure pg_net extension is created
cur.execute("CREATE EXTENSION IF NOT EXISTS pg_net;")

sql = """
CREATE OR REPLACE FUNCTION public.send_magic_link_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.used = false THEN
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer re_dummy_key',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Trip Planner <onboarding@resend.dev>',
        'to', jsonb_build_array(NEW.email),
        'subject', 'Your Magic Login Link',
        'html', '<p>Click <a href="https://normich-trip-planner.netlify.app/verify?token=' || NEW.token || '">here</a> to log in to Trip Planner.</p><p>This link expires in 15 minutes.</p>'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
"""

cur.execute(sql)
print("Updated send_magic_link_trigger successfully!")
conn.close()
