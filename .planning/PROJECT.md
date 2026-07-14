# Trip Planner

## What This Is

A collaborative trip planning platform consisting of a Telegram bot (TripSync Bot) that handles group chat interactions, RSVP tracking, option pitching, voting, and expenses logging, alongside a new React-based web application for viewing trips and managing participants.

## Core Value

Provide a seamless, multi-interface collaborative trip planning experience that bridges Telegram group chats with web views.

### Current Milestone: None (Milestone v1.2 Completed)

Milestone v1.2 successfully brought complete parity of all Telegram bot features to the React web application, including trip creation, RSVPs, suggestion pitching and voting, expense logging, and optimized debt settlements.

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

### Active

- (None. All v1.2 features shipped and validated.)

### Deferred to Future Milestones

- [ ] Automated settlement alerts pushed to Telegram from web hooks

### Out of Scope

- [ ] Webapp editing of trip metadata in v1 — deferred to keep scope focused
- [ ] Direct webapp booking or reservation integration — out of scope
- [ ] Full password-based or OAuth authentication in v1 — deferred in favor of simple public/shared link access with participant selection

## Context

- Shipped **v1.1 Bot Capabilities & Improvements** which hardened database error resilience, unified template formatting styles and emoji mappings, added option url/description fields, built real-time `/polls` tallies, traveler notes commands/web edits, and launched an automated asyncio nudging background loop.
- Shipped **v1.2 Web Parity & Complete Trip Management** which brought the webapp to full capability parity with the Telegram bot: including modal trip creation forms, user session RSVP updates, suggestion pitch forms, dynamic option lists with voting selection toggles, multi-currency custom splitting expense modals, responsive desktop-to-mobile ledgers, and optimized currency-converting greedy debt solvers.

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
| Centralized DB execution wrapper (`_safe_db_call`) | Ensures bot loop doesn't crash on DB timeout/failure | ✓ Good (Phase 6 setup successful) |
| Centralized emoji map (`_UX_EMOJIS`) | Uniform emoji styling across bot templates | ✓ Good (Phase 7 setup successful) |
| Telegram native poll tallies command (`/polls`) | Queries real-time tallies directly from TG API | ✓ Good (Phase 8 setup successful) |
| `asyncio` background nudge loop | Lightweight non-blocking reminders without extra pip dependencies | ✓ Good (Phase 9 setup successful) |
| Client-side JSONB updates for vote toggle | Dynamic client-side voting count caching mapped to active user IDs | ✓ Good (Phase 11 setup successful) |
| Equal vs. Custom Roster Split toggles | Standardized checklist checks for specific participant divisions | ✓ Good (Phase 12 setup successful) |
| USD-intermediary FX rates converter | Converts diverse cost inputs to trip base currency using live rates | ✓ Good (Phase 13 setup successful) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-07-13 after v1.2 milestone completion*
