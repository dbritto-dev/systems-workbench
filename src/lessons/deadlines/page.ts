// @ts-nocheck: lesson content in the lessons' plain style
// Systems lesson 46 · Timeouts & deadlines: a relay of desks (client, gateway, service, database) passing dockets.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, n0 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, docketSvg, P, GEOMETRY } from "./figure";
import { experimentResults, innerTimeouts, dbCapacity, BASE, STALL, SLOW, GW_SLOW, RATE, WORKERS, NEED, INNER } from "./sim";

// Experiment results, computed at build time from the same model the page runs (six seeded runs each).
const RESULTS = experimentResults();

// Numbers the texts quote, all from the model's settings.
const s1 = (x) => (Math.round(x * 10) / 10).toFixed(1) + " s";          // 1.8 s
const s2 = (x) => (Math.round(x * 100) / 100).toFixed(2) + " s";        // 0.50 s
const sec = (x) => String(Math.round(x * 10) / 10) + " s";               // 2 s, 1.8 s
const [GW_T, SVC_T] = innerTimeouts(BASE);
const [GW_LONG, SVC_LONG] = innerTimeouts({ ...BASE, inner: "long" });
const CLIENT = sec(BASE.client);
const STALL_TEXT = { en: `1 query in ${Math.round(1 / STALL.p)} hangs for ${STALL.min}–${STALL.max} s`, es: `1 de cada ${Math.round(1 / STALL.p)} consultas se cuelga de ${STALL.min} a ${STALL.max} s` };
const CAP = dbCapacity(SLOW);
const per = (x) => (x < 0.1 ? x.toFixed(2) : (Math.round(x * 10) / 10).toFixed(1));

// What each card shows after a run.
const RUNS = {
  wasted: () => {
    const { fixed, deadline } = RESULTS.wasted;
    return { verdict: t(`Fixed timeouts: ${pct(fixed.dbWasteShare)} of the database's worker time (${n0(fixed.wasteDb)} worker-seconds a minute) went to queries whose client already had its answer. One deadline: ${pct(deadline.dbWasteShare)}. Answered in time: ${pct(fixed.ok)} with fixed timeouts, ${pct(deadline.ok)} with the deadline.`,
        `Tiempos límite fijos: el ${pct(fixed.dbWasteShare)} del tiempo de trabajo de la base de datos (${n0(fixed.wasteDb)} segundos de trabajador por minuto) se fue en consultas cuyo cliente ya tenía su respuesta. Un plazo: ${pct(deadline.dbWasteShare)}. Respondidas a tiempo: ${pct(fixed.ok)} con tiempos límite fijos, ${pct(deadline.ok)} con el plazo.`),
      bars: [[t("Database time wasted, fixed", "Tiempo perdido de la base, fijos"), fixed.dbWasteShare, pct(fixed.dbWasteShare), true], [t("Database time wasted, deadline", "Tiempo perdido de la base, plazo"), deadline.dbWasteShare, pct(deadline.dbWasteShare)], [t("Answered in time, fixed", "A tiempo, fijos"), fixed.ok, pct(fixed.ok)], [t("Answered in time, deadline", "A tiempo, plazo"), deadline.ok, pct(deadline.ok)]] };
  },
  order: () => {
    const { short, long } = RESULTS.order, held = (r) => r.wasteGw + r.wasteSvc, top = Math.max(held(long), long.wasteDb, 1);
    return { verdict: t(`Inner timeouts longer than the client's: the gateway and the service held workers for ${n0(held(long))} worker-seconds a minute after the client had given up. Shorter: ${n0(held(short))}, and the client got an error after ${s1(short.errorTime)} on average instead of timing out. Answered in time: ${pct(long.ok)} vs ${pct(short.ok)}. The database wasted about ${n0(short.wasteDb)} worker-seconds a minute either way.`,
        `Tiempos límite internos más largos que el del cliente: el gateway y el servicio retuvieron trabajadores ${n0(held(long))} segundos de trabajador por minuto después de que el cliente se rindió. Más cortos: ${n0(held(short))}, y el cliente recibió un error a los ${s1(short.errorTime)} en promedio en vez de quedarse sin tiempo. Respondidas a tiempo: ${pct(long.ok)} vs ${pct(short.ok)}. La base de datos perdió unos ${n0(short.wasteDb)} segundos de trabajador por minuto en ambos casos.`),
      bars: [[t("Gateway + service held, longer", "Gateway + servicio retenidos, más largos"), held(long) / top, t(n0(held(long)) + " s/min", n0(held(long)) + " s/min"), true], [t("Gateway + service held, shorter", "Gateway + servicio retenidos, más cortos"), held(short) / top, t(n0(held(short)) + " s/min", n0(held(short)) + " s/min")], [t("Database wasted, either way", "Tiempo perdido de la base, en ambos"), short.wasteDb / top, t(n0(short.wasteDb) + " s/min", n0(short.wasteDb) + " s/min")]] };
  },
  slow: () => {
    const { fixed, deadline, healthy } = RESULTS.slow, top = Math.max(healthy.goodput, 1);
    return { verdict: t(`Answered in time per second: ${per(healthy.goodput)} with a healthy database. 5× slower with fixed timeouts: ${per(fixed.goodput)} (${pct(fixed.ok)}); its line had grown to ${n0(fixed.queue)} calls by the end, and ${pct(fixed.dbWasteShare)} of its work was for clients already gone. With one deadline: ${per(deadline.goodput)} a second (${pct(deadline.ok)}), and its line peaked at about ${n0(deadline.peak)}.`,
        `Respondidas a tiempo por segundo: ${per(healthy.goodput)} con la base de datos sana. 5× más lenta con tiempos límite fijos: ${per(fixed.goodput)} (${pct(fixed.ok)}); su cola había llegado a ${n0(fixed.queue)} llamadas al final, y el ${pct(fixed.dbWasteShare)} de su trabajo fue para clientes que ya se habían ido. Con un plazo: ${per(deadline.goodput)} por segundo (${pct(deadline.ok)}), y su cola llegó como máximo a unas ${n0(deadline.peak)}.`),
      bars: [[t("In time per second, healthy", "A tiempo por segundo, sana"), healthy.goodput / top, per(healthy.goodput)], [t("5× slower, fixed timeouts", "5× más lenta, tiempos límite fijos"), fixed.goodput / top, per(fixed.goodput)], [t("5× slower, one deadline", "5× más lenta, un plazo"), deadline.goodput / top, per(deadline.goodput), true]] };
  },
  budget: () => {
    const { fixed, deadline } = RESULTS.budget;
    return { verdict: t(`Database queries whose answer never reached the client in time: ${pct(fixed.dbUseless)} with fixed timeouts (${n0(fixed.dbUselessPerMin)} a minute), ${pct(deadline.dbUseless)} with one deadline (${n0(deadline.dbUselessPerMin)} a minute), which also refused ${n0(deadline.refusedPerMin)} calls a minute before doing any work. Answered in time: ${pct(fixed.ok)} vs ${pct(deadline.ok)}.`,
        `Consultas a la base de datos cuya respuesta nunca llegó a tiempo al cliente: ${pct(fixed.dbUseless)} con tiempos límite fijos (${n0(fixed.dbUselessPerMin)} por minuto), ${pct(deadline.dbUseless)} con un plazo (${n0(deadline.dbUselessPerMin)} por minuto), que además rechazó ${n0(deadline.refusedPerMin)} llamadas por minuto antes de hacer trabajo alguno. Respondidas a tiempo: ${pct(fixed.ok)} vs ${pct(deadline.ok)}.`),
      bars: [[t("Useless queries, fixed", "Consultas inútiles, fijos"), fixed.dbUseless, pct(fixed.dbUseless), true], [t("Useless queries, deadline", "Consultas inútiles, plazo"), deadline.dbUseless, pct(deadline.dbUseless)], [t("Answered in time, fixed", "A tiempo, fijos"), fixed.ok, pct(fixed.ok)], [t("Answered in time, deadline", "A tiempo, plazo"), deadline.ok, pct(deadline.ok)]] };
  },
  pct: () => {
    const { lat, one, two } = RESULTS.pct, cut = (r) => 1 - r.ok, top = Math.max(cut(one), cut(two), 0.01) * 1.1;
    return { verdict: t(`Healthy chain: median ${s2(lat.p50)}, p99 ${s2(lat.p99)}, p99.9 ${s2(lat.p999)}. With a 1 s timeout, ${(100 * cut(one)).toFixed(1)}% of requests timed out with nothing wrong; with 2 s, ${(100 * cut(two)).toFixed(1)}%.`,
        `Cadena sana: mediana ${s2(lat.p50)}, p99 ${s2(lat.p99)}, p99.9 ${s2(lat.p999)}. Con un tiempo límite de 1 s, el ${(100 * cut(one)).toFixed(1)}% de las solicitudes venció sin que nada anduviera mal; con 2 s, el ${(100 * cut(two)).toFixed(1)}%.`),
      bars: [[t("Timed out at 1 s", "Vencidas con 1 s"), cut(one) / top, (100 * cut(one)).toFixed(1) + "%", true], [t("Timed out at 2 s", "Vencidas con 2 s"), cut(two) / top, (100 * cut(two)).toFixed(1) + "%"]] };
  },
};

const LAT = RESULTS.pct.lat;
const EXPERIMENTS = [
  {
    id: "wasted",
    title: t("Nobody tells the database", "Nadie le avisa a la base de datos"),
    change: t(`${STALL_TEXT.en} · fixed timeouts: client ${CLIENT}, gateway ${sec(GW_T)}, service ${sec(SVC_T)}, database none → one deadline passed down the chain`,
      `${STALL_TEXT.es} · tiempos límite fijos: cliente ${CLIENT}, gateway ${sec(GW_T)}, servicio ${sec(SVC_T)}, base de datos ninguno → un plazo (deadline) que se pasa por la cadena`),
    question: t(`When a query hangs, the service stops waiting after ${sec(SVC_T)} and the client gets an error. What does the database do with the hung query?`,
      `Cuando una consulta se cuelga, el servicio deja de esperar a los ${sec(SVC_T)} y el cliente recibe un error. ¿Qué hace la base de datos con la consulta colgada?`),
    options: [
      t("It stops too: the timeout upstream ends the call", "También para: el tiempo límite de arriba termina la llamada"),
      t("It keeps running it to the end", "Sigue ejecutándola hasta el final"),
      t("It notices the service left and rolls it back", "Detecta que el servicio se fue y la revierte"),
    ],
    answer: 1,
    why: t(
      "A timeout ends the wait of whoever set it, and nothing else. The service stops waiting and sends an error back, but no one tells the database, so a worker stays busy until the query is done. With one deadline passed down the chain, the database knows the moment its answer stops being useful and stops there, freeing the worker. It doesn't save the hung requests (they fail either way); it gives back the capacity they were eating.",
      "Un tiempo límite (timeout) termina la espera de quien lo puso, y nada más. El servicio deja de esperar y devuelve un error, pero nadie le avisa a la base de datos, así que un trabajador sigue ocupado hasta que la consulta termina. Con un plazo que se pasa por toda la cadena, la base de datos sabe en qué momento su respuesta deja de servir y para ahí, liberando al trabajador. No salva las solicitudes colgadas (fallan de todos modos); devuelve la capacidad que se estaban comiendo.",
    ),
    watch: { mode: "fixed", client: 2, inner: "short", db: "stall", gw: "fast" },
  },
  {
    id: "order",
    title: t("Inner timeouts longer than the outer one", "Tiempos límite internos más largos que el externo"),
    change: t(`Same hanging queries, fixed timeouts · client ${CLIENT} · the gateway and the service wait ${sec(GW_T)} and ${sec(SVC_T)} → ${sec(GW_LONG)} and ${sec(SVC_LONG)}`,
      `Las mismas consultas colgadas, tiempos límite fijos · cliente ${CLIENT} · el gateway y el servicio esperan ${sec(GW_T)} y ${sec(SVC_T)} → ${sec(GW_LONG)} y ${sec(SVC_LONG)}`),
    question: t(`The client still gives up at ${CLIENT}. What changes when the inner timeouts are longer than the client's?`,
      `El cliente sigue rindiéndose a los ${CLIENT}. ¿Qué cambia cuando los tiempos límite internos son más largos que el del cliente?`),
    options: [
      t("Nothing: the client's timeout is the one that counts", "Nada: el tiempo límite del cliente es el que cuenta"),
      t("Inner hops hold workers after the client has left", "Los saltos internos retienen trabajadores tras irse el cliente"),
      t("More succeed: the inner hops are more patient", "Más tienen éxito: los saltos internos son más pacientes"),
    ],
    answer: 1,
    why: t(
      "Each hop should give up a little before its caller does. Then the innermost timeout fires first, an error travels back up, and every caller frees its worker while its own caller is still listening: the client gets a clear error before its own timer runs out. Turn it around and the client leaves at 2 s while the gateway and the service keep holding workers for an answer they can only throw away. More patience inside saves no request, because the client's timeout caps what anyone can use. The database is the same either way: nobody cancels its hung queries.",
      "Cada salto debería rendirse un poco antes que quien lo llama. Así el tiempo límite más interno vence primero, un error viaja hacia arriba y cada llamador libera a su trabajador mientras su propio llamador todavía escucha: el cliente recibe un error claro antes de que se le acabe su reloj. Al revés, el cliente se va a los 2 s mientras el gateway y el servicio siguen reteniendo trabajadores por una respuesta que solo pueden tirar. Más paciencia adentro no salva ninguna solicitud, porque el tiempo límite del cliente pone el tope de lo que alguien puede usar. La base de datos queda igual en ambos casos: nadie cancela sus consultas colgadas.",
    ),
    watch: { mode: "fixed", client: 2, inner: "long", db: "stall", gw: "fast" },
  },
  {
    id: "slow",
    title: t("A slow database, then a deadline", "Una base de datos lenta, luego un plazo"),
    change: t(`Every query takes ${SLOW}× longer · the database now has room for about ${Math.round(CAP)} of the ${RATE} requests a second · fixed timeouts → one deadline`,
      `Cada consulta tarda ${SLOW}× más · ahora la base de datos tiene lugar para unas ${Math.round(CAP)} de las ${RATE} solicitudes por segundo · tiempos límite fijos → un plazo`),
    question: t(`With fixed timeouts, almost nothing gets an answer in time. With one deadline, how many requests a second do?`,
      `Con tiempos límite fijos, casi nada recibe respuesta a tiempo. Con un plazo, ¿cuántas solicitudes por segundo la reciben?`),
    options: [
      t("Still almost none: a deadline adds no capacity", "Casi ninguna igual: un plazo no agrega capacidad"),
      t(`Some, but fewer than the ${Math.round(CAP)} it has room for`, `Algunas, pero menos que las ${Math.round(CAP)} para las que hay lugar`),
      t(`About ${Math.round(CAP)}: no work is wasted any more`, `Unas ${Math.round(CAP)}: ya no se pierde trabajo`),
    ],
    answer: 1,
    why: t(
      `With fixed timeouts each caller gives up on its own clock, but its call stays in the database's line. The line grows by about ${Math.round(RATE - CAP)} a second, so soon every call the database picks up is older than ${CLIENT}, and every answer arrives after its client is gone: throughput at the maximum, almost nothing useful (lesson 47, Load shedding and backpressure, takes that collapse apart). Here the line is on the database's side, like a server's request queue; a client-side connection-pool queue does drop a waiter when its caller times out, but queries already running still run to the end. With a deadline on every call, a call leaves the line the moment its client's time runs out, and a running query stops at that moment, so the database only works for clients who are still waiting. It still can't reach ${Math.round(CAP)} a second: a slow query that starts with too little time left is cut off at the deadline, and that work is lost.`,
      `Con tiempos límite fijos, cada llamador se rinde con su propio reloj, pero su llamada se queda en la cola de la base de datos. La cola crece cerca de ${Math.round(RATE - CAP)} por segundo, así que pronto cada llamada que toma la base de datos tiene más de ${CLIENT}, y cada respuesta llega cuando su cliente ya se fue: el rendimiento al máximo y casi nada útil (la lección 47, Descarte de carga y contrapresión, desarma ese colapso). Aquí la cola está del lado de la base de datos, como la cola de solicitudes de un servidor; la cola de un pool de conexiones del lado del cliente sí suelta a quien espera cuando su llamador se rinde, pero las consultas que ya corren siguen hasta el final. Con un plazo en cada llamada, una llamada sale de la cola en cuanto se acaba el tiempo de su cliente, y una consulta en curso para en ese momento, así que la base de datos solo trabaja para clientes que todavía esperan. Aun así no llega a ${Math.round(CAP)} por segundo: una consulta lenta que empieza con muy poco tiempo se corta al llegar el plazo, y ese trabajo se pierde.`,
    ),
    watch: { mode: "deadline", client: 2, inner: "short", db: "slow", gw: "fast" },
  },
  {
    id: "budget",
    title: t("The budget runs out mid-chain", "El presupuesto se acaba a mitad de camino"),
    change: t(`The gateway's own step now takes up to ${sec(GW_SLOW)} · inner timeouts stay shorter than the client's (${sec(GW_T)}, ${sec(SVC_T)}) · fixed timeouts → one deadline`,
      `El paso propio del gateway ahora tarda hasta ${sec(GW_SLOW)} · los tiempos límite internos siguen más cortos que el del cliente (${sec(GW_T)}, ${sec(SVC_T)}) · tiempos límite fijos → un plazo`),
    question: t(`Every inner timeout is shorter than the client's ${CLIENT}. Can the database still work for clients who are gone?`,
      `Todos los tiempos límite internos son más cortos que los ${CLIENT} del cliente. ¿Puede la base de datos seguir trabajando para clientes que ya se fueron?`),
    options: [
      t("No: with every inner timeout shorter, no hop can outlast the client", "No: con todos los tiempos límite internos más cortos, ningún salto puede durar más que el cliente"),
      t("Yes: each hop's clock starts when the call arrives", "Sí: el reloj de cada salto arranca cuando llega la llamada"),
      t("Only for requests that hit a hung query", "Solo en las solicitudes que dan con una consulta colgada"),
    ],
    answer: 1,
    why: t(
      `Ordering the timeouts isn't enough. A fixed timeout counts from the moment its hop got the call, not from when the user clicked, so a call that reaches the service with 0.3 s left still gives the database ${sec(SVC_T)}. A deadline carries the time actually left: a hop that can't finish in it (here, with less time than it usually needs) refuses at once and the client gets an explicit error. About as many requests succeed either way, because the time spent upstream is gone; the deadline stops paying for requests that can no longer succeed.`,
      `Ordenar los tiempos límite no alcanza. Un tiempo límite fijo cuenta desde que su salto recibió la llamada, no desde que el usuario hizo clic, así que una llamada que llega al servicio con 0.3 s de margen igual le da ${sec(SVC_T)} a la base de datos. Un plazo lleva el tiempo que de verdad queda: un salto que no puede terminar en ese tiempo (aquí, con menos tiempo del que suele necesitar) rechaza de inmediato y el cliente recibe un error explícito. Tienen éxito más o menos las mismas solicitudes en ambos casos, porque el tiempo gastado arriba ya no vuelve; el plazo deja de pagar por solicitudes que ya no pueden tener éxito.`,
    ),
    watch: { mode: "fixed", client: 2, inner: "short", db: "ok", gw: "slow" },
  },
  {
    id: "pct",
    title: t("Pick the timeout from percentiles", "Elige el tiempo límite con percentiles"),
    change: t(`A healthy chain, one deadline · the client's timeout ${CLIENT} → 1 s, about twice the median answer time (${s2(LAT.p50)})`,
      `Una cadena sana, un plazo · el tiempo límite del cliente ${CLIENT} → 1 s, más o menos el doble del tiempo mediano de respuesta (${s2(LAT.p50)})`),
    question: t("On a healthy day, with nothing hanging, how many requests time out at 1 s?", "En un día sano, sin nada colgado, ¿cuántas solicitudes vencen con 1 s?"),
    options: [
      t("Almost none: twice the usual time is plenty of headroom", "Casi ninguna: el doble del tiempo habitual es mucho margen"),
      t("A few percent: the slowest requests take more than twice the median", "Un pequeño porcentaje: las más lentas tardan más del doble de la mediana"),
      t("About half: half the requests are slower than the median", "Cerca de la mitad: la mitad de las solicitudes son más lentas que la mediana"),
    ],
    answer: 1,
    why: t(
      `The median says nothing about the tail. Here the p99 is ${s2(LAT.p99)} and the p99.9 ${s2(LAT.p999)}, so a 1 s timeout cuts off the slowest few percent on a perfectly healthy day: each one an error the user sees, and often a retry. Set the client's timeout from measured latency, above the p99.9 with some headroom; give each inner hop a smaller budget from its own percentiles; measure again when the system changes. A timeout above the tail costs nothing on a good day and still bounds a bad one.`,
      `La mediana no dice nada de la cola. Aquí el p99 es ${s2(LAT.p99)} y el p99.9 ${s2(LAT.p999)}, así que un tiempo límite de 1 s corta al pequeño porcentaje más lento en un día perfectamente sano: cada una es un error que el usuario ve, y muchas veces un reintento. Pon el tiempo límite del cliente a partir de la latencia medida, por encima del p99.9 con algo de margen; dale a cada salto interno un presupuesto menor a partir de sus propios percentiles; vuelve a medir cuando el sistema cambie. Un tiempo límite por encima de la cola no cuesta nada en un día bueno y aun así acota uno malo.`,
    ),
    watch: { mode: "deadline", client: 1, inner: "short", db: "ok", gw: "fast" },
  },
];

const QUESTIONS = [
  [t("A call times out. Why doesn't that stop the work the call started?", "Una llamada vence. ¿Por qué eso no detiene el trabajo que la llamada empezó?"),
    t("A timeout ends the caller's wait, nothing more. The callee only finds out if something carries the news: a cancelled gRPC call, a closed connection the server notices, a context the code passes down and actually checks. Without that, the callee and everything it called keep working, holding workers, connections and locks, for a result nobody will read.",
      "Un tiempo límite termina la espera del llamador, nada más. El servicio llamado solo se entera si algo lleva la noticia: una llamada gRPC cancelada, una conexión cerrada que el servidor detecta, un contexto que el código pasa hacia abajo y de verdad revisa. Sin eso, el servicio llamado y todo lo que llamó siguen trabajando, reteniendo trabajadores, conexiones y bloqueos (locks), por un resultado que nadie va a leer.")],
  [t("How should timeouts be ordered along a chain of calls, and why is ordering not enough?", "¿Cómo deberían ordenarse los tiempos límite a lo largo de una cadena de llamadas, y por qué ordenarlos no alcanza?"),
    t("Each hop's timeout should be shorter than its caller's, so the innermost gives up first and an error travels back while every caller is still listening. It isn't enough because fixed timeouts restart at every hop: time spent queuing or working upstream isn't subtracted, so a call can start with almost no time left and still get its full timeout. Pass the remaining time down instead.",
      "El tiempo límite de cada salto debería ser más corto que el de quien lo llama, para que el más interno se rinda primero y un error vuelva mientras cada llamador todavía escucha. No alcanza porque los tiempos límite fijos vuelven a empezar en cada salto: el tiempo gastado arriba en colas o trabajo no se descuenta, así que una llamada puede empezar casi sin tiempo y aun así recibir su tiempo límite completo. Mejor pasa hacia abajo el tiempo que queda.")],
  [t("What does deadline propagation look like in real code?", "¿Cómo se ve la propagación de plazos (deadline propagation) en código real?"),
    t("The edge decides when an answer stops being useful. Each hop passes the time left on to every call it makes: gRPC sends it with each call (the grpc-timeout header) and ends the call with DEADLINE_EXCEEDED when it runs out; Go code carries it in a context.Context made with context.WithTimeout or WithDeadline and passes that context to every outgoing call and query; Envoy can tell the upstream its route timeout in the x-envoy-expected-rq-timeout-ms header. Before starting work, a hop checks the time left and refuses if it can't finish; when the deadline passes or the caller cancels, it stops.",
      "El borde (edge) decide cuándo una respuesta deja de servir. Cada salto pasa el tiempo que queda a cada llamada que hace: gRPC lo envía con cada llamada (el encabezado grpc-timeout) y termina la llamada con DEADLINE_EXCEEDED cuando se acaba; el código en Go lo lleva en un context.Context creado con context.WithTimeout o WithDeadline y pasa ese contexto a cada llamada y consulta que hace; Envoy puede avisarle al upstream el tiempo límite de su ruta en el encabezado x-envoy-expected-rq-timeout-ms. Antes de empezar a trabajar, un salto revisa el tiempo que queda y rechaza si no puede terminar; cuando el plazo pasa o el llamador cancela, se detiene.")],
  [t("Your database has no statement timeout and the service in front of it gives up after 1.5 s. What do you change?", "Tu base de datos no tiene tiempo límite por sentencia y el servicio de adelante se rinde a los 1.5 s. ¿Qué cambias?"),
    t("Give the query the time that is left: pass the request's context to the driver so the query is cancelled when the deadline passes (many drivers send a cancel to the server), or set a per-query limit from the remaining time (in PostgreSQL, statement_timeout, which can be set per transaction). Keep a server-side ceiling too, so a forgotten client can't hold a connection forever. Otherwise a hung query keeps a connection busy long after anyone wants it, and the pool runs dry (lesson 29, Connection pooling).",
      "Dale a la consulta el tiempo que queda: pasa el contexto de la solicitud al driver para que la consulta se cancele cuando pasa el plazo (muchos drivers le envían una cancelación al servidor), o pon un tiempo límite por consulta a partir del tiempo restante (en PostgreSQL, statement_timeout, que se puede fijar por transacción). Mantén también un tope del lado del servidor, para que un cliente olvidado no retenga una conexión para siempre. Si no, una consulta colgada mantiene ocupada una conexión mucho después de que alguien la quiera, y el pool se queda vacío (lección 29, Pool de conexiones).")],
  [t("How do you choose the numbers: the client's deadline and each hop's budget?", "¿Cómo eliges los números: el plazo del cliente y el presupuesto de cada salto?"),
    t("From measured latency, not from a guess. The client's deadline goes above the p99.9 of healthy end-to-end latency with some headroom, and below the point where the user has given up anyway. Each inner hop gets a budget from its own p99 or p99.9, smaller than its caller's. Measure again after changes. A timeout of twice the median cuts off the tail on a healthy day (lesson 44, Percentiles, shows how far the tail sits from the median).",
      "A partir de la latencia medida, no de una suposición. El plazo del cliente va por encima del p99.9 de la latencia de punta a punta en un día sano, con algo de margen, y por debajo del punto en el que el usuario igual ya se rindió. Cada salto interno recibe un presupuesto a partir de su propio p99 o p99.9, menor que el de quien lo llama. Vuelve a medir después de cada cambio. Un tiempo límite del doble de la mediana corta la cola en un día sano (la lección 44, Percentiles, muestra qué tan lejos de la mediana queda la cola).")],
  [t(`In experiment 3, with one deadline, the slow chain still answered only ${pct(RESULTS.slow.deadline.ok)} of the requests in time. Why, and what else helps?`, `En el experimento 3, con un plazo, la cadena lenta igual respondió a tiempo solo el ${pct(RESULTS.slow.deadline.ok)} de las solicitudes. ¿Por qué, y qué más ayuda?`),
    t("A deadline stops the work nobody will use; it doesn't add capacity. Under overload a first-come-first-served line hands each worker the call with the least time left, and a slow query that starts late is cut off anyway. Estimating the time a call needs from current latency rather than the healthy one, bounding the line, serving the newest calls first under overload (lesson 34, Stacks), shedding load at the edge (lesson 47, Load shedding and backpressure), and making callers back off (lesson 06, Retry storms) or stop calling (lesson 04, Circuit breakers) all help. Deadlines make sure the work you do is for someone still waiting.",
      "Un plazo detiene el trabajo que nadie va a usar; no agrega capacidad. Con sobrecarga, una cola por orden de llegada le da a cada trabajador la llamada con menos tiempo restante, y una consulta lenta que empieza tarde se corta de todos modos. Estimar el tiempo que necesita una llamada con la latencia actual y no con la de un día sano, acotar la cola, atender primero las llamadas más nuevas bajo sobrecarga (lección 34, Pilas), descartar carga en el borde (lección 47, Descarte de carga y contrapresión) y hacer que los llamadores esperen antes de reintentar (lección 06, Tormentas de reintentos) o dejen de llamar (lección 04, Interruptores de circuito) ayudan. Los plazos aseguran que el trabajo que haces sea para alguien que todavía espera.")],
];

export default defineLesson({
  title: t("Timeouts & Deadlines Workbench", "Banco de trabajo: tiempos límite y plazos"),
  eyebrow: t("Systems lesson 46 · Timeouts & deadlines", "Lección de sistemas 46 · Tiempos límite y plazos"),
  lede: t("A request crosses a chain of services. If every hop keeps its own timeout, the inner hops go on working after the caller has given up; if the time left travels with the request as one deadline, each hop knows when to refuse and when to stop. This lesson runs a relay of desks passing dockets: watch a machine do it, predict what breaks it, then explain it back.",
    "Una solicitud cruza una cadena de servicios. Si cada salto tiene su propio tiempo límite (timeout), los saltos internos siguen trabajando después de que el llamador se rindió; si el tiempo que queda viaja con la solicitud como un solo plazo (deadline), cada salto sabe cuándo rechazar y cuándo parar. Esta lección usa una cadena de escritorios que se pasan fichas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("The client's desk sends a docket for each request to the gateway, which passes one on to the service, which passes one on to the database. Every docket shows how long its client has left. Watch for black dockets: work for a client who has already given up or already has its answer. Then make queries hang, slow the database down, or switch to one deadline.",
      "El escritorio del cliente envía una ficha por cada solicitud al gateway, que pasa otra al servicio, que pasa otra a la base de datos. Cada ficha muestra cuánto tiempo le queda a su cliente. Fíjate en las fichas negras: trabajo para un cliente que ya se rindió o que ya tiene su respuesta. Luego haz que las consultas se cuelguen, vuelve lenta la base de datos o cambia a un solo plazo."),
    plate: {
      title: t("Relay desks", "Escritorios en cadena"),
      keys: [
        { mark: "lit", label: t("A docket whose client already gave up or has its answer: work for nobody", "Una ficha cuyo cliente ya se rindió o ya tiene su respuesta: trabajo para nadie") },
        { mark: "raised", label: t("Dockets: the seconds the client has left, printed on top", "Fichas: los segundos que le quedan al cliente, impresos arriba") },
        { mark: "flat", label: t("Trays: one per worker; a docket on a tray holds that worker", "Bandejas: una por trabajador; una ficha en una bandeja retiene a ese trabajador") },
      ],
      caption: t(
        `Requests arrive at random, ${RATE} a second. A docket waits on the lane until a worker at the next desk is free, then sits on that worker's tray while the hop does its part and, for the gateway and the service, while it waits for the next hop's answer. The right side of each desk shows how long it waits for that answer; the front counts the worker-seconds it spent after the client already had its outcome. With fixed timeouts each desk keeps its own clock and nobody downstream hears when a caller gives up. With one deadline every desk reads the time left on the docket, refuses a call it can't finish, and drops the docket the moment the time runs out. The table in front of the database holds its line once the lane is full; its counter shows how many calls wait.`,
        `Las solicitudes llegan al azar, ${RATE} por segundo. Una ficha espera en el carril hasta que se libera un trabajador del escritorio siguiente; después queda en la bandeja de ese trabajador mientras el salto hace su parte y, en el gateway y el servicio, mientras espera la respuesta del salto siguiente. El costado derecho de cada escritorio muestra cuánto espera esa respuesta; el frente cuenta los segundos de trabajo que gastó cuando el cliente ya tenía su resultado. Con tiempos límite fijos, cada escritorio lleva su propio reloj y nadie más abajo se entera cuando un llamador se rinde. Con un plazo, cada escritorio lee en la ficha el tiempo que queda, rechaza una llamada que no puede terminar y suelta la ficha en cuanto se acaba el tiempo. La mesa delante de la base de datos sostiene su cola cuando el carril se llena; su contador muestra cuántas llamadas esperan.`,
      ),
      stage: { "data-office": "" },
      label: t("Simulation of a chain of services with timeouts and deadlines. Space pauses or resumes.", "Simulación de una cadena de servicios con tiempos límite y plazos. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["ok", t("Answered in time", "Respondidas a tiempo")], ["late", t("Client gave up", "El cliente se rindió")], ["errors", t("Errors", "Errores")], ["wasted", t("Wasted work", "Trabajo perdido"), "0 s"], ["nobody", t("Working for nobody", "Trabajando para nadie")], ["rate", t("In time, last 30 s", "A tiempo, últimos 30 s"), "–"]],
    controls: [
      { seg: "mode", label: t("Timeouts", "Tiempos límite"), options: [["fixed", t("Each hop its own", "Cada salto el suyo")], ["deadline", t("One deadline, passed on", "Un plazo que se pasa")]], value: "fixed" },
      { seg: "client", label: t("Client timeout", "Tiempo límite del cliente"), options: [[1, "1 s"], [2, "2 s"], [4, "4 s"]], value: 2 },
      { seg: "inner", label: t("Inner timeouts", "Tiempos límite internos"), options: [["short", t("Shorter than the client's", "Más cortos que el del cliente")], ["long", t("Longer than the client's", "Más largos que el del cliente")]], value: "short", for: "fixed" },
      { seg: "db", label: t("Database", "Base de datos"), options: [["ok", t("Healthy", "Sana")], ["stall", t(`1 in ${Math.round(1 / STALL.p)} hangs`, `1 de cada ${Math.round(1 / STALL.p)} se cuelga`)], ["slow", t(`${SLOW}× slower`, `${SLOW}× más lenta`)]], value: "stall" },
      { seg: "gw", label: t("Gateway step", "Paso del gateway"), options: [["fast", t("Quick", "Rápido")], ["slow", t(`Up to ${sec(GW_SLOW)}`, `Hasta ${sec(GW_SLOW)}`)]], value: "fast" },
      { speed: true, value: 0.5 },
      { actions: [["hang", t("Hang the next query", "Colgar la próxima consulta")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      `Workers: gateway ${WORKERS[0]}, service ${WORKERS[1]}, database ${WORKERS[2]}. Inner timeouts are set from the client's (shorter: ${INNERTXT("en", "short")}; longer: ${INNERTXT("en", "long")}). With one deadline, a desk refuses a call with less time left than it usually needs (gateway ${NEED[0]} s, service ${NEED[1]} s, database ${NEED[2]} s). Changing a setting starts the run again.`,
      `Trabajadores: gateway ${WORKERS[0]}, servicio ${WORKERS[1]}, base de datos ${WORKERS[2]}. Los tiempos límite internos se calculan a partir del tiempo límite del cliente (más cortos: ${INNERTXT("es", "short")}; más largos: ${INNERTXT("es", "long")}). Con un plazo, un escritorio rechaza una llamada con menos tiempo del que suele necesitar (gateway ${NEED[0]} s, servicio ${NEED[1]} s, base de datos ${NEED[2]} s). Cambiar un ajuste reinicia la ejecución.`,
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs of two minutes each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre seis ejecuciones con semilla fija de dos minutos cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Deadline and cancellation propagation as described in <a href="https://grpc.io/docs/guides/deadlines/" target="_blank" rel="noopener">gRPC's guide to deadlines</a> and the <a href="https://sre.google/sre-book/addressing-cascading-failures/" target="_blank" rel="noopener">Addressing Cascading Failures</a> chapter of Google's SRE book.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. La propagación de plazos y cancelaciones sigue lo que describen la <a href="https://grpc.io/docs/guides/deadlines/" target="_blank" rel="noopener">guía de deadlines de gRPC</a> y el capítulo <a href="https://sre.google/sre-book/addressing-cascading-failures/" target="_blank" rel="noopener">Addressing Cascading Failures</a> del libro de SRE de Google.`),
  css: `
.iso-stage [data-layer] text{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    DOCKET_SVG: docketSvg(),
  },
});

function INNERTXT(lang, which) {
  const [a, b] = INNER[which];
  return lang === "es" ? `gateway ${a}×, servicio ${b}×` : `gateway ${a}×, service ${b}×`;
}
