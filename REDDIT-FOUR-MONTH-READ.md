# Reddit: what four months of real data actually says

**Aug 5 2026.** First read of the full `ss_reddit_intel` corpus (621 comments,
Mar 9 – Aug 4 2026). Measurement only — nothing was shipped off the back of this.

**Why this exists:** Scott's read was *"a few steps forward, then a couple steps
back — no strong trend of better performance."* That is exactly right, and the
data explains why. It is not regression. It is an **unmeasured process**:
improvements that are never graded cannot compound, so each change is as likely
to hurt as help and the net looks like noise.

---

## 1. Comment performance has been FLAT for five months

| Month | n | avg | **median** | p75 | p90 | % ≥10 |
|---|---|---|---|---|---|---|
| Mar | 287 | 3.74 | **2.0** | 3.0 | 6.0 | 7.7% |
| Apr | 126 | 3.10 | **2.0** | 2.0 | 6.0 | 4.0% |
| May | 79 | 4.89 | **2.0** | 3.0 | 6.0 | 8.9% |
| Jul | 99 | 3.35 | **2.0** | 3.0 | 8.2 | 7.1% |
| Aug | 30 | 2.40 | **1.0** | 3.0 | 5.1 | 3.3% |

**The median is 2.0 in every month.** p75 is 3.0 in four of five. The average
moves only because a handful of outliers move it — that is the "steps forward,
steps back" feeling, and it is noise, not signal.

## 2. The variable that actually moves performance is WHERE, not HOW

| Subreddit | n | avg | median | % ≥10 |
|---|---|---|---|---|
| **r/AsianBeauty** | 61 | **9.66** | 3.0 | **26.2%** |
| r/koreanskincare | 300 | 3.46 | 2.0 | 5.7% |
| r/KoreanBeauty | 67 | 3.01 | 2.0 | 9.0% |
| r/30PlusSkinCare | 26 | 2.96 | 2.0 | 3.8% |
| **r/SkincareAddiction** | 161 | **2.12** | 1.0 | **1.2%** |

r/AsianBeauty beats r/SkincareAddiction by **4.6x on average score and 22x on
hit rate** — and 2.6x more comments went into the worse one.

## 3. The monthly wobble IS the subreddit mix

| Month | %AsianBeauty | %SkincareAddiction | avg |
|---|---|---|---|
| Mar | 9.1 | 32.8 | 3.74 |
| Apr | 12.7 | 31.7 | 3.10 |
| **May (best)** | **12.7** | **7.6** | **4.89** |
| Jul | 8.1 | 14.1 | 3.35 |
| **Aug (worst)** | **3.3** | **23.3** | **2.40** |

Best month had the LOWEST SkincareAddiction share. Worst month had AsianBeauty
collapse to 3.3% while SkincareAddiction climbed back to 23.3%. **The apparent
progress and regression is allocation drift.**

## 4. Controlling for subreddit, the writing changes did nothing measurable

r/koreanskincare alone, median by month: **2.0, 2.0, 2.0, 2.0, 1.0.**

That is the honest verdict on months of prompt/voice iteration. It does not mean
the comments are bad — they are demonstrably good, and the corpus contains a 91
and a 68. It means **the iteration was never graded, so it could not compound.**

---

## What this implies (NOT yet acted on)

1. **Allocation is the lever, not phrasing.** Shifting volume from
   r/SkincareAddiction toward r/AsianBeauty is the single highest-expected-value
   change available, and it costs nothing to try.
2. **Caveat before over-reading #1:** r/AsianBeauty's n is 61 and its median is
   3.0 against SkincareAddiction's 1.0 — the average gap is partly outlier-driven,
   so the honest claim is "materially better", not "4.6x better". Also unknown:
   whether AsianBeauty can absorb more volume without the fit degrading. Test by
   shifting allocation and re-reading, not by assuming.
3. **Upvotes are a proxy, not the goal.** Zero attributed sessions to date, so
   nothing here proves score correlates with visits. When
   `attributed_sessions` starts populating, re-run this by subreddit — it may
   contradict the upvote ranking entirely, and if it does, the CLICK data wins.
4. **The reason nothing compounded is now fixed.** `ss_reddit_intel` +
   attribution + pushback capture means the next four months are gradeable in a
   way the last four were not. That is the actual unlock, not any single tactic.

## Do NOT re-derive

- Do not read the monthly average as a performance trend. It tracks subreddit
  mix. Always segment by subreddit before concluding anything about writing.
- Do not conclude the writing is the problem. Within r/koreanskincare the median
  has never moved, across 300 comments and months of iteration.

---

# ADDENDUM — the reply backfill (Aug 5 2026, same day)

Swept all 621 comments for replies. **0 unchecked, 0 failures.** 383 had at
least one reply. This is the dimension nothing had ever collected.

## Pushback across four months: 10 instances in 621 comments (1.6%)

| Kind | n |
|---|---|
| **ai_callout** | **4** |
| factual_correction | 2 |
| disagreement | 2 (+2 false-ish, see below) |
| clarifying_question | 1 |

**The factual record is excellent.** TWO factual corrections in 621 public
comments across five months, in subreddits full of people who read INCI lists
for fun. Both were narrow and fair:
- `SeboSte` (+3): *"It's actually the protease that accounts for the exfoliating
  properties of this toner"* — a real mechanism correction.
- `bertcoco111` (+3): *"300 is higher! 50 is the lowest"* — a molecular-weight
  direction error.

That is a **0.32% factual error rate on public claims.** The honesty moat is
holding up under exactly the scrutiny it was built for.

## The finding that matters: AI callouts are PERSISTENT, not rare

| Month | checked | ai_callouts | rate |
|---|---|---|---|
| Mar | 287 | 0 | 0.00% |
| Apr | 126 | **2** | 1.59% |
| May | 79 | **1** | 1.27% |
| Jul | 99 | **1** | 1.01% |
| Aug | 30 | 0 | 0.00% |

Verbatim, with the community's verdict on each:

| Date | Sub | Our score | Callout | Their score |
|---|---|---|---|---|
| Apr 16 | 30PlusSkinCare | **+15** | *"This comment was written entirely by AI. 50% of reddit is just AI trash"* | **+5** |
| Apr 18 | SkincareAddiction | +2 | *"your comment reads quite AI-written, did you use AI to tidy up something you wrote?"* | +1 |
| May 22 | koreanskincare | −2 | *"Why bother replying using AI generated responses?"* | **+5** |
| Jul 31 | koreanskincare | **+7** | *"All your comments are AI - why not write something yourself?"* | **+6** |

Three things to sit with:

1. **It is not escalating, but it is not going away either.** Roughly 1–1.6%
   every month since April, across three different subreddits and four
   different accusers. March was clean.
2. **A high score does not protect you.** The Apr 16 comment scored **+15** and
   the Jul 31 comment scored **+7**. The community upvoted the comment AND the
   person calling it AI. Score-based monitoring would have caught neither —
   which is exactly why `pushback_kind` exists and why it outranks score.
3. **The July one is the most serious.** *"ALL your comments are AI"* is an
   accusation about the ACCOUNT, not one reply, and it drew +6. That is a
   reader who looked at the profile history. It is the closest thing to a
   pre-ban signal the data contains.

### What this does NOT say

It does not say the channel is burning. 4 in 621 is 0.6% lifetime, no
moderator action has occurred, no removals, and the account is still gaining
karma. Two of the four accusers were polite (`a_crazy_diamond` explicitly
hedged: *"So sorry if this is wrong but just out of curiosity"*).

### What it DOES say for the "should we be bolder" question

This is the instrument that question needed, and it now has an answer grounded
in data rather than nerves: **the current posture already draws ~1% scrutiny
with zero promotional content in the comments.** Adding in-comment promotion
would raise the stakes on a signal that is already non-zero and already
upvoted. BP108's Stage-2 hold looks better-founded after this read, not worse.

**Re-read this monthly.** The number to watch is the RATE, and the specific
thing that would change the decision is an accusation about the ACCOUNT (like
Jul 31) recurring, or any moderator action. Query:

```sql
SELECT date_trunc('month', posted_at)::date AS month, count(*) AS checked,
       count(*) FILTER (WHERE pushback_kind='ai_callout') AS callouts
FROM ss_reddit_intel WHERE replies_checked_at IS NOT NULL
GROUP BY 1 ORDER BY 1;
```

## Two disagreement rows are misclassified (known, not fixed)

Mar 17 and Mar 19 are tagged `disagreement` but read as ordinary OPs supplying
more detail (*"I use all round lab products as of now..."*). The cue matched
"I don't think" inside a normal sentence. Precision on `disagreement` is
therefore ~50% (2 of 4), which is fine for a HUMAN REVIEW QUEUE and would not
be fine for anything automatic — which is why nothing here is automatic and
`pushback_confirmed` stays NULL. Do not tune this by feel; if it ever needs to
be precise, measure it first (cf. the 23%-precision classifier discarded in
v11.21.0).
