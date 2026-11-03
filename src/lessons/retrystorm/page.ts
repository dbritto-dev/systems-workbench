// @ts-nocheck: content ported as-is
// Systems lesson 06 · Retry storms: a ticket office with one window.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct } from "../../lib/format";
import { buildFigure, P, GEOMETRY, pawnSvg, ticketSvg } from "./figure";
import { experimentResults } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const RESULTS = experimentResults();

// What each card shows after a run (16 seeds each).
const storm = (r) => r.recoveredShare === 0 ? "2 min+" : Math.round(r.recovery) + " s";
const stormEs = (r) => r.recoveredShare === 0 ? "más de 2 min" : Math.round(r.recovery) + " s";
const stormT = (r) => t(storm(r), stormEs(r));
const stormShare = (r) => Math.min(1, r.recovery / 120);
const perSec = (x) => x.toFixed(1) + "/s";
const RUNS_RAW = {
  retry: () => {
    const { a, b } = RESULTS.retry;
    return { verdict: t("Without retries the trouble was over " + storm(a) + " after the rush. With three immediate retries it had not ended after 2 minutes in " + pct(1 - b.recoveredShare) + " of runs: " + b.attemptsPerRequest.toFixed(1) + " attempts per request, and only " + perSec(b.goodputRate) + " answered instead of " + perSec(a.goodputRate) + ".",
        "Sin reintentos, el problema terminó " + stormEs(a) + " después de la avalancha. Con tres reintentos inmediatos no había terminado después de 2 minutos en el " + pct(1 - b.recoveredShare) + " de las ejecuciones: " + b.attemptsPerRequest.toFixed(1) + " intentos por solicitud, y solo " + perSec(b.goodputRate) + " respondidos en lugar de " + perSec(a.goodputRate) + "."),
      groups: [[t("Trouble lasted", "El problema duró"), [[t("No retries", "Sin reintentos"), stormShare(a), stormT(a)], [t("3 immediate retries", "3 reintentos inmediatos"), stormShare(b), stormT(b), true]]],
        [t("Answered per second", "Respondidos por segundo"), [[t("No retries", "Sin reintentos"), a.goodputRate / 3, perSec(a.goodputRate)], [t("3 immediate retries", "3 reintentos inmediatos"), b.goodputRate / 3, perSec(b.goodputRate), true]]]] };
  },
  backoff: () => {
    const { a, b } = RESULTS.backoff;
    return { verdict: t("With backoff the storm ended " + (b.recoveredShare === 1 ? "in every run" : "in " + pct(b.recoveredShare) + " of runs") + ", after " + storm(b) + " on average. The tallest wave of attempts after the rush was still " + perSec(b.peak) + " (immediate retries: " + perSec(a.peak) + "), against a capacity of 3/s.",
        "Con espera exponencial, la tormenta terminó " + (b.recoveredShare === 1 ? "en todas las ejecuciones" : "en el " + pct(b.recoveredShare) + " de las ejecuciones") + ", después de " + stormEs(b) + " en promedio. La ola de intentos más alta después de la avalancha seguía siendo de " + perSec(b.peak) + " (reintentos inmediatos: " + perSec(a.peak) + "), frente a una capacidad de 3/s."),
      groups: [[t("Trouble lasted", "El problema duró"), [[t("Immediate retries", "Reintentos inmediatos"), stormShare(a), stormT(a)], [t("Backoff 2 · 4 · 8 s", "Espera 2 · 4 · 8 s"), stormShare(b), stormT(b), true]]],
        [t("Tallest wave", "Ola más alta"), [[t("Immediate retries", "Reintentos inmediatos"), a.peak / 20, perSec(a.peak)], [t("Backoff 2 · 4 · 8 s", "Espera 2 · 4 · 8 s"), b.peak / 20, perSec(b.peak), true]]]] };
  },
  jitter: () => {
    const { a, b } = RESULTS.jitter;
    return { verdict: t("The tallest wave fell from " + perSec(a.peak) + " to " + perSec(b.peak) + " (" + Math.round(100 * (1 - b.peak / a.peak)) + "% lower). The storm lasted " + storm(a) + " without jitter and " + storm(b) + " with it.",
        "La ola más alta bajó de " + perSec(a.peak) + " a " + perSec(b.peak) + " (" + Math.round(100 * (1 - b.peak / a.peak)) + "% menos). La tormenta duró " + stormEs(a) + " sin jitter y " + stormEs(b) + " con jitter."),
      groups: [[t("Tallest wave", "Ola más alta"), [[t("Backoff", "Espera"), a.peak / 20, perSec(a.peak)], [t("Backoff + jitter", "Espera + jitter"), b.peak / 20, perSec(b.peak), true]]],
        [t("Trouble lasted", "El problema duró"), [[t("Backoff", "Espera"), stormShare(a), stormT(a)], [t("Backoff + jitter", "Espera + jitter"), stormShare(b), stormT(b), true]]]] };
  },
  timeout: () => {
    const { a, b } = RESULTS.timeout;
    return { verdict: t(pct(b.goodputShare) + " of the window's work reached a waiting client with a 0.8 s timeout (" + pct(a.goodputShare) + " with 3 s), while attempts rose from " + perSec(a.load) + " to " + perSec(b.load) + ".",
        "El " + pct(b.goodputShare) + " del trabajo de la ventanilla llegó a un cliente que esperaba con un tiempo límite de 0.8 s (" + pct(a.goodputShare) + " con 3 s), mientras los intentos subieron de " + perSec(a.load) + " a " + perSec(b.load) + "."),
      groups: [[t("Work that reached a client", "Trabajo que llegó a un cliente"), [[t("Timeout 3 s", "Tiempo límite 3 s"), a.goodputShare, pct(a.goodputShare)], [t("Timeout 0.8 s", "Tiempo límite 0.8 s"), b.goodputShare, pct(b.goodputShare), true]]],
        [t("Attempts per second", "Intentos por segundo"), [[t("Timeout 3 s", "Tiempo límite 3 s"), a.load / 10, perSec(a.load)], [t("Timeout 0.8 s", "Tiempo límite 0.8 s"), b.load / 10, perSec(b.load), true]]]] };
  },
  layers: () => {
    const { a, b, c } = RESULTS.layers;
    const top = Math.max(a.attemptsPerRequest, b.attemptsPerRequest);
    return { verdict: t("The worst case is 64. During the storm the office measured " + b.attemptsPerRequest.toFixed(1) + " attempts per request with three layers retrying, " + a.attemptsPerRequest.toFixed(1) + " with one, and " + c.attemptsPerRequest.toFixed(2) + " with three layers and a 10% retry budget, which also ended the trouble in " + storm(c) + ".",
        "El peor caso es 64. Durante la tormenta, la taquilla midió " + b.attemptsPerRequest.toFixed(1) + " intentos por solicitud con tres capas reintentando, " + a.attemptsPerRequest.toFixed(1) + " con una, y " + c.attemptsPerRequest.toFixed(2) + " con tres capas y un presupuesto de reintentos del 10%, que además terminó el problema en " + stormEs(c) + "."),
      groups: [[t("Attempts per request", "Intentos por solicitud"), [[t("1 layer", "1 capa"), a.attemptsPerRequest / top, a.attemptsPerRequest.toFixed(1)], [t("3 layers", "3 capas"), b.attemptsPerRequest / top, b.attemptsPerRequest.toFixed(1), true], [t("3 layers + budget", "3 capas + presupuesto"), c.attemptsPerRequest / top, c.attemptsPerRequest.toFixed(2)]]]] };
  },
};
// Results come in titled groups of bars.
const RUNS = Object.fromEntries(Object.entries(RUNS_RAW).map(([id, run]) => [id, () => {
  const out = run();
  return { verdict: out.verdict, groups: out.groups.map(([title, bars]) => ({ title, bars: bars.map(([label, share, text, after]) => [label, Math.max(0.01, Math.min(1, share)), text, after]) })) };
}]));

const EXPERIMENTS = [
  {
    id: "retry",
    title: t("Three quick retries", "Tres reintentos rápidos"),
    change: t("No retries → 3 retries, sent at once · then a rush of 16 visitors", "Sin reintentos → 3 reintentos, enviados de inmediato · luego una avalancha de 16 visitantes"),
    question: t(
      "Without retries, the trouble from a rush is over in about ten seconds. With three immediate retries, how long does it last?",
      "Sin reintentos, el problema de una avalancha termina en unos diez segundos. Con tres reintentos inmediatos, ¿cuánto dura?",
    ),
    options: [
      t("About the same: retries only help clients who were unlucky", "Más o menos lo mismo: los reintentos solo ayudan a los clientes con mala suerte"),
      t("Somewhat longer, maybe twice as long", "Algo más, quizá el doble"),
      t("It may not end on its own: the office stays overloaded long after the rush has gone", "Puede que no termine solo: la taquilla sigue sobrecargada mucho después de que pasó la avalancha"),
    ],
    answer: 2,
    why: t(
      "Every client that times out leaves its ticket in the line, and the window still serves it for nobody. Then the client queues again, and again. The line gets longer, so more clients time out, so more tickets are added: up to four per request. The window spends its time on abandoned tickets, and the rush is self-sustaining even after every visitor has left.",
      "Cada cliente que agota su tiempo límite deja su boleto en la fila, y la ventanilla igual lo atiende, para nadie. Luego el cliente se vuelve a formar, y otra vez. La fila crece, así que más clientes agotan su tiempo, así que se agregan más boletos: hasta cuatro por solicitud. La ventanilla gasta su tiempo en boletos abandonados, y la avalancha se sostiene sola aunque todos los visitantes ya se hayan ido.",
    ),
    watch: { retries: 3, backoff: "none", jitter: false, timeout: 3, layers: 1, budget: false, rush: true },
  },
  {
    id: "backoff",
    title: t("Wait before retrying", "Esperar antes de reintentar"),
    change: t("Immediate retries → exponential backoff · wait 2, then 4, then 8 s", "Reintentos inmediatos → espera exponencial (exponential backoff) · espera 2, luego 4, luego 8 s"),
    question: t(
      "Clients now wait on the benches before trying again. What happens after the rush?",
      "Ahora los clientes esperan en las bancas antes de volver a intentar. ¿Qué pasa después de la avalancha?",
    ),
    options: [
      t("Nothing changes: the storm still doesn't end", "Nada cambia: la tormenta sigue sin terminar"),
      t("The storm ends, but retries come back in waves almost as tall as the rush", "La tormenta termina, pero los reintentos vuelven en olas casi tan altas como la avalancha"),
      t("It ends about as fast as with no retries, with a smooth load", "Termina casi tan rápido como sin reintentos, con una carga pareja"),
    ],
    answer: 1,
    why: t(
      "While clients sit on the benches they are not adding tickets, so the window catches up and the storm ends. But the rush's visitors all timed out at the same moment, so they all wait exactly 2 s, come back together, time out together, and wait exactly 4 s. You can see them clumped on the same bench.",
      "Mientras los clientes están en las bancas no agregan boletos, así que la ventanilla se pone al día y la tormenta termina. Pero todos los visitantes de la avalancha agotaron su tiempo en el mismo momento, así que todos esperan exactamente 2 s, vuelven juntos, agotan su tiempo juntos y esperan exactamente 4 s. Puedes verlos amontonados en la misma banca.",
    ),
    watch: { retries: 3, backoff: "exp", jitter: false, timeout: 3, layers: 1, budget: false, rush: true },
  },
  {
    id: "jitter",
    title: t("Add jitter", "Agregar jitter"),
    change: t(
      "Exponential backoff → backoff with jitter · each wait spread between ½ and 1½ times its delay",
      "Espera exponencial → espera con jitter (variación aleatoria) · cada espera se reparte entre ½ y 1½ veces su retraso",
    ),
    question: t("The average wait is exactly the same as before. What does jitter change?", "La espera promedio es exactamente la misma que antes. ¿Qué cambia el jitter?"),
    options: [
      t("The storm ends much sooner", "La tormenta termina mucho antes"),
      t("The waves flatten: the tallest wave drops by about a third, but the storm lasts about as long", "Las olas se aplanan: la ola más alta baja como un tercio, pero la tormenta dura más o menos lo mismo"),
      t("Nothing: the same clients wait the same time on average", "Nada: los mismos clientes esperan el mismo tiempo en promedio"),
    ],
    answer: 1,
    why: t(
      "Jitter breaks up the clump: clients that failed together now return at different moments, so the window sees a trickle instead of a wave, and the tallest spike is far lower. It does not reduce how many retries there are, so the total work, and the time to recover, stay about the same. Jitter protects against spikes; budgets and backoff reduce work.",
      "El jitter deshace el montón: los clientes que fallaron juntos ahora vuelven en momentos distintos, así que la ventanilla ve un goteo en lugar de una ola, y el pico más alto es mucho menor. No reduce cuántos reintentos hay, así que el trabajo total, y el tiempo para recuperarse, quedan más o menos igual. El jitter protege contra los picos; los presupuestos y la espera reducen el trabajo.",
    ),
    watch: { retries: 3, backoff: "exp", jitter: true, timeout: 3, layers: 1, budget: false, rush: true },
  },
  {
    id: "timeout",
    title: t("A timeout that's too short", "Un tiempo límite demasiado corto"),
    change: t("Timeout 3 s → 0.8 s · the window normally takes 0.7 to 1.3 s · no rush", "Tiempo límite 3 s → 0.8 s · la ventanilla normalmente tarda de 0.7 a 1.3 s · sin avalancha"),
    question: t(
      "Nothing else is wrong. With three retries, what share of the window's work reaches a client who is still waiting?",
      "Nada más está mal. Con tres reintentos, ¿qué parte del trabajo de la ventanilla le llega a un cliente que todavía espera?",
    ),
    options: [
      t("Most of it: only the slow requests fail", "La mayor parte: solo fallan las solicitudes lentas"),
      t("About half", "Más o menos la mitad"),
      t("Almost none: the window is busy serving tickets whose clients already gave up", "Casi nada: la ventanilla está ocupada atendiendo boletos cuyos clientes ya se rindieron"),
    ],
    answer: 2,
    why: t(
      "Most requests take longer than 0.8 s even with an empty line, so the client gives up while the window is still working on it, then sends another. The window finishes every ticket anyway. Load more than triples and almost nothing useful comes out. A timeout must sit above the normal, slow-end latency of what you call, not at its average.",
      "La mayoría de las solicitudes tardan más de 0.8 s aun con la fila vacía, así que el cliente se rinde mientras la ventanilla todavía trabaja en ella, y luego envía otra. La ventanilla termina cada boleto de todos modos. La carga se multiplica por más de tres y casi nada útil sale. Un tiempo límite (timeout) debe quedar por encima de la latencia normal del extremo lento de lo que llamas, no en su promedio.",
    ),
    watch: { retries: 3, backoff: "none", jitter: false, timeout: 0.8, layers: 1, budget: false, rush: false },
  },
  {
    id: "layers",
    title: t("Retries at every layer", "Reintentos en cada capa"),
    change: t(
      "1 layer retries → 3 layers retry (app, client library, proxy) · 3 retries each",
      "Reintenta 1 capa → reintentan 3 capas (app, biblioteca cliente, proxy) · 3 reintentos cada una",
    ),
    question: t("In the worst case, how many attempts reach the window for one request?", "En el peor caso, ¿cuántos intentos llegan a la ventanilla por una sola solicitud?"),
    options: [
      t("9: three layers times three retries", "9: tres capas por tres reintentos"),
      t("12: the first attempt plus three retries at each of three layers", "12: el primer intento más tres reintentos en cada una de las tres capas"),
      t("64: each layer makes up to 4 attempts, and each of those runs the 4 attempts of the layer below", "64: cada capa hace hasta 4 intentos, y cada uno de ellos ejecuta los 4 intentos de la capa de abajo"),
    ],
    answer: 2,
    why: t(
      "Retries multiply, they don't add: 4 × 4 × 4 = 64 attempts for one request. During the storm the office measured above 30 attempts per request. Retry at one layer only, usually the one nearest the user, and give it a budget: here retries may be at most about 10% of new requests, so once the window struggles, clients fail fast instead of piling on.",
      "Los reintentos se multiplican, no se suman: 4 × 4 × 4 = 64 intentos por una solicitud. Durante la tormenta, la taquilla midió más de 30 intentos por solicitud. Reintenta en una sola capa, normalmente la más cercana al usuario, y dale un presupuesto (retry budget): aquí los reintentos pueden ser como máximo un 10% de las solicitudes nuevas, así que cuando la ventanilla no da abasto, los clientes fallan rápido en vez de amontonarse.",
    ),
    watch: { retries: 3, backoff: "none", jitter: false, timeout: 3, layers: 3, budget: false, rush: true },
  },
];

const QUESTIONS = [
  [t("Why can a ten-second rush turn into an outage that lasts after the rush is gone?",
     "¿Por qué una avalancha de diez segundos puede convertirse en una caída que sigue después de que la avalancha pasó?"),
   t("Clients time out and retry, but the server still does the work for the abandoned attempts. More attempts make the line longer, which makes more clients time out, which adds more attempts. The system settles in a state where it is fully busy with work nobody is waiting for. Removing the original cause doesn't fix it; reducing load does.",
     "Los clientes agotan su tiempo límite y reintentan, pero el servidor igual hace el trabajo de los intentos abandonados. Más intentos alargan la fila, lo que hace que más clientes agoten su tiempo, lo que agrega más intentos. El sistema se queda en un estado en el que está totalmente ocupado con trabajo que nadie espera. Quitar la causa original no lo arregla; reducir la carga sí.")],
  [t("Backoff ended the storm in the office. Why might it not in a system where new users keep arriving at a fixed rate?",
     "La espera exponencial terminó la tormenta en la taquilla. ¿Por qué podría no hacerlo en un sistema donde siguen llegando usuarios nuevos a un ritmo fijo?"),
   t("In the office, clients on a bench are not sending anything, so backoff lowers the load. When new requests keep arriving regardless, backoff only delays retries: every failed request still sends all its attempts eventually, so the total load can stay above capacity. That's why retry budgets and circuit breakers, which cap the number of retries, are needed on top.",
     "En la taquilla, los clientes en una banca no envían nada, así que la espera baja la carga. Cuando las solicitudes nuevas siguen llegando de todos modos, la espera solo retrasa los reintentos: cada solicitud fallida igual envía todos sus intentos tarde o temprano, así que la carga total puede quedar por encima de la capacidad. Por eso hacen falta además presupuestos de reintentos y circuit breakers (interruptores automáticos), que limitan cuántos reintentos hay.")],
  [t("If jitter doesn't change the average wait, why does it matter?",
     "Si el jitter no cambia la espera promedio, ¿por qué importa?"),
   t("Clients that failed at the same moment retry at the same moment. Those waves hit the server as spikes, which make queues long right then and cause more timeouts. Jitter spreads them out so the server sees a steady trickle. It reduces peaks, not the total number of retries.",
     "Los clientes que fallaron en el mismo momento reintentan en el mismo momento. Esas olas golpean al servidor como picos, que alargan las colas justo entonces y causan más timeouts. El jitter las reparte para que el servidor vea un goteo constante. Reduce los picos, no el número total de reintentos.")],
  [t("How would you choose a client timeout for a call that normally takes 50–200 ms?",
     "¿Cómo elegirías el tiempo límite del cliente para una llamada que normalmente tarda 50–200 ms?"),
   t("Above the slow end of normal latency (the p99 or so), not the average, with some room: maybe 500 ms to 1 s. Pair it with a deadline the server can see, so it can drop work for clients that have already given up instead of finishing it.",
     "Por encima del extremo lento de la latencia normal (más o menos el p99), no del promedio, con algo de margen: quizá de 500 ms a 1 s. Acompáñalo con un plazo (deadline) que el servidor pueda ver, para que descarte el trabajo de clientes que ya se rindieron en vez de terminarlo.")],
  [t("A request goes app → client library → proxy → service, and each retries 3 times. What would you change?",
     "Una solicitud va app → biblioteca cliente → proxy → servicio, y cada uno reintenta 3 veces. ¿Qué cambiarías?"),
   t("Retry in one place only, usually the outermost layer that knows whether retrying is safe and useful, and make the others fail fast. Worst case is 4 × 4 × 4 = 64 attempts otherwise. Add a retry budget so retries stop when the error rate is high.",
     "Reintentar en un solo lugar, normalmente la capa más externa que sabe si reintentar es seguro y útil, y hacer que las demás fallen rápido. Si no, el peor caso es 4 × 4 × 4 = 64 intentos. Agrega un presupuesto de reintentos para que se detengan cuando la tasa de errores es alta.")],
  [t("What does a retry budget do, and what should the client do when it's empty?",
     "¿Qué hace un presupuesto de reintentos (retry budget) y qué debe hacer el cliente cuando se agota?"),
   t("It caps retries at a share of normal traffic, e.g. 10%. When most calls fail, the budget runs out quickly and the client fails fast instead of multiplying load. The client returns an error or a fallback right away, and a circuit breaker can stop calls entirely until the service recovers.",
     "Limita los reintentos a una parte del tráfico normal, p. ej. un 10%. Cuando la mayoría de las llamadas fallan, el presupuesto se agota rápido y el cliente falla rápido en vez de multiplicar la carga. El cliente devuelve un error o una alternativa (fallback) de inmediato, y un circuit breaker puede detener las llamadas por completo hasta que el servicio se recupere.")],
];

export default defineLesson({
  title: t("Retry Storm Workbench", "Banco de trabajo: tormentas de reintentos"),
  eyebrow: t("Systems lesson 06 · Retry storms", "Lección de sistemas 06 · Tormentas de reintentos"),
  lede: t('A retry feels like the safe thing to do: if a call fails, try again. When many clients do it at once, retries can keep a system overloaded long after the original problem is gone. This lesson shows how that happens, and what actually stops it.',
    'Reintentar parece lo más seguro: si una llamada falla, vuelve a intentarlo. Cuando muchos clientes lo hacen a la vez, los reintentos pueden mantener un sistema sobrecargado mucho después de que el problema original desapareció: una tormenta de reintentos (retry storm). Esta lección muestra cómo pasa eso y qué es lo que de verdad lo detiene.'),
  machine: {
    intro: t('A ticket office with one window that can serve three clients per second. Watch it run calmly, then send a rush and see what three retries do. Change the settings below and send another rush.',
      'Una taquilla con una ventanilla que puede atender a tres clientes por segundo. Mírala funcionar con calma; luego envía una avalancha y mira lo que hacen tres reintentos. Cambia los ajustes de abajo y envía otra avalancha.'),
    plate: {
      title: t("Ticket office", "Taquilla"),
      keys: [
        { mark: "lit", label: t("A client on a retry", "Un cliente en un reintento") },
        { mark: "flat", label: t("A ticket left behind: the window still serves it", "Un boleto abandonado: la ventanilla igual lo atiende") },
        { mark: "raised", label: t("Waiting garden: distance from the line is the backoff delay", "Jardín de espera: la distancia a la fila es el retraso de la espera") },
      ],
      caption: t(
        "Regular clients come from the plaza, join the line and wait up to the timeout for one of the three windows. A client that gives up leaves its ticket in the line and, if it may retry, rejoins the line or waits in the garden first: the further along the ruler, the longer the wait. The gauge on the roof shows attempts per second; the pin marks what the window can serve, 3 per second. Send a rush to start a storm.",
        "Los clientes habituales vienen de la plaza, se forman en la fila y esperan hasta el tiempo límite a que los atienda una de las tres ventanillas. Un cliente que se rinde deja su boleto en la fila y, si puede reintentar, vuelve a formarse o antes espera en el jardín: cuanto más lejos sobre la regla, más larga la espera. El indicador del techo muestra intentos por segundo; el tope marca lo que la ventanilla puede atender, 3 por segundo. Envía una avalancha para iniciar una tormenta.",
      ),
      stage: { "data-office": "" },
      label: t("Ticket office simulation. Space pauses or resumes.", "Simulación de la taquilla. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["attempts", t("Attempts/s", "Intentos/s"), "–"], ["answered", t("Answered/s", "Respondidos/s"), "–"], ["line", t("In line", "En la fila")], ["wasted", t("Served for nobody", "Atendidos para nadie")], ["failed", t("Gave up", "Se rindieron")], ["peak", t("Peak/s", "Pico/s"), "–"]],
    controls: [
      { seg: "retries", label: t("Retries", "Reintentos"), options: [[0, t("None", "Ninguno")], [3, "3"]], value: 3 },
      { seg: "backoff", label: t("Backoff", "Espera"), options: [["none", t("None", "Ninguna")], ["exp", "2 · 4 · 8 s"]], value: "none" },
      { seg: "jitter", label: t("Jitter", "Variación"), options: [["false", t("Off", "No")], ["true", t("On", "Sí")]], value: "false" },
      { seg: "timeout", label: t("Timeout", "Tiempo límite"), options: [[0.8, "0.8 s"], [3, "3 s"], [6, "6 s"]], value: 3 },
      { seg: "layers", label: t("Layers that retry", "Capas que reintentan"), options: [[1, "1"], [3, "3"]], value: 1 },
      { seg: "budget", label: t("Retry budget", "Presupuesto de reintentos"), options: [["false", t("Off", "No")], ["true", "10%"]], value: "false" },
      { speed: true },
      { actions: [["rush", t("Send a rush", "Enviar una avalancha"), { primary: true }], ["restart", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t('Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same office, averaged over 16 two-minute runs after a rush of 16 visitors.',
    'Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen de la misma taquilla, promediados sobre 16 ejecuciones de dos minutos después de una avalancha de 16 visitantes.'), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  // Experiment results here come in titled groups of bars.
  css: `
`,
  data: {
    P,
    G: GEOMETRY,
    PAWN: pawnSvg(),
    TICKET: ticketSvg(0),
    LEDGE_TICKET: ticketSvg(GEOMETRY.LEDGE_Z),
  },
});
