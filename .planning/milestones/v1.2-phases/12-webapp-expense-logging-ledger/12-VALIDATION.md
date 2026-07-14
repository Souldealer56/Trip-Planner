# Phase 12 Validation Strategy — Webapp Expense Logging & Ledger

## Automated Verification Pipeline
We will create a Node.js verification script to check the database columns and operations directly before deploying the React component code changes.

### Wave 0 Test Execution
Command:
```bash
node web/verify-expenses-service.cjs
```
Success assertion: exits with status 0, confirming test insertions and checks succeed.

### Linter Gate
Command:
```bash
npm run lint
```
Success assertion: exits with status 0 (no javascript formatting/syntax errors).

---

## Manual Verification Procedurals (UAT)

### UAT-EXP-01: Modal Form Input Validations
1. Open the "Add Expense" modal.
2. Attempt to submit with an empty description. Confirm the client-side validation displays a message: "Description is required."
3. Attempt to submit with a negative or zero amount. Confirm the client-side validation displays a message: "Amount must be greater than 0."

### UAT-EXP-02: Equal Split Logging
1. Open the "Add Expense" modal.
2. Enter description "Group Pizza", amount "60", currency "USD".
3. Ensure "Split Equally" toggle is ON.
4. Submit the form.
5. In the Ledger list, verify the new row shows:
   - Description: "Group Pizza"
   - Payer name (e.g. Alice)
   - Total amount: "$60.00"
   - Splits: "Everyone" or lists all committed member first names.
   - Verify in the database that `split_users` array is populated with the UUIDs of all committed roster participants.

### UAT-EXP-03: Selective Split Logging
1. Open the "Add Expense" modal.
2. Enter description "Taxi to Hotel", amount "30", currency "EUR".
3. Toggle "Split Equally" to OFF.
4. Uncheck one or more participants from the checklist (e.g., exclude Bob).
5. Submit the form.
6. Verify in the Ledger list that the splits column displays only the checked participant names.
7. Verify in the database that the logged expense's `split_users` array excludes Bob's UUID.
