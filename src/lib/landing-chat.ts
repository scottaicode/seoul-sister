/**
 * Whether an anonymous visitor may chat with Yuri on the landing page
 * (owner decision, Nov 13 2026).
 *
 * CLOSED (the default): talking to Yuri starts with a free account. The hero
 * shows what she is like and a sign-up button; `/api/widget/chat` refuses.
 * OPEN: the 12-message anonymous preview, as it ran from March to November 2026.
 *
 * THE ONE SWITCH. Set `NEXT_PUBLIC_LANDING_CHAT=open` in Vercel and redeploy to
 * bring the anonymous chat back; remove it (or set anything else) to close it.
 * No other file decides the mode, and no code change is needed either way.
 * LANDING-CHAT-GATE.md (repo root) is the runbook: reasons, how to grade it,
 * and the manual steps this switch cannot reach (blog bodies, llms.txt, LGAAS).
 *
 * Pass/fail line agreed when this shipped: the open chat captured about 4 to 7
 * emails a month. Fewer than about 4 real new accounts a month while closed
 * means it is capturing less than the chat did, and should be reopened.
 *
 * No imports, so tests run this file as it is. Every sentence a visitor reads
 * about how to reach Yuri comes from here, so both modes stay true.
 */

export function landingChatOpen(value: string | undefined = process.env.NEXT_PUBLIC_LANDING_CHAT): boolean {
  return (value ?? '').trim().toLowerCase() === 'open'
}

export const LANDING_CHAT_OPEN = landingChatOpen()

/** Mid-sentence form: "... for your skin, free, no signup." */
export function yuriAccessPhrase(open: boolean = LANDING_CHAT_OPEN): string {
  return open ? 'free, no signup' : 'free to start with an account'
}

/** Stand-alone sentence form. */
export function yuriAccessSentence(open: boolean = LANDING_CHAT_OPEN): string {
  return open ? 'Free, no signup.' : 'Free to start with an account.'
}

/**
 * The hero badge above the headline.
 *
 * Closed: it names the offer, not the account (Nov 20 2026). It used to read
 * "Free account. Start with Yuri.", and once the price sentence left the phone
 * layout the top of the page said "free account" three times and nothing that
 * told a visitor this is a paid membership with a free first week.
 *
 * "New members" is not decoration. Every free-week sentence in the app says who
 * gets it (see the rule above the path helpers in offers.ts): an inbox that has
 * had a free week does not get another, and this badge is read by people whose
 * history we cannot know. It is true only while the free period is 7 days and
 * needs no card (src/lib/pricing.ts); tests/landing-chat-gate.test.mjs holds it
 * to that. It does NOT follow the emergency stop NO_CARD_TRIAL_ENABLED=false
 * (src/lib/trial.ts): like the rest of the copy, it would lag while that is set.
 */
export function heroBadge(open: boolean = LANDING_CHAT_OPEN): string {
  return open ? 'Free to talk to. No signup.' : 'New members: first week free, no card.'
}

/** The small line under the hero buttons and under the final call to action. */
export function heroFootnote(maxFreeMessages: number, open: boolean = LANDING_CHAT_OPEN): string {
  return open
    ? `Talk to Yuri free. ${maxFreeMessages} messages, no signup.`
    : 'Talking to Yuri starts with a free account.'
}

/** The label on a button that leads to Yuri from a public page. */
export function talkToYuriLabel(open: boolean = LANDING_CHAT_OPEN): string {
  return open ? 'Talk to Yuri Free' : 'Start with Yuri'
}

/** What the server tells a browser that tries to send a chat message while closed. */
export const LANDING_CHAT_CLOSED_ERROR = 'Talking to Yuri now starts with a free account.'

const ASK_KEY = 'ss_signup_ask_v1'
const ASK_MAX_AGE_MS = 24 * 60 * 60 * 1000
const ASK_MAX_LENGTH = 300

/** A visitor's own question, bounded and stripped of control characters. '' when unusable. */
export function cleanCarriedQuestion(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ASK_MAX_LENGTH)
}

interface AskStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Hold the question a visitor arrived with across sign-up, so it is waiting in
 * the setup chat's box for them to send. It is only ever prefilled: they send
 * it, in their own words, or delete it.
 */
export function stashCarriedQuestion(store: AskStore, raw: string | null | undefined, now: number): boolean {
  const question = cleanCarriedQuestion(raw)
  if (!question) return false
  try {
    store.setItem(ASK_KEY, JSON.stringify({ q: question, at: now }))
    return true
  } catch {
    return false
  }
}

/** Said beside a visitor's own question wherever it is shown before sign-up. */
export const CARRIED_QUESTION_NOTE = 'Create your account on this device and this question will be waiting in the box, ready to send.'

/** The held question without taking it, for showing it on the sign-up form. '' when absent, stale or malformed. */
export function peekCarriedQuestion(store: AskStore | null | undefined, now: number): string {
  try {
    const raw = store?.getItem(ASK_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { q?: unknown; at?: unknown }
    if (typeof parsed.q !== 'string' || typeof parsed.at !== 'number') return ''
    if (now - parsed.at > ASK_MAX_AGE_MS || now < parsed.at) return ''
    return cleanCarriedQuestion(parsed.q)
  } catch {
    return ''
  }
}

/** Whether a question is being held for sign-up. Reads only; never throws. */
export function isCarryingQuestion(store: AskStore | null | undefined): boolean {
  try {
    return Boolean(store?.getItem(ASK_KEY))
  } catch {
    return false
  }
}

/** Read the held question once and remove it. '' when absent, stale or malformed. */
export function takeCarriedQuestion(store: AskStore, now: number): string {
  let raw: string | null = null
  try {
    raw = store.getItem(ASK_KEY)
    if (raw !== null) store.removeItem(ASK_KEY)
  } catch {
    return ''
  }
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as { q?: unknown; at?: unknown }
    if (typeof parsed.q !== 'string' || typeof parsed.at !== 'number') return ''
    if (now - parsed.at > ASK_MAX_AGE_MS || now < parsed.at) return ''
    return cleanCarriedQuestion(parsed.q)
  } catch {
    return ''
  }
}

/**
 * Where a SIGNED-IN person who lands on `/` should go, or null to stay.
 *
 * Open chat: a feeder link (`?ask=` / `?from=`) targets the hero chat, so they
 * stay, as they always have. Closed chat: the hero would offer a member
 * "Create my free account", so a feeder link goes to their own Yuri chat with
 * the question prefilled (found by the LGAAS session, Nov 13 2026: its blog
 * links are `/?from=blog`). An emailed `?resume=` link and a `#section` link
 * always stay. A bare `/` always goes to the dashboard.
 */
export function signedInLandingDestination(search: string, hash: string, open: boolean = LANDING_CHAT_OPEN): string | null {
  const params = new URLSearchParams(search)
  if (params.has('resume') || hash) return null
  const feeder = params.has('ask') || params.has('from')
  if (!feeder) return '/dashboard'
  if (open) return null
  const out = new URLSearchParams()
  const ask = cleanCarriedQuestion(params.get('ask'))
  if (ask) out.set('ask', ask)
  const from = cleanSignupFrom(params.get('from'))
  if (from) out.set('from', from)
  const qs = out.toString()
  return qs ? `/yuri?${qs}` : '/yuri'
}

const FROM_KEY = 'ss_signup_from_v1'

/** A `?from=` tag as we write them: letters, digits, underscore. '' otherwise. */
export function cleanSignupFrom(raw: string | null | undefined): string {
  const v = (raw ?? '').trim()
  return /^[A-Za-z0-9_]{1,60}$/.test(v) ? v : ''
}

/**
 * Which link brought this person to the sign-up page (`gate_blog`,
 * `nurture_3`, `widget_limit`, ...), kept for this tab so sign-up can record
 * it on the account. THE ROW that grades the closed chat:
 * `auth.users.raw_user_meta_data->>'signup_from' LIKE 'gate%'`.
 * The first tag in a tab is kept; a later bare visit does not clear it.
 */
export function rememberSignupFrom(store: AskStore, raw: string | null | undefined): boolean {
  const from = cleanSignupFrom(raw)
  if (!from) return false
  try {
    if (store.getItem(FROM_KEY)) return false
    store.setItem(FROM_KEY, from)
    return true
  } catch {
    return false
  }
}

/** The remembered tag, or undefined. Never throws. */
export function readSignupFrom(store: AskStore | null | undefined): string | undefined {
  if (!store) return undefined
  try {
    return cleanSignupFrom(store.getItem(FROM_KEY)) || undefined
  } catch {
    return undefined
  }
}

/**
 * The tag for one of the landing page's own sign-up buttons: where the visitor
 * arrived from AND which button they pressed, `<arrival>_<button>` (blog_nav,
 * tiktok_bar, landing_final_cta), or the button alone when nothing identifies
 * the arrival. gatedSignupHref puts `gate_` in front.
 *
 * The arrival is cut to 30 characters so the button always survives the
 * 40-character limit in gatedSignupHref (a referrer host can be long, and a
 * tag ending in `_fin` names no button). An arrival with no letter or digit in
 * it is treated as none, so the tag is never `gate__nav`.
 */
export function gateButtonTag(arrival: string | null | undefined, button: string): string {
  const where = (arrival ?? '').replace(/[^a-z0-9_]/gi, '').replace(/^_+|_+$/g, '').slice(0, 30).replace(/_+$/, '')
  return where ? `${where}_${button}` : button
}

/** The sign-up link from the closed hero, carrying where they came from and what they asked. */
export function gatedSignupHref(source: string | null | undefined, question: string | null | undefined): string {
  const params = new URLSearchParams({ plan: 'monthly' })
  const src = (source ?? '').replace(/[^a-z0-9_]/gi, '').slice(0, 40)
  params.set('from', src ? `gate_${src}` : 'gate')
  const q = cleanCarriedQuestion(question)
  if (q) params.set('ask', q)
  return `/register?${params.toString()}`
}
