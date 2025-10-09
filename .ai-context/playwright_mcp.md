# Playwright MCP Configuration for Seoul Sister

## Overview
Playwright is configured for end-to-end testing and visual validation of Seoul Sister, with special focus on mobile responsiveness, conversion funnel optimization, and Gen Z user experience testing.

## Visual Development Testing

```bash
# Run visual regression tests
npm run test:visual

# Test mobile-first responsiveness
npx playwright test tests/visual/mobile-responsive.spec.ts

# Test conversion funnel
npx playwright test tests/e2e/conversion-funnel.spec.ts

# Run tests in UI mode for debugging
npx playwright test --ui

# Generate visual comparison report
npx playwright show-report
```

## Test Coverage Areas for Seoul Sister

### 1. Mobile-First Experience
- **iPhone 14 Viewport (390x844)**: Primary testing viewport
- **Touch Interactions**: WhatsApp CTA, price comparisons, social sharing
- **Page Load Performance**: <2s load time on 3G simulation
- **Scroll Behavior**: Smooth scrolling, sticky elements
- **Thumb Navigation**: Touch-friendly button sizes (44px minimum)

### 2. Conversion Funnel Validation
- **Landing Page Impact**: Hook effectiveness, price shock display
- **Social Proof Engagement**: Testimonial interaction rates
- **WhatsApp Integration**: CTA functionality across browsers
- **Sharing Features**: Social media share button testing
- **Form Validation**: Email capture, waitlist signup

### 3. Viral Content Testing
- **Screenshot Moments**: Verify content is screenshot-worthy
- **Social Media Previews**: Open Graph meta tag validation
- **Share Text Generation**: Pre-filled social sharing messages
- **Mobile Browser Compatibility**: Instagram/TikTok in-app browsers

### 4. Performance & Accessibility
- **Core Web Vitals**: LCP <2.5s, FID <100ms, CLS <0.1
- **WCAG 2.1 AA Compliance**: Color contrast, screen reader compatibility
- **Network Conditions**: 3G, 4G, WiFi performance testing
- **Cross-Browser Testing**: Chrome Mobile, Safari Mobile, Samsung Internet

## Writing Tests for Seoul Sister

### Mobile-First Test Patterns
```javascript
// Example mobile test structure
test('Seoul Sister mobile conversion funnel', async ({ page }) => {
  // Set iPhone 14 viewport
  await page.setViewportSize({ width: 390, height: 844 });

  // Test price shock impact
  await page.goto('/');
  await expect(page.locator('.price-comparison')).toBeVisible();

  // Test WhatsApp CTA
  const whatsappButton = page.locator('[data-testid="whatsapp-cta"]');
  await expect(whatsappButton).toBeVisible();
  await whatsappButton.click();

  // Verify WhatsApp opens (external link)
  await expect(page).toHaveURL(/wa\.me/);
});
```

### Visual Regression Testing
```javascript
// Screenshot comparison tests
test('Visual regression - landing page', async ({ page }) => {
  await page.goto('/');

  // Test multiple viewports
  const viewports = [
    { width: 390, height: 844, name: 'iPhone14' },
    { width: 768, height: 1024, name: 'iPad' },
    { width: 1920, height: 1080, name: 'Desktop' }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page).toHaveScreenshot(`landing-${viewport.name}.png`);
  }
});
```

### Gen Z User Experience Testing
```javascript
// Test Gen Z-specific interactions
test('Gen Z user behavior simulation', async ({ page }) => {
  await page.goto('/');

  // Fast scrolling behavior (Gen Z browses quickly)
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(500);

  // Social sharing instinct test
  const shareButton = page.locator('[data-testid="share-savings"]');
  await shareButton.click();

  // Test screenshot-worthy moment capture
  await expect(page.locator('.price-savings-highlight')).toBeVisible();
});

// Test authenticated user flows
test('Authenticated Seoul Sister user journey', async ({ page }) => {
  // Login with test credentials
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'vibetrendai@gmail.com');
  await page.fill('[data-testid="password"]', 'ariastar');
  await page.click('[data-testid="login-submit"]');

  // Test authenticated features
  await expect(page.locator('[data-testid="user-dashboard"]')).toBeVisible();
});
```

## Seoul Sister Specific Test Scenarios

### 1. Price Shock Validation
- Dramatic price comparison display
- Savings calculation accuracy
- Currency formatting consistency
- Mobile price table responsiveness

### 2. Social Proof Testing
- Testimonial carousel functionality
- Customer review authenticity display
- Before/after savings visualization
- Community member count updates

### 3. WhatsApp Business Integration
- Message pre-population accuracy
- Click tracking for analytics
- Multi-language support testing
- International phone number handling

### 4. Viral Content Optimization
- Share button placement and visibility
- Social media preview generation
- Screenshot-friendly content layout
- Hashtag and mention tracking

## Performance Testing for Seoul Sister

### Mobile Performance Benchmarks
```javascript
// Performance testing configuration
const performanceTest = {
  networkConditions: 'Regular 3G', // Target Gen Z mobile usage
  targetMetrics: {
    FCP: '<1.5s',    // First Contentful Paint
    LCP: '<2.5s',    // Largest Contentful Paint
    TTI: '<3.0s',    // Time to Interactive
    CLS: '<0.1'      // Cumulative Layout Shift
  }
};
```

### Seoul Sister Performance Priorities
1. **Mobile Load Speed**: Critical for TikTok/Instagram traffic
2. **Image Optimization**: Product photos and testimonial images
3. **Font Loading**: Korean typography and Gen Z-friendly fonts
4. **JavaScript Bundle**: Minimal for fast mobile experience

## Accessibility Testing for Seoul Sister

### Gen Z Accessibility Considerations
- **High Contrast Mode**: Important for mobile outdoor usage
- **Large Text Support**: Accessibility for various vision needs
- **Voice Control**: Growing trend among Gen Z users
- **Color Blindness**: Ensure price comparisons work without color

### Screen Reader Testing
```javascript
// Accessibility test example
test('Screen reader navigation', async ({ page }) => {
  await page.goto('/');

  // Test semantic heading structure
  const headings = page.locator('h1, h2, h3, h4, h5, h6');
  await expect(headings.first()).toContainText('Seoul Sister');

  // Test alt text for price comparison images
  const priceImages = page.locator('img[alt*="price"]');
  for (const img of await priceImages.all()) {
    await expect(img).toHaveAttribute('alt');
  }
});
```

## CI/CD Integration for Seoul Sister

### Automated Test Triggers
- **Pull Request Creation**: Full test suite
- **Main Branch Commits**: Performance and accessibility tests
- **Production Deployment**: Critical user journey validation
- **Scheduled Runs**: Daily mobile performance checks

### Test Environments
- **Local Development**: Quick feedback during coding
- **Staging**: Full test suite before production
- **Production Monitoring**: Synthetic user tests

## Debugging Seoul Sister Tests

### Development Debug Commands
```bash
# Visual debugging for mobile issues
PWDEBUG=1 npx playwright test --project=mobile

# Slow motion for conversion funnel analysis
npx playwright test conversion-funnel --slow-mo=2000

# Network throttling debug
npx playwright test --project=mobile-3g

# Screenshot comparison debug
npx playwright test --update-snapshots
```

### Seoul Sister Specific Debug Patterns
- **Mobile viewport issues**: Test with device emulation
- **WhatsApp integration**: Check external link handling
- **Social sharing**: Verify meta tag generation
- **Performance bottlenecks**: Use Lighthouse integration
- **Login flows**: Use testCredentials for authentication testing

## Test Data Management

### Test Account Credentials
```javascript
// Seoul Sister Test Account
const testCredentials = {
  email: 'vibetrendai@gmail.com',
  password: 'ariastar'
};
```

### Synthetic Seoul Sister Data
```javascript
// Never use real customer data
const testData = {
  products: [
    { name: 'Test Serum', seoulPrice: 28, usPrice: 94, savings: 70 },
    { name: 'Test Moisturizer', seoulPrice: 15, usPrice: 52, savings: 71 }
  ],
  testimonials: [
    { name: 'Test Customer', savings: '$66', product: 'Test Skincare Set' }
  ],
  whatsappNumber: '+1234567890' // Test number only
};
```

### Data Privacy in Testing
- **No Real Customer Info**: Use only synthetic test data
- **Anonymized Analytics**: Test tracking without PII
- **Secure Test Environment**: Isolated from production data
- **GDPR Compliance**: Test privacy controls and consent flows

## Seoul Sister Testing Best Practices

### 1. Mobile-First Testing Approach
- Always start with iPhone 14 viewport (390x844)
- Test touch interactions before mouse clicks
- Validate thumb-friendly navigation patterns
- Check performance on mobile networks

### 2. Conversion-Focused Testing
- Test the complete landing → WhatsApp journey
- Validate price shock emotional impact
- Ensure social proof credibility
- Verify sharing functionality works across platforms

### 3. Gen Z User Simulation
- Fast scrolling and quick decision patterns
- Screenshot-taking behavior simulation
- Social sharing instinct testing
- Mobile-native interaction patterns

### 4. Viral Content Validation
- Test shareability of price comparisons
- Validate social media preview generation
- Check hashtag and mention functionality
- Verify screenshot-worthy moment capture

## Integration with Seoul Sister Development

### Visual Development Workflow
1. **Screenshot Current State**: Capture baseline before changes
2. **Implement Changes**: Focus on mobile-first improvements
3. **Run Visual Tests**: Automated comparison against baseline
4. **Performance Validation**: Check Core Web Vitals impact
5. **User Journey Testing**: Validate conversion funnel integrity

### Continuous Improvement
- **Weekly Performance Reviews**: Mobile metrics analysis
- **Monthly Visual Audits**: Screenshot comparison reports
- **Quarterly UX Research**: Gen Z user behavior studies
- **Seasonal Testing**: Peak traffic period validation

---

**Remember**: Every test should serve the Seoul Sister mission of empowering Gen Z to expose beauty industry price gouging. Test not just functionality, but the emotional impact and viral potential of every feature.

**Mobile-First Mantra**: If it doesn't work perfectly on iPhone 14 (390x844), it doesn't ship to production.