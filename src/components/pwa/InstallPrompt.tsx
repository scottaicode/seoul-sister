'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (localStorage.getItem('pwa-prompt-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show after a delay so it's not intrusive on first load
      setTimeout(() => setShowPrompt(true), 5000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 animate-fade-in">
      <div className="glass-card-strong p-4 shadow-xl border border-gold/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-seoul-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Install Seoul Sister</p>
            <p className="text-xs text-white/50 mt-0.5">
              Add to your home screen for quick access and a native app experience.
            </p>
          </div>
          <button onClick={handleDismiss} className="text-white/30 hover:text-white/60" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 py-2 rounded-lg bg-gold text-seoul-dark text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
