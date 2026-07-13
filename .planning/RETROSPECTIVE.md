# Project Retrospective — Trip Planner

This living document captures technical decisions, patterns, lessons, and cost observations across shipped milestones.

---

## Milestone: v1.0 — MVP Web App Foundations

**Shipped:** 2026-07-12
**Phases:** 5 | **Plans:** 9 | **Tasks:** 20

### What Was Built
- React + Vite single page application serving dynamic views for Trip Planner list and participant rosters.
- Supabase relational client data services and custom loading hooks.
- User session simulation using localStorage context and blocking profile selection modals.
- Glassmorphism Slate Dark Theme layout styles with pulsing loading skeletons.

### What Worked
- **Data Access Layer Abstraction**: Separating plain database queries into services (`trips.js`, `rsvps.js`, `users.js`) and exposing them to UI via custom React hooks (`useTrips`, `useTripDetails`, `useRsvpRoster`) kept component structures clean, semantic, and highly readable.
- **Negative ID Generation**: Generating negative values for web users (`telegram_id = -1000000 - Math.random()`) completely avoided key collision issues with real Telegram bot users inside shared Supabase tables.
- **Unified CSS Theme Variables**: Centralizing HSL colors, gradients, page header cards, and badge modifiers in `variables.css` and `global.css` made custom page integrations fluid.

### What Was Inefficient
- **Playwright AutomationCDN Block**: The browser subagent failed to download version 1.57.0 of its drivers due to a 404 on Microsoft CDNs. Bypassing and using manual verification checklists was necessary.
- **Sandbox Network restrictions**: Node.js database integration verification tests (`web/verify-services.cjs`) failed due to environment proxies blocking connections to outer domains. Code syntax, schema alignment, and production compilation were verified instead.

### Patterns Established
- **Simulated Active Session Pattern**: Block page details rendering by mounting overlay dialogs if `activeUser` is empty, presenting a roster pick list alongside slide join forms.
- **CSS Pulse Skeletons Pattern**: Pulse skeleton blocks matching card layout dimensions during loading states for premium visual feedback.

### Key Lessons
- Rely on static compilation verification and build testing (`npm run build`) as robust gates when proxy firewalls block network integrations.

---

## Milestone: v1.1 — Bot Capabilities & Improvements

**Shipped:** 2026-07-13
**Phases:** 4 | **Plans:** 4 | **Tasks:** 17

### What Was Built
- Safe DB Call wrapper (`_safe_db_call`) globally capturing Supabase query timeouts and errors, outputting helpful user retry instructions.
- Centralized `_UX_EMOJIS` travel dictionary styling consistent messages, headers, and rosters.
- Pitching wizard description prompt field and inline URL hyperlink parsing companion updates.
- Real-time voting tallies command (`/polls`) direct Telegram API lookup.
- Roster note entry commands (`/rsvp_notes`) and inline text edit fields in webapp TripDetails view.
- Non-blocking `asyncio` background loop running periodic checks for RSVPs seen members, stale unvoted polls, and organizer majority alerts.

### What Worked
- **Native asyncio Scheduling**: Spawning a background loop via `asyncio.create_task` directly in the bot's event loop avoided adding extra pip dependencies (like `apscheduler`) and kept codebase weight low.
- **Robust Table Mocks**: Using clear table-based mock selectors in testing (`supabase.table.side_effect = table_mock`) made the multiple database queries in reminder loops easily unit-testable.

### What Was Inefficient
- **Postgrest Relationship Ambiguities**: Chains like `.select("users!trips_organizer_id_fkey(*)")` are fragile in tests. Querying the `users` table directly with `id=organizer_id` was much more robust and simpler to mock.

### Patterns Established
- **Poll Voter Tracking Pattern**: Listen to `PollAnswer` updates, capture voter Telegram IDs, and persist them in `active_polls.voter_ids` (and remove them on retraction) to enable targeted unvoted nudges.

### Key Lessons
- Background reminder loops should rely on persistent database state indicators (`stale_nudge_sent`, `majority_nudge_sent`, `last_rsvp_nudge_at`) to ensure they are restart-resilient.

---

## Cross-Milestone Trends

| Milestone | Date | Phases | Plans | Codebase LOC | Velocity (LOC/hr) | Notable |
|-----------|------|--------|-------|--------------|-------------------|---------|
| v1.0 MVP  | 2026-07-12 | 5 | 9 | ~1,200 LOC | - | Playwright 404 CDN bypass |
| v1.1 Bot  | 2026-07-13 | 4 | 4 | ~3,500 LOC | - | native asyncio background loop |
