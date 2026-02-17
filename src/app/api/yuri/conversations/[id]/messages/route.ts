import { NextRequest, NextResponse } from 'next/server'
import { loadConversationMessages } from '@/lib/yuri/memory'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { supabase, getServiceClient } from '@/lib/supabase'

/**
 * GET /api/yuri/conversations/[id]/messages - Load conversation messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) throw new AppError('Unauthorized', 401)

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new AppError('Unauthorized', 401)

    const { id: conversationId } = await params

    // Verify the conversation belongs to this user
    const db = getServiceClient()
    const { data: conversation } = await db
      .from('ss_yuri_conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single()

    if (!conversation || conversation.user_id !== user.id) {
      throw new AppError('Conversation not found', 404)
    }

    const limit = Number(request.nextUrl.searchParams.get('limit') || '50')
    const messages = await loadConversationMessages(conversationId, limit)

    return NextResponse.json({ messages })
  } catch (error) {
    return handleApiError(error)
  }
}
