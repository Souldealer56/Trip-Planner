# Phase 5: Full System Integration & Verification - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase executes final E2E verification, compiling production assets, launching a local dev server, running browser automation to test list pages and blocking profile modals, and cleaning up test database records.

</domain>

<decisions>
## Implementation Decisions

### Dev Server & Browser Subagent E2E Verification
- **D-01:** Spin up the Vite development server on port 5173 inside a background task, and use the `browser_subagent` to browse the app at `http://localhost:5173`. The subagent will click a trip, trigger the profile modal, fill and submit the participant join form, verify user session propagation, and record a video walkthrough to the artifacts folder.

### Database Mutations & Automatic Test Cleanup
- **D-02:** Allow the browser subagent to execute real mutations during the E2E verification run (creating a test participant with a negative `telegram_id` inside the shared Supabase database). After verification completes, run a cleanup script to delete the test user record (cascading to RSVPs) to leave the database clean.

### the agent's Discretion
- **Discretion Area 1:** Specific name used for the test user registered during E2E verification.
- **Discretion Area 2:** Specific duration of sleep statements inside tests to let client actions complete.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Framework & Requirements
- [.planning/ROADMAP.md](file:///.planning/ROADMAP.md) — Defines Phase 5 goals.
- [.planning/REQUIREMENTS.md](file:///.planning/REQUIREMENTS.md) — Lists all milestone requirement checks.

### Previous Phase Summaries
- [.planning/phases/03-trips-list-details-ui-views/03-02-SUMMARY.md](file:///.planning/phases/03-trips-list-details-ui-views/03-02-SUMMARY.md) — Details the visual layouts verified.
- [.planning/phases/04-member-selection-management-ui/04-02-SUMMARY.md](file:///.planning/phases/04-member-selection-management-ui/04-02-SUMMARY.md) — Details modal and registration flows verified.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [web/src/App.jsx](file:///web/src/App.jsx) — Entry point layout.
- [web/src/views/TripsList.jsx](file:///web/src/views/TripsList.jsx) — Entry path.
- [web/src/views/TripDetails.jsx](file:///web/src/views/TripDetails.jsx) — Dynamic detail overlay view.

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

*Phase: 5-Full System Integration & Verification*
*Context gathered: 2026-07-12*
