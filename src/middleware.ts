/**
 * Next.js Middleware
 * Handles security headers, CORS, and request validation
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Security headers configuration
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers':
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
}

// Allowed origins for CORS
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'https://seoulsister.com',
  'https://www.seoulsister.com',
]

export function middleware(request: NextRequest) {
  // Get origin from request
  const origin = request.headers.get('origin') || ''

  // Check if it's an API route
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 })

    // Set CORS headers for preflight
    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
    }

    return response
  }

  // Create response
  const response = NextResponse.next()

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add CORS headers for API routes
  if (isApiRoute && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // Add CSP header (Content Security Policy)
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' *.vercel-scripts.com *.stripe.com *.google-analytics.com *.googletagmanager.com;
    style-src 'self' 'unsafe-inline' fonts.googleapis.com;
    img-src 'self' blob: data: https: *.unsplash.com *.cloudinary.com;
    font-src 'self' fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
    connect-src 'self' *.supabase.co *.stripe.com *.anthropic.com *.google-analytics.com;
  `.replace(/\s{2,}/g, ' ').trim()

  response.headers.set('Content-Security-Policy', cspHeader)

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Check for admin session (this is a basic check, enhance as needed)
    const session = request.cookies.get('supabase-auth-token')
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  // Rate limiting headers (informational)
  response.headers.set('X-RateLimit-Policy', 'See API documentation')

  return response
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}