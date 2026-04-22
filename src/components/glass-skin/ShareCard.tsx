'use client'

import { useState, useRef, useCallback } from 'react'
import { Share2, Download, Check } from 'lucide-react'
import type { GlassSkinScore } from '@/types/database'

interface Props {
  score: GlassSkinScore
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Glass Skin Goals'
  if (score >= 80) return 'Almost Glass'
  if (score >= 70) return 'Glowing'
  if (score >= 60) return 'Getting There'
  if (score >= 50) return 'On the Journey'
  if (score >= 40) return 'Building Foundation'
  return 'Just Starting'
}

function getScoreEmoji(score: number): string {
  if (score >= 90) return '✨'
  if (score >= 80) return '💎'
  if (score >= 70) return '🌟'
  if (score >= 60) return '💫'
  if (score >= 50) return '🌙'
  return '🌱'
}

type ShareStatus = 'idle' | 'shared' | 'copied' | 'downloaded'

export default function ShareCard({ score }: Props) {
  const [status, setStatus] = useState<ShareStatus>('idle')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    canvas.width = 600
    canvas.height = 400

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 600, 400)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(1, '#16213e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 600, 400)

    // Gold accent bar
    const accentGrad = ctx.createLinearGradient(0, 0, 600, 0)
    accentGrad.addColorStop(0, '#D4A574')
    accentGrad.addColorStop(1, '#E8C59B')
    ctx.fillStyle = accentGrad
    ctx.fillRect(0, 0, 600, 4)

    // Title
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Seoul Sister · Glass Skin Score', 300, 45)

    // Score circle
    ctx.beginPath()
    ctx.arc(300, 160, 70, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(212,165,116,0.1)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(212,165,116,0.6)'
    ctx.lineWidth = 3
    ctx.stroke()

    // Score number
    ctx.fillStyle = '#D4A574'
    ctx.font = 'bold 48px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(score.overall_score), 300, 175)

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillText(getScoreLabel(score.overall_score), 300, 260)

    // Dimension scores
    const dims = [
      { label: 'Luminosity', val: score.luminosity_score },
      { label: 'Smoothness', val: score.smoothness_score },
      { label: 'Clarity', val: score.clarity_score },
      { label: 'Hydration', val: score.hydration_score },
      { label: 'Evenness', val: score.evenness_score },
    ]

    const barY = 300
    const barWidth = 80
    const startX = 60

    dims.forEach((dim, i) => {
      const x = startX + i * (barWidth + 20)

      // Bar background
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(x, barY, barWidth, 6)

      // Bar fill
      const fillWidth = (dim.val / 100) * barWidth
      ctx.fillStyle = '#D4A574'
      ctx.fillRect(x, barY, fillWidth, 6)

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(dim.label, x + barWidth / 2, barY + 22)

      // Score
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.fillText(String(dim.val), x + barWidth / 2, barY - 8)
    })

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('seoulsister.com', 300, 380)

    return canvas
  }, [score])

  const getShareBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = renderCanvas()
      if (!canvas) return resolve(null)
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  }, [renderCanvas])

  const flashStatus = useCallback((next: ShareStatus) => {
    setStatus(next)
    setTimeout(() => setStatus('idle'), 2000)
  }, [])

  const downloadBlob = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `glass-skin-score-${score.overall_score}.png`
    link.href = url
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [score.overall_score])

  const handleShare = useCallback(async () => {
    const emoji = getScoreEmoji(score.overall_score)
    const label = getScoreLabel(score.overall_score)
    const text = `${emoji} My Glass Skin Score: ${score.overall_score}/100, ${label}\n\nLuminosity: ${score.luminosity_score} · Smoothness: ${score.smoothness_score} · Clarity: ${score.clarity_score} · Hydration: ${score.hydration_score} · Evenness: ${score.evenness_score}\n\nCheck yours at seoulsister.com`

    const blob = await getShareBlob()
    if (!blob) return

    const file = new File([blob], `glass-skin-score-${score.overall_score}.png`, { type: 'image/png' })

    // Path 1: native share sheet with image (iOS/Android and share-capable desktop)
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ text, files: [file] })
        flashStatus('shared')
        return
      } catch (err) {
        // AbortError = user cancelled, don't fall through
        if ((err as { name?: string })?.name === 'AbortError') return
      }
    }

    // Path 2: clipboard image write (modern desktop Chrome/Edge/Safari)
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        flashStatus('copied')
        return
      } catch {
        // Fall through to download
      }
    }

    // Path 3: trigger download as final fallback
    downloadBlob(blob)
    flashStatus('downloaded')
  }, [score, getShareBlob, downloadBlob, flashStatus])

  const handleDownload = useCallback(async () => {
    const blob = await getShareBlob()
    if (!blob) return
    downloadBlob(blob)
  }, [getShareBlob, downloadBlob])

  const confirmationLabel =
    status === 'shared' ? 'Shared!' :
    status === 'copied' ? 'Image copied, paste anywhere' :
    status === 'downloaded' ? 'Image downloaded' :
    null

  return (
    <div className="flex gap-2">
      <button
        onClick={handleShare}
        className="glass-card flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white/70 hover:text-gold transition-colors duration-200"
      >
        {confirmationLabel ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">{confirmationLabel}</span>
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            Share Score
          </>
        )}
      </button>
      <button
        onClick={handleDownload}
        className="glass-card px-4 py-2.5 flex items-center justify-center text-white/70 hover:text-gold transition-colors duration-200"
        aria-label="Download score image"
      >
        <Download className="w-4 h-4" />
      </button>

      {/* Hidden canvas for image generation */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
