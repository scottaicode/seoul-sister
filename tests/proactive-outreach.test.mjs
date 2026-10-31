/**
 * Guard tests — Yuri Wakes Up First (proactive lead re-engagement + subscriber
 * check-ins, Oct 9 2026).
 *
 * Each test EXECUTES the real function (transpiled, with its imports stubbed)
 * rather than grepping source. The properties guarded are the ones whose
 * silent loosening would email someone who should not be emailed, or teach
 * Yuri a false lesson:
 *   1. Fail-safe parse: nothing but an explicit, complete "speak" ever speaks.
 *   2. The lead gate: suppressed, internal, mid-sequence, and the "last email,
 *      promise" leads are never judged without the owner's approval.
 *   3. The check-in gate: demo, canceled, night, cap/spacing, judged-today.
 *   4. The teacher: an undelivered email is never graded as Yuri's words failing.
 *   5. The shared cap: two crons cannot add up to more contact than one.
 *   6. Rendering: model text is escaped; the footer carries unsubscribe and
 *      a postal address, and says so loudly when the address is missing.
 *   7. Migration: the never-double-send index exists and covers silence.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
/**
 * Mutation hook (test infra only): SS_MUTATION='{"file":"src/...","from":"...","to":"..."}'
 * applies the replacement IN MEMORY when that file is read, so "does this test
 * fail when the code is broken?" can be checked without editing the source.
 * The run fails loudly if the `from` text is not found (a mutation that did not
 * apply would otherwise report a false green).
 */
const MUTATION = process.env.SS_MUTATION ? JSON.parse(process.env.SS_MUTATION) : null
const read = (...p) => {
  const text = readFileSync(join(root, ...p), 'utf8')
  if (MUTATION && join(...p) === MUTATION.file) {
    const occurrences = text.split(MUTATION.from).length - 1
    if (occurrences === 0) throw new Error(`mutation did not apply: ${MUTATION.from}`)
    // An ambiguous site would mutate whichever copy comes first, possibly not the one meant.
    if (occurrences > 1) throw new Error(`mutation is ambiguous (${occurrences} sites): ${MUTATION.from}`)
    return text.replace(MUTATION.from, MUTATION.to)
  }
  return text
}

/**
 * Transpile a module and replace every named import with a stub, so pure
 * functions can run without Supabase/Anthropic. `impls` supplies real bodies
 * for the few imported names a tested function actually calls.
 */
// The REAL safeSlice, transpiled once, injected wherever a module imports it.
const SAFE_SLICE_SRC = (() => {
  const js = ts.transpileModule(read('src', 'lib', 'utils', 'text-slice.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  const m = js.match(/export function safeSlice\([\s\S]*?\n\}/)
  return `(${m[0].replace(/^export /, '')})`
})()

async function loadPure(relPath, impls = {}) {
  impls = { safeSlice: SAFE_SLICE_SRC, ...impls }
  let js = ts.transpileModule(read(...relPath), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  js = js.replace(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"];?/g, (_m, names) =>
    names
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const [orig, alias] = n.split(/\s+as\s+/)
        const local = (alias || orig).trim()
        return `const ${local} = ${impls[orig.trim()] ?? '(() => { throw new Error("stub: ' + orig.trim() + '") })'};`
      })
      .join('\n')
  )
  js = js.replace(/^export\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?$/gm, '')
  const dir = mkdtempSync(join(tmpdir(), 'ss-proactive-'))
  const file = join(dir, 'm.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-10-09T17:00:00Z')

// ---------------------------------------------------------------------------
// 1. Fail-safe parse
// ---------------------------------------------------------------------------

test('only an explicit, complete speak decision speaks', async () => {
  const { parseDecision } = await loadPure(['src', 'lib', 'proactive', 'judge.ts'], {
    scrubEmailVoice: '((s) => s)',
  })
  const ok = parseDecision(
    JSON.stringify({ decision: 'speak', signal: 'retinol week 2', reasoning: 'r', confidence: 0.7, subject: 's', message: 'm', suggested_ask: 'a' }),
    'model-x'
  )
  assert.equal(ok.decision, 'speak')
  assert.equal(ok.message, 'm')

  assert.equal(parseDecision('not json at all', 'm').decision, 'failed', 'garbage must never speak')
  assert.equal(parseDecision('{"decision":"speak","subject":"s"}', 'm').decision, 'failed', 'speak without a body must not send')
  assert.equal(parseDecision('{"decision":"speak","message":"x"}', 'm').decision, 'failed', 'speak without a subject must not send')
  assert.equal(parseDecision('{"decision":"Speak","subject":"s","message":"m"}', 'm').decision, 'silent', 'anything but the exact token is silence')
  assert.equal(parseDecision('{"decision":true,"subject":"s","message":"m"}', 'm').decision, 'silent')
  const silent = parseDecision('{"decision":"silent","subject":"leaked","message":"leaked"}', 'm')
  assert.equal(silent.decision, 'silent')
  assert.equal(silent.message, null, 'a silent decision must not carry a sendable body')
  assert.equal(parseDecision('{"decision":"silent","confidence":7}', 'm').confidence, null, 'out-of-range confidence is dropped, not stored')
})

// ---------------------------------------------------------------------------
// 2. Lead gate
// ---------------------------------------------------------------------------

const lead = (over = {}) => ({
  id: 'l1',
  email: 'x@example.com',
  user_id: null,
  visitor_id: 'v1',
  cohort: 'widget',
  sequence_step: 3,
  last_sent_at: new Date(NOW - 30 * DAY).toISOString(),
  enrolled_at: new Date(NOW - 40 * DAY).toISOString(),
  suppressed: false,
  unsubscribe_token: '00000000-0000-0000-0000-000000000001',
  ...over,
})
const gateOpts = (over = {}) => ({ now: NOW, ownerApproved: true, hasEverPaid: false, internal: false, alreadyJudged: false, ...over })

test('lead gate: the last-email promise blocks every finished lead unless the owner approved', async () => {
  const { leadGate, LAST_EMAIL_PROMISE_STEP } = await loadPure(['src', 'lib', 'proactive', 'lead-reengage.ts'])
  assert.equal(LAST_EMAIL_PROMISE_STEP, 3, 'email 3 of the Honest Three is the one that says "last email, promise"')
  assert.match(read('src', 'lib', 'email', 'nurture-copy.ts'), /last email, promise/, 'if the promise copy changes, revisit this gate')

  assert.equal(leadGate(lead(), gateOpts({ ownerApproved: false })), 'last_email_promise')
  assert.equal(leadGate(lead(), gateOpts()), null)
})

test('lead gate: suppressed, any payer, internal, registered, already-judged, mid-sequence, too-recent all skip', async () => {
  const { leadGate } = await loadPure(['src', 'lib', 'proactive', 'lead-reengage.ts'])
  assert.equal(leadGate(lead({ suppressed: true }), gateOpts()), 'suppressed')
  assert.equal(leadGate(lead(), gateOpts({ hasEverPaid: true })), 'former_or_current_payer', 'former payers go to the owner, never an automated email')
  assert.equal(
    leadGate(lead({ cohort: 'registered', user_id: 'u1' }), gateOpts()),
    'registered_cohort',
    'the only Yuri who remembers a registered lead is behind the paywall'
  )
  assert.equal(leadGate(lead(), gateOpts({ internal: true })), 'internal_account')
  assert.equal(leadGate(lead(), gateOpts({ alreadyJudged: true })), 'already_judged')
  assert.equal(leadGate(lead({ sequence_step: 2 }), gateOpts()), 'mid_sequence', 'never collide with the running Honest Three')
  assert.equal(leadGate(lead({ last_sent_at: new Date(NOW - 2 * DAY).toISOString() }), gateOpts()), 'nurture_too_recent')
  // Suppression outranks the owner's approval.
  assert.equal(leadGate(lead({ suppressed: true }), gateOpts({ ownerApproved: true })), 'suppressed')
})

test('the payer check counts ANY subscription status and converted widget visitors', () => {
  const run = read('src', 'lib', 'proactive', 'run.ts')
  // A status filter here is exactly how a canceled payer slipped through review.
  assert.match(run, /db\.from\('ss_subscriptions'\)\.select\('user_id'\),/)
  assert.match(run, /hasEverPaid:[\s\S]{0,160}convertedEmails\.has/)
})

test('lead facts describe what the link really opens, including an exhausted preview', async () => {
  const { buildLeadFacts } = await loadPure(['src', 'lib', 'proactive', 'lead-reengage.ts'], {
    getLocalClock: '(() => ({ timezone: "UTC", isoDate: "2026-10-09", weekday: "Friday", longDate: "Friday, October 9, 2026" }))',
    clockFactBlock: '(() => "TODAY")',
    MAX_FREE_MESSAGES: '12',
  })
  const ctx = (used) => ({ lead: lead(), turns: [{ role: 'user', content: 'hi', created_at: '2026-08-01T00:00:00Z' }], widgetVisitorKey: 'v', freeMessagesUsed: used, memorySummary: null, recapSentAt: null, lastTalkedAt: null })
  assert.match(buildLeadFacts(ctx(12), ''), /all 12 free preview messages are used/)
  assert.match(buildLeadFacts(ctx(12), ''), /will not recognize them/)
  assert.match(buildLeadFacts(ctx(4), ''), /8 of 12 free preview messages are left/)
  assert.doesNotMatch(buildLeadFacts(ctx(4), ''), /never subscribed\. What they said to you was during the free onboarding/)
})

test('lead facts never tell Yuri the owner approved unless the gate required it', () => {
  // buildLeadFacts states the owner approved one more note. That is only true
  // because leadGate refuses unapproved finished leads, and run.ts only computes
  // ownerApproved=true from the env flag (or a DRY RUN's assume flag).
  const run = read('src', 'lib', 'proactive', 'run.ts')
  assert.match(run, /const ownerApproved = ownerApprovedAfterLastEmail\(\) \|\| \(opts\.dryRun && opts\.assumeOwnerApproval === true\)/)
})

// ---------------------------------------------------------------------------
// 3. Check-in gate + 5. shared cap
// ---------------------------------------------------------------------------

const limitsImpl = async () => loadPure(['src', 'lib', 'intelligence', 'nudge-limits.ts'])

test('shared cap: 3 per 30 days and 3 days apart, counted across both crons', async () => {
  const { capOrSpacingBlocks } = await limitsImpl()
  const ago = (d) => new Date(NOW - d * DAY).toISOString()
  assert.equal(capOrSpacingBlocks([], NOW), false)
  assert.equal(capOrSpacingBlocks([ago(1)], NOW), true, 'spacing')
  assert.equal(capOrSpacingBlocks([ago(4), ago(10), ago(20)], NOW), true, 'cap')
  assert.equal(capOrSpacingBlocks([ago(4), ago(10), ago(40)], NOW), false, 'window rolls')
  // The rule-based cron must use the same constants (one source of truth).
  assert.match(read('src', 'app', 'api', 'cron', 'proactive-nudge', 'route.ts'), /from '@\/lib\/intelligence\/nudge-limits'/)
})

test('check-in gate: demo, night, cap, judged-today skip; daytime passes', async () => {
  const limits = await limitsImpl()
  const { checkinGate } = await loadPure(['src', 'lib', 'proactive', 'subscriber-checkin.ts'], {
    // The real function, closed over the real constants from nudge-limits.ts.
    capOrSpacingBlocks: `((MAX_NUDGES, NUDGE_WINDOW_DAYS, SPACING_DAYS) => (${limits.capOrSpacingBlocks.toString()}))(${limits.MAX_NUDGES}, ${limits.NUDGE_WINDOW_DAYS}, ${limits.SPACING_DAYS})`,
    localHour: '((tz) => (tz === "Night/Zone" ? 3 : 12))',
    DAYTIME_START_HOUR: '9',
    DAYTIME_END_HOUR: '20',
  })
  const s = { user_id: 'u', timezone: 'America/Chicago', latitude: null, longitude: null, is_demo: false, nudge_email_opt_out: false, nudge_unsubscribe_token: null }
  const o = (over = {}) => ({ internal: false, nudgeCreatedAts: [], lastJudgedAt: null, now: NOW, ...over })
  assert.equal(checkinGate(s, o()), null)
  assert.equal(checkinGate({ ...s, is_demo: true }, o()), 'demo')
  assert.equal(checkinGate(s, o({ internal: true })), 'internal', 'admin/founder accounts only via the dogfood list')
  assert.equal(checkinGate({ ...s, timezone: 'Night/Zone' }, o()), 'night')
  assert.equal(checkinGate(s, o({ nudgeCreatedAts: [new Date(NOW - DAY).toISOString()] })), 'cap_or_spacing')
  assert.equal(checkinGate(s, o({ lastJudgedAt: new Date(NOW - 3600 * 1000).toISOString() })), 'judged_recently')
})

// ---------------------------------------------------------------------------
// 4. The teacher
// ---------------------------------------------------------------------------

test('grading: undelivered is never "no_response"; conversion outranks; unsubscribe outranks engagement', async () => {
  const { classifyGrade } = await loadPure(['src', 'lib', 'proactive', 'ledger.ts'])
  const e = (over = {}) => ({ delivery_status: 'sent', converted: false, unsubscribed: false, engaged: false, ...over })
  assert.equal(classifyGrade(e()), 'no_response')
  assert.equal(classifyGrade(e({ engaged: true })), 'engaged')
  assert.equal(classifyGrade(e({ delivery_status: 'bounced' })), 'undelivered')
  assert.equal(classifyGrade(e({ delivery_status: 'send_failed' })), 'undelivered')
  assert.equal(classifyGrade(e({ delivery_status: 'complained' })), 'unsubscribed')
  assert.equal(classifyGrade(e({ engaged: true, unsubscribed: true })), 'unsubscribed')
  assert.equal(classifyGrade(e({ converted: true, unsubscribed: true })), 'converted')
  assert.equal(classifyGrade(e({ delivery_status: 'not_reached' })), 'undelivered', 'a check-in nobody saw is not Yuri failing')
})

// ---------------------------------------------------------------------------
// 6. Rendering
// ---------------------------------------------------------------------------

test('lead email: model text escaped, CTA carries the attribution tag, footer has unsubscribe + postal address', async () => {
  const { escapeHtml } = await loadPure(['src', 'lib', 'email', 'html.ts'])
  const { wrapEmailHtml } = await loadPure(['src', 'lib', 'email', 'send.ts'])
  const { buildLeadEmail } = await loadPure(['src', 'lib', 'proactive', 'lead-reengage.ts'], {
    escapeHtml: `(${escapeHtml.toString()})`,
    wrapEmailHtml: `(${wrapEmailHtml.toString()})`,
  })
  const decision = { decision: 'speak', subject: 'hi', message: 'Hi <script>x</script>\n\nSecond para', suggestedAsk: 'Can we pick up my redness question?' }
  const withAddr = buildLeadEmail(decision, lead(), 'reengage_abc', '123 Main St, Austin, TX 78701')
  assert.ok(!withAddr.html.includes('<script>'), 'model output must be escaped')
  assert.match(withAddr.html, /from=reengage_abc/)
  assert.match(withAddr.html, /ask=Can\+we\+pick\+up/)
  assert.match(withAddr.html, /api\/email\/unsubscribe\?token=00000000-0000-0000-0000-000000000001/)
  assert.match(withAddr.html, /123 Main St, Austin, TX 78701/)

  const noAddr = buildLeadEmail(decision, lead(), 'reengage_abc', null)
  assert.match(noAddr.html, /POSTAL ADDRESS NOT CONFIGURED/)
})

test('live lead sends are blocked outright when no postal address is configured', () => {
  const run = read('src', 'lib', 'proactive', 'run.ts')
  assert.match(run, /if \(!address && !opts\.dryRun\) \{[\s\S]{0,400}lead\.phase = 'blocked_no_postal_address'/)
})

// ---------------------------------------------------------------------------
// 7. Migration
// ---------------------------------------------------------------------------

test('migration: one decided judgment per lead per campaign, silence included', () => {
  const sql = read('supabase', 'migrations', '20261009000001_proactive_judgments.sql')
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS uq_proactive_lead_once\s+ON ss_proactive_judgments \(nurture_lead_id, campaign\)\s+WHERE audience = 'lead' AND decision IN \('speak', 'silent', 'blocked'\)/
  )
  assert.match(sql, /decision TEXT NOT NULL CHECK \(decision IN \('speak', 'silent', 'failed', 'blocked'\)\)/)
})

// ---------------------------------------------------------------------------
// 8. Delivery plumbing the grade depends on
// ---------------------------------------------------------------------------

test('RFC 8058 one-click unsubscribe answers POST, not only GET', async () => {
  const src = read('src', 'app', 'api', 'email', 'unsubscribe', 'route.ts')
  assert.match(src, /export const POST = GET/)
  assert.match(read('src', 'lib', 'email', 'send.ts'), /List-Unsubscribe-Post/)
})

test('Resend webhook fans out to the judgment ledger so a lead bounce grades undelivered', () => {
  const src = read('src', 'app', 'api', 'webhooks', 'resend', 'route.ts')
  assert.match(src, /updateJudgmentDeliveryByProviderId\(getServiceClient\(\), providerId, status\)/)
  assert.match(src, /recap\.matched \|\| nudge\.matched \|\| judgment\.matched/)
})

test('a lead send that never left frees the one-ever judgment', () => {
  const run = read('src', 'lib', 'proactive', 'run.ts')
  assert.match(run, /\.\.\.\(result\.sent \? \{\} : \{ decision: 'failed' as const \}\)/)
  assert.match(run, /lead\.phase = 'blocked_no_email_provider'/)
})

test('migration: one subscriber check-in judgment per local day', () => {
  const sql = read('supabase', 'migrations', '20261009000001_proactive_judgments.sql')
  assert.match(sql, /uq_proactive_checkin_daily\s+ON ss_proactive_judgments \(user_id, campaign, \(context_facts->>'local_date'\)\)/)
  assert.match(read('src', 'lib', 'proactive', 'run.ts'), /local_date: getLocalClock\(p\.timezone/)
})

// ---------------------------------------------------------------------------
// 9. Per-source / per-video funnel (traffic graded by outcome, not views)
// ---------------------------------------------------------------------------

function fakeDb(tables, { truncate } = {}) {
  return {
    from(table) {
      const rows = tables[table] ?? []
      return {
        select(_cols, opts) {
          if (opts?.head) return Promise.resolve({ count: rows.length, error: null })
          return {
            range(a, b) {
              // `truncate` simulates PostgREST silently returning fewer rows.
              const page = rows.slice(a, b + 1)
              return Promise.resolve({ data: truncate === table ? page.slice(1) : page, error: null })
            },
          }
        },
      }
    },
  }
}

test('campaign funnel: one video graded landed → chatted → email → paid → day 10', async () => {
  const { campaignFunnel } = await loadPure(['src', 'lib', 'proactive', 'campaign-funnel.ts'])
  const now = Date.parse('2026-11-30T00:00:00Z')
  const tables = {
    ss_campaign_touches: [
      { visitor_id: 'a', utm_source: 'tiktok', utm_content: 'vid1', referrer_host: null },
      { visitor_id: 'b', utm_source: 'tiktok', utm_content: 'vid1', referrer_host: null },
      { visitor_id: 'c', utm_source: 'tiktok', utm_content: 'vid2', referrer_host: null },
      { visitor_id: 'd', utm_source: null, utm_content: null, referrer_host: 'reddit.com' },
    ],
    ss_widget_visitors: [
      { visitor_id: 'a', total_messages: 5, captured_email: 'x@y.z', converted_user_id: 'u1' },
      { visitor_id: 'b', total_messages: 0, captured_email: null, converted_user_id: null },
    ],
    ss_user_profiles: [{ user_id: 'u2', utm_source: 'tiktok', utm_content: 'vid2' }],
    ss_subscriptions: [
      { user_id: 'u1', status: 'canceled', created_at: '2026-11-01T00:00:00Z', canceled_at: '2026-11-05T00:00:00Z' },
      { user_id: 'u2', status: 'active', created_at: '2026-11-01T00:00:00Z', canceled_at: null },
    ],
  }
  const rows = await campaignFunnel(fakeDb(tables), now)
  const vid1 = rows.find((r) => r.content === 'vid1')
  assert.deepEqual(
    { landed: vid1.landed, chatted: vid1.chatted, emailed: vid1.emailed, paid: vid1.paid, pastDay10: vid1.pastDay10, survivedDay10: vid1.survivedDay10 },
    { landed: 2, chatted: 1, emailed: 1, paid: 1, pastDay10: 1, survivedDay10: 0 },
    'canceled on day 4 did not survive day 10'
  )
  const vid2 = rows.find((r) => r.content === 'vid2')
  assert.equal(vid2.paid, 1, 'a signup-path payer is credited to the video from their profile first touch')
  assert.equal(vid2.survivedDay10, 1)
  assert.ok(rows.find((r) => r.source === 'reddit.com'), 'no UTM falls back to the referrer host, never dropped')
})

test('campaign funnel refuses a partial read instead of reporting it as the whole', async () => {
  const { campaignFunnel } = await loadPure(['src', 'lib', 'proactive', 'campaign-funnel.ts'])
  const tables = {
    ss_campaign_touches: [{ visitor_id: 'a', utm_source: 'tiktok', utm_content: 'v', referrer_host: null }],
    ss_widget_visitors: [],
    ss_user_profiles: [],
    ss_subscriptions: [],
  }
  await assert.rejects(() => campaignFunnel(fakeDb(tables, { truncate: 'ss_campaign_touches' })), /read 0 of 1 rows/)
})

// ---------------------------------------------------------------------------
// 10. Content guard — the render reviewer's two wrong drafts must be blocked
// ---------------------------------------------------------------------------

// b6decb40: her only AtoBarrier message is a LINK, not a purchase.
const WRONG_A = {
  subject: 'Four nights in',
  message:
    "Four nights on the AtoBarrier and your skin should be starting to calm. If the stinging is still there, use a cream cleanser this week instead of the Cetaphil and tell me how it feels.",
}
const EVIDENCE_A = {
  userMessages: [
    'I have the following link for Atobarrier 365:',
    'I bought this sunscreen in the airport in Seoul, Korea so it is not the American formula',
    'I use the Cetaphil Daily Facial Cleanser morning and night',
  ],
  recordedDecisions: ['decision: PM routine: Cetaphil cleanser, plain barrier cream only, park actives temporarily'],
  plan: 'Barrier Repair: park actives temporarily',
  knownProducts: ['AESTURA AtoBarrier365 Cream', 'Cetaphil Daily Facial Cleanser'],
}
// 551569d3: BHA was stopped for dryness; a no-tools message must not restart it.
const WRONG_B = {
  subject: 'Good night for it',
  message: 'Your chin has settled down nicely, so add the BHA back tonight alongside Differin and see how it goes.',
}
const EVIDENCE_B = {
  userMessages: ['Can you update my evening routine with alternating differin and bha', 'But we stopped the bha because of my skin and dryness/flakiness??'],
  recordedDecisions: ['decision: BHA paused for dryness', 'decision: Differin on Tue/Sat nights'],
  plan: 'Brightening/Glow: Differin maintained on Tue/Sat nights; BHA only on maintenance nights if congestion returns',
  knownProducts: ['COSRX BHA Blackhead Power Liquid', 'Differin Adapalene Gel'],
}

const loadGuard = () => loadPure(['src', 'lib', 'proactive', 'content-guard.ts'])

test('guard blocks wrong render A when the verifier reports it correctly', async () => {
  const { enforceGuard } = await loadGuard()
  const r = enforceGuard(
    {
      products_mentioned: ['AtoBarrier', 'cream cleanser', 'Cetaphil'],
      using_claims: [
        { product: 'AtoBarrier', user_quote: '' },
        { product: 'Cetaphil', user_quote: 'I use the Cetaphil Daily Facial Cleanser morning and night' },
      ],
      contradicted_decisions: [],
      routine_changes: ['switch to a cream cleanser instead of the Cetaphil'],
      verdict: 'block',
    },
    EVIDENCE_A,
    WRONG_A.message
  )
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /AtoBarrier.*nothing they said confirms/.test(x)))
  assert.ok(r.reasons.some((x) => /routine change/.test(x)))
})

test('guard blocks wrong render A even when a lenient verifier says pass', async () => {
  const { enforceGuard } = await loadGuard()
  // Omission: the verifier never mentions the product the message names.
  const omitted = enforceGuard({ products_mentioned: [], using_claims: [], contradicted_decisions: [], routine_changes: [], verdict: 'pass' }, EVIDENCE_A, WRONG_A.message)
  assert.equal(omitted.pass, false, 'a pass that ignores a named shelf product must not pass')
  assert.ok(omitted.reasons.some((x) => /AtoBarrier365.*did not account/.test(x)))
  // Fabricated evidence: a quote that is not in her messages.
  const faked = enforceGuard(
    { products_mentioned: ['AtoBarrier', 'Cetaphil'], using_claims: [{ product: 'AtoBarrier', user_quote: "I've been using the AtoBarrier every night" }, { product: 'Cetaphil', user_quote: 'I use the Cetaphil Daily Facial Cleanser morning and night' }], contradicted_decisions: [], routine_changes: [], verdict: 'pass' },
    EVIDENCE_A,
    WRONG_A.message
  )
  assert.equal(faked.pass, false)
  assert.ok(faked.reasons.some((x) => /quote offered for "AtoBarrier" is not in their messages/.test(x)))
})

test('guard blocks wrong render B when the verifier reports the change', async () => {
  const { enforceGuard } = await loadGuard()
  const r = enforceGuard(
    {
      products_mentioned: ['BHA', 'Differin'],
      using_claims: [{ product: 'Differin', user_quote: 'Can you update my evening routine with alternating differin and bha' }],
      contradicted_decisions: ['BHA paused for dryness'],
      routine_changes: ['restart BHA tonight alongside Differin'],
      verdict: 'block',
    },
    EVIDENCE_B,
    WRONG_B.message
  )
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /contradicts a recorded decision/.test(x)))
})

test('guard fails closed: no verdict, unparseable verdict, or a guard call that throws all block', async () => {
  const { enforceGuard, parseVerifier } = await loadGuard()
  assert.equal(enforceGuard(null, EVIDENCE_B, WRONG_B.message).pass, false)
  assert.equal(parseVerifier('I think it is fine'), null)
  assert.equal(enforceGuard({ verdict: 'PASS' }, EVIDENCE_B, WRONG_B.message).pass, false, 'only the exact token passes')
})

test('without the guard the wrong renders would be recorded as speak; with it they are blocked', async () => {
  // Shim exposing the REAL enforceGuard to the stubbed checkProactiveDraft.
  const { enforceGuard } = await loadGuard()
  const shimDir = mkdtempSync(join(tmpdir(), 'ss-guard-shim-'))
  const shim = join(shimDir, 'shim.mjs')
  globalThis.__enforceGuard = enforceGuard
  writeFileSync(shim, 'export const enforce = (v, e, m) => globalThis.__enforceGuard(v, e, m)')
  const verifierA = { products_mentioned: ['AtoBarrier', 'Cetaphil'], using_claims: [{ product: 'AtoBarrier', user_quote: '' }], routine_changes: ['cream cleanser'], verdict: 'block' }
  const { guardDecision } = await loadPure(['src', 'lib', 'proactive', 'run.ts'], {
    checkProactiveDraft: `(async ({ message, evidence }) => (await import(${JSON.stringify(pathToFileURL(shim).href)})).enforce(${JSON.stringify(verifierA)}, evidence, message))`,
  })
  const draft = { decision: 'speak', subject: WRONG_A.subject, message: WRONG_A.message, suggestedAsk: null, signal: 's', reasoning: 'r', confidence: 0.6, model: 'm' }
  const guarded = await guardDecision(draft, EVIDENCE_A, 'u')
  assert.equal(guarded.decision.decision, 'blocked')
  assert.ok(guarded.guardReasons.length > 0)
  assert.equal(guarded.decision.message, WRONG_A.message, 'the refused draft is kept for the ledger')

  // Both judgment paths must route through the guard before recording.
  const run = read('src', 'lib', 'proactive', 'run.ts')
  assert.match(run, /await guardDecision\(judged\.decision, judged\.evidence, p\.user_id\)[\s\S]*recordJudgment\(db, \{\s*audience: 'subscriber'/)
  assert.match(run, /await guardDecision\(await judgeLead\(db, ctx\)/)
})

// ---------------------------------------------------------------------------
// 11. Memory settle — the root cause of the wrong renders
// ---------------------------------------------------------------------------

const MEM_IMPLS = { safeSlice: SAFE_SLICE_SRC }
const dm = (loops) => ({ decisions: [], preferences: [], commitments: [], corrections: [], open_loops: loops, extracted_at: '' })
const loop = (topic, over = {}) => ({ topic, summary: `${topic} summary`, opened_date: '2026-07-21', ...over })
const resolution = (topic) => ({ topic, reason: 'Yuri delivered it', evidence_quote: 'here is your starter routine' })

test('a resolution SOFT-closes the loop (kept, stamped, reversible); omission never closes; re-raise reopens', async () => {
  const { mergeDecisionMemory, isOpenLoop, reopenLoop } = await loadPure(['src', 'lib', 'yuri', 'memory.ts'], MEM_IMPLS)
  const base = dm([loop('pm_routine_build'), loop('baseline_photo')])
  const incoming = dm([])
  // Omission alone never closes a loop.
  assert.equal(mergeDecisionMemory(base, incoming).open_loops.filter(isOpenLoop).length, 2)
  // Resolved: still present, stamped, no longer open.
  const merged = mergeDecisionMemory(base, incoming, [resolution('PM_Routine_Build')], 'conv-2', '2026-10-10T00:00:00Z')
  const closed = merged.open_loops.find((l) => l.topic === 'pm_routine_build')
  assert.ok(closed, 'nothing is deleted')
  assert.equal(closed.resolved_at, '2026-10-10T00:00:00Z')
  assert.equal(closed.resolved_by_conversation, 'conv-2')
  assert.equal(closed.resolved_reason, 'Yuri delivered it')
  assert.deepEqual(merged.open_loops.filter(isOpenLoop).map((l) => l.topic), ['baseline_photo'])
  // Reversible: an owner/audit reopen, and a later extraction re-raising it.
  assert.ok(isOpenLoop(reopenLoop(merged, 'pm_routine_build').open_loops.find((l) => l.topic === 'pm_routine_build')))
  const reraised = mergeDecisionMemory(merged, dm([loop('pm_routine_build')]))
  assert.ok(isOpenLoop(reraised.open_loops.find((l) => l.topic === 'pm_routine_build')), 're-raised reopens')
  // Re-raised in the SAME pass outranks the resolution.
  const same = mergeDecisionMemory(base, dm([loop('pm_routine_build')]), [resolution('pm_routine_build')])
  assert.ok(isOpenLoop(same.open_loops.find((l) => l.topic === 'pm_routine_build')))
})

test('a resolution counts only with a verbatim quote from the transcript the extractor saw', async () => {
  const { validateResolutions } = await loadPure(['src', 'lib', 'yuri', 'memory.ts'], MEM_IMPLS)
  const onRecord = [loop('pm_routine_build')]
  const transcript = "User: Yes, build me a starter routine\nYuri: Here's your starter PM routine, four products"
  const ok = validateResolutions([{ topic: 'pm_routine_build', reason: 'built', evidence_quote: "Here's your starter PM routine" }], transcript, onRecord)
  assert.equal(ok.length, 1)
  assert.equal(validateResolutions([{ topic: 'pm_routine_build', reason: 'built', evidence_quote: 'I sent you the routine last week' }], transcript, onRecord).length, 0, 'quote not in the visible window')
  assert.equal(validateResolutions([{ topic: 'pm_routine_build', reason: 'built' }], transcript, onRecord).length, 0, 'no evidence, no close')
  assert.equal(validateResolutions([{ topic: 'some_other_loop', reason: 'x', evidence_quote: "Here's your starter PM routine" }], transcript, onRecord).length, 0, 'only loops on record')
  assert.equal(validateResolutions(['pm_routine_build'], transcript, onRecord).length, 0, 'bare strings (old shape) are not accepted')
  // Excerpts joined with "...", markdown stripped: each excerpt must be verbatim.
  const md = "Yuri: **1. Cleanse, Isntree Yam Root** ($18.30) then **2. Retinoid, Some By Mi** at night"
  assert.equal(validateResolutions([{ topic: 'pm_routine_build', reason: 'r', evidence_quote: '1. Cleanse, Isntree Yam Root ... 2. Retinoid, Some By Mi' }], md, onRecord).length, 1)
  assert.equal(validateResolutions([{ topic: 'pm_routine_build', reason: 'r', evidence_quote: '1. Cleanse, Isntree Yam Root ... 3. Moisturizer, COSRX' }], md, onRecord).length, 0, 'one invented excerpt fails the whole quote')
})

test('the extractor gets the open loops on record and must cite evidence; merge re-reads before writing', () => {
  const src = read('src', 'lib', 'yuri', 'memory.ts')
  assert.match(src, /existingOpenLoops: DecisionMemory\['open_loops'\]/)
  assert.match(src, /"resolved_open_loops": \[\{ "topic": "\.\.\.", "reason": "\.\.\.", "evidence_quote": "\.\.\." \}\]/)
  // Lost-update fix: the merge base is a FRESH read, not the pre-model `existing`.
  assert.match(src, /const \{ data: freshSelf, error: freshErr \}[\s\S]{0,400}mergeDecisionMemory\(\s*\(freshSelf\?\.decision_memory/)
  assert.doesNotMatch(src, /mergeDecisionMemory\(existing, incoming/)
})

test('settle selection: idle, unsettled since the last message, not in backoff, attempts left', async () => {
  const { needsSettling, MAX_SETTLE_ATTEMPTS } = await loadPure(['src', 'lib', 'intelligence', 'memory-settle.ts'])
  const now = Date.parse('2026-10-10T12:00:00Z')
  const c = (over) => ({ lastMessageAt: '2026-10-10T10:00:00Z', hasUserMessage: true, settledAt: '2026-10-10T09:00:00Z', nextAttemptAt: null, attempts: 0, ...over })
  // fe464145's exact shape: extracted 53s before the routine request.
  assert.equal(needsSettling(c({ settledAt: '2026-07-23T16:04:01Z', lastMessageAt: '2026-07-23T16:05:18Z' }), now), true)
  assert.equal(needsSettling(c({ settledAt: null }), now), true, 'never settled (e.g. onboarding)')
  assert.equal(needsSettling(c({ settledAt: '2026-10-10T10:00:05Z' }), now), false, 'settled is idempotent')
  assert.equal(needsSettling(c({ lastMessageAt: '2026-10-10T11:45:00Z' }), now), false, 'still active: wait for idle')
  assert.equal(needsSettling(c({ hasUserMessage: false }), now), false, 'greeting-only conversation')
  assert.equal(needsSettling(c({ nextAttemptAt: '2026-10-10T13:00:00Z' }), now), false, 'in backoff')
  assert.equal(needsSettling(c({ attempts: MAX_SETTLE_ATTEMPTS }), now), false, 'gave up (counted in the run row)')
})

test('settle order: external users first, fewest failures first, then oldest first', async () => {
  const { orderForSettling, backoffHours } = await loadPure(['src', 'lib', 'intelligence', 'memory-settle.ts'])
  const rows = [
    { id: 'founder-old', internal: true, attempts: 0, lastMessageAt: '2026-01-01' },
    { id: 'kim-new', internal: false, attempts: 0, lastMessageAt: '2026-07-23' },
    { id: 'stuck', internal: false, attempts: 3, lastMessageAt: '2026-02-01' },
    { id: 'kim-old', internal: false, attempts: 0, lastMessageAt: '2026-07-21' },
  ]
  assert.deepEqual(orderForSettling(rows).map((r) => r.id), ['kim-old', 'kim-new', 'stuck', 'founder-old'])
  assert.deepEqual([1, 2, 3, 6].map(backoffHours), [1, 2, 4, 32])
})

test('settle cron is scheduled and answers GET; it writes a run row even when nothing is unsettled', () => {
  const vercel = JSON.parse(read('vercel.json'))
  assert.ok(vercel.crons.some((c) => c.path === '/api/cron/settle-memory'))
  const src = read('src', 'app', 'api', 'cron', 'settle-memory', 'route.ts')
  assert.match(src, /export \{ handler as GET, handler as POST \}/)
  assert.match(src, /run_type: 'settle_memory'/)
})

// ---------------------------------------------------------------------------
// 12. Memory defects 1-3 (Oct 10 2026)
// ---------------------------------------------------------------------------

test('safeSlice never splits an emoji, even when the cut lands mid-pair', async () => {
  const { safeSlice } = await loadPure(['src', 'lib', 'utils', 'text-slice.ts'])
  const s = 'abcde🧴xyz' // 🧴 occupies code units 5 and 6
  assert.equal(s.slice(0, 6).charCodeAt(5) >= 0xd800, true, 'sanity: the naive cut leaves a lone high surrogate')
  const cut = safeSlice(s, 6)
  assert.equal(cut, 'abcde')
  assert.doesNotThrow(() => encodeURIComponent(cut), 'a lone surrogate makes encodeURIComponent throw')
  assert.equal(safeSlice(s, 7), 'abcde🧴')
  assert.equal(safeSlice('short', 100), 'short')
})

test('budgeted transcript keeps whole messages and marks what it dropped', async () => {
  const { budgetedTranscript } = await loadPure(['src', 'lib', 'utils', 'text-slice.ts'])
  const routine = 'Yuri: ' + 'x'.repeat(1555) // the real 1,561-char routine reply
  const out = budgetedTranscript(['User: old 1', 'User: old 2', 'User: build me a starter routine', routine], 1600)
  assert.ok(out.includes(routine), 'the latest reply survives whole, no 800-char cut')
  assert.match(out, /^\[2 older messages omitted\]/)
  const huge = budgetedTranscript(['Yuri: ' + 'y'.repeat(5000)], 1000)
  assert.match(huge, /\[rest of this message omitted\]$/)
})

test('the summary generator and memory prompts no longer cut content mid-message or mid-pair', () => {
  const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
  const memory = read('src', 'lib', 'yuri', 'memory.ts')
  assert.doesNotMatch(advisor, /m\.content\.slice\(0, 600\)/)
  assert.doesNotMatch(advisor, /latestResponse\.slice\(0, 800\)/)
  assert.match(advisor, /budgetedTranscript\(lines, SUMMARY_TRANSCRIPT_BUDGET\)/)
  // Every content cut in both files goes through safeSlice (ids/dates excepted).
  for (const [name, src] of [['advisor.ts', advisor], ['memory.ts', memory]]) {
    const raw = [...src.matchAll(/(\w+(?:\.\w+)*)\.slice\(0, \d{3,4}\)/g)].map((m) => m[1])
    assert.deepEqual(raw, [], `${name} still has raw content slices: ${raw.join(', ')}`)
  }
})

test('a later conversation soft-closes a loop opened in an earlier one, unless re-raised', async () => {
  const { markResolvedLoops, dedupeLoops, isOpenLoop } = await loadPure(['src', 'lib', 'yuri', 'memory.ts'], MEM_IMPLS)
  const onboarding = dm([loop('specific_product_picks')])
  const closed = markResolvedLoops(onboarding, [resolution('Specific_Product_Picks')], [], 'conv-later')
  assert.equal(closed.open_loops.length, 1, 'kept, not deleted')
  assert.equal(isOpenLoop(closed.open_loops[0]), false)
  assert.equal(closed.open_loops[0].resolved_by_conversation, 'conv-later')
  assert.equal(markResolvedLoops(onboarding, [resolution('specific_product_picks')], ['specific_product_picks']), null, 're-raised wins')
  assert.equal(markResolvedLoops(onboarding, [resolution('other_topic')]), null, 'no change, no write')
  assert.equal(dedupeLoops([...onboarding.open_loops, { ...onboarding.open_loops[0], topic: 'SPECIFIC_PRODUCT_PICKS' }]).length, 1)
  const src = read('src', 'lib', 'yuri', 'memory.ts')
  assert.match(src, /const elsewhere = await loadRecentOpenLoops\(db, userId, conversationId\)/)
  assert.match(src, /applyLoopChanges\(fresh\?\.decision_memory/)
})

test('prior-conversation selection: only conversations that started BEFORE, newest 3, open loops only', async () => {
  const { pickPriorConversations } = await loadPure(['src', 'lib', 'yuri', 'memory.ts'], MEM_IMPLS)
  const row = (id, created, loops) => ({ id, created_at: created, decision_memory: loops === null ? {} : dm(loops) })
  const rows = [
    row('later', '2026-07-25', [loop('later_loop')]),
    row('self', '2026-07-23', [loop('own')]),
    row('onboarding', '2026-07-21', [loop('specific_product_picks')]),
    row('closed', '2026-07-20', [loop('done', { resolved_at: '2026-07-22' })]),
    row('empty', '2026-07-19', null),
    row('a', '2026-07-18', [loop('a')]),
    row('b', '2026-07-17', [loop('b')]),
  ]
  const picked = pickPriorConversations(rows, 'self', '2026-07-23')
  // Closed loops are carried too (closedLoops), so the extractor can see what not to reopen.
  assert.deepEqual(picked.map((p) => p.conversationId), ['onboarding', 'closed', 'a'], 'later excluded; 3 newest prior with dm = onboarding, closed, a')
  assert.deepEqual(picked.find((p) => p.conversationId === 'closed').openLoops, [])
  assert.equal(picked.find((p) => p.conversationId === 'closed').closedLoops.length, 1)
  assert.ok(!picked.some((p) => p.conversationId === 'later'), 'a conversation cannot close a promise made AFTER it')
  // The live loader filters created_at IN THE QUERY (no limit-then-filter) and both paths share this function.
  const src = read('src', 'lib', 'yuri', 'memory.ts')
  assert.match(src, /\.lt\('created_at', self\.created_at as string\)/)
  assert.match(read('src', 'lib', 'intelligence', 'memory-settle.ts'), /pickPriorConversations\(\[\.\.\.rows\.values\(\)\], c\.id/)
})

test('backfill/cron scope defaults to recent conversations; settle runs summary, memory, phases in sequence', () => {
  const src = read('src', 'lib', 'intelligence', 'memory-settle.ts')
  assert.match(src, /opts\.scope === 'all' \|\| recentIds\.has\(c\.id\) \|\| \(last\.get\(c\.id\) \?\? ''\) >= recentCutoff/)
  assert.match(read('scripts', 'backfill-memory-settle.ts'), /process\.argv\.includes\('--all'\) \? 'all' : 'recent'/)
  // Sequenced, not Promise.allSettled: two writers of decision_memory must not race.
  assert.doesNotMatch(src, /Promise\.allSettled/)
  assert.match(src, /await saveConversationSummary[\s\S]*await extractAndSaveDecisionMemory[\s\S]*await extractAndSaveTreatmentPhases/)
  const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
  assert.match(advisor, /await extractAndSaveDecisionMemory\(userId, conversationId, transcriptForDecisions, userTz\)[\s\S]{0,400}await extractAndSaveTreatmentPhases/)
})

test('guard: two independent reads, any block wins', async () => {
  const { combineReads } = await loadPure(['src', 'lib', 'proactive', 'content-guard.ts'])
  const pass = { pass: true, reasons: [], verifier: { verdict: 'pass' } }
  const block = { pass: false, reasons: ['treats "AtoBarrier365" as something they use'], verifier: { verdict: 'block' } }
  assert.equal(combineReads([pass, block]).pass, false)
  assert.equal(combineReads([block, pass]).pass, false)
  assert.equal(combineReads([pass, pass]).pass, true)
  // Two DIFFERENT framings, not the same prompt twice.
  assert.match(read('src', 'lib', 'proactive', 'content-guard.ts'), /combineReads\(await Promise\.all\(\[readOnce\(VERIFIER_SYSTEM_A\), readOnce\(VERIFIER_SYSTEM_B\)\]\)\)/)
})

// ---------------------------------------------------------------------------
// 13. Full-diff review fixes (Oct 10 2026)
// ---------------------------------------------------------------------------

const CAROLINE = {
  userMessages: [
    'The Anua Oil Cleanser broke me out but otherwise I am unsure of products or ingredients that irritate my skin.',
    'I have the following link for Atobarrier 365:',
    'I stopped using the AtoBarrier after a week because it pilled.',
    'Cetaphil is my face wash.',
    'I have a weird little spot on my cheek that keeps flaking.',
  ],
  recordedDecisions: [],
  plan: null,
  knownProducts: ['AESTURA AtoBarrier365 Cream', 'Cetaphil Daily Facial Cleanser'],
}
const v = (over = {}) => ({
  products_mentioned: [], using_claims: [], asserted_facts: [], promises: [], pressure: [],
  medical_reassurance: [], contradicted_decisions: [], routine_changes: [], verdict: 'pass', ...over,
})

test('reviewer drafts all block: question premise, stopped-context quote, life fact, symptom, promise, reassurance', async () => {
  const { enforceGuard } = await loadGuard()
  const cases = [
    ['Anua question (premise of current use, quote says it broke her out)', "How's the Anua oil cleanser treating you these days?",
      v({ products_mentioned: ['Anua Oil Cleanser'], using_claims: [{ product: 'Anua Oil Cleanser', user_quote: 'The Anua Oil Cleanser broke me out', quote_stance: 'negative' }], verdict: 'block' })],
    ['"using the AtoBarrier" is a substring of "I stopped using the AtoBarrier" (lenient reader says pass)', 'Hope the AtoBarrier is still treating you well!',
      v({ products_mentioned: ['AtoBarrier'], using_claims: [{ product: 'AtoBarrier', user_quote: 'using the AtoBarrier', quote_stance: 'establishes_current_use' }] })],
    ['wedding (life fact never said)', 'With the wedding coming up, let us keep your barrier calm.',
      v({ asserted_facts: [{ fact: 'she has an upcoming wedding', user_quote: '' }], verdict: 'block' })],
    ['wedding with a fabricated quote (lenient reader says pass)', 'With the wedding coming up, let us keep your barrier calm.',
      v({ asserted_facts: [{ fact: 'wedding', user_quote: 'my wedding is next month' }] })],
    ['redness resolved (symptom change never said)', 'So glad the redness has calmed down this week.',
      v({ asserted_facts: [{ fact: 'redness calmed down', user_quote: '' }], verdict: 'block' })],
    ['"your plan includes" (capability promise)', 'Your plan includes a monthly dermatologist photo review, so send me one.',
      v({ promises: ['plan includes a monthly dermatologist photo review'] })],
    ['"that spot sounds harmless" (medical reassurance)', 'That spot on your cheek sounds harmless, nothing to worry about.',
      v({ medical_reassurance: ['the spot is harmless'] })],
  ]
  for (const [name, message, verifier] of cases) {
    assert.equal(enforceGuard(verifier, CAROLINE, message).pass, false, `must block: ${name}`)
  }
})

test('a real quote whose stance is not current use blocks even when the reader says pass', async () => {
  const { enforceGuard } = await loadGuard()
  for (const stance of ['negative', 'past_or_stopped', 'intent_only', undefined]) {
    const r = enforceGuard(
      v({ products_mentioned: ['Anua Oil Cleanser'], using_claims: [{ product: 'Anua Oil Cleanser', user_quote: 'The Anua Oil Cleanser broke me out', quote_stance: stance }] }),
      CAROLINE,
      "How's the Anua oil cleanser treating you these days?"
    )
    assert.equal(r.pass, false, `stance ${stance} must not support a usage claim`)
  }
})

test('a correct draft passes the guard (so a guard that blocks everything fails this test)', async () => {
  const { enforceGuard } = await loadGuard()
  const message = 'Has the stinging eased at all since you put the Naturium away? And did the AtoBarrier365 arrive yet?'
  const r = enforceGuard(v({ products_mentioned: ['Naturium', 'AtoBarrier365'] }), CAROLINE, message)
  assert.deepEqual(r.reasons, [])
  assert.equal(r.pass, true)
  // A usage claim with an affirming quote in her own words also passes.
  const ok = enforceGuard(
    v({ products_mentioned: ['Cetaphil'], using_claims: [{ product: 'Cetaphil', user_quote: 'Cetaphil is my face wash', quote_stance: 'establishes_current_use' }] }),
    CAROLINE,
    'Keep the Cetaphil as your wash for now.'
  )
  assert.equal(ok.pass, true, ok.reasons.join('; '))
})

test('evidence sources: short whole-word quotes count; plan facts may cite the record, person facts may not', async () => {
  const { enforceGuard, inCorpus } = await loadGuard()
  assert.equal(inCorpus('i live in iowa now', 'iowa'), true)
  assert.equal(inCorpus('that was brash of me', 'rash'), false, 'whole words only')
  const ev = { ...CAROLINE, userMessages: [...CAROLINE.userMessages, 'Iowa'], plan: 'Barrier Repair: park actives temporarily, started 2026-10-06' }
  assert.equal(enforceGuard(v({ asserted_facts: [{ fact: 'lives in Iowa', user_quote: 'Iowa', source: 'user' }] }), ev, 'Iowa winters are coming.').pass, true)
  assert.equal(enforceGuard(v({ asserted_facts: [{ fact: 'barrier repair phase', user_quote: 'park actives temporarily', source: 'record' }] }), ev, 'Since we parked your actives...').pass, true)
  // A fact about the PERSON cannot be laundered through the record.
  assert.equal(enforceGuard(v({ asserted_facts: [{ fact: 'wedding', user_quote: 'my wedding', source: 'record' }] }), ev, 'With the wedding coming up').pass, false)
  // A quote claimed as the person's own words must be in THEIR words, not merely in the record.
  assert.equal(
    enforceGuard(v({ asserted_facts: [{ fact: 'actives parked', user_quote: 'park actives temporarily', source: 'user' }] }), ev, 'Since you parked your actives').pass,
    false
  )
})

test('a listed mention exempts only on an explicit "not asserted"; missing counts as a claim', async () => {
  const { enforceGuard } = await loadGuard()
  const msg = 'Has the stinging eased since you put the Naturium away?'
  const listed = (flag) => v({ products_mentioned: ['Naturium'], using_claims: [{ product: 'Naturium', message_asserts_current_use: flag, user_quote: '', quote_stance: 'past_or_stopped' }] })
  assert.equal(enforceGuard(listed(false), CAROLINE, msg).pass, true)
  assert.equal(enforceGuard(listed(undefined), CAROLINE, msg).pass, false, 'fail closed when the reader does not say')
  assert.equal(enforceGuard(listed(true), CAROLINE, msg).pass, false)
})

test('negatedInContext reads the same sentence only', async () => {
  const { negatedInContext } = await loadGuard()
  const corpus = 'i stopped using the atobarrier after a week. i use the cetaphil daily.'
  assert.equal(negatedInContext(corpus, 'using the atobarrier'), true)
  assert.equal(negatedInContext(corpus, 'i use the cetaphil daily'), false, 'a negation in the previous sentence does not leak')
})

test('a guard call that throws BLOCKS (fail closed), it never passes', async () => {
  const { checkProactiveDraft } = await loadGuard() // every import stubbed to throw
  const r = await checkProactiveDraft({ message: 'Has the stinging eased?', subject: 's', evidence: CAROLINE })
  assert.equal(r.pass, false)
  assert.match(r.reasons.join(' '), /fail closed/)
})

test('recordJudgment: 23505 means "already decided" (null), any other error throws, success returns the id', async () => {
  const { recordJudgment } = await loadPure(['src', 'lib', 'proactive', 'ledger.ts'])
  const fake = (result) => ({ from: () => ({ insert: () => ({ select: () => ({ single: async () => result }) }) }) })
  const decision = { decision: 'silent', signal: null, reasoning: 'r', confidence: null, subject: null, message: null, suggestedAsk: null, model: 'm' }
  const row = { audience: 'lead', campaign: 'c', decision }
  assert.equal(await recordJudgment(fake({ data: { id: 'abc' }, error: null }), row), 'abc')
  assert.equal(await recordJudgment(fake({ data: null, error: { code: '23505', message: 'dup' } }), row), null)
  await assert.rejects(() => recordJudgment(fake({ data: null, error: { code: '42501', message: 'denied' } }), row), /recordJudgment failed/)
})

test('findUnsettled actually filters: a conversation settled after its last message is not returned', async () => {
  const { findUnsettled } = await loadPure(['src', 'lib', 'intelligence', 'memory-settle.ts'])
  const now = Date.parse('2026-10-10T12:00:00Z')
  const tables = {
    ss_yuri_conversations: [
      { id: 'settled', user_id: 'u', created_at: '2026-10-01', conversation_type: 'general', summary: 's', summary_generated_at: '2026-10-09T10:00:00Z', decision_memory: {}, memory_settled_at: '2026-10-09T10:05:00Z', memory_settle_attempts: 0, memory_settle_next_at: null },
      { id: 'stale', user_id: 'u', created_at: '2026-10-02', conversation_type: 'general', summary: 's', summary_generated_at: '2026-10-09T09:00:00Z', decision_memory: {}, memory_settled_at: null, memory_settle_attempts: 0, memory_settle_next_at: null },
    ],
    ss_yuri_messages: [
      { conversation_id: 'settled', role: 'user', created_at: '2026-10-09T10:00:00Z' },
      { conversation_id: 'stale', role: 'user', created_at: '2026-10-09T10:00:00Z' },
    ],
    ss_user_profiles: [],
  }
  const query = (rows) => {
    let head = false
    let range = null
    const q = {
      select: (_c, o) => ((head = !!o?.head), q),
      in: () => q, order: () => q, or: () => q,
      range: (a, b) => ((range = [a, b]), q),
      then: (res) => res(head ? { count: rows.length, error: null } : { data: range ? rows.slice(range[0], range[1] + 1) : rows, error: null }),
    }
    return q
  }
  const db = { from: (t) => query(tables[t] ?? []) }
  const out = await findUnsettled(db, { now })
  assert.deepEqual(out.map((c) => c.id), ['stale'])
})

test('subscriber teacher: base-rate chat is not engagement; acted / sent the ask / replied on topic is', async () => {
  const { attributeSubscriberEngagement, baselineWeeklyChatRate } = await loadPure(['src', 'lib', 'proactive', 'ledger.ts'])
  const checkin = 'Four days into barrier repair: has the stinging eased, and is the evening oiliness settling?'
  const ask = "Hi Yuri, here's how the stinging has been this week"
  const base = { actedInWindow: false, suggestedAsk: ask, checkinMessage: checkin }
  const elsewhere = attributeSubscriberEngagement({ ...base, userMessagesInWindow: ['Can you find me a cheaper sunscreen for my trip?'] })
  assert.equal(elsewhere.engaged, false, 'chatting about something else is not a response to the check-in')
  assert.equal(elsewhere.chattedUnattributed, true)
  assert.equal(attributeSubscriberEngagement({ ...base, actedInWindow: true, userMessagesInWindow: [] }).attribution, 'acted')
  assert.equal(attributeSubscriberEngagement({ ...base, userMessagesInWindow: [ask + ': much better!'] }).attribution, 'ask_sent')
  assert.equal(attributeSubscriberEngagement({ ...base, userMessagesInWindow: ['The stinging stopped but the oiliness is still there by evening'] }).attribution, 'topic_reply')
  // Baseline: chatted in 2 of the 8 prior weeks.
  assert.equal(baselineWeeklyChatRate(['2026-10-08T00:00:00Z', '2026-10-07T00:00:00Z', '2026-09-20T00:00:00Z'], '2026-10-10T00:00:00Z'), 2 / 8)
})

test('check-in deep link never throws on a lone surrogate', async () => {
  const { checkinDeepLink } = await loadPure(['src', 'lib', 'proactive', 'run.ts'])
  assert.doesNotThrow(() => checkinDeepLink('stinging update \uD83D'))
  assert.match(checkinDeepLink(null), /^\/yuri\?ask=Picking/)
  // The judgment row is recorded BEFORE the link is built (anything that can throw comes after).
  const run = read('src', 'lib', 'proactive', 'run.ts')
  assert.ok(run.indexOf("const judgmentId = await recordJudgment(db, {\n            audience: 'subscriber'") < run.indexOf('const deepLink = checkinDeepLink(decision.suggestedAsk)\n          const { data: nudge'))
})

test('no raw content .slice in src/lib/proactive (ids, dates and arrays excepted)', () => {
  const allowed = /(?:_id|Id|\.id|_at\??|At|rows)$/
  for (const f of ['judge.ts', 'lead-reengage.ts', 'ledger.ts', 'run.ts', 'subscriber-checkin.ts', 'content-guard.ts', 'campaign-funnel.ts']) {
    const src = read('src', 'lib', 'proactive', f)
    const raw = [...src.matchAll(/([\w.?]+)\.slice\(0, (?:\d+|[A-Z_]+)\)/g)].map((m) => m[1]).filter((n) => !allowed.test(n))
    assert.deepEqual(raw, [], `${f}: raw content slices: ${raw.join(', ')}`)
  }
})

test('timezones: the check-in cron is hourly; grading and leads run once a day', () => {
  const vercel = JSON.parse(read('vercel.json'))
  assert.equal(vercel.crons.find((c) => c.path === '/api/cron/yuri-wakes-up').schedule, '30 * * * *')
  const route = read('src', 'app', 'api', 'cron', 'yuri-wakes-up', 'route.ts')
  assert.match(route, /phases: \{ grade: daily, subscribers: true, leads: daily \}/)
})

test('migration: subscriber daily index and settle state ship as files', () => {
  assert.match(read('supabase', 'migrations', '20261009000001_proactive_judgments.sql'), /uq_proactive_checkin_daily/)
  const settle = read('supabase', 'migrations', '20261010000001_conversation_memory_settle.sql')
  for (const col of ['memory_settled_at', 'memory_settle_attempts', 'memory_settle_next_at', 'memory_settle_last_error']) {
    assert.match(settle, new RegExp(`ADD COLUMN IF NOT EXISTS ${col}`))
  }
})

// ---------------------------------------------------------------------------
// 14. Re-review fixes (Oct 10 2026)
// ---------------------------------------------------------------------------

test('B1: the conversation trigger treats exactly the memory bookkeeping columns as non-activity', () => {
  const sql = read('supabase', 'migrations', '20261010000002_conversation_updated_at_activity_only.sql')
  const list = sql.match(/bookkeeping text\[\] := ARRAY\[([\s\S]*?)\];/)
  assert.ok(list, 'bookkeeping list must exist')
  const cols = [...list[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  // Every column the settle job / extractors / learning job write must be in it...
  const settleSrc = read('src', 'lib', 'intelligence', 'memory-settle.ts')
  const settleCols = [...new Set([...settleSrc.matchAll(/\b(memory_settle[a-z_]*|memory_settled_at)\b(?=:)/g)].map((m) => m[1]))]
  for (const c of [...settleCols, 'summary', 'summary_generated_at', 'next_session_opener', 'decision_memory', 'truncation_summary', 'truncation_summary_msg_count', 'learning_contributed', 'updated_at']) {
    assert.ok(cols.includes(c), `bookkeeping list is missing ${c}`)
  }
  // ...and no activity column may be in it, or a real message/rename would stop bumping.
  for (const activity of ['title', 'message_count', 'user_id', 'conversation_type', 'specialist_type']) {
    assert.ok(!cols.includes(activity), `${activity} is activity, not bookkeeping`)
  }
  assert.match(sql, /IF NEW\.updated_at IS NOT DISTINCT FROM OLD\.updated_at THEN\s+NEW\.updated_at := OLD\.updated_at;/)
  assert.match(sql, /BEFORE UPDATE ON public\.ss_yuri_conversations/)
  // A post-apply check that proves it on the live table (inside a ROLLBACK).
  const check = read('scripts', 'sql', 'check-conversation-updated-at.sql')
  assert.match(check, /ROLLBACK;\s*$/)
})

test('re-emitting a soft-closed topic does not reopen it; an evidence-checked reopening does', async () => {
  const { mergeDecisionMemory, isOpenLoop, applyLoopChanges } = await loadPure(['src', 'lib', 'yuri', 'memory.ts'], MEM_IMPLS)
  const closed = dm([loop('pm_routine_build', { resolved_at: '2026-07-23', resolved_by_conversation: 'c2', resolved_reason: 'built' })])
  const reemitted = dm([loop('pm_routine_build')])
  // Fresh extraction path (reopenings passed, empty): stays closed.
  const kept = mergeDecisionMemory(closed, reemitted, [], 'c3', undefined, [])
  assert.equal(isOpenLoop(kept.open_loops[0]), false, 'bare re-emission must not clear the stamps')
  // With evidence: reopens.
  const reopened = mergeDecisionMemory(closed, dm([]), [], 'c3', undefined, [resolution('pm_routine_build')])
  assert.equal(isOpenLoop(reopened.open_loops[0]), true)
  // Cross-conversation reopen.
  assert.equal(isOpenLoop(applyLoopChanges(closed, [], [resolution('pm_routine_build')]).open_loops[0]), true)
  // Loader path (reopenings omitted): a newer conversation's own open loop still stands.
  assert.equal(isOpenLoop(mergeDecisionMemory(closed, reemitted).open_loops[0]), true)
  // The extractor is shown closed loops with date / conversation / reason and must cite evidence to reopen.
  const src = read('src', 'lib', 'yuri', 'memory.ts')
  assert.match(src, /These were CLOSED earlier/)
  assert.match(src, /"reopened_open_loops": \[\{ "topic"/)
  assert.match(src, /const reopenings = validateResolutions\(\s*extracted\.reopened_open_loops/)
})

test('migration-absent: settleStateMigrated reports false and the live route refuses with one run row', async () => {
  const { settleStateMigrated } = await loadPure(['src', 'lib', 'intelligence', 'memory-settle.ts'])
  const fake = ({ colErr = null, rpcErr = null }) => ({
    from: () => ({ select: () => ({ limit: async () => ({ error: colErr }) }) }),
    rpc: async () => ({ error: rpcErr }),
  })
  assert.equal(await settleStateMigrated(fake({})), true)
  assert.equal(await settleStateMigrated(fake({ colErr: { code: '42703', message: 'column ss_yuri_conversations.memory_settled_at does not exist' } })), false)
  assert.equal(await settleStateMigrated(fake({ rpcErr: { code: 'PGRST202', message: 'Could not find the function ss_conversation_activity_trigger_version' } })), false)
  await assert.rejects(() => settleStateMigrated(fake({ colErr: { code: '57014', message: 'timeout' } })), /settle-state check failed/)
  const route = read('src', 'app', 'api', 'cron', 'settle-memory', 'route.ts')
  assert.ok(route.indexOf('settleStateMigrated(db)') < route.indexOf('findUnsettled(db)'), 'refuse BEFORE any work')
  assert.match(read('scripts', 'backfill-memory-settle.ts'), /if \(apply && !\(await settleStateMigrated\(db\)\)\)/)
})

test('teacher: generic skincare words shared with the check-in are not a topic reply', async () => {
  const { attributeSubscriberEngagement } = await loadPure(['src', 'lib', 'proactive', 'ledger.ts'])
  const r = attributeSubscriberEngagement({
    actedInWindow: false,
    suggestedAsk: null,
    checkinMessage: 'How is your routine feeling with the cream at night this week?',
    userMessagesInWindow: ['Can you recommend a routine with a lighter cream for night?'],
  })
  assert.equal(r.engaged, false, 'routine/cream/night are generic, not the check-in topic')
})

test('off mode logs one run row a day, not hourly', () => {
  const route = read('src', 'app', 'api', 'cron', 'yuri-wakes-up', 'route.ts')
  assert.match(route, /if \(mode === 'off'\) \{[\s\S]{0,300}if \(new Date\(\)\.getUTCHours\(\) !== DAILY_PHASE_UTC_HOUR\) \{\s*return NextResponse\.json/)
})

test('every paid plan reaches check-ins: no plan-name prefix filters (Oct 31 2026)', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs')
  const { join } = await import('node:path')
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
  // The $9.99 plan is 'monthly'; a "pro%" filter silently drops every new member.
  const offenders = walk('src').filter((f) => /\.(ts|tsx)$/.test(f) && /like\(\s*'plan'\s*,\s*'pro%'\s*\)/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [], `plan filtered by name prefix in: ${offenders.join(', ')}`)
  const pricing = readFileSync('src/lib/pricing.ts', 'utf8')
  assert.match(pricing, /PAID_PLAN_KEYS = \['monthly', 'pro_monthly'\]/)
})
