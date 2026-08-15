# Price Staleness & Clinical Inference Honesty — Aug 15 2026

Triggered by a real cold conversation: a woman on the Spanish Mediterranean coast, 9 messages
in 16 minutes, purchase intent, email captured. Yuri's reasoning was excellent. Two things
underneath her were not.

---

## 1. The Olive Young price refresher has failed 100% for ~130 consecutive nights

**This is the headline finding, and it is a silent-failure defect, not a missing feature.**

I initially told Scott the price-staleness warning was "deferred." That was wrong on both
halves. The refresher is BUILT (`src/lib/pipeline/olive-young-price-refresh.ts`), SCHEDULED
(`vercel.json` → `/api/cron/refresh-prices-olive-young`, daily 9pm UTC), and RUNNING. It has
never once succeeded.

Every run since ~Jul 6 2026, verbatim from `ss_pipeline_runs`:

```
status: "completed"   products_scraped: 40   products_processed: 0   products_failed: 40
metadata: { updated: 0, fetch_failed: 40, unscrapeable: 0, price_changes: 0 }
```

`status: "completed"` over total failure. This is exactly the CLAUDE.md **"nothing wrong vs
nothing checked"** class: a clean-looking run row and a dead scraper leave nearly identical
database state, and the one field that distinguishes them (`products_failed`) was never
alerted on.

### What it cost

| Measure | Value |
|---|---|
| Olive Young price rows | 4,917 (~96% of all price data) |
| Frozen at 2026-04-07 | 4,889 (**99.4%**) |
| Age of those rows | ~130 days |
| ALL price rows stale >14d | 5,075 of 5,117 (**99.2%**) |
| ALL price rows stale >90d | 5,031 of 5,117 (**98.3%**) |

On Aug 15 Yuri quoted six of these frozen prices to a buyer as current, with no caveat:
Dr.G $35.23 · Arencia $18.81 · House of Hur $28 · The Face Shop $11.28 · Jumiso $24.05 ·
AHC $31.25.

### Why the tripwire didn't save us

`olive-young-price-refresh.ts:244` already has the right check — "examined N rows but updated
0" — and it has been printing that warning to Vercel logs **every night for four months.**
Nobody reads Vercel logs. A `console.warn` is not observability; it is a message in a bottle.

**Rule earned:** a tripwire that writes only to logs has not closed the loop. The run must
report a status that a human or an alert can see.

### ROOT CAUSE CONFIRMED EMPIRICALLY (Aug 15 2026) — and FIXED

The detail page is a Vue SPA that now loads its price via an async XHR. Verified by
fetching the served HTML for 8 popular products: **no `saleAmt` anywhere in it.** So
`document.querySelector('.price-info')` finds nothing, `price_usd` stays null, and — the
critical part — **nothing throws.** A silent null, indistinguishable from success.

The page's own JS (`shop.product.detail.init.js`) reveals the real source:

```js
axios.post('detail-data', { prdtNo: this.product.prdtNo })
```

`POST https://global.oliveyoung.com/product/detail-data` returns the price as JSON with
**no browser required.** Verified with plain `curl` and then end-to-end through the real
compiled module.

| Measurement | Result |
|---|---|
| 25 sequential requests | 12s, **0 HTTP errors** (~0.5s each) |
| Rate limiting / bot wall | **None observed** |
| Delisted detection | Stable across **3 separate rounds** — not transient |

**Fix shipped:** `src/lib/pipeline/sources/olive-young-price-api.ts`, fetch-only. Batch
raised **40 → 400/run** (Playwright's ~8s/page was the reason for the old cap), so the
4,908-row OY catalog now cycles in **~12 days instead of ~4 months.**

### How wrong were the stored prices? (this is the part that matters)

My first sample said "0.0% change across 20 products" — **that was a sampling artifact.**
It drew from the refresher's own stalest-first batch, which is dominated by obscure
products nobody buys. Re-measured against the **popular** products Yuri actually
recommends:

| Product | Stored | Live | Error |
|---|---|---|---|
| Beauty of Joseon Revive Eye Serum | $25.99 | **$13.89** | **-46.6%** |
| Dr.G Green Mild Up Sun+ | $35.23 | **$22.40** | -36.4% |
| Round Lab 1025 Dokdo Set | $48.00 | **$31.68** | -34.0% |
| Numbuzin No.5+ Vitamin Serum | $25.20 | **$17.17** | -31.9% |
| Anua Heartleaf Cleansing Oil | $34.99 | **$25.12** | -28.2% |
| d'Alba First Spray Serum | $42.07 | **$35.00** | -16.8% |
| Beauty of Joseon Revive Duo | $25.99 | $29.00 | +11.6% |

**7 of 8 wrong, six by 28–47%, and all but one an OVERQUOTE.** Stale prices here are not a
theoretical risk — they make Seoul Sister look expensive on a platform whose pitch is price
transparency.

### The failure nobody was looking for: DELISTING

Of the **six prices Yuri quoted the Spanish visitor**, checked live:

| Quoted | Live | Reality |
|---|---|---|
| Dr.G RTX Peptishot $35.23 | **DELISTED** | her **#1 recommendation** is unbuyable there |
| The Face Shop Peptide 8 $11.28 | **DELISTED** | unbuyable |
| Arencia $18.81 | $24.00 | she'd pay **28% more** than quoted |
| Jumiso $24.05 | $19.00 | we overquoted 27% |
| AHC $31.25 | $29.60 | overquoted |
| House of Hur $28.00 | $28.00 | correct |

**4 of 20 randomly sampled products (20%) are delisted.** "Stale price" was never the only
failure mode — "product you cannot buy at all" is distinct and arguably worse. The refresher
now tracks `delisted` as its own outcome and stamps `last_checked` (we genuinely looked),
without deleting rows — that is a separate decision with its own blast radius.

### Diagnostic narrowing (do not re-derive this)

The LISTING scraper on the same Playwright stack, same site, same Vercel runtime, still
scrapes 96 products nightly with **0 failures**. So this is:

- NOT an IP block or geo-block
- NOT a broken browser launch / `@sparticuz/chromium` regression
- NOT a `parsePrdtNo` bug (`unscrapeable: 0` proves prdtNo parses fine)

It is specific to `scrapeProductDetail` (`src/lib/pipeline/sources/olive-young.ts:235`),
whose price extraction hangs entirely on one selector:

```js
const priceArea = document.querySelector('.price-info')
if (priceArea) { ...parse strong.point / .sale-price... }
```

If `.price-info` is absent, `price_usd` stays null and **no error is thrown** — a silent null
that the refresher counts as `fetchFailed`. The most likely cause is an Olive Young DOM
change. (Empirical confirmation delegated to a diagnostic agent; see findings section.)

---

## 2. The staleness instrument EXISTS and the visitor's path never touched it

This is the sharper finding. `compare_prices` has carried full staleness honesty since
v10.3.8 (commit 76f5c7a) — `age_days`, `is_stale` at a 14-day threshold, a `freshness` block,
even a `honesty_note` telling Yuri to cite the age.

**All three of the Spanish visitor's tool calls were `search_products`.** That tool's price
join (`src/lib/yuri/tools.ts:1582`) selects:

```ts
.select('product_id, price_usd, retailer:ss_retailers(name)')
```

No `last_checked`. So the price reaches Yuri as a bare number with no age, on the tool she
actually calls when recommending products. The honesty mechanism was built on the path
visitors DON'T take.

Corroborating: `is_stale` appears in exactly three places in the entire repo, all inside
`compare_prices`. **No prompt on either surface and no test anywhere references it.** It has
been a computed field with no consumer for ~4 months — question 3 of the four-questions test
("does the output reach a CONSUMER?") never had an answer.

### Why a naive threshold is the wrong fix

With 99.2% of rows stale past 14 days, annotating every stale price means Yuri caveats
essentially every price she ever quotes. That is not honesty, it is noise — and it reads to a
prospect as "this company's data is broken," at the exact moment they are deciding whether to
pay $24.99/mo. The fix must distinguish *"this price may have drifted"* from *"we stopped
looking in April."*

---

## 3. Clinical inference stated as established fact (smaller, real)

The visitor said **"I have fair skin. I don't burn because I don't sunbathe."** That is a
behavior statement, not a Fitzpatrick reading — she never actually answered the burn/tan
question, which Yuri had asked twice specifically to calibrate retinoid strength.

Yuri replied **"Fair skin changes everything, and in your favor"** and escalated straight to
retinal (a step above retinol), reasoning that low tanning propensity means low PIH risk.
The reasoning is sound and the call was probably right. The problem is that an *inference*
was delivered in the register of an *established fact*.

Stakes were low here (she still gated at 2 nights/week, and the visitor is genuinely fair).
The same inference on a deeper skin tone risks post-inflammatory hyperpigmentation — which is
precisely what the v11.10.0 Clinical Data Honesty section exists to prevent. That section
gave authenticated Yuri `fitzpatrick_source` ('stated' | 'estimated' | NULL). **The widget has
no equivalent — "fitzpatrick" appears nowhere in the widget prompt.**

### What this fix is NOT

It is **not** an instruction to hedge. CLAUDE.md is explicit that a more cautious,
disclaimer-heavy Yuri is a REGRESSION. She should keep escalating to retinal on good
reasoning. The fix is that she should know the difference between what a visitor *told* her
and what she *concluded*, and it costs one clause: *"going by fair skin — tell me if you
actually do tan and I'll slow this down."* That is a better consult, not a weaker one.

---

## Design constraints (from CLAUDE.md, non-negotiable)

1. **State a FACT, hand the decision back.** Established house pattern —
   `src/lib/widget/cumulative-give.ts`, `tool-grounding.ts`, `subscriber-surface.ts`. Guard
   tests FAIL if a fact becomes a command.
2. **Never enumerate the bad thing.** Ban the shape, not yesterday's phrasing.
3. **A guard test written in the same sitting as the code it guards is not evidence.** Attack
   it first; execute the real transpiled function rather than asserting source text.
4. **Second-model review is mandatory** — this touches Yuri's prompt and customer-readable
   price promises. Two adversarial reviews (Opus 5 + Fable 5) were run; see findings.

---

## Status

**SHIPPED (data layer — verified against live Olive Young and the live DB):**

- [x] Root cause identified empirically for all three items
- [x] **OY price lookup repaired** — `src/lib/pipeline/sources/olive-young-price-api.ts`,
      fetch-only, no browser. Verified end-to-end through the real compiled module:
      correct live prices returned, delisted products correctly identified.
- [x] **Batch 40 → 400/run** — catalog cycles in ~12 days instead of ~4 months. Phase 1
      (popular products, `review_count ≥ 500`) catches all 115 popular rows on the FIRST
      run, so the products Yuri quotes most are corrected tomorrow night, not in 12 days.
- [x] **Zero-update runs now log `status: 'failed'`** — the Guardian's 48h pipeline check
      keys on exactly that, so it escalates to the alert email instead of a `console.warn`
      nobody reads. An all-delisted batch is deliberately excluded (alert fatigue is how
      the original 130-night silence happened).
- [x] **Delisting handled as its own outcome** — `in_stock: false` (existing column, already
      consumed by `compare_prices`), reversible on the next successful read, and NEVER
      written on a fetch error (a rate limit must not mark live products dead).
- [x] **15 new guard tests** (844 → 859, all passing), each verified to FAIL when its bug
      is reintroduced by reverting the real code: list-price-instead-of-sale-price,
      parse-failure-masquerading-as-delisted, HTTP-429-as-delisted, error-flips-in_stock,
      no-in_stock-restore, delisting-not-flagged, and the hardcoded `status: 'completed'`.
- [x] `tsc --noEmit` clean.

**SHIPPED (prompt layer — second-model review RUN, findings incorporated):**

- [x] **`search_products` now carries price age** (`src/lib/yuri/tools.ts`) — `last_checked`
      added to the price join, surfaced per row as `price_age_days`, plus an `error` check so
      a dead price query cannot read as "this product has no prices."
- [x] **`src/lib/yuri/price-freshness.ts`** — the price-age FACT block, following the house
      `cumulative-give.ts` / `tool-grounding.ts` pattern: states the age, ends by handing the
      decision back, returns **null when prices are fresh** so a healthy catalog costs zero
      tokens and zero behaviour change.

### What the second-model review (Fable 5) changed — both findings were real

**1. It cut a claim I was about to ship.** The first draft told Yuri that stale prices "drift
more often HIGH than low, so an out-of-date number usually errs in the shopper's favour."
True of the n=8 sample; **not a catalog-wide fact.** Yuri would have relayed it as *"you'll
probably pay less than I said"* — a probabilistic promise we cannot keep, doubling as an
excuse for bad data. Cut, and the block now says explicitly that direction of drift **"is not
something we know."**

The reasoning generalises: **cutting an UNVERIFIED claim is not the hedging regression the
project rule forbids.** That rule protects confident *true* advice. This is the
`fitzpatrick_source` discipline applied to pricing — a value whose provenance we cannot name
is not a fact.

**2. It broke my guard test in seconds.** Asked to write something harmful that would pass a
naive "no command words" check, it produced two sentences immediately:

> *"Our prices refresh against retailer sites each morning, so the number Yuri quotes
> reflects what a shopper pays today."* — a **fabricated freshness guarantee**
>
> *"Stored prices this low tend to climb back within days, so today's quote is a good one to
> act on quickly."* — **scarcity framing** inside an honesty instrument

Neither contains must/never/always/should. Both would have sailed through. That is the repo's
own documented failure — **"the attacker picks the verb, not the test"** — reproduced against
the person who wrote it down. The guard test now asserts on **shape and truth**, not
vocabulary: no claimed refresh cadence, no direction-of-drift prediction, no urgency framing,
decision handed back. **Both of the reviewer's attack sentences now fail the suite.**

### Threshold, resolved

21 days, deliberately tied to `POPULAR_STALE_DAYS` in the refresher — the cadence on which
the products Yuri actually cites are re-verified. Tying the two together means the note fires
exactly when the data is genuinely behind, instead of at an independently-invented number
that would drift out of step with the refresh cycle.

### Delisting, resolved in data rather than prose

27% of our top-30 OY products are unbuyable, and an age number cannot express that. Handled
at the data layer instead: delisted rows are flagged `in_stock: false` (an existing column
`compare_prices` already consumes), reversible on the next successful read, and never written
on a fetch error. No new concept for Yuri to learn.

### What a SECOND adversarial review (Opus 5) found — three more real defects

This review arrived after the first round shipped and was more valuable than the first.

**1. A live customer-facing false promise, in the UI, that nobody had looked at.**
`PriceComparison.tsx` shipped this to every visitor on every product page:

> *"Some prices may be outdated. Prices are refreshed automatically every 6 hours."*

The real cadence was **~130 days**. This is *precisely* the fabricated-refresh-cadence attack
the first reviewer invented to defeat my guard test — **already live in production**, and
invisible to every test because they all inspected Yuri's prompt rather than the pages a
customer reads. Fixed to "Each price shows when we last checked it," with a **closed-world
guard** that walks every file under `src/components` and `src/app` so a new surface promising
a cadence fails the suite rather than sailing through.

**2. `get_product_details` had the same defect as `search_products`** — it SELECTs
`last_checked` and then silently drops it in the mapping. A second instance of the exact bug,
in a second tool, invisible to any test that checks the query rather than the payload. Now
emits `price_age_days`.

**3. `search_products` price rows omitted `in_stock`** while both sibling tools carry it. Now
added — which is the right answer to "should delisting be in the prompt?": **no.** It is data.
Yuri frames it herself ("not available at Olive Young right now") — a fact about the
retailer's shelf, not about our data, so it carries no broken-database smell.

Two warnings taken and verified as already-satisfied: an out-of-stock row must **never be
filtered out** of results (that converts "delisted at Olive Young" into "we don't carry this"
— the product may still be at Soko Glam), and a **fetch error must never flip `in_stock`**
(guarded, and test 3 in `oy-price-refresh-delisting.test.mjs` binds it).

**Recorded, not fixed:** four independent staleness definitions now exist (14d in
`compare_prices`, 24h in the admin route, a UI helper's own tiers, 21d here). Worth
consolidating into one shared constant derived from the pipeline cadence — but that is a
refactor touching four surfaces and was out of scope today.

**Noted and judged unreachable:** `tools.ts` `is_stale: ageDays !== null && ageDays > 14`
technically reads a NULL `last_checked` as *not* stale. `last_checked` is `NOT NULL` in the
live schema, so it cannot fire — but the shape is the repo's own silent-failure class and
should be inverted if that column ever becomes nullable.

### The sweep, and the bug I reproduced while running it

**First run: 159 delisted products flagged**, including exactly the class Yuri recommends —
**Torriden Dive-in Soothing Cream (2,625 reviews, $35.00)**, Dr.G Red Blemish Duo (523),
Dr. Althea 147 Barrier Cream (440), Arencia Fresh Green Cleanser (419). Every one of them was
being quoted with a confident price for a product nobody could buy.

**Then the verification caught the script lying.** One of the two rows the script was written
to fix — The Face Shop Alltimate cream, confirmed delisted on four separate live checks — was
still `in_stock: true`, still stamped April 7. Its row was eligible on every criterion.

The cause: **PostgREST silently caps a query at 1,000 rows and reports no error.** The script
asked for 5,000, quietly received ~1,000, and printed a confident summary over a fifth of the
catalog. That is the *exact* silent cap that published 2,018 dead sitemap URLs on Aug 4 2026
— documented in this repo's own CLAUDE.md — reproduced by the session that had just read it.

Fixed with 1,000-row pagination plus a **loud coverage check** that compares rows fetched
against an exact `count`, so a partial scan can never again look like a full sweep.

**The lesson worth carrying:** the sweep reported success and the database disagreed. Only
naming the row — checking the specific product the fix was written for, rather than trusting
the summary — surfaced it. A script's own output is not evidence that it worked.

### Clinical provenance — SHIPPED

Added to the widget system prompt, immediately after the existing "reason from population
patterns" rule it refines: **know which clinical inputs a visitor TOLD you and which you
worked out yourself.** It quotes the real answer ("I don't burn because I don't sunbathe"),
explains why that describes behaviour rather than skin response, affirms that Yuri's
inference was sound, names the asymmetric cost (nearly free on fair skin, months of PIH on a
deeper tone), and models the one-clause remedy.

**What it deliberately is NOT.** It does not ban the inference — that would cost real clinical
reasoning, which the population-patterns rule exists to protect. It does not instruct her to
re-ask or to gate advice. It ends by disclaiming softening explicitly: *"Keep making the call.
Keep skipping the hedge when you know the answer."* A more cautious Yuri would be a worse
outcome than the bug.

Static text inside the cached block — no per-turn interpolation, so the v11.1.0 prompt-cache
regression is not reintroduced.

**7 guard tests, and one of them nearly didn't bind.** Reverting each bug in turn caught
three of four immediately; **removing the asymmetric-cost paragraph still passed**, because
"asymmetric" and "post-inflammatory hyperpigmentation" both appear ELSEWHERE in the prompt and
my assertion matched the wrong region. Scoped to the rule's own text, it now fails correctly.
That is the second scoping bug of the session (the first policed the email-ask rules by
accident) and **only the revert-test found either.** A guard test that inspects the wrong
region is worse than no test: it reports green while the thing it guards is deleted.

#### Then a second-model review cut it in half, and was right

A Fable 5 adversarial review of the shipped paragraph made an argument I should have made
myself:

> **In an anonymous widget, nearly every clinical input is inferred** — no profile, no photo,
> no history. A rule that taxes inferred inputs therefore taxes almost every substantive
> sentence Yuri writes, and a model reading it mid-conversation will generalise to serial
> provenance-tagging.

That is **the same "fires on ~100% of cases" flaw I had just rejected for the price-staleness
threshold** — and I did not apply my own reasoning one section later. It also called the
250-word version a pink-elephant: you do not stop a model hedging by writing at length about
the one time confidence went wrong and appending "but stay confident." The vivid anecdote
dominates the abstract permission.

**Cut ~1,700 → ~830 characters.** The deeper-skin-tone stakes are no longer restated here —
they already live, better, in the sun-response rule above. Duplicating them was narration. A
guard test now **fails if the rule grows past 1,000 characters**, because length is the
hedging risk.

**The modelled phrasing was also rewritten**, and this critique was sharp: my
*"tell me if you **actually** do tan and **I will slow this down**"* doubts the visitor's
honesty ("actually") and pre-announces retreat — liability register, not expert register. Now:
*"fair skin that never sees sun, so I'll pace this as if you burn; if you tan easily that
changes my speed."* A test fails if the doubting phrasing returns.

**Two of the review's claims were wrong, and checking mattered.** It reported the prompt ships
*truncated* ("ends mid-sentence") — false; that was an artifact of the 350-char excerpt I sent
it, and the shipped file ends cleanly. And it claimed a contradiction with a "don't re-ask"
rule — that rule is scoped to the EMAIL ask, not clinical questions. **A reviewer reading an
excerpt reports defects in the excerpt.** Verify before acting; three of its five points were
right and load-bearing, two were artifacts of how I framed the request.

**Recorded, not adopted:** the review argued the correct fix is a per-turn injected FACT
("sun response: NOT ESTABLISHED — visitor described behaviour") rather than static prose,
mirroring `fitzpatrick_source`. That is probably right and is the natural next step, but it
needs a detector for "answered next to the question" that does not exist yet — and a
classifier needing hand-tuning is, per CLAUDE.md, the signal to stop rather than keep
adjusting. The short static rule ships now; the FACT version is the upgrade path.

**STILL OPEN:**

- [ ] Consolidate the four staleness thresholds into one pipeline-derived constant.

### The Fitzpatrick item (unchanged from above, still open)

Not a hedging instruction. Yuri asked the burn/tan question twice, correctly, and the
visitor answered with a behavior ("I don't burn because I don't sunbathe"). Yuri converted
that to a settled clinical fact and escalated to retinal. The fix is that she should be able
to tell what a visitor STATED from what she INFERRED — the widget has no `fitzpatrick_source`
equivalent, and the word "fitzpatrick" appears nowhere in the widget prompt.
