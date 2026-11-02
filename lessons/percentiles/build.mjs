// Systems lesson 44 · Percentiles and tail latency. Built on the shared workbench layer (../../workbench).
import { writePage, figurePlate, panel, seg, speedSeg, actions, inlineModule, t, tx } from "../../workbench/page.mjs";
import { buildFigure, chipSvg, heightOf, P, GEOMETRY, POINTERS } from "./figure.mjs";
import { rng, userRequest, summary, binOf, binPos, tailRun, fanoutRun, mergeRun, hedgeRun, gcRun, hedgeAtP95 } from "./sim.js";

const sim = inlineModule(new URL("./sim.js", import.meta.url));

// ---------- results (computed once here from the same model the page runs) ----------
const R = { tail: tailRun(), fanout: fanoutRun(), merge: mergeRun(), hedge: hedgeRun(), gc: gcRun() };
const HEDGE_AT = hedgeAtP95();
const ms0 = (x) => Math.round(x);
console.log("hedge at", HEDGE_AT.toFixed(1), "ms · tail p99", ms0(R.tail.none.p99), "→", ms0(R.tail.tail.p99), "· fan-out p50", ms0(R.fanout.one.p50), ms0(R.fanout.ten.p50), ms0(R.fanout.hundred.p50), "· fleet p99", ms0(R.merge.fleetP99), "avg", ms0(R.merge.avgP99), "· hedge p99", ms0(R.hedge.plain.p99), "→", ms0(R.hedge.hedged.p99), "extra", (100 * R.hedge.hedged.extraShare).toFixed(1) + "%", "· gc mean", R.gc.pause.mean.toFixed(1), "p99", ms0(R.gc.pause.p99));

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

// ---------- page ----------
const figure = figurePlate({
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
  stage: "data-hall",
  stageLabel: t("Tail latency simulation. Space pauses or resumes.", "Simulación de latencia de cola. Espacio pausa o reanuda."),
  svg: buildFigure(FIRST),
});

const NOTE = `<p class="note" style="padding:0 12px 12px;margin:0">${tx(t("A backend call takes about 10 ms. A stalled one takes 0.4 to 1.2 s. The stream runs 100 user requests a second; the request on the rig plays slowed down. Changing a setting starts the histogram again.", "Una llamada a un backend tarda unos 10 ms. Una trabada tarda de 0.4 a 1.2 s. El flujo corre 100 solicitudes de usuario por segundo; la solicitud del mostrador se muestra en cámara lenta. Cambiar un ajuste reinicia el histograma."))}</p>`;
const controls = panel({
  stats: [["mean", t("Mean", "Media"), FIRST.counts.mean + " ms"], ["p50", "p50", FIRST.counts.p50 + " ms"], ["p95", "p95", Math.round(FIRST.s.p95) + " ms"], ["p99", "p99", FIRST.counts.p99 + " ms"], ["slow", t("Over 100 ms", "Más de 100 ms"), (100 * FIRST.s.slow).toFixed(1) + "%"], ["extra", t("Extra calls", "Llamadas extra"), "0%"]],
  controls: [
    seg("fanout", t("Fan-out", "Fan-out"), [[1, "1"], [10, "10"], [100, "100"]], 10),
    seg("share", t("Stalled calls", "Llamadas trabadas"), [[0, t("None", "Ninguna")], [0.01, t("1 in 100", "1 de cada 100")], [0.02, t("1 in 50", "1 de cada 50")]], 0.01),
    seg("hedge", t("Hedge", "Respaldo"), [["off", t("Off", "No")], ["p95", t(`After p95 (${Math.round(HEDGE_AT)} ms)`, `Después del p95 (${Math.round(HEDGE_AT)} ms)`)]], "off"),
    speedSeg(),
    actions(t("Do something", "Haz algo"), [["gc", t("GC pause on tower 7 (1 s)", "Pausa de GC en la torre 7 (1 s)")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]]),
  ],
}).replace(/<\/div>$/, "  " + NOTE + "\n</div>");

const css = `
.iso-stage [data-chips] *{pointer-events:none}
`;

// ---------- live code ----------
const live = `
${sim}
const P = ${JSON.stringify(P)};
const G = ${JSON.stringify(GEOMETRY)};
const CHIP = { on: ${JSON.stringify(chipSvg(true))}, off: ${JSON.stringify(chipSvg(false))} };
const POINTER_KEYS = ${JSON.stringify(POINTERS.map((p) => p.key))};
const RESULTS = ${JSON.stringify(R)};
const HEDGE_AT = ${JSON.stringify(HEDGE_AT)};
const EXPERIMENTS = ${JSON.stringify(EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })))};
const { T: TT, L: tr } = WB;   // this script already uses short names, so the language helpers get their own

const stage = document.querySelector("[data-hall]");
const svg = stage.querySelector("svg");
const q = (s) => svg.querySelector(s);
const readout = document.querySelector("[data-readout]");
const say = (text) => { if (readout.textContent !== text) readout.textContent = text; };
const NS = "http://www.w3.org/2000/svg";
const counters = Object.fromEntries(["mean", "p50", "p99", "slow", "out"].map((n) => [n, WB.counter(svg, n, P)]));
const cols = [...Array(10).keys()].map((i) => q('[data-col="' + i + '"]'));
const pointers = Object.fromEntries(POINTER_KEYS.map((k) => [k, q('[data-pointer="' + k + '"]')]));
const lamps = [...Array(10).keys()].map((i) => ({ on: q('[data-lamp="' + i + '-on"]'), off: q('[data-lamp="' + i + '-off"]'), gc: q('[data-gc="' + i + '"]') }));
const chipsLayer = q("[data-chips]");
const token = q("[data-token]");
const each = q("[data-each]");
const statEls = Object.fromEntries([...document.querySelectorAll("[data-s]")].map((el) => [el.dataset.s, el]));
function stat(key, value) { const el = statEls[key]; const text = String(value); if (el && el.textContent !== text) el.textContent = text; }
const fmt = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : ms >= 100 ? Math.round(ms) + " ms" : ms.toFixed(1) + " ms");

const cfg = { fanout: 10, share: 0.01, hedge: "off", speed: 1 };
const RATE = 100, WINDOW = 3000, SLOWMO = 2.5, GC_HOST = 6;
let r, clock, made, win, winAt, bins, extra, calls, gc, shown, feat, chips, sumAt, last, note, seed = 3;

function restart() {
  r = rng(seed); seed = (Date.now() % 1e6) + 1;
  clock = 0; made = 0; win = []; winAt = 0; bins = Array(10).fill(0); extra = 0; calls = 0; gc = null; chips = []; sumAt = 0; note = null;
  shown = { heights: Array(10).fill(-1), pos: {} };
  chipsLayer.textContent = "";
  feat = { phase: "idle", wait: 0.4 };
  token.style.display = "none";
  each.style.display = cfg.fanout === 100 ? "" : "none";
  lamps.forEach((l) => { l.on.style.display = "none"; l.off.style.display = ""; l.gc.style.display = "none"; });
  // Start with a window already full, so the first frame has a histogram.
  advance(WINDOW / RATE);
  summarize(true);
}

const hedgeAt = () => (cfg.hedge === "p95" ? HEDGE_AT : null);
function oneRequest(rr, t) { return userRequest(rr, { fanout: cfg.fanout, share: cfg.share, hedgeAt: hedgeAt(), t, gc }); }
function advance(dt) {
  const end = clock + dt;
  while ((made + 1) / RATE <= end) {
    const t = (made + 1) / RATE;
    const req = oneRequest(r, t);
    made++; extra += req.extra; calls += req.calls.length;
    if (win.length < WINDOW) win.push(req.ms); else { bins[binOf(win[winAt])]--; win[winAt] = req.ms; winAt = (winAt + 1) % WINDOW; }
    bins[binOf(req.ms)]++;
    // A sample of requests drops onto the bins as chips (more of the slow ones, so the tail shows).
    if (chips.length < 10 && (made % 9 === 0 || (req.ms > SLOW_MS && r() < 0.3))) dropChip(req.ms, false);
  }
  clock = end;
  if (gc && clock > gc.until + 0.2) { lamps[GC_HOST].gc.style.display = "none"; gc = null; }
}

// ---------- chips ----------
function dropChip(ms, featured, from) {
  const g = featured ? token.cloneNode(true) : document.createElementNS(NS, "g");
  if (!featured) { g.setAttribute("class", "wb-lit-group"); g.innerHTML = ms > SLOW_MS ? CHIP.on : CHIP.off; }
  else { g.removeAttribute("data-token"); g.innerHTML = ms > SLOW_MS ? CHIP.on : CHIP.off; g.style.display = ""; }
  const bin = binOf(ms);
  const x = G.BX0 + (bin + 0.5) * G.BW, y = G.PANEL_Y + 10 + ((made * 7) % 5) + (featured ? 1 : 0);
  const top = G.TRAY_Z + G.COL_MAX + 10;
  const c = { g, bin, age: 0, x, y, from: from || [x, y, top], featured, dur: featured ? 1.3 : 0.6 };
  chipsLayer.appendChild(g);
  chips.push(c);
}
function moveChips(dt) {
  for (const c of chips) {
    c.age += dt;
    const f = Math.min(1, c.age / c.dur);
    const floor = G.TRAY_Z + Math.max(0, shown.heights[c.bin]) + 0.2, top = G.TRAY_Z + G.COL_MAX + 10;
    let p;
    if (c.featured) {
      // across from the desk at height, then down into the bin
      const a = Math.min(1, f / 0.6), b = Math.max(0, (f - 0.6) / 0.4);
      const ea = 1 - Math.pow(1 - a, 2);
      p = [c.from[0] + (c.x - c.from[0]) * ea, c.from[1] + (c.y - c.from[1]) * ea, b ? top + (floor - top) * b * b : c.from[2] + (top - c.from[2]) * Math.sin(ea * Math.PI / 2)];
    } else p = [c.x, c.y, top + (floor - top) * f * f];
    c.g.setAttribute("transform", translateAlong(P, p));
    c.g.style.opacity = f > 0.92 ? String(Math.max(0, (1 - f) / 0.08)) : (f < 0.1 && !c.featured ? String(f / 0.1) : "");
  }
  chips = chips.filter((c) => { if (c.age < c.dur) return true; c.g.remove(); return false; });
}

// ---------- the request on the rig, in slow motion ----------
function towerOf(host) { return host % 10; }
function stepFeatured(dt) {
  if (feat.phase === "idle") {
    feat.wait -= dt;
    if (feat.wait > 0) return;
    const req = oneRequest(r, clock);
    feat = { phase: "out", t: 0, req, left: req.calls.map((c) => ({ tower: towerOf(c.host), end: c.ms * SLOWMO / 1000 })) };
    token.style.display = "";
  }
  if (feat.phase === "out") {
    feat.t += dt;
    const out = feat.left.filter((c) => c.end > feat.t);
    const busy = new Set(out.map((c) => c.tower));
    lamps.forEach((l, i) => { const on = busy.has(i); l.on.style.display = on ? "" : "none"; l.off.style.display = on ? "none" : ""; });
    counters.out.set(out.length);
    if (out.length && feat.t > 0.25) {
      const towers = [...busy].map((i) => i + 1).join(", ");
      note = { text: TT("waiting on " + out.length + " of " + feat.req.calls.length + " calls · tower " + towers, "espera " + out.length + " de " + feat.req.calls.length + " llamadas · torre " + towers) };
    }
    if (!out.length) {
      token.style.display = "none";
      dropChip(feat.req.ms, true, ${JSON.stringify(GEOMETRY.TOKEN_SPOT)});
      const n = feat.req.calls.length, ms = feat.req.ms;
      note = { until: clock + 2.2 * cfg.speed, text: ms > SLOW_MS
        ? TT("took " + fmt(ms) + " · waited for its slowest call", "tardó " + fmt(ms) + " · esperó a la llamada más lenta")
        : TT("took " + fmt(ms) + " · " + (n === 1 ? "its call was fast" : "all " + n + " calls fast"), "tardó " + fmt(ms) + " · " + (n === 1 ? "su llamada fue rápida" : "las " + n + " llamadas, rápidas")) };
      feat = { phase: "idle", wait: 0.9 };
    }
  }
}

// ---------- the histogram, pointers and numbers ----------
function summarize(snap) {
  const s = summary(win);
  const total = win.length;
  for (let i = 0; i < 10; i++) {
    const h = heightOf(bins[i], total);
    if (Math.abs(h - shown.heights[i]) > 0.25) { shown.heights[i] = h; cols[i].innerHTML = h < 0.4 ? "" : solidSvg(slabOf({ x: G.BX0 + i * G.BW + 2, y: G.PANEL_Y + 6, w: G.BW - 4, d: G.PANEL_D - 12, r: 0.6 }, G.TRAY_Z, h, P, 2, 0.2), { tone: "hi", crease: "lo", lit: i >= 5 }); }
  }
  shown.target = { mean: binPos(s.mean), p50: binPos(s.p50), p95: binPos(s.p95), p99: binPos(s.p99) };
  if (snap) shown.pos = { ...shown.target };
  counters.mean.set(Math.min(9999, Math.round(s.mean))); counters.p50.set(Math.min(9999, Math.round(s.p50))); counters.p99.set(Math.min(9999, Math.round(s.p99))); counters.slow.set(Math.round(100 * s.slow));
  stat("mean", fmt(s.mean)); stat("p50", fmt(s.p50)); stat("p95", fmt(s.p95)); stat("p99", fmt(s.p99)); stat("slow", (100 * s.slow).toFixed(1) + "%");
  stat("extra", calls ? (100 * extra / calls).toFixed(1) + "%" : "0%");
  last = s;
}
function heightOf(count, total) { return count ? Math.max(1, G.COL_MAX * Math.log10(1 + count) / Math.log10(1 + total)) : 0; }
function movePointers(dt) {
  const f = 1 - Math.exp(-dt * 6);
  for (const k of POINTER_KEYS) {
    const to = shown.target[k], at = shown.pos[k] ?? to;
    const now = Math.abs(to - at) < 0.002 ? to : at + (to - at) * f;
    shown.pos[k] = now;
    pointers[k].setAttribute("transform", translateAlong(P, [G.BX0 + now * G.BW, 0, 0]));
  }
}
function words() {
  if (gc) { say(tr("GC pause on tower 7 · its calls wait", "pausa de GC en la torre 7 · sus llamadas esperan")); return; }
  if (note && (note.until === undefined || clock < note.until)) { say(tr(note.text)); return; }
  const s = last;
  say(tr("last " + win.length.toLocaleString("en") + " · p50 " + fmt(s.p50) + " · p99 " + fmt(s.p99), "últimas " + win.length.toLocaleString("en") + " · p50 " + fmt(s.p50) + " · p99 " + fmt(s.p99)));
}

function paint(dt) {
  sumAt += dt;
  if (sumAt > 0.15) { sumAt = 0; summarize(false); }
  movePointers(dt);
  moveChips(dt);
  words();
}

const pauseBtn = document.querySelector('[data-act="pause"]');
const loop = WB.loop({ stage, step: (dt) => { advance(dt * cfg.speed); stepFeatured(dt * Math.min(cfg.speed, 3)); paint(dt); },
  onPause: (on) => { pauseBtn.textContent = on ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); if (on) say(tr("paused", "en pausa")); } });
WB.onLang(() => { pauseBtn.textContent = loop.paused ? tr("Play", "Reanudar") : tr("Pause", "Pausa"); if (loop.paused) say(tr("paused", "en pausa")); else words(); });

function set(name, raw, quiet) {
  WB.pressSeg(name, raw);
  if (name === "speed") { cfg.speed = Number(raw); return; }
  cfg[name] = name === "hedge" ? raw : Number(raw);
  if (!quiet) restart();
}
WB.onSegments((name, value) => set(name, value));
function pauseHost() {
  gc = { host: GC_HOST, from: clock, until: clock + 1 };
  lamps[GC_HOST].gc.style.display = "";
  note = { until: clock + 1.6, text: TT("tower 7 stops for a 1-second GC pause", "la torre 7 se detiene por una pausa de GC de 1 segundo") };
  if (loop.paused) loop.setPaused(false);
}
document.querySelector('[data-act="gc"]').addEventListener("click", pauseHost);
document.querySelector('[data-act="reset"]').addEventListener("click", () => restart());
pauseBtn.addEventListener("click", () => loop.toggle());
stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); loop.toggle(); } });

// ---------- experiments (numbers computed at build time from the same model, 8 seeds each) ----------
const n0 = (x) => Math.round(x).toLocaleString("en");
const pc = (x) => (100 * x).toFixed(1) + "%";
const RUNS = {
  tail: () => {
    const { none, tail } = RESULTS.tail, top = tail.p99;
    return { verdict: TT("No stalls: mean " + fmt(none.mean) + ", p50 " + fmt(none.p50) + ", p99 " + fmt(none.p99) + ". One call in 50 stalled: mean " + fmt(tail.mean) + " (" + (tail.mean / none.mean).toFixed(1) + "×), p50 " + fmt(tail.p50) + ", p99 " + fmt(tail.p99) + " (" + Math.round(tail.p99 / none.p99) + "×).",
        "Sin trabas: media " + fmt(none.mean) + ", p50 " + fmt(none.p50) + ", p99 " + fmt(none.p99) + ". Una llamada de cada 50 trabada: media " + fmt(tail.mean) + " (" + (tail.mean / none.mean).toFixed(1) + "×), p50 " + fmt(tail.p50) + ", p99 " + fmt(tail.p99) + " (" + Math.round(tail.p99 / none.p99) + "×)."),
      bars: [[TT("p50, with stalls", "p50, con trabas"), tail.p50 / top, fmt(tail.p50)], [TT("Mean, with stalls", "Media, con trabas"), tail.mean / top, fmt(tail.mean)], [TT("p99, no stalls", "p99, sin trabas"), none.p99 / top, fmt(none.p99)], [TT("p99, with stalls", "p99, con trabas"), 1, fmt(tail.p99), true]] };
  },
  fanout: () => {
    const { one, ten, hundred, formula } = RESULTS.fanout;
    return { verdict: TT("Requests that hit at least one stall: " + pc(one.anyStall) + " at 1, " + pc(ten.anyStall) + " at 10, " + pc(hundred.anyStall) + " at 100 (1 − 0.99^N predicts " + formula.map(pc).join(", ") + "). The user's p50: " + fmt(one.p50) + ", " + fmt(ten.p50) + ", " + fmt(hundred.p50) + ".",
        "Solicitudes que tocaron al menos una traba: " + pc(one.anyStall) + " con 1, " + pc(ten.anyStall) + " con 10, " + pc(hundred.anyStall) + " con 100 (1 − 0.99^N predice " + formula.map(pc).join(", ") + "). El p50 del usuario: " + fmt(one.p50) + ", " + fmt(ten.p50) + ", " + fmt(hundred.p50) + "."),
      bars: [[TT("Hit a stall, fan-out 1", "Tocaron una traba, fan-out 1"), one.anyStall, pc(one.anyStall)], [TT("Hit a stall, fan-out 10", "Tocaron una traba, fan-out 10"), ten.anyStall, pc(ten.anyStall)], [TT("Hit a stall, fan-out 100", "Tocaron una traba, fan-out 100"), hundred.anyStall, pc(hundred.anyStall), true], [TT("User p50, fan-out 100", "p50 del usuario, fan-out 100"), hundred.p50 / 1200, fmt(hundred.p50), true]] };
  },
  merge: () => {
    const m = RESULTS.merge, top = m.maxP99;
    return { verdict: TT("Healthy hosts' p99: about " + fmt(m.goodP99) + "; the bad host's: " + fmt(m.maxP99) + ". Average of the ten p99s: " + fmt(m.avgP99) + ". The p99 of all 50,000 calls merged: " + fmt(m.fleetP99) + ".",
        "p99 de los hosts sanos: cerca de " + fmt(m.goodP99) + "; el del host malo: " + fmt(m.maxP99) + ". Promedio de los diez p99: " + fmt(m.avgP99) + ". El p99 de las 50,000 llamadas combinadas: " + fmt(m.fleetP99) + "."),
      bars: [[TT("Average of ten p99s", "Promedio de diez p99"), m.avgP99 / top, fmt(m.avgP99)], [TT("Real p99, merged", "p99 real, combinado"), m.fleetP99 / top, fmt(m.fleetP99), true], [TT("Worst host's p99", "p99 del peor host"), 1, fmt(m.maxP99)]] };
  },
  hedge: () => {
    const { plain, hedged, at } = RESULTS.hedge, top = plain.p99;
    return { verdict: TT("No hedge: p50 " + fmt(plain.p50) + ", p99 " + fmt(plain.p99) + ", p99.9 " + fmt(plain.p999) + ". Hedge after " + fmt(at) + ": p50 " + fmt(hedged.p50) + ", p99 " + fmt(hedged.p99) + ", p99.9 " + fmt(hedged.p999) + ", for " + pc(hedged.extraShare) + " more calls.",
        "Sin respaldo: p50 " + fmt(plain.p50) + ", p99 " + fmt(plain.p99) + ", p99.9 " + fmt(plain.p999) + ". Respaldo después de " + fmt(at) + ": p50 " + fmt(hedged.p50) + ", p99 " + fmt(hedged.p99) + ", p99.9 " + fmt(hedged.p999) + ", con un " + pc(hedged.extraShare) + " más de llamadas."),
      bars: [[TT("p99, no hedge", "p99, sin respaldo"), 1, fmt(plain.p99), true], [TT("p99, hedged", "p99, con respaldo"), hedged.p99 / top, fmt(hedged.p99)], [TT("Extra calls, hedged", "Llamadas extra, con respaldo"), hedged.extraShare, pc(hedged.extraShare)]] };
  },
  gc: () => {
    const { calm, pause } = RESULTS.gc, top = pause.max;
    return { verdict: TT("Calm minute: mean " + fmt(calm.mean) + ", p99 " + fmt(calm.p99) + ". With the pause: mean " + fmt(pause.mean) + ", p50 " + fmt(pause.p50) + ", but p99 " + fmt(pause.p99) + " and the slowest " + fmt(pause.max) + "; " + pc(pause.slow) + " of requests took over 100 ms.",
        "Minuto tranquilo: media " + fmt(calm.mean) + ", p99 " + fmt(calm.p99) + ". Con la pausa: media " + fmt(pause.mean) + ", p50 " + fmt(pause.p50) + ", pero p99 " + fmt(pause.p99) + " y la más lenta " + fmt(pause.max) + "; el " + pc(pause.slow) + " de las solicitudes tardó más de 100 ms."),
      bars: [[TT("Mean, with the pause", "Media, con la pausa"), pause.mean / top, fmt(pause.mean)], [TT("p99, with the pause", "p99, con la pausa"), pause.p99 / top, fmt(pause.p99), true], [TT("Slowest request", "Solicitud más lenta"), 1, fmt(pause.max), true]] };
  },
};
WB.experiments({ list: EXPERIMENTS, runs: RUNS, watch: (exp) => {
  const w = exp.watch;
  set("fanout", String(w.fanout), true); set("share", String(w.share), true); set("hedge", w.hedge, true);
  restart();
  if (loop.paused) loop.setPaused(false);
  if (w.gc) setTimeout(pauseHost, 1200);
} });

loop.setPaused(loop.paused);
restart();
`;

const size = writePage(new URL("./tail-latency-workbench.html", import.meta.url), {
  title: t("Tail Latency Workbench", "Banco de trabajo: latencia de cola"),
  eyebrow: t("Systems lesson 44 · Percentiles", "Lección de sistemas 44 · Percentiles"),
  lede: t("Latency isn't one number. Most requests are fast; a few are slow, and those few are what users remember. Percentiles say how slow the slow ones are, and fan-out decides how many users meet them. This lesson runs a timing hall: watch requests land in a histogram, predict what the mean and the p99 will do, then explain it back.",
    "La latencia no es un solo número. La mayoría de las solicitudes son rápidas; unas pocas son lentas, y esas pocas son las que los usuarios recuerdan. Los percentiles dicen qué tan lentas son las lentas, y el fan-out decide cuántos usuarios se las encuentran. Esta lección usa una sala de tiempos para estudiar la latencia de cola (tail latency): mira cómo caen las solicitudes en un histograma, predice qué harán la media y el p99, y después explícalo."),
  machine: {
    intro: t("Each user request calls its backends in parallel and is done when the last one answers. Most calls take about 10 ms; a stalled call takes most of a second. Try the fan-out and the stalled calls, turn on hedging, or pause tower 7 for garbage collection, and watch which pointer moves.",
      "Cada solicitud de usuario llama a sus backends en paralelo y termina cuando responde el último. La mayoría de las llamadas tardan unos 10 ms; una llamada trabada tarda casi un segundo. Prueba el fan-out y las llamadas trabadas, activa los respaldos o pausa la torre 7 por recolección de basura, y mira qué puntero se mueve."),
    figure, panel: controls,
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The fan-out and hedging examples follow Jeffrey Dean and Luiz André Barroso, <a href="https://research.google/pubs/the-tail-at-scale/" target="_blank" rel="noopener">"The Tail at Scale"</a>, Communications of the ACM 56(2), 2013.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los ejemplos de fan-out y de respaldos siguen a Jeffrey Dean y Luiz André Barroso, <a href="https://research.google/pubs/the-tail-at-scale/" target="_blank" rel="noopener">"The Tail at Scale"</a>, Communications of the ACM 56(2), 2013.`),
  css,
  script: live,
});
console.log("wrote tail-latency-workbench.html", (size / 1024).toFixed(0) + " KB");
