// Systems lesson 40 · Hash tables. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, P, FIRST, GEOM, COUNTERS } from "./figure.mjs";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "nogrow",
    title: t("Keep adding, never grow", "Agrega sin parar, sin crecer nunca"),
    change: t("Chaining, 64 buckets, resizing off · insert 64 user ids, then 1,024 · six seeded runs",
      "Encadenamiento, 64 cubetas, sin redimensionar · inserta 64 IDs de usuario y después 1,024 · seis ejecuciones con semilla fija"),
    question: t("What happens to the average number of keys a lookup compares?", "¿Qué pasa con la cantidad promedio de claves que compara una búsqueda?"),
    options: [t("It stays about the same: hash lookups are O(1)", "Se mantiene más o menos igual: las búsquedas en una tabla hash son O(1)"),
      t("It grows about 6×, in step with keys per bucket", "Crece unas 6 veces, al ritmo de las claves por cubeta"),
      t("It grows a little, like log n", "Crece un poco, como log n")],
    answer: 1,
    why: t("A lookup hashes straight to the right bucket, then walks that bucket's chain. With 64 buckets and 1,024 keys every chain holds about 16, so a lookup compares about 9 keys on average and the unluckiest dozens. O(1) holds only while keys per bucket (the load factor) stays bounded, which is why real tables grow: the same 1,024 keys in a table that doubles at 75% average barely more than one compare.",
      "Una búsqueda va directo a la cubeta correcta con el hash y después recorre la cadena de esa cubeta. Con 64 cubetas y 1,024 claves cada cadena tiene unas 16, así que una búsqueda compara unas 9 claves en promedio y la más desafortunada, decenas. El O(1) se cumple solo mientras las claves por cubeta (el factor de carga) se mantienen acotadas; por eso las tablas reales crecen: las mismas 1,024 claves en una tabla que se duplica al 75% promedian apenas más de una comparación."),
    watch: { mode: "chain", hash: "seeded", keys: "random", grow: "off" },
  },
  {
    id: "weak",
    title: t("A hash that reads only the start of the key", "Un hash que solo lee el comienzo de la clave"),
    change: t("1,000 user ids (user:1000 … user:9999), chaining, doubling at 75% · a good hash vs one that reads only the first 4 characters",
      "1,000 IDs de usuario (user:1000 … user:9999), encadenamiento, duplicando al 75% · un buen hash contra uno que solo lee los primeros 4 caracteres"),
    question: t("What does the weak hash do to lookups?", "¿Qué le hace el hash débil a las búsquedas?"),
    options: [t("Slows them a little: some buckets get busier", "Las vuelve un poco más lentas: algunas cubetas se llenan más"),
      t("Every key lands in one bucket: a lookup compares about 500 keys, and resizing doesn't help", "Todas las claves caen en una cubeta: una búsqueda compara unas 500 claves, y redimensionar no ayuda"),
      t("Nothing, once the table resizes and spreads them out", "Nada, una vez que la tabla se redimensiona y las reparte")],
    answer: 1,
    why: t("Every id starts with \"user\", so a hash that reads only those characters gives every key the same number, and the same number lands in the same bucket at any table size. The table still doubles (the load factor looks fine) but 2,047 buckets stay empty while one chain holds all 1,000 keys. A good hash mixes every character of the key into every bit of the result.",
      "Todos los IDs empiezan con \"user\", así que un hash que solo lee esos caracteres le da el mismo número a todas las claves, y el mismo número cae en la misma cubeta con cualquier tamaño de tabla. La tabla igual se duplica (el factor de carga se ve bien), pero 2,047 cubetas quedan vacías mientras una sola cadena tiene las 1,000 claves. Un buen hash mezcla cada carácter de la clave en cada bit del resultado."),
    watch: { mode: "chain", hash: "weak", keys: "random", grow: "on" },
  },
  {
    id: "resize",
    title: t("The price of doubling", "El precio de duplicar"),
    change: t("Insert 1,000 keys into a table that starts with 8 buckets and resizes at 75% · grow by doubling, or by adding 8 buckets each time",
      "Inserta 1,000 claves en una tabla que empieza con 8 cubetas y se redimensiona al 75% · crece duplicando, o sumando 8 cubetas cada vez"),
    question: t("A resize moves every key into the new table. Averaged over all 1,000 inserts, how many moves does doubling cost per insert?",
      "Redimensionar mueve cada clave a la tabla nueva. Promediado sobre las 1,000 inserciones, ¿cuántos movimientos cuesta duplicar por inserción?"),
    options: [t("Hundreds: any insert might copy the whole table", "Cientos: cualquier inserción podría copiar toda la tabla"),
      t("Fewer than 2: big copies are rare and get rarer", "Menos de 2: las copias grandes son raras y cada vez más"),
      t("None: resizing happens in the background", "Ninguno: redimensionar ocurre en segundo plano")],
    answer: 1,
    why: t("Doubling copies 6, then 12, 24, … 768 keys: each copy is as big as all the earlier ones together, so the total stays under twice the number of keys and each insert pays for under two moves (amortised O(1)). The single insert that triggers the last resize still moves 768 keys at once: a latency spike, which is why some stores rehash a little at a time. Growing by a fixed 8 buckets resizes far more often and costs around 80 moves per insert, a number that keeps growing with n.",
      "Duplicar copia 6, después 12, 24, … 768 claves: cada copia es tan grande como todas las anteriores juntas, así que el total queda por debajo del doble de la cantidad de claves y cada inserción paga menos de dos movimientos (O(1) amortizado). La inserción que dispara el último redimensionamiento igual mueve 768 claves de una vez: un pico de latencia, por eso algunos almacenes rehashean de a poco. Crecer de a 8 cubetas redimensiona mucho más seguido y cuesta unos 80 movimientos por inserción, un número que sigue creciendo con n."),
    watch: { mode: "chain", hash: "seeded", keys: "random", grow: "on" },
  },
  {
    id: "probe",
    title: t("Chaining or linear probing, 90% full", "Encadenamiento o sondeo lineal, al 90%"),
    change: t("1,024 buckets, no resizing · fill to 50%, then to 90% · chaining keeps a list per bucket; linear probing puts one key per slot and tries the next slot when one is taken",
      "1,024 cubetas, sin redimensionar · llena hasta el 50% y después hasta el 90% · el encadenamiento guarda una lista por cubeta; el sondeo lineal pone una clave por casilla y prueba la siguiente si está ocupada"),
    question: t("At 90% full, which one's lookups slow down more?", "Al 90%, ¿las búsquedas de cuál se vuelven más lentas?"),
    options: [t("Neither: at 90% both still find a key on about the first try", "Ninguna: al 90% las dos todavía encuentran la clave casi al primer intento"),
      t("Chaining: its chains get long", "El encadenamiento: sus cadenas se alargan"),
      t("Linear probing: full slots clump into long runs, and a missing key checks dozens", "El sondeo lineal: las casillas llenas se juntan en tramos largos, y una clave que no está revisa decenas")],
    answer: 2,
    why: t("With chaining, a 90% table still has short chains: about 1.5 compares to find a key, and a missing key checks less than one. With linear probing, a key that collides takes the next free slot, which makes the run of full slots longer, which makes the next collision more likely: runs clump (primary clustering). Finding a key takes about 5 checks and a missing key about 40. That's why open-addressing tables resize much earlier, around 50–70%, or probe more cleverly.",
      "Con encadenamiento, una tabla al 90% todavía tiene cadenas cortas: unas 1.5 comparaciones para encontrar una clave, y una clave que no está revisa menos de una. Con sondeo lineal, una clave que colisiona toma la siguiente casilla libre, lo que alarga el tramo de casillas llenas, lo que hace más probable la próxima colisión: los tramos se amontonan (agrupamiento primario, primary clustering). Encontrar una clave cuesta unas 5 revisiones y una clave que no está, unas 40. Por eso las tablas de direccionamiento abierto se redimensionan mucho antes, alrededor del 50–70%, o sondean de forma más ingeniosa."),
    watch: { mode: "probe", hash: "seeded", keys: "random", grow: "off" },
  },
  {
    id: "flood",
    title: t("Keys crafted to collide", "Claves hechas para colisionar"),
    change: t("The hash function is public and unseeded · an attacker searches for 1,000 keys whose hashes end in the same 11 bits and sends them all · then the same keys against a hash seeded with a secret",
      "La función hash es pública y sin semilla · un atacante busca 1,000 claves cuyos hashes terminan en los mismos 11 bits y las envía todas · después, las mismas claves contra un hash con una semilla secreta"),
    question: t("How much more work is inserting the crafted keys than ordinary ones?", "¿Cuánto más trabajo cuesta insertar las claves fabricadas que unas normales?"),
    options: [t("About the same: the table resizes and spreads them", "Más o menos lo mismo: la tabla se redimensiona y las reparte"),
      t("About twice as much", "Más o menos el doble"),
      t("Over 100× more, growing with the square of the key count; the seeded hash brings it back to normal", "Más de 100 veces más, y crece con el cuadrado de la cantidad de claves; el hash con semilla lo vuelve a la normalidad")],
    answer: 2,
    why: t("All the crafted keys share a bucket at every table size, so each insert compares against every key before it: 1 + 2 + … + 1,000, about half a million compares, where ordinary keys take about three thousand. A few kilobytes of request can pin a CPU (hash flooding, the 2011 attacks on web frameworks' form parsers). The seed is the fix: with a secret mixed into the hash the attacker can't predict which keys collide, so the same keys spread out normally. Python, Ruby and Rust seed their hashes per process; Java turns long chains into trees.",
      "Todas las claves fabricadas comparten cubeta con cualquier tamaño de tabla, así que cada inserción compara con todas las claves anteriores: 1 + 2 + … + 1,000, cerca de medio millón de comparaciones, donde unas claves normales cuestan unas tres mil. Unos pocos kilobytes de solicitud pueden saturar una CPU (hash flooding, los ataques de 2011 contra los analizadores de formularios de los frameworks web). La solución es la semilla: con un secreto mezclado en el hash, el atacante no puede predecir qué claves colisionan, así que las mismas claves se reparten normalmente. Python, Ruby y Rust usan una semilla por proceso; Java convierte las cadenas largas en árboles."),
    watch: { mode: "chain", hash: "fixed", keys: "attack", grow: "on" },
  },
];

const QUESTIONS = [
  [t("Why is a hash table lookup \"O(1) on average\", and what has to be true for that to hold?", "¿Por qué una búsqueda en una tabla hash es \"O(1) en promedio\", y qué tiene que cumplirse para que sea así?"),
    t("The hash jumps straight to one bucket, so the work is the length of that one chain (or probe run), not the size of the table. That stays constant only if the hash spreads keys evenly and the table keeps the load factor bounded by growing. It's an average: a bad hash, unlucky or crafted keys, or a full table make single lookups slow.",
      "El hash salta directo a una cubeta, así que el trabajo es el largo de esa cadena (o tramo de sondeo), no el tamaño de la tabla. Eso se mantiene constante solo si el hash reparte las claves de forma pareja y la tabla mantiene acotado el factor de carga creciendo. Es un promedio: un hash malo, claves con mala suerte o fabricadas, o una tabla llena vuelven lentas búsquedas individuales.")],
  [t("What is the load factor, and why does a table resize at a limit instead of when it's completely full?", "¿Qué es el factor de carga, y por qué una tabla se redimensiona en un límite en lugar de cuando está completamente llena?"),
    t("Keys divided by buckets. Expected chain length grows with it, and probe runs grow much faster as it nears 1 (roughly 1/(1−α)² for a missing key with linear probing). Resizing at around 0.75 for chaining, or 0.5–0.7 for open addressing, keeps lookups short at the cost of some empty buckets.",
      "Las claves divididas por las cubetas. El largo esperado de las cadenas crece con él, y los tramos de sondeo crecen mucho más rápido cuando se acerca a 1 (más o menos 1/(1−α)² para una clave que no está, con sondeo lineal). Redimensionar alrededor de 0.75 con encadenamiento, o 0.5–0.7 con direccionamiento abierto, mantiene cortas las búsquedas a cambio de algunas cubetas vacías.")],
  [t("Doubling makes one insert copy every key. Why is the cost per insert still constant on average, and when does the spike still hurt?", "Duplicar hace que una inserción copie todas las claves. ¿Por qué el costo por inserción sigue siendo constante en promedio, y cuándo el pico igual duele?"),
    t("Each resize copies as many keys as all previous resizes together, so total copying is under 2n for n inserts: amortised O(1). Growing by a fixed amount would make it O(n) per insert. The spike is a single slow operation, which matters for latency-sensitive paths; some systems (Redis, for example) rehash incrementally, moving a few buckets per operation while both tables live.",
      "Cada redimensionamiento copia tantas claves como todos los anteriores juntos, así que el copiado total queda por debajo de 2n para n inserciones: O(1) amortizado. Crecer en una cantidad fija lo volvería O(n) por inserción. El pico es una sola operación lenta, lo que importa en caminos sensibles a la latencia; algunos sistemas (Redis, por ejemplo) rehashean de forma incremental, moviendo unas pocas cubetas por operación mientras conviven las dos tablas.")],
  [t("Compare chaining with open addressing (linear probing). What does each do well?", "Compara el encadenamiento con el direccionamiento abierto (sondeo lineal). ¿Qué hace bien cada uno?"),
    t("Chaining tolerates high load factors and simple deletes, but follows pointers to separate nodes (cache misses, extra memory). Linear probing keeps keys in one array, so a probe run is a fast sequential scan, but it clusters as the table fills, must resize earlier, and deletes need tombstones or shifting. Many modern tables use open addressing with smarter probing (Robin Hood, SwissTable).",
      "El encadenamiento tolera factores de carga altos y borrados simples, pero sigue punteros a nodos separados (fallos de caché, más memoria). El sondeo lineal guarda las claves en un solo arreglo, así que un tramo de sondeo es un recorrido secuencial rápido, pero se agrupa a medida que la tabla se llena, tiene que redimensionarse antes y los borrados necesitan lápidas (tombstones) o desplazamientos. Muchas tablas modernas usan direccionamiento abierto con sondeos más ingeniosos (Robin Hood, SwissTable).")],
  [t("What makes a hash function good for a hash table? Why didn't resizing rescue the weak hash?", "¿Qué hace que una función hash sea buena para una tabla hash? ¿Por qué redimensionar no rescató al hash débil?"),
    t("It's fast, deterministic for equal keys, and mixes every part of the key into every bit of the output, so similar keys (shared prefixes, sequential ids) land far apart. Resizing only changes how many low bits pick the bucket; if keys produce the same hash, they collide at every size.",
      "Es rápida, da lo mismo para claves iguales y mezcla cada parte de la clave en cada bit del resultado, así que claves parecidas (prefijos comunes, IDs consecutivos) caen lejos entre sí. Redimensionar solo cambia cuántos bits bajos eligen la cubeta; si las claves producen el mismo hash, colisionan con cualquier tamaño.")],
  [t("What is hash flooding, and how do languages and frameworks defend against it?", "¿Qué es el hash flooding, y cómo se defienden los lenguajes y los frameworks?"),
    t("An attacker who can predict the hash sends many keys that collide (form fields, JSON keys, headers), turning each insert into a scan and the request into O(n²) CPU. Defences: a keyed hash with a per-process random seed (SipHash in Python, Rust and Ruby), limits on how many keys a request may carry, and tree-shaped buckets once a chain gets long (Java's HashMap).",
      "Un atacante que puede predecir el hash envía muchas claves que colisionan (campos de formulario, claves JSON, encabezados), y convierte cada inserción en un recorrido y la solicitud en CPU O(n²). Defensas: un hash con clave y una semilla aleatoria por proceso (SipHash en Python, Rust y Ruby), límites a cuántas claves puede traer una solicitud y cubetas en forma de árbol cuando una cadena se alarga (el HashMap de Java).")],
];

// ---------- page ----------
const figure = figurePlate({
  title: t("Pigeonhole rack", "Casillero"),
  keys: [
    { mark: "lit", label: t("Moving now: the shuttle with the key, the stamp at work, the card being compared or dropped", "En movimiento: el carro con la clave, el sello trabajando, la tarjeta que se compara o se deja") },
    { mark: "raised", label: t("A key card in a tray; a pile is a bucket's chain. Lidded trays are buckets the table doesn't have yet", "Una tarjeta de clave en una bandeja; una pila es la cadena de una cubeta. Las bandejas tapadas son cubetas que la tabla todavía no tiene") },
    { mark: "flat", label: t("Counters and the load-factor gauge", "Contadores y el medidor del factor de carga") },
  ],
  caption: t(
    "The stamp hashes the key on the shuttle and shows its bucket (hash modulo the number of open trays). The shuttle runs to that tray: with chaining the key is compared with each card in the pile, then added on top; with linear probing it checks one tray after another until it finds an empty one. When the load factor would pass 75%, the lids come off, the table doubles and every key is placed again.",
    "El sello calcula el hash de la clave que va en el carro y muestra su cubeta (el hash módulo la cantidad de bandejas abiertas). El carro corre hasta esa bandeja: con encadenamiento la clave se compara con cada tarjeta de la pila y después se agrega arriba; con sondeo lineal revisa una bandeja tras otra hasta encontrar una vacía. Cuando el factor de carga pasaría del 75%, se quitan las tapas, la tabla se duplica y cada clave se vuelve a ubicar.",
  ),
  stage: "data-hashtable",
  stageLabel: t("Hash table simulation. Space pauses or resumes.", "Simulación de una tabla hash. Espacio pausa o reanuda."),
  svg: buildFigure(),
});

const controls = panel({
  stats: [["keys", t("Keys", "Claves")], ["buckets", t("Buckets", "Cubetas"), "8"], ["load", t("Load factor", "Factor de carga"), "–"], ["last", t("Probes, last operation", "Sondeos, última operación"), "–"], ["avg", t("Average probes to find a key", "Sondeos promedio para encontrar una clave"), "–"], ["longest", t("Longest chain or run", "Cadena o tramo más largo")], ["moved", t("Keys moved by resizing", "Claves movidas al redimensionar")]],
  controls: [
    seg("hash", t("Hash", "Hash"), [["seeded", t("Seeded", "Con semilla")], ["fixed", t("Fixed, no seed", "Fijo, sin semilla")], ["weak", t("First 4 characters", "Primeros 4 caracteres")]], "seeded"),
    seg("keys", t("Keys", "Claves"), [["random", t("User ids", "IDs de usuario")], ["attack", t("Crafted to collide", "Hechas para colisionar")]], "random"),
    seg("mode", t("Collisions", "Colisiones"), [["chain", t("Chaining", "Encadenamiento")], ["probe", t("Linear probing", "Sondeo lineal")]], "chain"),
    seg("grow", t("Resize", "Redimensionar"), [["on", t("Double at 75%", "Duplicar al 75%")], ["off", t("Never", "Nunca")]], "on"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
});

const css = `
[data-hashtable] [data-keycard] .iso-face-text,[data-hashtable] [data-more] .iso-face-text{fill:var(--anatomy-strong)}
[data-hashtable] [data-more] .iso-face-text{font-weight:600}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOM)};
const COUNTERS = ${JSON.stringify(COUNTERS)};
const FIRST = ${JSON.stringify(FIRST)};
const TRAY_CX = G.CX;

const stage = document.querySelector("[data-hashtable]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const { T, L } = WB;
const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
const lift = (el, by) => el.setAttribute("transform", translateAlong(P, by));
const show = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };
const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };
const setLit = (g, on) => g.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", on));
const dials = Object.fromEntries(Object.keys(COUNTERS).map((n) => [n, WB.counter(svg, n, P)]));
const wheel = (name, v) => dials[name].set(Math.max(0, Math.min(v, 10 ** COUNTERS[name].count - 1)));
const gauge = WB.meter(svg, "load", P);
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
const stat = (key, value) => { const el = statEls[key]; const s = String(value); if (el && el.textContent !== s) el.textContent = s; };

const cards = Array.from({ length: G.SLOTS }, (_, i) => Array.from({ length: G.PILE }, (_, s) => q('[data-c="' + i + "-" + s + '"]')));
const more = Array.from({ length: G.SLOTS }, (_, i) => ({ g: q('[data-more="' + i + '"]'), label: q('[data-more-label="' + i + '"]') }));
const lids = Array.from({ length: G.SLOTS }, (_, i) => q('[data-lid="' + i + '"]'));
const shuttle = q("[data-shuttle]"), keyCard = q("[data-keycard]"), keyLabel = q("[data-key-label]"), keySub = q("[data-key-sub]");
const head = q("[data-head]"), fly = q("[data-fly]");

const cfg = { hash: "seeded", keys: "random", mode: "chain", grow: "on", speed: 1 };
const ATTACK = attackKeys(60, 3);
const short = (key) => key.slice(5);

// ---------- what the rack shows ----------
// The piles for a list of keys in insertion order, placed the way the table places them (a fresh table, no resizing).
let tb, shownM = 8;
function layout(keys, m) {
  const v = makeTable({ mode: tb.mode, hash: tb.hash, grow: false, m, seed: tb.seed });
  keys.forEach((key) => v.insert(key));
  return v.slots.map((s) => (tb.mode === "chain" ? s.length : s === null ? 0 : 1));
}
function paint(keys, m) {
  const piles = layout(keys, m);
  shownM = m;
  for (let i = 0; i < G.SLOTS; i++) {
    const n = i < m ? piles[i] : 0;
    cards[i].forEach((c, s) => { show(c, s < n); setLit(c, false); });
    show(more[i].g, n > G.PILE);
    if (n > G.PILE) setText(more[i].label, "+" + (n - G.PILE));
    show(lids[i], i >= m);
  }
  return piles;
}
const lightCard = (slot, level, on) => { const c = cards[slot][Math.min(level, G.PILE - 1)]; if (c) setLit(c, on); };

// ---------- the script: insert keys, look some up, start over ----------
let cycle = 0, pool, poolAt, ops, op, msg = null, probesShown = 0, lastProbes = null, sx = G.HOME_X, holding = 0;
const random = rng(97);
function reset() {
  cycle++;
  tb = makeTable({ mode: cfg.mode, hash: cfg.hash, grow: cfg.grow === "on", m: 8, seed: 1 + (cycle % 7) });
  pool = cfg.keys === "attack" ? ATTACK.slice((cycle * 7) % 30) : userKeys(40, 11 + cycle);
  poolAt = 0; ops = 0; op = null; holding = 0; lastProbes = null; probesShown = 0; tailLookups = 0;
  paint([], 8);
  sx = G.HOME_X; lift(shuttle, [sx, 0, 0]); show(fly, false);
  setText(keyLabel, ""); setText(keySub, "");
}
let tailLookups = 0;
function full() {
  if (cfg.grow === "on") return tb.wouldResize() && tb.m * 2 > G.SLOTS;
  return tb.mode === "chain" ? tb.n >= 24 : tb.n >= tb.m - 1;
}
function nextOp() {
  ops++;
  const lookupNow = tb.n > 2 && ops % 4 === 0;
  if (!lookupNow && !full()) return { kind: "insert", key: pool[poolAt++] };
  if (!full()) return { kind: "lookup", key: tb.keys[Math.floor(random() * tb.n)] };
  if (tailLookups === 0) { tailLookups++; return { kind: "lookup", key: tb.keys[Math.floor(random() * tb.n)] }; }
  if (tailLookups === 1) { tailLookups++; return { kind: "lookup", key: cfg.keys === "attack" ? ATTACK[59] : "user:0420" }; }
  return null;
}
// Start an operation: run it on the table now, then animate the trace.
function begin() {
  const o = nextOp();
  if (!o) { holding = 2.2; return; }
  const before = tb.keys.slice(), mBefore = tb.m;
  const tr = o.kind === "insert" ? tb.insert(o.key) : tb.lookup(o.key);
  op = { ...o, tr, before, mBefore, phase: "back", t: 0, step: 0, probes: 0 };
  setText(keyLabel, short(o.key)); setText(keySub, o.kind === "insert" ? "+" : "?"); show(keyCard, true);
  probesShown = 0;
  wheel("probes", 0);
}
// "1 probe" / "3 probes", "1 sondeo" / "3 sondeos"
const pr = (n) => T(n + (n === 1 ? " probe" : " probes"), n + (n === 1 ? " sondeo" : " sondeos"));
const cmp = (n) => T(n + (n === 1 ? " compare" : " compares"), n + (n === 1 ? " comparación" : " comparaciones"));
const K = (n) => T(n + (n === 1 ? " key" : " keys"), n + (n === 1 ? " clave" : " claves"));
function describe() {
  const o = op, tr = o.tr, key = o.key, b = tr.home, ch = tb.mode === "chain";
  if (o.kind === "insert") {
    if (ch) return tr.probes ? T(key + " → bucket " + b + " · compared with " + K(tr.probes).en + ", none equal · added to the chain", key + " → cubeta " + b + " · comparada con " + K(tr.probes).es + ", ninguna igual · se agrega a la cadena")
      : T(key + " → bucket " + b + " · empty · starts a chain", key + " → cubeta " + b + " · vacía · empieza una cadena");
    const extra = tr.path.length - 1;
    return extra ? T(key + " → slot " + b + " taken · tried the next " + extra + " · stored in slot " + tr.at + " (" + pr(tr.probes).en + ")", key + " → casilla " + b + " ocupada · probó las " + extra + " siguientes · guardada en la casilla " + tr.at + " (" + pr(tr.probes).es + ")")
      : T(key + " → slot " + b + " is free · 1 probe", key + " → la casilla " + b + " está libre · 1 sondeo");
  }
  if (tr.found) return ch ? T("find " + key + " → bucket " + b + " · found on compare " + tr.probes, "buscar " + key + " → cubeta " + b + " · encontrada en la comparación " + tr.probes)
    : T("find " + key + " → slot " + b + " · found in slot " + tr.at + " (" + pr(tr.probes).en + ")", "buscar " + key + " → casilla " + b + " · encontrada en la casilla " + tr.at + " (" + pr(tr.probes).es + ")");
  return ch ? T("find " + key + " → bucket " + b + " · not there: " + cmp(tr.probes).en + " to be sure", "buscar " + key + " → cubeta " + b + " · no está: " + cmp(tr.probes).es + " para estar seguro")
    : T("find " + key + " → slot " + b + " · not there: " + pr(tr.probes).en + " until an empty slot", "buscar " + key + " → casilla " + b + " · no está: " + pr(tr.probes).es + " hasta una casilla vacía");
}

// ---------- animation ----------
const DUR = { back: 0.35, stamp: 0.5, resize: 1.6, travel: 0.5, look: 0.2, hop: 0.16, drop: 0.35, rest: 0.35 };
function moveShuttle(x) { sx = x; lift(shuttle, [x, 0, 0]); }
function step(dt) {
  if (holding > 0) { holding -= dt; if (holding <= 0) reset(); return; }
  if (!op) { begin(); if (!op) return; }
  const o = op, tr = o.tr;
  o.t += dt;
  if (o.phase === "back") {
    const p = ease(o.t / DUR.back);
    moveShuttle(sx + (G.HOME_X - sx) * p);
    if (o.t >= DUR.back) { o.phase = "stamp"; o.t = 0; msg = o.kind === "insert" ? T("insert " + o.key + ": hash it", "insertar " + o.key + ": calcular su hash") : T("find " + o.key + ": hash it", "buscar " + o.key + ": calcular su hash"); }
    return;
  }
  if (o.phase === "stamp") {
    const p = o.t / DUR.stamp, down = p < 0.5 ? ease(p * 2) : ease((1 - p) * 2);
    lift(head, [0, 0, G.HEAD_Z - 3.2 * down]); setLit(head, p > 0.2 && p < 0.8);
    if (p >= 0.5 && !o.stamped) { o.stamped = true; wheel("bucket", tr.resized ? hashOf(o.key, tb.hash, tb.seed) % tr.resized.from : tr.home); setText(keySub, "→ " + (tr.resized ? hashOf(o.key, tb.hash, tb.seed) % tr.resized.from : tr.home)); }
    if (o.t >= DUR.stamp) { setLit(head, false); o.phase = tr.resized ? "resize" : "travel"; o.t = 0; if (tr.resized) msg = T("load would pass 75% · double to " + tr.resized.to + " buckets, place all " + tr.resized.moved + " keys again", "la carga pasaría del 75% · duplicar a " + tr.resized.to + " cubetas y reubicar las " + tr.resized.moved + " claves"); }
    return;
  }
  if (o.phase === "resize") {
    const p = o.t / DUR.resize, moved = tr.resized.moved;
    if (!o.opened) { o.opened = true; paint([], tr.resized.to); }
    const k = Math.min(moved, Math.floor(Math.max(0, (p - 0.15) / 0.75) * moved + 0.0001));
    if (k !== o.placed) { o.placed = k; paint(o.before.slice(0, k), tr.resized.to); wheel("moved", tb.moved - moved + k); }
    if (o.t >= DUR.resize) { o.phase = "travel"; o.t = 0; wheel("bucket", tr.home); setText(keySub, "→ " + tr.home); }
    return;
  }
  if (o.phase === "travel") {
    if (o.from === undefined) { o.from = sx; msg = tb.mode === "chain" ? T(o.key + " → bucket " + tr.home, o.key + " → cubeta " + tr.home) : T(o.key + " → slot " + tr.home, o.key + " → casilla " + tr.home); }
    const p = ease(o.t / DUR.travel);
    moveShuttle(o.from + (TRAY_CX[tr.home] - o.from) * p);
    if (o.t >= DUR.travel) { o.phase = "look"; o.t = 0; o.step = 0; }
    return;
  }
  const chain = tb.mode === "chain";
  if (o.phase === "look") {
    // chaining: light the pile's cards one by one; probing: check one slot, then hop to the next.
    const total = tr.probes, d = chain ? Math.max(0.05, Math.min(DUR.look, 1.6 / Math.max(1, total))) : DUR.look + DUR.hop;
    const idx = Math.floor(o.t / d);
    if (chain) {
      const n = Math.min(idx, total);
      if (n !== probesShown) { for (let s = 0; s < G.PILE; s++) lightCard(tr.home, s, false); if (n > 0) lightCard(tr.home, n - 1, true); probesShown = n; wheel("probes", n); }
      if (idx > total || (total === 0 && o.t > 0.1)) { o.phase = o.kind === "insert" ? "drop" : "rest"; o.t = 0; msg = describe(); }
    } else {
      const j = Math.min(idx, tr.path.length - 1), slot = tr.path[j];
      const local = o.t - idx * d;
      if (j !== o.step || !o.began) { o.began = true; o.step = j; probesShown = j + 1; wheel("probes", probesShown); for (let i = 0; i < G.SLOTS; i++) lightCard(i, 0, false); }
      const occupied = o.kind === "insert" ? j < tr.path.length - 1 : (tr.found ? j < tr.path.length - 1 : j < tr.path.length - 1);
      if (local < DUR.look) { if (occupied || (o.kind === "lookup" && tr.found && j === tr.path.length - 1)) lightCard(slot, 0, true); }
      else if (j < tr.path.length - 1) { lightCard(slot, 0, false); const nx = tr.path[j + 1]; const from = TRAY_CX[slot], to = TRAY_CX[nx]; moveShuttle(from + (to - from) * ease((local - DUR.look) / DUR.hop)); }
      if (idx >= tr.path.length) { moveShuttle(TRAY_CX[tr.path[tr.path.length - 1]]); o.phase = o.kind === "insert" ? "drop" : "rest"; o.t = 0; msg = describe(); }
    }
    return;
  }
  if (o.phase === "drop") {
    if (!o.dropping) {
      o.dropping = true;
      paint(o.before, tb.m);
      o.slot = chain ? tr.home : tr.at;
      o.level = chain ? tr.at : 0;
      show(fly, true); show(keyCard, false);
    }
    const p = ease(o.t / DUR.drop);
    lift(fly, [G.CX[o.slot] - G.CX[0], G.Y[o.slot] - G.Y[0], G.Z[o.slot] - G.Z[0] + Math.min(o.level, G.PILE - 1) * G.CARD_PITCH + 9 * (1 - p)]);
    if (o.t >= DUR.drop) { show(fly, false); paint(tb.keys, tb.m); o.phase = "rest"; o.t = 0; }
    return;
  }
  if (o.phase === "rest") {
    if (o.kind === "lookup" && tr.found && chain) lightCard(tr.home, tr.at, true);
    if (o.t >= DUR.rest + (o.kind === "lookup" ? 0.4 : 0)) { lastProbes = tr.probes; paint(tb.keys, tb.m); op = null; }
  }
}

function stats() {
  const s = tb.stats();
  wheel("keys", s.n); wheel("longest", s.longest);
  if (!op || op.phase !== "resize") wheel("moved", s.moved);
  gauge.set(Math.min(1, s.load / G.METER_MAX));
  stat("keys", s.n); stat("buckets", s.m); stat("load", s.load.toFixed(2));
  stat("last", lastProbes === null ? "–" : lastProbes); stat("avg", s.n ? s.avg.toFixed(2) : "–");
  stat("longest", s.longest); stat("moved", s.moved);
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({
  stage,
  step: (dt) => { step(dt * cfg.speed); stats(); say(holding > 0 ? L("full for this figure · starting over", "llena para esta figura · se empieza de nuevo") : msg ? L(msg) : L("starting", "iniciando")); },
  onPause: (on) => { pauseBtn.textContent = on ? L("Play", "Reanudar") : L("Pause", "Pausa"); if (on) say(L("paused", "en pausa")); },
});
WB.onLang(() => { pauseBtn.textContent = loop.paused ? L("Play", "Reanudar") : L("Pause", "Pausa"); say(loop.paused ? L("paused", "en pausa") : msg ? L(msg) : L("starting", "iniciando")); });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = raw;
  if (!quiet) { cycle = 0; reset(); }
}
WB.onSegments((name, value) => set(name, value));
document.querySelector('[data-act="reset"]').addEventListener("click", () => { cycle = 0; reset(); });
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments ----------
const SEEDS = [1, 2, 3, 4, 5, 6];
const mean = (fn) => { const rs = SEEDS.map(fn); return Object.fromEntries(Object.keys(rs[0]).filter((k) => typeof rs[0][k] === "number").map((k) => [k, rs.reduce((a, r) => a + r[k], 0) / rs.length])); };
const n2 = (x) => x.toFixed(x < 10 ? 1 : 0);
const n0 = (x) => String(Math.round(x));
const big = (x) => Math.round(x).toLocaleString("en");
const RUNS = {
  nogrow: () => {
    const a = mean((s) => fill({ m: 64, grow: false, seed: s }, userKeys(64, s)));
    const b = mean((s) => fill({ m: 64, grow: false, seed: s }, userKeys(1024, s)));
    const c = mean((s) => fill({ m: 64, grow: true, seed: s }, userKeys(1024, s)));
    const top = Math.max(b.worst, 1);
    return { verdict: T("64 keys in 64 buckets: " + n2(a.avg) + " compares per lookup on average. 1,024 keys in the same 64 buckets: " + n2(b.avg) + " on average, " + n2(b.worst) + " for the unluckiest key (" + n2(b.avg / a.avg) + "× slower). Growing at 75% instead: " + n2(c.avg) + ".",
        "64 claves en 64 cubetas: " + n2(a.avg) + " comparaciones por búsqueda en promedio. 1,024 claves en las mismas 64 cubetas: " + n2(b.avg) + " en promedio y " + n2(b.worst) + " para la clave más desafortunada (" + n2(b.avg / a.avg) + " veces más lento). Creciendo al 75% en su lugar: " + n2(c.avg) + "."),
      bars: [[T("64 keys, load 1", "64 claves, carga 1"), a.avg / top, n2(a.avg)], [T("1,024 keys, load 16", "1,024 claves, carga 16"), b.avg / top, n2(b.avg), true], [T("Worst key, load 16", "Peor clave, carga 16"), b.worst / top, n2(b.worst), true], [T("1,024 keys, doubling", "1,024 claves, duplicando"), c.avg / top, n2(c.avg)]] };
  },
  weak: () => {
    const g = mean((s) => fill({ seed: s }, userKeys(1000, s)));
    const w = mean((s) => fill({ hash: "weak", seed: s }, userKeys(1000, s)));
    return { verdict: T("Good hash: " + big(g.used) + " of " + big(g.m) + " buckets in use, longest chain " + n0(g.longest) + ", " + n2(g.avg) + " compares per lookup. First 4 characters: " + big(w.used) + " bucket in use, one chain of " + big(w.longest) + " keys, " + n2(w.avg) + " compares per lookup, in a table that still doubled to " + big(w.m) + " buckets.",
        "Buen hash: " + big(g.used) + " de " + big(g.m) + " cubetas en uso, cadena más larga de " + n0(g.longest) + ", " + n2(g.avg) + " comparaciones por búsqueda. Primeros 4 caracteres: " + big(w.used) + " cubeta en uso, una cadena de " + big(w.longest) + " claves, " + n2(w.avg) + " comparaciones por búsqueda, en una tabla que igual se duplicó a " + big(w.m) + " cubetas."),
      bars: [[T("Compares per lookup, good hash", "Comparaciones por búsqueda, buen hash"), g.avg / w.avg, n2(g.avg)], [T("Compares per lookup, weak hash", "Comparaciones por búsqueda, hash débil"), 1, n2(w.avg), true], [T("Buckets in use, good hash", "Cubetas en uso, buen hash"), g.used / g.m, big(g.used)], [T("Buckets in use, weak hash", "Cubetas en uso, hash débil"), w.used / w.m, big(w.used), true]] };
  },
  resize: () => {
    const d = mean((s) => fill({ seed: s }, userKeys(1000, s)));
    const a = mean((s) => fill({ seed: s, growBy: 8 }, userKeys(1000, s)));
    const per = d.moved / 1000, perA = a.moved / 1000;
    return { verdict: T("Doubling: " + d.resizes + " resizes, " + big(d.moved) + " keys moved in all, " + per.toFixed(2) + " moves per insert; the biggest single insert moved " + big(d.biggest) + " keys. Adding 8 buckets: " + big(a.resizes) + " resizes, " + big(a.moved) + " moves, " + perA.toFixed(0) + " per insert.",
        "Duplicando: " + d.resizes + " redimensionamientos, " + big(d.moved) + " claves movidas en total, " + per.toFixed(2) + " movimientos por inserción; la inserción individual más cara movió " + big(d.biggest) + " claves. Sumando 8 cubetas: " + big(a.resizes) + " redimensionamientos, " + big(a.moved) + " movimientos, " + perA.toFixed(0) + " por inserción."),
      bars: [[T("Moves per insert, doubling", "Movimientos por inserción, duplicando"), per / perA, per.toFixed(2), true], [T("Moves per insert, +8 buckets", "Movimientos por inserción, +8 cubetas"), 1, perA.toFixed(0)], [T("Biggest single insert, doubling", "Inserción más cara, duplicando"), d.biggest / 1000, big(d.biggest)]] };
  },
  probe: () => {
    const run = (mode, f) => mean((s) => fill({ m: 1024, grow: false, mode, seed: s }, userKeys(Math.round(1024 * f), s)));
    const c5 = run("chain", 0.5), p5 = run("probe", 0.5), c9 = run("chain", 0.9), p9 = run("probe", 0.9);
    const top = p9.miss;
    return { verdict: T("50% full: finding a key takes " + n2(c5.avg) + " checks with chaining, " + n2(p5.avg) + " with linear probing. 90% full: chaining " + n2(c9.avg) + ", probing " + n2(p9.avg) + "; a missing key costs " + n2(c9.miss) + " vs " + n2(p9.miss) + ", and the longest run of full slots is " + big(p9.longest) + " (longest chain: " + n0(c9.longest) + ").",
        "Al 50%: encontrar una clave cuesta " + n2(c5.avg) + " revisiones con encadenamiento y " + n2(p5.avg) + " con sondeo lineal. Al 90%: encadenamiento " + n2(c9.avg) + ", sondeo " + n2(p9.avg) + "; una clave que no está cuesta " + n2(c9.miss) + " contra " + n2(p9.miss) + ", y el tramo más largo de casillas llenas es de " + big(p9.longest) + " (cadena más larga: " + n0(c9.longest) + ")."),
      bars: [[T("Find a key, chaining, 90%", "Encontrar, encadenamiento, 90%"), c9.avg / top, n2(c9.avg)], [T("Find a key, probing, 90%", "Encontrar, sondeo, 90%"), p9.avg / top, n2(p9.avg), true], [T("Missing key, chaining, 90%", "No está, encadenamiento, 90%"), c9.miss / top, n2(c9.miss)], [T("Missing key, probing, 90%", "No está, sondeo, 90%"), 1, n2(p9.miss), true]] };
  },
  flood: () => {
    const keys = attackKeys(1000, 1);
    const fx = fill({ hash: "fixed" }, keys);
    const sd = mean((s) => fill({ hash: "seeded", seed: s }, keys));
    const nm = mean((s) => fill({ hash: "fixed" }, userKeys(1000, s)));
    return { verdict: T("Crafted keys, fixed hash: " + big(fx.work) + " compares and moves to insert 1,000 keys, all in one bucket. Ordinary ids, same hash: " + big(nm.work) + " (" + Math.round(fx.work / nm.work) + "× less). The crafted keys against the seeded hash: " + big(sd.work) + ", longest chain " + n0(sd.longest) + ".",
        "Claves fabricadas, hash fijo: " + big(fx.work) + " comparaciones y movimientos para insertar 1,000 claves, todas en una cubeta. IDs normales, mismo hash: " + big(nm.work) + " (" + Math.round(fx.work / nm.work) + " veces menos). Las claves fabricadas contra el hash con semilla: " + big(sd.work) + ", cadena más larga de " + n0(sd.longest) + "."),
      bars: [[T("Ordinary ids, fixed hash", "IDs normales, hash fijo"), nm.work / fx.work, big(nm.work)], [T("Crafted keys, fixed hash", "Claves fabricadas, hash fijo"), 1, big(fx.work), true], [T("Crafted keys, seeded hash", "Claves fabricadas, hash con semilla"), sd.work / fx.work, big(sd.work)]] };
  },
};
WB.experiments({ list: ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))}, runs: RUNS, watch: (exp) => {
  for (const [name, value] of Object.entries(exp.watch)) set(name, value, true);
  cycle = 0; reset();
  if (loop.paused) loop.setPaused(false);
} });

loop.setPaused(loop.paused);
reset();
`;

const size = writePage(new URL("./hash-table-workbench.html", import.meta.url), {
  title: t("Hash Table Workbench", "Banco de trabajo: tablas hash"),
  eyebrow: t("Systems lesson 40 · Hash tables", "Lección de sistemas 40 · Tablas hash"),
  lede: t("A hash table turns a key into a bucket number, so finding the key takes a jump instead of a search. That's behind every dictionary, map, set, cache and database index on hashes, and it stays fast only while keys spread out and buckets stay uncrowded. This lesson builds a hash table as a rack of trays: watch it, predict what it does, then explain it back.",
    "Una tabla hash convierte una clave en un número de cubeta, así que encontrar la clave cuesta un salto en lugar de una búsqueda. Está detrás de cada diccionario, map, set, caché e índice hash de una base de datos, y se mantiene rápida solo mientras las claves se reparten y las cubetas no se llenan demasiado. Esta lección arma una tabla hash como un casillero de bandejas: mírala, predice qué hace y después explícalo."),
  machine: {
    intro: t("Keys go in one at a time and some are looked up again. Switch to the weak hash and watch every key pile into one tray; turn resizing off and let the piles grow; try linear probing and watch keys spill into neighbouring trays; send keys crafted to collide, then seed the hash.",
      "Las claves entran de a una y algunas se vuelven a buscar. Cambia al hash débil y mira cómo todas las claves se apilan en una bandeja; apaga el redimensionamiento y deja que las pilas crezcan; prueba el sondeo lineal y mira cómo las claves se desbordan a las bandejas vecinas; envía claves hechas para colisionar y después ponle semilla al hash."),
    figure, panel: controls,
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, at a bigger scale (1,000 keys or more), averaged over six seeded runs where the keys are random.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, a mayor escala (1,000 claves o más), promediados sobre seis ejecuciones con semilla fija cuando las claves son aleatorias."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; the hash is FNV-1a with a MurmurHash3 finaliser. Hash flooding: Klink and Wälde, <a href="https://fahrplan.events.ccc.de/congress/2011/Fahrplan/events/4680.en.html" target="_blank" rel="noopener">Efficient Denial of Service Attacks on Web Application Platforms</a> (28C3, 2011).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; el hash es FNV-1a con el finalizador de MurmurHash3. Hash flooding: Klink y Wälde, <a href="https://fahrplan.events.ccc.de/congress/2011/Fahrplan/events/4680.en.html" target="_blank" rel="noopener">Efficient Denial of Service Attacks on Web Application Platforms</a> (28C3, 2011).`),
  css,
  script: live,
});
console.log("wrote hash-table-workbench.html", (size / 1024).toFixed(0) + " KB");
