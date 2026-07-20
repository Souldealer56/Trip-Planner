# Feature Research

**Domain:** Standalone Webapp & Hybrid Onboarding
**Researched:** 2026-07-14
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Passwordless Email Login | Standalone web users need a secure way to access their account without a Telegram bot link. | MEDIUM | Enter email, receive link with secure token, verify on landing. |
| Shareable Invite Links | Users expect to invite friends directly to a trip using a web URL. | LOW | `/join/:tripId` or similar endpoint that adds visitors to the trip roster. |
| Hybrid Roster & Voting | Standalone web users must have full parity with bot users (RSVP, pitch options, vote, expenses). | MEDIUM | Roster, options, votes, and ledger must support mixed user identities. |
| Basic Notification Indicator | Web users need to know when changes occur in their active trips. | LOW | Badge or visual highlight indicating new activity. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Slide-out Notification Feed | Beautiful feed of recent trip activity (new pitches, votes, ledger logs) with rich details. | MEDIUM | A visual feed that lists recent events in the trip. |
| Account Linking | Seamless transition: Link a Telegram handle to an email account to merge rosters/history. | MEDIUM | Map standard `users` record to have both `telegram_id` and `email`. |
| Premium Custom Avatars | Auto-generated initials-based avatars styled with vibrant gradient backgrounds. | LOW | Built-in custom avatar components. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Password Authentication | Standard password input. | Adds security risks, password hashing/salting requirements, database leaks, and complex reset flows. | Custom passwordless email links. |
| Local SMTP Server | Self-hosted mail server. | High maintenance, poor IP reputation, email delivery failure, blocked ports. | API-based Transactional Email Service (Resend/SendGrid) triggered via database webhooks. |
| Real-time WebSockets | Real-time active updates on UI. | Adds server overhead, connection polling costs, and state syncing complexity. | Dynamic long polling / manual fresh query reload trigger coupled with notification feed. |

## Feature Dependencies

```
[Custom login_tokens Table]
       ├──requires──> [Transactional Email API Webhook]
       
[Shareable Invite Link] ──requires──> [Custom login_tokens Table / Profile Selector]

[Visual Notification Feed] ──requires──> [Trips Database Activity Logging / Querying]
```

### Dependency Notes

- **Passwordless email requires transaction mailer:** We must have a secure, API-driven transactional email flow (like Resend) triggered safely.
- **Invite link requires onboarding:** Visitors landing via `/join/:tripId` who are not logged in must be routed to the profile selector or passwordless login first.
- **Notification feed requires activity log:** We must track database events (like row inserts on `options`, `votes`, `expenses`) to build a chronological feed.

## MVP Definition

### Launch With (v1.4)

Minimum viable product for this milestone:

- [ ] Custom `login_tokens` table in the Supabase public schema for email verification.
- [ ] Database Webhook configuration to securely forward token inserts to Resend/SendGrid API.
- [ ] A dedicated `/verify?token=...` web route that validates tokens and logs the user in.
- [ ] Shareable Web Invite Links (`/join/:tripId`) that register new travelers and add them to the roster.
- [ ] Combined bot-web hybrid roster handling (users have either `telegram_id` or `email`, or both).
- [ ] In-App Notification Slide-out Panel showing recent pitches, votes, and ledger logs.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Custom Passwordless Email Login | HIGH | MEDIUM | P1 |
| Shareable Web Invite Links | HIGH | LOW | P1 |
| Hybrid Bot-Web Support | HIGH | MEDIUM | P1 |
| Visual Notification Feed | MEDIUM | MEDIUM | P2 |
| Account Linking (TG + Email) | MEDIUM | MEDIUM | P2 |

---
*Feature research for: Standalone Webapp & Hybrid Onboarding*
*Researched: 2026-07-14*
