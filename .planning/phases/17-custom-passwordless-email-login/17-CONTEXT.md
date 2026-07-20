# Phase 17: Custom Passwordless Email Login - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the custom, database-agnostic passwordless login mechanism:
- User can enter their email on the web splash login page to request a login link.
- Supabase inserts a new token in the `login_tokens` table, triggering a Database Webhook to Resend API.
- Clicking the email link navigates to `/verify?token=...`, verifying the token is valid, not expired, and unused.
- Session is cached in `localStorage` and URL parameters are sanitized immediately.
- User can link/unlink email profiles to/from Telegram user accounts on their profile page.

</domain>

<decisions>
## Implementation Decisions

### Local Testing and Mocking of Email Dispatch
- **D-01:** Direct database query fallback + UI debug link. In development mode (`import.meta.env.DEV`), the splash landing page will display a temporary debug helper banner/link showing the simulated email dispatch link, bypassing the actual email dispatch requirement for quick developer testing.
- **D-02:** Automated E2E verification tests can fetch the verification token directly from the database's `login_tokens` table via SQL queries instead of waiting for/reading emails.

### User Merging Logic for Linking Telegram Accounts
- **D-03:** Deep-link verification: To link an email profile to a Telegram account, the web UI generates a unique verification code link to the Telegram bot (e.g. `https://t.me/TripSyncBot?start=link_<code>`). Clicking this link verifies ownership.
- **D-04:** Cascade data merge: When the bot processes the verification code, it updates the email user's `telegram_id` with the real positive Telegram User ID. If that Telegram ID was already registered in the `users` table as a distinct profile, the bot re-keys all associated RSVPs, expenses, splits, and votes in the database to point to the email user record, then deletes the stale Telegram-only user profile.

### Token Expiration and Validity
- **D-05:** High-entropy UUID token generation for the passwordless link.
- **D-06:** Token is valid for 15 minutes from generation. After verification or expiration, the token is marked as `used = true` in the database.

### Session Handling
- **D-07:** Cache the logged-in user session in `localStorage` under `trip_planner_active_user` (consistent with existing user session context).
- **D-08:** Instantly sanitize the `token` URL query parameter from the browser address bar upon successful landing on the `/verify` route using `window.history.replaceState`.

### The Agent's Discretion
- **D-09:** Exact visual style, CSS classes, and transitions of the landing/splash page email entry form.
- **D-10:** Text and layout of the transactional verification email template sent via Resend.
- **D-11:** Exact formatting and validation regex of the email input field.

</decisions>

<canonical_refs>
## Canonical References

### Scope and Specifications
- `.planning/PROJECT.md` — Current milestone targets, targets and constraints
- `.planning/REQUIREMENTS.md` — Scoped requirements (AUTH-01 through AUTH-04)
- `.planning/ROADMAP.md` — Phase 17 goals and success criteria

### Research Documents
- `.planning/research/ARCHITECTURE.md` — Schema modifications for `users` and `login_tokens` tables, database webhook flow details.
- `.planning/research/SUMMARY.md` §1 — Custom Table-Based Passwordless Auth summary design context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/hooks/useUserSession.jsx`: Existing React Context for caching and managing active user session in `localStorage`.
- `web/src/services/users.js`: Existing services for fetching users by Telegram ID/username and creating web users.

### Established Patterns
- Auto-login check and query param sanitization patterns already exist in `useUserSession.jsx` `useEffect`.
- Postgrest Supabase client queries wrapped in async service functions under `web/src/services/`.

### Integration Points
- `/verify` route to be added inside `web/src/App.jsx` pointing to a new view/component that validates the token and logs the user in.
- Splash login view integration inside `web/src/views/TripsList.jsx` or as a new standalone landing page.

</code_context>

<deferred>
## Deferred Ideas

- SMS verification (SMS-01) — Deferred to future milestones
- Social third-party login (AUTH-05) — Deferred to future milestones

</deferred>

---

*Phase: 17-custom-passwordless-email-login*
*Context gathered: 2026-07-15*
