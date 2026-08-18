-- Match the BoJ sunscreen post's snippet to the intent that actually finds it.
--
-- MEASURED, not assumed (GSC 28-day snapshot ending Aug 13 2026, ss_seo_reports):
--   /blog/beauty-of-joseon-aqua-fresh-sunscreen-full-review
--     614 impressions across 13 "ingredient" queries, average position 7.2,
--     2 clicks. ~0.3% CTR at a position that normally earns several percent.
--   Site-wide, "ingredient" queries are the largest intent cluster:
--     1,179 impressions -> 2 clicks.
--
-- The old title was "Beauty of Joseon Aqua Fresh Sunscreen" — accurate, and
-- silent on the one word 13 of those queries contain. People at position 7 saw
-- a generic product title and scrolled past. This is an intent mismatch, not a
-- ranking problem: the page is already on page one for these searches.
--
-- HONEST BY CONSTRUCTION. Verified against the post body before writing this:
-- it contains an INCI list, 23 ingredient mentions, and names both UV filters.
-- The description cites them (Uvinul A Plus for UVA, Uvinul T 150 for UVB)
-- because a specific, checkable claim is what distinguishes answering the query
-- from stuffing the keyword. If the body ever loses that section, this snippet
-- becomes a promise the page does not keep.
--
-- SCOPE: exactly one row. An earlier version of this work generated new titles
-- for 8 posts on the theory that meta_titles were being truncated mid-word.
-- That theory was FALSE — measured, zero rows are cut mid-word, and the short
-- titles are clean clause cuts ("K-Beauty Toners", "Best Korean Skincare for
-- PIH"), which is correct behaviour. The script was discarded rather than
-- tuned. Only this one row had evidence behind it.
--
-- Guarded on the current value, so re-running is a no-op and a hand edit in the
-- meantime is never clobbered.

UPDATE ss_content_posts
SET meta_title = 'Beauty of Joseon Aqua Fresh: Ingredients',
    meta_description = 'Full ingredient breakdown of Beauty of Joseon Aqua Fresh sunscreen: Uvinul A Plus and Uvinul T 150 UV filters, the complete INCI list, who it suits, and how it compares to other K-beauty sunscreens.'
WHERE slug = 'beauty-of-joseon-aqua-fresh-sunscreen-full-review'
  AND meta_title = 'Beauty of Joseon Aqua Fresh Sunscreen';

-- Expect: UPDATE 1
-- Title is 40 chars; " | Seoul Sister" (15) keeps it inside Google's ~60 budget.
