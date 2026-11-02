// Systems lesson 43 · Latency numbers. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, courierSvg, P, GEOMETRY } from "./figure.mjs";
import { chattyRun, readRun, sumRun, batchRun, pageRun } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed once here from the same model the page runs) ----------
const R = { chatty: chattyRun(), read: readRun(), sum: sumRun(), batch: batchRun(), page: pageRun() };
const SOURCE = "https://gist.github.com/jboner/2841832";

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "chatty",
    title: t("100 lookups: memory or the network", "100 consultas: memoria o red"),
    change: t("100 lookups, one after another · from a map in the program's own memory vs from a cache service on another machine in the same datacenter",
      "100 consultas, una tras otra · desde un mapa en la memoria del propio programa vs desde un servicio de caché en otra máquina del mismo centro de datos"),
    question: t("How much longer do the 100 lookups take over the network?", "¿Cuánto más tardan las 100 consultas por la red?"),
    options: [
      t("About twice as long: a cache service is fast too", "Cerca del doble: un servicio de caché también es rápido"),
      t("About 50 times as long", "Unas 50 veces más"),
      t("Thousands of times as long: microseconds against tens of milliseconds", "Miles de veces más: microsegundos contra decenas de milisegundos"),
    ],
    answer: 2,
    why: t(
      "A memory reference is about 100 ns; a round trip to another machine in the same building is about 500 µs, 5,000 times longer, before the other side does any work. Each lookup is cheap; the trip is not. A loop that calls a service once per item (a chatty API, an N+1 query) multiplies that trip by the number of items. Fetch in bulk, cache close to the code, or move the loop to where the data is.",
      "Una referencia a memoria tarda unos 100 ns; un viaje de ida y vuelta a otra máquina en el mismo edificio tarda unos 500 µs, 5,000 veces más, antes de que el otro lado haga ningún trabajo. Cada consulta es barata; el viaje no. Un ciclo que llama a un servicio una vez por elemento (una API conversadora, una consulta N+1) multiplica ese viaje por la cantidad de elementos. Pide en bloque, guarda en caché cerca del código, o lleva el ciclo a donde están los datos.",
    ),
    watch: { job: "lookups", how: "dc", speed: "4" },
  },
  {
    id: "read",
    title: t("100 MB: random SSD or sequential disk", "100 MB: SSD al azar o disco secuencial"),
    change: t("Read 100 MB · from an SSD in random 4 KB pieces, one at a time · from a spinning disk straight through · (also: the disk in random 4 KB pieces)",
      "Leer 100 MB · desde un SSD en trozos de 4 KB al azar, uno a la vez · desde un disco giratorio de corrido · (también: el disco en trozos de 4 KB al azar)"),
    question: t("Which finishes first: the SSD reading at random, or the old disk reading straight through?", "¿Cuál termina primero: el SSD leyendo al azar, o el disco viejo leyendo de corrido?"),
    options: [
      t("The SSD, by far: it has no moving parts", "El SSD, por mucho: no tiene partes móviles"),
      t("The disk reading straight through, by a couple of seconds", "El disco leyendo de corrido, por un par de segundos"),
      t("A tie: 100 MB is 100 MB", "Empate: 100 MB son 100 MB"),
    ],
    answer: 1,
    why: t(
      "A random read pays the whole trip for every 4 KB: 25,600 trips of about 150 µs. A sequential read pays for the trip once and then streams, so even a spinning disk gets about 50 MB a second. Make that same disk read at random and every 4 KB pays a 10 ms seek: over four minutes. Modern NVMe drives are faster than this table and serve many reads at once, which narrows the SSD gap a lot, but the rule holds on every device: how you read matters as much as what you read from.",
      "Una lectura al azar paga el viaje completo por cada 4 KB: 25,600 viajes de unos 150 µs. Una lectura secuencial paga el viaje una vez y después fluye, así que hasta un disco giratorio saca unos 50 MB por segundo. Haz que ese mismo disco lea al azar y cada 4 KB paga una búsqueda del cabezal (seek) de 10 ms: más de cuatro minutos. Los discos NVMe modernos son más rápidos que esta tabla y atienden muchas lecturas a la vez, lo que achica mucho la brecha del SSD, pero la regla vale en todo dispositivo: cómo lees importa tanto como desde dónde lees.",
    ),
    watch: { job: "read", how: "ssd-rand", speed: "16" },
  },
  {
    id: "sum",
    title: t("A million numbers: array or linked list", "Un millón de números: arreglo o lista enlazada"),
    change: t("Add up 1 million numbers · stored side by side in an array vs one per node of a linked list scattered in memory · both are O(n), the same additions",
      "Sumar 1 millón de números · guardados uno al lado del otro en un arreglo vs uno por nodo de una lista enlazada dispersa en memoria · ambos son O(n), las mismas sumas"),
    question: t("How much slower is the linked list?", "¿Cuánto más lenta es la lista enlazada?"),
    options: [
      t("About the same: same number of additions", "Más o menos igual: la misma cantidad de sumas"),
      t("2 to 3 times: one extra pointer per node", "De 2 a 3 veces: un puntero extra por nodo"),
      t("Close to 100 times: almost every node is a trip to memory", "Cerca de 100 veces: casi cada nodo es un viaje a memoria"),
    ],
    answer: 2,
    why: t(
      "Memory arrives in cache lines of 64 bytes, 16 numbers at a time, and when the CPU sees you walking forward it fetches the next lines before you ask (prefetching), so the array streams at memory bandwidth. A list node can be anywhere, and you only learn the next address by reading this node, so every node waits a full memory trip of about 100 ns and nothing overlaps. Big-O counts operations; it doesn't see where the data is.",
      "La memoria llega en líneas de caché de 64 bytes, 16 números a la vez, y cuando la CPU ve que avanzas en orden trae las líneas siguientes antes de que las pidas (prefetching), así que el arreglo fluye al ancho de banda de la memoria. Un nodo de la lista puede estar en cualquier parte, y la siguiente dirección solo se conoce al leer este nodo, así que cada nodo espera un viaje completo a memoria de unos 100 ns y nada se superpone. La notación O grande cuenta operaciones; no ve dónde están los datos.",
    ),
    watch: { job: "sum", how: "list", speed: "4" },
  },
  {
    id: "batch",
    title: t("100 small calls to another continent", "100 llamadas pequeñas a otro continente"),
    change: t("100 calls of 1 KB each to a service across the ocean (about 150 ms per round trip) · one after another vs 10 at a time vs one batched call carrying all 100",
      "100 llamadas de 1 KB cada una a un servicio al otro lado del océano (unos 150 ms por viaje de ida y vuelta) · una tras otra vs 10 a la vez vs una sola llamada en lote con las 100"),
    question: t("How long do the 100 calls take one after another?", "¿Cuánto tardan las 100 llamadas una tras otra?"),
    options: [
      t("Well under a second: each call only carries 1 KB", "Mucho menos de un segundo: cada llamada lleva solo 1 KB"),
      t("About 15 seconds: 100 round trips of 150 ms", "Unos 15 segundos: 100 viajes de 150 ms"),
      t("About 1.5 seconds", "Cerca de 1.5 segundos"),
    ],
    answer: 1,
    why: t(
      "Sending 1 KB over a 1 Gbps link takes about 10 µs; the round trip takes 150 ms whatever you send. So 100 calls in a row cost 100 round trips. Ten at a time costs ten rounds, each as slow as its slowest call. One batch costs one round trip plus about a millisecond to send the extra data. Across long distances, count round trips, not bytes.",
      "Mandar 1 KB por un enlace de 1 Gbps tarda unos 10 µs; el viaje de ida y vuelta tarda 150 ms mandes lo que mandes. Así que 100 llamadas seguidas cuestan 100 viajes. De a diez cuesta diez rondas, cada una tan lenta como su llamada más lenta. Un lote cuesta un viaje más cerca de un milisegundo para mandar los datos extra. A larga distancia, cuenta viajes, no bytes.",
    ),
    watch: { job: "batch", how: "one", speed: "4" },
  },
  {
    id: "page",
    title: t("A page that makes 20 reads in a row", "Una página que hace 20 lecturas seguidas"),
    change: t("Each read needs the previous result · from the primary database on another continent vs a read replica in the same datacenter vs a cache in the server's own memory",
      "Cada lectura necesita el resultado anterior · desde la base de datos primaria en otro continente vs una réplica de lectura en el mismo centro de datos vs una caché en la memoria del propio servidor"),
    question: t("Move the reads from the primary overseas to the nearby replica. How much faster is the page?", "Mueve las lecturas de la primaria lejana a la réplica cercana. ¿Cuánto más rápida es la página?"),
    options: [
      t("About twice as fast", "Cerca del doble de rápida"),
      t("Hundreds of times: seconds become milliseconds", "Cientos de veces: los segundos se vuelven milisegundos"),
      t("No faster: the database does the same work either way", "Igual de rápida: la base de datos hace el mismo trabajo en ambos casos"),
    ],
    answer: 1,
    why: t(
      "Twenty dependent reads are twenty round trips, and only distance sets their price: 150 ms each overseas, about 0.5 ms next door, 100 ns in memory. That is why read replicas, CDNs and edge caches exist: they move copies closer. The copy has a cost: a replica lags the primary by at least the one-way trip, so a user may not see a write they just made unless you send their next reads to the primary.",
      "Veinte lecturas dependientes son veinte viajes de ida y vuelta, y solo la distancia fija su precio: 150 ms cada uno al otro lado del océano, unos 0.5 ms al lado, 100 ns en memoria. Por eso existen las réplicas de lectura, las CDN y las cachés en el borde (edge): acercan copias. La copia tiene un costo: una réplica va atrasada respecto de la primaria al menos lo que tarda el viaje de ida, así que un usuario puede no ver algo que acaba de escribir, salvo que mandes sus siguientes lecturas a la primaria.",
    ),
    watch: { job: "page", how: "primary", speed: "4" },
  },
];

const QUESTIONS = [
  [t("Why are these numbers worth remembering as ratios rather than exact values?", "¿Por qué conviene recordar estos números como proporciones y no como valores exactos?"),
    t("The exact values change with every generation of hardware and with every cloud, but the gaps between levels stay huge: cache to memory is about 10 to 100 times, memory to SSD about 1,000, SSD to a nearby machine a few times, nearby to another continent about 300. Those ratios tell you where time goes before you measure, which design is hopeless, and which optimisation can't matter.",
      "Los valores exactos cambian con cada generación de hardware y con cada nube, pero las brechas entre niveles siguen siendo enormes: de caché a memoria unas 10 a 100 veces, de memoria a SSD unas 1,000, de SSD a una máquina cercana unas pocas veces, de cercana a otro continente unas 300. Esas proporciones te dicen a dónde se va el tiempo antes de medir, qué diseño no tiene salvación y qué optimización no puede importar.")],
  [t("A request handler makes 30 calls, one after another, to services in the same datacenter. Roughly what does that cost, and how would you cut it?", "Un handler hace 30 llamadas, una tras otra, a servicios del mismo centro de datos. ¿Cuánto cuesta más o menos y cómo lo reducirías?"),
    t("At about 0.5 ms a round trip, at least 15 ms before any service does work, and in practice more, since each hop adds its own queueing and tail latency. Cut the number of sequential trips: batch related calls, run independent ones in parallel, cache what rarely changes, or have one service do the whole loop next to the data.",
      "A unos 0.5 ms por viaje, al menos 15 ms antes de que ningún servicio trabaje, y en la práctica más, porque cada salto suma su propia espera en cola y su latencia de cola (tail latency). Reduce los viajes secuenciales: agrupa llamadas relacionadas, corre en paralelo las independientes, guarda en caché lo que casi no cambia, o haz que un solo servicio corra todo el ciclo junto a los datos.")],
  [t("Iterating an array and a linked list are both O(n). Why is the array so much faster?", "Recorrer un arreglo y una lista enlazada son ambos O(n). ¿Por qué el arreglo es mucho más rápido?"),
    t("Memory moves in 64-byte cache lines, so one fetch brings many neighbouring elements, and the hardware prefetcher fetches the next lines while you work on these. A linked list's nodes are scattered and each next address is only known after the previous load, so the loads can't overlap: each costs a full memory trip. Locality and independent loads are what make code fast on real hardware.",
      "La memoria se mueve en líneas de caché de 64 bytes, así que una lectura trae muchos elementos vecinos, y el prefetcher del hardware trae las líneas siguientes mientras trabajas con estas. Los nodos de una lista enlazada están dispersos y cada dirección siguiente solo se conoce después de la lectura anterior, así que las lecturas no se pueden superponer: cada una cuesta un viaje completo a memoria. La localidad y las lecturas independientes son lo que hace rápido el código en hardware real.")],
  [t("When can a sequential read from a spinning disk beat random reads from an SSD, and when does that stop being true?", "¿Cuándo una lectura secuencial desde un disco giratorio le gana a lecturas al azar desde un SSD, y cuándo deja de ser cierto?"),
    t("When the random reads are small and issued one at a time: each pays the SSD's full access time, while the disk pays one seek and then streams. It stops being true when the SSD gets many reads in flight (a deep queue, async I/O) or larger pieces, since SSDs work in parallel internally; and a disk that has to read at random is hopeless at about 10 ms a seek. Lay data out so you can read it in order, and keep many reads in flight when you can't.",
      "Cuando las lecturas al azar son pequeñas y se hacen una a la vez: cada una paga el tiempo de acceso completo del SSD, mientras el disco paga una búsqueda y después fluye. Deja de ser cierto cuando el SSD recibe muchas lecturas a la vez (una cola profunda, E/S asíncrona) o trozos más grandes, porque los SSD trabajan en paralelo por dentro; y un disco que tiene que leer al azar no tiene remedio, a unos 10 ms por búsqueda. Organiza los datos para leerlos en orden, y mantén muchas lecturas en curso cuando no puedas.")],
  [t("Where does the 150 ms round trip to another continent come from, and can a faster server make it smaller?", "¿De dónde sale el viaje de ida y vuelta de 150 ms a otro continente, y un servidor más rápido puede achicarlo?"),
    t("Mostly from distance: light in optical fibre travels at about 200,000 km a second, and California to the Netherlands is roughly 9,000 km each way, so physics alone sets a floor near 90 ms; routes that aren't straight and the routers along them add the rest. A faster server doesn't move anything closer. Only fewer round trips (batching, fewer handshakes) or a copy nearer the user (replicas, CDNs, edge caches) helps.",
      "Sobre todo de la distancia: la luz en la fibra óptica viaja a unos 200,000 km por segundo, y de California a los Países Bajos hay cerca de 9,000 km de ida, así que la física sola pone un piso cercano a 90 ms; las rutas que no son rectas y los routers en el camino suman el resto. Un servidor más rápido no acerca nada. Solo ayudan menos viajes (lotes, menos handshakes) o una copia más cerca del usuario (réplicas, CDN, cachés en el borde).")],
  [t("If an L1 cache hit took one second, how long would a memory reference, an SSD read and a cross-continent round trip take? What does that say about chatty protocols?", "Si un acierto en la caché L1 tardara un segundo, ¿cuánto tardarían una referencia a memoria, una lectura de SSD y un viaje a otro continente? ¿Qué dice eso de los protocolos conversadores?"),
    t("Multiply by two billion: memory about 3 minutes, an SSD read about 3.5 days, a cross-continent round trip about 9.5 years. From the CPU's point of view every network trip is an expedition, so a protocol that needs many back-and-forths (one request per item, a handshake per call) spends almost all its time travelling. Send fewer, bigger messages, and keep connections open so handshakes are paid once.",
      "Multiplica por dos mil millones: memoria unos 3 minutos, una lectura de SSD unos 3.5 días, un viaje a otro continente unos 9.5 años. Desde el punto de vista de la CPU, cada viaje por la red es una expedición, así que un protocolo que necesita muchas idas y vueltas (una solicitud por elemento, un handshake por llamada) pasa casi todo su tiempo viajando. Manda menos mensajes y más grandes, y mantén las conexiones abiertas para pagar los handshakes una sola vez.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Courier depot", "Depósito de mensajería"),
  keys: [
    { mark: "lit", label: t("The courier, on a trip from the CPU to where the data lives", "El mensajero, en un viaje de la CPU a donde están los datos") },
    { mark: "raised", label: t("Stations: caches, memory, drives, other machines; each meter shows its share of the time", "Estaciones: cachés, memoria, discos, otras máquinas; cada medidor muestra su parte del tiempo") },
    { mark: "flat", label: t("The road and its ruler: each step is ten times longer than the last", "El camino y su regla: cada paso es diez veces más largo que el anterior") },
  ],
  caption: t(
    "Every operation is a trip from the CPU to where its data lives and back. Stations stand at distances that grow with the logarithm of their latency: the ruler marks 1 ns, 10 ns, 100 ns and so on, so the courier's walk to the other continent is only about eight steps, though each step is ten times the last. On screen every trip takes about a second; the sign shows the real time added up, and the other sign stretches one trip to human scale, as if an L1 hit took a second. Values are approximate orders of magnitude from the classic table; real hardware varies.",
    "Cada operación es un viaje de la CPU a donde están sus datos y de vuelta. Las estaciones están a distancias que crecen con el logaritmo de su latencia: la regla marca 1 ns, 10 ns, 100 ns y así, así que la caminata del mensajero a otro continente es de solo unos ocho pasos, aunque cada paso es diez veces el anterior. En pantalla cada viaje tarda cerca de un segundo; el letrero muestra el tiempo real sumado, y el otro letrero estira un viaje a escala humana, como si un acierto en L1 tardara un segundo. Los valores son órdenes de magnitud aproximados de la tabla clásica; el hardware real varía.",
  ),
  readout: t("starting", "iniciando"),
  stage: "data-depot",
  stageLabel: t("Latency simulation: a courier runs trips from the CPU to caches, memory, drives and other machines. Space pauses or resumes.", "Simulación de latencia: un mensajero hace viajes de la CPU a cachés, memoria, discos y otras máquinas. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const HOWS = {
  lookups: [t("Where the data lives", "Dónde están los datos"), [["ram", t("In memory", "En memoria")], ["dc", t("Cache service, same DC", "Servicio de caché, mismo DC")], ["wan", t("Other continent", "Otro continente")]]],
  read: [t("Device and pattern", "Dispositivo y patrón"), [["ssd-seq", t("SSD, in order", "SSD, en orden")], ["ssd-rand", t("SSD, random 4 KB", "SSD, 4 KB al azar")], ["disk-seq", t("Disk, in order", "Disco, en orden")], ["disk-rand", t("Disk, random 4 KB", "Disco, 4 KB al azar")]]],
  sum: [t("Stored as", "Guardados como"), [["array", t("Array", "Arreglo")], ["list", t("Linked list", "Lista enlazada")]]],
  batch: [t("Calls", "Llamadas"), [["one", t("One at a time", "Una a la vez")], ["ten", t("10 at a time", "10 a la vez")], ["batch", t("One batch", "Un solo lote")]]],
  page: [t("Reads go to", "Las lecturas van a"), [["primary", t("Primary, overseas", "Primaria, lejana")], ["replica", t("Replica, same DC", "Réplica, mismo DC")], ["cache", t("Cache in memory", "Caché en memoria")]]],
};
const DEFAULT_HOW = { lookups: "dc", read: "ssd-rand", sum: "array", batch: "one", page: "primary" };
const controls = panel({
  stats: [["total", t("Total time", "Tiempo total"), "0 ns"], ["trips", t("Trips", "Viajes")], ["per", t("Per trip", "Por viaje"), "–"], ["human", t("At human scale", "A escala humana"), "–"], ["where", t("Most time at", "Más tiempo en"), "–"], ["share", t("Its share", "Su parte"), "–"]],
  controls: [
    seg("job", t("Job", "Trabajo"), [["lookups", t("100 lookups", "100 consultas")], ["read", t("Read 100 MB", "Leer 100 MB")], ["sum", t("Sum 1M numbers", "Sumar 1M números")], ["batch", t("100 calls overseas", "100 llamadas lejanas")], ["page", t("A page: 20 reads", "Una página: 20 lecturas")]], "lookups"),
    ...Object.entries(HOWS).map(([job, [label, opts]]) => `<div data-for="${job}"${job === "lookups" ? "" : " hidden"}>${seg("how-" + job, label, opts, DEFAULT_HOW[job])}</div>`),
    speedSeg([[1, "×1"], [4, "×4"], [16, "×16"]], 1),
    actions(t("Do something", "Haz algo"), [["reset", t("Run again", "Ejecutar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
});

const css = `
[data-for][hidden]{display:none}
.iso-stage [data-layer] text{pointer-events:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const COURIER_SVG = ${JSON.stringify(courierSvg())};
const RESULTS = ${JSON.stringify(R)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const DEFAULT_HOW = ${JSON.stringify(DEFAULT_HOW)};
const { T, L } = WB;

const stage = document.querySelector("[data-depot]");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const layer = svg.querySelector('[data-layer="courier"]');
layer.innerHTML = COURIER_SVG;
const courier = layer.firstElementChild;
const totalSign = svg.querySelector("[data-total]"), humanSign = svg.querySelector("[data-human]");
const meters = Object.fromEntries(STATIONS.map((s) => [s.id, WB.meter(svg, "share-" + s.id, P)]));
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
const stat = (key, value) => { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; };

const NAME = { l1: T("L1 cache", "caché L1"), l2: T("L2 cache", "caché L2"), ram: T("memory", "memoria"), ssd: T("SSD", "SSD"), dc: T("same datacenter", "mismo centro de datos"), disk: T("disk", "disco"), wan: T("other continent", "otro continente") };
const SHORT = { l1: "L1", l2: "L2", ram: "RAM", ssd: "SSD", dc: T("same DC", "mismo DC"), disk: T("disk", "disco"), wan: T("overseas", "lejos") };
const UNITS = { s: T("S", "S"), min: T("MIN", "MIN"), h: T("H", "H"), d: T("DAYS", "DÍAS"), mo: T("MONTHS", "MESES"), y: T("YEARS", "AÑOS") };
const big = (n) => Math.round(n).toLocaleString("en-US");
const sig = (v) => (v === 0 ? "0" : v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
function fmt(ns) {
  if (ns < 999.5) return sig(ns) + " ns";
  if (ns < 999.5e3) return sig(ns / 1e3) + " µs";
  if (ns < 999.5e6) return sig(ns / 1e6) + " ms";
  return sig(ns / 1e9) + " s";
}
const humanText = (ns) => { const [v, u] = human(ns); return (v >= 10 ? String(Math.round(v)) : v.toFixed(1)) + " " + L(UNITS[u]); };

const cfg = { job: "lookups", how: { ...DEFAULT_HOW }, speed: 1 };
const SPEED = 230;   // world units a second on screen: a trip to the other continent and back takes about 2 s
const MAXA = 20;     // trips animated per leg; beyond that each one shown stands for several real ones
let run, trips, idx, phase, ph, done, doneAt, seed = 11;

function plan() {
  const r = runJob(cfg.job, cfg.how[cfg.job], seed, 0);
  seed = (seed * 48271) % 2147483647;
  const list = [];
  r.legs.forEach((leg) => {
    const waves = Math.ceil(leg.count / leg.wide);
    const n = Math.min(waves, MAXA);
    for (let i = 0; i < n; i++) list.push({ station: leg.station, ns: leg.total / n, count: leg.count / n, rep: waves / n, wide: leg.wide, each: leg.each });
  });
  return { r, list };
}
function restart() {
  run = plan();
  trips = { ns: 0, count: 0, by: Object.fromEntries(STATIONS.map((s) => [s.id, 0])) };
  idx = 0; phase = "out"; ph = 0; done = false;
  paint();
}
function tripLen(st) { return G.SPOTS[st] - G.DEPOT_X; }
function step(dt) {
  if (done) { doneAt += dt; if (doneAt > 3) restart(); paint(); return; }
  const trip = run.list[idx];
  const len = tripLen(trip.station);
  ph += dt * cfg.speed;
  const out = len / SPEED, dwell = 0.18, back = len / SPEED;
  if (phase === "out" && ph >= out) { phase = "dwell"; ph -= out; }
  if (phase === "dwell" && ph >= dwell) { phase = "back"; ph -= dwell; }
  if (phase === "back" && ph >= back) {
    trips.ns += trip.ns; trips.count += trip.count; trips.by[trip.station] += trip.ns;
    idx++; phase = "out"; ph = 0;
    if (idx >= run.list.length) { done = true; doneAt = 0; trips.ns = run.r.total; trips.count = run.r.trips; trips.by = { ...run.r.by }; }
  }
  paint();
}
function courierX() {
  if (done) return G.DEPOT_X;
  const trip = run.list[idx], len = tripLen(trip.station);
  if (phase === "out") return G.DEPOT_X + Math.min(len, ph * SPEED);
  if (phase === "dwell") return G.DEPOT_X + len;
  return G.DEPOT_X + Math.max(0, len - ph * SPEED);
}
function paint() {
  courier.setAttribute("transform", translateAlong(P, [courierX(), G.ROAD_Y, G.ROAD_Z]));
  courier.style.opacity = done ? "0.35" : "";
  const total = trips.ns;
  STATIONS.forEach((s) => meters[s.id].set(total > 0 ? trips.by[s.id] / total : 0));
  totalSign.textContent = fmt(total);
  const trip = run.list[Math.min(idx, run.list.length - 1)];
  humanSign.textContent = humanText(trip.each);
  let top = null;
  for (const s of STATIONS) if (!top || trips.by[s.id] > trips.by[top]) top = s.id;
  stat("total", fmt(total)); stat("trips", big(trips.count)); stat("per", fmt(trip.each)); stat("human", humanText(trip.each).toLowerCase());
  stat("where", total > 0 ? L(SHORT[top]) : "–"); stat("share", total > 0 ? Math.round((100 * trips.by[top]) / total) + "%" : "–");
  if (done) { say(L("done · " + big(run.r.trips) + " trips · " + fmt(run.r.total) + " · " + Math.round((100 * run.r.by[top]) / run.r.total) + "% at " + NAME[top].en,
    "listo · " + big(run.r.trips) + " viajes · " + fmt(run.r.total) + " · " + Math.round((100 * run.r.by[top]) / run.r.total) + "% en " + NAME[top].es)); return; }
  const n = run.list.length, wide = trip.wide > 1 ? L(" · " + trip.wide + " calls in flight", " · " + trip.wide + " llamadas en curso") : "";
  const rep = trip.rep > 1 ? L(" · each trip shown stands for " + big(trip.rep), " · cada viaje que ves representa " + big(trip.rep)) : "";
  say(L("trip " + (idx + 1) + " of " + n + " · " + NAME[trip.station].en, "viaje " + (idx + 1) + " de " + n + " · " + NAME[trip.station].es) + wide + rep + " · " + fmt(total));
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(L("paused", "en pausa")); } });
WB.onLang(() => { pauseBtn.textContent = loop.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); paint(); if (loop.paused) say(L("paused", "en pausa")); });

function showJob(job) { document.querySelectorAll("[data-for]").forEach((el) => { el.hidden = el.dataset.for !== job; }); }
function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  if (name === "job") { cfg.job = raw; showJob(raw); }
  else if (name.startsWith("how-")) cfg.how[name.slice(4)] = raw;
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); if (loop.paused) loop.setPaused(false); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (numbers computed from the same model, 8 seeds each) ----------
const x = (a, b) => big(a / b) + "×";
const RUNS = {
  chatty: () => {
    const { ram, dc } = RESULTS.chatty;
    return { verdict: T("In memory: " + fmt(ram.total) + " for all 100. Over the network: " + fmt(dc.total) + ", about " + x(dc.total, ram.total) + " longer. The lookups are the same; the trips are not.",
        "En memoria: " + fmt(ram.total) + " para las 100. Por la red: " + fmt(dc.total) + ", unas " + x(dc.total, ram.total) + " más. Las consultas son las mismas; los viajes no."),
      bars: [[T("In memory", "En memoria"), ram.total / dc.total, fmt(ram.total)], [T("Cache service, same DC", "Servicio de caché, mismo DC"), 1, fmt(dc.total), true]] };
  },
  read: () => {
    const r = RESULTS.read, top = r["ssd-rand"].total;
    return { verdict: T("SSD at random: " + fmt(r["ssd-rand"].total) + ". Disk in order: " + fmt(r["disk-seq"].total) + ". SSD in order: " + fmt(r["ssd-seq"].total) + ". Disk at random: " + fmt(r["disk-rand"].total) + ", off the chart.",
        "SSD al azar: " + fmt(r["ssd-rand"].total) + ". Disco en orden: " + fmt(r["disk-seq"].total) + ". SSD en orden: " + fmt(r["ssd-seq"].total) + ". Disco al azar: " + fmt(r["disk-rand"].total) + ", fuera de la escala."),
      bars: [[T("SSD, random 4 KB", "SSD, 4 KB al azar"), r["ssd-rand"].total / top, fmt(r["ssd-rand"].total)], [T("Disk, in order", "Disco, en orden"), r["disk-seq"].total / top, fmt(r["disk-seq"].total), true], [T("SSD, in order", "SSD, en orden"), r["ssd-seq"].total / top, fmt(r["ssd-seq"].total)], [T("Disk, random 4 KB (off the chart)", "Disco, 4 KB al azar (fuera de escala)"), 1, fmt(r["disk-rand"].total)]] };
  },
  sum: () => {
    const { array, list } = RESULTS.sum;
    return { verdict: T("Array: " + fmt(array.total) + ". Linked list: " + fmt(list.total) + ", about " + x(list.total, array.total) + " slower for the same million additions.",
        "Arreglo: " + fmt(array.total) + ". Lista enlazada: " + fmt(list.total) + ", unas " + x(list.total, array.total) + " más lenta para el mismo millón de sumas."),
      bars: [[T("Array", "Arreglo"), array.total / list.total, fmt(array.total)], [T("Linked list", "Lista enlazada"), 1, fmt(list.total), true]] };
  },
  batch: () => {
    const { one, ten, batch } = RESULTS.batch;
    return { verdict: T("One at a time: " + fmt(one.total) + ". Ten at a time: " + fmt(ten.total) + ". One batch: " + fmt(batch.total) + ", about " + x(one.total, batch.total) + " faster than one at a time.",
        "Una a la vez: " + fmt(one.total) + ". Diez a la vez: " + fmt(ten.total) + ". Un lote: " + fmt(batch.total) + ", unas " + x(one.total, batch.total) + " más rápido que de a una."),
      bars: [[T("One at a time", "Una a la vez"), 1, fmt(one.total), true], [T("10 at a time", "10 a la vez"), ten.total / one.total, fmt(ten.total)], [T("One batch", "Un solo lote"), batch.total / one.total, fmt(batch.total)]] };
  },
  page: () => {
    const { primary, replica, cache } = RESULTS.page;
    return { verdict: T("Primary overseas: " + fmt(primary.total) + ". Replica in the same datacenter: " + fmt(replica.total) + ", about " + x(primary.total, replica.total) + " faster. Cache in memory: " + fmt(cache.total) + ".",
        "Primaria lejana: " + fmt(primary.total) + ". Réplica en el mismo centro de datos: " + fmt(replica.total) + ", unas " + x(primary.total, replica.total) + " más rápida. Caché en memoria: " + fmt(cache.total) + "."),
      bars: [[T("Primary, overseas", "Primaria, lejana"), 1, fmt(primary.total)], [T("Replica, same DC", "Réplica, mismo DC"), replica.total / primary.total, fmt(replica.total), true], [T("Cache in memory", "Caché en memoria"), cache.total / primary.total, fmt(cache.total)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  set("job", w.job, true); set("how-" + w.job, w.how, true); set("speed", w.speed);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
for (let i = 0; i < 300; i++) step(1 / 60);   // open a few trips in, so the first frame already shows a job under way
`;

const size = writePage(new URL("./latency-numbers-workbench.html", import.meta.url), {
  title: t("Latency Numbers Workbench", "Banco de trabajo: números de latencia"),
  eyebrow: t("Systems lesson 43 · Latency numbers", "Lección de sistemas 43 · Números de latencia"),
  lede: t("Every read goes somewhere: a cache next to the CPU, main memory, a drive, another machine, another continent. Each step out costs about ten to a thousand times more than the last, so where your data lives usually matters more than how clever the code is. This lesson sends a courier on those trips: watch a machine do it, predict what each design costs, then explain it back.",
    "Cada lectura va a algún lugar: una caché junto a la CPU, la memoria principal, un disco, otra máquina, otro continente. Cada paso hacia afuera cuesta entre diez y mil veces más que el anterior, así que dónde viven tus datos suele importar más que lo ingenioso del código. Esta lección manda a un mensajero a hacer esos viajes: mira cómo lo hace una máquina, predice cuánto cuesta cada diseño y después explícalo."),
  machine: { intro: t("Pick a job and where its data lives. The courier runs each trip from the CPU and back; the sign adds up the real time and the meters show which station it went to. Stations are spaced by the logarithm of their latency, so the far end of the road is about 300 million times farther than the first stop.",
    "Elige un trabajo y dónde están sus datos. El mensajero hace cada viaje desde la CPU y de vuelta; el letrero suma el tiempo real y los medidores muestran a qué estación se fue. Las estaciones están separadas según el logaritmo de su latencia, así que el final del camino está unas 300 millones de veces más lejos que la primera parada."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Latencies from “Latency numbers every programmer should know” by Jeff Dean and Peter Norvig, as collected by Jonas Bonér (<a href="${SOURCE}" target="_blank" rel="noopener">gist</a>, ~2012 values): orders of magnitude, not measurements of your hardware. Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson.`,
    `Latencias de “Latency numbers every programmer should know” de Jeff Dean y Peter Norvig, recopiladas por Jonas Bonér (<a href="${SOURCE}" target="_blank" rel="noopener">gist</a>, valores de ~2012): órdenes de magnitud, no mediciones de tu hardware. Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección.`),
  css,
  script: live,
});
console.log("wrote latency-numbers-workbench.html", (size / 1024).toFixed(0) + " KB");
for (const [k, v] of Object.entries(R)) console.log(k, Object.entries(v).map(([h, o]) => h + " " + (o.total / 1e6).toFixed(3) + " ms").join(" · "));
