# Phase 2: Database & Data Access Layer - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements the database data access services and React custom hooks for retrieving trips, querying trip participants/RSVPs, and creating new users/RSVPs when they join a trip from the web app.

</domain>

<decisions>
## Implementation Decisions

### Data Access Layer Abstraction
- **D-01:** Plain database operations will be encapsulated inside a structured service layer (`web/src/services/trips.js`, `web/src/services/rsvps.js`, `web/src/services/users.js`) and exposed to React visual components via custom hooks (e.g. `useTrips`, `useTripDetails`, `useRsvpRoster`) rather than putting Supabase query calls inline in components.

### Web-User ID Collision Prevention
- **D-02:** When a user registers / joins a trip from the web application, the data service must generate a unique negative integer `telegram_id` (e.g. `-1000000 - Math.floor(Math.random() * 1000000)`) to ensure zero database key collisions with real positive Telegram User IDs synced by the bot.

### Data Loading & Refresh Strategy
- **D-03:** Since real-time synchronization is out of scope, the frontend will use a combined approach: automatically query/refresh data on route navigation, and provide a premium "Refresh" header button to manually trigger fresh database fetches.

### User-Friendly Inline Error Handling
- **D-04:** Network or query execution failures must be handled gracefully by displaying custom inline glassmorphism error notification cards inside the page layout that include a "Retry" button, rather than crashing the interface.

### the agent's Discretion
- **Discretion Area 1:** Structure of custom hook response shapes (can include standard status strings like `loading`, `error`, and `data`).
- **Discretion Area 2:** Specific directory paths within `web/src/services/` and `web/src/hooks/` to house service files and hooks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Framework & Requirements
- [.planning/ROADMAP.md](file:///.planning/ROADMAP.md) — Defines phase goals, requirements, and completion criteria.
- [.planning/REQUIREMENTS.md](file:///.planning/REQUIREMENTS.md) — Details requirements `TRIPS-01`, `TRIPS-02`, `DETAIL-01`, `DETAIL-02`, `MEMBER-01`, `MEMBER-02` targeted in this phase.

### Phase 1 Summaries
- [.planning/phases/01-project-setup-database-wiring/01-01-SUMMARY.md](file:///.planning/phases/01-project-setup-database-wiring/01-01-SUMMARY.md) — Completed project layout details.
- [.planning/phases/01-project-setup-database-wiring/01-02-SUMMARY.md](file:///.planning/phases/01-project-setup-database-wiring/01-02-SUMMARY.md) — Setup details for the `@supabase/supabase-js` client config.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [web/src/services/supabase.js](file:///web/src/services/supabase.js) — Reuses the initialized Supabase client database handler.

### Established Patterns
- **Database Tables**: The bot inserts/queries `users`, `trips`, `rsvps`, and other tables. The web app data layer will fetch from and mutate these exact tables.

### Integration Points
- Custom hooks will import the `supabase` instance from `web/src/services/supabase.js`.

</code_context>

<specifics>
## Specific Ideas

- None.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Database & Data Access Layer*
*Context gathered: 2026-07-12*
