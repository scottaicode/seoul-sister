/**
 * Read-only. Replays every distinct stored search_products input (top 5 results) and every stored
 * product_name through the resolver (get_product_details), from ss_widget_messages and
 * ss_yuri_messages. Run it before and after any change to smartProductSearch or
 * resolveProductByName and diff the two files (about four minutes each):
 *   npx tsx scripts/replay-search-and-resolver.ts out.json
 */
import './load-env'
import { writeFileSync } from 'node:fs'
import { executeYuriTool } from '../src/lib/yuri/tools'
import { getServiceClient } from '../src/lib/supabase'
async function main() {
  const out = process.argv[2]
  const db = getServiceClient()
  const inputs = new Map<string, Record<string, unknown>>()
  const names = new Set<string>()
  for (const table of ['ss_widget_messages', 'ss_yuri_messages']) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select('tool_calls').not('tool_calls', 'is', null).order('id').range(from, from + 999)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        const calls = Array.isArray(row.tool_calls) ? row.tool_calls : []
        for (const c of calls as Array<{ name?: string; input?: Record<string, unknown> }>) {
          if (c?.name === 'search_products' && c.input && typeof c.input.query === 'string') inputs.set(JSON.stringify(c.input), c.input)
          if (c?.input && typeof c.input.product_name === 'string') names.add(c.input.product_name)
        }
      }
      if (!data || data.length < 1000) break
    }
  }
  const search: Record<string, string[]> = {}
  for (const [key, input] of inputs) {
    try {
      const j = JSON.parse(await executeYuriTool('search_products', input, ''))
      search[key] = (j.products ?? []).slice(0, 5).map((p: { brand: string; name: string }) => `${p.brand} | ${p.name}`)
    } catch (e) { search[key] = [`ERROR ${e instanceof Error ? e.message : e}`] }
  }
  const resolve: Record<string, string> = {}
  for (const n of names) {
    try {
      const j = JSON.parse(await executeYuriTool('get_product_details', { product_name: n }, ''))
      const r = j.resolved_product
      resolve[n] = r ? `${r.matched_product} [${r.match_quality}]` : (j.error ? `ERR ${String(j.error).slice(0, 60)}` : `NO-RESOLUTION ${JSON.stringify(j).slice(0, 80)}`)
    } catch (e) { resolve[n] = `ERROR ${e instanceof Error ? e.message : e}` }
  }
  writeFileSync(out, JSON.stringify({ search, resolve }, null, 1))
  console.log('search inputs:', inputs.size, 'resolver names:', names.size)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
