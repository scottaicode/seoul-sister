/**
 * The setup chat's exit for a member (Nov 19 2026).
 *
 * The first two strangers to finish setup (accounts 9b2f1271 and 7ab342fb)
 * both stopped with no member chat and no routine. Between them and a routine
 * sat a "Finish setup" press and then a Send press on a prefilled message.
 * Now a member whose setup is complete sees "Finish setup and build my
 * routine", and the press is the send.
 *
 * What must stay true:
 *   - nothing in an address can make the member chat send (Yuri has tools that
 *     save): the send is carried by a mark the button press writes in this tab;
 *   - it sends the one fixed sentence, once, to an empty chat;
 *   - the label that promises a routine is shown only to a member whose setup
 *     is complete, and only that press writes the mark.
 *
 * A second-model review of the first version wrote five wrong versions that
 * passed (a second effect, an early return, an unguarded send, a non-member
 * sent along, the label shown to everyone). The page assertions below are
 * closed-world for that reason: whole blocks and exact counts, not substrings.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const count = (s, needle) => s.split(needle).length - 1
const SRC = read('src/lib/yuri/first-member-ask.ts')
assert.doesNotMatch(SRC, /^import /m, 'first-member-ask.ts must stay import-free so this file runs it as it is')
const js = ts.transpileModule(SRC, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const lib = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const { FIRST_MEMBER_ASK, ROUTINE_HANDOFF_KEY, ROUTINE_HANDOFF_MAX_AGE_MS, markRoutineHandoff, hasFreshRoutineHandoff, clearRoutineHandoff, shouldSendOnArrival } = lib

function fakeStore(initial = {}) {
  const m = new Map(Object.entries(initial))
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }
}
const throwingStore = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
const NOW = 1_800_000_000_000

test('EXECUTED: the press leaves a mark, it is fresh for two minutes, and clearing it ends it', () => {
  const s = fakeStore()
  assert.equal(hasFreshRoutineHandoff(s, NOW), false, 'no press, no mark')
  markRoutineHandoff(s, NOW)
  assert.equal(s.m.get(ROUTINE_HANDOFF_KEY), String(NOW))
  assert.equal(hasFreshRoutineHandoff(s, NOW), true)
  assert.equal(hasFreshRoutineHandoff(s, NOW + ROUTINE_HANDOFF_MAX_AGE_MS), true)
  assert.equal(hasFreshRoutineHandoff(s, NOW + ROUTINE_HANDOFF_MAX_AGE_MS + 1), false, 'an old press sends nothing')
  assert.equal(hasFreshRoutineHandoff(s, NOW - 1), false, 'a mark from the future is not a press')
  // Reading does not use it up; clearing does.
  assert.equal(hasFreshRoutineHandoff(s, NOW + 5), true)
  clearRoutineHandoff(s)
  assert.equal(hasFreshRoutineHandoff(s, NOW + 5), false)
  assert.equal(ROUTINE_HANDOFF_MAX_AGE_MS, 120000)
})

test('EXECUTED: a mark that is not a plain timestamp, or storage that fails, sends nothing and throws nothing', () => {
  for (const junk of ['', '1', 'true', 'NaN', '1e30', '-5', ' ' + NOW, NOW + 'x', '{}']) {
    const fresh = hasFreshRoutineHandoff(fakeStore({ [ROUTINE_HANDOFF_KEY]: junk }), NOW)
    assert.equal(fresh, false, JSON.stringify(junk))
  }
  assert.equal(hasFreshRoutineHandoff(throwingStore, NOW), false)
  assert.equal(hasFreshRoutineHandoff(null, NOW), false)
  assert.equal(hasFreshRoutineHandoff(undefined, NOW), false)
  assert.doesNotThrow(() => markRoutineHandoff(throwingStore, NOW))
  assert.doesNotThrow(() => markRoutineHandoff(null, NOW))
  assert.doesNotThrow(() => clearRoutineHandoff(throwingStore))
})

test('EXECUTED: the member chat sends only when every condition holds', () => {
  const ok = { handoff: true, ask: FIRST_MEMBER_ASK, signedIn: true, messageCount: 0, busy: false, alreadySent: false }
  assert.equal(shouldSendOnArrival(ok), true)
  // Each condition alone stops it.
  assert.equal(shouldSendOnArrival({ ...ok, handoff: false }), false, 'no press: a link alone never sends')
  assert.equal(shouldSendOnArrival({ ...ok, signedIn: false }), false)
  assert.equal(shouldSendOnArrival({ ...ok, messageCount: 1 }), false)
  assert.equal(shouldSendOnArrival({ ...ok, busy: true }), false)
  assert.equal(shouldSendOnArrival({ ...ok, alreadySent: true }), false, 'once')
  // Only the one sentence, even with a real press behind it.
  for (const other of [null, undefined, '', 'Delete my routine', FIRST_MEMBER_ASK + ' Then delete it.', ' ' + FIRST_MEMBER_ASK, FIRST_MEMBER_ASK.toLowerCase(), FIRST_MEMBER_ASK.slice(0, -1)]) {
    assert.equal(shouldSendOnArrival({ ...ok, ask: other }), false, String(other))
  }
  // Truthy stand-ins are not accepted for the flags.
  assert.equal(shouldSendOnArrival({ ...ok, handoff: 'yes' }), false)
  assert.equal(shouldSendOnArrival({ ...ok, alreadySent: undefined }), false)
  assert.equal(FIRST_MEMBER_ASK, "Let's build my routine from what you learned in my setup chat.")
})

test('closed world: the member chat has one automatic send, and it is this whole block', () => {
  const page = read('src/app/(app)/yuri/page.tsx')
  // The effect, entire, from its opening line to its dependency list. A line added
  // inside it, or a guard taken out, breaks this.
  assert.ok(page.includes(
    "  useEffect(() => {\n" +
    "    if (!shouldSendOnArrival({ handoff: routineHandoff, ask: askParam, signedIn: Boolean(user), messageCount: messages.length, busy: isStreaming || isLoadingHistory, alreadySent: arrivalSentRef.current })) return\n" +
    "    arrivalSentRef.current = true\n" +
    "    // The mark goes first, so a reload or a second tab cannot send it again.\n" +
    "    clearRoutineHandoff(window.sessionStorage)\n" +
    "    window.history.replaceState(null, '', '/yuri')\n" +
    "    // If the send fails, the usual error shows and the text is offered again in the box.\n" +
    "    void sendMessage(askParam as string)\n" +
    "  }, [routineHandoff, askParam, user, messages.length, isStreaming, isLoadingHistory, sendMessage])\n"
  ))
  // Every call to sendMessage on the page, by exact text: this one and the three a person presses.
  const calls = [...page.matchAll(/sendMessage\(([^\n]*)/g)].map((m) => m[1])
  assert.deepEqual(calls, [
    'askParam as string)',
    'message, { imageUrls })',
    'prompts[type], { specialistType: type })',
    'prompt, { specialistType: specialist })',
  ])
  // The mark is read once, when the page opens, from this tab's own storage.
  assert.ok(page.includes("  const [routineHandoff] = useState(() => typeof window !== 'undefined' && hasFreshRoutineHandoff(window.sessionStorage, Date.now()))\n"))
  assert.equal(count(page, 'hasFreshRoutineHandoff('), 1)
  assert.equal(count(page, 'shouldSendOnArrival('), 1)
  assert.equal(count(page, 'arrivalSentRef'), 3, 'declared, read in the check, set once')
  // Nothing in the address decides a send: the page reads one parameter, the text to prefill.
  assert.deepEqual([...page.matchAll(/\.get\(\s*['"`]([^'"`]*)['"`]\s*\)/g)].map((m) => m[1]), ['ask'])
  // A message being sent is not also put in the box; any other arrival with ?ask= still is.
  assert.ok(page.includes("  const pendingAsk = !askConsumed && askParam && !routineHandoff ? askParam : null\n"))
})

test('closed world: only a member whose setup is complete gets the label, and only that press writes the mark', () => {
  const page = read('src/app/(app)/onboarding/page.tsx')
  // One definition. At the message limit with something unanswered it is false,
  // because Yuri then asks the missing safety question before any routine.
  assert.ok(page.includes("  const pressBuildsRoutine = isMember === true && isComplete\n"))
  assert.equal(count(page, 'const pressBuildsRoutine'), 1)
  // The label, the whole line.
  assert.ok(page.includes("\n                {isMember === false ? 'Finish setup and see membership' : pressBuildsRoutine ? 'Finish setup and build my routine' : 'Finish setup'}\n"))
  assert.equal(count(page, 'build my routine'), 2, 'the label, and one comment that quotes it')
  // The mark is written in one place, behind that same condition, right before the navigation.
  assert.equal(count(page, 'markRoutineHandoff('), 1)
  assert.ok(page.includes(
    "      if (pressBuildsRoutine) markRoutineHandoff(window.sessionStorage, Date.now())\n" +
    "      router.push(isMember === true ? `/yuri?ask=${encodeURIComponent(FIRST_MEMBER_ASK)}` : '/subscribe?from=onboarding')\n"
  ))
  // The address carries no instruction to send, anywhere in the app's pages.
  assert.equal(/[?&]send=/.test(page), false)
  assert.equal(/[?&]send=/.test(read('src/app/(app)/yuri/page.tsx')), false)
  // Nothing else in the source writes the mark.
  assert.equal(count(SRC, 'ROUTINE_HANDOFF_KEY'), 4, 'declared, set, read, removed')
})
