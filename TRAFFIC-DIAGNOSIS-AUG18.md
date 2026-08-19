# Traffic Diagnosis & Funnel Placement Fixes — Aug 18 2026

Companion to `GEO-STRATEGY.md` (citation strategy) and `NORTH-STAR.md` (the freeze).
This file is the record of what was measured, what was WRONG, what shipped, and
what was deliberately NOT shipped.

---

## The measured situation

| Metric | Value | Source |
|---|---|---|
| GSC impressions / 28d | 11,209 | `ss_seo_reports` (window ending Aug 13) |
| GSC clicks / 28d | 64 (**0.57% CTR**) | same |
| Engaged widget visitors (lifetime) | 78 | `ss_widget_visitors WHERE total_messages > 0` |
| Emails captured | 15 (19.2% of engaged) | same |
| Paying subscribers from widget | **1** (1.28%) | distinct `converted_user_id` |
| Blog pages | 7,059 impr → 42 clicks, avg pos **13.8** | GSC rows |
| `/best/*` pages | 1,781 impr → 7 clicks, avg pos **34.9** | GSC rows |

**~5 engaged visitors/week is the entire top of funnel.** Traffic volume, not
conversion, is the binding constraint.

### The intent finding (the one that survived review)

Controlling for position — the obvious confounder — at positions ≤20:

| Query intent | Impressions | Clicks | CTR | Avg position |
|---|---|---|---|---|
| Informational (`how/why/what/can/does/is`) | 957 | 1 | **0.104%** | **6.7** |
| Commercial-ish (`vs/fake/dupe/worth/review/best X for`) | 1,672 | 10 | **0.598%** | 8.2 |

Informational queries rank **BETTER** (6.7 vs 8.2) and convert **5.7x WORSE**.
Position is ruled out. Intent is doing the work.

Corroborating: informational queries trigger AI Overviews ~36% of the time vs
8% commercial / 5% transactional (Seer Interactive). Running our own biggest
query live, the AI summary answered it completely — naming Numbuzin No.5,
Goodal Niacinamide 10%, COSRX snail mucin — before any blue link.

Our own click data agrees: `sulwhasoo fake vs real` 18.2% CTR, `best toner for
pie` 20%, `korean skincare for sebaceous filaments` 4.8% — against **0%** on
broad informational pages ranking higher.

---

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
finish a ~2,000-word article before being offered the product. Blog arrivals
convert to captured leads better than any other source (two on Aug 18 alone,
3 and 7 messages, **both gave emails**).

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
| **Credentialed byline** | **BLOCKED** | `ss_content_posts.author` is `"Seoul Sister Team"` on **all 46 posts**; there is **no named human editor**. "Reviewed by" would imply a human review process that does not exist — an unsubstantiated claim on a customer-facing surface. The DB figures do check out (5,311 verified products, 5,244 with INCI), so a *methodology* statement is defensible; a *credential* is not. Needs a real named reviewer before shipping. |
| **Nurture extension past day 8** | **NOT DONE** | Real gap — `STEP_DELAYS_DAYS = [0,3,5]`, and **17 of 47 leads have permanently exhausted** the sequence. But adding steps risks retroactively mailing leads who finished weeks ago; needs idempotency/backfill design first. |
| **`/best` page work** | **DEFERRED** | Avg position 34.9 against brand-owned competition needs authority measured in quarters. |
| **More AI citations** | **DEFERRED** | A cited AIO result earns +120% clicks vs uncited competitors but still **−38%** vs no-AIO at all (Seer, 53 brands / 5.47M queries). Citation is a relative advantage, not traffic restoration. Already at 525/wk. |

---

## Second-model review status

**Two adversarial reviewers were spawned** (Opus for evidence, Fable for
implementation), instructed to REFUTE rather than approve, and given the two
prior wrong claims as context. **Neither returned findings before these changes
were made.** The `persona-review-gate` hook fired on the test file and is
acknowledged here rather than bypassed.

What was done instead, and what it does and does not cover:
- Both shipped changes are **placement/ordering only** — no persona prompt
  edit, no new customer-facing promise, no new capability claim.
- The one change that WOULD have been a customer-facing claim (the byline) is
  **blocked** pending a real named reviewer.
- The riskiest proposal (`?ask=` auto-send) was **rejected on evidence I
  verified myself** (`route.ts` has no bot check).

**Still owed:** an adversarial review before the byline or the nurture extension
ships. Neither is in this change set.

---

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
