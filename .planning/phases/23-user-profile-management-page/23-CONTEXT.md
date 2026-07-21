# Phase 23: User Profile Management Page - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a dedicated User Profile page (`/profile`) allowing users to view and update personal profile parameters (First Name / Display Name, Username, Avatar Accent Color / Initials badge), manage Telegram account linking & unlinking, and switch profiles / sign out. Include a top navigation header with user avatar button ("👤 My Profile") across main views (`TripsList.jsx` and `TripDetails.jsx`).

</domain>

<decisions>
## Implementation Decisions

### Navigation & Header Access
- **D-01:** Add a top navigation header bar (`Navbar.jsx` or header section) featuring the user's avatar button ("👤 My Profile") across main application views (`TripsList.jsx` and `TripDetails.jsx`) linking to `/profile`.

### Profile Customization & Parameters
- **D-02:** Allow users to edit their First Name / Display Name, Username, and Avatar Accent Color / Initials badge on `/profile`.
- **D-03:** Validate username uniqueness using existing `checkUsernameAvailable` service function before saving profile updates.

### Telegram & Account Management
- **D-04:** Render a dedicated "Telegram Account" glassmorphic card on `/profile` displaying:
  - Account status badge (Linked vs Web/Email profile)
  - Linked Telegram ID / Username
  - 1-click Link Code generator modal for unlinked email accounts
  - "Disconnect Telegram" button for linked accounts
  - "Sign Out / Switch Profile" action button

### Agent's Discretion
- Avatar color presets (palette of 6-8 vibrant accent colors).
- Toast messages on profile save success.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/REQUIREMENTS.md` — Requirements `PROF-01`, `PROF-02`
- `web/src/hooks/useUserSession.js` — Global user session management
- `web/src/services/users.js` — User profile update, username check, and Telegram deep link code services
- `web/src/App.jsx` — Router definitions (`/profile`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useUserSession`: Houses `activeUser`, `login`, `logout`, and session persistence.
- `web/src/services/users.js`: `generateTelegramLinkCode`, `disconnectTelegram`, `checkUsernameAvailable`.
- Glassmorphic CSS design tokens (`glass-card`, `btn`, `input-field`, `badge`).

### Established Patterns
- Auto-redirect unauthenticated users to `/trips` or splash screen.
- Supabase `.from('users').update({ first_name, username, avatar_color }).eq('id', activeUser.id)` pattern.

### Integration Points
- `App.jsx`: Add `<Route path="/profile" element={<Profile />} />`.
- `TripsList.jsx` & `TripDetails.jsx`: Include top navigation header with `/profile` button.

</code_context>

<specifics>
## Specific Ideas

- Avatar badge displays initials (e.g. "AS") with customizable background accent color.
- Success toast notification ("Profile updated successfully!") when saving changes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed strictly within phase scope.

</deferred>

---

*Phase: 23-User Profile Management Page*
*Context gathered: 2026-07-20*
