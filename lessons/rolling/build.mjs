// Systems lesson 10 · Rolling deploys. Built on the shared workbench layer (../../workbench).
import * as k from "../../workbench/kit.mjs";
import { writePage, figurePlate, panel, seg, speedSeg, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY, needleOf } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// Figure-specific styles: warm-up strip, the darker old modules, and headed groups of result bars.
const css = `
.warm-fill{fill:var(--anatomy-mid);stroke:none}
.mod-old .iso-top{fill:var(--anatomy-shade-1)}
.mod-old .iso-fill{fill:var(--anatomy-shade-2)}
.mod-old .iso-edge{stroke:var(--anatomy-mid)}
.bar-group{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);margin-top:6px}
.bar-group:first-child{margin-top:0}
`;

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "unavail",
    title: t("Take more bays out at once", "Sacar más bahías a la vez"),
    change: t("maxUnavailable 1 → 3 · busy traffic (2 requests/s, six bays serve 3/s)", "maxUnavailable 1 → 3 · tráfico alto (2 solicitudes/s, seis bahías atienden 3/s)"),
    question: t("Half the bays may now be out at the same time. What happens?", "Ahora la mitad de las bahías puede estar fuera al mismo tiempo. ¿Qué pasa?"),
    options: [t("Nothing users notice: the other bays absorb it", "Nada que noten los usuarios: las otras bahías lo absorben"), t("It finishes about twice as fast, but waits jump while half the bays are out", "Termina más o menos el doble de rápido, pero las esperas se disparan mientras falta la mitad de las bahías"), t("It finishes about six times as fast, with no other effect", "Termina unas seis veces más rápido, sin otro efecto")],
    answer: 1,
    why: t("maxUnavailable is how much capacity the rollout may take away. Three bays out leaves 1.5 requests/s of capacity for 2 requests/s of traffic, so queues grow until new bays come up. The rollout is faster because three modules warm up at the same time, but warm-up still sets the pace, so it is not three times faster.", "maxUnavailable es cuánta capacidad puede quitar el despliegue. Con tres bahías fuera quedan 1.5 solicitudes/s de capacidad para 2 solicitudes/s de tráfico, así que las colas crecen hasta que levantan las bahías nuevas. El despliegue es más rápido porque tres módulos se calientan al mismo tiempo, pero el calentamiento sigue marcando el ritmo, así que no es tres veces más rápido."),
    watch: { load: "high", unavail: 3, surge: 0, probe: "on", next: "good" },
  },
  {
    id: "surge",
    title: t("Add before you remove", "Agregar antes de quitar"),
    change: t("maxUnavailable 1, maxSurge 0 → maxUnavailable 0, maxSurge 1 · busy traffic", "maxUnavailable 1, maxSurge 0 → maxUnavailable 0, maxSurge 1 · tráfico alto"),
    question: t("Now a new bay is added before any old one is taken out. What does that cost?", "Ahora se agrega una bahía nueva antes de sacar una vieja. ¿Qué cuesta eso?"),
    options: [t("Nothing: same speed, same resources, no dip", "Nada: misma velocidad, mismos recursos, sin bajón"), t("No dip in capacity, but a seventh bay is in use while it runs", "Sin bajón de capacidad, pero se usa una séptima bahía mientras dura"), t("No dip, but it takes twice as long", "Sin bajón, pero tarda el doble")],
    answer: 1,
    why: t("With maxSurge the rollout adds a new bay in a spare position first and only removes an old one once the new one is ready, so capacity never drops below six bays. The price is the extra bay: your cluster needs room for seven while it runs. It is not slower, because each step still waits for exactly one warm-up.", "Con maxSurge el despliegue primero agrega una bahía nueva en una posición de repuesto y solo quita una vieja cuando la nueva está lista, así que la capacidad nunca baja de seis bahías. El precio es la bahía extra: tu clúster necesita lugar para siete mientras dura. No es más lento, porque cada paso sigue esperando exactamente un calentamiento."),
    watch: { load: "high", unavail: 0, surge: 1, probe: "on", next: "good" },
  },
  {
    id: "probe",
    title: t("No readiness probe", "Sin sonda de readiness"),
    change: t("Readiness probe on → off · a new bay's flag rises as soon as it is installed", "Sonda de readiness sí → no · la bandera de una bahía nueva sube en cuanto se instala"),
    question: t("The new version is fine, but every module needs 6 s to warm up. Without the probe…", "La versión nueva está bien, pero cada módulo necesita 6 s para calentarse. Sin la sonda…"),
    options: [t("Nothing changes: the new version works", "No cambia nada: la versión nueva funciona"), t("Requests fail at every swap while the new bay is still warming up", "Fallan solicitudes en cada cambio mientras la bahía nueva todavía se calienta"), t("The rollout is slower, but nothing fails", "El despliegue es más lento, pero nada falla")],
    answer: 1,
    why: t("The flag is the only thing the distributor looks at. Without a probe it rises the moment the module is in place, so requests go to a bay that cannot answer yet. Worse, a new bay has an empty queue, so a least-busy distributor sends it more than its share. The rollout also looks twice as fast, because nothing waits for warm-up: that speed is the bug.", "La bandera es lo único que mira el distribuidor. Sin sonda sube en cuanto el módulo está en su lugar, así que las solicitudes van a una bahía que todavía no puede responder. Peor aún, una bahía nueva tiene la cola vacía, así que un distribuidor que elige la menos ocupada le manda más de lo que le toca. El despliegue además parece el doble de rápido, porque nada espera el calentamiento: esa velocidad es el bug."),
    watch: { load: "normal", unavail: 1, surge: 0, probe: "off", next: "good" },
  },
  {
    id: "bad",
    title: t("A broken version", "Una versión rota"),
    change: t("Next version: broken · it starts, but never passes its health check", "Siguiente versión: rota · arranca, pero nunca pasa su chequeo de salud (health check)"),
    question: t("With the readiness probe on, how far does the rollout get?", "Con la sonda de readiness activada, ¿hasta dónde llega el despliegue?"),
    options: [t("It replaces all six bays and the service goes down", "Reemplaza las seis bahías y el servicio se cae"), t("It stops after the first new bay; the old bays keep serving", "Se detiene después de la primera bahía nueva; las viejas siguen atendiendo"), t("It notices and rolls back by itself", "Se da cuenta y hace rollback solo")],
    answer: 1,
    why: t("The rollout only removes another old bay when enough bays are ready. A new bay that never becomes ready keeps it waiting forever, so the damage stays at one bay. It does not roll back: in Kubernetes the deployment is marked as failed after progressDeadlineSeconds and someone (or a pipeline) runs kubectl rollout undo. Without the probe, nothing stops it.", "El despliegue solo quita otra bahía vieja cuando hay suficientes bahías listas. Una bahía nueva que nunca está lista lo deja esperando para siempre, así que el daño se queda en una bahía. No hace rollback: en Kubernetes el deployment se marca como fallido después de progressDeadlineSeconds y alguien (o un pipeline) ejecuta kubectl rollout undo. Sin la sonda, nada lo detiene."),
    watch: { load: "normal", unavail: 1, surge: 0, probe: "on", next: "bad" },
  },
  {
    id: "format",
    title: t("Two versions at once", "Dos versiones a la vez"),
    change: t("Next version saves user data in a new format that the old version cannot read", "La siguiente versión guarda los datos del usuario en un formato nuevo que la versión vieja no puede leer"),
    question: t("During the rollout, old and new bays both serve. What do users see?", "Durante el despliegue, atienden tanto las bahías viejas como las nuevas. ¿Qué ven los usuarios?"),
    options: [t("No errors: every request lands on a working bay", "Ningún error: cada solicitud cae en una bahía que funciona"), t("Errors for users who were served by a new bay and then land on an old one, until the rollout ends", "Errores para los usuarios que atendió una bahía nueva y luego caen en una vieja, hasta que termina el despliegue"), t("Every request fails until the rollout ends", "Todas las solicitudes fallan hasta que termina el despliegue")],
    answer: 1,
    why: t("A rolling deploy always has a window where both versions serve, and a user can bounce between them from one request to the next. Anything one version writes, the other must be able to read. Ship format changes in steps: first a version that reads both formats, then one that writes the new one (expand, then contract).", "Un despliegue gradual siempre tiene una ventana en la que atienden las dos versiones, y un usuario puede saltar de una a otra entre una solicitud y la siguiente. Todo lo que escribe una versión, la otra tiene que poder leerlo. Publica los cambios de formato por pasos: primero una versión que lee los dos formatos, luego una que escribe el nuevo (expandir y después contraer, expand and contract)."),
    watch: { load: "normal", unavail: 1, surge: 0, probe: "on", next: "incompatible" },
  },
];

const QUESTIONS = [
  [t("maxUnavailable and maxSurge both make a rollout faster. What does each one cost?", "maxUnavailable y maxSurge hacen más rápido un despliegue. ¿Qué cuesta cada uno?"),
    t("maxUnavailable spends capacity: bays are taken out before replacements are ready, so the remaining bays carry more load and waits grow. maxSurge spends resources: extra bays run alongside the old ones, so you need room in the cluster. With maxUnavailable 0 and maxSurge 1 you never drop below full capacity.", "maxUnavailable gasta capacidad: se sacan bahías antes de que estén listos los reemplazos, así que las que quedan cargan más y las esperas crecen. maxSurge gasta recursos: corren bahías extra junto a las viejas, así que necesitas lugar en el clúster. Con maxUnavailable 0 y maxSurge 1 nunca bajas de la capacidad completa.")],
  [t("Why does a readiness probe make a broken rollout stop by itself, and what does it not do for you?", "¿Por qué una sonda de readiness hace que un despliegue roto se detenga solo, y qué no hace por ti?"),
    t("The rollout only removes another old bay when enough bays are ready. A new bay that never becomes ready blocks that, so only one bay is lost and the old ones keep serving. It does not roll back: the deployment just stops progressing (Kubernetes marks it failed after progressDeadlineSeconds), and someone has to run a rollback.", "El despliegue solo quita otra bahía vieja cuando hay suficientes bahías listas. Una bahía nueva que nunca está lista lo bloquea, así que solo se pierde una bahía y las viejas siguen atendiendo. No hace rollback: el deployment simplemente deja de avanzar (Kubernetes lo marca como fallido después de progressDeadlineSeconds) y alguien tiene que hacer el rollback.")],
  [t("Without the probe, the rollout finished in half the time. Why is that number misleading?", "Sin la sonda, el despliegue terminó en la mitad del tiempo. ¿Por qué ese número engaña?"),
    t("It finished faster because nothing waited for warm-up: each flag rose the moment the module was in place. The time saved was paid for with failed requests sent to bays that could not answer yet.", "Terminó más rápido porque nada esperó el calentamiento: cada bandera subió en cuanto el módulo estuvo en su lugar. El tiempo ahorrado se pagó con solicitudes fallidas enviadas a bahías que todavía no podían responder.")],
  [t("A new version renames a field in the data it stores. How do you ship it with a rolling deploy?", "Una versión nueva renombra un campo en los datos que guarda. ¿Cómo la publicas con un despliegue gradual?"),
    t("In steps, because old and new versions serve side by side during every rollout. First deploy a version that can read both the old and the new field but still writes the old one; once that is everywhere, deploy the version that writes the new one; later remove the old field (expand, then contract).", "Por pasos, porque la versión vieja y la nueva atienden lado a lado durante todo despliegue. Primero despliega una versión que pueda leer el campo viejo y el nuevo pero que siga escribiendo el viejo; cuando esté en todas partes, despliega la versión que escribe el nuevo; más adelante elimina el campo viejo (expandir y después contraer).")],
  [t("A brand-new bay has an empty queue. Why can that hurt right after it becomes ready, and what helps?", "Una bahía recién instalada tiene la cola vacía. ¿Por qué eso puede doler justo cuando queda lista, y qué ayuda?"),
    t("A least-busy distributor sends it a burst of traffic, while it may still be cold (caches empty, JIT not warmed). A readiness probe that only passes when it can really serve, a short warm-up delay, or slow-start in the load balancer all help.", "Un distribuidor que elige la bahía menos ocupada le manda una ráfaga de tráfico mientras todavía puede estar fría (cachés vacías, JIT sin calentar). Ayudan una sonda de readiness que solo pasa cuando de verdad puede atender, una breve espera de calentamiento o el arranque lento (slow-start) del balanceador de carga.")],
  [t("When would you choose blue-green or canary instead of a rolling deploy?", "¿Cuándo elegirías azul-verde (blue-green) o canario (canary) en lugar de un despliegue gradual?"),
    t("Blue-green when you cannot have two versions serving at once or want an instant, complete rollback. Canary when you want to try the new version on a small share of real traffic and judge it by metrics before going further. Rolling is the cheap default when versions are compatible and gradual replacement is fine.", "Azul-verde cuando no puedes tener dos versiones atendiendo a la vez o quieres un rollback instantáneo y completo. Canario cuando quieres probar la versión nueva con una parte pequeña del tráfico real y juzgarla por las métricas antes de avanzar. El gradual es la opción barata por defecto cuando las versiones son compatibles y un reemplazo gradual está bien.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Module yard", "Patio de módulos"),
  keys: [
    { mark: "lit", label: t("New version", "Versión nueva") },
    { mark: "raised", label: t("Old version, and the six bays on the feed rail", "Versión vieja, y las seis bahías del riel de alimentación") },
    { mark: "flat", label: t("Readiness flag: up means the distributor may send work", "Bandera de readiness: arriba significa que el distribuidor puede mandar trabajo") },
  ],
  caption:
    t("Requests come down the chute and the distributor sends each one to the least busy bay whose flag is up. In a rollout the gantry crane pulls out an old module, drops it in the bin, and lowers a new one from the supply stand. The strip on a module's face fills while it warms up; the flag rises only when it is ready. The two positions at the right end are spare room for surge.", "Las solicitudes bajan por el tobogán y el distribuidor manda cada una a la bahía menos ocupada con la bandera arriba. En un despliegue, la grúa pórtico saca un módulo viejo, lo tira en el contenedor y baja uno nuevo desde el soporte de suministro. La franja en el frente de un módulo se llena mientras se calienta; la bandera sube solo cuando está listo. Las dos posiciones del extremo derecho son lugar de repuesto para el surge."),
  stage: "data-yard",
  stageLabel: t("Rolling deploy simulation. Space pauses or resumes.", "Simulación de despliegue gradual. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

// The panel carries a note under the controls (lesson-local: panel() has no slot for one).
const controls = panel({
  stats: [["mix", t("New / old bays", "Bahías nuevas / viejas"), "0 / 6"], ["ready", t("Flags up", "Banderas arriba"), "6"], ["served", t("Served", "Atendidas")], ["errors", t("Errors", "Errores")], ["p95", t("p95 wait", "Espera p95"), "–"], ["time", t("Rollout time", "Duración del despliegue"), "–"]],
  controls: [
    seg("unavail", "maxUnavailable", [[0, "0"], [1, "1"], [3, "3"]], 1),
    seg("surge", "maxSurge", [[0, "0"], [1, "1"], [2, "2"]], 0),
    seg("probe", t("Readiness probe", "Sonda de readiness"), [["on", t("On", "Sí")], ["off", t("Off", "No")]], "on"),
    seg("next", t("Next version", "Siguiente versión"), [["good", t("Good", "Buena")], ["bad", t("Broken", "Rota")], ["incompatible", t("New data format", "Formato de datos nuevo")]], "good"),
    seg("load", t("Traffic", "Tráfico"), [["normal", "Normal"], ["high", t("Busy", "Alto")]], "normal"),
    speedSeg(),
    `<div class="control"><span>${tx(t("Do something", "Haz algo"))}</span><div class="actions">
      <button class="btn primary" type="button" data-act="rollout">${tx(t("Start rollout", "Iniciar despliegue"))}</button>
      <button class="btn" type="button" data-act="reset">${tx(t("Reset", "Reiniciar"))}</button>
      <button class="btn" type="button" data-act="pause">${tx(t("Pause", "Pausa"))}</button>
    </div></div>`,
  ],
}).replace(/<\/div>$/, `  <p class="note" data-note style="padding:0 12px 12px;margin:0">${tx(t("Kubernetes does not allow maxUnavailable and maxSurge to both be 0; choosing that sets maxSurge to 1.", "Kubernetes no permite que maxUnavailable y maxSurge sean 0 a la vez; si eliges eso, maxSurge pasa a 1."))}</p>
</div>`);

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const { T, L } = WB;

const stage = document.querySelector("[data-yard]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const still = WB.still;
const slotEls = Array.from({ length: RD.SLOTS }, (_, i) => {
  const el = q('[data-slot="' + i + '"]');
  return {
    old: el.querySelector('[data-mod="old"]'), neu: el.querySelector('[data-mod="new"]'),
    warm: el.querySelector("[data-warm]"), anchor: el.querySelector("[data-anchor]"), flag: el.querySelector("[data-flag]"),
    pucks: Array.from({ length: G.PUCKS }, (_, j) => el.querySelector('[data-puck="' + i + "-" + j + '"]')),
    flagUp: -1, shown: "", warmD: "", puckN: -1,
  };
});
const craneParts = [q("[data-crane-back]"), q("[data-crane-front]"), q("[data-crane-top]"), q("[data-crane-top-front]")];
const grabber = q("[data-grabber]"), cables = q("[data-cables]"), fly = q("[data-fly]"), flyHome = q("[data-fly-home]");
const flyOld = q('[data-fly-mod="old"]'), flyNew = q('[data-fly-mod="new"]');
const supply = q("[data-supply]"), binAnchor = q("[data-bin-anchor]"), tokensBox = q("[data-tokens]"), needle = q("[data-needle]");
const TOKEN_SVG = ${JSON.stringify(k.solidSvg(k.cylinder(0, 0, 1.5, 0, 2.4, P, 14), { tone: "mid", crease: "none" }))};
const GRIP = G.MODULE_TOP + G.HANDLE_H;          // grabber bottom when it holds a module in a bay
const BIN_DROP = 4 + G.MODULE.h + G.HANDLE_H;     // grabber bottom when a module sits in the bin
const TRANSIT = 0.5;

const cfg = { unavail: 1, surge: 0, probe: "on", next: "good", load: "normal", speed: 1 };
let sim, tokens, counters, grabZ, jobSeen, jobStartZ, needleAngle, auto = true, idleSince = 0;

function newSim() {
  sim = createSim({ seed: (Date.now() % 1e6) + 1, load: cfg.load, unavail: cfg.unavail, surge: cfg.surge, probe: cfg.probe === "on", keep: 4000 });
  tokens = []; tokensBox.innerHTML = "";
  counters = { served: 0, errors: 0 };
  grabZ = G.HOIST_TOP; jobSeen = null; jobStartZ = G.HOIST_TOP; needleAngle = 0; idleSince = 0;
  flyInto(flyHome); fly.style.display = "none"; fly.style.opacity = "1";
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const seg01 = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const faceRect = (x0, x1, y, z0, z1) => WB.faceRectY(P, x0, x1, y, z0, z1);
function flyInto(node) { if (fly.parentNode !== node) node.appendChild(fly); }
const isLit = (version) => version === sim.S.target && sim.S.target > 1;

// ---------- tokens (requests in flight on the feed rail) ----------
function launch(e) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.innerHTML = TOKEN_SVG;
  tokensBox.appendChild(el);
  tokens.push({ el, bay: e.bay, fail: e.type === "fail", t0: sim.S.t });
  if (tokens.length > 40) { const old = tokens.shift(); old.el.remove(); }
}
function tokenPos(tk, s) {
  const [x0, y0] = G.DIST_EXIT;
  if (tk.bay === null) return [lerp(x0, -156, s), lerp(y0, 56, s), 2.4 - 1.4 * s];
  const cx = RD.slotX(tk.bay), run = Math.abs(cx - x0), drop = Math.abs(G.TOKEN_Y - G.TRAY_Y), total = run + drop, d = s * total;
  if (d <= run) return [x0 + (cx - x0) * (d / run), G.TOKEN_Y, 2.4];
  return [cx, G.TOKEN_Y - (d - run), 2.4 - 0.8 * ((d - run) / drop)];
}
function paintTokens() {
  const inflight = new Array(RD.SLOTS).fill(0);
  tokens = tokens.filter((tk) => {
    const age = sim.S.t - tk.t0, life = TRANSIT + (tk.fail ? 0.35 : 0);
    if (age >= life || age < 0) { tk.el.remove(); return false; }
    const s = ease(clamp01(age / TRANSIT));
    const [x, y, z] = tokenPos(tk, s);
    tk.el.setAttribute("transform", translateAlong(P, [x, y, z]));
    tk.el.style.opacity = tk.fail && age > TRANSIT ? String(1 - (age - TRANSIT) / 0.35) : "1";
    if (!tk.fail && tk.bay !== null) inflight[tk.bay]++;
    return true;
  });
  return inflight;
}

// ---------- the crane ----------
function paintCrane() {
  const S = sim.S, job = S.crane.job;
  let x = S.crane.x, z = grabZ, carry = null, hideSlot = -1, hideSupply = false;
  if (job !== jobSeen) { jobSeen = job; jobStartZ = grabZ; }
  if (job) {
    const p = clamp01((S.t - job.t0) / job.dur), tx = RD.slotX(job.bay);
    if (job.type === "install") {
      x = p < 0.25 ? lerp(job.fromX, RD.SUPPLY_X, ease(seg01(p, 0, 0.25))) : p < 0.45 ? RD.SUPPLY_X : lerp(RD.SUPPLY_X, tx, ease(seg01(p, 0.45, 0.75)));
      if (p < 0.25) z = lerp(jobStartZ, G.HOIST_TOP, ease(seg01(p, 0, 0.2)));
      else if (p < 0.35) z = lerp(G.HOIST_TOP, GRIP, ease(seg01(p, 0.25, 0.35)));
      else if (p < 0.45) z = lerp(GRIP, G.HOIST_TOP, ease(seg01(p, 0.35, 0.45)));
      else if (p < 0.75) z = G.HOIST_TOP;
      else z = lerp(G.HOIST_TOP, GRIP, ease(seg01(p, 0.75, 0.95)));
      if (p >= 0.35) { carry = { version: job.version, where: p >= 0.75 ? job.bay : "top" }; hideSupply = true; }
    } else {
      x = p < 0.55 ? lerp(job.fromX, tx, ease(seg01(p, 0, 0.3))) : lerp(tx, RD.BIN_X, ease(seg01(p, 0.55, 0.85)));
      if (p < 0.3) z = lerp(jobStartZ, G.HOIST_TOP, ease(seg01(p, 0, 0.25)));
      else if (p < 0.42) z = lerp(G.HOIST_TOP, GRIP, ease(seg01(p, 0.3, 0.42)));
      else if (p < 0.55) z = lerp(GRIP, G.HOIST_TOP, ease(seg01(p, 0.42, 0.55)));
      else if (p < 0.85) z = G.HOIST_TOP;
      else z = lerp(G.HOIST_TOP, BIN_DROP, ease(seg01(p, 0.85, 1)));
      if (p >= 0.42) { hideSlot = job.bay; carry = { version: job.version, where: p < 0.5 ? job.bay : p >= 0.85 ? "bin" : "top", fade: p >= 0.9 ? 1 - (p - 0.9) / 0.1 : 1 }; }
    }
  } else {
    z = lerp(grabZ, G.HOIST_TOP, 0.08); // idle: the hoist winds back up
  }
  grabZ = z;
  const tr = translateAlong(P, [x, 0, 0]);
  craneParts.forEach((el) => el.setAttribute("transform", tr));
  grabber.setAttribute("transform", translateAlong(P, [x, 0, z]));
  cables.setAttribute("d", CABLE_Y_PATH(x, z));
  supply.style.display = hideSupply ? "none" : "";
  if (carry) {
    flyInto(carry.where === "top" ? flyHome : carry.where === "bin" ? binAnchor : slotEls[carry.where].anchor);
    fly.style.display = "";
    fly.style.opacity = String(carry.fade === undefined ? 1 : Math.max(0, carry.fade));
    const lit = isLit(carry.version);
    flyNew.style.display = lit ? "" : "none"; flyOld.style.display = lit ? "none" : "";
    fly.setAttribute("transform", translateAlong(P, [x, 0, z - G.MODULE.h - G.HANDLE_H]));
  } else if (fly.style.display !== "none") { fly.style.display = "none"; flyInto(flyHome); }
  return hideSlot;
}
const CABLE_Y_PATH = (x, z) => [${GEOMETRY.ROW_Y - 2}, ${GEOMETRY.ROW_Y + 2}].map((y) => { const a = iso([x, y, ${GEOMETRY.TROLLEY_Z}], P), b = iso([x, y, z + 3], P); return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1); }).join("");

// ---------- bays ----------
function paintBays(inflight, hideSlot, dt) {
  const S = sim.S;
  S.bays.forEach((b, i) => {
    const el = slotEls[i];
    const show = b.module && i !== hideSlot ? (isLit(b.module.version) ? "new" : "old") : "";
    if (show !== el.shown) { el.neu.style.display = show === "new" ? "" : "none"; el.old.style.display = show === "old" ? "" : "none"; el.shown = show; }
    let d = "";
    if (show) {
      const share = clamp01((S.t - b.module.installedAt) / RD.WARM), cx = RD.slotX(i), W = G.WARM_STRIP;
      if (share > 0.02) d = faceRect(cx + W.x0, cx + W.x0 + (W.x1 - W.x0) * share, W.y, W.z0, W.z1);
    }
    if (d !== el.warmD) { el.warm.setAttribute("d", d); el.warmD = d; }
    const want = sim.ready(b) ? 1 : 0;
    const from = el.flagUp < 0 ? want : el.flagUp;
    const next = still.matches ? want : from + (want - from) * (1 - Math.exp(-dt / 0.12));
    if (next !== el.flagUp) { el.flagUp = Math.abs(next - want) < 0.002 ? want : next; el.flag.setAttribute("transform", translateAlong(P, [0, 0, G.FLAG_RISE * el.flagUp])); }
    const n = Math.max(0, Math.min(G.PUCKS, b.queue.length - inflight[i]));
    if (n !== el.puckN) { el.pucks.forEach((pk, j) => (pk.style.display = j < n ? "" : "none")); el.puckN = n; }
  });
}

// ---------- readout and stats ----------
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function describe() {
  const S = sim.S, r = S.rollout;
  const mods = S.bays.filter((b) => b.module);
  const fresh = mods.filter((b) => b.module.version === S.target).length;
  const readyN = S.bays.filter((b) => sim.ready(b)).length;
  if (!r || r.end !== null) return L("v" + S.target + " on " + mods.length + " bays · " + readyN + " flags up", "v" + S.target + " en " + mods.length + " bahías · " + readyN + " banderas arriba");
  const stuck = S.bays.find((b) => b.module && b.module.version === S.target && b.module.bad && S.t > b.module.warmAt + 1);
  if (stuck && sim.S.cfg.probe) { const oldN = S.bays.filter((b) => b.module && b.module.version !== S.target && sim.ready(b)).length; return L("v" + S.target + " stuck · bay " + (stuck.i + 1) + " never ready · " + oldN + " old bays serving", "v" + S.target + " atascada · bahía " + (stuck.i + 1) + " nunca lista · " + oldN + " bahías viejas atendiendo"); }
  const job = S.crane.job;
  const doing = job ? (job.type === "install" ? T(" · installing bay " + (job.bay + 1), " · instalando bahía " + (job.bay + 1)) : T(" · pulling bay " + (job.bay + 1), " · sacando bahía " + (job.bay + 1))) : S.bays.some((b) => b.module && b.module.version === S.target && S.t < b.module.warmAt) ? T(" · waiting for warm-up", " · esperando el calentamiento") : T("", "");
  return L("v" + S.target + " rolling · " + fresh + " of 6 new" + doing.en, "v" + S.target + " desplegando · " + fresh + " de 6 nuevas" + doing.es);
}
function showStats() {
  const S = sim.S;
  const mods = S.bays.filter((b) => b.module);
  const fresh = mods.filter((b) => isLit(b.module.version)).length;
  statEls.mix.textContent = fresh + " / " + (mods.length - fresh);
  statEls.ready.textContent = S.bays.filter((b) => sim.ready(b)).length;
  statEls.served.textContent = counters.served;
  statEls.errors.textContent = counters.errors;
  const recent = S.records.filter((r) => r.latency !== undefined).slice(-200).map((r) => r.latency).sort((a, b) => a - b);
  statEls.p95.textContent = recent.length >= 10 ? recent[Math.floor(0.95 * (recent.length - 1))].toFixed(1) + " s" : "–";
  const r = S.rollout;
  statEls.time.textContent = r ? ((r.end !== null ? r.end : S.t) - r.start).toFixed(0) + " s" + (r.end === null ? "…" : "") : "–";
}

let statTimer = 0;
function frameStep(dtReal) {
  const dt = dtReal * cfg.speed;
  sim.step(dt);
  for (const e of sim.S.events) {
    if (e.type === "route" || e.type === "fail") { launch(e); if (e.bay !== null) needleAngle = -1.2 + 0.32 * e.bay; }
    if (e.type === "done") counters.served++;
    if (e.type === "fail") counters.errors++;
  }
  sim.S.events.length = 0;
  const inflight = paintTokens();
  const hide = paintCrane();
  paintBays(inflight, hide, dt);
  needle.setAttribute("d", lineOnTop([-152, 32], [-152 + Math.sin(needleAngle) * 6, 32 - Math.cos(needleAngle) * 6], 17.2, P));
  say(describe());
  statTimer += dtReal;
  if (statTimer > 0.2) { statTimer = 0; showStats(); }
  const r = sim.S.rollout;
  if (auto) {
    if (!r) { idleSince += dt; if (idleSince > 2) { sim.startRollout("good"); idleSince = 0; } }
    else if (r.end !== null) { idleSince += dt; if (idleSince > 8) { sim.startRollout("good"); idleSince = 0; } }
  }
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: frameStep, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(L("paused", "en pausa")); } });
WB.onLang(() => {
  pauseBtn.textContent = clock.paused ? L("Play", "Reanudar") : L("Pause", "Pausa");
  if (clock.paused) say(L("paused", "en pausa")); else say(describe());
  statTimer = 0; showStats();
});
const pressSeg = WB.pressSeg;
function set(name, raw) {
  if (name === "unavail" || name === "surge" || name === "speed") cfg[name] = Number(raw); else cfg[name] = raw;
  if (cfg.unavail === 0 && cfg.surge === 0) { cfg.surge = 1; pressSeg("surge", 1); }
  sim.S.cfg.unavail = cfg.unavail; sim.S.cfg.surge = cfg.surge; sim.S.cfg.probe = cfg.probe === "on"; sim.S.cfg.load = cfg.load;
  pressSeg(name, raw);
}
function startRollout() {
  auto = false;
  if (!sim.startRollout(cfg.next)) say(L("a rollout is already running · reset to start over", "ya hay un despliegue en curso · reinicia para empezar de nuevo"));
  if (clock.paused) clock.setPaused(false);
}
function reset() { auto = false; newSim(); paintAll(); showStats(); }
WB.onSegments((name, value) => { if (name !== "speed") auto = false; set(name, value); });
document.querySelector('[data-act="rollout"]').addEventListener("click", startRollout);
document.querySelector('[data-act="reset"]').addEventListener("click", reset);
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });
function paintAll() { const inflight = paintTokens(); const hide = paintCrane(); paintBays(inflight, hide, 1); say(describe()); }

// ---------- experiments ----------
// Lesson-local wiring: results come as groups of bars with a heading each, which WB.experiments does not draw.
const pct = (x) => (100 * x < 1 && x > 0 ? (100 * x).toFixed(1) : Math.round(100 * x)) + "%";
const secs = (x, l) => (x === null ? (l === "es" ? "nunca" : "never") : x.toFixed(x < 10 ? 1 : 0) + " s");
const secsT = (x) => T(secs(x, "en"), secs(x, "es"));
// A verdict built once per language from the same numbers: f(lang) returns the sentence.
const both = (f) => T(f("en"), f("es"));
const run8 = (o) => averageRollout({ warm: 40, window: 110, ...o });
const group = (title, rows) => ({ title, rows });
const RUNS = {
  unavail: () => {
    const base = run8({ load: "high", deploy: false }), a = run8({ load: "high", unavail: 1 }), b = run8({ load: "high", unavail: 3 });
    return { verdict: both((l) => l === "es"
        ? "Duración del despliegue " + secs(a.rolloutTime, l) + " → " + secs(b.rolloutTime, l) + ". Espera p95 durante el despliegue " + secs(a.p95, l) + " → " + secs(b.p95, l) + " (sin despliegue: " + secs(base.p95, l) + ")."
        : "Rollout time " + secs(a.rolloutTime, l) + " → " + secs(b.rolloutTime, l) + ". p95 wait during it " + secs(a.p95, l) + " → " + secs(b.p95, l) + " (no rollout: " + secs(base.p95, l) + ")."),
      groups: [group(T("Rollout time", "Duración del despliegue"), [["maxUnavailable 1", a.rolloutTime, secsT(a.rolloutTime)], ["maxUnavailable 3", b.rolloutTime, secsT(b.rolloutTime), true]]),
        group(T("p95 wait during the rollout", "Espera p95 durante el despliegue"), [[T("No rollout", "Sin despliegue"), base.p95, secsT(base.p95)], ["maxUnavailable 1", a.p95, secsT(a.p95)], ["maxUnavailable 3", b.p95, secsT(b.p95), true]])] };
  },
  surge: () => {
    const base = run8({ load: "high", deploy: false }), a = run8({ load: "high", unavail: 1, surge: 0 }), b = run8({ load: "high", unavail: 0, surge: 1 });
    return { verdict: both((l) => l === "es"
        ? "Espera p95 durante el despliegue " + secs(a.p95, l) + " → " + secs(b.p95, l) + " (sin despliegue: " + secs(base.p95, l) + "). Duración del despliegue " + secs(a.rolloutTime, l) + " → " + secs(b.rolloutTime, l) + ". Bahías en uso en el pico: " + a.peakBays + " → " + b.peakBays + "."
        : "p95 wait during the rollout " + secs(a.p95, l) + " → " + secs(b.p95, l) + " (no rollout: " + secs(base.p95, l) + "). Rollout time " + secs(a.rolloutTime, l) + " → " + secs(b.rolloutTime, l) + ". Bays in use at the peak: " + a.peakBays + " → " + b.peakBays + "."),
      groups: [group(T("p95 wait during the rollout", "Espera p95 durante el despliegue"), [[T("No rollout", "Sin despliegue"), base.p95, secsT(base.p95)], [T("Unavailable 1", "maxUnavailable 1"), a.p95, secsT(a.p95)], [T("Surge 1", "maxSurge 1"), b.p95, secsT(b.p95), true]]),
        group(T("Bays in use at the peak", "Bahías en uso en el pico"), [[T("Unavailable 1", "maxUnavailable 1"), a.peakBays, String(a.peakBays)], [T("Surge 1", "maxSurge 1"), b.peakBays, String(b.peakBays), true]]),
        group(T("Rollout time", "Duración del despliegue"), [[T("Unavailable 1", "maxUnavailable 1"), a.rolloutTime, secsT(a.rolloutTime)], [T("Surge 1", "maxSurge 1"), b.rolloutTime, secsT(b.rolloutTime), true]])] };
  },
  probe: () => {
    const a = run8({ load: "normal" }), b = run8({ load: "normal", probe: false });
    return { verdict: both((l) => l === "es"
        ? "Sin la sonda, falló el " + pct(b.errorRate) + " de las solicitudes durante el despliegue (con ella: " + pct(a.errorRate) + "). Además \\"terminó\\" en " + secs(b.rolloutTime, l) + " en vez de " + secs(a.rolloutTime, l) + ", porque nada esperó el calentamiento."
        : "Without the probe, " + pct(b.errorRate) + " of requests failed during the rollout (with it: " + pct(a.errorRate) + "). It also \\"finished\\" in " + secs(b.rolloutTime, l) + " instead of " + secs(a.rolloutTime, l) + ", because nothing waited for warm-up."),
      groups: [group(T("Requests that failed", "Solicitudes que fallaron"), [[T("Probe on", "Con sonda"), a.errorRate, pct(a.errorRate)], [T("Probe off", "Sin sonda"), b.errorRate, pct(b.errorRate), true]]),
        group(T("Rollout time", "Duración del despliegue"), [[T("Probe on", "Con sonda"), a.rolloutTime, secsT(a.rolloutTime)], [T("Probe off", "Sin sonda"), b.rolloutTime, secsT(b.rolloutTime), true]])] };
  },
  bad: () => {
    const a = run8({ load: "normal", quality: "bad", full: true }), b = run8({ load: "normal", quality: "bad", probe: false, full: true });
    return { verdict: both((l) => l === "es"
        ? "Con la sonda: " + a.newBays.toFixed(0) + " bahía reemplazada, " + a.oldServing.toFixed(0) + " bahías viejas todavía atendiendo y falló el " + pct(a.errorRate) + " de las solicitudes; el despliegue solo espera. Sin ella: " + b.newBays.toFixed(0) + " de 6 reemplazadas y falló el " + pct(b.errorRate) + "."
        : "With the probe: " + a.newBays.toFixed(0) + " bay replaced, " + a.oldServing.toFixed(0) + " old bays still serving, " + pct(a.errorRate) + " of requests failed; the rollout just waits. Without it: " + b.newBays.toFixed(0) + " of 6 replaced and " + pct(b.errorRate) + " failed."),
      groups: [group(T("Requests that failed (110 s)", "Solicitudes que fallaron (110 s)"), [[T("Probe on", "Con sonda"), a.errorRate, pct(a.errorRate)], [T("Probe off", "Sin sonda"), b.errorRate, pct(b.errorRate), true]]),
        group(T("Bays running the broken version", "Bahías con la versión rota"), [[T("Probe on", "Con sonda"), a.newBays, T(a.newBays.toFixed(0) + " of 6", a.newBays.toFixed(0) + " de 6")], [T("Probe off", "Sin sonda"), b.newBays, T(b.newBays.toFixed(0) + " of 6", b.newBays.toFixed(0) + " de 6"), true]])] };
  },
  format: () => {
    const a = run8({ load: "normal" }), b = run8({ load: "normal", quality: "incompatible" });
    return { verdict: T(pct(b.errorRate) + " of requests failed during the rollout, every one from a user sent back to an old bay after a new one had saved their data. A compatible change: " + pct(a.errorRate) + ". After the last old bay is gone, the errors stop.",
        "Falló el " + pct(b.errorRate) + " de las solicitudes durante el despliegue, todas de usuarios que volvieron a una bahía vieja después de que una nueva guardara sus datos. Con un cambio compatible: " + pct(a.errorRate) + ". Cuando se va la última bahía vieja, los errores paran."),
      groups: [group(T("Requests that failed during the rollout", "Solicitudes que fallaron durante el despliegue"), [[T("Compatible change", "Cambio compatible"), a.errorRate, pct(a.errorRate)], [T("New data format", "Formato de datos nuevo"), b.errorRate, pct(b.errorRate), true]])] };
  },
};
function barsHtml(groups) {
  return groups.map((g) => {
    const top = Math.max(...g.rows.map((r) => r[1] || 0)) * 1.1 || 1;
    return '<div class="bar-group" data-group-title></div>' + g.rows.map(([label, value, text, after]) => '<div class="bar"' + (after ? " data-after" : "") + ' data-share="' + Math.max(0.01, (value || 0) / top) + '"><span data-bar-label></span><span class="track"><span class="fill" style="width:0"></span></span><b data-bar-text></b></div>').join("");
  }).join("");
}
document.querySelectorAll("[data-exp]").forEach((card) => {
  const exp = EXPERIMENTS.find((e) => e.id === card.dataset.exp);
  const runBtn = card.querySelector("[data-run]");
  const choices = [...card.querySelectorAll("[data-choice]")];
  let picked = null;
  choices.forEach((c) => c.addEventListener("click", () => {
    if (card.hasAttribute("data-done")) return;
    picked = Number(c.dataset.choice);
    choices.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    runBtn.disabled = false; runBtn.textContent = L("Run the experiment", "Ejecutar el experimento");
  }));
  WB.onLang(() => { if (picked !== null && !card.hasAttribute("data-done")) runBtn.textContent = L("Run the experiment", "Ejecutar el experimento"); });
  runBtn.addEventListener("click", () => {
    if (picked === null) return;
    const out = RUNS[exp.id]();
    const right = picked === exp.answer;
    choices.forEach((x, j) => { x.disabled = true; if (j === exp.answer) x.dataset.verdict = "right"; else if (j === picked) x.dataset.verdict = "wrong"; });
    card.querySelector("[data-bars]").innerHTML = barsHtml(out.groups);
    const rows = out.groups.flatMap((g) => g.rows);
    const words = () => {
      card.querySelector("[data-outcome]").textContent = (right ? L("Your prediction held. ", "Tu predicción se cumplió. ") : L("Not what you predicted. ", "No es lo que predijiste. ")) + L(out.verdict);
      card.querySelectorAll("[data-group-title]").forEach((el, i) => { el.textContent = L(out.groups[i].title); });
      card.querySelectorAll("[data-bar-label]").forEach((el, i) => { el.textContent = L(rows[i][0]); });
      card.querySelectorAll("[data-bar-text]").forEach((el, i) => { el.textContent = L(rows[i][2]); });
      runBtn.textContent = L("Done", "Listo");
    };
    words();
    WB.onLang(words);
    card.setAttribute("data-done", "");
    runBtn.disabled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => card.querySelectorAll(".bar").forEach((b) => { b.querySelector(".fill").style.width = Math.round(100 * Number(b.dataset.share)) + "%"; })));
  });
  card.querySelector("[data-watch]").addEventListener("click", () => {
    const w = exp.watch;
    auto = false;
    ["unavail", "surge", "probe", "next", "load"].forEach((n) => { cfg[n] = n === "unavail" || n === "surge" ? Number(w[n]) : w[n]; pressSeg(n, w[n]); });
    newSim(); paintAll(); showStats();
    document.getElementById("machine").scrollIntoView({ behavior: still.matches ? "auto" : "smooth" });
    if (clock.paused) clock.setPaused(false);
    setTimeout(() => { sim.startRollout(cfg.next); }, 1500);
  });
});

newSim();
clock.setPaused(clock.paused);
paintAll(); showStats();
`;


const size = writePage(new URL("./rolling-deploy-workbench.html", import.meta.url), {
  title: t("Rolling Deploy Workbench", "Banco de trabajo: despliegues graduales"),
  eyebrow: t("Systems lesson 10 · Rolling deploys", "Lección de sistemas 10 · Despliegues graduales"),
  lede: t("A rolling deploy replaces a service one piece at a time, so it never has to stop. This lesson builds the idea three ways: watch a crane swap modules in a running yard, predict what each setting breaks, then explain it back.", "Un despliegue gradual (rolling deploy) reemplaza un servicio pieza por pieza, así que nunca tiene que detenerse. Esta lección construye la idea de tres formas: mira cómo una grúa cambia módulos en un patio en marcha, predice qué rompe cada ajuste y luego explícalo con tus palabras."),
  machine: { intro: t("Each bay is one replica of the service. Watch a rollout or two, then change the settings below, pick the next version, and start one yourself.", "Cada bahía es una réplica del servicio. Mira uno o dos despliegues (rollouts), luego cambia los ajustes de abajo, elige la siguiente versión e inicia uno tú. La bandera de cada bahía es su sonda de readiness (readiness probe): indica si la réplica puede recibir tráfico."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over eight simulated rollouts of the same yard: six bays, 6 s warm-up, 2.4 s per crane move.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados son el promedio de ocho despliegues simulados del mismo patio: seis bahías, 6 s de calentamiento, 2.4 s por movimiento de la grúa."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote rolling-deploy-workbench.html", (size / 1024).toFixed(0) + " KB");
