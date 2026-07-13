# Phase 5: Full System Integration & Verification - Research

## User Constraints

Captured from [05-CONTEXT.md](file:///.planning/phases/05-full-system-integration-verification/05-CONTEXT.md):

*   **D-01:** Spin up the Vite development server on port 5173 inside a background task, and use the `browser_subagent` to browse the app at `http://localhost:5173`. The subagent will click a trip, trigger the profile modal, fill and submit the participant join form, verify user session propagation, and record a video walkthrough to the artifacts folder.
*   **D-02:** Allow the browser subagent to execute real mutations during the E2E verification run (creating a test participant with a negative `telegram_id` inside the shared Supabase database). After verification completes, run a cleanup script to delete the test user record (cascading to RSVPs) to leave the database clean.

## Project Constraints (from GEMINI.md)

*   **Tech Stack (Bot):** Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint.
*   **Tech Stack (Web):** React + Vite + Vanilla CSS — user preference.
*   **Authentication:** No authentication in v1 — user request.

## Standard Stack

*   **Vite Dev Server**: `npm run dev --prefix web` spins up a local server on port 5173.
*   **Browser Subagent**: Employs Playwright-driven headless or headful chromium browser sessions inside the developer IDE workspace.

## Architecture Patterns

### Automated Browser Subagent Flow
The browser subagent prompt should detail the following sequence:
1.  Navigate to `http://localhost:5173/`.
2.  Wait for skeleton load state to resolve.
3.  Click the first trip card in the list.
4.  Confirm navigation to `/trips/:id` occurred and the profile overlay modal is visible.
5.  Click the "I'm Not on This List (Join Trip)" toggle button.
6.  Input `"Subagent E2E User"` into the First Name field.
7.  Input `"subagent_test"` into the Telegram Username field.
8.  Submit the form.
9.  Verify the modal closes, the user is signed in (header shows "Signed in as: Subagent E2E User"), and the roster lists the user with a Committed badge.

### DB Verification & Cleanup Script (`web/cleanup-e2e.cjs`)
A Node.js cleanup script will connect to Supabase and delete the test participant created during the E2E run:
```javascript
// web/cleanup-e2e.cjs
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load env vars
// ...
const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanup() {
  console.log("Cleaning up E2E subagent user...")
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('first_name', 'Subagent E2E User')
  if (error) {
    console.error("Cleanup failed:", error)
    process.exit(1)
  }
  console.log("Cleanup complete.")
  process.exit(0)
}
cleanup()
```

## Don't Hand-Roll

*   **Don't hand-roll server routing during checks**: Rely on Vite's default routing behavior (`/index.html` fallback for single-page applications) configured in dev mode.

## Common Pitfalls

*   **Dev Server Port Lock**: If another server is already listening on port 5173, Vite might automatically fall back to 5174. We must configure `web/vite.config.js` or configure the subagent to read the resolved server output, or force port 5173:
    ```javascript
    // vite.config.js
    server: {
      port: 5173,
      strictPort: true
    }
    ```
    Wait, let's configure `vite.config.js` to enforce `strictPort: true` and `port: 5173` if we want to ensure zero port drift. Let's make sure!
    Let's check if the port is already set in `web/vite.config.js`.

## Package Legitimacy Audit

No new external npm packages are introduced in this phase.

## Validation Architecture

1.  **Production build compile check**: `npm run build --prefix web` must pass.
2.  **Visual E2E check**: Run the dev server, execute Playwright subagent commands, log assertions, and capture execution recordings.
3.  **Database state cleanup**: Run the `cleanup-e2e.cjs` script to ensure database integrity.

---

*Phase: 5-Full System Integration & Verification*
*Research completed: 2026-07-12*
