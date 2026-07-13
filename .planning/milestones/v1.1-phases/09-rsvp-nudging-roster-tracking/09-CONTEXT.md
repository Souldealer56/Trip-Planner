# Phase 9: RSVP Nudging & Roster Tracking - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement automatic background nudges for RSVPs and unvoted polls in group chats, alongside supporting custom participant RSVP notes visible on both the Telegram roster and the React web application's roster view.

</domain>

<decisions>
## Implementation Decisions

### Database Schema Migration
- **D-01:** Add `notes` (TEXT) to the `rsvps` table and `last_rsvp_nudge_at` (TIMESTAMP WITH TIME ZONE) to the `trips` table manually via the Supabase Dashboard SQL Editor using the following query:
  ```sql
  ALTER TABLE rsvps ADD COLUMN notes TEXT;
  ALTER TABLE trips ADD COLUMN last_rsvp_nudge_at TIMESTAMP WITH TIME ZONE;
  ```
- **D-02:** The bot and web application will assume these columns exist once this phase executes.

### RSVP Notes Integration
- **D-03:** Add a new command `/rsvp_notes <notes>` in the Telegram bot. This command will update the `notes` column for the user's active RSVP record on the current trip.
- **D-04:** Update the `/roster` command output to display custom notes next to participant names in italics: e.g. `• <b>Alex</b> (📝 <i>Gluten-free</i>)`.
- **D-05:** Update the React web application's Roster API and Trip Details view to fetch, display, and allow the signed-in active user to edit/update their RSVP notes directly from the web interface.

### Background Reminders Architecture
- **D-06:** Implement a lightweight, non-blocking background task loop inside `main.py` using `asyncio.create_task` during bot startup (the `post_init` hook), avoiding extra third-party pip dependencies like `apscheduler`.
- **D-07:** Use configurable constants for nudge intervals and stale thresholds to allow easy testing and production configuration:
  - `RSVP_NUDGE_INTERVAL_HOURS = 24`
  - `POLL_NUDGE_INTERVAL_HOURS = 48`
  - `BACKGROUND_CHECK_INTERVAL_SECONDS = 3600` (1 hour)

### RSVP & Poll Nudging Logic
- **D-08 (RSVP Nudge):** Identify un-RSVP'd members by scanning all users in the database, checking if they are currently members of the group chat using Telegram's `get_chat_member` API, and listing them specifically in the nudge message if they lack an RSVP record for the active trip.
- **D-09 (Poll Nudge):** Implement a `PollAnswerHandler` to listen for votes in active polls and update the `voter_ids` list in the `active_polls` table. Nudge committed participants who haven't voted yet if the poll has been active for more than 48 hours and total committed participation is under 50%.
- **D-10 (Organizer Nudge):** Post a public announcement in the group chat tagging the trip organizer once a poll reaches 60% majority participation from committed travelers, alerting them that they can lock the poll.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — Project context and technology constraints
- `.planning/REQUIREMENTS.md` §RSVP & Roster tracking (RSVP) — Requirement definitions for RSVP-01, RSVP-02, and RSVP-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_escape(text)` — HTML characters sanitizer.
- `_UX_EMOJIS` — Centralized travel-centric emoji registry.
- `get_trip_context(update, context)` — Resolves active trip context.
- `web/src/services/rsvps.js` / `useRsvpRoster.js` — Roster loading hook and service.

### Established Patterns
- Roster rendering in `main.py` `/roster` handler and `TripDetails.jsx` in React.
- `active_polls` DB table structure with placeholder columns `voter_ids`, `stale_nudge_sent`, and `majority_nudge_sent`.

### Integration Points
- `/roster` and `/change_rsvp` command handlers in `main.py`.
- `main()` polling bootstrap and `post_init` setup hooks in `main.py`.
- `TripDetails.jsx` and `rsvps.js` in the React frontend.

</code_context>

<specifics>
## Specific Ideas

- Nudge messages should follow the bold-header template style defined in Phase 7 UI guidelines (e.g. `🔔 <b>Pending RSVPs for [Trip]!</b>`).
- Use standard `•` and bold user tags/names in nudges.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-RSVP-Nudging-Roster-Tracking*
*Context gathered: 2026-07-13*
