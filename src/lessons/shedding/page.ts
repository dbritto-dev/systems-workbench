// @ts-nocheck: content in the lessons' plain-JS style
// Systems lesson 47 · Load shedding & backpressure: a takeaway kitchen past its capacity.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, slipSvg, flatSlipSvg, dishSvg, customerSvg, P, GEOMETRY, FIGURE_CSS } from "./figure";
import { overloadRun, doorRun, railRun, slowRun, rushRun, CAPACITY, DISH, PATIENCE, HOOKS, TARGET, INTERVAL, RUSH, SEEDS, LIVE_WARM } from "./sim";

// Experiment results, computed at build time from the same model the page runs (six seeds each).
const RESULTS = { overload: overloadRun(), door: doorRun(), rail: railRun(), slow: slowRun(), rush: rushRun() };

const PER_MIN = n0(CAPACITY * 60);
const pc = (x) => n0(x * 100) + "%";

// What each card shows after a run.
const RUNS = {
  overload: () => {
    const { under, over } = RESULTS.overload, top = Math.max(under.cookedMin, over.cookedMin, 1);
    return {
      verdict: t("Dishes cooked a minute: " + n0(under.cookedMin) + " at 80%, " + n0(over.cookedMin) + " at 150%. Handed over in time: " + n0(under.inTimeMin) + " at 80%, " + n0(over.inTimeMin) + " at 150%. After 3 minutes at 150%, " + n0(over.waiting) + " slips were waiting, the oldest for " + n0(over.oldest) + " s.",
        "Platos cocinados por minuto: " + n0(under.cookedMin) + " al 80%, " + n0(over.cookedMin) + " al 150%. Entregados a tiempo: " + n0(under.inTimeMin) + " al 80%, " + n0(over.inTimeMin) + " al 150%. A los 3 minutos al 150% esperaban " + n0(over.waiting) + " comandas, la más vieja desde hacía " + n0(over.oldest) + " s."),
      bars: [
        [t("Cooked / min, 80%", "Cocinados / min, 80%"), under.cookedMin / top, n0(under.cookedMin)],
        [t("In time / min, 80%", "A tiempo / min, 80%"), under.inTimeMin / top, n0(under.inTimeMin)],
        [t("Cooked / min, 150%", "Cocinados / min, 150%"), over.cookedMin / top, n0(over.cookedMin)],
        [t("In time / min, 150%", "A tiempo / min, 150%"), over.inTimeMin / top, n0(over.inTimeMin), true],
      ],
    };
  },
  door: () => {
    const { all, door } = RESULTS.door;
    return {
      verdict: t("Customers served in time: " + pc(all.served) + " accepting everyone, " + pc(door.served) + " with the limit at the door. The door turned " + pc(door.turned) + " away, each the moment they arrived. In time a minute: " + n0(all.inTimeMin) + " → " + n0(door.inTimeMin) + ".",
        "Clientes atendidos a tiempo: " + pc(all.served) + " aceptando a todos, " + pc(door.served) + " con el límite en la puerta. La puerta rechazó al " + pc(door.turned) + ", a cada uno en el momento en que llegó. A tiempo por minuto: " + n0(all.inTimeMin) + " → " + n0(door.inTimeMin) + "."),
      bars: [
        [t("In time, accept all", "A tiempo, aceptar todo"), all.served, pc(all.served)],
        [t("In time, limit at the door", "A tiempo, límite en la puerta"), door.served, pc(door.served), true],
        [t("Turned away at once", "Rechazados al instante"), door.turned, pc(door.turned)],
      ],
    };
  },
  rail: () => {
    const { all, rail, door } = RESULTS.rail, top = Math.max(all.inTimeMin, rail.inTimeMin, door.inTimeMin, 1);
    return {
      verdict: t("In time a minute: " + n0(all.inTimeMin) + " accepting everyone, " + n0(rail.inTimeMin) + " limiting only the rail, " + n0(door.inTimeMin) + " limiting at the door. After 3 minutes the rail held " + n0(rail.rail) + " slips and the desk " + n0(rail.front) + ", the oldest waiting " + n0(rail.oldest) + " s.",
        "A tiempo por minuto: " + n0(all.inTimeMin) + " aceptando a todos, " + n0(rail.inTimeMin) + " limitando solo el riel, " + n0(door.inTimeMin) + " limitando en la puerta. A los 3 minutos el riel tenía " + n0(rail.rail) + " comandas y el mostrador " + n0(rail.front) + ", la más vieja esperando desde hacía " + n0(rail.oldest) + " s."),
      bars: [
        [t("Accept all", "Aceptar todo"), all.inTimeMin / top, n0(all.inTimeMin)],
        [t("Limit the rail", "Limitar el riel"), rail.inTimeMin / top, n0(rail.inTimeMin), true],
        [t("Limit at the door", "Limitar en la puerta"), door.inTimeMin / top, n0(door.inTimeMin)],
      ],
    };
  },
  slow: () => {
    const { normalDoor, door, codel } = RESULTS.slow, top = Math.max(normalDoor.inTimeMin, door.inTimeMin, codel.inTimeMin, 1);
    return {
      verdict: t("In time a minute with the door limit: " + n0(normalDoor.inTimeMin) + " at " + DISH + " s a dish, " + n0(door.inTimeMin) + " at " + 2 * DISH + " s, while the cooks still made " + n0(door.cookedMin) + ". Dropping stale slips at " + 2 * DISH + " s a dish: " + n0(codel.inTimeMin) + " in time of " + n0(codel.cookedMin) + " cooked.",
        "A tiempo por minuto con el límite en la puerta: " + n0(normalDoor.inTimeMin) + " con " + DISH + " s por plato, " + n0(door.inTimeMin) + " con " + 2 * DISH + " s, mientras los cocineros seguían haciendo " + n0(door.cookedMin) + ". Descartando comandas viejas con " + 2 * DISH + " s por plato: " + n0(codel.inTimeMin) + " a tiempo de " + n0(codel.cookedMin) + " cocinados."),
      bars: [
        [t("Door limit, " + DISH + " s a dish", "Límite en la puerta, " + DISH + " s por plato"), normalDoor.inTimeMin / top, n0(normalDoor.inTimeMin)],
        [t("Door limit, " + 2 * DISH + " s a dish", "Límite en la puerta, " + 2 * DISH + " s por plato"), door.inTimeMin / top, n0(door.inTimeMin), true],
        [t("Drop stale, " + 2 * DISH + " s a dish", "Descartar viejas, " + 2 * DISH + " s por plato"), codel.inTimeMin / top, n0(codel.inTimeMin)],
      ],
    };
  },
  rush: () => {
    const { fifo, alifo, both } = RESULTS.rush, top = Math.max(fifo.missed, alifo.missed, both.missed, 1);
    return {
      verdict: t("Customers who came in that minute and missed their dish: " + n0(fifo.missed) + " oldest first, " + n0(alifo.missed) + " with adaptive LIFO. Of the customers who were not part of the rush, " + pc(fifo.othersServed) + " were served in time with oldest first and " + pc(alifo.othersServed) + " with adaptive LIFO. Adding dropping stale slips: " + n0(both.missed) + " missed, and the cooks made " + n0(both.cookedMin) + " dishes a minute, " + n0(both.inTimeMin) + " in time, instead of " + n0(alifo.cookedMin) + " with " + n0(alifo.inTimeMin) + " in time.",
        "Clientes que llegaron en ese minuto y se quedaron sin plato: " + n0(fifo.missed) + " con el más viejo primero, " + n0(alifo.missed) + " con LIFO adaptativo. De los clientes que no venían en la avalancha, se atendió a tiempo al " + pc(fifo.othersServed) + " con el más viejo primero y al " + pc(alifo.othersServed) + " con LIFO adaptativo. Sumando el descarte de comandas viejas: " + n0(both.missed) + " sin plato, y los cocineros hicieron " + n0(both.cookedMin) + " platos por minuto, " + n0(both.inTimeMin) + " a tiempo, en lugar de " + n0(alifo.cookedMin) + " con " + n0(alifo.inTimeMin) + " a tiempo."),
      bars: [
        [t("Missed, oldest first", "Sin plato, el más viejo primero"), fifo.missed / top, n0(fifo.missed), true],
        [t("Missed, adaptive LIFO", "Sin plato, LIFO adaptativo"), alifo.missed / top, n0(alifo.missed)],
        [t("Missed, adaptive LIFO + drop stale", "Sin plato, LIFO adaptativo + descarte"), both.missed / top, n0(both.missed)],
      ],
    };
  },
};

const EXPERIMENTS = [
  {
    id: "overload",
    title: t("Half again as many customers", "La mitad más de clientes"),
    change: t("Demand 80% → 150% of what the three cooks can make · everyone let in, oldest slip first · each customer waits " + PATIENCE + " s for the dish · minutes 1 to 3",
      "Demanda del 80% → 150% de lo que pueden hacer los tres cocineros · entran todos, la comanda más vieja primero · cada cliente espera " + PATIENCE + " s su plato · minutos 1 a 3"),
    question: t("What happens to dishes cooked a minute (throughput) and dishes handed over in time (goodput)?", "¿Qué pasa con los platos cocinados por minuto (rendimiento, throughput) y los entregados a tiempo (goodput)?"),
    options: [
      t("Both stay at the kitchen's maximum: the extra customers just wait longer", "Los dos se quedan en el máximo de la cocina: los clientes de más solo esperan un poco más"),
      t("Cooking stays at the maximum, but almost no dish reaches its customer in time", "Cocinar se queda en el máximo, pero casi ningún plato llega a tiempo a su cliente"),
      t("Both drop: a kitchen under pressure works slower", "Los dos bajan: una cocina bajo presión trabaja más lento"),
    ],
    answer: 1,
    why: t(
      "The cooks never stop, so throughput stays at capacity. But orders arrive faster than they leave, so the rail grows without end, and soon every new slip waits longer than its customer will. From then on the kitchen cooks only for people who have already left: fully busy, and useless. Accepting everyone didn't serve more people; it made sure almost nobody was served in time. Under overload, goodput is the number to protect, and a busy server is no evidence of it.",
      "Los cocineros nunca paran, así que el rendimiento (throughput) se queda en la capacidad. Pero los pedidos llegan más rápido de lo que salen, así que el riel crece sin fin, y pronto cada comanda nueva espera más de lo que su cliente va a aguantar. Desde ahí la cocina solo cocina para gente que ya se fue: ocupada al máximo, e inútil. Aceptar a todos no atendió a más gente; se aseguró de que casi nadie fuera atendido a tiempo. Bajo sobrecarga, el número que hay que proteger es el goodput (el trabajo útil), y un servidor ocupado no es prueba de él.",
    ),
    watch: { load: 1.5, policy: "all", order: "fifo", dish: DISH },
  },
  {
    id: "door",
    title: t("Say no at the door", "Decir que no en la puerta"),
    change: t("Demand 150% · everyone let in vs a limit of " + HOOKS + " slips waiting, enforced at the door: while the rail is full, new customers are turned away on arrival",
      "Demanda 150% · entran todos vs un límite de " + HOOKS + " comandas en espera, aplicado en la puerta: mientras el riel está lleno, los clientes nuevos se rechazan al llegar"),
    question: t("What share of customers gets their dish in time now?", "¿Qué parte de los clientes recibe ahora su plato a tiempo?"),
    options: [
      t("Fewer than before: turning people away can only lose orders", "Menos que antes: rechazar gente solo puede perder pedidos"),
      t("Nearly all: with a short queue the cooks work faster", "Casi todos: con una cola corta los cocineros trabajan más rápido"),
      t("About two in three: the kitchen's whole capacity, all in time, and the rest hear no at once", "Cerca de dos de cada tres: toda la capacidad de la cocina, todo a tiempo, y el resto oye que no al instante"),
    ],
    answer: 2,
    why: t(
      "The kitchen can cook two-thirds of the demand whatever you do. Accepting everyone spends that capacity on orders that will be late; a bounded queue spends it only on orders that can still make it, because " + HOOKS + " slips are a few seconds of work, well inside the customers' patience. The third that is turned away hears no immediately, while it can still go elsewhere or come back later, instead of after " + PATIENCE + " s of waiting. That is admission control: decide at the edge, before any work is spent.",
      "La cocina puede cocinar dos tercios de la demanda hagas lo que hagas. Aceptar a todos gasta esa capacidad en pedidos que van a llegar tarde; una cola acotada la gasta solo en pedidos que todavía pueden llegar, porque " + HOOKS + " comandas son unos pocos segundos de trabajo, bien dentro de la paciencia de los clientes. El tercio rechazado oye que no de inmediato, cuando todavía puede ir a otro lado o volver más tarde, en lugar de después de " + PATIENCE + " s de espera. Eso es control de admisión (admission control): decidir en el borde, antes de gastar trabajo.",
    ),
    watch: { load: 1.5, policy: "door", order: "fifo", dish: DISH },
  },
  {
    id: "rail",
    title: t("Limit the rail, not the door", "Limitar el riel, no la puerta"),
    change: t("Demand 150% · the rail holds at most " + HOOKS + " slips, but the door still lets everyone in: slips that don't fit wait on the order desk until a hook frees up",
      "Demanda 150% · el riel tiene como mucho " + HOOKS + " comandas, pero la puerta sigue dejando entrar a todos: las comandas que no caben esperan en el mostrador hasta que se libera un gancho"),
    question: t("The kitchen never has more than " + HOOKS + " slips waiting. How many dishes a minute reach their customer in time?", "La cocina nunca tiene más de " + HOOKS + " comandas en espera. ¿Cuántos platos por minuto llegan a tiempo a su cliente?"),
    options: [
      t("Almost none, as with no limit: the queue just moved to the desk", "Casi ninguno, como sin límite: la cola solo se mudó al mostrador"),
      t("About as many as with the limit at the door: the kitchen's queue is short", "Más o menos los mismos que con el límite en la puerta: la cola de la cocina es corta"),
      t("More than with the door, because nobody is turned away", "Más que con la puerta, porque no se rechaza a nadie"),
    ],
    answer: 0,
    why: t(
      "A bound helps only if its \"full\" reaches someone who can act on it. Here the rail is full, but the desk upstream keeps accepting and holding orders, so every slip still waits behind the whole backlog, now on the desk instead of the rail. Real systems do this all the time: a service caps its workers while the load balancer, a thread pool or a buffer in front of it queues without limit. Backpressure means the full signal travels upstream, stage by stage (a bounded queue that blocks the writer, TCP's receive window, HTTP/2 flow control, request(n) in Reactive Streams), until it reaches a point that can say no, or a producer that can wait.",
      "Un límite solo ayuda si su \"lleno\" le llega a alguien que pueda actuar. Aquí el riel está lleno, pero el mostrador de antes sigue aceptando y guardando pedidos, así que cada comanda sigue esperando detrás de todo el atraso, ahora en el mostrador en lugar del riel. Los sistemas reales hacen esto todo el tiempo: un servicio limita sus workers mientras el balanceador de carga, un pool de hilos o un búfer delante de él encola sin límite. Contrapresión (backpressure) significa que la señal de lleno viaja hacia atrás, etapa por etapa (una cola acotada que bloquea al que escribe, la ventana de recepción de TCP, el control de flujo de HTTP/2, request(n) en Reactive Streams), hasta llegar a un punto que pueda decir que no, o a un productor que pueda esperar.",
    ),
    watch: { load: 1.5, policy: "rail", order: "fifo", dish: DISH },
  },
  {
    id: "slow",
    title: t("The kitchen slows down", "La cocina se pone lenta"),
    change: t("Demand 120% · each dish takes " + 2 * DISH + " s instead of " + DISH + " s (a slow supplier) · the door limit of " + HOOKS + " slips vs dropping slips that waited too long (" + INTERVAL + " s, or " + TARGET + " s once the rail hasn't emptied for " + INTERVAL + " s)",
      "Demanda 120% · cada plato tarda " + 2 * DISH + " s en lugar de " + DISH + " s (un proveedor lento) · el límite de " + HOOKS + " comandas en la puerta vs descartar las comandas que esperaron demasiado (" + INTERVAL + " s, o " + TARGET + " s cuando el riel lleva " + INTERVAL + " s sin vaciarse)"),
    question: t("The door limit worked at normal speed. What does it do now?", "El límite en la puerta funcionaba a velocidad normal. ¿Qué hace ahora?"),
    options: [
      t("It still works: the queue is still capped at " + HOOKS, "Sigue funcionando: la cola sigue con tope de " + HOOKS),
      t("Almost nothing reaches its customer in time: " + HOOKS + " slips are now too much waiting", "Casi nada llega a tiempo a su cliente: " + HOOKS + " comandas ahora son demasiada espera"),
      t("It works better, because fewer customers get in", "Funciona mejor, porque entran menos clientes"),
    ],
    answer: 1,
    why: t(
      "A limit counted in slips is a limit in time that only holds at one speed. At " + 2 * DISH + " s a dish, " + HOOKS + " slips ahead mean twice the wait, on top of slower cooking, which is longer than customers stay: the bound now admits exactly the orders that will fail, and the cooks stay busy with them. A limit on how long a slip has waited measures what customers feel, so it adapts when the work gets slower. That is the idea behind CoDel (Controlled Delay), a router queue algorithm that drops packets by how long they sat in the queue, not by queue length. The server version here allows a long wait while the queue still empties now and then, so ordinary bursts get through, and a short one once a queue stands.",
      "Un límite contado en comandas es un límite de tiempo que solo vale a una velocidad. Con " + 2 * DISH + " s por plato, " + HOOKS + " comandas por delante son el doble de espera, encima de una cocina más lenta, y eso es más de lo que aguantan los clientes: el límite ahora deja entrar justo los pedidos que van a fallar, y los cocineros siguen ocupados con ellos. Un límite sobre cuánto esperó una comanda mide lo que sienten los clientes, así que se adapta cuando el trabajo se pone más lento. Esa es la idea de CoDel (Controlled Delay), un algoritmo de colas de routers que descarta paquetes según cuánto tiempo llevan en la cola, no según el largo de la cola. La versión para servidores de aquí permite una espera larga mientras la cola todavía se vacía de vez en cuando, para que pasen las ráfagas normales, y una corta cuando se forma una cola que no baja.",
    ),
    watch: { load: 1.2, policy: "door", order: "fifo", dish: 2 * DISH },
  },
  {
    id: "rush",
    title: t("A rush on a normal day", "Una avalancha en un día normal"),
    change: t("Demand 80% · " + RUSH + " customers walk in at once · everyone let in · cooks take the oldest slip vs adaptive LIFO (the newest slip, but only while the rail hasn't emptied for " + INTERVAL + " s) · the next minute",
      "Demanda 80% · entran " + RUSH + " clientes de golpe · entran todos · los cocineros toman la comanda más vieja vs LIFO adaptativo (la más nueva, pero solo mientras el riel lleva " + INTERVAL + " s sin vaciarse) · el minuto siguiente"),
    question: t("How many of the customers who come in that minute miss their dish?", "¿Cuántos de los clientes que llegan en ese minuto se quedan sin su plato?"),
    options: [
      t("About the same either way: the same work arrives and the cooks are just as busy", "Más o menos los mismos de las dos formas: llega el mismo trabajo y los cocineros están igual de ocupados"),
      t("More with adaptive LIFO, because it is unfair", "Más con LIFO adaptativo, porque es injusto"),
      t("Far fewer with adaptive LIFO: newcomers are served in time while the rush's oldest slips go stale", "Muchos menos con LIFO adaptativo: los que llegan se atienden a tiempo mientras las comandas más viejas de la avalancha se vencen"),
    ],
    answer: 2,
    why: t(
      "Oldest first puts every newcomer behind the whole rush, and the spare capacity at 80% drains it slowly, so for most of the minute everyone is late, newcomers included. Adaptive LIFO sees the standing queue and takes the newest slip, which can still make it; most of the rush was going to miss anyway. When the rail empties it goes back to oldest first, so on a normal day nothing changes. Serving the newest first is unfair to the oldest, which is why it is switched on only under a standing queue, and why it pairs with dropping stale slips: without that, the old slips still get cooked later, for nobody.",
      "El más viejo primero pone a cada recién llegado detrás de toda la avalancha, y la capacidad sobrante al 80% la vacía despacio, así que durante casi todo el minuto todos llegan tarde, también los nuevos. El LIFO adaptativo (adaptive LIFO) ve la cola que no baja y toma la comanda más nueva, que todavía puede llegar; la mayor parte de la avalancha iba a perderse de todos modos. Cuando el riel se vacía vuelve al más viejo primero, así que en un día normal no cambia nada. Atender primero al más nuevo es injusto con los más viejos; por eso se activa solo con una cola que no baja, y por eso va junto con descartar las comandas viejas: sin eso, las comandas viejas igual se cocinan después, para nadie.",
    ),
    watch: { load: 0.8, policy: "all", order: "fifo", dish: DISH, rush: RUSH },
  },
];

const QUESTIONS = [
  [t("During an incident the servers were 100% busy and finished as many requests a second as ever. Why can that be the worst sign, and what should you graph instead?",
    "Durante un incidente los servidores estaban 100% ocupados y terminaban tantas solicitudes por segundo como siempre. ¿Por qué puede ser la peor señal, y qué deberías graficar en su lugar?"),
   t("Throughput counts finished work, useful or not. With an unbounded queue, an overloaded server finishes requests whose clients have already timed out, so it is fully busy producing answers nobody receives. Graph goodput, the successful responses delivered within the client's deadline, next to throughput, and graph how long requests wait in the queue, not just how many there are.",
     "El rendimiento (throughput) cuenta trabajo terminado, útil o no. Con una cola sin límite, un servidor sobrecargado termina solicitudes cuyos clientes ya se rindieron, así que está ocupado al máximo produciendo respuestas que nadie recibe. Grafica el goodput, las respuestas exitosas entregadas dentro del plazo del cliente, junto al rendimiento, y grafica cuánto esperan las solicitudes en la cola, no solo cuántas hay.")],
  [t("Your server's queue holds 1,000 requests. How do you tell whether that is a good limit?",
    "La cola de tu servidor admite 1,000 solicitudes. ¿Cómo sabes si es un buen límite?"),
   t("Turn it into time: at 200 requests a second, 1,000 queued is 5 s of waiting, useless if clients give up after 2 s (Little's law, from the Queues lesson, links length and wait). Size the bound from the latency budget, the deadline minus the work itself, times throughput. Better still, bound the wait directly, by rejecting or dropping requests that have waited too long, which keeps working when requests get slower or capacity drops.",
     "Pásalo a tiempo: con 200 solicitudes por segundo, 1,000 en cola son 5 s de espera, inútiles si los clientes se rinden a los 2 s (la ley de Little, de la lección de colas, relaciona largo y espera). Dimensiona el límite según el presupuesto de latencia, el plazo menos el trabajo en sí, por el rendimiento. Mejor aún, acota la espera directamente, rechazando o descartando las solicitudes que esperaron demasiado; eso sigue funcionando cuando las solicitudes se ponen más lentas o baja la capacidad.")],
  [t("Both fail, so why is a fast rejection better for the client than accepting the request and timing out?",
    "Las dos fallan, así que ¿por qué para el cliente es mejor un rechazo rápido que aceptar la solicitud y vencer por tiempo?"),
   t("A fast rejection costs the server almost nothing and tells the client at once, while it still has time to try another replica, fall back to a cached or partial answer, or show an error. A timeout costs the server the full work and the client its whole deadline, and often ends in a retry onto the same overloaded server. Make rejections cheap (reject before parsing, authenticating or touching the database) and say when to come back, e.g. HTTP 503 with Retry-After; clients should back off and limit retries (see the Retry storms lesson).",
     "Un rechazo rápido casi no le cuesta nada al servidor y le avisa al cliente de inmediato, cuando todavía tiene tiempo de probar otra réplica, usar una respuesta en caché o parcial, o mostrar un error. Un timeout le cuesta al servidor todo el trabajo y al cliente todo su plazo, y muchas veces termina en un reintento contra el mismo servidor sobrecargado. Haz que rechazar sea barato (rechaza antes de parsear, autenticar o tocar la base de datos) y di cuándo volver, por ejemplo con HTTP 503 y Retry-After; los clientes deben esperar cada vez más (backoff) y limitar los reintentos (mira la lección de tormentas de reintentos).")],
  [t("Service A calls service B. B rejects with 503 when its bounded queue is full, but A has an unbounded queue of its own. What happens under overload, and how do you push backpressure upstream?",
    "El servicio A llama al servicio B. B rechaza con 503 cuando su cola acotada está llena, pero A tiene su propia cola sin límite. ¿Qué pasa bajo sobrecarga, y cómo empujas la contrapresión hacia atrás?"),
   t("B looks healthy while A's queue grows: requests now wait in A, past their deadlines, and if A retries B's 503s it adds load. Bound A as well, and make it react to B: cap A's concurrent calls to B and fail fast when the cap is reached, and pass deadlines along (gRPC can carry them from call to call) so B can skip work whose caller has already given up. The aim is that the no happens at the edge, before work is spent on a request that will fail.",
     "B se ve sano mientras crece la cola de A: ahora las solicitudes esperan en A, más allá de sus plazos, y si A reintenta los 503 de B le suma carga. Acota también a A, y haz que reaccione a B: limita las llamadas concurrentes de A a B y falla rápido cuando se llega al tope, y pasa los plazos hacia adelante (gRPC puede llevarlos de una llamada a la siguiente) para que B pueda saltarse el trabajo cuyo llamador ya se rindió. La idea es que el no ocurra en el borde, antes de gastar trabajo en una solicitud que va a fallar.")],
  [t("When would you serve the newest request first, and what stops that from starving old requests forever?",
    "¿Cuándo atenderías primero la solicitud más nueva, y qué evita que las viejas se queden sin atender para siempre?"),
   t("Only once a queue has built up, when the oldest requests are likely past their deadline anyway: then newest first gives each request you serve the best chance of being useful (adaptive LIFO). In normal operation oldest first is fairer and gives steadier latency, so switch only while the queue stands, and pair it with a limit on queue wait, so old requests get a quick error instead of an endless wait. Facebook's \"Fail at Scale\" (2015) describes running both together. The Stacks lesson shows plain LIFO under steady overload.",
     "Solo cuando ya se formó una cola y las solicitudes más viejas probablemente ya pasaron su plazo: ahí, atender primero la más nueva le da a cada solicitud que atiendes la mejor oportunidad de ser útil (LIFO adaptativo). En operación normal el más viejo primero es más justo y da una latencia más pareja, así que cambia solo mientras la cola no baja, y combínalo con un límite a la espera en cola, para que las solicitudes viejas reciban un error rápido en lugar de una espera sin fin. El artículo \"Fail at Scale\" (2015) de Facebook describe usar las dos cosas juntas. La lección de pilas muestra LIFO simple bajo sobrecarga constante.")],
  [t("Where can you shed load, from cheapest to most expensive, and what should go first?",
    "¿Dónde puedes descartar carga, de lo más barato a lo más caro, y qué debería irse primero?"),
   t("At the client (don't send: back off, or a circuit breaker that is open), at the edge (a gateway or load balancer that limits per client or admits by capacity), at the server's door (a bounded queue or a concurrency limit), in the queue (drop by wait time), and last, mid-request (abandon work whose deadline has passed). The earlier, the less work is wasted. Shed by priority as well: prefetches, analytics and retries before what a user is waiting on, and a cached or reduced answer before an error. See the Rate limiting and Circuit breakers lessons.",
     "En el cliente (no enviar: esperar cada vez más, o un interruptor de circuito, circuit breaker, abierto), en el borde (un gateway o balanceador que limita por cliente o admite según la capacidad), en la puerta del servidor (una cola acotada o un límite de concurrencia), en la cola (descartar por tiempo de espera) y, por último, a mitad de la solicitud (abandonar el trabajo cuyo plazo ya pasó). Cuanto antes, menos trabajo se desperdicia. Descarta también por prioridad: precargas (prefetch), analítica y reintentos antes de lo que un usuario está esperando, y una respuesta en caché o reducida antes que un error. Mira las lecciones de limitación de tasa y de interruptores de circuito.")],
];

export default defineLesson({
  title: t("Load Shedding Workbench", "Banco de trabajo: descarte de carga"),
  eyebrow: t("Systems lesson 47 · Load shedding & backpressure", "Lección de sistemas 47 · Descarte de carga y contrapresión"),
  lede: t("Past its capacity, a server that accepts every request builds a queue, and soon every request waits longer than its client will: the server stays fully busy while useful work, goodput, falls toward zero. Saying no early keeps goodput near capacity. This lesson runs a takeaway kitchen past its limit: watch a machine do it, predict what breaks it, then explain it back.",
    "Pasada su capacidad, un servidor que acepta todas las solicitudes arma una cola, y pronto cada solicitud espera más de lo que su cliente aguanta: el servidor sigue ocupado al máximo mientras el trabajo útil, el goodput, cae hacia cero. Decir que no temprano mantiene el goodput cerca de la capacidad. Esta lección lleva una cocina de comida para llevar más allá de su límite: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Each order is a slip on the rail, and the three cooks take slips from its right end. A customer waits " + PATIENCE + " s for the dish, then leaves without telling the kitchen: the slip lights up, and when it is cooked the dish goes in the bin. The chart draws dishes cooked a minute against dishes handed over in time. Try the four ways of handling too many customers, the order the cooks take slips in, and a rush.",
      "Cada pedido es una comanda en el riel, y los tres cocineros toman comandas de su extremo derecho. Un cliente espera " + PATIENCE + " s su plato y después se va sin avisarle a la cocina: la comanda se ilumina, y cuando se cocina, el plato va a la basura. El gráfico dibuja los platos cocinados por minuto frente a los entregados a tiempo. Prueba las cuatro formas de manejar demasiados clientes, el orden en que los cocineros toman las comandas, y una avalancha."),
    plate: {
      title: t("Takeaway kitchen", "Cocina para llevar"),
      keys: [
        { mark: "lit", label: t("A slip or dish for a customer who already left; the door's FULL; LIFO over the rail", "Una comanda o plato de un cliente que ya se fue; el LLENO de la puerta; LIFO sobre el riel") },
        { mark: "raised", label: t("Slips on the rail, oldest at the right, next to the cooks", "Comandas en el riel, la más vieja a la derecha, junto a los cocineros") },
        { mark: "flat", label: t("The floor: customers waiting for their dish, oldest nearest the pass", "El piso: clientes esperando su plato, el más viejo cerca de la barra de entrega") },
      ],
      caption: t(
        "Customers come in from the street through the door at the left; each order becomes a numbered slip on the rail. The cooks take the slip at the right end (or, under adaptive LIFO with a standing queue, the newest), cook it on their stove and put the dish on the pass, from where it goes to its customer on the floor, or into the bin if that customer has left. The counters on the rail show how many slips wait, how long the oldest has waited and how many were dropped for waiting too long; the gauge shows how long the rail has gone without emptying, red past " + INTERVAL + " s. With a limited rail, a stop marks its " + HOOKS + " hooks: either slips that don't fit wait on the order desk, or the doorman turns customers away. The chart recorder at the back draws the last minute: dishes cooked (thin pen) and dishes handed over in time (thick pen).",
        "Los clientes entran desde la calle por la puerta de la izquierda; cada pedido se vuelve una comanda numerada en el riel. Los cocineros toman la comanda del extremo derecho (o, con LIFO adaptativo y una cola que no baja, la más nueva), la cocinan en su estufa y dejan el plato en la barra de entrega, desde donde va a su cliente en el piso, o a la basura si ese cliente ya se fue. Los contadores del riel muestran cuántas comandas esperan, cuánto lleva esperando la más vieja y cuántas se descartaron por esperar demasiado; el indicador muestra cuánto tiempo lleva el riel sin vaciarse, en rojo pasados " + INTERVAL + " s. Con un riel limitado, un tope marca sus " + HOOKS + " ganchos: o las comandas que no caben esperan en el mostrador, o el portero rechaza clientes. El registrador del fondo dibuja el último minuto: platos cocinados (trazo fino) y platos entregados a tiempo (trazo grueso).",
      ),
      stage: { "data-kitchen": "" },
      label: t("Load shedding simulation. Space pauses or resumes.", "Simulación de descarte de carga. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["cooked", t("Cooked / min", "Cocinados / min"), "–"],
      ["good", t("In time / min", "A tiempo / min"), "–"],
      ["late", t("Too late", "Tarde")],
      ["turned", t("Turned away", "Sin lugar")],
      ["dropped", t("Dropped", "Descartadas")],
      ["waiting", t("Slips waiting", "Comandas en espera")],
    ],
    controls: [
      { seg: "load", label: t("Demand", "Demanda"), options: [[0.8, "80%"], [1.2, "120%"], [1.5, "150%"], [2, "200%"]], value: 1.5 },
      { seg: "policy", label: t("Too many customers", "Demasiados clientes"), options: [["all", t("Accept all", "Aceptar todo")], ["rail", t("Limit the rail", "Limitar el riel")], ["door", t("Limit at the door", "Limitar en la puerta")], ["codel", t("Drop stale slips", "Descartar viejas")]], value: "all" },
      { seg: "order", label: t("Cooks take", "Los cocineros toman"), options: [["fifo", t("Oldest first", "La más vieja")], ["alifo", t("Adaptive LIFO", "LIFO adaptativo")]], value: "fifo" },
      { seg: "dish", label: t("Time per dish", "Tiempo por plato"), options: [[DISH, DISH + " s"], [2 * DISH, 2 * DISH + " s"]], value: DISH },
      { speed: true },
      { actions: [["rush", t("Rush of " + RUSH, "Avalancha de " + RUSH)], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Demand is a share of what three cooks make at " + DISH + " s a dish, about " + PER_MIN + " dishes a minute. A limited rail holds " + HOOKS + " slips. Drop stale slips: a slip may wait " + INTERVAL + " s, or " + TARGET + " s once the rail hasn't emptied for " + INTERVAL + " s. Changing a setting starts the run again, " + LIVE_WARM + " s in.",
      "La demanda es una parte de lo que hacen tres cocineros con " + DISH + " s por plato, unos " + PER_MIN + " platos por minuto. Un riel limitado tiene " + HOOKS + " comandas. Descartar viejas: una comanda puede esperar " + INTERVAL + " s, o " + TARGET + " s cuando el riel lleva " + INTERVAL + " s sin vaciarse. Cambiar un ajuste reinicia la corrida, a los " + LIVE_WARM + " s.",
    ),
  },
  predict: {
    intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs.",
      "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija."),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  css: `
${FIGURE_CSS}
.iso-stage [data-layer] text{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    SLIP_SVG: slipSvg(),
    FLAT_SVG: flatSlipSvg(),
    DISH_SVG: dishSvg(),
    CUSTOMER_SVG: customerSvg(),
  },
});
