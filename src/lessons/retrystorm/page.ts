// @ts-nocheck: content ported as-is
// Systems lesson 06 · Retry storms: a ticket office with three windows.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct } from "../../lib/format";
import { buildFigure, P, GEOMETRY, pawnSvg, standSvg, ticketSvg } from "./figure";
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
        "La ola más alta bajó de " + perSec(a.peak) + " a " + perSec(b.peak) + " (" + Math.round(100 * (1 - b.peak / a.peak)) + "% menos). La tormenta duró " + stormEs(a) + " sin variación aleatoria y " + stormEs(b) + " con ella."),
      groups: [[t("Tallest wave", "Ola más alta"), [[t("Backoff", "Espera"), a.peak / 20, perSec(a.peak)], [t("Backoff + jitter", "Espera + variación"), b.peak / 20, perSec(b.peak), true]]],
        [t("Trouble lasted", "El problema duró"), [[t("Backoff", "Espera"), stormShare(a), stormT(a)], [t("Backoff + jitter", "Espera + variación"), stormShare(b), stormT(b), true]]]] };
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
    const top = Math.max(a.peak10, b.peak10, a.lateLoad, b.lateLoad, 3) * 1.1;
    return { verdict: t("Peak load on the windows (busiest 10 s): " + perSec(a.peak10) + " with one layer retrying, " + perSec(b.peak10) + " with three, against a capacity of 3/s. A minute after the rush, one layer was down to " + perSec(a.lateLoad) + "; three layers were still at " + perSec(b.lateLoad) + ". Attempts per request: " + a.attemptsPerRequest.toFixed(1) + " and " + b.attemptsPerRequest.toFixed(1) + ". Three layers with a 10% retry budget peaked at " + perSec(c.peak10) + " and ended the trouble in " + storm(c) + ".",
        "Carga pico en las ventanillas (los 10 s de más trabajo): " + perSec(a.peak10) + " con una capa reintentando, " + perSec(b.peak10) + " con tres, frente a una capacidad de 3/s. Un minuto después de la avalancha, una capa había bajado a " + perSec(a.lateLoad) + "; tres capas seguían en " + perSec(b.lateLoad) + ". Intentos por solicitud: " + a.attemptsPerRequest.toFixed(1) + " y " + b.attemptsPerRequest.toFixed(1) + ". Tres capas con un presupuesto de reintentos del 10% llegaron a un pico de " + perSec(c.peak10) + " y terminaron el problema en " + stormEs(c) + "."),
      groups: [[t("Peak load (busiest 10 s)", "Carga pico (10 s de más trabajo)"), [[t("1 layer", "1 capa"), a.peak10 / top, perSec(a.peak10)], [t("3 layers", "3 capas"), b.peak10 / top, perSec(b.peak10), true], [t("3 layers + budget", "3 capas + presupuesto"), c.peak10 / top, perSec(c.peak10)]]],
        [t("Load a minute after the rush", "Carga un minuto después de la avalancha"), [[t("1 layer", "1 capa"), a.lateLoad / top, perSec(a.lateLoad)], [t("3 layers", "3 capas"), b.lateLoad / top, perSec(b.lateLoad), true], [t("3 layers + budget", "3 capas + presupuesto"), c.lateLoad / top, perSec(c.lateLoad)]]]] };
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
      t("About the same: retries only help unlucky clients", "Más o menos lo mismo: solo ayudan a los clientes con mala suerte"),
      t("Twice as long or so, then it settles", "Más o menos el doble, y luego se calma"),
      t("It may not end on its own at all", "Puede que no termine solo nunca"),
    ],
    answer: 2,
    why: t(
      "Every client that times out leaves its ticket in the line, and the window still serves it for nobody. Then the client queues again, and again. The line gets longer, so more clients time out, so more tickets are added: up to four per request. The window spends its time on abandoned tickets, and the rush is self-sustaining even after every visitor has left: the office stays fully busy while almost nothing reaches a waiting client (lesson 47, Load shedding & backpressure, calls that useful share goodput).",
      "Cada cliente que agota su tiempo límite deja su boleto en la fila, y la ventanilla igual lo atiende, para nadie. Luego el cliente se vuelve a formar, y otra vez. La fila crece, así que más clientes agotan su tiempo, así que se agregan más boletos: hasta cuatro por solicitud. La ventanilla gasta su tiempo en boletos abandonados, y la avalancha se sostiene sola aunque todos los visitantes ya se hayan ido: la taquilla sigue ocupada al máximo mientras casi nada le llega a un cliente que espera (la lección 47, Descarte de carga y contrapresión, llama goodput a esa parte útil).",
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
      t("It ends, but retries return in tall waves", "Termina, pero los reintentos vuelven en olas altas"),
      t("It ends about as fast as with no retries", "Termina casi tan rápido como sin reintentos"),
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
    title: t("Add jitter", "Agregar variación aleatoria"),
    change: t(
      "Exponential backoff → backoff with jitter · each wait spread between ½ and 1½ times its delay",
      "Espera exponencial → espera con variación aleatoria (jitter) · cada espera se reparte entre ½ y 1½ veces su retraso",
    ),
    question: t("The average wait is exactly the same as before. What does jitter change?", "La espera promedio es exactamente la misma que antes. ¿Qué cambia la variación aleatoria?"),
    options: [
      t("The storm ends much sooner than before", "La tormenta termina mucho más pronto"),
      t("The waves flatten; the storm lasts as long", "Las olas se aplanan; la tormenta dura lo mismo"),
      t("Nothing: the average wait is the same", "Nada: la espera promedio es la misma"),
    ],
    answer: 1,
    why: t(
      "Jitter breaks up the clump: clients that failed together now return at different moments, so the window sees a trickle instead of a wave, and the tallest spike is far lower. Here the storm lasted about as long: the same clients still had to get through a full line. In real systems, fewer collisions also mean fewer failed attempts, so jitter often cuts the total number of retries too. Jitter protects against spikes; budgets and breakers cap the work; backoff buys the server time.",
      "La variación aleatoria deshace el montón: los clientes que fallaron juntos ahora vuelven en momentos distintos, así que la ventanilla ve un goteo en lugar de una ola, y el pico más alto es mucho menor. Aquí la tormenta duró más o menos lo mismo: los mismos clientes igual tenían que pasar por una fila llena. En sistemas reales, menos choques también significan menos intentos fallidos, así que la variación aleatoria suele reducir también el total de reintentos. La variación aleatoria protege contra los picos; los presupuestos y los interruptores limitan el trabajo; la espera le da tiempo al servidor.",
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
      t("About half: the fast half still gets through", "Más o menos la mitad: la mitad rápida pasa"),
      t("Almost none: clients give up before it's done", "Casi nada: los clientes se rinden antes de que termine"),
    ],
    answer: 2,
    why: t(
      "Most requests take longer than 0.8 s even with an empty line, so the client gives up while the window is still working on it, then sends another. The window finishes every ticket anyway. Load more than triples and almost nothing useful comes out. A timeout must sit above the normal, slow-end latency of what you call, not at its average.",
      "La mayoría de las solicitudes tardan más de 0.8 s aun con la fila vacía, así que el cliente se rinde mientras la ventanilla todavía trabaja en ella, y luego envía otra. La ventanilla termina cada boleto de todos modos. La carga se multiplica por más de tres y casi nada útil sale. Un tiempo límite debe quedar por encima de la latencia normal del extremo lento de lo que llamas, no en su promedio.",
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
    question: t("A request can now make up to 64 attempts instead of 4. How does the peak load on the windows compare with one layer retrying?", "Una solicitud ahora puede hacer hasta 64 intentos en lugar de 4. ¿Cómo se compara la carga pico en las ventanillas con la de una sola capa reintentando?"),
    options: [
      t("Up to 16 times higher, like the attempts", "Hasta 16 veces más alta, como los intentos"),
      t("Somewhat higher, and it stays up for minutes", "Algo más alta, y se queda arriba por minutos"),
      t("About 3 times higher: one wave per layer", "Unas 3 veces más alta: una ola por capa"),
    ],
    answer: 1,
    why: t(
      "Retries multiply, they don't add: each layer makes up to 4 attempts, and each of those runs the 4 attempts of the layer below, so 4 × 4 × 4 = 64 per request. But each client still has only one attempt in line at a time, and here every failed attempt costs a full 3 s timeout, so the rate is capped by how many clients there are. What the layers multiply is how long each client keeps trying: 64 attempts take minutes, so the load stays far above capacity instead of fading. If the service failed fast instead of timing out, those attempts would arrive seconds apart and the peak would multiply too. Retry at one layer only, usually the one nearest the user, and give it a budget: here retries may be at most about 10% of new requests, so once the windows struggle, clients fail fast instead of piling on.",
      "Los reintentos se multiplican, no se suman: cada capa hace hasta 4 intentos, y cada uno de ellos ejecuta los 4 intentos de la capa de abajo, así que 4 × 4 × 4 = 64 por solicitud. Pero cada cliente sigue teniendo un solo intento en la fila a la vez, y aquí cada intento fallido cuesta 3 s completos de tiempo límite, así que el ritmo lo limita cuántos clientes hay. Lo que multiplican las capas es cuánto tiempo sigue intentando cada cliente: 64 intentos toman minutos, así que la carga se queda muy por encima de la capacidad en lugar de bajar. Si el servicio fallara rápido en lugar de agotar el tiempo límite, esos intentos llegarían con segundos de diferencia y el pico también se multiplicaría. Reintenta en una sola capa, normalmente la más cercana al usuario, y dale un presupuesto (retry budget): aquí los reintentos pueden ser como máximo un 10% de las solicitudes nuevas, así que cuando las ventanillas no dan abasto, los clientes fallan rápido en vez de amontonarse.",
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
   t("In the office, clients on a bench are not sending anything, so backoff lowers the load. When new requests keep arriving regardless, backoff only delays retries: every failed request still sends all its attempts eventually, so the total load can stay above capacity. That's why retry budgets and circuit breakers (lesson 04, Circuit breakers), which cap the number of retries, are needed on top.",
     "En la taquilla, los clientes en una banca no envían nada, así que la espera baja la carga. Cuando las solicitudes nuevas siguen llegando de todos modos, la espera solo retrasa los reintentos: cada solicitud fallida igual envía todos sus intentos tarde o temprano, así que la carga total puede quedar por encima de la capacidad. Por eso hacen falta además presupuestos de reintentos e interruptores de circuito (circuit breakers, lección 04), que limitan cuántos reintentos hay.")],
  [t("If jitter doesn't change the average wait, why does it matter?",
     "Si la variación aleatoria no cambia la espera promedio, ¿por qué importa?"),
   t("Clients that failed at the same moment retry at the same moment. Those waves hit the server as spikes, which make queues long right then and cause more timeouts. Jitter spreads them out so the server sees a steady trickle. Its main job is cutting peaks, and since fewer attempts collide, fewer fail, so it often cuts the total number of retries too.",
     "Los clientes que fallaron en el mismo momento reintentan en el mismo momento. Esas olas golpean al servidor como picos, que alargan las colas justo entonces y hacen que más clientes agoten su tiempo límite. La variación aleatoria las reparte para que el servidor vea un goteo constante. Su trabajo principal es bajar los picos, y como chocan menos intentos, fallan menos, así que suele reducir también el total de reintentos.")],
  [t("How would you choose a client timeout for a call that normally takes 50–200 ms?",
     "¿Cómo elegirías el tiempo límite del cliente para una llamada que normalmente tarda 50–200 ms?"),
   t("Above the slow end of normal latency (the p99 or so), not the average, with some room: maybe 500 ms to 1 s. Pair it with a deadline the server can see (lesson 46, Timeouts & deadlines), so it can drop work for clients that have already given up instead of finishing it.",
     "Por encima del extremo lento de la latencia normal (más o menos el p99), no del promedio, con algo de margen: quizá de 500 ms a 1 s. Acompáñalo con un plazo (deadline) que el servidor pueda ver (lección 46, Timeouts y plazos), para que descarte el trabajo de clientes que ya se rindieron en vez de terminarlo.")],
  [t("A request goes app → client library → proxy → service, and each retries 3 times. What would you change?",
     "Una solicitud va app → biblioteca cliente → proxy → servicio, y cada uno reintenta 3 veces. ¿Qué cambiarías?"),
   t("Retry in one place only, usually the outermost layer that knows whether retrying is safe and useful, and make the others fail fast. Worst case is 4 × 4 × 4 = 64 attempts otherwise. Add a retry budget so retries stop when the error rate is high.",
     "Reintentar en un solo lugar, normalmente la capa más externa que sabe si reintentar es seguro y útil, y hacer que las demás fallen rápido. Si no, el peor caso es 4 × 4 × 4 = 64 intentos. Agrega un presupuesto de reintentos para que se detengan cuando la tasa de errores es alta.")],
  [t("What does a retry budget do, and what should the client do when it's empty?",
     "¿Qué hace un presupuesto de reintentos (retry budget) y qué debe hacer el cliente cuando se agota?"),
   t("It caps retries at a share of normal traffic, e.g. 10%. When most calls fail, the budget runs out quickly and the client fails fast instead of multiplying load. The client returns an error or a fallback right away, and a circuit breaker can stop calls entirely until the service recovers (lesson 04).",
     "Limita los reintentos a una parte del tráfico normal, p. ej. un 10%. Cuando la mayoría de las llamadas fallan, el presupuesto se agota rápido y el cliente falla rápido en vez de multiplicar la carga. El cliente devuelve un error o una alternativa (fallback) de inmediato, y un interruptor puede detener las llamadas por completo hasta que el servicio se recupere (lección 04).")],
];

export default defineLesson({
  title: t("Retry Storm Workbench", "Banco de trabajo: tormentas de reintentos"),
  eyebrow: t("Systems lesson 06 · Retry storms", "Lección de sistemas 06 · Tormentas de reintentos"),
  lede: t('A retry feels like the safe thing to do: if a call fails, try again. When many clients do it at once, retries can keep a system overloaded long after the original problem is gone. This lesson shows how that happens, and what actually stops it.',
    'Reintentar parece lo más seguro: si una llamada falla, vuelve a intentarlo. Cuando muchos clientes lo hacen a la vez, los reintentos pueden mantener un sistema sobrecargado mucho después de que el problema original desapareció: una tormenta de reintentos (retry storm). Esta lección muestra cómo pasa eso y qué es lo que de verdad lo detiene.'),
  machine: {
    intro: t('A ticket office with three windows that together serve three clients per second. Watch it run calmly, then send a rush and see what three retries do. Change the settings below and send another rush.',
      'Una taquilla con tres ventanillas que juntas atienden a tres clientes por segundo. Mírala funcionar con calma; luego envía una avalancha y mira lo que hacen tres reintentos. Cambia los ajustes de abajo y envía otra avalancha.'),
    plate: {
      title: t("Ticket office", "Taquilla"),
      keys: [
        { mark: "lit", label: t("A client on a retry", "Un cliente en un reintento") },
        { mark: "flat", label: t("A ticket left behind: the window still serves it", "Un boleto abandonado: la ventanilla igual lo atiende") },
        { mark: "raised", label: t("Waiting garden: distance from the line is the backoff delay", "Jardín de espera: la distancia a la fila es el retraso de la espera") },
      ],
      caption: t(
        "Regular clients come from the plaza, join the line and wait up to the timeout for one of the three windows. Past the first ten in line, a waiting client is drawn as just its pawn's base, so the line and its tickets stay readable. A client that gives up leaves its ticket in the line and, if it may retry, rejoins the line or waits in the garden first: the further along the ruler, the longer the wait. The gauge on the roof shows attempts per second; the pin marks what the windows can serve, 3 per second. Send a rush to start a storm.",
        "Los clientes habituales vienen de la plaza, se forman en la fila y esperan hasta el tiempo límite (timeout) a que los atienda una de las tres ventanillas. Después de los diez primeros de la fila, un cliente que espera se dibuja solo con la base de su peón, para que la fila y sus boletos se puedan leer. Un cliente que se rinde deja su boleto en la fila y, si puede reintentar, vuelve a formarse o antes espera en el jardín: cuanto más lejos sobre la regla, más larga la espera. El indicador del techo muestra intentos por segundo; el tope marca lo que las ventanillas pueden atender, 3 por segundo. Envía una avalancha para iniciar una tormenta.",
      ),
      stage: { "data-office": "" },
      label: t("Ticket office simulation. Space pauses or resumes.", "Simulación de la taquilla. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["attempts", t("Attempts/s", "Intentos/s"), "–"], ["answered", t("Answered/s", "Respondidos/s"), "–"], ["line", t("In line", "En la fila")], ["wasted", t("Served for nobody", "Atendidos para nadie")], ["failed", t("Gave up", "Se rindieron")], ["peak", t("Peak/s", "Pico/s"), "–"]],
    controls: [
      { seg: "retries", label: t("Retries", "Reintentos"), options: [[0, t("None", "Ninguno")], [3, "3"]], value: 3 },
      { seg: "backoff", label: t("Backoff", "Espera"), options: [["none", t("None", "Ninguna")], ["exp", "2 · 4 · 8 s"]], value: "none" },
      { seg: "jitter", label: t("Jitter", "Variación aleatoria"), options: [["false", t("Off", "No")], ["true", t("On", "Sí")]], value: "false" },
      { seg: "timeout", label: t("Timeout", "Tiempo límite"), options: [[0.8, "0.8 s"], [3, "3 s"], [6, "6 s"]], value: 3 },
      { seg: "layers", label: t("Layers that retry", "Capas que reintentan"), options: [[1, "1"], [3, "3"]], value: 1 },
      { seg: "budget", label: t("Retry budget", "Presupuesto de reintentos"), options: [["false", t("Off", "No")], ["true", "10%"]], value: "false" },
      { speed: true },
      { actions: [["rush", t("Send a rush", "Enviar una avalancha"), { primary: true }], ["restart", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t('Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same office, averaged over 16 two-minute runs after a rush of 16 visitors (experiment 4 has no rush: it isolates the timeout).',
    'Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen de la misma taquilla, promediados sobre 16 ejecuciones de dos minutos después de una avalancha de 16 visitantes (el experimento 4 no tiene avalancha: aísla el tiempo límite).'), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  data: {
    P,
    G: GEOMETRY,
    PAWN: pawnSvg(),
    STAND: standSvg(),
    TICKET: ticketSvg(0),
    LEDGE_TICKET: ticketSvg(GEOMETRY.LEDGE_Z),
  },
});
