// Systems lesson 24 · Outbox pattern. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, railLetterSvg, droppedLetterSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));
const digits = inlineModule(new URL("./digits.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "lost",
    title: t("Fail between the two writes", "Fallar entre las dos escrituras"),
    change: t("Write the ledger, then post the letter · the clerk fails on the way to the postbox for 1 order in 20 · 10 minutes of orders", "Escribir el libro y después despachar la carta · el empleado falla camino al buzón en 1 de cada 20 pedidos · 10 minutos de pedidos"),
    question: t("Every ledger write succeeds before the clerk sets off. What does the warehouse end up with?", "Cada escritura en el libro tiene éxito antes de que el empleado salga. ¿Con qué termina el almacén?"),
    options: [
      t("Every order: once the ledger has it, the order is safe", "Con todos los pedidos: una vez que está en el libro, el pedido está a salvo"),
      t("About 1 order in 20 never reaches the warehouse, and nothing reports it", "Cerca de 1 de cada 20 pedidos nunca llega al almacén, y nada lo reporta"),
      t("The ledger rolls those orders back, so the two still agree", "El libro revierte esos pedidos, así que los dos siguen coincidiendo"),
    ],
    answer: 1,
    why: t(
      "The ledger commit and the letter are two separate writes to two separate systems. When the process dies between them, the first is permanent and the second never happens. The customer was told yes, the database has the order, and the warehouse will never ship it. No error is raised anywhere, because each write that ran, worked.",
      "El commit en el libro y la carta son dos escrituras separadas en dos sistemas separados. Cuando el proceso muere entre una y otra, la primera es permanente y la segunda nunca ocurre. Al cliente se le dijo que sí, la base de datos tiene el pedido y el almacén nunca lo va a enviar. No se lanza ningún error en ninguna parte, porque cada escritura que se ejecutó funcionó.",
    ),
    watch: { mode: "dual", crash: 0.15 },
  },
  {
    id: "phantom",
    title: t("Send first, then write", "Enviar primero, escribir después"),
    change: t("Swap the order: post the letter, then write the ledger · the ledger write fails for 1 order in 20", "Invertir el orden: despachar la carta y después escribir el libro · la escritura en el libro falla en 1 de cada 20 pedidos"),
    question: t("Does sending first fix it?", "¿Enviar primero lo arregla?"),
    options: [
      t("Yes: nothing is lost and nothing extra is shipped", "Sí: no se pierde nada y no se envía nada de más"),
      t("Nothing is lost, but the warehouse ships about 1 order in 20 that the ledger never recorded", "No se pierde nada, pero el almacén envía cerca de 1 de cada 20 pedidos que el libro nunca registró"),
      t("It loses orders and ships phantom ones as well", "Pierde pedidos y además envía pedidos fantasma"),
    ],
    answer: 1,
    why: t(
      "Swapping the writes swaps the failure. The letter is already on its way when the ledger write fails, so the warehouse ships an order that, as far as your database is concerned, never happened: the customer got an error and may order again. Watch the bin fill with failed cards while SHIPPED runs ahead of ORDERS.",
      "Invertir las escrituras invierte la falla. La carta ya va en camino cuando falla la escritura en el libro, así que el almacén envía un pedido que, para tu base de datos, nunca existió: el cliente recibió un error y puede volver a pedir. Mira cómo el cesto se llena de tarjetas fallidas mientras ENVIADOS se adelanta a PEDIDOS.",
    ),
    watch: { mode: "pubfirst", crash: 0.15 },
  },
  {
    id: "outbox",
    title: t("Put the letter in the outbox", "Poner la carta en el outbox"),
    change: t("The ledger card and the letter go into the cabinet in one transaction · a relay posts pending letters and then marks them sent · clerk fails 5%, relay fails 10% after posting, before marking", "La tarjeta del libro y la carta entran al gabinete en una sola transacción · un relé (relay) despacha las cartas pendientes y después las marca como enviadas · el empleado falla 5%, el relé falla 10% después de despachar y antes de marcar"),
    question: t("What happens to lost and phantom orders now, and what new thing appears?", "¿Qué pasa ahora con los pedidos perdidos y fantasma, y qué cosa nueva aparece?"),
    options: [
      t("None lost, none phantom, but some letters reach the warehouse twice", "Ninguno perdido, ninguno fantasma, pero algunas cartas llegan dos veces al almacén"),
      t("None lost, none phantom, and every letter arrives exactly once", "Ninguno perdido, ninguno fantasma, y cada carta llega exactamente una vez"),
      t("Letters are still lost whenever the relay fails", "Se siguen perdiendo cartas cada vez que falla el relé"),
    ],
    answer: 0,
    why: t(
      "One transaction writes both rows or neither, so a failed clerk leaves no order and no letter: the customer gets an error and can retry. The relay only marks a letter sent after posting it; if it fails in between, the letter is still pending and gets posted again. That is at-least-once delivery: nothing is lost, and some letters arrive twice.",
      "Una transacción escribe las dos filas o ninguna, así que un empleado que falla no deja ni pedido ni carta: el cliente recibe un error y puede reintentar. El relé solo marca una carta como enviada después de despacharla; si falla en el medio, la carta sigue pendiente y se vuelve a despachar. Eso es entrega al menos una vez (at-least-once): no se pierde nada, y algunas cartas llegan dos veces.",
    ),
    watch: { mode: "outbox", crash: 0.05, relay: 0.3, dedupe: "on" },
  },
  {
    id: "dedupe",
    title: t("The warehouse ships every letter", "El almacén envía cada carta"),
    change: t("Outbox, relay fails 10% after posting · warehouse dedupe off vs on (it keeps the order numbers it has seen and drops repeats)", "Outbox, el relé falla 10% después de despachar · deduplicación en el almacén apagada vs. encendida (guarda los números de pedido que ya vio y descarta las repeticiones)"),
    question: t("With dedupe off, what does the warehouse do with the repeated letters?", "Con la deduplicación apagada, ¿qué hace el almacén con las cartas repetidas?"),
    options: [
      t("Nothing: the outbox guarantees each letter arrives once", "Nada: el outbox garantiza que cada carta llegue una vez"),
      t("Ships those orders twice; with dedupe on, the repeats are dropped and every order ships once", "Envía esos pedidos dos veces; con la deduplicación encendida, las repeticiones se descartan y cada pedido se envía una vez"),
      t("Loses the orders instead", "En cambio, pierde los pedidos"),
    ],
    answer: 1,
    why: t(
      "At-least-once delivery moves the problem to the consumer: it must be idempotent. Keep the IDs of events you have handled (or make the handler an upsert keyed by the order), and a second copy changes nothing. The outbox and an idempotent consumer together give the effect of exactly-once.",
      "La entrega al menos una vez traslada el problema al consumidor: tiene que ser idempotente. Guarda los IDs de los eventos que ya procesaste (o haz que el handler sea un upsert con el pedido como clave), y una segunda copia no cambia nada. El outbox y un consumidor idempotente juntos dan el efecto de exactamente una vez (exactly-once).",
    ),
    watch: { mode: "outbox", crash: 0, relay: 0.3, dedupe: "off" },
  },
  {
    id: "poll",
    title: t("A slower relay", "Un relé más lento"),
    change: t("Outbox, nothing fails · the relay checks the outbox every 0.5 s, 2 s or 5 s · compared with walking the letter straight over", "Outbox, nada falla · el relé revisa el outbox cada 0.5 s, 2 s o 5 s · comparado con llevar la carta directamente"),
    question: t("What does a longer poll interval cost?", "¿Qué cuesta un intervalo de sondeo (polling) más largo?"),
    options: [
      t("Letters get lost when the relay checks rarely", "Se pierden cartas cuando el relé revisa pocas veces"),
      t("Letters reach the warehouse later; nothing is lost or repeated", "Las cartas llegan más tarde al almacén; nada se pierde ni se repite"),
      t("More letters arrive twice", "Llegan más cartas dos veces"),
    ],
    answer: 1,
    why: t(
      "Each letter waits in the outbox until the next check, on average about half the interval, plus the trip. The guarantee is the same at any interval; only latency (and how often you query the database) changes. Change data capture, which tails the database's log instead of polling the table, gets the wait close to zero.",
      "Cada carta espera en el outbox hasta la próxima revisión, en promedio cerca de la mitad del intervalo, más el viaje. La garantía es la misma con cualquier intervalo; solo cambia la latencia (y cada cuánto consultas la base de datos). La captura de cambios (change data capture, CDC), que sigue el log de la base de datos en lugar de sondear la tabla, deja la espera cerca de cero.",
    ),
    watch: { mode: "outbox", crash: 0, relay: 0, dedupe: "on", poll: 5 },
  },
];

const QUESTIONS = [
  [t("A handler saves an order and then publishes an \"order placed\" event. Both calls succeed in all your tests. What can still go wrong in production?", "Un handler guarda un pedido y después publica un evento \"pedido creado\". Las dos llamadas tienen éxito en todas tus pruebas. ¿Qué puede salir mal igual en producción?"),
    t("The process can die, be redeployed or time out between the two calls. The order is committed, the event is never published, and downstream services never hear of it. Nothing errors, so it shows up later as an order that never shipped.", "El proceso puede morir, ser redesplegado o agotar su tiempo entre las dos llamadas. El pedido queda confirmado, el evento nunca se publica y los servicios que dependen de él nunca se enteran. Nada da error, así que aparece más tarde como un pedido que nunca se envió.")],
  [t("Why doesn't publishing first, then saving, fix it?", "¿Por qué publicar primero y guardar después no lo arregla?"),
    t("It flips the failure: if the save fails after the publish, consumers act on an order your database doesn't have. A phantom is often worse than a loss, because other systems have already shipped, charged or emailed.", "Invierte la falla: si el guardado falla después de publicar, los consumidores actúan sobre un pedido que tu base de datos no tiene. Un fantasma suele ser peor que una pérdida, porque otros sistemas ya enviaron, cobraron o mandaron emails.")],
  [t("How does the outbox make the two writes atomic, and what does it rely on?", "¿Cómo hace el outbox que las dos escrituras sean atómicas, y en qué se apoya?"),
    t("The event is written as a row in an outbox table in the same database transaction as the business change, so both commit or neither does. It relies on that single local transaction; a separate process then reads the outbox and publishes.", "El evento se escribe como una fila en una tabla outbox dentro de la misma transacción de base de datos que el cambio de negocio, así que se confirman las dos o ninguna. Se apoya en esa única transacción local; después, un proceso aparte lee el outbox y publica.")],
  [t("Why does the relay deliver at least once instead of exactly once, and what does that ask of consumers?", "¿Por qué el relé entrega al menos una vez en lugar de exactamente una vez, y qué les pide eso a los consumidores?"),
    t("It can only mark a row sent after the broker accepts it; if it crashes in between, it publishes the row again on restart. Consumers must be idempotent: dedupe by event ID, or make the effect an upsert keyed by the business ID.", "Solo puede marcar una fila como enviada después de que el broker la acepta; si se cae en el medio, vuelve a publicar la fila al reiniciar. Los consumidores tienen que ser idempotentes: deduplicar por ID de evento, o hacer que el efecto sea un upsert con el ID de negocio como clave.")],
  [t("Polling the outbox table or change data capture (reading the database log, for example with Debezium): what is the trade-off?", "Sondear la tabla outbox (polling) o captura de cambios (change data capture: leer el log de la base de datos, por ejemplo con Debezium): ¿cuál es el compromiso?"),
    t("Polling is simple and works anywhere, but adds latency (about half the interval) and query load. CDC publishes within milliseconds and doesn't query the table, but needs log access, a connector to run and operate, and care with schema changes.", "El sondeo es simple y funciona en cualquier lado, pero agrega latencia (cerca de la mitad del intervalo) y carga de consultas. CDC publica en milisegundos y no consulta la tabla, pero necesita acceso al log, un conector que correr y operar, y cuidado con los cambios de esquema.")],
  [t("How do you keep events for one order in order, and what happens to the outbox table over time?", "¿Cómo mantienes en orden los eventos de un pedido, y qué pasa con la tabla outbox con el tiempo?"),
    t("Publish rows in commit order per aggregate and use the order ID as the partition key, so one partition (and one consumer) sees them in sequence; don't publish one aggregate's rows in parallel. Sent rows are deleted or archived on a schedule, or the table grows forever.", "Publica las filas en orden de commit por agregado y usa el ID del pedido como clave de partición, así una partición (y un consumidor) las ve en secuencia; no publiques en paralelo las filas de un mismo agregado. Las filas enviadas se borran o archivan periódicamente, o la tabla crece para siempre.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Order office", "Oficina de pedidos"),
  keys: [
    { mark: "lit", label: t("A letter on its way: in a hand, on the rail, or the relay's bundle; the newest card or number", "Una carta en camino: en una mano, en el riel o en el paquete del relé; la tarjeta o el número más reciente") },
    { mark: "raised", label: t("Counter wheels: orders in the ledger, shipped, and shipped twice or caught", "Ruedas contadoras: pedidos en el libro, enviados, y enviados dos veces o detectados") },
    { mark: "flat", label: t("The rail from the postbox to the warehouse intake", "El riel del buzón a la recepción del almacén") },
  ],
  caption: t(
    "The clerk takes orders from the in-tray. Write, then send: the clerk files the order in the ledger cabinet and walks the letter to the postbox; a fall on the way leaves the letter on the floor. Send, then write: the letter goes first, and a ledger write that fails ends in the bin. Outbox: the card and the letter go into the cabinet together, and pending letters stand in the pulled-out drawer until the relay, in a cap, carries them to the postbox at each tick of its timer and comes back to mark them sent. At the warehouse, the spike holds order numbers already seen and the tray beside it the repeats it caught. Compare ORDERS with SHIPPED.",
    "El empleado toma los pedidos de la bandeja de entrada. Escribir y después enviar: el empleado archiva el pedido en el gabinete del libro y lleva la carta al buzón; una caída en el camino deja la carta en el piso. Enviar y después escribir: la carta sale primero, y una escritura en el libro que falla termina en el cesto. Outbox: la tarjeta y la carta entran juntas al gabinete, y las cartas pendientes esperan en el cajón abierto hasta que el relé, con gorra, las lleva al buzón en cada tic de su temporizador y vuelve a marcarlas como enviadas. En el almacén, el pincho guarda los números de pedido ya vistos y la bandeja de al lado las repeticiones que detectó. Compara PEDIDOS con ENVIADOS.",
  ),
  stage: "data-office",
  stageLabel: t("Outbox pattern simulation. Space pauses or resumes.", "Simulación del patrón outbox. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t(
  "Changing a setting starts the run again. Orders arrive about once every 4 seconds.",
  "Cambiar un ajuste vuelve a empezar la corrida. Los pedidos llegan más o menos cada 4 segundos.",
))}</p>`;
const controls = panel({
  stats: [["orders", t("In the ledger", "En el libro")], ["shipped", t("Shipped", "Enviados")], ["lost", t("Lost", "Perdidos")], ["phantom", t("Phantom", "Fantasma")], ["dups", t("Shipped twice", "Envíos dobles")], ["delay", t("Typical delay", "Demora típica"), "–"]],
  controls: [
    seg("mode", t("Approach", "Enfoque"), [["dual", t("Write, then send", "Escribir, luego enviar")], ["pubfirst", t("Send, then write", "Enviar, luego escribir")], ["outbox", "Outbox"]], "dual"),
    seg("crash", t("Clerk fails", "El empleado falla"), [[0, t("Never", "Nunca")], [0.05, "5%"], [0.15, "15%"]], 0.15),
    seg("relay", t("Relay fails", "El relé falla"), [[0, t("Never", "Nunca")], [0.1, "10%"], [0.3, "30%"]], 0.1),
    seg("dedupe", t("Warehouse dedupe", "Deduplicación en almacén"), [["off", t("Off", "Apagada")], ["on", t("On", "Encendida")]], "off"),
    seg("poll", t("Relay checks every", "El relé revisa cada"), [[0.5, "0.5 s"], [2, "2 s"], [5, "5 s"]], 2),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["crash", t("Fail the next order", "Hacer fallar el próximo pedido")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.needle{stroke-width:1.6}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
${digits}
const RAIL_SVG = ${JSON.stringify(railLetterSvg())};
const DROP_SVG = ${JSON.stringify(droppedLetterSvg())};

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const { L } = WB;
const TT = WB.T;   // T is the sim's timing table

function counter(name, c) { const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
const dials = { orders: counter("orders", G.COUNTERS.orders), shipped: counter("shipped", G.COUNTERS.shipped), extra: counter("extra", G.COUNTERS.extra) };
function show(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }

function pool(layer, html, n) {
  return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; g.style.display = "none"; layer.appendChild(g); return { g, solid: g.querySelector(".iso-solid") }; });
}
const railPool = pool(q("[data-rail]"), RAIL_SVG, 16);
const dropPool = pool(q("[data-dropped]"), DROP_SVG, 12);
const toggles = (attr, n) => Array.from({ length: n }, (_, i) => { const g = q("[data-" + attr + '="' + i + '"]'); return { g, solid: g.querySelector(".iso-solid") }; });
const cards = toggles("card", G.TRAY_CARDS), slips = toggles("slip", G.INTRAY_SLIPS), binned = toggles("bin", G.BIN_CARDS), seen = toggles("seen", G.SPIKE_DISCS), rejects = toggles("reject", G.REJECT_CARDS);
const sorted = q("[data-sorted]");
const actors = Object.fromEntries(["postbox", "clerk", "relay"].map((n) => { const g = q('[data-actor="' + n + '"]'); return [n, { g, up: g.querySelector('[data-pose="up"]'), down: g.querySelector('[data-pose="down"]'), carry: g.querySelector("[data-carry]") }]; }));
const postSolid = q("[data-postbox] .iso-solid");
const commitSolid = q("[data-commit] .iso-solid");
const shipSolid = q("[data-ship] .iso-solid");
const needle = q("[data-needle]");
const timerEl = q("[data-timer]");
const drawerOpen = q('[data-drawer="open"]'), drawerClosed = q('[data-drawer="closed"]');
const dedupeEl = q("[data-dedupe]");
const extraLabels = { twice: q('[data-extra-label="twice"]'), caught: q('[data-extra-label="caught"]') };

// The rail as a polyline with cumulative lengths.
const railLen = [0]; for (let i = 1; i < G.RAIL.length; i++) railLen.push(railLen[i - 1] + Math.hypot(G.RAIL[i][0] - G.RAIL[i - 1][0], G.RAIL[i][1] - G.RAIL[i - 1][1]));
function alongRail(f) {
  const d = f * railLen[railLen.length - 1];
  for (let i = 1; i < G.RAIL.length; i++) if (d <= railLen[i]) { const u = (d - railLen[i - 1]) / (railLen[i] - railLen[i - 1]); return [G.RAIL[i - 1][0] + u * (G.RAIL[i][0] - G.RAIL[i - 1][0]), G.RAIL[i - 1][1] + u * (G.RAIL[i][1] - G.RAIL[i - 1][1])]; }
  return G.RAIL[G.RAIL.length - 1];
}
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const homeOf = { clerk: "home", relay: "rhome" };

// Where an actor stands at the clock, and whether it is down.
function placeOf(name, seg, clock) {
  const S = G.SPOTS, u = seg.t1 > seg.t0 ? Math.max(0, Math.min(1, (clock - seg.t0) / (seg.t1 - seg.t0))) : 1;
  if (seg.kind === "walk") { const reach = seg.cut != null ? seg.cut : 1; return { at: lerp(S[seg.from], S[seg.to], u * reach), down: false }; }
  if (seg.kind === "down") { const at = seg.cut != null ? lerp(S[seg.from], S[seg.to], seg.cut) : S[seg.from]; return { at, down: true }; }
  if (seg.kind === "post") return { at: S[name === "clerk" ? "post" : "rpost"], down: false };
  return { at: S[homeOf[name]], down: false };
}

const cfg = { mode: "dual", crash: 0.15, relay: 0.1, dedupe: "off", poll: 2, speed: 1 };
let model, clock, order = "";
const WARM = 58.75;           // the first run opens mid-shift, so the first frame already shows letters and losses
let first = true, seed = (Date.now() % 1e6) + 1;

function restart() {
  model = makeSim({ mode: cfg.mode, crash: cfg.crash, relayCrash: cfg.relay, dedupe: cfg.dedupe === "on", poll: cfg.poll }, first ? 1 : seed++);
  clock = first ? WARM : 0; first = false;
  model.runTo(clock);
  const outbox = cfg.mode === "outbox";
  actors.relay.g.style.display = outbox ? "" : "none";
  timerEl.style.display = outbox ? "" : "none";
  drawerOpen.style.display = outbox ? "" : "none"; drawerClosed.style.display = outbox ? "none" : "";
  dedupeEl.style.display = cfg.dedupe === "on" ? "" : "none";
  extraLabels.twice.style.display = cfg.dedupe === "on" ? "none" : ""; extraLabels.caught.style.display = cfg.dedupe === "on" ? "" : "none";
  paint();
}

function stack(list, n, litNewest) { list.forEach((t, i) => { t.g.style.display = i < n ? "" : "none"; if (t.solid) t.solid.toggleAttribute("data-lit", litNewest && i === n - 1); }); }

function paint() {
  const f = model.flashes, st = model.stats;
  // People and the postbox, drawn back to front.
  const spots = { postbox: G.POSTBOX };
  for (const name of ["clerk", "relay"]) {
    const a = actors[name], seg = (name === "clerk" ? model.clerk : model.relay).seg, p = placeOf(name, seg, clock);
    spots[name] = p.at;
    a.g.setAttribute("transform", translateAlong(P, [p.at[0], p.at[1], 0]));
    a.up.style.display = p.down ? "none" : ""; a.down.style.display = p.down ? "" : "none";
    const carrying = name === "clerk" ? model.clerk.carrying && !p.down : (seg.kind === "walk" && seg.to === "rpost") || seg.kind === "post";
    a.carry.style.display = carrying ? "" : "none";
  }
  const want = ["postbox", "clerk", "relay"].sort((m, n) => depthOf([...spots[m], 0], P) - depthOf([...spots[n], 0], P)).join();
  if (want !== order) { order = want; want.split(",").forEach((n) => sorted.appendChild(actors[n].g)); }

  // Letters on the rail and on the floor.
  const onRail = model.rail.filter((l) => l.t0 <= clock && l.t1 > clock);
  railPool.forEach((p, i) => {
    const l = onRail[i];
    if (!l) { p.g.style.display = "none"; return; }
    const [x, y] = alongRail((clock - l.t0) / (l.t1 - l.t0));
    p.g.style.display = ""; p.g.setAttribute("transform", translateAlong(P, [x, y, 0]));
  });
  const drops = model.dropped.filter((d) => d.t <= clock).slice(-dropPool.length);
  dropPool.forEach((p, i) => {
    const d = drops[i];
    if (!d) { p.g.style.display = "none"; return; }
    // beside the path, on the side nearer the viewer, so a passing clerk never hides them
    const [x, y] = lerp(G.SPOTS.home, G.SPOTS.post, d.x);
    const jx = ((d.id * 37) % 7) - 3, jy = ((d.id * 53) % 5) - 2;
    p.g.style.display = ""; p.g.setAttribute("transform", translateAlong(P, [x - 7 + jx, y + 9 + jy, 0]));
  });

  // Trays, bin, spike.
  stack(slips, Math.min(G.INTRAY_SLIPS, model.inbox.length), false);
  const batch = new Set(model.relay.batch);
  cards.forEach((t, i) => { const id = model.pending[i]; t.g.style.display = id != null ? "" : "none"; t.solid.toggleAttribute("data-lit", id != null && batch.has(id)); });
  stack(binned, Math.min(G.BIN_CARDS, model.binned), clock - f.fail < 0.8);
  stack(seen, Math.min(G.SPIKE_DISCS, model.seen.size), clock - f.spike < 0.6);
  stack(rejects, Math.min(G.REJECT_CARDS, st.caught), clock - f.catch < 0.8);
  postSolid.toggleAttribute("data-lit", clock - f.post < 0.35);
  commitSolid.toggleAttribute("data-lit", clock - f.commit < 0.35);
  shipSolid.toggleAttribute("data-lit", clock - f.spike < 0.35);

  // The relay's timer: the needle sweeps once per interval while the relay waits.
  if (cfg.mode === "outbox") {
    const r = model.relay, idle = r.seg.kind === "idle";
    const u = idle ? Math.max(0, Math.min(1, 1 - (r.nextCheck - clock) / cfg.poll)) : 0;
    const a = u * Math.PI * 2, [tx, ty] = G.TIMER;
    needle.setAttribute("d", lineOnTop([tx, ty], [tx + Math.sin(a) * 5, ty - Math.cos(a) * 5], 18.2, P));
  }

  // Counters.
  show(dials.orders, st.orders); show(dials.shipped, st.shipped); show(dials.extra, cfg.dedupe === "on" ? st.caught : st.dupShipped);

  // Readout and stats.
  say(story());
  stat("orders", st.orders); stat("shipped", st.shipped); stat("lost", st.lost); stat("phantom", st.phantom);
  stat("dups", cfg.dedupe === "on" ? st.caught + L(" caught", " copias detectadas") : st.dupShipped);
  const ds = model.delays.slice(-40).sort((x, y) => x - y);
  stat("delay", ds.length ? ds[Math.floor(ds.length / 2)].toFixed(1) + " s" : "–");
}
function story() {
  const c = model.clerk.seg, r = model.relay.seg, n = model.inbox.length, p = model.pending.length;
  if (c.kind === "down" && cfg.mode === "dual") return L("clerk failed on the way · order #" + c.id + " is in the ledger, its letter is on the floor", "el empleado falló en el camino · el pedido #" + c.id + " está en el libro, su carta está en el piso");
  if (c.kind === "down" && cfg.mode === "pubfirst") return L("ledger write failed · the letter for #" + c.id + " was already sent", "falló la escritura en el libro · la carta del #" + c.id + " ya se había enviado");
  if (c.kind === "down") return L("clerk failed mid-transaction · neither card nor letter was kept", "el empleado falló a mitad de la transacción · no quedó ni la tarjeta ni la carta");
  if (r.kind === "down") return L("relay failed after posting · those letters are still pending and will go again", "el relé falló después de despachar · esas cartas siguen pendientes y van a salir de nuevo");
  if (cfg.mode === "outbox" && r.kind === "walk" && r.to === "rpost") return L("relay carrying " + r.n + " letter" + (r.n === 1 ? "" : "s") + " · " + p + " pending", "el relé lleva " + r.n + " carta" + (r.n === 1 ? "" : "s") + " · " + p + " pendiente" + (p === 1 ? "" : "s"));
  if (cfg.mode === "outbox" && r.kind === "mark") return L("relay marking letters sent", "el relé marca las cartas como enviadas");
  if (c.kind === "walk" && c.to === "post") return L("clerk walking the letter for #" + c.id + " to the postbox", "el empleado lleva la carta del #" + c.id + " al buzón");
  if (c.kind === "post") return L("clerk posting the letter for #" + c.id, "el empleado despacha la carta del #" + c.id);
  if (c.kind === "walk") return L("clerk walking back" + (n ? " · " + n + " waiting" : ""), "el empleado vuelve" + (n ? " · " + n + " en espera" : ""));
  if (c.kind === "write") return L("clerk writing order #" + c.id + (cfg.mode === "outbox" ? " and its letter, in one transaction" : " in the ledger"), "el empleado escribe el pedido #" + c.id + (cfg.mode === "outbox" ? " y su carta, en una sola transacción" : " en el libro"));
  if (cfg.mode === "outbox") return L(p + " letter" + (p === 1 ? "" : "s") + " pending in the outbox", p + " carta" + (p === 1 ? "" : "s") + " pendiente" + (p === 1 ? "" : "s") + " en el outbox");
  return n ? L(n + " order" + (n === 1 ? "" : "s") + " waiting", n + " pedido" + (n === 1 ? "" : "s") + " en espera") : L("waiting for an order", "esperando un pedido");
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(L("paused", "en pausa")); } });
WB.onLang(() => {
  pauseBtn.textContent = loop.paused ? L("Play", "Reanudar") : L("Pause", "Pausa");
  paint();
  if (loop.paused) say(L("paused", "en pausa"));
});

function set(name, raw, quiet) {
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  if (name === "mode" || name === "dedupe") cfg[name] = raw; else cfg[name] = Number(raw);
  WB.pressSeg(name, raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="crash"]').addEventListener("click", () => { model.crashNext(); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const n0 = (x) => String(Math.round(x));
const RUNS = {
  lost: () => {
    const r = runFor({ mode: "dual", crash: 0.05 });
    return { verdict: TT("The ledger took " + n0(r.orders) + " orders; the warehouse shipped " + n0(r.shipped) + ". " + one(r.lost) + " orders were committed and never shipped, and nothing reported an error.",
        "El libro recibió " + n0(r.orders) + " pedidos; el almacén envió " + n0(r.shipped) + ". " + one(r.lost) + " pedidos se confirmaron y nunca se enviaron, y nada reportó un error."),
      bars: [[TT("In the ledger", "En el libro"), 1, n0(r.orders)], [TT("Shipped", "Enviados"), r.shipped / r.orders, n0(r.shipped)], [TT("Lost", "Perdidos"), r.lost / r.orders, one(r.lost), true]] };
  },
  phantom: () => {
    const r = runFor({ mode: "pubfirst", crash: 0.05 }), top = Math.max(r.orders, r.shipped);
    return { verdict: TT("Nothing lost, but the warehouse shipped " + n0(r.shipped) + " orders against " + n0(r.orders) + " in the ledger: " + one(r.phantom) + " phantom orders whose ledger write failed after the letter had gone.",
        "No se perdió nada, pero el almacén envió " + n0(r.shipped) + " pedidos frente a " + n0(r.orders) + " en el libro: " + one(r.phantom) + " pedidos fantasma cuya escritura en el libro falló después de que la carta ya había salido."),
      bars: [[TT("In the ledger", "En el libro"), r.orders / top, n0(r.orders)], [TT("Shipped", "Enviados"), r.shipped / top, n0(r.shipped)], [TT("Phantom", "Fantasma"), r.phantom / top, one(r.phantom), true]] };
  },
  outbox: () => {
    const r = runFor({ mode: "outbox", crash: 0.05, relayCrash: 0.1, dedupe: true, poll: 2 });
    return { verdict: TT("Lost " + one(r.lost) + ", phantom " + one(r.phantom) + ". " + one(r.failed) + " orders failed as a whole (the customer got an error, nothing was kept). The relay failed " + one(r.relayCrashes) + " times and posted " + one(r.caught) + " letters a second time.",
        "Perdidos " + one(r.lost) + ", fantasma " + one(r.phantom) + ". " + one(r.failed) + " pedidos fallaron por completo (el cliente recibió un error, no quedó nada). El relé falló " + one(r.relayCrashes) + " veces y despachó " + one(r.caught) + " cartas por segunda vez."),
      bars: [[TT("Lost or phantom", "Perdidos o fantasma"), (r.lost + r.phantom) / Math.max(1, r.caught), one(r.lost + r.phantom)], [TT("Letters that arrived twice", "Cartas que llegaron dos veces"), 1, one(r.caught), true]] };
  },
  dedupe: () => {
    const off = runFor({ mode: "outbox", crash: 0, relayCrash: 0.1, dedupe: false, poll: 2 }), on = runFor({ mode: "outbox", crash: 0, relayCrash: 0.1, dedupe: true, poll: 2 });
    const top = Math.max(off.dupShipped, on.caught, 1);
    return { verdict: TT("Dedupe off: " + one(off.dupShipped) + " of " + n0(off.orders) + " orders shipped twice. Dedupe on: " + one(on.caught) + " repeats caught on the spike, " + one(on.dupShipped) + " shipped twice.",
        "Deduplicación apagada: " + one(off.dupShipped) + " de " + n0(off.orders) + " pedidos enviados dos veces. Deduplicación encendida: " + one(on.caught) + " repeticiones detectadas en el pincho, " + one(on.dupShipped) + " enviados dos veces."),
      bars: [[TT("Shipped twice, dedupe off", "Enviados dos veces, dedup. apagada"), off.dupShipped / top, one(off.dupShipped), true], [TT("Shipped twice, dedupe on", "Enviados dos veces, dedup. encendida"), on.dupShipped / top, one(on.dupShipped)], [TT("Repeats caught, dedupe on", "Repeticiones detectadas, dedup. encendida"), on.caught / top, one(on.caught)]] };
  },
  poll: () => {
    const rows = [0.5, 2, 5].map((p) => [p, runFor({ mode: "outbox", crash: 0, relayCrash: 0, dedupe: true, poll: p })]);
    const dual = runFor({ mode: "dual", crash: 0 });
    const top = Math.max(...rows.map(([, r]) => r.p95));
    const lost = one(rows.reduce((s, [, r]) => s + r.lost, 0));
    return { verdict: TT("Typical delay from commit to warehouse: " + rows.map(([p, r]) => one(r.median) + " s at " + p + " s").join(", ") + " (slowest 5%: " + rows.map(([, r]) => one(r.p95) + " s").join(", ") + "). Walking it over directly: " + one(dual.median) + " s. Lost: " + lost + ".",
        "Demora típica desde el commit hasta el almacén: " + rows.map(([p, r]) => one(r.median) + " s con " + p + " s").join(", ") + " (el 5% más lento: " + rows.map(([, r]) => one(r.p95) + " s").join(", ") + "). Llevándola directamente: " + one(dual.median) + " s. Perdidos: " + lost + "."),
      bars: [[TT("Walk it over (no outbox)", "Llevarla directo (sin outbox)"), dual.median / top, one(dual.median) + " s"], ...rows.map(([p, r]) => [TT("Relay every " + p + " s, typical", "Relé cada " + p + " s, típica"), r.median / top, one(r.median) + " s", p === 5]), [TT("Relay every 5 s, slowest 5%", "Relé cada 5 s, el 5% más lento"), rows[2][1].p95 / top, one(rows[2][1].p95) + " s", true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const [key, v] of Object.entries(w)) set(key, String(v), true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./outbox-workbench.html", import.meta.url), {
  title: t("Outbox Workbench", "Banco de trabajo: outbox"),
  eyebrow: t("Systems lesson 24 · Outbox pattern", "Lección de sistemas 24 · Patrón outbox"),
  lede: t("Most requests have to do two things: save something in the database and tell other services about it. Done as two separate writes, a failure in between leaves them disagreeing, and nothing reports it. This lesson builds the outbox pattern: watch a machine do it, predict what breaks it, then explain it back.",
    "La mayoría de las solicitudes tienen que hacer dos cosas: guardar algo en la base de datos y avisarles a otros servicios. Hechas como dos escrituras separadas, una falla en el medio las deja en desacuerdo, y nada lo reporta. Esta lección construye el patrón outbox (bandeja de salida): mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: { intro: t("A clerk records each order in the ledger cabinet (the database) and a letter has to reach the warehouse (the event). It opens on write, then send, with the clerk failing on 15% of orders: compare ORDERS on the cabinet with SHIPPED on the warehouse, and look for letters on the floor. Then try send, then write, and the outbox.",
    "Un empleado registra cada pedido en el gabinete del libro (la base de datos) y una carta tiene que llegar al almacén (el evento). Empieza con escribir, luego enviar, con el empleado fallando en el 15% de los pedidos: compara PEDIDOS en el gabinete con ENVIADOS en el almacén, y busca cartas en el piso. Después prueba enviar, luego escribir, y el outbox."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine: 10 minutes of orders, averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados salen del mismo modelo que la máquina: 10 minutos de pedidos, promediados sobre ocho corridas con semilla."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote outbox-workbench.html", (size / 1024).toFixed(0) + " KB");
