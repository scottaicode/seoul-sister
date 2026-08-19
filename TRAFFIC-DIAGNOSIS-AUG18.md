# Traffic Diagnosis & Funnel Placement Fixes — Aug 18 2026

Companion to `GEO-STRATEGY.md` (citation strategy) and `NORTH-STAR.md` (the freeze).
This file is the record of what was measured, what was WRONG, what shipped, and
what was deliberately NOT shipped.

---

## The measured situation

| Metric | Value | Source |
|---|---|---|
| GSC impressions (window `2026-07-17`→`2026-08-13`) | 11,209 | `ss_seo_reports` — NOT "last 28d"; 5 days stale |
| GSC clicks / 28d | 64 (**0.57% CTR**) | same |
| Widget visitors who chatted (lifetime) | 79 | `ss_widget_visitors` — every row has messages, so this is NOT a funnel top |
| Emails captured | 15 | rate vs a real denominator is UNKNOWN (see caveats) |
| Paying subscribers from widget | **1** | distinct `converted_user_id`; source=NULL on both rows |
| Blog pages | 7,059 impr → 42 clicks, avg pos **13.8** | GSC rows |
| `/best/*` pages | 1,843 impr → 9 clicks, wtd pos **36.8** | GSC rows (corrected in review) |

**~5 chatting visitors/week is the entire measured top of funnel.** Traffic
volume, not conversion, is the binding constraint — this survived review, though
the reasoning behind it did not (see below). The honest form is *"nothing is
measurable at n=79"* rather than any quoted conversion rate.

### The intent finding — REFUTED BY ADVERSARIAL REVIEW (Aug 19)

**An earlier version of this file claimed informational intent explained the CTR
gap. Two adversarial reviews refuted it. The claim is withdrawn.**

The refutation that settles it is structural and does not depend on how queries
are classified:

| Exact position | Impressions | Clicks | CTR |
|---|---|---|---|
| 1 | 131 | 2 | **1.53%** |
| 2 | 412 | 10 | 2.43% |
| 3 | 622 | 4 | 0.64% |
| 4-10 | 4,707 | 26 | 0.55% |
| 11-20 | 1,788 | 15 | **0.84%** |

**Position 1 earns 1.53% where a normal site earns 25-35%** — a ~20x shortfall,
worse than the 4-10 band the brief focused on. And the curve is nearly FLAT:
position 11-20 outperforms position 4-10.

This excludes BOTH candidate explanations. AI Overviews suppress the TOP results
hardest, so if AIO were the cause position 1 would be crushed relative to
position 10 — it is not. Ranking cannot be the cause either, since ranking better
does not help. Something suppresses clicks at *every* position.

**The intent classifiers disagree with each other, which is the tell.** My
classifier on rows >=10 impressions returns informational 0.000% vs commercial
0.639%; the reviewer's returns informational 0.71% vs commercial 0.49% — opposite
conclusions from the same GSC snapshot. **When the answer flips with the bucketing
rule, the answer is an artifact of the bucketing rule.** Neither result should be
used.

### What the evidence actually supports: query-page relevance

The strongest signal in the dataset, and it needs no classifier.

**One page**, `sebaceous-filaments`, across its own queries:

| Query | Impr | Clicks | Position |
|---|---|---|---|
| `sebaceous filaments` | 233 | 1 | **3.4** |
| `sebaceous filaments korean skincare` | 128 | 0 | 8.4 |
| `korean skincare for sebaceous filaments` | 105 | **5** | **10.2** |

CTR RISES from 0.4% to 4.8% as position FALLS from 3.4 to 10.2. Same page, same
SERP features, same intent — position and AIO are excluded by construction. What
varies is how well the page fits the query.

**Confirmed at scale on the clearest case:** the page titled *"Why Is K-Beauty So
**EXPENSIVE**"* ranks for *"why is k-beauty so **CHEAP**"* and variants —
**145 impressions, 0 clicks**. Google is ranking it for the semantic OPPOSITE of
its thesis. That is not zero-click behaviour; it is a searcher correctly rejecting
an irrelevant result.

### Zero-click pages in the top 15 (853 impressions, 0 clicks)

| Page | Impr | Avg pos | Diagnosis |
|---|---|---|---|
| `/blog/...snail-mucin-is-fake...` | 296 | 8.5 | **Not** a mismatch — queries fit, title/meta are good. Page 7-8 against stronger brands. |
| `/blog/why-is-k-beauty-so-expensive...` | 213 | 8.3 | **Inverted intent** — ranks for "cheap". Fixable. |
| `/blog/...expiration-dates-and-batch` | 116 | 7.7 | Answered fully in the SERP; also may not hold page 1 live. |
| `/blog/best-japanese-korean-sunscreens...` | 54 | 8.0 | — |
| `/best/spot-treatments` | 45 | 11.7 | — |

**These have different causes and need different fixes.** Lumping them under one
story is what produced the withdrawn claim.

### Dataset caveats (from review, verified)

- **The GSC window is `2026-07-17` to `2026-08-13`** — NOT "last 28 days". It is
  5 days stale and predates everything shipped since Aug 13.
- **77% of rows are noise**: 2,205 of 2,853 rows have <=2 impressions.
- **17 rows are LLM prompt text leaking into GSC** ("context: location: united
  states (not for language)..."), 63 impressions.
- **The widget denominator does not exist.** All 79 `ss_widget_visitors` rows have
  `total_messages > 0` — the table only records people who chatted. "78 engaged
  visitors" is a conversation count, not a funnel top. The real denominator is
  recorded nowhere.
- **`/best` numbers were slightly wrong**: 1,843 impr / 9 clicks (not 1,781/7),
  impression-weighted position 36.8 (not 34.9).
- **"Blog converts best" is not supportable**: blog 6 visitors / 2 emails, but
  `products_cta` is 2 visitors / 2 emails (100%), and **48 of 79 visitors have
  `source = NULL`** (61% missing).

## TWO CLAIMS THAT WERE WRONG (recorded so they are not repeated)

### 1. "Truncated `<title>` tags are the cause of the CTR gap" — FALSE

The defect is real: `<title>` renders `meta_title`, and **36 of 46 posts** ship
it as a truncated prefix. Verified live:

```
<title>Why Your Sebaceous Filaments Keep Coming | Seoul Sister</title>
<meta property="og:title" content="Why Your Sebaceous Filaments Keep Coming Back (And the K-Beauty Routine That Finally Changed Mine)">
```

**But it is not the cause.** Checking the live SERP, Google is *overriding* the
truncated tag and displaying the full title (it rewrites ~60% of titles).
Searchers see good titles.

**The error class:** a mismatch between two sources was filed as a diagnosis
without measuring whether it produced the symptom. This is the documented
"a mismatch is not a diagnosis" failure, repeated. One search would have caught it.

Also note `page.tsx:107-115` documents `meta_title` as a *deliberate* short
search-display variant. It was a design decision, not purely a bug.

### 2. "Pinterest is a viable channel" — UNSUPPORTED, withdrawn

Every Pinterest statistic located traces only to AI-generated stat-aggregator
blogs citing each other circularly (omnibound.ai, digitalapplied.com,
amraandelma.com, sqmagazine.co.uk). No primary source. The channel may be fine;
it is **unsizable from public data** and cannot be recommended on evidence.

### 3. Minor: "product pages have no Yuri CTA" — WRONG

They have had one since July 27 (`AskYuriAboutProduct`). It rendered *fifth*.
The grep that missed it searched the page file; the CTA lives in a child component.

---

## What SHIPPED

### A. Blog: Yuri CTA moved from end-of-article to mid-article

**Problem:** posts average 2,021 words (median 1,775) and both Yuri entry points
rendered *after the entire body* (`page.tsx:364`, `:434`). A visitor had to
finish a ~2,000-word article before being offered the product.

**NOT justified by "blog converts best"** — that claim was withdrawn in review:
blog is 6 visitors / 2 emails lifetime, while `products_cta` is 2/2 (100%), and
61% of sessions have `source = NULL`. The justification is simply that an offer
placed after 2,000 words is an offer most readers never reach.

**Approach — split, do not inject.** `src/lib/utils/article-split.ts` splits the
rendered HTML at a tag boundary and the page renders two sibling divs with the
CTA between them. Injecting a marker into the HTML string was rejected: the HTML
has already been through `marked` AND `linkIngredients`, so injection risks
landing inside a tag or an ingredient anchor, and the CTA would lose its React
identity.

**Boundary — the SECOND `<h2>`.** Measured across all 46 published posts:
- every post has ≥5 `<h2>` (median 7)
- lands at median **124 words / 6% in**, never past 17%
- always after one complete section
- the FIRST `<h2>` is often at index 0 (intro lives in the excerpt), which would
  put the CTA above all content

**Degrades safely:** no usable boundary → whole article in `head`, `didSplit:
false`, no mid CTA. Content is never lost.

**Verified on the served page** (not just the build): CTA at **9% into the
page**, all 12 `<h2>`s present, both CTAs render, closing sections intact.

### B. Product pages: free Yuri CTA moved above the locked teasers

**Problem:** for anonymous visitors, `ProductIntelligenceSection` rendered:
1. four locked "Subscribe to unlock" `GatedTeaser` cards
2. the FREE Yuri CTA (fifth)
3. a $24.99 `/register` wall

A stranger arriving from an AI citation met three locked panels before the one
free thing. Pure reordering — no new copy, no new promise, teasers unchanged.

**Evidence, stated honestly:** the only converting visitor exchanged **26
assistant messages across two devices** before paying — she experienced Yuri
extensively first. That is directionally supportive of value-before-ask but it
is **one person**; the reorder is justified independently because showing a free
thing before locked things needs no conversion theory.

---

## Guard tests (9 new; 949 → 958, all passing)

`tests/article-split.test.mjs` (9) and `tests/product-yuri-cta-order.test.mjs` (4).

Per CLAUDE.md, each was confirmed to **FAIL when its bug is reintroduced**, and
each revert was confirmed to have actually applied before the result was trusted:

| Reintroduced bug | Result |
|---|---|
| split on FIRST `<h2>` | 4 fail |
| drop `tail` (silent content loss) | 4 fail |
| empty `head` when no 2nd h2 (article vanishes) | 2 fail |
| CTA moved back to fifth position | 1 fail |
| Ask-Yuri rendered as a locked `GatedTeaser` | 2 fail |

**One existing test was updated, not weakened.**
`tests/geo-citation-funnel.test.mjs` scoped its search to the
`product-gated-content` container; moving the CTA *above* that container broke
its assumption. It now scopes to the anonymous return block **and additionally
asserts the CTA precedes the teasers** — strictly stronger. Confirmed it still
fails against the locked-teaser bug it was originally written for.

**A test bug was found and fixed during this work:** the CTA-routing test sliced
a fixed byte count from the function start and swept in the *next* function,
whose `href="/register"` failed a negative assertion — a test defect that looked
exactly like a code defect. Now bounded at the next top-level `function`.

---

## NOT shipped, and why

| Item | Status | Reason |
|---|---|---|
| **`?ask=` auto-send** | **REJECTED** | `/api/widget/chat` has rate limiting (25/IP/day) but **no Turnstile/bot check** (`route.ts:31,361`). Auto-sending on page load would let any crawler hitting a `?ask=` URL trigger a paid Opus call. Also removes the visitor's chance to edit the question. |
| **`meta_title` backfill** | **DEFERRED** | `src/app/api/admin/content/ingest/route.ts:61,123` does a full `.update(row)` keyed on `lgaas_post_id`. A local backfill is **silently overwritten** on the next LGAAS ingest. Must be fixed upstream in LGAAS. Low value anyway — Google overrides the tag. |
| **Credentialed byline** | **DROPPED** | `ss_content_posts.author` is `"Seoul Sister Team"` on **all 46 posts**; there is **no named human editor**. "Reviewed by" would imply a human review process that does not exist — an unsubstantiated claim on a customer-facing surface. The DB figures do check out (5,311 verified products, 5,244 with INCI), so a *methodology* statement is defensible; a *credential* is not. Review then killed it outright: `is_verified` is a completeness cron with no human check, 62 verified rows contradict their own INCI today, and the "an MD outranks us" premise is false (live SERP: SS at #4 and #6, the MD at #8). A named human on unverified AI content is the deceptive-endorsement pattern. |
| **Nurture extension past day 8** | **NOT DONE** | Real gap — `STEP_DELAYS_DAYS = [0,3,5]`, and **17 of 47 leads have permanently exhausted** the sequence. But email 3 says **"This is the last email either way"** (`nurture-copy.ts:83,90`) and all 17 completers become due on the NEXT cron run — breaking a written promise to 100% of completers on the honesty-moat brand. Safe form is a separate opt-in sequence for NEW enrollees only. |
| **Shift content to commercial intent** | **DROPPED** | Rested on the refuted Claim B. The highest-volume commercial query in the dataset earns 0 clicks at position 8. |
| **`/best` page work** | **DEFERRED** | Weighted position 36.8 against brand-owned competition needs authority measured in quarters. |
| **More AI citations** | **DEFERRED** | A cited AIO result earns +120% clicks vs uncited competitors but still **−38%** vs no-AIO at all (Seer, 53 brands / 5.47M queries). Citation is a relative advantage, not traffic restoration. Already at 525/wk. |

---

## THE HIGHEST-RETURN WORK — surfaced by review, NOT yet done

Neither the brief nor the shipped changes address this. Both reviewers
independently landed on it.

**1. Fix query-page relevance on the ~5 pages that already have impressions.**
The "expensive" page bleeds **145 impressions at 0%** on inverted-intent "cheap"
queries. One page, one afternoon, and the `sebaceous-filaments` data proves the
mechanism (4.8% on the fitting query vs 0.4% on the head term). Either retarget
the page to cover both framings honestly, or accept the mismatch and stop
counting those impressions as an opportunity.

**2. Source attribution — ALREADY FIXED (measured Aug 19). Not work; a stale
premise.** The reviewer's "61% NULL" is a LIFETIME average that hides a fix
which already landed. NULL rate by week:

| Week | Sessions | NULL % |
|---|---|---|
| ≤ Jun 22 | — | **100%** |
| Jun 29 | 4 | 75% |
| Jul 6 / 13 / 20 | 24 | 60-64% |
| Jul 27 | 4 | 25% |
| Aug 3 | 10 | 40% |
| **Aug 10** | **11** | **0%** |
| **Aug 17** | **6** | **0%** |

Two commits produced the cliff, and the dates match the data exactly:
- **`f1c1b3e` (Jul 13)** — "source capture was gated behind `?ask=`", so any
  arrival without that param went untagged. 100% → ~62%.
- **`d0f96f8` (Jul 27)** — AI-referrer capture (`src/lib/widget/ai-referrer.ts`).
  ~62% → 0%.

The last 17 sessions across two weeks carry **9 distinct sources**, including a
`nurture_1` email click. Attribution works end to end today.

**The historical signal is unrecoverable** — `document.referrer` was never
stored for those rows, so no backfill is possible. Treat pre-August source data
as absent, not as "direct traffic", and do not compute channel rates over the
lifetime table.

**3. The SERP check — RUN (Aug 19). Result: inconclusive on AIO, but it
falsified one reviewer claim and confirmed the pages ARE on page one.**

Two of the highest-impression zero-click queries, checked live:

| Query | GSC position | Live rank | GSC clicks |
|---|---|---|---|
| `how to identify fake cosrx snail mucin` | 8.0 | **#4** | 0 |
| `korean skincare expiration date how to read` | ~7.7 | **#5** | 0 |

Both pages are genuinely **on page one and simply not clicked** — they are not
absent, so the reviewer's "position 4.9 is a long-tail averaging artifact"
does not hold for these (they tested a different query variant, which may still
be true for that one).

What both results DO show: the search result page answers the question
completely — 제조 vs 까지, PAO symbols, date format, the full counterfeit
checklist — before any link. Whether that is an "AI Overview" or simply a rich
SERP, **the effect on the click is the same.**

**Honest limit: this does NOT restore the withdrawn intent claim.** It is n=2,
run through a search tool rather than a logged-out browser, and it cannot
explain the finding that actually killed that claim — position 1 earning 1.53%.
A page-one result that is not clicked is consistent with the rich-SERP story
AND with the query-page-fit story. Two spot checks cannot separate them.

---

## Second-model review status

**Two adversarial reviews were run (Opus + Fable), instructed to REFUTE.** They
returned AFTER the initial commit and found real defects. Both are recorded here
rather than quietly absorbed.

### What they refuted

| Claim | Verdict |
|---|---|
| A — traffic is the binding constraint | **SURVIVES**, but on "nothing is measurable at n=79", not on the quoted rates |
| B — informational intent / AI Overviews | **REFUTED** — see the flat position curve above |
| C — 0.55% at pos 4-10 is a 6-10x shortfall | **REFUTED as stated** — the real shortfall is at position 1 (~20x) and excludes both explanations |
| D — do not rebuild the funnel | **SURVIVES**, weakened denominator |
| E — leave `/best` alone | **SURVIVES**, numbers corrected |
| F — do not chase citations | **SURVIVES** — the only claim verified at primary source (Seer, 5.47M queries / 53 brands) |

### What they changed in the shipped code

1. **A guard test broke on a correct change.** `geo-citation-funnel.test.mjs`
   scoped its assertion to the `product-gated-content` div; moving the CTA
   *outside* that div made it report red on an improvement. Rescoped to the
   anonymous return block and **additionally** made it assert the ordering.
   Note the irony recorded by the reviewer: that test's own comment says an
   earlier version "passed even with the bug reintroduced" — it was hardened once
   for a false GREEN and has now produced a false RED. Both are the same defect:
   the assertion was anchored to markup structure instead of to the rule.
   (This was already fixed before commit; the reviewer read the mid-flight tree.)

2. **A causal claim in a code comment was deleted.** The comment asserted the
   sole paying subscriber "converted BECAUSE Yuri gave real value before any
   ask." Verified against production: **her visitor rows carry `source = NULL`**
   — she arrived via the landing widget and converted off the recap email ~14h
   later. Her path never touched `/products/[id]`. The comment now cites
   **d0f96f8 (Jul 27)** instead, whose stated purpose was exactly this change and
   which left the card in the fifth slot — so this **completes** that commit
   rather than reversing it. A comment asserting an unsupported causal finding is
   precisely what the "name the row" rule exists to prevent.

### What they killed

**The credentialed byline (action #2) is DROPPED, not deferred.** Three findings
beyond the missing editor:

- **"Verified" is false as a public claim.** `is_verified` is set by a nightly
  cron (`src/lib/pipeline/auto-promote-verified.ts`) on *data completeness*:
  name/brand/category present, `ingredients_raw` populated, >=1 price, >=8
  ingredient links. **No human ever checks a row.** "Verified INCI database"
  reads to a consumer as "checked against the manufacturer" — unsubstantiated,
  and the shape FTC "Operation AI Comply" targets.
- **It is wrong on live rows today.** 67 products are flagged verified with no
  INCI at all, and on two test terms alone **62 verified products assert a
  description ingredient their INCI contradicts**. Our own audit for this is
  OPEN (`scripts/audit-description-inci-mismatch.ts`, dry-run dated 2026-08-18).
- **The motivating premise was backwards.** Live SERP for `best korean skincare
  for pih`: **Seoul Sister at #4 AND #6; koreanskincarecoach.com at #8, below
  both.** The single fact that motivated the recommendation is false.
- **A named human on AI-generated content no human verified is the
  deceptive-endorsement pattern** — it converts diffuse brand risk into personal
  liability for whoever is named. The name is the most dangerous element, not the
  missing one.

**Action #4 (shift to commercial intent) is also dropped** — it rested on the
refuted Claim B, and the highest-volume commercial query in the dataset
("how to identify fake cosrx snail mucin", 59 impr, pos 8.0) earns **0 clicks**.

### One reviewer recommendation NOT adopted

A reviewer called the nurture extension "the strongest item on the list" and said
to just ship it. **The other reviewer showed it would break a written promise to
17 real people within minutes of deploy** — email 3's subject is
*"(last email, promise)"* and its body says *"This is the last email either way"*
(`nurture-copy.ts:83,90`), and all 17 completers become due on the next cron run.
On the brand whose stated moat is honesty, that is not a close call. If more
touches are wanted, the safe form is a **separate opt-in sequence for NEW
enrollees**, which avoids the promise entirely.

### Known limitation recorded, not fixed

`nthH2Index` is not depth-aware despite its "top-level" comment: an `<h2>` nested
in a blockquote would split mid-container. **Measured against all 46 published
bodies: zero current exposure** (no blockquoted h2s; the one post with raw `<h2>`
HTML has it at top level). Recorded so the first LGAAS post that does this does
not surprise anyone.

**Neither review was itself second-model reviewed.** The `sebaceous-filaments`
inversion is n=1 page. AIO presence was confirmed on only 2 queries — the
20-minute incognito check above is what would settle Claim B for good.

## How to read whether this worked

Compare in GSC/DB in **2–3 weeks** (from Aug 18):
1. `ss_widget_sessions WHERE source IN ('blog','product')` — session count and
   `message_count`. Baseline: blog 7 sessions / 2.7 avg msgs; product 3 sessions.
2. Email capture rate among those sources. Baseline: 19.2% across all engaged.
3. GSC clicks are **not** expected to move — nothing here changes the SERP.
   This work converts arrivals that already happen.

**Honest limit:** at ~5 engaged visitors/week, a placement change cannot be
measured to significance quickly. These are correct on their own terms
(free-before-locked, value-before-2000-words), not A/B-proven.
