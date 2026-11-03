// @ts-nocheck: content ported as-is
// Systems lesson 40 · Hash tables: a hash table as a pigeonhole rack.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, int } from "../../lib/format";
import { buildFigure, P, GEOM, COUNTERS } from "./figure";
import { nogrowRun, weakRun, resizeRun, probeRun, floodRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const RESULTS = { nogrow: nogrowRun(), weak: weakRun(), resize: resizeRun(), probe: probeRun(), flood: floodRun() };

// What each card shows after a run (six seeds where keys are random).
const n2 = (x) => x.toFixed(x < 10 ? 1 : 0);
const RUNS = {
  nogrow: () => {
    const { a, b, c } = RESULTS.nogrow;
    const top = Math.max(b.worst, 1);
    return { verdict: t("64 keys in 64 buckets: " + n2(a.avg) + " compares per lookup on average. 1,024 keys in the same 64 buckets: " + n2(b.avg) + " on average, " + n2(b.worst) + " for the unluckiest key (" + n2(b.avg / a.avg) + "× slower). Growing at 75% instead: " + n2(c.avg) + ".",
        "64 claves en 64 cubetas: " + n2(a.avg) + " comparaciones por búsqueda en promedio. 1,024 claves en las mismas 64 cubetas: " + n2(b.avg) + " en promedio y " + n2(b.worst) + " para la clave más desafortunada (" + n2(b.avg / a.avg) + " veces más lento). Creciendo al 75% en su lugar: " + n2(c.avg) + "."),
      bars: [[t("64 keys, load 1", "64 claves, carga 1"), a.avg / top, n2(a.avg)], [t("1,024 keys, load 16", "1,024 claves, carga 16"), b.avg / top, n2(b.avg), true], [t("Worst key, load 16", "Peor clave, carga 16"), b.worst / top, n2(b.worst), true], [t("1,024 keys, doubling", "1,024 claves, duplicando"), c.avg / top, n2(c.avg)]] };
  },
  weak: () => {
    const { g, w } = RESULTS.weak;
    return { verdict: t("Good hash: " + int(g.used) + " of " + int(g.m) + " buckets in use, longest chain " + n0(g.longest) + ", " + n2(g.avg) + " compares per lookup. First 4 characters: " + int(w.used) + " bucket in use, one chain of " + int(w.longest) + " keys, " + n2(w.avg) + " compares per lookup, in a table that still doubled to " + int(w.m) + " buckets.",
        "Buen hash: " + int(g.used) + " de " + int(g.m) + " cubetas en uso, cadena más larga de " + n0(g.longest) + ", " + n2(g.avg) + " comparaciones por búsqueda. Primeros 4 caracteres: " + int(w.used) + " cubeta en uso, una cadena de " + int(w.longest) + " claves, " + n2(w.avg) + " comparaciones por búsqueda, en una tabla que igual se duplicó a " + int(w.m) + " cubetas."),
      bars: [[t("Compares per lookup, good hash", "Comparaciones por búsqueda, buen hash"), g.avg / w.avg, n2(g.avg)], [t("Compares per lookup, weak hash", "Comparaciones por búsqueda, hash débil"), 1, n2(w.avg), true], [t("Buckets in use, good hash", "Cubetas en uso, buen hash"), g.used / g.m, int(g.used)], [t("Buckets in use, weak hash", "Cubetas en uso, hash débil"), w.used / w.m, int(w.used), true]] };
  },
  resize: () => {
    const { d, a } = RESULTS.resize;
    const per = d.moved / 1000, perA = a.moved / 1000;
    return { verdict: t("Doubling: " + d.resizes + " resizes, " + int(d.moved) + " keys moved in all, " + per.toFixed(2) + " moves per insert; the biggest single insert moved " + int(d.biggest) + " keys. Adding 8 buckets: " + int(a.resizes) + " resizes, " + int(a.moved) + " moves, " + perA.toFixed(0) + " per insert.",
        "Duplicando: " + d.resizes + " redimensionamientos, " + int(d.moved) + " claves movidas en total, " + per.toFixed(2) + " movimientos por inserción; la inserción individual más cara movió " + int(d.biggest) + " claves. Sumando 8 cubetas: " + int(a.resizes) + " redimensionamientos, " + int(a.moved) + " movimientos, " + perA.toFixed(0) + " por inserción."),
      bars: [[t("Moves per insert, doubling", "Movimientos por inserción, duplicando"), per / perA, per.toFixed(2), true], [t("Moves per insert, +8 buckets", "Movimientos por inserción, +8 cubetas"), 1, perA.toFixed(0)], [t("Biggest single insert, doubling", "Inserción más cara, duplicando"), d.biggest / 1000, int(d.biggest)]] };
  },
  probe: () => {
    const { c5, p5, c9, p9 } = RESULTS.probe;
    const top = p9.miss;
    return { verdict: t("50% full: finding a key takes " + n2(c5.avg) + " checks with chaining, " + n2(p5.avg) + " with linear probing. 90% full: chaining " + n2(c9.avg) + ", probing " + n2(p9.avg) + "; a missing key costs " + n2(c9.miss) + " vs " + n2(p9.miss) + ", and the longest run of full slots is " + int(p9.longest) + " (longest chain: " + n0(c9.longest) + ").",
        "Al 50%: encontrar una clave cuesta " + n2(c5.avg) + " revisiones con encadenamiento y " + n2(p5.avg) + " con sondeo lineal. Al 90%: encadenamiento " + n2(c9.avg) + ", sondeo " + n2(p9.avg) + "; una clave que no está cuesta " + n2(c9.miss) + " contra " + n2(p9.miss) + ", y el tramo más largo de casillas llenas es de " + int(p9.longest) + " (cadena más larga: " + n0(c9.longest) + ")."),
      bars: [[t("Find a key, chaining, 90%", "Encontrar, encadenamiento, 90%"), c9.avg / top, n2(c9.avg)], [t("Find a key, probing, 90%", "Encontrar, sondeo, 90%"), p9.avg / top, n2(p9.avg), true], [t("Missing key, chaining, 90%", "No está, encadenamiento, 90%"), c9.miss / top, n2(c9.miss)], [t("Missing key, probing, 90%", "No está, sondeo, 90%"), 1, n2(p9.miss), true]] };
  },
  flood: () => {
    const { fx, sd, nm } = RESULTS.flood;
    return { verdict: t("Crafted keys, fixed hash: " + int(fx.work) + " compares and moves to insert 1,000 keys, all in one bucket. Ordinary ids, same hash: " + int(nm.work) + " (" + Math.round(fx.work / nm.work) + "× less). The crafted keys against the seeded hash: " + int(sd.work) + ", longest chain " + n0(sd.longest) + ".",
        "Claves fabricadas, hash fijo: " + int(fx.work) + " comparaciones y movimientos para insertar 1,000 claves, todas en una cubeta. IDs normales, mismo hash: " + int(nm.work) + " (" + Math.round(fx.work / nm.work) + " veces menos). Las claves fabricadas contra el hash con semilla: " + int(sd.work) + ", cadena más larga de " + n0(sd.longest) + "."),
      bars: [[t("Ordinary ids, fixed hash", "IDs normales, hash fijo"), nm.work / fx.work, int(nm.work)], [t("Crafted keys, fixed hash", "Claves fabricadas, hash fijo"), 1, int(fx.work), true], [t("Crafted keys, seeded hash", "Claves fabricadas, hash con semilla"), sd.work / fx.work, int(sd.work)]] };
  },
};

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

export default defineLesson({
  title: t("Hash Table Workbench", "Banco de trabajo: tablas hash"),
  eyebrow: t("Systems lesson 40 · Hash tables", "Lección de sistemas 40 · Tablas hash"),
  lede: t("A hash table turns a key into a bucket number, so finding the key takes a jump instead of a search. That's behind every dictionary, map, set, cache and database index on hashes, and it stays fast only while keys spread out and buckets stay uncrowded. This lesson builds a hash table as a rack of trays: watch it, predict what it does, then explain it back.",
    "Una tabla hash convierte una clave en un número de cubeta, así que encontrar la clave cuesta un salto en lugar de una búsqueda. Está detrás de cada diccionario, map, set, caché e índice hash de una base de datos, y se mantiene rápida solo mientras las claves se reparten y las cubetas no se llenan demasiado. Esta lección arma una tabla hash como un casillero de bandejas: mírala, predice qué hace y después explícalo."),
  machine: {
    intro: t("Keys go in one at a time and some are looked up again. Switch to the weak hash and watch every key pile into one tray; turn resizing off and let the piles grow; try linear probing and watch keys spill into neighbouring trays; send keys crafted to collide, then seed the hash.",
      "Las claves entran de a una y algunas se vuelven a buscar. Cambia al hash débil y mira cómo todas las claves se apilan en una bandeja; apaga el redimensionamiento y deja que las pilas crezcan; prueba el sondeo lineal y mira cómo las claves se desbordan a las bandejas vecinas; envía claves hechas para colisionar y después ponle semilla al hash."),
    plate: {
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
      stage: { "data-hashtable": "" },
      label: t("Hash table simulation. Space pauses or resumes.", "Simulación de una tabla hash. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["keys", t("Keys", "Claves")], ["buckets", t("Buckets", "Cubetas"), "8"], ["load", t("Load factor", "Factor de carga"), "–"], ["last", t("Probes, last operation", "Sondeos, última operación"), "–"], ["avg", t("Average probes to find a key", "Sondeos promedio para encontrar una clave"), "–"], ["longest", t("Longest chain or run", "Cadena o tramo más largo")], ["moved", t("Keys moved by resizing", "Claves movidas al redimensionar")]],
    controls: [
      { seg: "hash", label: t("Hash", "Hash"), options: [["seeded", t("Seeded", "Con semilla")], ["fixed", t("Fixed, no seed", "Fijo, sin semilla")], ["weak", t("First 4 characters", "Primeros 4 caracteres")]], value: "seeded" },
      { seg: "keys", label: t("Keys", "Claves"), options: [["random", t("User ids", "IDs de usuario")], ["attack", t("Crafted to collide", "Hechas para colisionar")]], value: "random" },
      { seg: "mode", label: t("Collisions", "Colisiones"), options: [["chain", t("Chaining", "Encadenamiento")], ["probe", t("Linear probing", "Sondeo lineal")]], value: "chain" },
      { seg: "grow", label: t("Resize", "Redimensionar"), options: [["on", t("Double at 75%", "Duplicar al 75%")], ["off", t("Never", "Nunca")]], value: "on" },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, at a bigger scale (1,000 keys or more), averaged over six seeded runs where the keys are random.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, a mayor escala (1,000 claves o más), promediados sobre seis ejecuciones con semilla fija cuando las claves son aleatorias."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; the hash is FNV-1a with a MurmurHash3 finaliser. Hash flooding: Klink and Wälde, <a href="https://fahrplan.events.ccc.de/congress/2011/Fahrplan/events/4680.en.html" target="_blank" rel="noopener">Efficient Denial of Service Attacks on Web Application Platforms</a> (28C3, 2011).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; el hash es FNV-1a con el finalizador de MurmurHash3. Hash flooding: Klink y Wälde, <a href="https://fahrplan.events.ccc.de/congress/2011/Fahrplan/events/4680.en.html" target="_blank" rel="noopener">Efficient Denial of Service Attacks on Web Application Platforms</a> (28C3, 2011).`),
  css: `
[data-hashtable] [data-keycard] .iso-face-text,[data-hashtable] [data-more] .iso-face-text{fill:var(--anatomy-strong)}
[data-hashtable] [data-more] .iso-face-text{font-weight:600}
`,
  data: {
    P,
    G: GEOM,
    COUNTERS,
  },
});
