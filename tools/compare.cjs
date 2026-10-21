// Compare a rebuilt lesson page against a baseline copy: figure SVG, text, experiment results, screenshots, errors.
// node tools/compare.cjs <baseline.html> <rebuilt.html>
const { chromium } = require('playwright');
const fs = require('fs');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const [base, next] = process.argv.slice(2);
const svgOf = (html) => { const a = html.indexOf('<svg', html.indexOf('iso-stage')); return html.slice(a, html.indexOf('</svg>', a) + 6); };
(async () => {
  const report = {};
  report.svgSame = svgOf(fs.readFileSync(base, 'utf8')) === svgOf(fs.readFileSync(next, 'utf8'));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const look = async (file, scheme) => {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { const t0 = 1700000000000; Date.now = () => t0; }); const p = await ctx.newPage(); const errors = [];
    p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('file://' + require('path').resolve(file)); await p.waitForTimeout(800);
    const shot = PNG.sync.read(await p.screenshot({ fullPage: true }));
    const text = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    let outcomes = [];
    if (scheme === 'light') {
      for (const id of await p.$$eval('[data-exp]', (els) => els.map((e) => e.dataset.exp))) {
        await p.click(`[data-exp="${id}"] [data-choice="0"]`); await p.click(`[data-exp="${id}"] [data-run]`); await p.waitForSelector(`[data-exp="${id}"][data-done]`);
        outcomes.push(await p.textContent(`[data-exp="${id}"] [data-outcome]`));
      }
      await p.click('[data-set="speed"][data-value="0.5"]');
      await p.click('[data-theme-choice="dark"]');
      outcomes.push('dark-bg:' + await p.evaluate(() => getComputedStyle(document.body).backgroundColor));
      await p.evaluate(() => document.querySelector('.iso-plate').scrollIntoView());
      const play = await p.$('[data-act="pause"], [data-act="play"]'); if (play) await play.click();
      const r0 = await p.textContent('[data-readout]'); await p.waitForTimeout(3000);
      outcomes.push('animates:' + (r0 !== await p.textContent('[data-readout]')));
    }
    await ctx.close();
    return { shot, text, outcomes, errors };
  };
  for (const scheme of ['light', 'dark']) {
    const A = await look(base, scheme), B = await look(next, scheme);
    const w = Math.min(A.shot.width, B.shot.width), h = Math.min(A.shot.height, B.shot.height);
    const crop = (img) => { const out = new PNG({ width: w, height: h }); PNG.bitblt(img, out, 0, 0, w, h, 0, 0); return out; };
    const diff = pixelmatch(crop(A.shot).data, crop(B.shot).data, null, w, h, { threshold: 0.1 });
    report[scheme] = { sizeA: `${A.shot.width}x${A.shot.height}`, sizeB: `${B.shot.width}x${B.shot.height}`, diffPixels: diff, textSame: A.text === B.text, errorsA: A.errors.length, errorsB: B.errors };
    if (scheme === 'light') { report.outcomesSame = JSON.stringify(A.outcomes) === JSON.stringify(B.outcomes); report.outcomesB = B.outcomes.slice(-2); if (!report.outcomesSame) { report.oA = A.outcomes; report.oB = B.outcomes; } }
    if (!report[scheme].textSame) { const a = A.text, c = B.text; let i = 0; while (a[i] === c[i]) i++; report[scheme].textAt = [a.slice(i - 40, i + 80), c.slice(i - 40, i + 80)]; }
  }
  console.log(JSON.stringify(report, null, 1));
  await b.close();
})();
