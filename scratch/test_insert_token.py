import pg8000.dbapi
import ssl
import os
import uuid
import datetime
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

exp = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)).isoformat()
test_email = "test_verify_net@example.com"
test_token = str(uuid.uuid4())

print("Testing INSERT into login_tokens...")
cur.execute(
    "INSERT INTO public.login_tokens (email, token, expires_at) VALUES (%s, %s, %s);",
    (test_email, test_token, exp)
)
print("Successfully inserted token into login_tokens! (No 'schema net does not exist' error!)")

cur.execute("DELETE FROM public.login_tokens WHERE email = %s;", (test_email,))
print("Cleaned up test token.")

conn.close()
