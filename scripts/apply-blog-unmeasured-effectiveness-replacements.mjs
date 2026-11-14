/**
 * Remove statements that Seoul Sister measured ingredient effectiveness from
 * published blog bodies (Nov 14 2026; CHANGELOG v11.61.5 to v11.61.8).
 *
 * Two files of exact before-and-after pairs, both in the LGAAS repo:
 *   ss-unmeasured-effectiveness-replacements.json   16 pairs, 2 posts, written here
 *   ss-unmeasured-effectiveness-lgaas-extra.json    10 pairs, 10 posts, found by LGAAS
 * LGAAS applied them to its own stored copies and re-sent nothing, so this
 * applies the SAME pairs to ss_content_posts and both copies read the same.
 *
 * Dry run by default; `--apply` writes. Each `old` must occur exactly once in
 * its post or NOTHING is written for any post. A backup of every body is saved
 * first, each write is guarded on the `updated_at` that was read, and where a
 * file gives an expected md5 the result must match it.
 *
 *   node --env-file=.env.local scripts/apply-blog-unmeasured-effectiveness-replacements.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const APPLY = process.argv.includes('--apply')
const LGAAS = new URL('../../lgaas/', import.meta.url)
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const main = JSON.parse(readFileSync(new URL('ss-unmeasured-effectiveness-replacements.json', LGAAS), 'utf8'))
const extra = JSON.parse(readFileSync(new URL('ss-unmeasured-effectiveness-lgaas-extra.json', LGAAS), 'utf8'))
const pairs = [...main.replacements, ...extra.published_replacements]
const bySlug = new Map()
for (const p of pairs) {
  if (typeof p.slug !== 'string' || typeof p.old !== 'string' || typeof p.new !== 'string' || !p.old || p.old === p.new) throw new Error('malformed pair: ' + JSON.stringify(p).slice(0, 160))
  bySlug.set(p.slug, [...(bySlug.get(p.slug) ?? []), p])
}

const { data: posts, error } = await db.from('ss_content_posts').select('id, slug, body, updated_at').in('slug', [...bySlug.keys()])
if (error) throw new Error(error.message)
const missing = [...bySlug.keys()].filter((s) => !posts.some((p) => p.slug === s))
if (missing.length) throw new Error('posts not found here: ' + missing.join(', '))

const plan = []
const problems = []
for (const post of posts) {
  let body = post.body
  const expect = main.fingerprints?.[post.slug]
  if (expect && md5(body) !== expect.md5_before) {
    if (md5(body) === expect.md5_after) { console.log(`already applied: ${post.slug}`); continue }
    problems.push(`${post.slug}: body md5 ${md5(body)} is neither the expected before nor after`)
    continue
  }
  let applied = 0
  for (const pair of bySlug.get(post.slug)) {
    const n = body.split(pair.old).length - 1
    if (n === 0 && body.includes(pair.new)) continue // already applied
    if (n !== 1) { problems.push(`${post.slug}: "${pair.old.slice(0, 60)}..." occurs ${n} times, expected 1`); continue }
    body = body.replace(pair.old, pair.new)
    applied++
  }
  if (expect && applied && md5(body) !== expect.md5_after) problems.push(`${post.slug}: result md5 ${md5(body)} does not match the agreed ${expect.md5_after}`)
  if (applied) plan.push({ post, body, applied })
}

for (const p of plan) console.log(`${APPLY ? 'apply' : 'would apply'} ${p.applied} pair(s): ${p.post.slug} | md5 ${md5(p.post.body)} -> ${md5(p.body)}`)
if (problems.length) {
  console.error('\nNOTHING WRITTEN. Problems:'); for (const x of problems) console.error('  - ' + x)
  process.exit(1)
}
console.log(`${plan.length} post(s), ${plan.reduce((n, p) => n + p.applied, 0)} pair(s)`)
if (!APPLY) { console.log('dry run; pass --apply to write'); process.exit(0) }

const backup = `scripts/backup-blog-bodies-before-unmeasured-effectiveness-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(backup, JSON.stringify(plan.map((p) => ({ id: p.post.id, slug: p.post.slug, updated_at: p.post.updated_at, body: p.post.body })), null, 1))
console.log('backup:', backup)
let written = 0
for (const p of plan) {
  const { data, error: e } = await db.from('ss_content_posts').update({ body: p.body }).eq('id', p.post.id).eq('updated_at', p.post.updated_at).select('id')
  if (e) throw new Error(`write failed on ${p.post.slug} after ${written}: ${e.message}`)
  if (!data?.length) throw new Error(`${p.post.slug} changed since it was read; not written. ${written} written before it.`)
  written++
}
const { data: after, error: e2 } = await db.from('ss_content_posts').select('slug, body').in('slug', plan.map((p) => p.post.slug))
if (e2) throw new Error(e2.message)
const wrong = after.filter((a) => a.body !== plan.find((p) => p.post.slug === a.slug).body).map((a) => a.slug)
console.log(`written: ${written} | read back and equal to the intended text: ${after.length - wrong.length} of ${after.length}${wrong.length ? ' | MISMATCH: ' + wrong.join(', ') : ''}`)
if (wrong.length) process.exit(1)
