/**
 * The replay stores tool results truncated to 1,500 chars, which the judge then
 * reads as "the full tool output" — penalizing any claim drawn from a row past
 * the cut. This re-runs each recorded tool call (read-only widget tools) to
 * restore the full output. Caveat: results reflect the catalog NOW, not at
 * replay time (same day; prices refresh nightly).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/ab-model-rehydrate-tools.ts <in.json> <out.json>
 */
import './load-env'
import { readFileSync, writeFileSync } from 'fs'
import { executeYuriTool } from '../src/lib/yuri/tools'

type Row = { results: Array<{ tools: Array<{ name: string; input: Record<string, unknown>; result: string }> }> }

async function main() {
  const rows = JSON.parse(readFileSync(process.argv[2], 'utf-8')) as Row[]
  let n = 0
  for (const row of rows) for (const r of row.results) for (const t of r.tools) {
    t.result = await executeYuriTool(t.name, t.input, '')
    n++
  }
  writeFileSync(process.argv[3], JSON.stringify(rows))
  console.log(`rehydrated ${n} tool calls`)
}
main().catch((e) => { console.error(e); process.exit(1) })
