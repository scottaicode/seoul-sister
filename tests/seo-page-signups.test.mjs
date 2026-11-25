/**
 * SEO Guardian sign-ups by landing page (Nov 24 2026, src/lib/seo/page-chats.ts).
 *
 * Since the landing chat closed (Nov 13 2026) the chat section reads near zero
 * whatever pages do; accounts, free weeks, cards and paid are the lead step.
 * Executes the real aggregation and formatting. Invariants:
 *  - per page: accounts, free weeks, cards, paid, presses;
 *  - accounts with no landing page are counted, not dropped;
 *  - a FAILED fetch renders as UNAVAILABLE, never as zero sign-ups;
 *  - the section reaches the prompt and the stored facts.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/seo/page-chats.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { aggregatePageSignups, formatPageSignups } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const OIL = '/blog/best-korean-cleansing-oils-for-every-skin-type-2026'
const PROFILES = [
  { user_id: 'u1', landing_path: OIL },
  { user_id: 'u2', landing_path: OIL },
  { user_id: 'u3', landing_path: '/blog/lip-balm' },
  { user_id: 'u4', landing_path: null },
]
const TRIALS = [
  { user_id: 'u1', card_added_at: '2026-11-20T00:00:00Z', paid_at: '2026-11-24T00:00:00Z' },
  { user_id: 'u2', card_added_at: null, paid_at: null },
  { user_id: 'u4', card_added_at: null, paid_at: null },
]
const PRESSES = [{ page_path: '/blog/lip-balm' }, { page_path: '/blog/lip-balm' }, { page_path: '/blog/expiry' }]

test('aggregates accounts, free weeks, cards, paid and presses per page', () => {
  const f = aggregatePageSignups(PROFILES, TRIALS, PRESSES)
  assert.equal(f.totalAccounts, 4)
  assert.equal(f.unattributedAccounts, 1)
  assert.equal(f.totalPresses, 3)
  assert.deepEqual(f.pages[0], { path: OIL, accounts: 2, freeWeeks: 2, cards: 1, paid: 1, presses: 0 })
  assert.deepEqual(f.pages[1], { path: '/blog/lip-balm', accounts: 1, freeWeeks: 0, cards: 0, paid: 0, presses: 2 })
  assert.deepEqual(f.pages[2], { path: '/blog/expiry', accounts: 0, freeWeeks: 0, cards: 0, paid: 0, presses: 1 })
})

test('the prompt section lists each page with its outcome columns', () => {
  const out = formatPageSignups({ ok: true, ...aggregatePageSignups(PROFILES, TRIALS, PRESSES) }, '2026-10-23', '2026-11-19')
  assert.ok(out.includes(`${OIL} | 2 | 2 | 1 | 1 | 0`))
  assert.match(out, /4 new accounts in the window, 1 with no page recorded; 3 presses/)
})

test('a failed fetch says UNAVAILABLE and never reads as zero sign-ups', () => {
  const out = formatPageSignups({ ok: false, error: 'boom', totalAccounts: 0, unattributedAccounts: 0, totalPresses: 0, pages: [] }, 'a', 'b')
  assert.match(out, /UNAVAILABLE/)
  assert.doesNotMatch(out, /0 new accounts/)
})

test('the Guardian prompt and stored facts carry the sign-up section', () => {
  const g = fs.readFileSync(path.join(process.cwd(), 'src/lib/seo/seo-guardian.ts'), 'utf8')
  assert.match(g, /\$\{input\.pageSignups\}/)
  assert.match(g, /pageSignups: formatPageSignups\(pageSignupFacts, windowStart, windowEnd\)/)
  assert.match(g, /pageSignups: pageSignupFacts[,\s}]/)
})
