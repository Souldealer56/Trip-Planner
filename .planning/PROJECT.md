# Trip Planner

## What This Is

A collaborative trip planning platform consisting of a Telegram bot (TripSync Bot) that handles group chat interactions, RSVP tracking, option pitching, voting, and expenses logging, alongside a new React-based web application for viewing trips and managing participants.

## Core Value

Provide a seamless, multi-interface collaborative trip planning experience that bridges Telegram group chats with web views.

## Current Milestone: v1.1 Bot Capabilities & Improvements

**Goal:** Review and enhance the Telegram bot's capabilities, focusing on UX, voting, RSVPs, and error resilience.

**Target features:**
- General UX/UI enhancements (better messages, emojis, clearer formatting)
- Option pitching and voting improvements (richer details, multi-option voting, deadlines)
- RSVP and Roster tracking enhancements (reminders, auto-nudging, custom status)
- Error handling and connection resilience (retry policies, better crash logs)

## Requirements

### Validated

- ✓ Trip creation via Telegram bot (wizard with title, destination, dates, base currency) — existing
- ✓ Participant RSVPs (Committed, Tentative, Declined) via Telegram inline buttons — existing
- ✓ Pitching and listing options under categories (Accommodation, Flights, Activities, Food, Transport, Other) — existing
- ✓ Locking in itinerary items and pitching voting — existing
- ✓ Multi-currency expense ledger and logging — existing
- ✓ Automatic poll nudging and majority threshold alerts — existing
- ✓ Set up clean Git tracking for GSD planning documents — v1.0
- ✓ Initialize a React + Vite + Vanilla CSS webapp in the workspace — v1.0 (Phase 1)
- ✓ Webapp: View trips list and trip details (destination, dates, participants/members) — v1.0 (Phase 3)
- ✓ Webapp: Choose active participant and add new participant with auto-login — v1.0 (Phase 4)

### Active

- [ ] Telegram Bot: General UX/UI enhancements (messages, formatting, emojis)
- [ ] Telegram Bot: Option pitching and voting improvements (richer details, multi-option voting, deadlines)
- [ ] Telegram Bot: RSVP and Roster tracking enhancements (reminders, auto-nudging, custom status)
- [ ] Telegram Bot: Error handling and connection resilience (retry policies, crash logs)

### Deferred to Future Milestones

- [ ] Edit trip details (change destination, update dates) directly from the webapp
- [ ] Suggest/pitch new trip options (flights, hotels) through the webapp
- [ ] Cast votes on pitched options via webapp buttons
- [ ] Log expenses and see the trip ledger through the webapp

### Out of Scope

- [ ] Webapp editing of trip metadata in v1 — deferred to keep scope focused
- [ ] Direct webapp booking or reservation integration — out of scope
- [ ] Full password-based or OAuth authentication in v1 — deferred in favor of simple public/shared link access with participant selection

## Context

- Shipped **v1.0 Web App Foundations** featuring a React + Vite + Vanilla CSS client application connecting dynamically to a Supabase PostgreSQL backend.
- The web app is structured into clean separation layers: database services (`web/src/services/`) and React custom fetching/mutation hooks (`web/src/hooks/`).
- Views are completely styled with a premium glassmorphic Slate Dark Theme.

## Constraints

- **Tech Stack (Bot)**: Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint
- **Tech Stack (Web)**: React + Vite + Vanilla CSS — user preference
- **Authentication**: No authentication in v1 — user request

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Vite + Vanilla CSS for Web | User choice for modern, fast single-page app | ✓ Good (Phase 1 setup successful) |
| Participant Selection/Addition instead of Auth | Simplicity for v1, allows quick onboarding via shared link | ✓ Good (Phase 4 setup successful) |
| Encapsulated postgrest query services & custom hooks | Clean architectural abstraction separating logic from UI views | ✓ Good (Phase 2 setup successful) |
| Negative `telegram_id` values for web users | Completely avoids collision risks with real Telegram User IDs | ✓ Good (Phase 2 setup successful) |
| Combined auto-load + manual refresh buttons | Simple way to display Telegram bot updates without real-time sockets | ✓ Good (Phase 3 setup successful) |
| Blocking profile modal selector | Restricts dynamic actions to a selected active profile session | ✓ Good (Phase 4 setup successful) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-12 after v1.1 milestone initialization*
