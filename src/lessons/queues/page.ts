// @ts-nocheck: content ported as-is
// Systems lesson 33 · Queues: a parcel office as a work queue.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one, n0 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, parcelSvg, P, GEOMETRY } from "./figure";
import { overload, burstRun, crashRun, poisonRun, holRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs (8 seeds each).
const RESULTS = { overload: overload(), burst: burstRun(), crash: crashRun(), poison: poisonRun(), hol: holRun() };

// What each card shows after a run.
const RUNS = {
  overload: () => {
    const { under, over } = RESULTS.overload, top = Math.max(over.len, 1);
    return { verdict: t("At 8/s: " + one(under.len) + " waiting after 5 minutes, the oldest for " + one(under.wait) + " s. At 10/s: " + n0(over.len) + " waiting, the oldest for " + n0(over.wait) + " s, and still growing by about one a second.",
        "A 8/s: " + one(under.len) + " esperando después de 5 minutos, el más antiguo desde hace " + one(under.wait) + " s. A 10/s: " + n0(over.len) + " esperando, el más antiguo desde hace " + n0(over.wait) + " s, y sigue creciendo cerca de uno por segundo."),
      bars: [[t("Waiting at 8/s", "Esperando a 8/s"), under.len / top, one(under.len)], [t("Waiting at 10/s", "Esperando a 10/s"), over.len / top, n0(over.len), true], [t("Oldest wait at 10/s (of 60 s)", "Espera más larga a 10/s (de 60 s)"), Math.min(1, over.wait / 60), n0(over.wait) + " s", true]] };
  },
  burst: () => {
    const { queued, none } = RESULTS.burst;
    return { verdict: t("With the queue: the line peaked at " + n0(queued.peak) + ", drained in " + n0(queued.drained) + " s, the longest wait was " + n0(queued.maxWait) + " s and nothing was turned away. With nowhere to wait: " + n0(none.rejected) + " of the 200 were turned away.",
        "Con la cola: la fila llegó a " + n0(queued.peak) + ", se vació en " + n0(queued.drained) + " s, la espera más larga fue de " + n0(queued.maxWait) + " s y no se rechazó nada. Sin lugar para esperar: se rechazaron " + n0(none.rejected) + " de los 200."),
      bars: [[t("Turned away, with a queue", "Rechazados, con cola"), queued.rejected / 200, n0(queued.rejected)], [t("Turned away, nowhere to wait", "Rechazados, sin lugar para esperar"), none.rejected / 200, n0(none.rejected), true], [t("Time to drain the burst (of 60 s)", "Tiempo en vaciar la ráfaga (de 60 s)"), Math.min(1, queued.drained / 60), n0(queued.drained) + " s"]] };
  },
  crash: () => {
    const { after, first, idem } = RESULTS.crash, top = Math.max(after.harmful, first.lost, 1);
    return { verdict: t("Stamp after the work: 0 lost, " + one(after.harmful) + " parcels done twice in 5 minutes. Stamp on pickup: 0 done twice, " + one(first.lost) + " lost. Stamp after, idempotent handler: " + one(idem.twice) + " repeats arrived and did no harm; nothing lost.",
        "Sello después del trabajo: 0 perdidos, " + one(after.harmful) + " paquetes hechos dos veces en 5 minutos. Sello al recoger: 0 hechos dos veces, " + one(first.lost) + " perdidos. Sello después con handler idempotente: llegaron " + one(idem.twice) + " repeticiones y no hicieron daño; nada perdido."),
      bars: [[t("Done twice, stamp after", "Hechos dos veces, sello después"), after.harmful / top, one(after.harmful), true], [t("Lost, stamp on pickup", "Perdidos, sello al recoger"), first.lost / top, one(first.lost), true], [t("Harm, stamp after + idempotent", "Daño, sello después + idempotente"), idem.harmful / top, one(idem.harmful)]] };
  },
  poison: () => {
    const { forever, dlq } = RESULTS.poison, top = Math.max(forever.poisonTries, 1);
    return { verdict: t("Retry forever: " + n0(forever.poisonTries) + " tries spent on bad parcels, " + n0(forever.len) + " parcels waiting at 5 minutes, the oldest for " + n0(forever.wait) + " s. Three tries then the cage: " + n0(dlq.poisonTries) + " tries, " + one(dlq.dead) + " parcels in the cage, " + one(dlq.len) + " waiting.",
        "Reintentar para siempre: " + n0(forever.poisonTries) + " intentos gastados en paquetes malos, " + n0(forever.len) + " paquetes esperando a los 5 minutos, el más antiguo desde hace " + n0(forever.wait) + " s. Tres intentos y a la jaula: " + n0(dlq.poisonTries) + " intentos, " + one(dlq.dead) + " paquetes en la jaula, " + one(dlq.len) + " esperando."),
      bars: [[t("Tries on bad parcels, forever", "Intentos en malos, para siempre"), forever.poisonTries / top, n0(forever.poisonTries), true], [t("Tries on bad parcels, 3 then cage", "Intentos en malos, 3 y jaula"), dlq.poisonTries / top, n0(dlq.poisonTries)], [t("Waiting at 5 min, forever (of 100)", "Esperando a los 5 min, para siempre (de 100)"), Math.min(1, forever.len / 100), n0(forever.len), true], [t("Waiting at 5 min, 3 then cage", "Esperando a los 5 min, 3 y jaula"), Math.min(1, dlq.len / 100), one(dlq.len)]] };
  },
  hol: () => {
    const { strict, key } = RESULTS.hol, top = 32;
    return { verdict: t("One order for everything: B, C and D waited up to " + one(strict.others) + " s and the line peaked at " + n0(strict.peak) + ". One order per customer: B, C and D waited at most " + one(key.others) + " s; A waited up to " + one(key.same) + " s behind its own slow parcel.",
        "Un solo orden para todo: B, C y D esperaron hasta " + one(strict.others) + " s y la fila llegó a " + n0(strict.peak) + ". Un orden por cliente: B, C y D esperaron como mucho " + one(key.others) + " s; A esperó hasta " + one(key.same) + " s detrás de su propio paquete lento."),
      bars: [[t("B, C, D wait, one order", "Espera de B, C, D, un orden"), Math.min(1, strict.others / top), one(strict.others) + " s", true], [t("B, C, D wait, per customer", "Espera de B, C, D, por cliente"), Math.min(1, key.others / top), one(key.others) + " s"], [t("A waits, per customer", "Espera de A, por cliente"), Math.min(1, key.same / top), one(key.same) + " s"]] };
  },
};

const EXPERIMENTS = [
  {
    id: "overload",
    title: t("Slightly more than the clerks can do", "Un poco más de lo que los empleados alcanzan"),
    change: t("Arrivals 8/s → 10/s · three clerks can do 9 a second between them · run for 5 minutes", "Llegadas 8/s → 10/s · entre los tres empleados procesan 9 por segundo · 5 minutos de ejecución"),
    question: t("After 5 minutes at 10 a second, what does the queue look like?", "Después de 5 minutos a 10 por segundo, ¿cómo se ve la cola?"),
    options: [
      t("About the same as at 8/s: a handful waiting", "Más o menos igual que a 8/s: unos pocos esperando"),
      t("Longer, but it levels off at a few dozen", "Más larga, pero se estabiliza en unas decenas"),
      t("It never levels off: about 300 waiting, and the newest parcel waits about half a minute", "Nunca se estabiliza: unos 300 esperando, y el paquete más reciente espera cerca de medio minuto"),
    ],
    answer: 2,
    why: t(
      "Every second one more parcel arrives than leaves, so the line grows by about one a second for as long as it lasts. Little's law ties the numbers together: time waiting = queue length ÷ throughput, so 300 ÷ 9 ≈ 33 s. Just below capacity the line stays short. A queue smooths out bursts; it cannot fix an average arrival rate above the service rate. Only more clerks, cheaper work or fewer arrivals can.",
      "Cada segundo llega un paquete más de los que salen, así que la fila crece cerca de uno por segundo mientras dure. La ley de Little (Little's law) relaciona los números: tiempo de espera = largo de la cola ÷ rendimiento (throughput), o sea 300 ÷ 9 ≈ 33 s. Justo por debajo de la capacidad, la fila se mantiene corta. Una cola suaviza las ráfagas; no puede arreglar una tasa promedio de llegada mayor que la de servicio. Eso solo se arregla con más empleados, trabajo más barato o menos llegadas.",
    ),
    watch: { rate: 1.2, crash: 0, poison: 0, order: "any", cap: "inf", clerks: 3 },
  },
  {
    id: "burst",
    title: t("200 parcels at once", "200 paquetes de golpe"),
    change: t("A quiet 5/s stream that the clerks (9/s) easily keep up with · 200 parcels dropped in at once · a queue vs nowhere to wait (turned away if every clerk is busy)", "Un flujo tranquilo de 5/s que los empleados (9/s) atienden sin problema · llegan 200 paquetes de golpe · con cola vs sin lugar para esperar (se rechazan si todos los empleados están ocupados)"),
    question: t("What happens to the 200 parcels?", "¿Qué pasa con los 200 paquetes?"),
    options: [
      t("With the queue they all get done, the last ones about 20 s late; with nowhere to wait almost all are turned away", "Con la cola se procesan todos, los últimos con unos 20 s de retraso; sin lugar para esperar, casi todos se rechazan"),
      t("With the queue the clerks fall behind for good", "Con la cola, los empleados se atrasan para siempre"),
      t("Both handle it the same: three clerks are three clerks", "Ambos lo manejan igual: tres empleados son tres empleados"),
    ],
    answer: 0,
    why: t(
      "The spare capacity (9 − 5 = 4 a second) drains the burst in under a minute, so the queue turns a spike nobody could serve into a short delay. Without anywhere to wait, everything that arrives while the clerks are busy is refused. This is the main reason queues sit between services: producers and consumers no longer have to run at the same speed at the same moment.",
      "La capacidad sobrante (9 − 5 = 4 por segundo) vacía la ráfaga en menos de un minuto, así que la cola convierte un pico que nadie podía atender en un retraso corto. Sin lugar para esperar, todo lo que llega mientras los empleados están ocupados se rechaza. Esa es la razón principal para poner colas entre servicios: productores y consumidores ya no tienen que ir a la misma velocidad en el mismo momento.",
    ),
    watch: { rate: 0.3, crash: 0, poison: 0, order: "any", cap: "inf", clerks: 3, burst: true },
  },
  {
    id: "crash",
    title: t("A clerk collapses before stamping", "Un empleado se desploma antes de sellar"),
    change: t("1 try in 10 ends with the clerk collapsing: half during the work, half after it but before the stamp · stamp after the work vs stamp on pickup vs an idempotent handler", "1 de cada 10 intentos termina con el empleado desplomado: la mitad durante el trabajo, la otra mitad después pero antes del sello · sellar después del trabajo vs sellar al recoger vs un handler idempotente"),
    question: t("With the stamp after the work, what happens to the parcels whose clerk collapsed?", "Con el sello después del trabajo, ¿qué pasa con los paquetes cuyo empleado se desplomó?"),
    options: [
      t("They're lost", "Se pierden"),
      t("They come back after the hold timer and are worked again, so some get done twice", "Vuelven cuando vence el temporizador de espera y se procesan de nuevo, así que algunos se hacen dos veces"),
      t("Nothing: the queue knows which clerk had them and waits for that clerk", "Nada: la cola sabe qué empleado los tenía y espera a ese empleado"),
    ],
    answer: 1,
    why: t(
      "Nobody stamped them, so when the hold timer (the visibility timeout) runs out they reappear and another clerk works them. Nothing is lost, but a parcel whose work had finished gets done twice: at-least-once delivery. Stamping on pickup flips it: no repeats, but a clerk who collapses mid-work loses the parcel for good (at-most-once). The usual answer is to stamp after the work and make the handler idempotent: it remembers parcel ids, so a repeat does no harm.",
      "Nadie los selló, así que cuando vence el temporizador de espera (el tiempo de invisibilidad, visibility timeout) reaparecen y otro empleado los procesa. No se pierde nada, pero un paquete cuyo trabajo ya había terminado se hace dos veces: entrega al menos una vez (at-least-once). Sellar al recoger lo invierte: no hay repeticiones, pero si el empleado se desploma a mitad del trabajo, el paquete se pierde para siempre (a lo sumo una vez, at-most-once). Lo usual es sellar (el ack) después del trabajo y hacer el handler idempotente: recuerda los ids de los paquetes, así que una repetición no hace daño.",
    ),
    watch: { rate: 0.8, crash: 0.1, poison: 0, order: "any", cap: "inf", clerks: 3, handler: "after" },
  },
  {
    id: "poison",
    title: t("One parcel in 50 can never be processed", "Uno de cada 50 paquetes nunca se puede procesar"),
    change: t("4 clerks, 1.5 s per parcel, 2 arriving a second · a bad parcel fails every time · retried forever vs moved to the dead-letter cage after 3 tries · 5 minutes", "4 empleados, 1.5 s por paquete, llegan 2 por segundo · un paquete malo falla siempre · reintentar para siempre vs mandarlo a la jaula de mensajes muertos después de 3 intentos · 5 minutos"),
    question: t("With retry forever, what happens by the 5-minute mark?", "Si se reintenta para siempre, ¿qué pasa a los 5 minutos?"),
    options: [
      t("Not much: 2% bad parcels cost about 2% of capacity", "Poca cosa: un 2% de paquetes malos cuesta cerca del 2% de la capacidad"),
      t("The bad ones keep coming back and pile up, until they take enough clerk time that the whole queue backs up", "Los malos vuelven una y otra vez y se acumulan, hasta ocupar tanto tiempo de los empleados que toda la cola se atasca"),
      t("The bad ones drop out on their own once their timer runs out", "Los malos salen solos cuando vence su temporizador"),
    ],
    answer: 1,
    why: t(
      "A bad parcel never leaves: every few seconds it reappears, takes a clerk, fails and goes back on the rack. New bad parcels keep arriving, so the share of clerk time spent on them grows until the clerks fall behind on the good ones too. A limit on tries plus a dead-letter queue takes them out of circulation after a few attempts, so the rest flows, and leaves them in one place for a person to inspect, fix and send back.",
      "Un paquete malo (un mensaje venenoso, poison message) nunca se va: cada pocos segundos reaparece, ocupa a un empleado, falla y vuelve al estante. Siguen llegando paquetes malos nuevos, así que la parte del tiempo de los empleados que se va en ellos crece hasta que también se atrasan con los buenos. Un límite de intentos más una cola de mensajes muertos (dead-letter queue, DLQ) los saca de circulación después de unos pocos intentos, para que el resto fluya, y los deja en un solo lugar para que alguien los revise, los corrija y los vuelva a enviar.",
    ),
    watch: { rate: 0.8, crash: 0, poison: 0.1, order: "any", cap: "inf", clerks: 3, tries: "inf" },
  },
  {
    id: "hol",
    title: t("One slow parcel at the front", "Un paquete lento al frente"),
    change: t("Parcels must be handled in order · one parcel for customer A takes 30 s instead of 0.4 s · one order for everything vs one order per customer (4 customers)", "Los paquetes se deben procesar en orden · un paquete del cliente A tarda 30 s en lugar de 0.4 s · un solo orden para todo vs un orden por cliente (4 clientes)"),
    question: t("How long do customers B, C and D wait?", "¿Cuánto esperan los clientes B, C y D?"),
    options: [
      t("The same either way: their parcels aren't slow", "Lo mismo en ambos casos: sus paquetes no son lentos"),
      t("With one order for everything they all wait about 30 s behind A's parcel; with one order per customer they barely notice", "Con un solo orden para todo, todos esperan unos 30 s detrás del paquete de A; con un orden por cliente, casi ni lo notan"),
      t("With an order per customer everyone waits longer, because of the extra bookkeeping", "Con un orden por cliente todos esperan más, por la contabilidad extra"),
    ],
    answer: 1,
    why: t(
      "Keeping one global order means only one parcel can be out at a time, so the slow one blocks everything behind it: head-of-line blocking. Most systems only need order within one customer, account or key. Keep a separate order per key (message groups, partitions) and a free clerk can reach past A's blocked parcels to B, C and D. A still waits behind its own slow parcel, which is the order it asked for.",
      "Mantener un solo orden global significa que solo un paquete puede estar en proceso a la vez, así que el lento bloquea todo lo que tiene detrás: bloqueo en la cabeza de la fila (head-of-line blocking). La mayoría de los sistemas solo necesitan orden dentro de un mismo cliente, cuenta o clave. Si mantienes un orden aparte por clave (grupos de mensajes, particiones), un empleado libre puede saltarse los paquetes bloqueados de A y tomar los de B, C y D. A sigue esperando detrás de su propio paquete lento, que es justo el orden que pidió.",
    ),
    watch: { rate: 0.3, crash: 0, poison: 0, order: "strict", cap: "inf", clerks: 3, slow: true },
  },
];

const QUESTIONS = [
  [t("As a data structure, what does a queue promise, and how do you make adding and removing O(1)?", "Como estructura de datos, ¿qué promete una cola y cómo logras que agregar y quitar sean O(1)?"),
    t("First in, first out: add at the tail, remove from the head, in arrival order. A linked list with head and tail pointers, or a ring buffer (a fixed array with head and tail indices that wrap around), makes both O(1). Removing from the front of a plain array (array.shift()) moves every other element, so it is O(n).",
      "Primero en entrar, primero en salir (FIFO): se agrega al final, se quita del frente, en orden de llegada. Una lista enlazada con punteros al frente y al final, o un búfer circular (ring buffer: un arreglo fijo con índices de frente y final que dan la vuelta), hace ambas operaciones O(1). Quitar del frente de un arreglo común (array.shift()) mueve todos los demás elementos, así que es O(n).")],
  [t("Your queue gets longer every afternoon and drains overnight. What is happening, and what are your options?", "Tu cola se alarga todas las tardes y se vacía de noche. ¿Qué está pasando y qué opciones tienes?"),
    t("In the afternoon work arrives faster than it is processed, and Little's law says the wait grows with the length (wait = length ÷ throughput). A bigger queue only delays the problem. The options: add consumers, make each job cheaper, or reduce what arrives (shed load, rate-limit, or bound the queue and push back on producers).",
      "En la tarde el trabajo llega más rápido de lo que se procesa, y la ley de Little dice que la espera crece con el largo (espera = largo ÷ rendimiento). Una cola más grande solo pospone el problema. Las opciones: agregar consumidores, hacer cada tarea más barata o reducir lo que llega (descartar carga, limitar la tasa, o acotar la cola y frenar a los productores, lo que se llama backpressure).")],
  [t("Why should a queue consumer be idempotent, and when should it acknowledge a message?", "¿Por qué un consumidor de una cola debería ser idempotente, y cuándo debería confirmar (ack) un mensaje?"),
    t("Acknowledge after the work is done, or a crash mid-work loses the message (at-most-once). But then a crash after the work and before the ack makes the message come back, and it is processed again (at-least-once). So handlers must tolerate repeats: dedupe by message id, use an idempotency key, or make the operation naturally idempotent (set a value rather than add to it).",
      "Confirma después de terminar el trabajo; si no, una caída a mitad del trabajo pierde el mensaje (a lo sumo una vez). Pero entonces una caída después del trabajo y antes del ack hace que el mensaje vuelva y se procese otra vez (al menos una vez). Por eso los handlers deben tolerar repeticiones: descartar duplicados por id de mensaje, usar una clave de idempotencia o hacer que la operación sea idempotente por naturaleza (asignar un valor en lugar de sumarle).")],
  [t("What is a visibility timeout, and what goes wrong if it is shorter than your processing time?", "¿Qué es un visibility timeout y qué sale mal si es más corto que tu tiempo de procesamiento?"),
    t("While a consumer holds a message it is hidden from the others; if it isn't acknowledged before the timeout, it becomes visible again for someone else. If processing takes longer than the timeout, a second consumer picks up a message the first is still working on, so you get duplicates with no crash at all. Set it above your worst-case processing time, or extend it (a heartbeat) while you work.",
      "Mientras un consumidor tiene un mensaje, este queda oculto para los demás; si no se confirma antes de que venza el tiempo (el tiempo de invisibilidad), vuelve a quedar visible para otro. Si procesar tarda más que ese tiempo, un segundo consumidor toma un mensaje en el que el primero todavía está trabajando, y tienes duplicados sin que nada se haya caído. Ponlo por encima de tu peor tiempo de procesamiento, o extiéndelo (con un heartbeat) mientras trabajas.")],
  [t("What is a dead-letter queue for, and what should you do with what lands in it?", "¿Para qué sirve una cola de mensajes muertos (dead-letter queue) y qué deberías hacer con lo que cae ahí?"),
    t("It catches messages that failed a set number of times (max receive count), so one poison message can't keep consuming workers or block the line. Alert on it, inspect the messages, fix the bug or the bad data, then redrive them to the main queue. A dead-letter queue nobody watches is just a slower way to lose data.",
      "Atrapa los mensajes que fallaron una cantidad fija de veces (el máximo de recepciones, max receive count), para que un mensaje venenoso no siga ocupando consumidores ni bloquee la fila. Pon una alerta sobre ella, revisa los mensajes, corrige el bug o los datos malos y después reenvíalos a la cola principal (redrive). Una DLQ que nadie mira es solo una forma más lenta de perder datos.")],
  [t("Strict first-in-first-out for everything, or order per key: what do you gain and lose?", "FIFO estricto para todo, u orden por clave: ¿qué ganas y qué pierdes?"),
    t("One global order means one message in flight at a time, so throughput is one worker's and any slow message blocks all the others (head-of-line blocking). Ordering per key (SQS FIFO message groups, Kafka partitions) keeps order where it matters, within an account or an order, and lets different keys run in parallel. A hot or stuck key still blocks its own line. If you don't need order at all, plain parallel consumers give the most throughput.",
      "Un solo orden global significa un mensaje en proceso a la vez, así que el rendimiento es el de un solo consumidor y cualquier mensaje lento bloquea a todos los demás (head-of-line blocking). Ordenar por clave (grupos de mensajes en SQS FIFO, particiones en Kafka) mantiene el orden donde importa, dentro de una cuenta o un pedido, y deja que claves distintas avancen en paralelo. Una clave muy activa o trabada sigue bloqueando su propia fila. Si no necesitas orden para nada, consumidores en paralelo sin más dan el mayor rendimiento.")],
];

export default defineLesson({
  title: t("Queue Workbench", "Banco de trabajo: colas"),
  eyebrow: t("Systems lesson 33 · Queues", "Lección de sistemas 33 · Colas"),
  lede: t("A queue is a line: the first one in is the first one out. Put one between the code that creates work and the code that does it, and it soaks up bursts, survives crashed workers and keeps arrival order, as long as the work keeps up on average. This lesson runs a parcel office as a work queue: watch a machine do it, predict what breaks it, then explain it back.",
    "Una cola es una fila: el primero que entra es el primero que sale. Ponla entre el código que crea trabajo y el código que lo hace, y absorbe ráfagas, sobrevive a consumidores que se caen y mantiene el orden de llegada, siempre que el trabajo alcance en promedio. Esta lección usa una oficina de paquetes como cola de trabajo: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Parcels arrive at the dock on the left and roll along the lane to the front on the right. Clerks take the parcel at the front, work it and stamp it into the cart. When a clerk collapses before stamping, or a parcel can't be processed, the parcel waits on the hold rack until its timer runs out, then goes back to the front of the lane. After 3 tries it goes into the cage. Try the arrival rate, the bad parcels, the lane limit and the per-customer order.",
      "Los paquetes llegan al muelle de la izquierda y ruedan por el carril hasta el frente, a la derecha. Los empleados toman el paquete del frente, lo procesan y lo sellan al carro. Cuando un empleado se desploma antes de sellar, o un paquete no se puede procesar, el paquete espera en el estante de retención hasta que vence su temporizador y luego vuelve al frente del carril. Después de 3 intentos va a la jaula. Prueba la tasa de llegada, los paquetes malos, el límite del carril y el orden por cliente."),
    plate: {
      title: t("Parcel office", "Oficina de paquetes"),
      keys: [
        { mark: "lit", label: t("A parcel being worked; a collapsed clerk; the lane gate when the lane is full", "Un paquete en proceso; un empleado desplomado; la barrera del carril cuando el carril está lleno") },
        { mark: "raised", label: t("Numbered parcels: number on top, customer letter in front, tries tag once redelivered", "Paquetes numerados: número arriba, letra del cliente al frente, etiqueta de intentos si se reentregó") },
        { mark: "flat", label: t("The roller lane: tail at the dock, front of the queue at the right", "El carril de rodillos: el final en el muelle, el frente de la cola a la derecha") },
      ],
      caption: t(
        "The producer drops numbered parcels at the dock; they roll to the front of the lane, so the numbers read in arrival order. A clerk takes the parcel at the front, works it at the desk and stamps it into the cart. If a clerk collapses, or a parcel can't be processed, the parcel waits on the hold rack: the gauge under it runs down to the moment it rejoins the front of the lane, wearing a tag with its number of tries. After 3 tries it goes into the dead-letter cage. A crossed band marks a bad parcel. Parcels that don't fit on the lane pile up on the pallet beside the dock; with a limited lane, the gate turns them away into the tray instead.",
        "El productor deja paquetes numerados en el muelle; ruedan hasta el frente del carril, así que los números se leen en orden de llegada. Un empleado (el consumidor) toma el paquete del frente, lo procesa en su escritorio y lo sella al carro. Si un empleado se desploma, o un paquete no se puede procesar, el paquete espera en el estante de retención: el indicador debajo baja hasta el momento en que vuelve al frente del carril, con una etiqueta que lleva su número de intentos. Después de 3 intentos va a la jaula de mensajes muertos. Una banda cruzada marca un paquete malo. Los paquetes que no caben en el carril se apilan en la tarima junto al muelle; con un carril limitado, la barrera los rechaza y van a la bandeja.",
      ),
      stage: { "data-office": "" },
      label: t("Work queue simulation. Space pauses or resumes.", "Simulación de una cola de trabajo. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["inq", t("In queue", "En cola")], ["oldest", t("Oldest wait", "Espera más larga")], ["done", t("Done", "Hechos")], ["redelivered", t("Redelivered", "Reentregados")], ["twice", t("Done twice", "Hechos dos veces")], ["lost", t("Lost", "Perdidos")], ["dead", t("Dead letters", "Mensajes muertos")], ["turned", t("Turned away", "Rechazados")]],
    controls: [
      { seg: "rate", label: t("Arrivals", "Llegadas"), options: [[0.3, "0.3/s"], [0.8, "0.8/s"], [1.2, "1.2/s"]], value: 0.8 },
      { seg: "clerks", label: t("Clerks", "Empleados"), options: [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], value: 3 },
      { seg: "order", label: t("Order", "Orden"), options: [["any", t("Any free clerk", "Cualquier empleado libre")], ["strict", t("One at a time", "De a uno")], ["key", t("Per customer", "Por cliente")]], value: "any" },
      { seg: "cap", label: t("Lane", "Carril"), options: [["inf", t("No limit", "Sin límite")], ["10", t("10, then turn away", "10, luego rechazar")]], value: "inf" },
      { seg: "crash", label: t("Clerk collapses", "Empleado se desploma"), options: [[0, t("Never", "Nunca")], [0.1, t("1 try in 10", "1 de cada 10 intentos")]], value: 0.1 },
      { seg: "poison", label: t("Bad parcels", "Paquetes malos"), options: [[0, t("None", "Ninguno")], [0.02, t("1 in 50", "1 de cada 50")], [0.1, t("1 in 10", "1 de cada 10")]], value: 0.02 },
      { seg: "tries", label: t("Tries, then cage", "Intentos antes de la jaula"), options: [["3", "3"], ["inf", t("Retry forever", "Reintentar siempre")]], value: "3" },
      { seg: "handler", label: t("Stamp", "Sello (ack)"), options: [["after", t("After the work", "Después del trabajo")], ["first", t("On pickup", "Al recoger")], ["idem", t("After, idempotent", "Después, idempotente")]], value: "after" },
      { speed: true },
      { actions: [["burst", t("Drop 30 at once", "Soltar 30 de golpe")], ["slow", t("Slow parcel for A", "Paquete lento para A")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Each clerk takes 3 s a parcel (1.5 to 4.5), so three clerks keep up with about one parcel a second. Changing a setting starts the run again.", "Cada empleado tarda 3 s por paquete (de 1.5 a 4.5), así que tres empleados alcanzan para cerca de un paquete por segundo. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
[data-desk][data-off],[data-clerk][data-off]{display:none}
.iso-stage [data-layer] text{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    PARCEL_SVG: parcelSvg(),
  },
});
