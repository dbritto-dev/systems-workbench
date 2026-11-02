// Systems lesson 05 · Rate limiting. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, ticketSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "size",
    title: t("A bigger bucket", "Una cubeta más grande"),
    change: t("Bucket 8 tokens → 16 tokens · refill stays at 4 per second", "Cubeta de 8 tokens → 16 tokens · la recarga sigue en 4 por segundo"),
    question: t("Clients want more than the limit all the time. How many requests get through per minute now?", "Los clientes piden más que el límite todo el tiempo. ¿Cuántas solicitudes pasan por minuto ahora?"),
    options: [
      t("About twice as many", "Aproximadamente el doble"),
      t("About the same: only short bursts get bigger", "Aproximadamente las mismas: solo crecen las ráfagas cortas"),
      t("Fewer, because a big bucket takes longer to refill", "Menos, porque una cubeta grande tarda más en recargarse"),
    ],
    answer: 1,
    why: t(
      "Over a long stretch, nothing can get through faster than tokens arrive: 4 per second is 240 per minute, plus one bucketful. The size only decides how big a burst can pass at once after a quiet spell. Size is the burst allowance; the refill rate is the limit.",
      "En un tramo largo, nada pasa más rápido de lo que llegan los tokens: 4 por segundo son 240 por minuto, más una cubeta llena. El tamaño solo decide qué tan grande puede ser una ráfaga que pasa de golpe después de un rato tranquilo. El tamaño es la tolerancia a ráfagas; la tasa de recarga es el límite.",
    ),
    watch: { capacity: 16, rate: 4, algorithm: "bucket", mode: "global", noisy: false, behaviour: "after", instances: 1, burst: true },
  },
  {
    id: "window",
    title: t("The window boundary", "El borde de la ventana"),
    change: t(
      "Fixed window (8 per 2 s) vs token bucket (4/s, holds 8) · a client sends 16 just before a window ends and 16 just after",
      "Ventana fija (8 cada 2 s) vs cubeta de tokens (4/s, caben 8) · un cliente envía 16 justo antes de que termine una ventana y 16 justo después",
    ),
    question: t("With the fixed window, how many get through in that 0.4 s?", "Con la ventana fija, ¿cuántas pasan en esos 0.4 s?"),
    options: [
      t("8, the limit", "8, el límite"),
      t("About 16, twice the limit", "Unas 16, el doble del límite"),
      t("None, the window blocks bursts", "Ninguna, la ventana bloquea las ráfagas"),
    ],
    answer: 1,
    why: t(
      "A fixed window only counts within its own window. 8 fit at the end of one window and 8 more at the start of the next, so twice the limit passes in less than half a second. A token bucket (or a sliding window) has no boundary to exploit: after the first 8 it only lets through what drips in.",
      "Una ventana fija solo cuenta dentro de su propia ventana. Caben 8 al final de una ventana y 8 más al inicio de la siguiente, así que pasa el doble del límite en menos de medio segundo. Una cubeta de tokens (o una ventana deslizante, sliding window) no tiene un borde que aprovechar: después de las primeras 8 solo deja pasar lo que va goteando.",
    ),
    watch: { capacity: 8, rate: 4, algorithm: "window", mode: "global", noisy: false, behaviour: "after", instances: 1 },
  },
  {
    id: "noisy",
    title: t("One noisy client", "Un cliente ruidoso"),
    change: t(
      "Client C sends 8 requests/s, A and B send 1/s · one shared limit of 6/s vs a third of it per client",
      "El cliente C envía 8 solicitudes/s, A y B envían 1/s · un límite compartido de 6/s vs un tercio de él por cliente",
    ),
    question: t("With one shared limit, what happens to A and B?", "Con un límite compartido, ¿qué les pasa a A y B?"),
    options: [
      t("Nothing: they send so little they always get a token", "Nada: envían tan poco que siempre consiguen un token"),
      t("Many of their requests are rejected too", "Muchas de sus solicitudes también se rechazan"),
      t("Only C is slowed down", "Solo C se frena"),
    ],
    answer: 1,
    why: t(
      "A shared bucket doesn't know who is asking. C takes most of the tokens, so A and B find the tube empty as often as C does. A limit per client (per API key, per user, per IP) gives each its own tube, so C only drains its own.",
      "Una cubeta compartida no sabe quién pide. C se lleva la mayoría de los tokens, así que A y B encuentran el tubo vacío tan seguido como C. Un límite por cliente (por API key, por usuario, por IP) le da a cada uno su propio tubo, así que C solo vacía el suyo.",
    ),
    watch: { capacity: 12, rate: 6, algorithm: "bucket", mode: "global", noisy: true, behaviour: "after", instances: 1 },
  },
  {
    id: "retry",
    title: t("Retrying on 429", "Reintentar ante un 429"),
    change: t(
      "Client A bursts 30 requests at once · impatient clients retry every 0.25 s vs clients that wait the Retry-After time (plus jitter)",
      "El cliente A envía una ráfaga de 30 solicitudes de golpe · clientes impacientes que reintentan cada 0.25 s vs clientes que esperan el tiempo de Retry-After (más jitter)",
    ),
    question: t("How many rejected attempts does the limiter see?", "¿Cuántos intentos rechazados ve el limitador?"),
    options: [
      t("The same either way: the burst is the burst", "Los mismos en ambos casos: la ráfaga es la ráfaga"),
      t("Far fewer when clients wait the Retry-After time", "Muchos menos cuando los clientes esperan el tiempo de Retry-After"),
      t("More when clients wait, because they come back all together", "Más cuando los clientes esperan, porque vuelven todos juntos"),
    ],
    answer: 1,
    why: t(
      "A rejected request costs the server something even if it does no work: a connection, parsing, a lookup. Clients that hammer every 0.25 s turn one burst into a stream of rejections. Waiting the Retry-After time, with jitter so they don't all return at once, sends far fewer. Impatient clients also grab tokens first, which is why well-behaved clients need the server to enforce fairness.",
      "Una solicitud rechazada le cuesta algo al servidor aunque no haga trabajo: una conexión, el parseo, una búsqueda. Los clientes que insisten cada 0.25 s convierten una ráfaga en un chorro de rechazos. Esperar el tiempo de Retry-After, con jitter (una variación aleatoria) para que no vuelvan todos a la vez, envía muchos menos. Los clientes impacientes además se quedan primero con los tokens; por eso los clientes que se portan bien necesitan que el servidor imponga la equidad.",
    ),
    watch: { capacity: 8, rate: 4, algorithm: "bucket", mode: "global", noisy: false, behaviour: "now", instances: 1, burst: true },
  },
  {
    id: "instances",
    title: t("Two app instances", "Dos instancias de la app"),
    change: t(
      "1 → 2 app instances behind a load balancer · each keeps its own bucket in memory (4/s, holds 8)",
      "1 → 2 instancias de la app detrás de un balanceador de carga · cada una guarda su propia cubeta en memoria (4/s, caben 8)",
    ),
    question: t("Clients ask for 7.5 requests/s. How many get through per minute now?", "Los clientes piden 7.5 solicitudes/s. ¿Cuántas pasan por minuto ahora?"),
    options: [
      t("The same: the limit is 4/s", "Las mismas: el límite es 4/s"),
      t("About twice as many", "Aproximadamente el doble"),
      t("Fewer, because each instance sees only half the traffic", "Menos, porque cada instancia ve solo la mitad del tráfico"),
    ],
    answer: 1,
    why: t(
      "Each instance enforces 4/s on the half of the traffic it sees, so together they allow 8/s. Every instance you add raises the real limit. A limit meant for the whole service needs one shared counter, usually in Redis, that every instance checks.",
      "Cada instancia aplica 4/s a la mitad del tráfico que ve, así que juntas permiten 8/s. Cada instancia que agregas sube el límite real. Un límite pensado para todo el servicio necesita un solo contador compartido, normalmente en Redis, que revisen todas las instancias.",
    ),
    watch: { capacity: 8, rate: 4, algorithm: "bucket", mode: "global", noisy: false, behaviour: "after", instances: 2, heavy: true },
  },
];

const QUESTIONS = [
  [t("A limit is set as \"bucket 20, refill 5 per second\". What does each number control?",
     "Un límite se define como \"cubeta 20, recarga 5 por segundo\". ¿Qué controla cada número?"),
   t("The refill rate is the long-run limit: never more than 5/s over time, 300 a minute. The bucket size is the burst allowance: after a quiet period, up to 20 can go through at once. Doubling the bucket doesn't raise throughput; doubling the refill does.",
     "La tasa de recarga es el límite a largo plazo: nunca más de 5/s con el tiempo, 300 por minuto. El tamaño de la cubeta es la tolerancia a ráfagas: después de un periodo tranquilo, pueden pasar hasta 20 de golpe. Duplicar la cubeta no sube el rendimiento (throughput); duplicar la recarga sí.")],
  [t("Why is a fixed window easy to exploit, and what fixes it?",
     "¿Por qué es fácil aprovecharse de una ventana fija y qué lo soluciona?"),
   t("It resets at fixed times, so a client can spend the whole limit just before the boundary and again just after, getting twice the limit in a moment. A token bucket or a sliding window (counting the last N seconds at any moment) doesn't have a boundary to exploit.",
     "Se reinicia en momentos fijos, así que un cliente puede gastar todo el límite justo antes del borde y otra vez justo después, y obtener el doble del límite en un instante. Una cubeta de tokens o una ventana deslizante (sliding window, que cuenta los últimos N segundos en cualquier momento) no tiene un borde que aprovechar.")],
  [t("Your API has one global limit and one customer starts a batch job. What do other customers see, and how would you design the limit instead?",
     "Tu API tiene un solo límite global y un cliente arranca un proceso por lotes (batch job). ¿Qué ven los demás clientes y cómo diseñarías el límite en su lugar?"),
   t("They get 429s too, because they share the same tokens. Limit per API key or per user (often with a global limit behind it to protect the service), so a noisy customer only exhausts their own allowance.",
     "También reciben 429, porque comparten los mismos tokens. Limita por API key o por usuario (a menudo con un límite global detrás para proteger el servicio), así un cliente ruidoso solo agota su propia cuota.")],
  [t("What should a well-behaved client do when it gets a 429?",
     "¿Qué debe hacer un cliente que se porta bien cuando recibe un 429?"),
   t("Stop, wait at least the Retry-After time, add random jitter so many clients don't come back at the same instant, and back off further if it keeps getting 429s. Retrying immediately multiplies the load on a server that is already saying it's busy.",
     "Detenerse, esperar al menos el tiempo de Retry-After, agregar un jitter aleatorio para que muchos clientes no vuelvan en el mismo instante, y esperar cada vez más (backoff) si sigue recibiendo 429. Reintentar de inmediato multiplica la carga de un servidor que ya está diciendo que está ocupado.")],
  [t("You run 4 replicas, each with an in-memory limiter of 100 requests/s. What is the real limit, and how do you get a true 100/s?",
     "Tienes 4 réplicas, cada una con un limitador en memoria de 100 solicitudes/s. ¿Cuál es el límite real y cómo consigues 100/s de verdad?"),
   t("About 400/s, and it changes whenever you scale. Keep the counter in a shared store such as Redis (an atomic increment or a small Lua script per request), or rate limit at the gateway in front of the replicas.",
     "Unas 400/s, y cambia cada vez que escalas. Guarda el contador en un almacén compartido como Redis (un incremento atómico o un pequeño script de Lua por solicitud), o limita la tasa en el gateway delante de las réplicas.")],
  [t("Where does rate limiting belong: the API gateway, each service, or the client?",
     "¿Dónde va la limitación de tasa (rate limiting): en el API gateway, en cada servicio o en el cliente?"),
   t("Usually more than one: the gateway or edge for coarse per-client limits that stop abuse early, services for limits that protect a specific expensive resource, and clients for politeness (honouring Retry-After, backing off). Each layer protects something different.",
     "Normalmente en más de un lugar: el gateway o el borde (edge) para límites gruesos por cliente que frenan el abuso temprano, los servicios para límites que protegen un recurso caro específico, y los clientes por cortesía (respetar Retry-After, esperar cada vez más). Cada capa protege algo distinto.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Ticket dispenser", "Dispensador de boletos"),
  keys: [
    { mark: "lit", label: t("A token being added, a ticket being turned away", "Un token que se agrega, un boleto rechazado") },
    { mark: "raised", label: t("Coin tube: the bucket, one disc per token", "Tubo de monedas: la cubeta, un disco por token") },
    { mark: "flat", label: t("Lanes for clients A, B, C, back to front", "Carriles de los clientes A, B, C, de atrás hacia adelante") },
  ],
  caption: t(
    "Each client pushes tickets (requests) along its lane. At the gate a ticket takes one disc from the tube above it and rides on to the served tray; if the tube is empty it goes back to its client with a 429. The dropper adds one disc at the refill rate until the tube is full. The front gate is a second app instance: it only runs with two instances, and has its own tubes.",
    "Cada cliente empuja boletos (solicitudes) por su carril. En la compuerta, un boleto toma un disco del tubo de arriba y sigue hasta la bandeja de atendidos; si el tubo está vacío, vuelve a su cliente con un 429. El dosificador agrega un disco a la tasa de recarga hasta que el tubo se llena. La compuerta de adelante es una segunda instancia de la app: solo funciona con dos instancias y tiene sus propios tubos.",
  ),
  stage: "data-office",
  stageLabel: t("Rate limiter simulation. Space pauses or resumes.", "Simulación del limitador de tasa. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t(
  'Changing a setting starts the run again with full tubes. With "Each client", every client gets a third of the rate and of the bucket.',
  'Cambiar un ajuste reinicia la corrida con los tubos llenos. Con "Cada cliente", cada cliente recibe un tercio de la tasa y de la cubeta.',
))}</p>`;
const controls = panel({
  stats: [["attempts", t("Attempts", "Intentos")], ["allowed", t("Allowed", "Permitidas")], ["rejected", t("Rejected 429", "Rechazadas 429")], ["perMinute", t("Allowed / min", "Permitidas / min"), "–"], ["quiet", t("A, B rejected", "A, B rechazadas"), "–"], ["peak", t("Most in 1 s", "Máximo en 1 s")]],
  controls: [
    seg("rate", t("Refill rate", "Tasa de recarga"), [[2, "2/s"], [4, "4/s"], [6, "6/s"]], 4),
    seg("capacity", t("Bucket size", "Tamaño de cubeta"), [[8, "8"], [16, "16"]], 8),
    seg("algorithm", t("Algorithm", "Algoritmo"), [["bucket", t("Token bucket", "Cubeta de tokens")], ["window", t("Fixed window", "Ventana fija")]], "bucket"),
    seg("mode", t("Limit applies to", "El límite aplica a"), [["global", t("Everyone", "Todos")], ["client", t("Each client", "Cada cliente")]], "global"),
    seg("noisy", t("Client C", "Cliente C"), [["false", t("Normal", "Tranquilo")], ["true", t("Noisy", "Ruidoso")]], "false"),
    seg("behaviour", t("On 429", "Ante un 429"), [["now", t("Retry now", "Reintentar ya")], ["after", t("Wait Retry-After", "Esperar Retry-After")]], "after"),
    seg("instances", t("App instances", "Instancias de la app"), [[1, "1"], [2, "2"]], 1),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["burst", t("Burst of 20 from A", "Ráfaga de 20 de A")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

// Figure-specific styles: the second app instance is hidden while there is one.
const css = `
[data-group][data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const TICKET_SVG = ${JSON.stringify(ticketSvg())};
const POOL = 70, PASS_TIME = 0.9, BACK_TIME = 0.6, DROP_TIME = 0.3;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const { T, L } = WB;
let lastSaid = "";
const say = (v) => { lastSaid = v; const text = L(v); if (readout.textContent !== text) readout.textContent = text; };
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const NS = "http://www.w3.org/2000/svg";
const groups = [0, 1].map((i) => q('[data-group="' + i + '"]'));
const ups = [0, 1].map((i) => q('[data-up="' + i + '"]'));
const downs = [0, 1].map((i) => q('[data-down="' + i + '"]'));
const flaps = G.LANES.map((_, i) => q('[data-flap="' + i + '"]'));
const dials = [0, 1].map((i) => q('[data-dial="' + i + '"]'));
const tubes = {};
for (const el of svg.querySelectorAll("[data-tube]")) tubes[el.dataset.tube] = { el, discs: [...el.querySelectorAll("[data-disc]")], drop: el.querySelector("[data-drop]"), shown: -1, dropT: -1 };

const cfg = { rate: 4, capacity: 8, algorithm: "bucket", window: 2, mode: "global", noisy: false, noisyRate: 8, behaviour: "after", instances: 1, demand: [1, 1, 1], speed: 1 };
let sim, clock, snaps, initial, decided, tickets;
let seed = (Date.now() % 1e6) + 1;

// The pool of ticket groups the figure reuses.
const pool = Array.from({ length: POOL }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = TICKET_SVG; g.style.display = "none"; return { g, solid: g.firstElementChild, busy: false }; });

function restart() {
  sim = makeSim({ ...cfg }, seed++);
  clock = 0; decided = []; tickets = [];
  snaps = sim.limiters.map((row) => row.map(() => []));
  initial = sim.limiters.map((row) => row.map((l) => ({ ...l })));
  pool.forEach((p) => { p.busy = false; p.g.style.display = "none"; });
  groups[1].toggleAttribute("data-off", cfg.instances < 2);
  for (const [key, t] of Object.entries(tubes)) {
    const [inst, which] = key.split("-");
    const shown = cfg.mode === "client" ? which !== "g" : which === "g";
    t.el.style.display = shown ? "" : "none";
    t.used = shown && Number(inst) < cfg.instances; t.shown = -1;
    if (shown && !t.used) t.discs.forEach((d, n) => (d.style.display = n < (which === "g" ? cfg.capacity : Math.ceil(cfg.capacity / 3)) ? "" : "none"));
  }
  dials.forEach((d) => d.setAttribute("d", ""));
  resetCounts();
  showStats();
  paint();
}

function limiterOf(instance, client) { return cfg.mode === "client" ? [instance, client] : [instance, 0]; }
function stateAt(i, j, t) {
  const list = snaps[i][j];
  let s = initial[i][j];
  for (let n = list.length - 1; n >= 0; n--) if (list[n].t <= t) { s = list[n].l; break; }
  return s;
}

function onDecision(d) {
  const [i, j] = limiterOf(d.instance, d.client);
  snaps[i][j].push({ t: d.t, l: { ...sim.limiters[i][j] } });
  decided.push(d);
  tickets.push({ d, lane: d.instance * 3 + d.client, start: d.t - TRAVEL, slot: null, said: false });
}

function laneY(lane) { return G.LANES[lane].y; }
function place(p, x, y, z, lit, opacity) {
  p.g.setAttribute("transform", translateAlong(P, [x, y, z]));
  p.g.style.display = "";
  p.g.style.opacity = String(opacity);
  p.solid.toggleAttribute("data-lit", lit);
}

function paint() {
  // Tubes: discs present at this moment.
  for (const [key, t] of Object.entries(tubes)) {
    if (!t.used) continue;
    const [inst, which] = key.split("-");
    const i = Number(inst), j = which === "g" ? 0 : Number(which);
    const s = stateAt(i, j, clock);
    const level = Math.max(0, Math.min(t.discs.length, Math.floor(levelOf(s, clock) + 1e-9)));
    if (t.shown >= 0 && level === t.shown + 1 && s.kind === "bucket") t.dropT = 0;
    t.shown = level;
    t.discs.forEach((d, n) => { d.style.display = n < level ? "" : "none"; });
  }
  // Window dials.
  dials.forEach((el, i) => {
    if (cfg.algorithm !== "window" || i >= cfg.instances) { el.setAttribute("d", ""); return; }
    const a = ((clock % cfg.window) / cfg.window) * Math.PI * 2, [x, y] = G.DIALS[i];
    el.setAttribute("d", lineOnTop([x, y], [x + Math.sin(a) * 3.2, y - Math.cos(a) * 3.2], 32.5, P));
  });
  // Tickets.
  const lifted = new Set();
  pool.forEach((p) => (p.busy = false));
  let used = 0;
  tickets = tickets.filter((tk) => clock < tk.d.t + (tk.d.ok ? PASS_TIME : BACK_TIME) + 0.05);
  for (const tk of tickets) {
    if (clock < tk.start) continue;
    if (used >= POOL) break;
    const p = pool[used++]; p.busy = true;
    const y = laneY(tk.lane), inst = G.LANES[tk.lane].instance;
    let x, z = G.TICKET.z, lit = false, opacity = 1, after = false;
    if (clock < tk.d.t) { const u = (clock - tk.start) / TRAVEL; x = G.SENDER_X + (G.GATE_X - 7 - G.SENDER_X) * u; opacity = Math.min(1, u * 5); }
    else if (tk.d.ok) { const u = (clock - tk.d.t) / PASS_TIME; x = G.GATE_X - 7 + (G.TRAY_X - G.GATE_X + 7) * ease(Math.min(1, u)); after = x > G.GATE_X; opacity = u > 0.8 ? (1 - u) / 0.2 : 1; if (u < 0.4) lifted.add(tk.lane); }
    else { const u = (clock - tk.d.t) / BACK_TIME; x = G.GATE_X - 7 - (G.GATE_X - 7 - G.SENDER_X) * ease(Math.min(1, u)); lit = true; opacity = u > 0.85 ? (1 - u) / 0.15 : 1; }
    const parent = after ? downs[inst] : ups[inst];
    if (p.g.parentNode !== parent) parent.appendChild(p.g);
    place(p, x, y, z, lit, Math.max(0, opacity));
    if (!tk.said && clock >= tk.d.t) {
      tk.said = true;
      const name = "ABC"[tk.d.client];
      say(tk.d.ok
        ? T("client " + name + " · allowed" + (cfg.instances > 1 ? " by instance " + (tk.d.instance + 1) : ""), "cliente " + name + " · permitida" + (cfg.instances > 1 ? " por la instancia " + (tk.d.instance + 1) : ""))
        : T("client " + name + " · 429" + (tk.d.attempt > 1 ? " (attempt " + tk.d.attempt + ")" : ""), "cliente " + name + " · 429" + (tk.d.attempt > 1 ? " (intento " + tk.d.attempt + ")" : "")));
    }
  }
  pool.forEach((p) => { if (!p.busy) p.g.style.display = "none"; });
  flaps.forEach((f, i) => f.setAttribute("transform", lifted.has(i) ? translateAlong(P, [0, 0, 6]) : ""));
}

function animateDrops(dt) {
  for (const t of Object.values(tubes)) {
    if (t.dropT < 0 || !t.used) { t.drop.style.opacity = "0"; continue; }
    t.dropT += dt / DROP_TIME;
    if (t.dropT >= 1) { t.dropT = -1; t.drop.style.opacity = "0"; continue; }
    const top = G.TUBE_BASE + t.discs.length * G.DISC.h + 6, landing = G.TUBE_BASE + Math.max(0, t.shown - 1) * G.DISC.h;
    t.drop.setAttribute("transform", translateAlong(P, [0, 0, top + (landing - top) * t.dropT * t.dropT]));
    t.drop.style.opacity = "1";
  }
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
let counts, recent;
function resetCounts() { counts = { attempts: 0, allowed: 0, quiet: 0, quietRejected: 0, peak: 0, next: 0 }; recent = []; }
function showStats() {
  while (counts.next < decided.length && decided[counts.next].t <= clock) {
    const d = decided[counts.next++];
    counts.attempts++;
    if (d.client !== 2) { counts.quiet++; if (!d.ok) counts.quietRejected++; }
    if (d.ok) { counts.allowed++; recent.push(d.t); while (recent[0] < d.t - 30) recent.shift(); let n = 0; for (let i = recent.length - 1; i >= 0 && recent[i] >= d.t - 1; i--) n++; counts.peak = Math.max(counts.peak, n); }
  }
  if (counts.next > 2000) { decided.splice(0, counts.next); counts.next = 0; }
  statEls.attempts.textContent = counts.attempts;
  statEls.allowed.textContent = counts.allowed;
  statEls.rejected.textContent = counts.attempts - counts.allowed;
  const span = Math.min(clock, 30);
  statEls.perMinute.textContent = span > 3 ? Math.round((recent.filter((t) => t > clock - span).length / span) * 60) : "–";
  statEls.quiet.textContent = counts.quiet ? Math.round((100 * counts.quietRejected) / counts.quiet) + "%" : "–";
  statEls.peak.textContent = counts.peak;
}

let statTimer = 0;
function step(dt) {
  const s = dt * cfg.speed;
  clock += s;
  sim.runTo(clock + TRAVEL, onDecision);
  paint(); animateDrops(s);
  statTimer += dt; if (statTimer > 0.25) { statTimer = 0; showStats(); }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(T("paused", "en pausa")); } });
const pressSeg = WB.pressSeg;
const NUMERIC = ["rate", "capacity", "instances", "speed"];
function set(name, raw, quiet) {
  const value = NUMERIC.includes(name) ? Number(raw) : name === "noisy" ? raw === true || raw === "true" : raw;
  cfg[name] = value;
  pressSeg(name, raw);
  if (name !== "speed" && !quiet) { restart(); say(T("settings applied · run restarted", "ajustes aplicados · corrida reiniciada")); }
}
function burst(client = 0, n = 20) {
  const t0 = clock + TRAVEL + 0.05;
  for (let i = 0; i < n; i++) sim.add(t0 + i * 0.02, client);
  say(T("client " + "ABC"[client] + " · burst of " + n, "cliente " + "ABC"[client] + " · ráfaga de " + n));
  if (loop.paused) loop.setPaused(false);
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="burst"]').addEventListener("click", () => burst());
document.querySelector('[data-act="reset"]').addEventListener("click", () => { restart(); say(T("started over", "empezó de nuevo")); });
pauseBtn.addEventListener("click", () => loop.toggle());
WB.onLang(() => { pauseBtn.textContent = loop.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); paint(); showStats(); say(lastSaid); });
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const BASE = { rate: 4, capacity: 8, algorithm: "bucket", window: 2, mode: "global", noisy: false, noisyRate: 8, behaviour: "after", instances: 1, demand: [1, 1, 1] };
function burstThrough(capacity) {
  // A quiet bucket, then 20 requests at once: how many pass in that first instant?
  const script = Array.from({ length: 20 }, (_, i) => [10 + i * 0.005, 0]);
  const s = makeSim({ ...BASE, capacity, script, retry: false }, 1); s.runTo(10.2);
  return s.log.filter((d) => d.ok && d.attempt === 1).length;
}
function boundary(algorithm) {
  const script = [];
  for (let i = 0; i < 16; i++) script.push([1.8 + i * 0.012, 0]);
  for (let i = 0; i < 16; i++) script.push([2.02 + i * 0.012, 0]);
  const s = makeSim({ ...BASE, algorithm, script, retry: false }, 1); s.runTo(2.25);
  return s.log.filter((d) => d.ok && d.attempt === 1).length;
}
function retryRun(behaviour) {
  const script = Array.from({ length: 30 }, (_, i) => [5 + i * 0.01, 0]);
  let rejected = 0; const seeds = [3, 5, 7, 11, 13, 17];
  for (const seed of seeds) { const s = makeSim({ ...BASE, script, background: true, behaviour }, seed); s.runTo(60); rejected += s.log.filter((d) => !d.ok).length; }
  return rejected / seeds.length;
}
const RUNS = {
  size: () => {
    const heavy = { ...BASE, demand: [2.5, 2.5, 2.5] };
    const a = average({ ...heavy, capacity: 8 }), b = average({ ...heavy, capacity: 16 });
    const b8 = burstThrough(8), b16 = burstThrough(16), top = Math.max(a.perMinute, b.perMinute);
    return { verdict: T("Per minute: " + Math.round(a.perMinute) + " → " + Math.round(b.perMinute) + ". A burst of 20 after a quiet spell: " + b8 + " → " + b16 + " let through.",
        "Por minuto: " + Math.round(a.perMinute) + " → " + Math.round(b.perMinute) + ". Una ráfaga de 20 después de un rato tranquilo: pasan " + b8 + " → " + b16 + "."),
      bars: [[T("Per min, size 8", "Por min, tamaño 8"), a.perMinute / top, Math.round(a.perMinute)], [T("Per min, size 16", "Por min, tamaño 16"), b.perMinute / top, Math.round(b.perMinute), true], [T("Burst, size 8", "Ráfaga, tamaño 8"), b8 / 20, T(b8 + " of 20", b8 + " de 20")], [T("Burst, size 16", "Ráfaga, tamaño 16"), b16 / 20, T(b16 + " of 20", b16 + " de 20"), true]] };
  },
  window: () => { const w = boundary("window"), b = boundary("bucket"); return { verdict: T("In 0.4 s around the boundary, the fixed window let " + w + " through; the token bucket let " + b + " through. The limit is 8.", "En 0.4 s alrededor del borde, la ventana fija dejó pasar " + w + "; la cubeta de tokens dejó pasar " + b + ". El límite es 8."), bars: [[T("Fixed window", "Ventana fija"), w / 32, String(w), true], [T("Token bucket", "Cubeta de tokens"), b / 32, String(b)]] }; },
  noisy: () => {
    const c = { ...BASE, noisy: true, rate: 6, capacity: 12 };
    const g = average({ ...c, mode: "global" }), p = average({ ...c, mode: "client" });
    return { verdict: T("A and B's attempts rejected: " + pct(g.quietRejected) + " with one shared limit, " + pct(p.quietRejected) + " with a limit per client.", "Intentos de A y B rechazados: " + pct(g.quietRejected) + " con un límite compartido, " + pct(p.quietRejected) + " con un límite por cliente."), bars: [[T("Shared limit", "Límite compartido"), g.quietRejected, pct(g.quietRejected), true], [T("Per client", "Por cliente"), p.quietRejected, pct(p.quietRejected)]] };
  },
  retry: () => { const now = retryRun("now"), after = retryRun("after"), top = Math.max(now, after); return { verdict: T("Rejected attempts in the minute after the burst: " + Math.round(now) + " retrying every 0.25 s, " + Math.round(after) + " waiting the Retry-After time.", "Intentos rechazados en el minuto después de la ráfaga: " + Math.round(now) + " reintentando cada 0.25 s, " + Math.round(after) + " esperando el tiempo de Retry-After."), bars: [[T("Retry now", "Reintentar ya"), now / top, String(Math.round(now)), true], [T("Wait Retry-After", "Esperar Retry-After"), after / top, String(Math.round(after))]] }; },
  instances: () => {
    const heavy = { ...BASE, demand: [2.5, 2.5, 2.5] };
    const one = average({ ...heavy, instances: 1 }), two = average({ ...heavy, instances: 2 }), top = Math.max(one.perMinute, two.perMinute);
    return { verdict: T("Allowed per minute: " + Math.round(one.perMinute) + " with one instance, " + Math.round(two.perMinute) + " with two. The \\"4/s\\" limit is now about 8/s.", "Permitidas por minuto: " + Math.round(one.perMinute) + " con una instancia, " + Math.round(two.perMinute) + " con dos. El límite de \\"4/s\\" ahora es de unos 8/s."), bars: [[T("1 instance", "1 instancia"), one.perMinute / top, Math.round(one.perMinute)], [T("2 instances", "2 instancias"), two.perMinute / top, Math.round(two.perMinute), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["rate", "capacity", "algorithm", "mode", "noisy", "behaviour", "instances"]) set(name, String(w[name]), true);
  cfg.demand = w.heavy ? [2.5, 2.5, 2.5] : [1, 1, 1];
  restart();
  if (loop.paused) loop.setPaused(false);
  if (w.burst) setTimeout(() => burst(0, exp.id === "retry" ? 30 : 20), 2500);
  say(T("watching: " + exp.id, "observando: " + exp.id));
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./rate-limiter-workbench.html", import.meta.url), {
  title: t("Rate Limiter Workbench", "Banco de trabajo: limitador de tasa"),
  eyebrow: t("Systems lesson 05 · Rate limiting", "Lección de sistemas 05 · Limitación de tasa"),
  lede: t('A rate limiter hands out permission at a fixed pace and says "not now" (HTTP 429) when it runs out. This lesson builds the token bucket three ways: watch a machine do it, predict what breaks it, then explain it back.',
    'Un limitador de tasa (rate limiter) reparte permisos a un ritmo fijo y dice "ahora no" (HTTP 429) cuando se le acaban. Esta lección construye la cubeta de tokens (token bucket) de tres maneras: mira cómo lo hace una máquina, predice qué la rompe y después explícalo.'),
  machine: { intro: t("The coin tube is the bucket and each disc is a token. Watch tickets take discs, then empty the tube with a burst, make client C noisy, or add a second app instance.",
    "El tubo de monedas es la cubeta y cada disco es un token. Mira cómo los boletos toman discos; luego vacía el tubo con una ráfaga, haz ruidoso al cliente C o agrega una segunda instancia de la app."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs (60 s each unless noted).",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre seis ejecuciones con semilla fija (60 s cada una salvo que se indique otra cosa)."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote rate-limiter-workbench.html", (size / 1024).toFixed(0) + " KB");
