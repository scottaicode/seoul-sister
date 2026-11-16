/**
 * The Profile page shows what a member told Yuri about their body, as stored,
 * and lets them take each piece back (Nov 15 2026).
 *
 * Why: the privacy policy says "View all data we have about you (available on
 * your Profile page)". Gender, exact age and medical history have been stored
 * since v11.61.17 and were shown nowhere.
 *
 * The route is EXECUTED here against a fake database: what is cleared, what is
 * left alone, and that the setup record is cleared too (a reopened setup chat
 * fills empty profile fields from it and would put the value straight back).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const transpile = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

async function loadRoute(profile, setupRows, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ss-stated-'))
  writeFileSync(join(dir, 'identity.mjs'), transpile(read('src/lib/yuri/stated-identity.ts')))
  writeFileSync(join(dir, 'stubs.mjs'), `
export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }
export const requireAuth = async (req) => { if (!req.user) throw new Error('Unauthorized'); return req.user }
export const getServiceClient = () => globalThis.__statedDb
`)
  writeFileSync(join(dir, 'route.mjs'), transpile(read('src/app/api/me/stated-facts/route.ts'))
    .replace("from 'next/server'", "from './stubs.mjs'")
    .replace("from 'zod'", `from '${import.meta.resolve('zod')}'`)
    .replace("from '@/lib/auth'", "from './stubs.mjs'")
    .replace("from '@/lib/supabase'", "from './stubs.mjs'")
    .replace("from '@/lib/yuri/stated-identity'", "from './identity.mjs'"))
  // Someone else's rows are always present: a write that loses its filter would change them.
  const OTHER = { user_id: 'u2', gender: 'woman', age_years: 30, age_stated_on: '2026-01-01', age_range: '25-30', medical_history: ['pregnant (said 2026-11-15)'], sun_history: null, location_text: null }
  const tables = {
    ss_user_profiles: [...(profile ? [{ user_id: 'u1', ...profile }] : []), { ...OTHER }],
    ss_onboarding_progress: [...setupRows.map((d, i) => ({ id: `s${i}`, user_id: 'u1', skin_profile_data: d })), { id: 'other', user_id: 'u2', skin_profile_data: { gender: 'woman', age_years: 30, hormonal_facts: ['pregnant'] } }],
  }
  const writes = []
  const failing = opts.fail ?? null
  globalThis.__statedDb = {
    from(table) {
      const filters = []
      const hit = () => tables[table].filter((r) => filters.every(([c, v]) => r[c] === v))
      const q = {
        select: () => q,
        eq(c, v) { filters.push([c, v]); return q },
        maybeSingle: () => Promise.resolve({ data: hit()[0] ?? null, error: null }),
        then: (ok) => ok({ data: hit(), error: null }),
        update(values) {
          const uf = []
          const u = { eq(c, v) { uf.push([c, v]); return u }, then(ok) { if (failing === table) return ok({ error: { message: `${table} boom` } }); writes.push([table, values]); for (const r of tables[table].filter((r) => uf.every(([c, v]) => r[c] === v))) Object.assign(r, values); return ok({ error: null }) } }
          return u
        },
      }
      return q
    },
  }
  const mod = await import(pathToFileURL(join(dir, 'route.mjs')).href)
  const req = (body, user = { id: 'u1' }) => ({ user, json: async () => body })
  const untouched = () => {
    assert.deepEqual(tables.ss_user_profiles.find((r) => r.user_id === 'u2'), OTHER, 'another member\'s profile was changed')
    assert.deepEqual(tables.ss_onboarding_progress.find((r) => r.id === 'other').skin_profile_data, { gender: 'woman', age_years: 30, hormonal_facts: ['pregnant'] }, 'another member\'s setup record was changed')
  }
  return { mod, tables, writes, req, untouched }
}

const FULL = { gender: 'man', age_years: 59, age_stated_on: '2026-11-15', age_range: '50+', medical_history: ['skin cancer history', 'pregnant (said 2026-11-15)'], sun_history: 'burned often as a child', location_text: 'Austin, TX' }

test('executed: it shows exactly what is stored, and "not stated" is null, never a guess', async () => {
  const { mod, req } = await loadRoute(FULL, [])
  const got = await mod.GET(req())
  assert.equal(got.status, 200)
  assert.deepEqual(got.body.facts, { gender: 'man', age_years: 59, age_stated_on: '2026-11-15', age_now: 59, medical_history: ['skin cancer history', 'pregnant (said 2026-11-15)'], sun_history: 'burned often as a child', location_text: 'Austin, TX' })
  const empty = await loadRoute({ gender: null, age_years: null, age_stated_on: null, age_range: '25-30', medical_history: null, sun_history: null, location_text: '  ' }, [])
  assert.deepEqual((await empty.mod.GET(empty.req())).body.facts, { gender: null, age_years: null, age_stated_on: null, age_now: null, medical_history: [], sun_history: null, location_text: null })
  // Not signed in: nothing.
  assert.equal((await mod.GET(req(null, null))).status, 401)
  assert.equal((await mod.POST(req({ action: 'clear_gender' }, null))).status, 401)
})

test('executed: removing gender or age clears the profile AND the setup record, and nothing else', async () => {
  const setup = { gender: 'man', age_years: 59, age_range: '50+', skin_type: 'dry', medical_history: ['Skin cancer history', 'pregnant'] }
  const a = await loadRoute(FULL, [setup])
  const out = await a.mod.POST(a.req({ action: 'clear_gender' }))
  assert.equal(out.body.facts.gender, null)
  assert.deepEqual([a.tables.ss_user_profiles[0].gender, a.tables.ss_user_profiles[0].age_years], [null, 59], 'only the gender')
  assert.deepEqual(a.tables.ss_onboarding_progress[0].skin_profile_data, { age_years: 59, age_range: '50+', skin_type: 'dry', medical_history: ['Skin cancer history', 'pregnant'] })

  a.untouched()

  // Age: the exact number and its date go. The range stays: it may be a separate statement.
  const b = await loadRoute(FULL, [setup])
  await b.mod.POST(b.req({ action: 'clear_age' }))
  assert.deepEqual([b.tables.ss_user_profiles[0].age_years, b.tables.ss_user_profiles[0].age_stated_on, b.tables.ss_user_profiles[0].age_range, b.tables.ss_user_profiles[0].gender], [null, null, '50+', 'man'])
  assert.deepEqual(b.tables.ss_onboarding_progress[0].skin_profile_data, { gender: 'man', age_range: '50+', skin_type: 'dry', medical_history: ['Skin cancer history', 'pregnant'] })
  b.untouched()

  // A failed write is an error to the member, never a quiet "done".
  for (const table of ['ss_user_profiles', 'ss_onboarding_progress']) {
    const f = await loadRoute(FULL, [setup], { fail: table })
    assert.equal((await f.mod.POST(f.req({ action: 'clear_gender' }))).status, 500, table)
  }
})

test('executed: one medical entry is removed by its exact stored text; anything else is refused and changes nothing', async () => {
  // The setup record as the extractor writes it: standing facts under
  // medical_history, facts that change under hormonal_facts, neither dated.
  const setup = { medical_history: ['Skin cancer history'], hormonal_facts: ['Pregnant', 'on hormone therapy'] }
  const a = await loadRoute(FULL, [setup])
  const out = await a.mod.POST(a.req({ action: 'remove_medical', entry: 'pregnant (said 2026-11-15)' }))
  assert.deepEqual(out.body.facts.medical_history, ['skin cancer history'])
  assert.deepEqual(a.tables.ss_onboarding_progress[0].skin_profile_data, { medical_history: ['Skin cancer history'], hormonal_facts: ['on hormone therapy'] }, 'gone from the key a dated entry is rebuilt from')
  a.untouched()
  const st = await loadRoute(FULL, [setup])
  await st.mod.POST(st.req({ action: 'remove_medical', entry: 'skin cancer history' }))
  assert.deepEqual([st.tables.ss_user_profiles[0].medical_history, st.tables.ss_onboarding_progress[0].skin_profile_data.medical_history], [['pregnant (said 2026-11-15)'], []])
  for (const bad of [{ action: 'remove_medical', entry: 'something never said' }, { action: 'remove_medical' }, { action: 'clear_everything' }, { action: 'clear_gender', plan: 'pro' }, null]) {
    const b = await loadRoute(FULL, [setup])
    const res = await b.mod.POST(b.req(bad))
    if (bad && bad.action === 'clear_gender') { assert.equal(res.status, 200); assert.deepEqual(b.writes[0], ['ss_user_profiles', { gender: null }], 'an extra field is never written'); continue }
    assert.ok(res.status === 400 || res.status === 404, JSON.stringify(bad))
    assert.deepEqual(b.writes, [], JSON.stringify(bad))
  }
})

test('the Profile page shows it, and the section states facts only', () => {
  const page = read('src/app/(app)/profile/page.tsx')
  assert.ok(page.includes('          <StatedFacts />\n'))
  const section = read('src/components/profile/StatedFacts.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.ok(section.includes("{value ?? 'Not stated'}"))
  // The promise is only what the route does: the profile, not the conversations.
  assert.ok(section.includes('This is what is stored on your profile about you. Removing something takes it off your profile only. Your conversations with Yuri are not edited, so she may still see it there, and it can be added back from them.'))
  assert.doesNotMatch(section, /Only what you said|told it was not stated|permanently|for good|forgets?\b/i)
  // No advice and no guess on this surface (Yuri Sole Authority): it reads back the record.
  assert.doesNotMatch(section, /recommend|should|consider|we suggest|based on your|for your skin/i)
  // The only writes are the three removals.
  assert.deepEqual([...section.matchAll(/action: '([a-z_]+)'/g)].map((m) => m[1]).sort(), ['clear_age', 'clear_gender', 'remove_medical'])
})
