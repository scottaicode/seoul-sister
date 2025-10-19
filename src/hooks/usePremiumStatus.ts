'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/lib/supabase-client';
import { User } from '@supabase/supabase-js';

interface PremiumStatus {
  isPremium: boolean;
  isTrialing: boolean;
  trialEndsAt?: Date;
  subscriptionStatus?: 'active' | 'trialing' | 'canceled' | 'expired' | null;
  loading: boolean;
}

export function usePremiumStatus(): PremiumStatus {
  const [status, setStatus] = useState<PremiumStatus>({
    isPremium: false,
    isTrialing: false,
    loading: true
  });

  const { supabase } = useSupabase();

  useEffect(() => {
    checkPremiumStatus();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkPremiumStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkPremiumStatus = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setStatus({
          isPremium: false,
          isTrialing: false,
          loading: false
        });
        return;
      }

      // Check subscription status in profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('stripe_subscription_id, subscription_status, trial_end, current_period_end, cancel_at_period_end')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        // No profile found - check if user is in trial period
        const trialStatus = await checkTrialStatus(user);
        setStatus({
          isPremium: trialStatus.isTrialing,
          isTrialing: trialStatus.isTrialing,
          trialEndsAt: trialStatus.trialEndsAt,
          subscriptionStatus: trialStatus.isTrialing ? 'trialing' : null,
          loading: false
        });
        return;
      }

      // If no subscription ID, check trial status
      if (!profile.stripe_subscription_id) {
        const trialStatus = await checkTrialStatus(user);
        setStatus({
          isPremium: trialStatus.isTrialing,
          isTrialing: trialStatus.isTrialing,
          trialEndsAt: trialStatus.trialEndsAt,
          subscriptionStatus: trialStatus.isTrialing ? 'trialing' : null,
          loading: false
        });
        return;
      }

      // Determine premium status based on subscription
      const status = profile.subscription_status as 'active' | 'trialing' | 'canceled' | 'expired' | null;
      const isPremium = status === 'active' || status === 'trialing';
      const isTrialing = status === 'trialing';

      setStatus({
        isPremium,
        isTrialing,
        trialEndsAt: isTrialing && profile.trial_end ? new Date(profile.trial_end) : undefined,
        subscriptionStatus: status,
        loading: false
      });
    } catch (error) {
      console.error('Error checking premium status:', error);
      setStatus({
        isPremium: false,
        isTrialing: false,
        loading: false
      });
    }
  };

  const checkTrialStatus = async (user: User): Promise<{ isTrialing: boolean; trialEndsAt?: Date }> => {
    // Check if user has started their 7-day free trial
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const daysSinceSignup = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceSignup <= 7) {
      // User is within trial period
      const trialEndsAt = new Date(createdAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      return {
        isTrialing: true,
        trialEndsAt
      };
    }

    return { isTrialing: false };
  };

  return status;
}

// Hook to enforce premium access
export function useRequirePremium(redirectUrl: string = '/membership') {
  const { isPremium, loading } = usePremiumStatus();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!loading && !isPremium) {
      setShouldRedirect(true);
      // Redirect to membership page
      window.location.href = redirectUrl;
    }
  }, [isPremium, loading, redirectUrl]);

  return { isPremium, loading, shouldRedirect };
}