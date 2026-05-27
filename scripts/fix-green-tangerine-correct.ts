import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=readFileSync('.env.local','utf8')
const get=(k:string)=>env.match(new RegExp(`^${k}=(.+)$`,'m'))?.[1]?.trim().replace(/^["']|["']$/g,'')
const APPLY=process.argv.includes('--apply')
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
async function reach(u:string){try{const r=await fetch(u,{headers:{'User-Agent':UA,Accept:'image/*'},redirect:'follow'});const ct=r.headers.get('content-type')||'';return r.status===200&&(ct.startsWith('image/')||ct.includes('octet-stream'))}catch{return false}}

const CREAM_ROW='f2948d93-6674-45dc-af27-545edfd4712d'  // wrongly touched; restore original
const CREAM_ORIGINAL='https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1125269695/1/A.jpg'
const SERUM_ROW='8cf06b70-f4f9-4912-bcc6-be2843e8864c'  // Bailey's actual serum
const SERUM_NEW='https://cdn-image.oliveyoung.com/prdtImg/1201/0123042a-9ddf-4cfe-99fd-a7b36af6646e.jpg'  // serum 30ml set, reachable

async function main(){
  const db=createClient(get('NEXT_PUBLIC_SUPABASE_URL')!,get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 1. Restore the Cream row to its original (undo my wrong write)
  const {data:cream}=await db.from('ss_products').select('name_en,image_url').eq('id',CREAM_ROW).maybeSingle()
  console.log(`Cream row (${cream?.name_en}) currently: ${cream?.image_url}`)
  console.log(`  → restoring original: ${CREAM_ORIGINAL}`)
  if(APPLY){const{error}=await db.from('ss_products').update({image_url:CREAM_ORIGINAL}).eq('id',CREAM_ROW);console.log(error?`  ✗ ${error.message}`:'  ✓ reverted')}

  // 2. Apply correct serum image to Bailey's actual serum row
  const ok=await reach(SERUM_NEW)
  const {data:serum}=await db.from('ss_products').select('name_en,image_url').eq('id',SERUM_ROW).maybeSingle()
  console.log(`\nSerum row (${serum?.name_en}) currently: ${serum?.image_url}`)
  console.log(`  new serum image reachable: ${ok}`)
  console.log(`  → ${SERUM_NEW}`)
  if(!ok){console.log('  ✗ refusing to write dead URL');return}
  if(APPLY){const{error}=await db.from('ss_products').update({image_url:SERUM_NEW}).eq('id',SERUM_ROW);console.log(error?`  ✗ ${error.message}`:'  ✓ serum image updated')}
  if(!APPLY)console.log('\n(dry run — pass --apply)')
}
main()
