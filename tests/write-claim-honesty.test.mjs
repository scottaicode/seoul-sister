/**
 * Guard test — write-claim honesty + the routine revision path.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * July 30 2026: a subscriber asked Yuri to clean up a saved PM routine whose
 * steps pointed at the wrong products (a sunscreen sat in the moisturizer slot).
 * He approved with "lock in Real Barrier". Yuri replied:
 *
 *     "Locked. ... This wipes out the drifted junk, CNP Propolis, Laneige mask,
 *      I'm From Rice Toner, and that sunscreen ... all get removed."
 *
 * She never called save_routine. The tool log for that turn shows search_products
 * and get_routine_context only. Every wrong row was still in the database, and
 * ss_user_routines.updated_at was still five months old.
 *
 * TWO ROOT CAUSES, BOTH FIXED HERE
 * 1. The tool-call honesty rule enumerated only READ verbs ("I checked", "I
 *    looked it up", "I verified"). "Locked" / "removed" / "saved" are WRITE
 *    claims and were not covered, so nothing in the prompt was violated.
 * 2. The only guidance about revising a routine lived inside an ERROR path and
 *    read as a warning: "CAREFUL: save_routine creates a whole NEW routine ...
 *    or you will wipe or duplicate the user's routine." Editing one step
 *    required re-saving all of them behind a destructive-sounding flag, so
 *    stopping looked safer than acting.
 *
 * A false write claim is worse than a false read claim: a wrong read gets
 * corrected next turn, but a user who believes his routine was fixed stops
 * checking it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const advisorSrc = read('src', 'lib', 'yuri', 'advisor.ts')
const toolsSrc = read('src', 'lib', 'yuri', 'tools.ts')

// --- 1. Write claims must be governed, not just read claims ----------------

test('the honesty rule explicitly covers completed-write language', () => {
  // The exact words Yuri used must be named. Enumerating read verbs alone is
  // what let "Locked" through.
  for (const claim of ['saved', 'locked', 'removed']) {
    assert.ok(
      new RegExp(claim, 'i').test(advisorSrc),
      `the prompt must name "${claim}" as a write claim requiring a real tool call`
    )
  }
  assert.ok(
    /never say something is saved, locked in, updated, removed/i.test(advisorSrc),
    'the prompt must forbid claiming a write that did not happen'
  )
})

test('the write rule requires the tool to have actually returned success', () => {
  assert.ok(
    /write tool actually ran THIS turn and returned success/i.test(advisorSrc),
    'a write claim must be tied to a tool that ran and succeeded, not to intent'
  )
})

test('past-tense completion is distinguished from present-tense intent', () => {
  // "Here's the clean routine I'm about to save" is honest.
  // "Locked, that wipes out the junk" is not. The distinction must be taught,
  // because Yuri did the first and then the second in consecutive sentences.
  assert.ok(
    /past tense/i.test(advisorSrc) && /present tense/i.test(advisorSrc),
    'the prompt must contrast present-tense intent with past-tense completion'
  )
})

test('a skipped or failed write must be reported as not saved', () => {
  assert.ok(
    /did NOT save/i.test(advisorSrc),
    'Yuri must tell the user plainly when a write did not happen'
  )
})

// --- 2. Revising a routine must read as routine, not dangerous -------------

test('the prompt documents how to revise an existing routine', () => {
  assert.ok(
    /REVISING an existing routine/i.test(advisorSrc),
    'the revision path must be documented in the prompt, not only in an error string'
  )
  assert.ok(
    /replace_existing/.test(advisorSrc),
    'the revision path must name replace_existing'
  )
  assert.ok(
    /get_routine_context/.test(advisorSrc),
    'the revision path must require reading current steps first'
  )
})

test('the revision path is framed as normal, not as something to avoid', () => {
  assert.ok(
    /it is not a destructive operation to avoid/i.test(advisorSrc),
    'Yuri stalled because a correct save read as destructive — the framing must say otherwise'
  )
  assert.ok(
    /deactivated, not deleted|deactivates the old version rather than deleting/i.test(advisorSrc),
    'the prompt must state that replace_existing deactivates rather than deletes'
  )
})

test('the tool description itself teaches the revision path', () => {
  // Yuri reads the tool description, not just the system prompt.
  const idx = toolsSrc.indexOf("name: 'save_routine'")
  assert.ok(idx > -1, 'save_routine tool must exist')
  const block = toolsSrc.slice(idx, idx + 2600)
  assert.ok(
    /REVISING an existing routine/i.test(block),
    'save_routine\'s own description must explain how to revise'
  )
  assert.ok(
    /replace_existing: true/.test(block),
    'save_routine\'s description must name the flag that makes a revision correct'
  )
})

test('the no-match error no longer frames the correct action as a wipe risk', () => {
  // The original text ("or you will wipe or duplicate the user's routine")
  // is precisely what made stalling feel safer than saving.
  assert.ok(
    !/or you will wipe or duplicate/i.test(toolsSrc),
    'the alarming framing that discouraged a legitimate save must be gone'
  )
  // ...but the real safety content must survive.
  assert.ok(
    /Omitting steps drops them; omitting replace_existing duplicates/i.test(toolsSrc),
    'the genuine failure modes must still be stated plainly'
  )
})

// --- 3. The executor still refuses to fabricate a product ------------------

test('save_routine still refuses to persist a loose match as a catalog product', () => {
  // The fix above makes Yuri MORE willing to call save_routine. That is only
  // safe because the executor refuses near-miss matches — this is the guard
  // that stops a bolder Yuri from reintroducing the fabricated-product bug.
  assert.ok(
    /match\.match_quality !== 'partial'/.test(toolsSrc),
    'loose matches must not be persisted as catalog product_ids'
  )
  assert.ok(
    /matched_loose/.test(toolsSrc),
    'loose matches must be tracked and surfaced, not silently saved'
  )
})
