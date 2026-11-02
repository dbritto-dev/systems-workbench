// @ts-nocheck: content ported as-is
// Systems lesson 02 · Pub/sub: a pneumatic dispatch office, a press (publisher), a hub and tubes (broker) and stations.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, P, GEOMETRY } from "./figure";
import { experimentResults } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran them in
// the browser on click; they are seeded, so the numbers are the same).
const RESULTS = experimentResults();

const EXPERIMENTS = [
  {
    id: "fanout",
    title: t("More subscribers", "Más suscriptores"),
    change: t("Subscribers 2 → 5 · three more stations now want every message", "Suscriptores 2 → 5 · ahora tres estaciones más quieren cada mensaje"),
    question: t("The press now feeds five stations instead of two. How long does it spend on each message?", "Ahora la prensa alimenta cinco estaciones en lugar de dos. ¿Cuánto tiempo dedica a cada mensaje?"),
    options: [
      t("The same 1.2 s: it never waits for the stations", "Los mismos 1.2 s: nunca espera a las estaciones"),
      t("About 2.5 times longer: there are more copies to hand out", "Unas 2.5 veces más: hay más copias que repartir"),
      t("A little longer: the hub has more tubes to fill", "Un poco más: el distribuidor tiene más tubos que llenar"),
    ],
    answer: 0,
    why: t("The press only drops the capsule into the hub. Firing a copy down every tube is the broker's job, and all copies travel at once, and working through each tray is each station's job. That is the decoupling pub/sub buys: adding a subscriber costs the publisher nothing. If the press called each station itself and waited for an answer, every new station would add its whole processing time to every message.",
      "La prensa solo deja la cápsula en el distribuidor. Disparar una copia por cada tubo es trabajo del broker, y todas las copias viajan a la vez; vaciar cada bandeja es trabajo de cada estación. Ese es el desacoplamiento que te da pub/sub: sumar un suscriptor no le cuesta nada al publicador. Si la prensa llamara a cada estación y esperara la respuesta, cada estación nueva sumaría todo su tiempo de procesamiento a cada mensaje."),
    watch: { subs: 5 },
  },
  {
    id: "slow",
    title: t("A slow subscriber", "Un suscriptor lento"),
    change: t("Station C takes 2 s per card · the press still prints one every 1.2 s", "La estación C tarda 2 s por tarjeta · la prensa sigue imprimiendo una cada 1.2 s"),
    question: t("After two minutes, what has happened?", "Después de dos minutos, ¿qué pasó?"),
    options: [
      t("A and B have slowed down too: the hub waits for C", "A y B también se volvieron lentas: el distribuidor espera a C"),
      t("A and B are unaffected; C's tray keeps growing", "A y B no se ven afectadas; la bandeja de C sigue creciendo"),
      t("C has dropped cards to keep up", "C descartó tarjetas para no quedarse atrás"),
    ],
    answer: 1,
    why: t("Each subscriber has its own queue, so a slow one only hurts itself. But a queue that fills faster than it empties grows without limit: C takes 2.35 s per card while cards arrive every 1.2 s, so it falls about 25 cards behind every minute. Queue depth (consumer lag) is the number to alert on.",
      "Cada suscriptor tiene su propia cola, así que uno lento solo se perjudica a sí mismo. Pero una cola que se llena más rápido de lo que se vacía crece sin límite: C tarda 2.35 s por tarjeta mientras llegan tarjetas cada 1.2 s, así que se atrasa unas 25 tarjetas por minuto. La profundidad de la cola (retraso del consumidor, consumer lag) es la cifra con la que hay que alertar."),
    watch: { subs: 3, station: "slow" },
  },
  {
    id: "offline",
    title: t("A subscriber goes away", "Un suscriptor se desconecta"),
    change: t("Station C is offline for 20 s · its subscription is not durable", "La estación C se desconecta 20 s · su suscripción no es duradera"),
    question: t("The cards printed while C was away…", "Las tarjetas impresas mientras C no estaba…"),
    options: [
      t("Wait in C's tray until it comes back", "Esperan en la bandeja de C hasta que vuelve"),
      t("Are gone for C: it never sees them", "Se pierden para C: nunca las ve"),
      t("Go to A and B instead", "Van a A y B en su lugar"),
    ],
    answer: 1,
    why: t("A non-durable subscription exists only while its subscriber is connected; the broker has nowhere to put C's copies, so they are dropped. A durable subscription keeps the tray in place: the cards wait, and C works through the backlog when it returns, faster than new ones arrive.",
      "Una suscripción no duradera existe solo mientras su suscriptor está conectado; el broker no tiene dónde poner las copias de C, así que las descarta. Una suscripción duradera (durable subscription) mantiene la bandeja en su lugar: las tarjetas esperan, y C despacha lo pendiente (backlog) cuando vuelve, más rápido de lo que llegan las nuevas."),
    watch: { subs: 3, station: "offline", durable: false },
  },
  {
    id: "crash",
    title: t("Crash before the ack", "Caída antes del ack"),
    change: t("Stations crash 1 time in 10 after doing the work, before stamping the card", "Las estaciones se caen 1 de cada 10 veces después de hacer el trabajo, antes de sellar la tarjeta"),
    question: t("Over 100 messages, how many times does station A's handler run?", "Con 100 mensajes, ¿cuántas veces corre el handler de la estación A?"),
    options: [
      t("Exactly 100: the broker knows the work was done", "Exactamente 100: el broker sabe que el trabajo se hizo"),
      t("About 110: some messages are handled twice", "Unas 110: algunos mensajes se procesan dos veces"),
      t("About 90: the crashed messages are lost", "Unas 90: los mensajes de las caídas se pierden"),
    ],
    answer: 1,
    why: t("The broker only knows a card is done when it sees the stamp (the ack). A crash after the work but before the ack looks exactly like a crash before the work, so the broker hands the card out again. That is at-least-once delivery: nothing is lost, but some messages arrive twice. An idempotent handler, one that checks whether it has already applied a message, turns those duplicates into no-ops.",
      "El broker solo sabe que una tarjeta está lista cuando ve el sello (el ack). Una caída después del trabajo pero antes del ack se ve igual que una caída antes del trabajo, así que el broker vuelve a entregar la tarjeta. Eso es entrega al menos una vez (at-least-once): no se pierde nada, pero algunos mensajes llegan dos veces. Un handler idempotente, uno que revisa si ya aplicó un mensaje, convierte esos duplicados en operaciones sin efecto."),
    watch: { subs: 3, crash: 0.1, idempotent: false },
  },
  {
    id: "shared",
    title: t("One queue, two workers", "Una cola, dos workers"),
    change: t("A and B read from one shared queue instead of each having a subscription", "A y B leen de una cola compartida en lugar de tener cada una su suscripción"),
    question: t("Of 100 messages, how many does each of A and B get?", "De 100 mensajes, ¿cuántos recibe cada una, A y B?"),
    options: [
      t("All 100 each, like before", "Los 100 cada una, como antes"),
      t("About 50 each", "Unos 50 cada una"),
      t("All 100 go to A; B only gets cards if A fails", "Los 100 van a A; B solo recibe tarjetas si A falla"),
    ],
    answer: 1,
    why: t("Two subscriptions mean two copies: each subscriber gets everything (fan-out). Two workers on one queue are competing consumers: each card goes to exactly one of them, so they share the work. Same broker, different shape: pub/sub for \"everyone who cares should know\", a work queue for \"someone should do this\".",
      "Dos suscripciones significan dos copias: cada suscriptor recibe todo (difusión, fan-out). Dos workers sobre una cola son consumidores en competencia (competing consumers): cada tarjeta va exactamente a uno de ellos, así que se reparten el trabajo. Mismo broker, otra forma: pub/sub para \"todos a los que les importa deben enterarse\", una cola de trabajo para \"alguien tiene que hacer esto\"."),
    watch: { subs: 3, shared: true },
  },
];

const QUESTIONS = [
  [t("The press never waits for the stations. What does it give up in exchange?", "La prensa nunca espera a las estaciones. ¿A qué renuncia a cambio?"),
    t("It no longer knows whether, when or how a subscriber handled the message: no return value and no error comes back to it. Failures show up downstream, so you need to watch consumer lag and dead letters, and accept that the system is only eventually consistent.",
      "Ya no sabe si un suscriptor procesó el mensaje, ni cuándo ni cómo: no le vuelve ningún valor de retorno ni ningún error. Las fallas aparecen más adelante en el flujo, así que tienes que vigilar el retraso del consumidor (consumer lag) y los mensajes muertos (dead letters), y aceptar que el sistema solo es consistente eventualmente (eventual consistency).")],
  [t("Station C's tray keeps growing. What would you look at, and what are three ways out?", "La bandeja de la estación C sigue creciendo. ¿Qué mirarías, y cuáles son tres salidas?"),
    t("Look at queue depth or consumer lag over time and C's processing time per message. Ways out: add competing consumers on C's queue, make each message cheaper (batching, fewer round trips), or bound the queue with a policy (drop, dead-letter, or slow the publisher down with backpressure).",
      "Mira la profundidad de la cola o el retraso del consumidor a lo largo del tiempo, y el tiempo de procesamiento de C por mensaje. Salidas: sumar consumidores en competencia a la cola de C, hacer cada mensaje más barato (lotes, menos idas y vueltas) o limitar la cola con una política (descartar, mandar a la cola de mensajes muertos o frenar al publicador con contrapresión, backpressure).")],
  [t("When would you choose a non-durable subscription on purpose?", "¿Cuándo elegirías a propósito una suscripción no duradera?"),
    t("When old messages are worthless to a subscriber that was away: live positions, presence, prices, a dashboard that refreshes anyway. It is cheaper and can't build up a backlog. Anything that must not be missed, like orders or payments, needs a durable subscription.",
      "Cuando los mensajes viejos no le sirven de nada a un suscriptor que no estaba: posiciones en vivo, presencia, precios, un tablero que se refresca de todos modos. Es más barata y no puede acumular pendientes. Todo lo que no se puede perder, como pedidos o pagos, necesita una suscripción duradera.")],
  [t("Your payment handler reads from an at-least-once queue. How do you make sure a customer is charged once?", "Tu handler de pagos lee de una cola al menos una vez (at-least-once). ¿Cómo te aseguras de cobrarle una sola vez al cliente?"),
    t("Make the handler idempotent: give every message an id, record processed ids (a unique constraint in the same transaction as the charge), and skip ids already seen. Pass an idempotency key to the payment provider too, so a retry on their side can't double-charge.",
      "Haz que el handler sea idempotente: dale a cada mensaje un id, registra los ids procesados (una restricción única en la misma transacción que el cobro) y salta los ids que ya viste. Pásale también una clave de idempotencia (idempotency key) al proveedor de pagos, para que un reintento de su lado no cobre dos veces.")],
  [t("Why is exactly-once delivery so hard, and what do teams do instead?", "¿Por qué es tan difícil la entrega exactamente una vez (exactly-once), y qué hacen los equipos en su lugar?"),
    t("Because the ack can be lost after the work is done, and the broker can't tell that apart from a crash before the work. So it must either redeliver (risking duplicates) or not (risking loss). Teams pick at-least-once delivery plus idempotent handlers, which gives exactly-once effects.",
      "Porque el ack se puede perder después de hecho el trabajo, y el broker no puede distinguir eso de una caída antes del trabajo. Así que tiene que volver a entregar (con riesgo de duplicados) o no hacerlo (con riesgo de pérdida). Los equipos eligen entrega al menos una vez más handlers idempotentes, lo que da efectos exactamente una vez.")],
  [t("Give a real example of pub/sub and one of a work queue from a system you know.", "Da un ejemplo real de pub/sub y otro de cola de trabajo de un sistema que conozcas."),
    t("Pub/sub: \"order placed\" goes to email, analytics and inventory, each of which needs every order. Work queue: thumbnails to generate or emails to send, where any one worker can do each job and adding workers adds throughput.",
      "Pub/sub: \"pedido realizado\" va a correo, analítica e inventario, y cada uno necesita todos los pedidos. Cola de trabajo: miniaturas por generar o correos por enviar, donde cualquier worker puede hacer cada tarea y sumar workers aumenta el rendimiento (throughput).")],
];

export default defineLesson({
  title: t("Pub/Sub Workbench", "Banco de trabajo: pub/sub"),
  eyebrow: t("Systems lesson 02 · Pub/sub", "Lección de sistemas 02 · Pub/sub"),
  lede: t("Publish/subscribe lets one part of a system announce something without knowing who listens. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Publicar/suscribir (publish/subscribe) permite que una parte de un sistema anuncie algo sin saber quién escucha. Esta lección arma esa idea de tres maneras: mira una máquina hacerlo, predice qué la rompe y luego explícalo con tus palabras."),
  machine: {
    intro: t("The press is the publisher, the hub and its tubes are the broker, and each station is a subscriber with its own tray. Watch a few messages go out, then change the settings below and see what the counters and trays do.",
      "La prensa es el publicador, el distribuidor y sus tubos son el broker, y cada estación es un suscriptor con su propia bandeja. Mira salir algunos mensajes, luego cambia los ajustes de abajo y observa qué hacen los contadores y las bandejas."),
    plate: {
      title: t("Dispatch office", "Oficina de despacho"),
      keys: [
        { mark: "lit", label: t("The message being published", "El mensaje que se está publicando") },
        { mark: "raised", label: t("Stations A to E: subscribers, each with its own tray (queue)", "Estaciones A a E: suscriptores, cada uno con su bandeja (cola)") },
        { mark: "flat", label: t("Press: the publisher · hub and tubes: the broker", "Prensa: el publicador · distribuidor y tubos: el broker") },
      ],
      caption: t(
        "The press prints a message every 1.2 s and sends it down one tube to the hub, then goes straight back to printing. The hub fires a copy down every connected tube at the same moment, so five subscribers get their copy as soon as two would. Each station takes the next card from its own tray, works on it and stamps it to acknowledge it; its lamp blinks on every ack. Cards waiting in a tray are that subscriber's backlog. A station that is away without a durable subscription has no tray: its copies fall into the bin.",
        "La prensa imprime un mensaje cada 1.2 s y lo manda por un tubo al distribuidor, y vuelve de inmediato a imprimir. El distribuidor dispara una copia por cada tubo conectado al mismo tiempo, así que cinco suscriptores reciben su copia tan rápido como dos. Cada estación toma la siguiente tarjeta de su bandeja, la procesa y la sella para confirmarla (ack); su lámpara parpadea con cada ack. Las tarjetas que esperan en una bandeja son lo pendiente (backlog) de ese suscriptor. Una estación desconectada sin suscripción duradera no tiene bandeja: sus copias caen al cesto."),
      stage: { "data-office": "" },
      label: t("Dispatch office simulation. Space pauses or resumes.", "Simulación de la oficina de despacho. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["published", t("Published", "Publicados")], ["delivered", t("Copies", "Copias")], ["handled", t("Handled", "Procesados")], ["lost", t("Lost", "Perdidos")], ["dupes", t("Done twice", "Dos veces")], ["backlog", t("Max backlog", "Máx. pendientes")]],
    controls: [
      { seg: "subs", label: t("Subscribers", "Suscriptores"), options: [[2, "2"], [3, "3"], [5, "5"]], value: 3 },
      { seg: "station", label: t("Station C", "Estación C"), options: [["normal", t("Normal", "Normal")], ["slow", t("Slow", "Lenta")], ["offline", t("Offline", "Desconectada")]], value: "normal" },
      { seg: "durable", label: t("Subscriptions", "Suscripciones"), options: [["true", t("Durable", "Duraderas")], ["false", t("Not durable", "No duraderas")]], value: "true" },
      { seg: "crash", label: t("Crash before ack", "Caída antes del ack"), options: [[0, t("Never", "Nunca")], [0.1, t("1 in 10", "1 de 10")]], value: 0 },
      { seg: "idempotent", label: t("Handlers", "Handlers"), options: [["false", t("Plain", "Simples")], ["true", t("Idempotent", "Idempotentes")]], value: "false" },
      { seg: "shared", label: t("A and B", "A y B"), options: [["false", t("Own subscriptions", "Suscripciones propias")], ["true", t("Share one queue", "Comparten una cola")]], value: "false" },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from two simulated minutes of the same machine (100 messages), averaged over six runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados salen de dos minutos simulados de la misma máquina (100 mensajes), promediados en seis corridas."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  data: {
    P,
    G: GEOMETRY,
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
