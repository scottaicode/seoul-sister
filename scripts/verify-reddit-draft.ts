/**
 * Verify a Reddit draft against the catalog and the standing rules.
 *
 *   npx tsx scripts/verify-reddit-draft.ts --file draft.md
 *   npx tsx scripts/verify-reddit-draft.ts --file draft.md --json
 *   cat draft.md | npx tsx scripts/verify-reddit-draft.ts
 *
 * $0 — no AI call. Reports; never rewrites. The decision stays human: this
 * prints and stops, it does not post anything anywhere.
 *
 * Exit codes are deliberately distinct, because "the checker found a problem"
 * and "the checker never ran" must never look the same to a caller:
 *   0 — checked, no blockers
 *   1 — checked, BLOCKER present (do not post as written)
 *   2 — usage error (no input)
 *   3 — the check FAILED to run (crash, missing env, DB unreachable).
 *       NOT a pass and NOT a blocker: nothing was verified.
 */

import './load-env'
import { readFileSync } from 'node:fs'
import { verifyDraft, formatFindings } from '../src/lib/reddit/verify-draft'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const args = process.argv.slice(2)
  const fileIdx = args.indexOf('--file')
  const asJson = args.includes('--json')

  let draft: string
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    draft = readFileSync(args[fileIdx + 1], 'utf8')
  } else if (!process.stdin.isTTY) {
    draft = await readStdin()
  } else {
    console.error('usage: verify-reddit-draft.ts --file <path>   (or pipe on stdin)')
    process.exit(2)
  }

  if (!draft.trim()) {
    console.error('empty draft — nothing to check')
    process.exit(2)
  }

  const result = await verifyDraft(draft)

  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(formatFindings(result))
  }

  const hasBlocker = result.findings.some((f) => f.severity === 'blocker')
  process.exit(hasBlocker ? 1 : 0)
}

main().catch((err) => {
  // A crash must never read as a pass — and must not be confused with a
  // blocker either, or a caller would think the draft was checked and failed
  // when in fact it was never checked at all.
  console.error('[verify-reddit-draft] FAILED — the draft was NOT checked:', err)
  process.exit(3)
})
