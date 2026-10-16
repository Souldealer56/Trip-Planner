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
│   │   ├── rsvps.js      # Participant RSVP states, permissions, roles, presence dates, dietary tags
│   │   ├── options.js    # Pitched options, voting, locked choices, participant assignments, cost types
│   │   ├── groceries.js  # Smart grocery list by aisle, live checks, checkout & expense conversion
│   │   ├── expenses.js   # Expense ledger, custom splits, settlements
│   │   ├── users.js      # User profiles, avatar management
│   │   ├── activity.js   # Activity feed and system notifications
│   │   ├── auth.js       # Passwordless magic links via custom login_tokens & Resend
│   ├── styles/           # CSS design system (variables.css, global.css)
│   ├── utils/            # Pure domain logic:
│   │   ├── currency.js   # Currency conversions, rate caching, option cost breakdown, personal projected cost simulation
│   │   ├── schedule.js   # Event overlap detection, track packing, daily logistics coverage engine
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

2. **Custom Passwordless Auth (`login_tokens` + Resend Trigger) & PostgreSQL Row Level Security (RLS):**
   - Authentication uses the custom `public.login_tokens` table (`requestLoginLink` -> `INSERT INTO public.login_tokens` -> PostgreSQL `send_magic_link_trigger()` via `pg_net` to Resend API -> `/verify?token=...` -> `verifyLoginToken` -> `useUserSession` cached in `localStorage`).
   - **Never drop `public.login_tokens` or `public.send_magic_link_trigger()` in migrations.**
   - All tables enforce strict RLS policies referencing user ID or membership in `rsvps`.
   - Never bypass RLS; all client operations execute under the public `anon` role (`VITE_SUPABASE_ANON_KEY`).

3. **Real-Time Synchronization (`useTripRealtime`):**
   - Interactive trip views leverage `useTripRealtime` to listen for Postgres CDC updates via Supabase WebSocket channels (`trip-room:<id>`).
   - Mutations across `trips`, `rsvps`, `poll_options`, `option_votes`, `active_polls`, `expenses`, `grocery_items`, and `activity_log` are debounced to prevent duplicate network fetches while ensuring instantaneous multi-user state synchronization.

4. **Clean Data Model & First-Class Schema Columns:**
   - Never store system state or flags inside user-facing text columns.
   - **No string tags:** Never encode status tags like `[ARCHIVED]` in trip `vibe` or `description`. Use dedicated columns such as `is_archived` or `status`.
   - **No role tags in notes:** Never place `[CO_ORGANIZER]` or `[ADMIN]` in `rsvps.notes`. Use the first-class `role` column in `rsvps` table (`organizer`, `co_organizer`, `participant`).
   - **No metadata stuffing:** Never stash internal metadata like `_locked_option_id` inside `voter_selections`. Use dedicated relational foreign keys (`locked_option_id` on polls or options).

5. **Smart Trip OS Relational Core & Category Specialization (v4.0):**
   - **Participant Presence & Diet:** `rsvps` stores `arrival_date`, `departure_date`, and `dietary_tags` (`TEXT[]`). Participant presence is determined by date overlap (`getPresentTravelers`).
   - **Option Assignments & Pricing Models:** `poll_options` stores `cost_type` (`split_total`, `per_person`, `per_night`), `assigned_users` (`UUID[]`), and `metadata` (`JSONB`). Logged expenses from options split exclusively among `assigned_users`.
   - **Category Metadata & Intendance:** Category-specific fields (capacities, kitchen presence, flight numbers, meal slots, cooking/cleanup crew, ingredients) reside cleanly in `metadata`. The `grocery_items` table coordinates supermarket runs categorized by aisle.
   - **Daily Logistics Coverage Engine (`analyzeDailyLogisticsCoverage`):** Evaluates daily bed capacity (`🛏️ bedsLocked / presentCount`), transport seats (`🚗 seatsLocked / presentCount`), and meal slot coverage (`🍴 0/3` to `3/3`) against committed travelers present each day. Flags capacity deficits and kitchen mismatches (`hasCookedWithoutKitchen`).
   - **Personal Projected Cost Simulator:** `calculateTripBudgetAnalytics` projects each traveler's individual financial commitment across locked options, computing `actualLoggedShare`, `projectedFromLockedOptions`, and `totalProjectedPersonalCost` while avoiding double-counting converted expenses.

6. **Security & Client Key Constraints:**
   - Never expose `service_role` or secret admin keys in client code or `.env`.
   - Client code strictly uses the public `anon` key (`VITE_SUPABASE_ANON_KEY`) constrained by Row Level Security (RLS) policies in PostgreSQL.

7. **Styling & UI Aesthetics:**
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
