# Phase 13: Webapp Debts Settlement Optimization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 13-webapp-debts-settlement-optimization
**Areas discussed:** Exchange Rates API, Debt Settlement Algorithm

---

## Exchange Rates API

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1 | Free Public Exchange Rate API (Fetch live rates from open.er-api.com on load) | ✓ |
| Option 2 | Hardcoded Static Conversion Mapping (Hardcode standard rates in the app) | |

**User's choice:** Option 1: Free Public Exchange Rate API
**Notes:** Provides real-time currency conversions without requiring API keys or secret leakage.

---

## Debt Settlement Algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1 | Exact Split Calculation (Process each expense individually based on custom split check values) | ✓ |
| Option 2 | Equal Split Simplification (Ignore custom splits; split equally among everyone) | |

**User's choice:** Option 1: Exact Split Calculation
**Notes:** Processes individual `split_users` checklists to compute precise debts.

---

## the agent's Discretion
- Settlement UI View: Custom visual tab/card showing debts and settlement directions.

## Deferred Ideas
- None.
