import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe'
import type { SubscriptionPlan } from '@/types/database'

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
    const { data: subscription } = await serviceClient
      .from('ss_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json({
        plan: 'free' as SubscriptionPlan,
        status: 'active',
        tier: SUBSCRIPTION_TIERS.free,
        subscription: null,
      })
    }

    const plan = subscription.plan as SubscriptionPlan
    return NextResponse.json({
      plan,
      status: subscription.status,
      tier: SUBSCRIPTION_TIERS[plan],
      subscription: {
        id: subscription.id,
        current_period_end: subscription.current_period_end,
        canceled_at: subscription.canceled_at,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
