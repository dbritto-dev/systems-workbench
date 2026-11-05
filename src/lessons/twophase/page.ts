// @ts-nocheck: content in the style of the other lessons
// Systems lesson 64 · Two-phase commit: a coordinator's desk and three counters that commit one transaction together.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, msOrSecs, one } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, envelopeSvg, customerSvg, P, GEOMETRY } from "./figure";
import { crashRun, slowRun, farRun, logRun, peersRun, NET, OUTAGE, UNPREPARED, DOUBT, RETRY, NO_SHARE, SEEDS, RUN } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds of a minute each).
const R = { crash: crashRun(), slow: slowRun(), far: farRun(), log: logRun(), peers: peersRun() };

const ms = (x) => msOrSecs(x);
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const n0 = (x) => String(Math.round(x));
// an average that comes out whole prints whole (12 of 12, 0 served)
const cnt = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? n0(x) : one(x));
const NEAR = Math.round(NET.near * 1000) + " ms", FAR = Math.round(NET.far * 1000) + " ms";
const DOWN = OUTAGE.toFixed(1) + " s";
const GIVE_UP = Math.round(UNPREPARED.near * 1000) + " ms", GIVE_UP_FAR = Math.round(UNPREPARED.far * 1000) + " ms";
const ASK = Math.round(DOUBT.near * 1000) + " ms", ASK_FAR = Math.round(DOUBT.far * 1000) + " ms", AGAIN = Math.round(RETRY * 1000) + " ms";
const NO_EVERY = Math.round(1 / NO_SHARE);
const CRASHES = n0(R.crash.voted.crashes);

// What each card shows after a run.
const RUNS = {
  crash: () => {
    const { before, voted } = R.crash, m = top(voted.locked);
    return {
      verdict: t("Before PREPARE: the rows stayed locked " + ms(before.locked) + ", then each participant rolled back on its own, and each counter served " + one(before.served) + " customers during the outage. While the votes came in: rows locked " + ms(voted.locked) + ", up to " + one(voted.peak) + " customers in line at a counter, " + cnt(voted.served) + " served, and every transaction ended rolled back once the coordinator answered.",
        "Antes de PREPARAR: las filas quedaron bloqueadas " + ms(before.locked) + ", luego cada participante revirtió por su cuenta, y cada mostrador atendió a " + one(before.served) + " clientes durante la caída. Mientras llegaban los votos: filas bloqueadas " + ms(voted.locked) + ", hasta " + one(voted.peak) + " clientes en fila en un mostrador, " + cnt(voted.served) + " atendidos, y cada transacción terminó revertida cuando el coordinador respondió."),
      groups: [
        { title: t("Rows locked by the crashed transaction", "Filas bloqueadas por la transacción caída"), bars: [[t("Crash before PREPARE", "Caída antes de PREPARAR"), before.locked / m, ms(before.locked)], [t("Crash while votes come in", "Caída mientras llegan los votos"), voted.locked / m, ms(voted.locked), true]] },
        { title: t("Customers served per counter during the outage", "Clientes atendidos por mostrador durante la caída"), bars: [[t("Crash before PREPARE", "Caída antes de PREPARAR"), before.served / top(before.served), one(before.served)], [t("Crash while votes come in", "Caída mientras llegan los votos"), voted.served / top(before.served), cnt(voted.served), true]] },
      ],
    };
  },
  slow: () => {
    const { normal, slow } = R.slow, m = top(slow.holdA, slow.holdB), w = top(slow.waitA);
    return {
      verdict: t("B normal: A held its row " + ms(normal.holdA) + " per transaction. B slow: A held it " + ms(slow.holdA) + ", the same as B (" + ms(slow.holdB) + "), and A's own customers waited " + ms(slow.waitA) + " on average instead of " + ms(normal.waitA) + ".",
        "B normal: A retuvo su fila " + ms(normal.holdA) + " por transacción. B lento: A la retuvo " + ms(slow.holdA) + ", lo mismo que B (" + ms(slow.holdB) + "), y los clientes propios de A esperaron " + ms(slow.waitA) + " en promedio en vez de " + ms(normal.waitA) + "."),
      groups: [
        { title: t("Row lock per transaction", "Bloqueo de fila por transacción"), bars: [[t("A, B normal", "A, B normal"), normal.holdA / m, ms(normal.holdA)], [t("A, B slow", "A, B lento"), slow.holdA / m, ms(slow.holdA), true], [t("B, B slow", "B, B lento"), slow.holdB / m, ms(slow.holdB)]] },
        { title: t("A's customers, average wait", "Clientes de A, espera promedio"), bars: [[t("B normal", "B normal"), normal.waitA / w, ms(normal.waitA)], [t("B slow", "B lento"), slow.waitA / w, ms(slow.waitA), true]] },
      ],
    };
  },
  far: () => {
    const { near, far } = R.far, m = top(near.perSec, 10), h = top(far.holdA);
    return {
      verdict: t("At " + NEAR + " a message: each row lock lasted " + ms(near.holdA) + " and " + one(near.perSec) + " of the 10 transactions a second committed. At " + FAR + ": " + ms(far.holdA) + " per lock, " + one(far.perSec) + " committed a second, and " + n0(far.inFlight) + " transactions were waiting after a minute, still growing.",
        "A " + NEAR + " por mensaje: cada bloqueo de fila duró " + ms(near.holdA) + " y se confirmaron " + one(near.perSec) + " de las 10 transacciones por segundo. A " + FAR + ": " + ms(far.holdA) + " por bloqueo, " + one(far.perSec) + " confirmadas por segundo, y " + n0(far.inFlight) + " transacciones esperando después de un minuto, y sigue creciendo."),
      groups: [
        { title: t("Committed a second (10 offered)", "Confirmadas por segundo (10 ofrecidas)"), bars: [[NEAR, near.perSec / m, one(near.perSec)], [FAR, far.perSec / m, one(far.perSec), true]] },
        { title: t("Row lock per transaction", "Bloqueo de fila por transacción"), bars: [[NEAR, near.holdA / h, ms(near.holdA)], [FAR, far.holdA / h, ms(far.holdA), true]] },
      ],
    };
  },
  log: () => {
    const { log, memory } = R.log, m = top(log.crashes);
    return {
      verdict: t("Decision in memory only: " + cnt(memory.split) + " of " + n0(memory.crashes) + " crashed transactions ended split, committed at A and rolled back at B and C. Decision logged first: " + cnt(log.split) + " split; " + cnt(log.allCommit) + " of " + n0(log.crashes) + " committed everywhere once the coordinator sent COMMIT again, after B and C held their rows " + ms(log.lockedBC) + ".",
        "Decisión solo en memoria: " + cnt(memory.split) + " de " + n0(memory.crashes) + " transacciones caídas terminaron divididas, confirmadas en A y revertidas en B y C. Decisión primero al log: " + cnt(log.split) + " divididas; " + cnt(log.allCommit) + " de " + n0(log.crashes) + " confirmadas en todos cuando el coordinador volvió a enviar CONFIRMAR, después de que B y C retuvieran sus filas " + ms(log.lockedBC) + "."),
      groups: [
        { title: t("Split outcomes", "Resultados divididos"), bars: [[t("In memory only", "Solo en memoria"), memory.split / m, cnt(memory.split), true], [t("Logged first", "Primero al log"), log.split / m, cnt(log.split)]] },
        { title: t("Committed everywhere", "Confirmadas en todos"), bars: [[t("In memory only", "Solo en memoria"), memory.allCommit / m, cnt(memory.allCommit)], [t("Logged first", "Primero al log"), log.allCommit / m, cnt(log.allCommit)]] },
      ],
    };
  },
  peers: () => {
    const { wait, peers } = R.peers;
    return {
      verdict: t("Waiting for the coordinator: the rows stayed locked until it was back in " + pct(wait.blocked) + " of crashes. Asking the others too: " + pct(peers.blocked) + ". The crashes they settled were the ones where B had voted no (" + pct(peers.bNo) + "); when all three had voted yes, asking changed nothing.",
        "Esperando al coordinador: las filas quedaron bloqueadas hasta que volvió en el " + pct(wait.blocked) + " de las caídas. Preguntando también a los otros: " + pct(peers.blocked) + ". Las caídas que resolvieron fueron aquellas en que B había votado no (" + pct(peers.bNo) + "); cuando los tres habían votado sí, preguntar no cambió nada."),
      groups: [
        { title: t("Rows locked until the coordinator was back", "Filas bloqueadas hasta que volvió el coordinador"), bars: [[t("Wait for the coordinator", "Esperar al coordinador"), wait.blocked, pct(wait.blocked)], [t("Ask the others too", "Preguntar también a los otros"), peers.blocked, pct(peers.blocked), true]] },
        { title: t("A's row locked, average", "Fila de A bloqueada, promedio"), bars: [[t("Wait for the coordinator", "Esperar al coordinador"), wait.lockedA / top(wait.lockedA), ms(wait.lockedA)], [t("Ask the others too", "Preguntar también a los otros"), peers.lockedA / top(wait.lockedA), ms(peers.lockedA), true]] },
      ],
    };
  },
};

const { crash: C, slow: W, far: F, log: G, peers: Q } = R;

const EXPERIMENTS = [
  {
    id: "crash",
    title: t("The coordinator crashes mid-commit", "El coordinador se cae a mitad del commit"),
    change: t("The coordinator crashes and is back " + DOWN + " later · before it sends PREPARE vs after, while the votes come in · A, B and C all vote yes · " + CRASHES + " crashes a run",
      "El coordinador se cae y vuelve " + DOWN + " después · antes de enviar PREPARAR vs después, mientras llegan los votos · A, B y C votan sí · " + CRASHES + " caídas por ejecución"),
    question: t("When it crashes while the votes come in, what do A, B and C do with their rows until it's back?", "Cuando se cae mientras llegan los votos, ¿qué hacen A, B y C con sus filas hasta que vuelve?"),
    options: [
      t("Time out after a moment and roll back, freeing the rows", "Agotan un tiempo límite, revierten y liberan las filas"),
      t("Keep the rows locked until the coordinator answers", "Mantienen las filas bloqueadas hasta que el coordinador responde"),
      t("Commit on their own, since all three voted yes", "Confirman por su cuenta, ya que los tres votaron sí"),
    ],
    answer: 1,
    why: t(
      "Before PREPARE, nobody has promised anything: each participant waits out its timeout (" + GIVE_UP + " here), rolls back and frees its row, and its customers are served while the coordinator is still down. A yes vote changes that. The participant has written a prepare record to its own log and promised to commit if told to, and it doesn't know how the others voted. It can't roll back on its own, because the coordinator may already have decided to commit and told the client; it can't commit on its own, because someone may have voted no. It is in doubt, and its row stays locked until it hears the decision: " + ms(C.voted.locked) + " here against " + ms(C.before.locked) + ", the whole outage plus the next question, with nobody served. That is the blocking problem of two-phase commit. A real outage lasts as long as the restart or the failover, often minutes, and the rows stay locked all that time.",
      "Antes de PREPARAR, nadie prometió nada: cada participante espera su tiempo límite (timeout, " + GIVE_UP + " aquí), revierte y libera su fila, y sus clientes se atienden aunque el coordinador siga caído. Un voto sí cambia eso. El participante escribió un registro de preparación en su propio log y prometió confirmar (commit) si se lo piden, y no sabe cómo votaron los demás. No puede revertir por su cuenta, porque el coordinador quizá ya decidió confirmar y se lo dijo al cliente; no puede confirmar por su cuenta, porque alguien quizá votó no. Está en duda (in doubt), y su fila sigue bloqueada (lock) hasta que conoce la decisión: " + ms(C.voted.locked) + " aquí contra " + ms(C.before.locked) + ", toda la caída más la siguiente consulta, sin atender a nadie. Ese es el problema de bloqueo del commit en dos fases. Una caída real dura lo que tarde el reinicio o la conmutación (failover), a menudo minutos, y las filas siguen bloqueadas todo ese tiempo.",
    ),
    watch: { crash: "voted", b: "normal", net: "near", log: "log", doubt: "wait", arm: 0.1 },
  },
  {
    id: "slow",
    title: t("One slow participant", "Un participante lento"),
    change: t("B's work takes 40–60 ms instead of 5–15 ms · A and C unchanged · 10 transactions a second", "El trabajo de B tarda 40–60 ms en vez de 5–15 ms · A y C sin cambios · 10 transacciones por segundo"),
    question: t("How long does A now hold its row for each transaction?", "¿Cuánto retiene A ahora su fila por cada transacción?"),
    options: [
      t("About as before: A's own work didn't change", "Más o menos lo mismo: el trabajo de A no cambió"),
      t("About as long as B holds its own row", "Más o menos lo mismo que B retiene la suya"),
      t("A little longer: one more message to wait for", "Un poco más: un mensaje más que esperar"),
    ],
    answer: 1,
    why: t(
      "A finishes its work quickly, but the coordinator can't send PREPARE until B is done too, and can't send COMMIT until every vote is in. A keeps its lock until the decision reaches it, the same moment as B: " + ms(W.normal.holdA) + " → " + ms(W.slow.holdA) + " a transaction, the same as B. Every participant holds its locks for the slowest participant's work plus the protocol's trips, so A's own customers now wait " + ms(W.slow.waitA) + " on average instead of " + ms(W.normal.waitA) + ", for a row A finished with long ago. Two-phase commit ties the participants together: their lock time is the slowest one's. That is why distributed transactions should do their reads and checks before taking locks, and touch as few participants as they can.",
      "A termina su trabajo rápido, pero el coordinador no puede enviar PREPARAR hasta que B también termine, ni CONFIRMAR hasta tener todos los votos. A mantiene su bloqueo hasta que le llega la decisión, en el mismo momento que B: " + ms(W.normal.holdA) + " → " + ms(W.slow.holdA) + " por transacción, lo mismo que B. Cada participante retiene sus bloqueos durante el trabajo del participante más lento más los viajes del protocolo, así que los clientes propios de A ahora esperan " + ms(W.slow.waitA) + " en promedio en vez de " + ms(W.normal.waitA) + ", por una fila con la que A terminó hace rato. El commit en dos fases ata a los participantes: su tiempo de bloqueo es el del más lento. Por eso las transacciones distribuidas deberían hacer sus lecturas y validaciones antes de tomar bloqueos, y tocar la menor cantidad de participantes posible.",
    ),
    watch: { crash: "voted", b: "slow", net: "near", log: "log", doubt: "wait" },
  },
  {
    id: "far",
    title: t("Across regions", "Entre regiones"),
    change: t("Every message takes " + FAR + " one way instead of " + NEAR + " (another region) · the same work, the same disks · 10 transactions a second, each touching the hot row at A, B and C",
      "Cada mensaje tarda " + FAR + " de ida en vez de " + NEAR + " (otra región) · el mismo trabajo, los mismos discos · 10 transacciones por segundo, cada una toca la fila caliente de A, B y C"),
    question: t("How many transactions a second get committed now?", "¿Cuántas transacciones por segundo se confirman ahora?"),
    options: [
      t("All 10: distance slows each one down, not the rate", "Las 10: la distancia hace más lenta cada una, no baja la tasa"),
      t("Fewer than 10: the hot rows cap the rate", "Menos de 10: las filas calientes limitan la tasa"),
      t("All 10, since transactions overlap on the network", "Las 10, porque las transacciones se superponen en la red"),
    ],
    answer: 1,
    why: t(
      "A row lock is held from the WORK message to the decision: the work, the DONE, PREPARE, vote and decision trips, and two forced log writes. At " + NEAR + " a trip that is " + ms(F.near.holdA) + " a transaction; at " + FAR + " it is " + ms(F.far.holdA) + ". A hot row takes one transaction at a time, so it can't commit more than about one per lock time: " + one(F.near.perSec) + " → " + one(F.far.perSec) + " a second here, and the rest pile up (" + n0(F.far.inFlight) + " waiting after a minute). Overlapping doesn't help, because the transactions queue on the same lock. Network latency that would only slow a request down becomes lock time under two-phase commit, and on a hot row lock time is throughput. Keep transactions that span services rare, short and close together, and split hot rows where you can (several counter rows instead of one).",
      "Un bloqueo de fila se mantiene desde el mensaje TAREA hasta la decisión: el trabajo, los viajes de HECHO, PREPARAR, el voto y la decisión, y dos escrituras forzadas al log. A " + NEAR + " por viaje eso es " + ms(F.near.holdA) + " por transacción; a " + FAR + " es " + ms(F.far.holdA) + ". Una fila caliente (hot row) acepta una transacción a la vez, así que no puede confirmar más de una por tiempo de bloqueo: " + one(F.near.perSec) + " → " + one(F.far.perSec) + " por segundo aquí, y el resto se acumula (" + n0(F.far.inFlight) + " esperando después de un minuto). Superponerlas no ayuda, porque las transacciones hacen fila en el mismo bloqueo. La latencia de red, que solo haría más lenta una solicitud, se vuelve tiempo de bloqueo con el commit en dos fases, y en una fila caliente el tiempo de bloqueo es rendimiento. Mantén raras, cortas y cercanas las transacciones que cruzan servicios, y divide las filas calientes cuando puedas (varias filas contador en vez de una).",
    ),
    watch: { crash: "voted", b: "normal", net: "far", log: "log", doubt: "wait" },
  },
  {
    id: "log",
    title: t("COMMIT reaches A, then the coordinator crashes", "CONFIRMAR llega a A y el coordinador se cae"),
    change: t("The coordinator sends COMMIT to A and crashes before B and C · back " + DOWN + " later · its decision forced to its log before sending vs kept in memory only · " + n0(G.log.crashes) + " crashes a run",
      "El coordinador envía CONFIRMAR a A y se cae antes de B y C · vuelve " + DOWN + " después · su decisión forzada al log antes de enviarla vs guardada solo en memoria · " + n0(G.log.crashes) + " caídas por ejecución"),
    question: t("With the decision kept only in memory, how do the three participants end up?", "Con la decisión guardada solo en memoria, ¿cómo terminan los tres participantes?"),
    options: [
      t("All three commit: A's COMMIT settles it", "Los tres confirman: el CONFIRMAR de A lo resuelve"),
      t("All three roll back: the coordinator forgot", "Los tres revierten: el coordinador lo olvidó"),
      t("A committed; B and C roll back", "A confirmó; B y C revierten"),
    ],
    answer: 2,
    why: t(
      "A got COMMIT and committed, and that can't be taken back. B and C are in doubt and keep asking. A coordinator that kept the decision in memory comes back with no record of the transaction, and no record means abort (presumed abort), so B and C roll back: " + cnt(G.memory.split) + " split outcomes in " + n0(G.memory.crashes) + " crashes, the one thing a commit protocol exists to prevent. With the COMMIT record forced to its log before the first COMMIT goes out, the restarted coordinator reads it and sends COMMIT again: " + cnt(G.log.allCommit) + " of " + n0(G.log.crashes) + " committed everywhere, 0 split. That forced write is the commit point: once it is on disk the transaction is committed, whoever has heard. Participants follow the same rule, forcing a prepare record before they vote yes, so one that restarts still knows it is in doubt (lesson 66, Write-Ahead Log).",
      "A recibió CONFIRMAR y confirmó, y eso no se puede deshacer. B y C están en duda y siguen preguntando. Un coordinador que guardó la decisión en memoria vuelve sin registro de la transacción, y sin registro significa abortar (aborto presunto, presumed abort), así que B y C revierten: " + cnt(G.memory.split) + " resultados divididos en " + n0(G.memory.crashes) + " caídas, justo lo que un protocolo de commit existe para evitar. Con el registro CONFIRMAR forzado al log antes de que salga el primer CONFIRMAR, el coordinador al reiniciar lo lee y vuelve a enviar CONFIRMAR: " + cnt(G.log.allCommit) + " de " + n0(G.log.crashes) + " confirmadas en todos, 0 divididas. Esa escritura forzada es el punto de commit: una vez en disco, la transacción está confirmada, lo sepa quien lo sepa. Los participantes siguen la misma regla y fuerzan un registro de preparación antes de votar sí, así que uno que se reinicia sigue sabiendo que está en duda (lección 66, Registro de escritura anticipada).",
    ),
    watch: { crash: "midsend", b: "normal", net: "near", log: "memory", doubt: "wait", arm: 0.1 },
  },
  {
    id: "peers",
    title: t("Ask the other participants", "Preguntar a los otros participantes"),
    change: t("B votes no on 1 transaction in " + NO_EVERY + " · the coordinator crashes while the votes come in · a participant in doubt waits for the coordinator vs asks the other participants too",
      "B vota no en 1 de cada " + NO_EVERY + " transacciones · el coordinador se cae mientras llegan los votos · un participante en duda espera al coordinador vs pregunta también a los otros participantes"),
    question: t("Asking the others, how often do the rows stay locked until the coordinator is back?", "Preguntando a los otros, ¿qué tan seguido quedan bloqueadas las filas hasta que vuelve el coordinador?"),
    options: [
      t("Never: between them, the three can work it out", "Nunca: entre los tres pueden resolverlo"),
      t("Most of the time, even with the others to ask", "La mayoría de las veces, aun pudiendo preguntar"),
      t("Rarely: only when a peer is slow to answer", "Rara vez: solo cuando un par tarda en responder"),
    ],
    answer: 1,
    why: t(
      "A participant in doubt can learn the outcome from a peer that knows it: one that voted no (it rolled back at once), one that has already received the decision, or one that hasn't voted yet (it can still say no, so it rolls back and says so). Here that is B when it voted no, " + pct(Q.peers.bNo) + " of the crashes, and then A and C are free within milliseconds. When all three voted yes and none has heard the decision, nobody can decide: committing would be wrong if the coordinator had decided to abort (a vote that timed out, say), aborting would be wrong if it had committed and told the client. So the rows stayed locked until the coordinator was back in " + pct(Q.peers.blocked) + " of crashes, against " + pct(Q.wait.blocked) + " waiting. This is the cooperative termination protocol, and it shows the blocking window is built into two-phase commit: between the last yes and the decision, only the coordinator knows. Closing it takes replicating the coordinator's decision, so another node can finish from the log: Paxos Commit does that, and Spanner runs two-phase commit over Paxos groups.",
      "Un participante en duda puede conocer el resultado por un par que lo sepa: uno que votó no (revirtió de inmediato), uno que ya recibió la decisión, o uno que todavía no votó (aún puede decir que no, así que revierte y lo dice). Aquí ese es B cuando votó no, el " + pct(Q.peers.bNo) + " de las caídas, y entonces A y C quedan libres en milisegundos. Cuando los tres votaron sí y ninguno conoce la decisión, nadie puede decidir: confirmar estaría mal si el coordinador hubiera decidido abortar (por un voto que superó su tiempo límite, por ejemplo), abortar estaría mal si hubiera confirmado y se lo hubiera dicho al cliente. Así que las filas quedaron bloqueadas hasta que volvió el coordinador en el " + pct(Q.peers.blocked) + " de las caídas, contra el " + pct(Q.wait.blocked) + " esperando. Esto es el protocolo de terminación cooperativa (cooperative termination protocol), y muestra que la ventana de bloqueo es parte del commit en dos fases: entre el último sí y la decisión, solo el coordinador sabe. Cerrarla requiere replicar la decisión del coordinador, para que otro nodo pueda terminar desde el log: Paxos Commit hace eso, y Spanner ejecuta el commit en dos fases sobre grupos Paxos.",
    ),
    watch: { crash: "voted", b: "no", net: "near", log: "log", doubt: "peers", arm: 0.1 },
  },
];

const QUESTIONS = [
  [t("What does each phase of two-phase commit do, and where is the commit point?", "¿Qué hace cada fase del commit en dos fases y dónde está el punto de commit?"),
    t("Phase 1: the coordinator sends PREPARE; each participant makes its part durable and ready to commit (a forced prepare record, locks still held) and votes yes, or votes no and rolls back. Phase 2: with every vote yes, the coordinator forces a COMMIT record to its log and sends COMMIT; on any no, or a vote that doesn't arrive in time, it sends ABORT. Participants apply the decision, release their locks and acknowledge. The commit point is the coordinator's COMMIT record reaching disk: from then on the transaction is committed, even if nobody has heard yet.",
      "Fase 1: el coordinador envía PREPARAR; cada participante deja su parte durable y lista para confirmar (un registro de preparación forzado, con los bloqueos todavía tomados) y vota sí, o vota no y revierte. Fase 2: si todos votan sí, el coordinador fuerza un registro CONFIRMAR a su log y envía CONFIRMAR; ante cualquier no, o un voto que no llega a tiempo, envía ABORTAR. Los participantes aplican la decisión, liberan sus bloqueos y confirman la recepción (ack). El punto de commit es el registro CONFIRMAR del coordinador llegando a disco: desde ahí la transacción está confirmada, aunque nadie se haya enterado todavía.")],
  [t("A participant that hasn't voted can time out and roll back. Why can't one that voted yes?", "Un participante que no votó puede agotar su tiempo límite y revertir. ¿Por qué uno que votó sí no puede?"),
    t("Voting yes is a promise to commit if the coordinator says so, made without knowing the other votes. After it, the coordinator may decide either way: commit if every vote was yes, abort if one was no or timed out. Rolling back on its own could contradict a commit that other participants have already applied; committing on its own could contradict an abort. So it waits, in doubt, holding its locks, and keeps asking the coordinator (or, with the cooperative termination protocol, any peer that knows). Before voting there is no promise, so giving up is safe: its vote simply becomes no.",
      "Votar sí es una promesa de confirmar si el coordinador lo dice, hecha sin conocer los demás votos. Después de eso, el coordinador puede decidir cualquiera de las dos cosas: confirmar si todos votaron sí, abortar si uno votó no o no llegó a tiempo. Revertir por su cuenta podría contradecir un commit que otros participantes ya aplicaron; confirmar por su cuenta podría contradecir un aborto. Así que espera, en duda, con sus bloqueos tomados, y sigue preguntando al coordinador (o, con el protocolo de terminación cooperativa, a cualquier par que sepa). Antes de votar no hay promesa, así que rendirse es seguro: su voto simplemente pasa a ser no.")],
  [t("PostgreSQL's pg_prepared_xacts shows a transaction prepared two hours ago. What is it costing you, and what can you safely do?", "pg_prepared_xacts de PostgreSQL muestra una transacción preparada hace dos horas. ¿Qué te está costando y qué puedes hacer sin riesgo?"),
    t("A transaction left by PREPARE TRANSACTION keeps every lock it took, so anything touching those rows waits, and it holds back VACUUM, so dead rows pile up (the PostgreSQL docs warn it can, in the extreme, force a shutdown to prevent transaction ID wraparound). It is in doubt: only the coordinator, the transaction manager that prepared it (an XA or JTA transaction manager, say), knows the outcome. Find it and let it finish, or read its log for the decision and apply exactly that with COMMIT PREPARED or ROLLBACK PREPARED. Guessing, what XA calls a heuristic decision, risks a split if the other participants went the other way. Prepared transactions are off by default (max_prepared_transactions = 0), and the docs advise keeping them off unless a transaction manager closes them out promptly.",
      "Una transacción dejada por PREPARE TRANSACTION conserva todos los bloqueos que tomó, así que todo lo que toque esas filas espera, y frena a VACUUM, así que se acumulan filas muertas (la documentación de PostgreSQL advierte que, en el extremo, puede forzar un apagado para evitar el desborde de IDs de transacción, wraparound). Está en duda: solo el coordinador, el gestor de transacciones que la preparó (por ejemplo, un gestor XA o JTA), conoce el resultado. Encuéntralo y deja que termine, o lee en su log la decisión y aplica exactamente esa con COMMIT PREPARED o ROLLBACK PREPARED. Adivinar, lo que XA llama una decisión heurística, arriesga un resultado dividido si los otros participantes fueron por el otro lado. Las transacciones preparadas vienen desactivadas por defecto (max_prepared_transactions = 0), y la documentación aconseja mantenerlas así salvo que un gestor de transacciones las cierre enseguida.")],
  [t("Two-phase commit or a saga for \"debit an account here, credit one in another service\": what does each give and cost?", "¿Commit en dos fases o una saga para \"debitar una cuenta aquí y acreditar otra en otro servicio\"? ¿Qué da y qué cuesta cada uno?"),
    t("Two-phase commit gives one atomic, isolated transaction: others never see the debit without the credit, because the rows stay locked until both commit. It costs locks held across network round trips, a slowest participant that sets everyone's lock time, blocking when the coordinator fails, and every participant must support prepare (XA). A saga (lesson 26, Sagas) commits each step locally and undoes earlier steps with compensations if a later one fails: nothing blocks across services, but others can see the in-between state, and you must design the undo and publish each step reliably (lesson 24, Outbox pattern). Services owned by different teams or companies rarely offer prepare at all, which usually settles it.",
      "El commit en dos fases da una sola transacción atómica y aislada: nadie ve el débito sin el crédito, porque las filas quedan bloqueadas hasta que ambos confirman. Cuesta bloqueos tomados durante idas y vueltas por la red, un participante lento que fija el tiempo de bloqueo de todos, bloqueo cuando falla el coordinador, y que cada participante soporte la preparación (XA). Una saga (lección 26, Sagas) confirma cada paso localmente y deshace los anteriores con compensaciones si uno posterior falla: nada se bloquea entre servicios, pero otros pueden ver el estado intermedio, y tienes que diseñar el deshacer y publicar cada paso de forma confiable (lección 24, Patrón outbox). Los servicios de otros equipos o empresas rara vez ofrecen preparación, y eso suele decidirlo.")],
  [t("Your cross-service transactions hold locks far longer than their work takes. Where does the time go, and what helps?", "Tus transacciones entre servicios retienen bloqueos mucho más de lo que tarda su trabajo. ¿A dónde se va el tiempo y qué ayuda?"),
    t("Each lock is held from the moment the work takes it to the moment the decision arrives: the slowest participant's work, every round trip of both phases, and the forced log writes on both sides. Help: do reads, validation and anything slow before the transaction starts; touch fewer participants; keep them in one region; give the coordinator a timeout on votes so a stuck participant causes an abort instead of a long hold (aborting before the decision is always safe); and split hot rows so fewer transactions queue on one lock.",
      "Cada bloqueo se mantiene desde que el trabajo lo toma hasta que llega la decisión: el trabajo del participante más lento, cada ida y vuelta de las dos fases y las escrituras forzadas al log de ambos lados. Ayuda: hacer las lecturas, validaciones y todo lo lento antes de empezar la transacción; tocar menos participantes; mantenerlos en una sola región; darle al coordinador un tiempo límite para los votos, así un participante trabado causa un aborto en vez de un bloqueo largo (abortar antes de la decisión siempre es seguro); y dividir las filas calientes para que menos transacciones hagan fila en un mismo bloqueo.")],
  [t("How do systems like Spanner keep two-phase commit from blocking when a coordinator fails?", "¿Cómo evitan sistemas como Spanner que el commit en dos fases se bloquee cuando falla un coordinador?"),
    t("They make the coordinator, and each participant, a replicated group that agrees on its log through consensus (Paxos in Spanner; Raft in others). The prepare and commit records are written to that replicated log, so if the leader dies another replica takes over with the decision and finishes the protocol. Participants then wait only for a leader election (lesson 63, Leader Election), not for a machine to come back. Paxos Commit (Gray and Lamport) generalises the idea. Three-phase commit adds a phase to avoid blocking, but only if messages arrive within a known time; under a network partition it can end inconsistent, so it is rarely used.",
      "Hacen que el coordinador, y cada participante, sea un grupo replicado que acuerda su log por consenso (Paxos en Spanner; Raft en otros). Los registros de preparación y de commit se escriben en ese log replicado, así que si muere el líder otra réplica toma el control con la decisión y termina el protocolo. Los participantes entonces solo esperan una elección de líder (lección 63, Elección de líder), no a que vuelva una máquina. Paxos Commit (Gray y Lamport) generaliza la idea. El commit en tres fases agrega una fase para evitar el bloqueo, pero solo si los mensajes llegan dentro de un tiempo conocido; ante una partición de red puede terminar inconsistente, así que casi no se usa.")],
];

export default defineLesson({
  title: t("Two-Phase Commit Workbench", "Banco de trabajo: commit en dos fases"),
  eyebrow: t("Systems lesson 64 · Two-phase commit", "Lección de sistemas 64 · Commit en dos fases"),
  lede: t("Two-phase commit makes several databases commit one transaction together or not at all: a coordinator asks every participant to prepare and vote, then tells them all the outcome. The catch is that a participant that has voted yes can't decide on its own, so if the coordinator disappears it waits with its rows locked. This lesson runs it as a coordinator's desk and three counters: watch it, predict what breaks it, then explain it back.",
    "El commit en dos fases (two-phase commit, 2PC) hace que varias bases de datos confirmen una transacción juntas o ninguna: un coordinador le pide a cada participante que se prepare y vote, y después les comunica a todos el resultado. El problema es que un participante que votó sí no puede decidir por su cuenta, así que si el coordinador desaparece espera con sus filas bloqueadas. Esta lección lo convierte en un escritorio de coordinador y tres mostradores: míralo, predice qué lo rompe y después explícalo."),
  machine: {
    intro: t("Each transaction updates the one busy row at every counter. Follow an envelope round: WORK takes the row's lock, PREPARE asks for a vote, COMMIT or ABORT releases the lock. Crash the coordinator at different moments, slow B down or make it vote no, move everyone far apart, and watch who ends up waiting.",
      "Cada transacción actualiza la única fila concurrida de cada mostrador. Sigue una ronda de sobres: TAREA toma el bloqueo (lock) de la fila, PREPARAR pide un voto, CONFIRMAR o ABORTAR libera el bloqueo. Haz caer al coordinador en distintos momentos, vuelve lento a B o haz que vote no, aleja a todos, y mira quién termina esperando."),
    plate: {
      title: t("Commit desk", "Mesa de commit"),
      keys: [
        { mark: "lit", label: t("A row locked by a transaction; the DOWN sign while the coordinator is down", "Una fila bloqueada por una transacción; el cartel CAÍDO mientras el coordinador está caído") },
        { mark: "raised", label: t("Envelopes: out to a counter on the left half of its lane, back on the right half; questions between counters on the peer line", "Sobres: hacia un mostrador por la mitad izquierda de su carril, de vuelta por la derecha; preguntas entre mostradores por la línea entre pares") },
        { mark: "flat", label: t("The lanes between the coordinator and each participant", "Los carriles entre el coordinador y cada participante") },
      ],
      caption: t(
        "Played at 1/50 of real speed (change it under Speed). Times are illustrative and round: a message takes " + NEAR + " one way (" + FAR + " to another region), the work 5–15 ms, a forced log write 2 ms. Ten transactions a second, each touching the one hot row at every counter, and ten local requests a second at each counter, each holding the row 2 ms. A crashed coordinator is back after " + DOWN + ". A participant that hasn't voted gives up after " + GIVE_UP + " (" + GIVE_UP_FAR + " far apart); one that voted yes starts asking after " + ASK + " (" + ASK_FAR + ") and asks again every " + AGAIN + ". The front of each counter shows its state; the plaques on the desk, the votes received; the log, the last decision written down. Counters: committed, aborted, split (committed at some participants and rolled back at others), transactions in flight, and customers waiting at each counter.",
        "Se reproduce a 1/50 de la velocidad real (cámbiala en Velocidad). Los tiempos son ilustrativos y redondos: un mensaje tarda " + NEAR + " de ida (" + FAR + " a otra región), el trabajo 5–15 ms, una escritura forzada al log 2 ms. Diez transacciones por segundo, cada una toca la única fila caliente de cada mostrador, y diez solicitudes locales por segundo en cada mostrador, cada una retiene la fila 2 ms. Un coordinador caído vuelve después de " + DOWN + ". Un participante que no votó se rinde después de " + GIVE_UP + " (" + GIVE_UP_FAR + " si están lejos); uno que votó sí empieza a preguntar después de " + ASK + " (" + ASK_FAR + ") y vuelve a preguntar cada " + AGAIN + ". El frente de cada mostrador muestra su estado; las placas del escritorio, los votos recibidos; el log, la última decisión escrita. Contadores: confirmadas, abortadas, divididas (confirmadas en algunos participantes y revertidas en otros), transacciones en curso y clientes esperando en cada mostrador.",
      ),
      stage: { "data-commit-desk": "" },
      label: t("Two-phase commit simulation. Space pauses or resumes.", "Simulación de commit en dos fases. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["committed", t("Committed", "Confirmadas")],
      ["aborted", t("Aborted", "Abortadas")],
      ["split", t("Split", "Divididas")],
      ["rate", t("Commits a second", "Confirmadas por segundo"), "–"],
      ["hold", t("Row lock at A", "Bloqueo de fila en A"), "–"],
      ["waiting", t("Customers waiting", "Clientes esperando")],
    ],
    controls: [
      { seg: "point", label: t("Crash point", "Punto de caída"), options: [["before", t("Before PREPARE", "Antes de PREPARAR")], ["voted", t("While votes come in", "Mientras llegan votos")], ["midsend", t("After COMMIT to A", "Tras CONFIRMAR a A")]], value: "voted" },
      { seg: "b", label: t("Participant B", "Participante B"), options: [["normal", "Normal"], ["slow", t("Slow work", "Trabajo lento")], ["no", t("Votes no 1 in " + NO_EVERY, "Vota no 1 de cada " + NO_EVERY)]], value: "normal" },
      { seg: "net", label: t("Network", "Red"), options: [["near", NEAR], ["far", t(FAR + ", another region", FAR + ", otra región")]], value: "near" },
      { seg: "log", label: t("Decision", "Decisión"), options: [["log", t("Logged first", "Primero al log")], ["memory", t("In memory only", "Solo en memoria")]], value: "log" },
      { seg: "doubt", label: t("In doubt", "En duda"), options: [["wait", t("Wait for the coordinator", "Esperar al coordinador")], ["peers", t("Ask the others too", "Preguntar también a otros")]], value: "wait" },
      { speed: true, options: [[0.01, "1/100"], [0.02, "1/50"], [0.05, "1/20"]], value: 0.02 },
      { actions: [["crash", t("Crash the coordinator", "Hacer caer al coordinador"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Crash the coordinator: it crashes at the chosen point of the next transaction to reach it and is back " + DOWN + " later. Changing a setting starts the run again.",
      "Hacer caer al coordinador: se cae en el punto elegido de la siguiente transacción que llegue a él y vuelve " + DOWN + " después. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs of " + RUN + " seconds each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija de " + RUN + " segundos cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: two-phase commit with presumed abort and a forced commit record, as in most textbook and XA implementations.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección: commit en dos fases con aborto presunto y un registro de commit forzado, como en la mayoría de los libros de texto y las implementaciones XA.`),
  css: LIT_FILL_CSS + `
[data-env-text],[data-state],[data-owner],[data-vote],[data-record],[data-record-id]{font-weight:600}
.iso-stage [data-layer] text{pointer-events:none}
`,
  data: { P, G: GEOMETRY, ENV_SVG: envelopeSvg(), CUSTOMER_SVG: customerSvg() },
});
