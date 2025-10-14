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
    // Get auth token from headers
    const headersList = await headers();
    const authorization = headersList.get('authorization');

    if (!authorization) {
      return false;
    }

    // Initialize Supabase client
    const supabase = createClient(
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
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return false;
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
    // Since you mentioned all users are either paying subs or just browsing,
    // we'll check for a subscription record in your database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    return !!subscription;
  } catch (error) {
    console.error('Error checking premium access:', error);
    return false;
  }
}