// @ts-nocheck: content in the style of the other lessons
// Systems lesson 53 · List virtualization: a reading window over a tile belt.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { int, pct, one, oneUnder10 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, tileSvg, P, GEOMETRY } from "./figure";
import { lengthRun, overscanRun, heightRun, findRun, smallRun, KINDS, ROW, VIEW, FRAME, COST, NODES, EST_LOW, EST_MEAN, MATCHES, MATCH_SHARE, FLING, SEEDS, SMALL_MS } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each where the run is
// random; the first-render costs are the same for every seed).
const R = { length: lengthRun(), over: overscanRun(), height: heightRun(), find: findRun(), small: smallRun() };

const ms = (x) => oneUnder10(x) + " ms";
const FRAME_MS = FRAME.toFixed(1) + " ms";
const n1 = (x) => oneUnder10(x);
const top = (...xs) => Math.max(...xs) * 1.05;
const SCREEN_ROWS = VIEW / ROW;
const FLING_PX = (v) => int(v * 1000) + " px/s";
const PER_FRAME = (v) => Math.round(v * FRAME) + " px";

// What each card shows after a run.
const RUNS = {
  length: () => {
    const { full1k, full10k, win1k, win10k } = R.length, m = top(full10k.first);
    return { verdict: t("First render: the full list took " + ms(full1k.first) + " at 1,000 rows and " + ms(full10k.first) + " at 10,000; the windowed list " + ms(win1k.first) + " at both. At 10,000 rows the full list holds " + int(full10k.nodes) + " elements, the windowed one " + int(win10k.nodes) + ".",
        "Primer render: la lista completa tardó " + ms(full1k.first) + " con 1,000 filas y " + ms(full10k.first) + " con 10,000; la virtualizada " + ms(win1k.first) + " en ambos casos. Con 10,000 filas, la lista completa tiene " + int(full10k.nodes) + " elementos y la virtualizada " + int(win10k.nodes) + "."),
      bars: [[t("Full list, 1,000 rows", "Lista completa, 1,000 filas"), full1k.first / m, ms(full1k.first)], [t("Full list, 10,000 rows", "Lista completa, 10,000 filas"), full10k.first / m, ms(full10k.first), true],
        [t("Windowed, 1,000 rows", "Virtualizada, 1,000 filas"), win1k.first / m, ms(win1k.first)], [t("Windowed, 10,000 rows", "Virtualizada, 10,000 filas"), win10k.first / m, ms(win10k.first)],
        [t("Resize, full list, 10,000 rows", "Cambio de tamaño, lista completa, 10,000 filas"), full10k.resize / m, ms(full10k.resize)], [t("Resize, windowed", "Cambio de tamaño, virtualizada"), win10k.resize / m, ms(win10k.resize)]] };
  },
  over: () => {
    const [o0, o3, o10] = R.over, mr = top(o0.rows, o3.rows, o10.rows), mf = top(o0.framesPerFling);
    return { verdict: t("Flings that flashed blank rows: " + pct(o0.flingsBlank) + " with overscan 0, " + pct(o3.flingsBlank) + " with 3 rows, " + pct(o10.flingsBlank) + " with 10. Blank frames per fling: " + one(o0.framesPerFling) + " → " + one(o3.framesPerFling) + " → " + one(o10.framesPerFling) + ". Rows in the DOM: " + one(o0.rows) + " → " + one(o3.rows) + " → " + one(o10.rows) + ".",
        "Deslizamientos que mostraron filas en blanco: " + pct(o0.flingsBlank) + " con overscan 0, " + pct(o3.flingsBlank) + " con 3 filas, " + pct(o10.flingsBlank) + " con 10. Cuadros en blanco por deslizamiento: " + one(o0.framesPerFling) + " → " + one(o3.framesPerFling) + " → " + one(o10.framesPerFling) + ". Filas en el DOM: " + one(o0.rows) + " → " + one(o3.rows) + " → " + one(o10.rows) + "."),
      bars: [[t("Flings with blank, overscan 0", "Con blanco, overscan 0"), o0.flingsBlank, pct(o0.flingsBlank)], [t("Flings with blank, overscan 3", "Con blanco, overscan 3"), o3.flingsBlank, pct(o3.flingsBlank), true], [t("Flings with blank, overscan 10", "Con blanco, overscan 10"), o10.flingsBlank, pct(o10.flingsBlank)],
        [t("Blank frames per fling, overscan 0", "Cuadros en blanco por deslizamiento, overscan 0"), o0.framesPerFling / mf, one(o0.framesPerFling)], [t("Rows in the DOM, overscan 3", "Filas en el DOM, overscan 3"), o3.rows / mr, one(o3.rows)], [t("Rows in the DOM, overscan 10", "Filas en el DOM, overscan 10"), o10.rows / mr, one(o10.rows), true]] };
  },
  heights: () => {
    const [lo, mean, fix] = R.height, m = top(lo.up, mean.up, lo.down), mp = top(lo.upPx, mean.upPx);
    return { verdict: t("Content jumps per screen, scrolling down / up: estimate " + EST_LOW + " px " + one(lo.down) + " / " + one(lo.up) + " (about " + Math.round(lo.upPx) + " px each); estimate " + EST_MEAN + " px " + one(mean.down) + " / " + one(mean.up) + " (about " + Math.round(mean.upPx) + " px each); " + EST_LOW + " px with the scroll position corrected " + one(fix.down) + " / " + one(fix.up) + ".",
        "Saltos del contenido por pantalla, bajando / subiendo: estimación de " + EST_LOW + " px " + one(lo.down) + " / " + one(lo.up) + " (unos " + Math.round(lo.upPx) + " px cada uno); estimación de " + EST_MEAN + " px " + one(mean.down) + " / " + one(mean.up) + " (unos " + Math.round(mean.upPx) + " px cada uno); " + EST_LOW + " px corrigiendo la posición de scroll " + one(fix.down) + " / " + one(fix.up) + "."),
      bars: [[t("Down, estimate " + EST_LOW + " px", "Bajando, estimación " + EST_LOW + " px"), lo.down / m, one(lo.down)], [t("Up, estimate " + EST_LOW + " px", "Subiendo, estimación " + EST_LOW + " px"), lo.up / m, one(lo.up), true], [t("Up, estimate " + EST_MEAN + " px", "Subiendo, estimación " + EST_MEAN + " px"), mean.up / m, one(mean.up)], [t("Up, corrected", "Subiendo, corregida"), fix.up / m, one(fix.up)],
        [t("Size of a jump, estimate " + EST_LOW + " px", "Tamaño de un salto, estimación " + EST_LOW + " px"), lo.upPx / mp, Math.round(lo.upPx) + " px", true], [t("Size of a jump, estimate " + EST_MEAN + " px", "Tamaño de un salto, estimación " + EST_MEAN + " px"), mean.upPx / mp, Math.round(mean.upPx) + " px"]] };
  },
  find: () => {
    const [full, cv, win] = R.find, m = top(full.first);
    return { verdict: t("Rows with the word that find could reach, of " + MATCHES + ": full list " + n1(full.found) + ", content-visibility " + n1(cv.found) + ", windowed " + n1(win.found) + " on average. First render: " + ms(full.first) + ", " + ms(cv.first) + ", " + ms(win.first) + ".",
        "Filas con la palabra que la búsqueda pudo alcanzar, de " + MATCHES + ": lista completa " + n1(full.found) + ", content-visibility " + n1(cv.found) + ", virtualizada " + n1(win.found) + " en promedio. Primer render: " + ms(full.first) + ", " + ms(cv.first) + ", " + ms(win.first) + "."),
      bars: [[t("Found, full list", "Encontradas, lista completa"), full.found / MATCHES, n1(full.found)], [t("Found, content-visibility", "Encontradas, content-visibility"), cv.found / MATCHES, n1(cv.found)], [t("Found, windowed", "Encontradas, virtualizada"), win.found / MATCHES, n1(win.found), true],
        [t("First render, full list", "Primer render, lista completa"), full.first / m, ms(full.first)], [t("First render, content-visibility", "Primer render, content-visibility"), cv.first / m, ms(cv.first), true], [t("First render, windowed", "Primer render, virtualizada"), win.first / m, ms(win.first)]] };
  },
  small: () => {
    const [full, win] = R.small, m = top(full.first, FRAME);
    return { verdict: t("100 rows. First render: " + ms(full.first) + " full, " + ms(win.first) + " windowed (one frame is " + FRAME_MS + "). Script per scroll frame: none full, " + ms(win.perFrame) + " windowed, " + ms(win.scriptMs) + " over the " + SMALL_MS / 1000 + " s read. Rows in the DOM: 100 vs " + one(win.rows) + ".",
        "100 filas. Primer render: " + ms(full.first) + " completa, " + ms(win.first) + " virtualizada (un cuadro dura " + FRAME_MS + "). Script por cuadro de scroll: ninguno en la completa, " + ms(win.perFrame) + " en la virtualizada, " + ms(win.scriptMs) + " en los " + SMALL_MS / 1000 + " s de lectura. Filas en el DOM: 100 vs " + one(win.rows) + "."),
      bars: [[t("First render, full list", "Primer render, lista completa"), full.first / m, ms(full.first)], [t("First render, windowed", "Primer render, virtualizada"), win.first / m, ms(win.first), true], [t("One frame", "Un cuadro"), FRAME / m, FRAME_MS],
        [t("Script per scroll frame, full list", "Script por cuadro de scroll, completa"), 0, "0 ms"], [t("Script per scroll frame, windowed", "Script por cuadro de scroll, virtualizada"), win.perFrame / m, ms(win.perFrame), true]] };
  },
};

const { length: L1, over: [O0, O3, O10], height: [H48, HM, HF], find: [F_FULL, F_CV, F_WIN], small: [SM_FULL, SM_WIN] } = R;

const EXPERIMENTS = [
  {
    id: "length",
    title: t("Ten times the rows", "Diez veces más filas"),
    change: t("A list of 1,000 rows grows to 10,000 · full list (every row in the DOM) vs windowed (the " + SCREEN_ROWS + " rows on screen plus 3 overscan rows each side)",
      "Una lista de 1,000 filas crece a 10,000 · lista completa (todas las filas en el DOM) vs virtualizada (las " + SCREEN_ROWS + " filas en pantalla más 3 filas de overscan a cada lado)"),
    question: t("What happens to the windowed list's first render when the list grows tenfold?", "¿Qué le pasa al primer render de la lista virtualizada cuando la lista crece diez veces?"),
    options: [
      t("It grows tenfold too, from a smaller start", "También crece diez veces, desde un punto de partida más bajo"),
      t("It stays the same: it renders what fits on screen, whatever the list's length", "Queda igual: renderiza lo que cabe en pantalla, mida lo que mida la lista"),
      t("It grows a little: each extra row still has to be laid out once", "Crece un poco: cada fila extra igual tiene que pasar por layout una vez"),
    ],
    answer: 1,
    why: t(
      "A windowed list renders the rows that fit in the viewport plus the overscan, so its first render depends on the viewport, not the list: " + ms(L1.win1k.first) + " at 1,000 rows and at 10,000. The rows it doesn't render are never laid out; a tall empty spacer keeps the scrollbar right. The full list creates, styles and lays out every row before anything is painted: " + ms(L1.full1k.first) + " → " + ms(L1.full10k.first) + ", and " + int(L1.full10k.nodes) + " elements stay in memory. It isn't a one-off cost either: resizing the window lays out every row again, " + ms(L1.full10k.resize) + " against " + ms(L1.win10k.resize) + ". If a click triggers a render like that, the next paint waits for it, and that delay is what INP (Interaction to Next Paint) measures.",
      "Una lista virtualizada renderiza las filas que caben en el viewport más el overscan, así que su primer render depende del viewport, no de la lista: " + ms(L1.win1k.first) + " con 1,000 filas y con 10,000. Las filas que no renderiza nunca pasan por layout; un espaciador alto y vacío mantiene correcta la barra de scroll. La lista completa crea, aplica estilos y hace el layout de cada fila antes de pintar nada: " + ms(L1.full1k.first) + " → " + ms(L1.full10k.first) + ", y " + int(L1.full10k.nodes) + " elementos quedan en memoria. Tampoco es un costo de una sola vez: cambiar el tamaño de la ventana vuelve a hacer el layout de cada fila, " + ms(L1.full10k.resize) + " contra " + ms(L1.win10k.resize) + ". Si un clic dispara un render así, el siguiente pintado lo espera, y esa demora es lo que mide INP (Interaction to Next Paint).",
    ),
    watch: { mode: "full", n: 10000, overscan: 3, heights: "fixed", gesture: "read" },
  },
  {
    id: "over",
    title: t("Overscan in a hard fling", "Overscan en un deslizamiento fuerte"),
    change: t("Windowed, 10,000 rows of " + ROW + " px · hard flings that start at " + int(FLING[0] * 1000) + " to " + FLING_PX(FLING[1]) + " and slow down · overscan 0, 3 or 10 rows each side",
      "Virtualizada, 10,000 filas de " + ROW + " px · deslizamientos fuertes (flings) que arrancan a entre " + int(FLING[0] * 1000) + " y " + FLING_PX(FLING[1]) + " y se van frenando · overscan de 0, 3 o 10 filas a cada lado"),
    question: t("With 3 rows of overscan, do flings still flash blank rows?", "Con 3 filas de overscan, ¿los deslizamientos todavía muestran filas en blanco?"),
    options: [
      t("No: the list renders every frame, so any overscan keeps up", "No: la lista renderiza en cada cuadro, así que cualquier overscan alcanza"),
      t("Yes, all through the fling: overscan only helps slow scrolling", "Sí, durante todo el deslizamiento: el overscan solo ayuda al scroll lento"),
      t("Some do, for a frame or so at their fastest; 10 rows covers them, with nearly twice the rows in the DOM", "Algunos sí, durante un cuadro más o menos en su punto más rápido; 10 filas los cubren, con casi el doble de filas en el DOM"),
    ],
    answer: 2,
    why: t(
      "Browsers usually scroll on the compositor, off the main thread, so the page moves before the scroll handler has rendered the rows it now needs. In this model those rows show up one frame later; until then, any part of the viewport past the last rendered row is blank. With no overscan that happens " + one(O0.framesPerFling) + " frames per fling, in every fling. Overscan is a head start: 3 rows is " + 3 * ROW + " px, and a fling starting at " + FLING_PX(FLING[1]) + " moves about " + PER_FRAME(FLING[1]) + " in one frame, so " + pct(O3.flingsBlank) + " of flings still flash for a moment. 10 rows (" + 10 * ROW + " px) covers every fling here, at " + one(O10.rows) + " rows in the DOM instead of " + one(O3.rows) + ". No overscan covers a jump: dragging the scrollbar lands thousands of rows away, outside any margin.",
      "Los navegadores suelen hacer el scroll en el compositor, fuera del hilo principal, así que la página se mueve antes de que el handler de scroll haya renderizado las filas que ahora necesita. En este modelo esas filas aparecen un cuadro después; mientras tanto, cualquier parte del viewport más allá de la última fila renderizada queda en blanco. Sin overscan eso pasa " + one(O0.framesPerFling) + " cuadros por deslizamiento, en todos. El overscan es una ventaja inicial: 3 filas son " + 3 * ROW + " px, y un deslizamiento que empieza a " + FLING_PX(FLING[1]) + " avanza unos " + PER_FRAME(FLING[1]) + " en un cuadro, así que " + pct(O3.flingsBlank) + " de los deslizamientos todavía parpadean un momento. 10 filas (" + 10 * ROW + " px) cubren todos los deslizamientos aquí, con " + one(O10.rows) + " filas en el DOM en lugar de " + one(O3.rows) + ". Ningún overscan cubre un salto: arrastrar la barra de scroll aterriza a miles de filas, fuera de cualquier margen.",
    ),
    watch: { mode: "window", n: 10000, overscan: 3, heights: "fixed", gesture: "fling" },
  },
  {
    id: "heights",
    title: t("Rows of different heights", "Filas de distintos altos"),
    change: t("Windowed chat rows of " + KINDS[0] + " to " + KINDS[KINDS.length - 1] + " px, measured only once rendered; a row not measured yet counts as the estimate · drag the scrollbar somewhere, read one screen down, then scroll three screens up · estimate " + EST_LOW + " px, estimate " + EST_MEAN + " px (the mean), or " + EST_LOW + " px with the scroll position corrected",
      "Filas de chat virtualizadas de " + KINDS[0] + " a " + KINDS[KINDS.length - 1] + " px, medidas solo al renderizarse; una fila sin medir cuenta como la estimación · arrastrar la barra de scroll a algún lugar, leer una pantalla hacia abajo y luego subir tres · estimación de " + EST_LOW + " px, de " + EST_MEAN + " px (la media), o de " + EST_LOW + " px corrigiendo la posición de scroll"),
    question: t("With the " + EST_LOW + " px estimate, when does the content jump under the reader?", "Con la estimación de " + EST_LOW + " px, ¿cuándo salta el contenido bajo el lector?"),
    options: [
      t("Mostly scrolling back up past where they landed: a row measured above the viewport pushes everything below it", "Sobre todo al subir más allá de donde aterrizó: una fila medida arriba del viewport empuja todo lo que está debajo"),
      t("Scrolling down, into rows never measured", "Al bajar, hacia filas nunca medidas"),
      t("Both ways, about equally", "En ambos sentidos, más o menos igual"),
    ],
    answer: 0,
    why: t(
      "A row's position is the sum of the heights above it. When a row above the viewport is rendered and measured taller than its estimate, every row under it, the ones on screen included, moves down by the difference. A row measured below the viewport moves nothing you can see. Scrolling down: " + one(H48.down) + " jumps per screen; scrolling up past the landing point: " + one(H48.up) + " per screen, about " + Math.round(H48.upPx) + " px each. The mean as the estimate makes the jumps smaller (about " + Math.round(HM.upPx) + " px) but not rarer (" + one(HM.up) + " per screen): rows still differ from the mean, both ways. Moving the scroll position by the same amount whenever a row above the top visible row changes height removes them (" + one(HF.up) + "). Many virtualizers do that in JavaScript; for ordinary content, CSS scroll anchoring does it in the browsers that support it.",
      "La posición de una fila es la suma de los altos de las filas de arriba. Cuando una fila arriba del viewport se renderiza y mide más que su estimación, todas las filas debajo, incluidas las que están en pantalla, bajan la diferencia. Una fila medida debajo del viewport no mueve nada que se vea. Bajando: " + one(H48.down) + " saltos por pantalla; subiendo más allá del punto de aterrizaje: " + one(H48.up) + " por pantalla, de unos " + Math.round(H48.upPx) + " px cada uno. Usar la media como estimación hace los saltos más chicos (unos " + Math.round(HM.upPx) + " px) pero no más raros (" + one(HM.up) + " por pantalla): las filas siguen difiriendo de la media, para un lado y para el otro. Mover la posición de scroll lo mismo cada vez que cambia el alto de una fila arriba de la primera visible los elimina (" + one(HF.up) + "). Muchos virtualizadores lo hacen en JavaScript; para el contenido común, el anclaje de scroll de CSS (scroll anchoring) lo hace en los navegadores que lo soportan.",
    ),
    watch: { mode: "window", n: 10000, overscan: 3, heights: "variable", estimate: EST_LOW, anchor: "off", gesture: "jump" },
  },
  {
    id: "find",
    title: t("Ctrl+F in a windowed list", "Ctrl+F en una lista virtualizada"),
    change: t("10,000 rows; a word appears in " + MATCHES + " of them · the reader uses the browser's find (Ctrl+F) from places all over the list · full list, content-visibility: auto, or windowed",
      "10,000 filas; una palabra aparece en " + MATCHES + " de ellas · el lector usa la búsqueda del navegador (Ctrl+F) desde lugares de toda la lista · lista completa, content-visibility: auto, o virtualizada"),
    question: t("How many of the " + MATCHES + " rows can the browser's find reach in each list?", "¿Cuántas de las " + MATCHES + " filas puede alcanzar la búsqueda del navegador en cada lista?"),
    options: [
      t("All " + MATCHES + " in each: find searches the page's data", "Las " + MATCHES + " en todas: la búsqueda recorre los datos de la página"),
      t("All " + MATCHES + " in the full list and with content-visibility; almost none in the windowed list", "Las " + MATCHES + " en la lista completa y con content-visibility; casi ninguna en la virtualizada"),
      t("All " + MATCHES + " only in the full list: content-visibility hides off-screen rows from find too", "Las " + MATCHES + " solo en la lista completa: content-visibility también le oculta a la búsqueda las filas fuera de pantalla"),
    ],
    answer: 1,
    why: t(
      "The browser's find searches the DOM, and a windowed list only holds the rows near the viewport, so find reaches " + n1(F_WIN.found) + " of " + MATCHES + " on average: whatever happens to be rendered. The same goes for a link to a row's anchor and for what a screen reader can read. content-visibility: auto keeps every row in the DOM and lets the browser skip most rendering work (layout and painting) for rows away from the viewport; skipped content stays searchable and focusable. It still creates every row, so its first render here, " + ms(F_CV.first) + ", falls between windowed (" + ms(F_WIN.first) + ") and full (" + ms(F_FULL.first) + ").",
      "La búsqueda del navegador recorre el DOM, y una lista virtualizada solo tiene las filas cercanas al viewport, así que la búsqueda alcanza " + n1(F_WIN.found) + " de " + MATCHES + " en promedio: las que justo estén renderizadas. Lo mismo vale para un enlace al ancla de una fila y para lo que puede leer un lector de pantalla. content-visibility: auto mantiene todas las filas en el DOM y deja que el navegador se salte la mayor parte del trabajo de renderizado (layout y pintado) de las filas lejos del viewport; el contenido omitido sigue siendo buscable y enfocable. Igual crea todas las filas, así que su primer render aquí, " + ms(F_CV.first) + ", queda entre la virtualizada (" + ms(F_WIN.first) + ") y la completa (" + ms(F_FULL.first) + ").",
    ),
    watch: { mode: "window", n: 10000, overscan: 3, heights: "fixed", gesture: "jump" },
  },
  {
    id: "small",
    title: t("A list of 100 rows", "Una lista de 100 filas"),
    change: t("A settings page with 100 rows, read top to bottom · full list vs windowed (overscan 3)",
      "Una página de ajustes con 100 filas, leída de arriba abajo · lista completa vs virtualizada (overscan 3)"),
    question: t("Is windowing worth it here?", "¿Vale la pena virtualizar aquí?"),
    options: [
      t("Yes: it renders far fewer rows, so everything gets faster", "Sí: renderiza muchas menos filas, así que todo se vuelve más rápido"),
      t("No: the windowed first render is slower than the full one", "No: el primer render virtualizado es más lento que el completo"),
      t("Hardly: it saves a few milliseconds once, then runs script on every scroll frame, and Ctrl+F stops finding rows", "Apenas: ahorra unos milisegundos una vez, después corre script en cada cuadro de scroll, y Ctrl+F deja de encontrar filas"),
    ],
    answer: 2,
    why: t(
      "The full list's first render is " + ms(SM_FULL.first) + ", well under one frame (" + FRAME_MS + "). Windowed it is " + ms(SM_WIN.first) + ": " + ms(SM_FULL.first - SM_WIN.first) + " saved, once. While the reader scrolls, the full list runs no script at all (the compositor moves it), and the windowed list runs its scroll handler and mounts rows on every scroll frame, " + ms(SM_WIN.perFrame) + " each, " + ms(SM_WIN.scriptMs) + " over the " + SMALL_MS / 1000 + " s read. Both are small; what decides it is what you give up: find-in-page, anchor links and rows a screen reader can reach. Window a list when rendering all of it costs frames, not milliseconds.",
      "El primer render de la lista completa es de " + ms(SM_FULL.first) + ", muy por debajo de un cuadro (" + FRAME_MS + "). Virtualizada es de " + ms(SM_WIN.first) + ": " + ms(SM_FULL.first - SM_WIN.first) + " ahorrados, una vez. Mientras el lector hace scroll, la lista completa no corre nada de script (el compositor la mueve), y la virtualizada corre su handler de scroll y monta filas en cada cuadro de scroll, " + ms(SM_WIN.perFrame) + " cada vez, " + ms(SM_WIN.scriptMs) + " en los " + SMALL_MS / 1000 + " s de lectura. Las dos cifras son chicas; lo que decide es lo que pierdes: la búsqueda en la página, los enlaces a anclas y las filas que alcanza un lector de pantalla. Virtualiza una lista cuando renderizarla entera cuesta cuadros, no milisegundos.",
    ),
    watch: { mode: "window", n: 100, overscan: 3, heights: "fixed", gesture: "read" },
  },
];

const QUESTIONS = [
  [t("Why does a windowed list's first render stay flat as the list grows, and what still grows with the list?", "¿Por qué el primer render de una lista virtualizada no crece con la lista, y qué sí crece con ella?"),
    t("It renders only the rows that fit in the viewport plus the overscan, so the DOM it builds depends on the viewport, not on the list. What still grows: the data in memory, the spacer's height (one number), and with variable heights the bookkeeping of sizes and offsets per row. Fetching 10,000 rows is a cost of its own; loading pages on demand cuts it (the Pagination lesson, 12). And if you must render everything, rendering it in chunks between frames keeps input responsive (the Event loop lesson, 16), though the DOM still ends up full.",
      "Renderiza solo las filas que caben en el viewport más el overscan, así que el DOM que construye depende del viewport, no de la lista. Lo que sí crece: los datos en memoria, el alto del espaciador (un número) y, con altos variables, el registro de tamaños y posiciones por fila. Traer 10,000 filas es un costo aparte; cargar páginas a demanda lo reduce (la lección de Paginación, 12). Y si tienes que renderizar todo, hacerlo por partes entre cuadros mantiene la página respondiendo (la lección del Event loop, 16), aunque el DOM igual termina lleno.")],
  [t("A teammate throttles the virtual list's scroll handler to once every 100 ms to save CPU. What happens on a fast scroll?", "Alguien del equipo aplica throttle al handler de scroll de la lista virtual, una vez cada 100 ms, para ahorrar CPU. ¿Qué pasa en un scroll rápido?"),
    t("The rendered range now lags the scroll by up to 100 ms instead of a frame, so the viewport runs past the rendered rows and shows blank unless the overscan covers 100 ms of travel. Browsers already fire scroll events at most about once per frame, so a virtual list should handle each one; throttling it to a longer interval trades CPU for blank rows (the Throttle lesson, 32).",
      "El rango renderizado ahora va atrasado respecto al scroll hasta 100 ms en lugar de un cuadro, así que el viewport pasa de largo las filas renderizadas y muestra blanco, salvo que el overscan cubra 100 ms de recorrido. Los navegadores ya disparan los eventos de scroll como mucho una vez por cuadro, más o menos, así que una lista virtual debería atender cada uno; aplicarle throttle con un intervalo más largo cambia CPU por filas en blanco (la lección de Throttle, 32).")],
  [t("Overscan: what does it buy, what does it cost, and what can it never fix?", "Overscan: ¿qué te da, qué cuesta y qué nunca puede arreglar?"),
    t("It renders rows past the edges of the viewport, so a scroll can travel that far before the next render without showing blank. It costs more rows in the DOM and more rows to mount whenever the range moves a long way. It can't cover a jump: dragging the scrollbar or scrolling to an index lands far outside any margin, so the first frame there shows whatever the list has before its rows render. Some lists show light placeholder rows while scrolling is fast instead.",
      "Renderiza filas más allá de los bordes del viewport, así que un scroll puede avanzar esa distancia antes del siguiente render sin mostrar blanco. Cuesta más filas en el DOM y más filas que montar cada vez que el rango se mueve mucho. No puede cubrir un salto: arrastrar la barra de scroll o hacer scroll hasta un índice aterriza muy lejos de cualquier margen, así que el primer cuadro ahí muestra lo que tenga la lista antes de que se rendericen sus filas. Algunas listas, en cambio, muestran filas livianas de relleno mientras el scroll es rápido.")],
  [t("With variable row heights, why does content jump when you scroll up but hardly when you scroll down, and how do you fix it?", "Con filas de alto variable, ¿por qué el contenido salta al subir pero casi no al bajar, y cómo se arregla?"),
    t("Each row's offset is the sum of the heights above it. A row measured above the viewport changes the offset of everything under it, the visible rows included; a row measured below moves nothing visible. Fixes: when a row above the top visible row changes height, move the scroll position by the same amount (scroll anchoring, which many virtualizers do); make the estimate closer, per kind of row, so the differences are small; and reserve the height up front when the data knows it, such as an image's dimensions.",
      "La posición de cada fila es la suma de los altos de arriba. Una fila medida arriba del viewport cambia la posición de todo lo que está debajo, incluidas las filas visibles; una fila medida debajo no mueve nada visible. Soluciones: cuando cambia el alto de una fila arriba de la primera visible, mover la posición de scroll lo mismo (el anclaje de scroll, que hacen muchos virtualizadores); acercar la estimación, por tipo de fila, para que las diferencias sean chicas; y reservar el alto de antemano cuando los datos lo conocen, como las dimensiones de una imagen.")],
  [t("Your list is windowed. What breaks for keyboard and screen-reader users, and what helps?", "Tu lista está virtualizada. ¿Qué se rompe para quienes usan teclado o lector de pantalla, y qué ayuda?"),
    t("Only the rendered rows exist: a screen reader can't read or count the rest, and a focused row can be unmounted when it scrolls away, losing focus. Helps: aria-setsize and aria-posinset on the items (or aria-rowcount and aria-rowindex in a grid) so the position and the total are announced; keeping the focused row mounted; moving focus by index (scroll to the row, then focus it); and a search of your own that scrolls to the matching index, since the browser's find can't see unrendered rows.",
      "Solo existen las filas renderizadas: un lector de pantalla no puede leer ni contar el resto, y una fila con el foco puede desmontarse al salir de la vista y perder el foco. Ayuda: aria-setsize y aria-posinset en los elementos (o aria-rowcount y aria-rowindex en una grilla) para que se anuncien la posición y el total; mantener montada la fila con el foco; mover el foco por índice (hacer scroll hasta la fila y después enfocarla); y una búsqueda propia que haga scroll hasta el índice que coincide, porque la búsqueda del navegador no ve las filas sin renderizar.")],
  [t("When would you reach for content-visibility: auto instead of a virtualizer, and when not?", "¿Cuándo usarías content-visibility: auto en lugar de un virtualizador, y cuándo no?"),
    t("When the page or list is long but not huge and you want find-in-page, anchors and accessibility to keep working: every row stays in the DOM and the browser skips rendering work for the parts away from the viewport. Give each item a contain-intrinsic-size (with the auto keyword the browser remembers the last size it rendered) so the scrollbar doesn't jump as items render. It doesn't save creating the nodes or the memory they take, so for tens of thousands of rows, or rows that are expensive to build, a virtualizer still wins the first render.",
      "Cuando la página o la lista es larga pero no enorme y quieres que la búsqueda en la página, las anclas y la accesibilidad sigan funcionando: todas las filas quedan en el DOM y el navegador se salta el trabajo de renderizado de las partes lejos del viewport. Dale a cada elemento un contain-intrinsic-size (con la palabra clave auto el navegador recuerda el último tamaño que renderizó) para que la barra de scroll no salte a medida que se renderizan. No ahorra crear los nodos ni la memoria que ocupan, así que para decenas de miles de filas, o filas caras de construir, un virtualizador sigue ganando en el primer render.")],
];

const PER_ROW = { create: COST.create, layout: COST.layout, pass: COST.pass };

export default defineLesson({
  title: t("List Virtualization Workbench", "Banco de trabajo: virtualización de listas"),
  eyebrow: t("Systems lesson 53 · List virtualization", "Lección de sistemas 53 · Virtualización de listas"),
  lede: t("Rendering a 10,000-row list puts 10,000 rows in the DOM, and the browser pays for every one: in the first render, in memory, and in style and layout work that grows with the DOM. Virtualization (windowing) renders only the rows in the viewport plus a small margin, and swaps them as you scroll. This lesson puts both on a tile belt under a reading window: watch it, predict what breaks it, then explain it back.",
    "Renderizar una lista de 10,000 filas pone 10,000 filas en el DOM, y el navegador paga por cada una: en el primer render, en memoria y en trabajo de estilo y layout que crece con el DOM. La virtualización (windowing) renderiza solo las filas del viewport más un margen chico, y las va cambiando mientras haces scroll. Esta lección pone ambas en una cinta de fichas bajo una ventana de lectura: mírala, predice qué la rompe y luego explícala con tus palabras."),
  machine: {
    intro: t("A reader scrolls a long list. Switch between the full list, a windowed one and content-visibility, change the overscan and the row heights, and watch what reaches the window in time. Fling, jump to the middle, or press Ctrl+F.",
      "Un lector hace scroll en una lista larga. Cambia entre la lista completa, una virtualizada y content-visibility, cambia el overscan y los altos de fila, y mira qué llega a tiempo a la ventana. Desliza rápido, salta a la mitad o presiona Ctrl+F."),
    plate: {
      title: t("Reading window", "Ventana de lectura"),
      keys: [
        { mark: "lit", label: t("Blank: part of the viewport with no row under it, and the lamp; a row just measured, or found", "En blanco: parte del viewport sin fila debajo, y la lámpara; una fila recién medida, o encontrada") },
        { mark: "raised", label: t("Tiles: rows in the DOM, numbered; a dot marks the search word", "Fichas: filas en el DOM, numeradas; un punto marca la palabra buscada") },
        { mark: "flat", label: t("Outlines: rows content-visibility skips", "Contornos: filas que content-visibility se salta") },
      ],
      caption: t(
        "The belt is the list, one tile per row, the top of the list to the left; scrolling slides it under the VIEWPORT window, " + VIEW + " px tall (" + SCREEN_ROWS + " rows of " + ROW + " px). The model runs at 60 frames a second, shown six times slower at ×1. Each frame the scroll moves first and the main thread renders the rows for it afterwards, so new rows show up a frame late; any part of the window with no tile under it lights up, and so does the lamp. Windowed, only the stretch between the two stops on the belt holds tiles: the rows on screen plus the overscan. The thumb on the rail behind is the scrollbar. The cabinet counts the rows in the DOM and the first render; the console counts blank frames and content jumps, and its meter shows how much of each frame the main thread spent. The reader's slip shows how many rows with the search word (one row in " + Math.round(1 / MATCH_SHARE) + ") are in the DOM, where Ctrl+F can find them. Costs are the model's: " + PER_ROW.create + " ms to create a row's " + NODES + " elements, " + PER_ROW.layout + " ms to style, lay out and paint it, " + PER_ROW.pass + " ms per render pass; real costs depend on the device, the framework and the row.",
        "La cinta es la lista, una ficha por fila, con el principio de la lista a la izquierda; el scroll la desliza bajo la ventana VIEWPORT, de " + VIEW + " px de alto (" + SCREEN_ROWS + " filas de " + ROW + " px). El modelo corre a 60 cuadros por segundo, mostrado seis veces más lento en ×1. En cada cuadro primero se mueve el scroll y después el hilo principal renderiza las filas para esa posición, así que las filas nuevas aparecen un cuadro tarde; cualquier parte de la ventana sin ficha debajo se ilumina, y la lámpara también. Virtualizada, solo el tramo entre los dos topes de la cinta lleva fichas: las filas en pantalla más el overscan. El cursor en el riel de atrás es la barra de scroll. El gabinete cuenta las filas en el DOM y el primer render; la consola cuenta los cuadros en blanco y los saltos del contenido, y su medidor muestra cuánto de cada cuadro usó el hilo principal. La nota del lector muestra cuántas filas con la palabra buscada (una de cada " + Math.round(1 / MATCH_SHARE) + ") están en el DOM, donde Ctrl+F las puede encontrar. Los costos son del modelo: " + PER_ROW.create + " ms para crear los " + NODES + " elementos de una fila, " + PER_ROW.layout + " ms para aplicarle estilos, hacer su layout y pintarla, " + PER_ROW.pass + " ms por pasada de render; los costos reales dependen del dispositivo, del framework y de la fila.",
      ),
      stage: { "data-reading": "" },
      label: t("List virtualization simulation. Space pauses or resumes.", "Simulación de virtualización de listas. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["dom", t("Rows in the DOM", "Filas en el DOM"), "–"],
      ["first", t("First render", "Primer render"), "–"],
      ["blank", t("Blank frames", "Cuadros en blanco"), "0"],
      ["jumps", t("Content jumps", "Saltos del contenido"), "0"],
      ["main", t("Main thread per scroll frame", "Hilo principal por cuadro de scroll"), "–"],
      ["found", t("Ctrl+F can find", "Ctrl+F puede encontrar"), "–"],
    ],
    controls: [
      { seg: "mode", label: t("List", "Lista"), options: [["full", t("Full list", "Lista completa")], ["window", t("Windowed", "Virtualizada")], ["cv", "content-visibility"]], value: "window" },
      { seg: "n", label: t("Rows", "Filas"), options: [[100, "100"], [1000, "1,000"], [10000, "10,000"]], value: 10000 },
      { seg: "overscan", label: "Overscan", options: [[0, "0"], [3, t("3 rows", "3 filas")], [10, t("10 rows", "10 filas")]], value: 3 },
      { seg: "heights", label: t("Row heights", "Altos de fila"), options: [["fixed", t("Fixed, " + ROW + " px", "Fijos, " + ROW + " px")], ["variable", t("Variable", "Variables")]], value: "fixed" },
      { seg: "estimate", label: t("Estimate", "Estimación"), options: [[EST_LOW, EST_LOW + " px"], [EST_MEAN, t(EST_MEAN + " px (the mean)", EST_MEAN + " px (la media)")]], value: EST_LOW, for: "variable", hidden: true },
      { seg: "anchor", label: t("Keep position", "Mantener posición"), options: [["off", t("Off", "No")], ["on", t("On", "Sí")]], value: "off", for: "variable", hidden: true },
      { seg: "gesture", label: t("Reader", "Lector"), options: [["read", t("Reads", "Lee")], ["fling", t("Flings", "Desliza rápido")], ["jump", t("Drags the scrollbar", "Arrastra la barra")]], value: "read" },
      { speed: true },
      { actions: [["fling", t("Fling", "Deslizar rápido")], ["middle", t("Jump to the middle", "Saltar a la mitad")], ["find", "Ctrl+F"], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Changing a setting starts the run again. Overscan applies to the windowed list; content-visibility lays out the rows within one screen of the viewport. Estimate and Keep position appear with variable heights.",
      "Cambiar un ajuste reinicia la ejecución. El overscan aplica a la lista virtualizada; content-visibility hace el layout de las filas a una pantalla o menos del viewport. Estimación y Mantener posición aparecen con altos variables.",
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. It keeps a scroll that moves before the main thread renders, at most one render pass per frame, overscan, row heights measured on first render with an estimate for the rest, and content-visibility: auto with a one-screen margin. It leaves out raster tiles, images, garbage collection and any one framework's scheduling.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Mantiene un scroll que se mueve antes de que renderice el hilo principal, como mucho una pasada de render por cuadro, overscan, altos de fila medidos en el primer render con una estimación para el resto, y content-visibility: auto con un margen de una pantalla. Deja fuera los tiles de rasterizado, las imágenes, la recolección de basura y la planificación de cada framework.`),
  css: LIT_FILL_CSS + `
.vz-blank{fill:var(--anatomy-lit);stroke:var(--anatomy-lit);stroke-width:.4;stroke-linejoin:round}
.vz-ghost{fill:none;stroke:var(--anatomy-lo);stroke-width:.6;stroke-dasharray:1.4 1.2}
.vz-range{fill:none;stroke:var(--anatomy-mid);stroke-width:1.1;stroke-linecap:round}
`,
  data: { P, G: GEOMETRY, TILES: KINDS.map((_, k) => tileSvg(k)) },
});
