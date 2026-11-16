import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { cleanGender, cleanAgeYears, currentAge, factBase } from '@/lib/yuri/stated-identity'

/**
 * GET/POST /api/me/stated-facts
 *
 * What a member has told Yuri about their body, as stored, and a way to take
 * each piece back (Nov 15 2026). The privacy policy says a member can see what
 * we hold on their Profile page; gender, exact age and medical history were
 * stored (v11.61.17) and shown nowhere.
 *
 * Removing takes the value off the PROFILE, and off the setup record
 * (ss_onboarding_progress.skin_profile_data), which a reopened setup chat
 * would otherwise refill it from. It does not reach further, and the page
 * says so: conversations, their summaries and Yuri's notes are not edited, so
 * she may still see it there, and a setup chat that is still running re-reads
 * its whole transcript each message and can write it back. Making a removal
 * stick everywhere needs a "removed by the member" record that every writer
 * respects; that is not built.
 */
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('clear_gender') }),
  z.object({ action: z.literal('clear_age') }),
  z.object({ action: z.literal('remove_medical'), entry: z.string().min(1).max(400) }),
])

type Row = { gender: unknown; age_years: unknown; age_stated_on: unknown; age_range: unknown; medical_history: unknown; sun_history: unknown; location_text: unknown }

function shape(row: Row | null, now: Date) {
  const medical = Array.isArray(row?.medical_history) ? row!.medical_history.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []
  return {
    gender: cleanGender(row?.gender),
    age_years: cleanAgeYears(row?.age_years),
    age_stated_on: typeof row?.age_stated_on === 'string' ? row.age_stated_on.slice(0, 10) : null,
    age_now: currentAge(row?.age_years, row?.age_stated_on, now),
    medical_history: medical,
    sun_history: typeof row?.sun_history === 'string' && row.sun_history.trim() ? row.sun_history : null,
    location_text: typeof row?.location_text === 'string' && row.location_text.trim() ? row.location_text : null,
  }
}

const COLUMNS = 'gender, age_years, age_stated_on, age_range, medical_history, sun_history, location_text'

async function read(userId: string): Promise<Row | null> {
  const { data, error } = await getServiceClient().from('ss_user_profiles').select(COLUMNS).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`profile read failed: ${error.message}`)
  return (data as Row | null) ?? null
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : 'error'
  const unauthorized = /unauthor|token|authenticated/i.test(message)
  if (!unauthorized) console.error('[me/stated-facts]', message)
  return NextResponse.json({ ok: false, error: unauthorized ? 'Unauthorized' : 'unavailable' }, { status: unauthorized ? 401 : 500 })
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    return NextResponse.json({ ok: true, facts: shape(await read(user.id), new Date()) })
  } catch (err) {
    return fail(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const parsed = Body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
    const db = getServiceClient()
    const row = await read(user.id)
    if (!row) return NextResponse.json({ ok: false, error: 'No profile' }, { status: 404 })

    let update: Record<string, unknown>
    // Keys to drop from the setup record so a reopened setup chat cannot refill them.
    let setupKeys: string[] = []
    if (parsed.data.action === 'clear_gender') {
      update = { gender: null }
      setupKeys = ['gender']
    } else if (parsed.data.action === 'clear_age') {
      // The exact age and its date only. The age RANGE stays: it may be a
      // separate statement ("late 50s"), and the record cannot tell which.
      // It is shown on this page under Skin Profile.
      update = { age_years: null, age_stated_on: null }
      setupKeys = ['age_years']
    } else {
      const list = Array.isArray(row.medical_history) ? (row.medical_history as unknown[]) : []
      const entry = parsed.data.entry
      if (!list.includes(entry)) return NextResponse.json({ ok: false, error: 'Not on file' }, { status: 404 })
      update = { medical_history: list.filter((x) => x !== entry) }
    }

    const { error } = await db.from('ss_user_profiles').update(update).eq('user_id', user.id)
    if (error) throw new Error(`profile write failed: ${error.message}`)

    if (setupKeys.length || parsed.data.action === 'remove_medical') {
      const { data: setup, error: setupErr } = await db.from('ss_onboarding_progress').select('id, skin_profile_data').eq('user_id', user.id)
      if (setupErr) throw new Error(`setup record read failed: ${setupErr.message}`)
      for (const s of setup ?? []) {
        const data = { ...((s.skin_profile_data as Record<string, unknown> | null) ?? {}) }
        for (const k of setupKeys) delete data[k]
        if (parsed.data.action === 'remove_medical') {
          // The setup record holds the wording without its date: standing
          // facts under medical_history, and facts that change (pregnancy,
          // menopause) under hormonal_facts, which is where a dated profile
          // entry is rebuilt from.
          const base = factBase(parsed.data.entry)
          for (const key of ['medical_history', 'hormonal_facts']) {
            if (Array.isArray(data[key])) data[key] = (data[key] as unknown[]).filter((x) => typeof x !== 'string' || factBase(x) !== base)
          }
        }
        const { error: writeErr } = await db.from('ss_onboarding_progress').update({ skin_profile_data: data }).eq('id', s.id)
        if (writeErr) throw new Error(`setup record write failed: ${writeErr.message}`)
      }
    }
    return NextResponse.json({ ok: true, facts: shape(await read(user.id), new Date()) })
  } catch (err) {
    return fail(err)
  }
}
