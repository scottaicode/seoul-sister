# Seoul Sister - Claude Code Configuration

## Project Overview
Seoul Sister is a viral K-beauty arbitrage business targeting Gen Z (20-30 year olds) who want authentic Korean beauty products at Seoul street prices, not inflated US retail prices. This is built as a movement to expose the beauty industry's 300-500% markup.

### Claude Code Autonomous Development Mode
**ENABLED**: Full autonomy to complete high-priority tasks without user intervention.
- Create/modify any files needed for features
- Set up database schemas and API endpoints
- Implement web scraping for price comparisons
- Build admin interfaces and dashboards
- Optimize performance and analytics

### Core Technologies
- **Framework**: Static HTML/CSS/JavaScript (current), Next.js 15 (future)
- **Hosting**: Vercel with custom domain (SeoulSister.com)
- **Business Model**: WhatsApp-based ordering with 15-20% markup on Seoul prices
- **Target**: 90% mobile traffic from TikTok/Instagram viral content
- **AI Model**: Claude 4.1 Opus (claude-opus-4-1-20250805) - NO FALLBACKS

## Current Architecture

### Live Production Site
- **Domain**: https://seoulsister.com (LIVE)
- **Tech Stack**: Static HTML with modern CSS and vanilla JavaScript
- **Hosting**: Vercel with custom domain configuration
- **Mobile-First**: Optimized for iPhone 14 (390x844) viewport

### File Structure
```
seoul-sister/
├── index.html              # Main landing page (LIVE)
├── package.json            # Project metadata
├── vercel.json            # Deployment configuration
├── .ai-context/           # AI guidance files
│   ├── global_rules.md    # Development rules
│   ├── CLAUDE.md          # This file
│   └── seoul_sister_blueprint.md  # Development roadmap
└── .vercel/               # Deployment artifacts
```

## Business Context & Mission

### The Seoul Sister Movement
- **Problem**: US retailers mark up K-beauty 300-500% vs Seoul street prices
- **Solution**: Personal Seoul shopping service saving customers 70%+
- **Target Market**: Gen Z women (20-30) who love K-beauty but hate being "finessed"
- **Positioning**: Revolution against beauty industry price gouging

### Value Proposition
- **Save 70%+**: $94 Sulwhasoo serum → $28 in Seoul
- **Authentic Products**: Direct Seoul sourcing, never fake
- **Personal Service**: WhatsApp-based ordering with human touch
- **Community**: Join 10,000+ Seoul Sisters exposing the scam

### Revenue Model
- **Primary**: 15-20% markup on Seoul street prices + shipping
- **Secondary**: Affiliate commissions from influencer referrals
- **Growth**: Viral TikTok/Instagram content driving organic acquisition

## Technical Implementation

### Current Landing Page Features
- **Price Shock Display**: Dramatic US vs Seoul price comparisons
- **Social Proof**: Customer testimonials with engagement metrics
- **Viral Elements**: "Breaking the internet" messaging, share-worthy content
- **Conversion Funnel**: Landing → Price revelation → Social proof → WhatsApp CTA
- **Mobile Optimization**: Touch-friendly interface, fast loading
- **Real-time Elements**: Countdown timers, spot availability, order counts

### Design Principles
- **TikTok Aesthetic**: Dark theme, vibrant gradients, high contrast
- **Korean Branding**: Red/blue gradient inspired by Korean flag
- **Gen Z Language**: "POV", "bestie", "no cap", emoji-heavy
- **Scroll-Stopping**: Bold headlines, dramatic price reveals
- **Screenshot-Worthy**: Every section designed for social sharing

### Conversion Psychology
- **Hook**: "POV: You discover what Korean girls actually pay"
- **Value**: "Save 70% on authentic K-beauty"
- **Proof**: Real customer testimonials and savings
- **Action**: "I'm Ready to Expose the Scam" WhatsApp CTA
- **Urgency**: "Only 14 spots left this month"

## Development Workflow

### Vibe Coding Principles for Seoul Sister
1. **Ship in 60 minutes**: Every session produces live improvements
2. **Mobile-first always**: Start with iPhone 14, scale up
3. **Viral-first features**: Every addition should increase shareability
4. **Conversion-focused**: Optimize for landing → WhatsApp conversion
5. **Gen Z native**: Use their language, aesthetics, platforms

### Quality Gates
- **Mobile Performance**: <2s load time on 3G
- **Visual Validation**: Screenshot test at 390x844, 768x1024, 1920x1080
- **Conversion Rate**: >5% landing page to WhatsApp
- **Accessibility**: WCAG AA compliance
- **SEO**: >90 Lighthouse score for Gen Z search behavior

### Testing Requirements
- **Browsers**: Chrome Mobile, Safari Mobile, Instagram In-App Browser
- **Devices**: iPhone 14, Samsung Galaxy S23, iPad
- **Networks**: 3G, 4G, WiFi
- **Scenarios**: Landing, scrolling, CTA clicks, social sharing

## Feature Roadmap

### Phase 1: Foundation (Current - LIVE)
- ✅ Landing page with price comparisons
- ✅ WhatsApp integration for orders
- ✅ Mobile-responsive design
- ✅ Basic social proof elements
- ✅ Domain configuration (SeoulSister.com)

### Phase 2: Viral Growth (Next 30 days)
- [ ] Interactive price comparison tool
- [ ] Enhanced testimonial system with video
- [ ] Affiliate/referral tracking for influencers
- [ ] Advanced analytics and A/B testing
- [ ] Email capture for waitlist management

### Phase 3: Scale Operations (30-60 days)
- [ ] Customer dashboard for order tracking
- [ ] Inventory management system
- [ ] Automated email/SMS sequences
- [ ] Advanced social media integration
- [ ] Business intelligence dashboard

### Phase 4: Platform Evolution (60-90 days)
- [ ] Full e-commerce platform with checkout
- [ ] Subscription box service
- [ ] Community features and forums
- [ ] Mobile app for iOS/Android
- [ ] International expansion

## Key Metrics & Analytics

### Conversion Funnel
1. **Landing Page Views**: Target 10K+/month organic
2. **Price Tool Engagement**: >60% interact with comparisons
3. **Social Proof Interaction**: >40% scroll through testimonials
4. **WhatsApp Clicks**: >5% conversion rate
5. **Order Completion**: >70% quote to paid order

### Viral Metrics
- **Share Rate**: >3 shares per visitor
- **Viral Coefficient**: >2.0 organic growth
- **Social Media Mentions**: Track #SeoulSister hashtag
- **Influencer Engagement**: Micro-influencer partnerships
- **Press Coverage**: Beauty blog and news mentions

### Business KPIs
- **Monthly Revenue**: $100K month 1, $500K month 6
- **Customer Acquisition Cost**: <$20 through viral growth
- **Average Order Value**: $150-200 per Seoul order
- **Customer Lifetime Value**: >$500 through repeat orders
- **Net Promoter Score**: >70 likelihood to recommend

## Content Strategy

### Viral Content Pillars
1. **Price Shock**: Dramatic Seoul vs US price reveals
2. **Behind-the-Scenes**: Seoul shopping, packaging process
3. **Customer Stories**: Real savings testimonials
4. **Educational**: Why Korean products cost less in Seoul
5. **Trend Reactions**: K-beauty news and viral moments

### Platform Strategy
- **TikTok**: Price shock videos, Seoul shopping content
- **Instagram**: Polished product photography, Stories content
- **YouTube Shorts**: Educational content, customer features
- **Email**: Weekly product drops and savings reports
- **WhatsApp**: Personal shopping service and order updates

## Customer Personas

### Primary: "Savings-Savvy Sarah" (25)
- College graduate, entry-level job, loves K-beauty but budget-conscious
- Heavy TikTok user, shares deals with friends, mobile-first shopper
- Pain point: Can't afford Sephora prices for skincare routine
- Goal: Build quality skincare routine without breaking bank

### Secondary: "Influencer Emma" (23)
- Micro-influencer (10K-100K followers), content creator
- Needs exclusive access and affiliate opportunities
- Creates unboxing content, highly engaged beauty-focused audience
- Goal: Monetize following through exclusive deals and partnerships

### Tertiary: "Corporate Kate" (29)
- Marketing professional, stable income, values authenticity
- Research-heavy buyer, tired of being overcharged
- Prefers email and long-form content for decision making
- Goal: Reliable source for authentic Korean beauty products

## Technical Deep Dive

### Current Implementation
```html
<!-- Core Structure -->
- Semantic HTML5 with accessibility features
- CSS Grid and Flexbox for responsive layouts
- Vanilla JavaScript for interactions and analytics
- Optimized images and fonts for mobile performance
```

### Performance Optimization
- **Critical CSS**: Inlined for above-the-fold content
- **Font Loading**: Google Fonts with display=swap
- **Image Optimization**: WebP format with fallbacks
- **JavaScript**: Minimal bundle, lazy loading for non-critical features
- **Caching**: Vercel Edge Network with long cache headers

### SEO Strategy
- **Keywords**: "Korean beauty deals", "K-beauty savings", "Seoul shopping"
- **Meta Tags**: Optimized for social sharing (Open Graph)
- **Schema Markup**: Local business and product markup
- **Core Web Vitals**: Optimized for Google's ranking factors
- **Mobile-First**: Responsive design for mobile search

## Development Guidelines

### Code Standards
- **HTML**: Semantic, accessible markup
- **CSS**: BEM methodology, mobile-first responsive
- **JavaScript**: ES6+, minimal framework dependency
- **Performance**: <500KB initial bundle, <2s load time
- **Accessibility**: WCAG 2.1 AA compliance

### Visual Development Workflow
1. **Screenshot Current State**: Capture all viewports
2. **Implement Changes**: Focus on mobile-first design
3. **Visual Validation**: Screenshot and compare
4. **Performance Check**: Lighthouse audit
5. **Deploy and Monitor**: Real user metrics

### A/B Testing Framework
- **Headlines**: Test different price shock statements
- **CTAs**: Optimize button text and placement
- **Social Proof**: Different testimonial presentations
- **Price Display**: Various comparison formats
- **Color Schemes**: Test different brand variations

## Integration Requirements

### WhatsApp Business API
```javascript
// WhatsApp CTA Integration
const whatsappURL = "https://wa.me/1234567890?text=OMG I just discovered the Seoul Sister hack and I'm OBSESSED! How do I start saving 73% on K-beauty? 💅✨";
```

### Analytics Stack
- **Google Analytics 4**: Conversion tracking, audience insights
- **Hotjar**: User session recordings, heatmaps
- **Vercel Analytics**: Performance and visitor metrics
- **Custom Events**: Scroll depth, CTA clicks, share actions

### Social Media Integration
- **Share Buttons**: Native sharing for major platforms
- **Open Graph**: Optimized social media previews
- **Instagram**: Easy screenshot and share functionality
- **TikTok**: Mobile-optimized for in-app browsing

## Security & Compliance

### Data Protection
- **No PII Collection**: Landing page requires no personal data
- **HTTPS**: SSL certificates via Vercel
- **Privacy Policy**: Clear data handling practices
- **Cookie Consent**: GDPR/CCPA compliance

### Business Compliance
- **Terms of Service**: Clear customer agreements
- **Return Policy**: Fair refund and exchange terms
- **Product Claims**: Truthful advertising compliance
- **International Shipping**: Import/export legal compliance

## Competitive Analysis

### Direct Competitors
- **Sephora**: High prices, corporate feel, limited Korean selection
- **YesStyle**: Better selection but still marked up vs Seoul prices
- **Amazon**: Mixed authenticity, inconsistent pricing

### Competitive Advantages
- **Price**: 70% savings through direct Seoul sourcing
- **Authenticity**: Verified Seoul supplier relationships
- **Experience**: Personal shopping vs transactional e-commerce
- **Community**: Movement vs corporate brand
- **Mobile-First**: Built for Gen Z behavior patterns

## Success Metrics

### Technical KPIs
- **Page Load Speed**: <2s on mobile 3G
- **Conversion Rate**: >5% landing to WhatsApp
- **Mobile Traffic**: >90% of total visitors
- **Bounce Rate**: <40% (high engagement)
- **Core Web Vitals**: All metrics in green

### Business KPIs
- **Monthly Revenue**: Exponential growth trajectory
- **Customer Acquisition**: <$20 cost through viral growth
- **Viral Coefficient**: >2.0 organic multiplier
- **Customer Satisfaction**: >4.5/5 rating
- **Market Penetration**: Recognition in Gen Z beauty communities

## Future Technology Stack

### Next.js Migration Plan
When scaling beyond static site:

```javascript
// Planned Tech Stack
- Framework: Next.js 15 with App Router
- Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth
- Payments: Stripe integration
- Email: Resend for transactional emails
- SMS: Twilio for order updates
- Analytics: PostHog for product analytics
```

### API Architecture
```javascript
// Planned API Endpoints
/api/products        // Korean product catalog
/api/quotes         // Price quote generation
/api/orders         // Order management
/api/customers      // Customer data
/api/analytics      // Business intelligence
/api/webhooks       // Third-party integrations
```

## Quick Reference Commands

### Development
```bash
# Local development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Deployment
vercel --prod           # Deploy to production
vercel --preview        # Deploy preview version

# Testing
npm run test            # Run test suite
npm run test:e2e        # End-to-end tests
npm run lighthouse      # Performance audit
```

### Visual Development
```bash
# Screenshot workflow
/visual-check           # Automated screenshot report
/mobile-debug          # Focus on mobile issues
/parallel-design       # Create multiple experiments
```

## Memory Context

### Critical Files
- `index.html` - Main landing page (LIVE at SeoulSister.com)
- `global_rules.md` - Development guidelines and business rules
- `seoul_sister_blueprint.md` - Detailed development roadmap
- `vercel.json` - Deployment and hosting configuration

### Key Decisions Made
1. **Static Site First**: Chosen for speed and simplicity
2. **Mobile-First**: 90% Gen Z traffic from mobile devices
3. **WhatsApp Integration**: Personal touch for high-value orders
4. **Viral Marketing**: Built for social sharing and organic growth
5. **SeoulSister.com**: Custom domain for brand credibility

### Success Stories
- ✅ Successfully deployed to SeoulSister.com
- ✅ Mobile-optimized design achieving <2s load times
- ✅ Viral messaging resonating with Gen Z audience
- ✅ WhatsApp integration driving qualified leads
- ✅ Price comparison tool creating "screenshot moments"

## Development Philosophy

### Seoul Sister Principles
1. **Authenticity Over Everything**: Real Seoul prices, real testimonials
2. **Mobile-First Always**: Gen Z lives on their phones
3. **Viral-First Features**: Every addition should increase shareability
4. **Community Over Corporate**: Movement vs traditional business
5. **Speed Over Perfection**: Ship fast, iterate based on feedback

### Quality Gates
Before any deployment:
- [ ] Mobile performance test (390x844 viewport)
- [ ] WhatsApp integration functional test
- [ ] Social sharing verification
- [ ] Accessibility compliance check
- [ ] Conversion funnel validation

## Contact & Support

### Project Owner
Scott Martin - Founder focused on viral growth and Gen Z engagement

### Key Stakeholders
- **Daughter**: Primary target customer and product feedback
- **Seoul Partners**: Product sourcing and authenticity verification
- **Gen Z Community**: Primary customer base and brand ambassadors

### Success Metrics Review
Monthly review of:
- Conversion rates and customer acquisition
- Viral coefficient and social media growth
- Revenue growth and profitability
- Customer satisfaction and retention
- Competitive positioning and market share

## Remember: The Seoul Sister Mission

This isn't just an e-commerce site - it's a **revolution against beauty industry price gouging**. Every feature, every design decision, every line of code should serve the mission of exposing the truth about K-beauty pricing and empowering Gen Z with authentic Seoul products at fair prices.

### The Seoul Sister Formula
**Authentic Seoul Sourcing + Transparent Pricing + Viral Marketing + Gen Z Community = Beauty Revolution**

**Current Status**: LIVE at SeoulSister.com and ready to break the internet! 🔥💅

**Next Sprint Focus**: Drive viral growth and optimize conversion from landing page to WhatsApp orders.

**Remember**: You have 60 minutes to ship something that gets Gen Z talking. What are you building today?