// @ts-nocheck: content ported as-is
// Systems lesson 03 · Load balancing: a parcel sorting station, a turntable (the load balancer) and up to five counters.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, P, GEOMETRY, parcelSvg } from "./figure";
import { experimentResults } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran them in
// the browser on click; they are seeded, so the numbers are the same).
const RESULTS = experimentResults();

const EXPERIMENTS = [
  {
    id: "add",
    title: t("One more counter", "Un mostrador más"),
    change: t("Counters 3 → 4 at 0.9 parcels/s · a third more capacity, same traffic", "Mostradores 3 → 4 con 0.9 paquetes/s · un tercio más de capacidad, mismo tráfico"),
    question: t("What happens to the slowest 5% of waits (p95)?", "¿Qué pasa con el 5% de esperas más lentas (p95)?"),
    options: [
      t("It drops by about a quarter, in line with the extra capacity", "Baja más o menos un cuarto, en línea con la capacidad extra"),
      t("It drops by more than half", "Baja más de la mitad"),
      t("It barely moves: the traffic is the same", "Casi no cambia: el tráfico es el mismo"),
    ],
    answer: 1,
    why: t("At 90% busy, any small burst lands on a long queue and waits behind it; at 68% busy, queues rarely form at all. Waiting grows roughly like busy ÷ (1 − busy), so the last few points of utilisation cost far more than the first. That is why teams keep headroom instead of running servers near 100%.",
      "Con 90% de ocupación, cualquier ráfaga pequeña cae sobre una cola larga y espera detrás; con 68%, casi nunca se forman colas. La espera crece más o menos como ocupación ÷ (1 − ocupación), así que los últimos puntos de utilización cuestan mucho más que los primeros. Por eso los equipos dejan margen (headroom) en lugar de tener los servidores cerca del 100%."),
    watch: { servers: 3, algorithm: "rr", rate: 0.9, sizes: "even", slow: false, sticky: false, heavy: false, check: 10 },
  },
  {
    id: "slow",
    title: t("One slow counter", "Un mostrador lento"),
    change: t("Counter 1 works at a third of the speed · 4 counters, round robin", "El mostrador 1 trabaja a un tercio de la velocidad · 4 mostradores, round robin"),
    question: t("With round robin, what happens to p95?", "Con round robin, ¿qué pasa con el p95?"),
    options: [
      t("It rises a little: we lost two-thirds of one counter", "Sube un poco: perdimos dos tercios de un mostrador"),
      t("It explodes: the slow counter's queue grows for as long as traffic flows", "Se dispara: la cola del mostrador lento crece mientras siga llegando tráfico"),
      t("It stays the same: the other counters pick up the slack", "Se mantiene igual: los otros mostradores compensan"),
    ],
    answer: 1,
    why: t("Round robin hands every counter the same share, a quarter of the parcels, whatever it can handle. The slow counter can only finish about half of its share, so its queue grows without limit, and every parcel sent to it waits longer than the last. Least connections looks at how many parcels each counter still has and routes around the slow one.",
      "Round robin le da a cada mostrador la misma parte, un cuarto de los paquetes, pueda o no con ella. El mostrador lento solo alcanza a terminar más o menos la mitad de su parte, así que su cola crece sin límite y cada paquete que le llega espera más que el anterior. Menos conexiones (least connections) mira cuántos paquetes le quedan a cada mostrador y esquiva al lento."),
    watch: { servers: 4, algorithm: "rr", rate: 0.9, sizes: "even", slow: true, sticky: false, heavy: false, check: 10 },
  },
  {
    id: "uneven",
    title: t("Uneven parcels", "Paquetes desparejos"),
    change: t("1 parcel in 10 takes 11× longer than the rest · same total work", "1 de cada 10 paquetes tarda 11× más que el resto · mismo trabajo total"),
    question: t("Switching from round robin to least connections changes p95 by…", "Pasar de round robin a menos conexiones cambia el p95…"),
    options: [
      t("Nothing: the total work is identical", "Nada: el trabajo total es idéntico"),
      t("A lot: short parcels stop queuing behind long ones", "Mucho: los paquetes cortos dejan de hacer cola detrás de los largos"),
      t("It gets worse: counting every counter's queue slows the balancer down", "Empeora: contar la cola de cada mostrador hace más lento al balanceador"),
    ],
    answer: 1,
    why: t("Round robin doesn't know a counter is stuck on a big parcel, so it keeps sending short parcels into that lane, where they wait for 16 seconds. Least connections sends them to a counter that is free. Random is worse than both: it can pile several parcels on one counter by chance.",
      "Round robin no sabe que un mostrador está atascado con un paquete grande, así que sigue mandando paquetes cortos a ese carril, donde esperan 16 segundos. Menos conexiones los manda a un mostrador libre. Aleatorio es peor que ambos: por azar puede amontonar varios paquetes en un mismo mostrador."),
    watch: { servers: 4, algorithm: "rr", rate: 0.9, sizes: "uneven", slow: false, sticky: false, heavy: false, check: 10 },
  },
  {
    id: "crash",
    title: t("A counter crashes", "Se cae un mostrador"),
    change: t("Counter 2 dies · the balancer only finds out at its next health check", "El mostrador 2 se cae · el balanceador recién se entera en el siguiente chequeo de salud"),
    question: t("With a health check every 30 s, how many parcels fail?", "Con un chequeo de salud cada 30 s, ¿cuántos paquetes fallan?"),
    options: [
      t("None: the balancer notices at once", "Ninguno: el balanceador lo nota de inmediato"),
      t("The parcels already inside it, plus everything sent to it until the next check", "Los paquetes que ya tenía, más todo lo que le mandan hasta el siguiente chequeo"),
      t("Every parcel until someone restarts the counter", "Todos los paquetes hasta que alguien reinicie el mostrador"),
    ],
    answer: 1,
    why: t("Between the crash and the next check, the balancer still believes the counter is up and keeps sending it a quarter of the traffic. Faster checks shrink that window, but they cannot save the parcels that were already inside the counter when it died: that floor stays the same at any interval.",
      "Entre la caída y el siguiente chequeo, el balanceador todavía cree que el mostrador está arriba y le sigue mandando un cuarto del tráfico. Chequeos más frecuentes achican esa ventana, pero no pueden salvar los paquetes que ya estaban dentro del mostrador cuando se cayó: ese piso es el mismo con cualquier intervalo."),
    watch: { servers: 4, algorithm: "rr", rate: 0.9, sizes: "even", slow: false, sticky: false, heavy: false, check: 30, crash: true },
  },
  {
    id: "sticky",
    title: t("Sticky customers", "Clientes pegados"),
    change: t("Two customers send 40% of the parcels · sticky sessions pin each customer to one counter", "Dos clientes mandan el 40% de los paquetes · las sesiones persistentes (sticky sessions) atan cada cliente a un mostrador"),
    question: t("Twenty customers in total. What happens to the counters?", "Veinte clientes en total. ¿Qué pasa con los mostradores?"),
    options: [
      t("Load still evens out: twenty customers is plenty", "La carga igual se empareja: veinte clientes son suficientes"),
      t("One counter runs flat out while others idle, and p95 soars", "Un mostrador trabaja a tope mientras los demás descansan, y el p95 se dispara"),
      t("Nothing changes: round robin is still on", "Nada cambia: round robin sigue activo"),
    ],
    answer: 1,
    why: t("Sticky sessions decide by customer, not by load. Here both big customers hash to the same counter, so it gets half the traffic and more work than it can do, while the others sit at under half busy. The balancer's algorithm never gets a say for those parcels.",
      "Las sesiones persistentes deciden por cliente, no por carga. Aquí el hash de los dos clientes grandes cae en el mismo mostrador, así que recibe la mitad del tráfico y más trabajo del que puede hacer, mientras los demás quedan por debajo de la mitad de ocupación. El algoritmo del balanceador nunca opina sobre esos paquetes."),
    watch: { servers: 4, algorithm: "rr", rate: 0.9, sizes: "even", slow: false, sticky: true, heavy: true, check: 10 },
  },
];

const QUESTIONS = [
  [t("At 90% busy, adding a third more capacity cut p95 by more than half. Why isn't the gain proportional?", "Con 90% de ocupación, sumar un tercio más de capacidad bajó el p95 más de la mitad. ¿Por qué la mejora no es proporcional?"),
    t("Waiting time grows roughly like utilisation ÷ (1 − utilisation): at 0.9 that is 9, at 0.68 about 2. Near full, every burst queues behind the last one. Leave headroom (many teams aim for 60–70% at peak) and scale before you reach the steep part of the curve.",
      "El tiempo de espera crece más o menos como utilización ÷ (1 − utilización): con 0.9 da 9, con 0.68 cerca de 2. Cerca del tope, cada ráfaga hace cola detrás de la anterior. Deja margen (muchos equipos apuntan a 60–70% en el pico) y escala antes de llegar a la parte empinada de la curva.")],
  [t("Round robin is fine when servers are identical. When does it hurt, and why does least connections help?", "Round robin funciona bien cuando los servidores son idénticos. ¿Cuándo hace daño, y por qué ayuda menos conexiones?"),
    t("It hurts when servers differ in speed (an old instance, a noisy neighbour, a server doing GC) or requests differ in cost. Round robin ignores both and keeps feeding a backed-up server. Least connections uses outstanding requests as a cheap signal of how busy each server really is.",
      "Hace daño cuando los servidores tienen velocidades distintas (una instancia vieja, un vecino ruidoso, un servidor haciendo GC) o las solicitudes tienen costos distintos. Round robin ignora ambas cosas y sigue alimentando a un servidor atorado. Menos conexiones usa las solicitudes pendientes como una señal barata de qué tan ocupado está de verdad cada servidor.")],
  [t("Least connections has a trap: a broken server that returns errors instantly has almost no outstanding requests. What happens?", "Menos conexiones tiene una trampa: un servidor roto que devuelve errores al instante casi no tiene solicitudes pendientes. ¿Qué pasa?"),
    t("It looks like the least busy server, so the balancer sends it more and more traffic, and most requests fail (a \"black hole\"). Health checks, outlier detection that ejects servers with high error rates, and counting errors as failures all guard against it.",
      "Parece el servidor menos ocupado, así que el balanceador le manda cada vez más tráfico, y la mayoría de las solicitudes fallan (un \"agujero negro\"). Los chequeos de salud, la detección de valores atípicos (outlier detection) que saca a los servidores con muchos errores y contar los errores como fallas protegen contra eso.")],
  [t("Someone proposes health checks every 100 ms on a 200-server fleet. What are the trade-offs?", "Alguien propone chequeos de salud cada 100 ms en una flota de 200 servidores. ¿Qué se gana y qué se pierde?"),
    t("Faster detection, but checks become real load on every server, and one slow response can mark a healthy server down (flapping). Real setups combine an interval with thresholds (down after 3 failures, up after 2 passes) and passive checks that watch real traffic.",
      "Detección más rápida, pero los chequeos se vuelven carga real en cada servidor, y una sola respuesta lenta puede marcar como caído a un servidor sano (flapping). Las configuraciones reales combinan un intervalo con umbrales (caído tras 3 fallas, arriba tras 2 éxitos) y chequeos pasivos que miran el tráfico real.")],
  [t("Why use sticky sessions at all, and how would you avoid the hot counter from experiment 5?", "¿Para qué usar sesiones persistentes, y cómo evitarías el mostrador saturado del experimento 5?"),
    t("They keep a user on the server that holds their session or warm cache. To avoid hot spots, move session state to a shared store (Redis, a database, a signed cookie) so any server can answer, or use consistent hashing with bounded load so a full server spills to the next one.",
      "Mantienen a un usuario en el servidor que tiene su sesión o su caché caliente. Para evitar puntos calientes, mueve el estado de sesión a un almacén compartido (Redis, una base de datos, una cookie firmada) para que cualquier servidor pueda responder, o usa hashing consistente con carga acotada (consistent hashing with bounded load) para que un servidor lleno derive al siguiente.")],
  [t("Parcels inside a crashed counter fail no matter how fast the checks are. How do real systems protect those requests?", "Los paquetes dentro de un mostrador caído fallan sin importar qué tan frecuentes sean los chequeos. ¿Cómo protegen esas solicitudes los sistemas reales?"),
    t("Retry idempotent requests on another server (at the balancer or the client, with a budget so retries can't multiply load), drain servers before planned restarts so they finish in-flight work, and set timeouts so a request doesn't hang on a dead connection.",
      "Reintentan las solicitudes idempotentes en otro servidor (en el balanceador o en el cliente, con un presupuesto para que los reintentos no multipliquen la carga), drenan los servidores antes de reinicios planeados para que terminen el trabajo en curso y ponen timeouts para que una solicitud no quede colgada de una conexión muerta.")],
];

export default defineLesson({
  title: t("Load Balancer Workbench", "Banco de trabajo: balanceo de carga"),
  eyebrow: t("Systems lesson 03 · Load balancing", "Lección de sistemas 03 · Balanceo de carga"),
  lede: t("A load balancer decides which server gets each request. That one decision, made thousands of times a second, sets how long users wait. This lesson builds the idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Un balanceador de carga (load balancer) decide qué servidor recibe cada solicitud. Esa única decisión, tomada miles de veces por segundo, define cuánto esperan los usuarios. Esta lección arma la idea de tres maneras: mira una máquina hacerlo, predice qué la rompe y luego explícalo con tus palabras."),
  machine: {
    intro: t("The turntable is the load balancer. Each lane is one server's queue, and each counter at the end works through it one parcel at a time. Change the balancer, slow a counter down or crash one, and watch the queues and the waits.",
      "El plato giratorio es el balanceador de carga. Cada carril es la cola de un servidor, y cada mostrador al final la despacha un paquete a la vez. Cambia el balanceador, haz más lento un mostrador o tira uno, y mira las colas y las esperas."),
    plate: {
      title: t("Sorting station", "Estación de clasificación"),
      keys: [
        { mark: "lit", label: t("Turntable arm: the load balancer's choice", "Brazo del plato giratorio: la elección del balanceador de carga") },
        { mark: "raised", label: t("Counters: servers, one parcel at a time", "Mostradores: servidores, un paquete a la vez") },
        { mark: "flat", label: t("Lanes: each counter's queue", "Carriles: la cola de cada mostrador") },
      ],
      caption: t(
        "Parcels arrive at random, about one a second, and the turntable sends each one down a lane. A counter takes 3 s on an average parcel. The gate at the start of a lane shows whether the balancer still sends parcels there; it only changes at a health check. A closed shutter means the counter is down.",
        "Los paquetes llegan al azar, más o menos uno por segundo, y el plato giratorio manda cada uno por un carril. Un mostrador tarda 3 s con un paquete promedio. La barrera al inicio de un carril muestra si el balanceador todavía manda paquetes ahí; solo cambia en un chequeo de salud (health check). Una cortina cerrada significa que el mostrador está caído."),
      stage: { "data-office": "" },
      label: t("Sorting station simulation. Space pauses or resumes.", "Simulación de la estación de clasificación. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["served", t("Served", "Atendidos")], ["failed", t("Failed", "Fallidos")], ["p50", t("Median wait", "Espera mediana"), "–"], ["p95", t("p95 wait", "Espera p95"), "–"], ["busiest", t("Busiest counter", "Más ocupado"), "–"], ["quietest", t("Quietest counter", "Más libre"), "–"]],
    controls: [
      { seg: "servers", label: t("Counters", "Mostradores"), options: [[2, "2"], [3, "3"], [4, "4"], [5, "5"]], value: 4 },
      { seg: "algorithm", label: t("Balancer", "Balanceador"), options: [["rr", t("Round robin", "Round robin")], ["lc", t("Least conn.", "Menos conex.")], ["random", t("Random", "Aleatorio")]], value: "rr" },
      { seg: "rate", label: t("Traffic", "Tráfico"), options: [[0.6, "0.6/s"], [0.9, "0.9/s"], [1.2, "1.2/s"]], value: 0.9 },
      { seg: "sizes", label: t("Parcel sizes", "Tamaño de paquetes"), options: [["even", t("Similar", "Parecidos")], ["uneven", t("1 in 10 huge", "1 de 10 enorme")]], value: "even" },
      { seg: "slow", label: t("Counter 1", "Mostrador 1"), options: [["false", t("Normal", "Normal")], ["true", t("3× slower", "3× más lento")]], value: "false" },
      { seg: "check", label: t("Health check", "Chequeo de salud"), options: [[2, "2 s"], [10, "10 s"], [30, "30 s"]], value: 10 },
      { seg: "heavy", label: t("Customers", "Clientes"), options: [["false", t("Many small", "Muchos chicos")], ["true", t("Two big", "Dos grandes")]], value: "false" },
      { seg: "sticky", label: t("Sticky sessions", "Sesiones persistentes"), options: [["false", t("Off", "No")], ["true", t("On", "Sí")]], value: "false" },
      { speed: true },
      { actions: [["crash", t("Crash counter 2", "Tirar mostrador 2")], ["restart", t("Restart counters", "Reiniciar mostradores")], ["reset", t("Reset counts", "Reiniciar conteos")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over six runs of ten minutes each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados salen del mismo modelo que la figura, promediados en seis corridas de diez minutos cada una."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  data: {
    P,
    G: GEOMETRY,
    PARCEL_SVG: parcelSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
