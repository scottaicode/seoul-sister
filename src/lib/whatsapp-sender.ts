/**
 * WhatsApp Business API Message Sender
 * Handles all outbound WhatsApp messages
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WhatsAppMessage {
  to: string
  text?: string
  imageUrl?: string
  templateName?: string
  templateParams?: Record<string, string>
}

interface MessageResponse {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a WhatsApp message via the Business API
 */
export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<MessageResponse> {
  const { to, text, imageUrl, templateName, templateParams } = message

  // Format phone number (remove + and spaces)
  const formattedPhone = to.replace(/[\s+]/g, '')

  try {
    // Queue message in database first
    const { data: queued, error: queueError } = await supabase
      .from('whatsapp_outbound_queue')
      .insert({
        to_number: to,
        message: text || '',
        media_url: imageUrl,
        status: 'pending'
      })
      .select()
      .single()

    if (queueError) {
      console.error('Failed to queue message:', queueError)
      return { success: false, error: 'Failed to queue message' }
    }

    // If no WhatsApp credentials, return queued status (for development)
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log('WhatsApp message queued (no credentials):', queued.id)
      return { success: true, messageId: queued.id }
    }

    // Prepare WhatsApp API request
    const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

    let body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone
    }

    // Add message content based on type
    if (templateName) {
      // Template message
      body.type = 'template'
      body.template = {
        name: templateName,
        language: { code: 'en_US' },
        components: templateParams ? [
          {
            type: 'body',
            parameters: Object.entries(templateParams).map(([key, value]) => ({
              type: 'text',
              text: value
            }))
          }
        ] : []
      }
    } else if (imageUrl) {
      // Image message
      body.type = 'image'
      body.image = {
        link: imageUrl,
        caption: text || ''
      }
    } else {
      // Text message
      body.type = 'text'
      body.text = {
        preview_url: true,
        body: text || ''
      }
    }

    // Send via WhatsApp API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error?.message || 'Failed to send WhatsApp message')
    }

    // Update queue status
    await supabase
      .from('whatsapp_outbound_queue')
      .update({
        status: 'sent',
        delivered_at: new Date().toISOString()
      })
      .eq('id', queued.id)

    return {
      success: true,
      messageId: result.messages?.[0]?.id || queued.id
    }

  } catch (error) {
    console.error('WhatsApp send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    }
  }
}

/**
 * Send a product identification result
 */
export async function sendProductResult(
  to: string,
  product: {
    brand: string
    name: string
    nameKorean?: string
    seoulPrice: number
    usPrice: number
    savings: number
    savingsPercent: number
    ingredients?: string[]
  }
): Promise<MessageResponse> {
  let message = `🎯 **Found it!**\n\n`
  message += `📦 **${product.brand} - ${product.name}**\n`

  if (product.nameKorean) {
    message += `🇰🇷 ${product.nameKorean}\n\n`
  }

  message += `💰 **Price Comparison:**\n`
  message += `Seoul: $${product.seoulPrice} 🟢\n`
  message += `Sephora/US: $${product.usPrice} 🔴\n`
  message += `**You save: $${product.savings} (${product.savingsPercent}%)**\n\n`

  message += `🚀 I can get this for you at Seoul prices!\n`
  message += `Reply "ORDER" to add to your Seoul Sister cart`

  if (product.ingredients && product.ingredients.length > 0) {
    message += `\n\n🧪 Key ingredients: ${product.ingredients.slice(0, 3).join(', ')}`
  }

  return sendWhatsAppMessage({ to, text: message })
}

/**
 * Send a personalized routine recommendation
 */
export async function sendRoutineRecommendation(
  to: string,
  skinType: string,
  products: Array<{
    step: string
    brand: string
    name: string
    seoulPrice: number
    usPrice: number
  }>
): Promise<MessageResponse> {
  let message = `✨ **Your Personalized K-Beauty Routine**\n`
  message += `*Based on your ${skinType} skin*\n\n`

  let totalSeoul = 0
  let totalUS = 0

  products.forEach(product => {
    message += `${product.step}: ${product.brand} ${product.name}\n`
    message += `Seoul $${product.seoulPrice} (US $${product.usPrice})\n\n`
    totalSeoul += product.seoulPrice
    totalUS += product.usPrice
  })

  const savings = totalUS - totalSeoul
  message += `💰 **Total: $${totalSeoul}** (Save $${savings}!)\n\n`
  message += `Reply "GET ROUTINE" to order everything!`

  return sendWhatsAppMessage({ to, text: message })
}

/**
 * Send a shipping estimate
 */
export async function sendShippingEstimate(
  to: string,
  location: { lat: number, lng: number },
  estimates: {
    standard: number
    express: number
    priority: number
  }
): Promise<MessageResponse> {
  const message = `📍 **Shipping to your location:**\n\n` +
    `🚚 Standard (10-14 days): $${estimates.standard}\n` +
    `✈️ Express (5-7 days): $${estimates.express}\n` +
    `🚁 Priority (3-4 days): $${estimates.priority}\n\n` +
    `All orders over $100 get FREE standard shipping!\n` +
    `Seoul Sisters save an average of $179 per order 💅`

  return sendWhatsAppMessage({ to, text: message })
}

/**
 * Send welcome message to new user
 */
export async function sendWelcomeMessage(to: string): Promise<MessageResponse> {
  const message = `🌟 **Welcome to Seoul Sister AI Beauty Assistant!**\n\n` +
    `I'm your personal K-beauty expert, available 24/7 to help you save 70% on authentic Korean skincare.\n\n` +
    `Here's what I can do:\n` +
    `📸 Identify any K-beauty product from a photo\n` +
    `💰 Compare Seoul vs US prices instantly\n` +
    `🔄 Reorder your favorites with one word\n` +
    `🧪 Analyze ingredients for your skin type\n` +
    `📍 Calculate shipping to your location\n\n` +
    `Send me a photo of any Korean beauty product to start!`

  return sendWhatsAppMessage({ to, text: message })
}

/**
 * Process queued messages (run periodically)
 */
export async function processMessageQueue() {
  try {
    // Get pending messages
    const { data: pending } = await supabase
      .from('whatsapp_outbound_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(10)

    if (!pending || pending.length === 0) {
      return
    }

    console.log(`Processing ${pending.length} queued WhatsApp messages...`)

    // Process each message
    for (const msg of pending) {
      await sendWhatsAppMessage({
        to: msg.to_number,
        text: msg.message,
        imageUrl: msg.media_url
      })

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

  } catch (error) {
    console.error('Error processing message queue:', error)
  }
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(messageId: string) {
  try {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      return
    }

    const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    })
  } catch (error) {
    console.error('Error marking message as read:', error)
  }
}

/**
 * Get user's conversation history
 */
export async function getUserHistory(phoneNumber: string, limit = 10) {
  const { data } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('phone_number', phoneNumber)
    .order('created_at', { ascending: false })
    .limit(limit)

  return data || []
}

/**
 * Get user's product interests
 */
export async function getUserInterests(phoneNumber: string) {
  const { data } = await supabase
    .from('product_interests')
    .select('*')
    .eq('phone_number', phoneNumber)
    .order('created_at', { ascending: false })
    .limit(20)

  return data || []
}