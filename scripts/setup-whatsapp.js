#!/usr/bin/env node

/**
 * WhatsApp Business API Setup Script
 * Configures webhook and verifies connectivity
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// WhatsApp configuration guide
function printSetupGuide() {
  console.log('\n📱 Seoul Sister WhatsApp AI Beauty Assistant Setup')
  console.log('=' .repeat(60))

  console.log('\n1️⃣ WhatsApp Business API Setup:')
  console.log('   • Sign up at: https://business.facebook.com')
  console.log('   • Create a WhatsApp Business App')
  console.log('   • Get your Phone Number ID and Token')

  console.log('\n2️⃣ Required Environment Variables:')
  console.log('   Add these to your .env.local file:\n')
  console.log('   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id')
  console.log('   WHATSAPP_ACCESS_TOKEN=your_access_token')
  console.log('   WHATSAPP_WEBHOOK_SECRET=seoul_sister_webhook_2025')
  console.log('   WHATSAPP_BUSINESS_ID=your_business_id')

  console.log('\n3️⃣ Webhook Configuration:')
  console.log('   • Webhook URL: https://seoulsister.com/api/whatsapp')
  console.log('   • Verify Token: seoul_sister_webhook_2025')
  console.log('   • Subscribed Fields: messages, message_status')

  console.log('\n4️⃣ Test Your Setup:')
  console.log('   • Send "Hi" to your WhatsApp Business number')
  console.log('   • Send a photo of any K-beauty product')
  console.log('   • Try "Price Laneige Water Sleeping Mask"')
  console.log('   • Share your location for shipping estimates')
}

// Create test data for WhatsApp features
async function createTestData() {
  console.log('\n🔧 Setting up test data...')

  try {
    // Test WhatsApp user
    const testUser = {
      phone_number: '+1234567890',
      first_name: 'Test',
      preferred_language: 'en',
      total_saved: 279.50,
      total_orders: 3
    }

    const { data: user, error: userError } = await supabase
      .from('whatsapp_users')
      .upsert(testUser, { onConflict: 'phone_number' })
      .select()
      .single()

    if (userError) {
      console.error('Error creating test user:', userError)
    } else {
      console.log('✅ Created test WhatsApp user')
    }

    // Test product identification
    const testIdentification = {
      phone_number: '+1234567890',
      identified_brand: 'COSRX',
      identified_product: 'Snail 96 Mucin Essence',
      category: 'Essence',
      ai_confidence: 0.95,
      seoul_price: 12,
      us_price: 89,
      savings_amount: 77
    }

    const { error: idError } = await supabase
      .from('product_identifications')
      .insert(testIdentification)

    if (!idError) {
      console.log('✅ Created test product identification')
    }

    // Test conversation
    const testConversation = {
      phone_number: '+1234567890',
      message_type: 'text',
      message_content: {
        text: 'What is the price of Laneige Water Sleeping Mask?'
      },
      response_sent: '💰 Laneige Water Sleeping Mask\nSeoul: $12 | US: $34\nYou save: $22 (65%)\n\nReply ORDER to get it at Seoul price!'
    }

    const { error: convError } = await supabase
      .from('whatsapp_conversations')
      .insert(testConversation)

    if (!convError) {
      console.log('✅ Created test conversation')
    }

    console.log('\n✨ Test data created successfully!')

  } catch (error) {
    console.error('Error setting up test data:', error)
  }
}

// Verify WhatsApp webhook endpoint
async function verifyWebhook() {
  console.log('\n🔍 Verifying webhook endpoint...')

  const webhookUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
  const verifyUrl = `${webhookUrl}/api/whatsapp?hub.mode=subscribe&hub.verify_token=seoul_sister_webhook_2025&hub.challenge=test_challenge`

  try {
    const response = await fetch(verifyUrl)
    const text = await response.text()

    if (response.ok && text === 'test_challenge') {
      console.log('✅ Webhook verification endpoint is working!')
    } else {
      console.log('⚠️ Webhook verification failed. Response:', text)
    }
  } catch (error) {
    console.log('⚠️ Could not reach webhook endpoint. Is the server running?')
  }
}

// Sample WhatsApp message templates
function createMessageTemplates() {
  console.log('\n📝 Sample WhatsApp Message Templates:')
  console.log('=' .repeat(60))

  const templates = {
    welcome: `🌟 Welcome to Seoul Sister AI Beauty Assistant!

I'm your personal K-beauty expert, available 24/7 to help you save 70% on authentic Korean skincare.

Here's what I can do:
📸 Identify any K-beauty product from a photo
💰 Compare Seoul vs US prices instantly
🔄 Reorder your favorites with one word
🧪 Analyze ingredients for your skin type
📍 Calculate shipping to your location

Send me a photo of any Korean beauty product to start!`,

    productFound: `🎯 **Product Identified!**

📦 COSRX Snail 96 Mucin Essence

💰 **Price Comparison:**
Seoul: $12 🟢
Sephora: $89 🔴
**You save: $77 (87%)**

🧪 Key ingredients: 96% Snail Secretion Filtrate

Reply "ORDER" to add to your Seoul Sister cart!`,

    routineRecommendation: `✨ **Your Personalized K-Beauty Routine**
*Based on your combination skin*

🧼 Step 1: Beauty of Joseon Cleansing Balm
Seoul $8 (US $28)

💧 Step 2: COSRX Snail 96 Mucin Essence
Seoul $12 (US $89)

✨ Step 3: Beauty of Joseon Glow Deep Serum
Seoul $8.50 (US $45)

🌙 Step 4: Laneige Water Sleeping Mask
Seoul $12 (US $34)

💰 **Total: $40.50** (Save $155.50!)

Reply "GET ROUTINE" to order everything!`
  }

  console.log('\n📱 Welcome Message:')
  console.log(templates.welcome)

  console.log('\n📱 Product Identification Response:')
  console.log(templates.productFound)

  console.log('\n📱 Routine Recommendation:')
  console.log(templates.routineRecommendation)
}

// Main setup function
async function main() {
  console.log('🚀 Starting WhatsApp AI Beauty Assistant Setup...\n')

  // Print setup guide
  printSetupGuide()

  // Create test data
  await createTestData()

  // Verify webhook
  await verifyWebhook()

  // Show message templates
  createMessageTemplates()

  console.log('\n✅ WhatsApp setup complete!')
  console.log('\n📱 Next Steps:')
  console.log('1. Configure WhatsApp Business API credentials')
  console.log('2. Set up webhook in Meta Business Suite')
  console.log('3. Test with a real WhatsApp message')
  console.log('4. Monitor conversations in the admin dashboard')

  console.log('\n💬 WhatsApp Number Format:')
  console.log('   US: +1 XXX XXX XXXX')
  console.log('   Korea: +82 XX XXXX XXXX')
  console.log('   Singapore: +65 XXXX XXXX')

  console.log('\n🎯 Expected User Journey:')
  console.log('1. User sends product photo via WhatsApp')
  console.log('2. AI identifies product & shows price comparison')
  console.log('3. User sees 70% savings opportunity')
  console.log('4. User orders at Seoul price')
  console.log('5. System tracks for personalized recommendations')

  console.log('\n📊 Analytics to Track:')
  console.log('• Product identification accuracy')
  console.log('• Conversion rate from price check to order')
  console.log('• Most requested products')
  console.log('• Average savings per user')
  console.log('• Reorder frequency')
}

// Run setup
main().then(() => {
  process.exit(0)
}).catch(error => {
  console.error('Setup failed:', error)
  process.exit(1)
})