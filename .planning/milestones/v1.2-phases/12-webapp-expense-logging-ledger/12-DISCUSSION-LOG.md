# Phase 12: Webapp Expense Logging & Ledger - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 12-webapp-expense-logging-ledger
**Areas discussed:** Database Schema & Currency storage, Expense Splitting UI

---

## Database Schema & Currency storage

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1 | Extend Supabase Schema (Add 'currency' [TEXT] and 'split_users' [JSONB] columns to the 'expenses' table) | ✓ |
| Option 2 | Serialize in Description Column (Save currency and splits as a structured JSON/text string in the description) | |
| Option 3 | Hardcode Base Currency & Equal Split (Default to trip base currency and split equally) | |

**User's choice:** Option 1: Extend Supabase Schema
**Notes:** I will provide the direct SQL statements to execute in the Supabase dashboard SQL Editor.

---

## Expense Splitting UI

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1 | Roster Checkboxes (Checkboxes in the expense modal, all checked by default) | |
| Option 2 | Equal vs Custom Toggle (Show a 'Split Equally' toggle. If off, reveal list of checkboxes) | ✓ |
| Option 3 | Equal Split Only (Always split equally; hide split selection UI) | |

**User's choice:** Option 2: Equal vs Custom Toggle
**Notes:** Provides a cleaner default UI while retaining selective split customization.

---

## the agent's Discretion
- Ledger Layout: Desktop Grid layout transitioning to stacked mobile cards.

## Deferred Ideas
- Settlement greed resolution solvers and graph visualizations are deferred to Phase 13.
