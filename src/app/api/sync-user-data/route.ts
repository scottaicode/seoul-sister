import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    console.log('Syncing user data for:', userId)

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 })
    }

    // If profile already has WhatsApp number, check if skin profile exists
    if (profile.whatsapp_number) {
      const { data: skinProfile } = await supabase
        .from('user_skin_profiles')
        .select('*')
        .eq('whatsapp_number', profile.whatsapp_number)
        .single()

      return NextResponse.json({
        message: 'User already has WhatsApp number',
        profile,
        skinProfile: skinProfile || null
      })
    }

    // Look for any skin profiles that might belong to this user
    // (This is a fallback - in production you'd have better linking logic)
    const { data: skinProfiles, error: skinError } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .limit(5)

    if (skinError) {
      console.warn('Error searching skin profiles:', skinError)
    }

    if (skinProfiles && skinProfiles.length > 0) {
      // For demo purposes, let's link the first available skin profile
      // In production, you'd have better matching logic
      const skinProfile = skinProfiles[0]

      // Update the user profile with the WhatsApp number
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          whatsapp_number: skinProfile.whatsapp_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating profile:', updateError)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Successfully synced user data',
        profile: updatedProfile,
        skinProfile
      })
    }

    return NextResponse.json({
      message: 'No skin profile data found to sync',
      profile
    })

  } catch (error) {
    console.error('Error in sync-user-data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}