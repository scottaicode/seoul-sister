import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/types/user'

export interface AuthState {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  error: string | null
}

export interface AuthError {
  message: string
  code?: string
  details?: any
}

export class AuthenticationError extends Error {
  public code?: string
  public details?: any

  constructor(message: string, code?: string, details?: any) {
    super(message)
    this.name = 'AuthenticationError'
    this.code = code
    this.details = details
  }
}

export function handleAuthError(error: any): AuthError {
  if (error instanceof AuthenticationError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details
    }
  }

  if (error?.message) {
    return {
      message: error.message,
      code: error.code,
      details: error
    }
  }

  return {
    message: 'An authentication error occurred',
    details: error
  }
}

export function isAuthenticatedUser(user: User | null): user is User {
  return user !== null && user.id !== undefined
}

export function createAuthState(
  user: User | null = null,
  userProfile: UserProfile | null = null,
  loading: boolean = false,
  error: string | null = null
): AuthState {
  return {
    user,
    userProfile,
    loading,
    error
  }
}