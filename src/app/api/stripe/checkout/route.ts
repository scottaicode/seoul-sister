import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutSession, type TierKey } from '@/lib/stripe'

const CheckoutSchema = z.object({
  plan: z.enum(['pro_monthly']),
})

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

    const body = await request.json()
    const parsed = CheckoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid plan', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const origin = request.headers.get('origin') || 'https://seoulsister.com'

    const url = await createCheckoutSession({
      userId: user.id,
      email: user.email!,
      plan: parsed.data.plan as TierKey,
      successUrl: `${origin}/dashboard?subscription=success`,
      cancelUrl: `${origin}/dashboard?subscription=canceled`,
    })

    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
