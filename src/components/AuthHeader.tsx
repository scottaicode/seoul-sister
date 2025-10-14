'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthState } from '@/hooks/useAuthState'
import AuthModal from './AuthModal'
import { User, ChevronDown, Camera, Heart, ShoppingBag, Settings, LogOut } from 'lucide-react'

export default function AuthHeader() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { user, loading, signOut, refresh, isAuthenticated } = useAuthState()

  const displayName = user?.email?.split('@')[0] || 'User'

  useEffect(() => {
    setMounted(true)
    refresh()

    // Failsafe timeout to ensure component renders even if auth is slow
    const mountTimeout = setTimeout(() => {
      setMounted(true)
    }, 2000)

    return () => clearTimeout(mountTimeout)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleAuthSuccess = (user: any) => {
    refresh()
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    setShowDropdown(false)
    await signOut()
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-transparent">
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
            <a href="/intelligence" className="transition-colors" style={{
              color: '#888888',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: '400',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#d4a574'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}>
              INTELLIGENCE
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
            {!mounted ? (
              <div className="w-8 h-8 border-2 border-[#d4a574]/30 border-t-[#d4a574] rounded-full animate-spin"></div>
            ) : loading ? (
              <div className="w-8 h-8 border-2 border-[#d4a574]/30 border-t-[#d4a574] rounded-full animate-spin"></div>
            ) : isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 bg-black/50 hover:bg-black/70 border border-[#d4a574]/30 px-3 py-2 rounded-lg transition-colors backdrop-blur-sm"
                >
                  <div className="w-8 h-8 bg-[#d4a574] rounded-full flex items-center justify-center">
                    <User size={16} className="text-black" />
                  </div>
                  <span className="text-sm font-medium text-white tracking-wide">
                    {displayName}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-300 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                  />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-black/95 rounded-lg shadow-xl border border-[#d4a574]/30 overflow-hidden backdrop-blur-xl"
                       style={{ zIndex: 9999 }}>
                    <div className="px-4 py-3 border-b border-[#d4a574]/20">
                      <p className="text-sm font-medium text-white">
                        {displayName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>

                    <div className="py-1">
                      <a
                        href="/skin-profile"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-[#d4a574]/20 hover:text-[#d4a574] transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <div className="flex items-center">
                          <Camera size={16} className="mr-3" />
                          Skin Profile
                        </div>
                      </a>
                      <a
                        href="/personalized-dashboard"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-[#d4a574]/20 hover:text-[#d4a574] transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <div className="flex items-center">
                          <Heart size={16} className="mr-3" />
                          AI Beauty Hub
                        </div>
                      </a>
                      <a
                        href="/premium"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-[#d4a574]/20 hover:text-[#d4a574] transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 9 5.16-.74 9-4.45 9-9V7l-10-5z"/>
                          </svg>
                          Premium Dashboard
                        </div>
                      </a>
                      <a
                        href="/intelligence"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-[#d4a574]/20 hover:text-[#d4a574] transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M9 19c-5 0-8-3-8-6s3-6 8-6c2 0 4 1 6 3l-2 2h4V8l-2 2C15 8 12 6 9 6c-6 0-10 4-10 8s4 8 10 8h8v-2H9z"/>
                          </svg>
                          Intelligence Reports
                        </div>
                      </a>
                      <a
                        href="/"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-[#d4a574]/20 hover:text-[#d4a574] transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <div className="flex items-center">
                          <ShoppingBag size={16} className="mr-3" />
                          Shop Products
                        </div>
                      </a>
                      <a
                        href="/admin/ai-features"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-[#d4a574]/20 hover:text-[#d4a574] transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <div className="flex items-center">
                          <Settings size={16} className="mr-3" />
                          Admin Portal
                        </div>
                      </a>
                    </div>

                    <div className="border-t border-[#d4a574]/20">
                      <button
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#d4a574]/20 hover:text-[#d4a574] transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center">
                          <LogOut size={16} className="mr-3" />
                          {signingOut ? 'Signing out...' : 'Sign Out'}
                        </div>
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
    </header>
  )
}