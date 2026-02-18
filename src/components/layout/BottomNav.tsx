'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Camera, Search, MessageCircle, User } from 'lucide-react'

const navItems = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Scan', href: '/scan', icon: Camera },
  { label: 'Products', href: '/products', icon: Search },
  { label: 'Yuri', href: '/yuri', icon: MessageCircle },
  { label: 'Profile', href: '/profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-seoul-dark/90 backdrop-blur-md border-t border-white/10 pb-safe">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[52px]"
              aria-label={label}
            >
              <Icon
                className={`w-5 h-5 transition-colors duration-200 ${
                  active ? 'text-gold' : 'text-white/35'
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  active ? 'text-gold' : 'text-white/35'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
