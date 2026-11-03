// @ts-nocheck: content in the style of the other lessons
// Systems lesson 56 · Critical rendering path: a page-load bench with a download rack, the HTML as a strip of tags, a
// walking parser and a phone whose shutter lifts at the first paint.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, P, GEOMETRY, FIGURE_CSS } from "./figure";
import { measure, SEEDS, SIZES, NET, CPU, FONT } from "./sim";

// Experiment results, computed at build time from the same model the page runs (8 seeded loads each).
const S3 = { js: "defer", sizeImg: true, sizeAd: true };
const S5 = { js: "defer", font: "swap", preloadFont: true };
const R = {
  block: { head: measure({}), defer: measure({ js: "defer" }), async: measure({ js: "async" }) },
  async: { head: measure({ warm: true }), async: measure({ warm: true, js: "async" }), defer: measure({ warm: true, js: "defer" }) },
  font: { block: measure(S3), swap: measure({ ...S3, font: "swap" }), pre: measure({ ...S3, font: "swap", preloadFont: true }), optional: measure({ ...S3, font: "optional" }) },
  lazy: { eager: measure({}), below: measure({ lazyBelow: true }), all: measure({ lazyBelow: true, lazyHero: true }), pre: measure({ preloadHero: true }) },
  inline: { link: measure(S5), inline: measure({ ...S5, css: "inline" }), reserve: measure({ ...S5, css: "inline", sizeImg: true, sizeAd: true }), match: measure({ ...S5, css: "inline", sizeImg: true, sizeAd: true, matchFont: true }) },
};

const s2 = (ms) => (ms / 1000).toFixed(2) + " s";
const gap = (a, b) => s2(Math.abs(b - a));
const cls = (x) => (x < 0.0005 ? "0" : x < 0.1 ? x.toFixed(3) : x.toFixed(2));
const top = (...xs) => Math.max(...xs) * 1.06;
const KBPS = Math.round(NET.kbPerMs * 1000 * 8 / 100) / 10;   // Mbit/s

const RUNS = {
  block: () => {
    const { head: H, defer: D, async: A } = R.block, m = top(H.lcp, D.lcp);
    return {
      verdict: t("First paint: " + s2(H.fp) + " with the classic script, " + s2(D.fp) + " with defer. The parser waited " + s2(H.blocked) + " at the script tag; with defer, not at all. LCP: " + s2(H.lcp) + " → " + s2(D.lcp) + ". app.js itself ran at " + s2(H.app) + " as a classic script and at " + s2(D.app) + " deferred.",
        "Primer pintado: " + s2(H.fp) + " con el script clásico, " + s2(D.fp) + " con defer. El parser esperó " + s2(H.blocked) + " en la etiqueta del script; con defer, nada. LCP: " + s2(H.lcp) + " → " + s2(D.lcp) + ". app.js corrió a los " + s2(H.app) + " como script clásico y a los " + s2(D.app) + " diferido."),
      bars: [
        [t("First paint, classic", "Primer pintado, clásico"), H.fp / m, s2(H.fp)],
        [t("First paint, defer", "Primer pintado, defer"), D.fp / m, s2(D.fp), true],
        [t("LCP, classic", "LCP, clásico"), H.lcp / m, s2(H.lcp)],
        [t("LCP, defer", "LCP, defer"), D.lcp / m, s2(D.lcp), true],
      ],
    };
  },
  async: () => {
    const { head: H, async: A, defer: D } = R.async, m = top(H.fp, A.fp, D.fp);
    return {
      verdict: t("On the repeat visit, first paint came at " + s2(A.fp) + " with async and " + s2(D.fp) + " with defer (" + s2(H.fp) + " with a classic script). The async app.js ran at " + s2(A.app) + ", before the body was parsed; the deferred one at " + s2(D.app) + ", after the first paint.",
        "En la visita repetida, el primer pintado llegó a los " + s2(A.fp) + " con async y a los " + s2(D.fp) + " con defer (" + s2(H.fp) + " con un script clásico). El app.js async corrió a los " + s2(A.app) + ", antes de que se analizara el body; el diferido a los " + s2(D.app) + ", después del primer pintado."),
      bars: [
        [t("First paint, classic", "Primer pintado, clásico"), H.fp / m, s2(H.fp)],
        [t("First paint, async", "Primer pintado, async"), A.fp / m, s2(A.fp), true],
        [t("First paint, defer", "Primer pintado, defer"), D.fp / m, s2(D.fp)],
      ],
    };
  },
  font: () => {
    const { block: B, swap: W, pre: Pr, optional: O } = R.font, m = top(B.text, W.text, Pr.text, O.text);
    return {
      verdict: t("With block the page painted at " + s2(B.fp) + " and the text appeared at " + s2(B.text) + ": " + gap(B.fp, B.text) + " of invisible text. swap: text at the first paint, CLS " + cls(W.cls) + " when the font swapped in. swap with the font preloaded: text and first paint together at " + s2(Pr.text) + ", CLS " + cls(Pr.cls) + ". optional: text at " + s2(O.text) + ", in the fallback font for the whole visit.",
        "Con block la página se pintó a los " + s2(B.fp) + " y el texto apareció a los " + s2(B.text) + ": " + gap(B.fp, B.text) + " de texto invisible. swap: texto en el primer pintado, CLS " + cls(W.cls) + " cuando entró la fuente. swap con la fuente precargada: texto y primer pintado juntos a los " + s2(Pr.text) + ", CLS " + cls(Pr.cls) + ". optional: texto a los " + s2(O.text) + ", con la fuente de respaldo toda la visita."),
      groups: [
        { title: t("Text visible", "Texto visible"), bars: [
          [t("block", "block"), B.text / m, s2(B.text), true],
          [t("swap", "swap"), W.text / m, s2(W.text)],
          [t("swap + preload", "swap + preload"), Pr.text / m, s2(Pr.text)],
          [t("optional", "optional"), O.text / m, s2(O.text)],
        ] },
        { title: t("First paint", "Primer pintado"), bars: [
          [t("block", "block"), B.fp / m, s2(B.fp)],
          [t("swap + preload", "swap + preload"), Pr.fp / m, s2(Pr.fp)],
        ] },
      ],
    };
  },
  lazy: () => {
    const { eager: E, below: B, all: A, pre: Pr } = R.lazy, m = top(E.lcp, B.lcp, A.lcp, Pr.lcp);
    return {
      verdict: t("LCP: " + s2(E.lcp) + " with every image eager, " + s2(B.lcp) + " with the three far-below images lazy, " + s2(A.lcp) + " with the hero lazy too. Preloading the hero with fetchpriority=high instead: LCP " + s2(Pr.lcp) + ", but the first paint moved from " + s2(E.fp) + " to " + s2(Pr.fp) + ".",
        "LCP: " + s2(E.lcp) + " con todas las imágenes normales, " + s2(B.lcp) + " con las tres de más abajo en lazy, " + s2(A.lcp) + " con la hero en lazy también. Precargando la hero con fetchpriority=high en su lugar: LCP " + s2(Pr.lcp) + ", pero el primer pintado pasó de " + s2(E.fp) + " a " + s2(Pr.fp) + "."),
      bars: [
        [t("LCP, all eager", "LCP, todas normales"), E.lcp / m, s2(E.lcp)],
        [t("LCP, lazy below the fold", "LCP, lazy bajo el pliegue"), B.lcp / m, s2(B.lcp)],
        [t("LCP, hero lazy too", "LCP, hero en lazy también"), A.lcp / m, s2(A.lcp), true],
        [t("LCP, hero preloaded", "LCP, hero precargada"), Pr.lcp / m, s2(Pr.lcp)],
        [t("First paint, hero preloaded", "Primer pintado, hero precargada"), Pr.fp / m, s2(Pr.fp)],
      ],
    };
  },
  inline: () => {
    const { link: Ln, inline: I, reserve: Rs, match: Mt } = R.inline, m = top(Ln.cls, I.cls, Rs.cls, Mt.cls, 0.01);
    return {
      verdict: t("First paint: " + s2(Ln.fp) + " with the stylesheet linked, " + s2(I.fp) + " with the critical CSS inlined. CLS: " + cls(Ln.cls) + " → " + cls(I.cls) + ". With width and height on the images and the ad slot reserved: " + cls(Rs.cls) + ". With the fallback font's metrics matched as well: " + cls(Mt.cls) + ".",
        "Primer pintado: " + s2(Ln.fp) + " con la hoja de estilos enlazada, " + s2(I.fp) + " con el CSS crítico en línea. CLS: " + cls(Ln.cls) + " → " + cls(I.cls) + ". Con width y height en las imágenes y el espacio del anuncio reservado: " + cls(Rs.cls) + ". Con las métricas de la fuente de respaldo ajustadas también: " + cls(Mt.cls) + "."),
      bars: [
        [t("CLS, stylesheet linked", "CLS, hoja enlazada"), Ln.cls / m, cls(Ln.cls)],
        [t("CLS, critical CSS inlined", "CLS, CSS crítico en línea"), I.cls / m, cls(I.cls), true],
        [t("CLS, + space reserved", "CLS, + espacio reservado"), Rs.cls / m, cls(Rs.cls)],
        [t("CLS, + font metrics", "CLS, + métricas de la fuente"), Mt.cls / m, cls(Mt.cls)],
      ],
    };
  },
};

const { block: B1, async: B2, font: B3, lazy: B4, inline: B5 } = R;

const EXPERIMENTS = [
  {
    id: "block",
    title: t("Defer the script", "Diferir el script"),
    change: t("The stylesheet stays linked in the head · app.js (" + SIZES.app + " KB, " + CPU.app + " ms to run) as a classic <script src> in the head vs <script defer>",
      "La hoja de estilos sigue enlazada en el head · app.js (" + SIZES.app + " KB, " + CPU.app + " ms de ejecución) como <script src> clásico en el head vs <script defer>"),
    question: t("With defer, when does the first paint come?", "Con defer, ¿cuándo llega el primer pintado?"),
    options: [
      t("About the same: the stylesheet in the head blocks rendering anyway", "Más o menos igual: la hoja de estilos del head bloquea el renderizado de todos modos"),
      t("As soon as the stylesheet is in: the parser no longer stops to download and run app.js", "En cuanto llega la hoja de estilos: el parser ya no se detiene a descargar y correr app.js"),
      t("Later: deferred scripts must run before the first paint", "Más tarde: los scripts diferidos tienen que correr antes del primer pintado"),
    ],
    answer: 1,
    why: t(
      "A classic script stops the parser where it stands: the browser must download it and run it before it reads another tag, because the script could change the document; it even waits for the stylesheets above it first, in case the script reads styles. Until the parser gets past it, the body doesn't exist, so there is nothing to paint even once the stylesheet is in. Here that held the parser for " + s2(B1.head.blocked) + " and the first paint until " + s2(B1.head.fp) + ". With defer the script downloads alongside and runs after parsing, so the first paint comes as soon as the stylesheet allows: " + s2(B1.defer.fp) + ", and LCP drops from " + s2(B1.head.lcp) + " to " + s2(B1.defer.lcp) + ". The stylesheet still blocks rendering; it is now the only thing that does. Watch app.js itself, though: as a low-priority download it waited for the hero and shared the link with the other images, so it ran at " + s2(B1.defer.app) + ". If the page needs it early, that's a new cost.",
      "Un script clásico detiene al parser donde está: el navegador tiene que descargarlo y correrlo antes de leer otra etiqueta, porque el script podría cambiar el documento; incluso espera antes a las hojas de estilos que tiene arriba, por si el script lee estilos. Hasta que el parser lo pasa, el body no existe, así que no hay nada que pintar aunque ya haya llegado la hoja de estilos. Aquí eso retuvo al parser " + s2(B1.head.blocked) + " y al primer pintado hasta los " + s2(B1.head.fp) + ". Con defer el script se descarga en paralelo y corre después del análisis, así que el primer pintado llega en cuanto la hoja de estilos lo permite: " + s2(B1.defer.fp) + ", y el LCP baja de " + s2(B1.head.lcp) + " a " + s2(B1.defer.lcp) + ". La hoja de estilos sigue bloqueando el renderizado; ahora es lo único que lo hace. Pero fíjate en app.js: como descarga de baja prioridad esperó a la hero y compartió el enlace con las otras imágenes, así que corrió a los " + s2(B1.defer.app) + ". Si la página lo necesita pronto, ese es un costo nuevo.",
    ),
    watch: { css: "link", js: "head", font: "block", preload: "", lazy: "", reserve: "", warm: false, speed: 1 },
  },
  {
    id: "async",
    title: t("async or defer on a repeat visit", "async o defer en una visita repetida"),
    change: t("A repeat visit: everything but the HTML comes from the HTTP cache · app.js as <script async> vs <script defer>",
      "Una visita repetida: todo menos el HTML sale de la caché HTTP · app.js como <script async> vs <script defer>"),
    question: t("Which one delays the first paint?", "¿Cuál de los dos atrasa el primer pintado?"),
    options: [
      t("Neither: both download without blocking the parser", "Ninguno: los dos se descargan sin bloquear al parser"),
      t("async: the cached script is ready at once, so it runs in the middle of parsing, before anything can paint", "async: el script en caché está listo enseguida, así que corre en medio del análisis, antes de que se pueda pintar nada"),
      t("defer: deferred scripts run before the first paint", "defer: los scripts diferidos corren antes del primer pintado"),
    ],
    answer: 1,
    why: t(
      "async and defer both fetch the script without stopping the parser; they differ in when it runs. An async script runs as soon as it has arrived, wherever the parser is, and the main thread can't parse or paint while it runs; async scripts also run in whatever order they arrive. A deferred script waits until the whole document is parsed, then runs in document order, before DOMContentLoaded. On a first visit app.js arrived late, so both ran after the first paint. From the cache it is there at once: the async copy ran at " + s2(B2.async.app) + ", before the body was parsed, and the first paint waited for its " + CPU.app + " ms (" + s2(B2.async.fp) + "). The deferred copy waited for the parser and ran at " + s2(B2.defer.app) + ", after the page had painted at " + s2(B2.defer.fp) + ".",
      "async y defer descargan el script sin detener al parser; la diferencia es cuándo corre. Un script async corre en cuanto llega, esté donde esté el parser, y el hilo principal no puede analizar ni pintar mientras corre; además los scripts async corren en el orden en que llegan. Un script diferido espera a que se analice todo el documento y luego corre en el orden del documento, antes de DOMContentLoaded. En una primera visita app.js llegó tarde, así que los dos corrieron después del primer pintado. Desde la caché está disponible enseguida: la copia async corrió a los " + s2(B2.async.app) + ", antes de que se analizara el body, y el primer pintado esperó sus " + CPU.app + " ms (" + s2(B2.async.fp) + "). La copia diferida esperó al parser y corrió a los " + s2(B2.defer.app) + ", después de que la página se pintara a los " + s2(B2.defer.fp) + ".",
    ),
    watch: { css: "link", js: "async", font: "block", preload: "", lazy: "", reserve: "", warm: true, speed: 0.5 },
  },
  {
    id: "font",
    title: t("Invisible text", "Texto invisible"),
    change: t("font-display: block, as most browsers do by default · the font (" + SIZES.font + " KB) is requested when the first layout needs it · app.js deferred, image sizes and the ad slot reserved",
      "font-display: block, como hace la mayoría de los navegadores por defecto · la fuente (" + SIZES.font + " KB) se pide cuando el primer layout la necesita · app.js diferido, tamaños de imagen y espacio del anuncio reservados"),
    question: t("How long after the first paint does the text stay invisible?", "¿Cuánto tiempo después del primer pintado sigue invisible el texto?"),
    options: [
      t("Not at all: the browser holds the first paint until the font has arrived", "Nada: el navegador retiene el primer pintado hasta que llega la fuente"),
      t("Until the font arrives: nobody asks for it before the first layout, so the text stays blank for a round trip plus the download", "Hasta que llega la fuente: nadie la pide antes del primer layout, así que el texto queda en blanco un viaje de ida y vuelta más la descarga"),
      t("The full 3 s block period, whatever the font does", "Los 3 s completos del periodo de bloqueo, haga lo que haga la fuente"),
    ],
    answer: 1,
    why: t(
      "A font is a resource the HTML doesn't mention: it sits in an @font-face rule, and the browser fetches it only when a layout finds text that uses it. That is the first layout, which also paints the page, so the page appears with blank lines where the text goes (FOIT, a flash of invisible text), and the text shows up when the font lands, " + gap(B3.block.fp, B3.block.text) + " later. block would wait up to 3 s before falling back; it never got that far. swap paints the fallback font right away and swaps the web font in when it arrives (FOUT): text at " + s2(B3.swap.text) + ", but the lines reflow and move what is below them (CLS " + cls(B3.swap.cls) + " here; it depends on how much text is on screen and how different the two fonts are). Preloading the font starts it with the stylesheet, so it lands before the first paint: no blank text and no swap, at the price of a first paint " + gap(B3.block.fp, B3.pre.fp) + " later, because the two share the connection. optional gives the font about 100 ms and otherwise keeps the fallback for the whole visit: text at " + s2(B3.optional.text) + ", never a swap.",
      "Una fuente es un recurso que el HTML no menciona: está en una regla @font-face, y el navegador la pide recién cuando un layout encuentra texto que la usa. Ese es el primer layout, que también pinta la página, así que la página aparece con líneas en blanco donde va el texto (FOIT, un destello de texto invisible), y el texto aparece cuando llega la fuente, " + gap(B3.block.fp, B3.block.text) + " después. block esperaría hasta 3 s antes de usar la fuente de respaldo; nunca llegó a tanto. swap pinta enseguida con la fuente de respaldo y cambia a la fuente web cuando llega (FOUT): texto a los " + s2(B3.swap.text) + ", pero las líneas se reacomodan y mueven lo que tienen debajo (CLS " + cls(B3.swap.cls) + " aquí; depende de cuánto texto haya en pantalla y de qué tan distintas sean las dos fuentes). Precargar la fuente la empieza junto con la hoja de estilos, así que llega antes del primer pintado: sin texto en blanco y sin cambio, al precio de un primer pintado " + gap(B3.block.fp, B3.pre.fp) + " más tarde, porque las dos comparten la conexión. optional le da a la fuente unos 100 ms y si no, deja la de respaldo toda la visita: texto a los " + s2(B3.optional.text) + ", sin cambio nunca.",
    ),
    watch: { css: "link", js: "defer", font: "block", preload: "", lazy: "", reserve: "img ad", warm: false, speed: 1 },
  },
  {
    id: "lazy",
    title: t("Lazy-load the hero too", "Lazy también en la hero"),
    change: t("The page as it starts (stylesheet and classic script in the head) · loading=\"lazy\" on the three images far below the first screen, then on the hero as well · then, instead, the hero preloaded with fetchpriority=high",
      "La página como empieza (hoja de estilos y script clásico en el head) · loading=\"lazy\" en las tres imágenes de más abajo, y luego también en la hero · luego, en su lugar, la hero precargada con fetchpriority=high"),
    question: t("With loading=\"lazy\" on the hero as well, what happens to LCP?", "Con loading=\"lazy\" también en la hero, ¿qué pasa con el LCP?"),
    options: [
      t("It improves: less competes for the connection at the start", "Mejora: al principio compite menos por la conexión"),
      t("No change: an image in the viewport loads right away, lazy or not", "No cambia: una imagen en el viewport se carga enseguida, lazy o no"),
      t("It gets later: a lazy image isn't requested until a layout shows it's near the viewport", "Empeora: una imagen lazy no se pide hasta que un layout muestra que está cerca del viewport"),
    ],
    answer: 2,
    why: t(
      "A lazy image is invisible to the preload scanner: the browser requests it only once a layout shows it near the viewport, and layout waits for the stylesheet and, here, for the classic script. Lazy-loading the three images far below helps a little (LCP " + s2(B4.below.lcp) + " instead of " + s2(B4.eager.lcp) + "): they never start, so " + Math.round(B4.eager.kb - B4.below.kb) + " KB stop competing with the hero. Making the hero lazy as well throws away its head start: it is requested at the first layout and pays a round trip before its first byte, so LCP gets later, " + s2(B4.all.lcp) + ". Never lazy-load the LCP image. The opposite move, preloading it with fetchpriority=high, gets it in by the first paint, but it now shares the connection with app.js, which the parser is waiting for: LCP " + s2(B4.pre.lcp) + ", first paint " + s2(B4.eager.fp) + " → " + s2(B4.pre.fp) + ". Raising one download's priority lowers everything else's.",
      "Una imagen lazy es invisible para el escáner de precarga (preload scanner): el navegador la pide recién cuando un layout muestra que está cerca del viewport, y el layout espera a la hoja de estilos y, aquí, al script clásico. Poner lazy en las tres imágenes de más abajo ayuda un poco (LCP " + s2(B4.below.lcp) + " en lugar de " + s2(B4.eager.lcp) + "): nunca empiezan, así que " + Math.round(B4.eager.kb - B4.below.kb) + " KB dejan de competir con la hero. Poner lazy también en la hero tira su ventaja: se pide en el primer layout y paga un viaje de ida y vuelta antes de su primer byte, así que el LCP empeora, " + s2(B4.all.lcp) + ". Nunca pongas lazy en la imagen del LCP. Lo contrario, precargarla con fetchpriority=high, la tiene lista para el primer pintado, pero ahora comparte la conexión con app.js, que el parser está esperando: LCP " + s2(B4.pre.lcp) + ", primer pintado " + s2(B4.eager.fp) + " → " + s2(B4.pre.fp) + ". Subirle la prioridad a una descarga se la baja a todas las demás.",
    ),
    watch: { css: "link", js: "head", font: "block", preload: "", lazy: "hero below", reserve: "", warm: false, speed: 1 },
  },
  {
    id: "inline",
    title: t("Inline the critical CSS", "CSS crítico en línea"),
    change: t("app.js deferred, the font preloaded with font-display: swap, images without width and height, no space kept for the ad · the stylesheet linked in the head vs its critical rules (" + SIZES.critical + " KB) inlined in a <style> and the rest loaded without blocking",
      "app.js diferido, la fuente precargada con font-display: swap, imágenes sin width ni height, sin espacio guardado para el anuncio · la hoja de estilos enlazada en el head vs sus reglas críticas (" + SIZES.critical + " KB) en línea en un <style> y el resto cargado sin bloquear"),
    question: t("Inlining the critical CSS makes the first paint earlier. What happens to CLS?", "Poner el CSS crítico en línea adelanta el primer pintado. ¿Qué pasa con el CLS?"),
    options: [
      t("It goes down: the page settles sooner", "Baja: la página se asienta antes"),
      t("No change: how CSS is delivered has nothing to do with layout shifts", "No cambia: cómo se entrega el CSS no tiene nada que ver con los desplazamientos de layout"),
      t("It goes up: the page now paints before the font arrives, so the swap moves text that is already on screen", "Sube: ahora la página se pinta antes de que llegue la fuente, así que el cambio mueve texto que ya está en pantalla"),
    ],
    answer: 2,
    why: t(
      "Only changes after the first paint count as layout shifts: whatever settles before it, nobody sees. With the stylesheet linked, the preloaded font arrived while the stylesheet was still downloading, so the first paint (" + s2(B5.link.fp) + ") already used it; CLS " + cls(B5.link.cls) + " came from the hero, which had no width and height and pushed the text down when it loaded. Inlined, the page paints at " + s2(B5.inline.fp) + ", before the font, so the swap reflows text that is already on screen, less than a second before the hero's shift; shifts that close together count as one burst, and CLS rises to " + cls(B5.inline.cls) + ". Painting earlier is still right: fix the shifts, not the paint. width and height on the images (or aspect-ratio) and a reserved ad slot keep their boxes from the first layout: " + cls(B5.reserve.cls) + ". A fallback font with matched metrics (size-adjust, ascent-override and descent-override in its @font-face) takes the same space as the web font: " + cls(B5.match.cls) + ".",
      "Solo cuentan como desplazamientos de layout los cambios después del primer pintado: lo que se acomoda antes, nadie lo ve. Con la hoja de estilos enlazada, la fuente precargada llegó mientras la hoja todavía se descargaba, así que el primer pintado (" + s2(B5.link.fp) + ") ya la usó; el CLS de " + cls(B5.link.cls) + " vino de la hero, que no tenía width ni height y empujó el texto hacia abajo al cargar. En línea, la página se pinta a los " + s2(B5.inline.fp) + ", antes que la fuente, así que el cambio de fuente reacomoda texto que ya está en pantalla, menos de un segundo antes del salto de la hero; saltos tan seguidos cuentan como una sola ráfaga, y el CLS sube a " + cls(B5.inline.cls) + ". Pintar antes sigue siendo lo correcto: arregla los saltos, no el pintado. width y height en las imágenes (o aspect-ratio) y un espacio reservado para el anuncio guardan sus cajas desde el primer layout: " + cls(B5.reserve.cls) + ". Una fuente de respaldo con métricas ajustadas (size-adjust, ascent-override y descent-override en su @font-face) ocupa lo mismo que la fuente web: " + cls(B5.match.cls) + ".",
    ),
    watch: { css: "inline", js: "defer", font: "swap", preload: "font", lazy: "", reserve: "", warm: false, speed: 1 },
  },
];

const QUESTIONS = [
  [t("A stylesheet in the head blocks rendering; a classic script in the head blocks parsing. What's the difference, and why does each one block?",
     "Una hoja de estilos en el head bloquea el renderizado; un script clásico en el head bloquea el análisis. ¿Cuál es la diferencia y por qué bloquea cada uno?"),
   t("The browser won't paint until the stylesheets in the head are loaded, so it never shows unstyled content; parsing goes on meanwhile. A classic script stops the parser itself: it might write to the document or read it, so the browser downloads and runs it before reading another tag, and it first waits for the stylesheets above it in case the script reads styles. The preload scanner keeps fetching what the rest of the HTML references, but nothing below the script exists yet, so nothing can paint. The fixes differ too: for CSS, a smaller stylesheet, the critical rules inlined, or a media attribute on stylesheets the page doesn't need now (a non-matching media query doesn't block rendering); for scripts, defer, async or type=\"module\".",
     "El navegador no pinta hasta que cargan las hojas de estilos del head, así nunca muestra contenido sin estilo; mientras tanto el análisis sigue. Un script clásico detiene al parser mismo: podría escribir en el documento o leerlo, así que el navegador lo descarga y lo corre antes de leer otra etiqueta, y primero espera a las hojas de estilos que tiene arriba por si el script lee estilos. El escáner de precarga (preload scanner) sigue pidiendo lo que referencia el resto del HTML, pero nada debajo del script existe todavía, así que nada se puede pintar. Los arreglos también son distintos: para el CSS, una hoja más chica, las reglas críticas en línea, o un atributo media en las hojas que la página no necesita ahora (una media query que no coincide no bloquea el renderizado); para los scripts, defer, async o type=\"module\".")],
  [t("Be exact: when does an async script run, when does a deferred one, and what about type=\"module\"?",
     "Sé exacto: ¿cuándo corre un script async, cuándo uno diferido y qué pasa con type=\"module\"?"),
   t("Both download without blocking the parser. async runs the moment it has arrived, even in the middle of parsing, in whatever order the async scripts arrive, and DOMContentLoaded doesn't wait for it. defer runs after the document is fully parsed, in document order, and DOMContentLoaded waits until every deferred script has run. Use defer for the app's own code that needs the DOM or depends on other scripts; async for independent scripts like analytics. A module script is deferred by default (add async to make it async), and inline classic scripts ignore both attributes. Neither attribute makes a script cheap: whenever it runs, it holds the main thread, and if that's before the first paint or during an interaction, users wait (the event loop lesson, 16, shows why).",
     "Los dos se descargan sin bloquear al parser. async corre en cuanto llega, incluso en medio del análisis, en el orden en que lleguen los scripts async, y DOMContentLoaded no lo espera. defer corre cuando el documento terminó de analizarse, en el orden del documento, y DOMContentLoaded espera a que haya corrido cada script diferido. Usa defer para el código propio de la app que necesita el DOM o depende de otros scripts; async para scripts independientes como la analítica. Un script de módulo se difiere por defecto (agrégale async para que sea async), y los scripts clásicos en línea ignoran los dos atributos. Ningún atributo vuelve barato a un script: corra cuando corra, ocupa el hilo principal, y si eso pasa antes del primer pintado o durante una interacción, los usuarios esperan (la lección del bucle de eventos, la 16, muestra por qué).")],
  [t("What does the preload scanner find on its own, what does it miss, and when is <link rel=\"preload\"> worth it?",
     "¿Qué encuentra solo el escáner de precarga, qué se le escapa y cuándo vale la pena <link rel=\"preload\">?"),
   t("It reads ahead in the HTML, even while the parser is stuck on a script, and starts the stylesheets, scripts and images it finds in the markup. It misses whatever the markup doesn't name: fonts and background images referenced from CSS, anything a script inserts, and lazy images. Preload those when they're needed for the first screen: the LCP image if it's a CSS background or inserted by JavaScript, or the main web font. A font preload needs as=\"font\", the type and the crossorigin attribute, because fonts are fetched in CORS mode; without it the browser can't use the preloaded copy and fetches the font again. Preload sparingly: every preload competes for the same connection, so preloading things the first screen doesn't need slows the things it does.",
     "Lee el HTML por adelantado, incluso mientras el parser está detenido en un script, y empieza las hojas de estilos, los scripts y las imágenes que encuentra en el marcado. Se le escapa lo que el marcado no nombra: las fuentes y las imágenes de fondo referenciadas desde el CSS, todo lo que inserta un script y las imágenes lazy. Precarga esas cuando hacen falta para la primera pantalla: la imagen del LCP si es un fondo de CSS o la inserta JavaScript, o la fuente web principal. La precarga de una fuente necesita as=\"font\", el type y el atributo crossorigin, porque las fuentes se piden en modo CORS; sin él el navegador no puede usar la copia precargada y vuelve a pedir la fuente. Precarga con moderación: cada precarga compite por la misma conexión, así que precargar lo que la primera pantalla no necesita retrasa lo que sí necesita.")],
  [t("Your LCP is 3.8 s on mobile and the LCP element is a hero image. Walk the path: what can hold it up, and what would you check first?",
     "Tu LCP es de 3.8 s en móvil y el elemento del LCP es una imagen hero. Recorre el camino: ¿qué puede retrasarla y qué revisarías primero?"),
   t("LCP is good at 2.5 s or less, measured at the 75th percentile of page loads. The image can't show before the HTML's first byte (server time), before the first paint (render-blocking CSS and classic scripts in the head), or before the browser knows it exists: an <img> in the markup is found early, a CSS background, a script-inserted image or a lazy one is not. Then it needs bandwidth (fetchpriority=\"high\" if other downloads crowd it; a right-sized, well-compressed file with srcset and sizes) and a frame to be painted in (a long script running when it arrives delays that too). In a waterfall, compare when the image request starts with when the HTML arrived: a late start is discovery or lazy loading, a long download is size or priority, and a gap after the download is render delay.",
     "El LCP es bueno con 2.5 s o menos, medido en el percentil 75 de las cargas de página. La imagen no puede aparecer antes del primer byte del HTML (tiempo de servidor), antes del primer pintado (CSS que bloquea el renderizado y scripts clásicos en el head) ni antes de que el navegador sepa que existe: un <img> en el marcado se descubre pronto, un fondo de CSS, una imagen insertada por un script o una lazy, no. Después necesita ancho de banda (fetchpriority=\"high\" si otras descargas la ahogan; un archivo del tamaño justo y bien comprimido, con srcset y sizes) y un cuadro en el que pintarse (un script largo corriendo cuando llega también lo retrasa). En una cascada de red, compara cuándo empieza la petición de la imagen con cuándo llegó el HTML: un inicio tardío es descubrimiento o carga diferida, una descarga larga es tamaño o prioridad, y un hueco después de la descarga es demora de renderizado.")],
  [t("block, swap or optional: how do you choose a font-display value, and how do you stop the font from moving the page?",
     "block, swap u optional: ¿cómo eliges un valor de font-display y cómo evitas que la fuente mueva la página?"),
   t("block hides text until the font arrives (FOIT), up to about 3 s, and auto behaves much like it in most browsers: fine for icon fonts, bad for body text. swap shows the fallback at once and swaps when the font arrives (FOUT): text is readable early, but the swap reflows it. optional gives the font a very short window and otherwise keeps the fallback for that page view; the font is still downloaded, so the next page view can use it from the cache: no shift, at the cost of sometimes not seeing the brand font. Whichever you pick, preload the one or two fonts the first screen needs, self-host them, and give the fallback matched metrics with size-adjust, ascent-override, descent-override and line-gap-override, so a swap moves nothing.",
     "block oculta el texto hasta que llega la fuente (FOIT), hasta unos 3 s, y auto se comporta parecido en la mayoría de los navegadores: sirve para fuentes de íconos, es malo para el texto. swap muestra la de respaldo enseguida y cambia cuando llega la fuente (FOUT): el texto se puede leer pronto, pero el cambio lo reacomoda. optional le da a la fuente un margen muy corto y si no, deja la de respaldo durante esa vista de página; la fuente igual se descarga, así que la siguiente vista puede usarla desde la caché: sin saltos, a costa de que a veces no se vea la fuente de la marca. Elijas la que elijas, precarga la fuente o las dos que necesita la primera pantalla, alójalas en tu propio dominio y dale a la de respaldo métricas ajustadas con size-adjust, ascent-override, descent-override y line-gap-override, para que el cambio no mueva nada.")],
  [t("How is CLS counted, and where do layout shifts come from during a page load?",
     "¿Cómo se cuenta el CLS y de dónde salen los desplazamientos de layout durante la carga de una página?"),
   t("Each shift scores the share of the viewport the moving elements cover (before and after) times how far they moved, relative to the viewport's larger side. Shifts less than 1 s apart, within 5 s, form a burst, and CLS is the largest burst; good is 0.1 or less. Shifts within 500 ms of a click, tap or key press don't count, because the user expects the page to change. An element that appears doesn't shift; what it pushes does. In a load, the usual culprits are images, videos and iframes without dimensions (give them width and height or aspect-ratio), ads and embeds that arrive late (reserve their slot with min-height), content inserted above what's already shown (banners: overlay them, or insert below), and web fonts swapping in (matched fallback metrics, or optional).",
     "Cada salto puntúa la parte del viewport que cubren los elementos que se mueven (antes y después) por cuánto se movieron, respecto del lado más grande del viewport. Los saltos a menos de 1 s entre sí, dentro de 5 s, forman una ráfaga, y el CLS es la ráfaga más grande; bueno es 0.1 o menos. Los saltos dentro de los 500 ms posteriores a un clic, un toque o una tecla no cuentan, porque el usuario espera que la página cambie. Un elemento que aparece no salta; salta lo que empuja. En una carga, los culpables de siempre son imágenes, videos e iframes sin dimensiones (ponles width y height o aspect-ratio), anuncios y contenido embebido que llegan tarde (reserva su espacio con min-height), contenido insertado arriba de lo que ya se ve (banners: superpónlos o insértalos abajo) y fuentes web que entran a reemplazar a la de respaldo (métricas ajustadas, u optional).")],
];

export default defineLesson({
  title: t("Critical Rendering Path Workbench", "Banco de trabajo: ruta crítica de renderizado"),
  eyebrow: t("Systems lesson 56 · Critical rendering path", "Lección de sistemas 56 · Ruta crítica de renderizado"),
  lede: t("Before a browser can paint anything it needs the HTML and every render-blocking resource the HTML points to: the stylesheets in the head, and any classic script there, which stops the parser until it has downloaded and run. This lesson builds that as a machine: watch it, predict what breaks it, then explain it back.",
    "Antes de pintar algo, un navegador necesita el HTML y cada recurso que bloquea el renderizado al que apunta: las hojas de estilos del head, y cualquier script clásico ahí, que detiene al parser hasta descargarse y correr. Esta lección arma la ruta crítica de renderizado (critical rendering path) como una máquina: mírala, predice qué la rompe y luego explícalo."),
  machine: {
    intro: t("The tubes at the back fill as each download's bytes arrive. The parser walks the HTML's tags and stops, lit, where a classic script holds it. The phone's shutter lifts at the first paint; after that, every frame redraws the screen, the LCP tag follows the largest element painted so far, and the lamp flashes when visible content moves. Time runs slow: at ×1 a second of loading takes about two and a half.",
      "Los tubos de atrás se llenan a medida que llegan los bytes de cada descarga. El parser recorre las etiquetas del HTML y se detiene, iluminado, donde lo retiene un script clásico. La cortina del teléfono sube en el primer pintado; desde ahí, cada cuadro vuelve a dibujar la pantalla, la etiqueta LCP sigue al elemento más grande pintado hasta ahora y la lámpara se enciende cuando se mueve contenido visible. El tiempo corre lento: en ×1, un segundo de carga dura unos dos segundos y medio."),
    plate: {
      title: t("Page-load bench", "Banco de carga"),
      keys: [
        { mark: "lit", label: t("What the page waits for now: the parser held by a script, the downloads first paint or LCP needs; the LCP tag; a layout shift", "Lo que la página espera ahora: el parser retenido por un script, las descargas que necesitan el primer pintado o el LCP; la etiqueta LCP; un salto de layout") },
        { mark: "raised", label: t("Tubes: one per download, filling as bytes arrive; pips: how urgent the browser made it", "Tubos: uno por descarga, se llenan a medida que llegan los bytes; marcas: qué tan urgente la hizo el navegador") },
        { mark: "flat", label: t("The strip: the HTML's tags in document order, appearing as its bytes arrive", "La tira: las etiquetas del HTML en el orden del documento, que aparecen a medida que llegan sus bytes") },
      ],
      caption: t(
        "A 400 × 720 px phone viewport over a long article, on a " + KBPS + " Mbit/s link with " + NET.rtt + " ms round trips (±15% per load): each request costs a round trip, a new connection three more. Downloads share the link, most urgent first: the HTML, the stylesheet and the font (3 pips); a classic script in the head, a hero preloaded with fetchpriority=high, and images a layout finds in the viewport (2); everything else (1). Sizes: HTML " + SIZES.html + " KB, stylesheet " + SIZES.css + " KB (" + SIZES.critical + " KB of it critical), app.js " + SIZES.app + " KB and " + CPU.app + " ms to run, font " + SIZES.font + " KB, hero " + SIZES.hero + " KB, three images far below " + SIZES.img + " KB each, an ad script that fetches a " + SIZES.ad + " KB ad from another server. The web font sets wider than the fallback, so its text wraps to more lines. Real costs depend on the page, the browser, the device and the network.",
        "Un viewport de teléfono de 400 × 720 px sobre un artículo largo, en un enlace de " + KBPS + " Mbit/s con viajes de ida y vuelta de " + NET.rtt + " ms (±15% por carga): cada petición cuesta un viaje, y una conexión nueva tres más. Las descargas comparten el enlace, primero lo más urgente: el HTML, la hoja de estilos y la fuente (3 marcas); un script clásico en el head, una hero precargada con fetchpriority=high y las imágenes que un layout encuentra en el viewport (2); todo lo demás (1). Tamaños: HTML " + SIZES.html + " KB, hoja de estilos " + SIZES.css + " KB (" + SIZES.critical + " KB de ella críticos), app.js " + SIZES.app + " KB y " + CPU.app + " ms de ejecución, fuente " + SIZES.font + " KB, hero " + SIZES.hero + " KB, tres imágenes de más abajo de " + SIZES.img + " KB cada una, un script de anuncios que trae un anuncio de " + SIZES.ad + " KB desde otro servidor. La fuente web es más ancha que la de respaldo, así que su texto ocupa más líneas. Los costos reales dependen de la página, el navegador, el dispositivo y la red.",
      ),
      stage: { "data-renderpath": "" },
      label: t("Critical rendering path simulation. Space pauses or resumes.", "Simulación de la ruta crítica de renderizado. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["fp", t("First paint", "Primer pintado"), "–"],
      ["text", t("Text visible", "Texto visible"), "–"],
      ["lcp", "LCP", "–"],
      ["cls", "CLS", "–"],
      ["blocked", t("Parser blocked", "Parser bloqueado"), "–"],
      ["app", t("app.js ran at", "app.js corrió a los"), "–"],
    ],
    controls: [
      { seg: "css", label: t("Stylesheet", "Hoja de estilos"), options: [["link", t("Linked in the head", "Enlazada en el head")], ["inline", t("Critical CSS inlined", "CSS crítico en línea")]], value: "link" },
      { seg: "js", label: "app.js", options: [["head", t("Classic, in the head", "Clásico, en el head")], ["async", "async"], ["defer", "defer"]], value: "head" },
      { seg: "font", label: "font-display", options: [["block", "block"], ["swap", "swap"], ["optional", "optional"]], value: "block" },
      { seg: "preload", label: t("Preload", "Precargar"), options: [["font", t("Font", "Fuente")], ["hero", t("Hero (fetchpriority=high)", "Hero (fetchpriority=high)")]], value: "", multiple: true },
      { seg: "lazy", label: "loading=\"lazy\"", options: [["below", t("Images below the fold", "Imágenes bajo el pliegue")], ["hero", "Hero"]], value: "", multiple: true },
      { seg: "reserve", label: t("Hold space for", "Reservar espacio para"), options: [["img", t("Images (width, height)", "Imágenes (width, height)")], ["ad", t("The ad slot", "El anuncio")], ["font", t("Font metrics", "Métricas de la fuente")]], value: "", multiple: true },
      { speed: true },
      { actions: [["warm", t("Repeat visit", "Visita repetida")], ["reset", t("Load again", "Cargar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Changing a setting loads the page again from a cold cache. “Repeat visit” loads it with everything but the HTML already in the HTTP cache. The page reloads by itself a few seconds after each load finishes. Below the fold means the three images far down the article; the hero is in the first screen.",
      "Cambiar un ajuste vuelve a cargar la página con la caché vacía. “Visita repetida” la carga con todo menos el HTML ya en la caché HTTP. La página se recarga sola unos segundos después de que termina cada carga. Bajo el pliegue son las tres imágenes de más abajo en el artículo; la hero está en la primera pantalla.",
    ),
  },
  predict: {
    intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded page loads.",
      "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " cargas de página con semilla fija."),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; its network, priorities and costs are a model, not measurements of any browser. LCP and CLS follow the definitions at <a href="https://web.dev/articles/vitals" target="_blank" rel="noopener">web.dev</a>.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; su red, sus prioridades y sus costos son un modelo, no mediciones de ningún navegador. LCP y CLS siguen las definiciones de <a href="https://web.dev/articles/vitals" target="_blank" rel="noopener">web.dev</a>.`),
  css: LIT_FILL_CSS + FIGURE_CSS,
  data: { P, G: GEOMETRY },
});
