'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Droplets,
  Sun,
  MapPin,
  Palette,
  Shield,
  Calendar,
  Wallet,
  Award,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  skin_type: string | null
  skin_concerns: string[] | null
  allergies: string[] | null
  fitzpatrick_scale: number | null
  climate: string | null
  age_range: string | null
  budget_range: string | null
  experience_level: string | null
  onboarding_completed: boolean
  plan: string | null
}

function capitalize(s: string | null): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gold/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white font-medium">{value}</p>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data } = await supabase
        .from('ss_user_profiles')
        .select('skin_type, skin_concerns, allergies, fitzpatrick_scale, climate, age_range, budget_range, experience_level, onboarding_completed, plan')
        .eq('user_id', user!.id)
        .maybeSingle()
      setProfile(data as UserProfile | null)
      setLoading(false)
    }
    load()
  }, [user])

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-white section-heading">
          My Profile
        </h1>
        <p className="text-white/40 text-sm">
          Your skin profile and preferences.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : !profile?.onboarding_completed ? (
        <div className="dark-card-gold p-6 text-center">
          <Sparkles className="w-10 h-10 text-gold mx-auto mb-3" />
          <h2 className="font-display font-semibold text-lg text-white mb-2">
            Complete your skin profile
          </h2>
          <p className="text-sm text-white/40 mb-5 max-w-sm mx-auto">
            Chat with Yuri to build your personalized skin profile. It takes about 2 minutes.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all duration-200"
          >
            Start Onboarding
          </Link>
        </div>
      ) : (
        <>
          {/* Account */}
          <div className="glass-card p-5">
            <h2 className="font-display font-semibold text-sm text-white/60 mb-3 uppercase tracking-wider">
              Account
            </h2>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center text-seoul-dark font-bold text-sm">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{displayName}</p>
                <p className="text-xs text-white/40">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Skin Profile */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-sm text-white/60 uppercase tracking-wider">
                Skin Profile
              </h2>
              <Link
                href="/onboarding"
                className="text-xs text-gold-light hover:text-gold transition-colors"
              >
                Re-do onboarding
              </Link>
            </div>
            <ProfileField icon={Droplets} label="Skin Type" value={capitalize(profile.skin_type)} />
            <ProfileField
              icon={Sun}
              label="Concerns"
              value={profile.skin_concerns?.length ? profile.skin_concerns.join(', ') : '—'}
            />
            <ProfileField
              icon={Shield}
              label="Allergies"
              value={profile.allergies?.length ? profile.allergies.join(', ') : 'None reported'}
            />
            <ProfileField
              icon={Palette}
              label="Fitzpatrick Scale"
              value={profile.fitzpatrick_scale ? `Type ${profile.fitzpatrick_scale}` : '—'}
            />
            <ProfileField icon={MapPin} label="Climate" value={capitalize(profile.climate)} />
            <ProfileField icon={Calendar} label="Age Range" value={profile.age_range || '—'} />
            <ProfileField icon={Wallet} label="Budget" value={capitalize(profile.budget_range)} />
            <ProfileField icon={Award} label="K-Beauty Experience" value={capitalize(profile.experience_level)} />
          </div>

          {/* Subscription */}
          <div className="glass-card p-5">
            <h2 className="font-display font-semibold text-sm text-white/60 mb-3 uppercase tracking-wider">
              Subscription
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {profile.plan === 'free' || !profile.plan ? 'Free' : capitalize(profile.plan?.replace('_', ' '))}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {profile.plan === 'free' || !profile.plan
                    ? '3 scans/month, limited Yuri conversations'
                    : 'Unlimited scans, full Yuri access, all specialists'}
                </p>
              </div>
              {(profile.plan === 'free' || !profile.plan) && (
                <Link
                  href="/#pricing"
                  className="text-xs font-medium text-gold-light hover:text-gold transition-colors"
                >
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      <div className="h-16 md:h-0" />
    </div>
  )
}
