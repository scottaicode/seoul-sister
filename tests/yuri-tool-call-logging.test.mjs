/**
 * Guard test — the PAID Yuri surface must log its tool calls.
 *
 * July 27 2026. The anonymous free widget has persisted every tool call since
 * Phase 14 (`ss_widget_messages.tool_calls`), and has an admin viewer for them.
 * The authenticated $24.99/mo surface persisted NONE.
 *
 * That blindness is why the Beplain Makiol defect took forensics. `save_routine`
 * builds a rich `savedSteps[]` array — requested_name, matched_name,
 * status:'matched'|'matched_loose'|'no_db_match' — the exact record that names
 * the bug. It was serialized, handed to the model, rendered into prose, and
 * thrown away. The only surviving trace was Yuri's paraphrase ("the same
 * matching gremlin bit two steps"), which nobody audited, so mis-joined rows
 * sat in a real user's library for seven weeks.
 *
 * With this column it is one query:
 *   SELECT * FROM ss_yuri_messages WHERE tool_calls @> '[{"name":"save_routine"}]'
 *
 * LIMITS: this asserts wiring, not that anyone reads the data. Logging only pays
 * off if something audits it.
 *
 * Pure — no compile, no DB, no network. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const memory = read('src', 'lib', 'yuri', 'memory.ts')
const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
const migration = read(
  'supabase', 'migrations', '20260727000001_yuri_messages_tool_calls.sql'
)

// ---------------------------------------------------------------------------
// 1. Schema
// ---------------------------------------------------------------------------

test('migration adds tool_calls to ss_yuri_messages', () => {
  assert.ok(
    /ALTER TABLE ss_yuri_messages[\s\S]*ADD COLUMN IF NOT EXISTS tool_calls JSONB/i.test(migration),
    'the tool_calls column migration is missing or renamed'
  )
})

test('migration does NOT backfill historical rows', () => {
  // Pre-2026-07-27 rows must stay NULL. Defaulting them to '[]' would assert
  // "no tools fired" for messages where tools demonstrably DID fire — the same
  // guess-as-fact error this whole line of work exists to eliminate.
  assert.ok(
    !/UPDATE ss_yuri_messages[\s\S]*SET tool_calls/i.test(migration),
    'migration backfills tool_calls — historical rows must stay NULL (unknown), not claim "[]" (no tools)'
  )
  assert.ok(
    !/ADD COLUMN[^\n;]*tool_calls[^\n;]*DEFAULT/i.test(migration),
    'tool_calls must not have a DEFAULT — NULL means "not recorded", which is the honest value'
  )
})

// ---------------------------------------------------------------------------
// 2. Persistence layer
// ---------------------------------------------------------------------------

test('saveMessage accepts tool calls', () => {
  assert.ok(
    /export interface YuriToolCallLog\b[\s\S]{0,220}result_summary/.test(memory),
    'YuriToolCallLog type is missing or lost result_summary'
  )
  assert.ok(
    /export async function saveMessage\([\s\S]{0,420}toolCalls: YuriToolCallLog\[\]/.test(memory),
    'saveMessage does not accept a toolCalls parameter'
  )
  assert.ok(
    /tool_calls: toolCalls/.test(memory),
    'saveMessage never writes tool_calls to the row'
  )
})

test('a missing column degrades gracefully instead of dropping the message', () => {
  // The migration may lag the deploy. Losing a diagnostic log line is
  // acceptable; losing the user's actual message is not.
  assert.ok(
    /\/tool_calls\/\.test\(error\.message\)/.test(memory),
    'no fallback when the tool_calls column is absent — a schema-cache error would ' +
      'throw and the user would lose their message'
  )
  assert.ok(
    /saving without tool log/.test(memory),
    'the degradation path no longer warns, so a missing migration would be silent'
  )
})

// ---------------------------------------------------------------------------
// 3. The advisor must actually capture and pass them.
// ---------------------------------------------------------------------------

test('advisor accumulates tool calls across ALL tool-loop rounds', () => {
  assert.ok(
    /const toolCallLogs: YuriToolCallLog\[\] = \[\]/.test(advisor),
    'the accumulator is missing'
  )
  // It must be declared OUTSIDE the loop — a per-round array would only ever
  // persist the final round's calls.
  const declIdx = advisor.indexOf('const toolCallLogs: YuriToolCallLog[] = []')
  const loopIdx = advisor.indexOf('for (const toolBlock of toolUseBlocks)')
  assert.ok(declIdx !== -1 && loopIdx !== -1, 'could not locate accumulator or tool loop')
  assert.ok(
    declIdx < loopIdx,
    'toolCallLogs is declared inside the tool loop — earlier rounds would be lost'
  )
})

test('each executed tool is recorded with name, input, and result', () => {
  assert.ok(
    /toolCallLogs\.push\(\{[\s\S]{0,300}name: toolBlock\.name[\s\S]{0,300}input: parsedInput[\s\S]{0,300}result_summary/.test(advisor),
    'tool calls are not recorded with all three fields'
  )
})

test('result summaries are truncated', () => {
  assert.ok(
    /result\.slice\(0, 1000\)/.test(advisor),
    'result_summary is no longer truncated — tool results can be large JSON blobs ' +
      'and this is a diagnostic trail, not a cache'
  )
})

test('the assistant message save passes the accumulated tool calls', () => {
  assert.ok(
    /saveMessage\(conversationId, 'assistant', fullResponse, specialistType, \[\], toolCallLogs\)/.test(advisor),
    'the assistant saveMessage call does not pass toolCallLogs — everything above is inert'
  )
})
