'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { User, Mail, Lock, X } from 'lucide-react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: any) => void
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        // Sign up new user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            },
          },
        })

        if (error) throw error

        if (data.user) {
          // Create user profile
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              name: name,
              skin_concerns: [],
              ingredient_allergies: [],
              preferred_ingredients: [],
              ingredients_to_avoid: [],
              price_range_min: 0,
              price_range_max: 100,
              product_history: {},
              skin_analysis_history: {},
              recommendation_feedback: {}
            })

          if (profileError) {
            console.error('Profile creation error:', profileError)
          }

          onSuccess(data.user)
          onClose()
        }
      } else {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          onSuccess(data.user)
          onClose()
        }
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })
      if (error) throw error
      setShowEmailConfirmation(true)
      setError('')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-luxury-charcoal to-black border border-luxury-gold/30 rounded-2xl p-8 w-full max-w-md relative shadow-2xl shadow-luxury-gold/10">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="flex items-center text-gray-400 hover:text-luxury-gold transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-light text-white mb-2 tracking-wide">
            {isSignUp ? 'Start Your Premium Trial' : 'Welcome Back'}
          </h2>
          <p className="text-gray-400 mb-2">
            {isSignUp
              ? '7 days free, then $20/month for full access to advanced skin intelligence, personalized K-beauty recommendations, and Seoul wholesale pricing'
              : 'Sign in to access your premium Seoul Sister membership features'
            }
          </p>
          {isSignUp && (
            <p className="text-luxury-gold text-sm font-medium">
              Cancel anytime during your free trial
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
            {error.includes('Email not confirmed') && (
              <button
                onClick={handleResendConfirmation}
                className="mt-2 text-luxury-gold hover:text-luxury-gold/80 text-sm underline"
                disabled={loading}
              >
                Resend confirmation email
              </button>
            )}
          </div>
        )}

        {showEmailConfirmation && (
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-4">
            <p className="text-blue-400 text-sm">
              ✅ Confirmation email sent! Please check your inbox and click the link to verify your account.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-luxury-charcoal/50 border border-luxury-gold/30 text-white rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold placeholder-gray-400"
                  placeholder="Your name"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-luxury-charcoal/50 border border-luxury-gold/30 text-white rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold placeholder-gray-400"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-luxury-charcoal/50 border border-luxury-gold/30 text-white rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold placeholder-gray-400"
                placeholder="Password"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-luxury-gold text-black py-3 rounded-lg font-semibold hover:bg-luxury-gold/90 transition-all duration-200 disabled:opacity-50 tracking-wide shadow-lg"
          >
            {loading ? 'Loading...' : isSignUp ? 'Start Free Trial' : 'Sign In'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-luxury-gold/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gradient-to-b from-luxury-charcoal to-black text-gray-400 font-light">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full border border-luxury-gold/30 bg-luxury-charcoal/30 text-gray-300 py-3 rounded-lg font-semibold hover:bg-luxury-charcoal/50 hover:border-luxury-gold/50 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 tracking-wide"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google
        </button>

        <div className="text-center mt-6">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-luxury-gold hover:text-luxury-gold/80 font-medium tracking-wide"
          >
            {isSignUp
              ? 'Already have a premium membership? Sign in'
              : "Don't have a membership? Start free trial"
            }
          </button>
        </div>
      </div>
    </div>
  )
}