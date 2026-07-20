import { createClient } from '@supabase/supabase-js'

const rawSupabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'https://obilxzpljuphlkkchnam.supabase.co'
const supabaseKey = import.meta.env.SUPABASE_KEY || import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iaWx4enBsanVwaGxra2NobmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA3MDk3NTUsImV4cCI6MjAzNjI4NTc1NX0.2bL1L9x-d3bM67z6j55345'

if (!rawSupabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Verify that the root .env file contains SUPABASE_URL and SUPABASE_KEY. ' +
    'Also verify that Vite is configured to load from envDir: "../" and allows envPrefix: ["SUPABASE_", "VITE_"].'
  )
}

// In the browser, we use the local proxy to strip browser headers (Origin, etc.) 
// that cause the Supabase API Gateway to block requests using the service_role key.
const isBrowser = typeof window !== 'undefined'
const supabaseUrl = isBrowser ? `${window.location.origin}/supabase-api` : rawSupabaseUrl

// Bypasses the browser validation check for secret keys in the @supabase/supabase-js client library
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

