---
phase: 10
slug: webapp-trip-creation-rsvp-updates
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Pytest 8.x + Custom verification scripts |
| **Config file** | pytest.ini |
| **Quick run command** | `pytest tests/test_ui_ux.py` |
| **Full suite command** | `pytest tests/ && node web/verify-services.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint` and `pytest tests/test_ui_ux.py`
- **After every plan wave:** Run `pytest tests/ && node web/verify-services.cjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | TRIP-03 | — | N/A | integration | `node web/verify-services.cjs` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | TRIP-03 | — | N/A | manual | see Manual-Only | N/A | ⬜ pending |
| 10-01-03 | 01 | 1 | RSVP-04 | — | N/A | integration | `node web/verify-services.cjs` | ✅ | ⬜ pending |
| 10-01-04 | 01 | 1 | RSVP-04 | — | N/A | manual | see Manual-Only | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Form input modal displays and closes, validates date ranges, redirects on success | TRIP-03 | Browser UI component interaction | Open TripsList view, click "New Trip", fill form, input end date before start date to check warning. Submit valid details and check redirect. |
| Session bar displays RSVP dropdown selector when signed in, roster list badge updates on status change | RSVP-04 | Session state and browser DOM interaction | Choose active participant, change RSVP from dropdown, check roster badge update. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
