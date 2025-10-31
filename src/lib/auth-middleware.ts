/**
 * Authentication & Authorization Middleware
 * Handles API route protection and role-based access control
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// User roles
export enum UserRole {
  USER = 'user',
  PREMIUM = 'premium',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

interface AuthConfig {
  requireAuth?: boolean
  requireRoles?: UserRole[]
  allowApiKey?: boolean
  customValidator?: (req: NextRequest) => Promise<boolean>
}

class AuthMiddleware {
  private supabase: ReturnType<typeof createClient> | null = null

  constructor() {
    // Initialize Supabase client if env vars are available
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    }
  }

  /**
   * Verify API key for server-to-server communication
   */
  private verifyApiKey(req: NextRequest): boolean {
    const apiKey = req.headers.get('x-api-key')
    const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')

    // Check for valid API key
    if (apiKey && process.env.API_SECRET_KEY) {
      return apiKey === process.env.API_SECRET_KEY
    }

    // Check for valid cron secret (backward compatibility)
    if (cronSecret && process.env.CRON_SECRET) {
      return cronSecret === process.env.CRON_SECRET
    }

    return false
  }

  /**
   * Generate a secure API key
   */
  static generateApiKey(): string {
    return `ss_${crypto.randomBytes(32).toString('hex')}`
  }

  /**
   * Generate a secure secret
   */
  static generateSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Get user from session token
   */
  private async getUserFromToken(req: NextRequest) {
    if (!this.supabase) {
      return null
    }

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return null
    }

    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token)
      if (error || !user) {
        return null
      }

      // Get user profile with role
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('*, subscription_status')
        .eq('id', user.id)
        .single()

      return {
        ...user,
        role: this.getUserRole(profile),
        profile
      }
    } catch (error) {
      console.error('Error getting user from token:', error)
      return null
    }
  }

  /**
   * Determine user role based on profile
   */
  private getUserRole(profile: any): UserRole {
    if (!profile) return UserRole.USER

    // Check for admin flag
    if (profile.is_super_admin) return UserRole.SUPER_ADMIN
    if (profile.is_admin) return UserRole.ADMIN

    // Check subscription status
    if (profile.subscription_status === 'active' ||
        profile.subscription_status === 'trialing') {
      return UserRole.PREMIUM
    }

    return UserRole.USER
  }

  /**
   * Main authentication check
   */
  async authenticate(
    req: NextRequest,
    config: AuthConfig = {}
  ): Promise<NextResponse | null> {
    // Check if API key is provided and allowed
    if (config.allowApiKey && this.verifyApiKey(req)) {
      return null // Allow request
    }

    // Check if authentication is required
    if (!config.requireAuth) {
      return null // Allow request
    }

    // Get user from token
    const user = await this.getUserFromToken(req)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check role requirements
    if (config.requireRoles && config.requireRoles.length > 0) {
      if (!config.requireRoles.includes(user.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Run custom validator if provided
    if (config.customValidator) {
      const isValid = await config.customValidator(req)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Request validation failed' },
          { status: 403 }
        )
      }
    }

    // Add user to request for downstream use
    (req as any).user = user

    return null // Allow request
  }
}

// Create singleton instance
const authMiddleware = new AuthMiddleware()

// Export middleware factory
export function withAuth(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: AuthConfig = { requireAuth: true }
) {
  return async (req: NextRequest) => {
    const authResponse = await authMiddleware.authenticate(req, config)
    if (authResponse) {
      return authResponse
    }
    return handler(req)
  }
}

// Export preset configurations
export const authPresets = {
  // Public endpoint - no auth required
  public: {
    requireAuth: false
  },

  // Requires user to be logged in
  user: {
    requireAuth: true
  },

  // Requires premium subscription
  premium: {
    requireAuth: true,
    requireRoles: [UserRole.PREMIUM, UserRole.ADMIN, UserRole.SUPER_ADMIN]
  },

  // Requires admin role
  admin: {
    requireAuth: true,
    requireRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN]
  },

  // Requires super admin role
  superAdmin: {
    requireAuth: true,
    requireRoles: [UserRole.SUPER_ADMIN]
  },

  // Server-to-server with API key
  api: {
    requireAuth: false,
    allowApiKey: true
  },

  // Mixed - allow API key or user auth
  mixed: {
    requireAuth: true,
    allowApiKey: true
  }
}

export default authMiddleware
export { AuthMiddleware }