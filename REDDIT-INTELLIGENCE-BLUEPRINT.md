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

### THE OPEN ACTION (this is the whole point — do it)

**The Reddit profile link must carry `?from=reddit`.** Right now it almost certainly doesn't, which is why every arrival lands as `(none)` and the channel is invisible.

- Profile "Social Link" → `https://seoulsister.com/?from=reddit`
- Any in-comment link → `?from=reddit`

Until that's done, `attributed_sessions` stays 0 whether or not Reddit is working, and we learn nothing. **This one edit is worth more than everything else in this document.**

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

## What to do next (in order)

1. **Apply the migration** — `psql "$DATABASE_URL" -f scripts/migrations/create_ss_reddit_intel.sql`
2. **Add `?from=reddit` to the Reddit profile link.** ← highest-leverage action in this document
3. **Let the cron run.** Corpus banks daily at $0.
4. **Read `attributed_sessions` in ~2 weeks.** That number decides whether Reddit is a real channel or a beloved hobby.
5. **Then, and only then**, revisit Piece B.
