import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Verify that the root .env file contains SUPABASE_URL and SUPABASE_KEY. ' +
    'Also verify that Vite is configured to load from envDir: "../" and allows envPrefix: ["SUPABASE_", "VITE_"].'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
