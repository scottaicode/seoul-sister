-- A creator code follows the lead, not the browser (Nov 12 2026).
--
-- Measured on the owner's walkthrough: a visitor arrived through Bailey's
-- TikTok link (?code=BAILEY), chatted, gave an email, and opened the recap
-- email's "Create your free account" link in a different browser. The code
-- lived only in the first browser's storage, so the membership page showed
-- full price and the sign-up carried no creator code. TikTok's in-app browser
-- is rarely where someone reads email, so this is the usual path, not an edge.
--
-- The code the visitor arrived with is now kept on their row, and every email
-- link sent to that lead carries it (src/lib/widget/resume-token.ts,
-- src/lib/email/lead-email.ts, src/lib/email/nurture.ts). It is a code as
-- typed in a URL, not a promise: the page that receives it still asks Stripe
-- what it is worth before showing any price.

ALTER TABLE public.ss_widget_visitors
  ADD COLUMN IF NOT EXISTS offer_code text
  CONSTRAINT ss_widget_visitors_offer_code_format CHECK (offer_code ~ '^[A-Z0-9]{3,20}$');
