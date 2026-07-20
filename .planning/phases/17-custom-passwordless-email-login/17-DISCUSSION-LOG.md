# Phase 17: Custom Passwordless Email Login - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 17-custom-passwordless-email-login
**Areas discussed:** Local testing and mocking of email dispatch, User merging logic for linking Telegram accounts

---

## Local testing and mocking of email dispatch

| Option | Description | Selected |
|--------|-------------|----------|
| Direct database query fallback + UI debug link | In development mode, display a temporary debug banner/link on screen to simulate email dispatch, and allow E2E tests to query the token directly from the 'login_tokens' table. | ✓ |
| Local webhook listener | Run a simple local HTTP server during dev/test to receive webhooks and output links to a log file or console. | |
| Real email only | Use a real Resend API key and send actual emails for all development and testing. | |

**User's choice:** Direct database query fallback + UI debug link
**Notes:** The developer wanted to display a temporary banner/link in development mode to simulate sending the email, and enable automated E2E tests to pull tokens directly from the `login_tokens` table.

---

## User merging logic for linking Telegram accounts

| Option | Description | Selected |
|--------|-------------|----------|
| Deep-link verification + cascade data merge | Generate a Telegram bot start link (e.g., /start link_XYZ) for verification. Upon activation, the bot updates the email user's telegram_id. If that positive Telegram ID already exists, it re-keys all RSVPs, expenses, splits, and votes to the email user record, then deletes the stale Telegram-only user. | ✓ |
| Deep-link verification with error on conflict | Verify via bot deep-link, but if the positive Telegram ID already exists in the database, block the action and instruct the user to use the deep-login link or choose a different account. | |
| Simple text-field linking (No validation) | Allow users to input their Telegram username directly on their profile page. Look up the username and update the database, without requiring active verification through the Telegram bot. | |

**User's choice:** Deep-link verification + cascade data merge
**Notes:** Verification of ownership will be performed securely via a Telegram bot deep-link start parameter. If a collision occurs (i.e. the Telegram user already has a positive ID record in the `users` table), the system will automatically merge their travel history (RSVPs, expenses, splits, votes) and clean up the old Telegram-only user record.

---

## the agent's Discretion

- Exact visual layout of the email splash landing page and the verification status indicator.
- Transactional email copy template details.
- Expiration limits (15 minutes).

## Deferred Ideas

- SMS verification (SMS-01) — Deferred to future milestones
- Social third-party login (AUTH-05) — Deferred to future milestones

---

*Phase: 17-custom-passwordless-email-login*
*Discussion log generated: 2026-07-15*
