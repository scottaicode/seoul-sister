import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSubscription, getCustomerSubscriptions } from '@/lib/stripe-server'
import type { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const phoneNumber = searchParams.get('phoneNumber')

    if (!userId && !phoneNumber) {
      return NextResponse.json(
        { error: 'User ID or phone number is required' },
        { status: 400 }
      )
    }

    let profile: any = null

    // Get user profile by ID or phone number
    if (userId) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      profile = data
    } else if (phoneNumber) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phoneNumber)
        .single()
      profile = data
    }

    if (!profile) {
      return NextResponse.json({
        subscription_status: 'none',
        has_active_subscription: false,
        is_in_trial: false,
        trial_days_remaining: 0,
        current_period_end: null,
        can_access_premium: false
      })
    }

    // If no Stripe subscription info, return basic status
    if (!profile.stripe_subscription_id) {
      return NextResponse.json({
        subscription_status: 'none',
        has_active_subscription: false,
        is_in_trial: false,
        trial_days_remaining: 0,
        current_period_end: null,
        can_access_premium: false,
        profile_id: profile.id
      })
    }

    // Get latest subscription status from Stripe
    try {
      const subscription = await getSubscription(profile.stripe_subscription_id)

      // Update local database with latest info
      const updateData = {
        subscription_status: subscription.status,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString()
      }

      if (userId) {
        await (supabase
          .from('profiles') as any)
          .update(updateData)
          .eq('id', userId)
      } else {
        await (supabase
          .from('profiles') as any)
          .update(updateData)
          .eq('phone', phoneNumber)
      }

      // Calculate trial information
      const now = new Date()
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
      const isInTrial = trialEnd ? now < trialEnd : false
      const trialDaysRemaining = isInTrial && trialEnd ?
        Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0

      // Determine if user can access premium content
      const canAccessPremium = ['trialing', 'active'].includes(subscription.status)

      return NextResponse.json({
        subscription_status: subscription.status,
        has_active_subscription: ['trialing', 'active'].includes(subscription.status),
        is_in_trial: isInTrial,
        trial_days_remaining: trialDaysRemaining,
        current_period_end: subscription.current_period_end * 1000,
        cancel_at_period_end: subscription.cancel_at_period_end,
        can_access_premium: canAccessPremium,
        profile_id: profile.id,
        subscription_id: subscription.id
      })

    } catch (stripeError) {
      console.error('Error fetching subscription from Stripe:', stripeError)

      // Fallback to local database info
      const localStatus = profile.subscription_status || 'none'
      const canAccessPremium = ['trialing', 'active'].includes(localStatus)

      return NextResponse.json({
        subscription_status: localStatus,
        has_active_subscription: canAccessPremium,
        is_in_trial: localStatus === 'trialing',
        trial_days_remaining: 0,
        current_period_end: profile.current_period_end ? new Date(profile.current_period_end).getTime() : null,
        cancel_at_period_end: profile.cancel_at_period_end || false,
        can_access_premium: canAccessPremium,
        profile_id: profile.id,
        warning: 'Status from local cache, Stripe sync failed'
      })
    }

  } catch (error) {
    console.error('Error checking subscription status:', error)
    return NextResponse.json(
      {
        error: 'Failed to check subscription status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, phoneNumber, action } = await request.json()

    if (!userId && !phoneNumber) {
      return NextResponse.json(
        { error: 'User ID or phone number is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'refresh':
        // Trigger a fresh sync with Stripe
        const statusResponse = await GET(request)
        return statusResponse

      case 'check_premium_access':
        // Quick check for premium access without full sync
        let quickProfile: any = null

        if (userId) {
          const { data } = await supabase
            .from('profiles')
            .select('subscription_status, trial_end, current_period_end')
            .eq('id', userId)
            .single()
          quickProfile = data
        } else if (phoneNumber) {
          const { data } = await supabase
            .from('profiles')
            .select('subscription_status, trial_end, current_period_end')
            .eq('phone', phoneNumber)
            .single()
          quickProfile = data
        }

        if (!quickProfile) {
          return NextResponse.json({
            can_access_premium: false,
            reason: 'User not found'
          })
        }

        const now = new Date()
        const status = quickProfile.subscription_status
        const trialEnd = quickProfile.trial_end ? new Date(quickProfile.trial_end) : null
        const periodEnd = quickProfile.current_period_end ? new Date(quickProfile.current_period_end) : null

        let canAccess = false
        let reason = 'No active subscription'

        if (status === 'trialing' && trialEnd && now < trialEnd) {
          canAccess = true
          reason = 'Trial active'
        } else if (status === 'active' && periodEnd && now < periodEnd) {
          canAccess = true
          reason = 'Subscription active'
        }

        return NextResponse.json({
          can_access_premium: canAccess,
          reason,
          subscription_status: status
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error in subscription status POST:', error)
    return NextResponse.json(
      { error: 'Failed to process subscription action' },
      { status: 500 }
    )
  }
}