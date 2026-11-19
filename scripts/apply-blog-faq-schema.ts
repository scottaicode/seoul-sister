/**
 * Replaces a published post's faq_schema with the `faq_schema_after` entry in
 * a reviewed replacements file. Dry run by default. Run it AFTER
 * apply-blog-replacements.ts: it stops unless the post's body already matches
 * the file's "after" fingerprint, so the structured answers can never get
 * ahead of (or stay behind) the visible ones.
 *
 *   npx tsx scripts/apply-blog-faq-schema.ts <file.json> [--apply]
 */
import './load-env'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getServiceClient } from '../src/lib/supabase'

const md5 = (s: string) => createHash('md5').update(s).digest('hex')
/** jsonb returns keys in its own order, so compare the pairs, not the serialised objects. */
const same = (x: unknown, y: Array<{ question: string; answer: string }>) => {
  const flat = (v: unknown) => JSON.stringify(((v as Array<{ question: string; answer: string }> | null) ?? []).map((q) => [q.question, q.answer]))
  return flat(x) === flat(y)
}

async function main() {
  const path = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!path) throw new Error('usage: <file.json> [--apply]')
  const file = JSON.parse(readFileSync(path, 'utf8')) as {
    fingerprints: Record<string, { content: { md5_after: string } }>
    faq_schema_after?: Record<string, Array<{ question: string; answer: string }>>
  }
  const db = getServiceClient()
  let failed = 0
  for (const [slug, faq] of Object.entries(file.faq_schema_after ?? {})) {
    const { data, error } = await db.from('ss_content_posts').select('id, body, faq_schema, updated_at').eq('slug', slug).single()
    if (error) throw new Error(`${slug}: ${error.message}`)
    if (md5(data.body as string) !== file.fingerprints[slug]?.content.md5_after) throw new Error(`${slug}: the body is not the corrected one; apply the body replacements first`)
    if (same(data.faq_schema, faq)) { console.log(`already applied  ${slug}`); continue }
    console.log(`${(data.faq_schema as unknown[] | null)?.length ?? 0} -> ${faq.length} questions  ${slug}`)
    if (!apply) continue
    const { data: done, error: wErr } = await db.from('ss_content_posts').update({ faq_schema: faq, updated_at: new Date().toISOString() }).eq('id', data.id).eq('updated_at', data.updated_at).select('faq_schema')
    const ok = !wErr && done?.length === 1 && same(done[0].faq_schema, faq)
    if (!ok) failed++
    console.log(`${ok ? 'applied and read back' : `FAILED (${wErr?.message ?? 'not updated or read-back differs'})`}  ${slug}`)
  }
  if (!apply) console.log('Dry run. Nothing changed.')
  if (failed) process.exit(1)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
