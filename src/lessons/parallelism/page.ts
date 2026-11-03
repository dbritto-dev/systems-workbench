// @ts-nocheck: content ported as-is
// Systems lesson 14 · Parallelism: a workshop with benches (cores), a shared tool and one packing station.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, pawnSvg, P, GEOMETRY } from "./figure";
import { BASE, amdahlRun, oversubRun, toolRun, tinyRun, unevenRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the original ran them in the browser).
const RESULTS = { amdahl: amdahlRun(), oversub: oversubRun(), tool: toolRun(), tiny: tinyRun(), uneven: unevenRun() };

const EXPERIMENTS = [
  {
    id: "amdahl",
    title: t("Eight workers", "Ocho trabajadores"),
    change: t("1 → 8 workers on 8 benches · 10% of the job is packing, which only one station can do", "1 → 8 trabajadores en 8 bancos · el 10% del trabajo es empaque, que solo puede hacer una estación"),
    question: t("How much faster does a job finish?", "¿Cuánto más rápido termina un trabajo?"),
    options: [t("About 8× faster: eight workers, eight benches", "Cerca de 8× más rápido: ocho trabajadores, ocho bancos"), t("About 4× faster", "Cerca de 4× más rápido"), t("About 2× faster", "Cerca de 2× más rápido")],
    answer: 1,
    why: t("Only the parallel part gets eight times faster. The 10% at the packing station still takes as long as before, so it soon dominates: Amdahl's law caps 10% serial work on 8 cores at 4.7×, and handing out and merging chunks costs a little more. No number of workers can beat 10× here, because the serial part alone takes a tenth of the original time.",
      "Solo la parte paralela se vuelve ocho veces más rápida. El 10% en la estación de empaque sigue tardando lo mismo, así que pronto domina: la ley de Amdahl (Amdahl's law) limita un 10% de trabajo serial en 8 núcleos a 4.7×, y repartir y unir los bloques cuesta un poco más. Ninguna cantidad de trabajadores supera 10× aquí, porque la parte serial sola ya toma una décima parte del tiempo original."),
    watch: { ...BASE },
  },
  {
    id: "oversub",
    title: t("More workers than benches", "Más trabajadores que bancos"),
    change: t("8 → 16 workers · still 8 benches (cores) · job split into 16 chunks", "8 → 16 trabajadores · siguen 8 bancos (núcleos) · trabajo dividido en 16 bloques"),
    question: t("What happens to the job time?", "¿Qué pasa con el tiempo del trabajo?"),
    options: [t("It halves: twice the workers", "Se reduce a la mitad: el doble de trabajadores"), t("Nothing gets faster; it's slightly slower", "Nada se acelera; es un poco más lento"), t("It doubles: they get in each other's way", "Se duplica: se estorban entre sí")],
    answer: 1,
    why: t("A bench can only work on one thing at an instant. Two workers on one bench take turns, and every switch costs a little (on a CPU: saving and restoring state, cold caches). More threads than cores helps only when threads spend time waiting on something other than the CPU; for CPU-bound work, match the worker count to the cores.",
      "Un banco solo puede trabajar en una cosa a la vez. Dos trabajadores en un banco se turnan, y cada cambio cuesta un poco (en una CPU: guardar y restaurar el estado, cachés frías). Tener más hilos que núcleos solo ayuda cuando los hilos pasan tiempo esperando algo distinto de la CPU; para trabajo limitado por CPU (CPU-bound), iguala la cantidad de trabajadores a los núcleos."),
    watch: { ...BASE, workers: 16, chunks: 16 },
  },
  {
    id: "tool",
    title: t("One shared tool", "Una herramienta compartida"),
    change: t("Shared tool off → on · the last 40% of every chunk needs the one tool on the rack", "Herramienta compartida apagada → encendida · el último 40% de cada bloque necesita la única herramienta del soporte"),
    question: t("With 8 workers, how fast is the job compared with one worker?", "Con 8 trabajadores, ¿qué tan rápido es el trabajo comparado con un solo trabajador?"),
    options: [t("Still about 4× faster", "Sigue siendo cerca de 4× más rápido"), t("About 2× faster", "Cerca de 2× más rápido"), t("No faster at all", "Nada más rápido")],
    answer: 1,
    why: t("The tool is a lock: only one worker can hold it, so the part of each chunk that needs it is serial again, and workers queue for it. Every shared, exclusive resource (a lock, a single database row, one connection) adds to the serial share in Amdahl's law. Speed-up comes from removing what workers share, not from adding workers.",
      "La herramienta es un candado (lock): solo un trabajador puede tenerla, así que la parte de cada bloque que la necesita vuelve a ser serial, y los trabajadores hacen fila para usarla. Cada recurso compartido y exclusivo (un lock, una sola fila de la base de datos, una conexión) suma a la parte serial de la ley de Amdahl. La aceleración (speed-up) viene de quitar lo que los trabajadores comparten, no de agregar trabajadores."),
    watch: { ...BASE, tool: true },
  },
  {
    id: "tiny",
    title: t("A tiny job", "Un trabajo diminuto"),
    change: t("A job of 0.3 s instead of 16 s · 1 worker with 1 chunk vs 8 workers with 8 chunks", "Un trabajo de 0.3 s en vez de 16 s · 1 trabajador con 1 bloque contra 8 trabajadores con 8 bloques"),
    question: t("Which finishes first?", "¿Cuál termina primero?"),
    options: [t("8 workers, about 8× sooner", "8 trabajadores, cerca de 8× antes"), t("1 worker", "1 trabajador"), t("They tie", "Empatan")],
    answer: 1,
    why: t("Splitting has a fixed cost per chunk: the foreman hands each one out and the packing station merges each one back. On a big job that cost is lost in the noise; on a tiny one it is bigger than the work saved. Parallelise work that is large compared with the cost of coordinating it, and batch small items together.",
      "Dividir tiene un costo fijo por bloque: el capataz reparte cada uno y la estación de empaque une cada uno de vuelta. En un trabajo grande ese costo se pierde en el ruido; en uno diminuto es mayor que el trabajo ahorrado. Paraleliza el trabajo que es grande comparado con el costo de coordinarlo, y agrupa los elementos pequeños en lotes."),
    watch: { ...BASE, job: "tiny" },
  },
  {
    id: "uneven",
    title: t("One heavy chunk", "Un bloque pesado"),
    change: t("Uneven data: the first eighth of the job holds a third of the work · 8 chunks vs 32 chunks, 8 workers", "Datos disparejos: el primer octavo del trabajo contiene un tercio del total · 8 bloques contra 32 bloques, 8 trabajadores"),
    question: t("With 8 chunks, what happens to the job time?", "Con 8 bloques, ¿qué pasa con el tiempo del trabajo?"),
    options: [t("Nothing: the total work is the same", "Nada: el trabajo total es el mismo"), t("It roughly doubles, until the job is cut into smaller chunks", "Se duplica más o menos, hasta que el trabajo se corta en bloques más pequeños"), t("It gets shorter: big chunks cost less to hand out", "Se acorta: los bloques grandes cuestan menos de repartir")],
    answer: 1,
    why: t("The job only finishes when its slowest chunk does. With 8 chunks, one worker gets the heavy one while seven finish early and stand idle. Cutting the job into 32 smaller chunks lets free workers keep taking the next one, which spreads the heavy part out. That is what work-stealing schedulers and dynamic batching do.",
      "El trabajo solo termina cuando termina su bloque más lento. Con 8 bloques, un trabajador recibe el pesado mientras siete terminan pronto y se quedan sin hacer nada. Cortar el trabajo en 32 bloques más pequeños permite que los trabajadores libres sigan tomando el siguiente, lo que reparte la parte pesada. Eso hacen los planificadores con robo de trabajo (work-stealing) y el agrupamiento dinámico en lotes."),
    watch: { ...BASE, data: "uneven" },
  },
];

const QUESTIONS = [
  [t("Your batch job takes 60 minutes on one core and 20% of it can't be parallelised. What's the best it can do on 16 cores, and on infinitely many?", "Tu trabajo por lotes tarda 60 minutos en un núcleo y el 20% no se puede paralelizar. ¿Qué es lo mejor que puede lograr con 16 núcleos, y con infinitos?"),
    t("Amdahl: 1 / (0.2 + 0.8/16) = 4×, so 15 minutes. With infinite cores it approaches 1/0.2 = 5×, 12 minutes: the serial part alone takes 12 minutes. To go further you have to shrink the serial part, not add cores.",
      "Amdahl: 1 / (0.2 + 0.8/16) = 4×, o sea 15 minutos. Con núcleos infinitos se acerca a 1/0.2 = 5×, 12 minutos: la parte serial sola toma 12 minutos. Para ir más lejos tienes que reducir la parte serial, no agregar núcleos.")],
  [t("What's the difference between concurrency and parallelism?", "¿Cuál es la diferencia entre concurrencia y paralelismo?"),
    t("Concurrency is dealing with many things at once: tasks overlap in time, even on one core, by taking turns. Parallelism is doing many things at the same instant, which needs several cores or machines. Concurrency is about structure; parallelism is about execution.",
      "La concurrencia es lidiar con muchas cosas a la vez: las tareas se superponen en el tiempo, incluso en un núcleo, turnándose. El paralelismo es hacer muchas cosas en el mismo instante, lo que requiere varios núcleos o máquinas. La concurrencia trata de la estructura; el paralelismo, de la ejecución.")],
  [t("A teammate sets a thread pool to 200 threads on an 8-core server to make CPU-heavy image resizing faster. What do you expect?", "Un compañero configura un pool de hilos (thread pool) con 200 hilos en un servidor de 8 núcleos para acelerar el redimensionado de imágenes, que usa mucha CPU. ¿Qué esperas?"),
    t("No speed-up beyond 8 at a time, plus extra switching and memory per thread, so it may get slower. For CPU-bound work, size the pool near the core count; large pools only help work that mostly waits on I/O.",
      "Ninguna aceleración más allá de 8 a la vez, más cambios extra y memoria por hilo, así que puede volverse más lento. Para trabajo limitado por CPU, dimensiona el pool cerca de la cantidad de núcleos; los pools grandes solo ayudan al trabajo que pasa casi todo el tiempo esperando E/S.")],
  [t("Why can adding workers make a program slower?", "¿Por qué agregar trabajadores puede volver más lento un programa?"),
    t("Coordination overhead (splitting, scheduling, merging) and contention on shared things: a lock, a shared counter, a single connection, cache lines bouncing between cores. If those grow with the number of workers, past some point each new worker costs more than it adds.",
      "Por la sobrecarga de coordinación (dividir, planificar, unir) y la contención por cosas compartidas: un lock, un contador compartido, una sola conexión, líneas de caché que rebotan entre núcleos. Si eso crece con la cantidad de trabajadores, a partir de cierto punto cada trabajador nuevo cuesta más de lo que aporta.")],
  [t("Your parallel job's progress bar sits at 95% for a long time. What's the likely cause and the fix?", "La barra de progreso de tu trabajo paralelo se queda en 95% mucho tiempo. ¿Cuál es la causa probable y cómo se arregla?"),
    t("Uneven work: one chunk is much bigger than the others, so one worker is still busy while the rest are idle. Use smaller chunks with a shared queue (or a work-stealing scheduler), or split by work done rather than by item count.",
      "Trabajo disparejo: un bloque es mucho más grande que los demás, así que un trabajador sigue ocupado mientras el resto está inactivo. Usa bloques más pequeños con una cola compartida (o un planificador con robo de trabajo), o divide según el trabajo y no según la cantidad de elementos.")],
  [t("Where do you meet these ideas outside threads?", "¿Dónde encuentras estas ideas fuera de los hilos?"),
    t("Everywhere work is spread out: map-reduce and Spark jobs, CI pipelines split across runners, database queries using parallel workers, Kubernetes jobs with many pods. The same rules hold: the serial step (a final merge, a single writer), coordination cost and stragglers decide the speed-up.",
      "En todo lugar donde el trabajo se reparte: trabajos de map-reduce y Spark, pipelines de CI divididos entre runners, consultas a la base de datos con workers paralelos, jobs de Kubernetes con muchos pods. Valen las mismas reglas: el paso serial (una unión final, un solo escritor), el costo de coordinación y los rezagados deciden la aceleración.")],
];

export default defineLesson({
  title: t("Parallelism Workbench", "Banco de trabajo: paralelismo"),
  eyebrow: t("Systems lesson 14 · Parallelism", "Lección de sistemas 14 · Paralelismo"),
  lede: t("Parallelism is doing many pieces of work at the same instant, on several cores or machines. More workers help only as far as the work can be split, shared things allow and coordination costs. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "El paralelismo es hacer muchas partes de un trabajo en el mismo instante, en varios núcleos o máquinas. Más trabajadores ayudan solo hasta donde el trabajo se puede dividir, lo compartido lo permite y la coordinación lo cuesta. Esta lección construye esa idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Each workbench is a core and each worker a thread. Watch eight workers share a job, then change the workers, the serial part or the chunks and see the speed-up move.", "Cada banco de trabajo es un núcleo y cada trabajador, un hilo. Mira a ocho trabajadores compartir un trabajo, y luego cambia los trabajadores, la parte serial o los bloques y observa cómo se mueve la aceleración."),
    plate: {
      title: t("Workshop", "Taller"),
      keys: [
        { mark: "lit", label: t("Work happening this instant: a chunk being worked, the tool in use, the press", "Trabajo en este instante: un bloque en proceso, la herramienta en uso, la prensa") },
        { mark: "raised", label: t("Workbenches: the cores", "Bancos de trabajo: los núcleos") },
        { mark: "flat", label: t("Packing station: the serial part", "Estación de empaque: la parte serial") },
      ],
      caption: t(
        "The foreman in the cap splits each job into chunks and stacks them on the pallet. A worker with nothing to do takes the next chunk to its bench; the chunk shrinks as it is worked on and is lit while someone is working on it. Workers who share a bench take turns: the one stepped back is waiting. The T-handled tool on the rack is the one shared tool; with it switched on, the end of every chunk needs it, so it travels to the bench using it and the others drop a token on the rail beside the rack and wait their turn. Finished chunks land in the packing tray, and when all are in, the packing station merges them and presses the job alone while the benches stand empty. The dial on the desk turns once in the time one worker would need.",
        "El capataz de gorra divide cada trabajo en bloques y los apila en el palé. Un trabajador sin nada que hacer lleva el siguiente bloque a su banco; el bloque se encoge mientras se trabaja y se ilumina mientras alguien lo trabaja. Los trabajadores que comparten un banco se turnan: el que está un paso atrás espera. La herramienta con mango en T del soporte es la única herramienta compartida; cuando está encendida, el final de cada bloque la necesita, así que viaja al banco que la usa y los demás dejan una ficha en el riel junto al soporte y esperan su turno. Los bloques terminados caen en la bandeja de empaque y, cuando están todos, la estación de empaque los une y prensa el trabajo sola mientras los bancos quedan vacíos. El dial del escritorio da una vuelta en el tiempo que necesitaría un solo trabajador."),
      stage: { "data-office": "" },
      label: t("Workshop simulation. Space pauses or resumes.", "Simulación del taller. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["jobs", t("Jobs done", "Trabajos hechos")], ["last", t("Last job", "Último trabajo"), "–"], ["speedup", t("Speed-up", "Aceleración"), "–"], ["limit", t("Amdahl limit", "Límite de Amdahl"), "–"], ["busy", t("Benches busy", "Bancos ocupados"), "–"], ["toolwait", t("Waiting for tool", "Esperando herramienta"), "–"]],
    controls: [
      { seg: "workers", label: t("Workers", "Trabajadores"), options: [[1, "1"], [2, "2"], [4, "4"], [8, "8"], [16, "16"]], value: 8 },
      { seg: "cores", label: t("Benches (cores)", "Bancos (núcleos)"), options: [[4, "4"], [8, "8"]], value: 8 },
      { seg: "serial", label: t("Serial part", "Parte serial"), options: [[0, "0%"], [0.1, "10%"], [0.3, "30%"]], value: 0.1 },
      { seg: "chunks", label: t("Chunks per job", "Bloques por trabajo"), options: [[1, "1"], [8, "8"], [16, "16"], [32, "32"]], value: 8 },
      { seg: "tool", label: t("Shared tool", "Herramienta compartida"), options: [["false", t("Off", "Apagada")], ["true", t("On", "Encendida")]], value: "false" },
      { seg: "job", label: t("Job size", "Tamaño del trabajo"), options: [["big", "16 s"], ["tiny", "0.3 s"]], value: "big" },
      { seg: "data", label: t("Work per chunk", "Trabajo por bloque"), options: [["even", t("Even", "Parejo")], ["uneven", t("One heavy part", "Una parte pesada")]], value: "even" },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Acciones") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs of one job.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados en seis ejecuciones con semilla de un mismo trabajo."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  data: {
    P,
    G: GEOMETRY,
    BASE,
    RESULTS,
    PAWN_SVG: pawnSvg(),
    EXP_ES: Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e.title.es])),
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
