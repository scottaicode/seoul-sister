const puppeteer = require('puppeteer-core');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 1100, deviceScaleFactor: 2 }); // 2x = crisp
  const file = 'file://' + path.resolve('yuri-chat-bubbles.html');
  await page.goto(file, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800)); // let fonts settle
  const scenes = await page.$$('.scene');
  const names = ['A-photo-read','B-buy-less','C-cycle-aware','D-counterfeit','E-proof','F-endcard'];
  for (let i = 0; i < scenes.length; i++) {
    await scenes[i].screenshot({ path: `scene-${names[i]}.png` });
    console.log('wrote scene-' + names[i] + '.png');
  }
  await browser.close();
})();
