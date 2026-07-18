from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from main import _get_or_link_user

@pytest.mark.asyncio
async def test_get_or_link_user_existing_telegram_id():
    tg_user = MagicMock()
    tg_user.id = 12345
    tg_user.username = "alice_test"
    tg_user.first_name = "Alice"
    tg_user.is_bot = False
    
    mock_res_select = MagicMock()
    mock_res_select.data = {"id": "uuid-123"}
    
    with patch("main.supabase") as mock_supabase:
        mock_supabase.table.return_value.select.return_value.eq.return_value.maybeSingle.return_value.execute.return_value = mock_res_select
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
        
        user_id = await _get_or_link_user(tg_user)
        assert user_id == "uuid-123"
        # Check that it updated the user's details just in case
        mock_supabase.table.return_value.update.assert_called_with({
            "username": "alice_test",
            "first_name": "Alice"
        })

@pytest.mark.asyncio
async def test_get_or_link_user_link_by_username_case_insensitive():
    tg_user = MagicMock()
    tg_user.id = 12345
    tg_user.username = "Bob_Test"
    tg_user.first_name = "Bob"
    tg_user.is_bot = False
    
    # 1. First select (by telegram_id) returns None
    mock_res_telegram = MagicMock()
    mock_res_telegram.data = None
    
    # 2. Second select (ilike username) returns existing web profile (negative telegram_id)
    mock_res_username = MagicMock()
    mock_res_username.data = {"id": "uuid-bob"}
    
    with patch("main.supabase") as mock_supabase:
        mock_table = mock_supabase.table.return_value
        
        # We need a custom side effect or return value setup for select chain.
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        
        mock_eq = MagicMock()
        mock_select.eq.return_value = mock_eq
        mock_eq.maybeSingle.return_value.execute.return_value = mock_res_telegram
        
        mock_ilike = MagicMock()
        mock_select.ilike.return_value = mock_ilike
        mock_ilike.maybeSingle.return_value.execute.return_value = mock_res_username
        
        mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock()
        
        user_id = await _get_or_link_user(tg_user)
        assert user_id == "uuid-bob"
        
        # Verify update was called to link Bob's Telegram ID
        mock_table.update.assert_called_with({
            "telegram_id": 12345,
            "username": "Bob_Test",
            "first_name": "Bob"
        })

@pytest.mark.asyncio
async def test_get_or_link_user_create_new():
    tg_user = MagicMock()
    tg_user.id = 54321
    tg_user.username = "charlie_test"
    tg_user.first_name = "Charlie"
    tg_user.is_bot = False
    
    mock_res_telegram = MagicMock()
    mock_res_telegram.data = None
    
    mock_res_username = MagicMock()
    mock_res_username.data = None
    
    mock_res_insert = MagicMock()
    mock_res_insert.data = [{"id": "uuid-charlie"}]
    
    with patch("main.supabase") as mock_supabase:
        mock_table = mock_supabase.table.return_value
        
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        
        mock_eq = MagicMock()
        mock_select.eq.return_value = mock_eq
        mock_eq.maybeSingle.return_value.execute.return_value = mock_res_telegram
        
        mock_ilike = MagicMock()
        mock_select.ilike.return_value = mock_ilike
        mock_ilike.maybeSingle.return_value.execute.return_value = mock_res_username
        
        mock_table.upsert.return_value.execute.return_value = mock_res_insert
        
        user_id = await _get_or_link_user(tg_user)
        assert user_id == "uuid-charlie"
        mock_table.upsert.assert_called_once()
