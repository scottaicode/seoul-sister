import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // Get current view count first
    const { data: currentReport } = await supabase
      .from('beauty_intelligence_reports')
      .select('view_count')
      .eq('id', reportId)
      .single();

    // Increment view count
    const { data, error } = await supabase
      .from('beauty_intelligence_reports')
      .update({
        view_count: (currentReport?.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select('view_count')
      .single();

    if (error) {
      console.error('Error updating view count:', error);
      return NextResponse.json({ error: 'Failed to update view count' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      view_count: data?.view_count || 0
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}