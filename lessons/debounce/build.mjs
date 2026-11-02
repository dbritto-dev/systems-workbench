// Systems lesson 31 · Debounce. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, pawnSvg, ticketSvg, dotSvg, pegSvg, postSvg, P, GEOMETRY } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));
const digits = inlineModule(new URL("./digits.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "search",
    title: t("Debounce the search box", "Debounce en el buscador"),
    change: t("Search-as-you-type · every keystroke used to send a request · now: wait until 300 ms with no key, then send once",
      "Búsqueda mientras escribes · antes cada pulsación enviaba una solicitud · ahora: espera hasta que pasen 300 ms sin teclas y luego envía una vez"),
    question: t("Someone types a search of about 12 characters, pausing briefly between words. How many requests does one search send now?",
      "Alguien escribe una búsqueda de unos 12 caracteres, con pausas breves entre palabras. ¿Cuántas solicitudes envía ahora una búsqueda?"),
    options: [t("Still about one per key: the keys just go out 300 ms later", "Todavía cerca de una por tecla: las teclas solo salen 300 ms más tarde"), t("About two or three: one for each pause longer than 300 ms", "Unas dos o tres: una por cada pausa de más de 300 ms"), t("Exactly one, always", "Exactamente una, siempre")],
    answer: 1,
    why: t("Each key restarts the 300 ms timer, so a request only leaves when the typist pauses for longer than that. Keys come about 170 ms apart inside a word, so a word's keys ride together; the short think between words is often longer than 300 ms, so a search sends one request per pause plus the final one. Fewer requests, not a guaranteed one.",
      "Cada tecla reinicia el temporizador de 300 ms, así que una solicitud solo sale cuando quien escribe hace una pausa más larga que eso. Dentro de una palabra las teclas llegan a unos 170 ms entre sí, así que las teclas de una palabra viajan juntas; la breve pausa para pensar entre palabras suele durar más de 300 ms, así que una búsqueda envía una solicitud por pausa más la final. Menos solicitudes, no una garantizada."),
    watch: { mode: "trailing", wait: 0.3, maxWait: 0, input: "typing", latency: "steady", cancel: "off" },
  },
  {
    id: "wait",
    title: t("Choose the wait", "Elige la espera"),
    change: t("Same typing · the debounce wait 100 ms → 300 ms → 1 s · a steady server that answers in about 0.2 s",
      "El mismo tecleo · la espera del debounce 100 ms → 300 ms → 1 s · un servidor estable que responde en unos 0.2 s"),
    question: t("What does each wait give you?", "¿Qué te da cada espera?"),
    options: [t("100 ms sends the fewest requests and feels fastest", "100 ms envía la menor cantidad de solicitudes y se siente más rápido"), t("100 ms barely cuts anything; 1 s sends about one per search, but results arrive over a second after the last key", "100 ms casi no reduce nada; 1 s envía cerca de una por búsqueda, pero los resultados llegan más de un segundo después de la última tecla"), t("All three send about the same number of requests", "Las tres envían más o menos la misma cantidad de solicitudes")],
    answer: 1,
    why: t("A wait only merges keys that arrive closer together than the wait. Typing gaps are longer than 100 ms, so almost every key still gets its own request. A long wait merges whole searches, but every search now pays that wait before the server even hears about it. Most search boxes land between 200 and 400 ms.",
      "Una espera solo junta las teclas que llegan más cerca entre sí que la espera. Los intervalos al teclear duran más de 100 ms, así que casi cada tecla sigue teniendo su propia solicitud. Una espera larga junta búsquedas enteras, pero ahora cada búsqueda paga esa espera antes de que el servidor siquiera se entere. La mayoría de los buscadores usan entre 200 y 400 ms."),
    watch: { mode: "trailing", wait: 1, maxWait: 0, input: "typing", latency: "steady", cancel: "off" },
  },
  {
    id: "hold",
    title: t("A key held down", "Una tecla sostenida"),
    change: t("An event every 50 ms for 5 s (a held key, a scroll, a window resize), then 2 s of quiet · debounce 300 ms",
      "Un evento cada 50 ms durante 5 s (una tecla sostenida, un scroll, un cambio de tamaño de la ventana), luego 2 s de calma · debounce de 300 ms"),
    question: t("When does the first request go out?", "¿Cuándo sale la primera solicitud?"),
    options: [t("300 ms after the first event", "300 ms después del primer evento"), t("Only after the stream stops, more than 5 s after it began", "Solo cuando el flujo se detiene, más de 5 s después de que empezó"), t("Every 300 ms while the events keep coming", "Cada 300 ms mientras siguen llegando eventos")],
    answer: 1,
    why: t("Every event restarts the timer, and the events never pause for 300 ms, so the door never closes: nothing is sent until the stream stops. That is starvation. A maximum wait fixes it: with maxWait 1 s the door closes at least once a second, whatever keeps arriving. If you want a steady beat during the stream, that is throttling, not debouncing.",
      "Cada evento reinicia el temporizador, y los eventos nunca se detienen 300 ms, así que la puerta nunca se cierra: no se envía nada hasta que el flujo para. Eso es inanición (starvation). Una espera máxima lo arregla: con maxWait de 1 s la puerta se cierra al menos una vez por segundo, llegue lo que llegue. Si quieres un ritmo constante durante el flujo, eso es throttling, no debouncing."),
    watch: { mode: "trailing", wait: 0.3, maxWait: 0, input: "hold", latency: "steady", cancel: "off" },
  },
  {
    id: "clicks",
    title: t("A double click on Submit", "Un doble clic en Enviar"),
    change: t("An impatient user double-clicks the order button, the clicks about 160 ms apart · no debounce, trailing 300 ms, or leading 300 ms",
      "Un usuario impaciente hace doble clic en el botón de pedido, con unos 160 ms entre clics · sin debounce, debounce al final (trailing) de 300 ms o al inicio (leading) de 300 ms"),
    question: t("Which setting sends exactly one order, and sends it immediately?", "¿Qué ajuste envía exactamente un pedido, y lo envía de inmediato?"),
    options: [t("No debounce", "Sin debounce"), t("Trailing debounce, 300 ms", "Debounce al final, 300 ms"), t("Leading debounce, 300 ms", "Debounce al inicio, 300 ms")],
    answer: 2,
    why: t("Without debounce both clicks become orders. Trailing debounce sends one order, but only 300 ms after the last click, so the button feels slow. Leading debounce sends on the first click and ignores everything until 300 ms of quiet: one order, at once. The server should still refuse duplicates (an idempotency key), because the client cannot catch every double submit.",
      "Sin debounce, los dos clics se vuelven pedidos. El debounce al final envía un pedido, pero solo 300 ms después del último clic, así que el botón se siente lento. El debounce al inicio envía con el primer clic e ignora todo hasta que haya 300 ms de calma: un pedido, al instante. El servidor igual debería rechazar duplicados (una clave de idempotencia), porque el cliente no puede atrapar cada doble envío."),
    watch: { mode: "leading", wait: 0.3, maxWait: 0, input: "clicks", latency: "steady", cancel: "off" },
  },
  {
    id: "order",
    title: t("Slow answers arrive late", "Las respuestas lentas llegan tarde"),
    change: t("Typing with a server that is usually quick but takes 1 to 2.5 s for one request in six · no debounce, debounce 300 ms, then debounce plus cancelling the older request",
      "Tecleo con un servidor que suele ser rápido pero tarda de 1 a 2.5 s en una de cada seis solicitudes · sin debounce, debounce de 300 ms y luego debounce más cancelar la solicitud anterior"),
    question: t("With a 300 ms debounce, can the screen still show results for an older search after a newer one?",
      "Con un debounce de 300 ms, ¿la pantalla todavía puede mostrar resultados de una búsqueda anterior después de una más reciente?"),
    options: [t("No: debounced requests go out in order, so their answers come back in order", "No: las solicitudes con debounce salen en orden, así que sus respuestas vuelven en orden"), t("Yes, less often than without debounce; cancelling the older request when sending a new one stops it", "Sí, menos seguido que sin debounce; cancelar la solicitud anterior al enviar una nueva lo evita"), t("Only without debounce", "Solo sin debounce")],
    answer: 1,
    why: t("Debounce decides when requests leave, not when answers come back. If an early request hits the slow path and a later one does not, the early answer lands last and replaces the right one on the screen. Fewer requests means fewer chances, not none. Abort the previous request (AbortController), or tag each request and ignore any answer older than the newest one shown.",
      "El debounce decide cuándo salen las solicitudes, no cuándo vuelven las respuestas. Si una solicitud temprana cae en el camino lento y una posterior no, la respuesta temprana llega última y reemplaza a la correcta en la pantalla. Menos solicitudes significan menos oportunidades, no ninguna. Aborta la solicitud anterior (AbortController), o etiqueta cada solicitud e ignora cualquier respuesta más vieja que la más reciente ya mostrada."),
    watch: { mode: "trailing", wait: 0.3, maxWait: 0, input: "typing", latency: "variable", cancel: "off" },
  },
];

const QUESTIONS = [
  [t("In one sentence, what does a debounce do, and how is it different from a throttle?", "En una oración, ¿qué hace un debounce y en qué se diferencia de un throttle?"),
    t("A debounce waits until events stop for a set time and then acts once, every new event restarting the wait. A throttle acts at most once per interval while events keep coming. Debounce answers \"when they're done\", throttle answers \"at a steady pace\".",
      "Un debounce espera a que los eventos se detengan durante un tiempo fijo y entonces actúa una vez; cada evento nuevo reinicia la espera. Un throttle actúa como máximo una vez por intervalo mientras siguen llegando eventos. El debounce responde \"cuando terminen\"; el throttle, \"a un ritmo constante\".")],
  [t("Why did a 100 ms debounce barely reduce the requests from typing?", "¿Por qué un debounce de 100 ms casi no redujo las solicitudes al teclear?"),
    t("It only merges events that arrive within 100 ms of each other. Most people type with gaps longer than that, so nearly every keystroke still finds the timer expired and sends its own request. The wait has to be longer than the gap you want to merge.",
      "Solo junta los eventos que llegan a menos de 100 ms uno de otro. La mayoría de la gente teclea con intervalos más largos, así que casi cada pulsación encuentra el temporizador vencido y envía su propia solicitud. La espera tiene que ser más larga que el intervalo que quieres juntar.")],
  [t("Search box: trailing. Submit button: leading. Why the different edges?", "Buscador: al final (trailing). Botón de envío: al inicio (leading). ¿Por qué flancos distintos?"),
    t("A search should run on the final text, after typing stops, so it waits for the trailing edge. A submit should react to the first click at once and ignore the accidental second one, so it fires on the leading edge and stays closed until things go quiet.",
      "Una búsqueda debería correr con el texto final, cuando se deja de teclear, así que espera al flanco final. Un envío debería reaccionar al primer clic de inmediato e ignorar el segundo accidental, así que dispara en el flanco inicial y se queda cerrado hasta que todo se calma.")],
  [t("A debounced scroll handler never runs while the user keeps scrolling. Why, and what are two fixes?", "Un handler de scroll con debounce nunca corre mientras el usuario sigue haciendo scroll. ¿Por qué, y cuáles son dos soluciones?"),
    t("Each scroll event restarts the timer and they never pause long enough for it to run out. Add a maximum wait so it fires at least every N ms, or use a throttle when you want regular updates during the stream.",
      "Cada evento de scroll reinicia el temporizador y nunca hay una pausa lo bastante larga para que se agote. Agrega una espera máxima para que dispare al menos cada N ms, o usa un throttle cuando quieras actualizaciones regulares durante el flujo.")],
  [t("Your debounced search still sometimes shows results for an earlier query. Why doesn't debounce prevent that, and what does?", "Tu búsqueda con debounce a veces todavía muestra resultados de una consulta anterior. ¿Por qué el debounce no lo evita, y qué sí lo evita?"),
    t("Debounce only spaces out when requests leave; answers can still come back in any order. Cancel the in-flight request when you send a new one (AbortController), or remember the latest request id and drop any answer that is older.",
      "El debounce solo espacia cuándo salen las solicitudes; las respuestas pueden volver en cualquier orden. Cancela la solicitud en curso cuando envías una nueva (AbortController), o recuerda el id de la última solicitud y descarta cualquier respuesta más vieja.")],
  [t("In React, a teammate writes const onChange = debounce(search, 300) inside the component body, and it doesn't debounce at all. What happened, and how do you fix it?",
    "En React, alguien del equipo escribe const onChange = debounce(search, 300) dentro del cuerpo del componente, y no hace ningún debounce. ¿Qué pasó y cómo lo arreglas?"),
    t("Every render creates a new debounced function with its own empty timer, so each keystroke goes to a fresh one. Create it once (useMemo or useRef, or a useDebouncedCallback hook), keep the latest search in a ref if it changes, and cancel the pending call when the component unmounts.",
      "Cada render crea una nueva función con debounce, con su propio temporizador vacío, así que cada pulsación va a una función nueva. Créala una sola vez (useMemo o useRef, o un hook useDebouncedCallback), guarda la última search en un ref si cambia, y cancela la llamada pendiente cuando el componente se desmonta.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Elevator lobby", "Vestíbulo del elevador"),
  keys: [
    { mark: "lit", label: t("A request: the closed car, a ticket on the desk, an answer on the wire, a flag on the tape", "Una solicitud: la cabina cerrada, un ticket en el escritorio, una respuesta en el cable, una bandera en la cinta") },
    { mark: "raised", label: t("Passengers are keystrokes; counters on the car, desk, keyboard and screen", "Los pasajeros son pulsaciones; contadores en la cabina, el escritorio, el teclado y la pantalla") },
    { mark: "flat", label: t("The tape: pegs for keys, posts for requests", "La cinta: estacas para las teclas, postes para las solicitudes") },
  ],
  caption: t(
    "Each keystroke lights a key and sends a passenger to the elevator. The left dial over the door is the debounce timer: it restarts with every new passenger, and when it runs out the doors close and the car takes the whole group up as one request (the counter on the car shows how many keys it carries). The right dial shows how long the first passenger has waited; its mark is the maximum wait. With debounce off, every passenger climbs the stairs alone. Tickets on the server desk are requests being answered; answers ride the wire down to the screen, which shows what was typed and which search the results are for. The lamp lights when an older answer has replaced a newer one.",
    "Cada pulsación ilumina una tecla y manda un pasajero al elevador. El dial izquierdo sobre la puerta es el temporizador del debounce: se reinicia con cada pasajero nuevo, y cuando se agota las puertas se cierran y la cabina sube a todo el grupo como una sola solicitud (el contador de la cabina muestra cuántas teclas lleva). El dial derecho muestra cuánto lleva esperando el primer pasajero; su marca es la espera máxima. Con el debounce apagado, cada pasajero sube solo por la escalera. Los tickets en el escritorio del servidor son solicitudes que se están respondiendo; las respuestas bajan por el cable hasta la pantalla, que muestra lo escrito y de qué búsqueda son los resultados. La lámpara se enciende cuando una respuesta anterior reemplazó a una más reciente.",
  ),
  stage: "data-lobby",
  stageLabel: t("Debounce simulation. Space pauses or resumes.", "Simulación de debounce. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

// The box's placeholder has no shared helper: both languages ride on data attributes and the script swaps them.
const TYPE = `<div class="control"><span>${tx(t("Type here", "Escribe aquí"))}</span><input class="type-in" data-type type="text" placeholder="type to feed keystrokes" data-ph-en="type to feed keystrokes" data-ph-es="escribe para enviar pulsaciones" autocomplete="off" spellcheck="false" maxlength="40" aria-label="Type to send keystrokes into the machine" data-aria-en="Type to send keystrokes into the machine" data-aria-es="Escribe para enviar pulsaciones a la máquina"></div>`;
const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t("Changing a setting starts the run again. Choose “You type” and type in the box to drive the machine yourself.",
  "Cambiar un ajuste reinicia la ejecución. Elige “Tú escribes” y escribe en el cuadro para manejar la máquina tú mismo."))}</p>`;
const controls = panel({
  stats: [["keys", t("Keystrokes", "Pulsaciones")], ["reqs", t("Requests", "Solicitudes")], ["per", t("Keys per request", "Teclas por solicitud"), "–"], ["lag", t("Last key → results", "Última tecla → resultados"), "–"], ["stale", t("Older answer shown", "Respuesta anterior mostrada")], ["cancelled", t("Cancelled", "Canceladas")]],
  controls: [
    seg("mode", "Debounce", [["none", t("Off", "Apagado")], ["trailing", t("Trailing", "Al final")], ["leading", t("Leading", "Al inicio")]], "trailing"),
    seg("wait", t("Wait", "Espera"), [[0.1, "100 ms"], [0.3, "300 ms"], [1, "1 s"]], 0.3),
    seg("maxWait", t("Max wait", "Espera máxima"), [[0, t("None", "Ninguna")], [1, "1 s"]], 0),
    seg("input", t("Input", "Entrada"), [["typing", t("Typing", "Tecleo")], ["hold", t("Held key", "Tecla sostenida")], ["clicks", t("Double clicks", "Doble clic")], ["live", t("You type", "Tú escribes")]], "typing"),
    seg("latency", t("Server", "Servidor"), [["steady", t("Steady", "Estable")], ["variable", t("Slow tail", "Picos lentos")]], "variable"),
    seg("cancel", t("Older request", "Solicitud anterior"), [["off", t("Keep", "Mantener")], ["on", t("Cancel", "Cancelar")]], "off"),
    TYPE,
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}
.dg[data-size=s]{stroke-width:.9}
.dial-face{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.8}
.pie{fill:var(--anatomy-lit);stroke:var(--anatomy-lit);stroke-width:.4;stroke-linejoin:round}
.cable{fill:none;stroke:var(--anatomy-lo);stroke-width:.7}
.field{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.field[data-lit]{stroke:var(--anatomy-lit);stroke-width:1.5}
.iso-stage .iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}
.type-in{font:inherit;font-size:13px;padding:6px 8px;min-width:0;width:100%;max-width:280px;background:transparent;color:inherit;border:1px solid var(--anatomy-lo);border-radius:0}
.type-in:focus-visible{outline:2px solid var(--anatomy-strong);outline-offset:1px}
`;

// ---------- live code ----------
const live = `
${sim}
${digits}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const PAWN = ${JSON.stringify(pawnSvg())};
const TICKET_SVG = ${JSON.stringify(ticketSvg())};
const DOT_SVG = ${JSON.stringify(dotSvg())};
const PEG_SVG = ${JSON.stringify(pegSvg())};
const POST_SVG = ${JSON.stringify(postSvg())};

const stage = document.querySelector("[data-lobby]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (t) => { if (readout.textContent !== t) readout.textContent = t; };
const { T, L } = WB;
const NS = "http://www.w3.org/2000/svg";
const at = (p) => iso(p, P);
const path = (pts) => pathOf(pts.map(at));

function makePool(layer, html, n) {
  return Array.from({ length: n }, () => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; g.style.display = "none"; layer.appendChild(g); return g; });
}
const riders = makePool(q("[data-riders]"), PAWN, 12);
const walkers = makePool(q("[data-walkers]"), PAWN, 24);
const climbers = makePool(q("[data-climbers]"), PAWN, 16);
const tickets = makePool(q("[data-tickets]"), TICKET_SVG, G.SLOTS.length);
const dots = makePool(q("[data-dots]"), DOT_SVG, 10);
const pegs = makePool(q("[data-tape]"), PEG_SVG, 90);
const posts = makePool(q("[data-tape]"), POST_SVG, 40);
const carEl = q("[data-car]"), cable = q("[data-cable]");
const doorsOpen = q('[data-doors="open"]'), doorsClosed = q('[data-doors="closed"]');
const pie = { quiet: q('[data-pie="quiet"]'), first: q('[data-pie="first"]') };
const markEl = q('[data-mark="first"]'), markPath = markEl.querySelector("path");
const keyEls = Object.fromEntries([...svg.querySelectorAll("[data-key]")].map((el) => [el.dataset.key, { cap: el.querySelector("[data-cap]"), lit: el.querySelector("[data-cap-lit]") }]));
const typedText = q('[data-text="typed"]'), shownText = q('[data-text="shown"]'), shownField = q('[data-field="shown"]');
const lampOn = q('[data-lamp="on"]'), lampOff = q('[data-lamp="off"]');

function counter(name, c) { const cells = counterCells(c); return { c, cells, els: cells.map((_, j) => q('[data-digit="' + name + '-' + j + '"]')), shown: [] }; }
const dials = { keys: counter("keys", G.COUNTERS.keys), aboard: counter("aboard", G.COUNTERS.aboard), sent: counter("sent", G.COUNTERS.sent), stale: counter("stale", G.COUNTERS.stale) };
function show(dial, v) { digitsOf(v, dial.c.count).forEach((d, j) => { if (dial.shown[j] !== d) { dial.shown[j] = d; dial.els[j].setAttribute("d", digitPath(iso, P, dial.cells[j], d)); } }); }
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
const place = (g, p, extra) => { g.style.display = ""; g.setAttribute("transform", translateAlong(P, p)); if (extra !== undefined) g.style.opacity = extra; };
const hide = (list, from) => { for (let i = from; i < list.length; i++) if (list[i].style.display !== "none") list[i].style.display = "none"; };
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

const cfg = { mode: "trailing", wait: 0.3, maxWait: 0, input: "typing", latency: "variable", cancel: "off", speed: 1 };
let model, clock, lagText, seenShown, liveText;
let seed = (Date.now() % 1e6) + 1;

const ride = (r) => Math.min(0.25, 0.4 * cfg.wait, 0.5 * r.lat);
const transit = (r) => Math.min(0.45, 0.5 * r.lat);
const wireT = (r) => Math.min(0.35, 0.4 * r.lat);
const walkT = () => Math.min(0.3, 0.8 * cfg.wait);
const arriveAt = (r) => r.t + (cfg.mode === "none" ? transit(r) : ride(r));

function restart() {
  model = makeSim({ mode: cfg.mode, wait: cfg.wait, maxWait: cfg.maxWait, input: cfg.input, latency: cfg.latency, cancel: cfg.cancel === "on" }, seed++);
  clock = 0; lagText = "–"; seenShown = 0; liveText = "";
  if (cfg.input !== "live") warm();
  markEl.style.display = cfg.maxWait > 0 && cfg.mode === "trailing" ? "" : "none";
  if (cfg.maxWait > 0) { const c = G.DIALS.first, a = Math.min(1, cfg.maxWait / 2) * Math.PI * 2, r = G.DIALS.r; markPath.setAttribute("d", path([[c[0] + 0.5 * r * Math.sin(a), c[1], c[2] + 0.5 * r * Math.cos(a)], [c[0] + 1.02 * r * Math.sin(a), c[1], c[2] + 1.02 * r * Math.cos(a)]])); }
  paint();
}

// Start a little way in, at a moment that shows the machine at work.
function warm() {
  const inFlight = () => model.requests.filter((r) => r.status === "flight" && clock >= arriveAt(r) && clock < r.done - wireT(r)).length;
  const good = (strict) => {
    if (cfg.input === "hold") return clock > 6.6 && clock < 7.6;
    if (cfg.input === "clicks") return model.requests.length >= 2 && (cfg.mode === "none" ? inFlight() >= 1 : clock - model.events[model.events.length - 1].t < 0.12);
    if (cfg.mode === "trailing") { const p = model.pending; const left = (model.fireAt - clock) / cfg.wait; return p && p.keys >= (strict ? 4 : 3) && left > 0.35 && left < (strict ? 0.7 : 1) && model.screen.text && (!strict || model.requests.length >= 8); }
    if (cfg.mode === "none") return model.requests.filter((r) => r.status === "flight" && clock < r.done - wireT(r)).length >= (strict ? 3 : 2) && model.screen.text;
    return model.quietUntil > clock && model.events.length && model.events[model.events.length - 1].fate === "ignored" && model.screen.text;
  };
  for (clock = 4; clock < 60; clock += 0.02) { model.runTo(clock); if (good(clock < 30)) return; }
}

function keyFor(e) {
  if (cfg.input === "hold") return " ";
  if (cfg.input === "clicks") return "⏎";
  const ch = (e.text[e.text.length - 1] || " ").toLowerCase();
  return keyEls[ch] ? ch : "⏎";
}

function paint() {
  const m = model, now = clock;
  // Keys: the ones pressed in the last 120 ms dip and light.
  const pressed = new Set();
  for (let i = m.events.length - 1; i >= 0 && now - m.events[i].t < 0.12; i--) pressed.add(keyFor(m.events[i]));
  for (const [ch, el] of Object.entries(keyEls)) { const on = pressed.has(ch); el.cap.style.display = on ? "none" : ""; el.lit.style.display = on ? "" : "none"; }

  // The car: find the trip in progress, if any.
  let trip = null;
  if (cfg.mode !== "none") for (let i = m.requests.length - 1; i >= 0; i--) { const r = m.requests[i]; if (now >= r.t && now < r.t + 2 * ride(r)) { trip = r; break; } if (r.t + 2 * ride(r) < now - 1) break; }
  let carZ = 0, up = false;
  if (trip) { const R = ride(trip), p = (now - trip.t) / R; up = p < 1; carZ = G.TOP * (up ? ease(p) : 1 - ease(p - 1)); }
  carEl.setAttribute("transform", carZ ? translateAlong(P, [0, 0, carZ]) : "");
  doorsOpen.style.display = trip ? "none" : ""; doorsClosed.style.display = trip ? "" : "none";
  const cx = G.CAR.x + G.CAR.w / 2, cy = G.CAR.y + G.CAR.d / 2;
  cable.setAttribute("d", path([[G.CABLE_TOP[0], G.CABLE_TOP[1], G.CABLE_TOP[2] - carZ], [cx, cy, G.CAR_H + 1.6]]));

  // Riders inside the car, people waiting in front of it, people walking from the keyboard.
  let nr = 0, nw = 0;
  const pending = m.pending;
  const pend = cfg.mode === "trailing" && pending ? pending.events : [];
  if (trip && up) for (let i = 0; i < Math.min(12, trip.keys); i++) place(riders[nr++], [...G.RIDE_SLOTS[i], 1.6]);
  pend.forEach((e, i) => {
    const t = (now - e.t) / walkT();
    const home = !trip;
    const target = home ? [...G.RIDE_SLOTS[Math.min(11, i)], 1.6] : [...G.WAIT_SLOTS[Math.min(7, i)], 0];
    if (t >= 1) { if (home) { if (nr < 12) place(riders[nr++], target); } else if (nw < walkers.length) place(walkers[nw++], target, 1); }
    else if (nw < walkers.length) {
      // Walk to the door, then step in.
      const door = [target[0], G.CAR.y + G.CAR.d + 4, 0];
      const pos = t < 0.75 ? lerp([...G.KB_EXIT, 0], door, ease(t / 0.75)) : lerp(door, home ? [target[0], target[1], 0] : target, ease((t - 0.75) / 0.25));
      if (home && t >= 0.75) { if (nr < 12) place(riders[nr++], [pos[0], pos[1], 1.6]); }
      else place(walkers[nw++], pos, 1);
    }
  });
  if (cfg.mode === "leading") {
    for (let i = m.events.length - 1; i >= 0 && now - m.events[i].t < 0.6; i--) {
      const e = m.events[i]; if (e.fate !== "ignored" || nw >= walkers.length) continue;
      const t = (now - e.t) / 0.6, door = [G.CAR.x + 12 + (i % 3) * 5, G.CAR.y + G.CAR.d + 8, 0];
      place(walkers[nw++], t < 0.5 ? lerp([...G.KB_EXIT, 0], door, ease(t * 2)) : lerp(door, [...G.KB_EXIT, 0], ease((t - 0.5) * 2)), String(Math.max(0, 1 - t)));
    }
  }
  hide(riders, nr); hide(walkers, nw);

  // Without debounce: every request is its own climber, from the keyboard to the foot of the stairs and up,
  // for as long as the request is out (a slow request climbs slowly); at the top its answer takes the wire.
  let nc = 0;
  if (cfg.mode === "none") for (let i = m.requests.length - 1; i >= 0; i--) {
    const r = m.requests[i]; const T = r.done - wireT(r) - r.t;
    const gone = r.status === "cancelled" ? now - r.cancelledAt : 0;   // a cancelled climber fades where it stood
    if (now - r.t > T || gone > 0.4) { if (now - r.t > 4) break; continue; }
    if (now < r.t || nc >= climbers.length) continue;
    const f = (Math.min(now, r.cancelledAt ?? now) - r.t) / T, foot = [G.STAIR.x0 - 3, G.STAIR.y + G.STAIR.d / 2, 0];
    let pos;
    if (f < 0.25) pos = lerp([...G.KB_EXIT, 0], foot, ease(f / 0.25));
    else { const s = (f - 0.25) / 0.75, run = (G.STAIR.x1 - G.STAIR.x0) / G.STEPS, k = Math.min(G.STEPS - 1, Math.floor(s * G.STEPS)); pos = [G.STAIR.x0 + s * (G.STAIR.x1 - G.STAIR.x0) - run / 2, foot[1], ((k + 1) * G.TOP) / G.STEPS]; }
    place(climbers[nc++], pos, gone > 0 ? String(1 - gone / 0.4) : "1");
  }
  hide(climbers, nc);

  // Tickets on the desk, answers on the wire.
  const slotUsed = new Array(G.SLOTS.length).fill(false);
  let nd = 0, inFlight = 0;
  for (let i = m.requests.length - 1; i >= 0; i--) {
    const r = m.requests[i];
    if (r.done < now - 3 && (r.status !== "cancelled" || r.cancelledAt < now - 3)) { if (now - r.t > 6) break; continue; }
    const s = r.id % G.SLOTS.length;
    if (r.status === "cancelled") {
      if (cfg.mode !== "none" && now >= arriveAt(r) && now < r.cancelledAt + 0.7 && !slotUsed[s]) { slotUsed[s] = true; const g = tickets[s]; place(g, [...G.SLOTS[s], 0]); g.children[0].style.display = "none"; g.children[1].style.display = ""; }
      continue;
    }
    if (now < r.t || now >= r.done) continue;
    inFlight++;
    if (now >= r.done - wireT(r)) {
      if (nd < dots.length) { const f = (now - (r.done - wireT(r))) / wireT(r); place(dots[nd++], along(G.WIRE, f)); }
    } else if (cfg.mode !== "none" && now >= arriveAt(r) && !slotUsed[s]) { slotUsed[s] = true; const g = tickets[s]; place(g, [...G.SLOTS[s], 0]); g.children[0].style.display = ""; g.children[1].style.display = "none"; }
  }
  tickets.forEach((g, s) => { if (!slotUsed[s]) g.style.display = "none"; });
  hide(dots, nd);

  // Dials: the door timer, and how long the first passenger has waited.
  let rem = 0, first = 0;
  if (cfg.mode === "trailing" && pending) { rem = (m.fireAt - now) / cfg.wait; first = (now - pending.first) / 2; }
  if (cfg.mode === "leading") rem = (m.quietUntil - now) / cfg.wait;
  rem = Math.max(0, Math.min(1, rem)); first = Math.max(0, Math.min(1, first));
  setNeedle("quiet", rem); setNeedle("first", first);

  // Tape: pegs for keys, posts for requests.
  let np = 0, nq = 0;
  const xOf = (t) => G.NOW_X - (now - t) * G.TAPE_SCALE;
  for (let i = m.events.length - 1; i >= 0; i--) {
    const e = m.events[i]; if (now - e.t > G.TAPE_SECONDS) break; if (np >= pegs.length) break;
    place(pegs[np++], [xOf(e.t), G.TAPE.y + 4, 0], e.fate === "ignored" ? ".35" : "1");
  }
  for (let i = m.requests.length - 1; i >= 0; i--) {
    const r = m.requests[i]; if (now - r.t > G.TAPE_SECONDS) break; if (nq >= posts.length) break;
    const g = posts[nq++]; place(g, [xOf(r.t), G.TAPE.y + 8.5, 0]);
    const off = r.status === "cancelled"; g.children[1].style.display = off ? "none" : ""; g.children[2].style.display = off ? "" : "none";
  }
  hide(pegs, np); hide(posts, nq);

  // Screen and counters.
  const typed = m.screen.typed, stale = m.screen.id >= 0 && m.screen.id < m.screen.maxId;
  setText(typedText, typed ? (typed.length > 22 ? "…" + onScreen(typed).slice(-21) : onScreen(typed)) + "▏" : "▏");
  setText(shownText, m.screen.text ? (m.screen.text.length > 22 ? "…" + onScreen(m.screen.text).slice(-21) : onScreen(m.screen.text)) : "–");
  shownText.dataset.tone = stale ? "lit" : "hi";
  shownField.toggleAttribute("data-lit", stale);
  lampOn.style.display = stale ? "" : "none"; lampOff.style.display = stale ? "none" : "";
  show(dials.keys, m.events.length); show(dials.sent, m.requests.length); show(dials.stale, m.screen.staleShown);
  show(dials.aboard, trip ? (up ? trip.keys : 0) : pend.length);

  // Lag: when the answer for exactly what is typed lands, measure it from the last keystroke.
  const shownNow = m.requests.filter((r) => r.status === "shown").length;
  if (shownNow !== seenShown) {
    seenShown = shownNow;
    const last = m.events[m.events.length - 1];
    if (last && m.screen.text === typed && m.screen.id === m.screen.maxId) { const r = m.requests[m.screen.id]; if (r.done >= last.t) lagText = Math.round((r.done - last.t) * 1000) + " ms"; }
  }

  // Readout and stats.
  let msg;
  if (stale) msg = T("an older answer replaced a newer one · the screen is behind", "una respuesta anterior reemplazó a una más reciente · la pantalla está atrasada");
  else if (trip) msg = up ? T("doors closed · " + trip.keys + (trip.keys === 1 ? " key" : " keys") + " going up as one request", "puertas cerradas · " + trip.keys + (trip.keys === 1 ? " tecla sube" : " teclas suben") + " como una sola solicitud") : T("car coming back down", "la cabina vuelve a bajar");
  else if (cfg.mode === "none") msg = T("no debounce · every key climbs the stairs · " + inFlight + " in flight", "sin debounce · cada tecla sube por la escalera · " + inFlight + " en curso");
  else if (cfg.mode === "leading") msg = rem > 0 ? T("leading · ignoring keys until " + Math.round(cfg.wait * 1000) + " ms of quiet", "al inicio · ignora teclas hasta " + Math.round(cfg.wait * 1000) + " ms de calma") : T("leading · the next key goes up at once", "al inicio · la próxima tecla sube enseguida");
  else if (pending) { const left = Math.max(0, Math.round((m.fireAt - now) * 1000)); msg = T("door open · " + pending.keys + " aboard · closes in " + left + " ms unless someone else comes", "puerta abierta · " + pending.keys + " a bordo · cierra en " + left + " ms si no llega nadie más"); }
  else msg = T("door open · waiting for a key", "puerta abierta · esperando una tecla");
  say(L(msg));
  stat("keys", m.events.length);
  stat("reqs", m.requests.length);
  stat("per", m.requests.length ? (m.events.length / m.requests.length).toFixed(1) : "–");
  stat("lag", lagText);
  stat("stale", m.screen.staleShown);
  stat("cancelled", m.requests.filter((r) => r.status === "cancelled").length);
}
// The clicks input's screen text is "order N", data from the model; it reads "pedido N" in Spanish.
function onScreen(s) { return cfg.input === "clicks" ? s.replace(/^order /, L("order ", "pedido ")) : s; }
// A dial shows its value as a filled wedge, clockwise from twelve o'clock.
function setNeedle(name, frac) {
  const c = G.DIALS[name], r = G.DIALS.r * 0.8;
  if (frac <= 0.002) { pie[name].setAttribute("d", ""); return; }
  const n = Math.max(2, Math.ceil(frac * 36)), pts = [c];
  for (let i = 0; i <= n; i++) { const a = (i / n) * frac * Math.PI * 2; pts.push([c[0] + r * Math.sin(a), c[1], c[2] + r * Math.cos(a)]); }
  pie[name].setAttribute("d", pathOf(pts.map(at), true));
}
function along(pts, f) {
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(l); total += l; }
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) return lerp(pts[i], pts[i + 1], d / seg[i]); d -= seg[i]; }
  return pts[pts.length - 1];
}
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const t = String(value); if (el && el.textContent !== t) el.textContent = t; }

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { clock += dt * cfg.speed; model.runTo(clock); paint(); }, onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(L("paused", "en pausa")); } });

function set(name, raw, quiet) {
  if (name === "speed") { cfg.speed = Number(raw); WB.pressSeg(name, raw); return; }
  cfg[name] = ["wait", "maxWait"].includes(name) ? Number(raw) : raw;
  WB.pressSeg(name, raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });
const typeIn = document.querySelector("[data-type]");
const placeholder = () => { typeIn.placeholder = typeIn.getAttribute("data-ph-" + WB.lang()); };
placeholder();
// The language switch: relabel the pause button and the box, redraw the readout, stats and screen, even while paused.
WB.onLang(() => { pauseBtn.textContent = loop.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); placeholder(); paint(); if (loop.paused) say(L("paused", "en pausa")); });
typeIn.addEventListener("focus", () => { if (cfg.input !== "live") set("input", "live"); });
typeIn.addEventListener("input", () => {
  if (cfg.input !== "live") set("input", "live");
  model.feed(clock, typeIn.value);
  if (loop.paused) loop.setPaused(false);
});

// ---------- experiments ----------
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const ms = (x) => Math.round(x * 1000) + " ms";
const sec = (x) => (x >= 1 ? one(x) + " s" : ms(x));
const RUNS = {
  search: () => {
    const off = averaged({ mode: "none", latency: "steady" }), on = averaged({ mode: "trailing", wait: 0.3, latency: "steady" });
    return { verdict: T("A search is " + one(off.keysPerSession) + " keys on average. Without debounce it sent " + one(off.perSession) + " requests; with a 300 ms debounce, " + one(on.perSession) + ".",
        "Una búsqueda tiene " + one(off.keysPerSession) + " teclas en promedio. Sin debounce enviaba " + one(off.perSession) + " solicitudes; con un debounce de 300 ms, " + one(on.perSession) + "."),
      bars: [[T("Keys per search", "Teclas por búsqueda"), 1, one(off.keysPerSession)], [T("Requests, no debounce", "Solicitudes, sin debounce"), off.perSession / off.keysPerSession, one(off.perSession)], [T("Requests, 300 ms debounce", "Solicitudes, debounce de 300 ms"), on.perSession / off.keysPerSession, one(on.perSession), true]] };
  },
  wait: () => {
    const r = [0.1, 0.3, 1].map((w) => averaged({ mode: "trailing", wait: w, latency: "steady" }));
    const k = r[0].keysPerSession, lagTop = Math.max(...r.map((x) => x.lag));
    const reqs = r.map((x) => one(x.perSession)).join(" → "), lags = r.map((x) => ms(x.lag)).join(" → ");
    return { verdict: T("Requests per search: " + reqs + " (of " + one(k) + " keys). Last key to results: " + lags + ".",
        "Solicitudes por búsqueda: " + reqs + " (de " + one(k) + " teclas). De la última tecla a los resultados: " + lags + "."),
      bars: [[T("Requests, 100 ms", "Solicitudes, 100 ms"), r[0].perSession / k, one(r[0].perSession)], [T("Requests, 300 ms", "Solicitudes, 300 ms"), r[1].perSession / k, one(r[1].perSession)], [T("Requests, 1 s", "Solicitudes, 1 s"), r[2].perSession / k, one(r[2].perSession), true],
        [T("Wait for results, 100 ms", "Espera de resultados, 100 ms"), r[0].lag / lagTop, ms(r[0].lag)], [T("Wait for results, 1 s", "Espera de resultados, 1 s"), r[2].lag / lagTop, ms(r[2].lag), true]] };
  },
  hold: () => {
    const plain = averaged({ mode: "trailing", wait: 0.3, input: "hold", latency: "steady" }), capped = averaged({ mode: "trailing", wait: 0.3, maxWait: 1, input: "hold", latency: "steady" });
    return { verdict: T("Debounce 300 ms: the first request left " + sec(plain.firstSend) + " after the stream began, " + one(plain.sentDuring) + " during it. With maxWait 1 s: first after " + sec(capped.firstSend) + ", " + one(capped.sentDuring) + " during the 5 s.",
        "Debounce de 300 ms: la primera solicitud salió " + sec(plain.firstSend) + " después de que empezó el flujo, " + one(plain.sentDuring) + " durante él. Con maxWait de 1 s: la primera a los " + sec(capped.firstSend) + ", " + one(capped.sentDuring) + " durante los 5 s."),
      bars: [[T("First request, 300 ms", "Primera solicitud, 300 ms"), Math.min(1, plain.firstSend / 6), sec(plain.firstSend), true], [T("First request, maxWait 1 s", "Primera solicitud, maxWait 1 s"), Math.min(1, capped.firstSend / 6), sec(capped.firstSend)]] };
  },
  clicks: () => {
    const r = ["none", "trailing", "leading"].map((m) => averaged({ mode: m, wait: 0.3, input: "clicks", latency: "steady" }));
    const names = ["No debounce", "Trailing 300 ms", "Leading 300 ms"], nombres = ["Sin debounce", "Al final 300 ms", "Al inicio 300 ms"];
    return { verdict: T(r.map((x, i) => names[i] + ": " + one(x.perSession) + " orders, first after " + ms(x.firstSend)).join(" · ") + ".",
        r.map((x, i) => nombres[i] + ": " + one(x.perSession) + " pedidos, el primero a los " + ms(x.firstSend)).join(" · ") + "."),
      bars: r.flatMap((x, i) => [[T(names[i] + ", orders", nombres[i] + ", pedidos"), x.perSession / 2, one(x.perSession), i === 2], [T(names[i] + ", delay", nombres[i] + ", demora"), Math.min(1, x.firstSend / 0.6), ms(x.firstSend), i === 2]]) };
  },
  order: () => {
    const off = averaged({ mode: "none", latency: "variable" }), deb = averaged({ mode: "trailing", wait: 0.3, latency: "variable" }), can = averaged({ mode: "trailing", wait: 0.3, latency: "variable", cancel: true });
    const per = (x) => Math.round(x.staleShare * 100), top = Math.max(1, per(off));
    return { verdict: T("Times an older answer replaced a newer one, per 100 searches: " + per(off) + " without debounce, " + per(deb) + " with a 300 ms debounce, " + per(can) + " when each new request cancels the older one.",
        "Veces que una respuesta anterior reemplazó a una más reciente, por cada 100 búsquedas: " + per(off) + " sin debounce, " + per(deb) + " con un debounce de 300 ms, " + per(can) + " cuando cada solicitud nueva cancela la anterior."),
      bars: [[T("No debounce", "Sin debounce"), per(off) / top, String(per(off))], [T("Debounce 300 ms", "Debounce de 300 ms"), per(deb) / top, String(per(deb)), true], [T("Debounce + cancel", "Debounce + cancelar"), per(can) / top, String(per(can))]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  for (const key of ["mode", "wait", "maxWait", "input", "latency", "cancel"]) set(key, String(w[key]), true);
  restart();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./debounce-workbench.html", import.meta.url), {
  title: t("Debounce Workbench", "Banco de trabajo: debounce"),
  eyebrow: t("Systems lesson 31 · Debounce", "Lección de sistemas 31 · Debounce"),
  lede: t("A debounce waits until events stop for a moment and then acts once. Every new event restarts the wait, so a burst of keystrokes becomes one request. This lesson turns it into an elevator that leaves only when nobody new has arrived: watch it, predict what breaks it, then explain it back.",
    "Un debounce (antirrebote) espera a que los eventos se detengan un momento y entonces actúa una vez. Cada evento nuevo reinicia la espera, así que una ráfaga de pulsaciones se convierte en una sola solicitud. Esta lección lo convierte en un elevador que solo sale cuando no llegó nadie nuevo: míralo, predice qué lo rompe y después explícalo."),
  machine: { intro: t("Every keystroke sends a passenger to the elevator. The door timer over the car restarts with each one; when it runs out, the whole group goes up to the server as one request. Turn debounce off and every passenger climbs the stairs alone. Change the wait, hold a key down, double-click, or type in the box yourself.",
    "Cada pulsación manda un pasajero al elevador. El temporizador de la puerta, sobre la cabina, se reinicia con cada uno; cuando se agota, todo el grupo sube al servidor como una sola solicitud. Apaga el debounce y cada pasajero sube solo por la escalera. Cambia la espera, sostén una tecla, haz doble clic o escribe tú mismo en el cuadro."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs of two minutes each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre seis ejecuciones con semilla fija de dos minutos cada una."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Lesson 32 covers the throttle, debounce's sibling.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. La lección 32 trata el throttle, el hermano del debounce.`),
  css,
  script: live,
});
console.log("wrote debounce-workbench.html", (size / 1024).toFixed(0) + " KB");
