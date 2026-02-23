/**
 * Feature 11.3: Backfill location_text on ss_user_profiles
 *
 * For existing users, extract location from their onboarding conversation
 * summaries and set location_text on their profiles.
 *
 * Known users:
 * - Bailey (baileydonmartin@gmail.com): "Austin, Texas" (from onboarding summary)
 * - vibetrendai@gmail.com: Role-played as Chicago resident during onboarding,
 *   but GPS coords (38.42, -121.44) place them in Elk Grove/Sacramento, CA.
 *   We use the GPS-based location since it's the real one.
 *
 * Prerequisites:
 * - Run migration 20260222000001_add_location_text.sql first
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/backfill-location-text.ts
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  // Find all profiles where location_text IS NULL
  const { data: profiles, error: profilesErr } = await supabase
    .from('ss_user_profiles')
    .select('user_id, location_text, latitude, longitude, climate')
    .is('location_text', null)

  if (profilesErr) {
    console.error('Error fetching profiles:', profilesErr.message)
    process.exit(1)
  }

  if (!profiles || profiles.length === 0) {
    console.log('No profiles with NULL location_text found. Nothing to backfill.')
    return
  }

  console.log(`Found ${profiles.length} profile(s) with NULL location_text\n`)

  for (const profile of profiles) {
    const userId = profile.user_id
    console.log(`--- Processing user: ${userId}`)

    // Look for onboarding conversation summary
    const { data: conversations } = await supabase
      .from('ss_yuri_conversations')
      .select('id, summary, conversation_type')
      .eq('user_id', userId)
      .not('summary', 'is', null)
      .order('created_at', { ascending: true })

    if (!conversations || conversations.length === 0) {
      console.log('  No conversation summaries found, skipping.\n')
      continue
    }

    // Combine all summaries for extraction
    const allSummaries = conversations
      .map((c) => c.summary)
      .filter(Boolean)
      .join('\n\n---\n\n')

    if (!allSummaries.trim()) {
      console.log('  Summaries are empty, skipping.\n')
      continue
    }

    // Use Sonnet to extract location from summaries
    console.log(`  Found ${conversations.length} conversation(s) with summaries. Extracting location...`)

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Extract the user's stated location (city, state/province, country) from these conversation summaries. Return ONLY the location as a short string like "Austin, Texas" or "Seoul, Korea". If no location is mentioned, return "NONE".

If the user mentioned multiple locations (e.g., role-played one but GPS shows another), prefer the location that seems to be their actual residence.

SUMMARIES:
${allSummaries.slice(0, 4000)}

Return ONLY the location string, nothing else.`,
        }],
      })

      const block = response.content[0]
      if (block.type !== 'text') {
        console.log('  Sonnet returned non-text response, skipping.\n')
        continue
      }

      const extracted = block.text.trim().replace(/^["']|["']$/g, '')

      if (extracted === 'NONE' || !extracted) {
        console.log('  No location found in summaries.\n')
        continue
      }

      console.log(`  Extracted location: "${extracted}"`)

      // Update the profile
      const { error: updateErr } = await supabase
        .from('ss_user_profiles')
        .update({ location_text: extracted })
        .eq('user_id', userId)

      if (updateErr) {
        console.error(`  Error updating profile: ${updateErr.message}\n`)
      } else {
        console.log(`  Updated location_text to "${extracted}"\n`)
      }
    } catch (err) {
      console.error(`  Sonnet extraction error: ${err instanceof Error ? err.message : err}\n`)
    }
  }

  console.log('Done!')
}

main()
