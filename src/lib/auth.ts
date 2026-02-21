import { NextRequest } from 'next/server'
import { supabase, getServiceClient } from './supabase'
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

/**
 * Verify the request is from an authenticated admin user.
 *
 * Two-layer check (both must pass):
 * 1. JWT authentication — user must be logged in
 * 2. Admin verification — checks in order:
 *    a. ADMIN_EMAILS env var (comma-separated, bootstrap/fallback)
 *    b. is_admin column on ss_user_profiles (DB source of truth)
 *
 * Either source granting admin is sufficient. This allows bootstrapping
 * before the DB column exists and provides a fallback if the DB is down.
 *
 * Also accepts legacy service-role-key auth via x-service-key header
 * for backwards compatibility with CLI scripts and cron-triggered admin calls.
 *
 * Throws AppError(401) if not authenticated, AppError(403) if not admin.
 */
export async function requireAdmin(request: NextRequest): Promise<User> {
  // Legacy path: service role key (for CLI scripts, cron-to-admin calls)
  const serviceKeyHeader = request.headers.get('x-service-key')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKeyHeader && serviceKey && serviceKeyHeader === serviceKey) {
    // Service key auth — return a synthetic user object for logging purposes
    // The caller is trusted (has the service role key)
    return { id: 'service-role', email: 'admin@service-role' } as User
  }

  // JWT auth — user must be logged in
  const user = await requireAuth(request)

  // Check ADMIN_EMAILS env var
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? []
  if (user.email && adminEmails.includes(user.email.toLowerCase())) {
    return user
  }

  // Check is_admin column in database
  try {
    const db = getServiceClient()
    const { data } = await db
      .from('ss_user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (data?.is_admin === true) {
      return user
    }
  } catch {
    // DB check failed — fall through to denial
  }

  throw new AppError('Forbidden: admin access required', 403)
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
