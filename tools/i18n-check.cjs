// Checks a lesson page in English and Spanish: console errors, phone width, experiments and their re-render
// on a language switch, the readout following a switch (running and paused), untranslated or leaked strings,
// and screenshots of the figure in both languages and themes.
//   node tools/i18n-check.cjs lessons/queues/queue-workbench.html [outDir]
// Needs playwright (NODE_PATH or npm install); set CHROMIUM_PATH to use a specific browser.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = 'file://' + path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3] || '.') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const SAME_OK = /^(auto|fig \d+|anatomy|en|es|×?[\d.,:%/ ×+−-]+[a-z]{0,3}|[a-z]\d*|q\d+|p\d+)$/i;

const collect = () => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const s = n.textContent.trim(); if (!s) continue;
    const el = n.parentElement; if (!el || el.closest('script,style')) continue;
    if (!el.getClientRects().length) continue;
    let hidden = false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') { hidden = true; break; } }
    if (!hidden) out.push(s);
  }
  document.querySelectorAll('[aria-label]').forEach((e) => out.push('aria: ' + e.getAttribute('aria-label')));
  out.push('title: ' + document.title);
  return out;
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const texts = {}; let problems = 0;
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const errs = [];
    const p = await (await b.newContext({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 1.6, colorScheme: scheme })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(FILE + '?lang=' + lang);
    await p.evaluate(() => document.querySelector('.iso-plate').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(1200);
    await (await p.$('.iso-plate')).screenshot({ path: OUT + 'i18n-' + lang + '-' + scheme + '.png' });
    if (scheme === 'light') {
      for (const id of await p.$$eval('[data-exp]', (els) => els.map((e) => e.dataset.exp))) {
        await p.click(`[data-exp="${id}"] [data-choice="0"]`);
        await p.click(`[data-exp="${id}"] [data-run]`);
      }
      await p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      texts[lang] = await p.evaluate(collect);
      const other = lang === 'es' ? 'en' : 'es';
      const v1 = await p.$$eval('[data-outcome]', (els) => els.map((e) => e.textContent));
      await p.click(`[data-lang-choice="${other}"]`);
      const v2 = await p.$$eval('[data-outcome]', (els) => els.map((e) => e.textContent));
      if (v1.some((v, i) => v === v2[i])) { problems++; console.log(`✗ ${lang}: an experiment verdict did not change after switching to ${other}`); }
      await p.click(`[data-lang-choice="${lang}"]`);
      await p.evaluate(() => document.querySelector('.iso-plate').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(600);
      const pause = await p.$('[data-act="pause"]');
      if (pause) {
        await pause.click();
        const r1 = await p.textContent('[data-readout]'), p1 = await pause.textContent();
        await p.click(`[data-lang-choice="${other}"]`);
        const r2 = await p.textContent('[data-readout]'), p2 = await pause.textContent();
        if (r1 === r2 && /[a-z]{3}/i.test(r1)) { problems++; console.log(`✗ ${lang}: paused readout did not follow the switch: "${r1}"`); }
        if (p1 === p2) { problems++; console.log(`✗ ${lang}: pause button label did not follow the switch: "${p1}"`); }
      }
    }
    if (errs.length) { problems++; console.log(`✗ ${lang} ${scheme}: console errors`, errs); }
    await p.context().close();
  }
  for (const lang of ['es', 'en']) {
    const m = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage();
    await m.goto(FILE + '?lang=' + lang); await m.waitForTimeout(600);
    const sw = await m.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 390) { problems++; console.log(`✗ ${lang}: page is ${sw}px wide at 390px`); }
    await m.context().close();
  }
  const en = new Set(texts.en), es = new Set(texts.es);
  const same = [...es].filter((s) => en.has(s) && /[A-Za-z]{3,}/.test(s.replace(/^(aria|title): /, '')) && !SAME_OK.test(s.replace(/^(aria|title): /, '').trim()));
  const leaks = [...en].filter((s) => /[áéíóúñ¿¡]|\b(el|los|las|del|para|una|que|con)\b/i.test(s));
  console.log('\n— identical in ES and EN (untranslated unless a deliberate term):\n' + (same.join('\n') || '(none)'));
  console.log('\n— EN text that looks Spanish (leaks):\n' + (leaks.join('\n') || '(none)'));
  fs.writeFileSync(OUT + 'i18n-texts.json', JSON.stringify(texts, null, 1));
  console.log(`\n${problems ? '✗ ' + problems + ' problem(s)' : '✓ checks passed'}; screenshots and texts in ${OUT}`);
  await b.close();
  process.exit(problems ? 1 : 0);
})();
