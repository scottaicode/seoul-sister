import { NextRequest, NextResponse } from 'next/server';
import { IntelligenceReportGenerator } from '@/lib/intelligence-report/generator';
import { createClient } from '@supabase/supabase-js';

// This endpoint will be called daily by Vercel Cron
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if today's report already exists
    const today = new Date().toISOString().split('T')[0];
    const { data: existingReport } = await supabase
      .from('beauty_intelligence_reports')
      .select('id')
      .eq('report_date', today)
      .single();

    if (existingReport) {
      return NextResponse.json({
        message: 'Report already exists for today',
        reportId: existingReport.id
      });
    }

    // Generate new report
    const generator = new IntelligenceReportGenerator();
    const report = await generator.generateDailyReport();
    const reportId = await generator.saveReportToDatabase(report);

    // Send notification to admin (optional)
    await notifyAdminOfNewReport(reportId, report.title);

    return NextResponse.json({
      success: true,
      message: 'Daily intelligence report generated successfully',
      reportId: reportId,
      reportDate: today
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error },
      { status: 500 }
    );
  }
}

async function notifyAdminOfNewReport(reportId: string, title: string) {
  // You could implement email notification here
  // For now, just log it
  console.log(`New intelligence report generated: ${title} (ID: ${reportId})`);

  // Optional: Send to Discord/Slack webhook
  if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `📊 **New Seoul Beauty Intelligence Report**\n${title}\n\nView at: https://seoulsister.com/intelligence`
        })
      });
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }
}