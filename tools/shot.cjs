// Screenshot a lesson's figure plate from the built site (serve it first: pnpm preview):
//   node tools/shot.cjs <slug | url> <out.png> [waitMs]
const { chromium } = require('playwright');
const SITE = (process.env.SITE || 'http://localhost:4321/').replace(/\/?$/, '/');
(async () => {
  const [what, out, wait = 1500] = process.argv.slice(2);
  const url = /^https?:/.test(what) ? what : `${SITE}lessons/${what}/`;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1.5 })).newPage();
  await p.goto(url);
  await p.evaluate(() => document.querySelector('.iso-plate').scrollIntoView());
  await p.waitForTimeout(Number(wait));
  await (await p.$('.iso-plate')).screenshot({ path: out });
  console.log(await p.textContent('[data-readout]'));
  await b.close();
})();
