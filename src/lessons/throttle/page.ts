// @ts-nocheck: content ported as-is
// Systems lesson 32 · Throttle: a metronome gate on a ball track.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one, pct, msFromSecs } from "../../lib/format";
import { buildFigure, ballSvg, P, GEOMETRY, GAUGE } from "./figure";
import { avg } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the original page computed them in
// the browser; the model is seeded, so the numbers are the same).
const RESULTS = {
  scroll: { off: avg({ kind: "scroll", rate: 120, mode: "off" }), thr: avg({ kind: "scroll", rate: 120, mode: "throttle", wait: 0.1 }) },
  trailing: { lead: avg({ kind: "scroll", mode: "throttle", wait: 0.1, trailing: false }), both: avg({ kind: "scroll", mode: "throttle", wait: 0.1 }) },
  drag: { thr: avg({ kind: "drag", mode: "throttle", wait: 0.1 }), deb: avg({ kind: "drag", mode: "debounce", wait: 0.1 }) },
  clicks: { thr: avg({ kind: "clicks", mode: "throttle", wait: 0.5 }), qu: avg({ kind: "clicks", mode: "queue", wait: 0.5 }) },
  interval: [0.016, 0.1, 0.5].map((w) => ({ w, r: avg({ kind: "scroll", rate: 120, mode: "throttle", wait: w }) })),
};

// What each card shows after a run.
const RUNS = {
  scroll: () => {
    const { off, thr } = RESULTS.scroll;
    return { verdict: t("While scrolling: " + Math.round(off.callsPerSec) + " handler calls a second with no gate, " + Math.round(thr.callsPerSec) + " with the throttle. At 6 ms a call that is " + msFromSecs(off.workPerSec) + " of work per second of scrolling against " + msFromSecs(thr.workPerSec) + ", and the screen is never more than " + msFromSecs(thr.maxLag) + " behind.",
        "Durante el scroll: " + Math.round(off.callsPerSec) + " llamadas al handler por segundo sin compuerta, " + Math.round(thr.callsPerSec) + " con el throttle. A 6 ms por llamada, eso es " + msFromSecs(off.workPerSec) + " de trabajo por segundo de scroll contra " + msFromSecs(thr.workPerSec) + ", y la pantalla nunca va más de " + msFromSecs(thr.maxLag) + " atrasada."),
      bars: [[t("Calls / s, no gate", "Llamadas / s, sin compuerta"), 1, String(Math.round(off.callsPerSec))], [t("Calls / s, throttle 100 ms", "Llamadas / s, throttle 100 ms"), thr.callsPerSec / off.callsPerSec, String(Math.round(thr.callsPerSec)), true]] };
  },
  trailing: () => {
    const { lead, both } = RESULTS.trailing;
    return { verdict: t("The handler saw the position the user stopped at in " + pct(lead.finalHandled) + " of bursts with leading only, and " + pct(both.finalHandled) + " with leading + trailing (for " + one(both.callsPerSec - lead.callsPerSec) + " more calls a second).",
        "El handler vio la posición donde se detuvo el usuario en el " + pct(lead.finalHandled) + " de las ráfagas con solo el flanco inicial, y en el " + pct(both.finalHandled) + " con inicio + final (a cambio de " + one(both.callsPerSec - lead.callsPerSec) + " llamadas más por segundo)."),
      bars: [[t("Final position handled, leading only", "Posición final procesada, solo inicio"), lead.finalHandled, pct(lead.finalHandled), true], [t("Final position handled, both edges", "Posición final procesada, ambos flancos"), both.finalHandled, pct(both.finalHandled)]] };
  },
  drag: () => {
    const { thr, deb } = RESULTS.drag, top = Math.max(1, thr.duringPerBurst);
    return { verdict: t("During each 3 s drag the throttle updated " + Math.round(thr.duringPerBurst) + " times, about every " + msFromSecs(3 / Math.max(1, thr.duringPerBurst)) + "; the debounce updated " + Math.round(deb.duringPerBurst) + " times, and once " + msFromSecs(0.1) + " after each drag ended.",
        "Durante cada arrastre de 3 s, el throttle actualizó " + Math.round(thr.duringPerBurst) + " veces, cerca de cada " + msFromSecs(3 / Math.max(1, thr.duringPerBurst)) + "; el debounce actualizó " + Math.round(deb.duringPerBurst) + " veces, y una vez " + msFromSecs(0.1) + " después de que terminó cada arrastre."),
      bars: [[t("Updates during a drag, throttle", "Actualizaciones durante un arrastre, throttle"), thr.duringPerBurst / top, String(Math.round(thr.duringPerBurst))], [t("Updates during a drag, debounce", "Actualizaciones durante un arrastre, debounce"), deb.duringPerBurst / top, String(Math.round(deb.duringPerBurst)), true]] };
  },
  clicks: () => {
    const { thr, qu } = RESULTS.clicks;
    const lost = thr.dropped / thr.n;
    return { verdict: t("Throttled: " + Math.round(thr.calls) + " of " + Math.round(thr.n) + " clicks reached the cart; " + pct(lost) + " of the items vanished without an error. Queued at the same pace, every item arrived, but the last one up to " + one(qu.maxDelay) + " s after its click.",
        "Con throttle: " + Math.round(thr.calls) + " de " + Math.round(thr.n) + " clics llegaron al carrito; el " + pct(lost) + " de los artículos desapareció sin ningún error. En una cola al mismo ritmo llegaron todos los artículos, pero el último hasta " + one(qu.maxDelay) + " s después de su clic."),
      bars: [[t("Items lost, throttle", "Artículos perdidos, throttle"), lost, pct(lost), true], [t("Items lost, queue", "Artículos perdidos, cola"), 0, "0%"], [t("Longest wait, queue (of 5 s)", "Espera más larga, cola (de 5 s)"), Math.min(1, qu.maxDelay / 5), one(qu.maxDelay) + " s"]] };
  },
  interval: () => {
    const rs = RESULTS.interval;
    const top = Math.max(...rs.map(({ r }) => r.callsPerSec));
    return { verdict: t(rs.map(({ w, r }) => Math.round(w * 1000) + " ms: " + Math.round(r.callsPerSec) + " calls/s, screen up to " + msFromSecs(r.maxLag) + " behind").join(" · ") + ".",
        rs.map(({ w, r }) => Math.round(w * 1000) + " ms: " + Math.round(r.callsPerSec) + " llamadas/s, pantalla hasta " + msFromSecs(r.maxLag) + " atrasada").join(" · ") + "."),
      bars: rs.flatMap(({ w, r }, n) => [[t("Calls / s, " + msFromSecs(w), "Llamadas / s, " + msFromSecs(w)), r.callsPerSec / top, String(Math.round(r.callsPerSec)), n === 2], [t("Behind, at worst, " + msFromSecs(w), "Atraso máximo, " + msFromSecs(w)), Math.min(1, r.maxLag / 0.5), msFromSecs(r.maxLag), n === 2]]) };
  },
};

const EXPERIMENTS = [
  {
    id: "scroll",
    title: t("Throttle a scroll handler", "Aplica throttle a un handler de scroll"),
    change: t("A scroll fires 120 events a second · the handler takes 6 ms · no gate → throttle, 100 ms",
      "Un scroll dispara 120 eventos por segundo · el handler tarda 6 ms · sin compuerta → throttle de 100 ms"),
    question: t("While the user is scrolling, how often does the handler run with the throttle?", "Mientras el usuario hace scroll, ¿con qué frecuencia corre el handler con el throttle?"),
    options: [t("About as often as before: every event still has to be handled", "Más o menos tan seguido como antes: cada evento igual tiene que procesarse"), t("About 10 times a second: once per 100 ms", "Unas 10 veces por segundo: una vez cada 100 ms"), t("Not at all until the scrolling stops", "Nunca, hasta que se detiene el scroll")],
    answer: 1,
    why: t("A throttle runs the handler at most once per interval while events keep coming, and drops the events in between. For a scroll position that is exactly right: only the newest position matters, and a screen that updates ten times a second still feels live. The work drops by an order of magnitude and stops competing with scrolling itself.",
      "Un throttle ejecuta el handler como máximo una vez por intervalo mientras siguen llegando eventos, y descarta los eventos intermedios. Para una posición de scroll es exactamente lo correcto: solo importa la posición más nueva, y una pantalla que se actualiza diez veces por segundo todavía se siente viva. El trabajo baja un orden de magnitud y deja de competir con el scroll mismo."),
    watch: { mode: "throttle", wait: 0.1, edges: "both", input: "scroll", rate: 120 },
  },
  {
    id: "trailing",
    title: t("Leading edge only", "Solo el flanco inicial"),
    change: t("Throttle 100 ms · run on the leading edge only (no trailing call) · scroll in bursts, then stop",
      "Throttle de 100 ms · corre solo en el flanco inicial (leading, sin llamada final) · scroll en ráfagas, y luego se detiene"),
    question: t("When the user stops scrolling, does the handler see the position they stopped at?", "Cuando el usuario deja de hacer scroll, ¿el handler ve la posición donde se detuvo?"),
    options: [t("Yes, always: the throttle saw that event", "Sí, siempre: el throttle vio ese evento"), t("Often not: the last events fall inside a closed window and are dropped, so the screen stops short", "Muchas veces no: los últimos eventos caen dentro de una ventana cerrada y se descartan, así que la pantalla se queda corta"), t("Only if the interval is shorter than the scroll", "Solo si el intervalo es más corto que el scroll")],
    answer: 1,
    why: t("Leading-only acts on the first event of each window and drops the rest. The user's final position usually arrives mid-window, so it is dropped and nothing ever comes after it: the screen stays a few pixels behind where the user stopped. A trailing call keeps the newest event waiting and runs it when the window closes, so the final state always lands. Most libraries default to both edges for this reason.",
      "Con solo el flanco inicial, se actúa sobre el primer evento de cada ventana y se descarta el resto. La posición final del usuario suele llegar a mitad de una ventana, así que se descarta y nunca llega nada después: la pantalla queda unos píxeles antes de donde se detuvo el usuario. Una llamada final (trailing) deja esperando el evento más nuevo y lo ejecuta cuando se cierra la ventana, así que el estado final siempre llega. Por eso la mayoría de las bibliotecas usan ambos flancos por defecto."),
    watch: { mode: "throttle", wait: 0.1, edges: "lead", input: "scroll", rate: 60 },
  },
  {
    id: "drag",
    title: t("Throttle or debounce a drag", "Throttle o debounce en un arrastre"),
    change: t("A steady 3 s drag at 60 events a second · throttle 100 ms → debounce 100 ms", "Un arrastre constante de 3 s a 60 eventos por segundo · throttle de 100 ms → debounce de 100 ms"),
    question: t("How many updates does each give during the drag itself?", "¿Cuántas actualizaciones da cada uno durante el arrastre mismo?"),
    options: [t("About the same: both cut 180 events down to a few dozen", "Más o menos las mismas: los dos reducen 180 eventos a unas pocas decenas"), t("Throttle about 30 steady updates; debounce none until the drag stops", "El throttle, unas 30 actualizaciones constantes; el debounce, ninguna hasta que termina el arrastre"), t("Debounce more, because it reacts to every event", "El debounce más, porque reacciona a cada evento")],
    answer: 1,
    why: t("Debounce waits for a quiet gap: every new event winds its timer back, so during a continuous drag it never fires; it runs once, after the drag ends. That is right for a search box or saving a draft, and wrong for anything that should follow the pointer. Throttle fires on a steady beat during the burst, which is what live feedback needs.",
      "El debounce espera un hueco de calma: cada evento nuevo hace retroceder su temporizador, así que durante un arrastre continuo nunca dispara; corre una vez, cuando el arrastre termina. Eso está bien para un buscador o para guardar un borrador, y mal para cualquier cosa que deba seguir al puntero. El throttle dispara a un ritmo constante durante la ráfaga, que es lo que necesita una respuesta en vivo."),
    watch: { mode: "debounce", wait: 0.1, edges: "both", input: "drag", rate: 60 },
  },
  {
    id: "clicks",
    title: t("Throttle the add-to-cart button", "Aplica throttle al botón de agregar al carrito"),
    change: t("Bursts of quick clicks, one every 130–220 ms · each click should add one item · throttle 500 ms",
      "Ráfagas de clics rápidos, uno cada 130–220 ms · cada clic debería agregar un artículo · throttle de 500 ms"),
    question: t("What happens to the cart?", "¿Qué le pasa al carrito?"),
    options: [t("Every click still adds an item, just spaced out", "Cada clic igual agrega un artículo, solo que más espaciado"), t("Some clicks are dropped and their items never arrive, with no error", "Algunos clics se descartan y sus artículos nunca llegan, sin ningún error"), t("The extra clicks are merged into one bigger order", "Los clics extra se juntan en un solo pedido más grande")],
    answer: 1,
    why: t("A throttle is lossy by design: it keeps the newest event and drops the others. That is fine when only the latest value matters (a position, a size) and wrong when every event is its own piece of work. For clicks, handle each one (or make the operation idempotent and disable the button while a request is in flight); if you must space them out, queue them, which keeps every item but delivers the last one later and later.",
      "Un throttle pierde eventos por diseño: guarda el más nuevo y descarta los demás. Eso está bien cuando solo importa el último valor (una posición, un tamaño) y mal cuando cada evento es un trabajo en sí. Para los clics, procesa cada uno (o haz la operación idempotente y desactiva el botón mientras haya una solicitud en curso); si tienes que espaciarlos, ponlos en una cola, que conserva cada artículo pero entrega el último cada vez más tarde."),
    watch: { mode: "throttle", wait: 0.5, edges: "both", input: "clicks", rate: 60 },
  },
  {
    id: "interval",
    title: t("Pick the interval", "Elige el intervalo"),
    change: t("Scrolling at 120 events a second · throttle interval 16 ms (one frame) → 100 ms → 500 ms", "Scroll a 120 eventos por segundo · intervalo del throttle 16 ms (un frame) → 100 ms → 500 ms"),
    question: t("What does a longer interval buy, and what does it cost?", "¿Qué te da un intervalo más largo, y cuánto cuesta?"),
    options: [t("A shorter interval is free: always use the smallest", "Un intervalo más corto es gratis: usa siempre el más pequeño"), t("Less work, but the screen trails further behind the user", "Menos trabajo, pero la pantalla va más atrás del usuario"), t("Less work and less lag, because there is less to do", "Menos trabajo y menos atraso, porque hay menos que hacer")],
    answer: 1,
    why: t("The interval is a dial between work and staleness. One call per frame (16 ms, or requestAnimationFrame) follows the input as closely as the screen can show it and still halves the work at 120 events a second. 100 ms cuts the work by ten but the screen can be a tenth of a second behind; 500 ms is cheap and visibly laggy. Pick the longest interval the user won't notice for that kind of feedback.",
      "El intervalo es un dial entre trabajo y atraso. Una llamada por frame (16 ms, o requestAnimationFrame) sigue la entrada tan de cerca como la pantalla puede mostrarla y aun así reduce el trabajo a la mitad a 120 eventos por segundo. 100 ms divide el trabajo por diez, pero la pantalla puede ir una décima de segundo atrasada; 500 ms es barato y el atraso se nota. Elige el intervalo más largo que el usuario no note para ese tipo de respuesta."),
    watch: { mode: "throttle", wait: 0.5, edges: "both", input: "scroll", rate: 120 },
  },
];

const QUESTIONS = [
  [t("In one sentence each: what does a throttle do, and what does a debounce do? Give one use for each.", "En una oración cada uno: ¿qué hace un throttle y qué hace un debounce? Da un uso para cada uno."),
    t("A throttle runs the handler at most once per interval while events keep coming (scroll position, pointer tracking, progress updates). A debounce waits until events stop for a quiet interval and then runs once (search-as-you-type, autosave, reacting to the end of a resize).",
      "Un throttle ejecuta el handler como máximo una vez por intervalo mientras siguen llegando eventos (posición de scroll, seguimiento del puntero, actualizaciones de progreso). Un debounce espera a que los eventos se detengan durante un intervalo de calma y luego corre una vez (búsqueda mientras escribes, autoguardado, reaccionar al final de un cambio de tamaño).")],
  [t("Why do throttles usually fire on both the leading and the trailing edge?", "¿Por qué los throttles suelen disparar tanto en el flanco inicial como en el final?"),
    t("The leading call gives instant feedback on the first event. The trailing call runs the newest event when the window closes, so the final state (where the user stopped) is always handled. Leading-only can leave the screen short of the final position; trailing-only adds a full interval of delay to the first response.",
      "La llamada inicial da una respuesta inmediata al primer evento. La llamada final ejecuta el evento más nuevo cuando se cierra la ventana, así que el estado final (donde se detuvo el usuario) siempre se procesa. Con solo el flanco inicial, la pantalla puede quedarse corta de la posición final; con solo el final, la primera respuesta se retrasa un intervalo completo.")],
  [t("A teammate throttled the \"Pay\" button to stop double charges. What's wrong with that, and what would you do?", "Alguien del equipo aplicó throttle al botón \"Pagar\" para evitar cobros dobles. ¿Qué tiene de malo, y qué harías tú?"),
    t("A throttle drops events by design; it can still send two requests (one per window) and it silently swallows clicks the user meant. Disable the button while the request is in flight, and make the server call idempotent (an idempotency key) so a retry or double click can't charge twice.",
      "Un throttle descarta eventos por diseño; igual puede enviar dos solicitudes (una por ventana) y se traga en silencio clics que el usuario sí quería hacer. Desactiva el botón mientras la solicitud está en curso, y haz idempotente la llamada al servidor (una clave de idempotencia) para que un reintento o un doble clic no puedan cobrar dos veces.")],
  [t("Why is requestAnimationFrame a good throttle for anything that draws?", "¿Por qué requestAnimationFrame es un buen throttle para todo lo que dibuja?"),
    t("It runs once per frame, right before the browser paints, so work happens at most as often as the screen can show it, in step with rendering, and it pauses in background tabs. Keep the newest event in a variable and read it in the frame callback.",
      "Corre una vez por frame, justo antes de que el navegador pinte, así que el trabajo ocurre como máximo tan seguido como la pantalla puede mostrarlo, al ritmo del renderizado, y se pausa en las pestañas en segundo plano. Guarda el evento más nuevo en una variable y léelo en el callback del frame.")],
  [t("How is this throttle different from the rate limiter in lesson 05?", "¿En qué se diferencia este throttle del rate limiter de la lección 05?"),
    t("A throttle lives in the caller and drops its own redundant work, keeping only the newest event. A rate limiter lives in the server and protects it from many callers: it refuses requests beyond a budget (HTTP 429), and the caller decides whether to retry. One is a courtesy to yourself, the other a defence against everyone.",
      "Un throttle vive en quien llama y descarta su propio trabajo redundante, guardando solo el evento más nuevo. Un rate limiter (limitador de tasa) vive en el servidor y lo protege de muchos clientes: rechaza las solicitudes que pasan de un presupuesto (HTTP 429), y el cliente decide si reintenta. Uno es una cortesía contigo mismo; el otro, una defensa contra todos.")],
  [t("A dashboard receives 200 websocket messages a second and re-renders on each one; the tab freezes. How would you fix it without losing data?",
    "Un dashboard recibe 200 mensajes de websocket por segundo y vuelve a renderizar con cada uno; la pestaña se congela. ¿Cómo lo arreglarías sin perder datos?"),
    t("Separate receiving from drawing. Apply every message to an in-memory state (no data lost, nothing dropped), and throttle the render to the frame rate or ~10 times a second, always drawing the newest state. If the processing itself is heavy, batch the messages per frame.",
      "Separa recibir de dibujar. Aplica cada mensaje a un estado en memoria (sin perder datos, sin descartar nada) y aplica throttle al render a la tasa de frames o a unas 10 veces por segundo, dibujando siempre el estado más nuevo. Si el procesamiento mismo es pesado, agrupa los mensajes por frame.")],
];

export default defineLesson({
  title: t("Throttle Workbench", "Banco de trabajo: throttle"),
  eyebrow: t("Systems lesson 32 · Throttle", "Lección de sistemas 32 · Throttle"),
  lede: t("Some events arrive far faster than you need to act on them: a scroll or a pointer fires 60 to 120 times a second. A throttle lets the handler run at most once per interval, keeps the newest event and drops the rest. This lesson builds one as a machine: watch it, predict what changes it, then explain it back.",
    "Algunos eventos llegan mucho más rápido de lo que necesitas reaccionar: un scroll o un puntero dispara de 60 a 120 veces por segundo. Un throttle (limitador de frecuencia) deja que el handler corra como máximo una vez por intervalo, guarda el evento más nuevo y descarta el resto. Esta lección lo arma como una máquina: mírala, predice qué la cambia y después explícalo."),
  machine: {
    intro: t("Event balls roll from the hopper to a gate held by a metronome. One swing is one interval: the first ball goes straight through, the newest one waits on the flap, the rest fall into the bin, and the waiting ball goes through when the swing ends. Watch the rail in front: the frame (what the screen shows) chases the figure (where the user is). Try Leading only, then Debounce, then Clicks.",
      "Las bolas de eventos ruedan desde la tolva hasta una compuerta que sostiene un metrónomo. Una oscilación es un intervalo: la primera bola pasa directo, la más nueva espera en la trampilla, el resto cae al cesto, y la bola que espera pasa cuando termina la oscilación. Mira el riel del frente: el marco (lo que muestra la pantalla) persigue a la figura (dónde está el usuario). Prueba Solo inicio, luego Debounce y luego Clics."),
    plate: {
      title: t("Metronome gate", "Compuerta de metrónomo"),
      keys: [
        { mark: "lit", label: t("A ball let through to the handler; the press at work; the frame showing what the screen shows", "Una bola que pasa al handler; la prensa trabajando; el marco con lo que muestra la pantalla") },
        { mark: "raised", label: t("Event balls: rolling, waiting on the flap, or piled in the discard bin", "Bolas de eventos: rodando, esperando en la trampilla o apiladas en el cesto de descarte") },
        { mark: "flat", label: t("The metronome: one swing per interval; while it swings, the gate stays down", "El metrónomo: una oscilación por intervalo; mientras oscila, la compuerta queda cerrada") },
      ],
      caption: t(
        "Balls (events) leave the hopper and roll to the gate. If the metronome is at rest, the first ball goes straight through to the press (the handler) and the metronome starts a swing that keeps the gate down for one interval. While it swings, the newest ball waits on the flap in front of the gate; when another arrives, the waiting one drops through the flap into the bin. When the swing ends, the waiting ball goes through. Counters show events, dropped and handled; the dial shows handler calls per second. On the rail in front, the figure is where the user is and the lit frame is what the screen shows; the dashed line between them is how far behind the screen is.",
        "Las bolas (eventos) salen de la tolva y ruedan hasta la compuerta. Si el metrónomo está en reposo, la primera bola pasa directo a la prensa (el handler) y el metrónomo empieza una oscilación que mantiene cerrada la compuerta durante un intervalo. Mientras oscila, la bola más nueva espera en la trampilla delante de la compuerta; cuando llega otra, la que esperaba cae por la trampilla al cesto. Cuando termina la oscilación, la bola que espera pasa. Los contadores muestran los eventos, los descartados y los procesados; el dial muestra las llamadas al handler por segundo. En el riel del frente, la figura es dónde está el usuario y el marco iluminado es lo que muestra la pantalla; la línea punteada entre ellos es cuánto va atrasada la pantalla.",
      ),
      stage: { "data-gate": "" },
      label: t("Throttle simulation. Space pauses or resumes.", "Simulación de throttle. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["events", t("Events", "Eventos")], ["handled", t("Handled", "Procesados")], ["dropped", t("Dropped", "Descartados")], ["rate", t("Calls / s", "Llamadas / s")], ["behind", t("Screen behind", "Atraso de pantalla"), "–"], ["waiting", t("Waiting", "En espera"), "–"]],
    controls: [
      { seg: "mode", label: t("Gate", "Compuerta"), options: [["off", t("No gate", "Sin compuerta")], ["throttle", "Throttle"], ["debounce", "Debounce"], ["queue", t("Queue", "Cola")]], value: "throttle" },
      { seg: "wait", label: t("Interval", "Intervalo"), options: [[0.016, "16 ms"], [0.1, "100 ms"], [0.25, "250 ms"], [0.5, "500 ms"]], value: 0.1 },
      { seg: "edges", label: t("Edges", "Flancos"), options: [["both", t("Leading + trailing", "Inicio + final")], ["lead", t("Leading only", "Solo inicio")], ["trail", t("Trailing only", "Solo final")]], value: "both" },
      { seg: "input", label: t("Input", "Entrada"), options: [["scroll", t("Scroll bursts", "Ráfagas de scroll")], ["drag", t("Steady drag", "Arrastre constante")], ["clicks", t("Clicks", "Clics")], ["you", t("Your hand", "Tu mano")]], value: "scroll" },
      { speed: true },
      { actions: [["hold", t("Hold to scroll", "Mantén para scroll")], ["click", t("Click", "Clic")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The machine plays in slow motion: at ×1 one second on the page is a tenth of a second of real input. Choose <em>Your hand</em> and hold the button to scroll, or press Click quickly a few times.",
      "La máquina va en cámara lenta: a ×1, un segundo en la página es una décima de segundo de entrada real. Elige <em>Tu mano</em> y mantén presionado el botón para hacer scroll, o presiona Clic varias veces rápido."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of 20 seconds of input.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de 20 segundos de entrada."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). The gate follows the usual <code>throttle(fn, wait, { leading, trailing })</code> semantics. Simulation written for this lesson.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). La compuerta sigue la semántica habitual de <code>throttle(fn, wait, { leading, trailing })</code>. Simulación escrita para esta lección.`),
  css: `
.cw{fill:var(--anatomy-page);stroke:var(--anatomy-lo);stroke-width:.7}
.dg{fill:none;stroke:var(--anatomy-strong);stroke-width:1.05;stroke-linecap:round;stroke-linejoin:round}
[data-act="hold"]{touch-action:none;user-select:none;-webkit-user-select:none}
[data-act="hold"][data-held]{background:var(--anatomy-strong);color:var(--anatomy-page)}
`,
  data: {
    P,
    G: GEOMETRY,
    GAUGE,
    BALL_SVG: ballSvg(false),
  },
});
