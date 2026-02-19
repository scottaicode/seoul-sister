import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import { getCyclePhase, getRoutineAdjustments } from '@/lib/intelligence/cycle-routine'
import type { SkinProfile, UserCycleTracking } from '@/types/database'

// ---------------------------------------------------------------------------
// GET /api/cycle — Current phase info + routine adjustments + cycle history
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()

    // Load cycle tracking preference
    const { data: profile } = await db
      .from('ss_user_profiles')
      .select('cycle_tracking_enabled, avg_cycle_length, skin_type, skin_concerns, allergies, fitzpatrick_scale, climate, age_range, budget_range, experience_level')
      .eq('user_id', user.id)
      .single()

    if (!profile?.cycle_tracking_enabled) {
      return NextResponse.json({
        enabled: false,
        phase: null,
        adjustments: [],
        history: [],
      })
    }

    // Load most recent cycle entry
    const { data: entries } = await db
      .from('ss_user_cycle_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('cycle_start_date', { ascending: false })
      .limit(10)

    const latestEntry = entries?.[0] as UserCycleTracking | undefined

    if (!latestEntry) {
      return NextResponse.json({
        enabled: true,
        phase: null,
        adjustments: [],
        history: [],
        message: 'No cycle data logged yet. Log your cycle start date to get personalized adjustments.',
      })
    }

    // Calculate current phase
    const cycleLength = latestEntry.cycle_length_days || profile.avg_cycle_length || 28
    const phaseInfo = getCyclePhase(latestEntry.cycle_start_date, cycleLength)

    // Load routine products for context-aware adjustments
    const { data: routines } = await db
      .from('ss_user_routines')
      .select('ss_routine_products(ss_products(name_en, category))')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const routineProducts: string[] = []
    for (const r of routines || []) {
      const products = (r as Record<string, unknown>).ss_routine_products as Record<string, unknown>[] | null
      for (const rp of products || []) {
        const product = rp.ss_products as Record<string, string> | null
        if (product?.name_en) routineProducts.push(product.name_en)
      }
    }

    const skinProfile = profile as unknown as SkinProfile
    const adjustments = getRoutineAdjustments(phaseInfo, skinProfile, routineProducts)

    return NextResponse.json({
      enabled: true,
      phase: phaseInfo,
      adjustments,
      history: (entries || []).slice(0, 6),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/cycle — Log a new cycle start date
// ---------------------------------------------------------------------------

const createCycleSchema = z.object({
  cycle_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  cycle_length_days: z.number().int().min(20).max(45).optional(),
  notes: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { cycle_start_date, cycle_length_days, notes } = createCycleSchema.parse(body)

    const db = getServiceClient()

    // Ensure cycle tracking is enabled
    await db
      .from('ss_user_profiles')
      .update({ cycle_tracking_enabled: true })
      .eq('user_id', user.id)

    // Update avg_cycle_length if provided
    if (cycle_length_days) {
      await db
        .from('ss_user_profiles')
        .update({ avg_cycle_length: cycle_length_days })
        .eq('user_id', user.id)
    }

    // Insert cycle entry
    const { data, error } = await db
      .from('ss_user_cycle_tracking')
      .insert({
        user_id: user.id,
        cycle_start_date,
        cycle_length_days: cycle_length_days ?? 28,
        notes: notes ?? null,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ entry: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// ---------------------------------------------------------------------------
// PUT /api/cycle — Toggle cycle tracking on/off or update avg cycle length
// ---------------------------------------------------------------------------

const updateCycleSettingsSchema = z.object({
  cycle_tracking_enabled: z.boolean().optional(),
  avg_cycle_length: z.number().int().min(20).max(45).optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const updates = updateCycleSettingsSchema.parse(body)

    const db = getServiceClient()

    const updateData: Record<string, unknown> = {}
    if (updates.cycle_tracking_enabled !== undefined) {
      updateData.cycle_tracking_enabled = updates.cycle_tracking_enabled
    }
    if (updates.avg_cycle_length !== undefined) {
      updateData.avg_cycle_length = updates.avg_cycle_length
    }

    const { error } = await db
      .from('ss_user_profiles')
      .update(updateData)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/cycle — Delete a specific cycle entry
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('id')

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entry id' }, { status: 400 })
    }

    const db = getServiceClient()
    const { error } = await db
      .from('ss_user_cycle_tracking')
      .delete()
      .eq('id', entryId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
