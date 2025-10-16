-- Migration: Add GDPR compliance tables and features
-- Created: 2025-01-16

-- Create GDPR deletion requests table
CREATE TABLE IF NOT EXISTS public.gdpr_deletion_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  email text,
  phone_number text,
  request_type text CHECK (request_type IN ('full_deletion', 'account_only')) DEFAULT 'full_deletion',
  reason text,
  status text CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  requested_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create cookie consent tracking table
CREATE TABLE IF NOT EXISTS public.cookie_consent (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id text,
  ip_address inet,
  necessary boolean DEFAULT true,
  analytics boolean DEFAULT false,
  marketing boolean DEFAULT false,
  consent_timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  consent_version text DEFAULT '1.0',
  user_agent text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create data processing log table for GDPR audit trail
CREATE TABLE IF NOT EXISTS public.data_processing_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  processing_type text NOT NULL, -- 'data_access', 'data_export', 'data_deletion', 'data_modification'
  legal_basis text, -- 'consent', 'contract', 'legitimate_interest', 'legal_obligation'
  purpose text NOT NULL,
  data_categories text[], -- ['personal_data', 'photos', 'preferences', 'analytics']
  processor text, -- 'seoul_sister', 'stripe', 'supabase', 'claude_ai'
  retention_period text,
  processed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE public.gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cookie_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_processing_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for GDPR deletion requests
CREATE POLICY IF NOT EXISTS "Users can view own deletion requests" ON public.gdpr_deletion_requests
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY IF NOT EXISTS "Service can manage deletion requests" ON public.gdpr_deletion_requests
  FOR ALL USING (true);

-- RLS policies for cookie consent
CREATE POLICY IF NOT EXISTS "Users can view own consent" ON public.cookie_consent
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own consent" ON public.cookie_consent
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can modify own consent" ON public.cookie_consent
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all consent" ON public.cookie_consent
  FOR ALL USING (true);

-- RLS policies for data processing log
CREATE POLICY IF NOT EXISTS "Users can view own processing log" ON public.data_processing_log
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY IF NOT EXISTS "Service can manage processing log" ON public.data_processing_log
  FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_user_id ON public.gdpr_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_status ON public.gdpr_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requested_at ON public.gdpr_deletion_requests(requested_at);

CREATE INDEX IF NOT EXISTS idx_cookie_consent_user_id ON public.cookie_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_session_id ON public.cookie_consent(session_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_timestamp ON public.cookie_consent(consent_timestamp);

CREATE INDEX IF NOT EXISTS idx_data_processing_user_id ON public.data_processing_log(user_id);
CREATE INDEX IF NOT EXISTS idx_data_processing_type ON public.data_processing_log(processing_type);
CREATE INDEX IF NOT EXISTS idx_data_processing_timestamp ON public.data_processing_log(processed_at);

-- Add triggers for updated_at
CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.gdpr_deletion_requests
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Add privacy compliance fields to profiles table if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gdpr_consent_given boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS gdpr_consent_timestamp timestamp with time zone,
ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS data_retention_expires timestamp with time zone;

-- Create function to log data processing activities
CREATE OR REPLACE FUNCTION log_data_processing(
  p_user_id uuid,
  p_processing_type text,
  p_legal_basis text,
  p_purpose text,
  p_data_categories text[] DEFAULT ARRAY['personal_data'],
  p_processor text DEFAULT 'seoul_sister',
  p_retention_period text DEFAULT '7 years'
) RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.data_processing_log (
    user_id,
    processing_type,
    legal_basis,
    purpose,
    data_categories,
    processor,
    retention_period
  ) VALUES (
    p_user_id,
    p_processing_type,
    p_legal_basis,
    p_purpose,
    p_data_categories,
    p_processor,
    p_retention_period
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION log_data_processing TO authenticated;
GRANT EXECUTE ON FUNCTION log_data_processing TO anon;