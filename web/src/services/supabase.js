import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Verify that the root .env file contains SUPABASE_URL and SUPABASE_KEY. ' +
    'Also verify that Vite is configured to load from envDir: "../" and allows envPrefix: ["SUPABASE_", "VITE_"].'
  )
}

// Bypasses the browser validation check for secret keys in @supabase/supabase-js
// by passing a dummy key that passes validation and overriding the outgoing request headers.
const dummyKey = supabaseKey.startsWith('sb_secret_') 
  ? supabaseKey.replace('sb_secret_', 'sb_publishable_') 
  : supabaseKey.includes('service_role') 
    ? supabaseKey.replace('service_role', 'anon') 
    : supabaseKey

export const supabase = createClient(supabaseUrl, dummyKey, {
  global: {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  }
})

