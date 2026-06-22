import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: allow public pages, block internal routes
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/scan/', '/routine/', '/yuri/', '/glass-skin/', '/shelf-scan/', '/sunscreen/', '/dupes/', '/community/', '/trending/', '/tracking/', '/profile/', '/admin/', '/subscribe/', '/verify/'],
      },

      // ALLOW (scoped): GPTBot + Google-Extended.
      // Strategic reversal (Jun 22 2026, GEO audit): the old "block training bots" stance is
      // outdated for a DISCOVERY business. In 2026 GPTBot also powers ChatGPT retrieval/browsing
      // (OAI-SearchBot/ChatGPT-User do NOT fully substitute — many ChatGPT citations require GPTBot
      // to have indexed the page), and Google-Extended gates Gemini AND Google AI Overviews
      // grounding. Seoul Sister is an intelligence platform whose whole GEO thesis is to BE the cited
      // source; the ingredient/product facts aren't proprietary, so the training-data concern is moot
      // vs. the citation-traffic upside (AI referrals convert ~50% higher, 2026). Scoped like the
      // retrieval bots — public content yes, private/app routes no. See SEOUL-SISTER-GEO-AUDIT.md.
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },

      // BLOCK: bulk scrapers with no citation/referral value (no AI-search upside, just data harvest)
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },

      // ALLOW: Real-time retrieval bots (these cite us in AI search results)
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'Claude-Web',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'Applebot-Extended',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
    ],
    sitemap: 'https://www.seoulsister.com/sitemap.xml',
  }
}
