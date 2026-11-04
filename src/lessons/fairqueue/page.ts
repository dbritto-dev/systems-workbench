// @ts-nocheck: content in the style of the other lessons
// Systems lesson 50 · Fair queueing & priority: a dispatch desk with a lane per tenant and one worker.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, parcelSvg, P, GEOMETRY } from "./figure";
import { noisyRun, bigRun, weightRun, prioRun, slotRun, BASE_RATES, BATCH, SPIKE } from "./sim";

// Experiment results, computed at build time from the same model the page runs (8 seeds each).
const R = { noisy: noisyRun(), big: bigRun(), weights: weightRun(), prio: prioRun(), slots: slotRun() };

const s1 = (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " s";
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const every = (rate) => Math.round(1 / rate);                       // "a job every N s"
const top = (...xs) => Math.max(...xs) * 1.08;
const SPIKE_SECS = SPIKE.to - SPIKE.from;
const SPIKE_LOAD = pct(3 * SPIKE.rate);                              // A, B and C together, against a worker that does 1 job/s

// What each card shows after a run.
const RUNS = {
  noisy: () => {
    const { calm, fifo, rr } = R.noisy, m = top(fifo.max, rr.max);
    return { verdict: t("A, B and C's longest wait while the batch drained: " + s1(fifo.max) + " in one FIFO line, " + s1(rr.max) + " with a lane each and round robin (" + s1(calm.p95) + " is their p95 on a quiet day). The batch itself took " + s1(fifo.batch) + " in the FIFO line, " + s1(rr.batch) + " with round robin.",
        "La espera más larga de A, B y C mientras se vaciaba el lote: " + s1(fifo.max) + " en una sola fila FIFO, " + s1(rr.max) + " con un carril cada uno y round robin (" + s1(calm.p95) + " es su p95 en un día tranquilo). El lote mismo tardó " + s1(fifo.batch) + " en la fila FIFO y " + s1(rr.batch) + " con round robin."),
      bars: [[t("A, B, C wait, one FIFO line", "Espera de A, B, C, una fila FIFO"), fifo.max / m, s1(fifo.max), true], [t("A, B, C wait, round robin", "Espera de A, B, C, round robin"), rr.max / m, s1(rr.max)], [t("Batch done, FIFO line", "Lote terminado, fila FIFO"), fifo.batch / top(fifo.batch, rr.batch), s1(fifo.batch)], [t("Batch done, round robin", "Lote terminado, round robin"), rr.batch / top(fifo.batch, rr.batch), s1(rr.batch)]] };
  },
  big: () => {
    const { rr, fair } = R.big, m = top(rr.abc, fair.abc, rr.d, fair.d);
    return { verdict: t("While all four lanes had work, D got " + pct(rr.share) + " of the worker with round robin and " + pct(fair.share) + " with fair by work. A, B and C's batches finished in " + s1(rr.abc) + " → " + s1(fair.abc) + "; D's in " + s1(rr.d) + " → " + s1(fair.d) + ".",
        "Mientras los cuatro carriles tenían trabajo, D se llevó " + pct(rr.share) + " del trabajador con round robin y " + pct(fair.share) + " con justo por trabajo. Los lotes de A, B y C terminaron en " + s1(rr.abc) + " → " + s1(fair.abc) + "; el de D en " + s1(rr.d) + " → " + s1(fair.d) + "."),
      bars: [[t("D's share, round robin", "Parte de D, round robin"), rr.share, pct(rr.share), true], [t("D's share, fair by work", "Parte de D, justo por trabajo"), fair.share, pct(fair.share)], [t("A, B, C done, round robin", "A, B, C terminados, round robin"), rr.abc / m, s1(rr.abc), true], [t("A, B, C done, fair by work", "A, B, C terminados, justo por trabajo"), fair.abc / m, s1(fair.abc)], [t("D done, fair by work", "D terminado, justo por trabajo"), fair.d / m, s1(fair.d)]] };
  },
  weights: () => {
    const { equal, heavy } = R.weights, m = top(equal.a, equal.d, heavy.a, heavy.d);
    return { verdict: t("A's batch: " + s1(equal.a) + " with equal weights, " + s1(heavy.a) + " with A weighted 3. D's batch: " + s1(equal.d) + " → " + s1(heavy.d) + ". While both waited, A got " + pct(heavy.shareA) + " of the worker and D " + pct(heavy.shareD) + ".",
        "Lote de A: " + s1(equal.a) + " con pesos iguales, " + s1(heavy.a) + " con A de peso 3. Lote de D: " + s1(equal.d) + " → " + s1(heavy.d) + ". Mientras ambos esperaban, A se llevó " + pct(heavy.shareA) + " del trabajador y D " + pct(heavy.shareD) + "."),
      bars: [[t("A done, equal", "A terminado, iguales"), equal.a / m, s1(equal.a)], [t("A done, A × 3", "A terminado, A × 3"), heavy.a / m, s1(heavy.a), true], [t("D done, equal", "D terminado, iguales"), equal.d / m, s1(equal.d)], [t("D done, A × 3", "D terminado, A × 3"), heavy.d / m, s1(heavy.d), true]] };
  },
  prio: () => {
    const { prio, rr } = R.prio, m = top(prio.hiP95, rr.hiP95, prio.dMax, rr.dMax);
    return { verdict: t("During the " + SPIKE_SECS + " s spike D started " + one(prio.dStarted) + " jobs with strict priority (" + pct(prio.dShare) + " of the worker) and " + one(rr.dStarted) + " with round robin (" + pct(rr.dShare) + "). D's oldest job waited " + s1(prio.dMax) + " vs " + s1(rr.dMax) + "; A, B and C's p95 wait was " + s1(prio.hiP95) + " vs " + s1(rr.hiP95) + ".",
        "Durante el pico de " + SPIKE_SECS + " s, D empezó " + one(prio.dStarted) + " trabajos con prioridad estricta (" + pct(prio.dShare) + " del trabajador) y " + one(rr.dStarted) + " con round robin (" + pct(rr.dShare) + "). El trabajo más antiguo de D esperó " + s1(prio.dMax) + " vs " + s1(rr.dMax) + "; el p95 de espera de A, B y C fue " + s1(prio.hiP95) + " vs " + s1(rr.hiP95) + "."),
      bars: [[t("D's share, strict priority", "Parte de D, prioridad estricta"), prio.dShare, pct(prio.dShare), true], [t("D's share, round robin", "Parte de D, round robin"), rr.dShare, pct(rr.dShare)], [t("A, B, C p95, strict priority", "p95 de A, B, C, prioridad estricta"), prio.hiP95 / m, s1(prio.hiP95)], [t("A, B, C p95, round robin", "p95 de A, B, C, round robin"), rr.hiP95 / m, s1(rr.hiP95), true]] };
  },
  slots: () => {
    const { rr, slots } = R.slots, m = top(rr.batch, slots.batch);
    return { verdict: t("D's batch took " + s1(rr.batch) + " with round robin and " + s1(slots.batch) + " with fixed slots, while the worker sat idle " + pct(slots.idle) + " of that time with work waiting. A, B and C's p95 wait: " + s1(rr.p95) + " → " + s1(slots.p95) + ".",
        "El lote de D tardó " + s1(rr.batch) + " con round robin y " + s1(slots.batch) + " con franjas fijas, y el trabajador estuvo ocioso " + pct(slots.idle) + " de ese tiempo con trabajo esperando. p95 de espera de A, B y C: " + s1(rr.p95) + " → " + s1(slots.p95) + "."),
      bars: [[t("Batch, round robin", "Lote, round robin"), rr.batch / m, s1(rr.batch)], [t("Batch, fixed slots", "Lote, franjas fijas"), slots.batch / m, s1(slots.batch), true], [t("Idle with work waiting, fixed slots", "Ocioso con trabajo esperando, franjas fijas"), slots.idle, pct(slots.idle), true]] };
  },
};

const { noisy: N1, big: N2, weights: N3, prio: N4, slots: N5 } = R;

const EXPERIMENTS = [
  {
    id: "noisy",
    title: t("A batch job in one shared line", "Un proceso por lotes en una sola fila"),
    change: t("D's batch job drops " + BATCH + " jobs at once · A, B and C keep sending a job every " + every(BASE_RATES[0]) + " s each · one shared FIFO line vs a lane per tenant served round robin",
      "El proceso por lotes de D suelta " + BATCH + " trabajos de golpe · A, B y C siguen enviando un trabajo cada " + every(BASE_RATES[0]) + " s cada uno · una sola fila FIFO compartida vs un carril por cliente atendido en round robin"),
    question: t("In the one FIFO line, how long do A, B and C's jobs wait while the batch drains?", "En la única fila FIFO, ¿cuánto esperan los trabajos de A, B y C mientras se vacía el lote?"),
    options: [
      t("Barely longer than usual: they send so little that they slip in between", "Apenas más que de costumbre: envían tan poco que se cuelan entre medio"),
      t("About as long as the whole batch takes: tens of seconds", "Más o menos lo que tarda todo el lote: decenas de segundos"),
      t("A second or two: only behind the D job already in the press", "Un segundo o dos: solo detrás del trabajo de D que ya está en la prensa"),
    ],
    answer: 1,
    why: t(
      "A FIFO line serves by arrival, so a job waits for all the work queued ahead of it, whoever sent it. The " + BATCH + " jobs arrived first, so every job A, B and C send in the next " + s1(N1.fifo.batch) + " waits behind them: their wait follows D's backlog, not their own. With a lane per tenant served round robin, a job waits for its own lane and at most one job from each other lane, so the longest wait drops to " + s1(N1.rr.max) + ". The batch pays for that: it finishes in " + s1(N1.rr.batch) + " instead of " + s1(N1.fifo.batch) + ", because the jobs A, B and C sent meanwhile now go before it instead of after.",
      "Una fila FIFO atiende por orden de llegada, así que un trabajo espera todo el trabajo que tiene delante, lo haya enviado quien lo haya enviado. Los " + BATCH + " trabajos llegaron primero, así que todo trabajo que A, B y C envían en los siguientes " + s1(N1.fifo.batch) + " espera detrás de ellos: su espera sigue la acumulación de D, no la propia. Con un carril por cliente atendido en round robin, un trabajo espera a su propio carril y como mucho un trabajo de cada otro carril, así que la espera más larga baja a " + s1(N1.rr.max) + ". El lote paga por eso: termina en " + s1(N1.rr.batch) + " en lugar de " + s1(N1.fifo.batch) + ", porque los trabajos que A, B y C enviaron mientras tanto ahora van antes que él y no después.",
    ),
    watch: { sched: "fifo", scenario: "batchD" },
  },
  {
    id: "big",
    title: t("Round robin with bigger jobs", "Round robin con trabajos más grandes"),
    change: t("Every tenant drops 20 jobs at once · D's jobs are 4× the work · round robin (one job per lane per turn) vs fair by work (deficit round robin)",
      "Cada cliente suelta 20 trabajos de golpe · los trabajos de D son 4× el trabajo · round robin (un trabajo por carril en cada vuelta) vs justo por trabajo (deficit round robin)"),
    question: t("While all four lanes have work, what share of the worker does D get with round robin?", "Mientras los cuatro carriles tienen trabajo, ¿qué parte del trabajador se lleva D con round robin?"),
    options: [
      t("A quarter: it gets one turn in four", "Un cuarto: le toca una vuelta de cada cuatro"),
      t("More than half: each of its turns is four times as long", "Más de la mitad: cada uno de sus turnos dura cuatro veces más"),
      t("Less than a quarter: its big jobs wait for a gap", "Menos de un cuarto: sus trabajos grandes esperan un hueco"),
    ],
    answer: 1,
    why: t(
      "Round robin counts jobs, not work. Each round takes one job from every lane: 1 + 1 + 1 + 4 units of work, and 4 of the 7 are D's, so D gets " + pct(N2.rr.share) + ". Fair by work (deficit round robin) gives every lane the same credit of work per turn and lets it run a job only when the job fits its credit, so D's lane saves up for several turns before each big job and gets " + pct(N2.fair.share) + ". A, B and C's batches finish in " + s1(N2.fair.abc) + " instead of " + s1(N2.rr.abc) + "; D's takes longer, " + s1(N2.fair.d) + ", because it no longer takes their share.",
      "Round robin cuenta trabajos, no trabajo. Cada vuelta toma un trabajo de cada carril: 1 + 1 + 1 + 4 unidades de trabajo, y 4 de las 7 son de D, así que D se lleva " + pct(N2.rr.share) + ". Justo por trabajo (deficit round robin) le da a cada carril el mismo crédito de trabajo por turno y solo le deja correr un trabajo cuando el trabajo cabe en su crédito, así que el carril de D ahorra varios turnos antes de cada trabajo grande y se lleva " + pct(N2.fair.share) + ". Los lotes de A, B y C terminan en " + s1(N2.fair.abc) + " en lugar de " + s1(N2.rr.abc) + "; el de D tarda más, " + s1(N2.fair.d) + ", porque ya no se lleva la parte de los demás.",
    ),
    watch: { sched: "rr", sizes: "big", scenario: "all" },
  },
  {
    id: "weights",
    title: t("Give A weight 3", "Darle peso 3 a A"),
    change: t("A and D each drop 30 jobs at once · fair by work · equal weights vs A weighted 3 (say, a paid plan)",
      "A y D sueltan 30 trabajos cada uno de golpe · justo por trabajo · pesos iguales vs A con peso 3 (por ejemplo, un plan de pago)"),
    question: t("With A weighted 3, when does D's batch finish?", "Con A de peso 3, ¿cuándo termina el lote de D?"),
    options: [
      t("About three times later: D gets a third of what A gets", "Unas tres veces más tarde: D recibe un tercio de lo que recibe A"),
      t("A little later: once A's batch is done, D gets the worker back", "Un poco más tarde: cuando termina el lote de A, D recupera el trabajador"),
      t("No later: D's share is reserved whatever A's weight", "Nada más tarde: la parte de D está reservada, pese al peso de A"),
    ],
    answer: 1,
    why: t(
      "A weight is a share under contention, not a cap and not a reservation. While both batches wait, A gets three times D's share (" + pct(N3.heavy.shareA) + " of the worker against " + pct(N3.heavy.shareD) + "), so A's batch finishes in " + s1(N3.heavy.a) + " instead of " + s1(N3.equal.a) + ". As soon as A's lane empties, its share goes to whoever still has work, so D finishes in " + s1(N3.heavy.d) + " instead of " + s1(N3.equal.d) + ". A scheduler that never idles while work waits is work-conserving: weights change who finishes first, not how much the worker gets done.",
      "Un peso es una parte cuando hay competencia, no un tope ni una reserva. Mientras ambos lotes esperan, A recibe el triple que D (" + pct(N3.heavy.shareA) + " del trabajador contra " + pct(N3.heavy.shareD) + "), así que el lote de A termina en " + s1(N3.heavy.a) + " en lugar de " + s1(N3.equal.a) + ". En cuanto el carril de A se vacía, su parte pasa a quien todavía tiene trabajo, así que D termina en " + s1(N3.heavy.d) + " en lugar de " + s1(N3.equal.d) + ". Un planificador que nunca queda ocioso mientras hay trabajo esperando conserva el trabajo (work-conserving): los pesos cambian quién termina primero, no cuánto trabajo hace el trabajador.",
    ),
    watch: { sched: "fair", weights: "a3", scenario: "aAndD" },
  },
  {
    id: "prio",
    title: t("Strict priority in a spike", "Prioridad estricta en un pico"),
    change: t("A, B and C (the high lane) jump to " + SPIKE.rate + " jobs/s each, " + SPIKE_LOAD + " of what the worker can do, for " + SPIKE_SECS + " s · D (the low lane) has 20 batch jobs waiting · strict priority vs round robin",
      "A, B y C (el carril alto) suben a " + SPIKE.rate + " trabajos/s cada uno, " + SPIKE_LOAD + " de lo que puede hacer el trabajador, durante " + SPIKE_SECS + " s · D (el carril bajo) tiene 20 trabajos de lote esperando · prioridad estricta vs round robin"),
    question: t("With strict priority, how many of D's jobs start during the spike?", "Con prioridad estricta, ¿cuántos trabajos de D empiezan durante el pico?"),
    options: [
      t("About as many as usual: priority only changes the order", "Más o menos los de siempre: la prioridad solo cambia el orden"),
      t("Fewer, but a steady trickle: D gets whatever is left", "Menos, pero un goteo constante: D recibe lo que sobra"),
      t("Almost none: the high lane never empties, so D never gets a turn", "Casi ninguno: el carril alto nunca se vacía, así que a D nunca le toca"),
    ],
    answer: 2,
    why: t(
      "Strict priority serves the low lane only when the high lane is empty. During the spike interactive work arrives faster than the worker can finish it, so the high lane never empties and nothing is left over: D starts " + one(N4.prio.dStarted) + " jobs in " + SPIKE_SECS + " s and its oldest job waits " + s1(N4.prio.dMax) + ". That is starvation. Round robin keeps D going (" + pct(N4.rr.dShare) + " of the worker), but overload has to land somewhere: A, B and C's p95 wait rises from " + s1(N4.prio.hiP95) + " to " + s1(N4.rr.hiP95) + ". Weighted fair queueing lets you choose the split, for example a small weight for batch work: interactive traffic gets most of the worker and the low lane never stops.",
      "La prioridad estricta solo atiende el carril bajo cuando el carril alto está vacío. Durante el pico el trabajo interactivo llega más rápido de lo que el trabajador lo termina, así que el carril alto nunca se vacía y no sobra nada: D empieza " + one(N4.prio.dStarted) + " trabajos en " + SPIKE_SECS + " s y su trabajo más antiguo espera " + s1(N4.prio.dMax) + ". Eso es inanición (starvation). Round robin mantiene a D en marcha (" + pct(N4.rr.dShare) + " del trabajador), pero la sobrecarga tiene que caer en algún lado: el p95 de espera de A, B y C sube de " + s1(N4.prio.hiP95) + " a " + s1(N4.rr.hiP95) + ". El encolamiento justo ponderado (weighted fair queueing) te deja elegir el reparto, por ejemplo un peso pequeño para el trabajo por lotes: el tráfico interactivo se lleva casi todo el trabajador y el carril bajo nunca se detiene.",
    ),
    watch: { sched: "prio", scenario: "spike" },
  },
  {
    id: "slots",
    title: t("Reserve each tenant a quarter", "Reservarle un cuarto a cada cliente"),
    change: t("D's batch of " + BATCH + " again · round robin (an empty lane's turn goes to the others) vs fixed slots (each tenant owns every fourth slot, used or not)",
      "Otra vez el lote de " + BATCH + " de D · round robin (el turno de un carril vacío pasa a los demás) vs franjas fijas (cada cliente es dueño de una de cada cuatro franjas, la use o no)"),
    question: t("With fixed slots, how long does D's batch take?", "Con franjas fijas, ¿cuánto tarda el lote de D?"),
    options: [
      t("About the same as round robin: D still gets its quarter", "Más o menos lo mismo que con round robin: D sigue teniendo su cuarto"),
      t("Much longer: the worker idles through empty slots", "Mucho más: el trabajador queda ocioso en franjas vacías"),
      t("Less: D's slots are guaranteed, so nobody gets in its way", "Menos: las franjas de D están garantizadas, así que nadie se le cruza"),
    ],
    answer: 1,
    why: t(
      "Fixed slots reserve capacity: each tenant owns a quarter of the worker whether it uses it or not. A, B and C need less than half of theirs, so the worker idles through their empty slots (" + pct(N5.slots.idle) + " of the time while the batch waited) and D can only use its own quarter: the batch takes " + s1(N5.slots.batch) + " instead of " + s1(N5.rr.batch) + ". A, B and C gain nothing either: a job waits for its own slot to come round, so their p95 wait goes from " + s1(N5.rr.p95) + " to " + s1(N5.slots.p95) + ". Round robin is work-conserving: an empty lane is skipped and its share goes to whoever has work. Reservation buys hard isolation, at the price of capacity.",
      "Las franjas fijas reservan capacidad: cada cliente es dueño de un cuarto del trabajador, lo use o no. A, B y C necesitan menos de la mitad del suyo, así que el trabajador queda ocioso en sus franjas vacías (" + pct(N5.slots.idle) + " del tiempo mientras el lote esperaba) y D solo puede usar su propio cuarto: el lote tarda " + s1(N5.slots.batch) + " en lugar de " + s1(N5.rr.batch) + ". A, B y C tampoco ganan nada: un trabajo espera a que vuelva su propia franja, así que su p95 de espera pasa de " + s1(N5.rr.p95) + " a " + s1(N5.slots.p95) + ". Round robin conserva el trabajo: se salta un carril vacío y su parte va a quien tiene trabajo. Reservar compra aislamiento estricto, al precio de capacidad.",
    ),
    watch: { sched: "slots", scenario: "batchD" },
  },
];

const QUESTIONS = [
  [t("Your job queue is shared by every customer, and one customer's bulk import adds 10,000 jobs. Why do everyone's jobs slow down, and what would you change?",
     "Tu cola de trabajos la comparten todos los clientes, y la importación masiva de un cliente agrega 10,000 trabajos. ¿Por qué se atrasan los trabajos de todos y qué cambiarías?"),
   t("In a FIFO queue a job waits for all the work ahead of it, so after the import everyone waits for the import. Give each tenant its own queue (or a sub-queue keyed by tenant) and have workers pick tenants in turn, round robin or by weight, skipping empty queues. Then a tenant's wait depends on its own backlog, and the import only delays the importer. With many tenants, keep a list of only the non-empty queues so each pick stays cheap.",
     "En una cola FIFO un trabajo espera todo el trabajo que tiene delante, así que después de la importación todos esperan a la importación. Dale a cada cliente su propia cola (o una subcola por cliente) y haz que los trabajadores elijan clientes por turnos, en round robin o por peso, saltándose las colas vacías. Así la espera de un cliente depende de su propia acumulación, y la importación solo atrasa a quien importa. Con muchos clientes, guarda una lista solo de las colas no vacías para que cada elección siga siendo barata.")],
  [t("You already rate limit each customer (lesson 05). Why can one customer still crowd out the others in the queue?",
     "Ya limitas la tasa de cada cliente (lección 05). ¿Por qué un cliente todavía puede desplazar a los demás en la cola?"),
   t("A rate limit decides how fast work gets in; it says nothing about the order work is served once it's in. A customer under its limit can still build a big backlog (a burst up to the bucket size, or a steady rate the workers can't keep up with at that moment), and in a FIFO queue everyone behind that backlog waits for it. Rate limiting protects admission; fair queueing protects latency for the work you accepted. Most systems need both.",
     "Un límite de tasa decide qué tan rápido entra el trabajo; no dice nada sobre el orden en que se atiende una vez adentro. Un cliente dentro de su límite igual puede acumular mucho trabajo (una ráfaga del tamaño de la cubeta, o un ritmo constante que los trabajadores no alcanzan en ese momento), y en una cola FIFO todos los que están detrás esperan esa acumulación. La limitación de tasa protege la entrada; el encolamiento justo protege la latencia del trabajo que ya aceptaste. La mayoría de los sistemas necesita las dos cosas.")],
  [t("Round robin is \"one job per tenant per turn\". When is that unfair, and what do you charge instead when you don't know a job's cost in advance?",
     "Round robin es \"un trabajo por cliente en cada vuelta\". ¿Cuándo es injusto y qué cobras en su lugar si no sabes de antemano cuánto cuesta un trabajo?"),
   t("When job costs differ: a tenant whose jobs are 10× heavier gets 10× the worker. Charge by work instead: deficit round robin gives each queue a credit of work per turn, and weighted fair queueing orders work by each flow's virtual finish time. If the cost is unknown, charge an estimate (rows, bytes, a size class) or charge the measured time after the job runs and let the tenant carry that debt into its next turn.",
     "Cuando los costos son distintos: un cliente cuyos trabajos pesan 10× más se lleva 10× el trabajador. Cobra por trabajo: deficit round robin le da a cada cola un crédito de trabajo por turno, y el encolamiento justo ponderado (weighted fair queueing) ordena el trabajo según el tiempo de fin virtual de cada flujo. Si no conoces el costo, cobra una estimación (filas, bytes, una categoría de tamaño) o cobra el tiempo medido después de correr el trabajo y deja que el cliente arrastre esa deuda a su siguiente turno.")],
  [t("When is strict priority the right tool, and how do you stop it from starving the low lane?",
     "¿Cuándo es la prioridad estricta la herramienta correcta y cómo evitas que deje sin atender al carril bajo?"),
   t("When the high class is small and bounded, like health checks, control messages or interactive requests that are a fraction of the load, and the low lane can wait. Guard it: cap the high lane's rate so it can't take everything, give the low lane a minimum share (a weight instead of a strict order), or age waiting jobs so their priority rises the longer they wait. Kubernetes' API Priority and Fairness combines priority levels, each with its own share of the server, with fair queuing among the clients inside a level.",
     "Cuando la clase alta es pequeña y acotada, como chequeos de salud, mensajes de control o solicitudes interactivas que son una fracción de la carga, y el carril bajo puede esperar. Protégelo: limita la tasa del carril alto para que no pueda llevarse todo, dale al carril bajo una parte mínima (un peso en lugar de un orden estricto), o envejece los trabajos que esperan (aging) para que su prioridad suba mientras más esperan. API Priority and Fairness de Kubernetes combina niveles de prioridad, cada uno con su propia parte del servidor, con encolamiento justo entre los clientes dentro de cada nivel.")],
  [t("Your workers are split into fixed pools, one per customer tier. The workers are 40% busy overall, yet the free tier's queue is hours long. What's going on?",
     "Tus trabajadores están divididos en grupos fijos, uno por nivel de cliente. Los trabajadores están 40% ocupados en total, pero la cola del nivel gratuito tiene horas de atraso. ¿Qué está pasando?"),
   t("The pools are reserved capacity, so they aren't work-conserving: an idle paid-tier worker can't take a free-tier job. Let idle workers take work from other tiers (borrowing), and express the tiers as weights or minimum shares rather than walls, so each tier is guaranteed its share when busy but nobody's capacity sits idle. Keep hard partitions only where isolation is worth the waste.",
     "Los grupos son capacidad reservada, así que no conservan el trabajo: un trabajador ocioso del nivel de pago no puede tomar un trabajo del nivel gratuito. Deja que los trabajadores ociosos tomen trabajo de otros niveles (préstamo), y expresa los niveles como pesos o partes mínimas en lugar de muros, para que cada nivel tenga garantizada su parte cuando está ocupado pero la capacidad de nadie quede ociosa. Deja particiones estrictas solo donde el aislamiento vale lo que se desperdicia.")],
  [t("What would you put on a dashboard to catch a noisy tenant before customers complain?",
     "¿Qué pondrías en un panel para detectar a un cliente ruidoso antes de que los clientes se quejen?"),
   t("Per tenant, not just in total: queue length, the age of the oldest waiting job, the share of worker time and wait percentiles (lesson 44). A total p95 can look fine while one small tenant waits minutes. Little's law (lesson 33) holds per lane too: a tenant's wait is about its queue length divided by the rate its jobs are being served, so a long lane with a small share is the warning sign.",
     "Por cliente, no solo en total: largo de la cola, la edad del trabajo más antiguo que espera, la parte del tiempo del trabajador y los percentiles de espera (lección 44). Un p95 total puede verse bien mientras un cliente pequeño espera minutos. La ley de Little (Little's law, lección 33) también vale por carril: la espera de un cliente es más o menos el largo de su cola dividido por el ritmo al que se atienden sus trabajos, así que un carril largo con una parte pequeña es la señal de alerta.")],
];

export default defineLesson({
  title: t("Fair Queueing Workbench", "Banco de trabajo: encolamiento justo"),
  eyebrow: t("Systems lesson 50 · Fair queueing & priority", "Lección de sistemas 50 · Encolamiento justo y prioridad"),
  lede: t("One shared FIFO queue serves work in arrival order, so when one tenant (a batch job, a noisy customer) fills it, everyone else waits for that tenant's backlog. This lesson builds fair queueing three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Una sola cola FIFO compartida atiende el trabajo por orden de llegada, así que cuando un cliente (tenant), sea un proceso por lotes o un cliente ruidoso, la llena, todos los demás esperan la acumulación de ese cliente. Esta lección arma el encolamiento justo (fair queueing) de tres maneras: mira una máquina hacerlo, predice qué lo rompe y luego explícalo con tus palabras."),
  machine: {
    intro: t("Each tenant has its own lane, and the shuttle carries whichever job the scheduler picks to the one press. Every run starts with D's batch job dropping " + BATCH + " jobs. Switch the scheduler and watch how long A, B and C wait.",
      "Cada cliente tiene su propio carril, y el carro lleva a la única prensa el trabajo que elige el planificador. Cada ejecución empieza con el proceso por lotes de D soltando " + BATCH + " trabajos. Cambia el planificador y mira cuánto esperan A, B y C."),
    plate: {
      title: t("Dispatch desk", "Mesa de despacho"),
      keys: [
        { mark: "lit", label: t("The job in the press; the idle lamp when a reserved slot goes unused", "El trabajo en la prensa; la lámpara de ocioso cuando una franja reservada queda sin usar") },
        { mark: "raised", label: t("Lanes: one queue per tenant, A, B, C back to front, D the batch hopper", "Carriles: una cola por cliente, A, B, C de atrás hacia adelante, D la tolva de lotes") },
        { mark: "flat", label: t("Shuttle: carries the job the scheduler picks", "Carro: lleva el trabajo que elige el planificador") },
      ],
      caption: t(
        "Jobs arrive at random: A, B and C about one every " + every(BASE_RATES[0]) + " s each, D one every " + every(BASE_RATES[3]) + " s. The press does about one job a second (each takes 0.5 to 1.5 s). Ticket numbers are arrival order: a FIFO line always serves the lowest. Tags on the docks show each tenant's weight, or its priority. The counters show how many wait in each lane, the ticket being served and how many are done; the meter shows how busy the press was over the last 30 s.",
        "Los trabajos llegan al azar: A, B y C más o menos uno cada " + every(BASE_RATES[0]) + " s cada uno, D uno cada " + every(BASE_RATES[3]) + " s. La prensa hace más o menos un trabajo por segundo (cada uno tarda de 0.5 a 1.5 s). Los números de turno son el orden de llegada: una fila FIFO siempre atiende el más bajo. Las etiquetas de los muelles muestran el peso de cada cliente, o su prioridad. Los contadores muestran cuántos esperan en cada carril, el turno que se atiende y cuántos están hechos; el medidor muestra qué tan ocupada estuvo la prensa en los últimos 30 s.",
      ),
      stage: { "data-desk": "" },
      label: t("Fair queueing simulation. Space pauses or resumes.", "Simulación de encolamiento justo. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["done", t("Done", "Hechos")],
      ["waiting", t("Waiting", "En espera")],
      ["abc", t("A, B, C max wait", "Espera máx. A, B, C"), "–"],
      ["d", t("D max wait", "Espera máx. D"), "–"],
      ["busy", t("Worker busy", "Trabajador ocupado"), "–"],
      ["shareD", t("D's share", "Parte de D"), "–"],
    ],
    controls: [
      { seg: "sched", label: t("Scheduler", "Planificador"), options: [["fifo", t("One line (FIFO)", "Una fila (FIFO)")], ["rr", t("Round robin", "Round robin")], ["fair", t("Fair by work", "Justo por trabajo")], ["prio", t("Strict priority", "Prioridad estricta")], ["slots", t("Fixed slots", "Franjas fijas")]], value: "fifo" },
      { seg: "weights", label: t("Weights", "Pesos"), options: [["equal", t("Equal", "Iguales")], ["a3", "A × 3"]], value: "equal" },
      { seg: "sizes", label: t("D's jobs", "Trabajos de D"), options: [["same", t("Same size", "Mismo tamaño")], ["big", t("4× the work", "4× el trabajo")]], value: "same" },
      { speed: true },
      { actions: [["batchD", t("D: batch of " + BATCH, "D: lote de " + BATCH)], ["batchA", t("A: batch of 30", "A: lote de 30")], ["spike", t("Spike A, B, C", "Pico de A, B, C")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Changing a setting starts the run again, with D's batch (or the experiment you last watched). Weights apply to round robin, fair by work and fixed slots; strict priority puts A, B and C in the high lane and D in the low one. Max waits cover the last 30 s, including jobs still waiting.",
      "Cambiar un ajuste reinicia la ejecución, con el lote de D (o el último experimento que observaste). Los pesos aplican a round robin, justo por trabajo y franjas fijas; la prioridad estricta pone a A, B y C en el carril alto y a D en el bajo. Las esperas máximas cubren los últimos 30 s, incluidos los trabajos que todavía esperan.",
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Fair queueing follows Demers, Keshav and Shenker, "Analysis and Simulation of a Fair Queueing Algorithm" (SIGCOMM 1989); deficit round robin follows Shreedhar and Varghese, "Efficient Fair Queuing Using Deficit Round Robin" (SIGCOMM 1995).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. El encolamiento justo sigue a Demers, Keshav y Shenker, "Analysis and Simulation of a Fair Queueing Algorithm" (SIGCOMM 1989); deficit round robin sigue a Shreedhar y Varghese, "Efficient Fair Queuing Using Deficit Round Robin" (SIGCOMM 1995).`),
  css: LIT_FILL_CSS + `
[data-tag-text]{font-weight:600}
`,
  data: { P, G: GEOMETRY, PARCEL_SVG: parcelSvg() },
});
