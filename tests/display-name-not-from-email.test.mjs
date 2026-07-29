/**
 * Guard test — a person's name must never be inferred from their email address.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Bailey, July 29 2026, about to screen-record the app for TikTok:
 *   "can you please change the username to baileyydonn to match TikTok. I don't
 *    need everyone knowing EVERYTHING 😂"
 *   "Even tho they'll figure it out... I want consistency"
 *
 * Her dashboard read "Good evening, baileydonmartin". Nobody had ever typed that
 * value. THREE surfaces fell back to `email.split('@')[0]` when no name was on
 * file, so ANY user whose address is firstnamelastname@provider had their full
 * legal name rendered on screen — and for a public creator, into a video.
 *
 * The Yuri welcome endpoint was the worst of the three: it also CAPITALIZED the
 * local-part, so a guess was presented formatted as a fact ("Baileydonmartin").
 * That is the v10.2.1 fake-confidence class applied to identity.
 *
 * The codebase had ALREADY written this rule for itself. The onboarding
 * extraction prompt says: "NEVER infer a name from their email address, and
 * never guess. If they didn't say it, omit it." The AI path honoured it; the UI
 * and the API did not. These tests bind all surfaces to the same rule.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const dashSrc = read('src', 'app', '(app)', 'dashboard', 'page.tsx')
const profileSrc = read('src', 'app', '(app)', 'profile', 'page.tsx')
const welcomeSrc = read('src', 'app', 'api', 'yuri', 'welcome-context', 'route.ts')
const editorSrc = read('src', 'components', 'profile', 'DisplayNameEditor.tsx')
const onboardingSrc = read('src', 'lib', 'yuri', 'onboarding.ts')

// ---------------------------------------------------------------------------
// No surface may derive a name from the email address
// ---------------------------------------------------------------------------

const SURFACES = [
  ['dashboard greeting', dashSrc],
  ['profile page', profileSrc],
  ['yuri welcome-context API', welcomeSrc],
]

/**
 * Strip comments before asserting. The fix documents the old bug in prose
 * ("this used to fall through to `email.split('@')[0]`"), and a naive whole-file
 * regex flags that explanation as the defect itself — it failed on the corrected
 * file. The rule is about executable code, so the test must look at code.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '')

for (const [label, src] of SURFACES) {
  test(`${label} never splits the email to make a name`, () => {
    assert.doesNotMatch(
      stripComments(src),
      /email[?.]*\.split\('@'\)/,
      `${label}: reintroduced the email-derived name. Bailey's legal name was ` +
        'printed on her dashboard this way, while she was recording for TikTok.'
    )
  })
}

test('the welcome API no longer capitalizes an email local-part', () => {
  // Capitalizing made it worse: it dressed a guess up as a real name.
  assert.doesNotMatch(
    welcomeSrc,
    /charAt\(0\)\.toUpperCase\(\) \+ cleaned\.slice/,
    'Reintroduced the capitalized email guess ("Baileydonmartin") — a fabricated ' +
      'name formatted to look like a stated one.'
  )
})

// ---------------------------------------------------------------------------
// The replacement must read the user's own chosen value
// ---------------------------------------------------------------------------

test('every surface prefers display_name, then first_name', () => {
  for (const [label, src] of SURFACES) {
    assert.match(
      src,
      /display_name/,
      `${label}: must read the name the user actually chose.`
    )
    assert.match(
      src,
      /first_name/,
      `${label}: must fall back to a volunteered first_name before giving up.`
    )
  }
})

test('the dashboard degrades to a neutral greeting, not a guess', () => {
  // A null name must render "Welcome to Seoul Sister", never an invented one.
  assert.match(
    dashSrc,
    /displayName \? \(/,
    'The greeting must branch on a null name.'
  )
  assert.match(
    dashSrc,
    /Welcome to/,
    'Lost the neutral greeting — a missing name must not become a guessed one.'
  )
})

test('display_name is selected from the database, not just referenced', () => {
  // Reading the column in a comment is not reading it in a query.
  assert.match(
    profileSrc,
    /\.select\('display_name, first_name,/,
    'The profile query must actually SELECT display_name, or it is always null.'
  )
  assert.match(
    welcomeSrc,
    /\.select\('display_name, first_name'\)/,
    'The welcome endpoint must SELECT the name columns.'
  )
})

// ---------------------------------------------------------------------------
// The user must be able to change it without a developer
// ---------------------------------------------------------------------------

test('the profile page renders the display-name editor', () => {
  assert.match(
    profileSrc,
    /<DisplayNameEditor/,
    'Bailey should not need a code change to rename herself — her handle IS her ' +
      'brand and she will change it again.'
  )
})

test('the editor writes display_name and never touches first_name', () => {
  // first_name is what Yuri calls her conversationally and is only captured when
  // volunteered. A public handle and a spoken name are different consents.
  assert.match(editorSrc, /update\(\{ display_name: next \}\)/, 'Must write display_name.')
  assert.doesNotMatch(
    editorSrc,
    /first_name:/,
    'The editor must NOT overwrite first_name — that field is Yuri-facing and ' +
      'governed by the volunteered-only rule.'
  )
})

test('clearing the field stores NULL, not an empty string', () => {
  // An empty string would render as a blank gold gap in the heading.
  assert.match(
    editorSrc,
    /trimmed\.length === 0 \? null : trimmed/,
    'Empty input must clear to NULL so the neutral greeting takes over.'
  )
})

test('a failed save is surfaced, not swallowed', () => {
  assert.match(
    editorSrc,
    /console\.error\(/,
    'A silent failure here reads to the user as the app ignoring her.'
  )
})

// ---------------------------------------------------------------------------
// The rule the codebase already wrote for itself
// ---------------------------------------------------------------------------

test('the onboarding prompt still forbids inferring a name from email', () => {
  // This rule predates the bug and is the reason the AI path was already correct.
  // If it is ever deleted, the UI fallbacks tend to creep back.
  assert.match(
    onboardingSrc,
    /NEVER infer a name from their email address/,
    'Lost the extraction rule that kept Yuri honest about names.'
  )
})
