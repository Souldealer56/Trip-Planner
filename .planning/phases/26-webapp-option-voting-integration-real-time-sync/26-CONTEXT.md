# Phase 26: Webapp Option Voting Integration & Real-time Sync — Context

## Phase Summary

**Phase:** Phase 26 — Webapp Option Voting Integration & Real-time Sync
**Goal:** Integrate option voting into the web app UI, enabling users to cast/retract votes, view real-time vote tallies per category, view voter badges & recaps, lock winning choices, and sync vote data across Telegram bot and web application.
**Date:** 2026-07-22

---

## Canonical References

- [PROJECT.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/PROJECT.md)
- [REQUIREMENTS.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/REQUIREMENTS.md)
- [ROADMAP.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/ROADMAP.md)
- [web/src/services/options.js](file:///c:/Users/alex_/Documents/Trip%20Planner/web/src/services/options.js)
- [web/src/views/TripDetails.jsx](file:///c:/Users/alex_/Documents/Trip%20Planner/web/src/views/TripDetails.jsx)

---

## Locked Implementation Decisions

### 1. Voter Badges & Poll Recap Modal
- **Stacked Voter Badges:** Display a stack of avatar/first-name badges on each option card indicating who voted for that option.
- **Poll Recap Modal:** Clicking the vote count or voter stack opens a "Poll Breakdown & Voter Recap" modal showing full category options, total votes, and named voter breakdowns.

### 2. Locking & Winning Choice Finalization
- **Locked Choice Indicator:** Show a "🏆 Locked Choice" badge on finalized itinerary items.
- **Lock Control:** Allow trip creators/organizers to lock or unlock an option choice for a category directly from the web app.

### 3. Multi-Option Voting Policy
- **Multi-Option Voting:** Users can vote for multiple options within the same category (e.g. 2 hotel choices).

### 4. Vote Syncing & Refreshing Strategy
- **Instant Local Sync:** Toggling a vote updates local React state immediately and calls `toggleVote` in `options.js`.
- **Category & Manual Sync:** Auto-refresh polls when switching category tabs or clicking a "Refresh Polls" button to sync Telegram bot or multi-session votes.

---

## Code Context & Integration Points

- `web/src/services/options.js`: `toggleVote`, `fetchActivePoll`, `fetchOptions`.
- `web/src/views/TripDetails.jsx`: Render option cards, vote toggle button, voter badges stack, Poll Recap modal, and Lock Option controls.
- Database tables: `active_polls`, `poll_options`, `activity_log`, `users`.

---

## Deferred Ideas

- WebSockets / Supabase Realtime channel subscriptions for live multi-user cursor & voting push notifications.
