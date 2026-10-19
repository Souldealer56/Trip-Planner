import { createClient } from '@supabase/supabase-js'

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {})
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_KEY || env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Verify that your .env file defines VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
