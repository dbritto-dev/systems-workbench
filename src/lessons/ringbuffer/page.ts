// @ts-nocheck: content ported as-is
// Systems lesson 42 · Ring buffers: a round table with 16 pockets as a ring buffer.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one, int } from "../../lib/format";
import { buildFigure, tokenSvg, P, GEOMETRY } from "./figure";
import { burstRun, lapRun, sizeRun, raceRun, batchRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const RESULTS = { burst: burstRun(), lap: lapRun(), size: sizeRun(), race: raceRun(), batch: batchRun() };

// What each card shows after a run.
// Whole numbers with thousands separators (3,600, int), as the original page printed them; n0 has none.
const RUNS = {
  burst: () => {
    const { overwrite: o, drop: d, block: b } = RESULTS.burst;
    return { verdict: t("Overwrite: " + int(o.lost) + " lost, items " + o.lostFrom + " to " + o.lostTo + " of the burst; the reader got the newest 16. Drop: " + int(d.lost) + " lost, items " + d.lostFrom + " to " + d.lostTo + ". Block: " + int(b.lost) + " lost; the producer held up to " + int(b.held) + " items and stood still for " + one(b.stall) + " s, and the ring took " + one(b.empty) + " s to empty instead of " + one(o.empty) + " s.",
        "Sobrescribir: " + int(o.lost) + " perdidos, los elementos " + o.lostFrom + " a " + o.lostTo + " de la ráfaga; el lector recibió los 16 más nuevos. Descartar: " + int(d.lost) + " perdidos, los elementos " + d.lostFrom + " a " + d.lostTo + ". Frenar: " + int(b.lost) + " perdidos; el productor llegó a sostener " + int(b.held) + " elementos y estuvo quieto " + one(b.stall) + " s, y el anillo tardó " + one(b.empty) + " s en vaciarse en lugar de " + one(o.empty) + " s."),
      bars: [[t("Lost, overwrite", "Perdidos, sobrescribir"), o.lost / 40, t("#" + o.lostFrom + "–" + o.lostTo, "n.º " + o.lostFrom + "–" + o.lostTo), true], [t("Lost, drop", "Perdidos, descartar"), d.lost / 40, t("#" + d.lostFrom + "–" + d.lostTo, "n.º " + d.lostFrom + "–" + d.lostTo), true], [t("Lost, block", "Perdidos, frenar"), b.lost / 40, "0"], [t("Producer stalled, block (of 20 s)", "Productor quieto, frenar (de 20 s)"), Math.min(1, b.stall / 20), one(b.stall) + " s"]] };
  },
  lap: () => {
    const { naive: a, checked: c } = RESULTS.lap, top = Math.max(a.written, 1);
    return { verdict: t("In both runs about " + int(a.written) + " were written and " + int(a.read) + " read. Overwritten before being read: " + int(a.lost) + " without checks, " + int(c.lost) + " with them. The checking reader counted " + int(c.seen) + " skipped; the other counted 0, and " + int(a.silent) + " of its " + int(a.read) + " reads were not the item it thought it was reading.",
        "En las dos ejecuciones se escribieron cerca de " + int(a.written) + " y se leyeron " + int(a.read) + ". Sobrescritos antes de leerse: " + int(a.lost) + " sin revisar, " + int(c.lost) + " revisando. El lector que revisa contó " + int(c.seen) + " saltados; el otro contó 0, y " + int(a.silent) + " de sus " + int(a.read) + " lecturas no eran el elemento que creía estar leyendo."),
      bars: [[t("Lost, no checks", "Perdidos, sin revisar"), a.lost / top, int(a.lost), true], [t("Noticed, no checks", "Notados, sin revisar"), 0, "0", true], [t("Lost, with checks", "Perdidos, revisando"), c.lost / top, int(c.lost)], [t("Noticed, with checks", "Notados, revisando"), c.seen / top, int(c.seen)]] };
  },
  size: () => {
    const { c64, c128, c256 } = RESULTS.size;
    return { verdict: t("64 slots: filled up, " + int(c64.lost) + " dropped. 128 slots: peaked at " + int(c128.peak) + ", nothing dropped. 256 slots: peaked at " + int(c256.peak) + ", nothing dropped, " + int(256 - c256.peak) + " slots never used.",
        "64 huecos: se llenó y se descartaron " + int(c64.lost) + ". 128 huecos: llegó a " + int(c128.peak) + ", no se descartó nada. 256 huecos: llegó a " + int(c256.peak) + ", no se descartó nada y " + int(256 - c256.peak) + " huecos nunca se usaron."),
      bars: [[t("Peak fill, 64 slots", "Máximo ocupado, 64 huecos"), c64.peak / 256, int(c64.peak)], [t("Dropped, 64 slots", "Descartados, 64 huecos"), c64.lost / 200, int(c64.lost), true], [t("Peak fill, 128 slots", "Máximo ocupado, 128 huecos"), c128.peak / 256, int(c128.peak)], [t("Peak fill, 256 slots", "Máximo ocupado, 256 huecos"), c256.peak / 256, int(c256.peak)]] };
  },
  race: () => {
    const { racy: a, atomic: b } = RESULTS.race, top = Math.max(a.arrived, 1);
    return { verdict: t("Plain read, then store: of " + int(a.arrived) + " items, " + int(a.reached) + " reached the reader and " + int(a.lost) + " vanished without an error: " + int(a.clobbered) + " written over in their own slot by the other producer, the rest left behind the reader. Fetch-and-add: " + int(b.reached) + " of " + int(b.arrived) + " reached the reader, " + int(b.lost) + " lost.",
        "Leer y después guardar: de " + int(a.arrived) + " elementos, " + int(a.reached) + " llegaron al lector y " + int(a.lost) + " desaparecieron sin ningún error: " + int(a.clobbered) + " sobrescritos en su propio hueco por el otro productor, el resto quedó detrás del lector. Fetch-and-add: " + int(b.reached) + " de " + int(b.arrived) + " llegaron al lector, " + int(b.lost) + " perdidos."),
      bars: [[t("Reached the reader, plain", "Llegaron al lector, simple"), a.reached / top, int(a.reached), true], [t("Vanished, plain", "Desaparecidos, simple"), a.lost / top, int(a.lost), true], [t("Reached the reader, fetch-and-add", "Llegaron al lector, fetch-and-add"), b.reached / top, int(b.reached)], [t("Vanished, fetch-and-add", "Desaparecidos, fetch-and-add"), b.lost / top, int(b.lost)]] };
  },
  batch: () => {
    const { one: a, batch: b } = RESULTS.batch;
    return { verdict: t("One at a time: " + int(a.read) + " of " + int(a.arrived) + " read, " + int(a.lost) + " dropped, average wait " + one(a.wait) + " s. Batches: " + int(b.read) + " read, " + int(b.lost) + " dropped, " + one(b.perOp) + " items per read on average, average wait " + int(b.wait * 1000) + " ms, reader busy " + Math.round(b.busy * 100) + "% of the time.",
        "Uno a la vez: " + int(a.read) + " de " + int(a.arrived) + " leídos, " + int(a.lost) + " descartados, espera media " + one(a.wait) + " s. Por lotes: " + int(b.read) + " leídos, " + int(b.lost) + " descartados, " + one(b.perOp) + " elementos por lectura en promedio, espera media " + int(b.wait * 1000) + " ms, lector ocupado el " + Math.round(b.busy * 100) + "% del tiempo."),
      bars: [[t("Dropped, one at a time", "Descartados, uno a la vez"), a.lost / a.arrived, int(a.lost), true], [t("Dropped, batches", "Descartados, por lotes"), b.lost / b.arrived, int(b.lost)], [t("Items per read, batches (of 4)", "Elementos por lectura, lotes (de 4)"), b.perOp / 4, one(b.perOp)], [t("Average wait, one at a time (of 2 s)", "Espera media, uno a la vez (de 2 s)"), Math.min(1, a.wait / 2), one(a.wait) + " s", true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "burst",
    title: t("40 items at once into 16 slots", "40 elementos de golpe en 16 huecos"),
    change: t("A quiet 2/s stream, a reader that does 4/s · 40 items arrive at once · overwrite oldest vs drop newest vs block the producer", "Un flujo tranquilo de 2/s, un lector que hace 4/s · llegan 40 elementos de golpe · sobrescribir el más viejo vs descartar el más nuevo vs frenar al productor"),
    question: t("What does each policy do with the 40?", "¿Qué hace cada política con los 40?"),
    options: [
      t("All three lose the same 24 items", "Las tres pierden los mismos 24 elementos"),
      t("Overwrite and drop lose different 24; block loses none", "Sobrescribir y descartar pierden 24 distintos; frenar, ninguno"),
      t("Block loses none and costs nothing; the others lose all 40", "Frenar no pierde ninguno y no cuesta nada; las otras pierden los 40"),
    ],
    answer: 1,
    why: t(
      "A ring has a fixed size, so a burst bigger than the free space forces a choice. Overwrite keeps the newest data and gives up the oldest 24 of the burst: right for telemetry, the tail of a log or video, where stale data is worthless. Drop keeps what is already queued and refuses the last 24, and the producer knows exactly what it lost. Block loses nothing but moves the wait upstream: the producer stalls until the reader makes room, so everything takes longer to get through, and if it keeps arriving faster than the reader can go, a pile grows in front of the ring (in the producer's memory, a socket buffer, a caller that times out). That suits a source that can slow down, like a file or a database export, not a sensor or live traffic. Blocking also lets one slow reader freeze a fast system, so give the wait a time limit.",
      "Un anillo tiene tamaño fijo, así que una ráfaga más grande que el espacio libre obliga a elegir. Sobrescribir conserva los datos más nuevos y renuncia a los 24 más viejos de la ráfaga: sirve para telemetría, la cola de un log o video, donde un dato viejo ya no vale nada. Descartar conserva lo que ya está en el anillo y rechaza los últimos 24, y el productor sabe exactamente qué perdió. Frenar no pierde nada pero mueve la espera hacia atrás: el productor se detiene hasta que el lector haga lugar, así que todo tarda más en pasar, y si sigue llegando más rápido de lo que el lector puede ir, se forma una pila delante del anillo (en la memoria del productor, en un búfer de socket, en quien llama y termina por tiempo límite). Eso sirve para una fuente que puede ir más lento, como un archivo o una exportación de base de datos, no para un sensor o tráfico en vivo. Frenar también permite que un lector lento congele un sistema rápido, así que ponle un tiempo límite (timeout) a la espera.",
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
      t("Only the checking reader notices them", "Solo los nota el lector que revisa"),
      t("Neither: with overwrite nothing is lost, only delayed", "Ninguno: al sobrescribir no se pierde nada, solo se retrasa"),
    ],
    answer: 1,
    why: t(
      "Both lose about as many; only the checking reader knows it. An item lives in slot sequence mod 16, so when the writer laps the reader, the reader's next slot already holds a newer item. Reading by position alone, the reader takes it as the one it expected: data goes missing silently and the stream jumps. Storing the sequence number with each item, or comparing the writer's counter with the reader's, turns that into a detected gap: the reader counts what it missed and jumps to the oldest item still there. Linux's perf and trace buffers report lost events this way.",
      "Los dos pierden más o menos lo mismo; solo el que revisa lo sabe. Un elemento vive en el hueco número de secuencia mod 16, así que cuando el escritor le saca una vuelta al lector, el siguiente hueco del lector ya tiene un elemento más nuevo. Si lee solo por posición, el lector lo toma como el que esperaba: los datos se pierden en silencio y el flujo salta. Guardar el número de secuencia con cada elemento, o comparar el contador del escritor con el del lector, lo convierte en un salto detectado: el lector cuenta lo que se perdió y salta al elemento más viejo que sigue ahí. Los búferes de perf y de trace de Linux reportan los eventos perdidos así.",
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
      t("128: the rest is read as it arrives", "128: el resto se lee mientras llega"),
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
    id: "race",
    title: t("Two producers, no atomic claim", "Dos productores, sin reserva atómica"),
    change: t("Two producers, 3 items a second each, share the ring of 16; the reader reads in batches and keeps up · each producer reads the write counter, stores its item 0.1 s later, then sets the counter to what it read plus one · that plain read-then-store vs fetch-and-add · 60 s",
      "Dos productores, 3 elementos por segundo cada uno, comparten el anillo de 16; el lector lee por lotes y alcanza · cada productor lee el contador de escritura, guarda su elemento 0.1 s después y deja el contador en lo que leyó más uno · ese leer y después guardar vs fetch-and-add · 60 s"),
    question: t("With the plain read-then-store, how many of the items reach the reader?", "Con el leer y después guardar, ¿cuántos de los elementos llegan al lector?"),
    options: [
      t("All of them: the ring has room and the reader keeps up", "Todos: el anillo tiene lugar y el lector alcanza"),
      t("Only part: some land on the same slot and vanish", "Solo una parte: algunos caen en el mismo hueco y desaparecen"),
      t("All of them, though a few are read twice", "Todos, aunque algunos se leen dos veces"),
    ],
    answer: 1,
    why: t(
      "Both producers can read the same value of the write counter before either stores it back, so both write the same slot and the counter goes up by one instead of two. If the reader hasn't taken the first item yet, the second writes over it; if it has, the second lands behind the reader and is never read. A producer that stores late also moves the counter backwards, so items keep landing where the reader won't look. Nothing reports any of it: no error, just missing data. It's the lost update from lesson 17, Race conditions. The fix is to claim the slot atomically: fetch-and-add on the write counter hands each producer its own slot, and the reader waits until each slot is published, as the LMAX Disruptor does. The window here is 0.1 s so you can watch it; on a CPU it's nanoseconds, but at millions of writes a second the two producers collide all the time.",
      "Los dos productores pueden leer el mismo valor del contador de escritura antes de que alguno lo guarde de vuelta, así que los dos escriben el mismo hueco y el contador sube uno en lugar de dos. Si el lector todavía no tomó el primer elemento, el segundo lo sobrescribe; si ya lo tomó, el segundo queda detrás del lector y nunca se lee. Un productor que guarda tarde además hace retroceder el contador, así que siguen cayendo elementos donde el lector no va a mirar. Nada de esto se reporta: no hay error, solo faltan datos. Es la actualización perdida de la lección 17, Condiciones de carrera. La solución es reservar el hueco de forma atómica: un fetch-and-add sobre el contador de escritura le da a cada productor su propio hueco, y el lector espera a que cada hueco esté publicado, como hace el LMAX Disruptor. Aquí la ventana es de 0.1 s para que puedas verla; en una CPU son nanosegundos, pero con millones de escrituras por segundo los dos productores chocan todo el tiempo.",
    ),
    watch: { rate: 6, policy: "overwrite", reader: "batch", check: "no", producers: "racy" },
  },
  {
    id: "batch",
    title: t("Read in batches", "Leer por lotes"),
    change: t("60 items a second, ring of 64, drop newest · each read costs 20 ms fixed plus 5 ms per item · one item per read vs every item available", "60 elementos por segundo, anillo de 64, descartar el más nuevo · cada lectura cuesta 20 ms fijos más 5 ms por elemento · un elemento por lectura vs todos los disponibles"),
    question: t("Which reader keeps up?", "¿Qué lector alcanza?"),
    options: [
      t("Neither: 60 a second is more than either can do", "Ninguno: 60 por segundo es más de lo que cualquiera puede"),
      t("Both: the work per item is only 5 ms", "Los dos: el trabajo por elemento es de solo 5 ms"),
      t("Only the batch reader: it pays the 20 ms less often", "Solo el lector por lotes: paga los 20 ms menos veces"),
    ],
    answer: 2,
    why: t(
      "The fixed cost (waking up, a lock or a system call, a cache miss on the shared counter) is paid once per read, so one item at a time caps the reader at 1 ÷ 25 ms = 40 a second, and it drops about a third of the 60. Taking everything available spreads that cost over the batch, and it adapts by itself: batches grow when the reader falls behind and shrink back to one when it has caught up, so waits stay short at light load. This is the batching effect of the LMAX Disruptor, and why audio callbacks, io_uring and network drivers handle every ready slot per wake-up.",
      "El costo fijo (despertarse, un bloqueo (lock) o una llamada al sistema, un fallo de caché sobre el contador compartido) se paga una vez por lectura, así que leyendo un elemento a la vez el lector queda limitado a 1 ÷ 25 ms = 40 por segundo, y descarta cerca de un tercio de los 60. Tomar todo lo disponible reparte ese costo en el lote, y se ajusta solo: los lotes crecen cuando el lector se atrasa y vuelven a uno cuando se pone al día, así que las esperas siguen cortas con poca carga. Es el efecto de los lotes del LMAX Disruptor, y por eso los callbacks de audio, io_uring y los drivers de red procesan todos los huecos listos en cada despertar.",
    ),
    watch: { rate: 6, policy: "drop", reader: "batch", check: "yes" },
  },
];

const QUESTIONS = [
  [t("How does a ring buffer make writes and reads O(1) with no allocation, and why are sizes often a power of two?", "¿Cómo logra un búfer circular que escribir y leer sean O(1) sin reservar memoria, y por qué el tamaño suele ser una potencia de dos?"),
    t("It is one fixed array allocated up front plus two counters, the writer's and the reader's. Item n goes in slot n mod size; a write advances one counter, a read the other, and nothing ever moves. The memory is contiguous and reused, so it is cache-friendly and creates no garbage. With a power-of-two size, n mod size is n & (size − 1), a single instruction.",
      "Es un solo arreglo fijo, reservado al inicio, más dos contadores: el del escritor y el del lector. El elemento n va en el hueco n mod tamaño; escribir avanza un contador y leer el otro, y nada se mueve nunca. La memoria es contigua y se reutiliza, así que aprovecha bien la caché y no le deja trabajo al recolector de basura (garbage collector). Con un tamaño potencia de dos, n mod tamaño es n & (tamaño − 1), una sola instrucción.")],
  [t("If you store only positions (0 to size − 1), the read and write positions are equal both when the ring is empty and when it is full. How do you tell the two apart?", "Si guardas solo posiciones (de 0 a tamaño − 1), las posiciones de lectura y escritura son iguales tanto con el anillo vacío como lleno. ¿Cómo distingues los dos casos?"),
    t("Keep counters that only grow (sequence numbers) and take the position as counter mod size: then written − read is the fill, 0 is empty and size is full. Other fixes: always leave one slot empty (full is write + 1 = read), or keep a separate count. Counters that only grow also give you sequence numbers for free, which is what lets a reader detect a lap.",
      "Usa contadores que solo crecen (números de secuencia) y calcula la posición como contador mod tamaño: así escritos − leídos es lo ocupado, 0 es vacío y el tamaño es lleno. Otras soluciones: dejar siempre un hueco libre (lleno es escritura + 1 = lectura) o llevar una cuenta aparte. Los contadores que solo crecen además te dan números de secuencia gratis, que es lo que permite a un lector detectar que le sacaron una vuelta.")],
  [t("Overwrite, drop or block: which would you pick for the last N events kept for a crash dump, for audio playback, and for a stream of payment events? Why?", "Sobrescribir, descartar o frenar: ¿cuál elegirías para los últimos N eventos que se guardan para un volcado de fallas, para reproducir audio y para un flujo de eventos de pagos? ¿Por qué?"),
    t("Crash dump: overwrite, because only the most recent history matters and the writer must never wait. Audio playback: the decoder that fills the ring may block when it's full, but the audio callback that reads it must never wait, so an empty ring plays silence (an underrun). For recording it's the other way round: the callback is the producer, so on overflow it must drop or overwrite, never block. Payments: every event matters, so block (backpressure) or a durable queue; never silent loss, and if anything is ever dropped it must be counted and alerted on.",
      "Volcado de fallas: sobrescribir, porque solo importa la historia más reciente y el escritor nunca debe esperar. Reproducir audio: el decodificador que llena el anillo puede frenar cuando está lleno, pero el callback de audio que lo lee nunca debe esperar, así que un anillo vacío suena como silencio (un underrun). Al grabar es al revés: el callback es el productor, así que si el anillo se llena debe descartar o sobrescribir, nunca frenar. Pagos: cada evento importa, así que frenar (backpressure) o una cola durable; nunca pérdida silenciosa, y si algo llega a descartarse, se cuenta y se alerta.")],
  [t("Why can a ring buffer with one producer and one consumer work without locks, and what changes with several producers?", "¿Por qué un búfer circular con un productor y un consumidor puede funcionar sin bloqueos (locks), y qué cambia con varios productores?"),
    t("Each counter has a single writer: only the producer advances the write counter, only the consumer the read counter, and each just reads the other's. With release/acquire memory ordering (publish the item, then the counter) no lock is needed. With several producers two of them could claim the same slot (a race condition, lesson 17), so they claim slots with an atomic operation (compare-and-swap or fetch-and-add on the write counter), as the LMAX Disruptor does, and the reader waits for each slot to be published.",
      "Cada contador tiene un único escritor: solo el productor avanza el contador de escritura, solo el consumidor el de lectura, y cada uno solo lee el del otro. Con orden de memoria release/acquire (publicar el elemento y después el contador) no hace falta ningún bloqueo. Con varios productores, dos podrían tomar el mismo hueco (una condición de carrera, lección 17), así que reservan huecos con una operación atómica (compare-and-swap o fetch-and-add sobre el contador de escritura), como hace el LMAX Disruptor, y el lector espera a que cada hueco esté publicado.")],
  [t("How can a reader detect that the writer lapped it, and what should it do then?", "¿Cómo puede un lector detectar que el escritor le sacó una vuelta, y qué debería hacer entonces?"),
    t("Compare counters: if written − read > size, at least that many items were overwritten. Or store each item's sequence number and check it on read: a newer number than expected means a lap. Then count the gap (expose it as a metric or a marker in the stream, as perf's lost-event records do), jump to the oldest item still in the ring and carry on. If losing data is not acceptable, the real fix is a faster reader, a bigger ring, batching, or a different policy.",
      "Comparar contadores: si escritos − leídos > tamaño, al menos esa cantidad de elementos se sobrescribió. O guardar el número de secuencia de cada elemento y revisarlo al leer: un número más nuevo que el esperado indica una vuelta. Después, contar el salto (exponerlo como métrica o como marca en el flujo, como los registros de eventos perdidos de perf), saltar al elemento más viejo que sigue en el anillo y seguir. Si perder datos no es aceptable, la solución de verdad es un lector más rápido, un anillo más grande, lotes, u otra política.")],
  [t("When is a ring buffer the wrong tool compared with a growable queue or a durable log?", "¿Cuándo un búfer circular es la herramienta equivocada frente a una cola que crece o un log durable?"),
    t("When you can't bound the burst and can neither lose nor block; when items survive a crash or a restart (a ring lives in memory; a durable log like Kafka keeps them on disk, with its own retention limit; lesson 20, Logs and offsets); when items vary a lot in size (a byte ring with length prefixes, or pointers to elsewhere, gets fiddly); when you need priorities or random removal. A ring wins when the size limit is acceptable and you want predictable, allocation-free speed.",
      "Cuando no puedes acotar la ráfaga y no puedes ni perder ni frenar; cuando los elementos deben sobrevivir a una caída o a un reinicio (un anillo vive en memoria; un log durable como Kafka los guarda en disco, con su propio límite de retención; lección 20, Logs y offsets); cuando los elementos varían mucho de tamaño (un anillo de bytes con prefijos de largo, o punteros a otro lugar, se complica); cuando necesitas prioridades o quitar elementos del medio. Un anillo gana cuando el límite de tamaño es aceptable y quieres velocidad predecible y sin reservar memoria.")],
];

export default defineLesson({
  title: t("Ring Buffer Workbench", "Banco de trabajo: búferes circulares"),
  eyebrow: t("Systems lesson 42 · Ring buffers", "Lección de sistemas 42 · Búfer circular (ring buffer)"),
  lede: t("A ring buffer is a fixed array used as a queue, a bounded version of the queue in lesson 33: a writer and a reader chase each other round it, and item n lives in slot n mod size. Nothing moves and nothing is allocated, so it is fast and predictable, which is why kernel logs, audio, network cards, telemetry pipelines and the LMAX Disruptor are built on one. The price is a hard size limit, and a decision about what happens when the writer catches up with the reader. This lesson runs one as a round table with 16 pockets: watch it, predict what fills it, then explain it back.",
    "Un búfer circular (ring buffer) es un arreglo (array) fijo que se usa como cola, una versión acotada de la cola de la lección 33: un escritor y un lector se persiguen dando vueltas, y el elemento n vive en el hueco n mod tamaño. Nada se mueve y no se reserva memoria, así que es rápido y predecible; por eso los logs del kernel, el audio, las tarjetas de red, los pipelines de telemetría y el LMAX Disruptor se construyen sobre uno. El precio es un límite de tamaño estricto, y decidir qué pasa cuando el escritor alcanza al lector. Esta lección lo muestra como una mesa redonda con 16 huecos: obsérvala, predice qué la llena y después explícalo."),
  machine: {
    intro: t("Items come from the producer at the back left; each gets the next sequence number and drops into the pocket under the write hand. The reader at the back right takes the pocket under the read hand. When the ring is full, the policy on the console decides: overwrite the oldest unread item, drop the new one, or make the producer wait. Try a faster producer, batch reads, each policy, turning the sequence checks off, and two producers sharing the ring.",
      "Los elementos salen del productor, atrás a la izquierda; cada uno recibe el siguiente número de secuencia y cae en el hueco bajo la manecilla de escritura. El lector, atrás a la derecha, toma el hueco bajo la manecilla de lectura. Cuando el anillo está lleno, la política de la consola decide: sobrescribir el elemento sin leer más viejo, descartar el nuevo o hacer esperar al productor. Prueba un productor más rápido, leer por lotes, cada política, apagar la revisión de los números de secuencia y dos productores que comparten el anillo."),
    plate: {
      title: t("Ring table", "Mesa del anillo"),
      keys: [
        { mark: "lit", label: t("Items the reader is reading, or a producer holds before storing; the FULL lamp; the producer's flag while it is blocked", "Los elementos que el lector está leyendo, o que un productor sostiene antes de guardarlos; la lámpara LLENO; el banderín del productor mientras está frenado") },
        { mark: "raised", label: t("Items, each with its sequence number on top; the hands: write (long, solid) and read (ring at the tip)", "Los elementos, cada uno con su número de secuencia arriba; las manecillas: escritura (larga, sólida) y lectura (anillo en la punta)") },
        { mark: "flat", label: t("The 16 numbered pockets: item n goes in pocket n mod 16", "Los 16 huecos numerados: el elemento n va en el hueco n mod 16") },
      ],
      caption: t(
        "The producer at the back left gives each item the next sequence number and drops it into the pocket under the write hand, which then moves on one pocket. The reader at the back right takes the item under the read hand (several at once when it reads in batches), holds it while it works, then drops it in the tray. When the write hand reaches unread items the ring is full and the policy on the console decides: overwrite the oldest unread item (it falls into the bin), drop the new one (straight into the bin), or block the producer (items pile up on its table and its flag goes up). LAG is how many items the write counter is ahead of the read counter; above 16 the writer has lapped the reader. With two producers, each holds its item, lit, printed with the slot number it read, until it stores it; when both read the same number, one item is written over and falls into the bin.",
        "El productor, atrás a la izquierda, le da a cada elemento el siguiente número de secuencia y lo deja en el hueco bajo la manecilla de escritura, que después avanza un hueco. El lector, atrás a la derecha, toma el elemento bajo la manecilla de lectura (varios a la vez cuando lee por lotes), lo sostiene mientras trabaja y después lo deja en la bandeja. Cuando la manecilla de escritura llega a elementos sin leer, el anillo está lleno y la política de la consola decide: sobrescribir el elemento sin leer más viejo (cae a la caja de descarte), descartar el nuevo (va directo al descarte) o frenar al productor (los elementos se apilan en su mesa y se levanta su banderín). RETRASO es cuántos elementos adelanta el contador de escritura al de lectura; por encima de 16, el escritor le sacó una vuelta al lector. Con dos productores, cada uno sostiene su elemento, iluminado, con el número de hueco que leyó, hasta guardarlo; cuando los dos leen el mismo número, un elemento queda sobrescrito y cae a la caja de descarte.",
      ),
      readout: t("starting", "iniciando"),
      stage: { "data-ring": "" },
      label: t("Ring buffer simulation. Space pauses or resumes.", "Simulación de un búfer circular. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["fill", t("In use", "Ocupados"), "0/16"], ["lag", t("Lag", "Retraso")], ["lost", t("Lost", "Perdidos")], ["gaps", t("Gaps seen", "Saltos vistos")], ["stall", t("Producer stalled", "Productor frenado"), "0.0 s"], ["batch", t("Items per read", "Elementos por lectura"), "–"]],
    controls: [
      { seg: "rate", label: t("Producer", "Productor"), options: [[2, "2/s"], [4, "4/s"], [6, "6/s"]], value: 6 },
      { seg: "reader", label: t("Reader", "Lector"), options: [["one", t("One at a time (4/s)", "Uno a la vez (4/s)")], ["batch", t("Batches", "Por lotes")]], value: "one" },
      { seg: "policy", label: t("When full", "Cuando está lleno"), options: [["overwrite", t("Overwrite oldest", "Sobrescribir el más viejo")], ["drop", t("Drop newest", "Descartar el más nuevo")], ["block", t("Block producer", "Frenar al productor")]], value: "overwrite" },
      { seg: "producers", label: t("Producers", "Productores"), options: [["one", t("One", "Uno")], ["racy", t("Two, plain counter", "Dos, contador simple")], ["atomic", t("Two, fetch-and-add", "Dos, fetch-and-add")]], value: "one" },
      { seg: "check", label: t("Reader checks sequence numbers", "El lector revisa los números de secuencia"), options: [["yes", t("Yes", "Sí")], ["no", t("No", "No")]], value: "yes" },
      { speed: true, value: 0.5 },
      { actions: [["burst", t("40 at once", "40 de golpe")], ["stop", t("Stop the reader 5 s", "Detener al lector 5 s")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine; runs with random arrivals are averaged over eight seeds.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina; las ejecuciones con llegadas aleatorias se promedian sobre ocho semillas."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
.iso-stage [data-layer] text{pointer-events:none}
`,
  data: {
    P,
    G: GEOMETRY,
    TOKEN_SVG: tokenSvg(),
  },
});
