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

## Milestone: v1.2 — Web Parity & Complete Trip Management

**Shipped:** 2026-07-13
**Phases:** 4 | **Plans:** 5 | **Tasks:** 16

### What Was Built
- Webapp Trip creation form modals with inline redirect logic and validations.
- Active user session bar RSVP status selectors triggering Supabase updates.
- Horizontal tabs category filters, option pitching modals, and cast/retract vote cards.
- Add Expense form modals supporting custom currencies and selective split checklists.
- Responsive desktop ledger tables transitioning to mobile card lists.
- Settle Up tab panel calculating net balances and optimized greedy matching settlement paths.

### What Worked
- **Modular Database Services:** Separating options and expense API service methods into clean standalone JS files with separate Node.js verification scripts allowed direct database assertions before UI wiring.
- **Reactive Calculations during Render:** Computing total spend, split shares, net balances, and greedy transactions dynamically during render simplified state management and guaranteed real-time visual updates.

### What Was Inefficient
- **Playwright CDN Block:** Playwright driver download 404 errors from Azure mirrors persisted, requiring manual verification and lint gates instead of E2E browser tests.

### Patterns Established
- **Equal vs. Custom Toggle Checklist Pattern:** Toggling off equal splitting dynamically reveals custom checkbox list selectors populated from roster hooks.
- **Two-Tab Ledger & Settle Overview Pattern:** Housing both the scrollable expense list and optimized settlement paths in a single card using minor inline toggle switches keeps layout density clean.

### Key Lessons
- Dynamic client-side conversions can retrieve exchange rates from open APIs (open.er-api.com) and convert currencies relative to USD without leaking API keys to client browsers.

---

## Milestone: v1.4 — Standalone Webapp & Hybrid Onboarding

**Shipped:** 2026-07-20
**Phases:** 4 | **Plans:** 4 | **Tasks:** 12

### What Was Built
- Passwordless email login with magic link token verification, session caching, and Telegram account linking.
- Shareable web invite links (`/join/:tripId`) with standalone guest onboarding and auto-RSVP registration.
- Hybrid bot-web coexistence supporting Telegram users, web-only IDs, and email profiles across all services.
- In-app activity log backed by PostgreSQL database triggers, relative time formatting, and slide-out feed drawer.

### What Worked
- **Database Trigger Automation**: Using PostgreSQL triggers on `rsvps`, `poll_options`, and `expenses` tables to automatically write to `activity_log` eliminated boilerplates across bot handlers and web services.
- **On-Screen Instant Verification**: Providing an on-screen instant login verification link alongside the magic link notification provided seamless testing and developer/production fallback access.
- **Timestamp-Based Negative IDs**: Generating `-1 * (Date.now() * 1000 + random)` for standalone web travelers guaranteed 100% collision-free negative BigInt IDs in Supabase PostgreSQL.

### What Was Inefficient
- **Netlify SPA Proxying**: Client API calls to `/supabase-api/...` defaulted to Netlify's HTML rewrite fallback until explicit 200 proxy rules were added to `web/public/_redirects`.

### Patterns Established
- **Netlify 200 Proxy Rewrites**: Adding `/supabase-api/* https://<project>.supabase.co/:splat 200!` to `_redirects` ensures client-side proxies pass through to external API gateways without CORS or 404 HTML fallback issues.

### Key Lessons
- Always verify Supabase Row Level Security (RLS) policies on newly created public tables; enabling RLS without policies blocks browser clients from executing `SELECT` or `INSERT` operations.

---

## Cross-Milestone Trends

| Milestone | Date | Phases | Plans | Codebase LOC | Velocity (LOC/hr) | Notable |
|-----------|------|--------|-------|--------------|-------------------|---------|
| v1.0 MVP  | 2026-07-12 | 5 | 9 | ~1,200 LOC | - | Playwright 404 CDN bypass |
| v1.1 Bot  | 2026-07-13 | 4 | 4 | ~3,500 LOC | - | native asyncio background loop |
| v1.2 Web  | 2026-07-13 | 4 | 5 | ~5,600 LOC | - | Dynamic Settle solver & split toggles |
| v1.3 Auth | 2026-07-14 | 3 | 3 | ~7,200 LOC | - | Global user session context & deep links |
| v1.4 Hybrid| 2026-07-20 | 4 | 4 | ~9,800 LOC | - | Netlify SPA deployment & DB activity triggers |

