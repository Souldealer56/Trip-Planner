# Milestones

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
