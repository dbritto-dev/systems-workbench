// @ts-nocheck: content ported as-is
// Systems lesson 21 · Distributed counters: three branches count adds into one register by courier.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, puckSvg, P, GEOMETRY } from "./figure";
import { lostAdds, casCost, slotCost, partitionRun, readAfterAdd } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the original page ran these
// same seeded runs in the browser when a card was run).
const RESULTS = {
  lost: lostAdds(),
  cas: { slow: casCost(0.1), heavy: casCost(0.6) },
  slots: { g: slotCost(0.6), c: casCost(0.6) },
  partition: partitionRun(),
  seq: readAfterAdd(),
};

const EXPERIMENTS = [
  {
    id: "lost",
    title: t("Read, add one, write it back", "Leer, sumar uno, volver a escribir"),
    change: t("One shared key · each add reads the count, adds 1 and writes the result · 3 branches, 0.3 adds/s each, for 60 s", "Una clave compartida · cada suma lee el conteo, le suma 1 y escribe el resultado · 3 sucursales, 0.3 sumas/s cada una, durante 60 s"),
    question: t("Every add does its read and its write successfully. What share of the adds end up in the register?", "Cada suma hace su lectura y su escritura sin errores. ¿Qué parte de las sumas termina en el registro?"),
    options: [
      t("All of them: each add writes its own +1", "Todas: cada suma escribe su propio +1"),
      t("Nearly all: maybe 1 or 2 are lost", "Casi todas: quizá se pierden 1 o 2"),
      t("Only about two thirds: more than a third are lost", "Solo unas dos terceras partes: se pierde más de un tercio"),
    ],
    answer: 2,
    why: t(
      "Two branches that read the same value both write value + 1, and one add disappears. With half a second between a read and its write, overlaps are common even at a gentle rate, and nothing reports an error: every write succeeds. This is a lost update, the classic read-modify-write race, now across machines.",
      "Dos sucursales que leen el mismo valor escriben las dos valor + 1, y una suma desaparece. Con medio segundo entre una lectura y su escritura, los cruces son comunes incluso a un ritmo suave, y nada reporta un error: cada escritura tiene éxito. Es una actualización perdida (lost update), la clásica carrera de leer-modificar-escribir, ahora entre máquinas.",
    ),
    watch: { approach: "shared", rate: 0.3, nodes: 3 },
  },
  {
    id: "cas",
    title: t("Compare-and-swap", "Compare-and-swap (CAS)"),
    change: t("The write becomes \"set to v + 1 only if it is still v\" · on failure, read again and retry · traffic 0.1 → 0.6 adds/s per branch", "La escritura pasa a ser \"pon v + 1 solo si todavía es v\" · si falla, vuelve a leer y reintenta · tráfico 0.1 → 0.6 sumas/s por sucursal"),
    question: t("The count is now exact at both rates. What changes as traffic grows?", "Ahora el conteo es exacto con los dos ritmos. ¿Qué cambia cuando crece el tráfico?"),
    options: [
      t("Nothing: compare-and-swap costs the same at any rate", "Nada: el compare-and-swap cuesta lo mismo a cualquier ritmo"),
      t("Each add needs many more attempts before it gets through", "Cada suma necesita muchos más intentos antes de pasar"),
      t("It stays exact at low traffic but starts losing adds at high traffic", "Sigue exacto con poco tráfico pero empieza a perder sumas con mucho tráfico"),
    ],
    answer: 1,
    why: t(
      "The stamp only accepts a write if nobody changed the value since this branch read it. With more branches adding at once, more writes are rejected and must read again. The count stays exact, but every retry costs two more courier trips, and at high traffic adds queue up behind each other on the single key.",
      "El sello solo acepta una escritura si nadie cambió el valor desde que esta sucursal lo leyó. Con más sucursales sumando a la vez, se rechazan más escrituras y hay que volver a leer. El conteo sigue exacto, pero cada reintento cuesta dos viajes de mensajero más, y con mucho tráfico las sumas hacen fila una detrás de otra sobre la única clave.",
    ),
    watch: { approach: "cas", rate: 0.6, nodes: 3 },
  },
  {
    id: "slots",
    title: t("One slot per branch", "Una casilla por sucursal"),
    change: t("Each branch writes only its own slot (its own count) · the total is the sum of all slots · 0.6 adds/s per branch, where compare-and-swap struggled", "Cada sucursal escribe solo su propia casilla (su propio conteo) · el total es la suma de todas las casillas · 0.6 sumas/s por sucursal, donde el compare-and-swap sufría"),
    question: t("How many adds are lost or retried now?", "¿Cuántas sumas se pierden o se reintentan ahora?"),
    options: [
      t("None: no two branches ever write the same key", "Ninguna: dos sucursales nunca escriben la misma clave"),
      t("A few, when two branches write at the same moment", "Unas pocas, cuando dos sucursales escriben en el mismo momento"),
      t("About as many as with compare-and-swap", "Más o menos tantas como con compare-and-swap"),
    ],
    answer: 0,
    why: t(
      "A branch only ever writes the slot it owns, so there is nothing to race on: no lost updates, no compare-and-swap, no retries. Reading adds up every slot. This is a grow-only counter (G-counter), one of the simplest CRDTs: replicas that can always merge (take each slot's highest value) and agree.",
      "Una sucursal solo escribe la casilla que le pertenece, así que no hay nada por lo que competir: ni actualizaciones perdidas, ni compare-and-swap, ni reintentos. Leer suma todas las casillas. Es un contador que solo crece (G-counter), uno de los CRDT más simples: réplicas que siempre pueden fusionarse (tomando el valor más alto de cada casilla) y coincidir.",
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
      t("Everyone's total is behind for a while (C misses the others, the others miss C), then all agree again within seconds", "El total de todos se atrasa un rato (a C le faltan las de las otras, a las otras les faltan las de C) y después todas vuelven a coincidir en segundos"),
      t("C's adds made during the cut are lost", "Las sumas que hizo C durante el corte se pierden"),
    ],
    answer: 1,
    why: t(
      "C keeps counting its own adds in its own slot, but its reads can't reach the register and its writes wait at the barrier. So C misses A and B's adds, and A and B miss C's. When the track heals, C's queued writes land, every branch reads every slot, and they all agree on the exact total. Always available, eventually consistent.",
      "C sigue contando sus propias sumas en su propia casilla, pero sus lecturas no llegan al registro y sus escrituras esperan en la barrera. Así que a C le faltan las sumas de A y B, y a A y B les faltan las de C. Cuando se restablece la vía, las escrituras encoladas de C llegan, cada sucursal lee todas las casillas y todas coinciden en el total exacto. Siempre disponible, con consistencia eventual (eventually consistent).",
    ),
    watch: { approach: "g", rate: 0.3, nodes: 3, partition: true },
  },
  {
    id: "seq",
    title: t("Reading right after an add", "Leer justo después de una suma"),
    change: t("Compare-and-swap · B adds 1 and gets its acknowledgement · at that moment A and B each read the count · 20 tries", "Compare-and-swap · B suma 1 y recibe su confirmación · en ese momento A y B leen el conteo · 20 intentos"),
    question: t("Does A's read include B's add?", "¿La lectura de A incluye la suma de B?"),
    options: [
      t("Always: B's add was already acknowledged", "Siempre: la suma de B ya estaba confirmada"),
      t("Not always: A can be served a slightly older state, while B always sees its own add", "No siempre: A puede recibir un estado un poco más viejo, mientras que B siempre ve su propia suma"),
      t("Never until A's next scheduled refresh", "Nunca hasta la próxima actualización programada de A"),
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
    t("Both read the same old value, so both wrote old + 1; the second write replaced the first. Each request was valid on its own, so no error is raised. The fix is an atomic operation: compare-and-swap, an atomic increment in the store, or a design where writers never share a key.", "Los dos leyeron el mismo valor viejo, así que los dos escribieron viejo + 1; la segunda escritura reemplazó a la primera. Cada solicitud era válida por sí sola, así que no se lanza ningún error. La solución es una operación atómica: compare-and-swap, un incremento atómico en el almacén, o un diseño en el que los escritores nunca comparten una clave.")],
  [t("How does compare-and-swap prevent the lost update, and what does it cost?", "¿Cómo evita el compare-and-swap la actualización perdida, y qué cuesta?"),
    t("The write only succeeds if the value is still what you read; otherwise you re-read and try again. Nothing is lost, but under contention many attempts fail, each costing round trips, and throughput on that one key is capped by how fast read-then-write cycles can complete.", "La escritura solo tiene éxito si el valor sigue siendo el que leíste; si no, vuelves a leer y lo intentas otra vez. No se pierde nada, pero con contención muchos intentos fallan, cada uno cuesta viajes de ida y vuelta, y el rendimiento sobre esa clave queda limitado por lo rápido que se completan los ciclos de leer y después escribir.")],
  [t("Explain a G-counter in one minute.", "Explica un G-counter en un minuto."),
    t("Each node keeps its own count in its own slot and only ever increments it. The value is the sum of all slots. Two copies merge by taking the maximum of each slot, so merges never conflict and every replica ends up with the same total, no matter the order messages arrive in.", "Cada nodo lleva su propio conteo en su propia casilla y solo lo incrementa. El valor es la suma de todas las casillas. Dos copias se fusionan tomando el máximo de cada casilla, así que las fusiones nunca entran en conflicto y todas las réplicas terminan con el mismo total, sin importar el orden en que lleguen los mensajes.")],
  [t("During a network partition, what does a G-counter give up, and what does it keep?", "Durante una partición de red, ¿a qué renuncia un G-counter y qué conserva?"),
    t("It gives up up-to-date reads: each side misses the other side's increments. It keeps availability (adds still succeed on both sides) and correctness after healing: no increment is lost or double counted, and everyone converges on the exact total.", "Renuncia a lecturas al día: a cada lado le faltan los incrementos del otro. Conserva la disponibilidad (las sumas siguen funcionando en los dos lados) y la exactitud después de restablecerse: ningún incremento se pierde ni se cuenta dos veces, y todos convergen en el total exacto.")],
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
        "Each branch desk has a hand tally (adds it took) and a front display (the total it last read). The register cabinet shows one big shared counter for read, add, write and compare-and-swap, or one slot counter per branch for one slot each. Compare-and-swap adds a stamp over the shared counter and a spindle that collects rejected slips. When the far branch is cut off, the barrier drops across its track and its couriers wait there. The counts agree when every display matches the sum of the tallies.",
        "Cada escritorio de sucursal tiene un contador de mano (las sumas que recibió) y una pantalla al frente (el total que leyó por última vez). El gabinete del registro muestra un gran contador compartido para leer, sumar, escribir y para compare-and-swap, o un contador por sucursal para una casilla cada una. Compare-and-swap agrega un sello sobre el contador compartido y un pincho que junta las boletas rechazadas. Cuando la sucursal lejana queda aislada, la barrera baja sobre su vía y sus mensajeros esperan ahí. Los conteos coinciden cuando cada pantalla muestra la suma de los contadores de mano.",
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
      "Cambiar el enfoque, las sucursales o el tráfico vuelve a empezar la corrida. El tráfico son sumas por segundo en cada sucursal; ponlo en Apagado para ver cómo las sucursales se ponen de acuerdo en un total.",
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho corridas con semilla."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). The setup follows Fly.io's <a href="https://fly.io/dist-sys/4/" target="_blank" rel="noopener">Gossip Glomers grow-only counter</a> challenge. Simulation written for this lesson.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). El planteo sigue el desafío <a href="https://fly.io/dist-sys/4/" target="_blank" rel="noopener">Gossip Glomers grow-only counter</a> de Fly.io. Simulación escrita para esta lección.`),
  css: `
[data-branch][data-off],[data-route][data-off]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
    PUCK_SVG: puckSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
