-- Migration: Create scraped_products table for price comparison data
-- Date: 2025-01-10

-- Create scraped_products table for storing real-time price data
CREATE TABLE IF NOT EXISTS public.scraped_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_english TEXT NOT NULL,
  name_korean TEXT,
  brand TEXT NOT NULL,
  seoul_price DECIMAL(10,2),
  us_price DECIMAL(10,2),
  savings_percentage DECIMAL(5,2),
  price_sources JSONB,
  last_scraped TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scraped_products_brand ON public.scraped_products(brand);
CREATE INDEX IF NOT EXISTS idx_scraped_products_last_scraped ON public.scraped_products(last_scraped DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_products_savings ON public.scraped_products(savings_percentage DESC);

-- Enable Row Level Security
ALTER TABLE public.scraped_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view scraped products" ON public.scraped_products
  FOR SELECT USING (true);

CREATE POLICY "Service can insert scraped products" ON public.scraped_products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update scraped products" ON public.scraped_products
  FOR UPDATE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.scraped_products
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Grant permissions
GRANT ALL ON public.scraped_products TO anon, authenticated;