// @ts-nocheck: content in the style of the other lessons
// Systems lesson 61 · Clocks & last-write-wins: two offices with their own wall clocks edit one record at a records
// desk that keeps the highest stamp.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, oneUnder10 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, courierSvg, slipSvg, P, GEOMETRY } from "./figure";
import { ntpRun, behindRun, stepRun, lamportRun, vectorRun, LEG, THINK, IDLE, NTP_ERR, BEHIND, FAST, SEEDS, RUN_MS } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const R = { ntp: ntpRun(), behind: behindRun(), step: stepRun(), lamport: lamportRun(), vector: vectorRun() };

const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const per100 = (x) => (x < 0.05 ? "0" : oneUnder10(x));
const range = ([a, b]) => a + "–" + (a + b) + " ms";
const CYCLE = Math.round(2 * 2 * (LEG[0] + LEG[1] / 2) + THINK[0] + THINK[1] / 2 + IDLE);   // mean ms from one edit to the next
const RUNS_TEXT = { en: SEEDS.length + " seeded runs of " + RUN_MS / 1000 + " s each", es: SEEDS.length + " ejecuciones con semilla fija de " + RUN_MS / 1000 + " s cada una" };

// What each card shows after a run.
const RUNS = {
  ntp: () => {
    const { exact, ntp } = R.ntp, m1 = top(ntp.older, 0.5), m2 = top(exact.lost, ntp.lost);
    return {
      verdict: t("Exact clocks: " + per100(exact.older) + " edits in 100 lost to an edit their writer had already read, " + per100(exact.lost) + " lost in all, to edits made at the same time. NTP, ±" + NTP_ERR + " ms: " + per100(ntp.older) + " in 100 lost to the edit they were built on, " + per100(ntp.lost) + " in all. Every one got an OK.",
        "Relojes exactos: " + per100(exact.older) + " ediciones de cada 100 perdidas ante una edición que su autor ya había leído, " + per100(exact.lost) + " perdidas en total, ante ediciones hechas al mismo tiempo. NTP, ±" + NTP_ERR + " ms: " + per100(ntp.older) + " de cada 100 perdidas ante la edición sobre la que se hicieron, " + per100(ntp.lost) + " en total. Todas recibieron un OK."),
      groups: [
        { title: t("Lost to the edit they had read, per 100 edits", "Perdidas ante la edición que habían leído, cada 100"), bars: [[t("Exact clocks", "Relojes exactos"), exact.older / m1, per100(exact.older)], [t("NTP, ±" + NTP_ERR + " ms", "NTP, ±" + NTP_ERR + " ms"), ntp.older / m1, per100(ntp.older), true]] },
        { title: t("Lost in all, per 100 edits", "Perdidas en total, cada 100"), bars: [[t("Exact clocks", "Relojes exactos"), exact.lost / m2, per100(exact.lost)], [t("NTP, ±" + NTP_ERR + " ms", "NTP, ±" + NTP_ERR + " ms"), ntp.lost / m2, per100(ntp.lost)]] },
      ],
    };
  },
  behind: () => {
    const { ntp, behind } = R.behind;
    return {
      verdict: t("Both clocks synced: A kept " + pct(ntp.keptA) + " of its edits, B " + pct(ntp.keptB) + ". B " + BEHIND + " ms slow: A kept " + pct(behind.keptA) + ", B " + pct(behind.keptB) + ", and B got an OK for every edit.",
        "Los dos relojes sincronizados: A conservó el " + pct(ntp.keptA) + " de sus ediciones y B el " + pct(ntp.keptB) + ". B " + BEHIND + " ms atrasado: A conservó el " + pct(behind.keptA) + " y B el " + pct(behind.keptB) + ", y B recibió un OK por cada edición."),
      groups: [
        { title: t("Edits kept, both synced", "Ediciones conservadas, los dos sincronizados"), bars: [["A", ntp.keptA, pct(ntp.keptA)], ["B", ntp.keptB, pct(ntp.keptB)]] },
        { title: t("Edits kept, B " + BEHIND + " ms slow", "Ediciones conservadas, B " + BEHIND + " ms atrasado"), bars: [["A", behind.keptA, pct(behind.keptA)], ["B", behind.keptB, pct(behind.keptB), true]] },
      ],
    };
  },
  step: () => {
    const s = R.step.lww;
    return {
      verdict: t("In the " + FAST + " ms before the step, A kept " + pct(s.aBefore) + " of its edits and B " + pct(s.bBefore) + ". In the " + FAST + " ms after it, A kept " + pct(s.aAfter) + " and B " + pct(s.bAfter) + ". In the " + FAST + " ms after that, " + pct(s.allLate) + ".",
        "En los " + FAST + " ms antes del salto, A conservó el " + pct(s.aBefore) + " de sus ediciones y B el " + pct(s.bBefore) + ". En los " + FAST + " ms después, A conservó el " + pct(s.aAfter) + " y B el " + pct(s.bAfter) + ". En los " + FAST + " ms siguientes, el " + pct(s.allLate) + "."),
      groups: [
        { title: t("Edits kept, A " + FAST + " ms fast", "Ediciones conservadas, A " + FAST + " ms adelantado"), bars: [["A", s.aBefore, pct(s.aBefore)], ["B", s.bBefore, pct(s.bBefore)]] },
        { title: t("Edits kept, " + FAST + " ms after the step", "Ediciones conservadas, " + FAST + " ms después del salto"), bars: [["A", s.aAfter, pct(s.aAfter), true], ["B", s.bAfter, pct(s.bAfter), true]] },
        { title: t("Edits kept, later", "Ediciones conservadas, después"), bars: [[t("Both", "Ambas"), s.allLate, pct(s.allLate)]] },
      ],
    };
  },
  lamport: () => {
    const { ntp, exact, lamport } = R.lamport, m = top(ntp.lost, exact.lost, lamport.lost);
    return {
      verdict: t("Lost per 100 edits: wall clocks with NTP " + per100(ntp.lost) + " (" + per100(ntp.older) + " to an edit they had read), exact wall clocks " + per100(exact.lost) + ", Lamport " + per100(lamport.lost) + " (" + per100(lamport.older) + " to an edit they had read). With Lamport, A kept " + pct(lamport.keptA) + " of its edits and B " + pct(lamport.keptB) + ".",
        "Perdidas cada 100 ediciones: relojes de pared con NTP " + per100(ntp.lost) + " (" + per100(ntp.older) + " ante una edición que habían leído), relojes de pared exactos " + per100(exact.lost) + ", Lamport " + per100(lamport.lost) + " (" + per100(lamport.older) + " ante una edición que habían leído). Con Lamport, A conservó el " + pct(lamport.keptA) + " de sus ediciones y B el " + pct(lamport.keptB) + "."),
      groups: [
        { title: t("Lost per 100 edits", "Perdidas cada 100 ediciones"), bars: [[t("Wall clock, NTP", "Reloj de pared, NTP"), ntp.lost / m, per100(ntp.lost)], [t("Wall clock, exact", "Reloj de pared, exacto"), exact.lost / m, per100(exact.lost)], [t("Lamport clock", "Reloj de Lamport"), lamport.lost / m, per100(lamport.lost), true]] },
        { title: t("Edits kept, Lamport", "Ediciones conservadas, Lamport"), bars: [["A", lamport.keptA, pct(lamport.keptA), true], ["B", lamport.keptB, pct(lamport.keptB)]] },
      ],
    };
  },
  vector: () => {
    const { lamport, vector } = R.vector, m = top(lamport.lost, vector.siblings, vector.merges);
    return {
      verdict: t("Lamport lost " + per100(lamport.lost) + " edits in 100. Vector clocks lost " + per100(vector.lost) + ": the desk kept " + per100(vector.siblings) + " siblings per 100 edits, and " + per100(vector.merges) + " reads per 100 edits came back with two and had to merge them.",
        "Lamport perdió " + per100(lamport.lost) + " ediciones de cada 100. Los relojes vectoriales perdieron " + per100(vector.lost) + ": la mesa guardó " + per100(vector.siblings) + " hermanas cada 100 ediciones, y " + per100(vector.merges) + " lecturas cada 100 ediciones volvieron con dos y tuvieron que unirlas."),
      bars: [[t("Lost, Lamport", "Perdidas, Lamport"), lamport.lost / m, per100(lamport.lost)], [t("Lost, vector clock", "Perdidas, reloj vectorial"), vector.lost / m, per100(vector.lost), true], [t("Siblings kept, vector clock", "Hermanas guardadas, reloj vectorial"), vector.siblings / m, per100(vector.siblings)], [t("Reads that merged, vector clock", "Lecturas que unieron, reloj vectorial"), vector.merges / m, per100(vector.merges)]],
    };
  },
};

const { ntp: N, behind: B, step: { lww: ST }, lamport: LA, vector: V } = R;

const EXPERIMENTS = [
  {
    id: "ntp",
    title: t("Synced is not exact", "Sincronizado no es exacto"),
    change: t("Last write wins by wall clock · each office reads the record, adds a line and writes it back · exact clocks → clocks synced by NTP, each within ±" + NTP_ERR + " ms of true time",
      "La última escritura gana por reloj de pared · cada oficina lee el registro, agrega una línea y lo vuelve a escribir · relojes exactos → relojes sincronizados por NTP, cada uno a ±" + NTP_ERR + " ms de la hora real"),
    question: t("Compared with exact clocks, what changes once the clocks are only synced?", "Comparado con relojes exactos, ¿qué cambia cuando los relojes solo están sincronizados?"),
    options: [
      t("Nothing: ±" + NTP_ERR + " ms is far less than the gap between edits", "Nada: ±" + NTP_ERR + " ms es mucho menos que el tiempo entre ediciones"),
      t("Some edits now lose to the edit they were built on", "Algunas ediciones pierden contra la edición sobre la que se hicieron"),
      t("Edits that arrive out of order start failing with errors", "Las ediciones que llegan desordenadas empiezan a fallar con errores"),
    ],
    answer: 1,
    why: t(
      "An edit is stamped by its writer's clock as it leaves. When B reads A's edit and sends its own a few milliseconds later, but B's clock reads a few milliseconds behind A's, B's stamp comes out lower: the desk keeps A's older record and drops B's, though B had built on it. That happened to " + per100(N.ntp.older) + " edits in 100, against " + per100(N.exact.older) + " with exact clocks, and each got an OK. What counts is skew against the gap between dependent edits, and on this machine an edit follows the one it read by a few milliseconds. ±" + NTP_ERR + " ms is a good sync over the internet, where NTP typically holds tens of milliseconds; on a LAN it is often under one, but there edits also follow each other faster, and none of it is guaranteed. Even exact clocks lost " + per100(N.exact.lost) + " in 100: two edits made from the same copy at once, the lost update of lesson 17, Race conditions. Skew adds edits that weren't concurrent at all.",
      "Una edición se sella con el reloj de quien la escribe cuando sale. Cuando B lee la edición de A y envía la suya unos milisegundos después, pero el reloj de B marca unos milisegundos menos que el de A, el sello de B sale más bajo: la mesa se queda con el registro más viejo de A y descarta el de B, aunque B lo había usado como base. Le pasó a " + per100(N.ntp.older) + " ediciones de cada 100, contra " + per100(N.exact.older) + " con relojes exactos, y cada una recibió un OK. Lo que cuenta es el desfase de reloj (clock skew) frente al tiempo entre ediciones que dependen una de otra, y en esta máquina una edición sigue a la que leyó por unos pocos milisegundos. ±" + NTP_ERR + " ms es una buena sincronización por internet, donde NTP suele mantener decenas de milisegundos; en una LAN a menudo queda por debajo de uno, pero ahí las ediciones también se siguen más rápido, y nada de eso está garantizado. Incluso los relojes exactos perdieron " + per100(N.exact.lost) + " de cada 100: dos ediciones hechas a la vez desde la misma copia, la actualización perdida de la lección 17, Condiciones de carrera. El desfase agrega ediciones que ni siquiera eran concurrentes.",
    ),
    watch: { rule: "lww", clocks: "ntp", until: "older" },
  },
  {
    id: "behind",
    title: t("One clock stops syncing", "Un reloj deja de sincronizarse"),
    change: t("Last write wins by wall clock · both clocks synced by NTP → B's clock stops syncing and runs " + BEHIND + " ms slow; A's stays synced",
      "La última escritura gana por reloj de pared · los dos relojes sincronizados por NTP → el reloj de B deja de sincronizarse y va " + BEHIND + " ms atrasado; el de A sigue sincronizado"),
    question: t("What happens to B's edits?", "¿Qué pasa con las ediciones de B?"),
    options: [
      t("They lose only rare close races with A's edits", "Pierden solo alguna carrera ajustada con las de A"),
      t("Nearly all vanish; A keeps its own", "Casi todas desaparecen; A conserva las suyas"),
      t("Both offices lose a few more, about evenly", "Las dos oficinas pierden unas pocas más, parejo"),
    ],
    answer: 1,
    why: t(
      "Every stamp B writes is " + BEHIND + " ms behind true time, so a B edit loses to any A edit made in the " + BEHIND + " ms before it, and A edits about every " + CYCLE + " ms. B kept " + pct(B.behind.keptB) + " of its edits and A " + pct(B.behind.keptA) + ". Nothing fails: B gets an OK for each edit, and the record simply never shows them. The desk can't tell a slow clock from an old edit, and it never wonders why one writer always loses. The fast clock wins every close call; the slow one is muted. A clock that isn't syncing drifts by around a second or two a day (tens of parts per million), so this takes hours, not months: alert on clock offset the way you alert on disk space.",
      "Cada sello que escribe B va " + BEHIND + " ms detrás de la hora real, así que una edición de B pierde contra cualquier edición de A hecha en los " + BEHIND + " ms anteriores, y A edita más o menos cada " + CYCLE + " ms. B conservó el " + pct(B.behind.keptB) + " de sus ediciones y A el " + pct(B.behind.keptA) + ". Nada falla: B recibe un OK por cada edición, y el registro simplemente nunca las muestra. La mesa no puede distinguir un reloj atrasado de una edición vieja, y nunca se pregunta por qué un escritor pierde siempre. El reloj adelantado gana cada caso ajustado; el atrasado queda mudo. Un reloj que no se sincroniza se desvía alrededor de uno o dos segundos por día (decenas de partes por millón), así que esto tarda horas, no meses: pon una alerta sobre el desfase del reloj como la pones sobre el espacio en disco.",
    ),
    watch: { rule: "lww", clocks: "behind" },
  },
  {
    id: "step",
    title: t("Fixing the clock", "Corregir el reloj"),
    change: t("Last write wins by wall clock · A's clock had drifted " + FAST + " ms fast (B synced) · NTP steps it back to the right time in one jump",
      "La última escritura gana por reloj de pared · el reloj de A se había adelantado " + FAST + " ms (B sincronizado) · NTP lo corrige de un salto a la hora correcta"),
    question: t("In the " + FAST + " ms after the step, how many edits, from A or B, make it into the record?", "En los " + FAST + " ms después del salto, ¿cuántas ediciones, de A o de B, llegan al registro?"),
    options: [
      t("A's stick again at once: its clock is right", "Las de A vuelven a quedar enseguida: su reloj está bien"),
      t("Hardly any, from A or B, for about " + FAST + " ms", "Casi ninguna, de A ni de B, durante unos " + FAST + " ms"),
      t("B's stick, but A's are refused until the clocks agree", "Las de B quedan, pero las de A se rechazan hasta que coincidan"),
    ],
    answer: 1,
    why: t(
      "While A ran fast, its stamps were " + FAST + " ms ahead, so B's edits kept losing to A's (B kept " + pct(ST.bBefore) + ") and A's always won (" + pct(ST.aBefore) + "). The step fixes A's clock, not the record: the record still carries A's last stamp, up to " + FAST + " ms in the future, and every edit stamped below it loses, now A's too. A kept " + pct(ST.aAfter) + " and B " + pct(ST.bAfter) + " of the edits made in the next " + FAST + " ms, every one acknowledged; then true time passed the old stamp and things went back to normal (" + pct(ST.allLate) + "). Wall clocks do jump: by default ntpd steps the clock, rather than slewing it, when an offset over 128 ms persists for a few minutes; a VM resumed from a snapshot can start with an old time, or someone sets the time by hand. So never use the wall clock to time durations or to order events, even on one machine: a monotonic clock (CLOCK_MONOTONIC, performance.now()) never jumps. Lamport clocks, next, don't read the wall clock at all.",
      "Mientras A iba adelantado, sus sellos iban " + FAST + " ms adelante, así que las ediciones de B perdían contra las de A (B conservó el " + pct(ST.bBefore) + ") y las de A siempre ganaban (" + pct(ST.aBefore) + "). El salto corrige el reloj de A, no el registro: el registro sigue llevando el último sello de A, hasta " + FAST + " ms en el futuro, y toda edición sellada por debajo pierde, ahora también las de A. A conservó el " + pct(ST.aAfter) + " y B el " + pct(ST.bAfter) + " de las ediciones hechas en los " + FAST + " ms siguientes, todas confirmadas; después la hora real pasó el sello viejo y todo volvió a la normalidad (" + pct(ST.allLate) + "). Los relojes de pared sí saltan: por defecto, ntpd corrige con un salto, en lugar de un ajuste gradual (slew), un desfase de más de 128 ms que persiste unos minutos; una VM que se reanuda desde una instantánea puede arrancar con una hora vieja, o alguien cambia la hora a mano. Por eso nunca uses el reloj de pared para medir duraciones ni para ordenar eventos, ni siquiera en una sola máquina: un reloj monótono (CLOCK_MONOTONIC, performance.now()) nunca salta. Los relojes de Lamport, en el siguiente experimento, ni siquiera leen el reloj de pared.",
    ),
    watch: { rule: "lww", clocks: "step" },
  },
  {
    id: "lamport",
    title: t("Count instead of reading the clock", "Contar en lugar de leer el reloj"),
    change: t("Clocks synced by NTP · last write wins by wall clock → by Lamport clock: each office keeps a counter, raises it to the highest stamp it has read and adds one per edit; a tie goes to B",
      "Relojes sincronizados por NTP · la última escritura gana por reloj de pared → por reloj de Lamport: cada oficina lleva un contador, lo sube al sello más alto que leyó y le suma uno por edición; un empate es para B"),
    question: t("How many edits does Lamport lose, compared with wall clocks that are exactly right?", "¿Cuántas ediciones pierde Lamport, comparado con relojes de pared exactos?"),
    options: [
      t("None: every edit gets a unique, ordered stamp", "Ninguna: cada edición recibe un sello único y ordenado"),
      t("About as many: the ones made from the same copy", "Más o menos las mismas: las hechas desde la misma copia"),
      t("More: the counters run ahead of real time", "Más: los contadores se adelantan al tiempo real"),
    ],
    answer: 1,
    why: t(
      "A Lamport stamp is always higher than the stamp of anything its writer has read, so no edit ever loses to the edit it was built on: " + per100(LA.lamport.older) + " per 100, with no clock involved. But two edits made from the same copy at the same time usually get the same count, and the tie-break settles them: B wins every one. Lamport lost " + per100(LA.lamport.lost) + " edits in 100, as many as exact wall clocks (" + per100(LA.exact.lost) + "), and A kept " + pct(LA.lamport.keptA) + " of its edits to B's " + pct(LA.lamport.keptB) + ". A Lamport clock respects cause and effect (if a happened before b, a's stamp is lower), but not the reverse: a lower stamp doesn't mean it came first, and nothing says two edits were concurrent. Picking a winner still throws one away, the lost update of lesson 17, Race conditions.",
      "Un sello de Lamport siempre es mayor que el sello de todo lo que su autor leyó, así que ninguna edición pierde contra la edición sobre la que se hizo: " + per100(LA.lamport.older) + " cada 100, sin ningún reloj de por medio. Pero dos ediciones hechas a la vez desde la misma copia suelen recibir el mismo número, y el desempate las resuelve: B gana todas. Lamport perdió " + per100(LA.lamport.lost) + " ediciones de cada 100, tantas como los relojes de pared exactos (" + per100(LA.exact.lost) + "), y A conservó el " + pct(LA.lamport.keptA) + " de sus ediciones contra el " + pct(LA.lamport.keptB) + " de B. Un reloj de Lamport respeta la causa y el efecto (si a ocurrió antes que b, el sello de a es menor), pero no al revés: un sello menor no significa que llegó primero, y nada dice que dos ediciones fueron concurrentes. Elegir una ganadora igual descarta una, la actualización perdida de la lección 17, Condiciones de carrera.",
    ),
    watch: { rule: "lamport", clocks: "ntp" },
  },
  {
    id: "vector",
    title: t("Keep both", "Quedarse con las dos"),
    change: t("Lamport clock → vector clock: each record carries one counter per office; the desk replaces a record only with one that has seen it, keeps concurrent ones side by side (siblings), and the next office to read them merges their lines",
      "Reloj de Lamport → reloj vectorial (vector clock): cada registro lleva un contador por oficina; la mesa reemplaza un registro solo por uno que lo haya visto, guarda las concurrentes lado a lado (versiones hermanas, siblings) y la siguiente oficina que las lee une sus líneas"),
    question: t("With vector clocks, what happens to the edits Lamport lost?", "Con relojes vectoriales, ¿qué pasa con las ediciones que perdía Lamport?"),
    options: [
      t("The desk refuses the second one with a conflict error", "La mesa rechaza la segunda con un error de conflicto"),
      t("The desk keeps both until a reader merges them", "La mesa guarda las dos hasta que alguien que lee las une"),
      t("The desk merges them itself, line by line", "La mesa misma las une, línea por línea"),
    ],
    answer: 1,
    why: t(
      "Comparing vectors tells the desk what a timestamp can't: whether one edit had seen the other. 3,2 has seen 2,2 (every count is at least as high), so it replaces it; 3,1 and 2,2 haven't seen each other, so they are concurrent and neither should win. The desk kept both " + per100(V.vector.siblings) + " times per 100 edits; the next office to read got two siblings, merged them (here, kept every line) and wrote back a record that had seen both, " + per100(V.vector.merges) + " merges per 100 edits. Nothing was lost: " + per100(V.vector.lost) + " in 100, against " + per100(V.lamport.lost) + " with Lamport. The price: the merge is the application's code (Amazon's Dynamo merged shopping carts this way, and deleted items could come back), and the vector grows with every writer that touches the record. A store that must answer with one value either merges for you with a type built for it, a CRDT like the counter of lesson 21, Distributed counters, or picks a winner and loses one.",
      "Comparar vectores le dice a la mesa lo que una marca de tiempo no puede: si una edición había visto a la otra. 3,2 vio a 2,2 (cada contador es al menos igual de alto), así que la reemplaza; 3,1 y 2,2 no se vieron, así que son concurrentes y ninguna debería ganar. La mesa guardó las dos " + per100(V.vector.siblings) + " veces cada 100 ediciones; la siguiente oficina que leyó recibió dos hermanas, las unió (aquí, conservó todas las líneas) y escribió un registro que había visto las dos, " + per100(V.vector.merges) + " uniones cada 100 ediciones. No se perdió nada: " + per100(V.vector.lost) + " de cada 100, contra " + per100(V.lamport.lost) + " con Lamport. El precio: la unión es código de la aplicación (Dynamo de Amazon unía así los carritos de compra, y los artículos borrados podían volver) y el vector crece con cada escritor que toca el registro. Un almacén que tiene que responder con un solo valor o bien une por ti con un tipo hecho para eso, un CRDT como el contador de la lección 21, Contadores distribuidos, o bien elige una ganadora y pierde una.",
    ),
    watch: { rule: "vector", clocks: "ntp" },
  },
];

const QUESTIONS = [
  [t("Why do replicated stores settle conflicting writes by timestamp at all, instead of by the order the writes arrive?", "¿Por qué los almacenes replicados resuelven escrituras en conflicto por marca de tiempo, y no por el orden en que llegan?"),
   t("Different replicas receive the same writes in different orders, so arrival order would leave them disagreeing. To converge, every replica needs a rule that gives the same answer whatever the order, and the highest timestamp is the cheapest one: Cassandra resolves every cell this way, and so do many multi-leader setups. It converges, but converging isn't being right: whatever carries the lower stamp is thrown away, whether it was older or not.",
     "Réplicas distintas reciben las mismas escrituras en órdenes distintos, así que el orden de llegada las dejaría en desacuerdo. Para converger, cada réplica necesita una regla que dé la misma respuesta sea cual sea el orden, y la marca de tiempo más alta es la más barata: Cassandra resuelve así cada celda, y también muchos esquemas con varios líderes. Converge, pero converger no es acertar: lo que lleva el sello menor se descarta, sea más viejo o no.")],
  [t("A teammate says: \"We run NTP, so last-write-wins is safe.\" What do you check, and what would you change?", "Alguien del equipo dice: \"Usamos NTP, así que la última escritura gana es segura\". ¿Qué revisas y qué cambiarías?"),
   t("Compare how close together dependent writes to the same key can come with the offsets you actually see, and monitor those offsets (NTP typically gives tens of milliseconds over the internet, often under one on a LAN, and guarantees neither). Then avoid read-modify-write of a whole value from several writers: write only what changed (a column or cell per field), use a conditional write where order matters (in Cassandra, a lightweight transaction, IF …), send every write for a key through one owner, or store a type that merges (a CRDT).",
     "Compara qué tan juntas pueden llegar escrituras dependientes sobre la misma clave con los desfases que realmente ves, y monitorea esos desfases (NTP suele dar decenas de milisegundos por internet, a menudo menos de uno en una LAN, y no garantiza ninguna de las dos). Después evita leer, modificar y escribir un valor entero desde varios escritores: escribe solo lo que cambió (una columna o celda por campo), usa una escritura condicional donde el orden importa (en Cassandra, una transacción liviana, lightweight transaction, IF …), envía todas las escrituras de una clave por un único dueño, o guarda un tipo que se une solo (un CRDT).")],
  [t("Explain Lamport clocks in one minute: the rule, what they guarantee, and what they don't.", "Explica los relojes de Lamport en un minuto: la regla, qué garantizan y qué no."),
   t("Each process keeps a counter. Before each event it adds one; every message carries the counter, and a receiver sets its own to the larger of the two before adding one. So if a happened before b (same process, or connected by messages), a's stamp is lower than b's. The converse fails: a lower stamp doesn't mean a happened first, and concurrent events get ordered arbitrarily (a tie-break by process id makes the order total). They order cause and effect, not real time, and they can't detect concurrency.",
     "Cada proceso lleva un contador. Antes de cada evento le suma uno; cada mensaje lleva el contador, y quien lo recibe pone el suyo en el mayor de los dos antes de sumar uno. Así, si a ocurrió antes que b (en el mismo proceso, o conectados por mensajes), el sello de a es menor que el de b. Al revés no vale: un sello menor no significa que a ocurrió primero, y los eventos concurrentes quedan ordenados arbitrariamente (un desempate por id de proceso hace el orden total). Ordenan causa y efecto, no tiempo real, y no pueden detectar la concurrencia.")],
  [t("How do you compare two version vectors, what does each outcome mean, and what do they cost?", "¿Cómo comparas dos vectores de versiones, qué significa cada resultado y qué cuestan?"),
   t("Entry by entry. If every entry of a is ≤ b's, b has seen a and may replace it; if each has an entry larger than the other's, they are concurrent and both must be kept as siblings for someone to merge. The cost: one entry per writer per record, which grows with clients or nodes (Riak 2.0 made dotted version vectors the default for bucket types, to stop sibling explosion); merge logic in the application; and deletes need tombstones, or a merge brings the deleted item back.",
     "Entrada por entrada. Si cada entrada de a es ≤ a la de b, b vio a a y puede reemplazarla; si cada uno tiene una entrada mayor que la del otro, son concurrentes y hay que guardar los dos como hermanas para que alguien los una. El costo: una entrada por escritor por registro, que crece con los clientes o nodos (Riak 2.0 adoptó por defecto en los bucket types los vectores de versiones con punto, dotted version vectors, para frenar la explosión de hermanas); lógica de unión en la aplicación; y los borrados necesitan lápidas (tombstones), o una unión devuelve el artículo borrado.")],
  [t("Why should a timeout or a lease be measured with a monotonic clock, and why can't you compare monotonic readings across machines?", "¿Por qué un tiempo límite (timeout) o un arrendamiento se mide con un reloj monótono, y por qué no puedes comparar lecturas monótonas entre máquinas?"),
   t("The wall clock can jump (an NTP step, a manual change, a VM resumed from a snapshot), so end − start can come out negative or far too large. A monotonic clock (CLOCK_MONOTONIC, performance.now(), System.nanoTime()) never jumps, but its zero is arbitrary, often the boot, so readings from two machines mean nothing to each other. A lease held across machines needs a margin for clock drift, and the resource still needs a fencing token to reject a holder that outlived its lease (lesson 62, Leases & Fencing Tokens).",
     "El reloj de pared puede saltar (un salto de NTP, un cambio manual, una VM reanudada desde una instantánea), así que fin − inicio puede salir negativo o demasiado grande. Un reloj monótono (CLOCK_MONOTONIC, performance.now(), System.nanoTime()) nunca salta, pero su cero es arbitrario, a menudo el arranque, así que las lecturas de dos máquinas no significan nada entre sí. Un arrendamiento entre máquinas necesita un margen para la deriva de los relojes, y el recurso igual necesita un token de cerco (fencing token) para rechazar a quien siguió después de vencer su arrendamiento (lección 62, Arrendamientos y tokens de cerco).")],
  [t("How do real databases get timestamps that respect causality and still stay close to wall-clock time?", "¿Cómo obtienen las bases de datos reales marcas de tiempo que respetan la causalidad y aun así siguen cerca de la hora de pared?"),
   t("A hybrid logical clock (Kulkarni et al., 2014) stamps with the larger of the physical clock and the highest stamp seen, plus a logical counter for ties: like Lamport it never goes backwards or below anything already seen, and it stays within the clock skew of real time. CockroachDB uses one. Google's Spanner goes further with TrueTime: the clock API returns an interval that contains true time, backed by GPS and atomic clocks, and a commit waits out the uncertainty, a few milliseconds, so timestamp order matches real-time order.",
     "Un reloj lógico híbrido (hybrid logical clock, Kulkarni y otros, 2014) sella con el mayor entre el reloj físico y el sello más alto que vio, más un contador lógico para los empates: como Lamport, nunca retrocede ni queda por debajo de algo ya visto, y se mantiene dentro del desfase de reloj respecto del tiempo real. CockroachDB usa uno. Spanner de Google va más allá con TrueTime: la API del reloj devuelve un intervalo que contiene la hora real, respaldado por GPS y relojes atómicos, y un commit espera a que pase la incertidumbre, unos pocos milisegundos, para que el orden de las marcas coincida con el orden real.")],
];

export default defineLesson({
  title: t("Clock Workbench", "Banco de trabajo: relojes"),
  eyebrow: t("Systems lesson 61 · Clocks & last-write-wins", "Lección de sistemas 61 · Relojes y última escritura gana"),
  lede: t("Last-write-wins keeps whichever copy carries the highest timestamp, so it is only as right as the clocks that wrote the timestamps. A few milliseconds of clock skew is enough for an edit to lose to the older edit it was built on, and nothing reports an error. This lesson turns it into two offices with their own wall clocks and one records desk: watch it, predict what breaks it, then explain it back.",
    "La última escritura gana (last-write-wins, LWW) se queda con la copia que lleva la marca de tiempo (timestamp) más alta, así que solo acierta tanto como los relojes que escribieron esas marcas. Unos pocos milisegundos de desfase de reloj (clock skew) bastan para que una edición pierda contra la edición más vieja sobre la que se hizo, y nada reporta un error. Esta lección lo convierte en dos oficinas con sus propios relojes de pared y una mesa de registros: mírala, predice qué la rompe y después explícala."),
  machine: {
    intro: t("Each office edits the shared record one edit at a time: its courier fetches a copy (GET), the office adds a line, and the courier carries the whole record back, stamped by the office's own clock. The desk keeps the higher stamp, drops the other into the tray and answers OK either way. Change the rule, upset the clocks, or start an edit yourself.",
      "Cada oficina edita el registro compartido una edición a la vez: su mensajero trae una copia (GET), la oficina agrega una línea y el mensajero lleva de vuelta el registro entero, sellado con el reloj de la oficina. La mesa se queda con el sello más alto, tira el otro a la bandeja y responde OK en ambos casos. Cambia la regla, desajusta los relojes o empieza tú una edición."),
    plate: {
      title: t("Records desk", "Mesa de registros"),
      keys: [
        { mark: "lit", label: t("An edit the desk drops, into OLDER (it had read the edit that beat it) or SAME COPY; a sibling kept beside the record", "Una edición que la mesa descarta, en ANTE VIEJA (había leído la edición que le ganó) o en MISMA COPIA; una hermana guardada junto al registro") },
        { mark: "raised", label: t("Couriers: a GET, a copy, a stamped edit or an OK", "Mensajeros: un GET, una copia, una edición sellada o un OK") },
        { mark: "flat", label: t("The lanes between each office and the desk", "Los carriles entre cada oficina y la mesa") },
      ],
      caption: t(
        "Played at 1/250 of real speed, ten times faster while both offices wait between edits (change it under Speed). A courier's trip takes " + range(LEG) + " each way, an office works " + range(THINK) + " on its copy and waits about " + IDLE + " ms between edits: two services busy on one hot record (round, illustrative numbers). Each office's display shows its wall clock in ms, and its dial the same reading, one turn per 100 ms; TRUE TIME is the time nobody in the system can read. A slip carries the stamp: the wall-clock reading, the Lamport count, or the vector (A's count, B's count). The board shows the record's stamp and, with vector clocks, a second card for a sibling. Counters: each office's edits and lost edits (LOST: lines gone for good), the lines on the record (LINES) and the siblings kept (SIBLINGS).",
        "Se reproduce a 1/250 de la velocidad real, diez veces más rápido mientras las dos oficinas esperan entre ediciones (cámbiala en Velocidad). Un viaje del mensajero tarda " + range(LEG) + " por tramo, una oficina trabaja " + range(THINK) + " sobre su copia y espera unos " + IDLE + " ms entre ediciones: dos servicios ocupados con un registro muy activo (números redondos, ilustrativos). La pantalla de cada oficina muestra su reloj de pared en ms, y su dial la misma lectura, una vuelta cada 100 ms; HORA REAL es la hora que nadie en el sistema puede leer. Un papel lleva el sello: la lectura del reloj de pared, el contador de Lamport o el vector (contador de A, contador de B). El tablero muestra el sello del registro y, con relojes vectoriales, una segunda tarjeta para una hermana. Contadores: las ediciones y las ediciones perdidas de cada oficina (PERDIDAS: líneas que ya no vuelven), las líneas del registro (LÍNEAS) y las hermanas guardadas (HERMANAS).",
      ),
      stage: { "data-records-desk": "" },
      label: t("Clocks and last-write-wins simulation. Space pauses or resumes.", "Simulación de relojes y última escritura gana. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["edits", t("Edits", "Ediciones")],
      ["lost", t("Lost edits", "Ediciones perdidas")],
      ["older", t("Lost to older", "Perdidas ante viejas")],
      ["siblings", t("Siblings", "Hermanas")],
      ["skew", t("Clock A − B", "Reloj A − B"), "–"],
      ["kept", t("Kept, A · B", "Conservadas, A · B"), "–"],
    ],
    controls: [
      { seg: "rule", label: t("Rule", "Regla"), options: [["lww", t("Wall clock (LWW)", "Reloj de pared (LWW)")], ["lamport", t("Lamport clock", "Reloj de Lamport")], ["vector", t("Vector clock", "Reloj vectorial")]], value: "lww" },
      { seg: "clocks", label: t("Clocks", "Relojes"), options: [["exact", t("Exact", "Exactos")], ["ntp", "NTP, ±" + NTP_ERR + " ms"], ["behind", t("B not syncing", "B sin sincronizar")], ["step", t("A fast, then stepped back", "A adelantado, luego corregido")]], value: "ntp" },
      { speed: true, options: [[0.001, "1/1000"], [0.004, "1/250"], [0.01, "1/100"]], value: 0.004 },
      { actions: [["editA", t("Edit at A", "Editar en A"), { primary: true }], ["editB", t("Edit at B", "Editar en B")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again with new clock offsets: with NTP each clock is off by up to ±" + NTP_ERR + " ms; not syncing, B runs " + BEHIND + " ms slow; A fast runs " + FAST + " ms ahead until NTP steps it back a few seconds into the run. Edit at A or B starts an edit at once if that office is idle.",
      "Cambiar un ajuste reinicia la ejecución con nuevos desfases: con NTP cada reloj se desvía hasta ±" + NTP_ERR + " ms; sin sincronizar, B va " + BEHIND + " ms atrasado; A adelantado va " + FAST + " ms por delante hasta que NTP lo corrige de un salto a los pocos segundos. Editar en A o en B empieza una edición enseguida si esa oficina está libre."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + RUNS_TEXT.en + "; each run draws its own clock offsets.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + RUNS_TEXT.es + "; cada ejecución sortea sus propios desfases de reloj."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Lamport clocks follow Leslie Lamport's "Time, Clocks, and the Ordering of Events in a Distributed System" (1978); siblings and merges follow Amazon's Dynamo paper (2007).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los relojes de Lamport siguen "Time, Clocks, and the Ordering of Events in a Distributed System" de Leslie Lamport (1978); las hermanas y las uniones siguen el artículo de Dynamo de Amazon (2007).`),
  css: LIT_FILL_CSS + `
[data-slip-text]{font-weight:600}
[data-clock-text],[data-time-text],[data-card-text]{font-variant-numeric:tabular-nums}
`,
  data: { P, G: GEOMETRY, COURIER_SVG: courierSvg(), SLIP_SVG: slipSvg() },
});
