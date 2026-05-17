import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import { AppError } from '@/lib/utils/error-handler'
import { calculateRoutineEffectiveness } from '@/lib/intelligence/routine-effectiveness'
import { fetchSeasonalLearning } from '@/lib/intelligence/weather-routine'

/**
 * GET /api/routine/effectiveness?routine_id=<uuid>
 *
 * Returns effectiveness scores by concern and seasonal suggestions for a
 * given routine, personalised to the authenticated user.
 *
 * v10.5.2 (Bailey feedback): dropped `missingIngredients` from the response.
 * The algorithmic recommender surfaced filler ingredients (waxes, thickeners,
 * pH buffers) as "high-value" because the bootstrap data scored frequency
 * rather than actual active effectiveness. Recommendations now flow through
 * Yuri who has full treatment-phase context (decision memory, conversation
 * history, current routine + inventory).
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
      .select('skin_type, skin_concerns, climate')
      .eq('user_id', user.id)
      .maybeSingle()

    const skinType = profile?.skin_type ?? null
    const skinConcerns: string[] = (profile?.skin_concerns as string[]) ?? []
    const climate = profile?.climate ?? null

    const [concerns, seasonalInsight] = await Promise.all([
      calculateRoutineEffectiveness(supabase, routineId, skinType, skinConcerns),
      fetchSeasonalLearning(supabase, climate),
    ])

    return NextResponse.json({
      concerns,
      seasonalInsight,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
