---
phase: 1
slug: project-setup-database-wiring
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js (Build & Execution Scripts) |
| **Config file** | web/package.json |
| **Quick run command** | `node web/verify-db.cjs` |
| **Full suite command** | `npm run build --prefix web && node web/verify-db.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node web/verify-db.cjs` (if dependencies are installed)
- **After every plan wave:** Run `npm run build --prefix web && node web/verify-db.cjs`
- **Before `/gsd-verify-work`:** Full build and verify-db check must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SETUP-01 | — | N/A | file-check | `test -f web/package.json` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SETUP-01 | — | N/A | file-check | `test -f web/src/App.jsx` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | SETUP-01 | — | N/A | file-check | `test -f web/src/styles/variables.css` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | SETUP-02 | — | N/A | build-check | `npm run build --prefix web` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | SETUP-02 | — | N/A | db-check | `node web/verify-db.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/verify-db.cjs` — connection test script using Anon Key + Supabase URL
- [ ] `web/package.json` — react, react-dom, vite, react-router-dom, and supabase-js package configurations

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Web App running in dev mode | SETUP-01 | Requires browser render check | Run `npm run dev --prefix web`, verify Vite dev server starts, click the localhost link, and confirm page displays React logo. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
