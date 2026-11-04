// @ts-nocheck: content in the style of the other lessons
// Systems lesson 48 · Hedged requests: a kitchen pass that sends a backup ticket to a second cook.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, millis, secs2 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, ticketSvg, P, GEOMETRY } from "./figure";
import { experimentResults, p95Delay, STALL, STALL_EVERY, HEAVY_X, WORK } from "./sim";

// The hedge delay the lesson uses: the p95 latency of the healthy kitchen, from the model.
const P95 = p95Delay();
// Experiment results, computed at build time from the same model the machine runs (six seeded runs of a minute each).
const R = experimentResults(P95);

const ms = (x) => (x >= 1000 ? secs2(x / 1000) : millis(x));
const top = (...xs) => Math.max(...xs) * 1.05;
const D = P95 + " ms";

// What each card shows after a run.
const RUNS = {
  soon: () => {
    const { off, p95, now } = R.soon, m = top(off.p99, p95.p99, now.p99);
    return { verdict: t(`No copy: p50 ${ms(off.p50)}, p99 ${ms(off.p99)}. A copy after ${D}: p50 ${ms(p95.p50)}, p99 ${ms(p95.p99)}, for ${pct(p95.copies)} of requests. A copy after 1 ms: p50 ${ms(now.p50)}, p99 ${ms(now.p99)}, with the cooks ${pct(now.busy)} busy instead of ${pct(off.busy)}.`,
        `Sin copia: p50 ${ms(off.p50)}, p99 ${ms(off.p99)}. Copia tras ${D}: p50 ${ms(p95.p50)}, p99 ${ms(p95.p99)}, para el ${pct(p95.copies)} de las solicitudes. Copia tras 1 ms: p50 ${ms(now.p50)}, p99 ${ms(now.p99)}, con los cocineros ocupados un ${pct(now.busy)} en vez de un ${pct(off.busy)}.`),
      bars: [[t("p99, no copy", "p99, sin copia"), off.p99 / m, ms(off.p99)], [t(`p99, copy after ${D}`, `p99, copia tras ${D}`), p95.p99 / m, ms(p95.p99)], [t("p99, copy after 1 ms", "p99, copia tras 1 ms"), now.p99 / m, ms(now.p99), true], [t("Cooks busy, copy after 1 ms", "Cocineros ocupados, copia tras 1 ms"), now.busy, pct(now.busy), true]] };
  },
  cancel: () => {
    const { keep, cancel } = R.cancel, m = top(keep.p99, cancel.p99);
    return { verdict: t(`The loser runs on: p99 ${ms(keep.p99)}, extra work ${pct(keep.extra)}, copies for ${pct(keep.copies)} of requests. Cancelled: p99 ${ms(cancel.p99)}, extra work ${pct(cancel.extra)}, copies for ${pct(cancel.copies)}.`,
        `La perdedora sigue: p99 ${ms(keep.p99)}, trabajo extra ${pct(keep.extra)}, copias para el ${pct(keep.copies)} de las solicitudes. Se cancela: p99 ${ms(cancel.p99)}, trabajo extra ${pct(cancel.extra)}, copias para el ${pct(cancel.copies)}.`),
      bars: [[t("p99, loser runs on", "p99, la perdedora sigue"), keep.p99 / m, ms(keep.p99)], [t("p99, loser cancelled", "p99, se cancela"), cancel.p99 / m, ms(cancel.p99), true], [t("Extra work, runs on", "Trabajo extra, sigue"), keep.extra, pct(keep.extra)], [t("Extra work, cancelled", "Trabajo extra, se cancela"), cancel.extra, pct(cancel.extra), true]] };
  },
  heavy: () => {
    const { off, on } = R.heavy, m = top(off.heavyP50, on.heavyP50, off.p99, on.p99);
    return { verdict: t(`Heavy tickets' median: ${ms(off.heavyP50)} with no copy, ${ms(on.heavyP50)} with a copy after ${D}. Everyone's median: ${ms(off.p50)} → ${ms(on.p50)}; p99 ${ms(off.p99)} → ${ms(on.p99)}. The copies added ${pct(on.extra)} to the work.`,
        `Mediana de las comandas pesadas: ${ms(off.heavyP50)} sin copia, ${ms(on.heavyP50)} con copia tras ${D}. Mediana de todas: ${ms(off.p50)} → ${ms(on.p50)}; p99 ${ms(off.p99)} → ${ms(on.p99)}. Las copias sumaron un ${pct(on.extra)} al trabajo.`),
      bars: [[t("Heavy median, no copy", "Mediana pesadas, sin copia"), off.heavyP50 / m, ms(off.heavyP50)], [t("Heavy median, copy", "Mediana pesadas, con copia"), on.heavyP50 / m, ms(on.heavyP50), true], [t("p99, no copy", "p99, sin copia"), off.p99 / m, ms(off.p99)], [t("p99, copy", "p99, con copia"), on.p99 / m, ms(on.p99)], [t("Extra work, copy", "Trabajo extra, con copia"), on.extra, pct(on.extra), true]] };
  },
  budget: () => {
    const { off, on, capped } = R.budget, m = top(off.p99, on.p99, capped.p99);
    return { verdict: t(`No copies: p50 ${ms(off.p50)}, p99 ${ms(off.p99)}. Copies with no budget: ${pct(on.copies)} of requests got one, the cooks ran ${pct(on.busy)} busy, p50 ${ms(on.p50)}, p99 ${ms(on.p99)}. A 5% budget: p50 ${ms(capped.p50)}, p99 ${ms(capped.p99)}.`,
        `Sin copias: p50 ${ms(off.p50)}, p99 ${ms(off.p99)}. Copias sin presupuesto: el ${pct(on.copies)} de las solicitudes recibió una, los cocineros estuvieron ocupados un ${pct(on.busy)}, p50 ${ms(on.p50)}, p99 ${ms(on.p99)}. Con un presupuesto del 5%: p50 ${ms(capped.p50)}, p99 ${ms(capped.p99)}.`),
      bars: [[t("p99, no copies", "p99, sin copias"), off.p99 / m, ms(off.p99)], [t("p99, no budget", "p99, sin presupuesto"), on.p99 / m, ms(on.p99), true], [t("p99, 5% budget", "p99, presupuesto del 5%"), capped.p99 / m, ms(capped.p99)], [t("Requests with a copy, no budget", "Solicitudes con copia, sin presupuesto"), on.copies, pct(on.copies), true]] };
  },
  tied: () => {
    const { off, hedge, tied } = R.tied, m = top(off.p999, hedge.p999, tied.p999);
    return { verdict: t(`p99: ${ms(off.p99)} with no copy, ${ms(hedge.p99)} with a copy after ${D}, ${ms(tied.p99)} tied. p99.9: ${ms(off.p999)}, ${ms(hedge.p999)}, ${ms(tied.p999)}. Extra work: ${pct(hedge.extra)} hedged, ${pct(tied.extra)} tied.`,
        `p99: ${ms(off.p99)} sin copia, ${ms(hedge.p99)} con copia tras ${D}, ${ms(tied.p99)} atadas. p99.9: ${ms(off.p999)}, ${ms(hedge.p999)}, ${ms(tied.p999)}. Trabajo extra: ${pct(hedge.extra)} con respaldo, ${pct(tied.extra)} atadas.`),
      groups: [
        { title: t("p99", "p99"), bars: [[t("No copy", "Sin copia"), off.p99 / m, ms(off.p99)], [t(`Copy after ${D}`, `Copia tras ${D}`), hedge.p99 / m, ms(hedge.p99)], [t("Tied", "Atadas"), tied.p99 / m, ms(tied.p99), true]] },
        { title: t("p99.9", "p99.9"), bars: [[t("No copy", "Sin copia"), off.p999 / m, ms(off.p999)], [t(`Copy after ${D}`, `Copia tras ${D}`), hedge.p999 / m, ms(hedge.p999)], [t("Tied", "Atadas"), tied.p999 / m, ms(tied.p999), true]] },
      ] };
  },
};

const EXPERIMENTS = [
  {
    id: "soon",
    title: t("Hedge sooner", "Respaldar antes"),
    change: t(`Copy after ${D} (the p95) → after 1 ms · the loser runs to the end · cooks 50% busy`, `Copia tras ${D} (el p95) → tras 1 ms · la perdedora sigue hasta el final · cocineros ocupados al 50%`),
    question: t(`With a copy after ${D}, only the slowest few percent of requests get one. What if the copy goes out after 1 ms instead?`, `Con una copia tras ${D}, solo el pequeño porcentaje más lento de las solicitudes recibe una. ¿Y si la copia sale tras 1 ms?`),
    options: [
      t("Trims it even more: every request gets two chances", "La recorta todavía más: cada solicitud tiene dos oportunidades"),
      t(`About the same as after ${D}: fast requests don't need their copy`, `Más o menos lo mismo que tras ${D}: las solicitudes rápidas no necesitan su copia`),
      t("Slows everything down, the median too", "Hace todo más lento, también la mediana"),
    ],
    answer: 2,
    why: t(
      `After 1 ms almost every request is still out, so almost every request gets a copy, and with the loser running to the end every ticket is cooked twice. Cooks that were half busy are now at their limit, so queues grow on every rail and even the median request waits behind them. A hedge is cheap only because it's rare: waiting until the p95 means only the slowest few percent get a copy.`,
      `Tras 1 ms casi todas las solicitudes siguen pendientes, así que casi todas reciben una copia, y como la perdedora sigue hasta el final, cada comanda se cocina dos veces. Cocineros que estaban ocupados a la mitad quedan al límite, así que las colas crecen en todos los rieles y hasta la solicitud mediana espera detrás de ellas. Un respaldo es barato solo porque es raro: esperar hasta el p95 significa que solo el pequeño porcentaje más lento recibe una copia.`,
    ),
    watch: { mode: "hedge", delay: 1, cancel: "keep", budget: "0", load: 0.5, stalls: "on", heavy: "0" },
  },
  {
    id: "cancel",
    title: t("Cancel the loser", "Cancelar a la perdedora"),
    change: t(`Copy after ${D} · when the first answer arrives, the other copy runs on → is cancelled (dropped from its rail, or stopped if started)`, `Copia tras ${D} · cuando llega la primera respuesta, la otra copia sigue → se cancela (sale de su riel, o se detiene si ya empezó)`),
    question: t("What does cancelling the loser change?", "¿Qué cambia al cancelar a la perdedora?"),
    options: [
      t("Only the wasted work: the answer was already in", "Solo el trabajo desperdiciado: la respuesta ya había llegado"),
      t("The wasted work, and the tail with it: the queues get shorter", "El trabajo desperdiciado, y con él la cola: las filas se acortan"),
      t("Hardly anything: only a few percent of requests get a copy", "Casi nada: solo un pequeño porcentaje de solicitudes recibe copia"),
    ],
    answer: 1,
    why: t(
      "Most copies lose: the original was only queued a little long and answers first. Left alone, every losing copy is still cooked in full, and so is every original stuck behind a stalled cook. That extra work lengthens every queue, so more tickets pass the delay and get copies of their own, which adds more work. Cancelled, a loser leaves its rail, or stops partway if it had started, so only a fraction of its work is spent. It only works if the server notices: in gRPC the client's cancel reaches the handler's context, and the handler has to check it.",
      "La mayoría de las copias pierde: la original solo esperó en fila un poco de más y responde primero. Si nadie las cancela, cada copia perdedora se cocina entera, y también cada original atascada detrás de un cocinero trabado. Ese trabajo extra alarga todas las filas, así que más comandas pasan la demora y reciben sus propias copias, lo que suma más trabajo. Si se cancela, una perdedora sale de su riel, o se detiene a mitad si ya había empezado, así que solo se gasta una parte de su trabajo. Solo funciona si el servidor se entera: en gRPC la cancelación del cliente llega al contexto del handler, y el handler tiene que revisarlo.",
    ),
    watch: { mode: "hedge", delay: P95, cancel: "keep", budget: "0", load: 0.5, stalls: "on", heavy: "0" },
  },
  {
    id: "heavy",
    title: t("Slow by nature", "Lentas por naturaleza"),
    change: t(`No stalls · 1 ticket in 50 needs ${HEAVY_X}× the work on any cook · no copy → a copy after ${D}, loser cancelled`, `Sin trabas · 1 de cada 50 comandas necesita ${HEAVY_X}× el trabajo con cualquier cocinero · sin copia → copia tras ${D}, la perdedora se cancela`),
    question: t("What happens to the heavy tickets themselves?", "¿Qué pasa con las comandas pesadas en sí?"),
    options: [
      t("No faster, and their copies add work", "No más rápidas, y sus copias suman trabajo"),
      t("They finish sooner: a fresh cook takes over", "Terminan antes: un cocinero libre se hace cargo"),
      t("They finish sooner, but the other tickets get slower", "Terminan antes, pero las demás comandas se vuelven más lentas"),
    ],
    answer: 0,
    why: t(
      `The copy is just as heavy. Started ${D} later on another cook, it rarely finishes first, so it is cancelled after burning much of a heavy ticket's work a second time, on a second cook. The heavy tickets get no faster, the cooks get busier and everyone's median rises. The tickets queued behind a heavy one do escape, because their slowness was the cook's queue, not their own, which is why the p99 still drops. Hedge the slowness of replicas; for requests that are slow everywhere, make them cheaper or give them their own path.`,
      `La copia es igual de pesada. Empieza ${D} después en otro cocinero, así que rara vez termina primero, y se cancela después de volver a quemar buena parte del trabajo de una comanda pesada, en otro cocinero. Las comandas pesadas no se aceleran, los cocineros se ocupan más y la mediana de todas sube. Las comandas que esperaban detrás de una pesada sí escapan, porque su lentitud era la cola del cocinero y no la suya; por eso el p99 igual baja. Respalda la lentitud de las réplicas; las solicitudes que son lentas en cualquier lado hay que abaratarlas o darles su propio camino.`,
    ),
    watch: { mode: "hedge", delay: P95, cancel: "cancel", budget: "0", load: 0.5, stalls: "off", heavy: "0.02" },
  },
  {
    id: "budget",
    title: t("A load spike", "Un pico de carga"),
    change: t(`Traffic rises until the cooks are 90% busy · the delay stays at ${D} · losers cancelled · no budget → at most 5% of requests get a copy`, `El tráfico sube hasta que los cocineros están ocupados al 90% · la demora sigue en ${D} · las perdedoras se cancelan · sin presupuesto → como mucho el 5% de las solicitudes recibe copia`),
    question: t("With no budget, what do the copies do during the spike?", "Sin presupuesto, ¿qué hacen las copias durante el pico?"),
    options: [
      t("Trim the tail, as they do at 50% busy", "Recortan la cola, como con 50% de ocupación"),
      t("Go out for most requests: everything slows", "Salen para la mayoría: todo se vuelve más lento"),
      t("Nothing much: cancelled copies cost nothing", "Casi nada: las copias canceladas no cuestan nada"),
    ],
    answer: 1,
    why: t(
      `At 90% busy, queues alone push most requests past ${D}, so most of them get a copy. Cancelling removes copies still waiting on a rail, but the ones that start before the cancel arrives are real work, and the last few points of capacity are the dearest: the cooks run near 100% and every queue grows. A budget caps copies at a share of requests (here a token bucket: each request earns 0.05 of a token, a copy spends one), so hedging can't feed an overload, and here it beat not hedging at all.`,
      `Con 90% de ocupación, las colas por sí solas llevan a la mayoría de las solicitudes más allá de ${D}, así que la mayoría recibe una copia. Cancelar quita las copias que todavía esperan en un riel, pero las que empiezan antes de que llegue la cancelación son trabajo real, y los últimos puntos de capacidad son los más caros: los cocineros quedan cerca del 100% y todas las colas crecen. Un presupuesto limita las copias a una proporción de las solicitudes (aquí una cubeta de tokens: cada solicitud gana 0.05 de token y cada copia gasta uno), así el respaldo no puede alimentar una sobrecarga, y aquí rindió más que no respaldar nada.`,
    ),
    watch: { mode: "hedge", delay: P95, cancel: "cancel", budget: "0", load: 0.9, stalls: "on", heavy: "0" },
  },
  {
    id: "tied",
    title: t("Tied requests", "Solicitudes atadas"),
    change: t(`Copy after ${D} → tied: every ticket goes to two cooks at once, each copy tagged with the other; the cook who starts it first tells the other to drop it · losers cancelled`, `Copia tras ${D} → atadas: cada comanda va a dos cocineros a la vez, cada copia marcada con la otra; el cocinero que la empieza primero le avisa al otro que la descarte · las perdedoras se cancelan`),
    question: t(`Compared with a copy after ${D}, tied requests…`, `Comparadas con una copia tras ${D}, las solicitudes atadas…`),
    options: [
      t("Double the work: every ticket goes out twice", "Duplican el trabajo: cada comanda sale dos veces"),
      t("Match a copy after 0 ms: both go out at once", "Igualan una copia tras 0 ms: las dos salen a la vez"),
      t("Cut the p99 further, for some extra work", "Bajan más el p99, con algo de trabajo extra"),
    ],
    answer: 2,
    why: t(
      "Most of the tail is time spent waiting on the rail of a stalled or busy cook. A tied ticket doesn't wait for any delay: the first cook to reach it starts it, and the other copy is dropped from its rail, usually before anyone works on it. Extra work comes only when both cooks start within the moment the cancel takes to arrive (the second copy leaves 2 ms after the first to make that rarer). What tying can't fix is a stall after cooking has started, because the other copy is already gone: that is what remains at the p99.9. A copy after 0 ms is different: it only cancels on the first answer, so by then the second cook has often done much of the work too.",
      "La mayor parte de la cola es tiempo esperando en el riel de un cocinero trabado u ocupado. Una comanda atada no espera ninguna demora: el primer cocinero que la alcanza la empieza y la otra copia sale de su riel, normalmente antes de que alguien la trabaje. El trabajo extra aparece solo cuando ambos cocineros empiezan dentro del instante que tarda en llegar la cancelación (la segunda copia sale 2 ms después de la primera para que pase menos). Lo que atarlas no arregla es una traba después de empezar a cocinar, porque la otra copia ya no está: eso es lo que queda en el p99.9. Una copia tras 0 ms es distinta: solo cancela con la primera respuesta, y para entonces el segundo cocinero muchas veces ya hizo buena parte del trabajo.",
    ),
    watch: { mode: "tied", delay: P95, cancel: "cancel", budget: "0", load: 0.5, stalls: "on", heavy: "0" },
  },
];

const QUESTIONS = [
  [t("Why wait until the p95 before sending a copy, instead of sending it right away?", "¿Por qué esperar hasta el p95 antes de enviar una copia, en lugar de enviarla de inmediato?"),
    t("Only requests slower than the p95 get a copy, so about 1 request in 20 does, a bit more because the copies themselves add load (" + pct(R.soon.p95.copies) + " in experiment 1), and only those could need one. Sent right away, nearly every request is done twice (less if losers are cancelled, but still far more than a few percent), which takes capacity the service may need and can push it into queueing. The delay also sets a floor: a hedged request takes at least the delay plus one normal response. Measure the percentile from live latency rather than hard-coding it.",
      "Solo las solicitudes más lentas que el p95 reciben copia, así que más o menos 1 de cada 20 la recibe, algo más porque las copias mismas suman carga (" + pct(R.soon.p95.copies) + " en el experimento 1), y solo esas podrían necesitarla. Si se envía de inmediato, casi cada solicitud se hace dos veces (menos si se cancela a las perdedoras, pero igual mucho más que un pequeño porcentaje), lo que se come capacidad que el servicio puede necesitar y lo puede empujar a hacer cola. La demora también fija un piso: una solicitud con respaldo tarda al menos la demora más una respuesta normal. Mide el percentil con la latencia real en lugar de dejarlo fijo en el código.")],
  [t("Which kinds of slowness can a hedge fix, and which can't it?", "¿Qué tipos de lentitud puede arreglar un respaldo y cuáles no?"),
    t("It fixes slowness that belongs to one replica at one moment: a GC pause, a noisy neighbour, a long queue, a slow disk, a lost packet. Another replica is very likely fine, and that is where the copy goes. It can't fix slowness in the request itself (a huge query is huge everywhere), a shared dependency both copies wait on, or a whole service that is overloaded. Lesson 44, Percentiles, shows why this matters at scale: with fan-out, one replica's rare stall lands on many user requests.",
      "Arregla la lentitud que pertenece a una réplica en un momento dado: una pausa de GC, un vecino ruidoso, una cola larga, un disco lento, un paquete perdido. Lo más probable es que otra réplica esté bien, y ahí va la copia. No arregla la lentitud de la solicitud misma (una consulta enorme es enorme en cualquier lado), una dependencia compartida que ambas copias esperan, ni un servicio entero sobrecargado. La lección 44, Percentiles, muestra por qué esto importa a gran escala: con fan-out, la traba rara de una réplica cae sobre muchas solicitudes de usuario.")],
  [t("How is a hedged request different from a retry after a timeout?", "¿En qué se diferencia una solicitud con respaldo de un reintento después de un tiempo límite (timeout)?"),
    t("A retry gives up on the first attempt and starts again, so the user waits the whole timeout first. A hedge keeps the first attempt going and takes whichever answers first, after a delay much shorter than any timeout. Both repeat work, so both need operations that are safe to repeat and a cap on how much they add: lesson 06, Retry storms, shows what uncapped retries do to a struggling service.",
      "Un reintento abandona el primer intento y vuelve a empezar, así que el usuario espera primero todo el tiempo límite. Un respaldo deja seguir el primer intento y se queda con el que responda primero, tras una demora mucho más corta que cualquier tiempo límite. Ambos repiten trabajo, así que ambos necesitan operaciones que se puedan repetir sin riesgo y un límite a cuánto agregan: la lección 06, Tormentas de reintentos, muestra lo que hacen los reintentos sin límite a un servicio en apuros.")],
  [t("What must be true before you hedge a call?", "¿Qué tiene que cumplirse antes de respaldar una llamada?"),
    t("Running it twice must be harmless: reads, or writes made idempotent with a key (lesson 25, Idempotency keys). The replicas must be interchangeable, the copy must go to a different one, and it carries the original's deadline, not a fresh one (lesson 46, Timeouts and deadlines). The server should stop work it's told to cancel, or every loser costs a full request. And copies should be counted apart in your metrics, so you can see how many you send.",
      "Ejecutarla dos veces debe ser inofensivo: lecturas, o escrituras hechas idempotentes con una clave (lección 25, Claves de idempotencia). Las réplicas deben ser intercambiables, la copia debe ir a una distinta y lleva el plazo de la original, no uno nuevo (lección 46, Tiempos límite y plazos). El servidor debería detener el trabajo que le piden cancelar; si no, cada perdedora cuesta una solicitud entera. Y las copias deberían contarse aparte en tus métricas, para que veas cuántas envías.")],
  [t("Your hedging cut p99 in a load test, then made an incident worse. What happened, and what would you add?", "Tu respaldo bajó el p99 en una prueba de carga y después empeoró un incidente. ¿Qué pasó y qué agregarías?"),
    t("During the incident the whole service was slow, so most requests passed the hedge delay and got copies: more load exactly when there was no capacity left. Add a budget (copies at most a few percent of requests, as a token bucket), cancel losers, stop hedging when most requests are slow or errors rise (a circuit breaker on hedging, as in lesson 04, Circuit breakers), and alert on the hedge rate itself.",
      "Durante el incidente todo el servicio estaba lento, así que la mayoría de las solicitudes pasó la demora del respaldo y recibió copias: más carga justo cuando no quedaba capacidad. Agrega un presupuesto (copias para como mucho un pequeño porcentaje de las solicitudes, como una cubeta de tokens), cancela a las perdedoras, deja de respaldar cuando la mayoría de las solicitudes está lenta o suben los errores (un interruptor de circuito para el respaldo, como en la lección 04, Interruptores de circuito) y alerta sobre la tasa de respaldos misma.")],
  [t("What are tied requests, and when would you choose them over a delayed hedge?", "¿Qué son las solicitudes atadas y cuándo las elegirías en lugar de un respaldo con demora?"),
    t("The client queues the request on two servers at once, each copy tagged with the other; the server that starts it first tells the other to drop its copy. They skip the wait for the p95 and cost little extra work, so they suit tails made of queueing. They need servers that can talk to each other about cancellation, a small gap between the two sends so idle servers don't both start, and they don't help once a request is already running on a server that stalls. Dean and Barroso describe both techniques in \"The Tail at Scale\".",
      "El cliente encola la solicitud en dos servidores a la vez, cada copia marcada con la otra; el servidor que la empieza primero le avisa al otro que descarte su copia. Se saltan la espera hasta el p95 y cuestan poco trabajo extra, así que sirven para colas de latencia hechas de espera en fila. Necesitan servidores que puedan avisarse la cancelación, un pequeño intervalo entre los dos envíos para que dos servidores libres no empiecen ambos, y no ayudan una vez que la solicitud ya corre en un servidor que se traba. Dean y Barroso describen ambas técnicas en \"The Tail at Scale\".")],
];

export default defineLesson({
  title: t("Hedged Requests Workbench", "Banco de trabajo: solicitudes con respaldo"),
  eyebrow: t("Systems lesson 48 · Hedged requests", "Lección de sistemas 48 · Solicitudes con respaldo"),
  lede: t("A request that lands on a slow replica waits for it. A hedged request sends a copy to another replica if the first hasn't answered after a short delay, and keeps whichever answer comes first: a few percent more work for a shorter tail. This lesson runs a kitchen pass with five cooks: watch tickets get a backup, predict when hedging backfires, then explain it back.",
    "Una solicitud que cae en una réplica lenta la espera. Una solicitud con respaldo (hedged request) envía una copia a otra réplica si la primera no respondió tras una demora corta, y se queda con la primera respuesta que llegue: un pequeño porcentaje más de trabajo a cambio de una cola más corta. Esta lección usa un pase de cocina con cinco cocineros: mira cómo las comandas reciben un respaldo, predice cuándo el respaldo sale mal y después explícalo."),
  machine: {
    intro: t(`Each ticket is a request and each cook a replica. The pass sends a ticket to a cook at random; if no answer is back after the hedge delay (the lit mark on the timer dial), a lit copy goes to another cook. Now and then a cook stalls and everything on its rail waits. Stall cook 3 yourself, then try cancelling the loser, tying requests, heavy tickets and more traffic.`,
      `Cada comanda es una solicitud y cada cocinero una réplica. El pase manda cada comanda a un cocinero al azar; si no volvió una respuesta después de la demora del respaldo (la marca encendida en el reloj), una copia encendida va a otro cocinero. De vez en cuando un cocinero se traba y todo lo que está en su riel espera. Traba tú al cocinero 3 y después prueba cancelar a la perdedora, atar las solicitudes, las comandas pesadas y más tráfico.`),
    plate: {
      title: t("Kitchen pass", "Pase de cocina"),
      keys: [
        { mark: "lit", label: t("A hedge copy; a stalled cook's sign; the hedge delay on the dial", "Una copia de respaldo; el letrero de un cocinero trabado; la demora del respaldo en el reloj") },
        { mark: "raised", label: t("Tickets: requests, numbered, hanging in the order the cook will take them", "Comandas: solicitudes numeradas, colgadas en el orden en que el cocinero las tomará") },
        { mark: "flat", label: t("Rails: each cook's queue, from the pass to the stove", "Rieles: la cola de cada cocinero, del pase a la estufa") },
      ],
      caption: t(
        `The pass (the client) hangs each ticket on a random cook's rail; the cook works through the rail one ticket at a time, about ${WORK} ms each, and the strip on the stove shows progress. The timer dial shows how long the oldest ticket has been out. When it passes the lit mark, a lit copy goes to another cook, and the first answer back lands in the tray. A loser that is cancelled leaves its rail; one that runs on is cooked anyway and lands on the WASTED tray. Each cook stalls about once every ${STALL_EVERY / 1000} s of kitchen time, for ${STALL[0]} to ${STALL[1]} ms, and its STALL sign lights.`,
        `El pase (el cliente) cuelga cada comanda en el riel de un cocinero al azar; el cocinero despacha su riel una comanda a la vez, unos ${WORK} ms cada una, y la barra de la estufa muestra el avance. El reloj muestra cuánto lleva pendiente la comanda más antigua. Cuando pasa la marca encendida, una copia encendida va a otro cocinero, y la primera respuesta en volver cae en la bandeja. Una perdedora que se cancela sale de su riel; una que sigue se cocina igual y termina en la bandeja de DESCARTE. Cada cocinero se traba más o menos una vez cada ${STALL_EVERY / 1000} s de tiempo de cocina, entre ${STALL[0]} y ${STALL[1]} ms, y se enciende su letrero TRABA.`,
      ),
      stage: { "data-office": "" },
      label: t("Kitchen pass simulation of hedged requests. Space pauses or resumes.", "Simulación de solicitudes con respaldo en un pase de cocina. Espacio pausa o reanuda."),
    },
    svg: buildFigure({ mark: P95 }),
    stats: [["answered", t("Answered", "Respondidas")], ["p50", t("p50", "p50"), "–"], ["p99", t("p99", "p99"), "–"], ["copies", t("Got a copy", "Con copia"), "–"], ["extra", t("Extra work", "Trabajo extra"), "–"], ["busy", t("Cooks busy", "Cocineros ocupados"), "–"]],
    controls: [
      { seg: "mode", label: t("Second copy", "Segunda copia"), options: [["off", t("None", "Ninguna")], ["hedge", t("Hedge", "Respaldo")], ["tied", t("Tied", "Atada")]], value: "hedge" },
      { seg: "delay", label: t("Hedge after", "Respaldo tras"), options: [[1, "1 ms"], [P95, t(`p95 (${P95} ms)`, `p95 (${P95} ms)`)]], value: P95 },
      { seg: "cancel", label: t("Loser", "Perdedora"), options: [["keep", t("Runs on", "Sigue")], ["cancel", t("Cancelled", "Se cancela")]], value: "cancel" },
      { seg: "budget", label: t("Hedge budget", "Presupuesto"), options: [["0", t("None", "Ninguno")], ["0.05", t("5% of requests", "5% de las solicitudes")]], value: "0" },
      { seg: "load", label: t("Traffic (cooks busy)", "Tráfico (ocupación)"), options: [[0.5, "50%"], [0.7, "70%"], [0.9, "90%"]], value: 0.5 },
      { seg: "stalls", label: t("Cook stalls", "Trabas"), options: [["on", t("Now and then", "De vez en cuando")], ["off", t("Never", "Nunca")]], value: "on" },
      { seg: "heavy", label: t("Heavy tickets", "Comandas pesadas"), options: [["0", t("None", "Ninguna")], ["0.02", t(`1 in 50, ${HEAVY_X}× the work`, `1 de cada 50, ${HEAVY_X}× el trabajo`)]], value: "0" },
      { speed: true },
      { actions: [["stall", t("Stall cook 3", "Trabar al cocinero 3"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Times are in milliseconds; at ×1 the machine plays them 100 times slower, so a 10 ms ticket takes a second. Changing a setting starts the run again.",
      "Los tiempos están en milisegundos; a ×1 la máquina los muestra 100 veces más lento, así que una comanda de 10 ms tarda un segundo. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: {
    intro: t(`The <a href="../percentiles/">Percentiles lesson</a> showed how fan-out turns one replica's rare stall into a common slow request, and that a copy after the p95 cuts the tail. These experiments are about what that copy costs and when it backfires. Choose what you expect <em>before</em> running each one. Results come from the same model as the machine, averaged over six seeded runs of a minute each; the hedge delay is the healthy kitchen's p95, ${D}.`,
      `La <a href="../percentiles/">lección de Percentiles</a> mostró cómo el fan-out convierte la traba rara de una réplica en una solicitud lenta común, y que una copia tras el p95 recorta la cola. Estos experimentos tratan de cuánto cuesta esa copia y cuándo sale mal. Elige lo que esperas <em>antes</em> de ejecutar cada uno. Los resultados salen del mismo modelo que la máquina, promediados sobre seis ejecuciones de un minuto con semilla fija; la demora del respaldo es el p95 de la cocina sana, ${D}.`),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Hedged and tied requests follow Jeffrey Dean and Luiz André Barroso, <a href="https://research.google/pubs/the-tail-at-scale/" target="_blank" rel="noopener">"The Tail at Scale"</a>, Communications of the ACM 56(2), 2013.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Las solicitudes con respaldo y las atadas siguen a Jeffrey Dean y Luiz André Barroso, <a href="https://research.google/pubs/the-tail-at-scale/" target="_blank" rel="noopener">"The Tail at Scale"</a>, Communications of the ACM 56(2), 2013.`),
  css: `
.hg-prog{fill:var(--anatomy-strong);stroke:none}
.iso-stage [data-tickets] text,.iso-stage [data-fly] text{pointer-events:none}
.iso-stage [data-mark]{stroke-width:1.8}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    TICKET_SVG: ticketSvg(),
    P95,
    TITLES: Object.fromEntries(EXPERIMENTS.map(({ id, title }) => [id, title])),
  },
});
