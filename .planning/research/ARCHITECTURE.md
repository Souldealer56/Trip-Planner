# Architecture Research

**Domain:** Standalone Webapp & Hybrid Onboarding
**Researched:** 2026-07-14
**Confidence:** HIGH

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              React Web UI                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────┐      ┌────────────────┐      ┌────────────────────────┐ │
│ │ Login/Register │      │ TripsDashboard │      │   Notifications Feed   │ │
│ └───────┬────────┘      └───────┬────────┘      └───────────┬────────────┘ │
│         │                       │                           │              │
├─────────┼───────────────────────┼───────────────────────────┼──────────────┤
│         ▼                       ▼                           ▼              │
│       ┌──────────────────────────────────────────────────────────┐         │
│       │             Global UserSession React Context             │         │
│       │                  (localStorage session)                  │         │
│       └─────────────────────────┬────────────────────────────────┘         │
├─────────────────────────────────┼──────────────────────────────────────────┤
│                                 ▼                                          │
│                  Data Access Layer & Custom Hooks                          │
│        ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐             │
│        │ useAuth      │ │ useTrips     │ │ useNotifications  │             │
│        └──────┬───────┘ └──────┬───────┘ └─────────┬─────────┘             │
│               │                │                   │                       │
│               ▼                ▼                   ▼                       │
│        ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐             │
│        │   auth.js    │ │   trips.js   │ │ notifications.js  │             │
│        └──────┬───────┘ └──────┬───────┘ └─────────┬─────────┘             │
│               └────────────────┼───────────────────┘                       │
│                                ▼                                           │
│                       Supabase Client API                                  │
└────────────────────────────────┼───────────────────────────────────────────┘
                                 │ (Public Schema DB Mutations)
                                 ▼
                    ┌─────────────────────────┐
                    │      PostgreSQL DB      │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │   login_tokens    │  │
                    │  └─────────┬─────────┘  │
                    │            │ (Insert event)
                    │            ▼
                    │  ┌───────────────────┐  │
                    │  │ Database Webhook  │  │
                    │  └─────────┬─────────┘  │
                    └────────────┼────────────┘
                                 │ (Secure POST)
                                 ▼
                     ┌───────────────────────┐
                     │ Transactional Email   │
                     │  (Resend/SendGrid)    │
                     └───────────────────────┘
```

## Database Schema Design

We will introduce two new tables and modify the existing `users` table:

### 1. `users` Table Modifications
Add an `email` column:
- `email` (TEXT UNIQUE, NULLABLE): Allows standalone web users to register/log in via email. Telegram-only users can leave this null.

### 2. `login_tokens` Table (New)
For database-agnostic passwordless login tokens:
- `id` (UUID PRIMARY KEY, DEFAULT gen_random_uuid())
- `email` (TEXT NOT NULL)
- `token` (TEXT UNIQUE NOT NULL)
- `created_at` (TIMESTAMP WITH TIME ZONE, DEFAULT timezone('utc'::text, now()) NOT NULL)
- `expires_at` (TIMESTAMP WITH TIME ZONE NOT NULL)
- `used` (BOOLEAN DEFAULT false NOT NULL)

### 3. `activity_log` Table (New)
For the unified visual notifications feed across both interfaces:
- `id` (UUID PRIMARY KEY, DEFAULT gen_random_uuid())
- `trip_id` (UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE)
- `actor_id` (UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE)
- `activity_type` (TEXT NOT NULL) — e.g. `'pitch'`, `'vote'`, `'expense'`, `'rsvp'`
- `activity_details` (JSONB NOT NULL) — e.g. `{ "option_title": "Hotel", "category": "Accommodation" }`
- `created_at` (TIMESTAMP WITH TIME ZONE, DEFAULT timezone('utc'::text, now()) NOT NULL)

---

## Component & Service Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `UserSessionProvider` | Stores the active session, handles login from token verification, and exposes global context. | Wraps App; loads token check in `useEffect` when landing on `/verify`. |
| `NotificationCenter` | A slide-over drawer or toggleable panel inside `TripDetails` displaying a chronological list of recent activities. | React Component querying `activity_log`. |
| `auth.js` Service | Functions to request login link (inserting row to `login_tokens`) and verify tokens. | Frontend API calling Supabase client. |
| `notifications.js` Service | Methods to fetch activity logs and write new activity events. | Frontend API wrapper. |
| Database Webhook | Listens to `INSERT` on `login_tokens` and routes an API call to the mail provider. | Managed in Supabase / PostgreSQL. |

---

## Data Flows

### 1. Standalone Login / Onboarding Flow
1. User enters their email in the Splash screen.
2. Client generates a cryptographically secure token (`crypto.randomUUID()`) and inserts a row in `login_tokens` with a 15-minute expiry.
3. Supabase triggers a Database Webhook on insert.
4. Webhook posts to Resend API, sending a magic link containing `?token=...` to the user's email.
5. User clicks the link, lands on `/verify`, the webapp validates the token, marks it as `used`, retrieves or creates the `users` profile, caches it in `localStorage`, and logs them in.

### 2. Shareable Join Trip Flow
1. A trip member copies the invite link: `/join/:tripId`.
2. New traveler visits the link. If not logged in, they are prompted to choose a profile or log in/onboard via email.
3. Once logged in, the system registers a committed RSVP for this user for `:tripId` and redirects them to the trip planning dashboard.

### 3. Notification Logs
1. Any mutation (e.g. adding a pitch, voting, creating an expense) writes a record to `activity_log`.
2. The Telegram bot and Webapp both write to `activity_log` upon successful mutations.
3. The `NotificationCenter` fetches these records by `trip_id` and renders them dynamically.

---

## Scalability & Portability

- **Database Portability:** By keeping auth token generation and validation inside standard PostgreSQL tables, the entire logic is 100% database-agnostic. If we migrate away from Supabase, the web hooks can be replaced by standard application-level event listeners or inline service calls.
- **Activity Log Indexes:** As active users log more events, `activity_log` will grow. We will add database indexes on `activity_log.trip_id` and `activity_log.created_at` to keep query execution times under 50ms.

---
*Architecture research for: Standalone Webapp & Hybrid Onboarding*
*Researched: 2026-07-14*
