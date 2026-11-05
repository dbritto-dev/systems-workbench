// @ts-nocheck: content in the style of the other lessons
// Systems lesson 60 · Replication lag: a main ledger and two copy desks fed by conveyors.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, msFromSecs } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, slipSvg, P, GEOMETRY } from "./figure";
import { moveRun, monoRun, rywRun, syncRun, burstRun, NET, APPLY, BACK, QUICK, WINDOW, BURST, BURST_EVERY, OTHERS, USERS, LOCAL } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds of ten minutes each).
const R = { move: moveRun(), mono: monoRun(), ryw: rywRun(), sync: syncRun(), burst: burstRun() };

const ms = (x) => msFromSecs(x);
const s1 = (x) => x.toFixed(1) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const range = ([a, b]) => Math.round(1000 * a) + "–" + Math.round(1000 * (a + b)) + " ms";
const per = (x) => (x === 0 ? "0" : x < 10 ? x.toFixed(1) : String(Math.round(x)));
const BACK_RANGE = range(BACK);
const QUICK_RANGE = range(QUICK.gap);
const APPLY_RATE = Math.round(1 / APPLY.healthy);

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
  mono: () => {
    const { any, sticky } = R.mono, m = top(any.quick, 0.01);
    return {
      verdict: t("With B " + ms(any.delayB - any.delayA) + " behind A on average, " + pct(any.quick) + " of quick second reads showed less than the read before them when reads went to any follower, and " + pct(sticky.quick) + " when each user always read from the same follower.",
        "Con B " + ms(any.delayB - any.delayA) + " detrás de A en promedio, el " + pct(any.quick) + " de las segundas lecturas rápidas mostró menos que la lectura anterior cuando las lecturas iban a cualquier réplica, y el " + pct(sticky.quick) + " cuando cada usuario leía siempre de la misma réplica."),
      bars: [[t("Second read went back, any follower", "La segunda lectura retrocedió, cualquier réplica"), any.quick / m, pct(any.quick), true], [t("Second read went back, same follower", "La segunda lectura retrocedió, misma réplica"), sticky.quick / m, pct(sticky.quick)]],
    };
  },
  sticky: () => {
    const { any, sticky, window } = R.ryw, m = top(any.miss, sticky.miss);
    return {
      verdict: t("Read-backs missing the user's save: " + pct(any.miss) + " with reads to any follower, " + pct(sticky.miss) + " stuck to one follower, " + pct(window.miss) + " reading from the leader for " + WINDOW + " s after a save, which sent " + pct(window.leader) + " of all reads to the leader.",
        "Lecturas tras guardar sin lo guardado: el " + pct(any.miss) + " con lecturas a cualquier réplica, el " + pct(sticky.miss) + " fijo a una réplica y el " + pct(window.miss) + " leyendo del líder durante " + WINDOW + " s después de guardar, lo que mandó al líder el " + pct(window.leader) + " de todas las lecturas."),
      groups: [
        { title: t("Read-backs missing the save", "Lecturas tras guardar sin lo guardado"), bars: [[t("Any follower", "Cualquier réplica"), any.miss / m, pct(any.miss)], [t("Same follower", "Siempre la misma réplica"), sticky.miss / m, pct(sticky.miss), true], [t("Leader " + WINDOW + " s after a save", "Líder " + WINDOW + " s tras guardar"), window.miss / m, pct(window.miss)]] },
        { title: t("Reads served by the leader", "Lecturas atendidas por el líder"), bars: [[t("Any follower", "Cualquier réplica"), any.leader, pct(any.leader)], [t("Same follower", "Siempre la misma réplica"), sticky.leader, pct(sticky.leader)], [t("Leader " + WINDOW + " s after a save", "Líder " + WINDOW + " s tras guardar"), window.leader, pct(window.leader), true]] },
      ],
    };
  },
  sync: () => {
    const { async: a, semi, sync } = R.sync, m = top(a.miss), mt = top(sync.p99);
    return {
      verdict: t("Read-backs missing the save: " + pct(a.miss) + " async, " + pct(semi.miss) + " semi-synchronous, " + pct(sync.miss) + " synchronous. A save took " + ms(a.p50) + ", " + ms(semi.p50) + " and " + ms(sync.p50) + " at the median, and " + ms(sync.p99) + " at p99 when it waited for both followers.",
        "Lecturas tras guardar sin lo guardado: el " + pct(a.miss) + " asíncrona, el " + pct(semi.miss) + " semisíncrona y el " + pct(sync.miss) + " síncrona. Un guardado tardó " + ms(a.p50) + ", " + ms(semi.p50) + " y " + ms(sync.p50) + " en la mediana, y " + ms(sync.p99) + " en el p99 cuando esperaba a las dos réplicas."),
      groups: [
        { title: t("Read-backs missing the save", "Lecturas tras guardar sin lo guardado"), bars: [[t("Async", "Asíncrona"), a.miss / m, pct(a.miss)], [t("Semi-sync: one received", "Semisíncrona: una la recibió"), semi.miss / m, pct(semi.miss), true], [t("Sync: both applied", "Síncrona: ambas la aplicaron"), sync.miss / m, pct(sync.miss)]] },
        { title: t("Save time, median", "Tiempo de guardado, mediana"), bars: [[t("Async", "Asíncrona"), a.p50 / mt, ms(a.p50)], [t("Semi-sync: one received", "Semisíncrona: una la recibió"), semi.p50 / mt, ms(semi.p50)], [t("Sync: both applied", "Síncrona: ambas la aplicaron"), sync.p50 / mt, ms(sync.p50), true]] },
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
        { title: t("Reads missing the user's save, per burst", "Lecturas sin lo guardado, por ráfaga"), bars: [[t("Leader " + WINDOW + " s after a save", "Líder " + WINDOW + " s tras guardar"), Math.min(1, w.missN / top(w.missN)), per(w.missN), true], [t("Follower caught up to my LSN", "Réplica al día con mi LSN"), token.missN / top(w.missN), per(token.missN)]] },
      ],
    };
  },
};

const { move: M, mono: N, ryw: Y, sync: Z, burst: B } = R;
const DELAY = ms(M.any.delay), DELAY_B = ms(N.any.delayB);

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
      "Asynchronous replication means the leader answers the save as soon as the write is in its own log, and ships it to the followers afterwards: here they applied each write " + DELAY + " after its commit on average. A read-back that lands on a follower sooner than that reads a copy without the save, so " + pct(M.any.miss) + " of read-backs missed it, with nothing failing and both followers keeping up. That is the normal state of async replication, not an incident. Over every read by users who had saved something, only " + pct(M.any.own) + " missed, which is why it hides in a dashboard and is obvious to the user who just pressed Save. On a quiet replica in the same zone lag is often a few milliseconds and the share is smaller, but never zero, and it climbs whenever lag does (experiment 5). The times here are illustrative and round.",
      "Replicación asíncrona significa que el líder responde el guardado apenas la escritura está en su propio log, y se la envía a las réplicas después: aquí aplicaban cada escritura " + DELAY + " después de su commit en promedio. Una lectura tras guardar que cae en una réplica antes de eso lee una copia sin el cambio, así que el " + pct(M.any.miss) + " de las lecturas tras guardar no lo tenía, sin que nada fallara y con las dos réplicas al día. Es el estado normal de la replicación asíncrona, no un incidente. Sobre todas las lecturas de usuarios que ya habían guardado algo, faltó solo en el " + pct(M.any.own) + ", y por eso se esconde en un panel de métricas y es evidente para el usuario que acaba de tocar Guardar. En una réplica tranquila en la misma zona el retraso suele ser de pocos milisegundos y la parte es menor, pero nunca cero, y sube cada vez que sube el retraso (experimento 5). Los tiempos aquí son ilustrativos y redondos.",
    ),
    watch: { route: "any", commit: "async", b: "healthy" },
  },
  {
    id: "mono",
    title: t("Two reads in a row", "Dos lecturas seguidas"),
    change: t("Follower B falls behind (a slower link and slower replay: it applies writes " + DELAY_B + " after their commit on average) · a user reads twice, " + QUICK_RANGE + " apart · reads to any follower vs each user always reading from the same follower",
      "La réplica B se atrasa (un enlace más lento y una aplicación más lenta: aplica las escrituras " + DELAY_B + " después de su commit en promedio) · un usuario lee dos veces, con " + QUICK_RANGE + " de diferencia · lecturas a cualquier réplica vs cada usuario leyendo siempre de la misma réplica"),
    question: t("With reads going to any follower, how often does the second read show less than the first: a comment that was there is gone?",
      "Con las lecturas yendo a cualquier réplica, ¿qué tan seguido muestra la segunda lectura menos que la primera: un comentario que estaba ya no está?"),
    options: [
      t("Never: a replica's state only ever moves forward", "Nunca: el estado de una réplica solo avanza"),
      t("Sometimes: when the first read lands on A and the second on B", "A veces: cuando la primera lectura cae en A y la segunda en B"),
      t("About half the time: whenever the two reads hit different followers", "Más o menos la mitad: siempre que las dos lecturas van a réplicas distintas"),
    ],
    answer: 1,
    why: t(
      "Each follower only moves forward, but the two are at different points: B is about " + ms(N.any.delayB - N.any.delayA) + " behind A. When the first read lands on A and the second on B before B has caught up to where A was, the user sees time go backwards: " + pct(N.any.quick) + " of quick second reads here. Only that order hurts; going from B to A moves forward, which is why it isn't half of the mixed pairs. The guarantee that a user never sees older data after newer is called monotonic reads. Stick each user to one follower (pick it from a hash of the user ID) and it drops to " + pct(N.sticky.quick) + ". That doesn't make B any fresher: the users stuck to B see older data, but consistently. If their follower fails they move to another, which may be behind the first.",
      "Cada réplica solo avanza, pero las dos están en puntos distintos: B va unos " + ms(N.any.delayB - N.any.delayA) + " detrás de A. Cuando la primera lectura cae en A y la segunda en B antes de que B llegue a donde estaba A, el usuario ve el tiempo ir hacia atrás: el " + pct(N.any.quick) + " de las segundas lecturas rápidas aquí. Solo ese orden hace daño; pasar de B a A avanza, y por eso no es la mitad de los pares mezclados. La garantía de que un usuario nunca vea datos más viejos después de unos más nuevos se llama lecturas monótonas (monotonic reads). Fija cada usuario a una réplica (elígela con un hash del ID de usuario) y baja al " + pct(N.sticky.quick) + ". Eso no hace más fresca a B: los usuarios fijos a B ven datos más viejos, pero de forma consistente. Si su réplica falla pasan a otra, que puede estar detrás de la primera.",
    ),
    watch: { route: "any", commit: "async", b: "slow" },
  },
  {
    id: "sticky",
    title: t("Stuck to one follower, after a save", "Fijo a una réplica, después de guardar"),
    change: t("Follower B still slow · reads to any follower vs each user stuck to one follower vs the leader for " + WINDOW + " s after the user's own save, then any follower",
      "La réplica B sigue lenta · lecturas a cualquier réplica vs cada usuario fijo a una réplica vs el líder durante " + WINDOW + " s después del guardado del propio usuario, y después cualquier réplica"),
    question: t("With each user stuck to one follower, how often does a read-back miss the user's own save?",
      "Con cada usuario fijo a una réplica, ¿qué tan seguido una lectura tras guardar no tiene lo que el usuario guardó?"),
    options: [
      t("Never: the user always reads the same copy", "Nunca: el usuario siempre lee la misma copia"),
      t("About as often as with reads to any follower", "Más o menos tanto como con lecturas a cualquier réplica"),
      t("Rarely: the fix for going back fixes this too", "Pocas veces: lo que arregla el retroceso también arregla esto"),
    ],
    answer: 1,
    why: t(
      "Sticking to a follower makes a user's reads agree with each other; it does nothing to make that follower have the user's write. A read-back still beats replication as often as before: " + pct(Y.sticky.miss) + " stuck to one follower, " + pct(Y.any.miss) + " spread over both (users stuck to B missed " + pct(Y.sticky.missB) + ", users on A " + pct(Y.sticky.missA) + "). Read-your-writes needs the read to go somewhere that has the write. Reading from the leader for " + WINDOW + " s after the user's own save brings it to " + pct(Y.window.miss) + ", but it sends " + pct(Y.window.leader) + " of all reads back to the leader, the load the followers were there to take, and it doesn't stop a second read from going back: a read on the leader followed by one on a follower can (" + pct(Y.window.quick) + " of quick second reads). Rails' automatic role switching works this way, reading from the primary for 2 s after a write by default.",
      "Fijarse a una réplica hace que las lecturas de un usuario coincidan entre sí; no hace que esa réplica tenga la escritura del usuario. Una lectura tras guardar le sigue ganando a la replicación tan seguido como antes: el " + pct(Y.sticky.miss) + " fijo a una réplica, el " + pct(Y.any.miss) + " repartido entre ambas (los usuarios fijos a B fallaron el " + pct(Y.sticky.missB) + ", los de A el " + pct(Y.sticky.missA) + "). Leer tus propias escrituras (read-your-writes) necesita que la lectura vaya a un lugar que tenga la escritura. Leer del líder durante " + WINDOW + " s después del guardado del propio usuario la baja al " + pct(Y.window.miss) + ", pero manda de vuelta al líder el " + pct(Y.window.leader) + " de todas las lecturas, la carga que las réplicas debían quitarle, y no evita que una segunda lectura retroceda: una lectura en el líder seguida de una en una réplica puede hacerlo (el " + pct(Y.window.quick) + " de las segundas lecturas rápidas). El cambio automático de rol de Rails funciona así: lee del primario durante 2 s después de una escritura, por defecto.",
    ),
    watch: { route: "sticky", commit: "async", b: "slow" },
  },
  {
    id: "sync",
    title: t("Make the save wait", "Hacer esperar al guardado"),
    change: t("Follower B still slow · reads to any follower · the leader answers a save once the write is in its own log (async) vs once one follower has received it (semi-synchronous) vs once both followers have applied it (synchronous)",
      "La réplica B sigue lenta · lecturas a cualquier réplica · el líder responde un guardado cuando la escritura está en su propio log (asíncrona) vs cuando una réplica la recibió (semisíncrona) vs cuando las dos réplicas la aplicaron (síncrona)"),
    question: t("With semi-synchronous replication, how often does a read-back still miss the user's save?",
      "Con replicación semisíncrona, ¿qué tan seguido una lectura tras guardar sigue sin tener lo que el usuario guardó?"),
    options: [
      t("Never: a follower has the write before the save returns", "Nunca: una réplica tiene la escritura antes de que vuelva el guardado"),
      t("Still often: received isn't applied, and the read can go to the other follower", "Todavía seguido: recibida no es aplicada, y la lectura puede ir a la otra réplica"),
      t("Only when the follower that received it crashes before applying it", "Solo cuando la réplica que la recibió se cae antes de aplicarla"),
    ],
    answer: 1,
    why: t(
      "Semi-synchronous replication (MySQL's, for example) waits until one follower has received the write and stored it in its log, not until it has applied it: it is there so an acknowledged write survives the leader dying. The fast follower acknowledges, and a save takes " + ms(Z.semi.p50) + " instead of " + ms(Z.async.p50) + ". The read-back then lands on B half the time, still far behind, or on A before it has replayed: " + pct(Z.semi.miss) + " of read-backs missed, against " + pct(Z.async.miss) + " async (fewer only because the save itself took longer). Waiting until both followers have applied the write (PostgreSQL's synchronous_commit = remote_apply, with both standbys synchronous) does give read-your-writes, " + pct(Z.sync.miss) + ", but every save waits for the slowest follower: " + ms(Z.sync.p50) + " at the median, " + ms(Z.sync.p99) + " at p99. And if a follower the leader waits for stops, saves stop with it: PostgreSQL waits for a synchronous standby indefinitely, and MySQL's semi-sync falls back to async after a timeout, 10 s by default.",
      "La replicación semisíncrona (la de MySQL, por ejemplo) espera a que una réplica haya recibido la escritura y la haya guardado en su log, no a que la haya aplicado: existe para que una escritura confirmada sobreviva a la caída del líder. Confirma la réplica rápida, y un guardado tarda " + ms(Z.semi.p50) + " en lugar de " + ms(Z.async.p50) + ". Después la lectura tras guardar cae en B la mitad de las veces, todavía muy atrasada, o en A antes de que la aplique: el " + pct(Z.semi.miss) + " de las lecturas tras guardar no lo tenía, contra el " + pct(Z.async.miss) + " asíncrona (menos solo porque el guardado mismo tardó más). Esperar a que las dos réplicas apliquen la escritura (synchronous_commit = remote_apply de PostgreSQL, con las dos réplicas síncronas) sí da leer tus propias escrituras, el " + pct(Z.sync.miss) + ", pero cada guardado espera a la réplica más lenta: " + ms(Z.sync.p50) + " en la mediana y " + ms(Z.sync.p99) + " en el p99. Y si una réplica a la que el líder espera se detiene, los guardados se detienen con ella: PostgreSQL espera a una réplica síncrona indefinidamente, y la semisíncrona de MySQL vuelve a asíncrona tras un tiempo límite (timeout), 10 s por defecto.",
    ),
    watch: { route: "any", commit: "semi", b: "slow" },
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
    watch: { route: "window", commit: "async", b: "healthy", burst: true, speed: 0.25 },
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
  [t("Synchronous replication: what does it protect, what does it cost, and what happens when the synchronous follower goes down?", "Replicación síncrona: ¿qué protege, qué cuesta y qué pasa cuando se cae la réplica síncrona?"),
   t("It protects acknowledged writes: when the leader says yes, a follower has the write too, so losing the leader loses nothing that was acknowledged; waiting for apply (remote_apply) also lets reads on that follower see the write. It costs a round trip to the follower on every commit, the slowest follower's time if you wait for several, and availability: with nobody to acknowledge, commits wait. Common setups wait for any one of several followers (PostgreSQL's ANY 1 (…)), so one slow or failed follower doesn't stall writes; MySQL's semi-sync falls back to async after its timeout, trading the guarantee for availability.",
     "Protege las escrituras confirmadas: cuando el líder dice que sí, una réplica también tiene la escritura, así que perder el líder no pierde nada confirmado; esperar a que se aplique (remote_apply) además permite que las lecturas en esa réplica la vean. Cuesta una ida y vuelta a la réplica en cada commit, el tiempo de la réplica más lenta si esperas a varias, y disponibilidad: sin nadie que confirme, los commits esperan. Las configuraciones comunes esperan a cualquiera de varias réplicas (ANY 1 (…) en PostgreSQL), para que una réplica lenta o caída no detenga las escrituras; la semisíncrona de MySQL vuelve a asíncrona tras su tiempo límite, y cambia la garantía por disponibilidad.")],
  [t("With asynchronous replication the leader crashes and follower A is promoted. What happens to the writes A hadn't received, and what does lag have to do with it?", "Con replicación asíncrona el líder se cae y la réplica A pasa a ser líder. ¿Qué pasa con las escrituras que A no había recibido, y qué tiene que ver el retraso?"),
   t("They are gone from the new leader, even though users were told they were saved; if the old leader comes back it holds writes nobody else has, which must be discarded or reconciled (PostgreSQL's pg_rewind rewinds it to follow the new leader). The lag at the moment of the crash is how much you lose, so promote the most caught-up follower, alert on lag, and use semi-sync or sync where losing an acknowledged write is unacceptable. Making sure the old leader can't keep accepting writes is lesson 63, Leader Election, and lesson 62, Leases & Fencing Tokens.",
     "Desaparecen del nuevo líder, aunque a los usuarios se les dijo que se guardaron; si el líder viejo vuelve, tiene escrituras que nadie más tiene, que hay que descartar o conciliar (pg_rewind de PostgreSQL lo rebobina para que siga al nuevo líder). El retraso en el momento de la caída es lo que pierdes, así que promueve a la réplica más al día, alerta sobre el retraso y usa replicación semisíncrona o síncrona donde perder una escritura confirmada no es aceptable. Asegurarte de que el líder viejo no siga aceptando escrituras es el tema de la lección 63, Elección de líder, y de la lección 62, Arrendamientos y tokens de cerco.")],
];

export default defineLesson({
  title: t("Replication Lag Workbench", "Banco de trabajo: retraso de replicación"),
  eyebrow: t("Systems lesson 60 · Replication lag", "Lección de sistemas 60 · Retraso de replicación"),
  lede: t("With asynchronous replication, a write lands on the leader first and on the followers that serve reads a little later. That gap is replication lag: users meet it as a save they can't see, or a page that goes back in time. This lesson turns it into a main ledger with two copy desks fed by conveyors: watch it, predict what breaks it, then explain it back.",
    "Con replicación asíncrona, una escritura llega primero al líder y un poco después a las réplicas que atienden las lecturas. Esa diferencia es el retraso de replicación (replication lag): los usuarios lo ven como un guardado que no aparece o una página que vuelve atrás en el tiempo. Esta lección lo convierte en un libro mayor con dos mesas de copia alimentadas por cintas: mírala, predice qué la rompe y después explícala."),
  machine: {
    intro: t("Every write gets the leader's next log sequence number (LSN) and rides a conveyor to each follower, which copies the slips into its own ledger one at a time. You save every couple of seconds, read the page right after, and look twice more; your latest slip is lit. Change where reads go, what a save waits for, and how follower B is doing, or press Save yourself.",
      "Cada escritura recibe el siguiente número de secuencia del log del líder (LSN, log sequence number) y viaja en una cinta a cada réplica, que copia los papeles en su propio libro uno a la vez. Guardas cada par de segundos, lees la página justo después y miras dos veces más; tu último papel está encendido. Cambia a dónde van las lecturas, qué espera un guardado y cómo está la réplica B, o toca Guardar tú."),
    plate: {
      title: t("Copy desks", "Mesas de copia"),
      keys: [
        { mark: "lit", label: t("Your latest save's slip, the desks that have it, where your last read was served, and a read that missed it or went back", "El papel de tu último guardado, las mesas que lo tienen, dónde se atendió tu última lectura, y una lectura que no lo tenía o retrocedió") },
        { mark: "raised", label: t("The leader, the follower desks, the slips on their way", "El líder, las mesas de las réplicas, los papeles en camino") },
        { mark: "flat", label: t("The conveyors: the replication stream, in log order", "Las cintas: el flujo de replicación, en el orden del log") },
      ],
      caption: t(
        "Played at a tenth of real speed (change it under Speed). The times are illustrative and round: a write reaches a healthy follower " + range(NET.healthy) + " after its commit and takes " + Math.round(1000 * APPLY.healthy) + " ms to replay; a slow B takes " + range(NET.slow) + " and " + Math.round(1000 * APPLY.slow) + " ms. " + USERS + " users browse and save; everyone else adds about " + OTHERS + " writes a second. LSN is the leader's last write; AT, the last one a desk has copied; LAG, how old the oldest write it hasn't copied is. MISSING counts read-backs (the read " + BACK_RANGE + " after a save) without the user's save; WENT BACK, second reads that showed less than the read before.",
        "Se reproduce a un décimo de la velocidad real (cámbiala en Velocidad). Los tiempos son ilustrativos y redondos: una escritura llega a una réplica sana " + range(NET.healthy) + " después de su commit y tarda " + Math.round(1000 * APPLY.healthy) + " ms en aplicarse; una B lenta tarda " + range(NET.slow) + " y " + Math.round(1000 * APPLY.slow) + " ms. " + USERS + " usuarios navegan y guardan; todos los demás agregan unas " + OTHERS + " escrituras por segundo. LSN es la última escritura del líder; EN, la última que copió una mesa; RETRASO, qué tan vieja es la escritura más antigua que todavía no copió. FALTA cuenta las lecturas tras guardar (la lectura " + BACK_RANGE + " después de un guardado) sin lo que el usuario guardó; RETROCEDIÓ, las segundas lecturas que mostraron menos que la anterior.",
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
      { actions: [["save", t("Save", "Guardar"), { primary: true }], ["burst", t("Write burst", "Ráfaga de escrituras")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Save writes for you now; Write burst runs a batch job of " + BURST.rate + " writes a second for " + BURST.dur + " s. The first two stats count every user since the run started.",
      "Cambiar un ajuste reinicia la ejecución. Guardar escribe por ti ahora; Ráfaga de escrituras lanza un proceso por lotes de " + BURST.rate + " escrituras por segundo durante " + BURST.dur + " s. Las dos primeras estadísticas cuentan a todos los usuarios desde que empezó la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of ten minutes each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de diez minutos cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The consistency guarantees follow the usual definitions (read-your-writes, monotonic reads); the settings named are PostgreSQL's and MySQL's.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Las garantías de consistencia siguen las definiciones usuales (leer tus propias escrituras, lecturas monótonas); los ajustes que se nombran son los de PostgreSQL y MySQL.`),
  css: LIT_FILL_CSS,
  data: { P, G: GEOMETRY, SLIP_SVG: slipSvg(), BURST, WINDOW },
});
