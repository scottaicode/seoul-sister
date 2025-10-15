'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

interface BehaviorTrackingContext {
  authenticityScore?: number;
  price?: number;
  isBestDeal?: boolean;
  riskLevel?: string;
  timeSpent?: number;
  satisfactionRating?: number;
  // Authenticity report fields
  isAuthentic?: boolean;
  confidenceLevel?: number;
  purchasePrice?: number;
  purchaseDate?: string;
  hasPhotoEvidence?: boolean;
  hasBatchCode?: boolean;
  packagingIssues?: string;
  productIssues?: string;
}

interface UseBehaviorTrackingReturn {
  trackDealView: (productId: string, retailerId: string, context?: BehaviorTrackingContext) => void;
  trackClickThrough: (productId: string, retailerId: string, context?: BehaviorTrackingContext) => void;
  trackAuthenticityGuideView: (productId: string, retailerId: string) => void;
  trackPurchaseReport: (productId: string, retailerId: string, context: BehaviorTrackingContext) => void;
  trackAuthenticityReport: (productId: string, retailerId: string, context: BehaviorTrackingContext) => void;
  sessionId: string;
  startTimer: () => void;
  stopTimer: () => number;
}

export function useBehaviorTracking(): UseBehaviorTrackingReturn {
  const [user, setUser] = useState<any>(null);
  const [sessionId] = useState(() => generateSessionId());
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Generate session ID for anonymous tracking
  function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  const trackBehavior = useCallback(async (
    action: string,
    productId: string,
    retailerId: string,
    context?: BehaviorTrackingContext
  ) => {
    try {
      const response = await fetch('/api/learning/track-behavior', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id || null,
          sessionId,
          productId,
          retailerId,
          action,
          context
        })
      });

      if (!response.ok) {
        console.warn('Failed to track behavior:', await response.text());
      }
    } catch (error) {
      console.warn('Error tracking behavior:', error);
    }
  }, [user?.id, sessionId]);

  const trackDealView = useCallback((
    productId: string,
    retailerId: string,
    context?: BehaviorTrackingContext
  ) => {
    trackBehavior('view_deal', productId, retailerId, context);
  }, [trackBehavior]);

  const trackClickThrough = useCallback((
    productId: string,
    retailerId: string,
    context?: BehaviorTrackingContext
  ) => {
    trackBehavior('click_through', productId, retailerId, context);
  }, [trackBehavior]);

  const trackAuthenticityGuideView = useCallback((
    productId: string,
    retailerId: string
  ) => {
    trackBehavior('view_authenticity_guide', productId, retailerId);
  }, [trackBehavior]);

  const trackPurchaseReport = useCallback((
    productId: string,
    retailerId: string,
    context: BehaviorTrackingContext
  ) => {
    trackBehavior('report_purchase', productId, retailerId, context);
  }, [trackBehavior]);

  const trackAuthenticityReport = useCallback((
    productId: string,
    retailerId: string,
    context: BehaviorTrackingContext
  ) => {
    trackBehavior('report_authenticity', productId, retailerId, context);
  }, [trackBehavior]);

  const startTimer = useCallback(() => {
    setStartTime(Date.now());
  }, []);

  const stopTimer = useCallback((): number => {
    if (startTime === null) return 0;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    setStartTime(null);
    return timeSpent;
  }, [startTime]);

  return {
    trackDealView,
    trackClickThrough,
    trackAuthenticityGuideView,
    trackPurchaseReport,
    trackAuthenticityReport,
    sessionId,
    startTimer,
    stopTimer
  };
}

// Hook for authenticity feedback collection
export function useAuthenticityFeedback() {
  const { trackAuthenticityReport } = useBehaviorTracking();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitAuthenticityReport = useCallback(async (
    productId: string,
    retailerId: string,
    reportData: {
      isAuthentic: boolean;
      confidenceLevel: number;
      purchasePrice?: number;
      purchaseDate?: string;
      hasPhotoEvidence?: boolean;
      hasBatchCode?: boolean;
      packagingIssues?: string;
      productIssues?: string;
    }
  ) => {
    setIsSubmitting(true);
    try {
      await trackAuthenticityReport(productId, retailerId, reportData);
      return { success: true };
    } catch (error) {
      console.error('Failed to submit authenticity report:', error);
      return { success: false, error };
    } finally {
      setIsSubmitting(false);
    }
  }, [trackAuthenticityReport]);

  return {
    submitAuthenticityReport,
    isSubmitting
  };
}

// Hook for community verification
export function useCommunityVerification() {
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const submitCommunityVerification = useCallback(async (
    reportId: string,
    verification: {
      agreesWithReport: boolean;
      expertiseLevel: number;
      confidence: number;
      additionalNotes?: string;
      hasSimilarExperience?: boolean;
    }
  ) => {
    if (!user?.id) {
      throw new Error('Must be logged in to submit community verification');
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/learning/community-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          targetReportId: reportId,
          ...verification
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit community verification');
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to submit community verification:', error);
      return { success: false, error };
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id]);

  return {
    submitCommunityVerification,
    isSubmitting
  };
}