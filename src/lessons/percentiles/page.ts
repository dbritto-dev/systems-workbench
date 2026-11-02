// @ts-nocheck: content ported as-is
// Systems lesson 44 · Percentiles and tail latency: a timing hall for request latency.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, chipSvg, heightOf, P, GEOMETRY, POINTERS } from "./figure";
import { rng, userRequest, summary, binOf, binPos, tailRun, fanoutRun, mergeRun, hedgeRun, gcRun, hedgeAtP95 } from "./sim";

// ---------- results (computed once here from the same model the page runs) ----------
const R = { tail: tailRun(), fanout: fanoutRun(), merge: mergeRun(), hedge: hedgeRun(), gc: gcRun() };
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

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "tail",
    title: t("One call in 50 stalls", "Una llamada de cada 50 se traba"),
    change: t("One backend, no fan-out · no stalls vs 1 call in 50 taking 0.4 to 1.2 s instead of about 10 ms · 20,000 requests", "Un backend, sin fan-out · sin trabas vs 1 llamada de cada 50 que tarda de 0.4 a 1.2 s en lugar de unos 10 ms · 20,000 solicitudes"),
    question: t("With 1 call in 50 stalled, what happens to the mean, the p50 and the p99?", "Con 1 llamada de cada 50 trabada, ¿qué pasa con la media, el p50 y el p99?"),
    options: [
      t("All three rise by about 2%, since only 2% of calls changed", "Los tres suben cerca de un 2%, porque solo cambió el 2% de las llamadas"),
      t("The p50 doesn't move, the mean grows a few times over, and the p99 grows dozens of times over", "El p50 no se mueve, la media crece unas pocas veces y el p99 crece decenas de veces"),
      t("The p99 stays put, because 98% of calls are still fast", "El p99 se queda igual, porque el 98% de las llamadas siguen siendo rápidas"),
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
      t("About 10 ms, the same as one call: the stalls are still rare", "Unos 10 ms, lo mismo que una llamada: las trabas siguen siendo raras"),
      t("A little slower, around 20 ms: it waits for the slowest of 100 fast calls", "Un poco más lenta, unos 20 ms: espera a la más lenta de 100 llamadas rápidas"),
      t("A stall: most user requests hit at least one stalled call, so the p50 is over half a second", "Una traba: la mayoría de las solicitudes tocan al menos una llamada trabada, así que el p50 pasa del medio segundo"),
    ],
    answer: 2,
    why: t(
      "A request that waits for all its calls is as slow as the slowest one. The chance that none of 100 calls stalls is 0.99^100 ≈ 37%, so about 63% of user requests wait on a stall: one backend's p99 has become the user's median. This is the example in Dean and Barroso's \"The Tail at Scale\". At scale you can't hide a rare slow call; you have to make the tail itself short, or stop waiting for it.",
      "Una solicitud que espera todas sus llamadas es tan lenta como la más lenta. La probabilidad de que ninguna de 100 llamadas se trabe es 0.99^100 ≈ 37%, así que cerca del 63% de las solicitudes de usuario esperan una traba: el p99 de un backend se volvió la mediana del usuario. Es el ejemplo de \"The Tail at Scale\", de Dean y Barroso. A gran escala no puedes esconder una llamada lenta rara; tienes que acortar la cola misma o dejar de esperarla.",
    ),
    watch: { fanout: 100, share: 0.01, hedge: "off" },
  },
  {
    id: "merge",
    title: t("Average the hosts' p99s", "Promediar el p99 de cada host"),
    change: t("10 hosts, 5,000 calls each · 9 healthy hosts stall 1 call in 500 · one bad host stalls 3 in 20 · the dashboard averages the ten p99s", "10 hosts, 5,000 llamadas cada uno · 9 hosts sanos traban 1 llamada de cada 500 · un host malo traba 3 de cada 20 · el tablero promedia los diez p99"),
    question: t("How does the average of the ten p99s compare with the p99 of all 50,000 calls?", "¿Cómo se compara el promedio de los diez p99 con el p99 de las 50,000 llamadas?"),
    options: [
      t("About the same: the average of p99s is the fleet's p99", "Más o menos igual: el promedio de los p99 es el p99 de toda la flota"),
      t("Far too low: percentiles don't average; merge the hosts' histograms and take the p99 once", "Demasiado bajo: los percentiles no se promedian; junta los histogramas de los hosts y calcula el p99 una sola vez"),
      t("Too high: the bad host drags the average above the real p99", "Demasiado alto: el host malo arrastra el promedio por encima del p99 real"),
    ],
    answer: 1,
    why: t(
      "A percentile is a position in a sorted list, not a quantity you can add. Nine healthy p99s near 20 ms pull the average down, but the bad host's stalls are 1.5% of all calls, more than 1%, so the fleet's real p99 is a stall. The fix is to keep histograms (fixed buckets, HdrHistogram, t-digest), add the bucket counts across hosts or minutes, and read the percentile from the merged counts. The same goes for averaging minutes into an hour.",
      "Un percentil es una posición en una lista ordenada, no una cantidad que se pueda sumar. Nueve p99 sanos cerca de 20 ms bajan el promedio, pero las trabas del host malo son el 1.5% de todas las llamadas, más del 1%, así que el p99 real de la flota es una traba. La solución es guardar histogramas (buckets fijos, HdrHistogram, t-digest), sumar los conteos de cada bucket entre hosts o minutos y leer el percentil de los conteos combinados. Lo mismo vale para promediar minutos en una hora.",
    ),
    watch: { fanout: 1, share: 0.02, hedge: "off" },
  },
  {
    id: "hedge",
    title: t("Send a backup after the p95", "Enviar un respaldo después del p95"),
    change: t(`Fan-out 10, 1 call in 100 stalls · any call still out after ${Math.round(HEDGE_AT)} ms (the backends' p95) is sent again to another host; the first answer wins`, `Fan-out de 10, 1 llamada de cada 100 se traba · toda llamada que siga pendiente después de ${Math.round(HEDGE_AT)} ms (el p95 de los backends) se envía otra vez a otro host; gana la primera respuesta`),
    question: t("What does hedging cost, and what does it buy?", "¿Cuánto cuesta enviar respaldos (hedged requests) y qué se gana?"),
    options: [
      t("It doubles the calls and roughly halves the p99", "Duplica las llamadas y baja el p99 más o menos a la mitad"),
      t("About 5% more calls, and the p99 falls from over a second to tens of milliseconds", "Cerca de un 5% más de llamadas, y el p99 baja de más de un segundo a decenas de milisegundos"),
      t("Nothing: the stalled call is still out, so the request still waits for it", "Nada: la llamada trabada sigue pendiente, así que la solicitud la sigue esperando"),
    ],
    answer: 1,
    why: t(
      "Only calls slower than the p95 get a backup, so at most about 5% more calls go out. A stall is rare and independent, so the backup on another host almost always comes back in about 10 ms, and the request stops waiting for the stalled one. Dean and Barroso report a BigTable benchmark where a hedge after 10 ms cut the 99.9th percentile from 1,800 ms to 74 ms for 2% more requests. Hedge only calls that are safe to repeat, and cancel the loser if you can.",
      "Solo las llamadas más lentas que el p95 reciben un respaldo, así que salen como mucho un 5% más de llamadas. Una traba es rara e independiente, así que el respaldo en otro host casi siempre vuelve en unos 10 ms, y la solicitud deja de esperar a la trabada. Dean y Barroso reportan una prueba en BigTable donde un respaldo después de 10 ms bajó el percentil 99.9 de 1,800 ms a 74 ms con un 2% más de solicitudes. Envía respaldos solo de llamadas que se pueden repetir sin riesgo, y cancela la perdedora si puedes.",
    ),
    watch: { fanout: 10, share: 0.01, hedge: "p95" },
  },
  {
    id: "gc",
    title: t("A 1-second GC pause", "Una pausa de GC de 1 segundo"),
    change: t("One server, 400 requests a second for a minute, no stalls · at 30 s it stops for a 1-second garbage-collection pause; requests that arrive during it wait it out", "Un servidor, 400 solicitudes por segundo durante un minuto, sin trabas · a los 30 s se detiene por una pausa de recolección de basura (GC) de 1 segundo; las solicitudes que llegan durante la pausa la esperan"),
    question: t("The dashboard shows the minute's mean. What does it say, and what did the slowest 1% see?", "El tablero muestra la media del minuto. ¿Qué dice, y qué vio el 1% más lento?"),
    options: [
      t("The mean stays under 20 ms and looks fine; the slowest 1% waited 0.4 s or more", "La media queda por debajo de 20 ms y se ve bien; el 1% más lento esperó 0.4 s o más"),
      t("The mean jumps to about half a second, so the pause is obvious", "La media salta a cerca de medio segundo, así que la pausa es obvia"),
      t("Both look fine: one second out of sixty is too little to show anywhere", "Ambos se ven bien: un segundo de sesenta es muy poco para notarse"),
    ],
    answer: 0,
    why: t(
      "Only 400 of 24,000 requests arrived during the pause, under 2%, so the mean rises by a few milliseconds and stays under any sensible alert. Those 400 people waited up to a whole second, and the p99 lands among them. Alert on high percentiles, or on the share of requests over a threshold, never on the mean. And measure from when a request was due, not when your load generator got round to sending it, or a pause also hides from your benchmark (coordinated omission).",
      "Solo 400 de 24,000 solicitudes llegaron durante la pausa, menos del 2%, así que la media sube unos pocos milisegundos y queda por debajo de cualquier alerta razonable. Esas 400 personas esperaron hasta un segundo entero, y el p99 cae entre ellas. Alerta sobre percentiles altos, o sobre la proporción de solicitudes por encima de un umbral, nunca sobre la media. Y mide desde que la solicitud debía salir, no desde que tu generador de carga alcanzó a enviarla; si no, la pausa también se esconde de tu benchmark (coordinated omission).",
    ),
    watch: { fanout: 10, share: 0, hedge: "off", gc: true },
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
    t("A percentile is a rank in one sorted set; two sets' p99s don't combine into the p99 of both. Averages hide a bad host behind good ones, and quiet minutes weigh as much as busy ones. Store histograms (Prometheus buckets, HdrHistogram, t-digest, DDSketch), add the counts, and compute percentiles from the merged histogram.",
      "Un percentil es una posición en un conjunto ordenado; los p99 de dos conjuntos no se combinan en el p99 de ambos. Los promedios esconden un host malo detrás de los buenos, y los minutos tranquilos pesan lo mismo que los ocupados. Guarda histogramas (buckets de Prometheus, HdrHistogram, t-digest, DDSketch), suma los conteos y calcula los percentiles del histograma combinado.")],
  [t("Hedged requests send a second copy of a slow call. When is that safe, and how do you keep it from becoming a load problem?", "Las solicitudes de respaldo (hedged requests) envían una segunda copia de una llamada lenta. ¿Cuándo es seguro y cómo evitas que se vuelva un problema de carga?"),
    t("It's safe for reads and idempotent operations, where doing the work twice is harmless. Wait until the p95 (or a fixed delay) before hedging, so only about 5% of calls get a copy; send the copy to a different host; cancel the loser when the first answer arrives; and stop hedging when the whole service is slow, because then the extra copies only add load. Unlike a retry after a timeout, a hedge doesn't wait for failure.",
      "Es seguro para lecturas y operaciones idempotentes, donde hacer el trabajo dos veces no hace daño. Espera hasta el p95 (o un retraso fijo) antes de enviar el respaldo, así solo cerca del 5% de las llamadas reciben copia; envía la copia a otro host; cancela la perdedora cuando llegue la primera respuesta; y deja de enviar respaldos cuando todo el servicio está lento, porque ahí las copias solo agregan carga. A diferencia de un reintento después de un timeout, el respaldo no espera a que algo falle.")],
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
    intro: t("Each user request calls its backends in parallel and is done when the last one answers. Most calls take about 10 ms; a stalled call takes most of a second. Try the fan-out and the stalled calls, turn on hedging, or pause tower 7 for garbage collection, and watch which pointer moves.",
      "Cada solicitud de usuario llama a sus backends en paralelo y termina cuando responde el último. La mayoría de las llamadas tardan unos 10 ms; una llamada trabada tarda casi un segundo. Prueba el fan-out y las llamadas trabadas, activa los respaldos o pausa la torre 7 por recolección de basura, y mira qué puntero se mueve."),
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
      { speed: true },
      { actions: [["gc", t("GC pause on tower 7 (1 s)", "Pausa de GC en la torre 7 (1 s)")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("A backend call takes about 10 ms. A stalled one takes 0.4 to 1.2 s. The stream runs 100 user requests a second; the request on the rig plays slowed down. Changing a setting starts the histogram again.", "Una llamada a un backend tarda unos 10 ms. Una trabada tarda de 0.4 a 1.2 s. El flujo corre 100 solicitudes de usuario por segundo; la solicitud del mostrador se muestra en cámara lenta. Cambiar un ajuste reinicia el histograma."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: EXPERIMENTS },
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
    RESULTS: R,
    HEDGE_AT,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
