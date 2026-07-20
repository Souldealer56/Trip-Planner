# Phase 18: Shareable Web Invite Links & Standalone Roster Onboarding - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable direct sharing of trips and standalone user registration for a hybrid Telegram/web experience:
- Copy unique invite URLs (`/join/:tripId`) from the trip details view.
- Support a clean onboarding wizard for guests landing on `/join/:tripId` to register instantly or sign in.
- Automatically add verified/onboarded users directly to the trip roster.

</domain>

<decisions>
## Implementation Decisions

### Guest Onboarding Flow
- **D-01:** Dual-path onboarding. When an unauthenticated guest lands on `/join/:tripId`, display a card giving them two options:
  1. **Instant Registration (Fast Path):** Enter a First Name and optional Telegram Username to create a traveler profile and join the trip immediately.
  2. **Email Magic Link (Secure Path):** Enter an email to request a secure passwordless login link. Once verified, they are logged in and added to the trip.

### RSVP Default Status
- **D-02:** Mark guests joining via invite link as **Tentative** by default. They can modify their RSVP commitment status on the trip details screen.

### Clipboard-Copy Feedback UI
- **D-03:** Tooltip or Toast alert. Renders a temporary floating tooltip or toast notification displaying "Invite link copied to clipboard!" that automatically fades out after 2 seconds.

### the agent's Discretion
- Exact CSS animations and visual transitions for the toast notification and floating tooltip.
- Copy text for helper descriptions on the guest onboarding card/wizard.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/PROJECT.md` — Project milestone goals and context.
- `.planning/REQUIREMENTS.md` — Scoped requirements (INV-01, INV-02).
- `.planning/ROADMAP.md` — Phase sequence and success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/hooks/useUserSession.jsx`: Provides React context for global session detection and login/logout methods.
- `web/src/services/users.js` (`createUser`): Can be leveraged to create local user profiles with unique negative `telegram_id`s.
- `web/src/services/auth.js` (`requestLoginLink`): Handles sending magic links for guests choosing the email path.

### Integration Points
- `web/src/App.jsx`: Add the `/join/:tripId` route pattern mapping to a new onboarding view `JoinTrip.jsx`.
- `web/src/views/TripDetails.jsx`: Add the "Copy Invite Link" action button in the trip header or roster card, and implement the copy-to-clipboard function using `navigator.clipboard.writeText`.

</code_context>

<specifics>
## Specific Ideas

- No specific layout references — keep cards and inputs consistent with existing glassmorphism panels.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-shareable-web-invite-links-standalone-roster-onboarding*
*Context gathered: 2026-07-17*
