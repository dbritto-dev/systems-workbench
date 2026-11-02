// Systems lesson 02 · Pub/sub. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, actions, inlineModule, speedSeg, t } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
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

// ---------- page ----------
const figure = figurePlate({
  title: t("Dispatch office", "Oficina de despacho"),
  keys: [
    { mark: "lit", label: t("The message being published", "El mensaje que se está publicando") },
    { mark: "raised", label: t("Stations A to E: subscribers, each with its own tray (queue)", "Estaciones A a E: suscriptores, cada uno con su bandeja (cola)") },
    { mark: "flat", label: t("Press: the publisher · hub and tubes: the broker", "Prensa: el publicador · distribuidor y tubos: el broker") },
  ],
  caption: t(
    "The press prints a message every 1.2 s and sends it down one tube to the hub, then goes straight back to printing. The hub fires a copy down every connected tube at the same moment, so five subscribers get their copy as soon as two would. Each station takes the next card from its own tray, works on it and stamps it to acknowledge it; its lamp blinks on every ack. Cards waiting in a tray are that subscriber's backlog. A station that is away without a durable subscription has no tray: its copies fall into the bin.",
    "La prensa imprime un mensaje cada 1.2 s y lo manda por un tubo al distribuidor, y vuelve de inmediato a imprimir. El distribuidor dispara una copia por cada tubo conectado al mismo tiempo, así que cinco suscriptores reciben su copia tan rápido como dos. Cada estación toma la siguiente tarjeta de su bandeja, la procesa y la sella para confirmarla (ack); su lámpara parpadea con cada ack. Las tarjetas que esperan en una bandeja son lo pendiente (backlog) de ese suscriptor. Una estación desconectada sin suscripción duradera no tiene bandeja: sus copias caen al cesto."),
  stage: "data-office",
  stageLabel: t("Dispatch office simulation. Space pauses or resumes.", "Simulación de la oficina de despacho. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const controls = panel({
  stats: [["published", t("Published", "Publicados")], ["delivered", t("Copies", "Copias")], ["handled", t("Handled", "Procesados")], ["lost", t("Lost", "Perdidos")], ["dupes", t("Done twice", "Dos veces")], ["backlog", t("Max backlog", "Máx. pendientes")]],
  controls: [
    seg("subs", t("Subscribers", "Suscriptores"), [[2, "2"], [3, "3"], [5, "5"]], 3),
    seg("station", t("Station C", "Estación C"), [["normal", t("Normal", "Normal")], ["slow", t("Slow", "Lenta")], ["offline", t("Offline", "Desconectada")]], "normal"),
    seg("durable", t("Subscriptions", "Suscripciones"), [["true", t("Durable", "Duraderas")], ["false", t("Not durable", "No duraderas")]], "true"),
    seg("crash", t("Crash before ack", "Caída antes del ack"), [[0, t("Never", "Nunca")], [0.1, t("1 in 10", "1 de 10")]], 0),
    seg("idempotent", t("Handlers", "Handlers"), [["false", t("Plain", "Simples")], ["true", t("Idempotent", "Idempotentes")]], "false"),
    seg("shared", t("A and B", "A y B"), [["false", t("Own subscriptions", "Suscripciones propias")], ["true", t("Share one queue", "Comparten una cola")]], "false"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
});

// Figure-specific styles.
const css = `
.slot [data-lift]{transition:opacity .35s var(--anatomy-ease)}
.slot[data-empty] [data-lift]{opacity:0}
.ttl-fill{fill:var(--anatomy-mid);stroke:none}
.cover{display:none}
.cover[data-on]{display:inline}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const LETTER = "ABCDE";

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const platenEl = q("[data-platen]"), pubcard = q("[data-pubcard]"), pubcap = q("[data-pubcap]"), rotor = q("[data-rotor]");
const tubeEls = STATION_X.map((_, i) => q('[data-tube="' + i + '"]'));
const capEls = tubeEls.map((el) => [el.querySelector("[data-cap0]"), el.querySelector("[data-cap1]")]);
const portCaps = STATION_X.map((_, i) => q('[data-port="' + i + '"] [data-cap]'));
const recvEls = STATION_X.map((_, i) => q('[data-recv="' + i + '"]'));
const binEls = STATION_X.map((_, i) => q('[data-tray="' + i + '"] + [data-bin]'));
const anchorBed = q('[data-anchor="bed"]'), anchorTop = q('[data-anchor="top"]');
const stationEls = STATION_X.map((_, i) => q('[data-station="' + i + '"]'));
const topEls = STATION_X.map((_, i) => q('[data-top="' + i + '"]'));
const workEls = topEls.map((el) => el.querySelector("[data-work]"));
const stampEls = topEls.map((el) => el.querySelector("[data-stamp]"));
const lampEls = topEls.map((el) => el.querySelector("[data-lamp] .iso-solid"));
const coverEls = topEls.map((el) => el.querySelector("[data-cover]"));
const trayEls = STATION_X.map((_, i) => q('[data-tray="' + i + '"]'));
const stackEls = trayEls.map((el) => [...el.querySelectorAll("[data-card]")]);
const dropEls = STATION_X.map((_, i) => q('[data-drop="' + i + '"]'));

const cfg = { subs: 3, slow: false, offline: false, durable: true, crash: 0, idempotent: false, shared: false };
let speed = 1;
let m = fresh();
let drops = new Array(STATIONS).fill(null);
const lens = G.ROUTES.map(lengthOf), pubLen = lengthOf(G.PUB_ROUTE);
let note = null;
function fresh() { const model = createModel({ ...cfg }, (Date.now() % 1e6) + 1); model.log = []; if (cfg.offline) setOffline(model, true); return model; }

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// T is the timing table here, so bilingual messages use B(en, es). The last one is kept for a language switch.
const B = WB.T, L = WB.L;
let last = null;
const say = (msg) => { last = msg; const text = L(msg); if (readout.textContent !== text) readout.textContent = text; };
const place = (el, p, opacity = 1) => { el.setAttribute("transform", translateAlong(P, p)); el.style.opacity = String(opacity); };
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const trayVisible = (i) => active(m, i) && !(m.cfg.shared && i === 1) && (m.stations[i].online || m.cfg.durable);
const stackTop = (n) => G.TRAY_FLOOR + Math.min(n, G.TRAY_MAX - 1) * G.TRAY_STEP;
function lengthOf(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); return s; }
function along(pts, total, share) {
  let left = Math.max(0, Math.min(1, share)) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (left <= d || i === pts.length - 1) return lerp3(a, b, d ? Math.min(1, left / d) : 0);
    left -= d;
  }
  return pts[pts.length - 1];
}
const tubeOn = (i) => active(m, i) && !(m.cfg.shared && i === 1);
// Phases of one message in flight: press tube, hub, then every station tube at once.
const PUB_SHARE = 0.3, HUB_SHARE = 0.08;

function events() {
  for (const e of m.log) {
    if (e.type === "drop") drops[e.q] = { t0: m.t, bin: false };
    if (e.type === "lost") drops[e.q] = { t0: m.t, bin: true };
    if (e.type === "publish" && (!note || m.t > note.until)) {
      const copies = STATION_X.filter((_, q) => subscribed(m, q)).length;
      say(B("message #" + e.id + " · " + copies + (copies === 1 ? " copy" : " copies"), "mensaje #" + e.id + " · " + copies + (copies === 1 ? " copia" : " copias")));
    }
    if (e.type === "lost") note = { until: m.t + 1.5 }, say(B(LETTER[e.q] + " is offline · #" + e.id + " lost for it", LETTER[e.q] + " está desconectada · #" + e.id + " perdido para ella"));
    if (e.type === "dropped") note = { until: m.t + 1.5 }, say(B(LETTER[e.q] + " unsubscribed · " + e.n + " waiting cards dropped", LETTER[e.q] + " canceló la suscripción · " + e.n + " tarjetas en espera descartadas"));
    if (e.type === "crash") note = { until: m.t + 1.5 }, say(B(LETTER[e.i] + " crashed before the ack · #" + e.id + " goes back", LETTER[e.i] + " se cayó antes del ack · #" + e.id + " vuelve a la cola"));
    if (e.type === "duplicate") note = { until: m.t + 1.5 }, say(m.cfg.idempotent
      ? B(LETTER[e.i] + " handled #" + e.id + " again · no effect", LETTER[e.i] + " procesó #" + e.id + " otra vez · sin efecto")
      : B(LETTER[e.i] + " handled #" + e.id + " again · effect applied twice", LETTER[e.i] + " procesó #" + e.id + " otra vez · efecto aplicado dos veces"));
  }
  m.log.length = 0;
}

function paint() {
  // Press and published card.
  const pressP = m.press ? m.press.t / T.press : 0;
  platenEl.setAttribute("transform", translateAlong(P, [0, 0, -G.PLATEN_DROP * Math.sin(Math.PI * pressP)]));
  if (m.press) { if (pubcard.parentNode !== anchorBed) anchorBed.appendChild(pubcard); place(pubcard, G.BED_CARD, clamp01(pressP * 3) * (pressP > 0.8 ? (1 - pressP) / 0.2 : 1)); }
  else pubcard.style.opacity = "0";
  // Messages in flight: one capsule down the press tube, a short spin in the hub, then one copy down every tube at once.
  pubcap.style.opacity = "0";
  capEls.forEach((pair) => pair.forEach((el) => (el.style.opacity = "0")));
  let spin = null;
  m.inflight.forEach((f, n) => {
    const p = f.t / T.tube;
    if (p < PUB_SHARE) place(pubcap, along(G.PUB_ROUTE, pubLen, ease(p / PUB_SHARE)));
    else if (p < PUB_SHARE + HUB_SHARE) spin = (p - PUB_SHARE) / HUB_SHARE;
    else {
      const share = ease((p - PUB_SHARE - HUB_SHARE) / (1 - PUB_SHARE - HUB_SHARE));
      for (let i = 0; i < STATIONS; i++) if (tubeOn(i)) place(capEls[i][n % 2], along(G.ROUTES[i], lens[i], share));
    }
  });
  const ang = (spin === null ? 0 : spin) * Math.PI * 2, H = G.HUB;
  rotor.innerHTML = '<path class="iso-line" data-tone="' + (spin === null ? "mid" : "lit") + '" d="' + lineOnTop([H.x, H.y], [H.x + Math.cos(ang) * H.r, H.y + Math.sin(ang) * H.r], H.z, P) + '" style="stroke-width:1.1"/>';
  // Trays and drops.
  for (let i = 0; i < STATIONS; i++) {
    show(stationEls[i], active(m, i)); show(topEls[i], active(m, i));
    const tv = trayVisible(i); show(trayEls[i], tv);
    const on = tubeOn(i); show(tubeEls[i], on); show(portCaps[i], !on); show(recvEls[i], on);
    show(binEls[i], on && !tv);
    const d = drops[i]; const dp = d ? (m.t - d.t0) / 0.3 : 1;
    const dropping = d && dp < 1 && (d.bin || tv);
    const n = Math.max(0, m.queues[i].length - (dropping && !d.bin ? 1 : 0));
    stackEls[i].forEach((el, k) => show(el, k < Math.min(n, G.TRAY_MAX)));
    if (dropping) {
      // The capsule pops out of the receiver and the card lands in the tray (or the bin, where it is lost).
      const from = G.RECV_TOP[i], up = [from[0], from[1], from[2] + 7];
      const to = d.bin ? [STATION_X[i], G.TRAY_CARD_Y, 7] : [STATION_X[i], G.TRAY_CARD_Y, stackTop(n)];
      const pos = dp < 0.35 ? lerp3(from, up, ease(dp / 0.35)) : lerp3(up, to, ease((dp - 0.35) / 0.65));
      place(dropEls[i], pos, d.bin ? Math.min(1, (1 - dp) * 2.5) : 1);
    } else { dropEls[i].style.opacity = "0"; drops[i] = null; }
    // Station.
    const s = m.stations[i], b = s.busy, cx = STATION_X[i];
    show(coverEls[i], !s.online);
    const pad = [cx, G.PAD_Y, G.PAD_Z];
    let stampDrop = 0, lampOn = false;
    if (!b) workEls[i].style.opacity = "0";
    else {
      const p = clamp01(b.t / b.dur);
      const tray = [STATION_X[b.q], G.TRAY_CARD_Y, stackTop(m.queues[b.q].length)];
      if (b.phase === "take") place(workEls[i], lerp3(tray, pad, ease(p)));
      else if (b.phase === "work") { place(workEls[i], pad); stampDrop = G.STAMP_DROP * ease(clamp01((p - 0.55) / 0.45)); }
      else if (b.phase === "ack") { place(workEls[i], [cx + 14 * ease(p), G.PAD_Y, G.PAD_Z], 1 - p); stampDrop = G.STAMP_DROP * (1 - ease(p)); lampOn = true; }
      else if (b.phase === "crash") { place(workEls[i], lerp3(pad, tray, ease(p))); stampDrop = G.STAMP_DROP * (1 - ease(p)) * 0.4; }
    }
    stampEls[i].setAttribute("transform", stampDrop ? translateAlong(P, [0, 0, -stampDrop]) : "");
    lampEls[i].toggleAttribute("data-lit", lampOn);
  }
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  const sum = (f) => m.stations.reduce((a, s) => a + f(s), 0);
  statEls.published.textContent = m.published;
  statEls.delivered.textContent = sum((s) => s.delivered);
  statEls.handled.textContent = sum((s) => s.handled);
  statEls.lost.textContent = sum((s) => s.lost);
  statEls.dupes.textContent = sum((s) => s.effects - s.seen.size);
  statEls.backlog.textContent = Math.max(...m.queues.map((qq) => qq.length));
}

function advance(dt) { let left = dt; while (left > 1e-9) { const d = Math.min(0.02, left); step(m, d); left -= d; } }

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); events(); paint(); showStats(); }, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(B("paused", "en pausa")); } });
// The language switch: relabel the pause button and redraw the readout, even while paused.
WB.onLang(() => { pauseBtn.textContent = clock.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (last) say(last); });
clock.setPaused(clock.paused);
const pressSeg = WB.pressSeg;
function set(name, raw) {
  if (name === "subs") {
    cfg.subs = m.cfg.subs = Number(raw);
    for (let i = cfg.subs; i < STATIONS; i++) { m.queues[i].length = 0; m.stations[i].busy = null; }
  }
  if (name === "station") {
    cfg.slow = m.cfg.slow = raw === "slow";
    cfg.offline = raw === "offline";
    if (cfg.offline !== !m.stations[OFFLINE_STATION].online) setOffline(m, cfg.offline);
  }
  if (name === "durable") { cfg.durable = raw === "true" || raw === true; setDurable(m, cfg.durable); }
  if (name === "crash") cfg.crash = m.cfg.crash = Number(raw);
  if (name === "idempotent") cfg.idempotent = m.cfg.idempotent = raw === "true" || raw === true;
  if (name === "shared") {
    cfg.shared = m.cfg.shared = raw === "true" || raw === true;
    if (cfg.shared) { m.queues[0].push(...m.queues[1]); m.queues[1].length = 0; }
  }
  if (name === "speed") speed = Number(raw);
  pressSeg(name, raw);
}
function restart() { m = fresh(); drops = new Array(STATIONS).fill(null); note = null; paint(); showStats(); say(B("starting", "empezando")); }
const DEFAULTS = { subs: 3, station: "normal", durable: "true", crash: 0, idempotent: "false", shared: "false" };
WB.onSegments(set);
document.querySelector('[data-act="reset"]').addEventListener("click", restart);
pauseBtn.addEventListener("click", () => clock.setPaused(!clock.paused));
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.setPaused(!clock.paused); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const secs = (x) => x.toFixed(2) + " s";
const num = (x) => String(Math.round(x));
const RUN = { seconds: 120 };
const offlineWindow = [{ at: 30, run: (mm) => setOffline(mm, true) }, { at: 50, run: (mm) => setOffline(mm, false) }];
function catchUp() {
  let total = 0;
  for (const seed of [3, 5, 7]) {
    const mm = createModel({ subs: 3, durable: true }, seed);
    while (mm.t < 30) step(mm, 0.02);
    setOffline(mm, true); while (mm.t < 50) step(mm, 0.02);
    setOffline(mm, false); while (mm.queues[2].length > 1 && mm.t < 300) step(mm, 0.02);
    total += mm.t - 50;
  }
  return total / 3;
}
const RUNS = {
  fanout: () => {
    const two = averageOf({ subs: 2 }, RUN, (mm) => mm.t / mm.published), five = averageOf({ subs: 5 }, RUN, (mm) => mm.t / mm.published), direct = directCallTime(5), top = direct * 1.05;
    return {
      verdict: B("With 2 or 5 subscribers the press spends " + secs(two) + " per message either way. Calling 5 stations directly and waiting would take " + secs(direct) + ".",
        "Con 2 o 5 suscriptores la prensa dedica " + secs(two) + " por mensaje en ambos casos. Llamar directamente a 5 estaciones y esperar tomaría " + secs(direct) + "."),
      bars: [[B("Pub/sub, 2 subs", "Pub/sub, 2 susc."), two / top, secs(two)], [B("Pub/sub, 5 subs", "Pub/sub, 5 susc."), five / top, secs(five), true], [B("Direct calls, 5", "Llamadas directas, 5"), direct / top, secs(direct)]] };
  },
  slow: () => {
    const fast = averageOf({ subs: 3 }, RUN, (mm) => ({ a: meanOf(mm.stations[0].delays), c: mm.queues[2].length }));
    const slow = averageOf({ subs: 3, slow: true }, RUN, (mm) => ({ a: meanOf(mm.stations[0].delays), c: mm.queues[2].length }));
    const dTop = Math.max(fast.a, slow.a) * 1.25;
    const cards = (n) => B(num(n) + " cards", num(n) + " tarjetas");
    return {
      verdict: B("A still finishes each message " + secs(slow.a) + " after it is printed, the same as before. After 100 messages C has " + num(slow.c) + " cards waiting, and the pile grows by about 25 a minute.",
        "A sigue terminando cada mensaje " + secs(slow.a) + " después de impreso, igual que antes. Tras 100 mensajes C tiene " + num(slow.c) + " tarjetas esperando, y la pila crece unas 25 por minuto."),
      bars: [[B("A's delay, C normal", "Demora de A, C normal"), fast.a / dTop, secs(fast.a)], [B("A's delay, C slow", "Demora de A, C lenta"), slow.a / dTop, secs(slow.a), true], [B("C's backlog, normal", "Pendientes de C, normal"), fast.c / 100, cards(fast.c)], [B("C's backlog, slow", "Pendientes de C, lenta"), slow.c / 100, cards(slow.c), true]] };
  },
  offline: () => {
    const nd = averageOf({ subs: 3, durable: false }, { ...RUN, events: offlineWindow }, (mm) => ({ lost: mm.stations[2].lost, peak: mm.stations[2].maxBacklog }));
    const du = averageOf({ subs: 3, durable: true }, { ...RUN, events: offlineWindow }, (mm) => ({ lost: mm.stations[2].lost, peak: mm.stations[2].maxBacklog }));
    const top = Math.max(nd.lost, du.peak) * 1.15, back = catchUp();
    return {
      verdict: B("Without a durable subscription C lost " + num(nd.lost) + " messages. With one it lost " + num(du.lost) + ": " + num(du.peak) + " cards waited in its tray and C caught up about " + Math.round(back) + " s after it came back.",
        "Sin suscripción duradera C perdió " + num(nd.lost) + " mensajes. Con una perdió " + num(du.lost) + ": " + num(du.peak) + " tarjetas esperaron en su bandeja y C se puso al día unos " + Math.round(back) + " s después de volver."),
      bars: [[B("Lost, not durable", "Perdidos, no duradera"), nd.lost / top, num(nd.lost), true], [B("Lost, durable", "Perdidos, duradera"), du.lost / top, num(du.lost)], [B("Peak tray, durable", "Bandeja máx., duradera"), du.peak / top, B(num(du.peak) + " cards", num(du.peak) + " tarjetas")]] };
  },
  crash: () => {
    const plain = averageOf({ subs: 3, crash: 0.1 }, RUN, (mm) => ({ pub: mm.stations[0].seen.size, runs: mm.stations[0].handled, effects: mm.stations[0].effects }));
    const idem = averageOf({ subs: 3, crash: 0.1, idempotent: true }, RUN, (mm) => ({ effects: mm.stations[0].effects }));
    const top = plain.runs * 1.08;
    return {
      verdict: B("For " + num(plain.pub) + " different messages, A's handler ran " + num(plain.runs) + " times. A plain handler applied " + num(plain.effects) + " effects; an idempotent one applied " + num(idem.effects) + ".",
        "Para " + num(plain.pub) + " mensajes distintos, el handler de A corrió " + num(plain.runs) + " veces. Un handler simple aplicó " + num(plain.effects) + " efectos; uno idempotente aplicó " + num(idem.effects) + "."),
      bars: [[B("Different messages", "Mensajes distintos"), plain.pub / top, num(plain.pub)], [B("Handler runs", "Ejecuciones del handler"), plain.runs / top, num(plain.runs), true], [B("Effects, plain", "Efectos, simple"), plain.effects / top, num(plain.effects), true], [B("Effects, idempotent", "Efectos, idempotente"), idem.effects / top, num(idem.effects)]] };
  },
  shared: () => {
    const own = averageOf({ subs: 3 }, RUN, (mm) => ({ a: mm.stations[0].done.size, b: mm.stations[1].done.size, pub: mm.published }));
    const sh = averageOf({ subs: 3, shared: true }, RUN, (mm) => ({ a: mm.stations[0].done.size, b: mm.stations[1].done.size }));
    const top = own.pub * 1.05;
    return {
      verdict: B("With their own subscriptions A and B each handled " + num(own.a) + " of " + num(own.pub) + ". Sharing one queue, A handled " + num(sh.a) + " and B " + num(sh.b) + ": each message went to exactly one of them.",
        "Con sus propias suscripciones, A y B procesaron cada una " + num(own.a) + " de " + num(own.pub) + ". Compartiendo una cola, A procesó " + num(sh.a) + " y B " + num(sh.b) + ": cada mensaje fue exactamente a una de ellas."),
      bars: [[B("Own: A", "Propia: A"), own.a / top, num(own.a)], [B("Own: B", "Propia: B"), own.b / top, num(own.b)], [B("Shared: A", "Compartida: A"), sh.a / top, num(sh.a), true], [B("Shared: B", "Compartida: B"), sh.b / top, num(sh.b), true]] };
  },
};
// Bars never draw past their track.
const CLAMPED = Object.fromEntries(Object.entries(RUNS).map(([id, run]) => [id, () => { const out = run(); out.bars = out.bars.map(([label, share, ...rest]) => [label, Math.min(1, share), ...rest]); return out; }]));
WB.experiments({ list: EXPERIMENTS, runs: CLAMPED, watch: (exp) => {
  const w = { ...DEFAULTS, ...exp.watch };
  for (const name of ["subs", "durable", "crash", "idempotent", "shared"]) set(name, String(w[name]));
  cfg.slow = cfg.offline = false;
  restart();
  set("station", w.station);
  pressSeg("station", w.station);
  if (clock.paused) clock.setPaused(false);
} });

paint(); showStats();
`;

const size = writePage(new URL("./pubsub-workbench.html", import.meta.url), {
  title: t("Pub/Sub Workbench", "Banco de trabajo: pub/sub"),
  eyebrow: t("Systems lesson 02 · Pub/sub", "Lección de sistemas 02 · Pub/sub"),
  lede: t("Publish/subscribe lets one part of a system announce something without knowing who listens. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Publicar/suscribir (publish/subscribe) permite que una parte de un sistema anuncie algo sin saber quién escucha. Esta lección arma esa idea de tres maneras: mira una máquina hacerlo, predice qué la rompe y luego explícalo con tus palabras."),
  machine: { intro: t("The press is the publisher, the hub and its tubes are the broker, and each station is a subscriber with its own tray. Watch a few messages go out, then change the settings below and see what the counters and trays do.",
    "La prensa es el publicador, el distribuidor y sus tubos son el broker, y cada estación es un suscriptor con su propia bandeja. Mira salir algunos mensajes, luego cambia los ajustes de abajo y observa qué hacen los contadores y las bandejas."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from two simulated minutes of the same machine (100 messages), averaged over six runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados salen de dos minutos simulados de la misma máquina (100 mensajes), promediados en seis corridas."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote pubsub-workbench.html", (size / 1024).toFixed(0) + " KB");
