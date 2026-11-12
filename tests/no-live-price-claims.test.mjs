/**
 * Nothing Yuri is told may call a price live, current or today's (Nov 11 2026).
 *
 * Stored prices are not live: 215 of 5,222 price rows had been checked in the
 * previous week when this was written. Both chat prompts scripted the line
 * "Want me to pull live prices on any of these?", and Yuri said "live prices"
 * or "live pricing" in 66 of 609 free-chat replies and 8 of 520 member replies.
 *
 * This checks the SHAPE (a freshness word beside a price word in one sentence)
 * across every prompt and tool description, not a list of phrases. Price AGE is
 * a separate matter and is given to her as a fact with the tool result
 * (src/lib/yuri/price-freshness.ts); nothing here asks her to caveat prices.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const FRESH = /\b(live|real[- ]?time|current|today'?s|up[- ]to[- ]date|latest)\b/i
const PRICE = /\bpric(e|es|ed|ing)\b|\bquotes?\b/i
// Sentences that use both words to say the OPPOSITE, or about something else. Exact, and few.
const ALLOWED = new Set([
  // The shop's own price on the day they look, checked by them: not a claim about ours.
  "Give the name of the shop and let them check today's price there.",
])

function sentences(text) {
  return text.split(/(?<=[.!?:])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
}
// The freshness word has to be ABOUT the price: directly before it, give or take two words
// ("live prices", "today's Olive Young price", "current retail pricing"). A long sentence that
// mentions live weather and, elsewhere, retailer pricing is not a claim about prices.
const CLAIM = new RegExp(`${FRESH.source}\\s+(?:[\\w'&-]+\\s+){0,2}(?:${PRICE.source})`, 'i')
function offenders(text) {
  return sentences(text).filter((s) => CLAIM.test(s) && !ALLOWED.has(s))
}
function templateAfter(src, marker) {
  const a = src.indexOf(marker)
  assert.ok(a > -1, marker)
  const start = src.indexOf('`', a) + 1
  let i = start
  for (; i < src.length; i++) if (src[i] === '`' && src[i - 1] !== '\\') break
  return src.slice(start, i)
}

const widget = templateAfter(read('src/app/api/widget/chat/route.ts'), 'const YURI_WIDGET_SYSTEM')
const member = templateAfter(read('src/lib/yuri/advisor.ts'), 'const YURI_SYSTEM_PROMPT = ')
const specialists = read('src/lib/yuri/specialists.ts')
const tools = read('src/lib/yuri/tools.ts')
const grounding = read('src/lib/widget/tool-grounding.ts')

test('the texts being checked are the real ones', () => {
  assert.ok(widget.length > 15000 && /Yuri/.test(widget), 'widget prompt not found')
  assert.ok(member.length > 20000 && /save_routine/.test(member), 'member prompt not found')
  assert.ok((specialists.match(/systemPrompt:/g) ?? []).length >= 6)
})

test('no prompt, specialist mode, tool description or grounding note calls a price live, current or today\'s', () => {
  const toolDescriptions = [...tools.matchAll(/description:\s*\n?\s*((?:'(?:[^'\\]|\\.)*'\s*\+?\s*)+)/g)].map((m) => m[1]).join('\n')
  assert.ok(toolDescriptions.length > 3000, 'tool descriptions not found')
  const specialistPrompts = [...specialists.matchAll(/systemPrompt:\s*`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1]).join('\n')
  assert.ok(specialistPrompts.length > 3000, 'specialist prompts not found')
  const groundingText = [...grounding.matchAll(/`((?:[^`\\]|\\.){200,})`/g)].map((m) => m[1]).join('\n')
  for (const [name, text] of [['widget prompt', widget], ['member prompt', member], ['specialist modes', specialistPrompts], ['tool descriptions', toolDescriptions], ['tool-grounding notes', groundingText]]) {
    assert.deepEqual(offenders(text), [], `${name} pairs a freshness word with a price`)
  }
})

test('the check itself catches the phrases that were there', () => {
  for (const was of [
    'then offer: "Want me to pull live prices on any of these?"',
    'a specific pick when one is needed (live pricing when your tools return it).',
    "Get today's price from your tools before quoting one.",
    'so a search grounds those with live pricing and returns nothing at all for Western ones.',
    'I can give you the current price at Olive Young.',
    'Here is an up-to-date quote.',
  ]) assert.equal(offenders(was).length, 1, was)
  // And does not fire on freshness words that are not about prices, or prices with no freshness claim.
  for (const fine of ['You have retailer pricing, trend data, web search and live weather.', "You can't know today's duty rate, so don't quote a percentage.", 'Use the live weather for their city.', 'Want me to pull the prices we have on any of these?', 'Real-time UV index matters for SPF.', 'Only quote a dollar amount that came back from a tool.']) {
    assert.deepEqual(offenders(fine), [], fine)
  }
})

test('the site description promises warning signs, not a verdict', () => {
  const layout = read('src/app/layout.tsx')
  assert.equal((layout.match(/spot counterfeit warning signs/g) ?? []).length, 3)
  assert.doesNotMatch(layout, /detect counterfeits|check authenticity|verify authenticity|guarantee/i)
})
