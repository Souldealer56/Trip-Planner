# Phase 4: Member Selection & Management UI - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements user session simulation and participant management, enabling users to choose a profile, register new participants, and manage active session details.

</domain>

<decisions>
## Implementation Decisions

### Blocking Profile Selection Modal
- **D-01:** If no active user is set in the session context, display a blocking glassmorphism overlay modal on the Trip Details view. The modal forces the user to select from the current RSVPed participant list or choose to register as a new participant before browsing full trip details.

### Form-to-Mutation Inline Setup
- **D-02:** Provide a "Join Trip as New User" view directly inside the blocking modal. The form prompts for First Name and Telegram Username (optional). Submitting the form calls the `useAddParticipant` hook to create the user/RSVP records, logs the user in as the active user, refreshes the trip roster, and dismisses the modal.

### Application-Level Session Context
- **D-03:** Manage the simulated active user state at the top-level `App.jsx` component and share it using React Context or component props. Display the active user's profile in the page header with a "Switch User / Log Out" link. Clearing the active user resets the state and re-displays the blocking profile selection modal.

### the agent's Discretion
- **Discretion Area 1:** Styling details for the modal container and forms (utilizing Slate Dark styling tokens, inputs borders, spacing).
- **Discretion Area 2:** Storage key name in `localStorage` (`trip_planner_active_user`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Framework & Requirements
- [.planning/ROADMAP.md](file:///.planning/ROADMAP.md) — Outlines Phase 4 goals and criteria.
- [.planning/REQUIREMENTS.md](file:///.planning/REQUIREMENTS.md) — Details requirements `MEMBER-01` and `MEMBER-02` implemented in this phase.

### Phase 2 & 3 Summaries
- [.planning/phases/02-database-data-access-layer/02-02-SUMMARY.md](file:///.planning/phases/02-database-data-access-layer/02-02-SUMMARY.md) — Details `useAddParticipant` hook used to register users.
- [.planning/phases/03-trips-list-details-ui-views/03-02-SUMMARY.md](file:///.planning/phases/03-trips-list-details-ui-views/03-02-SUMMARY.md) — Details the base TripDetails layout that will host the modal and forms.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [web/src/hooks/useAddParticipant.js](file:///web/src/hooks/useAddParticipant.js) — Imports hook to execute user/RSVP mutations.
- [web/src/views/TripDetails.jsx](file:///web/src/views/TripDetails.jsx) — Page view which will host the modal overlay and header session widgets.

</code_context>

<specifics>
## Specific Ideas

- None.

</specifics>

<deferred>
## Deferred Ideas

- None.

</deferred>

---

*Phase: 4-Member Selection & Management UI*
*Context gathered: 2026-07-12*
