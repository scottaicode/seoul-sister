const sharp=require('sharp'), fs=require('fs')
// Find the glyph's real ink bounds at a given baseline, then solve for the
// baseline that centres it. Eyeballing a text baseline is guesswork; text
// metrics vary per font and 유 has no descender.
async function inkBounds(y, fontSize){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/><text x="256" y="${y}" font-family="'Apple SD Gothic Neo','Noto Sans KR',Georgia,serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" fill="#fff">유</text></svg>`
  const {data,info}=await sharp(Buffer.from(svg),{density:900}).resize(512,512)
    .greyscale().raw().toBuffer({resolveWithObject:true})
  let mnx=1e9,mxx=-1,mny=1e9,mxy=-1
  for(let py=0;py<info.height;py++) for(let px=0;px<info.width;px++){
    if(data[py*info.width+px]>60){
      if(px<mnx)mnx=px; if(px>mxx)mxx=px; if(py<mny)mny=py; if(py>mxy)mxy=py
    }
  }
  return {mnx,mxx,mny,mxy,w:mxx-mnx,h:mxy-mny}
}
;(async()=>{
  const FS=392
  let b=await inkBounds(392,FS)
  console.log('at y=392:',b)
  // shift so ink centre lands on 256
  const inkCy=(b.mny+b.mxy)/2
  const newY=Math.round(392+(256-inkCy))
  b=await inkBounds(newY,FS)
  console.log(`at y=${newY}:`,b,'inkCy=',((b.mny+b.mxy)/2).toFixed(1))
  // also report fill ratio so we can size it to ~72% of the frame
  console.log('coverage: w',(b.w/512*100).toFixed(0)+'%','h',(b.h/512*100).toFixed(0)+'%')
  fs.writeFileSync('/tmp/besty.txt',String(newY))
})()
