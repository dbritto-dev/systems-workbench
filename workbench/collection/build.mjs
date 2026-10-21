// Builds the Systems Workbench catalogue page from catalog.json (written by extract.mjs) and previews/.
import { readFileSync, writeFileSync } from "node:fs";
import { ISO_CSS } from "../kit.mjs";

const lessons = JSON.parse(readFileSync(new URL("./catalog.json", import.meta.url), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const block = (selector) => ISO_CSS.match(new RegExp(selector.replace(/[[\]"]/g, "\\$&") + "\\{([^}]*)\\}"))[1];
const light = block('.iso[data-theme="light"]');
const dark = block(".iso");
const AREAS = ["Fundamentals", "Data", "Concurrency", "Messaging", "Distributed", "Traffic", "Resilience", "Delivery", "Observability", "Frontend"];
const two = (n) => String(n).padStart(2, "0");
const concept = (l) => l.eyebrow.split("·").pop().trim();

const card = (l) => `<article class="card" data-area="${l.area}" id="lesson-${two(l.n)}">
  <button type="button" class="shot" data-preview="${l.slug}" aria-label="Preview ${esc(l.title)}">
    <img class="on-light" src="previews/${l.slug}-light.webp" alt="${esc(l.machine)}, the machine in ${esc(l.title)}" loading="lazy" width="1200" height="800">
    <img class="on-dark" src="previews/${l.slug}-dark.webp" alt="" loading="lazy" width="1200" height="800">
    <span class="plate-corner tl">Lesson ${two(l.n)}</span>
    <span class="plate-corner tr">${esc(l.machine)}</span>
  </button>
  <div class="card-body">
    <div class="meta"><span>${esc(l.area)}</span><span>${esc(concept(l))}</span></div>
    <h2 title="${esc(l.title)}">${esc(l.title)}</h2>
    <p>${esc(l.blurb)}</p>
    <div class="card-foot">
      <span class="counts">${l.exps.length} experiments · ${l.questions} questions</span>
      <span class="card-actions">
        <button type="button" class="btn" data-preview="${l.slug}">Preview</button>
        <a class="btn primary" href="${l.url}" target="_blank" rel="noopener">Open lesson</a>
      </span>
    </div>
  </div>
</article>`;

const counts = Object.fromEntries(AREAS.map((a) => [a, lessons.filter((l) => l.area === a).length]));
const filters = [`<button type="button" data-filter="all" aria-pressed="true">All <b>${lessons.length}</b></button>`, ...AREAS.map((a) => `<button type="button" data-filter="${a}" aria-pressed="false">${a} <b>${counts[a]}</b></button>`)].join("");
const data = lessons.map(({ n, slug, area, url, title, eyebrow, lede, machine, exps, questions }) => ({ n, slug, area, url, title, concept: concept({ eyebrow }), lede, machine, exps, questions }));

const html = `<title>Systems Workbench</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: an instrument catalogue. A header plate, a row of area filters, then a two-column grid of lesson plates whose previews are real screenshots of each running machine. */
:root{${light}
  --sheet:var(--anatomy-page);--plate:var(--anatomy-card);--ink:var(--anatomy-strong);--text:var(--anatomy-text);--muted:var(--anatomy-muted);--rule:var(--anatomy-faint);--edge:var(--anatomy-lo);
  --display:"IBM Plex Sans Condensed","Arial Narrow",ui-sans-serif,system-ui,sans-serif;
  --body:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark};color-scheme:dark}}
:root[data-theme="dark"]{${dark};color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--sheet);color:var(--text);font:15px/1.6 var(--body);-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding-block:48px 88px;padding-left:max(16px, env(safe-area-inset-left, 0px));padding-right:max(16px, env(safe-area-inset-right, 0px))}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;font:500 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.seg{display:flex}
.seg button,.btn,.filters button{appearance:none;font:500 11.5px/1.2 var(--mono);letter-spacing:.04em;color:var(--text);background:transparent;border:1px solid var(--edge);padding:7px 11px;min-height:32px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.seg button+button,.filters button+button{margin-left:-1px}
.seg button[aria-pressed="true"],.filters button[aria-pressed="true"],.btn.primary{background:var(--ink);border-color:var(--ink);color:var(--plate);position:relative;z-index:1}
.seg button:hover,.btn:hover,.filters button:hover{border-color:var(--anatomy-hi);color:var(--ink);position:relative;z-index:2}
.seg button[aria-pressed="true"]:hover,.filters button[aria-pressed="true"]:hover,.btn.primary:hover{color:var(--plate)}
button:focus-visible,a:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
header.head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px 40px;align-items:end;margin:40px 0 28px;padding-bottom:28px;border-bottom:1px solid var(--rule)}
h1{font:600 clamp(36px,6vw,64px)/.95 var(--display);letter-spacing:-.02em;color:var(--ink);margin:0;text-wrap:balance}
.intro{max-width:60ch;margin:16px 0 0;font-size:16px}
.stats{display:grid;grid-template-columns:repeat(3,auto);gap:0;border:1px solid var(--rule);background:var(--plate)}
.stats div{padding:10px 16px;border-right:1px solid var(--rule)}
.stats div:last-child{border-right:0}
.stats b{display:block;font:500 22px/1.15 var(--mono);color:var(--ink);font-variant-numeric:tabular-nums}
.stats span{font:500 10px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.filters-wrap{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:stretch;gap:6px;margin-bottom:22px}
.filters-wrap[data-fits]{grid-template-columns:minmax(0,1fr)}
.filters-wrap[data-fits] .scroll-btn{display:none}
.filters-view{position:relative;min-width:0}
.filters{display:flex;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:1px}
.filters::-webkit-scrollbar{display:none}
.filters button{flex:0 0 auto;white-space:nowrap;scroll-snap-align:start}
.filters-view::before,.filters-view::after{content:"";position:absolute;top:0;bottom:0;width:28px;pointer-events:none;opacity:0;transition:opacity .15s;z-index:3}
.filters-view::before{left:0;background:linear-gradient(to right,var(--sheet),transparent)}
.filters-view::after{right:0;background:linear-gradient(to left,var(--sheet),transparent)}
.filters-wrap[data-more-left] .filters-view::before,.filters-wrap[data-more-right] .filters-view::after{opacity:1}
.scroll-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:34px;min-height:34px;padding:0;border:1px solid var(--edge);background:var(--plate);color:var(--ink);cursor:pointer}
.scroll-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.scroll-btn:hover:not(:disabled){border-color:var(--anatomy-hi)}
.scroll-btn:disabled{opacity:.35;cursor:default}
.filters button b{font-weight:500;opacity:.6}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.card{display:flex;flex-direction:column;background:var(--plate);border:1px solid var(--rule);min-width:0}
.card[hidden]{display:none}
.shot{position:relative;display:block;width:100%;padding:0;border:0;border-bottom:1px solid var(--rule);background:var(--plate);cursor:zoom-in}
.shot img{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:contain;max-width:100%}
.plate-corner{position:absolute;top:12px;font:500 10px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.plate-corner.tl{left:14px;color:var(--text)}
.plate-corner.tr{right:14px}
.on-dark{display:none!important}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .on-dark{display:block!important}:root:not([data-theme="light"]) .on-light{display:none!important}}
:root[data-theme="dark"] .on-dark{display:block!important}
:root[data-theme="dark"] .on-light{display:none!important}
.card-body{display:flex;flex-direction:column;gap:8px;padding:16px 18px 18px;flex:1}
.meta{display:flex;gap:14px;font:500 10.5px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.card h2{font:600 24px/1.2 var(--display);letter-spacing:-.01em;color:var(--ink);margin:2px 0 0;height:1.2em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card p{margin:0;font-size:14.5px;line-height:1.5;height:4.5em;display:-webkit-box;-webkit-line-clamp:3;line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card-foot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-top:auto;padding-top:10px}
.counts{font:500 11px/1 var(--mono);color:var(--muted);font-variant-numeric:tabular-nums}
.card-actions{display:flex;gap:8px}
footer{margin-top:56px;padding-top:16px;border-top:1px solid var(--rule);font-size:12.5px;color:var(--muted)}
footer a{color:inherit}
dialog{width:min(1040px,100% - 32px);max-height:calc(100% - 32px);padding:0;border:1px solid var(--edge);background:var(--plate);color:var(--text)}
dialog::backdrop{background:color-mix(in srgb, var(--sheet) 70%, transparent);backdrop-filter:blur(2px)}
.dlg{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)}
.dlg-shot{position:relative;padding:36px 18px 18px;border-right:1px solid var(--rule);display:flex;align-items:center}
.dlg-shot img{width:100%;height:auto;display:block}
.dlg-text{padding:22px 22px 20px;display:flex;flex-direction:column;gap:12px;min-width:0;overflow:auto}
.dlg-text h2{font:600 30px/1.05 var(--display);color:var(--ink);margin:0}
.dlg-text p{margin:0;font-size:14.5px}
.dlg-text ol{margin:0;padding:0;list-style:none;display:grid;gap:0;border-top:1px solid var(--rule)}
.dlg-text li{display:grid;grid-template-columns:26px minmax(0,1fr);gap:6px;padding:9px 0;border-bottom:1px solid var(--rule)}
.dlg-text li span{font:500 11px/1.6 var(--mono);color:var(--muted)}
.dlg-text li b{display:block;font-weight:600;color:var(--ink);font-size:14px}
.dlg-text li em{display:block;font-style:normal;font-size:13px;color:var(--muted)}
.dlg-actions{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:auto}
.close{position:absolute;top:8px;right:8px}
@media (max-width:760px){
  header.head{grid-template-columns:1fr}
  .grid{grid-template-columns:1fr}
  .dlg{grid-template-columns:1fr}
  .dlg-shot{border-right:0;border-bottom:1px solid var(--rule)}
}
@media (prefers-reduced-motion:no-preference){.card{transition:border-color .2s}.card:hover{border-color:var(--edge)}}
</style>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:wght@400;600&display=swap">
<div class="wrap">
  <div class="top"><span>Distributed systems, one machine at a time</span>
    <div class="seg" role="group" aria-label="Theme"><button type="button" data-theme-choice="auto">Auto</button><button type="button" data-theme-choice="light">Light</button><button type="button" data-theme-choice="dark">Dark</button></div>
  </div>
  <header class="head">
    <div>
      <h1>Systems Workbench</h1>
      <p class="intro">Each lesson turns one idea into a small machine you can watch and adjust: a cache becomes a card rack, a circuit breaker a switchboard, a rolling deploy a crane swapping modules. Watch the machine, predict what an experiment will do, run it, then explain it back.</p>
    </div>
    <div class="stats" aria-label="Collection size">
      <div><b>${lessons.length}</b><span>Lessons</span></div>
      <div><b>${lessons.reduce((s, l) => s + l.exps.length, 0)}</b><span>Experiments</span></div>
      <div><b>${lessons.reduce((s, l) => s + l.questions, 0)}</b><span>Questions</span></div>
    </div>
  </header>
  <div class="filters-wrap"><button type="button" class="scroll-btn" data-scroll="-1" aria-label="Scroll filters left" aria-controls="area-filters"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button><div class="filters-view"><div class="filters" id="area-filters" role="group" aria-label="Filter by area">${filters}</div></div><button type="button" class="scroll-btn" data-scroll="1" aria-label="Scroll filters right" aria-controls="area-filters"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></button></div>
  <main class="grid">
${lessons.map(card).join("\n")}
  </main>
  <footer>Machines drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Previews are screenshots of each machine running; the lessons are interactive.</footer>
</div>
<dialog id="preview" aria-labelledby="dlg-title">
  <div class="dlg">
    <div class="dlg-shot"><span class="plate-corner tl" data-d="no"></span><span class="plate-corner tr" data-d="machine"></span><img class="on-light" data-d="light" alt=""><img class="on-dark" data-d="dark" alt=""></div>
    <div class="dlg-text">
      <div class="meta"><span data-d="area"></span><span data-d="concept"></span></div>
      <h2 id="dlg-title" data-d="title"></h2>
      <p data-d="lede"></p>
      <ol data-d="exps"></ol>
      <div class="dlg-actions"><span class="counts" data-d="counts"></span><span class="card-actions"><button type="button" class="btn" data-close>Close</button><a class="btn primary" data-d="url" target="_blank" rel="noopener">Open lesson</a></span></div>
    </div>
  </div>
</dialog>
<script>
(() => {
  const LESSONS = ${JSON.stringify(data).replace(/</g, "\\u003c")};
  const root = document.documentElement;
  const choices = document.querySelectorAll("[data-theme-choice]");
  const read = () => { try { return localStorage.getItem("workbench-theme"); } catch (e) { return null; } };
  const write = (v) => { try { v === "auto" ? localStorage.removeItem("workbench-theme") : localStorage.setItem("workbench-theme", v); } catch (e) {} };
  const apply = (v) => { if (v === "light" || v === "dark") root.setAttribute("data-theme", v); else root.removeAttribute("data-theme"); choices.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === (v === "light" || v === "dark" ? v : "auto")))); };
  apply(read() || (root.getAttribute("data-theme") || "auto"));
  choices.forEach((b) => b.addEventListener("click", () => { apply(b.dataset.themeChoice); write(b.dataset.themeChoice); }));

  const filters = document.querySelectorAll("[data-filter]");
  const cards = document.querySelectorAll(".card");
  const setFilter = (area) => {
    filters.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === area)));
    cards.forEach((c) => { c.hidden = area !== "all" && c.dataset.area !== area; });
  };
  filters.forEach((b) => b.addEventListener("click", () => { setFilter(b.dataset.filter); b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce() ? "auto" : "smooth" }); }));
  const strip = document.querySelector(".filters"), wrap = document.querySelector(".filters-wrap");
  const arrows = wrap.querySelectorAll("[data-scroll]");
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const edges = () => {
    wrap.removeAttribute("data-fits");
    const max = strip.scrollWidth - strip.clientWidth;
    if (max <= 2) { wrap.setAttribute("data-fits", ""); wrap.removeAttribute("data-more-left"); wrap.removeAttribute("data-more-right"); return; }
    const left = strip.scrollLeft > 2, right = strip.scrollLeft < max - 2;
    wrap.toggleAttribute("data-more-left", left);
    wrap.toggleAttribute("data-more-right", right);
    arrows[0].disabled = !left;
    arrows[1].disabled = !right;
  };
  arrows.forEach((b) => b.addEventListener("click", () => {
    strip.scrollBy({ left: Number(b.dataset.scroll) * Math.max(120, strip.clientWidth * 0.75), behavior: reduce() ? "auto" : "smooth" });
  }));
  strip.addEventListener("scroll", edges, { passive: true });
  addEventListener("resize", edges);
  strip.addEventListener("wheel", (e) => {
    if (strip.scrollWidth <= strip.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const max = strip.scrollWidth - strip.clientWidth;
    if ((e.deltaY < 0 && strip.scrollLeft <= 0) || (e.deltaY > 0 && strip.scrollLeft >= max)) return;
    e.preventDefault(); strip.scrollLeft += e.deltaY;
  }, { passive: false });
  edges();

  const dlg = document.getElementById("preview");
  const d = (k) => dlg.querySelector('[data-d="' + k + '"]');
  const two = (n) => String(n).padStart(2, "0");
  const open = (slug) => {
    const l = LESSONS.find((x) => x.slug === slug);
    d("no").textContent = "Lesson " + two(l.n);
    d("machine").textContent = l.machine;
    d("light").src = "previews/" + l.slug + "-light.webp"; d("light").alt = l.machine + ", the machine in " + l.title;
    d("dark").src = "previews/" + l.slug + "-dark.webp";
    d("area").textContent = l.area; d("concept").textContent = l.concept;
    d("title").textContent = l.title; d("lede").textContent = l.lede;
    d("exps").replaceChildren(...l.exps.map((e, i) => { const li = document.createElement("li"); const n = document.createElement("span"); n.textContent = two(i + 1); const t = document.createElement("div"); const b = document.createElement("b"); b.textContent = e.title; const em = document.createElement("em"); em.textContent = e.question; t.append(b, em); li.append(n, t); return li; }));
    d("counts").textContent = l.exps.length + " experiments · " + l.questions + " questions";
    d("url").href = l.url;
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  };
  document.querySelectorAll("[data-preview]").forEach((b) => b.addEventListener("click", () => open(b.dataset.preview)));
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
})();
</script>
`;
writeFileSync(new URL("./index.html", import.meta.url), html);
console.log("wrote index.html", (html.length / 1024).toFixed(0) + " KB");
