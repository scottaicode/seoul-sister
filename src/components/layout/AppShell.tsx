'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Header from './Header'
import BottomNav from './BottomNav'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  // Redirect to onboarding if profile not completed (skip if already on /onboarding)
  useEffect(() => {
    if (!user || loading || pathname === '/onboarding') {
      setOnboardingChecked(true)
      return
    }

    async function checkOnboarding() {
      try {
        const { data } = await supabase
          .from('ss_user_profiles')
          .select('onboarding_completed')
          .eq('user_id', user!.id)
          .maybeSingle()

        if (data && !data.onboarding_completed) {
          router.replace('/onboarding')
        } else {
          setOnboardingChecked(true)
        }
      } catch {
        // Profile fetch failed — don't block the app
        setOnboardingChecked(true)
      }
    }

    checkOnboarding()
  }, [user, loading, pathname, router])

  // Show nothing while checking auth or onboarding to prevent flash of protected content
  if (loading || !onboardingChecked) {
    return (
      <div className="min-h-screen bg-seoul-darker flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-seoul-darker">
      <Header />
      <main className="pt-0 pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
