// Systems lesson 18 · Broadcast. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import * as k from "../../workbench/kit.mjs";
import { buildFigure, routeOf, P, gaugeTravel } from "./figure.mjs";
import { TOPOLOGIES, edgesOf, createNet, HOP } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "topology",
    title: t("Pick a topology", "Elige una topología"),
    change: t("Grid → ring → hubs · 25 nodes, 100 values a second, 100 ms per message", "Malla → anillo → hubs · 25 nodos, 100 valores por segundo, 100 ms por mensaje"),
    question: t("Challenge 3d asks for fewer than 30 messages per value, a median under 400 ms and a maximum under 600 ms. Which topology meets it?", "El desafío 3d pide menos de 30 mensajes por valor, una mediana menor a 400 ms y un máximo menor a 600 ms. ¿Qué topología lo cumple?"),
    options: [t("The grid Maelstrom hands you: every node already has neighbours", "La malla que te da Maelstrom: cada nodo ya tiene vecinos"), t("A ring: each node only ever talks to two others", "Un anillo: cada nodo solo habla con otros dos"), t("Hubs: leaves talk to their hub, hubs talk to each other", "Hubs: las hojas hablan con su hub y los hubs hablan entre sí")],
    answer: 2,
    why: t("Flooding a grid sends every value down almost every wire (56 messages), and the far corner is 8 hops away (800 ms). A ring is cheap but slow: halfway round is 12 hops. Hubs keep every node within 3 hops of every other and send each value down each wire once. Sending straight from the first node to all 24 others also passes, but it needs every node connected to every other, which stops working long before 1,000 nodes.", "Inundar la malla (flooding) manda cada valor por casi todos los cables (56 mensajes), y la esquina más lejana está a 8 saltos (800 ms). Un anillo es barato pero lento: media vuelta son 12 saltos. Los hubs (concentradores) dejan cada nodo a 3 saltos o menos de cualquier otro y mandan cada valor una sola vez por cable. Enviar directo desde el primer nodo a los otros 24 también pasa, pero exige que cada nodo esté conectado con todos los demás, y eso deja de funcionar mucho antes de llegar a 1,000 nodos."),
    watch: { topology: "hubs", batch: 0, retries: false, forward: "new" },
  },
  {
    id: "batch",
    title: t("Batch the messages", "Agrupa los mensajes"),
    change: t("Hubs · batching off → one message per neighbour every 200 ms", "Hubs · agrupar: no → un mensaje por vecino cada 200 ms"),
    question: t("Challenge 3e asks for fewer than 20 messages per value, a median under 1 s and a maximum under 2 s. With batching every 200 ms…", "El desafío 3e pide menos de 20 mensajes por valor, una mediana menor a 1 s y un máximo menor a 2 s. Agrupando cada 200 ms…"),
    options: [t("Messages drop a little and latency stays the same", "Los mensajes bajan un poco y la latencia queda igual"), t("Messages drop to a few per value; latency rises but stays inside 3e", "Los mensajes bajan a unos pocos por valor; la latencia sube pero queda dentro de 3e"), t("Messages drop, but latency blows past 3e's limits", "Los mensajes bajan, pero la latencia se pasa de los límites de 3e")],
    answer: 1,
    why: t("At 100 values a second, a node has several new values each time it flushes, so one message carries many of them. Each value waits for the next flush at every hop, so latency grows with the batch interval. 200 ms is comfortably inside 3e; 500 ms pushes the median past 1 s. Batching trades latency for messages, the same deal as Kafka's linger.ms or Nagle's algorithm in TCP.", "Con 100 valores por segundo, un nodo tiene varios valores nuevos cada vez que envía su lote, así que un mensaje lleva muchos. En cada salto, cada valor espera al siguiente envío, así que la latencia crece con el intervalo del lote. 200 ms queda holgadamente dentro de 3e; 500 ms lleva la mediana por encima de 1 s. Agrupar (batching) cambia latencia por mensajes, el mismo trato que linger.ms en Kafka o el algoritmo de Nagle en TCP."),
    watch: { topology: "hubs", batch: 0.2, retries: false, forward: "new" },
  },
  {
    id: "partition",
    title: t("Cut the network", "Corta la red"),
    change: t("Hubs · the fence goes up between columns 2 and 3 for 3 seconds · no retries", "Hubs · la valla sube entre las columnas 2 y 3 durante 3 segundos · sin reintentos"),
    question: t("What happens to the values sent while the network is cut?", "¿Qué pasa con los valores enviados mientras la red está cortada?"),
    options: [t("They arrive late, once the fence comes down", "Llegan tarde, cuando baja la valla"), t("Some never reach the far side", "Algunos nunca llegan al otro lado"), t("Nothing: copies find another way round", "Nada: las copias encuentran otro camino")],
    answer: 1,
    why: t("A message sent across the cut is simply lost, and nobody sends it again, so values that started on one side never reach the other. Maelstrom's checker catches this as values missing from reads. Retrying every unacknowledged message until it is acknowledged gets everything through after the cut heals, at a price: every message now has an acknowledgement, so messages per value more than double.", "Un mensaje enviado a través del corte (una partición de red) simplemente se pierde y nadie lo vuelve a enviar, así que los valores que empezaron de un lado nunca llegan al otro. El verificador de Maelstrom lo detecta como valores que faltan en las lecturas. Reintentar cada mensaje sin confirmar hasta recibir su ack hace pasar todo cuando se restablece la red, a un precio: ahora cada mensaje tiene su ack, así que los mensajes por valor se duplican con creces."),
    watch: { topology: "hubs", batch: 0, retries: false, forward: "new", cut: true },
  },
  {
    id: "hub",
    title: t("Lose a hub", "Pierde un hub"),
    change: t("Hubs · the top-left hub is switched off", "Hubs · se apaga el hub de arriba a la izquierda"),
    question: t("Which nodes stop hearing new values?", "¿Qué nodos dejan de recibir valores nuevos?"),
    options: [t("Only the dead hub", "Solo el hub muerto"), t("The dead hub's whole branch, and its leaves' values go nowhere", "Toda la rama del hub muerto, y los valores de sus hojas no llegan a ningún lado"), t("Everyone: the network stops", "Todos: la red se detiene")],
    answer: 1,
    why: t("In the hub topology each leaf has exactly one path to the rest of the network: its hub. When the hub dies, its leaves are cut off in both directions. The grid has many paths between any two nodes, so the same failure costs it nothing. Fewer wires means fewer messages and fewer ways round a failure; production systems keep two parents per node or fall back to gossip.", "En la topología de hubs cada hoja tiene un solo camino al resto de la red: su hub. Cuando el hub muere, sus hojas quedan aisladas en ambas direcciones. La malla tiene muchos caminos entre dos nodos cualesquiera, así que la misma falla no le cuesta nada. Menos cables significa menos mensajes y menos formas de rodear una falla; los sistemas en producción mantienen dos padres por nodo o recurren a gossip."),
    watch: { topology: "hubs", batch: 0, retries: false, forward: "new", kill: true },
  },
  {
    id: "forward",
    title: t("Forward everything", "Reenvía todo"),
    change: t("Grid · forward every copy you receive, not only values you haven't seen", "Malla · reenvía cada copia que recibes, no solo los valores que no has visto"),
    question: t("One value enters the network. How many messages in the first second?", "Un valor entra a la red. ¿Cuántos mensajes hay en el primer segundo?"),
    options: [t("About the same as before: 56", "Más o menos lo mismo que antes: 56"), t("A few hundred: some duplicates", "Unos cientos: algunos duplicados"), t("Tens of thousands, and still growing", "Decenas de miles, y sigue creciendo")],
    answer: 2,
    why: t("Every node that forwards every copy turns one incoming message into three outgoing ones, and the grid has loops, so copies come back round and multiply at every hop. Remembering which values you've already seen makes forwarding idempotent: a second copy is ignored. Real systems do the same with message IDs, sequence numbers or a hop limit.", "Cada nodo que reenvía cada copia convierte un mensaje entrante en tres salientes, y la malla tiene ciclos, así que las copias vuelven y se multiplican en cada salto. Recordar qué valores ya viste hace que reenviar sea idempotente: una segunda copia se ignora. Los sistemas reales hacen lo mismo con IDs de mensaje, números de secuencia o un límite de saltos."),
    watch: { topology: "grid", batch: 0, retries: false, forward: "every" },
  },
];

const QUESTIONS = [
  [t("The grid Maelstrom gives you connects every node. Why does flooding it fail challenge 3d?", "La malla que te da Maelstrom conecta todos los nodos. ¿Por qué inundarla no pasa el desafío 3d?"),
    t("Flooding sends each new value to every neighbour except the sender, so a value crosses nearly every wire: 56 messages for 25 nodes. And the grid is wide: the far corner is 8 hops away, 800 ms at 100 ms a hop. Connected is not the same as short or cheap.", "Inundar (flooding) manda cada valor nuevo a todos los vecinos menos al que lo envió, así que un valor cruza casi todos los cables: 56 mensajes para 25 nodos. Y la malla es ancha: la esquina más lejana está a 8 saltos, 800 ms a 100 ms por salto. Conectada no significa corta ni barata.")],
  [t("Sending straight from the first node to all 24 others gives 24 messages and 100 ms. Why not always do that?", "Enviar directo desde el primer nodo a los otros 24 da 24 mensajes y 100 ms. ¿Por qué no hacerlo siempre?"),
    t("Every node needs a connection to every other one: 300 links for 25 nodes, about 500,000 for 1,000. Each node also has to know the full membership. Relays such as hubs keep each node's fan-out small and the path short, which is what scales.", "Cada nodo necesita una conexión con todos los demás: 300 enlaces para 25 nodos, unos 500,000 para 1,000. Además, cada nodo tiene que conocer la membresía completa. Los relevos como los hubs mantienen pequeño el fan-out de cada nodo y corto el camino, y eso es lo que escala.")],
  [t("What does batching trade, and where else have you seen the same trade?", "¿Qué intercambia agrupar (batching), y dónde más has visto el mismo intercambio?"),
    t("It trades latency for messages: values wait up to one interval at each hop, and one message carries many values. Kafka producers (linger.ms, batch size), Nagle's algorithm in TCP and log shippers all do the same.", "Cambia latencia por mensajes: los valores esperan hasta un intervalo en cada salto, y un mensaje lleva muchos valores. Los productores de Kafka (linger.ms, tamaño de lote), el algoritmo de Nagle en TCP y los enviadores de logs hacen lo mismo.")],
  [t("Retries delivered everything across a cut network but doubled messages per value. Why, and how do real systems keep that down?", "Los reintentos entregaron todo a través de una red cortada, pero duplicaron los mensajes por valor. ¿Por qué, y cómo lo reducen los sistemas reales?"),
    t("Every message needs an acknowledgement, and unacknowledged ones are sent again. Systems acknowledge in batches, back off between retries, or skip per-message acks and periodically compare what each side has (anti-entropy), sending only the difference.", "Cada mensaje necesita un ack, y los que no se confirman se envían de nuevo. Los sistemas confirman en lotes, esperan cada vez más entre reintentos (backoff), o se saltan los acks por mensaje y comparan periódicamente lo que tiene cada lado (anti-entropía), enviando solo la diferencia.")],
  [t("A hub dies and its branch goes dark. How would you design so one node can't cut off others?", "Un hub muere y su rama se apaga. ¿Cómo diseñarías para que un nodo no pueda aislar a otros?"),
    t("Give every node at least two independent paths: two parents, a ring of hubs with leaves connected to two hubs, or a gossip fallback. Detect the failure (heartbeats) and rewire around it.", "Dale a cada nodo al menos dos caminos independientes: dos padres, un anillo de hubs con hojas conectadas a dos hubs, o gossip como respaldo. Detecta la falla (heartbeats) y reconecta para rodearla.")],
  [t("Why must a node forward only values it hasn't seen?", "¿Por qué un nodo debe reenviar solo los valores que no ha visto?"),
    t("Networks with loops send copies back round. If every copy is forwarded, they multiply without end. Keeping a set of seen value IDs makes handling a duplicate a no-op. That's idempotency, the same idea as idempotency keys on an API.", "Las redes con ciclos devuelven copias. Si se reenvía cada copia, se multiplican sin fin. Guardar un conjunto de IDs de valores vistos hace que un duplicado no cambie nada. Eso es idempotencia, la misma idea que las claves de idempotencia de una API.")],
];

// ---------- page ----------
// Wire routes in screen space, from the lower-numbered node to the higher, for moving copies along them.
const ROUTES = Object.fromEntries(TOPOLOGIES.map((t) => [t, Object.fromEntries(edgesOf(t).map(([a, b]) => {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return [lo + "-" + hi, routeOf(t, lo, hi).map(([x, y]) => k.iso([x, y, 0.3], P).map((v) => Math.round(v * 10) / 10))];
}))]));

// A still frame for the figure at rest: the grid, one value 0.25 s after it entered node 7, copies halfway along their wires.
function stillFrame() {
  const ORIGIN = 6, AT = 0.25, flying = new Map();
  const net = createNet({ topology: "grid", rate: 0, seed: 1 }, { send: (m) => flying.set(m.id, m), deliver: (m) => flying.delete(m.id) });
  net.sendValue(ORIGIN);
  net.runTo(AT);
  const routes = ROUTES.grid, busy = {}, dots = [];
  for (const m of flying.values()) {
    const key = Math.min(m.from, m.to) + "-" + Math.max(m.from, m.to);
    busy[key] = 0.6;
    const pts = m.from < m.to ? routes[key] : [...routes[key]].reverse();
    const u = (AT - m.sent) / HOP;
    dots.push([+(pts[0][0] + (pts[1][0] - pts[0][0]) * u).toFixed(1), +(pts[0][1] + (pts[1][1] - pts[0][1]) * u).toFixed(1)]);
  }
  const lit = [...Array(25).keys()].filter((i) => net.seen[i].has(0));
  return { origin: ORIGIN, lit, busy, dots, mpo: 56, max: 0.8, text: t("value 1 · entered at node 7 · " + lit.length + " of 25 lit", "valor 1 · entró en el nodo 7 · " + lit.length + " de 25 encendidos") };
}
const STILL = stillFrame();

const figure = figurePlate({
  title: t("Signal network", "Red de señales"),
  keys: [
    { mark: "lit", label: t("The value being followed: lamps that have it, pucks for copies on the wires", "El valor que se sigue: lámparas que lo tienen, fichas para las copias en los cables") },
    { mark: "raised", label: t("Relay stations: 25 nodes, collars mark hubs", "Estaciones de relevo: 25 nodos, los collares marcan los hubs") },
    { mark: "flat", label: t("Wires (darker while busy) and two gauges with target pins", "Cables (más oscuros mientras están ocupados) y dos medidores con pines de objetivo") },
  ],
  caption:
    t("Every node must learn every value. A value enters one station (ringed), and copies travel along the wires at 100 ms a hop until every lamp is lit. The network handles 100 values a second; the figure follows one at a time while the rest load the wires. The two gauges on the front edge measure the run: messages per value (left) and the slowest value (right, one tick per 100 ms hop). Tall pins mark challenge 3d’s limits, short pins 3e’s; a slider left of both pins passes. A fence between the second and third columns is a network cut. At 1/4 speed a hop takes 0.4 s.", "Cada nodo debe conocer cada valor. Un valor entra en una estación (marcada con un anillo) y las copias viajan por los cables a 100 ms por salto hasta que se encienden todas las lámparas. La red maneja 100 valores por segundo; la figura sigue uno a la vez mientras el resto carga los cables. Los dos medidores del borde frontal miden la ejecución: mensajes por valor (izquierda) y el valor más lento (derecha, una marca por salto de 100 ms). Los pines altos marcan los límites del desafío 3d, los cortos los de 3e; un cursor a la izquierda de ambos pines pasa. Una valla entre la segunda y la tercera columna es un corte de red. A 1/4 de velocidad un salto tarda 0.4 s."),
  stage: "data-office",
  stageLabel: t("Broadcast network simulation. Space pauses or resumes.", "Simulación de una red de broadcast. Espacio pausa o reanuda."),
  readout: STILL.text,
  svg: buildFigure(STILL),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t(`Based on Fly.io's Gossip Glomers broadcast challenge (3a–3e), where your nodes are verified by Maelstrom: <a href="https://fly.io/dist-sys/" target="_blank" rel="noopener">fly.io/dist-sys</a>. Changing a setting starts the run again.`, `Basado en el desafío de broadcast de Gossip Glomers de Fly.io (3a–3e), donde Maelstrom verifica tus nodos: <a href="https://fly.io/dist-sys/" target="_blank" rel="noopener">fly.io/dist-sys</a>. Cambiar un ajuste reinicia la ejecución.`))}</p>`;
const controls = panel({
  stats: [["mpo", t("Msgs / value", "Msjs / valor"), "–"], ["median", t("Median", "Mediana"), "–"], ["max", t("Max", "Máx"), "–"], ["delivered", t("Reached all", "Llegó a todos"), "–"], ["values", t("Values", "Valores")], ["target", t("Meets", "Cumple"), "–"]],
  controls: [
    seg("topology", t("Topology", "Topología"), [["grid", t("Grid", "Malla")], ["ring", t("Ring", "Anillo")], ["hubs", "Hubs"], ["star", t("Star", "Estrella")], ["direct", t("Direct", "Directo")]], "grid"),
    seg("batch", t("Batching", "Agrupar"), [[0, t("Off", "No")], [0.1, "100 ms"], [0.2, "200 ms"], [0.5, "500 ms"]], 0),
    seg("retries", t("Retry until acked", "Reintentar hasta el ack"), [["false", t("Off", "No")], ["true", t("On", "Sí")]], "false"),
    seg("forward", t("Forward", "Reenviar"), [["new", t("New values only", "Solo valores nuevos")], ["every", t("Every copy", "Cada copia")]], "new"),
    speedSeg([[0.05, "1/20"], [0.1, "1/10"], [0.25, "1/4"], [1, t("Real time", "Tiempo real")]], 0.25),
    actions(t("Do something", "Haz algo"), [["cut", t("Cut the network", "Cortar la red")], ["kill", t("Switch off a hub", "Apagar un hub")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.busy{fill:none;stroke:var(--anatomy-mid);stroke-width:1.6;stroke-linecap:round}
.lens{fill:var(--anatomy-faint);stroke:none}
.lens[data-on]{fill:var(--anatomy-lit)}
.origin-ring{fill:none;stroke:var(--anatomy-lit);stroke-width:1.2;opacity:0}
.origin-ring[data-on]{opacity:1}
.station[data-dead]{opacity:.28}
.msg{fill:var(--anatomy-lit);stroke:none}
`;

// ---------- live code ----------
const live = `
${sim}
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const ROUTES = ${JSON.stringify(ROUTES)};
const GAUGE = ${JSON.stringify({ mpo: gaugeTravel("mpo"), max: gaugeTravel("max") })};
const KILL = { grid: 6, ring: 6, hubs: 6, star: 12, direct: 6 };

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const { T, L } = WB;
const say = (text) => { text = L(text); if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const topoEls = Object.fromEntries(TOPOLOGIES.map((t) => [t, q('[data-topo="' + t + '"]')]));
const busy = Object.fromEntries(TOPOLOGIES.map((t) => [t, Object.fromEntries([...topoEls[t].querySelectorAll("[data-e]")].map((el) => [el.dataset.e, el]))]));
const stations = qa("[data-station]");
const lenses = qa("[data-lens]");
const origins = qa("[data-origin]");
const collars = qa("[data-collar]");
const walls = qa("[data-wall]");
const dotLayer = q("[data-dots]");
dotLayer.textContent = "";
const gaugeEls = { mpo: q('[data-gauge="mpo"]'), max: q('[data-gauge="max"]') };
function setGauge(key, v) { const g = GAUGE[key], f = isFinite(v) ? Math.max(0, Math.min(1, v / g.max)) : 0; gaugeEls[key].setAttribute("transform", "translate(" + (g.dx * f).toFixed(2) + " " + (g.dy * f).toFixed(2) + ")"); }
const dots = Array.from({ length: 90 }, () => { const c = document.createElementNS(NS, "circle"); c.setAttribute("r", "3"); c.setAttribute("class", "msg"); c.style.display = "none"; dotLayer.appendChild(c); return c; });

const cfg = { topology: "grid", batch: 0, retries: false, forward: "new", speed: 0.25 };
let net, inflight, spot, nextSpotAt, history, seed = (Date.now() % 1e6) + 1, killed = null;
const keyOf = (a, b) => (a < b ? a + "-" + b : b + "-" + a);

function restart() {
  inflight = new Map();
  net = createNet({ topology: cfg.topology, batch: cfg.batch, retries: cfg.retries, forward: cfg.forward, rate: 100, seed: seed++, maxInFlight: 6000 }, {
    send: (m) => inflight.set(m.id, m),
    deliver: (m) => inflight.delete(m.id),
    drop: (m) => inflight.delete(m.id),
  });
  spot = null; nextSpotAt = 0.3; history = [[0, 0, 0]]; killed = null;
  TOPOLOGIES.forEach((t) => (topoEls[t].style.display = t === cfg.topology ? "" : "none"));
  const hubs = hubsOf(cfg.topology);
  collars.forEach((c, i) => (c.style.display = hubs.includes(i) ? "" : "none"));
  stations.forEach((s) => s.removeAttribute("data-dead"));
  walls.forEach((w) => (w.style.display = "none"));
  labelButtons();
  paint(); showStats();
}

function labelButtons() {
  cutBtn.textContent = net.partition ? L("Heal the network", "Restablecer la red") : L("Cut the network", "Cortar la red");
  killBtn.textContent = killed !== null ? L("Switch it back on", "Volver a encenderlo") : (cfg.topology === "hubs" || cfg.topology === "star" ? L("Switch off a hub", "Apagar un hub") : L("Switch off a node", "Apagar un nodo"));
  pauseBtn.textContent = clock && clock.paused ? L("Play", "Reanudar") : L("Pause", "Pausa");
}
function setCut(on) {
  net.setPartition(on);
  walls.forEach((w) => (w.style.display = on ? "" : "none"));
  labelButtons();
  say(on ? T("network cut between columns 2 and 3", "red cortada entre las columnas 2 y 3") : T("network healed", "red restablecida"));
}
function setKill(on) {
  const n = KILL[cfg.topology];
  if (on) { net.kill(n); killed = n; stations[n].setAttribute("data-dead", ""); }
  else { net.revive(n); killed = null; stations[n].removeAttribute("data-dead"); }
  labelButtons();
  say(on ? T("node " + (n + 1) + " switched off", "nodo " + (n + 1) + " apagado") : T("node " + (n + 1) + " back on", "nodo " + (n + 1) + " encendido de nuevo"));
}

function pickSpot() {
  const op = net.ops[net.ops.length - 1];
  if (!op) return;
  spot = { id: op.id, origin: op.origin, start: net.t };
}

let statTimer = 0;
function step(dt) {
  const s = dt * cfg.speed;
  net.runTo(net.t + s);
  if (!spot || ((net.ops[spot.id].done || net.t - spot.start > 2.2) && net.t >= nextSpotAt)) {
    if (spot && !nextSpotAt) nextSpotAt = net.t + 0.35;
    if (!spot || net.t >= nextSpotAt) { pickSpot(); nextSpotAt = 0; }
  }
  const last = history[history.length - 1];
  if (net.t - last[0] >= 0.5) { history.push([net.t, net.stats.msgs, net.ops.length]); if (history.length > 24) history.shift(); }
  paint();
  statTimer += dt; if (statTimer > 0.3) { statTimer = 0; showStats(); }
}

function paint() {
  const t = net.t, routes = ROUTES[cfg.topology], load = {};
  let d = 0;
  for (const m of inflight.values()) {
    const key = keyOf(m.from, m.to);
    load[key] = (load[key] || 0) + 1;
    if (spot && d < dots.length && m.kind === "b" && m.values.includes(spot.id)) {
      const pts = routes[key]; if (!pts) continue;
      const path = m.from < m.to ? pts : [...pts].reverse();
      const u = Math.max(0, Math.min(1, (t - m.sent) / HOP));
      const [x, y] = along(path, u);
      dots[d].setAttribute("cx", x.toFixed(1)); dots[d].setAttribute("cy", y.toFixed(1)); dots[d].style.display = ""; d++;
    }
  }
  for (; d < dots.length; d++) dots[d].style.display = "none";
  for (const [key, el] of Object.entries(busy[cfg.topology])) {
    const o = Math.min(1, (load[key] || 0) / 5);
    const v = o > 0.02 ? o.toFixed(2) : "0";
    if (el.style.opacity !== v) el.style.opacity = v;
  }
  lenses.forEach((el, i) => el.toggleAttribute("data-on", !!spot && !net.dead.has(i) && net.seen[i].has(spot.id)));
  origins.forEach((el, i) => el.toggleAttribute("data-on", !!spot && spot.origin === i));
  if (spot) {
    const op = net.ops[spot.id];
    const lit = Math.min(op.have, 25);
    const took = op.done ? Math.round((op.done - op.t0) * 1000) : 0;
    say(T("value " + (spot.id + 1) + " · entered at node " + (spot.origin + 1) + " · " + lit + " of " + op.target + " lit" + (op.done ? " in " + took + " ms" : "") + (net.stats.overload ? " · network flooded" : ""),
      "valor " + (spot.id + 1) + " · entró en el nodo " + (spot.origin + 1) + " · " + lit + " de " + op.target + " encendidos" + (op.done ? " en " + took + " ms" : "") + (net.stats.overload ? " · red saturada" : "")));
  }
}
function along(pts, u) {
  if (pts.length === 2) return [pts[0][0] + (pts[1][0] - pts[0][0]) * u, pts[0][1] + (pts[1][1] - pts[0][1]) * u];
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  let left = u * total;
  for (let i = 0; i < seg.length; i++) { if (left <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, left / seg[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } left -= seg[i]; }
  return pts[pts.length - 1];
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
const ms = (x) => (isFinite(x) ? (x >= 1 ? x.toFixed(2) + " s" : Math.round(x * 1000) + " ms") : "–");
function showStats() {
  const first = history[0], now = [net.t, net.stats.msgs, net.ops.length];
  const ops = now[2] - first[2];
  const mpo = ops > 0 ? (now[1] - first[1]) / ops : NaN;
  // Values from the last 12 s: finished ones give latency; unfinished ones older than 3 s count as not delivered.
  const win = net.ops.filter((o) => o.t0 >= Math.max(0, net.t - 12) && (o.done || o.t0 < net.t - 3));
  const lat = win.filter((o) => o.done).map((o) => o.done - o.t0).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : NaN, max = lat.length ? lat[lat.length - 1] : NaN;
  const delivered = win.length ? lat.length / win.length : NaN;
  statEls.mpo.textContent = isFinite(mpo) ? (mpo >= 100 ? Math.round(mpo).toLocaleString("en-US") : mpo.toFixed(1)) : "–";
  statEls.median.textContent = ms(median);
  statEls.max.textContent = ms(max);
  statEls.delivered.textContent = isFinite(delivered) ? Math.round(delivered * 100) + "%" : "–";
  statEls.values.textContent = net.ops.length.toLocaleString("en-US");
  setGauge("mpo", mpo); setGauge("max", max);
  const ok = (lim) => isFinite(mpo) && lat.length && delivered >= 0.999 && mpo < lim.m && median < lim.med && max < lim.max;
  statEls.target.textContent = !lat.length ? "–" : ok({ m: 20, med: 1, max: 2 }) && ok({ m: 30, med: 0.4, max: 0.6 }) ? "3d + 3e" : ok({ m: 20, med: 1, max: 2 }) ? "3e" : ok({ m: 30, med: 0.4, max: 0.6 }) ? "3d" : L("neither", "ninguno");
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const cutBtn = document.querySelector('[data-act="cut"]');
const killBtn = document.querySelector('[data-act="kill"]');
const clock = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(T("paused", "en pausa")); } });
WB.onLang(() => { labelButtons(); paint(); showStats(); if (clock.paused) say(T("paused", "en pausa")); });
function set(name, raw, quiet) {
  const value = name === "batch" || name === "speed" ? Number(raw) : name === "retries" ? raw === true || raw === "true" : raw;
  cfg[name] = value;
  WB.pressSeg(name, raw);
  if (name !== "speed" && !quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · ejecución reiniciada")); }
}
WB.onSegments((name, value) => set(name, value));
cutBtn.addEventListener("click", () => setCut(!net.partition));
killBtn.addEventListener("click", () => setKill(killed === null));
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); say(T("started over", "empezamos de nuevo")); });
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const n1 = (x) => (x >= 100 ? Math.round(x).toLocaleString("en-US") : x.toFixed(1));
const RUNS = {
  topology: () => {
    const rows = ["grid", "ring", "hubs"].map((t) => [t, runScenario({ topology: t })]);
    const top = Math.max(...rows.map(([, r]) => r.msgsPerOp));
    const name = { grid: T("Grid", "Malla"), ring: T("Ring", "Anillo"), hubs: T("Hubs", "Hubs") };
    return {
      verdict: T(rows.map(([t, r]) => name[t].en + ": " + n1(r.msgsPerOp) + " messages, median " + ms(r.median) + ", max " + ms(r.max)).join(" · ") + ". Only hubs meets 3d.",
        rows.map(([t, r]) => name[t].es + ": " + n1(r.msgsPerOp) + " mensajes, mediana " + ms(r.median) + ", máx " + ms(r.max)).join(" · ") + ". Solo hubs cumple 3d."),
      bars: rows.map(([t, r]) => [name[t], r.msgsPerOp / top, n1(r.msgsPerOp) + " · " + ms(r.max), t === "hubs"]),
    };
  },
  batch: () => {
    const rows = [[0, T("Off", "Sin agrupar")], [0.2, T("Every 200 ms", "Cada 200 ms")], [0.5, T("Every 500 ms", "Cada 500 ms")]].map(([b, label]) => [label, runScenario({ topology: "hubs", batch: b })]);
    const top = Math.max(...rows.map(([, r]) => r.msgsPerOp));
    const [, off] = rows[0], [, b2] = rows[1], [, b5] = rows[2];
    return {
      verdict: T("Messages per value " + n1(off.msgsPerOp) + " → " + n1(b2.msgsPerOp) + ", median " + ms(off.median) + " → " + ms(b2.median) + ", max " + ms(b2.max) + ": inside 3e. At 500 ms the median reaches " + ms(b5.median) + " and misses it.",
        "Mensajes por valor " + n1(off.msgsPerOp) + " → " + n1(b2.msgsPerOp) + ", mediana " + ms(off.median) + " → " + ms(b2.median) + ", máx " + ms(b2.max) + ": dentro de 3e. Con 500 ms la mediana llega a " + ms(b5.median) + " y no lo cumple."),
      bars: rows.map(([label, r], i) => [label, r.msgsPerOp / top, n1(r.msgsPerOp) + " · " + ms(r.median), i === 1]),
    };
  },
  partition: () => {
    const off = average({ topology: "hubs", duration: 10, partition: [3, 6] });
    const on = average({ topology: "hubs", duration: 10, partition: [3, 6], retries: true });
    return {
      verdict: T("Without retries " + pct(off.delivered) + " of values reached every node; the rest never crossed. With retry-until-acked: " + pct(on.delivered) + ", but messages per value went from " + n1(off.msgsPerOp) + " to " + n1(on.msgsPerOp) + ".",
        "Sin reintentos, el " + pct(off.delivered) + " de los valores llegó a todos los nodos; el resto nunca cruzó. Reintentando hasta el ack: " + pct(on.delivered) + ", pero los mensajes por valor pasaron de " + n1(off.msgsPerOp) + " a " + n1(on.msgsPerOp) + "."),
      bars: [[T("No retries", "Sin reintentos"), off.delivered, pct(off.delivered), true], [T("Retry until acked", "Reintentar hasta el ack"), on.delivered, pct(on.delivered)]],
    };
  },
  hub: () => {
    const hubs = average({ topology: "hubs", kill: [6] });
    const grid = average({ topology: "grid", kill: [6] });
    return {
      verdict: T("With the hub off, each value reached " + pct(hubs.reach) + " of the live nodes on average: its six leaves hear nothing and their values go nowhere. The grid with the same node off: " + pct(grid.reach) + ".",
        "Con el hub apagado, cada valor llegó en promedio al " + pct(hubs.reach) + " de los nodos vivos: sus seis hojas no reciben nada y sus valores no llegan a ningún lado. La malla con el mismo nodo apagado: " + pct(grid.reach) + "."),
      bars: [[T("Hubs, hub off", "Hubs, hub apagado"), hubs.reach, pct(hubs.reach), true], [T("Grid, node off", "Malla, nodo apagado"), grid.reach, pct(grid.reach)]],
    };
  },
  forward: () => {
    const newOnly = oneValue({ forward: "new" }), every = oneValue({ forward: "every" });
    return {
      verdict: T("One value caused " + newOnly.msgs + " messages forwarding only new values, and " + every.msgs.toLocaleString("en-US") + " in the first second forwarding every copy, still growing when the second ended.",
        "Un valor causó " + newOnly.msgs + " mensajes reenviando solo valores nuevos, y " + every.msgs.toLocaleString("en-US") + " en el primer segundo reenviando cada copia, y seguía creciendo al terminar ese segundo."),
      bars: [[T("New values only", "Solo valores nuevos"), newOnly.msgs / every.msgs, String(newOnly.msgs)], [T("Every copy", "Cada copia"), 1, every.msgs.toLocaleString("en-US"), true]],
    };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  ["topology", "batch", "retries", "forward"].forEach((name) => set(name, String(w[name]), true));
  restart();
  if (clock.paused) clock.setPaused(false);
  if (w.cut) { setTimeout(() => setCut(true), 1500); setTimeout(() => net.partition && setCut(false), 1500 + 3000 / cfg.speed); }
  if (w.kill) setTimeout(() => setKill(true), 1000);
} });

restart();
`;

const size = writePage(new URL("./broadcast-workbench.html", import.meta.url), {
  title: t("Broadcast Workbench", "Banco de trabajo: broadcast"),
  eyebrow: t("Systems lesson 18 · Broadcast", "Lección de sistemas 18 · Broadcast"),
  lede: t("Broadcast means every node learns every value. Which nodes talk to which (the topology) decides how many messages that costs and how long it takes. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.", "Broadcast (difusión) significa que cada nodo conoce cada valor. Qué nodos hablan con cuáles (la topología) decide cuántos mensajes cuesta y cuánto tarda. Esta lección construye esa idea de tres maneras: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: { intro: t('Values enter at random stations and copies race along the wires. Switch topology and watch messages and latency change, then batch, cut the network or switch off a hub. It follows <a href="https://fly.io/dist-sys/3a/" target="_blank" rel="noopener">Gossip Glomers challenge 3</a>, which Maelstrom verifies for real.', 'Los valores entran en estaciones al azar y las copias corren por los cables. Cambia la topología y mira cómo cambian los mensajes y la latencia; después agrupa, corta la red o apaga un hub. Sigue el <a href="https://fly.io/dist-sys/3a/" target="_blank" rel="noopener">desafío 3 de Gossip Glomers</a>, que Maelstrom verifica de verdad.'), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine: 25 nodes, 100 values a second for 20 s, 100 ms per message.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina: 25 nodos, 100 valores por segundo durante 20 s, 100 ms por mensaje."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote broadcast-workbench.html", (size / 1024).toFixed(0) + " KB");
