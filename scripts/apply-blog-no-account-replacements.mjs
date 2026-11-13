/**
 * Remove "no account needed" / "chat on this page" from published blog bodies
 * (Nov 13 2026, landing chat gate; see LANDING-CHAT-GATE.md).
 *
 * The replacements were written and second-model reviewed in the LGAAS repo
 * (LGAAS-WORK-ORDER-SEOUL-SISTER-PUBLISHED-POSTS-NO-ACCOUNT.md) and applied to
 * LGAAS's own stored copies there. This applies the SAME pairs to
 * ss_content_posts so both copies read the same.
 *
 * Dry run by default. `--apply` writes. Every write is guarded on the row
 * still holding the `updated_at` that was read, a backup of every body is
 * written first, and re-running after a successful apply changes nothing
 * (each `old` string is then absent, which is reported, not treated as success).
 *
 *   node --env-file=.env.local scripts/apply-blog-no-account-replacements.mjs <replacements.json> [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) {
  console.error('usage: apply-blog-no-account-replacements.mjs <replacements.json> [--apply]')
  process.exit(1)
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
  process.exit(1)
}
const db = createClient(url, key)
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')

// The claims this sweep exists to remove. Counted before and after.
const NO_ACCOUNT = /(no|without an?|needs no|with no|zero) (account|sign-?up|login|log-in)|(account|sign-?up) (needed|required)/gi
const ON_PAGE_CHAT = /right here on (this|the) page|opens a free chat|free chat/gi
const count = (s, re) => (s.match(re) ?? []).length

const { replacements } = JSON.parse(readFileSync(file, 'utf8'))
if (!Array.isArray(replacements) || replacements.length === 0) {
  console.error('no replacements in file')
  process.exit(1)
}
const bySlug = new Map()
for (const r of replacements) {
  if (typeof r.slug !== 'string' || typeof r.old !== 'string' || typeof r.new !== 'string' || !r.old) {
    console.error('malformed pair:', JSON.stringify(r).slice(0, 200))
    process.exit(1)
  }
  if (!bySlug.has(r.slug)) bySlug.set(r.slug, [])
  bySlug.get(r.slug).push(r)
}

const { data: posts, error, count: total } = await db
  .from('ss_content_posts')
  .select('id, slug, body, updated_at', { count: 'exact' })
  .not('published_at', 'is', null)
  .order('slug')
  .range(0, 999)
if (error) {
  console.error('read failed:', error.message)
  process.exit(1)
}
if (posts.length !== total) {
  console.error(`partial read: ${posts.length} of ${total}`)
  process.exit(1)
}
const postBySlug = new Map(posts.map((p) => [p.slug, p]))

const plan = []
const problems = []
for (const [slug, pairs] of bySlug) {
  const post = postBySlug.get(slug)
  if (!post) {
    problems.push(`${slug}: no published post with this slug`)
    continue
  }
  let body = post.body ?? ''
  let applied = 0
  for (const pair of pairs) {
    const occurrences = body.split(pair.old).length - 1
    if (occurrences !== 1) {
      problems.push(`${slug}: old text found ${occurrences} times (expected 1): ${JSON.stringify(pair.old.slice(0, 90))}`)
      continue
    }
    body = body.replace(pair.old, () => pair.new)
    applied++
  }
  if (applied > 0 && body !== post.body) plan.push({ post, body, applied, pairs: pairs.length })
}

const before = { noAccount: 0, onPage: 0 }
const after = { noAccount: 0, onPage: 0 }
const planned = new Map(plan.map((p) => [p.post.slug, p.body]))
for (const p of posts) {
  const now = p.body ?? ''
  const then = planned.get(p.slug) ?? now
  before.noAccount += count(now, NO_ACCOUNT)
  before.onPage += count(now, ON_PAGE_CHAT)
  after.noAccount += count(then, NO_ACCOUNT)
  after.onPage += count(then, ON_PAGE_CHAT)
}

console.log(`published posts read: ${posts.length}`)
console.log(`pairs in file: ${replacements.length} across ${bySlug.size} posts`)
console.log(`posts to change: ${plan.length}, pairs that apply: ${plan.reduce((a, p) => a + p.applied, 0)}`)
console.log(`"no account" claims: ${before.noAccount} -> ${after.noAccount}`)
console.log(`"chat on this page" phrases: ${before.onPage} -> ${after.onPage}`)
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`)
  for (const p of problems) console.log(' - ' + p)
}

if (!APPLY) {
  console.log('\nDry run. Nothing written. Re-run with --apply to write.')
  process.exit(problems.length ? 2 : 0)
}
if (problems.length) {
  console.error('\nNot applying while there are problems.')
  process.exit(2)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = new URL(`./backup-blog-bodies-before-no-account-sweep-${stamp}.json`, import.meta.url).pathname
writeFileSync(
  backupPath,
  JSON.stringify({ taken_at: new Date().toISOString(), posts: plan.map((p) => ({ id: p.post.id, slug: p.post.slug, updated_at: p.post.updated_at, md5: md5(p.post.body), body: p.post.body })) }, null, 2)
)
console.log(`\nbackup written: ${backupPath}`)

let written = 0
const failed = []
for (const p of plan) {
  // Guarded: only the row we read. If someone changed it since, skip it loudly.
  const { data, error: wErr } = await db
    .from('ss_content_posts')
    .update({ body: p.body })
    .eq('id', p.post.id)
    .eq('updated_at', p.post.updated_at)
    .select('id')
  if (wErr) failed.push(`${p.post.slug}: ${wErr.message}`)
  else if (!data || data.length !== 1) failed.push(`${p.post.slug}: row changed since it was read, not written`)
  else written++
}
console.log(`written: ${written} of ${plan.length}`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(' - ' + f)
}

// Verify from the database, not from what we meant to write.
const { data: check, error: cErr } = await db
  .from('ss_content_posts')
  .select('slug, body')
  .not('published_at', 'is', null)
  .range(0, 999)
if (cErr) {
  console.error('verification read failed:', cErr.message)
  process.exit(1)
}
let leftNoAccount = 0
let leftOnPage = 0
let mismatched = 0
for (const row of check) {
  leftNoAccount += count(row.body ?? '', NO_ACCOUNT)
  leftOnPage += count(row.body ?? '', ON_PAGE_CHAT)
  const want = planned.get(row.slug)
  if (want !== undefined && md5(row.body ?? '') !== md5(want)) mismatched++
}
console.log(`verified from the database: "no account" claims left ${leftNoAccount}, "chat on this page" phrases left ${leftOnPage}, rows not matching the intended body ${mismatched}`)
process.exit(failed.length || mismatched ? 1 : 0)
