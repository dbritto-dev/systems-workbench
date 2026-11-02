// Systems lesson 07 · Consistent hashing. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t } from "../../workbench/page.mjs";
import * as F from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "modulo",
    title: t("Add a node, modulo style", "Agregar un nodo, estilo módulo"),
    change: t("bin = hash mod n · nodes 4 → 5", "cajón = hash mod n · nodos 4 → 5"),
    question: t("One node joins a cluster of four. What share of the 1,000 keys has to move to a different node?", "Un nodo se une a un clúster de cuatro. ¿Qué parte de las 1,000 claves tiene que moverse a otro nodo?"),
    options: [
      t("About a fifth: the new node takes its fair share", "Más o menos una quinta parte: el nodo nuevo se lleva su parte justa"),
      t("About half", "Más o menos la mitad"),
      t("About four in five", "Más o menos cuatro de cada cinco"),
    ],
    answer: 2,
    why: t(
      "A key stays put only if hash mod 4 and hash mod 5 happen to agree, and that is true for just 4 numbers in every 20. Everything else is reshuffled, between every pair of nodes, not just toward the new one. On a cache cluster that means four in five reads suddenly miss.",
      "Una clave se queda donde está solo si hash mod 4 y hash mod 5 coinciden por casualidad, y eso pasa solo con 4 de cada 20 números. Todo lo demás se vuelve a repartir, entre cada par de nodos, no solo hacia el nuevo. En un clúster de caché, eso significa que de pronto cuatro de cada cinco lecturas fallan (miss).",
    ),
    watch: { mode: "modulo", count: 4, vnodes: 1, then: { count: 5 } },
  },
  {
    id: "ring",
    title: t("Add a node, on a ring", "Agregar un nodo, en un anillo"),
    change: t("Hash ring, 1 marker per node · nodes 4 → 5", "Anillo de hash, 1 marcador por nodo · nodos 4 → 5"),
    question: t("Same change, but keys go to the next marker clockwise. Which keys move?", "El mismo cambio, pero las claves van al siguiente marcador en sentido horario. ¿Qué claves se mueven?"),
    options: [
      t("About a fifth, all of them taken from one neighbour", "Más o menos una quinta parte, todas tomadas de un solo vecino"),
      t("About a fifth, taken evenly from all four nodes", "Más o menos una quinta parte, tomadas por igual de los cuatro nodos"),
      t("About four in five, the same as modulo", "Más o menos cuatro de cada cinco, igual que con módulo"),
    ],
    answer: 0,
    why: t(
      "The new node's marker lands somewhere on the ring and claims only the arc just before it. Those keys used to slide on to the next marker clockwise, so they all come from that one neighbour. Every other key still reaches the same marker as before.",
      "El marcador del nodo nuevo cae en algún punto del anillo y reclama solo el arco justo antes de él. Esas claves antes seguían hasta el siguiente marcador en sentido horario, así que todas vienen de ese único vecino. Todas las demás claves siguen llegando al mismo marcador que antes.",
    ),
    watch: { mode: "ring", count: 4, vnodes: 1, then: { count: 5 } },
  },
  {
    id: "balance",
    title: t("Is the ring fair?", "¿El anillo es justo?"),
    change: t("Hash ring, 5 nodes · 1 marker per node", "Anillo de hash, 5 nodos · 1 marcador por nodo"),
    question: t(
      "Five nodes, one marker each, placed by hashing. How much does the busiest node get compared with a fair fifth?",
      "Cinco nodos, un marcador cada uno, colocados con hashing. ¿Cuánto recibe el nodo más ocupado comparado con una quinta parte justa?",
    ),
    options: [
      t("About the same: hashing spreads things evenly", "Más o menos lo mismo: el hashing reparte todo de forma pareja"),
      t("About twice its fair share", "Más o menos el doble de su parte justa"),
      t("Nearly all the keys", "Casi todas las claves"),
    ],
    answer: 1,
    why: t(
      "Five random points cut the ring into five arcs of very different lengths, and each node owns one arc. Give every node many markers (virtual nodes) and each node owns many small arcs, which average out: with 100 markers the busiest node is close to fair.",
      "Cinco puntos al azar cortan el anillo en cinco arcos de largos muy distintos, y cada nodo es dueño de un arco. Dale a cada nodo muchos marcadores (nodos virtuales, virtual nodes) y cada nodo es dueño de muchos arcos pequeños, que se compensan: con 100 marcadores el nodo más ocupado queda cerca de lo justo.",
    ),
    watch: { mode: "ring", count: 5, vnodes: 1, then: { vnodes: 100 } },
  },
  {
    id: "fail",
    title: t("A node fails", "Un nodo falla"),
    change: t("Hash ring, 5 nodes, 1 marker per node · node C fails", "Anillo de hash, 5 nodos, 1 marcador por nodo · el nodo C falla"),
    question: t("C's keys must go somewhere. Where do they go?", "Las claves de C tienen que ir a algún lado. ¿A dónde van?"),
    options: [
      t("Spread evenly over the four survivors", "Se reparten por igual entre los cuatro sobrevivientes"),
      t("All to the next node clockwise", "Todas al siguiente nodo en sentido horario"),
      t("Nowhere: they are lost until C comes back", "A ningún lado: se pierden hasta que C vuelva"),
    ],
    answer: 1,
    why: t(
      "With one marker per node, C's whole arc now slides on to the next marker, so one neighbour takes all of C's work on top of its own, often the moment it can least afford it. With many markers C's arcs are scattered round the ring and their next markers belong to different nodes, so the work spreads over everyone.",
      "Con un marcador por nodo, todo el arco de C pasa al siguiente marcador, así que un solo vecino se lleva todo el trabajo de C además del suyo, a menudo justo cuando menos puede con él. Con muchos marcadores, los arcos de C están dispersos por el anillo y sus siguientes marcadores pertenecen a nodos distintos, así que el trabajo se reparte entre todos.",
    ),
    watch: { mode: "ring", count: 5, vnodes: 1, then: { failed: true } },
  },
  {
    id: "hot",
    title: t("One very popular key", "Una clave muy popular"),
    change: t("Hash ring, 100 markers per node · key 7 gets 30% of all requests", "Anillo de hash, 100 marcadores por nodo · la clave 7 recibe el 30% de todas las solicitudes"),
    question: t("Does consistent hashing spread a hot key's traffic?", "¿El hashing consistente reparte el tráfico de una clave caliente (hot key)?"),
    options: [
      t("Yes: its requests are spread around the ring", "Sí: sus solicitudes se reparten por el anillo"),
      t("No: one node serves all of that key, and adding nodes barely helps", "No: un solo nodo atiende toda esa clave, y agregar nodos casi no ayuda"),
      t("Yes, as long as you add enough nodes", "Sí, siempre que agregues suficientes nodos"),
    ],
    answer: 1,
    why: t(
      "Consistent hashing decides where each key lives, and a key lives on one node. The node that owns key 7 carries 30% of the traffic plus its own share of the rest, however many nodes you add. Hot keys need a different tool: replicate that key to several nodes, cache it closer to the callers, or split it into sub-keys.",
      "El hashing consistente decide dónde vive cada clave, y una clave vive en un solo nodo. El nodo dueño de la clave 7 carga el 30% del tráfico más su propia parte del resto, sin importar cuántos nodos agregues. Las claves calientes necesitan otra herramienta: replicar esa clave en varios nodos, cachearla más cerca de quienes la llaman o dividirla en subclaves.",
    ),
    watch: { mode: "ring", count: 3, vnodes: 100, hot: true, then: { count: 6 } },
  },
];

const QUESTIONS = [
  [t("Why does hash mod n move almost every key when n changes by one?",
     "¿Por qué hash mod n mueve casi todas las claves cuando n cambia en uno?"),
   t("A key keeps its node only when hash mod n and hash mod (n + 1) agree, which happens for about 1 in n + 1 keys. So going from 4 to 5 nodes keeps about 1 in 5 and moves the other 80%, between all pairs of nodes, not just onto the new one.",
     "Una clave conserva su nodo solo cuando hash mod n y hash mod (n + 1) coinciden, lo que pasa con más o menos 1 de cada n + 1 claves. Así que pasar de 4 a 5 nodos conserva más o menos 1 de cada 5 y mueve el otro 80%, entre todos los pares de nodos, no solo hacia el nuevo.")],
  [t("On a ring, exactly which keys move when a node is added, and where do they come from?",
     "En un anillo, ¿exactamente qué claves se mueven cuando se agrega un nodo y de dónde vienen?"),
   t("Only the keys in the arc between the new marker and the previous marker counter-clockwise. They used to slide on to the next marker clockwise, so they all come from that node. Every other key reaches the same marker as before.",
     "Solo las claves del arco entre el marcador nuevo y el marcador anterior en sentido antihorario. Antes seguían hasta el siguiente marcador en sentido horario, así que todas vienen de ese nodo. Todas las demás claves llegan al mismo marcador que antes.")],
  [t("What problem do virtual nodes solve? Name two.",
     "¿Qué problemas resuelven los nodos virtuales (virtual nodes)? Nombra dos."),
   t("Balance: a few random markers cut the ring into very uneven arcs (the busiest node had about 2.3× its fair share with one marker); many markers per node average out. Failure: with one marker a dead node's whole arc lands on one neighbour; with many, its arcs spread over all survivors. They also let a bigger machine take more markers.",
     "Equilibrio: unos pocos marcadores al azar cortan el anillo en arcos muy desiguales (con un marcador, el nodo más ocupado tenía unas 2.3× su parte justa); muchos marcadores por nodo se compensan. Fallas: con un marcador, todo el arco de un nodo caído va a parar a un solo vecino; con muchos, sus arcos se reparten entre todos los sobrevivientes. También permiten que una máquina más grande tome más marcadores.")],
  [t("You run a cache cluster in front of a database and add a node. Compare modulo and a ring.",
     "Tienes un clúster de caché delante de una base de datos y agregas un nodo. Compara módulo y un anillo."),
   t("With modulo about 80% of keys now map to a different node, so 80% of reads miss at once and hit the database: the same stampede as emptying the cache. With a ring only about 1 in n + 1 keys move, so the miss spike is small and lands on the keys of one neighbour.",
     "Con módulo, cerca del 80% de las claves pasan a otro nodo, así que el 80% de las lecturas fallan de golpe y van a la base de datos: la misma estampida que vaciar la caché. Con un anillo solo se mueve más o menos 1 de cada n + 1 claves, así que el pico de fallos es pequeño y cae sobre las claves de un solo vecino.")],
  [t("One key gets 30% of all requests and its node is overloaded. What would you do?",
     "Una clave recibe el 30% de todas las solicitudes y su nodo está sobrecargado. ¿Qué harías?"),
   t("Consistent hashing won't help: a key lives on one node. Replicate the hot key to several nodes and read from any of them, cache it closer to the callers (in-process), or split it into sub-keys (key#1…key#n) and combine the results. Also find out why one key is that hot.",
     "El hashing consistente no va a ayudar: una clave vive en un solo nodo. Replica la clave caliente en varios nodos y lee de cualquiera de ellos, cachéala más cerca de quienes la llaman (en el mismo proceso) o divídela en subclaves (key#1…key#n) y combina los resultados. Averigua también por qué una clave está tan caliente.")],
  [t("Where have you met consistent hashing in real systems?",
     "¿Dónde te has encontrado con el hashing consistente en sistemas reales?"),
   t("Memcached and Redis client-side sharding, Cassandra and DynamoDB partitioning, load balancers that keep a user on the same backend (Envoy ring hash, Maglev), and CDNs choosing which edge server holds an object. A good answer also notes that moving a key means moving its data, which is why moving fewer keys matters.",
     "En el sharding del lado del cliente de Memcached y Redis, el particionado de Cassandra y DynamoDB, los balanceadores de carga que mantienen a un usuario en el mismo backend (ring hash de Envoy, Maglev) y las CDN que eligen qué servidor de borde guarda un objeto. Una buena respuesta también señala que mover una clave significa mover sus datos; por eso importa mover menos claves.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Sorting carousel", "Carrusel clasificador"),
  keys: [
    { mark: "lit", label: t("The card in play, and cards that move", "La tarjeta en juego y las tarjetas que se mueven") },
    { mark: "raised", label: t("Turntable: the hash ring, 0–360°", "Plataforma giratoria: el anillo de hash, 0–360°") },
    { mark: "flat", label: t("Bins A–F, left to right: stack height is each node's share", "Cajones A–F, de izquierda a derecha: la altura de la pila es la parte de cada nodo") },
  ],
  caption: t(
    "Each card is one of 1,000 keys. In ring mode it lands at its hash angle, slides clockwise to the next marker peg and goes to that peg's bin. Flip the lever to modulo and the drum picks bin number hash mod n instead. Change the cluster and only the cards that must move fly to their new bin.",
    "Cada tarjeta es una de 1,000 claves. En modo anillo cae en su ángulo de hash, se desliza en sentido horario hasta la siguiente clavija marcadora y va al cajón de esa clavija. Mueve la palanca a módulo y el tambor elige en su lugar el cajón número hash mod n. Cambia el clúster y solo las tarjetas que deben moverse vuelan a su nuevo cajón.",
  ),
  stage: "data-office",
  stageLabel: t("Sorting carousel simulation. Space pauses or resumes.", "Simulación del carrusel clasificador. Espacio pausa o reanuda."),
  svg: F.buildFigure(),
});

const controls = panel({
  stats: [["nodes", t("Nodes", "Nodos"), "4"], ["moved", t("Moved, last change", "Movidas, último cambio"), "–"], ["ratio", t("Busiest ÷ fair", "Más ocupado ÷ justo"), "–"], ["busiest", t("Busiest node", "Nodo más ocupado"), "–"], ["quietest", t("Quietest node", "Nodo menos ocupado"), "–"], ["sorted", t("Cards sorted", "Tarjetas clasificadas")]],
  controls: [
    seg("mode", t("Sorting", "Clasificación"), [["ring", t("Hash ring", "Anillo de hash")], ["modulo", "hash mod n"]], "ring"),
    seg("count", t("Nodes", "Nodos"), [[3, "3"], [4, "4"], [5, "5"], [6, "6"]], 4),
    seg("vnodes", t("Markers per node", "Marcadores por nodo"), [[1, "1"], [10, "10"], [100, "100"]], 1),
    seg("failed", t("Node C", "Nodo C"), [["false", t("Up", "Activo")], ["true", t("Failed", "Caído")]], "false"),
    seg("hot", t("Hot key (30% of traffic)", "Clave caliente (30% del tráfico)"), [["false", t("Off", "No")], ["true", t("On", "Sí")]], "false"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
});

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(F.P)};
const G = ${JSON.stringify(F.GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const k = { iso, depthOf, slabOf, cylinder, solidSvg, lineSvg, dotsSvg, lineOnTop, ring, planOutline, insetPlan, haloOf, sideSeam, translateAlong };
const S = (paths, style) => solidSvg(paths, style), L = (d, style) => lineSvg(d, style), D = (pts, style) => dotsSvg(pts, style), at = (p) => iso(p, P);
const RING = G.RING, DRUM = G.DRUM, BINS = G.BINS, TRAY_H = G.TRAY_H, CARD = G.CARD, STACK_SCALE = G.STACK_SCALE, LEVER = G.LEVER, MOUTH = G.MOUTH;
const rad = (deg) => (deg * Math.PI) / 180;
const onRing = ${F.onRing.toString()};
const onDrum = ${F.onDrum.toString()};
const stackHeight = ${F.stackHeight.toString()};
const stackTop = ${F.stackTop.toString()};
${F.pegsSvg.toString()}
${F.drumFace.toString()}
${F.leverSvg.toString()}
${F.binSvg.toString()}
${F.cardSvg.toString()}
const SALT = 25;
const CARD_SVG = cardSvg();

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const pegsEl = q("[data-pegs]"), trackEl = q("[data-track]"), drumEl = q("[data-drum]"), leverEl = q("[data-lever]"), binsEl = q("[data-bins]"), flyEl = q("[data-fly]");
const DEFAULTS = { mode: "ring", count: 4, vnodes: 1, failed: false, hot: false };
const cfg = { ...DEFAULTS, speed: 1 };
let random = rng(20261019);
let owners, share, points, shown = {}, needle = 0, sorted = 0, lastMove = null, litBin = -1;
let steps = [], current = null;

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const arc = (a, b, t, lift) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) + Math.sin(Math.PI * t) * lift];
// WB.L is Lg here: L draws lines in this figure.
const T = WB.T, Lg = WB.L;
let lastSaid = "";
const say = (v) => { lastSaid = v; const text = Lg(v); if (readout.textContent !== text) readout.textContent = text; };
const pct = (x) => (100 * x).toFixed(x < 0.1 ? 1 : 0) + "%";
const activeNodes = () => NODE_IDS.slice(0, cfg.count).filter((n) => !(cfg.failed && n === "C"));
const binIndex = (node) => NODE_IDS.indexOf(node);
const binState = (i) => i >= cfg.count ? "absent" : cfg.failed && NODE_IDS[i] === "C" ? "down" : "up";

function recompute() {
  const nodes = activeNodes();
  owners = assign({ mode: cfg.mode, nodes, vnodes: cfg.vnodes, salt: SALT });
  share = loads(owners, nodes, cfg.hot);
  points = ringPoints(nodes, cfg.vnodes, SALT);
}
const shareOf = (map, id) => map[id] || 0;

function drawPegs(lit = null) { pegsEl.innerHTML = cfg.mode === "ring" ? pegsSvg(points, lit) : ""; }
function drawDrum(active = false) { drumEl.innerHTML = drumFace(activeNodes().length, needle, active); }
function drawLever() { leverEl.innerHTML = leverSvg(cfg.mode); }
function drawBins() {
  const order = BINS.map((b, i) => i).sort((a, b) => depthOf([BINS[a].cx, BINS[a].y, 0], P) - depthOf([BINS[b].cx, BINS[b].y, 0], P));
  binsEl.innerHTML = order.map((i) => binSvg(i, shareOf(shown, NODE_IDS[i]), binState(i), i === litBin)).join("");
}
const cardAt = (p) => '<g transform="' + translateAlong(P, p) + '">' + CARD_SVG + "</g>";
function drawFly(list) { flyEl.innerHTML = list.map(cardAt).join(""); }
function drawTrack(list) { trackEl.innerHTML = list.map(cardAt).join(""); }

function showStats() {
  const nodes = activeNodes(), s = spread(Object.fromEntries(nodes.map((n) => [n, share[n]])));
  const busiest = nodes.reduce((a, b) => (share[b] > share[a] ? b : a)), quietest = nodes.reduce((a, b) => (share[b] < share[a] ? b : a));
  const set = (key, text) => { document.querySelector('[data-s="' + key + '"]').textContent = Lg(text); };
  set("nodes", T(nodes.length + (cfg.failed && cfg.count >= 3 ? " (C down)" : ""), nodes.length + (cfg.failed && cfg.count >= 3 ? " (C caído)" : "")));
  set("moved", lastMove ? lastMove.count + " · " + pct(lastMove.share) : "–");
  set("ratio", s.ratio.toFixed(2) + "×");
  set("busiest", busiest + " · " + pct(share[busiest]));
  set("quietest", quietest + " · " + pct(share[quietest]));
  set("sorted", sorted);
}

function nextKey() { return cfg.hot && random() < HOT_SHARE ? HOT_KEY : Math.floor(random() * KEYS); }

function streamCard() {
  const key = nextKey(), node = owners[key], bin = binIndex(node), name = "key " + key + (cfg.hot && key === HOT_KEY ? " (hot)" : ""), nameEs = "clave " + key + (cfg.hot && key === HOT_KEY ? " (caliente)" : "");
  const rise = [MOUTH[0], MOUTH[1], MOUTH[2] + 4];
  steps.push({ dur: 0.3, run: (t) => drawFly([[MOUTH[0], MOUTH[1], MOUTH[2] - 6 + 10 * ease(t)]]) });
  if (cfg.mode === "ring") {
    const angle = keyAngle(key), peg = ownerOnRing(points, angle), dist = (peg.angle - angle + 360) % 360;
    const land = [...onRing(angle, RING.track), RING.top];
    say(T(name + " · lands at " + angle.toFixed(0) + "°", nameEs + " · cae en " + angle.toFixed(0) + "°"));
    steps.push({ dur: 0.6, run: (t) => drawFly([arc(rise, land, ease(t), 14)]), done: () => drawFly([]) });
    steps.push({ dur: 0.35 + 1.5 * dist / 360, run: (t) => drawTrack([[...onRing(angle + dist * ease(t), RING.track), RING.top]]) });
    steps.push({ dur: 0.2, begin: () => { drawPegs(peg.angle); say(T(name + " · " + angle.toFixed(0) + "° → marker at " + peg.angle.toFixed(0) + "° → " + node, nameEs + " · " + angle.toFixed(0) + "° → marcador en " + peg.angle.toFixed(0) + "° → " + node)); } });
    const from = [...onRing(peg.angle, RING.track), RING.top];
    steps.push({ dur: 0.75, begin: () => drawTrack([]), run: (t) => drawFly([arc(from, stackTop(bin, shareOf(shown, node)), ease(t), 26)]), done: () => land2(bin) });
  } else {
    const n = activeNodes().length, slot = keyHash(key) % n, top = [DRUM.cx, DRUM.cy, DRUM.top + 0.5];
    say(T(name + " · hash mod " + n + " = " + slot + " → " + node, nameEs + " · hash mod " + n + " = " + slot + " → " + node));
    steps.push({ dur: 0.6, run: (t) => drawFly([arc(rise, top, ease(t), 12)]) });
    const from = needle;
    let to = slot; if (to < from) to += n;
    steps.push({ dur: 0.45, run: (t) => { needle = (from + (to - from) * ease(t)) % n; drawDrum(true); }, done: () => { needle = slot; drawDrum(false); } });
    steps.push({ dur: 0.75, run: (t) => drawFly([arc(top, stackTop(bin, shareOf(shown, node)), ease(t), 24)]), done: () => land2(bin) });
  }
  function land2(b) { drawFly([]); drawPegs(null); sorted++; litBin = b; drawBins(); showStats(); }
  steps.push({ dur: 0.3, done: () => { litBin = -1; drawBins(); } });
}

// Change the cluster: recompute the model, then fly only the cards whose owner changed.
function reconfigure(label, change) {
  const beforeOwners = owners, beforeShare = { ...share };
  change();
  recompute();
  const mv = moved(beforeOwners, owners);
  lastMove = mv;
  const sources = Object.entries(mv.from).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const fromText = mv.count === 0 ? "" : sources.length === 1 ? " · all from " + sources[0] : " · from " + sources.length + " nodes";
  const fromEs = mv.count === 0 ? "" : sources.length === 1 ? " · todas de " + sources[0] : " · de " + sources.length + " nodos";
  steps = []; current = null; drawFly([]); drawTrack([]); drawPegs(null); drawLever(); drawDrum(false); litBin = -1;
  const sample = [];
  for (let key = 0; key < KEYS; key += 25) if (beforeOwners[key] !== owners[key]) sample.push(key);
  const target = { ...share };
  const total = 1.1 + 0.035 * sample.length;
  say(T(label.en + " · " + mv.count + " of 1,000 keys moved (" + pct(mv.share) + ")" + fromText, label.es + " · " + mv.count + " de 1,000 claves se movieron (" + pct(mv.share) + ")" + fromEs));
  steps.push({ dur: total, run: (t) => {
    const time = t * total;
    for (const id of NODE_IDS) shown[id] = lerp(shareOf(beforeShare, id), shareOf(target, id), ease(Math.min(1, time / total)));
    drawBins();
    const flying = [];
    sample.forEach((key, i) => {
      const u = (time - 0.035 * i) / 1.0;
      if (u <= 0 || u >= 1) return;
      const a = binIndex(beforeOwners[key]), b = binIndex(owners[key]);
      flying.push(arc(stackTop(a, shown[beforeOwners[key]] || 0), stackTop(b, shown[owners[key]] || 0), ease(u), 30));
    });
    drawFly(flying);
  }, done: () => { shown = { ...target }; drawFly([]); drawBins(); showStats(); } });
  steps.push({ dur: 1.2 });
  showStats();
}

function advance(dt) {
  let left = dt, guard = 0;
  while (left > 1e-9 && guard++ < 50) {
    if (!current) {
      current = steps.shift();
      if (!current) { streamCard(); continue; }
      current.elapsed = 0; current.begin && current.begin();
    }
    const use = Math.min(current.dur - current.elapsed, left);
    current.elapsed += use; left -= use;
    current.run && current.run(Math.min(1, current.dur ? current.elapsed / current.dur : 1));
    if (current.elapsed >= current.dur - 1e-9) { const c = current; current = null; c.done && c.done(); }
  }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => advance(dt * cfg.speed), onPause: (on) => { pauseBtn.textContent = on ? Lg("Play", "Reanudar") : Lg("Pause", "Pausa"); if (on) say(T("paused", "en pausa")); } });
const pressSeg = WB.pressSeg;
const LABELS = {
  mode: (v) => v === "ring" ? T("switched to the hash ring", "cambio al anillo de hash") : T("switched to hash mod n", "cambio a hash mod n"),
  count: (v, before) => v > before
    ? (v - before === 1 ? T(NODE_IDS[v - 1] + " added", NODE_IDS[v - 1] + " agregado") : T("nodes " + before + " → " + v, "nodos " + before + " → " + v))
    : (before - v === 1 ? T(NODE_IDS[before - 1] + " removed", NODE_IDS[before - 1] + " quitado") : T("nodes " + before + " → " + v, "nodos " + before + " → " + v)),
  vnodes: (v) => T(v + (v === 1 ? " marker" : " markers") + " per node", v + (v === 1 ? " marcador" : " marcadores") + " por nodo"),
  failed: (v) => v ? T("C failed", "C cayó") : T("C is back", "C volvió"),
  hot: (v) => v ? T("key 7 is hot", "la clave 7 está caliente") : T("no hot key", "sin clave caliente"),
};
function apply(changes) {
  const parsed = {};
  for (const [name, raw] of Object.entries(changes)) {
    parsed[name] = name === "count" || name === "vnodes" ? Number(raw) : name === "failed" || name === "hot" ? raw === true || raw === "true" : raw;
  }
  const real = Object.entries(parsed).filter(([name, v]) => cfg[name] !== v);
  for (const [name, v] of Object.entries(parsed)) pressSeg(name, v);
  if (!real.length) return;
  const parts = real.map(([name, v]) => LABELS[name](v, cfg[name]));
  const label = T(parts.map((x) => x.en).join(" · "), parts.map((x) => x.es).join(" · "));
  reconfigure(label, () => { for (const [name, v] of real) cfg[name] = v; });
  if (loop.paused) loop.setPaused(false);
}
WB.onSegments((name, value) => {
  if (name === "speed") { cfg.speed = Number(value); pressSeg("speed", cfg.speed); return; }
  apply({ [name]: value });
});
function startOver(config = DEFAULTS) {
  Object.assign(cfg, config);
  for (const name of Object.keys(DEFAULTS)) pressSeg(name, cfg[name]);
  random = rng(20261019); sorted = 0; lastMove = null; needle = 0;
  recompute(); shown = { ...share }; steps = []; current = null;
  drawPegs(); drawDrum(); drawLever(); drawBins(); drawFly([]); drawTrack([]); showStats();
  say(cfg.mode === "ring" ? T("hash ring · " + activeNodes().length + " nodes", "anillo de hash · " + activeNodes().length + " nodos") : "hash mod " + activeNodes().length);
}
document.querySelector('[data-act="reset"]').addEventListener("click", () => startOver());
pauseBtn.addEventListener("click", () => loop.toggle());
WB.onLang(() => { pauseBtn.textContent = loop.paused ? Lg("Play", "Reanudar") : Lg("Pause", "Pausa"); showStats(); say(lastSaid); });
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const N = (n) => NODE_IDS.slice(0, n);
const RUNS = {
  modulo: () => {
    const m = moved(assign({ mode: "modulo", nodes: N(4) }), assign({ mode: "modulo", nodes: N(5) })).share;
    return { verdict: T(pct(m) + " of the keys moved to a different node, against 20% that had to.", "El " + pct(m) + " de las claves se movió a otro nodo, frente al 20% que tenía que moverse."), bars: [["hash mod n", m, pct(m), true], [T("Least possible", "Mínimo posible"), 0.2, "20%"]] };
  },
  ring: () => {
    const m = moved(assign({ mode: "modulo", nodes: N(4) }), assign({ mode: "modulo", nodes: N(5) })).share;
    const r = overClusters((s) => moved(assign({ nodes: N(4), salt: s }), assign({ nodes: N(5), salt: s })).share);
    const one = overClusters((s) => Object.keys(moved(assign({ nodes: N(4), salt: s }), assign({ nodes: N(5), salt: s })).from).length <= 1 ? 1 : 0);
    return { verdict: T("On average " + pct(r) + " of keys moved, and in " + pct(one) + " of clusters they all came from a single neighbour.", "En promedio se movió el " + pct(r) + " de las claves, y en el " + pct(one) + " de los clústeres todas vinieron de un solo vecino."), bars: [["hash mod n", m, pct(m)], [T("Hash ring", "Anillo de hash"), r, pct(r), true]] };
  },
  balance: () => {
    const ratio = (v) => overClusters((s) => spread(loads(assign({ nodes: N(5), vnodes: v, salt: s }), N(5))).ratio);
    const r1 = ratio(1), r10 = ratio(10), r100 = ratio(100), top = 2.6;
    return { verdict: T("With one marker per node the busiest node carried " + r1.toFixed(2) + "× its fair share on average. With 100 markers, " + r100.toFixed(2) + "×.", "Con un marcador por nodo, el nodo más ocupado cargó en promedio " + r1.toFixed(2) + "× su parte justa. Con 100 marcadores, " + r100.toFixed(2) + "×."), bars: [[T("1 marker", "1 marcador"), r1 / top, r1.toFixed(2) + "×", true], [T("10 markers", "10 marcadores"), r10 / top, r10.toFixed(2) + "×"], [T("100 markers", "100 marcadores"), r100 / top, r100.toFixed(2) + "×"]] };
  },
  fail: () => {
    const without = N(5).filter((n) => n !== "C");
    const receivers = (v) => overClusters((s) => Object.keys(moved(assign({ nodes: N(5), vnodes: v, salt: s }), assign({ nodes: without, vnodes: v, salt: s })).to).length);
    const r1 = receivers(1), r100 = receivers(100);
    return { verdict: T("With one marker per node, C's keys went to " + r1.toFixed(1) + " node on average. With 100 markers they spread over " + r100.toFixed(1) + " of the 4 survivors.", "Con un marcador por nodo, las claves de C fueron en promedio a " + r1.toFixed(1) + " nodo. Con 100 marcadores se repartieron entre " + r100.toFixed(1) + " de los 4 sobrevivientes."), bars: [[T("1 marker", "1 marcador"), r1 / 4, T(r1.toFixed(1) + " of 4", r1.toFixed(1) + " de 4"), true], [T("100 markers", "100 marcadores"), r100 / 4, T(r100.toFixed(1) + " of 4", r100.toFixed(1) + " de 4")]] };
  },
  hot: () => {
    const busiest = (n) => overClusters((s) => spread(loads(assign({ nodes: N(n), vnodes: 100, salt: s }), N(n), true)).max, 50);
    const b3 = busiest(3), b6 = busiest(6);
    return { verdict: T("The busiest node served " + pct(b3) + " of all requests with 3 nodes and still " + pct(b6) + " with 6, where a fair share is 17%.", "El nodo más ocupado atendió el " + pct(b3) + " de todas las solicitudes con 3 nodos y todavía el " + pct(b6) + " con 6, donde la parte justa es 17%."), bars: [[T("3 nodes", "3 nodos"), b3, pct(b3)], [T("6 nodes", "6 nodos"), b6, pct(b6), true], [T("Fair share, 6", "Parte justa, 6"), 1 / 6, "17%"]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const { then, ...first } = exp.watch;
  startOver({ ...DEFAULTS, ...first });
  if (loop.paused) loop.setPaused(false);
  if (then) setTimeout(() => apply(then), 3500);
} });

startOver();
loop.setPaused(loop.paused);
`;

const size = writePage(new URL("./hash-ring-workbench.html", import.meta.url), {
  title: t("Hash Ring Workbench", "Banco de trabajo: anillo de hash"),
  eyebrow: t("Systems lesson 07 · Consistent hashing", "Lección de sistemas 07 · Hashing consistente"),
  lede: t("When data is split across nodes, every key needs a home, and adding or losing a node should move as few keys as possible. This lesson compares two ways of choosing the home, hash mod n and a hash ring, three ways: watch a machine do it, predict what each change does, then explain it back.",
    "Cuando los datos se reparten entre nodos, cada clave necesita un hogar, y agregar o perder un nodo debería mover la menor cantidad posible de claves. Esta lección compara dos formas de elegir ese hogar, hash mod n y un anillo de hash (hash ring), de tres maneras: mira cómo lo hace una máquina, predice qué hace cada cambio y después explícalo."),
  machine: { intro: t("The turntable is the hash ring and the bins along the front are the nodes. Watch a few cards find their bin, then add a node, switch to hash mod n and add it again, and compare how many cards fly.",
    "La plataforma giratoria es el anillo de hash y los cajones del frente son los nodos. Mira cómo algunas tarjetas encuentran su cajón; luego agrega un nodo, cambia a hash mod n, agrégalo otra vez y compara cuántas tarjetas vuelan."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results use the machine's own model with 1,000 keys; ring results are averaged over 200 clusters, because they depend on where the markers happen to land.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados usan el mismo modelo de la máquina con 1,000 claves; los del anillo se promedian sobre 200 clústeres, porque dependen de dónde caen los marcadores."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  script: live,
});
console.log("wrote hash-ring-workbench.html", (size / 1024).toFixed(0) + " KB");
