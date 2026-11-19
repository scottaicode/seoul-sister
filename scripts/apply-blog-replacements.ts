/**
 * Applies a reviewed replacements file to published posts' bodies.
 * Dry run by default. For each post in the file it stops unless the published
 * body matches the file's "before" fingerprint, every `old` occurs exactly
 * once at the point it is applied, and the result matches the "after"
 * fingerprint. EVERY post is checked before ANY post is written. A snapshot of
 * the old bodies is written first, and each update only lands if the post has
 * not been touched since it was read (its updated_at is unchanged; comparing
 * the whole body in the request was refused as too long for one post). A post
 * that already holds the result is reported and left alone, so a run that
 * stopped part-way can be run again.
 *
 *   npx tsx scripts/apply-blog-replacements.ts <file.json> [--apply]
 */
import './load-env'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getServiceClient } from '../src/lib/supabase'

const md5 = (s: string) => createHash('md5').update(s).digest('hex')

async function main() {
  const path = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!path) throw new Error('usage: <file.json> [--apply]')
  const file = JSON.parse(readFileSync(path, 'utf8')) as { replacements: Array<{ slug: string; old: string; new: string }>; fingerprints: Record<string, { content: { md5_before: string; md5_after: string } }> }
  const slugs = [...new Set(file.replacements.map((r) => r.slug))]
  const db = getServiceClient()
  const plan: Array<{ id: string; slug: string; before: string; after: string; updated_at: string; pairs: number }> = []
  for (const slug of slugs) {
    const fp = file.fingerprints[slug]?.content
    if (!fp) throw new Error(`${slug}: no fingerprint in the file`)
    const { data, error } = await db.from('ss_content_posts').select('id, body, updated_at').eq('slug', slug).single()
    if (error) throw new Error(`${slug}: ${error.message}`)
    const before = data.body as string
    if (md5(before) === fp.md5_after) { console.log(`already applied  ${slug}`); continue }
    if (md5(before) !== fp.md5_before) throw new Error(`${slug}: the published body is not the one this file was made for (md5 ${md5(before)})`)
    let body = before
    const mine = file.replacements.filter((r) => r.slug === slug)
    for (const [i, r] of mine.entries()) {
      const n = body.split(r.old).length - 1
      if (n !== 1) throw new Error(`${slug}, pair ${i + 1}: the old text occurs ${n} times`)
      body = body.replace(r.old, () => r.new)
    }
    if (md5(body) !== fp.md5_after) throw new Error(`${slug}: the result does not match the file's after fingerprint (md5 ${md5(body)})`)
    plan.push({ id: data.id as string, slug, before, after: body, updated_at: data.updated_at as string, pairs: mine.length })
    console.log(`${String(mine.length).padStart(2)} pairs, ${before.length} -> ${body.length} characters  ${slug}`)
  }
  console.log(`${plan.length} posts, ${plan.reduce((n, p) => n + p.pairs, 0)} pairs: all checks passed`)
  if (!apply) return console.log('Dry run. Nothing changed.')
  const snapshot = `scripts/backup-blog-before-replacements-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(snapshot, JSON.stringify(plan.map((p) => ({ id: p.id, slug: p.slug, updated_at: p.updated_at, body: p.before })), null, 1))
  console.log(`snapshot: ${snapshot}`)
  let failed = 0
  for (const p of plan) {
    const { data: done, error: wErr } = await db.from('ss_content_posts').update({ body: p.after, updated_at: new Date().toISOString() }).eq('id', p.id).eq('updated_at', p.updated_at).select('id')
    const { data: check } = await db.from('ss_content_posts').select('body').eq('id', p.id).single()
    const ok = !wErr && done?.length === 1 && md5((check?.body as string) ?? '') === md5(p.after)
    if (!ok) failed++
    console.log(`${ok ? 'applied and read back' : `FAILED (${wErr?.message ?? 'not updated or read-back differs'})`}  ${p.slug}`)
  }
  if (failed) { console.error(`${failed} post(s) were not updated. The snapshot holds every original body.`); process.exit(1) }
}
main().catch((e) => { console.error(e.message); process.exit(1) })
