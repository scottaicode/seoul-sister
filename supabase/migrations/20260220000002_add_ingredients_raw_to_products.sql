-- Phase 9.2: Add ingredients_raw column to ss_products for raw INCI storage
-- Used by batch processor during Sonnet extraction; consumed by Phase 9.3 ingredient linker
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS ingredients_raw TEXT;
