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
  /**
   * Eager-load this image immediately, bypassing the IntersectionObserver.
   * Use for above-the-fold images where lazy loading hurts LCP (Largest
   * Contentful Paint). As a rule of thumb, the first 5-8 images in any list
   * page should be marked priority — they're almost certainly in the initial
   * viewport, and the observer's first-paint timing is unreliable enough in
   * Firefox that eager-loading is the safer default for LCP candidates.
   */
  priority?: boolean
}

// Transparent 1x1 pixel placeholder — prevents broken image icons before load
const BLANK_PIXEL =
  'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'

export default function LazyImage({
  src,
  alt,
  className = '',
  rootMargin = '200px',
  priority = false,
}: LazyImageProps) {
  // Priority images skip the observer entirely and load immediately. This is
  // the Core Web Vitals-correct behavior for above-the-fold LCP candidates.
  const [inView, setInView] = useState(priority)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (priority) return // Already eager-loaded, no observer needed

    const node = imgRef.current
    if (!node) return

    // Fallback: if IntersectionObserver is unavailable, load immediately
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

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

    return () => observer.disconnect()
  }, [rootMargin, priority])

  return (
    <img
      ref={imgRef}
      src={inView ? src : BLANK_PIXEL}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      {...(priority && { fetchPriority: 'high' })}
    />
  )
}
