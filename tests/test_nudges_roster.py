from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from main import (
    rsvp_notes,
    roster,
    handle_poll_answer,
    _check_and_send_rsvp_nudges,
    _check_and_send_poll_nudges
)

@pytest.mark.asyncio
async def test_rsvp_notes_command(mock_update, mock_context):
    mock_context.args = ["Gluten-free", "arriving", "Friday"]
    
    # Custom side effect for _safe_db_call that runs the lambda
    async def run_callback(func, fallback=None):
        return func()
        
    with patch("main.get_trip_context", AsyncMock(return_value=("trip-123", "Hawaii"))), \
         patch("main.get_db_user_id", AsyncMock(return_value="user-123")), \
         patch("main.supabase") as mock_supabase, \
         patch("main._safe_db_call", side_effect=run_callback):
         
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.upsert.return_value.execute.return_value = MagicMock()
        
        await rsvp_notes(mock_update, mock_context)
        
        # Verify note is upserted
        mock_table.upsert.assert_called_once()
        args, kwargs = mock_table.upsert.call_args
        insert_dict = args[0]
        assert insert_dict["notes"] == "Gluten-free arriving Friday"
        assert insert_dict["trip_id"] == "trip-123"
        assert insert_dict["user_id"] == "user-123"
        
        mock_update.message.reply_text.assert_called_once()
        assert "✅ <b>RSVP Note Saved!</b>" in mock_update.message.reply_text.call_args[0][0]

@pytest.mark.asyncio
async def test_roster_notes_escaping(mock_update, mock_context):
    mock_context.bot = mock_update.get_bot()
    
    mock_roster = MagicMock()
    mock_roster.data = [
        {
            "status": "Committed",
            "notes": "Arriving <early>",
            "users": {"first_name": "Alex"}
        }
    ]
    
    # Custom side effect for _safe_db_call that runs the lambda
    async def run_callback(func, fallback=None):
        return func()
        
    with patch("main.get_trip_context", AsyncMock(return_value=("trip-123", "Hawaii"))), \
         patch("main.supabase") as mock_supabase, \
         patch("main._safe_db_call", side_effect=run_callback):
         
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.execute.return_value = mock_roster
        
        await roster(mock_update, mock_context)
        
        # Verify note is escaped in the roster output
        mock_update.message.reply_text.assert_called_once()
        message = mock_update.message.reply_text.call_args[0][0]
        assert "• <b>Alex</b> (📝 <i>Arriving &lt;early&gt;</i>)" in message

@pytest.mark.asyncio
async def test_rsvp_nudges_logic(mock_update, mock_context):
    mock_bot = mock_update.get_bot()
    
    mock_trips = MagicMock()
    mock_trips.data = [
        {
            "id": "trip-123",
            "title": "Hawaii Trip",
            "group_chat_id": 999,
            "last_rsvp_nudge_at": None
        }
    ]
    
    mock_users = MagicMock()
    mock_users.data = [
        {"id": "u1", "telegram_id": 111, "first_name": "UserOne", "username": "userone"},
        {"id": "u2", "telegram_id": 222, "first_name": "UserTwo", "username": "usertwo"}
    ]
    
    mock_rsvps = MagicMock()
    mock_rsvps.data = [
        {"user_id": "u1", "status": "Committed"}
        # UserTwo (u2) has not RSVP'd
    ]
    
    # Mock get_chat_member responses: u1 and u2 are both in the group
    mock_member = MagicMock()
    mock_member.status = "member"
    
    async def run_callback(func, fallback=None):
        return func()
        
    def table_mock(name):
        mock_table = MagicMock()
        if name == "trips":
            mock_table.select.return_value.not_.is_.return_value.execute.return_value = mock_trips
        elif name == "users":
            mock_table.select.return_value.execute.return_value = mock_users
        elif name == "rsvps":
            mock_table.select.return_value.eq.return_value.execute.return_value = mock_rsvps
        return mock_table

    with patch("main.supabase") as mock_supabase, \
         patch("main._safe_db_call", side_effect=run_callback), \
         patch.object(mock_bot, "get_chat_member", AsyncMock(return_value=mock_member)):
         
        mock_supabase.table.side_effect = table_mock
        
        await _check_and_send_rsvp_nudges(mock_bot)
        
        # Verify group nudge was sent
        mock_bot.send_message.assert_called_once()
        args, kwargs = mock_bot.send_message.call_args
        assert kwargs["chat_id"] == 999
        assert "🔔 <b>Pending RSVPs for Hawaii Trip!</b>" in kwargs["text"]
        assert "• <b>UserTwo</b> (@usertwo)" in kwargs["text"]

@pytest.mark.asyncio
async def test_poll_answer_updates_voter_ids(mock_update, mock_context):
    # Mock incoming PollAnswer update
    mock_update.poll_answer = MagicMock()
    mock_update.poll_answer.poll_id = "poll-123"
    mock_update.poll_answer.user.id = 1111
    mock_update.poll_answer.option_ids = [0]
    
    mock_poll = MagicMock()
    mock_poll.data = [
        {
            "id": "ap-123",
            "telegram_poll_id": "poll-123",
            "voter_ids": [2222]
        }
    ]
    
    # Custom side effect for _safe_db_call that runs the lambda
    async def run_callback(func, fallback=None):
        return func()
        
    with patch("main.supabase") as mock_supabase, \
         patch("main._safe_db_call", side_effect=run_callback):
         
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value.eq.return_value.execute.return_value = mock_poll
        mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock()
        
        await handle_poll_answer(mock_update, mock_context)
        
        # Verify DB is updated with user 1111 added
        mock_table.update.assert_called_once()
        assert 1111 in mock_table.update.call_args[0][0]["voter_ids"]
        assert 2222 in mock_table.update.call_args[0][0]["voter_ids"]

@pytest.mark.asyncio
async def test_poll_nudges_logic(mock_update, mock_context):
    mock_bot = mock_update.get_bot()
    
    # Poll was sent 50 hours ago (>48h stale threshold), stale_nudge_sent = False
    mock_polls = MagicMock()
    mock_polls.data = [
        {
            "id": "ap-123",
            "trip_id": "trip-123",
            "telegram_poll_id": "poll-123",
            "group_chat_id": 999,
            "category": "accommodation",
            "poll_options_json": [{"index": 0, "text": "Hotel"}],
            "committed_count": 3,
            "voter_ids": [111], # only 1 voter, less than 50% participation threshold (1/3 = 33%)
            "stale_nudge_sent": False,
            "majority_nudge_sent": False,
            "sent_at": "2026-07-10T10:00:00Z"
        }
    ]
    
    # Committed travelers for trip
    mock_rsvps = MagicMock()
    mock_rsvps.data = [
        {"status": "Committed", "users": {"telegram_id": 111, "first_name": "UserOne", "username": "userone"}},
        {"status": "Committed", "users": {"telegram_id": 222, "first_name": "UserTwo", "username": "usertwo"}},
        {"status": "Committed", "users": {"telegram_id": 332, "first_name": "UserThree", "username": None}}
    ]
    
    # Mock Telegram get_poll response
    mock_telegram_poll = MagicMock()
    mock_telegram_poll.options = [MagicMock(position=0, voter_count=1)]
    
    # Mock trip organizer lookup
    mock_trip_org = MagicMock()
    mock_trip_org.data = [{"organizer_id": "org-123"}]
    mock_user_org = MagicMock()
    mock_user_org.data = [{"telegram_id": 9999, "first_name": "Organizer", "username": "organiser_user"}]
    
    async def run_callback(func, fallback=None):
        return func()
        
    def table_mock(name):
        mock_table = MagicMock()
        if name == "active_polls":
            mock_table.select.return_value.execute.return_value = mock_polls
            mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock()
        elif name == "rsvps":
            mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_rsvps
        elif name == "trips":
            mock_table.select.return_value.eq.return_value.execute.return_value = mock_trip_org
        elif name == "users":
            mock_table.select.return_value.eq.return_value.execute.return_value = mock_user_org
        return mock_table

    with patch("main.supabase") as mock_supabase, \
         patch("main._safe_db_call", side_effect=run_callback), \
         patch.object(mock_bot, "get_poll", AsyncMock(return_value=mock_telegram_poll)):
         
        mock_supabase.table.side_effect = table_mock
        
        await _check_and_send_poll_nudges(mock_bot)
        
        # Verify stale reminder nudge was sent to group chat listing outstanding voters
        mock_bot.send_message.assert_any_call(
            chat_id=999,
            text="🗳️ <b>Vote Reminder: Accommodation Poll</b>\n\nWe need votes from the following committed travelers:\n• <b>UserTwo</b> (@usertwo)\n• <b>UserThree</b>\n\nPlease cast your vote in the poll above!",
            parse_mode="HTML"
        )
