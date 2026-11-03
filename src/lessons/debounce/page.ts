// @ts-nocheck: content ported as-is
// Systems lesson 31 · Debounce: an elevator that leaves only when nobody new has arrived.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one, msFromSecs } from "../../lib/format";
import { buildFigure, pawnSvg, ticketSvg, dotSvg, pegSvg, postSvg, P, GEOMETRY } from "./figure";
import { averaged } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the original page computed them in
// the browser; the model is seeded, so the numbers are the same).
const RESULTS = {
  search: { off: averaged({ mode: "none", latency: "steady" }), on: averaged({ mode: "trailing", wait: 0.3, latency: "steady" }) },
  wait: [0.1, 0.3, 1].map((w) => averaged({ mode: "trailing", wait: w, latency: "steady" })),
  hold: { plain: averaged({ mode: "trailing", wait: 0.3, input: "hold", latency: "steady" }), capped: averaged({ mode: "trailing", wait: 0.3, maxWait: 1, input: "hold", latency: "steady" }) },
  clicks: ["none", "trailing", "leading"].map((m) => averaged({ mode: m, wait: 0.3, input: "clicks", latency: "steady" })),
  order: { off: averaged({ mode: "none", latency: "variable" }), deb: averaged({ mode: "trailing", wait: 0.3, latency: "variable" }), can: averaged({ mode: "trailing", wait: 0.3, latency: "variable", cancel: true }) },
};

// What each card shows after a run.
const sec = (x) => (x >= 1 ? one(x) + " s" : msFromSecs(x));
const RUNS = {
  search: () => {
    const { off, on } = RESULTS.search;
    return { verdict: t("A search is " + one(off.keysPerSession) + " keys on average. Without debounce it sent " + one(off.perSession) + " requests; with a 300 ms debounce, " + one(on.perSession) + ".",
        "Una búsqueda tiene " + one(off.keysPerSession) + " teclas en promedio. Sin debounce enviaba " + one(off.perSession) + " solicitudes; con un debounce de 300 ms, " + one(on.perSession) + "."),
      bars: [[t("Keys per search", "Teclas por búsqueda"), 1, one(off.keysPerSession)], [t("Requests, no debounce", "Solicitudes, sin debounce"), off.perSession / off.keysPerSession, one(off.perSession)], [t("Requests, 300 ms debounce", "Solicitudes, debounce de 300 ms"), on.perSession / off.keysPerSession, one(on.perSession), true]] };
  },
  wait: () => {
    const r = RESULTS.wait;
    const k = r[0].keysPerSession, lagTop = Math.max(...r.map((x) => x.lag));
    const reqs = r.map((x) => one(x.perSession)).join(" → "), lags = r.map((x) => msFromSecs(x.lag)).join(" → ");
    return { verdict: t("Requests per search: " + reqs + " (of " + one(k) + " keys). Last key to results: " + lags + ".",
        "Solicitudes por búsqueda: " + reqs + " (de " + one(k) + " teclas). De la última tecla a los resultados: " + lags + "."),
      bars: [[t("Requests, 100 ms", "Solicitudes, 100 ms"), r[0].perSession / k, one(r[0].perSession)], [t("Requests, 300 ms", "Solicitudes, 300 ms"), r[1].perSession / k, one(r[1].perSession)], [t("Requests, 1 s", "Solicitudes, 1 s"), r[2].perSession / k, one(r[2].perSession), true],
        [t("Wait for results, 100 ms", "Espera de resultados, 100 ms"), r[0].lag / lagTop, msFromSecs(r[0].lag)], [t("Wait for results, 1 s", "Espera de resultados, 1 s"), r[2].lag / lagTop, msFromSecs(r[2].lag), true]] };
  },
  hold: () => {
    const { plain, capped } = RESULTS.hold;
    return { verdict: t("Debounce 300 ms: the first request left " + sec(plain.firstSend) + " after the stream began, " + one(plain.sentDuring) + " during it. With maxWait 1 s: first after " + sec(capped.firstSend) + ", " + one(capped.sentDuring) + " during the 5 s.",
        "Debounce de 300 ms: la primera solicitud salió " + sec(plain.firstSend) + " después de que empezó el flujo, " + one(plain.sentDuring) + " durante él. Con maxWait de 1 s: la primera a los " + sec(capped.firstSend) + ", " + one(capped.sentDuring) + " durante los 5 s."),
      bars: [[t("First request, 300 ms", "Primera solicitud, 300 ms"), Math.min(1, plain.firstSend / 6), sec(plain.firstSend), true], [t("First request, maxWait 1 s", "Primera solicitud, maxWait 1 s"), Math.min(1, capped.firstSend / 6), sec(capped.firstSend)]] };
  },
  clicks: () => {
    const r = RESULTS.clicks;
    const names = ["No debounce", "Trailing 300 ms", "Leading 300 ms"], nombres = ["Sin debounce", "Al final 300 ms", "Al inicio 300 ms"];
    return { verdict: t(r.map((x, i) => names[i] + ": " + one(x.perSession) + " orders, first after " + msFromSecs(x.firstSend)).join(" · ") + ".",
        r.map((x, i) => nombres[i] + ": " + one(x.perSession) + " pedidos, el primero a los " + msFromSecs(x.firstSend)).join(" · ") + "."),
      bars: r.flatMap((x, i) => [[t(names[i] + ", orders", nombres[i] + ", pedidos"), x.perSession / 2, one(x.perSession), i === 2], [t(names[i] + ", delay", nombres[i] + ", demora"), Math.min(1, x.firstSend / 0.6), msFromSecs(x.firstSend), i === 2]]) };
  },
  order: () => {
    const { off, deb, can } = RESULTS.order;
    const per = (x) => Math.round(x.staleShare * 100), top = Math.max(1, per(off));
    return { verdict: t("Times an older answer replaced a newer one, per 100 searches: " + per(off) + " without debounce, " + per(deb) + " with a 300 ms debounce, " + per(can) + " when each new request cancels the older one.",
        "Veces que una respuesta anterior reemplazó a una más reciente, por cada 100 búsquedas: " + per(off) + " sin debounce, " + per(deb) + " con un debounce de 300 ms, " + per(can) + " cuando cada solicitud nueva cancela la anterior."),
      bars: [[t("No debounce", "Sin debounce"), per(off) / top, String(per(off))], [t("Debounce 300 ms", "Debounce de 300 ms"), per(deb) / top, String(per(deb)), true], [t("Debounce + cancel", "Debounce + cancelar"), per(can) / top, String(per(can))]] };
  },
};

const EXPERIMENTS = [
  {
    id: "search",
    title: t("Debounce the search box", "Debounce en el buscador"),
    change: t("Search-as-you-type · every keystroke used to send a request · now: wait until 300 ms with no key, then send once",
      "Búsqueda mientras escribes · antes cada pulsación enviaba una solicitud · ahora: espera hasta que pasen 300 ms sin teclas y luego envía una vez"),
    question: t("Someone types a search of about 12 characters, pausing briefly between words. How many requests does one search send now?",
      "Alguien escribe una búsqueda de unos 12 caracteres, con pausas breves entre palabras. ¿Cuántas solicitudes envía ahora una búsqueda?"),
    options: [t("Still about one per key: the keys just go out 300 ms later", "Todavía cerca de una por tecla: las teclas solo salen 300 ms más tarde"), t("About two or three: one for each pause longer than 300 ms", "Unas dos o tres: una por cada pausa de más de 300 ms"), t("Exactly one, always", "Exactamente una, siempre")],
    answer: 1,
    why: t("Each key restarts the 300 ms timer, so a request only leaves when the typist pauses for longer than that. Keys come about 170 ms apart inside a word, so a word's keys ride together; the short think between words is often longer than 300 ms, so a search sends one request per pause plus the final one. Fewer requests, not a guaranteed one.",
      "Cada tecla reinicia el temporizador de 300 ms, así que una solicitud solo sale cuando quien escribe hace una pausa más larga que eso. Dentro de una palabra las teclas llegan a unos 170 ms entre sí, así que las teclas de una palabra viajan juntas; la breve pausa para pensar entre palabras suele durar más de 300 ms, así que una búsqueda envía una solicitud por pausa más la final. Menos solicitudes, no una garantizada."),
    watch: { mode: "trailing", wait: 0.3, maxWait: 0, input: "typing", latency: "steady", cancel: "off" },
  },
  {
    id: "wait",
    title: t("Choose the wait", "Elige la espera"),
    change: t("Same typing · the debounce wait 100 ms → 300 ms → 1 s · a steady server that answers in about 0.2 s",
      "El mismo tecleo · la espera del debounce 100 ms → 300 ms → 1 s · un servidor estable que responde en unos 0.2 s"),
    question: t("What does each wait give you?", "¿Qué te da cada espera?"),
    options: [t("100 ms sends the fewest requests and feels fastest", "100 ms envía la menor cantidad de solicitudes y se siente más rápido"), t("100 ms barely cuts anything; 1 s sends about one per search, but results arrive over a second after the last key", "100 ms casi no reduce nada; 1 s envía cerca de una por búsqueda, pero los resultados llegan más de un segundo después de la última tecla"), t("All three send about the same number of requests", "Las tres envían más o menos la misma cantidad de solicitudes")],
    answer: 1,
    why: t("A wait only merges keys that arrive closer together than the wait. Typing gaps are longer than 100 ms, so almost every key still gets its own request. A long wait merges whole searches, but every search now pays that wait before the server even hears about it. Most search boxes land between 200 and 400 ms.",
      "Una espera solo junta las teclas que llegan más cerca entre sí que la espera. Los intervalos al teclear duran más de 100 ms, así que casi cada tecla sigue teniendo su propia solicitud. Una espera larga junta búsquedas enteras, pero ahora cada búsqueda paga esa espera antes de que el servidor siquiera se entere. La mayoría de los buscadores usan entre 200 y 400 ms."),
    watch: { mode: "trailing", wait: 1, maxWait: 0, input: "typing", latency: "steady", cancel: "off" },
  },
  {
    id: "hold",
    title: t("A key held down", "Una tecla sostenida"),
    change: t("An event every 50 ms for 5 s (a held key, a scroll, a window resize), then 2 s of quiet · debounce 300 ms",
      "Un evento cada 50 ms durante 5 s (una tecla sostenida, un scroll, un cambio de tamaño de la ventana), luego 2 s de calma · debounce de 300 ms"),
    question: t("When does the first request go out?", "¿Cuándo sale la primera solicitud?"),
    options: [t("300 ms after the first event", "300 ms después del primer evento"), t("Only after the stream stops, more than 5 s after it began", "Solo cuando el flujo se detiene, más de 5 s después de que empezó"), t("Every 300 ms while the events keep coming", "Cada 300 ms mientras siguen llegando eventos")],
    answer: 1,
    why: t("Every event restarts the timer, and the events never pause for 300 ms, so the door never closes: nothing is sent until the stream stops. That is starvation. A maximum wait fixes it: with maxWait 1 s the door closes at least once a second, whatever keeps arriving. If you want a steady beat during the stream, that is throttling, not debouncing.",
      "Cada evento reinicia el temporizador, y los eventos nunca se detienen 300 ms, así que la puerta nunca se cierra: no se envía nada hasta que el flujo para. Eso es inanición (starvation). Una espera máxima lo arregla: con maxWait de 1 s la puerta se cierra al menos una vez por segundo, llegue lo que llegue. Si quieres un ritmo constante durante el flujo, eso es throttling, no debouncing."),
    watch: { mode: "trailing", wait: 0.3, maxWait: 0, input: "hold", latency: "steady", cancel: "off" },
  },
  {
    id: "clicks",
    title: t("A double click on Submit", "Un doble clic en Enviar"),
    change: t("An impatient user double-clicks the order button, the clicks about 160 ms apart · no debounce, trailing 300 ms, or leading 300 ms",
      "Un usuario impaciente hace doble clic en el botón de pedido, con unos 160 ms entre clics · sin debounce, debounce al final (trailing) de 300 ms o al inicio (leading) de 300 ms"),
    question: t("Which setting sends exactly one order, and sends it immediately?", "¿Qué ajuste envía exactamente un pedido, y lo envía de inmediato?"),
    options: [t("No debounce", "Sin debounce"), t("Trailing debounce, 300 ms", "Debounce al final, 300 ms"), t("Leading debounce, 300 ms", "Debounce al inicio, 300 ms")],
    answer: 2,
    why: t("Without debounce both clicks become orders. Trailing debounce sends one order, but only 300 ms after the last click, so the button feels slow. Leading debounce sends on the first click and ignores everything until 300 ms of quiet: one order, at once. The server should still refuse duplicates (an idempotency key), because the client cannot catch every double submit.",
      "Sin debounce, los dos clics se vuelven pedidos. El debounce al final envía un pedido, pero solo 300 ms después del último clic, así que el botón se siente lento. El debounce al inicio envía con el primer clic e ignora todo hasta que haya 300 ms de calma: un pedido, al instante. El servidor igual debería rechazar duplicados (una clave de idempotencia), porque el cliente no puede atrapar cada doble envío."),
    watch: { mode: "leading", wait: 0.3, maxWait: 0, input: "clicks", latency: "steady", cancel: "off" },
  },
  {
    id: "order",
    title: t("Slow answers arrive late", "Las respuestas lentas llegan tarde"),
    change: t("Typing with a server that is usually quick but takes 1 to 2.5 s for one request in six · no debounce, debounce 300 ms, then debounce plus cancelling the older request",
      "Tecleo con un servidor que suele ser rápido pero tarda de 1 a 2.5 s en una de cada seis solicitudes · sin debounce, debounce de 300 ms y luego debounce más cancelar la solicitud anterior"),
    question: t("With a 300 ms debounce, can the screen still show results for an older search after a newer one?",
      "Con un debounce de 300 ms, ¿la pantalla todavía puede mostrar resultados de una búsqueda anterior después de una más reciente?"),
    options: [t("No: debounced requests go out in order, so their answers come back in order", "No: las solicitudes con debounce salen en orden, así que sus respuestas vuelven en orden"), t("Yes, less often than without debounce; cancelling the older request when sending a new one stops it", "Sí, menos seguido que sin debounce; cancelar la solicitud anterior al enviar una nueva lo evita"), t("Only without debounce", "Solo sin debounce")],
    answer: 1,
    why: t("Debounce decides when requests leave, not when answers come back. If an early request hits the slow path and a later one does not, the early answer lands last and replaces the right one on the screen. Fewer requests means fewer chances, not none. Abort the previous request (AbortController), or tag each request and ignore any answer older than the newest one shown.",
      "El debounce decide cuándo salen las solicitudes, no cuándo vuelven las respuestas. Si una solicitud temprana cae en el camino lento y una posterior no, la respuesta temprana llega última y reemplaza a la correcta en la pantalla. Menos solicitudes significan menos oportunidades, no ninguna. Aborta la solicitud anterior (AbortController), o etiqueta cada solicitud e ignora cualquier respuesta más vieja que la más reciente ya mostrada."),
    watch: { mode: "trailing", wait: 0.3, maxWait: 0, input: "typing", latency: "variable", cancel: "off" },
  },
];

const QUESTIONS = [
  [t("In one sentence, what does a debounce do, and how is it different from a throttle?", "En una oración, ¿qué hace un debounce y en qué se diferencia de un throttle?"),
    t("A debounce waits until events stop for a set time and then acts once, every new event restarting the wait. A throttle acts at most once per interval while events keep coming. Debounce answers \"when they're done\", throttle answers \"at a steady pace\".",
      "Un debounce espera a que los eventos se detengan durante un tiempo fijo y entonces actúa una vez; cada evento nuevo reinicia la espera. Un throttle actúa como máximo una vez por intervalo mientras siguen llegando eventos. El debounce responde \"cuando terminen\"; el throttle, \"a un ritmo constante\".")],
  [t("Why did a 100 ms debounce barely reduce the requests from typing?", "¿Por qué un debounce de 100 ms casi no redujo las solicitudes al teclear?"),
    t("It only merges events that arrive within 100 ms of each other. Most people type with gaps longer than that, so nearly every keystroke still finds the timer expired and sends its own request. The wait has to be longer than the gap you want to merge.",
      "Solo junta los eventos que llegan a menos de 100 ms uno de otro. La mayoría de la gente teclea con intervalos más largos, así que casi cada pulsación encuentra el temporizador vencido y envía su propia solicitud. La espera tiene que ser más larga que el intervalo que quieres juntar.")],
  [t("Search box: trailing. Submit button: leading. Why the different edges?", "Buscador: al final (trailing). Botón de envío: al inicio (leading). ¿Por qué flancos distintos?"),
    t("A search should run on the final text, after typing stops, so it waits for the trailing edge. A submit should react to the first click at once and ignore the accidental second one, so it fires on the leading edge and stays closed until things go quiet.",
      "Una búsqueda debería correr con el texto final, cuando se deja de teclear, así que espera al flanco final. Un envío debería reaccionar al primer clic de inmediato e ignorar el segundo accidental, así que dispara en el flanco inicial y se queda cerrado hasta que todo se calma.")],
  [t("A debounced scroll handler never runs while the user keeps scrolling. Why, and what are two fixes?", "Un handler de scroll con debounce nunca corre mientras el usuario sigue haciendo scroll. ¿Por qué, y cuáles son dos soluciones?"),
    t("Each scroll event restarts the timer and they never pause long enough for it to run out. Add a maximum wait so it fires at least every N ms, or use a throttle when you want regular updates during the stream.",
      "Cada evento de scroll reinicia el temporizador y nunca hay una pausa lo bastante larga para que se agote. Agrega una espera máxima para que dispare al menos cada N ms, o usa un throttle cuando quieras actualizaciones regulares durante el flujo.")],
  [t("Your debounced search still sometimes shows results for an earlier query. Why doesn't debounce prevent that, and what does?", "Tu búsqueda con debounce a veces todavía muestra resultados de una consulta anterior. ¿Por qué el debounce no lo evita, y qué sí lo evita?"),
    t("Debounce only spaces out when requests leave; answers can still come back in any order. Cancel the in-flight request when you send a new one (AbortController), or remember the latest request id and drop any answer that is older.",
      "El debounce solo espacia cuándo salen las solicitudes; las respuestas pueden volver en cualquier orden. Cancela la solicitud en curso cuando envías una nueva (AbortController), o recuerda el id de la última solicitud y descarta cualquier respuesta más vieja.")],
  [t("In React, a teammate writes const onChange = debounce(search, 300) inside the component body, and it doesn't debounce at all. What happened, and how do you fix it?",
    "En React, alguien del equipo escribe const onChange = debounce(search, 300) dentro del cuerpo del componente, y no hace ningún debounce. ¿Qué pasó y cómo lo arreglas?"),
    t("Every render creates a new debounced function with its own empty timer, so each keystroke goes to a fresh one. Create it once (useMemo or useRef, or a useDebouncedCallback hook), keep the latest search in a ref if it changes, and cancel the pending call when the component unmounts.",
      "Cada render crea una nueva función con debounce, con su propio temporizador vacío, así que cada pulsación va a una función nueva. Créala una sola vez (useMemo o useRef, o un hook useDebouncedCallback), guarda la última search en un ref si cambia, y cancela la llamada pendiente cuando el componente se desmonta.")],
];

export default defineLesson({
  title: t("Debounce Workbench", "Banco de trabajo: debounce"),
  eyebrow: t("Systems lesson 31 · Debounce", "Lección de sistemas 31 · Debounce"),
  lede: t("A debounce waits until events stop for a moment and then acts once. Every new event restarts the wait, so a burst of keystrokes becomes one request. This lesson turns it into an elevator that leaves only when nobody new has arrived: watch it, predict what breaks it, then explain it back.",
    "Un debounce (antirrebote) espera a que los eventos se detengan un momento y entonces actúa una vez. Cada evento nuevo reinicia la espera, así que una ráfaga de pulsaciones se convierte en una sola solicitud. Esta lección lo convierte en un elevador que solo sale cuando no llegó nadie nuevo: míralo, predice qué lo rompe y después explícalo."),
  machine: {
    intro: t("Every keystroke sends a passenger to the elevator. The door timer over the car restarts with each one; when it runs out, the whole group goes up to the server as one request. Turn debounce off and every passenger climbs the stairs alone. Change the wait, hold a key down, double-click, or type in the box yourself.",
      "Cada pulsación manda un pasajero al elevador. El temporizador de la puerta, sobre la cabina, se reinicia con cada uno; cuando se agota, todo el grupo sube al servidor como una sola solicitud. Apaga el debounce y cada pasajero sube solo por la escalera. Cambia la espera, sostén una tecla, haz doble clic o escribe tú mismo en el cuadro."),
    plate: {
      title: t("Elevator lobby", "Vestíbulo del elevador"),
      keys: [
        { mark: "lit", label: t("A request: the closed car, a ticket on the desk, an answer on the wire, a flag on the tape", "Una solicitud: la cabina cerrada, un ticket en el escritorio, una respuesta en el cable, una bandera en la cinta") },
        { mark: "raised", label: t("Passengers are keystrokes; counters on the car, desk, keyboard and screen", "Los pasajeros son pulsaciones; contadores en la cabina, el escritorio, el teclado y la pantalla") },
        { mark: "flat", label: t("The tape: pegs for keys, posts for requests", "La cinta: estacas para las teclas, postes para las solicitudes") },
      ],
      caption: t(
        "Each keystroke lights a key and sends a passenger to the elevator. The left dial over the door is the debounce timer: it restarts with every new passenger, and when it runs out the doors close and the car takes the whole group up as one request (the counter on the car shows how many keys it carries). The right dial shows how long the first passenger has waited; its mark is the maximum wait. With debounce off, every passenger climbs the stairs alone. Tickets on the server desk are requests being answered; answers ride the wire down to the screen, which shows what was typed and which search the results are for. The lamp lights when an older answer has replaced a newer one.",
        "Cada pulsación ilumina una tecla y manda un pasajero al elevador. El dial izquierdo sobre la puerta es el temporizador del debounce: se reinicia con cada pasajero nuevo, y cuando se agota las puertas se cierran y la cabina sube a todo el grupo como una sola solicitud (el contador de la cabina muestra cuántas teclas lleva). El dial derecho muestra cuánto lleva esperando el primer pasajero; su marca es la espera máxima. Con el debounce apagado, cada pasajero sube solo por la escalera. Los tickets en el escritorio del servidor son solicitudes que se están respondiendo; las respuestas bajan por el cable hasta la pantalla, que muestra lo escrito y de qué búsqueda son los resultados. La lámpara se enciende cuando una respuesta anterior reemplazó a una más reciente.",
      ),
      stage: { "data-lobby": "" },
      label: t("Debounce simulation. Space pauses or resumes.", "Simulación de debounce. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["keys", t("Keystrokes", "Pulsaciones")], ["reqs", t("Requests", "Solicitudes")], ["per", t("Keys per request", "Teclas por solicitud"), "–"], ["lag", t("Last key → results", "Última tecla → resultados"), "–"], ["stale", t("Older answer shown", "Respuesta anterior mostrada")], ["cancelled", t("Cancelled", "Canceladas")]],
    controls: [
      { seg: "mode", label: "Debounce", options: [["none", t("Off", "Apagado")], ["trailing", t("Trailing", "Al final")], ["leading", t("Leading", "Al inicio")]], value: "trailing" },
      { seg: "wait", label: t("Wait", "Espera"), options: [[0.1, "100 ms"], [0.3, "300 ms"], [1, "1 s"]], value: 0.3 },
      { seg: "maxWait", label: t("Max wait", "Espera máxima"), options: [[0, t("None", "Ninguna")], [1, "1 s"]], value: 0 },
      { seg: "input", label: t("Input", "Entrada"), options: [["typing", t("Typing", "Tecleo")], ["hold", t("Held key", "Tecla sostenida")], ["clicks", t("Double clicks", "Doble clic")], ["live", t("You type", "Tú escribes")]], value: "typing" },
      { seg: "latency", label: t("Server", "Servidor"), options: [["steady", t("Steady", "Estable")], ["variable", t("Slow tail", "Picos lentos")]], value: "variable" },
      { seg: "cancel", label: t("Older request", "Solicitud anterior"), options: [["off", t("Keep", "Mantener")], ["on", t("Cancel", "Cancelar")]], value: "off" },
      { input: "type", label: t("Type here", "Escribe aquí"), placeholder: t("type to feed keystrokes", "escribe para enviar pulsaciones"), aria: t("Type to send keystrokes into the machine", "Escribe para enviar pulsaciones a la máquina"), maxLength: 40 },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Choose “You type” and type in the box to drive the machine yourself.",
      "Cambiar un ajuste reinicia la ejecución. Elige “Tú escribes” y escribe en el cuadro para manejar la máquina tú mismo."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over six seeded runs of two minutes each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre seis ejecuciones con semilla fija de dos minutos cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Lesson 32 covers the throttle, debounce's sibling.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. La lección 32 trata el throttle, el hermano del debounce.`),
  css: `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}
.dg[data-size=s]{stroke-width:.9}
.dial-face{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.8}
.pie{fill:var(--anatomy-lit);stroke:var(--anatomy-lit);stroke-width:.4;stroke-linejoin:round}
.cable{fill:none;stroke:var(--anatomy-lo);stroke-width:.7}
.field{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.field[data-lit]{stroke:var(--anatomy-lit);stroke-width:1.5}
.iso-stage .iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit)}
`,
  data: {
    P,
    G: GEOMETRY,
    PAWN: pawnSvg(),
    TICKET_SVG: ticketSvg(),
    DOT_SVG: dotSvg(),
    PEG_SVG: pegSvg(),
    POST_SVG: postSvg(),
    // The "Type here" box (Panel has no text input): its label, placeholder and accessible name.
  },
});
