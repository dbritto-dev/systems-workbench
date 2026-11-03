// @ts-nocheck: content ported as-is
// Systems lesson 10 · Rolling deploys: a module yard where a gantry crane swaps one module at a time.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, tokenSvg, P, GEOMETRY } from "./figure";
import { averageRollout } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran these
// eight-seed averages in the browser when a card was run; they are deterministic, so the numbers are the same).
const run8 = (o) => {
  const { runs, ...avg } = averageRollout({ warm: 40, window: 110, ...o });
  return avg;
};
const RESULTS = {
  unavail: { base: run8({ load: "high", deploy: false }), a: run8({ load: "high", unavail: 1 }), b: run8({ load: "high", unavail: 3 }) },
  surge: { base: run8({ load: "high", deploy: false }), a: run8({ load: "high", unavail: 1, surge: 0 }), b: run8({ load: "high", unavail: 0, surge: 1 }) },
  probe: { a: run8({ load: "normal" }), b: run8({ load: "normal", probe: false }) },
  bad: { a: run8({ load: "normal", quality: "bad", full: true }), b: run8({ load: "normal", quality: "bad", probe: false, full: true }) },
  format: { a: run8({ load: "normal" }), b: run8({ load: "normal", quality: "incompatible" }) },
};

const EXPERIMENTS = [
  {
    id: "unavail",
    title: t("Take more bays out at once", "Sacar más bahías a la vez"),
    change: t("maxUnavailable 1 → 3 · busy traffic (2 requests/s, six bays serve 3/s)", "maxUnavailable 1 → 3 · tráfico alto (2 solicitudes/s, seis bahías atienden 3/s)"),
    question: t("Half the bays may now be out at the same time. What happens?", "Ahora la mitad de las bahías puede estar fuera al mismo tiempo. ¿Qué pasa?"),
    options: [t("Nothing users notice: the other bays absorb it", "Nada que noten los usuarios: las otras bahías lo absorben"), t("It finishes about twice as fast, but waits jump while half the bays are out", "Termina más o menos el doble de rápido, pero las esperas se disparan mientras falta la mitad de las bahías"), t("It finishes about six times as fast, with no other effect", "Termina unas seis veces más rápido, sin otro efecto")],
    answer: 1,
    why: t("maxUnavailable is how much capacity the rollout may take away. Three bays out leaves 1.5 requests/s of capacity for 2 requests/s of traffic, so queues grow until new bays come up. The rollout is faster because three modules warm up at the same time, but warm-up still sets the pace, so it is not three times faster.", "maxUnavailable es cuánta capacidad puede quitar el despliegue. Con tres bahías fuera quedan 1.5 solicitudes/s de capacidad para 2 solicitudes/s de tráfico, así que las colas crecen hasta que levantan las bahías nuevas. El despliegue es más rápido porque tres módulos se calientan al mismo tiempo, pero el calentamiento sigue marcando el ritmo, así que no es tres veces más rápido."),
    watch: { load: "high", unavail: 3, surge: 0, probe: "on", next: "good" },
  },
  {
    id: "surge",
    title: t("Add before you remove", "Agregar antes de quitar"),
    change: t("maxUnavailable 1, maxSurge 0 → maxUnavailable 0, maxSurge 1 · busy traffic", "maxUnavailable 1, maxSurge 0 → maxUnavailable 0, maxSurge 1 · tráfico alto"),
    question: t("Now a new bay is added before any old one is taken out. What does that cost?", "Ahora se agrega una bahía nueva antes de sacar una vieja. ¿Qué cuesta eso?"),
    options: [t("Nothing: same speed, same resources, no dip", "Nada: misma velocidad, mismos recursos, sin bajón"), t("No dip in capacity, but a seventh bay is in use while it runs", "Sin bajón de capacidad, pero se usa una séptima bahía mientras dura"), t("No dip, but it takes twice as long", "Sin bajón, pero tarda el doble")],
    answer: 1,
    why: t("With maxSurge the rollout adds a new bay in a spare position first and only removes an old one once the new one is ready, so capacity never drops below six bays. The price is the extra bay: your cluster needs room for seven while it runs. It is not slower, because each step still waits for exactly one warm-up.", "Con maxSurge el despliegue primero agrega una bahía nueva en una posición de repuesto y solo quita una vieja cuando la nueva está lista, así que la capacidad nunca baja de seis bahías. El precio es la bahía extra: tu clúster necesita lugar para siete mientras dura. No es más lento, porque cada paso sigue esperando exactamente un calentamiento."),
    watch: { load: "high", unavail: 0, surge: 1, probe: "on", next: "good" },
  },
  {
    id: "probe",
    title: t("No readiness probe", "Sin sonda de readiness"),
    change: t("Readiness probe on → off · a new bay's flag rises as soon as it is installed", "Sonda de readiness sí → no · la bandera de una bahía nueva sube en cuanto se instala"),
    question: t("The new version is fine, but every module needs 6 s to warm up. Without the probe…", "La versión nueva está bien, pero cada módulo necesita 6 s para calentarse. Sin la sonda…"),
    options: [t("Nothing changes: the new version works", "No cambia nada: la versión nueva funciona"), t("Requests fail at every swap while the new bay is still warming up", "Fallan solicitudes en cada cambio mientras la bahía nueva todavía se calienta"), t("The rollout is slower, but nothing fails", "El despliegue es más lento, pero nada falla")],
    answer: 1,
    why: t("The flag is the only thing the distributor looks at. Without a probe it rises the moment the module is in place, so requests go to a bay that cannot answer yet. Worse, a new bay has an empty queue, so a least-busy distributor sends it more than its share. The rollout also looks twice as fast, because nothing waits for warm-up: that speed is the bug.", "La bandera es lo único que mira el distribuidor. Sin sonda sube en cuanto el módulo está en su lugar, así que las solicitudes van a una bahía que todavía no puede responder. Peor aún, una bahía nueva tiene la cola vacía, así que un distribuidor que elige la menos ocupada le manda más de lo que le toca. El despliegue además parece el doble de rápido, porque nada espera el calentamiento: esa velocidad es el bug."),
    watch: { load: "normal", unavail: 1, surge: 0, probe: "off", next: "good" },
  },
  {
    id: "bad",
    title: t("A broken version", "Una versión rota"),
    change: t("Next version: broken · it starts, but never passes its health check", "Siguiente versión: rota · arranca, pero nunca pasa su chequeo de salud (health check)"),
    question: t("With the readiness probe on, how far does the rollout get?", "Con la sonda de readiness activada, ¿hasta dónde llega el despliegue?"),
    options: [t("It replaces all six bays and the service goes down", "Reemplaza las seis bahías y el servicio se cae"), t("It stops after the first new bay; the old bays keep serving", "Se detiene después de la primera bahía nueva; las viejas siguen atendiendo"), t("It notices and rolls back by itself", "Se da cuenta y hace rollback solo")],
    answer: 1,
    why: t("The rollout only removes another old bay when enough bays are ready. A new bay that never becomes ready keeps it waiting forever, so the damage stays at one bay. It does not roll back: in Kubernetes the deployment is marked as failed after progressDeadlineSeconds and someone (or a pipeline) runs kubectl rollout undo. Without the probe, nothing stops it.", "El despliegue solo quita otra bahía vieja cuando hay suficientes bahías listas. Una bahía nueva que nunca está lista lo deja esperando para siempre, así que el daño se queda en una bahía. No hace rollback: en Kubernetes el deployment se marca como fallido después de progressDeadlineSeconds y alguien (o un pipeline) ejecuta kubectl rollout undo. Sin la sonda, nada lo detiene."),
    watch: { load: "normal", unavail: 1, surge: 0, probe: "on", next: "bad" },
  },
  {
    id: "format",
    title: t("Two versions at once", "Dos versiones a la vez"),
    change: t("Next version saves user data in a new format that the old version cannot read", "La siguiente versión guarda los datos del usuario en un formato nuevo que la versión vieja no puede leer"),
    question: t("During the rollout, old and new bays both serve. What do users see?", "Durante el despliegue, atienden tanto las bahías viejas como las nuevas. ¿Qué ven los usuarios?"),
    options: [t("No errors: every request lands on a working bay", "Ningún error: cada solicitud cae en una bahía que funciona"), t("Errors for users who were served by a new bay and then land on an old one, until the rollout ends", "Errores para los usuarios que atendió una bahía nueva y luego caen en una vieja, hasta que termina el despliegue"), t("Every request fails until the rollout ends", "Todas las solicitudes fallan hasta que termina el despliegue")],
    answer: 1,
    why: t("A rolling deploy always has a window where both versions serve, and a user can bounce between them from one request to the next. Anything one version writes, the other must be able to read. Ship format changes in steps: first a version that reads both formats, then one that writes the new one (expand, then contract).", "Un despliegue gradual siempre tiene una ventana en la que atienden las dos versiones, y un usuario puede saltar de una a otra entre una solicitud y la siguiente. Todo lo que escribe una versión, la otra tiene que poder leerlo. Publica los cambios de formato por pasos: primero una versión que lee los dos formatos, luego una que escribe el nuevo (expandir y después contraer, expand and contract)."),
    watch: { load: "normal", unavail: 1, surge: 0, probe: "on", next: "incompatible" },
  },
];

const QUESTIONS = [
  [t("maxUnavailable and maxSurge both make a rollout faster. What does each one cost?", "maxUnavailable y maxSurge hacen más rápido un despliegue. ¿Qué cuesta cada uno?"),
    t("maxUnavailable spends capacity: bays are taken out before replacements are ready, so the remaining bays carry more load and waits grow. maxSurge spends resources: extra bays run alongside the old ones, so you need room in the cluster. With maxUnavailable 0 and maxSurge 1 you never drop below full capacity.", "maxUnavailable gasta capacidad: se sacan bahías antes de que estén listos los reemplazos, así que las que quedan cargan más y las esperas crecen. maxSurge gasta recursos: corren bahías extra junto a las viejas, así que necesitas lugar en el clúster. Con maxUnavailable 0 y maxSurge 1 nunca bajas de la capacidad completa.")],
  [t("Why does a readiness probe make a broken rollout stop by itself, and what does it not do for you?", "¿Por qué una sonda de readiness hace que un despliegue roto se detenga solo, y qué no hace por ti?"),
    t("The rollout only removes another old bay when enough bays are ready. A new bay that never becomes ready blocks that, so only one bay is lost and the old ones keep serving. It does not roll back: the deployment just stops progressing (Kubernetes marks it failed after progressDeadlineSeconds), and someone has to run a rollback.", "El despliegue solo quita otra bahía vieja cuando hay suficientes bahías listas. Una bahía nueva que nunca está lista lo bloquea, así que solo se pierde una bahía y las viejas siguen atendiendo. No hace rollback: el deployment simplemente deja de avanzar (Kubernetes lo marca como fallido después de progressDeadlineSeconds) y alguien tiene que hacer el rollback.")],
  [t("Without the probe, the rollout finished in half the time. Why is that number misleading?", "Sin la sonda, el despliegue terminó en la mitad del tiempo. ¿Por qué ese número engaña?"),
    t("It finished faster because nothing waited for warm-up: each flag rose the moment the module was in place. The time saved was paid for with failed requests sent to bays that could not answer yet.", "Terminó más rápido porque nada esperó el calentamiento: cada bandera subió en cuanto el módulo estuvo en su lugar. El tiempo ahorrado se pagó con solicitudes fallidas enviadas a bahías que todavía no podían responder.")],
  [t("A new version renames a field in the data it stores. How do you ship it with a rolling deploy?", "Una versión nueva renombra un campo en los datos que guarda. ¿Cómo la publicas con un despliegue gradual?"),
    t("In steps, because old and new versions serve side by side during every rollout. First deploy a version that can read both the old and the new field but still writes the old one; once that is everywhere, deploy the version that writes the new one; later remove the old field (expand, then contract).", "Por pasos, porque la versión vieja y la nueva atienden lado a lado durante todo despliegue. Primero despliega una versión que pueda leer el campo viejo y el nuevo pero que siga escribiendo el viejo; cuando esté en todas partes, despliega la versión que escribe el nuevo; más adelante elimina el campo viejo (expandir y después contraer).")],
  [t("A brand-new bay has an empty queue. Why can that hurt right after it becomes ready, and what helps?", "Una bahía recién instalada tiene la cola vacía. ¿Por qué eso puede doler justo cuando queda lista, y qué ayuda?"),
    t("A least-busy distributor sends it a burst of traffic, while it may still be cold (caches empty, JIT not warmed). A readiness probe that only passes when it can really serve, a short warm-up delay, or slow-start in the load balancer all help.", "Un distribuidor que elige la bahía menos ocupada le manda una ráfaga de tráfico mientras todavía puede estar fría (cachés vacías, JIT sin calentar). Ayudan una sonda de readiness que solo pasa cuando de verdad puede atender, una breve espera de calentamiento o el arranque lento (slow-start) del balanceador de carga.")],
  [t("When would you choose blue-green or canary instead of a rolling deploy?", "¿Cuándo elegirías azul-verde (blue-green) o canario (canary) en lugar de un despliegue gradual?"),
    t("Blue-green when you cannot have two versions serving at once or want an instant, complete rollback. Canary when you want to try the new version on a small share of real traffic and judge it by metrics before going further. Rolling is the cheap default when versions are compatible and gradual replacement is fine.", "Azul-verde cuando no puedes tener dos versiones atendiendo a la vez o quieres un rollback instantáneo y completo. Canario cuando quieres probar la versión nueva con una parte pequeña del tráfico real y juzgarla por las métricas antes de avanzar. El gradual es la opción barata por defecto cuando las versiones son compatibles y un reemplazo gradual está bien.")],
];

export default defineLesson({
  title: t("Rolling Deploy Workbench", "Banco de trabajo: despliegues graduales"),
  eyebrow: t("Systems lesson 10 · Rolling deploys", "Lección de sistemas 10 · Despliegues graduales"),
  lede: t("A rolling deploy replaces a service one piece at a time, so it never has to stop. This lesson builds the idea three ways: watch a crane swap modules in a running yard, predict what each setting breaks, then explain it back.", "Un despliegue gradual (rolling deploy) reemplaza un servicio pieza por pieza, así que nunca tiene que detenerse. Esta lección construye la idea de tres formas: mira cómo una grúa cambia módulos en un patio en marcha, predice qué rompe cada ajuste y luego explícalo con tus palabras."),
  machine: {
    intro: t("Each bay is one replica of the service. Watch a rollout or two, then change the settings below, pick the next version, and start one yourself.", "Cada bahía es una réplica del servicio. Mira uno o dos despliegues (rollouts), luego cambia los ajustes de abajo, elige la siguiente versión e inicia uno tú. La bandera de cada bahía es su sonda de readiness (readiness probe): indica si la réplica puede recibir tráfico."),
    plate: {
      title: t("Module yard", "Patio de módulos"),
      keys: [
        { mark: "lit", label: t("New version", "Versión nueva") },
        { mark: "raised", label: t("Old version, and the six bays on the feed rail", "Versión vieja, y las seis bahías del riel de alimentación") },
        { mark: "flat", label: t("Readiness flag: up means the distributor may send work", "Bandera de readiness: arriba significa que el distribuidor puede mandar trabajo") },
      ],
      caption:
        t("Requests come down the chute and the distributor sends each one to the least busy bay whose flag is up. In a rollout the gantry crane pulls out an old module, drops it in the bin, and lowers a new one from the supply stand. The strip on a module's face fills while it warms up; the flag rises only when it is ready. The two positions at the right end are spare room for surge.", "Las solicitudes bajan por el tobogán y el distribuidor manda cada una a la bahía menos ocupada con la bandera arriba. En un despliegue, la grúa pórtico saca un módulo viejo, lo tira en el contenedor y baja uno nuevo desde el soporte de suministro. La franja en el frente de un módulo se llena mientras se calienta; la bandera sube solo cuando está listo. Las dos posiciones del extremo derecho son lugar de repuesto para el surge."),
      stage: { "data-yard": "" },
      label: t("Rolling deploy simulation. Space pauses or resumes.", "Simulación de despliegue gradual. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["mix", t("New / old bays", "Bahías nuevas / viejas"), "0 / 6"], ["ready", t("Flags up", "Banderas arriba"), "6"], ["served", t("Served", "Atendidas")], ["errors", t("Errors", "Errores")], ["p95", t("p95 wait", "Espera p95"), "–"], ["time", t("Rollout time", "Duración del despliegue"), "–"]],
    controls: [
      { seg: "unavail", label: "maxUnavailable", options: [[0, "0"], [1, "1"], [3, "3"]], value: 1 },
      { seg: "surge", label: "maxSurge", options: [[0, "0"], [1, "1"], [2, "2"]], value: 0 },
      { seg: "probe", label: t("Readiness probe", "Sonda de readiness"), options: [["on", t("On", "Sí")], ["off", t("Off", "No")]], value: "on" },
      { seg: "next", label: t("Next version", "Siguiente versión"), options: [["good", t("Good", "Buena")], ["bad", t("Broken", "Rota")], ["incompatible", t("New data format", "Formato de datos nuevo")]], value: "good" },
      { seg: "load", label: t("Traffic", "Tráfico"), options: [["normal", "Normal"], ["high", t("Busy", "Alto")]], value: "normal" },
      { speed: true },
      { actions: [["rollout", t("Start rollout", "Iniciar despliegue"), { primary: true }], ["reset", t("Reset", "Reiniciar")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Kubernetes does not allow maxUnavailable and maxSurge to both be 0; choosing that sets maxSurge to 1.", "Kubernetes no permite que maxUnavailable y maxSurge sean 0 a la vez; si eliges eso, maxSurge pasa a 1."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over eight simulated rollouts of the same yard: six bays, 6 s warm-up, 2.4 s per crane move.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados son el promedio de ocho despliegues simulados del mismo patio: seis bahías, 6 s de calentamiento, 2.4 s por movimiento de la grúa."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  // Warm-up strip, the darker old modules and headed groups of result bars.
  css: `
.warm-fill{fill:var(--anatomy-mid);stroke:none}
.mod-old .iso-top{fill:var(--anatomy-shade-1)}
.mod-old .iso-fill{fill:var(--anatomy-shade-2)}
.mod-old .iso-edge{stroke:var(--anatomy-mid)}
`,
  data: {
    P,
    G: GEOMETRY,
    TOKEN_SVG: tokenSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
