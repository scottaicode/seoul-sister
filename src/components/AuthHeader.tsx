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
    <header className="bg-black text-white relative z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-amber-400 tracking-tight">
              Seoul Sister
            </h1>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#collection" className="hover:text-amber-400 transition-colors">
              COLLECTION
            </a>
            <a href="#about" className="hover:text-amber-400 transition-colors">
              ABOUT
            </a>
            <a href="#insider-access" className="hover:text-amber-400 transition-colors">
              INSIDER ACCESS
            </a>
          </nav>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                  <span className="text-sm font-medium">
                    {userProfile?.name || user.email?.split('@')[0]}
                  </span>
                  <ChevronDown size={16} />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {userProfile?.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>

                    <div className="py-1">
                      <a
                        href="#skin-analysis"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Camera size={16} className="mr-3" />
                        Skin Analysis
                      </a>
                      <a
                        href="#recommendations"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Heart size={16} className="mr-3" />
                        My Recommendations
                      </a>
                      <a
                        href="#orders"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <ShoppingBag size={16} className="mr-3" />
                        Orders
                      </a>
                      <a
                        href="#profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Settings size={16} className="mr-3" />
                        Profile Settings
                      </a>
                    </div>

                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={signOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
                className="border-2 border-white text-white px-6 py-2 rounded-lg font-semibold hover:bg-white hover:text-black transition-all duration-200"
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