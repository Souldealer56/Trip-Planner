---
phase: 25
plan: 1
title: Webapp Option Pitching Audit & Database Parity Implementation
wave: 1
depends_on: []
files_modified:
  - web/src/services/options.js
  - web/src/views/TripDetails.jsx
  - web/verify-options-pitch.cjs
autonomous: true
requirements:
  - PITCH-01
  - PITCH-02
  - SYNC-01
---

# Plan 25-1: Webapp Option Pitching Audit & Database Parity Implementation

## Goal

Audit and fix the webapp option pitching workflow so options pitched via the web modal reliably persist to Supabase, automatically initialize category poll records, and immediately render in the web UI without requiring browser reloads.

---

## Task 1: Audit and Enhance `web/src/services/options.js`

<read_first>
- `web/src/services/options.js`
- `web/src/services/supabase.js`
- `.planning/phases/25-webapp-option-pitching-audit-database-parity/25-CONTEXT.md`
</read_first>

<action>
1. Update `pitchOption(tripId, category, name, estimatedCost, currency, link, description, addedByUserId, startDate, endDate)` in `web/src/services/options.js`:
   - Sanitize `link`: if present and does not start with `http://` or `https://`, prepend `https://`.
   - Ensure `estimated_cost` is parsed as float if provided.
   - Insert `start_date` and `end_date` into `poll_options` if provided.
   - Ensure `fetchActivePoll(tripId, category)` is automatically called after inserting into `poll_options` so an active poll record exists for voting.
2. Verify `fetchOptions(tripId, category)` and `fetchAllTripOptions(tripId)` cleanly fetch all fields (`*`) ordered by `created_at` ascending.
</action>

<acceptance_criteria>
- `web/src/services/options.js` contains sanitized `link` handling (`https://` prefixing).
- `pitchOption` inserts `start_date` and `end_date` into `poll_options`.
- `pitchOption` calls `fetchActivePoll` to guarantee an `active_polls` row exists.
- `fetchOptions` returns array of options for a given trip and category.
</acceptance_criteria>

---

## Task 2: Update `web/src/views/TripDetails.jsx` Pitching Modal & Auto-Refresh State

<read_first>
- `web/src/views/TripDetails.jsx`
- `web/src/services/options.js`
- `.planning/phases/25-webapp-option-pitching-audit-database-parity/25-CONTEXT.md`
</read_first>

<action>
1. In `web/src/views/TripDetails.jsx`:
   - Inspect the Pitch Option modal inputs: Title (required), Category (required select: Accommodation, Flights, Activities, Food, Transport, Other), Estimated Cost (optional), Currency (optional, defaulting to `trip.base_currency`), Link (optional), Description (optional), Start Date & End Date (optional).
   - In `handlePitchOptionSubmit` (or equivalent submit handler):
     - Extract inputs, call `pitchOption(id, category, title, cost, currency, link, description, activeUser.id, startDate, endDate)`.
     - Upon resolution, immediately re-fetch options by calling the options load function (or `fetchAllTripOptions(id)`) and update state so option cards render immediately.
     - Clear form input fields and close modal.
     - Display clear inline error message if `pitchOption` throws.
2. Verify category option cards display option title, category badge, formatted cost/currency, sanitized link (`target="_blank"`), description, and dates.
</action>

<acceptance_criteria>
- Pitching an option in `TripDetails.jsx` updates local React state immediately with the new option card without requiring a browser refresh.
- Pitch option modal currency dropdown defaults to `trip.base_currency`.
- Option card renders clickable link with `target="_blank" rel="noopener noreferrer"`.
</acceptance_criteria>

---

## Task 3: Automated Option Pitching & Database Parity Verification Script

<read_first>
- `web/verify-options-service.cjs`
- `web/src/services/options.js`
</read_first>

<action>
1. Create `web/verify-options-pitch.cjs`:
   - Read `.env` credentials using `dotenv`.
   - Connect to Supabase via `@supabase/supabase-js`.
   - Query a test or active trip ID.
   - Insert a test pitched option into `poll_options` with category `'activities'`, title `'Test Verification Hike'`, cost `25.00`, currency `'USD'`.
   - Verify `poll_options` row is returned.
   - Verify corresponding `active_polls` row exists or can be fetched/initialized for category `'activities'`.
   - Clean up test option record from `poll_options`.
   - Output `✓ Option pitching and database parity verified successfully.`
2. Run script via Node.js to verify clean execution.
</action>

<acceptance_criteria>
- `web/verify-options-pitch.cjs` executes cleanly via `node web/verify-options-pitch.cjs` with exit code 0.
- Output includes `✓ Option pitching and database parity verified successfully.`
</acceptance_criteria>

---

## Verification Plan

### Automated Tests
- Run `node web/verify-options-pitch.cjs`

### Manual Verification
- Open trip details in web UI, click "Pitch Option", submit a new option, and verify it renders immediately in the UI under the corresponding category section.

---

## Artifacts This Phase Produces

- `web/src/services/options.js` (updated `pitchOption`, `fetchOptions`)
- `web/src/views/TripDetails.jsx` (updated Pitch Option modal & state refresh)
- `web/verify-options-pitch.cjs` (new verification script)
