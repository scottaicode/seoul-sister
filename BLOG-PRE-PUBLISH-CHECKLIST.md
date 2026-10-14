# Blog Pre-Publish Checklist

**For:** any LGAAS-generated post going out under Seoul Sister's name.
**Time:** about two minutes. **Earned:** Aug 13 2026, when four defects survived an AI Score
of 85/100 and were caught only by reading 1,500 words line by line, repeatedly, past midnight.

> **The AI Score is not a fact-checker.** It grades structure and readability. A post can
> score 85 while asserting an unverified clinical claim and disowning the client's own data.
> Both happened. Do not read a high score as verification of anything.

---

## The four checks

### 1. Is every factual claim verified, and verified THIS session?

Clinical, regulatory, and market claims must be checked at a **primary source** before
generation, not after. Not recalled. Not "it's probably right." Manufacturer pages,
peer-reviewed literature, the regulator's own site.

A recalled number is how this repo published a stale formulation, and how the de minimis
repeal was missed. If you have not opened the source this session, the claim is unverified,
and unverified means it does not ship.

**Specifically watch:** anything with a unit (daltons, ppm, SPF, %), anything with a date,
anything about what a regulator requires, anything about what a product contains.

### 2. Are first-party figures cited AS ours?

Any number from the Seoul Sister database must be attributed to Seoul Sister, with the
source and the query date, and stated plainly enough that a reader knows what it counts.

**Fail signals** — if the draft says any of these about our own data, stop:
"floating around", "you may have seen", "people throw around", "aren't gossip",
"the exact number matters less than the direction".

This is the moat. A hedged first-party figure is a generic explainer any competitor can
write. An owned one is not.

### 3. Does the SEO meta description match the current title and thesis?

The meta is carried forward on regeneration and does **not** reliably update when the body
changes. It is also the string Google displays and AI answer engines quote, so a stale meta
propagates a retracted claim into the exact surfaces that matter most.

Read it against the finished article, every time. Confirm it does not promise something the
article retracts, and that any figure in it is scoped to its real denominator.

### 4. House rules

- Retailers: Olive Young, Soko Glam, iHerb only. Never YesStyle, Stylevana, StyleKorean,
  Amazon, eBay.
- No em-dashes.
- No claim that a topical product does something it cannot (no "replaces collagen", no
  "dermatologist-level", no implied clinical credential).
- No naming specific products as offenders when the finding is about a category.
- Internal links present; Yuri CTA present.

---

## After publishing

**Publishing in LGAAS is not the same as being live.** Verified Aug 13 2026: a post showing
PUBLISHED in Blog Manager returned 404 on seoulsister.com. Three systems reported three
different states for one post — Blog Manager said PUBLISHED, AriaStar's content data said
approved-not-live, the live site said 404. The live site was right.

Run **Sync to Site**, then open the live URL and confirm it renders:

```
curl -s -o /dev/null -w "%{http_code}\n" -L https://www.seoulsister.com/blog/<slug>
```

200 means live. Anything else means it is not, whatever the badge says.

Then confirm it landed in Seoul Sister's own table, which is what the sitemap and the
ingredient pages read from:

```sql
SELECT slug, published_at FROM ss_content_posts WHERE slug = '<slug>';
```

An empty result means the post exists only in LGAAS.

---

## Related

- `LGAAS-WORK-ORDER-BLOG-PROVENANCE-AND-META.md` — the two structural fixes that make
  checks 2 and 3 mostly unnecessary. Until those ship, run all four by hand.
- `CLAUDE.md` → *Silent Failure* and *Clinical Data Honesty* — the load-bearing sections
  this checklist is a content-side application of.
