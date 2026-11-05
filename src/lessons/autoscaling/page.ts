// @ts-nocheck: content in the lessons' plain-JS style
// Systems lesson 75 · Autoscaling: a service floor whose autoscaler adds and sends home workers.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, one, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, customerSvg, walkerSvg, P, GEOMETRY, FIGURE_CSS } from "./figure";
import { startupRun, targetRun, flapRun, floorRun, dbRun, SPIKE, FLOOR, DBRUN, PATIENCE, SYNC, READ_WINDOW, MAX_R, SEEDS, KNEE } from "./sim";

// Experiment results, computed at build time from the same model the page runs (twelve seeds each).
const RESULTS = { startup: startupRun(), target: targetRun(), flap: flapRun(), floor: floorRun(), db: dbRun() };

const mins = (s) => n0(s / 60);
const pc = (x) => (x > 0 && x < 0.01 ? "<1%" : pct(x));
const more = (a, b) => n0((a / b - 1) * 100) + "%";

// What each card shows after a run.
const RUNS = {
  startup: () => {
    const { fast, slow } = RESULTS.startup, top = Math.max(fast.errors, slow.errors, 1);
    return {
      verdict: t("Ready in 10 s: " + n0(fast.errors) + " of " + n0(fast.arrived) + " customers in the spike gave up (" + pc(fast.share) + "), and the give-ups were over " + n0(fast.recover) + " s after it began. Ready in 120 s: " + n0(slow.errors) + " gave up (" + pc(slow.share) + "), for " + n0(slow.recover) + " s. A minute into the spike, " + one(fast.readyAt60) + " workers were serving with 10 s start-ups and " + one(slow.readyAt60) + " with 120 s ones.",
        "Listos en 10 s: " + n0(fast.errors) + " de " + n0(fast.arrived) + " clientes del pico se rindieron (" + pc(fast.share) + "), y los abandonos terminaron " + n0(fast.recover) + " s después de que empezó. Listos en 120 s: se rindieron " + n0(slow.errors) + " (" + pc(slow.share) + "), durante " + n0(slow.recover) + " s. Un minuto después del inicio del pico atendían " + one(fast.readyAt60) + " trabajadores con arranques de 10 s y " + one(slow.readyAt60) + " con arranques de 120 s."),
      bars: [
        [t("Gave up, ready in 10 s", "Abandonos, listos en 10 s"), fast.errors / top, n0(fast.errors)],
        [t("Gave up, ready in 120 s", "Abandonos, listos en 120 s"), slow.errors / top, n0(slow.errors), true],
        [t("Give-ups lasted, 120 s (of 5 min)", "Duración de los abandonos, 120 s (de 5 min)"), Math.min(1, slow.recover / 300), n0(slow.recover) + " s", true],
      ],
    };
  },
  target: () => {
    const { t60, t90 } = RESULTS.target, top = Math.max(t60.errors, t90.errors, 1);
    return {
      verdict: t("Target 60%: " + one(t60.before) + " workers before the spike, " + n0(t60.errors) + " customers gave up (" + pc(t60.share) + "), " + n0(t60.podMin) + " pod-minutes in all. Target 90%: " + one(t90.before) + " workers before it, " + n0(t90.errors) + " gave up (" + pc(t90.share) + ") over " + n0(t90.recover) + " s, never more than " + one(t90.peakPods) + " workers at once, " + n0(t90.podMin) + " pod-minutes.",
        "Objetivo 60%: " + one(t60.before) + " trabajadores antes del pico, " + n0(t60.errors) + " clientes se rindieron (" + pc(t60.share) + "), " + n0(t60.podMin) + " minutos de pod en total. Objetivo 90%: " + one(t90.before) + " trabajadores antes, " + n0(t90.errors) + " se rindieron (" + pc(t90.share) + ") durante " + n0(t90.recover) + " s, nunca más de " + one(t90.peakPods) + " trabajadores a la vez, " + n0(t90.podMin) + " minutos de pod."),
      bars: [
        [t("Gave up, target 60%", "Abandonos, objetivo 60%"), t60.errors / top, n0(t60.errors)],
        [t("Gave up, target 90%", "Abandonos, objetivo 90%"), t90.errors / top, n0(t90.errors), true],
        [t("Pod-minutes, 60%", "Minutos de pod, 60%"), t60.podMin / Math.max(t60.podMin, t90.podMin), n0(t60.podMin)],
        [t("Pod-minutes, 90%", "Minutos de pod, 90%"), t90.podMin / Math.max(t60.podMin, t90.podMin), n0(t90.podMin)],
      ],
    };
  },
  flap: () => {
    const { w0, w300 } = RESULTS.flap, top = Math.max(w0.started, w300.started, 1);
    return {
      verdict: t("Window 0 s: " + n0(w0.started) + " workers started in 30 minutes (" + n0(w0.ups) + " scale-ups, " + n0(w0.downs) + " scale-downs), " + n0(w0.errors) + " customers gave up (" + pc(w0.share) + "), " + n0(w0.podMin) + " pod-minutes. Window 300 s: " + n0(w300.started) + " started, " + n0(w300.errors) + " gave up, " + n0(w300.podMin) + " pod-minutes (" + more(w300.podMin, w0.podMin) + " more).",
        "Ventana de 0 s: arrancaron " + n0(w0.started) + " trabajadores en 30 minutos (" + n0(w0.ups) + " aumentos, " + n0(w0.downs) + " reducciones), " + n0(w0.errors) + " clientes se rindieron (" + pc(w0.share) + "), " + n0(w0.podMin) + " minutos de pod. Ventana de 300 s: arrancaron " + n0(w300.started) + ", se rindieron " + n0(w300.errors) + ", " + n0(w300.podMin) + " minutos de pod (" + more(w300.podMin, w0.podMin) + " más)."),
      bars: [
        [t("Workers started, window 0 s", "Trabajadores arrancados, ventana 0 s"), w0.started / top, n0(w0.started), true],
        [t("Workers started, window 300 s", "Trabajadores arrancados, ventana 300 s"), w300.started / top, n0(w300.started)],
        [t("Gave up, window 0 s (of 20%)", "Abandonos, ventana 0 s (de 20%)"), Math.min(1, w0.share / 0.2), pc(w0.share), true],
        [t("Gave up, window 300 s (of 20%)", "Abandonos, ventana 300 s (de 20%)"), Math.min(1, w300.share / 0.2), pc(w300.share)],
      ],
    };
  },
  floor: () => {
    const { none, floor } = RESULTS.floor, top = Math.max(none.errors, floor.errors, 1);
    return {
      verdict: t("minReplicas 2 all along: " + n0(none.errors) + " customers gave up in the launch (" + pc(none.share) + "), " + n0(none.podMin) + " pod-minutes. A floor of " + FLOOR.min + " from 3 minutes before: " + n0(floor.errors) + " gave up, 95% were served within " + one(floor.p95) + " s, " + n0(floor.podMin) + " pod-minutes (" + more(floor.podMin, none.podMin) + " more).",
        "minReplicas 2 todo el tiempo: " + n0(none.errors) + " clientes se rindieron en el lanzamiento (" + pc(none.share) + "), " + n0(none.podMin) + " minutos de pod. Un piso de " + FLOOR.min + " desde 3 minutos antes: se rindieron " + n0(floor.errors) + ", el 95% fue atendido en menos de " + one(floor.p95) + " s, " + n0(floor.podMin) + " minutos de pod (" + more(floor.podMin, none.podMin) + " más)."),
      bars: [
        [t("Gave up, min 2", "Abandonos, mínimo 2"), none.errors / top, n0(none.errors), true],
        [t("Gave up, floor of " + FLOOR.min, "Abandonos, piso de " + FLOOR.min), floor.errors / top, n0(floor.errors)],
        [t("Pod-minutes, min 2", "Minutos de pod, mínimo 2"), none.podMin / Math.max(none.podMin, floor.podMin), n0(none.podMin)],
        [t("Pod-minutes, floor of " + FLOOR.min, "Minutos de pod, piso de " + FLOOR.min), floor.podMin / Math.max(none.podMin, floor.podMin), n0(floor.podMin)],
      ],
    };
  },
  db: () => {
    const { cpu, busy } = RESULTS.db, top = Math.max(cpu.errors, busy.errors, 1);
    return {
      verdict: t("Scale on CPU: it stayed at " + one(cpu.pods) + " workers, each query ran " + one(cpu.slow) + "× slower than on a quiet database, " + one(cpu.tput) + " customers a second were served and " + n0(cpu.errors) + " of " + n0(cpu.arrived) + " gave up (" + pc(cpu.share) + "). Scale on busy workers: " + one(busy.pods) + " workers, queries " + one(busy.slow) + "× slower, " + one(busy.tput) + " a second served, " + n0(busy.errors) + " gave up (" + pc(busy.share) + "), and " + n0(busy.podMin) + " pod-minutes instead of " + n0(cpu.podMin) + ".",
        "Escalar por CPU: se quedó en " + one(cpu.pods) + " trabajadores, cada consulta corrió " + one(cpu.slow) + " veces más lenta que en una base de datos tranquila, se atendieron " + one(cpu.tput) + " clientes por segundo y se rindieron " + n0(cpu.errors) + " de " + n0(cpu.arrived) + " (" + pc(cpu.share) + "). Escalar por trabajadores ocupados: " + one(busy.pods) + " trabajadores, consultas " + one(busy.slow) + " veces más lentas, " + one(busy.tput) + " atendidos por segundo, " + n0(busy.errors) + " abandonos (" + pc(busy.share) + "), y " + n0(busy.podMin) + " minutos de pod en lugar de " + n0(cpu.podMin) + "."),
      bars: [
        [t("Served a second, scale on CPU", "Atendidos por segundo, por CPU"), cpu.tput / 5, one(cpu.tput)],
        [t("Served a second, scale on busy", "Atendidos por segundo, por ocupados"), busy.tput / 5, one(busy.tput), true],
        [t("Gave up, scale on CPU", "Abandonos, por CPU"), cpu.errors / top, n0(cpu.errors)],
        [t("Gave up, scale on busy", "Abandonos, por ocupados"), busy.errors / top, n0(busy.errors), true],
      ],
    };
  },
};

const { t60, t90 } = RESULTS.target;
const SAT90 = 1 / 0.9, ASK90 = Math.ceil(t90.before * SAT90 - 1e-9);
const SPIKE_CHANGE = t("Traffic " + SPIKE.base + " → " + SPIKE.peak + " a second for " + SPIKE.for / 60 + " minutes", "Tráfico de " + SPIKE.base + " → " + SPIKE.peak + " por segundo durante " + SPIKE.for / 60 + " minutos");

const EXPERIMENTS = [
  {
    id: "startup",
    title: t("A spike, and workers that take a while to start", "Un pico, y trabajadores que tardan en arrancar"),
    change: t(SPIKE_CHANGE.en + " · target 60% CPU · a new worker is ready 10 s after it's created vs after 120 s", SPIKE_CHANGE.es + " · objetivo 60% de CPU · un trabajador nuevo está listo 10 s después de crearse vs 120 s después"),
    question: t("With 120 s start-ups, how does the autoscaler handle the spike?", "Con arranques de 120 s, ¿cómo maneja el pico el autoescalador?"),
    options: [
      t("It keeps up: a check every 15 s adds workers before the line builds", "Alcanza: una revisión cada 15 s agrega trabajadores antes de que crezca la fila"),
      t("Customers give up for about two minutes, until new workers are ready", "Los clientes se rinden durante unos dos minutos, hasta que hay trabajadores listos"),
      t("Much like 10 s start-ups: the 15 s check cycle sets the pace", "Más o menos como con 10 s: el ciclo de revisión de 15 s marca el ritmo"),
    ],
    answer: 1,
    why: t(
      "The autoscaler sees the spike within a check or two (15 s apart, reading a " + READ_WINDOW + " s average) and asks for more workers at once, but a new worker only adds capacity once it's ready. Until then the " + n0(RESULTS.startup.slow.before) + " or so workers on the floor serve about that many a second while " + SPIKE.peak + " arrive, the line grows, and whoever has waited " + PATIENCE + " s gives up. So the errors last about as long as the reaction plus the start-up, and the start-up usually dominates: scheduling, pulling the image, starting the process, warming caches or a JIT, passing the readiness probe (lesson 23, Health checks), and minutes more if the cluster has to add a node first. A ramp slower than that lag is a different story: on the Daily wave setting the floor follows the same 3 → 7 a second with almost no give-ups even at 120 s, because the spare capacity covers what arrives while it reacts.",
      "El autoescalador ve el pico en una o dos revisiones (cada 15 s, leyendo un promedio de " + READ_WINDOW + " s) y pide más trabajadores de inmediato, pero un trabajador nuevo solo suma capacidad cuando está listo. Hasta entonces los " + n0(RESULTS.startup.slow.before) + " trabajadores, más o menos, que hay en el piso atienden cerca de esa cantidad por segundo mientras llegan " + SPIKE.peak + ", la fila crece, y quien ya esperó " + PATIENCE + " s se rinde. Así que los errores duran más o menos la reacción más el arranque, y casi siempre manda el arranque: asignar el pod a un nodo, descargar la imagen, arrancar el proceso, calentar cachés o el JIT, pasar la prueba de disponibilidad (readiness probe; lección 23, Chequeos de salud), y varios minutos más si el clúster primero tiene que agregar un nodo. Una subida más lenta que ese retraso es otra historia: con el ajuste Ola diaria, el piso sigue la misma subida de 3 → 7 por segundo casi sin abandonos incluso con 120 s, porque la capacidad sobrante cubre lo que llega mientras reacciona.",
    ),
    watch: { traffic: "spike", startup: "120", target: "0.6", window: "300", min: "2", metric: "cpu", db: "app", speed: 3 },
  },
  {
    id: "target",
    title: t("Run the workers hotter", "Trabajar más cerca del límite"),
    change: t(SPIKE_CHANGE.en + " · start-up 45 s · target 60% vs 90% CPU", SPIKE_CHANGE.es + " · arranque de 45 s · objetivo 60% vs 90% de CPU"),
    question: t("A 90% target needs fewer workers. What does it cost during the spike?", "Un objetivo de 90% necesita menos trabajadores. ¿Qué cuesta durante el pico?"),
    options: [
      t("A bit more waiting: the 10% margin rides out most of it", "Un poco más de espera: el margen de 10% aguanta casi todo"),
      t("Far more give-ups: it adds workers about one at a time", "Muchos más abandonos: agrega trabajadores casi uno a la vez"),
      t("About the same: it scales by the same ratio, from fewer", "Más o menos lo mismo: escala en la misma proporción, desde menos"),
    ],
    answer: 1,
    why: t(
      "At 90% the floor runs with " + n0(t90.before) + " workers and little to spare, so the spike overloads it at once. Worse, a worker here can't read more than 100% (its CPU limit equals its request), which is only 1.11 times a 90% target, just past the 10% tolerance: the autoscaler asks for ceil(" + n0(t90.before) + " × 1.11) = " + ASK90 + ". And while that worker starts, the Kubernetes HPA counts it at 0% before scaling up again, which pulls the ratio back under 1, so nothing more happens until it's ready: about one worker per start-up time. At 60%, a saturated reading is 1.67 times the target, so a single check asks for two-thirds more. The target is your headroom: it buys the spare capacity that carries the load while new pods start. With a CPU limit above the request the reading can pass 100% and the controller sees more of the gap; then the node's spare CPU is what absorbs the spike.",
      "Con 90% el piso funciona con " + n0(t90.before) + " trabajadores y casi nada de sobra, así que el pico lo sobrecarga de inmediato. Peor aún, aquí un trabajador no puede leer más de 100% (su límite de CPU es igual a lo que solicita), que es apenas 1.11 veces un objetivo de 90%, justo por encima de la tolerancia de 10%: el autoescalador pide ceil(" + n0(t90.before) + " × 1.11) = " + ASK90 + ". Y mientras ese trabajador arranca, el HPA de Kubernetes lo cuenta en 0% antes de volver a escalar, lo que deja la proporción por debajo de 1, así que no pasa nada más hasta que está listo: más o menos un trabajador por cada tiempo de arranque. Con 60%, una lectura saturada es 1.67 veces el objetivo, así que una sola revisión pide dos tercios más. El objetivo es tu margen (headroom): paga la capacidad sobrante que sostiene la carga mientras arrancan los pods nuevos. Con un límite de CPU mayor que lo solicitado, la lectura puede pasar de 100% y el controlador ve más de la diferencia; entonces lo que absorbe el pico es la CPU libre del nodo.",
    ),
    watch: { traffic: "spike", startup: "45", target: "0.9", window: "300", min: "2", metric: "cpu", db: "app", speed: 3 },
  },
  {
    id: "flap",
    title: t("Traffic that swings every two minutes", "Tráfico que cambia cada dos minutos"),
    change: t("6 a second for 2 minutes, then 2 a second for 2 minutes, for half an hour · start-up 45 s · scale-down window 0 s vs 300 s (the Kubernetes default)", "6 por segundo durante 2 minutos, luego 2 por segundo durante 2 minutos, por media hora · arranque de 45 s · ventana de reducción de 0 s vs 300 s (la de Kubernetes por defecto)"),
    question: t("With no scale-down window, what happens?", "Sin ventana de reducción, ¿qué pasa?"),
    options: [
      t("It tracks the swings closely and saves money at no cost", "Sigue los cambios de cerca y ahorra dinero sin costo"),
      t("It sends workers home in every lull, so each burst starts short", "Manda trabajadores a casa en cada calma, y cada ráfaga empieza corta"),
      t("It holds steady anyway: the 10% tolerance absorbs the swings", "Se mantiene estable igual: la tolerancia de 10% absorbe los cambios"),
    ],
    answer: 1,
    why: t(
      "A lull reads about a third of what the burst did, far outside the tolerance, so with no window the autoscaler sends workers home at the next check; the next burst then lands on a few workers and waits a start-up for the rest. That's flapping: capacity always a step behind, and every new pod pays its start-up again (and cold caches, new connections). The scale-down stabilization window makes it scale down only to the highest recommendation of the last 5 minutes, so a 2-minute lull doesn't shrink the floor. That's why Kubernetes stabilizes scale-down for 300 s by default but scale-up not at all. The price here is " + more(RESULTS.flap.w300.podMin, RESULTS.flap.w0.podMin) + " more pod-minutes. Make the window longer than the gaps between your bursts, or limit how fast it may scale down (behavior policies, e.g. one pod a minute).",
      "Una calma lee cerca de un tercio de lo que leía la ráfaga, muy fuera de la tolerancia, así que sin ventana el autoescalador manda trabajadores a casa en la siguiente revisión; la próxima ráfaga cae sobre pocos trabajadores y espera un arranque por el resto. Eso es oscilar (flapping): la capacidad siempre va un paso atrás, y cada pod nuevo vuelve a pagar su arranque (y cachés en frío, conexiones nuevas). La ventana de estabilización de la reducción hace que solo reduzca hasta la recomendación más alta de los últimos 5 minutos, así que una calma de 2 minutos no achica el piso. Por eso Kubernetes estabiliza la reducción 300 s por defecto y el aumento nada. El precio aquí es " + more(RESULTS.flap.w300.podMin, RESULTS.flap.w0.podMin) + " más de minutos de pod. Haz la ventana más larga que las pausas entre tus ráfagas, o limita qué tan rápido puede reducir (las políticas de behavior, por ejemplo un pod por minuto).",
    ),
    watch: { traffic: "bursts", startup: "45", target: "0.6", window: "0", min: "2", metric: "cpu", db: "app", speed: 3 },
  },
  {
    id: "floor",
    title: t("A launch you know is coming", "Un lanzamiento que sabes que viene"),
    change: t("The same spike at a time you know (a launch) · start-up 120 s · minReplicas 2 all along vs raised to " + FLOOR.min + " from 3 minutes before the launch until 5 minutes after it", "El mismo pico a una hora que conoces (un lanzamiento) · arranque de 120 s · minReplicas 2 todo el tiempo vs subido a " + FLOOR.min + " desde 3 minutos antes del lanzamiento hasta 5 minutos después"),
    question: t("What does raising the floor ahead of time buy?", "¿Qué compra subir el piso por adelantado?"),
    options: [
      t("Little: the autoscaler would have reached " + FLOOR.min + " within a check", "Poco: el autoescalador habría llegado a " + FLOOR.min + " en una revisión"),
      t("No one gives up, for a few more pod-minutes", "Nadie se rinde, por unos pocos minutos de pod más"),
      t("It moves the give-ups to when the floor comes down", "Mueve los abandonos al momento en que se baja el piso"),
    ],
    answer: 1,
    why: t(
      "An autoscaler reacts; it can't know that a launch, a marketing email or a match kick-off is coming. When you do, put the capacity in place before it: raise minReplicas at least one start-up time ahead (here 3 minutes ahead of 2-minute start-ups), from a scheduled job that patches the HPA or with KEDA's cron scaler, and lower it afterwards. " + FLOOR.min + " workers carry " + SPIKE.peak + " a second at under 90% while the autoscaler adds the rest from the reading, as usual. Lowering it later costs nothing: by then the load is back to normal and the scale-down window lets the floor shrink slowly. The floor paid only for the event window; a permanently high minimum pays for the peak all day.",
      "Un autoescalador reacciona; no puede saber que viene un lanzamiento, un correo de marketing o el inicio de un partido. Cuando tú lo sabes, pon la capacidad antes: sube minReplicas al menos un tiempo de arranque antes (aquí 3 minutos antes, con arranques de 2 minutos), con una tarea programada que modifique el HPA o con el escalador cron de KEDA, y bájalo después. " + FLOOR.min + " trabajadores sostienen " + SPIKE.peak + " por segundo por debajo de 90% mientras el autoescalador agrega el resto según la lectura, como siempre. Bajarlo después no cuesta nada: para entonces la carga volvió a la normalidad y la ventana de reducción deja que el piso se achique despacio. El piso solo pagó la ventana del evento; un mínimo alto permanente paga el pico todo el día.",
    ),
    watch: { traffic: "spike", startup: "120", target: "0.6", window: "300", min: "8", metric: "cpu", db: "app", speed: 3 },
  },
  {
    id: "db",
    title: t("The database is the bottleneck", "El cuello de botella es la base de datos"),
    change: t("Each request is 0.25 s of CPU, then a database query (0.75 s on a quiet database) · traffic " + SPIKE.base + " → " + DBRUN.peak + " a second · min " + DBRUN.minR + " workers · scale on CPU vs on busy workers (the share of time a worker holds a request: in-flight requests)", "Cada solicitud es 0.25 s de CPU y después una consulta a la base de datos (0.75 s en una base tranquila) · tráfico de " + SPIKE.base + " → " + DBRUN.peak + " por segundo · mínimo " + DBRUN.minR + " trabajadores · escalar por CPU vs por trabajadores ocupados (la parte del tiempo que un trabajador tiene una solicitud: solicitudes en curso)"),
    question: t("Scaling on busy workers, the autoscaler goes all the way to " + MAX_R + ". Compared with scaling on CPU, how many give up?", "Escalando por trabajadores ocupados, el autoescalador llega hasta " + MAX_R + ". Comparado con escalar por CPU, ¿cuántos se rinden?"),
    options: [
      t("Fewer: the extra workers clear the line faster", "Menos: los trabajadores extra vacían la fila más rápido"),
      t("About as many: the database caps both the same", "Más o menos los mismos: la base de datos limita a los dos igual"),
      t("More: the extra workers slow the database down", "Más: los trabajadores extra vuelven más lenta la base de datos"),
    ],
    answer: 2,
    why: t(
      "The workers spend most of each request waiting on the database, so their CPU stays low and the CPU-based autoscaler never adds any: it can't fix a bottleneck it doesn't measure, but it doesn't make it worse. Busy workers do climb, so that autoscaler goes to the maximum. Each extra worker holds a connection and puts one more query on the database at once, and past about " + KNEE + " at a time the database spends more on contention than on work (lesson 29, Connection pooling): each query ran " + one(RESULTS.db.busy.slow) + "× slower and fewer finished each second. More pods didn't add capacity; they added load to the part that was already full. Scale the bottleneck itself, or make queries fewer and cheaper (a cache, an index), cap the queries in flight with a pool, and turn the excess away at the door (lesson 47, Load shedding).",
      "Los trabajadores pasan casi toda la solicitud esperando a la base de datos, así que su CPU se queda baja y el autoescalador por CPU nunca agrega ninguno: no puede arreglar un cuello de botella que no mide, pero tampoco lo empeora. Los trabajadores ocupados sí suben, así que ese autoescalador llega al máximo. Cada trabajador extra tiene una conexión y pone una consulta más a la vez en la base de datos, y pasadas unas " + KNEE + " a la vez la base de datos gasta más en contención que en trabajo (lección 29, Pool de conexiones): cada consulta corrió " + one(RESULTS.db.busy.slow) + " veces más lenta y terminaron menos por segundo. Más pods no agregaron capacidad; agregaron carga a la parte que ya estaba llena. Escala el cuello de botella mismo, o haz las consultas menos y más baratas (una caché, un índice), limita las consultas en curso con un pool, y rechaza el exceso en la puerta (lección 47, Descarte de carga).",
    ),
    watch: { traffic: "spike", startup: "45", target: "0.6", window: "300", min: "4", metric: "busy", db: "db", speed: 3 },
  },
];

const QUESTIONS = [
  [t("Five pods read 100% CPU against a 60% target. Walk through what the Kubernetes HPA does at its next check, and what keeps it from chasing noise.", "Cinco pods leen 100% de CPU contra un objetivo de 60%. Explica qué hace el HPA de Kubernetes en su próxima revisión, y qué evita que persiga el ruido."),
    t("desired = ceil(current × reading ÷ target) = ceil(5 × 100 ÷ 60) = 9, checked every 15 s by default. A scale-up may at most double the pods or add 4 per 15 s, whichever is more, and pods that aren't ready yet count as 0% while it decides to scale up, so it doesn't keep asking while they start. Against noise: no change while the ratio is within 10% of 1 (the tolerance), the reading is an average over a window, and scale-down uses the highest recommendation of the last 300 s. Utilization is measured against the pod's CPU request, not its limit.",
      "deseados = ceil(actuales × lectura ÷ objetivo) = ceil(5 × 100 ÷ 60) = 9, revisado cada 15 s por defecto. Un aumento puede, como mucho, duplicar los pods o sumar 4 cada 15 s, lo que sea mayor, y los pods que todavía no están listos cuentan como 0% cuando decide aumentar, así que no sigue pidiendo mientras arrancan. Contra el ruido: no cambia mientras la proporción está a menos de 10% de 1 (la tolerancia), la lectura es un promedio sobre una ventana, y la reducción usa la recomendación más alta de los últimos 300 s. El uso se mide contra lo que el pod solicita de CPU (su request), no contra su límite.")],
  [t("The autoscaler followed a daily traffic wave with no errors, but a sudden spike to the same peak caused a few minutes of them. Why, and which delays add up?", "El autoescalador siguió una ola diaria de tráfico sin errores, pero un pico repentino hasta el mismo máximo causó unos minutos de errores. ¿Por qué, y qué retrasos se suman?"),
    t("Autoscaling is feedback: it acts after the load arrives. What matters is how much the load grows during its lag compared with the headroom. The lag is the metric window and scrape, the check interval, scheduling (plus a new node from the cluster autoscaler if none has room), image pull, process start and warm-up, the readiness probe and the load balancer picking up the new endpoint. A slow wave grows little within that lag, so the headroom covers it; a step jumps past the headroom at once. Fixes: more headroom, faster start-ups, scaling ahead of known peaks, and a bounded queue or shedding for the rest (lesson 47, Load shedding).",
      "Autoescalar es retroalimentación: actúa después de que llega la carga. Lo que importa es cuánto crece la carga durante su retraso comparado con el margen. El retraso es la ventana y la recolección de la métrica, el intervalo de revisión, asignar el pod a un nodo (más un nodo nuevo del autoescalador de clúster si ninguno tiene lugar), descargar la imagen, arrancar y calentar el proceso, la prueba de disponibilidad y que el balanceador tome el nuevo endpoint. Una ola lenta crece poco en ese retraso, así que el margen la cubre; un salto supera el margen de golpe. Soluciones: más margen, arranques más rápidos, escalar antes de los picos conocidos, y una cola acotada o descarte de carga para el resto (lección 47, Descarte de carga).")],
  [t("How do you choose a target utilization?", "¿Cómo eliges un objetivo de uso?"),
    t("It sets the headroom: at a 60% target you run about 1.67 times the pods the load needs, at 90% about 1.1 times. The spare capacity has to carry the load while new pods start, so if traffic can grow by a factor f within your reaction plus start-up time, the target should be at most about 1 ÷ f: 1.5 times in two minutes, with two-minute start-ups, means about 67%. Also leave room for queueing, which grows sharply near 100% (lesson 33, Queues), and remember that a reading capped at 100% hides how far behind you are.",
      "Define el margen: con un objetivo de 60% tienes cerca de 1.67 veces los pods que necesita la carga, con 90% cerca de 1.1 veces. La capacidad sobrante tiene que sostener la carga mientras arrancan los pods nuevos, así que si el tráfico puede crecer un factor f dentro de tu tiempo de reacción más el arranque, el objetivo debería ser como mucho 1 ÷ f: 1.5 veces en dos minutos, con arranques de dos minutos, da cerca de 67%. Deja lugar también para las colas, que crecen mucho cerca del 100% (lección 33, Colas), y recuerda que una lectura con tope en 100% esconde qué tan atrasado estás.")],
  [t("Your deployment scales up and down every few minutes. What is going on, and what do you change?", "Tu deployment escala hacia arriba y hacia abajo cada pocos minutos. ¿Qué está pasando y qué cambias?"),
    t("Flapping: the load swings faster than the scale-down reacts, so each lull removes pods the next burst needs. Every new pod pays its start-up and cold caches again, and every removed one must drain its requests cleanly (lesson 77, Graceful Shutdown). Lengthen the scale-down stabilization window beyond the gaps between bursts, limit the scale-down rate with behavior policies (for example one pod per minute), widen the tolerance if your version allows it per HPA, or smooth the metric. Scale-up should stay fast.",
      "Oscilación (flapping): la carga cambia más rápido de lo que reacciona la reducción, así que cada calma quita pods que la próxima ráfaga necesita. Cada pod nuevo vuelve a pagar su arranque y sus cachés en frío, y cada uno que se quita tiene que terminar sus solicitudes limpiamente (lección 77, Apagado ordenado). Alarga la ventana de estabilización de la reducción más allá de las pausas entre ráfagas, limita la velocidad de reducción con políticas de behavior (por ejemplo un pod por minuto), amplía la tolerancia si tu versión lo permite por HPA, o suaviza la métrica. El aumento debería seguir siendo rápido.")],
  [t("Which metric should a service scale on?", "¿Con qué métrica debería escalar un servicio?"),
    t("One that rises when the pods themselves are the bottleneck and falls when you add them. CPU works for CPU-bound services. For services that mostly wait on I/O, in-flight requests per pod (concurrency, as Knative scales on) or requests per second per pod track load better; for workers fed by a queue, the backlog per worker (for example with KEDA). But only if adding pods adds capacity: if the limit is downstream, every one of these climbs while more pods make things worse. Latency alone is a poor scaling signal because many things that slow requests down aren't fixed by more pods.",
      "Una que suba cuando el cuello de botella son los propios pods y baje cuando los agregas. La CPU sirve para servicios limitados por CPU. Para servicios que casi siempre esperan E/S, las solicitudes en curso por pod (concurrencia, como escala Knative) o las solicitudes por segundo por pod siguen mejor la carga; para trabajadores que leen de una cola, el atraso por trabajador (por ejemplo con KEDA). Pero solo si agregar pods agrega capacidad: si el límite está más abajo, todas estas suben mientras más pods empeoran las cosas. La latencia sola es una mala señal para escalar, porque muchas cosas que vuelven lentas las solicitudes no se arreglan con más pods.")],
  [t("Your service hit maxReplicas during an incident and errors got worse, not better. What do you check?", "Tu servicio llegó a maxReplicas durante un incidente y los errores empeoraron en lugar de mejorar. ¿Qué revisas?"),
    t("Whether the bottleneck is downstream: a database at its limit, a rate-limited API, a hot lock. Pods × pool size against the database's connection limit (lesson 29, Connection pooling). Whether retries multiplied the load (lesson 06, Retry storms). Whether the new pods really became ready, or sit Pending for lack of nodes or quota, or crash-loop. The fix is rarely more pods: cap concurrency toward the bottleneck, shed or queue the excess, and scale or relieve the bottleneck itself.",
      "Si el cuello de botella está más abajo: una base de datos en su límite, una API con límite de tasa, un bloqueo (lock) muy disputado. Pods × tamaño del pool contra el límite de conexiones de la base de datos (lección 29, Pool de conexiones). Si los reintentos multiplicaron la carga (lección 06, Tormentas de reintentos). Si los pods nuevos de verdad quedaron listos, o siguen en Pending por falta de nodos o de cuota, o se reinician en bucle. La solución rara vez es más pods: limita la concurrencia hacia el cuello de botella, descarta o encola el exceso, y escala o alivia el cuello de botella mismo.")],
];

export default defineLesson({
  title: t("Autoscaling Workbench", "Banco de trabajo: autoescalado"),
  eyebrow: t("Systems lesson 75 · Autoscaling", "Lección de sistemas 75 · Autoescalado"),
  lede: t("An autoscaler adds workers when they are busy and sends them home when they are idle. It acts only after the load has arrived, and a new worker takes time to start, so it follows slow changes well and misses the first minutes of a spike. This lesson runs a service floor under a Kubernetes-style autoscaler: watch it add and remove workers, predict where it falls behind, then explain it back.",
    "Un autoescalador agrega trabajadores cuando están ocupados y los manda a casa cuando están ociosos. Solo actúa después de que llegó la carga, y un trabajador nuevo tarda en arrancar, así que sigue bien los cambios lentos y se pierde los primeros minutos de un pico. Esta lección pone un piso de atención bajo un autoescalador al estilo de Kubernetes: mira cómo agrega y quita trabajadores, predice dónde se queda atrás y después explícalo."),
  machine: {
    intro: t("Customers come in at the back left and wait in the line; each open desk's worker (a pod) serves one at a time. Every " + SYNC + " s the autoscaler reads the workers' average CPU over the last " + READ_WINDOW + " s and sets how many it wants: ceil(workers × reading ÷ target), the rule of the Kubernetes Horizontal Pod Autoscaler (HPA). A new worker waits beside its desk until it's ready. Press Spike now, then try the start-up time, the target, the scale-down window, the minimum and the database as the bottleneck.",
      "Los clientes entran atrás a la izquierda y esperan en la fila; el trabajador (un pod) de cada escritorio abierto atiende a uno a la vez. Cada " + SYNC + " s el autoescalador lee la CPU promedio de los trabajadores en los últimos " + READ_WINDOW + " s y decide cuántos quiere: ceil(trabajadores × lectura ÷ objetivo), la regla del Horizontal Pod Autoscaler (HPA) de Kubernetes. Un trabajador nuevo espera junto a su escritorio hasta estar listo. Presiona Pico ahora, y después prueba el tiempo de arranque, el objetivo, la ventana de reducción, el mínimo y la base de datos como cuello de botella."),
    plate: {
      title: t("Service floor", "Piso de atención"),
      keys: [
        { mark: "lit", label: t("A customer who gave up; the target mark on the autoscaler's dial; its lamp when it changes the count", "Un cliente que se rindió; la marca del objetivo en el dial del autoescalador; su lámpara cuando cambia la cantidad") },
        { mark: "raised", label: t("Workers (pods): behind the desk when ready, beside it with a clipboard while starting", "Trabajadores (pods): detrás del escritorio cuando están listos, al lado con una tablilla mientras arrancan") },
        { mark: "flat", label: t("Desk plots: " + MAX_R + " places, the most workers the floor holds (maxReplicas)", "Lugares para escritorios: " + MAX_R + ", la mayor cantidad de trabajadores que cabe (maxReplicas)") },
      ],
      caption: t(
        "Customers (requests) come in through the gate at the back left and wait in the line; one who has waited " + PATIENCE + " s gives up, lights and counts under GAVE UP (an error). Each open desk has one worker, who serves one customer at a time: a request is 1 s of CPU (0.5 to 1.5 s), so a worker serves about one a second. Served customers leave through the exit stand on the right. The meter on each desk is that worker's reading. The autoscaler's dial shows the workers' average reading over the last " + READ_WINDOW + " s against the lit target mark; the small dial counts down to the next check, every " + SYNC + " s. At a check it wants ceil(workers × reading ÷ target), within a 10% tolerance; scale-up at most doubles the count (or adds 4), and scale-down goes only as low as the highest count wanted during the window. A new worker stands beside its desk with a clipboard until ready; one sent home finishes its customer and walks back to the staff room. A worker can't use more CPU than it requested, so its reading tops out at 100%. With the database as the bottleneck, a request is 0.25 s of CPU and then a query, during which the worker holds a slip; the database meter shows how much slower each query runs with that many at once. Rates and times are illustrative and round.",
        "Los clientes (solicitudes) entran por la puerta de atrás a la izquierda y esperan en la fila; quien ya esperó " + PATIENCE + " s se rinde, se enciende y cuenta en ABANDONOS (un error). Cada escritorio abierto tiene un trabajador, que atiende a un cliente a la vez: una solicitud es 1 s de CPU (de 0.5 a 1.5 s), así que un trabajador atiende cerca de una por segundo. Los clientes atendidos salen por el puesto de salida de la derecha. El medidor de cada escritorio es la lectura de ese trabajador. El dial del autoescalador muestra la lectura promedio de los trabajadores en los últimos " + READ_WINDOW + " s frente a la marca encendida del objetivo; el dial pequeño cuenta hasta la próxima revisión, cada " + SYNC + " s. En una revisión quiere ceil(trabajadores × lectura ÷ objetivo), con una tolerancia de 10%; un aumento como mucho duplica la cantidad (o suma 4), y una reducción solo baja hasta la cantidad más alta pedida durante la ventana. Un trabajador nuevo espera junto a su escritorio con una tablilla hasta estar listo; uno que se manda a casa termina con su cliente y vuelve caminando a la sala del personal. Un trabajador no puede usar más CPU de la que solicitó, así que su lectura llega como mucho a 100%. Con la base de datos como cuello de botella, una solicitud es 0.25 s de CPU y después una consulta, durante la cual el trabajador sostiene una papeleta; el medidor de la base de datos muestra cuánto más lenta corre cada consulta con tantas a la vez. Las tasas y los tiempos son ilustrativos y redondos.",
      ),
      stage: { "data-floor": "" },
      label: t("Autoscaling simulation. Space pauses or resumes.", "Simulación de autoescalado. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["pods", t("Workers ready / starting", "Trabajadores listos / arrancando")],
      ["wanted", t("Wanted", "Pedidos")],
      ["reading", t("Reading", "Lectura")],
      ["waiting", t("Waiting", "En espera")],
      ["gaveup", t("Gave up", "Abandonos")],
      ["podmin", t("Pod-minutes", "Minutos de pod")],
    ],
    controls: [
      { seg: "traffic", label: t("Traffic", "Tráfico"), options: [["steady", t("Steady, 3/s", "Constante, 3/s")], ["spike", t("Spikes", "Picos")], ["wave", t("Daily wave", "Ola diaria")], ["bursts", t("Swings every 2 min", "Cambia cada 2 min")]], value: "spike" },
      { seg: "startup", label: t("Start-up", "Arranque"), options: [["10", "10 s"], ["45", "45 s"], ["120", "120 s"]], value: "45" },
      { seg: "target", label: t("Target", "Objetivo"), options: [["0.6", "60%"], ["0.75", "75%"], ["0.9", "90%"]], value: "0.6" },
      { seg: "window", label: t("Scale-down window", "Ventana de reducción"), options: [["0", "0 s"], ["60", "60 s"], ["300", "300 s"]], value: "300" },
      { seg: "min", label: t("Minimum workers", "Mínimo de trabajadores"), options: [["2", "2"], ["4", "4"], ["8", "8"]], value: "2" },
      { seg: "metric", label: t("Scale on", "Escalar por"), options: [["cpu", "CPU"], ["busy", t("Busy workers", "Trabajadores ocupados")]], value: "cpu" },
      { seg: "db", label: t("Bottleneck", "Cuello de botella"), options: [["app", t("The workers' CPU", "La CPU de los trabajadores")], ["db", t("The database", "La base de datos")]], value: "app" },
      { speed: true },
      { actions: [["spike", t("Spike now", "Pico ahora"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Spike now sends 7 a second (5 with the database as the bottleneck) for 3 minutes. The Spikes setting sends the same for 4 minutes in every 12; Daily wave goes from 3 to 7 a second and back over 12 minutes. Changing a setting starts the run again.",
      "Pico ahora manda 7 por segundo (5 con la base de datos como cuello de botella) durante 3 minutos. El ajuste Picos manda lo mismo durante 4 minutos de cada 12; Ola diaria va de 3 a 7 por segundo y vuelve en 12 minutos. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
${FIGURE_CSS}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    CUST_SVG: customerSvg(),
    WALKER_SVG: walkerSvg(),
  },
});
