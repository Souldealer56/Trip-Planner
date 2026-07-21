---
phase: 23-user-profile-management-page
plan: 1
wave: 1
gap_closure: false
depends_on: []
files_modified:
  - web/src/services/users.js
  - web/src/hooks/useUserSession.js
  - web/src/views/Profile.jsx
  - web/src/App.jsx
  - web/src/views/TripsList.jsx
  - web/src/views/TripDetails.jsx
  - web/verify-profile-page.cjs
  - tests/test_profile_page.py
---

# Phase 23 Plan 1: User Profile Management Page

## Phase Goal
Build a dedicated User Profile page (`/profile`) allowing users to view and update personal profile parameters (First Name, Username, Avatar Accent Color), manage Telegram account linking & unlinking, and switch profiles/sign out, accessible via top navigation header ("👤 My Profile") across main views.

## Tasks

- [ ] Task 1: Add `updateUserProfile` in `web/src/services/users.js` and `updateActiveUser` in `web/src/hooks/useUserSession.js`.
- [ ] Task 2: Build `Profile.jsx` view, add `/profile` route in `App.jsx`, and add top navigation header with `/profile` avatar button across `TripsList.jsx` and `TripDetails.jsx`.
- [ ] Task 3: Build automated Node verification script `web/verify-profile-page.cjs` and Pytest suite `tests/test_profile_page.py`.

## Verification Plan

### Automated Tests
- `node web/verify-profile-page.cjs`
- `pytest tests/test_profile_page.py`
- `npm run build` (in `web/`)
