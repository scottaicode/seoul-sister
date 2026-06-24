'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, User, Sparkles, LogOut, Settings, Shield, MessageCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

// Yuri-centric nav (v11 repositioning). Yuri is the star — she orchestrates the
// rest. Primary links are the everyday surfaces + the things Yuri reasons over
// (Skin Profile, Library, Routine). The standalone feature pages that Yuri now
// handles conversationally (Scan, Sunscreen, Glass Skin, Shelf Scan, Dupes) are
// demoted to the "More" group — still reachable, no longer front doors. Usage
// data (June 2026): of these, scans=0 / wishlists=0 across all users; everyone
// lives in Yuri chat. Leading with Yuri matches how the product is actually used.
const primaryNavLinks = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Skin Profile', href: '/skin-profile' },
  { label: 'Library', href: '/library' },
  { label: 'Routine', href: '/routine' },
  { label: 'Trending', href: '/trending' },
]

// Secondary surfaces — data/browse pages + the feature pages Yuri now drives.
const moreNavLinks = [
  { label: 'Products', href: '/browse' },
  { label: 'Ingredients', href: '/ingredients' },
  { label: 'Scan a label', href: '/scan' },
  { label: 'Glass Skin Score', href: '/glass-skin' },
  { label: 'Shelf Scan', href: '/shelf-scan' },
  { label: 'Sunscreen Finder', href: '/sunscreen' },
  { label: 'Community', href: '/community' },
  { label: 'Blog', href: '/blog' },
]

// Combined list for mobile (which shows everything in one scrollable panel).
const allNavLinks = [...primaryNavLinks, ...moreNavLinks]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
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

  // Close "More" menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    if (moreMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [moreMenuOpen])

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
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo — mr-2 + the parent gap-4 guarantees the wordmark never
                butts against the first nav link ("Dashboard"). With 13 nav
                links the nav is wide enough that justify-between's leftover
                space can collapse to ~0, which produced the "Seoul SisterDashboard"
                jam Bailey reported. The explicit gap can't collapse. */}
            <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0 mr-2">
              <Sparkles className="w-5 h-5 text-gold" />
              <span className="font-display font-bold text-xl bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent whitespace-nowrap">
                Seoul Sister
              </span>
            </Link>

            {/* Desktop Navigation — Yuri-centric (v11). Yuri leads as a
                visually distinct pill (she's the star), followed by the everyday
                primary surfaces and a "More" dropdown holding browse/data pages
                and the feature pages Yuri now drives conversationally. Collapsing
                14 flat links → Yuri + 5 + More declutters the bar so the one
                surface that converts isn't buried. */}
            <nav className="hidden md:flex flex-1 items-center justify-center gap-4">
              {/* Yuri — the star, always first, always distinct */}
              <Link
                href="/yuri"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  isActive('/yuri')
                    ? 'bg-gradient-to-r from-gold to-gold-light text-seoul-dark'
                    : 'bg-gold/15 text-gold hover:bg-gold/25'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ask Yuri
              </Link>

              {primaryNavLinks.map((link) => (
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

              {/* More dropdown */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen((prev) => !prev)}
                  className={`flex items-center gap-1 text-sm transition-colors duration-200 ${
                    moreNavLinks.some((l) => isActive(l.href))
                      ? 'text-gold font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  More
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {moreMenuOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-9 w-52 bg-seoul-card border border-white/10 rounded-xl shadow-lg py-1 z-50">
                    {moreNavLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMoreMenuOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          isActive(link.href)
                            ? 'text-gold bg-gold/5'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
                  <div className="absolute right-0 top-11 w-56 bg-seoul-card border border-white/10 rounded-xl shadow-lg py-1 z-50">
                    {user?.email && (
                      <>
                        <div className="px-4 py-2.5">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Signed in as</p>
                          <p className="text-xs text-white/80 truncate" title={user.email}>{user.email}</p>
                        </div>
                        <div className="border-t border-white/10" />
                      </>
                    )}
                    <Link
                      href="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Profile
                    </Link>
                    {isAdmin && (
                      <>
                        <Link
                          href="/admin/pipeline"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gold/70 hover:bg-gold/5 hover:text-gold transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          Admin
                        </Link>
                        <Link
                          href="/admin/widget"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gold/70 hover:bg-gold/5 hover:text-gold transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Widget Intel
                        </Link>
                      </>
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
          <div className="absolute top-16 left-0 right-0 bg-seoul-card/95 backdrop-blur-lg border-b border-white/10 animate-slide-down max-h-[calc(100vh-4rem)] overflow-y-auto">
            <nav className="flex flex-col py-4 px-4 gap-1">
              {user?.email && (
                <div className="px-4 py-2 mb-1 border-b border-white/10">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Signed in as</p>
                  <p className="text-xs text-white/80 truncate" title={user.email}>{user.email}</p>
                </div>
              )}
              {/* Yuri — the star, leads the mobile menu, visually distinct */}
              <Link
                href="/yuri"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  isActive('/yuri')
                    ? 'bg-gradient-to-r from-gold to-gold-light text-seoul-dark'
                    : 'bg-gold/15 text-gold hover:bg-gold/25'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Ask Yuri
              </Link>
              {allNavLinks.map((link) => (
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
                <>
                  <Link
                    href="/admin/pipeline"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                      isActive('/admin/pipeline')
                        ? 'bg-gold/15 text-gold'
                        : 'text-gold/50 hover:bg-gold/5 hover:text-gold/80'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </Link>
                  <Link
                    href="/admin/widget"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                      isActive('/admin/widget')
                        ? 'bg-gold/15 text-gold'
                        : 'text-gold/50 hover:bg-gold/5 hover:text-gold/80'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Widget Intel
                  </Link>
                </>
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
