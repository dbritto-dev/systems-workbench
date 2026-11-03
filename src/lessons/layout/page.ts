// @ts-nocheck: content in the style of the other lessons
// Systems lesson 52 · Layout thrashing: a typesetting bench whose measuring gantry makes one pass per layout.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { millis, int, n0 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, P, GEOMETRY } from "./figure";
import { thrashRun, scaleRun, propRun, rafRun, containRun, BUDGET, COST, JITTER, SCALE, SEEDS, FRAMES } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const R = { thrash: thrashRun(), scale: scaleRun(), props: propRun(), raf: rafRun(), contain: containRun() };

const ms = millis;
const BUD = millis(BUDGET);
const top = (...xs) => Math.max(...xs) * 1.04;
const us = (x) => n0(x * 1000) + " µs";
const layoutsEn = (n) => n0(n) + (Math.round(n) === 1 ? " layout" : " layouts");
const layoutsEs = (n) => n0(n) + (Math.round(n) === 1 ? " layout" : " layouts");
const vsEn = (x) => (x > BUDGET ? "over" : "within");
const vsEs = (x) => (x > BUDGET ? "por encima del" : "dentro del");

// What each card shows after a run.
const RUNS = {
  thrash: () => {
    const { inplace: I, batched: B } = R.thrash, m = top(I.total, B.total);
    return {
      verdict: t("Read, write, read…: " + layoutsEn(I.layouts) + " per frame, " + n0(I.forced) + " of them forced inside the loop; each frame took " + ms(I.total) + ", so the screen updated about " + n0(I.fps) + " times a second. All reads, then all writes: " + layoutsEn(B.layouts) + ", " + ms(B.total) + ", " + n0(B.fps) + " frames a second.",
        "Lee, escribe, lee…: " + layoutsEs(I.layouts) + " por cuadro, " + n0(I.forced) + " de ellos forzados dentro del bucle; cada cuadro tardó " + ms(I.total) + ", así que la pantalla se actualizó unas " + n0(I.fps) + " veces por segundo. Todas las lecturas y luego todas las escrituras: " + layoutsEs(B.layouts) + ", " + ms(B.total) + ", " + n0(B.fps) + " cuadros por segundo."),
      bars: [
        [t("Layouts, interleaved", "Layouts, intercalado"), 1, n0(I.layouts), true],
        [t("Layouts, batched", "Layouts, agrupado"), B.layouts / I.layouts, n0(B.layouts)],
        [t("Frame, interleaved", "Cuadro, intercalado"), I.total / m, ms(I.total), true],
        [t("Frame, batched", "Cuadro, agrupado"), B.total / m, ms(B.total)],
      ],
    };
  },
  scale: () => {
    const { inplace: I, batched: B } = R.scale, m = top(...I.map((x) => x.total));
    const lbl = [t("10 items, 2,000 boxes", "10 ítems, 2,000 cajas"), t("40 items, 2,000 boxes", "40 ítems, 2,000 cajas"), t("40 items, 8,000 boxes", "40 ítems, 8,000 cajas")];
    return {
      verdict: t("Read, write, read…: " + I.map((x) => ms(x.total)).join(" → ") + " per frame. All reads, then all writes: " + B.map((x) => ms(x.total)).join(" → ") + ".",
        "Lee, escribe, lee…: " + I.map((x) => ms(x.total)).join(" → ") + " por cuadro. Todas las lecturas y luego todas las escrituras: " + B.map((x) => ms(x.total)).join(" → ") + "."),
      bars: [
        ...I.map((x, i) => [t("Interleaved, " + lbl[i].en, "Intercalado, " + lbl[i].es), x.total / m, ms(x.total), i === 2]),
        [t("Batched, " + lbl[2].en, "Agrupado, " + lbl[2].es), B[2].total / m, ms(B[2].total)],
      ],
    };
  },
  props: () => {
    const { height: H, color: C, transform: X } = R.props, m = top(H.total, C.total, X.total);
    const paintEn = (x) => (x.paint > 0 ? ms(x.paint) : "none"), paintEs = (x) => (x.paint > 0 ? ms(x.paint) : "nada");
    return {
      verdict: t("Layouts per frame: " + n0(H.layouts) + " writing height, " + n0(C.layouts) + " writing background-color, " + n0(X.layouts) + " writing transform. Paint per frame: " + paintEn(H) + ", " + paintEn(C) + ", " + paintEn(X) + ". Frames took " + ms(H.total) + ", " + ms(C.total) + " and " + ms(X.total) + ".",
        "Layouts por cuadro: " + n0(H.layouts) + " escribiendo height, " + n0(C.layouts) + " escribiendo background-color, " + n0(X.layouts) + " escribiendo transform. Pintado por cuadro: " + paintEs(H) + ", " + paintEs(C) + ", " + paintEs(X) + ". Los cuadros tardaron " + ms(H.total) + ", " + ms(C.total) + " y " + ms(X.total) + "."),
      bars: [
        [t("Frame, height", "Cuadro, height"), H.total / m, ms(H.total)],
        [t("Frame, background-color", "Cuadro, background-color"), C.total / m, ms(C.total), true],
        [t("Frame, transform", "Cuadro, transform"), X.total / m, ms(X.total)],
      ],
    };
  },
  raf: () => {
    const { inplace: I, rafWrite: W, rafBoth: Bo } = R.raf, m = top(I.total, W.total, Bo.total);
    return {
      verdict: t("Layouts per frame: " + n0(I.layouts) + " in the handlers, " + n0(W.layouts) + " with the writes in rAF, " + n0(Bo.layouts) + " with reads and writes in rAF. Frames took " + ms(I.total) + ", " + ms(W.total) + " and " + ms(Bo.total) + ".",
        "Layouts por cuadro: " + n0(I.layouts) + " en los handlers, " + n0(W.layouts) + " con las escrituras en rAF, " + n0(Bo.layouts) + " con lecturas y escrituras en rAF. Los cuadros tardaron " + ms(I.total) + ", " + ms(W.total) + " y " + ms(Bo.total) + "."),
      bars: [
        [t("In the handlers", "En los handlers"), I.total / m, ms(I.total)],
        [t("Writes in rAF", "Escrituras en rAF"), W.total / m, ms(W.total)],
        [t("Reads and writes in rAF", "Lecturas y escrituras en rAF"), Bo.total / m, ms(Bo.total), true],
      ],
    };
  },
  contain: () => {
    const { open: O, contained: C, batched: B, both: Bo } = R.contain, m = top(O.total, C.total, B.total, Bo.total);
    return {
      verdict: t("With contain: strict, still " + layoutsEn(C.layouts) + " per frame, but each covered " + int(C.boxes) + " boxes instead of " + int(O.boxes) + ": the frame went from " + ms(O.total) + " to " + ms(C.total) + ". Batching alone: " + ms(B.total) + ". Both: " + ms(Bo.total) + ".",
        "Con contain: strict, siguen " + layoutsEs(C.layouts) + " por cuadro, pero cada uno cubrió " + int(C.boxes) + " cajas en lugar de " + int(O.boxes) + ": el cuadro pasó de " + ms(O.total) + " a " + ms(C.total) + ". Solo agrupar: " + ms(B.total) + ". Las dos cosas: " + ms(Bo.total) + "."),
      bars: [
        [t("Interleaved", "Intercalado"), O.total / m, ms(O.total)],
        [t("Interleaved + contain", "Intercalado + contain"), C.total / m, ms(C.total), true],
        [t("Batched", "Agrupado"), B.total / m, ms(B.total)],
        [t("Batched + contain", "Agrupado + contain"), Bo.total / m, ms(Bo.total)],
      ],
    };
  },
};

const { thrash: T1, scale: T2, props: T3, raf: T4, contain: T5 } = R;
const [S10, S40, S40big] = T2.inplace;

const EXPERIMENTS = [
  {
    id: "thrash",
    title: t("Read, write, read, write", "Leer, escribir, leer, escribir"),
    change: t("Every frame a handler goes over 40 items on a 2,000-box page: for each it reads offsetHeight, then sets style.height · in that order vs all the reads first, then all the writes",
      "En cada cuadro un handler recorre 40 ítems en una página de 2,000 cajas: para cada uno lee offsetHeight y luego asigna style.height · en ese orden vs primero todas las lecturas y después todas las escrituras"),
    question: t("In the read, write, read… order, how many layouts does one frame cost?", "En el orden lee, escribe, lee…, ¿cuántos layouts cuesta un cuadro?"),
    options: [
      t("One: the browser holds style changes until it draws the frame", "Uno: el navegador guarda los cambios de estilo hasta dibujar el cuadro"),
      t("About one per item: every read after a write lays the page out again", "Más o menos uno por ítem: cada lectura después de una escritura vuelve a hacer el layout de la página"),
      t("Two: one for all the reads and one for all the writes", "Dos: uno para todas las lecturas y otro para todas las escrituras"),
    ],
    answer: 1,
    why: t(
      "The browser does layout lazily: a write only marks layout as out of date, and the frame's own layout settles every change at once, just before paint. But a read like offsetHeight has to return the right number now, so if anything changed since the last layout, the browser lays the page out on the spot, in the middle of your script: a forced synchronous layout. In the read, write, read… order every read after the first finds the previous item's write and forces one: " + n0(T1.inplace.forced) + " forced plus the frame's own, " + n0(T1.inplace.layouts) + " in all, and the frame took " + ms(T1.inplace.total) + " against a " + BUD + " budget. Batched, the reads all find layout up to date, the writes all just mark it, and the frame lays out once: " + ms(T1.batched.total) + ".",
      "El navegador hace el layout de forma perezosa: una escritura solo marca el layout como desactualizado, y el layout propio del cuadro resuelve todos los cambios de una vez, justo antes de pintar. Pero una lectura como offsetHeight tiene que devolver el número correcto ya, así que si algo cambió desde el último layout, el navegador hace el layout de la página en el acto, en medio de tu script: un layout síncrono forzado. En el orden lee, escribe, lee… cada lectura después de la primera encuentra la escritura del ítem anterior y fuerza uno: " + n0(T1.inplace.forced) + " forzados más el propio del cuadro, " + n0(T1.inplace.layouts) + " en total, y el cuadro tardó " + ms(T1.inplace.total) + " contra un presupuesto de " + BUD + ". Agrupado, todas las lecturas encuentran el layout al día, todas las escrituras solo lo marcan, y el cuadro hace un solo layout: " + ms(T1.batched.total) + ".",
    ),
    watch: { pattern: "inplace", prop: "height", items: 40, dom: 2000, contain: "none", speed: 4 },
  },
  {
    id: "scale",
    title: t("More items, a bigger page", "Más ítems, una página más grande"),
    change: t("The read, write, read… loop · 10 items → 40 items on a 2,000-box page, then 40 items on an 8,000-box page",
      "El bucle lee, escribe, lee… · 10 ítems → 40 ítems en una página de 2,000 cajas, luego 40 ítems en una página de 8,000 cajas"),
    question: t("How does the cost of one frame grow?", "¿Cómo crece el costo de un cuadro?"),
    options: [
      t("With the items only: 4× the items, 4× the cost; the page size doesn't matter", "Solo con los ítems: 4× los ítems, 4× el costo; el tamaño de la página no importa"),
      t("With items × page size: 4× the items, then 4× the page, about 16× in all", "Con ítems × tamaño de la página: 4× los ítems, luego 4× la página, unas 16× en total"),
      t("Hardly at all: after the first layout the browser reuses its measurements", "Casi nada: después del primer layout el navegador reutiliza sus medidas"),
    ],
    answer: 1,
    why: t(
      "Every forced layout pays for every box in its scope, and nothing here limits the scope, so it is the whole page. The loop costs one layout per item, so the frame grows with items × page size: 4× the items took it from " + ms(S10.total) + " to " + ms(S40.total) + ", and a 4× bigger page multiplied it again, to " + ms(S40big.total) + ". The last layout can't simply be reused, because each write changed the geometry the next read asks about. Batching pays for one layout per frame whatever the item count, so only the page size moves it: " + T2.batched.map((x) => ms(x.total)).join(" → ") + ". It doesn't make a big page free: at 8,000 boxes even one layout per frame took " + ms(T2.batched[2].total) + ", " + vsEn(T2.batched[2].total) + " the " + BUD + " budget. Real engines skip parts of the tree they know are unchanged, so their growth is gentler than this model's, but a bigger, deeper page still costs more to lay out.",
      "Cada layout forzado paga por cada caja en su alcance, y aquí nada limita el alcance, así que es toda la página. El bucle cuesta un layout por ítem, así que el cuadro crece con ítems × tamaño de la página: 4× los ítems lo llevaron de " + ms(S10.total) + " a " + ms(S40.total) + ", y una página 4× más grande lo multiplicó otra vez, hasta " + ms(S40big.total) + ". El último layout no se puede reutilizar sin más, porque cada escritura cambió la geometría que pregunta la siguiente lectura. Agrupar paga un solo layout por cuadro sin importar cuántos ítems haya, así que solo lo mueve el tamaño de la página: " + T2.batched.map((x) => ms(x.total)).join(" → ") + ". No vuelve gratis una página grande: con 8,000 cajas, incluso un layout por cuadro tardó " + ms(T2.batched[2].total) + ", " + vsEs(T2.batched[2].total) + " presupuesto de " + BUD + ". Los motores reales se saltan las partes del árbol que saben que no cambiaron, así que crecen más suave que este modelo, pero una página más grande y más profunda sigue costando más de acomodar.",
    ),
    watch: { pattern: "inplace", prop: "height", items: 40, dom: 8000, contain: "none", speed: 16 },
  },
  {
    id: "props",
    title: t("Write a colour instead", "Escribe un color en su lugar"),
    change: t("The same read, write, read… loop, 40 items, 2,000 boxes · each write sets height, background-color, or transform (on an element with will-change: transform)",
      "El mismo bucle lee, escribe, lee…, 40 ítems, 2,000 cajas · cada escritura cambia height, background-color o transform (en un elemento con will-change: transform)"),
    question: t("With background-color instead of height, still with a read after every write: how many layouts per frame?",
      "Con background-color en lugar de height, todavía con una lectura después de cada escritura: ¿cuántos layouts por cuadro?"),
    options: [
      t("Still about one per item: any style change followed by a read forces a layout", "Todavía más o menos uno por ítem: cualquier cambio de estilo seguido de una lectura fuerza un layout"),
      t("None: a colour moves nothing, so the reads find layout up to date; the frame still repaints", "Ninguno: un color no mueve nada, así que las lecturas encuentran el layout al día; el cuadro igual vuelve a pintar"),
      t("Just one, at the end of the frame, like the batched loop", "Solo uno, al final del cuadro, como el bucle agrupado"),
    ],
    answer: 1,
    why: t(
      "A read forces only the work that is out of date. height changes geometry, so it marks layout dirty and the next read pays for a layout. background-color changes how boxes look, not where they are: the read still brings style up to date (" + ms(T3.color.style) + " a frame here) but layout stays valid, and the frame repaints only the changed items (" + ms(T3.color.paint) + "). transform on an element with its own layer skips layout and paint: the compositor just moves the layer. Layouts per frame: " + n0(T3.height.layouts) + ", " + n0(T3.color.layouts) + " and " + n0(T3.transform.layouts) + ". The order still matters for geometry: change a size or a position and the reads are back to forcing layouts.",
      "Una lectura fuerza solo el trabajo que está desactualizado. height cambia la geometría, así que marca el layout como sucio y la siguiente lectura paga un layout. background-color cambia cómo se ven las cajas, no dónde están: la lectura igual pone el estilo al día (" + ms(T3.color.style) + " por cuadro aquí) pero el layout sigue válido, y el cuadro vuelve a pintar solo los ítems que cambiaron (" + ms(T3.color.paint) + "). transform en un elemento con su propia capa se salta el layout y el pintado: el compositor solo mueve la capa. Layouts por cuadro: " + n0(T3.height.layouts) + ", " + n0(T3.color.layouts) + " y " + n0(T3.transform.layouts) + ". El orden sigue importando para la geometría: cambia un tamaño o una posición y las lecturas vuelven a forzar layouts.",
    ),
    watch: { pattern: "inplace", prop: "color", items: 40, dom: 2000, contain: "none", speed: 1 },
  },
  {
    id: "raf",
    title: t("Move it into requestAnimationFrame", "Muévelo a requestAnimationFrame"),
    change: t("40 independent widgets handle the same scroll event; each reads its own height and writes a new one · in the handler, with only the write deferred to requestAnimationFrame, or with both deferred",
      "40 widgets independientes manejan el mismo evento de scroll; cada uno lee su propia altura y escribe una nueva · en el handler, con solo la escritura diferida a requestAnimationFrame, o con las dos diferidas"),
    question: t("Each widget moves both its read and its write into a requestAnimationFrame callback. How many layouts per frame?",
      "Cada widget mueve su lectura y su escritura a un callback de requestAnimationFrame. ¿Cuántos layouts por cuadro?"),
    options: [
      t("One: rAF callbacks run together just before the frame's layout, so they're batched", "Uno: los callbacks de rAF corren juntos justo antes del layout del cuadro, así que quedan agrupados"),
      t("About one per widget again: the callbacks still run one after another, read, write, read, write", "Más o menos uno por widget otra vez: los callbacks igual corren uno tras otro, lee, escribe, lee, escribe"),
      t("None: rAF callbacks run after layout and paint", "Ninguno: los callbacks de rAF corren después del layout y el pintado"),
    ],
    answer: 1,
    why: t(
      "requestAnimationFrame runs its callbacks just before the browser's style and layout for the next frame. Deferring only the writes works: every read runs in the handlers against an up-to-date layout, every write lands in rAF, and the frame lays out once (" + layoutsEn(T4.rafWrite.layouts) + ", " + ms(T4.rafWrite.total) + "). But rAF doesn't reorder anything: if each callback reads and then writes, the second callback's read comes after the first one's write and forces a layout, exactly as in the handlers (" + layoutsEn(T4.rafBoth.layouts) + ", " + ms(T4.rafBoth.total) + "). What fixes thrashing is the order, reads before writes; rAF is a good place to put the writes.",
      "requestAnimationFrame corre sus callbacks justo antes del estilo y el layout del navegador para el siguiente cuadro. Diferir solo las escrituras funciona: todas las lecturas corren en los handlers contra un layout al día, todas las escrituras caen en rAF, y el cuadro hace un solo layout (" + layoutsEs(T4.rafWrite.layouts) + ", " + ms(T4.rafWrite.total) + "). Pero rAF no reordena nada: si cada callback lee y después escribe, la lectura del segundo callback viene después de la escritura del primero y fuerza un layout, igual que en los handlers (" + layoutsEs(T4.rafBoth.layouts) + ", " + ms(T4.rafBoth.total) + "). Lo que arregla el thrashing es el orden, lecturas antes que escrituras; rAF es un buen lugar para poner las escrituras.",
    ),
    watch: { pattern: "rafBoth", prop: "height", items: 40, dom: 2000, contain: "none", speed: 4 },
  },
  {
    id: "contain",
    title: t("Fence the list off", "Aísla la lista"),
    change: t("The read, write, read… loop, 40 items, on an 8,000-box page · no containment vs contain: strict on the list",
      "El bucle lee, escribe, lee…, 40 ítems, en una página de 8,000 cajas · sin contención vs contain: strict en la lista"),
    question: t("With contain: strict on the list and the same loop, what changes?", "Con contain: strict en la lista y el mismo bucle, ¿qué cambia?"),
    options: [
      t("The forced layouts go away: a contained element is laid out later, on its own", "Los layouts forzados desaparecen: un elemento contenido se acomoda después, por separado"),
      t("Still one forced layout per item, but each covers only the list, so the frame gets far cheaper", "Sigue habiendo un layout forzado por ítem, pero cada uno cubre solo la lista, así que el cuadro sale mucho más barato"),
      t("Nothing: layout always covers the whole document", "Nada: el layout siempre cubre todo el documento"),
    ],
    answer: 1,
    why: t(
      "contain: strict promises that nothing inside the list changes the size or layout of anything outside it, and that the list's own size doesn't depend on its content, so the browser can lay out just the list. It doesn't change when layouts happen: every read after a write still forces one, " + layoutsEn(T5.contained.layouts) + " a frame. Each now covers " + int(T5.contained.boxes) + " boxes instead of " + int(T5.open.boxes) + ", and the frame drops from " + ms(T5.open.total) + " to " + ms(T5.contained.total) + ". Batching attacks the count instead (" + ms(T5.batched.total) + "); the two together: " + ms(T5.both.total) + ".",
      "contain: strict promete que nada dentro de la lista cambia el tamaño ni el layout de nada fuera de ella, y que el tamaño de la lista no depende de su contenido, así que el navegador puede acomodar solo la lista. No cambia cuándo ocurren los layouts: cada lectura después de una escritura sigue forzando uno, " + layoutsEs(T5.contained.layouts) + " por cuadro. Ahora cada uno cubre " + int(T5.contained.boxes) + " cajas en lugar de " + int(T5.open.boxes) + ", y el cuadro baja de " + ms(T5.open.total) + " a " + ms(T5.contained.total) + ". Agrupar ataca la cantidad (" + ms(T5.batched.total) + "); las dos cosas juntas: " + ms(T5.both.total) + ".",
    ),
    watch: { pattern: "inplace", prop: "height", items: 40, dom: 8000, contain: "strict", speed: 1 },
  },
];

const QUESTIONS = [
  [t("What is a forced synchronous layout, and why does reading after writing cause one?", "¿Qué es un layout síncrono forzado y por qué lo provoca leer después de escribir?"),
    t("The browser normally brings style and layout up to date once per frame, just before paint; a style write only marks them out of date. A read of geometry, such as offsetHeight, offsetTop, clientWidth, scrollTop or getBoundingClientRect(), must return a correct value, so if layout is out of date the browser runs it right there, synchronously, inside your JavaScript. One forced layout isn't a disaster: if nothing changes afterwards, the frame's own layout has nothing left to do. One per item in a loop is thrashing.",
      "Normalmente el navegador pone al día el estilo y el layout una vez por cuadro, justo antes de pintar; una escritura de estilo solo los marca como desactualizados. Una lectura de geometría, como offsetHeight, offsetTop, clientWidth, scrollTop o getBoundingClientRect(), debe devolver un valor correcto, así que si el layout está desactualizado el navegador lo hace ahí mismo, de forma síncrona, dentro de tu JavaScript. Un layout forzado no es un desastre: si después no cambia nada, al layout del cuadro no le queda trabajo. Uno por ítem en un bucle es thrashing.")],
  [t("Sort these by the work a change causes: width, top, margin, color, background-color, box-shadow, transform, opacity.", "Ordena estos según el trabajo que causa cambiarlos: width, top, margin, color, background-color, box-shadow, transform, opacity."),
    t("width, top and margin change geometry: layout, then paint. color, background-color and box-shadow change how pixels look, not where boxes are: paint, no layout. transform and opacity don't move other boxes, so they normally skip layout, and on an element with its own compositor layer (will-change: transform or will-change: opacity) they skip paint too: the compositor moves or fades the layer. That is why transform and opacity are the properties to animate. Details vary a little between browsers, so confirm in a Performance recording.",
      "width, top y margin cambian la geometría: layout y luego pintado. color, background-color y box-shadow cambian cómo se ven los píxeles, no dónde están las cajas: pintado, sin layout. transform y opacity no mueven otras cajas, así que normalmente se saltan el layout, y en un elemento con su propia capa del compositor (will-change: transform o will-change: opacity) también se saltan el pintado: el compositor mueve o desvanece la capa. Por eso transform y opacity son las propiedades para animar. Los detalles varían un poco entre navegadores, así que confírmalo en una grabación de rendimiento (Performance).")],
  [t("Reads and writes come from separate components you can't merge into one loop. How do you stop them from thrashing?", "Las lecturas y escrituras vienen de componentes separados que no puedes juntar en un solo bucle. ¿Cómo evitas que hagan thrashing?"),
    t("Split each component's work into a read phase and a write phase, and run every read before any write: read in the event handler and defer the write with requestAnimationFrame, or use a small scheduler that queues reads and writes separately and runs the reads first (fastdom is a well-known one). Wrapping everything in requestAnimationFrame doesn't help by itself: callbacks that each read and then write still interleave.",
      "Divide el trabajo de cada componente en una fase de lectura y una de escritura, y corre todas las lecturas antes que cualquier escritura: lee en el handler del evento y difiere la escritura con requestAnimationFrame, o usa un pequeño planificador que encole lecturas y escrituras por separado y corra primero las lecturas (fastdom es uno conocido). Envolver todo en requestAnimationFrame no ayuda por sí solo: los callbacks que leen y luego escriben siguen intercalándose.")],
  [t("A Performance recording shows a long task with dozens of Layout blocks inside your function. What are you looking at, and where do you look for the cause?", "Una grabación de rendimiento muestra una tarea larga con decenas de bloques de Layout dentro de tu función. ¿Qué estás viendo y dónde buscas la causa?"),
    t("Layouts that run inside a script's task, instead of once in the frame's rendering steps, are forced layouts; Chrome DevTools flags them as forced reflows. Each one sits right after a geometry read that followed a style write, so look for a loop that measures and changes elements in turn (often in two different helpers), and reorder it so all the measuring comes first.",
      "Los layouts que corren dentro de la tarea de un script, en lugar de una vez en los pasos de renderizado del cuadro, son layouts forzados; las DevTools de Chrome los marcan como reflows forzados (forced reflow). Cada uno aparece justo después de una lectura de geometría que siguió a una escritura de estilo, así que busca un bucle que mida y cambie elementos por turnos (a menudo en dos helpers distintos) y reordénalo para que primero se mida todo.")],
  [t("When does CSS containment help, and what does it cost you?", "¿Cuándo ayuda la contención de CSS y qué te cuesta?"),
    t("When a self-contained part of the page (a widget, a list, a feed card) changes often. contain: content (layout, paint and style containment) or contain: strict (which adds size containment) tells the browser that changes inside can't affect anything outside, so it can lay out and paint just that part. It shrinks each layout; it doesn't remove forced layouts, so fix the read and write order too. Size containment means the box no longer grows with its content, so it needs an explicit size. For long pages, content-visibility: auto goes further and skips layout and paint for sections that are off screen.",
      "Cuando una parte autónoma de la página (un widget, una lista, una tarjeta de un feed) cambia seguido. contain: content (contención de layout, pintado y estilo) o contain: strict (que agrega contención de tamaño) le dice al navegador que los cambios de adentro no pueden afectar nada afuera, así que puede acomodar y pintar solo esa parte. Achica cada layout; no elimina los layouts forzados, así que también arregla el orden de lecturas y escrituras. La contención de tamaño hace que la caja ya no crezca con su contenido, así que necesita un tamaño explícito. En páginas largas, content-visibility: auto va más allá y se salta el layout y el pintado de las secciones fuera de pantalla.")],
  [t("How does layout thrashing show up in what users feel and in Core Web Vitals?", "¿Cómo se nota el layout thrashing en lo que sienten los usuarios y en las Core Web Vitals?"),
    t("Interaction to Next Paint (INP) measures how long the page takes to show the next frame after a click, tap or key press. A handler that thrashes keeps the main thread busy before that frame can be drawn, so INP goes up; during scrolling or an animation it shows as dropped frames instead. The event loop lesson (16) shows the same main thread from the task side, and the throttle lesson (32) cuts how often a handler runs; neither helps if each run still interleaves reads and writes.",
      "Interaction to Next Paint (INP) mide cuánto tarda la página en mostrar el siguiente cuadro después de un clic, un toque o una tecla. Un handler que hace thrashing mantiene ocupado el hilo principal antes de que se pueda dibujar ese cuadro, así que el INP sube; durante un scroll o una animación se nota como cuadros perdidos. La lección del bucle de eventos (16) muestra el mismo hilo principal desde el lado de las tareas, y la del throttle (32) reduce cuántas veces corre un handler; ninguna ayuda si cada ejecución sigue intercalando lecturas y escrituras.")],
];

export default defineLesson({
  title: t("Layout Thrashing Workbench", "Banco de trabajo: layout thrashing"),
  eyebrow: t("Systems lesson 52 · Layout thrashing", "Lección de sistemas 52 · Layout thrashing"),
  lede: t("A browser lays out the page lazily: a style change only marks layout as out of date, and the page is measured once, just before the next frame. Reading a size or position after a change forces that layout on the spot, so reading and writing in turn across a list forces one per item. This lesson builds that as a machine: watch it, predict what breaks it, then explain it back.",
    "Un navegador hace el layout de la página de forma perezosa: un cambio de estilo solo marca el layout como desactualizado, y la página se mide una sola vez, justo antes del siguiente cuadro. Leer un tamaño o una posición después de un cambio fuerza ese layout en el acto, así que leer y escribir por turnos a lo largo de una lista fuerza uno por ítem (layout thrashing). Esta lección lo arma como una máquina: mírala, predice qué la rompe y luego explícalo."),
  machine: {
    intro: t("Every frame the clerk goes through the list: a READ measures an item, a WRITE changes its style. Each pass of the gantry over the galley is one layout, and it lights when a read forced it in the middle of the script. The strip on the right keeps one bar per frame against the 16.7 ms line. Time runs slow: one 16.7 ms frame takes about a second at ×1.",
      "En cada cuadro el empleado recorre la lista: una LECTURA mide un ítem, una ESCRITURA le cambia el estilo. Cada pasada del pórtico sobre la bandeja es un layout, y se ilumina cuando una lectura lo forzó en medio del script. La tira de la derecha guarda una barra por cuadro contra la línea de 16.7 ms. El tiempo corre lento: un cuadro de 16.7 ms tarda más o menos un segundo en ×1."),
    plate: {
      title: t("Typesetting bench", "Banco de tipografía"),
      keys: [
        { mark: "lit", label: t("A forced layout: the gantry and the item whose read forced it; the step running now; frames over 16.7 ms", "Un layout forzado: el pórtico y el ítem cuya lectura lo forzó; el paso que corre ahora; cuadros de más de 16.7 ms") },
        { mark: "raised", label: t("Blocks are boxes on the page; the big front ones are the list's items", "Los bloques son cajas de la página; los grandes del frente son los ítems de la lista") },
        { mark: "flat", label: t("The gantry: one pass is one layout, over the page or, fenced, the list", "El pórtico: una pasada es un layout, sobre la página o, con la cerca, sobre la lista") },
      ],
      caption: t(
        "A write only marks style, and for a geometry change layout, as out of date. A read needs current geometry, so if layout is out of date the gantry makes a pass right then; otherwise layout waits for the end of the frame, where style, layout, paint and composite run in that order. Model costs: a layout is " + ms(COST.layoutBase) + " plus " + us(COST.layoutBox) + " per box in its scope, a style update " + us(COST.styleEach) + " per changed element, paint " + us(COST.paintBox) + " per repainted box, each varying ±" + n0(JITTER * 100) + "% between runs. Real costs depend on the browser, the device and the CSS. A small page fills the front of the galley; 8,000 boxes fill it to the back. The fence is contain: strict on the list.",
        "Una escritura solo marca como desactualizado el estilo y, si cambia la geometría, el layout. Una lectura necesita la geometría al día, así que si el layout está desactualizado el pórtico hace una pasada en ese momento; si no, el layout espera al final del cuadro, donde corren el estilo, el layout, el pintado y la composición, en ese orden. Costos del modelo: un layout cuesta " + ms(COST.layoutBase) + " más " + us(COST.layoutBox) + " por caja en su alcance, una actualización de estilo " + us(COST.styleEach) + " por elemento cambiado, el pintado " + us(COST.paintBox) + " por caja repintada, y cada uno varía ±" + n0(JITTER * 100) + "% entre ejecuciones. Los costos reales dependen del navegador, el dispositivo y el CSS. Una página chica llena el frente de la bandeja; 8,000 cajas la llenan hasta el fondo. La cerca es contain: strict en la lista.",
      ),
      stage: { "data-bench": "" },
      label: t("Layout thrashing simulation. Space pauses or resumes.", "Simulación de layout thrashing. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["frame", t("Last frame", "Último cuadro"), "–"],
      ["layouts", t("Layouts per frame", "Layouts por cuadro"), "–"],
      ["forced", t("Forced layouts", "Layouts forzados"), "–"],
      ["layoutMs", t("Layout time", "Tiempo de layout"), "–"],
      ["fps", t("Frames per second", "Cuadros por segundo"), "–"],
      ["over", t("Frames over 16.7 ms", "Cuadros de más de 16.7 ms"), "–"],
    ],
    controls: [
      { seg: "pattern", label: t("Loop", "Bucle"), options: [["inplace", t("Read, write, read…", "Lee, escribe, lee…")], ["batched", t("All reads, then writes", "Lecturas, luego escrituras")], ["rafWrite", t("Writes in rAF", "Escrituras en rAF")], ["rafBoth", t("Both in rAF", "Ambas en rAF")]], value: "inplace" },
      { seg: "prop", label: t("Each write sets", "Cada escritura cambia"), options: [["height", "height"], ["color", "background-color"], ["transform", "transform"]], value: "height" },
      { seg: "items", label: t("Items", "Ítems"), options: [[10, "10"], [40, "40"], [100, "100"]], value: 40 },
      { seg: "dom", label: t("Page", "Página"), options: [[500, t("500 boxes", "500 cajas")], [2000, t("2,000 boxes", "2,000 cajas")], [8000, t("8,000 boxes", "8,000 cajas")]], value: 2000 },
      { seg: "contain", label: t("List", "Lista"), options: [["none", t("No containment", "Sin contención")], ["strict", "contain: strict"]], value: "none" },
      { speed: true, options: [[0.25, "×0.25"], [1, "×1"], [4, "×4"], [16, "×16"]], value: 1 },
      { actions: [["stray", t("Sneak in a read", "Colar una lectura")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Changing a setting starts the run again. “Sneak in a read” makes some other code read the first item's height halfway through the next frame's writes. transform is written to an element with will-change: transform, on its own layer.",
      "Cambiar un ajuste reinicia la corrida. “Colar una lectura” hace que otro código lea la altura del primer ítem a mitad de las escrituras del siguiente cuadro. transform se escribe en un elemento con will-change: transform, en su propia capa.",
    ),
  },
  predict: {
    intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs of " + FRAMES + " frames each.",
      "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija de " + FRAMES + " cuadros cada una."),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; its costs are a model, not measurements of any browser.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; sus costos son un modelo, no mediciones de ningún navegador.`),
  css: LIT_FILL_CSS,
  data: {
    P,
    G: GEOMETRY,
  },
});
