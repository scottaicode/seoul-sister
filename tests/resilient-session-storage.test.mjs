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
