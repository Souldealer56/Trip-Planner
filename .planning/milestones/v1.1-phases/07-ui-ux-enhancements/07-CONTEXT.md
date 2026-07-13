# Phase 7: UI & UX Enhancements - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the bot's messaging formatting beautiful, consistent, and easy to read. Standardize all bot responses to use uniform HTML formatting styles and establish a consistent set of travel-centric emojis across rosters, options, expense logs, and confirmations.

</domain>

<decisions>
## Implementation Decisions

### Emoji Standardization & Centralization
- **D-01:** Implement a centralized emoji dictionary mapping categories and system modules consistently.
- **D-02:** Use travel-centric emojis: Accommodation 🏠, Flights ✈️, Activities 🎟️, Food 🍴, Transport 🚗, Other ✨, Roster 📋, Budget 📊, Ledger 🧾, Itinerary 📅.

### Typography & HTML Formatting Consistency
- **D-03:** Standardize list layouts to use bullet points (`•`) with bold subject text: e.g., `• <b>[Subject]</b>: [Details]` (applies to `/roster`, `/ledger`, `/budget`, etc.).
- **D-04:** Standardize itinerary list items to block layout format prefixed by their category emoji: e.g., `🏠 <b>Accommodation:</b> Hotel Hilton\n📅 Jul 12 to Jul 15`.

### Alerts, Warnings, and Nudges Visual Cohesion
- **D-05:** Standardize transaction notifications, warnings, and group announcements to use a consistent bold-header layout:
  - Success confirmations: `✅ <b>[Action Name]!</b>\n[Details]`
  - Warnings / Info messages: `⚠️ <b>[Warning Header]</b>\n[Details]` or `ℹ️ <b>[Info Header]</b>\n[Details]`
  - Connection errors: `⚠️ <b>Database Connection Issue</b>\n\n...`

### the agent's Discretion
- Emojis for other standalone actions (like `/help` or minor debug messages) can be configured dynamically by the agent.
- Exact spacing, padding, and message separators.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — Project context and technology constraints
- `.planning/REQUIREMENTS.md` §User Experience (UX) — Scope details and validation rules for UX-01 and UX-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_fmt(amount, currency)` — standard currency formatting helper in `main.py`.
- `_convert(amount, from_iso, to_iso, rates)` — currency conversion helper.

### Established Patterns
- `parse_mode="HTML"` is registered as the default message rendering standard for command handlers.

### Integration Points
- Command handlers `/roster`, `/ledger`, `/settle`, `/budget`, `/itinerary` in `main.py`.
- Confirmations and announcements in PM pitching and logging flows in `main.py`.

</code_context>

<specifics>
## Specific Ideas

- Emojis should be identical between command list lists and output rosters/ledgers.
- Message typography should use bolding uniformly for people's names and item labels.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-UI-UX-Enhancements*
*Context gathered: 2026-07-12*
