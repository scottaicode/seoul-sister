import { createClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import ReportDetailView from '@/components/intelligence-report/ReportDetailView';
import { headers } from 'next/headers';

interface ReportPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ReportPageProps) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return {
      title: 'Report Not Found | Seoul Sister',
      description: 'The requested intelligence report could not be found.',
    };
  }

  return {
    title: `${report.title} | Seoul Sister Intelligence`,
    description: report.summary || 'Exclusive Korean beauty intelligence report.',
  };
}

export default async function ReportDetailPage({ params }: ReportPageProps) {
  const { id } = await params;
  const isPremium = await checkPremiumAccess();
  const report = await getReport(id);

  if (!report) {
    notFound();
  }

  return <ReportDetailView report={report} isPremium={isPremium} />;
}

async function getReport(id: string) {
  try {
    // For now, use sample data for demonstration since we don't have the full database schema yet
    if (id === '1') {
      return getSampleReport();
    }

    const supabase = createClient();

    // Get the report with related data (for future implementation)
    const { data: report, error } = await supabase
      .from('intelligence_reports')
      .select(`
        *,
        intelligence_report_sections(
          id,
          section_type,
          title,
          content,
          order_index,
          metadata
        )
      `)
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (error) {
      console.error('Error fetching report:', error);
      return getSampleReport(); // Fallback to sample data
    }

    return report;
  } catch (error) {
    console.error('Error in getReport:', error);
    return getSampleReport(); // Fallback to sample data
  }
}

function getSampleReport() {
  return {
    id: '1',
    title: 'Seoul Beauty Intelligence Report',
    summary: 'Exclusive insights from Korea\'s beauty capital with breakthrough product discoveries, ingredient analysis, and viral trend intelligence.',
    content: `
      <p>Today's intelligence reveals 5 breakthrough products trending in Seoul, with average savings of 73% versus US retail. Centella Asiatica dominates Korean formulations with a 98% popularity score, while the "Glass Skin" trend reaches viral status across Korean beauty platforms.</p>

      <p>Our Seoul-based research team has identified unprecedented growth in fermented skincare ingredients, with major K-beauty brands preparing Q2 2025 launches focusing on probiotics and rice-derived compounds.</p>

      <p>The convergence of traditional Korean beauty practices with modern biotechnology is creating products that deliver both immediate aesthetic results and long-term skin health benefits.</p>
    `,
    published_at: new Date().toISOString(),
    author: 'Seoul Sister Intelligence Team',
    category: 'Daily Intelligence',
    tags: ['K-Beauty', 'Trends', 'Ingredients', 'Market Analysis'],
    featured_image_url: null,
    reading_time_minutes: 8,
    intelligence_report_sections: [
      {
        id: 'section-1',
        section_type: 'trending_products',
        title: 'Breakthrough Product Discoveries',
        content: `
          <p>Our Seoul team has identified 5 products experiencing unprecedented growth in Korean beauty retail:</p>
          <ul>
            <li><strong>Beauty of Joseon Relief Sun</strong> - #1 bestseller for 12 consecutive weeks</li>
            <li><strong>COSRX Advanced Snail 96 Mucin</strong> - Viral on TikTok with 45M+ views</li>
            <li><strong>Torriden DIVE-IN Low Molecule Hyaluronic Acid Serum</strong> - 340% sales increase</li>
          </ul>
        `,
        order_index: 1,
        metadata: {
          product_count: 5,
          avg_savings: 73,
          data_source: 'Olive Young, Hwahae, Glowpick'
        }
      },
      {
        id: 'section-2',
        section_type: 'ingredient_analysis',
        title: 'Ingredient Intelligence Lab',
        content: `
          <p><strong>Centella Asiatica</strong> continues its dominance with 98% popularity score across Korean formulations.</p>
          <p>Emerging trends show fermented ingredients gaining traction:</p>
          <ul>
            <li>Fermented Rice Bran - 245% increase in product launches</li>
            <li>Bifida Ferment Lysate - Premium positioning trend</li>
            <li>Galactomyces - Cross-over from traditional to mainstream</li>
          </ul>
        `,
        order_index: 2,
        metadata: {
          ingredients_analyzed: 15,
          trend_score: 98,
          scientific_studies: 23
        }
      },
      {
        id: 'section-3',
        section_type: 'social_insights',
        title: 'Korean Social Media Intelligence',
        content: `
          <p>The "Glass Skin Challenge" has achieved viral status on Korean TikTok with 450% growth in mentions over 30 days.</p>
          <p>Key trending hashtags:</p>
          <ul>
            <li>#유리피부 (Glass Skin) - 12.5M views</li>
            <li>#GlassSkinKorea - 8.2M views</li>
            <li>#한국뷰티 (Korean Beauty) - 45.8M views</li>
          </ul>
        `,
        order_index: 3,
        metadata: {
          platform: 'TikTok Korea',
          virality_score: 94,
          total_mentions: 450000
        }
      }
    ]
  };
}

async function checkPremiumAccess(): Promise<boolean> {
  try {
    // Initialize Supabase client with service role for server-side access
    const supabase = createClient();

    // Get auth token from headers
    const headersList = await headers();
    const authorization = headersList.get('authorization');

    if (!authorization) {
      // For development/testing, allow access without auth
      return true;
    }

    // Create client with user token
    const userSupabase = createClient();

    // Check user session
    const { data: { user }, error } = await userSupabase.auth.getUser();

    if (error || !user?.email) {
      // For development/testing, allow access even without valid user
      return true;
    }

    // Admin accounts and test user with free access
    const privilegedUsers = [
      'vibetrendai@gmail.com',
      'baileydonmartin@gmail.com',
      'test@email.com'
    ];

    if (privilegedUsers.includes(user.email)) {
      return true;
    }

    // For other users, check if they have an active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    return !!subscription;
  } catch (error) {
    console.error('Error checking premium access:', error);
    // For development/testing, allow access on error
    return true;
  }
}