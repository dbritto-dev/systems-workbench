// Systems lesson 01 · Caching. Built on the shared workbench layer (../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t } from "../../workbench/page.mjs";
import { buildFigure, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "ttl",
    title: t("Shorter freshness", "Frescura más corta"),
    change: t("TTL 60 s → 6 s · a card now leaves the rack ten times sooner", "TTL 60 s → 6 s · ahora una ficha sale del estante diez veces antes"),
    question: t("What happens to the share of requests answered from the rack?", "¿Qué pasa con la parte de las solicitudes que se responden desde el estante?"),
    options: [
      t("It barely moves: the popular cards are still asked for all the time", "Casi no cambia: las fichas populares se siguen pidiendo todo el tiempo"),
      t("It falls by about half", "Cae más o menos a la mitad"),
      t("It falls to almost nothing", "Cae casi a cero"),
    ],
    answer: 1,
    why: t("A copy only helps if the same record is asked for again before it expires. The most popular record comes back every few requests and still hits, but the next dozen come back every 10 to 30 seconds, after their cards have gone. You trade freshness for trips to the archive.",
      "Una copia solo sirve si alguien vuelve a pedir el mismo registro antes de que caduque. El registro más popular vuelve cada pocas solicitudes y sigue acertando, pero la docena siguiente vuelve cada 10 a 30 segundos, cuando sus fichas ya no están. Cambias frescura por viajes al archivo."),
    watch: { ttl: 6, slots: 12, traffic: "popular" },
  },
  {
    id: "size",
    title: t("A smaller rack", "Un estante más chico"),
    change: t("Rack 12 slots → 4 slots · a third of the room", "Estante de 12 lugares → 4 lugares · un tercio del espacio"),
    question: t("The rack can now hold 4 of the 40 records. The hit rate…", "Ahora el estante guarda 4 de los 40 registros. La tasa de aciertos…"),
    options: [
      t("Falls to a third of what it was, like the room", "Cae a un tercio de lo que era, igual que el espacio"),
      t("Drops, but much less than the room did", "Baja, pero mucho menos que el espacio"),
      t("Stays the same", "Se mantiene igual"),
    ],
    answer: 1,
    why: t("When the rack is full, the card that has gone unused longest is taken out (least recently used). The few popular records are used all the time, so they stay; it is the rarely asked records that get pushed out, and they were rarely hits anyway.",
      "Cuando el estante está lleno, sale la ficha que lleva más tiempo sin usarse (menos usada recientemente, least recently used, LRU). Los pocos registros populares se usan todo el tiempo, así que se quedan; los que salen son los que casi nadie pide, y esos casi nunca eran aciertos."),
    watch: { ttl: 60, slots: 4, traffic: "popular" },
  },
  {
    id: "even",
    title: t("No favourites", "Sin favoritos"),
    change: t("Popular traffic → even traffic · every record equally likely", "Tráfico popular → tráfico parejo · todos los registros igual de probables"),
    question: t("Same rack, same TTL, but no record is more popular than another. The hit rate…", "Mismo estante, mismo TTL, pero ningún registro es más popular que otro. La tasa de aciertos…"),
    options: [
      t("Stays about the same: the rack is the same size", "Queda más o menos igual: el estante es del mismo tamaño"),
      t("Falls to roughly the share of records the rack can hold", "Cae a más o menos la parte de los registros que cabe en el estante"),
      t("Falls to zero", "Cae a cero"),
    ],
    answer: 1,
    why: t("With even traffic, the chance that the record you want is in the rack is about the share of records the rack holds: 12 of 40 is 30%. Caches pay off because real traffic is uneven: a few things are asked for constantly.",
      "Con tráfico parejo, la probabilidad de que el registro que buscas esté en el estante es más o menos la parte de los registros que el estante guarda: 12 de 40 es 30%. Las cachés rinden porque el tráfico real es desparejo: unas pocas cosas se piden todo el tiempo."),
    watch: { ttl: 60, slots: 12, traffic: "even" },
  },
  {
    id: "flush",
    title: t("The rack is emptied", "Se vacía el estante"),
    change: t("Empty the rack while traffic flows · a deploy, a restart, a flush", "Vacía el estante mientras llega tráfico · un despliegue, un reinicio, un vaciado (flush)"),
    question: t("Right after the rack is emptied, how long do requests take?", "Justo después de vaciar el estante, ¿cuánto tardan las solicitudes?"),
    options: [
      t("The same as before: the archive still has everything", "Lo mismo que antes: el archivo todavía tiene todo"),
      t("Slower for a short while, then back to normal", "Más lentas por un rato y luego vuelven a la normalidad"),
      t("Slow until every card has expired once, about a minute", "Lentas hasta que cada ficha haya caducado una vez, cerca de un minuto"),
    ],
    answer: 1,
    why: t("Every request becomes a trip to the archive until the popular cards are back. With skewed traffic that takes only a handful of requests. In a real system those trips arrive all at once, and if they are more than the database can serve, a short refill turns into a queue.",
      "Cada solicitud se vuelve un viaje al archivo hasta que regresan las fichas populares. Con tráfico sesgado eso toma solo unas cuantas solicitudes. En un sistema real esos viajes llegan todos a la vez, y si son más de los que la base de datos puede atender, un llenado corto se convierte en una cola."),
    watch: { ttl: 60, slots: 12, traffic: "popular", flush: true },
  },
  {
    id: "stale",
    title: t("A record changes", "Cambia un registro"),
    change: t("Record #1 is updated in the archive · its card is still in the rack", "El registro #1 se actualiza en el archivo · su ficha sigue en el estante"),
    question: t("Of the next reads of #1 answered from the rack, how many show the old version?", "De las siguientes lecturas de #1 que responde el estante, ¿cuántas muestran la versión vieja?"),
    options: [
      t("None: the rack notices the change", "Ninguna: el estante nota el cambio"),
      t("About half", "Más o menos la mitad"),
      t("Most of them, until the card expires", "Casi todas, hasta que la ficha caduca"),
    ],
    answer: 2,
    why: t("The rack has no idea the archive changed. It keeps serving its copy until the TTL runs out. Turning on invalidate on write takes the card out when the record changes, so the next read fetches the new version.",
      "El estante no tiene idea de que el archivo cambió. Sigue sirviendo su copia hasta que se acaba el TTL. Si activas invalidar al escribir, la ficha sale cuando cambia el registro, así que la siguiente lectura trae la versión nueva."),
    watch: { ttl: 60, slots: 12, traffic: "popular", invalidate: false, change: true },
  },
];

const QUESTIONS = [
  [t("In the figure a hit takes 0.7 s and a miss 2.75 s. Why does the average wait depend mostly on the hit rate?",
    "En la figura un acierto tarda 0.7 s y un fallo 2.75 s. ¿Por qué la espera media depende sobre todo de la tasa de aciertos?"),
    t("Because misses are four times as expensive. Average wait = hit rate × 0.7 + (1 − hit rate) × 2.75, so each point of hit rate removes about 0.02 s. Making hits faster would barely help; avoiding misses is what matters.",
    "Porque los fallos cuestan cuatro veces más. Espera media = tasa de aciertos × 0.7 + (1 − tasa de aciertos) × 2.75, así que cada punto de tasa de aciertos quita unos 0.02 s. Hacer más rápidos los aciertos casi no ayudaría; lo que importa es evitar los fallos.")],
  [t("The rack holds 12 of 40 records but answers about two-thirds of requests. What about the traffic makes that possible, and what would break it?",
    "El estante guarda 12 de 40 registros pero responde cerca de dos tercios de las solicitudes. ¿Qué tiene el tráfico que lo hace posible, y qué lo rompería?"),
    t("The traffic is skewed: a few records get most of the requests, and those stay in the rack. Even traffic breaks it (hit rate falls to about the rack's share, 30%), and so would a key space so large that even the popular part doesn't fit.",
    "El tráfico está sesgado: unos pocos registros reciben la mayoría de las solicitudes, y esos se quedan en el estante. El tráfico parejo lo rompe (la tasa de aciertos cae a más o menos la parte del estante, 30%), y también un espacio de claves tan grande que ni siquiera la parte popular cabe.")],
  [t("A teammate wants TTL = 1 s \"so prices are always fresh\". What happens, and what would you suggest instead?",
    "Alguien del equipo quiere TTL = 1 s \"para que los precios estén siempre frescos\". ¿Qué pasa, y qué propondrías en su lugar?"),
    t("Most copies expire before anyone asks again, so the hit rate collapses and the database takes nearly all reads. Keep a longer TTL and invalidate the key when the price changes, so freshness comes from the write, not from expiry.",
    "La mayoría de las copias caducan antes de que alguien vuelva a pedirlas, así que la tasa de aciertos se desploma y la base de datos recibe casi todas las lecturas. Deja un TTL más largo e invalida la clave cuando cambie el precio, para que la frescura venga de la escritura y no de la caducidad.")],
  [t("Invalidate on write fixed the stale reads here. Name one way a stale value can still be served.",
    "Invalidar al escribir resolvió aquí las lecturas obsoletas. Nombra una forma en que todavía se puede servir un valor obsoleto."),
    t("A writer that skips the app (a migration, an admin script, another service) doesn't delete the key. Or a race: a reader misses, reads the old row, the writer updates and deletes the key, then the reader stores the old row it read. The TTL is the backstop for both.",
    "Quien escribe sin pasar por la app (una migración, un script de administración, otro servicio) no borra la clave. O una carrera: un lector falla, lee la fila vieja, el escritor actualiza y borra la clave, y luego el lector guarda la fila vieja que leyó. El TTL es la red de seguridad para ambos casos.")],
  [t("Redis restarts during peak traffic. What do you expect in the first seconds, and what would you do before the next deploy?",
    "Redis se reinicia en hora pico. ¿Qué esperas en los primeros segundos, y qué harías antes del próximo despliegue?"),
    t("Every read misses at once, the database gets more reads than it can serve, requests queue and latency jumps. Warm the cache before switching traffic, add capacity headroom on the database, and consider request coalescing so one miss per key goes to the database.",
    "Todas las lecturas fallan a la vez, la base de datos recibe más lecturas de las que puede atender, las solicitudes hacen cola y la latencia se dispara. Calienta la caché antes de pasar el tráfico, deja margen de capacidad en la base de datos y considera agrupar solicitudes (request coalescing) para que a la base de datos llegue un solo fallo por clave.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Records office", "Oficina de registros"),
  keys: [
    { mark: "lit", label: t("The record in play", "El registro en juego") },
    { mark: "raised", label: t("Card rack: the cache, 12 slots, fast", "Estante de fichas: la caché, 12 lugares, rápido") },
    { mark: "flat", label: t("Archive chest: the database, every record, slow", "Archivador: la base de datos, todos los registros, lento") },
  ],
  caption: t(
    "Each press of the button asks for one of 40 records. If its card is in the rack, it is a hit and is answered in 0.7 s. If not, the carriage fetches it from the archive (2.75 s) and leaves a copy in the rack. The strip on each card is its time to live; the dial turns once a minute.",
    "Cada vez que se pulsa el botón se pide uno de 40 registros. Si su ficha está en el estante, es un acierto (hit) y se responde en 0.7 s. Si no, es un fallo (miss): el carro lo trae del archivo (2.75 s) y deja una copia en el estante. La franja de cada ficha es su tiempo de vida (time to live, TTL); el reloj da una vuelta por minuto."),
  stage: "data-office",
  stageLabel: t("Records office simulation. Space pauses or resumes.", "Simulación de la oficina de registros. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const controls = panel({
  stats: [["requests", t("Requests", "Solicitudes")], ["hits", t("From rack", "Del estante")], ["misses", t("From archive", "Del archivo")], ["rate", t("Hit rate", "% de aciertos"), "–"], ["wait", t("Avg wait", "Espera media"), "–"], ["stale", t("Stale reads", "Obsoletas")]],
  controls: [
    seg("ttl", t("Time to live", "Tiempo de vida"), [[6, "6 s"], [20, "20 s"], [60, "60 s"]], 60),
    seg("slots", t("Rack size", "Tamaño del estante"), [[4, t("4 slots", "4 lugares")], [12, t("12 slots", "12 lugares")]], 12),
    seg("traffic", t("Traffic", "Tráfico"), [["popular", t("Popular", "Popular")], ["even", t("Even", "Parejo")]], "popular"),
    seg("invalidate", t("Invalidate on write", "Invalidar al escribir"), [["false", t("Off", "No")], ["true", t("On", "Sí")]], "false"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["change", t("Change record #1", "Cambiar el registro #1")], ["flush", t("Empty rack", "Vaciar estante")], ["reset", t("Reset counts", "Reiniciar conteos")], ["pause", t("Pause", "Pausa")]]),
  ],
});

// Figure-specific styles: empty slots hide their card, the TTL strip fill, blanking covers.
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
const CLOCK = [-28, -42], CLOCK_R = 14, CLOCK_TOP = 12, CARRY_Y = 48, CARRY_Z = 8, LIFT_Z = 52;

const stage = document.querySelector("[data-office]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const drawersBox = q("[data-drawers]");
const drawerEls = G.DRAWERS.map((_, i) => q('[data-drawer="' + i + '"]'));
const slotEls = G.SLOTS.map((_, i) => q('[data-slot="' + i + '"]'));
const coverEls = G.SLOTS.map((_, i) => q('[data-cover="' + i + '"]'));
const ttlEls = slotEls.map((el) => el.querySelector("[data-ttl]"));
const liftEls = slotEls.map((el) => el.querySelector("[data-lift]"));
const carriageEl = q("[data-carriage]"), fly = q("[data-fly]"), flyHome = q("[data-fly-home]"), cap = q("[data-cap]"), needle = q("[data-needle]");
const capSolid = cap.querySelector(".iso-solid");
const anchors = { front: q('[data-anchor="front"]'), back: q('[data-anchor="back"]') };

const cfg = { ttl: 60, slots: 12, traffic: "popular", invalidate: false, speed: 1 };
let random = rng(Date.now() % 1e6 + 1);
let now = 0, steps = [], current = null, carX = G.PARK;
const versions = new Array(RECORDS + 1).fill(1);
const rack = new Array(12).fill(null);
const where = new Map();
const stats = { requests: 0, hits: 0, misses: 0, stale: 0, wait: 0 };
const drawerOpen = new Array(8).fill(0);
let pulse = null;

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const { T, L } = WB;
// The last message is kept as T(en, es), so a language switch can redraw it.
let note = null;
const say = (m) => { note = m; const text = L(m); if (readout.textContent !== text) readout.textContent = text; };

function setCar(x) { carX = x; carriageEl.setAttribute("transform", translateAlong(P, [x, 0, 0])); }
function setDrawer(i, open) {
  drawerOpen[i] = open;
  const d = G.DRAWERS[i], el = drawerEls[i];
  el.querySelector("[data-front]").setAttribute("transform", translateAlong(P, [0, open, 0]));
  el.querySelector("[data-body]").innerHTML = open < 0.3 ? "" : solidSvg(slabOf({ x: d.x0 + 1.2, y: G.FACE_Y, w: G.DRAWER.w - 2.4, d: open, r: 0.4 }, d.z0 + 1, G.DRAWER.h - 2, P, 2), { tone: "mid", crease: "none" });
}
function raise(i) { drawersBox.appendChild(drawerEls[i]); }
function flyAt(p, opacity = 1) { fly.setAttribute("transform", translateAlong(P, p)); fly.style.opacity = String(opacity); }
function flyInto(node) { if (fly.parentNode !== node) node.appendChild(fly); }
function setLit(slot, on) { liftEls[slot].querySelector(".iso-solid").toggleAttribute("data-lit", on); }
function lift(slot, dz) { liftEls[slot].setAttribute("transform", dz ? translateAlong(P, [0, 0, dz]) : ""); }
function showCard(slot, on) { slotEls[slot].toggleAttribute("data-empty", !on); }
function clearSlot(slot) { const c = rack[slot]; if (!c) return; where.delete(c.record); rack[slot] = null; showCard(slot, false); ttlEls[slot].setAttribute("d", ""); }
function expire() { rack.forEach((c, i) => { if (c && c.expires <= now) clearSlot(i); }); }

function chooseSlot(record) {
  expire();
  for (let i = 0; i < cfg.slots; i++) if (!rack[i]) return { slot: i, evicted: null };
  let oldest = 0;
  for (let i = 1; i < cfg.slots; i++) if (rack[i].used < rack[oldest].used) oldest = i;
  const evicted = rack[oldest].record;
  clearSlot(oldest);
  return { slot: oldest, evicted };
}

function finish(time) {
  stats.requests++; stats.wait += time; showStats();
  steps.push({ dur: TIMING.gap });
}

function request() {
  const record = pickRecord(random, cfg.traffic);
  say(T("#" + record + " · asked for", "#" + record + " · pedido"));
  steps.push({
    dur: TIMING.press,
    begin: () => capSolid.setAttribute("data-lit", ""),
    run: (t) => cap.setAttribute("transform", translateAlong(P, [0, 0, -1.6 * Math.sin(Math.PI * t)])),
    done: () => { capSolid.removeAttribute("data-lit"); decide(record); },
  });
}

function decide(record) {
  expire();
  const slot = where.get(record);
  if (slot !== undefined) {
    const card = rack[slot], stale = card.version < versions[record];
    say(stale
      ? T("#" + record + " · hit, but stale v" + card.version + " (archive v" + versions[record] + ")", "#" + record + " · acierto, pero obsoleto v" + card.version + " (archivo v" + versions[record] + ")")
      : T("#" + record + " · hit", "#" + record + " · acierto"));
    setLit(slot, true);
    steps.push({ dur: TIMING.hit, run: (t) => lift(slot, 4 * Math.sin(Math.PI * t)), done: () => {
      setLit(slot, false); lift(slot, 0);
      if (rack[slot]) rack[slot].used = now;
      stats.hits++; if (stale) stats.stale++;
      finish(HIT_TIME);
    } });
    return;
  }
  const di = (record - 1) % 8, d = G.DRAWERS[di];
  say(T("#" + record + " · miss · to the archive", "#" + record + " · fallo · al archivo"));
  const from = carX;
  steps.push({ dur: TIMING.leg, run: (t) => setCar(lerp(from, d.cx, ease(t))) });
  steps.push({ dur: TIMING.drawer, begin: () => raise(di), run: (t) => setDrawer(di, G.DRAWER.open * ease(t)) });
  const top = [d.cx, G.FACE_Y + G.DRAWER.open / 2, d.z0 + G.DRAWER.h + 4];
  steps.push({ dur: TIMING.transfer, begin: () => flyInto(flyHome), run: (t) => {
    if (t < 0.35) flyAt([top[0], top[1], top[2] - 6 + 6 * ease(t / 0.35)], t / 0.35);
    else flyAt(lerp3(top, [d.cx, CARRY_Y, CARRY_Z], ease((t - 0.35) / 0.65)));
  } });
  let target = null;
  steps.push({ dur: TIMING.leg, begin: () => {
    const pick = chooseSlot(record); target = pick.slot;
    if (pick.evicted) say(T("#" + record + " · rack full · #" + pick.evicted + " out (least recently used)", "#" + record + " · estante lleno · sale #" + pick.evicted + " (el menos usado recientemente)"));
  }, run: (t) => {
    setDrawer(di, G.DRAWER.open * (1 - ease(Math.min(1, t * 2.5))));
    const x = lerp(d.cx, G.SLOTS[target].cx, ease(t));
    setCar(x); flyAt([x, CARRY_Y, CARRY_Z]);
  } });
  steps.push({ dur: TIMING.place, run: (t) => {
    const s = G.SLOTS[target], above = [s.cx, CARRY_Y, LIFT_Z], over = [s.cx, s.y + G.CARD.d / 2, LIFT_Z], home = [s.cx, s.y + G.CARD.d / 2, s.z];
    if (t < 0.35) flyAt(lerp3([s.cx, CARRY_Y, CARRY_Z], above, ease(t / 0.35)));
    else if (t < 0.65) flyAt(lerp3(above, over, ease((t - 0.35) / 0.3)));
    else { flyInto(anchors[s.row]); flyAt(lerp3(over, home, ease((t - 0.65) / 0.35))); }
  }, done: () => {
    fly.style.opacity = "0"; flyInto(flyHome);
    const s = target;
    if (rack[s]) clearSlot(s);
    rack[s] = { record, version: versions[record], expires: now + cfg.ttl, used: now };
    where.set(record, s); showCard(s, true); setLit(s, false);
    stats.misses++;
    finish(MISS_TIME);
  } });
}

function advance(dt) {
  now += dt;
  let left = dt, guard = 0;
  while (left > 1e-9 && guard++ < 50) {
    if (!current) {
      current = steps.shift();
      if (!current) { request(); continue; }
      current.elapsed = 0; current.begin && current.begin();
    }
    const use = Math.min(current.dur - current.elapsed, left);
    current.elapsed += use; left -= use;
    current.run && current.run(Math.min(1, current.elapsed / current.dur));
    if (current.elapsed >= current.dur - 1e-9) { const c = current; current = null; c.done && c.done(); }
  }
  if (pulse) {
    pulse.t += dt / 0.7;
    const busy = current && drawerOpen[pulse.di] > 0 && pulse.t <= 0;
    if (!busy) setDrawer(pulse.di, 6 * Math.sin(Math.PI * Math.min(1, pulse.t)));
    if (pulse.t >= 1) { setDrawer(pulse.di, 0); pulse = null; }
  }
}

function paint() {
  expire();
  rack.forEach((c, i) => {
    if (!c) return;
    const share = Math.max(0, Math.min(1, (c.expires - now) / cfg.ttl));
    const s = G.SLOTS[i], y = s.y + G.CARD.d, T = G.TTL_STRIP;
    ttlEls[i].setAttribute("d", share > 0.01 ? WB.faceRectY(P, s.cx + T.x0, s.cx + T.x0 + (T.x1 - T.x0) * share, y, s.z + T.z0, s.z + T.z1) : "");
  });
  const turn = (now % 60) / 60, a = turn * Math.PI * 2;
  needle.setAttribute("d", lineOnTop([CLOCK[0] - Math.sin(a) * 2.6, CLOCK[1] + Math.cos(a) * 2.6], [CLOCK[0] + Math.sin(a) * (CLOCK_R - 3.4), CLOCK[1] - Math.cos(a) * (CLOCK_R - 3.4)], CLOCK_TOP + 0.2, P));
}

const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function showStats() {
  const looked = stats.hits + stats.misses;
  statEls.requests.textContent = stats.requests;
  statEls.hits.textContent = stats.hits;
  statEls.misses.textContent = stats.misses;
  statEls.rate.textContent = looked ? Math.round(100 * stats.hits / looked) + "%" : "–";
  statEls.wait.textContent = stats.requests ? (stats.wait / stats.requests).toFixed(2) + " s" : "–";
  statEls.stale.textContent = stats.stale;
}

// ---------- controls ----------
const pauseBtn = document.querySelector('[data-act="pause"]');
const clock = WB.loop({ stage, step: (dt) => { advance(dt * cfg.speed); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(T("paused", "en pausa")); } });
// The language switch: relabel the pause button and redraw the readout, even while paused.
WB.onLang(() => { pauseBtn.textContent = clock.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (note) say(note); showStats(); });
clock.setPaused(clock.paused);
const pressSeg = WB.pressSeg;
function resetCounts() { Object.assign(stats, { requests: 0, hits: 0, misses: 0, stale: 0, wait: 0 }); showStats(); }
function applySlots(n) { cfg.slots = n; coverEls.forEach((el, i) => el.toggleAttribute("data-on", i >= n)); rack.forEach((c, i) => { if (i >= n) clearSlot(i); }); }
function set(name, raw) {
  if (name === "ttl") { cfg.ttl = Number(raw); rack.forEach((c) => { if (c) c.expires = Math.min(c.expires, now + cfg.ttl); }); }
  if (name === "slots") applySlots(Number(raw));
  if (name === "traffic") cfg.traffic = raw;
  if (name === "invalidate") cfg.invalidate = raw === "true" || raw === true;
  if (name === "speed") cfg.speed = Number(raw);
  pressSeg(name, raw);
}
function flushRack() { rack.forEach((c, i) => clearSlot(i)); say(T("rack emptied", "estante vaciado")); }
function changeRecord() {
  versions[1]++;
  pulse = { di: 0, t: 0 }; raise(0);
  let en = "#1 changed · archive now v" + versions[1], es = "#1 cambió · el archivo ahora tiene v" + versions[1];
  if (cfg.invalidate && where.has(1)) { clearSlot(where.get(1)); en += " · rack copy removed"; es += " · se quitó la copia del estante"; }
  else if (where.has(1)) { const v = rack[where.get(1)].version; en += " · rack still has v" + v; es += " · el estante sigue con v" + v; }
  say(T(en, es));
  if (clock.paused) clock.setPaused(false);
}
WB.onSegments(set);
document.querySelector('[data-act="flush"]').addEventListener("click", flushRack);
document.querySelector('[data-act="change"]').addEventListener("click", changeRecord);
document.querySelector('[data-act="reset"]').addEventListener("click", resetCounts);
pauseBtn.addEventListener("click", () => clock.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); clock.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const secs = (x) => x.toFixed(2) + " s";
const SEEDS = [3, 5, 7, 11, 13, 17];
const avg = (o) => average({ warm: 300, n: 1500, ...o }, SEEDS);
function windowWait(o, from, to) {
  let sum = 0; const seeds = Array.from({ length: 120 }, (_, i) => i + 1);
  for (const seed of seeds) { const r = runHeadless({ ttl: 60, warm: 300, n: to, seed, ...o }); sum += r.log.slice(from, to).reduce((a, x) => a + x.time, 0) / (to - from); }
  return sum / seeds.length;
}
function staleShare(invalidate) {
  let stale = 0, reads = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = runHeadless({ ttl: 60, warm: 300, n: 30, seed, invalidate, events: [{ at: 0, do: "change", record: 1 }] });
    const l = r.log.filter((x) => x.record === 1 && x.hit); reads += l.length; stale += l.filter((x) => x.stale).length;
  }
  return reads ? stale / reads : 0;
}
const base = () => avg({ ttl: 60 });
const RUNS = {
  ttl: () => { const a = base(), b = avg({ ttl: 6 }); return {
    verdict: T("Hit rate " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", average wait " + secs(a.avgTime) + " → " + secs(b.avgTime) + ".",
      "Tasa de aciertos " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", espera media " + secs(a.avgTime) + " → " + secs(b.avgTime) + "."),
    bars: [[T("TTL 60 s", "TTL 60 s"), a.hitRate, pct(a.hitRate)], [T("TTL 6 s", "TTL 6 s"), b.hitRate, pct(b.hitRate), true]] }; },
  size: () => { const a = base(), b = avg({ ttl: 60, slots: 4 }); return {
    verdict: T("Room fell to a third; hit rate only fell from " + pct(a.hitRate) + " to " + pct(b.hitRate) + ".",
      "El espacio cayó a un tercio; la tasa de aciertos solo bajó de " + pct(a.hitRate) + " a " + pct(b.hitRate) + "."),
    bars: [[T("12 slots", "12 lugares"), a.hitRate, pct(a.hitRate)], [T("4 slots", "4 lugares"), b.hitRate, pct(b.hitRate), true]] }; },
  even: () => { const a = base(), b = avg({ ttl: 60, traffic: "even" }); return {
    verdict: T("Hit rate " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", close to 12 of 40 records (30%).",
      "Tasa de aciertos " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", cerca de 12 de 40 registros (30%)."),
    bars: [[T("Popular traffic", "Tráfico popular"), a.hitRate, pct(a.hitRate)], [T("Even traffic", "Tráfico parejo"), b.hitRate, pct(b.hitRate), true]] }; },
  flush: () => { const warm = windowWait({}, 0, 10), first = windowWait({ events: [{ at: 0, do: "flush" }] }, 0, 10), later = windowWait({ events: [{ at: 0, do: "flush" }] }, 10, 30); const top = Math.max(warm, first, later) * 1.1; const more = Math.round(100 * (first / warm - 1)); return {
    verdict: T("The first 10 requests after emptying took " + more + "% longer on average; requests 11 to 30 were already back to " + secs(later) + ".",
      "Las primeras 10 solicitudes después de vaciar tardaron en promedio " + more + "% más; las solicitudes 11 a 30 ya habían vuelto a " + secs(later) + "."),
    bars: [[T("Never emptied", "Nunca vaciado"), warm / top, secs(warm)], [T("First 10 after", "Primeras 10 después"), first / top, secs(first), true], [T("Requests 11–30", "Solicitudes 11–30"), later / top, secs(later)]] }; },
  stale: () => { const off = staleShare(false), on = staleShare(true); return {
    verdict: T(pct(off) + " of rack reads of #1 were stale. With invalidate on write: " + pct(on) + ".",
      pct(off) + " de las lecturas de #1 desde el estante fueron obsoletas. Con invalidar al escribir: " + pct(on) + "."),
    bars: [[T("Invalidate off", "Invalidar: no"), off, pct(off), true], [T("Invalidate on", "Invalidar: sí"), on, pct(on)]] }; },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  set("ttl", w.ttl); set("slots", w.slots); set("traffic", w.traffic); if ("invalidate" in w) set("invalidate", String(w.invalidate));
  resetCounts();
  if (clock.paused) clock.setPaused(false);
  if (w.flush) setTimeout(flushRack, 2500);
  if (w.change) setTimeout(changeRecord, 2500);
} });

paint(); showStats(); applySlots(12);
`;


const size = writePage(new URL("./cache-workbench.html", import.meta.url), {
  title: t("Cache Workbench", "Banco de trabajo: cachés"),
  eyebrow: t("Systems lesson 01 · Caching", "Lección de sistemas 01 · Caché"),
  lede: t("A cache is a small, fast shelf of copies in front of a big, slow store. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Una caché es un estante pequeño y rápido de copias frente a un almacén grande y lento. Esta lección arma esa idea de tres maneras: mira una máquina hacerlo, predice qué la rompe y luego explícalo con tus palabras."),
  machine: { intro: t("The rack on the right is the cache. The chest on the left is the database. Watch a few requests, then change the settings below and see what the counters do.",
    "El estante de la derecha es la caché. El archivador de la izquierda es la base de datos. Mira algunas solicitudes, luego cambia los ajustes de abajo y observa qué hacen los contadores."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over 9,000 simulated requests of the same machine; the figure's starting point is a 67% hit rate.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados son el promedio de 9,000 solicitudes simuladas de la misma máquina; la figura arranca con una tasa de aciertos de 67%."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css,
  script: live,
});
console.log("wrote cache-workbench.html", (size / 1024).toFixed(0) + " KB");
