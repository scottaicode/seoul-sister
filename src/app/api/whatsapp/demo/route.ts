import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister WhatsApp Business API Demo',
    description: 'Demonstrates the WhatsApp ordering flow for premium members',
    endpoints: {
      'POST /api/whatsapp/demo/simulate-message': 'Simulate incoming WhatsApp message',
      'POST /api/whatsapp/demo/simulate-order': 'Simulate product order request',
      'GET /api/whatsapp/demo/conversation': 'View simulated conversation history'
    },
    features: [
      'Premium membership validation',
      'AI-powered product identification',
      'Seoul wholesale pricing',
      'Order management system',
      'Personalized recommendations'
    ]
  })
}

export async function POST(request: NextRequest) {
  try {
    const { action, phoneNumber, message, customerName } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    switch (action) {
      case 'simulate_welcome':
        return handleWelcomeMessage(phoneNumber, customerName)

      case 'simulate_product_inquiry':
        return handleProductInquiry(phoneNumber, message)

      case 'simulate_order':
        return handleOrderSimulation(phoneNumber, message)

      case 'check_subscription':
        return checkSubscriptionStatus(phoneNumber)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Demo API error:', error)
    return NextResponse.json(
      { error: 'Failed to process demo request' },
      { status: 500 }
    )
  }
}

async function handleWelcomeMessage(phoneNumber: string, customerName?: string) {
  // Simulate premium user welcome
  const welcomeMessage = `🌸 Welcome to Seoul Sister, ${customerName || 'there'}!

I'm your personal K-beauty advisor based in Seoul. I'm here to help you discover authentic Korean beauty products at wholesale prices - typically 70% less than US retail!

💝 As a premium member, you get:
• Exclusive access to Seoul wholesale pricing
• Personalized product recommendations
• Authentic products sourced directly from Korean distributors
• Fast shipping from Seoul to your door

Ready to start shopping? Just tell me:
1. What skincare concerns you'd like to address
2. Your current routine (if any)
3. Your budget range

I'll curate the perfect K-beauty haul for you! ✨`

  // Log the conversation
  if (supabaseAdmin) {
    await supabaseAdmin
      .from('whatsapp_conversations')
      .insert({
        phone_number: phoneNumber,
        message_text: welcomeMessage,
        direction: 'outgoing',
        message_type: 'welcome'
      })
  }

  return NextResponse.json({
    success: true,
    response: 'welcome_sent',
    message: welcomeMessage,
    next_steps: [
      'Customer can describe skin concerns',
      'Customer can ask for specific products',
      'Customer can inquire about pricing'
    ]
  })
}

async function handleProductInquiry(phoneNumber: string, inquiry: string) {
  // Simulate AI product identification
  const products = [
    {
      name: 'Snail 96 Mucin Power Essence',
      brand: 'COSRX',
      seoul_price: 8.00,
      us_retail: 25.00,
      description: 'Hydrating essence with 96% snail mucin for repair and moisture',
      benefits: ['Hydration', 'Skin repair', 'Anti-aging', 'Acne healing']
    },
    {
      name: 'Dynasty Cream',
      brand: 'Beauty of Joseon',
      seoul_price: 12.00,
      us_retail: 35.00,
      description: 'Rich moisturizer with rice bran and alpha arbutin',
      benefits: ['Deep moisturizing', 'Brightening', 'Anti-aging', 'Traditional herbs']
    },
    {
      name: 'First Care Activating Serum',
      brand: 'Sulwhasoo',
      seoul_price: 28.00,
      us_retail: 94.00,
      description: 'Luxury serum with Korean herbal ingredients',
      benefits: ['Premium anti-aging', 'Skin texture', 'Radiance', 'Traditional luxury']
    }
  ]

  // Pick a relevant product based on inquiry keywords
  let selectedProduct = products[0] // Default
  if (inquiry.toLowerCase().includes('dynasty') || inquiry.toLowerCase().includes('joseon')) {
    selectedProduct = products[1]
  } else if (inquiry.toLowerCase().includes('sulwhasoo') || inquiry.toLowerCase().includes('luxury')) {
    selectedProduct = products[2]
  }

  const serviceFee = 25
  const total = selectedProduct.seoul_price + serviceFee
  const savings = selectedProduct.us_retail - total
  const savingsPercent = Math.round((savings / selectedProduct.us_retail) * 100)

  const responseMessage = `✨ *Product Found!*

*${selectedProduct.brand} - ${selectedProduct.name}*

🇰🇷 *Seoul Price:* $${selectedProduct.seoul_price.toFixed(2)}
💼 *Service Fee:* $${serviceFee.toFixed(2)}
💳 *Your Total:* $${total.toFixed(2)}

💰 *You Save:* $${savings.toFixed(2)} (${savingsPercent}%) vs US retail

📝 *About this product:*
${selectedProduct.description}

🎯 *Benefits:* ${selectedProduct.benefits.join(', ')}

This is the authentic product at real Seoul street prices!

Want to order this? Reply "ORDER" and I'll process it for you.

Need something else? Send me another product! 📸`

  // Log the conversation
  if (supabaseAdmin) {
    await supabaseAdmin
      .from('whatsapp_conversations')
      .insert([
        {
          phone_number: phoneNumber,
          message_text: inquiry,
          direction: 'incoming',
          message_type: 'product_inquiry'
        },
        {
          phone_number: phoneNumber,
          message_text: responseMessage,
          direction: 'outgoing',
          message_type: 'product_response'
        }
      ])
  }

  return NextResponse.json({
    success: true,
    response: 'product_identified',
    message: responseMessage,
    product: selectedProduct,
    pricing: {
      seoul_price: selectedProduct.seoul_price,
      service_fee: serviceFee,
      total: total,
      savings: savings,
      savings_percent: savingsPercent
    }
  })
}

async function handleOrderSimulation(phoneNumber: string, orderMessage: string) {
  // Create a simulated order
  const orderId = `SS${Date.now().toString().slice(-6)}`

  const confirmationMessage = `🎉 *Order Confirmed!*

📋 Order #${orderId}

*Your Seoul Sister Haul:*
• 1x COSRX Snail 96 Mucin Essence - $33.00

💰 *Total: $33.00*

📦 *Shipping Info:*
• Processing time: 1-2 business days
• Estimated delivery: 7-10 days
• Tracking info will be sent soon

🌸 Your authentic K-beauty products are being carefully prepared by our Seoul team!

Need to modify your order? Reply within 2 hours. Questions? I'm here to help! 💕`

  // Log the order
  if (supabaseAdmin) {
    await supabaseAdmin
      .from('whatsapp_orders')
      .insert({
        phone_number: phoneNumber,
        customer_name: 'Demo Customer',
        product_numbers: [1],
        status: 'confirmed',
        order_message: orderMessage,
        quote_amount: 33.00
      })

    await supabaseAdmin
      .from('whatsapp_conversations')
      .insert([
        {
          phone_number: phoneNumber,
          message_text: orderMessage,
          direction: 'incoming',
          message_type: 'order_request'
        },
        {
          phone_number: phoneNumber,
          message_text: confirmationMessage,
          direction: 'outgoing',
          message_type: 'order_confirmation'
        }
      ])
  }

  return NextResponse.json({
    success: true,
    response: 'order_confirmed',
    message: confirmationMessage,
    order: {
      id: orderId,
      status: 'confirmed',
      amount: 33.00,
      processing_time: '1-2 business days',
      estimated_delivery: '7-10 days'
    }
  })
}

async function checkSubscriptionStatus(phoneNumber: string) {
  // Simulate subscription check
  const isPremium = Math.random() > 0.3 // 70% chance of being premium for demo

  if (isPremium) {
    return NextResponse.json({
      success: true,
      has_subscription: true,
      subscription_type: 'premium',
      status: 'active',
      message: 'User has active premium subscription - full access granted'
    })
  } else {
    const subscriptionPrompt = `👋 Hi there!

I'm your Seoul Sister personal K-beauty advisor! I'd love to help you discover authentic Korean beauty products at wholesale prices.

💎 To access our exclusive WhatsApp ordering service, you'll need a Seoul Sister Premium membership ($20/month with 7-day free trial).

✨ Premium includes:
• Personal WhatsApp shopping service
• 70% savings on authentic K-beauty
• AI skin analysis & recommendations
• Direct sourcing from Seoul distributors

🚀 Start your free trial: ${process.env.NEXT_PUBLIC_BASE_URL || 'https://seoulsister.com'}/signup

Already a member? Let me help you find amazing products! 💕`

    return NextResponse.json({
      success: true,
      has_subscription: false,
      subscription_type: null,
      status: 'inactive',
      message: subscriptionPrompt,
      action_required: 'subscription_needed'
    })
  }
}