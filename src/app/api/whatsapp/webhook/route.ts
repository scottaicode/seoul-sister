import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify webhook signature (implement webhook verification)
    // const signature = request.headers.get('x-whatsapp-signature')

    // Process WhatsApp webhook
    if (body.entry && body.entry[0] && body.entry[0].changes) {
      const changes = body.entry[0].changes[0]

      if (changes.field === 'messages') {
        const messages = changes.value.messages

        if (messages && messages.length > 0) {
          // Process each message
          for (const message of messages) {
            await processWhatsAppMessage(message, changes.value.metadata)
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Webhook verification for WhatsApp
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified')
    return new NextResponse(challenge)
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

async function processWhatsAppMessage(message: any, metadata: any) {
  try {
    const phoneNumber = message.from
    const messageText = message.text?.body || ''
    const messageType = message.type

    // Log the message in database
    const { error } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone_number: phoneNumber,
        message_text: messageText,
        message_type: messageType,
        message_id: message.id,
        timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        metadata: { message, metadata }
      })

    if (error) {
      console.error('Error logging WhatsApp message:', error)
    }

    // Process message based on content
    if (messageType === 'text') {
      await handleTextMessage(phoneNumber, messageText, message.id)
    } else if (messageType === 'image') {
      await handleImageMessage(phoneNumber, message.image, message.id)
    }

  } catch (error) {
    console.error('Error processing individual message:', error)
  }
}

async function handleTextMessage(phoneNumber: string, messageText: string, messageId: string) {
  // AI processing logic would go here
  // For now, just log that we received a text message
  console.log(`Received text message from ${phoneNumber}: ${messageText}`)

  // Could trigger AI product identification, order processing, etc.
}

async function handleImageMessage(phoneNumber: string, image: any, messageId: string) {
  // AI image processing logic would go here
  // For now, just log that we received an image
  console.log(`Received image message from ${phoneNumber}`)

  // Could trigger AI product identification from image, etc.
}