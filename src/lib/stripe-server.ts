import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

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