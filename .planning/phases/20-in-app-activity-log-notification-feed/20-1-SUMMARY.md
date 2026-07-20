---
phase: 20
plan: 1
subsystem: notification-feed
tags: [activity-log, notifications, triggers, rls, react-drawer]
requires: [HYB-01, HYB-02, HYB-03]
provides: [NOTIF-01, NOTIF-02]
affects: [web-ui, bot-backend, database]
tech-stack:
  added: []
  patterns: [database-triggers, slideout-drawer, relative-time-formatting]
key-files:
  created:
    - .planning/phases/20-in-app-activity-log-notification-feed/20-MIGRATIONS.sql
    - scratch/apply_migrations_20.py
    - tests/test_notification_feed.py
    - web/src/services/activity.js
    - web/verify-activity-log.cjs
  modified:
    - main.py
    - web/src/services/options.js
    - web/src/utils/format.js
    - web/src/views/TripDetails.jsx
key-decisions:
  - Centralized activity logging using database triggers on rsvps, poll_options, and expenses.
  - Added explicit activity_log insertions for option voting in both Telegram bot and web application.
  - Rendered a right-side slide-out drawer on the web app with relative time indicators and unread count badges.
requirements: [NOTIF-01, NOTIF-02]
completed: 2026-07-20T14:41:00Z
coverage:
  - deliverable: Centralized Activity Log Database Triggers & RLS
    verification:
      ref: web/verify-activity-log.cjs
      kind: automated-test
      status: pass
    human_judgment: false
  - deliverable: Telegram Bot Voting Activity Logging
    verification:
      ref: tests/test_notification_feed.py
      kind: automated-test
      status: pass
    human_judgment: false
  - deliverable: Web Client Activity Feed & Slide-out Drawer
    verification:
      ref: web/src/views/TripDetails.jsx
      kind: visual-ui
      status: pass
    human_judgment: true
    rationale: Notification bell badge and slide-out drawer verified via build compilation and database trigger queries.
---

# Phase 20 Plan 1: In-App Activity Log & Notification Feed Summary

Centralized trip activity log updates from bot and web interfaces, rendering a notification feed drawer on the web app.

## Accomplishments

1. **Database Schema & Triggers (`20-MIGRATIONS.sql`, `apply_migrations_20.py`)**:
   - Created `activity_log` table with RLS enabled.
   - Implemented database triggers on `rsvps` (`trg_log_rsvp`), `poll_options` (`trg_log_option`), and `expenses` (`trg_log_expense`) to automatically log activity whenever a user updates RSVP, pitches an option, or logs an expense.

2. **Telegram Bot Integration (`main.py`, `test_notification_feed.py`)**:
   - Updated `handle_poll_answer` callback in `main.py` to record an entry in `activity_log` when users vote or retract votes in Telegram polls.
   - Added unit test suite in `tests/test_notification_feed.py` verifying bot-side voting activity logging.

3. **Web Client Activity Feed (`options.js`, `activity.js`, `format.js`, `TripDetails.jsx`)**:
   - Created `fetchActivityLogs` service in `web/src/services/activity.js`.
   - Updated `toggleVote` in `options.js` to log option voting events.
   - Added `formatRelativeTime` helper in `format.js` to display relative timestamps (`5m ago`, `2h ago`, `1d ago`).
   - Integrated notification bell button with unread count badge in `TripDetails.jsx` header.
   - Implemented right-side slide-out Activity Feed drawer with `NEW` badges and persistent `localStorage` last-read tracking.

4. **Integration Testing & Build Verification (`verify-activity-log.cjs`)**:
   - Verified end-to-end trigger firings and DB queries via `node web/verify-activity-log.cjs`.
   - Confirmed frontend compilation with `npm run build`.

## Self-Check: PASSED
