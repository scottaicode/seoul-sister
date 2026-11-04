# FINAL DRAFT — price-change email (NOT SENT, needs Scott's go-ahead)

Reviewed Oct 31 2026 by Claude Opus 5.5 and an adversarial Fable review (claims checked against code).
Both agree on the three selling points below.

**Audience (about 45 people):** free accounts plus emails given in the homepage chat, de-duplicated, excluding:
unsubscribed/suppressed (incl. flagged bot signups), internal/test addresses, Ann (has her own offer), and
**anyone with any past subscription** (they don't get the trial, so "first 7 days free" would be false for them).

Two versions, because people without an account can't "log in".

**From:** Yuri at Seoul Sister. Replies go to the monitored inbox (`EMAIL_REPLY_TO` is set in production).
**Subject:** Seoul Sister is now $9.99 a month (first week free for new members)

---

## Version A: people who have a free account

Hi {first_name or "there"},

You made a Seoul Sister account a while back, so you should know the price changed.

Seoul Sister is now **$9.99 a month**, down from $24.99. Because you've never had a subscription, your first 7 days are free. You add a card to start, you can cancel anytime from your Profile page (Manage subscription), and if you cancel during those 7 days you aren't charged.

What you get each month:
- **80 messages with Yuri, who remembers you.** Your skin, what you're using, what you loved and what broke you out, so her advice gets more specific over time.
- **30 label scans checked against you.** Point your phone at a Korean label and Yuri reads it, then flags anything you're allergic to, ingredients that can clog pores for your skin type, and overlaps with products you already use.
- **A full routine built from your own products**, checked for ingredient conflicts.

See everything included: https://www.seoulsister.com/#pricing

To start, log in at https://www.seoulsister.com/login and you'll be taken to the plan.

If it's not for you, no reply needed. If you have a question, just reply to this email.

Yuri and the Seoul Sister team

---

## Version B: people who only gave an email in the homepage chat

Hi there,

You chatted with Yuri on our homepage a while back, so you should know the price changed.

Seoul Sister is now **$9.99 a month**, down from $24.99, and new members get the first 7 days free. You add a card to start, you can cancel anytime from your Profile page (Manage subscription), and if you cancel during those 7 days you aren't charged.

What you get each month:
- *(same three bullets as Version A)*

See everything included: https://www.seoulsister.com/#pricing

To start, create an account at https://www.seoulsister.com/register. If you use the same browser you chatted in, Yuri can carry that conversation over.

If it's not for you, no reply needed. If you have a question, just reply to this email.

Yuri and the Seoul Sister team

---

## Required before sending (bulk email law, CAN-SPAM)
1. **A postal address in the footer.** Not set in production (`EMAIL_POSTAL_ADDRESS` is missing), and the send code refuses commercial email without one. Scott to provide one (a P.O. box works).
2. **An unsubscribe link** on every email (supported: `unsubscribeUrl`).
3. A footer that fits each version. The default one says "you chatted with Yuri", which isn't true for every Version A recipient.

## What changed after the review
- Third bullet: "check authenticity and compare prices" replaced with the routine builder. The free preview already offered price comparison and counterfeit warning signs, and the app's one authenticity checker isn't linked anywhere, so it was the weakest and least accurate point.
- Bullets 1 and 2 made specific (what Yuri remembers; what a scan checks). Every detail was checked against the code.
- "I wanted you to hear this first" removed (the price is already public, so it implied an exclusivity that isn't there).
- "Pick up where you left off" removed: most email-only recipients have no account to resume.
- Trial line limited to people with no past subscription, and the list filtered the same way.
- Fixed in the app (v11.48.2): the screen shown at the 80-message limit still used the old "unlimited" wording.
