// @ts-nocheck: content ported as-is
// Systems lesson 13 · Concurrency: one cook, one stove, many pans.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, secs1 } from "../../lib/format";
import { mean as avg } from "../../lib/stats";
import { buildFigure, P, GEOMETRY } from "./figure";
import { waitingRun, busyRun, sliceRun, fairRun, pansRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the original ran them in the browser).
const RESULTS = { waiting: waitingRun(), busy: busyRun(), slice: sliceRun(), fair: fairRun(), pans: pansRun() };

// What each card shows after a run.
const RUNS = {
  waiting: () => {
    const { a, b } = RESULTS.waiting;
    const top = a.total * 1.05, less = Math.round(100 * (1 - b.total / a.total));
    return { verdict: t("All four served in " + secs1(a.total) + " one at a time, " + secs1(b.total) + " switching while pans simmer: " + less + "% less. The cook was idle " + pct(a.idle) + " of the time one at a time, " + pct(b.idle) + " switching.",
        "Los cuatro servidos en " + secs1(a.total) + " una a la vez y en " + secs1(b.total) + " cambiando mientras las sartenes hierven: " + less + "% menos. El cocinero estuvo inactivo el " + pct(a.idle) + " del tiempo una a la vez y el " + pct(b.idle) + " cambiando."),
      bars: [[t("One at a time", "Una a la vez"), a.total / top, secs1(a.total)], [t("Switch on simmer", "Cambiar al hervir"), b.total / top, secs1(b.total), true]] };
  },
  busy: () => {
    const { a, b } = RESULTS.busy;
    const top = Math.max(a.total, b.total) * 1.05;
    return { verdict: t("Total " + secs1(a.total) + " one at a time vs " + secs1(b.total) + " taking turns. The average dish came out at " + secs1(avg(a.finish)) + " vs " + secs1(avg(b.finish)) + ".",
        "Total: " + secs1(a.total) + " una a la vez contra " + secs1(b.total) + " por turnos. El plato promedio salió a los " + secs1(avg(a.finish)) + " contra " + secs1(avg(b.finish)) + "."),
      bars: [[t("One at a time: all", "Una a la vez: todos"), a.total / top, secs1(a.total)], [t("Taking turns: all", "Por turnos: todos"), b.total / top, secs1(b.total), true], [t("One at a time: avg dish", "Una a la vez: plato prom."), avg(a.finish) / top, secs1(avg(a.finish))], [t("Taking turns: avg dish", "Por turnos: plato prom."), avg(b.finish) / top, secs1(avg(b.finish)), true]] };
  },
  slice: () => {
    const { a, b } = RESULTS.slice;
    return { verdict: t("Moving took " + pct(a.switching) + " of the cook's time with 3 s turns and " + pct(b.switching) + " with 0.3 s turns; the batch went from " + secs1(a.total) + " to " + secs1(b.total) + ".",
        "Moverse ocupó el " + pct(a.switching) + " del tiempo del cocinero con turnos de 3 s y el " + pct(b.switching) + " con turnos de 0.3 s; la tanda pasó de " + secs1(a.total) + " a " + secs1(b.total) + "."),
      bars: [[t("3 s turns", "Turnos de 3 s"), a.switching, pct(a.switching)], [t("0.3 s turns", "Turnos de 0.3 s"), b.switching, pct(b.switching), true]] };
  },
  fair: () => {
    const { a, b } = RESULTS.fair;
    const sa = avg(a.finish.slice(1)), sb = avg(b.finish.slice(1));
    const top = Math.max(a.finish[0], b.finish[0], sa, sb) * 1.05;
    return { verdict: t("The small dishes came out at " + secs1(sa) + " on average without turns and " + secs1(sb) + " with 1 s turns. The stew went from " + secs1(a.finish[0]) + " to " + secs1(b.finish[0]) + ".",
        "Los platos pequeños salieron en promedio a los " + secs1(sa) + " sin turnos y a los " + secs1(sb) + " con turnos de 1 s. El guiso pasó de " + secs1(a.finish[0]) + " a " + secs1(b.finish[0]) + "."),
      bars: [[t("Small, no turns", "Pequeños, sin turnos"), sa / top, secs1(sa)], [t("Small, 1 s turns", "Pequeños, turnos de 1 s"), sb / top, secs1(sb), true], [t("Stew, no turns", "Guiso, sin turnos"), a.finish[0] / top, secs1(a.finish[0])], [t("Stew, 1 s turns", "Guiso, turnos de 1 s"), b.finish[0] / top, secs1(b.finish[0]), true]] };
  },
  pans: () => {
    const { r2, r4, r8 } = RESULTS.pans;
    const rt = Math.max(r2.perMinute, r4.perMinute, r8.perMinute) * 1.1, tt = r8.avgTime * 1.1;
    return { verdict: t("Per minute: " + r4.perMinute.toFixed(1) + " with 4 pans, " + r8.perMinute.toFixed(1) + " with 8. Time per dish: " + secs1(r4.avgTime) + " → " + secs1(r8.avgTime) + ". With 4 pans the cook was idle " + pct(r4.idle) + " of the time.",
        "Por minuto: " + r4.perMinute.toFixed(1) + " con 4 sartenes, " + r8.perMinute.toFixed(1) + " con 8. Tiempo por plato: " + secs1(r4.avgTime) + " → " + secs1(r8.avgTime) + ". Con 4 sartenes el cocinero estuvo inactivo el " + pct(r4.idle) + " del tiempo."),
      bars: [[t("2 pans: per min", "2 sartenes: por min"), r2.perMinute / rt, r2.perMinute.toFixed(1)], [t("4 pans: per min", "4 sartenes: por min"), r4.perMinute / rt, r4.perMinute.toFixed(1)], [t("8 pans: per min", "8 sartenes: por min"), r8.perMinute / rt, r8.perMinute.toFixed(1), true], [t("4 pans: per dish", "4 sartenes: por plato"), r4.avgTime / tt, secs1(r4.avgTime)], [t("8 pans: per dish", "8 sartenes: por plato"), r8.avgTime / tt, secs1(r8.avgTime), true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "waiting",
    title: t("Dishes that mostly simmer", "Platos que casi solo hierven"),
    change: t("4 dishes, each 3 s of stirring and 70% simmering · one at a time → switch when a pan starts simmering", "4 platos, cada uno con 3 s de revolver y 70% a fuego lento · una a la vez → cambiar cuando una sartén empieza a hervir"),
    question: t("How much sooner is everything served?", "¿Cuánto antes se sirve todo?"),
    options: [t("A little: the cook still does the same 12 s of stirring", "Un poco: el cocinero sigue revolviendo los mismos 12 s"), t("Far sooner: under half the time", "Mucho antes: en menos de la mitad del tiempo"), t("Not at all: one cook can only do one thing at a time", "Nada: un cocinero solo puede hacer una cosa a la vez")],
    answer: 1,
    why: t("One at a time, the cook stands beside each pan while it simmers, so most of the run is waiting. Switching lets the cook stir another pan during every simmer. The stirring work is the same; what disappears is the idle standing. This is what concurrency buys: overlapping the waits of many tasks with one worker.",
      "Una a la vez, el cocinero se queda junto a cada sartén mientras hierve, así que casi toda la ejecución es espera. Cambiar le permite revolver otra sartén durante cada hervor. El trabajo de revolver es el mismo; lo que desaparece es el tiempo parado. Eso es lo que compra la concurrencia: superponer las esperas de muchas tareas con un solo trabajador."),
    watch: { pans: 4, wait: 0.7, policy: "wait", slice: 1, cost: 0.3, stockpot: false },
  },
  {
    id: "busy",
    title: t("Dishes that never simmer", "Platos que nunca hierven"),
    change: t("4 dishes, each 3 s of nonstop stirring · one at a time → round robin, 1 s each", "4 platos, cada uno con 3 s de revolver sin parar · una a la vez → por turnos (round robin), 1 s cada uno"),
    question: t("Does taking turns help when there is no waiting at all?", "¿Turnarse ayuda cuando no hay ninguna espera?"),
    options: [t("Yes: everything is done sooner", "Sí: todo termina antes"), t("No: the total is the same and so is each dish", "No: el total es el mismo y cada plato también"), t("No: everything takes longer, and every dish finishes later", "No: todo tarda más y cada plato termina después")],
    answer: 2,
    why: t("With no waits to fill, there is nothing to overlap. The cook still stirs 12 s in total, plus every switch between pans, so the whole batch takes longer. Worse, one at a time serves the first dish after 3 s; taking turns keeps every dish half-done until near the end. Concurrency helps with waiting, not with work.",
      "Sin esperas que llenar, no hay nada que superponer. El cocinero sigue revolviendo 12 s en total, más cada cambio entre sartenes, así que la tanda completa tarda más. Peor aún: una a la vez sirve el primer plato a los 3 s; por turnos, todos los platos quedan a medio hacer hasta casi el final. La concurrencia ayuda con la espera, no con el trabajo."),
    watch: { pans: 4, wait: 0, policy: "rr", slice: 1, cost: 0.3, stockpot: false },
  },
  {
    id: "slice",
    title: t("A very short turn", "Un turno muy corto"),
    change: t("Round robin, 4 nonstop dishes, switching costs 0.3 s · turns of 3 s → 0.3 s", "Por turnos, 4 platos sin pausa, cambiar cuesta 0.3 s · turnos de 3 s → 0.3 s"),
    question: t("What share of the cook's time goes on moving between pans?", "¿Qué parte del tiempo del cocinero se va en moverse entre sartenes?"),
    options: [t("Around a tenth", "Cerca de una décima parte"), t("Around half", "Cerca de la mitad"), t("None: shorter turns are just fairer", "Nada: los turnos cortos solo son más justos")],
    answer: 1,
    why: t("Each turn is followed by a switch. When a turn is as short as a switch, the cook spends as long moving as stirring, so half the time is overhead and the batch takes about twice as long. Operating systems face the same trade-off: short time slices feel responsive but each context switch costs time and cache.",
      "Cada turno va seguido de un cambio. Cuando un turno dura lo mismo que un cambio, el cocinero pasa tanto tiempo moviéndose como revolviendo, así que la mitad del tiempo es sobrecarga y la tanda tarda cerca del doble. Los sistemas operativos enfrentan el mismo dilema: los intervalos de tiempo (time slices) cortos se sienten ágiles, pero cada cambio de contexto (context switch) cuesta tiempo y caché."),
    watch: { pans: 4, wait: 0, policy: "rr", slice: 0.3, cost: 0.3, stockpot: false },
  },
  {
    id: "fair",
    title: t("One huge stew", "Un guiso enorme"),
    change: t("A 12 s stew and four 1 s dishes, all nonstop, stew first in line · finish each step before moving → round robin, 1 s turns", "Un guiso de 12 s y cuatro platos de 1 s, todos sin pausa, el guiso primero en la fila · terminar cada paso antes de moverse → por turnos de 1 s"),
    question: t("What happens to the four small dishes?", "¿Qué pasa con los cuatro platos pequeños?"),
    options: [t("They come out far sooner with round robin", "Salen mucho antes por turnos"), t("About the same either way", "Más o menos igual de cualquier forma"), t("Later with round robin, because of all the switching", "Más tarde por turnos, por todos los cambios")],
    answer: 0,
    why: t("Without turns, the stew holds the cook for 12 s and every small dish waits behind it (head-of-line blocking). With 1 s turns the cook finishes each small dish on its first visit. The stew itself is served later, and the batch takes a little longer, but the short jobs stop paying for the long one. That is why schedulers preempt.",
      "Sin turnos, el guiso retiene al cocinero 12 s y cada plato pequeño espera detrás (bloqueo en la cabeza de la fila, head-of-line blocking). Con turnos de 1 s, el cocinero termina cada plato pequeño en su primera visita. El guiso se sirve más tarde y la tanda tarda un poco más, pero los trabajos cortos dejan de pagar por el largo. Por eso los planificadores interrumpen tareas (preemption)."),
    watch: { pans: 5, wait: 0, policy: "rr", slice: 1, cost: 0.3, stockpot: true },
  },
  {
    id: "pans",
    title: t("More pans on the stove", "Más sartenes en la cocina"),
    change: t("Keep every pan busy, 70% simmering · 4 pans → 8 pans", "Todas las sartenes ocupadas, 70% a fuego lento · 4 sartenes → 8 sartenes"),
    question: t("What happens to dishes served per minute, and to the time each dish takes?", "¿Qué pasa con los platos servidos por minuto y con el tiempo que tarda cada plato?"),
    options: [t("Twice as many dishes per minute", "El doble de platos por minuto"), t("About the same per minute, but each dish takes about twice as long", "Más o menos los mismos por minuto, pero cada plato tarda cerca del doble"), t("Fewer per minute, because the cook is overloaded", "Menos por minuto, porque el cocinero está sobrecargado")],
    answer: 1,
    why: t("With 4 pans the cook is already busy all the time, stirring or moving. Extra pans add nothing the cook can serve; they only queue for the cook, so each dish waits longer. Dishes in progress = dishes per minute × time per dish (Little's law): with the rate fixed, twice the pans means twice the time.",
      "Con 4 sartenes el cocinero ya está ocupado todo el tiempo, revolviendo o moviéndose. Más sartenes no agregan nada que el cocinero pueda servir; solo hacen fila para el cocinero, así que cada plato espera más. Platos en curso = platos por minuto × tiempo por plato (ley de Little, Little's law): con la tasa fija, el doble de sartenes significa el doble de tiempo."),
    watch: { pans: 8, wait: 0.7, policy: "wait", slice: 1, cost: 0.3, stockpot: false },
  },
];

const QUESTIONS = [
  [t("What is the difference between concurrency and parallelism, in terms of the cook?", "¿Cuál es la diferencia entre concurrencia y paralelismo, en términos del cocinero?"),
    t("Concurrency is one cook keeping several dishes in progress by switching between them. Parallelism is several cooks stirring at the same instant. Concurrency is about structure (dealing with many things at once); parallelism is about execution (doing many things at once).",
      "La concurrencia es un cocinero que mantiene varios platos en curso alternando entre ellos. El paralelismo son varios cocineros revolviendo en el mismo instante. La concurrencia trata de la estructura (lidiar con muchas cosas a la vez); el paralelismo, de la ejecución (hacer muchas cosas a la vez).")],
  [t("When does interleaving with one worker make things faster, and when does it make them slower?", "¿Cuándo intercalar con un solo trabajador acelera las cosas y cuándo las hace más lentas?"),
    t("Faster when tasks spend time waiting (simmering, I/O, network), because the waits can overlap with other work. Slower when tasks are pure work, because nothing overlaps and every switch adds cost.",
      "Las acelera cuando las tareas pasan tiempo esperando (a fuego lento, E/S, red), porque las esperas se pueden superponer con otro trabajo. Las hace más lentas cuando las tareas son puro trabajo, porque nada se superpone y cada cambio agrega costo.")],
  [t("A teammate halves the time slice \"to make the app more responsive\". What do you check first?", "Un compañero reduce el intervalo de tiempo a la mitad \"para que la app responda mejor\". ¿Qué revisas primero?"),
    t("How much a switch costs compared with the slice. If switching is close to the slice length, most of the time goes on overhead and total throughput drops. Responsiveness for short tasks improves, but only up to the point where switching dominates.",
      "Cuánto cuesta un cambio comparado con el intervalo. Si cambiar dura casi lo mismo que el intervalo, la mayor parte del tiempo se va en sobrecarga y el rendimiento (throughput) total cae. La respuesta para tareas cortas mejora, pero solo hasta el punto en que los cambios dominan.")],
  [t("Why can one long task make many short tasks slow, and what fixes it?", "¿Por qué una tarea larga puede volver lentas a muchas tareas cortas, y qué lo arregla?"),
    t("Without preemption, the short tasks queue behind the long one (head-of-line blocking). Time slices (preemption), a separate queue or priority for short work, or splitting the long task into chunks all let short tasks through.",
      "Sin interrupción (preemption), las tareas cortas hacen fila detrás de la larga (bloqueo en la cabeza de la fila). Los intervalos de tiempo (preemption), una cola o prioridad aparte para el trabajo corto, o partir la tarea larga en pedazos dejan pasar a las tareas cortas.")],
  [t("You raise concurrency from 4 to 8 and throughput doesn't move. What does that tell you?", "Subes la concurrencia de 4 a 8 y el rendimiento no se mueve. ¿Qué te dice eso?"),
    t("The worker is already saturated; the bottleneck is the worker, not the number of tasks in flight. Extra concurrency only adds queueing, so latency rises (Little's law). Find the bottleneck or add workers instead.",
      "El trabajador ya está saturado; el cuello de botella es el trabajador, no la cantidad de tareas en curso. Más concurrencia solo agrega espera en fila, así que la latencia sube (ley de Little). Busca el cuello de botella o agrega trabajadores.")],
  [t("Where do you see this one-worker pattern in real systems?", "¿Dónde ves este patrón de un solo trabajador en sistemas reales?"),
    t("A Node.js or Python asyncio process interleaving requests on one thread; a single database connection multiplexing queries; an OS scheduling many threads on one core; a goroutine scheduler. The same trade-offs apply: overlap waits, pay for switches, beware long tasks.",
      "Un proceso de Node.js o de asyncio en Python que intercala solicitudes en un solo hilo; una sola conexión a la base de datos que multiplexa consultas; un sistema operativo que planifica muchos hilos en un núcleo; el planificador de goroutines. Aplican los mismos dilemas: superponer esperas, pagar por los cambios, cuidado con las tareas largas.")],
];

export default defineLesson({
  title: t("Concurrency Workbench", "Banco de trabajo: concurrencia"),
  eyebrow: t("Systems lesson 13 · Concurrency", "Lección de sistemas 13 · Concurrencia"),
  lede: t("Concurrency is one worker keeping many tasks in progress by switching between them. It hides waiting, but it never adds a second pair of hands. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "La concurrencia es un solo trabajador que mantiene muchas tareas en curso alternando entre ellas. Oculta la espera, pero nunca agrega un segundo par de manos. Esta lección construye esa idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("One stirring head serves every pan on the range. Watch it move to whichever pan is waiting, then change how many pans there are, how much they simmer and how the cook picks the next one.", "Un solo cabezal mezclador atiende todas las sartenes de la cocina. Mira cómo se mueve hacia la sartén que espera, y luego cambia cuántas sartenes hay, cuánto tiempo pasan a fuego lento y cómo elige el cocinero la siguiente."),
    plate: {
      title: t("Range and stirring head", "Cocina y cabezal mezclador"),
      keys: [
        { mark: "lit", label: t("The cook: one stirring head, one pan at a time", "El cocinero: un cabezal mezclador, una sartén a la vez") },
        { mark: "raised", label: t("Pans: a lid means simmering, a ticket means waiting for the cook", "Sartenes: con tapa están a fuego lento; con comanda esperan al cocinero") },
        { mark: "flat", label: t("Knobs: each pan's simmer timer", "Perillas: el temporizador de fuego lento de cada sartén") },
      ],
      caption: t(
        "Each dish needs the cook for its stirring steps and nobody while it simmers. The single head on the gantry is the only worker: it stirs one pan, then travels to the next, and every trip costs time. Served dishes pile up on the pass at the right.",
        "Cada plato necesita al cocinero para revolver y a nadie mientras está a fuego lento. El cabezal del pórtico es el único trabajador: revuelve una sartén, viaja a la siguiente, y cada viaje cuesta tiempo. Los platos servidos se apilan en el pase, a la derecha."),
      stage: { "data-kitchen": "" },
      label: t("Kitchen simulation. Space pauses or resumes.", "Simulación de cocina. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["done", t("Served", "Servidos")], ["rate", t("Per minute", "Por minuto"), "–"], ["time", t("Time per dish", "Tiempo por plato"), "–"], ["cooking", t("Stirring", "Revolviendo"), "–"], ["switching", t("Moving", "Moviéndose"), "–"], ["idle", t("Idle", "Inactivo"), "–"]],
    controls: [
      { seg: "pans", label: t("Pans", "Sartenes"), options: [[1, "1"], [2, "2"], [4, "4"], [5, "5"], [8, "8"]], value: 4 },
      { seg: "wait", label: t("Simmering", "A fuego lento"), options: [[0, "0%"], [0.4, "40%"], [0.7, "70%"]], value: 0.7 },
      { seg: "policy", label: t("Cook", "Cocinero"), options: [["seq", t("One at a time", "Una a la vez")], ["wait", t("Switch when it simmers", "Cambiar cuando hierve")], ["rr", t("Take turns", "Por turnos")]], value: "wait" },
      { seg: "slice", label: t("Turn length", "Duración del turno"), options: [[0.3, "0.3 s"], [1, "1 s"], [3, "3 s"]], value: 1 },
      { seg: "cost", label: t("Moving costs", "Moverse cuesta"), options: [[0.1, "0.1 s"], [0.3, "0.3 s"], [1, "1 s"]], value: 0.3 },
      { seg: "stockpot", label: t("First pan", "Primera sartén"), options: [["false", "Normal"], ["true", t("Big stew", "Guiso grande")]], value: "false" },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Acciones") },
    ],
    note: t('Changing a setting starts the kitchen over. "Turn length" only matters when the cook takes turns.', 'Cambiar un ajuste reinicia la cocina. "Duración del turno" solo importa cuando el cocinero va por turnos.'),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same kitchen model the figure runs, timed to the hundredth of a second.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo de cocina que usa la figura, medidos al centésimo de segundo."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
.pan[data-off]{display:none}
.pan [data-variant][data-off]{display:none}
.lid,.ticket{transition:opacity .18s var(--anatomy-ease)}
.lid[data-off],.ticket[data-off]{opacity:0}
`,
  data: {
    P,
    G: GEOMETRY,
  },
});
