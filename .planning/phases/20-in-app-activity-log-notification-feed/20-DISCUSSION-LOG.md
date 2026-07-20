# Phase 20: In-App Activity Log & Notification Feed - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 20-in-app-activity-log-notification-feed
**Areas discussed:** Notification Feed display, Unread Count calculation, Logging Architecture

---

## Notification Feed Display

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-out right-side drawer | A premium, glassmorphic slide-out panel toggled by a notification bell icon in the header. | ✓ |
| Inline Tab | Add a new "Activity Log" tab next to the Roster and Ledger panels. | |

**User's choice:** Slide-out right-side drawer.

---

## Unread Count Calculation

| Option | Description | Selected |
|--------|-------------|----------|
| LocalStorage Timestamp | Store the last-read timestamp in LocalStorage and highlight any activity logs created after it. Clearing happens when the drawer is opened. | ✓ |
| Simple Session Cache | Track read state in React state only (resets on page reload). | |

**User's choice:** LocalStorage last-read timestamp.

---

## Logging Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid Logging | Database triggers for RSVPs, Options, and Expenses (guaranteeing capture from bot and web), and code-level log inserts for Votes. | ✓ |
| Pure Code-Level | Manually write insert statements in all Python bot command handlers and React service endpoints. | |

**User's choice:** Hybrid database triggers + code-level inserts.

---

## the agent's Discretion

- Custom text formatting for trigger-generated description strings.
- Visual animations, transitions, and layout details for the notification drawer.

## Deferred Ideas

- None.
