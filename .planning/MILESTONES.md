# Milestones

## v2.0 Locked Option Expense Sync & Advanced Cost Partitioning (Shipped: 2026-07-24)

**Phases completed:** 3 phases, 3 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.9 Webapp Trip Archiving & Co-Organizer Administration (Shipped: 2026-07-24)

**Phases completed:** 2 phases, 2 plans, 0 tasks

**Key accomplishments:**

- Schema-resilient Trip Archiving (soft-delete), unarchiving, and dashboard filter pills (`Active`, `📦 Archived`, `All`) (`ADMIN-01`).
- Permanent trip deletion with clean cascading database cleanup across all dependent tables (`ADMIN-02`).
- Co-Organizer role promotion/demotion, `👑 Organizer` & `⭐ Co-Organizer` roster role badges, and admin permission gates for trip settings, archiving, and deletion (`ADMIN-03`).

---

## v1.8 Visual Trip Timeline & Interactive Gantt Planning (Shipped: 2026-07-23)

**Phases completed:** 4 phases, 4 plans, 0 tasks

**Key accomplishments:**

- Explicit Option Date & Time Scheduling across database, React pitch modals, Telegram bot, and card badges (`TIME-01`).
- Interactive Trip Gantt Chart & Visual Timeline displaying pitched and locked options as category-colored time bars (`GANTT-01`).
- Schedule Gap & Conflict Detection Engine automatically flagging unbooked gaps ("holes in plan") and schedule overlaps with direct slot pitching (`GANTT-02`, `PLAN-01`).
- iCal Calendar Export & Printable Itinerary sync supporting `.ics` downloads and day-by-day print reports (`CAL-01`).

---

## v1.7 Webapp Option Pitching & Voting Integration (Shipped: 2026-07-22)

**Phases completed:** 2 phases, 2 plans, 0 tasks

**Key accomplishments:**

- Webapp option pitching audit & database query parity (`PITCH-01`, `PITCH-02`, `SYNC-01`).
- Webapp option voting integration, voter badges, Poll Recap modal, & lock choice controls (`VOTE-01`, `VOTE-02`, `VOTE-03`, `SYNC-02`).

---

## v1.6 Full Platform Feature Audit & System Hardening (Shipped: 2026-07-21)

**Phases completed:** 1 phases, 1 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.5 Trip Settings, User Profiles & Pitching Audit (Shipped: 2026-07-21)

**Phases completed:** 3 phases, 3 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.4 Standalone Webapp & Hybrid Onboarding (Shipped: 2026-07-20)

**Phases completed:** 4 phases, 4 plans, 0 tasks

**Key accomplishments:**

- Custom Passwordless Email Login mechanism with magic link token verification, session caching, and Telegram account linking.
- Shareable Web Invite Links (`/join/:tripId`) with standalone guest onboarding and automatic trip RSVP registration.
- Hybrid Bot-Web Coexistence ensuring Telegram users, web-only negative IDs, and email profiles work seamlessly without collisions.
- In-App Activity Log & Notification Feed with Postgres triggers, relative timestamps, and slide-out feed drawer.

---

## v1.3 v1.3 (Shipped: 2026-07-14)

**Phases completed:** 3 phases, 3 plans, 16 tasks

**Key accomplishments:**

- Global UserSessionContext provider with localStorage caching, Netflix/Slack-style traveler selector splash page, and real-time Telegram username validation
- Privacy-filtered dashboard queries via nested relational Supabase selections, automatic Committed RSVP registration for trip creators, and automated privacy isolation verification testing
- Traveler user database lookups by Telegram ID and username, deep link auto-login with instant URL parameter sanitization, and blocking roster membership reconciliation overlay modals on trip details views

---

## 1.2 Web Parity & Complete Trip Management (Shipped: 2026-07-14)

**Phases completed:** 4 phases, 5 plans, 4 tasks

**Key accomplishments:**

- Collaborative Web Option Pitching and Multi-Option Voting Implementation
- 2026-07-13
- 2026-07-13

---

## v1.1 Bot Capabilities & Improvements (Shipped: 2026-07-13)

**Phases completed:** 4 phases, 4 plans, 6 tasks

**Key accomplishments:**

- Centralized database execution safety gates and stale wizard re-entry cleanup logic deployed to ensure bot stability.
- Standard HTML templates, custom lists, and unified emoji indicators integrated to ensure beautiful and consistent messaging.
- Wizard pitching description prompts, dynamic option URLs, and real-time voting tallies implemented and verified.
- Traveler RSVP notes integrated across Telegram and React, PollAnswer voter tracking active, and asyncio background reminder nudges fully deployed.

---

## v1.0 v1.0 MVP (Shipped: 2026-07-12)

**Phases completed:** 5 phases, 9 plans, 20 tasks

**Key accomplishments:**

- React + Vite frontend project initialized in the `web/` subdirectory, react-router-dom routing configured, and centralized Vanilla CSS styling tokens integrated.
- Supabase Client integrated into the React app, Vite environment loader configured to read parent directory credentials, and database connection verify script created.
- Core database fetching services and React custom hooks implemented for retrieving trips, details, and participant rosters.
- Supabase user registration mutations configured, useAddParticipant hook implemented, and service integration tests created.
- Date/currency formatters, skeleton CSS utilities, and the responsive Trips List page view implemented.
- Trip details metadata grid and dynamic RSVP rosters implemented on the TripDetails page view.
- App-level session states lifted, modal styling loaded, and blocking profile selection dialogs implemented.
- Slide-in participant registration form and auto-login mutator integrated inside selector modal.
- Strict port configurations resolved, cleanup automation script created, and E2E integration verification completed.

---
