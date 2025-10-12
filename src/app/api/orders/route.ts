import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, createCustomer, chargeCustomer } from '@/lib/stripe-server'
import { SERVICE_FEE } from '@/lib/stripe'

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

    // Calculate total amount
    const productPrice = product.seoul_price
    const serviceFee = SERVICE_FEE
    const totalAmount = productPrice + serviceFee

    // Get or create customer profile
    let customerProfile = await getOrCreateCustomerProfile(
      phoneNumber,
      customerEmail,
      customerName
    )

    // Create or get Stripe customer
    if (!customerProfile.stripe_customer_id) {
      const stripeCustomer = await createCustomer(
        customerProfile.email || `${phoneNumber}@seoulsister.temp`,
        customerProfile.name || `Customer ${phoneNumber.slice(-4)}`
      )

      // Update profile with Stripe customer ID
      await supabase
        .from('user_profiles')
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq('id', customerProfile.id)

      customerProfile.stripe_customer_id = stripeCustomer.id
    }

    // Create order in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerProfile.id,
        product_id: productId,
        product_name: `${product.brand} - ${product.name_english}`,
        seoul_price: productPrice,
        service_fee: serviceFee,
        total_amount: totalAmount,
        status: 'pending',
        whatsapp_conversation_id: phoneNumber,
        quantity: 1,
        shipping_address: shippingAddress,
        notes: `Order from WhatsApp: ${phoneNumber}`,
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json({
        error: 'Failed to create order'
      }, { status: 500 })
    }

    // Process payment if customer has saved payment method
    let paymentResult = null
    try {
      if (customerProfile.stripe_customer_id) {
        paymentResult = await chargeCustomer(
          customerProfile.stripe_customer_id,
          totalAmount,
          `Seoul Sister Order: ${product.brand} - ${product.name_english}`
        )

        // Update order with payment information
        await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            stripe_payment_intent_id: paymentResult.id,
          })
          .eq('id', order.id)
      }
    } catch (paymentError) {
      console.error('Payment processing error:', paymentError)
      // Keep order as pending, will retry payment or ask for new payment method
      await supabase
        .from('orders')
        .update({
          status: 'payment_failed',
          notes: `${order.notes || ''}\nPayment failed: ${paymentError}`
        })
        .eq('id', order.id)
    }

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
        payment_status: paymentResult ? 'paid' : 'pending'
      },
      customer: {
        id: customerProfile.id,
        has_payment_method: !!customerProfile.stripe_customer_id
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