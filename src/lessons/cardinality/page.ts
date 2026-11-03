// @ts-nocheck: content ported as-is
// Systems lesson 30 · Sampling and cardinality: a tally hall for one metric and its traces.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, tokenSvg, P, GEOMETRY } from "./figure";
import { expectedSeries, sampleHours, seriesBytes } from "./sim";
import { one, int } from "../../lib/format";
import { meanBy } from "../../lib/stats";

// Experiment results, computed at build time from the same model the page runs (the original computed them in the
// browser when a card was run; series counts are exact expectations and the sampled hours are seeded, so the numbers
// are the same). N_HOUR: one hour at 100 requests a second.
const N_HOUR = 100 * 3600;
const series = (labels, route, n) => expectedSeries({ labels, route }, n);
const RESULTS = {
  base: series("base", "template", N_HOUR),
  status: series("status", "template", N_HOUR),
  statusDay: series("status", "template", N_HOUR * 24),
  user: series("user", "template", N_HOUR),
  userDay: series("user", "template", N_HOUR * 24),
  raw: series("status", "raw", N_HOUR),
  rawDay: series("status", "raw", N_HOUR * 24),
  head12: sampleHours({ mode: "head", head: 0.01 }, 12),
  head6: sampleHours({ mode: "head", head: 0.01 }, 6),
  tail6: sampleHours({ mode: "tail" }, 6),
};

// Memory as the machine's readout writes it.
function fmtBytes(b) {
  const u = [["GB", 2 ** 30], ["MB", 2 ** 20], ["KB", 2 ** 10]];
  for (const [n, v] of u) if (b >= v) { const x = b / v; return (x < 10 ? x.toFixed(1) : int(x)) + " " + n; }
  return b + " B";
}

// What each card shows after a run.
const RUNS = {
  status: () => {
    const a = RESULTS.base, b = RESULTS.status;
    return { verdict: t("16 series → " + int(b) + " (×" + one(b / a) + "), " + fmtBytes(seriesBytes(a)) + " → " + fmtBytes(seriesBytes(b)) + " of memory.",
        "16 series → " + int(b) + " (×" + one(b / a) + "), " + fmtBytes(seriesBytes(a)) + " → " + fmtBytes(seriesBytes(b)) + " de memoria."),
      bars: [["{method, route}", a / b, int(a) + " series"], ["{method, route, status}", 1, int(b) + " series", true]] };
  },
  user: () => {
    const a = RESULTS.status, h = RESULTS.user, d = RESULTS.userDay;
    return { verdict: t("After an hour: " + int(h) + " series (×" + int(h / a) + "), about " + fmtBytes(seriesBytes(h)) + ". After a day: " + int(d) + ", " + fmtBytes(seriesBytes(d)) + ". All for one counter.",
        "Después de una hora: " + int(h) + " series (×" + int(h / a) + "), unos " + fmtBytes(seriesBytes(h)) + ". Después de un día: " + int(d) + ", " + fmtBytes(seriesBytes(d)) + ". Todo para un solo contador."),
      bars: [[t("Without user_id", "Sin user_id"), a / d, int(a)], [t("With user_id, 1 hour", "Con user_id, 1 hora"), h / d, int(h), true], [t("With user_id, 1 day", "Con user_id, 1 día"), 1, int(d), true]] };
  },
  raw: () => {
    const t1 = RESULTS.statusDay, r1 = RESULTS.raw, r24 = RESULTS.rawDay;
    return { verdict: t("Template: " + int(t1) + " series after a day. Raw paths: " + int(r1) + " after an hour and " + int(r24) + " after a day (" + fmtBytes(seriesBytes(r24)) + "), still climbing.",
        "Plantilla: " + int(t1) + " series después de un día. Rutas crudas: " + int(r1) + " después de una hora y " + int(r24) + " después de un día (" + fmtBytes(seriesBytes(r24)) + "), y siguen subiendo."),
      bars: [[t("Template, 1 day", "Plantilla, 1 día"), t1 / r24, int(t1)], [t("Raw path, 1 hour", "Ruta cruda, 1 hora"), r1 / r24, int(r1), true], [t("Raw path, 1 day", "Ruta cruda, 1 día"), 1, int(r24), true]] };
  },
  head: () => {
    const hours = RESULTS.head12;
    const none = hours.filter((h) => h.rareKept === 0).length;
    const err = int(meanBy(hours, (h) => h.errors)), errK = one(meanBy(hours, (h) => h.errorsKept)), rare = one(meanBy(hours, (h) => h.rare)), rareK = one(meanBy(hours, (h) => h.rareKept));
    return { verdict: t("Per hour, on average: " + err + " errors, " + errK + " kept; " + rare + " rare failures, " + rareK + " kept. " + none + " of 12 hours kept no example of the rare bug.",
        "Por hora, en promedio: " + err + " errores, " + errK + " guardados; " + rare + " fallas raras, " + rareK + " guardadas. En " + none + " de 12 horas no se guardó ningún ejemplo del bug raro."),
      bars: [[t("Errors kept", "Errores guardados"), meanBy(hours, (h) => h.errorsKept / h.errors), t(errK + " of " + err, errK + " de " + err)], [t("Rare bug kept", "Bug raro guardado"), meanBy(hours, (h) => h.rareKept / Math.max(1, h.rare)), t(rareK + " of " + rare, rareK + " de " + rare), true], [t("Hours with no example", "Horas sin ningún ejemplo"), none / 12, t(none + " of 12", none + " de 12"), true]] };
  },
  tail: () => {
    const head = RESULTS.head6, tail = RESULTS.tail6;
    const hk = meanBy(head, (h) => h.kept), tk = meanBy(tail, (h) => h.kept);
    const ehk = one(meanBy(head, (h) => h.errorsKept)), etk = int(meanBy(tail, (h) => h.errorsKept)), et = int(meanBy(tail, (h) => h.errors));
    return { verdict: t("Traces stored per hour: " + int(hk) + " with head 1%, " + int(tk) + " with tail (×" + one(tk / hk) + "). Errors kept: " + ehk + " vs " + etk + " of " + et + ". The tail sampler holds about 1,000 traces at any moment (10 s each at 100/s) while it waits.",
        "Trazas almacenadas por hora: " + int(hk) + " con head 1%, " + int(tk) + " con tail (×" + one(tk / hk) + "). Errores guardados: " + ehk + " contra " + etk + " de " + et + ". El muestreador tail retiene unas 1,000 trazas en todo momento (10 s cada una a 100/s) mientras espera."),
      bars: [[t("Stored, head 1%", "Almacenadas, head 1%"), hk / tk, int(hk)], [t("Stored, tail", "Almacenadas, tail"), 1, int(tk), true], [t("Errors kept, head", "Errores guardados, head"), meanBy(head, (h) => h.errorsKept / h.errors), ehk], [t("Errors kept, tail", "Errores guardados, tail"), 1, etk, true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "status",
    title: t("Add a status label", "Agrega una etiqueta status"),
    change: t("http_requests_total{method, route} → {method, route, status} · 2 methods × 8 routes, status has 5 values · 100 requests/s for an hour",
      "http_requests_total{method, route} → {method, route, status} · 2 métodos × 8 rutas, status tiene 5 valores · 100 solicitudes/s durante una hora"),
    question: t("The metric had 16 series. After adding status, how many series does it have?", "La métrica tenía 16 series. Después de agregar status, ¿cuántas series tiene?"),
    options: [t("21: five more, one per status", "21: cinco más, una por status"), t("About 80: every existing series splits into one per status", "Unas 80: cada serie que ya existía se divide en una por status"), t("Still 16: the status is stored inside each sample", "Siguen siendo 16: el status se guarda dentro de cada muestra")],
    answer: 1,
    why: t("A series is one combination of label values, so the count is the product of how many values each label takes: 2 × 8 × 5 = 80. Every label multiplies. Here that's fine: 80 series is a few hundred kilobytes, and every value is bounded.",
      "Una serie es una combinación de valores de etiquetas, así que la cantidad es el producto de cuántos valores toma cada etiqueta: 2 × 8 × 5 = 80. Cada etiqueta multiplica. Aquí no hay problema: 80 series son unos cientos de kilobytes, y todos los valores están acotados."),
    watch: { labels: "status", route: "template" },
  },
  {
    id: "user",
    title: t("Add user_id", "Agrega user_id"),
    change: t("{method, route, status} → {method, route, status, user_id} · 10,000 active users · 100 requests/s for an hour",
      "{method, route, status} → {method, route, status, user_id} · 10,000 usuarios activos · 100 solicitudes/s durante una hora"),
    question: t("Compared with the 80 series before, the count after one hour is…", "Comparada con las 80 series de antes, la cantidad después de una hora es…"),
    options: [t("About the same: user_id is just one more column", "Más o menos la misma: user_id es solo una columna más"), t("About 125 times more: one per user, 10,000", "Unas 125 veces más: una por usuario, 10,000"), t("Thousands of times more: well over a hundred thousand series", "Miles de veces más: muchas más de cien mil series")],
    answer: 2,
    why: t("user_id multiplies too: every route and status a user touches becomes its own series. Not every combination happens in an hour, but a large share do, and the count keeps climbing as the day goes on. At a few kilobytes per series that is hundreds of megabytes for one metric, and queries over it slow down. Per-user detail belongs in logs and traces, which cost per event, not per combination.",
      "user_id también multiplica: cada ruta y cada status que toca un usuario se vuelve su propia serie. No todas las combinaciones ocurren en una hora, pero sí una gran parte, y la cantidad sigue subiendo a lo largo del día. A unos kilobytes por serie, son cientos de megabytes para una sola métrica, y las consultas sobre ella se vuelven lentas. El detalle por usuario va en logs y trazas, que cuestan por evento, no por combinación."),
    watch: { labels: "user", route: "template" },
  },
  {
    id: "raw",
    title: t("Raw paths as the route", "Rutas crudas en la etiqueta route"),
    change: t("route=\"/orders/{id}\" → route=\"/orders/58213\" · ids come from a catalogue of a million · {method, route, status} · 100 requests/s",
      "route=\"/orders/{id}\" → route=\"/orders/58213\" · los ids salen de un catálogo de un millón · {method, route, status} · 100 solicitudes/s"),
    question: t("How many series after one hour, and after a day?", "¿Cuántas series hay después de una hora, y después de un día?"),
    options: [t("About 80 both times, like the template", "Unas 80 en los dos casos, como con la plantilla"), t("A lot more after an hour, then it levels off", "Muchas más después de una hora, y luego se estabiliza"), t("Far more after an hour and many times more again after a day: it never levels off", "Muchísimas más después de una hora y varias veces más después de un día: nunca se estabiliza")],
    answer: 2,
    why: t("An id in a label is an unbounded label: there is no last value, so new series keep appearing for as long as new ids are requested. This is the most common way cardinality leaks into a metrics system: raw URLs, error messages, query strings, IP addresses. Template the route before it becomes a label.",
      "Un id en una etiqueta la vuelve no acotada: no hay un último valor, así que siguen apareciendo series nuevas mientras se pidan ids nuevos. Es la forma más común en que la cardinalidad se cuela en un sistema de métricas: URLs crudas, mensajes de error, query strings, direcciones IP. Convierte la ruta en plantilla antes de que se vuelva etiqueta."),
    watch: { labels: "status", route: "raw" },
  },
  {
    id: "head",
    title: t("Head sampling at 1%", "Head sampling al 1%"),
    change: t("Keep 1 in 100 traces, decided when the request starts · 0.1% of requests fail · one rare bug hits 1 in 10,000 · 100 requests/s, 12 hours",
      "Guarda 1 de cada 100 trazas, decidido cuando empieza la solicitud · falla el 0.1% de las solicitudes · un bug raro afecta a 1 de cada 10,000 · 100 solicitudes/s, 12 horas"),
    question: t("Each hour about 360 requests fail, 36 of them from the rare bug. How many traces of the rare bug do you keep in an hour?",
      "Cada hora fallan unas 360 solicitudes, 36 de ellas por el bug raro. ¿Cuántas trazas del bug raro guardas en una hora?"),
    options: [t("About 36: a fair share of everything is kept", "Unas 36: se guarda una parte justa de todo"), t("About 3 or 4", "Unas 3 o 4"), t("Usually none: most hours have no example at all", "Casi siempre ninguna: la mayoría de las horas no tiene ni un ejemplo")],
    answer: 2,
    why: t("The head gate decides before it knows how the request will end, so errors are kept at the same 1% as everything else: 360 errors become about 3 traces, and 36 rare failures become 0.36, so most hours have none. Head sampling is cheap and fine for the common path, but a rare failure needs far more traffic before you hold even one example. Count errors with metrics (which see every request) and keep error traces some other way.",
      "La compuerta head decide antes de saber cómo va a terminar la solicitud, así que los errores se guardan al mismo 1% que todo lo demás: 360 errores quedan en unas 3 trazas, y 36 fallas raras quedan en 0.36, así que la mayoría de las horas no tiene ninguna. El head sampling es barato y sirve para el camino común, pero una falla rara necesita muchísimo más tráfico antes de que tengas siquiera un ejemplo. Cuenta los errores con métricas (que ven cada solicitud) y guarda las trazas de error de otra forma."),
    watch: { labels: "status", route: "template", sampling: "head1" },
  },
  {
    id: "tail",
    title: t("Tail sampling", "Tail sampling"),
    change: t("Wait until each trace finishes, then keep every error, every slow trace (0.5%) and 1% of the rest · same traffic as before",
      "Espera a que termine cada traza y luego guarda todos los errores, todas las trazas lentas (0.5%) y el 1% del resto · el mismo tráfico que antes"),
    question: t("Compared with head sampling at 1%, what does tail sampling cost?", "Comparado con head sampling al 1%, ¿cuánto cuesta el tail sampling?"),
    options: [t("Somewhat more storage, every error kept, but every trace must wait in a buffer until it finishes", "Algo más de almacenamiento, se guardan todos los errores, pero cada traza tiene que esperar en un búfer hasta terminar"), t("About 100 times the storage: it has to keep everything", "Unas 100 veces el almacenamiento: tiene que guardarlo todo"), t("Less storage: it drops more of the ordinary traces", "Menos almacenamiento: descarta más trazas comunes")],
    answer: 0,
    why: t("Errors and slow requests are a small share of traffic, so keeping all of them adds little to the 1% baseline, and you keep exactly the traces you'll want to open. The price moves elsewhere: the sampler must hold every trace in memory until it is complete (all its spans have arrived) before it can decide, and all spans of a trace must reach the same sampler.",
      "Los errores y las solicitudes lentas son una parte pequeña del tráfico, así que guardarlos todos suma poco a la base del 1%, y guardas justo las trazas que vas a querer abrir. El precio se va a otro lado: el muestreador (sampler) tiene que mantener cada traza en memoria hasta que esté completa (hasta que llegaron todos sus spans) antes de poder decidir, y todos los spans de una traza tienen que llegar al mismo muestreador."),
    watch: { labels: "status", route: "template", sampling: "tail" },
  },
];

const QUESTIONS = [
  [t("A teammate adds user_id as a label on http_requests_total \"so we can see who is affected\". What happens, and what would you do instead?",
    "Alguien del equipo agrega user_id como etiqueta en http_requests_total \"para ver a quién afecta\". ¿Qué pasa y qué harías en su lugar?"),
    t("Every user multiplies the series: route × status × users, hundreds of thousands of series, so memory and ingestion cost jump, queries slow down, and the metrics system may start dropping data or hit limits. Keep metric labels bounded (method, route template, status class) and put user ids in logs and traces, linked from the metric by an exemplar or trace id. If you need per-customer numbers, use a small bounded label like a plan or tier.",
      "Cada usuario multiplica las series: ruta × status × usuarios, cientos de miles de series, así que el costo de memoria y de ingesta se dispara, las consultas se vuelven lentas y el sistema de métricas puede empezar a descartar datos o chocar con sus límites. Mantén acotadas las etiquetas de las métricas (método, plantilla de ruta, clase de status) y pon los ids de usuario en logs y trazas, enlazados desde la métrica con un exemplar o un trace id. Si necesitas números por cliente, usa una etiqueta pequeña y acotada, como el plan o el nivel.")],
  [t("How do you estimate how many series a metric will create before you ship it?", "¿Cómo estimas cuántas series va a crear una métrica antes de publicarla?"),
    t("Multiply the number of distinct values of every label; that's the ceiling, and real traffic hits a share of it. Remember the labels you don't write yourself: every instance or pod multiplies it again, and a histogram multiplies it by its number of buckets. If any label has no fixed list of values, the answer is \"unbounded\" and the label needs to change.",
      "Multiplica la cantidad de valores distintos de cada etiqueta; ese es el techo, y el tráfico real llega a una parte de él. Recuerda las etiquetas que no escribes tú: cada instancia o pod lo vuelve a multiplicar, y un histograma lo multiplica por su cantidad de buckets. Si alguna etiqueta no tiene una lista fija de valores, la respuesta es \"no acotada\" y hay que cambiar esa etiqueta.")],
  [t("The number of series grows every day although nothing was deployed. Where would you look?", "La cantidad de series crece todos los días aunque no se desplegó nada. ¿Dónde buscarías?"),
    t("For an unbounded label: raw paths with ids, error messages, query strings, IP addresses, user agents, or pod names that change on every restart or autoscale. Find the metric with the most series and the label with the most values, then template, bucket or drop that label (for example with a relabelling rule).",
      "Una etiqueta no acotada: rutas crudas con ids, mensajes de error, query strings, direcciones IP, user agents o nombres de pods que cambian en cada reinicio o autoescalado. Encuentra la métrica con más series y la etiqueta con más valores, y después conviértela en plantilla, agrúpala en rangos o elimínala (por ejemplo, con una regla de relabeling).")],
  [t("Head sampling and tail sampling: what does each cost, and what does each miss?", "Head sampling y tail sampling: ¿cuánto cuesta cada uno y qué se pierde cada uno?"),
    t("Head sampling decides at the start: cheap, stateless, every service follows the same decision, but it can't know a request will fail or be slow, so rare errors are mostly dropped. Tail sampling decides when the trace is complete, so it can keep every error and slow trace; it needs a buffer that holds every trace until it finishes, a wait before the decision, and all spans of a trace routed to the same sampler.",
      "El head sampling decide al inicio: es barato, no guarda estado y todos los servicios siguen la misma decisión, pero no puede saber si una solicitud va a fallar o a ser lenta, así que la mayoría de los errores raros se descartan. El tail sampling decide cuando la traza está completa, así que puede guardar cada error y cada traza lenta; necesita un búfer que retenga cada traza hasta que termine, una espera antes de decidir y que todos los spans de una traza se enruten al mismo muestreador.")],
  [t("With head sampling at 1%, can you still tell the error rate? Can you find the trace of one customer's failed checkout?",
    "Con head sampling al 1%, ¿todavía puedes saber la tasa de errores? ¿Puedes encontrar la traza del checkout fallido de un cliente?"),
    t("The rate, roughly, but counts from sampled traces are noisy when errors are rare: 360 errors an hour become about 3 kept traces. Take rates from metrics, which count every request. One specific failed checkout was almost certainly dropped; to have it you need tail sampling (keep all errors), a rule that always keeps errors, or logs that carry the trace id.",
      "La tasa, más o menos, pero los conteos que salen de trazas muestreadas son ruidosos cuando los errores son raros: 360 errores por hora quedan en unas 3 trazas guardadas. Saca las tasas de las métricas, que cuentan cada solicitud. Ese checkout fallido en particular casi seguro se descartó; para tenerlo necesitas tail sampling (guardar todos los errores), una regla que siempre guarde los errores, o logs que lleven el trace id.")],
  [t("Metrics, logs and traces: where should high-cardinality data go, and why?", "Métricas, logs y trazas: ¿adónde deberían ir los datos de alta cardinalidad, y por qué?"),
    t("Into logs and traces. A metric costs per series and is kept and indexed for every combination of labels, so each label must have few values. Logs and traces cost per event, so they can carry any id: user, order, request. Link them: a trace id in the logs, exemplars on the metric pointing to example traces.",
      "A los logs y las trazas. Una métrica cuesta por serie y se guarda e indexa para cada combinación de etiquetas, así que cada etiqueta debe tener pocos valores. Los logs y las trazas cuestan por evento, así que pueden llevar cualquier id: usuario, pedido, solicitud. Enlázalos: un trace id en los logs y exemplars en la métrica que apunten a trazas de ejemplo.")],
];

export default defineLesson({
  title: t("Cardinality Workbench", "Banco de trabajo: cardinalidad"),
  eyebrow: t("Systems lesson 30 · Sampling and cardinality", "Lección de sistemas 30 · Muestreo y cardinalidad"),
  lede: t("Every label on a metric multiplies how many time series it creates, and every trace you keep costs storage, so what you record has to be chosen. This lesson builds a metric and a trace sampler as one machine: watch it run, predict what an experiment will do, then explain it back.",
    "Cada etiqueta de una métrica multiplica cuántas series de tiempo crea, y cada traza que guardas cuesta almacenamiento, así que hay que elegir qué registrar. Esta lección arma una métrica y un muestreador de trazas como una sola máquina: mira cómo funciona, predice qué hará un experimento y después explícalo."),
  machine: {
    intro: t("One service, two records of every request. At the back, a tally card finds the pigeonhole for its exact combination of labels: one hole per time series. At the front, the request's trace goes through a sampler that keeps or drops it. Add a label, switch the route to raw paths, or change the sampler, and watch the wall, the dial and the archive.",
    "Un servicio, dos registros de cada solicitud. Al fondo, una tarjeta de conteo busca el casillero de su combinación exacta de etiquetas: un casillero por serie de tiempo. Al frente, la traza de la solicitud pasa por un muestreador que la guarda o la descarta, al empezar (head sampling) o al terminar (tail sampling). Agrega una etiqueta, cambia la ruta a rutas crudas o cambia el muestreador, y mira la pared, el dial y el archivo."),
    plate: {
      title: t("Tally hall", "Sala de conteo"),
      keys: [
        { mark: "lit", label: t("A failed request's trace, and a pigeonhole a card just landed in", "La traza de una solicitud fallida, y un casillero donde acaba de caer una tarjeta") },
        { mark: "raised", label: t("Tally cards, traces (tall when slow), counters and kept trace cards", "Tarjetas de conteo, trazas (altas si son lentas), contadores y tarjetas de trazas guardadas") },
        { mark: "flat", label: t("Belts, the buffer rack and the drop bins", "Cintas, el estante búfer y los cestos de descarte") },
      ],
      caption: t(
        "For every request the service cabinet sends a tally card up the back belt and a trace along the front belt. Each distinct combination of label values owns one pigeonhole in the wall: that is one time series. The series counter and the memory dial (one tick per ×10, from 10 KB to 10 GB) stand beside the wall; when every hole is taken, new series fall into the overflow bin. A gate with an open bin is the sampler in use: the head gate decides as the trace starts, the tail gate after it has waited in the buffer rack until it finished. Kept traces stand in the archive drawer, error traces lit, and its front counts traces kept, errors seen and errors kept.",
        "Por cada solicitud, el gabinete del servicio manda una tarjeta de conteo por la cinta del fondo y una traza por la cinta del frente. Cada combinación distinta de valores de etiquetas tiene su propio casillero en la pared: eso es una serie de tiempo (time series). El contador de series y el dial de memoria (una marca por cada ×10, de 10 KB a 10 GB) están junto a la pared; cuando todos los casilleros están ocupados, las series nuevas caen al cesto de desborde. Una compuerta con un cesto abierto es el muestreador en uso: la compuerta head decide cuando empieza la traza; la compuerta tail, después de que la traza esperó en el estante búfer hasta terminar. Las trazas guardadas quedan de pie en el cajón del archivo, las de error iluminadas, y su frente cuenta las trazas guardadas, los errores vistos y los errores que quedan.",
      ),
      stage: { "data-hall": "" },
      label: t("Sampling and cardinality simulation. Space pauses or resumes.", "Simulación de muestreo y cardinalidad. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["requests", t("Requests", "Solicitudes")], ["series", "Series"], ["memory", t("Series memory", "Memoria de series"), "–"], ["kept", t("Traces kept", "Trazas guardadas")], ["errors", t("Errors kept", "Errores guardados"), "–"], ["buffer", t("Waiting in buffer", "Esperando en el búfer")]],
    controls: [
      { seg: "labels", label: t("Labels", "Etiquetas"), options: [["base", t("Method · route", "Método · ruta")], ["status", "+ status"], ["user", "+ user id"]], value: "status" },
      { seg: "route", label: t("Route label", "Etiqueta route"), options: [["template", t("Template", "Plantilla")], ["raw", t("Raw path", "Ruta cruda")]], value: "template" },
      { seg: "sampling", label: t("Traces", "Trazas"), options: [["all", t("Keep all", "Guardar todas")], ["head10", "Head 10%"], ["head1", "Head 1%"], ["tail", "Tail"]], value: "tail" },
      { seg: "errors", label: t("Errors", "Errores"), options: [[0.005, "0.5%"], [0.02, "2%"], [0.1, "10%"]], value: 0.02 },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The machine runs 8 requests a second, so it fills the wall in seconds; the experiments use 100 a second for hours. Changing the labels, the route, the sampler or the error rate starts the run again.",
      "La máquina procesa 8 solicitudes por segundo, así que llena la pared en segundos; los experimentos usan 100 por segundo durante horas. Cambiar las etiquetas, la ruta, el muestreador o la tasa de errores reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Series counts are the expected number of distinct label combinations at 100 requests a second; sampling results average seeded runs of the same model.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Las cantidades de series son el número esperado de combinaciones distintas de etiquetas a 100 solicitudes por segundo; los resultados de muestreo promedian ejecuciones con semilla fija del mismo modelo."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Memory per series is a round figure (about 3 KB) for an in-memory time-series store. Simulation written for this lesson.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). La memoria por serie es una cifra redonda (unos 3 KB) para un almacén de series de tiempo en memoria. Simulación escrita para esta lección.`),
  css: `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.6}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
.dg[data-size=m]{stroke-width:1.5}
.dg[data-size=s]{stroke-width:.9}
.hole{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:.6}
.hole-card{display:none;fill:var(--anatomy-lit-top);stroke:var(--anatomy-mid);stroke-width:.7}
[data-hole][data-on] .hole-card{display:inline}
[data-hole][data-hit] .hole-card{stroke:var(--anatomy-lit);stroke-width:1.5}
.bin-hole{fill:var(--anatomy-shade-0);stroke:none}
.needle{fill:none;stroke:var(--anatomy-strong);stroke-width:1.8;stroke-linecap:round}
`,
  data: {
    P,
    G: GEOMETRY,
    TOK: tokenSvg(),
  },
});
