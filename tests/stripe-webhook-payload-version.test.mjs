/**
 * Guard test — Stripe webhook payloads arrive at the ENDPOINT's API version.
 *
 * Every customer.subscription.updated event from launch to Oct 5 2026 was
 * acknowledged and dropped. The payloads (stored in ss_subscription_events)
 * carry no top-level current_period_start/end — those moved onto the
 * subscription item — so `new Date(undefined * 1000).toISOString()` threw,
 * a catch returned 200, and Stripe never retried. A subscriber renewed on
 * Aug 21 and Sep 21 while our row still said her period ended Aug 21.
 *
 * The fixtures below mirror the shape of the real stored events. These
 * EXECUTE the transpiled helper; the last test pins the webhook to it.
 *
 * Run: `npm test`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

async function load(rel) {
  const js = ts.transpileModule(readFileSync(join(root, rel), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

const { subscriptionPeriod, invoiceSubscriptionId } = await load('src/lib/stripe-payload.ts')

// Shape of evt_1UI9xsE3bY1JvxExkEzN3kBS (Sep 21 2026 renewal)
const currentShapeSub = {
  id: 'sub_x',
  status: 'active',
  metadata: { user_id: 'u' },
  items: { data: [{ current_period_start: 1790007618, current_period_end: 1792599618 }] },
}

test('reads the billing period from the item when top-level fields are absent', () => {
  const p = subscriptionPeriod(currentShapeSub)
  assert.ok(p, 'returned null for the payload shape Stripe actually sends us')
  assert.equal(p.end, new Date(1792599618 * 1000).toISOString())
  assert.equal(p.start, new Date(1790007618 * 1000).toISOString())
})

test('still reads the legacy top-level shape (pinned-client retrieve)', () => {
  const p = subscriptionPeriod({ current_period_start: 100, current_period_end: 200, items: { data: [] } })
  assert.equal(p.end, new Date(200 * 1000).toISOString())
})

test('returns null rather than throwing or inventing a date when no period exists', () => {
  assert.equal(subscriptionPeriod({ items: { data: [] } }), null)
  assert.equal(subscriptionPeriod({ current_period_end: 'soon' }), null)
  assert.equal(subscriptionPeriod(null), null)
})

test('finds an invoice subscription id in both shapes', () => {
  assert.equal(
    invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_new' } } }),
    'sub_new'
  )
  assert.equal(invoiceSubscriptionId({ subscription: 'sub_old' }), 'sub_old')
  assert.equal(invoiceSubscriptionId({ subscription: { id: 'sub_obj' } }), 'sub_obj')
  assert.equal(invoiceSubscriptionId({}), null)
})

test('webhook no longer reads the removed top-level fields and no longer 200s a failure', () => {
  const src = readFileSync(join(root, 'src/app/api/stripe/webhook/route.ts'), 'utf8')
  assert.ok(
    !/subscription\.current_period_(start|end)\s*\*/.test(src),
    'webhook reads subscription.current_period_* directly — that is undefined on our endpoint version'
  )
  assert.equal((src.match(/subscriptionPeriod\(subscription\)/g) || []).length, 2,
    'both the checkout and subscription.updated paths must read the period through the helper')
  const catchBlock = src.slice(src.lastIndexOf('} catch (err) {'))
  assert.ok(/status:\s*500/.test(catchBlock),
    'handler failures must return 500 so Stripe retries; a 200 silently drops the event')
  assert.ok(/\.delete\(\)[\s\S]*stripe_event_id/.test(catchBlock),
    'the failed event must be un-logged or the idempotency check will skip the retry')
})
