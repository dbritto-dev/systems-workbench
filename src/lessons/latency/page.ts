// @ts-nocheck: content ported as-is
// Systems lesson 43 · Latency numbers: a courier depot for where data lives.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, courierSvg, P, GEOMETRY } from "./figure";
import { chattyRun, readRun, sumRun, batchRun, sendRun, fmt } from "./sim";
import { int } from "../../lib/format";

// Experiment results, computed at build time from the same model the page runs.
const RESULTS = { chatty: chattyRun(), read: readRun(), sum: sumRun(), batch: batchRun(), send: sendRun() };
const SOURCE = "https://gist.github.com/jboner/2841832";

// What each card shows after a run.
const x = (a, b) => int(a / b) + "×";
const RUNS = {
  chatty: () => {
    const { ram, dc } = RESULTS.chatty;
    return { verdict: t("In memory: " + fmt(ram.total) + " for all 100. Over the network: " + fmt(dc.total) + ", about " + x(dc.total, ram.total) + " longer. The lookups are the same; the trips are not.",
        "En memoria: " + fmt(ram.total) + " para las 100. Por la red: " + fmt(dc.total) + ", unas " + x(dc.total, ram.total) + " más. Las consultas son las mismas; los viajes no."),
      bars: [[t("In memory", "En memoria"), ram.total / dc.total, fmt(ram.total)], [t("Cache service, same DC", "Servicio de caché, mismo DC"), 1, fmt(dc.total), true]] };
  },
  read: () => {
    const r = RESULTS.read, top = r["ssd-rand"].total;
    return { verdict: t("SSD at random: " + fmt(r["ssd-rand"].total) + ". Disk in order: " + fmt(r["disk-seq"].total) + ". SSD in order: " + fmt(r["ssd-seq"].total) + ". Disk at random: " + fmt(r["disk-rand"].total) + ", off the chart.",
        "SSD al azar: " + fmt(r["ssd-rand"].total) + ". Disco en orden: " + fmt(r["disk-seq"].total) + ". SSD en orden: " + fmt(r["ssd-seq"].total) + ". Disco al azar: " + fmt(r["disk-rand"].total) + ", fuera de la escala."),
      bars: [[t("SSD, random 4 KB", "SSD, 4 KB al azar"), r["ssd-rand"].total / top, fmt(r["ssd-rand"].total)], [t("Disk, in order", "Disco, en orden"), r["disk-seq"].total / top, fmt(r["disk-seq"].total), true], [t("SSD, in order", "SSD, en orden"), r["ssd-seq"].total / top, fmt(r["ssd-seq"].total)], [t("Disk, random 4 KB (off the chart)", "Disco, 4 KB al azar (fuera de escala)"), 1, fmt(r["disk-rand"].total)]] };
  },
  sum: () => {
    const { array, list } = RESULTS.sum;
    return { verdict: t("Array: " + fmt(array.total) + ". Linked list: " + fmt(list.total) + ", about " + x(list.total, array.total) + " slower for the same million additions.",
        "Arreglo: " + fmt(array.total) + ". Lista enlazada: " + fmt(list.total) + ", unas " + x(list.total, array.total) + " más lenta para el mismo millón de sumas."),
      bars: [[t("Array", "Arreglo"), array.total / list.total, fmt(array.total)], [t("Linked list", "Lista enlazada"), 1, fmt(list.total), true]] };
  },
  batch: () => {
    const { one, ten, batch } = RESULTS.batch;
    return { verdict: t("One at a time: " + fmt(one.total) + ". Ten at a time: " + fmt(ten.total) + ". One batch: " + fmt(batch.total) + ", about " + x(one.total, batch.total) + " faster than one at a time.",
        "Una a la vez: " + fmt(one.total) + ". Diez a la vez: " + fmt(ten.total) + ". Un lote: " + fmt(batch.total) + ", unas " + x(one.total, batch.total) + " más rápido que una a la vez."),
      bars: [[t("One at a time", "Una a la vez"), 1, fmt(one.total), true], [t("10 at a time", "10 a la vez"), ten.total / one.total, fmt(ten.total)], [t("One batch", "Un solo lote"), batch.total / one.total, fmt(batch.total)]] };
  },
  send: () => {
    const { kb, mb, gb } = RESULTS.send, share = (r) => Math.round((100 * r.send) / r.total) + "%";
    return { verdict: t("1 KB: " + fmt(kb.total) + ", almost all of it the round trip. 10 MB: " + fmt(mb.total) + ", " + share(mb) + " of it sending. 1 GB: " + fmt(gb.total) + ", " + share(gb) + " of it sending; the round trip is " + fmt(gb.trip) + " of that.",
        "1 KB: " + fmt(kb.total) + ", casi todo el viaje de ida y vuelta. 10 MB: " + fmt(mb.total) + ", el " + share(mb) + " enviando. 1 GB: " + fmt(gb.total) + ", el " + share(gb) + " enviando; el viaje de ida y vuelta es " + fmt(gb.trip) + " de eso."),
      bars: [[t("Sending, share of 1 KB", "Enviando, parte de 1 KB"), kb.send / kb.total, share(kb)], [t("Sending, share of 10 MB", "Enviando, parte de 10 MB"), mb.send / mb.total, share(mb)], [t("Sending, share of 1 GB", "Enviando, parte de 1 GB"), gb.send / gb.total, share(gb), true]] };
  },
};

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
      t("Thousands of times as long", "Miles de veces más"),
    ],
    answer: 2,
    why: t(
      "Microseconds against tens of milliseconds. A memory reference is about 100 ns; a round trip to another machine in the same building is about 500 µs in the classic table (often 100 µs or so in today's datacenters), thousands of times longer, before the other side does any work. Each lookup is cheap; the trip is not. A loop that calls a service once per item (a chatty API, an N+1 query, lesson 27) multiplies that trip by the number of items. Fetch in bulk, cache close to the code, or move the loop to where the data is.",
      "Microsegundos contra decenas de milisegundos. Una referencia a memoria tarda unos 100 ns; un viaje de ida y vuelta a otra máquina en el mismo edificio tarda unos 500 µs en la tabla clásica (a menudo unos 100 µs en los centros de datos de hoy), miles de veces más, antes de que el otro lado haga ningún trabajo. Cada consulta es barata; el viaje no. Un bucle que llama a un servicio una vez por elemento (una API conversadora, una consulta N+1, lección 27) multiplica ese viaje por la cantidad de elementos. Pide en bloque, guarda en caché cerca del código, o lleva el bucle a donde están los datos.",
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
      t("The old disk, reading straight through", "El disco viejo, leyendo de corrido"),
      t("A tie: 100 MB is 100 MB", "Empate: 100 MB son 100 MB"),
    ],
    answer: 1,
    why: t(
      "The disk, by a couple of seconds. A random read pays the whole trip for every 4 KB: 25,600 trips of about 150 µs. A sequential read pays for the trip once and then streams, so even a spinning disk gets about 50 MB a second. Make that same disk read at random and every 4 KB pays a 10 ms seek: over four minutes. Modern NVMe drives are faster than this table and serve many reads at once, which narrows the SSD gap a lot, but the rule holds on every device: how you read matters as much as what you read from.",
      "El disco, por un par de segundos. Una lectura al azar paga el viaje completo por cada 4 KB: 25,600 viajes de unos 150 µs. Una lectura secuencial paga el viaje una vez y después fluye, así que hasta un disco giratorio saca unos 50 MB por segundo. Haz que ese mismo disco lea al azar y cada 4 KB paga una búsqueda del cabezal (seek) de 10 ms: más de cuatro minutos. Los discos NVMe modernos son más rápidos que esta tabla y atienden muchas lecturas a la vez, lo que achica mucho la brecha del SSD, pero la regla vale en todo dispositivo: cómo lees importa tanto como desde dónde lees.",
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
      t("Close to 100 times: each node waits on memory", "Cerca de 100 veces: cada nodo espera a la memoria"),
    ],
    answer: 2,
    why: t(
      "Memory arrives in cache lines of 64 bytes, 16 numbers at a time, and when the CPU sees you walking forward it fetches the next lines before you ask (prefetching), so the array streams at memory bandwidth. A list node can be anywhere, and you only learn the next address by reading this node, so every node waits a full memory trip of about 100 ns and nothing overlaps. Big-O (lesson 45) counts operations; it doesn't see where the data is.",
      "La memoria llega en líneas de caché de 64 bytes, 16 números a la vez, y cuando la CPU ve que avanzas en orden trae las líneas siguientes antes de que las pidas (prefetching), así que el arreglo fluye al ancho de banda de la memoria. Un nodo de la lista puede estar en cualquier parte, y la siguiente dirección solo se conoce al leer este nodo, así que cada nodo espera un viaje completo a memoria de unos 100 ns y nada se superpone. La notación O grande (Big-O, lección 45) cuenta operaciones; no ve dónde están los datos.",
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
      "Sending 1 KB over a 1 Gbps link takes about 10 µs; the round trip takes 150 ms whatever you send. So 100 calls in a row cost 100 round trips. Ten at a time costs ten rounds, each as slow as its slowest call. One batch costs one round trip plus about a millisecond to send the extra data, on a connection that's already open (a fresh one first spends a few round trips on handshakes and on growing its sending window). For small messages across long distances, count round trips, not bytes.",
      "Mandar 1 KB por un enlace de 1 Gbps tarda unos 10 µs; el viaje de ida y vuelta tarda 150 ms mandes lo que mandes. Así que 100 llamadas seguidas cuestan 100 viajes. Diez a la vez cuesta diez rondas, cada una tan lenta como su llamada más lenta. Un lote cuesta un viaje más cerca de un milisegundo para mandar los datos extra, en una conexión que ya está abierta (una nueva primero gasta unos viajes en handshakes y en agrandar su ventana de envío). Con mensajes pequeños a larga distancia, cuenta viajes, no bytes.",
    ),
    watch: { job: "batch", how: "one", speed: "4" },
  },
  {
    id: "send",
    title: t("One big transfer to another continent", "Una transferencia grande a otro continente"),
    change: t("One transfer across the ocean (about 150 ms per round trip) over a 1 Gbps link, on a connection that's already open and at full speed · 1 KB, then 10 MB, then 1 GB",
      "Una transferencia al otro lado del océano (unos 150 ms por viaje de ida y vuelta) por un enlace de 1 Gbps, en una conexión que ya está abierta y a toda velocidad · 1 KB, después 10 MB, después 1 GB"),
    question: t("As the transfer grows, when does its size start to matter more than the round trip?", "A medida que crece la transferencia, ¿cuándo empieza a importar más su tamaño que el viaje de ida y vuelta?"),
    options: [
      t("Never: overseas, the round trip always dominates", "Nunca: a esa distancia, el viaje siempre domina"),
      t("Past a few MB; at 1 GB it's nearly all bytes", "Pasados unos MB; con 1 GB casi todo son bytes"),
      t("Even at 1 KB: every byte has to cross the ocean", "Ya con 1 KB: cada byte tiene que cruzar el océano"),
    ],
    answer: 1,
    why: t(
      "At 1 Gbps a megabyte takes about 10 ms to send, so 1 GB takes about 10 s, while the round trip stays 150 ms whatever you send. The two cost the same at the bandwidth-delay product, 150 ms × 1 Gbps ≈ 19 MB: below it count round trips, above it count bytes. For big transfers a faster link, compression or sending less helps; a closer server barely does. TCP needs a window at least that big to keep the link full, and a fresh connection takes about ten round trips of slow start to grow one, a second or more at this distance.",
      "A 1 Gbps un megabyte tarda unos 10 ms en enviarse, así que 1 GB tarda unos 10 s, mientras que el viaje de ida y vuelta sigue en 150 ms mandes lo que mandes. Los dos cuestan lo mismo en el producto ancho de banda × retardo, 150 ms × 1 Gbps ≈ 19 MB: por debajo, cuenta viajes; por encima, cuenta bytes. Para transferencias grandes ayudan un enlace más rápido, comprimir o mandar menos; un servidor más cercano casi no. TCP necesita una ventana al menos así de grande para mantener lleno el enlace, y una conexión nueva tarda unos diez viajes de arranque lento (slow start) en agrandarla, un segundo o más a esta distancia.",
    ),
    watch: { job: "send", how: "gb", speed: "1" },
  },
];

const QUESTIONS = [
  [t("Why are these numbers worth remembering as ratios rather than exact values?", "¿Por qué conviene recordar estos números como proporciones y no como valores exactos?"),
    t("The exact values change with every generation of hardware and with every cloud, but the gaps between levels stay huge: cache to memory is about 10 to 100 times, memory to SSD about 1,000, SSD to a nearby machine a few times, nearby to another continent about 300. Those ratios tell you where time goes before you measure, which design is hopeless, and which optimisation can't matter.",
      "Los valores exactos cambian con cada generación de hardware y con cada nube, pero las brechas entre niveles siguen siendo enormes: de caché a memoria unas 10 a 100 veces, de memoria a SSD unas 1,000, de SSD a una máquina cercana unas pocas veces, de cercana a otro continente unas 300. Esas proporciones te dicen a dónde se va el tiempo antes de medir, qué diseño no tiene salvación y qué optimización no puede importar.")],
  [t("A request handler makes 30 calls, one after another, to services in the same datacenter. Roughly what does that cost, and how would you cut it?", "Un handler hace 30 llamadas, una tras otra, a servicios del mismo centro de datos. ¿Cuánto cuesta más o menos y cómo lo reducirías?"),
    t("At about 0.5 ms a round trip, at least 15 ms before any service does work, and in practice more, since each hop adds its own queueing and tail latency. Cut the number of sequential trips: batch related calls, run independent ones in parallel, cache what rarely changes, or have one service do the whole loop next to the data.",
      "A unos 0.5 ms por viaje, al menos 15 ms antes de que ningún servicio trabaje, y en la práctica más, porque cada salto suma su propia espera en cola y su latencia de cola (tail latency). Reduce los viajes secuenciales: agrupa llamadas relacionadas, corre en paralelo las independientes, guarda en caché lo que casi no cambia, o haz que un solo servicio corra todo el bucle junto a los datos.")],
  [t("Iterating an array and a linked list are both O(n). Why is the array so much faster?", "Recorrer un arreglo y una lista enlazada son ambos O(n). ¿Por qué el arreglo es mucho más rápido?"),
    t("Memory moves in 64-byte cache lines, so one fetch brings many neighbouring elements, and the hardware prefetcher fetches the next lines while you work on these. A linked list's nodes are scattered and each next address is only known after the previous load, so the loads can't overlap: each costs a full memory trip. Locality and independent loads are what make code fast on real hardware.",
      "La memoria se mueve en líneas de caché de 64 bytes, así que una lectura trae muchos elementos vecinos, y el prefetcher del hardware trae las líneas siguientes mientras trabajas con estas. Los nodos de una lista enlazada están dispersos y cada dirección siguiente solo se conoce después de la lectura anterior, así que las lecturas no se pueden superponer: cada una cuesta un viaje completo a memoria. La localidad y las lecturas independientes son lo que hace rápido el código en hardware real.")],
  [t("When can a sequential read from a spinning disk beat random reads from an SSD, and when does that stop being true?", "¿Cuándo una lectura secuencial desde un disco giratorio le gana a lecturas al azar desde un SSD, y cuándo deja de ser cierto?"),
    t("When the random reads are small and issued one at a time: each pays the SSD's full access time, while the disk pays one seek and then streams. It stops being true when the SSD gets many reads in flight (a deep queue, async I/O) or larger pieces, since SSDs work in parallel internally; and a disk that has to read at random is hopeless at about 10 ms a seek. Lay data out so you can read it in order, and keep many reads in flight when you can't.",
      "Cuando las lecturas al azar son pequeñas y se hacen una a la vez: cada una paga el tiempo de acceso completo del SSD, mientras el disco paga una búsqueda y después fluye. Deja de ser cierto cuando el SSD recibe muchas lecturas a la vez (una cola profunda, E/S asíncrona) o trozos más grandes, porque los SSD trabajan en paralelo por dentro; y un disco que tiene que leer al azar no tiene remedio, a unos 10 ms por búsqueda. Organiza los datos para leerlos en orden, y mantén muchas lecturas en curso cuando no puedas.")],
  [t("Where does the 150 ms round trip to another continent come from, and can a faster server make it smaller?", "¿De dónde sale el viaje de ida y vuelta de 150 ms a otro continente, y un servidor más rápido puede achicarlo?"),
    t("Mostly from distance: light in optical fibre travels at about 200,000 km a second, and California to the Netherlands is roughly 9,000 km each way, so physics alone sets a floor near 90 ms; routes that aren't straight and the routers along them add the rest. A faster server doesn't move anything closer. Only fewer round trips (batching, fewer handshakes) or a copy nearer the user (read replicas, CDNs, edge caches; lesson 01, Caching) helps. A copy has a cost: a replica lags its primary by at least the one-way trip, so a user may not see a write they just made unless their next reads go to the primary.",
      "Sobre todo de la distancia: la luz en la fibra óptica viaja a unos 200,000 km por segundo, y de California a los Países Bajos hay cerca de 9,000 km de ida, así que la física sola pone un piso cercano a 90 ms; las rutas que no son rectas y los routers en el camino suman el resto. Un servidor más rápido no acerca nada. Solo ayudan menos viajes (lotes, menos handshakes) o una copia más cerca del usuario (réplicas de lectura, CDN, cachés en el borde; lección 01, Caché). La copia tiene un costo: una réplica va atrasada respecto de la primaria al menos lo que tarda el viaje de ida, así que un usuario puede no ver algo que acaba de escribir, salvo que sus siguientes lecturas vayan a la primaria.")],
  [t("If an L1 cache hit took one second, how long would a memory reference, an SSD read and a cross-continent round trip take? What does that say about chatty protocols?", "Si un acierto en la caché L1 tardara un segundo, ¿cuánto tardarían una referencia a memoria, una lectura de SSD y un viaje a otro continente? ¿Qué dice eso de los protocolos conversadores?"),
    t("Multiply by two billion: memory about 3 minutes, an SSD read about 3.5 days, a cross-continent round trip about 9.5 years. From the CPU's point of view every network trip is an expedition, so a protocol that needs many back-and-forths (one request per item, a handshake per call) spends almost all its time travelling. Send fewer, bigger messages, and keep connections open so handshakes are paid once.",
      "Multiplica por dos mil millones: memoria unos 3 minutos, una lectura de SSD unos 3.5 días, un viaje a otro continente unos 9.5 años. Desde el punto de vista de la CPU, cada viaje por la red es una expedición, así que un protocolo que necesita muchas idas y vueltas (una solicitud por elemento, un handshake por llamada) pasa casi todo su tiempo viajando. Manda menos mensajes y más grandes, y mantén las conexiones abiertas para pagar los handshakes una sola vez.")],
];

const HOWS = {
  lookups: [t("Where the data lives", "Dónde están los datos"), [["ram", t("In memory", "En memoria")], ["dc", t("Cache service, same DC", "Servicio de caché, mismo DC")], ["wan", t("Other continent", "Otro continente")]]],
  read: [t("Device and pattern", "Dispositivo y patrón"), [["ssd-seq", t("SSD, in order", "SSD, en orden")], ["ssd-rand", t("SSD, random 4 KB", "SSD, 4 KB al azar")], ["disk-seq", t("Disk, in order", "Disco, en orden")], ["disk-rand", t("Disk, random 4 KB", "Disco, 4 KB al azar")]]],
  sum: [t("Stored as", "Guardados como"), [["array", t("Array", "Arreglo")], ["list", t("Linked list", "Lista enlazada")]]],
  batch: [t("Calls", "Llamadas"), [["one", t("One at a time", "Una a la vez")], ["ten", t("10 at a time", "10 a la vez")], ["batch", t("One batch", "Un solo lote")]]],
  send: [t("Size", "Tamaño"), [["kb", "1 KB"], ["mb", "10 MB"], ["gb", "1 GB"]]],
  page: [t("Reads go to", "Las lecturas van a"), [["primary", t("Primary, overseas", "Primaria, lejana")], ["replica", t("Replica, same DC", "Réplica, mismo DC")], ["cache", t("Cache in memory", "Caché en memoria")]]],
};
const DEFAULT_HOW = { lookups: "dc", read: "ssd-rand", sum: "array", batch: "one", send: "gb", page: "primary" };

export default defineLesson({
  title: t("Latency Numbers Workbench", "Banco de trabajo: números de latencia"),
  eyebrow: t("Systems lesson 43 · Latency numbers", "Lección de sistemas 43 · Números de latencia"),
  lede: t("Every read goes somewhere: a cache next to the CPU, main memory, a drive, another machine, another continent. Each step out costs a few to a thousand times more than the last, so where your data lives usually matters more than how clever the code is. This lesson sends a courier on those trips: watch a machine do it, predict what each design costs, then explain it back.",
    "Cada lectura va a algún lugar: una caché junto a la CPU, la memoria principal, un disco, otra máquina, otro continente. Cada paso hacia afuera cuesta entre unas pocas y mil veces más que el anterior, así que dónde viven tus datos suele importar más que lo ingenioso del código. Esta lección manda a un mensajero a hacer esos viajes: mira cómo lo hace una máquina, predice cuánto cuesta cada diseño y después explícalo."),
  machine: {
    intro: t("Pick a job and where its data lives. The courier runs each trip from the CPU and back; the sign adds up the real time and the meters show which station it went to. Stations are spaced by the logarithm of their latency, so the far end of the road is about 300 million times farther than the first stop.",
    "Elige un trabajo y dónde están sus datos. El mensajero hace cada viaje desde la CPU y de vuelta; el letrero suma el tiempo real y los medidores muestran a qué estación se fue. Las estaciones están separadas según el logaritmo de su latencia, así que el final del camino está unas 300 millones de veces más lejos que la primera parada."),
    plate: {
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
      stage: { "data-depot": "" },
      label: t("Latency simulation: a courier runs trips from the CPU to caches, memory, drives and other machines. Space pauses or resumes.", "Simulación de latencia: un mensajero hace viajes de la CPU a cachés, memoria, discos y otras máquinas. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["total", t("Total time", "Tiempo total"), "0 ns"], ["trips", t("Trips", "Viajes")], ["per", t("Per trip", "Por viaje"), "–"], ["human", t("At human scale", "A escala humana"), "–"], ["where", t("Most time at", "Más tiempo en"), "–"], ["share", t("Its share", "Su parte"), "–"]],
    controls: [
      { seg: "job", label: t("Job", "Trabajo"), options: [["lookups", t("100 lookups", "100 consultas")], ["read", t("Read 100 MB", "Leer 100 MB")], ["sum", t("Sum 1M numbers", "Sumar 1M números")], ["batch", t("100 calls overseas", "100 llamadas lejanas")], ["send", t("One transfer overseas", "Una transferencia lejana")], ["page", t("A page: 20 reads", "Una página: 20 lecturas")]], value: "lookups" },
      // One "where" control per job; the live code shows the current job's (the Panel has no wrapper for them).
      ...Object.entries(HOWS).map(([job, [label, options]]) => ({ seg: "how-" + job, label, options, value: DEFAULT_HOW[job], for: job, hidden: job !== "lookups" })),
      { speed: true, options: [[1, "×1"], [4, "×4"], [16, "×16"]], value: 1 },
      { actions: [["reset", t("Run again", "Ejecutar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Latencies from “Latency numbers every programmer should know” by Jeff Dean and Peter Norvig, as collected by Jonas Bonér (<a href="${SOURCE}" target="_blank" rel="noopener">gist</a>, ~2012 values): orders of magnitude, not measurements of your hardware. Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson.`,
    `Latencias de “Latency numbers every programmer should know” de Jeff Dean y Peter Norvig, recopiladas por Jonas Bonér (<a href="${SOURCE}" target="_blank" rel="noopener">gist</a>, valores de ~2012): órdenes de magnitud, no mediciones de tu hardware. Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección.`),
  css: `
.iso-stage [data-layer] text{pointer-events:none}
`,
  data: {
    P,
    G: GEOMETRY,
    COURIER_SVG: courierSvg(),
    DEFAULT_HOW,
  },
});
