# Trip Planner

## What This Is

A 100% standalone, web-first collaborative trip planning application that allows groups of travelers to coordinate itineraries, pitch and vote on options (accommodations, activities, meals, transport), track participant RSVPs, schedule events on a visual Gantt timeline, log shared expenses with automated debt minimization settlements, and synchronize changes in real-time across users via Supabase WebSockets.

## Core Value

Provide an intuitive, real-time, responsive web interface for frictionless group trip coordination without reliance on third-party messaging bots or external chat apps.

## Current State

Shipped **v3.0 Standalone Web-First Architecture & Modular UI Refactor**, **v3.1 Native Supabase Auth, Real-Time WebSockets & GitHub Actions CI Pipeline**, and **v4.0 Smart Trip OS: Relational Core, Dynamic Logistics & Personal Cost Simulation** (Complete).

---

## Current Milestone: Milestone v4.0 Complete — Smart Trip OS

**Goal:** Transform Trip Planner from a passive itinerary board into an active operational operating system linking participant presence, option pricing models, category intendance (meals & groceries), daily logistics coverage gauges, and personal projected cost simulations.

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
- ✓ Locked option to expense conversion ("💸 Log as Expense") with pre-filled title, amount, currency, and payer — v2.0 (Phase 33)
- ✓ Flexible expense cost partitioning (equal split, custom dollar amount/percentage, or participant exclusion) — v2.0 (Phase 34)
- ✓ Budget breakdown & traveler cost distribution analytics report with variance tracking & category progress bars — v2.0 (Phase 35)
- ✓ Pure standalone web-first architecture: complete purge of Telegram bot, Python code, and legacy Telegram schema — v3.0
- ✓ Clean, normalized PostgreSQL schema migration with strict first-class columns (`is_archived`, `role`, `locked_option_id`) — v3.0
- ✓ Modular UI component refactor: decomposed `TripDetails.jsx` into focused sub-components (`TripHeader`, `RosterSection`, `OptionsTab`, `LedgerAndSettleTab`, `BudgetAnalyticsTab`, modals) — v3.0
- ✓ Native Supabase Auth migration (`auth.uid()`, passwordless OTP magic links, public `anon` key isolation) — v3.1
- ✓ PostgreSQL Row Level Security (RLS) policies scoped strictly to authenticated users and trip participants — v3.1
- ✓ Real-time multi-user synchronization with `useTripRealtime` debounced WebSocket channel subscriptions — v3.1
- ✓ Automated GitHub Actions CI workflow (`.github/workflows/ci.yml`) running `npm ci`, `npm run lint`, `npm test`, `npm run build` — v3.1
- ✓ Offline test suite with JSDOM component UI smoke tests and pure domain logic unit tests running in <3s — v3.1
- ✓ Smart Trip OS relational core: presence dates (`arrival_date`, `departure_date`), dietary tags on `rsvps`, pricing models (`cost_type`), assignments (`assigned_users`), category `metadata`, and `grocery_items` table — v4.0
- ✓ Dynamic category specialization: dedicated form & card fields for Accommodation, Flights/Transport, Activities, and Food — v4.0
- ✓ Group meal intendance system: 3 daily meal slots, meal mode tags (`cook`, `restaurant`, `picnic`), crew assignments, and smart grocery drawer with live checkout to expense — v4.0
- ✓ Daily logistics coverage engine (`analyzeDailyLogisticsCoverage`) with bed/seat/meal gauges and kitchen mismatch warnings on Gantt timeline — v4.0
- ✓ Personal Projected Cost Simulator with active traveler forecast hero card and individualized commitment breakdowns — v4.0

### Out of Scope

- [ ] Direct webapp booking or reservation integration — out of scope
- [ ] Third-party messaging platform bots (Telegram, Discord, Slack) — removed in v3.0 in favor of 100% standalone web architecture

## Context

- Shipped **v1.1 Bot Capabilities & Improvements** which hardened database error resilience, unified template formatting styles and emoji mappings, added option url/description fields, built real-time `/polls` tallies, traveler notes commands/web edits, and launched an automated asyncio nudging background loop.
- Shipped **v1.2 Web Parity & Complete Trip Management** which brought the webapp to full capability parity with the Telegram bot: including modal trip creation forms, user session RSVP updates, suggestion pitch forms, dynamic option lists with voting selection toggles, multi-currency custom splitting expense modals, responsive desktop-to-mobile ledgers, and optimized currency-converting greedy debt solvers.
- Shipped **v1.3 Traveler Profiles & Access Control** which implemented global user session caching across views, Slack/Netflix-style traveler selection grids, debounced async username pre-checks, user-scoped filtered trips dashboard queries, auto-RSVP on web trip creation, and Telegram deep linking auto-login with instant URL parameters sanitization and roster reconciliation overlay modals.
- Shipped **v1.4 Standalone Webapp & Hybrid Onboarding** which detached the application from requiring Telegram: including passwordless email login magic links, `/join/:tripId` invite URLs with guest onboarding, hybrid user profile merging (Telegram + web), and a real-time Postgres trigger-backed Activity Feed drawer on the web app.
- Shipped **v1.5 Trip Settings, User Profiles & Pitching Audit** which added editable trip settings with date conflict reconciliation warnings & dynamic FX matrix recalculation, audited database RLS policies to fix option pitching/voting, and built a dedicated `/profile` page with avatar customization and Telegram account link/unlink management.
- Shipped **v2.0 Locked Option Expense Sync & Advanced Cost Partitioning** which integrated locked-in itinerary options into the expense ledger ("💸 Log as Expense"), built flexible cost partitioning supporting equal, custom dollar amount, and percentage participant splits, and created a visual Budget & Cost Analytics report.
- Shipped **v3.0 Standalone Web-First Architecture & Modular UI Refactor** which permanently removed all Python code and Telegram bot integrations, migrated to clean normalized PostgreSQL schemas with first-class columns (`is_archived`, `role`, `locked_option_id`), and decomposed the monolithic `TripDetails.jsx` view into maintainable modular sub-components.
- Shipped **v3.1 Native Supabase Auth, Real-Time WebSockets & GitHub Actions CI Pipeline** which implemented native `supabase.auth` integration, enforced PostgreSQL RLS referencing `auth.uid()`, built the `useTripRealtime` multi-user live synchronization hook with resource debouncing, added JSDOM UI smoke tests, and established automated GitHub Actions CI.
- Shipped **v4.0 Smart Trip OS: Relational Core, Dynamic Logistics & Personal Cost Simulation** which linked participant presence dates and dietary preferences with category-specialized option pricing, full group meal intendance & supermarket aisle groceries, Gantt daily logistics coverage gauges (`🛏️`, `🚗`, `🍴`), and an individualized personal trip cost forecasting simulator.

## Constraints

- **Tech Stack (Web)**: React 19 + Vite 8 + Vanilla CSS (Glassmorphic)
- **Database**: PostgreSQL (Supabase) with Row Level Security (RLS) & Triggers
- **Authentication**: Native Supabase Auth (`supabase.auth`) with Email OTP & standard UUID `auth.uid()`
- **CI/CD**: GitHub Actions running on Node.js 22 with offline test constraints (<10s runtime)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Vite + Vanilla CSS for Web | User choice for modern, fast single-page app | ✓ Good (Phase 1 setup successful) |
| Encapsulated postgrest query services & custom hooks | Clean architectural abstraction separating logic from UI views | ✓ Good (Phase 2 setup successful) |
| PostgreSQL Triggers for `activity_log` | Automatically logs RSVPs, pitches, and expenses at DB layer | ✓ Good (Phase 20 setup successful) |
| Flexible `split_users` JSONB schema | Stores both string ID arrays and custom `{ user_id, amount, percent }` objects | ✓ Good (Phase 34 setup successful) |
| Unified budget analytics calculation engine | Computes estimated budget, actual spend, variance, and individual shares | ✓ Good (Phase 35 setup successful) |
| Pure Web-First Architecture Purge | Eliminate hybrid complexity and dependencies on Telegram bots and Python runtime | ✓ Good (v3.0 complete) |
| First-Class Database Columns (`is_archived`, `role`, `locked_option_id`) | Eliminate string tag parsing and JSON metadata stuffing | ✓ Good (v3.0 complete) |
| Modular Sub-Component Decomposition | Decomposed 1400+ line `TripDetails.jsx` into focused sub-components and modals | ✓ Good (v3.0 complete) |
| Native Supabase Auth (`auth.uid()`) | Production-grade identity and access control without custom token endpoints | ✓ Good (v3.1 complete) |
| Channel-Level Resource Debouncing (`useTripRealtime`) | Mitigates Supabase broadcast storming while delivering instantaneous multi-user updates | ✓ Good (v3.1 complete) |
| GitHub Actions Automated CI Pipeline | Enforces quality gate (lint, test, build) on every commit and PR without secrets exposure | ✓ Good (v3.1 complete) |
| Offline JSDOM Component Smoke Tests | Guarantees zero runtime state/reference crashes in core sub-components without network calls | ✓ Good (v3.1 complete) |
| First-Class Presence Dates & Dietary Tags on RSVPs | Enables accurate per-day traveler counts and automated dietary hazard checks | ✓ Good (v4.0 complete) |
| Category Metadata & Pricing Models (`split_total`, `per_person`, `per_night`) | Prevents erroneous expense allocations when options are converted to expenses | ✓ Good (v4.0 complete) |
| Daily Logistics Coverage Gauges (`🛏️`, `🚗`, `🍴`) | Replaces binary gap warnings with day-by-day traveler coverage metrics | ✓ Good (v4.0 complete) |
| Personal Projected Cost Simulation | Gives travelers transparent visibility into their personal financial share before and after logging | ✓ Good (v4.0 complete) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-10-16 after v4.0 milestone*


