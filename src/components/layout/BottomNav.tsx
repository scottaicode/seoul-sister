'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListChecks, Sparkles, BookHeart, User } from 'lucide-react'

// Yuri-centric mobile bar (v11). Yuri sits in the CENTER as the emphasized
// action — she's the star. The flanking tabs are the everyday surfaces that
// have real usage (Home, Routine, Library, Profile). The old "Scan" tab was
// dropped from the bar: scans=0 across all users and Yuri now handles scanning
// conversationally. Scan/Sunscreen/Glass-Skin remain reachable from the header
// "More" menu and from Yuri herself.
const leftItems = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Routine', href: '/routine', icon: ListChecks },
]
const rightItems = [
  { label: 'Library', href: '/library', icon: BookHeart },
  { label: 'Profile', href: '/profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const renderItem = ({ label, href, icon: Icon }: { label: string; href: string; icon: typeof LayoutDashboard }) => {
    const active = isActive(href)
    return (
      <Link
        key={href}
        href={href}
        className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-[52px]"
        aria-label={label}
      >
        <Icon
          className={`w-5 h-5 transition-colors duration-200 ${active ? 'text-gold' : 'text-white/35'}`}
          strokeWidth={active ? 2.5 : 2}
        />
        <span className={`text-[10px] font-medium transition-colors duration-200 ${active ? 'text-gold' : 'text-white/35'}`}>
          {label}
        </span>
      </Link>
    )
  }

  const yuriActive = isActive('/yuri')

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-seoul-dark/90 backdrop-blur-md border-t border-white/10 pb-safe">
      <div className="flex items-center justify-around px-2 py-2">
        {leftItems.map(renderItem)}

        {/* Yuri — center, raised, emphasized as the primary action */}
        <Link
          href="/yuri"
          aria-label="Ask Yuri"
          className="flex flex-col items-center justify-center -mt-5"
        >
          <span
            className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200 ${
              yuriActive
                ? 'bg-gradient-to-br from-gold to-gold-light'
                : 'bg-gradient-to-br from-gold to-gold-light hover:brightness-110'
            }`}
          >
            <Sparkles className="w-6 h-6 text-seoul-dark" strokeWidth={2.5} />
          </span>
          <span className={`text-[10px] font-semibold mt-0.5 ${yuriActive ? 'text-gold' : 'text-gold/80'}`}>
            Yuri
          </span>
        </Link>

        {rightItems.map(renderItem)}
      </div>
    </nav>
  )
}
