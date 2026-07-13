import sys
import os
from unittest.mock import AsyncMock, MagicMock
import pytest

# Ensure workspace root is in python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

@pytest.fixture
def mock_bot():
    bot = AsyncMock()
    # Mock bot helper methods
    bot.send_message = AsyncMock(return_value=MagicMock())
    bot.edit_message_text = AsyncMock(return_value=MagicMock())
    return bot

@pytest.fixture
def mock_update(mock_bot):
    update = MagicMock()
    update.effective_chat = MagicMock()
    update.effective_chat.id = 12345
    update.effective_chat.type = "private"
    
    update.effective_user = MagicMock()
    update.effective_user.id = 67890
    update.effective_user.first_name = "TestUser"
    update.effective_user.username = "testuser"
    
    update.message = MagicMock()
    update.message.chat_id = 12345
    update.message.reply_text = AsyncMock(return_value=MagicMock())
    update.message.reply_html = AsyncMock(return_value=MagicMock())
    
    update.callback_query = None
    update.get_bot = MagicMock(return_value=mock_bot)
    
    return update

@pytest.fixture
def mock_context():
    context = MagicMock()
    context.user_data = {}
    context.args = []
    return context
