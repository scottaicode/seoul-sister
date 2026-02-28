import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const slugsToDelete = [
  'best-korean-sunscreens-2026',
  'k-beauty-ingredients-guide-data-backed',
  'olive-young-bestsellers-what-korea-is-buying',
  'best-korean-serums-2026',
  'korean-skincare-beginners-guide',
]

async function main() {
  console.log('Deleting 5 seeded blog posts...')

  const { data, error } = await supabase
    .from('ss_content_posts')
    .delete()
    .in('slug', slugsToDelete)
    .select('slug')

  if (error) {
    console.error('Delete failed:', error)
    process.exit(1)
  }

  console.log(`Deleted ${data?.length ?? 0} posts:`)
  data?.forEach(row => console.log(`  - ${row.slug}`))

  // Verify remaining
  const { count } = await supabase
    .from('ss_content_posts')
    .select('*', { count: 'exact', head: true })
    .not('published_at', 'is', null)

  console.log(`\nRemaining published posts: ${count}`)
}

main()
