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

export default function ShareCard({ score }: Props) {
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generateShareImage = useCallback(() => {
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

    return canvas.toDataURL('image/png')
  }, [score])

  const handleShare = useCallback(async () => {
    const emoji = getScoreEmoji(score.overall_score)
    const label = getScoreLabel(score.overall_score)
    const text = `${emoji} My Glass Skin Score: ${score.overall_score}/100 — ${label}\n\nLuminosity: ${score.luminosity_score} · Smoothness: ${score.smoothness_score} · Clarity: ${score.clarity_score} · Hydration: ${score.hydration_score} · Evenness: ${score.evenness_score}\n\nCheck yours at seoulsister.com`

    if (navigator.share) {
      const imageData = generateShareImage()
      if (imageData) {
        try {
          const blob = await (await fetch(imageData)).blob()
          const file = new File([blob], 'glass-skin-score.png', { type: 'image/png' })
          await navigator.share({ text, files: [file] })
          return
        } catch {
          // Fallback to text-only share
        }
      }
      try {
        await navigator.share({ text })
        return
      } catch {
        // User cancelled or share failed
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }, [score, generateShareImage])

  const handleDownload = useCallback(() => {
    const imageData = generateShareImage()
    if (!imageData) return

    const link = document.createElement('a')
    link.download = `glass-skin-score-${score.overall_score}.png`
    link.href = imageData
    link.click()
  }, [score, generateShareImage])

  return (
    <div className="flex gap-2">
      <button
        onClick={handleShare}
        className="glass-card flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white/70 hover:text-gold transition-colors duration-200"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">Copied!</span>
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
