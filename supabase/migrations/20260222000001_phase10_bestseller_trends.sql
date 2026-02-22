-- Phase 10.1: Real-Time Trend Intelligence — Olive Young Bestseller Scraper
-- Restructures ss_trending_products for real external data and creates tracking table
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Make product_id nullable (bestseller products may not be in our DB yet)
ALTER TABLE ss_trending_products ALTER COLUMN product_id DROP NOT NULL;

-- 2. Add new columns for external source tracking
ALTER TABLE ss_trending_products
  ADD COLUMN IF NOT EXISTS source_product_name TEXT,
  ADD COLUMN IF NOT EXISTS source_product_brand TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS rank_position INTEGER,
  ADD COLUMN IF NOT EXISTS previous_rank_position INTEGER,
  ADD COLUMN IF NOT EXISTS rank_change INTEGER,
  ADD COLUMN IF NOT EXISTS days_on_list INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS gap_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_date DATE,
  ADD COLUMN IF NOT EXISTS raw_data JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Indexes for efficient trend queries
CREATE INDEX IF NOT EXISTS idx_trending_source_score
  ON ss_trending_products(source, trend_score DESC);

CREATE INDEX IF NOT EXISTS idx_trending_data_date
  ON ss_trending_products(data_date DESC);

CREATE INDEX IF NOT EXISTS idx_trending_rank
  ON ss_trending_products(source, rank_position ASC)
  WHERE rank_position IS NOT NULL;

-- 4. Create ss_trend_data_sources to track scrape history
CREATE TABLE IF NOT EXISTS ss_trend_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  scrape_type TEXT NOT NULL CHECK (scrape_type IN ('bestseller', 'reddit', 'hwahae', 'manual')),
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  items_scraped INTEGER DEFAULT 0,
  items_matched INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trend_sources_source
  ON ss_trend_data_sources(source, started_at DESC);

-- RLS: public read on trend data sources, service role writes
ALTER TABLE ss_trend_data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read trend data sources"
  ON ss_trend_data_sources FOR SELECT USING (true);

-- 5. Delete fabricated seed data from ss_trending_products
DELETE FROM ss_trending_products WHERE created_at < '2026-02-20';
