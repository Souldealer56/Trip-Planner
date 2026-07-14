# Phase 13 Research — Webapp Debts Settlement Optimization

## Exchange Rate API Integration
We will retrieve exchange rates from a public API endpoint:
`https://open.er-api.com/v6/latest/USD`

This endpoint returns a JSON payload containing:
```json
{
  "result": "success",
  "base_code": "USD",
  "rates": {
    "USD": 1.0,
    "EUR": 0.9213,
    "GBP": 0.7854,
    "CAD": 1.368,
    "AUD": 1.503
  }
}
```

### Conversion Formula in JavaScript
To perform conversions between any two currencies using USD as the base rate:
```javascript
export function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (!rates) return amount
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()
  if (from === to) return amount
  if (!rates[from] || !rates[to]) return amount // fallback
  return (amount / rates[from]) * rates[to]
}
```

## Exact Split Debt Calculation
To determine net balances correctly:
1. Initialize a balance structure for each committed roster member:
   ```javascript
   const balances = {}
   committedMembers.forEach(m => {
     balances[m.user_id] = {
       userId: m.user_id,
       name: m.users?.first_name || m.username,
       paid: 0.0,
       owed: 0.0
     }
   })
   ```
2. Loop over each expense and compute splits:
   - Convert amount to base currency.
   - Determine who splits it: if `split_users` array is present and has items, split among those users. Otherwise, split among all committed members.
   - Add split amount to each split participant's `owed` balance.
   - Add full converted amount to the payer's `paid` balance.
3. Compute net balances:
   - `netBalance = paid - owed`
4. Split members into `debtors` (negative net balance) and `creditors` (positive net balance).

## Greedy Transaction Solver in JavaScript
```javascript
export function calculateSettlements(balances) {
  const debtors = []
  const creditors = []

  Object.values(balances).forEach(b => {
    const net = b.paid - b.owed
    if (net > 0.01) {
      creditors.push({ userId: b.userId, name: b.name, amount: net })
    } else if (net < -0.01) {
      debtors.push({ userId: b.userId, name: b.name, amount: Math.abs(net) })
    }
  })

  // Sort descending to greedily match largest debtors with largest creditors
  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const transactions = []
  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const payAmount = Math.min(debtor.amount, creditor.amount)

    transactions.push({
      fromId: debtor.userId,
      fromName: debtor.name,
      toId: creditor.userId,
      toName: creditor.name,
      amount: payAmount
    })

    debtor.amount -= payAmount
    creditor.amount -= payAmount

    if (debtor.amount < 0.01) i++
    if (creditor.amount < 0.01) j++
  }

  return transactions
}
```
