# Coding Conventions

**Analysis Date:** 2026-07-10

## Naming Patterns

**Files:**
- lowercase all-in-one scripts or kebab-case config files: `main.py` is the single application file.

**Functions:**
- **Private Helper Functions:** Prefixed with a single leading underscore (e.g., `_fmt()`, `_parse_price_and_currency()`, `_convert()`, `_get_exchange_rates()`, `_accommodation_coverage()`).
- **Telegram Update/Command Handlers:** Lowercase with snake_case (e.g., `start()`, `roster()`, `add_option()`, `ledger()`, `settle()`).
- **Conversation State Handlers:** Prefixed with `get_` (e.g., `get_title()`, `get_destination()`) or `wiz_` (e.g., `wiz_addopt_cat()`, `wiz_lock_cat()`, `wiz_vote_cat()`).

**Variables:**
- **Local Variables:** snake_case (e.g., `trip_id`, `user_data`, `now`, `app_id`).
- **Global Constants:** UPPER_SNAKE_CASE (e.g., `STALE_POLL_HOURS`, `MAJORITY_THRESHOLD`, `TRIP_SELECT`, `ACTION_ADDOPT`).
- **Private Global Constants:** Prefixed with a single leading underscore (e.g., `_COMMON_CURRENCIES`, `_SYMBOL_TO_ISO`, `_ISO_TO_SYMBOL`).

**Types & Classes:**
- Type annotations are actively used on parameters and return signatures (e.g., `amount: float`, `currency: str`, `-> str`, `supabase: Client`, `tg_user_id: int`).

## Code Style

**Formatting:**
- **Tabular Assignment Alignments:** Equals signs are often vertically aligned in consecutive variable definitions to improve readability (e.g., `STALE_POLL_HOURS       = 48`, `STALE_PARTICIPATION    = 0.50`).
- **Section Headers:** Clean visual boundaries separating logical areas using commented hyphen-lines (e.g., `# ---------------------------------------------------------------------------`).
- **Docstrings:** Standard Python triple-quoted docstrings are expected at the top of helper functions to describe inputs, outputs, and behaviors.

**Error Handling:**
- Wrap database interactions and network API calls in `try/except` blocks.
- Non-fatal execution errors are logged or skipped silently to guarantee bot stability (e.g., returning cached exchange rates on `URLError`, or skipping command updates in group setups if a user has not started the bot).
- User-facing error notifications guide the user on how to retry in case of failure.

---

*Convention analysis: 2026-07-10*
*Update as patterns emerge*
