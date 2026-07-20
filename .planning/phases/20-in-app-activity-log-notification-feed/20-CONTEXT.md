# Phase 20: In-App Activity Log & Notification Feed - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement a centralized chronological activity log system that aggregates trip updates from both bot and web client actions:
- Create the `activity_log` table to store trip activities.
- Implement database triggers on `rsvps`, `poll_options`, and `expenses` tables to automatically write activity entries.
- Implement code-level inserts for vote casting/toggling on both web (`toggleVote` in `options.js`) and bot (`handle_poll_answer` in `main.py`).
- Render a premium glassmorphic notification drawer sliding from the right of the screen in the webapp header.
- Track read state using a LocalStorage timestamp index to show unread notifications badge counts.

</domain>

<decisions>
## Implementation Decisions

### Schema and Logging Architecture
- **D-01:** `activity_log` Table:
  - `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
  - `trip_id` UUID NOT NULL REFERENCES `public.trips(id) ON DELETE CASCADE`
  - `user_id` UUID REFERENCES `public.users(id) ON DELETE SET NULL`
  - `action_type` TEXT NOT NULL (e.g. `update_rsvp`, `pitch_option`, `add_expense`, `vote`)
  - `description` TEXT NOT NULL
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT `now()`
- **D-02:** Hybrid logging mechanism:
  - **Database Triggers**: Run automatically AFTER inserts/updates on `rsvps`, AFTER inserts on `poll_options`, and AFTER inserts on `expenses`. The trigger functions query `public.users` to prepend the actor's first name to the text.
  - **Code-level inserts**: Manually insert into `activity_log` when votes are registered inside the bot's `handle_poll_answer` and the web's `toggleVote`.

### Web client Notification Drawer UI
- **D-03:** Slide-out right panel. Render a bell icon in the `TripDetails` navigation/header with a red badge showing the count of unread logs. Clicking it slides out a glassmorphic sidebar from the right showing the chronological list of recent updates.
- **D-04:** Unread calculation: Last-read timestamp tracked in `localStorage` under `trip_planner_last_read_log_${tripId}`. Opening the drawer resets the timestamp to now, clearing the badge.

### the agent's Discretion
- Custom text formatting for trigger-generated description strings.
- Visual animations, transitions, and layout details for the notification drawer.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/PROJECT.md` — Project context and stack.
- `.planning/REQUIREMENTS.md` — Scoped requirements (NOTIF-01, NOTIF-02).
- `.planning/ROADMAP.md` — Phase 20 sequence and success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apply_migrations.py`: Schema migration script reference using pg8000.
- `web/src/views/TripDetails.jsx`: Existing card container styling, modal overlay models, and layout patterns.

### Integration Points
- Database Schema: Add `activity_log` table, enable RLS, configure triggers for rsvps/options/expenses.
- `main.py` (`handle_poll_answer`): Insert an activity record when a user votes in Telegram.
- `web/src/services/options.js` (`toggleVote`): Insert an activity record when a user votes/toggles on the web.
- `web/src/views/TripDetails.jsx`: Add notification bell, state toggles, and slide-out feed drawer UI.

</code_context>

<specifics>
## Specific Ideas

- Display activity items with relative time formatting (e.g. "2 minutes ago").
- Highlight unread activity cards inside the drawer.

</specifics>

<deferred>
## Deferred Ideas

- None.

</deferred>

---

*Phase: 20-in-app-activity-log-notification-feed*
*Context gathered: 2026-07-18*
