# 🎒 TripSync — Collaborative Trip Planner

[![Python 3.13](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot_API-26A5E4?style=flat-square&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![Vite](https://img.shields.io/badge/Vite-v6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

**TripSync** is a collaborative trip planning platform that bridges **Telegram group chats** with a modern **React web application**. It allows group members to plan itineraries, pitch options, vote on choices, track RSVPs, and log shared expenses with automated debt settlements—either directly in Telegram or via the standalone web client.

---

## ✨ Key Features

### ✈️ Dual Interface (Telegram Bot + Web App)
- **Telegram Group Bot**: Interactive PM wizards, inline poll creation, `/roster`, `/budget`, `/ledger`, `/settle`, `/itinerary`, and `/change_rsvp` commands.
- **React Web Application**: Responsive, glassmorphic dark-mode dashboard for visual trip planning and profile management.

### 👥 Roster & Traveler Profiles
- **RSVP Tracking**: Track `Committed`, `Tentative`, and `Declined` statuses with custom notes.
- **Hybrid Account Support**: Works seamlessly for users with Telegram accounts, web-only email profiles, or hybrid linked profiles.
- **Telegram Account Linking**: High-entropy 6-character code link flow to merge Telegram and web travel histories.

### 🗳️ Option Pitching & Voting
- **Categorized Pitching**: Pitch options for Accommodation, Flights, Activities, Food, Transport, and Other categories.
- **Dual Voting**: Vote on choices via Telegram inline polls or web option cards; tallies stay synchronized across both interfaces.

### 🧾 Shared Expense Ledger & Debt Settlement
- **Multi-Currency Expenses**: Log expenses in USD, EUR, GBP, CAD, AUD with automated live exchange rate conversion.
- **Custom Splits**: Split costs equally across all committed members or select specific participants.
- **Minimal Settlement Paths**: Smart debt-minimization algorithm calculates exact net balances and the fewest "who pays whom" transactions.

### 🔗 Shareable Invites & Passwordless Login
- **Magic Link Auth**: Table-based, high-entropy passwordless email login flow.
- **Shareable Trip Links**: Instant shareable invite URLs (`/join/:tripId`) with standalone guest onboarding.

### 🔔 Activity Feed & Notifications
- **Automated Database Triggers**: Postgres triggers automatically record RSVPs, option pitches, and expenses to a central `activity_log` table.
- **Slide-Out Feed Drawer**: Interactive notifications drawer on the web app displaying relative timestamps (`5m ago`, `2h ago`) and unread indicator badges.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Bot Backend** | Python 3.13, `python-telegram-bot` 22.7, `supabase-py`, `python-dotenv`, `pytest` |
| **Web Frontend** | React, Vite, Vanilla CSS (Glassmorphism design system), `react-router-dom` |
| **Database** | Supabase PostgreSQL with Row Level Security (RLS) & PL/pgSQL database triggers |
| **External APIs** | Exchange Rate API (live currency conversion), Resend API (transactional emails) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.13+
- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project with PostgreSQL instance
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### Environment Setup

Create a `.env` file in the root directory:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
BOT_USERNAME=TripSyncBot

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_or_service_key
SUPABASE_DB_PASSWORD=your_database_password
```

### 1. Setting Up the Database

Run the SQL migration scripts in `.planning/phases/*/` or execute the Phase migration scripts to initialize tables (`trips`, `users`, `rsvps`, `poll_options`, `active_polls`, `expenses`, `activity_log`, `login_tokens`).

To apply Phase migrations using python:
```bash
python scratch/apply_migrations_20.py
```

### 2. Running the Telegram Bot

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install python-telegram-bot supabase python-dotenv pg8000 pytest pytest-asyncio
   ```
2. Start the bot listener:
   ```bash
   python main.py
   ```

### 3. Running the React Web Application

1. Navigate to the `web/` directory:
   ```bash
   cd web
   npm install
   ```
2. Start the Vite local development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## 🧪 Running Tests

### Python Backend Unit Tests
```bash
pytest tests/
```

### Integration & Database Verifications
```bash
node web/verify-activity-log.cjs
node web/verify-options-service.cjs
node web/verify-expenses-service.cjs
```

### Building Web Application for Production
```bash
cd web
npm run build
```

---

## 📁 Repository Structure

```
Trip Planner/
├── main.py                    # Telegram bot main application entrypoint
├── scratch/                   # Database migration runners
├── tests/                     # Pytest unit & async test suites
├── web/                       # Standalone React web application
│   ├── src/
│   │   ├── services/          # Supabase API data access layer
│   │   ├── views/             # Trips Dashboard & Trip Details UI components
│   │   ├── utils/             # Currency conversion & date formatting helpers
│   │   └── styles/            # Glassmorphism design system & global CSS
│   └── verify-*.cjs           # Node.js integration test scripts
└── README.md
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
