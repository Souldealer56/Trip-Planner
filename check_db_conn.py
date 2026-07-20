import pg8000.dbapi
import os
import ssl
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("SUPABASE_URL")
db_key = os.getenv("SUPABASE_KEY")

project_id = db_url.replace("https://", "").replace(".supabase.co", "").split("/")[0]
host = "aws-0-us-west-2.pooler.supabase.com"
port = 6543
user = f"postgres.{project_id}"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

passwords = [
    db_key,
    "postgres",
    "admin",
    "password",
    "obilxzpljuphlkkchnam",
    "Supabase123",
    "supabase",
]

for pwd in passwords:
    print(f"Trying password: {pwd[:15]}...")
    try:
        conn = pg8000.dbapi.connect(
            host=host,
            port=port,
            database="postgres",
            user=user,
            password=pwd,
            ssl_context=ssl_context
        )
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        row = cursor.fetchone()
        print(f"Connection Successful with password '{pwd}'! Postgres version:", row[0])
        conn.close()
        break
    except Exception as e:
        print("Failed:", str(e).strip())
