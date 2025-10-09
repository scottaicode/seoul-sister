'use client';

import React, { useEffect } from 'react';

interface AnalyticsEvent {
  event: string;
  parameters: Record<string, any>;
  timestamp: number;
}

interface AnalyticsTrackerProps {
  userId?: string;
  sessionId?: string;
}

class SeoulSisterAnalytics {
  private static instance: SeoulSisterAnalytics;
  private events: AnalyticsEvent[] = [];
  private sessionId: string;
  private userId?: string;
  private isInitialized = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    if (typeof window !== 'undefined') {
      this.initializeAnalytics();
    }
  }

  static getInstance(): SeoulSisterAnalytics {
    if (!SeoulSisterAnalytics.instance) {
      SeoulSisterAnalytics.instance = new SeoulSisterAnalytics();
    }
    return SeoulSisterAnalytics.instance;
  }

  private generateSessionId(): string {
    return `ss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeAnalytics() {
    if (this.isInitialized) return;

    // Initialize Google Analytics 4 if available
    if ((window as any).gtag) {
      (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
        custom_map: {
          custom_session_id: 'session_id',
          custom_user_type: 'user_type'
        }
      });
    }

    // Track page view
    this.trackEvent('page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname
    });

    // Set up scroll tracking
    this.setupScrollTracking();

    // Set up engagement tracking
    this.setupEngagementTracking();

    this.isInitialized = true;
  }

  setUserId(userId: string) {
    this.userId = userId;
    if ((window as any).gtag) {
      (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
        user_id: userId
      });
    }
  }

  trackEvent(eventName: string, parameters: Record<string, any> = {}) {
    const event: AnalyticsEvent = {
      event: eventName,
      parameters: {
        ...parameters,
        session_id: this.sessionId,
        user_id: this.userId,
        timestamp: Date.now(),
        user_agent: navigator.userAgent,
        page_url: window.location.href
      },
      timestamp: Date.now()
    };

    this.events.push(event);

    // Send to Google Analytics
    if ((window as any).gtag) {
      (window as any).gtag('event', eventName, parameters);
    }

    // Send to console for debugging
    console.log('Seoul Sister Analytics:', event);

    // Store in localStorage for persistence
    this.persistEvents();

    // Send to custom endpoint (if available)
    this.sendToCustomEndpoint(event);
  }

  // Viral Mechanism Tracking
  trackViralScreenshotGenerated(productData: any) {
    this.trackEvent('viral_screenshot_generated', {
      product_name: productData.productName,
      brand: productData.brand,
      us_price: productData.usPrice,
      seoul_price: productData.seoulPrice,
      savings_amount: productData.savings,
      savings_percent: productData.savingsPercent
    });
  }

  trackViralScreenshotShared(platform: string, productData: any) {
    this.trackEvent('viral_screenshot_shared', {
      platform,
      product_name: productData.productName,
      savings_amount: productData.savings,
      share_method: platform === 'instagram' ? 'instagram_story' : 'download'
    });
  }

  trackViralCopyGenerated(copyData: any) {
    this.trackEvent('viral_copy_generated', {
      platform: copyData.platform,
      style: copyData.style,
      copy_count: copyData.copies_count || 1,
      product_name: copyData.product_name
    });
  }

  trackViralCopyCopied(copyData: any) {
    this.trackEvent('viral_copy_copied', {
      platform: copyData.platform,
      style: copyData.style,
      copy_text_length: copyData.text?.length || 0,
      hashtag_count: copyData.hashtags?.length || 0
    });
  }

  // Order Unlock System Tracking
  trackOrderUnlockProgress(unlockData: any) {
    this.trackEvent('order_unlock_progress', {
      progress_points: unlockData.progress,
      required_points: unlockData.required,
      completed_shares: unlockData.completed_shares,
      unlock_status: unlockData.status
    });
  }

  trackSocialShareCompleted(shareData: any) {
    this.trackEvent('social_share_completed', {
      platform: shareData.platform,
      share_type: shareData.type,
      points_earned: shareData.points,
      screenshot_uploaded: shareData.hasScreenshot
    });
  }

  trackOrderUnlocked(unlockData: any) {
    this.trackEvent('order_unlocked', {
      unlock_status: unlockData.unlockStatus,
      discount_earned: unlockData.nextOrderDiscount,
      total_shares_completed: unlockData.totalShares,
      time_to_unlock_minutes: unlockData.timeToUnlock
    });
  }

  // E-commerce Tracking
  trackProductViewed(productData: any) {
    this.trackEvent('view_item', {
      currency: 'USD',
      value: productData.seoul_price + 25,
      items: [{
        item_id: productData.id,
        item_name: productData.name_english,
        item_brand: productData.brand,
        item_category: 'K-Beauty',
        price: productData.seoul_price + 25,
        quantity: 1
      }]
    });
  }

  trackAddToCart(productData: any) {
    this.trackEvent('add_to_cart', {
      currency: 'USD',
      value: productData.seoul_price + 25,
      items: [{
        item_id: productData.id,
        item_name: productData.name_english,
        item_brand: productData.brand,
        price: productData.seoul_price + 25,
        quantity: 1
      }]
    });
  }

  trackPurchase(orderData: any) {
    this.trackEvent('purchase', {
      transaction_id: orderData.order_id,
      currency: 'USD',
      value: orderData.total,
      items: orderData.items,
      coupon: orderData.discount_code,
      seoul_savings: orderData.seoul_savings
    });
  }

  // Engagement Tracking
  private setupScrollTracking() {
    let maxScroll = 0;
    const trackScroll = () => {
      const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (scrollPercent > maxScroll && scrollPercent % 25 === 0) {
        maxScroll = scrollPercent;
        this.trackEvent('scroll_depth', {
          scroll_percent: scrollPercent,
          page_height: document.body.scrollHeight,
          viewport_height: window.innerHeight
        });
      }
    };

    window.addEventListener('scroll', trackScroll);
  }

  private setupEngagementTracking() {
    // Track time on page
    const startTime = Date.now();

    window.addEventListener('beforeunload', () => {
      const timeOnPage = Math.round((Date.now() - startTime) / 1000);
      this.trackEvent('page_engagement', {
        time_on_page_seconds: timeOnPage,
        events_triggered: this.events.length
      });
    });

    // Track clicks on key elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      if (target.closest('button')) {
        const button = target.closest('button');
        this.trackEvent('button_click', {
          button_text: button?.textContent?.trim() || '',
          button_class: button?.className || '',
          section: this.getNearestSectionName(button)
        });
      }

      if (target.closest('a')) {
        const link = target.closest('a');
        this.trackEvent('link_click', {
          link_text: link?.textContent?.trim() || '',
          link_url: link?.href || '',
          is_external: link?.href?.includes('seoulsister.com') === false
        });
      }
    });
  }

  private getNearestSectionName(element: HTMLElement | null): string {
    let current = element;
    while (current && current !== document.body) {
      if (current.tagName === 'SECTION') {
        const h2 = current.querySelector('h2');
        if (h2) return h2.textContent?.trim() || 'unknown_section';
      }
      current = current.parentElement;
    }
    return 'unknown_section';
  }

  private persistEvents() {
    try {
      const recentEvents = this.events.slice(-50); // Keep last 50 events
      localStorage.setItem('seoul_sister_analytics', JSON.stringify(recentEvents));
    } catch (error) {
      console.warn('Failed to persist analytics events:', error);
    }
  }

  private async sendToCustomEndpoint(event: AnalyticsEvent) {
    try {
      // In a real implementation, this would send to your analytics backend
      // For now, we'll just log to console
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
      }
    } catch (error) {
      console.warn('Failed to send analytics event:', error);
    }
  }

  // Public methods for accessing analytics data
  getSessionEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  getSessionSummary() {
    const events = this.events;
    const viralEvents = events.filter(e => e.event.includes('viral'));
    const shareEvents = events.filter(e => e.event.includes('share'));

    return {
      total_events: events.length,
      viral_actions: viralEvents.length,
      social_shares: shareEvents.length,
      session_duration_minutes: events.length > 0 ?
        Math.round((Date.now() - events[0].timestamp) / (1000 * 60)) : 0,
      most_engaged_section: this.getMostEngagedSection()
    };
  }

  private getMostEngagedSection(): string {
    const sectionClicks = this.events
      .filter(e => e.event === 'button_click' && e.parameters.section)
      .reduce((acc, e) => {
        const section = e.parameters.section;
        acc[section] = (acc[section] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.keys(sectionClicks).reduce((a, b) =>
      sectionClicks[a] > sectionClicks[b] ? a : b, 'homepage'
    );
  }
}

export default function AnalyticsTracker({ userId, sessionId }: AnalyticsTrackerProps) {
  useEffect(() => {
    const analytics = SeoulSisterAnalytics.getInstance();

    if (userId) {
      analytics.setUserId(userId);
    }

    // Track component mount
    analytics.trackEvent('analytics_tracker_initialized', {
      has_user_id: !!userId,
      session_id: sessionId
    });

    return () => {
      // Track component unmount
      analytics.trackEvent('analytics_tracker_destroyed', {
        session_summary: analytics.getSessionSummary()
      });
    };
  }, [userId, sessionId]);

  return null; // This component doesn't render anything
}

// Export the analytics instance for use in other components
export const analytics = SeoulSisterAnalytics.getInstance();

// Export tracking functions for easy use
export const trackViralScreenshotGenerated = (productData: any) =>
  analytics.trackViralScreenshotGenerated(productData);

export const trackViralScreenshotShared = (platform: string, productData: any) =>
  analytics.trackViralScreenshotShared(platform, productData);

export const trackViralCopyGenerated = (copyData: any) =>
  analytics.trackViralCopyGenerated(copyData);

export const trackViralCopyCopied = (copyData: any) =>
  analytics.trackViralCopyCopied(copyData);

export const trackOrderUnlockProgress = (unlockData: any) =>
  analytics.trackOrderUnlockProgress(unlockData);

export const trackSocialShareCompleted = (shareData: any) =>
  analytics.trackSocialShareCompleted(shareData);

export const trackOrderUnlocked = (unlockData: any) =>
  analytics.trackOrderUnlocked(unlockData);

export const trackProductViewed = (productData: any) =>
  analytics.trackProductViewed(productData);

export const trackAddToCart = (productData: any) =>
  analytics.trackAddToCart(productData);

export const trackPurchase = (orderData: any) =>
  analytics.trackPurchase(orderData);