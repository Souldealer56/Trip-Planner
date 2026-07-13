# Phase 3: Trips List & Details UI Views - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements the frontend UI views and layout components for the Trips List page and the detailed Trip Details view, utilizing the custom data fetching hooks developed in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Theme & Brand Aesthetics
- **D-01:** Implement a Vibrant Slate Dark Theme using deep background tones (`hsl(220, 25%, 8%)`), neon blue primary accents (`hsl(220, 85%, 57%)`), glassmorphism container cards with subtle transparency (`rgba(22, 28, 45, 0.65)`), and micro-interaction glowing borders on hover.

### Card Navigation Routing
- **D-02:** Use semantic React Router `<Link>` elements to wrap each trip card inside the list. This permits standard web navigation features (e.g. middle-click to open in new tab) and supports clean router transitions.

### Curated Localization Formatting
- **D-03:** Format ISO date values into clean, readable date ranges (e.g., `Jul 12 – Jul 18, 2026`) and translate ISO currency codes into standard symbols (e.g., `USD` -> `$`, `EUR` -> `€`, `GBP` -> `£`) for clean display.

### Loading Skeletons & Custom Empty States
- **D-04:** Build custom animated pulsing skeleton loaders (using vanilla CSS `@keyframes pulse`) to represent cards during loading states, and display a customized centered "No Trips Found" suitcase illustration card when the database returns empty sets.

### the agent's Discretion
- **Discretion Area 1:** Specific layout constraints, media query breakpoints (standard desktop vs tablet vs mobile phone layouts).
- **Discretion Area 2:** Visual icon formats (using SVG path drawings or simple emojis).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Framework & Requirements
- [.planning/ROADMAP.md](file:///.planning/ROADMAP.md) — Identifies Phase 3 success conditions and requirements.
- [.planning/REQUIREMENTS.md](file:///.planning/REQUIREMENTS.md) — Details requirements `TRIPS-01`, `TRIPS-02`, `DETAIL-01`, and `DETAIL-02` implemented in this phase.

### Phase 2 Summaries
- [.planning/phases/02-database-data-access-layer/02-01-SUMMARY.md](file:///.planning/phases/02-database-data-access-layer/02-01-SUMMARY.md) — Details read hooks (`useTrips`, `useTripDetails`, `useRsvpRoster`) which this phase will import to load dynamic records.
- [.planning/phases/02-database-data-access-layer/02-02-SUMMARY.md](file:///.planning/phases/02-database-data-access-layer/02-02-SUMMARY.md) — Details user registration mutations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [web/src/hooks/useTrips.js](file:///web/src/hooks/useTrips.js) — Imports hook to load all trips.
- [web/src/hooks/useTripDetails.js](file:///web/src/hooks/useTripDetails.js) — Imports hook to load trip details.
- [web/src/hooks/useRsvpRoster.js](file:///web/src/hooks/useRsvpRoster.js) — Imports hook to load RSVP rosters.
- [web/src/styles/variables.css](file:///web/src/styles/variables.css) — Contains design system color tokens.
- [web/src/styles/global.css](file:///web/src/styles/global.css) — Contains global resets.

### Integration Points
- Views will import services and hooks from `src/services/` and `src/hooks/`.

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

*Phase: 3-Trips List & Details UI Views*
*Context gathered: 2026-07-12*
