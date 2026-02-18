'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from './Header'
import BottomNav from './BottomNav'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  // Show nothing while checking auth to prevent flash of protected content
  if (loading) {
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
