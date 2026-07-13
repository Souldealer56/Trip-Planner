---
phase: 7
slug: ui-ux-enhancements
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-12
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.1.1 |
| **Config file** | pytest.ini |
| **Quick run command** | `pytest tests/test_ui_ux.py` |
| **Full suite command** | `pytest` |
| **Estimated runtime** | ~1.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_ui_ux.py`
- **After every plan wave:** Run `pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | UX-01 / UX-02 | — | N/A | unit | `pytest --version` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | UX-02 | — | Emojis resolved consistently via centralized _UX_EMOJIS registry | unit | `pytest tests/test_ui_ux.py -k test_emoji_consistency` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | UX-01 | — | HTML formatting applied consistently to roster output | unit | `pytest tests/test_ui_ux.py -k test_roster_formatting` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 2 | UX-01 | — | HTML formatting applied consistently to ledger and budget output | unit | `pytest tests/test_ui_ux.py -k test_ledger_budget_formatting` | ❌ W0 | ⬜ pending |
| 07-01-05 | 01 | 2 | UX-01 | — | HTML formatting applied consistently to itinerary output | unit | `pytest tests/test_ui_ux.py -k test_itinerary_formatting` | ❌ W0 | ⬜ pending |
| 07-01-06 | 01 | 2 | UX-01 / UX-02 | — | Success and warning alerts conform to standardized bold-header layout | unit | `pytest tests/test_ui_ux.py -k test_alert_formatting` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_ui_ux.py` — unit tests for Phase 7 formatting and emojis
- [ ] Install pytest: `pip install pytest pytest-asyncio`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real bot message rendering | UX-01 / UX-02 | Hard to visually check Telegram font styles and emoji resolution automatically | Run the bot, execute `/roster`, `/budget`, `/ledger`, `/itinerary` in group/PM and visually inspect messages for correct formatting, bold names, and clean travel emojis. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
