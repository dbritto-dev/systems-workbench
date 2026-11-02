// Systems lesson 16 · The event loop. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, BELT_SLOTS, MICRO_SLOTS, TIMER_SLOTS, HELPERS, DEPTH_MAX } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "long",
    title: t("One long job", "Un trabajo largo"),
    change: t("CPU job none → 200 ms of synchronous work every half second · setTimeout(…, 10) still armed every 100 ms", "Trabajo de CPU ninguno → 200 ms de trabajo síncrono cada medio segundo · setTimeout(…, 10) se sigue armando cada 100 ms"),
    question: t("What happens to a timer that is due 10 ms from now while the job runs?", "¿Qué pasa con un temporizador que vence dentro de 10 ms mientras corre el trabajo?"),
    options: [t("It fires on time: timers are kept outside the loop", "Se dispara a tiempo: los temporizadores se guardan fuera del bucle"), t("It waits until the job finishes, up to about 200 ms late", "Espera a que termine el trabajo, hasta unos 200 ms tarde"), t("It is skipped and fires on the next round", "Se salta y se dispara en la siguiente vuelta")],
    answer: 1,
    why: t("The timer is kept outside the loop, and it does become due on time: it drops onto the conveyor after 10 ms. But only the operator runs callbacks, and the operator is busy with the job. Nothing interrupts running JavaScript, so the callback, every I/O callback and every frame wait their turn behind it. A delay is a minimum, never a promise.",
      "El temporizador se guarda fuera del bucle y sí vence a tiempo: cae en la cinta después de 10 ms. Pero solo el operador ejecuta callbacks, y el operador está ocupado con el trabajo. Nada interrumpe JavaScript en ejecución, así que el callback, cada callback de E/S y cada cuadro (frame) esperan su turno detrás. Un retraso es un mínimo, nunca una promesa."),
    watch: { job: 200, chunk: false, worker: false, flood: false, delay: 10 },
  },
  {
    id: "order",
    title: t("Who goes first", "Quién va primero"),
    change: t("One script: setTimeout(cb, 0), then Promise.resolve().then(cb), then console.log(…)", "Un script: setTimeout(cb, 0), luego Promise.resolve().then(cb), luego console.log(…)"),
    question: t("In what order do the three run?", "¿En qué orden se ejecutan los tres?"),
    options: ["setTimeout(0), Promise.then, console.log", "console.log, Promise.then, setTimeout(0)", "console.log, setTimeout(0), Promise.then"],
    answer: 1,
    why: t("The script itself is on the stack, so its console.log runs first. When it ends, the operator empties the microtask tray before touching the conveyor, so the promise callback runs next. The timer callback, even with a delay of 0, is a macrotask: it waits on the conveyor until the stack and the tray are both empty.",
      "El script mismo está en la pila, así que su console.log se ejecuta primero. Cuando termina, el operador vacía la bandeja de microtareas antes de tocar la cinta, así que el callback de la promesa va después. El callback del temporizador, incluso con retraso 0, es una macrotarea: espera en la cinta hasta que la pila y la bandeja estén vacías."),
    watch: { puzzle: true },
  },
  {
    id: "flood",
    title: t("A promise chain that never yields", "Una cadena de promesas que nunca cede"),
    change: t("Promise chain on · 400 callbacks of 0.5 ms, each queuing the next", "Cadena de promesas encendida · 400 callbacks de 0.5 ms, cada uno encola el siguiente"),
    question: t("Each callback is tiny. What happens to I/O callbacks and frames while the chain runs?", "Cada callback es diminuto. ¿Qué pasa con los callbacks de E/S y los cuadros mientras corre la cadena?"),
    options: [t("Nothing: each callback is only half a millisecond", "Nada: cada callback dura solo medio milisegundo"), t("They wait until the whole chain is done, about 200 ms", "Esperan a que termine toda la cadena, unos 200 ms"), t("They take turns with the chain, one each", "Se turnan con la cadena, uno cada uno")],
    answer: 1,
    why: t("The rule is to empty the microtask tray completely before anything else. A callback that queues another callback keeps the tray from ever being empty, so 400 small steps behave like one 200 ms block. This is how code full of await, with no long function anywhere, can still freeze a page or stall a server.",
      "La regla es vaciar por completo la bandeja de microtareas antes que cualquier otra cosa. Un callback que encola otro callback impide que la bandeja se vacíe nunca, así que 400 pasos pequeños se comportan como un bloque de 200 ms. Así es como un código lleno de await, sin ninguna función larga, puede igual congelar una página o trabar un servidor."),
    watch: { job: 0, chunk: false, worker: false, flood: true, delay: 10 },
  },
  {
    id: "chunk",
    title: t("Split the job", "Dividir el trabajo"),
    change: t("200 ms job → 40 chunks of 5 ms, each queued at the back of the conveyor", "Trabajo de 200 ms → 40 trozos de 5 ms, cada uno encolado al final de la cinta"),
    question: t("What happens to the longest gap between frames, and to how long the job takes?", "¿Qué pasa con el mayor hueco entre cuadros, y con cuánto tarda el trabajo?"),
    options: [t("Same freeze, just in pieces", "El mismo congelamiento, solo que en pedazos"), t("Frames stay smooth; the job finishes a little later", "Los cuadros siguen fluidos; el trabajo termina un poco más tarde"), t("Frames stay smooth and the job finishes sooner", "Los cuadros siguen fluidos y el trabajo termina antes")],
    answer: 1,
    why: t("Each chunk goes to the back of the line, so timers, I/O callbacks and frames slip in between. Nobody waits more than one chunk. The total work is the same, plus everyone else's turns in between, so the job itself finishes a little later. You trade a little throughput for a lot of responsiveness.",
      "Cada trozo va al final de la fila, así que los temporizadores, los callbacks de E/S y los cuadros se cuelan en medio. Nadie espera más de un trozo. El trabajo total es el mismo, más los turnos de todos los demás en medio, así que el trabajo en sí termina un poco más tarde. Cambias un poco de rendimiento (throughput) por mucha capacidad de respuesta."),
    watch: { job: 200, chunk: true, worker: false, flood: false, delay: 10 },
  },
  {
    id: "worker",
    title: t("Hand it to a worker", "Pasárselo a un worker"),
    change: t("200 ms job → posted to a worker thread; the result comes back as a message", "Trabajo de 200 ms → enviado a un hilo de trabajo (worker thread); el resultado vuelve como mensaje"),
    question: t("What happens to the loop, and to how long the job takes?", "¿Qué pasa con el bucle, y con cuánto tarda el trabajo?"),
    options: [t("The loop stays responsive, and the job takes about as long", "El bucle sigue respondiendo y el trabajo tarda más o menos lo mismo"), t("The job runs twice as fast", "El trabajo corre el doble de rápido"), t("The loop still freezes: the worker shares the same thread", "El bucle se congela igual: el worker comparte el mismo hilo")],
    answer: 0,
    why: t("A worker is a second thread with its own loop. The main loop only spends half a millisecond posting the job and one millisecond handling the result, so timers and frames stay on time. The job is not faster: the same 200 ms of work happens on another core. Workers cost memory and a copy of the data, so they suit heavy, self-contained work.",
      "Un worker es un segundo hilo con su propio bucle. El bucle principal solo gasta medio milisegundo en enviar el trabajo y un milisegundo en atender el resultado, así que los temporizadores y los cuadros siguen a tiempo. El trabajo no es más rápido: los mismos 200 ms de trabajo ocurren en otro núcleo. Los workers cuestan memoria y una copia de los datos, así que convienen para trabajo pesado y autocontenido."),
    watch: { job: 200, chunk: false, worker: true, flood: false, delay: 10 },
  },
];

const QUESTIONS = [
  [t("setTimeout(fn, 10) ran 180 ms late. Nothing was wrong with the timer. What was?", "setTimeout(fn, 10) se ejecutó 180 ms tarde. El temporizador no tenía nada malo. ¿Qué lo tenía?"),
    t("Something else held the call stack: a long synchronous function, a big JSON.parse, a loop over a large array, or a chain of microtasks. The delay only says when the callback may run at the earliest. It runs when the stack is empty and the microtasks are drained.",
      "Otra cosa ocupaba la pila de llamadas (call stack): una función síncrona larga, un JSON.parse grande, un bucle sobre un arreglo enorme o una cadena de microtareas. El retraso solo dice cuándo puede ejecutarse el callback como muy pronto. Se ejecuta cuando la pila está vacía y las microtareas se vaciaron.")],
  [t("Why do promise callbacks run before a setTimeout(0) callback queued earlier?", "¿Por qué los callbacks de promesas se ejecutan antes que un callback de setTimeout(0) encolado antes?"),
    t("Promise callbacks are microtasks, timer callbacks are macrotasks. After each macrotask the loop empties the whole microtask queue before it takes the next macrotask or draws a frame. Queue order only matters within the same queue.",
      "Los callbacks de promesas son microtareas; los de temporizadores, macrotareas. Después de cada macrotarea el bucle vacía toda la cola de microtareas (microtask queue) antes de tomar la siguiente macrotarea o dibujar un cuadro. El orden de llegada solo importa dentro de la misma cola.")],
  [t("A page freezes but the profiler shows no single long function, only thousands of tiny async callbacks. How is that possible?", "Una página se congela, pero el profiler no muestra ninguna función larga, solo miles de callbacks async diminutos. ¿Cómo es posible?"),
    t("A chain of microtasks (a recursive .then, an await inside a tight loop that never really waits) keeps the microtask queue from emptying, so frames, timers and I/O never get a turn. The fix is to yield to the macrotask queue (setTimeout, setImmediate, scheduler.yield) every so often, or to batch the work.",
      "Una cadena de microtareas (un .then recursivo, un await dentro de un bucle cerrado que nunca espera de verdad) impide que la cola de microtareas se vacíe, así que los cuadros, los temporizadores y la E/S nunca tienen turno. La solución es ceder a la cola de macrotareas (setTimeout, setImmediate, scheduler.yield) cada tanto, o agrupar el trabajo en lotes.")],
  [t("Your Node API has to parse a 50 MB JSON upload. What are the options, and what does each cost?", "Tu API en Node tiene que parsear un JSON subido de 50 MB. ¿Qué opciones hay y cuánto cuesta cada una?"),
    t("Parsing it on the main thread blocks every other request for the whole parse. Splitting the work keeps the loop responsive but makes this request slower. A worker thread keeps the loop free but costs memory and a copy of the data. A streaming parser avoids holding it all at once. Moving the work to a queue and a separate service removes it from the API entirely.",
      "Parsearlo en el hilo principal bloquea todas las demás solicitudes durante todo el parseo. Dividir el trabajo mantiene el bucle respondiendo pero hace más lenta esta solicitud. Un worker thread deja libre el bucle pero cuesta memoria y una copia de los datos. Un parser en streaming evita tenerlo todo en memoria a la vez. Mover el trabajo a una cola y a un servicio aparte lo saca por completo de la API.")],
  [t("Node reads files on a pool of four helper threads. What happens if 20 slow file reads arrive at once?", "Node lee archivos en un pool de cuatro hilos ayudantes. ¿Qué pasa si llegan 20 lecturas lentas de archivos a la vez?"),
    t("Four run, sixteen wait for a free helper, and their callbacks arrive later. DNS lookups and some crypto use the same pool, so they wait too. The pool size can be raised (UV_THREADPOOL_SIZE). Network sockets don't use the pool, because the operating system already does them asynchronously.",
      "Cuatro se ejecutan, dieciséis esperan un ayudante libre y sus callbacks llegan más tarde. Las búsquedas de DNS y parte de la criptografía usan el mismo pool, así que también esperan. El tamaño del pool se puede aumentar (UV_THREADPOOL_SIZE). Los sockets de red no usan el pool, porque el sistema operativo ya los maneja de forma asíncrona.")],
  [t("What would you measure in production to catch these problems early?", "¿Qué medirías en producción para detectar estos problemas a tiempo?"),
    t("Event-loop delay (for example perf_hooks.monitorEventLoopDelay in Node or the long-task API in browsers): how late a timer that should fire every few milliseconds actually fires. A rising p99 delay means something is holding the stack, long before users complain about timeouts.",
      "El retraso del bucle de eventos (event-loop delay), por ejemplo con perf_hooks.monitorEventLoopDelay en Node o la API de long tasks en navegadores: qué tan tarde se dispara de verdad un temporizador que debería dispararse cada pocos milisegundos. Un retraso p99 en aumento indica que algo retiene la pila, mucho antes de que los usuarios se quejen de tiempos de espera agotados (timeouts).")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Event loop", "Bucle de eventos"),
  keys: [
    { mark: "lit", label: t("Lit: the task in the operator's hands, its frames on the spindle, the lamp on each frame", "Iluminado: la tarea en manos del operador, sus marcos de pila en el eje, la lámpara en cada cuadro") },
    { mark: "raised", label: t("Puck = timer, tile = I/O callback, block = CPU job, small disc = promise callback", "Ficha = temporizador, placa = callback de E/S, bloque = trabajo de CPU, disco pequeño = callback de promesa") },
    { mark: "flat", label: t("Conveyor = macrotask queue, tray at the operator's hand = microtask queue", "Cinta = cola de macrotareas, bandeja junto a la mano del operador = cola de microtareas") },
  ],
  caption: t(
    "One operator runs everything, one task at a time. After each task the operator empties the tray at their hand (the gate across the conveyor stays down while it holds anything), draws a frame if one is due (every 16 ms, and the lamp blinks), then takes the next item off the conveyor. Timers wait in the cabinet and slide onto the conveyor when due; the dots on the dial mark when. Behind the partition, four helpers do the I/O and send finished reads down the channel into the hopper. The dial turns once per 100 ms of loop time; at ×1, one second on screen is 40 ms of loop time.",
    "Un solo operador ejecuta todo, una tarea a la vez. Después de cada tarea, el operador vacía la bandeja junto a su mano (la barrera sobre la cinta queda baja mientras la bandeja tenga algo), dibuja un cuadro si toca uno (cada 16 ms, y la lámpara parpadea) y luego toma el siguiente elemento de la cinta. Los temporizadores esperan en el gabinete y pasan a la cinta cuando vencen; los puntos del dial marcan cuándo. Detrás de la mampara, cuatro ayudantes hacen la E/S y mandan las lecturas terminadas por el canal hasta la tolva. El dial da una vuelta cada 100 ms de tiempo del bucle; a ×1, un segundo en pantalla equivale a 40 ms de tiempo del bucle."),
  stage: "data-loop",
  stageLabel: t("Event loop simulation. Space pauses or resumes.", "Simulación del bucle de eventos. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const controls = panel({
  stats: [["busy", t("Loop busy", "Bucle ocupado"), "–"], ["late", t("Timer late, max", "Retraso de timer, máx."), "–"], ["gap", t("Longest frame gap", "Mayor hueco entre cuadros"), "–"], ["io", t("I/O wait, avg", "Espera de E/S, prom."), "–"], ["job", t("Last job", "Último trabajo"), "–"], ["queue", t("Waiting", "En espera"), "0"]],
  controls: [
    seg("job", t("CPU job every 0.5 s", "Trabajo de CPU cada 0.5 s"), [[0, t("None", "Ninguno")], [50, "50 ms"], [200, "200 ms"]], 50),
    seg("chunk", t("Split the job", "Dividir el trabajo"), [["false", t("Off", "No")], ["true", t("5 ms chunks", "Trozos de 5 ms")]], "false"),
    seg("worker", t("Worker thread", "Hilo de trabajo"), [["false", t("Off", "Apagado")], ["true", t("On", "Encendido")]], "false"),
    seg("flood", t("Promise chain", "Cadena de promesas"), [["false", t("Off", "Apagada")], ["true", t("On", "Encendida")]], "false"),
    seg("delay", t("setTimeout delay", "Retraso de setTimeout"), [[0, "0 ms"], [10, "10 ms"], [50, "50 ms"]], 10),
    speedSeg(),
    actions(t("Do something", "Acciones"), [["puzzle", t("Run the order puzzle", "Resolver el acertijo del orden")], ["reset", t("Reset counts", "Reiniciar conteos")], ["pause", t("Pause", "Pausa")]]),
  ],
});

const css = `
[data-slot] > [data-k]{display:none}
[data-slot][data-kind="timer"] > [data-k="timer"],[data-slot][data-kind="io"] > [data-k="io"],[data-slot][data-kind="cpu"] > [data-k="cpu"],[data-slot][data-kind="promise"] > [data-k="promise"],[data-slot][data-kind="frame"] > [data-k="frame"]{display:inline}
.bar-fill{fill:var(--anatomy-mid);stroke:none}
[data-lamp="on"]{display:none}
[data-flash] [data-lamp="on"]{display:inline}
[data-flash] [data-lamp="off"]{display:none}
[data-worker-cover][data-off]{display:none}
[data-gate-arm="down"]{display:none}
[data-gate] [data-gate-arm="down"]{display:inline}
[data-gate] [data-gate-arm="up"]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, options, watch }) => ({ id, answer, options, watch })))};
const SLOTS = { belt: ${BELT_SLOTS}, micro: ${MICRO_SLOTS}, timers: ${TIMER_SLOTS}, helpers: ${HELPERS}, depth: ${DEPTH_MAX} };
const MS_PER_SECOND = 40;
const tr = WB.L, T = WB.T;
// Task labels come from the model in English; code names stay as they are.
const LABEL_ES = { "post to worker": "enviar al worker", "worker result": "resultado del worker", "CPU job": "trabajo de CPU", "CPU chunk": "trozo de CPU", "start promise chain": "iniciar cadena de promesas", "I/O callback": "callback de E/S", "frame": "cuadro",
  "setTimeout(0) callback": "callback de setTimeout(0)", "Promise.then callback": "callback de Promise.then", "console.log in the script": "console.log en el script" };
const lbl = (s) => (WB.lang() === "es" && LABEL_ES[s]) || s;

const stage = document.querySelector("[data-loop]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const slotEls = {};
svg.querySelectorAll("[data-slot]").forEach((el) => { slotEls[el.dataset.slot] = el; });
const setKind = (name, kind) => { const el = slotEls[name], v = kind || ""; if (el.dataset.kind !== v) el.dataset.kind = v; };
const frameEls = [...svg.querySelectorAll("[data-frame]")];
const needle = q("[data-needle]");
const dueEls = [...svg.querySelectorAll("[data-due]")];
const deskBar = q("[data-desk-bar]"), workerBar = q("[data-worker-bar]"), cover = q("[data-worker-cover]");
const helperBars = [...svg.querySelectorAll("[data-helper-bar]")];
const bar = (b, share) => share > 0.01 ? WB.faceRectY(P, b.x0, b.x0 + (b.x1 - b.x0) * Math.min(1, share), b.y, b.z0, b.z1) : "";
const setD = (el, d) => { if (el.getAttribute("d") !== d) el.setAttribute("d", d); };

const cfg = { job: 50, chunk: false, flood: false, worker: false, delay: 10, speed: 1 };
let loop = createLoop(cfg, 7);
let puzzle = null;
loop.nextFrame = 0;
// A representative moment for the first frame: the operator 30 ms into a CPU job, two promise callbacks
// waiting in the tray (so the gate is down), mixed work on the conveyor, timers armed, helpers reading.
(function seed(L) {
  advance(L, 520);
  L.micro.push(task(L, "promise", "promise.then", 0.5, () => {}), task(L, "promise", "promise.then", 0.5, () => {}));
  L.macro.push(task(L, "io", "I/O callback", 1, () => {}), task(L, "cpu", "CPU job", 20, () => {}), task(L, "timer", "setTimeout", 0.5, () => {}, { due: L.t, set: L.t }));
  armTimer(L, 45, "setTimeout 45"); armTimer(L, 80, "setTimeout 80");
  L.helpers.forEach((h, i) => { if (!h && i < 3) L.helpers[i] = { id: L.nextSeq++, queued: L.t, ms: 30, left: 12 + i * 7, total: 30 }; });
  resetStats(L);
})(loop);

const stackDepth = (r) => !r ? 0 : r.kind === "cpu" ? 3 : r.kind === "promise" ? 2 : 1;
const msText = (v) => (v < 10 ? v.toFixed(1) : Math.round(v)) + " ms";

function paint() {
  const L = loop;
  for (let i = 0; i < SLOTS.belt; i++) setKind("c" + i, L.macro[i] && L.macro[i].kind);
  for (let i = 0; i < SLOTS.micro; i++) setKind("m" + i, L.micro[i] ? "promise" : "");
  const timers = [...L.timers].sort((a, b) => a.due - b.due);
  for (let i = 0; i < SLOTS.timers; i++) setKind("t" + i, timers[i] ? "timer" : "");
  L.helpers.forEach((h, i) => { setKind("h" + i, h ? "io" : ""); setD(helperBars[i], h ? bar(G.helperBars[i], 1 - h.left / h.total) : ""); });
  setKind("w", L.worker ? "cpu" : "");
  setD(workerBar, L.worker ? bar(G.workerBar, 1 - L.worker.left / L.worker.total) : "");
  cover.toggleAttribute("data-off", !!L.cfg.worker);
  const r = L.running;
  setKind("run", r && r.kind);
  setD(deskBar, r && r.total > 2 ? bar(G.DESK_STRIP, 1 - r.left / r.total) : "");
  const depth = stackDepth(r);
  frameEls.forEach((el, i) => { const show = i < depth ? "" : "none"; if (el.style.display !== show) el.style.display = show; });
  svg.toggleAttribute("data-flash", L.flash > 0);
  svg.toggleAttribute("data-gate", L.micro.length > 0 || !!(L.running && L.running.kind === "promise"));
  const D = G.dial, hand = (turn, r0, r1) => { const a = turn * Math.PI * 2; return [[D.x - Math.sin(a) * r0, D.y + Math.cos(a) * r0], [D.x + Math.sin(a) * r1, D.y - Math.cos(a) * r1]]; };
  const [n0, n1] = hand((L.t % 100) / 100, 2.4, D.r - 3.2);
  setD(needle, lineOnTop(n0, n1, D.z + 0.2, P));
  dueEls.forEach((el, i) => {
    const tm = timers[i];
    if (!tm) { if (el.style.display !== "none") el.style.display = "none"; return; }
    const [, p] = hand((tm.due % 100) / 100, 0, D.r - 5.2), [x, y] = iso([p[0], p[1], D.z], P);
    el.setAttribute("cx", x.toFixed(1)); el.setAttribute("cy", y.toFixed(1)); el.style.display = "";
  });
  showStats();
  if (puzzle && puzzle.order.length) {
    say(puzzle.order.map((x, i) => (i + 1) + ". " + lbl(x)).join(" · "));
    if (puzzle.order.length === 3 && L.t > puzzle.until) puzzle = null;
  } else if (!puzzle) {
    if (WB.lang() === "es") {
      const waiting = L.macro.length + " en la cinta · " + L.micro.length + " en la bandeja";
      say(r ? lbl(r.label) + (r.total > 2 ? " · quedan " + Math.ceil(r.left) + " ms" : "") + " · " + waiting : "inactivo · " + waiting);
    } else {
      const waiting = L.macro.length + " on the conveyor · " + L.micro.length + " in the tray";
      say(r ? r.label + (r.total > 2 ? " · " + Math.ceil(r.left) + " ms left" : "") + " · " + waiting : "idle · " + waiting);
    }
  } else say(tr(puzzle.msg));
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  const s = loop.stats, span = loop.t - s.since;
  const put = (k, v) => { if (statEls[k].textContent !== v) statEls[k].textContent = v; };
  put("busy", span > 20 ? Math.round((100 * s.busy) / span) + "%" : "–");
  put("late", s.timers ? msText(s.lateMax) : "–");
  put("gap", span > 40 ? msText(Math.max(s.gapMax, loop.t - loop.lastFrame)) : "–");
  put("io", s.ioDone ? msText(s.ioWaitSum / s.ioDone) : "–");
  put("job", s.jobs ? msText(s.lastJob) : "–");
  put("queue", String(loop.macro.length + loop.micro.length));
}

function runPuzzle() {
  const L = loop;
  const order = [];
  puzzle = { order, until: L.t + 60, msg: T("script queued at the front of the conveyor", "script encolado al frente de la cinta") };
  L.macro.unshift(task(L, "io", "script", 3, () => {
    armTimer(L, 0, "setTimeout 0", () => order.push("setTimeout(0) callback"));
    L.micro.unshift(task(L, "promise", "promise.then", 1, () => order.push("Promise.then callback")));
    order.push("console.log in the script");
  }));
  say(tr(puzzle.msg));
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(loop, dt * cfg.speed * MS_PER_SECOND); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); if (on) say(tr("paused", "en pausa")); } });
clock.setPaused(clock.paused);
WB.onLang(() => { pauseBtn.textContent = clock.paused ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); paint(); if (clock.paused) say(tr("paused", "en pausa")); });
function resetCounts() { resetStats(loop); showStats(); }
function set(name, raw) {
  if (name === "speed") cfg.speed = Number(raw);
  else if (name === "job" || name === "delay") { cfg[name] = Number(raw); loop.cfg[name] = Number(raw); if (name === "job") loop.nextCycle = Math.min(loop.nextCycle, loop.t + 20); resetCounts(); }
  else { cfg[name] = raw === "true" || raw === true; loop.cfg[name] = cfg[name]; if (name === "flood" && cfg.flood) loop.nextCycle = Math.min(loop.nextCycle, loop.t + 20); resetCounts(); }
  WB.pressSeg(name, raw);
}
WB.onSegments(set);
document.querySelector('[data-act="reset"]').addEventListener("click", resetCounts);
document.querySelector('[data-act="puzzle"]').addEventListener("click", () => { runPuzzle(); if (clock.paused) clock.setPaused(false); });
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const ms = (v) => msText(v);
const RUNS = {
  long: () => {
    const a = measure({ job: 0 }), b = measure({ job: 200 });
    const top = Math.max(a.lateMax, b.lateMax, a.gapMax, b.gapMax) * 1.05;
    return { verdict: T("With the 200 ms job, the 10 ms timer ran up to " + ms(b.lateMax) + " late (" + ms(a.lateMax) + " without it), and the longest gap between frames grew from " + ms(a.gapMax) + " to " + ms(b.gapMax) + ".",
        "Con el trabajo de 200 ms, el temporizador de 10 ms se ejecutó hasta " + ms(b.lateMax) + " tarde (" + ms(a.lateMax) + " sin él), y el mayor hueco entre cuadros creció de " + ms(a.gapMax) + " a " + ms(b.gapMax) + "."),
      bars: [[T("Timer late, no job", "Retraso de timer, sin trabajo"), a.lateMax / top, ms(a.lateMax)], [T("Timer late, 200 ms job", "Retraso de timer, trabajo de 200 ms"), b.lateMax / top, ms(b.lateMax), true], [T("Frame gap, no job", "Hueco entre cuadros, sin trabajo"), a.gapMax / top, ms(a.gapMax)], [T("Frame gap, 200 ms job", "Hueco entre cuadros, trabajo de 200 ms"), b.gapMax / top, ms(b.gapMax), true]] };
  },
  order: () => {
    const o = orderPuzzle(), es = o.map((x) => LABEL_ES[x] || x);
    return { verdict: T("The order was: " + o.join(", then ") + ".", "El orden fue: " + es.join(", luego ") + "."),
      bars: o.map((x, i) => [(i + 1) + ". " + x.split(" ")[0], 1 - i / 3, T(["1st", "2nd", "3rd"][i], ["1.º", "2.º", "3.º"][i]), i === 0]) };
  },
  flood: () => {
    const a = measure({ job: 0 }), b = measure({ job: 0, flood: true });
    const top = Math.max(a.ioWaitMax, b.ioWaitMax, a.gapMax, b.gapMax) * 1.05;
    return { verdict: T("While the chain ran, I/O callbacks waited up to " + ms(b.ioWaitMax) + " (" + ms(a.ioWaitMax) + " without it), and the longest gap between frames was " + ms(b.gapMax) + ".",
        "Mientras corría la cadena, los callbacks de E/S esperaron hasta " + ms(b.ioWaitMax) + " (" + ms(a.ioWaitMax) + " sin ella), y el mayor hueco entre cuadros fue de " + ms(b.gapMax) + "."),
      bars: [[T("I/O wait, no chain", "Espera de E/S, sin cadena"), a.ioWaitMax / top, ms(a.ioWaitMax)], [T("I/O wait, promise chain", "Espera de E/S, cadena de promesas"), b.ioWaitMax / top, ms(b.ioWaitMax), true], [T("Frame gap, no chain", "Hueco entre cuadros, sin cadena"), a.gapMax / top, ms(a.gapMax)], [T("Frame gap, promise chain", "Hueco entre cuadros, cadena de promesas"), b.gapMax / top, ms(b.gapMax), true]] };
  },
  chunk: () => {
    const a = measure({ job: 200 }), b = measure({ job: 200, chunk: true });
    const gt = Math.max(a.gapMax, b.gapMax) * 1.05, jt = Math.max(a.jobAvg, b.jobAvg) * 1.05;
    return { verdict: T("In 5 ms chunks, the longest frame gap fell from " + ms(a.gapMax) + " to " + ms(b.gapMax) + ", and the job took " + ms(b.jobAvg) + " instead of " + ms(a.jobAvg) + ".",
        "En trozos de 5 ms, el mayor hueco entre cuadros bajó de " + ms(a.gapMax) + " a " + ms(b.gapMax) + ", y el trabajo tardó " + ms(b.jobAvg) + " en vez de " + ms(a.jobAvg) + "."),
      bars: [[T("Frame gap, one block", "Hueco entre cuadros, un bloque"), a.gapMax / gt, ms(a.gapMax)], [T("Frame gap, chunked", "Hueco entre cuadros, en trozos"), b.gapMax / gt, ms(b.gapMax), true], [T("Job time, one block", "Tiempo del trabajo, un bloque"), a.jobAvg / jt, ms(a.jobAvg)], [T("Job time, chunked", "Tiempo del trabajo, en trozos"), b.jobAvg / jt, ms(b.jobAvg), true]] };
  },
  worker: () => {
    const a = measure({ job: 200 }), b = measure({ job: 200, worker: true });
    const gt = Math.max(a.gapMax, b.gapMax) * 1.05, jt = Math.max(a.jobAvg, b.jobAvg) * 1.05;
    return { verdict: T("With a worker, the longest frame gap was " + ms(b.gapMax) + " (" + ms(a.gapMax) + " on the main thread), and the job took " + ms(b.jobAvg) + " instead of " + ms(a.jobAvg) + ".",
        "Con un worker, el mayor hueco entre cuadros fue de " + ms(b.gapMax) + " (" + ms(a.gapMax) + " en el hilo principal), y el trabajo tardó " + ms(b.jobAvg) + " en vez de " + ms(a.jobAvg) + "."),
      bars: [[T("Frame gap, main thread", "Hueco entre cuadros, hilo principal"), a.gapMax / gt, ms(a.gapMax)], [T("Frame gap, worker", "Hueco entre cuadros, worker"), b.gapMax / gt, ms(b.gapMax), true], [T("Job time, main thread", "Tiempo del trabajo, hilo principal"), a.jobAvg / jt, ms(a.jobAvg)], [T("Job time, worker", "Tiempo del trabajo, worker"), b.jobAvg / jt, ms(b.jobAvg), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  if (w.puzzle) { set("job", 0); set("flood", "false"); set("worker", "false"); set("chunk", "false"); setTimeout(runPuzzle, 800); }
  else for (const k of ["job", "chunk", "worker", "flood", "delay"]) set(k, String(w[k]));
  if (cfg.speed > 1) set("speed", 1);
  if (clock.paused) clock.setPaused(false);
} });

paint();
`;

const size = writePage(new URL("./event-loop-workbench.html", import.meta.url), {
  title: t("Event Loop Workbench", "Banco de trabajo: bucle de eventos"),
  eyebrow: t("Systems lesson 16 · The event loop", "Lección de sistemas 16 · El bucle de eventos"),
  lede: t("JavaScript runs your code on one thread, one task at a time. Everything else, from timers to network replies to drawing the screen, waits for that one thread to be free. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "JavaScript ejecuta tu código en un solo hilo, una tarea a la vez. Todo lo demás, desde los temporizadores hasta las respuestas de red y el dibujo de la pantalla, espera a que ese único hilo quede libre. Esta lección construye esa idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: { intro: t("One operator stands at the desk, which is the call stack. The conveyor feeding it is the macrotask queue, and the tray at the operator's hand is the microtask queue. Everything behind the partition happens in the background. Watch a few jobs go through, then make one job long and see whether the lamp keeps blinking.",
    "Un operador está en el escritorio, que es la pila de llamadas (call stack). La cinta que lo alimenta es la cola de macrotareas (macrotask queue), y la bandeja junto a su mano es la cola de microtareas (microtask queue). Todo lo que está detrás de la mampara ocurre en segundo plano. Mira pasar algunos trabajos, luego alarga uno y observa si la lámpara sigue parpadeando."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over four 3-second runs of loop time.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la figura, promediados en cuatro ejecuciones de 3 segundos de tiempo del bucle."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote event-loop-workbench.html", (size / 1024).toFixed(0) + " KB");
