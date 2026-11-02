// Systems lesson 25 · Idempotency keys. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, tokenSvgs, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "lost",
    title: t("Lost replies, no keys", "Respuestas perdidas, sin claves"),
    change: t("Keys off · 1 reply in 10 is lost on the way back · a customer who hears nothing in 5 s pays again · 4 customers, 3 minutes", "Claves apagadas · 1 de cada 10 respuestas se pierde al volver · un cliente que no recibe nada en 5 s paga de nuevo · 4 clientes, 3 minutos"),
    question: t("The counter charges correctly every time it receives a slip. Out of roughly 120 orders, how many end up charged twice?", "El mostrador cobra bien cada vez que recibe una boleta. De unos 120 pedidos, ¿a cuántos se les termina cobrando dos veces?"),
    options: [
      t("None: every charge the counter made was a real request", "A ninguno: cada cobro que hizo el mostrador fue una solicitud real"),
      t("About one for every lost reply, roughly 1 in 10", "Más o menos uno por cada respuesta perdida, cerca de 1 de cada 10"),
      t("About half of them", "Más o menos a la mitad"),
    ],
    answer: 1,
    why: t(
      "A lost reply looks exactly like a lost request from the customer's side: no answer. So the customer pays again, and the counter, which has no memory of the first slip, charges again. Every lost reply after a successful charge becomes a double charge. Nothing failed on the server; the duplicate was created by a correct retry.",
      "Desde el lado del cliente, una respuesta perdida se ve igual que una solicitud perdida: no hay respuesta. Así que el cliente paga de nuevo, y el mostrador, que no recuerda la primera boleta, vuelve a cobrar. Cada respuesta perdida después de un cobro exitoso se convierte en un cobro doble. Nada falló en el servidor; el duplicado lo creó un reintento correcto.",
    ),
    watch: { keys: "off", loss: 0.1, timeout: "patient", lifetime: "long", drift: 0 },
  },
  {
    id: "keys",
    title: t("Remember the result", "Recordar el resultado"),
    change: t("Every order carries a key · the counter files key → receipt after charging · a slip whose key is on file gets the stored receipt back · same 10% loss", "Cada pedido lleva una clave · el mostrador guarda clave → recibo después de cobrar · una boleta cuya clave ya está guardada recibe el recibo guardado · misma pérdida del 10%"),
    question: t("What happens to the retries now?", "¿Qué pasa ahora con los reintentos?"),
    options: [
      t("Still charged, just about half as often", "Se siguen cobrando, solo que más o menos la mitad de las veces"),
      t("Nobody is charged twice: each retry is answered with the stored receipt", "A nadie se le cobra dos veces: cada reintento se responde con el recibo guardado"),
      t("Nobody is charged twice, but the retried orders fail", "A nadie se le cobra dos veces, pero los pedidos reintentados fallan"),
    ],
    answer: 1,
    why: t(
      "The retry carries the same key, finds the receipt in the rack and gets the original answer back, with no second charge. From the customer's side it looks exactly like the first reply arriving late, which is the point: an idempotent operation can be repeated safely, so retries become harmless.",
      "El reintento lleva la misma clave, encuentra el recibo en el casillero y recibe la respuesta original, sin un segundo cobro. Desde el lado del cliente se ve igual que si la primera respuesta llegara tarde, y esa es la idea: una operación idempotente se puede repetir sin riesgo, así que los reintentos se vuelven inofensivos.",
    ),
    watch: { keys: "store", loss: 0.1, timeout: "patient", lifetime: "long", drift: 0 },
  },
  {
    id: "race",
    title: t("An impatient customer", "Un cliente impaciente"),
    change: t("Customers wait only 1 s before paying again · charging takes 1.2–2.4 s · no replies lost · the key is filed only once the charge is done", "Los clientes esperan solo 1 s antes de pagar de nuevo · cobrar tarda 1.2–2.4 s · no se pierde ninguna respuesta · la clave se guarda solo cuando termina el cobro"),
    question: t("Keys are on and no reply is ever lost. How many orders are charged twice?", "Las claves están activadas y nunca se pierde una respuesta. ¿A cuántos pedidos se les cobra dos veces?"),
    options: [
      t("None: the key stops every duplicate", "A ninguno: la clave frena cada duplicado"),
      t("A handful, when timing is unlucky", "A unos pocos, cuando los tiempos tienen mala suerte"),
      t("Most of them", "A la mayoría"),
    ],
    answer: 2,
    why: t(
      "The retry arrives while the first charge is still running, and the rack has nothing filed for that key yet, so the counter charges again. Checking a key and filing it later is a race. The fix is to claim the key before doing the work: an in-progress marker written atomically (a unique insert), so a second slip with the same key is told \"still in progress\" (409) and tries again later, when the receipt is on file.",
      "El reintento llega mientras el primer cobro todavía está en curso, y el casillero aún no tiene nada guardado para esa clave, así que el mostrador vuelve a cobrar. Verificar una clave y guardarla después es una condición de carrera. La solución es reservar la clave antes de hacer el trabajo: una marca de \"en curso\" escrita de forma atómica (un insert único), así a una segunda boleta con la misma clave se le responde \"todavía en curso\" (409) y lo vuelve a intentar más tarde, cuando el recibo ya está guardado.",
    ),
    watch: { keys: "store", loss: 0, timeout: "impatient", lifetime: "long", drift: 0 },
  },
  {
    id: "ttl",
    title: t("Keys that expire", "Claves que vencen"),
    change: t("Key lifetime 1 day → 8 s · 3 replies in 10 lost · retries back off 1, 2, 4 s, so a third try comes about 14 s after the first", "Duración de la clave 1 día → 8 s · se pierden 3 de cada 10 respuestas · los reintentos esperan 1, 2, 4 s (backoff), así que un tercer intento llega unos 14 s después del primero"),
    question: t("With the in-progress marker on, does a short key lifetime change anything?", "Con la marca de \"en curso\" activada, ¿cambia algo una duración corta de la clave?"),
    options: [
      t("No: any retry still finds its key", "No: cualquier reintento sigue encontrando su clave"),
      t("A few orders are charged twice again: their retry arrives after the key was thrown away", "A algunos pedidos se les vuelve a cobrar dos veces: su reintento llega después de que se descartó la clave"),
      t("The late retries are rejected with an error", "Los reintentos tardíos se rechazan con un error"),
    ],
    answer: 1,
    why: t(
      "Once a key is forgotten, a retry with that key is a brand-new request, so it is charged. A key must be kept for longer than the longest time a client may still retry the same operation (including retries after an app restart or a queue redelivery). Payment APIs keep keys for about 24 hours for this reason.",
      "Una vez que se olvida una clave, un reintento con esa clave es una solicitud completamente nueva, así que se cobra. Una clave tiene que guardarse más tiempo que el máximo durante el cual un cliente todavía podría reintentar la misma operación (incluidos los reintentos después de reiniciar una app o de una nueva entrega desde una cola). Por eso las APIs de pagos guardan las claves unas 24 horas.",
    ),
    watch: { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "short", drift: 0 },
  },
  {
    id: "drift",
    title: t("Same key, different amount", "Misma clave, otro monto"),
    change: t("A buggy client recalculates the total (+$5) on half of its retries but reuses the order's key · 3 replies in 10 lost · keys on", "Un cliente con un bug recalcula el total (+$5) en la mitad de sus reintentos pero reutiliza la clave del pedido · se pierden 3 de cada 10 respuestas · claves activadas"),
    question: t("What should the counter do with a retry whose key is on file but whose amount differs?", "¿Qué debería hacer el mostrador con un reintento cuya clave está guardada pero cuyo monto es distinto?"),
    options: [
      t("Charge the new amount: it's what the customer asked for now", "Cobrar el monto nuevo: es lo que el cliente pide ahora"),
      t("Return the stored receipt as if nothing changed", "Devolver el recibo guardado como si nada hubiera cambiado"),
      t("Refuse it (422) and charge nothing", "Rechazarlo (422) y no cobrar nada"),
    ],
    answer: 2,
    why: t(
      "A key names one specific operation. If the request behind it changed, either the client has a bug or two different operations share a key; replaying the old receipt would tell the client the new amount was charged when it wasn't, and charging would double-charge. So the server keeps a fingerprint of the original request and rejects a mismatch loudly (422), which surfaces the client bug.",
      "Una clave nombra una operación específica. Si la solicitud detrás de ella cambió, o el cliente tiene un bug o dos operaciones distintas comparten una clave; devolver el recibo viejo le diría al cliente que se cobró el monto nuevo cuando no fue así, y cobrar sería un cobro doble. Por eso el servidor guarda una huella (fingerprint) de la solicitud original y rechaza a la vista cualquier diferencia (422), lo que saca a la luz el bug del cliente.",
    ),
    watch: { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "long", drift: 0.5 },
  },
];

const QUESTIONS = [
  [t("The payment service charged the card once for every request it received, yet a customer was charged twice. How?", "El servicio de pagos cobró la tarjeta una vez por cada solicitud que recibió, pero a un cliente se le cobró dos veces. ¿Cómo?"),
    t("The first charge succeeded but its reply was lost (or arrived after the client's timeout). The client can't tell that apart from a failed request, so it retried, and the server, with no memory of the first request, treated the retry as a new payment. Retries are correct behaviour; the server must make them safe.", "El primer cobro tuvo éxito pero su respuesta se perdió (o llegó después del tiempo de espera del cliente). El cliente no puede distinguir eso de una solicitud fallida, así que reintentó, y el servidor, sin memoria de la primera solicitud, trató el reintento como un pago nuevo. Reintentar es el comportamiento correcto; el servidor tiene que hacerlo seguro.")],
  [t("What should the server store for each idempotency key, and why the whole response rather than just \"seen\"?", "¿Qué debería guardar el servidor para cada clave de idempotencia (idempotency key), y por qué la respuesta completa en lugar de solo \"visto\"?"),
    t("The response it sent (status and body) plus a fingerprint of the request. A retry must get the same answer the first request got, including the charge ID or the error, so the client can carry on as if the first reply had arrived. \"Seen\" alone would leave the server unable to answer the retry.", "La respuesta que envió (estado y cuerpo) más una huella de la solicitud. Un reintento tiene que recibir la misma respuesta que recibió la primera solicitud, incluido el ID del cobro o el error, para que el cliente pueda seguir como si hubiera llegado la primera respuesta. Con solo \"visto\", el servidor no podría responder el reintento.")],
  [t("Why is \"look up the key, charge, then save the key\" not enough?", "¿Por qué no alcanza con \"buscar la clave, cobrar y después guardar la clave\"?"),
    t("Two requests with the same key can arrive close together; both look up, both find nothing, both charge. The key must be claimed before the work starts, atomically: insert an in-progress row with a unique constraint, and answer a concurrent duplicate with 409 (or make it wait) until the first finishes and its response is stored.", "Dos solicitudes con la misma clave pueden llegar casi juntas; las dos buscan, las dos no encuentran nada, las dos cobran. La clave tiene que reservarse antes de empezar el trabajo, de forma atómica: inserta una fila \"en curso\" con una restricción de unicidad y responde a un duplicado concurrente con 409 (o hazlo esperar) hasta que la primera termine y su respuesta quede guardada.")],
  [t("How long should keys be kept?", "¿Cuánto tiempo hay que guardar las claves?"),
    t("Longer than any client could still retry the same operation: across backoff schedules, app restarts, queued retries and message redeliveries. A day is common for payment APIs. Too short and late retries become duplicates; forever is unnecessary storage.", "Más tiempo que el que cualquier cliente todavía podría reintentar la misma operación: contando las esperas entre reintentos (backoff), los reinicios de la app, los reintentos encolados y las nuevas entregas de mensajes. Un día es común en las APIs de pagos. Si es muy corto, los reintentos tardíos se vuelven duplicados; para siempre es almacenamiento innecesario.")],
  [t("Who generates the key, and how should keys be scoped?", "¿Quién genera la clave, y cuál debería ser el alcance de las claves?"),
    t("The client generates one key per logical operation (for example a UUID created when the user presses Pay) and reuses it for every retry of that operation, never for a different one. The server scopes keys per account or API client, so two clients that pick the same key can't see each other's results.", "El cliente genera una clave por operación lógica (por ejemplo, un UUID creado cuando el usuario presiona Pagar) y la reutiliza en cada reintento de esa operación, nunca en otra distinta. El servidor limita las claves por cuenta o por cliente de la API, así dos clientes que eligen la misma clave no pueden ver los resultados del otro.")],
  [t("Which operations need idempotency keys, and where else does the same idea show up?", "¿Qué operaciones necesitan claves de idempotencia, y dónde más aparece la misma idea?"),
    t("Anything that isn't naturally idempotent: creating payments, orders, emails, transfers. PUT and DELETE that set a final state usually are idempotent already. The same idea appears in message consumers (dedupe by message ID under at-least-once delivery), webhooks, and the outbox pattern's relay.", "Todo lo que no es idempotente por naturaleza: crear pagos, pedidos, emails, transferencias. Los PUT y DELETE que fijan un estado final normalmente ya son idempotentes. La misma idea aparece en los consumidores de mensajes (deduplicar por ID de mensaje con entrega al menos una vez, at-least-once), en los webhooks y en el relé del patrón outbox.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Payment counter", "Mostrador de pagos"),
  keys: [
    { mark: "lit", label: t("A receipt answered from the rack; a customer paying again; a card charged twice", "Un recibo respondido desde el casillero; un cliente que paga de nuevo; una tarjeta cobrada dos veces") },
    { mark: "raised", label: t("Slips going up, replies coming back, the stored receipts", "Boletas que suben, respuestas que vuelven, los recibos guardados") },
    { mark: "flat", label: t("Lanes, and the trough where lost replies fall", "Carriles, y la canaleta donde caen las respuestas perdidas") },
  ],
  caption: t(
    "Each customer holds a slip with their order's key (A7 is customer A's 7th order) and how many times they've tried. Slips go up the left side of a lane to a card terminal; replies come back down the right side, and some fall into the trough. Behind the counter, the key rack holds one stored receipt per key, or a flag while that key's charge is still running. A lit receipt in the rack means a retry was answered from it. The till counts orders paid against card charges: when charges run ahead, someone paid twice.",
    "Cada cliente tiene una boleta con la clave de su pedido (A7 es el 7.º pedido del cliente A) y cuántas veces lo intentó. Las boletas suben por el lado izquierdo de un carril hasta una terminal de tarjetas; las respuestas bajan por el lado derecho, y algunas caen en la canaleta. Detrás del mostrador, el casillero de claves guarda un recibo por clave, o una bandera mientras el cobro de esa clave sigue en curso. Un recibo iluminado en el casillero significa que un reintento se respondió con él. La caja compara los pedidos pagados con los cobros a tarjeta: cuando los cobros se adelantan, alguien pagó dos veces.",
  ),
  stage: "data-counter",
  stageLabel: t("Idempotency key simulation. Space pauses or resumes.", "Simulación de clave de idempotencia. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t(
  'Changing any setting starts the run again. "Double-click Pay" makes customer A send the same slip twice at once.',
  'Cambiar cualquier ajuste vuelve a empezar la corrida. "Doble clic en Pagar" hace que el cliente A envíe la misma boleta dos veces a la vez.',
))}</p>`;
const controls = panel({
  stats: [["orders", t("Orders paid", "Pedidos pagados")], ["charges", t("Card charges", "Cobros a tarjeta")], ["twice", t("Charged twice", "Cobrados dos veces")], ["replays", t("Answered from rack", "Desde el casillero")], ["c409", t("Still in progress (409)", "Todavía en curso (409)")], ["r422", t("Rejected (422)", "Rechazados (422)")], ["lost", t("Replies lost", "Respuestas perdidas")]],
  controls: [
    seg("keys", t("Idempotency keys", "Claves de idempotencia"), [["off", t("Off", "Apagadas")], ["store", t("File after charging", "Guardar después de cobrar")], ["lock", t("Claim first (in-progress flag)", "Reservar primero (bandera en curso)")]], "lock"),
    seg("loss", t("Replies lost", "Respuestas perdidas"), [[0, t("None", "Ninguna")], [0.1, t("1 in 10", "1 de 10")], [0.3, t("3 in 10", "3 de 10")]], 0.3),
    seg("timeout", t("Customer waits", "El cliente espera"), [["patient", "5 s"], ["impatient", "1 s"]], "patient"),
    seg("lifetime", t("Key kept for", "Clave guardada por"), [["long", t("1 day", "1 día")], ["short", "8 s"]], "long"),
    seg("drift", t("Amount on retry", "Monto al reintentar"), [[0, t("Same", "Igual")], [0.5, t("Sometimes +$5", "A veces +$5")]], 0),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["double", t("Double-click Pay", "Doble clic en Pagar")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.iso-stage .iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}
body.lit-fill [data-slip]:has(> [data-slip-lit]:not([style*="none"])) :is([data-slip-top],[data-slip-note]){fill:var(--anatomy-page)}
body.lit-fill [data-hole]:has(> [data-card-lit]:not([style*="none"])) [data-hole-key]{fill:var(--anatomy-page)}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const TOKENS = ${JSON.stringify(tokenSvgs())};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const POOL = 60, PILE = 3;
const WARM = 30;   // each run starts half a minute in, so the first frame already shows keys, retries and lost replies

const stage = document.querySelector("[data-counter]");
const svg = stage.querySelector("svg");
const q = (s, root = svg) => root.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const { T, L } = WB;
const label = (key) => "ABCD"[Number(key.slice(1, key.indexOf("-")))] + key.slice(key.indexOf("-") + 1);

function poolOf(layer, n) {
  return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.style.display = "none"; layer.appendChild(g); return { g, kind: null }; });
}
const tokens = poolOf(q("[data-tokens]"), POOL);
const work = poolOf(q("[data-work]"), 12);
function place(list, used, kind, point) {
  if (used >= list.length) return used;
  const t = list[used];
  if (t.kind !== kind) { t.g.innerHTML = TOKENS[kind]; t.kind = kind; }
  t.g.style.display = "";
  t.g.setAttribute("transform", translateAlong(P, point));
  return used + 1;
}
const hide = (list, from) => { for (let i = from; i < list.length; i++) list[i].g.style.display = "none"; };

const holes = Array.from({ length: SLOTS }, (_, i) => { const g = q('[data-hole="' + i + '"]'); return { g, card: q("[data-card]", g), lit: q("[data-card-lit]", g), flag: q("[data-flag]", g), key: q("[data-hole-key]", g), shown: "" }; });
const customers = [0, 1, 2, 3].map((i) => { const g = q('[data-customer="' + i + '"]'); return { slip: q("[data-slip]", g), plain: q("[data-slip-plain]", g), lit: q("[data-slip-lit]", g), top: q("[data-slip-top]", g), note: q("[data-slip-note]", g) }; });
const screens = [0, 1, 2, 3].map((i) => ({ off: q('[data-screen="' + i + '"]'), on: q('[data-screen-lit="' + i + '"]') }));
const digits = (name, n) => Array.from({ length: n }, (_, j) => q('[data-digit="' + name + j + '"]'));
const dials = { orders: digits("orders", 4), charges: digits("charges", 4), replays: digits("replays", 4) };
function showDial(name, value, lit) {
  const s = String(Math.max(0, Math.floor(value)) % 10000).padStart(4, "0");
  dials[name].forEach((el, j) => { if (el.textContent !== s[j]) el.textContent = s[j]; const tone = lit ? "lit" : "hi"; if (el.getAttribute("data-tone") !== tone) el.setAttribute("data-tone", tone); });
}
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
const showEl = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };

const cfg = { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "long", drift: 0, speed: 1 };
let model, clock, logAt, holeHit, lastExtra, lastEvent, outcomes, piles;
let seed = (Date.now() % 1e6) + 1;

function restart() {
  model = makeSim({ keys: cfg.keys, loss: cfg.loss, timeout: cfg.timeout, lifetime: cfg.lifetime, drift: cfg.drift }, seed++);
  clock = WARM; logAt = 0; holeHit = {}; lastExtra = -9; lastEvent = null; outcomes = [null, null, null, null]; piles = [[], [], [], []];
  model.runTo(clock);
  paint();
}

const SPAN = G.LANE_NEAR - G.LANE_FAR;
const FALL_AT = (G.TROUGH_Y - G.LANE_FAR) / SPAN;    // share of a reply's trip at which a lost one drops

function pilePoint(lane, n) {
  const x = G.XS[lane] + G.LANE + 1.2 + (n % 2) * 3.2 - 2.2, y = G.TROUGH.y0 + 2.6 + Math.floor(n / 2) * 2.6 + (n % 2) * 1.2;
  return [x, y, G.TROUGH_H - 0.6];
}

function paint() {
  // Events since the last frame: rack hits, double charges, finished orders, the readout.
  for (; logAt < model.log.length; logAt++) {
    const e = model.log[logAt];
    if (e.type === "replay" || e.type === "422") holeHit[e.slot] = e.t;
    if (e.type === "charge" && e.n > 1) lastExtra = e.t;
    if (e.type !== "send" || e.try > 1) lastEvent = e;
  }
  model.purchases.forEach((p) => { if (p.done && p.end > clock - 1.6 && p.end <= clock) outcomes[p.client] = p; });

  // Slips and replies on the lanes; lost replies fall into the trough and stay.
  let used = 0;
  for (const tr of model.trips) {
    if (tr.sent > clock) break;
    const x = G.XS[tr.client];
    const p = (clock - tr.sent) / (tr.arrive - tr.sent);
    if (tr.kind === "req") {
      if (p >= 1) continue;
      used = place(tokens, used, "req", [x - G.LANE, G.LANE_NEAR - p * SPAN, 0]);
    } else {
      const kind = tr.status === "ok" ? "ok" : tr.status;
      if (tr.lost && p >= FALL_AT) {
        if (!tr.piled) { tr.piled = true; piles[tr.client].push(tr); }
        const drop = Math.min(1, (p - FALL_AT) / 0.25);
        if (drop < 1) used = place(tokens, used, kind, [x + G.LANE, G.TROUGH_Y, G.TROUGH_H + 2 - 2.6 * drop]);
        continue;
      }
      if (p >= 1) continue;
      used = place(tokens, used, kind, [x + G.LANE, G.LANE_FAR + p * SPAN, 0]);
    }
  }
  piles.forEach((pile, lane) => {
    const settled = pile.filter((tr) => (clock - tr.sent) / (tr.arrive - tr.sent) >= FALL_AT + 0.25);
    settled.slice(-PILE * 2).forEach((tr, n) => { used = place(tokens, used, tr.status === "ok" ? "ok" : tr.status, pilePoint(lane, n)); });
  });
  hide(tokens, used);

  // Slips being charged, on each terminal's tray; a second charge for the same order is lit.
  let w = 0;
  const busy = [false, false, false, false];
  const counts = {};
  for (const job of model.working) {
    if (job.start > clock) continue;
    busy[job.client] = true;
    const stackN = counts[job.client] = (counts[job.client] || 0) + 1;
    const p = model.purchases.find((pp) => pp.key === job.key);
    const dup = (p && p.charges > 0) || model.working.some((o) => o !== job && o.key === job.key && o.start < job.start);
    w = place(work, w, dup ? "workLit" : "work", [G.TRAY[job.client][0], G.TRAY[job.client][1], G.TRAY_Z + (stackN - 1) * 1.3]);
  }
  hide(work, w);
  screens.forEach((s, i) => { showEl(s.off, !busy[i]); showEl(s.on, busy[i]); });

  // The key rack.
  const rack = model.rack(clock);
  holes.forEach((h, i) => {
    const e = rack[i];
    const live = e && e.state !== "expired";
    showEl(h.g, !!live);
    if (!live) return;
    const hit = holeHit[i] != null && clock - holeHit[i] < 0.9;
    showEl(h.card, e.state === "done" && !hit);
    showEl(h.lit, e.state === "done" && hit);
    showEl(h.flag, e.state === "progress");
    setText(h.key, label(e.key));
  });

  // Customers' slips: the order's key and try, then the outcome for a moment.
  model.customers.forEach((cu, i) => {
    const c = customers[i], o = outcomes[i];
    const showOutcome = o && clock - o.end < 1.6;
    const p = showOutcome ? o : cu.current;
    showEl(c.slip, !!p);
    if (!p) return;
    const retrying = !showOutcome && p.tries > 1;
    showEl(c.plain, !retrying); showEl(c.lit, retrying);
    if (showOutcome) {
      setText(c.top, o.outcome === "paid" ? L("PAID", "PAGADO") : o.outcome === "rejected" ? "422" : L("GAVE UP", "SE FUE"));
      setText(c.note, label(o.key) + (o.charges > 1 ? L(" · charged " + o.charges + "×", " · " + o.charges + " cobros") : " · $" + o.amount));
    } else {
      setText(c.top, label(p.key));
      setText(c.note, L("try ", "vez ") + p.tries + " · $" + p.amount);
    }
  });

  // The till.
  const S = model.stats;
  const twice = model.purchases.filter((p) => p.charges > 1).length;
  showDial("orders", model.charged(), false);
  showDial("charges", S.charges, clock - lastExtra < 1.2);
  showDial("replays", S.replays, false);

  // Readout and stats.
  const e = lastEvent && clock - lastEvent.t < 2.5 ? lastEvent : null;
  const k = e && e.key ? label(e.key) : "";
  const idle = L(model.charged() + " orders paid · " + S.charges + " card charges", model.charged() + " pedidos pagados · " + S.charges + " cobros a tarjeta");
  say(!e ? idle
    : e.type === "send" ? k + L(" · no reply yet, paying again (try " + e.try + ")", " · sin respuesta todavía, paga de nuevo (intento " + e.try + ")")
    : e.type === "lost" ? k + L(" · reply lost on the way back", " · respuesta perdida al volver")
    : e.type === "replay" ? k + L(" · answered from the rack, not charged again", " · respondido desde el casillero, sin volver a cobrar")
    : e.type === "409" ? k + L(" · still in progress (409), try again shortly", " · todavía en curso (409), reintenta en un momento")
    : e.type === "422" ? k + L(" · same key, different amount: rejected (422)", " · misma clave, otro monto: rechazado (422)")
    : e.type === "expired" ? k + L(" · key expired, so this is a new payment", " · la clave venció, así que es un pago nuevo")
    : e.type === "charge" && e.n > 1 ? k + L(" · charged again (" + e.n + "×)", " · cobrado de nuevo (" + e.n + "×)")
    : idle);
  stat("orders", model.charged());
  stat("charges", S.charges);
  stat("twice", twice);
  stat("replays", S.replays);
  stat("c409", S.conflicts);
  stat("r422", S.rejected);
  stat("lost", S.lost);
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
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = name === "loss" || name === "drift" ? Number(raw) : raw;
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="double"]').addEventListener("click", () => { model.doubleClick(0, clock); if (loop.paused) loop.setPaused(false); });
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const r0 = (x) => String(Math.round(x));
const pct = (x) => Math.round(100 * x) + "%";
const RUNS = {
  lost: () => {
    const r = runScenario({ keys: "off", loss: 0.1 });
    return { verdict: T("Of " + r0(r.purchases) + " orders, " + r0(r.doubled) + " were charged twice (" + pct(r.doubled / r.purchases) + "), against " + r0(r.lost) + " lost replies. Every charge was a real request; the duplicates came from correct retries.",
        "De " + r0(r.purchases) + " pedidos, a " + r0(r.doubled) + " se les cobró dos veces (" + pct(r.doubled / r.purchases) + "), frente a " + r0(r.lost) + " respuestas perdidas. Cada cobro fue una solicitud real; los duplicados vinieron de reintentos correctos."),
      bars: [[T("Orders", "Pedidos"), 1, r0(r.purchases)], [T("Replies lost", "Respuestas perdidas"), r.lost / r.purchases, r0(r.lost)], [T("Charged twice", "Cobrados dos veces"), r.doubled / r.purchases, r0(r.doubled), true]] };
  },
  keys: () => {
    const off = runScenario({ keys: "off", loss: 0.1 }), on = runScenario({ keys: "store", loss: 0.1 }), top = Math.max(off.doubled, on.replays, 1);
    return { verdict: T("With keys, " + r0(on.doubled) + " orders were charged twice (" + r0(off.doubled) + " without). " + r0(on.replays) + " retries were answered from the rack with the original receipt.",
        "Con claves, a " + r0(on.doubled) + " pedidos se les cobró dos veces (" + r0(off.doubled) + " sin claves). " + r0(on.replays) + " reintentos se respondieron desde el casillero con el recibo original."),
      bars: [[T("Charged twice, no keys", "Cobrados dos veces, sin claves"), off.doubled / top, r0(off.doubled)], [T("Charged twice, with keys", "Cobrados dos veces, con claves"), on.doubled / top, r0(on.doubled), true], [T("Answered from the rack", "Respondidos del casillero"), on.replays / top, r0(on.replays), true]] };
  },
  race: () => {
    const late = runScenario({ keys: "store", loss: 0, timeout: "impatient" }), claim = runScenario({ keys: "lock", loss: 0, timeout: "impatient" });
    return { verdict: T("Filing the key after charging: " + r0(late.doubled) + " of " + r0(late.purchases) + " orders charged twice (" + pct(late.doubled / late.purchases) + "), with no reply ever lost. Claiming the key first: " + r0(claim.doubled) + " charged twice, and " + r0(claim.conflicts) + " early retries told \\"still in progress\\" (409).",
        "Guardando la clave después de cobrar: " + r0(late.doubled) + " de " + r0(late.purchases) + " pedidos cobrados dos veces (" + pct(late.doubled / late.purchases) + "), sin que se perdiera ninguna respuesta. Reservando la clave primero: " + r0(claim.doubled) + " cobrados dos veces, y a " + r0(claim.conflicts) + " reintentos tempranos se les respondió \\"todavía en curso\\" (409)."),
      bars: [[T("Charged twice, filed after", "Cobrados dos veces, guardada después"), late.doubled / late.purchases, pct(late.doubled / late.purchases), true], [T("Charged twice, claimed first", "Cobrados dos veces, reservada primero"), claim.doubled / claim.purchases, pct(claim.doubled / claim.purchases), true]] };
  },
  ttl: () => {
    const long = runScenario({ keys: "lock", loss: 0.3, lifetime: "long" }), short = runScenario({ keys: "lock", loss: 0.3, lifetime: "short" }), top = Math.max(short.doubled, short.expiredHits, 1);
    return { verdict: T("Keys kept 1 day: " + r0(long.doubled) + " orders charged twice. Kept 8 s: " + r0(short.doubled) + " of " + r0(short.purchases) + " charged twice; " + r0(short.expiredHits) + " retries arrived after their key was gone.",
        "Claves guardadas 1 día: " + r0(long.doubled) + " pedidos cobrados dos veces. Guardadas 8 s: " + r0(short.doubled) + " de " + r0(short.purchases) + " cobrados dos veces; " + r0(short.expiredHits) + " reintentos llegaron cuando su clave ya no estaba."),
      bars: [[T("Charged twice, 1 day", "Cobrados dos veces, 1 día"), long.doubled / top, r0(long.doubled)], [T("Charged twice, 8 s", "Cobrados dos veces, 8 s"), short.doubled / top, r0(short.doubled), true], [T("Retries after expiry", "Reintentos tras vencer"), short.expiredHits / top, r0(short.expiredHits)]] };
  },
  drift: () => {
    const on = runScenario({ keys: "lock", loss: 0.3, drift: 0.5 }), off = runScenario({ keys: "off", loss: 0.3, drift: 0.5 }), top = Math.max(on.rejected, off.wrongAmount, 1);
    return { verdict: T("With keys: " + r0(on.rejected) + " retries with a changed amount were rejected (422) and " + r0(on.extra) + " extra charges were made. Without keys, " + r0(off.wrongAmount) + " orders were charged a second time at a different amount.",
        "Con claves: " + r0(on.rejected) + " reintentos con un monto cambiado se rechazaron (422) y se hicieron " + r0(on.extra) + " cobros extra. Sin claves, a " + r0(off.wrongAmount) + " pedidos se les cobró una segunda vez con otro monto."),
      bars: [[T("Rejected (422), with keys", "Rechazados (422), con claves"), on.rejected / top, r0(on.rejected), true], [T("Wrong second charges, with keys", "Segundos cobros erróneos, con claves"), on.wrongAmount / top, r0(on.wrongAmount)], [T("Wrong second charges, no keys", "Segundos cobros erróneos, sin claves"), off.wrongAmount / top, r0(off.wrongAmount)]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  for (const [name, value] of Object.entries(exp.watch)) set(name, String(value), true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./idempotency-workbench.html", import.meta.url), {
  title: t("Idempotency Workbench", "Banco de trabajo: idempotencia"),
  eyebrow: t("Systems lesson 25 · Idempotency keys", "Lección de sistemas 25 · Claves de idempotencia"),
  lede: t("When a reply goes missing, the client can't tell whether its request worked, so it sends it again. An idempotency key lets the server recognise the retry and answer it with the result it already produced, instead of doing the work twice. This lesson builds that on a payment counter: watch it, predict what breaks it, then explain it back.",
    "Cuando una respuesta se pierde, el cliente no puede saber si su solicitud funcionó, así que la envía de nuevo. Una clave de idempotencia (idempotency key) le permite al servidor reconocer el reintento y responderlo con el resultado que ya produjo, en lugar de hacer el trabajo dos veces. Esta lección lo construye sobre un mostrador de pagos: míralo, predice qué lo rompe y después explícalo."),
  machine: { intro: t("Four customers pay at a counter over lanes that sometimes lose the reply. Watch the till: card charges should match orders paid. With keys on, retries are answered from the rack of stored receipts; switch keys off, make the customers impatient or let keys expire, and watch charges run ahead of orders.",
    "Cuatro clientes pagan en un mostrador por carriles que a veces pierden la respuesta. Mira la caja: los cobros a tarjeta deberían coincidir con los pedidos pagados. Con las claves activadas, los reintentos se responden desde el casillero de recibos guardados; apaga las claves, vuelve impacientes a los clientes o deja que las claves venzan, y mira cómo los cobros se adelantan a los pedidos."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded three-minute runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho corridas con semilla de tres minutos."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote idempotency-workbench.html", (size / 1024).toFixed(0) + " KB");
