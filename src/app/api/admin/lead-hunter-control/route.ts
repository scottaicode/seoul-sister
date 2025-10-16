import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In a production environment, this would be stored in a database
// For now, we'll use a simple in-memory store
let systemConfig = {
  enabled: false,
  last_run: 'Never',
  auto_engagement: false,
  max_daily_conversations: 50,
  safety_mode: true
};

export async function GET() {
  try {
    // Get system statistics from database
    const stats = await getSystemStats();

    return NextResponse.json({
      success: true,
      system_status: {
        enabled: systemConfig.enabled,
        last_run: systemConfig.last_run,
        total_conversations_detected: stats.total_conversations || 0,
        leads_generated: stats.total_leads || 0,
        conversion_rate: stats.conversion_rate || 0,
        system_health: systemConfig.enabled ? 'good' : 'disabled'
      },
      config: systemConfig,
      safety_notice: 'System is currently configured for safe operation. Real engagement disabled until Seoul Sister website is production-ready.'
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get system status'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, config } = await request.json();

    console.log(`🔧 AI Lead Hunter Admin: ${action}`);

    switch (action) {
      case 'enable':
        systemConfig.enabled = true;
        systemConfig.last_run = new Date().toISOString();
        console.log('✅ AI Lead Hunter system ENABLED');
        break;

      case 'disable':
        systemConfig.enabled = false;
        console.log('🚫 AI Lead Hunter system DISABLED');
        break;

      case 'update_config':
        systemConfig = { ...systemConfig, ...config };
        console.log('⚙️ AI Lead Hunter configuration updated');
        break;

      case 'reset_stats':
        await resetSystemStats();
        console.log('🔄 AI Lead Hunter statistics reset');
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

    // Log the action
    await logAdminAction(action);

    return NextResponse.json({
      success: true,
      message: `AI Lead Hunter ${action} completed successfully`,
      system_status: {
        enabled: systemConfig.enabled,
        last_run: systemConfig.last_run,
        safety_mode: systemConfig.safety_mode
      },
      safety_notice: systemConfig.enabled ?
        'CAUTION: System is now active. Monitor lead generation carefully.' :
        'System safely disabled. No automatic lead generation will occur.'
    });

  } catch (error) {
    console.error('❌ AI Lead Hunter Admin Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getSystemStats() {
  try {
    // Get analytics from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: analytics, error } = await supabase
      .from('lead_hunter_analytics')
      .select('*')
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching analytics:', error);
      return { total_conversations: 0, total_leads: 0, conversion_rate: 0 };
    }

    const totalConversations = analytics?.reduce((sum, day) => sum + (day.opportunities_detected || 0), 0) || 0;
    const totalLeads = analytics?.reduce((sum, day) => sum + (day.leads_qualified || 0), 0) || 0;
    const conversionRate = totalConversations > 0 ? Math.round((totalLeads / totalConversations) * 100) : 0;

    return {
      total_conversations: totalConversations,
      total_leads: totalLeads,
      conversion_rate: conversionRate
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    return { total_conversations: 0, total_leads: 0, conversion_rate: 0 };
  }
}

async function resetSystemStats() {
  try {
    // In a real implementation, you might want to archive rather than delete
    await supabase.from('lead_hunter_analytics').delete().gte('id', 0);
    await supabase.from('reddit_conversation_opportunities').delete().gte('id', 0);
    await supabase.from('ai_generated_leads').delete().gte('id', 0);

    console.log('📊 System statistics reset successfully');
  } catch (error) {
    console.error('Error resetting stats:', error);
  }
}

async function logAdminAction(action: string) {
  try {
    // Log admin actions for audit trail
    const logEntry = {
      action,
      timestamp: new Date().toISOString(),
      system_status: systemConfig.enabled ? 'enabled' : 'disabled'
    };

    // In a real implementation, store this in a dedicated admin_logs table
    console.log('📝 Admin action logged:', logEntry);
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// System config getter function (not exported from route)
function getSystemConfig() {
  return systemConfig;
}