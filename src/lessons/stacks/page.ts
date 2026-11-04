// @ts-nocheck: content ported as-is
// Systems lesson 34 · Stacks: three stacks on one machine (the call stack, undo and redo, a busy server).
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { averageOver } from "../../lib/stats";
import { pct } from "../../lib/format";
import { buildFigure, P, FIRST, CS_GEOM, UR_GEOM, COL_GEOM, COUNTERS } from "./figure";
import { callOps, walkOrder, makeEditor, serverRun } from "./sim";

// What each card shows after a run, worked out at build time from the same model the page runs (the server
// experiment averaged over six seeds).
const SEEDS = [1, 2, 3, 4, 5, 6];
const RUNS = {
  calls: () => {
    const r = callOps("sum", 5, 1000);
    const pops = r.ops.filter((o) => o.op === "pop");
    const order = pops.map((o) => o.label.replace("sum ", "sum(") + ")→" + o.ret).join(", ");
    return { verdict: t("Deepest: " + r.max + " frames. Returns in order: " + order + ".", "Profundidad máxima: " + r.max + " marcos. Retornos en orden: " + order + "."),
      bars: [[t("Deepest stack", "Pila más profunda"), r.max / 5, t(r.max + " frames", r.max + " marcos")], [t("First to return", "Primera en retornar"), 1 / 5, pops[0].label.replace("sum ", "sum(") + ")", true], [t("Last to return", "Última en retornar"), 1, pops[pops.length - 1].label.replace("sum ", "sum(") + ") = " + r.result]] };
  },
  overflow: () => {
    const rec = callOps("sum", 5000, 1000), it = callOps("loop", 5000, 1000);
    const at = (rec.max + 1).toLocaleString("en"), res = it.result.toLocaleString("en");
    return { verdict: t("Recursive: stack overflow when frame " + at + " didn't fit, no result. Loop: depth " + it.max + ", result " + res + ".",
        "Recursiva: desbordamiento de pila cuando el marco " + at + " no cupo, sin resultado. Bucle: profundidad " + it.max + ", resultado " + res + "."),
      bars: [[t("Recursive, frames in use", "Recursiva, marcos en uso"), 1, t(rec.max.toLocaleString("en") + " · overflow", rec.max.toLocaleString("en") + " · desbordamiento"), true], [t("Loop, frames in use", "Bucle, marcos en uso"), it.max / 1000, String(it.max)]] };
  },
  undo: () => {
    const e = makeEditor(); e.type("A"); e.type("B"); e.type("C"); e.undoOne(); e.undoOne();
    const redo = e.redo.slice().reverse(), before = redo.join(" (top), then "), antes = redo.join(" (arriba), luego ");
    e.type("D");
    return { verdict: t("Before typing D, redo held " + before + ". After: document " + e.doc.join(" ") + ", undo " + e.undo.join(" ") + ", redo empty; " + e.dropped + " edits thrown away.",
        "Antes de escribir D, rehacer tenía " + antes + ". Después: documento " + e.doc.join(" ") + ", deshacer " + e.undo.join(" ") + ", rehacer vacía; " + e.dropped + " ediciones descartadas."),
      bars: [[t("Undo stack", "Pila de deshacer"), e.undo.length / 3, e.undo.join(" ")], [t("Redo stack", "Pila de rehacer"), 0, t("empty", "vacía"), true], [t("Thrown away", "Descartadas"), e.dropped / 3, String(e.dropped)]] };
  },
  walk: () => {
    const dfs = walkOrder("stack"), bfs = walkOrder("queue");
    return { verdict: t("Stack (depth first): " + dfs.join(", ") + ". Queue (breadth first): " + bfs.join(", ") + ". After 2 the stack visits " + dfs[dfs.indexOf(2) + 1] + ".",
        "Pila (en profundidad): " + dfs.join(", ") + ". Cola (en anchura): " + bfs.join(", ") + ". Después de 2, la pila visita " + dfs[dfs.indexOf(2) + 1] + "."),
      bars: [[t("Stack: after 2", "Pila: después de 2"), 1, String(dfs[dfs.indexOf(2) + 1]), true], [t("Queue: after 2", "Cola: después de 2"), 1, String(bfs[bfs.indexOf(2) + 1])]] };
  },
  overload: () => {
    const avg = (order, load) => averageOver(SEEDS, (s) => serverRun(order, load, 60, s));
    const f = avg("fifo", 1.2), l = avg("lifo", 1.2), f8 = avg("fifo", 0.8), l8 = avg("lifo", 0.8);
    return { verdict: t("At 120%: oldest first finished " + pct(f.onTimeShare) + " in time, newest first " + pct(l.onTimeShare) + ". The oldest request still waiting: " + f.oldest.toFixed(0) + " s vs " + l.oldest.toFixed(0) + " s (starved). At 80% load oldest first wins: " + pct(f8.onTimeShare) + " vs " + pct(l8.onTimeShare) + ", slowest 1% " + f8.p99.toFixed(1) + " s vs " + l8.p99.toFixed(1) + " s.",
        "Al 120%: la más antigua primero terminó a tiempo el " + pct(f.onTimeShare) + "; la más nueva primero, el " + pct(l.onTimeShare) + ". La solicitud más antigua que sigue esperando: " + f.oldest.toFixed(0) + " s contra " + l.oldest.toFixed(0) + " s (sin atender). Con carga del 80% gana la más antigua primero: " + pct(f8.onTimeShare) + " contra " + pct(l8.onTimeShare) + "; el 1% más lento, " + f8.p99.toFixed(1) + " s contra " + l8.p99.toFixed(1) + " s."),
      bars: [[t("In time, oldest first", "A tiempo, más antigua primero"), f.onTimeShare, pct(f.onTimeShare)], [t("In time, newest first", "A tiempo, más nueva primero"), l.onTimeShare, pct(l.onTimeShare), true], [t("Oldest waiting, oldest first", "Espera más larga, más antigua primero"), Math.min(1, f.oldest / 60), f.oldest.toFixed(0) + " s"], [t("Oldest waiting, newest first", "Espera más larga, más nueva primero"), Math.min(1, l.oldest / 60), l.oldest.toFixed(0) + " s", true]] };
  },
};

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
    options: [t("It finishes: the engine turns it into a loop", "Termina: el motor la convierte en un bucle"), t("It stops with a stack overflow", "Se detiene con un desbordamiento de pila"), t("It finishes, using more memory", "Termina, usando más memoria")],
    answer: 1,
    why: t("The call stack is a fixed-size block of memory per thread, so depth is capped: in browsers and Node around ten thousand frames, and Python stops at a recursion limit of 1,000 by default. Every frame is still waiting when the next is pushed, so frame 1,001 doesn't fit and the run stops with a stack overflow. The engine won't turn it into a loop for you: n + sum(n − 1) still has an addition to do after the call returns, so it isn't a tail call, and among JavaScript engines only Safari's does proper tail calls at all (Python and Java never do). The loop keeps one frame and a running total: depth 1 for any n. Iteration, or an explicit stack in an array in heap memory, removes the limit.",
      "La pila de llamadas es un bloque de memoria de tamaño fijo por hilo, así que la profundidad tiene un tope: en navegadores y Node, unos diez mil marcos, y Python se detiene en un límite de recursión de 1,000 por defecto. Cada marco sigue esperando cuando se apila el siguiente, así que el marco 1,001 no cabe y la ejecución se detiene con un desbordamiento de pila (stack overflow). El motor no la convierte en un bucle por ti: a n + sum(n − 1) todavía le falta una suma después de que la llamada retorna, así que no es una llamada de cola (tail call), y entre los motores de JavaScript solo el de Safari hace llamadas de cola propiamente dichas (Python y Java nunca). El bucle usa un solo marco y un total acumulado: profundidad 1 para cualquier n. La iteración, o una pila explícita en un arreglo (array) en la memoria dinámica (heap), elimina el límite."),
    watch: { program: "sum", n: 20 },
  },
  {
    id: "undo",
    title: t("Undo twice, then type", "Deshaz dos veces y luego escribe"),
    change: t("Type A, B, C · undo twice (C and B move to the redo stack) · then type D", "Escribe A, B, C · deshaz dos veces (C y B pasan a la pila de rehacer) · luego escribe D"),
    question: t("What can Redo bring back now?", "¿Qué puede recuperar Rehacer ahora?"),
    options: [t("B, then C", "B, y luego C"), t("Only C", "Solo C"), t("Nothing", "Nada")],
    answer: 2,
    why: t("Typing D emptied the redo stack. Undo pops the top edit and pushes it on the redo stack; redo does the reverse. A new edit starts a different future, so the old redo stack no longer applies and is thrown away. Browsers do the same with back and forward: visiting a new page from the middle of your history drops the forward list.",
      "Escribir D vació la pila de rehacer. Deshacer saca la edición de arriba y la apila en la pila de rehacer; rehacer hace lo contrario. Una edición nueva empieza un futuro distinto, así que la vieja pila de rehacer ya no aplica y se descarta. Los navegadores hacen lo mismo con atrás y adelante: visitar una página nueva desde la mitad de tu historial borra la lista de adelante."),
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
    options: [t("About the same either way: the worker is just as busy", "Más o menos la misma: el trabajador está igual de ocupado"), t("Oldest first: few. Newest first: most", "La más antigua primero: pocas. La más nueva primero: la mayoría"), t("Oldest first: most. Newest first: fewer", "La más antigua primero: la mayoría. La más nueva primero: menos")],
    answer: 1,
    why: t("With more work than capacity, the backlog only grows. Taking the oldest first means every request waits behind the whole backlog, so after a few seconds everything finishes too late: the worker is at 100% doing work nobody is waiting for. Taking the newest first serves fresh requests in time and lets the old ones starve at the bottom. Some servers switch to newest-first only when the queue is long (adaptive LIFO); lesson 47, Load shedding, runs that.",
      "Con más trabajo que capacidad, el atraso solo crece. Tomar primero la más antigua significa que cada solicitud espera detrás de todo el atraso, así que a los pocos segundos todo termina demasiado tarde: el trabajador está al 100% haciendo trabajo que nadie espera. Tomar primero la más nueva atiende a tiempo las solicitudes frescas y deja que las viejas se queden sin atender (inanición, starvation) abajo. Algunos servidores pasan a atender primero la más nueva solo cuando la cola es larga (LIFO adaptativo); la lección 47, Descarte de carga, lo pone a prueba."),
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
    t("Each thread's call stack is a fixed, fairly small block of memory, so only so many frames fit. Fixes: rewrite as a loop, or keep your own stack (an array in heap memory) of work still to do; or reduce depth (divide and conquer, a balanced structure). Raising the limit only moves the cliff.",
      "La pila de llamadas de cada hilo es un bloque de memoria fijo y bastante pequeño, así que solo cabe cierta cantidad de marcos. Soluciones: reescribirla como un bucle, o mantener tu propia pila (un arreglo en la memoria dinámica) con el trabajo pendiente; o reducir la profundidad (divide y vencerás, una estructura balanceada). Subir el límite solo mueve el precipicio.")],
  [t("Explain undo and redo as two stacks. Why does a new edit clear redo?", "Explica deshacer y rehacer como dos pilas. ¿Por qué una edición nueva vacía rehacer?"),
    t("Every edit is pushed on the undo stack. Undo pops it, reverses it, and pushes it on redo; redo does the opposite. A new edit branches history: the redone edits were made on top of a document that no longer exists, so they are discarded.",
      "Cada edición se apila en la pila de deshacer. Deshacer la saca, la revierte y la apila en rehacer; rehacer hace lo contrario. Una edición nueva ramifica el historial: las ediciones de rehacer se hicieron sobre un documento que ya no existe, así que se descartan.")],
  [t("Where is the stack in a browser's back and forward buttons, and in an iterative depth-first search?", "¿Dónde está la pila en los botones de atrás y adelante de un navegador, y en una búsqueda en profundidad iterativa?"),
    t("Back is a stack of pages you came from and forward a stack of pages you went back from; visiting a new page clears forward. Iterative DFS keeps a stack of nodes still to visit: pop one, push its children, repeat.",
      "Atrás es una pila de las páginas de las que viniste, y adelante una pila de las páginas desde las que volviste; visitar una página nueva vacía adelante. El DFS iterativo mantiene una pila de nodos por visitar: saca uno, apila sus hijos, repite.")],
  [t("Under overload, why can serving the newest request first give more successful responses than first come, first served? What does it cost, and how do real systems limit the damage?",
    "Bajo sobrecarga, ¿por qué atender primero la solicitud más nueva puede dar más respuestas exitosas que atender por orden de llegada? ¿Cuánto cuesta, y cómo limitan el daño los sistemas reales?"),
    t("When the backlog grows, the oldest requests have usually already timed out on the client; serving them first is wasted work while fresh ones wait and time out too. Newest-first keeps serving requests someone still wants, at the cost of starving the oldest. Systems use it only when the queue is long (adaptive LIFO), cap the queue, and drop requests whose deadline has passed; lesson 47, Load shedding, runs them together.",
      "Cuando el atraso crece, las solicitudes más antiguas normalmente ya vencieron en el cliente; atenderlas primero es trabajo desperdiciado mientras las nuevas esperan y también vencen. Atender primero la más nueva sigue sirviendo solicitudes que alguien todavía quiere, a costa de dejar sin atender a las más antiguas. Los sistemas lo usan solo cuando la cola es larga (LIFO adaptativo), ponen un tope a la cola y descartan las solicitudes cuyo plazo (deadline) ya pasó; la lección 47, Descarte de carga, los combina.")],
  [t("When do you want a queue instead of a stack?", "¿Cuándo quieres una cola en lugar de una pila?"),
    t("When order and fairness matter: jobs that must all be done, messages processed in the order sent, requests under normal load (first come, first served keeps waits even and predictable), and breadth-first search. A stack fits nested work (calls, undo, parsing brackets) and freshness-first under overload.",
      "Cuando importan el orden y la justicia: trabajos que tienen que hacerse todos, mensajes procesados en el orden en que se enviaron, solicitudes bajo carga normal (el orden de llegada mantiene las esperas parejas y predecibles) y la búsqueda en anchura. Una pila sirve para el trabajo anidado (llamadas, deshacer, analizar paréntesis) y para priorizar lo fresco bajo sobrecarga.")],
];

export default defineLesson({
  title: t("Stack Workbench", "Banco de trabajo: pilas"),
  eyebrow: t("Systems lesson 34 · Stacks", "Lección de sistemas 34 · Pilas"),
  lede: t("A stack hands back the last thing you put on it: last in, first out. It runs every function call you make, it is how undo works, and under overload it can decide which users get an answer. This lesson builds three stacks on one machine: watch them, predict what they do, then explain it back.",
    "Una pila (stack) te devuelve lo último que pusiste en ella: último en entrar, primero en salir (LIFO). Ejecuta cada llamada a función que haces, es como funciona deshacer y, bajo sobrecarga, puede decidir qué usuarios reciben una respuesta. Esta lección arma tres pilas en una sola máquina: míralas, predice qué hacen y después explícalo."),
  machine: {
    intro: t("Three stacks run side by side. On the left a recursive sum pushes one plate per call and pops them as the calls return; switch to a loop, or to a tree walk, or raise n past the shelf. In the middle, edits go on the undo tower and undone edits on the redo tower; press Type, Undo and Redo yourself. On the right, requests arrive faster than the clerk can finish them: compare taking the newest first with the oldest first.",
      "Tres pilas funcionan lado a lado. A la izquierda, una suma recursiva apila un plato por llamada y los saca a medida que las llamadas retornan; cambia a un bucle o a recorrer un árbol, o sube n más allá del estante. En el medio, las ediciones van a la torre de deshacer y las ediciones deshechas a la de rehacer; presiona tú mismo Escribir, Deshacer y Rehacer. A la derecha, las solicitudes llegan más rápido de lo que el empleado puede terminarlas: compara tomar primero la más nueva con tomar primero la más antigua."),
    plate: {
      title: t("Plate stacks", "Pilas de platos"),
      keys: [
        { mark: "lit", label: t("Moving now: a plate being pushed or popped, the top-of-stack cursor, the request in hand", "En movimiento: un plato que se apila o se saca, el cursor del tope de la pila, la solicitud en la mano") },
        { mark: "raised", label: t("A plate (a call, an edit, a request); faded requests have outlived their client's timeout", "Un plato (una llamada, una edición, una solicitud); las solicitudes desvanecidas ya superaron el tiempo límite (timeout) de su cliente") },
        { mark: "flat", label: t("Counter wheels and rulers: depth, waiting, finished in time and too late", "Contadores y reglas: profundidad, en espera, terminadas a tiempo y tarde") },
      ],
      caption: t(
        "Left, the call stack: each call puts a labelled plate on the tower and each return lifts the top one off; the cursor on the ruler marks the top, the shelf is the limit, and the lamp lights when a call doesn't fit. Middle, undo and redo: two towers in front of the document, and a bin for redo plates thrown away when you type. Right, a busy server: requests pile up in the column, newest on top; the clerk's grabber takes from the top (newest first) or the bottom slot (oldest first), and finished requests land in the in-time or too-late tray.",
        "A la izquierda, la pila de llamadas: cada llamada pone un plato con etiqueta en la torre y cada retorno levanta el de arriba; el cursor en la regla marca el tope, el estante es el límite y la lámpara se enciende cuando una llamada no cabe. En el medio, deshacer y rehacer: dos torres delante del documento y una caja de descarte para los platos de rehacer que se tiran cuando escribes. A la derecha, un servidor ocupado: las solicitudes se apilan en la columna, la más nueva arriba; la pinza del empleado toma de arriba (la más nueva primero) o de la ranura de abajo (la más antigua primero), y las solicitudes terminadas caen en la bandeja de a tiempo o en la de tarde.",
      ),
      stage: { "data-stacks": "" },
      label: t("Stack simulation. Space pauses or resumes.", "Simulación de pilas. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["depth", t("Call stack depth", "Profundidad de la pila")], ["deepest", t("Deepest this run", "Máxima de esta ejecución")], ["overflows", t("Overflows", "Desbordamientos")], ["editor", t("Undo · redo", "Deshacer · rehacer"), "–"], ["ontime", t("Finished in time", "Terminadas a tiempo"), "–"], ["late", t("Clients gave up", "Clientes que se rindieron")], ["oldest", t("Oldest waiting", "Espera más larga"), "–"]],
    controls: [
      { seg: "program", label: t("Program", "Programa"), options: [["sum", t("Recursive sum", "Suma recursiva")], ["loop", t("Sum with a loop", "Suma con un bucle")], ["walk", t("Walk a tree", "Recorrer un árbol")]], value: "sum" },
      { seg: "n", label: "n", options: [[5, "5"], [10, "10"], [20, "20"]], value: 10 },
      { actions: [["type", t("Type", "Escribir")], ["undo", t("Undo", "Deshacer")], ["redo", t("Redo", "Rehacer")]], label: "Editor" },
      { seg: "order", label: t("Server takes", "El servidor toma"), options: [["lifo", t("Newest first (stack)", "Más nueva primero (pila)")], ["fifo", t("Oldest first (queue)", "Más antigua primero (cola)")]], value: "lifo" },
      { seg: "load", label: t("Load", "Carga"), options: [[0.8, "80%"], [1.2, "120%"]], value: 1.2 },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Type, Undo and Redo take over the editor from the demo; Start over hands it back. The server's model runs four times slower than real time so you can follow each request.",
      "Escribir, Deshacer y Rehacer toman el control del editor que estaba en demostración; Empezar de nuevo lo devuelve. El modelo del servidor corre cuatro veces más lento que el tiempo real para que puedas seguir cada solicitud."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine; the server experiment is averaged over six seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina; el experimento del servidor se promedia sobre seis ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Newest-first under overload follows Facebook's adaptive LIFO, described in <a href="https://queue.acm.org/detail.cfm?id=2839461" target="_blank" rel="noopener">Fail at Scale</a> (ACM Queue, 2015).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Atender primero lo más nuevo bajo sobrecarga sigue el LIFO adaptativo de Facebook, descrito en <a href="https://queue.acm.org/detail.cfm?id=2839461" target="_blank" rel="noopener">Fail at Scale</a> (ACM Queue, 2015).`),
  css: `
.tile{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.tile[data-lit]{stroke:var(--anatomy-lit);stroke-width:1.1}
.caret{stroke:var(--anatomy-lit);stroke-width:1.4}
[data-stacks] [data-stale]{opacity:.3}
@media (max-width:640px){[data-exp="overflow"] .bar{grid-template-columns:96px 1fr minmax(52px,min-content)}}
`,
  data: {
    P,
    CSG: CS_GEOM,
    URG: UR_GEOM,
    COLG: COL_GEOM,
    COUNTERS,
    FIRST,
  },
});
