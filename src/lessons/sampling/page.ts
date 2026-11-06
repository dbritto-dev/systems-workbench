// @ts-nocheck: content in the style of the other lessons
// Systems lesson 73 · Trace sampling: a trace archive with three services, a collector and folders of kept traces.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, pctTenths, int } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, cardSvg, tokenSvg, P, GEOMETRY } from "./figure";
import { coinsRun, raiseRun, waitRun, splitRun, weightRun, RATE, SECS, SLOW_T, LIVE_ERR, LIVE_SLOW, LIVE_RATE } from "./sim";

// Experiment results, computed at build time from the same model the page runs (8 seeds of 120,000 requests each).
const R = { coins: coinsRun(), raise: raiseRun(), wait: waitRun(), split: splitRun(), weight: weightRun() };
const N_REQ = int(RATE * SECS);
const p1 = (x) => (x === 0 ? "0%" : x < 0.001 ? "<0.1%" : pctTenths(x));   // one decimal under 10%

// What each card shows after a run.
const RUNS = {
  coins: () => {
    const { own, parent } = R.coins;
    return { verdict: t("Each service on its own: " + p1(own.wholeShare) + " of the traces in the archive are whole; the archive holds " + pct(own.kept) + " of requests, most as a single span. Parent-based: " + pct(parent.wholeShare) + " whole. Both stored " + pct(own.spanShare) + " of all spans.",
        "Cada servicio por su cuenta: " + p1(own.wholeShare) + " de las trazas del archivo están completas; el archivo tiene el " + pct(own.kept) + " de las solicitudes, casi todas con un solo span. Parent-based: " + pct(parent.wholeShare) + " completas. Los dos guardaron el " + pct(own.spanShare) + " de todos los spans."),
      bars: [[t("Whole, each on its own", "Completas, cada uno por su cuenta"), own.wholeShare, p1(own.wholeShare), true], [t("Whole, parent-based", "Completas, parent-based"), parent.wholeShare, pct(parent.wholeShare)], [t("Spans stored, either way", "Spans guardados, en ambos casos"), own.spanShare, pct(own.spanShare)]] };
  },
  raise: () => {
    const { before, parent, own, tail } = R.raise;
    return { verdict: t("Failing requests kept whole: " + p1(before.errWhole) + " before the change, " + p1(parent.errWhole) + " after it under parent-based sampling. Each service on its own: payments kept " + pct(own.errC) + " of its failing spans, but " + p1(own.errWhole) + " of those traces are whole. Tail sampling: " + pct(tail.errWhole) + " whole.",
        "Solicitudes fallidas guardadas completas: " + p1(before.errWhole) + " antes del cambio, " + p1(parent.errWhole) + " después con parent-based. Cada servicio por su cuenta: pagos guardó el " + pct(own.errC) + " de sus spans fallidos, pero solo el " + p1(own.errWhole) + " de esas trazas está completo. Tail sampling: " + pct(tail.errWhole) + " completas."),
      bars: [[t("Kept whole, parent-based, payments 100%", "Completas, parent-based, pagos 100%"), parent.errWhole, p1(parent.errWhole), true], [t("Payments' span kept, on its own", "Span de pagos guardado, por su cuenta"), own.errC, pct(own.errC)], [t("Kept whole, on its own", "Completas, por su cuenta"), own.errWhole, p1(own.errWhole)], [t("Kept whole, tail sampling", "Completas, tail sampling"), tail.errWhole, pct(tail.errWhole)]] };
  },
  wait: () => {
    const { short, long } = R.wait, top = long.held * 1.08;
    return { verdict: t("Slow traces kept: " + pct(short.slowWhole) + " with a 5 s wait, " + pct(long.slowWhole) + " with 15 s. Failing requests: " + pct(short.errWhole) + " vs " + pct(long.errWhole) + ". Traces held in memory at " + RATE + " requests a second: " + int(short.held) + " vs " + int(long.held) + ".",
        "Trazas lentas guardadas: " + pct(short.slowWhole) + " con una espera de 5 s, " + pct(long.slowWhole) + " con 15 s. Solicitudes que fallan: " + pct(short.errWhole) + " contra " + pct(long.errWhole) + ". Trazas retenidas en memoria a " + RATE + " solicitudes por segundo: " + int(short.held) + " contra " + int(long.held) + "."),
      bars: [[t("Slow kept, wait 5 s", "Lentas guardadas, espera 5 s"), short.slowWhole, pct(short.slowWhole), true], [t("Slow kept, wait 15 s", "Lentas guardadas, espera 15 s"), long.slowWhole, pct(long.slowWhole)], [t("In memory, wait 5 s", "En memoria, espera 5 s"), short.held / top, int(short.held)], [t("In memory, wait 15 s", "En memoria, espera 15 s"), long.held / top, int(long.held), true]] };
  },
  split: () => {
    const { rr, trace } = R.split;
    return { verdict: t("Spans spread evenly: " + pct(rr.errC) + " of failing requests left something in the archive, but only " + pct(rr.errWhole) + " are whole, and " + pct(rr.brokenShare) + " of all kept traces are broken. Routed by trace id: " + pct(trace.errWhole) + " whole, none broken.",
        "Spans repartidos parejo: el " + pct(rr.errC) + " de las solicitudes fallidas dejó algo en el archivo, pero solo el " + pct(rr.errWhole) + " está completo, y el " + pct(rr.brokenShare) + " de todas las trazas guardadas está incompleto. Enrutados por trace id: " + pct(trace.errWhole) + " completas, ninguna incompleta."),
      bars: [[t("Failures whole, spread evenly", "Fallas completas, repartidos parejo"), rr.errWhole, pct(rr.errWhole), true], [t("Failures whole, by trace id", "Fallas completas, por trace id"), trace.errWhole, pct(trace.errWhole)], [t("Kept traces broken, spread evenly", "Guardadas incompletas, repartidos parejo"), rr.brokenShare, pct(rr.brokenShare), true]] };
  },
  weight: () => {
    const w = R.weight, top = w.raw * 1.08;
    return { verdict: t("Real error rate: " + p1(w.truth) + ". Counting the archive's traces: " + p1(w.raw) + ". Weighting each by 1 ÷ its chance of being kept: " + p1(w.weighted) + ". The archive holds " + p1(w.kept) + " of requests.",
        "Tasa de error real: " + p1(w.truth) + ". Contando las trazas del archivo: " + p1(w.raw) + ". Ponderando cada una por 1 ÷ su probabilidad de quedar guardada: " + p1(w.weighted) + ". El archivo tiene el " + p1(w.kept) + " de las solicitudes."),
      bars: [[t("Real rate", "Tasa real"), w.truth / top, p1(w.truth)], [t("Counted from the archive", "Contada en el archivo"), w.raw / top, p1(w.raw), true], [t("Weighted from the archive", "Ponderada en el archivo"), w.weighted / top, p1(w.weighted)]] };
  },
};

const { coins: C1, raise: C2, wait: C3, split: C4, weight: C5 } = R;

const EXPERIMENTS = [
  {
    id: "coins",
    title: t("Every service samples 10% on its own", "Cada servicio muestrea el 10% por su cuenta"),
    change: t("Edge, orders and payments each keep 10% of their spans · each service decides with its own random draw vs the edge decides and the others follow its sampled flag (parent-based) · " + N_REQ + " requests",
      "Entrada, pedidos y pagos guardan el 10% de sus spans · cada servicio decide con su propio sorteo vs la entrada decide y los demás siguen su indicador de muestreo (parent-based) · " + N_REQ + " solicitudes"),
    question: t("When each service decides on its own, what share of the traces in the archive are whole?", "Cuando cada servicio decide por su cuenta, ¿qué parte de las trazas del archivo está completa?"),
    options: [
      t("About 10%: the rate every service uses", "Cerca del 10%: la tasa que usa cada servicio"),
      t("Almost none: most hold a single span", "Casi ninguna: la mayoría tiene un solo span"),
      t("Nearly all: each service keeps the same share", "Casi todas: cada servicio guarda la misma parte"),
    ],
    answer: 1,
    why: t(
      "A trace is whole only if all three services kept their span: 10% × 10% × 10% = 0.1% of requests. But " + pct(C1.own.kept) + " of requests leave at least one span, so the archive fills with fragments: " + p1(C1.own.wholeShare) + " of its traces are whole, for the same " + pct(C1.own.spanShare) + " of spans stored. Parent-based sampling makes the decision once, at the root, and sends it along in the trace context (the sampled flag of the W3C traceparent header); every service downstream follows it, so " + pct(C1.parent.wholeShare) + " of kept traces are whole. OpenTelemetry's TraceIdRatioBased sampler decides from the trace id, so services with the same ratio and the same algorithm would agree, but the spec long left that algorithm open; the usual setup puts the ratio at the root, inside ParentBased.",
      "Una traza está completa solo si los tres servicios guardaron su span: 10% × 10% × 10% = 0.1% de las solicitudes. Pero el " + pct(C1.own.kept) + " de las solicitudes deja al menos un span, así que el archivo se llena de fragmentos: solo el " + p1(C1.own.wholeShare) + " de sus trazas está completo, con el mismo " + pct(C1.own.spanShare) + " de spans guardados. El muestreo parent-based toma la decisión una vez, en la raíz, y la envía en el contexto de la traza (el indicador sampled del encabezado W3C traceparent); cada servicio que sigue la respeta, así que el " + pct(C1.parent.wholeShare) + " de las trazas guardadas está completo. El muestreador TraceIdRatioBased de OpenTelemetry decide a partir del trace id, así que servicios con la misma tasa y el mismo algoritmo coincidirían, pero la especificación dejó ese algoritmo abierto durante mucho tiempo; lo usual es poner la tasa en la raíz, dentro de ParentBased.",
    ),
    watch: { mode: "own", keep: "0.1", pay: "same", wait: "15", coll: "one" },
  },
  {
    id: "raise",
    title: t("Payments records everything", "Pagos registra todo"),
    change: t("The edge keeps 1%, parent-based · 0.5% of requests fail at payments · the payments team sets its own sampler from 1% to 100%",
      "La entrada guarda el 1%, parent-based · el 0.5% de las solicitudes falla en pagos · el equipo de pagos sube su propio muestreador del 1% al 100%"),
    question: t("Under parent-based sampling, what share of payments' failing requests are now in the archive?", "Con muestreo parent-based, ¿qué parte de las solicitudes fallidas de pagos queda ahora en el archivo?"),
    options: [
      t("All of them: payments records every request now", "Todas: pagos ahora registra cada solicitud"),
      t("Still about 1 in 100: payments follows the edge", "Sigue siendo cerca de 1 de cada 100: pagos sigue a la entrada"),
      t("All of them, but only payments' own span", "Todas, pero solo con el span de pagos"),
    ],
    answer: 1,
    why: t(
      "Under ParentBased, a service's own sampler decides only for spans with no parent: the roots. Payments is never a root. Every request reaches it carrying the edge's decision, and it follows that, so " + p1(C2.parent.errWhole) + " of failures are kept, exactly as before the change (" + p1(C2.before.errWhole) + "). Without parent-based sampling, payments' 100% would keep every failing span (" + pct(C2.own.errC) + "), but on its own: the edge and orders kept theirs 1 time in 100, so " + p1(C2.own.errWhole) + " of those traces are whole. A head sampler decides before anyone knows the request will fail. To keep failures whole, decide after the outcome is known: tail sampling at the collector kept " + pct(C2.tail.errWhole) + " of them whole (lesson 30, Sampling and cardinality, counts what that costs in storage).",
      "Con ParentBased, el muestreador propio de un servicio solo decide para los spans sin padre: las raíces. Pagos nunca es raíz. Cada solicitud le llega con la decisión de la entrada, y la sigue, así que se guarda el " + p1(C2.parent.errWhole) + " de las fallas, igual que antes del cambio (" + p1(C2.before.errWhole) + "). Sin parent-based, el 100% de pagos guardaría cada span fallido (" + pct(C2.own.errC) + "), pero suelto: la entrada y pedidos guardaron los suyos 1 vez de cada 100, así que solo el " + p1(C2.own.errWhole) + " de esas trazas está completo. Un muestreador head decide antes de que nadie sepa que la solicitud va a fallar. Para guardar las fallas completas hay que decidir cuando ya se conoce el resultado: el tail sampling en el colector guardó el " + pct(C2.tail.errWhole) + " completas (la lección 30, Muestreo y cardinalidad, cuenta cuánto cuesta eso en almacenamiento).",
    ),
    watch: { mode: "parent", keep: "0.01", pay: "all", wait: "15", coll: "one", inject: "err" },
  },
  {
    id: "wait",
    title: t("A 5-second decision wait", "Una espera de decisión de 5 segundos"),
    change: t("Tail sampling: keep errors, traces of " + SLOW_T + " s or more and 1% of the rest · 1% of requests are slow, 4 to 12 s at payments · the collector decides 15 s vs 5 s after a trace's first span arrives",
      "Tail sampling: guarda los errores, las trazas de " + SLOW_T + " s o más y el 1% del resto · el 1% de las solicitudes es lento, de 4 a 12 s en pagos · el colector decide 15 s vs 5 s después de que llega el primer span de una traza"),
    question: t("With a 5 s wait, what share of the slow traces are kept?", "Con una espera de 5 s, ¿qué parte de las trazas lentas se guarda?"),
    options: [
      t("All of them: every slow trace breaks the " + SLOW_T + " s rule", "Todas: cada traza lenta supera la regla de " + SLOW_T + " s"),
      t("A small share: most are judged before they end", "Una parte pequeña: la mayoría se juzga antes de terminar"),
      t("About half: the rest finish just after the wait", "Cerca de la mitad: el resto termina justo después"),
    ],
    answer: 1,
    why: t(
      "The clock starts when a trace's first span arrives, and that is orders' span, which ends within a second. A slow request is still running at payments when its 5 s are up, so the collector judges it on that one quick span: no error, a short duration, kept only by the 1% rule. The spans that arrive later follow the decision already made, so " + pct(C3.short.slowWhole) + " of slow traces survive: those whose payment call ended in time. With 15 s every slow request has finished and all are kept (" + pct(C3.long.slowWhole) + "). The price is memory: the collector holds every trace for the whole wait, so at " + RATE + " requests a second it holds about " + int(C3.short.held) + " traces with 5 s and " + int(C3.long.held) + " with 15 s (Little's law, lesson 33, Queues: traces held = arrival rate × wait). The OpenTelemetry Collector's tail sampling processor waits 30 s by default (decision_wait).",
      "El reloj arranca cuando llega el primer span de una traza, y ese es el span de pedidos, que termina en menos de un segundo. Una solicitud lenta sigue en pagos cuando se cumplen sus 5 s, así que el colector la juzga por ese único span rápido: sin error, con una duración corta, guardada solo por la regla del 1%. Los spans que llegan después siguen la decisión ya tomada, así que sobrevive el " + pct(C3.short.slowWhole) + " de las trazas lentas: las que terminaron su llamada a pagos a tiempo. Con 15 s todas las solicitudes lentas ya terminaron y se guardan todas (" + pct(C3.long.slowWhole) + "). El precio es memoria: el colector retiene cada traza durante toda la espera, así que a " + RATE + " solicitudes por segundo retiene unas " + int(C3.short.held) + " trazas con 5 s y " + int(C3.long.held) + " con 15 s (ley de Little, Little's law, lección 33, Colas: trazas retenidas = tasa de llegada × espera). El procesador de tail sampling del OpenTelemetry Collector espera 30 s por defecto (decision_wait).",
    ),
    watch: { mode: "tail", keep: "0.01", pay: "same", wait: "5", coll: "one", inject: "slow" },
  },
  {
    id: "split",
    title: t("Two collectors", "Dos colectores"),
    change: t("Tail sampling: keep errors, slow traces and 1% of the rest · two collector replicas behind a balancer that spreads spans evenly vs one that routes them by trace id",
      "Tail sampling: guarda los errores, las trazas lentas y el 1% del resto · dos réplicas del colector detrás de un balanceador que reparte los spans parejo vs uno que los enruta por trace id"),
    question: t("With spans spread evenly, how many failing requests reach the archive whole?", "Con los spans repartidos parejo, ¿cuántas solicitudes fallidas llegan completas al archivo?"),
    options: [
      t("All of them: both replicas apply the error rule", "Todas: las dos réplicas aplican la regla de errores"),
      t("About half: each replica sees half of every trace", "Cerca de la mitad: cada réplica ve la mitad de cada traza"),
      t("About a quarter: the other replica drops its part", "Cerca de un cuarto: la otra réplica descarta su parte"),
    ],
    answer: 2,
    why: t(
      "Each collector decides on the spans it holds. The one holding payments' failing span sees the error and keeps its part. The other holds only the edge's or orders' spans, sees a fast, healthy request and drops them, unless the 1% rule keeps it. A trace stays whole only when all three spans land on the same replica, 2 × (½)³ = ¼ of the time; the model gives " + pct(C4.rr.errWhole) + ", and " + pct(C4.rr.brokenShare) + " of all kept traces are broken. Ordinary traces kept by the 1% rule survive whole, because that rule hashes the trace id and both replicas agree. Route by trace id instead, as the Collector's load-balancing exporter does with its traceID routing key, and every span of a trace reaches the same replica: " + pct(C4.trace.errWhole) + " whole.",
      "Cada colector decide sobre los spans que tiene. El que tiene el span fallido de pagos ve el error y guarda su parte. El otro solo tiene spans de la entrada o de pedidos, ve una solicitud rápida y sana y los descarta, salvo que la regla del 1% la guarde. Una traza queda completa solo si sus tres spans caen en la misma réplica, 2 × (½)³ = ¼ de las veces; el modelo da " + pct(C4.rr.errWhole) + ", y el " + pct(C4.rr.brokenShare) + " de todas las trazas guardadas queda incompleto. Las trazas comunes que guarda la regla del 1% quedan completas, porque esa regla usa un hash del trace id y las dos réplicas coinciden. Si en cambio enrutas por trace id, como hace el exportador de balanceo de carga (load-balancing exporter) del Collector con su clave de enrutamiento traceID, todos los spans de una traza llegan a la misma réplica: " + pct(C4.trace.errWhole) + " completas.",
    ),
    watch: { mode: "tail", keep: "0.01", pay: "same", wait: "15", coll: "rr", inject: "err" },
  },
  {
    id: "weight",
    title: t("Read the error rate off the archive", "Leer la tasa de error en el archivo"),
    change: t("Tail sampling keeps every error and every slow trace, and 1% of the rest · 0.5% of requests fail · a dashboard computes the error rate from the traces in the archive",
      "El tail sampling guarda cada error y cada traza lenta, y el 1% del resto · falla el 0.5% de las solicitudes · un tablero calcula la tasa de error a partir de las trazas del archivo"),
    question: t("If the dashboard divides error traces by all traces in the archive, what rate does it show?", "Si el tablero divide las trazas con error por todas las trazas del archivo, ¿qué tasa muestra?"),
    options: [
      t("About the real one: a sample keeps the proportions", "Más o menos la real: una muestra conserva las proporciones"),
      t("Far above the real one: errors were kept more often", "Muy por encima de la real: los errores se guardaron más seguido"),
      t("A bit below the real one: some errors were dropped", "Un poco por debajo de la real: se descartaron algunos errores"),
    ],
    answer: 1,
    why: t(
      "Errors were kept at 100% and ordinary requests at 1%, so each ordinary trace in the archive stands for 100 requests and each error for one. Counted as equals, the traces say " + p1(C5.raw) + " of requests fail; the real rate is " + p1(C5.truth) + ". Weight each trace by 1 ÷ the chance it was kept (its adjusted count, the plaque on its folder) and the estimate comes back to " + p1(C5.weighted) + ". A sample is only as fair as your knowledge of its odds: record each trace's probability with it (OpenTelemetry's probability-sampling spec, still in development, puts it in the tracestate as the th threshold) and weight by it, or take rates from metrics, which count every request.",
      "Los errores se guardaron al 100% y las solicitudes comunes al 1%, así que cada traza común del archivo representa 100 solicitudes y cada error, una. Contadas como iguales, las trazas dicen que falla el " + p1(C5.raw) + " de las solicitudes; la tasa real es " + p1(C5.truth) + ". Pondera cada traza por 1 ÷ la probabilidad de que se guardara (su conteo ajustado, adjusted count: la placa de su carpeta) y la estimación vuelve a " + p1(C5.weighted) + ". Una muestra solo es justa si conoces sus probabilidades: guarda la probabilidad de cada traza junto a ella (la especificación de muestreo probabilístico de OpenTelemetry, todavía en desarrollo, la pone en el tracestate como el umbral th) y pondera por ella, o saca las tasas de las métricas, que cuentan cada solicitud.",
    ),
    watch: { mode: "tail", keep: "0.01", pay: "same", wait: "15", coll: "one", warm: 900 },
  },
];

const QUESTIONS = [
  [t("Your services sample 1% of traces at the edge, parent-based. What can you still learn from the archive, and what can't you?",
     "Tus servicios muestrean el 1% de las trazas en la entrada, con parent-based. ¿Qué todavía puedes aprender del archivo y qué no?"),
   t("You can see what typical requests look like end to end, where time goes on the common paths, and estimate volumes by weighting each trace by 100. You can't find a particular customer's failed request (it was almost certainly never recorded), and counts of rare events are a handful of samples, so their estimates are noisy. Take rates from metrics, and keep failures with tail sampling or a rule that records them.",
     "Puedes ver cómo son de punta a punta las solicitudes típicas, dónde se va el tiempo en los caminos comunes, y estimar volúmenes ponderando cada traza por 100. No puedes encontrar la solicitud fallida de un cliente en particular (casi seguro nunca se registró), y los conteos de eventos raros salen de un puñado de muestras, así que sus estimaciones son ruidosas. Saca las tasas de las métricas y guarda las fallas con tail sampling o con una regla que las registre.")],
  [t("What does parent-based sampling pass from service to service, and what happens if a service in the middle drops it?",
     "¿Qué pasa el muestreo parent-based de un servicio a otro, y qué ocurre si un servicio del medio lo pierde?"),
   t("The trace context: the trace id, the parent span id and the sampled flag, in the W3C traceparent header (and tracestate). A service that doesn't propagate it, or a queue or async job that drops it, starts a new trace from there: its spans become a separate root that its own root sampler decides on, and the original trace is cut at that hop. Propagate the context through every hop, including message headers, and check that services agree on the propagation format.",
     "El contexto de la traza: el trace id, el id del span padre y el indicador sampled, en el encabezado W3C traceparent (y tracestate). Un servicio que no lo propaga, o una cola o un trabajo asíncrono que lo pierde, empieza una traza nueva desde ahí: sus spans se vuelven una raíz aparte que decide su propio muestreador de raíz, y la traza original queda cortada en ese salto. Propaga el contexto en cada salto, también en los encabezados de los mensajes, y revisa que los servicios usen el mismo formato de propagación.")],
  [t("You turn on tail sampling in the Collector. What has to be true of your deployment for it to work?",
     "Activas el tail sampling en el Collector. ¿Qué tiene que cumplir tu despliegue para que funcione?"),
   t("Services must record and export all spans (or a high share), since anything dropped at the head can't be chosen later, and that costs network and collector CPU. All spans of a trace must reach the same instance: a first tier routes by trace id (the load-balancing exporter) to a second tier that samples. The decision wait must cover your longest traces plus export delays. And memory must hold arrival rate × wait traces: the processor keeps at most num_traces (50,000 by default), and when that fills, the oldest traces are dropped before they are decided.",
     "Los servicios deben registrar y exportar todos los spans (o una parte alta), porque lo que se descarta al inicio no se puede elegir después, y eso cuesta red y CPU del colector. Todos los spans de una traza deben llegar a la misma instancia: una primera capa enruta por trace id (el load-balancing exporter) hacia una segunda capa que muestrea. La espera de decisión debe cubrir tus trazas más largas más las demoras de exportación. Y la memoria debe alcanzar para tasa de llegada × espera trazas: el procesador retiene como máximo num_traces (50,000 por defecto), y cuando se llena, las trazas más antiguas se descartan antes de decidirse.")],
  [t("How do you estimate a request count or an error rate from a sampled archive, and when shouldn't you?",
     "¿Cómo estimas un conteo de solicitudes o una tasa de error a partir de un archivo muestreado, y cuándo no deberías?"),
   t("Weight each kept trace by 1 ÷ the probability it was kept (its adjusted count): ×100 for a 1% sample, ×1 for a trace a tail rule always keeps. That needs the probability recorded per trace, because it differs per rule. The weighted sums are unbiased but noisy when few samples back them, as for rare errors. For counts and rates you alert on, use metrics, or compute span metrics from every span before the sampler drops any (for example the Collector's span metrics connector placed ahead of sampling).",
     "Pondera cada traza guardada por 1 ÷ la probabilidad de que se guardara (su conteo ajustado): ×100 para una muestra del 1%, ×1 para una traza que una regla de tail siempre guarda. Eso exige guardar la probabilidad de cada traza, porque cambia según la regla. Las sumas ponderadas no tienen sesgo, pero son ruidosas cuando las respaldan pocas muestras, como con los errores raros. Para los conteos y las tasas sobre los que alertas, usa métricas, o calcula métricas de spans a partir de todos los spans antes de que el muestreador descarte alguno (por ejemplo, con el conector de span metrics del Collector antes del muestreo).")],
  [t("A two-minute export job keeps showing up in the archive as two or three fragments. Why, and what can you do?",
     "Un trabajo de exportación de dos minutos aparece en el archivo como dos o tres fragmentos. ¿Por qué, y qué puedes hacer?"),
   t("The tail sampler decided on the trace when its wait ran out, with only the early spans, and then forgot it; spans that arrived later started a new trace in the sampler and got their own decision. Options: a longer decision wait (more memory for every trace, not just this one), a decision cache so late spans follow the earlier decision, or splitting the job into shorter traces joined by span links. Batch and streaming jobs usually fit badly in one long trace.",
     "El muestreador tail decidió sobre la traza cuando venció su espera, solo con los primeros spans, y después la olvidó; los spans que llegaron más tarde empezaron una traza nueva en el muestreador y recibieron su propia decisión. Opciones: una espera de decisión más larga (más memoria para todas las trazas, no solo para esta), una caché de decisiones para que los spans tardíos sigan la decisión anterior, o partir el trabajo en trazas más cortas unidas por enlaces de spans (span links). Los procesos por lotes y de streaming suelen encajar mal en una sola traza larga.")],
  [t("You run 50 services at 20,000 requests a second. How would you combine head and tail sampling?",
     "Tienes 50 servicios con 20,000 solicitudes por segundo. ¿Cómo combinarías head sampling y tail sampling?"),
   t("Decide what you must never miss: errors, slow requests, important routes. Record those at 100% and keep the head decision parent-based so traces stay whole. Send spans through a trace-id-routed tier of collectors that tail-samples: keep errors and slow traces, a small share of the rest, and fewer of the high-volume, low-value traffic like health checks. If full recording is too costly, head-sample the cheap, healthy endpoints at the edge, knowing their failures will be missed too. Record every keep probability and compute rates from metrics.",
     "Decide qué nunca te puedes perder: errores, solicitudes lentas, rutas importantes. Registra eso al 100% y mantén la decisión head con parent-based para que las trazas queden completas. Manda los spans a una capa de colectores enrutada por trace id que haga tail sampling: guarda los errores y las trazas lentas, una parte pequeña del resto y menos aún del tráfico de mucho volumen y poco valor, como los chequeos de salud. Si registrar todo cuesta demasiado, haz head sampling en la entrada de los endpoints baratos y sanos, sabiendo que también te vas a perder sus fallas. Guarda cada probabilidad de guardado y saca las tasas de las métricas.")],
];

const pctLive = (x) => Math.round(x * 100) + "%";

export default defineLesson({
  title: t("Trace Sampling Workbench", "Banco de trabajo: muestreo de trazas"),
  eyebrow: t("Systems lesson 73 · Trace sampling", "Lección de sistemas 73 · Muestreo de trazas"),
  lede: t("Most systems keep only a sample of their traces, and whatever decides which ones also decides whether the trace you open is whole, whether the rare failure was kept at all, and what a count over the archive means. A 1% sample keeps a fair share of the common requests and almost never the rare one you need. This lesson builds the sampler as a trace archive: watch it run, predict what each setup keeps, then explain it back.",
    "La mayoría de los sistemas guarda solo una muestra de sus trazas, y lo que decide cuáles también decide si la traza que abres está completa, si la falla rara se guardó y qué significa un conteo sobre el archivo. Una muestra del 1% guarda una parte justa de las solicitudes comunes y casi nunca la rara que necesitas. Esta lección arma el muestreador como un archivo de trazas: mira cómo funciona, predice qué guarda cada configuración y después explícalo."),
  machine: {
    intro: t("Requests walk past three services, and every service that records writes a span card. The cards ride the belt to the collector; kept traces are filed in the archive, one folder each, with a plaque saying how many requests the trace stands for. Try the three ways to decide: every service on its own, everyone following the edge (parent-based), or the collector at the end (tail).",
      "Las solicitudes pasan por tres servicios, y cada servicio que registra escribe una tarjeta de span. Las tarjetas viajan por la cinta hasta el colector; las trazas guardadas se archivan, una carpeta cada una, con una placa que dice cuántas solicitudes representa la traza. Prueba las tres formas de decidir: cada servicio por su cuenta, todos siguiendo a la entrada (parent-based) o el colector al final (tail)."),
    plate: {
      title: t("Trace archive", "Archivo de trazas"),
      keys: [
        { mark: "lit", label: t("A failing request's span card", "La tarjeta de span de una solicitud que falla") },
        { mark: "raised", label: t("Span cards: the service's letter in front; a slow request's card is taller", "Tarjetas de span: la letra del servicio al frente; la de una solicitud lenta es más alta") },
        { mark: "flat", label: t("Folders: one kept trace each, with places for A, B and C", "Carpetas: una traza guardada cada una, con lugar para A, B y C") },
      ],
      caption: t(
        "Each request starts at A, the edge, calls B, orders, then C, payments; each service writes a span when its part ends, so B's card leaves first and A's last. A service's plaque shows its sampler's rate, and its flag goes up while it records; under parent-based sampling the request carries the edge's decision as a flag. With tail sampling every span is recorded; the collector holds a trace's cards in a rack slot while its gauge runs down the decision wait, then keeps every error, every trace of " + SLOW_T + " s or more and the keep rate of the rest. A folder with an empty place is a broken trace; its plaque is its weight, 1 ÷ the chance it was kept. The machine fails " + pctLive(LIVE_ERR) + " of requests and slows " + pctLive(LIVE_SLOW) + ", ten times the experiments' shares.",
        "Cada solicitud empieza en A, la entrada, llama a B, pedidos, y luego a C, pagos; cada servicio escribe un span al terminar su parte, así que la tarjeta de B sale primero y la de A, última. La placa de un servicio muestra la tasa de su muestreador, y su bandera sube mientras registra; con parent-based, la solicitud lleva la decisión de la entrada como bandera. Con tail sampling se registra cada span; el colector retiene las tarjetas de una traza en el estante mientras su indicador descuenta la espera de decisión, y luego guarda cada error, cada traza de " + SLOW_T + " s o más y la tasa de guardado del resto. Una carpeta con un lugar vacío es una traza incompleta; su placa es su peso, 1 ÷ la probabilidad de guardarla. La máquina hace fallar el " + pctLive(LIVE_ERR) + " de las solicitudes y vuelve lento el " + pctLive(LIVE_SLOW) + ", diez veces lo de los experimentos.",
      ),
      stage: { "data-archive": "" },
      label: t("Trace sampling simulation. Space pauses or resumes.", "Simulación de muestreo de trazas. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["kept", t("Kept", "Guardadas"), "–"],
      ["broken", t("Broken", "Incompletas"), "–"],
      ["errors", t("Errors kept", "Errores guardados"), "–"],
      ["slow", t("Slow kept", "Lentas guardadas"), "–"],
      ["held", t("In memory", "En memoria"), "–"],
      ["rate", t("Error rate, counted → weighted", "Tasa de error, contada → ponderada"), "–"],
    ],
    controls: [
      { seg: "mode", label: t("Who decides", "Quién decide"), options: [["own", t("Head: each service on its own", "Head: cada servicio por su cuenta")], ["parent", t("Head: follow the parent", "Head: seguir al padre")], ["tail", t("Tail: the collector", "Tail: el colector")]], value: "tail" },
      { seg: "keep", label: t("Keep rate", "Tasa de guardado"), options: [["0.5", "50%"], ["0.1", "10%"], ["0.01", "1%"]], value: "0.1" },
      { seg: "pay", label: t("Payments' sampler", "Muestreador de pagos"), options: [["same", t("Same rate", "La misma tasa")], ["all", "100%"]], value: "same" },
      { seg: "wait", label: t("Decision wait", "Espera de decisión"), options: [["5", "5 s"], ["15", "15 s"]], value: "15" },
      { seg: "coll", label: t("Collectors", "Colectores"), options: [["one", t("One", "Uno")], ["rr", t("Two, spans spread evenly", "Dos, spans repartidos parejo")], ["trace", t("Two, by trace id", "Dos, por trace id")]], value: "one" },
      { speed: true },
      { actions: [["err", t("Send a failing request", "Enviar una solicitud que falla")], ["slow", t("Send a slow request", "Enviar una solicitud lenta")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. About " + LIVE_RATE + " requests arrive a second; a slow one takes 4 to 12 s at payments, and spans that reach the collector after its decision follow it. The keep rate is each head sampler's rate, or the share of ordinary traces the collector keeps; payments' own rate, the decision wait and the collectors only matter where they apply.",
      "Cambiar un ajuste reinicia la ejecución. Llegan unas " + LIVE_RATE + " solicitudes por segundo; una lenta tarda de 4 a 12 s en pagos, y los spans que llegan al colector después de su decisión la siguen. La tasa de guardado es la de cada muestreador head, o la parte de las trazas comunes que guarda el colector; la tasa propia de pagos, la espera de decisión y los colectores solo importan donde aplican."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of " + N_REQ + " requests, with 0.5% failing and 1% slow.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de " + N_REQ + " solicitudes, con un 0.5% que falla y un 1% lento."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; its durations, delays and rates are illustrative. Sampler names follow the OpenTelemetry specification (ParentBased, TraceIdRatioBased) and the OpenTelemetry Collector's tail sampling processor and load-balancing exporter.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; sus duraciones, demoras y tasas son ilustrativas. Los nombres de los muestreadores siguen la especificación de OpenTelemetry (ParentBased, TraceIdRatioBased) y el procesador de tail sampling y el exportador de balanceo de carga del OpenTelemetry Collector.`),
  css: LIT_FILL_CSS + `
.iso-stage [data-layer] text{pointer-events:none}
[data-rate],[data-weight]{font-weight:600}
`,
  data: { P, G: GEOMETRY, CARD_SVG: cardSvg(), TOKEN_SVG: tokenSvg() },
});
