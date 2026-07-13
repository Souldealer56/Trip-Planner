# Requirements: Trip Planner

## Milestone v1.2: Web Parity & Complete Trip Management

### Trip Creation (TRIP)

- [ ] **TRIP-03**: User can create a new trip by submitting a form with title, destination, start/end dates, and base currency (with input validations).

### RSVP Management (RSVP)

- [ ] **RSVP-04**: User can update their RSVP status (Committed, Tentative, Declined) from the webapp roster interface for the active participant session.

### Pitching & Voting (PITCH)

- [ ] **PITCH-04**: User can pitch a new trip option specifying category, title, optional price, currency, URL, and description.
- [ ] **PITCH-05**: User can cast or retract their vote on any pitched option directly from the webapp.

### Expense Ledger & Settlements (LEDG)

- [ ] **LEDG-01**: User can log a new expense by specifying description, amount, currency, paid-by participant, and selecting split participants.
- [ ] **LEDG-02**: User can view a scrollable list of all logged expenses (ledger) showing amount, who paid, and who splits it.
- [ ] **LEDG-03**: User can view a settlement summary calculating balances and the optimized debt resolutions (who owes whom, how much, converted to base currency).

## v2 Requirements

### Advanced Features

- **BUDG-01**: The web application supports custom expense splitting categories.
- **NOTF-01**: Web app triggers push notifications to Telegram users when new options are locked.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Direct Stripe Integration | Security risks and compliance overhead; settlement directions are sufficient for v1. |
| User Profile Avatars on Bot | Minimal visual utility inside group chat interface. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRIP-03 | Phase 10 | Pending |
| RSVP-04 | Phase 10 | Pending |
| PITCH-04 | Phase 11 | Pending |
| PITCH-05 | Phase 11 | Pending |
| LEDG-01 | Phase 12 | Pending |
| LEDG-02 | Phase 12 | Pending |
| LEDG-03 | Phase 13 | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-13*
*Last updated: 2026-07-13 after v1.2 milestone initialization*
