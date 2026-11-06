// @ts-nocheck: content in the style of the other lessons
// Systems lesson 76 · Bulkheads: a ship's hold split into compartments, one per dependency, out of one pool of workers.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, one } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, tagSvg, P, GEOMETRY, FIGURE_CSS } from "./figure";
import { hangRun, slowRun, queueRun, rushRun, timeoutRun, RATES, TIMES, DEADLINE, HANG, SLOW, WORKERS, DOOR, CAPS } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each).
const R = { hang: hangRun(), slow: slowRun(), queue: queueRun(), rush: rushRun(), timeout: timeoutRun() };

const idle = (r) => String(Math.round(WORKERS - r.busy));
const bar = (label, share, after) => [label, share, pct(share), after];

const RUNS = {
  hang: () => {
    const { shared: a, split: b } = R.hang;
    return {
      verdict: t("One shared pool: answered in time, search " + pct(a.ok0) + ", checkout " + pct(a.ok1) + ", profile " + pct(a.ok2) + ". Five per dependency: checkout " + pct(b.ok1) + ", profile " + pct(b.ok2) + ", search " + pct(b.ok0) + ", with " + pct(b.turned0) + " of search requests turned away at once.",
        "Un pool compartido: respondidas a tiempo, búsqueda " + pct(a.ok0) + ", compra " + pct(a.ok1) + ", perfil " + pct(a.ok2) + ". Cinco por dependencia: compra " + pct(b.ok1) + ", perfil " + pct(b.ok2) + ", búsqueda " + pct(b.ok0) + ", con " + pct(b.turned0) + " de las solicitudes de búsqueda rechazadas al instante."),
      bars: [
        bar(t("Checkout in time, one pool", "Compra a tiempo, un pool"), a.ok1), bar(t("Checkout in time, 5 each", "Compra a tiempo, 5 cada una"), b.ok1, true),
        bar(t("Profile in time, one pool", "Perfil a tiempo, un pool"), a.ok2), bar(t("Profile in time, 5 each", "Perfil a tiempo, 5 cada una"), b.ok2, true),
        bar(t("Search in time, 5 each", "Búsqueda a tiempo, 5 cada una"), b.ok0),
      ],
    };
  },
  slow: () => {
    const { split: s, shared: o, healthy: h } = R.slow;
    return {
      verdict: t("Search requests turned away with 5 per dependency: " + pct(h.turned0) + " when healthy, " + pct(s.turned0) + " three times slower. In one shared pool, three times slower: " + pct(o.turned0) + ". Every search call that got a place was answered in time (" + pct(s.ok0) + " of all search requests).",
        "Solicitudes de búsqueda rechazadas con 5 por dependencia: " + pct(h.turned0) + " sana, " + pct(s.turned0) + " tres veces más lenta. En un pool compartido, tres veces más lenta: " + pct(o.turned0) + ". Toda llamada de búsqueda que consiguió lugar se respondió a tiempo (" + pct(s.ok0) + " de todas las solicitudes de búsqueda)."),
      bars: [
        bar(t("Turned away, healthy, 5 each", "Rechazadas, sana, 5 cada una"), h.turned0), bar(t("Turned away, 3× slower, 5 each", "Rechazadas, 3× más lenta, 5 cada una"), s.turned0, true),
        bar(t("Turned away, 3× slower, one pool", "Rechazadas, 3× más lenta, un pool"), o.turned0),
      ],
    };
  },
  queue: () => {
    const { reject: r, queue: q, shared: o } = R.queue;
    return {
      verdict: t("Answered in time with a full compartment turning requests away: checkout " + pct(r.ok1) + ", profile " + pct(r.ok2) + ". Queueing for a place: checkout " + pct(q.ok1) + ", profile " + pct(q.ok2) + ", with " + one(q.busy) + " of the " + WORKERS + " workers busy on average. One shared pool, for comparison: " + pct(o.ok1) + " and " + pct(o.ok2) + ".",
        "Respondidas a tiempo cuando un compartimento lleno rechaza: compra " + pct(r.ok1) + ", perfil " + pct(r.ok2) + ". Haciendo fila por un lugar: compra " + pct(q.ok1) + ", perfil " + pct(q.ok2) + ", con " + one(q.busy) + " de los " + WORKERS + " trabajadores ocupados en promedio. Un pool compartido, para comparar: " + pct(o.ok1) + " y " + pct(o.ok2) + "."),
      bars: [
        bar(t("Checkout in time, turn away", "Compra a tiempo, rechazar"), r.ok1), bar(t("Checkout in time, queue", "Compra a tiempo, hacer fila"), q.ok1, true),
        bar(t("Profile in time, turn away", "Perfil a tiempo, rechazar"), r.ok2), bar(t("Profile in time, queue", "Perfil a tiempo, hacer fila"), q.ok2, true),
        bar(t("Checkout in time, one pool", "Compra a tiempo, un pool"), o.ok1),
      ],
    };
  },
  rush: () => {
    const { shared: o, split: s, caps: c } = R.rush;
    return {
      verdict: t("Checkout requests turned away in the rush: " + pct(o.away1) + " with one shared pool, " + pct(s.away1) + " with 5 per dependency, while about " + idle(s) + " of the " + WORKERS + " workers sat idle on average. Caps of 8 per dependency: " + pct(c.away1) + ".",
        "Solicitudes de compra rechazadas en la avalancha: " + pct(o.away1) + " con un pool compartido, " + pct(s.away1) + " con 5 por dependencia, mientras unos " + idle(s) + " de los " + WORKERS + " trabajadores estaban ociosos en promedio. Topes de 8 por dependencia: " + pct(c.away1) + "."),
      bars: [
        bar(t("Turned away, one pool", "Rechazadas, un pool"), o.away1), bar(t("Turned away, 5 each", "Rechazadas, 5 cada una"), s.away1, true),
        bar(t("Turned away, caps of 8", "Rechazadas, topes de 8"), c.away1),
      ],
    };
  },
  timeout: () => {
    const { none: n, cut: c } = R.timeout;
    return {
      verdict: t("Search requests answered in time: " + pct(n.ok0) + " with no timeout, " + pct(c.ok0) + " with a 1 s timeout. Turned away at once: " + pct(n.turned0) + " → " + pct(c.turned0) + ". Checkout and profile: " + pct(c.ok1) + " and " + pct(c.ok2) + " in time.",
        "Solicitudes de búsqueda respondidas a tiempo: " + pct(n.ok0) + " sin tiempo límite, " + pct(c.ok0) + " con un tiempo límite de 1 s. Rechazadas al instante: " + pct(n.turned0) + " → " + pct(c.turned0) + ". Compra y perfil: " + pct(c.ok1) + " y " + pct(c.ok2) + " a tiempo."),
      bars: [
        bar(t("Search in time, no timeout", "Búsqueda a tiempo, sin tiempo límite"), n.ok0), bar(t("Search in time, 1 s timeout", "Búsqueda a tiempo, tiempo límite de 1 s"), c.ok0, true),
        bar(t("Turned away, no timeout", "Rechazadas, sin tiempo límite"), n.turned0), bar(t("Turned away, 1 s timeout", "Rechazadas, tiempo límite de 1 s"), c.turned0, true),
      ],
    };
  },
};

const { hang: H1, slow: H2, queue: H3, rush: H4, timeout: H5 } = R;
const busyOf = (rate, secs) => Math.round(rate * secs * 10) / 10;
const SLOW_T = TIMES[0] * SLOW;

const EXPERIMENTS = [
  {
    id: "hang",
    title: t("Search hangs", "La búsqueda se cuelga"),
    change: t("Half of search's calls hang for " + HANG + " s (one bad replica of two) · one shared pool of " + WORKERS + " workers → 5 per dependency, a full compartment turns requests away",
      "La mitad de las llamadas de búsqueda se cuelga " + HANG + " s (una réplica mala de dos) · un pool compartido de " + WORKERS + " trabajadores → 5 por dependencia, un compartimento lleno rechaza solicitudes"),
    question: t("With a compartment per dependency, how do checkout and profile do while search hangs?", "Con un compartimento por dependencia, ¿cómo les va a compra y perfil mientras la búsqueda se cuelga?"),
    options: [
      t("As on a normal day: search's calls can't take their workers", "Como un día normal: las llamadas de búsqueda no pueden quitarles trabajadores"),
      t("Better than with one pool, but they still miss often", "Mejor que con un pool, pero todavía fallan con frecuencia"),
      t("Worse than with one pool: each has 5 workers, not 15", "Peor que con un pool: cada una tiene 5 trabajadores, no 15"),
    ],
    answer: 0,
    why: t(
      "With one shared pool, search's hung calls end up holding all " + WORKERS + " workers (lesson 04, Circuit breakers, shows how a slow dependency does that), so checkout and profile wait at the door and only " + pct(H1.shared.ok1) + " and " + pct(H1.shared.ok2) + " are answered in time. With 5 places per dependency, search can hold at most its own 5; checkout and profile keep theirs and answer " + pct(H1.split.ok1) + " and " + pct(H1.split.ok2) + " in time, as on a healthy day. Five is plenty for them: by Little's law checkout keeps about " + busyOf(RATES[1], TIMES[1]) + " worker busy (" + RATES[1] + " a second × " + TIMES[1] + " s) and profile " + busyOf(RATES[2], TIMES[2]) + ". Search's own users get no help: its compartment is full of hung calls, so " + pct(H1.split.turned0) + " of search requests are turned away at once and " + pct(H1.split.ok0) + " are answered in time. A bulkhead doesn't fix the part that fails; it keeps the failure from spreading.",
      "Con un pool compartido, las llamadas colgadas de búsqueda terminan ocupando los " + WORKERS + " trabajadores (la lección 04, Interruptores de circuito, muestra cómo lo hace una dependencia lenta), así que compra y perfil esperan en la puerta y solo " + pct(H1.shared.ok1) + " y " + pct(H1.shared.ok2) + " se responden a tiempo. Con 5 lugares por dependencia, búsqueda puede ocupar como mucho sus propios 5; compra y perfil conservan los suyos y responden " + pct(H1.split.ok1) + " y " + pct(H1.split.ok2) + " a tiempo, como en un día sano. Cinco les sobra: por la ley de Little (Little's law), compra mantiene ocupado más o menos " + busyOf(RATES[1], TIMES[1]) + " trabajador (" + RATES[1] + " por segundo × " + TIMES[1] + " s) y perfil " + busyOf(RATES[2], TIMES[2]) + ". Los usuarios de búsqueda no ganan nada: su compartimento está lleno de llamadas colgadas, así que " + pct(H1.split.turned0) + " de las solicitudes de búsqueda se rechazan al instante y " + pct(H1.split.ok0) + " se responden a tiempo. Un mamparo no arregla la parte que falla; evita que la falla se extienda.",
    ),
    watch: { search: "hang", pool: "split", full: "reject", timeout: 0, rush: 1 },
  },
  {
    id: "slow",
    title: t("Search gets three times slower", "La búsqueda se pone tres veces más lenta"),
    change: t("Search calls " + TIMES[0] + " s → " + SLOW_T.toFixed(1) + " s on average (" + (SLOW_T / 2).toFixed(1) + " to " + (SLOW_T * 1.5).toFixed(1) + " s), still inside the " + DEADLINE + " s deadline · 5 per dependency",
      "Llamadas de búsqueda de " + TIMES[0] + " s → " + SLOW_T.toFixed(1) + " s en promedio (de " + (SLOW_T / 2).toFixed(1) + " a " + (SLOW_T * 1.5).toFixed(1) + " s), todavía dentro del plazo de " + DEADLINE + " s · 5 por dependencia"),
    question: t("What happens to search requests?", "¿Qué pasa con las solicitudes de búsqueda?"),
    options: [
      t("All answered in time, just more slowly", "Todas se responden a tiempo, solo que más lento"),
      t("Some turned away: its 5 places are full more often", "Algunas se rechazan: sus 5 lugares se llenan con más frecuencia"),
      t("All answered, but checkout and profile slow down too", "Todas se responden, pero compra y perfil también se ponen lentas"),
    ],
    answer: 1,
    why: t(
      "Little's law: calls in flight = arrival rate × time per call. At " + RATES[0] + " a second and " + TIMES[0] + " s, search keeps " + busyOf(RATES[0], TIMES[0]) + " places busy on average; at " + SLOW_T.toFixed(1) + " s, " + busyOf(RATES[0], SLOW_T) + " of its 5. Arrivals are random, so the compartment is often full even though the average fits, and every request that finds it full is turned away: " + pct(H2.split.turned0) + ", against " + pct(H2.healthy.turned0) + " when healthy, though every call that got a place was answered in time. In one shared pool the same slowdown costs nothing (" + pct(H2.shared.turned0) + " turned away). A compartment caps throughput at places ÷ time per call, here 5 ÷ " + SLOW_T.toFixed(1) + " s ≈ " + (5 / SLOW_T).toFixed(1) + " a second, so a bulkhead turns slowness into errors. Size it from your peak rate × the slowest call time you're willing to wait for (a high percentile, not the mean), with headroom, and alert on its rejections.",
      "Ley de Little: llamadas en curso = tasa de llegada × tiempo por llamada. A " + RATES[0] + " por segundo y " + TIMES[0] + " s, búsqueda mantiene ocupados " + busyOf(RATES[0], TIMES[0]) + " lugares en promedio; a " + SLOW_T.toFixed(1) + " s, " + busyOf(RATES[0], SLOW_T) + " de sus 5. Las llegadas son al azar, así que el compartimento se llena con frecuencia aunque el promedio quepa, y toda solicitud que lo encuentra lleno se rechaza: " + pct(H2.split.turned0) + ", contra " + pct(H2.healthy.turned0) + " cuando está sana, aunque toda llamada que consiguió lugar se respondió a tiempo. En un pool compartido la misma lentitud no cuesta nada (" + pct(H2.shared.turned0) + " rechazadas). Un compartimento pone un tope al rendimiento de lugares ÷ tiempo por llamada, aquí 5 ÷ " + SLOW_T.toFixed(1) + " s ≈ " + (5 / SLOW_T).toFixed(1) + " por segundo, así que un mamparo convierte la lentitud en errores. Dimensiónalo con tu tasa pico × el tiempo por llamada más lento que estás dispuesto a esperar (un percentil alto, no el promedio), con margen, y pon una alerta sobre sus rechazos.",
    ),
    watch: { search: "slow", pool: "split", full: "reject", timeout: 0, rush: 1 },
  },
  {
    id: "queue",
    title: t("Queue for a place instead", "Hacer fila por un lugar"),
    change: t("Search hangs as in the first experiment · 5 per dependency · a full compartment turns requests away → makes them queue for a place",
      "La búsqueda se cuelga como en el primer experimento · 5 por dependencia · un compartimento lleno rechaza las solicitudes → las pone a hacer fila por un lugar"),
    question: t("How do checkout and profile do now?", "¿Cómo les va ahora a compra y perfil?"),
    options: [
      t("Still fine: search's queue stays in its compartment", "Bien todavía: la fila de búsqueda se queda en su compartimento"),
      t("No better than with one shared pool", "No mejor que con un pool compartido"),
      t("A little worse: a few queued requests hold workers", "Un poco peor: algunas solicitudes en fila ocupan trabajadores"),
    ],
    answer: 1,
    why: t(
      "The compartment caps calls, not waiting. A queued request keeps its worker while it waits, and search's places come free only every few seconds (half the calls that get one hang for " + HANG + " s), so the queue grows until it holds every worker the compartment doesn't: all " + WORKERS + " are busy with search, and checkout and profile wait at the door. Only " + pct(H3.queue.ok1) + " and " + pct(H3.queue.ok2) + " are answered in time, fewer even than with one shared pool (" + pct(H3.shared.ok1) + " and " + pct(H3.shared.ok2) + "): there all " + WORKERS + " workers make calls and come free as they finish, here 10 of them only wait, so a worker comes free much less often. A full compartment should refuse at once, or after a short, bounded wait: the waiters hold arrival rate × wait workers (Little's law again). Resilience4j's semaphore bulkhead, for one, waits 0 ms by default (maxWaitDuration).",
      "El compartimento limita las llamadas, no la espera. Una solicitud en fila conserva su trabajador mientras espera, y los lugares de búsqueda se liberan solo cada pocos segundos (la mitad de las llamadas que consiguen uno se cuelgan " + HANG + " s), así que la fila crece hasta ocupar todos los trabajadores que no son del compartimento: los " + WORKERS + " quedan ocupados con búsqueda, y compra y perfil esperan en la puerta. Solo " + pct(H3.queue.ok1) + " y " + pct(H3.queue.ok2) + " se responden a tiempo, menos incluso que con un pool compartido (" + pct(H3.shared.ok1) + " y " + pct(H3.shared.ok2) + "): ahí los " + WORKERS + " trabajadores hacen llamadas y se liberan al terminarlas; aquí 10 de ellos solo esperan, así que un trabajador se libera con mucha menos frecuencia. Un compartimento lleno debería rechazar al instante, o tras una espera corta y acotada: los que esperan ocupan tasa de llegada × espera trabajadores (otra vez la ley de Little). El bulkhead de semáforo de Resilience4j, por ejemplo, espera 0 ms por defecto (maxWaitDuration).",
    ),
    watch: { search: "hang", pool: "split", full: "queue", timeout: 0, rush: 1 },
  },
  {
    id: "rush",
    title: t("A checkout rush", "Una avalancha de compras"),
    change: t("Checkout traffic ×4 (" + RATES[1] + " → " + RATES[1] * 4 + " a second) · search healthy · one shared pool → 5 per dependency",
      "Tráfico de compra ×4 (de " + RATES[1] + " a " + RATES[1] * 4 + " por segundo) · búsqueda sana · un pool compartido → 5 por dependencia"),
    question: t("Which turns away more checkout requests?", "¿Cuál rechaza más solicitudes de compra?"),
    options: [
      t("The shared pool: search and profile take workers it needs", "El pool compartido: búsqueda y perfil le quitan trabajadores"),
      t("The compartments: checkout can't use idle places next door", "Los compartimentos: compra no puede usar los lugares ociosos de al lado"),
      t("Neither: " + WORKERS + " workers are enough for the rush either way", "Ninguno: " + WORKERS + " trabajadores alcanzan para la avalancha en ambos casos"),
    ],
    answer: 1,
    why: t(
      "The rush keeps about " + busyOf(RATES[1] * 4, TIMES[1]) + " checkout calls in flight on average (" + RATES[1] * 4 + " a second × " + TIMES[1] + " s), and random arrivals push it past 5 often: the checkout compartment turns away " + pct(H4.split.away1) + " while about " + idle(H4.split) + " of the " + WORKERS + " workers sit idle. One shared pool turns away " + pct(H4.shared.away1) + ": its spare workers go wherever the work is. That is the price of isolation, as with fixed slots in lesson 50, Fair queueing. Caps that add up to more than the pool soften it: with at most 8 per dependency the rush lost " + pct(H4.caps.away1) + ", and when search hung, checkout and profile still answered " + pct(H4.capsHang.ok1) + " and " + pct(H4.capsHang.ok2) + " in time, because search could hold at most 8 of the " + WORKERS + ".",
      "La avalancha mantiene unas " + busyOf(RATES[1] * 4, TIMES[1]) + " llamadas de compra en curso en promedio (" + RATES[1] * 4 + " por segundo × " + TIMES[1] + " s), y las llegadas al azar la pasan de 5 con frecuencia: el compartimento de compra rechaza " + pct(H4.split.away1) + " mientras unos " + idle(H4.split) + " de los " + WORKERS + " trabajadores están ociosos. Un pool compartido rechaza " + pct(H4.shared.away1) + ": sus trabajadores libres van a donde está el trabajo. Ese es el precio del aislamiento, como con las franjas fijas de la lección 50, Encolamiento justo. Los topes que suman más que el pool lo suavizan: con 8 como máximo por dependencia la avalancha perdió " + pct(H4.caps.away1) + ", y cuando la búsqueda se colgó, compra y perfil siguieron respondiendo " + pct(H4.capsHang.ok1) + " y " + pct(H4.capsHang.ok2) + " a tiempo, porque búsqueda podía ocupar como mucho 8 de los " + WORKERS + ".",
    ),
    watch: { search: "healthy", pool: "split", full: "reject", timeout: 0, rush: 4 },
  },
  {
    id: "timeout",
    title: t("A timeout inside the compartment", "Un tiempo límite dentro del compartimento"),
    change: t("Search hangs as in the first experiment · 5 per dependency · search timeout off → 1 s (a healthy search call takes " + (TIMES[0] / 2).toFixed(1) + " to " + (TIMES[0] * 1.5).toFixed(1) + " s)",
      "La búsqueda se cuelga como en el primer experimento · 5 por dependencia · tiempo límite de búsqueda no → 1 s (una llamada de búsqueda sana tarda de " + (TIMES[0] / 2).toFixed(1) + " a " + (TIMES[0] * 1.5).toFixed(1) + " s)"),
    question: t("What share of search requests get an answer in time now?", "¿Qué parte de las solicitudes de búsqueda recibe ahora respuesta a tiempo?"),
    options: [
      t("Still almost none: the bad replica still hangs", "Casi ninguna todavía: la réplica mala sigue colgada"),
      t("About half: the healthy replica's calls get places again", "Más o menos la mitad: las llamadas a la réplica sana vuelven a tener lugar"),
      t("Nearly all: the freed places let every request through", "Casi todas: los lugares liberados dejan pasar todo"),
    ],
    answer: 1,
    why: t(
      "The bulkhead protected checkout and profile; the timeout helps search itself. Without it a hung call holds its place for " + HANG + " s, the compartment is nearly always full and " + pct(H5.none.turned0) + " of search requests are turned away. Cut at 1 s, a call holds its place for about 0.8 s on average (half take " + TIMES[0] + " s, half are cut at 1 s): " + RATES[0] + " a second × 0.8 s = 1.6 of 5 places, so nearly every request gets one (" + pct(H5.cut.turned0) + " turned away) and the healthy replica's half are answered: " + pct(H5.cut.ok0) + " in time, up from " + pct(H5.none.ok0) + ". The other half still fail, in 1 s instead of " + HANG + ". A retry on the other replica, or a load balancer that stops sending to the bad one, could save most of them (lesson 06, Retry storms, shows what blind retries cost); lesson 46, Timeouts & deadlines, covers how to choose the timeout.",
      "El mamparo protegió a compra y perfil; el tiempo límite (timeout) ayuda a la búsqueda misma. Sin él, una llamada colgada retiene su lugar " + HANG + " s, el compartimento está casi siempre lleno y se rechaza " + pct(H5.none.turned0) + " de las solicitudes de búsqueda. Cortada a 1 s, una llamada retiene su lugar unos 0.8 s en promedio (la mitad tarda " + TIMES[0] + " s, la otra mitad se corta a 1 s): " + RATES[0] + " por segundo × 0.8 s = 1.6 de 5 lugares, así que casi toda solicitud consigue uno (" + pct(H5.cut.turned0) + " rechazadas) y se responde la mitad que va a la réplica sana: " + pct(H5.cut.ok0) + " a tiempo, contra " + pct(H5.none.ok0) + " antes. La otra mitad sigue fallando, en 1 s en lugar de " + HANG + ". Un reintento a la otra réplica, o un balanceador de carga que deje de mandarle a la mala, podría salvar casi todas (la lección 06, Tormentas de reintentos, muestra lo que cuestan los reintentos a ciegas); la lección 46, Tiempos límite y plazos, cubre cómo elegir el tiempo límite.",
    ),
    watch: { search: "hang", pool: "split", full: "reject", timeout: 1, rush: 1 },
  },
];

const QUESTIONS = [
  [t("Your recommendations service starts hanging and your login page goes down. Explain the chain, and where a bulkhead would have stopped it.",
     "Tu servicio de recomendaciones empieza a colgarse y se cae tu página de login. Explica la cadena y dónde la habría detenido un mamparo."),
   t("Login and recommendations share one pool of request threads (or one connection pool, or one client's in-flight limit). Each recommendations call holds a thread until it returns or times out; they arrive faster than they finish, so soon every thread waits on recommendations and login requests queue at the door or are refused. A cap on concurrent recommendations calls, sized from its normal load (a semaphore, or a separate small thread pool), stops it at that cap: recommendations fail fast and show a fallback, login keeps its threads. A timeout shortens how long each call holds its place, and a circuit breaker (lesson 04) stops calling it while it's broken.",
     "Login y recomendaciones comparten un pool de hilos de solicitudes (o un pool de conexiones, o el límite de llamadas en curso de un cliente). Cada llamada a recomendaciones retiene un hilo hasta que vuelve o vence su tiempo límite; llegan más rápido de lo que terminan, así que pronto todos los hilos esperan a recomendaciones y las solicitudes de login hacen fila en la puerta o se rechazan. Un tope de llamadas simultáneas a recomendaciones, dimensionado con su carga normal (un semáforo o un pool de hilos aparte y pequeño), la frena en ese tope: recomendaciones falla rápido y muestra un plan B (fallback), y login conserva sus hilos. Un tiempo límite acorta cuánto retiene su lugar cada llamada, y un interruptor de circuito (lección 04) deja de llamarla mientras está rota.")],
  [t("How do you size the compartment for one dependency?", "¿Cómo dimensionas el compartimento de una dependencia?"),
   t("Little's law: calls in flight = peak rate × time per call. Use a slow but acceptable call time (a high percentile such as p99), not the mean, and add headroom for random bursts: a compartment sized at exactly the average is full much of the time. Remember what the cap implies: at most cap ÷ call time calls a second, so when the dependency slows down, the compartment starts turning requests away. Watch calls in flight and rejections per dependency; adaptive concurrency limits (Netflix's concurrency-limits library, Envoy's adaptive concurrency filter) adjust the cap from measured latency instead of a fixed number.",
     "Ley de Little: llamadas en curso = tasa pico × tiempo por llamada. Usa un tiempo por llamada lento pero aceptable (un percentil alto como p99), no el promedio, y agrega margen para las ráfagas al azar: un compartimento dimensionado justo con el promedio está lleno buena parte del tiempo. Recuerda lo que implica el tope: como mucho tope ÷ tiempo por llamada llamadas por segundo, así que cuando la dependencia se pone lenta, el compartimento empieza a rechazar solicitudes. Vigila las llamadas en curso y los rechazos por dependencia; los límites de concurrencia adaptativos (la biblioteca concurrency-limits de Netflix, el filtro de concurrencia adaptativa de Envoy) ajustan el tope según la latencia medida en lugar de un número fijo.")],
  [t("A thread pool per dependency, or a semaphore: what is the difference?", "¿Un pool de hilos por dependencia o un semáforo: cuál es la diferencia?"),
   t("A thread-pool bulkhead runs the call on the compartment's own threads, so the caller can stop waiting at its timeout even when the call itself can't be interrupted, at the cost of extra threads and a hand-off per call. A semaphore bulkhead is a counter checked on the caller's own thread: cheap, but the caller is the one held for the whole call, so it needs a timeout on the call itself. Either way a full compartment should refuse at once or after a short, bounded wait, never queue without limit. Netflix's Hystrix (now in maintenance mode) made thread-pool isolation popular; Resilience4j offers both kinds.",
     "Un bulkhead de pool de hilos hace la llamada en los hilos propios del compartimento, así que quien llama puede dejar de esperar en su tiempo límite aunque la llamada misma no se pueda interrumpir, a cambio de hilos extra y un traspaso por llamada. Un bulkhead de semáforo es un contador que se revisa en el hilo de quien llama: barato, pero es ese hilo el que queda retenido toda la llamada, así que necesita un tiempo límite en la llamada misma. En los dos casos, un compartimento lleno debería rechazar al instante o tras una espera corta y acotada, nunca hacer fila sin límite. Hystrix, de Netflix (hoy en modo de mantenimiento), popularizó el aislamiento con pools de hilos; Resilience4j ofrece los dos tipos.")],
  [t("When would you give each tenant its own compartment, and how is that different from fair queueing?", "¿Cuándo le darías a cada cliente (tenant) su propio compartimento, y en qué se diferencia del encolamiento justo?"),
   t("When one tenant's load can use up a shared resource: one customer's heavy reports holding every worker, or a big tenant exhausting the database pool. A per-tenant cap on concurrent requests, separate pools, or for the largest customers their own instances or cells, keeps one tenant's overload or slow queries away from the others. Fair queueing (lesson 50) decides the order in which waiting work is served, so each tenant gets its share; a bulkhead caps how much a tenant can hold at once, which also protects against slow requests, not just many. A rate limit (lesson 05, Rate limiting) caps how fast requests arrive. They work well together.",
     "Cuando la carga de un cliente puede agotar un recurso compartido: los reportes pesados de un cliente ocupando todos los trabajadores, o un cliente grande agotando el pool de la base de datos. Un tope por cliente de solicitudes simultáneas, pools separados o, para los clientes más grandes, sus propias instancias o celdas, mantiene la sobrecarga o las consultas lentas de un cliente lejos de los demás. El encolamiento justo (lección 50) decide en qué orden se atiende el trabajo que espera, para que cada cliente reciba su parte; un mamparo limita cuánto puede ocupar un cliente a la vez, lo que también protege de solicitudes lentas, no solo de muchas. Un límite de tasa (lección 05, Limitación de tasa) limita qué tan rápido llegan. Funcionan bien juntos.")],
  [t("What should a request get when its compartment is full?", "¿Qué debería recibir una solicitud cuando su compartimento está lleno?"),
   t("A fast, honest answer: a fallback (cached results, a default, a page without that one widget) or an error the client can act on, such as a 503 with Retry-After. Not a long wait: waiting holds the very worker the bulkhead was meant to protect. Count rejections per compartment and alert on them: they are the first sign that a dependency slowed down or that the cap is too small for today's traffic.",
     "Una respuesta rápida y honesta: un plan B (resultados en caché, un valor por defecto, una página sin ese widget) o un error con el que el cliente pueda hacer algo, como un 503 con Retry-After. No una espera larga: esperar retiene justo el trabajador que el mamparo debía proteger. Cuenta los rechazos por compartimento y pon alertas sobre ellos: son la primera señal de que una dependencia se puso lenta o de que el tope es pequeño para el tráfico de hoy.")],
  [t("Threads aren't the only thing a slow dependency can use up. Where else do you put bulkheads?", "Los hilos no son lo único que una dependencia lenta puede agotar. ¿Dónde más pones mamparos?"),
   t("Anywhere one dependency or workload can take what the others need: a connection pool per downstream service or database (lesson 29, Connection pooling); a cap on in-flight calls in async clients, where no thread is held but memory, sockets and the downstream's capacity are (lesson 15, Async I/O); separate queues and consumers per kind of job; CPU and memory limits per container; separate node pools or clusters for critical services; and at the largest scale cells, independent copies of the whole stack, each serving a slice of the customers.",
     "En cualquier lugar donde una dependencia o una carga pueda quedarse con lo que necesitan las demás: un pool de conexiones por servicio o base de datos de destino (lección 29, Pool de conexiones); un tope de llamadas en curso en los clientes asíncronos, donde no se retiene un hilo pero sí memoria, sockets y la capacidad del destino (lección 15, E/S asíncrona); colas y consumidores separados por tipo de trabajo; límites de CPU y memoria por contenedor; grupos de nodos o clústeres separados para los servicios críticos; y, a la escala más grande, celdas: copias independientes de todo el sistema, cada una atendiendo a una parte de los clientes.")],
];

export default defineLesson({
  title: t("Bulkhead Workbench", "Banco de trabajo: mamparos"),
  eyebrow: t("Systems lesson 76 · Bulkheads", "Lección de sistemas 76 · Mamparos (bulkheads)"),
  lede: t("A ship's hold is split by bulkheads so that one leak floods one compartment, not the ship. A service can do the same: cap how many workers each dependency can hold, and one that hangs takes down only the calls that need it. This lesson runs a hold with a compartment per dependency: watch a machine do it, predict what breaks it, then explain it back.",
    "La bodega de un barco se divide con mamparos (bulkheads) para que una vía de agua inunde un compartimento y no el barco entero. Un servicio puede hacer lo mismo: limitar cuántos trabajadores puede ocupar cada dependencia, y una que se cuelga solo tumba las llamadas que la necesitan. Esta lección usa una bodega con un compartimento por dependencia: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("One service, " + WORKERS + " workers (think request threads) and three endpoints, each calling its own dependency: search calls the search engine, checkout calls payments, profile calls the profile store. Each worker is held for its request's whole call. Split the pool into compartments, make the search engine slow or hang, choose what a full compartment does, and watch who still gets an answer in time.",
      "Un servicio, " + WORKERS + " trabajadores (workers; piensa en hilos de solicitudes) y tres endpoints, cada uno llamando a su propia dependencia: búsqueda llama al buscador, compra llama a pagos, perfil llama a la base de perfiles. Cada trabajador queda retenido durante toda la llamada de su solicitud. Divide el pool en compartimentos, pon el buscador lento o colgado, elige qué hace un compartimento lleno y mira quién sigue recibiendo respuesta a tiempo."),
    plate: {
      title: t("Ship's hold", "Bodega del barco"),
      keys: [
        { mark: "lit", label: t("A worker held past the " + DEADLINE + " s deadline, and its tag; a dependency's counter while its compartment is full; the search engine's replicas while it is slow, its bad replica while it hangs", "Un trabajador retenido más allá del plazo de " + DEADLINE + " s, y su etiqueta; el contador de una dependencia mientras su compartimento está lleno; las réplicas del buscador mientras está lento, su réplica mala mientras se cuelga") },
        { mark: "raised", label: t("Tags, lettered by endpoint (S search, C checkout, P profile): on a console, a call in flight; in a worker's hands, a request queued for a place", "Etiquetas con la letra de su endpoint (B búsqueda, C compra, P perfil): sobre una consola, una llamada en curso; en las manos de un trabajador, una solicitud haciendo fila por un lugar") },
        { mark: "flat", label: t("Bulkheads: full height for 5 per dependency, half height for caps of 8, flat for one shared pool", "Mamparos: altura completa con 5 por dependencia, media altura con topes de 8, en el piso con un pool compartido") },
      ],
      caption: t(
        "Requests arrive at random: search " + RATES[0] + " a second, checkout " + RATES[1] + ", profile " + RATES[2] + ". A healthy call takes " + TIMES[0] + " s, " + TIMES[1] + " s and " + TIMES[2] + " s on average, and callers give up after " + DEADLINE + " s, the deadline. A request takes a free worker or waits at the door; then it needs a place in its dependency's compartment, whose counter shows its calls in flight against the cap. A request that finds it full drops into the trough or, if full compartments queue, waits in its worker's hands. With one shared pool or caps of 8, a call past its compartment's five berths uses a free berth next door. When search hangs, its bad replica lights and half its calls answer only after " + HANG + " s. Under the hold: each endpoint's requests answered in time over the last 30 s; on the crew board, the workers busy.",
        "Las solicitudes llegan al azar: búsqueda " + RATES[0] + " por segundo, compra " + RATES[1] + ", perfil " + RATES[2] + ". Una llamada sana tarda " + TIMES[0] + " s, " + TIMES[1] + " s y " + TIMES[2] + " s en promedio, y quien llama se rinde a los " + DEADLINE + " s, el plazo (deadline). Una solicitud toma un trabajador libre o espera en la puerta; después necesita lugar en el compartimento de su dependencia, cuyo contador muestra sus llamadas en curso frente al tope. Si está lleno, cae a la canaleta o, si los compartimentos llenos hacen fila, espera en las manos de su trabajador. Con un pool compartido o topes de 8, una llamada que no cabe en sus cinco puestos usa uno libre de al lado. Cuando la búsqueda se cuelga, se enciende su réplica mala y la mitad de sus llamadas responde a los " + HANG + " s. Bajo la bodega: la parte de cada endpoint respondida a tiempo en los últimos 30 s; en el tablero, los trabajadores ocupados.",
      ),
      stage: { "data-hold": "" },
      label: t("Bulkhead simulation. Space pauses or resumes.", "Simulación de mamparos. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["s0", t("Search in time", "Búsqueda a tiempo"), "–"],
      ["s1", t("Checkout in time", "Compra a tiempo"), "–"],
      ["s2", t("Profile in time", "Perfil a tiempo"), "–"],
      ["busy", t("Workers busy", "Trabajadores ocupados"), "–"],
      ["turned", t("Turned away", "Rechazadas"), "–"],
      ["door", t("At the door", "En la puerta"), "–"],
    ],
    controls: [
      { seg: "search", label: t("Search engine", "Buscador"), options: [["healthy", t("Healthy", "Sano")], ["slow", t("3× slower", "3× más lento")], ["hang", t("Half its calls hang", "La mitad se cuelga")]], value: "hang" },
      { seg: "pool", label: t("Workers", "Trabajadores"), options: [["shared", t("One shared pool", "Un pool compartido")], ["split", t("5 per dependency", "5 por dependencia")], ["caps", t("Caps of 8", "Topes de 8")]], value: "split" },
      { seg: "full", label: t("Full compartment", "Compartimento lleno"), options: [["reject", t("Turn away at once", "Rechazar al instante")], ["queue", t("Queue for a place", "Hacer fila por un lugar")]], value: "reject" },
      { seg: "timeout", label: t("Search timeout", "Tiempo límite de búsqueda"), options: [[0, t("Off", "No")], [1, "1 s"]], value: 0 },
      { seg: "rush", label: t("Checkout traffic", "Tráfico de compra"), options: [[1, t("Normal", "Normal")], [4, t("Rush ×4", "Avalancha ×4")]], value: 1 },
      { speed: true },
      { actions: [["rush20", t("Checkout rush, 20 s", "Avalancha de compras, 20 s"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Each call takes 0.5 to 1.5 × its mean; the door holds " + DOOR + " requests; the numbers are illustrative and round. Caps of 8 add up to 24 places for " + WORKERS + " workers: each dependency can borrow idle workers, up to 8. In time, turned away: the last 30 s. Changing a setting starts the run again.",
      "Cada llamada tarda de 0.5 a 1.5 × su promedio; en la puerta caben " + DOOR + " solicitudes; los números son ilustrativos y redondos. Los topes de 8 suman 24 lugares para " + WORKERS + " trabajadores: cada dependencia puede tomar prestados trabajadores ociosos, hasta 8. A tiempo y rechazadas: los últimos 30 s. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, two minutes of traffic averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, dos minutos de tráfico promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Bulkheads are one of the stability patterns in Michael Nygard's <em>Release It!</em> (2007).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los mamparos son uno de los patrones de estabilidad de <em>Release It!</em>, de Michael Nygard (2007).`),
  css: `
${FIGURE_CSS}
.iso-stage [data-layer] text{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: { P, G: GEOMETRY, TAG_SVG: tagSvg(), CAPS: { shared: 0, split: CAPS.split, caps: CAPS.caps } },
});
