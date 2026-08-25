'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
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
  const router = useRouter()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  // Signed-in users get the full Yuri experience. Everyone else goes to the
  // landing hero widget (the single Yuri conversion surface). On the home page
  // we focus the widget via ?ask= (empty intent); elsewhere we navigate home.
  // Real href, not a router.push handler. This nav renders on every public
  // page (~12,867 URLs), so as a <button> the site's one universal Yuri
  // affordance was invisible to every crawler on every page. Empty `ask` is
  // intentional: nav carries no topic, so it focuses the widget without
  // prefilling a question the visitor did not imply.
  const askYuriHref = user ? '/yuri' : '/?ask=&from=nav'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {/* The SS monogram. This pointed at icon-512.svg, the retired
              orb-and-wordmark art — which was DELETED July 30 2026, so this nav
              would have rendered a broken image on every public page (blog,
              ingredient and product pages: the AI-citation landing surfaces).
              Explicit width/height because an SVG with no intrinsic size renders
              nothing in an <img> (f7e4d23). */}
          <img
            src="/icons/icon-mark.svg"
            alt="Seoul Sister"
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg"
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
          <Link
            href={askYuriHref}
            className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask Yuri
          </Link>
        </div>
      </div>
    </nav>
  )
}
