# Roadmap: Trip Planner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-07-12)
- ✅ **v1.1 Bot Capabilities & Improvements** — Phases 6-9 (shipped 2026-07-13)
- ✅ **v1.2 Web Parity & Complete Trip Management** — Phases 10-13 (shipped 2026-07-13)
- ✅ **v1.3 Traveler Profiles & Access Control** — Phases 14-16 (shipped 2026-07-14)
- ✅ **v1.4 Standalone Webapp & Hybrid Onboarding** — Phases 17-20 (shipped 2026-07-20)
- ✅ **v1.5 Trip Settings, User Profiles & Pitching Audit** — Phases 21-23 (shipped 2026-07-21)
- 🚧 **v1.6 Full Platform Feature Audit & System Hardening** — Phase 24 (in progress)

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

<details>
<summary>✅ v1.2 Web Parity & Complete Trip Management (Phases 10-13) — SHIPPED 2026-07-13</summary>

- [x] Phase 10: Webapp Trip Creation & RSVP Updates (1/1 plan) — completed 2026-07-13
- [x] Phase 11: Webapp Option Pitching & Voting (1/1 plan) — completed 2026-07-13
- [x] Phase 12: Webapp Expense Logging & Ledger (1/1 plan) — completed 2026-07-13
- [x] Phase 13: Webapp Debts Settlement Optimization (1/1 plan) — completed 2026-07-13

</details>

<details>
<summary>✅ v1.3 Traveler Profiles & Access Control (Phases 14-16) — SHIPPED 2026-07-14</summary>

- [x] Phase 14: Global Sessions & Splash Profiles (1/1 plan) — completed 2026-07-14
- [x] Phase 15: Filtered Trips Dashboard & Auto-RSVP (1/1 plan) — completed 2026-07-14
- [x] Phase 16: Session Reconciliation & Bot Deep Linking (1/1 plan) — completed 2026-07-14

</details>

<details>
<summary>✅ v1.4 Standalone Webapp & Hybrid Onboarding (Phases 17-20) — SHIPPED 2026-07-20</summary>

- [x] Phase 17: Custom Passwordless Email Login (1/1 plan) — completed 2026-07-17
- [x] Phase 18: Shareable Web Invite Links (`/join/:tripId`) & Standalone Roster Onboarding (1/1 plan) — completed 2026-07-17
- [x] Phase 19: Hybrid Bot-Web Coexistence (1/1 plan) — completed 2026-07-18
- [x] Phase 20: In-App Activity Log & Notification Feed (1/1 plan) — completed 2026-07-20

</details>

<details>
<summary>✅ v1.5 Trip Settings, User Profiles & Pitching Audit (Phases 21-23) — SHIPPED 2026-07-21</summary>

- [x] Phase 21: Option Pitching & Database RLS Audit (1/1 plan) — completed 2026-07-20
- [x] Phase 22: Editable Trip Settings & Date/Currency Reconciliation (1/1 plan) — completed 2026-07-21
- [x] Phase 23: User Profile Management Page (1/1 plan) — completed 2026-07-21

</details>

### 🚧 v1.6 Full Platform Feature Audit & System Hardening (In Progress)

**Milestone Goal:** Perform an end-to-end audit and hardening across all web and Telegram bot capabilities to ensure 100% bug-free operation and feature stability.

#### Phase 24: Full Platform Feature & Flow Audit

**Goal**: Audit, verify, and resolve any functional edge cases across Option Pitching, Trip Settings, Expense Ledgers, and User Profiles.
**Depends on**: Phase 23
**Requirements**: AUD-01, AUD-02, AUD-03, AUD-04
**Success Criteria**:

  1. Option pitching, category switching, and voting operate without missing state or database errors.
  2. Trip settings editing, date range reconciliation warnings, and FX base currency conversions update dynamically.
  3. Expense logging, custom roster split checklists, and greedy settlement algorithms calculate debts accurately.
  4. User profile editing, avatar color persistence, passwordless email login, and Telegram linking execute cleanly.

**Plans**: 1/1 plans complete

- [ ] 24-PLAN.md

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
| 10. Webapp Trip Creation & RSVP Updates | v1.2 | 1/1 | Complete | 2026-07-13 |
| 11. Webapp Option Pitching & Voting | v1.2 | 1/1 | Complete | 2026-07-13 |
| 12. Webapp Expense Logging & Ledger | v1.2 | 1/1 | Complete | 2026-07-13 |
| 13. Webapp Debts Settlement Optimization | v1.2 | 1/1 | Complete | 2026-07-13 |
| 14. Global Sessions & Splash Profiles | v1.3 | 1/1 | Complete | 2026-07-14 |
| 15. Filtered Trips Dashboard & Auto-RSVP | v1.3 | 1/1 | Complete | 2026-07-14 |
| 16. Session Reconciliation & Bot Deep Linking | v1.3 | 1/1 | Complete | 2026-07-14 |
| 17. Custom Passwordless Email Login | v1.4 | 1/1 | Complete | 2026-07-17 |
| 18. Shareable Web Invite Links & Standalone Roster Onboarding | v1.4 | 1/1 | Complete | 2026-07-17 |
| 19. Hybrid Bot-Web Coexistence | v1.4 | 1/1 | Complete | 2026-07-18 |
| 20. In-App Activity Log & Notification Feed | v1.4 | 1/1 | Complete | 2026-07-20 |
| 21. Option Pitching & Database RLS Audit | v1.5 | 1/1 | Complete | 2026-07-20 |
| 22. Editable Trip Settings & Date/Currency Reconciliation | v1.5 | 1/1 | Complete | 2026-07-21 |
| 23. User Profile Management Page | v1.5 | 1/1 | Complete | 2026-07-21 |
| 24. Full Platform Feature & Flow Audit | v1.6 | 1/1 | Complete   | 2026-07-21 |
