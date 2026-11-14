/**
 * Yuri saves a routine the member asked for, and sees each step's instruction
 * (Nov 14 2026).
 *
 * Measured: of the 5 member conversations since Sep 1 2026 where a routine
 * save came up, one member was asked "Want me to save this?" four times before
 * it was saved, and one (the first stranger in a free week) was asked three
 * times, never answered, and left with nothing on her Routine page. The ask
 * was scripted, word for word, in three places: the member prompt, the tool
 * description, and the Routine Architect block that is added on every turn
 * that mentions a routine. The first fix missed that third one; a second-model
 * review found it.
 *
 * NOT proven here: that Yuri now saves on the build turn. Name a production
 * conversation where she did before calling this working.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []
})
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('CLOSED WORLD: nothing Yuri reads scripts a question asking to save a routine', () => {
  // The SHAPE, not one phrase: a quoted question that offers to save, lock in
  // or add something to the routine, anywhere under the Yuri and member-chat code.
  const SCRIPT = /["“][^"“”\n]{0,80}\b(save|lock|add|put)\b[^"“”\n]{0,80}\b(routine|Routine page)\b[^"“”\n]{0,40}\?["”]/i
  const hits = []
  for (const dir of ['src/lib/yuri', 'src/app/api/yuri', 'src/lib/proactive']) {
    for (const file of walk(join(ROOT, dir))) {
      stripComments(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
        if (SCRIPT.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}`)
      })
    }
  }
  assert.deepEqual(hits, [])
})

test('the three places that describe saving agree: the member\'s request is the go-ahead', () => {
  const advisor = read('src/lib/yuri/advisor.ts')
  const para = advisor.split('\n').find((l) => l.startsWith('**save_routine**: '))
  assert.ok(para)
  assert.ok(para.includes('when the member asked you to build or change their own routine, that request is the go-ahead'))
  assert.ok(para.includes('once the save has gone through tell them'), 'saying it is saved stays tied to the save succeeding')
  assert.ok(para.includes('When the routine was your idea and not their request, ask first.'))
  assert.ok(para.includes('without replace_existing it sits beside any routine of that type already saved'))
  assert.ok(!/Sunday/.test(para), 'free-week members get notes on day 3 and day 6, not Sunday')

  const architect = read('src/lib/yuri/specialists.ts').split('\n').filter((l) => /save_routine/.test(l))
  assert.deepEqual(architect, ['- A finished routine is saved with save_routine. When they asked you to build or change their own routine, that request is the go-ahead; ask first only when the routine was your idea.'])

  const tools = read('src/lib/yuri/tools.ts')
  const a = tools.indexOf("name: 'save_routine',")
  const description = tools.slice(a, tools.indexOf('input_schema', a))
  assert.ok(description.includes('Call it when the member asked you to build or change their routine and it is ready, when they approve one you suggested, or when they ask to save it.'))
  assert.ok(!/Ask first/.test(description))

  // Every other mention of approval-before-save in the member prompt is gone.
  const a2 = advisor.indexOf('const YURI_SYSTEM_PROMPT = `')
  const prompt = advisor.slice(a2, advisor.indexOf('`\n\n// ---', a2))
  assert.ok(!/after the user approves a routine/i.test(prompt))
  assert.ok(!/after the user approves a routine/i.test(read('src/lib/yuri/specialists.ts')))
})

test('a saved step\'s frequency and note reach Yuri\'s standing view of the routine', () => {
  const memory = read('src/lib/yuri/memory.ts')
  const sel = memory.slice(memory.indexOf('ss_routine_products ('), memory.indexOf('ss_products (name_en, brand_en, category)'))
  assert.deepEqual(sel.match(/[a-z_]+,/g), ['step_order,', 'product_id,', 'notes,', 'frequency,'])

  const a = memory.indexOf('const stepNote = (rp.notes as string | null)?.trim()')
  const b = memory.indexOf("ownership,", a)
  const body = memory.slice(a, b).replace(/routineProducts\.push\(\{\s*productId,\s*display:/, 'OUT =').replace(/,\s*$/, '')
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const run = (rp) => new Function('rp', 'product', `let OUT; ${js}; return OUT`)(rp, { name_en: 'Retinal Skin Booster Serum', brand_en: 'Meditherapy', category: 'serum' })
  assert.equal(run({ notes: null, frequency: 'daily' }), 'Retinal Skin Booster Serum (Meditherapy) - serum')
  assert.equal(run({ notes: '  ', frequency: null }), 'Retinal Skin Booster Serum (Meditherapy) - serum')
  assert.equal(run({ notes: 'Do not start until week 3.', frequency: 'mon_wed_fri' }), 'Retinal Skin Booster Serum (Meditherapy) - serum [mon wed fri; note: Do not start until week 3.]')
  assert.equal(run({ notes: '2-3 thin layers', frequency: 'daily' }), 'Retinal Skin Booster Serum (Meditherapy) - serum [note: 2-3 thin layers]')
})
