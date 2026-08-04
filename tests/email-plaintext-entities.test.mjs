/**
 * Guard test — the plain-text part of an email must not leak HTML entities.
 *
 * THE DEFECT (Aug 3 2026, caught in a dry run before any send)
 *
 * Every email built by this app escapes its body, then send.ts derives the
 * plain-text alternative from that escaped HTML. htmlToPlainText decoded only
 * &nbsp; &amp; &lt; &gt; — it did NOT decode &#39; or &quot;. So an apostrophe,
 * which appears in nearly every sentence Yuri writes ("there's", "you're",
 * "I'll"), reached the text/plain part as a literal "&#39;":
 *
 *   "Been thinking about your routine, and there&#39;s still that one blank spot"
 *
 * This is invisible in any HTML preview and invisible to anyone testing in a
 * rich mail client. It shows up for plain-text readers, accessibility tooling,
 * and notification previews — and it reads as broken software from a product
 * whose entire pitch is care and attention.
 *
 * It affected ALL senders (guardian alerts, new-subscriber alerts, nurture,
 * lead recaps, nudges), not just the one that surfaced it.
 *
 * ORDERING MATTERS: &amp; must be decoded LAST. Decoding it first turns the
 * escaped sequence "&amp;lt;" into "&lt;" and then into "<", resurrecting the
 * markup the escaping existed to neutralize.
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
 * htmlToPlainText is module-private, so lift it out with its export stripped
 * and exercise the REAL implementation rather than a copy.
 */
async function loadPlainText() {
  const src = readFileSync(join(root, 'src', 'lib', 'email', 'send.ts'), 'utf8')

  const start = src.indexOf('function htmlToPlainText')
  assert.ok(start > -1, 'htmlToPlainText must exist in send.ts')
  const end = src.indexOf('\n}', start)
  assert.ok(end > start, 'could not bound htmlToPlainText')

  const fn = 'export ' + src.slice(start, end + 2)
  const js = ts.transpileModule(fn, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText

  const dir = mkdtempSync(join(tmpdir(), 'email-plain-'))
  const file = join(dir, 'plain.mjs')
  writeFileSync(file, js)
  return (await import(pathToFileURL(file).href)).htmlToPlainText
}

/** Mirrors src/lib/email/html.ts — what every builder runs on interpolated text. */
const escapeHtml = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

test('an apostrophe survives escape -> plaintext as an apostrophe', async () => {
  const htmlToPlainText = await loadPlainText()

  const original = "Been thinking about your routine, and there's still one blank spot."
  const plain = htmlToPlainText(`<p>${escapeHtml(original)}</p>`)

  assert.ok(!plain.includes('&#39;'), `leaked entity in: ${plain}`)
  assert.equal(plain, original, 'the round trip must return the original sentence')
})

test('quotes, angle brackets and ampersands all round-trip', async () => {
  const htmlToPlainText = await loadPlainText()

  const cases = [
    `She said "that's the one" & meant it`,
    "Yuri's pick: Beauty of Joseon's relief sun",
    'Ingredients: water & glycerin',
    "It's 5 < 10 and 10 > 5",
  ]

  for (const original of cases) {
    const plain = htmlToPlainText(`<p>${escapeHtml(original)}</p>`)
    assert.equal(plain, original, `round trip failed for: ${original}`)
  }
})

test('no HTML entity survives into the plain-text output', async () => {
  const htmlToPlainText = await loadPlainText()

  const body = escapeHtml(`Don't miss it — "the barrier's" fine & <safe>`)
  const plain = htmlToPlainText(`<p>${body}</p>`)

  assert.ok(
    !/&(?:#\d+|amp|lt|gt|quot|apos|nbsp);/.test(plain),
    `plain text still contains an entity: ${plain}`
  )
})

test('escaped markup is NOT resurrected into live markup', async () => {
  const htmlToPlainText = await loadPlainText()

  // The user literally typed "&lt;" — after escaping that is "&amp;lt;".
  // Decoding &amp; before &lt; would turn it back into a real "<".
  const original = 'type &lt; to open the tag'
  const plain = htmlToPlainText(`<p>${escapeHtml(original)}</p>`)

  assert.equal(plain, original, '&amp; must decode LAST or escaped markup revives')
  assert.ok(!plain.includes('<'), 'a literal < must never appear from double-decoding')
})

test('a real anchor still renders as "text (url)"', async () => {
  const htmlToPlainText = await loadPlainText()

  const plain = htmlToPlainText(
    `<p>Hi</p><p><a href="https://www.seoulsister.com/yuri?a=1&amp;b=2" style="color:#000;">Pick this up</a></p>`
  )
  assert.match(plain, /Pick this up \(https:\/\/www\.seoulsister\.com\/yuri\?a=1&b=2\)/)
})
