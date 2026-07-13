# Phase 10: Webapp Trip Creation & RSVP Updates - Context

**Gathered:** 2026-07-13  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase implements trip creation and participant RSVP status updates directly from the React web application, allowing users to start new trips and manage their interest level without the Telegram bot.

</domain>

<decisions>
## Implementation Decisions

### Trip Creation UI & Route
- **D-01:** Implement a "New Trip" button in the `TripsList.jsx` header. Clicking it opens a beautiful modal containing form fields: Title, Destination, Start Date, End Date, and Base Currency.
- **D-02:** Add client-side validation ensuring fields are non-empty and the start date precedes or equals the end date.
- **D-03:** Write a backend service function `createTrip` in `web/src/services/trips.js` to insert the new trip into the Supabase `trips` table. Upon success, redirect the user using React Router to the new trip's details view.

### RSVP Status Management
- **D-04:** Add a status selector dropdown in the `TripDetails.jsx` user session header bar (visible when a user is signed in).
- **D-05:** Write `updateRsvpStatus` in `web/src/services/rsvps.js` to update the status column in the `rsvps` table. Changing status updates the roster list badge in real-time.

### the agent's Discretion
- **Discretion Area 1:** Specific animations and loader designs during form submission.
- **Discretion Area 2:** Error feedback styling for invalid date boundaries.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Framework & Requirements
- [.planning/ROADMAP.md](file:///.planning/ROADMAP.md) — Defines Phase 10 goals.
- [.planning/REQUIREMENTS.md](file:///.planning/REQUIREMENTS.md) — Lists TRIP-03 and RSVP-04 specifications.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [web/src/services/trips.js](file:///web/src/services/trips.js) — Current trip queries.
- [web/src/services/rsvps.js](file:///web/src/services/rsvps.js) — Current RSVP note and join operations.
- [web/src/views/TripsList.jsx](file:///web/src/views/TripsList.jsx) — List layout to add the Trip Creation modal.
- [web/src/views/TripDetails.jsx](file:///web/src/views/TripDetails.jsx) — Detail layout to add the RSVP status dropdown in the header bar.

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

*Phase: 10-Webapp Trip Creation & RSVP Updates*
*Context gathered: 2026-07-13*
