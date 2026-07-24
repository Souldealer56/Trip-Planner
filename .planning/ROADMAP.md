# Roadmap — Trip Planner

## Milestones

- ✅ **v1.0 Baseline Web Application & Real-time Database Foundation** — Phases 1-5 (shipped 2026-07-21)
- ✅ **v1.1 Telegram Bot UX Enhancements & Flow Optimization** — Phases 6-9 (shipped 2026-07-21)
- ✅ **v1.2 Full-Stack Webapp Parity for Core Trip Planning** — Phases 10-13 (shipped 2026-07-21)
- ✅ **v1.3 User Profiles, Multi-Trip Dashboard & Session Persistence** — Phases 14-16 (shipped 2026-07-21)
- ✅ **v1.4 Custom Passwordless Auth, Standalone Invite Onboarding & Hybrid User Engine** — Phases 17-20 (shipped 2026-07-21)
- ✅ **v1.5 Option Pitching Audit, Editable Trip Settings & Profile Page** — Phases 21-23 (shipped 2026-07-21)
- ✅ **v1.6 Full Platform Feature Audit & System Hardening** — Phase 24 (shipped 2026-07-21)
- ✅ **v1.7 Webapp Option Pitching & Voting Integration** — Phases 25-26 (shipped 2026-07-22)
- ✅ **v1.8 Visual Trip Timeline & Interactive Gantt Planning** — Phases 27-30 (shipped 2026-07-23)
- ✅ **v1.9 Webapp Trip Archiving & Co-Organizer Administration** — Phases 31-32 (shipped 2026-07-24)
- 🚧 **v2.0 Locked Option Expense Sync & Advanced Cost Partitioning** — Phases 33-35 (In progress)

## Phases

<details open>
<summary>🚧 v2.0 Locked Option Expense Sync & Advanced Cost Partitioning (Phases 33-35) — IN PROGRESS</summary>

- [x] Phase 33: Locked Option Expense Integration & Direct Ledger Logging (1/1 plan) — completed 2026-07-24
- [x] Phase 34: Flexible Cost Repartitioning & Custom Participant Splits (1/1 plan) — completed 2026-07-24
- [x] Phase 35: Budget Breakdown & Traveler Cost Distribution Analytics (1/1 plan) — completed 2026-07-24

</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 33. Locked Option Expense Integration & Direct Ledger Logging | v2.0 | 1/1 | Complete | 2026-07-24 |
| 34. Flexible Cost Repartitioning & Custom Participant Splits | v2.0 | 1/1 | Complete | 2026-07-24 |
| 35. Budget Breakdown & Traveler Cost Distribution Analytics | v2.0 | 1/1 | Complete | 2026-07-24 |

## Phase Details

### Phase 33: Locked Option Expense Integration & Direct Ledger Logging
- **Goal:** Enable users to seamlessly convert locked-in itinerary options into logged expenses with automatic pre-filling of title, amount, currency, and payer.
- **Requirements:** `EXPENSE-01`
- **Success Criteria:**
  1. Locked options display a prompt/button "💸 Log as Expense" in the web app.
  2. Clicking the action pre-fills expense details and creates a connected ledger expense record without duplicate entry.

### Phase 34: Flexible Cost Repartitioning & Custom Participant Splits
- **Goal:** Provide custom cost repartitioning allowing users to split expenses equally, by custom amount/percentage per traveler, or exclude specific participants.
- **Requirements:** `EXPENSE-02`
- **Success Criteria:**
  1. Expense creation/edit modals feature a split calculator supporting equal, custom dollar/percentage, or participant exclusion.
  2. Settlement calculation engine correctly calculates individual traveler debts based on custom split allocations.

### Phase 35: Budget Breakdown & Traveler Cost Distribution Analytics
- **Goal:** Display visual budget analytics comparing locked option estimates, logged expenses, and individual traveler cost distributions.
- **Requirements:** `EXPENSE-03`
- **Success Criteria:**
  1. A visual Budget & Cost Analytics tab displays total estimated vs. actual expenses.
  2. Per-traveler expense breakdowns clearly show who paid, who owes, and total personal commitments.
