# Phase 3: Trips List & Details UI Views - Research

## User Constraints

Captured from [03-CONTEXT.md](file:///.planning/phases/03-trips-list-details-ui-views/03-CONTEXT.md):

*   **D-01:** Implement a Vibrant Slate Dark Theme using deep background tones (`hsl(220, 25%, 8%)`), neon blue primary accents (`hsl(220, 85%, 57%)`), glassmorphism container cards with subtle transparency (`rgba(22, 28, 45, 0.65)`), and micro-interaction glowing borders on hover.
*   **D-02:** Use semantic React Router `<Link>` elements to wrap each trip card inside the list. This permits standard web navigation features (e.g. middle-click to open in new tab) and supports clean router transitions.
*   **D-03:** Format ISO date values into clean, readable date ranges (e.g., `Jul 12 – Jul 18, 2026`) and translate ISO currency codes into standard symbols (e.g., `USD` -> `$`, `EUR` -> `€`, `GBP` -> `£`) for clean display.
*   **D-04:** Build custom animated pulsing skeleton loaders (using vanilla CSS `@keyframes pulse`) to represent cards during loading states, and display a customized centered "No Trips Found" suitcase illustration card when the database returns empty sets.

## Project Constraints (from GEMINI.md)

*   **Tech Stack (Bot):** Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint.
*   **Tech Stack (Web):** React + Vite + Vanilla CSS — user preference.
*   **Authentication:** No authentication in v1 — user request.

## Standard Stack

*   **Core UI Library:** React 19.x [VERIFIED: npm registry]
*   **Routing:** React Router (`react-router-dom`) 7.x [VERIFIED: npm registry]
*   **Styling:** Vanilla CSS 3 with HSL custom properties [VERIFIED: W3C specs]

## Architecture Patterns

### Date/Currency Formatter Utility
We will create a clean formatter service in `src/utils/format.js` per D-03:
```javascript
// web/src/utils/format.js
export function formatDateRange(startStr, endStr) {
  if (!startStr || !endStr) return ''
  const start = new Date(startStr)
  const end = new Date(endStr)
  
  const options = { month: 'short', day: 'numeric' }
  const startFmt = start.toLocaleDateString('en-US', options)
  
  // Include year in the end format
  const endFmt = end.toLocaleDateString('en-US', { ...options, year: 'numeric' })
  return `${startFmt} – ${endFmt}`
}

export function formatCurrency(amount, currencyCode) {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$'
  }
  const symbol = symbols[currencyCode] || currencyCode
  return `${symbol}${amount}`
}
```

### Loading Skeleton Layout
We will establish standard pulsing skeleton styles inside `src/styles/global.css` using CSS custom animations per D-04:
```css
/* Pulse animation keyframes */
@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.3; }
  100% { opacity: 0.6; }
}

.skeleton {
  animation: pulse 1.5s ease-in-out infinite;
  background-color: var(--border-light);
  border-radius: var(--border-radius-sm);
  display: block;
}

.skeleton-text {
  height: 16px;
  margin-bottom: 8px;
  width: 100%;
}

.skeleton-title {
  height: 24px;
  margin-bottom: 16px;
  width: 60%;
}
```

### Card Layout with Hover Effects
To achieve premium hover glow borders:
```css
.trip-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-light);
  transition: var(--transition-smooth);
}

.trip-card:hover {
  border-color: var(--primary-light);
  box-shadow: 0 0 15px rgba(56, 122, 255, 0.25);
  transform: translateY(-4px);
}
```

## Don't Hand-Roll

*   **Don't hand-roll CSS Transitions**: Avoid raw inline component state styles for card hovers. Use standard Vanilla CSS stylesheets with classes like `.trip-card` and `.trip-card:hover` to leverage hardware-accelerated animations.
*   **Don't hand-roll standard routing parameters**: Use `react-router-dom`'s native `useParams` inside details views to parse dynamic path parameters (`:id`) [CITED: reactrouter.com/docs/en/main/hooks/use-params].

## Common Pitfalls

*   **Missing Emojis/Icons Support**: If systems don't have emoji fonts installed, simple suitcase or error symbols might look inconsistent. Using inline SVG paths for critical icons (e.g. error exclamation, calendar icon, suitcase) yields a much more premium and consistent visual feel across devices.
*   **CSS Specificity Conflicts**: Since we are using standard Vanilla CSS, naming collisions can occur. We must prefix component stylesheet selectors or import them cleanly to avoid style leakage.

## Package Legitimacy Audit

No new external npm packages are introduced in this phase.

## Validation Architecture

To verify the setup, we will create the following validation checks:

1.  **Vite App Compilation Verification**:
    *   Running `npm run build --prefix web` must pass with exit code 0.
2.  **Visual Checkpoints Verification**:
    *   `web/src/views/TripsList.jsx` must import `useTrips` and render a list wrapper containing `.trip-card` elements when data is loaded.
    *   `web/src/views/TripDetails.jsx` must import `useTripDetails` and `useRsvpRoster` and render participant details.
    *   A manual check will start the dev server to visually confirm that card layout designs match the Vibrant Slate Dark Theme.

---

*Phase: 3-Trips List & Details UI Views*
*Research completed: 2026-07-12*
