# Phase 19: Hybrid Bot-Web Coexistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 19-hybrid-bot-web-coexistence
**Areas discussed:** Telegram Profile Auto-Merging, Profile Type Badges, Case-Insensitive Database Queries

---

## Telegram Profile Auto-Merging

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-merge | Automatically link the Telegram profile by updating the existing web profile if a username matches case-insensitively on first bot contact. | ✓ |
| Force manual link | Always require the user to go through the web app profile modal to link their Telegram account. | |

**User's choice:** Auto-merge on first contact.
**Notes:** Prevents duplicate traveler profiles if a user interacts with the bot after registering on the webapp.

---

## Profile Type Badges

| Option | Description | Selected |
|--------|-------------|----------|
| Render badges | Render subtle profile badges (e.g., Telegram icon or Email envelope badge) in the roster and ledger views. | ✓ |
| Uniform rendering | Renders names uniformly without profile badges to maintain a clean layout. | |

**User's choice:** Render subtle profile type badges.
**Notes:** Makes it easy to identify which users are connected via Telegram vs email-only.

---

## Case-Insensitive Database Queries

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive matching | Use case-insensitive matching (ilike) for all user searches by username or email. | ✓ |
| Case-sensitive matching | Use case-sensitive matching to enforce strict casing. | |

**User's choice:** Case-insensitive matching.
**Notes:** Safer matching behavior for usernames and emails.

---

## the agent's Discretion

- Visual asset styles, icons, and placement of traveler profile type badges.
- Confirmation logs and messages returned by the bot upon successful auto-linking.

## Deferred Ideas

- None.
