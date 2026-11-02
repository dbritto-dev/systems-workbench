// @ts-nocheck: content ported as-is
// Systems lesson 26 · Sagas: a travel agency that undoes earlier bookings when a later step fails.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, folderSvg, puckSvg, P, GEOMETRY, HOOKS } from "./figure";
import { experimentResults } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran them on click).
const RESULTS = experimentResults();

const EXPERIMENTS = [
  {
    id: "nosaga",
    title: t("A card is declined after everything is booked", "Rechazan una tarjeta cuando todo ya está reservado"),
    change: t("No saga · each counter is called in turn and nothing is undone · 20% of cards are declined · 3 minutes of customers", "Sin saga · se llama a cada mostrador por turno y nada se deshace · se rechaza el 20% de las tarjetas · 3 minutos de clientes"),
    question: t("The flight, hotel and car are booked, then the card is declined. What happens to those three bookings?", "El vuelo, el hotel y el auto están reservados, y luego rechazan la tarjeta. ¿Qué pasa con esas tres reservas?"),
    options: [t("They are cancelled automatically, because the trip failed", "Se cancelan automáticamente, porque el viaje falló"), t("They stay booked for a trip that will never happen, and the boards fill up", "Siguen reservadas para un viaje que nunca va a ocurrir, y los tableros se llenan"), t("The customer is charged anyway, so nothing is lost", "Al cliente se le cobra igual, así que no se pierde nada")],
    answer: 1,
    why: t("Each counter committed its own booking in its own database. Nothing ties them together, so when payment fails nobody tells the flight, hotel and car counters. Their tags stay on the boards, holding stock no one will use, and later customers are turned away for it. A saga gives every step an undo and runs those undos, newest first, when a later step fails.", "Cada mostrador confirmó su propia reserva en su propia base de datos. Nada las une, así que cuando falla el pago nadie avisa a los mostradores de vuelo, hotel y auto. Sus etiquetas quedan en los tableros, ocupando lugares que nadie va a usar, y por eso más tarde otros clientes se quedan sin lugar. Una saga le da a cada paso un deshacer (una compensación) y, cuando falla un paso posterior, ejecuta esos deshacer del más reciente al más antiguo."),
    watch: { style: "none", decline: "0.2", lost: "0", order: "standard", slots: "8", rate: "0.3" },
  },
  {
    id: "lost",
    title: t("Undo calls that time out", "Llamadas de deshacer que dan timeout"),
    change: t("Saga · a quarter of undo calls time out, and half of those actually ran before the reply was lost · 40% of cards declined", "Saga · un cuarto de las llamadas de deshacer dan timeout, y la mitad de esas sí se ejecutó antes de que se perdiera la respuesta · se rechaza el 40% de las tarjetas"),
    question: t("Compare three policies for a timed-out undo: give up, retry, or retry with the same idempotency key. What does each leave behind?", "Compara tres políticas para un deshacer con timeout: rendirse, reintentar o reintentar con la misma clave de idempotencia. ¿Qué deja cada una?"),
    options: [t("Retrying fixes it either way: running an undo twice is harmless", "Reintentar lo arregla de cualquier forma: deshacer dos veces no hace daño"), t("Giving up strands trips half-done; plain retries sometimes undo twice; retries with a key end clean", "Rendirse deja viajes a medias; reintentar sin más a veces deshace dos veces; reintentar con clave termina limpio"), t("Giving up is safest, because a timed-out undo probably worked", "Rendirse es lo más seguro, porque un deshacer con timeout probablemente funcionó")],
    answer: 1,
    why: t("A timeout tells you nothing: the undo may or may not have happened. Giving up leaves the trip stuck with bookings nobody will release. Retrying is the only way forward, but a retry of an undo that already ran releases someone else's room or refunds twice. The idempotency key lets the counter recognise the repeat and do nothing, so the saga can retry until it gets a definite answer.", "Un timeout no te dice nada: el deshacer pudo haberse hecho o no. Rendirse deja el viaje atascado con reservas que nadie va a liberar. Reintentar es la única forma de avanzar, pero reintentar un deshacer que ya se ejecutó libera la habitación de otra persona o reembolsa dos veces. La clave de idempotencia le permite al mostrador reconocer la repetición y no hacer nada, así que la saga puede reintentar hasta obtener una respuesta definitiva."),
    watch: { style: "orch", decline: "0.4", lost: "0.25", undo: "retry", order: "standard", slots: "8", rate: "0.3" },
  },
  {
    id: "email",
    title: t("Send the confirmation first", "Envía la confirmación primero"),
    change: t("Order: email → flight → hotel → car → payment, instead of email last · 20% of cards declined", "Orden: correo → vuelo → hotel → auto → pago, en vez de correo al final · se rechaza el 20% de las tarjetas"),
    question: t("Of the trips that fail after the email went out, how many customers received a confirmation?", "De los viajes que fallan después de enviar el correo, ¿cuántos clientes recibieron una confirmación?"),
    options: [t("None: the saga recalls the email", "Ninguno: la saga recupera el correo"), t("Every one of them: an email can't be undone", "Todos: un correo no se puede deshacer"), t("About half of them", "Más o menos la mitad")],
    answer: 1,
    why: t("Some steps have no undo: an email, a text message, a shipped parcel. The best the saga can do is send a second \"sorry, cancelled\" message. So steps that can't be compensated go after the last step that can fail (the pivot), where nothing can roll them back anymore.", "Algunos pasos no tienen deshacer: un correo, un mensaje de texto, un paquete enviado. Lo mejor que puede hacer la saga es mandar un segundo mensaje de \"perdón, cancelado\". Por eso los pasos que no se pueden compensar van después del último paso que puede fallar (el pivote, pivot), donde ya nada puede revertirlos."),
    watch: { style: "orch", decline: "0.2", lost: "0", order: "mailFirst", slots: "8", rate: "0.3" },
  },
  {
    id: "isolation",
    title: t("Few seats, busy day", "Pocos lugares, día ocupado"),
    change: t("5 seats on each board · a customer every 2.5 s · 40% of cards declined · payment checked last", "5 lugares en cada tablero · un cliente cada 2.5 s · se rechaza el 40% de las tarjetas · el pago se revisa al final"),
    question: t("Customers are turned away because the flight is full. How many of them were blocked by a seat held by a trip that was later undone?", "Hay clientes que se quedan sin lugar porque el vuelo está lleno. ¿Cuántos de ellos quedaron bloqueados por un lugar retenido por un viaje que después se deshizo?"),
    options: [t("None: a held seat is a real booking", "Ninguno: un lugar retenido es una reserva real"), t("A few, by bad luck", "Unos pocos, por mala suerte"), t("Most of them", "La mayoría")],
    answer: 2,
    why: t("A saga has no isolation: every step's booking is visible to everyone the moment it commits, even though the trip may still be undone. Doomed trips hold seats for several seconds, and full boards turn real customers away. Checking the step most likely to fail first (here, the card) means doomed trips never hold anything. Other fixes: pending holds that expire, or a semantic lock other trips can see.", "Una saga no tiene aislamiento: la reserva de cada paso es visible para todos en cuanto se confirma, aunque el viaje todavía se pueda deshacer. Los viajes condenados retienen lugares durante varios segundos, y los tableros llenos dejan sin lugar a clientes reales. Revisar primero el paso con más probabilidad de fallar (aquí, la tarjeta) hace que los viajes condenados nunca retengan nada. Otras soluciones: retenciones pendientes que vencen, o un bloqueo semántico (semantic lock) que los otros viajes puedan ver."),
    watch: { style: "orch", decline: "0.4", lost: "0", order: "standard", slots: "5", rate: "0.4" },
  },
  {
    id: "choreo",
    title: t("Drop the orchestrator", "Quita el orquestador"),
    change: t("Choreography: each counter hands the folder to the next directly, and back on failure · no desk, no checklist", "Coreografía: cada mostrador le pasa la carpeta directamente al siguiente, y de vuelta si algo falla · sin escritorio, sin lista de control"),
    question: t("What changes?", "¿Qué cambia?"),
    options: [t("Nothing: it only looks different", "Nada: solo se ve distinto"), t("Trips finish faster, but to find where a trip is you ask counter after counter", "Los viajes terminan más rápido, pero para saber dónde está un viaje preguntas mostrador por mostrador"), t("Trips get slower and harder to find", "Los viajes se vuelven más lentos y más difíciles de encontrar")],
    answer: 1,
    why: t("Without the round trip to the desk, every step is quicker. But no one holds the whole picture: to answer \"where is my trip?\" you ask each counter in turn, and a folder in transit between counters shows up nowhere. Orchestration costs a hop per step and a central component; choreography spreads the saga's logic across services and makes it harder to follow and to change.", "Sin el viaje de ida y vuelta al escritorio, cada paso es más rápido. Pero nadie tiene el panorama completo: para responder \"¿dónde está mi viaje?\" preguntas a cada mostrador por turno, y una carpeta en tránsito entre mostradores no aparece en ninguno. La orquestación cuesta un salto por paso y un componente central; la coreografía reparte la lógica de la saga entre servicios y la hace más difícil de seguir y de cambiar."),
    watch: { style: "choreo", decline: "0.2", lost: "0", order: "standard", slots: "8", rate: "0.3" },
  },
];

const QUESTIONS = [
  [t("Why can't you wrap \"book flight, book hotel, charge card\" in one database transaction?", "¿Por qué no puedes envolver \"reservar vuelo, reservar hotel, cobrar la tarjeta\" en una sola transacción de base de datos?"),
    t("Each service owns its own database, and often a third party owns it (an airline, a payment provider). There is no shared transaction across them, and holding locks across slow remote calls (two-phase commit) would block everyone and fail when any participant is down. A saga accepts that each step commits on its own and plans the way back instead.", "Cada servicio es dueño de su propia base de datos, y a menudo es de un tercero (una aerolínea, un proveedor de pagos). No hay una transacción compartida entre ellos, y mantener bloqueos durante llamadas remotas lentas (commit en dos fases, two-phase commit) bloquearía a todos y fallaría cuando cualquier participante esté caído. Una saga acepta que cada paso se confirme por su cuenta y, en cambio, planea el camino de regreso.")],
  [t("What makes a good compensation?", "¿Qué hace buena a una compensación?"),
    t("It undoes the business effect, not the history: a refund, a cancellation, a release. It is idempotent (safe to run twice, usually through an idempotency key), it can be retried until it gives a definite answer, and it should not be able to fail for business reasons. If it can, the saga needs a human or a parking place for stuck trips.", "Deshace el efecto de negocio, no la historia: un reembolso, una cancelación, una liberación. Es idempotente (segura de ejecutar dos veces, normalmente con una clave de idempotencia), se puede reintentar hasta que da una respuesta definitiva y no debería poder fallar por razones de negocio. Si puede, la saga necesita a una persona o un lugar donde estacionar los viajes atascados.")],
  [t("Where do you put a step that can't be undone, and a step that is likely to fail?", "¿Dónde pones un paso que no se puede deshacer, y uno que probablemente falle?"),
    t("Likely-to-fail steps go early, so failures happen before much has to be undone. Steps that can't be compensated (emails, shipping) go after the pivot, the last step that can fail, so they only run for trips that will definitely complete.", "Los pasos que probablemente fallen van temprano, para que las fallas ocurran antes de que haya mucho que deshacer. Los pasos que no se pueden compensar (correos, envíos) van después del pivote (pivot), el último paso que puede fallar, para que solo se ejecuten en viajes que seguro se van a completar.")],
  [t("A saga has no isolation. Describe an anomaly and a way to soften it.", "Una saga no tiene aislamiento. Describe una anomalía y una forma de suavizarla."),
    t("Other requests see intermediate state: a seat held by a trip that will be undone turns a real customer away, or a refund reads a balance mid-saga. Mitigations: order steps so doomed trips fail early, use pending states that others can see and skip (a semantic lock), reservations that expire, and updates that commute so order doesn't matter.", "Otras solicitudes ven estados intermedios: un lugar retenido por un viaje que se va a deshacer deja sin lugar a un cliente real, o un reembolso lee un saldo a mitad de la saga. Mitigaciones: ordenar los pasos para que los viajes condenados fallen temprano, usar estados pendientes que otros puedan ver y saltar (un bloqueo semántico, semantic lock), reservas que vencen y actualizaciones conmutativas para que el orden no importe.")],
  [t("When would you choose orchestration, and when choreography?", "¿Cuándo elegirías orquestación y cuándo coreografía?"),
    t("Orchestration when the flow has many steps or branches, when you need to see and change it in one place, and when support must answer \"where is this order?\". Choreography when there are few steps and teams want services to react to events without a central coordinator, accepting that the flow is spread across services and harder to trace.", "Orquestación cuando el flujo tiene muchos pasos o ramas, cuando necesitas verlo y cambiarlo en un solo lugar y cuando soporte tiene que responder \"¿dónde está este pedido?\". Coreografía cuando hay pocos pasos y los equipos quieren que los servicios reaccionen a eventos sin un coordinador central, aceptando que el flujo queda repartido entre servicios y es más difícil de rastrear.")],
  [t("An undo call to the hotel times out. What do you know, and what do you do?", "Una llamada de deshacer al hotel da timeout. ¿Qué sabes y qué haces?"),
    t("Nothing: the cancel may have run and only the reply was lost. Retry with the same idempotency key until the hotel gives a definite answer; never assume either way. If retries run out, park the saga as stuck and alert someone, because its bookings are still holding stock.", "Nada: la cancelación pudo haberse ejecutado y solo se perdió la respuesta. Reintenta con la misma clave de idempotencia hasta que el hotel dé una respuesta definitiva; nunca asumas nada. Si se acaban los reintentos, estaciona la saga como atascada y avísale a alguien, porque sus reservas siguen ocupando lugares.")],
];

export default defineLesson({
  title: t("Saga Workbench", "Banco de trabajo: sagas"),
  eyebrow: t("Systems lesson 26 · Sagas", "Lección de sistemas 26 · Sagas"),
  lede: t("Booking a trip touches several services that share no transaction: the flight, the hotel, the car, the card. A saga runs each step on its own and, when a later one fails, runs the undo of every earlier step. This lesson builds one: watch a machine do it, predict what breaks it, then explain it back.", "Reservar un viaje toca varios servicios que no comparten ninguna transacción: el vuelo, el hotel, el auto, la tarjeta. Una saga ejecuta cada paso por separado y, cuando uno posterior falla, ejecuta el deshacer de cada paso anterior. Esta lección construye una: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Folders ride past five counters. Each counter books its part and hangs a tag; when the card is declined or a board is full, the folder rides back on the lower track and the tags come down. Try <em>Decline the next card</em>, then switch to <em>No undo</em> and watch tags pile up for trips that never happen.", "Las carpetas pasan frente a cinco mostradores. Cada mostrador reserva su parte y cuelga una etiqueta; cuando se rechaza la tarjeta o un tablero está lleno, la carpeta regresa por la vía de abajo y las etiquetas se descuelgan. Prueba <em>Rechazar la próxima tarjeta</em>, luego cambia a <em>Sin deshacer</em> y mira cómo se acumulan etiquetas de viajes que nunca ocurren."),
    plate: {
      title: t("Travel agency", "Agencia de viajes"),
      keys: [
        { mark: "lit", label: t("A folder riding back to undo its steps, or left stuck; tags held for a stuck trip (crossed out)", "Una carpeta que regresa para deshacer sus pasos, o que quedó atascada; etiquetas retenidas por un viaje atascado (tachadas)") },
        { mark: "raised", label: t("Counters with tag boards, the postbox, the orchestrator desk and the scoreboard", "Mostradores con tableros de etiquetas, el buzón, el escritorio del orquestador y el marcador") },
        { mark: "flat", label: t("Forward track, return track and the stuck ledge", "Vía de ida, vía de regreso y la repisa de atascados") },
      ],
      caption:
        t("A folder enters at the door and rides the forward track. Each counter books its part, hangs a tag on its board and stamps the folder; the postbox sends the confirmation, which can't be taken back. If a step fails, the folder drops to the return track and every counter it already visited takes its tag down. Without a saga the return track is closed and the folder is left on the ledge with its tags still hanging. The orchestrator desk sends a courier along the dashed lines for each step and keeps one checklist row per trip; with choreography it is covered.", "Una carpeta entra por la puerta y avanza por la vía de ida. Cada mostrador reserva su parte, cuelga una etiqueta en su tablero y sella la carpeta; el buzón envía la confirmación, que ya no se puede recuperar. Si un paso falla, la carpeta baja a la vía de regreso y cada mostrador que ya visitó descuelga su etiqueta. Sin saga, la vía de regreso está cerrada y la carpeta queda en la repisa con sus etiquetas todavía colgadas. El escritorio del orquestador manda un mensajero por las líneas punteadas en cada paso y lleva una fila de la lista de control por viaje; con coreografía queda tapado."),
      stage: { "data-agency": "" },
      label: t("Saga simulation. Space pauses or resumes.", "Simulación de una saga. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["done", t("Trips booked", "Viajes reservados")], ["undone", t("Undone cleanly", "Deshechos limpios")], ["stuck", t("Left half-done", "Quedaron a medias")], ["turned", t("Turned away", "Sin lugar")], ["wrongMail", t("Wrong emails", "Correos erróneos")], ["doubles", t("Undone twice", "Deshechos dos veces")]],
    controls: [
      { seg: "style", label: t("Coordination", "Coordinación"), options: [["orch", t("Orchestrator", "Orquestador")], ["choreo", t("Choreography", "Coreografía")], ["none", t("No undo", "Sin deshacer")]], value: "orch" },
      { seg: "order", label: t("Order", "Orden"), options: [["standard", t("Email last", "Correo al final")], ["mailFirst", t("Email first", "Correo primero")], ["payFirst", t("Card first", "Tarjeta primero")]], value: "standard" },
      { seg: "undo", label: t("Timed-out undo", "Deshacer con timeout"), options: [["none", t("Give up", "Rendirse")], ["retry", t("Retry", "Reintentar")], ["idem", t("Retry with key", "Reintentar con clave")]], value: "idem" },
      { seg: "decline", label: t("Cards declined", "Tarjetas rechazadas"), options: [["0", "0%"], ["0.2", "20%"], ["0.4", "40%"]], value: "0.2" },
      { seg: "lost", label: t("Undo timeouts", "Timeouts al deshacer"), options: [["0", t("None", "Ninguno")], ["0.25", "25%"]], value: "0" },
      { seg: "slots", label: t("Seats per board", "Lugares por tablero"), options: [["5", "5"], ["8", "8"]], value: "8" },
      { seg: "rate", label: t("Customers", "Clientes"), options: [["0.2", t("1 per 5 s", "1 cada 5 s")], ["0.3", t("1 per 3 s", "1 cada 3 s")], ["0.4", t("1 per 2.5 s", "1 cada 2.5 s")]], value: "0.3" },
      { speed: true },
      { actions: [["decline", t("Decline the next card", "Rechazar la próxima tarjeta")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine: three minutes of customers, averaged over eight seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina: tres minutos de clientes, promediados sobre ocho ejecuciones con semilla fija."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  css: `
.stamp{fill:none;stroke:var(--anatomy-lo);stroke-width:.6}
.stamp[data-on]{fill:var(--anatomy-strong);stroke:var(--anatomy-strong)}
.xmark{fill:none;stroke:var(--anatomy-strong);stroke-width:1.1;stroke-linecap:round}
body.lit-fill .wb-lit-group:has(.iso-solid[data-lit]:not([data-lit-outline])) .stamp{stroke:color-mix(in srgb,var(--anatomy-page) 55%,var(--anatomy-lit))}
body.lit-fill .wb-lit-group:has(.iso-solid[data-lit]:not([data-lit-outline])) .stamp[data-on]{fill:var(--anatomy-page);stroke:var(--anatomy-page)}
.cell{fill:none;stroke:var(--anatomy-lo);stroke-width:.6}
.cell[data-on]{fill:var(--anatomy-strong);stroke:var(--anatomy-strong)}
.cell[data-undo]{fill:none;stroke:var(--anatomy-lit);stroke-width:1.4}
.cell[data-undo][data-on]{fill:var(--anatomy-lit)}
[data-hook][data-off]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
    HOOKS,
    FOLDER_SVG: folderSvg(),
    PUCK_SVG: puckSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
