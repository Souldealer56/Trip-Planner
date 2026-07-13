# Phase 8: Option Pitching & Voting Upgrades - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade option pitching and voting functionality to support URL hyperlinking, optional detail description fields in the PM pitching wizard, and a structured voting overview command displaying native Telegram poll tallies.

</domain>

<decisions>
## Implementation Decisions

### Database Schema Migration
- **D-01:** The `description` column will be manually added to the `poll_options` table via the Supabase Dashboard SQL Editor using the following query:
  `ALTER TABLE poll_options ADD COLUMN description TEXT;`
- **D-02:** The bot codebase will assume the `description` column exists once this phase executes, avoiding runtime dynamic migration attempts.

### Pitching Wizard Sequence Upgrades
- **D-03:** Integrate the optional description prompt into the PM option pitching wizard directly after entering the option's name/title:
  - Sequence: Category Keyboard -> Name -> **Description (Optional)** -> Dates (Optional) -> Link (Optional) -> Price (Optional) -> Save.
- **D-04:** Provide a `Skip description` reply keyboard button to allow users to bypass entering description text easily.

### Hyperlink Formatting in Listings
- **D-05:** Present external URLs as inline HTML hyperlinks directly on the option's name inside companion messages and summaries (e.g. `<b>1. <a href="LINK">Name</a></b>`).
- **D-06:** Format text correctly when no link is provided, showing the name as plain bold text (`<b>1. Name</b>`).

### Voting Poll Tallies & Overview
- **D-07:** Implement a new group chat command `/polls` (or `/voting`) that queries active polls in the database for the current trip.
- **D-08:** Fetch the active poll's state dynamically from Telegram using the Bot API (`context.bot.get_poll(telegram_poll_id)`) to print the current voter count tallies in a structured text overview in the group chat.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — Project context and technology constraints
- `.planning/REQUIREMENTS.md` §Pitching & Voting (PITCH) — Requirement definitions for PITCH-01, PITCH-02, and PITCH-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_escape(text)` — HTML characters sanitizer to prevent Telegram API parsing exceptions.
- `_fmt(amount, currency)` — standard currency formatting helper.

### Established Patterns
- PM Wizard ConversationHandler (`pm_wizard_handler`) in `main.py` routing PM interactions.
- `active_polls` DB table mapping the Telegram poll ID to the trip ID and untruncated option text metadata `poll_options_json`.

### Integration Points
- PM wizard states and entry points in `main.py`.
- New group chat command `/polls` registration in `main.py`.
- Companion message construction logic in `finalize_vote` in `main.py`.

</code_context>

<specifics>
## Specific Ideas

- Ensure inline HTML links are formatted safely using `_escape` on user inputs.
- Clean layout for the `/polls` command output using standard bullet points `•` and bold names, matching Phase 7 UI guidelines.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-Option-Pitching-Voting-Upgrades*
*Context gathered: 2026-07-12*
