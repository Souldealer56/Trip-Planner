# Phase 1: Project Setup & Database Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 1-Project Setup & Database Wiring
**Areas discussed:** Project Directory Location, Environment Variable Integration, Routing Setup, CSS Directory Structure

---

## Project Directory Location

| Option | Description | Selected |
|--------|-------------|----------|
| In a subdirectory named 'web' | keeps the root clean and isolates Python files from Node/frontend files | ✓ |
| In the root workspace directory | all configuration files in the root | |
| You decide | Antigravity chooses the best configuration | |

**User's choice:** In a subdirectory named 'web'
**Notes:** Decided to place React app in `web/` subdirectory to avoid cluttering python workspace files (venv, main.py, etc.) and npm/Vite config files.

---

## Environment Variable Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Configure Vite to read the root .env and allow 'SUPABASE_' prefixes | keeps a single source of truth for credentials | ✓ |
| Create a new .env file in the 'web' directory with 'VITE_' prefixed keys | traditional Vite pattern, but duplicates credentials | |
| You decide | Antigravity chooses the best configuration | |

**User's choice:** Configure Vite to read the root .env and allow 'SUPABASE_' prefixes
**Notes:** Vite configuration will be tweaked with `envDir: '../'` and `envPrefix: ['SUPABASE_', 'VITE_']` to directly consume root `.env` without duplication.

---

## Routing Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Install and use React Router (react-router-dom) | for standard, shareable URL routing (e.g. /trips/:id) | ✓ |
| Lightweight state-based custom router | simple view state in App component, keeps dependencies minimal | |
| Custom hash-based router | uses window.location.hash for shareable URLs without adding packages | |
| You decide | Antigravity chooses the best configuration | |

**User's choice:** Install and use React Router (react-router-dom)
**Notes:** User preferred React Router for clean shareable path routing.

---

## CSS Directory Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Centralized variables/tokens stylesheet plus component-specific stylesheets | keeps tokens clean and styles structured | ✓ |
| Single monolithic global stylesheet | all CSS in a single index.css file | |
| CSS Modules | using .module.css files to guarantee scoped styling | |
| You decide | Antigravity chooses the best configuration | |

**User's choice:** Centralized variables/tokens stylesheet plus component-specific stylesheets
**Notes:** Standard CSS stylesheet variables files for centralized layout styling tokens combined with component stylesheets.

---

## the agent's Discretion

None.

## Deferred Ideas

None.
