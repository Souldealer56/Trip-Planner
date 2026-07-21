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

def test_full_platform_audit(supabase: Client):
    """Verifies end-to-end CRUD operations for trips, options, polls, expenses, and users."""
    # 1. Trip creation
    trip_res = supabase.table("trips").insert({
        "title": "Full Audit Pytest Trip",
        "destination": "Kyoto",
        "start_date": "2026-12-01",
        "end_date": "2026-12-10",
        "base_currency": "USD"
    }).execute()
    assert trip_res.data, "Failed to create test trip"
    trip_id = trip_res.data[0]["id"]

    # 2. User creation
    tg_id = -900000 - random.randint(10000, 99999)
    user_res = supabase.table("users").insert({
        "first_name": "Pytest Audit User",
        "telegram_id": tg_id
    }).execute()
    assert user_res.data, "Failed to create test user"
    user_id = user_res.data[0]["id"]

    try:
        # 3. Option pitching
        opt_res = supabase.table("poll_options").insert({
            "trip_id": trip_id,
            "category": "activities",
            "option_text": "Fushimi Inari Hike",
            "estimated_cost": 0.00,
            "currency": "USD",
            "added_by": user_id
        }).execute()
        assert opt_res.data, "Failed to pitch option"

        # 4. Expense logging
        exp_res = supabase.table("expenses").insert({
            "trip_id": trip_id,
            "paid_by": user_id,
            "amount": 80.00,
            "currency": "USD",
            "description": "Ramen Lunch",
            "split_users": [user_id]
        }).execute()
        assert exp_res.data, "Failed to log expense"

        # 5. User profile update
        prof_res = supabase.table("users").update({
            "first_name": "Pytest Audit User Updated"
        }).eq("id", user_id).execute()
        assert prof_res.data[0]["first_name"] == "Pytest Audit User Updated"

    finally:
        # Cleanup
        supabase.table("expenses").delete().eq("trip_id", trip_id).execute()
        supabase.table("poll_options").delete().eq("trip_id", trip_id).execute()
        supabase.table("trips").delete().eq("id", trip_id).execute()
        supabase.table("users").delete().eq("id", user_id).execute()
