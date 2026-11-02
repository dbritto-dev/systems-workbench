// @ts-nocheck: content ported as-is
// Systems lesson 25 · Idempotency keys: a payment counter that remembers each key's receipt.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, tokenSvgs, P, GEOMETRY } from "./figure";
import { experimentResults } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran them on click).
const RESULTS = experimentResults();

const EXPERIMENTS = [
  {
    id: "lost",
    title: t("Lost replies, no keys", "Respuestas perdidas, sin claves"),
    change: t("Keys off · 1 reply in 10 is lost on the way back · a customer who hears nothing in 5 s pays again · 4 customers, 3 minutes", "Claves apagadas · 1 de cada 10 respuestas se pierde al volver · un cliente que no recibe nada en 5 s paga de nuevo · 4 clientes, 3 minutos"),
    question: t("The counter charges correctly every time it receives a slip. Out of roughly 120 orders, how many end up charged twice?", "El mostrador cobra bien cada vez que recibe una boleta. De unos 120 pedidos, ¿a cuántos se les termina cobrando dos veces?"),
    options: [
      t("None: every charge the counter made was a real request", "A ninguno: cada cobro que hizo el mostrador fue una solicitud real"),
      t("About one for every lost reply, roughly 1 in 10", "Más o menos uno por cada respuesta perdida, cerca de 1 de cada 10"),
      t("About half of them", "Más o menos a la mitad"),
    ],
    answer: 1,
    why: t(
      "A lost reply looks exactly like a lost request from the customer's side: no answer. So the customer pays again, and the counter, which has no memory of the first slip, charges again. Every lost reply after a successful charge becomes a double charge. Nothing failed on the server; the duplicate was created by a correct retry.",
      "Desde el lado del cliente, una respuesta perdida se ve igual que una solicitud perdida: no hay respuesta. Así que el cliente paga de nuevo, y el mostrador, que no recuerda la primera boleta, vuelve a cobrar. Cada respuesta perdida después de un cobro exitoso se convierte en un cobro doble. Nada falló en el servidor; el duplicado lo creó un reintento correcto.",
    ),
    watch: { keys: "off", loss: 0.1, timeout: "patient", lifetime: "long", drift: 0 },
  },
  {
    id: "keys",
    title: t("Remember the result", "Recordar el resultado"),
    change: t("Every order carries a key · the counter files key → receipt after charging · a slip whose key is on file gets the stored receipt back · same 10% loss", "Cada pedido lleva una clave · el mostrador guarda clave → recibo después de cobrar · una boleta cuya clave ya está guardada recibe el recibo guardado · misma pérdida del 10%"),
    question: t("What happens to the retries now?", "¿Qué pasa ahora con los reintentos?"),
    options: [
      t("Still charged, just about half as often", "Se siguen cobrando, solo que más o menos la mitad de las veces"),
      t("Nobody is charged twice: each retry is answered with the stored receipt", "A nadie se le cobra dos veces: cada reintento se responde con el recibo guardado"),
      t("Nobody is charged twice, but the retried orders fail", "A nadie se le cobra dos veces, pero los pedidos reintentados fallan"),
    ],
    answer: 1,
    why: t(
      "The retry carries the same key, finds the receipt in the rack and gets the original answer back, with no second charge. From the customer's side it looks exactly like the first reply arriving late, which is the point: an idempotent operation can be repeated safely, so retries become harmless.",
      "El reintento lleva la misma clave, encuentra el recibo en el casillero y recibe la respuesta original, sin un segundo cobro. Desde el lado del cliente se ve igual que si la primera respuesta llegara tarde, y esa es la idea: una operación idempotente se puede repetir sin riesgo, así que los reintentos se vuelven inofensivos.",
    ),
    watch: { keys: "store", loss: 0.1, timeout: "patient", lifetime: "long", drift: 0 },
  },
  {
    id: "race",
    title: t("An impatient customer", "Un cliente impaciente"),
    change: t("Customers wait only 1 s before paying again · charging takes 1.2–2.4 s · no replies lost · the key is filed only once the charge is done", "Los clientes esperan solo 1 s antes de pagar de nuevo · cobrar tarda 1.2–2.4 s · no se pierde ninguna respuesta · la clave se guarda solo cuando termina el cobro"),
    question: t("Keys are on and no reply is ever lost. How many orders are charged twice?", "Las claves están activadas y nunca se pierde una respuesta. ¿A cuántos pedidos se les cobra dos veces?"),
    options: [
      t("None: the key stops every duplicate", "A ninguno: la clave frena cada duplicado"),
      t("A handful, when timing is unlucky", "A unos pocos, cuando los tiempos tienen mala suerte"),
      t("Most of them", "A la mayoría"),
    ],
    answer: 2,
    why: t(
      "The retry arrives while the first charge is still running, and the rack has nothing filed for that key yet, so the counter charges again. Checking a key and filing it later is a race. The fix is to claim the key before doing the work: an in-progress marker written atomically (a unique insert), so a second slip with the same key is told \"still in progress\" (409) and tries again later, when the receipt is on file.",
      "El reintento llega mientras el primer cobro todavía está en curso, y el casillero aún no tiene nada guardado para esa clave, así que el mostrador vuelve a cobrar. Verificar una clave y guardarla después es una condición de carrera. La solución es reservar la clave antes de hacer el trabajo: una marca de \"en curso\" escrita de forma atómica (un insert único), así a una segunda boleta con la misma clave se le responde \"todavía en curso\" (409) y lo vuelve a intentar más tarde, cuando el recibo ya está guardado.",
    ),
    watch: { keys: "store", loss: 0, timeout: "impatient", lifetime: "long", drift: 0 },
  },
  {
    id: "ttl",
    title: t("Keys that expire", "Claves que vencen"),
    change: t("Key lifetime 1 day → 8 s · 3 replies in 10 lost · retries back off 1, 2, 4 s, so a third try comes about 14 s after the first", "Duración de la clave 1 día → 8 s · se pierden 3 de cada 10 respuestas · los reintentos esperan 1, 2, 4 s (backoff), así que un tercer intento llega unos 14 s después del primero"),
    question: t("With the in-progress marker on, does a short key lifetime change anything?", "Con la marca de \"en curso\" activada, ¿cambia algo una duración corta de la clave?"),
    options: [
      t("No: any retry still finds its key", "No: cualquier reintento sigue encontrando su clave"),
      t("A few orders are charged twice again: their retry arrives after the key was thrown away", "A algunos pedidos se les vuelve a cobrar dos veces: su reintento llega después de que se descartó la clave"),
      t("The late retries are rejected with an error", "Los reintentos tardíos se rechazan con un error"),
    ],
    answer: 1,
    why: t(
      "Once a key is forgotten, a retry with that key is a brand-new request, so it is charged. A key must be kept for longer than the longest time a client may still retry the same operation (including retries after an app restart or a queue redelivery). Payment APIs keep keys for about 24 hours for this reason.",
      "Una vez que se olvida una clave, un reintento con esa clave es una solicitud completamente nueva, así que se cobra. Una clave tiene que guardarse más tiempo que el máximo durante el cual un cliente todavía podría reintentar la misma operación (incluidos los reintentos después de reiniciar una app o de una nueva entrega desde una cola). Por eso las APIs de pagos guardan las claves unas 24 horas.",
    ),
    watch: { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "short", drift: 0 },
  },
  {
    id: "drift",
    title: t("Same key, different amount", "Misma clave, otro monto"),
    change: t("A buggy client recalculates the total (+$5) on half of its retries but reuses the order's key · 3 replies in 10 lost · keys on", "Un cliente con un bug recalcula el total (+$5) en la mitad de sus reintentos pero reutiliza la clave del pedido · se pierden 3 de cada 10 respuestas · claves activadas"),
    question: t("What should the counter do with a retry whose key is on file but whose amount differs?", "¿Qué debería hacer el mostrador con un reintento cuya clave está guardada pero cuyo monto es distinto?"),
    options: [
      t("Charge the new amount: it's what the customer asked for now", "Cobrar el monto nuevo: es lo que el cliente pide ahora"),
      t("Return the stored receipt as if nothing changed", "Devolver el recibo guardado como si nada hubiera cambiado"),
      t("Refuse it (422) and charge nothing", "Rechazarlo (422) y no cobrar nada"),
    ],
    answer: 2,
    why: t(
      "A key names one specific operation. If the request behind it changed, either the client has a bug or two different operations share a key; replaying the old receipt would tell the client the new amount was charged when it wasn't, and charging would double-charge. So the server keeps a fingerprint of the original request and rejects a mismatch loudly (422), which surfaces the client bug.",
      "Una clave nombra una operación específica. Si la solicitud detrás de ella cambió, o el cliente tiene un bug o dos operaciones distintas comparten una clave; devolver el recibo viejo le diría al cliente que se cobró el monto nuevo cuando no fue así, y cobrar sería un cobro doble. Por eso el servidor guarda una huella (fingerprint) de la solicitud original y rechaza a la vista cualquier diferencia (422), lo que saca a la luz el bug del cliente.",
    ),
    watch: { keys: "lock", loss: 0.3, timeout: "patient", lifetime: "long", drift: 0.5 },
  },
];

const QUESTIONS = [
  [t("The payment service charged the card once for every request it received, yet a customer was charged twice. How?", "El servicio de pagos cobró la tarjeta una vez por cada solicitud que recibió, pero a un cliente se le cobró dos veces. ¿Cómo?"),
    t("The first charge succeeded but its reply was lost (or arrived after the client's timeout). The client can't tell that apart from a failed request, so it retried, and the server, with no memory of the first request, treated the retry as a new payment. Retries are correct behaviour; the server must make them safe.", "El primer cobro tuvo éxito pero su respuesta se perdió (o llegó después del tiempo de espera del cliente). El cliente no puede distinguir eso de una solicitud fallida, así que reintentó, y el servidor, sin memoria de la primera solicitud, trató el reintento como un pago nuevo. Reintentar es el comportamiento correcto; el servidor tiene que hacerlo seguro.")],
  [t("What should the server store for each idempotency key, and why the whole response rather than just \"seen\"?", "¿Qué debería guardar el servidor para cada clave de idempotencia (idempotency key), y por qué la respuesta completa en lugar de solo \"visto\"?"),
    t("The response it sent (status and body) plus a fingerprint of the request. A retry must get the same answer the first request got, including the charge ID or the error, so the client can carry on as if the first reply had arrived. \"Seen\" alone would leave the server unable to answer the retry.", "La respuesta que envió (estado y cuerpo) más una huella de la solicitud. Un reintento tiene que recibir la misma respuesta que recibió la primera solicitud, incluido el ID del cobro o el error, para que el cliente pueda seguir como si hubiera llegado la primera respuesta. Con solo \"visto\", el servidor no podría responder el reintento.")],
  [t("Why is \"look up the key, charge, then save the key\" not enough?", "¿Por qué no alcanza con \"buscar la clave, cobrar y después guardar la clave\"?"),
    t("Two requests with the same key can arrive close together; both look up, both find nothing, both charge. The key must be claimed before the work starts, atomically: insert an in-progress row with a unique constraint, and answer a concurrent duplicate with 409 (or make it wait) until the first finishes and its response is stored.", "Dos solicitudes con la misma clave pueden llegar casi juntas; las dos buscan, las dos no encuentran nada, las dos cobran. La clave tiene que reservarse antes de empezar el trabajo, de forma atómica: inserta una fila \"en curso\" con una restricción de unicidad y responde a un duplicado concurrente con 409 (o hazlo esperar) hasta que la primera termine y su respuesta quede guardada.")],
  [t("How long should keys be kept?", "¿Cuánto tiempo hay que guardar las claves?"),
    t("Longer than any client could still retry the same operation: across backoff schedules, app restarts, queued retries and message redeliveries. A day is common for payment APIs. Too short and late retries become duplicates; forever is unnecessary storage.", "Más tiempo que el que cualquier cliente todavía podría reintentar la misma operación: contando las esperas entre reintentos (backoff), los reinicios de la app, los reintentos encolados y las nuevas entregas de mensajes. Un día es común en las APIs de pagos. Si es muy corto, los reintentos tardíos se vuelven duplicados; para siempre es almacenamiento innecesario.")],
  [t("Who generates the key, and how should keys be scoped?", "¿Quién genera la clave, y cuál debería ser el alcance de las claves?"),
    t("The client generates one key per logical operation (for example a UUID created when the user presses Pay) and reuses it for every retry of that operation, never for a different one. The server scopes keys per account or API client, so two clients that pick the same key can't see each other's results.", "El cliente genera una clave por operación lógica (por ejemplo, un UUID creado cuando el usuario presiona Pagar) y la reutiliza en cada reintento de esa operación, nunca en otra distinta. El servidor limita las claves por cuenta o por cliente de la API, así dos clientes que eligen la misma clave no pueden ver los resultados del otro.")],
  [t("Which operations need idempotency keys, and where else does the same idea show up?", "¿Qué operaciones necesitan claves de idempotencia, y dónde más aparece la misma idea?"),
    t("Anything that isn't naturally idempotent: creating payments, orders, emails, transfers. PUT and DELETE that set a final state usually are idempotent already. The same idea appears in message consumers (dedupe by message ID under at-least-once delivery), webhooks, and the outbox pattern's relay.", "Todo lo que no es idempotente por naturaleza: crear pagos, pedidos, emails, transferencias. Los PUT y DELETE que fijan un estado final normalmente ya son idempotentes. La misma idea aparece en los consumidores de mensajes (deduplicar por ID de mensaje con entrega al menos una vez, at-least-once), en los webhooks y en el relé del patrón outbox.")],
];

export default defineLesson({
  title: t("Idempotency Workbench", "Banco de trabajo: idempotencia"),
  eyebrow: t("Systems lesson 25 · Idempotency keys", "Lección de sistemas 25 · Claves de idempotencia"),
  lede: t("When a reply goes missing, the client can't tell whether its request worked, so it sends it again. An idempotency key lets the server recognise the retry and answer it with the result it already produced, instead of doing the work twice. This lesson builds that on a payment counter: watch it, predict what breaks it, then explain it back.",
    "Cuando una respuesta se pierde, el cliente no puede saber si su solicitud funcionó, así que la envía de nuevo. Una clave de idempotencia (idempotency key) le permite al servidor reconocer el reintento y responderlo con el resultado que ya produjo, en lugar de hacer el trabajo dos veces. Esta lección lo construye sobre un mostrador de pagos: míralo, predice qué lo rompe y después explícalo."),
  machine: {
    intro: t("Four customers pay at a counter over lanes that sometimes lose the reply. Watch the till: card charges should match orders paid. With keys on, retries are answered from the rack of stored receipts; switch keys off, make the customers impatient or let keys expire, and watch charges run ahead of orders.",
      "Cuatro clientes pagan en un mostrador por carriles que a veces pierden la respuesta. Mira la caja: los cobros a tarjeta deberían coincidir con los pedidos pagados. Con las claves activadas, los reintentos se responden desde el casillero de recibos guardados; apaga las claves, vuelve impacientes a los clientes o deja que las claves venzan, y mira cómo los cobros se adelantan a los pedidos."),
    plate: {
      title: t("Payment counter", "Mostrador de pagos"),
      keys: [
        { mark: "lit", label: t("A receipt answered from the rack; a customer paying again; a card charged twice", "Un recibo respondido desde el casillero; un cliente que paga de nuevo; una tarjeta cobrada dos veces") },
        { mark: "raised", label: t("Slips going up, replies coming back, the stored receipts", "Boletas que suben, respuestas que vuelven, los recibos guardados") },
        { mark: "flat", label: t("Lanes, and the trough where lost replies fall", "Carriles, y la canaleta donde caen las respuestas perdidas") },
      ],
      caption: t(
        "Each customer holds a slip with their order's key (A7 is customer A's 7th order) and how many times they've tried. Slips go up the left side of a lane to a card terminal; replies come back down the right side, and some fall into the trough. Behind the counter, the key rack holds one stored receipt per key, or a flag while that key's charge is still running. A lit receipt in the rack means a retry was answered from it. The till counts orders paid against card charges: when charges run ahead, someone paid twice.",
        "Cada cliente tiene una boleta con la clave de su pedido (A7 es el 7.º pedido del cliente A) y cuántas veces lo intentó. Las boletas suben por el lado izquierdo de un carril hasta una terminal de tarjetas; las respuestas bajan por el lado derecho, y algunas caen en la canaleta. Detrás del mostrador, el casillero de claves guarda un recibo por clave, o una bandera mientras el cobro de esa clave sigue en curso. Un recibo iluminado en el casillero significa que un reintento se respondió con él. La caja compara los pedidos pagados con los cobros a tarjeta: cuando los cobros se adelantan, alguien pagó dos veces.",
      ),
      stage: { "data-counter": "" },
      label: t("Idempotency key simulation. Space pauses or resumes.", "Simulación de clave de idempotencia. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["orders", t("Orders paid", "Pedidos pagados")], ["charges", t("Card charges", "Cobros a tarjeta")], ["twice", t("Charged twice", "Cobrados dos veces")], ["replays", t("Answered from rack", "Desde el casillero")], ["c409", t("Still in progress (409)", "Todavía en curso (409)")], ["r422", t("Rejected (422)", "Rechazados (422)")], ["lost", t("Replies lost", "Respuestas perdidas")]],
    controls: [
      { seg: "keys", label: t("Idempotency keys", "Claves de idempotencia"), options: [["off", t("Off", "Apagadas")], ["store", t("File after charging", "Guardar después de cobrar")], ["lock", t("Claim first (in-progress flag)", "Reservar primero (bandera en curso)")]], value: "lock" },
      { seg: "loss", label: t("Replies lost", "Respuestas perdidas"), options: [[0, t("None", "Ninguna")], [0.1, t("1 in 10", "1 de 10")], [0.3, t("3 in 10", "3 de 10")]], value: 0.3 },
      { seg: "timeout", label: t("Customer waits", "El cliente espera"), options: [["patient", "5 s"], ["impatient", "1 s"]], value: "patient" },
      { seg: "lifetime", label: t("Key kept for", "Clave guardada por"), options: [["long", t("1 day", "1 día")], ["short", "8 s"]], value: "long" },
      { seg: "drift", label: t("Amount on retry", "Monto al reintentar"), options: [[0, t("Same", "Igual")], [0.5, t("Sometimes +$5", "A veces +$5")]], value: 0 },
      { speed: true },
      { actions: [["double", t("Double-click Pay", "Doble clic en Pagar")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      'Changing any setting starts the run again. "Double-click Pay" makes customer A send the same slip twice at once.',
      'Cambiar cualquier ajuste vuelve a empezar la corrida. "Doble clic en Pagar" hace que el cliente A envíe la misma boleta dos veces a la vez.',
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded three-minute runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de correrlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho corridas con semilla de tres minutos."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css: `
.iso-stage .iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}
body.lit-fill [data-slip]:has(> [data-slip-lit]:not([style*="none"])) :is([data-slip-top],[data-slip-note]){fill:var(--anatomy-page)}
body.lit-fill [data-hole]:has(> [data-card-lit]:not([style*="none"])) [data-hole-key]{fill:var(--anatomy-page)}
`,
  data: {
    P,
    G: GEOMETRY,
    TOKENS: tokenSvgs(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
