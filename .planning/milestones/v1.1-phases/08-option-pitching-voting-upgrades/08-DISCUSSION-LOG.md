# Phase 8: Option Pitching & Voting Upgrades - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 08-Option Pitching & Voting Upgrades
**Areas discussed:** Database Schema Migration, Pitching Wizard Sequence, Hyperlink Presentation, Voting Poll Tallies & Overview

---

## Database Schema Migration

| Option | Description | Selected |
|--------|-------------|----------|
| User SQL Execution | (Recommended) I will run the SQL command in my Supabase SQL Editor: `ALTER TABLE poll_options ADD COLUMN description TEXT;`. Please document it in the migration plan. | ✓ |
| Auto Startup Migration | I want the bot to try to run it automatically on startup (requires a migration runner in Python). | |

**User's choice:** Manual execution in Supabase SQL Editor.
**Notes:** The developer will document the column addition in the implementation plan, and the user will run it in their dashboard before executing the code.

---

## Pitching Wizard Sequence

| Option | Description | Selected |
|--------|-------------|----------|
| Ask After Name | (Recommended) After entering the name: Category -> Name -> Description -> Dates -> Link -> Price. | ✓ |
| Ask After Link | After entering the link: Category -> Name -> Dates -> Link -> Description -> Price. | |

**User's choice:** Prompt for description immediately after option name.
**Notes:** A "Skip description" button will be provided to allow quick bypassing.

---

## Hyperlink Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline Hyperlink | (Recommended) Inline HTML hyperlink on the name directly (e.g., `1. <a href="url">The Beach House</a>`), which keeps the list very clean. | ✓ |
| Separate Line | Kept as a separate line (e.g., `🔗 <a href="url">View listing</a>`). | |
| Both | Both: Hyperlink the name directly AND include a separate link icon line. | |

**User's choice:** Inline HTML hyperlink directly on the option name text.

---

## Voting Poll Tallies & Overview

| Option | Description | Selected |
|--------|-------------|----------|
| Command /polls | (Recommended) Add a new group command `/polls` that lists active polls and their current vote tallies from Telegram. | ✓ |
| Live Message Updates | Automatically update the companion details message in the group chat whenever a vote is cast (requires a PollAnswerHandler to cache votes and edit the text). | |
| Summary on Close | Only print the results summary when a poll is closed/locked. | |

**User's choice:** Add a new group chat command `/polls`.
**Notes:** The command will query active polls in the database and resolve their real-time vote tallies directly from the Telegram Bot API.

---

## the agent's Discretion

- Standard styling of `/polls` command output will match Phase 7 UI guidelines (bullet points, bold names, emoji markers).
- Wording of the wizard prompt messages.
