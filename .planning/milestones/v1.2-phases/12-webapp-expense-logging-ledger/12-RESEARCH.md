# Phase 12 Research — Webapp Expense Logging & Ledger

## Domain Map
The shared expense tracker uses the `expenses` table inside Supabase. To support selective splits and multi-currency formatting on the web interface, the schema is extended with:
- `currency` (TEXT): The ISO code of the expense transaction (e.g., USD, EUR).
- `split_users` (JSONB): A JSON array of user UUID strings who split the expense.

### DB Schema Details
Table: `expenses`
- `id` (uuid, primary key)
- `trip_id` (uuid, foreign key referencing `trips.id`)
- `paid_by` (uuid, foreign key referencing `users.id`)
- `amount` (numeric/decimal)
- `currency` (text)
- `description` (text)
- `split_users` (jsonb)
- `created_at` (timestamp)

## Proposed Services

We will implement client service queries inside `web/src/services/expenses.js`:

```javascript
import { supabase } from './supabase'

/**
 * Fetch all expenses logged for a trip, joining with the payer's user details.
 */
export async function fetchExpenses(tripId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, users!expenses_paid_by_fkey(first_name, username)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Logs a new expense with currency and split selections.
 */
export async function logExpense(tripId, paidByUserId, amount, currency, description, splitUsers) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      trip_id: tripId,
      paid_by: paidByUserId,
      amount: parseFloat(amount),
      currency: currency || 'USD',
      description: description || '',
      split_users: splitUsers || []
    })
    .select()
    .single()

  if (error) throw error
  return data
}
```

## UI Elements & Layouts
- **Add Expense Button:** Integrated alongside RSVP selector or members roster in the details view header.
- **Add Expense Modal:** Glassmorphic overlay form featuring:
  - Description input (required)
  - Amount input (required, validation for positive numbers)
  - Currency dropdown (USD, EUR, GBP, CAD, AUD)
  - Paid By selector (defaults to current active user, allows changing to other committed roster members)
  - "Split Equally" toggle. When toggled OFF, displays checklists of committed members.
- **Ledger Container:** A clean, responsive list grid representing itemized logs with split participant badges.
