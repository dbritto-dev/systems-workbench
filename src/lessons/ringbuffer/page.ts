// @ts-nocheck: content ported as-is
// Systems lesson 42 · Ring buffers: a round table with 16 pockets as a ring buffer.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, tokenSvg, P, GEOMETRY } from "./figure";
import { burstRun, lapRun, sizeRun, blockRun, batchRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const RESULTS = { burst: burstRun(), lap: lapRun(), size: sizeRun(), block: blockRun(), batch: batchRun() };

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

export default defineLesson({
  title: t("Ring Buffer Workbench", "Banco de trabajo: búfer circular"),
  eyebrow: t("Systems lesson 42 · Ring buffers", "Lección de sistemas 42 · Búfer circular (ring buffer)"),
  lede: t("A ring buffer is a fixed array used as a queue: a writer and a reader chase each other round it, and item n lives in slot n mod size. Nothing moves and nothing is allocated, so it is fast and predictable, which is why kernel logs, audio, network cards, telemetry pipelines and the LMAX Disruptor are built on one. The price is a hard size limit, and a decision about what happens when the writer catches up with the reader. This lesson runs one as a round table with 16 pockets: watch it, predict what fills it, then explain it back.",
    "Un búfer circular (ring buffer) es un arreglo fijo que se usa como cola: un escritor y un lector se persiguen dando vueltas, y el elemento n vive en el hueco n mod tamaño. Nada se mueve y no se reserva memoria, así que es rápido y predecible; por eso los logs del kernel, el audio, las tarjetas de red, las canalizaciones de telemetría y el LMAX Disruptor se construyen sobre uno. El precio es un límite de tamaño estricto, y decidir qué pasa cuando el escritor alcanza al lector. Esta lección lo muestra como una mesa redonda con 16 huecos: obsérvala, predice qué la llena y después explícalo."),
  machine: {
    intro: t("Items come from the producer at the back left; each gets the next sequence number and drops into the pocket under the write hand. The reader at the back right takes the pocket under the read hand. When the ring is full, the policy on the console decides: overwrite the oldest unread item, drop the new one, or make the producer wait. Try a faster producer, batch reads, each policy, and turning the sequence checks off.",
      "Los elementos salen del productor, atrás a la izquierda; cada uno recibe el siguiente número de secuencia y cae en el hueco bajo la manecilla de escritura. El lector, atrás a la derecha, toma el hueco bajo la manecilla de lectura. Cuando el anillo está lleno, la política de la consola decide: sobrescribir el elemento sin leer más viejo, descartar el nuevo o hacer esperar al productor. Prueba un productor más rápido, leer por lotes, cada política y apagar la revisión de los números de secuencia."),
    plate: {
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
      stage: { "data-ring": "" },
      label: t("Ring buffer simulation. Space pauses or resumes.", "Simulación de un búfer circular. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["fill", t("In use", "Ocupados"), "0/16"], ["lag", t("Lag", "Retraso")], ["lost", t("Lost", "Perdidos")], ["gaps", t("Gaps seen", "Saltos vistos")], ["stall", t("Producer stalled", "Productor frenado"), "0.0 s"], ["batch", t("Items per read", "Elementos por lectura"), "–"]],
    controls: [
      { seg: "rate", label: t("Producer", "Productor"), options: [[2, "2/s"], [4, "4/s"], [6, "6/s"]], value: 6 },
      { seg: "reader", label: t("Reader", "Lector"), options: [["one", t("One at a time (4/s)", "De a uno (4/s)")], ["batch", t("Batches", "Por lotes")]], value: "one" },
      { seg: "policy", label: t("When full", "Cuando está lleno"), options: [["overwrite", t("Overwrite oldest", "Sobrescribir el más viejo")], ["drop", t("Drop newest", "Descartar el más nuevo")], ["block", t("Block producer", "Frenar al productor")]], value: "overwrite" },
      { seg: "check", label: t("Reader checks sequence numbers", "El lector revisa los números de secuencia"), options: [["yes", t("Yes", "Sí")], ["no", t("No", "No")]], value: "yes" },
      { speed: true, value: 0.5 },
      { actions: [["burst", t("40 at once", "40 de golpe")], ["stop", t("Stop the reader 5 s", "Detener al lector 5 s")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine; runs with random arrivals are averaged over eight seeds.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina; las ejecuciones con llegadas aleatorias se promedian sobre ocho semillas."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css: `
.iso-stage [data-layer] text{pointer-events:none}
`,
  data: {
    P,
    G: GEOMETRY,
    TOKEN_SVG: tokenSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
