// @ts-nocheck: content in the style of the other lessons
// Systems lesson 69 · Delivery guarantees: a mail-order room where an order can be delivered twice with nothing broken,
// and where ids, a transaction and a key on the letter decide what a repeat does.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { oneUnder10, n0, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, envelopeSvg, letterSvg, slipSvg, P, GEOMETRY } from "./figure";
import { slowRun, beatRun, senderRun, txnRun, keyRun, WORK, SLOW, SLOW_SHARE, HB, RETRY, DOWN, RATE, WORKERS } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeded runs of an hour each).
const R = { slow: slowRun(), beat: beatRun(), sender: senderRun(), txn: txnRun(), key: keyRun() };

const k1 = (x) => (x === 0 ? "0" : oneUnder10(x));     // per 1,000 orders
const s0 = (x) => n0(x) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const range = ([a, b]) => a + "–" + (a + b) + " s";
const WORK_RANGE = range(WORK), SLOW_RANGE = range(SLOW), SLOW_EVERY = Math.round(1 / SLOW_SHARE);

// What each card shows after a run.
const RUNS = {
  slow: () => {
    const { long, short } = R.slow, m = top(short.ledgerTwice);
    return {
      verdict: t("Timeout 60 s: " + k1(long.ledgerTwice) + " orders per 1,000 written twice. Timeout 10 s: " + k1(short.ledgerTwice) + " per 1,000 written twice, " + k1(short.ledgerThrice) + " of them three times, every one a slow order; " + pct(short.copyShare) + " of the workers' time went on orders another worker was already doing. Nothing crashed.",
        "Tiempo de 60 s: " + k1(long.ledgerTwice) + " pedidos cada 1000 escritos dos veces. Tiempo de 10 s: " + k1(short.ledgerTwice) + " cada 1000 escritos dos veces, " + k1(short.ledgerThrice) + " de ellos tres veces, todos pedidos lentos; el " + pct(short.copyShare) + " del tiempo de los trabajadores se fue en pedidos que otro trabajador ya estaba haciendo. No se cayó nada."),
      bars: [[t("Written twice, 60 s", "Dos veces en el libro, 60 s"), long.ledgerTwice / m, k1(long.ledgerTwice)], [t("Written twice, 10 s", "Dos veces en el libro, 10 s"), short.ledgerTwice / m, k1(short.ledgerTwice), true], [t("Three times, 10 s", "Tres veces, 10 s"), short.ledgerThrice / m, k1(short.ledgerThrice), true]],
    };
  },
  beat: () => {
    const { long, beat } = R.beat, m = top(long.recover);
    return {
      verdict: t("Timeout 60 s: a crashed worker's order waited " + s0(long.recover) + " on average before another worker received it. 10 s with a heartbeat: " + s0(beat.recover) + ". Slow orders copied: none either way. Written twice, from crashes between the ledger and the ack: " + k1(long.ledgerTwice) + " vs " + k1(beat.ledgerTwice) + " per 1,000 orders.",
        "Tiempo de 60 s: el pedido de un trabajador caído esperó " + s0(long.recover) + " en promedio antes de que otro trabajador lo recibiera. 10 s con heartbeat: " + s0(beat.recover) + ". Pedidos lentos copiados: ninguno en los dos casos. Escritos dos veces, por caídas entre el libro y el ack: " + k1(long.ledgerTwice) + " vs " + k1(beat.ledgerTwice) + " cada 1000 pedidos."),
      bars: [[t("Back in the line, 60 s", "De vuelta en la fila, 60 s"), long.recover / m, s0(long.recover)], [t("Back in the line, heartbeat", "De vuelta en la fila, heartbeat"), beat.recover / m, s0(beat.recover), true]],
    };
  },
  sender: () => {
    const { off, msg, order } = R.sender, m = top(off.ledgerTwice);
    return {
      verdict: t("No dedupe: " + k1(off.ledgerTwice) + " orders per 1,000 written twice. Dedupe by message id: " + k1(msg.ledgerTwice) + ". Dedupe by order id: " + k1(order.ledgerTwice) + ". The sender resent " + k1(off.resent) + " orders per 1,000; even with the order id, " + k1(order.lettersTwice) + " per 1,000 got their letter twice.",
        "Sin deduplicar: " + k1(off.ledgerTwice) + " pedidos cada 1000 escritos dos veces. Deduplicando por id de mensaje: " + k1(msg.ledgerTwice) + ". Deduplicando por id de pedido: " + k1(order.ledgerTwice) + ". El remitente reenvió " + k1(off.resent) + " pedidos cada 1000; incluso con el id de pedido, " + k1(order.lettersTwice) + " cada 1000 recibieron su carta dos veces."),
      bars: [[t("Written twice, no dedupe", "Dos veces, sin deduplicar"), off.ledgerTwice / m, k1(off.ledgerTwice)], [t("Written twice, message id", "Dos veces, id de mensaje"), msg.ledgerTwice / m, k1(msg.ledgerTwice), true], [t("Written twice, order id", "Dos veces, id de pedido"), order.ledgerTwice / m, k1(order.ledgerTwice)]],
    };
  },
  txn: () => {
    const { after, txn } = R.txn, m = top(after.lettersTwice, after.ledgerTwice);
    return {
      verdict: t("Ledger, then ack: " + k1(after.ledgerTwice) + " orders per 1,000 written twice, " + k1(after.lettersTwice) + " letters sent twice. One transaction: " + k1(txn.ledgerTwice) + " written twice, " + k1(txn.lettersTwice) + " letters sent twice.",
        "Libro y después ack: " + k1(after.ledgerTwice) + " pedidos cada 1000 escritos dos veces, " + k1(after.lettersTwice) + " cartas enviadas dos veces. Una transacción: " + k1(txn.ledgerTwice) + " escritos dos veces, " + k1(txn.lettersTwice) + " cartas enviadas dos veces."),
      groups: [
        { title: t("Written in the ledger twice, per 1,000 orders", "Escritos dos veces en el libro, cada 1000 pedidos"), bars: [[t("Ledger, then ack", "Libro y después ack"), after.ledgerTwice / m, k1(after.ledgerTwice)], [t("One transaction", "Una transacción"), txn.ledgerTwice / m, k1(txn.ledgerTwice), true]] },
        { title: t("Letters sent twice, per 1,000 orders", "Cartas enviadas dos veces, cada 1000 pedidos"), bars: [[t("Ledger, then ack", "Libro y después ack"), after.lettersTwice / m, k1(after.lettersTwice)], [t("One transaction", "Una transacción"), txn.lettersTwice / m, k1(txn.lettersTwice), true]] },
      ],
    };
  },
  key: () => {
    const { plain, keyed } = R.key, m = top(plain.again);
    return {
      verdict: t("Delivered more than once: " + k1(keyed.again) + " orders per 1,000. Written twice: " + k1(keyed.ledgerTwice) + ". Letters sent twice: " + k1(plain.lettersTwice) + " with a plain letter, " + k1(keyed.lettersTwice) + " with the key, while the mail service dropped " + k1(keyed.dropped) + " repeats per 1,000 orders.",
        "Entregados más de una vez: " + k1(keyed.again) + " pedidos cada 1000. Escritos dos veces: " + k1(keyed.ledgerTwice) + ". Cartas enviadas dos veces: " + k1(plain.lettersTwice) + " con carta simple, " + k1(keyed.lettersTwice) + " con la clave, mientras el servicio de correo descartó " + k1(keyed.dropped) + " repeticiones cada 1000 pedidos."),
      bars: [[t("Delivered more than once", "Entregados más de una vez"), keyed.again / m, k1(keyed.again)], [t("Letters twice, plain letter", "Cartas dos veces, carta simple"), plain.lettersTwice / m, k1(plain.lettersTwice)], [t("Letters twice, with the key", "Cartas dos veces, con la clave"), keyed.lettersTwice / m, k1(keyed.lettersTwice), true], [t("Written twice, with the key", "Dos veces en el libro, con la clave"), keyed.ledgerTwice / m, k1(keyed.ledgerTwice), true]],
    };
  },
};

const { slow: A, beat: B, sender: C, txn: D, key: E } = R;

const EXPERIMENTS = [
  {
    id: "slow",
    title: t("Work longer than the timeout", "Trabajo más largo que el tiempo de invisibilidad"),
    change: t("Nothing crashes, ack after the ledger, no dedupe · one order in " + SLOW_EVERY + " is slow (" + SLOW_RANGE + " of work, the rest " + WORK_RANGE + ") · visibility timeout 60 s → 10 s · an hour of orders",
      "No se cae nada, ack después del libro, sin deduplicar · uno de cada " + SLOW_EVERY + " pedidos es lento (" + SLOW_RANGE + " de trabajo, el resto " + WORK_RANGE + ") · tiempo de invisibilidad 60 s → 10 s · una hora de pedidos"),
    question: t("Nothing ever crashes. With the 10 s timeout, how many orders end up in the ledger twice?", "Nunca se cae nada. Con el tiempo de 10 s, ¿cuántos pedidos terminan dos veces en el libro?"),
    options: [
      t("None: nothing failed, so nothing is redelivered", "Ninguno: nada falló, así que nada se vuelve a entregar"),
      t("Nearly every slow one, some of them three times", "Casi todos los lentos, algunos hasta tres veces"),
      t("Only those still waiting in line after 10 s", "Solo los que siguen esperando en la fila a los 10 s"),
    ],
    answer: 1,
    why: t(
      "The timeout starts when a worker receives the message, and the queue can't tell a slow worker from a dead one. When 10 s pass without an ack, the message becomes visible again and the next free worker receives it, while the first one is still working on it. Nothing failed, and the order is written twice: " + k1(A.short.ledgerTwice) + " orders per 1,000, all of them slow ones; those still running at 20 s went out a third time (" + k1(A.short.ledgerThrice) + " per 1,000). The copies cost capacity too: " + pct(A.short.copyShare) + " of the workers' time went on orders someone else was already doing. In lesson 33, Queues, the repeats came from crashes; here the timeout alone makes them. A waiting message's clock doesn't run: that's the retention period, a different setting. SQS's default visibility timeout is 30 s; set it above your slowest processing, or extend it while you work (the next experiment).",
      "El tiempo empieza cuando un trabajador recibe el mensaje, y la cola no distingue un trabajador lento de uno muerto. Cuando pasan 10 s sin ack, el mensaje vuelve a quedar visible y el siguiente trabajador libre lo recibe, mientras el primero todavía trabaja en él. Nada falló, y el pedido se escribe dos veces: " + k1(A.short.ledgerTwice) + " pedidos cada 1000, todos lentos; los que seguían a los 20 s salieron una tercera vez (" + k1(A.short.ledgerThrice) + " cada 1000). Las copias también cuestan capacidad: el " + pct(A.short.copyShare) + " del tiempo de los trabajadores se fue en pedidos que otro ya estaba haciendo. En la lección 33, Colas, las repeticiones venían de caídas; aquí las produce solo el tiempo de invisibilidad (visibility timeout). El reloj de un mensaje que espera en la fila no corre: eso es el período de retención, otro ajuste. El valor por defecto en SQS es 30 s; ponlo por encima de tu procesamiento más lento, o extiéndelo mientras trabajas (el siguiente experimento).",
    ),
    watch: { ack: "after", vt: "10", crash: "0", lost: "0", dedupe: "off", key: "plain", stage: "slow", speed: 3 },
  },
  {
    id: "beat",
    title: t("A long timeout or a heartbeat", "Un tiempo largo o un heartbeat"),
    change: t("Workers crash in 1 try in 10, at a random moment · visibility timeout 60 s vs 10 s with a heartbeat: while it works, the worker pushes its timeout 10 s ahead every " + HB + " s",
      "Los trabajadores se caen en 1 de cada 10 intentos, en un momento al azar · tiempo de invisibilidad de 60 s vs 10 s con heartbeat: mientras trabaja, el trabajador corre su tiempo 10 s hacia adelante cada " + HB + " s"),
    question: t("Neither one copies slow orders. When a worker crashes, how long until its order is back in the line?", "Ninguno de los dos copia pedidos lentos. Cuando un trabajador se cae, ¿cuánto tarda su pedido en volver a la fila?"),
    options: [
      t("About the same: both wait out a timeout", "Más o menos lo mismo: los dos esperan que venza un tiempo"),
      t("Nearly a minute with 60 s, seconds with the heartbeat", "Casi un minuto con 60 s, segundos con el heartbeat"),
      t("At once either way: the queue sees the worker die", "Enseguida en los dos casos: la cola ve morir al trabajador"),
    ],
    answer: 1,
    why: t(
      "A queue that leases messages, as SQS does, never hears that a worker died; it only notices that no ack came in time. With a 60 s timeout, a crashed worker's order sat hidden for " + s0(B.long.recover) + " on average before another worker received it. With the heartbeat the timeout only has to cover the gap between two extensions, so it can be short: a crash stops the extensions, and the order was back in " + s0(B.beat.recover) + ". A slow worker that's alive keeps extending, so it never loses its message (in SQS, ChangeMessageVisibility). Brokers that hold a connection per consumer, such as RabbitMQ, put unacked messages back when the connection closes, which a dead process usually causes at once; a hung one still needs a timeout. Neither setting helps the crash after the ledger and before the ack: " + k1(B.long.ledgerTwice) + " and " + k1(B.beat.ledgerTwice) + " orders per 1,000 were written twice.",
      "Una cola que presta mensajes por un tiempo, como SQS, nunca se entera de que un trabajador murió; solo nota que el ack no llegó a tiempo. Con un tiempo de 60 s, el pedido de un trabajador caído quedó oculto " + s0(B.long.recover) + " en promedio antes de que otro trabajador lo recibiera. Con una señal periódica (heartbeat), el tiempo solo tiene que cubrir el hueco entre dos extensiones, así que puede ser corto: una caída detiene las extensiones, y el pedido volvió en " + s0(B.beat.recover) + ". Un trabajador lento pero vivo sigue extendiendo, así que nunca pierde su mensaje (en SQS, ChangeMessageVisibility). Los brokers que mantienen una conexión por consumidor, como RabbitMQ, devuelven los mensajes sin ack cuando se cierra la conexión, y un proceso muerto suele cerrarla enseguida; uno colgado igual necesita un tiempo límite. Ningún ajuste ayuda con la caída después del libro y antes del ack: " + k1(B.long.ledgerTwice) + " y " + k1(B.beat.ledgerTwice) + " pedidos cada 1000 se escribieron dos veces.",
    ),
    watch: { ack: "after", vt: "60", crash: "0.1", lost: "0", dedupe: "off", key: "plain", stage: "crash", speed: 3 },
  },
  {
    id: "sender",
    title: t("Dedupe on the message id", "Deduplicar por id de mensaje"),
    change: t("Workers crash in 1 try in 10 · the queue's reply to the sender is lost 1 time in 10, so the sender sends that order again after " + RETRY + " s, as a new message · dedupe off vs by message id vs by order id",
      "Los trabajadores se caen en 1 de cada 10 intentos · la respuesta de la cola al remitente se pierde 1 de cada 10 veces, así que el remitente vuelve a enviar ese pedido a los " + RETRY + " s, como un mensaje nuevo · sin deduplicar vs por id de mensaje vs por id de pedido"),
    question: t("With dedupe by message id, how many orders end up in the ledger twice?", "Deduplicando por id de mensaje, ¿cuántos pedidos terminan dos veces en el libro?"),
    options: [
      t("None: the queue already drops a resent message", "Ninguno: la cola ya descarta un mensaje reenviado"),
      t("Almost none: the table catches every repeat", "Casi ninguno: la tabla atrapa toda repetición"),
      t("Nearly as many as with no dedupe at all", "Casi tantos como sin deduplicar"),
    ],
    answer: 2,
    why: t(
      "A resent order is a new message: the queue stored it again and gave it its own message id, so the dedupe table has never seen it, and both copies are written: " + k1(C.msg.ledgerTwice) + " orders per 1,000 with message ids, against " + k1(C.off.ledgerTwice) + " with no dedupe. Message ids only catch the same message delivered twice, here the crash between the ledger and the ack, the rarer case. The order id, which the sender put in the message itself, catches both: " + k1(C.order.ledgerTwice) + ". The id must come from whoever created the work, before the first send: the idempotency key of lesson 25, Idempotency keys. Some brokers drop a sender's retries themselves: Kafka's idempotent producer (the default since Kafka 3.0) drops the duplicates its own client retries would write, within one producer session, and an SQS FIFO queue drops a message whose deduplication id it saw in the last 5 minutes. An application that sends the order again on its own, or after a restart, still needs the order id. Letters are another matter: " + k1(C.order.lettersTwice) + " orders per 1,000 still got theirs twice (the last two experiments).",
      "Un pedido reenviado es un mensaje nuevo: la cola lo guardó otra vez y le dio su propio id de mensaje, así que la tabla de deduplicación nunca lo vio, y se escriben las dos copias: " + k1(C.msg.ledgerTwice) + " pedidos cada 1000 con ids de mensaje, contra " + k1(C.off.ledgerTwice) + " sin deduplicar. Los ids de mensaje solo atrapan el mismo mensaje entregado dos veces, aquí la caída entre el libro y el ack, el caso más raro. El id de pedido, que el remitente puso en el propio mensaje, atrapa los dos: " + k1(C.order.ledgerTwice) + ". El id tiene que venir de quien creó el trabajo, antes del primer envío: la clave de idempotencia de la lección 25, Claves de idempotencia. Algunos brokers descartan ellos mismos los reintentos del remitente: el productor idempotente de Kafka (el valor por defecto desde Kafka 3.0) descarta los duplicados que escribirían los reintentos de su propio cliente, dentro de una misma sesión del productor, y una cola FIFO de SQS descarta un mensaje cuyo id de deduplicación vio en los últimos 5 minutos. Una aplicación que vuelve a enviar el pedido por su cuenta, o después de reiniciarse, igual necesita el id de pedido. Las cartas son otro tema: " + k1(C.order.lettersTwice) + " pedidos cada 1000 igual recibieron la suya dos veces (los dos últimos experimentos).",
    ),
    watch: { ack: "after", vt: "60", crash: "0.1", lost: "0.1", dedupe: "msg", key: "plain", stage: "lose" },
  },
  {
    id: "txn",
    title: t("“Exactly-once” mode", "El modo “exactamente una vez”"),
    change: t("Workers crash in 1 try in 10 · the ledger entry, then the ack vs the ledger entry and the ack in one transaction, which fails if another worker already acked · the letter is mailed before either",
      "Los trabajadores se caen en 1 de cada 10 intentos · la entrada en el libro y después el ack vs la entrada y el ack en una sola transacción, que falla si otro trabajador ya hizo el ack · la carta se envía antes de los dos"),
    question: t("With the transaction, how many customers get the same letter twice?", "Con la transacción, ¿cuántos clientes reciben la misma carta dos veces?"),
    options: [
      t("None: the transaction makes the handler exactly-once", "Ninguno: la transacción hace al handler exactamente una vez"),
      t("As many as before: the letter isn't in the transaction", "Los mismos que antes: la carta no está en la transacción"),
      t("Fewer: the transaction narrows the window for a crash", "Menos: la transacción achica la ventana para una caída"),
    ],
    answer: 1,
    why: t(
      "The transaction does what it promises: a crash before the commit leaves neither the entry nor the ack, so the order comes back and is written once: " + k1(D.txn.ledgerTwice) + " orders per 1,000 written twice, against " + k1(D.after.ledgerTwice) + " without it. But the letter went out before the commit, through a service the transaction can't roll back, and a redelivered order mails it again: " + k1(D.after.lettersTwice) + " and " + k1(D.txn.lettersTwice) + " letters per 1,000 orders sent twice, the same crashes either way. That is what a broker's exactly-once means. Kafka's transactions commit the consumer's offsets together with the records it writes, and consumers reading with read_committed see only committed records, so a read-process-write loop inside Kafka takes effect once (Kafka Streams calls it processing.guarantee=exactly_once_v2). An email, a payment or a call to another service is outside that boundary, and is still at least once.",
      "La transacción cumple lo que promete: una caída antes del commit no deja ni la entrada ni el ack, así que el pedido vuelve y se escribe una vez: " + k1(D.txn.ledgerTwice) + " pedidos cada 1000 escritos dos veces, contra " + k1(D.after.ledgerTwice) + " sin ella. Pero la carta salió antes del commit, por un servicio que la transacción no puede revertir, y un pedido entregado de nuevo la envía otra vez: " + k1(D.after.lettersTwice) + " y " + k1(D.txn.lettersTwice) + " cartas cada 1000 pedidos enviadas dos veces, las mismas caídas en los dos casos. Eso es lo que significa el exactamente una vez (exactly-once) de un broker. Las transacciones de Kafka confirman los offsets del consumidor junto con los registros que escribe, y los consumidores que leen con read_committed solo ven registros confirmados, así que un bucle leer-procesar-escribir dentro de Kafka tiene efecto una vez (Kafka Streams lo llama processing.guarantee=exactly_once_v2). Un correo, un pago o una llamada a otro servicio quedan fuera de ese límite, y siguen siendo al menos una vez (at-least-once).",
    ),
    watch: { ack: "txn", vt: "60", crash: "0.1", lost: "0", dedupe: "off", key: "plain", stage: "letter", speed: 3 },
  },
  {
    id: "key",
    title: t("A key on the letter", "Una clave en la carta"),
    change: t("Every source of repeats on: crashes in 1 try in 10, a 10 s timeout with slow orders, 1 reply in 10 to the sender lost · ack after the ledger, dedupe by order id · plain letter → the order id on the letter as its idempotency key, so the mail service drops a repeat",
      "Todas las fuentes de repeticiones activadas: caídas en 1 de cada 10 intentos, un tiempo de 10 s con pedidos lentos, 1 de cada 10 respuestas al remitente perdida · ack después del libro, deduplicar por id de pedido · carta simple → el id de pedido en la carta como clave de idempotencia, así que el servicio de correo descarta una repetición"),
    question: t("With the key on the letter, how many orders take effect twice, and how many are delivered more than once?", "Con la clave en la carta, ¿cuántos pedidos tienen efecto dos veces y cuántos se entregan más de una vez?"),
    options: [
      t("None either way: dedupe and the key stop the repeats", "Ninguno de los dos: la deduplicación y la clave frenan las repeticiones"),
      t("None take effect twice, but many still arrive twice", "Ninguno tiene efecto dos veces, pero muchos siguen llegando dos veces"),
      t("A few take effect twice, from copies run at once", "Unos pocos tienen efecto dos veces, por copias en paralelo"),
    ],
    answer: 1,
    why: t(
      "Deliveries didn't change: " + k1(E.keyed.again) + " orders per 1,000 were delivered more than once, because every source of repeats is still there and no queue setting removes them all. What changed is what a repeat does. The ledger refuses a second entry for an order id it has recorded, because the id is recorded in the same transaction as the entry (recorded separately, after the effect, a crash in between lets the repeat through: lesson 24, Outbox pattern). The mail service drops a letter whose key it has seen: letters sent twice went from " + k1(E.plain.lettersTwice) + " per 1,000 orders to " + k1(E.keyed.lettersTwice) + ", and " + k1(E.keyed.dropped) + " repeats per 1,000 were dropped. Copies running at the same time, from the short timeout, are covered as well: the second to commit finds its id taken. That's effectively once: at-least-once delivery, with every effect idempotent on its own.",
      "Las entregas no cambiaron: " + k1(E.keyed.again) + " pedidos cada 1000 se entregaron más de una vez, porque todas las fuentes de repeticiones siguen ahí y ningún ajuste de la cola las elimina todas. Lo que cambió es lo que hace una repetición. El libro rechaza una segunda entrada para un id de pedido que ya registró, porque el id se registra en la misma transacción que la entrada (registrado aparte, después del efecto, una caída en el medio deja pasar la repetición: lección 24, Patrón outbox). El servicio de correo descarta una carta cuya clave ya vio: las cartas enviadas dos veces pasaron de " + k1(E.plain.lettersTwice) + " cada 1000 pedidos a " + k1(E.keyed.lettersTwice) + ", y se descartaron " + k1(E.keyed.dropped) + " repeticiones cada 1000. Las copias que corren al mismo tiempo, por el tiempo corto, también quedan cubiertas: la segunda en hacer commit encuentra su id ocupado. Eso es efectivamente una vez (effectively-once): entrega al menos una vez, con cada efecto idempotente por su cuenta.",
    ),
    watch: { ack: "after", vt: "10", crash: "0.1", lost: "0.1", dedupe: "order", key: "key", stage: "all", speed: 3 },
  },
];

const QUESTIONS = [
  [t("Your broker's documentation says \"exactly-once\". What does it promise, and what does it leave to you?", "La documentación de tu broker dice \"exactamente una vez\". ¿Qué promete y qué te deja a ti?"),
   t("It promises something inside its own boundary. Kafka's idempotent producer keeps its own retries from writing duplicates, and its transactions commit the records a consumer writes together with the consumer's offsets, so a read-process-write loop within Kafka takes effect once for consumers reading committed data. An SQS FIFO queue drops a message sent again with the same deduplication id within 5 minutes, but still delivers a message again if it isn't deleted before its visibility timeout. Neither covers anything outside: a row in your own database, an email, a payment. Those need the dedupe record in the same transaction as the effect, or an idempotency key the other side honours.",
     "Promete algo dentro de su propio límite. El productor idempotente de Kafka evita que sus propios reintentos escriban duplicados, y sus transacciones confirman los registros que escribe un consumidor junto con los offsets de ese consumidor, así que un bucle leer-procesar-escribir dentro de Kafka tiene efecto una vez para los consumidores que leen datos confirmados. Una cola FIFO de SQS descarta un mensaje enviado otra vez con el mismo id de deduplicación dentro de 5 minutos, pero igual entrega de nuevo un mensaje que no se borró antes de que venza su tiempo de invisibilidad. Ninguno cubre nada de afuera: una fila en tu propia base de datos, un correo, un pago. Eso necesita el registro de deduplicación en la misma transacción que el efecto, o una clave de idempotencia que el otro lado respete.")],
  [t("Why can't a queue simply deliver each message exactly once?", "¿Por qué una cola no puede simplemente entregar cada mensaje exactamente una vez?"),
   t("Because the worker's effect and its ack are two steps on two machines. If the ack is lost, or the worker dies or stalls after the effect and before the ack, the queue can't tell \"done, ack missing\" from \"never done\", and it has to choose: deliver again (at least once) or not (at most once, lesson 33, Queues). Timeouts make it worse: a slow worker looks exactly like a dead one. So the guarantee you build is at-least-once delivery plus effects that ignore a repeat, which is what \"effectively once\" means.",
     "Porque el efecto del trabajador y su ack son dos pasos en dos máquinas. Si se pierde el ack, o el trabajador muere o se traba después del efecto y antes del ack, la cola no puede distinguir \"hecho, falta el ack\" de \"nunca hecho\", y tiene que elegir: entregar de nuevo (al menos una vez) o no (a lo sumo una vez, lección 33, Colas). Los tiempos límite lo empeoran: un trabajador lento se ve igual que uno muerto. Así que la garantía que construyes es entrega al menos una vez más efectos que ignoran una repetición, que es lo que significa \"efectivamente una vez\".")],
  [t("Which id should a consumer deduplicate on?", "¿Sobre qué id debería deduplicar un consumidor?"),
   t("An id that names the piece of work and is fixed where the work is created, before the first send: an order id, a payment id, an idempotency key in the message body. The broker's message id changes when the sender resends, an SQS receipt handle changes on every receive, and a Kafka offset changes when a producer writes the same record twice; those only catch the same message delivered twice.",
     "Un id que nombre la unidad de trabajo y quede fijo donde se crea el trabajo, antes del primer envío: un id de pedido, un id de pago, una clave de idempotencia en el cuerpo del mensaje. El id de mensaje del broker cambia cuando el remitente reenvía, un receipt handle de SQS cambia en cada recepción, y un offset de Kafka cambia cuando un productor escribe dos veces el mismo registro; esos solo atrapan el mismo mensaje entregado dos veces.")],
  [t("How long must the dedupe table remember an id?", "¿Cuánto tiempo tiene que recordar un id la tabla de deduplicación?"),
   t("As long as a copy can still arrive: the sender's retries, a redelivery after each visibility timeout until the message reaches the dead-letter queue, a redrive from that queue days later, a replay of a log from an old offset (lesson 20, Logs and offsets). SQS FIFO's 5 minutes only covers quick resends. Expire ids sooner and a late copy takes effect again, as with the expiring keys of lesson 25, Idempotency keys. Where that's too long to keep a table, let the effect itself refuse a repeat: a unique constraint on the order id in the table that holds the effect.",
     "Mientras todavía pueda llegar una copia: los reintentos del remitente, una nueva entrega después de cada tiempo de invisibilidad hasta que el mensaje llegue a la cola de mensajes muertos (dead-letter queue), un reenvío desde esa cola días después, una relectura de un log desde un offset viejo (lección 20, Logs y offsets). Los 5 minutos de SQS FIFO solo cubren reenvíos rápidos. Si los ids vencen antes, una copia tardía vuelve a tener efecto, como con las claves que vencen de la lección 25, Claves de idempotencia. Si es demasiado tiempo para guardar una tabla, haz que el propio efecto rechace la repetición: una restricción de unicidad sobre el id de pedido en la tabla que guarda el efecto.")],
  [t("A handler looks the id up at the start, does a slow job, then writes the result and the id. What goes wrong when two copies of the message run at once, and how do you close it?", "Un handler busca el id al principio, hace un trabajo lento y después escribe el resultado y el id. ¿Qué sale mal cuando dos copias del mensaje corren a la vez, y cómo lo cierras?"),
   t("Both lookups find nothing, so both copies do the job: a check-then-act race (lesson 17, Race conditions). Make the write itself decide: record the id with a unique constraint in the same transaction as the result, so the second commit fails, as the ledger here does; or claim the id before the work with an in-progress marker (lesson 25). Either way the slow job runs twice, so also keep copies rare: a visibility timeout above the slowest job, or a heartbeat that extends it.",
     "Las dos búsquedas no encuentran nada, así que las dos copias hacen el trabajo: una condición de carrera de verificar y después actuar (lección 17, Condiciones de carrera). Haz que decida la propia escritura: registra el id con una restricción de unicidad en la misma transacción que el resultado, para que falle el segundo commit, como hace aquí el libro; o reserva el id antes del trabajo con una marca de \"en curso\" (lección 25). En los dos casos el trabajo lento corre dos veces, así que también mantén las copias raras: un tiempo de invisibilidad mayor que el trabajo más lento, o un heartbeat que lo extienda.")],
  [t("Your handler sends an email or charges a card. How do you make that effectively once?", "Tu handler envía un correo o cobra una tarjeta. ¿Cómo logras que sea efectivamente una vez?"),
   t("Your own transaction can't include it, so the receiver has to recognise a repeat: send a stable idempotency key built from the order id (payment APIs such as Stripe accept an Idempotency-Key header), or ask the provider whether it already happened before you retry. If the receiver offers neither, you choose per effect what a crash costs: send before recording it and risk a duplicate (at least once), or record first and risk a missing one (at most once). A duplicate reminder email may be fine; a duplicate charge isn't.",
     "Tu propia transacción no puede incluirlo, así que quien lo recibe tiene que reconocer una repetición: envía una clave de idempotencia estable armada con el id de pedido (las APIs de pago como Stripe aceptan un encabezado Idempotency-Key), o pregúntale al proveedor si ya ocurrió antes de reintentar. Si el receptor no ofrece ninguna de las dos cosas, eliges por efecto qué cuesta una caída: enviar antes de registrarlo y arriesgar un duplicado (al menos una vez), o registrar primero y arriesgar que falte (a lo sumo una vez). Un correo de recordatorio duplicado puede estar bien; un cobro duplicado, no.")],
];

export default defineLesson({
  title: t("Delivery Guarantees Workbench", "Banco de trabajo: garantías de entrega"),
  eyebrow: t("Systems lesson 69 · Delivery guarantees", "Lección de sistemas 69 · Garantías de entrega"),
  lede: t("A queue can promise that each message is processed at most once, and may be lost, or at least once, and may come twice. Exactly-once is not a third setting: it's at-least-once delivery plus effects that ignore a repeat, and only inside the boundary one system controls. This lesson turns it into a mail-order room: watch orders come twice with nothing broken, predict which ids, transactions and keys stop the harm, then explain it back.",
    "Una cola puede prometer que cada mensaje se procesa a lo sumo una vez (at-most-once), y se puede perder, o al menos una vez (at-least-once), y puede llegar dos veces. Exactamente una vez (exactly-once) no es un tercer ajuste: es entrega al menos una vez más efectos que ignoran una repetición, y solo dentro del límite que controla un sistema. Esta lección lo convierte en una sala de pedidos por correo: mira cómo llegan pedidos dos veces sin que nada se rompa, predice qué ids, transacciones y claves evitan el daño y después explícalo."),
  machine: {
    intro: t("The sender sends each order to the queue as an envelope. A worker takes the envelope at the front of the line, does the work, mails the customer a letter, writes the order in the ledger and acks. Send a slow order with the short timeout, crash a worker right after its letter, lose a reply to the sender, then try the dedupe table, the transaction and a key on the letter.",
      "El remitente envía cada pedido a la cola como un sobre. Un trabajador toma el sobre del frente de la fila, hace el trabajo, le envía una carta al cliente, escribe el pedido en el libro y hace el ack. Envía un pedido lento con el tiempo corto, haz caer a un trabajador justo después de su carta, pierde una respuesta al remitente, y después prueba la tabla de deduplicación, la transacción y una clave en la carta."),
    plate: {
      title: t("Mail-order room", "Sala de pedidos por correo"),
      keys: [
        { mark: "lit", label: t("A repeat: an envelope still being worked after its timeout ran out, so another worker can get the same order; a letter sent a second time; the lamps on the ledger and the mail service when an order is written or mailed twice", "Una repetición: un sobre que se sigue trabajando después de que venció su tiempo, así que otro trabajador puede recibir el mismo pedido; una carta enviada por segunda vez; las lámparas del libro y del servicio de correo cuando un pedido se escribe o se envía dos veces") },
        { mark: "raised", label: t("Envelopes: order number on top, the queue's message id below", "Sobres: número de pedido arriba, id de mensaje de la cola abajo") },
        { mark: "flat", label: t("The queue's line on its rack, the front on the right; behind it the hidden row, where a crashed worker's envelope waits, dimmed", "La fila de la cola en su estante, con el frente a la derecha; detrás, la hilera oculta, donde espera atenuado el sobre de un trabajador caído") },
      ],
      caption: t(
        "The sender (back left) sends each order to the queue; if the queue's reply doesn't come back within " + RETRY + " s, it sends the order again as a new message (RESENT). Workers A, B and C take the envelope at the front of the line; the dial on each desk is its visibility timeout. If it runs out before the ack, the queue hands the message out again and the worker's envelope lights. A job is the work, a letter through the mail service, a ledger entry and the ack, in the order on the plaque in front of the desks. A crashed worker is back after " + DOWN + " s; its envelope waits in the hidden row until its timeout runs out. The index box on the ledger is the dedupe table; the plate on the mail service says whether it checks idempotency keys, and its tray holds the repeats it drops.",
        "El remitente (al fondo a la izquierda) envía cada pedido a la cola; si la respuesta de la cola no vuelve en " + RETRY + " s, envía el pedido otra vez como un mensaje nuevo (REENVÍOS). Los trabajadores A, B y C toman el sobre del frente de la fila; el dial de cada escritorio es su tiempo de invisibilidad. Si vence antes del ack, la cola vuelve a entregar el mensaje y se enciende el sobre del trabajador. Una tarea es el trabajo, una carta por el servicio de correo, una entrada en el libro y el ack, en el orden de la placa delante de los escritorios. Un trabajador caído vuelve a los " + DOWN + " s; su sobre espera en la hilera oculta hasta que vence su tiempo. La caja de fichas del libro es la tabla de deduplicación; la placa del correo dice si revisa claves de idempotencia, y su bandeja guarda las repeticiones descartadas.",
      ),
      stage: { "data-mailroom": "" },
      label: t("Delivery guarantees simulation. Space pauses or resumes.", "Simulación de garantías de entrega. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["waiting", t("Waiting", "En espera")],
      ["again", t("Orders delivered again", "Pedidos reentregados")],
      ["lost", t("Lost", "Perdidos")],
      ["ledger2", t("Ledger twice", "Dos veces en el libro")],
      ["letters2", t("Letters twice", "Cartas dos veces")],
      ["resent", t("Resent", "Reenvíos")],
    ],
    controls: [
      { seg: "ack", label: "Ack", options: [["first", t("On receipt", "Al recibir")], ["after", t("After the ledger", "Después del libro")], ["txn", t("With the ledger, one transaction", "Con el libro, en una transacción")]], value: "after" },
      { seg: "vt", label: t("Visibility timeout", "Tiempo de invisibilidad"), options: [["10", "10 s"], ["60", "60 s"], ["hb", t("10 s + heartbeat", "10 s + heartbeat")]], value: "10" },
      { seg: "crash", label: t("Worker crashes", "Caídas del trabajador"), options: [["0", t("Never", "Nunca")], ["0.1", t("1 try in 10", "1 de cada 10 intentos")]], value: "0.1" },
      { seg: "lost", label: t("Replies to the sender", "Respuestas al remitente"), options: [["0", t("All arrive", "Llegan todas")], ["0.1", t("1 in 10 lost", "Se pierde 1 de cada 10")]], value: "0" },
      { seg: "dedupe", label: t("Dedupe", "Deduplicar"), options: [["off", t("Off", "No")], ["msg", t("By message id", "Por id de mensaje")], ["order", t("By order id", "Por id de pedido")]], value: "off" },
      { seg: "key", label: t("Letter", "Carta"), options: [["plain", t("Plain", "Simple")], ["key", t("With a key", "Con clave")]], value: "plain" },
      { speed: true },
      { actions: [["slow", t("Send a slow order", "Enviar un pedido lento"), { primary: true }], ["crash", t("Crash after a letter", "Caída tras una carta")], ["lose", t("Lose the next reply", "Perder la próxima respuesta")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again, with a slow order already at a desk. The work takes " + WORK_RANGE + ", or " + SLOW_RANGE + " for one order in " + SLOW_EVERY + "; " + RATE + " orders a second for " + WORKERS + " workers; times are illustrative and round. Crash after a letter makes the next worker to mail a letter crash right after it, before the ledger and the ack. With the heartbeat, a worker pushes its timeout 10 s ahead every " + HB + " s while it works.",
      "Cambiar un ajuste reinicia la ejecución, con un pedido lento ya en un escritorio. El trabajo tarda " + WORK_RANGE + ", o " + SLOW_RANGE + " para uno de cada " + SLOW_EVERY + " pedidos; " + RATE + " pedidos por segundo para " + WORKERS + " trabajadores; los tiempos son ilustrativos y redondos. Caída tras una carta hace que el próximo trabajador que envíe una carta se caiga justo después, antes del libro y del ack. Con el heartbeat, un trabajador corre su tiempo 10 s hacia adelante cada " + HB + " s mientras trabaja."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of an hour each, and counted per 1,000 orders.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de una hora cada una, y se cuentan cada 1000 pedidos."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: LIT_FILL_CSS + `
[data-env-o],[data-letter-text],[data-slip-text],[data-status]{font-weight:600}
`,
  data: {
    P, G: GEOMETRY, ENV_SVG: envelopeSvg(), LETTER_SVG: letterSvg(), SLIP_SVG: slipSvg(),
    STATUS: {
      idle: t("IDLE", "LIBRE"), ack: t("ACKS", "ACK"), check: t("CHECKS ID", "REVISA ID"), skip: t("SKIPS", "OMITE"), work: t("WORKS", "TRABAJA"),
      letter: t("MAILS", "ENVÍA CARTA"), ledger: t("WRITES", "ESCRIBE"), commit: t("COMMITS", "COMMIT"), down: t("DOWN", "CAÍDO"),
    },
  },
});
