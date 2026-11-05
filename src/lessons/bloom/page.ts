// @ts-nocheck: content in the style of the other lessons
// Systems lesson 68 · Bloom filter: a peg board in front of an archive, which says NO for sure and MAYBE by chance.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, int, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, cardSvg, ringSvg, spindleSvg, P, GEOMETRY } from "./figure";
import { paysRun, hashesRun, memoryRun, overRun, deletesRun, formula, bestK, N, PAYS, HASHES, MEMORY, OVER, DELETES, M_LIVE, REPLACE_EVERY, PRESENT_SHARE, CAP } from "./sim";

// Experiment results, computed at build time from the same filter the machine runs (eight seeded runs each).
const R = { pays: paysRun(), hashes: hashesRun(), memory: memoryRun(), over: overRun(), deletes: deletesRun() };

// A rate as a percentage with as many decimals as it needs: 0.138 → "14%", 0.0082 → "0.82%", 0.000064 → "0.0064%".
const rate = (x) => (x >= 0.1 ? pct(x) : x >= 0.01 ? (100 * x).toFixed(1) + "%" : x >= 0.001 ? (100 * x).toFixed(2) + "%" : (100 * x).toFixed(4).replace(/0+$/, "") + "%");
// "1 in N", N to two significant figures.
const oneIn = (x) => { const n = 1 / x, p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return int(Math.round(n / p) * p); };
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const byK = (k) => R.hashes.find((r) => r.k === k);
const byBpk = (b) => R.memory.find((r) => r.bpk === b);
const byN = (n) => R.over.find((r) => r.n === n);
const M10 = 10 * N;

// What each card shows after a run.
const RUNS = {
  pays: () => {
    const { fp, rate: r, fn, up } = R.pays;
    return {
      verdict: t("Of " + int(PAYS.looks) + " lookups for new keys, " + n0(fp) + " (" + rate(r) + ") still went to the archive; the board turned the rest away. " + pct(up) + " of the pegs were up. All " + int(N) + " stored keys got MAYBE: " + n0(fn) + " false negatives.",
        "De " + int(PAYS.looks) + " búsquedas de claves nuevas, " + n0(fp) + " (" + rate(r) + ") igual fueron al archivo; el tablero rechazó el resto. El " + pct(up) + " de las clavijas estaba arriba. Las " + int(N) + " claves guardadas recibieron QUIZÁS: " + n0(fn) + " falsos negativos."),
      bars: [[t("New keys sent to the archive", "Claves nuevas enviadas al archivo"), r, rate(r), true], [t("Pegs up", "Clavijas arriba"), up, pct(up)], [t("Stored keys answered NO", "Claves guardadas con NO"), fn / N, n0(fn)]],
    };
  },
  hashes: () => {
    const rows = R.hashes, m = top(...rows.map((r) => r.rate));
    return {
      verdict: t("10 pegs per key: " + rows.map((r) => r.k + (r.k === 1 ? " hash, " : " hashes, ") + rate(r.rate)).join("; ") + " of new keys got MAYBE. Pegs up: " + pct(byK(7).up) + " with 7 hashes, " + pct(byK(20).up) + " with 20.",
        "10 clavijas por clave: " + rows.map((r) => r.k + (r.k === 1 ? " hash, " : " hashes, ") + rate(r.rate)).join("; ") + " de las claves nuevas recibieron QUIZÁS. Clavijas arriba: " + pct(byK(7).up) + " con 7 hashes, " + pct(byK(20).up) + " con 20."),
      groups: [
        { title: t("False positives", "Falsos positivos"), bars: rows.map((r) => [t(r.k + (r.k === 1 ? " hash" : " hashes"), r.k + (r.k === 1 ? " hash" : " hashes")), r.rate / m, rate(r.rate), r.k === 20]) },
        { title: t("Pegs up", "Clavijas arriba"), bars: [[t("7 hashes", "7 hashes"), byK(7).up, pct(byK(7).up)], [t("20 hashes", "20 hashes"), byK(20).up, pct(byK(20).up), true]] },
      ],
    };
  },
  memory: () => {
    const rows = R.memory, m = top(...rows.map((r) => r.rate));
    return {
      verdict: t(rows.map((r) => r.bpk + " pegs per key (" + r.k + " hashes): " + rate(r.rate) + ", 1 in " + oneIn(r.rate)).join("; ") + ". From 10 to 20 pegs per key, " + n0(byBpk(10).rate / byBpk(20).rate) + " times fewer false positives.",
        rows.map((r) => r.bpk + " clavijas por clave (" + r.k + " hashes): " + rate(r.rate) + ", 1 de cada " + oneIn(r.rate)).join("; ") + ". De 10 a 20 clavijas por clave, " + n0(byBpk(10).rate / byBpk(20).rate) + " veces menos falsos positivos."),
      bars: rows.map((r) => [t(r.bpk + " pegs per key", r.bpk + " clavijas por clave"), r.rate / m, rate(r.rate), r.bpk === 20]),
    };
  },
  over: () => {
    const rows = R.over, m = top(...rows.map((r) => r.rate)), a = byN(1000), b = byN(2000);
    return {
      verdict: t(rows.map((r) => int(r.n) + " keys: " + rate(r.rate)).join("; ") + " of new keys got MAYBE. Pegs up: " + pct(a.up) + " at 1,000 keys, " + pct(b.up) + " at 2,000; the rate went up " + n0(b.rate / a.rate) + " times for twice the keys.",
        rows.map((r) => int(r.n) + " claves: " + rate(r.rate)).join("; ") + " de las claves nuevas recibieron QUIZÁS. Clavijas arriba: " + pct(a.up) + " con 1,000 claves, " + pct(b.up) + " con 2,000; la tasa subió " + n0(b.rate / a.rate) + " veces con el doble de claves."),
      groups: [
        { title: t("False positives", "Falsos positivos"), bars: rows.map((r) => [t(int(r.n) + " keys", int(r.n) + " claves"), r.rate / m, rate(r.rate), r.n === 2000]) },
        { title: t("Pegs up", "Clavijas arriba"), bars: rows.map((r) => [t(int(r.n) + " keys", int(r.n) + " claves"), r.up, pct(r.up), r.n === 2000]) },
      ],
    };
  },
  deletes: () => {
    const { clear, count } = R.deletes, mr = top(clear.rate, count.rate);
    return {
      verdict: t("Pulling pegs down: " + n0(clear.fn) + " of the " + int(N) + " stored keys (" + pct(clear.fnShare) + ") got NO, and false positives fell to " + rate(clear.rate) + " as the board emptied (" + pct(clear.up) + " of pegs up). Counting filter: " + n0(count.fn) + " false negatives, " + rate(count.rate) + " false positives.",
        "Bajando clavijas: " + n0(clear.fn) + " de las " + int(N) + " claves guardadas (" + pct(clear.fnShare) + ") recibieron NO, y los falsos positivos bajaron a " + rate(clear.rate) + " porque el tablero se vació (" + pct(clear.up) + " de clavijas arriba). Filtro con contadores: " + n0(count.fn) + " falsos negativos, " + rate(count.rate) + " de falsos positivos."),
      groups: [
        { title: t("Stored keys answered NO", "Claves guardadas con NO"), bars: [[t("Pull pegs down", "Bajar clavijas"), clear.fnShare, pct(clear.fnShare), true], [t("Counting filter", "Filtro con contadores"), count.fnShare, pct(count.fnShare)]] },
        { title: t("False positives", "Falsos positivos"), bars: [[t("Pull pegs down", "Bajar clavijas"), clear.rate / mr, rate(clear.rate)], [t("Counting filter", "Filtro con contadores"), count.rate / mr, rate(count.rate)]] },
      ],
    };
  },
};

const { pays: A, deletes: D } = R;
const F7 = rate(formula(7, N, M10)), F20 = rate(formula(20, N, M10));
const BEST10 = bestK(M10, N).toFixed(1);
const OVER_X = n0(byN(2000).rate / byN(1000).rate);

const EXPERIMENTS = [
  {
    id: "pays",
    title: t("Lookups for keys that aren't there", "Búsquedas de claves que no están"),
    change: t(int(N) + " keys in the archive · 10 pegs per key (" + int(M10) + " pegs), 7 hashes · " + int(PAYS.looks) + " lookups for keys that were never added, and one for each stored key",
      int(N) + " claves en el archivo · 10 clavijas por clave (" + int(M10) + " clavijas), 7 hashes · " + int(PAYS.looks) + " búsquedas de claves que nunca se agregaron, y una por cada clave guardada"),
    question: t("How many of the " + int(PAYS.looks) + " lookups for new keys still make the trip to the archive?", "¿Cuántas de las " + int(PAYS.looks) + " búsquedas de claves nuevas igual hacen el viaje al archivo?"),
    options: [
      t("None: it says maybe only to keys it was given", "Ninguna: solo dice quizás a las claves que recibió"),
      t("About 1 in 100: their pegs happen to be up", "Más o menos 1 de cada 100: sus clavijas justo están arriba"),
      t("About half, since half the pegs are up", "Cerca de la mitad, porque la mitad de las clavijas está arriba"),
    ],
    answer: 1,
    why: t(
      "A new key gets MAYBE only if all 7 of its pegs happen to be up. About half the pegs are up (" + pct(A.up) + "), so that's a coin toss won seven times in a row: 0.5⁷, about 1 in 128. The model measured " + rate(A.rate) + "; the textbook estimate, (1 − e^(−kn/m))^k, gives " + F7 + ". The other way round there's no luck involved: every stored key raised its own pegs and nothing lowers them, so all " + int(N) + " stored keys got MAYBE (" + n0(A.fn) + " false negatives). That's the whole contract: NO is certain, MAYBE means go and check. It pays wherever the check is slow and most answers are no: an LSM tree keeps a filter per file so a point read skips files that can't hold the key (lesson 67, LSM Tree vs B-Tree), and a cache can stop lookups for ids that don't exist from reaching the database.",
      "Una clave nueva recibe QUIZÁS solo si sus 7 clavijas justo están arriba. Cerca de la mitad de las clavijas está arriba (" + pct(A.up) + "), así que es como ganar a cara o cruz siete veces seguidas: 0.5⁷, cerca de 1 de cada 128. El modelo midió " + rate(A.rate) + "; la estimación de manual, (1 − e^(−kn/m))^k, da " + F7 + ". Al revés no hay suerte de por medio: cada clave guardada levantó sus propias clavijas y nada las baja, así que las " + int(N) + " claves guardadas recibieron QUIZÁS (" + n0(A.fn) + " falsos negativos). Ese es todo el contrato: el NO es seguro, el QUIZÁS significa ir a comprobar. Rinde donde comprobar es lento y la mayoría de las respuestas son no: un árbol LSM guarda un filtro por archivo para que una lectura puntual se salte los archivos que no pueden tener la clave (lección 67, Árbol LSM vs árbol B), y una caché puede evitar que las búsquedas de ids que no existen lleguen a la base de datos.",
    ),
    watch: { bpk: 10, k: 7, keys: "planned", deletes: "none", speed: 3 },
  },
  {
    id: "hashes",
    title: t("More hashes", "Más hashes"),
    change: t(int(N) + " keys, 10 pegs per key · 7 hashes → 20 (and 1 and 3 for comparison) · " + int(HASHES.looks) + " lookups for new keys",
      int(N) + " claves, 10 clavijas por clave · 7 hashes → 20 (y 1 y 3 para comparar) · " + int(HASHES.looks) + " búsquedas de claves nuevas"),
    question: t("With 20 hashes instead of 7, what happens to the false-positive rate?", "Con 20 hashes en lugar de 7, ¿qué pasa con la tasa de falsos positivos?"),
    options: [
      t("It falls: a new key must match 20 pegs, not 7", "Baja: una clave nueva debe coincidir en 20 clavijas, no en 7"),
      t("It rises: each key raises more of the board", "Sube: cada clave levanta más del tablero"),
      t("Little change: past a few hashes it levels off", "Cambia poco: pasados unos pocos hashes se estabiliza"),
    ],
    answer: 1,
    why: t(
      "Each hash is one more peg a new key has to find up, which helps, but each stored key also raises one more peg, which hurts. With 7 hashes " + pct(byK(7).up) + " of the pegs are up and " + rate(byK(7).rate) + " of new keys got MAYBE; with 20, " + pct(byK(20).up) + " are up and " + rate(byK(20).rate) + " got MAYBE (the estimate says " + F20 + "). With a single hash, one peg decides: " + rate(byK(1).rate) + ". The best number is about (m/n)·ln 2, " + BEST10 + " for 10 pegs per key, where about half the pegs end up raised. The rate is flat near it, so 6 or 8 costs little, but far from it in either direction it climbs. Every hash is also one more memory access on each add and lookup.",
      "Cada hash es una clavija más que una clave nueva tiene que encontrar arriba, lo que ayuda, pero cada clave guardada también levanta una clavija más, lo que perjudica. Con 7 hashes el " + pct(byK(7).up) + " de las clavijas está arriba y el " + rate(byK(7).rate) + " de las claves nuevas recibió QUIZÁS; con 20, el " + pct(byK(20).up) + " está arriba y el " + rate(byK(20).rate) + " recibió QUIZÁS (la estimación dice " + F20 + "). Con un solo hash decide una clavija: " + rate(byK(1).rate) + ". El mejor número es cerca de (m/n)·ln 2, " + BEST10 + " para 10 clavijas por clave, donde cerca de la mitad de las clavijas termina arriba. Cerca de ese punto la tasa es plana, así que 6 u 8 cuestan poco, pero lejos de él, en cualquier dirección, sube. Cada hash es además un acceso a memoria más en cada inserción y cada búsqueda.",
    ),
    watch: { bpk: 10, k: 20, keys: "planned", deletes: "none", speed: 3 },
  },
  {
    id: "memory",
    title: t("Twice the memory", "El doble de memoria"),
    change: t(int(N) + " keys · 5, 10 and 20 pegs per key, each with its best number of hashes (" + MEMORY.sizes.map(([, k]) => k).join(", ") + ") · " + int(MEMORY.looks) + " lookups for new keys",
      int(N) + " claves · 5, 10 y 20 clavijas por clave, cada una con su mejor número de hashes (" + MEMORY.sizes.map(([, k]) => k).join(", ") + ") · " + int(MEMORY.looks) + " búsquedas de claves nuevas"),
    question: t("Going from 10 to 20 pegs per key, how do false positives change?", "Al pasar de 10 a 20 clavijas por clave, ¿cómo cambian los falsos positivos?"),
    options: [
      t("Half as many: twice the pegs per key", "La mitad: el doble de clavijas por clave"),
      t("About ten times fewer", "Unas diez veces menos"),
      t("About a hundred times fewer", "Unas cien veces menos"),
    ],
    answer: 2,
    why: t(
      "At the best number of hashes the rate is about 0.62 raised to the pegs per key, so memory buys accuracy exponentially: every 4.8 or so pegs per key cut false positives tenfold. 5 pegs per key let 1 new key in " + oneIn(byBpk(5).rate) + " through, 10 let 1 in " + oneIn(byBpk(10).rate) + ", and 20 let 1 in " + oneIn(byBpk(20).rate) + ". That's where the rule of thumb comes from: about 10 bits per key for 1%, about 5 more for each further factor of ten. None of it depends on the keys: a 100-byte URL and an 8-byte id each cost the same 10 bits, which is why a filter is so much smaller than the set it describes, and why it can't give the keys back.",
      "Con el mejor número de hashes, la tasa es cerca de 0.62 elevado a las clavijas por clave, así que la memoria compra precisión de forma exponencial: cada 4.8 clavijas por clave, más o menos, los falsos positivos bajan diez veces. Con 5 clavijas por clave pasa 1 clave nueva de cada " + oneIn(byBpk(5).rate) + ", con 10 pasa 1 de cada " + oneIn(byBpk(10).rate) + " y con 20, 1 de cada " + oneIn(byBpk(20).rate) + ". De ahí sale la regla práctica: unos 10 bits por clave para un 1%, y unos 5 más por cada factor de diez adicional. Nada de esto depende de las claves: una URL de 100 bytes y un id de 8 bytes cuestan los mismos 10 bits, por eso un filtro es mucho más pequeño que el conjunto que describe, y por eso no puede devolver las claves.",
    ),
    watch: { bpk: 20, k: 14, keys: "planned", deletes: "none", speed: 3 },
  },
  {
    id: "over",
    title: t("Past the plan", "Más claves de las planeadas"),
    change: t("A board sized for " + int(N) + " keys (" + int(M10) + " pegs, 7 hashes) · 1,000 → 2,000 keys added (and 1,500) · " + int(OVER.looks) + " lookups for new keys",
      "Un tablero pensado para " + int(N) + " claves (" + int(M10) + " clavijas, 7 hashes) · 1,000 → 2,000 claves agregadas (y 1,500) · " + int(OVER.looks) + " búsquedas de claves nuevas"),
    question: t("With twice the keys the board was sized for, what happens to the false-positive rate?", "Con el doble de las claves para las que se pensó el tablero, ¿qué pasa con la tasa de falsos positivos?"),
    options: [
      t("It about doubles, with twice the keys", "Más o menos se duplica, con el doble de claves"),
      t("It grows far more than twice", "Crece mucho más que el doble"),
      t("Stays near 1%: the keys still spread out", "Sigue cerca del 1%: las claves igual se reparten"),
    ],
    answer: 1,
    why: t(
      "Nothing stops the extra keys: the filter takes them without a word and the board fills. At 1,000 keys " + pct(byN(1000).up) + " of the pegs are up and " + rate(byN(1000).rate) + " of new keys got MAYBE; at 1,500, " + rate(byN(1500).rate) + "; at 2,000, " + pct(byN(2000).up) + " are up and " + rate(byN(2000).rate) + " got MAYBE, " + OVER_X + " times the planned rate, because a new key now finds each of its 7 pegs up about three times in four, seven times in a row. A filter has to be sized for the most keys it will ever hold: count first and then build it (RocksDB builds one per file when it writes the file), rebuild it bigger when the set grows, or use a scalable Bloom filter, which adds a new, larger filter each time the current one fills.",
      "Nada frena las claves de más: el filtro las acepta sin decir nada y el tablero se llena. Con 1,000 claves el " + pct(byN(1000).up) + " de las clavijas está arriba y el " + rate(byN(1000).rate) + " de las claves nuevas recibió QUIZÁS; con 1,500, el " + rate(byN(1500).rate) + "; con 2,000, el " + pct(byN(2000).up) + " está arriba y el " + rate(byN(2000).rate) + " recibió QUIZÁS, " + OVER_X + " veces la tasa planeada, porque una clave nueva ahora encuentra arriba cada una de sus 7 clavijas unas tres veces de cada cuatro, siete veces seguidas. Un filtro hay que dimensionarlo para la mayor cantidad de claves que vaya a tener: contar primero y después construirlo (RocksDB construye uno por archivo cuando escribe el archivo), reconstruirlo más grande cuando el conjunto crece, o usar un filtro de Bloom escalable (scalable Bloom filter), que agrega un filtro nuevo y más grande cada vez que el actual se llena.",
    ),
    watch: { bpk: 10, k: 7, keys: "double", deletes: "none", speed: 3 },
  },
  {
    id: "deletes",
    title: t("Deleting a key", "Borrar una clave"),
    change: t(int(N) + " keys, 10 pegs per key, 7 hashes · " + DELETES.replace + " of them replaced one at a time: delete a stored key, add a new one · delete by pulling the key's pegs down vs a counting filter, which takes one ring off each",
      int(N) + " claves, 10 clavijas por clave, 7 hashes · se reemplazan " + DELETES.replace + ", una a la vez: borrar una clave guardada, agregar una nueva · borrar bajando las clavijas de la clave vs un filtro con contadores, que le quita un anillo a cada una"),
    question: t("Pulling pegs down, how many of the " + int(N) + " keys still in the archive does the board then answer NO for?", "Bajando clavijas, ¿a cuántas de las " + int(N) + " claves que siguen en el archivo les responde NO el tablero después?"),
    options: [
      t("None: only the deleted keys' pegs came down", "Ninguna: solo bajaron las clavijas de las claves borradas"),
      t("Most of them: shared pegs came down too", "La mayoría: también bajaron clavijas compartidas"),
      t("A handful that happened to share a peg", "Unas pocas que justo compartían una clavija"),
    ],
    answer: 1,
    why: t(
      "A peg doesn't remember who raised it. With half the board up, each of a deleted key's 7 pegs is very likely shared with some other stored key, and pulling it down breaks every key that needed it. After " + DELETES.replace + " deletes, " + n0(D.clear.fn) + " of the " + int(N) + " stored keys (" + pct(D.clear.fnShare) + ") got NO: false negatives, the one mistake a Bloom filter promises never to make, and a read guided by it would now skip keys that are there. False positives fell to " + rate(D.clear.rate) + " only because the board emptied. A counting Bloom filter keeps a small counter per position (here 4 bits, up to " + CAP + ") instead of one bit and takes one off per delete, so a position goes down only when no stored key needs it: " + n0(D.count.fn) + " false negatives and " + rate(D.count.rate) + " false positives, at four times the memory. The other ways out: never delete and rebuild from the stored keys now and then, or use a cuckoo filter, which supports deletes in about the same space as a Bloom filter.",
      "Una clavija no recuerda quién la levantó. Con la mitad del tablero arriba, cada una de las 7 clavijas de una clave borrada muy probablemente la comparte otra clave guardada, y bajarla rompe a todas las claves que la necesitaban. Después de " + DELETES.replace + " borrados, " + n0(D.clear.fn) + " de las " + int(N) + " claves guardadas (" + pct(D.clear.fnShare) + ") recibieron NO: falsos negativos, el único error que un filtro de Bloom promete no cometer nunca, y una lectura guiada por él ahora se saltaría claves que sí están. Los falsos positivos bajaron a " + rate(D.clear.rate) + " solo porque el tablero se vació. Un filtro de Bloom con contadores (counting Bloom filter) guarda un contador pequeño por posición (aquí de 4 bits, hasta " + CAP + ") en lugar de un bit y le resta uno en cada borrado, así que una posición baja solo cuando ninguna clave guardada la necesita: " + n0(D.count.fn) + " falsos negativos y " + rate(D.count.rate) + " de falsos positivos, con cuatro veces la memoria. Las otras salidas: no borrar nunca y reconstruirlo de vez en cuando a partir de las claves guardadas, o usar un filtro cuckoo (cuckoo filter), que admite borrados en más o menos el mismo espacio que un filtro de Bloom.",
    ),
    watch: { bpk: 10, k: 7, keys: "planned", deletes: "clear", speed: 3 },
  },
];

const QUESTIONS = [
  [t("What does a Bloom filter promise, and what can it get wrong?", "¿Qué promete un filtro de Bloom y en qué se puede equivocar?"),
    t("It answers \"is this key in the set?\" with NO or MAYBE. NO is always right: a stored key raised all of its positions, and in a plain filter nothing ever lowers them, so there are no false negatives. MAYBE can be wrong: a key that was never added finds all of its positions set by other keys, a false positive, at a rate you choose when you size it. So it's for skipping work, never for deciding on its own that something exists.",
      "Responde \"¿está esta clave en el conjunto?\" con NO o QUIZÁS. El NO siempre es correcto: una clave guardada levantó todas sus posiciones y, en un filtro común, nada las baja, así que no hay falsos negativos. El QUIZÁS puede estar mal: una clave que nunca se agregó encuentra todas sus posiciones puestas por otras claves, un falso positivo, con una tasa que eliges al dimensionarlo. Por eso sirve para ahorrarse trabajo, nunca para decidir por sí solo que algo existe.")],
  [t("You expect 50 million keys and can live with 1% false positives. How big is the filter, and how many hashes does it use?", "Esperas 50 millones de claves y puedes tolerar un 1% de falsos positivos. ¿Qué tamaño tiene el filtro y cuántos hashes usa?"),
    t("Bits per key ≈ 1.44 × log₂(1/p), about 9.6 for p = 1%, so m ≈ 480 million bits, about 60 MB; hashes k ≈ (m/n)·ln 2 ≈ 7. It doesn't depend on how long the keys are. Each further factor of ten costs about 4.8 bits per key more (0.1% needs about 14.4). And it holds only for 50 million: put in twice as many and the rate climbs well past 1%, so size it for the peak.",
      "Bits por clave ≈ 1.44 × log₂(1/p), unos 9.6 para p = 1%, así que m ≈ 480 millones de bits, unos 60 MB; hashes k ≈ (m/n)·ln 2 ≈ 7. No depende de cuán largas sean las claves. Cada factor de diez adicional cuesta unos 4.8 bits por clave más (0.1% necesita unos 14.4). Y vale solo para 50 millones: mete el doble y la tasa sube mucho más allá del 1%, así que dimensiónalo para el máximo.")],
  [t("Why don't more hash functions keep lowering the false-positive rate?", "¿Por qué más funciones hash no siguen bajando la tasa de falsos positivos?"),
    t("Two effects pull against each other. More hashes means a new key must find more positions set, but every stored key also sets more of them, so the filter fills. The rate is lowest near k = (m/n)·ln 2, where about half the bits are set; beyond that the fuller filter wins, and each hash also costs time on every add and lookup. In practice the k positions are usually derived from one or two hash values (double hashing) rather than k separate functions.",
      "Dos efectos tiran en sentidos opuestos. Más hashes significa que una clave nueva debe encontrar más posiciones puestas, pero cada clave guardada también pone más, así que el filtro se llena. La tasa es mínima cerca de k = (m/n)·ln 2, donde cerca de la mitad de los bits está en 1; más allá gana el filtro más lleno, y cada hash además cuesta tiempo en cada inserción y búsqueda. En la práctica las k posiciones se suelen sacar de uno o dos valores hash (hashing doble, double hashing) en lugar de k funciones separadas.")],
  [t("Where does a Bloom filter pay off, and where doesn't it help?", "¿Dónde rinde un filtro de Bloom y dónde no ayuda?"),
    t("Where a check is slow and most answers are no: point reads in LSM-tree stores (RocksDB, LevelDB, Cassandra keep a filter per sorted file and skip files that can't hold the key), a cache that must not send lookups for nonexistent ids to the database, a distributed join that ships a filter of one side's keys so rows that can't match are dropped before they travel. It doesn't help when most lookups hit (every MAYBE still pays for the check), for range scans (it only answers exact keys), or when you need the keys back.",
      "Donde comprobar es lento y la mayoría de las respuestas son no: lecturas puntuales en almacenes con árboles LSM (RocksDB, LevelDB y Cassandra guardan un filtro por archivo ordenado y se saltan los que no pueden tener la clave), una caché que no debe mandar a la base de datos búsquedas de ids que no existen, un join distribuido que envía un filtro con las claves de un lado para descartar las filas que no pueden coincidir antes de que viajen. No ayuda cuando la mayoría de las búsquedas aciertan (cada QUIZÁS igual paga la comprobación), en recorridos por rango (solo responde claves exactas) ni cuando necesitas recuperar las claves.")],
  [t("Why can't you delete from a plain Bloom filter, and what can you do instead?", "¿Por qué no puedes borrar de un filtro de Bloom común y qué puedes hacer en su lugar?"),
    t("A bit is shared by every key that hashes to it and doesn't record who set it, so clearing a deleted key's bits also clears bits other keys need, and those keys start getting NO: false negatives. Options: a counting Bloom filter (a small counter per position, decremented on delete, at several times the memory), rebuilding the filter from the live keys from time to time, or a cuckoo filter, which stores short fingerprints and supports deletes. Counting and cuckoo filters still go wrong if you delete a key that was never added.",
      "Un bit lo comparten todas las claves que caen en él y no registra quién lo puso, así que poner en 0 los bits de una clave borrada también apaga bits que otras claves necesitan, y esas claves empiezan a recibir NO: falsos negativos. Opciones: un filtro de Bloom con contadores (un contador pequeño por posición, que baja al borrar, con varias veces la memoria), reconstruir el filtro con las claves vigentes de vez en cuando, o un filtro cuckoo, que guarda huellas cortas (fingerprints) y admite borrados. Los filtros con contadores y los cuckoo igual se corrompen si borras una clave que nunca se agregó.")],
  [t("In production your filter lets through ten times the false positives you planned for. What do you check?", "En producción, tu filtro deja pasar diez veces los falsos positivos que planeaste. ¿Qué revisas?"),
    t("First the key count: more keys than it was sized for is the usual cause, and the share of bits set tells you (about half at the planned load, much more when overfilled). Then the parameters actually in use (bits per key, number of hashes) and the hashing: positions derived badly, or a hash that maps similar keys to the same positions, raise the rate above the formula. Measure it directly with keys you know are absent. The fix is usually to rebuild it bigger, or split it so each filter covers a bounded set.",
      "Primero la cantidad de claves: más claves de las previstas es la causa habitual, y la parte de bits en 1 lo delata (cerca de la mitad con la carga planeada, mucho más si está sobrecargado). Después los parámetros que de verdad se usan (bits por clave, número de hashes) y el hashing: posiciones mal derivadas, o un hash que manda claves parecidas a las mismas posiciones, suben la tasa por encima de la fórmula. Mídela directamente con claves que sabes que no están. La solución suele ser reconstruirlo más grande, o partirlo para que cada filtro cubra un conjunto acotado.")],
];

export default defineLesson({
  title: t("Bloom Filter Workbench", "Banco de trabajo: filtro de Bloom"),
  eyebrow: t("Systems lesson 68 · Bloom filter", "Lección de sistemas 68 · Filtro de Bloom"),
  lede: t("A Bloom filter answers \"is this key in the set?\" with NO or MAYBE, in a few bits per key whatever the keys are: about ten bits for 1% wrong maybes. It never says no to a key it holds, it says maybe to a few it doesn't, and that's enough to skip most trips to a slow store. This lesson builds one as a peg board in front of an archive: watch it, predict what breaks it, then explain it back.",
    "Un filtro de Bloom responde \"¿está esta clave en el conjunto?\" con NO o QUIZÁS, en unos pocos bits por clave, sean como sean las claves: unos diez bits para un 1% de quizás equivocados. Nunca le dice que no a una clave que tiene, le dice quizás a unas pocas que no tiene, y eso alcanza para ahorrarse la mayoría de los viajes a un almacenamiento lento. Esta lección arma uno como un tablero de clavijas frente a un archivo: míralo, predice qué lo rompe y después explícalo."),
  machine: {
    intro: t("Each key card stands on the reader while its hashes pick its pegs. Adding a key raises them. A lookup checks them: if any is down the answer is NO and nobody walks to the archive; if all are up it's MAYBE, and the card goes to the archive to find out. Try more hashes, fewer pegs per key, twice the keys the board was planned for, and deletes.",
      "Cada tarjeta de clave se para en el lector mientras sus hashes eligen sus clavijas. Agregar una clave las levanta. Una búsqueda las revisa: si alguna está abajo, la respuesta es NO y nadie camina hasta el archivo; si todas están arriba es QUIZÁS, y la tarjeta va al archivo para averiguarlo. Prueba más hashes, menos clavijas por clave, el doble de las claves planeadas y los borrados."),
    plate: {
      title: t("Peg board", "Tablero de clavijas"),
      keys: [
        { mark: "lit", label: t("The current key's pegs and threads, and the board's answer; a card the board got wrong; the archive lamp when a trip finds nothing", "Las clavijas e hilos de la clave actual y la respuesta del tablero; una tarjeta en la que el tablero se equivocó; la lámpara del archivo cuando un viaje no encuentra nada") },
        { mark: "raised", label: t("Key cards: the key's number, + when it is being added, − when deleted; pegs that are up", "Tarjetas de claves: el número de la clave, + cuando se agrega, − cuando se borra; clavijas arriba") },
        { mark: "flat", label: t("The board: " + M_LIVE + " pegs in five rows of sixteen", "El tablero: " + M_LIVE + " clavijas en cinco filas de dieciséis") },
      ],
      caption: t(
        "The board has " + M_LIVE + " pegs (the filter's bits); pegs per key sets how many keys it is planned for (" + M_LIVE + " ÷ 5 = 16). A key's hashes pick its pegs, and two hashes can pick the same one. Adding a key raises its pegs and files the card in the archive. A lookup checks them: one peg down is a sure NO, and the card goes to SAID NO without a trip; all up is MAYBE, and the card goes to the archive, then to FOUND, or to FALSE POSITIVES when other keys had raised all its pegs. Lookups are " + pct(PRESENT_SHARE) + " stored keys and " + pct(1 - PRESENT_SHARE) + " new ones. With deletes on, after every " + REPLACE_EVERY + " lookups one stored key is deleted and a new one added: pulling its pegs down also pulls pegs other keys need, which shows up as FALSE NEGATIVES; a counting filter stacks one ring per key on each peg and takes one off instead.",
        "El tablero tiene " + M_LIVE + " clavijas (los bits del filtro); clavijas por clave fija para cuántas claves está planeado (" + M_LIVE + " ÷ 5 = 16). Los hashes de una clave eligen sus clavijas, y dos hashes pueden elegir la misma. Agregar una clave levanta sus clavijas y guarda la tarjeta en el archivo. Una búsqueda las revisa: una clavija abajo es un NO seguro, y la tarjeta va a DIJO NO sin viaje; todas arriba es QUIZÁS, y la tarjeta va al archivo y después a ENCONTRADAS, o a FALSOS POSITIVOS cuando otras claves habían levantado todas sus clavijas. Las búsquedas son un " + pct(PRESENT_SHARE) + " de claves guardadas y un " + pct(1 - PRESENT_SHARE) + " de claves nuevas. Con borrados, después de cada " + REPLACE_EVERY + " búsquedas se borra una clave guardada y se agrega una nueva: bajar sus clavijas también baja clavijas que otras claves necesitan, y eso aparece como FALSOS NEGATIVOS; un filtro con contadores apila un anillo por clave en cada clavija y quita uno en su lugar.",
      ),
      stage: { "data-pegboard": "" },
      label: t("Bloom filter simulation. Space pauses or resumes.", "Simulación de un filtro de Bloom. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["keys", t("Keys stored", "Claves guardadas")],
      ["up", t("Pegs up", "Clavijas arriba"), "–"],
      ["no", t("Said no", "Dijo no")],
      ["fp", t("False positives", "Falsos positivos")],
      ["pred", t("Formula predicts", "La fórmula predice"), "–"],
      ["fn", t("False negatives", "Falsos negativos")],
    ],
    controls: [
      { seg: "bpk", label: t("Pegs per key", "Clavijas por clave"), options: [[5, "5"], [10, "10"], [20, "20"]], value: 5 },
      { seg: "k", label: t("Hashes", "Hashes"), options: [[1, "1"], [3, "3"], [7, "7"], [14, "14"], [20, "20"]], value: 3 },
      { seg: "keys", label: t("Keys added", "Claves agregadas"), options: [["planned", t("As planned", "Las planeadas")], ["double", t("Twice as many", "El doble")]], value: "planned" },
      { seg: "deletes", label: t("Deletes", "Borrados"), options: [["none", t("None", "Ninguno")], ["clear", t("Pull its pegs down", "Bajar sus clavijas")], ["count", t("Counting filter", "Filtro con contadores")]], value: "none" },
      { speed: true },
      { actions: [["add", t("Add a key", "Agregar una clave")], ["check", t("Look up a stored key", "Buscar una clave guardada")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("False positives counts the new keys that got MAYBE, of all the new keys looked up. Formula predicts is (1 − e^(−kn/m))^k for the keys stored now; on 80 pegs the measured share wanders around it. Changing a setting starts the run again.",
      "Falsos positivos cuenta las claves nuevas que recibieron QUIZÁS, del total de claves nuevas buscadas. La fórmula predice es (1 − e^(−kn/m))^k con las claves guardadas ahora; con 80 clavijas la parte medida oscila alrededor de ella. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same filter as the machine, at a bigger scale (1,000 keys or more), averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo filtro que la máquina, a mayor escala (1,000 claves o más), promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; the hashes are a MurmurHash3 finaliser. The filter is from Burton H. Bloom, "Space/Time Trade-offs in Hash Coding with Allowable Errors", Communications of the ACM, 1970.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; los hashes son un finalizador de MurmurHash3. El filtro es de Burton H. Bloom, "Space/Time Trade-offs in Hash Coding with Allowable Errors", Communications of the ACM, 1970.`),
  css: `
[data-pegboard] [data-board][data-mode="plain"] [data-ringset]{display:none}
[data-pegboard] .bloom-socket{fill:var(--anatomy-paper);stroke:var(--anatomy-lo);stroke-width:.6}
[data-pegboard] .bloom-hole{fill:var(--anatomy-lit);stroke:var(--anatomy-lit);stroke-width:.6}
[data-pegboard] [data-board][data-mode="count"] [data-pin]{display:none}
[data-pegboard] .bloom-thread{fill:none;stroke:var(--anatomy-lit);stroke-width:.9;stroke-linecap:round}
[data-pegboard] [data-card] .iso-face-text{font-weight:600}
.iso-stage [data-layer] text,.iso-stage [data-threads]{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: { P, G: GEOMETRY, CARD_SVG: cardSvg(), RING_SVG: ringSvg(), SPINDLE_SVG: spindleSvg() },
});
