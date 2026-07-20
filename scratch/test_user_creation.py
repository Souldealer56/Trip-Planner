import pg8000.dbapi
import ssl
import os
import time
import random
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

# Try reproducing the exact insert logic from auth.js:
test_email = "test_user_" + str(int(time.time())) + "@gmail.com"
temp_telegram_id = -1000000 - random.randint(0, 1000000)
email_prefix = test_email.split('@')[0]
first_name = email_prefix.capitalize()
username = email_prefix.lower()

print(f"Testing insert for {test_email} with telegram_id {temp_telegram_id}...")
try:
    cur.execute(
        "INSERT INTO public.users (email, telegram_id, first_name, username) VALUES (%s, %s, %s, %s) RETURNING id;",
        (test_email, temp_telegram_id, first_name, username)
    )
    res = cur.fetchone()
    print("Insert successful, ID:", res)
    cur.execute("DELETE FROM public.users WHERE email = %s;", (test_email,))
    print("Cleaned up test user.")
except Exception as e:
    print("INSERT ERROR:", e)

conn.close()
