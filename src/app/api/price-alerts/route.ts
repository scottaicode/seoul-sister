import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, productId, targetPrice } = body

    // Create price alert
    const { data, error } = await supabase
      .from('deal_alerts')
      .insert({
        user_id: userId,
        product_id: productId,
        target_price: targetPrice,
        alert_when_available: true,
        alert_on_any_discount: true,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, alert: data })
  } catch (error) {
    console.error('Price alert error:', error)
    return NextResponse.json(
      { error: 'Failed to create price alert' },
      { status: 500 }
    )
  }
}

// Check for price drops (called by cron job)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Verify cron secret
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active alerts
    const { data: alerts } = await supabase
      .from('deal_alerts')
      .select(`
        *,
        products (
          id,
          name_english,
          best_price_found,
          best_retailer
        )
      `)
      .eq('is_active', true)

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ message: 'No active alerts' })
    }

    const notifications: any[] = []

    for (const alert of alerts) {
      const product = alert.products
      if (!product) continue

      // Check if price dropped below target
      if (alert.target_price && product.best_price_found <= alert.target_price) {
        notifications.push({
          userId: alert.user_id,
          productName: product.name_english,
          currentPrice: product.best_price_found,
          targetPrice: alert.target_price,
          retailer: product.best_retailer,
          alertId: alert.id
        })

        // Update last triggered
        await supabase
          .from('deal_alerts')
          .update({ last_triggered: new Date().toISOString() })
          .eq('id', alert.id)
      }
    }

    // Send notifications (integrate with email/SMS/push service)
    if (notifications.length > 0) {
      await sendPriceDropNotifications(notifications)
    }

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length
    })
  } catch (error) {
    console.error('Price check error:', error)
    return NextResponse.json(
      { error: 'Failed to check prices' },
      { status: 500 }
    )
  }
}

async function sendPriceDropNotifications(notifications: any[]) {
  // This would integrate with your notification service
  // For now, just log them
  console.log('Price drop notifications:', notifications)

  // In production, you'd send emails/SMS/push notifications here
  // Example with email service:
  /*
  for (const notification of notifications) {
    await sendEmail({
      to: getUserEmail(notification.userId),
      subject: `Price Drop Alert: ${notification.productName}`,
      body: `Great news! ${notification.productName} is now ${notification.currentPrice} at ${notification.retailer}. You wanted to know when it dropped below ${notification.targetPrice}.`
    })
  }
  */
}