import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  // Check if table already exists
  const { error: checkError } = await supabase
    .from('ss_trending_history')
    .select('id')
    .limit(1)

  if (!checkError) {
    console.log('✓ Table ss_trending_history already exists')
    return
  }

  console.log('Table does not exist yet. Reading migration SQL...')
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260303000001_create_trending_history.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  // Execute via rpc (requires a helper function or direct REST call)
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`,
    {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  if (!response.ok) {
    console.log('REST RPC not available. Please run the migration SQL manually in Supabase SQL Editor:')
    console.log(`File: ${sqlPath}`)
    console.log('')
    console.log('Or paste this SQL in Supabase Dashboard > SQL Editor:')
    console.log(sql)
  } else {
    console.log('✓ Migration applied successfully')
  }
}

run().catch(console.error)
