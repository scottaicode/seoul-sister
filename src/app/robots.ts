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

      // BLOCK: Training data collection bots (protect content from model training)
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
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
