/**
 * Seoul Sister Performance Monitoring
 * Tracks and optimizes mobile performance metrics
 */

interface PerformanceMetrics {
  FCP: number | null  // First Contentful Paint
  LCP: number | null  // Largest Contentful Paint
  FID: number | null  // First Input Delay
  CLS: number | null  // Cumulative Layout Shift
  TTFB: number | null // Time to First Byte
  TTI: number | null  // Time to Interactive
  loadTime: number | null
  deviceType: string
  connectionType: string
  memoryUsage?: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    FCP: null,
    LCP: null,
    FID: null,
    CLS: null,
    TTFB: null,
    TTI: null,
    loadTime: null,
    deviceType: 'unknown',
    connectionType: 'unknown'
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeMonitoring()
    }
  }

  private initializeMonitoring() {
    // Track Core Web Vitals
    this.trackCoreWebVitals()

    // Track page load time
    this.trackPageLoadTime()

    // Track device and connection info
    this.trackDeviceInfo()

    // Monitor memory usage (if available)
    this.trackMemoryUsage()

    // Set up performance observer
    this.setupPerformanceObserver()

    // Report metrics after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.reportMetrics()
      }, 2000)
    })
  }

  private trackCoreWebVitals() {
    // First Contentful Paint
    try {
      const paintEntries = performance.getEntriesByType('paint')
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
      if (fcpEntry) {
        this.metrics.FCP = Math.round(fcpEntry.startTime)
      }
    } catch (e) {
      console.error('Error tracking FCP:', e)
    }

    // Time to First Byte
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      if (navEntries.length > 0) {
        const navEntry = navEntries[0]
        this.metrics.TTFB = Math.round(navEntry.responseStart - navEntry.requestStart)
      }
    } catch (e) {
      console.error('Error tracking TTFB:', e)
    }
  }

  private trackPageLoadTime() {
    if (performance.timing) {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart
      this.metrics.loadTime = Math.round(loadTime)
    }
  }

  private trackDeviceInfo() {
    // Detect device type
    const width = window.innerWidth
    if (width < 768) {
      this.metrics.deviceType = 'mobile'
    } else if (width < 1024) {
      this.metrics.deviceType = 'tablet'
    } else {
      this.metrics.deviceType = 'desktop'
    }

    // Detect connection type
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection

    if (connection) {
      this.metrics.connectionType = connection.effectiveType || 'unknown'
    }
  }

  private trackMemoryUsage() {
    const performance = window.performance as any
    if (performance.memory) {
      this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1048576) // Convert to MB
    }
  }

  private setupPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return

    // Track Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as any
        this.metrics.LCP = Math.round(lastEntry.renderTime || lastEntry.loadTime)
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
    } catch (e) {
      console.error('Error setting up LCP observer:', e)
    }

    // Track First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        if (entries.length > 0) {
          const firstInput = entries[0] as any
          this.metrics.FID = Math.round(firstInput.processingStart - firstInput.startTime)
        }
      })
      fidObserver.observe({ entryTypes: ['first-input'] })
    } catch (e) {
      console.error('Error setting up FID observer:', e)
    }

    // Track Cumulative Layout Shift
    try {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        this.metrics.CLS = Math.round(clsValue * 1000) / 1000
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    } catch (e) {
      console.error('Error setting up CLS observer:', e)
    }
  }

  private reportMetrics() {
    console.log('📊 Performance Metrics:', this.metrics)

    // Send to analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'performance', {
        event_category: 'Web Vitals',
        event_label: this.metrics.deviceType,
        value: this.metrics.LCP,
        custom_parameters: this.metrics
      })
    }

    // Send to custom analytics endpoint
    this.sendToAnalytics()

    // Check performance thresholds and warn if needed
    this.checkPerformanceThresholds()
  }

  private async sendToAnalytics() {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'performance_metrics',
          category: 'performance',
          metadata: this.metrics
        })
      })
    } catch (error) {
      console.error('Failed to send performance metrics:', error)
    }
  }

  private checkPerformanceThresholds() {
    const warnings: string[] = []

    // Check against Google's Core Web Vitals thresholds
    if (this.metrics.LCP && this.metrics.LCP > 2500) {
      warnings.push(`LCP is ${this.metrics.LCP}ms (should be < 2500ms)`)
    }

    if (this.metrics.FID && this.metrics.FID > 100) {
      warnings.push(`FID is ${this.metrics.FID}ms (should be < 100ms)`)
    }

    if (this.metrics.CLS && this.metrics.CLS > 0.1) {
      warnings.push(`CLS is ${this.metrics.CLS} (should be < 0.1)`)
    }

    if (this.metrics.TTFB && this.metrics.TTFB > 800) {
      warnings.push(`TTFB is ${this.metrics.TTFB}ms (should be < 800ms)`)
    }

    if (warnings.length > 0) {
      console.warn('⚠️ Performance issues detected:', warnings)
    } else {
      console.log('✅ All performance metrics are within acceptable ranges')
    }
  }

  // Public methods

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  public markCustomTiming(name: string, time?: number) {
    if (performance.mark) {
      performance.mark(name)
    }
  }

  public measureCustomTiming(name: string, startMark: string, endMark: string) {
    if (performance.measure) {
      try {
        performance.measure(name, startMark, endMark)
        const measures = performance.getEntriesByName(name)
        if (measures.length > 0) {
          return Math.round(measures[0].duration)
        }
      } catch (e) {
        console.error('Error measuring custom timing:', e)
      }
    }
    return null
  }

  // Optimization helpers

  public prefetchImages(urls: string[]) {
    urls.forEach(url => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'image'
      link.href = url
      document.head.appendChild(link)
    })
  }

  public lazyLoadImages() {
    if ('IntersectionObserver' in window) {
      const images = document.querySelectorAll('img[data-lazy]')
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            img.src = img.dataset.lazy || ''
            img.removeAttribute('data-lazy')
            imageObserver.unobserve(img)
          }
        })
      })

      images.forEach(img => imageObserver.observe(img))
    }
  }

  public optimizeForSlowConnections() {
    const connection = (navigator as any).connection
    if (connection && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g')) {
      // Reduce image quality
      document.documentElement.classList.add('low-bandwidth')

      // Disable autoplay videos
      const videos = document.querySelectorAll('video[autoplay]')
      videos.forEach((video) => {
        (video as HTMLVideoElement).removeAttribute('autoplay')
      })

      console.log('📱 Optimizing for slow connection...')
    }
  }
}

// Export singleton instance
const performanceMonitor = typeof window !== 'undefined' ? new PerformanceMonitor() : null

export default performanceMonitor

// Convenience functions
export const trackPerformance = () => {
  return performanceMonitor?.getMetrics()
}

export const markTiming = (name: string) => {
  performanceMonitor?.markCustomTiming(name)
}

export const measureTiming = (name: string, start: string, end: string) => {
  return performanceMonitor?.measureCustomTiming(name, start, end)
}

export const prefetchImages = (urls: string[]) => {
  performanceMonitor?.prefetchImages(urls)
}

export const optimizeForMobile = () => {
  performanceMonitor?.lazyLoadImages()
  performanceMonitor?.optimizeForSlowConnections()
}