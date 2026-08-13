/**
 * Guard test — the subscriber-surface fact.
 *
 * THE DEFECT (Aug 13 2026, visitor 1ce3b6ce). Across a 53-minute, 12-message
 * conversation Yuri named the subscriber side five times and reached for the
 * SAME capability every time — "a mode that scans your lineup
 * ingredient-by-ingredient." Counted in the widget prompt at the time:
 * "remember"/memory 14 mentions, conflict-checking 4, "specialist" 4 — with the
 * six specialists NEVER NAMED, and proactive check-ins, weather-adaptive
 * alerts, cycle awareness and progress tracking appearing ZERO times.
 *
 * The visitor was in her fifties with rosacea, starting azelaic acid, and had
 * just been told to watch it for 2-3 weeks. Seoul Sister genuinely checks back
 * unprompted at exactly that moment (`ss_user_nudges`: 9 rows, 4 acted on).
 * Nobody told her, because Yuri did not know it existed. A missing fact, not a
 * judgment failure — the same class as the email ask and the cumulative give.
 *
 * WHY THIS IS A FACT AND NOT A SCRIPT. The block is a menu of things that are
 * TRUE. It names no moment to use them, ranks nothing, rotates nothing, and
 * ends by handing selection back. The one tripwire forbids reciting the list,
 * because a feature rundown is exactly the ad-shaped output that the trust
 * research says destroys the moat this product runs on.
 *
 * THE STANDING RISK this test exists to catch: a block that promises
 * capabilities we do not ship is worse than the silence it replaced — it turns
 * a trust asset into a liability the moment someone pays. So every capability
 * named is asserted to exist in the codebase below.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const MODULE = join(root, 'src', 'lib', 'widget', 'subscriber-surface.ts')
const ROUTE = join(root, 'src', 'app', 'api', 'widget', 'chat', 'route.ts')

const moduleSrc = readFileSync(MODULE, 'utf8')
const routeSrc = readFileSync(ROUTE, 'utf8')

/** The literal text of the injected block. */
function block() {
  const open = moduleSrc.indexOf('return `')
  assert.ok(open > -1, 'buildSubscriberSurfaceBlock must return a template literal')
  const start = open + 'return `'.length
  const end = moduleSrc.indexOf('`\n}', start)
  assert.ok(end > start, 'could not find the end of the returned template literal')
  return moduleSrc.slice(start, end)
}

test('every capability named is one we actually ship', () => {
  const b = block()

  // Six specialists — must exist by name in the specialist definitions.
  const specialists = readFileSync(join(root, 'src', 'lib', 'yuri', 'specialists.ts'), 'utf8')
  for (const name of [
    'Ingredient Analyst',
    'Routine Architect',
    'Sensitivity Guardian',
    'Authenticity Investigator',
    'Budget Optimizer',
    'Trend Scout',
  ]) {
    assert.match(b, new RegExp(name), `the block must name ${name}`)
    assert.match(
      specialists,
      new RegExp(`name: '${name}'`),
      `${name} is named to visitors but does not exist in specialists.ts — ` +
        'a fact block that promises a capability we do not ship is a liability, not an asset'
    )
  }

  // Conflict-checking against a saved lineup.
  const tools = readFileSync(join(root, 'src', 'lib', 'yuri', 'tools.ts'), 'utf8')
  assert.match(tools, /check_ingredient_conflicts/)
  // Weather adaptation.
  assert.match(tools, /get_current_weather/)
})

test('the proactive check-in is claimed only because it demonstrably runs', () => {
  const b = block()
  assert.match(b, /check back on your own/i, 'the capability that fit this visitor must be named')

  // It is only honest to claim this because the cron and table exist.
  const nudgeCron = readFileSync(
    join(root, 'src', 'app', 'api', 'cron', 'proactive-nudge', 'route.ts'),
    'utf8'
  )
  assert.match(
    nudgeCron,
    /ss_user_nudges/,
    'the proactive check-in is claimed to visitors — the cron that produces it must exist'
  )
})

test('it is a menu, not a script: no timing, no ranking, no rotation', () => {
  const b = block()

  assert.doesNotMatch(b, /you must (say|mention)|say exactly|always mention|use this phrasing/i)
  assert.doesNotMatch(b, /\bin your (closing|final|last) message\b/i, 'must not bind to a moment')
  assert.doesNotMatch(b, /most (important|effective|compelling)|best feature|lead with/i, 'must not rank')
  assert.doesNotMatch(
    b,
    /already (used|mentioned)|rotate|instead of the one you/i,
    'must not become a rotation engine — that is a classifier of her judgment'
  )
})

test('it hands selection back and permits saying nothing', () => {
  const b = block()
  assert.match(b, /if anything does/i, 'mentioning nothing must be an explicitly allowed outcome')
  assert.match(
    b,
    /saying nothing is the right call/i,
    'the block must not create pressure to always name something'
  )
  assert.match(
    b,
    /changes nothing about when, or whether, to say it/i,
    'the decision must be handed back explicitly, as with every other fact block'
  )
})

test('the one tripwire forbids reciting a feature list', () => {
  const b = block()
  assert.match(b, /Do not recite this as a list/i)
  assert.match(
    b,
    /reads as an ad/i,
    'the reason must be recorded — a future editor who sees only the rule will soften it'
  )
})

test('it contains no sales language and no price', () => {
  const b = block()
  assert.doesNotMatch(b, /\$\d/, 'no price — the UI card owns that register')
  assert.doesNotMatch(b, /\bsign up now\b|\bupgrade now\b|\bdon'?t miss\b|\blimited time\b/i)
  assert.doesNotMatch(b, /\bconvert\b|\bconversion\b|\bupsell\b/i, 'no funnel vocabulary in her prompt')
})

test('the real failure is recorded so the reasoning survives a reword', () => {
  assert.match(
    moduleSrc,
    /ingredient-by-ingredient/,
    'the repeated phrase must be quoted — abstract advice gets smoothed away'
  )
  assert.match(moduleSrc, /1ce3b6ce/, 'the visitor row must be named so the claim stays checkable')
  assert.match(
    moduleSrc,
    /ZERO times/,
    'the measured absence is the whole justification and must not be lost'
  )
})

test('the block is injected into the UNCACHED per-turn context', () => {
  assert.match(routeSrc, /dynamicContext \+= buildSubscriberSurfaceBlock\(\)/)

  // The cached block must remain the static system prompt ALONE. Appending
  // per-turn text to it silently kills the prompt cache (v11.1.0 regression).
  const cachedLine = routeSrc.match(/text: YURI_WIDGET_SYSTEM[^\n]*cache_control[^\n]*/)
  assert.ok(cachedLine, 'the cached system block must exist')
  assert.doesNotMatch(
    cachedLine[0],
    /buildSubscriberSurfaceBlock|subscriberSurface/,
    'the surface block must NEVER be appended to the cached system prompt'
  )
})

test('it is static — it inspects nothing about the conversation', () => {
  const sig = moduleSrc.match(/export function buildSubscriberSurfaceBlock\(([^)]*)\)/)
  assert.ok(sig, 'the builder must be exported')
  assert.equal(
    sig[1].trim(),
    '',
    'the builder must take NO arguments. A version that scored which capability ' +
      '"fits best" was built and discarded: choosing what this person needs is ' +
      'Yuri\'s job, and a keyword classifier doing it would be the Yuri Sole ' +
      'Authority Principle violated inside her own prompt.'
  )
})
