import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const SUPABASE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey)

if (!SUPABASE_CONFIGURED) {
  console.warn('Supabase env vars missing — running in local-only mode. Copy .env.example to .env and fill in your project values.')
}

// When credentials are missing, createClient would throw on an invalid URL.
// Provide a no-op stub so the rest of the app can import this module safely.
export const supabase = SUPABASE_CONFIGURED
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'No Supabase credentials configured.' } }),
        signOut: () => Promise.resolve(),
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        gt: () => Promise.resolve({ data: [], error: null }),
      }),
    }
