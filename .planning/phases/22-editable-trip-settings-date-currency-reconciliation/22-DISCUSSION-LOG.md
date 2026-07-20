# Phase 22: Editable Trip Settings & Date/Currency Reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 22-editable-trip-settings-date-currency-reconciliation
**Areas discussed:** Edit Access & UI Placement, Date Conflict Warnings, Base Currency FX Behavior

---

## Trip Settings Edit Access & UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Any member on trip | Collaborative model — any participant registered on trip can edit settings | ✓ |
| Creator only | Restrict edits to trip creator / organizer | |

| Option | Description | Selected |
|--------|-------------|----------|
| Header Action Button | "✏️ Edit Trip" button inside the top Trip Details card | ✓ |
| Title Gear Icon | Settings gear icon next to the trip title | |

**User's choice:** Any member on the trip can edit trip settings; Header action button inside top Trip Details card.

---

## Date Change & Pitched Option Conflict Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Badge + Reconciliation Modal | Amber warning badge ("⚠️ Outside Trip Dates") on affected option cards AND post-save reconciliation modal | ✓ |
| Badge only | Amber warning badge on option cards only | |
| Block edit | Prevent saving new trip dates until conflicting options are deleted/adjusted | |

**User's choice:** Show amber warning badge on affected option cards AND present a post-save reconciliation modal summarizing conflicting options.

---

## Base Currency Change & Debt Ledger Recalculation

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve original & recalc dynamic FX | Preserve original expense currencies & amounts in DB; recalculate net debt settlement matrix dynamically in new base currency using live FX rates | ✓ |
| Auto-convert amounts in DB | Convert all past logged expense amounts in database to new base currency | |

**User's choice:** Preserve original expense currencies & amounts; recalculate debt settlement matrix dynamically in new base currency using live FX rates.

---

## Agent's Discretion

- Glassmorphic modal styling & form layout.
- Validation message formatting & error toasts.

## Deferred Ideas

None.
