import { NextRequest } from 'next/server'
import { supabase } from './supabase'
import { AppError } from './utils/error-handler'
import type { User, Session } from '@supabase/supabase-js'

/**
 * Extract and verify JWT from an API request's Authorization header.
 * Throws AppError(401) if missing or invalid.
 */
export async function requireAuth(request: NextRequest): Promise<User> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    throw new AppError('Unauthorized', 401)
  }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    throw new AppError('Unauthorized', 401)
  }
  return user
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}
