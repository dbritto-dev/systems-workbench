// @ts-nocheck: content ported as-is
// Systems lesson 29 · Connection pooling: a taxi rank, one hotel per app instance.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, cabSvg, P, GEOMETRY } from "./figure";
import { noPoolVsPool, poolSizes, leakRun, apiInside, scaleOut } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the original computed them in the
// browser when a card was run; they are seeded, so the numbers are the same). The per-seed runs are left out.
const lean = ({ runs, ...averages }) => averages;
const nopool = noPoolVsPool(), api = apiInside(), scale = scaleOut();
const RESULTS = {
  nopool: { none: lean(nopool.none), pooled: lean(nopool.pooled) },
  size: poolSizes().map(lean),
  leak: leakRun(),
  api: { before: lean(api.before), inside: lean(api.inside) },
  scale: { direct: lean(scale.direct), pooled: lean(scale.pooled), lastDirect: scale.lastDirect, lastPooled: scale.lastPooled },
};

const EXPERIMENTS = [
  {
    id: "nopool",
    title: t("A new connection for every request", "Una conexión nueva para cada solicitud"),
    change: t("No pool · each request opens its own connection, uses it once and closes it · 2 instances, 60 requests/s each", "Sin pool · cada solicitud abre su propia conexión, la usa una vez y la cierra · 2 instancias, 60 solicitudes/s cada una"),
    question: t("The queries take about 10 ms. How long does a typical request take now?", "Las consultas tardan unos 10 ms. ¿Cuánto tarda ahora una solicitud típica?"),
    options: [t("About the same: 10 ms", "Más o menos lo mismo: 10 ms"), t("About 40 ms, four times longer", "Unos 40 ms, cuatro veces más"), t("Seconds: the database refuses most of them", "Segundos: la base de datos rechaza la mayoría")],
    answer: 1,
    why: t("Before a new connection can run anything it needs a TCP handshake, TLS and authentication, and the database starts a fresh backend for it: about 30 ms here. The query still takes 10 ms, so setup costs three times the useful work on every single request. A pool pays that once and then reuses the connection thousands of times.", "Antes de que una conexión nueva pueda ejecutar algo necesita un handshake TCP, TLS y autenticación, y la base de datos arranca un backend nuevo para ella: unos 30 ms aquí. La consulta sigue tardando 10 ms, así que la preparación cuesta tres veces el trabajo útil en cada solicitud. Un pool paga eso una vez y después reutiliza la conexión miles de veces."),
    watch: { pool: 0, instances: 2, rate: 60, api: "none", leak: 0, pooler: "off" },
  },
  {
    id: "size",
    title: t("A bigger pool", "Un pool más grande"),
    change: t("2 instances at 500 requests/s each, more than the database can serve · pool per instance 5 → 10 → 20 (up to 10, 20 or 40 queries at once)", "2 instancias a 500 solicitudes/s cada una, más de lo que la base de datos puede atender · pool por instancia 5 → 10 → 20 (hasta 10, 20 o 40 consultas a la vez)"),
    question: t("Which pool size gets the most requests served per second?", "¿Con qué tamaño de pool se atienden más solicitudes por segundo?"),
    options: [t("20: more connections, more throughput", "20: más conexiones, más rendimiento"), t("10: somewhere in the middle", "10: algo intermedio"), t("5: the smallest", "5: el más chico")],
    answer: 2,
    why: t("The database does its best work with only a few queries at once, about twice its cores. Past that, extra queries add no capacity; they fight over CPU, locks and cache and slow every query down. With 40 connections each query takes 8 times longer and fewer finish per second. When demand exceeds capacity, a small pool keeps the excess waiting in the app, where waiting is cheap, instead of inside the database.", "La base de datos rinde mejor con pocas consultas a la vez, unas dos por núcleo. Pasado ese punto, las consultas extra no agregan capacidad; compiten por CPU, locks y caché y vuelven más lenta cada consulta. Con 40 conexiones cada consulta tarda 8 veces más y terminan menos por segundo. Cuando la demanda supera la capacidad, un pool chico deja el exceso esperando en la app, donde esperar es barato, en lugar de dentro de la base de datos."),
    watch: { pool: 20, instances: 2, rate: 500, api: "none", leak: 0, pooler: "off" },
  },
  {
    id: "leak",
    title: t("One code path forgets to give it back", "Un camino del código se olvida de devolverla"),
    change: t("1 request in 500 returns early without releasing its connection · 2 instances, pool 10, 60 requests/s each, for 5 minutes (Watch uses 1 in 50 at ×8, so the lots fill while you look)", "1 de cada 500 solicitudes sale antes sin liberar su conexión · 2 instancias, pool de 10, 60 solicitudes/s cada una, durante 5 minutos (Míralo en la figura usa 1 de cada 50 a ×8, para que los estacionamientos se llenen mientras miras)"),
    question: t("What do you see over those 5 minutes?", "¿Qué ves durante esos 5 minutos?"),
    options: [t("About 1 request in 500 fails; the rest are fine", "Falla más o menos 1 de cada 500 solicitudes; el resto va bien"), t("Fine for a minute or so, then nearly every request times out", "Bien durante un minuto más o menos, y después casi todas las solicitudes agotan su tiempo de espera"), t("The database runs out of memory and restarts", "La base de datos se queda sin memoria y se reinicia")],
    answer: 1,
    why: t("A leaked connection is still checked out, so the pool can neither use it nor replace it. At 60 requests a second the tenth leak comes after about 5,000 requests, and from then on every request waits its full second and times out, while the database sits idle holding 20 connections that do nothing. It passes every short test. Release connections in a finally block (or with try-with-resources / using), and turn on the pool's leak detection.", "Una conexión fugada sigue prestada, así que el pool no puede usarla ni reemplazarla. A 60 solicitudes por segundo la décima fuga llega después de unas 5,000 solicitudes, y desde ahí cada solicitud espera su segundo completo y agota el tiempo de espera (timeout), mientras la base de datos está ociosa con 20 conexiones que no hacen nada. Pasa todas las pruebas cortas. Libera las conexiones en un bloque finally (o con try-with-resources / using) y activa la detección de fugas del pool."),
    watch: { pool: 10, instances: 2, rate: 60, api: "none", leak: 50, pooler: "off", speed: 8 },
  },
  {
    id: "api",
    title: t("An API call inside the transaction", "Una llamada a una API dentro de la transacción"),
    change: t("Each request calls an external API (200 ms) while holding its connection, instead of before taking one · 2 instances, pool 10, 60 requests/s each", "Cada solicitud llama a una API externa (200 ms) mientras tiene su conexión, en lugar de hacerlo antes de tomarla · 2 instancias, pool de 10, 60 solicitudes/s cada una"),
    question: t("The database runs exactly the same queries. What happens?", "La base de datos ejecuta exactamente las mismas consultas. ¿Qué pasa?"),
    options: [t("Nothing: the database isn't any busier", "Nada: la base de datos no está más ocupada"), t("Requests get 200 ms slower, and that's all", "Las solicitudes tardan 200 ms más, y nada más"), t("Requests start timing out waiting for a connection, while the database sits mostly idle", "Las solicitudes empiezan a agotar el tiempo de espera por una conexión, mientras la base de datos está casi ociosa")],
    answer: 2,
    why: t("A connection is busy for as long as someone holds it, not only while a query runs. 60 requests a second, each holding one for 210 ms, need about 12.6 connections at once; the pool has 10. The wait queue grows until requests time out, yet the database runs about one query at a time. Do slow outside work before or after the transaction, never inside it.", "Una conexión está ocupada mientras alguien la tenga, no solo mientras corre una consulta. 60 solicitudes por segundo, cada una con una conexión durante 210 ms, necesitan unas 12.6 conexiones a la vez; el pool tiene 10. La cola de espera crece hasta que las solicitudes agotan su tiempo, y aun así la base de datos ejecuta más o menos una consulta a la vez. Haz el trabajo externo lento antes o después de la transacción, nunca dentro."),
    watch: { pool: 10, instances: 2, rate: 60, api: "inside", leak: 0, pooler: "off" },
  },
  {
    id: "scale",
    title: t("Scale out for a busy day", "Escala para un día de mucho tráfico"),
    change: t("Pool 20 per instance, the database allows 60 connections · scale from 2 to 4 instances · then the same through a pooler that keeps 20 server connections", "Pool de 20 por instancia, la base de datos permite 60 conexiones · escala de 2 a 4 instancias · después lo mismo con un pooler que mantiene 20 conexiones de servidor"),
    question: t("Connecting directly, what happens when the extra instances start?", "Conectando directo, ¿qué pasa cuando arrancan las instancias extra?"),
    options: [t("All four share the load fine", "Las cuatro se reparten bien la carga"), t("The fourth gets no connections at all and fails every request", "La cuarta no consigue ninguna conexión y falla todas sus solicitudes"), t("The database slows down, but every request succeeds", "La base de datos se vuelve más lenta, pero todas las solicitudes tienen éxito")],
    answer: 1,
    why: t("Each instance opens its full pool of 20 at start-up. Three instances already hold all 60 connections the database allows, so the fourth is refused every time it tries: its rank stays empty and all its requests fail, a quarter of all traffic. Autoscaling multiplies pools. A pooler such as PgBouncer lets many cheap client connections share a few server connections, so the database only ever sees 20.", "Cada instancia abre su pool completo de 20 al arrancar. Tres instancias ya tienen las 60 conexiones que permite la base de datos, así que a la cuarta la rechazan cada vez que lo intenta: su parada queda vacía y fallan todas sus solicitudes, una cuarta parte de todo el tráfico. El autoescalado multiplica los pools. Un pooler como PgBouncer deja que muchas conexiones de cliente baratas compartan unas pocas conexiones de servidor, así que la base de datos nunca ve más de 20."),
    watch: { pool: 20, instances: 2, rate: 60, api: "none", leak: 0, pooler: "off", scaleTo: 4 },
  },
];

const QUESTIONS = [
  [t("Why is opening a database connection per request slow, and what exactly does a pool save?", "¿Por qué es lento abrir una conexión a la base de datos por solicitud, y qué ahorra exactamente un pool?"),
    t("A new connection needs a TCP handshake, a TLS handshake and authentication (several network round trips), and the database starts a backend process or thread and allocates memory for it. That often costs more than the query. A pool opens connections once and lends them out, so each request only pays for its queries.", "Una conexión nueva necesita un handshake TCP, un handshake TLS y autenticación (varios viajes de ida y vuelta por la red), y la base de datos arranca un proceso o hilo de backend y le asigna memoria. Muchas veces eso cuesta más que la consulta. Un pool abre las conexiones una vez y las presta, así que cada solicitud solo paga por sus consultas.")],
  [t("Your service handles 300 requests a second and each holds a connection for 20 ms. How many connections does it need, and why not just configure 200?", "Tu servicio atiende 300 solicitudes por segundo y cada una tiene una conexión durante 20 ms. ¿Cuántas conexiones necesita, y por qué no configurar 200 y ya?"),
    t("Little's law: 300 × 0.020 = 6 connections busy on average; add headroom for bursts, so perhaps 10–15. Not 200: under load, more connections means more concurrent queries in the database, which past roughly twice its cores slows every query down, and every connection costs database memory even when idle.", "Ley de Little (Little's law): 300 × 0.020 = 6 conexiones ocupadas en promedio; agrega margen para las ráfagas, así que quizá 10–15. No 200: con carga, más conexiones significan más consultas concurrentes en la base de datos, y pasado más o menos el doble de sus núcleos eso vuelve más lenta cada consulta; además cada conexión cuesta memoria en la base de datos aunque esté ociosa.")],
  [t("Why can a bigger pool make a busy system slower?", "¿Por qué un pool más grande puede volver más lento un sistema con mucha carga?"),
    t("The database has a fixed amount of CPU, disk and lock capacity. Beyond a few active queries per core, extra queries don't add throughput; they add context switching, lock and cache contention. A smaller pool keeps the excess queued in the application, where waiting costs almost nothing, and the database stays at its most efficient level.", "La base de datos tiene una cantidad fija de CPU, disco y capacidad de locks. Más allá de unas pocas consultas activas por núcleo, las consultas extra no agregan rendimiento; agregan cambios de contexto y contención de locks y caché. Un pool más chico deja el exceso en cola en la aplicación, donde esperar no cuesta casi nada, y la base de datos se queda en su nivel más eficiente.")],
  [t("A service runs fine for an hour after each deploy, then every request fails with 'timed out waiting for a connection'. The database looks idle. What do you suspect, and how do you confirm it?", "Un servicio funciona bien durante una hora después de cada despliegue, y después todas las solicitudes fallan con 'timed out waiting for a connection'. La base de datos se ve ociosa. ¿Qué sospechas y cómo lo confirmas?"),
    t("A connection leak: some code path never returns its connection. Confirm with pool metrics (active = maximum while throughput is near zero), pg_stat_activity showing sessions idle or 'idle in transaction' for a long time, and the pool's leak-detection log, which prints the stack trace of who borrowed it. Fix with finally / try-with-resources / using.", "Una fuga de conexiones (connection leak): algún camino del código nunca devuelve su conexión. Confírmalo con las métricas del pool (activas = máximo mientras el rendimiento está cerca de cero), con pg_stat_activity mostrando sesiones idle o 'idle in transaction' durante mucho tiempo, y con el log de detección de fugas del pool, que imprime el stack trace de quién la pidió prestada. Arréglalo con finally / try-with-resources / using.")],
  [t("Why shouldn't you call an external API inside a database transaction?", "¿Por qué no deberías llamar a una API externa dentro de una transacción de base de datos?"),
    t("The connection, and any locks the transaction holds, stay taken for the whole call. The pool runs out long before the database is busy, other requests time out, and a slow or hanging API now blocks your database work too. Fetch what you need before the transaction, or record the intent and call the API after commit (for example with an outbox).", "La conexión, y cualquier lock que tenga la transacción, quedan ocupados durante toda la llamada. El pool se agota mucho antes de que la base de datos esté ocupada, otras solicitudes agotan su tiempo de espera, y una API lenta o colgada ahora bloquea también tu trabajo en la base de datos. Trae lo que necesitas antes de la transacción, o registra la intención y llama a la API después del commit (por ejemplo con un outbox).")],
  [t("You run 30 pods with a pool of 10 each against a database with max_connections = 200. What happens, and what are your options?", "Corres 30 pods con un pool de 10 cada uno contra una base de datos con max_connections = 200. ¿Qué pasa y qué opciones tienes?"),
    t("30 × 10 = 300 connections wanted, 200 allowed: the last pods to start can't get connections and fail. Options: smaller pools per pod; a pooler such as PgBouncer in transaction mode so pods share a small set of server connections; or raising max_connections carefully, since each connection costs database memory. Count pods × pool size against the limit whenever you autoscale.", "30 × 10 = 300 conexiones pedidas, 200 permitidas: los últimos pods en arrancar no consiguen conexiones y fallan. Opciones: pools más chicos por pod; un pooler como PgBouncer en modo transacción para que los pods compartan un conjunto pequeño de conexiones de servidor; o subir max_connections con cuidado, porque cada conexión cuesta memoria en la base de datos. Compara pods × tamaño del pool con el límite cada vez que autoescales.")],
];

export default defineLesson({
  title: t("Connection Pool Workbench", "Banco de trabajo: pool de conexiones"),
  eyebrow: t("Systems lesson 29 · Connection pooling", "Lección de sistemas 29 · Pool de conexiones"),
  lede: t("Opening a database connection is slow, and a database can only hold so many. A pool keeps a few open and lends them out; most connection trouble comes from sizing it, holding a connection too long or never giving it back. This lesson builds a pool as a taxi rank: watch it work, predict what breaks it, then explain it back.", "Abrir una conexión a la base de datos es lento, y una base de datos solo aguanta cierta cantidad. Un pool de conexiones (connection pool) mantiene unas pocas abiertas y las presta; la mayoría de los problemas con conexiones vienen de su tamaño, de tener una conexión demasiado tiempo o de no devolverla nunca. Esta lección arma un pool como una parada de taxis: mira cómo funciona, predice qué lo rompe y después explícalo."),
  machine: {
    intro: t("Each hotel is an app instance with its own rank of cabs, its connection pool. A passenger takes a cab to the terminal (the database) and back; a cab at the kerb is a query running. Every cab that exists holds one of the terminal's 60 permits. Try no pool, a bigger pool, an API call inside the transaction, a leak, and scaling out to four hotels.", "Cada hotel es una instancia de la app con su propia parada de taxis, su pool de conexiones. Un pasajero toma un taxi hasta la terminal (la base de datos) y de vuelta; un taxi en el frente de la terminal es una consulta corriendo. Cada taxi que existe ocupa uno de los 60 permisos de la terminal. Prueba sin pool, con un pool más grande, con una llamada a una API dentro de la transacción, con una fuga y escalando a cuatro hoteles."),
    plate: {
      title: t("Taxi rank", "Parada de taxis"),
      keys: [
        { mark: "lit", label: t("A cab with a passenger: a connection lent to a request; a lit booth lamp: new cabs refused", "Un taxi con pasajero: una conexión prestada a una solicitud; una lámpara de caseta encendida: taxis nuevos rechazados") },
        { mark: "raised", label: t("Hotels, cabs, booths, the terminal: instances, connections, connection setup, the database", "Hoteles, taxis, casetas, la terminal: instancias, conexiones, preparación de conexiones, la base de datos") },
        { mark: "flat", label: t("Ranks, roads, lay-bys, the fenced lots and the terminal kerb", "Paradas, caminos, bahías, los estacionamientos cercados y el frente de la terminal") },
      ],
      caption: t("Each hotel is an app instance and its rank is its connection pool; the counter over its door is how many passengers are waiting for a cab. A new cab must stop at the booth at the end of its road to register, and every cab that exists fills one cell on the terminal's permit board, which has 60. A cab at the kerb is a query running; the roof gauge shows how much slower each query runs as the kerb fills. Cabs in a lay-by are held while their passenger makes an outside call; cabs in the fenced lot behind a hotel were never given back. A lit booth lamp means the terminal is turning that hotel's new cabs away: it has no permits left. Through a pooler, the lamps beside the board are its 20 shared server connections.", "Cada hotel es una instancia de la app y su parada es su pool de conexiones; el contador sobre su puerta es cuántos pasajeros esperan un taxi. Un taxi nuevo tiene que parar en la caseta al final de su camino para registrarse, y cada taxi que existe llena una celda del tablero de permisos de la terminal, que tiene 60. Un taxi en el frente de la terminal es una consulta corriendo; el indicador del techo muestra cuánto más lenta corre cada consulta a medida que se llena el frente. Los taxis en una bahía están retenidos mientras su pasajero hace una llamada externa; los taxis en el estacionamiento cercado detrás de un hotel nunca se devolvieron. Una lámpara de caseta encendida significa que la terminal está rechazando los taxis nuevos de ese hotel: no le quedan permisos. Con un pooler, las lámparas junto al tablero son sus 20 conexiones de servidor compartidas."),
      stage: { "data-rank-stage": "" },
      label: t("Connection pool simulation. Space pauses or resumes.", "Simulación de un pool de conexiones. La barra espaciadora pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["served", t("Served per second", "Servidas por segundo")], ["p95", t("p95 response", "Respuesta p95")], ["waiting", t("Waiting for a cab", "Esperando taxi")], ["failed", t("Failed requests", "Solicitudes fallidas")], ["open", t("Connections open", "Conexiones abiertas"), "– / 60"], ["slow", t("Time per query", "Tiempo por consulta"), "×1.0"]],
    controls: [
      { seg: "pool", label: t("Pool per instance", "Pool por instancia"), options: [[0, t("None", "Ninguno")], [5, "5"], [10, "10"], [20, "20"]], value: 10 },
      { seg: "instances", label: t("Instances", "Instancias"), options: [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], value: 3 },
      { seg: "rate", label: t("Traffic per instance", "Tráfico por instancia"), options: [[30, "30/s"], [60, "60/s"], [120, "120/s"], [250, "250/s"], [500, "500/s"]], value: 120 },
      { seg: "api", label: t("External API call", "Llamada a API externa"), options: [["none", t("None", "Ninguna")], ["before", t("Before the transaction", "Antes de la transacción")], ["inside", t("Inside it", "Dentro de ella")]], value: "none" },
      { seg: "leak", label: t("Leak", "Fuga"), options: [[0, t("None", "Ninguna")], [500, t("1 in 500", "1 de cada 500")], [50, t("1 in 50", "1 de cada 50")]], value: 0 },
      { seg: "pooler", label: t("Database access", "Acceso a la base de datos"), options: [["off", t("Direct", "Directo")], ["on", t("Through a pooler", "Con un pooler")]], value: "off" },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The machine runs 20 times slower than real time. Changing the number of instances scales out or in while it runs; every other setting starts the run again.", "La máquina corre 20 veces más lento que el tiempo real. Cambiar el número de instancias escala hacia arriba o hacia abajo sin detenerla; cualquier otro ajuste vuelve a empezar la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, run at full speed and averaged over six seeded runs.", "Cada experimento cambia una sola cosa. Elige qué esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, corrido a toda velocidad y promediado sobre seis ejecuciones con semilla fija."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css: `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round}
.dg[data-size=l]{stroke-width:1.5}
.dg[data-size=m]{stroke-width:.95}
.pm{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.5}
.pm[data-used]{fill:var(--anatomy-strong);stroke:var(--anatomy-strong)}
.needle{fill:none;stroke:var(--anatomy-strong);stroke-width:1.6;stroke-linecap:round}
[data-col][data-off]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
    CAB_SVG: cabSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
