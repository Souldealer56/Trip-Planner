# Phase 12: Webapp Expense Logging & Ledger - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements user expense logging and ledger viewing in the React web application, bringing group-expense sharing parity from the Telegram bot to the web UI.

- **In scope:**
  - Dynamic "Add Expense" form modal.
  - Multi-currency support for input entries.
  - Custom expense splitting selectors (Equally vs. Custom Checkboxes).
  - Scrollable, formatted expense ledger list/table.
  - Supabase client integration for the `expenses` table.
- **Out of scope:**
  - Automated debt settlement greed-solver optimizations (deferred to Phase 13).
  - Direct Stripe/payment gateway integrations.
  - Editing or deleting existing logged expenses.
</domain>

<decisions>
## Implementation Decisions

### Database Schema & Currency storage
- **D-01:** We will extend the Supabase `expenses` schema by adding `currency` (TEXT, default 'USD') and `split_users` (JSONB, default '[]') columns. Downstream agents must assume these columns exist in database checks and tests.
- **D-02:** The `split_users` JSONB column will store a list of user UUIDs participating in the split (or stay empty/default to split equally).

### Expense Splitting UI
- **D-03:** The "Add Expense" form modal will present a "Split Equally" toggle.
- **D-04:** If "Split Equally" is toggled OFF, the form dynamically expands to display a checklist of all committed roster participants to allow selecting custom split participants.

### the agent's Discretion
- **Ledger Layout:** We will implement a responsive Desktop Grid / Mobile Stack. On desktop, a clean grid table displaying columns: Description, Payer, Date, Amount (formatted with currency), and Splits (displaying first names of split participants). On smaller screens (mobile), it collapses cleanly into glassmorphic cards.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Context
- [REQUIREMENTS.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/REQUIREMENTS.md) §LEDG-01, LEDG-02 — Defines core requirements for expense logging and ledger listing.
- [ROADMAP.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/ROADMAP.md) §Phase-12 — Defines milestone goals and boundaries for the ledger phase.

### Codebase Integration
- [main.py](file:///c:/Users/alex_/Documents/Trip%20Planner/main.py) L2038-2085, L2833-2865 — Existing ledger rendering and paid wizard implementations.
- [TripDetails.jsx](file:///c:/Users/alex_/Documents/Trip%20Planner/web/src/views/TripDetails.jsx) — Primary view to integrate the ledger table and add expense button/modal actions.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `modal-overlay` / `modal-content` (CSS classes): Reused for the "Add Expense" modal layout structure.
- `useRsvpRoster` (React Hook): Reused to fetch the committed roster participants list to populate split participant checkboxes.

### Established Patterns
- `_safe_db_call` (Python helper): Standard db wrapping pattern inside `main.py` which is replicated on the client side using try-catch closures.
- HSL Slate Dark styling: Cards and modal styles conform to variables defined in `variables.css`.

### Integration Points
- `web/src/services/expenses.js`: New service file to encapsulate database queries for the `expenses` table.
</code_context>

<specifics>
## Specific Ideas
- No specific requirements — open to standard approaches.
</specifics>

<deferred>
## Deferred Ideas
- Settlement calculations and debt resolution graphs are deferred to Phase 13.
</deferred>

---

*Phase: 12-webapp-expense-logging-ledger*
*Context gathered: 2026-07-13*
