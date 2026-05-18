'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Reusable image lightbox modal.
 *
 * Used in:
 *   - Phase Photo Gallery on /skin-profile (Bailey's text 2 ask)
 *   - Yuri chat message photo display (Bailey's text 3 paper-cut)
 *
 * Behavior:
 *   - ESC key closes
 *   - Click outside the image closes
 *   - When `urls` has length > 1, left/right arrows + arrow keys navigate
 *   - Image scales to fit viewport via object-contain
 *   - Portal-mounted so it overlays everything
 */
export interface ImageLightboxProps {
  urls: string[]
  initialIndex?: number
  altPrefix?: string
  onClose: () => void
  /** Optional caption rendered below the image — e.g. "Phase 1 · 2026-02-25 · Score 48" */
  caption?: (index: number) => string | null
}

export function ImageLightbox({
  urls,
  initialIndex = 0,
  altPrefix = 'Photo',
  onClose,
  caption,
}: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && urls.length > 1) {
        setIndex((i) => (i - 1 + urls.length) % urls.length)
      } else if (e.key === 'ArrowRight' && urls.length > 1) {
        setIndex((i) => (i + 1) % urls.length)
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [urls.length, onClose])

  if (!mounted || urls.length === 0) return null

  const currentUrl = urls[index] || urls[0]
  const captionText = caption ? caption(index) : null

  const overlay = (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Close button (top-right) */}
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition"
      >
        <X size={20} />
      </button>

      {/* Navigation arrows (multi-image) */}
      {urls.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation()
              setIndex((i) => (i - 1 + urls.length) % urls.length)
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white transition"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation()
              setIndex((i) => (i + 1) % urls.length)
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white transition"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Image (click on image itself doesn't close — only background does) */}
      <div
        className="flex flex-col items-center max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentUrl}
          alt={`${altPrefix} ${index + 1}`}
          className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg"
        />
        {captionText && (
          <div className="mt-3 text-sm text-white/80 text-center max-w-md">{captionText}</div>
        )}
        {urls.length > 1 && (
          <div className="mt-2 text-xs text-white/50">
            {index + 1} / {urls.length}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

/**
 * Convenience hook: wraps lightbox state so callers can write:
 *
 *   const lightbox = useImageLightbox()
 *   <img onClick={() => lightbox.open([url1, url2], 0)} ... />
 *   {lightbox.render({ altPrefix: 'Phase progress' })}
 */
export function useImageLightbox() {
  const [state, setState] = useState<{ urls: string[]; index: number } | null>(null)

  const open = (urls: string[], index = 0) => {
    if (urls.length === 0) return
    setState({ urls, index })
  }
  const close = () => setState(null)

  return {
    isOpen: state !== null,
    open,
    close,
    render: (props: Omit<ImageLightboxProps, 'urls' | 'initialIndex' | 'onClose'>) => {
      if (!state) return null
      return (
        <ImageLightbox
          urls={state.urls}
          initialIndex={state.index}
          onClose={close}
          {...props}
        />
      )
    },
  }
}
