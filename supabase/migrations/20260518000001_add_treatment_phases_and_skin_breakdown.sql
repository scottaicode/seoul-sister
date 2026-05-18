-- Phase 13.D: Living Skin Profile + Phase Progress Photo Gallery
--
-- Three changes to support v10.6.0 Living Skin Profile feature:
--
-- 1. ss_treatment_phases — captures the phased treatment plan Yuri runs with
--    the user. Bailey's current data: Phase 1 (barrier repair, Feb-Apr) was
--    completed, Phase 2 (active treatment, May 5 → present) is current.
--    Phases are written by the background Sonnet extractor in
--    src/lib/yuri/treatment-phase-extractor.ts after each Yuri conversation.
--    Users cannot edit phases directly — they emerge from Yuri conversations.
--    Includes `outcomes JSONB` (populated when a phase completes) so that
--    accumulated phase results become moat fuel for future cohort learning
--    (Principle 3 — Moat Through Learning).
--
-- 2. ss_skin_breakdown_history — preserves every Opus 4.7-generated Skin
--    Breakdown across regenerations. The current breakdown surfaces on the
--    /skin-profile page; the history table lets Yuri reference past
--    breakdowns ("your skin notes from two weeks ago said X") and feeds
--    future progress-narrative features. Closes the learning loop on
--    Principle 3 — the moat is the accumulated record, not just the live read.
--
-- 3. ss_glass_skin_scores extended with photo_url + treatment_phase_id.
--    Photos now persist to Supabase Storage so the Phase Photo Gallery can
--    actually show visual progress (Bailey's text 2 ask). treatment_phase_id
--    soft-links each photo to the phase it was taken during.

-- ============================================================
-- 1. ss_treatment_phases
-- ============================================================

CREATE TABLE ss_treatment_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Phase identity
  phase_number INTEGER NOT NULL,            -- 1, 2, 3...
  name TEXT NOT NULL,                        -- "Barrier Repair", "Active Treatment"
  goal TEXT,                                 -- "Restore moisture barrier..."

  -- Phase lifecycle
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'paused')),
  started_at TIMESTAMPTZ,                    -- When Yuri started this phase
  completed_at TIMESTAMPTZ,                  -- When Yuri marked it complete

  -- Phase content (JSONB for flexibility — Yuri's phase structure varies)
  protocol JSONB DEFAULT '{}'::jsonb,        -- { am_actives, pm_actives, frequency, watch_for, ... }
  decisions JSONB DEFAULT '[]'::jsonb,       -- Specific decisions for this phase
  watch_for JSONB DEFAULT '[]'::jsonb,       -- Yuri's "watch for X" list

  -- Outcomes — populated when phase completes (Principle 3 moat fuel)
  outcomes JSONB DEFAULT '{}'::jsonb,        -- { what_worked, what_didnt, carried_forward, ... }

  -- Source attribution
  created_from_conversation_id UUID REFERENCES ss_yuri_conversations(id),
  last_yuri_update_at TIMESTAMPTZ,           -- When Yuri last modified this phase

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, phase_number)
);

CREATE INDEX idx_treatment_phases_user_status ON ss_treatment_phases(user_id, status);
CREATE INDEX idx_treatment_phases_user_phase ON ss_treatment_phases(user_id, phase_number);

ALTER TABLE ss_treatment_phases ENABLE ROW LEVEL SECURITY;

-- Users see their own phases. INSERT/UPDATE happens via service_role from
-- the Yuri extraction pipeline — users cannot edit phases from UI.
CREATE POLICY "Users can view own phases"
  ON ss_treatment_phases FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role manages phases"
  ON ss_treatment_phases FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE TRIGGER set_treatment_phases_updated_at
  BEFORE UPDATE ON ss_treatment_phases
  FOR EACH ROW
  EXECUTE FUNCTION ss_set_updated_at();

-- ============================================================
-- 2. ss_skin_breakdown_history
-- ============================================================
--
-- Every Opus 4.7-generated Skin Breakdown is preserved. The /skin-profile
-- page reads the latest row (LIMIT 1, ORDER BY generated_at DESC).
-- Regenerations triggered by phase change, decision_memory mutation, or
-- 7-day floor. source_hash is a deterministic hash of the inputs Opus saw
-- so identical inputs don't regenerate.

CREATE TABLE ss_skin_breakdown_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The synthesis
  breakdown_text TEXT NOT NULL,              -- Opus 4.7's prose output
  source_hash TEXT NOT NULL,                 -- Hash of inputs used; identical hash = skip regen
  treatment_phase_id UUID REFERENCES ss_treatment_phases(id),

  -- Cost + observability
  input_tokens INTEGER,
  output_tokens INTEGER,
  model_used TEXT NOT NULL DEFAULT 'claude-opus-4-7',
  generation_reason TEXT,                    -- "phase_change" | "weekly_floor" | "manual" | "first_visit"

  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skin_breakdown_user_latest ON ss_skin_breakdown_history(user_id, generated_at DESC);
CREATE INDEX idx_skin_breakdown_phase ON ss_skin_breakdown_history(treatment_phase_id) WHERE treatment_phase_id IS NOT NULL;

ALTER TABLE ss_skin_breakdown_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skin breakdowns"
  ON ss_skin_breakdown_history FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role manages skin breakdowns"
  ON ss_skin_breakdown_history FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================================
-- 3. Extend ss_glass_skin_scores
-- ============================================================
--
-- photo_url: signed/public URL to the uploaded selfie in Supabase Storage.
-- Nullable because existing rows (Bailey's Feb 25 scores) predate storage.
--
-- treatment_phase_id: soft link to the phase the photo was taken during.
-- Nullable so existing rows without phase context don't break.

ALTER TABLE ss_glass_skin_scores
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS treatment_phase_id UUID REFERENCES ss_treatment_phases(id);

CREATE INDEX IF NOT EXISTS idx_glass_skin_scores_phase
  ON ss_glass_skin_scores(treatment_phase_id) WHERE treatment_phase_id IS NOT NULL;

-- ============================================================
-- 4. Storage bucket for Glass Skin photos
-- ============================================================
--
-- Bucket: glass-skin-photos. Private. Path convention: {user_id}/{score_id}.jpg
-- API route uploads with service_role; reads via signed URL (1 hour expiry).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'glass-skin-photos',
  'glass-skin-photos',
  false,                                     -- Private bucket
  5242880,                                   -- 5MB per photo
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Users can read their own photos via signed URL (server-mediated).
-- Direct client SELECT against the bucket is allowed for their own user_id prefix.
CREATE POLICY "Users can read own glass skin photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'glass-skin-photos'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Service role manages glass skin photos"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'glass-skin-photos'
    AND (select auth.role()) = 'service_role'
  );
