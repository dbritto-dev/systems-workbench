// @ts-nocheck: content ported as-is
// Systems lesson 22 · Feature flags: a theatre lighting console decides who sees a show that is already on every stage.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, tokenSvg, cablePoints, P, GEOMETRY } from "./figure";
import { killVsRollback, stickiness, staleness, combos, targeting } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran these
// eight-seed averages in the browser when a card was run; they are deterministic, so the numbers are the same).
const RESULTS = {
  kill: killVsRollback(),
  sticky: stickiness(),
  ttl: { a: staleness(5), b: staleness(60) },
  debt: { a: combos(3), b: combos(10) },
  target: targeting(),
};

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "kill",
    title: t("A bad feature at 50%", "Una funcionalidad mala al 50%"),
    change: t("Buggy feature on for 50% of users · someone notices at 30 s · flip the kill switch (servers refresh every 5 s) vs redeploy the old build (90 s pipeline, then 30 s per server)", "Funcionalidad con bug activa para el 50% de los usuarios · alguien lo nota a los 30 s · activar el kill switch (los servidores se actualizan cada 5 s) vs redesplegar el build anterior (90 s de pipeline, luego 30 s por servidor)"),
    question: t("How long until no user hits the bug, with each fix?", "Con cada solución, ¿cuánto tarda en que ningún usuario se tope con el bug?"),
    options: [t("About the same: either way the old behaviour comes back", "Más o menos lo mismo: de cualquier forma vuelve el comportamiento anterior"), t("Seconds with the kill switch, minutes with the redeploy", "Segundos con el kill switch, minutos con el redespliegue"), t("The redeploy is faster, because flag settings are cached", "El redespliegue es más rápido, porque la configuración de los flags está en caché")],
    answer: 1,
    why: t("The new code was already on every server; the flag only decided who ran it. Turning the flag off needs no build, no pipeline and no restart: each server stops showing the feature at its next settings refresh. A redeploy has to rebuild and roll out server by server, and the bug keeps firing on every server that hasn't been replaced yet. That gap is the whole point of separating deploy from release.", "El código nuevo ya estaba en todos los servidores; el flag solo decidía quién lo ejecutaba. Apagar el flag no necesita build, ni pipeline, ni reinicio: cada servidor deja de mostrar la funcionalidad en su siguiente actualización de configuración. Un redespliegue tiene que reconstruir y desplegar servidor por servidor, y el bug sigue saltando en cada servidor que todavía no se reemplazó. Esa diferencia es justo el sentido de separar el despliegue del lanzamiento (deploy vs release)."),
    watch: { pct: 50, sticky: true, staffFirst: false, ttl: 5, buggy: true, flags: 1, then: "kill" },
  },
  {
    id: "sticky",
    title: t("Random or sticky", "Aleatorio o fijo"),
    change: t("30% rollout for 2 minutes · each request rolls a die vs each user is hashed to a fixed bucket", "Lanzamiento al 30% durante 2 minutos · cada solicitud tira un dado vs cada usuario se asigna por hash a un grupo (bucket) fijo"),
    question: t("Out of about 200 users, how many see both the old and the new version?", "De unos 200 usuarios, ¿cuántos ven tanto la versión vieja como la nueva?"),
    options: [t("About 30%, the rollout share", "Alrededor del 30%, la parte del lanzamiento"), t("Most of them with random, none with sticky", "La mayoría con aleatorio, ninguno con fijo"), t("None either way: a user is either in or out", "Ninguno en los dos casos: un usuario está dentro o fuera")],
    answer: 1,
    why: t("With a die roll per request, a user who makes several requests lands in the 30% sometimes and outside it the rest, so the page changes under them: a button appears, then vanishes. Hashing the user id (plus the flag name) gives each user a fixed bucket from 0 to 99, so the same user always gets the same answer, and raising the rollout from 30% to 50% only adds users, never moves them back.", "Con un dado por solicitud, un usuario que hace varias solicitudes cae a veces en el 30% y el resto fuera, así que la página cambia debajo de él: un botón aparece y luego desaparece. Aplicar hash al id del usuario (más el nombre del flag) le da a cada usuario un bucket fijo de 0 a 99, así que el mismo usuario siempre recibe la misma respuesta, y subir el lanzamiento del 30% al 50% solo agrega usuarios, nunca los saca."),
    watch: { pct: 30, sticky: false, staffFirst: false, ttl: 5, buggy: false, flags: 1 },
  },
  {
    id: "ttl",
    title: t("Stale flags", "Flags desactualizados"),
    change: t("Feature on for everyone, turned off at 30 s · each server refreshes its copy of the settings every 5 s vs every 60 s", "Funcionalidad activa para todos, apagada a los 30 s · cada servidor actualiza su copia de la configuración cada 5 s vs cada 60 s"),
    question: t("With a 60 s refresh, how long do servers keep showing the feature after it's off?", "Con una actualización cada 60 s, ¿cuánto tiempo siguen mostrando los servidores la funcionalidad después de apagarla?"),
    options: [t("It stops at once: the console is the source of truth", "Se detiene al instante: la consola es la fuente de verdad"), t("Up to about a minute, one server at a time", "Hasta cerca de un minuto, un servidor a la vez"), t("Until the next deploy", "Hasta el siguiente despliegue")],
    answer: 1,
    why: t("Servers don't ask the flag service on every request; that would make it a dependency of every page. They keep a copy and refresh it. Until a server's next refresh it still serves what it last saw, so after a flip the feature fades out server by server. Shorter refreshes or a push from the flag service (streaming, webhooks) shrink that window; that is what makes a kill switch fast.", "Los servidores no le preguntan al servicio de flags en cada solicitud; eso lo volvería una dependencia de cada página. Guardan una copia y la actualizan. Hasta su siguiente actualización, un servidor sigue sirviendo lo último que vio, así que después de un cambio la funcionalidad se apaga servidor por servidor. Actualizaciones más frecuentes o que el servicio de flags empuje los cambios (streaming, webhooks) achican esa ventana; eso es lo que hace rápido a un kill switch."),
    watch: { pct: 100, sticky: true, staffFirst: false, ttl: 60, buggy: false, flags: 1, then: "kill" },
  },
  {
    id: "debt",
    title: t("Flag debt", "Deuda de flags"),
    change: t("3 flags vs 10 flags in use, each on for half the users (sticky, independent)", "3 flags vs 10 flags en uso, cada uno activo para la mitad de los usuarios (fijo, independientes)"),
    question: t("With 10 flags, how many different versions of the app are live at the same time?", "Con 10 flags, ¿cuántas versiones distintas de la app están en vivo al mismo tiempo?"),
    options: [t("10, one per flag", "10, una por flag"), t("1,024, every possible combination", "1,024, todas las combinaciones posibles"), t("Nearly one per active user: well over a hundred", "Casi una por usuario activo: bastante más de cien")],
    answer: 2,
    why: t("Each flag doubles the number of possible combinations: 3 flags give 8, 10 flags give 1,024. Only about 200 users are active, so the live count stops near the number of users, and almost every user runs a combination nobody else has, and nobody tested. That is why finished rollouts should have their flag deleted: a flag that stays at 100% is still a branch someone has to reason about.", "Cada flag duplica el número de combinaciones posibles: 3 flags dan 8, 10 flags dan 1,024. Solo hay unos 200 usuarios activos, así que la cuenta en vivo se frena cerca del número de usuarios, y casi cada usuario ejecuta una combinación que nadie más tiene y que nadie probó. Por eso a los lanzamientos terminados hay que borrarles el flag: un flag que se queda en 100% sigue siendo una rama en la que alguien tiene que pensar."),
    watch: { pct: 50, sticky: true, staffFirst: false, ttl: 5, buggy: false, flags: 10 },
  },
  {
    id: "target",
    title: t("Staff first", "Primero el personal"),
    change: t("A buggy feature for 60 s · on for internal staff only (5% of traffic) vs on for 10% of all users", "Una funcionalidad con bug durante 60 s · activa solo para el personal interno (5% del tráfico) vs activa para el 10% de todos los usuarios"),
    question: t("How many customers hit the bug in that minute?", "¿Cuántos clientes se topan con el bug en ese minuto?"),
    options: [t("About the same either way", "Más o menos los mismos en los dos casos"), t("None with staff first; around ten with 10% of everyone", "Ninguno con primero el personal; unos diez con el 10% de todos"), t("More with staff first, because staff use the product more", "Más con primero el personal, porque el personal usa más el producto")],
    answer: 1,
    why: t("Targeting lets the first users of a feature be the people who built it. Staff meet the bug, report it and the flag goes off before any customer sees it. A percentage rollout picks users at random, so customers are in the first group. In practice teams chain both: staff, then a few percent of customers, then everyone, watching errors at each step.", "La segmentación (targeting) permite que los primeros usuarios de una funcionalidad sean quienes la construyeron. El personal se topa con el bug, lo reporta y el flag se apaga antes de que lo vea algún cliente. Un lanzamiento por porcentaje elige usuarios al azar, así que hay clientes en el primer grupo. En la práctica los equipos encadenan los dos: personal, luego un pequeño porcentaje de clientes, luego todos, vigilando los errores en cada paso."),
    watch: { pct: 10, sticky: true, staffFirst: true, ttl: 5, buggy: true, flags: 1 },
  },
];

const QUESTIONS = [
  [t("What does \"separate deploy from release\" mean, and what does it buy you?", "¿Qué significa \"separar el despliegue del lanzamiento\" (deploy vs release), y qué te da?"),
    t("Deploying puts the new code on the servers; releasing decides who runs it. With a flag the code ships dark, and turning it on or off is a settings change, not a build. You can deploy on Tuesday, release to staff on Wednesday, to 10% on Thursday, and switch it off in seconds if it breaks, without a redeploy.", "Desplegar pone el código nuevo en los servidores; lanzar decide quién lo ejecuta. Con un flag el código sale apagado, y encenderlo o apagarlo es un cambio de configuración, no un build. Puedes desplegar el martes, lanzarlo al personal el miércoles, al 10% el jueves, y apagarlo en segundos si falla, sin redesplegar.")],
  [t("Why hash the user id for a percentage rollout instead of picking randomly per request?", "¿Por qué aplicar hash al id del usuario en un lanzamiento por porcentaje en vez de elegir al azar en cada solicitud?"),
    t("A random roll per request flips the same user between versions, which breaks their experience and your metrics. Hashing the user id (with the flag name as salt) gives each user a stable bucket, so they always see the same thing, and raising the percentage only adds users. Including the flag name means different flags don't all pick the same users.", "Un sorteo por solicitud hace saltar al mismo usuario entre versiones, lo que rompe su experiencia y tus métricas. Aplicar hash al id del usuario (con el nombre del flag como sal) le da a cada usuario un bucket estable, así que siempre ve lo mismo, y subir el porcentaje solo agrega usuarios. Incluir el nombre del flag hace que flags distintos no elijan todos a los mismos usuarios.")],
  [t("You flip a kill switch and some users still see the feature for a while. Why, and how would you shorten that?", "Activas un kill switch y algunos usuarios siguen viendo la funcionalidad por un rato. ¿Por qué, y cómo lo acortarías?"),
    t("Each server evaluates flags from a cached copy that refreshes on a timer, so servers keep serving the old setting until their next refresh. Shorten the refresh interval, use a flag service that pushes changes (streaming), and for kill switches make sure the client also re-evaluates rather than caching the decision for a whole session.", "Cada servidor evalúa los flags a partir de una copia en caché que se actualiza con un temporizador, así que los servidores siguen sirviendo la configuración vieja hasta su siguiente actualización. Acorta el intervalo de actualización, usa un servicio de flags que empuje los cambios (streaming) y, para los kill switches, asegúrate de que el cliente también vuelva a evaluar en vez de guardar la decisión toda la sesión.")],
  [t("Your team has 40 flags, many at 100% for months. What's the risk, and what would you do?", "Tu equipo tiene 40 flags, muchos en 100% desde hace meses. ¿Cuál es el riesgo, y qué harías?"),
    t("Every flag is a branch in the code and a dimension in the test matrix. Old flags hide dead code, make bugs depend on flag combinations nobody tested, and a stray toggle can switch off something everyone relies on. Give each release flag an owner and an expiry, remove the flag and the old path once it's at 100%, and keep only long-lived operational flags (kill switches, limits) on purpose.", "Cada flag es una rama en el código y una dimensión más en la matriz de pruebas. Los flags viejos esconden código muerto, hacen que los bugs dependan de combinaciones de flags que nadie probó, y un cambio accidental puede apagar algo de lo que todos dependen. Dale a cada flag de lanzamiento un responsable y una fecha de vencimiento, elimina el flag y el camino viejo cuando llegue al 100%, y conserva a propósito solo los flags operativos de larga vida (kill switches, límites).")],
  [t("Is a feature flag a replacement for a canary deploy or a rollback?", "¿Un feature flag reemplaza a un despliegue canario (canary) o a un rollback?"),
    t("No, they cover different risks. A flag only protects the code it wraps; a bad dependency upgrade, a config change or a broken migration in the same deploy isn't behind any flag. Canaries and rollbacks protect the deploy itself; flags protect the release of a feature. Most teams use both.", "No, cubren riesgos distintos. Un flag solo protege el código que envuelve; una actualización mala de una dependencia, un cambio de configuración o una migración rota en el mismo despliegue no están detrás de ningún flag. Los canarios y los rollbacks protegen el despliegue en sí; los flags protegen el lanzamiento de una funcionalidad. La mayoría de los equipos usa ambos.")],
  [t("Where should flag evaluation happen, and what happens if the flag service is down?", "¿Dónde debería evaluarse un flag, y qué pasa si el servicio de flags está caído?"),
    t("Usually in the app, from a locally cached copy, so the flag service isn't on the request path. Every flag needs a safe default for when no copy is available (usually off for new features), and servers should keep using their last good copy rather than failing when the service is unreachable.", "Normalmente en la app, desde una copia en caché local, para que el servicio de flags no esté en el camino de cada solicitud. Cada flag necesita un valor por defecto seguro para cuando no hay copia disponible (normalmente apagado para funcionalidades nuevas), y los servidores deberían seguir usando su última copia buena en vez de fallar cuando el servicio no responde.")],
];

export default defineLesson({
  title: t("Feature Flag Workbench", "Banco de trabajo: feature flags"),
  eyebrow: t("Systems lesson 22 · Feature flags", "Lección de sistemas 22 · Feature flags"),
  lede: t("A feature flag ships new code switched off and lets you decide, at run time, who sees it. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.", "Un feature flag (interruptor de funcionalidad) publica código nuevo apagado y te deja decidir, en tiempo de ejecución, quién lo ve. Esta lección construye la idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y luego explícalo con tus palabras."),
  machine: {
    intro: t("The four stages are app servers that already have the new feature. Move the rollout, switch random and sticky, flip the kill switch, and watch each stage pick up the change only when its dial comes round.", "Los cuatro escenarios son servidores de la app que ya tienen la funcionalidad nueva. Mueve el lanzamiento (rollout), alterna entre aleatoria y fija, activa el kill switch (interruptor de emergencia) y mira cómo cada escenario toma el cambio solo cuando su dial da la vuelta."),
    plate: {
      title: t("Lighting console", "Consola de iluminación"),
      keys: [
        { mark: "lit", label: t("The new show: requests and lamps running the new feature", "El nuevo espectáculo: solicitudes y lámparas con la funcionalidad nueva") },
        { mark: "raised", label: t("Stages: four app servers, each with a cue card, its cached copy of the settings", "Escenarios: cuatro servidores de la app, cada uno con una tarjeta de señales, su copia en caché de la configuración") },
        { mark: "flat", label: t("Console: rollout fader, random/sticky toggle, targeting and refresh knobs, kill switch, flag bank", "Consola: deslizador de lanzamiento, selector aleatorio/fijo, perillas de segmentación y de actualización, kill switch, banco de flags") },
      ],
      caption:
        t("The new feature is already deployed on all four stages, dark. Requests ride the rail from the turnstile to a stage, which decides from its cue card whether to show the new version (lit) or the old one; a request that fails drops into the stage's bin. A stage only learns about a change on the console when its dial comes round and it fetches the settings along its cable.", "La funcionalidad nueva ya está desplegada en los cuatro escenarios, apagada. Las solicitudes viajan por el riel desde el torniquete hasta un escenario, que decide con su tarjeta de señales si muestra la versión nueva (encendida) o la vieja; una solicitud que falla cae en el cesto del escenario. Un escenario solo se entera de un cambio en la consola cuando su dial da la vuelta y trae la configuración por su cable."),
      stage: { "data-console": "" },
      label: t("Feature flag console simulation. Space pauses or resumes.", "Simulación de una consola de feature flags. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["requests", t("Requests", "Solicitudes")], ["share", t("On new version", "En versión nueva"), "–"], ["errors", t("Errors", "Errores")], ["both", t("Saw both versions", "Vieron ambas versiones")], ["behind", t("Servers behind", "Servidores atrasados")], ["combos", t("App versions live", "Versiones en vivo")]],
    controls: [
      { seg: "pct", label: t("Rollout", "Lanzamiento"), options: [[0, "0%"], [10, "10%"], [50, "50%"], [100, "100%"]], value: 10 },
      { seg: "sticky", label: t("Bucketing", "Asignación"), options: [["false", t("Random", "Aleatoria")], ["true", t("Sticky by user", "Fija por usuario")]], value: "true" },
      { seg: "staffFirst", label: t("Targeting", "Segmentación"), options: [["false", t("Everyone", "Todos")], ["true", t("Staff only", "Solo personal")]], value: "false" },
      { seg: "ttl", label: t("Settings refresh", "Actualización de config."), options: [[5, "5 s"], [30, "30 s"], [60, "60 s"]], value: 5 },
      { seg: "buggy", label: t("Feature", "Funcionalidad"), options: [["false", t("Works", "Funciona")], ["true", t("Buggy", "Con bug")]], value: "false" },
      { seg: "flags", label: t("Flags in use", "Flags en uso"), options: [[1, "1"], [3, "3"], [10, "10"]], value: 1 },
      { speed: true },
      { actions: [["kill", "Kill switch"], ["rollback", t("Redeploy old build", "Redesplegar build anterior")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs at 8 requests per second from 200 users.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados en ocho corridas con semilla, a 8 solicitudes por segundo de 200 usuarios."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css: `
.cue-fill{fill:var(--anatomy-mid);stroke:none}
.pulse{fill:var(--anatomy-lit);stroke:none}
[data-tokens] .tok{transition:none}
`,
  data: {
    P,
    G: GEOMETRY,
    CABLES: GEOMETRY.STAGES.map((_, i) => cablePoints(i)),
    TOKEN_SVG: tokenSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
