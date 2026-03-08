import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Calendar, Clock, ArrowLeft, Tag } from 'lucide-react'
import PublicNav from '@/components/layout/PublicNav'
import BlogYuriCta from '@/components/blog/BlogYuriCta'
import { marked } from 'marked'
import { linkIngredients, buildIngredientMap, type IngredientLink } from '@/lib/utils/ingredient-linker'

// Configure marked: open external links in new tab, sanitize
const renderer = new marked.Renderer()
renderer.link = ({ href, title, text }) => {
  const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'))
  const titleAttr = title ? ` title="${title}"` : ''
  const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${href}"${titleAttr}${target}>${text}</a>`
}

marked.setOptions({
  renderer,
  gfm: true,
  breaks: false,
})

function renderMarkdown(content: string): string {
  if (!content) return ''
  // Strip leading H1 if it duplicates the page title (LGAAS includes it in content)
  const stripped = content.replace(/^#\s+.+\n+/, '')
  return marked.parse(stripped) as string
}

interface BlogPost {
  id: string
  title: string
  slug: string
  body: string
  meta_description: string | null
  excerpt: string | null
  category: string | null
  tags: string[] | null
  featured_image_url: string | null
  read_time_minutes: number | null
  published_at: string
  updated_at: string | null
  author: string | null
  faq_schema: { questions?: Array<{ question: string; answer: string }> } | Array<{ question: string; answer: string }> | null
  primary_keyword: string | null
}

/** Normalize FAQ data — LGAAS sends a flat array, but the page expects { questions: [...] } */
function getFaqQuestions(faq: BlogPost['faq_schema']): Array<{ question: string; answer: string }> {
  if (!faq) return []
  if (Array.isArray(faq)) return faq
  return faq.questions || []
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = getSupabase()

  const { data: post } = await supabase
    .from('ss_content_posts')
    .select('title, meta_description, excerpt, featured_image_url, published_at, author')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .single()

  if (!post) {
    // Check if slug was renamed — redirect will happen in the page component
    return { title: 'Post Not Found' }
  }

  const description =
    post.meta_description || post.excerpt || 'K-beauty insights from Seoul Sister'

  return {
    title: post.title,
    description,
    authors: post.author ? [{ name: post.author }] : undefined,
    robots: { index: true, follow: true },
    alternates: { canonical: `https://www.seoulsister.com/blog/${slug}` },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.published_at,
      authors: post.author ? [post.author] : undefined,
      images: post.featured_image_url ? [post.featured_image_url] : undefined,
      url: `https://www.seoulsister.com/blog/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: post.featured_image_url ? [post.featured_image_url] : undefined,
    },
  }
}

export const revalidate = 600 // Re-check every 10 min

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = getSupabase()

  const { data: post } = await supabase
    .from('ss_content_posts')
    .select('*')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .single()

  if (!post) {
    // Check if this slug was previously used by a post that was renamed
    const { data: redirectPost } = await supabase
      .from('ss_content_posts')
      .select('slug')
      .contains('previous_slugs', [slug])
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .single()

    if (redirectPost) {
      redirect(`/blog/${redirectPost.slug}`)
    }

    notFound()
  }

  const blogPost = post as BlogPost

  // Fetch enriched ingredients for internal linking
  const { data: enrichedIngredients } = await supabase
    .from('ss_ingredients')
    .select('name_en, name_inci')
    .eq('is_active', true)
    .not('rich_content', 'is', null)
    .order('name_en')

  const ingredientLinks: IngredientLink[] = enrichedIngredients
    ? buildIngredientMap(enrichedIngredients)
    : []

  // Render body with ingredient links
  const rawHtml = renderMarkdown(blogPost.body)
  const { html: linkedHtml, linked: linkedIngredients } = linkIngredients(rawHtml, ingredientLinks)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.seoulsister.com' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.seoulsister.com/blog' },
          { '@type': 'ListItem', position: 3, name: blogPost.title, item: `https://www.seoulsister.com/blog/${blogPost.slug}` },
        ],
      },
      {
        '@type': 'Article',
        '@id': `https://www.seoulsister.com/blog/${blogPost.slug}#article`,
        headline: blogPost.title,
        description: blogPost.meta_description || blogPost.excerpt,
        image: blogPost.featured_image_url,
        datePublished: blogPost.published_at,
        dateModified: blogPost.updated_at || blogPost.published_at,
        author: blogPost.author && blogPost.author !== 'Seoul Sister'
          ? {
              '@type': 'Person',
              name: blogPost.author,
              url: 'https://www.seoulsister.com',
            }
          : {
              '@type': 'Organization',
              name: 'Seoul Sister',
              url: 'https://www.seoulsister.com',
            },
        publisher: {
          '@type': 'Organization',
          name: 'Seoul Sister',
          url: 'https://www.seoulsister.com',
          logo: 'https://www.seoulsister.com/icons/icon-512.svg',
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `https://www.seoulsister.com/blog/${blogPost.slug}`,
        },
        keywords: blogPost.tags?.join(', ') || blogPost.primary_keyword,
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['.blog-headline', '.blog-excerpt'],
        },
      },
      ...(getFaqQuestions(blogPost.faq_schema).length
        ? [
            {
              '@type': 'FAQPage',
              '@id': `https://www.seoulsister.com/blog/${blogPost.slug}#faq`,
              mainEntity: getFaqQuestions(blogPost.faq_schema).map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer,
                },
              })),
            },
          ]
        : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-[#0a0a0a]">
        <PublicNav />

        {/* Back link */}
        <div className="border-b border-white/10 pt-16">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-white/60 hover:text-amber-400 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>
          </div>
        </div>

        {/* Article */}
        <article className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="mb-8">
            {blogPost.category && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 mb-4">
                {blogPost.category}
              </span>
            )}
            <h1 className="blog-headline font-display font-bold text-3xl md:text-4xl text-white mb-4 leading-tight">
              {blogPost.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/50 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(blogPost.published_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {blogPost.read_time_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {blogPost.read_time_minutes} min read
                </span>
              )}
              {blogPost.author && <span>By {blogPost.author}</span>}
            </div>
          </header>

          {/* Featured image */}
          {blogPost.featured_image_url && (
            <div className="rounded-2xl overflow-hidden mb-8">
              <img
                src={blogPost.featured_image_url}
                alt={blogPost.title}
                className="w-full aspect-[2/1] object-cover"
              />
            </div>
          )}

          {/* Excerpt for SpeakableSpecification */}
          {blogPost.excerpt && (
            <p className="blog-excerpt text-white/60 text-lg leading-relaxed mb-8 border-l-2 border-amber-500/30 pl-4">
              {blogPost.excerpt}
            </p>
          )}

          {/* Content */}
          <div
            className="prose prose-invert prose-amber max-w-none
              prose-headings:font-display prose-headings:text-white
              prose-p:text-white/80 prose-p:leading-relaxed
              prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white prose-strong:font-semibold
              prose-ul:text-white/80 prose-ol:text-white/80
              prose-li:marker:text-amber-500
              prose-blockquote:border-amber-500 prose-blockquote:text-white/70
              prose-code:text-amber-300 prose-code:bg-white/10 prose-code:px-1 prose-code:rounded
              prose-hr:border-white/10"
            dangerouslySetInnerHTML={{ __html: linkedHtml }}
          />

          {/* Tags */}
          {blogPost.tags && blogPost.tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-white/10">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4 text-white/40" />
                {blogPost.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-xs bg-white/10 text-white/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* FAQ Section */}
          {getFaqQuestions(blogPost.faq_schema).length > 0 && (
            <div className="mt-12 pt-8 border-t border-white/10">
              <h2 className="font-display font-semibold text-xl text-white mb-6">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                {getFaqQuestions(blogPost.faq_schema).map((faq, i) => (
                  <details
                    key={i}
                    className="group bg-white/5 rounded-xl border border-white/10"
                  >
                    <summary className="px-5 py-4 cursor-pointer text-white font-medium list-none flex items-center justify-between">
                      {faq.question}
                      <span className="text-amber-400 group-open:rotate-180 transition-transform ml-2 shrink-0">
                        &#9660;
                      </span>
                    </summary>
                    <div className="px-5 pb-4 text-white/70">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* Key Ingredients Mentioned */}
          {linkedIngredients.length > 0 && (
            <div className="mt-12 pt-8 border-t border-white/10">
              <h2 className="font-display font-semibold text-xl text-white mb-4">
                Key Ingredients Mentioned
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {linkedIngredients.map((name) => {
                  const link = ingredientLinks.find((l) => l.name === name)
                  return link ? (
                    <Link
                      key={name}
                      href={`/ingredients/${link.slug}`}
                      className="px-3 py-1.5 rounded-full text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30 transition-colors"
                    >
                      {name}
                    </Link>
                  ) : null
                })}
              </div>
            </div>
          )}
        </article>

        {/* CTA */}
        <BlogYuriCta />
      </div>
    </>
  )
}
