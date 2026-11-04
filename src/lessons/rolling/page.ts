// @ts-nocheck: content ported as-is
// Systems lesson 10 · Rolling deploys: a module yard where a gantry crane swaps one module at a time.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { secs as secsOf } from "../../lib/format";
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

// What each card shows after a run (8 seeds each).
const pct = (x) => (100 * x < 1 && x > 0 ? (100 * x).toFixed(1) : Math.round(100 * x)) + "%";
const secs = (x, l) => (x === null ? (l === "es" ? "nunca" : "never") : secsOf(x));
const secsT = (x) => t(secs(x, "en"), secs(x, "es"));
// A verdict built once per language from the same numbers: f(lang) returns the sentence.
const both = (f) => t(f("en"), f("es"));
const group = (title, rows) => ({ title, rows });
const RUNS_RAW = {
  unavail: () => {
    const { base, a, b } = RESULTS.unavail;
    return { verdict: both((l) => l === "es"
        ? "Duración del despliegue " + secs(a.rolloutTime, l) + " → " + secs(b.rolloutTime, l) + ". Espera p95 durante el despliegue " + secs(a.p95, l) + " → " + secs(b.p95, l) + " (sin despliegue: " + secs(base.p95, l) + ")."
        : "Rollout time " + secs(a.rolloutTime, l) + " → " + secs(b.rolloutTime, l) + ". p95 wait during it " + secs(a.p95, l) + " → " + secs(b.p95, l) + " (no rollout: " + secs(base.p95, l) + ")."),
      groups: [group(t("Rollout time", "Duración del despliegue"), [["maxUnavailable 1", a.rolloutTime, secsT(a.rolloutTime)], ["maxUnavailable 3", b.rolloutTime, secsT(b.rolloutTime), true]]),
        group(t("p95 wait during the rollout", "Espera p95 durante el despliegue"), [[t("No rollout", "Sin despliegue"), base.p95, secsT(base.p95)], ["maxUnavailable 1", a.p95, secsT(a.p95)], ["maxUnavailable 3", b.p95, secsT(b.p95), true]])] };
  },
  surge: () => {
    const { base, a, b } = RESULTS.surge;
    return { verdict: both((l) => l === "es"
        ? "Espera p95 durante el despliegue " + secs(a.p95, l) + " → " + secs(b.p95, l) + " (sin despliegue: " + secs(base.p95, l) + "). Duración del despliegue " + secs(a.rolloutTime, l) + " → " + secs(b.rolloutTime, l) + ". Bahías en uso en el pico: " + a.peakBays + " → " + b.peakBays + "."
        : "p95 wait during the rollout " + secs(a.p95, l) + " → " + secs(b.p95, l) + " (no rollout: " + secs(base.p95, l) + "). Rollout time " + secs(a.rolloutTime, l) + " → " + secs(b.rolloutTime, l) + ". Bays in use at the peak: " + a.peakBays + " → " + b.peakBays + "."),
      groups: [group(t("p95 wait during the rollout", "Espera p95 durante el despliegue"), [[t("No rollout", "Sin despliegue"), base.p95, secsT(base.p95)], [t("Unavailable 1", "maxUnavailable 1"), a.p95, secsT(a.p95)], [t("Surge 1", "maxSurge 1"), b.p95, secsT(b.p95), true]]),
        group(t("Bays in use at the peak", "Bahías en uso en el pico"), [[t("Unavailable 1", "maxUnavailable 1"), a.peakBays, String(a.peakBays)], [t("Surge 1", "maxSurge 1"), b.peakBays, String(b.peakBays), true]]),
        group(t("Rollout time", "Duración del despliegue"), [[t("Unavailable 1", "maxUnavailable 1"), a.rolloutTime, secsT(a.rolloutTime)], [t("Surge 1", "maxSurge 1"), b.rolloutTime, secsT(b.rolloutTime), true]])] };
  },
  probe: () => {
    const { a, b } = RESULTS.probe;
    return { verdict: both((l) => l === "es"
        ? "Sin la sonda, falló el " + pct(b.errorRate) + " de las solicitudes durante el despliegue (con ella: " + pct(a.errorRate) + "). Además \"terminó\" en " + secs(b.rolloutTime, l) + " en vez de " + secs(a.rolloutTime, l) + ", porque nada esperó el calentamiento."
        : "Without the probe, " + pct(b.errorRate) + " of requests failed during the rollout (with it: " + pct(a.errorRate) + "). It also \"finished\" in " + secs(b.rolloutTime, l) + " instead of " + secs(a.rolloutTime, l) + ", because nothing waited for warm-up."),
      groups: [group(t("Requests that failed", "Solicitudes que fallaron"), [[t("Probe on", "Con sonda"), a.errorRate, pct(a.errorRate)], [t("Probe off", "Sin sonda"), b.errorRate, pct(b.errorRate), true]]),
        group(t("Rollout time", "Duración del despliegue"), [[t("Probe on", "Con sonda"), a.rolloutTime, secsT(a.rolloutTime)], [t("Probe off", "Sin sonda"), b.rolloutTime, secsT(b.rolloutTime), true]])] };
  },
  bad: () => {
    const { a, b } = RESULTS.bad;
    return { verdict: both((l) => l === "es"
        ? "Con la sonda: " + a.newBays.toFixed(0) + " bahía reemplazada, " + a.oldServing.toFixed(0) + " bahías viejas todavía atendiendo y falló el " + pct(a.errorRate) + " de las solicitudes; el despliegue solo espera. Sin ella: " + b.newBays.toFixed(0) + " de 6 reemplazadas y falló el " + pct(b.errorRate) + "."
        : "With the probe: " + a.newBays.toFixed(0) + " bay replaced, " + a.oldServing.toFixed(0) + " old bays still serving, " + pct(a.errorRate) + " of requests failed; the rollout just waits. Without it: " + b.newBays.toFixed(0) + " of 6 replaced and " + pct(b.errorRate) + " failed."),
      groups: [group(t("Requests that failed (110 s)", "Solicitudes que fallaron (110 s)"), [[t("Probe on", "Con sonda"), a.errorRate, pct(a.errorRate)], [t("Probe off", "Sin sonda"), b.errorRate, pct(b.errorRate), true]]),
        group(t("Bays running the broken version", "Bahías con la versión rota"), [[t("Probe on", "Con sonda"), a.newBays, t(a.newBays.toFixed(0) + " of 6", a.newBays.toFixed(0) + " de 6")], [t("Probe off", "Sin sonda"), b.newBays, t(b.newBays.toFixed(0) + " of 6", b.newBays.toFixed(0) + " de 6"), true]])] };
  },
  format: () => {
    const { a, b } = RESULTS.format;
    return { verdict: t(pct(b.errorRate) + " of requests failed during the rollout, every one from a user sent back to an old bay after a new one had saved their data. A compatible change: " + pct(a.errorRate) + ". After the last old bay is gone, the errors stop.",
        "Falló el " + pct(b.errorRate) + " de las solicitudes durante el despliegue, todas de usuarios que volvieron a una bahía vieja después de que una nueva guardara sus datos. Con un cambio compatible: " + pct(a.errorRate) + ". Cuando se va la última bahía vieja, los errores paran."),
      groups: [group(t("Requests that failed during the rollout", "Solicitudes que fallaron durante el despliegue"), [[t("Compatible change", "Cambio compatible"), a.errorRate, pct(a.errorRate)], [t("New data format", "Formato de datos nuevo"), b.errorRate, pct(b.errorRate), true]])] };
  },
};
// Results come in titled groups of bars; each group's bars are scaled to its largest value.
const RUNS = Object.fromEntries(Object.entries(RUNS_RAW).map(([id, run]) => [id, () => {
  const out = run();
  return { verdict: out.verdict, groups: out.groups.map((g) => {
    const top = Math.max(...g.rows.map((r) => r[1] || 0)) * 1.1 || 1;
    return { title: g.title, bars: g.rows.map(([label, value, text, after]) => [label, Math.max(0.01, (value || 0) / top), text, after]) };
  }) };
}]));

const EXPERIMENTS = [
  {
    id: "unavail",
    title: t("Take more bays out at once", "Sacar más bahías a la vez"),
    change: t("maxUnavailable 1 → 3 · busy traffic (2 requests/s, six bays serve 3/s)", "maxUnavailable 1 → 3 · tráfico alto (2 solicitudes/s, seis bahías atienden 3/s)"),
    question: t("Half the bays may now be out at the same time. What happens?", "Ahora la mitad de las bahías puede estar fuera al mismo tiempo. ¿Qué pasa?"),
    options: [t("Nothing users notice: other bays absorb it", "Nada que noten los usuarios: las otras bahías lo absorben"), t("About twice as fast, but waits jump", "Más o menos el doble de rápido, pero las esperas se disparan"), t("About six times as fast, nothing else", "Unas seis veces más rápido, nada más")],
    answer: 1,
    why: t("maxUnavailable is how much capacity the rollout may take away. Three bays out leaves 1.5 requests/s of capacity for 2 requests/s of traffic, so queues grow until new bays come up. The rollout is faster because three modules warm up at the same time, but there is one crane and every swap still takes two moves (pull the old module, install the new one), so the crane sets the pace and it is not three times faster. In Kubernetes there is no crane: new pods start in parallel, so image pulls and warm-up set the pace instead.", "maxUnavailable es cuánta capacidad puede quitar el despliegue. Con tres bahías fuera quedan 1.5 solicitudes/s de capacidad para 2 solicitudes/s de tráfico, así que las colas crecen hasta que levantan las bahías nuevas. El despliegue es más rápido porque tres módulos se calientan al mismo tiempo, pero hay una sola grúa y cada cambio sigue necesitando dos movimientos (sacar el módulo viejo, instalar el nuevo), así que la grúa marca el ritmo y no es tres veces más rápido. En Kubernetes no hay grúa: los pods nuevos arrancan en paralelo, así que el ritmo lo marcan la descarga de imágenes y el calentamiento."),
    watch: { load: "high", unavail: 3, surge: 0, probe: "on", next: "good" },
  },
  {
    id: "surge",
    title: t("Add before you remove", "Agregar antes de quitar"),
    change: t("maxUnavailable 1, maxSurge 0 → maxUnavailable 0, maxSurge 1 · busy traffic", "maxUnavailable 1, maxSurge 0 → maxUnavailable 0, maxSurge 1 · tráfico alto"),
    question: t("Now a new bay is added before any old one is taken out. What does that cost?", "Ahora se agrega una bahía nueva antes de sacar una vieja. ¿Qué cuesta eso?"),
    options: [t("Nothing: same speed, same resources, no dip", "Nada: misma velocidad, mismos recursos, sin bajón"), t("No dip, but a seventh bay is needed", "Sin bajón, pero hace falta una séptima bahía"), t("No dip, but it takes twice as long", "Sin bajón, pero tarda el doble")],
    answer: 1,
    why: t("With maxSurge the rollout adds a new bay in a spare position first and only removes an old one once the new one is ready, so capacity never drops below six bays. The price is the extra bay: your cluster needs room for seven while it runs. It is not slower, because each step still waits for exactly one warm-up.", "Con maxSurge el despliegue primero agrega una bahía nueva en una posición de repuesto y solo quita una vieja cuando la nueva está lista, así que la capacidad nunca baja de seis bahías. El precio es la bahía extra: tu clúster necesita lugar para siete mientras dura. No es más lento, porque cada paso sigue esperando exactamente un calentamiento."),
    watch: { load: "high", unavail: 0, surge: 1, probe: "on", next: "good" },
  },
  {
    id: "probe",
    title: t("A flag that rises too early", "Una bandera que sube antes de tiempo"),
    change: t("Readiness probe on → off · a new bay's flag rises as soon as it is installed", "Sonda de readiness sí → no · la bandera de una bahía nueva sube en cuanto se instala"),
    question: t("The new version is fine, but every module needs 6 s to warm up. Without the probe, how does the rollout go?", "La versión nueva está bien, pero cada módulo necesita 6 s para calentarse. Sin la sonda, ¿cómo sale el despliegue?"),
    options: [t("As before: the new version works", "Igual que antes: la versión nueva funciona"), t("It looks faster, and requests fail", "Parece más rápido, y fallan solicitudes"), t("It is slower, but nothing fails", "Es más lento, pero nada falla")],
    answer: 1,
    why: t("From the rollout's side, everything looks better: each flag rises the moment the module is in place, so the crane moves on without waiting for warm-up and the rollout reports done in about half the time. That speed is the bug. The flag is the only thing the distributor looks at, so requests go to bays that cannot answer yet, and a new bay's empty queue makes a least-busy distributor send it more than its share. Every swap costs failed requests, and the rollout's own numbers never show it. Lesson 23, Health checks, shows the readiness probe on its own.", "Desde el lado del despliegue, todo se ve mejor: cada bandera sube en cuanto el módulo está en su lugar, así que la grúa sigue sin esperar el calentamiento y el despliegue se da por terminado en más o menos la mitad del tiempo. Esa velocidad es el bug. La bandera es lo único que mira el distribuidor, así que las solicitudes van a bahías que todavía no pueden responder, y la cola vacía de una bahía nueva hace que un distribuidor que elige la menos ocupada le mande más de lo que le toca. Cada cambio cuesta solicitudes fallidas, y los números del propio despliegue nunca lo muestran. La lección 23, Chequeos de salud, muestra la sonda de readiness por sí sola."),
    watch: { load: "normal", unavail: 1, surge: 0, probe: "off", next: "good" },
  },
  {
    id: "bad",
    title: t("A broken version", "Una versión rota"),
    change: t("Next version: broken · it starts, but never passes its health check", "Siguiente versión: rota · arranca, pero nunca pasa su chequeo de salud (health check)"),
    question: t("With the readiness probe on, how far does the rollout get?", "Con la sonda de readiness activada, ¿hasta dónde llega el despliegue?"),
    options: [t("It replaces all six; the service goes down", "Reemplaza las seis; el servicio se cae"), t("It stalls after the first new bay", "Se detiene después de la primera bahía nueva"), t("It notices and rolls back by itself", "Se da cuenta y hace rollback solo")],
    answer: 1,
    why: t("The rollout only removes another old bay when enough bays are ready. A new bay that never becomes ready keeps it waiting forever, so the damage stays at one bay and the old bays keep serving. It does not roll back: in Kubernetes the deployment is marked as failed after progressDeadlineSeconds and someone (or a pipeline) runs kubectl rollout undo. Without the probe, nothing stops it.", "El despliegue solo quita otra bahía vieja cuando hay suficientes bahías listas. Una bahía nueva que nunca está lista lo deja esperando para siempre, así que el daño se queda en una bahía y las viejas siguen atendiendo. No hace rollback: en Kubernetes el deployment se marca como fallido después de progressDeadlineSeconds y alguien (o un pipeline) ejecuta kubectl rollout undo. Sin la sonda, nada lo detiene."),
    watch: { load: "normal", unavail: 1, surge: 0, probe: "on", next: "bad" },
  },
  {
    id: "format",
    title: t("Two versions at once", "Dos versiones a la vez"),
    change: t("Next version saves user data in a new format that the old version cannot read", "La siguiente versión guarda los datos del usuario en un formato nuevo que la versión vieja no puede leer"),
    question: t("During the rollout, old and new bays both serve. What do users see?", "Durante el despliegue, atienden tanto las bahías viejas como las nuevas. ¿Qué ven los usuarios?"),
    options: [t("No errors: every request lands on a working bay", "Ningún error: cada solicitud cae en una bahía que funciona"), t("Errors for users sent back to an old bay", "Errores para usuarios que vuelven a una bahía vieja"), t("Every request fails until the rollout ends", "Todas las solicitudes fallan hasta que termina el despliegue")],
    answer: 1,
    why: t("A rolling deploy always has a window where both versions serve, and a user can bounce between them from one request to the next. Anything one version writes, the other must be able to read. Users served by a new bay fail when the distributor sends them back to an old one, until the last old bay is gone. Ship format changes in steps: first a version that reads both formats, then one that writes the new one, and only later remove the old format (expand, migrate, then contract). Lesson 09, Blue-green deploys, shows that a shared database keeps the same trap even when the code flips at once.", "Un despliegue gradual siempre tiene una ventana en la que atienden las dos versiones, y un usuario puede saltar de una a otra entre una solicitud y la siguiente. Todo lo que escribe una versión, la otra tiene que poder leerlo. Los usuarios que atendió una bahía nueva fallan cuando el distribuidor los manda de vuelta a una vieja, hasta que se va la última bahía vieja. Publica los cambios de formato por pasos: primero una versión que lee los dos formatos, luego una que escribe el nuevo, y solo después elimina el formato viejo (expandir, migrar y luego contraer; expand, migrate, contract). La lección 09, Despliegues azul-verde, muestra que una base de datos compartida mantiene la misma trampa aunque el código cambie de una vez."),
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
    t("In steps, because old and new versions serve side by side during every rollout. First deploy a version that can read both the old and the new field but still writes the old one; once that is everywhere, deploy the version that writes the new one; later remove the old field (expand, migrate, then contract).", "Por pasos, porque la versión vieja y la nueva atienden lado a lado durante todo despliegue. Primero despliega una versión que pueda leer el campo viejo y el nuevo pero que siga escribiendo el viejo; cuando esté en todas partes, despliega la versión que escribe el nuevo; más adelante elimina el campo viejo (expandir, migrar y luego contraer).")],
  [t("A brand-new bay has an empty queue. Why can that hurt right after it becomes ready, and what helps?", "Una bahía recién instalada tiene la cola vacía. ¿Por qué eso puede doler justo cuando queda lista, y qué ayuda?"),
    t("A least-busy distributor sends it a burst of traffic, while it may still be cold (caches empty, JIT not warmed). A readiness probe that only passes when it can really serve, a short warm-up delay, or slow-start in the load balancer all help.", "Un distribuidor que elige la bahía menos ocupada le manda una ráfaga de tráfico mientras todavía puede estar fría (cachés vacías, JIT sin calentar). Ayudan una sonda de readiness que solo pasa cuando de verdad puede atender, una breve espera de calentamiento o el arranque lento (slow-start) del balanceador de carga.")],
  [t("When would you choose blue-green or canary instead of a rolling deploy?", "¿Cuándo elegirías azul-verde (blue-green) o canario (canary) en lugar de un despliegue gradual?"),
    t("Blue-green when you want an instant, complete rollback and can afford two full copies. It shortens the window where both versions serve, but the shared database still sees both, so changes must stay compatible (lesson 09, Blue-green deploys). Canary when you want to try the new version on a small share of real traffic and judge it by metrics before going further (lesson 08, Canary deploys). Rolling is the cheap default when versions are compatible and gradual replacement is fine.", "Azul-verde cuando quieres un rollback instantáneo y completo y puedes pagar dos copias completas. Acorta la ventana en la que atienden las dos versiones, pero la base de datos compartida sigue viendo las dos, así que los cambios tienen que seguir siendo compatibles (lección 09, Despliegues azul-verde). Canario cuando quieres probar la versión nueva con una parte pequeña del tráfico real y juzgarla por las métricas antes de avanzar (lección 08, Despliegues canario). El gradual es la opción barata por defecto cuando las versiones son compatibles y un reemplazo gradual está bien.")],
];

export default defineLesson({
  title: t("Rolling Deploy Workbench", "Banco de trabajo: despliegues graduales"),
  eyebrow: t("Systems lesson 10 · Rolling deploys", "Lección de sistemas 10 · Despliegues graduales"),
  lede: t("A rolling deploy replaces a service one piece at a time, so it never has to stop. This lesson builds the idea three ways: watch a crane swap modules in a running yard, predict what each setting breaks, then explain it back.", "Un despliegue gradual (rolling deploy) reemplaza un servicio pieza por pieza, así que nunca tiene que detenerse. Esta lección construye la idea de tres formas: mira cómo una grúa cambia módulos en un patio en marcha, predice qué rompe cada ajuste y luego explícalo con tus palabras."),
  machine: {
    intro: t("Each bay is one replica of the service. Each bay's flag is its readiness probe: it says whether the replica may receive traffic. Watch a rollout or two, then change the settings below, pick the next version, and start one yourself.", "Cada bahía es una réplica del servicio. La bandera de cada bahía es su sonda de readiness (readiness probe): indica si la réplica puede recibir tráfico. Mira uno o dos despliegues (rollouts), luego cambia los ajustes de abajo, elige la siguiente versión e inicia uno tú."),
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
      { seg: "unavail", label: t("maxUnavailable · bays out at once", "maxUnavailable · bahías fuera a la vez"), options: [[0, "0"], [1, "1"], [3, "3"]], value: 1 },
      { seg: "surge", label: t("maxSurge · extra bays", "maxSurge · bahías extra"), options: [[0, "0"], [1, "1"], [2, "2"]], value: 0 },
      { seg: "probe", label: t("Readiness probe", "Sonda de readiness"), options: [["on", t("On", "Sí")], ["off", t("Off", "No")]], value: "on" },
      { seg: "next", label: t("Next version", "Siguiente versión"), options: [["good", t("Good", "Buena")], ["bad", t("Broken", "Rota")], ["incompatible", t("New data format", "Formato de datos nuevo")]], value: "good" },
      { seg: "load", label: t("Traffic", "Tráfico"), options: [["normal", "Normal"], ["high", t("Busy", "Alto")]], value: "normal" },
      { speed: true },
      { actions: [["rollout", t("Start rollout", "Iniciar despliegue"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Kubernetes does not allow maxUnavailable and maxSurge to both be 0; choosing that sets maxSurge to 1.", "Kubernetes no permite que maxUnavailable y maxSurge sean 0 a la vez; si eliges eso, maxSurge pasa a 1."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over eight simulated rollouts of the same yard: six bays, 6 s warm-up, 2.4 s per crane move.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados son el promedio de ocho despliegues simulados del mismo patio: seis bahías, 6 s de calentamiento, 2.4 s por movimiento de la grúa."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  // Warm-up strip, the darker old modules and headed groups of result bars.
  css: `
.warm-fill{fill:var(--anatomy-mid);stroke:none}
.mod-old .iso-top{fill:var(--anatomy-shade-1)}
.mod-old .iso-fill{fill:var(--anatomy-shade-2)}
.mod-old .iso-edge{stroke:var(--anatomy-mid)}
wb-control:has(> wb-seg[name="unavail"]) > span,wb-control:has(> wb-seg[name="surge"]) > span{text-transform:none}
`,
  data: {
    P,
    G: GEOMETRY,
    TOKEN_SVG: tokenSvg(),
  },
});
