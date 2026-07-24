# Trip Planner

## What This Is

A collaborative trip planning platform consisting of a Telegram bot (TripSync Bot) that handles group chat interactions, RSVP tracking, option pitching, voting, and expenses logging, alongside a modern React-based web application for viewing trips, pitching options, logging expenses, editing trip settings, and managing traveler profiles.

## Core Value

Provide a seamless, multi-interface collaborative trip planning experience that bridges Telegram group chats with web views.

## Current State

Shipped **v1.9 Webapp Trip Archiving & Co-Organizer Administration** on 2026-07-24.

---

## Requirements

### Validated

- ✓ Trip creation via Telegram bot (wizard with title, destination, dates, base currency) — existing
- ✓ Participant RSVPs (Committed, Tentative, Declined) via Telegram inline buttons — existing
- ✓ Pitching and listing options under categories (Accommodation, Flights, Activities, Food, Transport, Other) — existing
- ✓ Locking in itinerary items and pitching voting — existing
- ✓ Multi-currency expense ledger and logging — existing
- ✓ Set up clean Git tracking for GSD planning documents — v1.0
- ✓ Initialize a React + Vite + Vanilla CSS webapp in the workspace — v1.0 (Phase 1)
- ✓ Webapp: View trips list and trip details (destination, dates, participants/members) — v1.0 (Phase 3)
- ✓ Webapp: Choose active participant and add new participant with auto-login — v1.0 (Phase 4)
- ✓ Telegram Bot: Error handling and connection resilience (retry policies, crash logs) — v1.1 (Phase 6)
- ✓ Telegram Bot: General UX/UI enhancements (messages, formatting, emojis) — v1.1 (Phase 7)
- ✓ Telegram Bot: Option pitching and voting improvements (richer details, multi-option voting, deadlines) — v1.1 (Phase 8)
- ✓ Telegram Bot: RSVP and Roster tracking enhancements (reminders, auto-nudging, custom status) — v1.1 (Phase 9)
- ✓ Webapp: Create a new trip (form/modal with validation and redirect) — v1.2 (Phase 10)
- ✓ Webapp: RSVP status updates (Committed, Tentative, Declined dropdown/toggle) — v1.2 (Phase 10)
- ✓ Webapp: Pitch new options & cast/retract votes — v1.2 (Phase 11)
- ✓ Webapp: Log new expenses (paid-by, amount, currency, split selection) — v1.2 (Phase 12)
- ✓ Webapp: Ledger display & settlement calculation (who owes whom, conversion rates) — v1.2 (Phase 13)
- ✓ Webapp: Global user sessions caching and splash selector screen — v1.3 (Phase 14)
- ✓ Webapp: User-scoped filtered trips dashboard and creator auto-RSVP — v1.3 (Phase 15)
- ✓ Webapp: Session reconciliation on direct links and URL autologin parameters — v1.3 (Phase 16)
- ✓ Webapp: Custom passwordless email login & magic link token verification — v1.4 (Phase 17)
- ✓ Webapp: Shareable web invite links (`/join/:tripId`) & standalone guest onboarding — v1.4 (Phase 18)
- ✓ Hybrid: Bot-web coexistence supporting Telegram users, web-only IDs, and email profiles — v1.4 (Phase 19)
- ✓ Webapp: In-app activity log & notification feed drawer with relative timestamps — v1.4 (Phase 20)
- ✓ Option pitching & database RLS audit (open RLS policies on `active_polls`) — v1.5 (Phase 21)
- ✓ Editable trip settings (title, destination, description, dates, base currency) with date conflict warnings — v1.5 (Phase 22)
- ✓ Dedicated User Profile page (`/profile`) allowing users to edit profile parameters & manage Telegram link status — v1.5 (Phase 23)
- ✓ Full platform feature audit & hardening — v1.6 (Phase 24)
- ✓ Webapp option pitching audit & database query parity (`PITCH-01`, `PITCH-02`, `SYNC-01`) — v1.7 (Phase 25)
- ✓ Webapp option voting integration, voter badges, Poll Recap modal & lock choice controls (`VOTE-01`, `VOTE-02`, `VOTE-03`, `SYNC-02`) — v1.7 (Phase 26)
- ✓ Option date & start/end time scheduling across web modal, Telegram bot pitching wizard, and card badges (`TIME-01`) — v1.8 (Phase 27)
- ✓ Interactive Trip Gantt Chart & Visual Timeline view tab with category-colored time bars (`GANTT-01`) — v1.8 (Phase 28)
- ✓ Schedule gap ("hole in plan") & overlap conflict detection engine with direct slot pitching (`GANTT-02`, `PLAN-01`) — v1.8 (Phase 29)
- ✓ iCal calendar export (`.ics` generation) & printable trip itinerary report modal (`CAL-01`) — v1.8 (Phase 30)
- ✓ Trip archiving (soft-delete), unarchiving, and dashboard filter pills (`ADMIN-01`) — v1.9 (Phase 31)
- ✓ Permanent trip deletion with clean cascading database cleanup (`ADMIN-02`) — v1.9 (Phase 31)
- ✓ Co-Organizer role promotion/demotion, roster role badges, and admin permission gates (`ADMIN-03`) — v1.9 (Phase 32)

### Deferred to Future Milestones

- [ ] Automated settlement alerts pushed to Telegram from web hooks

### Out of Scope

- [ ] Direct webapp booking or reservation integration — out of scope
- [ ] Full OAuth authentication in v1 — deferred in favor of passwordless magic links & standalone guest registration

## Context

- Shipped **v1.1 Bot Capabilities & Improvements** which hardened database error resilience, unified template formatting styles and emoji mappings, added option url/description fields, built real-time `/polls` tallies, traveler notes commands/web edits, and launched an automated asyncio nudging background loop.
- Shipped **v1.2 Web Parity & Complete Trip Management** which brought the webapp to full capability parity with the Telegram bot: including modal trip creation forms, user session RSVP updates, suggestion pitch forms, dynamic option lists with voting selection toggles, multi-currency custom splitting expense modals, responsive desktop-to-mobile ledgers, and optimized currency-converting greedy debt solvers.
- Shipped **v1.3 Traveler Profiles & Access Control** which implemented global user session caching across views, Slack/Netflix-style traveler selection grids, debounced async username pre-checks, user-scoped filtered trips dashboard queries, auto-RSVP on web trip creation, and Telegram deep linking auto-login with instant URL parameters sanitization and roster reconciliation overlay modals.
- Shipped **v1.4 Standalone Webapp & Hybrid Onboarding** which detached the application from requiring Telegram: including passwordless email login magic links, `/join/:tripId` invite URLs with guest onboarding, hybrid user profile merging (Telegram + web), and a real-time Postgres trigger-backed Activity Feed drawer on the web app.
- Shipped **v1.5 Trip Settings, User Profiles & Pitching Audit** which added editable trip settings with date conflict reconciliation warnings & dynamic FX matrix recalculation, audited database RLS policies to fix option pitching/voting, and built a dedicated `/profile` page with avatar customization and Telegram account link/unlink management.

## Constraints

- **Tech Stack (Bot)**: Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint
- **Tech Stack (Web)**: React + Vite + Vanilla CSS — user preference
- **Authentication**: Passwordless Email OTP & Standalone Link Onboarding in v1.4

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Vite + Vanilla CSS for Web | User choice for modern, fast single-page app | ✓ Good (Phase 1 setup successful) |
| Participant Selection/Addition instead of Auth | Simplicity for v1, allows quick onboarding via shared link | ✓ Good (Phase 4 setup successful) |
| Encapsulated postgrest query services & custom hooks | Clean architectural abstraction separating logic from UI views | ✓ Good (Phase 2 setup successful) |
| Negative `telegram_id` values for web users | Completely avoids collision risks with real Telegram User IDs | ✓ Good (Phase 2 setup successful) |
| Combined auto-load + manual refresh buttons | Simple way to display Telegram bot updates without real-time sockets | ✓ Good (Phase 3 setup successful) |
| Blocking profile modal selector | Restricts dynamic actions to a selected active profile session | ✓ Good (Phase 4 setup successful) |
| Centralized DB execution wrapper (`_safe_db_call`) | Ensures bot loop doesn't crash on DB timeout/failure | ✓ Good (Phase 6 setup successful) |
| Centralized emoji map (`_UX_EMOJIS`) | Uniform emoji styling across bot templates | ✓ Good (Phase 7 setup successful) |
| Telegram native poll tallies command (`/polls`) | Queries real-time tallies directly from TG API | ✓ Good (Phase 8 setup successful) |
| `asyncio` background nudge loop | Lightweight non-blocking reminders without extra pip dependencies | ✓ Good (Phase 9 setup successful) |
| Client-side JSONB updates for vote toggle | Dynamic client-side voting count caching mapped to active user IDs | ✓ Good (Phase 11 setup successful) |
| Equal vs. Custom Roster Split toggles | Standardized checklist checks for specific participant divisions | ✓ Good (Phase 12 setup successful) |
| USD-intermediary FX rates converter | Converts diverse cost inputs to trip base currency using live rates | ✓ Good (Phase 13 setup successful) |
| React Context for user sessions caching | Preserves signed in active user profile state globally | ✓ Good (Phase 14 setup successful) |
| Debounced async username pre-check validation | Prevents database username collision errors before submission | ✓ Good (Phase 14 setup successful) |
| Nested relational Supabase queries | Enforces client-side query isolation filtering trips by participant RSVPs | ✓ Good (Phase 15 setup successful) |
| Case-insensitive deep link lookups | Strip leading `@` to look up users by username/telegram_id case-insensitively | ✓ Good (Phase 16 setup successful) |
| Browser history URL state replacement | Immediately deletes credentials from address bar without reloading | ✓ Good (Phase 16 setup successful) |
| Blocking roster reconciliation modal | Enforces access control by blocking views unless registered in roster | ✓ Good (Phase 16 setup successful) |
| PostgreSQL Triggers for `activity_log` | Automatically logs RSVPs, pitches, and expenses at DB layer | ✓ Good (Phase 20 setup successful) |
| Public RLS policies for `active_polls` | Enables web & bot voting parity without DB mutation errors | ✓ Good (Phase 21 setup successful) |
| Date reconciliation modal & warning badges | Surfaces out-of-bounds options after trip date updates | ✓ Good (Phase 22 setup successful) |
| Dynamic FX settlement matrix recalculation | Preserves expense amounts while recalculating settlements in base currency | ✓ Good (Phase 22 setup successful) |
| Dedicated `/profile` view & avatar color picker | Personalizes traveler identity & simplifies Telegram account linking/unlinking | ✓ Good (Phase 23 setup successful) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-07-21 for v1.6 milestone setup*
