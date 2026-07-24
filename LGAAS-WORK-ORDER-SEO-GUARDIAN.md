# LGAAS Work Order — Consuming Seoul Sister's Weekly SEO Guardian Report

**Date:** July 24 2026
**Owner:** Scott Martin
**Status:** ACTIVE once the SEO Guardian cron ships (Seoul Sister v11.11.0)
**Audience:** any AI session working in the LGAAS repo, and Scott when running the weekly content loop.

---

## What Seoul Sister now produces (context for LGAAS)

Seoul Sister runs a weekly **SEO Guardian** cron (`/api/cron/seo-guardian`): it pulls
Google Search Console query/page data for seoulsister.com, an Opus strategist analyzes
clusters and striking-distance opportunities, and it emails Scott a ranked action report.
Every content recommendation is recorded as a **dated bet** (reasoning + expected outcome)
in `ss_seo_reports.bets`, graded against later GSC data (learning loop).

**Division of labor (unchanged from the standing doctrine):**
- **Seoul Sister** owns measurement + strategy about seoulsister.com (the report, the bets, the grading).
- **LGAAS** owns content EXECUTION: blog generation, social, email sequences — the machinery that acts on content bets.
- AriaStar advises the business; Yuri faces visitors. Neither changes here.

## How LGAAS consumes a content bet (the workflow)

When the weekly report contains a `new_content` or `content_refresh` bet:

1. Scott (or an LGAAS session) opens LGAAS **"+ New Blog"** and uses the **custom topic + context** fields (the established recipe workflow).
2. **Topic** = the bet's target query cluster, phrased as the bet recommends (e.g. "Korean skincare for post-inflammatory erythema (PIE): complete guide").
3. **Context** = paste the bet's `reasoning` + `target_queries` list verbatim, PLUS grounding data from the Seoul Sister DB per the standing rule (query `ss_products` / `ss_counterfeit_markers` for any product/brand claims — never let LGAAS invent product facts).
4. Run the MANDATORY LGAAS review checklist before publish (verify claims vs DB, no Amazon/eBay links, FAQ count ≠ 0, retailer policy: recommend only Olive Young / Soko Glam / iHerb).
5. Published posts flow to seoulsister.com via the existing blog delivery pipeline (IndexNow pings Bing on ingest automatically).

## Rules that carry over (do not relearn these)

- **Retailer policy:** never recommend YesStyle/Stylevana/StyleKorean in generated content; recommend-set is Olive Young, Soko Glam, iHerb. Price-as-data is fine.
- **No em-dashes** in any social/Reddit copy derived from these bets.
- **Ground product claims in the Seoul Sister DB** before drafting.
- **The bet's expected outcome is Seoul Sister's to grade, not LGAAS's to claim.** LGAAS ships the content; the SEO Guardian's Phase 3 grader reads whether position/CTR actually moved. Don't self-report success.

## What LGAAS should NOT do

- Don't build a parallel GSC integration in LGAAS for seoulsister.com — Seoul Sister owns that teacher. (LGAAS may of course build GSC integrations for OTHER subscriber sites; this order covers Seoul Sister only.)
- Don't auto-publish from bets without the review checklist — bets are strategy, the checklist is quality control.
- Don't rewrite the bet's topic into generic SEO content — the value is the specific query cluster + the specific reasoning; generic K-beauty posts are already covered by the daily pipeline.

## First known targets (from the July 24 2026 manual export, pre-cron)

The first weekly report will formalize these, but the clusters already visible are:
1. **PIE (post-inflammatory erythema)** — ~15 query variants at positions 5–10; "korean skincare for pie" already #1-2. One consolidation/expansion could own the topic.
2. **Beauty of Joseon Aqua Fresh sunscreen** — 6 variants, ~530 impressions, positions 7.6–9.3; a definitive review/ingredients page (answer "mineral or chemical" explicitly) flips to page-1 top.
3. **Sebaceous filaments** — high volume, positions 4–25, strong question-form queries ("why do my sebaceous filaments keep coming back" at 9.5).
4. **Counterfeit/authenticity** — "cosrx barcode check" (9.7), "how to identify fake cosrx snail mucin" (7.5), Sulwhasoo authenticity (6.1). Moat topic; AI assistants are visibly grounding on these pages.
