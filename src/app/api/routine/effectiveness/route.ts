import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import { AppError } from '@/lib/utils/error-handler'
import { calculateRoutineEffectiveness } from '@/lib/intelligence/routine-effectiveness'

/**
 * GET /api/routine/effectiveness?routine_id=<uuid>
 *
 * Returns effectiveness scores by concern for a given routine, personalised to
 * the authenticated user. Pure data display — no prescriptions.
 *
 * v10.5.2 (Bailey feedback): dropped `missingIngredients` from the response.
 * The algorithmic recommender surfaced filler ingredients (waxes, thickeners,
 * pH buffers) as "high-value" because the bootstrap data scored frequency
 * rather than actual active effectiveness.
 *
 * v10.8.9 (Bailey feedback, May 26 2026): dropped `seasonalInsight` from the
 * response. The "SPRING TIP" was an algorithmic prescription ("switch to
 * lightweight gel," "emphasize niacinamide") keyed only on season + climate,
 * with zero awareness of the user's treatment phase. It directly contradicted
 * Bailey's Phase 2 protocol (she already has niacinamide in 5 products, and
 * Yuri has her on "stay the course"). Per the Yuri Sole Authority Principle,
 * recommendations flow exclusively through Yuri, who has full treatment-phase
 * context (decision memory, conversation history, current routine + inventory).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const routineId = request.nextUrl.searchParams.get('routine_id')

    if (!routineId) {
      throw new AppError('routine_id query parameter is required', 400)
    }

    const supabase = getServiceClient()

    // Verify routine belongs to this user
    const { data: routine } = await supabase
      .from('ss_user_routines')
      .select('id, user_id')
      .eq('id', routineId)
      .single()

    if (!routine || routine.user_id !== user.id) {
      throw new AppError('Routine not found', 404)
    }

    // Load user profile
    const { data: profile } = await supabase
      .from('ss_user_profiles')
      .select('skin_type, skin_concerns')
      .eq('user_id', user.id)
      .maybeSingle()

    const skinType = profile?.skin_type ?? null
    const skinConcerns: string[] = (profile?.skin_concerns as string[]) ?? []

    const concerns = await calculateRoutineEffectiveness(
      supabase,
      routineId,
      skinType,
      skinConcerns
    )

    return NextResponse.json({ concerns })
  } catch (error) {
    return handleApiError(error)
  }
}
