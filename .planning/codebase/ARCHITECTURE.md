# Architecture

**Analysis Date:** 2026-07-10

## Pattern Overview

**Overall:** Monolithic, Event-Driven Telegram Bot with Stateless Database Backend.

**Key Characteristics:**
- **Asynchronous Execution Model:** Fully async handlers built on `python-telegram-bot`'s asynchronous framework.
- **Stateless Application Server:** The bot node stores no conversational or domain state locally; all persistent data is retrieved from and saved to the Supabase database.
- **Dual-Interface Routing:** Supports both private message (PM) wizards (multi-step dialogs) and group chat commands.
- **Dynamic Scope Setup:** Dynamically adjusts bot command menus depending on group context and user role (e.g., elevated permissions for organizers).

## Layers

**Entry Point & Initialization Layer:**
- Purpose: Configures handlers, registers command scopes, and runs the bot polling loop.
- Key Functions: `main()`, `setup_global_commands(app)`, and `setup_commands_for_group(bot, ...)`.
- File: `main.py` (lines 3156-3229)

**Routing & Handler Layer:**
- Purpose: Matches incoming Telegram updates (commands, text inputs, callback queries) to the correct controller function.
- Contains: `CommandHandler`, `MessageHandler`, and `CallbackQueryHandler` definitions.
- File: `main.py`

**Wizard / Conversation State Layer:**
- Purpose: Orchestrates multi-step interactive workflows in PM.
- Key Abstractions:
  - `new_trip_handler` - wizard for constructing a new trip: `new_trip` → `get_title` → `get_destination` → `get_dates` → `get_currency`.
  - `pm_wizard_handler` - routing and states for option additions (`wiz_addopt_*`), locked selections (`wiz_lock_*`), rsvp queries (`handle_rsvp`), and voting wizards (`wiz_vote_*`).
- File: `main.py`

**Service & Business Logic Helpers:**
- Purpose: Encapsulates reusable calculations, external API calls, parsing, and DB reads.
- Key Functions:
  - Currency conversion: `_fmt`, `_parse_price_and_currency`, `_convert`, `_get_exchange_rates`, `_fetch_rates_sync`.
  - Date parsing: `smart_parse_dates`, `parse_trip_dates`.
  - Db utility: `get_db_user_id`, `get_trip_context`.
- File: `main.py`

**Data Storage Access (Supabase API):**
- Purpose: Executes CRUD actions against Supabase database tables.
- Client: `supabase` global instance.
- File: `main.py`

## Data Flow

### Command-Line / Event Processing Flow:

1. User sends a command or message to the Telegram bot (e.g., `/new_trip`).
2. The Telegram updates loop parses the input.
3. The registered `ConversationHandler` or `CommandHandler` routes the update to the target handler function.
4. The handler queries the Supabase client to fetch current user and trip records (via `get_db_user_id` and `get_trip_context`).
5. Business logic functions are executed to parse inputs (e.g., `parse_trip_dates` or `_parse_price_and_currency`).
6. The handler writes database updates back to Supabase tables (`trips`, `rsvps`, `poll_options`, etc.).
7. An asynchronous reply is sent back to the user with keyboard layouts or text confirmation.

### State Management:
- **Relational DB State:** Supabase stores all user, trip, RSVP, poll, option, and ledger records.
- **Conversational State:** PTB `ConversationHandler` tracks conversation states in-memory during active PM wizard flows.
- **FX Rates Cache:** Cached for 1 hour in the bot application's `bot_data` dictionary.

## Key Abstractions

**Conversation Handler:**
- Purpose: Groups multiple states and handles state transitions.
- Examples: `new_trip_handler` (for trip creation), `pm_wizard_handler` (for trip options/voting/locking/payments).

**Trip Context Resolver:**
- Purpose: Resolves user details and active trip details from user and chat IDs.
- Examples: `get_trip_context(tg_user_id, tg_chat_id)` resolves the active trip ID and metadata.

**FX Rate Converter:**
- Purpose: Wraps currency fetching and cross-conversion rates against a USD baseline.
- Key Functions: `_convert()`, `_get_exchange_rates()`.

## Entry Points

**Bot Execution Entry:**
- Location: `main.py:L3156 (main())`
- Triggers: Running `python main.py` or executing the `main` entrypoint.
- Responsibilities: Configures all handlers, initializes application dependencies, registers global commands, and starts the polling listener (`app.run_polling()`).

## Error Handling

**Strategy:** Exception catching inside handlers, logging error diagnostics, and sending fallback messages to users (such as `"Something went wrong. Please try again."`).

**Patterns:**
- Try/catch blocks surrounding database queries (preventing app crashes on database errors).
- Silent recovery inside command setup (e.g., `setup_commands_for_group` skips failures gracefully if group PM scopes cannot be set).

## Cross-Cutting Concerns

**Validation:**
- RegExp parsing for currency and price matching (`_parse_price_and_currency`).
- Date parsing validations and date range assertions in `parse_trip_dates` and `smart_parse_dates`.

**Authentication:**
- Users must have an active record in `users` table linked to their Telegram User ID to perform actions. Command interactions verify user permissions.

---

*Architecture analysis: 2026-07-10*
*Update when major patterns change*
