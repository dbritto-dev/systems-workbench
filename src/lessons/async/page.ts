// @ts-nocheck: content ported as-is
// Systems lesson 15 · Async I/O: a restaurant pass with one desk (the CPU), a ticket rail, a bell and a kitchen.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, P, GEOMETRY } from "./figure";
import { threadsRun, cpuRun, loopRun, limitRun, blockRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the original ran them in the browser).
const RESULTS = { threads: threadsRun(), cpu: cpuRun(), loop: loopRun(), limit: limitRun(), block: blockRun() };

// What each card shows after a run.
const secs = (ms) => (ms / 1000).toFixed(2) + " s";
const RUNS = {
  threads: () => { const { a, b, c } = RESULTS.threads; const top = Math.max(a.throughput, b.throughput) * 1.05;
    const ar = a.throughput.toFixed(0), br = b.throughput.toFixed(0), cr = c.throughput.toFixed(0), more = (b.throughput / a.throughput).toFixed(1);
    return { verdict: t("4 blocking threads: " + ar + " orders/s, done in " + secs(a.total) + ". One async waiter: " + br + " orders/s, done in " + secs(b.total) + " (" + more + "× more). For comparison, 32 blocking threads, one per burner, reach " + cr + " orders/s.",
        "4 hilos bloqueantes: " + ar + " pedidos/s, listos en " + secs(a.total) + ". Un mesero async: " + br + " pedidos/s, listos en " + secs(b.total) + " (" + more + "× más). Como referencia, 32 hilos bloqueantes, uno por quemador, llegan a " + cr + " pedidos/s."),
      bars: [[t("4 blocking threads", "4 hilos bloqueantes"), a.throughput / top, ar + "/s"], [t("1 async waiter", "1 mesero async"), b.throughput / top, br + "/s", true]] }; },
  cpu: () => { const { a, b } = RESULTS.cpu; const top = Math.max(a.total, b.total) * 1.05;
    const busy = Math.round(b.busy * 100);
    return { verdict: t("4 blocking threads: " + secs(a.total) + ". One async waiter: " + secs(b.total) + ". The desk was busy " + busy + "% of the time either way.",
        "4 hilos bloqueantes: " + secs(a.total) + ". Un mesero async: " + secs(b.total) + ". El mostrador estuvo ocupado el " + busy + "% del tiempo en ambos casos."),
      bars: [[t("4 blocking threads", "4 hilos bloqueantes"), a.total / top, secs(a.total)], [t("1 async waiter", "1 mesero async"), b.total / top, secs(b.total), true]] }; },
  loop: () => { const { a, b } = RESULTS.loop; const top = Math.max(a.total, b.total) * 1.05;
    const x = Math.round(a.total / b.total);
    return { verdict: t("Await in a loop: " + secs(a.total) + ". Gather: " + secs(b.total) + " (" + x + "× faster).",
        "Await en un bucle: " + secs(a.total) + ". Gather: " + secs(b.total) + " (" + x + "× más rápido)."),
      bars: [[t("Await in a loop", "Await en un bucle"), a.total / top, secs(a.total)], [t("Gather", "Gather (reunir)"), b.total / top, secs(b.total), true]] }; },
  limit: () => { const { a, b, c } = RESULTS.limit;
    const ad = Math.round(a.done), bd = Math.round(b.done), am = Math.round(a.maxInFlight), cf = Math.round(c.failed);
    return { verdict: t("All at once: " + ad + " delivered, " + (1000 - ad) + " timed out, up to " + am + " orders in the kitchen. At most 20 in flight: " + bd + " delivered, none timed out, in " + secs(b.total) + ". At most 32, one per burner: " + (cf ? cf + " timed out" : "none timed out") + ", in " + secs(c.total) + ".",
        "Todos a la vez: " + ad + " entregados, " + (1000 - ad) + " expirados, hasta " + am + " pedidos en la cocina. Como máximo 20 en curso: " + bd + " entregados, ninguno expirado, en " + secs(b.total) + ". Como máximo 32, uno por quemador: " + (cf ? cf + " expirados" : "ninguno expirado") + ", en " + secs(c.total) + "."),
      bars: [[t("All at once", "Todos a la vez"), a.done / 1000, t(ad + " ok", ad + " ok")], [t("At most 20", "Máximo 20"), b.done / 1000, t(bd + " ok", bd + " ok"), true]] }; },
  block: () => { const { a, b } = RESULTS.block; const top = Math.max(a.total, b.total) * 1.05;
    return { verdict: t("Without the read: " + secs(a.total) + ", dishes picked up within " + Math.round(a.bellP95) + " ms (p95). With a 15 ms blocking read: " + secs(b.total) + ", and ready dishes waited " + secs(b.bellP95) + " at the bell (p95).",
        "Sin la lectura: " + secs(a.total) + ", platos recogidos en menos de " + Math.round(a.bellP95) + " ms (p95). Con una lectura bloqueante de 15 ms: " + secs(b.total) + ", y los platos listos esperaron " + secs(b.bellP95) + " en la campana (p95)."),
      bars: [[t("No blocking read", "Sin lectura bloqueante"), a.total / top, secs(a.total)], [t("15 ms blocking read", "Lectura bloqueante de 15 ms"), b.total / top, secs(b.total), true]] }; },
};

const EXPERIMENTS = [
  {
    id: "threads",
    title: t("Four waiters or one", "Cuatro meseros o uno"),
    change: t("100 orders · each waits 200 ms in the kitchen · 4 blocking threads vs 1 async waiter", "100 pedidos · cada uno espera 200 ms en la cocina · 4 hilos bloqueantes contra 1 mesero async"),
    question: t("Which finishes the 100 orders faster?", "¿Cuál termina los 100 pedidos más rápido?"),
    options: [t("The 4 blocking threads: four pairs of hands beat one", "Los 4 hilos bloqueantes: cuatro pares de manos le ganan a uno"), t("About the same: the kitchen takes 200 ms either way", "Más o menos igual: la cocina tarda 200 ms de cualquier forma"), t("The single async waiter, by several times", "El único mesero async, varias veces más rápido")],
    answer: 2,
    why: t("A blocking thread spends almost all of its time standing at the window. Four threads can only have four orders in the kitchen at once, so 100 orders take 25 rounds of 200 ms. The async waiter clips a ticket on the rail and goes straight back for the next order, so the kitchen gets all 32 burners busy. A waiting thread uses no CPU, so 32 threads would fill the kitchen too; async wins when you need thousands of waits at once, because each thread costs memory for its stack and a context switch, and a ticket costs almost nothing.",
      "Un hilo bloqueante pasa casi todo su tiempo parado en la ventanilla. Cuatro hilos solo pueden tener cuatro pedidos en la cocina a la vez, así que 100 pedidos toman 25 rondas de 200 ms. El mesero async engancha una comanda en el riel y vuelve directo por el siguiente pedido, así que la cocina ocupa sus 32 quemadores. Un hilo que espera no usa CPU, así que 32 hilos también llenarían la cocina; async gana cuando necesitas miles de esperas a la vez, porque cada hilo cuesta memoria para su pila y un cambio de contexto, y una comanda casi no cuesta nada."),
    watch: { mode: "blocking", threads: 4, n: 20, cpu: 2, io: 200, gather: "gather", limit: 0, block: 0 },
  },
  {
    id: "cpu",
    title: t("Orders that need real work", "Pedidos que requieren trabajo real"),
    change: t("100 orders · 40 ms of CPU each, 10 ms in the kitchen · 4 blocking threads vs 1 async waiter", "100 pedidos · 40 ms de CPU cada uno, 10 ms en la cocina · 4 hilos bloqueantes contra 1 mesero async"),
    question: t("Now most of the time is spent working, not waiting. Which is faster?", "Ahora casi todo el tiempo se va en trabajar, no en esperar. ¿Cuál es más rápido?"),
    options: [t("The async waiter, by several times", "El mesero async, varias veces más rápido"), t("About the same: the hands are busy the whole time", "Más o menos igual: las manos están ocupadas todo el tiempo"), t("The blocking threads, by several times", "Los hilos bloqueantes, varias veces más rápido")],
    answer: 1,
    why: t("Async only removes waiting. Here every order needs 40 ms of hands-on work, and there is one pair of hands (one CPU core), so 100 orders take about 4 seconds however you schedule them. To go faster you need more cores working at the same time: parallelism, which is a different tool (lesson 14).",
      "Async solo elimina la espera. Aquí cada pedido necesita 40 ms de trabajo con las manos, y hay un solo par de manos (un núcleo de CPU), así que 100 pedidos toman cerca de 4 segundos como sea que los planifiques. Para ir más rápido necesitas más núcleos trabajando al mismo tiempo: paralelismo, que es otra herramienta (lección 14)."),
    watch: { mode: "async", threads: 4, n: 20, cpu: 40, io: 10, gather: "gather", limit: 0, block: 0 },
  },
  {
    id: "loop",
    title: t("Await in a loop", "Await en un bucle"),
    change: t("20 orders · async · `for … await` one by one vs `Promise.all` / `asyncio.gather`", "20 pedidos · async · `for … await` uno por uno contra `Promise.all` / `asyncio.gather`"),
    question: t("How much faster is gathering them?", "¿Cuánto más rápido es con gather?"),
    options: [t("About the same: it's the same code, just async", "Más o menos igual: es el mismo código, solo que async"), t("About twice as fast", "Cerca del doble de rápido"), t("More than ten times as fast", "Más de diez veces más rápido")],
    answer: 2,
    why: t("Awaiting inside a loop sends one order, waits for it to come back, then sends the next: async syntax, sequential behaviour. Gathering puts all 20 tickets on the rail at once, so they cook side by side and the batch takes about one kitchen trip. Await in a loop is right only when each call needs the previous result.",
      "Hacer await dentro de un bucle envía un pedido, espera a que vuelva y luego envía el siguiente: sintaxis async, comportamiento secuencial. Gather (reunir) pone las 20 comandas en el riel a la vez, así que se cocinan lado a lado y la tanda tarda más o menos un viaje a la cocina. Await en un bucle solo es correcto cuando cada llamada necesita el resultado anterior."),
    watch: { mode: "async", n: 20, cpu: 2, io: 200, gather: "sequential", limit: 0, block: 0 },
  },
  {
    id: "limit",
    title: t("Gather a thousand", "Gather de mil"),
    change: t("1,000 orders · gather all at once → at most 20 in flight · the kitchen has 32 burners and serves other clients too, calls time out after 2 s", "1,000 pedidos · gather de todos a la vez → 20 en curso como máximo · la cocina tiene 32 quemadores y también atiende a otros clientes, las llamadas expiran a los 2 s"),
    question: t("Which way gets more orders delivered?", "¿De qué forma se entregan más pedidos?"),
    options: [t("All at once: no waiting to start", "Todos a la vez: nadie espera para empezar"), t("At most 20 at a time", "Como máximo 20 a la vez"), t("Both deliver all 1,000", "Ambas entregan los 1,000")],
    answer: 1,
    why: t("Gathering everything floods the kitchen: 32 burners serve about 160 orders a second, so the queue grows by hundreds and most orders wait past the 2 s timeout and fail, after the kitchen did part of the work. A semaphore keeps no more in flight than the kitchen can cook, so nothing times out. The right limit comes from the dependency's capacity, not your own: 32 would use every burner and finish sooner; 20 leaves room for the kitchen's other clients.",
      "Hacer gather de todo inunda la cocina: 32 quemadores sirven cerca de 160 pedidos por segundo, así que la cola crece por cientos y la mayoría de los pedidos espera más allá del tiempo límite (timeout) de 2 s y falla, después de que la cocina hizo parte del trabajo. Un semáforo (semaphore) no deja más pedidos en curso de los que la cocina puede cocinar, así que nada expira. El límite correcto sale de la capacidad de la dependencia, no de la tuya: 32 usaría todos los quemadores y terminaría antes; 20 deja espacio para los otros clientes de la cocina."),
    watch: { mode: "async", n: 1000, cpu: 2, io: 200, gather: "gather", limit: 0, block: 0 },
  },
  {
    id: "block",
    title: t("One blocking call", "Una llamada bloqueante"),
    change: t("100 orders · async · each handler also reads a file synchronously for 15 ms", "100 pedidos · async · cada handler además lee un archivo de forma síncrona durante 15 ms"),
    question: t("What happens to the batch?", "¿Qué pasa con la tanda?"),
    options: [t("Nothing much: 15 ms is tiny next to 200 ms in the kitchen", "Casi nada: 15 ms es poco al lado de 200 ms en la cocina"), t("The whole batch slows by over a second", "Toda la tanda se atrasa más de un segundo"), t("Each order takes 15 ms longer, and so does the batch", "Cada pedido tarda 15 ms más, y la tanda también")],
    answer: 1,
    why: t("A synchronous call inside async code blocks the only pair of hands. While the waiter reads, nobody takes orders and nobody answers the bell, so 100 reads add 1.5 seconds of frozen time for everyone and finished dishes wait over a second to be picked up. Use the async version of the call, or hand it to a worker thread. Lesson 16, The event loop, shows the loop itself stalling behind one long job.",
      "Una llamada síncrona dentro de código async bloquea el único par de manos. Mientras el mesero lee, nadie toma pedidos y nadie atiende la campana, así que 100 lecturas suman 1.5 segundos congelados para todos y los platos terminados esperan más de un segundo a que alguien los recoja. Usa la versión async de la llamada o pásala a un hilo de trabajo (worker thread). La lección 16, El bucle de eventos, muestra el bucle mismo detenido detrás de un trabajo largo."),
    watch: { mode: "async", n: 100, cpu: 2, io: 200, gather: "gather", limit: 0, block: 15 },
  },
];

const QUESTIONS = [
  [t("Why does one async waiter deliver more than four blocking threads when the work is mostly waiting?", "¿Por qué un mesero async entrega más que cuatro hilos bloqueantes cuando el trabajo es casi todo espera?"),
    t("A blocking thread is occupied for the whole wait, so throughput is threads ÷ time per order. Async keeps many orders in flight with one thread: it only needs a ticket per wait, not a thread, so throughput is limited by how many calls the dependency can handle at once.",
      "Un hilo bloqueante está ocupado durante toda la espera, así que el rendimiento (throughput) es hilos ÷ tiempo por pedido. Async mantiene muchos pedidos en curso con un solo hilo: solo necesita una comanda por espera, no un hilo, así que el rendimiento queda limitado por cuántas llamadas puede atender la dependencia a la vez.")],
  [t("When does async not help, and what do you use instead?", "¿Cuándo no ayuda async, y qué usas en su lugar?"),
    t("When the work is CPU-bound: there is nothing to overlap, the core is busy the whole time. You need parallelism (more cores: processes, worker threads) or less work per request (caching, better algorithms).",
      "Cuando el trabajo está limitado por CPU (CPU-bound): no hay nada que superponer, el núcleo está ocupado todo el tiempo. Necesitas paralelismo (más núcleos: procesos, hilos de trabajo) o menos trabajo por solicitud (caché, mejores algoritmos).")],
  [t("`for (const id of ids) await fetchUser(id)` is slow. When is that loop still the right choice?", "`for (const id of ids) await fetchUser(id)` es lento. ¿Cuándo sigue siendo la opción correcta ese bucle?"),
    t("When each call depends on the previous result, when order matters, or when the other side can only take one at a time. Otherwise gather them, with a limit.",
      "Cuando cada llamada depende del resultado anterior, cuando el orden importa o cuando el otro lado solo acepta una a la vez. Si no, lánzalas a la vez (gather), con un límite.")],
  [t("What can go wrong with `Promise.all` over 10,000 items, and how do you fix it?", "¿Qué puede salir mal con `Promise.all` sobre 10,000 elementos, y cómo lo arreglas?"),
    t("Every call starts at once: the dependency gets flooded, calls time out, retries add more load, and memory grows with every pending call. Bound it with a semaphore or a pool (p-limit, asyncio.Semaphore, a worker pool) sized to what the dependency can serve.",
      "Todas las llamadas empiezan a la vez: la dependencia se inunda, las llamadas expiran, los reintentos agregan más carga y la memoria crece con cada llamada pendiente. Acótalo con un semáforo o un pool (p-limit, asyncio.Semaphore, un pool de workers) del tamaño de lo que la dependencia puede atender.")],
  [t("Someone adds `fs.readFileSync`, `time.sleep` or a synchronous HTTP client inside an async handler. What happens in production?", "Alguien agrega `fs.readFileSync`, `time.sleep` o un cliente HTTP síncrono dentro de un handler async. ¿Qué pasa en producción?"),
    t("It blocks the event loop for every request, not just this one: no new requests are picked up and finished ones aren't handled until it returns. Latency rises for everyone. Use the async version or move the call to a thread pool (`asyncio.to_thread`, a worker thread).",
      "Bloquea el bucle de eventos (event loop) para todas las solicitudes, no solo para esta: no se toman solicitudes nuevas y las terminadas no se atienden hasta que regresa. La latencia sube para todos. Usa la versión async o mueve la llamada a un pool de hilos (`asyncio.to_thread`, un worker thread).")],
  [t("How would you pick the concurrency limit for calls to a database that holds 32 connections?", "¿Cómo elegirías el límite de concurrencia para las llamadas a una base de datos que admite 32 conexiones?"),
    t("Start from the dependency's capacity: about 32 in flight keeps it busy without queueing. Little's law gives the throughput: in-flight ÷ time per call, so 32 ÷ 0.2 s ≈ 160 calls a second. Then measure, and leave room for other clients sharing it. Lesson 29, Connection pooling, sizes the pool from the database side.",
      "Parte de la capacidad de la dependencia: unas 32 en curso la mantienen ocupada sin hacer fila. La ley de Little (Little's law) da el rendimiento: en curso ÷ tiempo por llamada, o sea 32 ÷ 0.2 s ≈ 160 llamadas por segundo. Después mide, y deja espacio para otros clientes que la comparten. La lección 29, Pool de conexiones, dimensiona el pool desde el lado de la base de datos.")],
];

export default defineLesson({
  title: t("Async Workbench", "Banco de trabajo: E/S asíncrona"),
  eyebrow: t("Systems lesson 15 · Async I/O", "Lección de sistemas 15 · E/S asíncrona"),
  lede: t("Async I/O lets one worker start many slow operations and handle each result when it is ready, instead of standing still while it waits. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "La E/S asíncrona (async I/O) permite que un solo trabajador inicie muchas operaciones lentas y atienda cada resultado cuando está listo, en lugar de quedarse quieto mientras espera. Esta lección construye esa idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("The desk is the CPU, the kitchen is a slow dependency with 32 burners, and the rail holds orders that are waiting. Switch between blocking threads and async, then change how the calls are made and watch the counters.", "El mostrador es la CPU, la cocina es una dependencia lenta con 32 quemadores y el riel guarda los pedidos que esperan. Alterna entre hilos bloqueantes y async, luego cambia cómo se hacen las llamadas y mira los contadores."),
    plate: {
      title: t("Restaurant pass", "Pase del restaurante"),
      keys: [
        { mark: "lit", label: t("Waiting: tickets clipped on the rail, waiters holding an empty tray at the window, a waiter frozen in a blocking call, tags on the permit board", "Espera: comandas enganchadas en el riel, meseros con la bandeja vacía en la ventanilla, un mesero congelado en una llamada bloqueante, fichas en el tablero de permisos") },
        { mark: "raised", label: t("Order desk (left): the one CPU core, with the spike of orders not yet taken", "Mostrador de pedidos (izquierda): el único núcleo de CPU, con el pincho de pedidos aún sin tomar") },
        { mark: "flat", label: t("Kitchen range (right): 32 burners, the dependency's capacity. In front: delivered plates and the bin of timed-out tickets", "Cocina (derecha): 32 quemadores, la capacidad de la dependencia. Al frente: platos entregados y el cajón de comandas expiradas") },
      ],
      caption: t(
        "Each order needs a moment at the desk (CPU), a trip to the kitchen (I/O), and a moment to deliver. Blocking: each waiter stands at the window until the dish is ready. Async: one waiter clips a ticket on the rail and keeps working, and the bell calls them back. The permit board behind the desk has one slot per order allowed in flight; it is covered when there is no limit. Until you touch a control, the batches cycle through async, blocking threads, and async with at most 5 in flight. Time runs 10× slower than the numbers.",
        "Cada pedido necesita un momento en el mostrador (CPU), un viaje a la cocina (E/S) y un momento para entregarlo. Bloqueante: cada mesero se queda en la ventanilla hasta que el plato está listo. Async: un mesero engancha una comanda en el riel y sigue trabajando, y la campana lo llama de vuelta. El tablero de permisos detrás del mostrador tiene una ranura por cada pedido permitido en curso; está tapado cuando no hay límite. Hasta que toques un control, las tandas rotan entre async, hilos bloqueantes y async con 5 en curso como máximo. El tiempo corre 10× más lento que las cifras."),
      stage: { "data-pass": "" },
      label: t("Restaurant pass simulation. Space pauses or resumes.", "Simulación del pase del restaurante. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["time", t("Batch time", "Tiempo de la tanda"), "–"], ["rate", t("Orders / s", "Pedidos / s"), "–"], ["done", t("Delivered", "Entregados")], ["failed", t("Timed out", "Expirados")], ["kitchen", t("Max in kitchen", "Máx. en cocina")], ["bell", t("Bell wait p95", "Espera en campana p95"), "–"]],
    controls: [
      { seg: "mode", label: t("Model", "Modelo"), options: [["blocking", t("Blocking threads", "Hilos bloqueantes")], ["async", "Async"]], value: "async" },
      { seg: "threads", label: t("Threads", "Hilos"), options: [[1, "1"], [4, "4"], [8, "8"]], value: 4 },
      { seg: "gather", label: t("Async calls", "Llamadas async"), options: [["sequential", t("Await in a loop", "Await en un bucle")], ["gather", t("Gather", "Gather (reunir)")]], value: "gather" },
      { seg: "limit", label: t("In flight", "En curso"), options: [[0, t("No limit", "Sin límite")], [20, "20"], [5, "5"]], value: 0 },
      { seg: "io", label: t("Kitchen time", "Tiempo en cocina"), options: [[50, "50 ms"], [200, "200 ms"], [500, "500 ms"]], value: 200 },
      { seg: "cpu", label: t("CPU per order", "CPU por pedido"), options: [[2, "2 ms"], [20, "20 ms"], [40, "40 ms"]], value: 2 },
      { seg: "block", label: t("Blocking read", "Lectura bloqueante"), options: [[0, t("None", "Ninguna")], [15, "15 ms"]], value: 0 },
      { seg: "n", label: t("Orders", "Pedidos"), options: [[20, "20"], [100, "100"], [1000, "1,000"]], value: 20 },
      { speed: true },
      { actions: [["restart", t("New batch", "Nueva tanda")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t('"Threads" only counts with blocking threads; "Async calls" and "In flight" only with async.', '"Hilos" solo cuenta con hilos bloqueantes; "Llamadas async" y "En curso", solo con async.'),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over six seeded runs of the same model the figure runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados se promedian en seis ejecuciones con semilla del mismo modelo que usa la figura."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
[data-off]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
  },
});
