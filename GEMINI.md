# Trip Planner — Project Context & Architectural Guidelines

## Project

**Trip Planner** is a 100% standalone, web-first collaborative trip planning application. It allows groups of travelers to coordinate itineraries, pitch and vote on options (accommodations, activities, meals, transport), track participant RSVPs, schedule events on a visual Gantt timeline, and log shared expenses with automated debt minimization settlements.

**Core Value:** Provide an intuitive, real-time, responsive web interface for frictionless group trip coordination without reliance on third-party messaging bots or external chat apps.

---

## Technology Stack

- **Frontend Framework:** React 19 (`react`, `react-dom`)
- **Build Tool & Dev Server:** Vite 8 (`vite`, `@vitejs/plugin-react`)
- **Routing:** React Router v7 (`react-router-dom`)
- **Database & Auth Client:** Supabase JS v2 (`@supabase/supabase-js`)
- **Database Backend:** PostgreSQL (Supabase) with Row Level Security (RLS) & Triggers
- **Styling:** Vanilla CSS with custom design tokens (`variables.css`, `global.css`) adopting a glassmorphic aesthetic
- **Linting:** Oxlint (`oxlint`)

---

## Architecture & Directory Structure

All frontend application code resides under the `web/` directory:

```
web/
├── src/
│   ├── assets/           # Static images, SVG icons, and hero art
│   ├── components/       # Reusable UI elements, modals, and Gantt charts (e.g., GanttTimeline.jsx)
│   ├── hooks/            # Custom React state and data-fetching hooks (useTrips, useTripDetails, useRsvpRoster, useUserSession, useAddParticipant, useTripRealtime)
│   ├── services/         # Supabase data access layer:
│   │   ├── supabase.js   # Supabase client initialization (anon key + RLS)
│   │   ├── trips.js      # Trip CRUD, archiving, status management
│   │   ├── rsvps.js      # Participant RSVP states, permissions, roles
│   │   ├── options.js    # Pitched options, voting, locked choices
│   │   ├── expenses.js   # Expense ledger, custom splits, settlements
│   │   ├── users.js      # User profiles, avatar management
│   │   ├── activity.js   # Activity feed and system notifications
│   │   └── auth.js       # Native Supabase Auth session & OTP magic links
│   ├── styles/           # CSS design system (variables.css, global.css)
│   ├── utils/            # Pure domain logic:
│   │   ├── currency.js   # Currency conversions & rate caching
│   │   ├── schedule.js   # Event overlap detection & scheduling logic
│   │   ├── ical.js       # iCalendar export generators (.ics)
│   │   └── format.js     # Date, time, and currency formatting helpers
│   ├── views/            # Route-level views:
│   │   ├── TripsList.jsx     # Dashboard of active and past trips
│   │   ├── TripDetails.jsx   # Core trip cockpit (Overview, Itinerary, Options, Ledger, Roster)
│   │   ├── JoinTrip.jsx      # Shareable invite onboarding flow
│   │   ├── Profile.jsx       # User profile & preferences
│   │   └── VerifyLogin.jsx   # Magic link authentication handler
│   ├── App.jsx           # Root layout and router configuration
│   └── main.jsx          # DOM entrypoint
├── verify-*.cjs          # Node.js integration & verification test scripts
├── vite.config.js        # Vite configuration
└── package.json          # Web dependencies and scripts
supabase/migrations/      # Versioned SQL migrations and RLS policies
```

---

## Core Coding & Architectural Rules

1. **Pure Web-First Architecture:**
   - Never use or reference Telegram IDs (`tg_user_id`, `tg_chat_id`), bot polling, Telegram Bot APIs, or Python scripts.
   - The application is 100% web-first and interacts directly with Supabase via `@supabase/supabase-js`.

2. **Native Supabase Auth & PostgreSQL Row Level Security (RLS):**
   - Authentication is handled exclusively through Supabase Auth (`supabase.auth`) with standard UUID-based user IDs (`auth.uid()`).
   - All tables enforce strict RLS policies referencing `auth.uid() = user_id` or membership in `rsvps`.
   - Never bypass RLS; all client operations execute under the public `anon` role (`VITE_SUPABASE_ANON_KEY`).

3. **Real-Time Synchronization (`useTripRealtime`):**
   - Interactive trip views leverage `useTripRealtime` to listen for Postgres CDC updates via Supabase WebSocket channels (`trip-room:<id>`).
   - Mutations across `trips`, `rsvps`, `poll_options`, `option_votes`, `active_polls`, `expenses`, and `activity_log` are debounced to prevent duplicate network fetches while ensuring instantaneous multi-user state synchronization.

4. **Clean Data Model & First-Class Schema Columns:**
   - Never store system state or flags inside user-facing text columns.
   - **No string tags:** Never encode status tags like `[ARCHIVED]` in trip `vibe` or `description`. Use dedicated columns such as `is_archived` or `status`.
   - **No role tags in notes:** Never place `[CO_ORGANIZER]` or `[ADMIN]` in `rsvps.notes`. Use the first-class `role` column in `rsvps` table (`organizer`, `co_organizer`, `participant`).
   - **No metadata stuffing:** Never stash internal metadata like `_locked_option_id` inside `voter_selections`. Use dedicated relational foreign keys (`locked_option_id` on polls or options).

5. **Security & Client Key Constraints:**
   - Never expose `service_role` or secret admin keys in client code or `.env`.
   - Client code strictly uses the public `anon` key (`VITE_SUPABASE_ANON_KEY`) constrained by Row Level Security (RLS) policies in PostgreSQL.

6. **Styling & UI Aesthetics:**
   - Maintain the bespoke Vanilla CSS Glassmorphism design system (`global.css`, `variables.css`).
   - Avoid generic browser styles. Use modern typography, vibrant accent gradients, translucent card surfaces with backdrop filters, and subtle micro-interactions.

---

## Development & CI Workflow

- **Install dependencies:** `cd web && npm install`
- **Development server:** `npm run dev` (starts on `http://localhost:5173`)
- **Lint code:** `npm run lint` (`oxlint`)
- **Run tests:** `npm test` (`vitest run` with Vitest + JSDOM smoke & unit suite)
- **Build production bundle:** `npm run build` (`vite build`)
- **Automated CI:** GitHub Actions executes lint, unit/smoke tests, and build on all pushes and PRs (`.github/workflows/ci.yml`).
