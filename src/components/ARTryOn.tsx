'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, CameraOff, Download, Sparkles, Palette, RefreshCw, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Skin tone detection with inclusive ranges
const SKIN_TONE_RANGES = [
  { name: 'Porcelain', hsv: { h: [0, 50], s: [5, 30], v: [80, 100] }, hex: '#FDEBD7' },
  { name: 'Fair', hsv: { h: [0, 40], s: [10, 35], v: [75, 95] }, hex: '#FAE5D3' },
  { name: 'Light', hsv: { h: [15, 35], s: [15, 40], v: [70, 90] }, hex: '#F5DCC1' },
  { name: 'Medium Light', hsv: { h: [10, 30], s: [20, 45], v: [65, 85] }, hex: '#EDCDBB' },
  { name: 'Medium', hsv: { h: [10, 25], s: [25, 50], v: [55, 75] }, hex: '#D4A574' },
  { name: 'Medium Deep', hsv: { h: [8, 22], s: [30, 55], v: [45, 65] }, hex: '#BC8E5A' },
  { name: 'Deep', hsv: { h: [5, 20], s: [35, 60], v: [35, 55] }, hex: '#9B6B43' },
  { name: 'Rich', hsv: { h: [5, 18], s: [40, 65], v: [25, 45] }, hex: '#7A5230' },
  { name: 'Ebony', hsv: { h: [0, 15], s: [45, 70], v: [15, 35] }, hex: '#5C3A21' },
  { name: 'Onyx', hsv: { h: [0, 10], s: [50, 75], v: [5, 25] }, hex: '#3E2415' }
]

// Product categories with AR effects
const AR_PRODUCTS = {
  foundation: {
    name: 'Foundation',
    opacity: 0.6,
    blend: 'multiply',
    adjustForTone: true
  },
  blush: {
    name: 'Blush',
    opacity: 0.4,
    blend: 'normal',
    zones: ['cheeks'],
    adjustForTone: true
  },
  lipstick: {
    name: 'Lip Color',
    opacity: 0.8,
    blend: 'normal',
    zones: ['lips'],
    adjustForTone: false
  },
  eyeshadow: {
    name: 'Eye Shadow',
    opacity: 0.7,
    blend: 'normal',
    zones: ['eyelids'],
    adjustForTone: true
  }
}

interface ARTryOnProps {
  productType?: keyof typeof AR_PRODUCTS
  productColor?: string
  productId?: string
  onCapture?: (imageData: string) => void
}

export default function ARTryOn({
  productType = 'foundation',
  productColor = '#E8B4B8',
  productId,
  onCapture
}: ARTryOnProps) {
  const [isActive, setIsActive] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [detectedTone, setDetectedTone] = useState<typeof SKIN_TONE_RANGES[0] | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [adjustedColor, setAdjustedColor] = useState(productColor)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Request camera access
  const requestCameraAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      setHasPermission(true)
      setIsActive(true)

      // Start skin tone detection after camera loads
      setTimeout(() => detectSkinTone(), 1000)
    } catch (error) {
      console.error('Camera access denied:', error)
      setHasPermission(false)
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsActive(false)
  }, [])

  // Detect skin tone from video
  const detectSkinTone = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // Set canvas size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Sample center area of face (typically forehead/cheek area)
    const imageData = ctx.getImageData(
      canvas.width * 0.4,
      canvas.height * 0.3,
      canvas.width * 0.2,
      canvas.height * 0.2
    )

    // Analyze pixels
    const pixels = imageData.data
    let totalR = 0, totalG = 0, totalB = 0
    let validPixels = 0

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]

      // Filter out non-skin pixels (very dark or very bright)
      if (r > 50 && r < 250 && g > 30 && b > 20) {
        totalR += r
        totalG += g
        totalB += b
        validPixels++
      }
    }

    if (validPixels > 0) {
      const avgR = totalR / validPixels
      const avgG = totalG / validPixels
      const avgB = totalB / validPixels

      // Convert to HSV for better skin tone matching
      const hsv = rgbToHsv(avgR, avgG, avgB)

      // Find closest skin tone
      const tone = SKIN_TONE_RANGES.find(range =>
        hsv.h >= range.hsv.h[0] && hsv.h <= range.hsv.h[1] &&
        hsv.s >= range.hsv.s[0] && hsv.s <= range.hsv.s[1] &&
        hsv.v >= range.hsv.v[0] && hsv.v <= range.hsv.v[1]
      ) || SKIN_TONE_RANGES[4] // Default to medium if no match

      setDetectedTone(tone)
      adjustColorForSkinTone(tone)
    }
  }, [])

  // Adjust product color for skin tone
  const adjustColorForSkinTone = useCallback((tone: typeof SKIN_TONE_RANGES[0]) => {
    if (!AR_PRODUCTS[productType].adjustForTone) {
      setAdjustedColor(productColor)
      return
    }

    // Parse skin tone hex
    const toneRgb = hexToRgb(tone.hex)
    const productRgb = hexToRgb(productColor)

    if (!toneRgb || !productRgb) {
      setAdjustedColor(productColor)
      return
    }

    // Intelligent color adjustment based on skin tone
    let adjustedR, adjustedG, adjustedB

    const toneIndex = SKIN_TONE_RANGES.indexOf(tone)
    const isLightTone = toneIndex < 4
    const isMediumTone = toneIndex >= 4 && toneIndex < 7
    const isDeepTone = toneIndex >= 7

    if (productType === 'foundation') {
      // Foundation should blend with skin tone
      adjustedR = Math.round(toneRgb.r * 0.7 + productRgb.r * 0.3)
      adjustedG = Math.round(toneRgb.g * 0.7 + productRgb.g * 0.3)
      adjustedB = Math.round(toneRgb.b * 0.7 + productRgb.b * 0.3)
    } else if (productType === 'blush') {
      // Blush intensity varies by skin tone
      const intensity = isLightTone ? 0.6 : isMediumTone ? 0.7 : 0.8
      adjustedR = Math.min(255, Math.round(productRgb.r * intensity))
      adjustedG = Math.round(productRgb.g * intensity * 0.8)
      adjustedB = Math.round(productRgb.b * intensity * 0.8)
    } else {
      // Other products with subtle adjustments
      const brightness = isDeepTone ? 1.2 : isMediumTone ? 1.1 : 1.0
      adjustedR = Math.min(255, Math.round(productRgb.r * brightness))
      adjustedG = Math.min(255, Math.round(productRgb.g * brightness))
      adjustedB = Math.min(255, Math.round(productRgb.b * brightness))
    }

    setAdjustedColor(rgbToHex(adjustedR, adjustedG, adjustedB))
  }, [productType, productColor])

  // Apply AR effect
  const applyAREffect = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    setIsProcessing(true)

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Apply product overlay based on type
    const product = AR_PRODUCTS[productType]
    ctx.globalAlpha = product.opacity
    ctx.globalCompositeOperation = product.blend as GlobalCompositeOperation

    if (productType === 'foundation') {
      // Full face overlay
      ctx.fillStyle = adjustedColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else if (productType === 'blush') {
      // Cheek area overlay with gradient
      const gradient = ctx.createRadialGradient(
        canvas.width * 0.3, canvas.height * 0.5, 20,
        canvas.width * 0.3, canvas.height * 0.5, 80
      )
      gradient.addColorStop(0, adjustedColor)
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fillRect(canvas.width * 0.2, canvas.height * 0.4, 160, 120)

      // Right cheek
      const gradient2 = ctx.createRadialGradient(
        canvas.width * 0.7, canvas.height * 0.5, 20,
        canvas.width * 0.7, canvas.height * 0.5, 80
      )
      gradient2.addColorStop(0, adjustedColor)
      gradient2.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient2
      ctx.fillRect(canvas.width * 0.6, canvas.height * 0.4, 160, 120)
    }

    // Reset composite operation
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    // Capture the result
    const imageData = canvas.toDataURL('image/png')
    setCapturedImage(imageData)
    setIsProcessing(false)

    // Haptic feedback
    if (window.navigator.vibrate) {
      window.navigator.vibrate(100)
    }
  }, [productType, adjustedColor])

  // Utility functions
  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const diff = max - min

    let h = 0
    const s = max === 0 ? 0 : diff / max
    const v = max

    if (diff !== 0) {
      switch (max) {
        case r: h = ((g - b) / diff + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / diff + 2) / 6; break
        case b: h = ((r - g) / diff + 4) / 6; break
      }
    }

    return {
      h: h * 360,
      s: s * 100,
      v: v * 100
    }
  }

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return (
    <div className="ar-tryon-container">
      <div className="ar-header">
        <h2 className="text-2xl font-light text-white mb-2">
          AI Virtual Try-On
        </h2>
        <p className="text-sm text-gold/60">
          Works beautifully with all skin tones
        </p>
      </div>

      {/* Camera View */}
      <div className="ar-viewport">
        {!isActive ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ar-start"
          >
            <Camera className="w-16 h-16 text-gold mb-4" />
            <h3 className="text-xl mb-2">Ready to Try On?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Our AI adjusts products perfectly for your unique skin tone
            </p>
            <button
              onClick={requestCameraAccess}
              className="btn-luxury-primary"
            >
              Start Camera
            </button>
            {hasPermission === false && (
              <p className="text-red-400 text-sm mt-4">
                Camera permission denied. Please enable it in your browser settings.
              </p>
            )}
          </motion.div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="ar-video"
            />
            <canvas
              ref={canvasRef}
              className="ar-canvas"
              style={{ display: capturedImage ? 'block' : 'none' }}
            />

            {/* AR Controls */}
            <div className="ar-controls">
              {/* Detected Skin Tone */}
              {detectedTone && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="skin-tone-indicator"
                >
                  <div
                    className="tone-swatch"
                    style={{ backgroundColor: detectedTone.hex }}
                  />
                  <span className="text-xs">
                    Detected: {detectedTone.name}
                  </span>
                </motion.div>
              )}

              {/* Product Color */}
              <div className="color-selector">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="color-button"
                  style={{ backgroundColor: adjustedColor }}
                >
                  <Palette className="w-4 h-4" />
                </button>
                {showColorPicker && (
                  <div className="color-picker">
                    {['#E8B4B8', '#D4AF37', '#FF6B6B', '#4ECDC4', '#95E1D3'].map(color => (
                      <button
                        key={color}
                        onClick={() => {
                          setAdjustedColor(color)
                          setShowColorPicker(false)
                        }}
                        className="color-option"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <button
                onClick={applyAREffect}
                disabled={isProcessing}
                className="btn-capture"
              >
                {isProcessing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                Try On
              </button>

              {capturedImage && (
                <button
                  onClick={() => {
                    if (onCapture) onCapture(capturedImage)
                    // Download image
                    const link = document.createElement('a')
                    link.download = 'seoul-sister-tryon.png'
                    link.href = capturedImage
                    link.click()
                  }}
                  className="btn-download"
                >
                  <Download className="w-5 h-5" />
                  Save
                </button>
              )}

              <button
                onClick={stopCamera}
                className="btn-stop"
              >
                <CameraOff className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Results Gallery */}
      {capturedImage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="ar-results"
        >
          <h3 className="text-lg mb-3">Your Look</h3>
          <img
            src={capturedImage}
            alt="Virtual try-on result"
            className="result-image"
          />
          <div className="result-actions">
            <button className="btn-luxury-ghost">
              Share
            </button>
            <button className="btn-luxury-primary">
              Buy This Look
            </button>
          </div>
        </motion.div>
      )}

      <style jsx>{`
        .ar-tryon-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
        }

        .ar-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .ar-viewport {
          position: relative;
          background: #1E1E1E;
          border: 1px solid #D4AF37;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 4/3;
        }

        .ar-start {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 2rem;
        }

        .ar-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ar-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        .ar-controls {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 1rem;
          align-items: center;
          background: rgba(10, 10, 10, 0.9);
          padding: 1rem;
          border-radius: 50px;
          border: 1px solid rgba(212, 175, 55, 0.3);
        }

        .skin-tone-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: rgba(30, 30, 30, 0.9);
          border-radius: 20px;
        }

        .tone-swatch {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #D4AF37;
        }

        .color-selector {
          position: relative;
        }

        .color-button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #D4AF37;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: transform 0.2s;
        }

        .color-button:hover {
          transform: scale(1.1);
        }

        .color-picker {
          position: absolute;
          bottom: 50px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #1E1E1E;
          border: 1px solid #D4AF37;
          border-radius: 25px;
        }

        .color-option {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .color-option:hover {
          border-color: #D4AF37;
          transform: scale(1.1);
        }

        .btn-capture, .btn-download, .btn-stop {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid #D4AF37;
          background: transparent;
          color: #D4AF37;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }

        .btn-capture:hover {
          background: #D4AF37;
          color: #0A0A0A;
        }

        .btn-stop:hover {
          background: #FF6B6B;
          border-color: #FF6B6B;
          color: white;
        }

        .ar-results {
          margin-top: 2rem;
          text-align: center;
        }

        .result-image {
          width: 100%;
          border-radius: 8px;
          border: 1px solid #D4AF37;
          margin-bottom: 1rem;
        }

        .result-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .ar-tryon-container {
            padding: 1rem;
          }

          .ar-controls {
            bottom: 10px;
            padding: 0.75rem;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  )
}