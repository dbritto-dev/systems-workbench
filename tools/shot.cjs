// Screenshot the figure plate of a built lesson: node tools/shot.cjs <page.html> <out.png> [waitMs]
const { chromium } = require('playwright');
(async () => {
  const [file, out, wait] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1.5 })).newPage();
  await p.goto('file://' + require('path').resolve(file));
  await p.evaluate(() => document.querySelector('.iso-plate').scrollIntoView());
  await p.waitForTimeout(Number(wait));
  await (await p.$('.iso-plate')).screenshot({ path: out });
  console.log(await p.textContent('[data-readout]'));
  await b.close();
})();
