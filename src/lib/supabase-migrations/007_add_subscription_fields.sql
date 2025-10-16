-- Add subscription management fields to profiles table
-- This migration adds all necessary fields for Stripe subscription management

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text CHECK (subscription_status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_start timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON public.profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);

-- Create user_profiles table to match existing API endpoints
-- This table will serve as a compatibility layer for WhatsApp-based interactions
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  email text,
  phone text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text CHECK (subscription_status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  trial_end timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Service can manage user_profiles" ON public.user_profiles
  FOR ALL USING (true);

-- Add trigger for updated_at on user_profiles
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON public.user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription_id ON public.user_profiles(stripe_subscription_id);

-- Grant permissions
GRANT ALL ON public.user_profiles TO anon, authenticated;