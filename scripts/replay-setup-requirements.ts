/**
 * Runs the setup extractor over every real setup chat and prints which of the
 * seven requirements each would still be missing, with the two safety flags.
 * Read-only. Use it to see whether the flags are set when the question was
 * asked and answered, and left unset when it was not (Nov 17 2026).
 *
 *   npx tsx scripts/replay-setup-requirements.ts [minUserMessages=3]
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { extractSkinProfileData } from '../src/lib/yuri/onboarding'
import { missingSetupRequirements } from '../src/lib/yuri/setup-requirements'

const ASKED_MEDICAL = /skin cancer|precancer|prescri|dermatologist|eczema|rosacea|psoriasis/i
const ASKED_REACTIONS = /bad reaction|react(ed|ion)? (badly|to)|broke you out|ingredients? (you|to) avoid|allerg/i

async function main() {
  const min = Number(process.argv[2] || 3)
  const db = getServiceClient()
  const { data: convs, error } = await db.from('ss_yuri_conversations').select('id, user_id').eq('conversation_type', 'onboarding').order('created_at').range(0, 999)
  if (error) throw new Error(error.message)
  for (const c of convs ?? []) {
    const { data: msgs } = await db.from('ss_yuri_messages').select('role, content, created_at').eq('conversation_id', c.id).order('created_at').range(0, 199)
    const list = ((msgs ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>).filter((m) => m.role === 'user' || m.role === 'assistant')
    const users = list.filter((m) => m.role === 'user').length
    if (users < min) continue
    // Was the question put by Yuri with a user message after it?
    const askedThenReplied = (re: RegExp) => list.some((m, i) => m.role === 'assistant' && re.test(m.content) && /\?/.test(m.content) && list.slice(i + 1).some((n) => n.role === 'user'))
    const out = await extractSkinProfileData(list.map((m) => ({ role: m.role, content: m.content })))
    console.log(`\n${(c.user_id as string).slice(0, 8)} (${users} user messages)`)
    console.log(`  still missing: ${missingSetupRequirements(out).map((r) => r.key).join(', ') || 'nothing'}`)
    console.log(`  medical flag: ${out.medical_question_answered === true}  (Yuri raised it with a reply after: ${askedThenReplied(ASKED_MEDICAL)})  history: ${JSON.stringify(out.medical_history ?? [])}`)
    console.log(`  reactions flag: ${out.reactions_question_answered === true}  (Yuri raised it with a reply after: ${askedThenReplied(ASKED_REACTIONS)})  allergies: ${JSON.stringify(out.allergies ?? [])}`)
    console.log(`  declined: ${JSON.stringify(out.declined_to_say ?? [])}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
