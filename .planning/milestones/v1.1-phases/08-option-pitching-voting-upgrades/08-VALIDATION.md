---
phase: 8
slug: option-pitching-voting-upgrades
status: draft
nyquist_compliant: true
wave_0_complete: true
wave_1_complete: true
wave_2_complete: true
created: 2026-07-12
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.1.1 |
| **Config file** | pytest.ini |
| **Quick run command** | `pytest tests/test_pitch_voting.py` |
| **Full suite command** | `pytest` |
| **Estimated runtime** | ~1.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_pitch_voting.py`
- **After every plan wave:** Run `pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 0 | — | — | N/A | unit | `pytest --version` | ✅ W0 | ✅ green |
| 08-01-02 | 01 | 1 | PITCH-02 | — | PM wizard description step stores text or skips appropriately | unit | `pytest tests/test_pitch_voting.py -k test_pitch_wizard_description` | ✅ W0 | ✅ green |
| 08-01-03 | 01 | 1 | PITCH-01 / PITCH-02 | — | DB insert executes with description and link fields | unit | `pytest tests/test_pitch_voting.py -k test_option_db_insert` | ✅ W0 | ✅ green |
| 08-01-04 | 01 | 2 | PITCH-01 / PITCH-02 | T-08-01 | Escape HTML tags in user description and hyperlinked titles | unit | `pytest tests/test_pitch_voting.py -k test_companion_message_formatting` | ✅ W0 | ✅ green |
| 08-01-05 | 01 | 2 | PITCH-03 | — | /polls command fetches and renders native poll vote counts | unit | `pytest tests/test_pitch_voting.py -k test_polls_command_tallies` | ✅ W0 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/test_pitch_voting.py` — unit tests for Phase 8 option pitching and voting upgrades
- [x] Schema update: `ALTER TABLE poll_options ADD COLUMN description TEXT;` executed in Supabase SQL Editor

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real bot inline link clicking | PITCH-01 | Hard to verify clicking action automatically in unit tests | Launch bot, pitch an option with link, verify in companion message that name is a clickable HTML link and description is shown. |
| Telegram Native Poll Votes | PITCH-03 | Fetching votes requires active users casting votes on Telegram | Run `/vote` in group, vote on some options in the native poll, run `/polls` in the group, and verify the correct vote tallies are printed. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
