# Apify API Key Setup Guide

## Issue Identified
The current Apify API key in `.env.local` is invalid, causing authentication errors:
```
Error: "User was not found or authentication token is not valid"
```

## Steps to Fix

### 1. Get Your Apify API Key
1. Go to https://console.apify.com/
2. Sign in to your upgraded Starter plan account ($39/month)
3. Navigate to **Settings** → **Integrations** → **API keys**
4. Copy your **Personal API token** (should start with `apify_api_`)

### 2. Update Environment File
Replace the current invalid key in `.env.local`:
```bash
# Replace this invalid key:
APIFY_API_KEY=apify_api_FLmGznnFDh3LTAxWaVN35wSsGNKnp1rmS9b

# With your real key from Apify Console:
APIFY_API_KEY=apify_api_[YOUR_REAL_KEY_HERE]
```

### 3. Verify Premium Actors Access
Your Starter plan should have access to:
- **Premium Instagram Scraper**: `shu8hvrXbJbY3Eb9W`
- **Enhanced TikTok Scraper**: `clockworks/tiktok-scraper`
- **Residential Proxies**: For Korean content access
- **Higher rate limits**: More concurrent runs

### 4. Test After Update
Run the test script to verify:
```bash
node test-apify.js
```

## Current Implementation Status
✅ Premium actor fallback system implemented
✅ Hybrid content summarization ready
✅ Korean influencer database configured
❌ **API key needs to be updated**

Once the API key is fixed, the Seoul Sister Intelligence system will:
- Scrape 12 Korean beauty influencers automatically
- Generate AI-powered content summaries
- Score content with Seoul Sister Intelligence algorithm
- Run 3x daily via Vercel cron jobs
- Store processed insights in Supabase