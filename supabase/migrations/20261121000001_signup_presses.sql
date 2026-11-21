-- One row per press of a sign-up button on a public page (Nov 21 2026).
--
-- Why: nothing first-party recorded the step between "read a page" and
-- "created an account". Accounts are in auth.users; visits were only in Google
-- Analytics, which counts crawlers (3,358 sessions on Nov 13-21 at a 10-second
-- average, against 5 real accounts). A crawler does not press a button, so a
-- press is the earliest step that is mostly people.
--
-- What it holds: which button (one of six), a channel name for where the
-- visitor arrived from (from a fixed list), and which page the button was on
-- (the home page or one blog post). The values are chosen by
-- src/lib/signup-press.ts from fixed lists; nothing a visitor can write freely
-- is stored. No account, no address, no browser id, no IP: a press cannot be
-- tied to a person. It is a count.
--
-- How to read it (see LANDING-CHAT-GATE.md): it counts presses of six buttons
-- in a browser running our script. Sign-up links elsewhere, a direct visit to
-- the form, a link opened in a new tab and a blocked request are not counted,
-- so an account with no press before it is normal. Zero presses over days in
-- which accounts were created from these buttons is what means it is broken.
CREATE TABLE IF NOT EXISTS ss_signup_presses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pressed_at timestamptz NOT NULL DEFAULT now(),
  button text NOT NULL CHECK (button ~ '^[a-z0-9_]{1,40}$'),
  arrival text CHECK (arrival IS NULL OR arrival ~ '^[a-z0-9_]{1,40}$'),
  page_path text CHECK (page_path IS NULL OR (char_length(page_path) BETWEEN 1 AND 200 AND page_path LIKE '/%'))
);

CREATE INDEX IF NOT EXISTS ss_signup_presses_pressed_at_idx ON ss_signup_presses (pressed_at);

-- Written and read by the server only. No policy: the public key can do nothing here.
ALTER TABLE ss_signup_presses ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ss_signup_presses IS
  'One row per press of a sign-up button on a public page. Counts only: no account, address, browser id or IP.';
