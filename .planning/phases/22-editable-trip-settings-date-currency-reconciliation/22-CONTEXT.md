# Phase 22: Editable Trip Settings & Date/Currency Reconciliation - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable editing trip metadata (title, destination, description, start/end dates, base currency) via web modal and bot commands. Reconcile pitched options when dates change (visual warning badges + post-save reconciliation modal) and recalculate multi-currency expense settlements dynamically when base currency changes without corrupting logged expense amounts.

</domain>

<decisions>
## Implementation Decisions

### Trip Settings Edit Access & UI Placement
- **D-01:** Any member registered on the trip can edit trip settings (collaborative access model).
- **D-02:** Edit trigger is placed as a primary action button ("✏️ Edit Trip") inside the top Trip Details header card in `TripDetails.jsx`.

### Date Change & Option Reconciliation
- **D-03:** When trip dates are updated, any pitched option (flights, stays, activities) whose start/end dates fall outside the new trip window receives an amber warning badge (`⚠️ Outside Trip Dates`) on its option card.
- **D-04:** Saving updated trip dates triggers a post-save reconciliation modal summarizing all conflicting options for participant awareness and review.

### Base Currency Change & Expense FX Handling
- **D-05:** Past logged expenses retain their original logged amounts and currencies in `expenses` table (preventing historical data corruption).
- **D-06:** Changing base currency recalculates total trip spend and the net debt settlement matrix dynamically in the new base currency using live FX exchange rates.

### Agent's Discretion
- Modal UI styling (matching existing glassmorphic modal design system).
- Form validation error toasts and loading states.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/REQUIREMENTS.md` — Requirements `SETT-01`, `SETT-02`, `SETT-03`
- `web/src/services/trips.js` — Trip fetch and CRUD service
- `web/src/services/expenses.js` — Expense fetching, ledger calculations, and currency conversion logic
- `web/src/views/TripDetails.jsx` — Main trip view, header card, options list, and expense ledger tabs
- `main.py` — Telegram bot trip update commands and FX rate conversion helpers (`_convert()`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/services/trips.js`: Can add `updateTrip(id, { title, destination, description, start_date, end_date, base_currency })`.
- `web/src/services/expenses.js`: `calculateSettlements` and FX conversion utilities already handle multi-currency conversions using USD baseline.
- `web/src/views/TripDetails.jsx`: Existing modal overlay styling (`modal-overlay`, `glass-card animate-fade-in`).

### Established Patterns
- Open RLS policies on `public.trips` for `SELECT`, `UPDATE`.
- Supabase `.from('trips').update(...).eq('id', id)` pattern.

### Integration Points
- `TripDetails.jsx` header card: Add "✏️ Edit Trip" button.
- `OptionPitchForm` & Option Cards: Check `start_date` / `end_date` against `trip.start_date` / `trip.end_date`.
- Activity Log: Insert `action_type: 'update_trip'` to log metadata edits in activity feed.

</code_context>

<specifics>
## Specific Ideas

- Post-save reconciliation modal pops up automatically when date edits produce out-of-bounds options, displaying a list of options that need review.
- Amber badge on option cards: `⚠️ Outside Trip Dates (Aug 15–20 vs Trip Aug 1–10)`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed strictly within phase scope.

</deferred>

---

*Phase: 22-Editable Trip Settings & Date/Currency Reconciliation*
*Context gathered: 2026-07-20*
