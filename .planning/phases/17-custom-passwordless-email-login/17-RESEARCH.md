# Phase 17: Custom Passwordless Email Login - Research

**Researched:** 2026-07-15
**Domain:** Passwordless Auth & Database Integrations (Supabase / Resend / python-telegram-bot)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Testing):** Direct database query fallback + UI debug link. In development mode (`import.meta.env.DEV`), the splash landing page will display a temporary debug helper banner/link showing the simulated email dispatch link, bypassing the actual email dispatch requirement for quick developer testing.
- **D-02 (Testing):** Automated E2E verification tests can fetch the verification token directly from the database's `login_tokens` table via SQL queries instead of waiting for/reading emails.
- **D-03 (Verification):** Linking a web-based email profile to a Telegram account requires clicking a verification link in the web app that opens the Telegram bot with a start parameter (e.g. `/start link_<code>`).
- **D-04 (History Merge):** Upon bot verification, the bot updates the email user's `telegram_id` to their positive Telegram ID. If a user record for that Telegram ID already exists, the bot automatically re-keys all associated RSVPs, expenses, splits, and votes in the database to point to the email user record, then deletes the stale Telegram-only user record.
- **D-05 (Token):** Magic link token will use a high-entropy cryptographically secure UUID.
- **D-06 (Token):** The login link is valid for 15 minutes and is marked `used = true` immediately upon first verification.
- **D-07 (Session):** Cache the logged-in user session in `localStorage` under `trip_planner_active_user` (consistent with existing user session context).
- **D-08 (Session):** Instantly sanitize the `token` URL query parameter from the browser address bar upon successful landing on the `/verify` route using `window.history.replaceState`.

### The Agent's Discretion
- **D-09:** Exact visual style, CSS classes, and transitions of the landing/splash page email entry form.
- **D-10:** Text and layout of the transactional verification email template sent via Resend.
- **D-11:** Exact formatting and validation regex of the email input field.

### Deferred Ideas (OUT OF SCOPE)
- SMS verification (SMS-01) — Deferred to future milestones
- Social third-party login (AUTH-05) — Deferred to future milestones

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email entry form & UI validation | Browser/Client | — | Runs locally in React components |
| Generating tokens & database insertion | Browser/Client | Database/Storage | React client generates UUID token and inserts into `login_tokens` table |
| Triggering magic link emails | Database/Storage | API/Backend (Resend) | Supabase trigger/webhook detects inserts in `login_tokens` and routes API POST call to Resend |
| Token validation & login verification | Browser/Client | Database/Storage | `/verify` route queries `login_tokens` and returns associated user profile |
| Telegram account linking start | Browser/Client | — | React client generates verification deep-link containing temporary link code |
| Telegram account ownership check | API/Backend (Bot) | Database/Storage | Telegram bot `/start` handler validates the link code and resolves target users |
| Traveler history merging | Database/Storage | — | PostgreSQL database function re-keys all foreign keys atomically |

</architectural_responsibility_map>

<research_summary>
## Summary

This phase implements passwordless authentication and Telegram-to-email account linking.
1. **Passwordless Login:** Users enter an email address. The React frontend generates a cryptographically secure token (UUID) and inserts it into a new database table, `login_tokens`. A Supabase database trigger detects the insert and sends a POST request directly to the Resend API using PostgreSQL's native `pg_net` extension, eliminating the need to host external Node.js edge functions. Clicking the email link lands on a `/verify` React route, which validates the token, marks it as used, creates/resolves the traveler profile, and updates the `UserSessionContext`.
2. **Local Debug Helpers:** In development mode (`import.meta.env.DEV`), the UI displays the generated link immediately so developers and E2E tests can authenticate without a working email gateway.
3. **Traveler Merge Transaction:** Linking a Telegram profile triggers a database function (`public.merge_users`) that re-keys all RSVPs, expenses, splits, and votes in a single atomic SQL transaction before removing the duplicate user record, ensuring no data loss.

**Primary recommendation:** Use SQL triggers with `net.http_post` for Resend email dispatch, and implement a PL/pgSQL function (`public.merge_users`) to handle account history merges atomically on the database side.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase-py` | 2.28.3 | python-telegram-bot db client | Database access and RPC calls in bot |
| `@supabase/supabase-js` | 2.43.0 | React supabase client | Client-side database actions and auth |
| `react-router-dom` | 6.22.3 | React frontend routing | Handles routing to `/verify` and redirects |
| `pg_net` (Postgres Extension) | Pre-installed | Async HTTP requests in Postgres | Standard extension for database webhooks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pg_net` SQL Webhook | Supabase Edge Function | Edge functions add deployment/hosting overhead; pg_net keeps everything inside SQL migrations. |
| Supabase Auth | Custom `login_tokens` table | Supabase Auth binds the project to Supabase; custom tokens maintain 100% database-agnostic portability. |

**Installation:**
No new dependencies are required for this phase; we leverage the pre-installed Supabase JS SDK, React Router, and PostgreSQL `pg_net` extension.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### System Architecture Diagram

```
[React Splash Page] ──(Generates token & Inserts)──> [login_tokens Table]
        │                                                     │
        │ (Displays local link in DEV)                        │ (Insert Trigger)
        ▼                                                     ▼
[Click Debug Link]                                    [pg_net http_post]
        │                                                     │ (JSON POST)
        │                                                     ▼
        │                                              [Resend API]
        │                                                     │
        │                                                     │ (Sends Email)
        │                                                     ▼
        └─────────────────> [Click Magic Link] <──────────────┘
                                  │
                                  ▼
                            [/verify Route]
                                  │ (Validates & Marks Used)
                                  ▼
                         [UserSessionContext] ──(Redirects)──> [/trips Dashboard]
```

### Pattern 1: pg_net Email Dispatch Trigger
**What:** PostgreSQL trigger function that formats the record and makes a non-blocking HTTP POST request to the Resend API.
**When to use:** On insert into `login_tokens` to send emails.
**Example:**
```sql
CREATE OR REPLACE FUNCTION public.send_magic_link()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.resend_key', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Trip Planner <onboarding@resend.dev>',
      'to', jsonb_build_array(new.email),
      'subject', 'Your Magic Login Link',
      'html', '<p>Click <a href="' || current_setting('app.webapp_url', true) || '/verify?token=' || new.token || '">here</a> to log in.</p>'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Pattern 2: Atomic Traveler Merge DB Function
**What:** PostgreSQL PL/pgSQL function to merge RSVPs, expenses, splits, and votes from a Telegram-only user record into a primary email-based user record.
**When to use:** When verification deep-linking succeeds and a duplicate Telegram user profile already exists.
**Example:**
```sql
CREATE OR REPLACE FUNCTION public.merge_users(target_id UUID, stale_id UUID)
RETURNS VOID AS $$
BEGIN
  -- 1. Deduplicate RSVPs
  DELETE FROM public.rsvps
  WHERE user_id = stale_id
    AND trip_id IN (SELECT trip_id FROM public.rsvps WHERE user_id = target_id);
  UPDATE public.rsvps SET user_id = target_id WHERE user_id = stale_id;

  -- 2. Deduplicate Splits
  DELETE FROM public.splits
  WHERE user_id = stale_id
    AND expense_id IN (SELECT expense_id FROM public.splits WHERE user_id = target_id);
  UPDATE public.splits SET user_id = target_id WHERE user_id = stale_id;

  -- 3. Update Expenses Paid By
  UPDATE public.expenses SET paid_by = target_id WHERE paid_by = stale_id;

  -- 4. Deduplicate Votes
  DELETE FROM public.votes
  WHERE user_id = stale_id
    AND option_id IN (SELECT option_id FROM public.votes WHERE user_id = target_id);
  UPDATE public.votes SET user_id = target_id WHERE user_id = stale_id;

  -- 5. Link Telegram info to email user
  UPDATE public.users t
  SET 
    telegram_id = COALESCE(t.telegram_id, s.telegram_id),
    username = COALESCE(t.username, s.username),
    first_name = COALESCE(t.first_name, s.first_name),
    last_name = COALESCE(t.last_name, s.last_name)
  FROM public.users s
  WHERE t.id = target_id AND s.id = stale_id;

  -- 6. Delete duplicate Telegram user profile
  DELETE FROM public.users WHERE id = stale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Anti-Patterns to Avoid
- **Client-Side Merging:** Making multiple individual REST queries from the client to delete and update tables. If a network call fails, the database remains in a corrupt/half-merged state. Always use database transactions or PL/pgSQL functions.
- **Exposing API Keys to Client:** Making emails dispatch calls from the React client. This exposes the Resend API secret key to the browser. Always use database-level triggers or serverless functions.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verification Token | Random strings / numbers | Cryptographic UUIDs (`gen_random_uuid()`) | UUIDs prevent brute-force token guessing and guarantee global uniqueness. |
| Transaction Lock | Staged multi-query updates | PL/pgSQL DB Function | Multi-query client execution risks split state if the browser closes mid-execution. |
| HTTP client in SQL | Direct socket raw TCP | `pg_net` extension | `pg_net` handles connections, headers, timeouts, and request queuing asynchronously. |

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Unique Constraint Failures on Merge
- **What goes wrong:** Re-keying `user_id` inside `rsvps` or `splits` throws duplicate key violations.
- **Why it happens:** The user is registered for the same trip on both their Telegram and email profile, causing the unique constraint on `rsvps(trip_id, user_id)` to fail.
- **How to avoid:** Prior to re-keying, run a `DELETE` statement in the database transaction to remove duplicate records for the `stale_id` when the `target_id` already has a record.

### Pitfall 2: Local Webhook Delivery Failures
- **What goes wrong:** The database webhook fails to send emails during local test suites because Resend credentials or internet access are unavailable.
- **How to avoid:** Build client-side dev mode fallbacks (`import.meta.env.DEV`) to expose the login link on screen, enabling immediate testing without needing webhook execution.

### Pitfall 3: Subagent Execution Stalls
- **What goes wrong:** Parallel client queries block state updates or trigger race conditions during verification redirects.
- **How to avoid:** Instantly sanitise the query parameter using `history.replaceState` before making verification service calls.

</common_pitfalls>

<code_examples>
## Code Examples

### Token Verification Service (`web/src/services/auth.js`)
```javascript
import { supabase } from './supabase'

export async function requestLoginLink(email) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

  const { error } = await supabase
    .from('login_tokens')
    .insert({
      email: email.trim().toLowerCase(),
      token,
      expires_at: expiresAt,
      used: false
    });

  if (error) throw error;
  return token; // Return token for dev mode display
}

export async function verifyLoginToken(token) {
  // 1. Fetch token details
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('login_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (tokenError || !tokenRecord) throw new Error('Invalid magic link.');
  if (tokenRecord.used) throw new Error('This magic link has already been used.');
  if (new Date(tokenRecord.expires_at) < new Date()) throw new Error('This magic link has expired.');

  // 2. Mark token as used
  await supabase
    .from('login_tokens')
    .update({ used: true })
    .eq('id', tokenRecord.id);

  // 3. Resolve or create user profile
  let { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', tokenRecord.email)
    .maybeSingle();

  if (!user) {
    // Standalone onboarding: Create new user with negative telegram_id
    const tempTelegramId = -1000000 - Math.floor(Math.random() * 1000000);
    const firstName = tokenRecord.email.split('@')[0];
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: tokenRecord.email,
        telegram_id: tempTelegramId,
        first_name: firstName,
        username: firstName.toLowerCase()
      })
      .select()
      .single();

    if (createError) throw createError;
    user = newUser;
  }

  return user;
}
```

</code_examples>

<sources>
## Sources

### Primary (HIGH confidence)
- Supabase Database Webhooks - custom headers, pg_net routing
- PostgreSQL PL/pgSQL transactions - upsert patterns and constraint resolution
- React Context hooks - localStorage state caching

### Secondary (MEDIUM confidence)
- Resend transactional mailer API specification - endpoint configuration

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Supabase SQL Webhooks, PostgreSQL triggers, React Router, python-telegram-bot
- Ecosystem: Resend, pg_net, Supabase JS client
- Patterns: Database-level merges, client-side session handlers, dev mode debugging

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH
- Code examples: HIGH

**Research date:** 2026-07-15
**Valid until:** 2026-08-15
</metadata>

---

*Phase: 17-custom-passwordless-email-login*
*Research completed: 2026-07-15*
*Ready for planning: yes*
