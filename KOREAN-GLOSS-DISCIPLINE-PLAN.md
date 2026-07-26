# Korean Gloss Discipline — Plan & Decision Record

**Date**: July 25–26 2026
**Trigger**: Bailey, on a live mobile scan of COSRX Snail 96: *"Way too much Korean."*
**Status**: SHIPPED July 26 2026. Four-reviewer adversarial pass complete; all four found real
defects in the first draft and all were fixed before any code was written. 12 guard tests
(6 verified to fail when their bug is reintroduced), 107/107 suite, `tsc` clean, AI-First PASS.

## POST-SHIP AUDIT — run this ~2 weeks out (the actual teacher)

The passing test proves the words are in the file. It proves NOTHING about Yuri's behavior.
Re-run this with the deploy timestamp; **success requires BOTH columns to move the right way.**

```sql
WITH msgs AS (
  SELECT 'widget' AS surface, content FROM ss_widget_messages
    WHERE role='assistant' AND created_at > TIMESTAMP '2026-07-26 05:00:00+00'
  UNION ALL
  SELECT 'app', content FROM ss_yuri_messages
    WHERE role='assistant' AND created_at > TIMESTAMP '2026-07-26 05:00:00+00'
)
SELECT surface,
  count(*) FILTER (WHERE content LIKE '%피부과%')                          AS referral_msgs,
  count(*) FILTER (WHERE content LIKE '%피부과%' AND content !~* 'dermatolog') AS bare_referrals,
  count(*) FILTER (WHERE content ~* '(mole|lesion|melanoma|biopsy)')       AS lesion_msgs,
  count(*) FILTER (WHERE content ~* '(mole|lesion|melanoma|biopsy)'
                     AND content LIKE '%피부과%' AND content !~* 'dermatolog') AS lesion_bare
FROM msgs GROUP BY surface;
```

**Baseline at ship (both surfaces, all time):** 78 referral msgs / **55 bare** / 19 lesion msgs
/ **10 lesion-bare**.

- **PASS**: `bare_referrals` → ~0 AND `lesion_bare` = 0, **while `referral_msgs` holds or rises.**
- **REGRESSION**: `bare_referrals` falls because `referral_msgs` fell — that means Yuri is
  referring LESS to dodge the phrasing. This is the chilling effect, it is worse than the
  original bug, and it is invisible unless the denominator is tracked. Revert immediately.
- Needs ~2 weeks / ~150 widget assistant messages to be meaningful.

**Rollback**: single atomic commit; `git revert --no-edit <sha>` (includes the guard test, so
the suite stays green). Prompt-only — no schema, no client, no migration. In-flight sessions
are unaffected because the system prompt is rebuilt per request.

**Voice-degradation tripwire**: Bailey/Lynndon reporting Yuri reads stiff or over-explains, or
gloss density climbing (over-glossing is the predicted failure mode — the rule is once per
conversation, not once per sentence).

---

## 1. The complaint, and why it is not just taste

Bailey has raised Korean-heaviness before. Tonight's screenshot made it concrete, and a
database audit proved it is not one person's preference — it is a measurable habit with a
**clinical-safety edge**.

### Measured state (before change)

| Surface | Assistant messages | Contain Korean | % |
|---|---|---|---|
| Widget (anonymous, cold prospects) | 219 | 93 | **42.5%** |
| App Yuri (authenticated) | 345 | 78 | **22.6%** |

### The term-level finding (the real problem)

| Term | Uses | Glossed inline | Bare |
|---|---|---|---|
| 피부과 (dermatologist) | 55 | 16 | **39** |
| 미백 (brightening) | 22 | 13 | 9 |
| 기능성화장품 (functional cosmetic) | 10 | 8 | 2 |
| 화이팅 (you got this) | 3 | **0** | 3 |

**39 of 55 uses of 피부과 carry no translation anywhere in the message.** Real examples
shipped to real users:

> "that's a **피부과** conversation, not a serum problem"
> "don't be shy about the **피부과** if it keeps cycling"
> "Take it to your **피부과** and you'll be ahead of most patients who walk in"

This is the single most consequential thing Yuri says. A dermatologist referral is her
safety valve — the thing she reaches for on hormonal acne, on a suspicious lesion, on a
flaring medical condition. **Encoding it in a script the reader cannot read is correct
judgment, undelivered.** It is the Clinical Data Honesty principle failing at the last inch.

Caroline (Bailey's friend, cold-testing tonight) received exactly this: a strong, correct
push toward a dermatologist for suspected hormonal acne, with the operative word in Korean.

## 2. Root cause — the prompts literally instruct this

This is not model drift. Three prompts explicitly order it, and one of them names 피부과
as an example to use:

- `src/lib/yuri/advisor.ts:51` — *"Use Korean terms naturally: 화해, 피부과, 미백,
  기능성화장품, 더마. Brief inline translations, not parenthetical essays."*
- `src/app/api/widget/chat/route.ts:172` — *"Use Korean terms naturally: 화해 (Hwahae),
  피부과 (dermatology), 미백 (brightening), 기능성화장품 (functional cosmetics)"*
- `src/lib/yuri/onboarding.ts:76` — *"Use Korean terms naturally: 피부 타입 (skin type),
  수분 (hydration), 피지 (sebum), 각질 (dead skin cells)"*

Note the asymmetry that explains the data: the widget and onboarding lines *model* the
gloss inside the instruction itself, and score better. The advisor line says "brief inline
translations, **not** parenthetical essays" — read as discouragement from parentheses, and
the advisor surface is where bare terms cluster.

## 3. What we are NOT changing (guard against overcorrection)

Bailey's screenshot contains three different sources of Korean. They are not the same thing
and must not receive the same fix:

1. **`어드벤스드 스네일 96 뮤신 파워 에센스` under the product name** — a UI field
   (`product_name_ko`, `ScanResults.tsx:277`). This is the actual Korean product name.
   **KEEP.** It is how a user verifies the right bottle was scanned, and it is the visible
   proof that Seoul Sister reads Korean labels. Removing it removes the differentiator.
2. **`(저자극 테스트 완료)` in Key Highlights** — AI-generated from the label, and already
   correctly glossed as "Low-irritation tested." **KEEP.** This is the target pattern.
3. **Yuri's chat prose** — the 42.5% / 22.6% surface, where bare terms live. **FIX HERE.**

**The rule is not "remove Korean." Korean-with-translation is the brand.** Bare Korean is a
comprehension tax on a US audience who mostly cannot read Hangul.

## 4. The change

A prompt-level instruction, not a regex. Which Korean term serves a given reader in a given
sentence is a judgment call — exactly what Yuri should own (AI-First Principle 2, and the
Yuri Sole Authority Principle). A post-processor that force-appends translations would be
the rigid-rules anti-pattern, and the June 23 + July 25 `voice-cleanup` incidents are two
proofs that regex over Yuri's prose destroys meaning.

**The rule to install on all three surfaces:**

- First use of any Korean term **in a given message** carries a plain-English gloss.
  Subsequent uses in that same message do not need to repeat it.
- **Referrals lead in English.** "See a dermatologist (피부과)" — never "that's a 피부과
  conversation." Comprehension of a medical instruction is never optional.
- Korean is seasoning, not proof of expertise. If a term is not carrying weight the English
  wouldn't, drop it.

## 5. Risks this review must rule out

| # | Risk | Why it matters |
|---|---|---|
| R1 | Overcorrection → Yuri strips Korean entirely, losing the differentiator | Korean-with-gloss is the brand; the memory note on capability honesty warns against sanding out ambition |
| R2 | Gloss bloat → every reply reads like a textbook with parentheses everywhere | The advisor prompt's original "not parenthetical essays" existed for a reason |
| R3 | Voice flattening → Yuri stops sounding like a Seoul insider | Her voice IS the product |
| R4 | Prompt-cache invalidation on the widget | v11.1.0 regression: editing the cached block silently killed the cache (60x cost). `YURI_WIDGET_SYSTEM` sits in the `cache_control` block — editing it re-primes the cache once (acceptable, one-time) but must NOT make it per-turn dynamic |
| R5 | Contradicting a nearby instruction | Each prompt has adjacent voice rules; the new line must not fight them |
| R6 | Onboarding regression | Onboarding is Caroline's next step tonight — cannot break it |

## 6. Verification plan

- Multi-agent adversarial review (incl. a Fable 5 reviewer) on the exact diff, per owner request.
- `/ai-first-check` on the diff: the change must add *judgment guidance*, never a script or cap.
- Guard test asserting the gloss rule exists on all three surfaces AND that no surface has
  reverted to bare-term encouragement.
- `npm test` (95 existing) + `npx tsc --noEmit` green.
- Post-ship: re-run the term audit above. Success = 피부과 bare-use rate trends toward zero on
  NEW messages. Historical rows are immutable and are not backfilled.

## 6b. Multi-agent review findings (July 26 2026) — PLAN AMENDED

Four independent reviewers (voice/Fable 5, clinical safety, architecture+cache, testing) were
run against the exact draft wording. Two returned before execution and **both found real
defects in the draft**. Every claim below was independently re-verified against the source
before acceptance.

### Accepted — draft wording was WRONG (voice review, Fable 5)

1. **The draft fixed frequency, not coverage.** "Korean terms are seasoning, not proof of
   expertise… reach for one when it carries something English doesn't" flips Korean from
   default-ON to default-OFF. The measured defect is **gloss coverage (16/55)**, not that
   Korean appears. Overcorrecting to near-zero Korean destroys the differentiator and solves
   a complaint nobody made. **The dial is "always translated," not "rarely used."**
2. **The draft deleted a brake that was earned.** The old advisor line ended *"Brief inline
   translations, not parenthetical essays."* Dropping it uncaps gloss length. **Keep it.**
3. **Self-contradiction.** Draft onboarding text called Korean "friction, not charm" while
   `onboarding.ts:98` says *"Use your voice: casual, Korean terms, insider energy."*
   VERIFIED. Line 98 must be edited in the same change or the clause dropped.
4. **Wrong scope unit.** "First use per *message*" re-glosses the same term to the same
   subscriber every reply forever. Correct unit is **per conversation** (history is in
   context on both surfaces; the widget rehydrates transcripts per v11.2.0).
5. **Reframe the gloss as the insider move** — Yuri is the bilingual friend translating
   Seoul, not someone apologizing for her Korean.

### Accepted — scope was INCOMPLETE (architecture review)

The plan named 3 files. The real surface count is **8**. Two are non-optional:

- **`src/lib/yuri/specialists.ts`** — densest Hangul in the codebase and **injected into the
  same conversation** the advisor edit governs (`advisor.ts:378-380` → system block at
  `advisor.ts:967`). VERIFIED. Unglossed 피부과 at lines 57, 135, 140, 201; unglossed
  꿀피부/구름 피부 at 139; 올영세일 at 135/171.
- **`src/lib/intelligence/skin-breakdown.ts:95`** — instructs the **exact opposite**:
  *"Korean terms where they fit naturally — 화해, 피부과, 미백, 기능성화장품 — never define
  them with parenthetical essays."* VERIFIED. Shipping without this leaves two Yuri surfaces
  under contradictory instructions.

Also in scope: `src/lib/intelligence/product-curation.ts:1250` (*"Use Korean terms naturally
where they land"*), `src/lib/email/lead-email.ts` (cold-lead recap email — read with **no
chat context**, highest unglossed risk), `src/app/api/cron/proactive-nudge/route.ts`.

NOT in scope (static UI where English sits adjacent): `skin-score/route.ts` dimension labels,
`ScoreRadarChart.tsx`, `glass-skin/page.tsx`, `TryYuriSection.tsx`, `support/page.tsx`.

### Accepted — one amendment to the referral rule (architecture review)

The literal script `"See a dermatologist (피부과)"` edges into scripted phrasing (AI-First
guard item 3: never script exact copy). **Keep the tripwire** (`never "that's a 피부과
conversation"` — forbidding a concrete bad output is explicitly permitted) but return the
phrasing to Yuri: *the English word leads, the Korean rides along.*

### Confirmed safe

- **Prompt-cache**: `YURI_WIDGET_SYSTEM` is a module-level const in cached block 1;
  `dynamicContext` is a separate UNCACHED block (`route.ts:627-632`). VERIFIED. Editing
  static text = **one-time re-prime**, NOT the v11.1.0 per-turn class. All proposed strings
  are pure literals with zero `${}` interpolation.
- **AI-First**: PASS. The change replaces an existing directive, supplies a fact Yuri cannot
  infer (most readers can't read Hangul), and adds one legitimate tripwire.
- **Prompt layer, not regex**: unanimous. A gloss regex would require *semantic generation*
  (choosing a translation), repeats the Jun 23 + Jul 25 content-destroying incidents, and —
  decisively — `cleanYuriResponse` runs AFTER streaming (`route.ts:724`), so it could never
  fix what the user actually reads. **Ship no regex.**

### Accepted — the clinical review found the ACTUAL root cause and a worse number

**Re-measured against the live corpus (both surfaces), independently verified:**

| Metric | Value |
|---|---|
| Messages containing 피부과 | **78** |
| Of those, containing NO English "dermatolog*" anywhere | **55** |
| Messages discussing mole/lesion/melanoma/biopsy | 19 |
| Lesion messages using 피부과 | 12 |
| **Lesion messages that are Korean-only (no English derm word)** | **10** |

The §1 figure (55 uses / 39 bare) understated it. **The highest-stakes referral class in the
product — possible skin cancer — is the one most likely to ship in a script the reader cannot
read.** Ten real messages. This is the argument for the change.

**ROOT CAUSE (verified, and the original plan missed it entirely):** the three clinical rules
themselves model Korean-first —
- `advisor.ts:199` — *"recommend 피부과 (dermatologist) for persistent issues"*
- `route.ts:293` — same
- `onboarding.ts:131` — same

Yuri has been copying the demonstrated example. **Fixing these three lines is the
highest-leverage, lowest-risk edit in the change, and the original draft did not touch them.**

**Placement error (accepted):** putting a clinical invariant in the VOICE section makes it
negotiable against personality. It sits beside emoji rules and "Bourdain energy / have
OPINIONS" (`advisor.ts:56-66`) — and "that's a 피부과 conversation" IS the punchier line, so
the rule already lost that trade once. The invariant moves to the clinical rules and is marked
LOAD-BEARING; only a pointer stays in VOICE.

**Three trivial-satisfaction loopholes (accepted):**
1. Korean-first gloss `피부과 (dermatologist)` technically "glosses" while still leading with
   the unreadable word → state the ordering constraint literally: **the English word appears
   before the Hangul.**
2. Gloss-once-per-message lets the *operative* closing sentence revert to bare Korean →
   **referrals are exempt from the once-per-message allowance.**
3. Adjectival use ("피부과-grade") isn't a referral at all → **scope the rule to the ACT of
   referring, not the token.** This also catches lesion/infection/rash paths that never use
   the word 피부과.

**CHILLING-EFFECT RISK (accepted — the most important safety catch):** deleting 피부과 from the
allowlist (which my draft did) signals "this word is fraught." The cheapest way to satisfy a
fraught rule is to *avoid the situation* — softening "that's a 피부과 conversation" into "worth
keeping an eye on." That trades an unreadable referral for **no referral**, which is strictly
worse. Mitigations, both required:
- **Keep 피부과 in the allowlist**, in corrected English-leading form.
- **Add an anti-hedging floor**: this changes wording only, never the threshold — refer as
  readily as before or more. Every other referral rule in this codebase already pairs weight
  with such a floor (`advisor.ts:281`, `route.ts:241`); my draft had weight and no floor.

**Teacher refined:** success = unglossed count → ~0 **while total referral count holds or
rises**. If unglossed falls because referrals fell, that is the regression — and it is
invisible without tracking the denominator.

### Logged as separate tech debt (NOT this change)

- `onboarding.ts:618` marks a block containing per-turn `JSON.stringify(extractedSoFar)` as
  cached — the v11.1.0 bug class still live on the onboarding surface. `advisor.ts:961-971`
  got the proper split; onboarding never did.

## 7. Teacher (Learning Loop)

The objective teacher is the **bare-Korean rate on new assistant messages**, measured by the
same SQL as §1 — not a vibe check. Secondary human teacher: Bailey and Caroline stop
reporting confusion. If the bare rate does not fall, the prompt wording is wrong and the fix
is better wording, not a regex.
