'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from './AuthModal'
import { User, ChevronDown, Camera, Heart, ShoppingBag, Settings, LogOut } from 'lucide-react'

export default function AuthHeader() {
  console.log('🎯 AuthHeader: Component rendering')
  const [authState, setAuthState] = useState<{user: any, userProfile: any, loading: boolean}>({ user: null, userProfile: null, loading: true })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Try to use context, but fallback to direct checks if context fails or has no user
  let user, userProfile, signOut, loading
  let usingFallback = false

  try {
    const authContext = useAuth()
    // Use context if it has a user, otherwise use fallback
    if (authContext.user) {
      user = authContext.user
      userProfile = authContext.userProfile
      signOut = authContext.signOut
      loading = authContext.loading
      console.log('🎯 AuthHeader: Using context with user:', authContext.user.email)
    } else {
      // Context exists but no user, use fallback
      user = authState.user
      userProfile = authState.userProfile
      loading = authState.loading
      usingFallback = true
      signOut = async () => {
        console.log('Fallback signout - clearing session')
        try {
          const { createClient } = await import('@/lib/supabase')
          const supabase = createClient()
          await supabase.auth.signOut()
          setAuthState({ user: null, userProfile: null, loading: false })
          window.location.href = '/'
        } catch (error) {
          console.log('Signout error:', error)
          window.location.href = '/'
        }
      }
      console.log('🎯 AuthHeader: Context has no user, using fallback:', { hasUser: !!user })
    }
  } catch (error) {
    console.log('🎯 AuthHeader: Context failed completely, using fallback:', error)
    user = authState.user
    userProfile = authState.userProfile
    loading = authState.loading
    usingFallback = true
    signOut = async () => {
      console.log('Fallback signout after context error')
      try {
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()
        await supabase.auth.signOut()
        setAuthState({ user: null, userProfile: null, loading: false })
        window.location.href = '/'
      } catch (error) {
        console.log('Signout error:', error)
        window.location.href = '/'
      }
    }
  }

  // Direct auth check - run more aggressively
  useEffect(() => {
    console.log('🎯 AuthHeader: Running auth check, user:', !!user)
    if (typeof window !== 'undefined') {
      const checkAuth = async () => {
        try {
          const { createClient } = await import('@/lib/supabase')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          console.log('🎯 AuthHeader: Session check result:', {
            hasSession: !!session,
            hasUser: !!session?.user,
            email: session?.user?.email
          })

          if (session?.user) {
            console.log('🎯 AuthHeader: Found user session, updating state')
            setAuthState({
              user: session.user,
              userProfile: { name: session.user.email?.split('@')[0] || 'User', email: session.user.email },
              loading: false
            })
          } else {
            console.log('🎯 AuthHeader: No user session found')
            setAuthState({ user: null, userProfile: null, loading: false })
          }
        } catch (err) {
          console.log('🎯 AuthHeader: Auth check error:', err)
          setAuthState({ user: null, userProfile: null, loading: false })
        }
      }
      checkAuth()
    }
  }, []) // Run on every component mount

  // Also run auth check when URL changes
  useEffect(() => {
    const handleRouteChange = () => {
      console.log('🎯 AuthHeader: Route changed, rechecking auth')
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          const checkAuth = async () => {
            try {
              const { createClient } = await import('@/lib/supabase')
              const supabase = createClient()
              const { data: { session } } = await supabase.auth.getSession()
              if (session?.user) {
                setAuthState({
                  user: session.user,
                  userProfile: { name: session.user.email?.split('@')[0] || 'User', email: session.user.email },
                  loading: false
                })
              }
            } catch (err) {
              console.log('🎯 AuthHeader: Route auth check failed:', err)
            }
          }
          checkAuth()
        }, 100)
      }
    }

    // Listen for route changes
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  console.log('🎯 AuthHeader: Final state:', {
    hasUser: !!user,
    userEmail: user?.email,
    loading,
    profileName: userProfile?.name,
    usingFallback,
    fallbackUser: authState.user?.email
  })

  // Add debugging to see what's happening with auth state
  useEffect(() => {
    console.log('AuthHeader: user state changed:', {
      user: user?.email,
      userProfile: userProfile?.name,
      loading,
      hasUser: !!user,
      url: window.location.href
    })

    // Force loading to false if we have a user but loading is stuck
    if (user && loading) {
      console.log('AuthHeader: User exists but loading is stuck, this should not happen')
    }
  }, [user, userProfile, loading])

  const handleAuthSuccess = (user: any) => {
    console.log('User authenticated:', user)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    setShowDropdown(false)

    // Don't wait for the signOut promise, let it handle redirect
    signOut()
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-40 bg-transparent">
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-xl tracking-wider" style={{
              color: '#d4a574',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '400',
              letterSpacing: '0.05em'
            }}>
              Seoul Sister
            </h1>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-12">
            <a href="#collection" className="transition-colors" style={{
              color: '#888888',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: '400',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#d4a574'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}>
              COLLECTION
            </a>
            <a href="/personalized-dashboard" className="transition-colors" style={{
              color: '#888888',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: '400',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#d4a574'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}>
              AI DASHBOARD
            </a>
            <a href="#about" className="transition-colors" style={{
              color: '#888888',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: '400',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#d4a574'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}>
              ABOUT
            </a>
            <a href="#insider-access" className="transition-colors" style={{
              color: '#888888',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: '400',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#d4a574'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}>
              INSIDER ACCESS
            </a>
          </nav>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="w-8 h-8 border-2 border-luxury-gold/30 border-t-luxury-gold rounded-full animate-spin"></div>
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 bg-luxury-charcoal/50 hover:bg-luxury-charcoal/70 border border-luxury-gold/30 px-3 py-2 rounded-lg transition-colors backdrop-blur-sm"
                >
                  <div className="w-8 h-8 bg-luxury-gold rounded-full flex items-center justify-center">
                    <User size={16} className="text-black" />
                  </div>
                  <span className="text-sm font-medium text-white tracking-wide">
                    {userProfile?.name || user.email?.split('@')[0]}
                  </span>
                  <ChevronDown size={16} className="text-gray-300" />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-luxury-charcoal rounded-lg shadow-lg border border-luxury-gold/30 py-2 z-50 backdrop-blur-sm">
                    <div className="px-4 py-2 border-b border-luxury-gold/20">
                      <p className="text-sm font-medium text-white">
                        {userProfile?.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>

                    <div className="py-1">
                      <a
                        href="/skin-profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-luxury-gold/20 hover:text-luxury-gold transition-colors"
                      >
                        <Camera size={16} className="mr-3" />
                        Skin Profile
                      </a>
                      <a
                        href="/personalized-dashboard"
                        className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-luxury-gold/20 hover:text-luxury-gold transition-colors"
                      >
                        <Heart size={16} className="mr-3" />
                        AI Beauty Hub
                      </a>
                      <a
                        href="/"
                        className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-luxury-gold/20 hover:text-luxury-gold transition-colors"
                      >
                        <ShoppingBag size={16} className="mr-3" />
                        Shop Products
                      </a>
                      <a
                        href="/admin/ai-features"
                        className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-luxury-gold/20 hover:text-luxury-gold transition-colors"
                      >
                        <Settings size={16} className="mr-3" />
                        Admin Portal
                      </a>
                    </div>

                    <div className="border-t border-luxury-gold/20 py-1">
                      <button
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-luxury-gold/20 hover:text-luxury-gold transition-colors disabled:opacity-50"
                      >
                        <LogOut size={16} className="mr-3" />
                        {signingOut ? 'Signing out...' : 'Sign Out'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-8 py-2.5 transition-all duration-300"
                style={{
                  border: '1px solid #d4a574',
                  color: '#d4a574',
                  backgroundColor: 'transparent',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: '400',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#d4a574'
                  e.currentTarget.style.color = '#000000'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#d4a574'
                }}
              >
                JOIN
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Backdrop for dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </header>
  )
}