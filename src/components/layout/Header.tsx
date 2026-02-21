'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, User, Sparkles, LogOut, Settings, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

const navLinks = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Scan', href: '/scan' },
  { label: 'Products', href: '/products' },
  { label: 'Sunscreen', href: '/sunscreen' },
  { label: 'Routine', href: '/routine' },
  { label: 'Yuri', href: '/yuri' },
  { label: 'Glass Skin', href: '/glass-skin' },
  { label: 'Shelf Scan', href: '/shelf-scan' },
  { label: 'Community', href: '/community' },
  { label: 'Trending', href: '/trending' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  // Check admin status
  useEffect(() => {
    if (!user) return
    async function checkAdmin() {
      try {
        const { data } = await supabase
          .from('ss_user_profiles')
          .select('is_admin')
          .eq('user_id', user!.id)
          .maybeSingle()
        setIsAdmin(data?.is_admin === true)
      } catch {
        setIsAdmin(false)
      }
    }
    checkAdmin()
  }, [user])

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    if (profileMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileMenuOpen])

  async function handleSignOut() {
    setProfileMenuOpen(false)
    try {
      await signOut()
    } catch {
      // Sign out failed — clear local state anyway
    }
    router.push('/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <header className="sticky top-0 z-50 bg-seoul-dark/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-gold" />
              <span className="font-display font-bold text-xl bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">
                Seoul Sister
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm transition-colors duration-200 ${
                    isActive(link.href)
                      ? 'text-gold font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side: Profile dropdown + mobile hamburger */}
            <div className="flex items-center gap-3">
              {/* Profile dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/10 hover:bg-white/15 transition-all duration-200"
                  aria-label="Account menu"
                >
                  <User className="w-4 h-4 text-white/60" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-11 w-48 bg-seoul-card border border-white/10 rounded-xl shadow-lg py-1 z-50">
                    <Link
                      href="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin/pipeline"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gold/70 hover:bg-gold/5 hover:text-gold transition-colors"
                      >
                        <Shield className="w-4 h-4" />
                        Admin
                      </Link>
                    )}
                    <div className="border-t border-white/10 my-1" />
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-400/70 hover:bg-rose-500/5 hover:text-rose-400 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/10 hover:bg-white/15 transition-all duration-200"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? (
                  <X className="w-4 h-4 text-white" />
                ) : (
                  <Menu className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu panel */}
          <div className="absolute top-16 left-0 right-0 bg-seoul-card/95 backdrop-blur-lg border-b border-white/10 animate-slide-down">
            <nav className="flex flex-col py-4 px-4 gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive(link.href)
                      ? 'bg-gold/15 text-gold'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin/pipeline"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                    isActive('/admin')
                      ? 'bg-gold/15 text-gold'
                      : 'text-gold/50 hover:bg-gold/5 hover:text-gold/80'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}
              <div className="border-t border-white/10 mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); handleSignOut() }}
                  className="w-full px-4 py-3 rounded-xl font-medium text-sm text-rose-400/50 hover:bg-rose-500/5 hover:text-rose-400 transition-all duration-200 flex items-center gap-2 text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
