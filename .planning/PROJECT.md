# Trip Planner

## What This Is

A collaborative trip planning platform consisting of a Telegram bot (TripSync Bot) that handles group chat interactions, RSVP tracking, option pitching, voting, and expenses logging, alongside a modern React-based web application for viewing trips, pitching options, logging expenses, and managing participants.

## Core Value

Provide a seamless, multi-interface collaborative trip planning experience that bridges Telegram group chats with web views.

## Current Milestone: Milestone v1.4 Completed (Preparing for Next Milestone)

**Goal:** Detach the project from Telegram so users can sign up, join, and use the webapp with or without Telegram, supporting a hybrid model.

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

### Active

- (None. All v1.4 features shipped and validated.)

### Deferred to Future Milestones

- [ ] Automated settlement alerts pushed to Telegram from web hooks

### Out of Scope

- [ ] Webapp editing of trip metadata in v1 — deferred to keep scope focused
- [ ] Direct webapp booking or reservation integration — out of scope
- [ ] Full OAuth authentication in v1 — deferred in favor of passwordless magic links & standalone guest registration

## Context

- Shipped **v1.1 Bot Capabilities & Improvements** which hardened database error resilience, unified template formatting styles and emoji mappings, added option url/description fields, built real-time `/polls` tallies, traveler notes commands/web edits, and launched an automated asyncio nudging background loop.
- Shipped **v1.2 Web Parity & Complete Trip Management** which brought the webapp to full capability parity with the Telegram bot: including modal trip creation forms, user session RSVP updates, suggestion pitch forms, dynamic option lists with voting selection toggles, multi-currency custom splitting expense modals, responsive desktop-to-mobile ledgers, and optimized currency-converting greedy debt solvers.
- Shipped **v1.3 Traveler Profiles & Access Control** which implemented global user session caching across views, Slack/Netflix-style traveler selection grids, debounced async username pre-checks, user-scoped filtered trips dashboard queries, auto-RSVP on web trip creation, and Telegram deep linking auto-login with instant URL parameters sanitization and roster reconciliation overlay modals.
- Shipped **v1.4 Standalone Webapp & Hybrid Onboarding** which detached the application from requiring Telegram: including passwordless email login magic links, `/join/:tripId` invite URLs with guest onboarding, hybrid user profile merging (Telegram + web), and a real-time Postgres trigger-backed Activity Feed drawer on the web app.

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-07-20 after v1.4 milestone completion*
