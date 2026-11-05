// @ts-nocheck: content in the style of the other lessons
// Systems lesson 74 · Merging percentiles: a sorting room where three hosts' latency histograms add up.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, chipSvg, slipSvg, P, GEOMETRY } from "./figure";
import { avgRun, evenRun, mergeRun, sloRun, topRun, makeFleet, DEFAULTS, SEEDS, WINDOW, RATE, MEDIAN, SLOW_X, LAYOUTS } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeded minutes each).
const R = { avg: avgRun(), even: evenRun(), merge: mergeRun(), slo: sloRun(), top: topRun() };
// The opening frame: the live code's first run (seed 7), a full minute in.
const FIRST = (() => { const f = makeFleet(DEFAULTS, 7); f.runTo(WINDOW); return f.summary(); })();
const SCRAPE = 5, CHIP_EVERY = 20;

const ms = (x) => Math.round(x) + " ms";
const pc = (x) => (100 * x).toFixed(1) + "%";
const times = (x) => (Math.round(x * 10) / 10).toFixed(1) + "×";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const runs = SEEDS.length;
const of8 = (x) => Math.round(x * runs) + " of " + runs, de8 = (x) => Math.round(x * runs) + " de " + runs;
const SHORT_TOP = LAYOUTS.short[LAYOUTS.short.length - 1];
const int = (x) => Math.round(x).toLocaleString("en");
const gap = (x) => (x < 10 ? (Math.round(x * 10) / 10).toFixed(1) : String(Math.round(x)));
const met = (x) => (x >= 0.99 ? t("objective met", "objetivo cumplido") : t("objective missed", "objetivo incumplido"));

// What each card shows after a run.
const RUNS = {
  avg: () => {
    const s = R.avg.slow, m = top(s.max);
    return {
      verdict: t("Host p99s: A " + ms(s.pA) + ", B " + ms(s.pB) + ", C " + ms(s.pC) + ". Their average: " + ms(s.avg) + ", " + times(s.avg / s.exact) + " the exact p99 of all requests, " + ms(s.exact) + ". The largest, C's, is " + times(s.max / s.exact) + " it. C served " + Math.round(s.nC) + " of " + int(s.n) + " requests in the minute.",
        "p99 de cada host: A " + ms(s.pA) + ", B " + ms(s.pB) + ", C " + ms(s.pC) + ". Su promedio: " + ms(s.avg) + ", " + times(s.avg / s.exact) + " el p99 exacto de todas las solicitudes, " + ms(s.exact) + ". El máximo, el de C, es " + times(s.max / s.exact) + " ese valor. C atendió " + Math.round(s.nC) + " de " + int(s.n) + " solicitudes en el minuto."),
      bars: [[t("Exact p99, all requests", "p99 exacto, todas las solicitudes"), s.exact / m, ms(s.exact)], [t("Average of the three p99s", "Promedio de los tres p99"), s.avg / m, ms(s.avg), true], [t("Largest p99 (host C)", "p99 más alto (host C)"), s.max / m, ms(s.max)]],
    };
  },
  even: () => {
    const s = R.even.even, m = top(s.avg, s.exact, s.max);
    return {
      verdict: t("Host p99s: A " + ms(s.pA) + ", B " + ms(s.pB) + ", C " + ms(s.pC) + ". Their average: " + ms(s.avg) + "; the exact p99 of all requests: " + ms(s.exact) + ", " + gap(Math.abs(s.avg - s.exact)) + " ms apart.",
        "p99 de cada host: A " + ms(s.pA) + ", B " + ms(s.pB) + ", C " + ms(s.pC) + ". Su promedio: " + ms(s.avg) + "; el p99 exacto de todas las solicitudes: " + ms(s.exact) + ", a " + gap(Math.abs(s.avg - s.exact)) + " ms de distancia."),
      bars: [[t("Exact p99, all requests", "p99 exacto, todas las solicitudes"), s.exact / m, ms(s.exact)], [t("Average of the three p99s", "Promedio de los tres p99"), s.avg / m, ms(s.avg), true], [t("Largest p99", "p99 más alto"), s.max / m, ms(s.max)]],
    };
  },
  merge: () => {
    const s = R.merge.slow, m = top(s.avg);
    return {
      verdict: t("Read off the merged buckets: " + ms(s.est) + ". Exact: " + ms(s.exact) + ", " + Math.round(s.err) + " ms away on average, and in the same bucket in " + of8(s.sameBucket) + " runs. The average of the three p99s was " + ms(s.avg) + ".",
        "Leído de los buckets combinados: " + ms(s.est) + ". Exacto: " + ms(s.exact) + ", a " + Math.round(s.err) + " ms en promedio, y en el mismo bucket en " + de8(s.sameBucket) + " ejecuciones. El promedio de los tres p99 fue " + ms(s.avg) + "."),
      bars: [[t("Exact p99", "p99 exacto"), s.exact / m, ms(s.exact)], [t("p99 from the merged buckets", "p99 de los buckets combinados"), s.est / m, ms(s.est), true], [t("Average of the three p99s", "Promedio de los tres p99"), s.avg / m, ms(s.avg)]],
    };
  },
  slo: () => {
    const { fine, coarse } = R.slo;
    // shares as bars against a 95–100% scale, so the gap around 99% shows
    const sh = (x) => Math.max(0.02, (x - 0.95) / 0.05);
    return {
      verdict: t("Exact share under 300 ms: " + pc(fine.underExact) + ", " + met(fine.underExact).en + ". Fine buckets (an edge at 300 ms): " + pc(fine.underBuckets) + ". Coarse buckets, interpolated inside 100–500 ms: " + pc(coarse.underBuckets) + ", " + met(coarse.underBuckets).en + ". The coarse edges alone say " + pc(coarse.edgeLo) + " under 100 ms and " + pc(coarse.edgeHi) + " under 500 ms. Their p99 reads " + ms(coarse.est) + " against an exact " + ms(coarse.exact) + ".",
        "Proporción exacta bajo 300 ms: " + pc(fine.underExact) + ", " + met(fine.underExact).es + ". Buckets finos (con un borde en 300 ms): " + pc(fine.underBuckets) + ". Buckets gruesos, interpolando dentro de 100–500 ms: " + pc(coarse.underBuckets) + ", " + met(coarse.underBuckets).es + ". Los bordes gruesos por sí solos dicen " + pc(coarse.edgeLo) + " bajo 100 ms y " + pc(coarse.edgeHi) + " bajo 500 ms. Su p99 marca " + ms(coarse.est) + " contra un exacto de " + ms(coarse.exact) + "."),
      bars: [[t("Exact share under 300 ms (95–100%)", "Proporción exacta bajo 300 ms (95–100%)"), sh(fine.underExact), pc(fine.underExact)], [t("Fine buckets, edge at 300 ms", "Buckets finos, borde en 300 ms"), sh(fine.underBuckets), pc(fine.underBuckets)], [t("Coarse buckets, interpolated", "Buckets gruesos, interpolado"), sh(coarse.underBuckets), pc(coarse.underBuckets), true]],
    };
  },
  top: () => {
    const { short, fine } = R.top, m = top(short.exact, fine.est, short.avg);
    // the average of the runs' readings equals the top edge only if every run read the top edge
    const every = Math.abs(short.est - SHORT_TOP) < 1e-9, ev = every ? t(" in every run", " en cada ejecución") : t(" on average", " en promedio");
    return {
      verdict: t("Buckets ending at " + SHORT_TOP + " ms: the p99 reads " + ms(short.est) + ev.en + ", while the exact p99 is " + ms(short.exact) + " and " + pc(1 - short.edgeLo) + " of requests landed in +Inf. The fine buckets read " + ms(fine.est) + ".",
        "Buckets que terminan en " + SHORT_TOP + " ms: el p99 marca " + ms(short.est) + ev.es + ", mientras el p99 exacto es " + ms(short.exact) + " y el " + pc(1 - short.edgeLo) + " de las solicitudes cayó en +Inf. Los buckets finos marcan " + ms(fine.est) + "."),
      bars: [[t("Exact p99", "p99 exacto"), short.exact / m, ms(short.exact)], [t("p99, buckets ending at " + SHORT_TOP + " ms", "p99, buckets hasta " + SHORT_TOP + " ms"), short.est / m, ms(short.est), true], [t("p99, fine buckets", "p99, buckets finos"), fine.est / m, ms(fine.est)]],
    };
  },
};

const EXPERIMENTS = [
  {
    id: "avg",
    title: t("A slow host with little traffic", "Un host lento con poco tráfico"),
    change: t("Host C 8× slower and serving 1 request in 100; A and B healthy · the dashboard averages the three hosts' p99s",
      "El host C, 8× más lento, atiende 1 de cada 100 solicitudes; A y B, sanos · el tablero promedia los p99 de los tres hosts"),
    question: t("How does the average of the three p99s compare with the exact p99 of every request?", "¿Cómo se compara el promedio de los tres p99 con el p99 exacto de todas las solicitudes?"),
    options: [
      t("About the same: one quiet host barely counts", "Más o menos igual: un host con poco tráfico casi no cuenta"),
      t("About twice too high: C gets a third of the say", "Cerca del doble: C pesa un tercio del promedio"),
      t("Too low: two healthy hosts outvote the slow one", "Demasiado bajo: dos hosts sanos le ganan al lento"),
    ],
    answer: 1,
    why: t(
      "An average gives each host a third of the weight, whatever its traffic, so C's p99 of about a second pulls it far up. But C serves 1 request in 100. The fleet's p99 is the request that 99% of all requests beat, and the slowest 1% are mostly C's 1%, so the fleet's p99 lands just past the top of A and B's tail, nowhere near C's. The largest p99 is worse still: it describes C alone, as if every user had C's experience. A percentile is a rank in one sorted list; no arithmetic on the hosts' p99s gives you the rank in the combined list. When the slow host carries a big enough share of the traffic (here about 5%), the same average comes out too low instead (lesson 44, Percentiles).",
      "Un promedio le da a cada host un tercio del peso, sin importar su tráfico, así que el p99 de C, cerca de un segundo, lo sube mucho. Pero C atiende 1 de cada 100 solicitudes. El p99 de la flota es la solicitud que el 99% de todas las solicitudes superan en rapidez, y el 1% más lento es casi todo el 1% de C, así que el p99 de la flota cae justo después del final de la cola de A y B, lejos del de C. El p99 más alto es todavía peor: describe solo a C, como si todos los usuarios vivieran lo que vive C. Un percentil es una posición en una lista ordenada; ninguna cuenta con los p99 de los hosts da la posición en la lista combinada. Cuando el host lento lleva una parte suficientemente grande del tráfico (aquí, cerca del 5%), el mismo promedio queda demasiado bajo (lección 44, Percentiles).",
    ),
    watch: { share: "1", slow: "slow", buckets: "fine" },
  },
  {
    id: "even",
    title: t("Three healthy hosts, even traffic", "Tres hosts sanos, tráfico repartido por igual"),
    change: t("Host C healthy like A and B · each host serves 1 request in 3 · the dashboard averages the three p99s",
      "El host C, sano como A y B · cada host atiende 1 de cada 3 solicitudes · el tablero promedia los tres p99"),
    question: t("Now how does the average of the p99s compare with the exact p99?", "Ahora, ¿cómo se compara el promedio de los p99 con el p99 exacto?"),
    options: [
      t("Within a few milliseconds of it", "A unos pocos milisegundos"),
      t("Still about twice too high", "Todavía cerca del doble"),
      t("Too low: averaging smooths the tail away", "Demasiado bajo: promediar suaviza la cola"),
    ],
    answer: 0,
    why: t(
      "When every host gets the same mix of requests and runs the same code on the same hardware, each host's p99 is an estimate of the same number, and so is their average. That's why averaging p99s survives code review and a staging test: it works as long as nothing is wrong. It breaks as soon as one host differs, a slow disk, a noisy neighbour, a bad deploy, which is exactly when someone is looking at the dashboard.",
      "Cuando cada host recibe la misma mezcla de solicitudes y corre el mismo código en el mismo hardware, el p99 de cada host estima el mismo número, y su promedio también. Por eso promediar p99 pasa una revisión de código y una prueba en staging: funciona mientras nada esté mal. Se rompe apenas un host se comporta distinto, un disco lento, un vecino ruidoso, un despliegue malo, que es justo cuando alguien está mirando el tablero.",
    ),
    watch: { share: "33", slow: "healthy", buckets: "fine" },
  },
  {
    id: "merge",
    title: t("Add the buckets, then read the p99", "Sumar los buckets y después leer el p99"),
    change: t("The fleet from the first experiment (C 8× slower, 1 request in 100) · the hosts' bucket counts are added up and the p99 is read off the sum, as Prometheus's histogram_quantile() does",
      "La flota del primer experimento (C 8× más lento, 1 de cada 100 solicitudes) · los conteos de los buckets de los hosts se suman y el p99 se lee de la suma, como hace histogram_quantile() de Prometheus"),
    question: t("How close does the p99 read off the merged buckets come to the exact one?", "¿Qué tan cerca del exacto queda el p99 leído de los buckets combinados?"),
    options: [
      t("Exact: the buckets count every request", "Exacto: los buckets cuentan cada solicitud"),
      t("Close: the error stays inside one bucket", "Cerca: el error queda dentro de un bucket"),
      t("No closer than the average of the p99s", "No más cerca que el promedio de los p99"),
    ],
    answer: 1,
    why: t(
      "Counts add. The merged tubes hold exactly how many of the fleet's requests fell in each range, whichever host served them, so the bucket that holds the 99th percentile is the right one. Inside that bucket the counts can't say where each request fell, so histogram_quantile() interpolates, as if the bucket's requests were spread evenly between its edges. The answer can be off by at most the bucket's width, which is why buckets should be narrow where your p99 usually lives. The same sum works across time: add an hour of counts, then read the hour's p99.",
      "Los conteos se suman. Los tubos combinados tienen exactamente cuántas solicitudes de la flota cayeron en cada rango, sin importar qué host las atendió, así que el bucket que contiene el percentil 99 es el correcto. Dentro de ese bucket los conteos no dicen dónde cayó cada solicitud, así que histogram_quantile() interpola, como si las solicitudes del bucket estuvieran repartidas por igual entre sus bordes. La respuesta puede errar como mucho en el ancho del bucket; por eso los buckets deberían ser angostos donde suele estar tu p99. La misma suma funciona en el tiempo: suma una hora de conteos y después lee el p99 de la hora.",
    ),
    watch: { share: "1", slow: "slow", buckets: "fine" },
  },
  {
    id: "slo",
    title: t("Is 99% under 300 ms?", "¿El 99% está bajo 300 ms?"),
    change: t("The same fleet · the objective: 99% of requests under 300 ms · fine buckets with an edge at 300 ms vs coarse buckets at 100, 500 and 2,500 ms, read by interpolating inside the bucket that holds 300 ms",
      "La misma flota · el objetivo: el 99% de las solicitudes bajo 300 ms · buckets finos con un borde en 300 ms vs buckets gruesos en 100, 500 y 2,500 ms, leídos interpolando dentro del bucket que contiene 300 ms"),
    question: t("With the coarse buckets, what does the dashboard say about the objective?", "Con los buckets gruesos, ¿qué dice el tablero sobre el objetivo?"),
    options: [
      t("The same as the fine buckets: counts are exact", "Lo mismo que los finos: los conteos son exactos"),
      t("Under 99%: an objective you meet looks missed", "Menos del 99%: un objetivo cumplido parece incumplido"),
      t("Over 99.9%: the slow requests drop out", "Más del 99.9%: las solicitudes lentas se pierden"),
    ],
    answer: 1,
    why: t(
      "The coarse buckets know how many requests took between 100 and 500 ms, not where in that range they fell. Interpolating treats them as spread evenly, so it counts half of them as slower than 300 ms, when in fact most sit just above 100 ms. Reading one bucket edge instead is wrong either way: the 100 ms edge calls every request between 100 and 300 ms bad, the 500 ms edge calls every request up to 500 ms good. With an edge exactly at the threshold, the share under it is a plain count and exact. Prometheus's own docs use a 300 ms target to make this point; the Go client's default buckets (5 ms to 10 s) have no edge there.",
      "Los buckets gruesos saben cuántas solicitudes tardaron entre 100 y 500 ms, no en qué parte de ese rango cayeron. Interpolar las trata como repartidas por igual, así que cuenta la mitad como más lentas que 300 ms, cuando en realidad casi todas quedan apenas por encima de 100 ms. Leer un solo borde tampoco sirve: el borde de 100 ms llama malas a todas las solicitudes entre 100 y 300 ms, y el de 500 ms llama buenas a todas hasta 500 ms. Con un borde justo en el umbral, la proporción por debajo es un conteo simple y exacto. La propia documentación de Prometheus usa un objetivo de 300 ms para explicarlo; los buckets por defecto del cliente de Go (de 5 ms a 10 s) no tienen un borde ahí.",
    ),
    watch: { share: "1", slow: "slow", buckets: "coarse" },
  },
  {
    id: "top",
    title: t("Buckets that stop at 250 ms", "Buckets que terminan en 250 ms"),
    change: t("C 8× slower, now serving 1 request in 20 · bucket edges at 25, 50, 100, 150 and 250 ms, then +Inf, vs the fine buckets",
      "C, 8× más lento, ahora atiende 1 de cada 20 solicitudes · bordes de bucket en 25, 50, 100, 150 y 250 ms, y luego +Inf, vs los buckets finos"),
    question: t("What p99 does histogram_quantile() read off the buckets that stop at 250 ms?", "¿Qué p99 lee histogram_quantile() de los buckets que terminan en 250 ms?"),
    options: [
      t("Near the exact p99, estimated inside +Inf", "Cerca del p99 exacto, estimado dentro de +Inf"),
      t("250 ms, the top edge, whatever the real p99", "250 ms, el último borde, sea cual sea el p99 real"),
      t("Nothing: the query returns NaN", "Nada: la consulta devuelve NaN"),
    ],
    answer: 1,
    why: t(
      "More than 1% of requests landed in the +Inf bucket, so the 99th percentile is somewhere above 250 ms, and the buckets can't say where: +Inf has no upper edge to interpolate toward. Prometheus returns the highest finite edge instead, so the graph flattens at exactly 250 ms however bad the tail gets. (Prometheus returns NaN when the top bucket isn't +Inf, or when there were no requests at all.) A percentile line sitting exactly on a bucket edge is the tell. Put the top edge above any latency you need to tell apart, such as your timeout, and keep an eye on the +Inf count.",
      "Más del 1% de las solicitudes cayó en el bucket +Inf, así que el percentil 99 está en algún punto por encima de 250 ms, y los buckets no pueden decir dónde: +Inf no tiene un borde superior hacia el cual interpolar. Prometheus devuelve el borde finito más alto, así que la gráfica se aplana justo en 250 ms por mala que se ponga la cola. (Prometheus devuelve NaN cuando el último bucket no es +Inf, o cuando no hubo ninguna solicitud.) La señal es una línea de percentil pegada justo a un borde de bucket. Pon el último borde por encima de cualquier latencia que necesites distinguir, como tu tiempo límite (timeout), y vigila el conteo de +Inf.",
    ),
    watch: { share: "5", slow: "slow", buckets: "short" },
  },
];

const QUESTIONS = [
  [t("Why isn't the average of the hosts' p99s the fleet's p99, and in which direction can it be wrong?", "¿Por qué el promedio de los p99 de los hosts no es el p99 de la flota, y hacia qué lado puede equivocarse?"),
    t("A p99 is a rank in one sorted list; averaging ranks from different lists ignores how many requests each list holds and where they sit in the combined order. A slow host with little traffic makes the average too high; a slow host with a big enough share of the traffic (here about 5%) makes it too low, because the fleet's p99 then falls inside its slow requests. It matches only when every host has the same distribution, which is when you don't need it.",
      "Un p99 es una posición en una lista ordenada; promediar posiciones de listas distintas ignora cuántas solicitudes tiene cada lista y dónde quedan en el orden combinado. Un host lento con poco tráfico deja el promedio demasiado alto; un host lento con una parte suficientemente grande del tráfico (aquí, cerca del 5%) lo deja demasiado bajo, porque el p99 de la flota cae dentro de sus solicitudes lentas. Solo coincide cuando todos los hosts tienen la misma distribución, que es cuando no lo necesitas.")],
  [t("Is the largest of the hosts' p99s a safe stand-in for the fleet's p99?", "¿El p99 más alto entre los hosts sirve como reemplazo seguro del p99 de la flota?"),
    t("Safe in one direction only. At most 1% of each host's requests are slower than its own p99, so at most 1% of all requests are slower than the largest one: it never reports less than the fleet's p99. But it can report far more, because it describes the worst host, however few users it serves. It's the right number for finding the bad host, and the wrong one for an objective about users.",
      "Seguro solo hacia un lado. Como mucho el 1% de las solicitudes de cada host es más lento que su propio p99, así que como mucho el 1% de todas es más lento que el mayor: nunca reporta menos que el p99 de la flota. Pero puede reportar mucho más, porque describe al peor host, por pocos usuarios que atienda. Es el número correcto para encontrar el host malo y el incorrecto para un objetivo sobre usuarios.")],
  [t("What does a histogram keep that a summary doesn't, and how do you get a fleet p99 from it in PromQL?", "¿Qué guarda un histograma que un summary no, y cómo obtienes el p99 de la flota con PromQL?"),
    t("A summary computes quantiles on each client and exports them; quantiles from different clients can't be combined (Prometheus's docs call averaging them statistically nonsensical). A histogram exports a counter per bucket, and counters add across hosts and time. Sum the per-bucket rates, keeping the le label, then read the quantile: histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m]))). The answer is exact to within the width of the bucket it lands in.",
      "Un summary calcula los cuantiles en cada cliente y los exporta; los cuantiles de clientes distintos no se pueden combinar (la documentación de Prometheus dice que promediarlos no tiene sentido estadístico). Un histograma exporta un contador por bucket, y los contadores se suman entre hosts y en el tiempo. Suma las tasas por bucket conservando la etiqueta le y después lee el cuantil: histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m]))). El resultado es exacto dentro del ancho del bucket donde cae.")],
  [t("How would you choose a histogram's bucket edges for an API with a 300 ms objective?", "¿Cómo elegirías los bordes de los buckets de un histograma para una API con un objetivo de 300 ms?"),
    t("Put an edge exactly at 300 ms, so the share of good requests is a count, not a guess. Make the buckets narrow around where the p50 to p99 usually sit, so interpolation errs by little, and put the top edge above the timeout, so a bad tail doesn't vanish into +Inf. Don't add edges freely: each bucket is another time series for every label combination (lesson 30, Cardinality). Exponential layouts, such as Prometheus native histograms and OpenTelemetry's exponential histograms, place the buckets for you, with an error that is a small share of the value.",
      "Pon un borde justo en 300 ms, para que la proporción de solicitudes buenas sea un conteo y no una estimación. Haz los buckets angostos donde suelen estar el p50 y el p99, para que la interpolación se equivoque poco, y pon el último borde por encima del tiempo límite, para que una cola mala no desaparezca en +Inf. No agregues bordes sin cuidado: cada bucket es otra serie de tiempo por cada combinación de etiquetas (lección 30, Cardinalidad). Los esquemas exponenciales, como los histogramas nativos de Prometheus y los histogramas exponenciales de OpenTelemetry, ubican los buckets por ti, con un error que es una pequeña parte del valor.")],
  [t("During an incident your p99 graph sits flat at exactly 250 ms. What's going on?", "Durante un incidente, tu gráfica de p99 queda plana justo en 250 ms. ¿Qué está pasando?"),
    t("The 99th percentile has moved into the +Inf bucket: more than 1% of requests are slower than the highest finite edge, 250 ms, and histogram_quantile() returns that edge because +Inf has no upper bound to interpolate toward. The real p99 could be 400 ms or 4 s. Look at the +Inf bucket's rate (or the share under 250 ms) to see how bad it is, and add higher edges.",
      "El percentil 99 pasó al bucket +Inf: más del 1% de las solicitudes es más lento que el borde finito más alto, 250 ms, y histogram_quantile() devuelve ese borde porque +Inf no tiene un límite superior hacia el cual interpolar. El p99 real podría ser 400 ms o 4 s. Mira la tasa del bucket +Inf (o la proporción bajo 250 ms) para ver qué tan grave es, y agrega bordes más altos.")],
  [t("You need the p99 for a whole day from per-minute data, and the share of good requests over 28 days. How do you compute each?", "Necesitas el p99 de un día entero a partir de datos por minuto, y la proporción de solicitudes buenas en 28 días. ¿Cómo calculas cada uno?"),
    t("Never average the minutes' p99s: a quiet minute at 3 a.m. would weigh as much as the busiest one. Add the bucket counts over the day (increase over 1d, summed by le) and read the p99 from the total. For the objective, count good requests (the bucket at the threshold) and all requests over the 28 days and divide; that ratio is the SLI that error budgets and burn-rate alerts are built on (lesson 72, Burn-Rate Alerts).",
      "Nunca promedies los p99 de cada minuto: un minuto tranquilo a las 3 de la mañana pesaría lo mismo que el más ocupado. Suma los conteos de los buckets durante el día (increase sobre 1d, sumado por le) y lee el p99 del total. Para el objetivo, cuenta las solicitudes buenas (el bucket del umbral) y todas las solicitudes de los 28 días, y divide; esa proporción es el SLI sobre el que se construyen los presupuestos de errores y las alertas por tasa de consumo (lección 72, Alertas por tasa de consumo).")],
];

export default defineLesson({
  title: t("Merging Percentiles Workbench", "Banco de trabajo: combinar percentiles"),
  eyebrow: t("Systems lesson 74 · Merging percentiles", "Lección de sistemas 74 · Combinar percentiles"),
  lede: t("A percentile is a rank in one sorted list of requests, so three hosts' p99s don't average into the p99 of all their requests; the counts in their histogram buckets do add up. This lesson runs a sorting room for request times: watch three hosts fill their bucket tubes, predict what each dashboard number says, then explain it back.",
    "Un percentil es una posición en una lista ordenada de solicitudes, así que los p99 de tres hosts no se promedian en el p99 de todas sus solicitudes; los conteos de los buckets de sus histogramas sí se suman. Esta lección usa una sala de clasificación de tiempos de respuesta: mira cómo tres hosts llenan sus tubos de buckets, predice qué dice cada número del tablero y después explícalo."),
  machine: {
    intro: t("Requests finish on three hosts behind a load balancer. Each request drops into its host's glass tube for its time (a histogram bucket); the lit tube holds the host's p99, which the counter on its front shows. Every scrape, a slip carries each host's counts to the merged rack, and the desk shows what a dashboard could report: the average and the largest of the hosts' p99s, the p99 read off the merged tubes, the exact p99 (only this model knows it, because it keeps every request) and the share under 300 ms. Change C's traffic and speed, and the buckets.",
      "Las solicitudes terminan en tres hosts detrás de un balanceador de carga. Cada solicitud cae en el tubo de vidrio de su host que corresponde a su tiempo (un bucket del histograma); el tubo iluminado contiene el p99 del host, que muestra el contador de su frente. En cada recolección (scrape), una ficha lleva los conteos de cada host al estante combinado, y el escritorio muestra lo que podría reportar un tablero: el promedio y el máximo de los p99 de los hosts, el p99 leído de los tubos combinados, el p99 exacto (solo este modelo lo conoce, porque guarda cada solicitud) y la proporción bajo 300 ms. Cambia el tráfico y la velocidad de C, y los buckets."),
    plate: {
      title: t("Sorting room", "Sala de clasificación"),
      keys: [
        { mark: "lit", label: t("The tube holding each rack's p99; a scrape slip; the 300 ms edge", "El tubo que contiene el p99 de cada estante; una ficha de recolección; el borde de 300 ms") },
        { mark: "raised", label: t("Glass tubes, one per bucket, the same buckets on every rack", "Tubos de vidrio, uno por bucket, los mismos buckets en cada estante") },
        { mark: "flat", label: t("The desk: five numbers a dashboard could show", "El escritorio: cinco números que podría mostrar un tablero") },
      ],
      caption: t(
        "Latencies are illustrative and round: a healthy host's requests take about " + MEDIAN + " ms (its p99 is near 145 ms); a slow host's take " + SLOW_X + " times as long. " + RATE + " requests a second reach the fleet, and every host keeps the last minute. One request in " + CHIP_EVERY + " drops into its tube as a chip. Tube heights are on a log scale shared by every rack, so a quiet host has short tubes and a 1% tail still shows. Each tube's upper edge is printed under the merged rack; a request goes into the first tube whose edge it doesn't exceed. The merged rack and the desk change when the slips land, every " + SCRAPE + " s here (real scrapes run every 15 to 60 s).",
        "Las latencias son ilustrativas y redondas: las solicitudes de un host sano tardan unos " + MEDIAN + " ms (su p99 ronda los 145 ms); las de un host lento tardan " + SLOW_X + " veces más. A la flota llegan " + RATE + " solicitudes por segundo, y cada host guarda el último minuto. Una de cada " + CHIP_EVERY + " solicitudes cae en su tubo como un disco. La altura de los tubos está en escala logarítmica, la misma para todos los estantes, así que un host con poco tráfico tiene tubos bajos y una cola del 1% igual se ve. El borde superior de cada tubo está impreso bajo el estante combinado; una solicitud va al primer tubo cuyo borde no supera. El estante combinado y el escritorio cambian cuando llegan las fichas, cada " + SCRAPE + " s aquí (en la realidad se recolecta cada 15 a 60 s).",
      ),
      stage: { "data-sorting-room": "" },
      label: t("Simulation of three hosts' latency histograms and how they merge. Space pauses or resumes.", "Simulación de los histogramas de latencia de tres hosts y de cómo se combinan. Espacio pausa o reanuda."),
    },
    svg: buildFigure(FIRST),
    stats: [
      ["avg", t("Average of p99s", "Promedio de p99"), "–"],
      ["max", t("Largest p99", "p99 más alto"), "–"],
      ["est", t("p99 from merged buckets", "p99 de buckets combinados"), "–"],
      ["exact", t("Exact p99", "p99 exacto"), "–"],
      ["under", t("Under 300 ms, buckets", "Bajo 300 ms, buckets"), "–"],
      ["underx", t("Under 300 ms, exact", "Bajo 300 ms, exacto"), "–"],
    ],
    controls: [
      { seg: "share", label: t("C's traffic", "Tráfico de C"), options: [["33", t("1 in 3", "1 de cada 3")], ["5", t("1 in 20", "1 de cada 20")], ["1", t("1 in 100", "1 de cada 100")]], value: "1" },
      { seg: "slow", label: t("Host C", "Host C"), options: [["slow", t(SLOW_X + "× slower", SLOW_X + "× más lento")], ["healthy", t("Healthy", "Sano")]], value: "slow" },
      { seg: "buckets", label: t("Buckets", "Buckets"), options: [["fine", t("Fine, edge at 300 ms", "Finos, borde en 300 ms")], ["coarse", t("Coarse: 100, 500, 2,500", "Gruesos: 100, 500, 2,500")], ["short", t("Ending at 250 ms", "Hasta 250 ms")]], value: "fine" },
      { speed: true },
      { actions: [["spike", t("Slow C for 10 s", "Volver lento a C 10 s"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Slow C for 10 s works on a healthy C: watch the average jump while the merged and exact p99s barely move when C is quiet. Changing a setting starts the run again.",
      "Volver lento a C 10 s funciona con C sano: mira cómo salta el promedio mientras el p99 combinado y el exacto casi no se mueven cuando C tiene poco tráfico. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs of one minute each (about " + RATE * WINDOW / 1000 + ",000 requests).",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija de un minuto cada una (unas " + RATE * WINDOW / 1000 + ",000 solicitudes)."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: log-normal request times, a one-minute window per host, and the bucket arithmetic of Prometheus's histogram_quantile() and histogram_fraction() on classic histograms.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección: tiempos de respuesta log-normales, una ventana de un minuto por host y la aritmética de buckets de histogram_quantile() y histogram_fraction() de Prometheus sobre histogramas clásicos.`),
  css: LIT_FILL_CSS + `
.iso-stage [data-layer] text{pointer-events:none}
`,
  data: { P, G: GEOMETRY, CHIP: chipSvg(), SLIP: slipSvg(), SCRAPE, CHIP_EVERY },
});
