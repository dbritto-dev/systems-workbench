// @ts-nocheck: content ported as-is
// Systems lesson 44 · Percentiles and tail latency: a timing hall for request latency.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, chipSvg, heightOf, P, GEOMETRY, POINTERS } from "./figure";
import { rng, userRequest, summary, binOf, binPos, tailRun, fanoutRun, mergeRun, omissionRun, gcRun, hedgeAtP95, fmt } from "./sim";

// ---------- results (computed once here from the same model the page runs) ----------
const R = { tail: tailRun(), fanout: fanoutRun(), merge: mergeRun(), omission: omissionRun(), gc: gcRun() };
const HEDGE_AT = hedgeAtP95();

// ---------- the first frame: fan-out to 10, one call in 100 stalls, a request waiting on tower 7 ----------
const FIRST = (() => {
  const r = rng(3), ms = [];
  for (let i = 0; i < 3000; i++) ms.push(userRequest(r, { fanout: 10, share: 0.01, t: i / 100 }).ms);
  const counts = Array(10).fill(0);
  ms.forEach((v) => counts[binOf(v)]++);
  const s = summary(ms);
  return {
    heights: counts.map((c) => heightOf(c, ms.length)),
    pos: { mean: binPos(s.mean), p50: binPos(s.p50), p95: binPos(s.p95), p99: binPos(s.p99) },
    counts: { mean: Math.round(s.mean), p50: Math.round(s.p50), p99: Math.round(s.p99), slow: Math.round(100 * s.slow) },
    lit: [6], out: 1, token: true, fanout: 10, s,
  };
})();

// ---------- what each card shows after a run ----------
const pc = (x) => (100 * x).toFixed(1) + "%";
const RUNS = {
  tail: () => {
    const { none, tail } = R.tail, top = tail.p99;
    return { verdict: t("No stalls: mean " + fmt(none.mean) + ", p50 " + fmt(none.p50) + ", p99 " + fmt(none.p99) + ". One call in 50 stalled: mean " + fmt(tail.mean) + " (" + (tail.mean / none.mean).toFixed(1) + "×), p50 " + fmt(tail.p50) + ", p99 " + fmt(tail.p99) + " (" + Math.round(tail.p99 / none.p99) + "×).",
        "Sin trabas: media " + fmt(none.mean) + ", p50 " + fmt(none.p50) + ", p99 " + fmt(none.p99) + ". Una llamada de cada 50 trabada: media " + fmt(tail.mean) + " (" + (tail.mean / none.mean).toFixed(1) + "×), p50 " + fmt(tail.p50) + ", p99 " + fmt(tail.p99) + " (" + Math.round(tail.p99 / none.p99) + "×)."),
      bars: [[t("p50, with stalls", "p50, con trabas"), tail.p50 / top, fmt(tail.p50)], [t("Mean, with stalls", "Media, con trabas"), tail.mean / top, fmt(tail.mean)], [t("p99, no stalls", "p99, sin trabas"), none.p99 / top, fmt(none.p99)], [t("p99, with stalls", "p99, con trabas"), 1, fmt(tail.p99), true]] };
  },
  fanout: () => {
    const { one, ten, hundred, formula } = R.fanout;
    return { verdict: t("Requests that hit at least one stall: " + pc(one.anyStall) + " at 1, " + pc(ten.anyStall) + " at 10, " + pc(hundred.anyStall) + " at 100 (1 − 0.99^N predicts " + formula.map(pc).join(", ") + "). The user's p50: " + fmt(one.p50) + ", " + fmt(ten.p50) + ", " + fmt(hundred.p50) + ".",
        "Solicitudes que tocaron al menos una traba: " + pc(one.anyStall) + " con 1, " + pc(ten.anyStall) + " con 10, " + pc(hundred.anyStall) + " con 100 (1 − 0.99^N predice " + formula.map(pc).join(", ") + "). El p50 del usuario: " + fmt(one.p50) + ", " + fmt(ten.p50) + ", " + fmt(hundred.p50) + "."),
      bars: [[t("Hit a stall, fan-out 1", "Tocaron una traba, fan-out 1"), one.anyStall, pc(one.anyStall)], [t("Hit a stall, fan-out 10", "Tocaron una traba, fan-out 10"), ten.anyStall, pc(ten.anyStall)], [t("Hit a stall, fan-out 100", "Tocaron una traba, fan-out 100"), hundred.anyStall, pc(hundred.anyStall), true], [t("User p50, fan-out 100", "p50 del usuario, fan-out 100"), hundred.p50 / 1200, fmt(hundred.p50), true]] };
  },
  merge: () => {
    const m = R.merge, top = m.maxP99;
    return { verdict: t("Healthy hosts' p99: about " + fmt(m.goodP99) + "; the bad host's: " + fmt(m.maxP99) + ". Average of the ten p99s: " + fmt(m.avgP99) + ". The p99 of all 50,000 calls merged: " + fmt(m.fleetP99) + ".",
        "p99 de los hosts sanos: cerca de " + fmt(m.goodP99) + "; el del host malo: " + fmt(m.maxP99) + ". Promedio de los diez p99: " + fmt(m.avgP99) + ". El p99 de las 50,000 llamadas combinadas: " + fmt(m.fleetP99) + "."),
      bars: [[t("Average of ten p99s", "Promedio de diez p99"), m.avgP99 / top, fmt(m.avgP99)], [t("Real p99, merged", "p99 real, combinado"), m.fleetP99 / top, fmt(m.fleetP99), true], [t("Worst host's p99", "p99 del peor host"), 1, fmt(m.maxP99)]] };
  },
  omission: () => {
    const { open, closed } = R.omission, top = open.p99, n = (x) => Math.round(x).toLocaleString("en");
    return { verdict: t("Waits for each reply: " + n(closed.n) + " requests, p99 " + fmt(closed.p99) + ", p99.9 " + fmt(closed.p999) + "; " + n(closed.hit) + " request met the pause. Fixed rate: " + n(open.n) + " requests, p99 " + fmt(open.p99) + ", p99.9 " + fmt(open.p999) + "; " + pc(open.slow) + " took over 100 ms.",
        "Espera cada respuesta: " + n(closed.n) + " solicitudes, p99 " + fmt(closed.p99) + ", p99.9 " + fmt(closed.p999) + "; " + n(closed.hit) + " solicitud se topó con la pausa. Tasa fija: " + n(open.n) + " solicitudes, p99 " + fmt(open.p99) + ", p99.9 " + fmt(open.p999) + "; el " + pc(open.slow) + " tardó más de 100 ms."),
      bars: [[t("p99, waits for each reply", "p99, espera cada respuesta"), closed.p99 / top, fmt(closed.p99), true], [t("p99, fixed rate", "p99, tasa fija"), 1, fmt(open.p99)], [t("Over 100 ms, waits for each reply", "Más de 100 ms, espera cada respuesta"), closed.hit / 100, n(closed.hit), true], [t("Over 100 ms, fixed rate", "Más de 100 ms, tasa fija"), (open.slow * open.n) / 100, n(open.slow * open.n)]] };
  },
  gc: () => {
    const { calm, pause } = R.gc, top = pause.max;
    return { verdict: t("Calm minute: mean " + fmt(calm.mean) + ", p99 " + fmt(calm.p99) + ". With the pause: mean " + fmt(pause.mean) + ", p50 " + fmt(pause.p50) + ", but p99 " + fmt(pause.p99) + " and the slowest " + fmt(pause.max) + "; " + pc(pause.slow) + " of requests took over 100 ms.",
        "Minuto tranquilo: media " + fmt(calm.mean) + ", p99 " + fmt(calm.p99) + ". Con la pausa: media " + fmt(pause.mean) + ", p50 " + fmt(pause.p50) + ", pero p99 " + fmt(pause.p99) + " y la más lenta " + fmt(pause.max) + "; el " + pc(pause.slow) + " de las solicitudes tardó más de 100 ms."),
      bars: [[t("Mean, with the pause", "Media, con la pausa"), pause.mean / top, fmt(pause.mean)], [t("p99, with the pause", "p99, con la pausa"), pause.p99 / top, fmt(pause.p99), true], [t("Slowest request", "Solicitud más lenta"), 1, fmt(pause.max), true]] };
  },
};

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "tail",
    title: t("One call in 50 stalls", "Una llamada de cada 50 se traba"),
    change: t("One backend, no fan-out · no stalls vs 1 call in 50 taking 0.4 to 1.2 s instead of about 10 ms · 20,000 requests", "Un backend, sin fan-out · sin trabas vs 1 llamada de cada 50 que tarda de 0.4 a 1.2 s en lugar de unos 10 ms · 20,000 solicitudes"),
    question: t("With 1 call in 50 stalled, what happens to the mean, the p50 and the p99?", "Con 1 llamada de cada 50 trabada, ¿qué pasa con la media, el p50 y el p99?"),
    options: [
      t("All three rise by about 2%, since only 2% of calls changed", "Los tres suben cerca de un 2%, porque solo cambió el 2% de las llamadas"),
      t("p50 holds; the mean rises a few times, the p99 dozens", "El p50 se queda; la media sube unas veces, el p99 decenas"),
      t("The p99 stays put: 98% of calls are still fast", "El p99 se queda igual: el 98% sigue siendo rápido"),
    ],
    answer: 1,
    why: t(
      "The p50 is the middle request, and the middle is fast either way. The mean adds every stall into one number, so it moves, but it can't say whether everyone got a little slower or a few got much slower. The p99 is the request 99 in 100 are faster than; with 2 in 100 stalled, it lands inside the stalls. Most users see 10 ms; one in fifty waits most of a second. Only the high percentiles show that.",
      "El p50 es la solicitud del medio, y el medio es rápido en ambos casos. La media suma cada traba en un solo número, así que se mueve, pero no puede decir si todos se volvieron un poco más lentos o unos pocos mucho más lentos. El p99 es la solicitud que 99 de cada 100 superan en rapidez; con 2 de cada 100 trabadas, cae dentro de las trabas. La mayoría ve 10 ms; uno de cada cincuenta espera casi un segundo. Solo los percentiles altos lo muestran.",
    ),
    watch: { fanout: 1, share: 0.02, hedge: "off" },
  },
  {
    id: "fanout",
    title: t("Fan out to 100 backends", "Repartir entre 100 backends"),
    change: t("Every backend stalls 1 call in 100, so its own p99 is a stall · a user request calls 1, 10 or 100 backends in parallel and waits for all of them", "Cada backend traba 1 llamada de cada 100, así que su propio p99 es una traba · una solicitud de usuario llama a 1, 10 o 100 backends en paralelo y espera a todos"),
    question: t("At a fan-out of 100, what does the typical (p50) user request see?", "Con un fan-out de 100, ¿qué ve la solicitud típica (p50) de un usuario?"),
    options: [
      t("About 10 ms: stalls are still rare", "Unos 10 ms: las trabas siguen siendo raras"),
      t("Around 20 ms: the slowest of 100 fast calls", "Unos 20 ms: la más lenta de 100 llamadas rápidas"),
      t("Over half a second: it waits on a stall", "Más de medio segundo: espera una traba"),
    ],
    answer: 2,
    why: t(
      "A request that waits for all its calls is as slow as the slowest one. The chance that none of 100 calls stalls is 0.99^100 ≈ 37%, so about 63% of user requests wait on a stall: one backend's p99 has become the user's median. This is the example in Dean and Barroso's \"The Tail at Scale\". At scale you can't hide a rare slow call; you have to make the tail itself short, or stop waiting for it (hedged requests, lesson 48).",
      "Una solicitud que espera todas sus llamadas es tan lenta como la más lenta. La probabilidad de que ninguna de 100 llamadas se trabe es 0.99^100 ≈ 37%, así que cerca del 63% de las solicitudes de usuario esperan una traba: el p99 de un backend se volvió la mediana del usuario. Es el ejemplo de \"The Tail at Scale\", de Dean y Barroso. A gran escala no puedes esconder una llamada lenta rara; tienes que acortar la cola misma o dejar de esperarla (solicitudes con respaldo, lección 48).",
    ),
    watch: { fanout: 100, share: 0.01, hedge: "off" },
  },
  {
    id: "merge",
    title: t("Average the hosts' p99s", "Promediar el p99 de cada host"),
    change: t("10 hosts, 5,000 calls each · 9 healthy hosts stall 1 call in 500 · one bad host stalls 3 in 20 · the dashboard averages the ten p99s", "10 hosts, 5,000 llamadas cada uno · 9 hosts sanos traban 1 llamada de cada 500 · un host malo traba 3 de cada 20 · el tablero promedia los diez p99"),
    question: t("How does the average of the ten p99s compare with the p99 of all 50,000 calls?", "¿Cómo se compara el promedio de los diez p99 con el p99 de las 50,000 llamadas?"),
    options: [
      t("About the same: it is the fleet's p99", "Más o menos igual: es el p99 de la flota"),
      t("Far too low: the fleet's p99 is a stall", "Demasiado bajo: el p99 de la flota es una traba"),
      t("Too high: the bad host drags the average up", "Demasiado alto: el host malo sube el promedio"),
    ],
    answer: 1,
    why: t(
      "A percentile is a position in a sorted list, not a quantity you can add. Nine healthy p99s near 20 ms pull the average down, but the bad host's stalls are 1.5% of all calls, more than 1%, so the fleet's real p99 is a stall. Here the average is too low; with a smaller bad host, whose stalls were under 1% of all calls, it would be too high. The average of p99s isn't any percentile of anything. The fix is to keep histograms (fixed buckets, HdrHistogram, t-digest), add the bucket counts across hosts or minutes, and read the percentile from the merged counts. The same goes for averaging minutes into an hour.",
      "Un percentil es una posición en una lista ordenada, no una cantidad que se pueda sumar. Nueve p99 sanos cerca de 20 ms bajan el promedio, pero las trabas del host malo son el 1.5% de todas las llamadas, más del 1%, así que el p99 real de la flota es una traba. Aquí el promedio queda demasiado bajo; con un host malo más chico, cuyas trabas fueran menos del 1% de todas las llamadas, quedaría demasiado alto. El promedio de los p99 no es ningún percentil de nada. La solución es guardar histogramas (buckets fijos, HdrHistogram, t-digest), sumar los conteos de cada bucket entre hosts o minutos y leer el percentil de los conteos combinados. Lo mismo vale para promediar minutos en una hora.",
    ),
    watch: { fanout: 1, share: 0.02, hedge: "off" },
  },
  {
    id: "omission",
    title: t("A load test that waits for each reply", "Una prueba de carga que espera cada respuesta"),
    change: t("One server, about 10 ms a request, for a minute · at 30 s it stops for a 1-second pause · a tester that sends the next request when the last one returns vs one that sends a request every 10 ms whatever happens, timing each from when it was due",
      "Un servidor, unos 10 ms por solicitud, durante un minuto · a los 30 s se detiene por una pausa de 1 segundo · un generador que envía la siguiente solicitud cuando vuelve la anterior vs uno que envía una cada 10 ms pase lo que pase, y mide cada una desde que debía salir"),
    question: t("What p99 does the tester that waits for each reply report?", "¿Qué p99 reporta el generador que espera cada respuesta?"),
    options: [
      t("The same as the fixed-rate one: the pause is the same", "El mismo que el de tasa fija: la pausa es la misma"),
      t("A healthy one: the pause shows up in one request", "Uno sano: la pausa aparece en una sola solicitud"),
      t("A worse one: its requests pile up behind the pause", "Uno peor: sus solicitudes se acumulan tras la pausa"),
    ],
    answer: 1,
    why: t(
      "While the server is paused, the tester that waits for each reply is waiting too, so it sends nothing: the whole second becomes one slow sample among thousands, and the p99 stays near 20 ms. Real users don't wait for each other; at 100 a second, about 100 of them arrive during that second and each waits out the rest of it. The fixed-rate tester keeps sending, times each request from when it was due, and sees them. That's coordinated omission: the tester coordinates with the system it measures and leaves out the samples that matter. Use an open-loop generator (wrk2, k6 with an arrival-rate executor) or correct for it (HdrHistogram can).",
      "Mientras el servidor está en pausa, el generador que espera cada respuesta también espera, así que no envía nada: el segundo entero se vuelve una sola muestra lenta entre miles, y el p99 queda cerca de 20 ms. Los usuarios reales no se esperan entre sí; a 100 por segundo, unos 100 llegan durante ese segundo y cada uno espera lo que queda de él. El generador de tasa fija sigue enviando, mide cada solicitud desde que debía salir y los ve. Eso es la omisión coordinada (coordinated omission): el generador se coordina con el sistema que mide y deja fuera justo las muestras que importan. Usa un generador de lazo abierto (wrk2, k6 con un executor de tasa de llegada) o corrígelo (HdrHistogram puede).",
    ),
    watch: { fanout: 1, share: 0, hedge: "off", tester: "closed", gc: true },
  },
  {
    id: "gc",
    title: t("A 1-second GC pause", "Una pausa de GC de 1 segundo"),
    change: t("One server, 100 requests a second for a minute, no stalls · at 30 s it stops for a 1-second garbage-collection pause; requests that arrive during it wait it out", "Un servidor, 100 solicitudes por segundo durante un minuto, sin trabas · a los 30 s se detiene por una pausa de recolección de basura (GC) de 1 segundo; las solicitudes que llegan durante la pausa la esperan"),
    question: t("The dashboard shows the minute's mean. What does it say, and what did the slowest 1% see?", "El tablero muestra la media del minuto. ¿Qué dice, y qué vio el 1% más lento?"),
    options: [
      t("The mean looks fine; the slowest 1% waited 0.4 s+", "La media se ve bien; el 1% más lento esperó 0.4 s o más"),
      t("The mean jumps to about half a second", "La media salta a cerca de medio segundo"),
      t("Both look fine: one second in sixty is too little", "Los dos se ven bien: un segundo de sesenta es muy poco"),
    ],
    answer: 0,
    why: t(
      "Only about 100 of 6,000 requests arrived during the pause, under 2%, so the mean rises by a few milliseconds and stays under any sensible alert. Those 100 people waited up to a whole second, and the p99 lands among them. Alert on high percentiles, or on the share of requests over a threshold, never on the mean.",
      "Solo unas 100 de 6,000 solicitudes llegaron durante la pausa, menos del 2%, así que la media sube unos pocos milisegundos y queda por debajo de cualquier alerta razonable. Esas 100 personas esperaron hasta un segundo entero, y el p99 cae entre ellas. Alerta sobre percentiles altos, o sobre la proporción de solicitudes por encima de un umbral, nunca sobre la media.",
    ),
    watch: { fanout: 1, share: 0, hedge: "off", tester: "open", gc: true },
  },
];

const QUESTIONS = [
  [t("What does \"p99 = 250 ms\" mean, and why is it more useful than the mean on a latency dashboard?", "¿Qué significa \"p99 = 250 ms\" y por qué es más útil que la media en un tablero de latencia?"),
    t("99% of requests took 250 ms or less; 1 in 100 took longer. The mean blends fast and slow into one number that can stay flat while a few users wait seconds, and one huge outlier can move it while nobody else noticed. Percentiles describe the distribution: p50 is the typical request, p99 and p99.9 are the bad experiences that users remember.",
      "El 99% de las solicitudes tardó 250 ms o menos; 1 de cada 100 tardó más. La media mezcla rápidas y lentas en un número que puede quedar plano mientras unos pocos usuarios esperan segundos, y un solo valor atípico enorme la puede mover sin que nadie más lo note. Los percentiles describen la distribución: el p50 es la solicitud típica; el p99 y el p99.9 son las malas experiencias que los usuarios recuerdan.")],
  [t("Why does fanning a request out to many backends make tail latency worse, even if each backend is healthy?", "¿Por qué repartir una solicitud entre muchos backends empeora la latencia de cola, aunque cada backend esté sano?"),
    t("The request finishes when its slowest call does, so it is slow if any call is slow. With a 1% chance per call, the chance that all N are fast is 0.99^N: 90% at 10, 37% at 100. Rare slowness on one machine becomes common slowness for the user. A page that makes 50 requests behaves the same way, which is why per-request p99s understate what a user feels.",
      "La solicitud termina cuando termina su llamada más lenta, así que es lenta si cualquier llamada lo es. Con un 1% de probabilidad por llamada, la probabilidad de que las N sean rápidas es 0.99^N: 90% con 10, 37% con 100. La lentitud rara en una máquina se vuelve lentitud común para el usuario. Una página que hace 50 solicitudes se comporta igual, por eso el p99 por solicitud subestima lo que siente un usuario.")],
  [t("Why can't you average p99s across hosts or across minutes? What do you store instead?", "¿Por qué no puedes promediar los p99 entre hosts o entre minutos? ¿Qué guardas en su lugar?"),
    t("A percentile is a rank in one sorted set; two sets' p99s don't combine into the p99 of both. The average of p99s can be too low (a bad host hidden behind good ones) or too high (a bad host whose stalls are under 1% of the fleet's calls), and quiet minutes weigh as much as busy ones. Store histograms (Prometheus buckets, HdrHistogram, t-digest, DDSketch), add the counts, and compute percentiles from the merged histogram.",
      "Un percentil es una posición en un conjunto ordenado; los p99 de dos conjuntos no se combinan en el p99 de ambos. El promedio de los p99 puede quedar demasiado bajo (un host malo escondido detrás de los buenos) o demasiado alto (un host malo cuyas trabas son menos del 1% de las llamadas de la flota), y los minutos tranquilos pesan lo mismo que los ocupados. Guarda histogramas (buckets de Prometheus, HdrHistogram, t-digest, DDSketch), suma los conteos y calcula los percentiles del histograma combinado.")],
  [t("Hedged requests send a second copy of a slow call. When is that safe, and how do you keep it from becoming a load problem?", "Las solicitudes de respaldo (hedged requests) envían una segunda copia de una llamada lenta. ¿Cuándo es seguro y cómo evitas que se vuelva un problema de carga?"),
    t("It's safe for reads and idempotent operations, where doing the work twice is harmless. Wait until the p95 (or a fixed delay) before hedging, so only about 5% of calls get a copy; send the copy to a different host; cancel the loser when the first answer arrives; and stop hedging when the whole service is slow, because then the extra copies only add load. Unlike a retry after a timeout, a hedge doesn't wait for failure. Lesson 48, Hedged requests, measures the trade-offs.",
      "Es seguro para lecturas y operaciones idempotentes, donde hacer el trabajo dos veces no hace daño. Espera hasta el p95 (o un retraso fijo) antes de enviar el respaldo, así solo cerca del 5% de las llamadas reciben copia; envía la copia a otro host; cancela la perdedora cuando llegue la primera respuesta; y deja de enviar respaldos cuando todo el servicio está lento, porque ahí las copias solo agregan carga. A diferencia de un reintento después de un tiempo límite (timeout), el respaldo no espera a que algo falle. La lección 48, Solicitudes con respaldo, mide los costos y beneficios.")],
  [t("Your load test reports a p99 of 15 ms, but production users see 1-second stalls. One likely reason in the test itself?", "Tu prueba de carga reporta un p99 de 15 ms, pero en producción los usuarios ven trabas de 1 segundo. ¿Una razón probable en la propia prueba?"),
    t("Coordinated omission: a tester that sends the next request only after the previous one returns stops sending during a stall, so the stall is counted once instead of for every request that would have arrived during it. Use an open-loop generator at a fixed rate and measure from each request's intended start time (wrk2, k6 with arrival-rate executors, HdrHistogram's correction).",
      "Omisión coordinada (coordinated omission): un generador que envía la siguiente solicitud solo cuando vuelve la anterior deja de enviar durante una traba, así que la traba se cuenta una vez en lugar de una por cada solicitud que habría llegado durante ella. Usa un generador de lazo abierto a tasa fija y mide desde la hora prevista de inicio de cada solicitud (wrk2, k6 con executors de tasa de llegada, la corrección de HdrHistogram).")],
  [t("You are writing an SLO for an API. Which percentile do you pick, and over what window?", "Estás escribiendo un SLO para una API. ¿Qué percentil eliges y sobre qué ventana?"),
    t("Pick the percentile that matches what users feel: p99 or p99.9 for something called many times per page or fanned out behind another service, p95 for a single user-facing call. Phrase it as a share of requests (\"99% of requests under 300 ms over 28 days\") so it can be computed from merged histograms and turned into an error budget. Keep the mean off the alerting path.",
      "Elige el percentil que corresponde a lo que sienten los usuarios: p99 o p99.9 para algo que se llama muchas veces por página o que está detrás de otro servicio con fan-out, p95 para una sola llamada de cara al usuario. Exprésalo como proporción de solicitudes (\"el 99% de las solicitudes en menos de 300 ms durante 28 días\") para poder calcularlo con histogramas combinados y convertirlo en un presupuesto de errores. Deja la media fuera de las alertas.")],
];

export default defineLesson({
  title: t("Tail Latency Workbench", "Banco de trabajo: latencia de cola"),
  eyebrow: t("Systems lesson 44 · Percentiles", "Lección de sistemas 44 · Percentiles"),
  lede: t("Latency isn't one number. Most requests are fast; a few are slow, and those few are what users remember. Percentiles say how slow the slow ones are, and fan-out decides how many users meet them. This lesson runs a timing hall: watch requests land in a histogram, predict what the mean and the p99 will do, then explain it back.",
    "La latencia no es un solo número. La mayoría de las solicitudes son rápidas; unas pocas son lentas, y esas pocas son las que los usuarios recuerdan. Los percentiles dicen qué tan lentas son las lentas, y el fan-out decide cuántos usuarios se las encuentran. Esta lección usa una sala de tiempos para estudiar la latencia de cola (tail latency): mira cómo caen las solicitudes en un histograma, predice qué harán la media y el p99, y después explícalo."),
  machine: {
    intro: t("Each user request calls its backends in parallel and is done when the last one answers. Most calls take about 10 ms; a stalled call takes most of a second. Try the fan-out and the stalled calls, turn on hedging, pause tower 7 for garbage collection, or switch the load tester to wait for each reply, and watch which pointer moves. With a fan-out of 1, every call goes to tower 7.",
      "Cada solicitud de usuario llama a sus backends en paralelo y termina cuando responde el último. La mayoría de las llamadas tardan unos 10 ms; una llamada trabada tarda casi un segundo. Prueba el fan-out y las llamadas trabadas, activa los respaldos, pausa la torre 7 por recolección de basura o cambia el generador de carga para que espere cada respuesta, y mira qué puntero se mueve. Con un fan-out de 1, todas las llamadas van a la torre 7."),
    plate: {
      title: t("Timing hall", "Sala de tiempos"),
      keys: [
        { mark: "lit", label: t("The tail: a tower whose call is still out, the bins over 100 ms, and the p99 pointer", "La cola: una torre cuya llamada sigue pendiente, los cajones de más de 100 ms y el puntero del p99") },
        { mark: "raised", label: t("Chips: finished requests dropping into their bin", "Fichas: solicitudes terminadas que caen en su cajón") },
        { mark: "flat", label: t("The slide rule: the bin edges in ms, on a log scale", "La regla de cálculo: los bordes de los cajones en ms, en escala logarítmica") },
      ],
      caption: t(
        "The front desk on the left sends one user request to its backends, in slow motion, and waits until every tower's lamp is off; a lamp that stays on is a stalled call, and the request can't answer until it's back. Then the request drops as a chip into the bin for its time. The histogram keeps the last 3,000 requests: bins are spaced on a log scale (each holds a range of times, 5 to 10 ms, 10 to 20 ms and so on) and column heights are on a log scale too, so a handful of slow requests still shows. The four pointers on the console track the mean, p50, p95 and p99 of those requests.",
        "El mostrador de la izquierda envía una solicitud de usuario a sus backends, en cámara lenta, y espera hasta que se apague la lámpara de cada torre; una lámpara que queda encendida es una llamada trabada, y la solicitud no puede responder hasta que vuelva. Entonces la solicitud cae como ficha en el cajón de su tiempo. El histograma guarda las últimas 3,000 solicitudes: los cajones están espaciados en escala logarítmica (cada uno tiene un rango de tiempos, de 5 a 10 ms, de 10 a 20 ms y así) y la altura de las columnas también es logarítmica, para que unas pocas solicitudes lentas igual se vean. Los cuatro punteros de la consola siguen la media, el p50, el p95 y el p99 de esas solicitudes.",
      ),
      readout: t("starting", "iniciando"),
      stage: { "data-hall": "" },
      label: t("Tail latency simulation. Space pauses or resumes.", "Simulación de latencia de cola. Espacio pausa o reanuda."),
    },
    svg: buildFigure(FIRST),
    stats: [["mean", t("Mean", "Media"), FIRST.counts.mean + " ms"], ["p50", "p50", FIRST.counts.p50 + " ms"], ["p95", "p95", Math.round(FIRST.s.p95) + " ms"], ["p99", "p99", FIRST.counts.p99 + " ms"], ["slow", t("Over 100 ms", "Más de 100 ms"), (100 * FIRST.s.slow).toFixed(1) + "%"], ["extra", t("Extra calls", "Llamadas extra"), "0%"]],
    controls: [
      { seg: "fanout", label: t("Fan-out", "Fan-out"), options: [[1, "1"], [10, "10"], [100, "100"]], value: 10 },
      { seg: "share", label: t("Stalled calls", "Llamadas trabadas"), options: [[0, t("None", "Ninguna")], [0.01, t("1 in 100", "1 de cada 100")], [0.02, t("1 in 50", "1 de cada 50")]], value: 0.01 },
      { seg: "hedge", label: t("Hedge", "Respaldo"), options: [["off", t("Off", "No")], ["p95", t(`After p95 (${Math.round(HEDGE_AT)} ms)`, `Después del p95 (${Math.round(HEDGE_AT)} ms)`)]], value: "off" },
      { seg: "tester", label: t("Load tester", "Generador de carga"), options: [["open", t("Fixed rate", "Tasa fija")], ["closed", t("Waits for each reply", "Espera cada respuesta")]], value: "open" },
      { speed: true },
      { actions: [["gc", t("GC pause on tower 7 (1 s)", "Pausa de GC en la torre 7 (1 s)")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("A backend call takes about 10 ms. A stalled one takes 0.4 to 1.2 s. The stream runs 100 user requests a second (a tester that waits for each reply sends the next one when the last returns); the request on the rig plays slowed down. Changing a setting starts the histogram again.", "Una llamada a un backend tarda unos 10 ms. Una trabada tarda de 0.4 a 1.2 s. El flujo corre 100 solicitudes de usuario por segundo (un generador que espera cada respuesta envía la siguiente cuando vuelve la anterior); la solicitud del mostrador se muestra en cámara lenta. Cambiar un ajuste reinicia el histograma."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The fan-out and hedging examples follow Jeffrey Dean and Luiz André Barroso, <a href="https://research.google/pubs/the-tail-at-scale/" target="_blank" rel="noopener">"The Tail at Scale"</a>, Communications of the ACM 56(2), 2013.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los ejemplos de fan-out y de respaldos siguen a Jeffrey Dean y Luiz André Barroso, <a href="https://research.google/pubs/the-tail-at-scale/" target="_blank" rel="noopener">"The Tail at Scale"</a>, Communications of the ACM 56(2), 2013.`),
  css: `
.iso-stage [data-chips] *{pointer-events:none}
`,
  data: {
    P,
    G: GEOMETRY,
    CHIP: { on: chipSvg(true), off: chipSvg(false) },
    POINTER_KEYS: POINTERS.map((p) => p.key),
    HEDGE_AT,
  },
});
