// Using fetch API instead of axios to avoid external dependencies

export interface WhatsAppMessage {
  to: string
  type: 'text' | 'template' | 'interactive'
  text?: {
    body: string
  }
  template?: {
    name: string
    language: {
      code: string
    }
    components?: any[]
  }
  interactive?: {
    type: 'button' | 'list'
    body: {
      text: string
    }
    action: any
  }
}

export interface WhatsAppContact {
  phone: string
  name?: string
  profilePicture?: string
  lastSeen?: Date
  isOnline?: boolean
}

export interface OrderRequest {
  userId?: string
  phoneNumber: string
  customerName: string
  productRequests: string[]
  skinType?: string
  preferences?: string[]
  budget?: number
  urgency?: 'low' | 'medium' | 'high'
}

class WhatsAppBusinessClient {
  private baseURL: string
  private phoneNumberId: string
  private accessToken: string
  private webhookVerifyToken: string

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || ''
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || ''
    this.baseURL = `https://graph.facebook.com/v18.0/${this.phoneNumberId}`
  }

  async sendMessage(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`📱 Sending WhatsApp message to ${message.to}`)

      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to send message')
      }

      console.log('✅ WhatsApp message sent successfully:', data)
      return {
        success: true,
        messageId: data.messages[0]?.id
      }
    } catch (error: any) {
      console.error('❌ Failed to send WhatsApp message:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async sendWelcomeMessage(phoneNumber: string, customerName: string): Promise<{ success: boolean; error?: string }> {
    const message: WhatsAppMessage = {
      to: phoneNumber,
      type: 'text',
      text: {
        body: `🌸 Welcome to Seoul Sister, ${customerName}!

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
      }
    }

    return await this.sendMessage(message)
  }

  async sendProductRecommendations(
    phoneNumber: string,
    recommendations: Array<{
      name: string
      brand: string
      price: number
      originalPrice?: number
      description: string
      benefits: string[]
    }>
  ): Promise<{ success: boolean; error?: string }> {

    let messageText = '🎯 *Perfect K-Beauty Matches for You!*\n\nBased on your skin profile, here are my top recommendations:\n\n'

    recommendations.forEach((product, index) => {
      const savings = product.originalPrice ? product.originalPrice - product.price : 0
      const savingsPercent = product.originalPrice ? Math.round((savings / product.originalPrice) * 100) : 0

      messageText += `*${index + 1}. ${product.name}*\n`
      messageText += `🏷️ Brand: ${product.brand}\n`
      messageText += `💰 Seoul Price: $${product.price}`

      if (product.originalPrice) {
        messageText += ` (was $${product.originalPrice} - Save ${savingsPercent}%!)`
      }

      messageText += `\n✨ ${product.description}\n`
      messageText += `🎯 Benefits: ${product.benefits.join(', ')}\n\n`
    })

    messageText += `📦 *Ready to order?* Just reply with the numbers of products you want (e.g., "1, 3, 5") and I'll prepare your order!\n\n`
    messageText += `💬 Questions about any product? Ask me anything - I know these products inside and out! 🇰🇷`

    const message: WhatsAppMessage = {
      to: phoneNumber,
      type: 'text',
      text: { body: messageText }
    }

    return await this.sendMessage(message)
  }

  async sendOrderConfirmation(
    phoneNumber: string,
    orderDetails: {
      orderNumber: string
      items: Array<{ name: string; price: number; quantity: number }>
      totalAmount: number
      estimatedDelivery: string
      trackingNumber?: string
    }
  ): Promise<{ success: boolean; error?: string }> {

    let itemsList = ''
    orderDetails.items.forEach(item => {
      itemsList += `• ${item.quantity}x ${item.name} - $${item.price * item.quantity}\n`
    })

    const messageText = `🎉 *Order Confirmed!*

📋 Order #${orderDetails.orderNumber}

*Your Seoul Sister Haul:*
${itemsList}
💰 *Total: $${orderDetails.totalAmount}*

📦 *Shipping Info:*
• Processing time: 1-2 business days
• Estimated delivery: ${orderDetails.estimatedDelivery}
${orderDetails.trackingNumber ? `• Tracking: ${orderDetails.trackingNumber}` : '• Tracking info will be sent soon'}

🌸 Your authentic K-beauty products are being carefully prepared by our Seoul team!

Need to modify your order? Reply within 2 hours. Questions? I'm here to help! 💕`

    const message: WhatsAppMessage = {
      to: phoneNumber,
      type: 'text',
      text: { body: messageText }
    }

    return await this.sendMessage(message)
  }

  async sendShippingUpdate(
    phoneNumber: string,
    trackingNumber: string,
    status: string,
    estimatedDelivery?: string
  ): Promise<{ success: boolean; error?: string }> {

    let statusMessage = ''
    switch (status) {
      case 'shipped':
        statusMessage = '🚀 Your Seoul Sister order has shipped!'
        break
      case 'in_transit':
        statusMessage = '✈️ Your order is on its way from Seoul!'
        break
      case 'out_for_delivery':
        statusMessage = '🚚 Your K-beauty haul is out for delivery!'
        break
      case 'delivered':
        statusMessage = '🎉 Your Seoul Sister order has been delivered!'
        break
      default:
        statusMessage = '📦 Shipping update for your order:'
    }

    const messageText = `${statusMessage}

📋 Tracking: ${trackingNumber}
${estimatedDelivery ? `📅 Expected delivery: ${estimatedDelivery}` : ''}

${status === 'delivered'
  ? '💝 Enjoy your authentic K-beauty products! Don\'t forget to share your unboxing on Instagram and tag @seoul.sister for a chance to win free products!\n\n📸 How are the products working for you? I\'d love to hear your feedback!'
  : '💕 Questions about your order? Just message me anytime!'
}`

    const message: WhatsAppMessage = {
      to: phoneNumber,
      type: 'text',
      text: { body: messageText }
    }

    return await this.sendMessage(message)
  }

  async sendSkinAnalysisResults(
    phoneNumber: string,
    analysis: {
      skinType: string
      concerns: string[]
      recommendations: string[]
      compatibleIngredients: string[]
      ingredientsToAvoid: string[]
    }
  ): Promise<{ success: boolean; error?: string }> {

    const messageText = `🔬 *Your AI Skin Analysis Results*

🧴 *Skin Type:* ${analysis.skinType}

⚠️ *Primary Concerns:*
${analysis.concerns.map(concern => `• ${concern}`).join('\n')}

💡 *Personalized Recommendations:*
${analysis.recommendations.map(rec => `• ${rec}`).join('\n')}

✅ *Your Skin Loves:*
${analysis.compatibleIngredients.slice(0, 5).join(', ')}

❌ *Ingredients to Avoid:*
${analysis.ingredientsToAvoid.slice(0, 3).join(', ')}

🎯 Based on this analysis, I'll curate products specifically for your skin! Ready to see some amazing K-beauty options that are perfect for you?

Just say "show me products" and I'll send over my top picks! ✨`

    const message: WhatsAppMessage = {
      to: phoneNumber,
      type: 'text',
      text: { body: messageText }
    }

    return await this.sendMessage(message)
  }

  async handleIncomingMessage(phoneNumber: string, message: string, contactName?: string): Promise<string> {
    const normalizedMessage = message.toLowerCase().trim()

    console.log(`📱 Received WhatsApp message from ${phoneNumber}: "${message}"`)

    // Basic auto-responses
    if (normalizedMessage.includes('hello') || normalizedMessage.includes('hi') || normalizedMessage === 'start') {
      await this.sendWelcomeMessage(phoneNumber, contactName || 'there')
      return 'welcome_sent'
    }

    if (normalizedMessage.includes('order') || normalizedMessage.includes('buy') || normalizedMessage.includes('purchase')) {
      await this.sendMessage({
        to: phoneNumber,
        type: 'text',
        text: {
          body: `🛒 Ready to place an order? Perfect!

To get you the best products for your skin, I need to know:
1. What are your main skin concerns? (acne, dryness, aging, sensitivity, etc.)
2. Current skin type? (oily, dry, combination, sensitive)
3. Any products you already love or want to avoid?
4. Budget range for this order?

Once I know this, I can curate the perfect K-beauty haul for you! ✨`
        }
      })
      return 'order_inquiry_handled'
    }

    if (normalizedMessage.includes('price') || normalizedMessage.includes('cost') || normalizedMessage.includes('how much')) {
      await this.sendMessage({
        to: phoneNumber,
        type: 'text',
        text: {
          body: `💰 *Seoul Sister Pricing*

As a premium member, you get wholesale prices that are typically 70% less than US retail!

Examples:
• Sulwhasoo First Care Activating Serum: $28 (vs $94 US retail)
• Beauty of Joseon Dynasty Cream: $12 (vs $35 US retail)
• COSRX Snail 96 Mucin Essence: $8 (vs $25 US retail)

📦 Shipping from Seoul: $15-25 depending on weight
⚡ Express shipping (3-5 days): $35-45

Want specific pricing for products? Just tell me what you're looking for! 🌸`
        }
      })
      return 'pricing_info_sent'
    }

    if (normalizedMessage.includes('shipping') || normalizedMessage.includes('delivery') || normalizedMessage.includes('tracking')) {
      await this.sendMessage({
        to: phoneNumber,
        type: 'text',
        text: {
          body: `📦 *Seoul Sister Shipping Info*

🚀 *Processing:* 1-2 business days in Seoul
✈️ *Standard Shipping:* 7-14 days ($15-25)
⚡ *Express Shipping:* 3-5 days ($35-45)

All orders include:
• Authentic product verification
• Secure packaging
• Full tracking information
• Insurance coverage

📍 We ship worldwide from our Seoul warehouse. Your tracking number will be sent as soon as your order ships!

Need to track an existing order? Send me your order number! 📋`
        }
      })
      return 'shipping_info_sent'
    }

    // For all other messages, provide helpful response
    await this.sendMessage({
      to: phoneNumber,
      type: 'text',
      text: {
        body: `Thanks for your message! 💕

I'm your personal K-beauty advisor and I'm here to help with:
🛒 Product recommendations & ordering
💰 Wholesale pricing information
📦 Shipping & tracking updates
🔬 Skin analysis & advice
❓ Any K-beauty questions

What would you like to know about? Or tell me about your skin goals and I'll find the perfect products for you! ✨`
      }
    })

    return 'general_response_sent'
  }

  verifyWebhook(token: string): boolean {
    return token === this.webhookVerifyToken
  }
}

export const whatsappClient = new WhatsAppBusinessClient()
export default WhatsAppBusinessClient