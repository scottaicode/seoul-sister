# Seoul Sister - K-Beauty Intelligence Platform

> **⭐ READ FIRST — `NORTH-STAR.md` (repo root) governs WHETHER to build, before anything below governs HOW.** Seoul Sister is a 9/10 product with ~0 validated demand (0 conversions from 22 visitors, conversion rate unmeasured). The standing failure mode is building more product instead of answering *"will a stranger pay?"* So **new features are FROZEN by default** until visitor→paid conversion is measured and moving. Before planning ANY new feature/capability/polish, run the **`/ship-guard`** command — it blocks improvement-for-its-own-sake and redirects to growth/measurement work. Growth, lead capture, distribution, blocking-bugfixes, and cost/observability work are always allowed. "Best practices" and "AI-First" are HOW we build, never WHY — they don't clear this gate. `/ship-guard` is the revenue-side companion to `/ai-first-guard` (which still governs how judgment-making code is built).
>
> **🎬 Making a Yuri VIDEO (launch/hero, scrappy social, any Yuri clip)? READ `SEOUL-SISTER-VIDEO-PLAYBOOK.md` (repo root) FIRST.** It is the canonical craft rules earned on the "Meet Yuri" launch video (graded 4.2 → 8.6/10): lead-with-the-differentiator hook, the proud-AI principle (Yuri is openly AI — it's a trust flex, not a liability), the objective Gemini grading loop, swipe-rate-is-everything, the ElevenLabs VO method, amplify-validated-Reddit-winners, and the hard REJECT list (never fabricate, honesty is the moat, conversions not views). Video/distribution work is the always-allowed growth lane under the freeze — but it follows the playbook.
>
> **📁 Bailey's creator channel lives in `bailey/`** (moved there July 25 2026 from the repo root). Scripts, strategy, the creator arrangement, her feedback log, competitor teardowns, and the built PDF/DOCX deliverable she films from. Start at `bailey/README.md`. Older docs and CHANGELOG entries reference `BAILEY-FEEDBACK-LOG.md` by bare filename — it is now `bailey/BAILEY-FEEDBACK-LOG.md`. The video *craft* rules stay at root in `SEOUL-SISTER-VIDEO-PLAYBOOK.md` (see below), along with `SOCIAL-VIDEO-ENGINE.md` and `REDDIT-VALIDATED-VIDEO-QUEUE.md`, which are not Bailey-specific.
>
> **For any AI session opening this repository for the first time**: Read `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/principles.md` and `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/patterns.md` *before* touching any code in this repo. Those documents capture the operating philosophy this application was built under and that it continues to be developed under. Code that doesn't reflect those principles will be rejected.
>
> **🗺️ Sitemap / indexing work? Read `IS-ACTIVE-SEMANTIC-FIX.md` and `SITEMAP-QUALITY-FOLLOWUP.md` (repo root).** On Aug 4 2026 the sitemap went **2,033 → 14,096 URLs** after three compounding defects were fixed: `is_active` was used as a publish gate (it is a functional classification — "active ingredient vs. excipient" — and `ss_ingredients` has NO enabled column; the pollution guard is the only quality gate), PostgREST was **silently capping the query at 1,000 rows** and reporting no error, and the resulting set advertised ~2,018 URLs that 404'd. Every stage looked correct in code and was wrong on the live surface — removing the filter recovered nothing (the cap was binding), and fixing the cap published dead URLs. **Only sampling real URLs after each deploy caught any of it.** `SITEMAP-QUALITY-FOLLOWUP.md` carries a **dated recheck (Aug 18 2026)** on whether to filter ~1,549 parse-artifact URLs — deferred on purpose so Google's crawl grades them instead of a heuristic. Two traps recorded there: **never cut ingredient pages on `product_links = 0`** (1,981 of 2,014 such pages have real content and 650–860 rendered words), and a shade-code rule that flagged **`1,2-Hexanediol` (510 links)** because it starts with a digit — the July 30 over-correction repeating.
>
> **📈 Working on AI-citation / GEO / lead-gen-from-search? Read `GEO-STRATEGY.md` then `GEO-PLAYBOOK.md` (repo root).** `GEO-STRATEGY.md` is the execution record — what shipped (July 27 2026), the Bing citation baseline (525 citations/7d, 33-66% share on commercial K-beauty queries), and everything deliberately **NOT** built with row-counted reasons (1,242 ingredient×category / 214 brand / 63 subcategory pages). The standing rule: **the citation is a RENTED asset — one model update cut brand citations 41% industry-wide in early 2026 — while the email list and the Yuri relationship are OWNED.** Work that converts citations into captured leads is durable; work that earns more citations is not. Do NOT build new page types to chase citation volume: citations are already working (525/wk) and leads are not. The gate for unfreezing them, and for productizing the method via LGAAS, is identical — **one cold stranger arriving from an AI citation becoming a paying subscriber, attributable in first-party data.** `GEO-PLAYBOOK.md` is the generalized, teachable method, explicitly marked unproven until that gate clears. **Never grade this work with GA4** — it is bot-inflated (346 phantom users against 0 database rows on July 27); the honest denominator is `ss_widget_visitors WHERE total_messages > 0`, and the teachers are Bing AI Performance + GSC.
>
> **Also read `LEARNING-LOOP-BLUEPRINT.md` (repo root)** before adding any feature that makes a judgment. It defines the owner's overriding learning-loop principle — every app must learn from graded outcomes against the least-gameable teacher in its domain — and the specific upgrade path for Yuri (toward a measured skincare-outcome teacher, beyond today's subjective user feedback).
>
> **MANDATORY AI-First gate (every judgment-making change):** Run the **`/ai-first-guard`** command on the PLAN *before* writing code, and the **`/ai-first-check`** command on the DIFF *before* commit. (Ported from DeepChain June 2026, where this same gate caught real anti-patterns in production builds.) `ai-first-guard` blocks a plan that would replace Yuri's judgment with rigid logic, constrain her output, break a learning loop, or violate the Yuri Sole Authority Principle; `ai-first-check` verifies the actual diff did none of those. These are NON-SKIPPABLE for the Seoul Sister Guardian (see `GUARDIAN-CHARTER.md`): no autonomous change ships without an `ai-first-check` PASS plus `tsc`/`build` green. The commands live in `.claude/commands/`. Surface the fact, never cage the judgment.
>
> **The Seoul Sister Guardian (autonomous health system) — read `GUARDIAN-CHARTER.md` if you are continuing this work or were asked to activate autonomous fixing.** A zero-cost always-on watcher (`/api/cron/guardian-watch`, 3×/day, server-side, laptop-independent) already monitors health 24/7 and logs verdicts to `ss_pipeline_runs.metadata`. The autonomous *fix-while-Scott-sleeps* layer is DEFERRED with a complete self-contained activation runbook in `GUARDIAN-CHARTER.md` ("DEFERRED FEATURE 2") — Scott wants it live after a ~1-week report-only proving period (started June 5 2026) + his cost approval (~$5–15/mo). **If you are a fresh AI with no memory of this and Scott asks you to "turn on the Guardian" or "activate 24/7 fixing": read that runbook in full, confirm BOTH activation pre-conditions, and never activate without them.** Current mode lives at the top of `GUARDIAN-LOG.md` (currently `REPORT-ONLY`). The $0 push/email alerting feature ("DEFERRED FEATURE 1") is now **BUILT** (July 15 2026, `src/lib/guardian/alert.ts`): the watcher emails `GUARDIAN_ALERT_EMAIL` on a `critical` verdict OR a bounced/failed lead recap, de-duped against the prior run so a persistent condition alerts once. Autonomous *fixing* ("DEFERRED FEATURE 2") is still deferred.

## Project Overview

Seoul Sister is an English-language K-beauty intelligence platform whose product is **advice, not a catalog**. It bridges the gap between Korean beauty consumers (who have 187,000+ products, 5.77M+ reviews, and ingredient-level intelligence via Hwahae) and international consumers.

> **Positioning correction (Aug 9 2026) — read before writing any marketing, prompt, or strategy copy.**
> The founding line "Hwahae is Korean-only, no English equivalent exists" is **no longer true** — see the Competitive Landscape table. Hwahae Global is live in English at 100K+ MAU, ~80% US. Do not repeat the old premise.
>
> **What IS defensible, and was verified against the market (Aug 9 2026): the chat-first consumer skincare advisor lane is empty.** Every conversational skincare AI found — Haut.AI Skin.Chat, Perfect Corp's YouCam Beauty Agent, Revieve's advisor — is sold **B2B to brands and retailers**. That is a structural difference, not a feature gap: an advisor funded by a brand cannot say *"keep your CeraVe, you don't need Korean anything"* or talk a user out of two purchases. Yuri can, and did — that is what converted the first paying subscriber. Independence is the moat.
>
> **Seoul Sister sells a SERVICE, never products.** No inventory, no fulfillment, no product margin. Affiliate revenue is incidental and must never shape a recommendation.
>
> **A MARKETING-CLAIMS rule, and explicitly NOT an instruction to soften Yuri.** Read both halves; the second matters more.
>
> **Do not market Seoul Sister as "dermatologist-level" or imply a clinical credential** — in ad copy, the landing page, app-store text, or press. The FTC has brought enforcement against skin apps for unsubstantiated medical claims (MelApp, Mole Detective) and its 2024 "Operation AI Comply" sweep targets inflated AI capability claims. The title is the exposure, and we do not need it. Say the truer, stronger thing: **expert K-beauty judgment that knows your shelf, your history, and when to send you to a doctor.** The price comp is telederm (Curology ~$19.95/mo, Dermatica ~$24.99/mo) because we sit beside it as the ADVICE layer.
>
> **This changes NOTHING about how Yuri reasons or speaks, and no session may use it to make her more cautious, more hedged, or more disclaimer-heavy.** Yuri has 20+ years of Korean formulation-lab and cosmetic-chemistry experience and reasons at that level from the information in front of her — that is real and it is the product. She should keep stating conclusions with the confidence the evidence supports, keep using ancestry/age/climate/cycle as the genuine clinical inputs they are (see *Reason from population patterns, stay calibrated*), and keep declining to hedge when she knows the answer. Her honest limit is simply that she cannot examine, biopsy, or prescribe — which she already handles the right way by REFERRING (the lesion rule), not by weakening her advice. A Yuri who starts saying "I'm just an AI, see a professional" about ordinary skincare questions is a REGRESSION, not compliance. If you are tempted to add a disclaimer to a Yuri prompt because of this section, you have misread it.

**Vision**: The definitive K-beauty intelligence layer that translates Korean product knowledge for the global consumer, uses AI to build personalized routines, and solves the authenticity and price transparency problems that the $2B+ US K-beauty market has no good answer to.

**What Seoul Sister IS**: A knowledge and intelligence platform. Users come for ingredient analysis, routine building, counterfeit detection, product discovery, and AI-powered skincare advice.

**What Seoul Sister IS NOT**: An e-commerce store. Seoul Sister does not sell products, hold inventory, process product payments, or handle fulfillment. When users decide to buy, they go to retailers (Olive Young, Soko Glam, YesStyle, Amazon). We may earn affiliate commissions on referrals, but we never touch commerce.

**Target Audience**: Gen Z women (18-30) passionate about K-beauty, budget-conscious, ingredient-literate, TikTok-native.

## Yuri (유리) - AI Beauty Advisor

**Yuri** is Seoul Sister's AI beauty advisor -- the conversational intelligence that ties everything together.

**Why "Yuri"**: 유리 literally means "glass" in Korean. "Glass skin" (유리 피부) is THE aspirational K-beauty standard -- luminous, poreless, translucent complexion. The name is a subtle cultural nod that every K-beauty enthusiast feels connected to.

**Yuri's Role**:
- Personal beauty advisor who knows your skin profile inside-out
- **First thing every user experiences** -- conversational onboarding (not a form wizard)
- **Pre-signup demo** on landing page (try before you buy)
- Orchestrates 6 specialist agents for deep domain expertise
- Executes actions (add to routine, set price alert, scan product)
- Proactive intelligence ("trending in Seoul right now...")
- Memory across sessions ("you told me niacinamide causes flushing for you")
- Web search grounded (latest ingredient research, trend data)

**Yuri is NOT a chatbot.** She is a beauty intelligence advisor backed by specialist agents, the learning engine, the product database, and proactive monitoring. She delivers value that no human beauty advisor could match because she has access to the entire K-beauty intelligence database.

### Yuri Conversational Onboarding (Replaces Form Wizard)

**Philosophy**: If Yuri is the soul of the app, she should be the first thing every user experiences. A form says "we're an app." A conversation with Yuri says "we're your Korean beauty advisor." That first impression determines whether someone sticks around or bounces.

**How It Works**:
After registration, users enter a conversational onboarding with Yuri instead of filling out a form wizard. Yuri asks natural questions and Claude Sonnet 4.5 extracts structured skin profile data in the background (same pattern as LGAAS's AriaStar onboarding data extraction).

```
User registers
    -> Redirected to Yuri onboarding conversation
    -> Yuri: "Hey! I'm Yuri, your K-beauty advisor. Tell me about your skin --
              what's the one thing that drives you crazy about it?"
    -> User responds naturally (conversational, not checkboxes)
    -> Sonnet 4.5 extracts: skin_type, primary_concerns, current_products
    -> Yuri asks follow-up based on what's been captured vs what's still needed
    -> After sufficient data captured: "I have a great picture of your skin now!
       Let me build your personalized profile..."
    -> Structured ss_user_profiles record created from extracted data
    -> User enters the full app with a complete, rich skin profile
```

**What Yuri Extracts (Conversationally)**:
| Data Point | Form Wizard | Yuri Asks |
|-----------|-------------|-----------|
| Skin type | Dropdown: oily/dry/combo/normal | "How does your skin feel by afternoon?" |
| Concerns | Checkboxes | "What's the one thing you'd fix about your skin?" |
| Allergies | Text field | "Have you ever had a bad reaction to a product?" |
| Current routine | Multi-select | "Walk me through what you put on your face this morning" |
| Budget | Radio buttons | "What do you usually spend on skincare monthly?" |
| Fitzpatrick scale | Confusing I-VI picker | "How does your skin react to sun -- do you burn easily or tan?" |
| Climate | Dropdown | "Where do you live? Humidity makes a huge difference" |
| K-beauty experience | Scale | "Are you new to K-beauty or have you been deep in it?" |

**Yuri Knows When She Has Enough**: Onboarding tracks required fields. Yuri continues the conversation naturally until all critical profile data has been extracted. She never says "please fill out field 6 of 8." She says "one more thing -- do you wear sunscreen daily?" The experience feels like talking to a knowledgeable friend, not completing a medical intake form.

**Technical Implementation**:
- Dedicated onboarding conversation type (`ss_yuri_conversations.conversation_type = 'onboarding'`)
- `onboarding_progress` JSONB tracks which profile fields have been captured
- After each user message, Sonnet 4.5 extracts structured data and merges into profile
- Yuri's onboarding system prompt guides her to collect all required fields naturally
- Minimum required: skin_type, primary_concerns, fitzpatrick_estimate, climate
- Onboarding complete when all required fields captured (Yuri announces this naturally)
- User can skip ("I'll fill in details later") but gets reminded on next Yuri conversation

**Why Not Both (Form + Conversation)**: The form wizard was the MVP approach. Now that Yuri exists, the conversational path IS the product experience. Offering both dilutes the first impression. A user who fills out a form has a "meh, another app" experience. A user who chats with Yuri has a "wow, this AI gets skincare" experience. The onboarding IS the conversion moment.

### Yuri Landing Page Widget and the sign-up funnel

Moved to `.claude/rules/widget.md`, which loads automatically when you work in the widget, trial, offers or Stripe files. **Read it before any widget or funnel change, and before analysing widget data.** The rules that matter even when it is not loaded: the hero widget is the ONLY anonymous Yuri surface (there is no floating bubble; do not add one); never append per-turn strings to the cached system block; never add copy that says a routine exists before membership; a trial is not a paid conversion; never write a charge sentence without `src/lib/offers.ts`; do NOT change widget memory-honesty Rule #3 without A/B data; the cumulative-give instrument is a fact, never a cap.

### Specialist Agents (Report to Yuri)

| Agent | Role | Examples |
|-------|------|----------|
| **Ingredient Analyst** | Deep ingredient science | "This retinol concentration is risky with your current BHA" |
| **Routine Architect** | Builds personalized routines | "Based on your oily T-zone + dry cheeks, here's your AM/PM routine" |
| **Authenticity Investigator** | Counterfeit detection | "This packaging has 3 red flags -- here's what to check" |
| **Trend Scout** | Tracks emerging Korean trends | "PDRN serums are trending in Seoul -- here's why they matter for your skin type" |
| **Budget Optimizer** | Finds best value | "Same key ingredients as Sulwhasoo for $12 instead of $94" |
| **Sensitivity Guardian** | Allergy/reaction prevention | "WARNING: This contains fragrance that triggered reactions in users with your profile" |

Each specialist has deep domain prompts (200-400 words), extracts intelligence after each conversation, and feeds patterns back to the learning engine.

## Silent Failure: "nothing wrong" vs "nothing checked" (LOAD-BEARING — added v11.18.0, July 30 2026)

**A result that looks clean because the check never ran is the most expensive bug class in this codebase.** v11.18.0 fixed eight defects in one day and every one was this shape. Before shipping anything on a safety, write, or context path, ask: *if this silently did nothing, would it look any different from success?*

- **Destructuring only `data` turns a failed query into an all-clear.** `ss_routine_products.product_id` is NULLABLE (custom steps), and PostgREST rejects a null inside an `.in()` on a uuid column with **22P02**. Three call sites ignored `error`, so the dead query read as an empty result and returned `{ safe: true, conflicts: [] }` — **one custom step disabled ingredient-conflict checking for the whole routine**, catalog products included, across all three of a subscriber's active routines. On any safety path, check `error` and make a failed check LOUD. Filtering nulls on one routine recovered 189 ingredient rows.
- **An AI claiming a write is not a write.** Yuri said *"Locked... all get removed"* without calling `save_routine`. The honesty rule enumerated READ verbs only, so nothing was violated. Write claims ("saved", "locked", "removed", "updated") require a tool that ran THIS turn and returned success; present-tense intent is honest, past-tense completion is a claim. A false write claim is worse than a false read claim — a wrong read is corrected next turn, but a user who believes their data was fixed stops checking it.
- **When the safe-looking action and the correct action diverge, the model picks safe and narrates correct.** Yuri stalled because revising a routine was documented only inside an error string that read as a threat. Fix the framing, not just the wording.
- **A guard test that asserts source text can pass against broken code.** Several did, while authenticated Yuri was down for every user with a product inventory. Where the defect is logic rather than wording, EXECUTE the real function on the shape that failed (transpile it if the module has DB imports at scope — `typescript` is already a dependency), then revert the bug verbatim and confirm the test fails. Also note `tsc` catches what a source-regex test cannot: one new test passed while its file did not compile.
- **Two parallel arrays joined by index is a defect waiting to happen.** Carry data with its rendered line so a desync is unrepresentable. An off-by-length read (`context.userProducts[i]` running off the end) is invisible to every string-matching test.
- **A type that lies hides every bug beneath it.** `RoutineProduct.product_id` was typed `string` while the live column was nullable — which is why all of the above typechecked cleanly. When a null bug appears, check `information_schema` against the TS type before anything else.
- **Sweeping ONE fabricated row does not find the next one.** The July 27 sweep targeted a specific product id; an LED-mask device matched to three unrelated catalog masks survived it untouched. Audit residue by SHAPE — e.g. *a catalog-linked routine step whose product is absent from the owning user's library* — never by product name.
- **Read-side filters do not stop writes.** The INCI pollution guard was applied on read for months while `matchOrCreateIngredient` kept creating junk rows. Guard the write too, and prefer a nullable return over a throw: making it nullable surfaced a second write path (`scripts/fast-link.ts`) that grep had missed.
- **`src/app/sitemap.ts` is a first-class safety surface.** It filtered ingredients on `is_active` and nothing else, publishing 15 unsplit INCI dumps as URLs we were actively asking crawlers to index. Citation is the moat; garbage URLs are the expensive version of a data bug.
- **Do not test against a real user's live account.** A reproduction probe on Bailey's account polluted her Yuri memory and made Yuri open a later answer with *"we started this exact breakdown last time"* — she read it as a scold and abandoned a complete, correct answer. Use a throwaway `ZZ TEMP` routine (`is_active: false`) and delete it.
- **Measure before fixing; three scopes here were wrong until queried.** A `NOT NULL` asserted twice from a code comment was actually nullable. A leak called "frozen since February" was still producing rows in July. A row reported as stale residue had actually been bought by the user. And a length threshold was the wrong instrument for junk INCI — `"Water, Talc"` is 11 characters.
- **Beware the over-correction.** Rejecting any ingredient name containing a comma would have destroyed 979 legitimate rows (`"Niacinamide (50,000ppm)"`); a comma signals a list only when followed by a LETTER and OUTSIDE any parenthetical. A run-together heuristic then flagged 4,898 rows including `"Hexapeptide-9"` and was discarded rather than tuned by feel. When a classifier needs repeated hand-tuning, that is the signal to stop, not to keep adjusting.
- **Read tells you what SHOULD happen; only execution tells you what DOES.** A numbered-product search bug (Aug 17 2026) survived four correct-looking fixes — to tokenization, to coverage, to ranking — because all of them were on code paths that never ran. `search_products` tries strategies in order and RETURNS on the first hit, and Strategy 1.5 was matching `name ILIKE '%no%'` (a substring of every numbuzin product) and returning before anything downstream executed. Four readings of the file did not find it; one `console.error` that failed to print did, in a minute. When a fix that should work doesn't, stop editing and instrument which branch is live.
- **PostgREST treats `.` as a syntax separator inside `.or()`.** An unquoted `name_en.ilike.%no.9 %` is parsed as a malformed filter and **silently returns zero rows** — no error, no warning, indistinguishable from "no such product". Quote the pattern (`name_en.ilike."%no.9 %"`). This is the third distinct way PostgREST has produced a silent empty result in this repo (see also its 1,000-row cap).
- **In a numbered product line, the NUMBER is the entire identity.** numbuzin No.3 (glow) and No.9 (NAD lifting) share brand, category and nearly every word of their names, so every text signal ties and the winner is decided arbitrarily. A search that drops the digit returns a sibling product's ingredients with full confidence — which is worse than returning nothing, because the caller has no way to tell. 471 verified products across 118 brands are exposed to this. Beware the mirror-image over-correction: folding "No.9" into a single token fixes in-memory comparison and BREAKS the SQL fetch, since the catalog stores "No. 9".
- **A revert test is evidence only once you confirm the revert applied.** A guard test "passed" against a reintroduced bug because the substitution silently failed on an apostrophe mismatch — a false green that would have shipped an inadequate guard. Assert that the edit changed the file before trusting what the suite then reports.
- **A tripwire that writes only to logs has NOT closed the loop.** The Olive Young price refresher's own "examined 40 rows, updated 0" check fired correctly for ~130 consecutive nights — to `console.warn`. Nobody reads Vercel logs. The run wrote `status: 'completed'` over total failure the entire time, so 99.4% of price data sat frozen for four months while Yuri quoted it as current. Detection is not the hard part; **making the detection reach a consumer is.** A failing run must write a status a human or an alert can see — here, `status: 'failed'`, which the Guardian's 48h pipeline check already keys on. Ask of any tripwire: *who READS this, and where would I see it tomorrow?*
- **A missing DOM selector returns null without throwing.** Any scraper that reads a value out of rendered HTML fails silently the day the site changes, and a silent null is indistinguishable from a legitimate absence. Prefer the JSON endpoint the page's own JS calls (`POST /product/detail-data` here) — one round trip, no browser, and a shape you can actually assert on. Where a browser is unavoidable, a null must be raised as an error rather than counted as a result.
- **Sample from the population you actually serve.** A first measurement showed "0.0% price change across 20 products" and was completely wrong: it drew from the refresher's own stalest-first queue, which is dominated by obscure products nobody buys. Re-measured on the products Yuri actually recommends, **7 of 8 stored prices were wrong, six by 28-47%**. A sample drawn from a job's internal ordering is not a random sample of what users see.
- **"Unbuyable" is a distinct failure from "stale", and worse.** 27% of the 30 most-reviewed Olive Young products were delisted while we advertised a confident price. Surface it as DATA (`in_stock: false`) rather than prompt prose — Yuri then frames it herself as a fact about the retailer's shelf, with no broken-database smell. Two invariants: a delisted flag must be REVERSIBLE (retailers relist), and a fetch ERROR must never set it (a rate limit would otherwise mark the catalog dead in one run).
- **PostgREST silently caps at 1,000 rows and reports NO error — this has now bitten this repo twice.** It published 2,018 dead sitemap URLs on Aug 4, and on Aug 15 a delisting sweep asked for 5,000 rows, quietly received ~1,000, and printed a confident summary over a fifth of the catalog — **missing one of the two rows it was written to fix.** Paginate with `.range()`, and compare rows fetched against an exact `count` so a partial scan cannot look like a full one. The sweep reported success and the database disagreed; **only checking the specific row the fix was written for surfaced it.**
- **A guard test scoped to the wrong region is worse than no test.** Two written in one session reported green over deleted code — one accidentally policed the email-ask rules, and one asserted on wording ("asymmetric", "post-inflammatory hyperpigmentation") that also appears elsewhere in the same prompt, so gutting the paragraph it guarded still passed. Only reverting the bug found either. Scope every prompt assertion to the rule's own text, and always confirm the test FAILS against the bug it names.
- **Verify the deployment, not the push.** A release sat unshipped after a Vercel webhook silently failed; `git ls-remote` confirmed the commit was on GitHub while no build existed. Check `vercel ls --prod` for a deployment newer than the commit.

## Diagnosing a User Report (LOAD-BEARING — added v11.16.0, July 30 2026)

**A user's words describe what they SEE. That is a symptom, not a diagnosis. Do not instrument the subsystem the words name until you have confirmed what is actually on their screen.**

Earned expensively. Bailey reported *"it logs me out every single time"* on the installed PWA. **Five rounds went at the session layer.** The cause was that the manifest's `start_url` is `/`, and `/` had no auth awareness, so it rendered the "Get Started / Talk to Yuri Free, no signup" marketing page to a paying subscriber on every launch. Her session was healthy the entire time. One screenshot — no browser chrome, logged-out page — broke it open after two days.

- **Get the screenshot first.** It cost five rounds to learn that "logged out" meant "shown the signup page," which is a routing bug two layers away from auth.
- **Check the LIVE surface, not last night's evidence.** An apex-vs-www origin finding was real when measured and stale by the time it was applied to her; a single `referer` query retired it. Twice I told Scott she needed to delete and re-add her icon. Her requests all carried `referer: https://www.seoulsister.com/` — she was already on the right origin, and one query would have shown that.
- **Ask what the DATA would look like under each hypothesis, then go look.** Sessions being *deleted* (rows vanishing) and sessions *accumulating* (rows piling up, never refreshed) are opposite fingerprints. Storage eviction is silent server-side and cannot produce a `POST /logout`. `paywall_reached_at` being NULL falsified a competing theory in one query.
- **Distrust a cause you cannot falsify.** "iOS is evicting her storage" is unprovable from a web page, which is exactly why it survived a round it should not have — and its central premise (that an explicit cookie `Max-Age` escapes Safari's 7-day cap) was **factually false**. Per WebKit ITP 2.1, `document.cookie` cookies are capped to 7 days; only HTTP `Set-Cookie` is exempt. **Verify external platform behaviour at the primary source; never recall it.**
- **A guard test that asserts source text can pass against the broken code.** Round 1's did exactly that. Execute the real code path, and prove each test **fails** when its bug is reintroduced by reverting the real code verbatim.
- **A fix that does not reach the affected user has not shipped.** `/_next/static/` is cache-first, so bump `CACHE_NAME` in `public/sw.js`. Then verify the fix is in the **served bundle** — this repo has shipped a "fix" that never reached the live chunks.
- **Shipping the guard does not retroactively clean what the bug already wrote.** When a validation/resolver fix lands, SWEEP for the rows it would now refuse. Bailey asked Yuri to save a routine step literally named *"Shower / cleanse"*; the loose resolver matched it to a real cleanser and wrote that `product_id` into her routine. Yuri warned her at save time — *"5 steps matched loosely"* — but **the warning was transient prose and the bad row was permanent**, so seven weeks later Yuri read her own routine back and planned a week around a product she has never owned. The identity floor that prevents this shipped ~7 weeks after the rows existed, and nothing swept them. Pattern to reuse: `scripts/fix-fabricated-routine-matches.ts` (blast-radius scan first, dry-run default, `--apply` to write, every update guarded on the row still holding the bad value so re-running is a no-op).

Related: `signOut()` in supabase-js defaults to `scope: 'global'`, which deletes every `auth.sessions` row for the user on **all** devices. Every call site must pass `{ scope: 'local' }`; a tree-wide guard test enforces it (`tests/signout-scope-local.test.mjs`). Two people testing the same account will otherwise log each other out, which is what made "works on my iPhone, breaks on hers" look like a per-device cause.

## Clinical Data Honesty (LOAD-BEARING — added v11.10.0, July 21 2026)

**Never default a clinical field. Never store a medical fact as an allergy.** Both rules were earned from real defects found in production.

**1. Unknown must render as unknown.** `finalizeOnboardingProfile` used to write `fitzpatrick_scale: extracted || 3`, `age_range || '25-30'`, `climate || 'temperate'`, and `memory.ts` printed them to Yuri as bare fact — a guessed Fitzpatrick III was indistinguishable from a stated one. A live user (`69f19b14`) was receiving advice against a skin type they never gave. Fitzpatrick drives retinoid strength, acid aggressiveness, PIH risk in deeper tones, and skin-cancer caution in fair ones, so a wrong guess is a clinically wrong answer delivered confidently — the v10.2.1 fake-confidence class with medical consequences.
- Clinical fields (`fitzpatrick_scale`, `age_range`, `climate`, `medical_history`, `sun_history`) are written ONLY when actually extracted. Unknown stays `NULL`.
- `fitzpatrick_source` (`'stated' | 'estimated' | NULL`) records provenance. Yuri sees `NOT ESTABLISHED — do not guess or state one` and asks instead.
- Preference fields (budget, experience level) may keep defaults — a wrong budget guess costs nothing.
- **`ss_onboarding_progress.skin_profile_data` is the provenance record of truth** — it stores what the extractor actually pulled. Join it before concluding whether a profile value was stated or defaulted.

**2. Allergies EXCLUDE an ingredient. Medical history REFRAMES the approach.** A subscriber's skin cancer history was stored in `allergies` because no other column existed; `memory.ts` injects allergies under "ALWAYS check for these before recommending any product," so Yuri read a cancer history as a contact allergen — something not to apply — instead of the standing fact that should make sun protection the treatment, add photosensitizer caution, and lower the referral threshold. `medical_history` now has its own context block explicitly framed *"these REFRAME your advice, they are not allergens."* Never conflate the two.

**3. Lesions are always a referral.** Before v11.10.0 the words *mole*, *lesion*, and *melanoma* appeared NOWHERE in any Yuri prompt; the referral rule named only "pain, spreading rashes, suspected infections." A changing, growing, asymmetric, bleeding, crusting, or new-and-unresolving spot is dermatologist territory on BOTH surfaces — said early, never answered with a product or a reassurance.

**4. Reason from population patterns, stay calibrated.** Ancestry, age, climate, sun history, and cycle phase are real clinical inputs and Yuri should use them directly without hedging. Two disciplines keep that rigorous: state confidence matching the evidence (a base rate is a starting point, not a verdict), and let the individual override the pattern. *"Melasma is more common with your background, so I'd protect pigment before I exfoliate"* is medicine; *"you're Korean so your skin is X"* is a stereotype in a lab coat.

## Shelf Visibility & the Western Shelf (LOAD-BEARING — v11.15.0, July 29 2026)

**Acquisition is Korean. Retention is the whole shelf.** Every public and acquisition surface stays 100% Korean — the catalog, `/best`, `/ingredients`, the blog, positioning. The 525 Bing citations/week exist *because* we are the one structured English source on Korean products. But once someone pays, Yuri's safety duty extends to every product they actually own, delivered by **private per-user data that is never indexed and never a catalog row**.

**The defect that earned this rule.** `ss_ingredient_conflicts` holds a HIGH-severity Retinol + Glycolic Acid rule. A subscriber running exactly that on a post-Accutane barrier got `{ safe: true, conflicts: [] }` — because both products were custom entries and `checkRoutineConflicts` joins `ss_product_ingredients` by `product_id`. **A clean result on a product whose ingredients are blank means nothing was checked, not that nothing is wrong.**

- **`check_ingredient_conflicts` accepts a raw `ingredient_names` array** with no catalog resolution (`tools.ts`). That is the ONLY custom-product-capable conflict path. `conflict-detector.ts` is catalog-only by construction (`ss_routine_products.product_id` is `NOT NULL REFERENCES ss_products(id)`) — don't rewrite it; use the tool path, which is where the safety judgment actually happens.
- **INCI on a custom entry requires provenance** (`ingredients_source`: `label_scan` | `web_lookup`, DB-enforced paired + enum). Same discipline as `fitzpatrick_source`: a value whose origin we can't name isn't a fact.
- **The variant trap is real.** Searching "Byoma toner" returns Brightening / Milky / Balancing — different actives. A near-miss INCI makes a safety check *look* done. Only record a list when the product name matches; otherwise ask for the label photo (the BACK of the bottle — a front-of-bottle photo has no INCI, which is how one subscriber's moisturizer stayed invisible).
- **Yuri sees her own coverage as a FACT, never a cap.** The visibility block blocks nothing and ends by handing the decision back. A guard test fails if it becomes a command — the widget give/gate failed twice by rewording a rule before v11.10.0 fixed it with a fact.

**Do NOT build a Western catalog.** Measured: cold widget traffic runs **~15:1 Korean-intent** (45 vs 3 across 226 messages / 54 visitors). Western ingredient lookup is free at INCI Decoder, SkinSort, Yuka. Two agents assigned opposite positions both converged here. **If a broader channel opens (Bailey's TikTok audience is not r/AsianBeauty), re-run that query before treating 15:1 as permanent.**

**Yuri may say "keep what you have."** CeraVe, Cetaphil, La Roche-Posay, Vanicream, Byoma, Naturium and Prequel are genuinely good (Cetaphil was reformulated — older criticism is stale). A Korean alternative is offered *only where it genuinely wins for THIS person*. A recommender that must always find a Korean swap is the algorithmic surface the Yuri Sole Authority Principle exists to prevent.

**The sunscreen exception (verified at Consumer Reports, Jul 10 2026).** Korean-brand sunscreens sold in US stores are **REFORMULATED** with FDA-approved filters and test substantially weaker than the Korean-market version: Beauty of Joseon SPF **36 vs 19**, Innisfree **48 vs 16**, Round Lab **46 vs 16**. "Buy it at Target" does NOT deliver the advantage. Three calibrations keep this honest: the documented advantage is **protection, not texture** (that panel found them greasy, white-casting, not lightweight — do not claim cosmetic elegance); the finding is **relative** (even Korean formulas came in under their SPF 50+ labels); and the gap is **narrowing** (FDA approved bemotrizinol June 2026, first new filter since 1999).

**Claims that must never be repeated:** the "KTRI 2022 / 68% of COSRX sunscreen failed SPF" statistic traces only to Alibaba-hosted SEO content — no primary source. Amazon **ended commingled inventory March 2026**, so that mechanism is stale. Counterfeit evidence is **failed protection** (a tested SPF 3.6 vs a claimed 45), never documented injury — there is none.

**Custom entries are not all "products we don't carry."** ~40% are devices and routine steps (ice roller, LED mask, "Shower / cleanse") that correctly have no catalog row. Any "invisible shelf" metric that counts them is lying to you. See `PHASE-2-RESULTS.md` for the decomposition.

**The resolver's all-terms strictness is correct.** A user-typed extra term ("Rice 70 **+ Ceramide** Glow Milky Toner" vs the catalog's "Rice 70 Glow Milky Toner") failing to match is the same conservatism that stops "Hero Mighty Patches" binding to Dr.ppae Honey Heel Patch. Do not loosen it.

## Location Capture — text is not coordinates (v11.14.0, July 29 2026)

**A stated location must be resolved to coordinates, and a coordinate you cannot verify must not be stored.**

Onboarding captured `location_text` and stopped. `latitude`/`longitude` were written by exactly one path — the browser-geolocation button on `/profile` — so both newest paying subscribers had a location on file and no coordinates, `get_current_weather` returned "Could not determine location," and every UV/humidity surface was dark. Yuri had told one of them that her city's humidity swing was half of why her skin seesaws, while unable to read the weather there.

- **One geocoder, shared.** `src/lib/geo/geocode.ts` is the single implementation, called by both `finalizeOnboardingProfile` and the `get_current_weather` tool. Two geocoders eventually disagree about where a user lives, and the profile row is what every weather surface reads. Do not add a second.
- **Verify, don't trust the top hit.** Query the first comma-segment, then check the result against the user's own qualifiers. The whole-string query returns NOTHING for "Seoul, Korea" and "London, UK" — the exact formats our extraction prompt asks Yuri to produce — and returns *Ness City, Kansas* for "Iowa".
- **Null beats a guess.** Wrong coordinates degrade INVISIBLY (Yuri confidently reads another state's weather); missing coordinates degrade visibly (Yuri asks). A bare region name is accepted only when the candidate actually sits in a region of that name. "Canada" alone stays unresolved on purpose.
- **Never downgrade precision.** Finalize can run more than once; a city centroid must never overwrite device-level coordinates from the `/profile` button (`IS NULL` guard).
- **Geocoding never gates onboarding.** It is best-effort, wrapped, and logged on failure — a slow API must not block a user from finishing.

`first_name` follows the same honesty posture: captured only when volunteered, **never inferred from an email address**, and injected as a fact with judgment guidance ("use it the way you'd use a friend's name") rather than a template slot — absent entirely when unknown.

## Yuri Sole Authority Principle (LOAD-BEARING ARCHITECTURE)

**This principle was earned through real lighthouse-user feedback. Read it before designing any feature that surfaces "what the user should do" with their skin.**

> **No non-Yuri surface in Seoul Sister generates personalized recommendations for the user. Every other surface is either (a) data display, (b) navigation, or (c) a Yuri-conversation entry point. Recommendation logic — what the user should DO with their skin — lives exclusively with Yuri because she has the full context (treatment phase, decision memory, corrections, routine, allergies, climate, cycle).**

### Why this principle exists

Bailey, Seoul Sister's lighthouse user and Scott's daughter, taught us this principle across five separate corrections:

1. **May 17 2026 (v10.5.2)**: Routine Intelligence widget recommended Arginine + Candelilla Wax + Stearalkonium Hectorite as "missing high-value ingredients" for combination skin. She screenshotted it to Yuri who diagnosed all three as garbage (pH buffer, thickener, clay viscosity agent). Bailey: *"I think we just get rid of the 'recommended' part all together. Whatever's recommended Yuri does it."* — Widget removed.

2. **May 17 2026 (same release)**: `ss_ingredient_effectiveness` bootstrap data scored fillers (water, glycols, waxes) as effective actors because the seed script measured frequency, not mechanism. 87 rows deleted. Yuri-mediated recommendations would have caught this; the algorithmic widget didn't.

3. **May 18 2026 (v10.6.2)**: Weather widget on dashboard recommended "Switch to a lighter gel moisturizer," "Skip face oils today," "Apply niacinamide toner to your T-zone" based on `humidity > 70%` + `skin_type = combination` lookup table. Zero awareness of Bailey's Phase 2 protocol (COSRX BHA on MWF, Goodal Vita C in AM, barrier-protective Illiyoon at night) or her current corrections. Bailey: *"Are they recommended by Yuri or generic based on location alone. I think all recommendations should be from Yuri at this point. Would just get confusing and would be misleading if not communicating with Yuri."*

4. **May 20 2026 (v10.7.1)**: Glass Skin Score Recommendations panel rendered PHA toner + niacinamide serum + vitamin C ampoule + humectant essence as standard advice for Bailey, who was on Day 23 of Phase 2 with COSRX BHA already 3x/week, niacinamide already in 5 products, vitamin C already on board via Goodal, and glycolic explicitly rejected from a past Yuri conversation. Yuri herself tore the panel apart point-by-point in chat (*"That's acid 6-7 days a week on cheeks we just rebuilt in Phase 1. Hard no."*). Bailey: *"This kinda stuff that's not Yuri I think we need to get rid of."* — Recommendations panel killed on both main results surface and historic-history accordion. Replaced with single Ask-Yuri CTA. (v10.6.2 had explicitly deferred this fix; Bailey caught what was punted.)

5. **May 20 2026 (v10.7.1 proactive sweep)**: Dashboard "Yuri's Insights" widget rendered algorithmic product recommendations from `/api/learning/recommendations` under a heading that literally said "Yuri's Insights" with a Lightbulb icon. Pure `ss_product_effectiveness` skin-type sort, no Yuri reasoning. Empty state copy actively claimed Yuri authorship: *"Yuri is learning."* Found and killed in a proactive sweep BEFORE Bailey reached it. Widget file deleted, section removed from dashboard.

6. **May 26 2026 (v10.8.9)**: "Routine Intelligence" widget on the routine page rendered a seasonal "SPRING TIP" — *"Switch to lightweight gel or water-based formulas... Emphasize: Niacinamide for sebum control, Green tea extract for antioxidants, Hyaluronic acid in lightweight serums"* — keyed only on `season + climate` via a `ss_learning_patterns` lookup, zero phase awareness. Bailey, on Phase 2 with niacinamide already in 5 products and Yuri on a "stay the course" protocol, screenshotted it: *"We were going to get rid of the tips cause it's not Yuri and she always disagrees."* The same prescription also lived on the dashboard as a "Spring Skincare Tip" with `+ niacinamide` emphasize chips. **Both survived the v10.5.2 kill (which only removed the missing-ingredients widget from the same component) and the v10.6.2 kill (which removed the weather widget's prescriptions but didn't sweep for the season-based variant elsewhere).** Killed the seasonal-tip blocks on both surfaces; kept the observational data (concern effectiveness bars, "Your Top Ingredients" list). The lesson: when killing one algorithmic recommender, grep the whole codebase for the data source it pulls from (`fetchSeasonalLearning`, `texture_advice`, `ingredients_to_emphasize`) — the same prescription often renders in more than one place, and a partial kill leaves the survivor for Bailey to find.

7. **May 26 2026 (v10.8.16, found PROACTIVELY — first one Bailey did NOT have to catch)**: a systematic sweep of Bailey's surfaces found the v10.8.9 seasonal recommender STILL LIVE on two surfaces the v10.8.9/v10.8.10 sweeps missed — Scan results (`ScanResults.tsx`) and Product Detail enrichment (`ProductEnrichment.tsx`), both rendering the `SeasonalContext` component (`EnrichmentSections.tsx`) fed by `fetchSeasonalContext()` in `enrich-scan.ts` — the exact same phase-blind `season + climate` → `ss_learning_patterns` lookup producing "switch to lightweight gel" + "Consider reducing this season" ingredient chips. The v10.8.9 changelog had even written the grep-the-whole-tree lesson, but the prescription's render path on these two surfaces used a DIFFERENT component (`SeasonalContext`) and a DIFFERENT fetcher (`fetchSeasonalContext` in enrich-scan, not `fetchSeasonalLearning`), so a name-based grep missed it. Removed the component + both render sites + the fetcher + the type. This is the seventh instance and the FIRST caught before Bailey saw it — the proactive sweep working as intended.

Each instance is the same structural failure: a non-Yuri surface generates recommendations using an algorithm that doesn't know what Yuri knows. Bailey trusts Yuri. She doesn't trust the algorithm. And she's right — Yuri has 17+ conversations of context on her, the phase she's in, the corrections she's made; the algorithm has skin type and a humidity reading.

**Proactive sweep discipline** (added v10.7.1, sharpened v10.8.9, validated v10.8.16): Each release that touches recommendation surfaces should include a sweep step — search the codebase for headings containing "Yuri's", lists labeled "Recommendations" / "Tips" / "Suggested", and any rule engine of the shape `if skin_type X && condition Y then "use Z"`. The seven incidents above prove that algorithmic recommenders sneak in at the seam between "this feels personalized" and "this is actually personalized." **And they cluster: the same prescription data source often feeds multiple surfaces, so killing one is not enough.** v10.8.16's lesson sharpens this further: a NAME-based grep is insufficient because the same prescription can render through differently-named components/fetchers (`SeasonalContext` + `fetchSeasonalContext` vs `fetchSeasonalLearning` + `texture_advice`). Grep by the underlying DATA SOURCE (`ss_learning_patterns` + `pattern_type='seasonal'`, `ingredients_to_emphasize`, `ingredients_to_reduce`, `texture_advice`) AND by prescriptive UI language ("switch to", "consider reducing", "emphasize", "good for this season"). The most reliable sweep is a periodic proactive pass across the actual user surfaces (Library, Routine, Dashboard, Scan, Product Detail, Glass Skin, Sunscreen, Trending) — v10.8.16 did exactly this and caught #7 before Bailey. Find them before Bailey does.

### How to apply this principle when building a new feature

Before shipping a surface that recommends anything, ask:

| Test | Pass | Fail |
|------|------|------|
| Does this surface tell the user what to DO? | Route through Yuri | Don't render the recommendation; route through Yuri |
| Does this surface label algorithmic output as "Yuri's" or imply Yuri authorship? | Rename honestly ("Best for [skin_type] skin") | Rename now |
| Does this surface display data (weather, prices, trends, scores)? | Ship — that's fine | Not applicable |
| Does this surface offer a CTA into Yuri with context prefilled? | Ship — that's the pattern | Not applicable |

### Acceptable surface patterns

- **Data display**: Weather conditions (26°C, 83% humidity, UV 2.1). Glass Skin Score numerical values. Trend rankings. Price comparisons.
- **Honest discovery**: Product browse sorted by ingredient effectiveness for skin type — labeled as "best matches for your skin type," NOT "Yuri's picks." Sunscreen filters that auto-populate from profile. Dupe finder showing ingredient overlap.
- **Yuri-conversation entry points**: "Ask Yuri how this weather affects your Phase 2 routine →" with `?ask=` prefill. CTAs that route to /yuri with context, never standalone recommendations.

### Unacceptable patterns (anti-patterns)

- ❌ Hardcoded `if humidity > 70% then "use BHA"` rule engines presented as recommendations
- ❌ Static recommendation lists pulled from a JSON lookup table
- ❌ Any UI element labeled "Yuri's [thing]" when Yuri's reasoning isn't actually involved
- ❌ Cycle phase / weather / Glass Skin output that says "do X" without phase-awareness and decision_memory awareness
- ❌ Bootstrap data shipped into `ss_ingredient_effectiveness` or `ss_learning_patterns` without expert validation — even one bad row poisons Yuri's effectiveness reads

### The interlock with vibetrendai/principles.md

This principle is the Seoul Sister specialization of **Principle 2 — AI-First Reasoning** from `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/principles.md`. The global principle says "trust model intelligence, give models freedom and context, not rigid templates and brittle rules." The Seoul Sister specialization says "in this app specifically, the model is Yuri, and EVERY recommendation surface routes through her — not parallel rule engines."

### For future AI sessions

If you're opening this repo and you see a recommendation surface that doesn't go through Yuri, that's tech debt — flag it. If you're adding a new feature, default to "Yuri makes the recommendations; this page just surfaces the data or offers a CTA." If you find yourself writing `const ADJUSTMENT_RULES: ...` or `if skin_type === 'oily' && humidity > 70 then "use BHA"`, stop and ask whether Yuri should be doing this instead.

## Technical Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| AI Model (Chat) | Claude Opus 5.5, effort `low` | The three Yuri conversations: widget, authenticated advisor, onboarding (`MODELS.chat`). Refusal falls back once to Opus 4.8 |
| AI Model (Primary) | Claude Opus 4.8 | One-shot user-facing analysis: scanning, skin score, dupes, routine generation, lead email, nudges, SEO guardian (`MODELS.primary`) |
| AI Model (Background) | Claude Sonnet 5.5, adaptive thinking at effort `low` | Data extraction, memory summaries, learning aggregation, pipeline (`MODELS.background`; kill switch `AI_BACKGROUND_MODEL`) |
| AI Model (Vision) | Claude Opus 4.8 | Label scanning, counterfeit detection, skin analysis |
| Framework | Next.js 15 (App Router) | PWA-configured, TypeScript strict |
| Database | Supabase PostgreSQL | RLS, real-time subscriptions |
| Styling | Tailwind CSS 4 | Korean-inspired design system |
| Auth | Supabase Auth | Email + social login |
| Payments | Stripe | Subscriptions only (no product commerce) |
| Hosting | Vercel | Edge functions, automatic SSL |
| Distribution | PWA | No App Store dependency, Stripe at 2.9% vs Apple 30% |
| Analytics | Google Analytics 4 | Measurement ID: G-L3VXSLT781 |
| Analytics | Vercel Analytics | Automatic page views + Web Vitals |
| Analytics | Vercel SpeedInsights | Core Web Vitals monitoring (LCP, FID, CLS) |

### PWA Architecture (Critical Decision)

Seoul Sister is a **Progressive Web App**, not a native iOS/Android app.

**Why PWA over App Store:**
- Apple takes 30% of subscriptions ($3.00/user/month at $9.99). Stripe takes 2.9% + $0.30 ($0.59). Difference: $2.41/user/month.
- At 5,000 subscribers that difference is about $144,600 a year (2.41 x 5,000 x 12)
- PWA has full camera access (for scanning), push notifications (iOS 16.4+), home screen install, offline caching
- Instant deployment -- no 1-7 day App Store review delays
- Users discover skincare apps via TikTok/Instagram, not App Store browsing

**PWA Requirements:**
- `manifest.json` with app icons, theme color, display: standalone
- Service worker for offline caching of product database
- "Add to Home Screen" prompt after 2nd visit
- Full-screen mode (no browser chrome)
- Camera API access for label scanning

## Core Architecture

### Database Tables (prefixed `ss_`)

All tables use Row Level Security (RLS) for user isolation.

#### Products & Ingredients
```
ss_products                 - K-beauty product database (target: 10,000+)
ss_product_ingredients      - Ingredient breakdown per product (ordered)
ss_ingredients              - Master ingredient database with Korean translations
ss_ingredient_conflicts     - Known ingredient interaction warnings
ss_product_prices           - Price tracking across retailers (historical)
ss_retailers                - Retailer directory with trust scores
ss_counterfeit_markers      - Known counterfeit indicators per brand
ss_counterfeit_reports      - User-submitted counterfeit reports
```

#### Users & Profiles
```
ss_user_profiles            - Extended skin profile (first_name, type, concerns, allergies, climate, location_text + latitude/longitude/timezone, medical_history, sun_history, fitzpatrick_scale + fitzpatrick_source)
                              NOTE: surrogate `id` PK + separate `user_id` FK. ALWAYS join on user_id — a Jul 29 audit
                              joined on `id` and wrongly concluded all 37 users were missing profiles.
ss_user_routines            - Personalized routines (AM/PM, skin cycling schedule)
ss_routine_products         - Products in each routine (ordered, with timing/frequency)
ss_user_scans               - Scan history (label scans, product lookups)
ss_user_wishlists           - Wishlist with price alert preferences
ss_user_product_reactions   - "This broke me out" / "Holy grail" tracking
```

#### Community & Reviews
```
ss_reviews                  - Community reviews with skin-type metadata
ss_review_helpfulness       - Upvote/downvote tracking
ss_trending_products        - Trend detection (TikTok, Reddit, Korean market)
```

#### Yuri AI System
```
ss_yuri_conversations       - AI advisor conversations (type: onboarding, general, specialist)
ss_yuri_messages            - Individual messages (with image_urls for vision)
ss_specialist_insights      - Intelligence extracted from specialist conversations
ss_onboarding_progress      - Tracks which profile fields Yuri has captured during onboarding
ss_widget_conversations     - Anonymous pre-signup landing page widget conversations (legacy — replaced by Phase 14 tables)
ss_widget_visitors          - Persistent anonymous visitor identity with AI memory, lifetime stats, captured lead email + recap send/delivery status (recap_status: sent|delivered|bounced|... — see LEAD-EMAIL-OBSERVABILITY.md)
ss_widget_sessions          - Per-conversation session tracking (specialist domains, intent signals, message counts)
ss_widget_messages          - Full message storage with tool call JSONB logging
ss_widget_intent_signals    - Consumer intent signal detection (15 signals across 4 categories)
```

#### Intelligence & Learning
```
ss_learning_patterns        - Cross-user learning (anonymized)
ss_ingredient_effectiveness - Ingredient effectiveness by skin type (learned)
ss_product_effectiveness    - Product ratings aggregated by skin profile
ss_trend_signals            - Korean market trend detection data
ss_content_posts            - Blog/trend content for AI discoverability
```

#### Commerce (Subscriptions Only)
```
ss_subscriptions            - Stripe subscription records
ss_affiliate_clicks         - Affiliate link tracking (no product sales)
```

## Cron Jobs

The full cron table (schedules, what each job writes, failure semantics, where-to-buy and price-freshness rules) moved to `.claude/rules/cron.md`, which loads automatically when you work in `src/app/api/cron/`, `src/lib/pipeline/`, `src/lib/seo/`, `src/lib/guardian/`, `src/lib/pricing/` or `vercel.json`. Read it before diagnosing any pipeline, price or scheduled-job question. Schedules themselves are in `vercel.json`. Standing rules: a run that does nothing must write `failed`, not `completed`; `ss_yuri_conversations.updated_at` means last ACTIVITY (add any new bookkeeping column to its trigger list); only a US-shipping recommended store's price is "the price".

## Pricing Model

### One plan: Seoul Sister Pro, $9.99/month (since Oct 30 2026)

The single source of truth is **`src/lib/pricing.ts`** (`PRICING`, `USAGE_CAPS`). Never hardcode a dollar amount or an allowance; every UI, prompt and email string derives from it, and every sentence that states a charge goes through `src/lib/offers.ts`. Changing the price is an edit there PLUS a new Stripe Price and the `STRIPE_PRICE_MONTHLY` env var (display price and charged price must not drift). LGAAS mirrors the price automatically through `GET /api/lgaas/pricing`.

- **Price:** $9.99/month, one plan. Plan key `monthly`.
- **Free week:** a first-time member's first 7 days are free and need no card (`trial_requires_card: false`, rules in `src/lib/trial.ts`, ledger `ss_trial_starts`). Nothing is charged unless they add a card; with no card the membership stops on day 7.
- **Monthly allowance:** 80 Yuri messages and 30 label scans per calendar month (UTC). It is stated in the Terms, told to Yuri (who gives it when asked), and shown in the member chat once 80% of the month is used. It is NOT on the pricing card or the membership page (owner decision, Nov 11 2026): the one month that came near it was the co-owner testing, and real member-months have a median of 8 messages. If real members start reaching it, put it back at the point of sale.
- **Creator codes:** a percentage off the first paid month (e.g. BAILEY, 50%). Wording and rules in `src/lib/offers.ts`.
- **Legacy plan key `pro_monthly`:** comped and grandfathered accounts from the earlier price. Not sold. Do not quote its price anywhere.

Seoul Sister is a paid membership. **Since v11.60.0 (Nov 13 2026) talking to Yuri starts with a free account: the anonymous landing chat is closed.** One setting reopens it (`NEXT_PUBLIC_LANDING_CHAT=open`, then redeploy; `src/lib/landing-chat.ts`). **Read `LANDING-CHAT-GATE.md` (repo root) before reopening it, grading it, or changing any sentence about how to reach Yuri:** it holds the reasons, the pass/fail line, the query that counts gate sign-ups, and the manual steps the switch cannot reach. When open, visitors get 12 lifetime preview messages with Yuri in the landing page hero widget (email asked after 6).

**Yuri is the single orchestrating star.** The standalone feature pages (Scan, Sunscreen, Glass Skin, Shelf Scan, Dupes) are demoted from front-door nav to surfaces Yuri drives: usage data showed essentially everyone lives in Yuri chat. The Sunscreen Finder and Dupe Finder are **Yuri tools** (`find_sunscreen_match`, `find_product_dupes`) backed by shared cores in `src/lib/intelligence/{sunscreen-finder,dupe-finder}.ts` (the API routes call the same cores). They return DATA; Yuri owns the recommendation (Yuri Sole Authority). The nav (`Header.tsx`/`BottomNav.tsx`) leads with Yuri; the demoted pages live under a "More" menu.

**Path to membership** (current, see `.claude/rules/widget.md`): the landing page shows Yuri and a sign-up button (while the chat is open: a free chat giving the diagnosis and the one change) → free account → free setup chat with Yuri (capped at 50 user messages) → the 7-day free week, no card → the complete routine is built in the first member chat → add a card to continue at $9.99/month. AppShell gates paid surfaces behind `plan != 'free'`; `/api/yuri/chat` checks `hasActiveSubscription` server-side.

**What members get**: Yuri with all six specialist modes and her database tools, memory across sessions, the routine builder with conflict detection, label scanning, counterfeit checks, price comparison, Glass Skin Score tracking, weather- and cycle-aware guidance, and weekly check-ins.

**What anonymous visitors get while the landing chat is OPEN** (it is closed by default since v11.60.0; closed, they get the public catalog, ingredient pages, blog and a sign-up button):
- 12 lifetime preview messages with Yuri (per-visitor UUID + 40/IP/30-day backstop; email required after 6)
- 6 database tools (search products, compare prices, trending, weather, ingredient guide, counterfeit markers)
- The diagnosis and the one change; the complete routine is built after membership starts
- No account required

### Unit Economics (at $9.99)
Measured cost after the v11.46.0 cache fix (source: the comment block in `src/lib/pricing.ts`): about $0.23 to open a conversation and $0.02 to $0.03 per follow-up message, so a typical member costs a few dollars a month and a member who uses the whole 80-message allowance roughly breaks even. Stripe takes 2.9% + $0.30, which is $0.59 of each $9.99. Earlier cost figures in CHANGELOG entries before October 2026 were measured while token logging was broken and are wrong by more than 10x; do not reuse them.

### Secondary Revenue: Affiliate Commissions
- 5-15% on purchases through affiliate links to Olive Young, Soko Glam, YesStyle, Amazon
- Average K-beauty order: $30-60
- Expected: $0.50-2.00/user/month supplemental
- This is bonus revenue, not the business model

## AI Model Usage

Detail (per-model rules for Opus 5.5 / Opus 4.8 / Sonnet 5.5, the request layout for chat surfaces, cache breakpoints) moved to `.claude/rules/ai-models.md`, which loads automatically when you work in `src/lib/anthropic.ts`, `src/lib/llm-request.ts`, the Yuri/widget libs and API routes. Read it before touching any model call. Standing rules: model IDs live in `src/lib/anthropic.ts` (`MODELS`), never hardcode one at a call site; never reintroduce `tool_choice` on a chat surface (400 on Opus 5.5); per-turn context goes in a trailing system message, never in the cached system block; pass tool-loop content back unchanged; read output via the first text block, never `content[0]`; size `max_tokens` from measurement.

## Development Guidelines

### Core Rules
1. Always look for existing code to iterate on instead of creating new code
2. Prefer simple solutions (but never sacrifice best practices)
3. Avoid duplication -- check for similar code elsewhere first
4. TypeScript strict mode everywhere -- no `any` types
5. Only make changes that are requested or clearly related to the task
6. Keep files under 200-300 lines -- refactor at that point
7. Never mock data for dev or prod -- only for tests
8. Never overwrite .env files without asking first
9. Always implement proper error handling and logging
10. Handle loading, error, and empty states for all data fetching

### Database Conventions
- All tables prefixed with `ss_`
- Use JSONB for flexible data
- Enable RLS on all user-specific tables
- Use `user_id` foreign key for user isolation
- Proper indexes on all foreign keys and commonly queried columns
- Never create duplicate data models for the same concept

## Security Requirements

### Authentication & Authorization
- Supabase Auth with JWT tokens
- RLS on all user-data tables
- Service role key for server-side operations only
- Never expose service role key to frontend

### Data Protection
- Learning data completely anonymized (no PII in patterns)
- Rate limiting on all endpoints
- Input validation and sanitization via Zod
- XSS protection via Next.js defaults + CSP headers
- CORS properly configured

## AI Discoverability (From LGAAS)

Seoul Sister must rank when someone asks ChatGPT/Perplexity: "What's the best Korean moisturizer for oily skin?"

- JSON-LD @graph on all product pages (Product, AggregateRating, FAQPage, BreadcrumbList)
- Article schema on all trend content
- SpeakableSpecification for voice assistant citation
- Dynamic robots.txt allowing GPTBot, Claude-Web, PerplexityBot
- Dynamic sitemap.xml for all product, ingredient, best-of, and content pages (~14K URLs)
- llms.txt with product database summary, best-of category links, ingredient encyclopedia links
- Blog pipeline auto-generates K-beauty trend content from data (`generate-content` cron, daily 10 AM UTC)
- **Ingredient Encyclopedia** (`/ingredients`, `/ingredients/[slug]`): 8,200+ active ingredient pages with JSON-LD (Article, FAQPage, BreadcrumbList), effectiveness by skin type, known interactions, products containing each ingredient
- **Best-of Category Pages** (`/best`, `/best/[category]`): 12 category landing pages with JSON-LD (CollectionPage, ItemList with top 20 products, FAQPage, BreadcrumbList), targeting "best Korean [category]" queries

## Development Phases

Phases 1 through 14 are all shipped. Open work and the May 5 2026 database and pipeline audit moved to `KNOWN-ISSUES.md` (section "Remaining work and pipeline audit, moved from CLAUDE.md"). Product image state is in `PRODUCT-IMAGE-HEALTH.md`.

## Phase Build Specifications (8–15) — Archived

The detailed step-by-step build specifications for Phases 8 through 15 (Value Enrichment, Automated Product Pipeline, Real-Time Trend Intelligence, Yuri Intelligence Upgrades, Platform-Wide Intelligence, AI Conversation Engine Hardening, Widget Conversation Intelligence, LGAAS Memory Architecture Port) have been moved to **`PHASES-ARCHIVE.md`** (repo root) to keep this file focused on current architecture. **All those features shipped** — the `## Development Phases` checklist above is the current-state summary. Read `PHASES-ARCHIVE.md` when you need the original implementation detail for one of those features (exact files, schemas, prompts, rationale). Dated version history is in `CHANGELOG.md`.

---


## Competitive Landscape

### Why Seoul Sister Wins

| Gap | Current State | Seoul Sister Solution |
|-----|--------------|----------------------|
| Hwahae is display-only in English | **Hwahae Global launched an English site Nov 12 2024** (8.8M LLM-translated reviews, ~360K products, category rankings) and passed **100K+ MAU within two months, ~80% United States**. The "no English equivalent exists" premise this project was founded on is STALE — do not repeat it. What is still true: it is a **ranking-and-review display surface**, free, with no conversational advisor, no memory of you, and no one to tell you your barrier is stripped | Advice, not display: an advisor that knows your shelf, your history and what burned you |
| $362M counterfeit losses | Fragmented per-brand apps | Unified AI counterfeit detection |
| Ingredient conflict anxiety | Generic tools (INCI Decoder) | K-beauty-specific AI routine builder |
| Price markup opacity | No K-beauty price comparison | Cross-platform Korea vs US pricing |
| Discovery fatigue | TikTok, influencers (unstructured) | Skin-type-matched discovery with real reviews |
| Routine overwhelm | No personalized K-beauty routines | AI routine builder with conflict detection |

### Defensible Moat
1. **Data depth**: 10,000+ translated products with ingredient analysis -- hard to replicate
2. **Language moat**: Beauty-domain-specific Korean translation, not generic Google Translate
3. **Authenticity signals**: Crowdsourced counterfeit intelligence grows with every user
4. **Learning engine**: Cross-user skin effectiveness data improves every recommendation
5. **Community**: Structured reviews with skin-type filtering -- Reddit r/AsianBeauty with a product database
6. **AI discoverability**: First to rank for K-beauty queries in ChatGPT/Perplexity

## Relationship to LGAAS

Seoul Sister is a completely separate application with its own:
- Git repository
- Supabase project
- Vercel deployment
- Domain and branding

It inherits proven architectural patterns from LGAAS:
- Learning engine architecture (cross-user pattern detection)
- Specialist agent system (deep domain AI agents with intelligence extraction)
- Trust signal progression
- Content intelligence pipeline
- AI discoverability optimization (JSON-LD, llms.txt, sitemaps)
- Proactive intelligence alerts
- Cron job infrastructure
- Human Voice Agent (for generated content)
- Conversational onboarding (AriaStar pattern adapted for consumer onboarding)
- SSE streaming widget architecture (adapted for Yuri landing page widget)

### When Seoul Sister Subscribes to LGAAS

Seoul Sister will subscribe to LGAAS for marketing automation, but with a clear separation of responsibilities:

| Responsibility | Handled By | Details |
|---------------|-----------|---------|
| Reddit K-beauty discovery | LGAAS | Scans r/AsianBeauty, r/SkincareAddiction, r/KoreanBeauty |
| Blog content generation | LGAAS | SEO articles about K-beauty trends, ingredients, routines |
| Social content | LGAAS | TikTok, Instagram, Threads strategy |
| Email sequences | LGAAS | Nurture campaigns, re-engagement |
| Competitive intelligence | LGAAS | Tracking Hwahae, Glowpick, competitor apps |
| Marketing learning engine | LGAAS | What content drives signups |
| **Landing page + widget** | **Seoul Sister (Yuri)** | NOT replaced by AriaStar |
| **Visitor conversion** | **Seoul Sister (Yuri)** | Yuri widget handles on-site conversion |
| **Product experience** | **Seoul Sister (Yuri)** | All post-signup AI interactions |

**AriaStar's role**: Business advisor to Seoul Sister's team (marketing strategy, content performance, competitive insights). She advises the business, not the visitors.

**Yuri's role**: Visitor-facing and user-facing AI. Handles pre-signup demo (widget), onboarding, and all product interactions.

**Clean separation**: AriaStar drives traffic TO seoulsister.com. Yuri handles conversion and retention ON seoulsister.com.

## Quick Reference

### Local Development
```bash
npm install          # Install dependencies
npm run dev          # Start Next.js dev server
```

### Deployment
Automatic via Vercel on push to `main` branch.

### Key URLs
- Production: https://seoulsister.com
- Supabase Dashboard: Check .env.local for project URL
- Vercel Dashboard: Check Vercel account

---

**Created**: February 2026
**Current version**: 11.61.10 (November 14 2026). One line only: every release's detail goes in `CHANGELOG.md`, never here.
**AI Advisor**: Yuri (유리) — "Glass"

**Full version history**: See `CHANGELOG.md` (repo root). The detailed, dated changelog — every version from v3.0.0 through the current release — lives there, not in this file. Per the project's documentation standard: CLAUDE.md is for current architecture and how the system works NOW; CHANGELOG.md is for what changed and when. When shipping a feature, update the relevant architecture section here and put the detailed entry in CHANGELOG.md.
