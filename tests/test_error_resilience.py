from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import asyncio
from main import _safe_db_call, _send_db_error_message

@pytest.mark.asyncio
async def test_safe_db_call_success():
    # Test that _safe_db_call returns the value on a successful first attempt
    mock_query = MagicMock(return_value="success_data")
    
    result = await _safe_db_call(mock_query, fallback="fallback_value")
    
    assert result == "success_data"
    assert mock_query.call_count == 1

@pytest.mark.asyncio
async def test_safe_db_call_retry_success():
    # Test that _safe_db_call retries on failure and returns data if a subsequent attempt succeeds
    call_count = 0
    def mock_query():
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise Exception("Temporary connection error")
        return "retry_success_data"
        
    with patch("asyncio.sleep", AsyncMock()) as mock_sleep:
        result = await _safe_db_call(mock_query, fallback="fallback_value")
        
        assert result == "retry_success_data"
        assert call_count == 2
        assert mock_sleep.call_count == 1

@pytest.mark.asyncio
async def test_safe_db_call_failure_fallback():
    # Test that _safe_db_call retries 3 times and returns fallback on complete failure
    mock_query = MagicMock(side_effect=Exception("Persistent database crash"))
    
    with patch("asyncio.sleep", AsyncMock()) as mock_sleep:
        result = await _safe_db_call(mock_query, fallback="fallback_value")
        
        assert result == "fallback_value"
        assert mock_query.call_count == 3
        assert mock_sleep.call_count == 2


@pytest.mark.asyncio
async def test_send_db_error_message_text(mock_update, mock_context):
    # Test that _send_db_error_message replies with text when no callback_query is provided
    await _send_db_error_message(mock_update, mock_context)
    
    mock_update.effective_message.reply_html.assert_called_once()
    args, kwargs = mock_update.effective_message.reply_html.call_args
    assert "Database Connection Issue" in kwargs["text"]

@pytest.mark.asyncio
async def test_send_db_error_message_callback(mock_update, mock_context):
    # Test that _send_db_error_message answers callback query and edits message text
    mock_callback = AsyncMock()
    mock_callback.answer = AsyncMock()
    mock_callback.edit_message_text = AsyncMock()
    
    await _send_db_error_message(mock_update, mock_context, callback_query=mock_callback)
    
    mock_callback.answer.assert_called_once()
    mock_callback.edit_message_text.assert_called_once()
    args, kwargs = mock_callback.edit_message_text.call_args
    assert "Database Connection Issue" in kwargs["text"]


from main import get_db_user_id, _start_wizard_pm

@pytest.mark.asyncio
async def test_get_db_user_id_success():
    mock_response = MagicMock()
    mock_response.data = {"id": "user-uuid-123"}
    
    with patch("main.supabase") as mock_supabase:
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        user_id = await get_db_user_id(67890)
        assert user_id == "user-uuid-123"

@pytest.mark.asyncio
async def test_wizard_reentry_cleanup(mock_update, mock_context):
    # Test that _start_wizard_pm clears user_data of any keys starting with 'wiz_'
    mock_context.user_data = {
        "wiz_trip_id": "trip-uuid",
        "wiz_cat": "accommodation",
        "other_key": "stays_intact"
    }
    
    # We patch _get_user_trips to return empty so we end execution fast
    with patch("main._get_user_trips", AsyncMock(return_value=[])):
        await _start_wizard_pm(mock_update, mock_context, "paid")
        
        assert "wiz_trip_id" not in mock_context.user_data
        assert "wiz_cat" not in mock_context.user_data
        assert mock_context.user_data["other_key"] == "stays_intact"

