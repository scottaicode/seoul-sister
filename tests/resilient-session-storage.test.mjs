/**
 * Guard test — the session must survive Safari clearing localStorage.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Bailey still re-logged in on every launch after the cold-launch fix, while
 * Scott's iPhone on the SAME build and the SAME origin stayed signed in. Same
 * code, opposite outcome — which ruled out the code.
 *
 * The database settled it. She had exactly ONE session row, freshly created and
 * never refreshed, down from the five-per-day the earlier bug produced. So the
 * session WAS being created and stored; her browser could not find it again on
 * relaunch. Nothing in this codebase clears it (verified by grep) and the shipped
 * bundle contained the fix (verified against the live chunks).
 *
 * That leaves iOS evicting the storage — Safari's 7-day cap on script-writable
 * storage, tracking-protection heuristics, low-disk reclamation. All per-device,
 * which is exactly why two iPhones behave differently, and none of it switchable
 * from a web page.
 *
 * The fix is to stop keeping the session in ONE place: mirror it into a cookie,
 * which has a different eviction lifetime, and read back from whichever survives.
 *
 * These tests execute the real adapter against a fake localStorage/document.
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

const supabaseSrc = read('src', 'lib', 'supabase.ts')

/** Compile the real adapter and run it against fakes. */
async function loadAdapter({ localStorageThrows = false } = {}) {
  const ts = await import('typescript')
  const src = read('src', 'lib', 'auth', 'resilient-storage.ts')
  const { outputText } = (ts.default ?? ts).transpileModule(src, {
    compilerOptions: { module: 99, target: 99 },
  })

  const store = new Map()
  let cookieJar = []

  globalThis.window = {
    location: { protocol: 'https:' },
    localStorage: {
      getItem: (k) => {
        if (localStorageThrows) throw new Error('SecurityError')
        return store.has(k) ? store.get(k) : null
      },
      setItem: (k, v) => {
        if (localStorageThrows) throw new Error('SecurityError')
        store.set(k, v)
      },
      removeItem: (k) => {
        if (localStorageThrows) throw new Error('SecurityError')
        store.delete(k)
      },
    },
  }
  globalThis.document = {
    get cookie() {
      return cookieJar.map(([n, v]) => `${n}=${v}`).join('; ')
    },
    set cookie(str) {
      const [pair, ...attrs] = str.split('; ')
      const eq = pair.indexOf('=')
      const name = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      cookieJar = cookieJar.filter(([n]) => n !== name)
      const maxAge = attrs.find((a) => a.startsWith('Max-Age='))
      if (maxAge && maxAge.split('=')[1] === '0') return // deletion
      cookieJar.push([name, value])
    },
  }

  const url = 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  const mod = await import(url)
  return {
    adapter: mod.resilientAuthStorage,
    store,
    // Simulate iOS wiping script-writable storage but leaving cookies.
    evictLocalStorage: () => store.clear(),
    cookieCount: () => cookieJar.length,
  }
}

const KEY = 'sb-gzqjvbhmndnovhlgumdk-auth-token'
const SESSION = JSON.stringify({ access_token: 'a', refresh_token: 'r' })

// ---------------------------------------------------------------------------
// The exact scenario on Bailey's phone
// ---------------------------------------------------------------------------

test('the session survives iOS wiping localStorage', async () => {
  const { adapter, evictLocalStorage } = await loadAdapter()
  adapter.setItem(KEY, SESSION)

  evictLocalStorage() // what iOS does, and what we cannot prevent

  assert.equal(
    adapter.getItem(KEY),
    SESSION,
    'The session must be recoverable from the cookie mirror. Without it, an iOS ' +
      'storage eviction means a login screen on every launch — Bailey, while ' +
      "Scott's identical iPhone stayed signed in."
  )
})

test('recovery re-seeds localStorage for the fast path', async () => {
  const { adapter, store, evictLocalStorage } = await loadAdapter()
  adapter.setItem(KEY, SESSION)
  evictLocalStorage()
  adapter.getItem(KEY)
  assert.equal(
    store.get(KEY),
    SESSION,
    'After recovering from the cookie, localStorage should be repopulated.'
  )
})

test('a write lands in BOTH places', async () => {
  const { adapter, store, cookieCount } = await loadAdapter()
  adapter.setItem(KEY, SESSION)
  assert.equal(store.get(KEY), SESSION, 'localStorage copy missing.')
  assert.ok(cookieCount() > 0, 'Cookie mirror missing — the whole point of this file.')
})

// ---------------------------------------------------------------------------
// It must not break the things that already worked
// ---------------------------------------------------------------------------

test('sign-out clears BOTH copies', async () => {
  const { adapter, cookieCount } = await loadAdapter()
  adapter.setItem(KEY, SESSION)
  adapter.removeItem(KEY)

  assert.equal(
    adapter.getItem(KEY),
    null,
    'A real sign-out must not be resurrected by the cookie mirror.'
  )
  assert.equal(cookieCount(), 0, 'The cookie must be deleted on sign-out.')
})

test('a missing session reads as null, not a crash', async () => {
  const { adapter } = await loadAdapter()
  assert.equal(adapter.getItem(KEY), null)
})

test('private browsing (localStorage throws) still works via cookie', async () => {
  // In private mode localStorage access THROWS rather than returning null. An
  // uncaught throw here would break sign-in entirely rather than degrading.
  const { adapter } = await loadAdapter({ localStorageThrows: true })
  adapter.setItem(KEY, SESSION)
  assert.equal(
    adapter.getItem(KEY),
    SESSION,
    'Every localStorage call must be wrapped; the cookie carries the session.'
  )
  adapter.removeItem(KEY)
  assert.equal(adapter.getItem(KEY), null, 'Sign-out must work in private mode too.')
})

// ---------------------------------------------------------------------------
// Wiring and security posture
// ---------------------------------------------------------------------------

test('the browser client actually uses the adapter', async () => {
  assert.match(
    supabaseSrc,
    /storage:\s*\n?\s*typeof window !== 'undefined' \? resilientAuthStorage : undefined/,
    'The adapter must be passed to createClient, and guarded for SSR — this module ' +
      'is imported by server code too, where window does not exist.'
  )
})

test('the storage key stays pinned to the library default', async () => {
  // Unchanged from the earlier fix: renaming it force-logs-out every user.
  assert.match(
    supabaseSrc,
    /storageKey: `sb-\$\{new URL\(supabaseUrl\)\.hostname\.split\('\.'\)\[0\]\}-auth-token`/,
    'Changing the storage key signs everyone out.'
  )
})

test('the cookie is Secure and SameSite-scoped', async () => {
  const src = read('src', 'lib', 'auth', 'resilient-storage.ts')
  assert.match(src, /SameSite=Lax/, 'Lost SameSite — the cookie would be sent cross-site.')
  assert.match(src, /Secure/, 'Lost the Secure flag on https.')
  assert.match(src, /Max-Age=0/, 'Deletion must set Max-Age=0, or sign-out leaks a session.')
})

// ---------------------------------------------------------------------------
// A mirror that goes stale is WORSE than no mirror (July 30 2026)
//
// `document.cookie` fails SILENTLY when the cookie exceeds ~4KB or the domain
// quota is full — no throw, no return value. If that happens the cookie keeps
// its PREVIOUS value while localStorage rotates on, so the mirror ends up
// holding an already-used refresh token.
//
// Refresh tokens are single-use. Presenting a rotated one trips GoTrue's reuse
// detection, which revokes the whole session family server-side; auth-js then
// gets a non-retryable auth error and clears storage (GoTrueClient.js:1990-1992),
// signing the user out for real. That is this file's own stated symptom, caused
// by this file. So a cookie that cannot be written truthfully must be removed.
// ---------------------------------------------------------------------------

/** Adapter over a document.cookie that silently refuses oversized writes. */
async function loadAdapterWithCookieCap(maxBytes) {
  const ts = await import('typescript')
  const src = read('src', 'lib', 'auth', 'resilient-storage.ts')
  const { outputText } = (ts.default ?? ts).transpileModule(src, {
    compilerOptions: { module: 99, target: 99 },
  })

  const store = new Map()
  let cookieJar = []

  globalThis.window = {
    location: { protocol: 'https:' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    },
  }
  globalThis.document = {
    get cookie() {
      return cookieJar.map(([n, v]) => `${n}=${v}`).join('; ')
    },
    set cookie(str) {
      const [pair, ...attrs] = str.split('; ')
      const eq = pair.indexOf('=')
      const name = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      const maxAge = attrs.find((a) => a.startsWith('Max-Age='))
      if (maxAge && maxAge.split('=')[1] === '0') {
        cookieJar = cookieJar.filter(([n]) => n !== name)
        return
      }
      // The real browser behaviour we are guarding against: too big → the write
      // is dropped on the floor and the OLD value survives.
      if (Buffer.byteLength(str) > maxBytes) return
      cookieJar = cookieJar.filter(([n]) => n !== name)
      cookieJar.push([name, value])
    },
  }

  const url = 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  const mod = await import(url + '#capped' + maxBytes)
  return {
    adapter: mod.resilientAuthStorage,
    store,
    evictLocalStorage: () => store.clear(),
    rawCookie: () => (cookieJar.length ? cookieJar[0][1] : null),
  }
}

test('an oversized cookie write does not leave a STALE token behind', async () => {
  // Room for the first (small) session, not for the second (large) one.
  const { adapter, rawCookie } = await loadAdapterWithCookieCap(400)

  const OLD = JSON.stringify({ access_token: 'old', refresh_token: 'rotated-away' })
  adapter.setItem(KEY, OLD)
  assert.ok(rawCookie(), 'Precondition: the small session should have been mirrored.')

  // Session rotates and is now too big for the cookie — the write silently fails.
  const NEW = JSON.stringify({ access_token: 'new', refresh_token: 'r'.repeat(500) })
  adapter.setItem(KEY, NEW)

  assert.equal(
    rawCookie(),
    null,
    'The cookie still holds the OLD session. On the next launch the adapter would ' +
      'hand auth-js an already-rotated refresh token, GoTrue reuse detection would ' +
      'revoke the entire session family server-side, and the user would be signed ' +
      'out for real — the exact symptom this file exists to prevent, manufactured ' +
      'by this file. A mirror that cannot be written truthfully must be deleted.'
  )
})

test('after a failed mirror write, localStorage still holds the CURRENT session', async () => {
  const { adapter, store } = await loadAdapterWithCookieCap(400)
  const NEW = JSON.stringify({ access_token: 'new', refresh_token: 'r'.repeat(500) })
  adapter.setItem(KEY, NEW)

  assert.equal(
    store.get(KEY),
    NEW,
    'Dropping the unreliable cookie must not disturb the real session store. ' +
      'localStorage remains the source of truth; the mirror is only a hedge.'
  )
  assert.equal(adapter.getItem(KEY), NEW, 'Reads must return the current session.')
})

test('a stale cookie never wins over a fresher localStorage value', async () => {
  // localStorage is preferred whenever present — the cookie is a fallback only.
  const { adapter } = await loadAdapterWithCookieCap(100000)
  adapter.setItem(KEY, JSON.stringify({ refresh_token: 'v1' }))
  const CURRENT = JSON.stringify({ refresh_token: 'v2' })
  adapter.setItem(KEY, CURRENT)

  assert.equal(
    adapter.getItem(KEY),
    CURRENT,
    'getItem must prefer localStorage. Serving an older mirrored token when a ' +
      'newer one exists is how reuse detection gets tripped.'
  )
})
