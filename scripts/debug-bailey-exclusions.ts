/**
 * Debug what tokens the phase-exclusion filter sees for Bailey.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
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

const PHASE_EXCLUSION_MARKERS = [
  'skip', 'defer', 'phase 2', 'phase 3', 'phase 4', 'phase ii', 'phase iii',
  'pause', 'wait', 'later', 'not yet', 'until', 'revisit',
  'avoid for now', 'stop using', 'discontinue', "don't add", 'do not add',
  'no need', 'no otc', 'put on hold', 'on hold',
]

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('ss_yuri_conversations')
    .select('title, updated_at, decision_memory')
    .eq('user_id', '551569d3-aed0-4feb-a340-47bfb146a835')
    .not('decision_memory', 'eq', '{}')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (!data?.length) {
    console.log('No data')
    return
  }

  console.log(`Found ${data.length} conversations\n`)

  const excludedTokens = new Set<string>()
  const STOP = new Set([
    'skip', 'defer', 'phase', 'pause', 'wait', 'later', 'until', 'revisit',
    'stop', 'using', 'discontinue', 'add', 'need', 'needed', 'now', 'hold',
    'with', 'from', 'this', 'that', 'will', 'have', 'when', 'into', 'your',
    'their', 'them', 'they', 'been', 'were', 'just', 'over', 'after',
    'avoid', 'around', 'before', 'next', 'first', 'second', 'third',
    'still', 'would', 'should', 'could', 'might', 'about', 'because',
    'while', 'once', 'each', 'some', 'these', 'those', 'most', 'such',
    'same', 'than', 'then', 'only', 'also', 'other', 'phase_2', 'phase_3',
    'phase_4', 'aren', 'don', 'doesn', 'isn', 'won',
  ])

  for (const row of data) {
    console.log(`--- ${row.title} (${row.updated_at}) ---`)
    type DM = { decisions?: Array<{ topic?: string; decision?: string }>; preferences?: Array<{ topic?: string; preference?: string }>; corrections?: Array<{ topic?: string; yuri_said?: string; truth?: string }> }
    const dm = row.decision_memory as DM | null
    if (!dm) continue

    const candidateTexts: string[] = []
    for (const d of dm.decisions || []) {
      candidateTexts.push(`${d.topic || ''} ${d.decision || ''}`.toLowerCase())
    }
    for (const p of dm.preferences || []) {
      candidateTexts.push(`${p.topic || ''} ${p.preference || ''}`.toLowerCase())
    }
    for (const c of dm.corrections || []) {
      candidateTexts.push(`${c.topic || ''} ${c.yuri_said || ''} ${c.truth || ''}`.toLowerCase())
    }

    for (const text of candidateTexts) {
      const hasMarker = PHASE_EXCLUSION_MARKERS.some((m) => text.includes(m))
      if (!hasMarker) continue
      console.log(`  Marker hit: "${text.slice(0, 100)}..."`)
      const words = text.split(/[^a-z]+/).filter((w: string) => w.length >= 4 && !STOP.has(w))
      for (const w of words) {
        excludedTokens.add(w)
        console.log(`    + ${w}`)
      }
    }
    console.log()
  }

  console.log(`\nFinal exclusion token set (${excludedTokens.size} tokens):`)
  console.log(Array.from(excludedTokens).sort().join(', '))
}

main().catch((err) => {
  console.error('UNCAUGHT:', err)
  process.exit(1)
})
