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

tables = ["users", "trips", "rsvps", "poll_options", "expenses", "votes", "splits"]

for tbl in tables:
    # Drop existing policies if any
    cur.execute(f"DROP POLICY IF EXISTS \"Allow public select from {tbl}\" ON public.{tbl};")
    cur.execute(f"DROP POLICY IF EXISTS \"Allow public insert to {tbl}\" ON public.{tbl};")
    cur.execute(f"DROP POLICY IF EXISTS \"Allow public update to {tbl}\" ON public.{tbl};")
    cur.execute(f"DROP POLICY IF EXISTS \"Allow public delete from {tbl}\" ON public.{tbl};")

    # Create open public policies
    cur.execute(f"CREATE POLICY \"Allow public select from {tbl}\" ON public.{tbl} FOR SELECT TO public USING (true);")
    cur.execute(f"CREATE POLICY \"Allow public insert to {tbl}\" ON public.{tbl} FOR INSERT TO public WITH CHECK (true);")
    cur.execute(f"CREATE POLICY \"Allow public update to {tbl}\" ON public.{tbl} FOR UPDATE TO public USING (true) WITH CHECK (true);")
    cur.execute(f"CREATE POLICY \"Allow public delete from {tbl}\" ON public.{tbl} FOR DELETE TO public USING (true);")

    print(f"Applied RLS policies for table: {tbl}")

conn.close()
print("All table RLS policies successfully updated!")
