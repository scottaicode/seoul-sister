'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  sizes?: string
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
}

// Generate blur placeholder for better perceived performance
const generateBlurPlaceholder = (color: string = '#1a1a1a'): string => {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return ''

  canvas.width = 10
  canvas.height = 10
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = color
  ctx.fillRect(0, 0, 10, 10)
  return canvas.toDataURL()
}

export default function OptimizedImage({
  src,
  alt,
  width = 600,
  height = 600,
  priority = false,
  className = '',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  quality = 85,
  placeholder = 'blur',
  blurDataURL
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [optimizedSrc, setOptimizedSrc] = useState(src)

  // Optimize image URL based on screen size
  useEffect(() => {
    if (typeof window === 'undefined') return

    const screenWidth = window.innerWidth
    let optimizedUrl = src

    // Optimize Unsplash images
    if (src.includes('unsplash.com')) {
      if (screenWidth <= 390) {
        // iPhone 14 and smaller
        optimizedUrl = src.replace(/w=\d+/, 'w=390').replace(/q=\d+/, 'q=80')
      } else if (screenWidth <= 768) {
        // Tablets
        optimizedUrl = src.replace(/w=\d+/, 'w=768').replace(/q=\d+/, 'q=85')
      } else {
        // Desktop
        optimizedUrl = src.replace(/w=\d+/, 'w=1200').replace(/q=\d+/, 'q=90')
      }

      // Add format optimization
      if (!optimizedUrl.includes('fm=')) {
        optimizedUrl += '&fm=webp'
      }
    }

    setOptimizedSrc(optimizedUrl)
  }, [src])

  // Fallback for failed images
  const handleError = () => {
    setHasError(true)
    // Fallback to a placeholder image
    setOptimizedSrc(`https://via.placeholder.com/${width}x${height}/1a1a1a/D4A574?text=Seoul+Sister`)
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-zinc-800/10 to-transparent animate-shimmer" />
        </div>
      )}

      <Image
        src={optimizedSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        quality={quality}
        sizes={sizes}
        placeholder={placeholder}
        blurDataURL={blurDataURL || generateBlurPlaceholder()}
        onLoadingComplete={() => setIsLoaded(true)}
        onError={handleError}
        className={`
          transition-opacity duration-500
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
          ${hasError ? 'filter grayscale' : ''}
        `}
        loading={priority ? 'eager' : 'lazy'}
      />

      {/* Error state overlay */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider">
            Image Loading Failed
          </p>
        </div>
      )}
    </div>
  )
}