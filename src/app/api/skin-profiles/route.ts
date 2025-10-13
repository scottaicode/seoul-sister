import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { SkinProfileData, SkinType, SkinConcern, ProductCategory } from '@/types/skin-analysis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const whatsappNumber = searchParams.get('whatsapp_number')

    if (!whatsappNumber) {
      return NextResponse.json({ error: 'WhatsApp number is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .eq('whatsapp_number', whatsappNumber)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching skin profile:', error)
      return NextResponse.json({ error: 'Failed to fetch skin profile' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ profile: null })
    }

    return NextResponse.json({ profile: data })

  } catch (error) {
    console.error('Error in GET /api/skin-profiles:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      whatsappNumber,
      currentSkinType,
      skinConcerns = [],
      preferredCategories = []
    } = body

    if (!whatsappNumber) {
      return NextResponse.json({ error: 'WhatsApp number is required' }, { status: 400 })
    }

    const { data, error }: { data: any, error: any } = await supabase
      .from('user_skin_profiles')
      .upsert({
        whatsapp_number: whatsappNumber,
        current_skin_type: currentSkinType,
        skin_concerns: skinConcerns,
        preferred_categories: preferredCategories,
        last_analysis_date: new Date().toISOString()
      } as any, {
        onConflict: 'whatsapp_number'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating/updating skin profile:', error)
      return NextResponse.json({ error: 'Failed to save skin profile' }, { status: 500 })
    }

    return NextResponse.json({ profile: data })

  } catch (error) {
    console.error('Error in POST /api/skin-profiles:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      whatsappNumber,
      currentSkinType,
      skinConcerns,
      preferredCategories
    } = body

    if (!id && !whatsappNumber) {
      return NextResponse.json({ error: 'ID or WhatsApp number is required' }, { status: 400 })
    }

    let query = supabase.from('user_skin_profiles').update({
      current_skin_type: currentSkinType,
      skin_concerns: skinConcerns,
      preferred_categories: preferredCategories,
      last_analysis_date: new Date().toISOString()
    } as any)

    if (id) {
      query = query.eq('id', id)
    } else {
      query = query.eq('whatsapp_number', whatsappNumber)
    }

    const { data, error } = await query.select().single()

    if (error) {
      console.error('Error updating skin profile:', error)
      return NextResponse.json({ error: 'Failed to update skin profile' }, { status: 500 })
    }

    return NextResponse.json({ profile: data })

  } catch (error) {
    console.error('Error in PUT /api/skin-profiles:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}