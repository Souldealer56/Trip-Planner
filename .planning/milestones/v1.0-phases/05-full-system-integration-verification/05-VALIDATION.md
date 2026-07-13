---
phase: 5
slug: full-system-integration-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js (Build & Automation) |
| **Config file** | web/package.json |
| **Quick run command** | `npm run build --prefix web` |
| **Full suite command** | `node web/cleanup-e2e.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build --prefix web`
- **After every plan wave:** Run `npm run build --prefix web`
- **Before `/gsd-verify-work`:** Full build must compile cleanly with zero errors
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SETUP-01 / SETUP-02 | — | N/A | build-check | `npm run build --prefix web` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | TRIPS-01 / TRIPS-02 | — | N/A | visual-check | `npm run build --prefix web` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | MEMBER-01 / MEMBER-02 | — | N/A | db-check | `npm run build --prefix web` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/cleanup-e2e.cjs` — database test user cleanup script.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

None. All system verification checks are executed dynamically by the automated browser subagent flows.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
