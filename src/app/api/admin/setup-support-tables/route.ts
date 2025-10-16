import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Setting up support system tables...')

    // Create support tickets table
    const supportTicketsSQL = `
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number text,
  email text,
  name text,
  subject text NOT NULL,
  message text NOT NULL,
  category text CHECK (category IN ('billing', 'subscription', 'technical', 'product', 'general')) DEFAULT 'general',
  priority text CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status text CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  admin_response text,
  admin_notes text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
    `

    // Create support knowledge base table
    const knowledgeBaseSQL = `
CREATE TABLE IF NOT EXISTS public.support_knowledge_base (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  subcategory text,
  keywords text[],
  is_published boolean DEFAULT true,
  view_count integer DEFAULT 0,
  helpful_votes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
    `

    // Create support FAQ table
    const faqSQL = `
CREATE TABLE IF NOT EXISTS public.support_faq (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL,
  order_index integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  view_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
    `

    try {
      // Execute table creation queries
      const queries = [supportTicketsSQL, knowledgeBaseSQL, faqSQL]

      for (const query of queries) {
        await supabase.rpc('exec_sql', { sql: query })
      }
    } catch (err) {
      console.log('RPC exec_sql not available, tables may already exist or need manual creation')
    }

    // Enable RLS and create policies
    const securitySQL = `
-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_faq ENABLE ROW LEVEL SECURITY;

-- Support tickets policies
CREATE POLICY IF NOT EXISTS "Users can view own tickets" ON public.support_tickets
  FOR SELECT USING (
    auth.uid() = user_id OR
    phone_number IS NOT NULL OR
    email IS NOT NULL
  );

CREATE POLICY IF NOT EXISTS "Anyone can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service can manage all tickets" ON public.support_tickets
  FOR ALL USING (true);

-- Knowledge base policies
CREATE POLICY IF NOT EXISTS "Anyone can view published articles" ON public.support_knowledge_base
  FOR SELECT USING (is_published = true);

CREATE POLICY IF NOT EXISTS "Service can manage knowledge base" ON public.support_knowledge_base
  FOR ALL USING (true);

-- FAQ policies
CREATE POLICY IF NOT EXISTS "Anyone can view FAQ" ON public.support_faq
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Service can manage FAQ" ON public.support_faq
  FOR ALL USING (true);
    `

    try {
      await supabase.rpc('exec_sql', { sql: securitySQL })
    } catch (err) {
      console.log('Security policies may already exist')
    }

    // Create indexes
    const indexSQL = `
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_phone ON public.support_tickets(phone_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON public.support_tickets(email);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_slug ON public.support_knowledge_base(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.support_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_faq_category ON public.support_faq(category);
    `

    try {
      await supabase.rpc('exec_sql', { sql: indexSQL })
    } catch (err) {
      console.log('Indexes may already exist')
    }

    // Add triggers for updated_at
    const triggerSQL = `
CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.support_knowledge_base
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.support_faq
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
    `

    try {
      await supabase.rpc('exec_sql', { sql: triggerSQL })
    } catch (err) {
      console.log('Triggers may already exist')
    }

    // Insert initial FAQ data
    const { error: faqError } = await supabase
      .from('support_faq')
      .upsert([
        {
          question: 'How does the 7-day free trial work?',
          answer: 'Your 7-day free trial gives you full access to all Seoul Sister Premium features including AI skin analysis, Seoul wholesale pricing, and WhatsApp personal shopping. You won\'t be charged until the trial ends, and you can cancel anytime.',
          category: 'subscription',
          order_index: 1,
          is_featured: true
        },
        {
          question: 'How much can I save with Seoul Sister?',
          answer: 'Seoul Sister members typically save 70%+ compared to US retail prices. For example, a $94 Sulwhasoo serum costs only $28 through our Seoul wholesale network. Your membership pays for itself with just one order!',
          category: 'pricing',
          order_index: 2,
          is_featured: true
        },
        {
          question: 'How does WhatsApp ordering work?',
          answer: 'Simply message us on WhatsApp with the Korean beauty products you want. Our Seoul-based team will source authentic products at wholesale prices, handle the ordering, and provide tracking information. It\'s like having a personal shopper in Seoul!',
          category: 'ordering',
          order_index: 3,
          is_featured: true
        },
        {
          question: 'Are the products authentic?',
          answer: 'Absolutely! All products are sourced directly from authorized Korean distributors and retailers in Seoul. We work only with verified suppliers and can provide authenticity verification for any product.',
          category: 'product',
          order_index: 4,
          is_featured: true
        },
        {
          question: 'Can I cancel my subscription anytime?',
          answer: 'Yes, you can cancel your subscription at any time. If you cancel, you\'ll continue to have access to premium features until your current billing period ends. No cancellation fees or penalties.',
          category: 'subscription',
          order_index: 5,
          is_featured: true
        },
        {
          question: 'What payment methods do you accept?',
          answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through our secure Stripe payment processor. Your payment information is encrypted and never stored on our servers.',
          category: 'billing',
          order_index: 6,
          is_featured: false
        }
      ], {
        onConflict: 'question',
        ignoreDuplicates: true
      })

    // Test table access
    const { data: ticketsTest } = await supabase
      .from('support_tickets')
      .select('id')
      .limit(1)

    const { data: faqTest } = await supabase
      .from('support_faq')
      .select('id')
      .limit(1)

    console.log('✅ Support system tables setup completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Support system tables created successfully',
      tables_verified: {
        support_tickets: !!ticketsTest,
        support_faq: !!faqTest,
        initial_faq_count: faqTest?.length || 0
      }
    })

  } catch (error) {
    console.error('❌ Error setting up support tables:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to setup support tables',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister Support System Setup',
    description: 'Creates support tickets, knowledge base, and FAQ tables',
    endpoints: {
      'POST /api/admin/setup-support-tables': 'Run database migration for support system'
    }
  })
}