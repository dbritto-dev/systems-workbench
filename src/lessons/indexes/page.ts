// @ts-nocheck: content ported as-is
// Systems lesson 11 · Database indexes: a small library, its bookcases the table and its card catalogues the indexes.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, P, GEOMETRY } from "./figure";
import { choose, levels, scanCost, insertCost, insertReads } from "./sim";

// What each card shows after a run, worked out from the same cost model as the machine (sim.ts). "selective" is
// still answered by live.ts: its verdict formats a count with toLocaleString() and no locale, i.e. in the reader's
// locale, which the build can't reproduce.
const fmtMs = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : ms >= 10 ? ms.toFixed(0) + " ms" : ms.toFixed(1) + " ms");
const planNameT = (p) => (p.kind === "scan" ? t("Full scan", "Escaneo completo") : p.kind === "covering" ? t("Index only", "Solo índice") : t("Index + lookups", "Índice + búsquedas"));
const share = (v, top) => Math.max(0.01, Math.min(1, v / top));
const RUNS = {
  grow: () => {
    const s1 = scanCost(10000), s2 = scanCost(100000), i1 = choose("isbn", 10000, ["isbn"]).cost, i2 = choose("isbn", 100000, ["isbn"]).cost;
    return { verdict: t("Scan " + fmtMs(s1) + " → " + fmtMs(s2) + " (×" + (s2 / s1).toFixed(0) + "). Catalogue " + fmtMs(i1) + " → " + fmtMs(i2) + ": " + levels(10000) + " → " + levels(100000) + " drawer levels.",
        "Escaneo " + fmtMs(s1) + " → " + fmtMs(s2) + " (×" + (s2 / s1).toFixed(0) + "). Catálogo " + fmtMs(i1) + " → " + fmtMs(i2) + ": " + levels(10000) + " → " + levels(100000) + " niveles de cajón."),
      bars: [[t("Scan, 10,000", "Escaneo, 10,000"), share(s1, s2), fmtMs(s1)], [t("Scan, 100,000", "Escaneo, 100,000"), 1, fmtMs(s2)], [t("Index, 10,000", "Índice, 10,000"), share(i1, s2), fmtMs(i1)], [t("Index, 100,000", "Índice, 100,000"), share(i2, s2), fmtMs(i2), true]] };
  },
  writes: () => {
    const a = insertCost(100000, 1), b = insertCost(100000, 3);
    return { verdict: t("Adding a book " + fmtMs(a) + " → " + fmtMs(b) + " (" + insertReads(100000, 1) + " → " + insertReads(100000, 3) + " page writes): " + Math.round(1000 / a) + " → " + Math.round(1000 / b) + " books a second.",
        "Agregar un libro " + fmtMs(a) + " → " + fmtMs(b) + " (" + insertReads(100000, 1) + " → " + insertReads(100000, 3) + " escrituras de página): " + Math.round(1000 / a) + " → " + Math.round(1000 / b) + " libros por segundo."),
      bars: [[t("No catalogue", "Sin catálogo"), share(insertCost(100000, 0), b), fmtMs(insertCost(100000, 0))], [t("1 catalogue", "1 catálogo"), share(a, b), fmtMs(a)], [t("3 catalogues", "3 catálogos"), 1, fmtMs(b), true]] };
  },
  prefix: () => {
    const year = choose("year", 100000, ["authorYear"]), both = choose("authorYear", 100000, ["authorYear"]), author = choose("author", 100000, ["authorYear"]);
    return { verdict: t("Year only: " + planNameT(year).en.toLowerCase() + ", " + fmtMs(year.cost) + ". Author + year: " + fmtMs(both.cost) + ". Author only still uses it: " + fmtMs(author.cost) + ".",
        "Solo año: " + planNameT(year).es.toLowerCase() + ", " + fmtMs(year.cost) + ". Autor + año: " + fmtMs(both.cost) + ". Solo autor todavía lo usa: " + fmtMs(author.cost) + "."),
      bars: [[t("Author + year", "Autor + año"), share(both.cost, 100), fmtMs(both.cost)], [t("Author only", "Solo autor"), share(author.cost, 100), fmtMs(author.cost)], [t("Year only (scan)", "Solo año (escaneo)"), share(year.cost, 100), fmtMs(year.cost), true]] };
  },
  covering: () => {
    const plain = choose("titles", 100000, ["author"]), cover = choose("titles", 100000, ["authorTitle"]);
    return { verdict: t("Titles by one author: " + fmtMs(plain.cost) + " → " + fmtMs(cover.cost) + " (" + plain.shelfTrips + " shelf trips → none), " + (plain.cost / cover.cost).toFixed(0) + "× faster.",
        "Títulos de un autor: " + fmtMs(plain.cost) + " → " + fmtMs(cover.cost) + " (" + plain.shelfTrips + " viajes a estantes → ninguno), " + (plain.cost / cover.cost).toFixed(0) + "× más rápido."),
      bars: [[t("Author catalogue", "Catálogo por autor"), 1, fmtMs(plain.cost)], [t("Author + title", "Autor + título"), share(cover.cost, plain.cost), fmtMs(cover.cost), true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "grow",
    title: t("The table grows ten times", "La tabla crece diez veces"),
    change: t("10,000 → 100,000 rows · query ISBN = … · a catalogue on ISBN", "10,000 → 100,000 filas · consulta ISBN = … · un catálogo por ISBN"),
    question: t("A full scan gets about 10× slower. How much slower does the lookup through the ISBN catalogue get?", "Un escaneo completo (full scan) se vuelve unas 10× más lento. ¿Cuánto más lenta se vuelve la búsqueda con el catálogo por ISBN?"),
    options: [t("About 10× slower too", "También unas 10× más lenta"), t("Barely slower: one more drawer level", "Apenas más lenta: un nivel de cajón más"), t("It gets faster, the catalogue has more cards to choose from", "Se vuelve más rápida, el catálogo tiene más fichas para elegir")],
    answer: 1,
    why: t("A catalogue is a tree: each drawer level narrows the search 100 ways. 10,000 cards need 2 levels and 100,000 need 3, so the lookup only grows by one drawer read. A scan has no shortcut: ten times the rows is ten times the pages.", "Un catálogo es un árbol: cada nivel de cajones divide la búsqueda en 100. 10,000 fichas necesitan 2 niveles y 100,000 necesitan 3, así que la búsqueda solo crece en una lectura de cajón. Un escaneo no tiene atajo: diez veces las filas son diez veces las páginas."),
    watch: { rows: 100000, query: "isbn", on: ["isbn"], writes: false },
  },
  {
    id: "writes",
    title: t("A third catalogue", "Un tercer catálogo"),
    change: t("100,000 rows · catalogues: ISBN → ISBN, author, author + year · adding books", "100,000 filas · catálogos: ISBN → ISBN, autor, autor + año · agregando libros"),
    question: t("You add two more catalogues so more queries are fast. What happens to adding a new book?", "Agregas dos catálogos más para que más consultas sean rápidas. ¿Qué pasa al agregar un libro nuevo?"),
    options: [t("Nothing: catalogues only matter when you read", "Nada: los catálogos solo importan al leer"), t("It gets slower: the new book needs a card filed in every catalogue", "Se vuelve más lento: el libro nuevo necesita una ficha archivada en cada catálogo"), t("It gets faster: the catalogues say where to shelve it", "Se vuelve más rápido: los catálogos dicen dónde guardarlo")],
    answer: 1,
    why: t("Every catalogue has to stay in sync with the shelves, so every insert walks down each catalogue and files a card, and every update to an indexed column moves one. Indexes are paid for on every write, whether or not anyone runs the queries they help.", "Cada catálogo tiene que mantenerse sincronizado con los estantes, así que cada inserción recorre cada catálogo y archiva una ficha, y cada actualización de una columna indexada mueve una. Los índices se pagan en cada escritura, las use o no alguien en las consultas a las que ayudan."),
    watch: { rows: 100000, query: "isbn", on: ["isbn", "author", "authorYear"], writes: true },
  },
  {
    id: "prefix",
    title: t("The wrong end of a composite", "El extremo equivocado de un índice compuesto"),
    change: t("100,000 rows · one catalogue sorted by author, then year · query: year = 1969", "100,000 filas · un catálogo ordenado por autor y después por año · consulta: año = 1969"),
    question: t("The catalogue holds year on every card. What does the librarian do for a year-only search?", "El catálogo tiene el año en cada ficha. ¿Qué hace el bibliotecario para una búsqueda solo por año?"),
    options: [t("Use the catalogue: year is on the cards", "Usa el catálogo: el año está en las fichas"), t("Walk every shelf: the cards are sorted by author first", "Recorre todos los estantes: las fichas están ordenadas primero por autor"), t("Use the catalogue, but read only half of it", "Usa el catálogo, pero lee solo la mitad")],
    answer: 1,
    why: t("A composite index is sorted by its first column, then by the second within each first. Cards for 1969 are spread across every author, so there is no place to jump to. It helps queries on author, or author and year, but not year alone: the leftmost-prefix rule.", "Un índice compuesto está ordenado por su primera columna y, dentro de cada valor de la primera, por la segunda. Las fichas de 1969 están repartidas entre todos los autores, así que no hay un lugar al que saltar. Ayuda a las consultas por autor, o por autor y año, pero no solo por año: la regla del prefijo izquierdo (leftmost prefix)."),
    watch: { rows: 100000, query: "year", on: ["authorYear"], writes: false },
  },
  {
    id: "selective",
    title: t("An index on a yes/no column", "Un índice sobre una columna de sí/no"),
    change: t("100,000 rows · a catalogue on 'on loan' · 4 in 10 books are on loan", "100,000 filas · un catálogo por 'prestado' · 4 de cada 10 libros están prestados"),
    question: t("You ask for every book that is on loan. What does the planner choose?", "Pides todos los libros que están prestados. ¿Qué elige el planificador?"),
    options: [t("The catalogue: an index always beats a scan", "El catálogo: un índice siempre le gana a un escaneo"), t("A full scan: 40,000 separate shelf trips would cost far more", "Un escaneo completo: 40,000 viajes separados a los estantes costarían mucho más"), t("It refuses: the query matches too many rows", "Se niega: la consulta coincide con demasiadas filas")],
    answer: 1,
    why: t("An index pays one random trip to the shelf per matching row. When a large share of rows match, those trips cost far more than reading every page in order. Planners estimate this and pick the scan. Indexes pay off on selective filters: few rows out of many.", "Un índice paga un viaje aleatorio al estante por cada fila que coincide. Cuando coincide una gran parte de las filas, esos viajes cuestan mucho más que leer todas las páginas en orden. Los planificadores lo estiman y eligen el escaneo. Los índices valen la pena en filtros selectivos: pocas filas de entre muchas."),
    watch: { rows: 100000, query: "loan", on: ["loan"], writes: false },
  },
  {
    id: "covering",
    title: t("The title is on the card", "El título está en la ficha"),
    change: t("100,000 rows · titles by one author · catalogue on author → catalogue on author that also carries the title", "100,000 filas · títulos de un autor · catálogo por autor → catálogo por autor que también lleva el título"),
    question: t("How much does it help when the card already carries the title?", "¿Cuánto ayuda que la ficha ya lleve el título?"),
    options: [t("A little: the trolley still visits the shelves", "Un poco: el carrito sigue visitando los estantes"), t("A lot: no trips to the shelves at all", "Mucho: ningún viaje a los estantes"), t("Not at all: it still reads the same cards", "Nada: sigue leyendo las mismas fichas")],
    answer: 1,
    why: t("A plain index finds the 50 matching cards in a few drawer reads, then makes 50 trips to the shelves to read each title. When the card carries everything the query needs, the answer comes straight from the catalogue: an index-only scan. The price is a bigger catalogue that every write must also update.", "Un índice simple encuentra las 50 fichas que coinciden en unas pocas lecturas de cajón y después hace 50 viajes a los estantes para leer cada título. Cuando la ficha lleva todo lo que necesita la consulta, la respuesta sale directo del catálogo: un index-only scan. El precio es un catálogo más grande que cada escritura también tiene que actualizar."),
    watch: { rows: 100000, query: "titles", on: ["author"], writes: false, then: ["authorTitle"] },
  },
];

const QUESTIONS = [
  [t("A table grows from 1 million to 100 million rows. Why does a lookup by primary key barely slow down while a full scan gets 100 times slower?", "Una tabla crece de 1 millón a 100 millones de filas. ¿Por qué una búsqueda por clave primaria apenas se vuelve más lenta mientras que un escaneo completo se vuelve 100 veces más lento?"),
    t("The index is a B-tree: each level narrows the search by its fan-out (hundreds of keys per page), so the number of levels grows with the logarithm of the row count: maybe 3 levels become 4. A scan has to read every page, so its cost grows in direct proportion to the table.", "El índice es un árbol B (B-tree): cada nivel reduce la búsqueda según su grado de ramificación (fan-out, cientos de claves por página), así que el número de niveles crece con el logaritmo del número de filas: quizá 3 niveles pasan a ser 4. Un escaneo tiene que leer cada página, así que su costo crece en proporción directa a la tabla.")],
  [t("A write-heavy table already has eight indexes. What do you check before adding a ninth?", "Una tabla con muchas escrituras ya tiene ocho índices. ¿Qué revisas antes de agregar un noveno?"),
    t("Every insert, and every update that touches an indexed column, writes to every index, so writes slow down and the indexes take memory and disk. Check which queries the new index serves and how often, and whether an existing index could be extended instead. Find indexes nobody uses (in Postgres, idx_scan = 0 in pg_stat_user_indexes) and drop them.", "Cada inserción, y cada actualización que toca una columna indexada, escribe en todos los índices, así que las escrituras se vuelven más lentas y los índices ocupan memoria y disco. Revisa a qué consultas sirve el nuevo índice y con qué frecuencia, y si en su lugar podrías extender un índice existente. Busca los índices que nadie usa (en Postgres, idx_scan = 0 en pg_stat_user_indexes) y elimínalos.")],
  [t("You have an index on (author, year). Which of these can use it: author = ?, author = ? AND year = ?, year = ?, author = ? ORDER BY year?", "Tienes un índice sobre (author, year). ¿Cuáles de estas consultas pueden usarlo: author = ?, author = ? AND year = ?, year = ?, author = ? ORDER BY year?"),
    t("All except year = ? alone. A composite index is sorted by its first column, then the next, so it serves any query that fixes a leftmost prefix, and it can also return rows already ordered by the next column. For year alone you need a separate index on year, or one that starts with year.", "Todas menos year = ? sola. Un índice compuesto está ordenado por su primera columna y después por la siguiente, así que sirve a cualquier consulta que fije un prefijo izquierdo, y también puede devolver filas ya ordenadas por la siguiente columna. Para year sola necesitas un índice aparte sobre year, o uno que empiece por year.")],
  [t("The database ignores your index on status, which has four values. Why, and what would help?", "La base de datos ignora tu índice sobre status, que tiene cuatro valores. ¿Por qué, y qué ayudaría?"),
    t("Each value matches about a quarter of the table, and an index scan pays one random page read per matching row, so a sequential scan is cheaper and the planner picks it. If you only ever query a rare value (status = 'failed'), a partial index on just those rows is small and selective.", "Cada valor coincide con más o menos una cuarta parte de la tabla, y un escaneo por índice paga una lectura de página aleatoria por cada fila que coincide, así que un escaneo secuencial es más barato y el planificador lo elige. Si solo consultas un valor poco común (status = 'failed'), un índice parcial solo sobre esas filas es pequeño y selectivo.")],
  [t("What is a covering index, and what does it cost?", "¿Qué es un índice de cobertura (covering index) y cuánto cuesta?"),
    t("An index that holds every column a query reads, so the database answers from the index without visiting the table (an index-only scan; in Postgres, INCLUDE adds non-key columns). It costs a larger index and more work on every write, so use it for hot queries, not by default.", "Un índice que tiene todas las columnas que lee una consulta, así que la base de datos responde desde el índice sin visitar la tabla (un index-only scan; en Postgres, INCLUDE agrega columnas que no son clave). Cuesta un índice más grande y más trabajo en cada escritura, así que úsalo para consultas muy frecuentes, no por defecto.")],
  [t("How do you check whether a query uses an index, and whether that is the right plan?", "¿Cómo revisas si una consulta usa un índice, y si ese es el plan correcto?"),
    t("Run EXPLAIN (ANALYZE, BUFFERS) on it. Look for Seq Scan versus Index Scan or Index Only Scan, compare estimated and actual rows (bad estimates lead to bad plans), and look at the pages read. Then test with realistic data volumes: a plan on a small dev table can differ from production.", "Ejecuta EXPLAIN (ANALYZE, BUFFERS) sobre ella. Busca Seq Scan frente a Index Scan o Index Only Scan, compara las filas estimadas con las reales (malas estimaciones llevan a malos planes) y mira las páginas leídas. Después prueba con volúmenes de datos realistas: un plan sobre una tabla chica de desarrollo puede ser distinto del de producción.")],
];

export default defineLesson({
  title: t("Index Workbench", "Banco de trabajo: índices"),
  eyebrow: t("Systems lesson 11 · Database indexes", "Lección de sistemas 11 · Índices de bases de datos"),
  lede: t("An index is a second, sorted copy of a few columns that points back to the rows. It turns read-everything into look-it-up, and every write pays to keep it current. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.", "Un índice es una segunda copia ordenada de unas pocas columnas que apunta de vuelta a las filas. Convierte leerlo todo en buscarlo, y cada escritura paga por mantenerlo al día. Esta lección arma esa idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("The bookcases are the table, books in the order they arrived. Each catalogue cabinet is an index on one column. Pick a query and turn catalogues on or off: the trolley either walks every shelf, or reads a card in a drawer that names a shelf number and goes straight to that bookcase.", "Los estantes son la tabla, con los libros en el orden en que llegaron. Cada mueble de catálogo es un índice sobre una columna. Elige una consulta y activa o desactiva catálogos: el carrito o recorre todos los estantes, o lee en un cajón una ficha que dice un número de estante y va directo a ese estante."),
    plate: {
      title: t("Library", "Biblioteca"),
      keys: [
        { mark: "lit", label: t("The card being read, the numbered bookcase it points to, and the route and book", "La ficha que se está leyendo, el estante numerado al que apunta, y la ruta y el libro") },
        { mark: "raised", label: t("Bookcases 1–8: the table, books in the order they arrived", "Estantes 1–8: la tabla, con los libros en el orden en que llegaron") },
        { mark: "flat", label: t("Catalogue cabinets: one per index, the column engraved on the lid, cards sorted in the open drawer", "Muebles de catálogo: uno por índice, con la columna grabada en la tapa y las fichas ordenadas en el cajón abierto") },
      ],
      caption:
        t("The trolley either walks past every bookcase (a full scan: 0.1 ms per page of 100 books) or opens a catalogue drawer and goes straight to the shelf (0.4 ms per drawer level or shelf trip). The counter beside the shelves tallies books checked, drawer reads, shelf trips or cards filed. The stopwatch shows the time the reading takes, one turn per 10 ms; the machine runs 1,000 times slower than the model, and the walks between areas are not counted.", "El carrito o pasa por todos los estantes (un escaneo completo: 0.1 ms por página de 100 libros) o abre un cajón del catálogo y va directo al estante (0.4 ms por nivel de cajón o viaje a un estante). El contador junto a los estantes suma libros revisados, cajones leídos, viajes a estantes o fichas archivadas. El cronómetro muestra lo que tarda la lectura, una vuelta cada 10 ms; la máquina corre 1,000 veces más lento que el modelo, y los recorridos entre zonas no se cuentan."),
      stage: { "data-library": "" },
      label: t("Library simulation. Space pauses or resumes.", "Simulación de una biblioteca. La barra espaciadora pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["rows", t("Rows", "Filas"), "10,000"], ["plan", "Plan", "–"], ["time", t("Query time", "Tiempo de consulta"), "–"], ["reads", t("Pages read", "Páginas leídas"), "–"], ["insert", t("Add a book", "Agregar un libro"), "–"], ["cats", t("Catalogues", "Catálogos"), "1"]],
    controls: [
      { seg: "rows", label: t("Rows", "Filas"), options: [[1000, "1,000"], [10000, "10,000"], [100000, "100,000"]], value: 10000 },
      { seg: "query", label: t("Query", "Consulta"), options: [["isbn", "ISBN"], ["author", t("Author", "Autor")], ["year", t("Year", "Año")], ["authorYear", t("Author + year", "Autor + año")], ["loan", t("On loan", "Prestado")], ["titles", t("Titles by author", "Títulos por autor")]], value: "isbn" },
      // Several catalogues can be on at once: the live code presses each button that is on.
      { seg: "idx", label: t("Catalogues (indexes)", "Catálogos (índices)"), options: [["isbn", "ISBN"], ["author", t("Author", "Autor")], ["authorYear", t("Author, year", "Autor, año")], ["loan", t("On loan", "Prestado")], ["authorTitle", t("Author + title", "Autor + título")]], value: "isbn", multiple: true },
      { seg: "writes", label: t("New books arriving", "Llegan libros nuevos"), options: [["false", t("Off", "No")], ["true", t("On", "Sí")]], value: "false" },
      { speed: true },
      { actions: [["restart", t("Restart", "Reiniciar")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Times come from the same cost model the machine runs on: a page of 100 books read in order costs 0.1 ms, a random page (a drawer level or a trip to a shelf) 0.4 ms, and a catalogue page holds 100 cards.", "Cada experimento cambia una sola cosa. Elige qué esperas <em>antes</em> de ejecutarlo. Los tiempos salen del mismo modelo de costos de la máquina: una página de 100 libros leída en orden cuesta 0.1 ms, una página aleatoria (un nivel de cajón o un viaje a un estante) 0.4 ms, y una página de catálogo tiene 100 fichas."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: '.iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}\n[data-count],[data-count-label]{font-variant-numeric:tabular-nums}',
  data: {
    P,
    G: GEOMETRY,
  },
});
