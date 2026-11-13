/**
 * Two lines the Nov 13 2026 blog sweep could not reach (see LANDING-CHAT-GATE.md):
 *  - an FAQ answer (faq_schema) on the PDRN post that sends readers to "the free
 *    advisor on the homepage";
 *  - the one published post LGAAS does not hold, which says the same in its body.
 * Guarded on the old text occurring exactly once and on updated_at; backs up
 * the old values first; a second run changes nothing.
 *
 *   node --env-file=.env.local scripts/fix-blog-two-leftover-lines-nov13.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const jobs = [
  {
    like: 'what-is-pdrn-skincare-really%',
    field: 'faq_schema',
    json: true,
    old: "For a specific bottle you can't decode, ask the free advisor on the homepage.",
    next: "For a specific bottle you can't decode, ask Yuri, Seoul Sister's AI advisor. She's free to start with a free account.",
  },
  {
    like: 'the-7-minute-k-beauty-routine-that-actually-sticks',
    field: 'body',
    json: false,
    old: "There's a free AI advisor on the [Seoul Sister homepage](https://www.seoulsister.com) that'll give you product recommendations",
    next: "Yuri, Seoul Sister's AI advisor, is free to start with a free account from the [Seoul Sister homepage](https://www.seoulsister.com), and she'll give you product recommendations",
  },
  {
    // Found by the LGAAS session after the first two: an FAQ answer that places
    // the advisor "on" the homepage. She is reached from it, in both modes.
    like: 'late-20s-skin-spiral-your-barrier-is-probably-wrecked',
    field: 'faq_schema',
    json: true,
    old: 'And if you want something faster, the advisor on the [Seoul Sister homepage](https://www.seoulsister.com) can help you sort through what stays and what goes.',
    next: "And if you want something faster, Yuri, Seoul Sister's AI advisor, can help you sort through what stays and what goes. You can start with her from the [Seoul Sister homepage](https://www.seoulsister.com).",
  },
]

const backup = []
let failed = 0
for (const j of jobs) {
  const { data, error } = await db
    .from('ss_content_posts')
    .select(`id, slug, updated_at, ${j.field}`)
    .like('slug', j.like)
    .not('published_at', 'is', null)
  if (error || !data || data.length !== 1) {
    console.log(`${j.like}: READ PROBLEM ${error?.message ?? `rows=${data?.length}`}`)
    failed++
    continue
  }
  const row = data[0]
  const text = j.json ? JSON.stringify(row[j.field]) : row[j.field]
  const oldT = j.json ? JSON.stringify(j.old).slice(1, -1) : j.old
  const newT = j.json ? JSON.stringify(j.next).slice(1, -1) : j.next
  const n = text.split(oldT).length - 1
  if (n !== 1) {
    console.log(`${row.slug}: old text found ${n} times, nothing to do`)
    continue
  }
  const updated = text.replace(oldT, () => newT)
  if (!APPLY) {
    console.log(`${row.slug} (${j.field}): would change 1 line`)
    continue
  }
  backup.push({ id: row.id, slug: row.slug, field: j.field, before: row[j.field] })
  const { data: w, error: wErr } = await db
    .from('ss_content_posts')
    .update({ [j.field]: j.json ? JSON.parse(updated) : updated })
    .eq('id', row.id)
    .eq('updated_at', row.updated_at)
    .select('id')
  if (wErr || !w || w.length !== 1) {
    console.log(`${row.slug}: NOT WRITTEN ${wErr?.message ?? 'row changed since read'}`)
    failed++
  } else console.log(`${row.slug} (${j.field}): written`)
}
if (APPLY && backup.length) {
  const path = new URL(`./backup-blog-leftover-lines-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, import.meta.url).pathname
  writeFileSync(path, JSON.stringify(backup, null, 2))
  console.log(`backup: ${path}`)
}
process.exit(failed ? 1 : 0)
