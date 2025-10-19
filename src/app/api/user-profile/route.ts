import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { CreateUserProfileRequest, UpdateUserProfileRequest, UserProfile } from '@/types/user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/user-profile?email=user@example.com
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userId = searchParams.get('id')

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email or user ID is required' },
        { status: 400 }
      )
    }

    const query = supabase
      .from('profiles')
      .select('*')

    if (email) {
      query.eq('email', email)
    } else if (userId) {
      query.eq('id', userId)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ profile: data })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}

// POST /api/user-profile - Create new user profile
export async function POST(request: NextRequest) {
  try {
    const body: CreateUserProfileRequest = await request.json()

    // Validate required fields
    if (!body.email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', body.email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'User profile already exists' },
        { status: 409 }
      )
    }

    // Create new user profile
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        email: body.email,
        first_name: body.name,
        skin_type: body.skin_type,
        skin_tone: body.skin_tone,
        skin_concerns: body.skin_concerns || [],
        ingredient_allergies: body.ingredient_allergies || [],
        preferred_ingredients: body.preferred_ingredients || [],
        preferred_texture: body.preferred_texture,
        price_range_min: body.price_range_min || 0,
        price_range_max: body.price_range_max || 1000,
        skincare_experience: body.skincare_experience,
        routine_complexity: body.routine_complexity,
        time_commitment: body.time_commitment,
        product_history: {},
        skin_analysis_history: {},
        recommendation_feedback: {}
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ profile: data }, { status: 201 })
  } catch (error) {
    console.error('Error creating user profile:', error)
    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    )
  }
}

// PUT /api/user-profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const body: UpdateUserProfileRequest = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const updateData: Partial<UserProfile> = {}

    // Only include fields that are provided
    if (body.name !== undefined) (updateData as any).first_name = body.name
    if (body.skin_type !== undefined) updateData.skin_type = body.skin_type
    if (body.skin_tone !== undefined) updateData.skin_tone = body.skin_tone
    if (body.skin_concerns !== undefined) updateData.skin_concerns = body.skin_concerns
    if (body.ingredient_allergies !== undefined) updateData.ingredient_allergies = body.ingredient_allergies
    if (body.preferred_ingredients !== undefined) updateData.preferred_ingredients = body.preferred_ingredients
    if (body.preferred_texture !== undefined) updateData.preferred_texture = body.preferred_texture
    if (body.price_range_min !== undefined) updateData.price_range_min = body.price_range_min
    if (body.price_range_max !== undefined) updateData.price_range_max = body.price_range_max
    if (body.skincare_experience !== undefined) updateData.skincare_experience = body.skincare_experience
    if (body.routine_complexity !== undefined) updateData.routine_complexity = body.routine_complexity
    if (body.time_commitment !== undefined) updateData.time_commitment = body.time_commitment

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ profile: data })
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    )
  }
}

// DELETE /api/user-profile?id=user-id
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (error) {
      throw error
    }

    return NextResponse.json({ message: 'User profile deleted successfully' })
  } catch (error) {
    console.error('Error deleting user profile:', error)
    return NextResponse.json(
      { error: 'Failed to delete user profile' },
      { status: 500 }
    )
  }
}