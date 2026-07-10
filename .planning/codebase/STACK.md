# Technology Stack

**Analysis Date:** 2026-07-10

## Languages

**Primary:**
- Python 3.13 - All application code (`main.py`)

**Secondary:**
- None

## Runtime

**Environment:**
- Python 3.13
- Virtual environment (`venv`) used for local package isolation

**Package Manager:**
- pip 26.0.1
- Lockfile: None (no `requirements.txt` or `pyproject.toml` present in root)

## Frameworks

**Core:**
- None (Direct Telegram bot application built on `python-telegram-bot`)

**Testing:**
- None (No test suite or testing framework configured)

**Build/Dev:**
- None

## Key Dependencies

**Critical:**
- `python-telegram-bot` 22.7 - Asynchronous wrapper for the Telegram Bot API (handles commands, messaging, conversation states, and polling)
- `supabase` 2.28.3 - Python client for Supabase (handles database interactions with PostgreSQL, connection pooling, and Postgrest queries)
- `python-dotenv` 1.2.2 - Loads environment variables from a local `.env` file

**Infrastructure:**
- `urllib` (Standard Library) - Sync HTTP client used inside `asyncio.to_thread` for external API currency rate calls
- `asyncio` (Standard Library) - Async event loop orchestration

## Configuration

**Environment:**
- `.env` file (gitignored) - Houses critical credentials
- Required environment variables:
  - `TELEGRAM_TOKEN` - Authorization token for the Telegram Bot API
  - `SUPABASE_URL` - Endpoint URL for the Supabase project
  - `SUPABASE_KEY` - API key (service role or anon) for Supabase DB access
  - `OPENEXCHANGERATES_APP_ID` - API key for fetching exchange rates

**Build:**
- None

## Platform Requirements

**Development:**
- Any platform (macOS/Windows/Linux) supporting Python 3.13
- Internet access required for connecting to Telegram API and Supabase

**Production:**
- Standard Python 3.13 execution environment (e.g., Virtual Private Server (VPS), cloud hosting with process managers like `systemd` or `supervisord`, or Docker container)

---

*Stack analysis: 2026-07-10*
*Update after major dependency changes*
