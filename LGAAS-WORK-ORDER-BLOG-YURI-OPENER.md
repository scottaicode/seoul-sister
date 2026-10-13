# LGAAS Work Order: send a per-post Yuri opener with every Seoul Sister blog post

**From:** Seoul Sister, Oct 12 2026. **For:** the LGAAS session that owns `api/content-blog.js` and
the Seoul Sister ingest delivery. **Size:** small (one output field, one payload key).

## Why

Every Seoul Sister blog CTA used to pre-fill the same visitor message ("I just read your guide on X,
can you help me figure out what's right for my skin?"). Measured Sep 14 to Oct 11 2026 (GA4 landing
sessions vs `ss_widget_sessions.landing_path`):

| Post | Sessions | Yuri chats |
|---|---|---|
| Acne-scar (PIE) | 156 | 0 |
| How to tell if K-beauty is fake | 106 | 0 |
| Japanese/Korean sunscreens in the US | 20 | 3 |

The generic opener fits "which one is right for me?" posts and misses the rest. Seoul Sister now
stores a per-post opener (`ss_content_posts.yuri_opener`), shows it as the CTA text, and pre-fills it
as the visitor's first message. The 48 existing posts were backfilled by hand. New posts need LGAAS
to write one.

## What to build

1. **Generate `yuriOpener` with every Seoul Sister blog post** (all three blog surfaces: manual
   "+ New Blog", cron, Reddit-derived). It is the ONE question a reader most likely wants to ask
   next about their own situation after reading this post. Rules the generator must follow (each
   was earned in review on Oct 12):
   - First person, the reader's voice, 8 to 22 words, 10 to 240 characters. No em-dashes.
   - **Self-contained:** Yuri does NOT see the post. Name the topic or product; never "these",
     "this one", "the ones in your list".
   - **State the problem, don't ask permission.** "Can I describe my skin and you tell me?" spends
     one of the visitor's 12 free messages on "yes, go ahead".
   - Only what the free widget can do: text only (no photos), Korean catalog (no Japanese or
     Western picks it cannot ground), one solved #1 concern (never a complete AM/PM routine, never
     a full "check all my products for conflicts").
   - Authenticity posts ask "what should I check", never "is mine real" (Yuri gives graded
     signals, not verdicts, on a bottle she cannot see).
   - Do not restate a fact from the post that the catalog contradicts (a discontinued product whose
     sibling is still sold made Yuri likely to say "it's still available").
   - Examples that passed review:
     - "I have red marks left from old breakouts that won't fade. What should I actually use on them?"
     - "I'm worried my COSRX snail mucin is fake. What should I check on the bottle and box, and does where I bought it matter?"
2. **Send it as `yuri_opener` in the ingest payload** to `POST /api/admin/content/ingest`. The
   endpoint already accepts it (`z.string().trim().min(10).max(240).nullable().optional()`).
   - Omit the key, or send null, when you have no opener. **Seoul Sister ignores null** so a
     re-delivery never erases an opener set by hand. Only a string overwrites.
   - On a content revision, regenerate the opener if the post's thesis changed.

## Order of operations

Seoul Sister must apply migration `20261012000001_blog_yuri_opener.sql` BEFORE LGAAS starts sending
the key. Until then the endpoint drops the field rather than failing.

## Two related gaps found the same day (not in scope, recorded so they are not lost)

- **The manual route's product auto-fetch picks junk.** Seoul Sister's `/api/admin/products/search`
  orders by `rating_avg` with no verified, in-stock or review-count filter, so a "dry skin"
  topic returned 0-review unverified 5.00-rated sets and a topic naming four skin types returned
  zero moisturizers. That endpoint is Seoul Sister's to fix. Until it is, recipes put the picks in
  Additional Context.
- **The manual route still has no INCI fact-checker and no retailer policy**
  (`checkBlogIngredientClaims` is not imported by `api/content-blog.js`; the Olive Young / Soko Glam
  / iHerb rule reaches no LGAAS prompt). Recipes carry these rules longhand.

## Verify (name the row)

After the first new post ships through LGAAS:
`select slug, yuri_opener from ss_content_posts order by created_at desc limit 1;`
must show a non-null opener that LGAAS wrote. A post published by hand does not count.
