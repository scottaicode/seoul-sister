'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Sparkles, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await signIn(email, password)

      // Check if onboarding is completed
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      if (session) {
        const profileRes = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const profileData = await profileRes.json()
        if (!profileData.profile || !profileData.profile.onboarding_completed) {
          router.push('/onboarding')
          return
        }
      }

      router.push('/dashboard')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to sign in. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-rose-gold to-glass-500 shadow-glow-pink mb-4">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h1 className="font-display text-2xl font-bold text-gradient">Seoul Sister</h1>
        <p className="text-seoul-soft text-sm mt-1">K-Beauty Intelligence Platform</p>
      </div>

      {/* Glass Card */}
      <div className="glass-card p-8">
        <h2 className="section-heading text-center mb-2">Welcome Back</h2>
        <p className="text-seoul-soft text-sm text-center mb-8">
          Sign in to your beauty intelligence dashboard
        </p>

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-red-50/80 border border-red-200/60 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-snug">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-seoul-charcoal mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-seoul-soft/60 pointer-events-none" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="glass-input pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-seoul-charcoal mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-seoul-soft/60 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="glass-input pl-10 pr-11"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-seoul-soft/60 hover:text-seoul-charcoal transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-glass-600 hover:text-glass-700 font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="glass-button-primary w-full flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-seoul-soft/20" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-white/70 text-xs text-seoul-soft">
              New to Seoul Sister?
            </span>
          </div>
        </div>

        {/* Register Link */}
        <Link
          href="/register"
          className="glass-button w-full flex items-center justify-center gap-2 text-sm text-seoul-charcoal"
        >
          Create a free account
        </Link>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-seoul-soft mt-6">
        By signing in you agree to our{' '}
        <Link href="/terms" className="underline hover:text-seoul-charcoal transition-colors">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-seoul-charcoal transition-colors">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}
