import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/supabase'
import { createBillingPortalSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
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

    // Check ss_subscriptions first (Stripe-managed)
    const { data: subscription } = await serviceClient
      .from('ss_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!subscription?.stripe_customer_id) {
      // No Stripe subscription row — user has a manually-set plan or no subscription.
      // They can't use the Stripe billing portal without a Stripe customer record.
      return NextResponse.json(
        { error: 'No Stripe subscription found. Your plan was set up manually — contact support to manage it.' },
        { status: 404 }
      )
    }

    const origin = request.headers.get('origin') || 'https://www.seoulsister.com'

    const url = await createBillingPortalSession({
      stripeCustomerId: subscription.stripe_customer_id,
      returnUrl: `${origin}/dashboard`,
    })

    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
