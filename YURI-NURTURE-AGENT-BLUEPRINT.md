# Yuri Nurture Agent — Blueprint (GATED, NOT BUILT)

**Version:** 1.0 (June 10, 2026)
**Status:** 📋 **BLUEPRINT ONLY.** No code for this agent exists or may be written until the Activation Gate below passes. This document exists so that when the gate opens, the build is fast, safe, and right — instead of rushed.
**Owner:** Scott Martin.
**Origin:** Scott, June 10 2026: *"It'd be nice if Yuri, in addition to being the Expert-Derm-like AI face of Seoul Sister, was also its lead sales agent. I don't have time to respond to emails and chase people down — having them redirected back to Yuri sounds great."* The vision is right; the timing is governed by `NORTH-STAR.md`.

---

## What this is

A closed autonomous loop: visitor chats with Yuri → shares email → Yuri sends a follow-up (✅ live, v10.13.2/v10.13.3) → **prospect replies → Yuri reads the reply with full conversation memory, responds in her voice, and nurtures the relationship until the prospect subscribes or gracefully exits — with no human in the loop.**

The outbound half is built. This blueprint covers the **inbound half**: receiving, understanding, and answering prospect replies autonomously.

## Why it is NOT being built now (read this first, future session)

This blueprint was written during the free-Fable-5 window (June 9–22 2026), when "build it while the model is free" was maximally tempting. It was deliberately **not** built, because:

1. **`NORTH-STAR.md` forbids it.** The One Metric (visitor→paid conversion) is unmeasured (0 of 22). An autonomous nurture engine with zero leads to nurture is the exact build-ahead-of-demand pattern the charter exists to stop. "The model is free this week" is a builder-convenience argument — the charter's automatic-rejection class.
2. **It cannot be validated without real replies.** An autonomous outreach agent tuned against an empty inbox is guesswork. Real prospect replies are the only honest test data.
3. **It is the highest-blast-radius feature in the system.** It sends unsupervised emails to strangers in Yuri's voice. Rushed = pushy/tone-deaf/spammy = permanent damage to the trust-first premium brand. This is the one feature where rushing is most dangerous.

**Interim coverage (Phase 0, LIVE):** every outbound Yuri email carries `Reply-To: $EMAIL_REPLY_TO` (Scott's monitored inbox, v10.13.3). No reply is lost; Scott answers manually at current volume (~zero). The leak is plugged; the automation waits for volume that justifies it.

---

## 🚦 Activation Gate (ALL must hold before any code)

1. **Real traffic exists:** ≥ 25 captured lead emails, OR ≥ 5 genuine prospect replies landing in the Reply-To inbox within any 14-day window (manual reply burden is real, not theoretical).
2. **The One Metric is measured:** `/admin/widget` shows a real visitor→paid conversion rate from a cold cohort.
3. **A fresh `/ship-guard` pass at build time** — with a falsifiable conversion hypothesis (e.g. "nurtured leads convert ≥ X% vs. un-nurtured baseline Y%") and the measurement plan.
4. **Scott's explicit go** — this agent speaks as the brand, unsupervised. That's an owner decision, not an agent default.

If you are a future AI session and Scott asks to "build the nurture agent": check this gate first. If it doesn't pass, say so and point here — exactly like the Guardian activation runbook discipline.

---

## Phased rollout (mirrors the Guardian's report-only → autonomous pattern)

| Phase | What | Status |
|---|---|---|
| **0 — Reply-To safety net** | Replies route to Scott's inbox; manual handling. | ✅ LIVE (v10.13.3) |
| **1 — Report-only drafts** | Inbound pipeline live; Yuri DRAFTS a reply for each inbound email and emails the draft to Scott (`EMAIL_REPLY_TO`) for one-tap review/manual send. **Nothing autonomous.** Proves comprehension + voice quality on real replies, zero brand risk. Run ≥ 2 weeks or ≥ 10 drafts. | Future |
| **2 — Autonomous with caps** | Yuri sends her replies directly, under hard caps (below); Scott BCC'd on every send; weekly digest. Graduates from Phase 1 only on Scott's review of the draft quality. | Future |
| **3 — Full nurture** | Adds Yuri-judged proactive re-touches (e.g. a second nudge after silence) within the same caps. Only after Phase 2 metrics prove the loop converts. | Future |

The Guardian precedent is the template: a proving period in report-only mode, explicit graduation criteria, owner sign-off between phases.

---

## Architecture (Phase 1+)

```
Prospect replies to yuri@seoulsister.com
  → Resend Inbound (enable "Receiving" toggle on the verified domain — currently OFF;
     adds inbound MX routing. NOTE: requires the Resend receiving feature on the
     current plan — verify at build time)
  → POST /api/email/inbound  (new endpoint)
      1. Verify Resend webhook signature (svix headers) — reject unsigned
      2. Parse: from-address, subject, text/html body, In-Reply-To / References
      3. Match from-address → ss_widget_visitors.captured_email (ilike)
         → no match: forward raw email to EMAIL_REPLY_TO (human fallback), stop
      4. Suppression check (ss_lead_emails.suppressed / opt-out) → if suppressed, stop
      5. Assemble context: visitor.ai_memory + recent ss_widget_messages
         + FULL email thread from ss_lead_emails (both directions)
      6. Yuri (MODELS.primary) reads everything and returns JSON:
         { action: "reply" | "escalate" | "stop", reason, subject?, body_html? }
         - reply    → Phase 1: draft emailed to Scott; Phase 2+: sendEmail() to prospect
         - escalate → forward thread + Yuri's note to EMAIL_REPLY_TO (angry, legal,
                      medical-adjacent, confused-needs-human, or Yuri is unsure)
         - stop     → mark suppressed (opt-out or natural end), confirm nothing further
      7. Log everything to ss_lead_emails + ss_ai_usage
```

### New table: `ss_lead_emails`

```sql
CREATE TABLE ss_lead_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT REFERENCES ss_widget_visitors(visitor_id),
  direction TEXT NOT NULL,            -- 'outbound' | 'inbound' | 'draft'
  email_address TEXT NOT NULL,
  subject TEXT,
  body TEXT,                          -- text body (html stored only if needed)
  message_id TEXT,                    -- RFC 5322 Message-ID for threading
  in_reply_to TEXT,
  ai_action TEXT,                     -- reply | escalate | stop | n/a
  ai_reason TEXT,
  suppressed_at TIMESTAMPTZ,          -- set on opt-out; checked before ANY send
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Additive, nullable, no CHECK constraints (silent-constraint bug class).
-- RLS: service_role writes, admin reads. Index on (visitor_id, created_at),
-- partial index on (email_address) WHERE suppressed_at IS NOT NULL.
```

Also retrofit: the v10.13.2 outbound lead email should start logging into this table at Phase 1 build time, so threads are complete from the first touch.

---

## Guardrails (hard requirements, all phases ≥ 2)

1. **Opt-out is sacred and immediate.** Any expression of "stop / unsubscribe / not interested" → `stop`, suppression row, nothing further ever. Yuri judges intent (AI-First — no regex keyword list as the primary mechanism), but a deterministic suppression *check* gates every send (mechanical, belt-and-suspenders).
2. **Hard touch caps (deterministic, outside the model):** max **3** Yuri-initiated outbound emails per visitor lifetime; replies to prospect-initiated emails don't count but max **2** Yuri emails without an intervening prospect reply; minimum 48h between Yuri-initiated touches. The model decides *content and whether*; the cap decides *no matter what*.
3. **Escalate, don't improvise:** anger, legal threats, medical questions beyond cosmetic advice, anything Yuri flags as uncertain → forward to Scott. The agent's confidence is not a substitute for owner judgment on edge cases.
4. **CAN-SPAM compliance:** every email identifies the sender, includes a working opt-out line, and honors it. (Footer already half-built in `wrapEmailHtml` — extend with explicit "reply STOP" instruction at Phase 2.)
5. **Never medical claims, never pushy.** Same Yuri voice constraints as chat: trust-first, helpful, graceful exits. The sales motion is the relationship, not pressure — that's the entire brand.
6. **Scott visibility:** BCC on every autonomous send (Phase 2), weekly digest of threads/outcomes (Phase 3), suppressions queryable.

## AI-First plan

- **Model owns:** whether to reply, what to say, tone, when a thread is naturally over, opt-out *intent* recognition, escalation judgment. Surface-Facts-Do-Not-Instruct: the prompt gives the thread + visitor facts + the action vocabulary; no scripted phrasing, no decision trees.
- **Deterministic owns:** signature verification, address→visitor matching, suppression-list gating, touch caps, threading headers, logging. (Data linkage and safety rails, not judgment.)
- **Fail-safe:** any parse/generation failure → no send, forward raw email to `EMAIL_REPLY_TO`. The human fallback IS the error path.

## Model decision (recorded June 10, 2026)

**Build on `MODELS.primary` (Opus 4.8).** Fable 5 (2× cost: $10/$50 vs $5/$25 per MTok) is approved for consideration **only** if Phase 1 report-only drafts show Opus 4.8 measurably falling short on reply quality — judged by Scott against real drafts, not assumed. "Newest model" is not a reason; a measured deficiency is. (Decision made explicitly during the free-Fable-5 window to prevent future drift.)

## Learning loop (the overriding principle)

- **Judgment recorded:** every `ai_action` + reason + draft, timestamped in `ss_lead_emails`.
- **Least-gameable teacher:** did the nurtured visitor **convert**? Already wired — `attributeConversion()` stamps `converted_at`/`converted_user_id`, and `ss_subscriptions.lead_source` records origin. Nurture outcomes = join `ss_lead_emails` threads against conversions. Secondary teacher: reply-rate and opt-out-rate per thread (a rising opt-out rate is the agent failing, regardless of voice quality).
- **Feedback:** per-thread outcomes summarized back into the agent's context at Phase 3 ("threads where you did X converted at Y%"), same pattern as the nudge-outcome teacher.

## Cost estimate

Per inbound reply: one Opus 4.8 call with thread context ≈ 5–10K input / ~500 output ≈ **$0.04–0.07**. At even 100 replies/month: < $7/mo. Resend inbound: included/cheap at this scale (verify plan limits at build time). Cost is a non-issue; brand risk is the binding constraint — hence the phases.

## Kill conditions (decide-cold, written now)

- Opt-out rate > 10% of nurtured threads → pause autonomous mode, return to Phase 1.
- Any instance of Yuri sending after an opt-out → immediate kill, root-cause before re-enable.
- Nurtured-lead conversion no better than un-nurtured baseline after ~3 months of Phase 2/3 → the agent isn't earning its complexity; revert to Phase 0 + manual.

## Build-time checklist (when the gate opens)

1. Fresh `/ship-guard` with hypothesis + measurement. 2. `/ai-first-guard` on the implementation plan. 3. Enable Resend "Receiving" on seoulsister.com (Domains → Configuration) + verify plan supports inbound. 4. Migration `ss_lead_emails` (manual apply via Studio — MCP read-only). 5. `/api/email/inbound` with signature verification. 6. Retrofit outbound logging. 7. Phase 1 only. 8. `tsc` + `build` + `/ai-first-check`. 9. Update `EMAIL-ACTIVATION-CHECKLIST.md` + the launch nudge.

---

**Companion documents:** `NORTH-STAR.md` (the gate), `EMAIL-ACTIVATION-CHECKLIST.md` (the live pipeline this extends), `GUARDIAN-CHARTER.md` (the report-only → autonomous precedent), `NUDGE-OUTCOME-TEACHER-BLUEPRINT.md` (the graded-teacher pattern this reuses).
