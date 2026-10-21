// The lesson page: one template for every workbench. A lesson supplies its content, its figure,
// its figure-specific CSS and its live script; layout, styles, theme switch and shared browser helpers live here.
import { readFileSync, writeFileSync } from "node:fs";
import * as k from "./kit.mjs";
import { PARTS_CSS, LIT_FILL_PAGE_CSS } from "./parts.mjs";

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- styles ----------
const light = k.ISO_CSS.match(/\.iso\[data-theme="light"\]\{([^}]*)\}/)[1];
const dark = k.ISO_CSS.match(/\.iso\{([^}]*)\}/)[1];

// Light by default; dark from the device, or forced either way by the theme switch (data-theme on <html>).
export const THEME_CSS = `
:root{color-scheme:light;}
.iso{${light}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark}:root:not([data-theme="light"]) .iso{${dark}}}
:root[data-theme="dark"]{color-scheme:dark}
:root[data-theme="dark"] .iso{${dark}}
`;

export const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:15px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.page{width:min(780px,100% - 32px);margin:56px auto 96px;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
.mono{font-family:var(--anatomy-mono)}
.eyebrow{font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--anatomy-muted)}
h1{font-size:30px;line-height:1.2;font-weight:600;color:var(--anatomy-strong);margin:10px 0 12px;letter-spacing:-.01em}
h2{font-size:21px;font-weight:600;color:var(--anatomy-strong);margin:0 0 8px;letter-spacing:-.005em}
h3{font-size:16px;font-weight:600;color:var(--anatomy-strong);margin:0}
p{margin:0 0 12px}
strong{color:var(--anatomy-strong);font-weight:600}
code{font-family:var(--anatomy-mono);font-size:.88em;color:var(--anatomy-strong)}
.lede{font-size:17px;max-width:62ch}
.parts{display:flex;flex-wrap:wrap;gap:6px 18px;margin:18px 0 0;padding:0;list-style:none;font-family:var(--anatomy-mono);font-size:12px;color:var(--anatomy-muted)}
.parts a{color:inherit;text-decoration:none;border-bottom:1px solid var(--anatomy-faint)}
.parts a:hover{color:var(--anatomy-strong)}
section{margin-top:72px}
.section-head{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;align-items:baseline;margin-bottom:18px}
.section-head .eyebrow{grid-row:span 2;padding-top:5px}
.section-head p{grid-column:2;margin:0;max-width:60ch}
.iso-stage{outline:none}
.iso-stage:focus-visible{box-shadow:0 0 0 1px var(--anatomy-hi)}
.panel{margin-top:14px;border:1px solid var(--anatomy-faint);background:var(--anatomy-card)}
.stats{display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid var(--anatomy-faint)}
.stat{padding:10px 12px;border-right:1px solid var(--anatomy-faint)}
.stat:last-child{border-right:0}
.stat b{display:block;font:500 18px/1.2 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.stat span{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-muted)}
.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px 18px;padding:14px 12px;align-items:start}
.control{display:grid;gap:6px;align-content:start}
.control>span{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted)}
.seg{display:flex;flex-wrap:wrap;gap:0;align-items:flex-start}
button{font:inherit;color:inherit}
.seg button,.btn{appearance:none;border:1px solid var(--anatomy-lo);background:transparent;color:var(--anatomy-text);font-family:var(--anatomy-mono);font-size:12px;padding:6px 10px;cursor:pointer;line-height:1.2;min-height:32px}
.seg button+button{margin-left:-1px}
.seg button[aria-pressed="true"]{background:var(--anatomy-strong);border-color:var(--anatomy-strong);color:var(--anatomy-card);position:relative;z-index:1}
.btn:hover,.seg button:hover{border-color:var(--anatomy-hi);color:var(--anatomy-strong);position:relative;z-index:2}
.seg button[aria-pressed="true"]:hover{color:var(--anatomy-card)}
.btn[disabled]{opacity:.4;cursor:default}
.btn.primary{background:var(--anatomy-strong);border-color:var(--anatomy-strong);color:var(--anatomy-card)}
.actions{display:flex;flex-wrap:wrap;gap:8px}
.note{font-size:13px;color:var(--anatomy-muted);margin-top:10px}
.exp{border:1px solid var(--anatomy-faint);background:var(--anatomy-card);padding:18px 18px 16px;margin-top:14px}
.exp-head{display:flex;gap:12px;align-items:baseline;justify-content:space-between;flex-wrap:wrap}
.exp-change{font-family:var(--anatomy-mono);font-size:12px;color:var(--anatomy-muted);margin:4px 0 12px}
.exp-q{color:var(--anatomy-strong);margin-bottom:10px}
.choices{display:grid;gap:6px;margin-bottom:12px}
.choice{display:flex;gap:10px;align-items:flex-start;text-align:left;border:1px solid var(--anatomy-lo);background:transparent;padding:9px 12px;cursor:pointer;color:var(--anatomy-text);font-size:14px;line-height:1.45}
.choice:hover{border-color:var(--anatomy-hi);color:var(--anatomy-strong)}
.choice .mark{font-family:var(--anatomy-mono);font-size:11px;color:var(--anatomy-muted);padding-top:2px;flex:none}
.choice[aria-pressed="true"]{border-color:var(--anatomy-strong);color:var(--anatomy-strong);box-shadow:inset 3px 0 0 var(--anatomy-strong)}
.choice[data-verdict="right"]{box-shadow:inset 3px 0 0 var(--anatomy-green);border-color:var(--anatomy-green)}
.choice[data-verdict="wrong"]{box-shadow:inset 3px 0 0 var(--anatomy-red);border-color:var(--anatomy-red)}
.choice[disabled]{cursor:default}
.result{display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--anatomy-faint)}
.exp[data-done] .result{display:block}
.verdict{font-weight:600;color:var(--anatomy-strong);margin-bottom:10px}
.bars{display:grid;gap:8px;margin:4px 0 14px}
.bar{display:grid;grid-template-columns:150px 1fr 64px;gap:10px;align-items:center;font-family:var(--anatomy-mono);font-size:12px}
.bar .track{height:12px;border:1px solid var(--anatomy-lo);position:relative}
.bar .fill{position:absolute;inset:0 auto 0 0;background:var(--anatomy-mid);transition:width .7s var(--anatomy-ease)}
.bar[data-after] .fill{background:var(--anatomy-strong)}
.bar b{font-weight:500;color:var(--anatomy-strong);text-align:right;font-variant-numeric:tabular-nums}
details{border:1px solid var(--anatomy-faint);background:var(--anatomy-card);margin-top:10px}
summary{cursor:pointer;padding:14px 16px;color:var(--anatomy-strong);list-style:none;display:flex;gap:12px}
summary::-webkit-details-marker{display:none}
summary .n{font-family:var(--anatomy-mono);font-size:11px;color:var(--anatomy-muted);padding-top:3px;flex:none}
details[open] summary{border-bottom:1px solid var(--anatomy-faint)}
.answer{padding:12px 16px 14px 44px;font-size:14px}
.answer .eyebrow{display:block;margin-bottom:4px}
footer{margin-top:72px;padding-top:16px;border-top:1px solid var(--anatomy-faint);font-size:12.5px;color:var(--anatomy-muted)}
footer a{color:inherit}
.theme-switch{display:flex;justify-content:flex-end;margin:-36px 0 18px}
.theme-switch .seg{display:flex}
.theme-switch button{appearance:none;border:1px solid var(--anatomy-lo);background:transparent;color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.06em;padding:5px 10px;min-height:28px;cursor:pointer;line-height:1.2}
.theme-switch button+button{margin-left:-1px}
.theme-switch button:hover{color:var(--anatomy-strong);border-color:var(--anatomy-hi);position:relative;z-index:2}
.theme-switch button[aria-pressed="true"]{background:var(--anatomy-strong);border-color:var(--anatomy-strong);color:var(--anatomy-card);position:relative;z-index:1}
@media (max-width:640px){
  h1{font-size:25px}
  .stats{grid-template-columns:repeat(3,1fr)}
  .stat:nth-child(3){border-right:0}
  .stat:nth-child(-n+3){border-bottom:1px solid var(--anatomy-faint)}
  .bar{grid-template-columns:96px 1fr 52px}
  .section-head{grid-template-columns:1fr}
  .section-head .eyebrow{grid-row:auto;padding:0}
  .section-head p{grid-column:1}
  .answer{padding-left:16px}
}
`;

// ---------- theme switch (Auto / Light / Dark, remembered per browser) ----------
const THEME_HEAD = `<script>(function(){try{var t=localStorage.getItem("workbench-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>`;
const THEME_SWITCH = `<div class="theme-switch" data-theme-switch><div class="seg" role="group" aria-label="Theme"><button type="button" data-theme-choice="auto">Auto</button><button type="button" data-theme-choice="light">Light</button><button type="button" data-theme-choice="dark">Dark</button></div></div>`;
const THEME_SCRIPT = `<script>(function(){
var root=document.documentElement,buttons=document.querySelectorAll("[data-theme-choice]");
function current(){var t=root.getAttribute("data-theme");return t==="light"||t==="dark"?t:"auto";}
function mark(){var c=current();buttons.forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-theme-choice")===c));});}
buttons.forEach(function(b){b.addEventListener("click",function(){var c=b.getAttribute("data-theme-choice");
if(c==="auto")root.removeAttribute("data-theme");else root.setAttribute("data-theme",c);
try{if(c==="auto")localStorage.removeItem("workbench-theme");else localStorage.setItem("workbench-theme",c);}catch(e){}
mark();});});
mark();})();</script>`;

// ---------- pieces ----------
// A segmented control. options: [[value, label], ...]; current is the pressed value.
export const seg = (name, label, options, current) => `<div class="control"><span>${label}</span><div class="seg" role="group" aria-label="${label}">${options.map(([value, text]) => `<button type="button" data-set="${name}" data-value="${value}" aria-pressed="${String(value) === String(current)}">${text}</button>`).join("")}</div></div>`;

// The speed control every lesson has.
export const speedSeg = (options = [[0.5, "×0.5"], [1, "×1"], [3, "×3"], [8, "×8"]], current = 1) => seg("speed", "Speed", options, current);

// A row of action buttons. buttons: [[act, label], ...] → <button data-act="act">.
export const actions = (label, buttons) => `<div class="control"><span>${label}</span><div class="actions">
      ${buttons.map(([act, text]) => `<button class="btn" type="button" data-act="${act}">${text}</button>`).join("\n      ")}
    </div></div>`;

// The stats strip and controls panel under the figure. stats: [[key, label, initial], ...] → <b data-s="key">.
export const panel = ({ stats, controls }) => `<div class="panel">
  <div class="stats" data-stats>
${stats.map(([key, label, initial = "0"]) => `    <div class="stat"><b data-s="${key}">${initial}</b><span>${label}</span></div>`).join("\n")}
  </div>
  <div class="controls">
    ${controls.join("\n    ")}
  </div>
</div>`;

// The figure card. stage: attributes for the focusable stage div (e.g. 'data-office aria-label="…"').
export const figurePlate = ({ fig = "Fig 1", title, hint = "Space pauses", readout = "starting", keys, caption, stage, svg }) =>
  k.plateHtml({ fig, title, hint, readout, keys, caption, body: `<div class="iso-stage" ${stage} tabindex="0">${svg}</div>` });

export const experimentsHtml = (list) => list.map((e, i) => `<article class="exp" data-exp="${e.id}">
  <div class="exp-head"><h3>${i + 1}. ${esc(e.title)}</h3><span class="eyebrow">Experiment ${i + 1} of ${list.length}</span></div>
  <div class="exp-change">${esc(e.change)}</div>
  <div class="exp-q">${esc(e.question)}</div>
  <div class="choices" role="group" aria-label="Your prediction">${e.options.map((o, j) => `<button type="button" class="choice" data-choice="${j}" aria-pressed="false"><span class="mark">${"ABCDE"[j]}</span><span>${esc(o)}</span></button>`).join("")}</div>
  <div class="actions"><button class="btn primary" type="button" data-run disabled>Pick a prediction, then run</button><button class="btn" type="button" data-watch>Watch it in the figure</button></div>
  <div class="result" aria-live="polite">
    <div class="verdict" data-outcome></div>
    <div class="bars" data-bars></div>
    <p>${esc(e.why)}</p>
  </div>
</article>`).join("");

export const questionsHtml = (list) => list.map(([q, a], i) => `<details><summary><span class="n">Q${i + 1}</span><span>${esc(q)}</span></summary><div class="answer"><span class="eyebrow">A good answer covers</span>${esc(a)}</div></details>`).join("");

// What the browser needs before the lesson's own script: the kit, then the shared WB helpers.
// The kit, then the WB helpers. digits.mjs is inlined inside WB's scope, so its names never clash with a lesson's.
export const clientScript = () => k.kitScript() + readFileSync(new URL("./client.js", import.meta.url), "utf8")
  .replace("/*@digits*/", readFileSync(new URL("./digits.mjs", import.meta.url), "utf8").replace(/^export /gm, "").replace(/^/gm, "  ").trimStart());

// For the page script: a lesson's sim.js with `export` stripped, ready to inline.
export const inlineModule = (url) => readFileSync(url, "utf8").replace(/^export /gm, "");

// The full page.
export function renderPage({
  title,
  eyebrow,
  lede,
  machine,          // { intro, figure, panel }
  predict,          // { intro, experiments }
  explain = {},     // { intro, questions }
  footer = `Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson.`,
  css = "",         // figure-specific CSS
  script,           // the lesson's live code (runs after clientScript)
  litFill = true,   // lit solids fill (black in light, white in dark); opt a solid out with data-lit-outline
}) {
  const explainIntro = explain.intro ?? `Answer out loud or in writing before opening each one. These work well as a pairing exercise: one person explains, the other asks "why?" twice.`;
  const body = `<main class="page">${THEME_SWITCH}
  <header>
    <div class="eyebrow">${eyebrow}</div>
    <h1>${title}</h1>
    <p class="lede">${lede}</p>
    <ul class="parts"><li><a href="#machine">1 · The machine</a></li><li><a href="#predict">2 · Predict, then run</a></li><li><a href="#explain">3 · Explain it back</a></li></ul>
  </header>

  <section id="machine">
    <div class="section-head"><span class="eyebrow">01</span><h2>The machine</h2><p>${machine.intro}</p></div>
    ${machine.figure}
    ${machine.panel}
  </section>

  <section id="predict">
    <div class="section-head"><span class="eyebrow">02</span><h2>Predict, then run</h2><p>${predict.intro}</p></div>
    ${experimentsHtml(predict.experiments)}
  </section>

  <section id="explain">
    <div class="section-head"><span class="eyebrow">03</span><h2>Explain it back</h2><p>${explainIntro}</p></div>
    ${questionsHtml(explain.questions)}
  </section>

  <footer>${footer}</footer>
</main>`;
  const code = (clientScript() + script).replace(/<\/(script)/gi, "<\\/$1");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${esc(title)}</title>${THEME_HEAD}<style>${k.ISO_CSS}${THEME_CSS}${PAGE_CSS}${PARTS_CSS}${LIT_FILL_PAGE_CSS}${css}</style></head><body class="iso${litFill ? " lit-fill" : ""}">${body}<script type="module">${code}</script>${THEME_SCRIPT}</body></html>`;
}

export function writePage(url, options) {
  const html = renderPage(options);
  writeFileSync(url, html);
  return html.length;
}
