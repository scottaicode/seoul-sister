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
              i <= strength ? current.color : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-white/40">{current.label} password</p>
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
  const [verificationSent, setVerificationSent] = useState(false)

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
      const result = await signUp(email, password)
      // If Supabase returns a user but no session, email confirmation is required
      if (result.user && !result.session) {
        setVerificationSent(true)
      } else {
        router.push('/onboarding')
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create account. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (verificationSent) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-gold to-gold-light shadow-glow-gold mb-4">
          <Mail className="w-7 h-7 text-seoul-dark" />
        </div>
        <h2 className="font-display text-xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">
          We sent a verification link to <span className="text-white font-medium">{email}</span>.
          Click it to activate your account, then come back to start your K-beauty journey.
        </p>
        <Link
          href="/login"
          className="glass-button-primary inline-flex items-center gap-2 px-6"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-gold to-gold-light shadow-glow-gold mb-4">
          <Sparkles className="w-7 h-7 text-seoul-dark" />
        </div>
        <h1 className="font-display text-2xl font-bold text-gradient">Seoul Sister</h1>
        <p className="text-white/40 text-sm mt-1">K-Beauty Intelligence Platform</p>
      </div>

      {/* Dark Card */}
      <div className="dark-card-gold p-8">
        <h2 className="text-xl font-bold text-white text-center mb-2">Join Seoul Sister</h2>
        <p className="text-white/40 text-sm text-center mb-8">
          Create your account to start your K-beauty journey
        </p>

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-snug">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-white/70 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="dark-input pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-white/70 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="dark-input pl-10 pr-11"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
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
              className="block text-sm font-medium text-white/70 mb-1.5"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className={`dark-input pl-10 pr-11 ${
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
                  <Check className="w-4 h-4 text-green-400" />
                )}
                <button
                  type="button"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  className="text-white/30 hover:text-white transition-colors"
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
                <span className="inline-block w-4 h-4 border-2 border-seoul-dark/40 border-t-seoul-dark rounded-full animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Free tier note */}
        <p className="text-xs text-center text-white/30 mt-4">
          Subscription required after account creation. $39.99/month.
        </p>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-seoul-card text-xs text-white/40">
              Already have an account?
            </span>
          </div>
        </div>

        {/* Login Link */}
        <Link
          href="/login"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium text-sm text-white/70 transition-all duration-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white active:scale-[0.98]"
        >
          Sign in instead
        </Link>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-white/30 mt-6">
        By joining you agree to our{' '}
        <Link href="/terms" className="underline hover:text-white/60 transition-colors">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-white/60 transition-colors">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}
