from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from main import (
    _UX_EMOJIS,
    _escape,
    roster,
    ledger,
    settle,
    budget,
    itinerary,
    wiz_paid_desc
)

def test_emoji_consistency():
    # Test that D-02 standard categories and modules exist in global emojis mapping
    expected_keys = [
        "accommodation", "flights", "flight", "activities", "activity", 
        "food", "transport", "transportation", "other",
        "roster", "budget", "ledger", "itinerary", "success", "warning", "info"
    ]
    for key in expected_keys:
        assert key in _UX_EMOJIS
        assert len(_UX_EMOJIS[key]) > 0

def test_html_escaping():
    # Test that _escape helper works as expected to prevent HTML parsing injection
    assert _escape("Hello <World> & Co.") == "Hello &lt;World&gt; &amp; Co."

@pytest.mark.asyncio
async def test_roster_formatting(mock_update, mock_context):
    # Mock database response for roster
    mock_response = MagicMock()
    mock_response.data = [
        {"status": "Committed", "users": {"first_name": "Alice"}},
        {"status": "Tentative", "users": {"first_name": "Bob"}},
        {"status": "Declined", "users": {"first_name": "Charlie"}},
    ]
    
    with patch("main.get_trip_context", AsyncMock(return_value=("trip-123", "Paris"))), \
         patch("main.supabase") as mock_supabase:
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        await roster(mock_update, mock_context)
        
        mock_update.message.reply_text.assert_called_once()
        args, kwargs = mock_update.message.reply_text.call_args
        message = args[0]
        
        # Verify formatting matches D-03 (bullets • and bold names)
        assert "📋 <b>Current Roster for Paris</b>" in message
        assert "🎒 <b>I'm In (1):</b>\n• <b>Alice</b>" in message
        assert "🤔 <b>Maybe (1):</b>\n• <b>Bob</b>" in message
        assert "❌ <b>Out (1):</b>\n• <b>Charlie</b>" in message

@pytest.mark.asyncio
async def test_ledger_budget_formatting(mock_update, mock_context):
    mock_expenses = MagicMock()
    mock_expenses.data = [
        {"amount": 100.0, "description": "Dinner", "users": {"first_name": "Alice"}},
        {"amount": 50.0, "description": "Taxi", "users": {"first_name": "Bob"}}
    ]
    
    with patch("main.get_trip_context", AsyncMock(return_value=("trip-123", "Paris Trip"))), \
         patch("main.supabase") as mock_supabase:
         
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_expenses
        
        await ledger(mock_update, mock_context)
        
        mock_update.message.reply_text.assert_called_once()
        args, kwargs = mock_update.message.reply_text.call_args
        message = args[0]
        
        # Verify list formatting uses bullet points and bold subject
        assert "🧾 <b>Shared Ledger: Paris Trip</b>" in message
        assert "• <b>Alice</b>: $100.00 (Dinner)" in message
        assert "• <b>Bob</b>: $50.00 (Taxi)" in message
        assert "• <b>Alice</b>: $100.00" in message

@pytest.mark.asyncio
async def test_itinerary_formatting(mock_update, mock_context):
    mock_itinerary = MagicMock()
    mock_itinerary.data = [
        {
            "category": "accommodation",
            "title": "Hotel Hilton",
            "start_date": "2026-07-12",
            "end_date": "2026-07-15",
            "cost_type": "Group",
            "estimated_cost": 300.0,
            "currency": "USD"
        }
    ]
    
    with patch("main.get_trip_context", AsyncMock(return_value=("trip-123", "Paris"))), \
         patch("main.supabase") as mock_supabase:
         
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_itinerary
        
        await itinerary(mock_update, mock_context)
        
        mock_update.message.reply_text.assert_called_once()
        args, kwargs = mock_update.message.reply_text.call_args
        message = args[0]
        
        # Verify block formatting and emoji prefix (D-04)
        assert "📅 <b>Official Itinerary: Paris</b>" in message
        assert "🏠 <b>Accommodation:</b> Hotel Hilton\n📅 Jul 12 to Jul 15" in message

@pytest.mark.asyncio
async def test_alert_formatting(mock_update, mock_context):
    mock_context.user_data = {
        "wiz_trip_id": "trip-123",
        "wiz_amount": 50.00,
        "wiz_cost_currency": "USD"
    }
    mock_update.message.text = "Dinner"
    
    mock_res = MagicMock()
    mock_res.data = [{"id": "expense-123"}]
    
    # Mock group trips query
    mock_group = MagicMock()
    mock_group.data = [{"group_chat_id": 999, "title": "Paris"}]
    
    with patch("main.get_db_user_id", AsyncMock(return_value="user-123")), \
         patch("main.supabase") as mock_supabase, \
         patch("main._safe_db_call", AsyncMock(side_effect=[mock_res, mock_group])):
         
        await wiz_paid_desc(mock_update, mock_context)
        
        mock_update.message.reply_text.assert_called_once()
        args, kwargs = mock_update.message.reply_text.call_args
        message = args[0]
        
        # Verify success alert matches standardized bold-header layout
        assert "✅ <b>Expense Logged!</b>" in message
        assert "You logged $50.00 for <b>Dinner</b>." in message

