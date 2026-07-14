# Phase 13 Validation Strategy — Webapp Debts Settlement Optimization

## Automated Verification Pipeline
We will implement an automated solver verification script `web/verify-settlement.cjs` that:
1. Feeds complex mock balances (some participants with credits, some with debits in multiple currencies) to our JavaScript conversion and settlement solver.
2. Asserts that the sum of debts matches the sum of credits.
3. Asserts that the solver outputs the correct, minimized set of transactions (verifying exact matching of large debtors to creditors).

### Wave 0 Test Execution
Command:
```bash
node web/verify-settlement.cjs
```
Success assertion: exits with status 0, confirming solver correctness.

### Linter Gate
Command:
```bash
npm run lint
```
Success assertion: exits with status 0.

---

## Manual Verification Procedurals (UAT)

### UAT-SET-01: Correct Multi-Currency Exchange Calculations
1. Open a trip where the base currency is USD.
2. Log an expense of `100 EUR` paid by Alice.
3. Observe the settlement tab. Verify that Alice's credit is listed in USD (converted using the live exchange rate, approximately `$108.50`).

### UAT-SET-02: Minimized Greedy Transactions
1. Log three expenses:
   - Alice paid $90.00 for Dinner (split between Alice, Bob, Charlie).
   - Bob paid $30.00 for Taxi (split between Alice, Bob, Charlie).
   - Charlie paid $0.00.
2. Net balances are:
   - Alice spent $90, share is $40 ➡️ Net: +$50.00
   - Bob spent $30, share is $40 ➡️ Net: -$10.00
   - Charlie spent $0, share is $40 ➡️ Net: -$40.00
3. Verify that the "Settle Up" transaction list shows exactly two transfers:
   - Charlie owes Alice: $40.00
   - Bob owes Alice: $10.00
4. Confirm no redundant circular payments are generated.

### UAT-SET-03: Zero Balance Empty State
1. If no expenses are logged, or all balances are settled to zero.
2. Open the "Settle Up" view.
3. Verify it displays: "Everyone is perfectly even!" with no transfer lists.
