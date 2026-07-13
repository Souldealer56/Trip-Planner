# Phase 6: Error Resilience & DB Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 6-error-resilience-db-hardening
**Areas discussed:** Database Exception Handling Pattern, User-Facing Error Message Style, Wizard Re-entry & Session Cleaning Behavior

---

## Database Exception Handling Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Resilient async helper function | Centralized async helper (e.g. `_safe_db_call`) that wraps query logic, retries on transient errors, and returns defaults on final failure | ✓ |
| Individual try/except wrapping | Wrap every Supabase call in-line inside each command handler | |
| Global Telegram Bot error handler | Rely on PTB's `add_error_handler` centrally | |

**User's choice:** Resilient async helper function (e.g. `_safe_db_call`)
**Notes:** The user opted for centralized async helper function to keep handler code clean.
Also decided to implement automatic retries (up to 3 attempts with exponential backoff) inside the helper to survive short network timeouts.

---

## User-Facing Error Message Style

| Option | Description | Selected |
|--------|-------------|----------|
| Standardized premium warning block | HTML block with emojis and a clear description instructing the user to wait and retry | ✓ |
| Minimal inline warning | Short simple alert (e.g., "⚠️ Database issue") | |
| Diagnostic warning | Include error code or type (e.g., "⚠️ Database error [PostgrestError]") | |

**User's choice:** Standardized premium warning block
**Notes:** The user wants clean HTML alerts with retry guidance. Also agreed to implement a unified `_send_db_error_message` notification helper to automatically reply or edit inline callback buttons.

---

## Wizard Re-entry & Session Cleaning Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Add all entry commands to fallbacks | Intercept `/start`, `/add_option`, etc. inside fallbacks to clear stale inputs and transition states | ✓ |
| Only support /cancel | Tell users they must send `/cancel` before starting other actions | |

**User's choice:** Add all entry commands to fallbacks
**Notes:** Intercept commands to clear user_data and restart/transition the conversation state dynamically.

---

## the agent's Discretion

- Backoff timing variables (e.g., multiplier and max delay limits).
- Error notification layout copywriting and exact logging severity details.

## Deferred Ideas

- None.

---

*Phase: 06-error-resilience-db-hardening*
*Discussion log generated: 2026-07-12*
