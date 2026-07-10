# External Integrations

**Analysis Date:** 2026-07-10

## APIs & External Services

**Telegram Bot API:**
- Messenger platform integration enabling group and private chat interactions.
  - SDK/Client: `python-telegram-bot` package (version 22.7)
  - Auth: API token stored in `TELEGRAM_TOKEN` env var
  - Endpoints used: Long-polling updates, sendMessage, setMyCommands, sendPoll, etc.

**Open Exchange Rates:**
- Provides up-to-date currency conversion rates.
  - Integration method: REST API via HTTPS GET request to `https://openexchangerates.org/api/latest.json?app_id={app_id}`
  - Client: `urllib.request.urlopen` executed in an asynchronous thread using `asyncio.to_thread`
  - Auth: API key stored in `OPENEXCHANGERATES_APP_ID` env var
  - Caching: conversion rates are cached in bot memory (`bot_data["fx_rates"]` and `bot_data["fx_rates_ts"]`) for 1 hour to prevent API rate-limit exhaustion. Falls back to the cached rates in case of network error.

## Data Storage

**Databases:**
- Supabase (PostgreSQL) - Primary transactional data store for managing users, trips, RSVPs, itinerary options, active polls, and ledger expenses.
  - SDK/Client: `supabase-py` package (version 2.28.3)
  - Auth: Credentials stored in `SUPABASE_URL` and `SUPABASE_KEY` env vars
  - Migration / Schema: Handled directly in Supabase dashboard (no local migration tooling configured)

**File Storage:**
- None (All data is relational and stored in Supabase tables)

**Caching:**
- In-Memory Bot Cache: Exchange rates (`fx_rates`) and cache timestamp (`fx_rates_ts`) are cached within the Telegram application's `bot_data` context.

## Authentication & Identity

**User Auth:**
- Slack-like authentication by mapping Telegram users to the database.
- Database records (`users` table) link natural users by their unique Telegram user IDs (`telegram_id`).
- Authorization checks are done inside command handlers by verifying the Telegram user ID against the DB.

## Monitoring & Observability

- **Logs:** Prints simple stdout messages (e.g., `"TripSync is online..."`) to console. No formal logging framework (like `logging` or `Sentry`) is configured.

## CI/CD & Deployment

- **Hosting:** Run directly via polling (`app.run_polling()`). Typically runs on a VPS. No automated pipeline exists.

## Environment Configuration

**Development:**
- Configured via a local `.env` file containing:
  - `TELEGRAM_TOKEN`
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
  - `OPENEXCHANGERATES_APP_ID`
- Secrets are gitignored via `.gitignore`.

---

*Integration audit: 2026-07-10*
*Update when adding/removing external services*
