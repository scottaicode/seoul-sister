#!/usr/bin/env node
/**
 * Mutation check for the proactive / memory-settle guards (npm run test:mutations).
 *
 * For each entry in tests/mutations.json, runs tests/proactive-outreach.test.mjs
 * with SS_MUTATION set. The test file's read() applies the mutation IN MEMORY
 * (no source file is touched) and throws if the `from` text is missing or
 * occurs more than once. A mutation PASSES this check only if at least one test
 * fails because of it. Exit code 1 if any mutation survives or does not apply.
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mutations = JSON.parse(readFileSync(join(root, 'tests', 'mutations.json'), 'utf8'))

let bad = 0
for (const m of mutations) {
  const r = spawnSync(process.execPath, ['--test', 'tests/proactive-outreach.test.mjs'], {
    cwd: root,
    env: { ...process.env, SS_MUTATION: JSON.stringify(m) },
    encoding: 'utf8',
  })
  const out = `${r.stdout}\n${r.stderr}`
  const invalid = /mutation did not apply|mutation is ambiguous/.exec(out)
  const failed = (r.stdout.match(/^not ok \d+ - .*/gm) || []).map((l) => l.replace(/^not ok \d+ - /, ''))
  if (invalid) {
    bad++
    console.log(`INVALID  ${m.name}: ${invalid[0]}`)
  } else if (failed.length === 0) {
    bad++
    console.log(`SURVIVED ${m.name}`)
  } else {
    console.log(`caught   ${m.name}  <- ${failed[0]}`)
  }
}
console.log(`\n${mutations.length - bad}/${mutations.length} mutations caught`)
process.exit(bad ? 1 : 0)
