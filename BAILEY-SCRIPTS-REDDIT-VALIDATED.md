# Bailey's Scripts — Reddit-validated topics

**Created:** July 25 2026. **These are not guesses.** Every topic below already beat a skeptical
skincare audience on Reddit, with the score attached. Reddit is the free A/B test; video amplifies
what already won (`SOCIAL-VIDEO-ENGINE.md`).

**Joins two things that had never been connected:** `REDDIT-VALIDATED-VIDEO-QUEUE.md` (the ranked
shot list, created Jun 20, **never used** — distribution was gated until ~Jul 20) and
`BAILEY-TIKTOK-BLUEPRINT.md` (the demo-led format + CTA test, Jul 24, which contained zero
references to Reddit).

**Source:** `ss_reddit_intel` — 500 comments, Mar 9 → Jul 14 2026, 6 subreddits, top score 89.
Scores refreshed daily by `capture-reddit-intel` cron.

### ⚠️ Two systems hold this data — LGAAS is the authoritative one

**`lgaas_reddit_responses` (LGAAS Supabase) is the AUTHORING system; `ss_reddit_intel` is the
mirror.** Verified July 25 2026 by querying both: the top rows are the same comments, same text.
LGAAS holds **340 Seoul Sister rows (271 posted, 63 archived-unposted, 4 rejected, 2 skipped)**,
filtered by `client_id = b577e4df-1549-45ea-bb25-b2167d4f3292`, persona `glass_skin_atx`.

**Query LGAAS, not the mirror, when sourcing new topics.** It has:
- **Fresher karma** — the top comment reads **92** in LGAAS vs 89 in the mirror
- **~10 days more data** — LGAAS runs to Jul 24; the mirror stops Jul 14
- **`replies` per comment** — the mirror's `reply_count` is 0 on every row
- **Draft status** — 63 generated-but-never-posted drafts the mirror never saw
- **Rejection reasons** — see below

⚠️ **Always filter by `client_id`.** LGAAS is multi-tenant; the overall top comment (391 upvotes)
belongs to a different client's persona in r/careerguidance. Cross-client rows will contaminate
topic mining.

⚠️ `lgaas_reddit_posts.subreddit_id` (not `subreddit`). Response text is `response_text`.

### The engagement finding — 599 replies, ZERO AI callouts

`lgaas_reddit_thread_replies` holds **599 replies** received on glass_skin_atx comments:
**179 question · 132 positive · 113 thanks_only · 111 sharing · 48 neutral · 16 negative.**

**`is_ai_callout` is false on all 599.** Nobody has ever accused the persona of being AI, across
five months on AI-skeptical subs. That is stronger than the documented <0.3% detection figure, and
it is direct evidence for the proud-AI thesis: Yuri-assisted writing reads as human even to a
hostile audience. **179 replies were questions** — the strongest engagement signal available, and
the reason reply-to-comment videos (SS-6) have real material behind them.

### What the rejected drafts teach

Only 6 drafts were ever killed. The only *systematic* kill reason is **ungrounded product-mechanism
claims** — two `wrong_mechanism` rejections, one for claiming composition facts about three products
absent from `ss_products`, one for getting a sunscreen-pilling mechanism backwards on r/tretinoin
"where users will catch it." That is the same failure mode the ground-in-data rule exists to
prevent, and it is why every product claim below was verified against the catalog before writing.

---

## ⚠️ How to read the scores (do not skip)

**Upvotes measure RESONANCE, not CORRECTNESS.** The corpus contains two negative-scoring comments
and **neither is factually wrong** — the −3 was downvoted for pushing back on another commenter
while being correct on the facts. The teacher grades social register and accuracy on the same axis.

Every topic below is `was_corrected = false` (no peer factually corrected it) AND high-scoring, so
both bars are cleared. **Still verify any product/ingredient claim against `ss_products` before
filming** (`feedback_ground_in_data`). Products named below were checked and exist in catalog.

**Also:** `views` is NULL on all 500 rows (Reddit API limitation). Score is a reach proxy only.

**Format transfer note:** these won on Reddit, where long and technical works. The INSIGHT
transfers; the FORMAT must be rebuilt for 25 seconds.

---

## R-1 🟢 — The water sheeting test · **55 upvotes** (r/AsianBeauty) · ARM A
*The single most video-native item in the corpus. It's a physical demonstration. MAKE THIS FIRST.*

**0-3s** — Already at the sink, splashing water on your face. Motion before words.
> "You're probably not washing your sunscreen off. Ten second test."

**3-18s — DEMONSTRATE IT.** Do it on camera.
> "Rinse like you normally would. Then splash plain water on.
> If it beads up like rain on a waxed car, there's still sunscreen sitting there.
> If it sheets off flat and even, you're actually clean."

**18-28s**
> "Anessa and Biore are water resistant so they cling way harder. Beauty of Joseon comes off
> easy. A beach day and a desk day don't need the same cleanse."

**28-31s**
> "It's called Seoul Sister. It reads about fifteen thousand ingredients so you don't have to."

*(Demo closer, not the origin closer — see the closer table in `BAILEY-TIKTOK-BLUEPRINT.md`. "I
built this with my dad" belongs on origin-story videos; after a capability demo it shrinks what you
just showed.)*

**On screen:** `the 10-second sunscreen test`
**Why it wins:** visual, testable tonight, zero product purchase required. Pure utility.

---

## R-2 🟢 — "How do you even choose?" · **68 upvotes** (r/koreanskincare) · ARM A
*A stranger posted the decision objection and 68 people agreed. This is the product thesis,
externally validated.*

**0-3s**
> "Someone asked how you're supposed to choose between six thousand K-beauty products."

**3-20s — THE DEMO.** Screen-record asking Yuri for a starting routine for your real skin.

**20-30s**
> "The honest answer that got upvoted the most was: ignore the ten step thing. Cleanser,
> moisturizer, sunscreen. That's it. Let your skin settle for a few weeks and then you can
> actually tell what it needs.
> The problem was never too few products. It's six thousand and nobody telling you which four
> are yours."

**30-33s**
> "seoulsister.com if you want her to look at yours."

---

## R-3 🟢 — "Careful relying on ChatGPT for your routine" · **15 upvotes** (r/koreanskincare) · ARM A
*Found in the corpus, NOT in the existing queue. A stranger made the Seoul Sister pitch without
knowing Seoul Sister exists. Best demo setup available.*

**0-3s**
> "Please stop building your skincare routine with ChatGPT."

**3-22s — THE DEMO, side by side.** Ask a general chatbot for a routine. Then ask Yuri the same
thing. Show the difference: one guesses, one reads the actual ingredient list and flags the
conflict.

**22-32s**
> "It doesn't know ingredient lists. It doesn't know which products conflict. It'll confidently
> recommend something that sounds right and isn't.
> Confident and wrong is worse than nothing when it's going on your face."

**32-35s**
> "It's called Seoul Sister."

**On screen:** `confident ≠ correct`
*Note: this is the honest version of the pitch — the differentiator is the ingredient database,
not "AI good." Do not overclaim; Yuri is an AI too.*

---

## R-4 🟢 — Pores are a hydration problem · **49 upvotes** (r/AsianBeauty) · ARM B
**0-3s** — Close on your own skin.
> "Your pores might be an oil problem caused by not enough water."

**3-25s**
> "The thing that got upvoted hardest on a pore thread: dehydration makes your skin overproduce
> oil, and that stretches pores out more.
> So if your barrier's already compromised, throwing more BHA and acid at it makes the oiliness
> worse, not better.
> Hydrating toner, two or three thin layers, before you go anywhere near an exfoliant."

**Pinned comment:** `the app is seoulsister.com`
**On screen:** `more acid ≠ smaller pores`

---

## R-5 🟢 — Scale DOWN before an event · **38 upvotes** (r/AsianBeauty) · ARM C (no CTA)
*Un-co-opted de-influencing: no alternative product offered. Control arm.*

**0-3s**
> "Three days before something important, do less. Not more."

**3-25s**
> "Everyone panics and piles on masks and actives the week of. Backwards.
> Three days out I drop everything except a gentle cleanser, a centella or panthenol toner, and a
> basic ceramide moisturizer. No actives. No exfoliant. Nothing I haven't already tested.
> Skin looks calmer by day two purely from not being provoked."

**No CTA. Control arm — say nothing.**
**On screen:** `do less. seriously.`

---

## R-6 🟢 — Korea vs international gap · **89 upvotes** (r/koreanskincare) · ARM B
*Highest-scoring comment in the corpus. Products verified present in `ss_products`.*

**0-3s**
> "Everyone here is still on Cosrx snail mucin. Korea moved on."

**3-25s**
> "What's actually in every Olive Young: Centellian24 Madeca, the madecassoside creams from
> clinic-adjacent brands. Korean moms swear by it for barrier repair.
> Numbuzin no.3 essence. Torriden Dive-In. Goongbe, which is technically for sensitive kid skin
> and adults quietly use it anyway."

**25-32s**
> "The gap between what Korea buys and what gets marketed here is the entire reason this exists."

**Pinned comment:** `seoulsister.com`
**⚠️ Verify each product is still in catalog + check price live before naming. Retailer policy:
Olive Young / Soko Glam / iHerb only — never YesStyle, Stylevana, StyleKorean.**

---

## R-7 🟢 — Hwahae, the app Koreans actually use · **42 upvotes** (r/koreanskincare) · ARM A
*The founding thesis, validated by strangers who had never heard of Seoul Sister. Pair with the
origin story.*

**0-3s**
> "Korea has an app for this. It's just not in English."

**3-22s**
> "Hwahae. Massive database, real reviews filtered by skin type, ingredient breakdowns, category
> rankings. It's what Koreans actually use to research products.
> The rankings there look nothing like what gets pushed to us."

**22-32s**
> "My dad and I built the English version of that idea. That's the whole origin story.
> It's called Seoul Sister."

**On screen:** `화해 (Hwahae)`

---

## R-8 🟢 — Stop watching creators, watch Olive Young · **18 upvotes** (r/KoreanBeauty) · ARM B
*Not in the existing queue. Slightly spicy, on-thesis, and it's what the trend pipeline does.*

**0-3s**
> "Stop taking product recs from creators. Including me."

**3-24s**
> "The thing that actually changed my buying: I stopped looking at what creators push and started
> looking at what Korean consumers actually buy. Olive Young publishes bestseller lists and they
> update constantly.
> That's what's performing in Korea, versus what's being marketed at us over here. They're not
> the same list."

**Pinned comment:** `seoulsister.com`
**On screen:** `including me 🙃`
*The self-implication is the hook. Do not soften it.*

---

## R-9 🟢 — Stinging = barrier damage · **23 upvotes** (r/koreanskincare) · ARM C
*Bailey's own story. Keep first-person — never a symptom checklist (playbook Non-Negotiable #7).*

**0-3s**
> "When basic products started stinging, I thought I needed stronger ones."

**3-25s**
> "Wrong direction. For me the stinging meant my barrier was letting things through that it
> normally blocks. Not sensitivity. An actual gap.
> Took two weeks of cleanser, moisturizer, sunscreen and nothing else. Centella first to calm it,
> then ceramides to rebuild."

**No CTA. Control arm.**
*⚠️ First-person only. "For me it was" — never "here's how you know if yours is damaged."*

---

## R-10 🟢 — The PDRN sheet mask puffiness · **15 upvotes** (r/koreanskincare) · ARM B
*Mechanism reveal. Answers a question people actually panic-search.*

**0-3s**
> "You slept in a sheet mask and woke up puffy. Here's why."

**3-25s**
> "Glycerin is usually the second ingredient. Leave it occluded against your face for eight hours
> and it keeps pulling water into the top layers of your skin. It's a humectant sponge.
> Not dangerous. Just don't sleep in them. Twenty minutes and take it off."

**Pinned comment:** `seoulsister.com`

---

## Filming order

| # | Topic | Score | Arm | Why this order |
|---|---|---|---|---|
| 1 | **R-1 water sheeting** | 55 | A | Most video-native thing in the corpus |
| 2 | **R-3 ChatGPT warning** | 15 | A | Best demo setup; stranger made our pitch |
| 3 | **R-2 how do you choose** | 68 | A | Product thesis, externally validated |
| 4 | **R-6 Korea gap** | 89 | B | Highest score; verify products first |
| 5 | **R-7 Hwahae** | 42 | A | Founding thesis + origin story |
| 6 | **R-4 pores** | 49 | B | Contrarian, actionable |
| 7 | **R-5 scale down** | 38 | C | Control arm |
| 8 | **R-8 stop watching creators** | 18 | B | Spicy, on-thesis |
| 9 | **R-9 stinging** | 23 | C | Control arm |
| 10 | **R-10 PDRN puffiness** | 15 | B | Mechanism reveal |

**Arm balance:** A = R-1, R-2, R-3, R-7 · B = R-4, R-6, R-8, R-10 · C = R-5, R-9.
Grade on `tt` sessions per 1,000 views per `BAILEY-TIKTOK-BLUEPRINT.md`.

---

## Standing rules

- Verify every product claim against `ss_products` before filming
- No em-dashes in any spoken line, caption, or on-screen text
- Retailer policy: Olive Young / Soko Glam / iHerb. **Never** YesStyle / Stylevana / StyleKorean
- Medical line: first-person experience only, never a symptom checklist
- Disclose co-creator role in-video AND above the caption fold on every 🟢
- Measure **Yuri conversations started**, not views
- Never mix a Shop tag with a Seoul Sister mention
