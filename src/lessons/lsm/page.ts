// @ts-nocheck: content in the style of the other lessons
// Systems lesson 67 · LSM tree vs B-tree: two storage rooms fed the same writes, a filing cabinet that rewrites pages
// in place and a rack of sorted files that a merge press compacts in the background.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { int, one, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, P, GEOMETRY } from "./figure";
import { baseRun, burstRun, tierRun, BURST, KEYS, PER_PAGE, MEM, DISK, TARGET, L0_SLOW, L0_STOP, L0_TRIGGER, SLOW_RATE, BLOOM_BITS } from "./sim";

// Experiment results, computed at build time from the same model the machine runs (eight seeds each).
const R = { base: baseRun(), burst: burstRun(), tier: tierRun() };

const RATIO = Math.round(R.base.maxL / R.base.maxB);
const x0 = (v) => Math.round(v) + "×";
const x1 = (v) => one(v) + "×";
const p1 = (v) => one(v);
const p2 = (v) => (v < 0.1 ? v.toFixed(2) : one(v));
const sp = (v) => Math.round(v * 100) + "%";
const s0 = (v) => Math.round(v) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;

const RUNS = {
  write: () => {
    const b = R.base, m = top(b.waB), r = top(b.maxL);
    return {
      verdict: t("The B-tree wrote " + x0(b.waB) + " the data to disk, the LSM tree " + x1(b.waL) + ". On the same disk the B-tree could take at most " + int(b.maxB) + " writes a second, the LSM tree " + int(b.maxL) + ".",
        "El árbol B escribió en disco " + x0(b.waB) + " los datos, el árbol LSM " + x1(b.waL) + ". Con el mismo disco, el árbol B podía aceptar como mucho " + int(b.maxB) + " escrituras por segundo, el árbol LSM " + int(b.maxL) + "."),
      groups: [
        { title: t("Bytes written to disk per byte of data", "Bytes escritos en disco por byte de datos"), bars: [[t("B-tree", "Árbol B"), b.waB / m, x0(b.waB), true], [t("LSM tree", "Árbol LSM"), b.waL / m, x1(b.waL)]] },
        { title: t("Most writes a second the disk can take", "Máximo de escrituras por segundo que aguanta el disco"), bars: [[t("B-tree", "Árbol B"), b.maxB / r, int(b.maxB)], [t("LSM tree", "Árbol LSM"), b.maxL / r, int(b.maxL)]] },
      ],
    };
  },
  point: () => {
    const b = R.base, m = top(b.missFiles, b.hitFiles);
    return {
      verdict: t("For keys never written, the B-tree read " + p1(b.missB) + " page a lookup, the LSM tree " + p1(b.missFiles) + " without Bloom filters and " + p2(b.missBloom) + " with them. For keys that exist: " + p1(b.hitFiles) + " pages without filters, " + p1(b.hitBloom) + " with.",
        "Para claves nunca escritas, el árbol B leyó " + p1(b.missB) + " página por búsqueda, el árbol LSM " + p1(b.missFiles) + " sin filtros de Bloom y " + p2(b.missBloom) + " con ellos. Para claves que existen: " + p1(b.hitFiles) + " páginas sin filtros, " + p1(b.hitBloom) + " con."),
      groups: [
        { title: t("Pages per lookup, keys never written", "Páginas por búsqueda, claves nunca escritas"), bars: [[t("B-tree", "Árbol B"), b.missB / m, p1(b.missB)], [t("LSM, no filters", "LSM, sin filtros"), b.missFiles / m, p1(b.missFiles), true], [t("LSM, Bloom filters", "LSM, filtros de Bloom"), Math.max(0.01, b.missBloom / m), p2(b.missBloom)]] },
        { title: t("Pages per lookup, keys that exist", "Páginas por búsqueda, claves que existen"), bars: [[t("B-tree", "Árbol B"), b.hitB / m, p1(b.hitB)], [t("LSM, no filters", "LSM, sin filtros"), b.hitFiles / m, p1(b.hitFiles), true], [t("LSM, Bloom filters", "LSM, filtros de Bloom"), b.hitBloom / m, p1(b.hitBloom)]] },
      ],
    };
  },
  range: () => {
    const b = R.base, m = top(b.rangeL);
    return {
      verdict: t("A range of 100 keys cost the B-tree " + p1(b.rangeB) + " pages and the LSM tree " + p1(b.rangeL) + ", from " + p1(b.rangeFiles) + " runs, with Bloom filters on.",
        "Un rango de 100 claves le costó al árbol B " + p1(b.rangeB) + " páginas y al árbol LSM " + p1(b.rangeL) + ", de " + p1(b.rangeFiles) + " secuencias, con los filtros de Bloom activos."),
      bars: [[t("B-tree, pages", "Árbol B, páginas"), b.rangeB / m, p1(b.rangeB)], [t("LSM tree, pages", "Árbol LSM, páginas"), b.rangeL / m, p1(b.rangeL), true], [t("LSM tree, runs searched", "Árbol LSM, secuencias revisadas"), b.rangeFiles / m, p1(b.rangeFiles)]],
    };
  },
  burst: () => {
    const b = R.burst, f = top(b.peakFiles), w = top(b.endQB);
    return {
      verdict: t("The LSM tree took the burst at full speed for " + s0(b.fullSpeed) + ", while L0 grew to " + Math.round(b.peakL0) + " files and a point read went from " + p1(b.before) + " to " + p1(b.peakFiles) + " files checked. Then writes were slowed for " + s0(b.slow) + ": up to " + int(b.peakQL) + " waited, the longest " + one(b.waitL) + " s, and compaction caught up " + s0(b.caughtUp) + " after the burst. The B-tree fell behind from the first second: " + int(b.endQB) + " writes waiting when the minute ended, cleared " + s0(b.drainB) + " later.",
        "El árbol LSM aceptó la ráfaga a toda velocidad durante " + s0(b.fullSpeed) + ", mientras L0 crecía a " + Math.round(b.peakL0) + " archivos y una lectura puntual pasaba de " + p1(b.before) + " a " + p1(b.peakFiles) + " archivos revisados. Después las escrituras se frenaron durante " + s0(b.slow) + ": llegaron a esperar " + int(b.peakQL) + ", la que más " + one(b.waitL) + " s, y la compactación se puso al día " + s0(b.caughtUp) + " después de la ráfaga. El árbol B se atrasó desde el primer segundo: " + int(b.endQB) + " escrituras esperando al terminar el minuto, que se despacharon " + s0(b.drainB) + " después."),
      groups: [
        { title: t("Files checked per point read (LSM)", "Archivos revisados por lectura puntual (LSM)"), bars: [[t("Before the burst", "Antes de la ráfaga"), b.before / f, p1(b.before)], [t("At the peak", "En el pico"), b.peakFiles / f, p1(b.peakFiles), true]] },
        { title: t("Writes waiting, at most", "Escrituras esperando, como máximo"), bars: [[t("LSM tree", "Árbol LSM"), b.peakQL / w, int(b.peakQL), true], [t("B-tree", "Árbol B"), b.endQB / w, int(b.endQB)]] },
      ],
    };
  },
  tier: () => {
    const { leveled: a, tiered: b } = R.tier, w = top(a.wa), s = top(b.peak), f = top(b.files);
    return {
      verdict: t("Tiered compaction wrote " + x1(b.wa) + " the data instead of " + x1(a.wa) + ". It used " + sp(b.space) + " of the data's size on disk on average, up to " + sp(b.peak) + ", against " + sp(a.space) + " leveled, and a point read checked " + p1(b.files) + " files instead of " + p1(a.files) + ".",
        "La compactación por tamaños escribió " + x1(b.wa) + " los datos en vez de " + x1(a.wa) + ". Ocupó en disco en promedio el " + sp(b.space) + " del tamaño de los datos, hasta el " + sp(b.peak) + ", contra el " + sp(a.space) + " por niveles, y una lectura puntual revisó " + p1(b.files) + " archivos en vez de " + p1(a.files) + "."),
      groups: [
        { title: t("Write amplification", "Amplificación de escritura"), bars: [[t("Leveled", "Por niveles"), a.wa / w, x1(a.wa)], [t("Tiered", "Por tamaños"), b.wa / w, x1(b.wa)]] },
        { title: t("Space on disk, share of the data", "Espacio en disco, frente a los datos"), bars: [[t("Leveled", "Por niveles"), a.space / s, sp(a.space)], [t("Tiered, average", "Por tamaños, promedio"), b.space / s, sp(b.space), true], [t("Tiered, peak", "Por tamaños, pico"), b.peak / s, sp(b.peak), true]] },
        { title: t("Files checked per point read", "Archivos revisados por lectura puntual"), bars: [[t("Leveled", "Por niveles"), a.files / f, p1(a.files)], [t("Tiered", "Por tamaños"), b.files / f, p1(b.files), true]] },
      ],
    };
  },
};

const EXPERIMENTS = [
  {
    id: "write",
    title: t("Small updates, random keys", "Actualizaciones pequeñas, claves al azar"),
    change: t("100 updates a second to random keys, which both engines keep up with · records of about 100 bytes on 4 KB pages · count every byte each engine writes to disk",
      "100 actualizaciones por segundo a claves al azar, que los dos motores alcanzan · registros de unos 100 bytes en páginas de 4 KB · contar cada byte que cada motor escribe en disco"),
    question: t("The B-tree changes each record once, where it lives. The LSM tree writes it again every time compaction moves it down a level. Which one writes more to disk per byte of data?",
      "El árbol B cambia cada registro una vez, donde está. El árbol LSM lo vuelve a escribir cada vez que la compactación lo baja de nivel. ¿Cuál escribe más en disco por byte de datos?"),
    options: [
      t("The LSM tree: it rewrites every record several times", "El árbol LSM: reescribe cada registro varias veces"),
      t("The B-tree: every small change rewrites a whole page", "El árbol B: cada cambio pequeño reescribe una página entera"),
      t("About the same: each writes its log and the data once", "Más o menos lo mismo: cada uno escribe su log y los datos una vez"),
    ],
    answer: 1,
    why: t(
      "A disk doesn't take 100 bytes: the B-tree reads the 4 KB page that holds the record and writes the whole page back, plus a log record, so one small update costs about forty times its size (with random keys over a big table, a page is rarely changed twice before it's written). The LSM tree writes the log, writes the record again when the memtable is flushed, and again each time compaction merges it into the next level, about ten times as big as the last (RocksDB's default ratio). That adds up to more than once, but far less than a page per record, and none of it needs a read first: every write is part of a big sorted batch. So the same disk takes about " + RATIO + " times as many writes a second. The gap depends on record size: with records close to a page, an in-place update costs about one page per page, and the LSM tree still rewrites at every level.",
      "Un disco no recibe 100 bytes: el árbol B lee la página de 4 KB que tiene el registro y vuelve a escribir la página entera, más un registro en el log, así que una actualización pequeña cuesta unas cuarenta veces su tamaño (con claves al azar sobre una tabla grande, una página rara vez cambia dos veces antes de escribirse). El árbol LSM escribe el log, vuelve a escribir el registro cuando se vacía la memtable y otra vez cada vez que la compactación lo fusiona en el nivel siguiente, unas diez veces más grande que el anterior (la proporción por defecto de RocksDB). Eso suma más de una vez, pero mucho menos que una página por registro, y nada de eso necesita una lectura antes: cada escritura va en un lote grande y ordenado. Por eso el mismo disco aguanta unas " + RATIO + " veces más escrituras por segundo. La diferencia depende del tamaño del registro: con registros cerca del tamaño de una página, una actualización en el lugar cuesta más o menos una página por página, y el árbol LSM igual reescribe en cada nivel.",
    ),
    watch: { rate: 100, reads: "hit", bloom: "off", compaction: "leveled" },
  },
  {
    id: "point",
    title: t("Looking up keys that aren't there", "Buscar claves que no existen"),
    change: t("Lookups for keys that were never written · the LSM tree without Bloom filters → with them (" + BLOOM_BITS + " bits a key)",
      "Búsquedas de claves que nunca se escribieron · el árbol LSM sin filtros de Bloom → con ellos (" + BLOOM_BITS + " bits por clave)"),
    question: t("How many pages does each lookup read?", "¿Cuántas páginas lee cada búsqueda?"),
    options: [
      t("Without filters, one per file; with them, fewer than the B-tree", "Sin filtros, una por archivo; con ellos, menos que el árbol B"),
      t("About one in both: each file's index rules the key out", "Cerca de una en los dos: el índice de cada archivo descarta la clave"),
      t("Filters halve it, but it stays well above the B-tree", "Los filtros la reducen a la mitad, pero sigue muy por encima del árbol B"),
    ],
    answer: 0,
    why: t(
      "The B-tree walks its upper levels in memory and reads the one leaf where the key would be: one page, found or not. The LSM tree has no single place for a key. It checks the memtable, then every run from newest to oldest, and for a key that isn't there it reads a page in each one: L0 files, L1, L2, L3. A file's index only says which block could hold the key; the block has to be read to know. A Bloom filter per file answers \"definitely not here\" from memory for almost every run without the key (about 1% false positives at 10 bits a key; lesson 68, Bloom Filter), so a missing key usually costs no read at all, fewer than the B-tree's one. For keys that exist, filters bring the cost down to about one page. The price is memory: 10 bits is about 1.25 bytes a key.",
      "El árbol B recorre sus niveles superiores en memoria y lee la única hoja donde estaría la clave: una página, la encuentre o no. El árbol LSM no tiene un único lugar para una clave. Revisa la memtable y después cada secuencia ordenada (sorted run), de la más nueva a la más vieja, y para una clave que no existe lee una página en cada una: archivos de L0, L1, L2, L3. El índice de un archivo solo dice qué bloque podría tener la clave; hay que leer el bloque para saberlo. Un filtro de Bloom por archivo responde \"seguro que no está\" desde la memoria en casi todas las secuencias que no tienen la clave (cerca de 1% de falsos positivos con 10 bits por clave; lección 68, Filtro de Bloom), así que una clave que no existe casi nunca cuesta una lectura, menos que la página del árbol B. Para claves que existen, los filtros bajan el costo a cerca de una página. El precio es memoria: 10 bits son unos 1.25 bytes por clave.",
    ),
    watch: { rate: 100, reads: "miss", bloom: "on", compaction: "leveled" },
  },
  {
    id: "range",
    title: t("A range of keys", "Un rango de claves"),
    change: t("Bloom filters on · reads of 100 keys in order (a range scan) instead of single keys", "Filtros de Bloom activos · lecturas de 100 claves en orden (un escaneo de rango) en vez de claves sueltas"),
    question: t("Which engine reads fewer pages for a range of 100 keys?", "¿Qué motor lee menos páginas para un rango de 100 claves?"),
    options: [
      t("The LSM tree: its Bloom filters let it skip most files", "El árbol LSM: sus filtros de Bloom le permiten saltarse casi todos los archivos"),
      t("The B-tree: the range sits in a few neighbouring leaves", "El árbol B: el rango está en unas pocas hojas vecinas"),
      t("The same: both read the pages that hold 100 records", "Lo mismo: los dos leen las páginas que tienen 100 registros"),
    ],
    answer: 1,
    why: t(
      "A B-tree keeps all its keys in one order across its leaves, so a range is a short walk along neighbouring pages. In an LSM tree the keys of a range are spread over every run, each sorted on its own, so the read has to seek in every run and merge what it finds, the newest version of each key winning. A Bloom filter answers \"is this key here?\", not \"is anything between a and b here?\", so it can't skip a run. The bottom level is packed full and holds most of the range in fewer pages than the B-tree's leaves, which random inserts leave about 70% full; the extra pages come from the runs above it. Fewer runs help (that is what compaction is for), and RocksDB's prefix Bloom filters help ranges that share a key prefix.",
      "Un árbol B mantiene todas sus claves en un solo orden a lo largo de sus hojas, así que un rango es un recorrido corto por páginas vecinas. En un árbol LSM las claves de un rango están repartidas en todas las secuencias, cada una ordenada por su cuenta, así que la lectura tiene que buscar en cada secuencia y combinar lo que encuentra, y gana la versión más nueva de cada clave. Un filtro de Bloom responde \"¿está esta clave?\", no \"¿hay algo entre a y b?\", así que no puede saltarse una secuencia. El nivel de abajo está lleno y tiene la mayor parte del rango en menos páginas que las hojas del árbol B, que las inserciones al azar dejan llenas en un 70%; las páginas de más salen de las secuencias de arriba. Menos secuencias ayudan (para eso está la compactación), y los filtros de Bloom por prefijo de RocksDB ayudan a los rangos que comparten un prefijo de clave.",
    ),
    watch: { rate: 100, reads: "range", bloom: "on", compaction: "leveled" },
  },
  {
    id: "burst",
    title: t("A minute-long write burst", "Una ráfaga de escrituras de un minuto"),
    change: t("A steady " + BURST.base + " writes a second → " + BURST.rate + " a second for a minute · leveled compaction · writes slowed at " + L0_SLOW + " L0 files, stopped at " + L0_STOP,
      BURST.base + " escrituras por segundo constantes → " + BURST.rate + " por segundo durante un minuto · compactación por niveles · escrituras frenadas con " + L0_SLOW + " archivos en L0, detenidas con " + L0_STOP),
    question: t("An LSM write only touches the memtable and the log. What does the LSM tree do with the burst?", "Una escritura en el árbol LSM solo toca la memtable y el log. ¿Qué hace el árbol LSM con la ráfaga?"),
    options: [
      t("Takes it all at full speed; compaction catches up afterwards", "La acepta toda a toda velocidad; la compactación se pone al día después"),
      t("Full speed at first, then reads check more files and writes slow", "A toda velocidad al principio, después las lecturas revisan más archivos y las escrituras se frenan"),
      t("Slows at once, like the B-tree: each write still costs disk time", "Se frena de inmediato, como el árbol B: cada escritura igual cuesta tiempo de disco"),
    ],
    answer: 1,
    why: t(
      "A write costs the LSM tree almost nothing up front, so for a while it takes the burst at full speed. But every flushed file is compaction work owed, and at this rate the work grows faster than the disk can do it: files pile up in L0, the levels below grow past their size, and every point read has more files to check. RocksDB's answer, modelled here with its default triggers, is to slow writes at 20 L0 files (here to " + SLOW_RATE + " a second) and stop them at 36 until compaction catches up: a write stall. The debt is paid either way; the LSM tree only pays it later, and its reads pay too in the meantime. The B-tree pays up front: each write needs its two page reads and writes, so past what its disk can do it falls behind from the first second.",
      "Una escritura casi no le cuesta nada al árbol LSM en el momento, así que por un rato acepta la ráfaga a toda velocidad. Pero cada archivo que se vacía es trabajo de compactación pendiente, y a este ritmo ese trabajo crece más rápido de lo que el disco puede hacerlo: los archivos se acumulan en L0, los niveles de abajo pasan de su tamaño y cada lectura puntual tiene más archivos que revisar. La respuesta de RocksDB, modelada aquí con sus umbrales por defecto, es frenar las escrituras con 20 archivos en L0 (aquí a " + SLOW_RATE + " por segundo) y detenerlas con 36 hasta que la compactación se ponga al día: un freno de escritura (write stall). La deuda se paga igual; el árbol LSM solo la paga más tarde, y mientras tanto también la pagan sus lecturas. El árbol B paga en el momento: cada escritura necesita su lectura y su escritura de página, así que por encima de lo que aguanta su disco se atrasa desde el primer segundo.",
    ),
    watch: { rate: 100, reads: "hit", bloom: "off", compaction: "leveled", burst: true, speed: 4 },
  },
  {
    id: "tier",
    title: t("Tiered compaction", "Compactación por tamaños"),
    change: t("Leveled → tiered compaction (four runs of similar size are merged into one) · the same 100 updates a second", "Por niveles → por tamaños (tiered: cuatro secuencias de tamaño parecido se fusionan en una) · las mismas 100 actualizaciones por segundo"),
    question: t("Tiered compaction rewrites each record fewer times. What does that cost?", "La compactación por tamaños reescribe cada registro menos veces. ¿Qué cuesta eso?"),
    options: [
      t("Nothing much: fewer rewrites is a pure gain", "Casi nada: menos reescrituras es pura ganancia"),
      t("Several copies of the data on disk, and more files per read", "Varias copias de los datos en disco, y más archivos por lectura"),
      t("Slower writes, because each merge is bigger", "Escrituras más lentas, porque cada fusión es más grande"),
    ],
    answer: 1,
    why: t(
      "Leveled compaction keeps one sorted run per level and pushes a file down as soon as its level is over size, so each level holds at most one version of a key: little more than the data on disk and a short list of runs to search, at the cost of rewriting each record at every level. Tiered compaction leaves runs alone until there are four of about the same size, then merges them, so a record is rewritten about once per tier. Until a merge, the old and new versions of the same keys sit side by side in several big runs: with updates to the same keys, the disk holds several copies, and a point read has more runs to check. No layout wins on all three; this trade is often called the RUM conjecture (read, update, memory). Cassandra's size-tiered strategy and RocksDB's universal compaction are tiered; RocksDB's default and Cassandra's leveled strategy are leveled.",
      "La compactación por niveles mantiene una secuencia ordenada por nivel y baja un archivo en cuanto su nivel pasa de tamaño, así que cada nivel tiene como mucho una versión de cada clave: poco más que los datos en disco y una lista corta de secuencias para buscar, a cambio de reescribir cada registro en cada nivel. La compactación por tamaños deja las secuencias quietas hasta que hay cuatro de tamaño parecido y entonces las fusiona, así que un registro se reescribe más o menos una vez por escalón. Hasta esa fusión, las versiones viejas y nuevas de las mismas claves conviven en varias secuencias grandes: con actualizaciones a las mismas claves, el disco guarda varias copias, y una lectura puntual tiene más secuencias que revisar. Ningún diseño gana en las tres cosas; a este intercambio se le suele llamar la conjetura RUM (lectura, actualización, memoria). La estrategia size-tiered de Cassandra y la compactación universal de RocksDB son por tamaños; la opción por defecto de RocksDB y la estrategia leveled de Cassandra son por niveles.",
    ),
    watch: { rate: 100, reads: "hit", bloom: "off", compaction: "tiered", speed: 4 },
  },
];

const QUESTIONS = [
  [t("Where do an LSM tree's write savings come from, and when do they shrink or disappear?", "¿De dónde sale el ahorro de escritura de un árbol LSM, y cuándo se achica o desaparece?"),
    t("Three places: a write needs no read first (the B-tree must read the page it changes), small random writes are collected in memory and written as big sorted files, and many records share each page written. They shrink when values are large (close to a page, an in-place update costs about what it writes, while the LSM tree still rewrites each record at every level; key-value separation, as in the WiscKey paper or RocksDB's BlobDB, keeps big values out of compaction), when the application reads before every write anyway, and when compaction can't keep up and writes stall.",
      "De tres lugares: una escritura no necesita leer antes (el árbol B tiene que leer la página que cambia), las escrituras pequeñas al azar se juntan en memoria y se escriben como archivos grandes y ordenados, y muchos registros comparten cada página escrita. Se achica cuando los valores son grandes (cerca de una página, una actualización en el lugar cuesta más o menos lo que escribe, mientras el árbol LSM igual reescribe cada registro en cada nivel; separar claves y valores, como en el paper de WiscKey o en BlobDB de RocksDB, deja los valores grandes fuera de la compactación), cuando la aplicación lee antes de cada escritura de todas formas, y cuando la compactación no alcanza y las escrituras se frenan.")],
  [t("Write latency on a RocksDB-backed service spikes during a nightly import. What is probably happening, and what can you do?", "La latencia de escritura de un servicio sobre RocksDB se dispara durante una importación nocturna. ¿Qué está pasando probablemente y qué puedes hacer?"),
    t("A write stall: compaction has fallen behind, so L0 has reached its slowdown or stop trigger (20 and 36 files by default) or the pending compaction bytes passed their soft or hard limit, and RocksDB is throttling writes. Its LOG and statistics report stalls and their cause. Options: give compaction more threads (max_background_jobs) or more disk, use bigger or more memtables to absorb peaks, rate-limit the import, or build sorted SST files offline and ingest them (IngestExternalFile), which skips the memtable and most compaction.",
      "Un freno de escritura (write stall): la compactación se atrasó, así que L0 llegó a su umbral de frenado o de parada (20 y 36 archivos por defecto) o los bytes pendientes de compactación pasaron su límite blando o duro, y RocksDB está limitando las escrituras. Su LOG y sus estadísticas informan los frenos y su causa. Opciones: darle más hilos a la compactación (max_background_jobs) o más disco, usar memtables más grandes o más numerosas para absorber picos, limitar la tasa de la importación, o construir archivos SST ordenados por fuera e ingerirlos (IngestExternalFile), lo que se salta la memtable y casi toda la compactación.")],
  [t("Why does a delete make an LSM tree bigger at first, and when does the space come back?", "¿Por qué un borrado agranda al principio un árbol LSM, y cuándo se recupera el espacio?"),
    t("Old runs are never edited in place, so a delete writes a marker, a tombstone, that hides older versions of the key. The tombstone and the data it hides stay until compaction carries the tombstone down to the bottom level, where nothing older can exist, and drops both. Until then range scans over deleted keys still read the tombstones, which is why queue-like tables that insert and delete in key order get slow scans. Cassandra also keeps tombstones at least gc_grace_seconds (10 days by default) so a replica that missed the delete doesn't bring the data back.",
      "Las secuencias viejas nunca se editan en el lugar, así que un borrado escribe una marca, una lápida (tombstone), que oculta las versiones viejas de la clave. La lápida y los datos que oculta se quedan hasta que la compactación lleva la lápida hasta el nivel de abajo, donde no puede haber nada más viejo, y descarta las dos. Hasta entonces los escaneos de rango sobre claves borradas igual leen las lápidas, y por eso las tablas usadas como cola, que insertan y borran en orden de clave, tienen escaneos lentos. Cassandra además guarda las lápidas al menos gc_grace_seconds (10 días por defecto) para que una réplica que no recibió el borrado no devuelva los datos.")],
  [t("A workload is 95% reads, many of them range queries, with tight latency targets. Which engine would you start from, and why?", "Una carga es 95% lecturas, muchas de ellas consultas de rango, con objetivos de latencia estrictos. ¿Con qué motor empezarías y por qué?"),
    t("A B-tree (PostgreSQL, InnoDB, SQLite): each key has one place, a range is a walk along neighbouring leaves, and there's no background compaction competing for the disk or stalling writes, so latency is steadier. An LSM tree can serve it too, with Bloom filters, a block cache and leveled compaction to keep runs few, but scans still merge every run and compaction adds variance. The LSM tree earns its keep where writes dominate: ingest, time series, logs, large key-value stores (RocksDB, Cassandra, ScyllaDB).",
      "Un árbol B (PostgreSQL, InnoDB, SQLite): cada clave tiene un solo lugar, un rango es un recorrido por hojas vecinas y no hay compactación de fondo que compita por el disco ni frene las escrituras, así que la latencia es más estable. Un árbol LSM también puede atenderla, con filtros de Bloom, una caché de bloques y compactación por niveles para tener pocas secuencias, pero los escaneos igual combinan todas las secuencias y la compactación agrega variación. El árbol LSM rinde donde dominan las escrituras: ingesta, series de tiempo, logs, almacenes clave-valor grandes (RocksDB, Cassandra, ScyllaDB).")],
  [t("What do write, read and space amplification measure, and roughly how do the two engines score?", "¿Qué miden la amplificación de escritura, de lectura y de espacio, y cómo puntúan más o menos los dos motores?"),
    t("Write amplification: bytes written to disk per byte the application writes. Read amplification: pages (or files) read per lookup. Space amplification: bytes on disk per byte of live data. A B-tree has high write amplification for small random writes (a page per change), about one page per point read, and pages that random inserts leave partly empty (around 70% full). A leveled LSM tree writes several to a few dozen times the data but in big batches, needs Bloom filters to get point reads near one page, and uses little more than the data. Tiered compaction writes less and pays in space and reads. Improving one usually costs another.",
      "Amplificación de escritura: bytes escritos en disco por byte que escribe la aplicación. Amplificación de lectura: páginas (o archivos) leídas por búsqueda. Amplificación de espacio: bytes en disco por byte de datos vivos. Un árbol B tiene alta amplificación de escritura para escrituras pequeñas al azar (una página por cambio), cerca de una página por lectura puntual, y páginas que las inserciones al azar dejan medio vacías (cerca de 70% llenas). Un árbol LSM por niveles escribe de varias a unas decenas de veces los datos pero en lotes grandes, necesita filtros de Bloom para dejar las lecturas puntuales cerca de una página y ocupa poco más que los datos. La compactación por tamaños escribe menos y lo paga en espacio y lecturas. Mejorar una casi siempre cuesta otra.")],
  [t("The memtable lives in memory. Why doesn't a crash lose the writes in it, and what does a B-tree use the same log for?", "La memtable vive en memoria. ¿Por qué una caída no pierde las escrituras que tiene, y para qué usa un árbol B el mismo log?"),
    t("Every write is appended to a write-ahead log on disk before it is acknowledged; after a crash the engine replays the log to rebuild the memtable, and once a memtable is flushed to a sorted file its part of the log can be deleted. A real B-tree doesn't write each changed page right away either: it keeps dirty pages in its buffer pool and writes them later, and the log is what makes a committed change durable until then and lets recovery redo it (lesson 66, Write-Ahead Log). Both engines in this model write that log; it's the one-per-record part of their write amplification.",
      "Cada escritura se agrega a un registro de escritura anticipada (write-ahead log, WAL) en disco antes de confirmarla; después de una caída el motor reproduce el log para reconstruir la memtable, y cuando una memtable se vacía en un archivo ordenado su parte del log se puede borrar. Un árbol B real tampoco escribe cada página cambiada en el momento: guarda las páginas modificadas en su buffer pool y las escribe después, y el log es lo que hace durable un cambio confirmado hasta entonces y permite rehacerlo al recuperarse (lección 66, Registro de escritura anticipada). Los dos motores de este modelo escriben ese log; es la parte de una vez por registro de su amplificación de escritura.")],
];

export default defineLesson({
  title: t("LSM Tree Workbench", "Banco de trabajo: árbol LSM"),
  eyebrow: t("Systems lesson 67 · LSM tree vs B-tree", "Lección de sistemas 67 · Árbol LSM vs árbol B"),
  lede: t("A B-tree updates each page where it lives. An LSM tree (log-structured merge tree) collects writes in memory, writes them out as sorted files and merges those files in the background. It takes small random writes far more cheaply, and pays for them later: in reads that check more files, in compaction, and in space. This lesson feeds the same writes to both: watch a machine do it, predict where each one pays, then explain it back.",
    "Un árbol B actualiza cada página donde está. Un árbol LSM (log-structured merge tree) junta las escrituras en memoria, las escribe como archivos ordenados y fusiona esos archivos en segundo plano. Acepta escrituras pequeñas al azar mucho más barato, y las paga después: en lecturas que revisan más archivos, en compactación y en espacio. Esta lección les da las mismas escrituras a los dos: mira cómo lo hace una máquina, predice dónde paga cada uno y después explícalo."),
  machine: {
    intro: t("The writer at the front hands every write to both rooms; writes an engine can't take yet wait in its tray on the desk in the middle. On the left, the B-tree finds the page the key lives on, pulls out its drawer and writes the whole page back. On the right, the LSM tree drops the write into the memtable; when it's full the memtable is bound into a file on the L0 shelf, and the merge press compacts files down the rack. Try faster writes, the three kinds of reads, Bloom filters and tiered compaction, or set off a burst.",
      "El escritor de adelante les pasa cada escritura a las dos salas; las escrituras que un motor todavía no puede tomar esperan en su bandeja del escritorio del medio. A la izquierda, el árbol B busca la página donde está la clave, abre su cajón y vuelve a escribir la página entera. A la derecha, el árbol LSM deja la escritura en la memtable; cuando se llena, la memtable se encuaderna en un archivo en el estante L0, y la prensa de fusión compacta archivos hacia abajo en el mueble. Prueba escrituras más rápidas, los tres tipos de lectura, los filtros de Bloom y la compactación por tamaños, o lanza una ráfaga."),
    plate: {
      title: t("Two storage rooms", "Dos salas de archivo"),
      keys: [
        { mark: "lit", label: t("What is being written: the B-tree drawer and record a write changes, the merge press and the LSM files it is merging", "Lo que se está escribiendo: el cajón y el registro del árbol B que cambia una escritura, la prensa de fusión y los archivos LSM que fusiona") },
        { mark: "raised", label: t("LSM files on the rack: thin books in L0, one long sorted run per level below (tiered: runs on the shelf for their size); the WRITE STALL sign, up while writes are slowed", "Archivos LSM en el mueble: libros delgados en L0, una secuencia ordenada larga por nivel más abajo (por tamaños: cada secuencia en el estante de su tamaño); el letrero FRENO, arriba mientras se frenan las escrituras") },
        { mark: "flat", label: t("The page table: the last B-tree page written, one tile per record it holds", "La mesa de página: la última página del árbol B escrita, una ficha por registro que tiene") },
      ],
      caption: t(
        "Played at a quarter of the model's speed (change it under Speed). Everything is scaled down and the numbers are illustrative: " + int(KEYS) + " records of about 100 bytes, " + PER_PAGE + " to a 4 KB page, a memtable of " + MEM + " writes, L1 at " + int(TARGET[1]) + " records and L2 at " + int(TARGET[2]) + ", and for each engine a disk that moves " + DISK + " pages a second whether they are in order or not, roughly as an SSD does. Reads are counted, not charged to the disks. The tick on L1 and L2 marks the level's target size; with tiered compaction the shelves are tiers T1 to T4, from the smallest runs to the biggest. Counters: write amplification over the last 30 s, pages per read, space on disk against the data, each disk's load, and on the writer's desk the writes waiting for each engine.",
        "Se reproduce a un cuarto de la velocidad del modelo (cámbiala en Velocidad). Todo está a escala y las cifras son ilustrativas: " + int(KEYS) + " registros de unos 100 bytes, " + PER_PAGE + " por página de 4 KB, una memtable de " + MEM + " escrituras, L1 de " + int(TARGET[1]) + " registros y L2 de " + int(TARGET[2]) + ", y para cada motor un disco que mueve " + DISK + " páginas por segundo estén en orden o no, más o menos como un SSD. Las lecturas se cuentan, pero no gastan disco. La marca en L1 y L2 señala el tamaño objetivo del nivel; con compactación por tamaños, los estantes son los escalones T1 a T4, de las secuencias más pequeñas a las más grandes. Contadores: amplificación de escritura de los últimos 30 s, páginas por lectura, espacio en disco frente a los datos, la carga de cada disco y, en el escritorio del escritor, las escrituras que esperan a cada motor.",
      ),
      stage: { "data-rooms": "" },
      label: t("LSM tree and B-tree simulation. Space pauses or resumes.", "Simulación de un árbol LSM y un árbol B. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["waB", t("Write amp, B-tree", "Amp. de escritura, árbol B"), "–"],
      ["waL", t("Write amp, LSM", "Amp. de escritura, LSM"), "–"],
      ["rdB", t("Pages per read, B-tree", "Páginas por lectura, árbol B"), "–"],
      ["rdL", t("Pages / files per read, LSM", "Páginas / archivos por lectura, LSM"), "–"],
      ["space", t("Space, B-tree / LSM", "Espacio, árbol B / LSM"), "–"],
      ["wait", t("Waiting, B-tree / LSM", "En espera, árbol B / LSM"), "0 / 0"],
    ],
    controls: [
      { seg: "rate", label: t("Writes", "Escrituras"), options: [[100, "100/s"], [400, "400/s"], [BURST.rate, BURST.rate + "/s"]], value: 100 },
      { seg: "reads", label: t("Reads", "Lecturas"), options: [["hit", t("Keys that exist", "Claves que existen")], ["miss", t("Keys never written", "Claves nunca escritas")], ["range", t("Ranges of 100", "Rangos de 100")]], value: "hit" },
      { seg: "bloom", label: t("Bloom filters", "Filtros de Bloom"), options: [["off", t("Off", "No")], ["on", t("10 bits a key", "10 bits por clave")]], value: "off" },
      { seg: "compaction", label: t("Compaction", "Compactación"), options: [["leveled", t("Leveled", "Por niveles")], ["tiered", t("Tiered", "Por tamaños")]], value: "leveled" },
      { speed: true, options: [[0.25, "×1/4"], [1, "×1"], [4, "×4"]], value: 0.25 },
      { actions: [["burst", t("Burst: " + BURST.rate + "/s for a minute", "Ráfaga: " + BURST.rate + "/s por un minuto"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Both engines get the same writes and the same reads. The B-tree can take about " + int(DISK / (2 + 1 / PER_PAGE)) + " writes a second on its disk; past that, writes wait on the writer's desk.",
      "Cambiar un ajuste reinicia la ejecución. Los dos motores reciben las mismas escrituras y las mismas lecturas. El árbol B aguanta unas " + int(DISK / (2 + 1 / PER_PAGE)) + " escrituras por segundo con su disco; por encima de eso, las escrituras esperan en el escritorio del escritor."),
  },
  predict: {
    intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.",
      "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; its leveled compaction and write-stall triggers follow RocksDB's defaults, and its tiered compaction follows size-tiered compaction (four runs of similar size).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; su compactación por niveles y sus umbrales de freno siguen los valores por defecto de RocksDB, y su compactación por tamaños sigue la compactación size-tiered (cuatro secuencias de tamaño parecido).`),
  css: LIT_FILL_CSS + `
[data-drawer]{transition:transform .12s ease-out}
`,
  data: { P, G: GEOMETRY },
});
