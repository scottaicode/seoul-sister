/**
 * One-time fix: Correct the contradictory summary in Bailey's
 * "Building Your Personalized K-Beauty Routine" conversation.
 *
 * The old summary says Yuri "clarified she had NOT recommended" vitamin C, BHA,
 * and Supergoop — but she actually DID recommend them in the onboarding conversation.
 * The summary was generated when Yuri had a memory bug. This corrects it.
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/fix-bailey-summary.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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

const CONVERSATION_ID = '375a1a1e-27ae-44f9-b3fb-7abc67d4d567'

const CORRECTED_SUMMARY = `**SECTION 1 — YURI'S RECOMMENDATIONS & ADVICE:**

Yuri identified the user's primary issue as a **damaged moisture barrier** (not true combination skin), evidenced by redness from Zero Pore Pads, retinoid peeling, and simultaneous oiliness and dryness. Yuri recommended **Option 3: Barrier Repair First** approach.

**Key routine changes advised:**
- **Stop using cotton pad with Acwell Licorice Toner in AM** — unnecessary physical friction and product waste
- **Stop/pause Zero Pore Pads** — causing barrier damage and redness
- User asked about previously recommended vitamin C (Rohto Melano CC), BHA (COSRX BHA), and Supergoop sunscreen. NOTE: Yuri HAD recommended these products during the onboarding conversation but could not recall them at this time due to a system memory limitation that has since been fixed. Yuri mistakenly told the user she had not made those recommendations.

**Phased plan mentioned:**
- **Phase 1 (weeks 1-7)**: Barrier repair — hydration layering, ceramides, drop all actives
- **Phase 2 (weeks 8-10)**: Add vitamin C for hyperpigmentation, but only after barrier repair is complete. Yuri warned that "vitamin C on a damaged barrier is wasted money"

**Products/ingredients context:** User already uses Differin/Tretinoin as spot treatments, acne patches, and does red/blue LED therapy. Yuri was building an AM routine starting with cleansing changes when conversation was interrupted.

**SECTION 2 — USER PROFILE & CONTEXT:**

User is 26, lives in Austin TX, has combination skin (oily T-zone, dry cheeks that worsen with retinoids). Main concerns are **hormonal breakouts** (irregular cycle due to birth control, hard to predict timing) and **hyperpigmentation from past breakouts**.

**Current routine products mentioned:**
- Acwell Licorice Toner (used on cotton pad in AM)
- Zero Pore Pads (causing redness/irritation)
- Differin/Tretinoin (spot treatment use)
- Acne patches
- Red/blue LED light therapy

User was receptive to the barrier-first approach and chose Option 3 from previously presented choices. Conversation was interrupted before Phase 1 product list was completed. The previous onboarding conversation had already recommended Rohto Melano CC, Supergoop Unseen SPF 40, and COSRX BHA — these should be integrated into the Phase 2+ plan when barrier repair is complete.`

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify the conversation exists
  const { data: conv } = await supabase
    .from('ss_yuri_conversations')
    .select('id, title, summary')
    .eq('id', CONVERSATION_ID)
    .single()

  if (!conv) {
    console.error('Conversation not found:', CONVERSATION_ID)
    process.exit(1)
  }

  console.log(`Found conversation: "${conv.title}"`)
  console.log(`Old summary length: ${conv.summary?.length || 0} chars`)

  // Update with corrected summary
  const { error } = await supabase
    .from('ss_yuri_conversations')
    .update({
      summary: CORRECTED_SUMMARY,
      summary_generated_at: new Date().toISOString(),
    })
    .eq('id', CONVERSATION_ID)

  if (error) {
    console.error('Error updating summary:', error.message)
    process.exit(1)
  }

  console.log(`✓ Summary corrected (${CORRECTED_SUMMARY.length} chars)`)
  console.log('Done!')
}

main()
