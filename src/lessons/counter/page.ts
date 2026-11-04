// @ts-nocheck: content ported as-is
// Systems lesson 21 · Distributed counters: three branches count adds into one register by courier.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, puckSvg, P, GEOMETRY } from "./figure";
import { lostAdds, casCost, slotCost, partitionRun, cutAcks, readAfterAdd } from "./sim";
import { pct, one } from "../../lib/format";

// Experiment results, computed at build time from the same model the page runs (the original page ran these
// same seeded runs in the browser when a card was run).
const RESULTS = {
  lost: lostAdds(),
  cas: { slow: casCost(0.1), heavy: casCost(0.6) },
  slots: { g: slotCost(0.6), c: casCost(0.6) },
  partition: partitionRun(),
  cutcas: { c: cutAcks("cas"), g: cutAcks("g") },
  seq: readAfterAdd(),
};

// What each card shows after a run.
const RUNS = {
  cas: () => {
    const { slow, heavy } = RESULTS.cas, lost = RESULTS.lost, top = Math.max(slow.retries, heavy.retries), topM = Math.max(slow.msgs, heavy.msgs);
    const a = Math.round(slow.stored), b = Math.round(slow.added), c = Math.round(heavy.stored), d = Math.round(heavy.added);
    return { verdict: t("Read, add, write at 0.3/s lost " + pct(lost.lost) + " of its adds, lesson 17's lost update. Compare-and-swap was exact both times (" + a + " of " + b + ", " + c + " of " + d + "). Retries per add: " + one(slow.retries) + " at 0.1/s, " + one(heavy.retries) + " at 0.6/s; courier trips per add: " + one(slow.msgs) + " → " + one(heavy.msgs) + ".",
        "Leer, sumar, escribir a 0.3/s perdió el " + pct(lost.lost) + " de sus sumas: la actualización perdida de la lección 17. Compare-and-swap fue exacto las dos veces (" + a + " de " + b + ", " + c + " de " + d + "). Reintentos por suma: " + one(slow.retries) + " a 0.1/s, " + one(heavy.retries) + " a 0.6/s; viajes de mensajero por suma: " + one(slow.msgs) + " → " + one(heavy.msgs) + "."),
      bars: [[t("Retries per add, 0.1/s", "Reintentos por suma, 0.1/s"), slow.retries / top, one(slow.retries)], [t("Retries per add, 0.6/s", "Reintentos por suma, 0.6/s"), heavy.retries / top, one(heavy.retries), true],
        [t("Trips per add, 0.1/s", "Viajes por suma, 0.1/s"), slow.msgs / topM, one(slow.msgs)], [t("Trips per add, 0.6/s", "Viajes por suma, 0.6/s"), heavy.msgs / topM, one(heavy.msgs), true]] };
  },
  slots: () => {
    const { g, c } = RESULTS.slots, top = Math.max(g.msgs, c.msgs);
    const a = Math.round(g.stored), b = Math.round(g.added);
    return { verdict: t("One slot each: " + a + " of " + b + " counted, " + one(g.retries) + " retries, " + one(g.msgs) + " courier trips per add. Compare-and-swap at the same rate: " + one(c.retries) + " retries and " + one(c.msgs) + " trips per add.",
        "Una casilla cada una: " + a + " de " + b + " contadas, " + one(g.retries) + " reintentos, " + one(g.msgs) + " viajes de mensajero por suma. Compare-and-swap al mismo ritmo: " + one(c.retries) + " reintentos y " + one(c.msgs) + " viajes por suma."),
      bars: [[t("Trips per add, CAS", "Viajes por suma, CAS"), c.msgs / top, one(c.msgs)], [t("Trips per add, slots", "Viajes por suma, casillas"), g.msgs / top, one(g.msgs), true]] };
  },
  partition: () => {
    const r = RESULTS.partition, top = Math.max(r.farBehind, r.nearBehind, 1);
    return { verdict: t("During the 15 s cut, C's total was up to " + one(r.farBehind) + " adds behind and A and B's up to " + one(r.nearBehind) + ". " + one(r.converge) + " s after healing, every branch agreed on the exact total" + (r.exact === 1 ? "; nothing was lost." : "."),
        "Durante el corte de 15 s, el total de C llegó a estar " + one(r.farBehind) + " sumas atrasado y el de A y B hasta " + one(r.nearBehind) + ". " + one(r.converge) + " s después de restablecerse, todas las sucursales coincidían en el total exacto" + (r.exact === 1 ? "; no se perdió nada." : ".")),
      bars: [[t("C behind, at worst", "C atrasada, en el peor caso"), r.farBehind / top, t(one(r.farBehind) + " adds", one(r.farBehind) + " sumas"), true], [t("A, B behind, at worst", "A, B atrasadas, en el peor caso"), r.nearBehind / top, t(one(r.nearBehind) + " adds", one(r.nearBehind) + " sumas")], [t("Time to agree after healing", "Tiempo hasta coincidir tras restablecerse"), Math.min(1, r.converge / 15), one(r.converge) + " s"]] };
  },
  cutcas: () => {
    const { c, g } = RESULTS.cutcas;
    return { verdict: t("With compare-and-swap, C acknowledged " + pct(c.during) + " of the adds made during the cut before it healed; each waited " + one(c.wait) + " s on average for its acknowledgement" + (c.exact === 1 ? ", and the count still ended exact" : "") + ". With one slot each, C acknowledged " + pct(g.during) + " of them at once.",
        "Con compare-and-swap, C confirmó el " + pct(c.during) + " de las sumas hechas durante el corte antes de que se restableciera; cada una esperó en promedio " + one(c.wait) + " s su confirmación" + (c.exact === 1 ? ", y aun así el conteo terminó exacto" : "") + ". Con una casilla cada una, C confirmó el " + pct(g.during) + " de ellas al instante."),
      bars: [[t("Acked during the cut, CAS", "Confirmadas en el corte, CAS"), c.during, pct(c.during), true], [t("Acked during the cut, slots", "Confirmadas en el corte, casillas"), g.during, pct(g.during)], [t("Wait for the ack, CAS", "Espera de la confirmación, CAS"), Math.min(1, c.wait / 15), one(c.wait) + " s", true]] };
  },
  seq: () => {
    const r = RESULTS.seq;
    return { verdict: t("B's own read showed its add " + pct(r.own) + " of the time; A's read showed it " + pct(r.other) + " of the time.",
        "La propia lectura de B mostró su suma el " + pct(r.own) + " de las veces; la lectura de A la mostró el " + pct(r.other) + " de las veces."),
      bars: [[t("B reads its own add", "B lee su propia suma"), r.own, pct(r.own)], [t("A reads B's add", "A lee la suma de B"), r.other, pct(r.other), true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "cas",
    title: t("Compare-and-swap, one courier trip away", "Compare-and-swap, a un viaje de mensajero"),
    change: t("Compare-and-swap on one shared key · traffic 0.1 → 0.6 adds/s per branch · each courier trip takes about 250 ms", "Compare-and-swap (CAS) sobre una clave compartida · tráfico 0.1 → 0.6 sumas/s por sucursal · cada viaje de mensajero tarda unos 250 ms"),
    question: t("Lesson 17, Race conditions, showed that read, add, write loses updates, and that checking the version fixes it. Here the check happens at the register, a courier trip away. What changes as traffic grows?", "La lección 17, Condiciones de carrera, mostró que leer, sumar, escribir pierde actualizaciones, y que verificar la versión lo arregla. Aquí la verificación ocurre en el registro, a un viaje de mensajero. ¿Qué cambia cuando crece el tráfico?"),
    options: [
      t("Nothing: each add still gets through on its first try", "Nada: cada suma sigue pasando en su primer intento"),
      t("Each add needs many more tries before it gets through", "Cada suma necesita muchos más intentos antes de pasar"),
      t("It stays exact at low traffic but loses adds at high traffic", "Sigue exacto con poco tráfico pero pierde sumas con mucho tráfico"),
    ],
    answer: 1,
    why: t(
      "The stamp only accepts a write if nobody changed the value since this branch read it. Between the read and the stamp lie two courier trips, about half a second, and any other branch's add in that window gets the write rejected. More traffic means more rejections: every retry costs two more round trips (four courier trips), and adds queue up behind each other on the single key. The count stays exact; the price is paid in latency and messages, and it grows with contention.",
      "El sello solo acepta una escritura si nadie cambió el valor desde que esta sucursal lo leyó. Entre la lectura y el sello hay dos viajes de mensajero, cerca de medio segundo, y cualquier suma de otra sucursal en ese intervalo hace que se rechace la escritura. Más tráfico significa más rechazos: cada reintento cuesta dos viajes de ida y vuelta más (cuatro viajes de mensajero), y las sumas hacen fila una detrás de otra sobre la única clave. El conteo sigue exacto; el precio se paga en latencia y en mensajes, y crece con la contención.",
    ),
    watch: { approach: "cas", rate: 0.6, nodes: 3 },
  },
  {
    id: "slots",
    title: t("One slot per branch", "Una casilla por sucursal"),
    change: t("Each branch writes only its own slot (its own count) · the total is the sum of all slots · 0.6 adds/s per branch, where compare-and-swap needed the most retries", "Cada sucursal escribe solo su propia casilla (su propio conteo) · el total es la suma de todas las casillas · 0.6 sumas/s por sucursal, donde compare-and-swap necesitó más reintentos"),
    question: t("How many adds are lost or retried now?", "¿Cuántas sumas se pierden o se reintentan ahora?"),
    options: [
      t("None: no two branches ever write the same key", "Ninguna: dos sucursales nunca escriben la misma clave"),
      t("A few, when two branches write at the same moment", "Unas pocas, cuando dos sucursales escriben en el mismo momento"),
      t("About as many as with compare-and-swap", "Más o menos tantas como con compare-and-swap"),
    ],
    answer: 0,
    why: t(
      "A branch only ever writes the slot it owns, so there is nothing to race on: no lost updates, no compare-and-swap, no retries, one round trip per add. Reading adds up every slot. Here each slot is its own key in one shared store, as in Fly.io's Gossip Glomers counter challenge. A true grow-only counter (G-counter), one of the simplest CRDTs, goes one step further: every replica keeps all the slots and merges copies by taking each slot's highest value, so replicas can keep counting even when they can't reach each other.",
      "Una sucursal solo escribe la casilla que le pertenece, así que no hay nada por lo que competir: ni actualizaciones perdidas, ni compare-and-swap, ni reintentos, un viaje de ida y vuelta por suma. Leer suma todas las casillas. Aquí cada casilla es su propia clave en un único almacén compartido, como en el desafío del contador de Gossip Glomers de Fly.io. Un verdadero contador que solo crece (G-counter), uno de los CRDT más simples, va un paso más allá: cada réplica guarda todas las casillas y fusiona copias tomando el valor más alto de cada una, así que las réplicas pueden seguir contando aunque no puedan comunicarse entre sí.",
    ),
    watch: { approach: "g", rate: 0.6, nodes: 3 },
  },
  {
    id: "partition",
    title: t("Branch C is cut off", "La sucursal C queda aislada"),
    change: t("One slot per branch · C's track is cut for 15 s, then healed · adds stop when it heals", "Una casilla por sucursal · la vía de C se corta durante 15 s y después se restablece · las sumas se detienen cuando se restablece"),
    question: t("What happens to the count while C is cut off, and after?", "¿Qué pasa con el conteo mientras C está aislada, y después?"),
    options: [
      t("C can't take adds until the track is back", "C no puede aceptar sumas hasta que vuelva la vía"),
      t("Totals fall behind on both sides, then agree within seconds", "Los totales se atrasan en ambos lados y después coinciden en segundos"),
      t("C's adds made during the cut are lost", "Las sumas que hizo C durante el corte se pierden"),
    ],
    answer: 1,
    why: t(
      "C keeps taking adds: it owns its slot, so it acknowledges each add at once and its own display counts it. But its reads can't reach the register and its writes wait at the barrier, so C misses A and B's adds, and A and B miss C's. When the track heals, C's queued writes land, every branch reads every slot, and they all agree on the exact total. Available during the cut, exact again soon after it: eventual consistency.",
      "C sigue aceptando sumas: es dueña de su casilla, así que confirma cada suma al instante y su propia pantalla la cuenta. Pero sus lecturas no llegan al registro y sus escrituras esperan en la barrera, así que a C le faltan las sumas de A y B, y a A y B les faltan las de C. Cuando se restablece la vía, las escrituras encoladas de C llegan, cada sucursal lee todas las casillas y todas coinciden en el total exacto. Disponible durante el corte y exacto otra vez poco después: consistencia eventual (eventual consistency).",
    ),
    watch: { approach: "g", rate: 0.3, nodes: 3, partition: true },
  },
  {
    id: "cutcas",
    title: t("The same cut, with compare-and-swap", "El mismo corte, con compare-and-swap"),
    change: t("C's track is cut for 15 s again · one slot each → compare-and-swap on the shared key · couriers wait at the barrier; nothing times out", "La vía de C se vuelve a cortar durante 15 s · una casilla cada una → compare-and-swap sobre la clave compartida · los mensajeros esperan en la barrera; nada vence"),
    question: t("What happens to the adds C's customers make during the cut?", "¿Qué pasa con las sumas que hacen los clientes de C durante el corte?"),
    options: [
      t("C acknowledges them at once, and the register catches up later", "C las confirma al instante, y el registro se pone al día después"),
      t("None is acknowledged until the track heals; then they all land", "Ninguna se confirma hasta que vuelve la vía; después llegan todas"),
      t("They are lost, because their couriers can't reach the register", "Se pierden, porque sus mensajeros no llegan al registro"),
    ],
    answer: 1,
    why: t(
      "With one shared key, C can't add without reading the current value, and the value lives on the other side of the barrier. So every add C takes during the cut waits, and when the track heals C's queued adds race each other for the stamp and retry. Nothing is lost and the count ends exact, but C was unavailable for the whole cut. With one slot each, C owned its slot and acknowledged every add at once. This is the trade the CAP theorem names: during a partition, answer now with totals that lag, or answer only once you can be exact.",
      "Con una única clave compartida, C no puede sumar sin leer el valor actual, y ese valor está del otro lado de la barrera. Así que cada suma que C recibe durante el corte espera, y cuando se restablece la vía, las sumas encoladas de C compiten entre sí por el sello y se reintentan. No se pierde nada y el conteo termina exacto, pero C no estuvo disponible durante todo el corte. Con una casilla cada una, C era dueña de su casilla y confirmó cada suma al instante. Es el intercambio que describe el teorema CAP: durante una partición, respondes ya con totales atrasados, o respondes solo cuando puedes ser exacto.",
    ),
    watch: { approach: "cas", rate: 0.3, nodes: 3, partition: true },
  },
  {
    id: "seq",
    title: t("Reading right after an add", "Leer justo después de una suma"),
    change: t("Compare-and-swap · B adds 1 and gets its acknowledgement · at that moment A and B each read the count · 20 tries", "Compare-and-swap · B suma 1 y recibe su confirmación · en ese momento A y B leen el conteo · 20 intentos"),
    question: t("Does A's read include B's add?", "¿La lectura de A incluye la suma de B?"),
    options: [
      t("Always: B's add was already acknowledged", "Siempre: la suma de B ya estaba confirmada"),
      t("Not always: A may read a slightly older state", "No siempre: A puede leer un estado un poco más viejo"),
      t("Never, until A's next scheduled refresh", "Nunca, hasta la próxima actualización programada de A"),
    ],
    answer: 1,
    why: t(
      "The register is only sequentially consistent: everyone sees the writes in the same order, and each branch never goes backwards from what it has already seen, but a read may be served from a state a moment old. B has seen its own write, so B's read includes it. A hasn't, so A can lag. If a user must see their own update, read through the branch that made it, or use a linearizable store.",
      "El registro solo es secuencialmente consistente (sequential consistency): todos ven las escrituras en el mismo orden y ninguna sucursal retrocede respecto de lo que ya vio, pero una lectura puede servirse desde un estado de hace un momento. B ya vio su propia escritura, así que su lectura la incluye. A no, así que A puede ir atrasada. Si un usuario tiene que ver su propia actualización, lee a través de la sucursal que la hizo o usa un almacén linealizable (linearizable).",
    ),
    watch: { approach: "cas", rate: 0.1, nodes: 3 },
  },
];

const QUESTIONS = [
  [t("Two services each read a counter, add one and write it back. Both succeed, yet the counter only went up by one. Why, and why did nothing report an error?", "Dos servicios leen un contador, le suman uno y lo vuelven a escribir. Los dos tienen éxito, pero el contador subió solo uno. ¿Por qué, y por qué nada reportó un error?"),
    t("Both read the same old value, so both wrote old + 1; the second write replaced the first. Each request was valid on its own, so no error is raised. It is lesson 17's lost update (Race conditions), across machines. The fix is an atomic operation: compare-and-swap, an atomic increment in the store, or a design where writers never share a key.", "Los dos leyeron el mismo valor viejo, así que los dos escribieron viejo + 1; la segunda escritura reemplazó a la primera. Cada solicitud era válida por sí sola, así que no se lanza ningún error. Es la actualización perdida de la lección 17, Condiciones de carrera, entre máquinas. La solución es una operación atómica: compare-and-swap, un incremento atómico en el almacén, o un diseño en el que los escritores nunca comparten una clave.")],
  [t("How does compare-and-swap prevent the lost update, and what does it cost?", "¿Cómo evita el compare-and-swap la actualización perdida, y qué cuesta?"),
    t("The write only succeeds if the value is still what you read; otherwise you re-read and try again. Nothing is lost, but under contention many attempts fail, each costing round trips, and throughput on that one key is capped by how fast read-then-write cycles can complete.", "La escritura solo tiene éxito si el valor sigue siendo el que leíste; si no, vuelves a leer y lo intentas otra vez. No se pierde nada, pero con contención muchos intentos fallan, cada uno cuesta viajes de ida y vuelta, y el rendimiento sobre esa clave queda limitado por lo rápido que se completan las rondas de leer y después escribir.")],
  [t("Explain a G-counter in one minute.", "Explica un G-counter en un minuto."),
    t("Each node keeps its own count in its own slot and only ever increments it; the value is the sum of all slots. On this machine the slots are keys in one shared store, so nothing ever needs merging. In a true G-counter CRDT every replica keeps a copy of all the slots, and two copies merge by taking each slot's maximum, so merges never conflict and every replica ends up with the same total, whatever order the messages arrive in.", "Cada nodo lleva su propio conteo en su propia casilla y solo lo incrementa; el valor es la suma de todas las casillas. En esta máquina las casillas son claves de un único almacén compartido, así que nunca hay que fusionar nada. En un verdadero G-counter CRDT, cada réplica guarda una copia de todas las casillas, y dos copias se fusionan tomando el máximo de cada casilla, así que las fusiones nunca entran en conflicto y todas las réplicas terminan con el mismo total, sin importar el orden en que lleguen los mensajes.")],
  [t("During a network partition, what does a G-counter give up, and what does it keep?", "Durante una partición de red, ¿a qué renuncia un G-counter y qué conserva?"),
    t("It gives up up-to-date reads: each side misses the other side's increments. It keeps availability (every node still takes adds into its own slot) and correctness after healing: no increment is lost or double counted, and everyone converges on the exact total.", "Renuncia a lecturas al día: a cada lado le faltan los incrementos del otro. Conserva la disponibilidad (cada nodo sigue aceptando sumas en su propia casilla) y la exactitud después de restablecerse: ningún incremento se pierde ni se cuenta dos veces, y todos convergen en el total exacto.")],
  [t("Your store is sequentially consistent. A user clicks \"like\", then reloads and sees the old count. What happened, and how would you fix it?", "Tu almacén es secuencialmente consistente. Un usuario hace clic en \"me gusta\", recarga y ve el conteo viejo. ¿Qué pasó, y cómo lo arreglarías?"),
    t("The reload was served from a replica or state that hadn't caught up yet. Sequential consistency only guarantees order, not recency. Fixes: read from the node that took the write (session stickiness), wait for or require a version at least as new as the write, or use a linearizable read for that path.", "La recarga se sirvió desde una réplica o un estado que todavía no se había puesto al día. La consistencia secuencial solo garantiza el orden, no que sea reciente. Soluciones: leer del nodo que recibió la escritura (afinidad de sesión, session stickiness), esperar o exigir una versión al menos tan nueva como la escritura, o usar una lectura linealizable para esa ruta.")],
  [t("When would you choose a single atomic counter in a database over a CRDT counter?", "¿Cuándo elegirías un único contador atómico en una base de datos en lugar de un contador CRDT?"),
    t("When reads must be exact and current (balances, stock that must not oversell) and the write rate on that key is moderate. CRDT counters win for high-volume, approximate-is-fine-for-a-moment counts (likes, views, metrics) and when writes must keep working during partitions.", "Cuando las lecturas tienen que ser exactas y actuales (saldos, stock que no se puede sobrevender) y el ritmo de escritura sobre esa clave es moderado. Los contadores CRDT ganan para conteos de alto volumen donde un valor aproximado por un momento está bien (me gusta, vistas, métricas) y cuando las escrituras tienen que seguir funcionando durante particiones.")],
];

export default defineLesson({
  title: t("Counter Workbench", "Banco de trabajo: contadores"),
  eyebrow: t("Systems lesson 21 · Distributed counters", "Lección de sistemas 21 · Contadores distribuidos"),
  lede: t("Counting sounds trivial until several machines count at once. This lesson builds a grow-only counter three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Contar parece trivial hasta que varias máquinas cuentan a la vez. Esta lección construye un contador que solo crece (G-counter) de tres maneras: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Three branches count adds into one register by courier. The tallies on the desks add up to the true total; compare them with the register and with each branch’s display. Start with read, add, write and watch the lost adds pile up, then try compare-and-swap and one slot each, and cut the far branch off.",
    "Tres sucursales cuentan sumas en un registro por medio de mensajeros. Los contadores de mano de los escritorios suman el total real; compáralos con el registro y con la pantalla de cada sucursal. Empieza con leer, sumar, escribir y mira cómo se acumulan las sumas perdidas; después prueba compare-and-swap y una casilla cada una, y aísla la sucursal lejana."),
    plate: {
      title: t("Branch tally", "Conteo de sucursales"),
      keys: [
        { mark: "lit", label: t("A courier on its way to the register; a plunger being pressed", "Un mensajero camino al registro; un botón que se presiona") },
        { mark: "raised", label: t("Counter wheels: every number in the system", "Ruedas contadoras: cada número del sistema") },
        { mark: "flat", label: t("Tracks between each branch and the register", "Vías entre cada sucursal y el registro") },
      ],
      caption: t(
        "Each branch desk has a hand tally (adds it took) and a front display (the total it last read). The register cabinet shows one big shared counter for read, add, write and compare-and-swap, or one slot counter per branch for one slot each. With one slot each, a branch acknowledges an add as soon as its own slot moves, since nobody else writes that slot. Compare-and-swap adds a stamp over the shared counter and a spindle that collects rejected slips. The desks are A, B and C, left to right; when the far branch is cut off, the barrier drops across its track and its couriers wait there. The counts agree when every display matches the sum of the tallies.",
        "Cada escritorio de sucursal tiene un contador de mano (las sumas que recibió) y una pantalla al frente (el total que leyó por última vez). El gabinete del registro muestra un gran contador compartido para leer, sumar, escribir y para compare-and-swap, o un contador por sucursal para una casilla cada una. Con una casilla cada una, una sucursal confirma una suma en cuanto se mueve su propia casilla, porque nadie más escribe en ella. Compare-and-swap agrega un sello sobre el contador compartido y un pincho que junta las boletas rechazadas. Los escritorios son A, B y C, de izquierda a derecha; cuando la sucursal lejana queda aislada, la barrera baja sobre su vía y sus mensajeros esperan ahí. Los conteos coinciden cuando cada pantalla muestra la suma de los contadores de mano.",
      ),
      stage: { "data-office": "" },
      label: t("Distributed counter simulation. Space pauses or resumes.", "Simulación de contador distribuido. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["total", t("Adds made", "Sumas hechas")], ["stored", t("Register total", "Total del registro")], ["lost", t("Lost adds", "Sumas perdidas")], ["retries", t("CAS retries", "Reintentos CAS")], ["reads", t("Reads A · B · C", "Lecturas A · B · C"), "–"], ["agree", t("Branches agree", "Coinciden"), "–"]],
    controls: [
      { seg: "approach", label: t("Approach", "Enfoque"), options: [["shared", t("Read, add, write", "Leer, sumar, escribir")], ["cas", "Compare-and-swap"], ["g", t("One slot each", "Una casilla cada una")]], value: "shared" },
      { seg: "nodes", label: t("Branches", "Sucursales"), options: [[2, "2"], [3, "3"]], value: 3 },
      { seg: "rate", label: t("Traffic", "Tráfico"), options: [[0, t("Off", "Apagado")], [0.1, "0.1/s"], [0.3, "0.3/s"], [0.6, "0.6/s"]], value: 0.3 },
      { seg: "partition", label: t("Far branch", "Sucursal lejana"), options: [["off", t("Connected", "Conectada")], ["on", t("Cut off", "Aislada")]], value: "off" },
      { speed: true },
      { actions: [["addA", t("Add at A", "Sumar en A")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Changing the approach, branches or traffic starts the run again. Traffic is adds per second at each branch; set it to Off to watch the branches settle on one total.",
      "Cambiar el enfoque, las sucursales o el tráfico vuelve a empezar la ejecución. El tráfico son sumas por segundo en cada sucursal; ponlo en Apagado para ver cómo las sucursales se ponen de acuerdo en un total.",
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). The setup follows Fly.io's <a href="https://fly.io/dist-sys/4/" target="_blank" rel="noopener">Gossip Glomers grow-only counter</a> challenge. Simulation written for this lesson.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). El planteamiento sigue el desafío <a href="https://fly.io/dist-sys/4/" target="_blank" rel="noopener">Gossip Glomers grow-only counter</a> de Fly.io. Simulación escrita para esta lección.`),
  css: `
[data-branch][data-off],[data-route][data-off]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
    PUCK_SVG: puckSvg(),
  },
});
