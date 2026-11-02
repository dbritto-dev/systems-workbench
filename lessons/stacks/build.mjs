// Systems lesson 34 · Stacks. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, P, FIRST, CS_GEOM, UR_GEOM, COL_GEOM, COUNTERS } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "calls",
    title: t("A function that calls itself", "Una función que se llama a sí misma"),
    change: t("sum(5) = 5 + sum(4), …, down to sum(1) = 1 · every call waits for the one it made", "sum(5) = 5 + sum(4), …, hasta sum(1) = 1 · cada llamada espera a la que hizo"),
    question: t("How deep does the call stack get, and which call returns first?", "¿Qué tan profunda llega a ser la pila de llamadas, y qué llamada retorna primero?"),
    options: [t("5 frames; sum(1) returns first", "5 marcos; sum(1) retorna primero"), t("1 frame at a time; sum(5) returns first", "1 marco a la vez; sum(5) retorna primero"), t("5 frames; sum(5) returns first", "5 marcos; sum(5) retorna primero")],
    answer: 0,
    why: t("Each call pushes a frame and can't finish until the call it made returns, so the frames pile up: sum(5) at the bottom, sum(1) on top. The last call made is the first to return (last in, first out), and each return hands its result down to the frame underneath.",
      "Cada llamada apila un marco (frame) y no puede terminar hasta que retorne la llamada que hizo, así que los marcos se acumulan: sum(5) abajo, sum(1) arriba. La última llamada hecha es la primera en retornar (último en entrar, primero en salir), y cada retorno le pasa su resultado al marco de abajo."),
    watch: { program: "sum", n: 5 },
  },
  {
    id: "overflow",
    title: t("Recursion that goes too deep", "Una recursión demasiado profunda"),
    change: t("The same sum, n = 5,000 · the stack has room for 1,000 frames · then the same sum written as a loop", "La misma suma, n = 5,000 · la pila tiene lugar para 1,000 marcos · después, la misma suma escrita como un bucle"),
    question: t("What happens to the recursive version?", "¿Qué le pasa a la versión recursiva?"),
    options: [t("It finishes, just more slowly", "Termina, solo que más lento"), t("It stops with a stack overflow when frame 1,001 doesn't fit", "Se detiene con un desbordamiento de pila (stack overflow) cuando el marco 1,001 no cabe"), t("It uses more memory, but always finishes", "Usa más memoria, pero siempre termina")],
    answer: 1,
    why: t("The call stack is a fixed-size block of memory per thread, so depth is capped (in browsers and Node around ten thousand frames, in Python 1,000 by default). Every frame is still waiting when the next is pushed, so 5,000 nested calls can't fit. The loop keeps one frame and a running total: depth 1 for any n. Iteration, or an explicit stack in an array on the heap, removes the limit.",
      "La pila de llamadas es un bloque de memoria de tamaño fijo por hilo, así que la profundidad tiene un tope (en navegadores y Node, unos diez mil marcos; en Python, 1,000 por defecto). Cada marco sigue esperando cuando se apila el siguiente, así que 5,000 llamadas anidadas no caben. El bucle usa un solo marco y un total acumulado: profundidad 1 para cualquier n. La iteración, o una pila explícita en un array en el heap, elimina el límite."),
    watch: { program: "sum", n: 20 },
  },
  {
    id: "undo",
    title: t("Undo twice, then type", "Deshaz dos veces y luego escribe"),
    change: t("Type A, B, C · undo twice (C and B move to the redo stack) · then type D", "Escribe A, B, C · deshaz dos veces (C y B pasan a la pila de rehacer) · luego escribe D"),
    question: t("What can Redo bring back now?", "¿Qué puede recuperar Rehacer ahora?"),
    options: [t("B, then C", "B, y luego C"), t("Only C", "Solo C"), t("Nothing: typing D emptied the redo stack", "Nada: escribir D vació la pila de rehacer")],
    answer: 2,
    why: t("Undo pops the top edit and pushes it on the redo stack; redo does the reverse. A new edit starts a different future, so the old redo stack no longer applies and is thrown away. Browsers do the same with back and forward: visiting a new page from the middle of your history drops the forward list.",
      "Deshacer saca la edición de arriba y la apila en la pila de rehacer; rehacer hace lo contrario. Una edición nueva empieza un futuro distinto, así que la vieja pila de rehacer ya no aplica y se descarta. Los navegadores hacen lo mismo con atrás y adelante: visitar una página nueva desde la mitad de tu historial borra la lista de adelante."),
    watch: { editor: true },
  },
  {
    id: "walk",
    title: t("Walking a tree with a stack", "Recorrer un árbol con una pila"),
    change: t("Tree: 1 has children 2 and 3; 2 has 4 and 5; 3 has 6 and 7 · keep the nodes still to visit on a stack (or let recursion do it)",
      "Árbol: 1 tiene los hijos 2 y 3; 2 tiene 4 y 5; 3 tiene 6 y 7 · guarda en una pila los nodos que faltan visitar (o deja que lo haga la recursión)"),
    question: t("Which node is visited right after node 2?", "¿Qué nodo se visita justo después del nodo 2?"),
    options: [t("3, its sibling", "3, su hermano"), t("4, its first child", "4, su primer hijo"), t("7, the last node added", "7, el último nodo agregado")],
    answer: 1,
    why: t("Taking the most recent node first goes deep before wide: 2's children were pushed after 3, so they come off first. That is depth-first search, and it is what recursion does with the call stack. Swap the stack for a queue (take the oldest first) and the same loop visits level by level: breadth-first.",
      "Tomar primero el nodo más reciente va en profundidad antes que en anchura: los hijos de 2 se apilaron después de 3, así que salen primero. Eso es la búsqueda en profundidad (depth-first search), y es lo que hace la recursión con la pila de llamadas. Cambia la pila por una cola (toma primero el más antiguo) y el mismo bucle visita nivel por nivel: en anchura (breadth-first)."),
    watch: { program: "walk" },
  },
  {
    id: "overload",
    title: t("Overloaded: newest first or oldest first?", "Sobrecarga: ¿el más nuevo primero o el más antiguo primero?"),
    change: t("Requests arrive at 120% of what the worker can finish · clients give up after 1 s · 60 s, six seeded runs",
      "Las solicitudes llegan al 120% de lo que el trabajador puede terminar · los clientes se rinden después de 1 s · 60 s, seis ejecuciones con semilla fija"),
    question: t("What share of requests finish before their client gives up?", "¿Qué parte de las solicitudes termina antes de que su cliente se rinda?"),
    options: [t("About the same either way: the worker is just as busy", "Más o menos la misma de las dos formas: el trabajador está igual de ocupado"), t("Oldest first: only a small share. Newest first: most of them, but a few wait forever", "El más antiguo primero: solo una parte pequeña. El más nuevo primero: la mayoría, pero algunas esperan para siempre"), t("Newest first is worse because it's unfair", "El más nuevo primero es peor porque es injusto")],
    answer: 1,
    why: t("With more work than capacity, the backlog only grows. Taking the oldest first means every request waits behind the whole backlog, so after a few seconds everything finishes too late: the worker is at 100% doing work nobody is waiting for. Taking the newest first serves fresh requests in time and lets the old ones starve at the bottom. That is why some servers switch to newest-first only when the queue is long (adaptive LIFO), and drop requests past their deadline.",
      "Con más trabajo que capacidad, el atraso solo crece. Tomar primero la más antigua significa que cada solicitud espera detrás de todo el atraso, así que a los pocos segundos todo termina demasiado tarde: el trabajador está al 100% haciendo trabajo que nadie espera. Tomar primero la más nueva atiende a tiempo las solicitudes frescas y deja que las viejas se queden sin atender (inanición, starvation) abajo. Por eso algunos servidores pasan a atender primero la más nueva solo cuando la cola es larga (adaptive LIFO), y descartan las solicitudes que pasaron su plazo."),
    watch: { order: "lifo", load: 1.2 },
  },
];

const QUESTIONS = [
  [t("A function calls itself ten levels deep. What is on the call stack at the deepest point, and in what order do the calls finish?",
    "Una función se llama a sí misma diez niveles de profundidad. ¿Qué hay en la pila de llamadas en el punto más profundo, y en qué orden terminan las llamadas?"),
    t("Ten frames, one per call still in progress, each holding its arguments, local variables and where to return to. The deepest (last) call is on top and finishes first; each return pops its frame and hands the result to the frame underneath.",
      "Diez marcos, uno por cada llamada todavía en curso, cada uno con sus argumentos, sus variables locales y a dónde volver. La llamada más profunda (la última) está arriba y termina primero; cada retorno saca su marco y le pasa el resultado al marco de abajo.")],
  [t("Why does deep recursion crash with \"Maximum call stack size exceeded\" or StackOverflowError, and what are two ways to fix it?",
    "¿Por qué una recursión profunda falla con \"Maximum call stack size exceeded\" o StackOverflowError, y cuáles son dos formas de arreglarlo?"),
    t("Each thread's call stack is a fixed, fairly small block of memory, so only so many frames fit. Fixes: rewrite as a loop, or keep your own stack (an array on the heap) of work still to do; or reduce depth (divide and conquer, a balanced structure). Raising the limit only moves the cliff.",
      "La pila de llamadas de cada hilo es un bloque de memoria fijo y bastante pequeño, así que solo cabe cierta cantidad de marcos. Soluciones: reescribirla como un bucle, o mantener tu propia pila (un array en el heap) con el trabajo pendiente; o reducir la profundidad (divide y vencerás, una estructura balanceada). Subir el límite solo mueve el precipicio.")],
  [t("Explain undo and redo as two stacks. Why does a new edit clear redo?", "Explica deshacer y rehacer como dos pilas. ¿Por qué una edición nueva vacía rehacer?"),
    t("Every edit is pushed on the undo stack. Undo pops it, reverses it, and pushes it on redo; redo does the opposite. A new edit branches history: the redone edits were made on top of a document that no longer exists, so they are discarded.",
      "Cada edición se apila en la pila de deshacer. Deshacer la saca, la revierte y la apila en rehacer; rehacer hace lo contrario. Una edición nueva ramifica el historial: las ediciones de rehacer se hicieron sobre un documento que ya no existe, así que se descartan.")],
  [t("Where is the stack in a browser's back and forward buttons, and in an iterative depth-first search?", "¿Dónde está la pila en los botones de atrás y adelante de un navegador, y en una búsqueda en profundidad iterativa?"),
    t("Back is a stack of pages you came from and forward a stack of pages you went back from; visiting a new page clears forward. Iterative DFS keeps a stack of nodes still to visit: pop one, push its children, repeat.",
      "Atrás es una pila de las páginas de las que viniste, y adelante una pila de las páginas desde las que volviste; visitar una página nueva vacía adelante. El DFS iterativo mantiene una pila de nodos por visitar: saca uno, apila sus hijos, repite.")],
  [t("Under overload, why can serving the newest request first give more successful responses than first come, first served? What does it cost, and how do real systems limit the damage?",
    "Bajo sobrecarga, ¿por qué atender primero la solicitud más nueva puede dar más respuestas exitosas que atender por orden de llegada? ¿Cuánto cuesta, y cómo limitan el daño los sistemas reales?"),
    t("When the backlog grows, the oldest requests have usually already timed out on the client; serving them first is wasted work while fresh ones wait and time out too. Newest-first keeps serving requests someone still wants, at the cost of starving the oldest. Systems use it only when the queue is long (adaptive LIFO), cap the queue, and drop requests whose deadline has passed.",
      "Cuando el atraso crece, las solicitudes más antiguas normalmente ya vencieron en el cliente; atenderlas primero es trabajo desperdiciado mientras las nuevas esperan y también vencen. Atender primero la más nueva sigue sirviendo solicitudes que alguien todavía quiere, a costa de dejar sin atender a las más antiguas. Los sistemas lo usan solo cuando la cola es larga (adaptive LIFO), ponen un tope a la cola y descartan las solicitudes cuyo plazo ya pasó.")],
  [t("When do you want a queue instead of a stack?", "¿Cuándo quieres una cola en lugar de una pila?"),
    t("When order and fairness matter: jobs that must all be done, messages processed in the order sent, requests under normal load (first come, first served keeps waits even and predictable), and breadth-first search. A stack fits nested work (calls, undo, parsing brackets) and freshness-first under overload.",
      "Cuando importan el orden y la justicia: trabajos que tienen que hacerse todos, mensajes procesados en el orden en que se enviaron, solicitudes bajo carga normal (el orden de llegada mantiene las esperas parejas y predecibles) y la búsqueda en anchura. Una pila sirve para el trabajo anidado (llamadas, deshacer, analizar paréntesis) y para priorizar lo fresco bajo sobrecarga.")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Plate stacks", "Pilas de platos"),
  keys: [
    { mark: "lit", label: t("Moving now: a plate being pushed or popped, the top-of-stack cursor, the request in hand", "En movimiento: un plato que se apila o se saca, el cursor del tope de la pila, la solicitud en la mano") },
    { mark: "raised", label: t("A plate (a call, an edit, a request); faded requests have outlived their client's timeout", "Un plato (una llamada, una edición, una solicitud); las solicitudes desvanecidas ya superaron el timeout de su cliente") },
    { mark: "flat", label: t("Counter wheels and rulers: depth, waiting, finished in time and too late", "Contadores y reglas: profundidad, en espera, terminadas a tiempo y tarde") },
  ],
  caption: t(
    "Left, the call stack: each call puts a labelled plate on the tower and each return lifts the top one off; the cursor on the ruler marks the top, the shelf is the limit, and the lamp lights when a call doesn't fit. Middle, undo and redo: two towers in front of the document, and a bin for redo plates thrown away when you type. Right, a busy server: requests pile up in the column, newest on top; the clerk's grabber takes from the top (newest first) or the bottom slot (oldest first), and finished requests land in the in-time or too-late tray.",
    "A la izquierda, la pila de llamadas: cada llamada pone un plato con etiqueta en la torre y cada retorno levanta el de arriba; el cursor en la regla marca el tope, el estante es el límite y la lámpara se enciende cuando una llamada no cabe. En el medio, deshacer y rehacer: dos torres delante del documento y un cesto para los platos de rehacer que se descartan cuando escribes. A la derecha, un servidor ocupado: las solicitudes se apilan en la columna, la más nueva arriba; la pinza del empleado toma de arriba (la más nueva primero) o de la ranura de abajo (la más antigua primero), y las solicitudes terminadas caen en la bandeja de a tiempo o en la de tarde.",
  ),
  stage: "data-stacks",
  stageLabel: t("Stack simulation. Space pauses or resumes.", "Simulación de pilas. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t("Type, Undo and Redo take over the editor from the demo; Start over hands it back. The server's model runs four times slower than real time so you can follow each request.",
  "Escribir, Deshacer y Rehacer toman el control del editor que estaba en demostración; Empezar de nuevo lo devuelve. El modelo del servidor corre cuatro veces más lento que el tiempo real para que puedas seguir cada solicitud."))}</p>`;
const controls = panel({
  stats: [["depth", t("Call stack depth", "Profundidad de la pila")], ["deepest", t("Deepest this run", "Máxima de esta ejecución")], ["overflows", t("Overflows", "Desbordamientos")], ["editor", t("Undo · redo", "Deshacer · rehacer"), "–"], ["ontime", t("Finished in time", "Terminadas a tiempo"), "–"], ["late", t("Clients gave up", "Clientes que se rindieron")], ["oldest", t("Oldest waiting", "Espera más larga"), "–"]],
  controls: [
    seg("program", t("Program", "Programa"), [["sum", t("Recursive sum", "Suma recursiva")], ["loop", t("Sum with a loop", "Suma con un bucle")], ["walk", t("Walk a tree", "Recorrer un árbol")]], "sum"),
    seg("n", "n", [[5, "5"], [10, "10"], [20, "20"]], 10),
    actions("Editor", [["type", t("Type", "Escribir")], ["undo", t("Undo", "Deshacer")], ["redo", t("Redo", "Rehacer")]]),
    seg("order", t("Server takes", "El servidor toma"), [["lifo", t("Newest first (stack)", "Más nueva primero (pila)")], ["fifo", t("Oldest first (queue)", "Más antigua primero (cola)")]], "lifo"),
    seg("load", t("Load", "Carga"), [[0.8, "80%"], [1.2, "120%"]], 1.2),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.tile{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.tile[data-lit]{stroke:var(--anatomy-lit);stroke-width:1.1}
.caret{stroke:var(--anatomy-lit);stroke-width:1.4}
[data-stacks] [data-stale]{opacity:.3}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const CSG = ${JSON.stringify(CS_GEOM)};
const URG = ${JSON.stringify(UR_GEOM)};
const COLG = ${JSON.stringify(COL_GEOM)};
const COUNTERS = ${JSON.stringify(COUNTERS)};
const FIRST = ${JSON.stringify(FIRST)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};

const stage = document.querySelector("[data-stacks]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const qa = (s) => [...svg.querySelectorAll(s)];
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const { T, L } = WB;
const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
const lift = (el, by) => el.setAttribute("transform", translateAlong(P, by));
const show = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
const setLit = (g, on) => g.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", on));

// Counters: digit wheels from the shared parts (WB.counter redraws only the wheels that changed).
const dials = Object.fromEntries(Object.keys(COUNTERS).map((n) => [n, WB.counter(svg, n, P)]));
const wheel = (name, v) => dials[name].set(Math.min(v, 10 ** COUNTERS[name].count - 1));

const cfg = { program: "sum", n: 10, order: "lifo", load: 1.2, speed: 1 };
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }
let focus = "cs", focusAt = 0;   // which station the readout narrates

// ======== 1. the call stack ========
const csZ = (i) => CSG.z0 + i * CSG.pitch;
const csSlots = Array.from({ length: CSG.LIMIT + 1 }, (_, i) => ({ g: q('[data-cs-slot="' + i + '"]'), label: q('[data-cs-label="' + i + '"]') }));
const csFly = { g: q("[data-cs-fly]"), label: q("[data-cs-fly-label]") };
const csCursor = q("[data-cs-cursor]");
const lamps = { off: q('[data-lamp="off"]'), on: q('[data-lamp="on"]') };
const DUR = { push: 0.55, pop: 0.5, step: 0.16, visit: 0.02, overflow: 2.2, hold: 1.6 };
let cs;
function csRestart(skipTo = 0) {
  const r = callOps(cfg.program, cfg.n, CSG.LIMIT);
  cs = { ops: r.ops, i: 0, t: 0, began: false, frames: [], deepest: 0, holding: 0, cursorZ: csZ(0), overflows: cs ? cs.overflows : 0, visited: [], last: "" };
  csSlots.forEach((s) => show(s.g, false)); show(csFly.g, false); show(lamps.on, false); show(lamps.off, true);
  setLit(csSlots[CSG.LIMIT].g, true);
  // Fast-forward through the first ops (the first frame shows a stack part-way down).
  while (cs.i < skipTo && cs.i < cs.ops.length) { const op = cs.ops[cs.i++]; applyEnd(op); }
  cs.cursorZ = csZ(cs.frames.length) - 0.6;
  csPaint();
}
function applyEnd(op) {
  if (op.op === "push") { cs.frames.push(op.label); cs.deepest = Math.max(cs.deepest, cs.frames.length); }
  else if (op.op === "pop") cs.frames.pop();
  else if (op.op === "step") cs.frames[cs.frames.length - 1] = op.label;
  else if (op.op === "visit") cs.visited.push(op.node);
}
function csPaint() {
  cs.frames.forEach((label, i) => { show(csSlots[i].g, true); setText(csSlots[i].label, label); });
  for (let i = cs.frames.length; i < CSG.LIMIT; i++) show(csSlots[i].g, false);
  wheel("depth", cs.frames.length); wheel("deepest", cs.deepest);
}
function csStep(dt) {
  if (cs.holding > 0) { cs.holding -= dt; if (cs.holding <= 0) csRestart(); return; }
  if (cs.i >= cs.ops.length) { cs.holding = DUR.hold; return; }
  const op = cs.ops[cs.i];
  const d = DUR[op.op];
  if (!cs.began) {
    cs.began = true;
    if (op.op === "push") { setText(csFly.label, op.label); show(csFly.g, true); const caller = cs.frames.length ? cs.frames[cs.frames.length - 1] : ""; cs.last = T((caller ? caller + " calls " : "") + op.label, (caller ? caller + " llama a " : "") + op.label); }
    if (op.op === "pop") { const top = cs.frames.length - 1; show(csSlots[top].g, false); setText(csFly.label, op.label); show(csFly.g, true); cs.last = T(op.label + " returns " + op.ret, op.label + " retorna " + op.ret); }
    if (op.op === "step") { setLit(csSlots[cs.frames.length - 1].g, true); cs.last = T("loop " + op.label + " · total " + op.total, "bucle " + op.label + " · total " + op.total); }
    if (op.op === "visit") { const order = cs.visited.concat(op.node).join(", "); cs.last = T("visit " + op.node + " · order so far " + order, "visita " + op.node + " · orden hasta ahora " + order); }
    if (op.op === "overflow") { setText(csSlots[CSG.LIMIT].label, op.label); show(csSlots[CSG.LIMIT].g, true); show(lamps.on, true); show(lamps.off, false); cs.last = T("stack overflow: " + op.label + " doesn't fit (limit " + CSG.LIMIT + ")", "desbordamiento de pila: " + op.label + " no cabe (límite " + CSG.LIMIT + ")"); }
    if (op.op === "step") cs.frames[cs.frames.length - 1] = op.label;
    csPaint();
    if (op.op === "pop") show(csSlots[cs.frames.length - 1].g, false);
  }
  cs.t += dt;
  const p = Math.min(1, cs.t / d);
  if (op.op === "push") lift(csFly.g, [0, 0, csZ(cs.frames.length) + 9 * (1 - ease(p / 0.8))]);
  if (op.op === "pop") lift(csFly.g, [0, 0, csZ(cs.frames.length - 1) + 9 * ease(p)]);
  if (cs.t >= d) {
    if (op.op === "push" || op.op === "pop") show(csFly.g, false);
    if (op.op === "step") setLit(csSlots[cs.frames.length - 1].g, false);
    if (op.op === "overflow") { cs.overflows++; cs.frames = []; show(csSlots[CSG.LIMIT].g, false); show(lamps.on, false); show(lamps.off, true); cs.i = cs.ops.length; cs.holding = DUR.hold; csPaint(); return; }
    if (op.op !== "step") applyEnd(op);
    cs.i++; cs.t = 0; cs.began = false;
    csPaint();
  }
}
function csCursor_(dt) {
  const op = cs.ops[cs.i];
  let depth = cs.frames.length;
  if (op && cs.began && op.op === "push") depth += 1;
  if (op && cs.began && op.op === "pop") depth -= 1;
  const target = csZ(Math.max(0, depth)) - 0.6;
  cs.cursorZ += (target - cs.cursorZ) * Math.min(1, dt * 12);
  lift(csCursor, [0, 0, cs.cursorZ]);
}

// ======== 2. undo and redo ========
const urSlots = [0, 1].map((t) => Array.from({ length: URG.UR_LIMIT }, (_, s) => ({ g: q('[data-ur-slot="' + t + '-' + s + '"]'), label: q('[data-ur-label="' + t + '-' + s + '"]') })));
const urFly = { g: q("[data-ur-fly]"), label: q("[data-ur-fly-label]") };
const docTiles = Array.from({ length: URG.DOC_SLOTS }, (_, s) => ({ g: q('[data-doc="' + s + '"]'), tile: q('[data-doc="' + s + '"] .tile'), label: q('[data-doc-label="' + s + '"]') }));
const caret = q("[data-caret]");
const binPlates = [0, 1, 2].map((s) => q('[data-bin="' + s + '"]'));
const urZ = (i) => URG.UR_BASE_H + i * URG.UR_PITCH;
const DX = URG.UR[1].x - URG.UR[0].x;
const DEMO = ["redo", "redo", "undo", "undo", "type:R", "undo", "type:Y", "wait", "wait"];
const WATCH = ["reset0", "type:A", "type:B", "type:C", "undo", "undo", "wait", "type:D", "wait", "wait", "wait"];
let ed, ur;
function edFromFirst() { const e = makeEditor(); e.doc = FIRST.editor.doc.slice(); e.undo = FIRST.editor.undo.slice(); e.redo = FIRST.editor.redo.slice(); e.dropped = FIRST.editor.binned; return e; }
function urRestart(script = DEMO, fresh = false) {
  ed = fresh ? makeEditor() : edFromFirst();
  ur = { script, i: 0, t: 0, gap: 0.9, anim: null, manual: false };
  show(urFly.g, false);
  urPaint();
}
function urPaint() {
  [ed.undo, ed.redo].forEach((pile, t) => urSlots[t].forEach((s, i) => { show(s.g, i < pile.length); if (i < pile.length) setText(s.label, pile[i]); }));
  docTiles.forEach((d, i) => { show(d.g, i < ed.doc.length); if (i < ed.doc.length) setText(d.label, ed.doc[i]); });
  const x = URG.DOC.x + 5 + ed.doc.length * 7.1 - 0.6;
  caret.setAttribute("d", pathOf([iso([x, URG.DOC.fy, 10.6], P), iso([x, URG.DOC.fy, 19.4], P)]));
  binPlates.forEach((b, i) => show(b, i < Math.min(3, ed.dropped)));
  stat("editor", ed.undo.length + " · " + ed.redo.length);
}
// The editor's last message, kept in both languages so the readout can follow a language switch.
let urMsg = null;
const sayUr = (m) => { urMsg = m; say(L(m)); };
// Start an animated edit. Returns false if it can't happen.
function urDo(action) {
  if (ur.anim) return false;
  let ev = null, from, to, label;
  if (action.startsWith("type:")) {
    if (ed.doc.length >= URG.DOC_SLOTS || ed.undo.length >= URG.UR_LIMIT) { sayUr(T("the document and the undo tower are full in this model; real editors drop the oldest undo", "el documento y la torre de deshacer están llenos en este modelo; los editores reales descartan el deshacer más antiguo")); return false; }
    const ch = action.slice(5);
    const cleared = ed.redo.length;
    ev = ed.type(ch); from = null; to = [0, ed.undo.length - 1]; label = ch;
    sayUr(cleared ? T("typed " + ch + " · the redo stack (" + cleared + ") goes in the bin", "escribiste " + ch + " · la pila de rehacer (" + cleared + ") va al cesto") : T("typed " + ch + " · pushed on undo", "escribiste " + ch + " · se apila en deshacer"));
  } else if (action === "undo") {
    if (!ed.undo.length) { sayUr(T("nothing to undo", "nada que deshacer")); return false; }
    from = [0, ed.undo.length - 1]; ev = ed.undoOne(); to = [1, ed.redo.length - 1]; label = ev.ch;
    sayUr(T("undo " + ev.ch + " · popped from undo, pushed on redo", "deshacer " + ev.ch + " · sale de deshacer, entra en rehacer"));
  } else if (action === "redo") {
    if (!ed.redo.length) { sayUr(T("nothing to redo", "nada que rehacer")); return false; }
    from = [1, ed.redo.length - 1]; ev = ed.redoOne(); to = [0, ed.undo.length - 1]; label = ev.ch;
    sayUr(T("redo " + ev.ch + " · popped from redo, pushed on undo", "rehacer " + ev.ch + " · sale de rehacer, entra en deshacer"));
  }
  focus = "ur"; focusAt = 2.2;
  ur.anim = { from, to, t: 0, d: from ? 0.9 : 0.55 };
  setText(urFly.label, label); show(urFly.g, true);
  urPaint();
  show(urSlots[to[0]][to[1]].g, false);
  const tile = docTiles[Math.max(0, ed.doc.length - 1)];
  if (action !== "undo") tile.tile.toggleAttribute("data-lit", true);
  return true;
}
function urStep(dt) {
  if (ur.anim) {
    const a = ur.anim; a.t += dt;
    const p = Math.min(1, a.t / a.d);
    const toZ = urZ(a.to[1]), toX = a.to[0] * DX;
    let x, z;
    if (!a.from) { x = toX; z = toZ + 9 * (1 - ease(p)); }
    else {
      const fx = a.from[0] * DX, fz = urZ(a.from[1]), top = Math.max(fz, toZ) + 7;
      if (p < 0.3) { x = fx; z = fz + (top - fz) * ease(p / 0.3); }
      else if (p < 0.7) { x = fx + (toX - fx) * ease((p - 0.3) / 0.4); z = top; }
      else { x = toX; z = top + (toZ - top) * ease((p - 0.7) / 0.3); }
    }
    lift(urFly.g, [x, 0, z]);
    if (p >= 1) { ur.anim = null; show(urFly.g, false); docTiles.forEach((d) => d.tile.removeAttribute("data-lit")); urPaint(); }
    return;
  }
  if (ur.manual) return;
  ur.gap -= dt;
  if (ur.gap > 0) return;
  if (ur.i >= ur.script.length) { urRestart(ur.script === WATCH ? WATCH : DEMO, ur.script === WATCH); return; }
  const action = ur.script[ur.i++];
  ur.gap = 0.8;
  if (action === "wait") return;
  if (action === "reset0") { ed = makeEditor(); urPaint(); return; }
  urDo(action);
}

// ======== 3. the busy server ========
const TS = 0.25;           // model seconds per figure second
const tickets = Array.from({ length: COLG.TK_SHOW }, (_, s) => q('[data-tk="' + s + '"]'));
const grab = q("[data-grab]");
const work = { lit: q("[data-work]"), stale: q("[data-work-stale]") };
const trays = [0, 1].map((t) => Array.from({ length: COLG.TRAY_SHOW }, (_, s) => q('[data-tray="' + t + '-' + s + '"]')));
const tkZ = (i) => COLG.tkZ0 + i * COLG.TK_PITCH;
let sv, svSeed = 11, grabZ = tkZ(8);
function svRestart() {
  sv = makeServer({ order: cfg.order, load: cfg.load }, svSeed++);
  sv.runTo(cfg.load > 1 ? 5 : 3);
  sv.base = { onTime: sv.onTime, late: sv.late };
  svPaint(0);
}
function svPaint(dt) {
  const now = sv.now, w = sv.waiting, n = Math.min(COLG.TK_SHOW, w.length), first = w.length - n;
  for (let s = 0; s < COLG.TK_SHOW; s++) {
    const el = tickets[s];
    if (s >= n) { show(el, false); continue; }
    const r = w[first + s];
    show(el, true);
    el.toggleAttribute("data-stale", now - r.t > TIMEOUT);
    const fresh = (now - r.t) / TS;   // figure seconds since it arrived
    const arriving = dt > 0 && fresh < 0.3;
    lift(el, [0, 0, tkZ(s) + (arriving ? 6 * (1 - ease(fresh / 0.3)) : 0)]);
    setLit(el, arriving);
  }
  const target = sv.order === "lifo" ? (n ? tkZ(n - 1) + 0.2 : tkZ(0)) : COLG.BOTTOM_GRAB;
  grabZ = dt > 0 ? grabZ + (target - grabZ) * Math.min(1, dt * 10) : target;
  lift(grab, [0, 0, grabZ]);
  const b = sv.busy;
  show(work.lit, !!b && now - b.t <= TIMEOUT);
  show(work.stale, !!b && now - b.t > TIMEOUT);
  const done = [sv.onTime, sv.late];
  trays.forEach((pile, t) => pile.forEach((el, s) => show(el, s < Math.min(COLG.TRAY_SHOW, Math.ceil(done[t] / 8)))));
  wheel("waiting", w.length); wheel("onTime", sv.onTime); wheel("late", sv.late); wheel("oldest", Math.floor(sv.oldest()));
  const gaveUp = sv.late + sv.stale();
  const decided = sv.onTime + gaveUp;
  stat("ontime", decided ? Math.round((100 * sv.onTime) / decided) + "%" : "–");
  stat("late", gaveUp);
  stat("oldest", sv.oldest().toFixed(1) + " s");
}
function svStep(dt) {
  sv.runTo(sv.now + dt * TS);
  if (sv.waiting.length > 400) svRestart();
  svPaint(dt);
}

// ======== the loop ========
function narrate() {
  if (focus === "ur" && focusAt > 0) { if (urMsg) say(L(urMsg)); return; }
  say(cs.last ? L(cs.last) : L("starting", "iniciando"));
}
const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({
  stage,
  step: (dt) => {
    const d = dt * cfg.speed;
    csStep(d); csCursor_(d); urStep(d); svStep(d);
    focusAt -= d; narrate();
    stat("depth", cs.frames.length); stat("deepest", cs.deepest); stat("overflows", cs.overflows);
  },
  onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(L("paused", "en pausa")); },
});
// The language switch: relabel the pause button and redraw the readout, even while paused.
WB.onLang(() => { pauseBtn.textContent = loop.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); say(loop.paused ? L("paused", "en pausa") : (focus === "ur" && focusAt > 0 && urMsg ? L(urMsg) : cs.last ? L(cs.last) : L("starting", "iniciando"))); });

function restartAll() { csRestart(cfg.program === "sum" && cfg.n === 10 ? FIRST.stack.length : 0); urRestart(); svRestart(); }
function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  if (name === "program") { cfg.program = raw; if (!quiet) csRestart(); }
  if (name === "n") { cfg.n = Number(raw); if (!quiet) csRestart(); }
  if (name === "order") { cfg.order = raw; sv.setOrder(raw); }
  if (name === "load") { cfg.load = Number(raw); if (!quiet) svRestart(); }
}
WB.onSegments((name, value) => set(name, value));
const LETTERS = "STACKPUSHPOP";
let typed = 0;
for (const act of ["type", "undo", "redo"]) document.querySelector('[data-act="' + act + '"]').addEventListener("click", () => {
  ur.manual = true;
  if (act === "type") { if (urDo("type:" + LETTERS[typed % LETTERS.length])) typed++; }
  else urDo(act);
  if (loop.paused) loop.setPaused(false);
});
document.querySelector('[data-act="reset"]').addEventListener("click", () => { cs.overflows = 0; restartAll(); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const pct = (x) => Math.round(100 * x) + "%";
const SEEDS = [1, 2, 3, 4, 5, 6];
const RUNS = {
  calls: () => {
    const r = callOps("sum", 5, 1000);
    const pops = r.ops.filter((o) => o.op === "pop");
    const order = pops.map((o) => o.label.replace("sum ", "sum(") + ")→" + o.ret).join(", ");
    return { verdict: T("Deepest: " + r.max + " frames. Returns in order: " + order + ".", "Profundidad máxima: " + r.max + " marcos. Retornos en orden: " + order + "."),
      bars: [[T("Deepest stack", "Pila más profunda"), r.max / 5, T(r.max + " frames", r.max + " marcos")], [T("First to return", "Primera en retornar"), 1 / 5, pops[0].label.replace("sum ", "sum(") + ")", true], [T("Last to return", "Última en retornar"), 1, pops[pops.length - 1].label.replace("sum ", "sum(") + ") = " + r.result]] };
  },
  overflow: () => {
    const rec = callOps("sum", 5000, 1000), it = callOps("loop", 5000, 1000);
    const at = (rec.max + 1).toLocaleString("en"), res = it.result.toLocaleString("en");
    return { verdict: T("Recursive: stack overflow when frame " + at + " didn't fit, no result. Loop: depth " + it.max + ", result " + res + ".",
        "Recursiva: desbordamiento de pila cuando el marco " + at + " no cupo, sin resultado. Bucle: profundidad " + it.max + ", resultado " + res + "."),
      bars: [[T("Recursive, frames in use", "Recursiva, marcos en uso"), 1, T(rec.max.toLocaleString("en") + " · overflow", rec.max.toLocaleString("en") + " · desbordamiento"), true], [T("Loop, frames in use", "Bucle, marcos en uso"), it.max / 1000, String(it.max)]] };
  },
  undo: () => {
    const e = makeEditor(); e.type("A"); e.type("B"); e.type("C"); e.undoOne(); e.undoOne();
    const redo = e.redo.slice().reverse(), before = redo.join(" (top), then "), antes = redo.join(" (arriba), luego ");
    e.type("D");
    return { verdict: T("Before typing D, redo held " + before + ". After: document " + e.doc.join(" ") + ", undo " + e.undo.join(" ") + ", redo empty; " + e.dropped + " edits thrown away.",
        "Antes de escribir D, rehacer tenía " + antes + ". Después: documento " + e.doc.join(" ") + ", deshacer " + e.undo.join(" ") + ", rehacer vacía; " + e.dropped + " ediciones descartadas."),
      bars: [[T("Undo stack", "Pila de deshacer"), e.undo.length / 3, e.undo.join(" ")], [T("Redo stack", "Pila de rehacer"), 0, T("empty", "vacía"), true], [T("Thrown away", "Descartadas"), e.dropped / 3, String(e.dropped)]] };
  },
  walk: () => {
    const dfs = walkOrder("stack"), bfs = walkOrder("queue");
    return { verdict: T("Stack (depth first): " + dfs.join(", ") + ". Queue (breadth first): " + bfs.join(", ") + ". After 2 the stack visits " + dfs[dfs.indexOf(2) + 1] + ".",
        "Pila (en profundidad): " + dfs.join(", ") + ". Cola (en anchura): " + bfs.join(", ") + ". Después de 2, la pila visita " + dfs[dfs.indexOf(2) + 1] + "."),
      bars: [[T("Stack: after 2", "Pila: después de 2"), 1, String(dfs[dfs.indexOf(2) + 1]), true], [T("Queue: after 2", "Cola: después de 2"), 1, String(bfs[bfs.indexOf(2) + 1])]] };
  },
  overload: () => {
    const avg = (order, load) => averageOf(SEEDS.map((s) => serverRun(order, load, 60, s)));
    const f = avg("fifo", 1.2), l = avg("lifo", 1.2), f8 = avg("fifo", 0.8), l8 = avg("lifo", 0.8);
    return { verdict: T("At 120%: oldest first finished " + pct(f.onTimeShare) + " in time, newest first " + pct(l.onTimeShare) + ". The oldest request still waiting: " + f.oldest.toFixed(0) + " s vs " + l.oldest.toFixed(0) + " s (starved). At 80% load oldest first wins: " + pct(f8.onTimeShare) + " vs " + pct(l8.onTimeShare) + ", slowest 1% " + f8.p99.toFixed(1) + " s vs " + l8.p99.toFixed(1) + " s.",
        "Al 120%: la más antigua primero terminó a tiempo el " + pct(f.onTimeShare) + "; la más nueva primero, el " + pct(l.onTimeShare) + ". La solicitud más antigua que sigue esperando: " + f.oldest.toFixed(0) + " s contra " + l.oldest.toFixed(0) + " s (sin atender). Con carga del 80% gana la más antigua primero: " + pct(f8.onTimeShare) + " contra " + pct(l8.onTimeShare) + "; el 1% más lento, " + f8.p99.toFixed(1) + " s contra " + l8.p99.toFixed(1) + " s."),
      bars: [[T("In time, oldest first", "A tiempo, más antigua primero"), f.onTimeShare, pct(f.onTimeShare)], [T("In time, newest first", "A tiempo, más nueva primero"), l.onTimeShare, pct(l.onTimeShare), true], [T("Oldest waiting, oldest first", "Espera más larga, más antigua primero"), Math.min(1, f.oldest / 60), f.oldest.toFixed(0) + " s"], [T("Oldest waiting, newest first", "Espera más larga, más nueva primero"), Math.min(1, l.oldest / 60), l.oldest.toFixed(0) + " s", true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  if (w.program) { set("program", w.program, true); if (w.n) set("n", String(w.n), true); csRestart(); }
  if (w.editor) urRestart(WATCH, true);
  if (w.order) { set("order", w.order, true); set("load", String(w.load), true); svRestart(); }
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
restartAll();
`;

const size = writePage(new URL("./stack-workbench.html", import.meta.url), {
  title: t("Stack Workbench", "Banco de trabajo: pilas"),
  eyebrow: t("Systems lesson 34 · Stacks", "Lección de sistemas 34 · Pilas"),
  lede: t("A stack hands back the last thing you put on it: last in, first out. It runs every function call you make, it is how undo works, and under overload it can decide which users get an answer. This lesson builds three stacks on one machine: watch them, predict what they do, then explain it back.",
    "Una pila (stack) te devuelve lo último que pusiste en ella: último en entrar, primero en salir (LIFO). Ejecuta cada llamada a función que haces, es como funciona deshacer y, bajo sobrecarga, puede decidir qué usuarios reciben una respuesta. Esta lección arma tres pilas en una sola máquina: míralas, predice qué hacen y después explícalo."),
  machine: { intro: t("Three stacks run side by side. On the left a recursive sum pushes one plate per call and pops them as the calls return; switch to a loop, or to a tree walk, or raise n past the shelf. In the middle, edits go on the undo tower and undone edits on the redo tower; press Type, Undo and Redo yourself. On the right, requests arrive faster than the clerk can finish them: compare taking the newest first with the oldest first.",
    "Tres pilas funcionan lado a lado. A la izquierda, una suma recursiva apila un plato por llamada y los saca a medida que las llamadas retornan; cambia a un bucle o a recorrer un árbol, o sube n más allá del estante. En el medio, las ediciones van a la torre de deshacer y las ediciones deshechas a la de rehacer; presiona tú mismo Escribir, Deshacer y Rehacer. A la derecha, las solicitudes llegan más rápido de lo que el empleado puede terminarlas: compara tomar primero la más nueva con tomar primero la más antigua."), figure, panel: controls },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine; the server experiment is averaged over six seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina; el experimento del servidor se promedia sobre seis ejecuciones con semilla fija."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Newest-first under overload follows Facebook's adaptive LIFO, described in <a href="https://queue.acm.org/detail.cfm?id=2839461" target="_blank" rel="noopener">Fail at Scale</a> (ACM Queue, 2015).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Atender primero lo más nuevo bajo sobrecarga sigue el adaptive LIFO de Facebook, descrito en <a href="https://queue.acm.org/detail.cfm?id=2839461" target="_blank" rel="noopener">Fail at Scale</a> (ACM Queue, 2015).`),
  css,
  script: live,
});
console.log("wrote stack-workbench.html", (size / 1024).toFixed(0) + " KB");
