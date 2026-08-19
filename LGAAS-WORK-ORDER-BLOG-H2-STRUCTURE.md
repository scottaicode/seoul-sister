# LGAAS Work Order — blog body structure is now load-bearing for Seoul Sister's funnel

**Raised:** Aug 19 2026 · **Owner:** LGAAS blog generation pipeline · **Priority:** low-medium
**Type:** an INVARIANT to preserve, not a change to make. Nothing is broken today.

---

## What changed on the Seoul Sister side (Aug 18-19 2026, commit `68a26f2`)

Blog posts average **2,021 words**, and until now the only Yuri entry points
rendered **after the entire article body**. A visitor had to finish ~2,000 words
before being offered the product. That is now fixed: a Yuri CTA renders
**mid-article**, verified live at **9% into the page**.

**How the placement works** (`src/lib/utils/article-split.ts`): the rendered HTML
is split immediately before the **SECOND top-level `<h2>`**, and the CTA is
rendered as a React node between the two halves. Nothing is injected into the
HTML string.

Why the second `<h2>` and not a word count: measured across all 46 published
posts, it lands at a **median 124 words (6% in)**, never past 17%, and always
after one complete section. A naive word-count split lands inside a `<ul>` or
`<blockquote>` and produces invalid nesting.

---

## The dependency this creates on LGAAS

**Seoul Sister's funnel now depends on a structural property of the markdown
LGAAS generates.** LGAAS owns `body`; Seoul Sister only renders it.

Current state, measured today across all 46 published posts:

| Check | Result |
|---|---|
| Posts with ≥2 top-level `<h2>` | **46 / 46** |
| Posts that would get NO mid-article CTA | **0** |
| Posts with an `<h2>` nested in a blockquote | **0** |
| Median `<h2>` count per post | **7** (min 5) |

So there is **no defect today**. This document exists so a future change to the
generator does not silently remove the CTA.

### The invariant to preserve

> **Every generated post should contain at least two top-level `##` headings,
> with real body content before the second one.**

This is already how LGAAS writes posts (median 7). It is being written down
because it is now load-bearing rather than merely stylistic.

### What would break it, and how it would fail

The failure is **silent and safe**, which is exactly why it would go unnoticed:

- A post using `###` for all its sections → `splitArticleForCta` finds no second
  `<h2>`, returns `didSplit: false`, and the article renders **whole with no
  mid-article CTA**. No error, no test failure, no visible defect — just a post
  that quietly reverts to the old "CTA only after 2,000 words" behavior.
- A post whose first `<h2>` sits at index 0 with everything else under `###` →
  same outcome.
- An `<h2>` nested inside a blockquote (`> ## heading`) → the split would land
  mid-container. **Zero posts do this today**; recorded because the helper is
  not depth-aware (its "top-level" comment is aspirational).

**Nothing crashes. The post just loses its best conversion surface.**

---

## The ask

1. **Keep generating `##` section headings** (≥2 per post, with content before
   the second). No change needed — just don't drop below that.
2. **If the blog prompt/template is ever revised**, treat "at least two `##`
   sections" as a hard requirement rather than a style preference, and note that
   Seoul Sister reads it structurally.
3. **Do not nest headings inside blockquotes.**

## What is explicitly NOT being asked

- No change to voice, length, topic selection, FAQ blocks, or `meta_*` fields.
- No new field, no schema change, no ingest change.
- **This does not affect any other LGAAS subscriber** — the split logic lives in
  Seoul Sister's renderer, not in LGAAS.

## How to verify if anything is ever in doubt

Run against `ss_content_posts` (Seoul Sister DB): render each `body` through
`marked`, count top-level `<h2>` occurrences, and confirm the second one is at
index > 0. Expected result: every published post qualifies. Today: **46/46.**

## Related

- `LGAAS-WORK-ORDER-CHEAP-VS-EXPENSIVE-INTENT.md` — the other open blog ask
  (a missing post, raised the same day).
- `LGAAS-WORK-ORDER-BLOG-PROVENANCE-AND-META.md` — the open `meta_*` work order.
  **Note for whoever picks that up:** a separate Aug 19 finding is that
  `meta_title` ships as a truncated prefix of `title` on 36 of 46 posts. That is
  **NOT urgent** — Google overrides the tag and displays the full title, so it is
  hygiene, not a traffic lever. Do not let it be presented as a CTR fix.
