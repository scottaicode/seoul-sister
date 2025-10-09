import { NextRequest, NextResponse } from 'next/server'
import { WhatsAppService } from '@/lib/whatsapp'
import { supabase } from '@/lib/supabase'
import { chargeCustomer } from '@/lib/stripe-server'

const whatsappService = new WhatsAppService()

export async function GET(request: NextRequest) {
  // Webhook verification for WhatsApp
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Process WhatsApp webhook payload
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await processMessage(change.value)
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processMessage(messageData: any) {
  const messages = messageData.messages
  if (!messages || messages.length === 0) return

  for (const message of messages) {
    const from = message.from
    const messageType = message.type
    const messageId = message.id

    // Find user by WhatsApp number
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('whatsapp_number', from)
      .single()

    if (!profile) {
      // User not registered, send signup message
      await whatsappService.sendMessage(
        from,
        `Hi! To start ordering authentic K-beauty at Seoul prices, please sign up at ${process.env.NEXT_PUBLIC_APP_URL}/signup\n\nOnce you're registered, I'll help you find any Korean beauty product at real Seoul prices! 🇰🇷✨`
      )
      continue
    }

    try {
      await handleUserMessage(profile, message)
    } catch (error) {
      console.error('Error handling message:', error)
      await whatsappService.sendMessage(
        from,
        whatsappService.formatErrorMessage()
      )
    }
  }
}

async function handleUserMessage(profile: any, message: any) {
  const from = message.from
  const messageType = message.type

  // Handle different message types
  switch (messageType) {
    case 'text':
      await handleTextMessage(profile, message.text.body)
      break

    case 'image':
      await handleImageMessage(profile, message.image, message.caption?.body)
      break

    default:
      await whatsappService.sendMessage(
        from,
        whatsappService.formatErrorMessage()
      )
  }
}

async function handleTextMessage(profile: any, text: string) {
  const normalizedText = text.toLowerCase().trim()

  // Handle order confirmations
  if (normalizedText === 'confirm' || normalizedText === 'yes') {
    await handleOrderConfirmation(profile)
    return
  }

  // Handle order requests
  if (normalizedText === 'order' || normalizedText.startsWith('i want')) {
    // Check if there's a pending product identification
    const pendingOrder = await getPendingOrder(profile.id)
    if (pendingOrder) {
      await createOrder(profile, pendingOrder)
      return
    }
  }

  // Handle welcome/greeting
  if (normalizedText.includes('hi') || normalizedText.includes('hello') || normalizedText.includes('hey')) {
    await whatsappService.sendMessage(
      profile.whatsapp_number,
      whatsappService.formatWelcomeMessage(profile.first_name)
    )
    return
  }

  // Product identification
  const identification = await whatsappService.identifyProductFromText(text)

  if (identification.confidence > 0.7) {
    // High confidence - proceed with pricing
    const product = await findProductInDatabase(identification.productName, identification.brand)
    if (product) {
      await sendPricingInfo(profile, product)
    } else {
      await handleUnknownProduct(profile, identification)
    }
  } else {
    // Low confidence - ask for clarification
    const clarification = identification.suggestions?.join('\n') || 'Could you provide more details about the product you\'re looking for?'
    await whatsappService.sendMessage(profile.whatsapp_number, clarification)
  }
}

async function handleImageMessage(profile: any, imageData: any, caption?: string) {
  try {
    // Download and process image (implementation depends on WhatsApp API)
    const imageUrl = imageData.url // This would need to be downloaded and converted to base64

    const identification = await whatsappService.identifyProductFromImage(imageUrl, caption)

    if (identification.confidence > 0.7) {
      const product = await findProductInDatabase(identification.productName, identification.brand)
      if (product) {
        await sendPricingInfo(profile, product)
      } else {
        await handleUnknownProduct(profile, identification)
      }
    } else {
      const clarification = identification.suggestions?.join('\n') || 'I couldn\'t identify the product from the image. Could you tell me the brand and product name?'
      await whatsappService.sendMessage(profile.whatsapp_number, clarification)
    }
  } catch (error) {
    console.error('Error processing image:', error)
    await whatsappService.sendMessage(
      profile.whatsapp_number,
      'Sorry, I had trouble processing that image. Could you try sending it again or tell me the product name?'
    )
  }
}

async function findProductInDatabase(productName: string, brand: string) {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .ilike('name_english', `%${productName}%`)
    .ilike('brand', `%${brand}%`)
    .single()

  return product
}

async function sendPricingInfo(profile: any, product: any) {
  const response = await whatsappService.generatePricingResponse(
    product.name_english,
    product.brand,
    product.seoul_price
  )

  await whatsappService.sendMessage(profile.whatsapp_number, response)

  // Store pending order
  await storePendingOrder(profile.id, product)
}

async function handleUnknownProduct(profile: any, identification: any) {
  // For unknown products, we can still provide a quote based on typical savings
  const estimatedSeoulPrice = 25 // Default estimate
  const response = `I found "${identification.brand} - ${identification.productName}" but don't have it in my database yet.

No worries! I can source it directly from Seoul for you.

🔍 *Let me find the exact Seoul price*
💰 *Typical savings: 40-70% vs US retail*
📦 *Service fee: $25*

Reply "GET QUOTE" and I'll find the current Seoul price for you within 2 hours.

Or try another product! 📸`

  await whatsappService.sendMessage(profile.whatsapp_number, response)
}

async function storePendingOrder(userId: string, product: any) {
  await supabase
    .from('orders')
    .upsert({
      customer_id: userId,
      product_id: product.id,
      product_name: product.name_english,
      seoul_price: product.seoul_price,
      service_fee: 25,
      total_amount: product.seoul_price + 25,
      status: 'pending'
    })
}

async function getPendingOrder(userId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return order
}

async function createOrder(profile: any, pendingOrder: any) {
  try {
    // Charge the customer's saved payment method
    const paymentIntent = await chargeCustomer(
      profile.stripe_customer_id,
      pendingOrder.total_amount,
      `Seoul Sister - ${pendingOrder.product_name}`
    )

    if (paymentIntent.status === 'succeeded') {
      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          stripe_payment_intent_id: paymentIntent.id
        })
        .eq('id', pendingOrder.id)

      // Send confirmation
      const confirmation = await whatsappService.generateOrderConfirmation(
        pendingOrder.product_name,
        pendingOrder.brand || 'Korean Brand',
        pendingOrder.seoul_price
      )

      await whatsappService.sendMessage(profile.whatsapp_number, confirmation)

      // Update customer stats
      await supabase
        .from('profiles')
        .update({
          order_count: profile.order_count + 1,
          total_savings: profile.total_savings + (pendingOrder.us_price - pendingOrder.total_amount),
          last_order_date: new Date().toISOString()
        })
        .eq('id', profile.id)

    } else {
      throw new Error('Payment failed')
    }

  } catch (error) {
    console.error('Error creating order:', error)
    await whatsappService.sendMessage(
      profile.whatsapp_number,
      `Sorry, there was an issue processing your payment. Please check your saved payment method in your account or contact support.`
    )
  }
}

async function handleOrderConfirmation(profile: any) {
  const pendingOrder = await getPendingOrder(profile.id)
  if (pendingOrder) {
    await createOrder(profile, pendingOrder)
  } else {
    await whatsappService.sendMessage(
      profile.whatsapp_number,
      `I don't see any pending orders. Send me a product you'd like to order! 📸`
    )
  }
}