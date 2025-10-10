/**
 * Seoul Sister Analytics Tracking
 * Comprehensive analytics for conversion optimization
 */

interface AnalyticsEvent {
  event: string
  category: string
  label?: string
  value?: number
  metadata?: Record<string, any>
}

class SeoulSisterAnalytics {
  private queue: AnalyticsEvent[] = []
  private sessionId: string
  private userId: string | null = null

  constructor() {
    this.sessionId = this.generateSessionId()
    this.initializeTracking()
  }

  private generateSessionId(): string {
    return `ss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeTracking() {
    // Track page views
    if (typeof window !== 'undefined') {
      // Google Analytics 4
      if ((window as any).gtag) {
        (window as any).gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
          session_id: this.sessionId
        })
      }

      // Track session start
      this.track('session_start', 'engagement', {
        source: this.getTrafficSource(),
        device: this.getDeviceType(),
        viewport: `${window.innerWidth}x${window.innerHeight}`
      })

      // Track scroll depth
      this.trackScrollDepth()

      // Track time on page
      this.trackTimeOnPage()

      // Track rage clicks
      this.trackRageClicks()
    }
  }

  // Core tracking method
  track(event: string, category: string, metadata?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      category,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        userId: this.userId,
        url: typeof window !== 'undefined' ? window.location.href : ''
      }
    }

    // Send to GA4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, {
        event_category: category,
        event_label: metadata?.label,
        value: metadata?.value,
        custom_parameters: metadata
      })
    }

    // Store in Supabase for custom analytics
    this.storeEvent(analyticsEvent)

    // Add to queue for batch processing
    this.queue.push(analyticsEvent)

    // Process queue if it's getting large
    if (this.queue.length >= 10) {
      this.processQueue()
    }
  }

  // E-commerce tracking
  trackProductView(product: any) {
    this.track('view_item', 'ecommerce', {
      item_id: product.id,
      item_name: product.name_english,
      brand: product.brand,
      category: product.category,
      price: product.seoul_price,
      us_price: product.us_price,
      savings_percentage: product.savings_percentage
    })
  }

  trackAddToCart(product: any) {
    this.track('add_to_cart', 'ecommerce', {
      item_id: product.id,
      item_name: product.name_english,
      brand: product.brand,
      price: product.seoul_price,
      savings: product.us_price - product.seoul_price
    })
  }

  trackPurchase(order: any) {
    this.track('purchase', 'ecommerce', {
      transaction_id: order.id,
      value: order.total_amount,
      items: order.products,
      savings_total: order.total_savings
    })
  }

  // Conversion funnel tracking
  trackFunnelStep(step: string, metadata?: any) {
    const funnelSteps = {
      'landing_page_view': 1,
      'price_comparison_view': 2,
      'testimonial_view': 3,
      'calculator_interaction': 4,
      'whatsapp_click': 5,
      'order_initiated': 6,
      'order_completed': 7
    }

    this.track('funnel_progress', 'conversion', {
      step,
      step_number: funnelSteps[step as keyof typeof funnelSteps],
      ...metadata
    })
  }

  // Viral tracking
  trackViralShare(platform: string, content: string) {
    this.track('share', 'viral', {
      platform,
      content,
      potential_reach: this.estimateReach(platform)
    })
  }

  trackViralToolUsage(tool: string, output?: string) {
    this.track('viral_tool_used', 'engagement', {
      tool,
      output_generated: !!output
    })
  }

  // User behavior tracking
  private trackScrollDepth() {
    if (typeof window === 'undefined') return

    let maxScroll = 0
    const checkpoints = [25, 50, 75, 90, 100]

    window.addEventListener('scroll', () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      )

      checkpoints.forEach(checkpoint => {
        if (scrollPercent >= checkpoint && maxScroll < checkpoint) {
          this.track('scroll_depth', 'engagement', {
            depth: checkpoint,
            time_to_scroll: Date.now() - parseInt(this.sessionId.split('_')[1])
          })
        }
      })

      maxScroll = Math.max(maxScroll, scrollPercent)
    })
  }

  private trackTimeOnPage() {
    if (typeof window === 'undefined') return

    const startTime = Date.now()

    window.addEventListener('beforeunload', () => {
      const timeOnPage = Math.round((Date.now() - startTime) / 1000)
      this.track('time_on_page', 'engagement', {
        seconds: timeOnPage,
        quality: timeOnPage > 60 ? 'high' : timeOnPage > 20 ? 'medium' : 'low'
      })
    })
  }

  private trackRageClicks() {
    if (typeof window === 'undefined') return

    let clickCount = 0
    let lastClickTime = 0

    window.addEventListener('click', (e) => {
      const now = Date.now()

      if (now - lastClickTime < 500) {
        clickCount++

        if (clickCount >= 3) {
          this.track('rage_click', 'behavior', {
            target: (e.target as HTMLElement).tagName,
            location: { x: e.clientX, y: e.clientY }
          })
          clickCount = 0
        }
      } else {
        clickCount = 1
      }

      lastClickTime = now
    })
  }

  // Helper methods
  private getTrafficSource(): string {
    if (typeof window === 'undefined') return 'unknown'

    const referrer = document.referrer
    const urlParams = new URLSearchParams(window.location.search)

    if (urlParams.get('utm_source')) {
      return urlParams.get('utm_source') || 'campaign'
    } else if (referrer.includes('tiktok.com')) {
      return 'tiktok'
    } else if (referrer.includes('instagram.com')) {
      return 'instagram'
    } else if (referrer.includes('google.com')) {
      return 'google'
    } else if (!referrer) {
      return 'direct'
    }

    return 'referral'
  }

  private getDeviceType(): string {
    if (typeof window === 'undefined') return 'unknown'

    const width = window.innerWidth

    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  private estimateReach(platform: string): number {
    const avgReach = {
      'instagram_story': 500,
      'instagram_post': 800,
      'tiktok': 5000,
      'twitter': 300,
      'whatsapp': 50,
      'copy': 100
    }

    return avgReach[platform as keyof typeof avgReach] || 100
  }

  private async storeEvent(event: AnalyticsEvent) {
    try {
      // Store in database for custom reporting
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      })
    } catch (error) {
      console.error('Failed to store analytics event:', error)
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) return

    const events = [...this.queue]
    this.queue = []

    try {
      await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      })
    } catch (error) {
      console.error('Failed to process analytics queue:', error)
      // Re-add events to queue on failure
      this.queue = [...events, ...this.queue]
    }
  }

  // Public methods for components
  setUserId(userId: string) {
    this.userId = userId
  }

  // Conversion goals
  trackGoal(goalName: string, value?: number) {
    this.track('goal_completion', 'conversion', {
      goal_name: goalName,
      goal_value: value
    })
  }

  // A/B testing support
  trackExperiment(experimentName: string, variant: string) {
    this.track('experiment_view', 'optimization', {
      experiment: experimentName,
      variant,
      session_variant: `${experimentName}_${variant}`
    })
  }
}

// Export singleton instance
const analytics = typeof window !== 'undefined' ? new SeoulSisterAnalytics() : null

export default analytics

// Convenience methods
export const trackEvent = (event: string, category: string, metadata?: any) => {
  analytics?.track(event, category, metadata)
}

export const trackProductView = (product: any) => {
  analytics?.trackProductView(product)
}

export const trackFunnelStep = (step: string, metadata?: any) => {
  analytics?.trackFunnelStep(step, metadata)
}

export const trackViralShare = (platform: string, content: string) => {
  analytics?.trackViralShare(platform, content)
}

export const trackGoal = (goalName: string, value?: number) => {
  analytics?.trackGoal(goalName, value)
}