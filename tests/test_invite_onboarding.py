from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from main import roster

@pytest.mark.asyncio
async def test_roster_tentative_rendering(mock_update, mock_context):
    # Mock database response for roster containing Committed, Tentative and Declined members
    mock_response = MagicMock()
    mock_response.data = [
        {"status": "Committed", "notes": None, "users": {"first_name": "Alice"}},
        {"status": "Tentative", "notes": "Need to confirm flights", "users": {"first_name": "Bob"}},
        {"status": "Declined", "notes": None, "users": {"first_name": "Charlie"}},
    ]
    
    with patch("main.get_trip_context", AsyncMock(return_value=("trip-123", "Hawaii"))), \
         patch("main.supabase") as mock_supabase:
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        await roster(mock_update, mock_context)
        
        mock_update.message.reply_text.assert_called_once()
        args, kwargs = mock_update.message.reply_text.call_args
        message = args[0]
        
        # Verify formatting groups Tentative under "Maybe" heading (with note)
        assert "📋 <b>Current Roster for Hawaii</b>" in message
        assert "🎒 <b>I'm In (1):</b>\n• <b>Alice</b>" in message
        assert "🤔 <b>Maybe (1):</b>\n• <b>Bob</b> (📝 <i>Need to confirm flights</i>)" in message
        assert "❌ <b>Out (1):</b>\n• <b>Charlie</b>" in message
