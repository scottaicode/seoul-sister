/**
 * Backfill conversation summaries for existing Yuri conversations.
 *
 * This generates AI summaries for all conversations, enabling cross-session
 * memory for Yuri. Prioritizes Yuri's recommendations and advice.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-conversation-summaries.ts
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-conversation-summaries.ts --force
 *
 * --force: Regenerate ALL summaries (not just missing ones)
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

  const forceRegenerate = process.argv.includes('--force')

  // Find conversations to summarize
  let query = supabase
    .from('ss_yuri_conversations')
    .select('id, title, specialist_type, user_id')
    .order('updated_at', { ascending: false })

  if (!forceRegenerate) {
    query = query.is('summary', null)
  }

  const { data: conversations, error } = await query

  if (error) {
    console.error('Error fetching conversations:', error)
    return
  }

  console.log(`Found ${conversations?.length || 0} conversations to ${forceRegenerate ? 'regenerate' : 'summarize'}`)

  for (const conv of conversations || []) {
    // Load messages for this conversation (generous limit for long conversations)
    const { data: messages } = await supabase
      .from('ss_yuri_messages')
      .select('role, content')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(60)

    if (!messages || messages.length === 0) {
      console.log(`  Skipping ${conv.id} (${conv.title || 'untitled'}) — no messages`)
      continue
    }

    console.log(`  Summarizing ${conv.id} (${conv.title || 'untitled'}) — ${messages.length} messages`)

    // Build transcript with generous content per message
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content.slice(0, 600)}`)
      .join('\n')

    try {
      const response = await anthropic.messages.create({
        model: SONNET_MODEL,
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `Summarize this K-beauty advisor conversation for Yuri's cross-session memory. This summary will be injected into Yuri's system prompt in FUTURE conversations so she remembers what happened here.

Structure the summary in TWO sections (both required):

**SECTION 1 — YURI'S RECOMMENDATIONS & ADVICE (write this section FIRST, it's the highest priority):**
- Every specific product Yuri recommended (exact product names, brands)
- WHY each product was recommended (what skin concern it addresses)
- Any phased plans or timelines Yuri suggested (e.g., "Phase 2 — add vitamin C after barrier repair")
- Routine changes Yuri advised (products to add, remove, swap, reorder)
- Specific advice given (e.g., "stop using cotton pad with toner in AM", "layer SPF under BB cream")
- Warnings Yuri gave (e.g., "Zero Pore Pads causing over-exfoliation")

**SECTION 2 — USER PROFILE & CONTEXT:**
- Skin type, concerns, goals discussed
- Current routine products (AM/PM)
- Personal details (age, location, budget, lifestyle)
- Products they like/dislike and why
- Allergies or bad reactions
- Questions left unanswered or follow-ups promised

Write in second person ("User has...", "Yuri recommended..."). Be specific — exact product names matter more than general topics. Max 500 words.

CONVERSATION:
${transcript}

Return ONLY the summary text, no JSON or code formatting.`,
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
