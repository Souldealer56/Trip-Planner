# Phase 2: Database & Data Access Layer - Research

## User Constraints

Captured from [02-CONTEXT.md](file:///.planning/phases/02-database-data-access-layer/02-CONTEXT.md):

*   **D-01:** Plain database operations will be encapsulated inside a structured service layer (`web/src/services/trips.js`, `web/src/services/rsvps.js`, `web/src/services/users.js`) and exposed to React visual components via custom hooks (e.g. `useTrips`, `useTripDetails`, `useRsvpRoster`) rather than putting Supabase query calls inline in components.
*   **D-02:** When a user registers / joins a trip from the web application, the data service must generate a unique negative integer `telegram_id` (e.g. `-1000000 - Math.floor(Math.random() * 1000000)`) to ensure zero database key collisions with real positive Telegram User IDs synced by the bot.
*   **D-03:** Since real-time synchronization is out of scope, the frontend will use a combined approach: automatically query/refresh data on route navigation, and provide a premium "Refresh" header button to manually trigger fresh database fetches.
*   **D-04:** Network or query execution failures must be handled gracefully by displaying custom inline glassmorphism error notification cards inside the page layout that include a "Retry" button, rather than crashing the interface.

## Project Constraints (from GEMINI.md)

*   **Tech Stack (Bot):** Python 3.13 / Supabase / Python-Telegram-Bot — existing codebase constraint.
*   **Tech Stack (Web):** React + Vite + Vanilla CSS — user preference.
*   **Authentication:** No authentication in v1 — user request.

## Standard Stack

*   **Supabase Client:** `@supabase/supabase-js` 2.x [VERIFIED: npm registry]
*   **Core UI Library:** React 19.x [VERIFIED: npm registry]

## Architecture Patterns

### Service Layer Design

We will encapsulate all Supabase queries in services:

```javascript
// web/src/services/trips.js
import { supabase } from './supabase'

export async function fetchTrips() {
  const { data, error } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, base_currency')
    .order('start_date', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchTripById(id) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
```

```javascript
// web/src/services/rsvps.js
import { supabase } from './supabase'

export async function fetchRsvpRoster(tripId) {
  const { data, error } = await supabase
    .from('rsvps')
    .select('status, user_id, users(*)')
    .eq('trip_id', tripId)
  if (error) throw error
  return data
}

export async function createRsvp(tripId, userId, status = 'Committed') {
  const { data, error } = await supabase
    .from('rsvps')
    .insert({ trip_id: tripId, user_id: userId, status })
    .select()
    .single()
  if (error) throw error
  return data
}
```

```javascript
// web/src/services/users.js
import { supabase } from './supabase'

export async function createUser(username, firstName) {
  const telegramId = -1000000 - Math.floor(Math.random() * 1000000)
  const { data, error } = await supabase
    .from('users')
    .insert({
      telegram_id: telegramId,
      username: username || null,
      first_name: firstName
    })
    .select()
    .single()
  if (error) throw error
  return data
}
```

### Custom Hooks Abstraction

We will write custom hooks that manage loading, error, data state, and expose a `refresh` trigger function:

```javascript
// web/src/hooks/useTrips.js
import { useState, useEffect, useCallback } from 'react'
import { fetchTrips } from '../services/trips'

export function useTrips() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const trips = await fetchTrips()
      setData(trips)
    } catch (err) {
      setError(err.message || 'Failed to fetch trips')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return { data, loading, error, refresh: loadData }
}
```

## Don't Hand-Roll

*   **Don't hand-roll relationships/joins**: Do not query RSVPs and then manually query users for each RSVP in a loop. Use Supabase (Postgrest) native relation syntax `users(*)` to fetch associated users in a single query [CITED: supabase.com/docs/reference/javascript/select#query-foreign-tables].
*   **Don't hand-roll state management**: Do not use complex context setups for simple page queries. Use standalone custom React hooks that cleanly encapsulate `useState`, `useEffect`, and custom service logic.

## Common Pitfalls

*   **PostgreSQL RLS Policies**: If the `users` or `rsvps` tables have Row Level Security (RLS) enabled, insertions might fail silently or return empty sets if select/insert policies aren't set up. We must make sure RLS policies permit anonymous reads and writes.
*   **Database Constraints**: The `users.telegram_id` column might be unique. Generating a random negative integer guarantees uniqueness and prevents collisions, but we must handle any duplicate key conflict gracefully if a collision does happen.

## Package Legitimacy Audit

No new external npm packages are introduced in this phase. We are leveraging the libraries installed in Phase 1 (`react`, `@supabase/supabase-js`, `react-router-dom`).

## Validation Architecture

To verify the setup, we will create the following automated checks:

1.  **Static Hook Import Checks**:
    *   Verify files `useTrips.js`, `useTripDetails.js`, `useRsvpRoster.js` export their respective hooks.
2.  **Database Integration Test Script (`web/verify-services.cjs`)**:
    *   Create a standalone script that connects to Supabase using parent credentials.
    *   Test service execution: fetch existing trips.
    *   Insert a temporary test user (using negative `telegram_id` to prevent collisions) and create a committed RSVP on the first trip found.
    *   Query the RSVP roster of that trip to verify the test user is present.
    *   Delete the temporary test user at the end (safely cleaning up the database).
    *   Exit with code 0 on success, code 1 on failure.

---

*Phase: 2-Database & Data Access Layer*
*Research completed: 2026-07-12*
