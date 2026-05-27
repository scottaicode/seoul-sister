const urls = [
  ['Green Tangerine (yesstyle)', 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1112714085/1/A.jpg'],
  ['PDRN Serum (medicube.us)', 'https://medicube.us/cdn/shop/files/pdrn-pink-peptide-serum-30ml_1800x.jpg'],
  ['Acne Patch (cosrx.com)', 'https://www.cosrx.com/cdn/shop/products/Acne_Pimple_Master_Patch.jpg'],
  ['Licorice (oliveyoung)', 'https://cdn-image.oliveyoung.com/prdtImg/1134/5c5234dc-29b6-4710-8e47-dcc94ba91a28.jpg'],
  ['I\'m From Rice (shopify)', 'https://cdn.shopify.com/s/files/1/0249/1218/files/I_m-From-Rice-Toner.jpg'],
  ['COSRX BHA (shopify)', 'https://cdn.shopify.com/s/files/1/0249/1218/files/COSRX-BHA-Blackhead-Power-Liquid-Korean-Skincare-Product.jpg'],
]
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
async function main() {
  for (const [label, url] of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'image/*' }, redirect: 'follow' })
      console.log(`${res.status} ${(res.headers.get('content-type')||'?').padEnd(28)} ${label}`)
    } catch (e) {
      console.log(`ERR ${(e as Error).message.slice(0,40).padEnd(28)} ${label}`)
    }
  }
}
main()
