# Phase 11 Discussion Log

**Discussion Date:** 2026-07-13

## Category Selection & Options
- **Area 1:** Option Pitching UI Layout
  - **Options Presented:**
    - Modal Pitching + Tabbed Categories (switch between categories using tabs and open pitching form inside a modal overlay).
    - Inline Pitching + Accordion Categories (forms directly inside each section and expand/collapse categories).
    - Modal Pitching + Stacked list of all categories.
  - **User Selection:** Modal Pitching + Tabbed Categories (D-01, D-03).
- **Area 2:** Voting Mechanics & Rules
  - **Options Presented:**
    - Multi-Option Voting (users can select multiple options per category).
    - Single-Option Voting (only one choice per category).
  - **User Selection:** Multi-Option Voting (D-06).

## Discretion & Architectural Choices
- Web-only option votes will be tracked in the `active_polls` table.
- Maps user UUID -> list of voted option IDs inside the `active_polls.voter_selections` JSONB column.
- Keeps a fast aggregated tally of votes count inside `active_polls.votes_by_option` JSONB column.
