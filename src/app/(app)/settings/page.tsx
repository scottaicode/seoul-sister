'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LogOut,
  User,
  CreditCard,
  Shield,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

function SettingsRow({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  danger = false,
}: {
  icon: React.ElementType
  label: string
  description?: string
  href?: string
  onClick?: () => void
  danger?: boolean
}) {
  const content = (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl transition-colors ${
        danger ? 'hover:bg-red-500/10' : 'hover:bg-white/5'
      } cursor-pointer`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          danger ? 'bg-red-500/10' : 'bg-white/5'
        }`}
      >
        <Icon className={`w-4 h-4 ${danger ? 'text-red-400' : 'text-gold/60'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-white'}`}>
          {label}
        </p>
        {description && (
          <p className="text-xs text-white/40 mt-0.5">{description}</p>
        )}
      </div>
      {href && <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return <button onClick={onClick} className="w-full text-left">{content}</button>
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleSignOut() {
    setLoggingOut(true)
    try {
      await signOut()
      router.replace('/login')
    } catch {
      setLoggingOut(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-white section-heading">
          Settings
        </h1>
        <p className="text-white/40 text-sm">
          Manage your account and preferences.
        </p>
      </div>

      {/* Account */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <h2 className="font-display font-semibold text-xs text-white/40 uppercase tracking-wider">
            Account
          </h2>
        </div>
        <SettingsRow
          icon={User}
          label="My Profile"
          description="Skin type, concerns, and preferences"
          href="/profile"
        />
        <SettingsRow
          icon={CreditCard}
          label="Subscription"
          description="Manage your plan and billing"
          href="/#pricing"
        />
      </div>

      {/* About */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <h2 className="font-display font-semibold text-xs text-white/40 uppercase tracking-wider">
            About
          </h2>
        </div>
        <SettingsRow
          icon={Shield}
          label="Privacy Policy"
          href="/privacy"
        />
      </div>

      {/* Sign Out */}
      <div className="glass-card overflow-hidden">
        {loggingOut ? (
          <div className="flex items-center justify-center p-4 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            <span className="text-sm text-white/40">Signing out...</span>
          </div>
        ) : (
          <SettingsRow
            icon={LogOut}
            label="Sign Out"
            description={user?.email ?? undefined}
            onClick={handleSignOut}
            danger
          />
        )}
      </div>

      <div className="text-center pt-4">
        <p className="text-[10px] text-white/20">Seoul Sister v3.3.0</p>
      </div>

      <div className="h-16 md:h-0" />
    </div>
  )
}
