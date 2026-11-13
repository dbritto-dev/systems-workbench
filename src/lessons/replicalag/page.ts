// @ts-nocheck: content in the style of the other lessons
// Systems lesson 60 · Replication lag: a main ledger and two copy desks fed by conveyors, and what a crash of the
// main ledger loses.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, msFromSecs } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, slipSvg, P, GEOMETRY } from "./figure";
import { moveRun, rywRun, slowRun, burstRun, loseRun, NET, APPLY, BACK, QUICK, WINDOW, BURST, BURST_EVERY, OTHERS, USERS, LOCAL, CRASHES } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds of ten minutes each).
const R = { move: moveRun(), ryw: rywRun(), slow: slowRun(), burst: burstRun(), lose: loseRun() };

const ms = (x) => msFromSecs(x);
const s1 = (x) => x.toFixed(1) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const range = ([a, b]) => Math.round(1000 * a) + "–" + Math.round(1000 * (a + b)) + " ms";
const per = (x) => (x === 0 ? "0" : x < 10 ? x.toFixed(1) : String(Math.round(x)));
const BACK_RANGE = range(BACK);
const QUICK_RANGE = range(QUICK.gap);
const APPLY_RATE = Math.round(1 / APPLY.healthy);
const B_TRIP = Math.round(2000 * NET.slow[0]) + "–" + Math.round(2000 * (NET.slow[0] + NET.slow[1])) + " ms";

// What each card shows after a run.
const RUNS = {
  move: () => {
    const { leader, any } = R.move, m = top(any.miss);
    return {
      verdict: t("Reads from the leader: " + pct(leader.miss) + " of read-backs missed the user's save. Reads spread over the followers: " + pct(any.miss) + ", with healthy followers that applied each write " + ms(any.delay) + " after its commit on average. Over every read by a user who had saved something, " + pct(any.own) + " missed it.",
        "Lecturas del líder: el " + pct(leader.miss) + " de las lecturas tras guardar no tenía lo guardado. Lecturas repartidas entre las réplicas: el " + pct(any.miss) + ", con réplicas sanas que aplicaban cada escritura " + ms(any.delay) + " después de su commit en promedio. Sobre todas las lecturas de usuarios que ya habían guardado algo, faltó en el " + pct(any.own) + "."),
      bars: [[t("Read-backs missing the save, leader", "Lecturas tras guardar sin lo guardado, líder"), leader.miss / m, pct(leader.miss)], [t("Read-backs missing the save, followers", "Lecturas tras guardar sin lo guardado, réplicas"), any.miss / m, pct(any.miss), true], [t("Any read missing the user's save, followers", "Cualquier lectura sin lo guardado, réplicas"), any.own / m, pct(any.own)]],
    };
  },
  sticky: () => {
    const { any, sticky, window } = R.ryw, m = top(any.miss, sticky.miss), mq = top(any.quick, 0.01);
    return {
      verdict: t("Read-backs missing the user's save: " + pct(any.miss) + " with reads to any follower, " + pct(sticky.miss) + " stuck to one follower, " + pct(window.miss) + " reading from the leader for " + WINDOW + " s after a save, which sent " + pct(window.leader) + " of all reads to the leader. Quick second reads that showed less than the read before: " + pct(any.quick) + ", " + pct(sticky.quick) + " and " + pct(window.quick) + ".",
        "Lecturas tras guardar sin lo guardado: el " + pct(any.miss) + " con lecturas a cualquier réplica, el " + pct(sticky.miss) + " fijo a una réplica y el " + pct(window.miss) + " leyendo del líder durante " + WINDOW + " s después de guardar, lo que mandó al líder el " + pct(window.leader) + " de todas las lecturas. Segundas lecturas rápidas que mostraron menos que la anterior: el " + pct(any.quick) + ", el " + pct(sticky.quick) + " y el " + pct(window.quick) + "."),
      groups: [
        { title: t("Read-backs missing the save", "Lecturas tras guardar sin lo guardado"), bars: [[t("Any follower", "Cualquier réplica"), any.miss / m, pct(any.miss)], [t("Same follower", "Siempre la misma réplica"), sticky.miss / m, pct(sticky.miss), true], [t("Leader " + WINDOW + " s after a save", "Líder " + WINDOW + " s tras guardar"), window.miss / m, pct(window.miss)]] },
        { title: t("Second reads that went back", "Segundas lecturas que retrocedieron"), bars: [[t("Any follower", "Cualquier réplica"), any.quick / mq, pct(any.quick)], [t("Same follower", "Siempre la misma réplica"), sticky.quick / mq, pct(sticky.quick), true], [t("Leader " + WINDOW + " s after a save", "Líder " + WINDOW + " s tras guardar"), window.quick / mq, pct(window.quick)]] },
        { title: t("Reads served by the leader", "Lecturas atendidas por el líder"), bars: [[t("Any follower", "Cualquier réplica"), any.leader, pct(any.leader)], [t("Same follower", "Siempre la misma réplica"), sticky.leader, pct(sticky.leader)], [t("Leader " + WINDOW + " s after a save", "Líder " + WINDOW + " s tras guardar"), window.leader, pct(window.leader), true]] },
      ],
    };
  },
  lose: () => {
    const { async: a, semi, sync } = R.lose, m = top(semi.ackedOther, a.acked);
    return {
      verdict: t("Acknowledged writes lost per crash during a burst: " + per(a.acked) + " async, " + per(semi.acked) + " semi-synchronous and " + per(sync.acked) + " synchronous, promoting A, the follower that had received the most. Semi-synchronous but promoting B: " + per(semi.ackedOther) + ". Between bursts, async lost " + per(a.calm) + ". A's replay backlog at the crash, which it replayed before taking writes: " + per(a.backlog) + " writes.",
        "Escrituras confirmadas perdidas por caída durante una ráfaga: " + per(a.acked) + " asíncrona, " + per(semi.acked) + " semisíncrona y " + per(sync.acked) + " síncrona, promoviendo a A, la réplica que más había recibido. Semisíncrona pero promoviendo a B: " + per(semi.ackedOther) + ". Entre ráfagas, la asíncrona perdió " + per(a.calm) + ". Lo que A tenía recibido sin aplicar en la caída, y aplicó antes de tomar escrituras: " + per(a.backlog) + " escrituras."),
      bars: [
        [t("Async", "Asíncrona"), a.acked / m, per(a.acked), true],
        [t("Semi-sync, A promoted", "Semisíncrona, A promovida"), semi.acked / m, per(semi.acked)],
        [t("Semi-sync, B promoted", "Semisíncrona, B promovida"), semi.ackedOther / m, per(semi.ackedOther)],
        [t("Sync, A promoted", "Síncrona, A promovida"), sync.acked / m, per(sync.acked)],
      ],
    };
  },
  slow: () => {
    const { async: a, semi, sync } = R.slow, m = top(a.miss), mt = top(sync.p99);
    const row = (x, key, after) => [[t("Async", "Asíncrona"), a, "async"], [t("Any one receives", "Una cualquiera la recibe"), semi, "semi"], [t("Both apply", "Ambas la aplican"), sync, "sync"]].map(([label, v, k]) => [label, v[key] / x, key === "miss" ? pct(v[key]) : ms(v[key]), k === after]);
    return {
      verdict: t("A save took " + ms(a.p50) + " async, " + ms(semi.p50) + " waiting for any one follower to receive it and " + ms(sync.p50) + " waiting for both to apply it, at the median; " + ms(a.p99) + ", " + ms(semi.p99) + " and " + ms(sync.p99) + " at p99. Read-backs missing the save: " + pct(a.miss) + ", " + pct(semi.miss) + " and " + pct(sync.miss) + ".",
        "Un guardado tardó " + ms(a.p50) + " asíncrono, " + ms(semi.p50) + " esperando que una réplica cualquiera lo recibiera y " + ms(sync.p50) + " esperando que ambas lo aplicaran, en la mediana; " + ms(a.p99) + ", " + ms(semi.p99) + " y " + ms(sync.p99) + " en el p99. Lecturas tras guardar sin lo guardado: el " + pct(a.miss) + ", el " + pct(semi.miss) + " y el " + pct(sync.miss) + "."),
      groups: [
        { title: t("Save time, median", "Tiempo de guardado, mediana"), bars: row(mt, "p50", "sync") },
        { title: t("Save time, p99", "Tiempo de guardado, p99"), bars: row(mt, "p99", "sync") },
        { title: t("Read-backs missing the save", "Lecturas tras guardar sin lo guardado"), bars: row(m, "miss", "semi") },
      ],
    };
  },
  burst: () => {
    const { window: w, token } = R.burst, m = top(w.peak, w.over);
    return {
      verdict: t("Follower A's lag peaked at " + s1(w.peak) + ", " + s1(w.peakAfter) + " after each burst had ended, against " + ms(w.base) + " on average the rest of the time, and stayed over " + WINDOW + " s for " + s1(w.over) + ". With the " + WINDOW + " s leader window, " + per(w.missN) + " reads per burst missed the user's own save; tracking the LSN, " + per(token.missN) + ", with " + pct(token.leader) + " of reads on the leader.",
        "El retraso de la réplica A llegó a " + s1(w.peak) + ", " + s1(w.peakAfter) + " después de que terminara cada ráfaga, contra " + ms(w.base) + " en promedio el resto del tiempo, y pasó de " + WINDOW + " s durante " + s1(w.over) + ". Con la ventana de " + WINDOW + " s en el líder, " + per(w.missN) + " lecturas por ráfaga no tenían lo que el usuario guardó; siguiendo el LSN, " + per(token.missN) + ", con el " + pct(token.leader) + " de las lecturas en el líder."),
      groups: [
        { title: t("Follower A", "Réplica A"), bars: [[t("Lag, rest of the time (average)", "Retraso, el resto del tiempo (promedio)"), w.base / m, ms(w.base)], [t("Peak lag", "Retraso máximo"), w.peak / m, s1(w.peak), true], [t("Time over " + WINDOW + " s, per burst", "Tiempo por encima de " + WINDOW + " s, por ráfaga"), w.over / m, s1(w.over)]] },
        { title: t("Reads missing the user's save, per burst", "Lecturas sin lo guardado, por ráfaga"), bars: [[t("Leader " + WINDOW + " s after a save", "Líder " + WINDOW + " s tras guardar"), Math.min(1, w.missN / top(w.missN)), per(w.missN), true], [t("Follower caught up to me", "Réplica al día conmigo"), token.missN / top(w.missN), per(token.missN)]] },
      ],
    };
  },
};

const { move: M, ryw: Y, slow: Z, burst: B, lose: X } = R;
const DELAY = ms(M.any.delay), DELAY_B = ms(Y.any.delayB), DELAY_A = ms(Y.any.delayA);

const EXPERIMENTS = [
  {
    id: "move",
    title: t("Reads move to the followers", "Las lecturas pasan a las réplicas"),
    change: t("Asynchronous replication, both followers healthy · every read from the leader vs reads spread over the two followers",
      "Replicación asíncrona, las dos réplicas sanas · todas las lecturas del líder vs lecturas repartidas entre las dos réplicas"),
    question: t("With reads spread over the followers, what share of read-backs (the request that comes " + BACK_RANGE + " after a save returns) miss the user's own save?",
      "Con las lecturas repartidas entre las réplicas, ¿qué parte de las lecturas tras guardar (la solicitud que llega " + BACK_RANGE + " después de que vuelve el guardado) no tiene lo que el usuario guardó?"),
    options: [
      t("Almost none: replication is done before the next request arrives", "Casi ninguna: la replicación termina antes de que llegue la siguiente solicitud"),
      t("A real share: every read-back that comes sooner than replication", "Una parte real: cada lectura tras guardar que llega antes que la replicación"),
      t("None while the followers are healthy: lag shows up only under load", "Ninguna mientras las réplicas estén sanas: el retraso aparece solo con carga"),
    ],
    answer: 1,
    why: t(
      "Asynchronous replication means the leader answers the save as soon as the write is in its own log, and ships it to the followers afterwards: here they applied each write " + DELAY + " after its commit on average. A read-back that lands on a follower sooner than that reads a copy without the save, so " + pct(M.any.miss) + " of read-backs missed it, with nothing failing and both followers keeping up. That is the normal state of async replication, not an incident. Over every read by users who had saved something, only " + pct(M.any.own) + " missed, which is why it hides in a dashboard and is obvious to the user who just pressed Save. On a quiet replica in the same zone lag is often a few milliseconds and the share is smaller, but never zero, and it climbs whenever lag does (experiment 3). The times here are illustrative and round.",
      "Replicación asíncrona significa que el líder responde el guardado apenas la escritura está en su propio log, y se la envía a las réplicas después: aquí aplicaban cada escritura " + DELAY + " después de su commit en promedio. Una lectura tras guardar que cae en una réplica antes de eso lee una copia sin el cambio, así que el " + pct(M.any.miss) + " de las lecturas tras guardar no lo tenía, sin que nada fallara y con las dos réplicas al día. Es el estado normal de la replicación asíncrona, no un incidente. Sobre todas las lecturas de usuarios que ya habían guardado algo, faltó solo en el " + pct(M.any.own) + ", y por eso se esconde en un panel de métricas y es evidente para el usuario que acaba de tocar Guardar. En una réplica tranquila en la misma zona el retraso suele ser de pocos milisegundos y la parte es menor, pero nunca cero, y sube cada vez que sube el retraso (experimento 3). Los tiempos aquí son ilustrativos y redondos.",
    ),
    watch: { route: "any", commit: "async", b: "healthy", until: "miss" },
  },
  {
    id: "sticky",
    title: t("Stick to one follower", "Fijo a una réplica"),
    change: t("Follower B falls behind (a slower link and slower replay: it applies writes " + DELAY_B + " after their commit on average, A " + DELAY_A + ") · users save, read back, and read again " + QUICK_RANGE + " later · reads to any follower vs each user always reading from the same follower vs the leader for " + WINDOW + " s after the user's own save, then any follower",
      "La réplica B se atrasa (un enlace más lento y una aplicación más lenta: aplica las escrituras " + DELAY_B + " después de su commit en promedio, A " + DELAY_A + ") · los usuarios guardan, leen lo guardado y vuelven a leer " + QUICK_RANGE + " después · lecturas a cualquier réplica vs cada usuario leyendo siempre de la misma réplica vs el líder durante " + WINDOW + " s después del guardado del propio usuario, y después cualquier réplica"),
    question: t("With each user stuck to one follower, how often does a read-back miss the user's own save?",
      "Con cada usuario fijo a una réplica, ¿qué tan seguido una lectura tras guardar no tiene lo que el usuario guardó?"),
    options: [
      t("Never: the user always reads the same copy", "Nunca: el usuario siempre lee la misma copia"),
      t("About as often as with reads to any follower", "Más o menos tanto como con lecturas a cualquier réplica"),
      t("Rarely: the user no longer hops between copies", "Pocas veces: el usuario ya no salta entre copias"),
    ],
    answer: 1,
    why: t(
      "Sticking to a follower (pick it from a hash of the user ID) makes a user's reads agree with each other. With reads to any follower, " + pct(Y.any.quick) + " of quick second reads showed less than the read just before, a comment that was there and then isn't: the first read landed on A and the second on B, about " + ms(Y.any.delayB - Y.any.delayA) + " behind it. Only that order hurts; going from B to A moves forward, which is why it isn't half of the mixed pairs. Stuck to one follower: " + pct(Y.sticky.quick) + ". That guarantee is called monotonic reads. It does nothing to make that follower have the user's write: a read-back still beats replication as often as before, " + pct(Y.sticky.miss) + " stuck to one follower against " + pct(Y.any.miss) + " spread over both (users stuck to B missed " + pct(Y.sticky.missB) + ", users on A " + pct(Y.sticky.missA) + "). Users stuck to B see older data, but consistently, and if their follower fails they move to another, which may be behind the first. Read-your-writes needs the read to go somewhere that has the write. Reading from the leader for " + WINDOW + " s after the user's own save brings misses to " + pct(Y.window.miss) + ", but it sends " + pct(Y.window.leader) + " of all reads back to the leader, the load the followers were there to take, and lets a second read go back again (" + pct(Y.window.quick) + "): a read on the leader followed by one on a follower. Rails' automatic role switching works this way, reading from the primary for 2 s after a write by default.",
      "Fijarse a una réplica (elegida con un hash del ID de usuario) hace que las lecturas de un usuario coincidan entre sí. Con lecturas a cualquier réplica, el " + pct(Y.any.quick) + " de las segundas lecturas rápidas mostró menos que la lectura anterior, un comentario que estaba y ya no está: la primera lectura cayó en A y la segunda en B, unos " + ms(Y.any.delayB - Y.any.delayA) + " detrás. Solo ese orden hace daño; pasar de B a A avanza, y por eso no es la mitad de los pares mezclados. Fijo a una réplica: el " + pct(Y.sticky.quick) + ". Esa garantía se llama lecturas monótonas (monotonic reads). No hace que esa réplica tenga la escritura del usuario: una lectura tras guardar le sigue ganando a la replicación tan seguido como antes, el " + pct(Y.sticky.miss) + " fijo a una réplica contra el " + pct(Y.any.miss) + " repartido entre ambas (los usuarios fijos a B fallaron el " + pct(Y.sticky.missB) + ", los de A el " + pct(Y.sticky.missA) + "). Los usuarios fijos a B ven datos más viejos, pero de forma consistente, y si su réplica falla pasan a otra, que puede estar detrás de la primera. Leer tus propias escrituras (read-your-writes) necesita que la lectura vaya a un lugar que tenga la escritura. Leer del líder durante " + WINDOW + " s después del guardado del propio usuario baja las fallas al " + pct(Y.window.miss) + ", pero manda de vuelta al líder el " + pct(Y.window.leader) + " de todas las lecturas, la carga que las réplicas debían quitarle, y deja que una segunda lectura vuelva a retroceder (el " + pct(Y.window.quick) + "): una lectura en el líder seguida de una en una réplica. El cambio automático de rol de Rails funciona así: lee del primario durante 2 s después de una escritura, por defecto.",
    ),
    watch: { route: "sticky", commit: "async", b: "slow", until: "miss" },
  },
  {
    id: "burst",
    title: t("A write burst", "Una ráfaga de escrituras"),
    change: t("Both followers healthy · every " + BURST_EVERY + " s a batch job adds " + BURST.rate + " writes a second for " + BURST.dur + " s to the usual " + Math.round(B.window.rate) + " or so · a follower replays up to " + APPLY_RATE + " a second · reads from the leader for " + WINDOW + " s after a save vs from a follower that has caught up to the user's last LSN",
      "Las dos réplicas sanas · cada " + BURST_EVERY + " s un proceso por lotes agrega " + BURST.rate + " escrituras por segundo durante " + BURST.dur + " s a las " + Math.round(B.window.rate) + " de costumbre · una réplica aplica hasta " + APPLY_RATE + " por segundo · lecturas del líder durante " + WINDOW + " s después de guardar vs de una réplica que ya alcanzó el último LSN del usuario"),
    question: t("How far behind does follower A get?", "¿Qué tan atrás queda la réplica A?"),
    options: [
      t("About as usual: the link to the follower is just as fast", "Más o menos lo de siempre: el enlace a la réplica es igual de rápido"),
      t("Seconds: it keeps falling behind until it has replayed the whole burst", "Segundos: sigue atrasándose hasta que termina de aplicar toda la ráfaga"),
      t("A few times its usual lag, levelling off once the burst is under way", "Unas pocas veces su retraso normal, y se estabiliza cuando la ráfaga ya empezó"),
    ],
    answer: 1,
    why: t(
      "Replication lag is a queue (lesson 33, Queues). The leader takes writes from many connections at once; a follower replays them in log order, here up to " + APPLY_RATE + " a second (PostgreSQL replays WAL in a single process). During the burst writes arrive faster than that and the line on A's tray grows. The lag, the age of the oldest write not yet replayed, keeps growing even after the burst ends, because A is still working through writes that came in faster than it copies them: it peaked at " + s1(B.window.peak) + " as the last of them was replayed, " + s1(B.window.peakAfter) + " after the burst, against " + ms(B.window.base) + " on average otherwise. A " + WINDOW + " s leader window is sized for normal lag; for " + s1(B.window.over) + " per burst reads more than a second after a save went to followers that didn't have it yet: " + per(B.window.missN) + " per burst. Tracking the LSN instead (the client keeps the LSN of its last write, and of the newest data it has seen, and reads from a follower only if it has replayed that far, else from the leader) missed " + per(B.token.missN) + " and kept second reads from going back, at the cost of " + pct(B.token.leader) + " of reads on the leader, " + pct(B.token.leaderInBursts) + " of those in the 15 s after a burst began, about a quarter of the time. PostgreSQL exposes the LSNs (pg_current_wal_lsn() on the leader, pg_last_wal_replay_lsn() on a standby), MySQL has GTIDs and WAIT_FOR_EXECUTED_GTID_SET(), and MongoDB's causally consistent sessions carry the same kind of token.",
      "El retraso de replicación es una cola (lección 33, Colas). El líder recibe escrituras de muchas conexiones a la vez; una réplica las aplica en el orden del log, aquí hasta " + APPLY_RATE + " por segundo (PostgreSQL aplica el WAL en un solo proceso). Durante la ráfaga las escrituras llegan más rápido que eso y la fila en la bandeja de A crece. El retraso, la edad de la escritura más vieja todavía sin aplicar, sigue creciendo incluso después de que termina la ráfaga, porque A todavía está procesando escrituras que llegaron más rápido de lo que las copia: llegó a " + s1(B.window.peak) + " cuando aplicó la última, " + s1(B.window.peakAfter) + " después de la ráfaga, contra " + ms(B.window.base) + " en promedio el resto del tiempo. Una ventana de " + WINDOW + " s en el líder está pensada para el retraso normal; durante " + s1(B.window.over) + " por ráfaga, las lecturas más de un segundo después de guardar fueron a réplicas que todavía no tenían el cambio: " + per(B.window.missN) + " por ráfaga. Seguir el LSN (el cliente guarda el LSN de su última escritura, y el de los datos más nuevos que vio, y lee de una réplica solo si ya aplicó hasta ahí, si no del líder) falló " + per(B.token.missN) + " veces y evitó también que las segundas lecturas retrocedieran, a cambio de mandar al líder el " + pct(B.token.leader) + " de las lecturas, el " + pct(B.token.leaderInBursts) + " de ellas en los 15 s después de que empezaba una ráfaga, más o menos un cuarto del tiempo. PostgreSQL expone los LSN (pg_current_wal_lsn() en el líder, pg_last_wal_replay_lsn() en una réplica), MySQL tiene los GTID y WAIT_FOR_EXECUTED_GTID_SET(), y las sesiones con consistencia causal de MongoDB llevan el mismo tipo de marca.",
    ),
    watch: { route: "window", commit: "async", b: "healthy", burst: 0.3, jump: 1.3, speed: 0.25 },
  },
  {
    id: "lose",
    title: t("Lose the leader", "Perder al líder"),
    change: t("Follower B slow · every " + BURST_EVERY + " s a batch job adds " + BURST.rate + " writes a second for " + BURST.dur + " s · the leader crashes at a random moment during a burst, and the follower that has received the most of the log is promoted · a save waits for the leader alone (async) vs for one follower to receive it (semi-sync) vs for both to apply it (sync)",
      "La réplica B lenta · cada " + BURST_EVERY + " s un proceso por lotes agrega " + BURST.rate + " escrituras por segundo durante " + BURST.dur + " s · el líder se cae en un momento al azar durante una ráfaga, y pasa a ser líder la réplica que más recibió del log · un guardado espera solo al líder (asíncrona) vs que una réplica lo reciba (semisíncrona) vs que las dos lo apliquen (síncrona)"),
    question: t("With asynchronous replication and A promoted, which acknowledged writes does the crash lose?", "Con replicación asíncrona y A promovida, ¿qué escrituras confirmadas pierde la caída?"),
    options: [
      t("Every write A hadn't copied yet: its whole backlog", "Todas las que A todavía no había copiado: todo su atraso"),
      t("Only the writes still on their way to A at the crash", "Solo las que todavía iban en camino a A en la caída"),
      t("None: A replays everything it has before taking over", "Ninguna: A aplica todo lo que tiene antes de tomar el mando"),
    ],
    answer: 1,
    why: t(
      "A follower holds two lines: writes on their way to it, and writes it has received and stored in its log but not yet replayed into its own tables. Promotion replays the second line before the new leader takes writes, so A's backlog, " + per(X.async.backlog) + " writes at the crash on average, wasn't lost; it made the failover slower. The first line is what's lost: writes the leader had already acknowledged, still in its memory or on the wire. With async that was " + per(X.async.acked) + " acknowledged writes per crash during a burst, and " + per(X.async.calm) + " between bursts: whatever was in flight, more when writes come faster. Semi-sync answers a save only once a follower has received it, so " + per(X.semi.acked) + " acknowledged writes were lost; the " + per(X.semi.unacked) + " per crash that never reached A hadn't been acknowledged yet, so their clients got no answer and had to retry. That holds only if the failover promotes the follower that received them: promoting B, still far behind, lost " + per(X.semi.ackedOther) + ". Patroni, for PostgreSQL, refuses to promote a replica more than maximum_lag_on_failover behind (1 MB of log by default), and in synchronous mode promotes only a standby that was synchronous. Sync lost " + per(X.sync.acked) + " too, at a price (next experiment). Deciding that the leader is dead and keeping it from writing is lesson 63, Leader Election.",
      "Una réplica tiene dos filas: escrituras en camino hacia ella, y escrituras que ya recibió y guardó en su log pero todavía no aplicó en sus propias tablas. La promoción aplica la segunda fila antes de que el nuevo líder tome escrituras, así que el atraso de A, " + per(X.async.backlog) + " escrituras en la caída en promedio, no se perdió; hizo más lento el relevo. Lo que se pierde es la primera fila: escrituras que el líder ya había confirmado, todavía en su memoria o en la red. Con replicación asíncrona fueron " + per(X.async.acked) + " escrituras confirmadas por caída durante una ráfaga, y " + per(X.async.calm) + " entre ráfagas: lo que estaba en vuelo, más cuando las escrituras llegan más rápido. La semisíncrona responde un guardado solo cuando una réplica lo recibió, así que se perdieron " + per(X.semi.acked) + " escrituras confirmadas; las " + per(X.semi.unacked) + " por caída que nunca llegaron a A todavía no se habían confirmado, así que sus clientes no recibieron respuesta y tuvieron que reintentar. Eso vale solo si el relevo promueve a la réplica que las recibió: promover a B, todavía muy atrasada, perdió " + per(X.semi.ackedOther) + ". Patroni, para PostgreSQL, se niega a promover una réplica atrasada más de maximum_lag_on_failover (1 MB de log por defecto), y en modo síncrono solo promueve una réplica que era síncrona. La síncrona también perdió " + per(X.sync.acked) + ", a un precio (siguiente experimento). Decidir que el líder murió e impedir que siga escribiendo es la lección 63, Elección de líder.",
    ),
    watch: { route: "any", commit: "async", b: "slow", burst: 0.3, jump: 0.8, crash: 1.1, speed: 0.1 },
  },
  {
    id: "slow",
    title: t("One slow follower", "Una réplica lenta"),
    change: t("Follower B slow · reads to any follower · the leader answers a save once the write is in its own log (async) vs once any one follower has received it (semi-sync) vs once both followers have applied it (sync)",
      "La réplica B lenta · lecturas a cualquier réplica · el líder responde un guardado cuando la escritura está en su propio log (asíncrona) vs cuando una réplica cualquiera la recibió (semisíncrona) vs cuando las dos réplicas la aplicaron (síncrona)"),
    question: t("The leader now waits for both followers instead of any one. What happens to the time a save takes?", "Ahora el líder espera a las dos réplicas en lugar de a una cualquiera. ¿Qué pasa con lo que tarda un guardado?"),
    options: [
      t("Every save now takes as long as B's round trip", "Cada guardado tarda ahora lo que la ida y vuelta de B"),
      t("Only the saves that B happens to handle slow down", "Solo se frenan los guardados que justo atiende B"),
      t("Little: both copies go out at once, side by side", "Poco: las dos copias salen a la vez, en paralelo"),
    ],
    answer: 0,
    why: t(
      "The leader sends every write to both followers at once and answers after the acknowledgements it waits for, so a save takes as long as the slowest follower among those: the same counting as lesson 59, Quorums. Waiting for any one, A answers first: " + ms(Z.semi.p50) + " at the median, " + ms(Z.semi.p99) + " at p99. Waiting for both, every save waits for B: " + ms(Z.sync.p50) + " and " + ms(Z.sync.p99) + ", most of it B's round trip (" + B_TRIP + " here), not the replay. If B stops (set it to Stopped replaying), saves that wait for it stop too: PostgreSQL waits for a synchronous standby indefinitely, and MySQL's semi-sync falls back to async after rpl_semi_sync_source_timeout, 10 s by default, quietly dropping the guarantee. Any one keeps the guarantee of the previous experiment, no acknowledged write lost when the leader dies, without that coupling: synchronous_standby_names = 'ANY 1 (a, b)' with synchronous_commit = on in PostgreSQL (the standby has flushed the write to disk), rpl_semi_sync_source_wait_for_replica_count = 1 in MySQL. Neither gives read-your-writes: received isn't applied, and the read can land on the other follower, so " + pct(Z.semi.miss) + " of read-backs still missed the save (" + pct(Z.async.miss) + " async, more only because those saves returned sooner). Waiting for both to apply (PostgreSQL's remote_apply, with both standbys synchronous) is what brought it to " + pct(Z.sync.miss) + ", and that is what the slowest follower's time buys.",
      "El líder manda cada escritura a las dos réplicas a la vez y responde tras las confirmaciones que espera, así que un guardado tarda lo que la réplica más lenta entre esas: la misma cuenta que en la lección 59, Quórums. Esperando a una cualquiera, A responde primero: " + ms(Z.semi.p50) + " en la mediana y " + ms(Z.semi.p99) + " en el p99. Esperando a las dos, cada guardado espera a B: " + ms(Z.sync.p50) + " y " + ms(Z.sync.p99) + ", casi todo la ida y vuelta de B (" + B_TRIP + " aquí), no la aplicación. Si B se detiene (ponla en Dejó de aplicar), los guardados que la esperan se detienen también: PostgreSQL espera a una réplica síncrona indefinidamente, y la semisíncrona de MySQL vuelve a asíncrona tras rpl_semi_sync_source_timeout, 10 s por defecto, y abandona la garantía sin avisar. Una cualquiera mantiene la garantía del experimento anterior, ninguna escritura confirmada perdida cuando cae el líder, sin ese acoplamiento: synchronous_standby_names = 'ANY 1 (a, b)' con synchronous_commit = on en PostgreSQL (la réplica escribió la escritura a disco), rpl_semi_sync_source_wait_for_replica_count = 1 en MySQL. Ninguna da leer tus propias escrituras: recibida no es aplicada, y la lectura puede caer en la otra réplica, así que el " + pct(Z.semi.miss) + " de las lecturas tras guardar todavía no tenía lo guardado (el " + pct(Z.async.miss) + " asíncrona, más solo porque esos guardados volvían antes). Esperar a que las dos la apliquen (remote_apply de PostgreSQL, con las dos réplicas síncronas) es lo que lo bajó al " + pct(Z.sync.miss) + ", y eso es lo que compra el tiempo de la réplica más lenta.",
    ),
    watch: { route: "any", commit: "sync", b: "slow" },
  },
];

const QUESTIONS = [
  [t("In one sentence, what is replication lag, and why does an asynchronous follower always have some?", "En una oración, ¿qué es el retraso de replicación y por qué una réplica asíncrona siempre tiene algo?"),
   t("The time between a write committing on the leader and being applied on a follower. With async replication the leader answers before the follower has the write, so the follower trails by at least the time to ship and replay it, and by much more whenever writes arrive faster than it can replay them.",
     "El tiempo entre que una escritura hace commit en el líder y se aplica en una réplica. Con replicación asíncrona el líder responde antes de que la réplica tenga la escritura, así que la réplica va atrás por lo menos el tiempo de enviarla y aplicarla, y mucho más cuando las escrituras llegan más rápido de lo que puede aplicarlas.")],
  [t("Read-your-writes and monotonic reads: what does each promise, and what is the cheapest way to get each with read replicas?", "Leer tus propias escrituras y lecturas monótonas: ¿qué promete cada una, y cuál es la forma más barata de lograr cada una con réplicas de lectura?"),
   t("Read-your-writes: after you save, your reads include the save (other users' reads may not yet). Monotonic reads: you never see older data after newer. Monotonic reads is cheap: send each user to the same replica. Read-your-writes needs the read to reach a copy with the write: the leader for a while after the user's writes (simple, costs leader load, a fixed window can be too short), or the LSN of the user's last write checked against the replica, which also gives monotonic reads if you track the newest LSN seen. Both are per user: if the user also has a phone, the token has to live on the server, not in one browser's cookie.",
     "Leer tus propias escrituras: después de guardar, tus lecturas incluyen lo guardado (las de otros usuarios quizá todavía no). Lecturas monótonas: nunca ves datos más viejos después de unos más nuevos. Las lecturas monótonas son baratas: manda a cada usuario a la misma réplica. Leer tus propias escrituras necesita que la lectura llegue a una copia que tenga la escritura: el líder por un rato después de las escrituras del usuario (simple, cuesta carga en el líder, y una ventana fija puede quedarse corta), o el LSN de la última escritura del usuario comparado con el de la réplica, que también da lecturas monótonas si guardas el LSN más nuevo que viste. Las dos son por usuario: si el usuario también usa el teléfono, la marca tiene que vivir en el servidor, no en la cookie de un navegador.")],
  [t("Your dashboard says replica lag averages 50 ms. A user reports that edits sometimes vanish right after saving. Is that consistent, and what would you measure?", "Tu panel dice que el retraso de las réplicas promedia 50 ms. Un usuario reporta que a veces sus cambios desaparecen justo después de guardar. ¿Es coherente, y qué medirías?"),
   t("Yes. A 50 ms average means many reads that follow a save within 50 ms see the old data, and an average hides the spikes (a burst, a long query on the replica) when lag reaches seconds. Measure the lag's maximum and high percentiles per replica, and, better, the thing users feel: for reads that follow the same user's write, how often the replica that served them hadn't applied it yet. A page that shows the edit and then loses it on refresh is the monotonic-reads failure, two replicas at different points.",
     "Sí. Un promedio de 50 ms significa que muchas lecturas que siguen a un guardado dentro de esos 50 ms ven los datos viejos, y un promedio esconde los picos (una ráfaga, una consulta larga en la réplica) cuando el retraso llega a segundos. Mide el máximo y los percentiles altos del retraso por réplica y, mejor, lo que siente el usuario: de las lecturas que siguen a una escritura del mismo usuario, qué tan seguido la réplica que respondió todavía no la había aplicado. Una página que muestra el cambio y lo pierde al recargar es la falla de lecturas monótonas, dos réplicas en puntos distintos.")],
  [t("Why can a long query on a PostgreSQL standby make its lag jump to many seconds, and what are the ways out?", "¿Por qué una consulta larga en una réplica de PostgreSQL puede hacer saltar su retraso a muchos segundos, y qué salidas hay?"),
   t("Replay can conflict with a running query, for example when the leader's vacuum removed row versions the query still needs. The standby then pauses replay, up to max_standby_streaming_delay (30 s by default), before cancelling the query, and lag grows the whole time. Options: hot_standby_feedback = on, so the leader keeps those rows (at the cost of bloat on the leader); a shorter delay (more cancelled queries); or a separate replica for long analytical queries, kept out of the pool that serves reads after writes.",
     "La aplicación puede chocar con una consulta en curso, por ejemplo cuando el vacuum del líder borró versiones de filas que la consulta todavía necesita. La réplica entonces pausa la aplicación, hasta max_standby_streaming_delay (30 s por defecto), antes de cancelar la consulta, y el retraso crece todo ese tiempo. Opciones: hot_standby_feedback = on, para que el líder conserve esas filas (a costa de inflar tablas en el líder); un tiempo menor (más consultas canceladas); o una réplica aparte para consultas analíticas largas, fuera del grupo que atiende lecturas después de escrituras.")],
  [t("You must not lose an acknowledged write when the leader dies, and you have two followers. What do you configure, and why not \"wait for every follower\"?", "No puedes perder una escritura confirmada cuando cae el líder, y tienes dos réplicas. ¿Qué configuras, y por qué no \"esperar a todas las réplicas\"?"),
   t("Make each commit wait until at least one follower has the write in its log on disk (PostgreSQL: synchronous_standby_names = 'ANY 1 (a, b)' with synchronous_commit = on; MySQL: semi-sync with a wait count of 1), and make the failover promote a follower that has it: the most advanced one, or only one that was synchronous. Waiting for every follower ties every commit to the slowest one and stops writes when any one is down, and adds no protection against the leader's crash. Watch the edges: MySQL's semi-sync quietly turns async after its timeout and PostgreSQL's commits hang with no synchronous standby left, so alert on both; and one copy covers one failure: to survive the leader and a follower together, wait for two (ANY 2 of three).",
     "Haz que cada commit espere hasta que al menos una réplica tenga la escritura en su log en disco (PostgreSQL: synchronous_standby_names = 'ANY 1 (a, b)' con synchronous_commit = on; MySQL: semisíncrona con una cuenta de espera de 1), y haz que el relevo promueva a una réplica que la tenga: la más adelantada, o solo una que era síncrona. Esperar a todas ata cada commit a la más lenta y detiene las escrituras cuando cualquiera está caída, sin proteger más contra la caída del líder. Cuida los bordes: la semisíncrona de MySQL pasa a asíncrona sin avisar tras su tiempo límite y los commits de PostgreSQL se cuelgan si no queda ninguna réplica síncrona, así que alerta sobre las dos cosas; y una copia cubre una falla: para sobrevivir al líder y a una réplica juntos, espera a dos (ANY 2 de tres).")],
  [t("After an asynchronous failover the old leader comes back. What does it hold that the new leader doesn't, what has to happen to it, and what decided how much was lost?", "Después de un relevo con replicación asíncrona, el líder viejo vuelve. ¿Qué tiene que el nuevo líder no tiene, qué hay que hacer con él, y qué decidió cuánto se perdió?"),
   t("The writes it acknowledged that never reached the promoted follower: users were told they were saved. It can't rejoin as it is or serve them: it is rewound to where its history and the new leader's split (PostgreSQL's pg_rewind) or rebuilt from the new leader, and those writes are recovered by hand from it, if at all. The loss was decided by how much log the promoted follower hadn't received at the crash, not by its replay lag: what it had received it replayed before taking writes, so a large replay lag makes failover slower, not lossier. Keeping the old leader from accepting writes in the meantime is lesson 63, Leader Election, and lesson 62, Leases & Fencing Tokens.",
     "Las escrituras que confirmó y que nunca llegaron a la réplica promovida: a los usuarios se les dijo que estaban guardadas. No puede volver tal cual ni servirlas: se rebobina hasta donde su historia y la del nuevo líder se separaron (pg_rewind de PostgreSQL) o se reconstruye desde el nuevo líder, y esas escrituras se recuperan a mano desde él, si se recuperan. La pérdida la decidió cuánto log no había recibido la réplica promovida en la caída, no su retraso de aplicación: lo que ya había recibido lo aplicó antes de tomar escrituras, así que un retraso de aplicación grande hace más lento el relevo, no más pérdidas. Impedir que el líder viejo acepte escrituras mientras tanto es la lección 63, Elección de líder, y la lección 62, Arrendamientos y tokens de cerco.")],
];

export default defineLesson({
  title: t("Replication Lag Workbench", "Banco de trabajo: retraso de replicación"),
  eyebrow: t("Systems lesson 60 · Replication lag", "Lección de sistemas 60 · Retraso de replicación"),
  lede: t("With asynchronous replication, a write lands on the leader first and on the followers that serve reads a little later. That gap is replication lag: users meet it as a save they can't see, a page that goes back in time, and, when the leader dies, saved writes that are gone. This lesson turns it into a main ledger with two copy desks fed by conveyors: watch it, predict what breaks it, then explain it back.",
    "Con replicación asíncrona, una escritura llega primero al líder y un poco después a las réplicas que atienden las lecturas. Esa diferencia es el retraso de replicación (replication lag): los usuarios lo ven como un guardado que no aparece, una página que vuelve atrás en el tiempo y, cuando cae el líder, escrituras guardadas que desaparecen. Esta lección lo convierte en un libro mayor con dos mesas de copia alimentadas por cintas: mírala, predice qué la rompe y después explícala."),
  machine: {
    intro: t("Every write gets the leader's next log sequence number (LSN), W1, W2, W3…, and rides a conveyor to each follower, which copies the slips into its own ledger one at a time. The row of blocks on each node shows the leader's newest writes and which of them that node has. You save every couple of seconds, read the page right after, and look twice more; your latest save is lit. Change where reads go, what a save waits for, and how follower B is doing, press Save yourself, or crash the leader and see which writes survive.",
      "Cada escritura recibe el siguiente número de secuencia del log del líder (LSN, log sequence number), W1, W2, W3…, y viaja en una cinta a cada réplica, que copia los papeles en su propio libro uno a la vez. La fila de bloques de cada nodo muestra las escrituras más nuevas del líder y cuáles tiene ese nodo. Guardas cada par de segundos, lees la página justo después y miras dos veces más; tu último guardado está encendido. Cambia a dónde van las lecturas, qué espera un guardado y cómo está la réplica B, toca Guardar tú, o tumba al líder y mira qué escrituras sobreviven."),
    plate: {
      title: t("Copy desks", "Mesas de copia"),
      keys: [
        { mark: "lit", label: t("Your latest save: its slip, its blocks, and the lamp on each desk that has copied it", "Tu último guardado: su papel, sus bloques, y la lámpara de cada mesa que ya lo copió") },
        { mark: "raised", label: t("The leader, the follower desks, the slips on their way; a block: a write the node has copied", "El líder, las mesas de las réplicas, los papeles en camino; un bloque: una escritura que el nodo ya copió") },
        { mark: "flat", label: t("The conveyors, in log order; a flat tile: a write that has arrived and waits to be copied", "Las cintas, en el orden del log; una ficha plana: una escritura que llegó y espera ser copiada") },
        { mark: "dashed", label: t("A write that hasn't reached the node", "Una escritura que no llegó al nodo") },
      ],
      caption: t(
        "Played at a tenth of real speed (change it under Speed). The times are illustrative and round: a write reaches a healthy follower " + range(NET.healthy) + " after its commit and takes " + Math.round(1000 * APPLY.healthy) + " ms to replay; a slow B takes " + range(NET.slow) + " and " + Math.round(1000 * APPLY.slow) + " ms. " + USERS + " users browse and save; everyone else adds about " + OTHERS + " writes a second. LSN is the leader's last write; AT, the last one a desk has copied; LAG, how old the oldest write it hasn't copied is; +N, the slips waiting beyond the tray. Each row holds the leader's four newest writes, oldest on the left. Crash the leader and it stops at once: what hadn't reached a follower is gone, the follower that has received the most is promoted and copies what it received, and the writes only the dead leader held are crossed out (+N, the ones the row has no room for). Your board shows where your last read went and what it saw; below, for every user, MISSING is the share of read-backs (the read " + BACK_RANGE + " after a save) without the user's save, and WENT BACK the share of second reads that showed less than the read before.",
        "Se reproduce a un décimo de la velocidad real (cámbiala en Velocidad). Los tiempos son ilustrativos y redondos: una escritura llega a una réplica sana " + range(NET.healthy) + " después de su commit y tarda " + Math.round(1000 * APPLY.healthy) + " ms en aplicarse; una B lenta tarda " + range(NET.slow) + " y " + Math.round(1000 * APPLY.slow) + " ms. " + USERS + " usuarios navegan y guardan; todos los demás agregan unas " + OTHERS + " escrituras por segundo. LSN es la última escritura del líder; VA EN, la última que copió una mesa; RETRASO, qué tan vieja es la escritura más antigua que todavía no copió; +N, los papeles que esperan más allá de la bandeja. Cada fila tiene las cuatro escrituras más nuevas del líder, la más vieja a la izquierda. Si tumbas al líder, se detiene de inmediato: lo que no había llegado a una réplica se pierde, pasa a ser líder la réplica que más recibió y copia lo que recibió, y las escrituras que solo tenía el líder caído quedan tachadas (+N, las que no caben en la fila). Tu tablero muestra a dónde fue tu última lectura y qué vio; abajo, para todos los usuarios, FALTA es la parte de las lecturas tras guardar (la lectura " + BACK_RANGE + " después de un guardado) sin lo que el usuario guardó, y RETROCEDIÓ la parte de las segundas lecturas que mostraron menos que la anterior.",
      ),
      stage: { "data-copy-desks": "" },
      label: t("Replication lag simulation. Space pauses or resumes.", "Simulación de retraso de replicación. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["missing", t("Missing, after a save", "Falta, tras guardar"), "–"],
      ["back", t("Went back, 2nd read", "Retrocedió, 2.ª lectura"), "–"],
      ["lagA", t("Lag A", "Retraso A"), "0 ms"],
      ["lagB", t("Lag B", "Retraso B"), "0 ms"],
      ["save", t("Save time (p50)", "Guardado (p50)"), "–"],
      ["leader", t("Reads on leader", "Lecturas al líder"), "–"],
    ],
    controls: [
      { seg: "route", label: t("Reads go to", "Las lecturas van a"), options: [["leader", t("The leader", "El líder")], ["any", t("Any follower", "Cualquier réplica")], ["sticky", t("Same follower", "Siempre la misma réplica")], ["window", t("Leader " + WINDOW + " s after a save", "Líder " + WINDOW + " s tras guardar")], ["token", t("Follower caught up to me", "Réplica al día conmigo")]], value: "any" },
      { seg: "commit", label: t("A save waits for", "Un guardado espera a"), options: [["async", t("The leader (async)", "El líder (asíncrona)")], ["semi", t("One follower to receive (semi-sync)", "Que una réplica lo reciba (semisíncrona)")], ["sync", t("Both to apply (sync)", "Que ambas lo apliquen (síncrona)")]], value: "async" },
      { seg: "b", label: t("Follower B", "Réplica B"), options: [["healthy", t("Healthy", "Sana")], ["slow", t("Slow", "Lenta")], ["stalled", t("Stopped replaying", "Dejó de aplicar")]], value: "slow" },
      { speed: true, options: [[0.05, "1/20"], [0.1, "1/10"], [0.25, "1/4"], [1, t("Real time", "Tiempo real")]], value: 0.1 },
      { actions: [["save", t("Save", "Guardar"), { primary: true }], ["burst", t("Write burst", "Ráfaga de escrituras")], ["crash", t("Crash the leader", "Tumbar al líder")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Save writes for you now; Write burst runs a batch job of " + BURST.rate + " writes a second for " + BURST.dur + " s; Crash the leader stops it, promotes a follower, shows what was lost, and then starts over. The first two stats count every user since the run started.",
      "Cambiar un ajuste reinicia la ejecución. Guardar escribe por ti ahora; Ráfaga de escrituras lanza un proceso por lotes de " + BURST.rate + " escrituras por segundo durante " + BURST.dur + " s; Tumbar al líder lo detiene, promueve una réplica, muestra qué se perdió y después empieza de nuevo. Las dos primeras estadísticas cuentan a todos los usuarios desde que empezó la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of ten minutes each; the crashes are " + CRASHES + " random moments in each burst of each run.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de diez minutos cada una; las caídas son " + CRASHES + " momentos al azar en cada ráfaga de cada ejecución."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The consistency guarantees follow the usual definitions (read-your-writes, monotonic reads); the settings named are PostgreSQL's, MySQL's and Patroni's.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Las garantías de consistencia siguen las definiciones usuales (leer tus propias escrituras, lecturas monótonas); los ajustes que se nombran son los de PostgreSQL, MySQL y Patroni.`),
  css: LIT_FILL_CSS + `
[data-slot] [data-v]{display:none}
[data-slot][data-state="block"] [data-v="block"],[data-slot][data-state="tile"] [data-v="tile"],[data-slot][data-state="gap"] [data-v="gap"],[data-slot][data-state="none"] [data-v="gap"],[data-slot][data-state="lost"] [data-v="block"],[data-slot][data-state="lost"] [data-v="x"]{display:inline}
[data-slot-text]{font-weight:600}
[data-node] [data-word="down"],[data-desk] [data-word="promoted"]{display:none}
[data-node][data-role="down"] [data-word="down"],[data-desk][data-role="promoted"] [data-word="promoted"]{display:inline}
[data-node][data-role="down"] [data-word="up"],[data-desk][data-role="promoted"] [data-word="up"]{display:none}
[data-node][data-role="down"] .iso-top,[data-node][data-role="down"] .iso-shade,[data-node][data-role="down"] .iso-fill{fill:var(--anatomy-faint)}
`,
  data: { P, G: GEOMETRY, SLIP_SVG: slipSvg(), BURST, WINDOW },
});
