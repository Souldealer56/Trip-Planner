# Phase 25: Webapp Option Pitching Audit & Database Parity — Context

## Phase Summary

**Phase:** Phase 25 — Webapp Option Pitching Audit & Database Parity
**Goal:** Audit and fix the webapp option pitching pipeline so options pitched via the web modal persist correctly to Supabase and immediately render in the web UI, ensuring RLS policies and table structures match bot expectations.
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

### 1. Option Pitching Form & Fields
- **Required Fields:** Title/Name (`option_text`), Category (`category`: accommodation, flights, activities, food, transport, other).
- **Optional Fields:** Estimated cost (`estimated_cost`), Currency (`currency`), URL link (`link`), Description (`description`), Start/End dates (`start_date`, `end_date`).
- **Currency Defaulting:** If cost is entered, currency defaults to the trip's `base_currency` (e.g. USD, EUR).
- **URL Sanitization:** If a link is entered without `http://` or `https://`, auto-prefix with `https://`.
- **User Attribution:** Set `added_by` to the current `activeUser.id` (or user's ID).

### 2. State Refresh & Database Parity Strategy
- **Immediate State Refresh:** Upon successful submission, invoke `fetchOptions(tripId, category)` to refresh state and immediately re-render the category's option cards in the web UI.
- **Active Poll Initialization:** Ensure pitching an option automatically checks/initializes an `active_polls` entry for that category if one does not already exist.
- **RLS & Table Verification:** Ensure `poll_options` and `active_polls` RLS policies permit inserts and updates for web-registered profiles (`telegram_id` negative or positive, or UUID user ID).

---

## Code Context & Integration Points

- `web/src/services/options.js`: Contains `pitchOption`, `fetchOptions`, `fetchActivePoll`, `fetchAllTripOptions`.
- `web/src/views/TripDetails.jsx`: Contains the pitch option modal state, form submission handler, and category option list rendering.
- Database tables: `poll_options`, `active_polls`, `activity_log`.

---

## Deferred Ideas

- Real-time WebSockets / Supabase Realtime subscriptions for live option updates across active browser sessions (deferred to future phase/milestone).
