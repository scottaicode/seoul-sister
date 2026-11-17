/**
 * Replays "build my routine" for one member and reports what was in the
 * sunscreen Yuri saved.
 *
 * Why this exists (Nov 16 2026): for a member with rosacea, a skin cancer
 * history and a prescription retinoid, Yuri saved a sunscreen holding four
 * fragrant essential oils, retinol and ascorbic acid, because the sunscreen
 * tool gave her no ingredients to read. A source test cannot see what she
 * saves; a count of saves can.
 *
 * The member's own account is never touched. Their profile and setup chat are
 * copied to a temporary account (deleted at the end, also on failure), the
 * turn is run there with the real prompt and the real read tools, and the six
 * tools that write are simulated.
 *
 *   npx tsx scripts/replay-routine-build.ts <sourceUserId> [runs=5] [--old]
 *
 * --old removes the ingredient lists from tool results, which is how the
 * tools answered before the fix, so the two can be counted side by side.
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient, MODELS, CHAT_EFFORT } from '../src/lib/anthropic'
import { YURI_TOOLS, executeYuriTool } from '../src/lib/yuri/tools'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import { fullIngredientLists, ingredientListsFact } from '../src/lib/yuri/ingredient-lists'
import type Anthropic from '@anthropic-ai/sdk'

const MESSAGE = "Let's build my routine from what you learned in my setup chat."
const WRITE_TOOLS = new Set(['add_to_routine', 'remove_from_routine', 'update_user_product', 'mark_product_reaction', 'clear_product_reaction', 'save_routine'])
const MAX_TOOL_LOOPS = 8
const OLD = process.argv.includes('--old')
const OLD_NOTE = "These MATCH the filters. Recommend from them based on the user's skin type, concerns, allergies, and current routine — do not just list all of them."

type Step = { product_id?: string; product_name?: string; product_brand?: string; category?: string; step_order?: number }
type Save = { routine_type?: string; steps?: Step[] }

async function copyMember(sourceUserId: string): Promise<string> {
  const db = getServiceClient()
  const email = `zztemp-replay-${Date.now()}@seoulsister.com`
  const { data: made, error } = await db.auth.admin.createUser({ email, email_confirm: true })
  if (error || !made.user) throw new Error(`could not create the temporary account: ${error?.message}`)
  const tempId = made.user.id
  try {
    await copyInto(tempId, sourceUserId)
  } catch (e) {
    await removeTemp(tempId)
    throw e
  }
  return tempId
}

async function copyInto(tempId: string, sourceUserId: string): Promise<void> {
  const db = getServiceClient()
  const strip = (row: Record<string, unknown>, extra: string[] = []) => {
    const copy = { ...row }
    for (const key of ['id', 'created_at', 'updated_at', ...extra]) delete copy[key]
    return copy
  }
  const { data: profile, error: pErr } = await db.from('ss_user_profiles').select('*').eq('user_id', sourceUserId).single()
  if (pErr || !profile) throw new Error(`no profile to copy: ${pErr?.message}`)
  // Tokens are unique per member and must not be shared with the copy.
  // The copy is never a member, an admin, a metric or a mail recipient.
  const inert: Record<string, unknown> = {}
  if ('excluded_from_metrics' in profile) inert.excluded_from_metrics = true
  if ('is_admin' in profile) inert.is_admin = false
  if ('plan' in profile) inert.plan = 'free'
  if ('nudge_email_opt_out' in profile) inert.nudge_email_opt_out = true
  const { error: insP } = await db.from('ss_user_profiles').upsert({ ...strip(profile, Object.keys(profile).filter((k) => k.endsWith('_token'))), ...inert, user_id: tempId }, { onConflict: 'user_id' })
  if (insP) throw new Error(`profile copy failed: ${insP.message}`)

  const { data: conv } = await db.from('ss_yuri_conversations').select('*').eq('user_id', sourceUserId).eq('conversation_type', 'onboarding').order('created_at').limit(1).maybeSingle()
  if (conv) {
    const { data: newConv, error: cErr } = await db.from('ss_yuri_conversations').insert({ ...strip(conv), user_id: tempId }).select('id').single()
    if (cErr || !newConv) throw new Error(`setup chat copy failed: ${cErr?.message}`)
    const { data: msgs } = await db.from('ss_yuri_messages').select('*').eq('conversation_id', conv.id).order('created_at').range(0, 499)
    for (const m of msgs ?? []) {
      const { error: mErr } = await db.from('ss_yuri_messages').insert({ ...strip(m, []), created_at: m.created_at, conversation_id: newConv.id })
      if (mErr) throw new Error(`setup message copy failed: ${mErr.message}`)
    }
    const { data: prog } = await db.from('ss_onboarding_progress').select('*').eq('user_id', sourceUserId).maybeSingle()
    if (prog) {
      const { error: oErr } = await db.from('ss_onboarding_progress').upsert({ ...strip(prog), user_id: tempId, conversation_id: newConv.id }, { onConflict: 'user_id' })
      if (oErr) throw new Error(`setup record copy failed: ${oErr.message}`)
    }
  }
}

async function removeTemp(tempId: string) {
  const db = getServiceClient()
  const { data: convs } = await db.from('ss_yuri_conversations').select('id').eq('user_id', tempId)
  for (const c of convs ?? []) await db.from('ss_yuri_messages').delete().eq('conversation_id', c.id)
  await db.from('ss_onboarding_progress').delete().eq('user_id', tempId)
  await db.from('ss_yuri_conversations').delete().eq('user_id', tempId)
  await db.from('ss_user_profiles').delete().eq('user_id', tempId)
  const { error } = await db.auth.admin.deleteUser(tempId)
  if (error) {
    process.exitCode = 1
    console.error(`TEMP ACCOUNT NOT DELETED (${tempId}): ${error.message}. Delete it by hand: it holds a copy of a member's profile.`)
  } else console.log(`temporary account ${tempId} deleted`)
}

async function runTool(name: string, input: Record<string, unknown>, userId: string): Promise<string> {
  if (name === 'save_routine') {
    const steps = ((input as Save).steps ?? []).filter((s) => s.product_id)
    const held = await fullIngredientLists(getServiceClient(), steps.map((s) => s.product_id))
    return JSON.stringify({
      success: true,
      message: `Saved with ${((input as Save).steps ?? []).length} steps. (replay: nothing was written)`,
      ...(OLD || steps.length === 0
        ? {}
        : {
            ingredients_of_saved_products: steps.map((s) => ({ step_order: s.step_order, product: [s.product_brand, s.product_name].filter(Boolean).join(' '), ingredients: held.failed ? null : held.lists.get(s.product_id!) ?? null })),
            about_ingredients: ingredientListsFact(held.failed),
          }),
    })
  }
  if (WRITE_TOOLS.has(name)) return JSON.stringify({ success: true, note: 'replay: write simulated, nothing saved' })
  const out = await executeYuriTool(name, input, userId)
  if (!OLD || name !== 'find_sunscreen_match') return out
  const parsed = JSON.parse(out) as { matches?: Array<Record<string, unknown>>; note?: string; about_ingredients?: string }
  for (const m of parsed.matches ?? []) delete m.ingredients
  delete parsed.about_ingredients
  if (parsed.note) parsed.note = OLD_NOTE
  return JSON.stringify(parsed)
}

async function oneRun(userId: string): Promise<{ text: string; tools: string[]; saves: Save[] }> {
  const memory = await import('../src/lib/yuri/memory')
  const advisor = await import('../src/lib/yuri/advisor')
  const client = getAnthropicClient()
  const ctx = await memory.loadUserContext(userId, undefined, { message: MESSAGE, isFirstMessage: true })
  const built = advisor.buildSystemPrompt(ctx, detectSpecialist(MESSAGE), [])
  const system = built.cachedBlocks.map((text) => ({ type: 'text' as const, text, cache_control: { type: 'ephemeral' as const } }))
  const tools = YURI_TOOLS.map((t, i) => (i === YURI_TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
  const msgs: unknown[] = [
    { role: 'user', content: MESSAGE },
    { role: 'system', content: (built.specialistBlock + built.clockBlock).trim() },
  ]
  const toolNames: string[] = []
  const saves: Save[] = []
  let text = ''
  for (let loop = 0; loop <= MAX_TOOL_LOOPS; loop++) {
    const res = await client.messages.create({ model: MODELS.chat, max_tokens: 8000, system, messages: msgs, tools, output_config: { effort: CHAT_EFFORT } } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)
    const uses = res.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
    if (uses.length === 0 || loop === MAX_TOOL_LOOPS) {
      text = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map((b) => b.text).join('')
      break
    }
    msgs.push({ role: 'assistant', content: res.content.filter((b) => b.type !== 'text') })
    const results = []
    for (const u of uses) {
      toolNames.push(u.name)
      if (u.name === 'save_routine') saves.push(u.input as Save)
      results.push({ type: 'tool_result', tool_use_id: u.id, content: await runTool(u.name, u.input as Record<string, unknown>, userId) })
    }
    msgs.push({ role: 'user', content: results })
  }
  return { text, tools: toolNames, saves }
}

async function main() {
  const sourceUserId = process.argv[2]
  const runs = Number(process.argv.slice(3).find((a) => /^\d+$/.test(a)) || 5)
  if (!sourceUserId) throw new Error('usage: <sourceUserId> [runs] [--old]')
  const db = getServiceClient()
  const tempId = await copyMember(sourceUserId)
  // Ctrl-C does not run `finally`: remove the copy before going.
  process.once('SIGINT', () => { void removeTemp(tempId).finally(() => process.exit(130)) })
  console.log(`arm: ${OLD ? 'OLD (no ingredient lists in tool results)' : 'NEW'}; temporary account ${tempId}`)
  try {
    for (let i = 0; i < runs; i++) {
      const r = await oneRun(tempId)
      // The last save of each type is what would be on the Routine page.
      const final = new Map<string, Save>()
      for (const s of r.saves) final.set(s.routine_type ?? '?', s)
      const steps = [...final.values()].flatMap((s) => s.steps ?? []).filter((s) => s.product_id)
      const held = await fullIngredientLists(db, steps.map((s) => s.product_id))
      console.log(`\n===== run ${i + 1}: tools = ${r.tools.join(', ')}`)
      for (const s of steps) {
        const list = held.lists.get(s.product_id!) ?? []
        console.log(`  SAVED [${s.category ?? '?'}] ${s.product_brand ?? ''} ${s.product_name ?? ''} (${list.length} ingredients)`)
        console.log(`    ${list.join(', ')}`)
      }
      if (steps.length === 0) console.log('  (no catalog product was saved)')
      console.log(`  REPLY: ${r.text.replace(/\s+/g, ' ').slice(0, 700)}`)
    }
  } finally {
    await removeTemp(tempId)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
