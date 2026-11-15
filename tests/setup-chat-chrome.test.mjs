/**
 * What surrounds the setup chat (`/onboarding`).
 *
 * Nov 15 2026, Bailey, testing a new account:
 *  - A pulsing dot labelled "Listening" sat in the chat header. It was a fixed
 *    decoration from February with nothing behind it, and it looks like a live
 *    microphone indicator on the first screen after sign-up.
 *  - The member menu was shown above the chat, but every page it links to is
 *    closed until setup is finished, so a tap flashed and bounced back.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('the setup chat shows no status indicator of any kind', () => {
  const raw = read('src', 'app', '(app)', 'onboarding', 'page.tsx')
  // The chat header only: the loading screen ("Yuri is getting ready...")
  // pulses while the page loads, which is a real state.
  const start = raw.indexOf('{/* Header */}')
  const end = raw.indexOf('{/* Messages */}', start)
  assert.ok(start > 0 && end > start, 'chat header markers moved')
  const header = code(raw.slice(start, end))
  assert.ok(header.includes('Meet Yuri'), 'this is not the chat header')
  // The shape, not the word: nothing that pulses, and no text besides the
  // title and subtitle (so no status label under any wording).
  assert.doesNotMatch(header, /animate-/)
  const text = [...header.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter(Boolean)
  assert.deepEqual(text, ['Meet Yuri', 'Your AI K-beauty advisor'])
})

test('during setup the member menu is replaced, top and bottom', () => {
  const shell = read('src', 'components', 'layout', 'AppShell.tsx')
  assert.ok(shell.includes("  const inSetup = pathname === '/onboarding'\n"))
  assert.ok(shell.includes('      {inSetup ? <SetupHeader /> : <Header />}\n'))
  assert.ok(shell.includes('      {!inSetup && <BottomNav />}'))
  // The member header and bottom bar appear nowhere else in the shell.
  assert.equal(shell.split('<Header />').length - 1, 1)
  assert.equal(shell.split('<BottomNav />').length - 1, 1)
})

test('closed world: the setup header links only to pages open during setup', () => {
  const header = code(read('src', 'components', 'layout', 'SetupHeader.tsx'))
  const hrefs = [...header.matchAll(/href=(?:\{)?["'`]([^"'`]+)["'`]/g)].map((m) => m[1])
  assert.deepEqual(hrefs, ['/settings'], 'every link must be a page the app gate lets a setup account open')
  // And it cannot navigate any other way.
  assert.doesNotMatch(header, /router\.|window\.location|onClick/)
  // The gate's own list of always-open pages is what makes /settings safe.
  const shell = read('src', 'components', 'layout', 'AppShell.tsx')
  assert.ok(shell.includes("const ALWAYS_ALLOWED = pathname === '/onboarding' || pathname.startsWith('/settings')"))
})
