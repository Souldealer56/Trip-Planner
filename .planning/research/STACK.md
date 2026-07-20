# Stack Research

**Domain:** Standalone Webapp & Hybrid Onboarding
**Researched:** 2026-07-14
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | ^19.2.7 | Client views and UI state orchestration | Existing project core framework |
| React Router DOM | ^7.18.1 | Page routing and query parameter parsing | Handlers for `/verify` token route and `/join/:tripId` invite links |
| @supabase/supabase-js | ^2.110.2 | Database transactions and queries | Main interface to fetch/write user records, trip rosters, and custom `login_tokens` |
| Python / httpx | ^0.28.1 | Backend automation & API execution | Exists in Python env; can be used if we need a lightweight email dispatch handler |

### Supporting Services & APIs

| Library/Service | Purpose | When to Use |
|-----------------|---------|-------------|
| Resend / SendGrid API | Transactional email dispatch | Sending passwordless login links containing secure tokens to traveler emails |
| Supabase Database Webhooks | Secure REST forwarding of database events | Triggers on inserts to `login_tokens` to call the email API without exposing API keys to the browser |
| Browser Crypto API | Cryptographically secure token generation | Generating high-entropy random hex or UUID login tokens client-side |
| Browser localStorage | Storing active user profile session | Client-side persistence of logged-in traveler profile state |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Frontend bundling & local dev server | Configured with parental `.env` credentials |
| Oxlint | Fast code analysis & linting | Runs inside git workflows |

## Installation

```bash
# Web application dependencies are already installed. No new package installations required!
# Transactional email endpoints are accessed via native fetch or built-in python libraries.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Database Webhooks for Emails | Custom Python API Server | If database webhook rate limiting is insufficient, or if complex templating/logging is needed backend-side. |
| Custom `login_tokens` Table | Supabase Auth Magic Links | When strict vendor-lockin to Supabase Auth is acceptable. Avoided here to maintain database-agnostic portability (Option 2). |
| Native Browser Crypto | UUID Node Package | When targeting older browsers that do not support the native `crypto` global. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Client-side Email Credentials | Exposing Resend/SendGrid API keys in frontend bundles is a major security risk | Database Webhooks or backend proxy |
| Plaintext password tables | Storing user passwords manually violates security best practices and adds maintenance overhead | Custom passwordless email token links |
| JWT libraries in client | Heavy bundle size and unnecessary complexity for a simple stateless token-based flow | Native string verification against standard PostgreSQL table |

## Sources

- MDN Web Docs - Crypto.getRandomValues() & crypto.randomUUID()
- Supabase Docs - Database Webhooks Guide
- Resend API documentation - Sending Emails with curl/REST

---
*Stack research for: Standalone Webapp & Hybrid Onboarding*
*Researched: 2026-07-14*
