// @ts-nocheck: content ported as-is
// Systems lesson 20 · Logs and offsets: a rail yard where tracks are partitions and cars are records.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { pct, n0 } from "../../lib/format";
import { buildFigure, carSvg, P, GEOMETRY } from "./figure";
import { orderRun, crashRun, groupRun, hotRun, replayRun } from "./sim";

const EXPERIMENTS = [
  {
    id: "order",
    title: t("Order per customer", "Orden por cliente"),
    change: t("Records with no key (any track) vs keyed by customer · 3 tracks, 3 consumers, 4 records/s", "Registros sin clave (cualquier vía) vs con clave por cliente · 3 vías, 3 consumidores, 4 registros/s"),
    question: t("Each customer's records are created in order: created, paid, shipped. With no key, how often is a customer's record read before an earlier one of the same customer?", "Los registros de cada cliente se crean en orden: creado, pagado, enviado. Sin clave, ¿qué tan seguido se lee un registro de un cliente antes que uno anterior del mismo cliente?"),
    options: [t("Never: a log keeps records in order", "Nunca: un log mantiene los registros en orden"), t("Sometimes: order only holds within one track", "A veces: el orden solo se cumple dentro de una vía"), t("Almost always", "Casi siempre")],
    answer: 1,
    why: t("A log is ordered per track, not across tracks. Without a key, one customer's records land on different tracks, and each track is read by its own consumer at its own pace, so a later record can be read first. Keying by customer sends all of that customer's records to one track, where one consumer reads them in order.", "Un log está ordenado por vía, no entre vías. Sin clave, los registros de un cliente caen en vías distintas, y cada vía la lee su propio consumidor a su propio ritmo, así que un registro posterior se puede leer primero. Usar al cliente como clave manda todos sus registros a una sola vía, donde un solo consumidor los lee en orden."),
    watch: { keying: "random", partitions: 3, consumers: 3, commit: "after", rate: 4, retention: 0 },
  },
  {
    id: "crash",
    title: t("A consumer crashes", "Un consumidor se cae"),
    change: t("Consumer 1 crashes in the middle of a batch every 10 s · commit after processing vs before", "El consumidor 1 se cae en medio de un lote cada 10 s · commit después de procesar vs antes"),
    question: t("Committing after processing, what happens to the records it had processed but not yet committed when it crashed?", "Con commit después de procesar, ¿qué pasa con los registros que ya había procesado pero aún no había confirmado cuando se cayó?"),
    options: [t("They are lost", "Se pierden"), t("They are read again after the restart", "Se vuelven a leer después del reinicio"), t("Nothing: the log remembers what was processed", "Nada: el log recuerda lo que se procesó")],
    answer: 1,
    why: t("After a restart a consumer continues from the committed offset, the bookmark. Commit after processing and the records processed since the last commit are read a second time (at least once), so the handler must be idempotent. Commit before processing and the records that were committed but never processed are skipped for good (at most once).", "Después de reiniciar, un consumidor sigue desde el offset confirmado (committed offset), el marcador. Con commit después de procesar, los registros procesados desde el último commit se leen una segunda vez (al menos una vez, at-least-once), así que el handler debe ser idempotente. Con commit antes de procesar, los registros confirmados pero nunca procesados se saltan para siempre (como máximo una vez, at-most-once)."),
    watch: { keying: "key", partitions: 3, consumers: 3, commit: "after", rate: 4, retention: 0, crashes: true },
  },
  {
    id: "group",
    title: t("More consumers than tracks", "Más consumidores que vías"),
    change: t("3 tracks · producer at 8 records/s · consumers in the group 3 → 6", "3 vías · productor a 8 registros/s · consumidores en el grupo 3 → 6"),
    question: t("Three consumers can't keep up. With six, how many records are read per minute?", "Tres consumidores no alcanzan. Con seis, ¿cuántos registros se leen por minuto?"),
    options: [t("About twice as many", "Más o menos el doble"), t("The same: three consumers get no track", "Los mismos: tres consumidores no reciben vía"), t("Fewer, because they fight over the tracks", "Menos, porque se pelean por las vías")],
    answer: 1,
    why: t("Within a group each track is read by exactly one consumer, which is what keeps it in order. Three tracks means at most three consumers doing work; the other three stand by. To read faster you need more tracks (partitions), and that is much easier to plan up front than to change later.", "Dentro de un grupo, cada vía la lee exactamente un consumidor, y eso es lo que la mantiene en orden. Tres vías significan como mucho tres consumidores trabajando; los otros tres esperan. Para leer más rápido necesitas más vías (particiones), y eso es mucho más fácil de planear desde el principio que de cambiar después."),
    watch: { keying: "key", partitions: 3, consumers: 6, commit: "after", rate: 8, retention: 0 },
  },
  {
    id: "hot",
    title: t("A hot customer", "Un cliente caliente"),
    change: t("70% of records are for customer A · keyed by customer · 3 tracks, 3 consumers, 4 records/s", "El 70% de los registros son del cliente A · clave por cliente · 3 vías, 3 consumidores, 4 registros/s"),
    question: t("After a minute, where is the lag?", "Después de un minuto, ¿dónde está el lag?"),
    options: [t("Spread evenly over the three tracks", "Repartido por igual en las tres vías"), t("Almost all on customer A's track", "Casi todo en la vía del cliente A"), t("Nowhere: three consumers can handle 4 records/s", "En ningún lado: tres consumidores pueden con 4 registros/s")],
    answer: 1,
    why: t("Every record for A goes to one track, and one consumer reads it at about 2 records/s while A alone sends 2.8. The other two tracks sit nearly empty. More tracks don't help a single key; if the order only matters per order or per device, key by that instead so the load spreads.", "Cada registro de A va a una sola vía, y un consumidor la lee a unos 2 registros/s mientras A solo manda 2.8. Las otras dos vías quedan casi vacías. Más vías no ayudan a una sola clave (hot key); si el orden solo importa por pedido o por dispositivo, usa eso como clave para que la carga se reparta."),
    watch: { keying: "hot", partitions: 3, consumers: 3, commit: "after", rate: 4, retention: 0 },
  },
  {
    id: "replay",
    title: t("Rebuild from the log", "Reconstruir desde el log"),
    change: t("After 90 s the customer totals are wiped · every bookmark is rewound to the oldest record and read again · keep all records vs keep 20 s", "A los 90 s se borran los totales por cliente · cada marcador se rebobina al registro más antiguo y se vuelve a leer · guardar todos los registros vs guardar 20 s"),
    question: t("Keeping every record, how many of the 6 customer totals come back right?", "Guardando todos los registros, ¿cuántos de los 6 totales por cliente vuelven correctos?"),
    options: [t("None: records are gone once they're read", "Ninguno: los registros desaparecen una vez leídos"), t("All 6", "Los 6"), t("Only the customers seen most recently", "Solo los clientes vistos más recientemente")],
    answer: 1,
    why: t("Reading a log doesn't remove anything; consumers only move a bookmark. Rewind the bookmark and the same records are read again, so a broken read model can be rebuilt from scratch. That only works for what the log still keeps: with 20 s of retention most of the history is already gone, and no total comes back right.", "Leer un log no borra nada; los consumidores solo mueven un marcador. Rebobina el marcador y los mismos registros se vuelven a leer, así que un modelo de lectura roto se puede reconstruir desde cero. Eso solo funciona con lo que el log todavía guarda: con 20 s de retención la mayor parte del historial ya no está, y ningún total vuelve correcto."),
    watch: { keying: "key", partitions: 3, consumers: 3, commit: "after", rate: 4, retention: 0, rewindAt: 15 },
  },
];

const QUESTIONS = [
  [t("Why does the producer pick a track by key, and what exactly does that guarantee?", "¿Por qué el productor elige una vía según la clave, y qué garantiza eso exactamente?"),
    t("The same key always goes to the same track, and a track is read in order by one consumer, so all records for one key are processed in the order they were written. There is no ordering guarantee between different keys or different tracks.", "La misma clave siempre va a la misma vía, y un solo consumidor lee esa vía en orden, así que todos los registros de una clave se procesan en el orden en que se escribieron. No hay garantía de orden entre claves distintas ni entre vías distintas.")],
  [t("Commit after processing or before? Which guarantee does each give, and what does the handler need?", "¿Commit después de procesar o antes? ¿Qué garantía da cada uno y qué necesita el handler?"),
    t("After processing gives at-least-once: after a crash some records are read again, so the handler must be idempotent (for example, dedupe by record id or use upserts). Before processing gives at-most-once: nothing is repeated, but records committed and not yet processed are lost.", "Después de procesar da al menos una vez (at-least-once): tras una caída algunos registros se leen otra vez, así que el handler debe ser idempotente (por ejemplo, deduplicar por id de registro o usar upserts). Antes de procesar da como máximo una vez (at-most-once): nada se repite, pero los registros confirmados y aún no procesados se pierden.")],
  [t("A topic has 3 partitions and you scale the consumer group to 10 to catch up. What happens, and what should you change?", "Un topic tiene 3 particiones y escalas el consumer group a 10 para ponerte al día. ¿Qué pasa y qué deberías cambiar?"),
    t("Only 3 consumers get a partition; 7 sit idle and throughput doesn't change. Add partitions (and plan for it early, since it changes which partition a key maps to), or make each consumer faster.", "Solo 3 consumidores reciben una partición; 7 quedan inactivos y el rendimiento (throughput) no cambia. Agrega particiones (y planéalo temprano, porque cambia a qué partición va cada clave), o haz que cada consumidor sea más rápido.")],
  [t("One customer produces most of the traffic. What do you see, and what can you do?", "Un cliente produce la mayor parte del tráfico. ¿Qué ves y qué puedes hacer?"),
    t("Lag builds on that customer's partition while the others are idle. More partitions don't help one key. Key by something finer when order only matters per order or per device, or split that customer's work after the log.", "El lag crece en la partición de ese cliente mientras las otras están ociosas. Más particiones no ayudan a una sola clave. Usa una clave más fina cuando el orden solo importa por pedido o por dispositivo, o reparte el trabajo de ese cliente después del log.")],
  [t("How is a log different from a queue where reading deletes the message?", "¿En qué se diferencia un log de una cola donde leer borra el mensaje?"),
    t("A log keeps records until retention removes them, whether or not anyone read them. Each consumer group has its own bookmark, so many groups can read the same records independently, and any group can rewind and replay.", "Un log guarda los registros hasta que la retención los elimina, los haya leído alguien o no. Cada consumer group tiene su propio marcador, así que muchos grupos pueden leer los mismos registros de forma independiente, y cualquier grupo puede rebobinar y volver a leerlos (replay).")],
  [t("A consumer restarts. How does it know where to continue, and why do offsets have to keep increasing?", "Un consumidor se reinicia. ¿Cómo sabe dónde seguir, y por qué los offsets tienen que crecer siempre?"),
    t("The group stores a committed offset per partition (in Gossip Glomers this is `commit_offsets` and `list_committed_offsets`), and the consumer resumes there. Offsets only grow, so \"committed offset 120\" means everything below 120 is done; if offsets could repeat or go backwards, a bookmark would mean nothing.", "El grupo guarda un offset confirmado por partición (en Gossip Glomers son `commit_offsets` y `list_committed_offsets`), y el consumidor retoma desde ahí. Los offsets solo crecen, así que \"offset confirmado 120\" significa que todo lo anterior a 120 está hecho; si los offsets pudieran repetirse o retroceder, un marcador no significaría nada.")],
];

// ---------- experiment results (headless, same model) ----------
const order = { random: orderRun("random"), key: orderRun("key") };
const crash = { after: crashRun("after"), before: crashRun("before") };
const group = { three: groupRun(3), six: groupRun(6) };
const hot = hotRun("hot"), even = hotRun("key");
const replay = { all: replayRun(0), short: replayRun(20) };
const RESULTS = {
  order: {
    verdict: t(`No key: ${pct(order.random)} of records were read before an earlier record of the same customer. Keyed by customer: ${pct(order.key)}.`,
      `Sin clave: el ${pct(order.random)} de los registros se leyó antes que un registro anterior del mismo cliente. Con clave por cliente: ${pct(order.key)}.`),
    bars: [[t("No key", "Sin clave"), order.random / Math.max(order.random, 0.01), pct(order.random), true], [t("By customer", "Por cliente"), order.key / Math.max(order.random, 0.01), pct(order.key)]],
  },
  crash: (() => {
    const top = Math.max(crash.after.duplicates, crash.before.lost, 1);
    return {
      verdict: t(`About ${n0(crash.after.crashes)} crashes in 2 minutes. Commit after processing: ${n0(crash.after.duplicates)} records read twice, ${n0(crash.after.lost)} lost. Commit before: ${n0(crash.before.duplicates)} read twice, ${n0(crash.before.lost)} lost.`,
        `Unas ${n0(crash.after.crashes)} caídas en 2 minutos. Commit después de procesar: ${n0(crash.after.duplicates)} registros leídos dos veces, ${n0(crash.after.lost)} perdidos. Commit antes: ${n0(crash.before.duplicates)} leídos dos veces, ${n0(crash.before.lost)} perdidos.`),
      bars: [[t("After · read twice", "Después · leídos 2 veces"), crash.after.duplicates / top, n0(crash.after.duplicates), true], [t("After · lost", "Después · perdidos"), crash.after.lost / top, n0(crash.after.lost)], [t("Before · read twice", "Antes · leídos 2 veces"), crash.before.duplicates / top, n0(crash.before.duplicates)], [t("Before · lost", "Antes · perdidos"), crash.before.lost / top, n0(crash.before.lost), true]],
    };
  })(),
  group: (() => {
    const top = 480;
    return {
      verdict: t(`Read per minute: ${n0(group.three.perMinute)} with 3 consumers, ${n0(group.six.perMinute)} with 6, while 480 arrive. With 6, ${n0(group.six.idle)} consumers have no track.`,
        `Leídos por minuto: ${n0(group.three.perMinute)} con 3 consumidores, ${n0(group.six.perMinute)} con 6, mientras llegan 480. Con 6, ${n0(group.six.idle)} consumidores no tienen vía.`),
      bars: [[t("Arriving", "Llegan"), 1, "480"], [t("3 consumers", "3 consumidores"), group.three.perMinute / top, n0(group.three.perMinute)], [t("6 consumers", "6 consumidores"), group.six.perMinute / top, n0(group.six.perMinute), true]],
    };
  })(),
  hot: (() => {
    const top = Math.max(...hot, 1);
    const hotTrack = hot.indexOf(Math.max(...hot));
    return {
      verdict: t(`Lag after a minute, per track: ${hot.map((x) => n0(x)).join(" · ")} with a hot customer (A is on track ${hotTrack + 1}), against ${even.map((x) => n0(x)).join(" · ")} when customers are even.`,
        `Lag después de un minuto, por vía: ${hot.map((x) => n0(x)).join(" · ")} con un cliente caliente (A está en la vía ${hotTrack + 1}), contra ${even.map((x) => n0(x)).join(" · ")} cuando los clientes están parejos.`),
      bars: hot.map((x, i) => [t("Track " + (i + 1) + (i === hotTrack ? " (A)" : ""), "Vía " + (i + 1) + (i === hotTrack ? " (A)" : "")), x / top, n0(x), i === hotTrack]),
    };
  })(),
  replay: {
    verdict: t(`Keeping everything: ${n0(replay.all.correct)} of 6 totals right after replaying ${n0(replay.all.kept)} records. Keeping 20 s: ${n0(replay.short.correct)} of 6, from only ${n0(replay.short.kept)} of ${n0(replay.short.produced)} records.`,
      `Guardando todo: ${n0(replay.all.correct)} de 6 totales correctos tras volver a leer ${n0(replay.all.kept)} registros. Guardando 20 s: ${n0(replay.short.correct)} de 6, a partir de solo ${n0(replay.short.kept)} de ${n0(replay.short.produced)} registros.`),
    bars: [[t("Keep everything", "Guardar todo"), replay.all.correct / 6, t(n0(replay.all.correct) + " of 6", n0(replay.all.correct) + " de 6"), true], [t("Keep 20 s", "Guardar 20 s"), replay.short.correct / 6, t(n0(replay.short.correct) + " of 6", n0(replay.short.correct) + " de 6")]],
  },
};

export default defineLesson({
  title: t("Kafka Log Workbench", "Banco de trabajo: log de Kafka"),
  eyebrow: t("Systems lesson 20 · Logs and offsets", "Lección de sistemas 20 · Logs y offsets"),
  lede: t("A log keeps records in the order they arrive and doesn't delete them when they are read; each consumer group keeps a bookmark instead. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.", "Un log guarda los registros en el orden en que llegan y no los borra cuando se leen; en cambio, cada grupo de consumidores (consumer group) guarda un marcador. Esta lección construye esa idea de tres maneras: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Tracks are partitions, cars are records, and the bookmark posts are committed offsets. Crash a consumer, add consumers, make one customer hot, or rewind the bookmarks and rebuild.", "Las vías son particiones, los vagones son registros y los postes de marcador son offsets confirmados. Tumba un consumidor, agrega consumidores, haz que un cliente sea caliente o rebobina los marcadores y reconstruye."),
    plate: {
      title: t("Rail yard", "Patio de maniobras"),
      keys: [
        { mark: "lit", label: t("The record being read", "El registro que se está leyendo") },
        { mark: "raised", label: t("Car: a record; plate = offset, roof dots = customer A–F", "Vagón: un registro; placa = offset, puntos en el techo = cliente A–F") },
        { mark: "flat", label: t("Gantry board = committed offset · counter over the door = lag", "Tablero del pórtico = offset confirmado · contador sobre la puerta = lag") },
      ],
      caption:
        t("Each track is a partition. The transfer table couples every new car (record) to the near end of one track; older cars roll back into the archive shed, where they are kept. Each numbered reading cabin is a consumer; an overhead wire runs from its mast to the bookmark gantry on every track it owns, and the gantry's board shows the committed offset: the next car the group still has to read. The counter above each shed door shows that track's lag: the cars past its bookmark. A line on a car's roof means it has been read. Reading never removes a car.", "Cada vía es una partición. El carro transbordador engancha cada vagón nuevo (registro) al extremo cercano de una vía; los vagones más viejos retroceden hacia el cobertizo de archivo, donde se guardan. Cada cabina de lectura numerada es un consumidor; un cable aéreo va de su mástil al pórtico del marcador en cada vía que le pertenece, y el tablero del pórtico muestra el offset confirmado: el siguiente vagón que el grupo todavía tiene que leer. El contador sobre cada puerta del cobertizo muestra el lag de esa vía: los vagones que quedan después de su marcador. Una línea en el techo de un vagón significa que ya se leyó. Leer nunca quita un vagón."),
      stage: { "data-office": "" },
      label: t("Rail yard simulation of a Kafka-style log. Space pauses or resumes.", "Simulación de un log estilo Kafka como patio de maniobras. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["produced", t("Produced", "Producidos")], ["processed", t("Read", "Leídos")], ["lag", "Lag"], ["duplicates", t("Read twice", "Leídos 2 veces")], ["lost", t("Lost", "Perdidos")], ["order", t("Out of order", "Fuera de orden")]],
    controls: [
      { seg: "partitions", label: t("Tracks (partitions)", "Vías (particiones)"), options: [[2, "2"], [3, "3"], [4, "4"]], value: 3 },
      { seg: "consumers", label: t("Consumers in the group", "Consumidores en el grupo"), options: [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [6, "6"]], value: 3 },
      { seg: "keying", label: t("Records keyed", "Clave del registro"), options: [["random", t("No key", "Sin clave")], ["key", t("By customer", "Por cliente")], ["hot", t("Hot customer", "Cliente caliente")]], value: "key" },
      { seg: "commit", label: "Commit", options: [["after", t("After processing", "Después de procesar")], ["before", t("Before processing", "Antes de procesar")]], value: "after" },
      { seg: "rate", label: t("Producer", "Productor"), options: [[2, "2/s"], [4, "4/s"], [8, "8/s"]], value: 4 },
      { seg: "retention", label: t("Log keeps", "El log guarda"), options: [[0, t("Everything", "Todo")], [20, t("Last 20 s", "Últimos 20 s")]], value: 0 },
      { speed: true },
      { actions: [["crash", t("Crash consumer 1", "Tumbar el consumidor 1")], ["rewind", t("Rewind and rebuild", "Rebobinar y reconstruir")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again with empty tracks. Consumer 1 is the leftmost cabin.", "Cambiar un ajuste reinicia la ejecución con las vías vacías. El consumidor 1 es la cabina de más a la izquierda."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre seis ejecuciones con semilla fija."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css: `
.door{fill:var(--anatomy-shade-0);stroke:none}
.shutter{fill:var(--anatomy-lo);stroke:none}
.window{fill:var(--anatomy-shade-0);stroke:none}
.cable{fill:none;stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);stroke-linecap:round;stroke-linejoin:round}
[data-track][data-off],[data-cabin][data-off]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
    CAR_SVG: carSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
