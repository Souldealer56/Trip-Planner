from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from datetime import datetime, timezone, timedelta
from telegram.ext import ConversationHandler
from main import wizard_router

@pytest.mark.asyncio
async def test_start_link_invalid_code(mock_update, mock_context):
    mock_context.args = ["link_INVALID"]
    
    mock_res = MagicMock()
    mock_res.data = [] # No user found
    
    with patch("main.supabase") as mock_supabase:
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_res
        
        res = await wizard_router(mock_update, mock_context)
        
        assert res == ConversationHandler.END
        mock_update.message.reply_text.assert_called_once()
        assert "Invalid verification code" in mock_update.message.reply_text.call_args[0][0]

@pytest.mark.asyncio
async def test_start_link_expired_code(mock_update, mock_context):
    mock_context.args = ["link_EXPIRED"]
    
    expired_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    mock_res = MagicMock()
    mock_res.data = [{
        "id": "target-uuid",
        "email": "test@example.com",
        "telegram_link_code": "EXPIRED",
        "telegram_link_expires_at": expired_time
    }]
    
    with patch("main.supabase") as mock_supabase:
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_res
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute = MagicMock()
        
        res = await wizard_router(mock_update, mock_context)
        
        assert res == ConversationHandler.END
        mock_update.message.reply_text.assert_called_once()
        assert "expired" in mock_update.message.reply_text.call_args[0][0]

@pytest.mark.asyncio
async def test_start_link_success_no_merge(mock_update, mock_context):
    mock_context.args = ["link_VALID"]
    mock_update.effective_user.id = 12345
    mock_update.effective_user.username = "real_tg"
    mock_update.effective_user.first_name = "RealTG"
    
    valid_time = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    
    # Mock user query for code
    mock_res_code = MagicMock()
    mock_res_code.data = [{
        "id": "target-uuid",
        "email": "test@example.com",
        "telegram_link_code": "VALID",
        "telegram_link_expires_at": valid_time
    }]
    
    # Mock stale user query (none found)
    mock_res_stale = MagicMock()
    mock_res_stale.data = []
    
    with patch("main.supabase") as mock_supabase:
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        
        select_mock = MagicMock()
        mock_table.select.return_value = select_mock
        
        eq_mock = MagicMock()
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.side_effect = [mock_res_code, mock_res_stale]
        
        res = await wizard_router(mock_update, mock_context)
        
        assert res == ConversationHandler.END
        mock_update.message.reply_text.assert_called_once()
        assert "Linked Successfully" in mock_update.message.reply_text.call_args[0][0]
        
        # Verify update was called on mock_table
        mock_table.update.assert_called_once()
        update_args = mock_table.update.call_args[0][0]
        assert update_args["telegram_id"] == 12345
        assert update_args["username"] == "real_tg"

@pytest.mark.asyncio
async def test_start_link_success_with_merge(mock_update, mock_context):
    mock_context.args = ["link_MERGE"]
    mock_update.effective_user.id = 12345
    mock_update.effective_user.username = "real_tg"
    mock_update.effective_user.first_name = "RealTG"
    
    valid_time = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    
    # Mock user query for code
    mock_res_code = MagicMock()
    mock_res_code.data = [{
        "id": "target-uuid",
        "email": "test@example.com",
        "telegram_link_code": "MERGE",
        "telegram_link_expires_at": valid_time
    }]
    
    # Mock stale user query (found a distinct profile)
    mock_res_stale = MagicMock()
    mock_res_stale.data = [{
        "id": "stale-uuid",
        "telegram_id": 12345,
        "first_name": "OldStaleProfile"
    }]
    
    with patch("main.supabase") as mock_supabase:
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        
        select_mock = MagicMock()
        mock_table.select.return_value = select_mock
        eq_mock = MagicMock()
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.side_effect = [mock_res_code, mock_res_stale]
        
        res = await wizard_router(mock_update, mock_context)
        
        assert res == ConversationHandler.END
        mock_update.message.reply_text.assert_called_once()
        assert "Linked Successfully" in mock_update.message.reply_text.call_args[0][0]
        
        # Verify RPC merge_users was called
        mock_supabase.rpc.assert_called_once_with("merge_users", {
            "target_id": "target-uuid",
            "stale_id": "stale-uuid"
        })
        
        # Verify update was called on mock_table
        mock_table.update.assert_called_once()
        update_args = mock_table.update.call_args[0][0]
        assert update_args["telegram_id"] == 12345
