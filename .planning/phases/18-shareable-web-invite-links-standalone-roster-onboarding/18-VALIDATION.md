---
phase: 18
slug: shareable-web-invite-links-standalone-roster-onboarding
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-17
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.1.1 + Node.js |
| **Config file** | pytest.ini |
| **Quick run command** | `.\venv\Scripts\pytest tests/test_nudges_roster.py` |
| **Full suite command** | `.\venv\Scripts\pytest` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `.\venv\Scripts\pytest tests/test_nudges_roster.py`
- **After every plan wave:** Run `.\venv\Scripts\pytest` and `node web/verify-invite-flow.cjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | INV-02 | — | N/A | integration | `node web/verify-invite-flow.cjs` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | INV-02 | — | N/A | integration | `.\venv\Scripts\pytest tests/test_nudges_roster.py` | ✅ | ⬜ pending |
| 18-01-03 | 01 | 2 | INV-01 | — | N/A | integration | `node web/verify-invite-flow.cjs` | ⬜ pending |
| 18-01-04 | 01 | 2 | INV-02 | — | N/A | integration | `.\venv\Scripts\pytest tests/test_nudges_roster.py` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/verify-invite-flow.cjs` — stubs for testing invite join logic

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clipboard Copy Link | INV-01 | Browser API | Click 'Copy Invite Link' in Trip Details, check clipboard matches `/join/:tripId` and toast alert fades out. |
| Dual-path UI flow | INV-02 | Visual Layout | Land on `/join/:tripId` and verify both First Name and Email paths render. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
