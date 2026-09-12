import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../db/supabase'

const AuthContext = createContext(null)

const NO_SUPABASE = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY
const LOCAL_SESSION = { user: { id: 'local', email: 'local@device' }, local: true }

export function AuthProvider({ children }) {
  const [session, setSession] = useState(NO_SUPABASE ? LOCAL_SESSION : undefined)

  useEffect(() => {
    if (NO_SUPABASE) return

    // Get the current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for sign-in / sign-out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    NO_SUPABASE
      ? Promise.resolve({ data: { session: LOCAL_SESSION }, error: null })
      : supabase.auth.signInWithPassword({ email, password })

  const signOut = () => {
    if (NO_SUPABASE) { setSession(null); return Promise.resolve() }
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
