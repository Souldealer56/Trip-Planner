import pytest
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(r"c:\Users\alex_\Documents\Trip Planner\.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://obilxzpljuphlkkchnam.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

@pytest.fixture(scope="module")
def supabase() -> Client:
    assert SUPABASE_KEY, "SUPABASE_KEY environment variable is missing"
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def test_trip_settings_updates(supabase: Client):
    """Verifies updating trip title, destination, dates, currency, and vibe in database."""
    # 1. Create initial trip
    trip_res = supabase.table("trips").insert({
        "title": "Pytest Old Title",
        "destination": "London",
        "start_date": "2026-11-01",
        "end_date": "2026-11-10",
        "base_currency": "GBP",
        "vibe": "Original Vibe"
    }).execute()
    assert trip_res.data, "Failed to create test trip"
    trip_id = trip_res.data[0]["id"]

    try:
        # 2. Update trip settings
        update_res = supabase.table("trips").update({
            "title": "Pytest New Title",
            "destination": "London & Oxford",
            "start_date": "2026-11-03",
            "end_date": "2026-11-08",
            "base_currency": "EUR",
            "vibe": "Updated Vibe"
        }).eq("id", trip_id).execute()

        assert update_res.data, "Failed to update trip"
        updated = update_res.data[0]
        assert updated["title"] == "Pytest New Title"
        assert updated["destination"] == "London & Oxford"
        assert updated["start_date"] == "2026-11-03"
        assert updated["end_date"] == "2026-11-08"
        assert updated["base_currency"] == "EUR"
        assert updated["vibe"] == "Updated Vibe"

    finally:
        # Cleanup
        supabase.table("trips").delete().eq("id", trip_id).execute()
