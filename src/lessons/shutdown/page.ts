// @ts-nocheck: content in the style of the other lessons
// Systems lesson 77 · Graceful shutdown: a shop at closing time, with a doorman whose list runs late.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, walkerSvg, ticketSvg, P, GEOMETRY } from "./figure";
import { runExit, runSleep, runSlow, runGrace, runKeep, RATE, WALK, ROUTER, SHORT, EXPORT, REGULARS, SEEDS, OPEN_FOR } from "./sim";

// Experiment results, computed at build time from the same model the page runs (one shutdown per seed).
const R = { exit: runExit(), sleep: runSleep(), slow: runSlow(), grace: runGrace(), keep: runKeep() };

const s1 = (x) => one(x) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const range = (r) => r[0] + "–" + r[1] + " s";
const N = SEEDS.length;

// What each card shows after a run.
const RUNS = {
  exit: () => {
    const { exit, stop } = R.exit, mc = top(exit.cut, exit.refused);
    return {
      verdict: t("Exit at once: " + one(exit.cut) + " requests cut per shutdown, and " + one(exit.refused) + " more refused afterwards. Stop accepting and finish: none cut; B finished the " + one(stop.inflight) + " it had in progress and was gone " + s1(stop.took) + " after the delete, but " + one(stop.refused) + " were still refused.",
        "Salir de inmediato: " + one(exit.cut) + " solicitudes cortadas por apagado, y " + one(exit.refused) + " más rechazadas después. Dejar de aceptar y terminar: ninguna cortada; B completó las " + one(stop.inflight) + " que tenía en curso y terminó " + s1(stop.took) + " después del borrado, pero igual hubo " + one(stop.refused) + " rechazadas."),
      groups: [
        { title: t("Cut per shutdown", "Cortadas por apagado"), bars: [[t("Exit at once", "Salir de inmediato"), exit.cut / mc, one(exit.cut), true], [t("Stop accepting, finish", "Dejar de aceptar, terminar"), stop.cut / mc, one(stop.cut)]] },
        { title: t("Refused per shutdown", "Rechazadas por apagado"), bars: [[t("Exit at once", "Salir de inmediato"), exit.refused / mc, one(exit.refused)], [t("Stop accepting, finish", "Dejar de aceptar, terminar"), stop.refused / mc, one(stop.refused)]] },
      ],
    };
  },
  sleep: () => {
    const { none, five } = R.sleep, m = top(none.refused), mt = top(five.took);
    return {
      verdict: t("No sleep: " + one(none.refused) + " refused per shutdown, all of them customers the doorman routed in the " + s1(none.d) + ", on average, before he heard. A 5 s sleep: " + one(five.refused) + " refused, and B was gone " + s1(five.took) + " after the delete instead of " + s1(none.took) + ".",
        "Sin pausa: " + one(none.refused) + " rechazadas por apagado, todas de clientes que el portero mandó en los " + s1(none.d) + ", en promedio, antes de enterarse. Con una pausa de 5 s: " + one(five.refused) + " rechazadas, y B terminó " + s1(five.took) + " después del borrado en lugar de " + s1(none.took) + "."),
      groups: [
        { title: t("Refused per shutdown", "Rechazadas por apagado"), bars: [[t("No sleep", "Sin pausa"), none.refused / m, one(none.refused), true], [t("5 s sleep", "Pausa de 5 s"), five.refused / m, one(five.refused)]] },
        { title: t("Seconds from the delete until B was gone", "Segundos del borrado a que B terminó"), bars: [[t("No sleep", "Sin pausa"), none.took / mt, s1(none.took)], [t("5 s sleep", "Pausa de 5 s"), five.took / mt, s1(five.took), true]] },
      ],
    };
  },
  slow: () => {
    const { five, fifteen } = R.slow, m = top(five.refused), mt = top(fifteen.took);
    return {
      verdict: t("Sleep 5 s: " + one(five.refused) + " refused per shutdown; the balancer heard " + s1(five.d) + " after the delete on average, and B stopped listening at 5 s. Sleep 15 s: " + one(fifteen.refused) + " refused, and B was gone " + s1(fifteen.took) + " after the delete. " + (five.cut + fifteen.cut === 0 ? "Nothing was cut either way: B still finished what it had." : one(five.cut) + " and " + one(fifteen.cut) + " were cut."),
        "Pausa de 5 s: " + one(five.refused) + " rechazadas por apagado; el balanceador se enteró " + s1(five.d) + " después del borrado en promedio, y B dejó de escuchar a los 5 s. Pausa de 15 s: " + one(fifteen.refused) + " rechazadas, y B terminó " + s1(fifteen.took) + " después del borrado. " + (five.cut + fifteen.cut === 0 ? "En ningún caso se cortó nada: B igual terminó lo que tenía." : "Se cortaron " + one(five.cut) + " y " + one(fifteen.cut) + ".")),
      groups: [
        { title: t("Refused per shutdown", "Rechazadas por apagado"), bars: [[t("5 s sleep", "Pausa de 5 s"), five.refused / m, one(five.refused), true], [t("15 s sleep", "Pausa de 15 s"), fifteen.refused / m, one(fifteen.refused)]] },
        { title: t("Seconds from the delete until B was gone", "Segundos del borrado a que B terminó"), bars: [[t("5 s sleep", "Pausa de 5 s"), five.took / mt, s1(five.took)], [t("15 s sleep", "Pausa de 15 s"), fifteen.took / mt, s1(fifteen.took), true]] },
      ],
    };
  },
  grace: () => {
    const { g30, g60 } = R.grace, m = top(g30.exports), mt = top(g60.took);
    return {
      verdict: t("Grace 30 s: SIGKILL came in " + pct(g30.killedRun) + " of the runs and cut " + one(g30.killed) + " exports per shutdown on average, of the " + one(g30.exports) + " in progress at the delete; B was gone " + s1(g30.took) + " after the delete on average. Grace 60 s: " + one(g60.killed) + " cut, gone after " + s1(g60.took) + ".",
        "Gracia de 30 s: SIGKILL llegó en el " + pct(g30.killedRun) + " de las ejecuciones y cortó " + one(g30.killed) + " exportaciones por apagado en promedio, de las " + one(g30.exports) + " en curso al borrar; B terminó " + s1(g30.took) + " después del borrado en promedio. Gracia de 60 s: " + one(g60.killed) + " cortadas, terminó a los " + s1(g60.took) + "."),
      groups: [
        { title: t("Exports cut per shutdown", "Exportaciones cortadas por apagado"), bars: [[t("In progress at the delete", "En curso al borrar"), g30.exports / m, one(g30.exports)], [t("Cut, 30 s grace", "Cortadas, gracia de 30 s"), g30.killed / m, one(g30.killed), true], [t("Cut, 60 s grace", "Cortadas, gracia de 60 s"), g60.killed / m, one(g60.killed)]] },
        { title: t("Seconds from the delete until B was gone", "Segundos del borrado a que B terminó"), bars: [[t("30 s grace", "Gracia de 30 s"), g30.took / mt, s1(g30.took)], [t("60 s grace", "Gracia de 60 s"), g60.took / mt, s1(g60.took)]] },
      ],
    };
  },
  keep: () => {
    const { stop, drain } = R.keep, m = top(stop.took), mc = top(stop.cut);
    return {
      verdict: t("Stop accepting and finish: B served " + one(stop.served) + " requests on its " + REGULARS + " connections after the delete and was still busy when SIGKILL came, in " + pct(stop.killedRun) + " of the runs; it was gone " + s1(stop.took) + " after the delete on average, with " + one(stop.cut) + " in progress cut. Closing the connections too: gone " + s1(drain.took) + " after the delete, " + one(drain.cut) + " cut and " + one(drain.refused) + " refused.",
        "Dejar de aceptar y terminar: B atendió " + one(stop.served) + " solicitudes en sus " + REGULARS + " conexiones después del borrado y seguía ocupado cuando llegó SIGKILL, en el " + pct(stop.killedRun) + " de las ejecuciones; terminó " + s1(stop.took) + " después del borrado en promedio, con " + one(stop.cut) + " en curso cortadas. Cerrando también las conexiones: terminó " + s1(drain.took) + " después del borrado, con " + one(drain.cut) + " cortadas y " + one(drain.refused) + " rechazadas."),
      groups: [
        { title: t("Seconds from the delete until B was gone", "Segundos del borrado a que B terminó"), bars: [[t("Stop accepting, finish", "Dejar de aceptar, terminar"), stop.took / m, s1(stop.took), true], [t("Finish, close connections", "Terminar, cerrar conexiones"), drain.took / m, s1(drain.took)]] },
        { title: t("Cut per shutdown", "Cortadas por apagado"), bars: [[t("Stop accepting, finish", "Dejar de aceptar, terminar"), stop.cut / mc, one(stop.cut), true], [t("Finish, close connections", "Terminar, cerrar conexiones"), drain.cut / mc, one(drain.cut)]] },
      ],
    };
  },
};

const BASE = { onTerm: "stop", preStop: "0", grace: "30", work: "short", conns: "new", router: "fast" };

const EXPERIMENTS = [
  {
    id: "exit",
    title: t("Exit on SIGTERM", "Salir con SIGTERM"),
    change: t("On SIGTERM: exit at once vs stop accepting and finish · no preStop sleep · short requests, a new connection for each",
      "Con SIGTERM: salir de inmediato vs dejar de aceptar y terminar · sin pausa preStop · solicitudes cortas, una conexión nueva para cada una"),
    question: t("Exiting the moment SIGTERM arrives, what happens to the requests B is in the middle of?", "Si sale en cuanto llega SIGTERM, ¿qué pasa con las solicitudes que B tiene a medias?"),
    options: [
      t("Kubernetes holds SIGTERM back until they're done", "Kubernetes retiene SIGTERM hasta que terminen"),
      t("They're cut off, and their clients get errors", "Se cortan, y sus clientes reciben errores"),
      t("The doorman sends them again to another pod", "El portero las vuelve a mandar a otro pod"),
    ],
    answer: 1,
    why: t(
      "Kubernetes waits for nothing before SIGTERM but the preStop hook, and SIGTERM is only a request: what happens next is up to the process. One that exits on it (the default for a process with no handler, unless it runs as PID 1 in its container) drops every connection it holds, and each request in progress ends in a reset, or a 502 from the proxy in front. A proxy may retry a connection that was refused, but rarely a request cut after it started, and not a POST unless told to: nginx, for one, passes a request to the next server only if nothing has been sent to the client yet. Catching SIGTERM, then stopping accepting and finishing what's in progress, removes the cuts. It doesn't remove the refusals: those come from the doorman, not from the app (experiment 2).",
      "Kubernetes no espera nada antes de SIGTERM salvo el hook preStop, y SIGTERM es solo un pedido: lo que pasa después depende del proceso. Uno que sale al recibirlo (lo que pasa por defecto con un proceso sin handler, salvo que sea el PID 1 de su contenedor) suelta todas sus conexiones, y cada solicitud en curso termina en un reset, o en un 502 del proxy de adelante. Un proxy puede reintentar una conexión rechazada, pero rara vez una solicitud cortada después de empezar, y no un POST salvo que se lo indiques: nginx, por ejemplo, pasa una solicitud al siguiente servidor solo si todavía no le envió nada al cliente. Atrapar SIGTERM, y después dejar de aceptar y terminar lo que está en curso, elimina los cortes. No elimina las rechazadas: esas vienen del portero, no de la app (experimento 2).",
    ),
    watch: { ...BASE, onTerm: "exit" },
  },
  {
    id: "sleep",
    title: t("A sleep before SIGTERM", "Una pausa antes de SIGTERM"),
    change: t("On SIGTERM: stop accepting and finish · preStop sleep: none vs 5 s · the news of the delete takes " + range(ROUTER.fast) + " to reach the doorman",
      "Con SIGTERM: dejar de aceptar y terminar · pausa preStop: ninguna vs 5 s · la noticia del borrado tarda " + range(ROUTER.fast) + " en llegar al portero"),
    question: t("Finishing what's in progress still leaves requests refused. What does a 5 s preStop sleep change?", "Terminar lo que está en curso igual deja solicitudes rechazadas. ¿Qué cambia una pausa preStop de 5 s?"),
    options: [
      t("Nothing: B left the endpoint list at the delete", "Nada: B salió de la lista de endpoints al borrarlo"),
      t("None refused: the doorman hears before SIGTERM", "Ninguna rechazada: el portero se entera antes de SIGTERM"),
      t("The same refusals, they just come 5 s later", "Las mismas rechazadas, solo que llegan 5 s después"),
    ],
    answer: 1,
    why: t(
      "Deleting a pod starts two things at once, and neither waits for the other: the kubelet runs the preStop hook and then sends SIGTERM, while the control plane takes the pod off its endpoints, a change every router (kube-proxy on each node, an ingress, a cloud load balancer) applies in its own time. With no sleep, B closes its listener at once while the doorman still sends it a third of the new customers, and each one is refused. The sleep keeps the app serving, unaware, until the routers have caught up; by SIGTERM no new traffic is coming. It costs only time: here B took " + one(R.sleep.five.took - R.sleep.none.took) + " s longer to go, and a rollout pays that for every pod. Kubernetes has a built-in sleep action for the preStop hook (on by default since 1.30, stable in 1.34), so the image doesn't need a sleep binary; on older clusters an exec hook that runs sleep, or a delay in the app's own SIGTERM handler, does the same.",
      "Borrar un pod empieza dos cosas a la vez, y ninguna espera a la otra: el kubelet ejecuta el hook preStop y después envía SIGTERM, mientras el plano de control saca al pod de sus endpoints, un cambio que cada router (kube-proxy en cada nodo, un ingress, un balanceador de carga en la nube) aplica a su propio ritmo. Sin pausa, B cierra su listener de inmediato mientras el portero todavía le manda un tercio de los clientes nuevos, y cada uno es rechazado. La pausa mantiene a la app atendiendo, sin saber nada, hasta que los routers se ponen al día; para SIGTERM ya no llega tráfico nuevo. Solo cuesta tiempo: aquí B tardó " + one(R.sleep.five.took - R.sleep.none.took) + " s más en irse, y un despliegue lo paga por cada pod. Kubernetes tiene una acción sleep integrada para el hook preStop (activada por defecto desde 1.30, estable en 1.34), así que la imagen no necesita un binario sleep; en clústeres más viejos, un hook exec que ejecute sleep, o una espera en el propio handler de SIGTERM de la app, hace lo mismo.",
    ),
    watch: { ...BASE, preStop: "5" },
  },
  {
    id: "slow",
    title: t("A slower load balancer", "Un balanceador más lento"),
    change: t("The news now takes " + range(ROUTER.slow) + " to reach the doorman, as with a load balancer outside the cluster · stop accepting and finish · preStop sleep 5 s vs 15 s",
      "La noticia ahora tarda " + range(ROUTER.slow) + " en llegar al portero, como con un balanceador fuera del clúster · dejar de aceptar y terminar · pausa preStop de 5 s vs 15 s"),
    question: t("The balancer hears about the delete after " + range(ROUTER.slow) + ". Is the 5 s sleep still enough?", "El balanceador se entera del borrado después de " + range(ROUTER.slow) + ". ¿Sigue alcanzando la pausa de 5 s?"),
    options: [
      t("Yes: by SIGTERM the endpoint is already gone", "Sí: para SIGTERM el endpoint ya no está"),
      t("No: refusals come back until the balancer hears", "No: vuelven las rechazadas hasta que el balanceador se entera"),
      t("No, and the requests in progress get cut too", "No, y además se cortan las solicitudes en curso"),
    ],
    answer: 1,
    why: t(
      "The sleep has to outlast the slowest router, not the typical one. kube-proxy usually applies an endpoint change within a second or two, but a load balancer outside the cluster, updated by a controller that watches the endpoints, can take several seconds or more, and every connection it sends once B has stopped listening is refused. B still finishes what it has, so nothing is cut: the errors are all at the door. Measure the delay rather than guess it: delete a pod under load and watch the edge for 502s and refused connections. A longer sleep is cheap for one pod, but it adds to every pod of every rollout, and it is spent out of the grace period (experiment 4).",
      "La pausa tiene que durar más que el router más lento, no que el típico. kube-proxy suele aplicar un cambio de endpoints en uno o dos segundos, pero un balanceador fuera del clúster, actualizado por un controlador que observa los endpoints, puede tardar varios segundos o más, y cada conexión que manda después de que B dejó de escuchar es rechazada. B igual termina lo que tiene, así que nada se corta: todos los errores están en la puerta. Mide el retraso en lugar de adivinarlo: borra un pod con carga y busca 502 y conexiones rechazadas en el borde. Una pausa más larga es barata para un pod, pero se suma a cada pod de cada despliegue, y se descuenta del período de gracia (experimento 4).",
    ),
    watch: { ...BASE, preStop: "5", router: "slow" },
  },
  {
    id: "grace",
    title: t("Exports and the grace period", "Exportaciones y el período de gracia"),
    change: t("1 request in " + Math.round(1 / EXPORT.share) + " is an export of " + range(EXPORT.len) + " · preStop sleep 15 s · stop accepting and finish · grace period 30 s vs 60 s",
      "1 de cada " + Math.round(1 / EXPORT.share) + " solicitudes es una exportación de " + range(EXPORT.len) + " · pausa preStop de 15 s · dejar de aceptar y terminar · período de gracia de 30 s vs 60 s"),
    question: t("With the default 30 s grace and a 15 s sleep, how long does an export in progress get to finish?", "Con la gracia por defecto de 30 s y una pausa de 15 s, ¿cuánto tiempo tiene una exportación en curso para terminar?"),
    options: [
      t("As long as it needs: Kubernetes waits for it", "Lo que necesite: Kubernetes la espera"),
      t("30 s after SIGTERM, so 45 s after the delete", "30 s después de SIGTERM, o sea 45 s después del borrado"),
      t("Until 30 s after the delete, sleep included", "Hasta 30 s después del borrado, pausa incluida"),
    ],
    answer: 2,
    why: t(
      "The grace period (terminationGracePeriodSeconds, 30 s unless you set it) starts at the delete, not at SIGTERM, and the preStop hook runs inside it: a 15 s sleep leaves the app 15 s between SIGTERM and SIGKILL. Requests keep running through the sleep, so what counts is the time since the delete: an export that started just before it may need 50 s, and at 30 s SIGKILL ends it, with no handler to run. Set the grace period to cover the sleep plus your longest request, or make long work survive a restart: hand exports to a job queue, or let the client resume them. If the hook itself is still running when the grace period ends, the kubelet gives it 2 s more, once, and then kills the container.",
      "El período de gracia (terminationGracePeriodSeconds, 30 s salvo que lo cambies) empieza con el borrado, no con SIGTERM, y el hook preStop corre dentro de él: una pausa de 15 s le deja a la app 15 s entre SIGTERM y SIGKILL. Las solicitudes siguen corriendo durante la pausa, así que lo que cuenta es el tiempo desde el borrado: una exportación que empezó justo antes puede necesitar 50 s, y a los 30 s SIGKILL la termina, sin ningún handler que se ejecute. Configura el período de gracia para que cubra la pausa más tu solicitud más larga, o haz que el trabajo largo sobreviva a un reinicio: pasa las exportaciones a una cola de trabajos, o deja que el cliente las retome. Si el propio hook sigue corriendo cuando termina el período de gracia, el kubelet le da 2 s más, una sola vez, y después mata el contenedor.",
    ),
    watch: { ...BASE, preStop: "15", work: "exports", speed: 3 },
  },
  {
    id: "keep",
    title: t("Keep-alive connections", "Conexiones keep-alive"),
    change: t("Clients keep their connections open and send request after request on them (keep-alive); B holds " + REGULARS + " · preStop sleep 5 s · on SIGTERM: stop accepting and finish vs also close the connections",
      "Los clientes mantienen sus conexiones abiertas y mandan solicitud tras solicitud por ellas (keep-alive); B tiene " + REGULARS + " · pausa preStop de 5 s · con SIGTERM: dejar de aceptar y terminar vs además cerrar las conexiones"),
    question: t("With keep-alive clients, how does stop-and-finish go after the 5 s sleep?", "Con clientes keep-alive, ¿cómo sale dejar de aceptar y terminar después de la pausa de 5 s?"),
    options: [
      t("Cleanly: the doorman has moved new traffic away", "Limpio: el portero ya desvió el tráfico nuevo"),
      t("It waits on open connections until SIGKILL", "Espera a las conexiones abiertas hasta SIGKILL"),
      t("The keep-alive clients are refused at SIGTERM", "A los clientes keep-alive los rechazan en SIGTERM"),
    ],
    answer: 1,
    why: t(
      "The doorman only decides when a client opens a connection, and a keep-alive client doesn't open one: it keeps sending on the one it has, so taking B off every list changes nothing for it. A server that stops accepting and waits for its open connections to end is waiting for clients with no reason to leave, until SIGKILL cuts whatever is in progress, and the pod always takes the whole grace period to go. The server has to end them: close idle connections at once, and answer the last request on each busy one with Connection: close (HTTP/1.1) or send GOAWAY (HTTP/2), so the client reconnects through the doorman, who sends it elsewhere. Go's http.Server.Shutdown works this way: it closes the listeners, then the idle connections, then each active one once its request is done. It leaves hijacked connections such as WebSockets alone; those need their own goodbye.",
      "El portero solo decide cuando un cliente abre una conexión, y un cliente keep-alive no abre ninguna: sigue mandando por la que tiene, así que sacar a B de todas las listas no cambia nada para él. Un servidor que deja de aceptar y espera a que terminen sus conexiones abiertas está esperando a clientes que no tienen por qué irse, hasta que SIGKILL corta lo que esté en curso, y el pod siempre tarda todo el período de gracia en irse. El servidor tiene que terminarlas: cerrar de inmediato las conexiones ociosas, y responder la última solicitud de cada conexión ocupada con Connection: close (HTTP/1.1) o enviar GOAWAY (HTTP/2), para que el cliente vuelva a conectarse por el portero, que lo manda a otro lado. http.Server.Shutdown de Go funciona así: cierra los listeners, después las conexiones ociosas y después cada conexión activa en cuanto termina su solicitud. No toca las conexiones secuestradas (hijacked), como los WebSockets; esas necesitan su propia despedida.",
    ),
    watch: { ...BASE, preStop: "5", conns: "keep", speed: 3 },
  },
];

const QUESTIONS = [
  [t("Kubernetes deletes a pod behind a Service. What happens, in order, and what waits for what?", "Kubernetes borra un pod que está detrás de un Service. ¿Qué pasa, en orden, y qué espera a qué?"),
    t("The pod gets a deletion timestamp and two things start in parallel. The control plane marks it terminating and not ready in its EndpointSlices, and every router (kube-proxy, ingress controllers, external load balancers) stops sending it new connections whenever it applies that change. Meanwhile the kubelet runs the preStop hook, then sends SIGTERM to the containers; when the grace period runs out, counted from the start, it sends SIGKILL. Nothing in that sequence waits for the routers, which is why a pod that stops listening at SIGTERM still gets connections.",
      "El pod recibe una marca de borrado y empiezan dos cosas en paralelo. El plano de control lo marca como terminando y no listo en sus EndpointSlices, y cada router (kube-proxy, los controladores de ingress, los balanceadores externos) deja de mandarle conexiones nuevas cuando aplica ese cambio. Mientras tanto, el kubelet ejecuta el hook preStop y después envía SIGTERM a los contenedores; cuando se acaba el período de gracia, contado desde el principio, envía SIGKILL. Nada en esa secuencia espera a los routers; por eso un pod que deja de escuchar con SIGTERM igual recibe conexiones.")],
  [t("Someone suggests failing the readiness probe as soon as SIGTERM arrives, instead of a preStop sleep. Does that help?", "Alguien propone hacer fallar la sonda de readiness apenas llega SIGTERM, en lugar de una pausa preStop. ¿Sirve?"),
    t("Not by itself. A terminating pod is already taken out of the ready endpoints at the delete, so a failing probe adds nothing, and the probe only counts after periodSeconds × failureThreshold anyway. The refusals come from the time routers take to apply the change, and only serving through that time fixes them: keep accepting for a few seconds after SIGTERM (or sleep in preStop), then stop. Readiness is for a pod that is up but can't serve right now (lesson 23, Health checks).",
      "No por sí sola. Un pod que está terminando ya sale de los endpoints listos al borrarlo, así que una sonda que falla no agrega nada, y además la sonda solo cuenta después de periodSeconds × failureThreshold. Las rechazadas vienen del tiempo que tardan los routers en aplicar el cambio, y solo seguir atendiendo durante ese tiempo las evita: seguir aceptando unos segundos después de SIGTERM (o una pausa en preStop) y después parar. Readiness es para un pod que está arriba pero no puede atender en este momento (lección 23, Chequeos de salud).")],
  [t("Your pods always take exactly 30 s to terminate. What would you look for?", "Tus pods siempre tardan exactamente 30 s en terminar. ¿Qué buscarías?"),
    t("Something that never finishes, so SIGKILL ends it at the grace period. Often the app never sees SIGTERM: a shell-form CMD runs the app under /bin/sh, which may not pass the signal on; and a process running as PID 1 in a container ignores SIGTERM unless it installs a handler. Use the exec form, or a small init such as tini. Otherwise: a server waiting on keep-alive connections that never close (experiment 5), a preStop hook that hangs, or a request that outlives the grace period. It shows as 30 s pod deletions and rollouts that crawl.",
      "Algo que nunca termina, así que SIGKILL lo corta al final del período de gracia. Muchas veces la app nunca ve SIGTERM: un CMD en forma de shell ejecuta la app debajo de /bin/sh, que puede no reenviar la señal; y un proceso que corre como PID 1 en un contenedor ignora SIGTERM salvo que instale un handler. Usa la forma exec, o un init pequeño como tini. Si no: un servidor que espera conexiones keep-alive que nunca se cierran (experimento 5), un hook preStop que se cuelga o una solicitud que dura más que el período de gracia. Se ve como borrados de pods de 30 s y despliegues que avanzan a paso de tortuga.")],
  [t("How would you choose the preStop sleep and terminationGracePeriodSeconds for a service?", "¿Cómo elegirías la pausa preStop y terminationGracePeriodSeconds para un servicio?"),
    t("The sleep from measurement: how long the slowest router in front of you takes to stop sending to a deleted pod, plus a margin; a few seconds in-cluster, longer behind an external load balancer. The grace period from the sleep plus the longest request you're willing to finish plus any shutdown work (flushing buffers, closing pools), because it all comes out of one budget that starts at the delete. Then check the cost: every pod of a rollout pays the sleep, which you can offset with more surge (lesson 10, Rolling deploys).",
      "La pausa, a partir de una medición: cuánto tarda el router más lento que tienes adelante en dejar de mandar a un pod borrado, más un margen; unos segundos dentro del clúster, más detrás de un balanceador externo. El período de gracia, a partir de la pausa más la solicitud más larga que estás dispuesto a terminar más el trabajo de apagado (vaciar búferes, cerrar pools), porque todo sale de un solo presupuesto que empieza con el borrado. Después revisa el costo: cada pod de un despliegue paga la pausa, lo que puedes compensar con más surge (lección 10, Despliegues graduales).")],
  [t("A worker that reads from a queue gets SIGTERM. What does a graceful shutdown look like for it?", "Un trabajador que lee de una cola recibe SIGTERM. ¿Cómo es un apagado ordenado para él?"),
    t("The same idea without a doorman: stop fetching new messages, finish the ones in hand and ack them within the grace period, and leave unfinished ones unacked so the broker delivers them again (lesson 69, Delivery Guarantees). Leaving a consumer group cleanly, instead of vanishing, lets the group hand the partitions over at once rather than waiting for a session timeout (lesson 71, Consumer Groups). A job that can't finish in time should save its progress or be safe to run again.",
      "La misma idea sin portero: dejar de pedir mensajes nuevos, terminar los que tiene en mano y confirmarlos (ack) dentro del período de gracia, y dejar sin confirmar los que no terminó para que el broker los vuelva a entregar (lección 69, Garantías de entrega). Salir del grupo de consumidores de forma ordenada, en lugar de desaparecer, permite que el grupo reparta las particiones de inmediato en lugar de esperar un tiempo límite de sesión (lección 71, Grupos de consumidores). Un trabajo que no alcanza a terminar debería guardar su avance o poder ejecutarse otra vez sin problemas.")],
  [t("Your app drains correctly, yet clients still see a burst of errors on every rollout. Where else could they come from?", "Tu app hace el vaciado correctamente, pero los clientes igual ven una ráfaga de errores en cada despliegue. ¿De dónde más pueden venir?"),
    t("From the clients' side of the connection. A pool that reuses a keep-alive connection can send a request at the very moment the server closes it as idle, and gets a reset: clients should retry that, but only for idempotent requests. A client that cached DNS or a list of pod IPs keeps dialing the old pod. And the new pods: if they report ready before they can serve, the errors come from the pods coming in, not the ones going out (lesson 10, Rolling deploys). Look at where the errors happen and when: refused connections, resets, or 5xx from the new version.",
      "Del lado de los clientes de la conexión. Un pool que reutiliza una conexión keep-alive puede mandar una solicitud justo cuando el servidor la cierra por ociosa, y recibe un reset: los clientes deberían reintentar eso, pero solo con solicitudes idempotentes. Un cliente que guardó en caché el DNS o una lista de IPs de pods sigue llamando al pod viejo. Y los pods nuevos: si se reportan listos antes de poder atender, los errores vienen de los pods que entran, no de los que salen (lección 10, Despliegues graduales). Mira dónde y cuándo ocurren los errores: conexiones rechazadas, resets o 5xx de la versión nueva.")],
];

export default defineLesson({
  title: t("Graceful Shutdown Workbench", "Banco de trabajo: apagado ordenado"),
  eyebrow: t("Systems lesson 77 · Graceful shutdown", "Lección de sistemas 77 · Apagado ordenado"),
  lede: t("A rolling deploy shuts pods down while traffic still flows. Kubernetes sends SIGTERM without waiting for the routers to stop sending the pod new connections, and SIGKILL a grace period after the delete, so a pod that exits, or just stops listening, the moment it is told drops requests every time. This lesson runs one shop at closing time, with a doorman whose list runs late, clerks finishing their customers and a shutdown clock: watch it, predict what each setting drops, then explain it back.",
    "Un despliegue gradual (rolling deploy) apaga pods mientras el tráfico sigue llegando. Kubernetes envía SIGTERM sin esperar a que los routers dejen de mandarle conexiones nuevas al pod, y SIGKILL un período de gracia después del borrado, así que un pod que sale, o solo deja de escuchar, en cuanto se lo piden pierde solicitudes cada vez. Esta lección usa una tienda a la hora de cierre, con un portero cuya lista va con retraso, empleados que terminan con sus clientes y un reloj del apagado: mírala, predice qué pierde cada ajuste y después explícala."),
  machine: {
    intro: t("Pod B is the shop; pods A and C share the block at the back. The doorman stands for every router in front of the pods and sends each new customer to one of the pods on his list. The deploy deletes B every few seconds and starts a new one when it is gone. Try what B does on SIGTERM, the preStop sleep, the grace period, a slow balancer, long exports and keep-alive connections, and watch the REFUSED and CUT counters.",
      "El pod B es la tienda; los pods A y C comparten el bloque del fondo. El portero representa a todos los routers que hay delante de los pods y manda cada cliente nuevo a uno de los pods de su lista. El despliegue borra B cada pocos segundos y arranca uno nuevo cuando termina. Prueba qué hace B con SIGTERM, la pausa preStop, el período de gracia, un balanceador lento, las exportaciones largas y las conexiones persistentes (keep-alive), y mira los contadores RECHAZADAS y CORTADAS."),
    plate: {
      title: t("Closing time", "Hora de cierre"),
      keys: [
        { mark: "lit", label: t("A refused or cut customer and ticket; B's card on the doorman's list while he still routes to a deleted pod; CLOSING on B's sign; the capsule in the tube; the flag where B was gone", "Un cliente y ticket rechazado o cortado; la tarjeta de B en la lista del portero mientras todavía manda a un pod borrado; CERRANDO en el letrero de B; la cápsula en el tubo; la bandera donde B terminó") },
        { mark: "raised", label: t("Customers (darker: keep-alive clients); a ticket on the counter for every request in progress, taller for an export", "Clientes (más oscuros: clientes keep-alive); un ticket en el mostrador por cada solicitud en curso, más alto si es una exportación") },
        { mark: "flat", label: t("The shutdown clock: 60 s from the delete, with SIGTERM and SIGKILL pins", "El reloj del apagado: 60 s desde el borrado, con clavijas de SIGTERM y SIGKILL") },
      ],
      caption: t(
        "Times are illustrative and round. The doorman sends B a third of the new connections, " + RATE + " a second, and a customer takes " + WALK + " s to walk from him to the door. Requests take " + range(SHORT) + "; with exports, 1 in " + Math.round(1 / EXPORT.share) + " takes " + range(EXPORT.len) + ". When B is deleted, the office drops B's plaque at once, but the capsule takes " + range(ROUTER.fast) + " (" + range(ROUTER.slow) + " for the slow balancer) to reach the doorman's list, and until it does his B card stays up, lit; then it is laid flat. Meanwhile the kubelet runs the preStop sleep, then sends SIGTERM. Once the door is shuttered, a customer who reaches it is refused. When the grace period ends, SIGKILL cuts whatever is still on the counter. On the rail, a capsule mark shows when the doorman heard and a flag when B was gone. Counters: SHUTDOWN S (seconds since the delete), IN PROGRESS, SERVED, REFUSED and CUT.",
        "Los tiempos son ilustrativos y redondos. El portero le manda a B un tercio de las conexiones nuevas, " + RATE + " por segundo, y un cliente tarda " + WALK + " s en caminar desde él hasta la puerta. Las solicitudes tardan " + range(SHORT) + "; con exportaciones, 1 de cada " + Math.round(1 / EXPORT.share) + " tarda " + range(EXPORT.len) + ". Cuando se borra B, la oficina quita la placa de B de inmediato, pero la cápsula tarda " + range(ROUTER.fast) + " (" + range(ROUTER.slow) + " con el balanceador lento) en llegar a la lista del portero, y hasta entonces su tarjeta B sigue de pie, encendida; después queda acostada. Mientras tanto, el kubelet ejecuta la pausa preStop y después envía SIGTERM. Con la persiana de la puerta bajada, un cliente que llega a ella es rechazado. Cuando se acaba el período de gracia, SIGKILL corta lo que siga en el mostrador. En el riel, una marca de cápsula muestra cuándo se enteró el portero y una bandera cuándo terminó B. Contadores: APAGADO S (segundos desde el borrado), EN CURSO, ATENDIDAS, RECHAZADAS y CORTADAS.",
      ),
      stage: { "data-closing-time": "" },
      label: t("Graceful shutdown simulation. Space pauses or resumes.", "Simulación de apagado ordenado. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["inflight", t("In progress", "En curso")],
      ["served", t("Served", "Atendidas")],
      ["refused", t("Refused", "Rechazadas")],
      ["cut", t("Cut", "Cortadas")],
      ["since", t("Since the delete", "Desde el borrado"), "—"],
      ["phase", t("Pod B", "Pod B"), t("Open", "Abierto")],
    ],
    controls: [
      { seg: "onTerm", label: t("On SIGTERM", "Con SIGTERM"), options: [["exit", t("Exit at once", "Salir de inmediato")], ["stop", t("Stop accepting, finish", "Dejar de aceptar, terminar")], ["drain", t("Finish, close connections", "Terminar, cerrar conexiones")]], value: "stop" },
      { seg: "preStop", label: t("preStop sleep", "Pausa preStop"), options: [["0", t("None", "Ninguna")], ["5", "5 s"], ["15", "15 s"]], value: "0" },
      { seg: "grace", label: t("Grace period", "Período de gracia"), options: [["30", "30 s"], ["60", "60 s"]], value: "30" },
      { seg: "router", label: t("Doorman hears in", "El portero se entera en"), options: [["fast", range(ROUTER.fast)], ["slow", range(ROUTER.slow)]], value: "fast" },
      { seg: "work", label: t("Requests", "Solicitudes"), options: [["short", t("Short", "Cortas")], ["exports", t("With exports", "Con exportaciones")]], value: "short" },
      { seg: "conns", label: t("Connections", "Conexiones"), options: [["new", t("New for each request", "Una nueva por solicitud")], ["keep", "Keep-alive"]], value: "new" },
      { speed: true },
      { actions: [["delete", t("Delete pod B", "Borrar el pod B"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Once a new pod B is up, the deploy deletes it again after " + OPEN_FOR + " s; Delete pod B does it now.",
      "Cambiar un ajuste reinicia la ejecución. Cuando hay un pod B nuevo, el despliegue lo vuelve a borrar a los " + OPEN_FOR + " s; Borrar el pod B lo hace ahora."),
  },
  predict: {
    intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, one shutdown in each of " + N + " seeded runs, averaged.",
      "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, un apagado en cada una de " + N + " ejecuciones con semilla fija, promediados."),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  css: `
.sd-door{fill:var(--anatomy-faint);stroke:var(--anatomy-lo);stroke-width:.6}
.iso-stage [data-layer] *{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: { P, G: GEOMETRY, WALKER_SVG: walkerSvg(), TICKET_SVG: ticketSvg() },
});
