# Phase 2: Database & Data Access Layer - Discussion Log

## Alternatives Considered

### 1. Data Access Structure
- **Option A (Chosen):** Services layer + Custom React Hooks. Encapsulates all Supabase code in service files and custom hooks. Keeps UI code clean and provides reusable data fetching blocks with loading and error states.
- **Option B:** Direct Supabase queries in components. Simpler layout, but mixes UI logic with data loading, leading to code duplication and harder maintenance.

### 2. Web User Database telegram_id Field
- **Option A (Chosen):** Generate a unique negative integer (`-1000000 - Math.floor(Math.random() * 1000000)`). Since real Telegram user IDs are positive, using negative numbers completely avoids collisions in the database.
- **Option B:** Generate a random positive integer. Risks potential key collisions with real Telegram users synced by the bot.
- **Option C:** Set `telegram_id` to `null`. Assumption that the column is nullable. However, if the column has a NOT NULL constraint, this will fail. Generating negative IDs is safer and more robust.

### 3. Data Refresh Strategy
- **Option A (Chosen):** Combined auto-load on mount + manual refresh header button. Automatically triggers fetch on view render/navigation, and gives users a button to fetch bot updates without a full page refresh.
- **Option B:** Auto-load on navigation only. Fails to allow updating data easily if bot logs RSVPs while user is viewing the page.
- **Option C:** Manual refresh only. Requires explicit user action to load any data initially.

### 4. Error Display
- **Option A (Chosen):** Inline custom error notification card with a "Retry" button. Keeps the app running and provides a premium, friendly feedback loop.
- **Option B:** React Error Boundary. Crashing the layout was deemed too disruptive for a collaborative planning application.

---

*Phase: 2-Database & Data Access Layer*
*Discussion logged: 2026-07-12*
