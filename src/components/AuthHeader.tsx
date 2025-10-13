'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from './AuthModal'
import { User, ChevronDown, Camera, Heart, ShoppingBag, Settings, LogOut } from 'lucide-react'

export default function AuthHeader() {
  const { user, userProfile, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const handleAuthSuccess = (user: any) => {
    console.log('User authenticated:', user)
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
            {user ? (
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

                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={signOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-luxury-gold/20 hover:text-luxury-gold transition-colors"
                      >
                        <LogOut size={16} className="mr-3" />
                        Sign Out
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