'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, User, Sparkles } from 'lucide-react'

const navLinks = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Scan', href: '/scan' },
  { label: 'Products', href: '/products' },
  { label: 'Routine', href: '/routine' },
  { label: 'Yuri', href: '/yuri' },
  { label: 'Community', href: '/community' },
  { label: 'Trending', href: '/trending' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-white/50 shadow-glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-rose-gold" />
              <span className="font-display font-bold text-xl text-gradient">
                Seoul Sister
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link transition-colors duration-200 ${
                    isActive(link.href)
                      ? 'text-rose-gold font-semibold'
                      : 'text-seoul-charcoal/70 hover:text-seoul-charcoal'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side: User icon + mobile hamburger */}
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/80 border border-white/50 shadow-glass hover:shadow-glass-lg transition-all duration-200"
                aria-label="Profile"
              >
                <User className="w-4 h-4 text-seoul-charcoal/70" />
              </Link>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-white/80 border border-white/50 shadow-glass hover:shadow-glass-lg transition-all duration-200"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? (
                  <X className="w-4 h-4 text-seoul-charcoal" />
                ) : (
                  <Menu className="w-4 h-4 text-seoul-charcoal" />
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
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu panel */}
          <div className="absolute top-16 left-0 right-0 bg-white/90 backdrop-blur-lg border-b border-white/50 shadow-glass-lg animate-slide-down">
            <nav className="flex flex-col py-4 px-4 gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive(link.href)
                      ? 'bg-seoul-blush text-rose-gold'
                      : 'text-seoul-charcoal/70 hover:bg-seoul-pearl hover:text-seoul-charcoal'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
