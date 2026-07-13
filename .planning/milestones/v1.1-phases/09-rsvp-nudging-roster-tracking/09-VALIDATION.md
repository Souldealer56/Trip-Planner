---
phase: 9
slug: rsvp-nudging-roster-tracking
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.1.1 |
| **Config file** | pytest.ini |
| **Quick run command** | `pytest tests/test_nudges_roster.py` |
| **Full suite command** | `pytest` |
| **Estimated runtime** | ~1.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_nudges_roster.py`
- **After every plan wave:** Run `pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 0 | — | — | N/A | unit | `pytest --version` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | RSVP-01 | — | /rsvp_notes command successfully stores and alters notes | unit | `pytest tests/test_nudges_roster.py -k test_rsvp_notes_command` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | RSVP-01 | T-09-01 | Escape HTML tags in /roster display notes | unit | `pytest tests/test_nudges_roster.py -k test_roster_notes_escaping` | ❌ W0 | ⬜ pending |
| 09-01-04 | 01 | 2 | RSVP-02 | — | RSVP nudge logic correctly filters active group members who haven't RSVP'd | unit | `pytest tests/test_nudges_roster.py -k test_rsvp_nudges_logic` | ❌ W0 | ⬜ pending |
| 09-01-05 | 01 | 2 | RSVP-03 | — | PollAnswer update updates voter_ids in database | unit | `pytest tests/test_nudges_roster.py -k test_poll_answer_updates_voter_ids` | ❌ W0 | ⬜ pending |
| 09-01-06 | 01 | 2 | RSVP-03 | — | Poll nudge logic alerts unvoted committed participants and notifies organiser at 60% | unit | `pytest tests/test_nudges_roster.py -k test_poll_nudges_logic` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_nudges_roster.py` — unit tests for Phase 9 RSVP notes and background nudges
- [ ] Schema update: `ALTER TABLE rsvps ADD COLUMN notes TEXT;` and `ALTER TABLE trips ADD COLUMN last_rsvp_nudge_at TIMESTAMP WITH TIME ZONE;` executed in Supabase SQL Editor

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Web App Note Editing | RSVP-01 | UI user interaction | Go to Trip Details web view, log in as active user, write an RSVP note, save, and verify it updates in the database and renders inline under your name. |
| Group Chat Reminders | RSVP-02 / RSVP-03 | Complex time triggers and Telegram group environment | Temporarily shorten configuration interval constants, launch bot, let it run, verify RSVP nudge posts to group chat listing un-RSVP'd members, and poll reminders post listing committed unvoted members. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
