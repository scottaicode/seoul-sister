-- Atomic greeting lock for onboarding — prevents the double-greeting race.
-- Added 2026-07-23.
--
-- Bug: the onboarding route generated Yuri's opening message when
-- `messages.length === 0`, but the greeting is only SAVED after the ~0.9s
-- stream finishes. React 18 Strict Mode (and any fast re-mount) fires the
-- client's start_onboarding twice; both requests read zero messages, both pass
-- the check, both generate and save a greeting. Result: two different opening
-- messages 0.9s apart (observed live: 1 of 3 onboardings double-greeted).
--
-- Fix: a claim timestamp the server flips null -> now() with a conditional
-- UPDATE (`.is('greeting_started_at', null)`). Postgres serializes concurrent
-- UPDATEs on the same row, so exactly ONE request's update returns a row and
-- earns the right to generate the greeting; the loser returns existing state.
-- Check-then-act becomes atomic-claim.
--
-- Nullable, no default: NULL means "greeting not yet started" — the exact state
-- every existing row should have, and the condition the claim tests against.
--
-- Apply with: supabase db execute / psql against the project (MCP is read-only).

ALTER TABLE ss_onboarding_progress
  ADD COLUMN IF NOT EXISTS greeting_started_at timestamptz;

COMMENT ON COLUMN ss_onboarding_progress.greeting_started_at IS
  'Atomic claim for onboarding greeting generation (null=not started). Set via conditional UPDATE so concurrent start_onboarding calls cannot both generate a greeting. Added 2026-07-23.';
