'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * LazyImage — IntersectionObserver-backed lazy loading for product images.
 *
 * Why this exists: The native `loading="lazy"` attribute is unreliable across
 * browsers. Firefox only defers images that are SEVERAL viewport heights below
 * the fold, and browsers require explicit HTML width/height (not CSS) to
 * correctly calculate viewport intersection. This component uses
 * IntersectionObserver to reliably defer off-screen images until they are
 * within 200px of the viewport, matching the Chrome behavior across all
 * browsers.
 *
 * Why it matters for Seoul Sister: 5,294 products hotlink to
 * cdn-image.oliveyoung.com. Without reliable lazy loading, loading a 20-item
 * product list fires 20+ cross-origin image requests on mount, eating
 * bandwidth, CDN cookies, and page load time. With this component, only the
 * ~5-10 images visible in the initial viewport load immediately — the rest
 * wait until the user scrolls.
 *
 * Usage:
 *   <LazyImage
 *     src={product.image_url}
 *     alt={product.name_en}
 *     className="w-full h-full object-cover rounded-xl"
 *   />
 *
 * The component is drop-in replacement for <img>. It uses its own ref-bearing
 * <img> element and handles everything internally. The native loading="lazy"
 * attribute is used as a belt-and-suspenders backup.
 */

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  /** Distance from viewport to start loading (default 200px) */
  rootMargin?: string
}

// Transparent 1x1 pixel placeholder — prevents broken image icons before load
const BLANK_PIXEL =
  'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'

export default function LazyImage({
  src,
  alt,
  className = '',
  rootMargin = '200px',
}: LazyImageProps) {
  const [inView, setInView] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const node = imgRef.current
    if (!node) return

    // Fallback: if IntersectionObserver is unavailable, load immediately
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    // Firefox-specific fix: IntersectionObserver can fail to fire on initial
    // paint if the observed node has a zero-size bounding box at observation
    // time (which happens when the parent container hasn't laid out yet).
    // Chrome schedules an initial intersection check automatically; Firefox
    // doesn't. Symptom: images stay as 1x1 placeholders until the user
    // triggers a reflow (scroll, resize, or hard refresh).
    //
    // Fix: after observing, manually check the bounding box on the next
    // animation frame (after layout has settled) and mark in-view if the
    // element is within rootMargin of the viewport. This acts as a belt
    // alongside the observer's suspenders.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            observer.disconnect()
            break
          }
        }
      },
      { rootMargin }
    )

    observer.observe(node)

    // Manual viewport check on next frame as Firefox fallback
    const rafId = requestAnimationFrame(() => {
      if (!imgRef.current) return
      const rect = imgRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const marginPx = parseInt(rootMargin, 10) || 200
      const isWithinViewport =
        rect.bottom >= -marginPx &&
        rect.top <= viewportHeight + marginPx &&
        rect.width > 0 &&
        rect.height > 0
      if (isWithinViewport) {
        setInView(true)
        observer.disconnect()
      }
    })

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [rootMargin])

  return (
    <img
      ref={imgRef}
      src={inView ? src : BLANK_PIXEL}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  )
}
