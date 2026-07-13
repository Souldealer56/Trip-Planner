---
phase: 4
slug: member-selection-management-ui
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js (Build Checks) |
| **Config file** | web/package.json |
| **Quick run command** | `npm run build --prefix web` |
| **Full suite command** | `npm run build --prefix web` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build --prefix web`
- **After every plan wave:** Run `npm run build --prefix web`
- **Before `/gsd-verify-work`:** Full build must compile cleanly with zero errors
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | MEMBER-01 | — | N/A | build-check | `npm run build --prefix web` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | MEMBER-01 | — | N/A | build-check | `npm run build --prefix web` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | MEMBER-02 | — | N/A | build-check | `npm run build --prefix web` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No custom test stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Profile Modal Display | MEMBER-01 | Visual Overlay trigger | Open Trip Details without active user set, verify blocking overlay modal appears with participant buttons. |
| User join form mutation | MEMBER-02 | Dynamic database sync | Fill join form inside modal, submit, verify modal closes and new user displays in roster with Committed badge. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
