# Work Order — PIH cluster: internal links, not a rewrite

**Date:** 2026-09-03
**For:** LGAAS / AriaStar blog pipeline
**Type:** edit existing posts. NO new post. NO regeneration of the PIH post.

---

## The number

`best korean skincare for pih` — **723 impressions, 2 clicks, position 10.3**,
grown from 114 impressions a month ago (**6.3x**). It is the largest untapped
query on the site.

## What the Guardian proposed, and why it is WRONG

The Aug 30 report proposed making the PIH post "the single canonical target" and
"changing internal anchors on the PIE post." **Measured against the live pages,
that work is already done or unnecessary:**

- Canonicals are correct on both pages.
- The PIE post already links to the PIH post **twice**, with good anchors.
- The PIH post is **longer** (3,701 vs 3,138 words), mentions PIH 55x vs the PIE
  post's 10, and has a correct title and meta.
- **The PIH page already OUTRANKS the PIE page on the money query: 9.32 vs
  10.72.** Google is already choosing the right page.

The PIE page still absorbs more impressions on that query only because it has
**148 ranking queries of accumulated authority vs the PIH page's 22**. This is an
authority gap, not a structure gap, and de-optimizing the PIE post would damage a
page earning 19 clicks to help one earning 3.

## What to actually do

**Add internal links from the topically-related posts that currently do NOT link
to the PIH post.** Only 2 of 14 pigmentation-adjacent posts link to it today.

### Priority 1 — the strongest link source
`/blog/best-korean-skincare-for-dark-spots-what-actually-fades-hyperpigmentation-and-whats-just-marketing`
(253 impressions, **5 clicks** — more than the PIH page itself, position 14.4)

It already mentions PIH in the body and does not link. Add ONE contextual link,
in the sentence where PIH is already discussed, with descriptive anchor text such
as *"Korean skincare for PIH and post-acne dark spots"*. Do not add a link block
or a "related posts" list.

### Priority 2
`/blog/how-to-get-rid-of-hyperpigmentation-k-beauty-guide` (May 5) — directly
on-topic, no link today.

### Priority 3
`/blog/best-korean-skincare-for-dry-skin-with-pigmentation-a-routine-that-treats-both`
(76 impressions, position 13.5).

## Rules

- **Do NOT edit the PIE post.** It earns 19 clicks; leave it alone.
- **Do NOT regenerate the PIH post.** It is already 3,701 words with per-product-
  type H2s (Best Korean Serum for PIH / Toner / Essence or Ampoule). A regenerated
  version risks losing what is working.
- **One contextual in-body link per post**, placed where the topic already comes
  up. Not a footer block.
- Anchor text should name the destination topic, never "click here" or "read more".
- No em-dashes.
- Retailers: Olive Young Global, Soko Glam, iHerb only.
- Do not state dollar prices.

## How this gets graded

Expected: `best korean skincare for pih` moves the PIH page from position 9.3
toward <8, and the PIH page earns **>=10 clicks** in 28 days (baseline 3).

Note for the SEO Guardian: a >=6 threshold on a 3-click baseline is NOT
gradeable — the conditional test needs >=10 to distinguish the result from
chance. Write the honest threshold.

---

## EXACT EDITS (paste-ready)

These three posts are `source: 'lgaas'` with an `lgaas_post_id`, and the Seoul
Sister ingest route (`/api/admin/content/ingest`) UPSERTS on that id and
**overwrites `body`**. So an edit made directly in the Seoul Sister database
would be silently reverted the next time LGAAS re-ingests the post. **These edits
must be made on the LGAAS side and re-ingested.** That is the profile-drift class
this project has already paid for once.

### Edit 1 (priority) — dark-spots post
`best-korean-skincare-for-dark-spots-what-actually-fades-hyperpigmentation-and-whats-just-marketing`
253 impressions, **5 clicks**, position 14.4. Best available link source.

FIND this existing sentence in the body:

> **Post-inflammatory hyperpigmentation (PIH)** is what you get after acne, a bug
> bite, or any skin trauma. Your skin overproduces melanin at the injury site as
> part of the healing response.

APPEND one sentence to that same paragraph:

> If PIH is specifically what you are dealing with, we go deeper on it in our
> guide to [Korean skincare for PIH and post-acne dark spots](/blog/best-korean-skincare-for-pih-fade-post-acne-dark-spots).

Rationale: the link sits inside the paragraph that already defines the term, so
the anchor text and surrounding context agree. No link block, no "related posts".

### Edit 2 — hyperpigmentation guide
`how-to-get-rid-of-hyperpigmentation-k-beauty-guide`

Add ONE contextual link where post-acne marks are first discussed, anchor text:
*"Korean skincare for PIH and post-acne dark spots"* pointing to
`/blog/best-korean-skincare-for-pih-fade-post-acne-dark-spots`.

### Edit 3 — dry skin with pigmentation
`best-korean-skincare-for-dry-skin-with-pigmentation-a-routine-that-treats-both`
76 impressions, position 13.5.

Same single contextual link, placed where post-acne pigment is mentioned.

### Do NOT

- Do not edit the PIE post. It earns 19 clicks and already links to PIH twice.
- Do not regenerate any of these three posts. Add a sentence; change nothing else.
- Do not add a footer "related posts" block to any of them.
