---
phase: 22-editable-trip-settings-date-currency-reconciliation
plan: 1
wave: 1
gap_closure: false
depends_on: []
files_modified:
  - web/src/services/trips.js
  - web/src/services/options.js
  - web/src/services/expenses.js
  - web/src/views/TripDetails.jsx
  - web/verify-trip-settings.cjs
  - tests/test_trip_settings.py
---

# Phase 22 Plan 1: Editable Trip Settings & Date/Currency Reconciliation

## Phase Goal
Enable editing trip metadata (title, destination, description/vibe, start/end dates, base currency) via web modal, provide date-reconciliation warnings and post-save conflict modals for out-of-bounds options, and ensure multi-currency expense ledger calculations convert dynamically when base currency changes without corrupting logged expenses.

## Tasks

- [ ] Task 1: Add `updateTrip` in `web/src/services/trips.js` & option conflict helpers in `web/src/services/options.js`.
- [ ] Task 2: Build Edit Trip Modal, Date Conflict Warnings (`⚠️ Outside Trip Dates`), and Reconciliation Summary Modal in `web/src/views/TripDetails.jsx`.
- [ ] Task 3: Build automated Node verification script `web/verify-trip-settings.cjs` and Pytest suite `tests/test_trip_settings.py`.

## Verification Plan

### Automated Tests
- `node web/verify-trip-settings.cjs`
- `pytest tests/test_trip_settings.py`
- `npm run build` (in `web/`)
