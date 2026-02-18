# Seoul Sister — Production Readiness Audit

**Date**: February 17, 2026
**Build Status**: Passes cleanly (zero TypeScript errors, 47 pages generated)

---

## CRITICAL — Must Fix Before Onboarding Users

### 1. No Auth Gate on Protected Routes
- No `middleware.ts` exists — unauthenticated users can load `/dashboard`, `/yuri`, `/scan`, etc.
- AppShell has zero auth protection
- **Fix**: Create Next.js middleware redirecting unauthenticated users to `/login` for `/(app)/*`
- **Status**: FIXED — Auth gate added to AppShell.tsx (client-side, since auth is localStorage-based)

### 2. Scan Endpoint Has No Auth or Rate Limiting
- `src/app/api/scan/route.ts` — fully public, no JWT check
- Each scan calls Claude Vision (expensive)
- CLAUDE.md: "Free: 3 scans/month, Pro: unlimited" — not enforced
- **Fix**: Add auth + subscription tier check or IP-based rate limiting
- **Status**: FIXED — requireAuth() added to scan route + LabelScanner sends Bearer token

### 3. In-Memory Rate Limiter Won't Work on Vercel
- `src/lib/utils/rate-limiter.ts` — uses plain `Map()`, resets on cold start
- Vercel runs each request in isolated containers
- Widget and scan endpoints rely on this
- **Fix**: Move rate state to Supabase table or Redis
- **Status**: PENDING

### 4. Onboarding Requires 2+ Skin Concerns — Should Be 1+
- `src/lib/yuri/onboarding.ts:186-191`
- Yuri asks "what's the ONE thing you'd fix?" but completion requires 2 concerns
- **Fix**: Change threshold to `>= 1`
- **Status**: FIXED — Changed from `length < 2` to `length < 1`

### 5. Widget Message Limit Bypass
- Client-side localStorage counter easily cleared
- Server trusts client-sent `history` array length
- **Fix**: Server-side tracking via IP + session hash
- **Status**: PENDING

---

## HIGH — Fix Before Public Launch

### 6. Login Redirect Race Condition
- `src/app/(auth)/login/page.tsx:24-48`
- After `signIn()`, immediately calls `getSession()` — session may not be ready
- Profile fetch can fail → user lands on dashboard without profile
- **Fix**: Wrap profile fetch in try-catch, use `onAuthStateChange`
- **Status**: FIXED — signIn() now returns session directly; profile fetch wrapped in try-catch

### 7. Incomplete Pages: Profile, Settings, Routine
- `src/app/(app)/profile/page.tsx` — placeholder only
- `src/app/(app)/settings/page.tsx` — placeholder only
- `src/app/(app)/routine/page.tsx` — placeholder only
- **Fix**: Build read-only profile display and basic settings (logout, subscription status)
- **Status**: PENDING

### 8. Scanner Missing Ingredient Conflict Warnings
- `src/components/scan/LabelScanner.tsx`
- CLAUDE.md promises conflict warnings against user's current routine — not implemented
- **Fix**: Query `ss_ingredient_conflicts` against user's `ss_routine_products` after scan
- **Status**: PENDING

### 9. Widget max_tokens Not Reduced for Anonymous Users
- `src/app/api/widget/chat/route.ts:107` — set to 600
- CLAUDE.md: "300 vs 600 for subscribers"
- **Fix**: Reduce to 300
- **Status**: FIXED — Changed from 600 to 300

### 10. Stripe Webhook Event Data Not Schema-Validated
- `src/app/api/stripe/webhook/route.ts`
- Casts as `Record<string, unknown>` without validation
- No idempotency check on `stripe_event_id`
- **Fix**: Validate event shape, check duplicate IDs
- **Status**: PENDING

---

## MEDIUM — Should Fix For Quality

### 11. Inconsistent Auth Patterns Across API Routes
- Different routes use different Bearer token extraction patterns
- **Fix**: Extract shared `requireAuth(request)` helper
- **Status**: FIXED — Added to src/lib/auth.ts, used in scan route

### 12. No Delete Endpoints for User Data
- Can't delete reviews, conversations, reports, or account
- GDPR right-to-erasure concern
- **Status**: PENDING

### 13. Dashboard File is 604 Lines
- `src/app/(app)/dashboard/page.tsx` — exceeds 300-line guideline
- **Fix**: Extract sub-components
- **Status**: PENDING

### 14. SSE Streaming Race Condition in useYuri
- `src/hooks/useYuri.ts:126-137`
- Two chunks arriving simultaneously could lose text
- **Fix**: Use ref to accumulate content
- **Status**: PENDING

### 15. JSON Extraction From Claude Uses Greedy Regex
- `src/app/api/scan/route.ts:100`, `src/lib/yuri/advisor.ts:297`
- Pattern `/{[\s\S]*}/` fails on multi-object responses
- **Status**: FIXED — Now tries direct JSON.parse first, falls back to regex

### 16. Image URL SSRF Risk
- `src/lib/yuri/advisor.ts:101-110`
- Any URL accepted as image source without validation
- **Fix**: Validate against allowlist
- **Status**: FIXED — Only allows data: URLs and HTTPS from trusted hosts

### 17. `pb-safe` Tailwind Utility Undefined
- `src/components/layout/BottomNav.tsx:21`
- **Fix**: Add utility in globals.css
- **Status**: FIXED — Added .pb-safe utility with env(safe-area-inset-bottom)

### 18. Review Voting Silently Fails
- `community/page.tsx:82`, `products/[id]/page.tsx:148`
- **Fix**: Show toast notification on error
- **Status**: PENDING

### 19. Password Validation Inconsistency
- UI requires special chars, server-side does not
- **Fix**: Align both to same rules
- **Status**: FIXED — Added special character regex to passwordSchema

### 20. Landing Page Section Order
- Try Yuri should come after feature grid, before How It Works
- **Status**: PENDING

---

## LOW — Polish Items

| # | Issue | File |
|---|-------|------|
| 21 | No email verification after registration | register/page.tsx |
| 22 | Specialist keyword routing uses substring match | specialists.ts:268-292 |
| 23 | Cron job auth only checks x-cron-secret header | /api/cron/* |
| 24 | Widget message count incremented before API success | YuriBubble.tsx:76-78 |
| 25 | Widget messages lost when bubble closes/reopens | YuriBubble.tsx:46 |
| 26 | No cross-tab sync for widget message counter | widget-session.ts |
| 27 | Review form doesn't warn before discard | ReviewForm.tsx:91-98 |
| 28 | Error messages can leak internal details | error-handler.ts:15-42 |
| 29 | Temp message IDs never reconciled with DB UUIDs | useYuri.ts:57-78 |
| 30 | No dark/light mode toggle (dark-only) | design system |
