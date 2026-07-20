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

if not password:
    print("Error: SUPABASE_DB_PASSWORD not found in env!")
    exit(1)

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Read SQL statements from 20-MIGRATIONS.sql
sql_file_path = r"c:\Users\alex_\Documents\Trip Planner\.planning\phases\20-in-app-activity-log-notification-feed\20-MIGRATIONS.sql"
if not os.path.exists(sql_file_path):
    print(f"Error: SQL migration file not found at {sql_file_path}!")
    exit(1)

with open(sql_file_path, "r", encoding="utf-8") as f:
    sql_content = f.read()

# Split by semicolon, ignoring empty entries or trigger block semicolons
# Because triggers have multiple semicolons inside $$, we will separate carefully.
# We can execute the whole script or split it by a special separator if needed.
# Since pg8000 supports multiple statements or we can run the whole SQL text as one cursor execution (often supported), let's try executing the whole block! Or we can parse it into individual commands.
# Let's run individual blocks to ensure statement-by-statement safety. We can separate by comments or execute in logical chunks.
# Alternatively, pg8000's cursor.execute() handles multi-statement string perfectly in a single execution when autocommit=True. Let's execute the whole SQL file contents at once!

print("Connecting to database pooler...")
try:
    conn = pg8000.dbapi.connect(
        host=host,
        port=port,
        database="postgres",
        user=user,
        password=password,
        ssl_context=ssl_context,
        timeout=10
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("Connected successfully. Running migrations...")
    cursor.execute(sql_content)
    print("All Phase 20 migrations executed successfully!")
    conn.close()
except Exception as e:
    print(f"Connection/Migration failed: {e}")
    exit(1)
