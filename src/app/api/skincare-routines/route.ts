import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/skincare-routines?user_id=xxx - Get user's routines
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const routineType = searchParams.get('routine_type')
    const includeSteps = searchParams.get('include_steps') === 'true'

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('skincare_routines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (routineType) {
      query = query.eq('routine_type', routineType)
    }

    const { data: routines, error } = await query

    if (error) {
      throw error
    }

    // Include steps if requested
    if (includeSteps && routines) {
      for (const routine of routines) {
        const { data: steps } = await supabase
          .from('routine_steps')
          .select('*')
          .eq('routine_id', routine.id)
          .order('step_order', { ascending: true })

        routine.steps = steps || []
      }
    }

    return NextResponse.json({
      routines,
      total: routines?.length || 0
    })

  } catch (error) {
    console.error('Error fetching routines:', error)
    return NextResponse.json(
      { error: 'Failed to fetch routines' },
      { status: 500 }
    )
  }
}

// POST /api/skincare-routines - Create new routine
export async function POST(request: NextRequest) {
  try {
    const { user_id, routine } = await request.json()

    if (!user_id || !routine) {
      return NextResponse.json(
        { error: 'User ID and routine data are required' },
        { status: 400 }
      )
    }

    // Create the routine
    const { data: savedRoutine, error: routineError } = await supabase
      .from('skincare_routines')
      .insert([{
        user_id,
        name: routine.name,
        description: routine.description,
        routine_type: routine.routine_type,
        complexity_level: routine.complexity_level,
        estimated_time_minutes: routine.estimated_time_minutes || calculateEstimatedTime(routine.steps),
        primary_goals: routine.primary_goals || [],
        generated_by_ai: routine.generated_by_ai || false,
        generation_prompt: routine.generation_prompt,
        ai_confidence: routine.ai_confidence
      }])
      .select()
      .single()

    if (routineError) {
      throw routineError
    }

    // Create routine steps
    if (routine.steps && routine.steps.length > 0) {
      const stepsToInsert = routine.steps.map((step: any, index: number) => ({
        routine_id: savedRoutine.id,
        step_order: index + 1,
        product_id: step.product_id,
        custom_product_name: step.custom_product_name,
        product_category: step.product_category,
        application_method: step.application_method,
        amount_description: step.amount_description,
        wait_time_seconds: step.wait_time_seconds || 0,
        frequency: step.frequency || 'daily',
        instructions: step.instructions,
        tips: step.tips,
        warnings: step.warnings,
        ai_generated: step.ai_generated || false,
        rationale: step.rationale
      }))

      const { error: stepsError } = await supabase
        .from('routine_steps')
        .insert(stepsToInsert)

      if (stepsError) {
        // Rollback routine creation if steps failed
        await supabase
          .from('skincare_routines')
          .delete()
          .eq('id', savedRoutine.id)

        throw stepsError
      }
    }

    return NextResponse.json({
      routine: savedRoutine,
      message: 'Routine created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating routine:', error)
    return NextResponse.json(
      { error: 'Failed to create routine' },
      { status: 500 }
    )
  }
}

// PUT /api/skincare-routines - Update routine
export async function PUT(request: NextRequest) {
  try {
    const { routine_id, user_id, routine } = await request.json()

    if (!routine_id || !user_id || !routine) {
      return NextResponse.json(
        { error: 'Routine ID, User ID, and routine data are required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const { data: existingRoutine, error: checkError } = await supabase
      .from('skincare_routines')
      .select('id')
      .eq('id', routine_id)
      .eq('user_id', user_id)
      .single()

    if (checkError || !existingRoutine) {
      return NextResponse.json(
        { error: 'Routine not found or access denied' },
        { status: 404 }
      )
    }

    // Update routine
    const { data: updatedRoutine, error: updateError } = await supabase
      .from('skincare_routines')
      .update({
        name: routine.name,
        description: routine.description,
        routine_type: routine.routine_type,
        complexity_level: routine.complexity_level,
        estimated_time_minutes: routine.estimated_time_minutes,
        primary_goals: routine.primary_goals || []
      })
      .eq('id', routine_id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Update steps - delete existing and recreate
    await supabase
      .from('routine_steps')
      .delete()
      .eq('routine_id', routine_id)

    if (routine.steps && routine.steps.length > 0) {
      const stepsToInsert = routine.steps.map((step: any, index: number) => ({
        routine_id: routine_id,
        step_order: index + 1,
        product_id: step.product_id,
        custom_product_name: step.custom_product_name,
        product_category: step.product_category,
        application_method: step.application_method,
        amount_description: step.amount_description,
        wait_time_seconds: step.wait_time_seconds || 0,
        frequency: step.frequency || 'daily',
        instructions: step.instructions,
        tips: step.tips,
        warnings: step.warnings,
        ai_generated: step.ai_generated || false,
        rationale: step.rationale
      }))

      const { error: stepsError } = await supabase
        .from('routine_steps')
        .insert(stepsToInsert)

      if (stepsError) {
        throw stepsError
      }
    }

    return NextResponse.json({
      routine: updatedRoutine,
      message: 'Routine updated successfully'
    })

  } catch (error) {
    console.error('Error updating routine:', error)
    return NextResponse.json(
      { error: 'Failed to update routine' },
      { status: 500 }
    )
  }
}

// DELETE /api/skincare-routines?routine_id=xxx&user_id=yyy
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const routineId = searchParams.get('routine_id')
    const userId = searchParams.get('user_id')

    if (!routineId || !userId) {
      return NextResponse.json(
        { error: 'Routine ID and User ID are required' },
        { status: 400 }
      )
    }

    // Verify ownership and delete
    const { error } = await supabase
      .from('skincare_routines')
      .delete()
      .eq('id', routineId)
      .eq('user_id', userId)

    if (error) {
      throw error
    }

    return NextResponse.json({
      message: 'Routine deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting routine:', error)
    return NextResponse.json(
      { error: 'Failed to delete routine' },
      { status: 500 }
    )
  }
}

// Helper function to calculate estimated time
function calculateEstimatedTime(steps: any[]): number {
  if (!steps || steps.length === 0) return 5

  const baseTime = steps.length * 2 // 2 minutes per step
  const waitTime = steps.reduce((total, step) => {
    return total + ((step.wait_time_seconds || 0) / 60)
  }, 0)

  return Math.ceil(baseTime + waitTime)
}