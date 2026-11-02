// Systems lesson 08 · Canary deploys. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, pointAt, lengthOf } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

const EXPERIMENTS = [
  {
    id: "blast",
    title: t("How many people does a bad build hurt?", "¿A cuántas personas afecta una versión mala?"),
    change: t("Bad build (1 in 5 orders fail) · canary 25% → 1% · automatic rollback on", "Versión mala (falla 1 de cada 5 pedidos) · canario 25% → 1% · reversión automática activada"),
    question: t(
      "At 25%, the rollback arm catches the bad build after about 11 failed orders. At 1%, how many orders fail before it is caught?",
      "Con 25%, el brazo de reversión detecta la versión mala después de unos 11 pedidos fallidos. Con 1%, ¿cuántos pedidos fallan antes de detectarla?",
    ),
    options: [
      t("About 25 times fewer: under 1", "Unas 25 veces menos: menos de 1"),
      t("Fewer, but nowhere near 25 times fewer, and it takes far longer to catch", "Menos, pero ni de cerca 25 veces menos, y tarda mucho más en detectarla"),
      t("The same number, just as fast", "La misma cantidad, igual de rápido"),
    ],
    answer: 1,
    why: t(
      "The rollback arm needs evidence: at least 3 failures before it acts. At 25% those arrive in seconds, but the check only runs every 3 minutes, so more orders fail while it waits. At 1% the canary pays roughly the evidence price and little more, but collecting it takes about 25 minutes. A small canary limits damage per minute, not the minimum damage needed to notice.",
      "El brazo de reversión necesita evidencia: al menos 3 fallos antes de actuar. Con 25% llegan en segundos, pero la revisión solo corre cada 3 minutos, así que fallan más pedidos mientras espera. Con 1%, el canario paga más o menos el precio de la evidencia y poco más, pero juntarla toma unos 25 minutos. Un canario pequeño limita el daño por minuto, no el daño mínimo necesario para darse cuenta.",
    ),
    watch: { pct: 25, build: "bad", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 4 },
  },
  {
    id: "rare",
    title: t("A rare bug", "Un bug raro"),
    change: t("1 order in 200 fails on the new build · canary 10% → 1%", "1 de cada 200 pedidos falla con la versión nueva · canario 10% → 1%"),
    question: t("At 10% the arm needs about 2 hours to be sure. At 1%, how long?", "Con 10%, el brazo necesita unas 2 horas para estar seguro. Con 1%, ¿cuánto?"),
    options: [
      t("About the same: the bug is equally rare", "Más o menos lo mismo: el bug es igual de raro"),
      t("Many hours: it needs the same number of failures from far fewer orders", "Muchas horas: necesita la misma cantidad de fallos con muchos menos pedidos"),
      t("It is caught sooner, because the canary is quieter", "Lo detecta antes, porque el canario está más tranquilo"),
    ],
    answer: 1,
    why: t(
      "The arm needs the same evidence either way, three failures, and at 1 in 200 that means hundreds of canary orders. A 1% canary sees a tenth of the orders, so it takes several times longer. If you promote after a 30-minute bake, this bug ships at both sizes: rare bugs need more traffic or longer bakes, not luck.",
      "El brazo necesita la misma evidencia en ambos casos, tres fallos, y con 1 de cada 200 eso significa cientos de pedidos canario. Un canario de 1% ve una décima parte de los pedidos, así que tarda varias veces más. Si promueves después de 30 minutos de observación (bake), este bug llega a producción con ambos tamaños: los bugs raros necesitan más tráfico o una observación más larga, no suerte.",
    ),
    watch: { pct: 10, build: "rare", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 20 },
  },
  {
    id: "tight",
    title: t("A twitchy rollback", "Una reversión nerviosa"),
    change: t(
      "Good build at 10% for 2 hours · threshold normal → tight (any failure above 0.15%)",
      "Versión buena con 10% durante 2 horas · regla estándar → estricta (cualquier fallo por encima de 0.15%)",
    ),
    question: t(
      "The new build is fine. Both tracks fail 1 order in 1,000 by bad luck. How often does the tight rule roll it back anyway?",
      "La versión nueva está bien. Las dos vías fallan 1 de cada 1,000 pedidos por mala suerte. ¿Qué tan seguido la revierte de todos modos la regla estricta?",
    ),
    options: [
      t("Never: the build is good", "Nunca: la versión es buena"),
      t("Now and then, about 1 deploy in 20", "De vez en cuando, más o menos 1 de cada 20 despliegues"),
      t("Close to half of the deploys", "Cerca de la mitad de los despliegues"),
    ],
    answer: 2,
    why: t(
      "Healthy systems fail a little all the time. With one failure as enough evidence, a single unlucky order early in the canary looks like a regression. False rollbacks are not free: people stop trusting the arm and start overriding it. A good rule asks for several failures and compares against the old version's normal noise.",
      "Los sistemas sanos fallan un poco todo el tiempo. Si un solo fallo basta como evidencia, un único pedido con mala suerte al principio del canario parece una regresión. Las reversiones falsas no son gratis: la gente deja de confiar en el brazo y empieza a pasarlo por alto. Una buena regla pide varios fallos y compara con el ruido normal de la versión vieja.",
    ),
    watch: { pct: 10, build: "good", auto: "on", rule: "tight", routing: "random", check: "errors", speed: 20 },
  },
  {
    id: "sticky",
    title: t("Who sees what", "Quién ve qué"),
    change: t("Good build at 25% for 10 minutes · 100 users, each ordering about 7 times", "Versión buena con 25% durante 10 minutos · 100 usuarios, cada uno con unos 7 pedidos"),
    question: t("With random routing, how many users see both the old and the new version?", "Con enrutamiento aleatorio, ¿cuántos usuarios ven tanto la versión vieja como la nueva?"),
    options: [
      t("Almost none", "Casi ninguno"),
      t("About a quarter, the canary share", "Más o menos una cuarta parte, el porcentaje canario"),
      t("Most of them", "La mayoría"),
    ],
    answer: 2,
    why: t(
      "Random routing decides per request, so a user with 7 orders flips between versions several times: a button moves, a cart format changes, a session written by one version is read by the other. Sticky routing decides per user, so each person stays on one version and the canary share means a share of people.",
      "El enrutamiento aleatorio decide por solicitud, así que un usuario con 7 pedidos salta entre versiones varias veces: un botón se mueve, cambia el formato del carrito, una sesión que escribió una versión la lee la otra. El enrutamiento fijo (sticky) decide por usuario, así que cada persona se queda en una versión y el porcentaje canario significa un porcentaje de personas.",
    ),
    watch: { pct: 25, build: "good", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 4 },
  },
  {
    id: "silent",
    title: t("The bug that doesn't fail", "El bug que no falla"),
    change: t(
      "New build charges the wrong price on 3 orders in 10 · canary 10% · promoted after a 30-minute bake",
      "La versión nueva cobra el precio equivocado en 3 de cada 10 pedidos · canario 10% · promovida tras 30 minutos de observación",
    ),
    question: t(
      "The rollback arm only watches failures. After an hour, how many wrong-price orders went out?",
      "El brazo de reversión solo vigila fallos. Después de una hora, ¿cuántos pedidos con precio erróneo salieron?",
    ),
    options: [
      t("A handful: the canary caught it", "Unos pocos: el canario lo detectó"),
      t("About 70: only the canary's share was hurt", "Unos 70: solo se afectó la parte del canario"),
      t("About 700: it was promoted and everyone got it", "Unos 700: se promovió y les llegó a todos"),
    ],
    answer: 2,
    why: t(
      "Nothing failed, so the error gauge stayed flat and the canary looked perfect. After promotion every order went through the new build. Canaries only catch what you measure: add business checks (prices match the catalogue, orders per minute, payment success) to the analysis and the same build is rolled back within minutes.",
      "Nada falló, así que el indicador de errores se quedó plano y el canario se veía perfecto. Después de la promoción, todos los pedidos pasaron por la versión nueva. Los canarios solo detectan lo que mides: agrega al análisis verificaciones de negocio (que los precios coincidan con el catálogo, pedidos por minuto, pagos exitosos) y la misma versión se revierte en minutos.",
    ),
    watch: { pct: 10, build: "silent", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 20 },
  },
];

const QUESTIONS = [
  [t("Why ship to 1% first instead of everyone, if the 1% canary still lets some orders fail?",
     "¿Por qué enviar primero al 1% en vez de a todos, si el canario de 1% igual deja fallar algunos pedidos?"),
   t("It limits how many people are hurt per minute while you collect evidence, and it limits who is hurt if you miss the signal. You still pay a minimum number of failures to notice anything; a canary turns a full outage into that small, bounded cost.",
     "Limita cuántas personas se ven afectadas por minuto mientras juntas evidencia, y limita a quién afecta si se te escapa la señal. Igual pagas un número mínimo de fallos para notar algo; un canario convierte una caída total en ese costo pequeño y acotado.")],
  [t("A teammate says \"our canary ran for 30 minutes at 1% with zero errors, ship it\". What would you ask?",
     "Alguien de tu equipo dice \"nuestro canario corrió 30 minutos al 1% sin errores, a producción\". ¿Qué preguntarías?"),
   t("How many requests actually went through the canary, and how rare a bug could that sample have caught? At 1% of modest traffic, 30 minutes may be a few hundred requests, which cannot tell a 1-in-200 bug from noise. Ask for a minimum sample size, not just a time.",
     "¿Cuántas solicitudes pasaron realmente por el canario y qué tan raro podía ser un bug para que esa muestra lo detectara? Con el 1% de un tráfico modesto, 30 minutos pueden ser unos cientos de solicitudes, que no distinguen un bug de 1 en 200 del ruido. Pide un tamaño mínimo de muestra, no solo un tiempo.")],
  [t("Your automatic rollback fires on every second deploy, but the builds turn out fine. What's going on, and what would you change?",
     "Tu reversión automática se dispara en uno de cada dos despliegues, pero las versiones resultan estar bien. ¿Qué está pasando y qué cambiarías?"),
   t("The rule treats normal background noise as a regression: too few failures required, or a threshold below the old version's own error rate. Require several failures, compare against the baseline running at the same time, and look at a window long enough to average out bad luck.",
     "La regla trata el ruido normal de fondo como una regresión: pide muy pocos fallos o tiene un umbral por debajo de la propia tasa de errores de la versión vieja. Exige varios fallos, compara con la línea base que corre al mismo tiempo y mira una ventana lo bastante larga para compensar la mala suerte.")],
  [t("When would you route the canary by user instead of by request?",
     "¿Cuándo enrutarías el canario por usuario en vez de por solicitud?"),
   t("Whenever the experience must be consistent for a person: UI changes, multi-step flows, sessions or caches written by one version and read by another, or when you want to say \"5% of users\" rather than \"5% of requests\". Request-level routing is fine for stateless backend changes.",
     "Siempre que la experiencia tenga que ser consistente para una persona: cambios de interfaz, flujos de varios pasos, sesiones o cachés que escribe una versión y lee la otra, o cuando quieres decir \"5% de los usuarios\" en vez de \"5% de las solicitudes\". El enrutamiento por solicitud está bien para cambios de backend sin estado.")],
  [t("Name two things a canary analysis should watch besides HTTP 5xx errors.",
     "Nombra dos cosas que un análisis canario debería vigilar además de los errores HTTP 5xx."),
   t("Business and correctness signals: orders or sign-ups per minute, payment success, values that must match (prices against the catalogue), latency percentiles, and resource use. Silent bugs only show up in what you choose to measure.",
     "Señales de negocio y de corrección: pedidos o registros por minuto, pagos exitosos, valores que deben coincidir (precios contra el catálogo), percentiles de latencia y uso de recursos. Los bugs silenciosos solo aparecen en lo que eliges medir.")],
  [t("The canary is rolled back automatically. What has happened to the users who already got an error, and what does that mean for database changes?",
     "El canario se revierte automáticamente. ¿Qué les pasó a los usuarios que ya recibieron un error y qué significa eso para los cambios en la base de datos?"),
   t("Rollback only stops new damage; failed orders stay failed and data the new version wrote stays written. That's why schema changes are split (expand, deploy, then contract) so either version can run against the same data, and why rollback has to be safe to do at any time.",
     "La reversión solo detiene el daño nuevo; los pedidos fallidos siguen fallidos y los datos que escribió la versión nueva siguen escritos. Por eso los cambios de esquema se dividen (expandir, desplegar y luego contraer), para que cualquiera de las dos versiones pueda correr con los mismos datos, y por eso la reversión tiene que ser segura en cualquier momento.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Railway junction", "Empalme ferroviario"),
  keys: [
    { mark: "lit", label: t("New build: canary track, its trains and its failure needle", "Versión nueva: la vía canario, sus trenes y su aguja de fallos") },
    { mark: "raised", label: t("Old build: the old track and its trains", "Versión vieja: la vía vieja y sus trenes") },
    { mark: "flat", label: t("Lever frame: canary share, and the rollback pusher", "Bastidor de palancas: el porcentaje canario y el empujador de reversión") },
  ],
  caption: t(
    "Each train is one customer order. The lever sets the share of trains switched onto the new track (0, 1, 5, 25, 50 or 100%). A failed order derails before the station; a wrong-price order arrives without its crate. The console shows the old failure rate, the canary failure rate against the threshold mark (scale to 2%), and a timer: every 3 minutes the rollback arm checks the canary and, if it has enough failures above the threshold, pushes the lever back to 0.",
    "Cada tren es un pedido de un cliente. La palanca fija el porcentaje de trenes desviados a la vía nueva (0, 1, 5, 25, 50 o 100%). Un pedido fallido se descarrila antes de la estación; un pedido con precio erróneo llega sin su caja. La consola muestra la tasa de fallos vieja, la tasa de fallos del canario contra la marca del umbral (escala hasta 2%) y un temporizador: cada 3 minutos el brazo de reversión revisa el canario y, si tiene suficientes fallos por encima del umbral, empuja la palanca de vuelta a 0.",
  ),
  stage: "data-office",
  stageLabel: t("Railway junction simulation. Space pauses or resumes.", "Simulación del empalme ferroviario. Espacio pausa o reanuda."),
  svg: buildFigure(16),
});

const controls = panel({
  stats: [["old", t("Old orders · failed", "Pedidos viejos · fallidos")], ["new", t("Canary orders · failed", "Pedidos canario · fallidos")], ["wrong", t("Wrong prices", "Precios erróneos")], ["hit", t("Hurt by canary", "Afectados por canario")], ["mixed", t("Users on both", "Usuarios en ambas")], ["decision", t("Decision", "Decisión"), t("watching", "observando")]],
  controls: [
    seg("pct", t("Canary share", "Porcentaje canario"), [[0, "0%"], [1, "1%"], [5, "5%"], [25, "25%"], [50, "50%"], [100, "100%"]], 5),
    seg("build", t("New build", "Versión nueva"), [["good", t("Good", "Buena")], ["bad", t("Bad", "Mala")], ["rare", t("Rare bug", "Bug raro")], ["silent", t("Wrong prices", "Precios erróneos")]], "good"),
    seg("auto", t("Automatic rollback", "Reversión automática"), [["off", t("Off", "No")], ["on", t("On", "Sí")]], "on"),
    seg("rule", t("Rollback rule", "Regla de reversión"), [["tight", t("Tight", "Estricta")], ["normal", t("Normal", "Estándar")], ["loose", t("Loose", "Laxa")]], "normal"),
    seg("routing", t("Routing", "Enrutamiento"), [["random", t("Per request", "Por solicitud")], ["sticky", t("Per user", "Por usuario")]], "random"),
    seg("check", t("Analysis watches", "El análisis vigila"), [["errors", t("Failures", "Fallos")], ["price", t("Failures + prices", "Fallos + precios")]], "errors"),
    speedSeg([[0.5, "×0.5"], [1, "×1"], [4, "×4"], [20, "×20"]]),
    actions(t("Do something", "Haz algo"), [["promote", t("Promote", "Promover")], ["rollback", t("Roll back", "Revertir")], ["reset", t("New deploy", "Nuevo despliegue")], ["pause", t("Pause", "Pausa")]]),
  ],
});

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const pathPoint = ${pointAt.toString()};
const pathLength = ${lengthOf.toString()};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const LEN = { old: pathLength(G.PATHS.old), new: pathLength(G.PATHS.new) };
const DERAIL_S = pathLength([[-170, 0], [-104, 0], [-64, G.NEW_Y]]) + (G.DERAIL_X + 64);
const SPEED = 62, HEADWAY = 31;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const layers = { old: q('[data-layer="old"]'), new: q('[data-layer="new"]') };
const pools = { old: [...layers.old.querySelectorAll("[data-train]")], new: [...layers.new.querySelectorAll("[data-train]")] };
pools.new.forEach((el) => el.querySelectorAll(".iso-solid").forEach((s) => s.setAttribute("data-lit", "")));
const handle = q("[data-handle]"), pusher = q("[data-pusher]"), pusherSolid = pusher.querySelector(".iso-solid");
const needles = { old: q('[data-needle="old"]'), new: q('[data-needle="new"]'), timer: q('[data-needle="timer"]') }, thresholdTick = q("[data-threshold]");

const cfg = { pct: 5, build: "good", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 1 };
let random = rng(Date.now() % 1e6 + 1);
let d = null;
let waiting = [], trains = [], handleX = 0, pusherX = G.PUSHER_PARK, push = null, promoteAt = null;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const notchX = (pct) => -140 + Math.max(0, G.NOTCHES.indexOf(pct)) * 17;
const { T, L } = WB;
let lastSaid = "";
const say = (v) => { lastSaid = v; const text = L(v); if (readout.textContent !== text) readout.textContent = text; };
const DECISION = { watching: T("watching", "observando"), "rolled back": T("rolled back", "revertida"), promoted: T("promoted", "promovida") };

function deploy() {
  d = newDeploy({ pct: cfg.pct, build: cfg.build, auto: cfg.auto === "on", rule: cfg.rule, routing: cfg.routing, check: cfg.check });
  waiting = []; promoteAt = null;
  push = null; pusherX = G.PUSHER_PARK; pusherSolid.removeAttribute("data-lit");
  handleX = notchX(d.pct);
  draw(); showStats();
}

function spawn(r) { if (waiting.length < 6) waiting.push(r); }
function launch() {
  if (!waiting.length) return;
  const lastOnMain = trains.filter((t) => t.s < 90).reduce((m, t) => Math.min(m, t.s), Infinity);
  if (lastOnMain < HEADWAY) return;
  const r = waiting.shift();
  const track = r.canary ? "new" : "old";
  const el = pools[track].find((e) => !e.dataset.busy);
  if (!el) return;
  el.dataset.busy = "1";
  el.querySelector("[data-crate]").style.display = r.wrong ? "none" : "";
  trains.push({ el, track, s: 0, failed: r.failed, off: 0, gone: 0 });
}
function moveTrains(dt) {
  for (const t of trains) {
    const end = LEN[t.track] - 10;
    if (t.failed && t.s >= DERAIL_S) { t.off = Math.min(1, t.off + dt / 0.9); }
    else if (t.s >= end) { t.gone = Math.min(1, t.gone + dt / 0.5); }
    else t.s = Math.min(end, t.s + SPEED * dt);
    const [x, y] = pathPoint(G.PATHS[t.track], t.s);
    const e = ease(t.off);
    t.el.setAttribute("transform", translateAlong(P, [x, y + 13 * e, -2 * e]));
    const fadeIn = Math.min(1, t.s / 10);
    t.el.style.opacity = String(Math.max(0, fadeIn * (1 - t.off) * (1 - t.gone)));
  }
  trains = trains.filter((t) => { const done = t.off >= 1 || t.gone >= 1; if (done) { delete t.el.dataset.busy; t.el.style.opacity = "0"; } return !done; });
}

function onEvent(kind) {
  if (kind === "rolled back") { push = { phase: 0, t: 0 }; pusherSolid.setAttribute("data-lit", ""); pressSeg("pct", 0); }
}

function advanceAll(dt) {
  advance(d, dt, random, spawn, onEvent);
  if (promoteAt !== null && d.t >= promoteAt && d.decision === "watching") { decide(d, "promoted"); pressSeg("pct", 100); }
  launch();
  moveTrains(dt);
}

function animateLever(dtReal) {
  const target = notchX(d.pct);
  if (push) {
    push.t += dtReal;
    if (push.phase === 0) { pusherX += (handleX + 8 - pusherX) * Math.min(1, dtReal / 0.12); if (Math.abs(pusherX - (handleX + 8)) < 0.3 || push.t > 0.8) { push.phase = 1; push.t = 0; push.from = handleX; } }
    else { const k = ease(Math.min(1, push.t / 0.9)); handleX = push.from + (target - push.from) * k; pusherX = handleX + 8; if (push.t >= 0.9) push.phase = 2; }
  } else {
    handleX += (target - handleX) * Math.min(1, dtReal / 0.15);
    pusherX += (G.PUSHER_PARK - pusherX) * Math.min(1, dtReal / 0.15);
  }
  handle.setAttribute("transform", translateAlong(P, [handleX, 0, 0]));
  pusher.setAttribute("transform", translateAlong(P, [pusherX, 0, 0]));
}

const angleFor = (rate) => G.SWEEP.from + G.SWEEP.span * Math.min(1, rate / 0.02);
const needle = (c, a, len) => lineOnTop([c[0] - Math.sin(a) * 1.8, c[1] + Math.cos(a) * 1.8], [c[0] + Math.sin(a) * len, c[1] - Math.cos(a) * len], G.DIAL_TOP + 0.2, P);
function draw() {
  const oldRate = d.old.req ? d.old.err / d.old.req : 0;
  needles.old.setAttribute("d", needle(G.DIALS.old, angleFor(oldRate), G.DIAL_R - 3));
  needles.new.setAttribute("d", needle(G.DIALS.new, angleFor(canaryRate(d)), G.DIAL_R - 3));
  const ta = angleFor(RULES[cfg.rule].threshold), c = G.DIALS.new, r0 = G.DIAL_R - 3.6, r1 = G.DIAL_R - 1.7;
  thresholdTick.setAttribute("d", lineOnTop([c[0] + Math.sin(ta) * r0, c[1] - Math.cos(ta) * r0], [c[0] + Math.sin(ta) * r1, c[1] - Math.cos(ta) * r1], G.DIAL_TOP + 0.2, P));
  const tc = ((d.t % INTERVAL) / INTERVAL) * Math.PI * 2;
  needles.timer.setAttribute("d", needle(G.DIALS.timer, tc, G.DIAL_R - 3));
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
const pctText = (x) => (100 * x).toFixed(x < 0.1 ? 1 : 0) + "%";
function showStats() {
  statEls.old.textContent = d.old.req + " · " + d.old.err;
  statEls.new.textContent = d.nw.req + " · " + d.nw.err;
  statEls.wrong.textContent = d.nw.wrong;
  statEls.hit.textContent = hitCount(d);
  statEls.mixed.textContent = d.mixed;
  statEls.decision.textContent = L(DECISION[d.decision] || d.decision);
  const fails = canaryFailures(d), rule = RULES[d.rule];
  const left = Math.ceil(INTERVAL - (d.t % INTERVAL));
  let text;
  if (d.decision === "rolled back") text = T("rolled back · " + fails + " failures in " + d.nw.req + " canary orders", "revertida · " + fails + " fallos en " + d.nw.req + " pedidos canario");
  else if (d.decision === "promoted") text = T("promoted · every order on the new build", "promovida · todos los pedidos en la versión nueva");
  else if (promoteAt !== null && d.decision === "watching" && d.pct > 0) text = T("canary " + d.pct + "% · " + fails + " failed, " + d.nw.wrong + " wrong prices · promote in " + Math.max(0, Math.ceil(promoteAt - d.t)) + " s", "canario " + d.pct + "% · " + fails + " fallidos, " + d.nw.wrong + " precios erróneos · se promueve en " + Math.max(0, Math.ceil(promoteAt - d.t)) + " s");
  else if (d.pct === 0) text = T("canary at 0% · nothing to watch", "canario en 0% · nada que vigilar");
  else text = T("canary " + d.pct + "% · " + fails + " of " + d.nw.req + " failed (" + pctText(canaryRate(d)) + ") · check in " + left + " s" + (d.auto ? "" : " · arm off"), "canario " + d.pct + "% · " + fails + " de " + d.nw.req + " fallidos (" + pctText(canaryRate(d)) + ") · revisión en " + left + " s" + (d.auto ? "" : " · brazo apagado"));
  say(text);
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({
  stage,
  step: (dt) => {
    const sim = dt * cfg.speed, steps = Math.ceil(sim / 0.05);
    for (let i = 0; i < steps; i++) advanceAll(sim / steps);
    animateLever(dt); draw(); showStats();
  },
  onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(T("paused", "en pausa")); },
});
const pressSeg = WB.pressSeg;
function set(name, raw) {
  if (name === "speed") { cfg.speed = Number(raw); pressSeg(name, raw); return; }
  cfg[name] = name === "pct" ? Number(raw) : raw;
  pressSeg(name, raw);
  if (name === "pct") {
    if (d.decision !== "watching") deploy();
    else { d.pct = cfg.pct; push = null; pusherSolid.removeAttribute("data-lit"); }
    return;
  }
  if (name === "build" || name === "routing") { deploy(); return; }
  if (name === "auto") d.auto = raw === "on";
  if (name === "rule") d.rule = raw;
  if (name === "check") d.check = raw;
  draw(); showStats();
}
WB.onSegments(set);
document.querySelector('[data-act="promote"]').addEventListener("click", () => { decide(d, "promoted"); push = null; pressSeg("pct", 100); showStats(); });
document.querySelector('[data-act="rollback"]').addEventListener("click", () => { if (d.decision === "watching") { decide(d, "rolled back"); onEvent("rolled back"); showStats(); } });
document.querySelector('[data-act="reset"]').addEventListener("click", () => { if (cfg.pct === 0) { cfg.pct = 5; pressSeg("pct", 5); } deploy(); });
pauseBtn.addEventListener("click", () => clock.toggle());
WB.onLang(() => { pauseBtn.textContent = clock.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); showStats(); if (clock.paused) say(T("paused", "en pausa")); });
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const seedsOf = (n) => Array.from({ length: n }, (_, i) => i + 1);
const minutes = (s) => (s >= 5400 ? (s / 3600).toFixed(1) + " h" : Math.round(s / 60) + " min");
const RUNS = {
  blast: () => {
    const at = (pct) => { const runs = seedsOf(60).map((seed) => runDeploy({ seed, pct, build: "bad", duration: 4 * 3600, stopAtDecision: true })); return { hit: mean(runs.map((x) => x.hitAtDecision ?? hitCount(x))), time: mean(runs.map((x) => x.decidedAt ?? 14400)) }; };
    const a = at(25), b = at(1), top = Math.max(a.hit, b.hit) * 1.1;
    return { verdict: T("Failed orders before rollback: " + a.hit.toFixed(1) + " at 25% (caught in " + minutes(a.time) + "), " + b.hit.toFixed(1) + " at 1% (caught in " + minutes(b.time) + ").", "Pedidos fallidos antes de la reversión: " + a.hit.toFixed(1) + " con 25% (detectada en " + minutes(a.time) + "), " + b.hit.toFixed(1) + " con 1% (detectada en " + minutes(b.time) + ")."), bars: [[T("25% canary", "Canario 25%"), a.hit / top, a.hit.toFixed(1)], [T("1% canary", "Canario 1%"), b.hit / top, b.hit.toFixed(1), true]] };
  },
  rare: () => {
    const at = (pct) => mean(seedsOf(30).map((seed) => { const x = runDeploy({ seed, pct, build: "rare", duration: 48 * 3600, stopAtDecision: true }); return x.decidedAt ?? 48 * 3600; }));
    const a = at(10), b = at(1), top = Math.max(a, b) * 1.1;
    return { verdict: T("Time until the arm rolls it back: " + minutes(a) + " at 10%, " + minutes(b) + " at 1%. A 30-minute bake would have promoted it either way.", "Tiempo hasta que el brazo la revierte: " + minutes(a) + " con 10%, " + minutes(b) + " con 1%. Con 30 minutos de observación se habría promovido en ambos casos."), bars: [[T("10% canary", "Canario 10%"), a / top, minutes(a)], [T("1% canary", "Canario 1%"), b / top, minutes(b), true], [T("30-minute bake", "Observación de 30 min"), 1800 / top, "30 min"]] };
  },
  tight: () => {
    const share = (rule) => seedsOf(200).filter((seed) => runDeploy({ seed, pct: 10, build: "good", rule, duration: 7200 }).decision === "rolled back").length / 200;
    const a = share("normal"), b = share("tight");
    return { verdict: T("A good build was rolled back in " + Math.round(100 * b) + "% of deploys with the tight rule, " + Math.round(100 * a) + "% with the normal one.", "Una versión buena se revirtió en el " + Math.round(100 * b) + "% de los despliegues con la regla estricta y en el " + Math.round(100 * a) + "% con la estándar."), bars: [[T("Normal rule", "Regla estándar"), a, Math.round(100 * a) + "%"], [T("Tight rule", "Regla estricta"), b, Math.round(100 * b) + "%", true]] };
  },
  sticky: () => {
    const share = (routing) => mean(seedsOf(30).map((seed) => { const x = runDeploy({ seed, pct: 25, build: "good", routing, duration: 600 }); return x.mixed / Math.max(1, x.active); }));
    const a = share("random"), b = share("sticky");
    return { verdict: T(Math.round(100 * a) + "% of users saw both versions with per-request routing, " + Math.round(100 * b) + "% with per-user routing.", "El " + Math.round(100 * a) + "% de los usuarios vio ambas versiones con enrutamiento por solicitud y el " + Math.round(100 * b) + "% con enrutamiento por usuario."), bars: [[T("Per request", "Por solicitud"), a, Math.round(100 * a) + "%", true], [T("Per user", "Por usuario"), b, Math.round(100 * b) + "%"]] };
  },
  silent: () => {
    const wrong = (check) => { const runs = seedsOf(30).map((seed) => runDeploy({ seed, pct: 10, build: "silent", check, duration: 3600, promoteAt: 1800 })); return { n: mean(runs.map((x) => x.nw.wrong)), promoted: runs.filter((x) => x.decision === "promoted").length / runs.length }; };
    const a = wrong("errors"), b = wrong("price"), top = Math.max(a.n, b.n) * 1.05;
    return { verdict: T("Watching failures only: " + Math.round(a.n) + " wrong-price orders, promoted in " + Math.round(100 * a.promoted) + "% of runs. Watching prices too: " + Math.round(b.n) + ", rolled back within minutes.", "Vigilando solo fallos: " + Math.round(a.n) + " pedidos con precio erróneo, promovida en el " + Math.round(100 * a.promoted) + "% de las ejecuciones. Vigilando también los precios: " + Math.round(b.n) + ", revertida en minutos."), bars: [[T("Failures only", "Solo fallos"), a.n / top, String(Math.round(a.n)), true], [T("Failures + prices", "Fallos + precios"), b.n / top, String(Math.round(b.n))]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const name of ["pct", "build", "auto", "rule", "routing", "check", "speed"]) { cfg[name] = name === "pct" || name === "speed" ? Number(w[name]) : w[name]; pressSeg(name, w[name]); }
  deploy();
  if (exp.id === "silent") promoteAt = 1800;
  if (clock.paused) clock.setPaused(false);
} });

deploy(); clock.setPaused(clock.paused);
`;


const size = writePage(new URL("./canary-deploy-workbench.html", import.meta.url), {
  title: t("Canary Deploy Workbench", "Banco de trabajo: despliegue canario"),
  eyebrow: t("Systems lesson 08 · Canary deploys", "Lección de sistemas 08 · Despliegues canario"),
  lede: t("A canary deploy sends a small share of real traffic to the new version, watches it, and either rolls it back or promotes it. This lesson builds that idea three ways: watch a machine do it, predict what fools it, then explain it back.",
    "Un despliegue canario (canary deploy) envía una pequeña parte del tráfico real a la versión nueva, la vigila y luego la revierte (rollback) o la promueve. Esta lección construye esa idea de tres maneras: mira cómo lo hace una máquina, predice qué la engaña y después explícalo."),
  machine: { intro: t("The old track is the version in production; the short lit track is the canary. Set a share on the lever, pick a build, and watch the rollback arm decide. Speed ×20 makes the 3-minute checks come round quickly.",
    "La vía vieja es la versión en producción; la vía corta iluminada es el canario. Fija un porcentaje con la palanca, elige una versión (build) y mira cómo decide el brazo de reversión. La velocidad ×20 hace que las revisiones de cada 3 minutos lleguen rápido."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over many seeded runs: 1.2 orders per second, 1 in 1,000 orders fail on either version by bad luck, and the rollback arm checks every 3 minutes for at least 3 failures above 0.4%.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la figura, promediados sobre muchas ejecuciones con semilla fija: 1.2 pedidos por segundo, 1 de cada 1,000 pedidos falla en cualquiera de las dos versiones por mala suerte, y el brazo de reversión revisa cada 3 minutos si hay al menos 3 fallos por encima de 0.4%."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  script: live,
});
console.log("wrote canary-deploy-workbench.html", (size / 1024).toFixed(0) + " KB");
