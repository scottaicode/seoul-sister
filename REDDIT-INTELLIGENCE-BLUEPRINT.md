# Reddit Intelligence — Capture Now, Extract Later

**Created: Jul 13 2026**
**Status: Piece A (capture + attribution) SHIPPED. Piece B (extraction → Yuri) DEFERRED — unfreeze condition below.**

---

## The finding that started this

`glass_skin_atx` has **503 contributions, 1,205 karma**, Top 25%/10% Commenter badges, comments pulling **265–1,300 views each**, and a profile link to "Seoul Sister · ingredient checker."

`ss_widget_sessions` has recorded **ZERO reddit-sourced sessions. Ever.**

```
source            sessions   first_seen   last_seen
(none)                  41   2026-03-11   2026-07-09
blog                     1   2026-07-12   2026-07-12
best_cta                 1   2026-07-12   2026-07-12
ingredient_cta           1   2026-07-01   2026-07-01
reddit                   0        —            —
```

We cannot answer the question that decides whether this channel deserves the evenings being poured into it: **does Reddit send anyone to the site?**

That is the top of the *only* live acquisition funnel Seoul Sister has, and it was completely uninstrumented. Meanwhile every comment's outcome — the claim, the community's verdict on it, whether it drove a visit — evaporated the moment it was posted.

---

## ⚠️ READ THIS BEFORE YOU INTERPRET THE ZERO

**The 0 reddit-sourced sessions is NOT evidence the channel fails. It is the expected output of a deliberate four-month strategy that never pointed anywhere.**

It is written into LGAAS's own operating instructions — `SEOUL_SISTER_ONBOARDING_PROMPT.md:432`:

> *"Never link to seoulsister.com in Reddit responses (this triggers spam detection — let the helpful response build brand awareness organically)"*

From roughly **March–early July 2026**, `glass_skin_atx` posted **~500 genuinely helpful comments with zero links, zero CTAs, and zero mention of Seoul Sister.** That was intentional — the fear was an "AI agent"/spam ban, and the play was pure trust accumulation.

**The funnel opened in July 2026**, days before this document was written: a Social Link to Seoul Sister was added to the profile, and the bio copy now references the ingredient checker.

**Therefore:**
- The Reddit→site funnel has **never actually been tested**. It has existed for days, not months.
- A future session (or a future me) looking at `attributed_sessions = 0` and concluding *"Reddit doesn't convert"* would be **drawing a conclusion from a period in which conversion was structurally impossible.** Do not do this. I nearly did.
- The **4-month, 1,205-karma, Top-10%-Commenter, never-once-posted-a-link history is itself the asset.** It is exactly what makes a bio link read as credible rather than spammy. It is also exactly what gets burned by getting impatient.

### ADDENDUM Jul 21 2026 — there is a SECOND reason the zero is uninterpretable: the account went quiet

The section above explains the zero as *policy* (no link existed). True, but incomplete. A corpus review on Jul 21 found the channel also **stopped posting for seven weeks**:

| Period | Comments | Note |
|---|---|---|
| Mar 9 – May 18 (10 wks) | ~486 | Full cadence, ~50/wk |
| **May 19 – Jul 5 (7 wks)** | **0** | Channel silent |
| Jul 6 – Jul 14 | 14 | Thin restart |
| **Since the bio link went live (Jul 11)** | **~6** | |

**Roughly six comments have been posted since the funnel opened.** Reddit profile click-through runs ~1–2% of comment views; the three most recent comments drew 110 + 44 + 24 = 178 views, predicting **1–3 profile visits** before the further drop-off of scrolling to a sidebar link.

**Zero attributed sessions is the statistically expected outcome of ~6 comments.** It is not a weak CTA, not a broken link, and not a failed channel.

Verified Jul 21, so nobody re-derives it:
- Site side works — `TryYuriSection.tsx:182` reads `utm_source` first, ungated by `?ask=` (the Jul 13 fix `f1c1b3e` is live). A Reddit arrival *would* be tagged `source='reddit'`.
- The bio link is live and correctly labeled (`Seoul Sister · ingredient checker`), per BP108 spec. It sits below the fold in the profile sidebar, under Achievements/Settings — a real friction, but downstream of the volume problem.
- Account state: 1,270 karma, 535 contributions, 10 followers, 4 months age.

**Do not spend diagnostic effort on the CTA path until volume is restored.** You cannot measure a conversion rate on a denominator of six.

### The escalation ladder — ALREADY GOVERNED BY BP108. Don't freelance it.

The instinct after a good week is *"next we'll put subtle Seoul Sister / product references inside the responses."* **BP108 already anticipated that and formally HELD it as Stage 2**, gated on two conditions (`BP108-SEOUL-SISTER-SITE-SIDE-SPEC.md` → "Stage 1 → Stage 2 checklist"):

- [ ] GA4 shows a **non-trivial stream** of `utm_source=reddit` sessions (people actually click the profile link)
- [ ] **Several more weeks of clean posting** on `glass_skin_atx` — zero new AI flags, zero mod removals

That gate is correct and it should be honored. Independent of BP108, the same conclusion falls out of the economics:

The comments earn 265–1,300 views **because they carry no agenda**. The bio link converts precisely *because* the comment doesn't sell: a reader is helped, gets curious about who helped them, clicks. That is **pull**. Seeding product mentions inside answers inverts it to **push** — and r/koreanskincare's explicit rules (No Spam/no links, No Selling) plus, far more dangerous, the community's nose, punish that quickly. You would be **spending the exact asset that makes the channel work** in order to marginally shorten a path that already exists in the bio.

**The bar for "we got away with it" is NOT "I didn't get banned."** That bar is passed right up until it isn't, and by then the aged account is gone. **The bar is: does the bio link produce clicks?**

- **Yes** → the highest-trust, lowest-risk version of the funnel works. There is no reason to buy ban risk for a marginal gain. **Stop escalating.**
- **No**, after several weeks of active posting → the live question is whether the **CTA path** is weak (safely fixable: bio copy, link label, landing target) — *not* "I must sell inside comments." In-comment promotion is the **last** lever, pulled only on evidence the safe version failed.

**The 4-month, 1,205-karma, Top-10%-Commenter, never-once-posted-a-link history is the asset.** It is what makes the bio link read as credible rather than spammy — and it is precisely what impatience burns.

---

## The two loops (and why only one of them is Seoul Sister's)

The instinct is to build "a Reddit learning loop." But there are **two** loops here with two different teachers, and conflating them is the design error:

| | **Marketing loop** | **Domain-knowledge loop** |
|---|---|---|
| Learns | "what kind of comment earns upvotes" | "Real Barrier Light has 5 essential oils; topical PDRN is mostly marketing" |
| Teacher | upvotes / karma | upvotes **+ expert pushback on a factual claim** |
| Generalizes across LGAAS subscribers? | **Yes** — "credit the prior commenter, end on a question" helps a plumber too | **No** — K-beauty INCI facts are worthless to a plumber |
| Owner | **LGAAS** | **Seoul Sister** |

**LGAAS already owns the first loop** — its dashboard has a permalink field labeled *"Required for upvote learning."* It works, it generalizes across subscribers, **don't touch it, and don't send LGAAS a blueprint for it.**

The second loop is Seoul-Sister-specific: those claims feed *Yuri* and the *catalog*. LGAAS has no `ss_products`, no Yuri, no INCI — the claims would sit there inert. **Nothing in this document goes to LGAAS.**

---

## Piece A — CAPTURE + ATTRIBUTION (SHIPPED)

Growth/measurement — the always-allowed lane under the `NORTH-STAR.md` freeze.

- **`ss_reddit_intel`** (`scripts/migrations/create_ss_reddit_intel.sql`) — one row per comment, keyed on `permalink` (idempotent; re-runs *refresh* the score, because a comment's score isn't final for hours or days and watching the teacher's verdict move is the point).
- **`src/lib/reddit/intel.ts`** — `fetchAuthorComments()` + `captureComments()`. Reuses the existing Reddit OAuth client (`src/lib/reddit/oauth.ts`) that `scan-reddit-mentions` already uses. Reddit now blocks unauthenticated JSON reads, so OAuth is required — which is why this runs as a cron (creds live in Vercel), not a local script.
- **`/api/cron/capture-reddit-intel`** — daily 8:45 AM UTC. $0 (Reddit API is free; no AI calls). Logs a loud `console.error` on a zero-result run when the corpus is non-empty — the scraper-zero-result silent-failure class that let Olive Young rot for two weeks.
- **Attribution** — counts `ss_widget_sessions.source = 'reddit'`. **Currently zero. That is the finding, not a bug.**

### ⚠️ THE LINK IS ALREADY TAGGED — DEFER TO BP108, NOT TO THIS DOC

**This is the authority correction.** LGAAS already owns the Reddit-bridge design, and it is good work. Read it before touching anything here:

- `lgaas/lgaas-blueprint/108-REDDIT-DISCOVERY-BRIDGE.md`
- `lgaas/docs/BP108-SEOUL-SISTER-SITE-SIDE-SPEC.md`
- `lgaas/docs/BP108-SEOUL-SISTER-GA4-VERIFY.md`

Per BP108 (Stage 1, executed and **verified end-to-end 2026-07-11**), the profile Social link is:

```
https://www.seoulsister.com/?utm_source=reddit&utm_medium=social&utm_campaign=profile
```

label: `Seoul Sister · ingredient checker`

**It is `utm_source`, NOT `?from=`.** An earlier draft of this document told Scott to set `?from=reddit`. That was wrong, it contradicted a working spec, and it would have created a second, competing convention. Do not do it. The UTM params are what GA4 reads, and GA4 is BP108's attribution surface.

### The real gap this feature found (SITE-SIDE BUG — now fixed)

BP108's Action B assumed GA4 attribution is sufficient. It isn't, for the question we most need answered.

`TryYuriSection.tsx` captured the visitor's source **only if the URL had an `?ask=` param** — the source read sat *below* an `if (!params.has('ask')) return` early-return. The BP108 Reddit link has **no `ask` param**. So every Reddit arrival fell straight through: `sourceRef` stayed null, and the widget session was written **untagged**.

Consequence: GA4 could see the **landing**, but `ss_widget_sessions.source` could never say `reddit` — so we could not answer the step that actually matters, **"did the Reddit visitor talk to Yuri?"** That is why the table shows zero, and it would have kept showing zero forever no matter how well the channel performed.

**Fixed (Jul 13 2026):** source capture now runs on *every* arrival and reads `utm_source` first, falling back to `?from=` for the internal feeder CTAs. Prefill/scroll behavior stays gated on `?ask=`, unchanged.

### What Scott still needs to do

1. **Verify GA4 attribution** — BP108 Action B / the GA4-VERIFY doc. Incognito → the profile link → GA4 Realtime → confirm `reddit / social`.
2. **Then just post.** The link is live, the tagging is live, and the widget will now record `source='reddit'` for anyone who arrives and chats.

---

## Piece B — EXTRACTION → YURI (DEFERRED)

### Why it's deferred, in plain terms

`/ship-guard` held this, and the hold was correct. The justification offered for it was *"it's the moat"* and *"Yuri would kill for these heuristics."* Both are **product-improvement claims wearing a strategy costume** — the exact automatic-rejection language in the gate.

The steelman was: *strangers bounce at message 1; a Yuri who answers hard ingredient questions as well as glass_skin_atx does would hold them.* That's falsifiable. **And the evidence already falsifies it:** the two cold-stranger conversations on record were both graded *"deep, honest, high-quality — Yuri excellent."* She did not fail them on ingredient knowledge. They still didn't pay.

The bottleneck is **not** "Yuri doesn't know enough INCI."

And the deeper trap: **"build the moat" is the most seductive over-building rationalization available**, because it is *true* and it is *never urgent*. The corpus is worthless without users; users do not arrive because the corpus exists. **The moat is a multiplier on demand, not a substitute for it.**

**Deferring costs nothing.** These comments are permanent public records. Reddit isn't deleting them. The corpus banks *today* via Piece A, and extraction can run any time — next month, or the day after the first paying stranger. **Nothing is lost by waiting. Everything was being lost by not capturing.**

### Unfreeze condition (explicit — do not build before this)

Piece B unfreezes when **both** hold:

1. **Reddit→site attribution is live and non-zero.** `ss_reddit_intel.attributed_sessions > 0`, i.e. we can prove Reddit sends real humans to the widget.
2. **A falsifiable conversion hypothesis exists**, of the shape: *"Reddit-sourced strangers reach Yuri and drop at rate X on hard ingredient questions; feeding her community-validated claims should move X."* With a metric and a read date.

Absent both, the One Metric (visitor→paid conversion, currently **0**) says: don't build.

### The design (ready to execute when it unfreezes)

**The teacher — and this is the part worth preserving.** Per the owner's overriding learning-loop principle: *find the LEAST-GAMEABLE teacher in the domain.* Here it is, and it's free:

- **Upvotes** on a specific factual claim, from ingredient-literate strangers.
- **Public correction by a knowledgeable peer** — a *dated, public, graded error*. `was_corrected` / negative score. r/koreanskincare is full of people who read INCI lists for fun. A claim that survives them is validated; a claim they contradict is a labeled mistake.

That is a genuinely honest grader, and it is exactly the shape the principle asks for.

**Extraction (Opus, `ss_reddit_intel.extracted_claims`)** — per comment, pull structured claims:

```json
[{ "product": "Real Barrier Extreme Cream",
   "brand": "Real Barrier",
   "claim": "only essential oil is lavender; the Light version and Special Set carry sage, patchouli, cardamom, chamomile, juniper",
   "claim_type": "formulation_variant",
   "community_verdict": "corrected_then_refined",
   "score": -3 }]
```

Claim types worth capturing (all observed in the real corpus):
- `formulation_variant` — Real Barrier Extreme vs Light vs Special Set (**not in `ss_products`**)
- `regional_reformulation` — Round Lab Birch Juice US/Ulta uses avobenzone/homosalate/octisalate; the Asian version uses triazine-family filters (**invisible to the catalog**)
- `diagnostic_heuristic` — *immediate stinging = filter/preservative reaction; deep lumps surfacing 1–2 days later = pore-clogging emollient* (**Yuri has nothing like this**)
- `efficacy_judgment` — topical PDRN is mostly marketing, the molecule's too big
- `sleeper_ingredient` — panthenol outperformed centella in practice
- `product_critique` — Some By Mi: peppermint oil + BHA % too low = more irritation than exfoliation

**Two sinks:**
1. **Yuri** — validated claims into the existing corrections/insight layer. Note the *corrections* subset is the highest value: it stops Yuri confidently repeating a claim the community already rejected, on the one surface where trust *is* the product.
2. **Catalog** — formulation variants, regional reformulations, essential-oil flags. These are real gaps in `ss_products` that no scraper will ever find.

**Do not build any of this until the unfreeze condition is met.**

---

---

## FIRST CAPTURE — Jul 13 2026 (the corpus is live)

```
fetched 500 · inserted 500 · negative 2 · reddit_attributed_sessions 0
span: 2026-03-09 → 2026-07-14 · 6 subreddits · top score 89
77 comments scored 5+   ·   31 scored 10+
```

**The corpus is real.** Highlights of what the community actually validated:

| score | what it was |
|---|---|
| **89** | Centellian24 / Madeca is huge in Korea, in every Olive Young |
| 68 | why K-beauty overwhelm is normal, and how to cut through it |
| 57 | the clinic brands nobody reps (Aestura Atobarrier 365…) |
| 55 | the water-sheeting test for checking sunscreen removal |
| 49 | the pore angle nobody in the thread had mentioned |
| **42** | **Hwahae (화해) is THE app Koreans use to research skincare** |

That 42-upvote comment is Seoul Sister's founding thesis — *"Hwahae for the world"* — independently validated by 42 strangers who didn't know they were validating it.

### The two graded errors, and a warning about how to read them

Only **2 of 500** comments went negative, and **neither is factually wrong**:

- **−3, "Barrier repair skincare"** — the Real Barrier Extreme Cream fragrance claim. It is **CORRECT** (verified against `ss_products` INCI on Jul 13: the regular Extreme Cream's only essential oil *is* lavender; the *Light* version and Special Set carry sage/patchouli/cardamom/chamomile/juniper). It was downvoted anyway.
- **−3, "VT Reedle Shot 100"** — also substantively sound.

**Do not naively treat `score < 0` as "the claim was wrong."** The Real Barrier comment was downvoted for **pushing back on another commenter**, not for being inaccurate. The teacher here is grading *social register*, not just factual accuracy, and it grades them on the same axis.

This matters enormously for the deferred extraction (Piece B): an extractor that reads downvotes as "this claim is false" would learn the **opposite** of the truth from this exact row, and could teach Yuri to *unlearn* a correct fact. Any extraction pass **must separate "was the claim wrong" from "did the delivery land"** — and the only reliable way to grade the first is to check the claim against `ss_products` INCI, as was done here. Upvotes alone are not a fact-checker.

---

## THE REACH FINDING — top-level beats replies, and it is not close (Jul 21 2026)

The corpus answered a question nobody had asked it: **what distinguishes the comments that got reach from the ones that didn't?** It is not topic, subreddit, or length. It is **format**.

**All 15 of the top-scoring comments in the corpus are top-level (`is_reply = false`). All fifteen.** The corpus is 51% replies, so chance alone would put ~7 replies in that set. It put zero.

| Format | n | Avg score | Median | Comments ≥15 pts | Hit rate |
|---|---|---|---|---|---|
| **Top-level** | 246 | **5.84** | 2 | **21** | **8.5%** |
| **Reply** | 254 | **1.59** | 1 | **0** | **0.0%** |

**A reply has never once scored ≥15 in 254 attempts.**

**This was checked for the obvious confound and survives it.** r/AsianBeauty is both the best-performing sub *and* the lowest-reply sub, so the effect could have been AsianBeauty in disguise. It is not — it holds independently **within every single subreddit**:

| Subreddit | Top-level avg | Reply avg | Ratio |
|---|---|---|---|
| AsianBeauty | **14.61** (n=31) | 1.60 (n=20) | 9.1× |
| koreanskincare | **5.87** (n=103) | 1.64 (n=121) | 3.6× |
| KoreanBeauty | **4.08** (n=37) | 1.48 (n=29) | 2.8× |
| 30PlusSkinCare | **3.67** (n=15) | 1.00 (n=5) | 3.7× |
| SkincareAddiction | **2.95** (n=58) | 1.58 (n=78) | 1.9× |

**Current behavior is inverted**: the Jul restart comments are all deep-thread replies. They are *good* comments — helpful, specific, ending on a question — just in the format that has never produced reach.

### ⚠️ CORRECTION (same day) — the replies are MANUAL. LGAAS already posts 100% top-level.

**The first version of this section concluded "tell LGAAS to post top-level." That was wrong, and the error was analyzing Seoul Sister's data without reading LGAAS's code.**

`lgaas/api/reddit-response.js:1571` — the pipeline's only call to `postComment()`:

```js
// Reddit fullname format: t3_postid for posts
const parentFullname = `t3_${response.post.reddit_post_id}`;
```

`t3_` = a **post**; `t1_` = a **comment**. The prefix is hardcoded, so **the LGAAS pipeline cannot post a reply to another comment.** Everything it generates is top-level.

**So the 254 replies in this corpus were hand-posted**, not generated. The finding holds; its owner changes. The high-performing format is already automated — **the low-performing one is the human.**

Second reply source, and it is legitimate: `lgaas/api/reddit-reply-tracker.js` has `generate_followup` / `mark_followup_posted` — LGAAS *drafts* replies to people who respond to us, a human posts them. That is a **conversational obligation, not a reach play.** Answering someone who asked you a direct question is correct even at avg 1.59. Do not optimize it away by ignoring people.

The split is stable across all 13 weeks of the corpus (top-level beat replies every single week, no exceptions), so this is not a phase or a drift — it is structural.

**Subreddit allocation is also misallocated.** r/AsianBeauty (avg 9.51, n=51) is the best sub and under-served; r/SkincareAddiction (avg 2.16, n=136) is the worst and consumes 27% of all effort.

⚠️ **Also already known to LGAAS.** `lgaas/api/reddit-response.js:1462-1470` (Blueprint 39) documents the identical finding from LGAAS's own data — *"r/AsianBeauty avg 14.48 upvotes/reply vs r/SkincareAddiction avg 2.87"* — and `handleSubredditStats` already surfaces per-sub avg/median/hit-rate as review-queue chips. Seoul Sister's independent numbers (14.61 / 2.95) **confirm** it rather than discover it. It is decision support for whoever works the queue, not automatic weighting.

**Why this matters for the escalation question**: reach is the safe lever and it is **untouched**. Two zero-risk changes (post top-level; reweight subs) sit in front of the risky one (in-comment promotion). Trading a 4-month aged account for marginal gain while the free levers are unused would be a bad trade. Note also that the **89-point all-time best comment is the *least* promotional thing in the corpus** — pure Korea-vs-international information gap, zero product push. The evidence says promotion is not what earns reach here.

**Actioned**: `LGAAS-WORK-ORDER-REDDIT-REACH.md` (Jul 21 2026) — top 5 winning comments verbatim as format models, their shared anatomy, and a dated prediction + review date (~Aug 11) under the Learning Loop principle. It restates the no-links/no-mentions guardrails explicitly, because "improve our results" is exactly the phrasing a model could over-read as license to promote. **Read its §0.5 correction first** — two of its three actions were already built, and the net LGAAS model work is close to zero.

**METHOD LESSON — worth more than the finding itself.** Two of three recommendations in that work order were already shipped in LGAAS, because the analysis ran on Seoul Sister's data without reading LGAAS's code. Convergent evidence across two independent datasets (SS 14.61/2.95 vs LGAAS 14.48/2.87) confirmed the *finding* was real — and that felt like validation, which made it easier to skip checking whether the *fix* already existed. **A cross-system recommendation is not finished until you have read the other system's code.** The same trap is live for any future Seoul Sister → LGAAS work order.

⚠️ **`views` is NULL on all 500 rows** — the Reddit API does not expose it to this capture path, so **score is a proxy for reach, not reach itself.** Live profile screenshots showed a 3-upvote comment at 24 views and a 1-upvote at 110. Correlated, not identical. Do not over-fit to score alone; if view data ever becomes capturable, re-run this analysis against it.

---

---

## Before you call an LGAAS draft "fabricated" — check the instrument

**I got this wrong twice in one evening (Jul 13 2026). Don't repeat it.**

LGAAS enforces a hard grounding rule (`api/reddit-response.js:2754`): *any* ingredient / formulation / "contains X" claim **must** trigger `web_search` before a single word of the reply is written. And the outcome is **logged**, so you never have to guess whether she looked it up.

**Query LGAAS's Supabase (not Seoul Sister's):**

```sql
select created_at,
       metadata->>'web_search_fired'  as searched,
       metadata->'web_search_queries' as queries,
       metadata->'missing_products'   as flagged
from lgaas_ai_usage
where feature = 'REDDIT_SEARCH_OUTCOME'
order by created_at desc limit 10;
```

⚠️ Use **`REDDIT_SEARCH_OUTCOME`**, not the `web_search_fired` field on `REDDIT_RESPONSE` rows — that one is a **pre-call snapshot** and reads `false` on all ~546 historical rows *even when search actually fired*. BP108 added the post-call breadcrumb precisely to fix that. (A textbook case of instrumentation encoding the error.)

**My two misses, for the record:**
1. Called the SKIN1004 cart draft "fabricated INCI" (vit C + tranexamic acid). It was **true** — my `ss_products` query used a `LIMIT 5` + name filter that excluded the exact product. The log showed 4 real searches.
2. Said the Cetaphil niacinamide claim came from "model knowledge." The log showed `web_search_fired: true`, query `"Cetaphil gentle skin cleanser ingredients"`. She grounded it correctly (Cetaphil is a Western brand and legitimately **not** in `ss_products` — web search is the right fallback).

**The rules that fall out:**
- **"Absent from my sample" ≠ "absent from the data."** Query the full matching set before concluding a product isn't in the catalog.
- **Check `REDDIT_SEARCH_OUTCOME` before alleging fabrication.** Ten seconds.
- Verifying a specific checkable claim before posting is still correct and worth doing — just verify it *properly*, and don't turn a verification miss into a bug report against a system that behaved correctly.

---

## What to do next (in order) — REVISED Jul 21 2026

> **The original list is superseded.** Steps 1–3 are done, and step 2 was the `?from=reddit` error this document corrects above (it is `utm_source`, per BP108 — never re-add it). Step 4's premise — "read `attributed_sessions` in ~2 weeks and let it decide whether Reddit is a real channel" — was **wrong given ~6 comments posted**. Reading a conversion rate off that denominator would retire a channel that was never given a chance to perform. The corrected sequence:

1. ✅ **DONE** — migration applied, corpus live (500 comments, Mar 9 – Jul 14), `capture-reddit-intel` cron banking daily at $0.
2. ✅ **DONE** — profile link live and correctly tagged (`utm_source=reddit&utm_medium=social&utm_campaign=profile`); site-side capture fixed Jul 13 (`f1c1b3e`).
3. **RESTORE VOLUME.** ← highest-leverage action in this document. Nothing else here matters at ~1 comment/day. Target the March cadence.
4. **Manual posting habit** — when commenting by hand, prefer top-level on a rising post over a deep-thread reply, and follow the BP39 subreddit chips already in the LGAAS review queue. ⚠️ This is NOT a pipeline change: LGAAS already posts 100% top-level and already surfaces the sub stats. Optionally feed the §5 format anatomy from `LGAAS-WORK-ORDER-REDDIT-REACH.md` into the drafting prompt — lowest priority, the pipeline already produced the 89-point winner.
5. **THEN read attribution, ~Aug 11 2026** (or once 100+ comments have accumulated) — GA4 `utm_source=reddit` first (did they arrive?), then `ss_widget_sessions.source='reddit'` (did they talk to Yuri?). Only a number built on real volume is worth interpreting.
6. **Route the outcome correctly.** Reach up + sessions > 0 → Stage 1 works, don't escalate. Reach up + sessions still 0 → the **CTA path** is the problem (bio copy, link label, landing target) — *still not Stage 2*. Reach flat → the format change failed; diagnose that before considering anything riskier.
7. **Then, and only then**, revisit Piece B (extraction → Yuri) and the BP108 Stage 2 gate.
