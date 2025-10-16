import { NextRequest, NextResponse } from 'next/server'
import { whatsappClient } from '@/lib/whatsapp/client'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  // Webhook verification for WhatsApp Business API
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('🔐 WhatsApp webhook verification attempt')

  if (mode === 'subscribe' && whatsappClient.verifyWebhook(token || '')) {
    console.log('✅ WhatsApp webhook verified successfully')
    return new NextResponse(challenge)
  } else {
    console.log('❌ WhatsApp webhook verification failed')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📱 WhatsApp webhook received:', JSON.stringify(body, null, 2))

    // Process webhook events
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            await handleMessageChange(change.value)
          }
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Error processing WhatsApp webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

async function handleMessageChange(value: any) {
  try {
    // Handle incoming messages
    if (value.messages) {
      for (const message of value.messages) {
        await handleIncomingMessage(message, value.contacts?.[0])
      }
    }

    // Handle message status updates (sent, delivered, read)
    if (value.statuses) {
      for (const status of value.statuses) {
        await handleMessageStatus(status)
      }
    }

  } catch (error) {
    console.error('❌ Error handling message change:', error)
  }
}

async function handleIncomingMessage(message: any, contact: any) {
  try {
    const phoneNumber = message.from
    const messageText = message.text?.body || ''
    const messageType = message.type
    const contactName = contact?.profile?.name || contact?.wa_id

    console.log(`📩 Incoming message from ${phoneNumber} (${contactName}): "${messageText}"`)

    // Find or create user profile based on phone number
    let { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phoneNumber)
      .single()

    if (!userProfile) {
      // Create a guest profile for WhatsApp users
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          phone: phoneNumber,
          full_name: contactName || 'WhatsApp User',
          whatsapp_contact: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Failed to create user profile:', createError)
      } else {
        userProfile = newProfile
      }
    }

    // Log the conversation
    await logWhatsAppMessage(phoneNumber, messageText, 'incoming', userProfile?.id)

    // Check if user has active subscription
    const hasSubscription = await checkUserSubscription(userProfile?.id, phoneNumber)

    if (!hasSubscription) {
      // Send subscription prompt for non-premium users
      await whatsappClient.sendMessage({
        to: phoneNumber,
        type: 'text',
        text: {
          body: `👋 Hi ${contactName || 'there'}!

I'm your Seoul Sister personal K-beauty advisor! I'd love to help you discover authentic Korean beauty products at wholesale prices.

💎 To access our exclusive WhatsApp ordering service, you'll need a Seoul Sister Premium membership ($20/month with 7-day free trial).

✨ Premium includes:
• Personal WhatsApp shopping service
• 70% savings on authentic K-beauty
• AI skin analysis & recommendations
• Direct sourcing from Seoul distributors

🚀 Start your free trial: ${process.env.NEXT_PUBLIC_BASE_URL}/signup

Already a member? Let me help you find amazing products! 💕`
        }
      })
      return
    }

    // Handle the message for premium users
    await whatsappClient.handleIncomingMessage(phoneNumber, messageText, contactName)

    // Special handling for product orders
    if (messageText.toLowerCase().includes('order') || /^\d+[,\s]*\d*[,\s]*\d*/.test(messageText)) {
      await handleProductOrder(phoneNumber, messageText, userProfile)
    }

  } catch (error) {
    console.error('❌ Error handling incoming message:', error)
  }
}

async function handleMessageStatus(status: any) {
  try {
    const messageId = status.id
    const statusType = status.status // sent, delivered, read, failed
    const timestamp = status.timestamp

    console.log(`📊 Message ${messageId} status: ${statusType}`)

    // Update message delivery status in database
    await supabase
      .from('whatsapp_messages')
      .update({
        status: statusType,
        status_timestamp: new Date(timestamp * 1000).toISOString()
      })
      .eq('message_id', messageId)

  } catch (error) {
    console.error('❌ Error handling message status:', error)
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

async function logWhatsAppMessage(
  phoneNumber: string,
  message: string,
  direction: 'incoming' | 'outgoing',
  userId?: string
) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: userId,
        phone_number: phoneNumber,
        message_text: message,
        direction,
        timestamp: new Date().toISOString()
      })
  } catch (error) {
    console.error('Failed to log WhatsApp message:', error)
  }
}

async function handleProductOrder(phoneNumber: string, message: string, userProfile: any) {
  try {
    // Extract product numbers from message (e.g., "1, 3, 5" or "I want products 2 and 4")
    const productNumbers = message.match(/\d+/g)?.map(num => parseInt(num))

    if (productNumbers && productNumbers.length > 0) {
      console.log(`📦 Product order detected from ${phoneNumber}: products ${productNumbers.join(', ')}`)

      // Create order record
      const { data: order, error: orderError } = await supabase
        .from('whatsapp_orders')
        .insert({
          user_id: userProfile?.id,
          phone_number: phoneNumber,
          customer_name: userProfile?.full_name || 'WhatsApp Customer',
          product_numbers: productNumbers,
          status: 'pending',
          order_message: message,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (orderError) {
        console.error('Failed to create order:', orderError)
        return
      }

      // Send order confirmation
      await whatsappClient.sendMessage({
        to: phoneNumber,
        type: 'text',
        text: {
          body: `🎉 Order received!

📋 Order #${order.id.slice(-8).toUpperCase()}
📦 Products: ${productNumbers.join(', ')}

Our Seoul team is preparing your personalized quote with:
• Authentic product verification
• Current wholesale pricing
• Shipping costs to your location
• Estimated delivery timeline

⏱️ You'll receive a detailed quote within 2-4 hours!

Need to modify your order? Just send me a message! 💕`
        }
      })

      // Notify admin/fulfillment team (could integrate with Slack, email, etc.)
      console.log(`🔔 New WhatsApp order #${order.id} needs processing`)
    }

  } catch (error) {
    console.error('Error handling product order:', error)
  }
}