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
      phoneNumber,
      email,
      name,
      subject,
      message,
      category,
      priority = 'medium'
    } = await request.json()

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      )
    }

    if (!userId && !phoneNumber && !email) {
      return NextResponse.json(
        { error: 'User identification is required (userId, phoneNumber, or email)' },
        { status: 400 }
      )
    }

    // Create support ticket
    const ticketData = {
      user_id: userId || null,
      phone_number: phoneNumber || null,
      email: email || null,
      name: name || 'Unknown',
      subject,
      message,
      category: category || 'general',
      priority,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert(ticketData)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Send notification to support team (in production, this would be an email/Slack notification)
    console.log(`🎫 New support ticket created: #${ticket.id}`)
    console.log(`Category: ${category}, Priority: ${priority}`)
    console.log(`From: ${name} (${email || phoneNumber})`)
    console.log(`Subject: ${subject}`)

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: `SS-${ticket.id.toString().padStart(6, '0')}`,
        status: ticket.status,
        created_at: ticket.created_at
      },
      message: 'Support ticket created successfully. We\'ll respond within 24 hours.'
    })

  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json(
      {
        error: 'Failed to create support ticket',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const phoneNumber = searchParams.get('phoneNumber')
    const email = searchParams.get('email')

    if (!userId && !phoneNumber && !email) {
      return NextResponse.json(
        { error: 'User identification is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('user_id', userId)
    } else if (phoneNumber) {
      query = query.eq('phone_number', phoneNumber)
    } else if (email) {
      query = query.eq('email', email)
    }

    const { data: tickets, error } = await query

    if (error) {
      throw error
    }

    const formattedTickets = tickets?.map(ticket => ({
      id: ticket.id,
      ticket_number: `SS-${ticket.id.toString().padStart(6, '0')}`,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at
    })) || []

    return NextResponse.json({
      tickets: formattedTickets
    })

  } catch (error) {
    console.error('Error fetching support tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}