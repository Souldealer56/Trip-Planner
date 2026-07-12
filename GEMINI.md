<!-- GSD:project-start source:PROJECT.md -->

## Project

**Trip Planner**

A collaborative trip planning platform consisting of a Telegram bot (TripSync Bot) that handles group chat interactions, RSVP tracking, option pitching, voting, and expenses logging, alongside a new React-based web application for viewing trips and managing participants.

**Core Value:** Provide a seamless, multi-interface collaborative trip planning experience that bridges Telegram group chats with web views.

### Constraints

- **Tech Stack (Bot)**: Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint
- **Tech Stack (Web)**: React + Vite + Vanilla CSS — user preference
- **Authentication**: No authentication in v1 — user request

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- Python 3.13 - All application code (`main.py`)
- None

## Runtime

- Python 3.13
- Virtual environment (`venv`) used for local package isolation
- pip 26.0.1
- Lockfile: None (no `requirements.txt` or `pyproject.toml` present in root)

## Frameworks

- None (Direct Telegram bot application built on `python-telegram-bot`)
- None (No test suite or testing framework configured)
- None

## Key Dependencies

- `python-telegram-bot` 22.7 - Asynchronous wrapper for the Telegram Bot API (handles commands, messaging, conversation states, and polling)
- `supabase` 2.28.3 - Python client for Supabase (handles database interactions with PostgreSQL, connection pooling, and Postgrest queries)
- `python-dotenv` 1.2.2 - Loads environment variables from a local `.env` file
- `urllib` (Standard Library) - Sync HTTP client used inside `asyncio.to_thread` for external API currency rate calls
- `asyncio` (Standard Library) - Async event loop orchestration

## Configuration

- `.env` file (gitignored) - Houses critical credentials
- Required environment variables:
- None

## Platform Requirements

- Any platform (macOS/Windows/Linux) supporting Python 3.13
- Internet access required for connecting to Telegram API and Supabase
- Standard Python 3.13 execution environment (e.g., Virtual Private Server (VPS), cloud hosting with process managers like `systemd` or `supervisord`, or Docker container)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- lowercase all-in-one scripts or kebab-case config files: `main.py` is the single application file.
- **Private Helper Functions:** Prefixed with a single leading underscore (e.g., `_fmt()`, `_parse_price_and_currency()`, `_convert()`, `_get_exchange_rates()`, `_accommodation_coverage()`).
- **Telegram Update/Command Handlers:** Lowercase with snake_case (e.g., `start()`, `roster()`, `add_option()`, `ledger()`, `settle()`).
- **Conversation State Handlers:** Prefixed with `get_` (e.g., `get_title()`, `get_destination()`) or `wiz_` (e.g., `wiz_addopt_cat()`, `wiz_lock_cat()`, `wiz_vote_cat()`).
- **Local Variables:** snake_case (e.g., `trip_id`, `user_data`, `now`, `app_id`).
- **Global Constants:** UPPER_SNAKE_CASE (e.g., `STALE_POLL_HOURS`, `MAJORITY_THRESHOLD`, `TRIP_SELECT`, `ACTION_ADDOPT`).
- **Private Global Constants:** Prefixed with a single leading underscore (e.g., `_COMMON_CURRENCIES`, `_SYMBOL_TO_ISO`, `_ISO_TO_SYMBOL`).
- Type annotations are actively used on parameters and return signatures (e.g., `amount: float`, `currency: str`, `-> str`, `supabase: Client`, `tg_user_id: int`).

## Code Style

- **Tabular Assignment Alignments:** Equals signs are often vertically aligned in consecutive variable definitions to improve readability (e.g., `STALE_POLL_HOURS       = 48`, `STALE_PARTICIPATION    = 0.50`).
- **Section Headers:** Clean visual boundaries separating logical areas using commented hyphen-lines (e.g., `# ---------------------------------------------------------------------------`).
- **Docstrings:** Standard Python triple-quoted docstrings are expected at the top of helper functions to describe inputs, outputs, and behaviors.
- Wrap database interactions and network API calls in `try/except` blocks.
- Non-fatal execution errors are logged or skipped silently to guarantee bot stability (e.g., returning cached exchange rates on `URLError`, or skipping command updates in group setups if a user has not started the bot).
- User-facing error notifications guide the user on how to retry in case of failure.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- **Asynchronous Execution Model:** Fully async handlers built on `python-telegram-bot`'s asynchronous framework.
- **Stateless Application Server:** The bot node stores no conversational or domain state locally; all persistent data is retrieved from and saved to the Supabase database.
- **Dual-Interface Routing:** Supports both private message (PM) wizards (multi-step dialogs) and group chat commands.
- **Dynamic Scope Setup:** Dynamically adjusts bot command menus depending on group context and user role (e.g., elevated permissions for organizers).

## Layers

- Purpose: Configures handlers, registers command scopes, and runs the bot polling loop.
- Key Functions: `main()`, `setup_global_commands(app)`, and `setup_commands_for_group(bot, ...)`.
- File: `main.py` (lines 3156-3229)
- Purpose: Matches incoming Telegram updates (commands, text inputs, callback queries) to the correct controller function.
- Contains: `CommandHandler`, `MessageHandler`, and `CallbackQueryHandler` definitions.
- File: `main.py`
- Purpose: Orchestrates multi-step interactive workflows in PM.
- Key Abstractions:
- File: `main.py`
- Purpose: Encapsulates reusable calculations, external API calls, parsing, and DB reads.
- Key Functions:
- File: `main.py`
- Purpose: Executes CRUD actions against Supabase database tables.
- Client: `supabase` global instance.
- File: `main.py`

## Data Flow

### Command-Line / Event Processing Flow:

### State Management:

- **Relational DB State:** Supabase stores all user, trip, RSVP, poll, option, and ledger records.
- **Conversational State:** PTB `ConversationHandler` tracks conversation states in-memory during active PM wizard flows.
- **FX Rates Cache:** Cached for 1 hour in the bot application's `bot_data` dictionary.

## Key Abstractions

- Purpose: Groups multiple states and handles state transitions.
- Examples: `new_trip_handler` (for trip creation), `pm_wizard_handler` (for trip options/voting/locking/payments).
- Purpose: Resolves user details and active trip details from user and chat IDs.
- Examples: `get_trip_context(tg_user_id, tg_chat_id)` resolves the active trip ID and metadata.
- Purpose: Wraps currency fetching and cross-conversion rates against a USD baseline.
- Key Functions: `_convert()`, `_get_exchange_rates()`.

## Entry Points

- Location: `main.py:L3156 (main())`
- Triggers: Running `python main.py` or executing the `main` entrypoint.
- Responsibilities: Configures all handlers, initializes application dependencies, registers global commands, and starts the polling listener (`app.run_polling()`).

## Error Handling

- Try/catch blocks surrounding database queries (preventing app crashes on database errors).
- Silent recovery inside command setup (e.g., `setup_commands_for_group` skips failures gracefully if group PM scopes cannot be set).

## Cross-Cutting Concerns

- RegExp parsing for currency and price matching (`_parse_price_and_currency`).
- Date parsing validations and date range assertions in `parse_trip_dates` and `smart_parse_dates`.
- Users must have an active record in `users` table linked to their Telegram User ID to perform actions. Command interactions verify user permissions.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| graphify | "Use for any question about a codebase, its architecture, file relationships, or project content — especially when graphify-out/ exists, where the question should be treated as a graphify query first. Turns any input (code, docs, papers, images, videos) into a persistent knowledge graph with god nodes, community detection, and query/path/explain tools." | `.agents/skills/graphify/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
