# Trip Planner

## What This Is

A collaborative trip planning platform consisting of a Telegram bot (TripSync Bot) that handles group chat interactions, RSVP tracking, option pitching, voting, and expenses logging, alongside a new React-based web application for viewing trips and managing participants.

## Core Value

Provide a seamless, multi-interface collaborative trip planning experience that bridges Telegram group chats with web views.

## Requirements

### Validated

- ✓ Trip creation via Telegram bot (wizard with title, destination, dates, base currency) — existing
- ✓ Participant RSVPs (Committed, Tentative, Declined) via Telegram inline buttons — existing
- ✓ Pitching and listing options under categories (Accommodation, Flights, Activities, Food, Transport, Other) — existing
- ✓ Locking in itinerary items and pitching voting — existing
- ✓ Multi-currency expense ledger and logging — existing
- ✓ Automatic poll nudging and majority threshold alerts — existing

### Active

- [ ] Set up clean Git tracking for GSD planning documents
- [ ] Initialize a React + Vite + Vanilla CSS webapp in the workspace
- [ ] Webapp: View trips list and trip details (destination, dates, participants/members)
- [ ] Webapp: Option to choose which participant to join the app as, or add a new participant to the trip (no user authentication in v1)

### Out of Scope

- [ ] Webapp editing of trip metadata (dates, destinations, base currency) in v1 — deferred to keep scope focused
- [ ] Direct webapp booking or reservation integration — out of scope
- [ ] Full password-based or OAuth authentication in v1 — deferred in favor of simple public/shared link access with participant selection

## Context

- The codebase is an asynchronous Python Telegram Bot (`main.py`) powered by `python-telegram-bot`, PostgreSQL (via Supabase client), and `openexchangerates` for currency conversion.
- The DB tables exist in Supabase (`trips`, `rsvps`, `poll_options`, `users`, etc.).
- A web application needs to run alongside the bot, accessing the same Supabase database.

## Constraints

- **Tech Stack (Bot)**: Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint
- **Tech Stack (Web)**: React + Vite + Vanilla CSS — user preference
- **Authentication**: No authentication in v1 — user request

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Vite + Vanilla CSS for Web | User choice for modern, fast single-page app | — Pending |
| Participant Selection/Addition instead of Auth | Simplicity for v1, allows quick onboarding via shared link | — Pending |

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
*Last updated: 2026-07-10 after initialization*
