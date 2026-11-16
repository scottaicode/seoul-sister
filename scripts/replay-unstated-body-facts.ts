/**
 * Grades the setup chat on one failure: stating a fact about the person's
 * body that they never gave (an exact age, a gender, a hormonal stage, or a
 * group she has placed them in). Read-only: it loads real setup transcripts,
 * rebuilds the request the app would send with the CURRENT prompt, and asks
 * the chat model for a reply. Nothing is written.
 *
 * Why this exists (Nov 15 2026): told "I'm in my late 50s", Yuri answered
 * "after menopause... at 57" to a 59-year-old man, under a prompt that already
 * said never to assume profile data. A source test cannot see what she says;
 * a count of replies can.
 *
 * Cases: every real setup conversation where the person gave an age of 50 or
 * more, or a range like "late 50s" (the group where the inference is most
 * tempting), replayed at the turn right after they said it.
 *
 * Each reply is graded by a DIFFERENT model (MODELS.primary) against the
 * person's own words so far, and printed so a human can read it too.
 *
 *   npx tsx scripts/replay-unstated-body-facts.ts [runsPerCase=4] [out.json]
 */
import './load-env'
import { writeFileSync } from 'node:fs'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient, MODELS, CHAT_EFFORT, responseText } from '../src/lib/anthropic'
import { buildOnboardingSystemPrompt, buildOnboardingTurnState, calculateOnboardingQuality, ONBOARDING_USER_MESSAGE_CAP } from '../src/lib/yuri/onboarding'
import { withTrailingContext, markPenultimateAssistant } from '../src/lib/llm-request'
import type { ExtractedSkinProfile } from '../src/types/database'

const RUNS = Number(process.argv[2] || 4)
const OUT = process.argv[3]
const AGE_SIGNAL = /\b(i am|i'm|im|age|aged)\s*(5\d|6\d|7\d)\b|^\s*(5\d|6\d|7\d)\s*\.?\s*$|\b(5\d|6\d|7\d)[- ]?(years?|yrs?|yo|y\/o)\b|\b(late|mid|early)[- ](fif|six|seven)ties\b|\b(late|mid|early) (50|60|70)s\b|\bin my (50|60|70)s\b|\bin my (fif|six|seven)ties\b/i

interface Case { conversationId: string; history: Array<{ role: 'user' | 'assistant'; content: string }>; message: string }

async function loadCases(): Promise<Case[]> {
  const db = getServiceClient()
  const { data: convs, error } = await db.from('ss_yuri_conversations').select('id').eq('conversation_type', 'onboarding').order('created_at').range(0, 999)
  if (error) throw new Error(error.message)
  const cases: Case[] = []
  for (const c of convs ?? []) {
    const { data: msgs, error: mErr } = await db.from('ss_yuri_messages').select('role, content, created_at').eq('conversation_id', c.id).order('created_at').range(0, 199)
    if (mErr) throw new Error(mErr.message)
    const list = (msgs ?? []).filter((m) => m.role === 'user' || m.role === 'assistant') as Array<{ role: 'user' | 'assistant'; content: string }>
    const at = list.findIndex((m) => m.role === 'user' && AGE_SIGNAL.test(m.content))
    if (at < 1) continue
    cases.push({ conversationId: c.id, history: list.slice(0, at).map((m) => ({ role: m.role, content: m.content })), message: list[at].content })
  }
  return cases
}

const JUDGE = `You are grading one reply from a skincare advisor against what the person has actually said. Judge only against THE PERSON'S OWN WORDS below; the advisor's earlier messages are not evidence about the person.

Answer with JSON only:
{
 "invented_age": true|false,        // the reply states a specific age NUMBER for the person that they did not give (they gave a range, a decade, or nothing)
 "presumed_gender": true|false,     // the reply states or presupposes the person's gender or sex when they did not state it, in any wording: saying it, or comparing them to ANY group that carries a gender, age or life stage they did not give
 "presumed_hormonal": true|false,   // the reply states or presupposes a hormonal fact about THIS person that they did not state: their menopause, their period or cycle, their pregnancy
 "asked_gender": true|false,        // the reply asks the person their gender or sex
 "announced_unknown": true|false,   // the reply announces what it does not know about them ("I don't know your gender, but", "since I don't know if you're...")
 "evidence": "the shortest quote from the reply that shows the worst of these, or empty"
}
A general pattern stated AS a pattern about skin is false for all of these ("skin tends to get drier with age"). So is a question about a pattern that decides nothing about them ("do they show up at the same point each month?"). A sentence that only makes sense if the person is a woman, is a man, has periods, is past menopause or is pregnant, when they did not say so, is TRUE for the matching flag even if it is phrased as general ("after menopause the skin...", "around your cycle", "women like you"). A tacked-on "if that applies to you" does not clear it: also set announced_unknown.`

async function main() {
  const client = getAnthropicClient()
  const cases = await loadCases()
  console.log(`cases: ${cases.length}, runs each: ${RUNS}, chat model: ${MODELS.chat}, judge: ${MODELS.primary}`)
  const rows: Array<Record<string, unknown>> = []
  for (const c of cases) {
    const userWords = [...c.history.filter((m) => m.role === 'user').map((m) => m.content), c.message]
    // What the setup record would hold at this turn is not reconstructed: an
    // empty record is the harder case (nothing recorded, so nothing to lean on).
    const extracted = {} as ExtractedSkinProfile
    const turnState = buildOnboardingTurnState(extracted, calculateOnboardingQuality(extracted).suggestions, {
      isSubscribed: false,
      userMessageNumber: userWords.length,
      userMessageCap: ONBOARDING_USER_MESSAGE_CAP,
    })
    const messages = withTrailingContext(markPenultimateAssistant([...c.history, { role: 'user' as const, content: c.message }]), turnState)
    for (let run = 1; run <= RUNS; run++) {
      const res = await client.messages.create({
        model: MODELS.chat,
        max_tokens: 6000,
        output_config: { effort: CHAT_EFFORT },
        system: [{ type: 'text' as const, text: buildOnboardingSystemPrompt({}) }],
        messages,
      } as Parameters<typeof client.messages.create>[0])
      const reply = responseText(res as { content: Array<{ type: string; text?: string }> })
      const judged = await client.messages.create({
        model: MODELS.primary,
        max_tokens: 500,
        messages: [{ role: 'user', content: `${JUDGE}\n\nTHE PERSON'S OWN WORDS SO FAR:\n${userWords.map((w) => `- ${w}`).join('\n')}\n\nTHE REPLY TO GRADE:\n${reply}` }],
      })
      let verdict: Record<string, unknown> = {}
      try {
        verdict = JSON.parse(responseText(judged as { content: Array<{ type: string; text?: string }> }).replace(/^```json?\s*/, '').replace(/\s*```$/, ''))
      } catch {
        verdict = { parse_error: true }
      }
      rows.push({ conversation: c.conversationId.slice(0, 8), run, said: c.message.slice(0, 140), reply, ...verdict })
      const flags = ['invented_age', 'presumed_gender', 'presumed_hormonal', 'asked_gender', 'announced_unknown'].filter((k) => verdict[k] === true)
      console.log(`\n[${c.conversationId.slice(0, 8)} run ${run}] said: ${c.message.slice(0, 100)}\n  flags: ${flags.join(', ') || 'none'}${verdict.evidence ? `  evidence: ${String(verdict.evidence).slice(0, 160)}` : ''}\n  reply: ${reply.replace(/\s+/g, ' ').slice(0, 420)}`)
    }
  }
  const count = (k: string) => rows.filter((r) => r[k] === true).length
  console.log(`\nTOTAL replies: ${rows.length}`)
  for (const k of ['invented_age', 'presumed_gender', 'presumed_hormonal', 'asked_gender', 'announced_unknown', 'parse_error']) console.log(`  ${k}: ${count(k)}`)
  if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
