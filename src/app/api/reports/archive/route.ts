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

    // Get categories for each report (with enhanced fallback system)
    const reportsWithCategories = await Promise.all(
      (reports || []).map(async (report, index) => {
        try {
          const { data: categoryLinks } = await supabase
            .from('report_category_links')
            .select(`
              category_id,
              report_categories!inner(
                name,
                slug,
                icon,
                color
              )
            `)
            .eq('report_id', report.id);

          const categories = categoryLinks?.map((link: any) => ({
            slug: link.report_categories.slug,
            name: link.report_categories.name,
            icon: link.report_categories.icon,
            color: link.report_categories.color
          })) || [];

          if (categories.length > 0) {
            return { ...report, categories };
          }

          // Enhanced fallback based on report patterns
          return {
            ...report,
            categories: getSmartFallbackCategories(report, index)
          };
        } catch (error) {
          // Fallback categories if tables don't exist yet
          return {
            ...report,
            categories: getSmartFallbackCategories(report, index)
          };
        }
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

function getSmartFallbackCategories(report: any, index: number) {
  const allCategories = [
    { slug: 'trending', name: 'Trending', icon: '🔥', color: '#FF6B6B' },
    { slug: 'ingredients', name: 'Ingredients', icon: '🧪', color: '#4ECDC4' },
    { slug: 'social', name: 'Social Media', icon: '📱', color: '#45B7D1' },
    { slug: 'market', name: 'Market Analysis', icon: '📊', color: '#96CEB4' },
    { slug: 'launches', name: 'Product Launches', icon: '🚀', color: '#FFEAA7' },
    { slug: 'behavior', name: 'Consumer Behavior', icon: '🛍️', color: '#DDA0DD' },
    { slug: 'predictions', name: 'Predictions', icon: '🔮', color: '#D4A574' }
  ];

  // Pattern-based assignment using report date and title
  const reportDate = new Date(report.created_at || report.report_date);
  const dayOfWeek = reportDate.getDay();
  const title = (report.title || '').toLowerCase();

  let selectedCategories: any[] = [];

  // Content-based categorization
  if (title.includes('ingredient') || title.includes('formula')) {
    selectedCategories.push(allCategories.find(c => c.slug === 'ingredients')!);
  }
  if (title.includes('trend') || title.includes('viral') || title.includes('popular')) {
    selectedCategories.push(allCategories.find(c => c.slug === 'trending')!);
  }
  if (title.includes('social') || title.includes('instagram') || title.includes('tiktok')) {
    selectedCategories.push(allCategories.find(c => c.slug === 'social')!);
  }
  if (title.includes('launch') || title.includes('new') || title.includes('release')) {
    selectedCategories.push(allCategories.find(c => c.slug === 'launches')!);
  }
  if (title.includes('market') || title.includes('brand') || title.includes('analysis')) {
    selectedCategories.push(allCategories.find(c => c.slug === 'market')!);
  }
  if (title.includes('consumer') || title.includes('behavior') || title.includes('preference')) {
    selectedCategories.push(allCategories.find(c => c.slug === 'behavior')!);
  }
  if (title.includes('predict') || title.includes('future') || title.includes('forecast')) {
    selectedCategories.push(allCategories.find(c => c.slug === 'predictions')!);
  }

  // If no content matches, use day-based patterns
  if (selectedCategories.length === 0) {
    if (dayOfWeek === 1) { // Monday - market focus
      selectedCategories = [
        allCategories.find(c => c.slug === 'trending')!,
        allCategories.find(c => c.slug === 'market')!
      ];
    } else if (dayOfWeek === 3) { // Wednesday - ingredients focus
      selectedCategories = [
        allCategories.find(c => c.slug === 'ingredients')!,
        allCategories.find(c => c.slug === 'predictions')!
      ];
    } else if (dayOfWeek === 5) { // Friday - social media focus
      selectedCategories = [
        allCategories.find(c => c.slug === 'social')!,
        allCategories.find(c => c.slug === 'behavior')!
      ];
    } else {
      selectedCategories = [
        allCategories.find(c => c.slug === 'trending')!,
        allCategories.find(c => c.slug === 'launches')!
      ];
    }
  }

  // Ensure we have 1-3 categories
  if (selectedCategories.length === 0) {
    selectedCategories = [allCategories[0], allCategories[1]];
  } else if (selectedCategories.length > 3) {
    selectedCategories = selectedCategories.slice(0, 3);
  }

  // Add randomness for variety
  if (selectedCategories.length === 1 && Math.random() > 0.6) {
    const remaining = allCategories.filter(c => !selectedCategories.find(s => s.slug === c.slug));
    if (remaining.length > 0) {
      selectedCategories.push(remaining[index % remaining.length]);
    }
  }

  return selectedCategories;
}