// @ts-nocheck: content in the style of the other lessons
// Systems lesson 70 · Poison messages: one ordered conveyor, its worker, a retry shelf and a dead-letter cage.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one, n0 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, parcelSvg, P, GEOMETRY } from "./figure";
import { foreverRun, outageRun, budgetRun, topicRun, redriveRun, backoff, window, FAIL_SECS, OUTAGE, FOREVER, TOPIC } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each).
const R = { forever: foreverRun(), outage: outageRun(), budget: budgetRun(), topic: topicRun(), redrive: redriveRun() };

const s0 = (x) => n0(x) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const W3 = window(3), W8 = window(8);
const WAITS8 = Array.from({ length: 7 }, (_, i) => backoff(i + 1)).join(", ");
const CYCLE3 = 3 * FAIL_SECS + W3;             // seconds a message spends failing at the head with 3 attempts, outage on
const AFTER = (FOREVER.end - FOREVER.at) / 60;   // minutes the first experiment runs after the malformed message

// What each card shows after a run.
const RUNS = {
  forever: () => {
    const { forever, three } = R.forever, m = top(forever.lag), mo = top(three.others);
    return {
      verdict: t("Retry forever: " + AFTER + " minutes later " + n0(forever.lag) + " messages were waiting, the oldest for " + s0(forever.wait) + ", and " + n0(forever.others) + " messages for B, C or D had been done since. Three attempts: the malformed one went to the DLQ after " + s0(W3) + " of backoff, the line was back to " + one(three.lag) + " waiting, and " + n0(three.others) + " messages for B, C and D were done.",
        "Reintentar para siempre: " + AFTER + " minutos después había " + n0(forever.lag) + " mensajes esperando, el más antiguo desde hace " + s0(forever.wait) + ", y desde entonces se habían hecho " + n0(forever.others) + " mensajes de B, C o D. Tres intentos: el malformado se fue a la DLQ tras " + s0(W3) + " de espera, la fila volvió a " + one(three.lag) + " esperando y se hicieron " + n0(three.others) + " mensajes de B, C y D."),
      groups: [
        { title: t("Waiting in the line", "Esperando en la fila"), bars: [[t("Retry forever", "Reintentar para siempre"), forever.lag / m, n0(forever.lag), true], [t("3 attempts", "3 intentos"), three.lag / m, one(three.lag)]] },
        { title: t("Messages for B, C and D done", "Mensajes de B, C y D hechos"), bars: [[t("Retry forever", "Reintentar para siempre"), forever.others / mo, n0(forever.others), true], [t("3 attempts", "3 intentos"), three.others / mo, n0(three.others)]] },
      ],
    };
  },
  outage: () => {
    const o = R.outage, m = top(o.during);
    return {
      verdict: t(n0(o.good) + " good messages in the DLQ, of the " + n0(o.during) + " that arrived during the " + OUTAGE + " s outage; none of them was malformed. The lag peaked at " + n0(o.maxLag) + ". In " + one(o.gaps) + " cases per run, a customer's record jumped from one version to a later one because the update in between was in the cage.",
        n0(o.good) + " mensajes buenos en la DLQ, de los " + n0(o.during) + " que llegaron durante la caída de " + OUTAGE + " s; ninguno estaba malformado. El lag llegó a " + n0(o.maxLag) + ". En " + one(o.gaps) + " casos por ejecución, el registro de un cliente saltó de una versión a otra posterior porque la actualización intermedia estaba en la jaula."),
      bars: [[t("Arrived during the outage", "Llegaron durante la caída"), o.during / m, n0(o.during)], [t("Good messages in the DLQ", "Mensajes buenos en la DLQ"), o.good / m, n0(o.good), true], [t("Malformed messages in the DLQ", "Mensajes malformados en la DLQ"), o.bad / m, n0(o.bad)]],
    };
  },
  budget: () => {
    const { three, eight, split } = R.budget, mg = top(three.good), mw = top(eight.badWait);
    const rows = (key, mm, fmt) => [[t("3 attempts", "3 intentos"), three[key] / mm, fmt(three[key]), key === "good"], [t("8 attempts", "8 intentos"), eight[key] / mm, fmt(eight[key]), key === "badWait"], [t("8, malformed straight to the DLQ", "8, malformado directo a la DLQ"), split[key] / mm, fmt(split[key])]];
    return {
      verdict: t("3 attempts: " + n0(three.good) + " good messages in the DLQ; the longest wait was " + s0(three.outWait) + " around the outage and " + s0(three.badWait) + " after the malformed one. 8 attempts: no good messages in the DLQ and " + s0(eight.outWait) + " around the outage, but " + s0(eight.badWait) + " after the malformed one, with up to " + n0(eight.badLag) + " waiting behind it. 8 attempts with malformed messages sent straight to the DLQ: " + n0(split.good) + " good ones lost, " + s0(split.outWait) + " and " + s0(split.badWait) + ".",
        "3 intentos: " + n0(three.good) + " mensajes buenos en la DLQ; la espera más larga fue de " + s0(three.outWait) + " alrededor de la caída y de " + s0(three.badWait) + " después del malformado. 8 intentos: ningún mensaje bueno en la DLQ y " + s0(eight.outWait) + " alrededor de la caída, pero " + s0(eight.badWait) + " después del malformado, con hasta " + n0(eight.badLag) + " esperando detrás. 8 intentos con los malformados directo a la DLQ: " + n0(split.good) + " buenos perdidos, " + s0(split.outWait) + " y " + s0(split.badWait) + "."),
      groups: [
        { title: t("Good messages in the DLQ", "Mensajes buenos en la DLQ"), bars: rows("good", mg, n0) },
        { title: t("Longest wait after the malformed one", "Espera más larga después del malformado"), bars: rows("badWait", mw, s0) },
      ],
    };
  },
  topic: () => {
    const { inplace, topic } = R.topic, ml = top(inplace.lag), ms = top(topic.stale);
    return {
      verdict: t("Retry in place: " + n0(inplace.lag) + " waiting after 5 minutes, up from " + n0(inplace.before) + " a minute earlier, the oldest wait up to " + s0(inplace.maxWait) + ", and " + n0(inplace.stale) + " updates out of order. Retry topic: " + one(topic.lag) + " waiting, the oldest wait up to " + s0(topic.maxWait) + ", but " + n0(topic.stale) + " updates landed after a newer one for the same customer and set its record back.",
        "Reintentar en su lugar: " + n0(inplace.lag) + " esperando después de 5 minutos, frente a " + n0(inplace.before) + " un minuto antes, la espera más larga hasta " + s0(inplace.maxWait) + ", y " + n0(inplace.stale) + " actualizaciones fuera de orden. Topic de reintentos: " + one(topic.lag) + " esperando, la espera más larga hasta " + s0(topic.maxWait) + ", pero " + n0(topic.stale) + " actualizaciones llegaron después de una más nueva del mismo cliente y le hicieron retroceder el registro."),
      groups: [
        { title: t("Waiting after 5 minutes", "Esperando después de 5 minutos"), bars: [[t("Retry in place", "Reintentar en su lugar"), inplace.lag / ml, n0(inplace.lag), true], [t("Retry topic", "Topic de reintentos"), topic.lag / ml, one(topic.lag)]] },
        { title: t("Updates out of order", "Actualizaciones fuera de orden"), bars: [[t("Retry in place", "Reintentar en su lugar"), inplace.stale / ms, n0(inplace.stale)], [t("Retry topic", "Topic de reintentos"), topic.stale / ms, n0(topic.stale), true]] },
      ],
    };
  },
  redrive: () => {
    const { apply, skip } = R.redrive, m = top(apply.redriven);
    return {
      verdict: t("Applying every version: " + n0(apply.old) + " of the " + n0(apply.redriven) + " redriven updates were older than what their record already had, and 10 s after the redrive " + one(apply.behind) + " of the 4 records still showed an older version than they had held. With the version check: all " + n0(skip.skipped) + " were skipped and no record went back.",
        "Aplicando todas las versiones: " + n0(apply.old) + " de las " + n0(apply.redriven) + " actualizaciones reenviadas eran más viejas que lo que su registro ya tenía, y 10 s después del reenvío " + one(apply.behind) + " de los 4 registros seguían mostrando una versión más vieja que la que habían tenido. Con la verificación de versión: se omitieron las " + n0(skip.skipped) + " y ningún registro retrocedió."),
      bars: [[t("Redriven", "Reenviadas"), apply.redriven / m, n0(apply.redriven)], [t("Set a record back, apply every version", "Hicieron retroceder un registro, aplicar todas"), apply.stale / m, n0(apply.stale), true], [t("Set a record back, version check", "Hicieron retroceder un registro, con verificación"), skip.stale / m, n0(skip.stale)]],
    };
  },
};

const BASE = { rate: 0.6, flaky: 0, attempts: "3", mode: "inplace", parse: "retry", stale: "apply" };

const EXPERIMENTS = [
  {
    id: "forever",
    title: t("One malformed message at the head", "Un mensaje malformado en la cabeza"),
    change: t("A malformed message for customer A joins the line and fails on every attempt · max attempts: forever vs 3 · " + AFTER + " minutes later",
      "Un mensaje malformado del cliente A entra a la fila y falla en cada intento · intentos máximos: para siempre vs 3 · " + AFTER + " minutos después"),
    question: t("With retry forever, what happens to the messages of customers B, C and D?", "Si se reintenta para siempre, ¿qué pasa con los mensajes de los clientes B, C y D?"),
    options: [
      t("They keep flowing; only A's later messages wait", "Siguen fluyendo; solo esperan los siguientes de A"),
      t("They wait too: nothing behind it gets done", "También esperan: no se hace nada de lo que hay detrás"),
      t("They flow more slowly, in between A's retries", "Fluyen más lento, entre los reintentos de A"),
    ],
    answer: 1,
    why: t(
      "The worker moves on, and commits its position past the head, only once the message at the head is done with, so while it retries, nothing behind it moves, whichever customer it belongs to. Order is kept per partition, not per key: B, C and D share the line with A. The backoff doesn't help; it only spaces out failures that will never stop, while the lag grows with every arrival. In an unordered queue the same message costs one worker's time (lesson 33, Queues); here it stops the line. A limit on attempts lets the worker set it aside and move on. Retrying forever is a real default: AWS Lambda reading a Kinesis or DynamoDB stream retries a failed record until it expires, unless you set a maximum.",
      "El trabajador solo sigue, y confirma (commit) su posición más allá de la cabeza, cuando termina con el mensaje que está ahí, así que mientras lo reintenta, nada de lo que hay detrás se mueve, sea del cliente que sea. El orden se mantiene por partición, no por clave: B, C y D comparten la fila con A. La espera exponencial (backoff) no ayuda; solo espacia fallos que nunca van a parar, mientras el lag crece con cada llegada. En una cola sin orden, el mismo mensaje cuesta el tiempo de un consumidor (lección 33, Colas); aquí detiene la fila. Un límite de intentos permite apartarlo y seguir. Reintentar para siempre es un valor por defecto real: AWS Lambda leyendo un stream de Kinesis o DynamoDB reintenta un registro fallido hasta que expira, salvo que pongas un máximo.",
    ),
    watch: { ...BASE, attempts: "inf", speed: 3, script: [{ dt: 2, type: "poison", key: 0 }] },
  },
  {
    id: "outage",
    title: t("A 30-second outage", "Una caída de 30 segundos"),
    change: t("Downstream is down for " + OUTAGE + " s: every call fails, then calls work again · 3 attempts, waiting " + backoff(1) + " s and then " + backoff(2) + " s between them",
      "El destino está caído " + OUTAGE + " s: toda llamada falla y después vuelven a funcionar · 3 intentos, con esperas de " + backoff(1) + " s y luego " + backoff(2) + " s entre ellos"),
    question: t("What lands in the dead-letter queue?", "¿Qué cae en la cola de mensajes muertos?"),
    options: [
      t("Nothing: a DLQ only catches messages that can't work", "Nada: una DLQ solo atrapa mensajes que no pueden funcionar"),
      t("Only the message at the head when the outage began", "Solo el mensaje que estaba en la cabeza cuando empezó la caída"),
      t("Good messages, one after another, while it lasts", "Mensajes buenos, uno tras otro, mientras dura"),
    ],
    answer: 2,
    why: t(
      "The worker can't tell an outage from a bad message: either way it sees a failed call. With 3 attempts, each message at the head gets " + s0(W3) + " of backoff, then goes to the DLQ, and the next one starts failing. A " + OUTAGE + " s outage outlasts that window many times over, so good messages drain into the cage, about one every " + n0(CYCLE3) + " s. None of them was wrong, and while they sit there, those customers' later updates are applied without them. Size retries in time, not in count: the waits between attempts should add up to more than the outages you expect. The Amazon SQS guide says the same of maxReceiveCount: set too low, messages go to the DLQ before they've had enough retries.",
      "El trabajador no distingue una caída de un mensaje malo: en ambos casos ve una llamada que falla. Con 3 intentos, cada mensaje en la cabeza recibe " + s0(W3) + " de espera, luego va a la DLQ y el siguiente empieza a fallar. Una caída de " + OUTAGE + " s dura muchas veces esa ventana, así que los mensajes buenos se van a la jaula, cerca de uno cada " + n0(CYCLE3) + " s. Ninguno estaba mal, y mientras están ahí, las actualizaciones siguientes de esos clientes se aplican sin ellos. Dimensiona los reintentos en tiempo, no en cantidad: las esperas entre intentos deberían sumar más que las caídas que esperas. La guía de Amazon SQS dice lo mismo de maxReceiveCount: si es muy bajo, los mensajes van a la DLQ antes de tener suficientes reintentos.",
    ),
    watch: { ...BASE, speed: 3, script: [{ dt: 3, type: "outage" }] },
  },
  {
    id: "budget",
    title: t("Enough attempts to ride it out", "Intentos suficientes para aguantarla"),
    change: t("6 minutes: a " + OUTAGE + " s outage at 1 min, one malformed message at 3 min · max attempts 3 vs 8 (waits of " + WAITS8 + " s) vs 8 with malformed messages sent straight to the DLQ",
      "6 minutos: una caída de " + OUTAGE + " s al minuto 1 y un mensaje malformado al minuto 3 · intentos máximos 3 vs 8 (esperas de " + WAITS8 + " s) vs 8 con los malformados directo a la DLQ"),
    question: t("With 8 attempts, no good message reaches the DLQ. What does it cost?", "Con 8 intentos, ningún mensaje bueno llega a la DLQ. ¿Qué cuesta?"),
    options: [
      t("Nothing much: the malformed one still reaches the DLQ", "Poca cosa: el malformado igual llega a la DLQ"),
      t("The malformed one now stalls the whole line for long", "El malformado ahora detiene toda la fila por mucho tiempo"),
      t("Good messages still reach the DLQ, only later", "Los mensajes buenos igual llegan a la DLQ, solo que después"),
    ],
    answer: 1,
    why: t(
      "Eight attempts wait " + WAITS8.replace(/, /g, " + ") + " = " + W8 + " s in all, longer than the outage, so the head waits it out, nothing good is lost, and the line catches up afterwards; the cost is a little extra waiting, since the head sleeps through backoffs that end after downstream is back. But the malformed message gets the same " + W8 + " s, and the line stands still for all of it. One retry policy can't suit both kinds of failure, so tell them apart: an error that retrying can't fix (a message that won't parse, fails validation, or is refused as invalid) goes to the DLQ on the first failure, and timeouts, 503s and refused connections get the long backoff. With that split the outage costs no good messages and the malformed one about one attempt. Spring for Apache Kafka's DefaultErrorHandler, for example, doesn't retry deserialization and conversion errors by default.",
      "Ocho intentos esperan " + WAITS8.replace(/, /g, " + ") + " = " + W8 + " s en total, más que la caída, así que la cabeza la aguanta, no se pierde nada bueno y la fila se pone al día después; el costo es un poco más de espera, porque la cabeza duerme esperas que terminan después de que el destino ya volvió. Pero el mensaje malformado recibe los mismos " + W8 + " s, y la fila se queda quieta todo ese tiempo. Una sola política de reintentos no sirve para los dos tipos de fallo, así que distínguelos: un error que reintentar no arregla (un mensaje que no se puede leer, que no pasa la validación o que se rechaza por inválido) va a la DLQ al primer fallo, y los tiempos límite (timeouts), los 503 y las conexiones rechazadas reciben la espera larga. Con esa separación, la caída no cuesta mensajes buenos y el malformado cuesta cerca de un intento. El DefaultErrorHandler de Spring for Apache Kafka, por ejemplo, no reintenta por defecto los errores de deserialización y de conversión.",
    ),
    // the outage is ridden out in the warm-up (8 attempts: nothing good in the cage); the malformed one comes 6 s in
    watch: { ...BASE, attempts: "8", speed: 3, warm: 140, script: [{ dt: -114, type: "outage" }, { dt: 6, type: "poison", key: 0 }] },
  },
  {
    id: "topic",
    title: t("A retry topic", "Un topic de reintentos"),
    change: t("Downstream fails 1 call in 5 at random · " + TOPIC.rate + " arriving a second · 3 attempts · retry in place vs move a failed message to a retry topic and carry on · 5 minutes",
      "El destino falla 1 de cada 5 llamadas al azar · llegan " + TOPIC.rate + " por segundo · 3 intentos · reintentar en su lugar vs pasar el mensaje fallido a un topic de reintentos y seguir · 5 minutos"),
    question: t("What does the retry topic change?", "¿Qué cambia el topic de reintentos?"),
    options: [
      t("The line keeps up, but some updates land after newer ones", "La fila alcanza, pero algunas actualizaciones llegan después de otras más nuevas"),
      t("The line keeps up, and each customer's order still holds", "La fila alcanza, y el orden de cada cliente se mantiene"),
      t("Little: both pay the same extra work for the failures", "Poco: los dos pagan el mismo trabajo extra por los fallos"),
    ],
    answer: 0,
    why: t(
      "In place, every failure parks the whole line for its backoff, a second or more with the worker doing nothing, so with 1 call in 5 failing the line needs more time than it has and the lag keeps growing. A retry topic takes the failed message out of the line: the worker commits past it and moves on, and a separate consumer retries it after its delay. The price is order. While A's update waits on the shelf, A's next update goes through; then the retry lands on top of it and the record goes back to an older version. Use a retry topic when messages are independent. When order per key matters, retry in place, or keep the topic and make the handler refuse versions older than the record (experiment 5).",
      "En su lugar, cada fallo deja quieta toda la fila durante su espera, un segundo o más con el trabajador sin hacer nada, así que con 1 de cada 5 llamadas fallando la fila necesita más tiempo del que tiene y el lag no para de crecer. Un topic de reintentos saca el mensaje fallido de la fila: el trabajador confirma más allá de él y sigue, y otro consumidor lo reintenta después de su espera. El precio es el orden. Mientras la actualización de A espera en el estante, pasa la siguiente de A; después llega el reintento encima y el registro vuelve a una versión más vieja. Usa un topic de reintentos cuando los mensajes son independientes. Cuando importa el orden por clave, reintenta en su lugar, o mantén el topic y haz que el handler rechace versiones más viejas que la del registro (experimento 5).",
    ),
    watch: { ...BASE, rate: TOPIC.rate, flaky: TOPIC.flaky, mode: "topic", speed: 3 },
  },
  {
    id: "redrive",
    title: t("Redrive after the outage", "Reenviar después de la caída"),
    change: t("The outage of experiment 2 leaves good messages in the DLQ · downstream is back · a minute later they are redriven to the tail of the line · the handler applies every version vs skips one older than the record",
      "La caída del experimento 2 deja mensajes buenos en la DLQ · el destino volvió · un minuto después se reenvían al final de la fila · el handler aplica todas las versiones vs omite una más vieja que la del registro"),
    question: t("Applying every version, what do the redriven updates do?", "Aplicando todas las versiones, ¿qué hacen las actualizaciones reenviadas?"),
    options: [
      t("They apply cleanly: they were valid all along", "Se aplican sin problema: siempre fueron válidas"),
      t("Most set their records back to an older version", "La mayoría hace retroceder su registro a una versión vieja"),
      t("Only the first few are stale; the rest fit in", "Solo las primeras están viejas; el resto encaja"),
    ],
    answer: 1,
    why: t(
      "A redrive puts the messages at the tail, behind everything that arrived since. By then each customer has had newer updates, so each redriven one is older than its record and, written blindly, sets it back. It stays wrong until that customer's next update, which for an order that has already shipped may never come. A version check makes the replay harmless: keep the version with the record and skip an update older than it (a conditional write). That works when each message carries the whole state; if messages are increments, skipping loses them, and you have to hold that customer's later messages until the parked ones are fixed. Fix the cause before you redrive: a malformed message sent back unchanged fails again. The version should come from the producer, not a clock (lesson 61, Clocks & Last-Write-Wins).",
      "Un reenvío (redrive) pone los mensajes al final, detrás de todo lo que llegó desde entonces. Para ese momento cada cliente ya tuvo actualizaciones más nuevas, así que cada reenviada es más vieja que su registro y, escrita a ciegas, lo hace retroceder. Queda mal hasta la siguiente actualización de ese cliente, que para un pedido ya enviado puede no llegar nunca. Una verificación de versión hace inofensivo el reenvío: guarda la versión con el registro y omite una actualización más vieja (una escritura condicional). Eso sirve cuando cada mensaje lleva el estado completo; si los mensajes son incrementos, omitirlos los pierde, y tienes que retener los mensajes siguientes de ese cliente hasta que se arreglen los apartados. Arregla la causa antes de reenviar: un mensaje malformado que vuelve sin cambios falla otra vez. La versión debería venir del productor, no de un reloj (lección 61, Relojes y última escritura gana).",
    ),
    // the outage fills the cage in the warm-up; the redrive comes 6 s in, a minute after downstream is back
    watch: { ...BASE, speed: 3, warm: 100, script: [{ dt: -84, type: "outage" }, { dt: 6, type: "redrive" }] },
  },
];

const QUESTIONS = [
  [t("Why does one bad message stop a whole partition, when in a plain queue it only costs one worker?", "¿Por qué un mensaje malo detiene toda una partición, si en una cola común solo cuesta un consumidor?"),
    t("An ordered consumer keeps one position per partition (an offset) and can only move it past messages it is done with: there is no acking message 7 while message 6 is unresolved. So until the head succeeds or is deliberately set aside, everything behind it waits, whatever its key. An SQS FIFO queue blocks the same way, per message group. It shows as one partition whose lag and oldest-message age climb while its throughput drops to zero, which is why you watch them per partition, not summed.",
      "Un consumidor ordenado guarda una posición por partición (un offset) y solo puede moverla más allá de los mensajes que ya terminó: no se puede confirmar el mensaje 7 mientras el 6 sigue sin resolver. Así que hasta que la cabeza funcione o se aparte a propósito, todo lo que hay detrás espera, sea cual sea su clave. Una cola SQS FIFO se bloquea igual, por grupo de mensajes. Se ve como una partición cuyo lag y edad del mensaje más antiguo suben mientras su rendimiento cae a cero; por eso se miran por partición, no sumados.")],
  [t("How would you choose max attempts and the backoff between them?", "¿Cómo elegirías los intentos máximos y la espera entre ellos?"),
    t("In time, not in count. Decide how long a transient failure can plausibly last (a deploy, a failover, a throttling spell) and make the waits between attempts add up to more than that, growing exponentially with jitter so many consumers don't retry in step (lesson 06, Retry storms). Then bound it: in an ordered line, every second of backoff is a second the line stands still, so a very long budget only works if permanent errors never get it.",
      "En tiempo, no en cantidad. Decide cuánto puede durar razonablemente un fallo pasajero (un despliegue, un failover, una racha de limitación) y haz que las esperas entre intentos sumen más que eso, creciendo de forma exponencial con variación aleatoria (jitter) para que muchos consumidores no reintenten al mismo tiempo (lección 06, Tormentas de reintentos). Después ponle un tope: en una fila ordenada, cada segundo de espera es un segundo con la fila quieta, así que un presupuesto muy largo solo funciona si los errores permanentes nunca lo reciben.")],
  [t("Which errors should go to the DLQ at once, and which deserve retries?", "¿Qué errores deberían ir a la DLQ de inmediato y cuáles merecen reintentos?"),
    t("Straight to the DLQ: failures that will be the same next time, such as a message that won't deserialize, fails schema or business validation, or gets a 400-type answer that says the request itself is wrong. Retry with backoff: timeouts, refused connections, 503s, deadlocks, and 429s (respect Retry-After). An unknown exception sits in between: a few retries, then the DLQ. Note that a bug in your own handler is permanent until you deploy a fix, however transient it looks.",
      "Directo a la DLQ: fallos que serán iguales la próxima vez, como un mensaje que no se puede deserializar, que no pasa la validación del esquema o del negocio, o que recibe una respuesta tipo 400 que dice que la solicitud en sí está mal. Reintentar con espera: tiempos límite, conexiones rechazadas, 503, bloqueos mutuos (deadlocks) y 429 (respeta Retry-After). Una excepción desconocida queda en el medio: unos pocos reintentos y después la DLQ. Ojo: un bug en tu propio handler es permanente hasta que despliegues el arreglo, por pasajero que parezca.")],
  [t("A retry topic keeps the line moving. When is it the wrong choice, and what are the alternatives?", "Un topic de reintentos mantiene la fila en movimiento. ¿Cuándo es la opción equivocada y qué alternativas hay?"),
    t("When per-key order carries meaning: account balances from deltas, state machines (created, paid, shipped), edits that build on each other. A retried message lands after its key's later ones. Alternatives: retry in place with a bounded budget and accept the stall; keep the retry topic but have the handler reject versions older than the record; or, when a key has a message parked, divert that key's later messages too, so they keep their order without blocking other keys. Retries also redeliver, so the handler must be idempotent either way (lesson 69, Delivery Guarantees).",
      "Cuando el orden por clave tiene significado: saldos de cuenta a partir de deltas, máquinas de estado (creado, pagado, enviado), ediciones que se construyen unas sobre otras. Un mensaje reintentado llega después de los siguientes de su clave. Alternativas: reintentar en su lugar con un presupuesto acotado y aceptar la pausa; mantener el topic de reintentos pero hacer que el handler rechace versiones más viejas que la del registro; o, cuando una clave tiene un mensaje apartado, desviar también los siguientes de esa clave, para que mantengan su orden sin bloquear a las demás claves. Los reintentos además reentregan, así que el handler tiene que ser idempotente en cualquier caso (lección 69, Garantías de entrega).")],
  [t("The DLQ has 4,000 messages after an outage. How do you redrive them safely?", "La DLQ tiene 4,000 mensajes después de una caída. ¿Cómo los reenvías de forma segura?"),
    t("First confirm the cause is gone and sample the messages: an outage leaves good messages, a bug leaves a pattern. Then redrive at a limited rate, so 4,000 messages don't hit a service that has just recovered all at once. The handler must tolerate what the replay brings: repeats of work that partly succeeded (idempotency, lesson 25, Idempotency keys) and updates older than the current state (version checks). Watch the DLQ while it runs: anything that comes straight back has a different cause.",
      "Primero confirma que la causa ya no está y revisa una muestra de los mensajes: una caída deja mensajes buenos, un bug deja un patrón. Después reenvía a una tasa limitada, para que 4,000 mensajes no le lleguen de golpe a un servicio que se acaba de recuperar. El handler tiene que tolerar lo que trae el reenvío: repeticiones de trabajo que se hizo a medias (idempotencia, lección 25, Claves de idempotencia) y actualizaciones más viejas que el estado actual (verificación de versión). Mira la DLQ mientras corre: lo que vuelve enseguida tiene otra causa.")],
  [t("What would you alert on for a consumer with a DLQ?", "¿Sobre qué pondrías alertas en un consumidor con DLQ?"),
    t("Messages arriving in the DLQ (any, for a flow where none are expected), and their rate: a trickle of the same error points to poison messages, a burst points to an outage that outlasted the retries. Per-partition lag and the age of the oldest unprocessed message: lag can look fine summed over partitions while one is stuck. The retry rate, which climbs before either of the others. And the DLQ's age, so messages don't sit there until retention deletes them.",
      "Los mensajes que llegan a la DLQ (cualquiera, en un flujo donde no se esperan) y su tasa: un goteo del mismo error apunta a mensajes envenenados, una ráfaga apunta a una caída que duró más que los reintentos. El lag por partición y la edad del mensaje sin procesar más antiguo: el lag puede verse bien sumado entre particiones mientras una está trabada. La tasa de reintentos, que sube antes que las otras dos. Y la antigüedad de la DLQ, para que los mensajes no se queden ahí hasta que la retención los borre.")],
];

export default defineLesson({
  title: t("Poison Message Workbench", "Banco de trabajo: mensajes envenenados"),
  eyebrow: t("Systems lesson 70 · Poison messages", "Lección de sistemas 70 · Mensajes envenenados"),
  lede: t("A poison message fails every time it is processed. In a line that must stay in order, retrying it in place stops everything behind it, and giving up too soon sends good messages, caught by a passing outage, to the dead-letter queue. This lesson runs one ordered conveyor with a worker, a retry shelf and a dead-letter cage: watch it, predict what breaks it, then explain it back.",
    "Un mensaje envenenado (poison message) falla cada vez que se procesa. En una fila que tiene que mantener el orden, reintentarlo en su lugar detiene todo lo que tiene detrás, y rendirse demasiado pronto manda a la cola de mensajes muertos (dead-letter queue, DLQ) mensajes buenos que solo pasaron por una caída. Esta lección usa una sola cinta ordenada con un trabajador, un estante de reintentos y una jaula de mensajes muertos: mírala, predice qué la rompe y después explícala."),
  machine: {
    intro: t("Parcels are messages on one partition. Each carries a customer letter and that customer's version number, and the worker must be done with the parcel at the head before it may take the next. Every parcel is a call to downstream, the records ledger at the front. Send a malformed parcel or cause an outage, then try the attempts limit, the retry topic, the rule for malformed messages and the version check; redrive the cage once downstream is back.",
      "Los paquetes son mensajes de una sola partición. Cada uno lleva una letra de cliente y el número de versión de ese cliente, y el trabajador tiene que terminar con el paquete de la cabeza antes de tomar el siguiente. Cada paquete es una llamada al destino (downstream), el libro de registros del frente. Envía un paquete malformado o provoca una caída, y después prueba el límite de intentos, el topic de reintentos, la regla para los malformados y la verificación de versión; reenvía la jaula cuando el destino vuelva."),
    plate: {
      title: t("Sorting room", "Sala de clasificación"),
      keys: [
        { mark: "lit", label: t("What went wrong: DOWN on the status board; the cage's pennant when a parcel lands in it; a record's tab when it goes back to an older version", "Lo que salió mal: CAÍDO en el tablero; el banderín de la jaula cuando cae un paquete en ella; la pestaña de un registro cuando vuelve a una versión más vieja") },
        { mark: "raised", label: t("Parcels: version on top, customer in front, attempts on a tag once one has failed; a crossed band marks a malformed one", "Paquetes: versión arriba, cliente al frente, intentos en una etiqueta si ya falló; una banda cruzada marca uno malformado") },
        { mark: "flat", label: t("The conveyor, one partition: the tail at the dock, the head at the worker's desk", "La cinta, una partición: el final en el muelle, la cabeza en el escritorio del trabajador") },
      ],
      caption: t(
        "Times are illustrative and round, slowed down to watch: a parcel takes about 1 s to work, a failed call comes back in " + FAIL_SECS + " s, and the wait after a failure starts at " + backoff(1) + " s and doubles up to " + backoff(9) + " s. Retrying in place, a failed parcel stays on the desk while the BACKOFF meter runs down, and nothing behind it moves. With a retry topic it goes onto the shelf over a timer and the line moves on; the retry worker takes it when the timer runs out. A parcel out of attempts drops into the dead-letter cage. Each ledger drawer shows the version its record holds; its tab lights when an older version lands after a newer one. A tag at the conveyor's tail counts parcels that don't fit. Counters: LAG (parcels not yet done with), OLDEST WAIT in seconds, DEAD LETTERS, DONE and OUT OF ORDER.",
        "Los tiempos son ilustrativos y redondos, en cámara lenta para poder verlos: un paquete tarda cerca de 1 s en procesarse, una llamada fallida vuelve en " + FAIL_SECS + " s, y la espera después de un fallo empieza en " + backoff(1) + " s y se duplica hasta " + backoff(9) + " s. Reintentando en su lugar, un paquete fallido se queda en el escritorio mientras baja el medidor BACKOFF, y nada de lo que hay detrás se mueve. Con un topic de reintentos pasa al estante sobre un temporizador y la fila sigue; el trabajador de reintentos lo toma cuando vence el temporizador. Un paquete sin intentos cae en la jaula de mensajes muertos. Cada cajón del libro muestra la versión que guarda su registro; su pestaña se enciende cuando una versión más vieja llega después de una más nueva. Una etiqueta al final de la cinta cuenta los paquetes que no caben. Contadores: LAG (paquetes todavía sin terminar), ESPERA MÁS LARGA en segundos, MENSAJES MUERTOS, HECHOS y FUERA DE ORDEN.",
      ),
      stage: { "data-sorting-room": "" },
      label: t("Poison message simulation. Space pauses or resumes.", "Simulación de mensajes envenenados. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["lag", t("Lag", "Lag")],
      ["oldest", t("Oldest wait", "Espera más larga"), "0 s"],
      ["done", t("Done", "Hechos")],
      ["retries", t("Retries", "Reintentos")],
      ["dead", t("Dead letters", "Mensajes muertos")],
      ["stale", t("Out of order", "Fuera de orden")],
    ],
    controls: [
      { seg: "rate", label: t("Arrivals", "Llegadas"), options: [[0.4, "0.4/s"], [0.6, "0.6/s"], [0.8, "0.8/s"]], value: 0.6 },
      { seg: "flaky", label: t("Downstream", "Destino"), options: [[0, t("Healthy", "Sano")], [0.1, t("1 call in 10 fails", "Falla 1 de cada 10")], [0.2, t("1 in 5 fails", "Falla 1 de cada 5")]], value: 0.1 },
      { seg: "attempts", label: t("Max attempts", "Intentos máximos"), options: [["3", "3"], ["8", "8"], ["inf", t("Forever", "Para siempre")]], value: "3" },
      { seg: "mode", label: t("Retry", "Reintento"), options: [["inplace", t("In place", "En su lugar")], ["topic", t("Retry topic", "Topic de reintentos")]], value: "inplace" },
      { seg: "parse", label: t("Malformed", "Malformados"), options: [["retry", t("Retry like any error", "Reintentar como cualquier error")], ["dlq", t("Straight to the DLQ", "Directo a la DLQ")]], value: "retry" },
      { seg: "stale", label: t("Older version", "Versión más vieja"), options: [["apply", t("Apply it", "Aplicarla")], ["skip", t("Skip it", "Omitirla")]], value: "apply" },
      { speed: true },
      { actions: [["poison", t("Send a malformed one", "Enviar uno malformado"), { primary: true }], ["outage", t("Outage, " + OUTAGE + " s", "Caída de " + OUTAGE + " s")], ["redrive", t("Redrive the cage", "Reenviar la jaula")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. A malformed parcel fails on every attempt, so redriving one without fixing it sends it straight back round.",
      "Cambiar un ajuste reinicia la ejecución. Un paquete malformado falla en cada intento, así que reenviarlo sin arreglarlo lo hace dar la vuelta otra vez."),
  },
  predict: {
    intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.",
      "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  css: `
.iso-stage [data-layer] text{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: { P, G: GEOMETRY, PARCEL_SVG: parcelSvg() },
});
