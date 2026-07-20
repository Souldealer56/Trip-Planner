# Plan: Hybrid Bot-Web Coexistence

Enable seamless coexistence between web-created profiles and Telegram bot users in the database and user interfaces.

## User Review Required

> [!IMPORTANT]
> **Auto-Merging Security**: Telegram usernames are easily changeable. If a user sets their Telegram username to match an existing email-only user's username, they will automatically assume control of that profile's RSVP, voting, and ledger history upon first bot contact.
> Since this is a collaborative trip planner with v1 no-auth constraint, this ease-of-use feature is approved as a trade-off.

## Open Questions

None.

## Proposed Changes

### Telegram Bot Backend

#### [MODIFY] [main.py](file:///c:/Users/alex_/Documents/Trip%20Planner/main.py)
- Implement `_get_or_link_user(tg_user)`:
  - Check if a user record exists with `telegram_id == tg_user.id`.
  - If not, look up by username case-insensitively using `.ilike()`. If found, update the `telegram_id` to link the account.
  - If no record is found, insert a new user profile.
- Refactor `start()` and `handle_rsvp()` handlers to call `_get_or_link_user`.

#### [NEW] [test_hybrid_coexistence.py](file:///c:/Users/alex_/Documents/Trip%20Planner/tests/test_hybrid_coexistence.py)
- Create unit test cases validating the case-insensitive username auto-linking and merging logic in `main.py`.

---

### Web Client

#### [MODIFY] [TripDetails.jsx](file:///c:/Users/alex_/Documents/Trip%20Planner/web/src/views/TripDetails.jsx)
- Update Roster rendering to show a blue `✈️ Telegram` badge if `telegram_id > 0`, and a green `✉️ Email` badge if `telegram_id < 0`.

#### [NEW] [verify-hybrid-coexistence.cjs](file:///c:/Users/alex_/Documents/Trip%20Planner/web/verify-hybrid-coexistence.cjs)
- Create a database validation script verifying case-insensitive queries on the `users` table.

## Verification Plan

### Automated Tests
- Run `.\venv\Scripts\pytest tests/test_hybrid_coexistence.py` to test Python bot linking logic.
- Run `node web/verify-hybrid-coexistence.cjs` to verify case-insensitive queries against the live Supabase instance.

### Manual Verification
- Join a trip using a custom guest username on the web client.
- Trigger a command in the bot with the matching Telegram username.
- Verify that the web app Roster automatically updates the badge from `✉️ Email` to `✈️ Telegram`.
