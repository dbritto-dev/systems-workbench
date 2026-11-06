// @ts-nocheck: content in the style of the other lessons
// Systems lesson 59 · Quorums: a row of five vaults, the replicas of one record, and the coordinator's desk in front.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, slipSvg, P, GEOMETRY } from "./figure";
import { oneRun, overlapRun, downRun, slowRun, backRun, NET, PROC, BUSY, SLOW_E, READ_GAP, SEEDS, RUN_MS } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds of twenty seconds each).
const R = { one: oneRun(), overlap: overlapRun(), down: downRun(), slow: slowRun(), back: backRun() };

const ms = (x) => x.toFixed(1) + " ms";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const per1000 = (x) => (1000 * x).toFixed(1);
const range = ([a, b]) => a.toFixed(1) + "–" + (a + b).toFixed(1) + " ms";
const BUSY_RANGE = BUSY.extra[0] + "–" + (BUSY.extra[0] + BUSY.extra[1]) + " ms";
const BUSY_SHARE = t("a third", "un tercio");

// What each card shows after a run.
const RUNS = {
  one: () => {
    const { one, quorum } = R.one, m = top(one.rbStale, 0.01);
    return {
      verdict: t("With R = W = 1, " + pct(one.rbStale) + " of read-backs returned the version from before the write, with all five replicas up. With R = W = 3, " + pct(quorum.rbStale) + ".",
        "Con R = W = 1, el " + pct(one.rbStale) + " de las relecturas devolvió la versión de antes de la escritura, con las cinco réplicas arriba. Con R = W = 3, el " + pct(quorum.rbStale) + "."),
      bars: [[t("R = 1, W = 1 (ONE)", "R = 1, W = 1 (ONE)"), one.rbStale / m, pct(one.rbStale), true], [t("R = 3, W = 3 (QUORUM)", "R = 3, W = 3 (QUORUM)"), quorum.rbStale / m, pct(quorum.rbStale)]],
    };
  },
  overlap: () => {
    const { w2, w3, r3 } = R.overlap, m = top(w2.rbStale, 0.01);
    return {
      verdict: t("Stale read-backs: " + pct(w2.rbStale) + " with R = W = 2, " + pct(w3.rbStale) + " with W = 3 and R = 2 (R + W = N), " + pct(r3.rbStale) + " with R = W = 3.",
        "Relecturas viejas: " + pct(w2.rbStale) + " con R = W = 2, " + pct(w3.rbStale) + " con W = 3 y R = 2 (R + W = N), " + pct(r3.rbStale) + " con R = W = 3."),
      bars: [[t("R = 2, W = 2 (4 of 5)", "R = 2, W = 2 (4 de 5)"), w2.rbStale / m, pct(w2.rbStale)], [t("R = 2, W = 3 (5 of 5)", "R = 2, W = 3 (5 de 5)"), w3.rbStale / m, pct(w3.rbStale), true], [t("R = 3, W = 3 (6 of 5)", "R = 3, W = 3 (6 de 5)"), r3.rbStale / m, pct(r3.rbStale)]],
    };
  },
  down: () => {
    const { q1, q2, q3, all1 } = R.down;
    return {
      verdict: t("R = W = 3 with two replicas down: " + pct(q2.failW) + " of writes and " + pct(q2.failR) + " of reads failed, " + pct(q2.stale) + " of reads were stale, and the median write took " + ms(q2.w50) + " (" + ms(q1.w50) + " with one down). Three down: " + pct(q3.failW) + " of writes and " + pct(q3.failR) + " of reads failed. W = 5 with one down: " + pct(all1.failW) + " of writes failed.",
        "R = W = 3 con dos réplicas caídas: falló el " + pct(q2.failW) + " de las escrituras y el " + pct(q2.failR) + " de las lecturas, el " + pct(q2.stale) + " de las lecturas fueron viejas y la escritura mediana tardó " + ms(q2.w50) + " (" + ms(q1.w50) + " con una caída). Con tres caídas falló el " + pct(q3.failW) + " de las escrituras y el " + pct(q3.failR) + " de las lecturas. W = 5 con una caída: falló el " + pct(all1.failW) + " de las escrituras."),
      groups: [
        { title: t("Writes that failed", "Escrituras fallidas"), bars: [[t("W = 3, two down", "W = 3, dos caídas"), q2.failW, pct(q2.failW), true], [t("W = 3, three down", "W = 3, tres caídas"), q3.failW, pct(q3.failW)], [t("W = 5, one down", "W = 5, una caída"), all1.failW, pct(all1.failW)]] },
        { title: t("Stale reads, R = 3", "Lecturas viejas, R = 3"), bars: [[t("One down", "Una caída"), q1.stale, pct(q1.stale)], [t("Two down", "Dos caídas"), q2.stale, pct(q2.stale), true]] },
        { title: t("Median write, W = 3", "Escritura mediana, W = 3"), bars: [[t("One down", "Una caída"), q1.w50 / top(q2.w50), ms(q1.w50)], [t("Two down", "Dos caídas"), q2.w50 / top(q2.w50), ms(q2.w50), true]] },
      ],
    };
  },
  slow: () => {
    const { q, all, qSteady, allSteady } = R.slow, m = top(all.w99);
    return {
      verdict: t("Median write with E slow: " + ms(q.w50) + " at W = 3 (" + ms(qSteady.w50) + " with every replica steady), " + ms(all.w50) + " at W = 5 (" + ms(allSteady.w50) + " steady).",
        "Escritura mediana con E lenta: " + ms(q.w50) + " con W = 3 (" + ms(qSteady.w50) + " con todas las réplicas estables), " + ms(all.w50) + " con W = 5 (" + ms(allSteady.w50) + " estables)."),
      bars: [[t("W = 3, all steady", "W = 3, todas estables"), qSteady.w50 / m, ms(qSteady.w50)], [t("W = 3, E slow", "W = 3, E lenta"), q.w50 / m, ms(q.w50), true], [t("W = 5, all steady", "W = 5, todas estables"), allSteady.w50 / m, ms(allSteady.w50)], [t("W = 5, E slow", "W = 5, E lenta"), all.w50 / m, ms(all.w50)]],
    };
  },
  back: () => {
    const { off, on } = R.back, m = top(off.back, 0.001), mr = top(on.r99, off.r99);
    return {
      verdict: t("Without read repair, " + per1000(off.back) + " reads in 1,000 returned an older version than a read that had already returned; " + pct(off.stale) + " were stale. With blocking read repair, " + per1000(on.back) + " in 1,000, and the p99 read took " + ms(on.r99) + " instead of " + ms(off.r99) + ".",
        "Sin reparación en lectura, " + per1000(off.back) + " lecturas de cada 1,000 devolvieron una versión más vieja que una lectura que ya había respondido; el " + pct(off.stale) + " fueron viejas. Con reparación bloqueante, " + per1000(on.back) + " de cada 1,000, y la lectura p99 tardó " + ms(on.r99) + " en vez de " + ms(off.r99) + "."),
      groups: [
        { title: t("Reads that went back, per 1,000", "Lecturas que retrocedieron, cada 1,000"), bars: [[t("Read repair off", "Reparación apagada"), off.back / m, per1000(off.back), true], [t("Read repair on", "Reparación activa"), on.back / m, per1000(on.back)]] },
        { title: t("p99 read", "Lectura p99"), bars: [[t("Read repair off", "Reparación apagada"), off.r99 / mr, ms(off.r99)], [t("Read repair on", "Reparación activa"), on.r99 / mr, ms(on.r99), true]] },
      ],
    };
  },
};

const { one: O, overlap: V, down: D, slow: Z, back: B } = R;
const WATCH = (o) => ({ R: 2, W: 2, down: 0, repl: "busy", repair: "off", readers: "one", ...o });

const EXPERIMENTS = [
  {
    id: "one",
    title: t("Every replica healthy", "Todas las réplicas sanas"),
    change: t("Five replicas, none down · " + BUSY_SHARE.en + " of writes wait " + BUSY_RANGE + " at a replica before it applies them · the writer reads its write back as soon as it is acknowledged · R = W = 1 (Cassandra's ONE) vs R = W = 3 (QUORUM)",
      "Cinco réplicas, ninguna caída · " + BUSY_SHARE.es + " de las escrituras espera " + BUSY_RANGE + " en una réplica antes de aplicarse · el escritor vuelve a leer su escritura apenas se confirma · R = W = 1 (ONE en Cassandra) vs R = W = 3 (QUORUM)"),
    question: t("With R = W = 1, how often does that read-back return the version from before the write?", "Con R = W = 1, ¿qué tan seguido esa relectura devuelve la versión de antes de la escritura?"),
    options: [
      t("Never: no replica is down, so every copy is current", "Nunca: ninguna réplica está caída, así que todas las copias están al día"),
      t("Often: the replica it asks may not have applied it yet", "Seguido: la réplica a la que pregunta puede no haberla aplicado aún"),
      t("Only if the replica that acked the write fails next", "Solo si la réplica que confirmó la escritura falla después"),
    ],
    answer: 1,
    why: t(
      "W = 1 acknowledges the write as soon as one replica has applied it; R = 1 asks one replica, picked at random. Nothing makes them the same replica, so the read lands on a vault the write hasn't reached yet: " + pct(O.one.rbStale) + " of read-backs here, with all five up. A replica that is merely behind (a backlog of writes, a busy disk, a far zone) answers with what it has, and nothing reports an error. With R = W = 3, a majority of five on both sides, it happened in " + pct(O.quorum.rbStale) + ": any three replicas a read asks include at least one of the three that acknowledged. Stale reads here don't come from a failure; they come from the configuration.",
      "W = 1 confirma la escritura apenas una réplica la aplicó; R = 1 le pregunta a una réplica elegida al azar. Nada hace que sean la misma, así que la lectura cae en una bóveda a la que la escritura todavía no llegó: el " + pct(O.one.rbStale) + " de las relecturas aquí, con las cinco arriba. Una réplica que solo va atrasada (escrituras acumuladas por aplicar, un disco ocupado, una zona lejana) responde con lo que tiene, y nada reporta un error. Con R = W = 3, mayoría de cinco en ambos lados, pasó en el " + pct(O.quorum.rbStale) + ": cualquier trío de réplicas que consulte una lectura incluye al menos una de las tres que confirmaron. Aquí las lecturas viejas (stale reads) no vienen de una falla; vienen de la configuración.",
    ),
    watch: WATCH({ R: 1, W: 1, until: "stale" }),
  },
  {
    id: "overlap",
    title: t("Write to a majority", "Escribir en la mayoría"),
    change: t("The same busy replicas · W = 3, a majority of five · R = 2 vs R = 3, and R = W = 2 for comparison",
      "Las mismas réplicas ocupadas · W = 3, mayoría de cinco · R = 2 vs R = 3, y R = W = 2 para comparar"),
    question: t("With W = 3 and R = 2, can the read-back still be stale?", "Con W = 3 y R = 2, ¿la relectura todavía puede ser vieja?"),
    options: [
      t("No: a majority holds every acknowledged write", "No: una mayoría tiene cada escritura confirmada"),
      t("Yes, now and then: two can miss all three", "Sí, de vez en cuando: dos pueden esquivar a las tres"),
      t("Yes, about as often as with R = 1", "Sí, más o menos tan seguido como con R = 1"),
    ],
    answer: 1,
    why: t(
      "Overlap is a matter of counting. Any R replicas and any W replicas must share one only if R + W > N. Three written and two read make five, exactly N, so a read can ask the two vaults the write hasn't reached yet: " + pct(V.w3.rbStale) + " of read-backs here, against " + pct(V.w2.rbStale) + " with R = W = 2 and " + pct(V.r3.rbStale) + " with R = W = 3. A majority on the write side doesn't make up for a small read side; only the sum matters. At or below the line, staleness is a probability that depends on how far behind replicas fall, which is what Bailis and others measured as probabilistically bounded staleness (PBS, 2012).",
      "Solaparse es cuestión de contar. Cualquier grupo de R réplicas y cualquier grupo de W comparten una solo si R + W > N. Tres escritas y dos leídas suman cinco, justo N, así que una lectura puede preguntarles a las dos bóvedas a las que la escritura aún no llegó: el " + pct(V.w3.rbStale) + " de las relecturas aquí, contra " + pct(V.w2.rbStale) + " con R = W = 2 y " + pct(V.r3.rbStale) + " con R = W = 3. Una mayoría del lado de la escritura no compensa un lado de lectura pequeño; solo importa la suma. En la línea o por debajo, la lectura vieja es una probabilidad que depende de cuánto se atrasan las réplicas, lo que Bailis y otros midieron como obsolescencia acotada probabilísticamente (probabilistically bounded staleness, PBS, 2012).",
    ),
    watch: WATCH({ R: 2, W: 3, until: "stale" }),
  },
  {
    id: "down",
    title: t("Replicas go down", "Se caen réplicas"),
    change: t("R = W = 3 · one, two, then three of the five replicas down (the coordinator knows which) · and W = 5 (ALL) with R = 1, one down",
      "R = W = 3 · una, dos y luego tres de las cinco réplicas caídas (el coordinador sabe cuáles) · y W = 5 (ALL) con R = 1, una caída"),
    question: t("With R = W = 3 and two of the five replicas down, what happens?", "Con R = W = 3 y dos de las cinco réplicas caídas, ¿qué pasa?"),
    options: [
      t("Writes fail: a quorum needs a spare replica", "Las escrituras fallan: un quórum necesita una réplica de sobra"),
      t("Both still work, and reads stay fresh", "Las dos siguen funcionando y las lecturas siguen al día"),
      t("Writes work, but reads can come back stale", "Las escrituras funcionan, pero las lecturas pueden volver viejas"),
    ],
    answer: 1,
    why: t(
      "Three of five tolerates two down. With exactly three live, every write needs all three acks and every read asks all three, so they always meet: " + pct(D.q2.failW) + " failed writes, " + pct(D.q2.stale) + " stale reads. The price is slack: a write now waits for the slowest live replica, and the median went from " + ms(D.q1.w50) + " with one down to " + ms(D.q2.w50) + " with two. Take a third down and " + pct(D.q3.failW) + " of writes and " + pct(D.q3.failR) + " of reads fail. W = 5 (ALL) has no slack at all: one replica down and " + pct(D.all1.failW) + " of writes fail, while the R = 1 reads go on returning the last version written. Like Cassandra, which answers UnavailableException, the coordinator here refuses at once when it knows too few replicas are up. The vaults that were down missed writes: when they return, hinted handoff, read repair or an anti-entropy repair must bring them up to date.",
      "Tres de cinco tolera dos caídas. Con exactamente tres vivas, cada escritura necesita las tres confirmaciones y cada lectura les pregunta a las tres, así que siempre se encuentran: " + pct(D.q2.failW) + " de escrituras fallidas, " + pct(D.q2.stale) + " de lecturas viejas. El precio es el margen: una escritura ahora espera a la réplica viva más lenta, y la mediana pasó de " + ms(D.q1.w50) + " con una caída a " + ms(D.q2.w50) + " con dos. Si cae una tercera, falla el " + pct(D.q3.failW) + " de las escrituras y el " + pct(D.q3.failR) + " de las lecturas. W = 5 (ALL) no tiene ningún margen: con una réplica caída falla el " + pct(D.all1.failW) + " de las escrituras, mientras las lecturas con R = 1 siguen devolviendo la última versión escrita. Como Cassandra, que responde UnavailableException, el coordinador aquí rechaza de inmediato cuando sabe que hay muy pocas réplicas arriba. Las bóvedas que estuvieron caídas se perdieron escrituras: cuando vuelven, la entrega diferida (hinted handoff), la reparación en lectura (read repair) o una reparación anti-entropía tienen que ponerlas al día.",
    ),
    watch: WATCH({ R: 3, W: 3, down: 2 }),
  },
  {
    id: "slow",
    title: t("One slow replica", "Una réplica lenta"),
    change: t("Every replica steady except E, which applies every write " + SLOW_E + " ms late · W = 3 vs W = 5",
      "Todas las réplicas estables salvo E, que aplica cada escritura " + SLOW_E + " ms tarde · W = 3 vs W = 5"),
    question: t("With W = 3, how much does slow E add to a write's latency?", "Con W = 3, ¿cuánto le suma la lenta E a la latencia de una escritura?"),
    options: [
      t("About " + SLOW_E + " ms: a write waits for every copy", "Unos " + SLOW_E + " ms: una escritura espera todas las copias"),
      t("Almost nothing: it waits for the third ack", "Casi nada: espera la tercera confirmación"),
      t(SLOW_E + " ms on the writes that go to E", SLOW_E + " ms en las escrituras que van a E"),
    ],
    answer: 1,
    why: t(
      "The coordinator sends every write to all five replicas and answers after W acks, so a write's latency is the W-th fastest ack. At W = 3 the two slowest never count: the median was " + ms(Z.q.w50) + " with E slow and " + ms(Z.qSteady.w50) + " with every replica steady. At W = 5 the write waits for E every time: " + ms(Z.all.w50) + ", against " + ms(Z.allSteady.w50) + ". E still gets every write, later. Reads work the same way: the more replies they wait for, the more often one slow replica decides. Cassandra sends a read to only R replicas, steers it away from slow ones with its dynamic snitch, and by default sends one extra request when a reply is slower than the table's 99th percentile (speculative retry).",
      "El coordinador manda cada escritura a las cinco réplicas y responde tras W confirmaciones, así que la latencia de una escritura es la W-ésima confirmación más rápida. Con W = 3 las dos más lentas nunca cuentan: la mediana fue " + ms(Z.q.w50) + " con E lenta y " + ms(Z.qSteady.w50) + " con todas estables. Con W = 5 la escritura espera a E siempre: " + ms(Z.all.w50) + ", contra " + ms(Z.allSteady.w50) + ". E igual recibe cada escritura, más tarde. Las lecturas funcionan igual: cuantas más respuestas esperan, más seguido decide una réplica lenta. Cassandra manda una lectura solo a R réplicas, la aleja de las lentas con su dynamic snitch y, por defecto, manda una solicitud extra cuando una respuesta tarda más que el percentil 99 de la tabla (reintento especulativo, speculative retry).",
    ),
    watch: WATCH({ R: 3, W: 3, repl: "slow" }),
  },
  {
    id: "back",
    title: t("A read after a read", "Una lectura tras otra"),
    change: t("R = W = 3 · busy replicas · other clients read at random moments (every " + READ_GAP + " ms on average), also while writes are in flight · read repair off vs on (blocking)",
      "R = W = 3 · réplicas ocupadas · otros clientes leen en momentos al azar (cada " + READ_GAP + " ms en promedio), también mientras hay escrituras en vuelo · reparación en lectura apagada vs activa (bloqueante)"),
    question: t("R + W > N, read repair off. Can a read return an older version than a read that had already returned before it began?", "R + W > N, reparación en lectura apagada. ¿Puede una lectura devolver una versión más vieja que otra lectura que ya había respondido antes de que empezara?"),
    options: [
      t("No: quorums overlap, so reads only move forward", "No: los quórums se solapan, así que las lecturas solo avanzan"),
      t("Yes, while a write is on fewer than W replicas", "Sí, mientras una escritura está en menos de W réplicas"),
      t("Only while a replica is down and missing writes", "Solo mientras una réplica está caída y le faltan escrituras"),
    ],
    answer: 1,
    why: t(
      "R + W > N promises that a read meets every acknowledged write. A write still in flight may be on one or two vaults: a read that happens to ask one of them returns the new version, and the next read, asking three others, returns the old one, which is not even stale, since nothing has acknowledged the new version yet: " + per1000(B.off.back) + " reads in 1,000 here, " + pct(B.off.stale) + " stale. Blocking read repair closes it: when the replies disagree, the coordinator writes the newest version to the replicas that answered with an older one and replies only after they ack, so what it returned is on three replicas and every later quorum read meets it: " + per1000(B.on.back) + " in 1,000. Waiting for those acks is the cost: the p99 read went from " + ms(B.off.r99) + " to " + ms(B.on.r99) + ". It's Cassandra's default (read_repair = 'BLOCKING'). Even so, quorums alone don't make a store linearizable: Cassandra's lightweight transactions add a Paxos round for that.",
      "R + W > N promete que una lectura se encuentra con cada escritura confirmada. Una escritura todavía en vuelo puede estar en una o dos bóvedas: una lectura que justo le pregunta a una de ellas devuelve la versión nueva, y la siguiente, que pregunta a otras tres, devuelve la vieja, que ni siquiera cuenta como lectura vieja, porque nada confirmó todavía la versión nueva: " + per1000(B.off.back) + " lecturas de cada 1,000 aquí, el " + pct(B.off.stale) + " viejas. La reparación en lectura bloqueante lo cierra: cuando las respuestas no coinciden, el coordinador escribe la versión más nueva en las réplicas que respondieron con una más vieja y responde solo después de que confirman, así que lo que devolvió está en tres réplicas y cada lectura de quórum posterior se lo encuentra: " + per1000(B.on.back) + " de cada 1,000. Esperar esas confirmaciones es el costo: la lectura p99 pasó de " + ms(B.off.r99) + " a " + ms(B.on.r99) + ". Es el comportamiento por defecto de Cassandra (read_repair = 'BLOCKING'). Aun así, los quórums solos no hacen linealizable (linearizable) un almacén: las transacciones livianas (lightweight transactions) de Cassandra agregan una ronda de Paxos para eso.",
    ),
    watch: WATCH({ R: 3, W: 3, readers: "many", until: "back" }),
  },
];

const QUESTIONS = [
  [t("In one or two sentences, why does R + W > N make every read see the latest acknowledged write?", "En una o dos oraciones, ¿por qué R + W > N hace que cada lectura vea la última escritura confirmada?"),
   t("The W replicas that acknowledged the write and the R replicas the read asks are two groups drawn from the same N. If R + W > N they can't be disjoint, so at least one replica the read asks has the write, and keeping the highest version returns it. It's counting, not health: it holds for any choice of replicas, and fails as soon as the sum drops to N.",
     "Las W réplicas que confirmaron la escritura y las R a las que pregunta la lectura son dos grupos tomados de las mismas N. Si R + W > N no pueden ser disjuntos, así que al menos una réplica consultada tiene la escritura, y quedarse con la versión más alta la devuelve. Es contar, no salud: vale para cualquier elección de réplicas, y deja de valer en cuanto la suma baja a N.")],
  [t("A Cassandra table has replication factor 3. What do ONE, QUORUM and ALL mean, and which pairs of write and read levels give R + W > N?", "Una tabla de Cassandra tiene factor de replicación 3. ¿Qué significan ONE, QUORUM y ALL, y qué pares de niveles de escritura y lectura dan R + W > N?"),
   t("ONE waits for one replica, QUORUM for a majority (two of three), ALL for all three. QUORUM writes with QUORUM reads (2 + 2 > 3), ALL with ONE and ONE with ALL all overlap; ONE with ONE or ONE with QUORUM don't. With several data centers, LOCAL_QUORUM counts only the local data center's replicas, so it overlaps only with reads in the same one.",
     "ONE espera una réplica, QUORUM una mayoría (dos de tres), ALL las tres. Escrituras QUORUM con lecturas QUORUM (2 + 2 > 3), ALL con ONE y ONE con ALL se solapan; ONE con ONE o ONE con QUORUM no. Con varios centros de datos, LOCAL_QUORUM cuenta solo las réplicas del centro de datos local, así que solo se solapa con lecturas en ese mismo.")],
  [t("Reads at ONE sometimes miss a write the same user made a moment ago, yet every node is up and healthy. What is going on, and what are your options?", "Las lecturas en ONE a veces no ven una escritura que el mismo usuario hizo hace un momento, aunque todos los nodos están arriba y sanos. ¿Qué pasa y qué opciones tienes?"),
   t("The write was acknowledged by one replica and the read went to another that hadn't applied it yet: replicas fall behind under load, compaction or a slow link, and that isn't a failure anyone reports. Options: read and write at QUORUM on the paths that need read-your-writes; write at ALL and read at ONE if writes are rare and you accept losing write availability when one replica is down; or keep ONE where a slightly old value is fine. Lesson 60, Replication Lag, covers the same symptom with a leader and followers.",
     "La escritura la confirmó una réplica y la lectura fue a otra que todavía no la había aplicado: las réplicas se atrasan con carga, compactación o un enlace lento, y eso no es una falla que alguien reporte. Opciones: leer y escribir en QUORUM en las rutas que necesitan leer tus propias escrituras; escribir en ALL y leer en ONE si las escrituras son raras y aceptas perder disponibilidad de escritura con una réplica caída; o dejar ONE donde un valor un poco viejo está bien. La lección 60, Retraso de replicación, trata el mismo síntoma con un líder y seguidores.")],
  [t("With N = 5, compare R = 1, W = 5 with R = W = 3 and R = 5, W = 1. What does each give, and what does it give up?", "Con N = 5, compara R = 1, W = 5 con R = W = 3 y R = 5, W = 1. ¿Qué da cada una y a qué renuncia?"),
   t("All three overlap. A write survives N − W replicas down and a read N − R. R = 1, W = 5 makes reads cheap and fast, but one replica down stops every write and the slowest replica sets every write's latency. R = 5, W = 1 is the mirror: cheap writes, and one replica down stops every read. R = W = 3 tolerates two down on both sides and waits for the third fastest reply, which is why majority quorums are the usual default.",
     "Las tres se solapan. Una escritura soporta N − W réplicas caídas y una lectura N − R. R = 1, W = 5 hace las lecturas baratas y rápidas, pero una réplica caída detiene todas las escrituras y la réplica más lenta marca la latencia de cada una. R = 5, W = 1 es el espejo: escrituras baratas, y una réplica caída detiene todas las lecturas. R = W = 3 tolera dos caídas en ambos lados y espera la tercera respuesta más rápida, por eso los quórums de mayoría son lo habitual.")],
  [t("Name three ways a store with R + W > N can still return something other than the latest value.", "Nombra tres formas en que un almacén con R + W > N igual puede devolver algo distinto del último valor."),
   t("Writes in flight: before a write reaches W replicas, reads can see it and then not see it (this lesson's last experiment) unless read repair blocks. Failed writes: a write that timed out or failed may still be applied on some replicas and show up in later reads, since nothing rolls it back. Concurrent writes to the same key are settled by timestamps, so clock skew can make the later one lose (lesson 61, Clocks & Last-Write-Wins). And sloppy quorums, as in Dynamo or Riak, accept writes on fallback nodes outside the key's home replicas while some are unreachable, so a read quorum of home replicas may not include them.",
     "Escrituras en vuelo: antes de que una escritura llegue a W réplicas, las lecturas pueden verla y después no verla (el último experimento de esta lección) salvo que la reparación en lectura sea bloqueante. Escrituras fallidas: una escritura que agotó el tiempo o falló puede quedar aplicada en algunas réplicas y aparecer en lecturas posteriores, porque nada la deshace. Escrituras concurrentes sobre la misma clave se resuelven por marcas de tiempo, así que el desfase de relojes puede hacer perder a la más tardía (lección 61, Relojes y última escritura gana). Y los quórums laxos (sloppy quorums), como en Dynamo o Riak, aceptan escrituras en nodos de reemplazo fuera de las réplicas propias de la clave mientras algunas no responden, así que un quórum de lectura de las réplicas propias puede no incluirlos.")],
  [t("A replica was down for an hour and comes back. How does it catch up, and what do reads see meanwhile?", "Una réplica estuvo caída una hora y vuelve. ¿Cómo se pone al día y qué ven las lecturas mientras tanto?"),
   t("Three mechanisms. Hinted handoff: the coordinators kept the writes it missed and replay them (Cassandra keeps hints for max_hint_window, three hours by default). Read repair: a read that touches it and sees an older version fixes that key, but only keys someone reads, and not at ONE. Anti-entropy repair compares replicas with Merkle trees and fixes the rest (nodetool repair in Cassandra, which should run within gc_grace_seconds, ten days by default, or deleted data can come back). Meanwhile quorum reads stay fresh, because the returning replica is outvoted; reads at ONE that land on it can be stale. Which nodes hold the key in the first place is lesson 07, Consistent hashing.",
     "Tres mecanismos. Entrega diferida (hinted handoff): los coordinadores guardaron las escrituras que se perdió y se las reenvían (Cassandra guarda las pistas durante max_hint_window, tres horas por defecto). Reparación en lectura: una lectura que la toca y ve una versión más vieja arregla esa clave, pero solo las claves que alguien lee, y no en ONE. La reparación anti-entropía compara réplicas con árboles de Merkle y arregla el resto (nodetool repair en Cassandra, que debería correr dentro de gc_grace_seconds, diez días por defecto, o datos borrados pueden reaparecer). Mientras tanto, las lecturas de quórum siguen al día, porque la réplica que vuelve queda en minoría; las lecturas en ONE que caen en ella pueden ser viejas. Qué nodos guardan la clave en primer lugar es la lección 07, Hashing consistente.")],
];

export default defineLesson({
  title: t("Quorums Workbench", "Banco de trabajo: quórums"),
  eyebrow: t("Systems lesson 59 · Quorums", "Lección de sistemas 59 · Quórums"),
  lede: t("A quorum store keeps N copies of each record, waits for W of them to acknowledge a write and asks R of them on a read. When R + W > N every read meets the latest acknowledged write; at or below that line a read can miss it with every replica healthy. This lesson turns it into a row of five vaults and a coordinator's desk: watch it, predict what breaks it, then explain it back.",
    "Un almacén de quórum guarda N copias de cada registro, espera que W de ellas confirmen una escritura y les pregunta a R en una lectura. Cuando R + W > N, cada lectura se encuentra con la última escritura confirmada; en esa línea o por debajo, una lectura puede perdérsela con todas las réplicas sanas. Esta lección lo convierte en una fila de cinco bóvedas y el escritorio de un coordinador: míralo, predice qué lo rompe y después explícalo."),
  machine: {
    intro: t("Each write goes out on all five tracks, and the desk answers OK after W acks; each read asks R vaults, picked at random, and keeps the highest version. A lit door holds the newest version written. Change R and W, take vaults down, slow them, turn on read repair, or send a write or a read yourself.",
      "Cada escritura sale por las cinco vías y el escritorio responde OK tras W confirmaciones (acks); cada lectura les pregunta a R bóvedas elegidas al azar y se queda con la versión más alta. Una puerta encendida tiene la versión más nueva escrita. Cambia R y W, tumba bóvedas, hazlas lentas, activa la reparación en lectura o manda tú una escritura o una lectura."),
    plate: {
      title: t("Vault row", "Fila de bóvedas"),
      keys: [
        { mark: "lit", label: t("The newest version written: a vault door that holds it, a write slip that carries it", "La versión más nueva escrita: la puerta de una bóveda que la tiene, una papeleta de escritura que la lleva") },
        { mark: "raised", label: t("Slips: writes (vN) and their acks (ACK), reads (GET) and what they found (GOT vN)", "Papeletas: escrituras (vN) y sus acks (ACK), lecturas (GET) y lo que encontraron (VIO vN)") },
        { mark: "flat", label: t("Tracks from the coordinator's desk to each vault", "Vías del escritorio del coordinador a cada bóveda") },
      ],
      caption: t(
        "Played 400 times slower than real time (change it under Speed). Times are illustrative and round, for replicas in one region: each network leg takes " + range(NET) + " and a replica " + range(PROC) + " of work. Busy: a third of writes wait " + BUSY_RANGE + " more at a vault before it applies them, while reads are answered at once from what it holds. E slow: E applies every write " + SLOW_E + " ms late. A read is stale when it returns less than LAST OK at the moment it began, and goes back when it returns less than a read that had already returned. The desk counts acknowledged writes (OK), writes and reads that couldn't get W or R live replicas (FAILED), stale reads (STALE) and reads that went back (WENT BACK).",
        "Se reproduce 400 veces más lento que el tiempo real (cámbialo en Velocidad). Los tiempos son ilustrativos y redondos, para réplicas en una región: cada tramo de red tarda " + range(NET) + " y una réplica " + range(PROC) + " de trabajo. Ocupadas: un tercio de las escrituras espera " + BUSY_RANGE + " más en una bóveda antes de aplicarse, mientras las lecturas se responden al instante con lo que tiene. E lenta: E aplica cada escritura " + SLOW_E + " ms tarde. Una lectura es vieja cuando devuelve menos que ÚLTIMO OK en el momento en que empezó, y retrocede cuando devuelve menos que una lectura que ya había respondido. El escritorio cuenta las escrituras confirmadas (OK), las escrituras y lecturas que no consiguieron W o R réplicas vivas (FALLIDAS), las lecturas viejas (VIEJAS) y las que retrocedieron (RETROCEDIERON).",
      ),
      stage: { "data-vault-row": "" },
      label: t("Quorum simulation. Space pauses or resumes.", "Simulación de quórums. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["ok", t("Writes OK", "Escrituras OK")],
      ["failed", t("Failed", "Fallidas")],
      ["stale", t("Stale reads", "Lecturas viejas"), "0"],
      ["back", t("Went back", "Retrocedieron")],
      ["wlat", t("Write → OK", "Escritura → OK"), "–"],
      ["rlat", t("Read", "Lectura"), "–"],
    ],
    controls: [
      { seg: "W", label: t("W (write acks)", "W (acks de escritura)"), options: [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]], value: 2 },
      { seg: "R", label: t("R (replicas read)", "R (réplicas leídas)"), options: [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]], value: 2 },
      { seg: "down", label: t("Down", "Caídas"), options: [[0, t("None", "Ninguna")], [1, "E"], [2, "D, E"], [3, "C, D, E"]], value: 0 },
      { seg: "repl", label: t("Replicas", "Réplicas"), options: [["steady", t("Steady", "Estables")], ["busy", t("Busy", "Ocupadas")], ["slow", t("E slow", "E lenta")]], value: "busy" },
      { seg: "repair", label: t("Read repair", "Reparación en lectura"), options: [["off", t("Off", "Apagada")], ["on", t("On (blocking)", "Activa (bloqueante)")]], value: "off" },
      { seg: "readers", label: t("Readers", "Lectores"), options: [["one", t("Just the writer", "Solo el escritor")], ["many", t("Many", "Muchos")]], value: "one" },
      { speed: true, options: [[0.001, "1/1000"], [0.0025, "1/400"], [0.006, "1/150"]], value: 0.0025 },
      { actions: [["write", t("Write", "Escribir"), { primary: true }], ["read", t("Read", "Leer")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. The writer writes, reads its write back once it's acknowledged, and writes again a few ms later; Write and Read add your own.",
      "Cambiar un ajuste reinicia la ejecución. El escritor escribe, vuelve a leer su escritura cuando se confirma y escribe otra vez unos ms después; Escribir y Leer agregan las tuyas."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs of " + RUN_MS / 1000 + " seconds of traffic each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija de " + RUN_MS / 1000 + " segundos de tráfico cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. N, R and W follow the Dynamo paper (DeCandia et al., 2007); consistency levels and read repair follow the Apache Cassandra documentation.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. N, R y W siguen el artículo de Dynamo (DeCandia et al., 2007); los niveles de consistencia y la reparación en lectura siguen la documentación de Apache Cassandra.`),
  css: LIT_FILL_CSS + `
[data-slip-text]{font-weight:600}
`,
  data: { P, G: GEOMETRY, SLIP_SVG: slipSvg() },
});
