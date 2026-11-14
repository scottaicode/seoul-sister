/**
 * Remove first-person claims of use, testing, skin or "I've seen" from 13
 * published blog posts (Nov 14 2026). Every post is bylined "Seoul Sister
 * Team"; no person wrote or checked them, so "primers I've tried" and "running
 * uncontrolled experiments on my own face" are claims nobody can stand behind.
 *
 * The 43 pairs were written and second-model reviewed in the LGAAS repo
 * (ss-first-person-claims-replacements.json) and applied to LGAAS's stored
 * copies there, with nothing re-sent. This applies the SAME pairs to
 * ss_content_posts so both copies read the same.
 *
 * Fields: title, excerpt, content (stored here as `body`), faq_schema[N].answer.
 * Dry run by default; `--apply` writes. Each `old` must occur exactly once in
 * its field and every touched field must match the file's md5 before and
 * after, or NOTHING is written. Backup first; each write is guarded on the
 * `updated_at` that was read; everything is read back.
 *
 *   node --env-file=.env.local scripts/apply-blog-first-person-claims-replacements.mjs [pairs-file.json] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const APPLY = process.argv.includes('--apply')
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Optional first argument: another pairs file in the LGAAS folder with the same format
// (the Nov 14 follow-up is ss-first-person-claims-followup-replacements.json).
const named = process.argv.slice(2).find((a) => a.endsWith('.json')) ?? 'ss-first-person-claims-replacements.json'
if (!/^[a-z0-9-]+\.json$/.test(named)) throw new Error('pairs file must be a plain file name in the lgaas folder')
const file = JSON.parse(readFileSync(new URL('../../lgaas/' + named, import.meta.url), 'utf8'))

const slugs = [...new Set(file.replacements.map((r) => r.slug))]
const { data: posts, error } = await db.from('ss_content_posts').select('id, slug, title, excerpt, body, faq_schema, updated_at').in('slug', slugs)
if (error) throw new Error(error.message)
const missing = slugs.filter((s) => !posts.some((p) => p.slug === s))
if (missing.length) throw new Error('posts not found here: ' + missing.join(', '))

// Read and write one named field of a post held in memory.
const FAQ = /^faq_schema\[(\d+)\]\.answer$/
const get = (post, field) => {
  const m = field.match(FAQ)
  if (m) return post.faq_schema?.[Number(m[1])]?.answer
  return post[field === 'content' ? 'body' : field]
}
const set = (post, field, value) => {
  const m = field.match(FAQ)
  if (m) post.faq_schema[Number(m[1])].answer = value
  else post[field === 'content' ? 'body' : field] = value
}

const problems = []
const plan = []
for (const original of posts) {
  const post = structuredClone(original)
  const mine = file.replacements.filter((r) => r.slug === post.slug)
  const fields = [...new Set(mine.map((r) => r.field))]
  for (const field of fields) {
    const before = get(post, field)
    if (typeof before !== 'string') { problems.push(`${post.slug}: field ${field} is not text here`); continue }
    const fp = file.fingerprints?.[post.slug]?.[field]
    if (fp && md5(before) !== fp.md5_before && md5(before) !== fp.md5_after) problems.push(`${post.slug} ${field}: md5 ${md5(before)} is neither the file's before nor after`)
  }
  let applied = 0
  for (const pair of mine) {
    const text = get(post, pair.field)
    if (typeof text !== 'string') continue
    const n = text.split(pair.old).length - 1
    if (n === 0 && text.includes(pair.new)) continue // already applied
    if (n !== 1) { problems.push(`${post.slug} ${pair.field}: "${pair.old.slice(0, 50)}..." occurs ${n} times, expected 1`); continue }
    set(post, pair.field, text.replace(pair.old, pair.new))
    applied++
  }
  for (const field of fields) {
    const fp = file.fingerprints?.[post.slug]?.[field]
    const after = get(post, field)
    if (fp && typeof after === 'string' && md5(after) !== fp.md5_after) problems.push(`${post.slug} ${field}: result md5 ${md5(after)} does not match the agreed ${fp.md5_after}`)
  }
  if (applied) plan.push({ original, post, applied, fields })
}

for (const p of plan) console.log(`${APPLY ? 'apply' : 'would apply'} ${p.applied} pair(s) in [${p.fields.join(', ')}]: ${p.post.slug}`)
if (problems.length) { console.error('\nNOTHING WRITTEN. Problems:'); for (const x of problems) console.error('  - ' + x); process.exit(1) }
console.log(`${plan.length} post(s), ${plan.reduce((n, p) => n + p.applied, 0)} pair(s); every touched field matches the agreed md5`)
if (!APPLY) { console.log('dry run; pass --apply to write'); process.exit(0) }

const backup = `scripts/backup-blog-before-first-person-claims-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(backup, JSON.stringify(plan.map((p) => p.original), null, 1))
console.log('backup:', backup)
let written = 0
for (const p of plan) {
  const { data, error: e } = await db.from('ss_content_posts')
    .update({ title: p.post.title, excerpt: p.post.excerpt, body: p.post.body, faq_schema: p.post.faq_schema })
    .eq('id', p.original.id).eq('updated_at', p.original.updated_at).select('id')
  if (e) throw new Error(`write failed on ${p.post.slug} after ${written}: ${e.message}`)
  if (!data?.length) throw new Error(`${p.post.slug} changed since it was read; not written. ${written} written before it.`)
  written++
}
const { data: after, error: e2 } = await db.from('ss_content_posts').select('slug, title, excerpt, body, faq_schema').in('slug', plan.map((p) => p.post.slug))
if (e2) throw new Error(e2.message)
const same = (a, p) => a.title === p.title && a.excerpt === p.excerpt && a.body === p.body && JSON.stringify(a.faq_schema) === JSON.stringify(p.faq_schema)
const wrong = after.filter((a) => !same(a, plan.find((p) => p.post.slug === a.slug).post)).map((a) => a.slug)
console.log(`written: ${written} | read back and equal to the intended text: ${after.length - wrong.length} of ${after.length}${wrong.length ? ' | MISMATCH: ' + wrong.join(', ') : ''}`)
if (wrong.length) process.exit(1)
