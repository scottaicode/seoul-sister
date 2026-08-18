/**
 * Guard tests — a failed ai_memory write must not look like a successful one.
 *
 * THE DEFECT (Aug 18 2026). `generateAndSaveMemory` had three failure paths all
 * shaped exactly like success: `if (!jsonMatch) return` on a parse miss, a
 * final `.update(...)` whose result was DISCARDED (no `error` destructure), and
 * a catch that logged and returned the same `void` as the happy path. The
 * caller could not tell a saved memory from a vanished one.
 *
 * WHAT IT COST, on real production rows:
 *   - visitor a7db713a: the every-3rd-message trigger CAME DUE at her message 3
 *     (Aug 17, 18:49 UTC) and `ai_memory` is still `{}`.
 *   - visitor f7fdf10b: a due fire in her SECOND session stored zero session-2
 *     content, so on her return Yuri re-asked the climate and burn/tan she had
 *     already answered.
 * "Fired and failed" and "never fired" left IDENTICAL database state — the
 * fourth of the four questions failing on a live loop. The tempting fix was to
 * change the `% 3` cadence; that would have bolted more machinery onto a pipe
 * nobody had ever watched run.
 *
 * WHY THESE ASSERTIONS. A regex for "the update exists" passes against the
 * broken code — the update was always there. What was missing was the ERROR
 * CHECK and a durable record, so those are what get asserted.
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
const src = readFileSync(join(root, 'src/lib/widget/persistence.ts'), 'utf8')

/** Just the body of generateAndSaveMemory, so assertions can't match elsewhere. */
function memoryFnBody() {
  const start = src.indexOf('export async function generateAndSaveMemory')
  assert.ok(start > 0, 'generateAndSaveMemory must exist')
  // Ends at the next top-level export, or EOF.
  const rest = src.slice(start + 1)
  const next = rest.indexOf('\nexport ')
  return next === -1 ? rest : rest.slice(0, next)
}

test('the memory write checks its error instead of discarding the result', () => {
  const body = memoryFnBody()
  assert.match(
    body,
    /const \{\s*error:\s*writeError\s*\}\s*=\s*await supabase/,
    'the ai_memory update must destructure its error — a dead write must not read as a save'
  )
  assert.match(
    body,
    /if \(writeError\)/,
    'the write error must actually be branched on, not merely destructured'
  )
})

test('every exit reports an outcome, so the caller can tell success from failure', () => {
  const body = memoryFnBody()
  // A bare `return` (void) anywhere in this function reintroduces the defect:
  // the caller would again receive nothing on a failure path.
  assert.ok(
    !/\n\s*return\s*;?\s*\n/.test(body),
    'no bare `return` — every exit must report a MemoryWriteOutcome'
  )
  for (const outcome of [
    "'saved'",
    "'no_json_in_response'",
    "'parse_failed'",
    "'write_failed'",
    "'threw'",
  ]) {
    assert.ok(
      body.includes(`return ${outcome}`),
      `the ${outcome} outcome must be reachable and returned`
    )
  }
})

test('the outcome is recorded in DATA, not only in a log line', () => {
  const body = memoryFnBody()
  // A log-only tripwire is the failure mode that let the Olive Young price
  // refresher report success for ~130 nights while writing nothing.
  assert.match(
    body,
    /memory_write_status/,
    'the outcome must be persisted to a queryable column, not just console.error'
  )
  assert.match(
    body,
    /memory_write_at/,
    'the attempt time must be persisted so a stalled trigger is visible'
  )
  // Every outcome must be stamped, otherwise some failures stay invisible.
  const stamps = body.match(/await stamp\(/g) || []
  assert.ok(
    stamps.length >= 5,
    `every outcome must be stamped; found ${stamps.length} stamp calls, expected >= 5`
  )
})

test('the observability stamp cannot break the thing it observes', () => {
  const body = memoryFnBody()
  const stampStart = body.indexOf('const stamp =')
  assert.ok(stampStart > 0, 'the stamp helper must exist')
  const stampBody = body.slice(stampStart, stampStart + 900)
  assert.match(
    stampBody,
    /try \{/,
    'the stamp must be wrapped — a missing column must not surface as a memory failure'
  )
  assert.match(
    stampBody,
    /catch/,
    'the stamp must swallow its own errors'
  )
})

test('the migration adding the columns exists and is re-runnable', () => {
  const sql = readFileSync(
    join(root, 'scripts/migrations/widget_memory_write_observability.sql'),
    'utf8'
  )
  assert.match(sql, /ADD COLUMN IF NOT EXISTS memory_write_status/, 'status column')
  assert.match(sql, /ADD COLUMN IF NOT EXISTS memory_write_at/, 'timestamp column')
})
