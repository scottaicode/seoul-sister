/**
 * Environment Configuration Validator
 * Ensures all required environment variables are present and valid
 */

import { z } from 'zod'

// Define the environment schema
const envSchema = z.object({
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().startsWith('https://'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe Configuration
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  // Claude API
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),

  // Application Configuration
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']),

  // Security
  CRON_SECRET: z.string().min(32),
  API_SECRET_KEY: z.string().min(32).optional(),

  // Optional Services
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  APIFY_API_KEY: z.string().optional(),
  SUPADATA_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
})

type EnvConfig = z.infer<typeof envSchema>

class EnvironmentConfig {
  private static instance: EnvironmentConfig
  private config: EnvConfig | null = null
  private validationErrors: z.ZodError | null = null

  private constructor() {}

  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig()
    }
    return EnvironmentConfig.instance
  }

  validate(): boolean {
    try {
      this.config = envSchema.parse(process.env)
      this.validationErrors = null
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.validationErrors = error
        console.error('Environment validation failed:', error.errors)
      }
      return false
    }
  }

  get(): EnvConfig {
    if (!this.config) {
      if (!this.validate()) {
        throw new Error('Environment variables validation failed. Check logs for details.')
      }
    }
    return this.config!
  }

  getErrors(): z.ZodError | null {
    return this.validationErrors
  }

  isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
  }

  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development'
  }

  getSafePublicConfig() {
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
    }
  }
}

export const envConfig = EnvironmentConfig.getInstance()

// Validate on import in development
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  if (!envConfig.validate()) {
    console.warn('⚠️ Environment variables are not properly configured')
    console.warn('Copy .env.example to .env.local and fill in your values')
  }
}