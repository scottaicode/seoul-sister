-- Undo the routine steps where a GENERIC step phrase was silently written to a
-- REAL product the user does not own.
--
-- WHAT HAPPENED
--
-- June 7 2026, Bailey asked Yuri to save a "Phase 3 PM Routine". Step 1 of that
-- routine was the phrase "Shower / cleanse" — an action, not a product. The
-- resolver's loose fallback matched it to a real catalog row, Beplain's Makiol
-- Foaming Cleanser (834d255d-…), and wrote that product_id into her routine.
-- The same save produced "Hero Mighty Patch" → "Dr.ppae Honey Heel Patch".
--
-- Yuri DID warn her at the time ("5 steps matched loosely… if any of these are
-- wrong, ask me to fix that step"), and Bailey fixed the obviously-wrong ones.
-- Step 1 read as a plausible cleanser, so it stayed — and became a durable fact.
--
-- Seven weeks later (July 27) Yuri read that routine back, saw a real cleanser in
-- step 1, and built an entire "calm-down week" plan around a product Bailey has
-- never owned. Bailey: "I don't even own the Beplain Makiol. Idk where that came
-- from I've never even heard of it."
--
-- This is the failure mode CLAUDE.md already names: a clean-looking result on a
-- record that was never actually verified. The warning was transient prose; the
-- bad row was permanent.
--
-- THE CODE IS ALREADY FIXED — this is data cleanup only.
--
-- The IDENTITY FLOOR in src/lib/yuri/tools.ts (July 27 2026) demotes any query
-- built purely from category/step words to match_quality='partial', and every
-- write path refuses 'partial'. GENERIC_PRODUCT_WORDS contains 'shower', 'rinse'
-- and 'cleanse' explicitly, so this exact input can no longer be written. The
-- floor shipped ~7 weeks AFTER these rows were created and nothing swept the
-- rows it left behind. That gap is the lesson: shipping the guard does not
-- retroactively clean what the bug already wrote.
--
-- WHY NULL product_id RATHER THAN DELETE
--
-- The step itself is real — she does shower and cleanse. ss_routine_products
-- allows product_id NULL for exactly this (devices, actions), and
-- src/app/(app)/routine/page.tsx reads `notes` as the display name for
-- null-product steps, citing "actions like shower/cleanse" in its own comment.
-- So this restores the step to what she actually asked for.
--
-- Scoped by explicit row id, not by product_id, so it can never touch a user who
-- genuinely owns this cleanser.

begin;

-- Show what we are about to change (row count should be exactly 2).
select rp.id,
       r.name             as routine_name,
       rp.step_order,
       rp.notes           as current_notes,
       p.brand_en || ' ' || p.name_en as fabricated_match
from ss_routine_products rp
join ss_user_routines r on r.id = rp.routine_id
left join ss_products p on p.id = rp.product_id
where rp.id in (
  '875c0074-7039-4f13-8a07-53621eb157ff',  -- Phase 3 PM Routine, step 1
  'd3038497-8557-4edc-93fc-f492a887c637'   -- Phase 3 AM,        step 1
);

update ss_routine_products
set product_id = null,
    notes      = 'Shower / cleanse'
where id in (
  '875c0074-7039-4f13-8a07-53621eb157ff',
  'd3038497-8557-4edc-93fc-f492a887c637'
)
  -- Belt and braces: only act if the row still points at the fabricated match,
  -- so re-running after a manual fix is a no-op rather than a clobber.
  and product_id = '834d255d-ac5b-4019-8472-7ec29129c8cf';

-- Verify: both rows should now have product_id IS NULL and the honest name.
select id, routine_id, step_order, product_id, notes
from ss_routine_products
where id in (
  '875c0074-7039-4f13-8a07-53621eb157ff',
  'd3038497-8557-4edc-93fc-f492a887c637'
);

-- Confirm no OTHER user's routine still carries a fabricated link to this row.
select count(*) as remaining_makiol_routine_steps
from ss_routine_products
where product_id = '834d255d-ac5b-4019-8472-7ec29129c8cf';

commit;
