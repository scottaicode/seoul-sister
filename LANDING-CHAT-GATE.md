# The landing chat gate: what it is, why, and how to open it again

**Decided:** November 13 2026, by Scott and Bailey.
**Built as:** v11.60.0. Check `CHANGELOG.md` and `git log` for whether it has been deployed.
**Read this before** reopening the free chat, changing anything a visitor reads about how to reach Yuri, or grading whether the gate worked.

---

## The decision

Talking to Yuri starts with a free account. From March to November 2026 any visitor could send Yuri 12 messages on the homepage with no signup. That chat is now closed by default.

The path for a new person is: landing page (who Yuri is, a real or labelled example, a sign-up button), free account, free setup chat, 7 free days with no card, then $9.99/month only if they add a card.

## Why (the numbers on the day)

Measured Nov 13 2026 in `ss_widget_visitors` and `auth.users`:

| Fact | Number |
|---|---|
| People who chatted on the homepage since March 11 2026 | 153 |
| Sent two messages or fewer | 71 |
| Reached message 6, where the email was asked | 41 |
| Left an email | 28 |
| Of those emails, became an account | 0 |
| Paid | 1 (Kim, family-adjacent, signed up under a different address) |
| Cold strangers who paid | 0 |
| Chatters who arrived from TikTok | 6 |

Reasons given:
- Bailey: if Yuri tells people to sign up anyway, the free chat has no point.
- Scott: Yuri gives good advice only once she has the setup profile, and a sign-up step filters out people who are not serious.
- The data: the chat collected emails, and none of them turned into accounts.

What argued against it, so a later reader has both sides:
- Most chatters came from the blog and search with a question, and the chat was the only place an email was collected.
- The one person who paid chatted first (26 free messages over two visits).
- The recommendation at the time was a middle path: about 3 free messages, then the email step creates the account. Scott and Bailey chose the full gate.

## How to tell whether it worked

**Pass/fail line:** the open chat collected about 4 to 7 emails a month. **Fewer than about 4 real new accounts a month while closed means it is collecting less than the chat did, and should be reopened.**

The row that counts a gate sign-up:

```sql
select count(*), min(created_at), max(created_at)
from auth.users
where raw_user_meta_data->>'signup_from' like 'gate%'
  and created_at >= '<deploy date>';
```

- `signup_from` is the `?from=` tag that led to the sign-up page: `gate_blog`, `gate_product`, `gate_tiktok`, `gate_landing`, and also `nurture_3`, `widget_limit` and others.
- It is recorded for email and password sign-ups only. Google sign-ups do not carry it, so also look at total new accounts and at `raw_user_meta_data->'attribution'->>'landing_path'` (the first page the person landed on).
- Exclude owner tests and bot sign-ups before reading it.
- Never grade this with GA4. It is bot-inflated. The GA4 event `yuri_gate_signup_click` is a companion, not the measure.
- A sign-up is not a paid member. Paid is still `converted_user_id` and the first invoice with `amount_paid > 0`.

Until a real stranger's account shows `signup_from` starting with `gate`, the measurement is unverified. Name the row before saying it works.

## How to open the chat again

1. In Vercel, add the environment variable `NEXT_PUBLIC_LANDING_CHAT` with the value `open` (Production).
2. Redeploy. The value is fixed at build time, so the change takes effect only after a redeploy.
3. Do the manual steps below. The switch cannot reach them.

To close it again: remove the variable (or set it to anything other than `open`) and redeploy. Closed is the default; only the exact word `open` opens it.

### What follows the switch by itself

- The homepage hero (chat when open, sign-up view when closed).
- The chat endpoint `/api/widget/chat` (answers when open, refuses when closed).
- Every "free, no signup" line on the homepage, product pages, best-of pages, the blog call to action and the pricing card.
- The three nurture emails and the lead follow-up note (wording and where the button goes).

### What does NOT follow the switch (do these by hand when reopening)

| Thing | Why | What to do when reopening |
|---|---|---|
| `public/llms.txt` | Static file | It says "start with Yuri ... with a free account", which is true in both modes. Optional: put back "(12 messages, no signup)" and update `tests/crawlable-yuri-path.test.mjs`. |
| Blog post bodies in `ss_content_posts` | Written by LGAAS, stored as text | They were reworded to drop "no account needed". They stay true when open. Restoring the old lines is optional; the originals are in the backup named in the CHANGELOG entry for the sweep. |
| LGAAS's Seoul Sister profile | Separate repo and database | Its work order is `lgaas/LGAAS-WORK-ORDER-SEOUL-SISTER-CHAT-NEEDS-ACCOUNT.md`. The wording was made true in both modes, so nothing is required. Send a new work order only if "no account needed" should be advertised again. |
| A real example on the hero | Needs a person's approval | Unaffected by the switch. |

### Things to check after reopening

- Send one message as a new visitor on the live site and confirm a row appears in `ss_widget_visitors`.
- Confirm the email ask at message 6 and the sign-up card at 12 still work.
- The Yuri prompt for the landing chat was not edited by the gate, so it behaves as it did on Nov 12 2026. Its facts about the path (free account, setup chat, free week) were current then; re-read `src/lib/widget/subscriber-surface.ts` if months have passed.
- People who visited while it was closed have no chat history; that is expected.

## Where the code is

| File | What it does |
|---|---|
| `src/lib/landing-chat.ts` | The switch, every access sentence for both modes, the carried question, the `signup_from` tag. Start here. |
| `src/app/api/widget/chat/route.ts` | Refuses as the first statement of the handler when closed. |
| `src/components/widget/GatedYuriIntro.tsx` | The closed hero. Pinned by SHA-256. |
| `src/components/widget/TryYuriSection.tsx` | Still mounts when closed, so emailed resume links are stripped from the address bar and a saved conversation can be read. |
| `src/content/yuri-example.ts` | The real conversation shown on the hero, or `null`. Pinned by SHA-256. |
| `src/app/(auth)/register/page.tsx`, `src/app/(app)/onboarding/page.tsx` | Keep a visitor's `?ask=` question through sign-up and prefill it in the setup chat. It is never sent for them. |
| `src/contexts/AuthContext.tsx` | Writes `signup_from` onto the account. |
| `src/lib/email/nurture-copy.ts`, `src/lib/proactive/lead-reengage.ts` | Closed-mode email wording and facts. |
| `tests/landing-chat-gate.test.mjs` | The guard tests. |
| `.claude/rules/widget.md` | Top section states the current mode for any session working on the widget. |

## Rules for changing any of it

- Do not write "free, no signup" or any other sentence about reaching Yuri anywhere except through `src/lib/landing-chat.ts`. A test scans the source tree and fails on a new one.
- The closed hero, the example file and the closed nurture emails are pinned by fingerprint. Changing a word means: second-model review, then update the fingerprint.
- A real conversation goes on the hero only when the person in it has read the exact text and agreed. Record who and when in `approvedBy`. Never invent or tidy a conversation.
- Blog post bodies are not covered by the source scan. Check them, and LGAAS, whenever the mode changes.

## What the second-model review found (Nov 13 2026)

Opus 5.5, told to refute the change, found two blockers and five should-fix items, and got nine deliberately wrong versions past the first tests. Worth knowing because the same mistakes are easy to repeat:

- 46 published blog posts promised a no-account chat in their body text, invisible to a source-code search.
- One best-of page had the promise hardcoded in different words ("free and without an account").
- The lead follow-up note was told leads could read their old chat on the homepage; that only works within an hour.
- "Your question is saved on this device" was shown before anything was saved.
- The closed hero would have opened scrolled past its own button on a phone.
- Nothing recorded that a sign-up came from the gate.

## What LGAAS reported back (Nov 13 2026)

The LGAAS session carried out its work order the same day (LGAAS commits `f8859bf` and `46fc950`, deployed). Its report, as given to Scott; none of it was re-checked from this repo except where noted.

- **Fixed at the source.** Seoul Sister's LGAAS profile, the blog call-to-action instruction (`blog_cta_destination` changed from `on_page_widget` to a new `homepage_link` value), the hand-pasted blog recipes, AriaStar's stored correction and all 11 unpublished drafts no longer say "no account" or "on this page". The wording used is "Yuri is free to start with a free account", which holds whether the chat is open or closed.
- **LGAAS holds its own copy of the published posts (55; this repo counts 56).** 46 carry the line, 84 times, matching this repo's count. **Editing, approving or redelivering any of them in LGAAS re-sends it to Seoul Sister and overwrites whatever is stored here.** So a correction made only in `ss_content_posts` can be undone by any later LGAAS edit to that post. Correct published posts at the LGAAS source, or in both places.
- **Seoul Sister's blog auto-generation is switched off in LGAAS** (`blog_auto_generation.mode = off`), so no scheduled draft exists yet to prove the fix. The query to check the first one is in the LGAAS work order's report.
- **Not synced:** the "no card needed" sentence in LGAAS's `core_offering` is fixed text. If `NO_CARD_TRIAL_ENABLED` is ever set to false, LGAAS needs a new work order. Price and `trial_requires_card` do sync.
- **Left for Scott:** an old Seoul Sister widget config in LGAAS (v38, no domain, no conversations since Sep 1) still says "no signup required" and "card required". Deactivate or regenerate.
- **Its detector is not proof.** It misses paraphrases ("no strings attached"). A pass means the known wordings are gone.
- **Found for this repo, and fixed here:** a signed-in member following a blog link (`/?from=blog`) would have landed on the sign-up card. With the chat closed they now go to their own Yuri chat (`signedInLandingDestination` in `src/lib/landing-chat.ts`).

## The published blog posts (done Nov 13 2026)

- **What was wrong:** 46 of 56 published posts said Yuri needs no account (84 times), and most said the chat was "right here on this page".
- **How it was fixed:** LGAAS wrote and second-model reviewed 134 exact before-and-after sentence pairs across 53 posts, applied them to its own stored copies by direct database update (nothing was re-sent), and handed over the list. The same pairs were applied to `ss_content_posts` with `scripts/apply-blog-no-account-replacements.mjs`. Verified from the database afterwards: 0 "no account" claims, 0 "chat on this page" phrases, all 53 rows equal to the intended text.
- **Three lines LGAAS's list could not reach** (the third, an FAQ answer on the late-20s post, was found by LGAAS afterwards) were fixed here with `scripts/fix-blog-two-leftover-lines-nov13.mjs`: an FAQ answer on the PDRN post, and the one post LGAAS does not hold (`the-7-minute-k-beauty-routine-that-actually-sticks`). These were worded here and not second-model reviewed.
- **The wording is true in both modes** ("free to start with a free account", "ask Yuri", "tap Ask Yuri on this page"), so reopening the chat needs no change to the posts.
- **Before the sweep, all 55 posts LGAAS holds were byte-identical to Seoul Sister's copies.** They are identical again after it, apart from the PDRN post's FAQ field unless LGAAS made the same change.
- **Backups of the old text:** `scripts/backup-blog-bodies-before-no-account-sweep-2026-11-13T23-22-30-155Z.json` and `scripts/backup-blog-two-leftover-lines-2026-11-13.json` here; `scripts/snapshot-ss-published-no-account-1794612003537.json` in LGAAS. The pairs file is `lgaas/ss-chat-needs-account-published-replacements.json`.
- **Left as is, on purpose:** phrases such as "the free AI skincare advisor" and "ask Yuri for free" remain in about a dozen places. Yuri is free to start and then $9.99/month, so a reviewer flagged "free" as a standing description. Owner decision, not made.
- **The LGAAS risk that remains:** any future edit or redelivery of a post inside LGAAS overwrites Seoul Sister's copy with LGAAS's. Both copies now carry the fix, so that would not bring the claim back.

## Open at the time of writing

- Not deployed. Not seen in a browser.
- Blog body sweep and both LGAAS work orders were completed the same day (sections above).
- No real example approved for the hero.
- The fixes made after the review were not sent back for a second review.
