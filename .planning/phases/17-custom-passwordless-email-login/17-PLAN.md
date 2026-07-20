---
phase: 17
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/services/auth.js
  - web/src/App.jsx
  - web/src/hooks/useUserSession.jsx
  - web/src/views/VerifyLogin.jsx
  - main.py
  - tests/test_auth_link.py
  - web/verify-auth-flow.cjs
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
user_setup: []
must_haves:
  truths:
    - "User can request login link, which inserts to login_tokens table"
    - "Verifying token logs user in, sets localStorage, and sanitizes url parameter"
    - "Deep-linking from webapp to Telegram bot verifies ownership and merges user profiles atomically in database"
  artifacts:
    - "web/src/services/auth.js"
    - "web/src/views/VerifyLogin.jsx"
    - "tests/test_auth_link.py"
    - "web/verify-auth-flow.cjs"
---

<objective>
Implement custom passwordless email authentication, verification logic, and Telegram-to-email profile merging. 
This includes creating the `login_tokens` table, a postgres webhook trigger to dispatch mail, client-side session handlers, splash entry view, deep-link code generators, bot link-code interceptors, and a cascade data merge PostgreSQL function to consolidate histories when linking accounts.
</objective>

<execution_context>
@.agents/gsd-core/workflows/execute-plan.md
@.agents/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/17-custom-passwordless-email-login/17-CONTEXT.md
@.planning/phases/17-custom-passwordless-email-login/17-RESEARCH.md
@.planning/phases/17-custom-passwordless-email-login/17-UI-SPEC.md
@.planning/phases/17-custom-passwordless-email-login/17-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Set up SQL migrations for login_tokens, merge_users function, and trigger webhook</name>
  <files>web/verify-auth-flow.cjs</files>
  <read_first>.planning/phases/17-custom-passwordless-email-login/17-RESEARCH.md</read_first>
  <action>
    Create the SQL statements to update the database schema:
    1. Create table `login_tokens` with columns: `id` (UUID default gen_random_uuid()), `email` (TEXT), `token` (TEXT), `created_at` (TIMESTAMPTZ default now()), `expires_at` (TIMESTAMPTZ), and `used` (BOOLEAN default false).
    2. Add `email` column to `users` table: `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE`.
    3. Create database function `public.merge_users(target_id UUID, stale_id UUID)` in plpgsql to atomically merge RSVPs, expenses, splits, and votes, transfer Telegram account information, and delete the stale Telegram-only user profile.
    4. Create postgres trigger/webhook to send email via Resend API on token insert using `pg_net`'s `net.http_post()`.
    Deploy these updates to the database by executing them (e.g. via direct query tool or writing a one-time SQL migration executor).
    Create the stub file `web/verify-auth-flow.cjs` to test that the `login_tokens` table is online and querying successfully.
  </action>
  <verify>
    Run: `node web/verify-auth-flow.cjs` (checks if database tables and functions are accessible)
  </verify>
  <acceptance_criteria>
    - `login_tokens` table is created in Supabase public schema
    - `users` table has `email` column added
    - `merge_users` function is compiled and created in database
    - Database verification script connects and passes schema checks
  </acceptance_criteria>
  <done>Database schemas, merge trigger, and webhook dispatch are deployed and validated.</done>
</task>

<task type="auto">
  <name>Task 2: Create automated Pytest and E2E Node verification stubs (Wave 0)</name>
  <files>tests/test_auth_link.py, web/verify-auth-flow.cjs</files>
  <read_first>.planning/phases/17-custom-passwordless-email-login/17-VALIDATION.md</read_first>
  <action>
    Create test files:
    1. `tests/test_auth_link.py` containing basic python pytest test stubs that import bot handlers or simulate start commands to confirm pytest framework runs the test.
    2. Expand `web/verify-auth-flow.cjs` to add placeholder functions checking insertion and validation of login tokens in the database.
  </action>
  <verify>
    Run: `pytest tests/test_auth_link.py` and `node web/verify-auth-flow.cjs`
  </verify>
  <acceptance_criteria>
    - `tests/test_auth_link.py` runs with pytest successfully
    - `web/verify-auth-flow.cjs` runs successfully with node
  </acceptance_criteria>
  <done>Wave 0 verification test stubs are established.</done>
</task>

<task type="auto">
  <name>Task 3: Implement client-side auth.js service and configure verify route</name>
  <files>web/src/services/auth.js, web/src/App.jsx</files>
  <read_first>web/src/services/supabase.js, web/src/App.jsx</read_first>
  <action>
    1. Create `web/src/services/auth.js`. Implement `requestLoginLink(email)` (inserts token into `login_tokens` and returns generated token) and `verifyLoginToken(token)` (validates token is unused, unexpired, marks used, and resolves or creates traveler profile).
    2. Add route `/verify` to `web/src/App.jsx` pointing to a new view `VerifyLogin`.
  </action>
  <verify>
    Run: `npm run build --prefix web`
  </verify>
  <acceptance_criteria>
    - `web/src/services/auth.js` exports `requestLoginLink` and `verifyLoginToken`
    - `/verify` route is configured in React Router inside `App.jsx`
  </acceptance_criteria>
  <done>Authentication services and router verify endpoint are implemented.</done>
</task>

<task type="auto">
  <name>Task 4: Implement splash login views and verify route controller</name>
  <files>web/src/views/VerifyLogin.jsx, web/src/views/TripsList.jsx, web/src/hooks/useUserSession.jsx</files>
  <read_first>web/src/views/TripsList.jsx, web/src/hooks/useUserSession.jsx, .planning/phases/17-custom-passwordless-email-login/17-UI-SPEC.md</read_first>
  <action>
    1. Create `web/src/views/VerifyLogin.jsx`. Implement component that reads `token` URL param, calls `verifyLoginToken` service, updates session `login(user)`, and redirects to `/trips` on success. Show loading, success, and error UI as specified in `17-UI-SPEC.md`.
    2. Update `web/src/views/TripsList.jsx` to show a login screen overlay if there is no active session (`activeUser` is null). The login view contains an email input field and "Request Login Link" CTA.
    3. In development mode (`import.meta.env.DEV`), display a temporary debug link on screen containing the generated verification link so local developers can click it to skip transactional mail routing.
  </action>
  <verify>
    Run: `npm run build --prefix web`
  </verify>
  <acceptance_criteria>
    - Splash login page displays if no active user session is present
    - Request link inserts row and displays local debug link in DEV mode
    - Verify view sanitizes URL search parameters instantly and redirects logged-in user
  </acceptance_criteria>
  <done>Splash login screen overlay and Verify routing views are completed.</done>
</task>

<task type="auto">
  <name>Task 5: Implement profile account linking UI and deep-link generation</name>
  <files>web/src/views/TripDetails.jsx</files>
  <read_first>web/src/views/TripDetails.jsx, .planning/phases/17-custom-passwordless-email-login/17-UI-SPEC.md</read_first>
  <action>
    Update user profile card / drawer section in `web/src/views/TripDetails.jsx` to support email accounts:
    1. If user is logged in via email and telegram ID is a negative value, display "Link Telegram Account" CTA.
    2. Clicking "Link Telegram Account" inserts a temporary verification code in the database and renders a deep link `https://t.me/TripSyncBot?start=link_<code>` pointing to the bot.
    3. If telegram ID is positive, show "Disconnect Telegram" option.
  </action>
  <verify>
    Run: `npm run build --prefix web`
  </verify>
  <acceptance_criteria>
    - Email profiles show "Link Telegram" button
    - Connected accounts show "Disconnect Telegram" option
  </acceptance_criteria>
  <done>Profile settings linking and deep link creation widgets are integrated.</done>
</task>

<task type="auto">
  <name>Task 6: Implement Telegram bot deep-link handler and profile merge transaction</name>
  <files>main.py</files>
  <read_first>main.py, .planning/phases/17-custom-passwordless-email-login/17-CONTEXT.md</read_first>
  <action>
    Modify `main.py` to support start queries:
    1. In `/start` handler, check if the update contains a deep link parameter starting with `link_` (e.g. `/start link_<code>`).
    2. If found, resolve the pending link code, retrieve the target email user record, and verify the caller's Telegram user ID (`tg_user_id`).
    3. Update the email user's `telegram_id` to `tg_user_id`.
    4. If another user record with `telegram_id = tg_user_id` already exists, call the database function `public.merge_users(target_id, stale_id)` to re-key all foreign keys atomically, then delete the stale duplicate record.
    5. Send confirmation message to the user in Telegram indicating linking completed.
  </action>
  <verify>
    Run: `python main.py` syntax check
  </verify>
  <acceptance_criteria>
    - `/start link_<code>` parameter is parsed by Telegram bot
    - Re-keys data and runs database-level merges atomically when linking collisions occur
  </acceptance_criteria>
  <done>Bot deep link interceptor and PostgreSQL merge RPC integrations are complete.</done>
</task>

<task type="auto">
  <name>Task 7: Run E2E integrations and verify auth flow tests</name>
  <files>tests/test_auth_link.py, web/verify-auth-flow.cjs</files>
  <read_first>tests/test_auth_link.py, web/verify-auth-flow.cjs</read_first>
  <action>
    Complete implementations of `tests/test_auth_link.py` and `web/verify-auth-flow.cjs` to test token lifespan validation, merge deduplication, and database webhook logs.
    Execute verification suite and ensure all tests are green.
  </action>
  <verify>
    Run: `pytest && node web/verify-auth-flow.cjs`
  </verify>
  <acceptance_criteria>
    - Unit tests in `tests/test_auth_link.py` pass successfully
    - Integration tests in `web/verify-auth-flow.cjs` pass successfully
  </acceptance_criteria>
  <done>Integrations are verified green.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `npm run build --prefix web` completes successfully with exit code 0
- [ ] `pytest` execution passes successfully with all green tests
- [ ] `node web/verify-auth-flow.cjs` passes successfully
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- No compilation/build errors or pytest failures
</success_criteria>

<output>
After completion, create `.planning/phases/17-custom-passwordless-email-login/17-SUMMARY.md`
</output>
