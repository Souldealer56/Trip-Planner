# Pitfalls Research

**Domain:** Standalone Webapp & Hybrid Onboarding
**Researched:** 2026-07-14
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Email Token Replay and Expiry Vulnerabilities

**What goes wrong:**
A user receives a passwordless login link via email. If the login link token is not invalidated upon first use, an attacker who intercepts the link (or gains access to browser history) can log in as that user indefinitely. If the token lacks an expiration date, it remains valid forever.

**Why it happens:**
The verification route `/verify` checks if a token exists in the database but fails to mark it as `used` or check `expires_at` parameters in the SQL SELECT clause.

**How to avoid:**
1. Always mark tokens as `used: true` immediately after validating them.
2. Filter the database query to check that `used = false` and `expires_at > NOW()`.
3. Set a short expiration time (e.g., 15 minutes) for all generated login tokens.

**Warning signs:**
Logging in via the same magic link URL multiple times succeeds, even hours/days later.

**Phase to address:**
Phase 1 (Custom Passwordless Email Login)

---

### Pitfall 2: Browser Exposure of Secret API Keys

**What goes wrong:**
To send magic link emails, developers might try to hit Resend or SendGrid APIs directly from React code. This requires placing API secret keys inside Vite environment variables (e.g., `VITE_RESEND_API_KEY`). Attackers can inspect the frontend javascript bundle, extract the secret key, and use it to send spam emails on the application's budget.

**Why it happens:**
React frontend code executes on the client-side (in the browser), so any credentials compiled into the bundle are readable.

**How to avoid:**
Never place API secret keys in client-side code. Use a **Supabase Database Webhook** to securely trigger email delivery. The client simply inserts a row to `login_tokens`, and the database webhook (executing on the secure Supabase server) forwards the request to the mail provider using a vault-stored header.

**Warning signs:**
Vite `.env` contains keys with non-public prefixes, or build logs show secret key variables.

**Phase to address:**
Phase 1 (Custom Passwordless Email Login)

---

### Pitfall 3: Identity Fragmentation in Hybrid Mode

**What goes wrong:**
A user named "Sarah" joins a trip on the webapp using her email `sarah@example.com` and chooses the username `sarah`. Later, she interacts with the Telegram bot. The bot queries the users table, fails to match her, and inserts a new user record for her Telegram ID. She is now two separate people in the database.

**Why it happens:**
The bot uses `telegram_id` for lookup, while the webapp uses `email` or `username`.

**How to avoid:**
- Allow users to link their email to their Telegram account, or vice-versa.
- When creating a user via Telegram, check if a profile already exists with the same username (case-insensitive) and link it by updating the `telegram_id` column rather than creating a new record.

**Warning signs:**
The trip roster displays the same traveler twice under slightly different identifiers.

**Phase to address:**
Phase 3 (Hybrid Bot-Web Coexistence)

---

### Pitfall 4: Activity Log Database Bloat and Slow Load Times

**What goes wrong:**
Every vote, option pitch, and RSVP change writes a row to `activity_log`. If users query the full activity log for a trip on every page load, loading trip details becomes extremely slow.

**Why it happens:**
`activity_log` grows linearly with activity. A single trip with 10 participants can easily generate thousands of log entries over a week.

**How to avoid:**
- Implement pagination or hard limits (e.g., only fetch the top 50 most recent activities) when loading the slide-out feed.
- Add composite database indexes on `(trip_id, created_at DESC)`.
- Configure foreign key cascade deletes so deleting a trip or user automatically purges their associated activity logs.

**Warning signs:**
Trip details page takes more than 1 second to render the notification feed.

**Phase to address:**
Phase 4 (In-App Notification Center)

---
*Pitfalls research for: Standalone Webapp & Hybrid Onboarding*
*Researched: 2026-07-14*
