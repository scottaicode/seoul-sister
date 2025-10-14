import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// Seoul Sister Premium Membership Price ID
// This should be created in Stripe Dashboard: $20/month recurring
export const SEOUL_SISTER_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_seoul_sister_monthly'

export const createCustomer = async (email: string, name?: string) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'seoul-sister'
      }
    })
    return customer
  } catch (error) {
    console.error('Error creating Stripe customer:', error)
    throw error
  }
}

export const createSetupIntent = async (customerId: string) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    })
    return setupIntent
  } catch (error) {
    console.error('Error creating setup intent:', error)
    throw error
  }
}

export const chargeCustomer = async (
  customerId: string,
  amount: number,
  description: string,
  paymentMethodId?: string
) => {
  try {
    // Get the customer's default payment method if not specified
    let paymentMethod = paymentMethodId

    if (!paymentMethod) {
      const customer = await stripe.customers.retrieve(customerId)
      if (customer.deleted) {
        throw new Error('Customer not found')
      }

      const invoice_settings = customer.invoice_settings
      if (invoice_settings?.default_payment_method) {
        paymentMethod = invoice_settings.default_payment_method as string
      } else {
        // Get the first payment method
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        })

        if (paymentMethods.data.length === 0) {
          throw new Error('No payment method found for customer')
        }

        paymentMethod = paymentMethods.data[0].id
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethod,
      description,
      confirm: true,
      off_session: true, // This indicates it's for an off-session payment
      metadata: {
        source: 'seoul-sister-whatsapp-order'
      }
    })

    return paymentIntent
  } catch (error) {
    console.error('Error charging customer:', error)
    throw error
  }
}

export const getCustomerPaymentMethods = async (customerId: string) => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })
    return paymentMethods.data
  } catch (error) {
    console.error('Error getting payment methods:', error)
    throw error
  }
}

export const createSubscription = async (customerId: string, priceId: string, trialDays: number = 7) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId,
      }],
      trial_period_days: trialDays,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        source: 'seoul-sister-premium'
      }
    })
    return subscription
  } catch (error) {
    console.error('Error creating subscription:', error)
    throw error
  }
}

export const getSubscription = async (subscriptionId: string) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return subscription
  } catch (error) {
    console.error('Error retrieving subscription:', error)
    throw error
  }
}

export const cancelSubscription = async (subscriptionId: string) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    })
    return subscription
  } catch (error) {
    console.error('Error canceling subscription:', error)
    throw error
  }
}

export const getCustomerSubscriptions = async (customerId: string) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
    })
    return subscriptions.data
  } catch (error) {
    console.error('Error getting customer subscriptions:', error)
    throw error
  }
}