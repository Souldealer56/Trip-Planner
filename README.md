# 🎒 Trip Planner — Collaborative Trip Planning Web App

[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-v8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![CSS3](https://img.shields.io/badge/Styling-Vanilla_CSS_Glassmorphic-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)

**Trip Planner** is a standalone, web-first collaborative trip planning application. It enables groups of travelers to plan itineraries, pitch and vote on options (lodging, dining, activities, flights), manage participant RSVPs and permissions, visualize schedules on a dynamic Gantt timeline, and split shared expenses with automated debt minimization settlements.

---

## ✨ Key Features

### 🗺️ Visual Trip Cockpit & Gantt Timeline
- **Interactive Itinerary**: Drag-and-drop or date-driven scheduling with automated event overlap detection.
- **Visual Gantt Timeline**: Day-by-day and hour-by-hour timeline visualization for all scheduled trip activities and accommodation coverage.
- **iCalendar (.ics) Export**: One-click download of the finalized itinerary into Apple Calendar, Google Calendar, or Outlook.

### 👥 Participant Roster & Role Permissions
- **RSVP Tracking**: Track `Committed`, `Tentative`, and `Declined` participant statuses with custom preferences.
- **Role Hierarchy**: First-class organizer, co-organizer, and participant roles for managing trip settings and approvals.
- **Shareable Invites**: Instant shareable invite URLs (`/join/:tripId`) for frictionless guest onboarding.

### 🗳️ Option Pitching & Voting
- **Categorized Pitching**: Pitch options for Accommodation, Activities, Food, Flights, Transport, and custom categories.
- **Democratic Voting**: Transparent group voting tallies on proposed options.
- **Option Locking**: Organizers can lock winning choices, automatically reflecting them into the itinerary schedule and budget ledger.

### 🧾 Shared Expense Ledger & Smart Settlement
- **Multi-Currency Ledger**: Log shared expenses in USD, EUR, GBP, CAD, AUD with automated live conversion.
- **Custom Splits**: Split costs equally across all committed members or customize exact splits per participant.
- **Debt Minimization Algorithm**: Computes net balances and the fewest "who pays whom" transactions to settle all debts.

### 🔔 Activity Feed, Notifications & Real-Time Sync
- **Automated Database Triggers**: Centralized activity log tracking RSVPs, pitches, locked options, and expenses.
- **Real-Time WebSocket Sync (`useTripRealtime`)**: Bi-directional live synchronization using Supabase Realtime broadcast channels (`trip-room:<id>`) with automated per-resource debouncing.
- **Slide-Out Notification Drawer**: Real-time notification drawer with relative timestamps and unread badges.

### 🔐 Passwordless Authentication & Database Security
- **Passwordless Magic Links**: Custom magic link authentication via `public.login_tokens` and PostgreSQL `send_magic_link_trigger()` / Resend webhook, verified in `web/src/services/auth.js` (`requestLoginLink`, `verifyLoginToken`) with active user sessions persisted in `localStorage` (`useUserSession`).
- **PostgreSQL Row Level Security (RLS)**: Enforces access control with Row Level Security enabled across all tables (`trips`, `users`, `rsvps`, `poll_options`, `option_votes`, `expenses`, `activity_log`, `grocery_items`, `login_tokens`), using helper functions (`is_trip_admin`, `is_trip_member`) and identity reconciliation triggers (`handle_auth_user_sync`).
- **Public Client Isolation**: Web client code operates strictly via `VITE_SUPABASE_ANON_KEY` without exposing secret service keys.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend Framework** | React 19 (`react`, `react-dom`), React Router v7 (`react-router-dom`) |
| **Build System & Tooling** | Vite 8, `@vitejs/plugin-react`, Oxlint (`oxlint`), Vitest (`vitest`) |
| **Testing & CI/CD** | Vitest, `@testing-library/react`, JSDOM, GitHub Actions CI |
| **Database & Realtime** | Supabase PostgreSQL with Row Level Security (RLS), Triggers & Realtime WebSockets |
| **Client Library** | `@supabase/supabase-js` v2 |
| **Design System** | Bespoke Vanilla CSS (Glassmorphism aesthetic, dark-mode first, CSS variables) |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 22 recommended, 18+ supported)
- npm (version 9 or later)
- A [Supabase](https://supabase.com) project with PostgreSQL instance

### Environment Setup

Create a `.env` file in the project root or in `web/.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_public_anon_key_here
```

### Development & CI Workflow

1. Navigate to the `web/` directory and install dependencies:
   ```bash
   cd web
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

3. Lint the codebase:
   ```bash
   npm run lint
   ```

4. Run unit and UI smoke tests:
   ```bash
   npm test
   ```

5. Build the production bundle:
   ```bash
   npm run build
   ```

### 🤖 Automated Continuous Integration (CI)

Every `push` to `main`/`master` and every `pull_request` triggers an automated GitHub Actions CI pipeline (`.github/workflows/ci.yml`) executing:
1. `npm ci`
2. `npm run lint` (`oxlint`)
3. `npm test` (Vitest offline unit & component smoke tests)
4. `npm run build` (Vite production bundle)

---

## 📁 Repository Structure


```
Trip Planner/
├── web/
│   ├── src/
│   │   ├── assets/        # Visual assets and icons
│   │   ├── components/    # Reusable UI components & Gantt timeline
│   │   ├── hooks/         # Custom React hooks (trips, roster, auth session)
│   │   ├── services/      # Supabase data layer (trips, rsvps, options, expenses)
│   │   ├── styles/        # CSS variables & glassmorphic design system
│   │   ├── utils/         # Currency, schedule engine, ical, and formatters
│   │   ├── views/         # Route pages (Dashboard, Trip Cockpit, Join, Profile)
│   │   ├── App.jsx        # Routing configuration
│   │   └── main.jsx       # React application entrypoint
│   ├── index.html         # HTML template
│   ├── package.json       # Web dependencies and scripts
│   └── vite.config.js     # Vite configuration
├── .env.example           # Example environment configuration
├── GEMINI.md              # Project architectural blueprint & coding guidelines
└── README.md              # Project documentation
```

---

## 📄 License

Distributed under the MIT License.
