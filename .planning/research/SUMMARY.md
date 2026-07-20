# Project Research Summary

**Project:** Trip Planner
**Domain:** Standalone Webapp & Hybrid Onboarding
**Researched:** 2026-07-14
**Confidence:** HIGH

## Executive Summary

This research establishes the blueprint for detaching the Trip Planner application from its strict Telegram bot dependency, allowing standalone web users to onboard, join trips, and receive in-app notifications.

The recommended architectural approach is:
1. **Custom Table-Based Passwordless Auth:** Store login tokens in a database-agnostic table (`login_tokens`) and send links using database webhooks that route securely to a transactional mailer (like Resend).
2. **Web Invite Links:** Create a `/join/:tripId` route that prompts unauthenticated visitors to onboard or log in, then appends them to the trip's RSVP roster.
3. **Hybrid Roster Model:** Update both the bot and the webapp to resolve user records by either `telegram_id` or `email`, allowing seamless coexistence.
4. **In-App Notification Center:** Log pitches, votes, and expense updates to a shared `activity_log` table, querying recent logs in a slide-out panel on the trip details page.

## Key Findings

### Recommended Stack
We will leverage the existing stack (React 19 + Supabase JS Client + Python bot daemon) but add database webhooks and a transactional email service API (Resend/SendGrid) for magic link deliveries. Custom token generation and verification will happen directly within the public PostgreSQL schema.

### Expected Features

**Must have (table stakes):**
- Custom `login_tokens` database table with expiration and verification states.
- Passwordless email entry form and a dedicated `/verify?token=...` auth validation route.
- Shareable invite links (`/join/:tripId`) that auto-register visitors onto the trip roster.
- Consolidated hybrid schema supporting users with real Telegram IDs, negative web IDs, or emails.
- In-app notification indicator for trip activity updates.

**Should have (differentiators):**
- Rich slide-out visual Notification Drawer detailing specific event triggers (actor name, exact event type, and parameters).
- Account linking flow to merge Telegram and standalone web profiles.

### Architecture Approach
All session states remain client-cached in standard `localStorage` via our global `UserSessionContext`. Standalone email requests insert a token client-side, which is forwarded by a database insert trigger webhook to the Resend API. Event logging inserts to an `activity_log` table, keeping both bot-based and web-based actions in one chronological timeline.

### Critical Pitfalls
- **Token Replay/Expirations:** Solved by enforcing expiration timestamps and a strict one-time-use state mutation (`used: true`) during the verification query.
- **Client Key Leakage:** Solved by executing mailer REST queries on the server via Supabase Webhooks or a backend proxy, never exposing secret tokens to browser bundles.
- **Identity Fragmentation:** Solved by deduplicating users by username or email before generating new accounts during bot/web onboarding.

## Implications for Roadmap

Suggested phase structure:

### Phase 17: Custom Passwordless Email Login
- **Rationale:** Sets up the custom, database-agnostic login mechanics.
- **Delivers:** `login_tokens` table, database webhooks for email routing, email entry views, and `/verify` route handling.

### Phase 18: Shareable Web Invite Links
- **Rationale:** Enables direct sharing of trips and standalone user registration.
- **Delivers:** `/join/:tripId` route, registration form routing, and creator/visitor automatic roster addition.

### Phase 19: Hybrid Bot-Web Coexistence
- **Rationale:** Ensures Telegram and standalone web users participate on the same trips without collisions.
- **Delivers:** Roster updates, option pitching/voting changes, and bot matching query updates in `main.py`.

### Phase 20: In-App Activity Log & Notification Feed
- **Rationale:** Provides web users with a rich visual feed of recent activity.
- **Delivers:** `activity_log` schema, mutation hooks logging, and slide-out notification drawer.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Database-agnostic tables avoid vendor lock-in |
| Features | HIGH | Fully answers the standalone and hybrid requirements |
| Architecture | HIGH | Webhooks + Postgres tables keep the app lightweight |
| Pitfalls | HIGH | Specific mitigations planned for token replay and key leaks |

**Overall confidence:** HIGH

---
*Research completed: 2026-07-14*
*Ready for roadmap: yes*
