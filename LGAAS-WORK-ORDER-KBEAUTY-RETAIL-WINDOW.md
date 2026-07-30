# Work Order for LGAAS — K-Beauty Retail Window + Seoul Sister profile drift

> **📍 ARCHIVE COPY. The executable copy lives in the LGAAS repo at
> `lgaas-blueprint/153-WORK-ORDER-KBEAUTY-RETAIL-WINDOW.md`** (placed there Jul 30 2026 so the LGAAS
> session can read it without needing this working directory). That copy is slightly adapted for its
> home repo — self-contained header, repo-scoped cross-references, and a corrected PA-rating count
> (673 sunscreens / 655 with PA, measured live, vs the 613 quoted from `GEO-STRATEGY.md` here).
> **If the two ever disagree, the LGAAS copy is the one being executed.** This one is kept as the
> Seoul-Sister-side record of what was sent and why.

**Written for the AI model working in the LGAAS repo.** Written July 30 2026 from the Seoul Sister
side. It carries facts LGAAS does not currently have, and it names a drift problem that is bigger than
this one update.

**Origin:** Bailey (Seoul Sister co-creator, @baileyydonn) asked whether "the leads that learn" —
LGAAS/AriaStar — is on the same page as Seoul Sister about a new K-beauty development. It is not. She
was right to ask.

---

## 0. READ THIS FIRST — verify before you write

This document was written from the Seoul Sister repo by a session that could read LGAAS source but did
not run LGAAS. **Treat §3 (what LGAAS is missing) as a hypothesis and re-run the greps yourself.** They
are given inline. If they disagree with this document, the data is right and this document is wrong.

Follow the house discipline in `lgaas-blueprint/152-WORK-ORDER-REDDIT-CLAIM-SOURCE-CHECK.md` §0: a
prior handoff doc (BP130) asserted a false diagnosis and cost a session. Don't let this become that.

**This work order does NOT ask you to build a feature.** It asks you to (a) load verified facts into
the business profile, (b) install guardrails so those facts can't be overclaimed, and (c) decide
whether the recurring drift needs a structural fix. Items (a) and (b) are the deliverable; (c) is a
recommendation you should evaluate, not an instruction.

---

## 1. The development

K-beauty is crossing into US mainstream *retail* right now. This is time-limited and decays after
roughly November 2026.

| Fact | Date | Source |
|---|---|---|
| Olive Young opened its **first US store** (Pasadena) | May 29 2026 | Fashionista, Forbes — ~6,000 customers opening weekend, multi-block lines |
| Second LA store | ~Aug 2026 | same |
| **Olive Young K-beauty zones roll into ~650 Sephora stores** | **Fall 2026** | eMarketer |
| CNBC: "Korean beauty products are becoming mainstream in the US" | Jul 18 2026 | CNBC |

**Why it matters to LGAAS specifically:** millions of Americans will encounter K-beauty at physical
retail for the first time in the next 90 days, with almost no trustworthy English-language guidance
layer. Seoul Sister is the one structured English source on Korean products (525 Bing Copilot
citations/week, 33% share on "best korean cleanser"). This is the highest-leverage content window of
the year, and LGAAS writes the content.

---

## 2. The fact almost nobody is publishing — and the guardrails that come with it

**Korean sunscreens sold in US stores are REFORMULATED with FDA-approved filters, and test
substantially weaker than the Korean-market versions of the same product.**

| Product | Korean version | US version |
|---|---|---|
| Beauty of Joseon | SPF 36 | **SPF 19** |
| Innisfree | SPF 48 | **SPF 16** |
| Round Lab | SPF 46 | **SPF 16** |

Source: Consumer Reports testing, verified Jul 10 2026. Recorded in Seoul Sister's `CLAUDE.md` under
"Shelf Visibility & the Western Shelf."

This is genuinely differentiated: mainstream coverage notes the regulatory gap exists, but almost
nobody publishes tested numbers. And the Sephora rollout makes it a mass-market question within ~60 days.

### ⚠️ MANDATORY CALIBRATIONS — content that omits these is wrong, not just incomplete

These are not hedges. They are what keeps the claim true, and each one has already been the difference
between an accurate and an inaccurate version of this story.

1. **The Korean advantage is PROTECTION, not texture.** The same Consumer Reports panel found the
   Korean formulas greasy and white-casting. **Never claim cosmetic elegance.** Any copy that says
   Korean sunscreens feel better is fabricating.
2. **The finding is RELATIVE.** Even the Korean formulas tested *under* their SPF 50+ labels. The story
   is "US version is weaker than the Korean version," never "Korean sunscreen delivers SPF 50."
3. **The gap is NARROWING.** The FDA approved **bemotrizinol in June 2026** — the first new US filter
   since 1999. Copy written as though US sunscreen is permanently behind will age badly within a year.
4. **Framing is "know what you're buying," never "Korean good / American bad."** This is a consumer-
   information story about labeling and regulation, not nationalism.

### 🚫 BANNED CLAIMS — do not publish, in any channel

- **The "KTRI 2022 / 68% of COSRX sunscreen failed SPF" statistic.** Traces only to Alibaba-hosted SEO
  content. **No primary source exists.** If it appears in any draft, kill it.
- **Amazon commingled inventory as a live counterfeit mechanism.** Amazon ended commingling in
  March 2026. The mechanism is stale.
- **Any claim of documented consumer injury from counterfeit K-beauty.** There is none. The evidence is
  *failed protection* (e.g. a tested SPF 3.6 against a claimed 45), which is the honest and sufficient
  version.
- **No Amazon or eBay accusations at all** (affiliate risk — standing Seoul Sister rule).

### Retailer policy reminder (standing, unchanged)

Yuri and AriaStar **never recommend YesStyle, Stylevana, or StyleKorean** (documented service
failures). The recommend-set is **Olive Young, Soko Glam, iHerb**. Honest if asked, never imply
counterfeit. Price-as-data is still fine. This applies to blog, Reddit, social, and email equally.

---

## 3. What LGAAS is currently missing (VERIFY THESE — do not trust me)

Run these from the LGAAS repo root:

```bash
grep -ril "olive young" . | grep -v node_modules      # expect: hits (gap-score data exists)
grep -rn  "Sephora" . | grep -v node_modules          # expect: 1 unrelated hit
grep -rn  "SPF 19\|36 vs 19\|SPF 16" . | grep -v node_modules   # expect: ZERO
grep -rn  "bemotrizinol" . | grep -v node_modules     # expect: ZERO
```

From the Seoul Sister side those returned: Olive Young **known** (gap scores only), Sephora **absent**,
every SPF figure **absent**, bemotrizinol **absent**.

**Conclusion if the greps agree:** AriaStar is currently writing Seoul Sister's blog posts, Reddit
replies, and social content without the most timely and most differentiated fact the business owns.

### The bigger problem: profile drift is recurring, not a one-off

`docs/SEOUL-SISTER-PROFILE-SYNC-PLAN.md` is dated **March 2026** and still describes:

- Price **$39.99** → actually **$24.99** since Jun 22 2026
- **20 preview messages** → actually **12 lifetime**, with an email gate at 8, since v11.9.0
- Product counts from v9.x → actually **6,065 products / 553 brands / 14,961 ingredients** (live,
  verified Jul 30 2026)

Only **price** has an automatic mirror (`utils/ss-pricing-sync.js`, built after users were served a
stale $39.99). Every other fact drifts until a human notices. **That is the real finding here** — this
work order is the third or fourth manual patch of the same class.

---

## 4. What to do

### 4.1 Load the facts (required)

Update Seoul Sister's `lgaas_business_profiles` row so content generators can reach this material:

- The retail-window timeline from §1 (Olive Young US, second store, **Sephora fall rollout**, CNBC
  mainstreaming) — with dates, so a future session can tell when it went stale.
- The sunscreen reformulation table from §2 **with all four calibrations attached to the same field**.
  Do not store the numbers somewhere the calibrations aren't. A generator that finds "SPF 36 vs 19"
  without "protection not texture" will write the wrong article.
- The banned-claims list from §2 in whatever field your preflight/guardrail checks actually read.
- Refresh the stale basics: price $24.99, 12 lifetime preview messages + email gate at 8, and the
  live counts above.

Follow existing conventions (`scripts/*-seoul-sister-*.mjs`) rather than inventing a new mechanism.
**Do not touch `business_data.price_history_note`** — it is human-authored and `ss-pricing-sync.js`
explicitly never writes it.

### 4.2 Content angles this unlocks (highest value first)

1. **"The Korean sunscreen you're about to buy at Sephora isn't the one you saw on TikTok."** The
   flagship. True, checkable, saves money, and timed to the rollout.
2. **"What to actually buy at the Olive Young US store."** Nobody in English publishes live Olive Young
   rankings; Seoul Sister has the data.
3. **Reddit:** answer the reformulation question where it's *already being asked* rather than posting
   about it cold. Standing rule — ground every product claim in the Seoul Sister database first, and
   run the preflight/claim checks. Never assert a product fact the DB can't support.
4. **Ingredient/education content** riding the same search demand (see §4.3).

### 4.3 Real query shapes (from Bing Webmaster AI Performance, 7 days ending Jul 24 2026)

Use these; don't invent keywords. Verified first-party, not guesses:

| Query | Citations | Our share |
|---|---|---|
| `best korean cleanser` | 20 | **33.3%** |
| `4% niacinamide` | 12 | 24.5% |
| `best lemongrass skincare for blemishes` | 5 | **100%** |
| `best korean eye cream` | 4 | **66.7%** |

Long-tail shapes we already win: `torriden cleansing milk`, `COSRX snail mucin disadvantages`,
`ANUA Rice 70`, `how to spot fake Korean skincare products`.

**Note the pattern:** we win *product-research* and *ingredient* queries. Sunscreen-attribute queries
("korean sunscreen no white cast", "PA++++ sunscreen") are a documented gap where 613 products carry PA
ratings and no structured English equivalent exists anywhere. That is where this window points.

### 4.4 Structural fix (RECOMMENDATION — evaluate, don't just build)

Consider extending the `ss-pricing-sync.js` pattern to a general **facts mirror**: Seoul Sister exposes
verified counts and load-bearing facts at a `/api/lgaas/*` endpoint; LGAAS pulls on the existing cron.

**Argument for:** this is the 3rd+ manual sync; price got automated only after real users were served a
stale number.

**Argument against, and take it seriously:** the *calibrations* in §2 are judgment, not data. An
auto-mirror that syncs numbers but not nuance could make things worse by refreshing "SPF 36 vs 19" while
the guardrails rot. If you build it, sync **numbers only** (counts, price, message limits) and keep
prose facts human-authored — exactly the line `ss-pricing-sync.js` already draws around
`price_history_note`.

**Do not build this if** the greps in §3 come back clean, i.e. someone already solved it.

---

## 5. Acceptance

- [ ] §3 greps re-run; findings recorded (agreeing or contradicting this doc)
- [ ] Profile carries the retail timeline, the SPF table, **all four calibrations**, and the banned list
- [ ] Stale basics corrected: $24.99, 12 messages + gate at 8, 6,065/553/14,961
- [ ] A generated test draft on the sunscreen angle is reviewed by a human against §2 **before** anything
      publishes — the calibrations are exactly what a generator will drop
- [ ] Retailer policy (Olive Young / Soko Glam / iHerb; never YesStyle / Stylevana / StyleKorean) intact
- [ ] §4.4 explicitly decided either way and the decision written down

---

## 6. Cross-references

- Seoul Sister `CLAUDE.md` → "Shelf Visibility & the Western Shelf" (sunscreen exception, banned claims)
- Seoul Sister `GEO-STRATEGY.md` → citation data, deferred page types, forbidden GEO tactics
- Seoul Sister `bailey/CREATORS-CORNER-AND-WHATS-WORKING-JUL30.md` → same window, creator-channel side
- LGAAS `docs/SEOUL-SISTER-PROFILE-SYNC-PLAN.md` → the March predecessor to this doc (now itself stale)
- LGAAS `utils/ss-pricing-sync.js` → the one working auto-mirror; the pattern to copy or deliberately not

**One thing to keep in view:** the citation is a RENTED asset (one model update cut brand citations 41%
industry-wide in early 2026). The email list and the Yuri relationship are OWNED. Content that converts
this window into captured leads is durable; content that merely earns more citations is not.
