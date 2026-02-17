'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Check, Sparkles, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const strength = checks.filter(Boolean).length

  const levels = [
    { label: 'Weak', color: 'bg-red-400' },
    { label: 'Fair', color: 'bg-orange-400' },
    { label: 'Good', color: 'bg-yellow-400' },
    { label: 'Strong', color: 'bg-green-400' },
  ]

  if (!password) return null

  const current = levels[strength - 1] ?? levels[0]

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= strength ? current.color : 'bg-seoul-soft/20'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-seoul-soft">{current.label} password</p>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsLoading(true)

    try {
      await signUp(email, password)
      router.push('/onboarding')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create account. Please try again.'
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
        <h2 className="section-heading text-center mb-2">Join Seoul Sister</h2>
        <p className="text-seoul-soft text-sm text-center mb-8">
          Create your free account and start your K-beauty journey
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
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
            <PasswordStrengthBar password={password} />
          </div>

          {/* Confirm Password Field */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-seoul-charcoal mb-1.5"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-seoul-soft/60 pointer-events-none" />
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className={`glass-input pl-10 pr-11 ${
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? 'ring-2 ring-green-400/40 border-green-400/50'
                      : 'ring-2 ring-red-400/40 border-red-400/50'
                    : ''
                }`}
                disabled={isLoading}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {confirmPassword.length > 0 && passwordsMatch && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                <button
                  type="button"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  className="text-seoul-soft/60 hover:text-seoul-charcoal transition-colors"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
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
                Creating account...
              </>
            ) : (
              'Create Free Account'
            )}
          </button>
        </form>

        {/* Free tier note */}
        <p className="text-xs text-center text-seoul-soft mt-4">
          Free forever -- no credit card required
        </p>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-seoul-soft/20" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-white/70 text-xs text-seoul-soft">
              Already have an account?
            </span>
          </div>
        </div>

        {/* Login Link */}
        <Link
          href="/login"
          className="glass-button w-full flex items-center justify-center gap-2 text-sm text-seoul-charcoal"
        >
          Sign in instead
        </Link>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-seoul-soft mt-6">
        By joining you agree to our{' '}
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
