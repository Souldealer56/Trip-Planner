# Phase 18: Shareable Web Invite Links & Standalone Roster Onboarding - Research

**Researched:** 2026-07-17
**Domain:** Shareable Trip Invites & Client Onboarding Routing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Onboarding):** Dual-path onboarding. When an unauthenticated guest lands on `/join/:tripId`, display a card giving them two options:
  1. **Instant Registration (Fast Path):** Enter a First Name and optional Telegram Username to create a traveler profile and join the trip immediately.
  2. **Email Magic Link (Secure Path):** Enter an email to request a secure passwordless login link. Once verified, they are logged in and added to the trip.
- **D-02 (RSVP):** Mark guests joining via invite link as **Tentative** by default. They can modify their RSVP commitment status on the trip details screen.
- **D-03 (UI):** Tooltip or Toast alert. Renders a temporary floating tooltip or toast notification displaying "Invite link copied to clipboard!" that automatically fades out after 2 seconds.

### The Agent's Discretion
- Exact CSS animations and visual transitions for the toast notification and floating tooltip.
- Copy text for helper descriptions on the guest onboarding card/wizard.

### Deferred Ideas (OUT OF SCOPE)
- None.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Copy Link Action | Browser/Client | — | Executes locally via `navigator.clipboard.writeText` |
| Floating Tooltip / Toast Feedback | Browser/Client | — | Managed via local React state timer (2000ms) |
| `/join/:tripId` Route | Browser/Client | — | Routed via React Router DOM |
| Guest Session Detection | Browser/Client | — | Handled by `useUserSession` context |
| Onboarding Instant Registration | Browser/Client | Database/Storage | Calls `createUser` to insert profile in `users` table |
| Onboarding Email Login | Browser/Client | Database/Storage | Inserts new token in `login_tokens` to trigger magic link |
| Roster Auto-Commit | Browser/Client | Database/Storage | Inserts a "Tentative" record in `rsvps` table for the user/trip |

</architectural_responsibility_map>

<research_summary>
## Summary

This phase enables shareable trip invitation links and handles onboarding for guests who do not have an active traveler profile:
1. **Invite Generation:** Users can click a "Copy Invite Link" action in the `TripDetails` view. The app writes `window.location.origin + "/join/" + tripId` to the clipboard. The UI immediately displays a temporary tooltip/toast confirming the copy, which auto-fades after 2 seconds.
2. **Invite Landing View (`/join/:tripId`):**
   - **Authenticated Users:** If the landing user is already signed in, check if they are already in the trip roster. If not, auto-create a `Tentative` RSVP for them, then redirect them to the `/trips/:tripId` dashboard.
   - **Guests (Unauthenticated):** Display a dual-path onboarding panel:
     - **Fast Path:** Enter a first name + optional Telegram username. This calls `createUser`, logs them into the session context, creates a `Tentative` RSVP for this trip, and navigates them to the trip dashboard.
     - **Secure Path:** Enter an email address. This calls `requestLoginLink` to trigger the magic link workflow. We save the target `tripId` in `localStorage` (e.g. `trip_planner_redirect_trip_id`). When the user lands on `/verify` and successfully logs in, the verify route checks for this key, auto-creates the `Tentative` RSVP, clears the key, and redirects to the trip details view.

**Primary recommendation:** Use React Router path parameters to parse `:tripId`. Use `localStorage` to persist the pending invite redirection across email verification loops.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-router-dom` | 6.22.3 | React routing | Standard routing framework in the webapp |
| `@supabase/supabase-js` | 2.43.0 | Supabase client | Direct table queries for users/rsvps |

### Alternatives Considered
- None required; standard DOM API (`navigator.clipboard`) and existing React Router hooks are fully sufficient.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Guest Onboarding & RSVP Flow Diagram

```
       [Unauthenticated landing on /join/:tripId]
                          │
                          ▼
            [Onboarding Selection Card]
             ├── (Fast Path) ──> [Register Name] ──> [Create User] ────┐
             │                                                         │
             └── (Secure Path) ─> [Request Email Link]                 ▼
                                         │                    [Create Tentative RSVP]
                                   (Verifies link)                     │
                                         ▼                             ▼
                                   [/verify Route] ─────────> [Redirect to Trip]
```
</architecture_patterns>

<verification_plan>
## Verification Plan

### Automated Verification
- We can write automated test scripts or run integration tests to check:
  - Route parsing: `/join/:tripId` successfully mounts the onboarding view.
  - Database logic: creating an RSVP with status "Tentative" works correctly.

### Manual Verification
1. Open a browser session, create a trip, and copy the invite link.
2. Verify the copy toast/tooltip fades out cleanly after 2 seconds.
3. Open an Incognito window, paste the invite link, and land on `/join/:tripId`.
4. Run the "Fast Path": Enter a First Name and join. Verify they are added to the roster as "Tentative" and redirected to the trip planner dashboard.
5. Run the "Secure Path": Enter an email, get the login link, click it, and verify that after landing on `/verify` they are added to the roster as "Tentative" and redirected to the trip dashboard.
</verification_plan>

---

*Phase: 18-shareable-web-invite-links-standalone-roster-onboarding*
*Context gathered: 2026-07-17*
