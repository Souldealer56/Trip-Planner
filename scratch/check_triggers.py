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

cur.execute("SELECT trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table = 'login_tokens';")
print("Triggers:", cur.fetchall())

cur.execute("SELECT routine_name, routine_definition FROM information_schema.routines WHERE routine_name = 'send_magic_link_trigger';")
print("Routine:", cur.fetchall())

conn.close()
