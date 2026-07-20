# Plan: In-App Activity Log & Notification Feed

Centralize chronological trip activity log updates from bot and web interfaces, rendering a notification feed drawer on the web app.

## User Review Required

> [!IMPORTANT]
> **Database Trigger Migration**: Applying migrations requires database connection passwords (`SUPABASE_DB_PASSWORD`). We will create and run a Python script `scratch/apply_migrations_20.py` to deploy the `activity_log` schema and its database triggers on `rsvps`, `poll_options`, and `expenses`.

## Open Questions

None.

## Proposed Changes

### Database Schema & Migration

#### [NEW] [20-MIGRATIONS.sql](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/phases/20-in-app-activity-log-notification-feed/20-MIGRATIONS.sql)
- Defines the `activity_log` table, its columns, security rules, and Row Level Security (RLS).
- Defines trigger functions and triggers on `rsvps`, `poll_options`, and `expenses`.

#### [NEW] [apply_migrations_20.py](file:///c:/Users/alex_/Documents/Trip%20Planner/scratch/apply_migrations_20.py)
- Migration python script connecting via pg8000 to apply `20-MIGRATIONS.sql` to the database.

---

### Telegram Bot Backend

#### [MODIFY] [main.py](file:///c:/Users/alex_/Documents/Trip%20Planner/main.py)
- Modify `handle_poll_answer` callback to insert an activity log record when a user votes in Telegram.

#### [NEW] [test_notification_feed.py](file:///c:/Users/alex_/Documents/Trip%20Planner/tests/test_notification_feed.py)
- Create unit test cases checking the bot-side voting activity logging behavior.

---

### Web Client

#### [MODIFY] [options.js](file:///c:/Users/alex_/Documents/Trip%20Planner/web/src/services/options.js)
- Update `toggleVote` to insert an activity log record when a user casts or removes a vote on the web app.

#### [MODIFY] [TripDetails.jsx](file:///c:/Users/alex_/Documents/Trip%20Planner/web/src/views/TripDetails.jsx)
- Fetch trip activity logs from the `activity_log` table on mount and when refreshed.
- Track last read log timestamp in `localStorage` under `trip_planner_last_read_log_${tripId}`.
- Render notification bell button with unread count badge in the header card.
- Render right-side slide-out drawer displaying chronological list of activities, relative time metrics, and "NEW" indicators.

#### [NEW] [verify-activity-log.cjs](file:///c:/Users/alex_/Documents/Trip%20Planner/web/verify-activity-log.cjs)
- Integration script checking database inserts and trigger firings for `activity_log`.

## Verification Plan

### Automated Tests
- Run `.\venv\Scripts\pytest tests/test_notification_feed.py` to check bot-side activity logging.
- Run `node web/verify-activity-log.cjs` to test triggers and database schemas.

### Manual Verification
- Open the web client and trigger a new activity (e.g. updating RSVP, pitching an option, logging an expense).
- Confirm the notification bell unread count badge increments.
- Click the bell icon, verify the slide-out drawer appears with the correct description, and the count badge clears.
