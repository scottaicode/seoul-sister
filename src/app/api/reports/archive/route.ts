import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category');

    // Build query
    let query = supabase
      .from('beauty_intelligence_reports')
      .select(`
        id,
        report_date,
        title,
        subtitle,
        executive_summary,
        view_count,
        save_count,
        published_at
      `)
      .not('published_at', 'is', null)
      .order('report_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: reports, error } = await query;

    if (error) {
      console.error('Error fetching archive:', error);
      return NextResponse.json({ reports: [] });
    }

    // Get categories for each report
    const reportsWithCategories = await Promise.all(
      (reports || []).map(async (report) => {
        const { data: categories } = await supabase
          .from('report_category_links')
          .select('category_id, report_categories(name, slug)')
          .eq('report_id', report.id);

        return {
          ...report,
          categories: categories?.map(c => c.report_categories?.slug).filter(Boolean) || []
        };
      })
    );

    return NextResponse.json({
      reports: reportsWithCategories,
      total: reports?.length || 0
    });
  } catch (error) {
    console.error('Error in archive endpoint:', error);
    return NextResponse.json({
      reports: [],
      total: 0
    });
  }
}