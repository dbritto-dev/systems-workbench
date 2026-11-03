// @ts-nocheck: content ported as-is
// Systems lesson 27 · N+1 queries: a warehouse picker filling one page of orders, one trip per query.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, pickerSvg, cargoSvg, P, GEOMETRY } from "./figure";
import { average, kb } from "./sim";
import { int, oneUnder10 } from "../../lib/format";

// What each card shows after a run: the same seeded pages the machine plays, averaged at build time.
const one = oneUnder10;
const base = { mode: "n1", rows: 20, items: 5, nested: false, dist: "region" };
const RUNS = {
  distance: () => {
    const h = average({ ...base, dist: "host" }), z = average({ ...base, dist: "zone" }), r = average(base);
    return { verdict: t("Same 21 queries and " + kb(r.bytes) + " each time: " + one(h.time) + " ms on the same host, " + one(z.time) + " ms in the same zone, " + one(r.time) + " ms in another zone.",
        "Las mismas 21 consultas y " + kb(r.bytes) + " cada vez: " + one(h.time) + " ms en el mismo host, " + one(z.time) + " ms en la misma zona, " + one(r.time) + " ms en otra zona."),
      bars: [[t("Same host", "Mismo host"), h.time / r.time, one(h.time) + " ms"], [t("Same zone", "Misma zona"), z.time / r.time, one(z.time) + " ms"], [t("Other zone", "Otra zona"), 1, one(r.time) + " ms", true]] };
  },
  rows: () => {
    const n20 = average(base), n50 = average({ ...base, rows: 50 }), b20 = average({ ...base, mode: "batch" }), b50 = average({ ...base, mode: "batch", rows: 50 }), top = n50.time;
    return { verdict: t("N+1: " + one(n20.time) + " → " + one(n50.time) + " ms (" + n20.queries + " → " + n50.queries + " queries). Batched: " + one(b20.time) + " → " + one(b50.time) + " ms, 2 queries both times.",
        "N+1: " + one(n20.time) + " → " + one(n50.time) + " ms (" + n20.queries + " → " + n50.queries + " consultas). Por lotes: " + one(b20.time) + " → " + one(b50.time) + " ms, 2 consultas las dos veces."),
      bars: [[t("N+1, 20 orders", "N+1, 20 pedidos"), n20.time / top, one(n20.time) + " ms"], [t("N+1, 50 orders", "N+1, 50 pedidos"), 1, one(n50.time) + " ms", true], [t("Batched, 20 orders", "Por lotes, 20 pedidos"), b20.time / top, one(b20.time) + " ms"], [t("Batched, 50 orders", "Por lotes, 50 pedidos"), b50.time / top, one(b50.time) + " ms", true]] };
  },
  nested: () => {
    const flat = average(base), deep = average({ ...base, nested: true }), batch = average({ ...base, nested: true, mode: "batch" }), top = deep.time;
    return { verdict: t("With products: " + deep.queries + " queries and " + one(deep.time) + " ms per page (it was " + flat.queries + " queries, " + one(flat.time) + " ms). Batched per level: " + batch.queries + " queries, " + one(batch.time) + " ms.",
        "Con productos: " + deep.queries + " consultas y " + one(deep.time) + " ms por página (antes eran " + flat.queries + " consultas, " + one(flat.time) + " ms). Por lotes en cada nivel: " + batch.queries + " consultas, " + one(batch.time) + " ms."),
      bars: [[t("N+1, orders and items", "N+1, pedidos y artículos"), flat.time / top, t(flat.queries + " queries · " + one(flat.time) + " ms", flat.queries + " consultas · " + one(flat.time) + " ms")], [t("N+1, with products", "N+1, con productos"), 1, t(deep.queries + " queries · " + one(deep.time) + " ms", deep.queries + " consultas · " + one(deep.time) + " ms"), true], [t("Batched, with products", "Por lotes, con productos"), batch.time / top, t(batch.queries + " queries · " + one(batch.time) + " ms", batch.queries + " consultas · " + one(batch.time) + " ms")]] };
  },
  join: () => {
    const big = { ...base, rows: 50, items: 50 };
    const j = average({ ...big, mode: "join" }), b = average({ ...big, mode: "batch" });
    const js = average({ ...base, mode: "join" }), bs = average({ ...base, mode: "batch" });
    const top = Math.max(j.time, b.time);
    return { verdict: t("50 × 50: the JOIN ships " + kb(j.bytes) + " in " + one(j.time) + " ms; batching ships " + kb(b.bytes) + " in " + one(b.time) + " ms. With 20 orders of 5 items the JOIN wins instead: " + one(js.time) + " ms vs " + one(bs.time) + " ms.",
        "50 × 50: el JOIN envía " + kb(j.bytes) + " en " + one(j.time) + " ms; por lotes se envían " + kb(b.bytes) + " en " + one(b.time) + " ms. Con 20 pedidos de 5 artículos, en cambio, gana el JOIN: " + one(js.time) + " ms vs " + one(bs.time) + " ms."),
      bars: [[t("JOIN, 1 query", "JOIN, 1 consulta"), j.time / top, one(j.time) + " ms · " + kb(j.bytes)], [t("Batched, 2 queries", "Por lotes, 2 consultas"), b.time / top, one(b.time) + " ms · " + kb(b.bytes), true]] };
  },
  parallel: () => {
    const n = average(base), p = average({ ...base, mode: "par" }), b = average({ ...base, mode: "batch" }), top = n.time;
    return { verdict: t("One by one: " + one(n.time) + " ms. Five at a time: " + one(p.time) + " ms. Batched: " + one(b.time) + " ms. Queries per page: " + n.queries + ", " + p.queries + " and " + b.queries + ": at 200 pages a second that is " + int(p.queries * 200) + " vs " + (b.queries * 200) + " queries a second.",
        "Una por una: " + one(n.time) + " ms. Cinco a la vez: " + one(p.time) + " ms. Por lotes: " + one(b.time) + " ms. Consultas por página: " + n.queries + ", " + p.queries + " y " + b.queries + ": a 200 páginas por segundo eso son " + int(p.queries * 200) + " vs " + (b.queries * 200) + " consultas por segundo."),
      bars: [[t("One by one", "Una por una"), 1, t(one(n.time) + " ms · " + n.queries + " queries", one(n.time) + " ms · " + n.queries + " consultas")], [t("5 at once", "5 a la vez"), p.time / top, t(one(p.time) + " ms · " + p.queries + " queries", one(p.time) + " ms · " + p.queries + " consultas"), true], [t("Batched", "Por lotes"), b.time / top, t(one(b.time) + " ms · " + b.queries + " queries", one(b.time) + " ms · " + b.queries + " consultas")]] };
  },
};

const EXPERIMENTS = [
  {
    id: "distance",
    title: t("The database moves away", "La base de datos se aleja"),
    change: t("N+1 · 20 orders, 5 items each · database on the same host (0.2 ms round trip) → in another zone (10 ms)", "N+1 · 20 pedidos, 5 artículos cada uno · base de datos en el mismo host (0.2 ms de ida y vuelta) → en otra zona (10 ms)"),
    question: t("The page runs the same 21 queries and fetches the same 28 KB. How long does it take now?", "La página ejecuta las mismas 21 consultas y trae los mismos 28 KB. ¿Cuánto tarda ahora?"),
    options: [t("About the same: the data hasn't changed", "Más o menos lo mismo: los datos no cambiaron"), t("About 10 ms longer: one extra round trip", "Unos 10 ms más: un viaje de ida y vuelta extra"), t("Over 200 ms: every one of the 21 queries pays the trip", "Más de 200 ms: cada una de las 21 consultas paga el viaje")],
    answer: 2,
    why: t("Each query waits for a full round trip before the next one starts, so the page costs about 21 × the round trip. On your laptop the trip is a fraction of a millisecond and the N+1 hides; in production, with the database a zone away, the same code is twenty times slower. The bytes barely matter: the trips do.", "Cada consulta espera un viaje de ida y vuelta completo antes de que empiece la siguiente, así que la página cuesta unas 21 × el viaje. En tu laptop el viaje es una fracción de milisegundo y el N+1 se esconde; en producción, con la base de datos a una zona de distancia, el mismo código es veinte veces más lento. Los bytes casi no importan: importan los viajes."),
    watch: { mode: "n1", rows: 20, items: 5, nested: "off", dist: "region" },
  },
  {
    id: "rows",
    title: t("A bigger page", "Una página más grande"),
    change: t("Database in another zone · orders per page 20 → 50 · N+1 vs batched (one IN query for all the items)", "Base de datos en otra zona · pedidos por página 20 → 50 · N+1 vs por lotes (una consulta IN para todos los artículos)"),
    question: t("How does the page time change for each?", "¿Cómo cambia el tiempo de página en cada caso?"),
    options: [t("Both get about 2.5× slower", "Los dos se vuelven unas 2.5× más lentos"), t("N+1 gets about 2.5× slower; batched barely moves", "N+1 se vuelve unas 2.5× más lento; por lotes casi no se mueve"), t("Batched gets slower too, because its one query is bigger", "Por lotes también se vuelve más lento, porque su única consulta es más grande")],
    answer: 1,
    why: t("N+1 runs one query per order, so its trips, and its time, grow with the page: 21 trips become 51. The batched page always runs two queries (the orders, then every item WHERE order_id IN (...)), whatever the page size. Its second query returns more rows, but shipping a few more kilobytes costs far less than thirty more round trips.", "N+1 ejecuta una consulta por pedido, así que sus viajes, y su tiempo, crecen con la página: 21 viajes pasan a ser 51. La página por lotes siempre ejecuta dos consultas (los pedidos, y después todos los artículos WHERE order_id IN (...)), sin importar el tamaño de la página. Su segunda consulta devuelve más filas, pero enviar unos kilobytes más cuesta mucho menos que treinta viajes de ida y vuelta más."),
    watch: { mode: "n1", rows: 50, items: 5, nested: "off", dist: "region" },
  },
  {
    id: "nested",
    title: t("One more level", "Un nivel más"),
    change: t("N+1 · 20 orders, 5 items each · the page now also shows each item's product, loaded the same lazy way", "N+1 · 20 pedidos, 5 artículos cada uno · ahora la página también muestra el producto de cada artículo, con la misma carga diferida (lazy loading)"),
    question: t("How many queries does one page run now?", "¿Cuántas consultas ejecuta ahora una página?"),
    options: [t("22: one more query for the products", "22: una consulta más para los productos"), t("41: one more per order", "41: una más por pedido"), t("121: one per order, plus one per item", "121: una por pedido, más una por artículo")],
    answer: 2,
    why: t("Lazy loading nests: 1 query for the orders, 20 for their items, then one for each of the 100 items' products. That is N + N×M + 1. With the database in another zone the page now takes over a second. Batching each level keeps it at 3 queries: orders, items IN (...), products IN (...).", "La carga diferida se anida: 1 consulta para los pedidos, 20 para sus artículos y después una para el producto de cada uno de los 100 artículos. Eso es N + N×M + 1. Con la base de datos en otra zona, la página ahora tarda más de un segundo. Agrupar cada nivel en lotes la deja en 3 consultas: pedidos, artículos IN (...), productos IN (...)."),
    watch: { mode: "n1", rows: 20, items: 5, nested: "on", dist: "region" },
  },
  {
    id: "join",
    title: t("JOIN or batch?", "¿JOIN o lotes?"),
    change: t("Database in another zone · 50 orders with 50 items each · one JOIN (orders × items) vs two batched queries", "Base de datos en otra zona · 50 pedidos con 50 artículos cada uno · un JOIN (pedidos × artículos) vs dos consultas por lotes"),
    question: t("Which loads the page faster?", "¿Cuál carga la página más rápido?"),
    options: [t("The JOIN: one round trip always wins", "El JOIN: un solo viaje de ida y vuelta siempre gana"), t("Batching: the JOIN repeats every order's columns on each of its 2,500 rows, so it ships far more data", "Por lotes: el JOIN repite las columnas de cada pedido en cada una de sus 2,500 filas, así que envía muchos más datos"), t("The same: the same data comes back either way", "Igual: de cualquier forma vuelven los mismos datos")],
    answer: 1,
    why: t("A JOIN returns one row per order-item pair, and each of those rows carries the whole order again. With 50 items per order that is 2,500 copies of 800-byte orders: over 2 MB instead of about 340 KB, so the wire time outweighs the round trip it saved. With few children per order (5, say) the JOIN wins. For one-to-many with many children, batch; for one-to-one or few, join.", "Un JOIN devuelve una fila por cada par pedido-artículo, y cada una de esas filas vuelve a traer el pedido completo. Con 50 artículos por pedido son 2,500 copias de pedidos de 800 bytes: más de 2 MB en lugar de unos 340 KB, así que el tiempo en la red pesa más que el viaje de ida y vuelta que se ahorró. Con pocos hijos por pedido (5, por ejemplo) gana el JOIN. Para uno a muchos con muchos hijos, usa lotes; para uno a uno o pocos hijos, usa JOIN."),
    watch: { mode: "join", rows: 50, items: 50, nested: "off", dist: "region" },
  },
  {
    id: "parallel",
    title: t("Fire them all at once", "Lánzalas todas a la vez"),
    change: t("Database in another zone · 20 orders · the 20 item queries run 5 at a time on a connection pool, instead of one by one", "Base de datos en otra zona · 20 pedidos · las 20 consultas de artículos corren de 5 en 5 en un pool de conexiones, en lugar de una por una"),
    question: t("Compared with batching the items into one query…", "Comparado con agrupar los artículos en una sola consulta…"),
    options: [t("Just as good: the page is as fast as the batched one", "Igual de bueno: la página es tan rápida como la de lotes"), t("Faster than one by one, still slower than batching, and the database still runs 21 queries for every page", "Más rápido que una por una, todavía más lento que por lotes, y la base de datos sigue ejecutando 21 consultas por cada página"), t("Slower than one by one, because of the pool", "Más lento que una por una, por culpa del pool")],
    answer: 1,
    why: t("Running the queries in parallel hides some of the waiting: four waves of five trips instead of twenty in a row. But the page still needs those waves, it holds five connections while it runs, and the database still parses, plans and runs 21 queries per page instead of 2. At a few hundred pages a second that is thousands of extra queries a second. Batching fixes the cause; parallelism only hides the latency.", "Ejecutar las consultas en paralelo oculta parte de la espera: cuatro oleadas de cinco viajes en lugar de veinte seguidos. Pero la página todavía necesita esas oleadas, ocupa cinco conexiones mientras corre, y la base de datos todavía analiza, planifica y ejecuta 21 consultas por página en lugar de 2. A unos cientos de páginas por segundo, eso son miles de consultas extra por segundo. Los lotes arreglan la causa; el paralelismo solo oculta la latencia."),
    watch: { mode: "par", rows: 20, items: 5, nested: "off", dist: "region" },
  },
];

const QUESTIONS = [
  [t("Your list page is fast on your laptop and slow in staging. The query log shows the same SELECT many times with different ids. What is going on?", "Tu página de listado es rápida en tu laptop y lenta en staging. El log de consultas muestra el mismo SELECT muchas veces con ids distintos. ¿Qué está pasando?"),
    t("An N+1: one query for the list, then one per row for its related data. Locally each round trip costs a fraction of a millisecond, so 51 queries feel free; in staging the database is a network hop away and the page pays the round trip 51 times, one after another.", "Un N+1: una consulta para la lista y después una por fila para sus datos relacionados. En local cada viaje de ida y vuelta (round trip) cuesta una fracción de milisegundo, así que 51 consultas parecen gratis; en staging la base de datos está a un salto de red y la página paga el viaje 51 veces, una tras otra.")],
  [t("How would you catch N+1s before production?", "¿Cómo detectarías los N+1 antes de producción?"),
    t("Count queries per request: turn on ORM query logging, look at the span list in your APM or tracing (a long ladder of identical spans is the signature), and add tests that assert the query count for key endpoints so it can't silently grow with the data.", "Cuenta las consultas por solicitud: activa el log de consultas del ORM, mira la lista de spans en tu APM o tu tracing (una escalera larga de spans idénticos es la firma) y agrega tests que verifiquen el número de consultas de los endpoints clave, para que no pueda crecer en silencio con los datos.")],
  [t("Why does an ORM make N+1 so easy to write?", "¿Por qué un ORM hace tan fácil escribir un N+1?"),
    t("Lazy relations look like plain attributes. `order.items` inside a loop or a template reads like a field access, but each first access runs a query. The code that triggers the queries (often a view or serializer) is far from the code that loaded the list.", "Las relaciones diferidas (lazy) parecen atributos normales. `order.items` dentro de un bucle o una plantilla se lee como el acceso a un campo, pero cada primer acceso ejecuta una consulta. El código que dispara las consultas (muchas veces una vista o un serializador) está lejos del código que cargó la lista.")],
  [t("JOIN, or a second query with IN (...)? How do you choose?", "¿JOIN o una segunda consulta con IN (...)? ¿Cómo eliges?"),
    t("A JOIN (eager load in one query) is great for one-to-one or a few children: one round trip, little repetition. For one-to-many with many children, the JOIN repeats the parent's columns on every child row and can multiply rows across several relations, so a separate IN (...) query per relation (prefetch) ships far less. Both are a constant number of queries per page.", "Un JOIN (carga anticipada en una sola consulta, eager loading) va muy bien para uno a uno o pocos hijos: un viaje de ida y vuelta, poca repetición. Para uno a muchos con muchos hijos, el JOIN repite las columnas del padre en cada fila hija y puede multiplicar las filas a través de varias relaciones, así que una consulta IN (...) aparte por relación (prefetch) envía mucho menos. Las dos opciones son un número constante de consultas por página.")],
  [t("In a GraphQL API every field resolver loads its own data. How does DataLoader prevent N+1 there?", "En una API GraphQL cada resolver de campo carga sus propios datos. ¿Cómo evita DataLoader el N+1 ahí?"),
    t("Resolvers ask the loader for one key each; the loader waits until the current tick ends, collects every key requested, and runs one batched query (WHERE id IN (...)). It also caches per request, so the same key is fetched once. N resolver calls become one query per relation per level.", "Cada resolver le pide al loader una clave; el loader espera a que termine el tick actual, junta todas las claves pedidas y ejecuta una consulta por lotes (WHERE id IN (...)). Además guarda en caché por solicitud, así que la misma clave se trae una sola vez. N llamadas a resolvers se vuelven una consulta por relación y por nivel.")],
  [t("Paging the list limits the damage. Why is it not a fix?", "Paginar la lista limita el daño. ¿Por qué no es una solución?"),
    t("A page of 20 bounds the queries to 21 instead of thousands, but the cost still grows with page size and nesting, and every page still pays 21 round trips. The goal is a constant number of queries per request, independent of how many rows are on the page.", "Una página de 20 limita las consultas a 21 en lugar de miles, pero el costo sigue creciendo con el tamaño de página y el anidamiento, y cada página sigue pagando 21 viajes de ida y vuelta. El objetivo es un número constante de consultas por solicitud, sin importar cuántas filas haya en la página.")],
];

export default defineLesson({
  title: t("N+1 Query Workbench", "Banco de trabajo: consultas N+1"),
  eyebrow: t("Systems lesson 27 · N+1 queries", "Lección de sistemas 27 · Consultas N+1"),
  lede: t("A list page runs one query for the list, then one more for each row's related data: N + 1 queries where 2 would do. Each is a round trip, so the page costs the number of rows times the distance to the database. This lesson shows it as a warehouse picker: watch the trips, predict what makes them worse, then explain it back.", "Una página de listado ejecuta una consulta para la lista y después una más para los datos relacionados de cada fila: N + 1 consultas donde bastarían 2. Cada una es un viaje de ida y vuelta (round trip), así que la página cuesta el número de filas por la distancia a la base de datos. Esta lección lo muestra como un preparador de pedidos en un almacén: mira los viajes, predice qué los empeora y después explícalo."),
  machine: {
    intro: t("One page of orders is loaded into the packing table. Count the trips, watch the milliseconds, then move the warehouse closer or further, add orders, and switch between N+1, five at once, batching and a JOIN.", "Una página de pedidos se carga en la mesa de empaque. Cuenta los viajes, mira los milisegundos y después acerca o aleja el almacén, agrega pedidos y cambia entre N+1, cinco a la vez, lotes y un JOIN."),
    plate: {
      title: t("Warehouse picker", "Preparador de pedidos"),
      keys: [
        { mark: "lit", label: t("Data on its way back; an order just completed; the warehouse serving", "Datos de regreso; un pedido recién completado; el almacén atendiendo") },
        { mark: "raised", label: t("Order tickets and their boxes, the picker, the warehouse", "Tickets de pedido y sus cajas, el preparador, el almacén") },
        { mark: "flat", label: t("The aisle: the network between the app and the database", "El pasillo: la red entre la app y la base de datos") },
      ],
      caption:
        t("The packing table is the app; the warehouse at the end of the aisle is the database, standing on the same host, in the same zone or in another zone. Every query is one trip: out with a slip (one id, or a list of ids for a batch), back with a box sized by the data in it. The first trip brings the order tickets; a box lands on a ticket when that order's items have arrived. The counters on the table's front count the queries and the milliseconds of this page; the stopwatch hand turns once every 250 ms, and the crate fills with the bytes fetched (marked at 10 KB, 100 KB and 1 MB).", "La mesa de empaque es la app; el almacén al final del pasillo es la base de datos, ubicada en el mismo host, en la misma zona o en otra zona. Cada consulta es un viaje: de ida con una nota (un id, o una lista de ids para un lote), de vuelta con una caja del tamaño de los datos que trae. El primer viaje trae los tickets de pedido; una caja cae sobre un ticket cuando llegan los artículos de ese pedido. Los contadores del frente de la mesa cuentan las consultas y los milisegundos de esta página; la aguja del cronómetro da una vuelta cada 250 ms, y el cajón se llena con los bytes traídos (con marcas en 10 KB, 100 KB y 1 MB)."),
      stage: { "data-warehouse-stage": "" },
      label: t("N+1 queries simulation. Space pauses or resumes.", "Simulación de consultas N+1. La barra espaciadora pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["queries", t("Queries this page", "Consultas de esta página")], ["time", t("Page time", "Tiempo de página")], ["last", t("Last full page", "Última página completa"), "–"], ["bytes", t("Data this page", "Datos de esta página")], ["perpage", t("Queries per page", "Consultas por página")], ["pages", t("Pages served", "Páginas servidas")]],
    controls: [
      { seg: "mode", label: t("Loading", "Carga"), options: [["n1", "N+1"], ["par", t("N+1, 5 at once", "N+1, 5 a la vez")], ["batch", t("Batch (IN)", "Lote (IN)")], ["join", "JOIN"]], value: "n1" },
      { seg: "rows", label: t("Orders per page", "Pedidos por página"), options: [[10, "10"], [20, "20"], [50, "50"]], value: 20 },
      { seg: "items", label: t("Items per order", "Artículos por pedido"), options: [[1, "1"], [5, "5"], [50, "50"]], value: 5 },
      { seg: "nested", label: t("Each item's product", "Producto de cada artículo"), options: [["off", t("Not shown", "No se muestra")], ["on", t("Shown too", "También se muestra")]], value: "off" },
      { seg: "dist", label: t("Database", "Base de datos"), options: [["host", t("Same host · 0.2 ms", "Mismo host · 0.2 ms")], ["zone", t("Same zone · 1 ms", "Misma zona · 1 ms")], ["region", t("Other zone · 10 ms", "Otra zona · 10 ms")]], value: "region" },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The machine runs 100× slower than real time: one millisecond of the page takes a tenth of a second here. Changing a setting starts a new page.", "La máquina corre 100× más lento que el tiempo real: aquí un milisegundo de la página tarda una décima de segundo. Cambiar un ajuste empieza una página nueva."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded pages.", "Cada experimento cambia una sola cosa. Elige qué esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho páginas con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: round trips, database time and wire time per query, with a little jitter.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección: viajes de ida y vuelta, tiempo de base de datos y tiempo en la red por consulta, con un poco de variación aleatoria.`),
  css: `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round}
.hand{fill:none;stroke:var(--anatomy-strong);stroke-width:1.4;stroke-linecap:round}
[data-slot][data-off]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
    PICKER_SVG: pickerSvg(),
    CARGO_SVG: cargoSvg(),
  },
});
