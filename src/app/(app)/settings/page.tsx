'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LogOut,
  User,
  CreditCard,
  Shield,
  FileText,
  Trash2,
  ChevronRight,
  Loader2,
  AlertTriangle,
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleSignOut() {
    setLoggingOut(true)
    try {
      await signOut()
      router.replace('/login')
    } catch {
      setLoggingOut(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to delete account')
      }
      await signOut()
      router.replace('/login')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
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
          href="/profile"
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
        <SettingsRow
          icon={FileText}
          label="Terms of Service"
          href="/terms"
        />
      </div>

      {/* Danger Zone */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <h2 className="font-display font-semibold text-xs text-white/40 uppercase tracking-wider">
            Danger Zone
          </h2>
        </div>
        {showDeleteConfirm ? (
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2 bg-red-500/10 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="text-red-400 font-medium">This action is permanent</p>
                <p className="text-white/40 mt-1">
                  All your data will be deleted: skin profile, conversations, reviews, routines, scans, and your account. This cannot be undone.
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 text-xs py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 text-xs py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        ) : (
          <SettingsRow
            icon={Trash2}
            label="Delete Account"
            description="Permanently delete all your data"
            onClick={() => setShowDeleteConfirm(true)}
            danger
          />
        )}
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
