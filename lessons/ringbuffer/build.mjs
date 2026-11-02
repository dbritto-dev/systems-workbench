// Systems lesson 42 · Ring buffers. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t } from "../../workbench/page.mjs";
import { buildFigure, tokenSvg, P, GEOMETRY } from "./figure.mjs";
import { burstRun, lapRun, sizeRun, blockRun, batchRun } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed once here from the same model the page runs) ----------
const R = { burst: burstRun(), lap: lapRun(), size: sizeRun(), block: blockRun(), batch: batchRun() };

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "burst",
    title: t("40 items at once into 16 slots", "40 elementos de golpe en 16 huecos"),
    change: t("A quiet 2/s stream, a reader that does 4/s · 40 items arrive at once · overwrite oldest vs drop newest vs block the producer", "Un flujo tranquilo de 2/s, un lector que hace 4/s · llegan 40 elementos de golpe · sobrescribir el más viejo vs descartar el más nuevo vs frenar al productor"),
    question: t("What does each policy do with the 40?", "¿Qué hace cada política con los 40?"),
    options: [
      t("All three lose the same 24: the ring only has 16 slots", "Las tres pierden los mismos 24: el anillo solo tiene 16 huecos"),
      t("Overwrite loses the first 24 of the burst, drop loses the last 24, block loses none but the producer stands still until there is room", "Sobrescribir pierde los primeros 24 de la ráfaga, descartar pierde los últimos 24, frenar no pierde ninguno pero el productor se queda quieto hasta que haya lugar"),
      t("Block loses none and costs nothing; the other two lose all 40", "Frenar no pierde ninguno y no cuesta nada; las otras dos pierden los 40"),
    ],
    answer: 1,
    why: t(
      "A ring has a fixed size, so a burst bigger than the free space forces a choice. Overwrite keeps the newest data and gives up the oldest: right for telemetry, the tail of a log, audio or video, where stale data is worthless. Drop keeps what is already queued and refuses new work, and the producer knows exactly what it lost. Block loses nothing but moves the wait upstream: the producer stalls until the reader makes room, so it takes longer for everything to get through.",
      "Un anillo tiene tamaño fijo, así que una ráfaga más grande que el espacio libre obliga a elegir. Sobrescribir conserva los datos más nuevos y renuncia a los más viejos: sirve para telemetría, la cola de un log, audio o video, donde un dato viejo ya no vale nada. Descartar conserva lo que ya está en el anillo y rechaza trabajo nuevo, y el productor sabe exactamente qué perdió. Frenar no pierde nada pero mueve la espera hacia atrás: el productor se detiene hasta que el lector haga lugar, así que todo tarda más en pasar.",
    ),
    watch: { rate: 2, policy: "overwrite", reader: "one", check: "yes", burst: true },
  },
  {
    id: "lap",
    title: t("A reader more than a lap behind", "Un lector a más de una vuelta de distancia"),
    change: t("Overwrite oldest, ring of 16 · the writer adds 10 items a second, the reader reads 6 · 60 s · the reader checks sequence numbers vs it doesn't", "Sobrescribir el más viejo, anillo de 16 · el escritor agrega 10 elementos por segundo y el lector lee 6 · 60 s · el lector revisa los números de secuencia vs no los revisa"),
    question: t("How many lost items does each reader notice?", "¿Cuántos elementos perdidos nota cada lector?"),
    options: [
      t("Both notice all of them: a missing item is obvious", "Los dos los notan todos: un elemento que falta es evidente"),
      t("The checking reader counts the gaps; the other reports none, although it lost just as many", "El lector que revisa cuenta los saltos; el otro no reporta ninguno, aunque perdió la misma cantidad"),
      t("Neither: with overwrite nothing is lost, only delayed", "Ninguno: al sobrescribir no se pierde nada, solo se retrasa"),
    ],
    answer: 1,
    why: t(
      "An item lives in slot sequence mod 16, so when the writer laps the reader, the reader's next slot already holds a newer item. Reading by position alone, the reader takes it as the one it expected: data goes missing silently and the stream jumps. Storing the sequence number with each item, or comparing the writer's counter with the reader's, turns that into a detected gap: the reader counts what it missed and jumps to the oldest item still there. Linux's perf and trace buffers report lost events this way.",
      "Un elemento vive en el hueco número de secuencia mod 16, así que cuando el escritor le saca una vuelta al lector, el siguiente hueco del lector ya tiene un elemento más nuevo. Si lee solo por posición, el lector lo toma como el que esperaba: los datos se pierden en silencio y el flujo salta. Guardar el número de secuencia con cada elemento, o comparar el contador del escritor con el del lector, lo convierte en un salto detectado: el lector cuenta lo que se perdió y salta al elemento más viejo que sigue ahí. Los búferes de perf y de trace de Linux reportan los eventos perdidos así.",
    ),
    watch: { rate: 6, policy: "overwrite", reader: "one", check: "no" },
  },
  {
    id: "size",
    title: t("Sizing the ring for a burst", "Dimensionar el anillo para una ráfaga"),
    change: t("Drop newest · a 2-second burst at 100 items a second (200 items) · the reader handles 40 a second throughout · rings of 64, 128 and 256 slots", "Descartar el más nuevo · una ráfaga de 2 segundos a 100 elementos por segundo (200 elementos) · el lector procesa 40 por segundo todo el tiempo · anillos de 64, 128 y 256 huecos"),
    question: t("What is the smallest of those that loses nothing?", "¿Cuál es el más chico de esos que no pierde nada?"),
    options: [
      t("64: the reader keeps up on average", "64: el lector alcanza en promedio"),
      t("128: the ring fills at (100 − 40) a second for 2 seconds", "128: el anillo se llena a (100 − 40) por segundo durante 2 segundos"),
      t("256: there has to be room for all 200", "256: tiene que haber lugar para los 200"),
    ],
    answer: 1,
    why: t(
      "During the burst the ring fills at the difference between the rates: 100 in, 40 out, 60 more every second, for 2 seconds. The reader works through part of the burst while it is still arriving, so you don't need room for all 200. Size for the worst burst you must absorb (rate difference × duration) plus some headroom. Sizes are usually a power of two, so sequence mod size becomes a cheap bit mask.",
      "Durante la ráfaga el anillo se llena a la diferencia entre las tasas: entran 100, salen 40, 60 más cada segundo, durante 2 segundos. El lector procesa parte de la ráfaga mientras todavía está llegando, así que no hace falta lugar para los 200. Dimensiona para la peor ráfaga que tengas que absorber (diferencia de tasas × duración) más un margen. Los tamaños suelen ser potencias de dos, así el número de secuencia mod tamaño se vuelve una máscara de bits barata.",
    ),
    watch: { rate: 2, policy: "drop", reader: "one", check: "yes", burst: true },
  },
  {
    id: "block",
    title: t("Block the producer", "Frenar al productor"),
    change: t("8 items a second reach the producer, the reader does 5, ring of 16 · 60 s · block the producer vs overwrite oldest", "Llegan 8 elementos por segundo al productor, el lector hace 5, anillo de 16 · 60 s · frenar al productor vs sobrescribir el más viejo"),
    question: t("With block, what happens over the minute?", "Si se frena al productor, ¿qué pasa durante el minuto?"),
    options: [
      t("Nothing is lost and nothing waits: blocking fixes the overload", "No se pierde nada y nada espera: frenar resuelve la sobrecarga"),
      t("Nothing is lost from the ring, but the producer spends most of the minute waiting and a pile grows in front of it", "No se pierde nada del anillo, pero el productor pasa casi todo el minuto esperando y se forma una pila delante de él"),
      t("The ring grows to make room for the extra items", "El anillo crece para hacer lugar a los elementos de más"),
    ],
    answer: 1,
    why: t(
      "A full ring that blocks is backpressure: the producer can only go as fast as the reader. The extra items don't disappear, they wait upstream instead: in the producer's memory, a socket buffer, a caller that times out. That is right when every item matters and the source can slow down (reading a file, a database export). It is wrong for a source that cannot wait (a sensor, an audio callback, live network traffic), where the pile in front of the ring just grows. Blocking also lets one slow reader freeze a fast system, so pair it with a timeout.",
      "Un anillo lleno que frena es contrapresión (backpressure): el productor solo puede ir tan rápido como el lector. Los elementos de más no desaparecen, esperan antes: en la memoria del productor, en un búfer de socket, en quien llama y termina por timeout. Eso sirve cuando cada elemento importa y la fuente puede ir más lento (leer un archivo, exportar una base de datos). No sirve para una fuente que no puede esperar (un sensor, el callback de audio, tráfico de red en vivo), donde la pila delante del anillo solo crece. Frenar también permite que un lector lento congele un sistema rápido, así que combínalo con un timeout.",
    ),
    watch: { rate: 6, policy: "block", reader: "one", check: "yes" },
  },
  {
    id: "batch",
    title: t("Read in batches", "Leer por lotes"),
    change: t("60 items a second, ring of 64, drop newest · each read costs 20 ms fixed plus 5 ms per item · one item per read vs every item available", "60 elementos por segundo, anillo de 64, descartar el más nuevo · cada lectura cuesta 20 ms fijos más 5 ms por elemento · un elemento por lectura vs todos los disponibles"),
    question: t("Which reader keeps up?", "¿Qué lector alcanza?"),
    options: [
      t("Neither: 60 a second is more than either can do", "Ninguno: 60 por segundo es más de lo que cualquiera puede"),
      t("Both: the work per item is only 5 ms", "Los dos: el trabajo por elemento es de solo 5 ms"),
      t("Only the batch reader: one at a time tops out at 40 a second and drops about a third", "Solo el lector por lotes: de a uno llega como máximo a 40 por segundo y descarta cerca de un tercio"),
    ],
    answer: 2,
    why: t(
      "The fixed cost (waking up, a lock or a system call, a cache miss on the shared counter) is paid once per read, so one item at a time caps the reader at 1 ÷ 25 ms = 40 a second. Taking everything available spreads that cost over the batch, and it adapts by itself: batches grow when the reader falls behind and shrink back to one when it has caught up, so waits stay short at light load. This is the batching effect of the LMAX Disruptor, and why audio callbacks, io_uring and network drivers handle every ready slot per wake-up.",
      "El costo fijo (despertarse, un lock o una llamada al sistema, un fallo de caché sobre el contador compartido) se paga una vez por lectura, así que de a un elemento el lector queda limitado a 1 ÷ 25 ms = 40 por segundo. Tomar todo lo disponible reparte ese costo en el lote, y se ajusta solo: los lotes crecen cuando el lector se atrasa y vuelven a uno cuando se pone al día, así que las esperas siguen cortas con poca carga. Es el efecto de los lotes del LMAX Disruptor, y por eso los callbacks de audio, io_uring y los drivers de red procesan todos los huecos listos en cada despertar.",
    ),
    watch: { rate: 6, policy: "drop", reader: "batch", check: "yes" },
  },
];

const QUESTIONS = [
  [t("How does a ring buffer make writes and reads O(1) with no allocation, and why are sizes often a power of two?", "¿Cómo logra un búfer circular que escribir y leer sean O(1) sin reservar memoria, y por qué el tamaño suele ser una potencia de dos?"),
    t("It is one fixed array allocated up front plus two counters, the writer's and the reader's. Item n goes in slot n mod size; a write advances one counter, a read the other, and nothing ever moves. The memory is contiguous and reused, so it is cache-friendly and creates no garbage. With a power-of-two size, n mod size is n & (size − 1), a single instruction.",
      "Es un solo arreglo fijo, reservado al inicio, más dos contadores: el del escritor y el del lector. El elemento n va en el hueco n mod tamaño; escribir avanza un contador y leer el otro, y nada se mueve nunca. La memoria es contigua y se reutiliza, así que aprovecha bien la caché y no genera basura. Con un tamaño potencia de dos, n mod tamaño es n & (tamaño − 1), una sola instrucción.")],
  [t("If you store only positions (0 to size − 1), the read and write positions are equal both when the ring is empty and when it is full. How do you tell the two apart?", "Si guardas solo posiciones (de 0 a tamaño − 1), las posiciones de lectura y escritura son iguales tanto con el anillo vacío como lleno. ¿Cómo distingues los dos casos?"),
    t("Keep counters that only grow (sequence numbers) and take the position as counter mod size: then written − read is the fill, 0 is empty and size is full. Other fixes: always leave one slot empty (full is write + 1 = read), or keep a separate count. Counters that only grow also give you sequence numbers for free, which is what lets a reader detect a lap.",
      "Usa contadores que solo crecen (números de secuencia) y calcula la posición como contador mod tamaño: así escritos − leídos es lo ocupado, 0 es vacío y el tamaño es lleno. Otras soluciones: dejar siempre un hueco libre (lleno es escritura + 1 = lectura) o llevar una cuenta aparte. Los contadores que solo crecen además te dan números de secuencia gratis, que es lo que permite a un lector detectar que le sacaron una vuelta.")],
  [t("Overwrite, drop or block: which would you pick for the last N events kept for a crash dump, for audio playback, and for a stream of payment events? Why?", "Sobrescribir, descartar o frenar: ¿cuál elegirías para los últimos N eventos que se guardan para un volcado de fallas, para reproducir audio y para un flujo de eventos de pagos? ¿Por qué?"),
    t("Crash dump: overwrite, because only the most recent history matters and the writer must never wait. Audio: the audio callback can't block or wait, so the producer side usually drops or overwrites, and an empty ring plays silence (an underrun). Payments: every event matters, so block (backpressure) or a durable queue; never silent loss, and if anything is ever dropped it must be counted and alerted on.",
      "Volcado de fallas: sobrescribir, porque solo importa la historia más reciente y el escritor nunca debe esperar. Audio: el callback de audio no puede frenar ni esperar, así que del lado del productor normalmente se descarta o se sobrescribe, y un anillo vacío suena como silencio (un underrun). Pagos: cada evento importa, así que frenar (backpressure) o una cola durable; nunca pérdida silenciosa, y si algo llega a descartarse, se cuenta y se alerta.")],
  [t("Why can a ring buffer with one producer and one consumer work without locks, and what changes with several producers?", "¿Por qué un búfer circular con un productor y un consumidor puede funcionar sin locks, y qué cambia con varios productores?"),
    t("Each counter has a single writer: only the producer advances the write counter, only the consumer the read counter, and each just reads the other's. With release/acquire memory ordering (publish the item, then the counter) no lock is needed. With several producers two of them could claim the same slot, so they claim slots with an atomic operation (compare-and-swap or fetch-and-add on the write counter), as the LMAX Disruptor does, and the reader waits for each slot to be published.",
      "Cada contador tiene un único escritor: solo el productor avanza el contador de escritura, solo el consumidor el de lectura, y cada uno solo lee el del otro. Con orden de memoria release/acquire (publicar el elemento y después el contador) no hace falta ningún lock. Con varios productores, dos podrían tomar el mismo hueco, así que reservan huecos con una operación atómica (compare-and-swap o fetch-and-add sobre el contador de escritura), como hace el LMAX Disruptor, y el lector espera a que cada hueco esté publicado.")],
  [t("How can a reader detect that the writer lapped it, and what should it do then?", "¿Cómo puede un lector detectar que el escritor le sacó una vuelta, y qué debería hacer entonces?"),
    t("Compare counters: if written − read > size, at least that many items were overwritten. Or store each item's sequence number and check it on read: a newer number than expected means a lap. Then count the gap (expose it as a metric or a marker in the stream, as perf's lost-event records do), jump to the oldest item still in the ring and carry on. If losing data is not acceptable, the real fix is a faster reader, a bigger ring, batching, or a different policy.",
      "Comparar contadores: si escritos − leídos > tamaño, al menos esa cantidad de elementos se sobrescribió. O guardar el número de secuencia de cada elemento y revisarlo al leer: un número más nuevo que el esperado indica una vuelta. Después, contar el salto (exponerlo como métrica o como marca en el flujo, como los registros de eventos perdidos de perf), saltar al elemento más viejo que sigue en el anillo y seguir. Si perder datos no es aceptable, la solución de verdad es un lector más rápido, un anillo más grande, lotes, u otra política.")],
  [t("When is a ring buffer the wrong tool compared with a growable queue or a durable log?", "¿Cuándo un búfer circular es la herramienta equivocada frente a una cola que crece o un log durable?"),
    t("When you can't bound the burst and can neither lose nor block; when items survive a crash or a restart (a ring lives in memory; a durable log like Kafka keeps them on disk, with its own retention limit); when items vary a lot in size (a byte ring with length prefixes, or pointers to elsewhere, gets fiddly); when you need priorities or random removal. A ring wins when the size limit is acceptable and you want predictable, allocation-free speed.",
      "Cuando no puedes acotar la ráfaga y no puedes ni perder ni frenar; cuando los elementos deben sobrevivir a una caída o a un reinicio (un anillo vive en memoria; un log durable como Kafka los guarda en disco, con su propio límite de retención); cuando los elementos varían mucho de tamaño (un anillo de bytes con prefijos de largo, o punteros a otro lugar, se complica); cuando necesitas prioridades o quitar elementos del medio. Un anillo gana cuando el límite de tamaño es aceptable y quieres velocidad predecible y sin reservar memoria.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Ring table", "Mesa del anillo"),
  keys: [
    { mark: "lit", label: t("Items the reader is reading; the FULL lamp; the producer's flag while it is blocked", "Los elementos que el lector está leyendo; la lámpara LLENO; el banderín del productor mientras está frenado") },
    { mark: "raised", label: t("Items, each with its sequence number on top; the hands: write (long, solid) and read (ring at the tip)", "Los elementos, cada uno con su número de secuencia arriba; las manecillas: escritura (larga, sólida) y lectura (anillo en la punta)") },
    { mark: "flat", label: t("The 16 numbered pockets: item n goes in pocket n mod 16", "Los 16 huecos numerados: el elemento n va en el hueco n mod 16") },
  ],
  caption: t(
    "The producer at the back left gives each item the next sequence number and drops it into the pocket under the write hand, which then moves on one pocket. The reader at the back right takes the item under the read hand (several at once when it reads in batches), holds it while it works, then drops it in the tray. When the write hand reaches unread items the ring is full and the policy on the console decides: overwrite the oldest unread item (it falls into the bin), drop the new one (straight into the bin), or block the producer (items pile up on its table and its flag goes up). LAG is how many items the write counter is ahead of the read counter; above 16 the writer has lapped the reader.",
    "El productor, atrás a la izquierda, le da a cada elemento el siguiente número de secuencia y lo deja en el hueco bajo la manecilla de escritura, que después avanza un hueco. El lector, atrás a la derecha, toma el elemento bajo la manecilla de lectura (varios a la vez cuando lee por lotes), lo sostiene mientras trabaja y después lo deja en la bandeja. Cuando la manecilla de escritura llega a elementos sin leer, el anillo está lleno y la política de la consola decide: sobrescribir el elemento sin leer más viejo (cae al cesto), descartar el nuevo (va directo al cesto) o frenar al productor (los elementos se apilan en su mesa y se levanta su banderín). RETRASO es cuántos elementos adelanta el contador de escritura al de lectura; por encima de 16, el escritor le sacó una vuelta al lector.",
  ),
  readout: t("starting", "iniciando"),
  stage: "data-ring",
  stageLabel: t("Ring buffer simulation. Space pauses or resumes.", "Simulación de un búfer circular. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const controls = panel({
  stats: [["fill", t("In use", "Ocupados"), "0/16"], ["lag", t("Lag", "Retraso")], ["lost", t("Lost", "Perdidos")], ["gaps", t("Gaps seen", "Saltos vistos")], ["stall", t("Producer stalled", "Productor frenado"), "0.0 s"], ["batch", t("Items per read", "Elementos por lectura"), "–"]],
  controls: [
    seg("rate", t("Producer", "Productor"), [[2, "2/s"], [4, "4/s"], [6, "6/s"]], 6),
    seg("reader", t("Reader", "Lector"), [["one", t("One at a time (4/s)", "De a uno (4/s)")], ["batch", t("Batches", "Por lotes")]], "one"),
    seg("policy", t("When full", "Cuando está lleno"), [["overwrite", t("Overwrite oldest", "Sobrescribir el más viejo")], ["drop", t("Drop newest", "Descartar el más nuevo")], ["block", t("Block producer", "Frenar al productor")]], "overwrite"),
    seg("check", t("Reader checks sequence numbers", "El lector revisa los números de secuencia"), [["yes", t("Yes", "Sí")], ["no", t("No", "No")]], "yes"),
    speedSeg(undefined, 0.5),
    actions(t("Do something", "Haz algo"), [["burst", t("40 at once", "40 de golpe")], ["stop", t("Stop the reader 5 s", "Detener al lector 5 s")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
});

const css = `
.iso-stage [data-layer] text{pointer-events:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const TOKEN_SVG = ${JSON.stringify(tokenSvg())};
const RESULTS = ${JSON.stringify(R)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const { T, L } = WB;

const stage = document.querySelector("[data-ring]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const layers = Object.fromEntries(["ring", "prod", "desk", "tray", "bin", "fly"].map((n) => [n, q('[data-layer="' + n + '"]')]));
const handEls = { w: [], r: [] };
for (let i = 0; i < G.CAP; i++) { handEls.w.push(q('[data-hand="w' + i + '"]')); handEls.r.push(q('[data-hand="r' + i + '"]')); }
const lamp = { on: q('[data-lamp="on"]'), off: q('[data-lamp="off"]') };
const flag = { on: q('[data-flag="on"]'), off: q('[data-flag="off"]') };
const plates = [...svg.querySelectorAll("[data-policy]")];
const counters = Object.fromEntries(["fill", "lag", "lost", "gaps", "read", "waiting", "stall"].map((n) => [n, WB.counter(svg, n, P)]));
const show = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };

// ---------- items: one pooled element per item on screen, eased toward where the model has it ----------
const free = [];
function makeEl() {
  const g = document.createElementNS(NS, "g");
  g.innerHTML = TOKEN_SVG;
  return { g, body: g.querySelector("[data-body]"), seq: g.querySelector("[data-seq]"), shown: {} };
}
const recs = new Map();   // item id -> { el, pos, target, layer, leaving, until, item }
function dress(r, lit) {
  const s = r.el.shown, it = r.item;
  const label = it.seq === undefined ? "" : String(it.seq);
  if (s.label !== label) { s.label = label; r.el.seq.textContent = label; r.el.seq.setAttribute("font-size", label.length <= 2 ? 3 : label.length === 3 ? 2.4 : 1.9); }
  if (s.lit !== lit) { s.lit = lit; r.el.body.toggleAttribute("data-lit", lit); r.el.seq.setAttribute("data-tone", lit ? "on-lit" : "hi"); }
}
function moveTo(r, layer) { if (r.layer !== layer) { r.layer = layer; layers[layer].appendChild(r.el.g); } }
function place(item, pos, layer, lit) {
  let r = recs.get(item.id);
  if (!r) {
    const el = free.pop() || makeEl();
    r = { el, item, pos: snapping ? [...pos] : [...G.PROD_SPOT], layer: null };
    recs.set(item.id, r);
  }
  r.item = item; r.target = pos; r.leaving = false; r.seen = true; r.want = layer;
  dress(r, lit);
}
function drop(id) { const r = recs.get(id); r.el.g.remove(); r.el.g.style.opacity = ""; free.push(r.el); recs.delete(id); }

const cfg = { rate: 6, reader: "one", policy: "overwrite", check: "yes", speed: 0.5 };
const WARM = 20;
let model, clock, logAt, note, seed = 5, snapping = false, binned = [];
const modelCfg = () => ({ cap: G.CAP, rate: cfg.rate, policy: cfg.policy, check: cfg.check === "yes", overhead: 0.15, per: 0.1, batch: cfg.reader === "batch", maxBatch: 16 });

function restart(warm = WARM) {
  for (const id of [...recs.keys()]) drop(id);
  model = makeRing(modelCfg(), seed);
  seed = (Date.now() % 1e6) + 1;
  clock = warm; logAt = 0; note = null; binned = [];
  model.runTo(clock);
  plates.forEach((p) => show(p, p.dataset.policy === cfg.policy));
  snapping = true; paint(0, true); snapping = false;
}

// What happened since the last frame: lost items go to the bin; the newest message goes to the readout.
function scanLog() {
  for (; logAt < model.log.length; logAt++) {
    const e = model.log[logAt];
    if (e.type === "overwrite") { binned.push(e.item); note = { t: e.t, text: T("ring full · item " + e.by + " overwrote item " + e.seq + " before it was read", "anillo lleno · el elemento " + e.by + " sobrescribió al " + e.seq + " antes de que se leyera") }; }
    if (e.type === "drop") { binned.push(e.item); note = { t: e.t, text: T("ring full · the new item was dropped at the producer", "anillo lleno · el elemento nuevo se descartó en el productor") }; }
    if (e.type === "wait" && model.backlog.length === 1) note = { t: e.t, text: T("ring full · the producer waits with its item", "anillo lleno · el productor espera con su elemento") };
    if (e.type === "gap") note = { t: e.t, text: T("reader expected " + e.from + ", found a newer item · skipped " + (e.to - e.from) + ", goes on from " + e.to, "el lector esperaba el " + e.from + " y encontró uno más nuevo · saltó " + (e.to - e.from) + ", sigue desde el " + e.to) };
    if (e.type === "silent") note = { t: e.t, text: T("reader expected " + e.expected + ", read " + e.found + " instead · and didn't notice", "el lector esperaba el " + e.expected + " y leyó el " + e.found + " · y no se dio cuenta") };
  }
  if (binned.length > 60) binned = binned.slice(-G.BIN_SPOTS.length);
}

const ease = (a, b, f) => a + (b - a) * f;
function paint(dt, snap) {
  scanLog();
  for (const r of recs.values()) r.seen = false;
  const m = model;
  // the ring: unread items sit in their pockets
  m.slots.forEach((it, i) => { if (it && !it.read && !it.lost) place(it, [...G.SLOT[i]], "ring", false); });
  // the reader's hand
  m.reader.hand.forEach((it, k) => { const s = G.HAND_SPOTS[k % G.HAND_SPOTS.length]; place(it, [s[0], s[1], s[2] + Math.floor(k / G.HAND_SPOTS.length) * (G.TOKEN.h + 0.3)], "desk", true); });
  // the blocked producer's pile
  m.backlog.forEach((it, k) => {
    const per = G.BACKLOG.xs.length * G.BACKLOG.ys.length, layer = Math.floor(k / per);
    if (layer >= G.BACKLOG.layers) return;
    const j = k % per;
    place(it, [G.BACKLOG.xs[j % G.BACKLOG.xs.length], G.BACKLOG.ys[Math.floor(j / G.BACKLOG.xs.length)], G.BACKLOG.z + layer * (G.TOKEN.h + 0.4)], "prod", false);
  });
  // the bin keeps the last few lost items
  binned.slice(-G.BIN_SPOTS.length).forEach((it, n) => place(it, [...G.BIN_SPOTS[n]], "bin", false));

  // items that left: read ones slide into the tray and fade, the rest just fade
  for (const [id, r] of recs) {
    if (r.seen) continue;
    if (!r.leaving) {
      r.leaving = true; r.until = performance.now() + 650;
      if (r.want === "desk") { r.target = [...G.TRAY_SPOT]; r.want = "tray"; dress(r, false); }
      else r.target = [...r.pos];
    }
    if (snap || performance.now() > r.until) drop(id);
  }

  // ease toward targets, lifting a little while travelling
  const f = snap ? 1 : 1 - Math.exp(-dt * 16);
  const byLayer = {};
  for (const r of recs.values()) {
    const [tx, ty, tz] = r.target;
    const dist = Math.hypot(tx - r.pos[0], ty - r.pos[1]);
    r.pos[0] = ease(r.pos[0], tx, f); r.pos[1] = ease(r.pos[1], ty, f);
    r.pos[2] = snap ? tz : ease(r.pos[2], tz + Math.min(10, dist * 0.2), f);
    // a moving item flies over everything, then settles into its station's layer
    moveTo(r, dist > 3 && !r.leaving ? "fly" : r.want);
    r.el.g.setAttribute("transform", translateAlong(P, r.pos));
    if (r.leaving) r.el.g.style.opacity = String(Math.max(0, Math.min(1, (r.until - performance.now()) / 400)));
    (byLayer[r.layer] ||= []).push(r);
  }
  // painter's order inside each layer: far items first, lower before higher
  for (const [name, list] of Object.entries(byLayer)) {
    list.sort((a, b) => depthOf(a.pos, P) - depthOf(b.pos, P));
    let prev = null, inOrder = true;
    for (const r of list) { if (prev && r.el.g.previousElementSibling !== prev) { inOrder = false; break; } prev = r.el.g; }
    if (!inOrder) for (const r of list) layers[name].appendChild(r.el.g);
  }

  // hands, lamp, flag
  const wi = m.w % G.CAP, ri = m.r % G.CAP;
  handEls.w.forEach((el, i) => show(el, i === wi));
  handEls.r.forEach((el, i) => show(el, i === ri));
  const full = m.full();
  show(lamp.on, full); show(lamp.off, !full);
  const blocked = m.backlog.length > 0;
  show(flag.on, blocked); show(flag.off, !blocked);

  // counters, stats and the readout
  const st = m.st, lag = m.w - m.r;
  counters.fill.set(m.fill()); counters.lag.set(Math.min(999, lag)); counters.lost.set(m.lost()); counters.gaps.set(st.gapsSeen);
  counters.read.set(st.read); counters.waiting.set(m.backlog.length); counters.stall.set(Math.round(m.stalled()));
  stat("fill", m.fill() + "/" + G.CAP); stat("lag", lag); stat("lost", m.lost()); stat("gaps", st.gapsSeen);
  stat("stall", m.stalled().toFixed(1) + " s"); stat("batch", st.ops ? (st.opItems / st.ops).toFixed(1) : "–");
  narrate();
}
function narrate() {
  if (note && clock - note.t < 2.2) { say(L(note.text)); return; }
  const m = model, lag = m.w - m.r;
  if (m.reader.pausedUntil > clock) { say(L("reader stopped · " + m.fill() + " of " + G.CAP + " pockets in use", "lector detenido · " + m.fill() + " de " + G.CAP + " huecos ocupados")); return; }
  say(L("written " + m.w + " · read " + m.st.read + " · " + m.fill() + " of " + G.CAP + " in use" + (lag > G.CAP ? " · lapped by " + (lag - G.CAP) : ""),
    "escritos " + m.w + " · leídos " + m.st.read + " · " + m.fill() + " de " + G.CAP + " ocupados" + (lag > G.CAP ? " · le sacó " + (lag - G.CAP) + " de ventaja" : "")));
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(dt); }, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(L("paused", "en pausa")); } });
// The language switch: relabel the pause button and redraw the readout and stats, even while paused.
WB.onLang(() => { pauseBtn.textContent = loop.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); paint(0); if (loop.paused) say(L("paused", "en pausa")); });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = name === "rate" ? Number(raw) : raw;
  if (quiet) return;
  // the producer's rate, the reader and the checks change the running ring; the policy starts a new run
  if (name === "rate") model.setRate(cfg.rate);
  else if (name === "reader") model.cfg.batch = cfg.reader === "batch";
  else if (name === "check") model.cfg.check = cfg.check === "yes";
  else restart();
}
WB.onSegments((name, value) => set(name, value));
const burst = () => { model.inject(clock, 40); note = { t: clock, text: T("40 items arrive at once", "llegan 40 elementos de golpe") }; };
document.querySelector('[data-act="burst"]').addEventListener("click", () => { burst(); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="stop"]').addEventListener("click", () => { model.pauseReader(clock, 5); note = { t: clock, text: T("the reader stops for 5 s", "el lector se detiene 5 s") }; if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (numbers computed from the same model) ----------
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const n0 = (x) => Math.round(x).toLocaleString("en");
const RUNS = {
  burst: () => {
    const { overwrite: o, drop: d, block: b } = RESULTS.burst;
    return { verdict: T("Overwrite: " + n0(o.lost) + " lost, items " + o.lostFrom + " to " + o.lostTo + " of the burst; the reader got the newest 16. Drop: " + n0(d.lost) + " lost, items " + d.lostFrom + " to " + d.lostTo + ". Block: " + n0(b.lost) + " lost; the producer held up to " + n0(b.held) + " items and stood still for " + one(b.stall) + " s, and the ring took " + one(b.empty) + " s to empty instead of " + one(o.empty) + " s.",
        "Sobrescribir: " + n0(o.lost) + " perdidos, los elementos " + o.lostFrom + " a " + o.lostTo + " de la ráfaga; el lector recibió los 16 más nuevos. Descartar: " + n0(d.lost) + " perdidos, los elementos " + d.lostFrom + " a " + d.lostTo + ". Frenar: " + n0(b.lost) + " perdidos; el productor llegó a sostener " + n0(b.held) + " elementos y estuvo quieto " + one(b.stall) + " s, y el anillo tardó " + one(b.empty) + " s en vaciarse en lugar de " + one(o.empty) + " s."),
      bars: [[T("Lost, overwrite", "Perdidos, sobrescribir"), o.lost / 40, T("#" + o.lostFrom + "–" + o.lostTo, "n.º " + o.lostFrom + "–" + o.lostTo), true], [T("Lost, drop", "Perdidos, descartar"), d.lost / 40, T("#" + d.lostFrom + "–" + d.lostTo, "n.º " + d.lostFrom + "–" + d.lostTo), true], [T("Lost, block", "Perdidos, frenar"), b.lost / 40, "0"], [T("Producer stalled, block (of 20 s)", "Productor quieto, frenar (de 20 s)"), Math.min(1, b.stall / 20), one(b.stall) + " s"]] };
  },
  lap: () => {
    const { naive: a, checked: c } = RESULTS.lap, top = Math.max(a.written, 1);
    return { verdict: T("In both runs about " + n0(a.written) + " were written and " + n0(a.read) + " read. Overwritten before being read: " + n0(a.lost) + " without checks, " + n0(c.lost) + " with them. The checking reader counted " + n0(c.seen) + " skipped; the other counted 0, and " + n0(a.silent) + " of its " + n0(a.read) + " reads were not the item it thought it was reading.",
        "En las dos ejecuciones se escribieron cerca de " + n0(a.written) + " y se leyeron " + n0(a.read) + ". Sobrescritos antes de leerse: " + n0(a.lost) + " sin revisar, " + n0(c.lost) + " revisando. El lector que revisa contó " + n0(c.seen) + " saltados; el otro contó 0, y " + n0(a.silent) + " de sus " + n0(a.read) + " lecturas no eran el elemento que creía estar leyendo."),
      bars: [[T("Lost, no checks", "Perdidos, sin revisar"), a.lost / top, n0(a.lost), true], [T("Noticed, no checks", "Notados, sin revisar"), 0, "0", true], [T("Lost, with checks", "Perdidos, revisando"), c.lost / top, n0(c.lost)], [T("Noticed, with checks", "Notados, revisando"), c.seen / top, n0(c.seen)]] };
  },
  size: () => {
    const { c64, c128, c256 } = RESULTS.size;
    return { verdict: T("64 slots: filled up, " + n0(c64.lost) + " dropped. 128 slots: peaked at " + n0(c128.peak) + ", nothing dropped. 256 slots: peaked at " + n0(c256.peak) + ", nothing dropped, " + n0(256 - c256.peak) + " slots never used.",
        "64 huecos: se llenó y se descartaron " + n0(c64.lost) + ". 128 huecos: llegó a " + n0(c128.peak) + ", no se descartó nada. 256 huecos: llegó a " + n0(c256.peak) + ", no se descartó nada y " + n0(256 - c256.peak) + " huecos nunca se usaron."),
      bars: [[T("Peak fill, 64 slots", "Máximo ocupado, 64 huecos"), c64.peak / 256, n0(c64.peak)], [T("Dropped, 64 slots", "Descartados, 64 huecos"), c64.lost / 200, n0(c64.lost), true], [T("Peak fill, 128 slots", "Máximo ocupado, 128 huecos"), c128.peak / 256, n0(c128.peak)], [T("Peak fill, 256 slots", "Máximo ocupado, 256 huecos"), c256.peak / 256, n0(c256.peak)]] };
  },
  block: () => {
    const { block: b, overwrite: o } = RESULTS.block;
    return { verdict: T("Block: " + n0(b.lost) + " lost, " + n0(b.read) + " read; the producer was stalled " + n0(b.stall) + " of the 60 s and " + n0(b.backlog) + " items were waiting in front of it at the end, the oldest for " + n0(b.wait) + " s. Overwrite: the same " + n0(o.read) + " read, nothing waiting, " + n0(o.lost) + " lost.",
        "Frenar: " + n0(b.lost) + " perdidos, " + n0(b.read) + " leídos; el productor estuvo frenado " + n0(b.stall) + " de los 60 s y al final había " + n0(b.backlog) + " elementos esperando delante de él, el más viejo desde hacía " + n0(b.wait) + " s. Sobrescribir: los mismos " + n0(o.read) + " leídos, nada esperando, " + n0(o.lost) + " perdidos."),
      bars: [[T("Producer stalled, block", "Productor frenado, frenar"), b.stall / 60, n0(b.stall) + " s", true], [T("Waiting upstream, block", "Esperando antes, frenar"), b.backlog / 200, n0(b.backlog), true], [T("Lost, overwrite", "Perdidos, sobrescribir"), o.lost / 200, n0(o.lost)], [T("Read, either way", "Leídos, en ambos casos"), b.read / 480, n0(b.read)]] };
  },
  batch: () => {
    const { one: a, batch: b } = RESULTS.batch;
    return { verdict: T("One at a time: " + n0(a.read) + " of " + n0(a.arrived) + " read, " + n0(a.lost) + " dropped, average wait " + one(a.wait) + " s. Batches: " + n0(b.read) + " read, " + n0(b.lost) + " dropped, " + one(b.perOp) + " items per read on average, average wait " + n0(b.wait * 1000) + " ms, reader busy " + Math.round(b.busy * 100) + "% of the time.",
        "De a uno: " + n0(a.read) + " de " + n0(a.arrived) + " leídos, " + n0(a.lost) + " descartados, espera media " + one(a.wait) + " s. Por lotes: " + n0(b.read) + " leídos, " + n0(b.lost) + " descartados, " + one(b.perOp) + " elementos por lectura en promedio, espera media " + n0(b.wait * 1000) + " ms, lector ocupado el " + Math.round(b.busy * 100) + "% del tiempo."),
      bars: [[T("Dropped, one at a time", "Descartados, de a uno"), a.lost / a.arrived, n0(a.lost), true], [T("Dropped, batches", "Descartados, por lotes"), b.lost / b.arrived, n0(b.lost)], [T("Items per read, batches (of 4)", "Elementos por lectura, lotes (de 4)"), b.perOp / 4, one(b.perOp)], [T("Average wait, one at a time (of 2 s)", "Espera media, de a uno (de 2 s)"), Math.min(1, a.wait / 2), one(a.wait) + " s", true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  set("rate", String(w.rate), true); set("policy", w.policy, true); set("reader", w.reader, true); set("check", w.check, true);
  restart(w.burst ? 4 : WARM);
  if (loop.paused) loop.setPaused(false);
  if (w.burst) setTimeout(burst, 1200);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./ring-buffer-workbench.html", import.meta.url), {
  title: t("Ring Buffer Workbench", "Banco de trabajo: búfer circular"),
  eyebrow: t("Systems lesson 42 · Ring buffers", "Lección de sistemas 42 · Búfer circular (ring buffer)"),
  lede: t("A ring buffer is a fixed array used as a queue: a writer and a reader chase each other round it, and item n lives in slot n mod size. Nothing moves and nothing is allocated, so it is fast and predictable, which is why kernel logs, audio, network cards, telemetry pipelines and the LMAX Disruptor are built on one. The price is a hard size limit, and a decision about what happens when the writer catches up with the reader. This lesson runs one as a round table with 16 pockets: watch it, predict what fills it, then explain it back.",
    "Un búfer circular (ring buffer) es un arreglo fijo que se usa como cola: un escritor y un lector se persiguen dando vueltas, y el elemento n vive en el hueco n mod tamaño. Nada se mueve y no se reserva memoria, así que es rápido y predecible; por eso los logs del kernel, el audio, las tarjetas de red, las canalizaciones de telemetría y el LMAX Disruptor se construyen sobre uno. El precio es un límite de tamaño estricto, y decidir qué pasa cuando el escritor alcanza al lector. Esta lección lo muestra como una mesa redonda con 16 huecos: obsérvala, predice qué la llena y después explícalo."),
  machine: { intro: t("Items come from the producer at the back left; each gets the next sequence number and drops into the pocket under the write hand. The reader at the back right takes the pocket under the read hand. When the ring is full, the policy on the console decides: overwrite the oldest unread item, drop the new one, or make the producer wait. Try a faster producer, batch reads, each policy, and turning the sequence checks off.",
    "Los elementos salen del productor, atrás a la izquierda; cada uno recibe el siguiente número de secuencia y cae en el hueco bajo la manecilla de escritura. El lector, atrás a la derecha, toma el hueco bajo la manecilla de lectura. Cuando el anillo está lleno, la política de la consola decide: sobrescribir el elemento sin leer más viejo, descartar el nuevo o hacer esperar al productor. Prueba un productor más rápido, leer por lotes, cada política y apagar la revisión de los números de secuencia."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine; runs with random arrivals are averaged over eight seeds.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina; las ejecuciones con llegadas aleatorias se promedian sobre ocho semillas."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote ring-buffer-workbench.html", (size / 1024).toFixed(0) + " KB");
