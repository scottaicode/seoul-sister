'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

const publicLinks = [
  { label: 'Products', href: '/products' },
  { label: 'Ingredients', href: '/ingredients' },
  { label: 'Best Products', href: '/best' },
  { label: 'Blog', href: '/blog' },
]

export default function PublicNav() {
  const { user } = useAuth()
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/icons/icon-512.svg"
            alt="Seoul Sister"
            className="h-8 w-8"
          />
          <span className="font-display font-semibold text-white text-sm hidden sm:inline">
            Seoul Sister
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href={user ? '/dashboard' : '/'}
            className="text-white/60 hover:text-gold transition-colors text-sm font-medium"
          >
            {user ? 'Dashboard' : 'Home'}
          </Link>
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition-colors text-sm font-medium ${
                isActive(link.href)
                  ? 'text-gold'
                  : 'text-white/60 hover:text-gold'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
