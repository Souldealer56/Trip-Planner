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
cur = conn.cursor()

cur.execute("SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'users';")
print("RLS Policies on users table:", cur.fetchall())

cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users';")
print("Columns on users table:", cur.fetchall())

cur.execute("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'users'::regclass;")
print("Constraints on users table:", cur.fetchall())

conn.close()
