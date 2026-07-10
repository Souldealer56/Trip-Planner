# Codebase Concerns

**Analysis Date:** 2026-07-10

## Tech Debt

**Monolithic Code File:**
- **Issue:** All logic (Supabase queries, routing, PM conversation handler, formatting, date calculations, validation, rate fetching) resides in `main.py` (>3200 lines).
- **Why:** Fast bootstrapping of the Telegram bot.
- **Impact:** Poor maintainability, difficulty in isolated code updates, elevated risk of merge conflicts, and high cognitive load when navigating functions.
- **Fix approach:** Refactor `main.py` into specialized modules:
  - `config.py` - environment configs and constants.
  - `database.py` - database helper queries and schemas.
  - `currency.py` - rate fetching and exchange rate conversions.
  - `handlers/` - separate handler modules grouped by functionality (e.g., rsvp, itinerary, budgeting).

**Synchronous Exchange Rate Fetching:**
- **Issue:** `_fetch_rates_sync()` uses `urllib.request` which is a blocking call, requiring `asyncio.to_thread()` to prevent blocking the event loop.
- **Why:** Avoided importing third-party HTTP clients in original scripts.
- **Impact:** Spawns extra operating system threads for standard HTTP fetches.
- **Fix approach:** Refactor to use `httpx` (which is already installed in the `venv` site-packages) for native async HTTP requests.

**Direct DB Row Dictionary Mutations:**
- **Issue:** Interacts with the Supabase client using ad-hoc dictionary inserts/updates and select strings (e.g., `trips(id, title)`), lacking a robust ORM or type validation layer.
- **Why:** Simplicity in scripting.
- **Impact:** Hallucinated columns, schema drift failures, and lack of IDE autocompletion for DB payloads.
- **Fix approach:** Introduce Pydantic models or a lightweight ORM to validate and serialize payloads.

## Known Bugs

- **Volatile Exchange Rate Cache:** Exchange rates cache resides in `bot_data` (in-memory). Restarts wipe the cache, creating a risk of hitting rate limits on the Open Exchange Rates API under active updates/restarts.
- **RSVP Null Handling:** RSVPs assume `users` table record exists. If a user interacts in a group without first starting the bot in PM, they may throw unhandled errors during DB insertions or setup.

## Security Considerations

**Database Write Privilege:**
- **Risk:** The app uses the direct Supabase API key (potentially Service Role). If the `.env` credentials are leaked or a user exploits query injection, database access is fully exposed.
- **Current mitigation:** Environment variables are isolated inside `.env` which is gitignored.
- **Recommendations:** Ensure Row Level Security (RLS) is strictly enabled in Supabase tables, and restrict app permissions to the lowest needed scope.

---

*Concern analysis: 2026-07-10*
*Update as issues are found or resolved*
