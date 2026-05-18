'use client'

import { useState } from 'react'
import { Share2, Check, Copy } from 'lucide-react'

/**
 * Reusable share button — Web Share API with clipboard fallback.
 *
 * Used on shareable SEO surfaces (/products/[id], /ingredients/[slug]).
 * Designed for the v10.6.3 sharing pattern: subscribers discover something
 * worth sharing in-app, tap share, and send the URL to friends/family.
 * Friends land on the page (with public marketing nav if unauthenticated,
 * AppShell nav if a subscriber — see AuthAwareNav).
 *
 * Behavior:
 *   - Mobile / supported browsers: opens native share sheet via navigator.share()
 *   - Desktop / unsupported: copies URL to clipboard, shows brief check icon
 *   - No tracking, no referral attribution (defer if/when business model demands it)
 *
 * Zero AI involvement — pure browser API surface.
 */

export interface ShareButtonProps {
  /** Page title (used in native share sheet) */
  title: string
  /** Description / short pitch shown in share sheet */
  text?: string
  /** Optional explicit URL — defaults to current page URL */
  url?: string
  /** Visual variant — "icon" is compact, "button" has label too */
  variant?: 'icon' | 'button'
  /** Optional className for the button */
  className?: string
}

export function ShareButton({
  title,
  text,
  url,
  variant = 'icon',
  className = '',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
    if (!shareUrl) return

    // Try Web Share API first (mobile + supporting browsers)
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title,
          text: text || title,
          url: shareUrl,
        })
        return
      } catch (err) {
        // User cancelled — silently exit. (Not a real error.)
        if ((err as Error).name === 'AbortError') return
        // Other errors fall through to clipboard fallback below
      }
    }

    // Clipboard fallback (desktop, unsupported browsers)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2200)
      } catch {
        // Permission denied or no clipboard access. Silent failure — user
        // can still long-press the URL bar to copy manually. We don't
        // surface an error because this is a low-stakes affordance.
      }
    }
  }

  const baseClass =
    variant === 'icon'
      ? 'inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 hover:text-white transition'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-xs text-white/70 hover:text-white transition'

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={copied ? 'Link copied' : 'Share this page'}
      title={copied ? 'Link copied to clipboard' : 'Share'}
      className={`${baseClass} ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
          {variant === 'button' && <span>Copied</span>}
        </>
      ) : (
        <>
          {/* Use Copy icon as desktop-fallback hint when navigator.share isn't
              available, Share2 otherwise. We can't reliably detect this at
              render time (server-side render), so we just use Share2 — the
              copied state handles the affirmation. */}
          <Share2 className="w-4 h-4" strokeWidth={2} />
          {variant === 'button' && <span>Share</span>}
        </>
      )}
    </button>
  )
}

// Re-export the Copy icon for callers that want a clipboard-affirming variant
export { Copy }
