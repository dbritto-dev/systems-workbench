// @ts-nocheck: content ported as-is
// Systems lesson 16 · The event loop: one operator, one desk, a conveyor of macrotasks and a tray of microtasks.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, P, GEOMETRY, BELT_SLOTS, MICRO_SLOTS, TIMER_SLOTS, HELPERS, DEPTH_MAX } from "./figure";
import { measure, orderPuzzle, LABEL_ES } from "./sim";
import { millis } from "../../lib/format";

// Experiment results, computed at build time from the same model the page runs (the original page ran these
// same deterministic runs in the browser when a card was run).
const RESULTS = {
  long: { a: measure({ job: 0 }), b: measure({ job: 200 }) },
  order: orderPuzzle(),
  flood: { a: measure({ job: 0 }), b: measure({ job: 0, flood: true }) },
  chunk: { a: measure({ job: 200 }), b: measure({ job: 200, chunk: true }) },
  worker: { a: measure({ job: 200 }), b: measure({ job: 200, worker: true }) },
};

// What each card shows after a run.
const RUNS = {
  long: () => {
    const { a, b } = RESULTS.long;
    const top = Math.max(a.lateMax, b.lateMax, a.gapMax, b.gapMax) * 1.05;
    return { verdict: t("With the 200 ms job, the 10 ms timer ran up to " + millis(b.lateMax) + " late (" + millis(a.lateMax) + " without it), and the longest gap between frames grew from " + millis(a.gapMax) + " to " + millis(b.gapMax) + ".",
        "Con el trabajo de 200 ms, el temporizador de 10 ms se ejecutó hasta " + millis(b.lateMax) + " tarde (" + millis(a.lateMax) + " sin él), y el mayor hueco entre cuadros creció de " + millis(a.gapMax) + " a " + millis(b.gapMax) + "."),
      bars: [[t("Timer late, no job", "Retraso de timer, sin trabajo"), a.lateMax / top, millis(a.lateMax)], [t("Timer late, 200 ms job", "Retraso de timer, trabajo de 200 ms"), b.lateMax / top, millis(b.lateMax), true], [t("Frame gap, no job", "Hueco entre cuadros, sin trabajo"), a.gapMax / top, millis(a.gapMax)], [t("Frame gap, 200 ms job", "Hueco entre cuadros, trabajo de 200 ms"), b.gapMax / top, millis(b.gapMax), true]] };
  },
  order: () => {
    const o = RESULTS.order, es = o.map((x) => LABEL_ES[x] || x);
    return { verdict: t("The order was: " + o.join(", then ") + ".", "El orden fue: " + es.join(", luego ") + "."),
      bars: o.map((x, i) => [(i + 1) + ". " + x.split(" ")[0], 1 - i / 3, t(["1st", "2nd", "3rd"][i], ["1.º", "2.º", "3.º"][i]), i === 0]) };
  },
  flood: () => {
    const { a, b } = RESULTS.flood;
    const top = Math.max(a.ioWaitMax, b.ioWaitMax, a.gapMax, b.gapMax) * 1.05;
    return { verdict: t("While the chain ran, I/O callbacks waited up to " + millis(b.ioWaitMax) + " (" + millis(a.ioWaitMax) + " without it), and the longest gap between frames was " + millis(b.gapMax) + ".",
        "Mientras corría la cadena, los callbacks de E/S esperaron hasta " + millis(b.ioWaitMax) + " (" + millis(a.ioWaitMax) + " sin ella), y el mayor hueco entre cuadros fue de " + millis(b.gapMax) + "."),
      bars: [[t("I/O wait, no chain", "Espera de E/S, sin cadena"), a.ioWaitMax / top, millis(a.ioWaitMax)], [t("I/O wait, promise chain", "Espera de E/S, cadena de promesas"), b.ioWaitMax / top, millis(b.ioWaitMax), true], [t("Frame gap, no chain", "Hueco entre cuadros, sin cadena"), a.gapMax / top, millis(a.gapMax)], [t("Frame gap, promise chain", "Hueco entre cuadros, cadena de promesas"), b.gapMax / top, millis(b.gapMax), true]] };
  },
  chunk: () => {
    const { a, b } = RESULTS.chunk;
    const gt = Math.max(a.gapMax, b.gapMax) * 1.05, jt = Math.max(a.jobAvg, b.jobAvg) * 1.05;
    return { verdict: t("In 5 ms chunks, the longest frame gap fell from " + millis(a.gapMax) + " to " + millis(b.gapMax) + ", and the job took " + millis(b.jobAvg) + " instead of " + millis(a.jobAvg) + ".",
        "En trozos de 5 ms, el mayor hueco entre cuadros bajó de " + millis(a.gapMax) + " a " + millis(b.gapMax) + ", y el trabajo tardó " + millis(b.jobAvg) + " en vez de " + millis(a.jobAvg) + "."),
      bars: [[t("Frame gap, one block", "Hueco entre cuadros, un bloque"), a.gapMax / gt, millis(a.gapMax)], [t("Frame gap, chunked", "Hueco entre cuadros, en trozos"), b.gapMax / gt, millis(b.gapMax), true], [t("Job time, one block", "Tiempo del trabajo, un bloque"), a.jobAvg / jt, millis(a.jobAvg)], [t("Job time, chunked", "Tiempo del trabajo, en trozos"), b.jobAvg / jt, millis(b.jobAvg), true]] };
  },
  worker: () => {
    const { a, b } = RESULTS.worker;
    const gt = Math.max(a.gapMax, b.gapMax) * 1.05, jt = Math.max(a.jobAvg, b.jobAvg) * 1.05;
    return { verdict: t("With a worker, the longest frame gap was " + millis(b.gapMax) + " (" + millis(a.gapMax) + " on the main thread), and the job took " + millis(b.jobAvg) + " instead of " + millis(a.jobAvg) + ".",
        "Con un worker, el mayor hueco entre cuadros fue de " + millis(b.gapMax) + " (" + millis(a.gapMax) + " en el hilo principal), y el trabajo tardó " + millis(b.jobAvg) + " en vez de " + millis(a.jobAvg) + "."),
      bars: [[t("Frame gap, main thread", "Hueco entre cuadros, hilo principal"), a.gapMax / gt, millis(a.gapMax)], [t("Frame gap, worker", "Hueco entre cuadros, worker"), b.gapMax / gt, millis(b.gapMax), true], [t("Job time, main thread", "Tiempo del trabajo, hilo principal"), a.jobAvg / jt, millis(a.jobAvg)], [t("Job time, worker", "Tiempo del trabajo, worker"), b.jobAvg / jt, millis(b.jobAvg), true]] };
  },
};

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

export default defineLesson({
  title: t("Event Loop Workbench", "Banco de trabajo: bucle de eventos"),
  eyebrow: t("Systems lesson 16 · The event loop", "Lección de sistemas 16 · El bucle de eventos"),
  lede: t("JavaScript runs your code on one thread, one task at a time. Everything else, from timers to network replies to drawing the screen, waits for that one thread to be free. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "JavaScript ejecuta tu código en un solo hilo, una tarea a la vez. Todo lo demás, desde los temporizadores hasta las respuestas de red y el dibujo de la pantalla, espera a que ese único hilo quede libre. Esta lección construye esa idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("One operator stands at the desk, which is the call stack. The conveyor feeding it is the macrotask queue, and the tray at the operator's hand is the microtask queue. Everything behind the partition happens in the background. Watch a few jobs go through, then make one job long and see whether the lamp keeps blinking.",
      "Un operador está en el escritorio, que es la pila de llamadas (call stack). La cinta que lo alimenta es la cola de macrotareas (macrotask queue), y la bandeja junto a su mano es la cola de microtareas (microtask queue). Todo lo que está detrás de la mampara ocurre en segundo plano. Mira pasar algunos trabajos, luego alarga uno y observa si la lámpara sigue parpadeando."),
    plate: {
      title: t("Event loop", "Bucle de eventos"),
      keys: [
        { mark: "lit", label: t("Lit: the task in the operator's hands, its frames on the spindle, the lamp on each frame", "Iluminado: la tarea en manos del operador, sus marcos de pila en el eje, la lámpara en cada cuadro") },
        { mark: "raised", label: t("Puck = timer, tile = I/O callback, block = CPU job, small disc = promise callback", "Ficha = temporizador, placa = callback de E/S, bloque = trabajo de CPU, disco pequeño = callback de promesa") },
        { mark: "flat", label: t("Conveyor = macrotask queue, tray at the operator's hand = microtask queue", "Cinta = cola de macrotareas, bandeja junto a la mano del operador = cola de microtareas") },
      ],
      caption: t(
        "One operator runs everything, one task at a time. After each task the operator empties the tray at their hand (the gate across the conveyor stays down while it holds anything), draws a frame if one is due (every 16 ms, and the lamp blinks), then takes the next item off the conveyor. Timers wait in the cabinet and slide onto the conveyor when due; the dots on the dial mark when. Behind the partition, four helpers do the I/O and send finished reads down the channel into the hopper. The dial turns once per 100 ms of loop time; at ×1, one second on screen is 40 ms of loop time.",
        "Un solo operador ejecuta todo, una tarea a la vez. Después de cada tarea, el operador vacía la bandeja junto a su mano (la barrera sobre la cinta queda baja mientras la bandeja tenga algo), dibuja un cuadro si toca uno (cada 16 ms, y la lámpara parpadea) y luego toma el siguiente elemento de la cinta. Los temporizadores esperan en el gabinete y pasan a la cinta cuando vencen; los puntos del dial marcan cuándo. Detrás de la mampara, cuatro ayudantes hacen la E/S y mandan las lecturas terminadas por el canal hasta la tolva. El dial da una vuelta cada 100 ms de tiempo del bucle; a ×1, un segundo en pantalla equivale a 40 ms de tiempo del bucle.",
      ),
      stage: { "data-loop": "" },
      label: t("Event loop simulation. Space pauses or resumes.", "Simulación del bucle de eventos. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["busy", t("Loop busy", "Bucle ocupado"), "–"], ["late", t("Timer late, max", "Retraso de timer, máx."), "–"], ["gap", t("Longest frame gap", "Mayor hueco entre cuadros"), "–"], ["io", t("I/O wait, avg", "Espera de E/S, prom."), "–"], ["job", t("Last job", "Último trabajo"), "–"], ["queue", t("Waiting", "En espera"), "0"]],
    controls: [
      { seg: "job", label: t("CPU job every 0.5 s", "Trabajo de CPU cada 0.5 s"), options: [[0, t("None", "Ninguno")], [50, "50 ms"], [200, "200 ms"]], value: 50 },
      { seg: "chunk", label: t("Split the job", "Dividir el trabajo"), options: [["false", t("Off", "No")], ["true", t("5 ms chunks", "Trozos de 5 ms")]], value: "false" },
      { seg: "worker", label: t("Worker thread", "Hilo de trabajo"), options: [["false", t("Off", "Apagado")], ["true", t("On", "Encendido")]], value: "false" },
      { seg: "flood", label: t("Promise chain", "Cadena de promesas"), options: [["false", t("Off", "Apagada")], ["true", t("On", "Encendida")]], value: "false" },
      { seg: "delay", label: t("setTimeout delay", "Retraso de setTimeout"), options: [[0, "0 ms"], [10, "10 ms"], [50, "50 ms"]], value: 10 },
      { speed: true },
      { actions: [["puzzle", t("Run the order puzzle", "Resolver el acertijo del orden")], ["reset", t("Reset counts", "Reiniciar conteos")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Acciones") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over four 3-second runs of loop time.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la figura, promediados en cuatro ejecuciones de 3 segundos de tiempo del bucle."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
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
`,
  data: {
    P,
    G: GEOMETRY,
    SLOTS: { belt: BELT_SLOTS, micro: MICRO_SLOTS, timers: TIMER_SLOTS, helpers: HELPERS, depth: DEPTH_MAX },
  },
});
