# Requirements — Milestone v1.5 (Trip Settings, User Profiles & Pitching Audit)

## Requirements

### Option Pitching & Database RLS Audit
- [x] **PITCH-01**: User can pitch options across all categories (Accommodation, Flights, Activities, Food, Transport, Other) on the web app without database RLS errors.
- [x] **PITCH-02**: Casting and retracting votes on options updates real-time voter counts on both web client and Telegram bot.

### Editable Trip Settings & Reconciliations
- [ ] **SETT-01**: Trip members can edit trip metadata (title, destination, description, start/end dates, base currency) via web modal.
- [ ] **SETT-02**: Changing trip dates checks pitched options and displays a date-reconciliation warning banner for options falling outside the new date range.
- [ ] **SETT-03**: Changing trip base currency updates ledger display and currency conversion calculations seamlessly without corrupting existing expense logs.

### User Profile Management
- [ ] **PROF-01**: User can view a dedicated User Profile page (`/profile`) displaying their traveler details, email, Telegram link status, and avatar.
- [ ] **PROF-02**: User can edit personal profile settings (first name/display name) and link or unlink their Telegram account securely.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PITCH-01 | Phase 21 | Complete |
| PITCH-02 | Phase 21 | Complete |
| SETT-01 | Phase 22 | Pending |
| SETT-02 | Phase 22 | Pending |
| SETT-03 | Phase 22 | Pending |
| PROF-01 | Phase 23 | Pending |
| PROF-02 | Phase 23 | Pending |
