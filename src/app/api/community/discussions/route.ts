import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/community/discussions?category=xxx&limit=10 - Get discussions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const discussionType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sort') || 'created_at' // created_at, views_count, replies_count

    let query = supabase
      .from('community_discussions')
      .select(`
        *,
        user_profiles!inner(name)
      `)
      .eq('is_approved', true)
      .order(sortBy, { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq('category', category)
    }

    if (discussionType) {
      query = query.eq('discussion_type', discussionType)
    }

    const { data: discussions, error } = await query

    if (error) {
      throw error
    }

    // Add anonymized user names
    const discussionsWithNames = discussions?.map(discussion => ({
      ...discussion,
      user_name: anonymizeUserName(discussion.user_profiles?.name || 'Anonymous')
    })) || []

    return NextResponse.json({
      discussions: discussionsWithNames,
      total: discussionsWithNames.length
    })

  } catch (error) {
    console.error('Error fetching discussions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch discussions' },
      { status: 500 }
    )
  }
}

// POST /api/community/discussions - Create new discussion
export async function POST(request: NextRequest) {
  try {
    const discussionData = await request.json()

    if (!discussionData.user_id || !discussionData.title || !discussionData.content) {
      return NextResponse.json(
        { error: 'User ID, title, and content are required' },
        { status: 400 }
      )
    }

    // Create discussion
    const { data: savedDiscussion, error } = await supabase
      .from('community_discussions')
      .insert([{
        user_id: discussionData.user_id,
        title: discussionData.title,
        content: discussionData.content,
        discussion_type: discussionData.discussion_type || 'general',
        category: discussionData.category || 'general',
        tags: discussionData.tags || [],
        is_approved: true // Auto-approve for now, add moderation later
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      discussion: savedDiscussion,
      message: 'Discussion created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating discussion:', error)
    return NextResponse.json(
      { error: 'Failed to create discussion' },
      { status: 500 }
    )
  }
}

// Helper function to anonymize user names
function anonymizeUserName(name: string): string {
  if (!name || name === 'Anonymous') return 'Anonymous'

  const parts = name.split(' ')
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + '*'.repeat(Math.max(0, parts[0].length - 1))
  }

  return parts[0].charAt(0).toUpperCase() + '*'.repeat(Math.max(0, parts[0].length - 1)) +
         ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.'
}