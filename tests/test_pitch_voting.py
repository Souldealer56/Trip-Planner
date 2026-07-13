from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from telegram import ReplyKeyboardMarkup
from main import (
    ADD_OPT_DESC,
    ADD_OPT_DATES,
    wiz_addopt_desc,
    wiz_addopt_price,
    finalize_vote,
    polls
)

@pytest.mark.asyncio
async def test_pitch_wizard_description(mock_update, mock_context):
    # Test entering description text
    mock_update.message.text = "Beautiful villa close to the beach"
    mock_context.user_data = {}
    
    next_state = await wiz_addopt_desc(mock_update, mock_context)
    
    assert next_state == ADD_OPT_DATES
    assert mock_context.user_data["wiz_desc"] == "Beautiful villa close to the beach"
    mock_update.message.reply_text.assert_called_once()
    
    # Test skipping description
    mock_update.message.text = "Skip description"
    mock_context.user_data = {}
    mock_update.message.reply_text.reset_mock()
    
    next_state = await wiz_addopt_desc(mock_update, mock_context)
    
    assert next_state == ADD_OPT_DATES
    assert mock_context.user_data["wiz_desc"] is None
    mock_update.message.reply_text.assert_called_once()

@pytest.mark.asyncio
async def test_option_db_insert(mock_update, mock_context):
    mock_context.user_data = {
        "wiz_trip_id": "trip-123",
        "wiz_cat": "accommodation",
        "wiz_name": "Beach House",
        "wiz_start": MagicMock(),
        "wiz_end": MagicMock(),
        "wiz_link": "https://airbnb.com/beachhouse",
        "wiz_desc": "Cozy room with sea view",
        "wiz_base_currency": "USD"
    }
    mock_update.message.text = "1200"
    
    mock_res = MagicMock()
    mock_res.data = [{"id": "opt-123"}]
    
    # Custom side effect for _safe_db_call that runs the lambda
    async def run_callback(func, fallback=None):
        return func()
        
    with patch("main.get_db_user_id", AsyncMock(return_value="user-123")), \
         patch("main.supabase") as mock_supabase, \
         patch("main._safe_db_call", side_effect=run_callback):
         
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_res
        
        await wiz_addopt_price(mock_update, mock_context)
        
        # Verify the insert dictionary passed to supabase includes link and description
        insert_mock = mock_supabase.table.return_value.insert
        insert_mock.assert_called_once()
        args, kwargs = insert_mock.call_args
        insert_dict = args[0]
        
        assert insert_dict["link"] == "https://airbnb.com/beachhouse"
        assert insert_dict["description"] == "Cozy room with sea view"

@pytest.mark.asyncio
async def test_companion_message_formatting(mock_update, mock_context):
    # Setup data with link and description
    chosen_options = [
        {
            "option_text": "Beach House",
            "start_date": "2026-07-12",
            "end_date": "2026-07-15",
            "estimated_cost": 300.0,
            "link": "https://airbnb.com/beachhouse",
            "description": "Amazing sea view"
        },
        {
            "option_text": "City Hotel",
            "start_date": "2026-07-12",
            "end_date": "2026-07-15",
            "estimated_cost": 200.0,
            "link": None,
            "description": None
        }
    ]
    
    mock_context.user_data = {
        "wiz_trip_id": "trip-123",
        "wiz_vote_cat": "accommodation",
        "wiz_vote_all_options": chosen_options
    }
    
    mock_context.bot = mock_update.get_bot()
    
    # Mock supabase responses nested chain
    mock_roster = MagicMock()
    mock_roster.data = [{"id": 1}, {"id": 2}, {"id": 3}]
    
    mock_trip = MagicMock()
    mock_trip.data = {"title": "Hawaii Trip", "group_chat_id": 999}
    
    with patch("main.supabase") as mock_supabase:
        # Mock for table("rsvps").select("id").eq("trip_id", ...).eq("status", "Committed").execute()
        # Mock for table("trips").select("title, group_chat_id").eq("id", ...).single().execute()
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_roster
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_trip
        
        # Call finalize_vote
        await finalize_vote(mock_update, mock_context, start_date=None, end_date=None)
        
        # Verify companion message formatting
        mock_update.get_bot.return_value.send_message.assert_called_once()
        args, kwargs = mock_update.get_bot.return_value.send_message.call_args
        message = kwargs["text"]
        
        # Inline HTML link formatted on the name (D-05)
        assert "<b>1. <a href='https://airbnb.com/beachhouse'>Beach House</a></b>" in message
        # Description displayed (D-05)
        assert '📝 <i>Amazing sea view</i>' in message
        # Option without link formatted as bold only (D-06)
        assert '<b>2. City Hotel</b>' in message
        assert '📝' not in message.split("City Hotel")[1] # No description listed for second

@pytest.mark.asyncio
async def test_polls_command_tallies(mock_update, mock_context):
    mock_polls = MagicMock()
    mock_polls.data = [
        {
            "telegram_poll_id": "poll-123",
            "category": "accommodation",
            "poll_options_json": [
                {"index": 0, "text": "Beach House"},
                {"index": 1, "text": "City Hotel"}
            ]
        }
    ]
    
    mock_poll_obj = MagicMock()
    mock_poll_obj.options = [
        MagicMock(position=0, voter_count=4),
        MagicMock(position=1, voter_count=2)
    ]
    
    mock_context.bot = mock_update.get_bot()
    
    with patch("main.get_trip_context", AsyncMock(return_value=("trip-123", "Hawaii"))), \
         patch("main._safe_db_call", AsyncMock(return_value=mock_polls)), \
         patch.object(mock_context.bot, "get_poll", AsyncMock(return_value=mock_poll_obj)):
         
        await polls(mock_update, mock_context)
        
        mock_update.message.reply_text.assert_called_once()
        args, kwargs = mock_update.message.reply_text.call_args
        message = args[0]
        
        assert "🗳️ <b>Active Poll Results for Hawaii</b>" in message
        assert "• <b>Beach House</b>: 4 votes (67%)" in message
        assert "• <b>City Hotel</b>: 2 votes (33%)" in message
