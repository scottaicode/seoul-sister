'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Check, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setIsLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send reset email. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-gold to-gold-light shadow-glow-gold mb-4">
          <Check className="w-7 h-7 text-seoul-dark" />
        </div>
        <h2 className="font-display text-xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto">
          We sent a password reset link to <strong className="text-white/80">{email}</strong>.
          Click the link in the email to set a new password.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-gold-light hover:text-gold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-gold to-gold-light shadow-glow-gold mb-4">
          <Mail className="w-7 h-7 text-seoul-dark" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-sm text-white/50">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-white/60 mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-white/30"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all duration-300 disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="text-center mt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>
      </p>
    </div>
  )
}
