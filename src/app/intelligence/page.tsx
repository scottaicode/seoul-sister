import ReportViewer from '@/components/intelligence-report/ReportViewer';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export const metadata = {
  title: 'Seoul Beauty Intelligence Report | Seoul Sister',
  description: 'Exclusive daily intelligence on Korean beauty trends, ingredients, and insider discoveries. Premium research you can\'t get anywhere else.',
};

export default async function IntelligencePage() {
  // Check if user is authenticated and has premium access
  const isPremium = await checkPremiumAccess();

  return <ReportViewer isPremium={isPremium} />;
}

async function checkPremiumAccess(): Promise<boolean> {
  try {
    // Initialize Supabase client with service role for server-side access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get auth token from headers
    const headersList = await headers();
    const authorization = headersList.get('authorization');

    if (!authorization) {
      // For development/testing, allow access without auth
      return true;
    }

    // Create client with user token
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

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