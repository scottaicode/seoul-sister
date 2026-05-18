/**
 * Phase 13.D backfill: seed Bailey's treatment phases from her existing
 * conversation history.
 *
 * Bailey is Seoul Sister's lighthouse user. Her Phase 1 → Phase 2
 * transition is well-documented in her conversation summaries (Feb 23
 * Phase 1 established, May 5 Phase 2 starts). This script populates
 * ss_treatment_phases for her account so she sees real data on first
 * /skin-profile visit after v10.6.0 ships.
 *
 * Future users get phases auto-extracted from day one via
 * src/lib/yuri/treatment-phase-extractor.ts. This backfill is one-shot
 * for Bailey only.
 *
 * Also tags her two Feb 25 Glass Skin photos with Phase 1's id so the
 * Phase Photo Gallery counts/groups them correctly (even though the
 * photos themselves can't be displayed — they predate photo storage).
 *
 * Idempotent: re-running upserts, doesn't duplicate.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-bailey-phases.ts
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
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
} catch {
  // No .env.local; rely on inherited env
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BAILEY_USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835'

// Phase 1 was established in conv 375a1a1e-27ae-44f9-b3fb-7abc67d4d567 on
// Feb 23 2026. Phase 2 started in conv b59606b5-1b5a-42df-a092-bfe8d2c182de
// on May 5 2026. Confirmed against conversation summaries on May 18 2026.
const PHASE_1_CONV_ID = '375a1a1e-27ae-44f9-b3fb-7abc67d4d567'
const PHASE_2_CONV_ID = 'b59606b5-1b5a-42df-a092-bfe8d2c182de'

const PHASE_1 = {
  user_id: BAILEY_USER_ID,
  phase_number: 1,
  name: 'Barrier Repair',
  goal: 'Restore moisture barrier after Zero Pore Pads damage. Calm visible redness, rebuild lipid layer, prepare skin to tolerate actives later. No tretinoin, no AHA/BHA, no aggressive exfoliation during this phase.',
  status: 'completed' as const,
  started_at: '2026-02-23T00:00:00Z',
  completed_at: '2026-05-04T23:59:59Z',
  protocol: {
    am_routine: [
      'Gentle cleanse (cool water rinse or low-pH cleanser)',
      'Hydrating toner (essence layering)',
      'Centella or ceramide moisturizer',
      'SPF — physical or hybrid sunscreen',
    ],
    pm_routine: [
      'Low-pH cleanser (skip oil cleanse on irritated days)',
      'Hydrating toner',
      'Ceramide/centella moisturizer (Illiyoon was the workhorse)',
      'Red light LED 3-4x weekly (post-routine, on bare clean skin)',
    ],
    actives_to_avoid: ['AHA', 'BHA', 'retinoids', 'high-strength vitamin C', 'aggressive exfoliants'],
    duration_target_weeks: 7,
    notes: 'Climate context: humid Austin meant we leaned humectant-heavy and kept occlusives moderate.',
  },
  decisions: [
    {
      decision: 'Pause Zero Pore Pads indefinitely — they triggered the barrier compromise',
      date: '2026-02-23',
    },
    {
      decision: 'No actives for ~6-7 weeks; barrier first, brightening later',
      date: '2026-02-23',
    },
    {
      decision: 'Red light LED 3-4x weekly for barrier support (not blue light during Phase 1)',
      date: '2026-02-25',
    },
  ],
  watch_for: [
    'Persistent redness on cheeks (signal barrier still compromised)',
    'Flaking or tightness after cleansing (cleanser too harsh)',
    'Stinging on application (active reaction, even from gentle products)',
  ],
  outcomes: {
    what_worked: [
      'Illiyoon ceramide cream as primary moisturizer — barrier rebuilt without occlusive heaviness',
      'Cool water rinse on irritated days reduced cleanser-driven inflammation',
      'Red light LED supported tissue repair without overstimulating',
    ],
    carried_forward: [
      'Illiyoon stays in Phase 2 as the night moisturizer',
      'Red light schedule continues on non-BHA nights',
      'Centella/hydration backbone remains; we layered actives ON TOP of the repaired barrier rather than replacing it',
    ],
    notes: 'Phase 1 completed cleanly — no setbacks, barrier visibly calmer by end of week 6. Bailey was ready for Phase 2 by May 5.',
  },
  created_from_conversation_id: PHASE_1_CONV_ID,
  last_yuri_update_at: '2026-05-04T23:59:59Z',
}

const PHASE_2 = {
  user_id: BAILEY_USER_ID,
  phase_number: 2,
  name: 'Active Treatment',
  goal: 'Address hormonal chin congestion (closed comedones on jaw and chin) with targeted BHA on a MWF cadence. Introduce vitamin C in AM for early hyperpigmentation prevention. Maintain barrier health from Phase 1.',
  status: 'active' as const,
  started_at: '2026-05-05T00:00:00Z',
  completed_at: null,
  protocol: {
    am_routine: [
      'Gentle cleanse',
      'Hydrating toner',
      'Goodal Green Tangerine Vita C Dark Spot Serum (every morning)',
      'Ceramide/centella moisturizer',
      'SPF',
    ],
    pm_routine_mwf: [
      'Shower / oil cleanse if wearing SPF or makeup',
      'Low-pH water cleanse',
      'COSRX BHA Blackhead Power Liquid (chin and jawline only, not full face)',
      'Wait 10 minutes',
      'Illiyoon ceramide moisturizer',
      'Blue light LED (for congestion treatment)',
    ],
    pm_routine_tue_thu_sat_sun: [
      'Shower / oil cleanse',
      'Low-pH water cleanse',
      'Hydrating toner',
      'Illiyoon ceramide moisturizer',
      'Red light LED (barrier support, recovery from BHA nights)',
    ],
    bha_cadence: 'MWF (Mon/Wed/Fri only — never daily)',
    duration_target_weeks: 8,
    notes: 'Climate context: humid Austin means BHA + sebum congestion is the right target; humectants stay important.',
  },
  decisions: [
    {
      decision: 'COSRX BHA Blackhead Power Liquid on MWF for chin closed comedones — betaine salicylate over salicylic acid for sensitivity',
      date: '2026-05-03',
    },
    {
      decision: 'Spot application only (chin + jaw), not full face — protect cheek barrier from active spread',
      date: '2026-05-03',
    },
    {
      decision: 'Goodal Vita C in AM for early PIH prevention given Fitzpatrick 3',
      date: '2026-05-03',
    },
    {
      decision: 'Phase 2 estimated duration: 6-8 weeks; reassess for Phase 3 (brightening) once chin clears and no new comedones for 14 days',
      date: '2026-05-05',
    },
  ],
  watch_for: [
    'PIH/PIE marks on chin from picking or BHA over-application (Fitzpatrick 3 is the PIH danger zone)',
    'Barrier compromise on cheeks from BHA spread — keep BHA on chin/jaw only',
    'New comedones appearing despite BHA (may indicate sebum-side trigger we haven\'t identified)',
    'Stinging from Vita C past the first 7 days (signal to step back to every-other-day)',
  ],
  outcomes: {},
  created_from_conversation_id: PHASE_2_CONV_ID,
  last_yuri_update_at: '2026-05-17T00:00:00Z',
}

type PhaseSeed = {
  user_id: string
  phase_number: number
  name: string
  goal: string
  status: 'planned' | 'active' | 'completed' | 'paused'
  started_at: string
  completed_at: string | null
  protocol: Record<string, unknown>
  decisions: unknown[]
  watch_for: unknown[]
  outcomes: Record<string, unknown>
  created_from_conversation_id: string
  last_yuri_update_at: string
}

async function upsertPhase(phase: PhaseSeed) {
  const { data: existing, error: selectErr } = await supabase
    .from('ss_treatment_phases')
    .select('id')
    .eq('user_id', phase.user_id)
    .eq('phase_number', phase.phase_number)
    .maybeSingle()

  if (selectErr) {
    console.error(`[phase ${phase.phase_number}] select failed:`, selectErr.message)
    return null
  }

  if (existing) {
    const { data, error } = await supabase
      .from('ss_treatment_phases')
      .update({
        name: phase.name,
        goal: phase.goal,
        status: phase.status,
        started_at: phase.started_at,
        completed_at: phase.completed_at,
        protocol: phase.protocol,
        decisions: phase.decisions,
        watch_for: phase.watch_for,
        outcomes: phase.outcomes,
        created_from_conversation_id: phase.created_from_conversation_id,
        last_yuri_update_at: phase.last_yuri_update_at,
      })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) {
      console.error(`[phase ${phase.phase_number}] update failed:`, error.message)
      return null
    }
    console.log(`[phase ${phase.phase_number}] updated existing row ${data.id}`)
    return data.id as string
  }

  const { data, error } = await supabase
    .from('ss_treatment_phases')
    .insert(phase)
    .select('id')
    .single()
  if (error) {
    console.error(`[phase ${phase.phase_number}] insert failed:`, error.message)
    return null
  }
  console.log(`[phase ${phase.phase_number}] inserted new row ${data.id}`)
  return data.id as string
}

async function tagFeb25PhotosWithPhase1(phase1Id: string) {
  // Bailey's two Feb 25 Glass Skin scores were taken during Phase 1.
  const { data: photos, error: selectErr } = await supabase
    .from('ss_glass_skin_scores')
    .select('id, created_at, treatment_phase_id')
    .eq('user_id', BAILEY_USER_ID)
    .gte('created_at', '2026-02-23T00:00:00Z')
    .lt('created_at', '2026-05-05T00:00:00Z')

  if (selectErr) {
    console.error('[photo tagging] select failed:', selectErr.message)
    return
  }

  if (!photos || photos.length === 0) {
    console.log('[photo tagging] no Phase 1 era photos found')
    return
  }

  for (const photo of photos) {
    if (photo.treatment_phase_id === phase1Id) {
      console.log(`[photo tagging] ${photo.id} already tagged to Phase 1`)
      continue
    }
    const { error } = await supabase
      .from('ss_glass_skin_scores')
      .update({ treatment_phase_id: phase1Id })
      .eq('id', photo.id)
    if (error) {
      console.error(`[photo tagging] ${photo.id} update failed:`, error.message)
    } else {
      console.log(`[photo tagging] ${photo.id} (${photo.created_at}) → Phase 1`)
    }
  }
}

async function run() {
  console.log('Phase 13.D backfill — Bailey treatment phases')
  console.log('=' .repeat(50))

  const phase1Id = await upsertPhase(PHASE_1)
  const phase2Id = await upsertPhase(PHASE_2)

  if (!phase1Id || !phase2Id) {
    console.error('Backfill failed — one or both phases did not persist.')
    process.exit(1)
  }

  await tagFeb25PhotosWithPhase1(phase1Id)

  console.log('=' .repeat(50))
  console.log('Backfill complete.')
  console.log(`  Phase 1 (Barrier Repair, completed): ${phase1Id}`)
  console.log(`  Phase 2 (Active Treatment, active):  ${phase2Id}`)
}

run().catch((err) => {
  console.error('Backfill crashed:', err)
  process.exit(1)
})
