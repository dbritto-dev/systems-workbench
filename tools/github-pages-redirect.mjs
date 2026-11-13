// Builds the redirect site the old GitHub Pages address serves now that the site lives on Cloudflare
// (.github/workflows/old-address.yml). For every page in the built site (dist/, served at the root of SITE_URL) it writes
// a page at the same path that sends the visitor to the new address, keeping the query and the #section: GitHub Pages
// serves it under /systems-workbench/, so https://dbritto-dev.github.io/systems-workbench/es/lessons/cache/ goes to
// <SITE_URL>/es/lessons/cache/. Each page also names the new address as canonical, so search engines move the
// lessons over. A 404 page catches any other old path and maps it the same way.
//
// Usage: SITE_URL=https://… node tools/github-pages-redirect.mjs [dist] [out]
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const [dist = "dist", out = "github-pages"] = process.argv.slice(2);
const site = (process.env.SITE_URL || "https://systems-workbench.dbritto-dev.workers.dev").replace(/\/+$/, "");
const OLD_BASE = "/systems-workbench";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const page = (to, script) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Systems Workbench has moved</title>
<link rel="canonical" href="${esc(to)}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
<script>${script}</script>
</head>
<body>
<p>Systems Workbench has moved to <a href="${esc(to)}">${esc(to)}</a>.</p>
<p lang="es">Systems Workbench se mudó a <a href="${esc(to)}">${esc(to)}</a>.</p>
</body>
</html>
`;

const pages = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".html")) pages.push(relative(dist, p).split(sep).join("/"));
  }
};
walk(dist);

for (const file of pages) {
  // Astro writes the forwarding page for an old .html URL as a folder of that name: point it at the .html address,
  // which Cloudflare redirects (dist/_redirects).
  const path = file === "index.html" ? "/" : "/" + file.replace(/(^|\/)index\.html$/, "$1").replace(/\.html\/$/, ".html");
  const to = site + path;
  const target = join(out, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, page(to, `location.replace(${JSON.stringify(to)} + location.search + location.hash);`));
}

// Any other old path (an asset, a page that no longer exists): strip the old prefix and go to the same path there.
writeFileSync(
  join(out, "404.html"),
  page(site + "/", `var p = location.pathname.slice(${JSON.stringify(OLD_BASE)}.length) || "/";
location.replace(${JSON.stringify(site)} + p + location.search + location.hash);`),
);
console.log(`${pages.length} redirect pages → ${site}`);
