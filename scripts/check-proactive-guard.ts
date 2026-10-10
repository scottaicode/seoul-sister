/**
 * Run the REAL content guard (verifier model + deterministic enforcement) on
 * named drafts against a real user's evidence. Read-only: loads messages,
 * decisions, plan and shelf; writes nothing; sends nothing.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/check-proactive-guard.ts <userId> "<subject>" "<message>"
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { loadUserContext } from '../src/lib/yuri/memory'
import { loadGuardEvidence } from '../src/lib/proactive/subscriber-checkin'
import { checkProactiveDraft } from '../src/lib/proactive/content-guard'

async function main() {
  const [userId, subject, message] = process.argv.slice(2)
  if (!userId || !message) throw new Error('usage: check-proactive-guard.ts <userId> "<subject>" "<message>"')
  const ctx = await loadUserContext(userId)
  const evidence = await loadGuardEvidence(getServiceClient(), userId, ctx.decisionMemory)
  const result = await checkProactiveDraft({ message, subject: subject || null, evidence, userId })
  console.log(JSON.stringify({ pass: result.pass, reasons: result.reasons, verifier: result.verifier }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
