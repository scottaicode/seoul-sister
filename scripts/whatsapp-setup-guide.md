# Seoul Sister WhatsApp Business API Setup Guide

## Overview
This guide sets up WhatsApp Business API integration for Seoul Sister's premium ordering system.

## Prerequisites
1. **WhatsApp Business API Account** from Meta
2. **Phone Number ID** from Meta Business Manager
3. **Access Token** with messaging permissions
4. **Webhook Verify Token** (your choice)

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# WhatsApp Business API Configuration
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_from_meta
WHATSAPP_ACCESS_TOKEN=your_access_token_from_meta
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_chosen_verify_token
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret

# Base URL for webhook registration
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

## Database Setup

1. Run the WhatsApp tables creation script:
```bash
# Copy the SQL content from scripts/setup-whatsapp-tables.sql
# Run it in your Supabase SQL editor
```

## WhatsApp Business API Setup Steps

### 1. Create Meta Business Account
- Go to [Meta Business Manager](https://business.facebook.com)
- Create a business account if you don't have one
- Verify your business

### 2. Set Up WhatsApp Business API
- In Meta Business Manager, go to "WhatsApp Manager"
- Add a phone number for your business
- Complete phone number verification
- Get your Phone Number ID from the API setup section

### 3. Generate Access Token
- Go to Meta for Developers Console
- Create a new app or use existing
- Add WhatsApp Business API product
- Generate a permanent access token with messaging permissions
- Save this as `WHATSAPP_ACCESS_TOKEN`

### 4. Configure Webhook
- In WhatsApp Business API settings, add webhook URL:
  ```
  https://yourdomain.com/api/whatsapp/webhook
  ```
- Set Verify Token (choose any secure string, save as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`)
- Subscribe to these webhook fields:
  - `messages`
  - `message_deliveries`
  - `message_reads`

## API Endpoints

### 1. Webhook Verification & Message Handling
```
GET/POST /api/whatsapp/webhook
```
- Handles WhatsApp webhook verification
- Processes incoming messages
- Manages order requests

### 2. Send Message
```
POST /api/whatsapp/send-message
```
- Sends WhatsApp messages programmatically
- Used for order confirmations and updates

### 3. Order Management
```
GET/POST /api/whatsapp/orders
```
- View and manage WhatsApp orders
- Order status updates

## Testing the Integration

### 1. Test Webhook Verification
```bash
curl -X GET "https://yourdomain.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test123"
```
Should return: `test123`

### 2. Test Message Sending
```bash
curl -X POST "https://yourdomain.com/api/whatsapp/send-message" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Test message from Seoul Sister"
  }'
```

### 3. Test Order Flow
1. Send "hi" to your WhatsApp Business number
2. Should receive welcome message
3. Premium users can proceed with product inquiries
4. Non-premium users get subscription prompt

## Premium Member Integration

The system automatically:
1. **Checks subscription status** for each WhatsApp user
2. **Creates guest profiles** for new WhatsApp contacts
3. **Links WhatsApp contacts** to existing user accounts via phone number
4. **Restricts features** to premium members only

## Security Features

1. **Webhook Verification**: All incoming webhooks are verified with your secret token
2. **Row Level Security**: Database policies restrict access to user's own data
3. **Premium Gating**: Only active subscribers can use the ordering system
4. **Rate Limiting**: Built-in protection against spam

## Message Flow Examples

### New User (Non-Premium)
```
User: "Hi"
Bot: "Welcome! You need premium membership to use WhatsApp ordering.
      Start free trial: yourdomain.com/signup"
```

### Premium User - Product Inquiry
```
User: "I want COSRX snail essence"
Bot: "✨ Product Found! COSRX Snail 96 Mucin Essence
     🇰🇷 Seoul Price: $8.00
     💼 Service Fee: $25.00
     💳 Your Total: $33.00

     Want to order this? Reply 'ORDER'"
```

### Order Confirmation
```
User: "ORDER"
Bot: "🎉 Order Confirmed!
     📋 Order #AB123456
     📦 Your Seoul Sister Haul:
     • 1x COSRX Snail 96 Mucin Essence - $33.00

     Processing time: 1-2 business days
     Estimated delivery: 7-10 days"
```

## Troubleshooting

### Common Issues

1. **Webhook verification fails**
   - Check `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches Meta configuration
   - Ensure webhook URL is accessible publicly

2. **Messages not sending**
   - Verify `WHATSAPP_ACCESS_TOKEN` is valid and has messaging permissions
   - Check phone number format (must include country code)
   - Ensure phone number is registered with WhatsApp

3. **Database errors**
   - Run the WhatsApp tables setup script
   - Check Supabase permissions and RLS policies

4. **Subscription checking fails**
   - Verify user has active Stripe subscription
   - Check phone number linking in profiles table

## Production Deployment

1. **Update environment variables** in production
2. **Run database migration** script
3. **Register webhook URL** with Meta
4. **Test with real WhatsApp numbers**
5. **Monitor logs** for any issues

## Support

For WhatsApp Business API issues:
- [Meta Business Help Center](https://business.facebook.com/help)
- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)

For Seoul Sister integration issues:
- Check application logs
- Verify database connectivity
- Test API endpoints individually