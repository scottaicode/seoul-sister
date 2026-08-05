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

      // BLOCK: CCBot (Common Crawl). Re-examined Aug 4 2026 — KEEP BLOCKED, but not for the
      // reason originally written here ("no citation value"), which overstates it and is
      // falsifiable in one search. Common Crawl derivatives (FineWeb et al.) genuinely do feed
      // OPEN-weights pretraining. The real reasons:
      //   1. REDUNDANT. Every lab whose citations we actually want already crawls us directly —
      //      GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, Google-Extended, PerplexityBot
      //      are all allowed below. CCBot is a lower-fidelity second path to the same labs.
      //   2. NO LIVE-RETRIEVAL CHANNEL. CC does not power any RAG/AI-answer index. Perplexity
      //      scrapes live via PerplexityBot (allowed). So there is no near-term citation upside.
      //   3. TIME HORIZON IS ~2028. Snapshot -> derivative corpus -> pretraining run -> shipped
      //      model. Irrelevant to the North Star question ("will a stranger pay?").
      //   4. IRREVERSIBLE + REDISTRIBUTABLE. CC archives are append-only and cloud-mirrored;
      //      re-blocking later does not retract what was taken. CC data is free bulk download,
      //      which is the one channel that hands our structured/normalized English K-beauty
      //      corpus (the actual moat — not the raw facts) to content farms pre-packaged.
      //      The Atlantic (Nov 2025) documented CC misleading publishers on paywalls and not
      //      honoring removal requests.
      // Counter-evidence considered: BuzzStream/Citation Labs (4M citations, 3,600 prompts) found
      // ~95% of training-bot citations came from sites BLOCKING those bots — blocking training
      // crawlers barely dents citation. Do NOT re-open this on the "post-hoc citation" theory
      // (Seer, 541,213 responses): that study makes no claim about Common Crawl or training-data
      // inclusion, and Seer themselves call it behavioral evidence, not proven architecture.
      {
        userAgent: 'CCBot',
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
      // Anthropic's current (2026) crawler fleet — replaces the deprecated 2024-era
      // Claude-Web/anthropic-ai names. ClaudeBot (training), Claude-User (user browsing
      // on claude.ai), Claude-SearchBot (search/citation). Scoped identically to the other
      // allowed AI search bots so Anthropic's models get the same access as OpenAI/Google.
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'Claude-User',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'Claude-SearchBot',
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
      // ALLOW (scoped): legitimate, robots.txt-compliant Chinese search/AI bots.
      // K-beauty has a large Asia-facing, English-curious audience; Seoul Sister's content is
      // non-proprietary, so the citation-traffic upside applies to these engines too. Only bots
      // with a DOCUMENTED user-agent that HONORS robots.txt are named here — parity with the
      // OpenAI/Google/Anthropic invites above. PetalBot = Huawei Petal Search; Baiduspider = Baidu
      // (powers ERNIE grounding). DELIBERATELY OMITTED: Bytespider (no docs, robots.txt non-compliant
      // — left under the default * rule, not endorsed with a named allow), DeepSeek (publishes no
      // compliant crawler), and Alibaba's Qwen/Quark bots (documented but report proxy-rotation +
      // UA-spoofing — fail the "respectful" bar; revisit if their compliance improves).
      {
        userAgent: 'PetalBot',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
      {
        userAgent: 'Baiduspider',
        allow: '/',
        disallow: ['/api/', '/onboarding/', '/settings/', '/dashboard/', '/admin/'],
      },
    ],
    sitemap: 'https://www.seoulsister.com/sitemap.xml',
  }
}
