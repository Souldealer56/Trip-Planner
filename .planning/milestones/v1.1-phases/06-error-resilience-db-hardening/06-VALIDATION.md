---
phase: 6
slug: error-resilience-db-hardening
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.1.1 |
| **Config file** | pytest.ini |
| **Quick run command** | `pytest tests/test_error_resilience.py` |
| **Full suite command** | `pytest` |
| **Estimated runtime** | ~1.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_error_resilience.py`
- **After every plan wave:** Run `pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | ERR-01 / ERR-02 | — | N/A | unit | `pytest --version` | ✅ yes | ✅ green |
| 06-01-02 | 01 | 1 | ERR-01 | — | Supabase calls wrapped and retried with backoff | unit | `pytest tests/test_error_resilience.py -k test_safe_db_call` | ✅ yes | ✅ green |
| 06-01-03 | 01 | 1 | ERR-02 | — | Renders HTML error blocks and edits callbacks | unit | `pytest tests/test_error_resilience.py -k test_send_db_error_message` | ✅ yes | ✅ green |
| 06-02-01 | 01 | 2 | ERR-01 / ERR-02 | — | DB operations in main.py use _safe_db_call | unit | `pytest tests/test_error_resilience.py -k test_get_db_user_id` | ✅ yes | ✅ green |
| 06-02-02 | 01 | 2 | ERR-03 | — | pm_wizard_handler clears user_data on deep link | unit | `pytest tests/test_error_resilience.py -k test_wizard_reentry` | ✅ yes | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/test_error_resilience.py` — stubs for ERR-01, ERR-02, and ERR-03
- [x] `tests/conftest.py` — mock structures for Update/Context and supabase client
- [x] Install pytest: `pip install pytest pytest-asyncio`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real bot re-entry behavior | ERR-03 | Hard to fully simulate PTB ConversationHandler state machine | Start wizard PM link, then click a different command link (e.g. /paid) and verify state is cleared and transition occurs without crash. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (all tests passing green)
