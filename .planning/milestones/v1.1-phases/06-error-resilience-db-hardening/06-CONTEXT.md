# Phase 6: Error Resilience & DB Hardening - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Safeguard the bot's polling loop against connection dropouts or server failures when communicating with Supabase. Catch exceptions globally, present clean retry alerts, and prevent state collisions on wizard re-entry.

</domain>

<decisions>
## Implementation Decisions

### Database Exception Handling Pattern
- **D-01:** Implement a centralized async helper function (e.g. `_safe_db_call`) that wraps Supabase query operations, handles logging, and returns safe fallbacks (e.g., `None` or empty lists/dicts).
- **D-02:** The `_safe_db_call` wrapper will run automatic retries (up to 3 attempts with exponential backoff) before returning a fallback default on network or timeout errors.

### User-Facing Error Message Style
- **D-03:** Implement a unified messaging helper `_send_db_error_message` that handlers call to output standardized HTML warning blocks with emojis. The helper will automatically detect context and either reply to messages or edit active inline buttons.

### Wizard Re-entry & Session Cleaning
- **D-04:** Add all entry command handlers (`/start`, `/add_option`, `/lock_master`, `/vote`, `/paid`) to the `pm_wizard_handler`'s `fallbacks` list. This intercepts any active conversation state, clears context parameters, and restarts/transitions the user into the new wizard cleanly.

### the agent's Discretion
- Backoff timing variables and exact log formats.
- Error notification copy layout details.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — Project context and technology constraints
- `.planning/REQUIREMENTS.md` §Error Resilience (ERR) — Scope details and validation rules for ERR-01, ERR-02, and ERR-03

</canonical_refs>

<specifics>
## Specific Ideas

- "I want the error blocks to clearly guide users to try again later so they aren't confused by blank responses."
- "Re-entry should work cleanly when a user switches between adding options and logging payments without needing to type /cancel."

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_trip_context(tg_user_id, tg_chat_id)` — resolves user active trip metadata.
- `get_db_user_id(telegram_id)` — resolves internal Supabase user UUID.

### Established Patterns
- Monolithic callback register logic inside `main.py` using `Application.add_handler()`.

### Integration Points
- `main()` function in `main.py` where `pm_wizard_handler` and global command routes are configured.

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-error-resilience-db-hardening*
*Context gathered: 2026-07-12*
