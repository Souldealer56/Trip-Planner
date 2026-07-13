# Phase 9: RSVP Nudging & Roster Tracking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 09-RSVP Nudging & Roster Tracking
**Areas discussed:** Nudge Logic & Message Layouts (RSVP seen-member scanning, PollAnswer voter tracking, Organizer majority warnings, intervals)

---

## RSVP Nudging (RSVP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Active Member Scan | (Recommended) Scan DB users and query Telegram's `get_chat_member` to identify active group members who haven't RSVP'd, listing them specifically in the nudge. | ✓ |
| Generic Prompt | Post a generic prompt to the group (e.g., 'Attention group, please update your RSVPs!') without listing names. | |

**User's choice:** Active Member Scan.
**Notes:** The bot will query active members from the users table, check group membership, and output a specific list of un-RSVP'd group members.

---

## Poll Nudging (RSVP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Target Unvoted | (Recommended) Compare committed trip participants with `voter_ids` stored from `PollAnswer` updates, listing the names of committed travelers who haven't voted yet. | ✓ |
| Generic Poll Prompt | Post a generic nudge to the group (e.g., 'Please cast your vote in the Accommodation poll!') without tagging individuals. | |

**User's choice:** Target Unvoted.
**Notes:** Requires a `PollAnswerHandler` to capture votes dynamically and update the `voter_ids` field.

---

## Organizer Majority Nudge (RSVP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Group Chat Tagging | (Recommended) Group chat announcement: Tag/notify the organizer in the group chat, making the progress public to all participants. | ✓ |
| Private DM | Private DM: Send a direct message to the organizer's PM chat with the bot. | |

**User's choice:** Group Chat Tagging.

---

## Nudge Intervals

| Option | Description | Selected |
|--------|-------------|----------|
| Config Constants | (Recommended) Use configuration constants (e.g., 24h RSVP nudge, 48h stale poll) that default to standard production values but can be customized or mocked for unit tests. | ✓ |
| Hardcode Values | Hardcode the production values directly in the loop. | |

**User's choice:** Config Constants.
**Notes:** Configurable constants allow easy validation in unit testing.

---

## the agent's Discretion

- Proposing manual Supabase queries for the `notes` and `last_rsvp_nudge_at` columns.
- UI layout for custom notes display/entry on the React web roster view.
- Scheduling using a native `asyncio` background task loop in `main.py`.
