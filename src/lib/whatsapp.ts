import { Anthropic } from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface WhatsAppMessage {
  from: string
  text?: string
  image?: string
  timestamp: number
}

export interface ProductIdentification {
  productName: string
  brand: string
  confidence: number
  matchedProduct?: {
    id: string
    name_english: string
    brand: string
    seoul_price: number
  }
  suggestions?: string[]
}

export class WhatsAppService {
  private webhookSecret: string

  constructor() {
    this.webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET || ''
  }

  async verifyWebhook(signature: string, payload: string): Promise<boolean> {
    // Implement webhook verification logic
    // This would typically involve HMAC verification with your webhook secret
    return true // Simplified for demo
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      // WhatsApp Business API call to send message
      const response = await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: {
            body: message
          }
        })
      })

      return response.ok
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      return false
    }
  }

  async identifyProductFromText(text: string): Promise<ProductIdentification> {
    try {
      const prompt = `
You are a Korean beauty product expert. Analyze this customer message and identify what Korean beauty product they're looking for.

Customer message: "${text}"

Respond with a JSON object containing:
- productName: The specific product name
- brand: The brand name
- confidence: Confidence score 0-1
- suggestions: Array of clarifying questions if confidence is low

Focus on popular K-beauty brands like: Sulwhasoo, Laneige, COSRX, Beauty of Joseon, Innisfree, The Ordinary, Klairs, Purito, Some By Mi, Missha, Etude House, Tony Lab AC, Dr. Jart+, SK-II.
`

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const result = JSON.parse(content.text)
        return {
          productName: result.productName,
          brand: result.brand,
          confidence: result.confidence,
          suggestions: result.suggestions
        }
      }

      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error identifying product from text:', error)
      return {
        productName: '',
        brand: '',
        confidence: 0,
        suggestions: ['Could you please provide more details about the specific product you\'re looking for?']
      }
    }
  }

  async identifyProductFromImage(imageUrl: string, text?: string): Promise<ProductIdentification> {
    try {
      const prompt = `
You are a Korean beauty product expert. Analyze this product image and identify the Korean beauty product.

${text ? `Additional context from customer: "${text}"` : ''}

Respond with a JSON object containing:
- productName: The specific product name
- brand: The brand name
- confidence: Confidence score 0-1
- suggestions: Array of clarifying questions if confidence is low

Focus on identifying text on packaging, brand logos, and product characteristics to match against popular K-beauty products.
`

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageUrl // This should be base64 encoded image data
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const result = JSON.parse(content.text)
        return {
          productName: result.productName,
          brand: result.brand,
          confidence: result.confidence,
          suggestions: result.suggestions
        }
      }

      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error identifying product from image:', error)
      return {
        productName: '',
        brand: '',
        confidence: 0,
        suggestions: ['I couldn\'t identify the product from the image. Could you tell me the brand and product name?']
      }
    }
  }

  async generateOrderConfirmation(
    productName: string,
    brand: string,
    seoulPrice: number,
    serviceFee: number = 25
  ): Promise<string> {
    const total = seoulPrice + serviceFee
    const estimatedSavings = Math.round((total * 0.6)) // Estimated US retail price

    return `🎉 *Order Confirmation*

*Product:* ${brand} - ${productName}
*Seoul Price:* $${seoulPrice.toFixed(2)}
*Service Fee:* $${serviceFee.toFixed(2)}
*Total:* $${total.toFixed(2)}

💰 *Estimated Savings:* $${estimatedSavings.toFixed(2)} vs US retail

We'll source this directly from Seoul and ship to you within 7-10 business days. Your saved payment method will be charged once we confirm availability.

Reply "CONFIRM" to proceed with this order or "CANCEL" to cancel.

Questions? Just ask! 🇰🇷✨`
  }

  async generatePricingResponse(productName: string, brand: string, seoulPrice: number): Promise<string> {
    const serviceFee = 25
    const total = seoulPrice + serviceFee

    return `✨ *Product Found!*

*${brand} - ${productName}*

🇰🇷 *Seoul Price:* $${seoulPrice.toFixed(2)}
💼 *Service Fee:* $${serviceFee.toFixed(2)}
💳 *Your Total:* $${total.toFixed(2)}

This is the authentic product at real Seoul street prices!

Want to order this? Reply "ORDER" and I'll process it for you.

Need something else? Send me another product! 📸`
  }

  formatWelcomeMessage(customerName?: string): string {
    return `🇰🇷 Welcome to Seoul Sister! ${customerName ? `Hi ${customerName}!` : 'Hi there!'}

I'm your personal K-beauty shopping assistant. Send me:

📸 *Screenshots* of products you want
📝 *Product names* or descriptions
🛍️ *"I want..."* followed by what you're looking for

I'll find the authentic products in Seoul and quote you the real prices - usually 40-70% less than US retail!

What Korean beauty product can I help you find today? ✨`
  }

  formatErrorMessage(): string {
    return `Sorry, I didn't understand that! 😅

Try sending me:
📸 A screenshot of the product
📝 The brand and product name
🛍️ "I want [product name]"

I'm here to help you save money on authentic K-beauty! What are you looking for? 🇰🇷✨`
  }
}