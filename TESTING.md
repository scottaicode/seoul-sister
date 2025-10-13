# Seoul Sister - Testing Documentation

## Authentication Testing

### Test User Credentials
- **Email**: vibetrendai@gmail.com
- **Username**: ariastar
- **Password**: (Generated during signup - check email for confirmation)

### Authentication Flow Testing

#### 1. Sign Up Flow
```
URL: https://seoulsister.com/signup
Steps:
1. Fill in user details
2. Verify email confirmation
3. Complete payment setup
4. Verify redirect to success page
```

#### 2. Sign In Flow
```
URL: https://seoulsister.com (click JOIN button)
Steps:
1. Click "JOIN" in header
2. Enter email: vibetrendai@gmail.com
3. Enter password
4. Verify login success
5. Check for visual authentication indicators
```

#### 3. Protected Routes Testing
```
- /personalized-dashboard - Requires WhatsApp number
- /skin-profile - Requires WhatsApp number
- /admin/ai-features - Requires admin access
```

### Expected Authentication States

#### When Logged Out:
- Header shows "JOIN" button
- No user profile visible
- Redirect to login on protected routes

#### When Logged In:
- Header should show user profile/avatar
- "JOIN" button replaced with user menu
- Access to personalized features
- WhatsApp integration available

### Playwright Test Scenarios

```javascript
// Login Test
await page.goto('https://seoulsister.com');
await page.click('[data-testid="join-button"]');
await page.fill('[name="email"]', 'vibetrendai@gmail.com');
await page.fill('[name="password"]', 'TEST_PASSWORD');
await page.click('[type="submit"]');
await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
```

### Test Database State
- User profile created in Supabase
- Email: vibetrendai@gmail.com
- User ID: [Generated UUID]
- Associated skin profile data available

### Visual Authentication Indicators Needed:
1. ✅ User avatar/name in header when logged in
2. ✅ "Sign Out" option in user menu
3. ✅ Personalized content access
4. ✅ Protected route authorization

## API Testing Endpoints

### Authentication APIs:
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `GET /api/user/profile` - Get user data
- `POST /api/skin-profiles` - Create/update skin profile

### AI Features APIs:
- `GET /api/personalized-recommendations-v2` - AI recommendations
- `POST /api/ingredient-analysis` - Ingredient safety analysis
- `GET /api/skin-profiles` - Fetch user skin data

## Current Issues to Fix:
1. No visual indication when user is logged in
2. Header doesn't change to show authenticated state
3. Need user profile display/menu system
4. Missing logout functionality in UI