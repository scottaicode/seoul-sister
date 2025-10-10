# Seoul Sister Advanced Scraping & Viral Content System

## Overview
Seoul Sister now features an enterprise-grade scraping and AI content generation system inspired by neurolink-bridge's successful implementation. This system automatically tracks K-beauty prices across multiple retailers and generates viral social media content using Claude Opus 4.1.

## Key Features

### 1. **Automated Price Scraping** (`/api/scrape-v2`)
- **Firecrawl API Integration**: Modern scraping that handles JavaScript-heavy sites
- **Multi-Retailer Coverage**:
  - US: Sephora, Ulta, Amazon
  - Korea: YesStyle, OliveYoung, StyleKorean
- **Smart Price Aggregation**: Calculates average prices and savings percentages
- **Fallback System**: Uses intelligent estimates when scraping fails

### 2. **AI-Powered Viral Content** (`/api/generate-viral`)
- **Claude Opus 4.1**: Generates authentic Gen Z content
- **Platform Optimization**:
  - TikTok: Scripts with hooks and trending audio suggestions
  - Instagram: Carousel breakdowns with hashtag strategies
  - Twitter: Viral tweets and thread structures
- **Dynamic Templates**: Falls back to proven viral patterns if AI unavailable

### 3. **Automated Daily Updates** (`/api/cron/scrape-prices`)
- **Scheduled Scraping**: Runs daily at 5 AM UTC via Vercel Cron
- **Batch Processing**: Scrapes 3 products at a time to avoid rate limits
- **Database Sync**: Automatically updates product prices in Supabase
- **Performance Tracking**: Monitors success rates and scraping health

### 4. **Database Schema** (`006_scraping_viral.sql`)
- **price_tracking**: Historical price data from all retailers
- **viral_content_history**: AI-generated content with performance metrics
- **competitor_monitoring**: Track competitor strategies
- **trending_topics**: Current viral topics for content generation
- **scraping_jobs**: Job queue and execution history

## Setup Instructions

### Environment Variables
Add to `.env.local`:
```bash
# Firecrawl API for scraping
FIRECRAWL_API_KEY=your_firecrawl_key_here

# Claude API for content generation
ANTHROPIC_API_KEY=your_claude_key_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Cron Security
CRON_SECRET=your_secure_random_string

# Optional: Webhook for notifications
NOTIFICATION_WEBHOOK=your_discord_or_slack_webhook
```

### Database Migration
Run the migration to create necessary tables:
```bash
npx supabase db push
```

### Manual Testing

1. **Test Price Scraping**:
```bash
curl -X POST http://localhost:3000/api/scrape-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "First Care Activating Serum",
    "brand": "Sulwhasoo",
    "autoUpdate": true
  }'
```

2. **Test Viral Content Generation**:
```bash
curl -X POST http://localhost:3000/api/generate-viral \
  -H "Content-Type: application/json" \
  -d '{
    "product": "Water Sleeping Mask",
    "brand": "LANEIGE",
    "platforms": ["tiktok", "instagram"]
  }'
```

3. **Trigger Manual Price Update**:
```bash
curl -X GET http://localhost:3000/api/cron/scrape-prices \
  -H "Authorization: Bearer your_cron_secret"
```

## API Endpoints

### POST `/api/scrape-v2`
Scrapes current prices for a product across multiple retailers.

**Request**:
```json
{
  "productName": "Product name",
  "brand": "Brand name",
  "autoUpdate": true
}
```

**Response**:
```json
{
  "success": true,
  "prices": {
    "us": {"sephora": 89, "ulta": 85},
    "korean": {"yesstyle": 35, "oliveyoung": 23}
  },
  "analysis": {
    "avgUSPrice": 87,
    "avgKoreanPrice": 29,
    "savings": 58,
    "savingsPercentage": 67
  }
}
```

### POST `/api/generate-viral`
Generates platform-optimized viral content using AI.

**Request**:
```json
{
  "product": "Product name",
  "brand": "Brand name",
  "platforms": ["tiktok", "instagram", "twitter"]
}
```

**Response**:
```json
{
  "success": true,
  "content": {
    "tiktok": {
      "content": "AI-generated script...",
      "metadata": {
        "best_times": "6-10am, 7-11pm EST",
        "viral_probability": "85%"
      }
    }
  }
}
```

### GET `/api/cron/scrape-prices`
Automated endpoint for daily price updates (called by Vercel Cron).

## Performance Optimization

### Rate Limiting
- Batch size: 3 products per batch
- Delay between batches: 2 seconds
- Prevents API throttling and IP blocking

### Caching Strategy
- Price data cached for 24 hours
- Viral content templates cached indefinitely
- Trending topics refreshed every 6 hours

### Error Handling
- Automatic retries with exponential backoff
- Fallback to mock data when APIs unavailable
- Comprehensive error logging for debugging

## Learning & Improvement

### Content Performance Tracking
The system tracks:
- Views, likes, shares, comments
- Conversion rates to WhatsApp
- Viral coefficient calculation
- A/B testing different content styles

### Price Intelligence
- Historical price trends
- Seasonal pricing patterns
- Competitor pricing strategies
- Optimal discount timing

## Security Considerations

### API Key Protection
- Service role keys never exposed to client
- Cron endpoints protected by secret tokens
- Rate limiting on all public endpoints

### Data Privacy
- No PII stored in scraping data
- Encrypted database connections
- Regular security audits

## Monitoring & Analytics

### Key Metrics
- Daily products updated
- Average savings percentage
- Scraping success rate
- Content generation performance
- API response times

### Alert Thresholds
- Scraping success < 80%
- Average savings < 50%
- API errors > 10/hour
- Database size > 80% capacity

## Future Enhancements

### Phase 1 (Next 30 days)
- [ ] Add more Korean retailers (Coupang, GMarket)
- [ ] Implement visual scraping for Instagram posts
- [ ] Create viral content scheduler
- [ ] Add competitor price alerts

### Phase 2 (30-60 days)
- [ ] Machine learning for price predictions
- [ ] Automated A/B testing for content
- [ ] Multi-language content generation
- [ ] Real-time price monitoring

### Phase 3 (60-90 days)
- [ ] Predictive inventory management
- [ ] Influencer collaboration automation
- [ ] Dynamic pricing optimization
- [ ] Global market expansion

## Troubleshooting

### Common Issues

1. **Firecrawl API not working**:
   - Check API key is valid
   - Verify rate limits not exceeded
   - Test with simple URL first

2. **Claude not generating content**:
   - Verify Anthropic API key
   - Check token limits
   - Monitor API status page

3. **Cron job not running**:
   - Verify CRON_SECRET is set
   - Check Vercel dashboard for logs
   - Test manual trigger first

4. **Database not updating**:
   - Check Supabase service role key
   - Verify table permissions
   - Monitor Supabase logs

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Review Supabase database logs
3. Monitor API usage dashboards
4. Contact technical support

## Credits

This system was inspired by the successful implementation in neurolink-bridge, adapted for K-beauty price arbitrage and viral content generation specific to Seoul Sister's mission of exposing beauty industry markups.