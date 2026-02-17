import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getIngredientEffectiveness,
  updateProductEffectiveness,
  updateIngredientEffectiveness,
} from '@/lib/learning/effectiveness'
import { getServiceClient } from '@/lib/supabase'

// GET /api/learning/effectiveness?skin_type=oily&concern=acne
// Returns ingredient effectiveness for a skin type/concern combo
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const skinType = searchParams.get('skin_type')
    const concern = searchParams.get('concern')

    if (!skinType || !concern) {
      return NextResponse.json(
        { error: 'skin_type and concern are required' },
        { status: 400 }
      )
    }

    const effectiveness = await getIngredientEffectiveness(skinType, concern)

    return NextResponse.json({ effectiveness })
  } catch (error) {
    console.error('Effectiveness GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get effectiveness data' },
      { status: 500 }
    )
  }
}

// POST /api/learning/effectiveness
// Submit a routine outcome (user reports how a routine worked for them)
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { product_id, rating, reaction, skin_type, concern } = body

    if (!product_id || (!rating && !reaction)) {
      return NextResponse.json(
        { error: 'product_id and rating or reaction are required' },
        { status: 400 }
      )
    }

    // Get user's skin profile for context
    const db = getServiceClient()
    const { data: profile } = await db
      .from('ss_user_profiles')
      .select('skin_type, skin_concerns')
      .eq('user_id', user.id)
      .single()

    const effectiveSkinType =
      skin_type || (profile as Record<string, unknown>)?.skin_type || null
    const effectiveConcern =
      concern ||
      ((profile as Record<string, unknown>)?.skin_concerns as string[])?.[0] ||
      null

    // Update product effectiveness if rating provided
    if (rating) {
      await updateProductEffectiveness(
        product_id,
        effectiveSkinType as string | null,
        rating
      )
    }

    // Update ingredient effectiveness if reaction provided
    if (reaction) {
      await updateIngredientEffectiveness(
        product_id,
        effectiveSkinType as string | null,
        effectiveConcern as string | null,
        reaction
      )
    }

    // Store routine outcome if this is a full outcome report
    if (body.routine && body.outcome_score) {
      await db.from('ss_routine_outcomes').insert({
        user_id: user.id,
        routine: body.routine,
        skin_type: effectiveSkinType,
        concerns: (profile as Record<string, unknown>)?.skin_concerns || [],
        outcome_score: body.outcome_score,
        outcome_notes: body.outcome_notes || null,
        outcome_reported_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Effectiveness POST error:', error)
    return NextResponse.json(
      { error: 'Failed to update effectiveness' },
      { status: 500 }
    )
  }
}
