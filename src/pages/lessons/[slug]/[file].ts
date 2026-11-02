// Old lesson URLs (lessons/cache/cache-workbench.html, from before the Astro site) keep working: each becomes a small
// page that forwards to /lessons/cache/, or to /es/lessons/cache/ for ?lang=es or a reader who had chosen Spanish.
import type { APIRoute, GetStaticPaths } from "astro";
import { allLessons } from "../../../lib/lessons";
import { href } from "../../../i18n";

export const getStaticPaths = (async () =>
  (await allLessons()).map((l) => ({ params: { slug: l.slug, file: l.page.legacyFile } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const en = href("en", `lessons/${params.slug}/`), es = href("es", `lessons/${params.slug}/`);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved</title>
<meta name="robots" content="noindex"><link rel="canonical" href="${en}"><meta http-equiv="refresh" content="0; url=${en}">
<script>(function(){var p=new URLSearchParams(location.search),l=p.get("lang");if(l!=="es"&&l!=="en"){try{l=localStorage.getItem("workbench-lang")}catch(e){}}
p.delete("lang");var q=p.toString();location.replace((l==="es"?${JSON.stringify(es)}:${JSON.stringify(en)})+(q?"?"+q:"")+location.hash);})();</script>
</head><body><p>This lesson moved to <a href="${en}">${en}</a>.</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
};
