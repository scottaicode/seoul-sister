import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappClient } from '@/lib/whatsapp/client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '50')
    const phoneNumber = searchParams.get('phoneNumber')
    const userId = searchParams.get('userId')

    let query = supabase
      .from('whatsapp_orders')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email,
          subscription_status
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (phoneNumber) {
      query = query.eq('phone_number', phoneNumber)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: orders, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      orders: orders || [],
      count: orders?.length || 0,
      status: status === 'all' ? 'all statuses' : status
    })

  } catch (error) {
    console.error('❌ Error fetching WhatsApp orders:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch WhatsApp orders',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      phoneNumber,
      customerName,
      productNumbers,
      productRequests,
      orderMessage,
      skinType,
      preferences,
      budgetRange,
      urgency = 'medium'
    } = await request.json()

    if (!phoneNumber || !customerName) {
      return NextResponse.json(
        { error: 'Phone number and customer name are required' },
        { status: 400 }
      )
    }

    if (!productNumbers && !productRequests) {
      return NextResponse.json(
        { error: 'Either product numbers or product requests are required' },
        { status: 400 }
      )
    }

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from('whatsapp_orders')
      .insert({
        user_id: userId || null,
        phone_number: phoneNumber,
        customer_name: customerName,
        product_numbers: productNumbers || [],
        product_requests: productRequests || [],
        order_message: orderMessage || '',
        skin_type: skinType || null,
        preferences: preferences || [],
        budget_range: budgetRange || null,
        urgency,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (orderError) {
      throw orderError
    }

    // Send order confirmation to customer
    await whatsappClient.sendMessage({
      to: phoneNumber,
      type: 'text',
      text: {
        body: `🎉 Order received!

📋 Order #${order.id.slice(-8).toUpperCase()}
👤 Customer: ${customerName}
${productNumbers ? `📦 Products: ${productNumbers.join(', ')}` : ''}
${productRequests ? `🛍️ Requests: ${productRequests.join(', ')}` : ''}

Our Seoul team is preparing your personalized quote with:
• Authentic product verification
• Current wholesale pricing
• Shipping costs to your location
• Estimated delivery timeline

⏱️ You'll receive a detailed quote within 2-4 hours!

Need to modify your order? Just send me a message! 💕`
      }
    })

    // Log order creation to conversations
    await supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: userId || null,
        phone_number: phoneNumber,
        message_text: `Order created: #${order.id.slice(-8).toUpperCase()}`,
        direction: 'outgoing',
        timestamp: new Date().toISOString()
      })

    console.log(`📦 New WhatsApp order created: #${order.id}`)

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.id.slice(-8).toUpperCase(),
        status: order.status,
        phoneNumber: order.phone_number,
        customerName: order.customer_name,
        createdAt: order.created_at
      },
      message: 'WhatsApp order created successfully'
    })

  } catch (error) {
    console.error('❌ Error creating WhatsApp order:', error)
    return NextResponse.json(
      {
        error: 'Failed to create WhatsApp order',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const {
      orderId,
      status,
      orderTotal,
      shippingCost,
      estimatedDelivery,
      trackingNumber,
      notes,
      adminNotes
    } = await request.json()

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Update order
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (status) updateData.status = status
    if (orderTotal !== undefined) updateData.order_total = orderTotal
    if (shippingCost !== undefined) updateData.shipping_cost = shippingCost
    if (estimatedDelivery) updateData.estimated_delivery = estimatedDelivery
    if (trackingNumber) updateData.tracking_number = trackingNumber
    if (notes) updateData.notes = notes
    if (adminNotes) updateData.admin_notes = adminNotes

    const { data: order, error: updateError } = await supabase
      .from('whatsapp_orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Send status update to customer if status changed
    if (status && order) {
      await sendOrderStatusUpdate(order, status)
    }

    return NextResponse.json({
      success: true,
      order,
      message: 'WhatsApp order updated successfully'
    })

  } catch (error) {
    console.error('❌ Error updating WhatsApp order:', error)
    return NextResponse.json(
      {
        error: 'Failed to update WhatsApp order',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

async function sendOrderStatusUpdate(order: any, status: string) {
  try {
    let messageText = ''

    switch (status) {
      case 'quoted':
        messageText = `💰 *Quote Ready!*

📋 Order #${order.id.slice(-8).toUpperCase()}
💵 Total: $${order.order_total}
🚚 Shipping: $${order.shipping_cost}
📅 Delivery: ${order.estimated_delivery}

Reply "confirm" to proceed with payment, or let me know if you have any questions! 💕`
        break

      case 'confirmed':
        messageText = `✅ *Order Confirmed!*

📋 Order #${order.id.slice(-8).toUpperCase()}
💰 Total: $${order.order_total}
📦 Processing: 1-2 business days
📅 Estimated delivery: ${order.estimated_delivery}

Your authentic K-beauty products are being prepared by our Seoul team! 🌸`
        break

      case 'processing':
        messageText = `⚡ *Order Processing*

📋 Order #${order.id.slice(-8).toUpperCase()}
🏭 Status: Being prepared in Seoul
📅 Estimated shipping: 1-2 business days

Your products are being carefully selected and packaged! 📦`
        break

      case 'shipped':
        await whatsappClient.sendShippingUpdate(
          order.phone_number,
          order.tracking_number || 'TBD',
          'shipped',
          order.estimated_delivery
        )
        return

      case 'delivered':
        await whatsappClient.sendShippingUpdate(
          order.phone_number,
          order.tracking_number || '',
          'delivered'
        )
        return

      case 'cancelled':
        messageText = `❌ *Order Cancelled*

📋 Order #${order.id.slice(-8).toUpperCase()}
💔 Your order has been cancelled as requested.

If you change your mind, I'm always here to help you find amazing K-beauty products! 💕`
        break

      default:
        messageText = `📋 Order #${order.id.slice(-8).toUpperCase()} status: ${status}`
    }

    if (messageText) {
      await whatsappClient.sendMessage({
        to: order.phone_number,
        type: 'text',
        text: { body: messageText }
      })
    }

  } catch (error) {
    console.error('❌ Error sending order status update:', error)
  }
}