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
    const headersList = headers();
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

    if (error || !user) {
      return false;
    }

    // Check premium status (you would implement this based on your subscription logic)
    // For now, we'll return true for authenticated users
    return true;
  } catch (error) {
    console.error('Error checking premium access:', error);
    return false;
  }
}