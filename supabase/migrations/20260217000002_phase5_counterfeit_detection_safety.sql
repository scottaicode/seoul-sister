-- =============================================================================
-- Seoul Sister Phase 5: Counterfeit Detection & Safety
-- Description: Batch code verification, safety alerts, retailer verification
-- =============================================================================

-- Batch code verification records
CREATE TABLE ss_batch_code_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES ss_products(id) ON DELETE SET NULL,
    brand           TEXT NOT NULL,
    batch_code      TEXT NOT NULL,
    decoded_info    JSONB,
    is_valid        BOOLEAN,
    confidence      INT CHECK (confidence >= 1 AND confidence <= 10),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safety alerts (proactive warnings for users)
CREATE TABLE ss_safety_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type      TEXT NOT NULL CHECK (alert_type IN ('counterfeit_wave', 'recall', 'ingredient_warning', 'seller_warning', 'batch_issue')),
    severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    affected_brands TEXT[],
    affected_products UUID[],
    affected_retailers UUID[],
    source          TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

-- User dismissed alerts (so we don't re-show)
CREATE TABLE ss_user_dismissed_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_id    UUID NOT NULL REFERENCES ss_safety_alerts(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, alert_id)
);

-- Counterfeit scan results (Claude Vision analysis output)
CREATE TABLE ss_counterfeit_scans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id          UUID REFERENCES ss_products(id) ON DELETE SET NULL,
    image_urls          TEXT[] NOT NULL DEFAULT '{}',
    brand_detected      TEXT,
    product_detected    TEXT,
    authenticity_score  INT CHECK (authenticity_score >= 1 AND authenticity_score <= 10),
    red_flags           JSONB NOT NULL DEFAULT '[]',
    green_flags         JSONB NOT NULL DEFAULT '[]',
    analysis_summary    TEXT,
    recommendation      TEXT,
    markers_matched     UUID[],
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add richer fields to counterfeit_reports
ALTER TABLE ss_counterfeit_reports
    ADD COLUMN IF NOT EXISTS seller_name TEXT,
    ADD COLUMN IF NOT EXISTS purchase_platform TEXT,
    ADD COLUMN IF NOT EXISTS purchase_url TEXT,
    ADD COLUMN IF NOT EXISTS brand TEXT,
    ADD COLUMN IF NOT EXISTS batch_code TEXT,
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS verified_counterfeit BOOLEAN,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add verification fields to retailers
ALTER TABLE ss_retailers
    ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS authorized_brands TEXT[],
    ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
    ADD COLUMN IF NOT EXISTS verification_notes TEXT,
    ADD COLUMN IF NOT EXISTS counterfeit_report_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;


-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE ss_batch_code_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_batch_code_verifications_select_own" ON ss_batch_code_verifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_batch_code_verifications_insert_own" ON ss_batch_code_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE ss_safety_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_safety_alerts_public_select" ON ss_safety_alerts
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

ALTER TABLE ss_user_dismissed_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_dismissed_alerts_select_own" ON ss_user_dismissed_alerts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_dismissed_alerts_insert_own" ON ss_user_dismissed_alerts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_dismissed_alerts_delete_own" ON ss_user_dismissed_alerts
    FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_counterfeit_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_counterfeit_scans_select_own" ON ss_counterfeit_scans
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_counterfeit_scans_insert_own" ON ss_counterfeit_scans
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX idx_ss_batch_code_verif_user ON ss_batch_code_verifications (user_id);
CREATE INDEX idx_ss_batch_code_verif_brand ON ss_batch_code_verifications (brand);
CREATE INDEX idx_ss_batch_code_verif_code ON ss_batch_code_verifications (batch_code);

CREATE INDEX idx_ss_safety_alerts_type ON ss_safety_alerts (alert_type);
CREATE INDEX idx_ss_safety_alerts_severity ON ss_safety_alerts (severity);
CREATE INDEX idx_ss_safety_alerts_active ON ss_safety_alerts (is_active) WHERE is_active = true;

CREATE INDEX idx_ss_user_dismissed_alerts_user ON ss_user_dismissed_alerts (user_id);
CREATE INDEX idx_ss_user_dismissed_alerts_alert ON ss_user_dismissed_alerts (alert_id);

CREATE INDEX idx_ss_counterfeit_scans_user ON ss_counterfeit_scans (user_id);
CREATE INDEX idx_ss_counterfeit_scans_product ON ss_counterfeit_scans (product_id);
CREATE INDEX idx_ss_counterfeit_scans_score ON ss_counterfeit_scans (authenticity_score);
CREATE INDEX idx_ss_counterfeit_scans_created ON ss_counterfeit_scans (created_at DESC);

-- Trigger: updated_at for counterfeit_reports
CREATE TRIGGER ss_counterfeit_reports_updated_at
    BEFORE UPDATE ON ss_counterfeit_reports
    FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
