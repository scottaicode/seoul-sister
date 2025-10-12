import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Create or update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata.name || data.user.user_metadata.full_name,
          skin_concerns: [],
          ingredient_allergies: [],
          preferred_ingredients: [],
          ingredients_to_avoid: [],
          price_range_min: 0,
          price_range_max: 100,
          product_history: {},
          skin_analysis_history: {},
          recommendation_feedback: {}
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
    }
  }

  // Redirect to homepage or dashboard
  return NextResponse.redirect(`${origin}/`)
}