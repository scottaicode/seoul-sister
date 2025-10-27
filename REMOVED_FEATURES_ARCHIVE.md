# Seoul Sister - Removed Features Archive
*Documentation of features being removed/consolidated - December 2024*

## 🗃️ **Features Being Removed/Consolidated**

### **1. Separate Intelligence Dashboards**
**Status**: CONSOLIDATING into single dashboard
**File Locations**:
- `/src/app/intelligence/enhanced/page.tsx` - Enhanced Intelligence with video analysis
- `/src/app/premium/page.tsx` - Premium Dashboard
- `/src/app/personalized-dashboard/page.tsx` - Personalized Dashboard

**Features to Preserve**:
- Video transcription and analysis capabilities
- Advanced trend detection algorithms
- Premium widget system
- Personalized recommendation engine

**Database Tables**:
- `enhanced_intelligence_reports`
- `premium_dashboard_widgets`
- `personalized_recommendations`

### **2. Standalone Bailey Features Page**
**Status**: MERGING with main AI advisor
**File Locations**:
- `/src/app/bailey-features/page.tsx` - Bailey Features hub
- `/src/components/BaileyFeatureCard.tsx` - Individual feature cards

**Features to Preserve**:
- Barcode scanning functionality
- Gradual introduction planning
- Progress tracking with photo comparison
- Irritation analysis and diagnosis

### **3. Separate Skin Analysis System**
**Status**: MERGING with Bailey AI advisor
**File Locations**:
- `/src/app/skin-analysis/page.tsx` - Standalone skin analysis
- `/src/components/SkinAnalysisAI.tsx` - AI skin analysis component
- `/src/components/PhotoSkinAnalysis.tsx` - Photo-based analysis

**Features to Preserve**:
- Advanced skin condition detection
- Progress photo comparison
- Detailed skin health scoring
- Personalized routine generation

### **4. Wholesale-Focused Features**
**Status**: TRANSFORMING to price intelligence
**File Locations**:
- `/src/lib/korean-product-database.ts` - Seoul pricing data
- `/src/components/PriceComparisonWidget.tsx` - Wholesale price displays
- `/src/app/api/wholesale-*` - Wholesale-related APIs

**Features to Preserve**:
- Korean product database with authentic pricing
- Price comparison algorithms
- Savings calculation logic
- Retailer trust scoring

### **5. Viral Content Generation Tools**
**Status**: MOVING to sub-feature
**File Locations**:
- `/src/components/ViralScreenshotGenerator.tsx` - Instagram story generator
- `/src/components/ViralCopyGenerator.tsx` - Social media copy creation
- `/src/app/api/generate-viral/route.ts` - Content generation API

**Features to Preserve**:
- AI-powered viral content creation
- Instagram story templates
- Social media copy optimization
- Brand voice consistency

### **6. Separate Premium Subscription System**
**Status**: SIMPLIFYING pricing model
**File Locations**:
- `/src/app/create-subscription/route.ts` - Stripe subscription creation
- `/src/components/PremiumPaywall.tsx` - Premium feature gates
- Premium pricing configurations

**Features to Preserve**:
- Stripe integration code
- Feature gating logic
- Subscription management
- Payment processing flows

## 🔧 **Database Schema Changes**

### **Tables Being Modified**:
```sql
-- BEFORE: Wholesale pricing focus
products (
  seoul_price,
  us_price,
  markup_percentage,
  wholesale_available
)

-- AFTER: Price intelligence focus
products (
  best_price_found,
  price_tracking_history,
  retailer_trust_score,
  deal_alert_threshold
)
```

### **New Tables Needed**:
```sql
-- Retailer trust and pricing intelligence
retailer_trust_scores (
  retailer_name,
  authenticity_score,
  shipping_score,
  customer_service_score,
  overall_trust_rating
)

price_tracking_history (
  product_id,
  retailer,
  price,
  timestamp,
  availability
)

affiliate_links (
  product_id,
  retailer,
  affiliate_url,
  commission_rate
)
```

## 💾 **Code Preservation Strategy**

### **Git Branches for Future Use**:
- `feature/enhanced-intelligence` - Advanced video analysis
- `feature/premium-widgets` - Premium dashboard widgets
- `feature/viral-content-tools` - Social media generation
- `feature/wholesale-system` - Complete wholesale functionality

### **Reusable Components**:
- Video transcription engine
- Advanced AI analysis algorithms
- Premium feature gating system
- Korean beauty trend detection
- Viral content generation templates

## 🎯 **Future Application Ideas**

### **1. Seoul Sister Pro (B2B)**
- Enhanced intelligence features for beauty brands
- Trend prediction for marketing teams
- Competitor analysis dashboard

### **2. Viral Beauty Studio**
- Standalone social media content creation
- AI-powered beauty content optimization
- Influencer collaboration tools

### **3. K-Beauty Intelligence Platform**
- Pure data/analytics play for industry
- Wholesale market analysis
- Brand performance tracking

---

*This archive ensures no valuable code or features are lost during the consolidation process. All removed features can be accessed from their documented file locations and potentially spun into separate applications or reintegrated in the future.*