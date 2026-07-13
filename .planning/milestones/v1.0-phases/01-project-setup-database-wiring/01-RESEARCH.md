# Phase 1: Project Setup & Database Wiring - Research

## User Constraints

Captured from [01-CONTEXT.md](file:///.planning/phases/01-project-setup-database-wiring/01-CONTEXT.md):

*   **D-01:** The React + Vite + Vanilla CSS web application will be initialized in a subdirectory named `web/` to keep the root directory clean and completely isolate Python files (the Telegram bot `main.py` and its `venv`) from frontend configuration and dependency files (`package.json`, `node_modules`, Vite config, etc.).
*   **D-02:** Vite will be configured to read the root `.env` file (using `envDir: '../'`) and allow `SUPABASE_` prefixes in `vite.config.js`. This allows the React app to read the existing `SUPABASE_URL` and `SUPABASE_KEY` directly from the single root `.env` credentials file as `import.meta.env.SUPABASE_URL` and `import.meta.env.SUPABASE_KEY` without duplicating or editing the existing `.env`.
*   **D-03:** Install and use React Router (`react-router-dom`) to manage SPA page routing and navigate between the Trips List and Trip Details views, providing standard and shareable URL routes (e.g. `/` for list, `/trips/:id` for details).
*   **D-04:** Establish a centralized design system styling sheet (e.g., `src/styles/variables.css` or `src/styles/global.css`) containing all CSS custom properties/variables for theme tokens (colors, gradients, typography, shadows, micro-animations) and link it with component-specific CSS files for modular design.

## Project Constraints (from GEMINI.md)

*   **Tech Stack (Bot):** Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint.
*   **Tech Stack (Web):** React + Vite + Vanilla CSS — user preference.
*   **Authentication:** No authentication in v1 — user request.

## Standard Stack

*   **Core Framework:** React 19.x [VERIFIED: npm registry]
*   **Dev Server / Build Tool:** Vite 6.x [VERIFIED: npm registry]
*   **Routing:** React Router (`react-router-dom`) 7.x [VERIFIED: npm registry]
*   **Supabase Client:** `@supabase/supabase-js` 2.x [VERIFIED: npm registry]
*   **Styling:** Vanilla CSS 3 with CSS Custom Properties [VERIFIED: W3C specs]

## Architecture Patterns

### Vite Environment Variable Configuration
To read environment variables from the parent directory and allow custom prefixes:
```js
// web/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '../', // Set env directory to the project root
  envPrefix: ['SUPABASE_', 'VITE_'], // Allow reading SUPABASE_ prefixed variables
})
```

### Supabase Client Setup
Instantiate the Supabase client using environment variables configured through Vite:
```js
// web/src/services/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_KEY are defined in the root .env file.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### CSS Variables & Styling Tokens
We will organize design system variables inside `src/styles/variables.css` and reset/global styles in `src/styles/global.css`:
```css
/* web/src/styles/variables.css */
:root {
  --primary-color: hsl(210, 100%, 50%);
  --background-dark: hsl(220, 15%, 10%);
  --background-light: hsl(220, 15%, 98%);
  --text-dark: hsl(220, 10%, 95%);
  --text-light: hsl(220, 10%, 15%);
  --border-radius: 8px;
  --transition-smooth: all 0.3s ease;
  --shadow-premium: 0 4px 20px rgba(0, 0, 0, 0.15);
}
```

### React Router Setup
We will wrap the application in `BrowserRouter` and establish standard routes:
```jsx
// web/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import TripsList from './views/TripsList'
import TripDetails from './views/TripDetails'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/trips" replace />} />
        <Route path="/trips" element={<TripsList />} />
        <Route path="/trips/:id" element={<TripDetails />} />
      </Routes>
    </Router>
  )
}
export default App
```

## Don't Hand-Roll

*   **Don't hand-roll URL Routing:** Do not write a custom hash or state-based route parser. Use `react-router-dom` for reliable, standard path routing [CITED: reactrouter.com/docs].
*   **Don't duplicate environment configs:** Do not duplicate or parse `.env` files manually. Use Vite's native `envDir` and `envPrefix` configuration [CITED: vite.dev/config/shared-options#envdir].

## Common Pitfalls

*   **Vite Env Cache Issues:** Changes to the root `.env` file are not always picked up by the Vite dev server hot reload. The server must be restarted after modifying environment variables.
*   **Supabase Public Access:** Since v1 lacks authentication, ensure Supabase Row Level Security (RLS) policies permit read access to the relevant tables (`trips`, `rsvps`, `users`) without token authentication, or use the standard anon key if permitted.

## Package Legitimacy Audit

An audit has been performed on all external packages to be installed during this phase:

| Package | Verdict | Reason / Details |
|---------|---------|------------------|
| `react` | OK | Official library for UI components. |
| `react-dom` | OK | Official entry point for DOM rendering. |
| `vite` | SUS | Flagged `too-new` due to recent minor/patch release on npm, but verified as the official Vite bundler package. |
| `@supabase/supabase-js` | SUS | Flagged `too-new` due to recent minor/patch release on npm, but verified as the official Supabase Client package. |
| `react-router-dom` | SUS | Flagged `too-new` due to recent release, but verified as the official React Router package. |

*All SUS packages are confirmed legitimate official packages on npm (checked download metrics and source repo URLs).*

## Validation Architecture

To verify the setup has succeeded, the following checks must be completed:

1.  **Framework Setup Verification:**
    *   `package.json` contains `react`, `react-dom`, `vite`, `react-router-dom`, and `@supabase/supabase-js`.
    *   The `web/` directory contains `index.html`, `vite.config.js`, and `src/main.jsx`.
2.  **Dev Server/Build Verification:**
    *   Running `npm run build` in the `web/` directory completes successfully with exit code 0.
3.  **Supabase Client Verification:**
    *   We will run a test script (`verify-db.js`) in the environment to import `@supabase/supabase-js`, read the parent `.env` file, and execute a `select('id').limit(1)` query against the `trips` table to verify database connectivity.

---

*Phase: 1-Project Setup & Database Wiring*
*Research completed: 2026-07-12*
