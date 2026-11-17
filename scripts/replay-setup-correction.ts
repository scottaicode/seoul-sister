/**
 * Replays the setup-chat extractor on a real transcript, cut at the turn where
 * the member corrected a medical fact they had denied earlier. Read-only.
 *
 * Why this exists (Nov 16 2026): a member said "no skin cancer, nothing
 * prescribed", then two messages later "I have had skin cancer many times...
 * four prescriptions". The pass that ran after the correction left the profile
 * saying "no skin cancer" with no medical history; the pass after the NEXT
 * message got it right. This prints what the extractor returns at the
 * correction turn, several times, so the miss can be counted.
 *
 *   npx tsx scripts/replay-setup-correction.ts <conversationId> <messagesToKeep> [runs=5]
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { extractSkinProfileData } from '../src/lib/yuri/onboarding'

async function main() {
  const [conversationId, keepRaw, runsRaw] = process.argv.slice(2)
  if (!conversationId || !keepRaw) throw new Error('usage: <conversationId> <messagesToKeep> [runs]')
  const keep = Number(keepRaw)
  const runs = Number(runsRaw || 5)
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_yuri_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at')
    .range(0, 199)
  if (error) throw new Error(error.message)
  const messages = (data ?? []).slice(0, keep).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }))
  console.log(`transcript: ${messages.length} messages; last user message: ${[...messages].reverse().find((m) => m.role === 'user')?.content.slice(0, 90)}`)

  const errors: string[] = []
  const realError = console.error
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')) }
  let good = 0
  for (let i = 0; i < runs; i++) {
    errors.length = 0
    const out = await extractSkinProfileData(messages)
    const med = out.medical_history ?? []
    const sun = out.sun_history ?? ''
    const ok = med.some((m) => /cancer/i.test(m)) && !/no skin cancer/i.test(sun)
    if (ok) good++
    console.log(`\nrun ${i + 1}: ${ok ? 'CORRECTED' : 'MISSED'}  keys=${Object.keys(out).length}`)
    console.log('  medical_history:', JSON.stringify(med))
    console.log('  sun_history:', sun)
    if (errors.length) console.log('  LOGGED ERROR:', errors.join(' | ').slice(0, 600))
  }
  console.error = realError
  console.log(`\n${good}/${runs} runs recorded the correction`)
}

main().catch((e) => { console.error(e); process.exit(1) })
