// @ts-nocheck: content ported as-is
// Systems lesson 24 · Outbox pattern: an order office where the ledger and the letter must agree.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, railLetterSvg, droppedLetterSvg, P, GEOMETRY } from "./figure";
import { experimentResults } from "./sim";
import { one, n0 } from "../../lib/format";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran them on click).
const RESULTS = experimentResults();

// What each card shows after a run.
const RUNS = {
  lost: () => {
    const r = RESULTS.lost;
    return { verdict: t("The ledger took " + n0(r.orders) + " orders; the warehouse shipped " + n0(r.shipped) + ". " + one(r.lost) + " orders were committed and never shipped, and nothing reported an error.",
        "El libro recibió " + n0(r.orders) + " pedidos; el almacén envió " + n0(r.shipped) + ". " + one(r.lost) + " pedidos se confirmaron y nunca se enviaron, y nada reportó un error."),
      bars: [[t("In the ledger", "En el libro"), 1, n0(r.orders)], [t("Shipped", "Enviados"), r.shipped / r.orders, n0(r.shipped)], [t("Lost", "Perdidos"), r.lost / r.orders, one(r.lost), true]] };
  },
  phantom: () => {
    const r = RESULTS.phantom, top = Math.max(r.orders, r.shipped);
    return { verdict: t("Nothing lost, but the warehouse shipped " + n0(r.shipped) + " orders against " + n0(r.orders) + " in the ledger: " + one(r.phantom) + " phantom orders whose ledger write failed after the letter had gone.",
        "No se perdió nada, pero el almacén envió " + n0(r.shipped) + " pedidos frente a " + n0(r.orders) + " en el libro: " + one(r.phantom) + " pedidos fantasma cuya escritura en el libro falló después de que la carta ya había salido."),
      bars: [[t("In the ledger", "En el libro"), r.orders / top, n0(r.orders)], [t("Shipped", "Enviados"), r.shipped / top, n0(r.shipped)], [t("Phantom", "Fantasma"), r.phantom / top, one(r.phantom), true]] };
  },
  outbox: () => {
    const r = RESULTS.outbox;
    return { verdict: t("Lost " + one(r.lost) + ", phantom " + one(r.phantom) + ". " + one(r.failed) + " orders failed as a whole (the customer got an error, nothing was kept). The relay failed " + one(r.relayCrashes) + " times and posted " + one(r.caught) + " letters a second time.",
        "Perdidos " + one(r.lost) + ", fantasma " + one(r.phantom) + ". " + one(r.failed) + " pedidos fallaron por completo (el cliente recibió un error, no quedó nada). El reenviador falló " + one(r.relayCrashes) + " veces y despachó " + one(r.caught) + " cartas por segunda vez."),
      bars: [[t("Lost or phantom", "Perdidos o fantasma"), (r.lost + r.phantom) / Math.max(1, r.caught), one(r.lost + r.phantom)], [t("Letters that arrived twice", "Cartas que llegaron dos veces"), 1, one(r.caught), true]] };
  },
  dedupe: () => {
    const { after, atomic } = RESULTS.dedupe;
    const top = Math.max(after.dupShipped, after.whCrashes, 1);
    return { verdict: t("The warehouse failed " + one(after.whCrashes) + " times in " + n0(after.orders) + " orders. With dedupe on and the number spiked after shipping, " + one(after.dupShipped) + " orders shipped twice. Spiked in the same transaction as the shipment: " + one(atomic.dupShipped) + ".",
        "El almacén falló " + one(after.whCrashes) + " veces en " + n0(after.orders) + " pedidos. Con la deduplicación encendida y el número clavado después de enviar, " + one(after.dupShipped) + " pedidos se enviaron dos veces. Clavado en la misma transacción que el envío: " + one(atomic.dupShipped) + "."),
      bars: [[t("Warehouse failures", "Fallas del almacén"), after.whCrashes / top, one(after.whCrashes)], [t("Shipped twice, spiked after", "Enviados dos veces, clavado después"), after.dupShipped / top, one(after.dupShipped), true], [t("Shipped twice, one transaction", "Enviados dos veces, una transacción"), atomic.dupShipped / top, one(atomic.dupShipped)]] };
  },
  poll: () => {
    const { rows, dual } = RESULTS.poll;
    const top = Math.max(...rows.map(([, r]) => r.p95));
    const lost = one(rows.reduce((s, [, r]) => s + r.lost, 0));
    return { verdict: t("Typical delay from commit to warehouse: " + rows.map(([p, r]) => one(r.median) + " s at " + p + " s").join(", ") + " (slowest 5%: " + rows.map(([, r]) => one(r.p95) + " s").join(", ") + "). Walking it over directly: " + one(dual.median) + " s. Lost: " + lost + ".",
        "Demora típica desde el commit hasta el almacén: " + rows.map(([p, r]) => one(r.median) + " s con " + p + " s").join(", ") + " (el 5% más lento: " + rows.map(([, r]) => one(r.p95) + " s").join(", ") + "). Llevándola directamente: " + one(dual.median) + " s. Perdidos: " + lost + "."),
      bars: [[t("Walk it over (no outbox)", "Llevarla directo (sin outbox)"), dual.median / top, one(dual.median) + " s"], ...rows.map(([p, r]) => [t("Relay every " + p + " s, typical", "Reenviador cada " + p + " s, típica"), r.median / top, one(r.median) + " s", p === 5]), [t("Relay every 5 s, slowest 5%", "Reenviador cada 5 s, el 5% más lento"), rows[2][1].p95 / top, one(rows[2][1].p95) + " s", true]] };
  },
};

const EXPERIMENTS = [
  {
    id: "lost",
    title: t("Fail between the two writes", "Fallar entre las dos escrituras"),
    change: t("Write the ledger, then post the letter · the clerk fails on the way to the postbox for 1 order in 20 · 10 minutes of orders", "Escribir el libro y después despachar la carta · el empleado falla camino al buzón en 1 de cada 20 pedidos · 10 minutos de pedidos"),
    question: t("Every ledger write succeeds before the clerk sets off. What does the warehouse end up with?", "Cada escritura en el libro tiene éxito antes de que el empleado salga. ¿Con qué termina el almacén?"),
    options: [
      t("Every order: once the ledger has it, the order is safe", "Con todos los pedidos: una vez que está en el libro, el pedido está a salvo"),
      t("About 1 order in 20 never reaches the warehouse, and nothing reports it", "Cerca de 1 de cada 20 pedidos nunca llega al almacén, y nada lo reporta"),
      t("The ledger rolls those orders back, so the two still agree", "El libro revierte esos pedidos, así que los dos siguen coincidiendo"),
    ],
    answer: 1,
    why: t(
      "The ledger commit and the letter are two separate writes to two separate systems. When the process dies between them, the first is permanent and the second never happens. The customer was told yes, the database has the order, and the warehouse will never ship it. No error is raised anywhere, because each write that ran, worked.",
      "El commit en el libro y la carta son dos escrituras separadas en dos sistemas separados. Cuando el proceso muere entre una y otra, la primera es permanente y la segunda nunca ocurre. Al cliente se le dijo que sí, la base de datos tiene el pedido y el almacén nunca lo va a enviar. No se lanza ningún error en ninguna parte, porque cada escritura que se ejecutó funcionó.",
    ),
    watch: { mode: "dual", crash: 0.15 },
  },
  {
    id: "phantom",
    title: t("Send first, then write", "Enviar primero, escribir después"),
    change: t("Swap the order: post the letter, then write the ledger · the ledger write fails for 1 order in 20", "Invertir el orden: despachar la carta y después escribir el libro · la escritura en el libro falla en 1 de cada 20 pedidos"),
    question: t("Does sending first fix it?", "¿Enviar primero lo arregla?"),
    options: [
      t("Yes: nothing lost, nothing extra shipped", "Sí: no se pierde nada ni se envía nada de más"),
      t("Nothing lost, but some orders ship that the ledger never kept", "No se pierde nada, pero se envían pedidos que el libro nunca guardó"),
      t("It still loses orders, and ships extra ones too", "Igual pierde pedidos, y además envía de más"),
    ],
    answer: 1,
    why: t(
      "Swapping the writes swaps the failure. The letter is already on its way when the ledger write fails, so the warehouse ships an order that, as far as your database is concerned, never happened: the customer got an error and may order again. Watch the bin fill with failed cards while SHIPPED runs ahead of IN THE LEDGER. Lesson 26, Sagas, meets the same choice across several services.",
      "Invertir las escrituras invierte la falla. La carta ya va en camino cuando falla la escritura en el libro, así que el almacén envía un pedido que, para tu base de datos, nunca existió: el cliente recibió un error y puede volver a pedir. Mira cómo el descarte se llena de tarjetas fallidas mientras ENVIADOS se adelanta a EN EL LIBRO. La lección 26, Sagas, enfrenta la misma decisión entre varios servicios.",
    ),
    watch: { mode: "pubfirst", crash: 0.15 },
  },
  {
    id: "outbox",
    title: t("Put the letter in the outbox", "Poner la carta en el outbox"),
    change: t("The ledger card and the letter go into the cabinet in one transaction · a relay posts pending letters in bundles, then marks them sent · clerk fails 5%; relay fails on 10% of trips, after posting its bundle, before marking", "La tarjeta del libro y la carta entran al gabinete en una sola transacción · un reenviador (relay) despacha las cartas pendientes en paquetes y después las marca como enviadas · el empleado falla 5%; el reenviador falla en el 10% de los viajes, después de despachar su paquete y antes de marcarlo"),
    question: t("What happens to lost and phantom orders now, and what new thing appears?", "¿Qué pasa ahora con los pedidos perdidos y fantasma, y qué cosa nueva aparece?"),
    options: [
      t("None lost, none phantom, but some letters reach the warehouse twice", "Ninguno perdido, ninguno fantasma, pero algunas cartas llegan dos veces al almacén"),
      t("None lost, none phantom, and every letter arrives exactly once", "Ninguno perdido, ninguno fantasma, y cada carta llega exactamente una vez"),
      t("Letters are still lost whenever the relay fails", "Se siguen perdiendo cartas cada vez que falla el reenviador"),
    ],
    answer: 0,
    why: t(
      "One transaction writes both rows or neither, so a failed clerk leaves no order and no letter: the customer gets an error and can retry. The relay only marks a letter sent after posting it; if it fails in between, its whole bundle is still pending and gets posted again, which is why there are about two repeats per relay failure. That is at-least-once delivery, as in lesson 02, Pub/sub: nothing is lost, and some letters arrive twice.",
      "Una transacción escribe las dos filas o ninguna, así que un empleado que falla no deja ni pedido ni carta: el cliente recibe un error y puede reintentar. El reenviador solo marca una carta como enviada después de despacharla; si falla en el medio, todo su paquete sigue pendiente y se vuelve a despachar, por eso hay unas dos repeticiones por cada falla del reenviador. Eso es entrega al menos una vez (at-least-once), como en la lección 02, Pub/sub: no se pierde nada, y algunas cartas llegan dos veces.",
    ),
    watch: { mode: "outbox", crash: 0.05, relay: 0.3, dedupe: "on" },
  },
  {
    id: "dedupe",
    title: t("Dedupe that isn't atomic", "Deduplicar sin atomicidad"),
    change: t("Outbox, warehouse dedupe on, clerk and relay never fail · the warehouse fails 1 time in 20 after shipping, before it puts the order number on the spike; it never acknowledged the letter, so the letter comes back", "Outbox, deduplicación en el almacén encendida, el empleado y el reenviador nunca fallan · el almacén falla 1 de cada 20 veces después de enviar y antes de poner el número de pedido en el pincho; nunca confirmó la carta, así que la carta vuelve"),
    question: t("Dedupe is on. How many orders ship twice?", "La deduplicación está encendida. ¿Cuántos pedidos se envían dos veces?"),
    options: [
      t("None: the spike drops every repeat", "Ninguno: el pincho descarta cada repetición"),
      t("About 1 order in 20", "Cerca de 1 de cada 20 pedidos"),
      t("A few, far fewer than 1 in 20", "Unos pocos, muchos menos que 1 de cada 20"),
    ],
    answer: 1,
    why: t(
      "Dedupe only protects you if the record of what you handled and the effect commit together. A failure between shipping and spiking leaves an order shipped but not marked, so the letter that comes back looks new and ships again. Write the order number in the same transaction as the shipment (or make the shipment itself an upsert keyed by the order), and a failure undoes both: the returned letter then ships once. Lesson 25, Idempotency keys, builds this record of handled requests.",
      "La deduplicación solo te protege si el registro de lo que procesaste y el efecto se confirman juntos. Una falla entre enviar y clavar el número en el pincho deja un pedido enviado pero sin marcar, así que la carta que vuelve parece nueva y se envía otra vez. Escribe el número de pedido en la misma transacción que el envío (o haz que el envío mismo sea un upsert con el pedido como clave), y una falla deshace las dos cosas: la carta que vuelve se envía una sola vez. La lección 25, Claves de idempotencia, construye este registro de solicitudes procesadas.",
    ),
    watch: { mode: "outbox", crash: 0, relay: 0, dedupe: "after", wh: 0.15 },
  },
  {
    id: "poll",
    title: t("A slower relay", "Un reenviador más lento"),
    change: t("Outbox, nothing fails · the relay checks the outbox every 0.5 s, 2 s or 5 s · compared with walking the letter straight over", "Outbox, nada falla · el reenviador revisa el outbox cada 0.5 s, 2 s o 5 s · comparado con llevar la carta directamente"),
    question: t("What does a longer poll interval cost?", "¿Qué cuesta un intervalo de sondeo (polling) más largo?"),
    options: [
      t("Letters get lost when the relay checks rarely", "Se pierden cartas cuando el reenviador revisa pocas veces"),
      t("Letters reach the warehouse later; nothing is lost or repeated", "Las cartas llegan más tarde al almacén; nada se pierde ni se repite"),
      t("More letters arrive twice", "Llegan más cartas dos veces"),
    ],
    answer: 1,
    why: t(
      "Each letter waits in the outbox until the next check, on average about half the interval, plus the trip. The guarantee is the same at any interval; only latency (and how often you query the database) changes. Change data capture, which tails the database's log instead of polling the table, gets the wait close to zero.",
      "Cada carta espera en el outbox hasta la próxima revisión, en promedio cerca de la mitad del intervalo, más el viaje. La garantía es la misma con cualquier intervalo; solo cambia la latencia (y cada cuánto consultas la base de datos). La captura de cambios (change data capture, CDC), que sigue el log de la base de datos en lugar de sondear la tabla, deja la espera cerca de cero.",
    ),
    watch: { mode: "outbox", crash: 0, relay: 0, dedupe: "on", poll: 5 },
  },
];

const QUESTIONS = [
  [t("A handler saves an order and then publishes an \"order placed\" event. Both calls succeed in all your tests. What can still go wrong in production?", "Un handler guarda un pedido y después publica un evento \"pedido creado\". Las dos llamadas tienen éxito en todas tus pruebas. ¿Qué puede salir mal igual en producción?"),
    t("The process can die, be redeployed or time out between the two calls. The order is committed, the event is never published, and downstream services never hear of it. Nothing errors, so it shows up later as an order that never shipped.", "El proceso puede morir, ser redesplegado o agotar su tiempo entre las dos llamadas. El pedido queda confirmado, el evento nunca se publica y los servicios que dependen de él nunca se enteran. Nada da error, así que aparece más tarde como un pedido que nunca se envió.")],
  [t("Why doesn't publishing first, then saving, fix it?", "¿Por qué publicar primero y guardar después no lo arregla?"),
    t("It flips the failure: if the save fails after the publish, consumers act on an order your database doesn't have. A phantom is often worse than a loss, because other systems have already shipped, charged or emailed.", "Invierte la falla: si el guardado falla después de publicar, los consumidores actúan sobre un pedido que tu base de datos no tiene. Un fantasma suele ser peor que una pérdida, porque otros sistemas ya enviaron, cobraron o mandaron emails.")],
  [t("How does the outbox make the two writes atomic, and what does it rely on?", "¿Cómo hace el outbox que las dos escrituras sean atómicas, y en qué se apoya?"),
    t("The event is written as a row in an outbox table in the same database transaction as the business change, so both commit or neither does. It relies on that single local transaction; a separate process then reads the outbox and publishes.", "El evento se escribe como una fila en una tabla outbox dentro de la misma transacción de base de datos que el cambio de negocio, así que se confirman las dos o ninguna. Se apoya en esa única transacción local; después, un proceso aparte lee el outbox y publica.")],
  [t("Why does the relay deliver at least once instead of exactly once, and what does that ask of consumers?", "¿Por qué el reenviador entrega al menos una vez en lugar de exactamente una vez, y qué les pide eso a los consumidores?"),
    t("It can only mark a row sent after the broker accepts it; if it crashes in between, it publishes the row again on restart. Consumers must be idempotent: dedupe by event ID in the same transaction as the effect, or make the effect an upsert keyed by the business ID (lesson 25, Idempotency keys).", "Solo puede marcar una fila como enviada después de que el broker la acepta; si se cae en el medio, vuelve a publicar la fila al reiniciar. Los consumidores tienen que ser idempotentes: deduplicar por ID de evento en la misma transacción que el efecto, o hacer que el efecto sea un upsert con el ID de negocio como clave (lección 25, Claves de idempotencia).")],
  [t("Polling the outbox table or change data capture (reading the database log, for example with Debezium): what is the trade-off?", "Sondear la tabla outbox (polling) o captura de cambios (change data capture: leer el log de la base de datos, por ejemplo con Debezium): ¿cuál es el compromiso?"),
    t("Polling is simple and works anywhere, but adds latency (about half the interval) and query load. CDC usually publishes well under a second after commit and doesn't query the table, but needs log access, a connector to run and operate, and care with schema changes.", "El sondeo es simple y funciona en cualquier lado, pero agrega latencia (cerca de la mitad del intervalo) y carga de consultas. CDC suele publicar bastante menos de un segundo después del commit y no consulta la tabla, pero necesita acceso al log, un conector que correr y operar, y cuidado con los cambios de esquema.")],
  [t("How do you keep events for one order in order, and what happens to the outbox table over time?", "¿Cómo mantienes en orden los eventos de un pedido, y qué pasa con la tabla outbox con el tiempo?"),
    t("Publish rows in commit order per aggregate and use the order ID as the partition key, so one partition (and one consumer) sees them in sequence; don't publish one aggregate's rows in parallel. If you poll, select unsent rows rather than \"id > last seen\": ids can commit out of order, so a row with a lower id can appear after you passed it. Sent rows are deleted or archived on a schedule, or the table grows forever. Lesson 20, Logs and offsets, shows why one key per partition keeps order.", "Publica las filas en orden de commit por agregado y usa el ID del pedido como clave de partición, así una partición (y un consumidor) las ve en secuencia; no publiques en paralelo las filas de un mismo agregado. Si sondeas, selecciona las filas no enviadas en lugar de \"id > último visto\": los ids se pueden confirmar fuera de orden, así que una fila con un id menor puede aparecer después de que lo pasaste. Las filas enviadas se borran o archivan periódicamente, o la tabla crece para siempre. La lección 20, Logs y offsets, muestra por qué una clave por partición mantiene el orden.")],
];

export default defineLesson({
  title: t("Outbox Workbench", "Banco de trabajo: outbox"),
  eyebrow: t("Systems lesson 24 · Outbox pattern", "Lección de sistemas 24 · Patrón outbox"),
  lede: t("Many requests have to do two things: save something in the database and tell other services about it. Done as two separate writes, a failure in between leaves them disagreeing, and nothing reports it. This lesson builds the outbox pattern: watch a machine do it, predict what breaks it, then explain it back.",
    "Muchas solicitudes tienen que hacer dos cosas: guardar algo en la base de datos y avisarles a otros servicios. Hechas como dos escrituras separadas, una falla en el medio las deja en desacuerdo, y nada lo reporta. Esta lección construye el patrón outbox (bandeja de salida): mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("A clerk records each order in the ledger cabinet (the database) and a letter has to reach the warehouse (the event). It opens on write, then send, with the clerk failing on 15% of orders: compare IN THE LEDGER on the cabinet with SHIPPED on the warehouse, and look for letters on the floor. Then try send, then write, and the outbox.",
      "Un empleado registra cada pedido en el gabinete del libro (la base de datos) y una carta tiene que llegar al almacén (el evento). Empieza con escribir, luego enviar, con el empleado fallando en el 15% de los pedidos: compara EN EL LIBRO en el gabinete con ENVIADOS en el almacén, y busca cartas en el piso. Después prueba enviar, luego escribir, y el outbox."),
    plate: {
      title: t("Order office", "Oficina de pedidos"),
      keys: [
        { mark: "lit", label: t("A letter on its way: in a hand, on the rail, or the relay's bundle; the newest card or number", "Una carta en camino: en una mano, en el riel o en el paquete del reenviador; la tarjeta o el número más reciente") },
        { mark: "raised", label: t("Counter wheels: in the ledger, shipped, and twice (shipped twice) or caught (repeats dropped)", "Ruedas contadoras: en el libro, enviados, y dos veces (enviados dos veces) o detectadas (repeticiones descartadas)") },
        { mark: "flat", label: t("The rail from the postbox to the warehouse intake", "El riel del buzón a la recepción del almacén") },
      ],
      caption: t(
        "The clerk takes orders from the in-tray. Write, then send: the clerk files the order in the ledger cabinet and walks the letter to the postbox; a fall on the way leaves the letter on the floor. Send, then write: the letter goes first, and a ledger write that fails ends in the bin. Outbox: the card and the letter go into the cabinet together, and pending letters stand in the pulled-out drawer until the relay, in a cap, carries them to the postbox at each tick of its timer and comes back to mark them sent. At the warehouse, the spike holds order numbers already seen and the tray beside it the repeats it caught. Compare IN THE LEDGER with SHIPPED.",
        "El empleado toma los pedidos de la bandeja de entrada. Escribir y después enviar: el empleado archiva el pedido en el gabinete del libro y lleva la carta al buzón; una caída en el camino deja la carta en el piso. Enviar y después escribir: la carta sale primero, y una escritura en el libro que falla termina en el descarte. Outbox: la tarjeta y la carta entran juntas al gabinete, y las cartas pendientes esperan en el cajón abierto hasta que el reenviador (relay), el de la gorra, las lleva al buzón en cada tic de su temporizador y vuelve a marcarlas como enviadas. En el almacén, el pincho guarda los números de pedido ya vistos y la bandeja de al lado las repeticiones que detectó. Compara EN EL LIBRO con ENVIADOS.",
      ),
      stage: { "data-office": "" },
      label: t("Outbox pattern simulation. Space pauses or resumes.", "Simulación del patrón outbox. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["orders", t("In the ledger", "En el libro")], ["shipped", t("Shipped", "Enviados")], ["lost", t("Lost", "Perdidos")], ["phantom", t("Phantom", "Fantasma")], ["dups", t("Shipped twice", "Enviados dos veces")], ["delay", t("Typical delay", "Demora típica"), "–"]],
    controls: [
      { seg: "mode", label: t("Approach", "Enfoque"), options: [["dual", t("Write, then send", "Escribir, luego enviar")], ["pubfirst", t("Send, then write", "Enviar, luego escribir")], ["outbox", "Outbox"]], value: "dual" },
      { seg: "crash", label: t("Clerk fails", "El empleado falla"), options: [[0, t("Never", "Nunca")], [0.05, "5%"], [0.15, "15%"]], value: 0.15 },
      { seg: "relay", label: t("Relay fails", "El reenviador falla"), options: [[0, t("Never", "Nunca")], [0.1, "10%"], [0.3, "30%"]], value: 0.1 },
      { seg: "dedupe", label: t("Warehouse dedupe", "Deduplicación en almacén"), options: [["off", t("Off", "Apagada")], ["after", t("Spike after shipping", "Clavar después de enviar")], ["on", t("One transaction", "Una transacción")]], value: "off" },
      { seg: "wh", label: t("Warehouse fails", "El almacén falla"), options: [[0, t("Never", "Nunca")], [0.05, "5%"], [0.15, "15%"]], value: 0 },
      { seg: "poll", label: t("Relay checks every", "El reenviador revisa cada"), options: [[0.5, "0.5 s"], [2, "2 s"], [5, "5 s"]], value: 2 },
      { speed: true },
      { actions: [["crash", t("Fail the next order", "Hacer fallar el próximo pedido")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      'Changing a setting starts the run again. Orders arrive about once every 4 seconds. "Warehouse fails" means after shipping, before the order number reaches the spike.',
      'Cambiar un ajuste vuelve a empezar la ejecución. Los pedidos llegan más o menos cada 4 segundos. "El almacén falla" significa después de enviar y antes de que el número de pedido llegue al pincho.',
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine: 10 minutes of orders, averaged over eight seeded runs. <em>Watch it in the figure</em> raises the failure rates to 15% (30% for the relay) so failures show up within a minute.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina: 10 minutos de pedidos, promediados sobre ocho ejecuciones con semilla. <em>Míralo en la figura</em> sube las fallas al 15% (30% para el reenviador) para que aparezcan en menos de un minuto."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.needle{stroke-width:1.6}
`,
  data: {
    P,
    G: GEOMETRY,
    RAIL_SVG: railLetterSvg(),
    DROP_SVG: droppedLetterSvg(),
  },
});
