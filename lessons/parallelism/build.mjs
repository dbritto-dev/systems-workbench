// Systems lesson 14 · Parallelism. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t } from "../../workbench/page.mjs";
import { buildFigure, pawnSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const BASE = { workers: 8, cores: 8, serial: 0.1, chunks: 8, tool: false, job: "big", data: "even" };
const EXPERIMENTS = [
  {
    id: "amdahl",
    title: t("Eight workers", "Ocho trabajadores"),
    change: t("1 → 8 workers on 8 benches · 10% of the job is packing, which only one station can do", "1 → 8 trabajadores en 8 bancos · el 10% del trabajo es empaque, que solo puede hacer una estación"),
    question: t("How much faster does a job finish?", "¿Cuánto más rápido termina un trabajo?"),
    options: [t("About 8× faster: eight workers, eight benches", "Cerca de 8× más rápido: ocho trabajadores, ocho bancos"), t("About 4× faster", "Cerca de 4× más rápido"), t("About 2× faster", "Cerca de 2× más rápido")],
    answer: 1,
    why: t("Only the parallel part gets eight times faster. The 10% at the packing station still takes as long as before, so it soon dominates: Amdahl's law caps 10% serial work on 8 cores at 4.7×, and handing out and merging chunks costs a little more. No number of workers can beat 10× here, because the serial part alone takes a tenth of the original time.",
      "Solo la parte paralela se vuelve ocho veces más rápida. El 10% en la estación de empaque sigue tardando lo mismo, así que pronto domina: la ley de Amdahl (Amdahl's law) limita un 10% de trabajo serial en 8 núcleos a 4.7×, y repartir y unir los bloques cuesta un poco más. Ninguna cantidad de trabajadores supera 10× aquí, porque la parte serial sola ya toma una décima parte del tiempo original."),
    watch: { ...BASE },
  },
  {
    id: "oversub",
    title: t("More workers than benches", "Más trabajadores que bancos"),
    change: t("8 → 16 workers · still 8 benches (cores) · job split into 16 chunks", "8 → 16 trabajadores · siguen 8 bancos (núcleos) · trabajo dividido en 16 bloques"),
    question: t("What happens to the job time?", "¿Qué pasa con el tiempo del trabajo?"),
    options: [t("It halves: twice the workers", "Se reduce a la mitad: el doble de trabajadores"), t("Nothing gets faster; it's slightly slower", "Nada se acelera; es un poco más lento"), t("It doubles: they get in each other's way", "Se duplica: se estorban entre sí")],
    answer: 1,
    why: t("A bench can only work on one thing at an instant. Two workers on one bench take turns, and every switch costs a little (on a CPU: saving and restoring state, cold caches). More threads than cores helps only when threads spend time waiting on something other than the CPU; for CPU-bound work, match the worker count to the cores.",
      "Un banco solo puede trabajar en una cosa a la vez. Dos trabajadores en un banco se turnan, y cada cambio cuesta un poco (en una CPU: guardar y restaurar el estado, cachés frías). Tener más hilos que núcleos solo ayuda cuando los hilos pasan tiempo esperando algo distinto de la CPU; para trabajo limitado por CPU (CPU-bound), iguala la cantidad de trabajadores a los núcleos."),
    watch: { ...BASE, workers: 16, chunks: 16 },
  },
  {
    id: "tool",
    title: t("One shared tool", "Una herramienta compartida"),
    change: t("Shared tool off → on · the last 40% of every chunk needs the one tool on the rack", "Herramienta compartida apagada → encendida · el último 40% de cada bloque necesita la única herramienta del soporte"),
    question: t("With 8 workers, how fast is the job compared with one worker?", "Con 8 trabajadores, ¿qué tan rápido es el trabajo comparado con un solo trabajador?"),
    options: [t("Still about 4× faster", "Sigue siendo cerca de 4× más rápido"), t("About 2× faster", "Cerca de 2× más rápido"), t("No faster at all", "Nada más rápido")],
    answer: 1,
    why: t("The tool is a lock: only one worker can hold it, so the part of each chunk that needs it is serial again, and workers queue for it. Every shared, exclusive resource (a lock, a single database row, one connection) adds to the serial share in Amdahl's law. Speed-up comes from removing what workers share, not from adding workers.",
      "La herramienta es un candado (lock): solo un trabajador puede tenerla, así que la parte de cada bloque que la necesita vuelve a ser serial, y los trabajadores hacen fila para usarla. Cada recurso compartido y exclusivo (un lock, una sola fila de la base de datos, una conexión) suma a la parte serial de la ley de Amdahl. La aceleración (speed-up) viene de quitar lo que los trabajadores comparten, no de agregar trabajadores."),
    watch: { ...BASE, tool: true },
  },
  {
    id: "tiny",
    title: t("A tiny job", "Un trabajo diminuto"),
    change: t("A job of 0.3 s instead of 16 s · 1 worker with 1 chunk vs 8 workers with 8 chunks", "Un trabajo de 0.3 s en vez de 16 s · 1 trabajador con 1 bloque contra 8 trabajadores con 8 bloques"),
    question: t("Which finishes first?", "¿Cuál termina primero?"),
    options: [t("8 workers, about 8× sooner", "8 trabajadores, cerca de 8× antes"), t("1 worker", "1 trabajador"), t("They tie", "Empatan")],
    answer: 1,
    why: t("Splitting has a fixed cost per chunk: the foreman hands each one out and the packing station merges each one back. On a big job that cost is lost in the noise; on a tiny one it is bigger than the work saved. Parallelise work that is large compared with the cost of coordinating it, and batch small items together.",
      "Dividir tiene un costo fijo por bloque: el capataz reparte cada uno y la estación de empaque une cada uno de vuelta. En un trabajo grande ese costo se pierde en el ruido; en uno diminuto es mayor que el trabajo ahorrado. Paraleliza el trabajo que es grande comparado con el costo de coordinarlo, y agrupa los elementos pequeños en lotes."),
    watch: { ...BASE, job: "tiny" },
  },
  {
    id: "uneven",
    title: t("One heavy chunk", "Un bloque pesado"),
    change: t("Uneven data: the first eighth of the job holds a third of the work · 8 chunks vs 32 chunks, 8 workers", "Datos disparejos: el primer octavo del trabajo contiene un tercio del total · 8 bloques contra 32 bloques, 8 trabajadores"),
    question: t("With 8 chunks, what happens to the job time?", "Con 8 bloques, ¿qué pasa con el tiempo del trabajo?"),
    options: [t("Nothing: the total work is the same", "Nada: el trabajo total es el mismo"), t("It roughly doubles, until the job is cut into smaller chunks", "Se duplica más o menos, hasta que el trabajo se corta en bloques más pequeños"), t("It gets shorter: big chunks cost less to hand out", "Se acorta: los bloques grandes cuestan menos de repartir")],
    answer: 1,
    why: t("The job only finishes when its slowest chunk does. With 8 chunks, one worker gets the heavy one while seven finish early and stand idle. Cutting the job into 32 smaller chunks lets free workers keep taking the next one, which spreads the heavy part out. That is what work-stealing schedulers and dynamic batching do.",
      "El trabajo solo termina cuando termina su bloque más lento. Con 8 bloques, un trabajador recibe el pesado mientras siete terminan pronto y se quedan sin hacer nada. Cortar el trabajo en 32 bloques más pequeños permite que los trabajadores libres sigan tomando el siguiente, lo que reparte la parte pesada. Eso hacen los planificadores con robo de trabajo (work-stealing) y el agrupamiento dinámico en lotes."),
    watch: { ...BASE, data: "uneven" },
  },
];

const QUESTIONS = [
  [t("Your batch job takes 60 minutes on one core and 20% of it can't be parallelised. What's the best it can do on 16 cores, and on infinitely many?", "Tu trabajo por lotes tarda 60 minutos en un núcleo y el 20% no se puede paralelizar. ¿Qué es lo mejor que puede lograr con 16 núcleos, y con infinitos?"),
    t("Amdahl: 1 / (0.2 + 0.8/16) = 4×, so 15 minutes. With infinite cores it approaches 1/0.2 = 5×, 12 minutes: the serial part alone takes 12 minutes. To go further you have to shrink the serial part, not add cores.",
      "Amdahl: 1 / (0.2 + 0.8/16) = 4×, o sea 15 minutos. Con núcleos infinitos se acerca a 1/0.2 = 5×, 12 minutos: la parte serial sola toma 12 minutos. Para ir más lejos tienes que reducir la parte serial, no agregar núcleos.")],
  [t("What's the difference between concurrency and parallelism?", "¿Cuál es la diferencia entre concurrencia y paralelismo?"),
    t("Concurrency is dealing with many things at once: tasks overlap in time, even on one core, by taking turns. Parallelism is doing many things at the same instant, which needs several cores or machines. Concurrency is about structure; parallelism is about execution.",
      "La concurrencia es lidiar con muchas cosas a la vez: las tareas se superponen en el tiempo, incluso en un núcleo, turnándose. El paralelismo es hacer muchas cosas en el mismo instante, lo que requiere varios núcleos o máquinas. La concurrencia trata de la estructura; el paralelismo, de la ejecución.")],
  [t("A teammate sets a thread pool to 200 threads on an 8-core server to make CPU-heavy image resizing faster. What do you expect?", "Un compañero configura un pool de hilos (thread pool) con 200 hilos en un servidor de 8 núcleos para acelerar el redimensionado de imágenes, que usa mucha CPU. ¿Qué esperas?"),
    t("No speed-up beyond 8 at a time, plus extra switching and memory per thread, so it may get slower. For CPU-bound work, size the pool near the core count; large pools only help work that mostly waits on I/O.",
      "Ninguna aceleración más allá de 8 a la vez, más cambios extra y memoria por hilo, así que puede volverse más lento. Para trabajo limitado por CPU, dimensiona el pool cerca de la cantidad de núcleos; los pools grandes solo ayudan al trabajo que pasa casi todo el tiempo esperando E/S.")],
  [t("Why can adding workers make a program slower?", "¿Por qué agregar trabajadores puede volver más lento un programa?"),
    t("Coordination overhead (splitting, scheduling, merging) and contention on shared things: a lock, a shared counter, a single connection, cache lines bouncing between cores. If those grow with the number of workers, past some point each new worker costs more than it adds.",
      "Por la sobrecarga de coordinación (dividir, planificar, unir) y la contención por cosas compartidas: un lock, un contador compartido, una sola conexión, líneas de caché que rebotan entre núcleos. Si eso crece con la cantidad de trabajadores, a partir de cierto punto cada trabajador nuevo cuesta más de lo que aporta.")],
  [t("Your parallel job's progress bar sits at 95% for a long time. What's the likely cause and the fix?", "La barra de progreso de tu trabajo paralelo se queda en 95% mucho tiempo. ¿Cuál es la causa probable y cómo se arregla?"),
    t("Uneven work: one chunk is much bigger than the others, so one worker is still busy while the rest are idle. Use smaller chunks with a shared queue (or a work-stealing scheduler), or split by work done rather than by item count.",
      "Trabajo disparejo: un bloque es mucho más grande que los demás, así que un trabajador sigue ocupado mientras el resto está inactivo. Usa bloques más pequeños con una cola compartida (o un planificador con robo de trabajo), o divide según el trabajo y no según la cantidad de elementos.")],
  [t("Where do you meet these ideas outside threads?", "¿Dónde encuentras estas ideas fuera de los hilos?"),
    t("Everywhere work is spread out: map-reduce and Spark jobs, CI pipelines split across runners, database queries using parallel workers, Kubernetes jobs with many pods. The same rules hold: the serial step (a final merge, a single writer), coordination cost and stragglers decide the speed-up.",
      "En todo lugar donde el trabajo se reparte: trabajos de map-reduce y Spark, pipelines de CI divididos entre runners, consultas a la base de datos con workers paralelos, jobs de Kubernetes con muchos pods. Valen las mismas reglas: el paso serial (una unión final, un solo escritor), el costo de coordinación y los rezagados deciden la aceleración.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Workshop", "Taller"),
  keys: [
    { mark: "lit", label: t("Work happening this instant: a chunk being worked, the tool in use, the press", "Trabajo en este instante: un bloque en proceso, la herramienta en uso, la prensa") },
    { mark: "raised", label: t("Workbenches: the cores", "Bancos de trabajo: los núcleos") },
    { mark: "flat", label: t("Packing station: the serial part", "Estación de empaque: la parte serial") },
  ],
  caption: t(
    "The foreman in the cap splits each job into chunks and stacks them on the pallet. A worker with nothing to do takes the next chunk to its bench; the chunk shrinks as it is worked on and is lit while someone is working on it. Workers who share a bench take turns: the one stepped back is waiting. The T-handled tool on the rack is the one shared tool; with it switched on, the end of every chunk needs it, so it travels to the bench using it and the others drop a token on the rail beside the rack and wait their turn. Finished chunks land in the packing tray, and when all are in, the packing station merges them and presses the job alone while the benches stand empty. The dial on the desk turns once in the time one worker would need.",
    "El capataz de gorra divide cada trabajo en bloques y los apila en el palé. Un trabajador sin nada que hacer lleva el siguiente bloque a su banco; el bloque se encoge mientras se trabaja y se ilumina mientras alguien lo trabaja. Los trabajadores que comparten un banco se turnan: el que está un paso atrás espera. La herramienta con mango en T del soporte es la única herramienta compartida; cuando está encendida, el final de cada bloque la necesita, así que viaja al banco que la usa y los demás dejan una ficha en el riel junto al soporte y esperan su turno. Los bloques terminados caen en la bandeja de empaque y, cuando están todos, la estación de empaque los une y prensa el trabajo sola mientras los bancos quedan vacíos. El dial del escritorio da una vuelta en el tiempo que necesitaría un solo trabajador."),
  stage: "data-office",
  stageLabel: t("Workshop simulation. Space pauses or resumes.", "Simulación del taller. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const controls = panel({
  stats: [["jobs", t("Jobs done", "Trabajos hechos")], ["last", t("Last job", "Último trabajo"), "–"], ["speedup", t("Speed-up", "Aceleración"), "–"], ["limit", t("Amdahl limit", "Límite de Amdahl"), "–"], ["busy", t("Benches busy", "Bancos ocupados"), "–"], ["toolwait", t("Waiting for tool", "Esperando herramienta"), "–"]],
  controls: [
    seg("workers", t("Workers", "Trabajadores"), [[1, "1"], [2, "2"], [4, "4"], [8, "8"], [16, "16"]], 8),
    seg("cores", t("Benches (cores)", "Bancos (núcleos)"), [[4, "4"], [8, "8"]], 8),
    seg("serial", t("Serial part", "Parte serial"), [[0, "0%"], [0.1, "10%"], [0.3, "30%"]], 0.1),
    seg("chunks", t("Chunks per job", "Bloques por trabajo"), [[1, "1"], [8, "8"], [16, "16"], [32, "32"]], 8),
    seg("tool", t("Shared tool", "Herramienta compartida"), [["false", t("Off", "Apagada")], ["true", t("On", "Encendida")]], "false"),
    seg("job", t("Job size", "Tamaño del trabajo"), [["big", "16 s"], ["tiny", "0.3 s"]], "big"),
    seg("data", t("Work per chunk", "Trabajo por bloque"), [["even", t("Even", "Parejo")], ["uneven", t("One heavy part", "Una parte pesada")]], "even"),
    speedSeg(),
    actions(t("Do something", "Acciones"), [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
});

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const PAWN_SVG = ${JSON.stringify(pawnSvg())};
const NS = "http://www.w3.org/2000/svg";
const tr = WB.L, T = WB.T;
const EXP_ES = ${JSON.stringify(Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e.title.es])))};

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const covers = G.BENCHES.map((b) => q('[data-bench="' + b.i + '"] [data-cover]'));
const crateRows = [q('[data-crates="0"]'), q('[data-crates="1"]')];
const pawnRows = [q('[data-pawns="0"]'), q('[data-pawns="1"]')];
const toolAnchors = { rack: q('[data-anchor="tool-rack"]'), 0: q('[data-anchor="tool-0"]'), 1: q('[data-anchor="tool-1"]') };
const tool = q("[data-tool]");
const waits = [...svg.querySelectorAll("[data-wait]")];
const tokens = [...svg.querySelectorAll("[data-token]")];
const tiles = [...svg.querySelectorAll("[data-tile]")];
const product = q("[data-product]"), ram = q("[data-ram]"), rod = q("[data-rod]"), clockHand = q("[data-clock]");
const pawns = Array.from({ length: 16 }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = PAWN_SVG; g.style.display = "none"; return g; });

const cfg = { ...${JSON.stringify(BASE)}, speed: 1 };
let shop, seed = (Date.now() % 1e5) + 1, ref = 1, lastRam = null;

function crate(x0, y0, w, h, lit) { return solidSvg(slabOf({ x: x0, y: y0, w, d: G.CRATE.d, r: 0.6 }, G.CRATE.z, h, P, 2, 0.3), { tone: "hi", crease: "lo", lit }); }
function ramAt(z, lit) { return solidSvg(slabOf({ x: G.PRESS.cx - 5.5, y: G.PRESS.cy - 5.5, w: 11, d: 11, r: 0.8 }, z, 4, P, 2, 0.4), { tone: "hi", crease: "lo", lit }); }
function rodAt(z) { return solidSvg(cylinder(G.PRESS.cx, G.PRESS.cy, 1.8, z + 4, G.PRESS.top - z - 4, P, 14), { tone: "mid", crease: "none" }); }

function restart() {
  shop = makeShop(cfg, seed++);
  ref = Math.max(...shop.chunks.map((c) => c.size));
  covers.forEach((c, i) => (c.style.display = i >= cfg.cores ? "" : "none"));
  pawns.forEach((p, i) => {
    p.style.display = i < cfg.workers ? "" : "none";
    const b = G.BENCHES[i % cfg.cores];
    if (p.parentNode !== pawnRows[b.row]) pawnRows[b.row].appendChild(p);
  });
  // Start a little way into the first job, so even a still frame shows workers busy and chunks waiting.
  shop.runTo(cfg.job === "tiny" ? 0.06 : cfg.workers === 1 ? 2.4 : 1.1);
  computeStats();
  paint();
}

let current = { speedup: null, limit: null };
function computeStats() {
  current.limit = amdahl(cfg.serial, cfg.workers, cfg.cores);
  current.speedup = speedup(cfg);
  statEls.limit.textContent = current.limit.toFixed(1) + "×";
  statEls.speedup.textContent = current.speedup.toFixed(1) + "×";
}

function onBench(b) { return shop.workers.filter((w) => w.bench === b); }
function paint() {
  const t = shop.t;
  if (shop.chunks[0] && shop.jobStart === t) ref = Math.max(...shop.chunks.map((c) => c.size));
  const rows = [[], []], seen = new Set();
  for (let b = 0; b < cfg.cores; b++) {
    const bench = G.BENCHES[b], list = onBench(b), n = list.length;
    const running = list.filter((w) => w.chunk && !w.waiting);
    const active = running.length ? running[Math.floor(t / 0.3) % running.length] : null;
    const gap = Math.min(15, 30 / Math.max(1, n)), width = Math.min(14, gap - 2);
    list.forEach((w, j) => {
      const x = bench.cx + (j - (n - 1) / 2) * gap;
      const working = w === active;
      pawns[w.id].setAttribute("transform", translateAlong(P, [x, bench.front + 5 + (working ? 0 : 5), 0]));
      if (w.chunk) {
        const left = w.chunk.free + w.chunk.tool;
        const h = 1 + 14 * Math.min(1, left / ref);
        rows[bench.row].push(crate(x - width / 2, bench.cy - G.CRATE.d / 2 - 1, width, h, working));
      }
    });
  }
  crateRows[0].innerHTML = rows[0].join(""); crateRows[1].innerHTML = rows[1].join("");
  waits.forEach((el, i) => (el.style.display = i < shop.ready.length ? "" : "none"));
  // Shared tool: on its rack, or on the bench of the worker holding it.
  {
    const holder = shop.toolHolder === null ? null : shop.workers[shop.toolHolder];
    const anchor = holder ? toolAnchors[G.BENCHES[holder.bench].row] : toolAnchors.rack;
    if (tool.parentNode !== anchor) anchor.appendChild(tool);
    const b = holder && G.BENCHES[holder.bench];
    tool.setAttribute("transform", translateAlong(P, holder ? [b.x0 + G.BENCH.w - 5.5, b.y0 + 5.5, G.BENCH.h] : G.TOOL_REST));
    tool.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", !!holder));
    tokens.forEach((el, i) => (el.style.display = i < shop.toolQueue.length ? "" : "none"));
  }
  // Packing tray and press.
  const inTray = shop.phase === "work" ? shop.doneCount : shop.phase === "merge" ? Math.ceil(Math.max(0, shop.mergeLeft) / PAR.MERGE) : 0;
  tiles.forEach((el, i) => (el.style.display = i < inTray ? "" : "none"));
  product.style.display = shop.phase === "work" ? "none" : "";
  const pressing = shop.phase === "pack";
  const z = pressing ? G.PRESS.down + (G.PRESS.up - G.PRESS.down) * 0.5 * (1 + Math.cos(t * Math.PI * 2 / 0.7)) : G.PRESS.up;
  const key = z.toFixed(1) + pressing;
  if (key !== lastRam) { lastRam = key; ram.innerHTML = ramAt(z, pressing); rod.innerHTML = rodAt(z); }
  clockHand.setAttribute("d", needleOf((t - shop.jobStart) / PAR.BIG));
  // Readout.
  const waitingTool = shop.workers.filter((w) => w.waiting).length;
  const job = shop.jobsDone + 1, last = shop.lastTime ? shop.lastTime.toFixed(1) + " s" : "";
  if (WB.lang() === "es") {
    if (shop.phase === "work") say("trabajo " + job + " · " + shop.doneCount + " de " + shop.chunks.length + " bloques hechos" + (waitingTool ? " · " + waitingTool + (waitingTool === 1 ? " espera" : " esperan") + " la herramienta" : "") + (last ? " · último " + last : ""));
    else if (shop.phase === "merge") say("trabajo " + job + " · uniendo " + shop.chunks.length + " bloques · bancos inactivos");
    else say("trabajo " + job + " · la estación empaca sola (parte serial) · bancos inactivos");
  } else {
    if (shop.phase === "work") say("job " + job + " · " + shop.doneCount + " of " + shop.chunks.length + " chunks done" + (waitingTool ? " · " + waitingTool + " waiting for the tool" : "") + (last ? " · last " + last : ""));
    else if (shop.phase === "merge") say("job " + job + " · merging " + shop.chunks.length + " chunks · benches idle");
    else say("job " + job + " · packing alone (serial part) · benches idle");
  }
}
function needleOf(turn) { const a = turn * Math.PI * 2, x = -131, y = -84; return lineOnTop([x, y], [x + Math.sin(a) * 2.9, y - Math.cos(a) * 2.9], 16.2, P); }

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  statEls.jobs.textContent = shop.jobsDone;
  statEls.last.textContent = shop.lastTime ? (cfg.job === "tiny" ? Math.round(shop.lastTime * 1000) + " ms" : shop.lastTime.toFixed(1) + " s") : "–";
  statEls.busy.textContent = shop.t > 0.5 ? Math.round((100 * shop.busyTime) / shop.t) + "%" : "–";
  statEls.toolwait.textContent = cfg.tool && shop.t > 0.5 ? Math.round((100 * shop.toolWaitTime) / (shop.t * cfg.workers)) + "%" : "–";
}

let statTimer = 0;
function step(dt) {
  const before = shop.jobsDone;
  shop.runTo(shop.t + dt * cfg.speed);
  if (shop.jobsDone !== before) ref = Math.max(...shop.chunks.map((c) => c.size));
  paint();
  statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); if (on) say(tr("paused", "en pausa")); } });
WB.onLang(() => { pauseBtn.textContent = loop.paused ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); paint(); showStats(); if (loop.paused) say(tr("paused", "en pausa")); });
const NUMERIC = ["workers", "cores", "serial", "chunks", "speed"];
function set(name, raw, quiet) {
  cfg[name] = NUMERIC.includes(name) ? Number(raw) : name === "tool" ? raw === true || raw === "true" : raw;
  WB.pressSeg(name, raw);
  if (name !== "speed" && !quiet) { restart(); showStats(); }
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); showStats(); say(tr("started over", "empezó de nuevo")); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const B = ${JSON.stringify(BASE)};
const x1 = (v) => v.toFixed(1) + "×";
const s1 = (v) => v.toFixed(1) + " s";
const ms = (v) => Math.round(v * 1000) + " ms";
const RUNS = {
  amdahl: () => {
    const t1 = jobTime({ ...B, workers: 1 }), list = [1, 2, 4, 8].map((w) => [w, t1 / jobTime({ ...B, workers: w })]);
    const s8 = list[3][1];
    return { verdict: T("8 workers finished a job " + x1(s8) + " faster, not 8×. Amdahl's limit for 10% serial work on 8 cores is " + x1(amdahl(0.1, 8, 8)) + "; handing out and merging chunks takes the rest.",
        "8 trabajadores terminaron un trabajo " + x1(s8) + " más rápido, no 8×. El límite de Amdahl para un 10% de trabajo serial en 8 núcleos es " + x1(amdahl(0.1, 8, 8)) + "; repartir y unir los bloques se lleva el resto."),
      bars: list.map(([w, s]) => [T(w + (w === 1 ? " worker" : " workers"), w + (w === 1 ? " trabajador" : " trabajadores")), s / 8, x1(s), w === 8]) };
  },
  oversub: () => {
    const a = jobTime({ ...B, chunks: 16 }), b = jobTime({ ...B, chunks: 16, workers: 16 }), top = Math.max(a, b);
    const slower = Math.round(100 * (b / a - 1));
    return { verdict: T("Job time " + s1(a) + " with 8 workers, " + s1(b) + " with 16 on the same 8 benches: " + slower + "% slower.",
        "Tiempo del trabajo: " + s1(a) + " con 8 trabajadores, " + s1(b) + " con 16 en los mismos 8 bancos: " + slower + "% más lento."),
      bars: [[T("8 workers", "8 trabajadores"), a / top, s1(a)], [T("16 workers", "16 trabajadores"), b / top, s1(b), true]] };
  },
  tool: () => {
    const off = speedup(B), on = speedup({ ...B, tool: true });
    return { verdict: T("Speed-up with 8 workers: " + x1(off) + " without the shared tool, " + x1(on) + " with it.",
        "Aceleración con 8 trabajadores: " + x1(off) + " sin la herramienta compartida, " + x1(on) + " con ella."),
      bars: [[T("Tool off", "Herramienta apagada"), off / 8, x1(off)], [T("Tool on", "Herramienta encendida"), on / 8, x1(on), true]] };
  },
  tiny: () => {
    const one = jobTime({ ...B, job: "tiny", workers: 1, chunks: 1 }), eight = jobTime({ ...B, job: "tiny" }), more = jobTime({ ...B, job: "tiny", chunks: 32 }), top = Math.max(one, eight, more);
    return { verdict: T("A 0.3 s job took " + ms(one) + " with 1 worker and " + ms(eight) + " split across 8. Split into 32 chunks it took " + ms(more) + ".",
        "Un trabajo de 0.3 s tardó " + ms(one) + " con 1 trabajador y " + ms(eight) + " repartido entre 8. Dividido en 32 bloques tardó " + ms(more) + "."),
      bars: [[T("1 worker", "1 trabajador"), one / top, ms(one)], [T("8 workers, 8 chunks", "8 trabajadores, 8 bloques"), eight / top, ms(eight), true], [T("8 workers, 32 chunks", "8 trabajadores, 32 bloques"), more / top, ms(more)]] };
  },
  uneven: () => {
    const even = jobTime(B), u8 = jobTime({ ...B, data: "uneven" }), u32 = jobTime({ ...B, data: "uneven", chunks: 32 }), top = Math.max(even, u8, u32);
    return { verdict: T("Job time " + s1(even) + " with even chunks, " + s1(u8) + " with one heavy chunk, " + s1(u32) + " once the job is cut into 32 chunks.",
        "Tiempo del trabajo: " + s1(even) + " con bloques parejos, " + s1(u8) + " con un bloque pesado, " + s1(u32) + " al cortar el trabajo en 32 bloques."),
      bars: [[T("Even, 8 chunks", "Parejo, 8 bloques"), even / top, s1(even)], [T("Heavy, 8 chunks", "Pesado, 8 bloques"), u8 / top, s1(u8), true], [T("Heavy, 32 chunks", "Pesado, 32 bloques"), u32 / top, s1(u32)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["workers", "cores", "serial", "chunks", "tool", "job", "data"]) set(name, String(w[name]), true);
  restart(); showStats();
  if (loop.paused) loop.setPaused(false);
  say(WB.lang() === "es" ? "observando: " + EXP_ES[exp.id] : "watching: " + exp.id);
} });

loop.setPaused(loop.paused);
restart();
showStats();
`;

const size = writePage(new URL("./parallelism-workbench.html", import.meta.url), {
  title: t("Parallelism Workbench", "Banco de trabajo: paralelismo"),
  eyebrow: t("Systems lesson 14 · Parallelism", "Lección de sistemas 14 · Paralelismo"),
  lede: t("Parallelism is doing many pieces of work at the same instant, on several cores or machines. More workers help only as far as the work can be split, shared things allow and coordination costs. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "El paralelismo es hacer muchas partes de un trabajo en el mismo instante, en varios núcleos o máquinas. Más trabajadores ayudan solo hasta donde el trabajo se puede dividir, lo compartido lo permite y la coordinación lo cuesta. Esta lección construye esa idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: { intro: t("Each workbench is a core and each worker a thread. Watch eight workers share a job, then change the workers, the serial part or the chunks and see the speed-up move.", "Cada banco de trabajo es un núcleo y cada trabajador, un hilo. Mira a ocho trabajadores compartir un trabajo, y luego cambia los trabajadores, la parte serial o los bloques y observa cómo se mueve la aceleración."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs of one job.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados en seis ejecuciones con semilla de un mismo trabajo."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  script: live,
});
console.log("wrote parallelism-workbench.html", (size / 1024).toFixed(0) + " KB");
