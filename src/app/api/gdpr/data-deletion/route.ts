import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      email,
      phoneNumber,
      requestType = 'full_deletion',
      reason
    } = await request.json()

    if (!userId && !email && !phoneNumber) {
      return NextResponse.json(
        { error: 'User identification is required (userId, email, or phoneNumber)' },
        { status: 400 }
      )
    }

    console.log(`🗑️ GDPR Data deletion request: ${requestType} for user ${userId || email || phoneNumber}`)

    // Find user profile
    let userQuery = supabase.from('profiles').select('*')

    if (userId) {
      userQuery = userQuery.eq('id', userId)
    } else if (email) {
      userQuery = userQuery.eq('email', email)
    } else if (phoneNumber) {
      userQuery = userQuery.eq('phone', phoneNumber)
    }

    const { data: userProfile, error: userError } = await userQuery.single()

    if (userError && userError.code !== 'PGRST116') {
      throw userError
    }

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const actualUserId = userProfile.id

    // Log the deletion request
    const { error: logError } = await supabase
      .from('gdpr_deletion_requests')
      .insert({
        user_id: actualUserId,
        email: userProfile.email,
        phone_number: userProfile.phone,
        request_type: requestType,
        reason: reason || 'User requested data deletion',
        status: 'pending',
        requested_at: new Date().toISOString()
      })

    if (logError) {
      console.warn('Failed to log deletion request:', logError)
    }

    if (requestType === 'account_only') {
      // Only delete account but keep anonymized analytics data
      await deleteAccountData(actualUserId)
    } else {
      // Full deletion including all data
      await deleteAllUserData(actualUserId)
    }

    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(actualUserId)
    if (authError) {
      console.warn('Failed to delete auth user:', authError)
    }

    // Update deletion request status
    await supabase
      .from('gdpr_deletion_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('user_id', actualUserId)
      .eq('status', 'pending')

    console.log(`✅ GDPR Data deletion completed for user ${actualUserId}`)

    return NextResponse.json({
      success: true,
      message: 'Data deletion completed successfully',
      deletionType: requestType,
      userId: actualUserId
    })

  } catch (error) {
    console.error('❌ Error processing GDPR deletion request:', error)
    return NextResponse.json(
      {
        error: 'Failed to process deletion request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

async function deleteAccountData(userId: string) {
  console.log(`🗑️ Deleting account data for user ${userId}`)

  // Delete from profiles table
  await supabase.from('profiles').delete().eq('id', userId)

  // Delete subscription data
  await supabase.from('user_profiles').delete().eq('id', userId)

  // Delete support tickets (but keep anonymized for support metrics)
  await supabase
    .from('support_tickets')
    .update({
      user_id: null,
      name: 'Deleted User',
      email: 'deleted@privacy.request',
      phone_number: null
    })
    .eq('user_id', userId)

  // Keep anonymized data for analytics but remove PII
}

async function deleteAllUserData(userId: string) {
  console.log(`🗑️ Full data deletion for user ${userId}`)

  const tablesToDelete = [
    'profiles',
    'user_profiles',
    'user_photos',
    'user_skin_analysis',
    'user_preferences',
    'user_recommendations',
    'user_orders',
    'user_product_interactions'
  ]

  // Delete from all tables
  for (const table of tablesToDelete) {
    try {
      await supabase.from(table).delete().eq('user_id', userId)
    } catch (error) {
      console.warn(`Failed to delete from ${table}:`, error)
    }
  }

  // Delete support tickets completely for full deletion
  await supabase.from('support_tickets').delete().eq('user_id', userId)

  // Delete any uploaded files/photos
  try {
    const { data: files } = await supabase.storage
      .from('user-uploads')
      .list(`${userId}/`)

    if (files && files.length > 0) {
      const filePaths = files.map(file => `${userId}/${file.name}`)
      await supabase.storage
        .from('user-uploads')
        .remove(filePaths)
    }
  } catch (error) {
    console.warn('Failed to delete user files:', error)
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json(
      { error: 'userId parameter is required' },
      { status: 400 }
    )
  }

  try {
    // Get deletion request status
    const { data: deletionRequests } = await supabase
      .from('gdpr_deletion_requests')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })

    return NextResponse.json({
      deletionRequests: deletionRequests || [],
      hasPendingRequest: deletionRequests?.some(req => req.status === 'pending') || false
    })

  } catch (error) {
    console.error('Error fetching deletion requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deletion requests' },
      { status: 500 }
    )
  }
}