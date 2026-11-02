// Systems lesson 04 · Circuit breakers. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, actions, inlineModule, speedSeg, t } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, boxSvg, bladeSvg } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const INCIDENT = [{ at: 0, cause: "failing" }, { at: 20, cause: "healthy" }];
const EXPERIMENTS = [
  {
    id: "slow",
    title: t("The supplier slows down", "El proveedor se pone lento"),
    change: t("Supplier healthy → slow · each call now takes about 6 s · no timeout, no breaker", "Proveedor sano → lento · cada llamada ahora tarda unos 6 s · sin tiempo límite, sin interruptor"),
    question: t("Three in ten requests never call the supplier. What happens to them?", "Tres de cada diez solicitudes nunca llaman al proveedor. ¿Qué les pasa?"),
    options: [
      t("They are served as usual: only supplier calls are affected", "Se atienden como siempre: solo se afectan las llamadas al proveedor"),
      t("They slow down a little while the supplier is slow", "Se vuelven un poco más lentas mientras el proveedor está lento"),
      t("Most of them are turned away too, as if they needed the supplier", "La mayoría también se rechaza, como si necesitaran al proveedor"),
    ],
    answer: 2,
    why: t("Every worker that picks up a supplier request sits on the line for 6 seconds. Requests needing the supplier arrive faster than that, so soon all six workers are stuck waiting and the tray at the door is full. Requests that would take 0.4 s on their own are turned away because there is nobody to serve them. A slow dependency is worse than a dead one: a dead one at least answers quickly.",
      "Cada worker que toma una solicitud para el proveedor se queda 6 segundos en la línea. Las solicitudes que necesitan al proveedor llegan más rápido que eso, así que pronto los seis workers están atascados esperando y la bandeja de la entrada está llena. Solicitudes que solas tardarían 0.4 s se rechazan porque no hay nadie para atenderlas. Una dependencia lenta es peor que una caída: la caída al menos responde rápido."),
    watch: { cause: "slow", timeout: 0, breaker: "false", retries: "0" },
  },
  {
    id: "timeout",
    title: t("Add a timeout", "Agrega un tiempo límite"),
    change: t("Slow supplier, as before · timeout off → 1.5 s", "Proveedor lento, como antes · tiempo límite (timeout) no → 1.5 s"),
    question: t("With a 1.5 s timeout, what happens to the requests that need the supplier?", "Con un tiempo límite de 1.5 s, ¿qué pasa con las solicitudes que necesitan al proveedor?"),
    options: [
      t("They succeed, just faster", "Tienen éxito, solo que más rápido"),
      t("They fail, each after waiting the full 1.5 s, and the other requests are served again", "Fallan, cada una después de esperar los 1.5 s completos, y las demás solicitudes vuelven a atenderse"),
      t("Nothing changes: the supplier is still slow", "Nada cambia: el proveedor sigue lento"),
    ],
    answer: 1,
    why: t("A timeout doesn't make the supplier faster. It caps how long a worker can be held, so workers come back and the requests that don't need the supplier are served again. The supplier requests still fail, and every one of them waits the full timeout first.",
      "Un tiempo límite no hace más rápido al proveedor. Pone un tope a cuánto tiempo se puede retener a un worker, así que los workers vuelven y las solicitudes que no necesitan al proveedor se atienden otra vez. Las solicitudes al proveedor siguen fallando, y cada una espera primero el tiempo límite completo."),
    watch: { cause: "slow", timeout: 1.5, breaker: "false", retries: "0" },
  },
  {
    id: "breaker",
    title: t("Add the breaker", "Agrega el interruptor"),
    change: t("Supplier failing · timeout 1.5 s · breaker off → on (opens after 5 failures in a row, 5 s cooldown)", "Proveedor fallando · tiempo límite 1.5 s · interruptor no → sí (se abre tras 5 fallas seguidas, enfriamiento de 5 s)"),
    question: t("With the breaker on, what happens to the load on the supplier?", "Con el interruptor activado, ¿qué pasa con la carga sobre el proveedor?"),
    options: [
      t("It stays the same: the same requests keep arriving", "Se mantiene igual: siguen llegando las mismas solicitudes"),
      t("It drops to almost nothing, and failures come back almost at once", "Cae casi a cero, y las fallas vuelven casi al instante"),
      t("It doubles, because the breaker keeps probing", "Se duplica, porque el interruptor sigue probando"),
    ],
    answer: 1,
    why: t("After five failures in a row, the breaker opens and requests fail at the breaker instead of waiting on the line. Your workers are free, and the supplier stops receiving calls, apart from one probe after each cooldown. The requests still fail, but quickly, and the supplier gets room to recover.",
      "Tras cinco fallas seguidas, el interruptor se abre y las solicitudes fallan en el interruptor en lugar de esperar en la línea. Tus workers quedan libres, y el proveedor deja de recibir llamadas, salvo una de prueba después de cada enfriamiento. Las solicitudes siguen fallando, pero rápido, y el proveedor tiene espacio para recuperarse."),
    watch: { cause: "failing", timeout: 1.5, breaker: "true", retries: "0" },
  },
  {
    id: "retries",
    title: t("Retry three times", "Reintenta tres veces"),
    change: t("Supplier failing, fixed after 20 s · timeout 1.5 s · retries 0 → 3, no backoff, no breaker", "Proveedor fallando, se arregla a los 20 s · tiempo límite 1.5 s · reintentos 0 → 3, sin espera exponencial (backoff), sin interruptor"),
    question: t("The cause is fixed after 20 s. With three immediate retries per request, when do supplier calls succeed again?", "La causa se arregla a los 20 s. Con tres reintentos inmediatos por solicitud, ¿cuándo vuelven a tener éxito las llamadas al proveedor?"),
    options: [
      t("Sooner: the retries get through as soon as it's fixed", "Antes: los reintentos pasan en cuanto se arregla"),
      t("About the same time as without retries", "Más o menos al mismo tiempo que sin reintentos"),
      t("Much later, or not at all: the retries keep it overloaded", "Mucho después, o nunca: los reintentos lo mantienen sobrecargado"),
    ],
    answer: 2,
    why: t("Each failing request now makes up to four calls, and abandoned calls keep running on the supplier. Its load climbs past what it can handle, so it stays overloaded after the original cause is fixed. The retries become the outage. A breaker in front of the retries cuts the load and lets it recover.",
      "Cada solicitud que falla ahora hace hasta cuatro llamadas, y las llamadas abandonadas siguen corriendo en el proveedor. Su carga sube por encima de lo que puede manejar, así que sigue sobrecargado después de arreglada la causa original. Los reintentos se convierten en la caída. Un interruptor delante de los reintentos corta la carga y lo deja recuperarse."),
    watch: { cause: "failing", timeout: 1.5, breaker: "false", retries: "3", fixAfter: 20 },
  },
  {
    id: "cooldown",
    title: t("A long cooldown", "Un enfriamiento largo"),
    change: t("Supplier failing, fixed after 20 s · timeout 1.5 s · breaker on · cooldown 5 s → 30 s", "Proveedor fallando, se arregla a los 20 s · tiempo límite 1.5 s · interruptor sí · enfriamiento (cooldown) 5 s → 30 s"),
    question: t("With a 30 s cooldown, how soon after the fix does traffic flow again?", "Con un enfriamiento de 30 s, ¿cuánto después del arreglo vuelve a fluir el tráfico?"),
    options: [
      t("Right away: the breaker sees the fix", "De inmediato: el interruptor ve el arreglo"),
      t("Only after the cooldown runs out and a probe gets through", "Solo cuando termina el enfriamiento y pasa una llamada de prueba"),
      t("Never: an open breaker has to be reset by hand", "Nunca: un interruptor abierto se tiene que reiniciar a mano"),
    ],
    answer: 1,
    why: t("An open breaker doesn't watch the supplier. It waits out the cooldown, then lets one probe through (half-open). If the probe succeeds the breaker closes; if it fails it opens for another cooldown. A long cooldown keeps you failing after the supplier is healthy; a short one probes more often but costs little, since it's one call.",
      "Un interruptor abierto no vigila al proveedor. Espera a que termine el enfriamiento y luego deja pasar una llamada de prueba (semiabierto, half-open). Si la prueba tiene éxito, el interruptor se cierra; si falla, se abre por otro enfriamiento. Un enfriamiento largo te deja fallando cuando el proveedor ya está sano; uno corto prueba más seguido pero cuesta poco, porque es una sola llamada."),
    watch: { cause: "failing", timeout: 1.5, breaker: "true", retries: "0", cooldown: 30, fixAfter: 20 },
  },
];

const QUESTIONS = [
  [t("Why can a slow dependency hurt you more than one that is down?", "¿Por qué una dependencia lenta te puede hacer más daño que una caída?"),
    t("A dead dependency fails fast, so your workers are released at once. A slow one holds each worker for the whole call. Once every worker is waiting, nothing else can be served, not even requests that never touch that dependency. That is how one slow service takes down endpoints that have nothing to do with it.",
      "Una dependencia caída falla rápido, así que tus workers se liberan de inmediato. Una lenta retiene a cada worker durante toda la llamada. Cuando todos los workers están esperando, no se puede atender nada más, ni siquiera solicitudes que nunca tocan esa dependencia. Así es como un servicio lento tumba endpoints que no tienen nada que ver con él.")],
  [t("How would you choose a timeout for a call to another service?", "¿Cómo elegirías el tiempo límite (timeout) de una llamada a otro servicio?"),
    t("Start from that service's normal latency (for example its p99 plus a margin) and keep it shorter than your own caller's deadline. Too long and workers pile up behind a slow call; too short and normal jitter turns into false failures. A timeout should be set on purpose, never left at a library default of 30 s or infinity.",
      "Parte de la latencia normal de ese servicio (por ejemplo su p99 más un margen) y mantenlo por debajo del plazo de quien te llama a ti. Demasiado largo y los workers se amontonan detrás de una llamada lenta; demasiado corto y la variación normal (jitter) se vuelve fallas falsas. Un tiempo límite se fija a propósito, nunca se deja en el valor por defecto de una biblioteca de 30 s o infinito.")],
  [t("A circuit breaker protects whom: your service, the supplier, or both?", "Un interruptor de circuito (circuit breaker), ¿a quién protege: a tu servicio, al proveedor o a ambos?"),
    t("Both. It releases your workers by failing fast, and it takes load off the supplier so it can recover. The cost is that requests fail without even trying while it is open, so you need a fallback for them.",
      "A ambos. Libera a tus workers fallando rápido, y le quita carga al proveedor para que se pueda recuperar. El costo es que, mientras está abierto, las solicitudes fallan sin siquiera intentarlo, así que necesitas un plan B (fallback) para ellas.")],
  [t("Why can automatic retries make an outage longer, and how do you retry safely?", "¿Por qué los reintentos automáticos pueden alargar una caída, y cómo se reintenta de forma segura?"),
    t("Retries multiply the load at the worst moment: three retries can mean four times the calls to a struggling service, which keeps it overloaded after the original cause is fixed. Retry only idempotent operations, keep the count small, add exponential backoff with jitter, use a retry budget, and put retries behind a breaker.",
      "Los reintentos multiplican la carga en el peor momento: tres reintentos pueden significar cuatro veces las llamadas a un servicio que ya está en problemas, lo que lo mantiene sobrecargado después de arreglada la causa original. Reintenta solo operaciones idempotentes, mantén pocos reintentos, agrega espera exponencial con variación aleatoria (exponential backoff with jitter), usa un presupuesto de reintentos (retry budget) y pon los reintentos detrás de un interruptor.")],
  [t("What is the half-open state for, and what goes wrong if the cooldown is too long or too short?", "¿Para qué sirve el estado semiabierto (half-open), y qué sale mal si el enfriamiento es demasiado largo o demasiado corto?"),
    t("After the cooldown, half-open lets a single probe through to test the supplier without sending it full traffic. Success closes the breaker; failure opens it again. Too long a cooldown keeps you failing after the supplier has recovered; too short a cooldown makes it flap, which costs little load but makes noisy alerts and logs.",
      "Después del enfriamiento, el estado semiabierto deja pasar una sola llamada de prueba para probar al proveedor sin mandarle todo el tráfico. El éxito cierra el interruptor; la falla lo vuelve a abrir. Un enfriamiento demasiado largo te deja fallando cuando el proveedor ya se recuperó; uno demasiado corto lo hace oscilar (flapping), lo que agrega poca carga pero llena de ruido las alertas y los logs.")],
  [t("The breaker is open. What should the user see?", "El interruptor está abierto. ¿Qué debería ver el usuario?"),
    t("A fast, honest response: a cached or default value, a degraded feature (\"recommendations unavailable\"), or a clear error. Not a spinner that waits for a timeout. Deciding the fallback is part of adding a breaker.",
      "Una respuesta rápida y honesta: un valor en caché o por defecto, una función degradada (\"recomendaciones no disponibles\") o un error claro. No un spinner que espera a que se cumpla el tiempo límite. Decidir el plan B es parte de agregar un interruptor.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Switchboard", "Conmutador"),
  keys: [
    { mark: "lit", label: t("A cord in the trunk: a worker waiting on the supplier", "Un cordón en la troncal: un worker esperando al proveedor") },
    { mark: "raised", label: t("Six operator positions: the thread pool", "Seis puestos de operador: el pool de hilos (thread pool)") },
    { mark: "flat", label: t("Knife-switch breaker between the board and the supplier", "Interruptor de cuchilla entre el tablero y el proveedor") },
  ],
  caption: t(
    "About three calls a second come in; the lamps at the top are calls waiting for a free operator (four at most; the separate lamp flashes when one is turned away). An operator plugs into the lower row for work done in-house, or into the upper trunk row to call the supplier, and stays plugged in until the supplier answers or the timeout pulls the cord. The dial in front of each position shows how long its cord has been in (one turn is 8 s). The breaker's blade is down when closed, half raised when it lets one test call through, and up when open, with a shutter dropped over the trunk jacks. Its dials count failures and the cooldown. The gauge on the supplier shows calls in progress against what it can handle.",
    "Entran unas tres llamadas por segundo; las lámparas de arriba son llamadas esperando a un operador libre (cuatro como máximo; la lámpara aparte parpadea cuando se rechaza una). Un operador se conecta a la fila de abajo para el trabajo que se hace en casa, o a la fila troncal de arriba para llamar al proveedor, y queda conectado hasta que el proveedor responde o el tiempo límite (timeout) saca el cordón. El reloj frente a cada puesto muestra cuánto tiempo lleva conectado su cordón (una vuelta son 8 s). La cuchilla del interruptor está abajo cuando está cerrado, a media altura cuando deja pasar una llamada de prueba, y arriba cuando está abierto, con una cortina bajada sobre los conectores de la troncal. Sus relojes cuentan las fallas y el enfriamiento (cooldown). El medidor del proveedor muestra las llamadas en curso frente a lo que puede manejar."),
  stage: "data-office",
  stageLabel: t("Switchboard simulation. Space pauses or resumes.", "Simulación del conmutador. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const controls = panel({
  stats: [["served", t("Served", "Atendidas")], ["fast", t("Failed fast", "Falla rápida")], ["slow", t("Failed slow", "Falla lenta")], ["dropped", t("Turned away", "Sin lugar")], ["p95", t("p95 wait", "Espera p95"), "–"], ["load", t("Supplier load", "Carga proveedor")]],
  controls: [
    seg("cause", t("Supplier", "Proveedor"), [["healthy", t("Healthy", "Sano")], ["slow", t("Slow", "Lento")], ["failing", t("Failing", "Fallando")]], "healthy"),
    seg("timeout", t("Timeout", "Tiempo límite"), [[0, t("Off", "No")], [1.5, "1.5 s"], [4, "4 s"]], 0),
    seg("breaker", t("Circuit breaker", "Interruptor"), [["false", t("Off", "No")], ["true", t("On", "Sí")]], "false"),
    seg("threshold", t("Opens after", "Se abre tras"), [[3, t("3 fails", "3 fallas")], [5, t("5 fails", "5 fallas")], [10, t("10 fails", "10 fallas")]], 5),
    seg("cooldown", t("Cooldown", "Enfriamiento"), [[5, "5 s"], [30, "30 s"]], 5),
    seg("retries", t("Retries", "Reintentos"), [["0", t("None", "Ninguno")], ["3", t("3 now", "3 ya")], ["3b", t("3 + backoff", "3 + backoff")]], "0"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["reset", t("Reset counts", "Reiniciar conteos")], ["pause", t("Pause", "Pausa")]]),
  ],
});

// Figure-specific styles.
const css = `
[data-op]>[data-v]{display:none}
[data-op][data-state="rest"]>[data-v="rest"],[data-op][data-state="local"]>[data-v="local"],[data-op][data-state="trunk"]>[data-v="trunk"],[data-op][data-state="bounce"]>[data-v="bounce"]{display:inline}
.cord-out{fill:none;stroke:var(--anatomy-mid);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.cord-in{fill:none;stroke:var(--anatomy-card);stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
.cord-lit{fill:none;stroke:var(--anatomy-lit);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.lamp{fill:var(--anatomy-card);stroke:none;transition:fill .15s}
.lamp[data-on]{fill:var(--anatomy-hi)}
.jack-hole{fill:var(--anatomy-hi);stroke:none;opacity:.55}
.gauge-fill{fill:var(--anatomy-mid);stroke:none}
.flow[data-off]{display:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const INCIDENT = ${JSON.stringify(INCIDENT)};

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const readout = document.querySelector("[data-readout]");
const ops = G.OPS.map((_, i) => q('[data-op="' + i + '"]'));
const needles = G.OPS.map((_, i) => q('[data-needle="' + i + '"]'));
const lamps = G.LAMPS.map((_, i) => q('[data-lamp="' + i + '"]'));
const overflowLamp = q("[data-overflow]"), shutter = q("[data-shutter]"), blade = q("[data-blade]");
const failNeedle = q("[data-fail-needle]"), coolNeedle = q("[data-cool-needle]");
const trunkIn = q("[data-trunk-in]"), trunkOut = q("[data-trunk-out]"), gauge = q("[data-gauge]"), knobPath = q("[data-knob]");

let machine = createSim({}, (Date.now() % 1e6) + 1);
let speed = 1, carry = 0, bladeAngle = 0, bladeDrawn = null, shutterLift = G.SHUTTER.lift;
let scheduled = [];
const pops = new Array(G.OPS.length).fill(-1);
const lastCall = new Array(G.OPS.length).fill(-1), replug = new Array(G.OPS.length).fill(-1);
let lastDrop = -1;

function needleD(c, r, z, turn, tail = 1.8) { const a = turn * Math.PI * 2; return lineOnTop([c[0] - Math.sin(a) * tail, c[1] + Math.cos(a) * tail], [c[0] + Math.sin(a) * (r - 1.8), c[1] - Math.cos(a) * (r - 1.8)], z + 0.2, P); }
function knobD(share) { const [x, y] = G.KNOB.c, r = G.KNOB.r, a = -Math.PI * 0.75 + share * Math.PI * 1.5; return lineOnTop([x + Math.sin(a) * 1.2, y - Math.cos(a) * 1.2], [x + Math.sin(a) * (r - 0.8), y - Math.cos(a) * (r - 0.8)], G.KNOB.z + G.KNOB.h + 0.1, P); }
const { T, L } = WB;
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };

function advance(dt) {
  carry += dt;
  while (carry >= STEP) {
    carry -= STEP; machine.step(STEP);
    while (scheduled.length && scheduled[0].at <= machine.s.t) scheduled.shift().fn();
  }
  for (const e of machine.s.events) {
    if (e.kind === "fast" && e.worker >= 0 && e.t > machine.s.t - 0.35) pops[e.worker] = e.t;
    if (e.kind === "drop" && e.t > lastDrop) lastDrop = e.t;
  }
}

const boxSvg = ${boxSvg.toString().replace(/^function boxSvg/, 'function')};
const bladeSvg = ${bladeSvg.toString().replace(/^function bladeSvg/, 'function')};
const ANGLES = G.BLADE.angles;

function paint() {
  const s = machine.s, cfg = machine.cfg, t = s.t;
  let waiting = 0;
  s.workers.forEach((w, i) => {
    const onLine = w.phase === "call";
    if (onLine) {
      waiting++;
      if (lastCall[i] >= 0 && w.callStart !== lastCall[i] && w.callStart - lastCall[i] > 0.01) replug[i] = t;
      lastCall[i] = w.callStart;
    } else lastCall[i] = -1;
    let state = "rest";
    if (pops[i] >= 0 && t - pops[i] < 0.35) state = "bounce";
    else if (onLine) state = replug[i] >= 0 && t - replug[i] < 0.18 ? "rest" : "trunk";
    else if (w.phase === "local" && w.req && w.req.attempts === 0) state = "local";
    if (ops[i].dataset.state !== state) ops[i].dataset.state = state;
    needles[i].setAttribute("d", needleD([G.OPS[i].cx, G.DIAL.y], G.DIAL.r, G.DIAL.z, onLine ? (t - w.callStart) / 8 : 0));
  });
  lamps.forEach((el, i) => el.toggleAttribute("data-on", i < s.queue.length));
  overflowLamp.toggleAttribute("data-on", lastDrop >= 0 && t - lastDrop < 0.4);
  const b = s.breaker, state = cfg.breaker ? b.state : "closed";
  const target = ANGLES[state];
  bladeAngle += (target - bladeAngle) * (WB.still.matches ? 1 : 0.18);
  if (Math.abs(target - bladeAngle) < 0.2) bladeAngle = target;
  const shown = Math.round(bladeAngle * 2) / 2 + (cfg.breaker && state === "open" ? "o" : "");
  if (shown !== bladeDrawn) { blade.innerHTML = bladeSvg(bladeAngle, G.BLADE, P, cfg.breaker && state === "open"); bladeDrawn = shown; }
  const liftTarget = cfg.breaker && state === "open" ? 0 : G.SHUTTER.lift;
  shutterLift += (liftTarget - shutterLift) * (WB.still.matches ? 1 : 0.22);
  if (Math.abs(liftTarget - shutterLift) < 0.05) shutterLift = liftTarget;
  shutter.setAttribute("transform", translateAlong(P, [0, 0, shutterLift]));
  failNeedle.setAttribute("d", needleD(G.FAIL_DIAL.c, G.FAIL_DIAL.r, G.DIAL_TOP, -0.375 + 0.75 * (cfg.breaker ? Math.min(1, b.failures / cfg.threshold) : 0)));
  const cool = cfg.breaker && state === "open" ? Math.max(0, (b.openUntil - t) / cfg.cooldown) : 0;
  coolNeedle.setAttribute("d", needleD(G.COOL_DIAL.c, G.COOL_DIAL.r, G.DIAL_TOP, -0.375 + 0.75 * cool));
  const load = machine.load(), g = G.GAUGE;
  trunkIn.toggleAttribute("data-off", waiting === 0);
  trunkOut.toggleAttribute("data-off", load === 0);
  const fill = Math.min(1, load / g.full);
  gauge.setAttribute("d", fill > 0.005 ? WB.faceRectY(P, g.x0, g.x1, g.y, g.z0, g.z0 + (g.z1 - g.z0) * fill) : "");
  // Painted every frame, so the readout follows the language on its own while running.
  const supplier = cfg.cause === "slow" ? T("supplier slow", "proveedor lento") : cfg.cause === "failing" ? T("supplier failing", "proveedor fallando")
    : s.supplier.recovering ? T("supplier overloaded", "proveedor saturado") : T("supplier ok", "proveedor bien");
  const breakerText = !cfg.breaker ? T("no breaker", "sin interruptor") : state === "half" ? T("breaker half-open · one test call", "interruptor semiabierto · 1 prueba")
    : state === "open" ? T("breaker open", "interruptor abierto") : T("breaker closed", "interruptor cerrado");
  say(L(breakerText) + " · " + L(waiting + " of 6 cords in the trunk", waiting + " de 6 cordones en la troncal") + " · " + L(supplier));
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
let statsAt = 0;
function showStats(force) {
  const now = performance.now();
  if (!force && now - statsAt < 250) return;
  statsAt = now;
  const c = machine.s.counts;
  if (c.latencies.length > 1500) c.latencies.splice(0, c.latencies.length - 1000);
  statEls.served.textContent = c.served;
  statEls.fast.textContent = c.failedFast;
  statEls.slow.textContent = c.failedSlow;
  statEls.dropped.textContent = c.dropped;
  statEls.p95.textContent = c.latencies.length ? p95(c.latencies).toFixed(1) + " s" : "–";
  statEls.load.textContent = machine.load() + " / " + machine.cfg.cap;
}


// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(dt * speed); paint(); showStats(); }, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(L("paused", "en pausa")); } });
// The language switch: relabel the pause button and redraw the readout, even while paused.
WB.onLang(() => { pauseBtn.textContent = clock.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (clock.paused) say(L("paused", "en pausa")); else paint(); });
clock.setPaused(clock.paused);
const pressSeg = WB.pressSeg;
const KNOB_SHARE = { 0: 0, 1.5: 0.45, 4: 1 };
function set(name, raw) {
  if (name === "cause") { machine.set("cause", raw); scheduled = []; }
  if (name === "timeout") { machine.set("timeout", Number(raw)); knobPath.setAttribute("d", knobD(KNOB_SHARE[Number(raw)] ?? 0)); }
  if (name === "breaker") machine.set("breaker", raw === "true");
  if (name === "threshold") machine.set("threshold", Number(raw));
  if (name === "cooldown") machine.set("cooldown", Number(raw));
  if (name === "retries") { machine.set("retries", raw === "0" ? 0 : 3); machine.set("backoff", raw === "3b"); }
  if (name === "speed") speed = Number(raw);
  pressSeg(name, raw);
}
function resetCounts() { machine.resetCounts(); showStats(true); }
WB.onSegments(set);
document.querySelector('[data-act="reset"]').addEventListener("click", resetCounts);
pauseBtn.addEventListener("click", () => clock.setPaused(!clock.paused));
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.setPaused(!clock.paused); } });

// ---------- experiments ----------
const percent = (x) => Math.round(100 * x) + "%";
const secs = (x) => x.toFixed(1) + " s";
const WINDOW = 40;
const recoveryText = (r) => r.recovered === 0 ? T(">\u00a0" + WINDOW + "\u00a0s", ">\u00a0" + WINDOW + "\u00a0s")
  : r.recovered < r.runs ? T(secs(r.recovery) + " (" + r.recovered + " of " + r.runs + " runs)", secs(r.recovery) + " (" + r.recovered + " de " + r.runs + " corridas)")
  : T(secs(r.recovery), secs(r.recovery));
const recoveryShare = (r) => r.recovered === 0 ? 1 : Math.min(1, r.recovery / WINDOW);
const RUNS = {
  slow: () => {
    const a = averageScenario({ options: { cause: "healthy" } }), b = averageScenario({ options: { cause: "slow" } });
    return { verdict: T("Requests that never call the supplier: " + percent(a.localServed) + " served when it was healthy, " + percent(b.localServed) + " when it was slow. " + percent(b.dropped) + " of all requests were turned away at the door.",
        "Solicitudes que nunca llaman al proveedor: " + percent(a.localServed) + " atendidas cuando estaba sano, " + percent(b.localServed) + " cuando estaba lento. El " + percent(b.dropped) + " de todas las solicitudes se rechazó en la entrada."),
      bars: [[T("Healthy supplier", "Proveedor sano"), a.localServed, percent(a.localServed)], [T("Slow supplier", "Proveedor lento"), b.localServed, percent(b.localServed), true]] };
  },
  timeout: () => {
    const a = averageScenario({ options: { cause: "slow" } }), b = averageScenario({ options: { cause: "slow", timeout: 1.5 } });
    const top = Math.max(a.p95Supplier, b.p95Supplier);
    return { verdict: T("Requests that never call the supplier went from " + percent(a.localServed) + " to " + percent(b.localServed) + " served. Supplier requests now fail: " + percent(b.failedSlow) + " of all requests failed after waiting out the timeout.",
        "Las solicitudes que nunca llaman al proveedor pasaron de " + percent(a.localServed) + " a " + percent(b.localServed) + " atendidas. Las solicitudes al proveedor ahora fallan: el " + percent(b.failedSlow) + " de todas las solicitudes falló después de esperar el tiempo límite completo."),
      bars: [[T("No timeout: others served", "Sin límite: otras atendidas"), a.localServed, percent(a.localServed)], [T("1.5 s: others served", "1.5 s: otras atendidas"), b.localServed, percent(b.localServed), true], [T("No timeout: p95 wait", "Sin límite: espera p95"), a.p95Supplier / top, secs(a.p95Supplier)], [T("1.5 s: p95 wait", "1.5 s: espera p95"), b.p95Supplier / top, secs(b.p95Supplier), true]] };
  },
  breaker: () => {
    const a = averageScenario({ options: { cause: "failing", timeout: 1.5 } }), b = averageScenario({ options: { cause: "failing", timeout: 1.5, breaker: true } });
    const top = Math.max(a.p50Supplier, b.p50Supplier);
    return { verdict: T("Calls in progress at the supplier: " + a.load.toFixed(1) + " → " + b.load.toFixed(1) + " on average. A supplier request now fails in " + secs(b.p50Supplier) + " (median), not " + secs(a.p50Supplier) + ".",
        "Llamadas en curso en el proveedor: " + a.load.toFixed(1) + " → " + b.load.toFixed(1) + " en promedio. Una solicitud al proveedor ahora falla en " + secs(b.p50Supplier) + " (mediana), no en " + secs(a.p50Supplier) + "."),
      bars: [[T("Breaker off: load", "Sin interruptor: carga"), a.load / 15, a.load.toFixed(1)], [T("Breaker on: load", "Con interruptor: carga"), b.load / 15, b.load.toFixed(1), true], [T("Breaker off: median wait", "Sin interruptor: espera mediana"), a.p50Supplier / top, secs(a.p50Supplier)], [T("Breaker on: median wait", "Con interruptor: espera mediana"), b.p50Supplier / top, secs(b.p50Supplier), true]] };
  },
  retries: () => {
    const spec = (o) => averageScenario({ options: { timeout: 1.5, ...o }, events: INCIDENT, seconds: 20 + WINDOW, from: 0 });
    const a = spec({}), b = spec({ retries: 3 }), c = spec({ retries: 3, breaker: true });
    const ra = recoveryText(a), rb = recoveryText(b), rc = recoveryText(c);
    return { verdict: T("Time from the fix to the first successful supplier call: " + ra.en + " without retries, " + rb.en + " with three immediate retries, " + rc.en + " with retries behind a breaker.",
        "Tiempo desde el arreglo hasta la primera llamada exitosa al proveedor: " + ra.es + " sin reintentos, " + rb.es + " con tres reintentos inmediatos, " + rc.es + " con reintentos detrás de un interruptor."),
      bars: [[T("No retries", "Sin reintentos"), recoveryShare(a), ra], [T("3 retries", "3 reintentos"), recoveryShare(b), rb, true], [T("3 retries + breaker", "3 reintentos + interruptor"), recoveryShare(c), rc]] };
  },
  cooldown: () => {
    const spec = (o) => averageScenario({ options: { timeout: 1.5, ...o }, events: INCIDENT, seconds: 20 + WINDOW, from: 0 });
    const a = spec({}), b = spec({ breaker: true, cooldown: 5 }), c = spec({ breaker: true, cooldown: 30 });
    const ra = recoveryText(a), rb = recoveryText(b), rc = recoveryText(c);
    return { verdict: T("Time from the fix to the first successful supplier call: " + rb.en + " with a 5 s cooldown, " + rc.en + " with a 30 s cooldown (" + ra.en + " with no breaker at all).",
        "Tiempo desde el arreglo hasta la primera llamada exitosa al proveedor: " + rb.es + " con un enfriamiento de 5 s, " + rc.es + " con uno de 30 s (" + ra.es + " sin ningún interruptor)."),
      bars: [[T("No breaker", "Sin interruptor"), recoveryShare(a), ra], [T("Cooldown 5 s", "Enfriamiento 5 s"), recoveryShare(b), rb], [T("Cooldown 30 s", "Enfriamiento 30 s"), recoveryShare(c), rc, true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  machine = createSim(machine.cfg, (Date.now() % 1e6) + 1);
  set("cause", w.cause); set("timeout", w.timeout); set("breaker", w.breaker); set("retries", w.retries);
  if (w.cooldown) set("cooldown", w.cooldown);
  if (w.fixAfter) scheduled = [{ at: machine.s.t + w.fixAfter, fn: () => { machine.set("cause", "healthy"); pressSeg("cause", "healthy"); } }];
  showStats(true);
  if (clock.paused) clock.setPaused(false);
} });

paint(); showStats(true);
`;

const size = writePage(new URL("./circuit-breaker-workbench.html", import.meta.url), {
  title: t("Circuit Breaker Workbench", "Banco de trabajo: interruptores de circuito"),
  eyebrow: t("Systems lesson 04 · Circuit breakers", "Lección de sistemas 04 · Interruptores de circuito"),
  lede: t("When a service you depend on gets slow or fails, the danger is not the failed calls: it is your own workers waiting on them. This lesson shows how timeouts, retries and a circuit breaker change that, three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Cuando un servicio del que dependes se pone lento o falla, el peligro no son las llamadas fallidas: son tus propios workers esperándolas. Esta lección muestra cómo lo cambian los tiempos límite (timeouts), los reintentos y un interruptor de circuito (circuit breaker), de tres maneras: mira una máquina hacerlo, predice qué la rompe y luego explícalo con tus palabras."),
  machine: { intro: t("The six operator positions are your service's workers. The cabinet at the back right is a supplier you call over the network. Set the supplier to Slow or Failing, then try a timeout, the breaker and retries, and watch the counters.",
    "Los seis puestos de operador son los workers de tu servicio. El gabinete del fondo a la derecha es un proveedor al que llamas por la red. Pon el proveedor en Lento o Fallando, luego prueba un tiempo límite, el interruptor y los reintentos, y mira los contadores."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over eight seeded runs of the same machine, about 50 to 70 seconds of traffic each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados son el promedio de ocho corridas con semilla fija de la misma máquina, de unos 50 a 70 segundos de tráfico cada una."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote circuit-breaker-workbench.html", (size / 1024).toFixed(0) + " KB");
