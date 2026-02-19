-- Phase 9.1: Product Pipeline Staging Tables
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Staging table for raw scraped data (before AI processing)
CREATE TABLE ss_product_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  raw_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'duplicate')),
  processed_product_id UUID REFERENCES ss_products(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_id)
);

CREATE INDEX idx_staging_status ON ss_product_staging(status);
CREATE INDEX idx_staging_source ON ss_product_staging(source, source_id);
CREATE INDEX idx_staging_created ON ss_product_staging(created_at DESC);

-- Track pipeline runs
CREATE TABLE ss_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('full_scrape', 'incremental', 'reprocess', 'quality_check')),
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  products_scraped INTEGER DEFAULT 0,
  products_processed INTEGER DEFAULT 0,
  products_failed INTEGER DEFAULT 0,
  products_duplicates INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4),
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_pipeline_runs_status ON ss_pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_source ON ss_pipeline_runs(source);

-- Trigger for updated_at on staging
CREATE TRIGGER ss_product_staging_updated_at
  BEFORE UPDATE ON ss_product_staging
  FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
