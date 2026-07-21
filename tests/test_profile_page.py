import pytest
import os
import random
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(r"c:\Users\alex_\Documents\Trip Planner\.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://obilxzpljuphlkkchnam.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

@pytest.fixture(scope="module")
def supabase() -> Client:
    assert SUPABASE_KEY, "SUPABASE_KEY environment variable is missing"
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def test_profile_page_updates(supabase: Client):
    """Verifies updating first_name and username in users table."""
    test_username = f"pytest_user_{random.randint(10000, 99999)}"
    temp_tg_id = -2000000 - random.randint(10000, 99999)

    user_res = supabase.table("users").insert({
        "first_name": "Pytest Traveler",
        "username": test_username,
        "telegram_id": temp_tg_id
    }).execute()

    assert user_res.data, "Failed to create test user"
    user_id = user_res.data[0]["id"]

    try:
        new_username = f"{test_username}_mod"
        update_res = supabase.table("users").update({
            "first_name": "Pytest Traveler Updated",
            "username": new_username
        }).eq("id", user_id).execute()

        assert update_res.data, "Failed to update user profile"
        updated = update_res.data[0]
        assert updated["first_name"] == "Pytest Traveler Updated"
        assert updated["username"] == new_username

    finally:
        supabase.table("users").delete().eq("id", user_id).execute()
