import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, createCustomer } from '@/lib/stripe-server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const {
      phoneNumber,
      productId,
      customerEmail,
      customerName,
      shippingAddress
    } = await request.json()

    // Validation
    if (!phoneNumber || !productId) {
      return NextResponse.json({
        error: 'Missing required fields: phoneNumber, productId'
      }, { status: 400 })
    }

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        error: 'Product not found'
      }, { status: 404 })
    }

    // For subscription model, orders are included in monthly subscription
    const productPrice = product.seoul_price
    const totalAmount = productPrice

    // Get or create customer profile
    let customerProfile = await getOrCreateCustomerProfile(
      phoneNumber,
      customerEmail,
      customerName
    )

    // Check if user has active subscription
    const hasActiveSubscription = customerProfile.subscription_status === 'active' ||
                                 customerProfile.subscription_status === 'trialing'

    if (!hasActiveSubscription) {
      return NextResponse.json({
        error: 'Active subscription required',
        message: 'Please subscribe to Seoul Sister Premium to place orders at wholesale prices.',
        subscriptionRequired: true
      }, { status: 402 })
    }

    // Create order in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerProfile.id,
        product_id: productId,
        product_name: `${product.brand} - ${product.name_english}`,
        seoul_price: productPrice,
        total_amount: totalAmount,
        status: 'confirmed',
        whatsapp_conversation_id: phoneNumber,
        quantity: 1,
        shipping_address: shippingAddress,
        notes: `Order from WhatsApp: ${phoneNumber} (Seoul Sister Premium subscriber)`,
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json({
        error: 'Failed to create order'
      }, { status: 500 })
    }

    // For subscription model, no per-order payment needed
    // Orders are covered under the monthly subscription

    // Log successful order for analytics
    await supabase
      .from('ai_customer_insights')
      .upsert({
        user_id: customerProfile.id,
        conversation_history: {
          orders: [order.id],
          last_order_date: new Date().toISOString(),
          products_ordered: [productId],
        }
      })

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        product_name: order.product_name,
        total_amount: order.total_amount,
        status: order.status,
        payment_status: 'included_in_subscription'
      },
      customer: {
        id: customerProfile.id,
        subscription_status: customerProfile.subscription_status
      }
    })

  } catch (error) {
    console.error('Order processing error:', error)
    return NextResponse.json(
      { error: 'Order processing failed', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve order status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const phoneNumber = searchParams.get('phoneNumber')

    if (!orderId && !phoneNumber) {
      return NextResponse.json({
        error: 'Either orderId or phoneNumber is required'
      }, { status: 400 })
    }

    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customer_id (
          id,
          email,
          name,
          phone
        )
      `)

    if (orderId) {
      query = query.eq('id', orderId)
    } else if (phoneNumber) {
      query = query.eq('whatsapp_conversation_id', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(10)
    }

    const { data: orders, error } = await query

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch orders'
      }, { status: 500 })
    }

    return NextResponse.json({
      orders: orders || [],
      count: orders?.length || 0
    })

  } catch (error) {
    console.error('Order retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve orders' },
      { status: 500 }
    )
  }
}

// Helper function to get or create customer profile
async function getOrCreateCustomerProfile(
  phoneNumber: string,
  email?: string,
  name?: string
) {
  // First try to find by phone number
  let { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('phone', phoneNumber)
    .single()

  if (!profile) {
    // Create new profile
    const { data: newProfile, error } = await supabase
      .from('user_profiles')
      .insert({
        phone: phoneNumber,
        email: email,
        name: name,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create customer profile: ${error.message}`)
    }

    profile = newProfile
  } else if (email && !profile.email) {
    // Update profile with email if not set
    const { data: updatedProfile } = await supabase
      .from('user_profiles')
      .update({ email, name })
      .eq('id', profile.id)
      .select()
      .single()

    profile = updatedProfile || profile
  }

  return profile
}