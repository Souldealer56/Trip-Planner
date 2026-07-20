# Phase 18: Shareable Web Invite Links & Standalone Roster Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 18-shareable-web-invite-links-standalone-roster-onboarding
**Areas discussed:** Guest Onboarding Flow, RSVP Default Status, Clipboard-Copy Feedback UI

---

## Guest Onboarding Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Dual-path onboarding | Let guests either enter a First Name for instant registration (fast path) OR enter an email for passwordless magic link sign-in (secure path). | ✓ |
| Instant registration path only | Guests only need to provide a First Name to create a local profile and join immediately. | |
| Email sign-in path only | Guests must authenticate via email magic link to join, ensuring their profile is verified. | |

**User's choice:** Dual-path onboarding.
**Notes:** Guests can join quickly via name-only registration, but still have the option to use email.

---

## RSVP Default Status

| Option | Description | Selected |
|--------|-------------|----------|
| Committed by default | Mark them as 'Committed' by default. | |
| Tentative by default | Mark them as 'Tentative' by default and let them update it on the dashboard. | ✓ |

**User's choice:** Mark them as 'Tentative' by default.
**Notes:** Safer baseline assumption for invitees.

---

## Clipboard-Copy Feedback UI

| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip/Toast alert | Renders a floating tooltip or temporary inline toast that fades out after 2 seconds. | ✓ |
| Label toggle | Toggles the button's label from 'Copy Invite Link' to 'Copied!' for 2 seconds. | |

**User's choice:** Tooltip or Toast alert.
**Notes:** Fits existing clean, rich-aesthetic design.

---

## the agent's Discretion

- Exact CSS animations and visual transitions for the toast notification and floating tooltip.
- Copy text for helper descriptions on the guest onboarding card/wizard.

## Deferred Ideas

- None.
