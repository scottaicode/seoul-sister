import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = createClient();

    // Get trending ingredients data
    const { data: ingredients, error } = await supabase
      .from('trending_ingredients')
      .select('*')
      .order('trend_score', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching trending ingredients:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ingredients: ingredients || [],
      count: ingredients?.length || 0,
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in trending ingredients API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const {
      ingredient_name,
      trend_score,
      weekly_growth_percentage,
      monthly_growth_percentage,
      data_source
    } = body;

    // Validate required fields
    if (!ingredient_name || !trend_score) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: ingredient_name, trend_score'
      }, { status: 400 });
    }

    // Insert or update trending ingredient
    const { data, error } = await (supabase as any)
      .from('trending_ingredients')
      .upsert({
        ingredient_name,
        trend_score,
        weekly_growth_percentage: weekly_growth_percentage || 0,
        monthly_growth_percentage: monthly_growth_percentage || 0,
        data_source: data_source || 'manual_input',
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'ingredient_name'
      });

    if (error) {
      throw new Error(`Failed to update trending ingredient: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Trending ingredient updated successfully',
      data
    });

  } catch (error) {
    console.error('Error updating trending ingredient:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}