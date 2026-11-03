// @ts-nocheck: content ported as-is
// Systems lesson 08 · Canary deploys: a model railway junction with a canary track.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct as pctOf } from "../../lib/format";
import { buildFigure, P, GEOMETRY } from "./figure";
import { blastRun, rareRun, tightRun, stickyRun, silentRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page computed them in
// the browser; they're seeded, so the numbers are the same).
const RESULTS = { blast: blastRun(), rare: rareRun(), tight: tightRun(), sticky: stickyRun(), silent: silentRun() };

// What each card shows after a run.
const minutes = (s) => (s >= 5400 ? (s / 3600).toFixed(1) + " h" : Math.round(s / 60) + " min");
const RUNS = {
  blast: () => {
    const { a, b } = RESULTS.blast, top = Math.max(a.hit, b.hit) * 1.1;
    return { verdict: t("Failed orders before rollback: " + a.hit.toFixed(1) + " at 25% (caught in " + minutes(a.time) + "), " + b.hit.toFixed(1) + " at 1% (caught in " + minutes(b.time) + ").", "Pedidos fallidos antes de la reversión: " + a.hit.toFixed(1) + " con 25% (detectada en " + minutes(a.time) + "), " + b.hit.toFixed(1) + " con 1% (detectada en " + minutes(b.time) + ")."), bars: [[t("25% canary", "Canario 25%"), a.hit / top, a.hit.toFixed(1)], [t("1% canary", "Canario 1%"), b.hit / top, b.hit.toFixed(1), true]] };
  },
  rare: () => {
    const { a, b } = RESULTS.rare, top = Math.max(a, b) * 1.1;
    return { verdict: t("Time until the arm rolls it back: " + minutes(a) + " at 10%, " + minutes(b) + " at 1%. A 30-minute bake would have promoted it either way.", "Tiempo hasta que el brazo la revierte: " + minutes(a) + " con 10%, " + minutes(b) + " con 1%. Con 30 minutos de observación se habría promovido en ambos casos."), bars: [[t("10% canary", "Canario 10%"), a / top, minutes(a)], [t("1% canary", "Canario 1%"), b / top, minutes(b), true], [t("30-minute bake", "Observación de 30 min"), 1800 / top, "30 min"]] };
  },
  tight: () => {
    const { a, b } = RESULTS.tight;
    return { verdict: t("A good build was rolled back in " + pctOf(b) + " of deploys with the tight rule, " + pctOf(a) + " with the normal one.", "Una versión buena se revirtió en el " + pctOf(b) + " de los despliegues con la regla estricta y en el " + pctOf(a) + " con la estándar."), bars: [[t("Normal rule", "Regla estándar"), a, pctOf(a)], [t("Tight rule", "Regla estricta"), b, pctOf(b), true]] };
  },
  sticky: () => {
    const { a, b } = RESULTS.sticky;
    return { verdict: t(pctOf(a) + " of users saw both versions with per-request routing, " + pctOf(b) + " with per-user routing.", "El " + pctOf(a) + " de los usuarios vio ambas versiones con enrutamiento por solicitud y el " + pctOf(b) + " con enrutamiento por usuario."), bars: [[t("Per request", "Por solicitud"), a, pctOf(a), true], [t("Per user", "Por usuario"), b, pctOf(b)]] };
  },
  silent: () => {
    const { a, b } = RESULTS.silent, top = Math.max(a.n, b.n) * 1.05;
    return { verdict: t("Watching failures only: " + Math.round(a.n) + " wrong-price orders, promoted in " + pctOf(a.promoted) + " of runs. Watching prices too: " + Math.round(b.n) + ", rolled back within minutes.", "Vigilando solo fallos: " + Math.round(a.n) + " pedidos con precio erróneo, promovida en el " + pctOf(a.promoted) + " de las ejecuciones. Vigilando también los precios: " + Math.round(b.n) + ", revertida en minutos."), bars: [[t("Failures only", "Solo fallos"), a.n / top, String(Math.round(a.n)), true], [t("Failures + prices", "Fallos + precios"), b.n / top, String(Math.round(b.n))]] };
  },
};

const EXPERIMENTS = [
  {
    id: "blast",
    title: t("How many people does a bad build hurt?", "¿A cuántas personas afecta una versión mala?"),
    change: t("Bad build (1 in 5 orders fail) · canary 25% → 1% · automatic rollback on", "Versión mala (falla 1 de cada 5 pedidos) · canario 25% → 1% · reversión automática activada"),
    question: t(
      "At 25%, the rollback arm catches the bad build after about 11 failed orders. At 1%, how many orders fail before it is caught?",
      "Con 25%, el brazo de reversión detecta la versión mala después de unos 11 pedidos fallidos. Con 1%, ¿cuántos pedidos fallan antes de detectarla?",
    ),
    options: [
      t("About 25 times fewer: under 1", "Unas 25 veces menos: menos de 1"),
      t("Fewer, but nowhere near 25 times fewer, and it takes far longer to catch", "Menos, pero ni de cerca 25 veces menos, y tarda mucho más en detectarla"),
      t("The same number, just as fast", "La misma cantidad, igual de rápido"),
    ],
    answer: 1,
    why: t(
      "The rollback arm needs evidence: at least 3 failures before it acts. At 25% those arrive in seconds, but the check only runs every 3 minutes, so more orders fail while it waits. At 1% the canary pays roughly the evidence price and little more, but collecting it takes about 25 minutes. A small canary limits damage per minute, not the minimum damage needed to notice.",
      "El brazo de reversión necesita evidencia: al menos 3 fallos antes de actuar. Con 25% llegan en segundos, pero la revisión solo corre cada 3 minutos, así que fallan más pedidos mientras espera. Con 1%, el canario paga más o menos el precio de la evidencia y poco más, pero juntarla toma unos 25 minutos. Un canario pequeño limita el daño por minuto, no el daño mínimo necesario para darse cuenta.",
    ),
    watch: { pct: 25, build: "bad", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 4 },
  },
  {
    id: "rare",
    title: t("A rare bug", "Un bug raro"),
    change: t("1 order in 200 fails on the new build · canary 10% → 1%", "1 de cada 200 pedidos falla con la versión nueva · canario 10% → 1%"),
    question: t("At 10% the arm needs about 2 hours to be sure. At 1%, how long?", "Con 10%, el brazo necesita unas 2 horas para estar seguro. Con 1%, ¿cuánto?"),
    options: [
      t("About the same: the bug is equally rare", "Más o menos lo mismo: el bug es igual de raro"),
      t("Many hours: it needs the same number of failures from far fewer orders", "Muchas horas: necesita la misma cantidad de fallos con muchos menos pedidos"),
      t("It is caught sooner, because the canary is quieter", "Lo detecta antes, porque el canario está más tranquilo"),
    ],
    answer: 1,
    why: t(
      "The arm needs the same evidence either way, three failures, and at 1 in 200 that means hundreds of canary orders. A 1% canary sees a tenth of the orders, so it takes several times longer. If you promote after a 30-minute bake, this bug ships at both sizes: rare bugs need more traffic or longer bakes, not luck.",
      "El brazo necesita la misma evidencia en ambos casos, tres fallos, y con 1 de cada 200 eso significa cientos de pedidos canario. Un canario de 1% ve una décima parte de los pedidos, así que tarda varias veces más. Si promueves después de 30 minutos de observación (bake), este bug llega a producción con ambos tamaños: los bugs raros necesitan más tráfico o una observación más larga, no suerte.",
    ),
    watch: { pct: 10, build: "rare", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 20 },
  },
  {
    id: "tight",
    title: t("A twitchy rollback", "Una reversión nerviosa"),
    change: t(
      "Good build at 10% for 2 hours · threshold normal → tight (any failure above 0.15%)",
      "Versión buena con 10% durante 2 horas · regla estándar → estricta (cualquier fallo por encima de 0.15%)",
    ),
    question: t(
      "The new build is fine. Both tracks fail 1 order in 1,000 by bad luck. How often does the tight rule roll it back anyway?",
      "La versión nueva está bien. Las dos vías fallan 1 de cada 1,000 pedidos por mala suerte. ¿Qué tan seguido la revierte de todos modos la regla estricta?",
    ),
    options: [
      t("Never: the build is good", "Nunca: la versión es buena"),
      t("Now and then, about 1 deploy in 20", "De vez en cuando, más o menos 1 de cada 20 despliegues"),
      t("Close to half of the deploys", "Cerca de la mitad de los despliegues"),
    ],
    answer: 2,
    why: t(
      "Healthy systems fail a little all the time. With one failure as enough evidence, a single unlucky order early in the canary looks like a regression. False rollbacks are not free: people stop trusting the arm and start overriding it. A good rule asks for several failures and compares against the old version's normal noise.",
      "Los sistemas sanos fallan un poco todo el tiempo. Si un solo fallo basta como evidencia, un único pedido con mala suerte al principio del canario parece una regresión. Las reversiones falsas no son gratis: la gente deja de confiar en el brazo y empieza a pasarlo por alto. Una buena regla pide varios fallos y compara con el ruido normal de la versión vieja.",
    ),
    watch: { pct: 10, build: "good", auto: "on", rule: "tight", routing: "random", check: "errors", speed: 20 },
  },
  {
    id: "sticky",
    title: t("Who sees what", "Quién ve qué"),
    change: t("Good build at 25% for 10 minutes · 100 users, each ordering about 7 times", "Versión buena con 25% durante 10 minutos · 100 usuarios, cada uno con unos 7 pedidos"),
    question: t("With random routing, how many users see both the old and the new version?", "Con enrutamiento aleatorio, ¿cuántos usuarios ven tanto la versión vieja como la nueva?"),
    options: [
      t("Almost none", "Casi ninguno"),
      t("About a quarter, the canary share", "Más o menos una cuarta parte, el porcentaje canario"),
      t("Most of them", "La mayoría"),
    ],
    answer: 2,
    why: t(
      "Random routing decides per request, so a user with 7 orders flips between versions several times: a button moves, a cart format changes, a session written by one version is read by the other. Sticky routing decides per user, so each person stays on one version and the canary share means a share of people.",
      "El enrutamiento aleatorio decide por solicitud, así que un usuario con 7 pedidos salta entre versiones varias veces: un botón se mueve, cambia el formato del carrito, una sesión que escribió una versión la lee la otra. El enrutamiento fijo (sticky) decide por usuario, así que cada persona se queda en una versión y el porcentaje canario significa un porcentaje de personas.",
    ),
    watch: { pct: 25, build: "good", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 4 },
  },
  {
    id: "silent",
    title: t("The bug that doesn't fail", "El bug que no falla"),
    change: t(
      "New build charges the wrong price on 3 orders in 10 · canary 10% · promoted after a 30-minute bake",
      "La versión nueva cobra el precio equivocado en 3 de cada 10 pedidos · canario 10% · promovida tras 30 minutos de observación",
    ),
    question: t(
      "The rollback arm only watches failures. After an hour, how many wrong-price orders went out?",
      "El brazo de reversión solo vigila fallos. Después de una hora, ¿cuántos pedidos con precio erróneo salieron?",
    ),
    options: [
      t("A handful: the canary caught it", "Unos pocos: el canario lo detectó"),
      t("About 70: only the canary's share was hurt", "Unos 70: solo se afectó la parte del canario"),
      t("About 700: it was promoted and everyone got it", "Unos 700: se promovió y les llegó a todos"),
    ],
    answer: 2,
    why: t(
      "Nothing failed, so the error gauge stayed flat and the canary looked perfect. After promotion every order went through the new build. Canaries only catch what you measure: add business checks (prices match the catalogue, orders per minute, payment success) to the analysis and the same build is rolled back within minutes.",
      "Nada falló, así que el indicador de errores se quedó plano y el canario se veía perfecto. Después de la promoción, todos los pedidos pasaron por la versión nueva. Los canarios solo detectan lo que mides: agrega al análisis verificaciones de negocio (que los precios coincidan con el catálogo, pedidos por minuto, pagos exitosos) y la misma versión se revierte en minutos.",
    ),
    watch: { pct: 10, build: "silent", auto: "on", rule: "normal", routing: "random", check: "errors", speed: 20 },
  },
];

const QUESTIONS = [
  [t("Why ship to 1% first instead of everyone, if the 1% canary still lets some orders fail?",
     "¿Por qué enviar primero al 1% en vez de a todos, si el canario de 1% igual deja fallar algunos pedidos?"),
   t("It limits how many people are hurt per minute while you collect evidence, and it limits who is hurt if you miss the signal. You still pay a minimum number of failures to notice anything; a canary turns a full outage into that small, bounded cost.",
     "Limita cuántas personas se ven afectadas por minuto mientras juntas evidencia, y limita a quién afecta si se te escapa la señal. Igual pagas un número mínimo de fallos para notar algo; un canario convierte una caída total en ese costo pequeño y acotado.")],
  [t("A teammate says \"our canary ran for 30 minutes at 1% with zero errors, ship it\". What would you ask?",
     "Alguien de tu equipo dice \"nuestro canario corrió 30 minutos al 1% sin errores, a producción\". ¿Qué preguntarías?"),
   t("How many requests actually went through the canary, and how rare a bug could that sample have caught? At 1% of modest traffic, 30 minutes may be a few hundred requests, which cannot tell a 1-in-200 bug from noise. Ask for a minimum sample size, not just a time.",
     "¿Cuántas solicitudes pasaron realmente por el canario y qué tan raro podía ser un bug para que esa muestra lo detectara? Con el 1% de un tráfico modesto, 30 minutos pueden ser unos cientos de solicitudes, que no distinguen un bug de 1 en 200 del ruido. Pide un tamaño mínimo de muestra, no solo un tiempo.")],
  [t("Your automatic rollback fires on every second deploy, but the builds turn out fine. What's going on, and what would you change?",
     "Tu reversión automática se dispara en uno de cada dos despliegues, pero las versiones resultan estar bien. ¿Qué está pasando y qué cambiarías?"),
   t("The rule treats normal background noise as a regression: too few failures required, or a threshold below the old version's own error rate. Require several failures, compare against the baseline running at the same time, and look at a window long enough to average out bad luck.",
     "La regla trata el ruido normal de fondo como una regresión: pide muy pocos fallos o tiene un umbral por debajo de la propia tasa de errores de la versión vieja. Exige varios fallos, compara con la línea base que corre al mismo tiempo y mira una ventana lo bastante larga para compensar la mala suerte.")],
  [t("When would you route the canary by user instead of by request?",
     "¿Cuándo enrutarías el canario por usuario en vez de por solicitud?"),
   t("Whenever the experience must be consistent for a person: UI changes, multi-step flows, sessions or caches written by one version and read by another, or when you want to say \"5% of users\" rather than \"5% of requests\". Request-level routing is fine for stateless backend changes.",
     "Siempre que la experiencia tenga que ser consistente para una persona: cambios de interfaz, flujos de varios pasos, sesiones o cachés que escribe una versión y lee la otra, o cuando quieres decir \"5% de los usuarios\" en vez de \"5% de las solicitudes\". El enrutamiento por solicitud está bien para cambios de backend sin estado.")],
  [t("Name two things a canary analysis should watch besides HTTP 5xx errors.",
     "Nombra dos cosas que un análisis canario debería vigilar además de los errores HTTP 5xx."),
   t("Business and correctness signals: orders or sign-ups per minute, payment success, values that must match (prices against the catalogue), latency percentiles, and resource use. Silent bugs only show up in what you choose to measure.",
     "Señales de negocio y de corrección: pedidos o registros por minuto, pagos exitosos, valores que deben coincidir (precios contra el catálogo), percentiles de latencia y uso de recursos. Los bugs silenciosos solo aparecen en lo que eliges medir.")],
  [t("The canary is rolled back automatically. What has happened to the users who already got an error, and what does that mean for database changes?",
     "El canario se revierte automáticamente. ¿Qué les pasó a los usuarios que ya recibieron un error y qué significa eso para los cambios en la base de datos?"),
   t("Rollback only stops new damage; failed orders stay failed and data the new version wrote stays written. That's why schema changes are split (expand, deploy, then contract) so either version can run against the same data, and why rollback has to be safe to do at any time.",
     "La reversión solo detiene el daño nuevo; los pedidos fallidos siguen fallidos y los datos que escribió la versión nueva siguen escritos. Por eso los cambios de esquema se dividen (expandir, desplegar y luego contraer), para que cualquiera de las dos versiones pueda correr con los mismos datos, y por eso la reversión tiene que ser segura en cualquier momento.")],
];

export default defineLesson({
  title: t("Canary Deploy Workbench", "Banco de trabajo: despliegue canario"),
  eyebrow: t("Systems lesson 08 · Canary deploys", "Lección de sistemas 08 · Despliegues canario"),
  lede: t("A canary deploy sends a small share of real traffic to the new version, watches it, and either rolls it back or promotes it. This lesson builds that idea three ways: watch a machine do it, predict what fools it, then explain it back.",
    "Un despliegue canario (canary deploy) envía una pequeña parte del tráfico real a la versión nueva, la vigila y luego la revierte (rollback) o la promueve. Esta lección construye esa idea de tres maneras: mira cómo lo hace una máquina, predice qué la engaña y después explícalo."),
  machine: {
    intro: t("The old track is the version in production; the short lit track is the canary. Set a share on the lever, pick a build, and watch the rollback arm decide. Speed ×20 makes the 3-minute checks come round quickly.",
      "La vía vieja es la versión en producción; la vía corta iluminada es el canario. Fija un porcentaje con la palanca, elige una versión (build) y mira cómo decide el brazo de reversión. La velocidad ×20 hace que las revisiones de cada 3 minutos lleguen rápido."),
    plate: {
      title: t("Railway junction", "Empalme ferroviario"),
      keys: [
        { mark: "lit", label: t("New build: canary track, its trains and its failure needle", "Versión nueva: la vía canario, sus trenes y su aguja de fallos") },
        { mark: "raised", label: t("Old build: the old track and its trains", "Versión vieja: la vía vieja y sus trenes") },
        { mark: "flat", label: t("Lever frame: canary share, and the rollback pusher", "Bastidor de palancas: el porcentaje canario y el empujador de reversión") },
      ],
      caption: t(
        "Each train is one customer order. The lever sets the share of trains switched onto the new track (0, 1, 5, 25, 50 or 100%). A failed order derails before the station; a wrong-price order arrives without its crate. The console shows the old failure rate, the canary failure rate against the threshold mark (scale to 2%), and a timer: every 3 minutes the rollback arm checks the canary and, if it has enough failures above the threshold, pushes the lever back to 0.",
        "Cada tren es un pedido de un cliente. La palanca fija el porcentaje de trenes desviados a la vía nueva (0, 1, 5, 25, 50 o 100%). Un pedido fallido se descarrila antes de la estación; un pedido con precio erróneo llega sin su caja. La consola muestra la tasa de fallos vieja, la tasa de fallos del canario contra la marca del umbral (escala hasta 2%) y un temporizador: cada 3 minutos el brazo de reversión revisa el canario y, si tiene suficientes fallos por encima del umbral, empuja la palanca de vuelta a 0.",
      ),
      stage: { "data-office": "" },
      label: t("Railway junction simulation. Space pauses or resumes.", "Simulación del empalme ferroviario. Espacio pausa o reanuda."),
    },
    svg: buildFigure(16),
    stats: [["old", t("Old orders · failed", "Pedidos viejos · fallidos")], ["new", t("Canary orders · failed", "Pedidos canario · fallidos")], ["wrong", t("Wrong prices", "Precios erróneos")], ["hit", t("Hurt by canary", "Afectados por canario")], ["mixed", t("Users on both", "Usuarios en ambas")], ["decision", t("Decision", "Decisión"), t("watching", "observando")]],
    controls: [
      { seg: "pct", label: t("Canary share", "Porcentaje canario"), options: [[0, "0%"], [1, "1%"], [5, "5%"], [25, "25%"], [50, "50%"], [100, "100%"]], value: 5 },
      { seg: "build", label: t("New build", "Versión nueva"), options: [["good", t("Good", "Buena")], ["bad", t("Bad", "Mala")], ["rare", t("Rare bug", "Bug raro")], ["silent", t("Wrong prices", "Precios erróneos")]], value: "good" },
      { seg: "auto", label: t("Automatic rollback", "Reversión automática"), options: [["off", t("Off", "No")], ["on", t("On", "Sí")]], value: "on" },
      { seg: "rule", label: t("Rollback rule", "Regla de reversión"), options: [["tight", t("Tight", "Estricta")], ["normal", t("Normal", "Estándar")], ["loose", t("Loose", "Laxa")]], value: "normal" },
      { seg: "routing", label: t("Routing", "Enrutamiento"), options: [["random", t("Per request", "Por solicitud")], ["sticky", t("Per user", "Por usuario")]], value: "random" },
      { seg: "check", label: t("Analysis watches", "El análisis vigila"), options: [["errors", t("Failures", "Fallos")], ["price", t("Failures + prices", "Fallos + precios")]], value: "errors" },
      { speed: true, options: [[0.5, "×0.5"], [1, "×1"], [4, "×4"], [20, "×20"]] },
      { actions: [["promote", t("Promote", "Promover")], ["rollback", t("Roll back", "Revertir")], ["reset", t("New deploy", "Nuevo despliegue")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over many seeded runs: 1.2 orders per second, 1 in 1,000 orders fail on either version by bad luck, and the rollback arm checks every 3 minutes for at least 3 failures above 0.4%.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la figura, promediados sobre muchas ejecuciones con semilla fija: 1.2 pedidos por segundo, 1 de cada 1,000 pedidos falla en cualquiera de las dos versiones por mala suerte, y el brazo de reversión revisa cada 3 minutos si hay al menos 3 fallos por encima de 0.4%."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  data: {
    P,
    G: GEOMETRY,
  },
});
