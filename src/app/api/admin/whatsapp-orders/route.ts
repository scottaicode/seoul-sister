import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = (supabaseAdmin as any)
      .from('whatsapp_orders')
      .select(`
        *,
        whatsapp_conversations!inner (
          message_text,
          timestamp
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Failed to fetch WhatsApp orders:', error)
      return NextResponse.json({
        error: 'Failed to fetch orders',
        details: error.message
      }, { status: 500 })
    }

    // Get order statistics
    const { data: stats } = await (supabaseAdmin as any)
      .from('whatsapp_orders')
      .select('status, quote_amount')

    const orderStats = {
      total: stats?.length || 0,
      pending: stats?.filter((o: any) => o.status === 'pending').length || 0,
      confirmed: stats?.filter((o: any) => o.status === 'confirmed').length || 0,
      processing: stats?.filter((o: any) => o.status === 'processing').length || 0,
      shipped: stats?.filter((o: any) => o.status === 'shipped').length || 0,
      delivered: stats?.filter((o: any) => o.status === 'delivered').length || 0,
      total_value: stats?.reduce((sum: number, o: any) => sum + (o.quote_amount || 0), 0) || 0
    }

    return NextResponse.json({
      success: true,
      orders: orders || [],
      count: orders?.length || 0,
      statistics: orderStats,
      query: {
        status_filter: status,
        limit: limit
      }
    })

  } catch (error) {
    console.error('Error fetching WhatsApp orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { orderId, status, quoteAmount, quoteDetails, trackingNumber } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (status) updateData.status = status
    if (quoteAmount) updateData.quote_amount = quoteAmount
    if (quoteDetails) updateData.quote_details = quoteDetails
    if (trackingNumber) updateData.tracking_number = trackingNumber

    const { data: updatedOrder, error } = await (supabaseAdmin as any)
      .from('whatsapp_orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update WhatsApp order:', error)
      return NextResponse.json({
        error: 'Failed to update order',
        details: error.message
      }, { status: 500 })
    }

    // Send status update message to customer (would integrate with WhatsApp API)
    console.log(`📱 Order ${orderId} updated to status: ${status}`)

    return NextResponse.json({
      success: true,
      message: 'Order updated successfully',
      order: updatedOrder
    })

  } catch (error) {
    console.error('Error updating WhatsApp order:', error)
    return NextResponse.json(
      { error: 'Failed to update WhatsApp order' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('id')

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    const { error } = await (supabaseAdmin as any)
      .from('whatsapp_orders')
      .delete()
      .eq('id', orderId)

    if (error) {
      console.error('Failed to delete WhatsApp order:', error)
      return NextResponse.json({
        error: 'Failed to delete order',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting WhatsApp order:', error)
    return NextResponse.json(
      { error: 'Failed to delete WhatsApp order' },
      { status: 500 }
    )
  }
}