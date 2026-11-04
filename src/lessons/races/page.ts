// @ts-nocheck: content ported as-is
// Systems lesson 17 · Race conditions: clerks in a bank office updating one shared ledger card, or booking seats.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, clerkSvg, P, GEOMETRY } from "./figure";
import { average } from "./sim";
import { one as r1, pct } from "../../lib/format";

// Experiment results, computed at build time from the same model the page runs (the original page ran these
// same seeded runs in the browser when a card was run). Each is the average over eight seeds, without the runs.
const avg = (cfg) => { const { runs, ...mean } = average(cfg); return mean; };
const D = { scenario: "deposits", traffic: "busy", quota: 100 };
const RESULTS = {
  overlap: [0.2, 1, 3].map((think) => avg({ ...D, clerks: 2, think, protection: "none" })),
  lock: { none: avg({ ...D, clerks: 4, think: 1, protection: "none" }), lock: avg({ ...D, clerks: 4, think: 1, protection: "lock" }), one: avg({ ...D, clerks: 1, think: 1, protection: "none" }) },
  cas: { two: avg({ ...D, clerks: 2, think: 1, protection: "cas" }), four: avg({ ...D, clerks: 4, think: 1, protection: "cas" }), lock: avg({ ...D, clerks: 4, think: 1, protection: "lock" }), atomic: avg({ ...D, clerks: 4, think: 1, protection: "atomic" }) },
  booking: { none: avg({ scenario: "booking", traffic: "busy", clerks: 3, think: 1, protection: "none" }), cas: avg({ scenario: "booking", traffic: "busy", clerks: 3, think: 1, protection: "cas" }) },
  hidden: { unit: avg({ ...D, clerks: 1, think: 1, protection: "none" }), manual: avg({ ...D, clerks: 2, think: 0.2, traffic: "quiet", protection: "none" }), prod: avg({ ...D, clerks: 4, think: 1, traffic: "busy", protection: "none" }) },
};

// What each card shows after a run.
const RUNS = {
  overlap: () => {
    const lost = RESULTS.overlap.map((a) => Math.round(a.lost));
    const lb = (n) => t(n + " lost", n + " perdidos");
    return { verdict: t(lost[1] + " of 200 deposits lost with 1 s at the desk. With 0.2 s: " + lost[0] + "; with 3 s: " + lost[2] + ".",
        lost[1] + " de 200 depósitos perdidos con 1 s en el escritorio. Con 0.2 s: " + lost[0] + "; con 3 s: " + lost[2] + "."),
      bars: [[t("0.2 s at desk", "0.2 s en escritorio"), lost[0] / 200, lb(lost[0])], [t("1 s at desk", "1 s en escritorio"), lost[1] / 200, lb(lost[1]), true], [t("3 s at desk", "3 s en escritorio"), lost[2] / 200, lb(lost[2])]] };
  },
  lock: () => {
    const { none, lock, one } = RESULTS.lock;
    const top = Math.max(none.perMinute, lock.perMinute);
    const a = Math.round(none.perMinute), n = Math.round(none.landedPerMinute), l = Math.round(none.lost), b = Math.round(lock.landedPerMinute), c = Math.round(one.landedPerMinute);
    return { verdict: t("On the card per minute with 4 clerks: " + n + " unprotected, " + b + " with the lock. Unprotected clerks wrote " + a + " a minute, but " + l + " of their 400 deposits were written over. One clerk alone lands " + c + ".",
        "En la tarjeta por minuto con 4 empleados: " + n + " sin protección, " + b + " con el bloqueo. Sin protección los empleados escribieron " + a + " por minuto, pero " + l + " de sus 400 depósitos quedaron sobrescritos. Un empleado solo logra " + c + "."),
      bars: [[t("No protection, written", "Sin protección, escritos"), none.perMinute / top, a + "/min"], [t("No protection, on the card", "Sin protección, en la tarjeta"), none.landedPerMinute / top, n + "/min"], [t("Lock, on the card", "Bloqueo, en la tarjeta"), lock.landedPerMinute / top, b + "/min", true], [t("One clerk", "Un empleado"), one.landedPerMinute / top, c + "/min"]] };
  },
  cas: () => {
    const { two, four, lock, atomic } = RESULTS.cas;
    const r2 = two.retries / two.done, r4 = four.retries / four.done, topR = Math.max(r2, r4), topW = Math.max(lock.wait, four.wait, atomic.wait);
    return { verdict: t("Retries per deposit: " + r2.toFixed(2) + " with 2 clerks, " + r4.toFixed(2) + " with 4, and nothing lost. Average time per deposit with 4 clerks: " + r1(lock.wait) + " s with the lock, " + r1(four.wait) + " s with the version check, " + r1(atomic.wait) + " s with an atomic increment.",
        "Reintentos por depósito: " + r2.toFixed(2) + " con 2 empleados, " + r4.toFixed(2) + " con 4, y no se pierde nada. Tiempo promedio por depósito con 4 empleados: " + r1(lock.wait) + " s con el bloqueo, " + r1(four.wait) + " s con el chequeo de versión, " + r1(atomic.wait) + " s con un incremento atómico."),
      bars: [[t("Retries, 2 clerks", "Reintentos, 2 empleados"), r2 / topR, r2.toFixed(2)], [t("Retries, 4 clerks", "Reintentos, 4 empleados"), r4 / topR, r4.toFixed(2), true], [t("Time, lock", "Tiempo, bloqueo"), lock.wait / topW, r1(lock.wait) + " s"], [t("Time, version", "Tiempo, versión"), four.wait / topW, r1(four.wait) + " s", true], [t("Time, atomic", "Tiempo, atómico"), atomic.wait / topW, r1(atomic.wait) + " s"]] };
  },
  booking: () => {
    const { none, cas } = RESULTS.booking;
    const seats = (x) => t(r1(x) + " seats", r1(x) + " asientos");
    return { verdict: t(r1(none.doubleSeats) + " of 24 seats booked twice on average with check-then-book. With \"pin only if still free\": 0, at the cost of " + r1(cas.retries) + " re-checks.",
        r1(none.doubleSeats) + " de 24 asientos reservados dos veces en promedio con verificar-y-después-reservar. Con \"clavar solo si sigue libre\": 0, a costa de " + r1(cas.retries) + " nuevas verificaciones."),
      bars: [[t("Check, then book", "Verificar y reservar"), none.doubleSeats / 24, seats(none.doubleSeats), true], [t("Pin if still free", "Clavar si sigue libre"), cas.doubleSeats / 24, seats(cas.doubleSeats)]] };
  },
  hidden: () => {
    const { unit, manual, prod } = RESULTS.hidden;
    const p = (a) => a.done ? a.lost / a.done : 0;
    const pc = (a) => pct(p(a));
    return { verdict: t("Deposits lost: " + pc(unit) + " in the unit test, " + pc(manual) + " in the quiet manual test, " + pc(prod) + " in busy production.",
        "Depósitos perdidos: " + pc(unit) + " en la prueba unitaria, " + pc(manual) + " en la prueba manual tranquila, " + pc(prod) + " en producción con la oficina llena."),
      bars: [[t("Unit test", "Prueba unitaria"), p(unit), pc(unit)], [t("Manual, quiet", "Manual, tranquila"), p(manual), pc(manual)], [t("Production", "Producción"), p(prod), pc(prod), true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "overlap",
    title: t("Two clerks, no protection", "Dos empleados, sin protección"),
    change: t("2 clerks × 100 deposits each · read the card, work out the new balance at the desk (1 s), walk back and write it", "2 empleados × 100 depósitos cada uno · leen la tarjeta, calculan el nuevo saldo en el escritorio (1 s), vuelven y lo escriben"),
    question: t("How many of the 200 deposits never reach the card?", "¿Cuántos de los 200 depósitos nunca llegan a la tarjeta?"),
    options: [
      t("None: each clerk writes their own deposit", "Ninguno: cada empleado escribe su propio depósito"),
      t("A handful, fewer than 5", "Unos pocos, menos de 5"),
      t("Dozens", "Decenas"),
    ],
    answer: 2,
    why: t(
      "Each write puts down \"what I read, plus 10\". If the other clerk wrote in between, that write is replaced by a balance that never included it. Nothing crashes and every clerk thinks they succeeded; the money just isn't there. The longer the gap between reading and writing, the more often someone else writes inside it.",
      "Cada escritura anota \"lo que leí, más 10\". Si el otro empleado escribió en el medio, esa escritura queda reemplazada por un saldo que nunca la incluyó. Nada falla y cada empleado cree que lo logró; el dinero simplemente no está. Cuanto más largo es el intervalo entre leer y escribir, más seguido otro escribe dentro de él.",
    ),
    watch: { clerks: 2, think: 1, protection: "none", scenario: "deposits", traffic: "busy" },
  },
  {
    id: "lock",
    title: t("Take the key first", "Toma la llave primero"),
    change: t("4 clerks · no protection → a clerk takes the key from the hook before reading and hangs it back after writing", "4 empleados · sin protección → cada empleado toma la llave del gancho antes de leer y la cuelga de nuevo después de escribir"),
    question: t("Count only deposits that reach the card. Per minute, how does the lock compare with no protection?", "Cuenta solo los depósitos que llegan a la tarjeta. Por minuto, ¿cómo se compara el bloqueo con no tener protección?"),
    options: [
      t("Fewer: three clerks wait at the hook", "Menos: tres empleados esperan junto al gancho"),
      t("About the same", "Más o menos los mismos"),
      t("More with the lock", "Más con el bloqueo"),
    ],
    answer: 2,
    why: t(
      "The lock makes the whole read-think-write happen one clerk at a time, including the walk to the desk and the thinking, so clerks write at about half their unprotected pace. But unprotected, most writes replace someone else's deposit, so far fewer reach the card. The lock is still faster than one clerk alone, because the walk to the card and the wait for the next customer happen outside it. Keep what you do while holding a lock as short as possible.",
      "El bloqueo (lock) hace que todo el paso de leer, pensar y escribir ocurra un empleado a la vez, incluida la caminata al escritorio y el cálculo, así que los empleados escriben a cerca de la mitad de su ritmo sin protección. Pero sin protección la mayoría de las escrituras reemplaza el depósito de otro, así que muchos menos llegan a la tarjeta. El bloqueo igual es más rápido que un solo empleado, porque la caminata hasta la tarjeta y la espera del siguiente cliente ocurren fuera de él. Haz lo más corto posible lo que hagas mientras tienes un bloqueo.",
    ),
    watch: { clerks: 4, think: 1, protection: "lock", scenario: "deposits", traffic: "busy" },
  },
  {
    id: "cas",
    title: t("Check the version", "Verifica la versión"),
    change: t("Compare-and-swap: the card carries a version number; a write only lands if the version is still the one the clerk read, otherwise the clerk reads again and redoes the sum", "Compare-and-swap (CAS): la tarjeta lleva un número de versión; una escritura solo se aplica si la versión sigue siendo la que leyó el empleado; si no, el empleado vuelve a leer y rehace la suma"),
    question: t("Going from 2 clerks to 4, what happens?", "Al pasar de 2 empleados a 4, ¿qué pasa?"),
    options: [
      t("Nothing: the version check almost never fails", "Nada: la verificación de versión casi nunca falla"),
      t("Retries climb steeply, though no deposit is lost", "Los reintentos suben mucho, aunque no se pierde ningún depósito"),
      t("Deposits get lost when a retry fails", "Se pierden depósitos cuando falla un reintento"),
    ],
    answer: 1,
    why: t(
      "Compare-and-swap is optimistic: it assumes nobody else wrote, and pays only when someone did. With more clerks, more writes land inside each clerk's window, so more work is thrown away and redone. Best of all is to not read at all: an atomic increment (UPDATE accounts SET balance = balance + 10) is one step, so there is no window to race in. Lesson 21, Distributed counters, takes this across machines.",
      "El compare-and-swap (CAS) es optimista: supone que nadie más escribió y solo paga cuando alguien lo hizo. Con más empleados caen más escrituras dentro de la ventana de cada uno, así que se descarta y rehace más trabajo. Lo mejor es no leer: un incremento atómico (UPDATE accounts SET balance = balance + 10) es un solo paso, así que no hay ventana en la que competir. La lección 21, Contadores distribuidos, lleva esto a varias máquinas.",
    ),
    watch: { clerks: 4, think: 1, protection: "cas", scenario: "deposits", traffic: "busy" },
  },
  {
    id: "booking",
    title: t("Check, then book", "Verificar y después reservar"),
    change: t("3 clerks fill 24 seats · each checks the board for a free seat, fills in the form at the desk, then pins the seat", "3 empleados llenan 24 asientos · cada uno busca un asiento libre en el tablero, llena el formulario en el escritorio y después clava el asiento"),
    question: t("Every clerk checked the seat was free. How many seats end up booked twice?", "Cada empleado verificó que el asiento estaba libre. ¿Cuántos asientos terminan reservados dos veces?"),
    options: [
      t("None: they all checked first", "Ninguno: todos verificaron primero"),
      t("Several", "Varios"),
      t("Nearly all of them", "Casi todos"),
    ],
    answer: 1,
    why: t(
      "\"Check, then act\" has the same gap as read-modify-write: the seat was free when the clerk looked, not when they pinned it. Customers like the same front-row seats, which makes clashes more likely. The fix is to make the act carry the check: pin only if still free (a conditional update), or let the database refuse a second booking (a unique constraint on the seat).",
      "\"Verificar y después actuar\" (check-then-act) tiene el mismo hueco que leer, modificar y escribir: el asiento estaba libre cuando el empleado miró, no cuando lo clavó. Los clientes prefieren los mismos asientos de adelante, lo que hace más probables los choques. La solución es que la acción lleve la verificación: clavar solo si sigue libre (una actualización condicional) o dejar que la base de datos rechace la segunda reserva (una restricción de unicidad sobre el asiento).",
    ),
    watch: { clerks: 3, think: 1, protection: "none", scenario: "booking", traffic: "busy" },
  },
  {
    id: "hidden",
    title: t("It passed locally", "En local funcionaba"),
    change: t("The same unprotected code · 1 clerk (a unit test), 2 clerks at a quiet moment (a manual test), 4 clerks when the office is busy (production)", "El mismo código sin protección · 1 empleado (una prueba unitaria), 2 empleados en un momento tranquilo (una prueba manual), 4 empleados con la oficina llena (producción)"),
    question: t("What do the tests show?", "¿Qué muestran las pruebas?"),
    options: [
      t("The same loss rate as production", "La misma tasa de pérdida que en producción"),
      t("None or almost none", "Ninguna o casi ninguna"),
      t("More losses than production, because tests are harsher", "Más pérdidas que en producción, porque las pruebas son más duras"),
    ],
    answer: 1,
    why: t(
      "A race needs two clerks inside the same window. One clerk can never race with itself, and two clerks at a quiet moment rarely overlap. Production has many requests at once, so the bug shows up only there, and it isn't reproducible on demand. Find races by reading the code for read-then-write and check-then-act, and test them with many concurrent requests on purpose.",
      "Una carrera necesita dos empleados dentro de la misma ventana. Un empleado nunca compite consigo mismo, y dos empleados en un momento tranquilo rara vez se cruzan. Producción tiene muchas solicitudes a la vez, así que el bug aparece solo ahí y no se puede reproducir a pedido. Encuentra las carreras leyendo el código en busca de leer-y-después-escribir y verificar-y-después-actuar, y pruébalas a propósito con muchas solicitudes concurrentes.",
    ),
    watch: { clerks: 2, think: 0.2, protection: "none", scenario: "deposits", traffic: "quiet" },
  },
];

const QUESTIONS = [
  [t("Two requests run `balance = get(); set(balance + 10)` at the same time. Explain how money disappears.", "Dos solicitudes ejecutan `balance = get(); set(balance + 10)` al mismo tiempo. Explica cómo desaparece el dinero."),
    t("Both read the same balance, say 100. Each adds 10 and writes 110. Two deposits happened, but the balance only went up once. Neither request failed, so nothing is logged; the second write simply replaced the first.", "Las dos leen el mismo saldo, digamos 100. Cada una suma 10 y escribe 110. Hubo dos depósitos, pero el saldo subió una sola vez. Ninguna solicitud falló, así que no queda nada en los logs; la segunda escritura simplemente reemplazó a la primera.")],
  [t("Name three ways to fix a lost update on a database row, and when you'd pick each.", "Nombra tres formas de arreglar una actualización perdida (lost update) en una fila de la base de datos, y cuándo elegirías cada una."),
    t("An atomic update in one statement (UPDATE … SET balance = balance + 10): the best when the change can be expressed that way. Optimistic locking (a version column, UPDATE … WHERE version = 7, retry on 0 rows): good when conflicts are rare. A lock (SELECT … FOR UPDATE, or a mutex): when the change needs a long read-modify-write and conflicts are common, keeping the locked section short.", "Una actualización atómica en una sola sentencia (UPDATE … SET balance = balance + 10): la mejor cuando el cambio se puede expresar así. Bloqueo optimista (optimistic locking: una columna de versión, UPDATE … WHERE version = 7, reintentar si afecta 0 filas): bueno cuando los conflictos son raros. Un bloqueo (SELECT … FOR UPDATE, o un mutex): cuando el cambio necesita un leer-modificar-escribir largo y los conflictos son comunes, con la sección bloqueada lo más corta posible.")],
  [t("Why can a lock make a fast system slow, and how do you avoid that?", "¿Por qué un bloqueo puede volver lento un sistema rápido, y cómo lo evitas?"),
    t("Everything inside the lock runs one at a time. If the locked section includes slow work (a network call, a heavy computation, waiting for a user), every other request queues behind it. Do the slow work before taking the lock, keep only the read and write inside it, or avoid the lock with an atomic operation.", "Todo lo que está dentro del bloqueo corre uno a la vez. Si la sección bloqueada incluye trabajo lento (una llamada de red, un cálculo pesado, esperar a un usuario), todas las demás solicitudes hacen fila detrás. Haz el trabajo lento antes de tomar el bloqueo, deja adentro solo la lectura y la escritura, o evita el bloqueo con una operación atómica.")],
  [t("What is check-then-act, and what is a real example in a web app?", "¿Qué es verificar-y-después-actuar (check-then-act), y cuál es un ejemplo real en una app web?"),
    t("Checking a condition and then acting on it as two separate steps: \"is this username free? then create the user\", \"is the seat free? then book it\", \"is stock above 0? then sell\". Between the check and the act, another request can make the check false. Fix it by making the database enforce it: a unique constraint, a conditional update, or an insert that fails on conflict. Lesson 25, Idempotency keys, uses the same unique constraint to stop a retried request from acting twice.", "Verificar una condición y después actuar como dos pasos separados: \"¿este nombre de usuario está libre? entonces crea el usuario\", \"¿el asiento está libre? entonces resérvalo\", \"¿hay stock? entonces vende\". Entre la verificación y la acción, otra solicitud puede volver falsa la verificación. Arréglalo haciendo que la base de datos lo garantice: una restricción de unicidad, una actualización condicional o un insert que falle ante un conflicto. La lección 25, Claves de idempotencia, usa la misma restricción de unicidad para que una solicitud reintentada no actúe dos veces.")],
  [t("Your tests pass but production has a lost-update bug. Why didn't the tests catch it, and how would you write a test that does?", "Tus pruebas pasan pero producción tiene un bug de actualización perdida. ¿Por qué las pruebas no lo detectaron, y cómo escribirías una que sí lo haga?"),
    t("Tests usually send one request at a time, so two requests never overlap inside the read-write window. Write a test that fires many concurrent requests at the same record (and add a small delay between read and write to widen the window), then check the final value equals the number of successful requests.", "Las pruebas suelen mandar una solicitud a la vez, así que dos solicitudes nunca se cruzan dentro de la ventana entre leer y escribir. Escribe una prueba que dispare muchas solicitudes concurrentes contra el mismo registro (y agrega una pequeña demora entre leer y escribir para ensanchar la ventana), y después verifica que el valor final sea igual a la cantidad de solicitudes exitosas.")],
  [t("Compare-and-swap never loses an update. Why might it still be the wrong choice?", "El compare-and-swap nunca pierde una actualización. ¿Por qué igual podría ser la elección equivocada?"),
    t("Under heavy contention most attempts fail and get retried, so the same work is done many times, latency grows and some requests can starve. If the update can be one atomic operation, use that; if contention is high and the work is long, a short lock or a queue that serialises updates per record may be better.", "Con mucha contención la mayoría de los intentos fallan y se reintentan, así que el mismo trabajo se hace muchas veces, la latencia crece y algunas solicitudes pueden quedarse sin turno. Si la actualización puede ser una sola operación atómica, usa eso; si la contención es alta y el trabajo es largo, puede ser mejor un bloqueo corto o una cola que serialice las actualizaciones por registro.")],
];

export default defineLesson({
  title: t("Race Condition Workbench", "Banco de trabajo: condiciones de carrera"),
  eyebrow: t("Systems lesson 17 · Race conditions", "Lección de sistemas 17 · Condiciones de carrera"),
  lede: t("A race condition happens when the result depends on the timing of requests that touch the same data. The most common is a lost update: two requests read the same value, both decide what to write, and one quietly undoes the other. Nothing crashes, so it hides until there is real traffic. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Una condición de carrera (race condition) ocurre cuando el resultado depende del orden en que llegan solicitudes que tocan los mismos datos. La más común es la actualización perdida (lost update): dos solicitudes leen el mismo valor, las dos deciden qué escribir y una deshace en silencio a la otra. Nada falla, así que se esconde hasta que hay tráfico real. Esta lección construye esa idea de tres maneras: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Every clerk updates the same ledger card. Watch them read, think and write, then add clerks, lengthen the time at the desk, and try each kind of protection.", "Todos los empleados actualizan la misma tarjeta del libro. Míralos leer, pensar y escribir; después agrega empleados, alarga el tiempo en el escritorio y prueba cada tipo de protección."),
    plate: {
      title: t("Bank office", "Oficina bancaria"),
      keys: [
        { mark: "lit", label: t("A deposit written over, or a seat pinned twice", "Un depósito sobrescrito, o un asiento clavado dos veces") },
        { mark: "raised", label: t("Ledger card: the balance counter and what it should be", "Tarjeta del libro: el contador del saldo y lo que debería ser") },
        { mark: "flat", label: t("Desks at the front, seat board at the right", "Escritorios adelante, tablero de asientos a la derecha") },
      ],
      caption: t(
        "Each deposit adds 10. A clerk copies the balance onto a slip, walks back to the desk to work out the new balance, then walks back and writes it. When two slips carry the same old balance, the second write undoes the first, and BALANCE falls behind SHOULD BE. Clerks carry their letter, A to D, on the front. The key on the hook is a lock: whoever holds it is the only one between reading and writing. The stamp in the card's corner is the version: with the version check, a write only lands if the slip's v-number still matches. In seat booking, clerks check the board, fill in the form, then pin the seat; a seat with two pins is double-booked.",
        "Cada depósito suma 10. Un empleado copia el saldo en una boleta, vuelve al escritorio a calcular el nuevo saldo, y después regresa y lo escribe. Cuando dos boletas llevan el mismo saldo viejo, la segunda escritura deshace la primera, y SALDO se queda atrás de DEBERÍA SER. Cada empleado lleva su letra, de la A a la D, al frente. La llave del gancho es un bloqueo (lock): quien la tiene es el único que está entre leer y escribir. El sello en la esquina de la tarjeta es la versión: con el chequeo de versión, una escritura solo se aplica si el número v de la boleta todavía coincide. En la reserva de asientos, los empleados miran el tablero, llenan el formulario y después clavan el asiento; un asiento con dos alfileres está reservado dos veces.",
      ),
      stage: { "data-office": "" },
      label: t("Race condition simulation. Space pauses or resumes.", "Simulación de condición de carrera. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["made", t("Deposits made", "Depósitos hechos")], ["card", t("On the card", "En la tarjeta")], ["lost", t("Lost", "Perdidos")], ["retries", t("Retries", "Reintentos")], ["perMinute", t("Per minute", "Por minuto"), "–"], ["wait", t("Avg time", "Tiempo prom."), "–"]],
    controls: [
      { seg: "scenario", label: t("Scenario", "Escenario"), options: [["deposits", t("Deposits", "Depósitos")], ["booking", t("Seat booking", "Reserva de asientos")]], value: "deposits" },
      { seg: "clerks", label: t("Clerks", "Empleados"), options: [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], value: 2 },
      { seg: "think", label: t("Time at the desk", "Tiempo en el escritorio"), options: [[0.2, "0.2 s"], [1, "1 s"], [3, "3 s"]], value: 1 },
      { seg: "protection", label: t("Protection", "Protección"), options: [["none", t("None", "Ninguna")], ["lock", t("Lock", "Bloqueo")], ["cas", t("Version check", "Chequeo de versión")], ["atomic", t("Atomic", "Atómico")]], value: "none" },
      { seg: "traffic", label: t("Office", "Oficina"), options: [["busy", t("Busy", "Llena")], ["quiet", t("Quiet", "Tranquila")]], value: "busy" },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      'In seat booking, "Version check" means pin only if the seat is still free, and "Atomic" means a unique constraint on the seat. Changing a setting starts the run again.',
      'En la reserva de asientos, "Chequeo de versión" significa clavar solo si el asiento sigue libre, y "Atómico" significa una restricción de unicidad sobre el asiento. Cambiar un ajuste vuelve a empezar la ejecución.',
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of 100 deposits per clerk unless noted.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla de 100 depósitos por empleado, salvo que se indique otra cosa."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
body.lit-fill [data-slip]:has(> [data-slip-lit]:not([style*="none"])) :is([data-slip-value],[data-slip-note]){fill:var(--anatomy-page)}
.iso-stage .iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}
`,
  data: {
    TITLES: Object.fromEntries(EXPERIMENTS.map(({ id, title }) => [id, title])),
    P,
    G: GEOMETRY,
    CLERK_SVG: clerkSvg(),
  },
});
