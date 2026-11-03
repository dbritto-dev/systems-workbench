// @ts-nocheck: content ported as-is
// Systems lesson 41 · Heaps and priority queues: a triage room built around a binary heap.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, int, secs1 } from "../../lib/format";
import { buildFigure, P, NODES, CELLS, IN_PAD, OUT_PAD, COUNTERS, SLOTS, FIRST, RAIL } from "./figure";
import { clinicAverage, growth, topK, tieOrder } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const SEEDS = [1, 2, 3, 4, 5, 6];
const avg = (opts, seconds) => clinicAverage(opts, seconds, SEEDS);
const HOT = [0.45 / 1.05, 0.55 / 1.05, 0.05 / 1.05];      // urgent + soon fill the desk; a trickle of routine
const R = {
  order: { fifo: avg({ policy: "fifo", load: 0.9 }, 3000), prio: avg({ policy: "priority", load: 0.9 }, 3000) },
  starve: { prio: avg({ policy: "priority", load: 1.05, mix: HOT }, 600), aging: avg({ policy: "aging", load: 1.05, mix: HOT }, 600) },
  grow: { small: growth(1000), big: growth(1000000) },
  topk: topK(100000, 10),
  ties: { plain: tieOrder(false), seq: tieOrder(true) },
};

// What each card shows after a run.
const RUNS = {
  order: () => {
    const f = R.order.fifo, p = R.order.prio, top = Math.max(f.routine, p.routine);
    return { verdict: t("Arrival order: urgent " + secs1(f.urgent) + ", routine " + secs1(f.routine) + ", all jobs " + secs1(f.all) + ". Priority: urgent " + secs1(p.urgent) + ", routine " + secs1(p.routine) + ", all jobs " + secs1(p.all) + ".",
        "Por llegada: urgentes " + secs1(f.urgent) + ", de rutina " + secs1(f.routine) + ", todos " + secs1(f.all) + ". Por prioridad: urgentes " + secs1(p.urgent) + ", de rutina " + secs1(p.routine) + ", todos " + secs1(p.all) + "."),
      bars: [[t("Urgent, arrival order", "Urgentes, por llegada"), f.urgent / top, secs1(f.urgent)], [t("Urgent, priority", "Urgentes, por prioridad"), p.urgent / top, secs1(p.urgent), true],
        [t("Routine, arrival order", "De rutina, por llegada"), f.routine / top, secs1(f.routine)], [t("Routine, priority", "De rutina, por prioridad"), p.routine / top, secs1(p.routine), true],
        [t("All jobs, arrival order", "Todos, por llegada"), f.all / top, secs1(f.all)], [t("All jobs, priority", "Todos, por prioridad"), p.all / top, secs1(p.all), true]] };
  },
  starve: () => {
    const p = R.starve.prio, a = R.starve.aging;
    return { verdict: t("Strict priority: the oldest routine job waited " + int(p.oldestRoutine) + " s of the 600, and only " + pct(p.routineServed) + " of routine jobs were served. Aging: oldest " + int(a.oldestRoutine) + " s, " + pct(a.routineServed) + " served; urgent jobs' average wait went from " + secs1(p.urgent) + " to " + secs1(a.urgent) + ".",
        "Prioridad estricta: el trabajo de rutina más antiguo esperó " + int(p.oldestRoutine) + " s de los 600, y solo se atendió el " + pct(p.routineServed) + " de los de rutina. Aging: el más antiguo, " + int(a.oldestRoutine) + " s, y se atendió el " + pct(a.routineServed) + "; la espera promedio de los urgentes pasó de " + secs1(p.urgent) + " a " + secs1(a.urgent) + "."),
      bars: [[t("Oldest routine wait, strict", "Rutina más antigua, estricta"), p.oldestRoutine / 600, int(p.oldestRoutine) + " s"], [t("Oldest routine wait, aging", "Rutina más antigua, aging"), a.oldestRoutine / 600, int(a.oldestRoutine) + " s", true],
        [t("Urgent average wait, strict", "Urgentes en promedio, estricta"), p.urgent / 600, secs1(p.urgent)], [t("Urgent average wait, aging", "Urgentes en promedio, aging"), a.urgent / 600, secs1(a.urgent), true]] };
  },
  grow: () => {
    const a = R.grow.small, b = R.grow.big;
    return { verdict: t("Serving the top: " + a.pop.toFixed(1) + " swaps at 1,000 jobs (" + a.levels + " levels), " + b.pop.toFixed(1) + " at 1,000,000 (" + b.levels + " levels). A new job climbed " + a.push.toFixed(1) + " and " + b.push.toFixed(1) + " levels on average. A sorted list shifts " + int(a.shifts) + " and " + int(b.shifts) + " items per insert.",
        "Atender el de arriba: " + a.pop.toFixed(1) + " intercambios con 1,000 trabajos (" + a.levels + " niveles), " + b.pop.toFixed(1) + " con 1,000,000 (" + b.levels + " niveles). Un trabajo nuevo subió " + a.push.toFixed(1) + " y " + b.push.toFixed(1) + " niveles en promedio. Una lista ordenada desplaza " + int(a.shifts) + " y " + int(b.shifts) + " elementos por inserción."),
      bars: [[t("Heap, serve, 1,000", "Heap, atender, 1,000"), a.pop / b.levels, a.pop.toFixed(1)], [t("Heap, serve, 1,000,000", "Heap, atender, 1,000,000"), b.pop / b.levels, b.pop.toFixed(1), true],
        [t("Sorted list, insert, 1,000", "Lista ordenada, insertar, 1,000"), a.shifts / b.shifts, int(a.shifts)], [t("Sorted list, insert, 1,000,000", "Lista ordenada, insertar, 1,000,000"), 1, int(b.shifts), true]] };
  },
  topk: () => {
    const r = R.topk;
    return { verdict: t("A min-heap of " + r.k + " kept the ten best of " + int(r.n) + " scores: the root was replaced " + r.replaced + " times, about " + int(r.comparisons) + " comparisons in all, same top ten as sorting everything (about " + int(r.sortComparisons) + " comparisons, and all " + int(r.n) + " scores in memory).",
        "Un min-heap de " + r.k + " guardó los diez mejores de " + int(r.n) + " puntajes: la raíz se reemplazó " + r.replaced + " veces, unas " + int(r.comparisons) + " comparaciones en total, los mismos diez que ordenando todo (unas " + int(r.sortComparisons) + " comparaciones, y los " + int(r.n) + " puntajes en memoria)."),
      bars: [[t("Comparisons, min-heap of 10", "Comparaciones, min-heap de 10"), r.comparisons / r.sortComparisons, int(r.comparisons), true], [t("Comparisons, sort all", "Comparaciones, ordenar todo"), 1, int(r.sortComparisons)],
        [t("Items kept, min-heap", "Elementos guardados, min-heap"), r.k / r.n, String(r.k), true], [t("Items kept, sort all", "Elementos guardados, ordenar todo"), 1, int(r.n)]] };
  },
  ties: () => {
    const a = R.ties.plain.join(", "), b = R.ties.seq.join(", ");
    return { verdict: t("Priority only: " + a + ". Priority, then arrival number: " + b + ".", "Solo prioridad: " + a + ". Prioridad y después número de llegada: " + b + "."),
      bars: [[t("Priority only", "Solo prioridad"), 1, a], [t("Priority + arrival number", "Prioridad + número de llegada"), 1, b, true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "order",
    title: t("Arrival order or priority?", "¿Orden de llegada o prioridad?"),
    change: t("Load 90% · 20% urgent (1–3), 30% soon (4–6), 50% routine (7–9) · 50 minutes, six seeded runs · the desk takes jobs in arrival order, then by priority",
      "Carga del 90% · 20% urgentes (1–3), 30% pronto (4–6), 50% de rutina (7–9) · 50 minutos, seis ejecuciones con semilla fija · el mostrador toma los trabajos por orden de llegada y después por prioridad"),
    question: t("Switching from arrival order to priority, what happens to the average wait of urgent and of routine jobs?", "Al pasar del orden de llegada a la prioridad, ¿qué pasa con la espera promedio de los trabajos urgentes y de los de rutina?"),
    options: [
      t("Both fall: a heap is faster than a queue", "Las dos bajan: un heap es más rápido que una cola"),
      t("Urgent falls a lot, routine rises, and the average over all jobs barely moves", "La urgente baja mucho, la de rutina sube, y el promedio de todos los trabajos casi no cambia"),
      t("Urgent falls and routine stays the same", "La urgente baja y la de rutina queda igual"),
    ],
    answer: 1,
    why: t("Priority doesn't make the desk faster; it only changes who waits. With one desk doing the same work, the total waiting is about the same, so every second taken off urgent jobs is added to someone else, here the routine ones. That is usually the right trade (a bleeding patient before a check-up), but it is a trade: a priority queue moves waiting around, it doesn't remove it.",
      "La prioridad no hace más rápido el mostrador; solo cambia quién espera. Con un solo mostrador haciendo el mismo trabajo, la espera total es más o menos la misma, así que cada segundo que se le quita a los urgentes se le suma a otro, aquí a los de rutina. Casi siempre es el intercambio correcto (un paciente sangrando antes que un control), pero es un intercambio: una cola de prioridad mueve la espera de lugar, no la elimina."),
    watch: { policy: "priority", load: 0.9, ties: "any" },
  },
  {
    id: "starve",
    title: t("Something more urgent is always there", "Siempre hay algo más urgente"),
    change: t("Urgent and soon jobs alone fill the desk (100% of its capacity), plus a trickle of routine jobs · 10 minutes, six seeded runs · strict priority, then aging (a job gains one level per 15 s it waits)",
      "Los trabajos urgentes y pronto llenan solos el mostrador (100% de su capacidad), más un goteo de trabajos de rutina · 10 minutos, seis ejecuciones con semilla fija · prioridad estricta y después envejecimiento (aging: un trabajo sube un nivel por cada 15 s que espera)"),
    question: t("Under strict priority, what happens to the oldest routine job?", "Con prioridad estricta, ¿qué le pasa al trabajo de rutina más antiguo?"),
    options: [
      t("It waits a little longer than the others, then gets its turn", "Espera un poco más que los demás y después le toca"),
      t("It can wait for most of the run, because there's always something more urgent; aging puts a ceiling on it, at a cost to urgent jobs", "Puede esperar casi toda la ejecución, porque siempre hay algo más urgente; el aging le pone un techo, a costa de los urgentes"),
      t("It's served within a minute, once the urgent ones are done", "Se atiende en menos de un minuto, cuando terminan los urgentes"),
    ],
    answer: 1,
    why: t("A heap always hands out the best key, so a low-priority job is served only in a gap when nothing better is waiting. When higher classes alone keep the desk busy, those gaps are rare and routine jobs starve. Aging folds waiting time into the key (priority + arrival ÷ 15 s), so an old routine job eventually outranks a fresh urgent one. Because every job ages at the same rate, the key is fixed at arrival and the heap never needs reordering. The cost: urgent work now waits behind old routine work.",
      "Un heap siempre entrega la mejor clave, así que un trabajo de baja prioridad solo se atiende en un hueco en el que no espera nada mejor. Cuando las clases altas mantienen ocupado el mostrador por sí solas, esos huecos son raros y los trabajos de rutina se quedan sin atender (inanición, starvation). El aging mete el tiempo de espera en la clave (prioridad + llegada ÷ 15 s), así que un trabajo de rutina viejo termina superando a uno urgente recién llegado. Como todos envejecen al mismo ritmo, la clave queda fija al llegar y el heap nunca necesita reordenarse. El costo: el trabajo urgente ahora espera detrás del de rutina viejo."),
    watch: { policy: "priority", load: 1, ties: "any" },
  },
  {
    id: "grow",
    title: t("A thousand times more jobs", "Mil veces más trabajos"),
    change: t("Serve the top of a heap of 1,000 jobs, then of 1,000,000 · count swaps · compare a list kept sorted, where a new job shifts everything after it",
      "Atiende el trabajo de arriba en un heap de 1,000 trabajos y después en uno de 1,000,000 · cuenta los intercambios · compara con una lista que se mantiene ordenada, donde un trabajo nuevo desplaza todo lo que está después"),
    question: t("The heap is 1,000 times bigger. How much more work does serving the top job take?", "El heap es 1,000 veces más grande. ¿Cuánto trabajo más cuesta atender el trabajo de arriba?"),
    options: [
      t("About 1,000 times more swaps", "Unas 1,000 veces más intercambios"),
      t("About twice as many: one swap per level, and 1,000 times more jobs adds only 10 levels", "Más o menos el doble: un intercambio por nivel, y 1,000 veces más trabajos solo agregan 10 niveles"),
      t("The same: the top is always at index 0", "Lo mismo: el de arriba siempre está en el índice 0"),
    ],
    answer: 1,
    why: t("Finding the top is free (index 0), but removing it means moving the last leaf to the top and swapping it down, one level at a time. A complete tree of n items has about log₂ n levels: 10 for a thousand, 20 for a million. Inserting is usually cheaper still, since a new job rarely climbs far. A sorted list makes serving free but pays at insert, shifting about half the list; that cost grows with n, not log n.",
      "Encontrar el de arriba no cuesta nada (índice 0), pero sacarlo implica mover la última hoja arriba e intercambiarla hacia abajo, un nivel a la vez. Un árbol completo de n elementos tiene unos log₂ n niveles: 10 para mil, 20 para un millón. Insertar suele ser aún más barato, porque un trabajo nuevo rara vez sube mucho. Una lista ordenada hace gratis la atención pero paga al insertar, desplazando cerca de la mitad de la lista; ese costo crece con n, no con log n."),
    watch: { policy: "priority", load: 0.9, ties: "any" },
  },
  {
    id: "topk",
    title: t("The ten best of a stream", "Los diez mejores de un flujo"),
    change: t("100,000 scores go by, one at a time · keep the 10 highest", "Pasan 100,000 puntajes, uno por uno · guarda los 10 más altos"),
    question: t("What do you keep while the stream goes by?", "¿Qué guardas mientras pasa el flujo?"),
    options: [
      t("All 100,000, then sort them", "Los 100,000, y después los ordenas"),
      t("A min-heap of 10: its top is the smallest of the best ten, the bar to beat, and most scores are dropped after one comparison", "Un min-heap de 10: su tope es el más chico de los diez mejores, la vara a superar, y la mayoría de los puntajes se descartan con una comparación"),
      t("A max-heap of 10, with the best score on top", "Un max-heap de 10, con el mejor puntaje arriba"),
    ],
    answer: 1,
    why: t("To decide whether a new score belongs in the top ten you only need the weakest of the ten you have, so keep that one on top: a min-heap. A score that doesn't beat it is dropped with one comparison; one that does replaces it and sifts down log₂ 10 ≈ 3 levels. Replacements get rarer as the bar rises. Memory stays at k items however long the stream is, and the work is about n + (replacements × log k) instead of n log n for a sort. A max-heap would keep the best on top, which tells you nothing about what to throw out.",
      "Para decidir si un puntaje nuevo entra en los diez mejores solo necesitas el más débil de los diez que tienes, así que lo dejas arriba: un min-heap. Un puntaje que no lo supera se descarta con una comparación; uno que sí lo reemplaza y baja log₂ 10 ≈ 3 niveles. Los reemplazos son cada vez más raros a medida que sube la vara. La memoria se queda en k elementos por largo que sea el flujo, y el trabajo es cerca de n + (reemplazos × log k) en lugar de n log n de ordenar. Un max-heap dejaría arriba el mejor, que no te dice qué descartar."),
    watch: { policy: "priority", load: 0.9, ties: "any" },
  },
  {
    id: "ties",
    title: t("Six jobs with the same priority", "Seis trabajos con la misma prioridad"),
    change: t("Jobs A to F, all priority 5, arrive in that order among urgent (1) and routine (8) jobs while the desk keeps serving · the heap compares priority only, then priority and an arrival number",
      "Los trabajos A a F, todos de prioridad 5, llegan en ese orden entre trabajos urgentes (1) y de rutina (8) mientras el mostrador sigue atendiendo · el heap compara solo la prioridad, y después la prioridad y un número de llegada"),
    question: t("Comparing priority only, in what order are A to F served?", "Comparando solo la prioridad, ¿en qué orden se atienden A a F?"),
    options: [
      t("A, B, C, D, E, F: the heap keeps arrival order among equals", "A, B, C, D, E, F: el heap mantiene el orden de llegada entre iguales"),
      t("Some other order: a heap doesn't remember arrival order unless it's part of the key", "En otro orden: un heap no recuerda el orden de llegada si no es parte de la clave"),
      t("F to A: the newest is on top", "De F a A: el más nuevo queda arriba"),
    ],
    answer: 1,
    why: t("Sifting moves items along one branch of the tree, so two equal items end up wherever the swaps leave them: a heap is not stable. If arrival order matters among equals (fairness, reproducible tests, \"first come, first served\" within a class), make it part of the key: compare (priority, sequence number). Python's heapq docs recommend exactly that, with an entry count as the tie-breaker.",
      "Al reacomodar, los elementos se mueven por una rama del árbol, así que dos elementos iguales terminan donde los dejen los intercambios: un heap no es estable. Si el orden de llegada importa entre iguales (justicia, pruebas reproducibles, \"por orden de llegada\" dentro de una clase), hazlo parte de la clave: compara (prioridad, número de secuencia). La documentación de heapq de Python recomienda exactamente eso, con un contador de entradas para desempatar."),
    watch: { policy: "priority", load: 0.9, ties: "any" },
  },
];

const QUESTIONS = [
  [t("A heap is a tree, but it's stored in a plain array. How do you find a node's parent and children, and why are there never gaps?", "Un heap es un árbol, pero se guarda en un arreglo simple. ¿Cómo encuentras el padre y los hijos de un nodo, y por qué nunca hay huecos?"),
    t("Node i has children at 2i+1 and 2i+2 and its parent at ⌊(i−1)/2⌋. The tree is complete: every level is full except the last, which fills from the left, because push always adds at the end of the array and pop always takes the last item to refill the top. No pointers, good memory locality.",
      "El nodo i tiene hijos en 2i+1 y 2i+2 y su padre en ⌊(i−1)/2⌋. El árbol es completo: todos los niveles están llenos menos el último, que se llena desde la izquierda, porque push siempre agrega al final del arreglo y pop siempre usa el último elemento para rellenar el tope. Sin punteros y con buena localidad de memoria.")],
  [t("What do push, pop and peek cost on a heap of n items, and why isn't the heap fully sorted?", "¿Cuánto cuestan push, pop y peek en un heap de n elementos, y por qué el heap no está ordenado del todo?"),
    t("Peek is O(1): the best is at index 0. Push and pop are O(log n): one swap per level at most, and a complete tree has about log₂ n levels. The heap only promises that a parent beats its children; siblings and cousins are in no order. That weaker promise is exactly what makes both operations cheap, and it is all you need to always find the best item.",
      "Peek es O(1): el mejor está en el índice 0. Push y pop son O(log n): como mucho un intercambio por nivel, y un árbol completo tiene unos log₂ n niveles. El heap solo promete que un padre le gana a sus hijos; hermanos y primos no tienen orden. Esa promesa más débil es justo lo que hace baratas las dos operaciones, y es todo lo que necesitas para encontrar siempre el mejor elemento.")],
  [t("Name three places a priority queue runs in real systems, and what the priority is in each.", "Nombra tres lugares donde corre una cola de prioridad en sistemas reales, y cuál es la prioridad en cada uno."),
    t("Timers and schedulers (the next deadline first: setTimeout, cron, OS run queues), shortest paths in Dijkstra (the closest unvisited node), event-driven simulation (the next event time), job queues with priorities (paid before free, interactive before batch), merging k sorted files (the smallest head).",
      "Temporizadores y planificadores (primero el próximo vencimiento: setTimeout, cron, las colas de ejecución del sistema operativo), caminos más cortos en Dijkstra (el nodo sin visitar más cercano), simulación por eventos (la hora del próximo evento), colas de trabajos con prioridades (los pagos antes que los gratis, lo interactivo antes que lo batch), mezclar k archivos ordenados (la cabeza más chica).")],
  [t("Why can a priority queue starve low-priority work, and what are two ways to prevent it?", "¿Por qué una cola de prioridad puede dejar sin atender el trabajo de baja prioridad, y cuáles son dos formas de evitarlo?"),
    t("Strict priority serves a low job only when nothing better waits; if higher classes alone keep the server busy, that never happens. Fixes: aging (fold waiting time into the key), reserved shares or weighted fair queuing (each class gets a minimum slice), separate queues served in rotation, or deadlines (earliest deadline first).",
      "La prioridad estricta atiende un trabajo bajo solo cuando no espera nada mejor; si las clases altas mantienen ocupado el servidor por sí solas, eso nunca pasa. Soluciones: aging (meter el tiempo de espera en la clave), cuotas reservadas o colas justas ponderadas (weighted fair queuing: cada clase recibe una porción mínima), colas separadas atendidas por turnos, o plazos (primero el plazo más cercano, earliest deadline first).")],
  [t("To keep the top k of a long stream, why a min-heap of size k, and what does it cost?", "Para guardar los k mejores de un flujo largo, ¿por qué un min-heap de tamaño k, y cuánto cuesta?"),
    t("The root of a min-heap of the best k is the weakest of them, the one a newcomer has to beat. Most items fail one comparison; a winner replaces the root and sifts down in O(log k). Memory is k, time about O(n log k) in the worst case and close to O(n) in practice, versus storing and sorting all n.",
      "La raíz de un min-heap con los k mejores es el más débil de ellos, el que un recién llegado tiene que superar. La mayoría de los elementos fallan con una comparación; uno que gana reemplaza la raíz y baja en O(log k). La memoria es k, el tiempo cerca de O(n log k) en el peor caso y casi O(n) en la práctica, contra guardar y ordenar los n.")],
  [t("Two jobs have the same priority. Why might the later one be served first, and how do you make ties come out in arrival order?", "Dos trabajos tienen la misma prioridad. ¿Por qué podría atenderse primero el que llegó después, y cómo haces que los empates salgan por orden de llegada?"),
    t("A heap isn't stable: sifting moves items along different branches, so equal keys come out in whatever order the swaps left them. Add an increasing sequence number taken at push and compare (priority, sequence). It also keeps the comparison from ever reaching the payload, which in some languages can't be compared at all.",
      "Un heap no es estable: al reacomodar, los elementos se mueven por ramas distintas, así que las claves iguales salen en el orden en que las dejaron los intercambios. Agrega un número de secuencia creciente al hacer push y compara (prioridad, secuencia). Además evita que la comparación llegue al contenido, que en algunos lenguajes ni siquiera se puede comparar.")],
];

export default defineLesson({
  title: t("Priority Queue Workbench", "Banco de trabajo: colas de prioridad"),
  eyebrow: t("Systems lesson 41 · Heaps", "Lección de sistemas 41 · Montículos (heaps)"),
  lede: t("A priority queue always hands out the most important item next, however things arrived. It is almost always a binary heap: a tree packed into an array, cheap to add to and cheap to take the best from. This lesson builds one into a triage room: watch it sift, predict what it does to waits, then explain it back.",
    "Una cola de prioridad siempre entrega primero el elemento más importante, sin importar cómo llegaron. Casi siempre es un montículo binario (binary heap): un árbol empacado en un arreglo, barato para agregar y barato para sacar el mejor. Esta lección lo arma en una sala de triaje: míralo reacomodarse, predice qué les hace a las esperas y después explícalo."),
  machine: {
    intro: t("Jobs arrive at the intake desk with a priority from 1 (most urgent) to 9, drop onto the next free pedestal and swap upward while they beat their parent. The service desk always takes the top job; the last job then jumps to the top and swaps down. Switch the desk to arrival order or add aging, make ties keep arrival order, change the load, or add an urgent or routine job yourself and count its swaps.",
      "Los trabajos llegan al mostrador de entrada con una prioridad de 1 (la más urgente) a 9, caen en el siguiente pedestal libre y suben intercambiándose mientras le ganen a su padre. El mostrador de atención siempre toma el trabajo de arriba; después el último trabajo salta al tope y baja intercambiándose. Cambia el mostrador a orden de llegada o agrega aging, haz que los empates respeten el orden de llegada, cambia la carga, o agrega tú mismo un trabajo urgente o de rutina y cuenta sus intercambios."),
    plate: {
      title: t("Triage tree", "Árbol de triaje"),
      keys: [
        { mark: "lit", label: t("Moving now: a job arriving, being served, or swapping places with its parent or child", "En movimiento: un trabajo que llega, que se atiende o que cambia de lugar con su padre o su hijo") },
        { mark: "raised", label: t("A job token, printed with its priority: 1 is the most urgent, 9 the least", "Una ficha de trabajo con su prioridad impresa: 1 es la más urgente, 9 la menos") },
        { mark: "flat", label: t("Pedestals, rods and the array rail: where each job sits, in the tree and in memory", "Pedestales, varillas y el riel del arreglo: dónde está cada trabajo, en el árbol y en la memoria") },
      ],
      caption: t(
        "The heap is a tree of pedestals, the top one at the back. A parent never has a bigger number than its children, so the most urgent job is always on top. A new job drops onto the next free pedestal and swaps upward while it beats its parent. When the desk serves the top job, the last job jumps to the top and swaps down with its more urgent child. The rail in front is the same heap as an array: pedestal i is slot i, its children are slots 2i+1 and 2i+2.",
        "El heap es un árbol de pedestales, el de arriba al fondo. Un padre nunca tiene un número mayor que sus hijos, así que el trabajo más urgente siempre está arriba. Un trabajo nuevo cae en el siguiente pedestal libre y sube intercambiándose mientras le gane a su padre. Cuando el mostrador atiende el trabajo de arriba, el último trabajo salta al tope y baja intercambiándose con su hijo más urgente. El riel de adelante es el mismo heap como arreglo: el pedestal i es la casilla i, y sus hijos son las casillas 2i+1 y 2i+2.",
      ),
      stage: { "data-heap": "" },
      label: t("Priority queue simulation. Space pauses or resumes.", "Simulación de una cola de prioridad. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["swaps", t("Swaps, last operation", "Intercambios, última operación")],
      ["avgSwaps", t("Swaps per operation (mean)", "Intercambios por operación (media)"), "–"],
      ["waiting", t("Jobs waiting", "Trabajos en espera")],
      ["urgent", t("Mean wait, urgent 1–3", "Espera media, urgentes 1–3"), "–"],
      ["routine", t("Mean wait, routine 7–9", "Espera media, rutina 7–9"), "–"],
      ["oldest", t("Oldest routine job waiting", "Rutina más antigua en espera"), "–"],
    ],
    controls: [
      { seg: "policy", label: t("The desk takes", "El mostrador toma"), options: [["priority", t("By priority", "Por prioridad")], ["fifo", t("By arrival", "Por llegada")], ["aging", t("Priority + aging", "Prioridad + aging")]], value: "priority" },
      { seg: "ties", label: t("Equal priorities", "Prioridades iguales"), options: [["any", t("Any order", "Cualquier orden")], ["seq", t("By arrival number", "Por número de llegada")]], value: "any" },
      { seg: "load", label: t("Load", "Carga"), options: [[0.7, "70%"], [0.9, "90%"], [1, "100%"]], value: 0.9 },
      { speed: true },
      { actions: [["urgent", t("Urgent (1)", "Urgente (1)")], ["routine", t("Routine (9)", "De rutina (9)")]], label: t("Add a job", "Agrega un trabajo") },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine; the clinic experiments are averaged over six seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina; los experimentos de la clínica se promedian sobre seis ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  data: {
    P, NODES, CELLS, IN_PAD, OUT_PAD, COUNTERS, SLOTS, FIRST,
    RAIL_Y: RAIL.y,
  },
});
