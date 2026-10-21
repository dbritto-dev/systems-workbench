const { chromium } = require('playwright');
const sharp = require('sharp');
const { normalize } = require('./normalize.cjs');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const OUT = path.join(__dirname, 'previews');
const CHROMIUM = process.env.CHROMIUM_PATH || undefined; // e.g. /opt/pw-browsers/chromium
const only = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  for (const l of L) {
    if (only && l.slug !== only) continue;
    for (const scheme of ['light', 'dark']) {
      const p = await (await b.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme })).newPage();
      await p.goto('file://' + path.join(ROOT, l.html));
      await p.evaluate(() => document.querySelector('.iso-plate').scrollIntoView({ block: 'center' }));
      if (l.slug === 'retrystorm') { await p.waitForTimeout(3000); const rush = await p.$('[data-act="rush"], .btn.primary[data-act]'); if (rush) { await rush.click(); await p.evaluate(() => document.querySelector('.iso-plate').scrollIntoView({ block: 'center' })); } }
      await p.waitForTimeout(l.slug === 'rolling' ? 14000 : 9000);
      const png = await (await p.$('.iso-stage svg')).screenshot();
      await (await normalize(png)).toFile(`${OUT}/${l.slug}-${scheme}.webp`);
      await p.context().close();
    }
    console.log('shot', l.slug);
  }
  await b.close();
})();
