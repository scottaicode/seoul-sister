# Reddit Assist — Scope for a Safer, Faster, Better-Grounded Process

**Written Aug 5 2026.** Scope only — nothing here is built. Companion to
`REDDIT-INTELLIGENCE-BLUEPRINT.md` (which owns capture + the Piece B deferral)
and BP108 (which owns the bridge/CTA design in LGAAS). Read both before building.

---

## The actual process today (stated correctly)

| Step | Who | Automated? |
|---|---|---|
| 1. Find K-beauty threads worth answering | LGAAS discovery | Yes |
| 2. Choose which to answer | **Scott** | No |
| 3. Draft the reply | AI-assisted | Partly |
| 4. Verify the facts | **Scott + Claude, ad hoc, in chat** | **No** |
| 5. Post it | **Scott** | No |
| 6. Capture outcome (score, corrections) | `capture-reddit-intel` cron | Yes (fixed Aug 4) |

**Step 4 is the gap.** It is the step that protects the moat (honesty), it is
the step that currently has no tooling, and it is the step whose absence would
make any volume increase dangerous.

**Step 5 must stay manual.** Automating the post action is what converts
"a person using tools" into "an unattended bot" under Reddit policy, regardless
of draft quality. Everything below is designed so volume can grow WITHOUT
touching step 5.

---

## Why step 4 matters more than it looks

The corpus already shows the failure mode this prevents. From the July 1
lead-gen log, on LGAAS-generated blog content, review caught: a **fabricated
hyaluronic-acid claim** about Sulwhasoo First Care that the database contradicts,
and marketplace accusations that violate standing policy. Publish-blind would
have shipped both.

A Reddit comment is worse than a blog post in one specific way: **it is a public,
permanent, attributable claim made to a person who asked for help**, in front of
a community that reads INCI lists for fun. A single confidently wrong formulation
claim, corrected publicly by a knowledgeable stranger, costs more trust than ten
good comments earn.

The DB that can check this is real and large:

| Table | Rows |
|---|---|
| `ss_products` (verified) | 5,311 |
| `ss_ingredients` | 14,976 |
| `ss_product_ingredients` | 230,675 |
| `ss_products` with a price | 4,959 |
| `ss_ingredient_conflicts` | **5** |
| `ss_counterfeit_markers` | **11** |

Note the last two honestly: conflicts and counterfeit markers are too thin to
verify against. The checker must SAY SO rather than pass a claim it cannot check.

---

## PIECE 1 — The fact-checker (the ask)

**`src/lib/reddit/verify-draft.ts`** — a pure, deterministic, $0 checker that
takes draft text and returns findings. No AI, no network, no writes.

### What it checks

1. **Product exists.** Extract candidate product names, resolve each with the
   EXISTING `resolveProductByNameStrict` from `src/lib/yuri/tools.ts`. Do NOT
   write a second resolver — that one is battle-tested, refuses `partial`
   matches, and its all-terms strictness is deliberate (see the Melixir and
   "Rice 70 + Ceramide" incidents in CLAUDE.md).
   - Unresolved -> finding: *"named product not in catalog — verify by hand or
     drop the name."* NOT an error. ~40% of real-world products are legitimately
     outside a Korean catalog (the Western Shelf rule), and the draft may be
     correctly discussing CeraVe.

2. **Ingredient-in-product claims.** For any "X contains Y" / "X has no Y"
   assertion, check `ss_product_ingredients` joined to `ss_ingredients`.
   - Contradicted -> **`blocker`**. This is the Sulwhasoo class.
   - Product resolved but INCI absent -> *"cannot verify — this product has no
     ingredient rows."* Explicitly NOT a pass.

3. **Price claims.** Any `$NN` near a product name -> check `ss_product_prices`.
   - Stale beyond 14 days -> finding with the real `last_checked` date.
   - **Never auto-insert a price.** Prices go stale and a wrong one posted
     publicly is worse than none.
   - This is not hypothetical. Checked Aug 5: COSRX Advanced Snail 96 last
     priced **Aug 4** (fresh), Sulwhasoo First Care Activating Serum VI last
     priced **Feb 17** — nearly 6 months. Same catalog, same query, opposite
     trustworthiness. A checker that reports "price found" without the date
     would launder the second one.

4. **Policy rules** (from the standing review checklist, already earned):
   - No marketplace accusations (Amazon/eBay as counterfeit channels) — the
     Amazon commingling program ENDED March 2026; that claim is now false.
   - Don't STEER people to YesStyle / Stylevana / StyleKorean. Recommend
     Olive Young Global, Soko Glam, iHerb. **The reason is slow shipping and
     weak refund recourse — NOT counterfeit risk.** They sell authentic
     product and the checker must never suggest otherwise; that distinction is
     spelled out verbatim at `src/lib/yuri/advisor.ts:111-113` and
     `src/lib/yuri/specialists.ts:108`. A draft that says "avoid YesStyle,
     they sell fakes" is a `blocker`, not a pass.
   - No em-dashes (AI tell, and an unnecessary pattern signal on Reddit).
   - The "KTRI 2022 / 68% of COSRX sunscreen failed SPF" stat has no primary
     source — flag it anywhere it appears.
   - US-sold Korean sunscreens are REFORMULATED and test weaker
     (BoJ 36->19, Innisfree 48->16). Flag "buy it at Target" advice.

5. **Medical-referral floor.** If the thread or draft mentions moles, lesions,
   changing/bleeding spots, spreading rashes, suspected infection, or eye-area
   swelling -> require a referral sentence. This mirrors the Clinical Data
   Honesty rule already load-bearing for Yuri. Your best comments already do
   this by instinct; the checker makes it non-optional.

### What it returns

```ts
type Severity = 'blocker' | 'warn' | 'info'
interface Finding {
  severity: Severity
  rule: string          // 'ingredient_contradicted' | 'retailer_policy' | ...
  quote: string         // the exact span in the draft
  detail: string        // what the DB actually says
  suggestion?: string
}
```

`blocker` = do not post as written. `warn` = a human decides. `info` = FYI.

### What it must NOT do

- **Must not rewrite the draft.** It reports; the human decides. A checker that
  edits becomes a second author and the voice dies.
- **Must not pass silently.** "0 findings" must distinguish *checked and clean*
  from *nothing checkable was found* — the exact silent-failure class that cost
  this repo eight defects in one day and hid a dead cron for six days. Return an
  explicit `checked: { products: n, ingredient_claims: n, price_claims: n }`.
- **Must not gate on ingredient conflicts** (5 rows) or counterfeit markers
  (11 rows). Too thin. Say "not verifiable here."

### Interface

A CLI is enough to start, and it keeps the human in the loop by construction:

```
npx tsx scripts/verify-reddit-draft.ts --file draft.md
```

Cost $0, runs in seconds, no AI call. Add `--json` so it can later be called
from LGAAS or a small internal page without redesign.

---

## PIECE 2 — Outcome capture is already live (do not rebuild)

`ss_reddit_intel` already has `score`, `was_corrected`, `correction_note`,
`views`, `reply_count`, `attributed_sessions`, and the cron refreshes scores so
the community's verdict is watched as it moves. As of Aug 5 it holds 621
comments and runs daily.

**The one gap:** `was_corrected` is a column nobody sets. Populating it is what
turns the corpus into a graded record — per the Learning Loop principle, the
least-gameable teacher here is *a knowledgeable stranger publicly contradicting
a factual claim*. That is free, dated, and honest.

Cheapest version: in the capture cron, flag comments whose score went negative
OR that drew a reply containing correction language, for human confirmation.
Don't auto-label — let the flag queue a decision.

---

## PIECE 3 — Close the measurement loop (highest value, lowest effort)

The capture cron computes `reddit_attributed_sessions` but writes it to the RUN
metadata, not to the per-comment `attributed_sessions` column. So we cannot yet
answer **which comments drive visits** — only whether any do.

Not fixable precisely (Reddit gives no per-comment referral), but a good proxy
exists: `ss_widget_sessions.source='reddit'` timestamps can be attributed to the
comments posted in the preceding window. Coarse, honest, and enough to answer
"do high-scoring comments drive more clicks than low-scoring ones?"

**This is the question the whole channel hinges on and it is currently
unanswerable.** Worth more than any drafting improvement.

---

## PIECE 4 — r/SeoulSisterhood as an owned, linkable, citable surface

You moderate it (1 member). Its value is NOT community growth — that is a
multi-year project the funnel cannot wait for. Its value is:

1. **The one surface where linking is not spam**, because you set the rules.
2. **Reddit is the most-cited domain for beauty across ChatGPT, Perplexity,
   Gemini and AI Overviews**, while brand-owned domains are only ~2.4% of what
   engines read (AIVO, 1,500 answers / 3,814 citations). A subreddit post is
   third-party in a way seoulsister.com structurally cannot be.

So: post the ingredient breakdowns there as a permanent archive, and reference
them from comments only where genuinely relevant. Converts the no-links
constraint into an owned asset. **Low effort, no ban risk, real GEO upside.**

---

## What NOT to build

- **Auto-posting.** See above. This is the line.
- **Promotional insertion into comments.** BP108 holds this as Stage 2, gated on
  the bio link producing clicks first. The comments earn 610 views BECAUSE they
  carry no agenda; seeding mentions inverts pull into push and spends the asset
  that makes the channel work.
- **Piece B (claim extraction -> Yuri).** Still correctly deferred per
  `REDDIT-INTELLIGENCE-BLUEPRINT.md`. The bottleneck is not that Yuri lacks INCI
  knowledge — the two graded cold-stranger transcripts were both excellent and
  neither converted. Nothing is lost by waiting; the corpus banks either way.
- **A second product resolver.** Reuse `resolveProductByNameStrict`.

---

## Suggested order

1. **Piece 1 (fact-checker)** — protects the moat, unblocks volume safely.
2. **Piece 3 (per-comment attribution)** — answers the channel's open question.
3. **Piece 2 (`was_corrected` flagging)** — turns the corpus into a graded record.
4. **Piece 4 (r/SeoulSisterhood)** — no code; a posting habit.

Pieces 1-3 are measurement/quality work and sit in the always-allowed lane under
`NORTH-STAR.md`. None of them is a new user-facing feature.

---

## The honest caveat

None of this generates traffic. It makes the existing channel **safer to scale,
better grounded, and finally measurable**. The open question — does the bio link
convert at all — is still open, and capture only started running reliably on
Aug 4 2026. Give it 2-3 weeks before drawing conclusions, and do not spend the
aged account's credibility to shorten a path that has never actually been tested.
