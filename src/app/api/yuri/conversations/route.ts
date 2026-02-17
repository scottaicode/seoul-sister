import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createConversation, loadUserConversations } from '@/lib/yuri/memory'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { supabase } from '@/lib/supabase'

const createSchema = z.object({
  specialist_type: z
    .enum([
      'ingredient_analyst',
      'routine_architect',
      'authenticity_investigator',
      'trend_scout',
      'budget_optimizer',
      'sensitivity_guardian',
    ])
    .nullable()
    .optional(),
})

/**
 * GET /api/yuri/conversations - List user's conversations
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) throw new AppError('Unauthorized', 401)

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new AppError('Unauthorized', 401)

    const limit = Number(request.nextUrl.searchParams.get('limit') || '20')
    const conversations = await loadUserConversations(user.id, limit)

    return NextResponse.json({ conversations })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/yuri/conversations - Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) throw new AppError('Unauthorized', 401)

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new AppError('Unauthorized', 401)

    const body = await request.json()
    const { specialist_type } = createSchema.parse(body)

    const conversationId = await createConversation(user.id, specialist_type ?? null)

    return NextResponse.json({ conversation_id: conversationId }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
