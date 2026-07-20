import pytest
import os
import random
import time
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(r"c:\Users\alex_\Documents\Trip Planner\.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://obilxzpljuphlkkchnam.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

@pytest.fixture(scope="module")
def supabase() -> Client:
    assert SUPABASE_KEY, "SUPABASE_KEY environment variable is missing"
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def test_pitching_and_poll_sync(supabase: Client):
    """Verifies pitching options across all categories and active poll creation."""
    # 1. Create trip
    trip_res = supabase.table("trips").insert({
        "title": "Pytest Pitching Audit Trip",
        "destination": "Paris",
        "start_date": "2026-09-01",
        "end_date": "2026-09-10",
        "base_currency": "EUR"
    }).execute()
    assert trip_res.data, "Failed to create test trip"
    trip = trip_res.data[0]
    trip_id = trip["id"]

    # 2. Create user
    ts = int(time.time() * 1000)
    user_res = supabase.table("users").insert({
        "email": f"pytest_pitcher_{ts}@example.com",
        "telegram_id": -1 * (ts * 1000 + random.randint(100, 999)),
        "first_name": "PitchTester",
        "username": f"pitcher_{ts}"
    }).execute()
    assert user_res.data, "Failed to create test user"
    user = user_res.data[0]
    user_id = user["id"]

    categories = ["accommodation", "flights", "activities", "food", "transport", "other"]

    try:
        for cat in categories:
            # Pitch option
            opt_res = supabase.table("poll_options").insert({
                "trip_id": trip_id,
                "category": cat.lower(),
                "option_text": f"Pytest {cat} Option",
                "estimated_cost": 250.00,
                "currency": "EUR",
                "added_by": user_id
            }).execute()
            assert opt_res.data, f"Failed to insert option for {cat}"
            opt_id = opt_res.data[0]["id"]

            # Create active poll
            poll_res = supabase.table("active_polls").insert({
                "trip_id": trip_id,
                "category": cat.lower(),
                "poll_options_json": [],
                "voter_selections": {str(user_id): [str(opt_id)]},
                "votes_by_option": {str(opt_id): 1}
            }).execute()
            assert poll_res.data, f"Failed to insert active poll for {cat}"
            poll = poll_res.data[0]

            # Verify active poll query returns active poll
            fetch_res = supabase.table("active_polls").select("*").eq("id", poll["id"]).single().execute()
            assert fetch_res.data["category"] == cat.lower()

        # Check activity logs
        logs_res = supabase.table("activity_log").select("*").eq("trip_id", trip_id).execute()
        assert len(logs_res.data) >= 6, "Activity log entries missing for pitched options"

    finally:
        # Cleanup
        supabase.table("poll_options").delete().eq("trip_id", trip_id).execute()
        supabase.table("active_polls").delete().eq("trip_id", trip_id).execute()
        supabase.table("activity_log").delete().eq("trip_id", trip_id).execute()
        supabase.table("trips").delete().eq("id", trip_id).execute()
        supabase.table("users").delete().eq("id", user_id).execute()
