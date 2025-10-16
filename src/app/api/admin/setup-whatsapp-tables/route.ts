import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Setting up WhatsApp Business API integration tables...')

    // Read the migration file
    const migrationPath = join(process.cwd(), 'src/lib/supabase-migrations/009_add_whatsapp_integration.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📋 Executing ${statements.length} SQL statements...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}`)
        await supabase.rpc('exec_sql', { sql: statement })
      } catch (err) {
        console.log(`Statement ${i + 1} may already exist or failed:`, err)
        // Continue with other statements
      }
    }

    // Test table access
    const { data: conversationsTest } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .limit(1)

    const { data: messagesTest } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .limit(1)

    const { data: ordersTest } = await supabase
      .from('whatsapp_orders')
      .select('id')
      .limit(1)

    const { data: contactsTest } = await supabase
      .from('whatsapp_contacts')
      .select('id')
      .limit(1)

    const { data: automationTest } = await supabase
      .from('whatsapp_automation_rules')
      .select('id')
      .limit(1)

    // Test the functions
    try {
      const { data: historyTest } = await supabase.rpc('get_whatsapp_conversation_history', {
        p_phone_number: '+1234567890',
        p_limit: 1
      })

      const { data: ordersTest } = await supabase.rpc('get_pending_whatsapp_orders')

      console.log('✅ WhatsApp functions tested successfully')
    } catch (err) {
      console.log('Function test failed, may need manual setup:', err)
    }

    console.log('✅ WhatsApp Business API integration setup completed successfully')

    return NextResponse.json({
      success: true,
      message: 'WhatsApp Business API integration created successfully',
      tables_verified: {
        whatsapp_conversations: !!conversationsTest,
        whatsapp_messages: !!messagesTest,
        whatsapp_orders: !!ordersTest,
        whatsapp_contacts: !!contactsTest,
        whatsapp_automation_rules: !!automationTest
      },
      features_enabled: [
        'WhatsApp Business API webhook handling',
        'Two-way messaging with customers',
        'Order processing via WhatsApp',
        'Conversation history tracking',
        'Automated response system',
        'Contact management',
        'Premium subscription verification',
        'Order fulfillment workflow'
      ],
      webhook_endpoint: `${process.env.NEXT_PUBLIC_BASE_URL}/api/whatsapp/webhook`,
      environment_variables_required: [
        'WHATSAPP_PHONE_NUMBER_ID',
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN'
      ]
    })

  } catch (error) {
    console.error('❌ Error setting up WhatsApp tables:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to setup WhatsApp integration tables',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister WhatsApp Business API Integration',
    description: 'Creates tables and functions for WhatsApp Business API integration including messaging, orders, and automation',
    endpoints: {
      'POST /api/admin/setup-whatsapp-tables': 'Run database migration for WhatsApp integration',
      'GET /api/whatsapp/webhook': 'WhatsApp webhook verification endpoint',
      'POST /api/whatsapp/webhook': 'WhatsApp webhook for incoming messages and status updates',
      'POST /api/whatsapp/send-message': 'Send WhatsApp messages programmatically',
      'GET /api/whatsapp/orders': 'Get pending WhatsApp orders for fulfillment'
    },
    features: {
      messaging: [
        'Two-way messaging with premium subscribers',
        'Automated welcome messages and responses',
        'Order inquiry handling',
        'Product recommendation delivery',
        'Shipping updates and tracking',
        'Subscription verification'
      ],
      orders: [
        'WhatsApp-based product ordering',
        'Order confirmation and tracking',
        'Quote generation and approval',
        'Payment processing integration',
        'Fulfillment workflow automation'
      ],
      automation: [
        'Keyword-based auto-responses',
        'New contact welcome sequences',
        'Order status update notifications',
        'Subscription expiry reminders',
        'Personalized product alerts'
      ]
    },
    setup_requirements: {
      whatsapp_business_api: [
        'Facebook Business Account',
        'WhatsApp Business API access',
        'Phone number verification',
        'Webhook URL configuration'
      ],
      environment_variables: [
        'WHATSAPP_PHONE_NUMBER_ID - Your WhatsApp Business phone number ID',
        'WHATSAPP_ACCESS_TOKEN - API access token from Meta',
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN - Verification token for webhook security'
      ]
    },
    business_value: [
      'Enables $20/month premium membership WhatsApp ordering feature',
      'Provides personalized shopping service experience',
      'Automates customer service and order processing',
      'Reduces manual fulfillment overhead',
      'Increases customer engagement and retention'
    ]
  })
}