import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// WhatsApp webhook verification
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
        console.log('WhatsApp webhook verified')
        return new Response(challenge || '', { status: 200 })
      }
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch (error) {
    console.error('WhatsApp GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Main WhatsApp message handler
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256')
    if (!verifyWebhookSignature(JSON.stringify(body), signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // Process incoming messages
    const { entry } = body
    if (!entry || !entry[0]?.changes?.[0]?.value?.messages) {
      return NextResponse.json({ status: 'no messages' })
    }

    const message = entry[0].changes[0].value.messages[0]
    const from = message.from // User's WhatsApp number
    const messageType = message.type

    // Store conversation context
    await storeConversation(from, message)

    let responseText = ''

    switch (messageType) {
      case 'text':
        responseText = await handleTextMessage(message.text.body, from)
        break

      case 'image':
        responseText = await handleImageMessage(message.image, from)
        break

      case 'location':
        responseText = await handleLocationMessage(message.location, from)
        break

      default:
        responseText = "I can help you with:\n📸 Send a photo of any K-beauty product\n💬 Ask about prices or ingredients\n📍 Share your location for shipping estimates\n🔄 Type 'reorder' to see your favorites"
    }

    // Send response back to user
    await sendWhatsAppMessage(from, responseText)

    return NextResponse.json({ status: 'success' })

  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

// Handle text messages with AI
async function handleTextMessage(text: string, from: string): Promise<string> {
  const lowerText = text.toLowerCase()

  // Quick commands
  if (lowerText.includes('reorder')) {
    return await handleReorder(from)
  }

  if (lowerText.includes('price') || lowerText.includes('how much')) {
    return await handlePriceCheck(text)
  }

  if (lowerText.includes('ingredient') || lowerText.includes('what\'s in')) {
    return await handleIngredientCheck(text)
  }

  if (lowerText.includes('routine') || lowerText.includes('recommend')) {
    return await handleRoutineRecommendation(from)
  }

  if (lowerText === 'help' || lowerText === 'menu') {
    return getHelpMenu()
  }

  // Use AI for general queries
  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are Seoul Sister's AI Beauty Assistant on WhatsApp. A user asked: "${text}"

        Provide a helpful, concise response about K-beauty products, prices, or skincare advice.
        Keep responses short (max 3-4 sentences) and friendly.
        If they're asking about a specific product, mention the Seoul vs US price difference.
        Always end with a helpful suggestion or question.`
      }
    ]
  })

  return response.content[0].type === 'text' ? response.content[0].text : 'Let me help you find the perfect K-beauty product!'
}

// Handle image messages - identify products and compare prices
async function handleImageMessage(image: any, from: string): Promise<string> {
  try {
    // Download image from WhatsApp
    const imageUrl = await downloadWhatsAppImage(image.id)

    // Analyze with Claude Vision
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `Identify this K-beauty product. Please provide:
              1. Brand name
              2. Product name (English and Korean if visible)
              3. Product type/category
              4. Key ingredients if visible
              5. Any unique features

              Format as JSON: {
                "brand": "",
                "productName": "",
                "productNameKorean": "",
                "category": "",
                "keyIngredients": [],
                "identified": true/false
              }`
            }
          ]
        }
      ]
    })

    // Parse product identification
    const aiResponse = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return "🤔 I couldn't identify this product clearly. Try taking a photo of the front label!"
    }

    const productInfo = JSON.parse(jsonMatch[0])

    if (!productInfo.identified) {
      return "📸 This doesn't look like a K-beauty product. Send me a photo of any Korean skincare or makeup item!"
    }

    // Look up prices in our database
    const prices = await getProductPrices(productInfo)

    // Store product interest for recommendations
    await storeProductInterest(from, productInfo)

    // Create response
    let message = `🎯 **Found it!**\n\n`
    message += `📦 **${productInfo.brand} - ${productInfo.productName}**\n`

    if (productInfo.productNameKorean) {
      message += `🇰🇷 ${productInfo.productNameKorean}\n\n`
    }

    if (prices) {
      message += `💰 **Price Comparison:**\n`
      message += `Seoul: $${prices.seoulPrice} 🟢\n`
      message += `Sephora/US: $${prices.usPrice} 🔴\n`
      message += `**You save: $${prices.savings} (${prices.savingsPercent}%)**\n\n`

      message += `🚀 I can get this for you at Seoul prices!\n`
      message += `Reply "ORDER" to add to your Seoul Sister cart`
    } else {
      message += `💡 I'll find the best Seoul price for you!\n`
      message += `This usually costs 70% less in Seoul.\n\n`
      message += `Reply "FIND" and I'll source it for you!`
    }

    if (productInfo.keyIngredients?.length > 0) {
      message += `\n\n🧪 Key ingredients: ${productInfo.keyIngredients.slice(0, 3).join(', ')}`
    }

    return message

  } catch (error) {
    console.error('Image analysis error:', error)
    return "🤖 Having trouble analyzing this image. Make sure the product label is clearly visible and try again!"
  }
}

// Handle location for shipping estimates
async function handleLocationMessage(location: any, from: string): Promise<string> {
  const { latitude, longitude } = location

  // Calculate shipping time and cost based on location
  // (In production, integrate with shipping APIs)
  const shippingEstimate = calculateShipping(latitude, longitude)

  return `📍 **Shipping to your location:**\n\n` +
         `🚚 Standard (10-14 days): $${shippingEstimate.standard}\n` +
         `✈️ Express (5-7 days): $${shippingEstimate.express}\n` +
         `🚁 Priority (3-4 days): $${shippingEstimate.priority}\n\n` +
         `All orders over $100 get FREE standard shipping!\n` +
         `Seoul Sisters save an average of $179 per order 💅`
}

// Reorder favorites
async function handleReorder(from: string): Promise<string> {
  // Get user's purchase history
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('whatsapp_number', from)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!orders || orders.length === 0) {
    return "🛍️ You haven't ordered yet!\n\n" +
           "Send me a photo of any K-beauty product to get started.\n" +
           "I'll show you how much you can save! 💰"
  }

  let message = "🔄 **Your Recent Orders:**\n\n"
  orders.forEach((order, index) => {
    message += `${index + 1}. ${order.product_name} - $${order.seoul_price}\n`
  })

  message += "\nReply with the number to reorder, or 'ALL' for everything!"

  return message
}

// Price check for text queries
async function handlePriceCheck(query: string): Promise<string> {
  // Extract product name from query
  const productMatch = query.match(/price (?:of |for )?(.+)/i)
  const productName = productMatch ? productMatch[1] : query

  // Search our database
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .textSearch('name_english', productName)
    .limit(3)

  if (!products || products.length === 0) {
    return `🔍 Searching for "${productName}"...\n\n` +
           "I couldn't find an exact match. Send me a photo and I'll identify it instantly!"
  }

  let message = `💰 **Price Check Results:**\n\n`
  products.forEach(product => {
    message += `**${product.brand} - ${product.name_english}**\n`
    message += `Seoul: $${product.seoul_price} | US: $${product.us_price}\n`
    message += `Save: ${product.savings_percentage}%\n\n`
  })

  message += "Reply with the product name to order at Seoul prices!"

  return message
}

// Ingredient analysis
async function handleIngredientCheck(query: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `User is asking about K-beauty ingredients: "${query}"

        Provide a brief, helpful explanation about the ingredient(s) mentioned.
        Include:
        1. What it does for skin
        2. Who it's good for
        3. Any warnings or things to know

        Keep it under 100 words and friendly.`
      }
    ]
  })

  const aiResponse = response.content[0].type === 'text' ? response.content[0].text : ''

  return `🧪 **Ingredient Intel:**\n\n${aiResponse}\n\n` +
         "Send me a product photo and I'll analyze all ingredients for your skin type!"
}

// Personalized routine recommendations
async function handleRoutineRecommendation(from: string): Promise<string> {
  // Get user's skin profile if it exists
  const { data: profile } = await supabase
    .from('user_skin_profiles')
    .select('*')
    .eq('whatsapp_number', from)
    .single()

  if (!profile) {
    return "✨ **Let's build your perfect routine!**\n\n" +
           "First, I need to know your skin type.\n" +
           "Visit seoulsister.com/skin-analysis for a free AI analysis!\n\n" +
           "Or tell me your main skin concern and I'll recommend products."
  }

  // Get personalized recommendations based on profile
  const { data: recommendations } = await supabase
    .from('products')
    .select('*')
    .in('category', getCategories(profile.current_skin_type))
    .order('savings_percentage', { ascending: false })
    .limit(4)

  let message = `🌟 **Your Personalized K-Beauty Routine:**\n`
  message += `*Based on your ${profile.current_skin_type} skin*\n\n`

  let totalSeoul = 0
  let totalUS = 0

  recommendations?.forEach((product, index) => {
    const step = getRoutineStep(index)
    message += `${step}: ${product.brand} ${product.name_english}\n`
    message += `Seoul $${product.seoul_price} (US $${product.us_price})\n\n`
    totalSeoul += product.seoul_price
    totalUS += product.us_price
  })

  message += `💰 **Total: $${totalSeoul}** (Save $${totalUS - totalSeoul}!)\n\n`
  message += `Reply "GET ROUTINE" to order everything!`

  return message
}

// Helper functions

function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false

  const hash = crypto
    .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex')

  return signature === `sha256=${hash}`
}

async function storeConversation(from: string, message: any) {
  await supabase
    .from('whatsapp_conversations')
    .insert({
      phone_number: from,
      message_type: message.type,
      message_content: message,
      timestamp: new Date().toISOString()
    })
}

async function storeProductInterest(from: string, productInfo: any) {
  await supabase
    .from('product_interests')
    .insert({
      phone_number: from,
      product_brand: productInfo.brand,
      product_name: productInfo.productName,
      category: productInfo.category,
      timestamp: new Date().toISOString()
    })
}

async function getProductPrices(productInfo: any) {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('brand', productInfo.brand)
    .ilike('name_english', `%${productInfo.productName}%`)
    .single()

  if (product) {
    return {
      seoulPrice: product.seoul_price,
      usPrice: product.us_price,
      savings: product.us_price - product.seoul_price,
      savingsPercent: product.savings_percentage
    }
  }

  // If not in database, estimate prices
  return {
    seoulPrice: 15,
    usPrice: 55,
    savings: 40,
    savingsPercent: 73
  }
}

function calculateShipping(lat: number, lon: number) {
  // Simplified shipping calculation
  // In production, integrate with real shipping APIs
  return {
    standard: 15,
    express: 35,
    priority: 55
  }
}

function getCategories(skinType: string): string[] {
  const categoryMap: Record<string, string[]> = {
    dry: ['Serum', 'Essence', 'Mask', 'Moisturizer'],
    oily: ['Cleanser', 'Toner', 'Serum', 'Moisturizer'],
    combination: ['Toner', 'Serum', 'Essence', 'Moisturizer'],
    sensitive: ['Cleanser', 'Essence', 'Mask', 'Moisturizer'],
    normal: ['Cleanser', 'Toner', 'Serum', 'Moisturizer']
  }

  return categoryMap[skinType] || categoryMap.normal
}

function getRoutineStep(index: number): string {
  const steps = ['🧼 Step 1', '💧 Step 2', '✨ Step 3', '🌙 Step 4']
  return steps[index] || `Step ${index + 1}`
}

function getHelpMenu(): string {
  return `🌟 **Seoul Sister Beauty Assistant**\n\n` +
         `Here's what I can do:\n\n` +
         `📸 **Send a photo** - I'll identify any K-beauty product\n` +
         `💬 **"Price [product]"** - Get Seoul vs US prices\n` +
         `🔄 **"Reorder"** - See your favorites\n` +
         `🧪 **"Ingredient [name]"** - Learn about ingredients\n` +
         `✨ **"Routine"** - Get personalized recommendations\n` +
         `📍 **Share location** - Calculate shipping\n\n` +
         `Just message me anytime! I'm your 24/7 K-beauty expert 💅`
}

async function sendWhatsAppMessage(to: string, message: string) {
  // Implementation would use WhatsApp Business API
  // For now, we'll queue the message
  await supabase
    .from('whatsapp_outbound_queue')
    .insert({
      to: to,
      message: message,
      status: 'pending',
      created_at: new Date().toISOString()
    })

  // In production, call WhatsApp API here
  console.log(`WhatsApp message queued for ${to}: ${message.substring(0, 100)}...`)
}

async function downloadWhatsAppImage(mediaId: string): Promise<string> {
  // In production, use WhatsApp API to download media
  // For now, return a placeholder
  return 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908'
}