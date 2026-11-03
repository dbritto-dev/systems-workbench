// @ts-nocheck: content ported as-is
// Systems lesson 28 · Cache stampede: a bakery whose trays all expire at once.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, P, GEOMETRY } from "./figure";
import { deployRun, hotRun } from "./sim";
import { one, n0 } from "../../lib/format";

// Experiment results, computed at build time from the same model the page runs (the original computed them in the
// browser when a card was run; they are seeded, so the numbers are the same).
const RESULTS = {
  deploy: deployRun(0), jitter: deployRun(0.2),
  all: hotRun("all"), single: hotRun("single"),
  single1: hotRun("single", 1), stale1: hotRun("stale", 1),
  slowFast: hotRun("all", 0.2, 200), slowSlow: hotRun("all", 1, 200),
};

// What each card shows after a run.
const RUNS = {
  deploy: () => {
    const r = RESULTS.deploy, top = Math.max(r.peak, r.capacity);
    return { verdict: t("At the 30 s mark the oven got up to " + n0(r.peak) + " orders in one second, against a capacity of " + n0(r.capacity) + ". " + n0(r.dups) + " of " + n0(r.orders) + " orders were duplicates, and the unluckiest customer waited " + one(r.maxWait) + " s.",
        "Cerca del segundo 30 el horno llegó a " + n0(r.peak) + " pedidos en un segundo, con una capacidad de " + n0(r.capacity) + ". " + n0(r.dups) + " de " + n0(r.orders) + " pedidos fueron duplicados, y el cliente con peor suerte esperó " + one(r.maxWait) + " s."),
      bars: [[t("Oven capacity per second", "Capacidad del horno por segundo"), r.capacity / top, n0(r.capacity)], [t("Busiest second", "Segundo de más trabajo"), r.peak / top, n0(r.peak), true], [t("Duplicate orders", "Pedidos duplicados"), r.dups / r.orders, t(n0(r.dups) + " of " + n0(r.orders), n0(r.dups) + " de " + n0(r.orders)), true]] };
  },
  jitter: () => {
    const a = RESULTS.deploy, b = RESULTS.jitter, top = Math.max(a.peak, b.peak, a.capacity), wtop = Math.max(a.maxWait, b.maxWait);
    return { verdict: t("With jitter the busiest second fell from " + n0(a.peak) + " to " + n0(b.peak) + " orders (the oven takes " + n0(a.capacity) + "), and the longest wait from " + one(a.maxWait) + " s to " + one(b.maxWait) + " s.",
        "Con jitter el segundo de más trabajo bajó de " + n0(a.peak) + " a " + n0(b.peak) + " pedidos (el horno acepta " + n0(a.capacity) + "), y la espera más larga de " + one(a.maxWait) + " s a " + one(b.maxWait) + " s."),
      bars: [[t("Busiest second, equal TTL", "Segundo de más trabajo, mismo TTL"), a.peak / top, n0(a.peak)], [t("Busiest second, ±20 %", "Segundo de más trabajo, ±20 %"), b.peak / top, n0(b.peak), true], [t("Longest wait, equal TTL", "Espera más larga, mismo TTL"), a.maxWait / wtop, one(a.maxWait) + " s"], [t("Longest wait, ±20 %", "Espera más larga, ±20 %"), b.maxWait / wtop, one(b.maxWait) + " s", true]] };
  },
  single: () => {
    const a = RESULTS.all, b = RESULTS.single, top = a.perExpiry, wtop = Math.max(a.maxWait, b.maxWait);
    return { verdict: t("Orders per expiry: " + n0(a.perExpiry) + " when every miss orders, " + n0(b.perExpiry) + " with single-flight. The longest wait fell from " + one(a.maxWait) + " s to " + one(b.maxWait) + " s, because no queue forms.",
        "Pedidos por vencimiento: " + n0(a.perExpiry) + " si cada fallo pide, " + n0(b.perExpiry) + " con single-flight. La espera más larga bajó de " + one(a.maxWait) + " s a " + one(b.maxWait) + " s, porque no se forma cola."),
      bars: [[t("Orders per expiry, everyone orders", "Pedidos por vencimiento, todos piden"), a.perExpiry / top, n0(a.perExpiry)], [t("Orders per expiry, single-flight", "Pedidos por vencimiento, single-flight"), b.perExpiry / top, n0(b.perExpiry), true], [t("Longest wait, everyone orders", "Espera más larga, todos piden"), a.maxWait / wtop, one(a.maxWait) + " s"], [t("Longest wait, single-flight", "Espera más larga, single-flight"), b.maxWait / wtop, one(b.maxWait) + " s", true]] };
  },
  stale: () => {
    const a = RESULTS.single1, b = RESULTS.stale1, top = Math.max(a.waitedPerExpiry, b.stalePerExpiry);
    return { verdict: t("Single-flight: " + n0(a.waitedPerExpiry) + " customers waited at each expiry, up to " + one(a.maxWait) + " s. Stale-while-revalidate: " + n0(b.waitedPerExpiry) + " waited and " + n0(b.stalePerExpiry) + " got the old loaf; the oven still baked " + n0(b.perExpiry) + " order per expiry.",
        "Single-flight: " + n0(a.waitedPerExpiry) + " clientes esperaron en cada vencimiento, hasta " + one(a.maxWait) + " s. Stale-while-revalidate: " + n0(b.waitedPerExpiry) + " esperaron y " + n0(b.stalePerExpiry) + " recibieron el pan viejo; el horno siguió horneando " + n0(b.perExpiry) + " pedido por vencimiento."),
      bars: [[t("Waited per expiry, single-flight", "Esperaron por vencimiento, single-flight"), a.waitedPerExpiry / top, n0(a.waitedPerExpiry)], [t("Waited per expiry, stale", "Esperaron por vencimiento, viejo"), b.waitedPerExpiry / top, n0(b.waitedPerExpiry), true], [t("Served stale per expiry", "Viejos servidos por vencimiento"), b.stalePerExpiry / top, n0(b.stalePerExpiry), true]] };
  },
  slow: () => {
    const a = RESULTS.slowFast, b = RESULTS.slowSlow, wtop = Math.max(a.maxWait, b.maxWait), otop = Math.max(a.perExpiry, b.perExpiry);
    return { verdict: t("Bake 0.2 s: " + n0(a.perExpiry) + " orders per expiry, longest wait " + one(a.maxWait) + " s. Bake 1 s: " + n0(b.perExpiry) + " orders, longest wait " + one(b.maxWait) + " s, " + Math.round(b.maxWait / a.maxWait) + " times longer for a bake five times slower.",
        "Horneado de 0.2 s: " + n0(a.perExpiry) + " pedidos por vencimiento, espera más larga " + one(a.maxWait) + " s. Horneado de 1 s: " + n0(b.perExpiry) + " pedidos, espera más larga " + one(b.maxWait) + " s, " + Math.round(b.maxWait / a.maxWait) + " veces más larga por un horneado cinco veces más lento."),
      bars: [[t("Orders per expiry, 0.2 s bake", "Pedidos por vencimiento, horneado de 0.2 s"), a.perExpiry / otop, n0(a.perExpiry)], [t("Orders per expiry, 1 s bake", "Pedidos por vencimiento, horneado de 1 s"), b.perExpiry / otop, n0(b.perExpiry), true], [t("Longest wait, 0.2 s bake", "Espera más larga, horneado de 0.2 s"), a.maxWait / wtop, one(a.maxWait) + " s"], [t("Longest wait, 1 s bake", "Espera más larga, horneado de 1 s"), b.maxWait / wtop, one(b.maxWait) + " s", true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "deploy",
    title: t("Everything expires at once", "Todo vence a la vez"),
    change: t("A deploy fills 50 keys at the same moment, all with a 30 s TTL · 500 requests a second spread evenly · the oven has 8 shelves and bakes in 0.2 s, so it can take 40 orders a second", "Un despliegue llena 50 claves en el mismo instante, todas con un TTL de 30 s · 500 solicitudes por segundo repartidas de forma pareja · el horno tiene 8 repisas y hornea en 0.2 s, así que acepta 40 pedidos por segundo"),
    question: t("What happens around the 30 s mark?", "¿Qué pasa cerca del segundo 30?"),
    options: [t("Not much: each key is refreshed once, 50 orders in all", "Poca cosa: cada clave se refresca una vez, 50 pedidos en total"), t("A burst far above the oven's capacity, mostly duplicate orders, and customers waiting for seconds", "Una ráfaga muy por encima de la capacidad del horno, casi todo pedidos duplicados, y clientes esperando varios segundos"), t("Requests fail fast and the clients retry later", "Las solicitudes fallan rápido y los clientes reintentan después")],
    answer: 1,
    why: t("Every key was cached at the same instant with the same TTL, so they all expire in the same instant. Each request that arrives before its key is baked again misses and sends its own order, and the oven can only take 40 a second. The queue makes every bake slower, which keeps keys empty longer, which lets more requests miss: the herd feeds itself.", "Todas las claves se guardaron en caché en el mismo instante con el mismo TTL, así que todas vencen en el mismo instante. Cada solicitud que llega antes de que su clave se vuelva a hornear falla y manda su propio pedido, y el horno solo acepta 40 por segundo. La cola vuelve más lento cada horneado, lo que deja las claves vacías por más tiempo, lo que hace que fallen más solicitudes: la estampida se alimenta sola."),
    watch: { mode: "all", jitter: 0, bake: 1, rate: 12 },
  },
  {
    id: "jitter",
    title: t("Add ±20 % jitter", "Agrega ±20 % de jitter"),
    change: t("Same deploy · every TTL is multiplied by a random factor between 0.8 and 1.2", "El mismo despliegue · cada TTL se multiplica por un factor aleatorio entre 0.8 y 1.2"),
    question: t("What happens to the busiest second at the oven?", "¿Qué pasa con el segundo de más trabajo en el horno?"),
    options: [t("About the same: the same keys still expire", "Más o menos igual: vencen las mismas claves"), t("It drops to well under the oven's capacity", "Baja muy por debajo de la capacidad del horno"), t("It gets worse: expiries now land at random times", "Empeora: ahora los vencimientos caen en momentos al azar")],
    answer: 1,
    why: t("Jitter spreads the 50 expiries over 12 seconds instead of one instant. Each key's little herd is over before the next key expires, so the oven never queues and each refresh finishes in one bake. Jitter costs nothing and fixes the synchronised case, but a single very hot key still has its own herd.", "El jitter reparte los 50 vencimientos en 12 segundos en lugar de un instante. La pequeña estampida de cada clave termina antes de que venza la siguiente, así que el horno nunca hace cola y cada refresco termina en un horneado. El jitter no cuesta nada y arregla el caso sincronizado, pero una sola clave muy popular todavía tiene su propia estampida."),
    watch: { mode: "all", jitter: 0.2, bake: 1, rate: 12 },
  },
  {
    id: "single",
    title: t("One order per tray", "Un pedido por bandeja"),
    change: t("One hot key at 500 requests a second · 10 s TTL · 0.2 s bake · a miss now waits for the order already in the oven instead of sending its own (single-flight, request coalescing)", "Una clave popular a 500 solicitudes por segundo · TTL de 10 s · horneado de 0.2 s · un fallo ahora espera el pedido que ya está en el horno en lugar de mandar el suyo (single-flight, agrupación de solicitudes)"),
    question: t("How many oven orders does each expiry cause now?", "¿Cuántos pedidos al horno causa ahora cada vencimiento?"),
    options: [t("About 100, the same as before", "Unos 100, igual que antes"), t("About 50: half the customers still order", "Unos 50: la mitad de los clientes todavía pide"), t("One", "Uno")],
    answer: 2,
    why: t("With every miss ordering, about 100 requests arrive during the bake and each sends a duplicate. Coalescing keeps one in-flight order per key; everyone else waits on it and is served by the same result. The oven sees one order per expiry, so the queue never forms and even the waiting customers are served sooner.", "Si cada fallo pide, llegan unas 100 solicitudes durante el horneado y cada una manda un duplicado. Agrupar deja un solo pedido en curso por clave; todos los demás lo esperan y reciben el mismo resultado. El horno ve un pedido por vencimiento, así que la cola nunca se forma y hasta los clientes que esperan reciben antes."),
    watch: { mode: "single", jitter: 0, bake: 1, rate: 12 },
  },
  {
    id: "stale",
    title: t("Serve the old loaf", "Sirve el pan viejo"),
    change: t("Same hot key, but a bake now takes 1 s · single-flight vs stale-while-revalidate (serve the expired loaf at once and refresh it with one background order)", "La misma clave popular, pero ahora un horneado tarda 1 s · single-flight vs stale-while-revalidate (servir el pan vencido de inmediato y refrescarlo con un pedido en segundo plano)"),
    question: t("With single-flight, about 500 customers wait up to a second at every expiry. With stale-while-revalidate…", "Con single-flight, unos 500 clientes esperan hasta un segundo en cada vencimiento. Con stale-while-revalidate…"),
    options: [t("The same customers wait, just a little less", "Esperan los mismos clientes, solo un poco menos"), t("Nobody waits; about 500 customers get a loaf up to a second past its expiry", "Nadie espera; unos 500 clientes reciben un pan hasta un segundo después de su vencimiento"), t("The oven bakes 500 times instead of once", "El horno hornea 500 veces en lugar de una")],
    answer: 1,
    why: t("Single-flight removes the duplicate work but not the wait: everyone who arrives during the bake waits for it. Stale-while-revalidate keeps serving the old value while one background order refreshes it, so the expiry becomes invisible to users. The price is freshness: for one bake's time, people see data slightly past its TTL, which is fine for a product page and not for a balance.", "Single-flight elimina el trabajo duplicado, pero no la espera: todos los que llegan durante el horneado lo esperan. Stale-while-revalidate sigue sirviendo el valor viejo mientras un pedido en segundo plano lo refresca, así que el vencimiento se vuelve invisible para los usuarios. El precio es la frescura: durante un horneado la gente ve datos un poco pasados de su TTL, lo que está bien para una página de producto y no para un saldo."),
    watch: { mode: "stale", jitter: 0, bake: 1, rate: 12 },
  },
  {
    id: "slow",
    title: t("A slower oven", "Un horno más lento"),
    change: t("One hot key at 200 requests a second · every miss orders · bake time 0.2 s → 1 s (five times slower)", "Una clave popular a 200 solicitudes por segundo · cada fallo pide · horneado de 0.2 s → 1 s (cinco veces más lento)"),
    question: t("What happens to the longest wait at an expiry?", "¿Qué pasa con la espera más larga en un vencimiento?"),
    options: [t("About five times longer, in line with the bake", "Cerca de cinco veces más larga, igual que el horneado"), t("Far more than five times longer: the herd outgrows the oven", "Mucho más de cinco veces más larga: la estampida supera al horno"), t("Unchanged: the first order still finishes after one bake", "Igual: el primer pedido sigue terminando después de un horneado")],
    answer: 1,
    why: t("A slower bake keeps the key empty five times longer, so five times as many requests miss, and they all land on the same eight shelves. Once the herd is bigger than what the oven can bake before the next customers arrive, the queue grows and the last orders wait for every duplicate ahead of them. Stampedes hurt most exactly when the database is already slow.", "Un horneado más lento deja la clave vacía cinco veces más tiempo, así que fallan cinco veces más solicitudes, y todas caen en las mismas ocho repisas. Cuando la estampida es más grande de lo que el horno alcanza a hornear antes de que lleguen los siguientes clientes, la cola crece y los últimos pedidos esperan a todos los duplicados de adelante. Las estampidas duelen más justo cuando la base de datos ya está lenta."),
    watch: { mode: "all", jitter: 0, bake: 2, rate: 12 },
  },
];

const QUESTIONS = [
  [t("What is a cache stampede, and why can it make the database slower than having no cache at all?", "¿Qué es una cache stampede (estampida de caché) y por qué puede dejar la base de datos más lenta que no tener caché?"),
    t("A hot entry expires and every request that arrives before it is rebuilt misses at the same moment and runs the same expensive query. The database sees a sudden burst of identical work it was never sized for (the cache was hiding that load), queues, slows down, and the slowdown keeps the entry empty longer, so even more requests miss.", "Vence una entrada popular y todas las solicitudes que llegan antes de que se reconstruya fallan al mismo tiempo y ejecutan la misma consulta costosa. La base de datos recibe de golpe una ráfaga de trabajo idéntico para la que nunca se dimensionó (la caché ocultaba esa carga), hace cola, se vuelve lenta, y esa lentitud deja la entrada vacía por más tiempo, así que fallan aún más solicitudes.")],
  [t("Why do deploys and cold starts cause synchronised expiry, and what does TTL jitter do about it?", "¿Por qué los despliegues y los arranques en frío causan vencimientos sincronizados, y qué hace el jitter en el TTL al respecto?"),
    t("A deploy or warm-up fills many keys within a few seconds, all with the same TTL, so they all expire together one TTL later and again after that. Multiplying each TTL by a small random factor (say 0.8–1.2) spreads those expiries over a window, so the refresh load arrives as a trickle the database can absorb.", "Un despliegue o un calentamiento llena muchas claves en pocos segundos, todas con el mismo TTL, así que todas vencen juntas un TTL después y otra vez después de eso. Multiplicar cada TTL por un pequeño factor aleatorio (por ejemplo 0.8–1.2) reparte esos vencimientos en una ventana, así que la carga de refresco llega como un goteo que la base de datos puede absorber.")],
  [t("How does request coalescing (single-flight) work, and what does it not solve across many app servers?", "¿Cómo funciona la agrupación de solicitudes (single-flight) y qué no resuelve cuando hay muchos servidores de aplicación?"),
    t("Each process keeps a map of in-flight refreshes per key; a miss that finds one waits on it instead of starting its own, so one query serves everyone. It works per process: with 50 instances you still get up to 50 queries per expiry. For one query in total you need a shared lock or lease (with a timeout, in case its holder dies), or you accept N.", "Cada proceso mantiene un mapa de refrescos en curso por clave; un fallo que encuentra uno lo espera en lugar de empezar el suyo, así que una consulta sirve a todos. Funciona por proceso: con 50 instancias todavía puedes tener hasta 50 consultas por vencimiento. Para una sola consulta en total necesitas un lock o lease compartido (con timeout, por si muere quien lo tiene), o aceptas N.")],
  [t("What does stale-while-revalidate trade, and where would you not use it?", "¿Qué sacrifica stale-while-revalidate y dónde no lo usarías?"),
    t("It keeps serving the expired value while one background refresh runs, so nobody waits and the database sees one query. The trade is freshness: readers can see data slightly older than the TTL. Fine for catalogues, feeds and counts; not for balances, permissions or anything where an old value causes a wrong decision.", "Sigue sirviendo el valor vencido mientras corre un refresco en segundo plano, así que nadie espera y la base de datos ve una sola consulta. Lo que sacrifica es la frescura: los lectores pueden ver datos un poco más viejos que el TTL. Está bien para catálogos, feeds y contadores; no para saldos, permisos ni nada donde un valor viejo lleve a una decisión equivocada.")],
  [t("What is probabilistic early expiration (XFetch), and why does it avoid a stampede without any coordination?", "¿Qué es el vencimiento anticipado probabilístico (XFetch) y por qué evita una estampida sin ninguna coordinación?"),
    t("Each request that hits a value near the end of its TTL refreshes it early with a probability that rises as expiry approaches (and with how slow the recompute is). Some request almost always refreshes the key just before it expires, so it never actually goes missing, and no lock or shared state is needed.", "Cada solicitud que encuentra un valor cerca del final de su TTL lo refresca antes de tiempo con una probabilidad que sube a medida que se acerca el vencimiento (y según qué tan lento sea recalcularlo). Casi siempre alguna solicitud refresca la clave justo antes de que venza, así que en la práctica nunca falta, y no hace falta ningún lock ni estado compartido.")],
  [t("Every hour on the hour your database CPU spikes for 30 seconds and the slow-query log shows the same query hundreds of times. Diagnose it and list the fixes you would try, in order.", "Cada hora en punto el CPU de tu base de datos se dispara durante 30 segundos y el log de consultas lentas muestra la misma consulta cientos de veces. Diagnostícalo y enumera los arreglos que probarías, en orden."),
    t("Many keys cached at the same time with a one-hour TTL, expiring together and stampeding. In order: add TTL jitter; coalesce refreshes per key (single-flight, or a lock with timeout across instances); serve stale while revalidating where freshness allows; refresh early (XFetch or a background job) for the hottest keys; and make the query itself cheaper or rate-limited so a herd can't take the database down.", "Muchas claves guardadas al mismo tiempo con un TTL de una hora, que vencen juntas y causan una estampida. En orden: agrega jitter al TTL; agrupa los refrescos por clave (single-flight, o un lock con timeout entre instancias); sirve lo viejo mientras revalidas donde la frescura lo permita; refresca antes de tiempo (XFetch o un job en segundo plano) las claves más populares; y haz la consulta más barata o con límite de tasa para que una estampida no pueda tumbar la base de datos.")],
];

export default defineLesson({
  title: t("Cache Stampede Workbench", "Banco de trabajo: cache stampede"),
  eyebrow: t("Systems lesson 28 · Cache stampede", "Lección de sistemas 28 · Cache stampede"),
  lede: t("A cache hides how much work the database would have to do. When a hot entry expires, every request that arrives before it is rebuilt misses at once and the database gets that hidden load in one burst. This lesson builds the herd and the fixes for it: watch a machine do it, predict what changes it, then explain it back.", "Una caché oculta cuánto trabajo tendría que hacer la base de datos. Cuando vence una entrada popular, todas las solicitudes que llegan antes de que se reconstruya fallan a la vez y la base de datos recibe esa carga oculta de golpe: una cache stampede (estampida de caché). Esta lección arma la estampida y sus arreglos: mira cómo lo hace una máquina, predice qué la cambia y después explícalo."),
  machine: {
    intro: t("A bakery with six trays in the case and an oven that bakes four orders at a time. Every tray was filled at the same moment, so they expire together. Watch customers line up, order tickets pile up on the rail and duplicate orders light up, then switch to one order per tray, serve stale, or add jitter.", "Una panadería con seis bandejas en la vitrina y un horno que hornea cuatro pedidos a la vez. Todas las bandejas se llenaron en el mismo momento, así que vencen juntas. Mira cómo los clientes hacen fila, los tickets se acumulan en el riel y los pedidos duplicados se iluminan; después cambia a un pedido por bandeja, sirve lo viejo o agrega jitter."),
    plate: {
      title: t("Bakery", "Panadería"),
      keys: [
        { mark: "lit", label: t("A duplicate order (that tray is already ordered), or an old loaf being served", "Un pedido duplicado (esa bandeja ya está pedida), o un pan viejo que se está sirviendo") },
        { mark: "raised", label: t("Trays, oven shelves, order tickets, customers and counters", "Bandejas, repisas del horno, tickets de pedido, clientes y contadores") },
        { mark: "flat", label: t("Expiry dials and the oven's load gauge", "Diales de vencimiento e indicador de carga del horno") },
      ],
      caption: t("Each tray in the case is a cached key; the wedge on its dial is the time it has left. When a loaf expires, customers who wanted it stand in front of its tray and orders go to the oven, the database. The oven bakes four at a time; the rest hang as numbered tickets on the rail, and the gauge shows how many orders are in. The tag above a shelf names the tray it is baking. With every miss ordering, the oven fills with the same tray over and over: those duplicates are lit, and each customer waits for their own order even after the first one has refilled the tray. With one order per tray, customers wait for the single order; with stale-while-revalidate the expired loaf stays out with an OLD tag while one fresh batch bakes.", "Cada bandeja de la vitrina es una clave en caché; la cuña de su dial es el tiempo que le queda. Cuando un pan vence, los clientes que lo querían se paran frente a su bandeja y los pedidos van al horno, la base de datos. El horno hornea cuatro a la vez; el resto cuelga como tickets numerados en el riel, y el indicador muestra cuántos pedidos hay dentro. La etiqueta sobre una repisa dice qué bandeja está horneando. Si cada fallo pide, el horno se llena de la misma bandeja una y otra vez: esos duplicados se iluminan, y cada cliente espera su propio pedido aunque el primero ya haya rellenado la bandeja. Con un pedido por bandeja, los clientes esperan el único pedido; con stale-while-revalidate el pan vencido sigue afuera con una etiqueta VIEJO mientras se hornea una tanda nueva."),
      stage: { "data-bakery": "" },
      label: t("Cache stampede simulation. Space pauses or resumes.", "Simulación de cache stampede. La barra espaciadora pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["requests", t("Requests", "Solicitudes")], ["hit", t("Hit rate", "Tasa de aciertos"), "–"], ["orders", t("Oven orders", "Pedidos al horno")], ["dups", t("Duplicates", "Duplicados")], ["wait", t("Longest wait", "Espera más larga"), "–"], ["stale", t("Stale served", "Viejos servidos")]],
    controls: [
      { seg: "mode", label: t("On a miss", "En un fallo"), options: [["all", t("Everyone orders", "Todos piden")], ["single", t("One order, others wait", "Un pedido, los demás esperan")], ["stale", t("Serve stale, refresh", "Servir viejo, refrescar")]], value: "all" },
      { seg: "jitter", label: t("Expiry", "Vencimiento"), options: [[0, t("Equal TTL", "Mismo TTL")], [0.2, t("±20 % jitter", "±20 % de jitter")]], value: 0 },
      { seg: "bake", label: t("Bake time", "Horneado"), options: [[0.5, "0.5 s"], [1, "1 s"], [2, "2 s"]], value: 1 },
      { seg: "rate", label: t("Customers", "Clientes"), options: [[6, "6/s"], [12, "12/s"], [24, "24/s"]], value: 12 },
      { speed: true },
      { actions: [["expire", t("Expire every tray now", "Vencer todas las bandejas")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Every tray is cached at the start, as after a deploy, with a 10 s TTL. Changing a setting starts the run again. Expire every tray now to watch a stampede on demand.", "Al empezar, todas las bandejas están en caché, como después de un despliegue, con un TTL de 10 s. Cambiar un ajuste vuelve a empezar la ejecución. Usa Vencer todas las bandejas para ver una estampida cuando quieras."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, at larger scale, averaged over six seeded runs.", "Cada experimento cambia una sola cosa. Elige qué esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, a mayor escala, promediados sobre seis ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Probabilistic early expiration follows Vattani, Chierichetti and Lowenstein, <em>Optimal Probabilistic Cache Stampede Prevention</em> (VLDB 2015).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. El vencimiento anticipado probabilístico sigue a Vattani, Chierichetti y Lowenstein, <em>Optimal Probabilistic Cache Stampede Prevention</em> (VLDB 2015).`),
  css: `
.iso-dial-fill{fill:var(--anatomy-faint);stroke:none}
body.lit-fill [data-shelf-tag]:has(> [data-shelf-lit]:not([style*="none"])) [data-shelf-num]{fill:var(--anatomy-page)}
`,
  data: {
    P,
    G: GEOMETRY,
  },
});
