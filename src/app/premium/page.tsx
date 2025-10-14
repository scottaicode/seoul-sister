import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import PremiumDashboard from '@/components/premium/PremiumDashboard';

export const metadata = {
  title: 'Premium Intelligence Dashboard | Seoul Sister',
  description: 'Your exclusive Korean beauty intelligence platform with real-time price tracking, AI recommendations, and insider access.',
};

export default async function PremiumPage() {
  // Check premium access
  const isPremium = await checkPremiumAccess();

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="max-w-lg mx-auto text-center px-6">
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full border border-luxury-gold flex items-center justify-center">
              <span className="text-3xl">💎</span>
            </div>
            <h1 className="text-4xl font-light text-white mb-4">
              PREMIUM ACCESS REQUIRED
            </h1>
            <p className="text-luxury-gray text-lg mb-8">
              Unlock exclusive Korean beauty intelligence with real-time price tracking,
              AI recommendations, and wholesale access.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between p-4 border border-luxury-gold border-opacity-20 rounded-sm">
              <span className="text-luxury-white">Bloomberg-Quality Intelligence Reports</span>
              <span className="text-luxury-gold text-sm">$8 VALUE</span>
            </div>
            <div className="flex items-center justify-between p-4 border border-luxury-gold border-opacity-20 rounded-sm">
              <span className="text-luxury-white">Real-Time Price Comparison Engine</span>
              <span className="text-luxury-gold text-sm">$15 VALUE</span>
            </div>
            <div className="flex items-center justify-between p-4 border border-luxury-gold border-opacity-20 rounded-sm">
              <span className="text-luxury-white">AI Skin Analysis & Recommendations</span>
              <span className="text-luxury-gold text-sm">$5 VALUE</span>
            </div>
            <div className="flex items-center justify-between p-4 border border-luxury-gold border-opacity-20 rounded-sm">
              <span className="text-luxury-white">Korean Wholesale Access</span>
              <span className="text-luxury-gold text-sm">$7 VALUE</span>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-luxury-gray text-sm mb-4">
              <span className="line-through">$45 VALUE</span> → <span className="text-luxury-gold font-medium">$20/MONTH</span>
            </p>
            <p className="text-luxury-gold text-xs uppercase tracking-wider">
              7-DAY FREE TRIAL • CANCEL ANYTIME
            </p>
          </div>

          <button className="w-full bg-transparent border border-luxury-gold text-luxury-gold py-4 px-8 text-sm uppercase tracking-wider font-light hover:bg-luxury-gold hover:text-black transition-all duration-300">
            START FREE TRIAL
          </button>
        </div>
      </div>
    );
  }

  return <PremiumDashboard />;
}

async function checkPremiumAccess(): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const headersList = await headers();
    const authorization = headersList.get('authorization');

    if (!authorization) {
      return true; // For development/testing
    }

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

    const { data: { user }, error } = await userSupabase.auth.getUser();

    if (error || !user?.email) {
      return true; // For development/testing
    }

    // Admin accounts with free access
    const privilegedUsers = [
      'vibetrendai@gmail.com',
      'baileydonmartin@gmail.com',
      'test@email.com'
    ];

    if (privilegedUsers.includes(user.email)) {
      return true;
    }

    // Check for active subscription
    const { data: subscription } = await supabase
      .from('premium_subscriptions')
      .select('status, trial_end')
      .eq('user_id', user.id)
      .in('status', ['trialing', 'active'])
      .single();

    return !!subscription;
  } catch (error) {
    console.error('Error checking premium access:', error);
    return true; // For development/testing
  }
}