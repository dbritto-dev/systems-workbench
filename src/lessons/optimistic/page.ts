// @ts-nocheck: content in the style of the other lessons
// Systems lesson 58 · Optimistic UI & rollback: a front counter that shows the like before the records office says yes.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, msFromSecs } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, courierSvg, slipSvg, P, GEOMETRY } from "./figure";
import { waitRun, failRun, raceRun, refetchRun, lateRun, FAIL, SLOW, OUT, BACK, WORK, POLL, STEP, DOUBLE } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds of fifteen minutes each).
const R = { wait: waitRun(), fail: failRun(), race: raceRun(), refetch: refetchRun(), late: lateRun() };

const ms = (x) => (x < 1 ? msFromSecs(x) : x.toFixed(1) + " s");
const s1 = (x) => x.toFixed(1) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const per100 = (x) => String(Math.round(x));
const range = ([a, b]) => Math.round(1000 * a) + "–" + Math.round(1000 * (a + b)) + " ms";
const SLOW_EVERY = Math.round(1 / SLOW.share);
const SLOW_RANGE = SLOW.extra[0].toFixed(1) + "–" + (SLOW.extra[0] + SLOW.extra[1]).toFixed(1) + " s";
const STEP_RANGE = STEP[0].toFixed(1) + "–" + (STEP[0] + STEP[1]).toFixed(1) + " s";
const DOUBLE_RANGE = range(DOUBLE);
const FAIL_PCT = pct(FAIL);

// What each card shows after a run.
const RUNS = {
  wait: () => {
    const { pess, opt } = R.wait, m = top(pess.p95);
    return {
      verdict: t("Pessimistic: the like showed " + ms(pess.p50) + " after the tap at the median, " + ms(pess.p95) + " at p95. Optimistic: " + ms(opt.p95) + " for every tap; the same round trips ran in the background.",
        "Pesimista: el like apareció " + ms(pess.p50) + " después del toque en la mediana y " + ms(pess.p95) + " en el p95. Optimista: " + ms(opt.p95) + " en todos los toques; las mismas idas y vueltas corrieron en segundo plano."),
      bars: [[t("Pessimistic, median", "Pesimista, mediana"), pess.p50 / m, ms(pess.p50)], [t("Pessimistic, p95", "Pesimista, p95"), pess.p95 / m, ms(pess.p95), true], [t("Optimistic, p95", "Optimista, p95"), opt.p95 / m, ms(opt.p95)]],
    };
  },
  fail: () => {
    const { rollback, none } = R.fail, m = top(none.mean, rollback.p95);
    return {
      verdict: t("With a rollback, the refused like left the screen " + ms(rollback.p50) + " after the tap at the median, " + ms(rollback.p95) + " at p95, and " + pct(rollback.told) + " of failures were announced. With no error handler it stayed " + s1(none.mean) + " on average, and " + pct(none.told) + " were announced.",
        "Con rollback, el like rechazado salió de la pantalla " + ms(rollback.p50) + " después del toque en la mediana y " + ms(rollback.p95) + " en el p95, y se avisó el " + pct(rollback.told) + " de los fallos. Sin manejador de error se quedó " + s1(none.mean) + " en promedio, y se avisó el " + pct(none.told) + "."),
      groups: [
        { title: t("Refused like on screen, from the tap", "Like rechazado en pantalla, desde el toque"), bars: [[t("Rollback, median", "Rollback, mediana"), rollback.p50 / m, ms(rollback.p50)], [t("Rollback, p95", "Rollback, p95"), rollback.p95 / m, ms(rollback.p95)], [t("No handler, average", "Sin manejador, promedio"), none.mean / m, s1(none.mean), true]] },
        { title: t("Failures announced to the user", "Fallos avisados al usuario"), bars: [[t("Rollback", "Rollback"), rollback.told, pct(rollback.told)], [t("No handler", "Sin manejador"), none.told, pct(none.told), true]] },
      ],
    };
  },
  race: () => {
    const { all, latest, serial } = R.race, m = top(all.screen, all.server, latest.server, 0.01);
    const bars = (key) => [[t("Apply every answer", "Aplicar todas"), all[key] / m, pct(all[key])], [t("Ignore stale answers", "Ignorar respuestas viejas"), latest[key] / m, pct(latest[key]), key === "server"], [t("One in flight, send the final state", "Una en vuelo, enviar el estado final"), serial[key] / m, pct(serial[key])]];
    return {
      verdict: t("After a double tap settled, the screen showed the wrong value in " + pct(all.screen) + " of cases applying every answer, " + pct(latest.screen) + " ignoring stale answers, " + pct(serial.screen) + " with one save in flight. The server stored the wrong value in " + pct(all.server) + ", " + pct(latest.server) + " and " + pct(serial.server) + ".",
        "Cuando un doble toque terminó, la pantalla mostraba el valor equivocado en el " + pct(all.screen) + " de los casos aplicando todas las respuestas, " + pct(latest.screen) + " ignorando las viejas y " + pct(serial.screen) + " con un guardado en vuelo. El servidor guardó el valor equivocado en el " + pct(all.server) + ", " + pct(latest.server) + " y " + pct(serial.server) + "."),
      groups: [{ title: t("Screen ends wrong", "La pantalla termina mal"), bars: bars("screen") }, { title: t("Server ends wrong", "El servidor termina mal"), bars: bars("server") }],
    };
  },
  refetch: () => {
    const { poll, guard } = R.refetch, m = top(poll.per100);
    return {
      verdict: t("The like jumped back to the old value " + per100(poll.per100) + " times per 100 taps when reads landed freely, " + per100(guard.per100) + " when a save cancelled reads in flight and held new ones until it settled.",
        "El like volvió al valor viejo " + per100(poll.per100) + " veces cada 100 toques cuando las lecturas aterrizaban libremente, y " + per100(guard.per100) + " cuando un guardado cancelaba las lecturas en vuelo y retenía las nuevas hasta terminar."),
      bars: [[t("Reads land freely", "Lecturas libres"), poll.per100 / m, per100(poll.per100), true], [t("Reads cancelled and held", "Lecturas canceladas y retenidas"), guard.per100 / m, per100(guard.per100)]],
    };
  },
  late: () => {
    const { steady, tail, pess } = R.late, m = top(tail.late, steady.late, 0.01);
    return {
      verdict: t("Failed saves the user had already moved on from: " + pct(steady.late) + " with a steady server, " + pct(tail.late) + " with the slow tail, " + pct(pess.late) + " with the pessimistic button.",
        "Guardados fallidos de los que el usuario ya había seguido de largo: " + pct(steady.late) + " con un servidor estable, " + pct(tail.late) + " con la cola lenta y " + pct(pess.late) + " con el botón pesimista."),
      bars: [[t("Optimistic, steady server", "Optimista, servidor estable"), steady.late / m, pct(steady.late)], [t("Optimistic, slow tail", "Optimista, cola lenta"), tail.late / m, pct(tail.late), true], [t("Pessimistic, slow tail", "Pesimista, cola lenta"), pess.late / m, pct(pess.late)]],
    };
  },
};

const { wait: W, fail: F, race: X, refetch: Q, late: Z } = R;

const EXPERIMENTS = [
  {
    id: "wait",
    title: t("Wait for the server, or don't", "Esperar al servidor, o no"),
    change: t("A like button · a save takes about " + ms(W.pess.p50) + " there and back, but one in " + SLOW_EVERY + " takes a slow path of " + SLOW_RANGE + " more · pessimistic (show the like when the server says yes) vs optimistic (show it on the tap)",
      "Un botón de like · un guardado tarda unos " + ms(W.pess.p50) + " de ida y vuelta, pero uno de cada " + SLOW_EVERY + " toma un camino lento de " + SLOW_RANGE + " más · pesimista (mostrar el like cuando el servidor dice que sí) vs optimista (mostrarlo con el toque)"),
    question: t("With the pessimistic button, how long does the slowest tap in twenty (the p95) wait before the like shows?", "Con el botón pesimista, ¿cuánto espera el toque más lento de cada veinte (el p95) hasta que aparece el like?"),
    options: [
      t("About " + ms(W.pess.p50) + ", like a typical save", "Unos " + ms(W.pess.p50) + ", como un guardado típico"),
      t("Around half a second", "Alrededor de medio segundo"),
      t("Over a second: the slow path decides it", "Más de un segundo: lo decide el camino lento"),
    ],
    answer: 2,
    why: t(
      "A percentile counts requests, not milliseconds. One save in " + SLOW_EVERY + " takes the slow path, more than the one in twenty that the 95th percentile looks past, so the p95 lands inside the slow path: " + ms(W.pess.p95) + ", against a median of " + ms(W.pess.p50) + ". The optimistic button shows every like on the tap, " + ms(W.opt.p95) + ", whatever the server is doing. The round trip still happens, in the background: optimism moves the wait off the user, it doesn't remove it, and the answer still has to be handled when it arrives.",
      "Un percentil cuenta solicitudes, no milisegundos. Uno de cada " + SLOW_EVERY + " guardados toma el camino lento, más que el uno de cada veinte que el percentil 95 deja afuera, así que el p95 cae dentro del camino lento: " + ms(W.pess.p95) + ", contra una mediana de " + ms(W.pess.p50) + ". El botón optimista muestra cada like con el toque, " + ms(W.opt.p95) + ", haga lo que haga el servidor. La ida y vuelta sigue ocurriendo, en segundo plano: el optimismo le quita la espera al usuario, no la elimina, y la respuesta igual hay que manejarla cuando llega.",
    ),
    watch: { ui: "pess", onFail: "rollback", order: "all", reads: "off", fail: 0, server: "tail", taps: "single" },
  },
  {
    id: "fail",
    title: t("A save fails", "Un guardado falla"),
    change: t("Optimistic like · the server refuses " + FAIL_PCT + " of saves · roll back to the value before the tap and tell the user (an onError handler) vs no error handler",
      "Like optimista · el servidor rechaza el " + FAIL_PCT + " de los guardados · volver al valor de antes del toque y avisarle al usuario (un manejador onError) vs ningún manejador de error"),
    question: t("With no error handler, how long does the screen keep a like the server refused?", "Sin manejador de error, ¿cuánto tiempo mantiene la pantalla un like que el servidor rechazó?"),
    options: [
      t("Until the error arrives, a few hundred ms: then the like goes away", "Hasta que llega el error, unos cientos de ms: después el like desaparece"),
      t("Until something else replaces it: here the user's next tap, seconds later", "Hasta que algo más lo reemplaza: aquí el siguiente toque del usuario, segundos después"),
      t("It never shows: an optimistic update waits for the server's yes", "Nunca se muestra: una actualización optimista espera el sí del servidor"),
    ],
    answer: 1,
    why: t(
      "The optimistic update wrote the like into the app's state, and nothing takes it out unless code does. With no handler, the refused like stays on screen, " + s1(F.none.mean) + " on average here, until the user's next tap happened to replace it (in an app, until a refetch or a reload), and the user is never told. With a rollback the screen goes back to the snapshot taken before the tap and a notice says the save failed, but only when the error arrives: " + ms(F.rollback.p50) + " after the tap at the median, " + ms(F.rollback.p95) + " at p95, because a failure takes the same round trip as a success. Optimism makes good news instant, never bad news.",
      "La actualización optimista escribió el like en el estado de la app, y nada lo saca si el código no lo hace. Sin manejador, el like rechazado se queda en pantalla, " + s1(F.none.mean) + " en promedio aquí, hasta que el siguiente toque del usuario lo reemplazó por casualidad (en una app, hasta una recarga de datos o de la página), y al usuario nunca se le avisa. Con rollback la pantalla vuelve a la instantánea (snapshot) tomada antes del toque y un aviso dice que el guardado falló, pero solo cuando llega el error: " + ms(F.rollback.p50) + " después del toque en la mediana y " + ms(F.rollback.p95) + " en el p95, porque un fallo hace la misma ida y vuelta que un éxito. El optimismo vuelve instantáneas las buenas noticias, nunca las malas.",
    ),
    watch: { ui: "opt", onFail: "none", order: "all", reads: "off", fail: 0.1, server: "tail", taps: "single" },
  },
  {
    id: "race",
    title: t("Two quick taps", "Dos toques rápidos"),
    change: t("Optimistic like · the user likes, then unlikes " + DOUBLE_RANGE + " later, and both saves are in flight at once · one in " + SLOW_EVERY + " is slow · apply every answer vs ignore stale answers vs one save in flight that sends the final state",
      "Like optimista · el usuario da like y lo quita " + DOUBLE_RANGE + " después, y los dos guardados están en vuelo a la vez · uno de cada " + SLOW_EVERY + " es lento · aplicar todas las respuestas vs ignorar las respuestas viejas vs un guardado en vuelo que envía el estado final"),
    question: t("Ignoring stale answers (only the newest save's answer counts), how often does the server end up storing the wrong value?", "Ignorando las respuestas viejas (solo cuenta la respuesta del guardado más nuevo), ¿qué tan seguido termina el servidor guardando el valor equivocado?"),
    options: [
      t("Never: the screen ends right, so the data is right", "Nunca: la pantalla termina bien, así que los datos están bien"),
      t("About as often as the two saves were reordered: ignoring an answer doesn't undo its write", "Más o menos tan seguido como se desordenaron los dos guardados: ignorar una respuesta no deshace su escritura"),
      t("Only when a save fails", "Solo cuando falla un guardado"),
    ],
    answer: 1,
    why: t(
      "When the first save takes the slow path, the server writes it after the second, and its answer comes back after the second's. Applying every answer, the screen ends on the like the user took back (" + pct(X.all.screen) + " of double taps): the last answer wins over the last intent, and the server stores it too (" + pct(X.all.server) + "). Ignoring stale answers keeps the screen right (" + pct(X.latest.screen) + "), but the old write still lands last: the server stores the wrong value in " + pct(X.latest.server) + " while the screen says otherwise, and nobody sees it until the next load. Keeping one save in flight, and when it returns sending the value the user wants now, keeps both right (" + pct(X.serial.screen) + ", " + pct(X.serial.server) + "). A version the server checks before writing would too.",
      "Cuando el primer guardado toma el camino lento, el servidor lo escribe después del segundo y su respuesta vuelve después de la del segundo. Aplicando todas las respuestas, la pantalla termina en el like que el usuario quitó (" + pct(X.all.screen) + " de los dobles toques): la última respuesta le gana a la última intención, y el servidor también lo guarda (" + pct(X.all.server) + "). Ignorar las respuestas viejas deja bien la pantalla (" + pct(X.latest.screen) + "), pero la escritura vieja igual llega última: el servidor guarda el valor equivocado en el " + pct(X.latest.server) + " mientras la pantalla dice otra cosa, y nadie lo ve hasta la próxima carga. Mantener un solo guardado en vuelo y, cuando vuelve, enviar el valor que el usuario quiere ahora deja bien las dos cosas (" + pct(X.serial.screen) + ", " + pct(X.serial.server) + "). Una versión que el servidor compruebe antes de escribir también lo lograría.",
    ),
    watch: { ui: "opt", onFail: "rollback", order: "latest", reads: "off", fail: 0, server: "tail", taps: "double" },
  },
  {
    id: "refetch",
    title: t("A refetch during the save", "Una recarga durante el guardado"),
    change: t("Optimistic like · the page refetches the like every " + POLL + " s (a poll, a focus refetch, another component's query) · reads land whenever they arrive vs reads cancelled when a save starts, held while it's in flight, and one fresh read after it settles",
      "Like optimista · la página vuelve a leer el like cada " + POLL + " s (un sondeo, una recarga al enfocar, la consulta de otro componente) · las lecturas aterrizan cuando llegan vs las lecturas se cancelan cuando empieza un guardado, se retienen mientras está en vuelo y se hace una lectura nueva cuando termina"),
    question: t("Per 100 taps, how often does the like visibly jump back to the old value?", "Cada 100 toques, ¿cuántas veces vuelve el like visiblemente al valor viejo?"),
    options: [
      t("Never: by the time a read lands, the server has the new value", "Nunca: cuando una lectura aterriza, el servidor ya tiene el valor nuevo"),
      t("Some of the time: a read that ran before the write can land after the tap", "Algunas veces: una lectura que corrió antes de la escritura puede aterrizar después del toque"),
      t("On almost every tap", "En casi todos los toques"),
    ],
    answer: 1,
    why: t(
      "A read reports the server as it was when the read ran. One that ran before the write but lands after the tap puts the old value back on the screen: " + per100(Q.poll.per100) + " times per 100 taps here, a like that flickers off and on again, or stays off until the next read. Nothing was wrong at the server; the read was simply stale by the time it landed. Cancel reads in flight when the save starts (TanStack Query's cancelQueries in onMutate), don't apply reads while it's in flight, and refetch once it settles (invalidateQueries in onSettled): " + per100(Q.guard.per100) + ".",
      "Una lectura informa el servidor tal como estaba cuando corrió. Una que corrió antes de la escritura pero aterriza después del toque vuelve a poner el valor viejo en la pantalla: " + per100(Q.poll.per100) + " veces cada 100 toques aquí, un like que se apaga y se vuelve a encender, o que queda apagado hasta la siguiente lectura. En el servidor no había nada mal; la lectura ya estaba vieja cuando aterrizó. Cancela las lecturas en vuelo cuando empieza el guardado (cancelQueries de TanStack Query en onMutate), no apliques lecturas mientras está en vuelo y vuelve a leer cuando termina (invalidateQueries en onSettled): " + per100(Q.guard.per100) + ".",
    ),
    watch: { ui: "opt", onFail: "rollback", order: "all", reads: "poll", fail: 0, server: "steady", taps: "single" },
  },
  {
    id: "late",
    title: t("Moving on before the answer", "Seguir antes de la respuesta"),
    change: t(FAIL_PCT + " of saves fail · the user moves on (scrolls away, opens the next screen) " + STEP_RANGE + " after each tap · optimistic with rollback, steady server vs slow tail · and the pessimistic button",
      "El " + FAIL_PCT + " de los guardados falla · el usuario sigue de largo (se desplaza, abre la siguiente pantalla) " + STEP_RANGE + " después de cada toque · optimista con rollback, servidor estable vs cola lenta · y el botón pesimista"),
    question: t("With the slow tail, what share of failed saves had the user already moved on from when the rollback arrived?", "Con la cola lenta, ¿de qué parte de los guardados fallidos ya había seguido de largo el usuario cuando llegó el rollback?"),
    options: [
      t("Almost none: errors come back in a few hundred ms", "Casi ninguno: los errores vuelven en unos cientos de ms"),
      t("A real share: every failure slower than the user's next step", "Una parte real: cada fallo más lento que el siguiente paso del usuario"),
      t("All of them", "Todos"),
    ],
    answer: 1,
    why: t(
      "An optimistic UI reports a failure one round trip after it reported success. If the user's next step comes first, they leave believing in a result that never happened: " + pct(Z.steady.late) + " of failures with a steady server, " + pct(Z.tail.late) + " with the slow tail, because a slow request brings its failure late too. The pessimistic button never shows the success, so the user waits but never moves on from a false one (" + pct(Z.pess.late) + "). That is the line: be optimistic where failure is rare and cheap to undo (a like, a checkbox, reordering a list), and not where it's irreversible or likely: a payment, a booking, a username that may be taken.",
      "Una UI optimista informa un fallo una ida y vuelta después de haber informado el éxito. Si el siguiente paso del usuario llega antes, se va creyendo en un resultado que nunca ocurrió: el " + pct(Z.steady.late) + " de los fallos con un servidor estable y el " + pct(Z.tail.late) + " con la cola lenta, porque una solicitud lenta también trae tarde su fallo. El botón pesimista nunca muestra el éxito, así que el usuario espera pero nunca sigue de largo con uno falso (" + pct(Z.pess.late) + "). Esa es la línea: sé optimista donde fallar es raro y barato de deshacer (un like, una casilla, reordenar una lista), y no donde es irreversible o probable: un pago, una reserva, un nombre de usuario que puede estar tomado.",
    ),
    watch: { ui: "opt", onFail: "rollback", order: "all", reads: "off", fail: 0.1, server: "tail", taps: "single" },
  },
];

const QUESTIONS = [
  [t("In one sentence, what is an optimistic update, and what does it trade?", "En una oración, ¿qué es una actualización optimista y qué intercambia?"),
   t("The app shows the result of an action before the server confirms it, then reconciles when the answer arrives. It trades the round-trip wait for work the app must now do: roll failures back where the user can see them, keep late or out-of-order answers and refetches from overwriting the user's intent, and make sure the server ends with what the user asked for.",
     "La app muestra el resultado de una acción antes de que el servidor lo confirme y después concilia cuando llega la respuesta. Intercambia la espera de la ida y vuelta por trabajo que la app ahora tiene que hacer: revertir los fallos donde el usuario los vea, evitar que respuestas tardías o desordenadas y las recargas pisen la intención del usuario, y asegurarse de que el servidor termine con lo que el usuario pidió.")],
  [t("With TanStack Query, onMutate writes the new value into the cache and returns a snapshot of the old one; onError puts the snapshot back. Two quick edits to the same title overlap (A to B, then B to C) and the first one fails. What does that rollback get wrong, and how do you guard against it?",
     "Con TanStack Query, onMutate escribe el valor nuevo en la caché y devuelve una instantánea del viejo; onError la vuelve a poner. Dos ediciones rápidas del mismo título se superponen (de A a B, y luego de B a C) y falla la primera. ¿Qué hace mal ese rollback y cómo te proteges?"),
   t("The first edit's snapshot is A, the value from before it. Putting it back erases C, the user's newer edit, from the screen, even though the second save may succeed: the screen ends on A while the server stores C. Roll back only if no newer save for that item is pending, refetch the truth once everything settles (invalidateQueries in onSettled), or keep one save in flight per item. React's useOptimistic avoids the snapshot: the optimistic value only lives while its action is pending, and then the component shows whatever real state you set.",
     "La instantánea de la primera edición es A, el valor de antes de ella. Volver a ponerla borra de la pantalla C, la edición más nueva del usuario, aunque el segundo guardado pueda salir bien: la pantalla termina en A mientras el servidor guarda C. Revierte solo si no hay un guardado más nuevo pendiente para ese ítem, vuelve a leer la verdad cuando todo termina (invalidateQueries en onSettled), o mantén un solo guardado en vuelo por ítem. useOptimistic de React evita la instantánea: el valor optimista solo vive mientras su acción está pendiente, y después el componente muestra el estado real que hayas fijado.")],
  [t("Why doesn't ignoring stale responses make the data right, and what does?", "¿Por qué ignorar las respuestas viejas no deja bien los datos, y qué sí lo hace?"),
   t("Ignoring an answer only changes what the client shows. The write it answers was already sent, and concurrent requests can be written in any order, so an older write can land last. Send one save per item at a time and, when it returns, send the state the user wants now; or have the server reject older writes, with a version or a client sequence number it compares, or a conditional request (If-Match with an ETag).",
     "Ignorar una respuesta solo cambia lo que muestra el cliente. La escritura a la que responde ya se envió, y las solicitudes concurrentes pueden escribirse en cualquier orden, así que una escritura vieja puede llegar última. Envía un guardado por ítem a la vez y, cuando vuelve, envía el estado que el usuario quiere ahora; o haz que el servidor rechace escrituras viejas, con una versión o un número de secuencia del cliente que compare, o con una solicitud condicional (If-Match con un ETag).")],
  [t("A background refetch put the old value back over an optimistic like. Where did the old value come from, and what's the fix?", "Una recarga en segundo plano volvió a poner el valor viejo sobre un like optimista. ¿De dónde salió el valor viejo y cuál es la solución?"),
   t("From a read that ran at the server before the write and landed after the tap: correct when it was read, stale when it arrived. Cancel queries in flight for that key when the save starts, don't apply reads while it's in flight, and refetch once it settles. When to refetch in the background at all is the subject of lesson 57, Stale-while-revalidate.",
     "De una lectura que corrió en el servidor antes de la escritura y aterrizó después del toque: correcta cuando se leyó, vieja cuando llegó. Cancela las consultas en vuelo de esa clave cuando empieza el guardado, no apliques lecturas mientras está en vuelo y vuelve a leer cuando termina. Cuándo recargar en segundo plano es el tema de la lección 57, Stale-while-revalidate.")],
  [t("A like times out. Should the client retry before rolling back, and what makes the retry safe?", "Un like agota el tiempo de espera. ¿Debería el cliente reintentar antes de revertir, y qué hace seguro el reintento?"),
   t("A timeout doesn't say whether the write happened. Retrying \"set liked = true\" is safe because sending it twice ends in the same state; retrying a toggle or an increment isn't, since it may apply twice. Send the final state, or attach an idempotency key so the server can recognise the retry (lesson 25). Retries also keep the optimistic value up longer: if they all fail, the rollback arrives later still.",
     "Un timeout no dice si la escritura ocurrió. Reintentar \"poner liked = true\" es seguro porque enviarlo dos veces termina en el mismo estado; reintentar un toggle o un incremento no lo es, porque puede aplicarse dos veces. Envía el estado final, o agrega una clave de idempotencia para que el servidor reconozca el reintento (lección 25). Los reintentos además mantienen más tiempo el valor optimista: si todos fallan, el rollback llega todavía más tarde.")],
  [t("Where would you not show an optimistic result, and what would you show instead?", "¿Dónde no mostrarías un resultado optimista y qué mostrarías en su lugar?"),
   t("Where a failure is likely or expensive: payments, bookings, deleting without undo, a username or coupon the server may reject, or results only the server can compute (a price, an assigned ID). Show the pending state instead (a disabled button with a spinner, a \"Sending…\" mark on the message) and the real result when it comes. A middle way for messages: show them at once but marked as pending, keep them in an outbox and retry, so the user can see which ones haven't landed.",
     "Donde un fallo es probable o caro: pagos, reservas, borrar sin deshacer, un nombre de usuario o cupón que el servidor puede rechazar, o resultados que solo el servidor puede calcular (un precio, un ID asignado). Muestra el estado pendiente (un botón deshabilitado con un indicador de carga, una marca \"Enviando…\" en el mensaje) y el resultado real cuando llegue. Un punto medio para mensajes: mostrarlos de inmediato pero marcados como pendientes, guardarlos en una bandeja de salida y reintentar, para que el usuario vea cuáles no llegaron.")],
];

export default defineLesson({
  title: t("Optimistic UI Workbench", "Banco de trabajo: UI optimista"),
  eyebrow: t("Systems lesson 58 · Optimistic UI & rollback", "Lección de sistemas 58 · UI optimista y rollback"),
  lede: t("An optimistic update shows the result of a tap before the server has said yes, then reconciles when the answer arrives. It feels instant, but a failure has to be rolled back where the user can see it, and answers that arrive out of order can quietly undo what the user asked for. This lesson turns it into a front counter with couriers to a records office: watch it, predict what breaks it, then explain it back.",
    "Una actualización optimista muestra el resultado de un toque antes de que el servidor diga que sí, y después concilia cuando llega la respuesta. Se siente instantánea, pero un fallo hay que revertirlo donde el usuario lo vea, y las respuestas que llegan desordenadas pueden deshacer en silencio lo que el usuario pidió. Esta lección la convierte en un mostrador con mensajeros que van a una oficina de registros: mírala, predice qué la rompe y después explícala."),
  machine: {
    intro: t("Every tap on the like button sends a courier to the records office with a slip: lit means like, dark means unlike. In optimistic mode the screen flips on the tap; in pessimistic mode it waits for the courier to come back. Make saves fail, change how answers are reconciled, turn on a refetch, or tap yourself.",
      "Cada toque en el botón de like manda un mensajero a la oficina de registros con un papel: encendido significa like, oscuro significa quitar el like. En modo optimista la pantalla cambia con el toque; en modo pesimista espera a que vuelva el mensajero. Haz que fallen guardados, cambia cómo se concilian las respuestas, activa una recarga o toca tú."),
    plate: {
      title: t("Front counter", "Mostrador"),
      keys: [
        { mark: "lit", label: t("Liked: your last tap, the screen, the server's record, a courier's slip", "Con like: tu último toque, la pantalla, el registro del servidor, el papel de un mensajero") },
        { mark: "raised", label: t("Couriers: saves (#n) and refetches (GET), out on the left lane, back on the right", "Mensajeros: guardados (#n) y recargas (GET), de ida por el carril izquierdo, de vuelta por el derecho") },
        { mark: "flat", label: t("The walkway between the app and the server", "El pasillo entre la app y el servidor") },
      ],
      caption: t(
        "Played at a quarter of real speed (change it under Speed). A save walks out in " + range(OUT) + ", the server works " + range(WORK) + " (one save in " + SLOW_EVERY + " takes " + SLOW_RANGE + " more), and the answer walks back in " + range(BACK) + ". The server's board changes when it writes; the screen changes when the app decides. ERR is a refused save. The lamp lights when nothing is in flight and the screen disagrees with the server. Counters: taps, failures the user was told about (NOT SAVED), failures the user had already moved on from (TOO LATE), answers and reads the app ignored, and the server's writes.",
        "Se reproduce a un cuarto de la velocidad real (cámbiala en Velocidad). Un guardado va en " + range(OUT) + ", el servidor trabaja " + range(WORK) + " (uno de cada " + SLOW_EVERY + " tarda " + SLOW_RANGE + " más) y la respuesta vuelve en " + range(BACK) + ". El tablero del servidor cambia cuando escribe; la pantalla cambia cuando la app decide. ERR es un guardado rechazado. La lámpara se enciende cuando no hay nada en vuelo y la pantalla no coincide con el servidor. Contadores: toques, fallos que se le avisaron al usuario (NO GUARDADOS), fallos de los que el usuario ya había seguido de largo (TARDE), respuestas y lecturas que la app ignoró, y las escrituras del servidor.",
      ),
      stage: { "data-counter-desk": "" },
      label: t("Optimistic UI simulation. Space pauses or resumes.", "Simulación de UI optimista. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["taps", t("Taps", "Toques")],
      ["wait", t("Tap → screen", "Toque → pantalla"), "–"],
      ["told", t("Failures told", "Fallos avisados")],
      ["late", t("Moved on first", "Siguió antes")],
      ["stale", t("Old value shown", "Valor viejo mostrado")],
      ["sync", t("Out of sync", "Desfase"), "0.0 s"],
    ],
    controls: [
      { seg: "ui", label: "UI", options: [["pess", t("Pessimistic", "Pesimista")], ["opt", t("Optimistic", "Optimista")]], value: "opt" },
      { seg: "onFail", label: t("On failure", "Si falla"), options: [["rollback", t("Roll back and tell", "Revertir y avisar")], ["none", t("Do nothing", "No hacer nada")]], value: "rollback" },
      { seg: "order", label: t("Answers", "Respuestas"), options: [["all", t("Apply every one", "Aplicar todas")], ["latest", t("Ignore stale", "Ignorar viejas")], ["serial", t("One in flight", "Una en vuelo")]], value: "all" },
      { seg: "reads", label: t("Refetch", "Recarga"), options: [["off", t("Off", "Apagada")], ["poll", t("Every 1 s", "Cada 1 s")], ["guard", t("Every 1 s, held during saves", "Cada 1 s, retenida al guardar")]], value: "off" },
      { seg: "fail", label: t("Failures", "Fallos"), options: [[0, "0%"], [0.1, "10%"], [0.3, "30%"]], value: 0.1 },
      { seg: "server", label: t("Server", "Servidor"), options: [["steady", t("Steady", "Estable")], ["tail", t("Slow tail", "Cola lenta")]], value: "tail" },
      { seg: "taps", label: t("User", "Usuario"), options: [["single", t("Single taps", "Toques sueltos")], ["double", t("Quick doubles", "Dobles rápidos")], ["mixed", t("Mixed", "Mezclados")]], value: "mixed" },
      { speed: true, options: [[0.1, "1/10"], [0.25, "1/4"], [1, t("Real time", "Tiempo real")]], value: 0.25 },
      { actions: [["tap", t("Tap like", "Tocar like"), { primary: true }], ["double", t("Double tap", "Doble toque")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. The user taps on their own; Tap like adds your taps. Out of sync counts the seconds nothing was in flight and the screen still disagreed with the server.",
      "Cambiar un ajuste reinicia la corrida. El usuario toca por su cuenta; Tocar like agrega tus toques. Desfase cuenta los segundos en que no había nada en vuelo y la pantalla igual no coincidía con el servidor."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of fifteen minutes each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de quince minutos cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The rollback pattern follows TanStack Query's guide to optimistic updates (onMutate, onError, onSettled).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. El patrón de rollback sigue la guía de actualizaciones optimistas de TanStack Query (onMutate, onError, onSettled).`),
  css: LIT_FILL_CSS + `
[data-slip-text]{font-weight:600}
`,
  data: { P, G: GEOMETRY, COURIER_SVG: courierSvg(), SLIP_SVG: slipSvg() },
});
