from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from main import handle_poll_answer

@pytest.mark.asyncio
async def test_handle_poll_answer_activity_logging():
    update = MagicMock()
    poll_answer = MagicMock()
    poll_answer.poll_id = "poll-999"
    poll_answer.user.id = 123456
    poll_answer.user.first_name = "Alice"
    poll_answer.option_ids = [0]
    update.poll_answer = poll_answer

    mock_active_poll = MagicMock()
    mock_active_poll.data = [{
        "id": "rec-123",
        "voter_ids": [],
        "trip_id": "trip-555",
        "category": "activities"
    }]

    async def run_callback(func, fallback=None):
        return func()

    with patch("main._safe_db_call", side_effect=run_callback), \
         patch("main.get_db_user_id", AsyncMock(return_value="db-user-777")), \
         patch("main.supabase") as mock_supabase:

        # Chain for select("id, voter_ids, trip_id, category").eq("telegram_poll_id", ...).execute()
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_active_poll

        await handle_poll_answer(update, None)

        # Verify activity_log insert call
        table_calls = [call.args[0] for call in mock_supabase.table.call_args_list]
        assert "activity_log" in table_calls

        # Check insert content
        insert_mock = mock_supabase.table.return_value.insert
        insert_mock.assert_called_once()
        insert_data = insert_mock.call_args[0][0]
        assert insert_data["trip_id"] == "trip-555"
        assert insert_data["user_id"] == "db-user-777"
        assert insert_data["action_type"] == "vote_poll"
        assert insert_data["description"] == "Alice voted on activities poll"
