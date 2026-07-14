# Phase 13: Webapp Debts Settlement Optimization - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements optimized debt settlement calculation and overview displays in the React web application, converting expense entries to the trip's base currency and utilizing a transaction minimization algorithm.

- **In scope:**
  - Live exchange rate fetching using a free public API (`https://open.er-api.com/v6/latest/USD`) cached in React context or component state.
  - Multi-currency conversions for net balance calculations relative to the trip's base currency.
  - Individual net balance calculations utilizing exact split rules:
    - If `split_users` is empty/default, costs are split equally among all committed roster members.
    - Otherwise, costs are divided equally *only* among the user UUIDs present in `split_users`.
  - Greedy transaction minimization algorithm (who owes whom the minimum set of transactions).
  - Clean, interactive Settlement Card UI detailing total spend, individual net balances, and minimum transaction paths.
- **Out of scope:**
  - External payment settlement automation or actual money transfers.
  - Modifying the database schema.
</domain>

<decisions>
## Implementation Decisions

### Exchange Rates API
- **D-01:** The webapp will fetch live exchange rates from `https://open.er-api.com/v6/latest/USD` on page load and cache them in memory.
- **D-02:** Converted values will use USD as the baseline intermediary to convert between non-USD currencies (e.g. converting EUR to GBP).

### Debt Settlement Algorithm
- **D-03:** The settlement solver will calculate exact individual balances based on who actually participated in each split (using the `split_users` array).
- **D-04:** The transaction minimization algorithm will use a greedy approach (matching maximum debtors with maximum creditors) to produce the minimum set of settlement transfers.

### the agent's Discretion
- **Settlement UI View:** Render the settlement calculations in a clean "Settlement Ledger" tab/card inside the `TripDetails` view, presenting clear visual arrows (e.g., "Alice ➡️ Bob") and transaction totals.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Context
- [REQUIREMENTS.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/REQUIREMENTS.md) §LEDG-03 — Defines settlement optimization and currency conversion rules.
- [ROADMAP.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/ROADMAP.md) §Phase-13 — Defines milestone goals and success criteria.

### Codebase Integration
- [main.py](file:///c:/Users/alex_/Documents/Trip%20Planner/main.py) L2092-2184 — Telegram bot `/settle` implementation of the greedy transaction solver.
- [TripDetails.jsx](file:///c:/Users/alex_/Documents/Trip%20Planner/web/src/views/TripDetails.jsx) — Primary view to integrate the Settlement section.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_convert` (Python logic): Standard USD-intermediary conversion formula to be translated to JavaScript.
- `committedRoster` filtering: Reused to establish the active members participating in splits.

### Integration Points
- `web/src/utils/currency.js`: New utility file to house exchange rate fetchers and conversion utilities.
</code_context>

<specifics>
## Specific Ideas
- No specific requirements — open to standard approaches.
</specifics>

<deferred>
- None.
</deferred>

---

*Phase: 13-webapp-debts-settlement-optimization*
*Context gathered: 2026-07-13*
