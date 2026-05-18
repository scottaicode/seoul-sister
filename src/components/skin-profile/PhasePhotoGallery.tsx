'use client'

import { useEffect, useMemo, useState } from 'react'
import { Camera, ImageOff } from 'lucide-react'
import { useImageLightbox } from '@/components/ui/ImageLightbox'

/**
 * Phase Photo Gallery — Bailey's text 2 ask (May 17 2026).
 *
 * Grouped visual ladder of Glass Skin Score photos by treatment phase.
 * Tabs at the top (All / Phase 1 / Phase 2 / ...). Within each phase, photos
 * render as a grid sorted oldest-first so progress reads left-to-right.
 *
 * Photos predating storage (Bailey's two Feb 25 scores) render as a
 * "no photo saved" placeholder card with the score and date still visible —
 * the user still sees that the entry exists, just without the visual.
 */

export interface PhasePhotoEntry {
  id: string
  taken_at: string
  taken_date: string | null
  overall_score: number
  treatment_phase_id: string | null
  photo_signed_url: string | null
  has_photo: boolean
  dimensions: {
    luminosity: number | null
    smoothness: number | null
    clarity: number | null
    hydration: number | null
    evenness: number | null
  }
  analysis_notes: string | null
  photo_quality: Record<string, unknown>
}

export interface PhaseTabData {
  id: string | 'all'
  label: string                // "Phase 1 · Barrier Repair"
  phaseNumber: number | null   // null for 'all'
}

export interface PhasePhotoGalleryProps {
  photos: PhasePhotoEntry[]
  phases: PhaseTabData[]       // exclude 'all' — added automatically
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
  if (score >= 60) return 'bg-sky-500/20 text-sky-300 border-sky-400/30'
  if (score >= 40) return 'bg-amber-500/20 text-amber-300 border-amber-400/30'
  return 'bg-rose-500/20 text-rose-300 border-rose-400/30'
}

export function PhasePhotoGallery({ photos, phases }: PhasePhotoGalleryProps) {
  const tabs: PhaseTabData[] = useMemo(
    () => [{ id: 'all', label: 'All phases', phaseNumber: null }, ...phases],
    [phases]
  )

  const [activeTab, setActiveTab] = useState<string>('all')
  const lightbox = useImageLightbox()

  // Reset to "all" if active tab no longer exists
  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTab)) setActiveTab('all')
  }, [tabs, activeTab])

  const visible = useMemo(() => {
    if (activeTab === 'all') return photos
    return photos.filter((p) => p.treatment_phase_id === activeTab)
  }, [activeTab, photos])

  const photoUrls = useMemo(
    () => visible.filter((p) => p.has_photo && p.photo_signed_url).map((p) => p.photo_signed_url as string),
    [visible]
  )

  const phaseLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of phases) map.set(p.id, p.label)
    return map
  }, [phases])

  const captionFor = (photoIndexAmongPhotoed: number): string | null => {
    const photoedOnly = visible.filter((p) => p.has_photo && p.photo_signed_url)
    const photo = photoedOnly[photoIndexAmongPhotoed]
    if (!photo) return null
    const phaseLabel = photo.treatment_phase_id ? phaseLabelById.get(photo.treatment_phase_id) : null
    const parts: string[] = []
    if (phaseLabel) parts.push(phaseLabel)
    if (photo.taken_date) parts.push(photo.taken_date)
    parts.push(`Score ${photo.overall_score}`)
    return parts.join(' · ')
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-seoul-card/40 p-8 text-center">
        <Camera className="mx-auto h-10 w-10 text-white/30" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-white/60">
          No Glass Skin Score photos yet. Visit /glass-skin to take your first photo — it'll show up here
          tagged to your current phase.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          const tabPhotoCount =
            tab.id === 'all' ? photos.length : photos.filter((p) => p.treatment_phase_id === tab.id).length
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium border transition ${
                isActive
                  ? 'bg-gold/20 text-gold border-gold/40'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-60">({tabPhotoCount})</span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-seoul-card/40 p-6 text-center text-sm text-white/50">
          No photos for this phase yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {visible.map((photo) => {
            const phaseLabel = photo.treatment_phase_id
              ? phaseLabelById.get(photo.treatment_phase_id)
              : null
            if (photo.has_photo && photo.photo_signed_url) {
              const photoedIndex = photoUrls.indexOf(photo.photo_signed_url)
              return (
                <button
                  type="button"
                  key={photo.id}
                  onClick={() => lightbox.open(photoUrls, photoedIndex >= 0 ? photoedIndex : 0)}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/40 cursor-zoom-in"
                  aria-label={`Photo from ${photo.taken_date}, score ${photo.overall_score}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.photo_signed_url}
                    alt={`Skin photo from ${photo.taken_date}`}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/80">{photo.taken_date}</span>
                      <span className={`rounded-full px-2 py-0.5 border ${scoreColor(photo.overall_score)}`}>
                        {photo.overall_score}
                      </span>
                    </div>
                    {phaseLabel && (
                      <div className="mt-0.5 text-[10px] text-white/50 truncate">{phaseLabel}</div>
                    )}
                  </div>
                </button>
              )
            }
            // No photo saved (predates storage)
            return (
              <div
                key={photo.id}
                className="aspect-square rounded-xl border border-white/10 bg-seoul-card/40 p-3 flex flex-col items-center justify-center text-center"
              >
                <ImageOff className="h-6 w-6 text-white/30" strokeWidth={1.5} />
                <div className="mt-2 text-xs text-white/60">{photo.taken_date}</div>
                <div
                  className={`mt-1 rounded-full px-2 py-0.5 text-xs border ${scoreColor(photo.overall_score)}`}
                >
                  Score {photo.overall_score}
                </div>
                {phaseLabel && (
                  <div className="mt-1 text-[10px] text-white/40 truncate w-full">{phaseLabel}</div>
                )}
                <div className="mt-1 text-[10px] text-white/30">No photo saved</div>
              </div>
            )
          })}
        </div>
      )}

      {lightbox.render({ altPrefix: 'Glass Skin photo', caption: captionFor })}
    </div>
  )
}
