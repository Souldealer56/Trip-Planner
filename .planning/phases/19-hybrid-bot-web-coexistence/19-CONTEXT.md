# Phase 19: Hybrid Bot-Web Coexistence - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure seamless coexistence between web-created profiles and Telegram bot users in the database and user interfaces:
- Auto-link Telegram accounts on first bot contact if the username matches an existing profile case-insensitively.
- Display mixed traveler profiles safely in the webapp roster, options, voting, and expense ledger with profile type indicators/badges.
- Enforce case-insensitive queries (`ilike` / lowercase normalization) when resolving usernames and emails across all tiers.

</domain>

<decisions>
## Implementation Decisions

### Telegram Profile Auto-Merging
- **D-01:** Auto-merge on first contact. When a user interacts with the bot (e.g. by sending `/start` or triggering an inline RSVP callback), the bot checks if a traveler record already exists with their positive `telegram_id`. If not, the bot queries the `users` table for their Telegram username case-insensitively. If a matching record is found (which was created on the web with a negative `telegram_id`), the bot updates that record with the user's real positive `telegram_id` (and updates name/username details) instead of creating a duplicate record.

### Profile Type Badges in Web UI
- **D-02:** Render subtle profile badges. Displays small visual badges (e.g., a Telegram icon for linked profiles, an envelope icon or "Email" indicator badge for standalone travelers) next to names in the trip RSVP Roster and expense ledger list views to distinguish profile types.

### Case-Insensitive Database Queries
- **D-03:** Case-insensitivity. Ensure all database queries resolving usernames or email addresses in both Python bot commands and React JS services utilize case-insensitive comparison operations (e.g. `ilike` in Supabase JS/Python, or converting inputs and fields to lowercase).

### the agent's Discretion
- Visual asset styles, icons, and placement of traveler profile type badges.
- Confirmation logs and messages returned by the bot upon successful auto-linking.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/PROJECT.md` — Project goals and constraints.
- `.planning/REQUIREMENTS.md` — Scoped requirements (HYB-01, HYB-02, HYB-03).
- `.planning/ROADMAP.md` — Phase 19 sequence and success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `main.py` (`start` & `handle_rsvp`): Current registration entry points in the bot.
- `web/src/services/users.js` (`fetchUserByUsername`): Existing case-insensitive query template using `.ilike()`.

### Integration Points
- `main.py` (`start` & `handle_rsvp`): Modify the user upsert block to query existing users by username case-insensitively before upserting, linking the `telegram_id` if found.
- `web/src/views/TripDetails.jsx`: Update traveler list renderings in the RSVP Roster and ledger cards to display profile type badges based on the user's `telegram_id` (e.g. `telegram_id > 0` indicates a Telegram-linked profile, while `telegram_id < 0` indicates a web/email profile).

</code_context>

<specifics>
## Specific Ideas

- Check if `telegram_id > 0` to display a Telegram badge/icon, and `telegram_id < 0` for email/envelope icons.

</specifics>

<deferred>
## Deferred Ideas

- None.

</deferred>

---

*Phase: 19-hybrid-bot-web-coexistence*
*Context gathered: 2026-07-17*
