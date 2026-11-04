// @ts-nocheck: content ported as-is
// Systems lesson 45 · Big-O in practice.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { int } from "../../lib/format";
import { buildFigure, P, TRACK, DECADES, LANE_LABEL } from "./figure";
import { laneSteps, sortCosts, makeData, includesInLoop, setLookups, lookupPlans, insertionSort, CALL_COST } from "./sim";

// ---------- the model, run at build time ----------
// Steps per lane for each n on the panel (the O(n²) lane at n = 10,000 is 50 million comparisons, so the page
// gets the counts rather than recounting them on every click). Every experiment below is computed the same way.
const NS = [10, 100, 1000, 2000, 10000];
const STEPS = Object.fromEntries(NS.map((n) => [n, laneSteps(n)]));

const DOUBLE = { a: STEPS[1000], b: STEPS[2000] };

const SMALL = { s16: sortCosts(16), s1000: sortCosts(1000), cross: null };
for (let n = 8; n <= 400 && SMALL.cross == null; n += 4) { const c = sortCosts(n); if (c.merge < c.insertion) SMALL.cross = n; }

const orders = (n) => makeData(n, 9).map((x, i) => (i % 2 ? x : x + 1));   // half the orders' customers are on the list
const HIDDEN = Object.fromEntries([1000, 10000].map((n) => [n, { arr: includesInLoop(orders(n), makeData(n, 4)).steps, set: setLookups(orders(n), makeData(n, 4)).steps }]));

const AMORT = { qs: Object.fromEntries([1, 10, 100, 1000].map((q) => [q, lookupPlans(10000, q)])), even: null };
for (let q = 1; q <= 200 && AMORT.even == null; q++) { const r = lookupPlans(10000, q); if (r.sortThen < r.scan) AMORT.even = q; }

const BEST = Object.fromEntries(["sorted", "random", "reversed"].map((s) => { const r = insertionSort(makeData(1000, 5, s)); return [s, r.cmp + r.move]; }));

const RESULTS = { DOUBLE, SMALL, HIDDEN, AMORT, BEST, CALL_COST };

// What each card shows after a run.
const KEYS = ["1", "log", "n", "nlog", "n2"];
const x2 = (v) => "×" + v.toFixed(2);
// Bar values short enough for a phone: 75,074,224 → 75.1M, 20,000 → 20,000.
const M = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : int(v));
const RUNS = {
  double: () => {
    const a = RESULTS.DOUBLE.a, b = RESULTS.DOUBLE.b;
    const parts = KEYS.map((k, i) => LANE_LABEL[i] + " " + int(a[k]) + " → " + int(b[k]));
    return { verdict: t("Steps at n = 1,000 → 2,000: " + parts.join(", ") + ".", "Pasos con n = 1,000 → 2,000: " + parts.join(", ") + "."),
      bars: KEYS.map((k, i) => [LANE_LABEL[i], Math.min(1, b[k] / a[k] / 4), x2(b[k] / a[k]), i === 3]) };
  },
  small: () => {
    const s = RESULTS.SMALL, i16 = s.s16.insertion, m16 = s.s16.merge, i1k = s.s1000.insertion, m1k = s.s1000.merge;
    return { verdict: t("n = 16: insertion sort " + int(i16) + " units, merge sort " + int(m16) + " (" + (m16 / i16).toFixed(1) + "× more). In this model they cross near n = " + s.cross + "; at n = 1,000 merge sort does " + (i1k / m1k).toFixed(0) + "× less work.",
        "n = 16: ordenamiento por inserción " + int(i16) + " unidades, ordenamiento por mezcla " + int(m16) + " (" + (m16 / i16).toFixed(1) + "× más). En este modelo se cruzan cerca de n = " + s.cross + "; con n = 1,000 el de mezcla hace " + (i1k / m1k).toFixed(0) + "× menos trabajo."),
      bars: [[t("n = 16, insertion sort", "n = 16, por inserción"), i16 / Math.max(i16, m16), int(i16), true], [t("n = 16, merge sort", "n = 16, por mezcla"), m16 / Math.max(i16, m16), int(m16)],
        [t("n = 1,000, insertion sort", "n = 1,000, por inserción"), i1k / Math.max(i1k, m1k), int(i1k)], [t("n = 1,000, merge sort", "n = 1,000, por mezcla"), m1k / Math.max(i1k, m1k), int(m1k), true]] };
  },
  hidden: () => {
    const h = RESULTS.HIDDEN, big = h[10000], small = h[1000];
    return { verdict: t("10,000 orders: array " + int(big.arr) + " steps, Set " + int(big.set) + " (" + int(big.arr / big.set) + "× less). With 1,000 orders: " + int(small.arr) + " vs " + int(small.set) + ". Ten times the data made the array version " + Math.round(big.arr / small.arr) + "× slower and the Set version " + Math.round(big.set / small.set) + "×.",
        "10,000 pedidos: arreglo " + int(big.arr) + " pasos, Set " + int(big.set) + " (" + int(big.arr / big.set) + "× menos). Con 1,000 pedidos: " + int(small.arr) + " contra " + int(small.set) + ". Diez veces más datos volvieron la versión con arreglo " + Math.round(big.arr / small.arr) + "× más lenta y la del Set " + Math.round(big.set / small.set) + "×."),
      bars: [[t("10,000 · list.includes()", "10,000 · list.includes()"), 1, M(big.arr)], [t("10,000 · Set", "10,000 · Set"), big.set / big.arr, M(big.set), true], [t("1,000 · list.includes()", "1,000 · list.includes()"), small.arr / big.arr, M(small.arr)], [t("1,000 · Set", "1,000 · Set"), small.set / big.arr, M(small.set), true]] };
  },
  amortise: () => {
    const a = RESULTS.AMORT;
    const row = (q) => { const r = a.qs[q]; const m = Math.max(r.scan, r.sortThen); return [[t(int(q) + (q === 1 ? " lookup, scan" : " lookups, scan"), int(q) + (q === 1 ? " búsqueda, recorrer" : " búsquedas, recorrer")), r.scan / m, int(r.scan)], [t(int(q) + (q === 1 ? " lookup, sort first" : " lookups, sort first"), int(q) + (q === 1 ? " búsqueda, ordenar antes" : " búsquedas, ordenar antes")), r.sortThen / m, int(r.sortThen), true]]; };
    const one = a.qs[1], k = a.qs[1000];
    return { verdict: t("Sorting costs " + int(one.sortCost) + " steps up front. 1 lookup: scanning " + int(one.scan) + " vs " + int(one.sortThen) + ". Sorting first wins from " + a.even + " lookups on; at 1,000 lookups it's " + int(k.scan) + " vs " + int(k.sortThen) + ".",
        "Ordenar cuesta " + int(one.sortCost) + " pasos de entrada. 1 búsqueda: recorrer " + int(one.scan) + " contra " + int(one.sortThen) + ". Ordenar primero gana desde " + a.even + " búsquedas; con 1,000 búsquedas son " + int(k.scan) + " contra " + int(k.sortThen) + "."),
      bars: [...row(1), ...row(100), ...row(1000)] };
  },
  best: () => {
    const b = RESULTS.BEST, m = b.reversed;
    return { verdict: t("Already sorted: " + int(b.sorted) + " steps. Shuffled: " + int(b.random) + ". Reversed: " + int(b.reversed) + ". Same code, same n, a " + int(b.reversed / b.sorted) + "× spread.",
        "Ya ordenados: " + int(b.sorted) + " pasos. Mezclados: " + int(b.random) + ". Invertidos: " + int(b.reversed) + ". El mismo código, el mismo n, una diferencia de " + int(b.reversed / b.sorted) + "×."),
      bars: [[t("Already sorted", "Ya ordenados"), b.sorted / m, int(b.sorted), true], [t("Shuffled", "Mezclados"), b.random / m, int(b.random)], [t("Reversed", "Invertidos"), 1, int(b.reversed)]] };
  },
};

const EXPERIMENTS = [
  {
    id: "double",
    title: t("Double n", "Duplica n"),
    change: t("n goes from 1,000 to 2,000 · same kind of data, same five algorithms", "n pasa de 1,000 a 2,000 · el mismo tipo de datos, los mismos cinco algoritmos"),
    question: t("How much more work does the merge sort lane do?", "¿Cuánto más trabajo hace el carril del ordenamiento por mezcla?"),
    options: [
      t("Exactly twice (2×)", "Exactamente el doble (2×)"),
      t("A bit more than twice (2.2×)", "Un poco más del doble (2.2×)"),
      t("About four times (4×)", "Unas cuatro veces (4×)"),
    ],
    answer: 1,
    why: t("n log n grows slightly faster than n: doubling n doubles the n and adds one to log₂ n (about 10 → 11), so the work grows about 2 × 11/10 = 2.2 times. The other lanes: O(1) stays put, O(log n) adds one step, O(n) doubles, and insertion sort, O(n²), quadruples. Big-O describes how work grows as n grows. Doubling n adds one halving to a binary search, doubles a scan, slightly more than doubles a sort (its log n factor grows too), and quadruples anything that compares about every pair. That growth, not the count at one size, decides whether code survives ten times more data. On the track it's the distance each post moves: on a log scale, doubling is the same short hop for O(n), twice that for O(n²).",
      "n log n crece un poco más rápido que n: duplicar n duplica la n y le suma uno a log₂ n (de unos 10 a 11), así que el trabajo crece unas 2 × 11/10 = 2.2 veces. Los otros carriles: O(1) no cambia, O(log n) suma un paso, O(n) se duplica y el ordenamiento por inserción, O(n²), se cuadruplica. La notación O grande describe cómo crece el trabajo cuando crece n. Duplicar n le agrega una división a la mitad a una búsqueda binaria, duplica un recorrido, poco más que duplica un ordenamiento (su factor log n también crece) y cuadruplica todo lo que compara más o menos cada par. Ese crecimiento, no la cuenta en un solo tamaño, decide si un código aguanta diez veces más datos. En la pista es la distancia que se mueve cada poste: en escala logarítmica, duplicar es el mismo salto corto para O(n) y el doble de largo para O(n²)."),
    watch: { n: 2000, constant: 1 },
  },
  {
    id: "small",
    title: t("Sorting 16 items", "Ordenar 16 elementos"),
    change: t(`Insertion sort, O(n²), vs merge sort, O(n log n), which copies halves and makes a call at every level · each comparison and move costs 1, each merge-sort call ${CALL_COST} more · 8 seeded shuffles`,
      `Ordenamiento por inserción, O(n²), contra ordenamiento por mezcla, O(n log n), que copia mitades y hace una llamada en cada nivel · cada comparación y movimiento cuesta 1, cada llamada del de mezcla ${CALL_COST} más · 8 mezclas con semilla fija`),
    question: t("At n = 16, which one does less work?", "Con n = 16, ¿cuál hace menos trabajo?"),
    options: [
      t("Merge sort: O(n log n) always beats O(n²)", "Por mezcla: O(n log n) siempre le gana a O(n²)"),
      t("Insertion sort, by a clear margin", "Por inserción, con claridad"),
      t("They tie: at small n everything is the same", "Empatan: con n pequeño todo da igual"),
    ],
    answer: 1,
    why: t("Big-O drops constants and small terms, and at small n those are most of the cost. Merge sort only pulls ahead at larger n. Insertion sort's inner loop is one compare and one move; merge sort pays to split, copy and call at every level. Past the crossover the growth rate takes over and merge sort wins by more and more. Real sorts combine both: Python's Timsort sorts short runs (32 to 64 items) with insertion sort before merging them. Where the crossover sits depends on the machine and the language, so libraries measure it rather than derive it.",
      "La notación O grande descarta las constantes y los términos pequeños, y con n pequeño esos son casi todo el costo. El de mezcla solo toma ventaja con n más grande. El bucle interno del ordenamiento por inserción es una comparación y un movimiento; el de mezcla paga por dividir, copiar y llamar en cada nivel. Pasado el punto de cruce, el ritmo de crecimiento manda y el de mezcla gana por cada vez más. Los ordenamientos reales combinan los dos: Timsort, el de Python, ordena tramos cortos (de 32 a 64 elementos) por inserción antes de mezclarlos. Dónde cae el cruce depende de la máquina y del lenguaje, así que las bibliotecas lo miden en vez de deducirlo."),
    watch: { n: 10, constant: 5 },
  },
  {
    id: "hidden",
    title: t("A loop hiding inside .includes()", "Un bucle escondido dentro de .includes()"),
    change: t("For each of 10,000 orders, check whether its customer is on a list of 10,000 · list.includes(id), which scans the array, vs a Set built once", "Para cada uno de 10,000 pedidos, revisa si su cliente está en una lista de 10,000 · list.includes(id), que recorre el arreglo, contra un Set construido una vez"),
    question: t("How much more work does the array version do?", "¿Cuánto más trabajo hace la versión con el arreglo?"),
    options: [
      t("About the same: both are one line of code", "Más o menos lo mismo: las dos son una línea de código"),
      t("About twice as much", "Más o menos el doble"),
      t("Thousands of times more", "Miles de veces más"),
    ],
    answer: 2,
    why: t("It's a nested loop, O(n²). includes, indexOf and find scan the array, so calling one inside a loop over n items is a loop inside a loop: about n × n/2 steps when values are found, n × n when they aren't. A Set costs n to build, then each lookup is about one step (a hash and a compare or two; lesson 40, Hash tables, shows when that breaks). The code looks just as simple; the growth isn't. Other common hidden loops: removing from the front of an array inside a loop, building a string with += in languages where strings are copied, and one database query per row (lesson 27, N+1 queries).",
      "Es un bucle anidado, O(n²). includes, indexOf y find recorren el arreglo, así que llamar a uno dentro de un bucle sobre n elementos es un bucle dentro de otro: unos n × n/2 pasos cuando los valores están, n × n cuando no. Un Set cuesta n al construirse y después cada búsqueda es más o menos un paso (un hash y una o dos comparaciones; la lección 40, Tablas hash, muestra cuándo deja de serlo). El código se ve igual de simple; el crecimiento no. Otros bucles escondidos comunes: quitar del inicio de un arreglo dentro de un bucle, armar un string con += en lenguajes donde los strings se copian, y una consulta a la base de datos por fila (la lección 27, Consultas N+1)."),
    watch: { n: 10000, constant: 1 },
  },
  {
    id: "amortise",
    title: t("Sort once, or scan every time?", "¿Ordenar una vez o recorrer cada vez?"),
    change: t("10,000 unsorted items · q lookups, about half for values that aren't there · plan A: scan for each one · plan B: merge sort once, then binary search each one", "10,000 elementos sin ordenar · q búsquedas, cerca de la mitad de valores que no están · plan A: recorrer para cada una · plan B: ordenar una vez por mezcla y después búsqueda binaria para cada una"),
    question: t("After how many lookups does sorting first pay off?", "¿Después de cuántas búsquedas conviene haber ordenado primero?"),
    options: [
      t("Never: sorting costs far more than any lookup", "Nunca: ordenar cuesta mucho más que cualquier búsqueda"),
      t("After a dozen or two lookups", "Después de una o dos docenas de búsquedas"),
      t("Only after about 10,000 lookups, one per item", "Recién después de unas 10,000 búsquedas, una por elemento"),
    ],
    answer: 1,
    why: t("For one lookup, scanning wins: the sort costs about n log n before you've found anything. But each scan costs up to n while each binary search costs about log n, so the sort pays for itself after roughly (n log n) ÷ n, about log n lookups. That's amortising a cost over later work, and it's why databases keep indexes (sorted structures paid for on every write; lesson 11, Database indexes) and why you build a Set or a Map before a loop, not inside it.",
      "Para una sola búsqueda, recorrer gana: el ordenamiento cuesta unos n log n antes de encontrar nada. Pero cada recorrido cuesta hasta n y cada búsqueda binaria unos log n, así que ordenar se paga solo después de más o menos (n log n) ÷ n, unas log n búsquedas. Eso es amortizar un costo sobre el trabajo que viene, y es por qué las bases de datos mantienen índices (estructuras ordenadas que se pagan en cada escritura; lección 11, Índices de bases de datos) y por qué construyes un Set o un Map antes de un bucle, no dentro de él."),
    watch: { n: 10000, constant: 1 },
  },
  {
    id: "best",
    title: t("Insertion sort on data that's already sorted", "Ordenar por inserción datos ya ordenados"),
    change: t("1,000 items · already sorted, shuffled, then reversed · the same insertion sort · steps are comparisons plus moves", "1,000 elementos · ya ordenados, mezclados y después invertidos · el mismo ordenamiento por inserción · los pasos son comparaciones más movimientos"),
    question: t("How many steps on the already-sorted input?", "¿Cuántos pasos con la entrada ya ordenada?"),
    options: [
      t("About 500,000: it's O(n²) whatever the input", "Unos 500,000: es O(n²) sea cual sea la entrada"),
      t("About 2,000: one compare and one move each", "Unos 2,000: una comparación y un movimiento cada uno"),
      t("About 10,000, like an O(n log n) sort", "Unos 10,000, como un ordenamiento O(n log n)"),
    ],
    answer: 1,
    why: t("Each item is compared once with its neighbour and stays put. Big-O is usually quoted for the worst case, but the cost depends on the input's shape. Insertion sort shifts nothing when items are already in order, so it's linear on sorted or nearly sorted data, quadratic on shuffled data and worst on reversed data. Timsort leans on this by finding runs that are already in order. The flip side: a quicksort that always picks the first item as its pivot is fast on random data and quadratic on sorted data, which real inputs often are.",
      "Cada elemento se compara una vez con su vecino y se queda donde está. La notación O grande se suele dar para el peor caso, pero el costo depende de la forma de la entrada. El ordenamiento por inserción no desplaza nada cuando los elementos ya están en orden, así que es lineal con datos ordenados o casi ordenados, cuadrático con datos mezclados y peor todavía con datos invertidos. Timsort se apoya en esto buscando tramos que ya están en orden. La otra cara: un quicksort que siempre elige el primer elemento como pivote es rápido con datos aleatorios y cuadrático con datos ordenados, que es como suelen llegar los datos reales."),
    watch: { n: 1000, constant: 1 },
  },
];

const QUESTIONS = [
  [t("What does \"this function is O(n)\" promise, and what does it leave out?", "¿Qué promete \"esta función es O(n)\" y qué deja afuera?"),
    t("That its work grows at most in proportion to n once n is large. It leaves out the constant (a step might be a nanosecond or a network call), smaller terms, how it behaves at small n, and which input it describes (usually the worst case).",
      "Que su trabajo crece como mucho en proporción a n cuando n es grande. Deja afuera la constante (un paso puede ser un nanosegundo o una llamada de red), los términos más pequeños, cómo se comporta con n pequeño y qué entrada describe (normalmente el peor caso).")],
  [t("An endpoint takes 200 ms with 1,000 rows. Estimate it at 10,000 rows if its main loop is O(n), O(n log n) or O(n²).", "Un endpoint tarda 200 ms con 1,000 filas. Estima cuánto tarda con 10,000 filas si su bucle principal es O(n), O(n log n) u O(n²)."),
    t("O(n): about 2 s. O(n log n): a little more, about 2.7 s, since log n grows from about 10 to about 13. O(n²): about 20 s, a hundred times longer. This assumes the loop dominates; fixed costs like the connection and serialising the response don't grow with n.",
      "O(n): unos 2 s. O(n log n): un poco más, unos 2.7 s, porque log n crece de unos 10 a unos 13. O(n²): unos 20 s, cien veces más. Esto supone que el bucle domina; los costos fijos, como la conexión y serializar la respuesta, no crecen con n.")],
  [t("Why do real sort functions switch to insertion sort, an O(n²) algorithm, for small pieces?", "¿Por qué las funciones de ordenamiento reales pasan al ordenamiento por inserción, un algoritmo O(n²), para los pedazos pequeños?"),
    t("At small n the constant factors dominate: insertion sort is a tight compare-and-move loop with no allocation or recursion, so it does less real work than an O(n log n) sort until n reaches a few dozen. It's also linear on data that's almost sorted. Libraries pick the threshold by measuring.",
      "Con n pequeño dominan las constantes: el ordenamiento por inserción es un bucle ajustado de comparar y mover, sin reservar memoria ni recursión, así que hace menos trabajo real que un ordenamiento O(n log n) hasta que n llega a unas pocas docenas. También es lineal con datos casi ordenados. Las bibliotecas eligen el umbral midiendo.")],
  [t("Name three ways a quadratic loop hides in ordinary-looking code.", "Nombra tres formas en que un bucle cuadrático se esconde en código que se ve normal."),
    t("includes, indexOf or find inside a loop; removing or inserting at the front of an array (shift, unshift, splice) inside a loop; building a string with += where strings are copied; nested filter or map over two lists; one database query per row (N+1).",
      "includes, indexOf o find dentro de un bucle; quitar o insertar al inicio de un arreglo (shift, unshift, splice) dentro de un bucle; armar un string con += donde los strings se copian; filter o map anidados sobre dos listas; una consulta a la base de datos por fila (N+1).")],
  [t("Why is O(log n) almost as good as O(1) in practice, and when is O(1) not really cheap?", "¿Por qué O(log n) es casi tan bueno como O(1) en la práctica, y cuándo O(1) no es realmente barato?"),
    t("A binary search over a billion items takes about 30 steps, and doubling n adds one. A hash lookup is O(1) on average but each step is a hash plus a compare, collisions or a bad hash can make it slow, a resize copies everything, and a memory read that misses the cache can cost a hundred times more than one that hits (lesson 43, Latency numbers).",
      "Una búsqueda binaria sobre mil millones de elementos toma unos 30 pasos, y duplicar n agrega uno. Una búsqueda en un hash es O(1) en promedio, pero cada paso es un hash más una comparación, las colisiones o un mal hash pueden volverla lenta, un redimensionamiento copia todo, y una lectura de memoria que no está en la caché puede costar cien veces más que una que sí (lección 43, Números de latencia).")],
  [t("When is it worth sorting or building an index before you search?", "¿Cuándo vale la pena ordenar o construir un índice antes de buscar?"),
    t("When you'll search the same data many times. Building costs about n log n (or n for a hash set) once; each later lookup then costs log n (or about 1) instead of n, so the build pays off after roughly log n lookups. For a single lookup, just scan.",
      "Cuando vas a buscar en los mismos datos muchas veces. Construirlo cuesta unos n log n (o n para un hash set) una vez; después cada búsqueda cuesta log n (o más o menos 1) en vez de n, así que la construcción se paga después de unas log n búsquedas. Para una sola búsqueda, simplemente recorre.")],
];

// ---------- page ----------
const FIRST_N = 1000, FIRST_CLOCK = 2000;
const FIRST = { n: FIRST_N, constant: 1, clock: FIRST_CLOCK, cost: "1 ns", steps: ["1", "log", "n", "nlog", "n2"].map((k) => STEPS[FIRST_N][k]) };

export default defineLesson({
  title: t("Big-O Workbench", "Banco de trabajo: Big-O"),
  eyebrow: t("Systems lesson 45 · Big-O", "Lección de sistemas 45 · Complejidad (Big-O)"),
  lede: t("Big-O describes how the work an algorithm does grows as its input grows. It ignores what one step costs and keeps how the number of steps scales: constant, logarithmic, linear, n log n, quadratic. This lesson races five real algorithms on the same data: watch them, predict what changes, then explain it back.",
    "La notación O grande (Big-O) describe cómo crece el trabajo de un algoritmo cuando crece su entrada. Ignora cuánto cuesta un paso y se queda con cómo escala la cantidad de pasos: constante, logarítmica, lineal, n log n, cuadrática. Esta lección pone a competir cinco algoritmos reales sobre los mismos datos: míralos, predice qué cambia y después explícalo."),
  machine: {
    intro: t("Five carriages leave together and move at the same pace, one step per tick of the clock, along a track marked in powers of ten. Each stops at its finish post: the number of steps its algorithm actually took on n items. Change n and watch how far each post moves; pick what one step costs to turn steps into time; give merge sort a bigger constant and watch it lose to insertion sort at small n.",
      "Cinco carros salen juntos y avanzan al mismo ritmo, un paso por tic del reloj, por una pista marcada en potencias de diez. Cada uno se detiene en su poste de llegada: la cantidad de pasos que su algoritmo realmente dio con n elementos. Cambia n y mira cuánto se mueve cada poste; elige cuánto cuesta un paso para convertir pasos en tiempo; dale al ordenamiento por mezcla (merge sort) una constante más grande y mira cómo pierde contra el ordenamiento por inserción (insertion sort) con n pequeño."),
    plate: {
      title: t("Race track", "Pista de carreras"),
      keys: [
        { mark: "lit", label: t("Running: a carriage still counting steps", "En carrera: un carro que sigue contando pasos") },
        { mark: "raised", label: t("Carriages, finish posts and lane signs; each post stands at the steps its algorithm needed", "Carros, postes de llegada y letreros de carril; cada poste está en los pasos que necesitó su algoritmo") },
        { mark: "flat", label: t("The ruler (powers of ten), the console (n and the cost of one step) and the clock", "La regla (potencias de diez), la consola (n y el costo de un paso) y el reloj") },
      ],
      caption: t(
        "Five lanes, five real algorithms run on the same n items, back to front: O(1) reads the item at a known position, O(log n) binary-searches a sorted copy, O(n) scans for a value that isn't there, O(n log n) merge-sorts the items, and O(n²) insertion-sorts the same items; both sorts count comparisons. All carriages move at the same pace, one step per tick, along a track marked in powers of ten; each stops at its finish post. The clock dial sweeps the same nine decades.",
        "Cinco carriles, cinco algoritmos reales sobre los mismos n elementos, de atrás hacia adelante: O(1) lee el elemento en una posición conocida, O(log n) hace una búsqueda binaria en una copia ordenada, O(n) recorre buscando un valor que no está, O(n log n) ordena los elementos por mezcla y O(n²) ordena los mismos elementos por inserción; los dos cuentan comparaciones. Todos los carros avanzan al mismo ritmo, un paso por tic, por una pista marcada en potencias de diez; cada uno se detiene en su poste de llegada. El reloj recorre las mismas nueve décadas.",
      ),
      stage: { "data-bigo": "" },
      label: t("Big-O race simulation. Space pauses or resumes.", "Simulación de la carrera de crecimiento. Espacio pausa o reanuda."),
    },
    svg: buildFigure(FIRST),
    stats: [["clock", t("Clock, steps", "Reloj, pasos"), "2,000"], ["clockTime", t("Clock time", "Tiempo del reloj"), "2 µs"], ["tn", t("Scan, total", "Recorrido, total"), "–"], ["tnlog", t("Merge sort, total", "Por mezcla, total"), "–"], ["tn2", t("Insertion sort, total", "Por inserción, total"), "–"], ["vs", t("Insertion ÷ merge sort", "Inserción ÷ mezcla"), "–"]],
    controls: [
      { seg: "n", label: t("Input size n", "Tamaño de entrada n"), options: NS.map((n) => [n, n.toLocaleString("en")]), value: FIRST_N },
      { seg: "cost", label: t("One step costs", "Un paso cuesta"), options: [["1e-9", t("1 ns (CPU)", "1 ns (CPU)")], ["1e-7", t("100 ns (memory)", "100 ns (memoria)")], ["1e-3", t("1 ms (query)", "1 ms (consulta)")]], value: "1e-9" },
      { seg: "constant", label: t("Constant on merge sort", "Constante del ordenamiento por mezcla"), options: [[1, "×1"], [5, "×5"], [20, "×20"]], value: 1 },
      { speed: true },
      { actions: [["reset", t("Restart the race", "Reiniciar la carrera")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from running the algorithms in the model and counting their steps: comparisons, moves and set operations.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen de ejecutar los algoritmos del modelo y contar sus pasos: comparaciones, movimientos y operaciones de conjunto."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: every count comes from running the algorithms. Timsort's use of insertion sort for short runs is described in CPython's <a href="https://github.com/python/cpython/blob/main/Objects/listsort.txt" target="_blank" rel="noopener">listsort.txt</a>.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección: cada cuenta sale de ejecutar los algoritmos. El uso del ordenamiento por inserción para tramos cortos en Timsort se describe en <a href="https://github.com/python/cpython/blob/main/Objects/listsort.txt" target="_blank" rel="noopener">listsort.txt</a> de CPython.`),
  css: `
[data-bigo] .wb-pennant{stroke-width:.8}
`,
  data: {
    P,
    TRACK,
    DECADES,
    LANE_LABEL,
    STEPS,
    FIRST_CLOCK,
  },
});
