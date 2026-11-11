/**
 * What the member chat is given from setup (Nov 11 2026).
 *
 * THE DEFECT. In the first real no-card trial, setup Yuri told a new member to
 * keep their CeraVe cleanser for nights and buy one thing, CeraVe Moisturizing
 * Cream. Twenty minutes later member Yuri built a routine that replaced both
 * with Korean products, then asked which niacinamide they use. Both gaps were
 * in what she was GIVEN:
 *   - the items named in setup live in ss_onboarding_progress and nothing the
 *     member chat or its routine tool read carried them;
 *   - her setup advice reached the member chat only as the last six messages
 *     cut to 500 characters (the plan sat past character 500 of the wrap-up),
 *     because the conversation summary is written by a background job that
 *     waits for 30 idle minutes.
 *
 * Everything here is pure (no imports), so tests execute it directly. The
 * wording states where each thing came from and what it is NOT, and hands the
 * judgment to Yuri. Nothing here says the person owns anything: the list is a
 * background reader's extraction, not their library.
 */

/** Routine items as setup's extractor recorded them. */
export interface SetupShelf {
  items: string[]
  /** When the setup record was last written (ISO), or null. */
  asOf: string | null
}

/** Read the list out of ss_onboarding_progress.skin_profile_data. Null when there is nothing usable. */
export function parseSetupShelf(skinProfileData: unknown, updatedAt: unknown): SetupShelf | null {
  const routine = (skinProfileData as { current_routine?: unknown } | null | undefined)?.current_routine
  if (!Array.isArray(routine)) return null
  const items = routine
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
  if (items.length === 0) return null
  return { items, asOf: typeof updatedAt === 'string' && updatedAt ? updatedAt : null }
}

/**
 * The one description of what this list is, used by the prompt section and the
 * routine tool. Written in the words Yuri could repeat to a member: nothing
 * about how the list was produced or where it is stored, and no claim about
 * whether Seoul Sister carries a product (nobody has searched these names).
 */
export const SETUP_SHELF_PROVENANCE =
  'These are the products and steps the person said they were using, as noted during setup. An entry can be a type of product rather than an exact name, can be worded differently from the label, or can have changed since. No one has searched for these names yet, so whether we carry them, and what is in them, is not known from this list. Where the setup conversation is shown, it has their exact words.'

/** The prompt section, or '' when setup noted nothing. Shown whatever the library holds. */
export function formatSetupShelfSection(shelf: SetupShelf | null | undefined): string {
  if (!shelf || shelf.items.length === 0) return ''
  const when = shelf.asOf ? ` (setup record last updated ${shelf.asOf.slice(0, 10)})` : ''
  return `## Routine Items Noted During Setup${when}
${shelf.items.map((i) => `- ${i}`).join('\n')}

${SETUP_SHELF_PROVENANCE}`
}

/** The same list for get_routine_context, which otherwise shows a new member an empty inventory. */
export function setupShelfForTool(shelf: SetupShelf | null | undefined): { items: string[]; setup_record_last_updated: string | null; what_this_is: string } | null {
  if (!shelf || shelf.items.length === 0) return null
  return { items: shelf.items, setup_record_last_updated: shelf.asOf ? shelf.asOf.slice(0, 10) : null, what_this_is: SETUP_SHELF_PROVENANCE }
}

// ---------------------------------------------------------------------------
// The setup conversation itself, when no summary of it exists yet
// ---------------------------------------------------------------------------

/** Rows fetched newest-first. A real setup runs about a dozen messages; the cap is 50 user messages. */
export const SETUP_CHAT_FETCH = 60
/** Per message. The longest real setup reply measured Nov 11 2026 was 1,786 characters. */
export const SETUP_CHAT_MAX_CHARS = 4000
/** Whole section. About 6K tokens; it sits in a cached block that is re-read every turn. */
export const SETUP_CHAT_BUDGET_CHARS = 24000

export interface SetupChatExcerpt {
  conversationId: string
  title: string | null
  fullSetupChat: true
  messages: Array<{ role: string; content: string }>
  /** First and last message times of the WHOLE conversation shown (ISO), when known. */
  startedAt: string | null
  endedAt: string | null
  /** Messages of the conversation that are not shown (older ones are dropped first). */
  omitted: number
  /** At least one shown message was cut at SETUP_CHAT_MAX_CHARS. */
  anyCut: boolean
  /** The conversation's real message count was known and consistent. Without it nothing is called complete. */
  totalKnown: boolean
}

/**
 * Build the excerpt from rows fetched NEWEST FIRST (so a long setup keeps its
 * wrap-up, which is where the plan is). `totalCount` is the conversation's real
 * message count; pass null when unknown. An unknown or inconsistent count
 * sets `totalKnown` false, and the section is then never called complete.
 */
export function buildSetupChatExcerpt(
  conversationId: string,
  title: string | null,
  rowsNewestFirst: Array<{ role: string; content: string; created_at?: string | null }>,
  totalCount: number | null
): SetupChatExcerpt | null {
  const rows = rowsNewestFirst.filter((r) => r.role === 'user' || r.role === 'assistant')
  if (rows.length === 0) return null
  const kept: Array<{ role: string; content: string; created_at?: string | null }> = []
  let used = 0
  let anyCut = false
  for (const r of rows) {
    const full = String(r.content ?? '')
    const cut = full.length > SETUP_CHAT_MAX_CHARS
    const content = cut ? `${full.slice(0, SETUP_CHAT_MAX_CHARS)} [cut]` : full
    // Always keep the newest message; after that, stop at the budget.
    if (kept.length > 0 && used + content.length > SETUP_CHAT_BUDGET_CHARS) break
    if (cut) anyCut = true
    kept.push({ role: r.role, content, created_at: r.created_at ?? null })
    used += content.length
  }
  kept.reverse()
  const known = typeof totalCount === 'number' && totalCount >= kept.length
  return {
    conversationId,
    title,
    fullSetupChat: true,
    messages: kept.map((m) => ({ role: m.role, content: m.content })),
    startedAt: kept[0]?.created_at ?? null,
    endedAt: kept[kept.length - 1]?.created_at ?? null,
    // Unknown total: report at least what the fetch itself dropped.
    omitted: known ? (totalCount as number) - kept.length : rows.length - kept.length,
    anyCut,
    totalKnown: known,
  }
}

/**
 * "Tue, Nov 10, 9:54 PM" in the member's own time zone, the same clock as the
 * rest of Yuri's context. With no usable zone it is UTC and says so: a time
 * she might repeat must never be on a clock the member is not on.
 */
function localStamp(iso: string | null, timezone: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const fmt = (timeZone: string) =>
    d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone })
  if (timezone) {
    try {
      return fmt(timezone)
    } catch {
      // Not a zone this runtime knows: fall through to UTC, labelled.
    }
  }
  return `${fmt('UTC')} UTC`
}

/**
 * The prompt section for setup conversations that have no summary yet. Times
 * are in `timezone` (the member's profile zone) when given.
 */
export function formatSetupChatSection(excerpts: SetupChatExcerpt[], timezone: string | null = null): string {
  if (excerpts.length === 0) return ''
  return excerpts
    .map((ex) => {
      const complete = ex.totalKnown && ex.omitted === 0 && !ex.anyCut
      const from = localStamp(ex.startedAt, timezone)
      const to = localStamp(ex.endedAt, timezone)
      const when = !from || !to ? '' : from === to ? ` The message shown is from ${from}.` : ` The messages shown run from ${from} to ${to}.`
      const scope = complete
        ? 'This is the whole conversation.'
        : `This is the most recent part of it${ex.omitted > 0 ? `: ${ex.omitted} earlier message${ex.omitted === 1 ? ' is' : 's are'} not shown` : ''}${ex.anyCut ? `${ex.omitted > 0 ? ', and' : ':'} a message marked [cut] was shortened` : ''}.`
      const body = ex.messages.map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content}`).join('\n')
      return `## Your Setup (Onboarding) Conversation With This User${complete ? ' (complete)' : ' (most recent part)'}
No summary of this conversation has been written yet, so it is shown directly. ${scope}${when} If a message here refers to an earlier chat, that is their free preview chat on the landing page, which is not shown here.

${body}`
    })
    .join('\n\n')
}
