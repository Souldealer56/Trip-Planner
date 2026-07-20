---
phase: 17
slug: custom-passwordless-email-login
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (Python) + Node (JS integration scripts) |
| **Config file** | `pytest.ini` (Python) |
| **Quick run command** | `pytest tests/test_auth_link.py` |
| **Full suite command** | `pytest && node web/verify-auth-flow.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_auth_link.py`
- **After every plan wave:** Run `pytest && node web/verify-auth-flow.cjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | AUTH-01 | — | N/A | integration | `node web/verify-auth-flow.cjs` (schema checks) | ✅ | ⬜ pending |
| 17-01-02 | 01 | 1 | AUTH-01 | — | N/A | unit | `pytest tests/test_auth_link.py` (stub test run) | ✅ | ⬜ pending |
| 17-02-01 | 01 | 2 | AUTH-02 | — | Secure token query | integration | `node web/verify-auth-flow.cjs` (service checks) | ✅ | ⬜ pending |
| 17-02-02 | 01 | 2 | AUTH-01 | — | Input sanitization | manual | Manual: Visual layout check of splash page form | ✅ | ⬜ pending |
| 17-02-03 | 01 | 2 | AUTH-03 | — | Sanitise query params | integration | `node web/verify-auth-flow.cjs` (verification logic) | ✅ | ⬜ pending |
| 17-03-01 | 01 | 3 | AUTH-04 | — | Confirmed linking | manual | Manual: Verify profile Telegram link button state | ✅ | ⬜ pending |
| 17-03-02 | 01 | 3 | AUTH-04 | — | Code verification | unit | `pytest tests/test_auth_link.py` (start handler) | ✅ | ⬜ pending |
| 17-03-03 | 01 | 3 | AUTH-04 | — | Atomic cascading delete | unit | `pytest tests/test_auth_link.py` (merging logic) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_auth_link.py` — pytest stubs for Telegram linking and cascade user merge logic.
- [ ] `web/verify-auth-flow.cjs` — node script stub checking `login_tokens` schema and auth service methods.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Splash page loading/email input validation layout | AUTH-01 | Visual rendering | Open browser to landing page, type invalid emails, verify browser/custom alert messages. |
| Verification redirection & sanitize state | AUTH-03 | SPA router redirect | Click link, confirm loading state displays, parameters disappear instantly from URL, and dashboard mounts. |
| Telegram connection state button toggle | AUTH-04 | Renders user state | Verify Profile Settings page toggles button text from "Link Telegram Account" to "Disconnect Telegram" when linked. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-15
