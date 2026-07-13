# Phase 4: Member Selection & Management UI - Discussion Log

## Alternatives Considered

### 1. User Selection Presentation
- **Option A (Chosen):** Blocking profile selection modal. When no active user is configured, a blocking modal forces the user to select an existing participant profile or join as a new user. This structure ensures every user browsing a trip's details is associated with a specific profile.
- **Option B:** Inline "Join as this User" links. Simpler layout, but allows browsing detail pages anonymously, which complicates member interactions.

### 2. Participant Registration Flow
- **Option A (Chosen):** Inline Join Form with auto-login. Integrates the form directly in the modal workspace. Submitting registers the user and logs them in, closing the modal.
- **Option B:** Separate page routing. Navigating away to `/trips/:id/join` degrades SPA fluid layout.

### 3. Session State Access
- **Option A (Chosen):** App-level State / Context. Lifting the `activeUser` state to `App.jsx` ensures all headers, action inputs, and badges react immediately to login/logout changes without requiring manual page refreshes.
- **Option B:** Ad-hoc localStorage fetches. Requires page reloads to sync visual states across pages.

---

*Phase: 4-Member Selection & Management UI*
*Discussion logged: 2026-07-12*
