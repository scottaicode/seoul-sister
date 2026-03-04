import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = getServiceClient()

    // Check Stripe-managed subscription first
    const { data: subscription } = await serviceClient
      .from('ss_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subscription?.status === 'active') {
      return NextResponse.json({
        plan: 'pro_monthly',
        status: subscription.status,
        tier: SUBSCRIPTION_TIERS.pro_monthly,
        subscription: {
          id: subscription.id,
          current_period_end: subscription.current_period_end,
          canceled_at: subscription.canceled_at,
        },
      })
    }

    // Fallback: check profile plan (manually set, pre-Stripe)
    const { data: profile } = await serviceClient
      .from('ss_user_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile?.plan && profile.plan !== 'free') {
      return NextResponse.json({
        plan: profile.plan,
        status: 'active',
        tier: SUBSCRIPTION_TIERS.pro_monthly,
        subscription: null, // No Stripe subscription — manual plan
      })
    }

    return NextResponse.json({
      plan: null,
      status: 'inactive',
      tier: null,
      subscription: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
