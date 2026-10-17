/**
 * Guard tests — Oct 17 2026 owner test of the free preview, and the
 * second-model review that showed the first version of these tests passed six
 * clearly-wrong implementations. Each test below names the wrong version it
 * exists to reject.
 *
 * 1. The limit card promised continuity nothing delivered. Onboarding now loads
 *    this browser's preview: CONFIRMED (account email = preview email) feeds
 *    Yuri and the profile; UNCONFIRMED feeds Yuri only, flagged, never the
 *    profile; another account's preview never loads.
 * 2. Yuri said "your write-up is on its way" over a recap never sent.
 * 3. A routine under "**Morning**"/"**Night**" headings was invisible to the
 *    give instrument, but tips/questions/skeletons must not count.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
async function load(paths) {
  const src = paths.map((p) => read(p).replace(/^import[^\n]*\n/gm, '')).join('\n')
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

const carry = await load(['src/lib/utils/text-slice.ts', 'src/lib/yuri/widget-carryover.ts'])
const recap = await load(['src/lib/widget/recap-fact.ts'])
const give = await load(['src/lib/widget/cumulative-give.ts'])

// ── 1. carryover ─────────────────────────────────────────────────────────
const me = { id: 'u1', email: 'Kim@Example.com' }
const V = '11111111-2222-4333-8444-555555555555'

test('ownership: confirmed, unconfirmed, and never another account (rejects: converted check only when an email exists)', () => {
  assert.equal(carry.carryoverMatch({ captured_email: 'kim@example.com ', converted_user_id: null }, me), 'email')
  assert.equal(carry.carryoverMatch({ captured_email: 'other@gmail.com', converted_user_id: null }, me), 'browser')
  assert.equal(carry.carryoverMatch({ captured_email: null, converted_user_id: null }, me), 'browser')
  assert.equal(carry.carryoverMatch({ captured_email: null, converted_user_id: 'u2' }, me), null)
  assert.equal(carry.carryoverMatch({ captured_email: 'kim@example.com', converted_user_id: 'u2' }, me), null)
  assert.equal(carry.carryoverMatch({ captured_email: 'other@gmail.com', converted_user_id: 'u2' }, me), null)
  assert.equal(carry.carryoverMatch({ captured_email: null, converted_user_id: 'u1' }, me), 'browser')
  assert.equal(carry.carryoverMatch(null, me), null)
})

const msgs = [
  { role: 'user', content: 'I use a BHA toner nightly and retinol 3x a week. Texas.' },
  { role: 'assistant', content: 'Stop both for 2-4 weeks.' },
]

test('the block carries the transcript, consent/ownership, and the provenance line (rejects: dropping the "advice is not action" line)', () => {
  for (const match of ['email', 'browser']) {
    const b = carry.carryoverBlock({ match, lastAt: '2026-10-17T04:22:00Z', messages: msgs })
    assert.match(b, /Them: I use a BHA toner nightly/)
    assert.match(b, /You: Stop both for 2-4 weeks\./)
    assert.match(b, /2026-10-17/)
    assert.match(b, /You are not meeting them for the first time/)
    assert.match(b, /None of it was copied into their profile/)
    assert.match(b, /confirm what still holds rather than asking from scratch/)
    assert.doesNotMatch(b, /profile looks empty/, 'false on every turn after the first fields are captured')
    assert.match(b, /Advice you gave there is something you said, not something they have done\./)
  }
  assert.match(carry.carryoverBlock({ match: 'email', lastAt: '2026-10-17', messages: msgs }), /the email they gave there is the one on this account/)
  assert.match(carry.carryoverBlock({ match: 'browser', lastAt: '2026-10-17', messages: msgs }), /they confirmed when they signed up that it was theirs/)
})

test('the longest preview on record (42,439 chars) keeps its FIRST message', () => {
  const m = Array.from({ length: 24 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i} ` + 'x'.repeat(1765) }))
  const b = carry.carryoverBlock({ match: 'email', lastAt: '2026-10-17', messages: m })
  assert.match(b, /Them: m0 /)
  assert.doesNotMatch(b, /omitted/)
})

test('beyond the budget the NEWEST messages survive (rejects: keeping the oldest)', () => {
  const m = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i} ` + 'x'.repeat(600) }))
  const b = carry.carryoverBlock({ match: 'email', lastAt: '2026-10-17', messages: m })
  assert.match(b, /older messages? omitted/)
  assert.match(b, /You: m99 /)
  assert.doesNotMatch(b, /Them: m0 /)
})

/** PostgREST-shaped fake recording filters, so the loader is EXECUTED. */
function fakeDb({ visitor, rows }) {
  return {
    from(table) {
      const f = { eq: [], in: [], limit: Infinity }
      const q = {
        select: () => q,
        eq(c, v) { f.eq.push([c, v]); return q },
        in(c, v) { f.in.push([c, v]); return q },
        order: () => q,
        limit(n) {
          f.limit = n
          let out = rows.filter((r) => f.eq.every(([c, v]) => r[c] === v) && f.in.every(([c, v]) => v.includes(r[c])))
          return Promise.resolve({ data: out.slice(0, n), error: null })
        },
        maybeSingle() {
          const ok = visitor && f.eq.every(([c, v]) => visitor[c] === v)
          return Promise.resolve({ data: ok ? visitor : null, error: null })
        },
      }
      return q
    },
  }
}

const rows = Array.from({ length: 24 }, (_, i) => ({
  visitor_id: V, role: i % 2 ? 'assistant' : 'user', content: `msg ${i}`, created_at: `2026-10-17T04:${String(10 + i).padStart(2, '0')}:00Z`,
})).concat([{ visitor_id: V, role: 'system', content: 'internal note', created_at: '2026-10-17T05:00:00Z' },
  { visitor_id: 'someone-else', role: 'user', content: 'not yours', created_at: '2026-10-17T05:00:00Z' }])

test('the loader enforces ownership, keeps every preview message, drops non-chat rows (rejects: ignoring ownership, no role filter, tiny limit)', async () => {
  const mine = await carry.loadWidgetCarryover(fakeDb({ visitor: { visitor_id: V, captured_email: 'kim@example.com', converted_user_id: null }, rows }), V, me)
  assert.equal(mine.match, 'email')
  assert.equal(mine.messages.length, 24)
  assert.ok(!mine.messages.some((m) => m.content === 'internal note' || m.content === 'not yours'))
  const theirs = await carry.loadWidgetCarryover(fakeDb({ visitor: { visitor_id: V, captured_email: null, converted_user_id: 'u2' }, rows }), V, me)
  assert.equal(theirs, null)
  assert.equal(await carry.loadWidgetCarryover(fakeDb({ visitor: null, rows }), V, me), null)
  assert.equal(await carry.loadWidgetCarryover(fakeDb({ visitor: { visitor_id: V }, rows }), 'not-a-uuid', me), null)
})

test('onboarding: the preview is context only, never extracted (rejects: seeding the profile, which finalized onboarding before Yuri spoke)', () => {
  const route = read('src/app/api/yuri/onboarding/route.ts')
  assert.equal((route.match(/const carryover = await loadWidgetCarryover\(getServiceClient\(\), parsed\.widget_visitor_id, user\)/g) || []).length, 2)
  assert.match(route, /'__ONBOARDING_START__',\s*\[\],\s*progress,\s*carryover\s*\)/)
  assert.match(route, /parsed\.message,\s*history,\s*progress,\s*carryover\s*\)/)
  assert.doesNotMatch(route, /extractAndUpdate\(user\.id, carryover/)
  assert.doesNotMatch(route, /carryover(?:\?)?\.messages/, 'the transcript must not reach extraction')
  assert.doesNotMatch(route, /widget_visitor_id:[^\n]*\.uuid\(\)/, 'a malformed stored id must not fail onboarding')
  const ob = read('src/lib/yuri/onboarding.ts')
  assert.match(ob, /\.\.\.\(carryover\s*\?\s*\[\{ type: 'text' as const, text: carryoverBlock\(carryover\), cache_control: \{ type: 'ephemeral' as const \} \}\]/)
  assert.match(ob, /unless a "Before they signed up" section shows you have already talked with them/)
})

test('consent is per ACCOUNT, the preview is sent only after that account said yes, and onboarding waits (rejects: one per-browser answer inherited by the next account)', () => {
  const page = read('src/app/(app)/onboarding/page.tsx')
  assert.equal((page.match(/widget_visitor_id: consentedVisitorId\(userId\)/g) || []).length, 2)
  assert.doesNotMatch(page, /getExistingVisitorId/)
  assert.match(page, /if \(carryChoice === 'pending' \|\| carryChoice === 'ask'\) return\s*if \(startedRef\.current\) return/)
  assert.match(page, /setCarryChoice\(id && hasPreviewConversation\(\) \? getCarryoverChoice\(id\) \?\? 'ask' : 'na'\)/)
  assert.match(page, /setCarryoverChoice\(userId, choice\)/)
})

// Execute the real consent helpers against a fake localStorage.
const store = new Map()
globalThis.window = {}
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
globalThis.document = { cookie: '' }
const ws = await load(['src/lib/utils/widget-session.ts'])

test('one account saying yes does not carry the preview for another account on the same browser', () => {
  store.clear()
  store.set('yuri_visitor_id', '11111111-2222-4333-8444-555555555555')
  ws.setCarryoverChoice('userA', 'yes')
  assert.equal(ws.consentedVisitorId('userA'), '11111111-2222-4333-8444-555555555555')
  assert.equal(ws.getCarryoverChoice('userB'), null, 'B must be asked')
  assert.equal(ws.consentedVisitorId('userB'), undefined)
  ws.setCarryoverChoice('userB', 'no')
  assert.equal(ws.getCarryoverChoice('userA'), 'yes', "B's no must not overwrite A")
  assert.equal(ws.consentedVisitorId(''), undefined)
})

test('a preview older than 30 days is still found (rejects: gating on the resetting message counter)', () => {
  store.clear()
  store.set('yuri_visitor_id', '11111111-2222-4333-8444-555555555555')
  assert.equal(ws.hasPreviewConversation(), false)
  ws.incrementWidgetMessageCount()
  assert.ok(ws.previewedAt())
  store.delete('yuri_widget_session') // the 30-day counter reset
  assert.equal(ws.hasPreviewConversation(), true)
})

test('the onboarding page never mints a visitor id', () => {
  const src = read('src/lib/utils/widget-session.ts')
  const start = src.indexOf('export function getExistingVisitorId')
  const fn = src.slice(start, src.indexOf('\n}\n', start))
  assert.doesNotMatch(fn, /randomUUID|setItem|setCookie/)
})

// ── 2. recap status ──────────────────────────────────────────────────────
test('only sent/delivered may read as sent (rejects: failures worded as "was sent but…")', () => {
  for (const s of ['suppressed', 'suppressed_duplicate', 'not_their_address', 'send_failed', 'bounced', 'complained', null, undefined]) {
    const f = recap.recapStatusFact(s)
    assert.doesNotMatch(f, /^The recap email was sent|\bsent (?:and|but)\b|\bdelivered\b/i, String(s))
  }
  for (const s of ['suppressed', 'suppressed_duplicate', 'not_their_address']) {
    assert.match(recap.recapStatusFact(s), /Nothing is on its way|Do not tell them one is on its way/, String(s))
  }
  assert.match(recap.recapStatusFact(null), /do not promise it is coming/)
  assert.match(recap.recapStatusFact('delivered'), /^The recap email was sent and delivered\.$/)
  assert.match(recap.recapStatusFact('sent'), /^The recap email was sent \(delivery not yet confirmed\)\.$/)
})

test('the widget shows the recap status beside "email on file"', () => {
  assert.match(read('src/app/api/widget/chat/route.ts'), /Do NOT ask again; just keep helping\. \$\{recapStatusFact\(visitor\?\.recap_status\)\}/)
})

// ── 3. headed AM/PM routine ──────────────────────────────────────────────
const REAL = `Here's the whole 4 weeks:

**Morning**
- **Splash with lukewarm water.** No cleanser needed.
- **AESTURA AtoBarrier365 Cream**, a thin layer.
- **Sunscreen.** Keep the one you have now.

**Night**
- **CeraVe Hydrating Facial Cleanser**. Wash for 30 seconds.
- **AtoBarrier365 Cream.**
`
const am = (t) => give.detectArtifactsInReply(t).has('am_pm_routine')

test('a routine with named products under standalone headings counts', () => {
  assert.ok(am(REAL))
  assert.ok(am(REAL.replace('**Morning**', '## AM').replace('**Night**', '## PM')))
})

test('headings without named products, one half, or one item do not count (rejects: 1-item blocks)', () => {
  assert.ok(!am(REAL.slice(0, REAL.indexOf('**Night**'))), 'AM half only')
  assert.ok(!am('**Morning**\n- **AESTURA AtoBarrier365 Cream**\n\n**Night**\n- **CeraVe Hydrating Facial Cleanser**\n'), 'one item per block')
  assert.ok(!am('**Morning**\n- If you get oily by noon, blot.\n- Keep it light.\n\n**Night**\n- Wash for 30 seconds.\n- Pat dry.\n'), 'tips')
  assert.ok(!am('**AM**\n- Cleanse (gentle)\n- Moisturize\n- SPF 50\n\n**PM**\n- Cleanse\n- Treat (retinol)\n- Moisturize\n'), 'skeleton')
  assert.ok(!am('**Morning**\n- Wear sunscreen, Texas UV is strong.\n- Reapply in Texas Summer.\n\n**Night**\n- Rinse off.\n- Moisturize.\n'), 'place names are not products')
  assert.ok(!am('**AM**\n- Gentle Cleanser\n- Mineral Sunscreen\n\n**PM**\n- Gentle Cleanser\n- Barrier Cream\n'), 'capitalised category skeleton')
  assert.ok(!am('**Morning**\n- Vitamin C Serum\n- Mineral Sunscreen\n\n**Night**\n- Retinol Cream\n- Barrier Cream\n'), 'ingredient skeleton')
  assert.ok(!am('**Morning**\n- Do you use a Vitamin C Serum?\n- Any Mineral Sunscreen?\n\n**Night**\n- Retinol Cream?\n- Gentle Cleanser?\n'), 'capitalised question list')
})
