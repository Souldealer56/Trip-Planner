---
phase: 11
slug: webapp-option-pitching-voting
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Custom Node.js Assertions / ESLint |
| **Config file** | `web/package.json` |
| **Quick run command** | `node web/verify-options-service.cjs` |
| **Full suite command** | `npm run lint && node web/verify-options-service.cjs` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `node web/verify-options-service.cjs` or `npm run lint`
- **After every plan wave:** Run `npm run lint && node web/verify-options-service.cjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PITCH-04, PITCH-05 | — | N/A | unit | `node web/verify-options-service.cjs` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | PITCH-04 | — | N/A | lint | `npm run lint` | ✅ | ⬜ pending |
| 11-01-03 | 01 | 1 | PITCH-05 | — | N/A | lint | `npm run lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/verify-options-service.cjs` — stubs for testing client service functions (fetching options, pitching options, active polls, and vote toggles).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Category Navigation | PITCH-04 | UI Tab Layout | Switch between Accommodation, Flights, Activities, Food, Transport, and Other tabs and verify correct filtering of options. |
| Pitch Option Modal Form | PITCH-04 | Form input/overlay | Open the "Pitch Option" modal, input options (including validation checks for invalid negative cost inputs), and verify submission refreshes the active tab list. |
| Vote Casting Toggle | PITCH-05 | Interactive UI/state | Toggle vote button on any option card and verify that counts increment/decrement instantly and the card visual state (accent border) reflects the active user's vote status. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
