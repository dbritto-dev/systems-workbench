// @ts-nocheck: content ported as-is
// Systems lesson 04 · Circuit breakers: a telephone switchboard calling a supplier exchange.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct as percent, secs1 } from "../../lib/format";
import { buildFigure, P, GEOMETRY } from "./figure";
import { experimentResults, WINDOW } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const RESULTS = experimentResults();

// What each card shows after a run (8 seeds each).
const recoveryText = (r) => r.recovered === 0 ? t("> " + WINDOW + " s", "> " + WINDOW + " s")
  : r.recovered < r.runs ? t(secs1(r.recovery) + " (" + r.recovered + " of " + r.runs + " runs)", secs1(r.recovery) + " (" + r.recovered + " de " + r.runs + " ejecuciones)")
  : t(secs1(r.recovery), secs1(r.recovery));
const recoveryShare = (r) => r.recovered === 0 ? 1 : Math.min(1, r.recovery / WINDOW);
const RUNS = {
  slow: () => {
    const { a, b, c } = RESULTS.slow;
    return { verdict: t("Requests that never call the supplier: " + percent(a.localServed) + " served when it was healthy, " + percent(b.localServed) + " when it was slow. " + percent(b.dropped) + " of all requests were turned away at the door. For comparison, a supplier that is down and refuses each call at once: " + percent(c.localServed) + " served.",
        "Solicitudes que nunca llaman al proveedor: " + percent(a.localServed) + " atendidas cuando estaba sano, " + percent(b.localServed) + " cuando estaba lento. El " + percent(b.dropped) + " de todas las solicitudes se rechazó en la entrada. Para comparar, con un proveedor caído que rechaza cada llamada al instante: " + percent(c.localServed) + " atendidas."),
      bars: [[t("Healthy supplier", "Proveedor sano"), a.localServed, percent(a.localServed)], [t("Slow supplier", "Proveedor lento"), b.localServed, percent(b.localServed), true], [t("Down, refuses at once", "Caído, rechaza al instante"), c.localServed, percent(c.localServed)]] };
  },
  timeout: () => {
    const { a, b } = RESULTS.timeout;
    const top = Math.max(a.p95Supplier, b.p95Supplier);
    return { verdict: t("Requests that never call the supplier went from " + percent(a.localServed) + " to " + percent(b.localServed) + " served. Supplier requests now fail: " + percent(b.failedSlow) + " of all requests failed after waiting out the timeout.",
        "Las solicitudes que nunca llaman al proveedor pasaron de " + percent(a.localServed) + " a " + percent(b.localServed) + " atendidas. Las solicitudes al proveedor ahora fallan: el " + percent(b.failedSlow) + " de todas las solicitudes falló después de esperar el tiempo límite completo."),
      bars: [[t("No timeout: others served", "Sin límite: otras atendidas"), a.localServed, percent(a.localServed)], [t("1.5 s: others served", "1.5 s: otras atendidas"), b.localServed, percent(b.localServed), true], [t("No timeout: p95 wait", "Sin límite: espera p95"), a.p95Supplier / top, secs1(a.p95Supplier)], [t("1.5 s: p95 wait", "1.5 s: espera p95"), b.p95Supplier / top, secs1(b.p95Supplier), true]] };
  },
  breaker: () => {
    const { a, b } = RESULTS.breaker;
    const top = Math.max(a.p50Supplier, b.p50Supplier);
    return { verdict: t("Calls in progress at the supplier: " + a.load.toFixed(1) + " → " + b.load.toFixed(1) + " on average. A supplier request now fails in " + secs1(b.p50Supplier) + " (median), not " + secs1(a.p50Supplier) + ".",
        "Llamadas en curso en el proveedor: " + a.load.toFixed(1) + " → " + b.load.toFixed(1) + " en promedio. Una solicitud al proveedor ahora falla en " + secs1(b.p50Supplier) + " (mediana), no en " + secs1(a.p50Supplier) + "."),
      bars: [[t("Breaker off: load", "Sin interruptor: carga"), a.load / 15, a.load.toFixed(1)], [t("Breaker on: load", "Con interruptor: carga"), b.load / 15, b.load.toFixed(1), true], [t("Breaker off: median wait", "Sin interruptor: espera mediana"), a.p50Supplier / top, secs1(a.p50Supplier)], [t("Breaker on: median wait", "Con interruptor: espera mediana"), b.p50Supplier / top, secs1(b.p50Supplier), true]] };
  },
  retries: () => {
    const { a, b, c } = RESULTS.retries;
    const ra = recoveryText(a), rb = recoveryText(b), rc = recoveryText(c);
    return { verdict: t("Time from the fix to the first successful supplier call with three immediate retries: " + rb.en + " without a breaker, " + rc.en + " behind one (" + ra.en + " with no retries and no breaker).",
        "Tiempo desde el arreglo hasta la primera llamada exitosa al proveedor con tres reintentos inmediatos: " + rb.es + " sin interruptor, " + rc.es + " detrás de uno (" + ra.es + " sin reintentos ni interruptor)."),
      bars: [[t("3 retries, no breaker", "3 reintentos, sin interruptor"), recoveryShare(b), rb], [t("3 retries + breaker", "3 reintentos + interruptor"), recoveryShare(c), rc, true], [t("No retries, no breaker", "Sin reintentos ni interruptor"), recoveryShare(a), ra]] };
  },
  cooldown: () => {
    const { a, b, c } = RESULTS.cooldown;
    const ra = recoveryText(a), rb = recoveryText(b), rc = recoveryText(c);
    return { verdict: t("Time from the fix to the first successful supplier call: " + rb.en + " with a 5 s cooldown, " + rc.en + " with a 30 s cooldown (" + ra.en + " with no breaker at all).",
        "Tiempo desde el arreglo hasta la primera llamada exitosa al proveedor: " + rb.es + " con un enfriamiento de 5 s, " + rc.es + " con uno de 30 s (" + ra.es + " sin ningún interruptor)."),
      bars: [[t("No breaker", "Sin interruptor"), recoveryShare(a), ra], [t("Cooldown 5 s", "Enfriamiento 5 s"), recoveryShare(b), rb], [t("Cooldown 30 s", "Enfriamiento 30 s"), recoveryShare(c), rc, true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "slow",
    title: t("The supplier slows down", "El proveedor se pone lento"),
    change: t("Supplier healthy → slow · each call now takes about 6 s · no timeout, no breaker", "Proveedor sano → lento · cada llamada ahora tarda unos 6 s · sin tiempo límite, sin interruptor"),
    question: t("Three in ten requests never call the supplier. What happens to them?", "Tres de cada diez solicitudes nunca llaman al proveedor. ¿Qué les pasa?"),
    options: [
      t("Served as usual: only supplier calls wait", "Se atienden como siempre: solo esperan las del proveedor"),
      t("Served, but a little slower than usual", "Se atienden, pero algo más lento que de costumbre"),
      t("Most are turned away at the door", "La mayoría se rechaza en la entrada"),
    ],
    answer: 2,
    why: t("Every worker that picks up a supplier request sits on the line for 6 seconds. Requests needing the supplier arrive faster than that, so soon all six workers are stuck waiting and the tray at the door is full. Requests that would take 0.4 s on their own are turned away because there is nobody to serve them. A dependency that fails fast does far less harm: when the supplier is down and refuses each call at once, the worker is back in a fraction of a second. But a host that is down does not always refuse: if it has vanished from the network, the call hangs until a timeout, like the Failing setting.",
      "Cada worker que toma una solicitud para el proveedor se queda 6 segundos en la línea. Las solicitudes que necesitan al proveedor llegan más rápido que eso, así que pronto los seis workers están atascados esperando y la bandeja de la entrada está llena. Solicitudes que solas tardarían 0.4 s se rechazan porque no hay nadie para atenderlas. Una dependencia que falla rápido hace mucho menos daño: cuando el proveedor está caído y rechaza cada llamada al instante, el worker vuelve en una fracción de segundo. Pero un host caído no siempre rechaza: si desapareció de la red, la llamada se cuelga hasta un tiempo límite, como en el modo Fallando."),
    watch: { cause: "slow", timeout: 0, breaker: "false", retries: "0" },
  },
  {
    id: "timeout",
    title: t("Add a timeout", "Agrega un tiempo límite"),
    change: t("Slow supplier, as before · timeout off → 1.5 s", "Proveedor lento, como antes · tiempo límite no → 1.5 s"),
    question: t("With a 1.5 s timeout, what happens to the requests that need the supplier?", "Con un tiempo límite de 1.5 s, ¿qué pasa con las solicitudes que necesitan al proveedor?"),
    options: [
      t("Most still succeed, just in less time", "La mayoría sigue teniendo éxito, en menos tiempo"),
      t("They fail at 1.5 s; the rest are served", "Fallan a los 1.5 s; las demás se atienden"),
      t("Nothing changes: the supplier is still slow", "Nada cambia: el proveedor sigue lento"),
    ],
    answer: 1,
    why: t("A timeout doesn't make the supplier faster. It caps how long a worker can be held, so workers come back and the requests that don't need the supplier are served again. The supplier requests still fail, and every one of them waits the full timeout first.",
      "Un tiempo límite no hace más rápido al proveedor. Pone un tope a cuánto tiempo se puede retener a un worker, así que los workers vuelven y las solicitudes que no necesitan al proveedor se atienden otra vez. Las solicitudes al proveedor siguen fallando, y cada una espera primero el tiempo límite completo."),
    watch: { cause: "slow", timeout: 1.5, breaker: "false", retries: "0" },
  },
  {
    id: "breaker",
    title: t("Add the breaker", "Agrega el interruptor"),
    change: t("Supplier failing (hangs, then errors) · timeout 1.5 s · breaker off → on (opens after 5 failures in a row, 5 s cooldown)", "Proveedor fallando (se cuelga y luego falla) · tiempo límite 1.5 s · interruptor no → sí (se abre tras 5 fallas seguidas, enfriamiento (cooldown) de 5 s)"),
    question: t("With the breaker on, what happens to the load on the supplier?", "Con el interruptor activado, ¿qué pasa con la carga sobre el proveedor?"),
    options: [
      t("About the same: the same requests keep arriving", "Casi igual: siguen llegando las mismas solicitudes"),
      t("Almost none: requests fail at the breaker", "Casi ninguna: las solicitudes fallan en el interruptor"),
      t("It rises: the breaker keeps sending probes", "Sube: el interruptor sigue mandando pruebas"),
    ],
    answer: 1,
    why: t("After five failures in a row, the breaker opens and requests fail at the breaker instead of waiting on the line. Your workers are free, and the supplier stops receiving calls, apart from one probe after each cooldown. The requests still fail, but quickly, and the supplier gets room to recover.",
      "Tras cinco fallas seguidas, el interruptor se abre y las solicitudes fallan en el interruptor en lugar de esperar en la línea. Tus workers quedan libres, y el proveedor deja de recibir llamadas, salvo una de prueba después de cada enfriamiento. Las solicitudes siguen fallando, pero rápido, y el proveedor tiene espacio para recuperarse."),
    watch: { cause: "failing", timeout: 1.5, breaker: "true", retries: "0" },
  },
  {
    id: "retries",
    title: t("Retries behind a breaker", "Reintentos detrás de un interruptor"),
    change: t("Supplier failing, fixed after 20 s · timeout 1.5 s · 3 immediate retries · breaker off → on", "Proveedor fallando, se arregla a los 20 s · tiempo límite 1.5 s · 3 reintentos inmediatos · interruptor no → sí"),
    question: t("On their own, three immediate retries keep a failing supplier overloaded long after the fix. Put them behind the breaker: when do supplier calls succeed again?", "Solos, tres reintentos inmediatos mantienen sobrecargado a un proveedor que falla mucho después del arreglo. Ponlos detrás del interruptor: ¿cuándo vuelven a tener éxito las llamadas al proveedor?"),
    options: [
      t("Still long after: the retries pile up", "Igual mucho después: los reintentos se acumulan"),
      t("Seconds after the fix, as with no retries", "Segundos después del arreglo, como sin reintentos"),
      t("Later still: the breaker adds its cooldown", "Aún más tarde: el interruptor suma su enfriamiento"),
    ],
    answer: 1,
    why: t("Without the breaker, each failing request makes up to four calls and the abandoned ones keep running on the supplier, so its load stays past what it can handle after the cause is fixed: the retries become the outage (lesson 06, Retry storms, shows that storm in depth). Behind an open breaker, a retry fails at the breaker in a fraction of a second instead of making another call, so the retries add almost no load. The supplier is not buried, and the first probe after the fix gets through about as soon as with no retries at all.",
      "Sin el interruptor, cada solicitud que falla hace hasta cuatro llamadas y las abandonadas siguen ejecutándose en el proveedor, así que su carga sigue por encima de lo que puede manejar después de arreglada la causa: los reintentos se convierten en la caída (la lección 06, Tormentas de reintentos, muestra esa tormenta en detalle). Con el interruptor abierto, un reintento falla en el interruptor en una fracción de segundo en lugar de hacer otra llamada, así que los reintentos casi no agregan carga. El proveedor no queda sepultado, y la primera prueba después del arreglo pasa casi tan pronto como sin reintentos."),
    watch: { cause: "failing", timeout: 1.5, breaker: "true", retries: "3", fixAfter: 20 },
  },
  {
    id: "cooldown",
    title: t("A long cooldown", "Un enfriamiento largo"),
    change: t("Supplier failing, fixed after 20 s · timeout 1.5 s · breaker on · cooldown 5 s → 30 s", "Proveedor fallando, se arregla a los 20 s · tiempo límite 1.5 s · interruptor sí · enfriamiento 5 s → 30 s"),
    question: t("With a 30 s cooldown, how soon after the fix does traffic flow again?", "Con un enfriamiento de 30 s, ¿cuánto después del arreglo vuelve a fluir el tráfico?"),
    options: [
      t("Right away: the breaker notices the fix", "De inmediato: el interruptor nota el arreglo"),
      t("When the cooldown ends and a probe passes", "Cuando termina el enfriamiento y pasa una prueba"),
      t("Not until someone resets it by hand", "Hasta que alguien lo reinicie a mano"),
    ],
    answer: 1,
    why: t("An open breaker doesn't watch the supplier. It waits out the cooldown, then lets one probe through (half-open). If the probe succeeds the breaker closes; if it fails it opens for another cooldown. A long cooldown keeps you failing after the supplier is healthy; a short one probes more often but costs little, since it's one call.",
      "Un interruptor abierto no vigila al proveedor. Espera a que termine el enfriamiento y luego deja pasar una llamada de prueba (semiabierto, half-open). Si la prueba tiene éxito, el interruptor se cierra; si falla, se abre por otro enfriamiento. Un enfriamiento largo te deja fallando cuando el proveedor ya está sano; uno corto prueba más seguido pero cuesta poco, porque es una sola llamada."),
    watch: { cause: "failing", timeout: 1.5, breaker: "true", retries: "0", cooldown: 30, fixAfter: 20 },
  },
];

const QUESTIONS = [
  [t("Why can a slow dependency hurt you more than one that is down?", "¿Por qué una dependencia lenta te puede hacer más daño que una caída?"),
    t("A dependency that fails fast (connection refused, an immediate 5xx) releases your workers at once. A slow one holds each worker for the whole call. Once every worker is waiting, nothing else can be served, not even requests that never touch that dependency. That is how one slow service takes down endpoints that have nothing to do with it. A dependency that is down does not always fail fast: if its host has vanished, connections hang until a timeout, so it behaves like a slow one.",
      "Una dependencia que falla rápido (conexión rechazada, un 5xx inmediato) libera a tus workers de inmediato. Una lenta retiene a cada worker durante toda la llamada. Cuando todos los workers están esperando, no se puede atender nada más, ni siquiera solicitudes que nunca tocan esa dependencia. Así es como un servicio lento tumba endpoints que no tienen nada que ver con él. Una dependencia caída no siempre falla rápido: si su host desapareció, las conexiones se cuelgan hasta un tiempo límite, así que se comporta como una lenta.")],
  [t("How would you choose a timeout for a call to another service?", "¿Cómo elegirías el tiempo límite (timeout) de una llamada a otro servicio?"),
    t("Start from that service's normal latency (for example its p99 plus a margin) and keep it shorter than your own caller's deadline (lesson 46, Timeouts & deadlines). Too long and workers pile up behind a slow call; too short and normal jitter turns into false failures. A timeout should be set on purpose, never left at a library default of 30 s or infinity.",
      "Parte de la latencia normal de ese servicio (por ejemplo su p99 más un margen) y mantenlo por debajo del plazo (deadline) de quien te llama a ti (lección 46, Timeouts y plazos). Demasiado largo y los workers se amontonan detrás de una llamada lenta; demasiado corto y la variación aleatoria (jitter) normal se vuelve fallas falsas. Un tiempo límite se fija a propósito, nunca se deja en el valor por defecto de una biblioteca de 30 s o infinito.")],
  [t("A circuit breaker protects whom: your service, the supplier, or both?", "Un interruptor de circuito (circuit breaker), ¿a quién protege: a tu servicio, al proveedor o a ambos?"),
    t("Both. It releases your workers by failing fast, and it takes load off the supplier so it can recover. The cost is that requests fail without even trying while it is open, so you need a fallback for them.",
      "A ambos. Libera a tus workers fallando rápido, y le quita carga al proveedor para que se pueda recuperar. El costo es que, mientras está abierto, las solicitudes fallan sin siquiera intentarlo, así que necesitas un plan B (fallback) para ellas.")],
  [t("Why can automatic retries make an outage longer, and how do you retry safely?", "¿Por qué los reintentos automáticos pueden alargar una caída, y cómo se reintenta de forma segura?"),
    t("Retries multiply the load at the worst moment: three retries can mean four times the calls to a struggling service, which keeps it overloaded after the original cause is fixed. Retry only idempotent operations (lesson 25, Idempotency keys), keep the count small, add exponential backoff with jitter, use a retry budget, and put retries behind a breaker. Lesson 06, Retry storms, shows this in depth.",
      "Los reintentos multiplican la carga en el peor momento: tres reintentos pueden significar cuatro veces las llamadas a un servicio que ya está en problemas, lo que lo mantiene sobrecargado después de arreglada la causa original. Reintenta solo operaciones idempotentes (lección 25, Claves de idempotencia), mantén pocos reintentos, agrega espera exponencial con variación aleatoria, usa un presupuesto de reintentos (retry budget) y pon los reintentos detrás de un interruptor. La lección 06, Tormentas de reintentos, lo muestra en detalle.")],
  [t("What is the half-open state for, and what goes wrong if the cooldown is too long or too short?", "¿Para qué sirve el estado semiabierto (half-open), y qué sale mal si el enfriamiento es demasiado largo o demasiado corto?"),
    t("After the cooldown, half-open lets a single probe through to test the supplier without sending it full traffic. Success closes the breaker; failure opens it again. Too long a cooldown keeps you failing after the supplier has recovered; too short a cooldown makes it flap, which costs little load but makes noisy alerts and logs.",
      "Después del enfriamiento, el estado semiabierto deja pasar una sola llamada de prueba para probar al proveedor sin mandarle todo el tráfico. El éxito cierra el interruptor; la falla lo vuelve a abrir. Un enfriamiento demasiado largo te deja fallando cuando el proveedor ya se recuperó; uno demasiado corto lo hace oscilar (flapping), lo que agrega poca carga pero llena de ruido las alertas y los logs.")],
  [t("The breaker is open. What should the user see?", "El interruptor está abierto. ¿Qué debería ver el usuario?"),
    t("A fast, honest response: a cached or default value, a degraded feature (\"recommendations unavailable\"), or a clear error. Not a spinner that waits for a timeout. Deciding the fallback is part of adding a breaker.",
      "Una respuesta rápida y honesta: un valor en caché o por defecto, una función degradada (\"recomendaciones no disponibles\") o un error claro. No un spinner que espera a que se cumpla el tiempo límite. Decidir el plan B es parte de agregar un interruptor.")],
];

export default defineLesson({
  title: t("Circuit Breaker Workbench", "Banco de trabajo: interruptores de circuito"),
  eyebrow: t("Systems lesson 04 · Circuit breakers", "Lección de sistemas 04 · Interruptores de circuito"),
  lede: t("When a service you depend on gets slow or fails, the danger is not the failed calls: it is your own workers waiting on them. This lesson shows how timeouts, retries and a circuit breaker change that, three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Cuando un servicio del que dependes se pone lento o falla, el peligro no son las llamadas fallidas: son tus propios workers esperándolas. Esta lección muestra cómo lo cambian los tiempos límite (timeouts), los reintentos y un interruptor de circuito (circuit breaker), de tres maneras: mira una máquina hacerlo, predice qué la rompe y luego explícalo con tus palabras."),
  machine: {
    intro: t("The six operator positions are your service's workers. The cabinet at the back right is a supplier you call over the network. Set it to Slow (it answers after about 6 s), Failing (it hangs as long, then errors) or Down (it refuses each call at once), then try a timeout, the breaker and retries, and watch the counters.",
      "Los seis puestos de operador son los workers de tu servicio. El gabinete del fondo a la derecha es un proveedor al que llamas por la red. Ponlo en Lento (responde a los 6 s, más o menos), Fallando (se cuelga lo mismo y luego da error) o Caído (rechaza cada llamada al instante), luego prueba un tiempo límite, el interruptor y los reintentos, y mira los contadores."),
    plate: {
      title: t("Switchboard", "Conmutador"),
      keys: [
        { mark: "lit", label: t("A cord in the trunk: a worker waiting on the supplier", "Un cordón en la troncal: un worker esperando al proveedor") },
        { mark: "raised", label: t("Six operator positions: the thread pool", "Seis puestos de operador: el pool de hilos (thread pool)") },
        { mark: "flat", label: t("Knife-switch breaker between the board and the supplier", "Interruptor de cuchilla entre el tablero y el proveedor") },
      ],
      caption: t(
        "About three calls a second come in; the lamps at the top are calls waiting for a free operator (four at most; the separate lamp flashes when one is turned away). An operator plugs into the lower row for work done in-house, or into the upper trunk row to call the supplier, and stays plugged in until the supplier answers or the timeout pulls the cord. The knob at the right end of the keyshelf is the timeout (off, 1.5 s, 4 s). The dial in front of each position shows how long its cord has been in (one turn is 8 s). The breaker's blade is down when closed, half raised when it lets one test call through, and up when open, with a shutter dropped over the trunk jacks. Its dials count failures and the cooldown. The gauge on the supplier shows calls in progress against what it can handle.",
        "Entran unas tres llamadas por segundo; las lámparas de arriba son llamadas esperando a un operador libre (cuatro como máximo; la lámpara aparte parpadea cuando se rechaza una). Un operador se conecta a la fila de abajo para el trabajo que se hace en casa, o a la fila troncal de arriba para llamar al proveedor, y queda conectado hasta que el proveedor responde o el tiempo límite (timeout) saca el cordón. La perilla del extremo derecho de la repisa es el tiempo límite (no, 1.5 s, 4 s). El reloj frente a cada puesto muestra cuánto tiempo lleva conectado su cordón (una vuelta son 8 s). La cuchilla del interruptor está abajo cuando está cerrado, a media altura cuando deja pasar una llamada de prueba, y arriba cuando está abierto, con una cortina bajada sobre los conectores de la troncal. Sus relojes cuentan las fallas y el enfriamiento (cooldown). El medidor del proveedor muestra las llamadas en curso frente a lo que puede manejar."),
      stage: { "data-office": "" },
      label: t("Switchboard simulation. Space pauses or resumes.", "Simulación del conmutador. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["served", t("Served", "Atendidas")], ["fast", t("Failed fast", "Falla rápida")], ["slow", t("Failed slow", "Falla lenta")], ["dropped", t("Turned away", "Sin lugar")], ["p95", t("p95 wait", "Espera p95"), "–"], ["load", t("Supplier load", "Carga proveedor")]],
    controls: [
      { seg: "cause", label: t("Supplier", "Proveedor"), options: [["healthy", t("Healthy", "Sano")], ["slow", t("Slow", "Lento")], ["failing", t("Failing", "Fallando")], ["down", t("Down", "Caído")]], value: "healthy" },
      { seg: "timeout", label: t("Timeout", "Tiempo límite"), options: [[0, t("Off", "No")], [1.5, "1.5 s"], [4, "4 s"]], value: 0 },
      { seg: "breaker", label: t("Circuit breaker", "Interruptor"), options: [["false", t("Off", "No")], ["true", t("On", "Sí")]], value: "false" },
      { seg: "threshold", label: t("Opens after", "Se abre tras"), options: [[3, t("3 fails", "3 fallas")], [5, t("5 fails", "5 fallas")], [10, t("10 fails", "10 fallas")]], value: 5 },
      { seg: "cooldown", label: t("Cooldown", "Enfriamiento"), options: [[5, "5 s"], [30, "30 s"]], value: 5 },
      { seg: "retries", label: t("Retries", "Reintentos"), options: [["0", t("None", "Ninguno")], ["3", t("3 now", "3 al instante")], ["3b", t("3 + backoff", "3 + backoff")]], value: "0" },
      { speed: true },
      { actions: [["reset", t("Reset counts", "Reiniciar conteos")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over eight seeded runs of the same machine, about 50 to 70 seconds of traffic each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados son el promedio de ocho ejecuciones con semilla fija de la misma máquina, de unos 50 a 70 segundos de tráfico cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
[data-op]>[data-v]{display:none}
[data-op][data-state="rest"]>[data-v="rest"],[data-op][data-state="local"]>[data-v="local"],[data-op][data-state="trunk"]>[data-v="trunk"],[data-op][data-state="bounce"]>[data-v="bounce"]{display:inline}
.cord-out{fill:none;stroke:var(--anatomy-mid);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.cord-in{fill:none;stroke:var(--anatomy-card);stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
.cord-lit{fill:none;stroke:var(--anatomy-lit);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.lamp{fill:var(--anatomy-card);stroke:none;transition:fill .15s}
.lamp[data-on]{fill:var(--anatomy-hi)}
.jack-hole{fill:var(--anatomy-hi);stroke:none;opacity:.55}
.gauge-fill{fill:var(--anatomy-mid);stroke:none}
.flow[data-off]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
  },
});
