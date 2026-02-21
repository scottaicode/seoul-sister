import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { updateConversationTitle, deleteConversation } from '@/lib/yuri/memory'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { supabase } from '@/lib/supabase'

const renameSchema = z.object({
  title: z.string().min(1).max(200),
})

/**
 * PUT /api/yuri/conversations/[id] - Rename a conversation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) throw new AppError('Unauthorized', 401)

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new AppError('Unauthorized', 401)

    const { id: conversationId } = await params
    const body = await request.json()
    const { title } = renameSchema.parse(body)

    // updateConversationTitle doesn't verify ownership, so we verify here
    // by attempting delete's ownership check pattern
    const { getServiceClient } = await import('@/lib/supabase')
    const db = getServiceClient()
    const { data: conv } = await db
      .from('ss_yuri_conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single()

    if (!conv || conv.user_id !== user.id) {
      throw new AppError('Conversation not found', 404)
    }

    await updateConversationTitle(conversationId, title)

    return NextResponse.json({ success: true, title })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/yuri/conversations/[id] - Delete a conversation and its messages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) throw new AppError('Unauthorized', 401)

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new AppError('Unauthorized', 401)

    const { id: conversationId } = await params

    await deleteConversation(conversationId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
