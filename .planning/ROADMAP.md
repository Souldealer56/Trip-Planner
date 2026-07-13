# Roadmap: Trip Planner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-07-12)
- ✅ **v1.1 Bot Capabilities & Improvements** — Phases 6-9 (shipped 2026-07-13)
- 🚧 **v1.2 Web Parity & Complete Trip Management** — Phases 10-13 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-07-12</summary>

- [x] Phase 1: Project Setup & Database Wiring (2/2 plans) — completed 2026-07-12
- [x] Phase 2: Database & Data Access Layer (2/2 plans) — completed 2026-07-12
- [x] Phase 3: Trips List & Details UI Views (2/2 plans) — completed 2026-07-12
- [x] Phase 4: Member Selection & Management UI (2/2 plans) — completed 2026-07-12
- [x] Phase 5: Full System Integration & Verification (1/1 plan) — completed 2026-07-12

</details>

<details>
<summary>✅ v1.1 Bot Capabilities & Improvements (Phases 6-9) — SHIPPED 2026-07-13</summary>

- [x] Phase 6: Error Resilience & DB Hardening (1/1 plan) — completed 2026-07-12
- [x] Phase 7: UI & UX Enhancements (1/1 plan) — completed 2026-07-12
- [x] Phase 8: Option Pitching & Voting Upgrades (1/1 plan) — completed 2026-07-12
- [x] Phase 9: RSVP Nudging & Roster Tracking (1/1 plan) — completed 2026-07-13

</details>

### 🚧 v1.2 Web Parity & Complete Trip Management (In Progress)

**Milestone Goal:** Replicate all Telegram bot functionalities in the React web application, making the bot entirely optional for trip planning, voting, and expense tracking.

#### Phase 10: Webapp Trip Creation & RSVP Updates
**Goal**: Support creating new trips and updating RSVP status directly from the webapp interface.
**Depends on**: Phase 9
**Requirements**: TRIP-03, RSVP-04
**Success Criteria** (what must be TRUE):
  1. Users can open a "New Trip" modal/form from the trips list view to insert a new trip into Supabase.
  2. Successful trip creation redirects the user to the newly created trip's details view.
  3. The active participant can change their RSVP status (Committed, Tentative, Declined) using a dropdown/toggle selector on the roster view.
**Plans**: 1 plan

Plans:
- [ ] 10-01: Implement trip creation forms, RSVP dropdown updates, and backend service operations

#### Phase 11: Webapp Option Pitching & Voting
**Goal**: Allow users to suggest/pitch new trip options and cast/retract votes on options directly from the webapp.
**Depends on**: Phase 10
**Requirements**: PITCH-04, PITCH-05
**Success Criteria** (what must be TRUE):
  1. The webapp displays a pitching button/form for each category (Accommodation, Flights, etc.) that prompts for category, title, optional price, currency, URL, and description.
  2. Submitting the pitching form inserts the option into the database and displays it instantly in the options list.
  3. The active user can toggle their vote (cast/retract) on any option, updating the vote count and visual state.
**Plans**: 1 plan

Plans:
- [ ] 11-01: Option pitching forms, vote casting toggles, and dynamic option lists updating

#### Phase 12: Webapp Expense Logging & Ledger
**Goal**: Support multi-currency expense logging and split participant selection, and display a scrollable ledger table.
**Depends on**: Phase 11
**Requirements**: LEDG-01, LEDG-02
**Success Criteria** (what must be TRUE):
  1. Users can open an "Add Expense" form to log an expense specifying amount, currency, description, paid-by participant, and split checkboxes.
  2. Logged expenses are saved in the database and display on a scrollable ledger table matching the slate dark design system.
**Plans**: 1 plan

Plans:
- [ ] 12-01: Expense logging modal, participant split checkboxes, and scrollable ledger display

#### Phase 13: Webapp Debts Settlement Optimization
**Goal**: Implement optimized debt settlement calculation (who owes whom, converted to base currency).
**Depends on**: Phase 12
**Requirements**: LEDG-03
**Success Criteria** (what must be TRUE):
  1. The webapp processes all logged expenses to calculate net balances for each participant.
  2. The webapp runs an optimization algorithm to generate the minimum set of transactions to settle all debts.
  3. The settlement overview displays clearly in the UI, applying FX conversion rates relative to the trip's base currency.
**Plans**: 1 plan

Plans:
- [ ] 13-01: Debt resolution greedy solver, FX conversion wrappers, and UI settlement overview rendering

## Progress

**Execution Order:**
Phases execute in numeric order.

| Phase | Milestone | Plans Complete | Status | Completed |
|---|---|---|---|---|
| 1. Project Setup & Database Wiring | v1.0 | 2/2 | Complete | 2026-07-12 |
| 2. Database & Data Access Layer | v1.0 | 2/2 | Complete | 2026-07-12 |
| 3. Trips List & Details UI Views | v1.0 | 2/2 | Complete | 2026-07-12 |
| 4. Member Selection & Management UI | v1.0 | 2/2 | Complete | 2026-07-12 |
| 5. Full System Integration & Verification | v1.0 | 1/1 | Complete | 2026-07-12 |
| 6. Error Resilience & DB Hardening | v1.1 | 1/1 | Complete | 2026-07-12 |
| 7. UI & UX Enhancements | v1.1 | 1/1 | Complete | 2026-07-12 |
| 8. Option Pitching & Voting Upgrades | v1.1 | 1/1 | Complete | 2026-07-12 |
| 9. RSVP Nudging & Roster Tracking | v1.1 | 1/1 | Complete | 2026-07-13 |
| 10. Webapp Trip Creation & RSVP Updates | v1.2 | 0/1 | Not started | - |
| 11. Webapp Option Pitching & Voting | v1.2 | 0/1 | Not started | - |
| 12. Webapp Expense Logging & Ledger | v1.2 | 0/1 | Not started | - |
| 13. Webapp Debts Settlement Optimization | v1.2 | 0/1 | Not started | - |
