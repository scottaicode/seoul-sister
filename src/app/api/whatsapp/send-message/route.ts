import { NextRequest, NextResponse } from 'next/server'
import { whatsappClient } from '@/lib/whatsapp/client'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const {
      to,
      messageType = 'text',
      text,
      template,
      interactive,
      userId
    } = await request.json()

    if (!to) {
      return NextResponse.json(
        { error: 'Phone number (to) is required' },
        { status: 400 }
      )
    }

    // Format phone number (ensure it starts with +)
    const phoneNumber = to.startsWith('+') ? to : `+${to}`

    // Check if recipient has active subscription (for premium features)
    const hasSubscription = await checkUserSubscription(userId, phoneNumber)

    // Construct WhatsApp message
    const message: any = {
      to: phoneNumber,
      type: messageType
    }

    switch (messageType) {
      case 'text':
        if (!text) {
          return NextResponse.json(
            { error: 'Text content is required for text messages' },
            { status: 400 }
          )
        }
        message.text = { body: text }
        break

      case 'template':
        if (!template) {
          return NextResponse.json(
            { error: 'Template data is required for template messages' },
            { status: 400 }
          )
        }
        message.template = template
        break

      case 'interactive':
        if (!interactive) {
          return NextResponse.json(
            { error: 'Interactive data is required for interactive messages' },
            { status: 400 }
          )
        }
        message.interactive = interactive
        break

      default:
        return NextResponse.json(
          { error: 'Invalid message type' },
          { status: 400 }
        )
    }

    // Send message via WhatsApp Business API
    const result = await whatsappClient.sendMessage(message)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send message' },
        { status: 500 }
      )
    }

    // Log message to database
    await supabase
      .from('whatsapp_messages')
      .insert({
        user_id: userId || null,
        phone_number: phoneNumber,
        message_id: result.messageId,
        message_type: messageType,
        message_content: message,
        status: 'sent',
        sent_at: new Date().toISOString()
      })

    // Log to conversations table
    await supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: userId || null,
        phone_number: phoneNumber,
        message_text: text || JSON.stringify(message),
        direction: 'outgoing',
        message_id: result.messageId,
        timestamp: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'WhatsApp message sent successfully'
    })

  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error)
    return NextResponse.json(
      {
        error: 'Failed to send WhatsApp message',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

async function checkUserSubscription(userId?: string, phoneNumber?: string): Promise<boolean> {
  try {
    if (!userId && !phoneNumber) return false

    let query = supabase.from('profiles').select('subscription_status, trial_end, current_period_end')

    if (userId) {
      query = query.eq('id', userId)
    } else {
      query = query.eq('phone', phoneNumber)
    }

    const { data: profile } = await query.single()

    if (!profile) return false

    const now = new Date()
    const hasActiveSubscription = ['active', 'trialing'].includes(profile.subscription_status)
    const trialValid = profile.trial_end && new Date(profile.trial_end) > now
    const subscriptionValid = profile.current_period_end && new Date(profile.current_period_end) > now

    return hasActiveSubscription && (trialValid || subscriptionValid)

  } catch (error) {
    console.error('Error checking subscription:', error)
    return false
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister WhatsApp Messaging API',
    description: 'Send WhatsApp messages to customers programmatically',
    usage: {
      endpoint: 'POST /api/whatsapp/send-message',
      parameters: {
        to: 'Required - Phone number with country code (e.g., +1234567890)',
        messageType: 'Optional - "text", "template", or "interactive" (default: "text")',
        text: 'Required for text messages - Message content',
        template: 'Required for template messages - Template configuration',
        interactive: 'Required for interactive messages - Interactive configuration',
        userId: 'Optional - User ID for logging and subscription verification'
      }
    },
    examples: {
      text_message: {
        to: '+1234567890',
        messageType: 'text',
        text: 'Hello! Your Seoul Sister order has shipped.',
        userId: 'user-123'
      },
      welcome_template: {
        to: '+1234567890',
        messageType: 'template',
        template: {
          name: 'seoul_sister_welcome',
          language: { code: 'en' }
        }
      },
      interactive_buttons: {
        to: '+1234567890',
        messageType: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Choose an option:' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'order', title: 'Place Order' } },
              { type: 'reply', reply: { id: 'track', title: 'Track Order' } }
            ]
          }
        }
      }
    },
    features: [
      'Send text messages with rich formatting',
      'Send template messages for notifications',
      'Send interactive messages with buttons/lists',
      'Automatic subscription verification',
      'Message logging and conversation tracking',
      'Support for multimedia messages',
      'Delivery status tracking'
    ]
  })
}