# Phase 4: Member Selection & Management UI - Research

## User Constraints

Captured from [04-CONTEXT.md](file:///.planning/phases/04-member-selection-management-ui/04-CONTEXT.md):

*   **D-01:** If no active user is set in the session context, display a blocking glassmorphism overlay modal on the Trip Details view. The modal forces the user to select from the current RSVPed participant list or choose to register as a new participant before browsing full trip details.
*   **D-02:** Provide a "Join Trip as New User" view directly inside the blocking modal. The form prompts for First Name and Telegram Username (optional). Submitting the form calls the `useAddParticipant` hook to create the user/RSVP records, logs the user in as the active user, refreshes the trip roster, and dismisses the modal.
*   **D-03:** Manage the simulated active user state at the top-level `App.jsx` component and share it using React Context or component props. Display the active user's profile in the page header with a "Switch User / Log Out" link. Clearing the active user resets the state and re-displays the blocking profile selection modal.

## Project Constraints (from GEMINI.md)

*   **Tech Stack (Bot):** Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint.
*   **Tech Stack (Web):** React + Vite + Vanilla CSS — user preference.
*   **Authentication:** No authentication in v1 — user request.

## Standard Stack

*   **React hooks state lift**: Lift `activeUser` state to `App.jsx` to pass session details dynamically down to rendering views.
*   **localStorage API**: Standard client storage (`localStorage.getItem`, `setItem`, `removeItem`) for session persistence.

## Architecture Patterns

### React Props Propagated Session State
```javascript
// web/src/App.jsx
import React, { useState } from 'react'

function App() {
  const [activeUser, setActiveUser] = useState(() => {
    const saved = localStorage.getItem('trip_planner_active_user')
    return saved ? JSON.parse(saved) : null
  })

  const login = (user) => {
    localStorage.setItem('trip_planner_active_user', JSON.stringify(user))
    setActiveUser(user)
  }

  const logout = () => {
    localStorage.removeItem('trip_planner_active_user')
    setActiveUser(null)
  }

  return (
    <Router>
      <Routes>
        <Route path="/trips" element={<TripsList activeUser={activeUser} onLogout={logout} />} />
        <Route path="/trips/:id" element={<TripDetails activeUser={activeUser} onLogin={login} onLogout={logout} />} />
      </Routes>
    </Router>
  )
}
```

### Overlay Modal Styling (CSS)
```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(8, 10, 16, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.modal-content {
  max-width: 480px;
  width: 100%;
  padding: 2rem;
  border: 1px solid var(--border-light);
}
```

## Don't Hand-Roll

*   **Don't hand-roll form state**: Use standard standard React controlled input handlers (using `value` and `onChange`) rather than raw DOM selection techniques.
*   **Don't bypass App state lifecycle**: Do not mutate `localStorage` and ignore updating React states, as components won't re-render. Always pair updates with state hooks.

## Common Pitfalls

*   **Empty Roster Modal**: If a trip has no RSVPed members, the profile list will be blank. The modal must check if the roster is empty and automatically display the "Join Trip" form as the default pane, avoiding a blank list presentation.
*   **Input validation**: Form fields should trim whitespaces and validate that `firstName` is non-empty before initiating mutations.

## Package Legitimacy Audit

No new external npm packages are introduced in this phase.

## Validation Architecture

1.  **Vite App Build**:
    *   Running `npm run build --prefix web` verifies all modules resolve and compile.
2.  **Visual Checkpoint**:
    *   Trip Details must display a blocking modal panel when no active user is set.
    *   The header should display the active user's first name when selected.

---

*Phase: 4-Member Selection & Management UI*
*Research completed: 2026-07-12*
