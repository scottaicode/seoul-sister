import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase, getServiceClient } from '@/lib/supabase'
import { saveMessage, loadConversationMessages } from '@/lib/yuri/memory'
import {
  getOrCreateOnboardingProgress,
  streamOnboardingResponse,
  extractSkinProfileData,
  mergeSkinProfileData,
  calculateOnboardingProgress,
  checkOnboardingComplete,
  updateOnboardingProgress,
  finalizeOnboardingProfile,
  skipOnboarding,
} from '@/lib/yuri/onboarding'
import type { ExtractedSkinProfile } from '@/types/database'

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const sendMessageSchema = z.object({
  action: z.literal('send_message'),
  message: z.string().min(1).max(10000),
})

const startSchema = z.object({
  action: z.literal('start_onboarding'),
})

const getProgressSchema = z.object({
  action: z.literal('get_progress'),
})

const skipSchema = z.object({
  action: z.literal('skip_onboarding'),
})

const completeSchema = z.object({
  action: z.literal('complete_onboarding'),
})

const requestSchema = z.discriminatedUnion('action', [
  sendMessageSchema,
  startSchema,
  getProgressSchema,
  skipSchema,
  completeSchema,
])

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function authenticateRequest(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

// ---------------------------------------------------------------------------
// POST /api/yuri/onboarding
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const parsed = requestSchema.parse(body)

    // ─── Start Onboarding ─────────────────────────────────────────────
    if (parsed.action === 'start_onboarding') {
      const progress = await getOrCreateOnboardingProgress(user.id)

      // If already completed, just return the status
      if (progress.onboarding_status === 'completed') {
        return Response.json({
          status: 'completed',
          progress,
        })
      }

      // Load any existing messages for this conversation
      let messages: Array<{ id: string; role: string; content: string; created_at: string }> = []
      if (progress.conversation_id) {
        const loaded = await loadConversationMessages(progress.conversation_id)
        messages = loaded.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        }))
      }

      // If no messages yet, generate Yuri's opening message
      if (messages.length === 0 && progress.conversation_id) {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            try {
              let fullResponse = ''
              const generator = streamOnboardingResponse(
                user.id,
                progress.conversation_id!,
                '__ONBOARDING_START__',
                [],
                progress
              )

              // First emit progress metadata
              const meta = JSON.stringify({
                type: 'meta',
                conversation_id: progress.conversation_id,
                progress: progress.completion_percentage,
                status: progress.onboarding_status,
              })
              controller.enqueue(encoder.encode(`data: ${meta}\n\n`))

              for await (const chunk of generator) {
                fullResponse += chunk
                const data = JSON.stringify({ type: 'text', content: chunk })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }

              // Save Yuri's opening message
              await saveMessage(progress.conversation_id!, 'assistant', fullResponse, null)

              const done = JSON.stringify({
                type: 'done',
                conversation_id: progress.conversation_id,
                progress: progress.completion_percentage,
              })
              controller.enqueue(encoder.encode(`data: ${done}\n\n`))
              controller.close()
            } catch (err) {
              console.error(`[yuri/onboarding] Start stream error for user ${user.id}:`, err)
              const errMsg = err instanceof Error ? err.message : 'Stream error'
              const errorData = JSON.stringify({ type: 'error', message: errMsg })
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
              controller.close()
            }
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      }

      // Return existing conversation state
      return Response.json({
        status: progress.onboarding_status,
        conversation_id: progress.conversation_id,
        progress: progress.completion_percentage,
        messages,
        extracted: progress.skin_profile_data,
        extracted_fields: progress.extracted_fields,
      })
    }

    // ─── Send Message ─────────────────────────────────────────────────
    if (parsed.action === 'send_message') {
      const progress = await getOrCreateOnboardingProgress(user.id)

      if (!progress.conversation_id) {
        return Response.json({ error: 'No onboarding conversation found' }, { status: 400 })
      }

      // Load conversation history
      const history = await loadConversationMessages(progress.conversation_id)

      // Save user message
      await saveMessage(progress.conversation_id, 'user', parsed.message, null)

      // Stream Yuri's response
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullResponse = ''

            const generator = streamOnboardingResponse(
              user.id,
              progress.conversation_id!,
              parsed.message,
              history,
              progress
            )

            for await (const chunk of generator) {
              fullResponse += chunk
              const data = JSON.stringify({ type: 'text', content: chunk })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }

            // Save assistant response
            await saveMessage(progress.conversation_id!, 'assistant', fullResponse, null)

            // Extract skin profile data (awaited so progress event reaches client)
            const allMessages = [
              ...history.map((m) => ({ role: m.role, content: m.content })),
              { role: 'user' as const, content: parsed.message },
              { role: 'assistant' as const, content: fullResponse },
            ]

            try {
              const result = await extractAndUpdate(
                user.id,
                allMessages,
                progress.skin_profile_data as ExtractedSkinProfile
              )
              if (result) {
                const progressEvent = JSON.stringify({
                  type: 'progress',
                  percentage: result.percentage,
                  is_complete: result.isComplete,
                  extracted_fields: result.capturedFields,
                })
                controller.enqueue(encoder.encode(`data: ${progressEvent}\n\n`))
              }
            } catch {
              // Extraction failure is non-critical — continue to done event
            }

            // Send done event
            const done = JSON.stringify({
              type: 'done',
              conversation_id: progress.conversation_id,
            })
            controller.enqueue(encoder.encode(`data: ${done}\n\n`))
            controller.close()
          } catch (err) {
            console.error(`[yuri/onboarding] Message stream error for user ${user.id}:`, err)
            const errMsg = err instanceof Error ? err.message : 'Stream error'
            const errorData = JSON.stringify({ type: 'error', message: errMsg })
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // ─── Get Progress ─────────────────────────────────────────────────
    if (parsed.action === 'get_progress') {
      const progress = await getOrCreateOnboardingProgress(user.id)
      return Response.json({
        status: progress.onboarding_status,
        conversation_id: progress.conversation_id,
        progress: progress.completion_percentage,
        extracted: progress.skin_profile_data,
        extracted_fields: progress.extracted_fields,
        is_complete: checkOnboardingComplete(progress.skin_profile_data as ExtractedSkinProfile),
      })
    }

    // ─── Skip Onboarding ──────────────────────────────────────────────
    if (parsed.action === 'skip_onboarding') {
      await skipOnboarding(user.id)
      return Response.json({ success: true, status: 'skipped' })
    }

    // ─── Complete Onboarding ──────────────────────────────────────────
    if (parsed.action === 'complete_onboarding') {
      const progress = await getOrCreateOnboardingProgress(user.id)
      const extracted = progress.skin_profile_data as ExtractedSkinProfile

      if (!checkOnboardingComplete(extracted)) {
        return Response.json(
          { error: 'Onboarding not yet complete. Required fields still missing.' },
          { status: 400 }
        )
      }

      await finalizeOnboardingProfile(user.id, extracted)
      return Response.json({ success: true, status: 'completed' })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      console.error('[yuri/onboarding] Request error:', error)
    }
    const message =
      error instanceof z.ZodError
        ? 'Invalid request'
        : error instanceof Error
          ? error.message
          : 'Internal server error'
    const status = error instanceof z.ZodError ? 400 : 500
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ---------------------------------------------------------------------------
// Background extraction helper (fire-and-forget from stream)
// ---------------------------------------------------------------------------

async function extractAndUpdate(
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  existingProfile: ExtractedSkinProfile
): Promise<{ percentage: number; isComplete: boolean; capturedFields: Record<string, boolean> } | null> {
  try {
    const newExtracted = await extractSkinProfileData(messages)
    const merged = mergeSkinProfileData(existingProfile, newExtracted)
    const { percentage, capturedFields, missingRequired } = calculateOnboardingProgress(merged)
    const isComplete = missingRequired.length === 0

    await updateOnboardingProgress(userId, merged, capturedFields, percentage, isComplete)

    return { percentage, isComplete, capturedFields }
  } catch (err) {
    console.error(`[yuri/onboarding] Extraction error for user ${userId}:`, err)
    return null
  }
}
