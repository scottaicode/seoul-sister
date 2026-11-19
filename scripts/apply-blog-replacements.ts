/**
 * Applies a reviewed replacements file to one published post's body.
 * Dry run by default. Stops unless the published body matches the file's
 * "before" fingerprint, every `old` occurs exactly once, and the result
 * matches the "after" fingerprint. Writes a snapshot of the old body first,
 * and the update only lands if the body is still the one that was read.
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
  const slug = file.replacements[0].slug
  if (file.replacements.some((r) => r.slug !== slug)) throw new Error('more than one post in this file')
  const fp = file.fingerprints[slug].content
  const db = getServiceClient()
  const { data, error } = await db.from('ss_content_posts').select('id, body, updated_at').eq('slug', slug).single()
  if (error) throw new Error(error.message)
  const before = data.body as string
  if (md5(before) !== fp.md5_before) throw new Error(`the published body is not the one this file was made for (md5 ${md5(before)})`)
  let body = before
  for (const [i, r] of file.replacements.entries()) {
    const n = body.split(r.old).length - 1
    if (n !== 1) throw new Error(`pair ${i + 1}: the old text occurs ${n} times`)
    body = body.replace(r.old, () => r.new)
  }
  if (md5(body) !== fp.md5_after) throw new Error(`the result does not match the file's after fingerprint (md5 ${md5(body)})`)
  console.log(`${slug}: ${file.replacements.length} pairs, ${before.length} -> ${body.length} characters`)
  if (!apply) return console.log('Dry run. Nothing changed.')
  const snapshot = `scripts/backup-blog-before-replacements-${slug}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(snapshot, JSON.stringify({ id: data.id, slug, updated_at: data.updated_at, body: before }, null, 1))
  const { data: done, error: wErr } = await db.from('ss_content_posts').update({ body, updated_at: new Date().toISOString() }).eq('id', data.id).eq('body', before).select('id')
  if (wErr) throw new Error(wErr.message)
  if (done?.length !== 1) throw new Error('nothing was updated: the post changed while this ran')
  const { data: check } = await db.from('ss_content_posts').select('body').eq('id', data.id).single()
  console.log(md5(check?.body as string) === fp.md5_after ? `applied and read back. Snapshot: ${snapshot}` : 'WRITTEN BUT THE READ-BACK DOES NOT MATCH')
}
main().catch((e) => { console.error(e.message); process.exit(1) })
