// @ts-nocheck: content ported as-is
// Systems lesson 23 · Health checks: a shopping street where readiness opens a shop's sign and liveness rebuilds it.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, tokenSvg, P, GEOMETRY } from "./figure";
import { scenario, average } from "./sim";
import { n0 } from "../../lib/format";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran these
// four-seed averages in the browser when a card was run; they are deterministic, so the numbers are the same).
const BASE = { load: 0.5 };
const readinessRun = (readiness) => average((seed) => { const { totals } = scenario({ ...BASE, readiness }, [[20, (s) => { s.restartShop(3); s.restartShop(4); }]], 90, seed); return { errors: totals.errors, arrived: totals.arrived }; });
const depsRun = (liveness, readiness) => average((seed) => { const { sim, totals } = scenario({ ...BASE, liveness, readiness }, [[20, (s) => s.blip(30)]], 240, seed); return { errors: totals.errors, restarts: totals.restarts, back: (sim.recovered ?? 240) - 50 }; });
const timeoutRun = (timeout) => average((seed) => { const { totals } = scenario({ load: 0.9, timeout }, [], 300, seed); return { errors: totals.errors, restarts: totals.restarts }; });
const startupRun = (startupProbe) => average((seed) => { const { sim, totals } = scenario({ ...BASE, boot: 60, startupProbe }, [[5, (s) => s.restartShop(2)]], 300, seed); return { restarts: totals.restarts, back: (sim.recovered ?? 300) - 5 }; });
const deadlockRun = (liveness, readiness) => average((seed) => { const { sim, totals } = scenario({ ...BASE, liveness, readiness }, [[20, (s) => s.deadlock(2)]], 180, seed); return { errors: totals.errors, back: (sim.recovered ?? 180) - 20 }; });
const RESULTS = {
  readiness: { off: readinessRun("off"), on: readinessRun("shop") },
  deps: { live: depsRun("deps", "shop"), ready: depsRun("shop", "deps") },
  timeout: { loose: timeoutRun(5), tight: timeoutRun(1) },
  startup: { none: startupRun(false), probe: startupRun(true) },
  deadlock: { neither: deadlockRun("off", "off"), ready: deadlockRun("off", "shop"), both: deadlockRun("shop", "shop") },
};

// What each card shows after a run.
const r = n0;
const top = (...xs) => Math.max(1, ...xs);
const RUNS = {
  readiness: () => {
    const { off, on } = RESULTS.readiness, m = top(off.errors, on.errors);
    return { verdict: t("Errors over the 70 s after the deploy: " + r(off.errors) + " of about " + r(off.arrived * 70 / 90) + " customers without a readiness probe, " + r(on.errors) + " with one.",
        "Errores en los 70 s después del despliegue: " + r(off.errors) + " de unos " + r(off.arrived * 70 / 90) + " clientes sin sonda de readiness, " + r(on.errors) + " con una."),
      bars: [[t("No readiness", "Sin readiness"), off.errors / m, String(r(off.errors)), true], [t("Readiness", "Con readiness"), on.errors / m, String(r(on.errors))]] };
  },
  deps: () => {
    const { live, ready } = RESULTS.deps, m = top(live.back, ready.back);
    return { verdict: t("All five shops open again " + live.back.toFixed(0) + " s after the warehouse is back when liveness checks it (" + r(live.restarts) + " restarts), " + ready.back.toFixed(0) + " s when only readiness does (" + r(ready.restarts) + " restarts).",
        "Las cinco tiendas vuelven a abrir " + live.back.toFixed(0) + " s después de que vuelve el almacén cuando lo revisa liveness (" + r(live.restarts) + " reinicios), y " + ready.back.toFixed(0) + " s cuando solo lo revisa readiness (" + r(ready.restarts) + " reinicios)."),
      bars: [[t("Liveness: warehouse", "Liveness: almacén"), live.back / m, live.back.toFixed(0) + " s", true], [t("Readiness: warehouse", "Readiness: almacén"), ready.back / m, ready.back.toFixed(0) + " s"], [t("Errors, liveness", "Errores, liveness"), live.errors / top(live.errors, ready.errors), String(r(live.errors)), true], [t("Errors, readiness", "Errores, readiness"), ready.errors / top(live.errors, ready.errors), String(r(ready.errors))]] };
  },
  timeout: () => {
    const { loose, tight } = RESULTS.timeout, m = top(loose.restarts, tight.restarts), e = top(loose.errors, tight.errors);
    return { verdict: t("In 5 minutes at 90% traffic: " + tight.restarts.toFixed(1) + " restarts and " + r(tight.errors) + " errors with a 1 s timeout, " + loose.restarts.toFixed(1) + " restarts and " + r(loose.errors) + " errors with 5 s.",
        "En 5 minutos con tráfico al 90%: " + tight.restarts.toFixed(1) + " reinicios y " + r(tight.errors) + " errores con un tiempo límite de 1 s, " + loose.restarts.toFixed(1) + " reinicios y " + r(loose.errors) + " errores con 5 s."),
      bars: [[t("Restarts, 1 s", "Reinicios, 1 s"), tight.restarts / m, tight.restarts.toFixed(1), true], [t("Restarts, 5 s", "Reinicios, 5 s"), loose.restarts / m, loose.restarts.toFixed(1)], [t("Errors, 1 s", "Errores, 1 s"), tight.errors / e, String(r(tight.errors)), true], [t("Errors, 5 s", "Errores, 5 s"), loose.errors / e, String(r(loose.errors))]] };
  },
  startup: () => {
    const { none, probe } = RESULTS.startup, m = top(none.back, probe.back);
    const never = none.back >= 295;
    return { verdict: t("Without a startup probe the shop was restarted " + none.restarts.toFixed(0) + " times and " + (never ? "never opened in 5 minutes" : "opened after " + none.back.toFixed(0) + " s") + ". With one it opened after " + probe.back.toFixed(0) + " s, with " + probe.restarts.toFixed(0) + " restarts.",
        "Sin sonda de arranque la tienda se reinició " + none.restarts.toFixed(0) + " veces y " + (never ? "nunca abrió en 5 minutos" : "abrió después de " + none.back.toFixed(0) + " s") + ". Con una abrió después de " + probe.back.toFixed(0) + " s, con " + probe.restarts.toFixed(0) + " reinicios."),
      bars: [[t("No startup probe", "Sin sonda de arranque"), none.back / m, never ? t("never", "nunca") : none.back.toFixed(0) + " s", true], [t("Startup probe", "Con sonda de arranque"), probe.back / m, probe.back.toFixed(0) + " s"]] };
  },
  deadlock: () => {
    const { neither, ready, both } = RESULTS.deadlock, m = 160, e = top(neither.errors, ready.errors, both.errors);
    const label = (x) => (x >= 159 ? t("never", "nunca") : t(x.toFixed(0) + " s", x.toFixed(0) + " s"));
    return { verdict: t("Over 160 s: no probes, " + r(neither.errors) + " errors and shop 3 never recovers; readiness only, " + r(ready.errors) + " errors and it never recovers; readiness and liveness, " + r(both.errors) + " errors and it is back after " + label(both.back).en + ".",
        "En 160 s: sin sondas, " + r(neither.errors) + " errores y la tienda 3 nunca se recupera; solo readiness, " + r(ready.errors) + " errores y nunca se recupera; readiness y liveness, " + r(both.errors) + " errores y vuelve después de " + label(both.back).es + "."),
      bars: [[t("Back: readiness only", "Vuelve: solo readiness"), ready.back / m, label(ready.back), true], [t("Back: + liveness", "Vuelve: + liveness"), both.back / m, label(both.back)], [t("Errors: no probes", "Errores: sin sondas"), neither.errors / e, String(r(neither.errors))], [t("Errors: readiness", "Errores: readiness"), ready.errors / e, String(r(ready.errors)), true]] };
  },
};

// ---------- content ----------
const EXPERIMENTS = [
  {
    id: "readiness",
    title: t("No readiness probe", "Sin sonda de readiness"),
    change: t("A deploy restarts shops 4 and 5 under steady traffic · readiness probe on → off", "Un despliegue reinicia las tiendas 4 y 5 con tráfico constante · sonda de readiness sí → no"),
    question: t("Each restarted shop takes 12 s to open its doors and 10 s to stock its shelves. Without a readiness probe, what do customers see?", "Cada tienda reiniciada tarda 12 s en abrir sus puertas y 10 s en llenar sus estantes. Sin una sonda de readiness, ¿qué ven los clientes?"),
    options: [t("Nothing: the shop is only restarting, it isn't broken", "Nada: la tienda solo se está reiniciando, no está rota"), t("Errors until each new shop is fully stocked", "Errores hasta que cada tienda nueva esté completamente abastecida"), t("Errors only for the first second", "Errores solo durante el primer segundo")],
    answer: 1,
    why: t("Without a readiness probe, Kubernetes adds a pod to the service as soon as its container starts. The warden sends customers to a shop whose doors aren't open yet (connection refused) and then to empty shelves (cold caches, no connections). A readiness probe that only says yes once the shop can really serve keeps it off the list until then. Lesson 10, Rolling deploys, shows what this does to a whole rollout.", "Sin una sonda de readiness, Kubernetes agrega un pod al service en cuanto arranca su contenedor. El agente de tránsito manda clientes a una tienda que todavía no abrió sus puertas (conexión rechazada) y después a estantes vacíos (cachés frías, sin conexiones). Una sonda de readiness que solo dice que sí cuando la tienda de verdad puede atender la deja fuera de la lista hasta entonces. La lección 10, Despliegues graduales, muestra lo que esto le hace a un despliegue completo."),
    watch: { readiness: "off", liveness: "shop", timeout: 5, threshold: 3, boot: 12, startupProbe: "false", load: 0.5, act: "restart" },
  },
  {
    id: "deps",
    title: t("Liveness checks the warehouse", "Liveness revisa el almacén"),
    change: t("The warehouse (database) is down for 30 s · liveness checks the warehouse vs readiness checks it", "El almacén (la base de datos) cae por 30 s · liveness revisa el almacén vs lo revisa readiness"),
    question: t("With the liveness probe checking the warehouse, when is the street fully open again?", "Con la sonda de liveness revisando el almacén, ¿cuándo vuelve a estar abierta toda la calle?"),
    options: [t("As soon as the warehouse is back up", "En cuanto vuelve el almacén"), t("Long after: every shop is rebuilt first", "Mucho después: antes se reconstruye cada tienda"), t("Never, until someone steps in", "Nunca, hasta que alguien intervenga")],
    answer: 1,
    why: t("Restarting a shop can't fix a warehouse. When liveness depends on it, every inspector sees the same failure at the same time and rebuilds every shop at once. The warehouse comes back to a street of scaffolding, and shops that restart again get a growing back-off. Checking the warehouse in readiness only takes shops off the warden's list for the duration and puts them back as soon as it returns.", "Reiniciar una tienda no puede arreglar un almacén. Cuando liveness depende de él, todos los inspectores ven la misma falla al mismo tiempo y reconstruyen todas las tiendas a la vez. El almacén vuelve y encuentra una calle llena de andamios, y las tiendas que se reinician otra vez reciben una espera creciente (back-off). Revisar el almacén en readiness solo saca las tiendas de la lista del agente mientras dura, y las devuelve en cuanto vuelve."),
    watch: { readiness: "shop", liveness: "deps", timeout: 5, threshold: 3, boot: 12, startupProbe: "false", load: 0.5, act: "blip" },
  },
  {
    id: "timeout",
    title: t("A tight timeout on a busy street", "Un tiempo límite ajustado en una calle llena"),
    change: t("Traffic at 90% of capacity · liveness timeout 5 s → 1 s", "Tráfico al 90% de la capacidad · tiempo límite (timeout) de liveness 5 s → 1 s"),
    question: t("The shops are slow but healthy: probes wait in the same queue as customers. What does a 1 s liveness timeout do?", "Las tiendas están lentas pero sanas: las sondas esperan en la misma cola que los clientes. ¿Qué hace un tiempo límite de liveness de 1 s?"),
    options: [t("Nothing: a healthy shop always answers its inspector", "Nada: una tienda sana siempre le responde a su inspector"), t("It restarts healthy shops, and the others get busier", "Reinicia tiendas sanas, y las demás se llenan más"), t("It makes the street faster by restarting slow shops", "Hace más rápida la calle al reiniciar las tiendas lentas")],
    answer: 1,
    why: t("A busy shop answers its inspector late, not never. With a 1 s timeout, three late answers in a row look like a dead shop, so it gets rebuilt. Its queue is lost, and its customers move to the other shops, which become even busier and miss their own checks. Give liveness a generous timeout and threshold: it should catch a process that is truly stuck, not one that is busy. Note that 1 s is Kubernetes' default timeoutSeconds, so this is what you get if you don't set it.", "Una tienda llena le responde tarde a su inspector, no nunca. Con un tiempo límite de 1 s, tres respuestas tardías seguidas parecen una tienda muerta, así que se reconstruye. Su cola se pierde, y sus clientes pasan a las otras tiendas, que se llenan todavía más y fallan sus propios chequeos. Dale a liveness un tiempo límite y un umbral generosos: debe atrapar un proceso realmente atascado, no uno ocupado. Ojo: 1 s es el timeoutSeconds por defecto de Kubernetes, así que esto es lo que tienes si no lo configuras."),
    watch: { readiness: "shop", liveness: "shop", timeout: 1, threshold: 3, boot: 12, startupProbe: "false", load: 0.9 },
  },
  {
    id: "startup",
    title: t("A slow start", "Un arranque lento"),
    change: t("A shop takes 60 s to open its doors · liveness starts checking 10 s after start · no startup probe vs a startup probe", "Una tienda tarda 60 s en abrir sus puertas · liveness empieza a revisar 10 s después del arranque · sin sonda de arranque (startup probe) vs con una"),
    question: t("Without a startup probe, when is the restarted shop ready?", "Sin una sonda de arranque, ¿cuándo está lista la tienda reiniciada?"),
    options: [t("After about 70 s, like any slow shop", "Después de unos 70 s, como cualquier tienda lenta"), t("Never: liveness keeps killing it", "Nunca: liveness la sigue matando"), t("After 70 s, but with a few errors first", "Después de 70 s, pero con algunos errores antes")],
    answer: 1,
    why: t("Liveness starts checking 10 s after the container starts and gives up after three failures, about 20 s in. A shop that needs 60 s is killed every time, and the back-off between attempts keeps growing: a crash loop. A startup probe holds liveness and readiness back until the shop answers once (here allowing up to 120 s), then normal checks take over.", "Liveness empieza a revisar 10 s después de que arranca el contenedor y se rinde tras tres fallas, a los 20 s más o menos. Una tienda que necesita 60 s muere cada vez, y la espera entre intentos sigue creciendo: un bucle de caídas (crash loop). Una sonda de arranque frena a liveness y readiness hasta que la tienda responde una vez (aquí permite hasta 120 s), y luego toman el control los chequeos normales."),
    watch: { readiness: "shop", liveness: "shop", timeout: 5, threshold: 3, boot: 60, startupProbe: "false", load: 0.5, act: "restart1" },
  },
  {
    id: "deadlock",
    title: t("A jammed shop", "Una tienda atascada"),
    change: t("Shop 3 jams: its doors are open but nobody answers · readiness only vs readiness and liveness", "La tienda 3 se atasca: sus puertas están abiertas pero nadie responde · solo readiness vs readiness y liveness"),
    question: t("With only a readiness probe, what happens to shop 3?", "Con solo una sonda de readiness, ¿qué pasa con la tienda 3?"),
    options: [t("It leaves the list, then recovers on its own", "Sale de la lista y luego se recupera sola"), t("Errors stop, but it stays jammed for good", "Los errores paran, pero sigue atascada para siempre"), t("Neither probe notices: it still looks open", "Ninguna sonda lo nota: sigue pareciendo abierta")],
    answer: 1,
    why: t("Readiness only decides whether customers are sent there. The jammed shop drops off the warden's list, so errors stop, but nothing ever fixes it: you run on four shops until someone notices. Liveness exists for exactly this: a process that is stuck in a way only a restart can fix.", "Readiness solo decide si se mandan clientes ahí. La tienda atascada sale de la lista del agente, así que los errores paran, pero nada la arregla nunca: funcionas con cuatro tiendas hasta que alguien lo nota. Liveness existe justo para esto: un proceso atascado de una forma que solo un reinicio puede arreglar."),
    watch: { readiness: "shop", liveness: "off", timeout: 5, threshold: 3, boot: 12, startupProbe: "false", load: 0.5, act: "jam" },
  },
];

const QUESTIONS = [
  [t("In one sentence each: what does a readiness probe decide, and what does a liveness probe decide?", "En una oración cada una: ¿qué decide una sonda de readiness (readiness probe) y qué decide una sonda de liveness (liveness probe)?"),
    t("Readiness decides whether the pod gets traffic: failing removes it from the service's endpoints, and nothing is restarted. Liveness decides whether the container should be killed and restarted: failing it enough times restarts the container. Readiness is \"not right now\"; liveness is \"this is broken and a restart will fix it\".", "Readiness (disponibilidad) decide si el pod recibe tráfico: fallar lo saca de los endpoints del service, y no se reinicia nada. Liveness (vitalidad) decide si hay que matar y reiniciar el contenedor: fallarla suficientes veces reinicia el contenedor. Readiness es \"ahora no\"; liveness es \"esto está roto y un reinicio lo va a arreglar\".")],
  [t("Your liveness probe calls the database. Why is that dangerous?", "Tu sonda de liveness llama a la base de datos. ¿Por qué es peligroso?"),
    t("A database outage makes every pod's liveness fail at once, so Kubernetes restarts all of them. The database comes back to pods that are still booting and warming up, repeated failures add back-off, and a short blip becomes a long outage. Liveness should only check things a restart of this container can fix; put dependency checks in readiness (or nowhere).", "Una caída de la base de datos hace fallar la liveness de todos los pods a la vez, así que Kubernetes los reinicia a todos. La base de datos vuelve y encuentra pods que todavía están arrancando y calentándose, las fallas repetidas suman back-off, y un corte breve se vuelve una caída larga. Liveness solo debe revisar cosas que un reinicio de este contenedor pueda arreglar; pon los chequeos de dependencias en readiness (o en ningún lado).")],
  [t("What should a readiness probe check, and is it ever wrong to include a dependency?", "¿Qué debería revisar una sonda de readiness, y alguna vez está mal incluir una dependencia?"),
    t("That this pod can serve right now: it has started, finished warming up and isn't overloaded. Including a dependency every pod shares means one outage makes every pod unready, so the service has no endpoints left: callers get connection refused, or a 503 from the ingress or gateway in front of it. That's sometimes what you want (fail fast and clearly); a service that can serve degraded responses should stay ready and handle the error instead.", "Que este pod pueda atender ahora mismo: arrancó, terminó de calentarse y no está sobrecargado. Incluir una dependencia que comparten todos los pods hace que una sola caída deje a todos sin readiness, así que el service se queda sin endpoints: quien llama recibe conexión rechazada, o un 503 del ingress o gateway que tiene delante. A veces eso es lo que quieres (fallar rápido y claro); un servicio que puede dar respuestas degradadas debería seguir listo y manejar el error.")],
  [t("An app takes 90 s to start. How would you configure its probes?", "Una app tarda 90 s en arrancar. ¿Cómo configurarías sus sondas?"),
    t("Add a startup probe with periodSeconds × failureThreshold comfortably above 90 s, say 10 s × 15 = 150 s. Liveness and readiness don't run until it passes, so liveness can keep a short, sensible period for catching hangs later. Avoid the old workaround of a huge initialDelaySeconds on liveness, which also delays detecting a real hang after a restart.", "Agrega una sonda de arranque con periodSeconds × failureThreshold bastante por encima de 90 s, por ejemplo 10 s × 15 = 150 s. Liveness y readiness no se ejecutan hasta que pasa, así que liveness puede mantener un periodo corto y razonable para detectar cuelgues después. Evita el viejo truco de un initialDelaySeconds enorme en liveness, que también retrasa la detección de un cuelgue real después de un reinicio.")],
  [t("Under heavy load your pods keep restarting, and the liveness timeout is 1 s. What is going on, and what would you change?", "Con mucha carga tus pods se reinician una y otra vez, y el tiempo límite de liveness es de 1 s. ¿Qué está pasando, y qué cambiarías?"),
    t("Probes queue behind real requests, so busy pods answer late and get killed as if they were dead. Each restart loses work and moves load onto the remaining pods, which then miss their checks too: a restart storm. Raise the timeout and failure threshold, answer health checks outside the request queue (a separate lightweight handler or port), and fix the real capacity problem.", "Las sondas hacen cola detrás de las solicitudes reales, así que los pods ocupados responden tarde y los matan como si estuvieran muertos. Cada reinicio pierde trabajo y pasa carga a los pods que quedan, que luego también fallan sus chequeos: una tormenta de reinicios (restart storm). Sube el tiempo límite y el umbral de fallas, responde los chequeos de salud fuera de la cola de solicitudes (un handler o puerto aparte y liviano) y arregla el problema real de capacidad.")],
  [t("If readiness already removes broken pods from traffic, why have a liveness probe at all?", "Si readiness ya saca del tráfico a los pods rotos, ¿para qué tener una sonda de liveness?"),
    t("Because readiness never repairs anything. A deadlocked or wedged process fails readiness forever and you quietly run with less capacity. Liveness restarts it. The two answer different questions, so many apps need both, but each must check the right thing.", "Porque readiness nunca repara nada. Un proceso en deadlock o trabado falla readiness para siempre y sigues funcionando en silencio con menos capacidad. Liveness lo reinicia. Las dos responden preguntas distintas, así que muchas apps necesitan ambas, pero cada una tiene que revisar lo correcto.")],
];

export default defineLesson({
  title: t("Health Probe Workbench", "Banco de trabajo: sondas de salud"),
  eyebrow: t("Systems lesson 23 · Health checks", "Lección de sistemas 23 · Chequeos de salud"),
  lede: t("Kubernetes can ask each container two different questions: can you take traffic right now (readiness), and are you so broken that only a restart will help (liveness)? Mixing them up turns small problems into outages. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.", "Kubernetes le puede hacer a cada contenedor dos preguntas distintas: ¿puedes recibir tráfico ahora mismo? (readiness, disponibilidad) y ¿estás tan roto que solo un reinicio te va a ayudar? (liveness, vitalidad). Confundirlas convierte problemas pequeños en caídas. Esta lección construye la idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y luego explícalo con tus palabras."),
  machine: {
    intro: t("Each shop is a pod. Its open sign is the readiness probe, its inspector is the liveness probe, and the warden only sends customers to shops whose peg is up. Take the warehouse down, jam a shop or redeploy two, then change what the probes check.", "Cada tienda es un pod. Su letrero de abierto es la sonda de readiness (readiness probe), su inspector es la sonda de liveness (liveness probe), y el agente de tránsito solo manda clientes a las tiendas con la clavija arriba. Haz caer el almacén, atasca una tienda o redespliega dos, y luego cambia lo que revisan las sondas."),
    plate: {
      title: t("Shopping street", "Calle comercial"),
      keys: [
        { mark: "lit", label: t("Open sign raised and the warden's peg up: the shop is ready and gets customers (a lowered grey sign is closed)", "Letrero de abierto arriba y clavija del agente arriba: la tienda está lista y recibe clientes (un letrero gris abajo es cerrado)") },
        { mark: "raised", label: t("Inspector's board: top slots are failed checks in a row, bottom pips are restarts", "Tablero del inspector: las ranuras de arriba son chequeos fallidos seguidos, los puntos de abajo son reinicios") },
        { mark: "flat", label: t("Supply pipes: every shop draws from the one warehouse", "Tubos de suministro: todas las tiendas se abastecen del mismo almacén") },
      ],
      caption:
        t("Each shop is a pod. When its readiness probe passes, its open sign goes up and lights, and the warden raises that shop's peg on the kiosk roof (the service's endpoint list); customers only walk to shops with a peg up, and turned-away customers walk back faint. Each shop's inspector checks it every 3 s, fills a slot for each failure in a row, and when the slots are full has the shop torn down and rebuilt: scaffolding, then the store shutter while it starts, then crates while it restocks, with a pip added for every restart. A bar across a door means the shop is jammed. The warehouse behind is the shared database; its roller door comes down when it is out of action. When the page opens, shop 2 is being rebuilt, shop 3 is jammed and shop 4 is restocking.", "Cada tienda es un pod. Cuando pasa su sonda de readiness, su letrero de abierto sube y se enciende, y el agente de tránsito levanta la clavija de esa tienda en el techo de la caseta (la lista de endpoints del service); los clientes solo caminan a tiendas con la clavija arriba, y los rechazados vuelven atenuados. El inspector de cada tienda la revisa cada 3 s, llena una ranura por cada falla seguida y, cuando las ranuras se llenan, manda demoler y reconstruir la tienda: andamios, luego la cortina cerrada mientras arranca, luego cajas mientras se reabastece, con un punto más por cada reinicio. Una barra cruzada en la puerta significa que la tienda está atascada. El almacén del fondo es la base de datos compartida; su cortina baja cuando está fuera de servicio. Cuando se abre la página, la tienda 2 está en reconstrucción, la 3 atascada y la 4 reabasteciéndose."),
      stage: { "data-office": "" },
      label: t("Health probe simulation. Space pauses or resumes.", "Simulación de sondas de salud. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["served", t("Served", "Atendidos")], ["errors", t("Errors", "Errores")], ["restarts", t("Restarts", "Reinicios")], ["ready", t("Shops open", "Tiendas abiertas"), "5 / 5"], ["rate", t("Errors, last 10 s", "Errores, últimos 10 s"), "0%"], ["recover", t("Back to normal in", "Normalidad en"), "–"]],
    controls: [
      { seg: "readiness", label: t("Readiness probe checks", "La sonda de readiness revisa"), options: [["off", t("No probe", "Sin sonda")], ["shop", t("The shop", "La tienda")], ["deps", t("Shop + warehouse", "Tienda + almacén")]], value: "shop" },
      { seg: "liveness", label: t("Liveness probe checks", "La sonda de liveness revisa"), options: [["off", t("No probe", "Sin sonda")], ["shop", t("The shop", "La tienda")], ["deps", t("Shop + warehouse", "Tienda + almacén")]], value: "shop" },
      { seg: "timeout", label: t("Liveness timeout", "Tiempo límite de liveness"), options: [[1, "1 s"], [5, "5 s"]], value: 5 },
      { seg: "threshold", label: t("Restart after", "Reiniciar tras"), options: [[1, t("1 failure", "1 falla")], [3, t("3 in a row", "3 seguidas")]], value: 3 },
      { seg: "boot", label: t("Shop start-up", "Arranque de la tienda"), options: [[12, "12 s"], [60, "60 s"]], value: 12 },
      { seg: "startupProbe", label: t("Startup probe", "Sonda de arranque"), options: [["false", t("Off", "No")], ["true", t("On", "Sí")]], value: "false" },
      { seg: "load", label: t("Traffic", "Tráfico"), options: [[0.5, "50%"], [0.9, "90%"]], value: 0.5 },
      { speed: true },
      { actions: [["blip", t("Warehouse down 30 s", "Almacén caído 30 s")], ["jam", t("Jam shop 3", "Atascar tienda 3")], ["restart", t("Redeploy shops 4, 5", "Redesplegar tiendas 4 y 5")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over four seeded runs; probes run every 3 s.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados en cuatro ejecuciones con semilla; las sondas se ejecutan cada 3 s."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
.tally-fill{fill:var(--anatomy-hi);stroke:none}
`,
  data: {
    TITLES: Object.fromEntries(EXPERIMENTS.map(({ id, title }) => [id, title])),
    P,
    G: GEOMETRY,
    TOKEN_SVG: tokenSvg(),
  },
});
