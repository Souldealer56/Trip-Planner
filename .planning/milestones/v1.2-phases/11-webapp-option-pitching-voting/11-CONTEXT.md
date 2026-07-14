# Phase 11: Webapp Option Pitching & Voting - Context

**Gathered:** 2026-07-13  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase implements option pitching and voting in the React web application, allowing users to suggest options (accommodation, activities, transport, etc.) and vote/unvote on them directly from the web interface.

</domain>

<decisions>
## Implementation Decisions

### Category Layout & Navigation
- **D-01:** Render pitched options grouped by categories (Accommodation, Flights, Activities, Food, Transport, Other) inside a tabbed interface. Tabs are aligned horizontally to switch active categories cleanly.
- **D-02:** When the active category tab has no options, display a premium empty state stating "No options pitched for this category yet." with a CTA to pitch one.

### Option Pitching Modal
- **D-03:** Add a "Pitch Option" button visible in the active tab. Clicking it opens a glassmorphic form modal containing fields: Option Name/Title *, Estimated Cost (optional), Currency (optional dropdown), URL Link (optional), and Description (optional).
- **D-04:** Add client-side validations to ensure the Name field is filled and that cost is a valid positive number if provided.
- **D-05:** Submitting the form inserts a new row into the `poll_options` table and immediately refreshes the active category view.

### Voting Mechanics & Storage
- **D-06:** Support Multi-Option Voting—users can vote for multiple pitched options in a category.
- **D-07:** Since the database lacks a dedicated `votes` table, web votes will be persisted in the `active_polls` table. 
  - For each trip and category, we query `active_polls`. If no entry exists, we create one with a null `telegram_poll_id`.
  - We store voter selections in the JSONB column `voter_selections` (mapping user UUID to an array of option IDs they voted for, e.g. `{"user-uuid-1": [12, 15]}`).
  - We aggregate totals in `votes_by_option` JSONB column (mapping option ID to total votes count, e.g. `{"12": 2, "15": 1}`) to fetch vote counts efficiently in a single query.
- **D-08:** Highlight option cards that the active signed-in user has voted for, and provide a toggle button to cast or retract votes.

### the agent's Discretion
- **Discretion Area 1:** Visual animations for category tab transitions.
- **Discretion Area 2:** Accent border overlays on voted option cards.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specifications & Requirements
- [.planning/ROADMAP.md](file:///.planning/ROADMAP.md) — Defines Phase 11 goals.
- [.planning/REQUIREMENTS.md](file:///.planning/REQUIREMENTS.md) — Lists PITCH-04 and PITCH-05 requirements.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [web/src/views/TripDetails.jsx](file:///web/src/views/TripDetails.jsx) — Primary view to add category tabs, option lists, and pitching modal.
- [web/src/styles/global.css](file:///web/src/styles/global.css) — Styling classes for modal overlays, glass cards, and selectors.

### New Components to Create
- [web/src/services/options.js](file:///web/src/services/options.js) — Service client to pitch options, fetch options, fetch active polls, and cast/retract votes.

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

*Phase: 11-Webapp Option Pitching & Voting*
*Context gathered: 2026-07-13*
