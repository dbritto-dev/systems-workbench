// @ts-nocheck: content in the style of the other lessons
// Systems lesson 51 · Frame budget: a conveyor that is a time line, a main thread that lays its work onto it, and a
// card at every vsync that got a new picture.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { averageOver, rankQuantile, mean } from "../../lib/stats";
import { pct } from "../../lib/format";
import { buildFigure, ribSvg, cardSvg, pennantSvg, P, GEOMETRY } from "./figure";
import { measure, makePage, latencyOf, JOB, COST, STEP } from "./sim";

// ---------- experiment results, computed at build time from the model the machine runs ----------
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const RUN_MS = 10000;
const avg = (cfg) => averageOver(SEEDS, (seed) => measure(cfg, seed, RUN_MS));
// INP is judged per visit (its slowest interaction, ignoring one in 50), then at the 75th percentile of visits.
const VISITS = 200, VISIT_MS = 20000, CLICK_RATE = 0.5;
function visits(cfg) {
  const inps = [], lats = [];
  for (let seed = 1; seed <= VISITS; seed++) {
    const m = measure({ ...cfg, clicks: CLICK_RATE }, seed, VISIT_MS);
    inps.push(m.inp);
    const page = makePage({ ...cfg, clicks: CLICK_RATE }, seed);
    page.runTo(VISIT_MS);
    for (const c of page.clicks) { const l = latencyOf(c); if (l !== null) lats.push(l); }
  }
  return { p75: rankQuantile(inps, 0.75), mean: mean(lats), slowShare: lats.filter((l) => l > 200).length / lats.length };
}
const base = { hz: 60, driver: "raf", prop: "transform" };
const R = {
  long: { raf: avg({ ...base, work: "long" }), css: avg({ ...base, driver: "css", work: "long" }) },
  inp: { busy: visits({ ...base, work: "long" }), calm: visits({ ...base, work: "none" }) },
  timer: { timer60: avg({ ...base, driver: "timer" }), raf60: avg(base), timer120: avg({ ...base, driver: "timer", hz: 120 }), raf120: avg({ ...base, hz: 120 }) },
  hz: { left60: avg({ ...base, prop: "left" }), left120: avg({ ...base, prop: "left", hz: 120 }), tf120: avg({ ...base, hz: 120 }) },
  chunk: { whole: avg({ ...base, work: "long" }), c50: avg({ ...base, work: "chunk50" }), c5: avg({ ...base, work: "chunk5" }) },
};

const ms = (x) => (x < 10 ? (Math.round(x * 10) / 10).toFixed(1) : String(Math.round(x))) + " ms";
const n1 = (x) => { const r = Math.round(x * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const n0 = (x) => String(Math.round(x));
const top = (...xs) => Math.max(...xs) * 1.08;
const BUDGET60 = ms(1000 / 60), BUDGET120 = ms(1000 / 120);
const TICKS_IN_JOB = Math.round(JOB.size / (1000 / 60));
const LEFT_FRAME = COST.js + COST.style.left + COST.layout.left + COST.paint.left;
const TF_FRAME = COST.js + COST.style.transform;
const verdictINP = (x) => (x <= 200 ? t("within the 200 ms “good” line", "dentro de la línea de “bueno” de 200 ms") : x <= 500 ? t("past the 200 ms “good” line", "pasada la línea de “bueno” de 200 ms") : t("past 500 ms, “poor”", "pasados los 500 ms, “malo”"));

// What each card shows after a run.
const RUNS = {
  long: () => {
    const { raf, css } = R.long, m = top(raf.missedPerJob, TICKS_IN_JOB);
    return { verdict: t("Each " + JOB.size + " ms task covered about " + TICKS_IN_JOB + " vsyncs, and the rAF animation missed " + n1(raf.missedPerJob) + " frames per task. The same animation done in CSS on transform missed " + n1(css.missedPerJob) + ".",
        "Cada tarea de " + JOB.size + " ms cubrió unos " + TICKS_IN_JOB + " vsyncs, y la animación con rAF perdió " + n1(raf.missedPerJob) + " frames por tarea. La misma animación hecha en CSS sobre transform perdió " + n1(css.missedPerJob) + "."),
      bars: [[t("Vsyncs during a task", "Vsyncs durante una tarea"), TICKS_IN_JOB / m, String(TICKS_IN_JOB)], [t("Missed, rAF animation", "Perdidos, animación con rAF"), raf.missedPerJob / m, n1(raf.missedPerJob), true], [t("Missed, CSS transform animation", "Perdidos, animación CSS de transform"), css.missedPerJob / m, n1(css.missedPerJob)]] };
  },
  inp: () => {
    const { busy, calm } = R.inp, m = top(busy.p75, calm.p75, busy.mean, 200);
    return { verdict: t("The average click took " + ms(busy.mean) + " from input to paint, but the page's INP at p75 of " + VISITS + " visits was " + ms(busy.p75) + ", " + verdictINP(busy.p75).en + ". Without the busy task it was " + ms(calm.p75) + ".",
        "El clic promedio tardó " + ms(busy.mean) + " de la entrada a la pintura, pero el INP de la página en el p75 de " + VISITS + " visitas fue " + ms(busy.p75) + ", " + verdictINP(busy.p75).es + ". Sin la tarea pesada fue " + ms(calm.p75) + "."),
      bars: [[t("Average click, busy page", "Clic promedio, página ocupada"), busy.mean / m, ms(busy.mean)], [t("INP p75, busy page", "INP p75, página ocupada"), busy.p75 / m, ms(busy.p75), true], [t("INP p75, no busy task", "INP p75, sin tarea pesada"), calm.p75 / m, ms(calm.p75)]] };
  },
  timer: () => {
    const { timer60, raf60, timer120, raf120 } = R.timer;
    return { verdict: t("setTimeout(step, " + STEP + ") moved the ball " + n0(timer60.updatesPerSec) + " times a second, so " + pct(timer60.missedShare) + " of frames repeated the last picture at 60 Hz and " + pct(timer120.missedShare) + " at 120 Hz. requestAnimationFrame repeated " + pct(raf60.missedShare) + " and " + pct(raf120.missedShare) + ".",
        "setTimeout(step, " + STEP + ") movió la bola " + n0(timer60.updatesPerSec) + " veces por segundo, así que el " + pct(timer60.missedShare) + " de los frames repitió la imagen anterior a 60 Hz y el " + pct(timer120.missedShare) + " a 120 Hz. requestAnimationFrame repitió el " + pct(raf60.missedShare) + " y el " + pct(raf120.missedShare) + "."),
      bars: [[t("Repeated frames, setTimeout, 60 Hz", "Frames repetidos, setTimeout, 60 Hz"), timer60.missedShare, pct(timer60.missedShare)], [t("Repeated frames, setTimeout, 120 Hz", "Frames repetidos, setTimeout, 120 Hz"), timer120.missedShare, pct(timer120.missedShare), true], [t("Repeated frames, rAF, 60 and 120 Hz", "Frames repetidos, rAF, 60 y 120 Hz"), Math.max(raf60.missedShare, raf120.missedShare), pct(Math.max(raf60.missedShare, raf120.missedShare))]] };
  },
  hz: () => {
    const { left60, left120, tf120 } = R.hz, m = 120;
    return { verdict: t("Animating left: " + n0(left60.fps) + " new frames a second at 60 Hz, " + n0(left120.fps) + " at 120 Hz (" + pct(left120.missedShare) + " of vsyncs missed). Animating transform at 120 Hz: " + n0(tf120.fps) + ".",
        "Animando left: " + n0(left60.fps) + " frames nuevos por segundo a 60 Hz, " + n0(left120.fps) + " a 120 Hz (" + pct(left120.missedShare) + " de los vsyncs perdidos). Animando transform a 120 Hz: " + n0(tf120.fps) + "."),
      bars: [[t("New frames / s, left, 60 Hz", "Frames nuevos / s, left, 60 Hz"), left60.fps / m, n0(left60.fps)], [t("New frames / s, left, 120 Hz", "Frames nuevos / s, left, 120 Hz"), left120.fps / m, n0(left120.fps), true], [t("New frames / s, transform, 120 Hz", "Frames nuevos / s, transform, 120 Hz"), tf120.fps / m, n0(tf120.fps)]] };
  },
  chunk: () => {
    const { whole, c50, c5 } = R.chunk, m = top(whole.missedPerJob), mj = top(whole.jobMs, c5.jobMs);
    return { verdict: t("Frames missed per run of the work: " + n1(whole.missedPerJob) + " as one task, " + n1(c50.missedPerJob) + " in 50 ms chunks, " + n1(c5.missedPerJob) + " in 5 ms chunks. The work took " + ms(whole.jobMs) + ", " + ms(c50.jobMs) + " and " + ms(c5.jobMs) + " from start to finish.",
        "Frames perdidos por cada corrida del trabajo: " + n1(whole.missedPerJob) + " como una sola tarea, " + n1(c50.missedPerJob) + " en pedazos de 50 ms, " + n1(c5.missedPerJob) + " en pedazos de 5 ms. El trabajo tardó " + ms(whole.jobMs) + ", " + ms(c50.jobMs) + " y " + ms(c5.jobMs) + " de principio a fin."),
      bars: [[t("Missed, one task", "Perdidos, una tarea"), whole.missedPerJob / m, n1(whole.missedPerJob)], [t("Missed, 50 ms chunks", "Perdidos, pedazos de 50 ms"), c50.missedPerJob / m, n1(c50.missedPerJob), true], [t("Missed, 5 ms chunks", "Perdidos, pedazos de 5 ms"), c5.missedPerJob / m, n1(c5.missedPerJob)], [t("Work done after, 5 ms chunks", "Trabajo terminado tras, pedazos de 5 ms"), c5.jobMs / mj, ms(c5.jobMs)]] };
  },
};

const { long: R1, inp: R2, timer: R3, hz: R4, chunk: R5 } = R;

const EXPERIMENTS = [
  {
    id: "long",
    title: t("One long task", "Una tarea larga"),
    change: t("A requestAnimationFrame loop moves the ball with transform · once a second a " + JOB.size + " ms task runs (rendering a long list, say) · 60 Hz",
      "Un bucle de requestAnimationFrame mueve la bola con transform · una vez por segundo corre una tarea de " + JOB.size + " ms (renderizar una lista larga, por ejemplo) · 60 Hz"),
    question: t("While the " + JOB.size + " ms task runs, how many frames does the screen miss?", "Mientras corre la tarea de " + JOB.size + " ms, ¿cuántos frames pierde la pantalla?"),
    options: [
      t("One: the frame that was due when the task started", "Uno: el frame que tocaba cuando empezó la tarea"),
      t("Every frame while it runs: more than a dozen", "Todos los frames mientras corre: más de una docena"),
      t("None: the browser paints on another thread", "Ninguno: el navegador pinta en otro hilo"),
    ],
    answer: 1,
    why: t(
      "A frame's JavaScript, style, layout and paint run on the main thread, between tasks, and a running task can't be interrupted. So every vsync during the task finds the thread busy and the screen shows the old picture again: " + JOB.size + " ms is about " + TICKS_IN_JOB + " vsyncs at 60 Hz, and the model missed " + n1(R1.raf.missedPerJob) + " frames per task. When the task ends, one frame catches up and the ball jumps. The exception is the last bar: a CSS animation of transform can run on the compositor thread, so it kept moving through the task (" + n1(R1.css.missedPerJob) + " missed). Anything that needs the main thread, such as answering a click, still waits.",
      "El JavaScript, el estilo, el layout y la pintura de un frame corren en el hilo principal, entre tareas, y una tarea en curso no se puede interrumpir. Así que cada vsync durante la tarea encuentra el hilo ocupado y la pantalla vuelve a mostrar la imagen anterior: " + JOB.size + " ms son unos " + TICKS_IN_JOB + " vsyncs a 60 Hz, y el modelo perdió " + n1(R1.raf.missedPerJob) + " frames por tarea. Cuando la tarea termina, un frame se pone al día y la bola salta. La excepción es la última barra: una animación CSS de transform puede correr en el hilo del compositor, así que siguió moviéndose durante la tarea (" + n1(R1.css.missedPerJob) + " perdidos). Todo lo que necesita el hilo principal, como responder a un clic, igual espera.",
    ),
    watch: { hz: "60", driver: "raf", prop: "transform", work: "long" },
  },
  {
    id: "inp",
    title: t("A fast handler on a busy page", "Un handler rápido en una página ocupada"),
    change: t("The same page · the click handler takes " + COST.handler + " ms · a visitor clicks about every " + n0(1 / CLICK_RATE) + " s · " + VISITS + " visits of " + VISIT_MS / 1000 + " s each",
      "La misma página · el handler del clic tarda " + COST.handler + " ms · cada visitante hace clic más o menos cada " + n0(1 / CLICK_RATE) + " s · " + VISITS + " visitas de " + VISIT_MS / 1000 + " s cada una"),
    question: t("What is the page's INP, at the 75th percentile of visits?", "¿Cuál es el INP de la página, en el percentil 75 de las visitas?"),
    options: [
      t("About two frames: the handler is quick, so its result paints right away", "Unos dos frames: el handler es rápido, así que su resultado se pinta enseguida"),
      t("Over 200 ms: in most visits some click lands on the long task and waits for it", "Más de 200 ms: en la mayoría de las visitas algún clic cae sobre la tarea larga y la espera"),
      t("About the average click's latency: most clicks never meet the task", "Más o menos la latencia del clic promedio: la mayoría de los clics nunca se topa con la tarea"),
    ],
    answer: 1,
    why: t(
      "INP (Interaction to Next Paint) times each interaction from the input to the next frame that shows its result: the wait for the main thread (input delay), the handlers (processing) and the frame after them (presentation delay). A visit's INP is its slowest interaction, ignoring one for every 50, and Core Web Vitals judge it at the 75th percentile of page loads (visits, here): 200 ms or less is good. Most clicks here met an idle thread, so the average was " + ms(R2.busy.mean) + ". But with a " + JOB.size + " ms task every second, most visits had at least one click that waited for it, and the p75 was " + ms(R2.busy.p75) + " (" + ms(R2.calm.p75) + " with no task). A fast handler can't help while the thread is busy with something else.",
      "INP (Interaction to Next Paint) mide cada interacción desde la entrada hasta el siguiente frame que muestra su resultado: la espera por el hilo principal (input delay), los handlers (processing) y el frame que sigue (presentation delay). El INP de una visita es su interacción más lenta, ignorando una de cada 50, y las Core Web Vitals lo juzgan en el percentil 75 de las cargas de página (aquí, visitas): 200 ms o menos es bueno. Aquí la mayoría de los clics encontró el hilo libre, así que el promedio fue " + ms(R2.busy.mean) + ". Pero con una tarea de " + JOB.size + " ms cada segundo, la mayoría de las visitas tuvo al menos un clic que la esperó, y el p75 fue " + ms(R2.busy.p75) + " (" + ms(R2.calm.p75) + " sin la tarea). Un handler rápido no sirve de nada mientras el hilo está ocupado con otra cosa.",
    ),
    watch: { hz: "60", driver: "raf", prop: "transform", work: "long" },
  },
  {
    id: "timer",
    title: t("setTimeout or requestAnimationFrame", "setTimeout o requestAnimationFrame"),
    change: t("No busy work · the ball moves with setTimeout(step, " + STEP + "), set again at the end of each step, instead of requestAnimationFrame · a 60 Hz and a 120 Hz screen",
      "Sin trabajo pesado · la bola se mueve con setTimeout(step, " + STEP + "), programado de nuevo al final de cada paso, en lugar de requestAnimationFrame · una pantalla de 60 Hz y una de 120 Hz"),
    question: t(STEP + " ms is about one frame at 60 Hz. Is the timer as smooth as requestAnimationFrame?", STEP + " ms es más o menos un frame a 60 Hz. ¿El temporizador es tan fluido como requestAnimationFrame?"),
    options: [
      t("Yes: " + STEP + " ms is close enough, and a faster screen only helps", "Sí: " + STEP + " ms está lo bastante cerca, y una pantalla más rápida solo ayuda"),
      t("No: the timer drifts against the vsync, so some frames get no new position, and at 120 Hz it still moves only about 60 times a second", "No: el temporizador se desfasa respecto al vsync, así que algunos frames no reciben una posición nueva, y a 120 Hz igual se mueve solo unas 60 veces por segundo"),
      t("It is smoother: it updates a little more often than the screen", "Es más fluido: actualiza un poco más seguido que la pantalla"),
    ],
    answer: 1,
    why: t(
      "A timer knows nothing about the display. setTimeout(step, " + STEP + ") fires " + STEP + " ms after it was set, plus the time the step took and however late the timer ran, so here the ball moved " + n0(R3.timer60.updatesPerSec) + " times a second against 60 vsyncs: now and then a vsync came before the next step and the screen repeated a picture (" + pct(R3.timer60.missedShare) + " of frames), a small stutter. On a 120 Hz screen the same code still moves about 60 times a second, so " + pct(R3.timer120.missedShare) + " of frames repeated. requestAnimationFrame runs once per frame, just before the browser renders it, at whatever rate the display runs. Compute the position from the rAF timestamp, not by adding a fixed step per call, or the animation runs twice as fast on a 120 Hz screen.",
      "Un temporizador no sabe nada de la pantalla. setTimeout(step, " + STEP + ") se dispara " + STEP + " ms después de programarse, más lo que tardó el paso y lo tarde que haya corrido el temporizador, así que aquí la bola se movió " + n0(R3.timer60.updatesPerSec) + " veces por segundo contra 60 vsyncs: de vez en cuando un vsync llegó antes del siguiente paso y la pantalla repitió una imagen (" + pct(R3.timer60.missedShare) + " de los frames), un pequeño tirón. En una pantalla de 120 Hz el mismo código se sigue moviendo unas 60 veces por segundo, así que se repitió el " + pct(R3.timer120.missedShare) + " de los frames. requestAnimationFrame corre una vez por frame, justo antes de que el navegador lo renderice, al ritmo que tenga la pantalla. Calcula la posición a partir del timestamp de rAF, no sumando un paso fijo por llamada, o la animación irá al doble de velocidad en una pantalla de 120 Hz.",
    ),
    watch: { hz: "120", driver: "timer", prop: "transform", work: "none" },
  },
  {
    id: "hz",
    title: t("A 120 Hz screen", "Una pantalla de 120 Hz"),
    change: t("No busy work · the ball moves with left instead of transform: on this page that is about " + n1(LEFT_FRAME) + " ms of JS, style, layout and paint per frame · 60 Hz → 120 Hz",
      "Sin trabajo pesado · la bola se mueve con left en lugar de transform: en esta página eso son unos " + n1(LEFT_FRAME) + " ms de JS, estilo, layout y pintura por frame · 60 Hz → 120 Hz"),
    question: t("It gets all 60 frames a second at 60 Hz. What happens on a 120 Hz screen?", "Consigue los 60 frames por segundo a 60 Hz. ¿Qué pasa en una pantalla de 120 Hz?"),
    options: [
      t("120 smooth frames a second: the screen is faster", "120 frames fluidos por segundo: la pantalla es más rápida"),
      t("It misses frames: " + n1(LEFT_FRAME) + " ms doesn't fit in " + BUDGET120 + ", so it can't make 120 new frames a second", "Pierde frames: " + n1(LEFT_FRAME) + " ms no caben en " + BUDGET120 + ", así que no puede hacer 120 frames nuevos por segundo"),
      t("No change: the same work gives the same result", "Ningún cambio: el mismo trabajo da el mismo resultado"),
    ],
    answer: 1,
    why: t(
      "At 120 Hz the budget halves to " + BUDGET120 + ". A frame that takes " + n1(LEFT_FRAME) + " ms can't be done by the next vsync, so frames land one or two vsyncs apart: " + n0(R4.left120.fps) + " new frames a second, " + pct(R4.left120.missedShare) + " of vsyncs missed, and the motion is uneven as well as slower. The same move with transform skips layout and paint (about " + n1(TF_FRAME) + " ms a frame here) and kept all " + n0(R4.tf120.fps) + ". What each property costs decides it: changing transform or opacity only needs compositing, while left, top or width make the browser lay out the page again and repaint it.",
      "A 120 Hz el presupuesto se reduce a la mitad, a " + BUDGET120 + ". Un frame que tarda " + n1(LEFT_FRAME) + " ms no alcanza a estar listo para el siguiente vsync, así que los frames llegan a uno o dos vsyncs de distancia: " + n0(R4.left120.fps) + " frames nuevos por segundo, " + pct(R4.left120.missedShare) + " de los vsyncs perdidos, y el movimiento es irregular además de más lento. El mismo movimiento con transform se salta el layout y la pintura (unos " + n1(TF_FRAME) + " ms por frame aquí) y conservó los " + n0(R4.tf120.fps) + ". Lo decide lo que cuesta cada propiedad: cambiar transform u opacity solo requiere componer, mientras que left, top o width obligan al navegador a recalcular el layout de la página y volver a pintarla.",
    ),
    watch: { hz: "120", driver: "raf", prop: "left", work: "none" },
  },
  {
    id: "chunk",
    title: t("Split the task into chunks", "Divide la tarea en pedazos"),
    change: t("The " + JOB.size + " ms task again, now yielding to the browser between chunks · one task → 50 ms chunks → 5 ms chunks · 60 Hz",
      "La tarea de " + JOB.size + " ms otra vez, ahora cediendo al navegador entre pedazos · una tarea → pedazos de 50 ms → pedazos de 5 ms · 60 Hz"),
    question: t("With 50 ms chunks no task is over 50 ms, the long-task line. Does the animation stay smooth while the work runs?", "Con pedazos de 50 ms ninguna tarea pasa de 50 ms, la línea de las tareas largas. ¿La animación sigue fluida mientras corre el trabajo?"),
    options: [
      t("Yes: no long tasks, no dropped frames", "Sí: sin tareas largas no hay frames perdidos"),
      t("No: a frame gets in between chunks, but the vsyncs during each chunk are still missed", "No: entre pedazos se cuela un frame, pero los vsyncs durante cada pedazo se siguen perdiendo"),
      t("Yes, and the work finishes sooner too", "Sí, y además el trabajo termina antes"),
    ],
    answer: 1,
    why: t(
      "A frame can only run between chunks. A 50 ms chunk still covers three vsyncs at 60 Hz, so the screen gets one new picture after each chunk and misses the vsyncs in between: " + n1(R5.c50.missedPerJob) + " frames missed per run of the work, against " + n1(R5.whole.missedPerJob) + " as one task. 5 ms chunks leave room for a frame inside every " + BUDGET60 + ": " + n1(R5.c5.missedPerJob) + " missed. The 50 ms long-task line is about how long input may wait, not about smoothness; for animation, a chunk plus the frame's own work has to fit the budget. The work itself took longer, " + ms(R5.whole.jobMs) + " → " + ms(R5.c5.jobMs) + ", because frames now run in between. Lesson 16 shows the other way out: a worker thread.",
      "Un frame solo puede correr entre pedazos. Un pedazo de 50 ms todavía cubre tres vsyncs a 60 Hz, así que la pantalla recibe una imagen nueva después de cada pedazo y pierde los vsyncs intermedios: " + n1(R5.c50.missedPerJob) + " frames perdidos por cada corrida del trabajo, contra " + n1(R5.whole.missedPerJob) + " como una sola tarea. Los pedazos de 5 ms dejan lugar para un frame dentro de cada " + BUDGET60 + ": " + n1(R5.c5.missedPerJob) + " perdidos. La línea de 50 ms de las tareas largas habla de cuánto puede esperar la entrada, no de fluidez; para animar, un pedazo más el trabajo del propio frame tiene que caber en el presupuesto. El trabajo en sí tardó más, " + ms(R5.whole.jobMs) + " → " + ms(R5.c5.jobMs) + ", porque ahora corren frames en medio. La lección 16 muestra la otra salida: un worker thread.",
    ),
    watch: { hz: "60", driver: "raf", prop: "transform", work: "chunk50" },
  },
];

const QUESTIONS = [
  [t("At 60 Hz, what has to fit into about 16.7 ms, and what happens when it doesn't?", "A 60 Hz, ¿qué tiene que caber en unos 16.7 ms y qué pasa cuando no cabe?"),
    t("Everything the main thread does for one frame: input handlers, requestAnimationFrame callbacks, style, layout and paint, plus whatever task happens to be running when the vsync arrives; the compositor then composites the frame on its own thread. If the main thread isn't done by the next vsync, the display shows the previous picture again (a dropped frame), and the new one arrives a vsync or more later. The browser's own work shares the budget, so your part has to be smaller than the full 16.7 ms.",
      "Todo lo que el hilo principal hace para un frame: handlers de entrada, callbacks de requestAnimationFrame, estilo, layout y pintura, más la tarea que esté corriendo cuando llega el vsync; después el compositor compone el frame en su propio hilo. Si el hilo principal no terminó para el siguiente vsync, la pantalla vuelve a mostrar la imagen anterior (un frame perdido), y la nueva llega uno o más vsyncs después. El trabajo propio del navegador comparte el presupuesto, así que tu parte tiene que ser menor que los 16.7 ms completos.")],
  [t("Your INP is 350 ms, yet every click handler in the profiler takes under 20 ms. Where is the time going?", "Tu INP es de 350 ms, pero cada handler de clic en el profiler tarda menos de 20 ms. ¿Adónde se va el tiempo?"),
    t("Into the other two parts of an interaction. Input delay: the click waited for the main thread, busy with some other task (a timer, hydration, a third-party script). Presentation delay: after the handler, the frame that shows the result had a lot of style, layout and paint to do, or waited behind another task. Look at those parts, for example with the web-vitals library's attribution build or the Long Animation Frames API, then break up the long tasks and shrink the rendering work.",
      "En las otras dos partes de una interacción. Input delay: el clic esperó al hilo principal, ocupado con otra tarea (un temporizador, la hidratación, un script de terceros). Presentation delay: después del handler, el frame que muestra el resultado tuvo mucho estilo, layout y pintura que hacer, o esperó detrás de otra tarea. Mira esas partes, por ejemplo con la versión de atribución (attribution build) de la biblioteca web-vitals o con la API de Long Animation Frames, y después divide las tareas largas y reduce el trabajo de renderizado.")],
  [t("Why does animating transform or opacity cost less than animating left, top or width?", "¿Por qué animar transform u opacity cuesta menos que animar left, top o width?"),
    t("Changing left or width changes geometry, so every frame needs layout (and whatever else moves) and a repaint. Changing transform or opacity doesn't move anything else on the page: the browser can paint the element once into its own layer and just move or fade that layer when it composites. A CSS animation or transition of those properties can even run on the compositor thread, so it keeps going while the main thread is blocked. Layers cost memory, so promote elements (will-change) only while they animate.",
      "Cambiar left o width cambia la geometría, así que cada frame necesita layout (de todo lo que se mueva) y volver a pintar. Cambiar transform u opacity no mueve nada más en la página: el navegador puede pintar el elemento una vez en su propia capa y solo mover o desvanecer esa capa al componer. Una animación o transición CSS de esas propiedades puede incluso correr en el hilo del compositor, así que sigue andando aunque el hilo principal esté bloqueado. Las capas cuestan memoria, así que promueve elementos (will-change) solo mientras se animan.")],
  [t("Why animate with requestAnimationFrame rather than setInterval or setTimeout?", "¿Por qué animar con requestAnimationFrame y no con setInterval o setTimeout?"),
    t("rAF calls you once per frame, just before style, layout and paint, at the display's own rate (60, 120 or whatever it runs at), and it pauses in background tabs. A timer runs on its own clock, so its updates drift against the vsync: some frames get two updates (one wasted) or none (a repeated picture). Use the timestamp rAF passes you to compute the position. rAF doesn't make slow work fast, though: if the callback plus rendering doesn't fit the budget, frames still drop. It is also the natural throttle for anything that draws (lesson 32).",
      "rAF te llama una vez por frame, justo antes del estilo, el layout y la pintura, al ritmo de la propia pantalla (60, 120 o el que tenga), y se pausa en las pestañas en segundo plano. Un temporizador corre con su propio reloj, así que sus actualizaciones se desfasan respecto al vsync: algunos frames reciben dos (una desperdiciada) o ninguna (una imagen repetida). Usa el timestamp que te pasa rAF para calcular la posición. Pero rAF no vuelve rápido el trabajo lento: si el callback más el renderizado no caben en el presupuesto, igual se pierden frames. También es el throttle natural para todo lo que dibuja (lección 32).")],
  [t("A click has to filter 10,000 rows, about 300 ms of work. How do you keep INP good?", "Un clic tiene que filtrar 10,000 filas, unos 300 ms de trabajo. ¿Cómo mantienes bueno el INP?"),
    t("Show that the click landed first: update the button or show a spinner in the handler, then yield so the browser can paint that frame (for example await scheduler.yield() or a setTimeout), and only then do the heavy part, in short chunks or in a worker (lesson 16). The interaction is measured to the next paint, so the early feedback is what counts, and the chunks keep later clicks from waiting long. If the input fires on every keystroke, debounce it too (lesson 31).",
      "Primero muestra que el clic llegó: actualiza el botón o muestra un indicador de carga en el handler, luego cede para que el navegador pueda pintar ese frame (por ejemplo await scheduler.yield() o un setTimeout), y solo después haz la parte pesada, en pedazos cortos o en un worker (lección 16). La interacción se mide hasta la siguiente pintura, así que lo que cuenta es esa respuesta temprana, y los pedazos evitan que los clics siguientes esperen mucho. Si la entrada se dispara con cada tecla, aplícale también un debounce (lección 31).")],
  [t("An animation is smooth on your laptop and stutters on a 120 Hz phone. Give two reasons it could be.", "Una animación va fluida en tu laptop y da tirones en un teléfono de 120 Hz. Da dos razones posibles."),
    t("The budget is half as long, 8.3 ms, and a phone's CPU is usually slower, so per-frame work that fit in 16.7 ms on the laptop no longer fits. And the animation may be tied to a fixed rate instead of the display: a setTimeout or setInterval loop still updates about 60 times a second, and code that adds a fixed step on every rAF call runs at a different speed on each display. Measure on the device, animate transform or opacity, and move by elapsed time.",
      "El presupuesto dura la mitad, 8.3 ms, y la CPU de un teléfono suele ser más lenta, así que el trabajo por frame que cabía en 16.7 ms en la laptop ya no cabe. Y la animación puede estar atada a un ritmo fijo en lugar de a la pantalla: un bucle de setTimeout o setInterval se sigue actualizando unas 60 veces por segundo, y el código que suma un paso fijo en cada llamada de rAF corre a otra velocidad en cada pantalla. Mide en el dispositivo, anima transform u opacity, y mueve según el tiempo transcurrido.")],
];

export default defineLesson({
  title: t("Frame Budget Workbench", "Banco de trabajo: presupuesto de frame"),
  eyebrow: t("Systems lesson 51 · Frame budget", "Lección de sistemas 51 · Presupuesto de frame"),
  lede: t("At 60 Hz the browser has about 16.7 ms to make each frame: run input handlers and your JavaScript, recalculate style, lay out, paint and composite. Work that doesn't fit drops frames, and a click waits for the next frame that can paint. This lesson turns the budget into a conveyor: watch it, predict what breaks it, then explain it back.",
    "A 60 Hz el navegador tiene unos 16.7 ms para hacer cada frame (cuadro): correr los handlers de entrada y tu JavaScript, recalcular estilos, hacer el layout, pintar y componer. El trabajo que no cabe hace perder frames, y un clic espera al siguiente frame que pueda pintarse. Esta lección convierte el presupuesto en una cinta: mírala, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("The belt is a time line: the vsync drum pulls it from right to left at a steady speed, so a block's length is how long that work took. At the NOW gantry the main thread lays down its work: tall blocks are tasks, low steps a frame's JS, style, layout and paint. At every vsync a rib goes by; a card stands at it when a new picture reached the screen, so a rib without a card is a dropped frame. Click the page and follow the pennant to its paint.",
      "La cinta es una línea de tiempo: el tambor del vsync la arrastra de derecha a izquierda a velocidad constante, así que el largo de un bloque es cuánto tardó ese trabajo. En el pórtico AHORA el hilo principal va dejando su trabajo: los bloques altos son tareas; los escalones bajos, el JS, el estilo, el layout y la pintura de un frame. En cada vsync pasa una costilla; junto a ella se para una tarjeta cuando una imagen nueva llegó a la pantalla, así que una costilla sin tarjeta es un frame perdido. Haz clic en la página y sigue el banderín hasta su pintura."),
    plate: {
      title: t("Frame conveyor", "Cinta de frames"),
      keys: [
        { mark: "lit", label: t("The click being followed: its pennant, its handler, its bar and the frame that answered it; the stage under way", "El clic que se sigue: su banderín, su handler, su barra y el frame que lo respondió; la etapa en curso") },
        { mark: "raised", label: t("Blocks: tasks (tall), click handlers, and each frame's JS, style, layout and paint (low steps)", "Bloques: tareas (altos), handlers de clic, y el JS, estilo, layout y pintura de cada frame (escalones bajos)") },
        { mark: "flat", label: t("Ribs: one per vsync; a card at a rib is a new picture on the screen", "Costillas: una por vsync; una tarjeta junto a una costilla es una imagen nueva en la pantalla") },
      ],
      caption: t(
        "The page animates the ball on the screen. Moving it with transform costs the main thread about " + n1(TF_FRAME) + " ms a frame; with left, about " + n1(LEFT_FRAME) + " ms on this page, because style, layout and paint must run again. With busy work on, a " + JOB.size + " ms task runs once a second. The compositor composites each finished frame (" + n1(COST.composite) + " ms) and it reaches the screen at the next vsync. The lamps on the bench show the stage the main thread is in; the dial on the drum turns once per vsync. In front, each click's bar runs from the click to the paint that showed its result, against a ruler of milliseconds; a bar past the 200 ms line is a slow interaction.",
        "La página anima la bola de la pantalla. Moverla con transform le cuesta al hilo principal unos " + n1(TF_FRAME) + " ms por frame; con left, unos " + n1(LEFT_FRAME) + " ms en esta página, porque el estilo, el layout y la pintura tienen que correr otra vez. Con el trabajo pesado activado, una tarea de " + JOB.size + " ms corre una vez por segundo. El compositor compone cada frame terminado (" + n1(COST.composite) + " ms) y este llega a la pantalla en el siguiente vsync. Las lámparas del banco muestran la etapa en la que está el hilo principal; el dial del tambor da una vuelta por vsync. Al frente, la barra de cada clic va del clic a la pintura que mostró su resultado, sobre una regla de milisegundos; una barra que pasa la línea de 200 ms es una interacción lenta.",
      ),
      stage: { "data-frames": "" },
      label: t("Frame budget simulation. Space pauses or resumes.", "Simulación del presupuesto de frame. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["fps", t("New frames / s", "Frames nuevos / s"), "–"],
      ["missed", t("Missed frames", "Frames perdidos"), "–"],
      ["work", t("Last frame's work", "Trabajo del último frame"), "–"],
      ["busy", t("Main thread busy", "Hilo principal ocupado"), "–"],
      ["click", t("Last click → paint", "Último clic → pintura"), "–"],
      ["inp", t("INP, this run", "INP, esta corrida"), "–"],
    ],
    controls: [
      { seg: "hz", label: t("Screen", "Pantalla"), options: [["60", "60 Hz"], ["120", "120 Hz"]], value: "60" },
      { seg: "driver", label: t("Animate with", "Animar con"), options: [["raf", "requestAnimationFrame"], ["timer", "setTimeout(16)"], ["css", t("CSS animation", "Animación CSS")]], value: "raf" },
      { seg: "prop", label: t("Property", "Propiedad"), options: [["transform", "transform"], ["left", "left"]], value: "transform" },
      { seg: "work", label: t("Busy work, every second", "Trabajo pesado, cada segundo"), options: [["none", t("None", "Ninguno")], ["long", t(JOB.size + " ms task", "Tarea de " + JOB.size + " ms")], ["chunk50", t("50 ms chunks", "Pedazos de 50 ms")], ["chunk5", t("5 ms chunks", "Pedazos de 5 ms")]], value: "long" },
      { speed: true },
      { actions: [["click", t("Click the page", "Haz clic en la página"), { primary: true }], ["task", t("Run a " + JOB.size + " ms task", "Corre una tarea de " + JOB.size + " ms")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The machine plays in slow motion: at ×1, one second on screen is 40 ms of page time. The user at the button clicks now and then by itself. Changing a setting starts the run again; INP, this run is the slowest click so far, ignoring one in every 50.",
      "La máquina va en cámara lenta: a ×1, un segundo en pantalla son 40 ms de tiempo de la página. La persona del botón hace clic de vez en cuando por su cuenta. Cambiar un ajuste reinicia la corrida; INP, esta corrida es el clic más lento hasta ahora, ignorando uno de cada 50."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of 10 s of page time; the INP experiment uses " + VISITS + " seeded visits.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de 10 s de tiempo de la página; el experimento de INP usa " + VISITS + " visitas con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; its costs are one page's, not any browser's. INP thresholds follow web.dev's Core Web Vitals guidance. Lesson 16 covers the event loop's task and microtask queues and moving work to a worker.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; sus costos son los de una página, no los de ningún navegador. Los umbrales de INP siguen la guía de Core Web Vitals de web.dev. La lección 16 trata las colas de tareas y microtareas del bucle de eventos y cómo pasar trabajo a un worker.`),
  css: LIT_FILL_CSS,
  data: { P, G: GEOMETRY, RIB: ribSvg(), CARD_SVG: cardSvg(false), CARD_LIT: cardSvg(true), PENNANT: pennantSvg(false), PENNANT_LIT: pennantSvg(true) },
});
