/**
 * Backfill conversation summaries for existing Yuri conversations.
 *
 * This generates AI summaries for all conversations that don't have one yet,
 * enabling cross-session memory for Yuri.
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/backfill-conversation-summaries.ts
 *
 * Requires: summary column on ss_yuri_conversations (run migration first)
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local manually (no dotenv dependency)
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  console.error('Failed to read .env.local')
  process.exit(1)
}

const SONNET_MODEL = 'claude-sonnet-4-5-20250929'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  // Find conversations without summaries that have messages
  const { data: conversations, error } = await supabase
    .from('ss_yuri_conversations')
    .select('id, title, specialist_type, user_id')
    .is('summary', null)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    return
  }

  console.log(`Found ${conversations?.length || 0} conversations without summaries`)

  for (const conv of conversations || []) {
    // Load messages for this conversation
    const { data: messages } = await supabase
      .from('ss_yuri_messages')
      .select('role, content')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(30)

    if (!messages || messages.length === 0) {
      console.log(`  Skipping ${conv.id} (${conv.title || 'untitled'}) — no messages`)
      continue
    }

    console.log(`  Summarizing ${conv.id} (${conv.title || 'untitled'}) — ${messages.length} messages`)

    // Build transcript
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content.slice(0, 300)}`)
      .join('\n')

    try {
      const response = await anthropic.messages.create({
        model: SONNET_MODEL,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Summarize this K-beauty advisor conversation for future reference. Extract the KEY DETAILS that Yuri should remember in future conversations with this user. Focus on:

1. Specific products mentioned (exact names) and whether the user likes/dislikes them
2. The user's current routine (AM/PM products, steps, frequency)
3. Specific skin concerns or goals discussed
4. Recommendations Yuri made (so she doesn't repeat herself)
5. Personal details the user shared (location, lifestyle, budget, preferences)
6. Any allergies or bad reactions mentioned
7. Questions left unanswered or follow-ups promised

Write the summary in second person ("User uses...", "User mentioned..."). Be concise but specific — product names and details matter more than general topics. Max 300 words.

CONVERSATION:
${transcript}

Return ONLY the summary text, no headers or formatting.`,
          },
        ],
      })

      const block = response.content[0]
      if (block.type !== 'text') {
        console.log(`    Unexpected response type: ${block.type}`)
        continue
      }

      const summary = block.text.trim()

      // Save summary
      const { error: updateError } = await supabase
        .from('ss_yuri_conversations')
        .update({
          summary,
          summary_generated_at: new Date().toISOString(),
        })
        .eq('id', conv.id)

      if (updateError) {
        console.log(`    Error saving summary: ${updateError.message}`)
      } else {
        console.log(`    ✓ Summary saved (${summary.length} chars)`)
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      console.error(`    Error generating summary for ${conv.id}:`, err)
    }
  }

  console.log('\nDone!')
}

main()
