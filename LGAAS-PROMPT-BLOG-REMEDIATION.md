# PROMPT FOR THE LGAAS AI SESSION — Seoul Sister blog remediation

**Scott: paste everything below the line into a fresh Claude Code session opened in
`/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/lgaas`.**

---

You are working in the LGAAS repo. Your job is to remediate all 43 Seoul Sister blog posts.
This is an editing pass over existing published content, not new generation.

## Read these first, in this order

1. `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/seoul-sister/LGAAS-WORK-ORDER-BLOG-FLEET-AUDIT.md`
   — the complete audit. Every defect, every post, a 43-row checklist. **This is your spec.**
2. `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/seoul-sister/LGAAS-WORK-ORDER-PIE-CLUSTER-REFRESH.md`
   — one post worked in full depth, with verified product tables. The pattern to copy.
3. `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/seoul-sister/LGAAS-WORK-ORDER-SEO-GUARDIAN.md`
   — standing division of labor.
4. Your own `CLAUDE.md` (Human Voice Agent rules, AI-First invariants, the three blog surfaces).

## ⚠️ First, understand what caused this

`BLOG-ENHANCEMENT-PROMPT.md` in your repo root (March 10 2026) instructed a previous session
to weave Seoul Sister's feature pages into these posts. It listed `/cycle`, `/glass-skin`,
`/scan`, `/routine`, `/verify`, `/tracking`, `/dupes`, `/shelf-scan`, `/sunscreen` as things
to promote. That session did its job well.

**Since then the world changed and nobody told the blog:**

- **June 22 2026:** those standalone feature pages were **demoted** — Yuri became the single
  orchestrating surface. Measured lifetime usage now: Glass Skin Score **13**, label scans
  **4**, wishlists **0**. Sunscreen Finder and Dupe Finder aren't pages anymore, they're
  Yuri tools.
- Those pages live under `src/app/(app)/` and are **gated on `plan != 'free'`**. They return
  HTTP 200, so nothing flagged them — but a cold reader from Google clicking one hits a
  **signup wall**.
- **`/cycle` returns a hard 404.** No route exists. It's linked from four posts.

So: 17 of 43 posts currently route strangers into a paywall or a dead end, on the site's
only working acquisition channel (596 Bing AI citations/week, 123 Google clicks/week).

**Treat `BLOG-ENHANCEMENT-PROMPT.md` as historical. Do not follow it.** When you're done,
add a note at its top saying it's superseded, so no future session repeats this.

## The single most important rule

**Never CTA a stranger to a paywalled surface. CTA to Yuri**, who is free, needs no signup,
and is the only surface with a measured conversion record (16.4% email capture from visitors
who actually talk to her; the one cold paid conversion came through her).

Link the **homepage widget** (`https://seoulsister.com/`), not `/yuri`.

**`/yuri` is paywalled too.** It returns 200 but sits under `src/app/(app)/`, same gate.
Measured Aug 3 2026: **14 posts link `seoulsister.com/yuri`** and only **5** use free-widget
framing. So the most common "Ask Yuri" CTA on the blog currently sends strangers to a
signup wall — including on the PIH post, which is otherwise the quality template.

The 14 to fix: `how-to-get-glass-skin`, `how-to-build-a-korean-skincare-routine`,
`oily-skin-routine-guide`, `how-to-fix-dehydrated-skin`, `can-niacinamide-cause-acne`,
`best-korean-skincare-for-dark-spots`, `do-korean-eye-patches-actually-work`,
`best-korean-skincare-for-pie`, `why-does-your-makeup-look-worse`,
`how-to-figure-out-your-skin-type`, `why-is-k-beauty-so-expensive`,
`where-to-buy-k-beauty-online`, `best-korean-skincare-for-pih`,
`where-to-buy-authentic-korean-snail-mucin`.

Copy the framing from the 5 that get it right — the pattern is naming that it's free and
needs no account, e.g. *"ask Yuri, free, right on this page"* / *"no account needed."*

## How to work

Posts live in `lgaas_blog_posts.content` (markdown) for client_id
`b577e4df-1549-45ea-bb25-b2167d4f3292`. After editing a post, set
`external_delivery_status = 'pending'` and `external_delivery_attempts = 0`; the delivery
cron pushes it to the live site.

**Keep every slug.** These are in-place refreshes. A new URL forfeits earned ranking.

### Order of work

1. **Phase 0** — the harmful and broken things. Small, do them first.
2. **Phase 1** — policy + the 11 sunscreen caveats.
3. **Phases 2+3 batched** — the mechanical sweep across all 43 (same sections, one pass).
4. **Phase 4** — name real products on commercial-intent posts.
5. **Phases 5-6** — cross-links and housekeeping.

The audit doc details each. Do not skip posts with no flags; they still need the Yuri CTA
check and cross-links.

## Use multiple models, deliberately

This is a large editing job where a confident wrong edit is worse than no edit. Split it:

- **Opus (you)** — judgment work: the medical/factual corrections in Phase 0, the sunscreen
  reformulation calibration, anything where tone and honesty matter. Do not delegate these.
- **Fable 5** (`Agent` tool, `model: "fable"`) — use for **breadth and adversarial review**:
  - Spawn one agent to independently re-read all 43 posts *after* your edits and hunt for
    anything you introduced or missed. Give it the audit doc as the spec and ask it to
    verify each checklist row, quoting the post text.
  - Spawn a second to **verify every product claim** against `ss_products` in the Seoul
    Sister Supabase (read-only). Every named product must exist, be `is_verified`, have
    `review_count >= 200`, and the quoted price must match its row.
  - Use a third for the mechanical sweep (dead links, artifacts, CTA replacement) where the
    work is pattern-matching rather than judgment.
- **Run the adversarial pass before marking anything delivered.** Two of the defects in this
  audit existed for five months because nobody re-read the output.

## Grounding rules — non-negotiable

- Every product named must exist in `ss_products` with `is_verified = true`.
- **Require `review_count >= 200`.** Sorting by rating alone returns a wall of 5.00★ products
  with 0-2 reviews.
- **Watch for duplicate rows of the same product at different prices** (verified: Etude
  SoonJung pH 5.5 Relief Toner exists at `$9.50/7,201 reviews` and `$16.00/1,700`). Use the
  highest-review row and quote **that** row's price.
- Prices are as-of-date: *"about $X at Olive Young"*, never a live guarantee.
- Retailer recommend-set: **Olive Young, Soko Glam, iHerb.** Never YesStyle, Stylevana,
  StyleKorean. No Amazon/eBay links. **Naming a retailer to warn about it is fine** — the ban
  is on recommending.
- Never invent a product, price, INCI, or rating. If you can't verify it, don't name it.

## Read before you edit

Three things in this fleet look wrong to a keyword scan and are actually correct. A
find-and-replace would destroy them:

1. **Both sebaceous-filament posts** say you *can't* permanently remove them. That reads as a
   risky claim and is the most clinically correct copy on the blog, on the site's
   highest-impression query cluster.
2. **`where-to-buy-k-beauty-online`** names YesStyle and StyleKorean *to say "we don't
   recommend them."* That's compliant and useful.
3. **`retinol-or-retinal`** contains the best sunscreen-reformulation paragraph on the site.
   **Port it, don't rewrite it.** It's quoted verbatim in the audit doc.

## The quality bar already exists

Posts **25 (PIH), 29 (evaluate-your-routine), 35 (retinol-or-retinal), 39 (COSRX-fake)** already
do everything this order asks. Read them before editing anything else. The June-onward cohort
is good; the problems cluster in February–May, before the pipeline matured. **You are bringing
older posts up to a standard Seoul Sister already set — not inventing a new one.**

## Voice

Seoul Sister's moat is honesty. Two posts currently invent a personal history ("I bought my
first tube two years ago", "the night I sat cross-legged on my bathroom floor") under a
"Seoul Sister Team" byline. Remove fabricated biography; keep the warmth. Editorial "we",
grounded framing ("in our catalog", "users tell us"), or name Yuri directly.

Avoid AI tells: "dive into", "unlock", "game-changer", "landscape", "journey". Em-dashes in
blog bodies are a style note, not a policy violation — don't mass-replace them.

## Definition of done, per post

- [ ] No gated-feature CTA, no `/cycle`, no `/yuri` link.
- [ ] At least one Yuri CTA to the homepage widget, placed at a decision point, offering what
      the page can't do (conflict-checking against what the reader already owns).
- [ ] Retailer mentions comply.
- [ ] Any Korean-sunscreen claim carries the US-reformulation caveat.
- [ ] Every named product verified in `ss_products` with ≥200 reviews and a matching price.
- [ ] No fabricated first-person history.
- [ ] Slug unchanged; `external_delivery_status = 'pending'`.

## What NOT to do

- Don't create new posts. Every item is an in-place refresh.
- Don't change slugs.
- Don't claim the outcome. LGAAS ships; Seoul Sister's SEO Guardian grades against real
  Search Console data on **2026-08-24**.
- Don't add a chat widget or new CTA pattern to feeder pages. That architecture was settled
  June 29 2026 (single front door) and re-confirmed August 2. Out of scope.

## Report back

When done, produce a short summary for Scott: posts touched, defects fixed by category, any
checklist row you could NOT complete and why, and anything you found that the audit missed.
Be honest about what you skipped — an unfixed post you flag is fine; an unfixed post you
report as done is not.
