# Phase 1: Project Setup & Database Wiring - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the initial setup of the React + Vite + Vanilla CSS single-page application in the `web/` subdirectory, configures the Supabase client to connect to the existing database using the root `.env` file credentials, and verifies database connectivity with a basic check query.

</domain>

<decisions>
## Implementation Decisions

### Project Directory Location
- **D-01:** The React + Vite + Vanilla CSS web application will be initialized in a subdirectory named `web/` to keep the root directory clean and completely isolate Python files (the Telegram bot `main.py` and its `venv`) from frontend configuration and dependency files (`package.json`, `node_modules`, Vite config, etc.).

### Environment Variable Integration
- **D-02:** Vite will be configured to read the root `.env` file (using `envDir: '../'`) and allow `SUPABASE_` prefixes in `vite.config.js`. This allows the React app to read the existing `SUPABASE_URL` and `SUPABASE_KEY` directly from the single root `.env` credentials file as `import.meta.env.SUPABASE_URL` and `import.meta.env.SUPABASE_KEY` without duplicating or editing the existing `.env`.

### Routing Setup
- **D-03:** Install and use React Router (`react-router-dom`) to manage SPA page routing and navigate between the Trips List and Trip Details views, providing standard and shareable URL routes (e.g. `/` for list, `/trips/:id` for details).

### CSS Directory Structure
- **D-04:** Establish a centralized design system styling sheet (e.g., `src/styles/variables.css` or `src/styles/global.css`) containing all CSS custom properties/variables for theme tokens (colors, gradients, typography, shadows, micro-animations) and link it with component-specific CSS files for modular design.

### the agent's Discretion
No areas were designated as "you decide" — all key architectural setup decisions were explicitly chosen by the user.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Framework & Requirements
- [.planning/ROADMAP.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/ROADMAP.md) — Defines the phase order, success criteria, and plans for the web application milestones.
- [.planning/REQUIREMENTS.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/REQUIREMENTS.md) — Details requirements SETUP-01 and SETUP-02 targeted in this phase.
- [.planning/PROJECT.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/PROJECT.md) — Sets core values, constraints, and out of scope details.

### Codebase & Integrations Architecture
- [.planning/codebase/STACK.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/codebase/STACK.md) — Identifies the existing database client version (`supabase` 2.28.3 python client) and env variables configuration.
- [.planning/codebase/ARCHITECTURE.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/codebase/ARCHITECTURE.md) — Details the data storage access pattern and stateless database design.
- [.planning/codebase/INTEGRATIONS.md](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/codebase/INTEGRATIONS.md) — Outlines the Supabase API usage, schema structure, and environmental setups.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [root .env](file:///c:/Users/alex_/Documents/Trip%20Planner/.env) — Reuses existing database environment variables (`SUPABASE_URL` and `SUPABASE_KEY`) without duplicating them.

### Established Patterns
- **Database Schema**: The Supabase database tables already exist and are active (used by `main.py`). The frontend will perform queries and mutations against these tables (`trips`, `rsvps`, `users`, etc.).

### Integration Points
- Connects to Supabase using `SUPABASE_URL` and `SUPABASE_KEY` credentials via `supabase-js` library.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Project Setup & Database Wiring*
*Context gathered: 2026-07-12*
