'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, Droplets, Sun, MapPin } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

interface SkinProfile {
  skin_type: string
  skin_concerns: string[]
  climate: string
  onboarding_completed: boolean
}

export default function SkinProfileWidget() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<SkinProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data } = await supabase
          .from('ss_user_profiles')
          .select('skin_type, skin_concerns, climate, onboarding_completed')
          .eq('user_id', user!.id)
          .maybeSingle()

        if (data?.onboarding_completed) {
          setProfile(data as SkinProfile)
          setLoading(false)
          return
        }

        // Profile missing or not complete — try to auto-finalize from onboarding
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token
        if (token) {
          const res = await fetch('/api/yuri/onboarding', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action: 'start_onboarding' }),
          })
          if (res.ok) {
            const onboardingData = await res.json()
            if (onboardingData.status === 'completed') {
              const { data: refreshed } = await supabase
                .from('ss_user_profiles')
                .select('skin_type, skin_concerns, climate, onboarding_completed')
                .eq('user_id', user!.id)
                .maybeSingle()
              setProfile(refreshed as SkinProfile | null)
              setLoading(false)
              return
            }
          }
        }

        setProfile(data as SkinProfile | null)
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/10 rounded w-1/2" />
            <div className="h-2 bg-white/10 rounded w-3/4" />
          </div>
        </div>
      </div>
    )
  }

  if (profile?.onboarding_completed) {
    const skinType = profile.skin_type
      ? profile.skin_type.charAt(0).toUpperCase() + profile.skin_type.slice(1)
      : 'Normal'
    const concerns = profile.skin_concerns?.length
      ? profile.skin_concerns.slice(0, 3).join(', ')
      : 'None set'
    const climate = profile.climate
      ? profile.climate.charAt(0).toUpperCase() + profile.climate.slice(1)
      : 'Temperate'

    return (
      <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-gold" />
          <p className="font-display font-semibold text-sm text-gold-light">Profile Complete</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Droplets className="w-4 h-4 text-gold/60" />
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Skin Type</p>
              <p className="text-sm text-white font-medium">{skinType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Sun className="w-4 h-4 text-gold/60" />
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Concerns</p>
              <p className="text-sm text-white font-medium">{concerns}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-gold/60" />
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Climate</p>
              <p className="text-sm text-white font-medium">{climate}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/5">
          <Link
            href="/profile"
            className="text-xs text-gold-light hover:text-gold transition-colors"
          >
            Edit profile &rarr;
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="dark-card-gold p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-gold to-gold-light flex-shrink-0">
        <Sparkles className="w-5 h-5 text-seoul-dark" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white">
          Complete your skin profile
        </p>
        <p className="text-xs text-white/40 mt-0.5">
          Unlock personalized recommendations, conflict detection, and skin-matched reviews.
        </p>
      </div>
      <Link
        href="/onboarding"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all duration-200 whitespace-nowrap flex-shrink-0"
      >
        Get started
      </Link>
    </div>
  )
}
