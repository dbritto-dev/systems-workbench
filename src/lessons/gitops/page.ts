// @ts-nocheck: content in the style of the other lessons
// Systems lesson 78 · GitOps reconcile: a blueprint office, a reconciler's booth and a cluster floor.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, int } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, walkerSvg, podSvg, P, GEOMETRY, POD } from "./figure";
import { litFill } from "../../../workbench/parts.mjs";
import { hotfixRun, pollRun, hpaRun, pruneRun, rollbackRun, HOTFIX, MERGES, SPIKE, PRUNE, ROLLBACK, LIMIT, LOAD, CAP, STARTUP } from "./sim";

// Experiment results, computed at build time from the same model the machine runs (eight seeded runs each).
const R = { hotfix: hotfixRun(), poll: pollRun(), hpa: hpaRun(), prune: pruneRun(), rollback: rollbackRun() };

// A duration: seconds under 90 s, minutes with a decimal above.
const dur = (s) => (s < 90 ? n0(s) + " s" : (s / 60).toFixed(1) + " min");
const top = (...xs) => Math.max(...xs) * 1.08 || 1;

// What each card shows after a run.
const RUNS = {
  hotfix: () => {
    const { on, off } = R.hotfix, mx = top(off.life);
    return {
      verdict: t("Self-heal on: the hotfix lasted " + dur(on.life) + ". Self-heal off: it lasted " + dur(off.life) + ", until " + dur(off.afterRelease) + " after the release was merged, when that release's sync put " + LIMIT.git + " back. The app showed out of sync for all " + dur(off.out) + ".",
        "Con self-heal: el hotfix duró " + dur(on.life) + ". Sin self-heal: duró " + dur(off.life) + ", hasta " + dur(off.afterRelease) + " después de fusionar la versión, cuando el sync de esa versión volvió a poner " + LIMIT.git + ". La app se vio desincronizada durante los " + dur(off.out) + "."),
      bars: [
        [t("Hotfix lasted, self-heal on", "Duración del hotfix, con self-heal"), on.life / mx, dur(on.life)],
        [t("Hotfix lasted, self-heal off", "Duración del hotfix, sin self-heal"), off.life / mx, dur(off.life), true],
        [t("From the release merge to the hotfix gone", "De la fusión de la versión al hotfix perdido"), off.afterRelease / mx, dur(off.afterRelease)],
      ],
    };
  },
  poll: () => {
    const { poll, hook } = R.poll, mx = top(poll.liveMax);
    return {
      verdict: t("No webhook: the reconciler read each merge " + dur(poll.read) + " after it on average (up to " + dur(poll.readMax) + "), and every pod ran it after " + dur(poll.live) + " (up to " + dur(poll.liveMax) + "). With a webhook: read after " + dur(hook.read) + ", running on every pod after " + dur(hook.live) + ".",
        "Sin webhook: el reconciliador leyó cada fusión " + dur(poll.read) + " después en promedio (hasta " + dur(poll.readMax) + "), y todos los pods la corrían a los " + dur(poll.live) + " (hasta " + dur(poll.liveMax) + "). Con un webhook: la leyó a los " + dur(hook.read) + " y corría en todos los pods a los " + dur(hook.live) + "."),
      bars: [
        [t("Read by the reconciler, no webhook", "Leída por el reconciliador, sin webhook"), poll.read / mx, dur(poll.read), true],
        [t("On every pod, no webhook", "En todos los pods, sin webhook"), poll.live / mx, dur(poll.live), true],
        [t("Read by the reconciler, webhook", "Leída por el reconciliador, con webhook"), hook.read / mx, dur(hook.read)],
        [t("On every pod, webhook", "En todos los pods, con webhook"), hook.live / mx, dur(hook.live)],
      ],
    };
  },
  hpa: () => {
    const { git, hpa } = R.hpa, mx = top(git.failed);
    return {
      verdict: t("replicas: 3 in git: synced back to 3 pods " + n0(git.cuts) + " times in 10 minutes, " + n0(git.started) + " pods started, " + int(git.failed) + " requests failed. Left to the HPA: no cuts, " + n0(hpa.started) + " pods started, " + int(hpa.failed) + " failed, all in the spike's first half-minute, before the new pods were ready.",
        "replicas: 3 en git: se volvió a 3 pods " + n0(git.cuts) + " veces en 10 minutos, arrancaron " + n0(git.started) + " pods y fallaron " + int(git.failed) + " solicitudes. A cargo del HPA: ningún recorte, arrancaron " + n0(hpa.started) + " pods y fallaron " + int(hpa.failed) + ", todas en el primer medio minuto del pico, antes de que los pods nuevos estuvieran listos."),
      bars: [
        [t("Failed requests, replicas in git", "Solicitudes fallidas, réplicas en git"), git.failed / mx, int(git.failed), true],
        [t("Failed requests, left to the HPA", "Solicitudes fallidas, a cargo del HPA"), hpa.failed / mx, int(hpa.failed)],
        [t("Pods started, replicas in git (of 30)", "Pods arrancados, réplicas en git (de 30)"), Math.min(1, git.started / 30), n0(git.started), true],
        [t("Pods started, left to the HPA (of 30)", "Pods arrancados, a cargo del HPA (de 30)"), Math.min(1, hpa.started / 30), n0(hpa.started)],
      ],
    };
  },
  prune: () => {
    const { off, on } = R.prune, span = PRUNE.until - PRUNE.at;
    return {
      verdict: t("Prune off: the worker was still running after 30 minutes and had run " + n0(off.jobs) + " jobs since git dropped it; the app showed out of sync all that time. Prune on: deleted " + dur(on.after) + " after the commit, at the reconciler's next look at git, after " + n0(on.jobs) + " jobs.",
        "Prune apagado: el worker seguía corriendo a los 30 minutos y había hecho " + n0(off.jobs) + " tareas desde que git lo quitó; la app se vio desincronizada todo ese tiempo. Prune activado: se borró " + dur(on.after) + " después del commit, cuando el reconciliador volvió a leer git, tras " + n0(on.jobs) + " tareas."),
      bars: [
        [t("Worker kept running, prune off (of 30 min)", "El worker siguió corriendo, prune apagado (de 30 min)"), off.after / span, dur(off.after), true],
        [t("Worker kept running, prune on", "El worker siguió corriendo, prune activado"), on.after / span, dur(on.after)],
        [t("Jobs after removal, prune off", "Tareas tras quitarlo, prune apagado"), off.jobs / top(off.jobs), n0(off.jobs), true],
        [t("Jobs after removal, prune on", "Tareas tras quitarlo, prune activado"), on.jobs / top(off.jobs), n0(on.jobs)],
      ],
    };
  },
  rollback: () => {
    const { undo, revert } = R.rollback, mx = top(undo.failed);
    return {
      verdict: t("kubectl rollout undo: self-heal put v8 back " + dur(undo.undoneIn) + " later; v8 was still running after 10 minutes, and " + int(undo.failed) + " requests failed. git revert: v7 ran on every pod " + dur(revert.fixedAt) + " later; " + int(revert.failed) + " failed.",
        "kubectl rollout undo: self-heal volvió a poner v8 " + dur(undo.undoneIn) + " después; v8 seguía corriendo a los 10 minutos y fallaron " + int(undo.failed) + " solicitudes. git revert: v7 corría en todos los pods " + dur(revert.fixedAt) + " después; fallaron " + int(revert.failed) + "."),
      bars: [
        [t("Failed in 10 min, undo in the cluster", "Fallidas en 10 min, undo en el clúster"), undo.failed / mx, int(undo.failed), true],
        [t("Failed in 10 min, git revert", "Fallidas en 10 min, git revert"), revert.failed / mx, int(revert.failed)],
      ],
    };
  },
};

const BASE = { selfHeal: "on", prune: "on", poll: "poll", replicas: "hpa", traffic: "normal" };

const EXPERIMENTS = [
  {
    id: "hotfix",
    title: t("A hotfix in the cluster", "Un hotfix en el clúster"),
    change: t("An engineer raises LIMIT from " + LIMIT.git + " to " + LIMIT.hotfix + " with kubectl edit · 10 minutes later a teammate merges an unrelated release · self-heal on → off",
      "Alguien de guardia sube el LÍMITE de " + LIMIT.git + " a " + LIMIT.hotfix + " con kubectl edit · 10 minutos después alguien del equipo fusiona una versión que no tiene nada que ver · self-heal sí → no"),
    question: t("With self-heal off, what happens to the hotfix?", "Sin self-heal, ¿qué pasa con el hotfix?"),
    options: [
      t("It stays: the release didn't touch the config", "Se queda: la versión no tocó la config"),
      t("The release's sync puts git's value back", "El sync de la versión repone el valor de git"),
      t("The sync stops on a conflict for someone to fix", "El sync se frena en un conflicto a resolver"),
    ],
    answer: 1,
    why: t(
      "With self-heal on, the reconciler sees the live change within seconds (it watches the cluster) and puts git's value back, so the hotfix barely exists. With it off, nothing reverts it at first; the app just shows OutOfSync. But an automated sync applies the whole desired state at the new revision, not only what the commit changed, so the next merge, about anything, quietly sets LIMIT back to " + LIMIT.git + ", at a moment nobody chose. Until then git didn't say what was running. Make the hotfix a commit instead: it takes one git check (or a webhook) to land, and it stays.",
      "Con self-heal (autorreparación), el reconciliador ve el cambio en vivo en segundos (observa el clúster) y vuelve a poner el valor de git, así que el hotfix casi no existe. Sin él, al principio nada lo revierte; la app solo se ve desincronizada (OutOfSync). Pero un sync automático aplica todo el estado deseado de la revisión nueva, no solo lo que cambió el commit, así que la siguiente fusión, sea de lo que sea, vuelve a poner el LÍMITE en " + LIMIT.git + " sin avisar, en un momento que nadie eligió. Hasta entonces, git no decía lo que estaba corriendo. Mejor haz del hotfix un commit: tarda una revisión de git (o un webhook) en llegar, y se queda.",
    ),
    watch: { set: { ...BASE, selfHeal: "off" }, sim: {}, script: [{ at: HOTFIX.at, type: "hotfix" }, { at: HOTFIX.release, type: "release" }], from: HOTFIX.at - 8, speed: 15,
      say: { en: "self-heal off · a hotfix at 1 min, a release at 11 min", es: "sin self-heal · un hotfix al minuto 1, una versión al minuto 11" } },
  },
  {
    id: "poll",
    title: t("How soon does a merge run?", "¿Qué tan pronto corre una fusión?"),
    change: t("Releases merged at random moments · no webhook (the reconciler's default timer) → a webhook from the git host",
      "Versiones fusionadas en momentos al azar · sin webhook (el temporizador por defecto del reconciliador) → un webhook del servidor de git"),
    question: t("The reconciler watches the cluster constantly. Without a webhook, how long until it reads a merge?", "El reconciliador observa el clúster todo el tiempo. Sin webhook, ¿cuánto tarda en leer una fusión?"),
    options: [
      t("Seconds: it's watching all the time", "Segundos: está observando todo el tiempo"),
      t("About a minute on average, up to 3", "Cerca de un minuto en promedio, hasta 3"),
      t("About 3 minutes, every single time", "Unos 3 minutos, todas las veces"),
    ],
    answer: 1,
    why: t(
      "Argo CD watches the cluster, so live changes show up in seconds, but it reads git on a timer: by default every 120 s plus up to 60 s of jitter (timeout.reconciliation), at most 3 minutes. A merge lands at a random point of that cycle and waits about half of it on average, then the rollout adds its own time as new pods start and old ones go. A webhook from the git host tells it to read now, so only the rollout remains. Keep the timer as a backstop, since a webhook can get lost. Shortening the timer instead makes every app re-read git more often, which loads the repo server and the git host.",
      "Argo CD observa el clúster, así que los cambios en vivo se notan en segundos, pero lee git con un temporizador: por defecto cada 120 s más hasta 60 s de variación aleatoria (jitter) (timeout.reconciliation), 3 minutos como mucho. Una fusión cae en un punto al azar de ese ciclo y espera en promedio cerca de la mitad; después el despliegue suma su propio tiempo, mientras arrancan pods nuevos y se van los viejos. Un webhook del servidor de git le avisa que lea ya, así que solo queda el despliegue. Deja el temporizador como respaldo, porque un webhook se puede perder. Acortar el temporizador hace que todas las apps relean git más seguido, lo que carga al repo server y al servidor de git.",
    ),
    watch: { set: BASE, sim: {}, script: [{ at: 20, type: "release" }, { at: 300, type: "release" }, { at: 580, type: "release" }], from: 12, speed: 4,
      say: { en: "a merge at 20 s · watch NEXT CHECK · then try the webhook", es: "una fusión a los 20 s · mira REVISA EN · luego prueba el webhook" } },
  },
  {
    id: "hpa",
    title: t("replicas: 3 in git, and an HPA", "replicas: 3 en git, y un HPA"),
    change: t("Traffic doubles for 10 minutes and the HPA asks for 6 pods · self-heal on · replicas left to the HPA → replicas: 3 in git",
      "El tráfico se duplica durante 10 minutos y el HPA pide 6 pods · con self-heal · réplicas a cargo del HPA → replicas: 3 en git"),
    question: t("With replicas: 3 in git, what happens during the spike?", "Con replicas: 3 en git, ¿qué pasa durante el pico?"),
    options: [
      t("The HPA wins: it acts on load, after git", "Gana el HPA: actúa según la carga, después de git"),
      t("They fight: each sync cuts the HPA's pods", "Se pelean: cada sync recorta los pods del HPA"),
      t("Git wins: web stays at 3 pods throughout", "Gana git: web se queda en 3 pods todo el tiempo"),
    ],
    answer: 1,
    why: t(
      "The HPA writes replicas on the live Deployment; git says 3, so self-heal sees drift and puts 3 back, killing pods that often weren't even ready. At its next check (every 15 s) the HPA asks for 6 again, and round it goes. Current Argo CD versions back off between repeated self-heals (2 s, then three times longer each time, up to 5 minutes, by default), so the cuts get rarer, but each one halves capacity at the peak. Give the field one owner: remove replicas from the manifest when an HPA manages it, as the Kubernetes docs advise, or have Argo CD ignore it (ignoreDifferences on /spec/replicas, with RespectIgnoreDifferences=true so a sync doesn't write it either). Lesson 75, Autoscaling, covers the HPA itself.",
      "El HPA escribe las réplicas en el Deployment en vivo; git dice 3, así que self-heal ve una deriva (drift) y vuelve a poner 3, y elimina pods que muchas veces ni estaban listos. En su siguiente revisión (cada 15 s) el HPA vuelve a pedir 6, y así sigue. Las versiones actuales de Argo CD esperan cada vez más entre autorreparaciones repetidas (2 s, luego tres veces más cada vez, hasta 5 minutos, por defecto), así que los recortes se espacian, pero cada uno parte la capacidad a la mitad en pleno pico. Dale un solo dueño al campo: quita replicas del manifiesto cuando lo maneja un HPA, como aconseja la documentación de Kubernetes, o haz que Argo CD lo ignore (ignoreDifferences en /spec/replicas, con RespectIgnoreDifferences=true para que un sync tampoco lo escriba). La lección 75, Autoescalado, trata el HPA en sí.",
    ),
    watch: { set: { ...BASE, replicas: "git" }, sim: {}, script: [{ at: SPIKE.from, type: "traffic", level: "high" }, { at: SPIKE.to, type: "traffic", level: "normal" }], from: SPIKE.from - 6, speed: 4,
      say: { en: "replicas: 3 in git · traffic doubles at 1 min", es: "replicas: 3 en git · el tráfico se duplica al minuto 1" } },
  },
  {
    id: "prune",
    title: t("Delete it from git", "Bórralo de git"),
    change: t("The old worker's manifest is deleted from git · self-heal on · prune on → off · 30 minutes",
      "Se borra de git el manifiesto del worker viejo · con self-heal · prune sí → no · 30 minutos"),
    question: t("With prune off, what happens to the worker in the cluster?", "Con prune apagado, ¿qué pasa con el worker en el clúster?"),
    options: [
      t("It's gone at the next sync: git lacks it", "Se va en el siguiente sync: git no lo tiene"),
      t("It keeps running: only a prune deletes it", "Sigue corriendo: solo un prune lo borra"),
      t("Self-heal removes it within seconds", "Self-heal lo quita en unos segundos"),
    ],
    answer: 1,
    why: t(
      "A sync applies what git has; deleting what git no longer has is a separate permission. With prune off (the default for Argo CD's automated sync), the reconciler marks the worker as needing pruning and the app stays OutOfSync, but nothing deletes it: self-heal doesn't either, because a difference that only a prune would fix doesn't trigger a sync. So the old code keeps running and doing work. Prune is off by default because deleting is the dangerous direction: a wrong path or a generator that renders nothing would otherwise take resources down with it (Argo CD also refuses to prune an app to nothing unless allowEmpty is set).",
      "Un sync aplica lo que tiene git; borrar lo que git ya no tiene es un permiso aparte. Con prune (podar) apagado, que es lo predeterminado en el sync automático de Argo CD, el reconciliador marca el worker como pendiente de podar y la app queda desincronizada, pero nada lo borra: self-heal tampoco, porque una diferencia que solo arreglaría un prune no dispara un sync. Así que el código viejo sigue corriendo y haciendo trabajo. Prune viene apagado porque borrar es la dirección peligrosa: una ruta equivocada o un generador que no produce nada se llevaría recursos por delante (Argo CD además se niega a podar una app hasta dejarla vacía, salvo que allowEmpty esté activado).",
    ),
    watch: { set: { ...BASE, prune: "off" }, sim: {}, script: [{ at: PRUNE.at, type: "removeWorker" }], from: PRUNE.at - 8, speed: 15,
      say: { en: "prune off · the worker leaves git at 1 min", es: "prune apagado · el worker sale de git al minuto 1" } },
  },
  {
    id: "rollback",
    title: t("Roll back in the cluster", "Revertir en el clúster"),
    change: t("Release v8 fails 1 request in 5 · self-heal on · kubectl rollout undo in the cluster → git revert · the next 10 minutes",
      "La versión v8 hace fallar 1 de cada 5 solicitudes · con self-heal · kubectl rollout undo en el clúster → git revert · los 10 minutos siguientes"),
    question: t("Someone runs kubectl rollout undo to get v7 back. What happens?", "Alguien ejecuta kubectl rollout undo para volver a v7. ¿Qué pasa?"),
    options: [
      t("v7 is back within a minute, and it stays", "v7 vuelve en menos de un minuto, y se queda"),
      t("Self-heal puts v8 back within seconds", "Self-heal vuelve a poner v8 en segundos"),
      t("v7 stays until the next look at git", "v7 se queda hasta la próxima lectura de git"),
    ],
    answer: 1,
    why: t(
      "To the reconciler the undo is just drift: git still says v8, so self-heal applies v8 again before the first v7 pod is ready, and v8 goes on failing. Under GitOps a rollback is a commit: git revert puts v7 back in git, and the reconciler rolls it out at its next look at git, or at once with a webhook. That's also why Argo CD's own Rollback button is disabled while automated sync is on. In an emergency you can switch automated sync off first and then act in the cluster, but git stays wrong until someone fixes it there too.",
      "Para el reconciliador, el undo es solo una deriva: git sigue diciendo v8, así que self-heal vuelve a aplicar v8 antes de que el primer pod de v7 esté listo, y v8 sigue fallando. En GitOps, revertir es un commit: git revert vuelve a poner v7 en git, y el reconciliador lo despliega en su siguiente lectura de git, o enseguida con un webhook. Por eso también el botón Rollback de Argo CD está deshabilitado mientras el sync automático está activado. En una emergencia puedes apagar primero el sync automático y luego actuar en el clúster, pero git queda equivocado hasta que alguien también lo corrija ahí.",
    ),
    watch: { set: BASE, sim: { image: 8, prevImage: 7, badImages: [8] }, script: [{ at: ROLLBACK.at, type: "undo" }, { at: ROLLBACK.at + 120, type: "revert" }], from: ROLLBACK.at - 6, speed: 4,
      say: { en: "v8 fails 1 in 5 · undo in the cluster, then a git revert", es: "v8 falla 1 de cada 5 · undo en el clúster, luego un git revert" } },
  },
];

const QUESTIONS = [
  [t("What does a reconciler do, and what does a pull-based setup change compared with a CI job that runs kubectl apply?", "¿Qué hace un reconciliador, y qué cambia un esquema pull frente a un job de CI que ejecuta kubectl apply?"),
    t("It runs in or next to the cluster and keeps comparing the desired state (the manifests at a git revision) with the live state, and acts on the difference. Pulling means the cluster fetches from git, so CI doesn't need credentials to the cluster, and the correction goes on after the deploy instead of happening once. A push-only pipeline applies once and never notices drift.",
      "Corre dentro o al lado del clúster y compara todo el tiempo el estado deseado (los manifiestos en una revisión de git) con el estado en vivo, y actúa sobre la diferencia. Con pull, el clúster trae los cambios desde git, así que CI no necesita credenciales del clúster, y la corrección sigue después del despliegue en vez de ocurrir una sola vez. Un pipeline que solo empuja (push) aplica una vez y nunca nota la deriva.")],
  [t("Self-heal is on. When does the reconciler act, and when would you turn it off?", "Self-heal está activado. ¿Cuándo actúa el reconciliador, y cuándo lo apagarías?"),
    t("When the live state stops matching the revision it last read, within seconds, and again, with a growing backoff, if it keeps drifting. Turn it off, or exclude the field, where something else legitimately writes the live state (an HPA, an operator), or briefly in an incident where you must act in the cluster, and then commit what you did. With it off, drift lasts until the next sync overwrites it, whenever that is.",
      "Cuando el estado en vivo deja de coincidir con la revisión que leyó por última vez, en segundos, y otra vez, con una espera creciente (backoff), si sigue derivando. Apágalo, o excluye el campo, donde otra cosa escribe legítimamente el estado en vivo (un HPA, un operador), o por un rato en un incidente en el que debas actuar en el clúster, y después haz commit de lo que hiciste. Apagado, la deriva dura hasta que el siguiente sync la pise, cuando sea que llegue.")],
  [t("Your team fixes production with kubectl now and then, and self-heal is off. What does that store up?", "Tu equipo arregla producción con kubectl de vez en cuando, y self-heal está apagado. ¿Qué problemas va acumulando?"),
    t("Git no longer describes what runs, so reviews, audits and any environment rebuilt from git get the old values. The app sits OutOfSync, so a real drift signal is lost in the noise. And the next automated sync, for any commit, quietly reverts the fix, maybe at night. Make the fix a commit (with a webhook it's live in about a minute), or at least commit it right after.",
      "Git ya no describe lo que corre, así que las revisiones, las auditorías y cualquier entorno reconstruido desde git reciben los valores viejos. La app queda desincronizada, así que una deriva real se pierde en el ruido. Y el siguiente sync automático, por cualquier commit, revierte el arreglo sin avisar, quizás de noche. Haz del arreglo un commit (con un webhook está en vivo en cerca de un minuto), o al menos haz el commit justo después.")],
  [t("A Deployment has an HPA and its manifest in git sets replicas: 3. What goes wrong, and what are the two fixes?", "Un Deployment tiene un HPA y su manifiesto en git fija replicas: 3. ¿Qué sale mal, y cuáles son los dos arreglos?"),
    t("Two writers for one field: the HPA scales up, self-heal (or any later sync) sets 3 again and kills pods, and they keep fighting. Either remove replicas from the manifest so the HPA owns it, which is what the Kubernetes docs recommend (with client-side apply, removing it can briefly reset the Deployment to one replica; the docs describe the safe migration), or keep it and add ignoreDifferences for /spec/replicas with RespectIgnoreDifferences=true.",
      "Dos escritores para un mismo campo: el HPA escala hacia arriba, self-heal (o cualquier sync posterior) vuelve a poner 3 y elimina pods, y siguen peleando. O quitas replicas del manifiesto para que sea del HPA, que es lo que recomienda la documentación de Kubernetes (con apply del lado del cliente, quitarlo puede dejar el Deployment en una réplica por un momento; la documentación describe la migración segura), o lo dejas y agregas ignoreDifferences para /spec/replicas con RespectIgnoreDifferences=true.")],
  [t("A merge sometimes takes minutes to reach the cluster. Why, and how would you shorten it?", "A veces una fusión tarda minutos en llegar al clúster. ¿Por qué, y cómo lo acortarías?"),
    t("The reconciler watches the cluster but polls git: Argo CD reads it every 120 s plus up to 60 s of jitter by default, and then the rollout takes its own time. Add a webhook from the git host so it reads at once, and keep the timer as a backstop. Asking it to refresh (argocd app get --refresh, or the Refresh button) also reads git now. Shortening the timer for every app costs load on the repo server and the git host.",
      "El reconciliador observa el clúster pero consulta git periódicamente: Argo CD lo lee por defecto cada 120 s más hasta 60 s de variación, y después el despliegue toma su propio tiempo. Agrega un webhook del servidor de git para que lea enseguida, y deja el temporizador como respaldo. Pedirle que refresque (argocd app get --refresh, o el botón Refresh) también lee git en el momento. Acortar el temporizador para todas las apps cuesta carga en el repo server y en el servidor de git.")],
  [t("Why is prune off by default, and how do you delete something safely under GitOps?", "¿Por qué prune viene apagado por defecto, y cómo borras algo de forma segura con GitOps?"),
    t("Because a mistake in what git renders (a wrong path, a broken generator) would otherwise delete live resources. The cost of leaving it off: deleted things keep running, cost money, and the app never shows in sync. Turn prune on where that risk is acceptable, protect resources that must never go with the annotation argocd.argoproj.io/sync-options: Prune=false, and delete by removing the manifest in a reviewed commit, then letting the reconciler (or a manual sync with prune) remove it.",
      "Porque un error en lo que git produce (una ruta equivocada, un generador roto) borraría recursos en vivo. El costo de dejarlo apagado: lo borrado sigue corriendo, cuesta dinero, y la app nunca se ve sincronizada. Activa prune donde ese riesgo es aceptable, protege con la anotación argocd.argoproj.io/sync-options: Prune=false los recursos que nunca deben irse, y borra quitando el manifiesto en un commit revisado, para que luego lo quite el reconciliador (o un sync manual con prune).")],
];

export default defineLesson({
  title: t("GitOps Reconcile Workbench", "Banco de trabajo: reconciliación GitOps"),
  eyebrow: t("Systems lesson 78 · GitOps reconcile", "Lección de sistemas 78 · Reconciliación GitOps"),
  lede: t("With GitOps, git holds the desired state and a reconciler in the cluster keeps the live state matching it: it reads git, compares, and syncs the difference. That makes git the way to change things, and anything changed around it gets undone, overwritten later, or left behind. This lesson runs a blueprint office, a reconciler and a cluster floor: watch it, predict what surprises people, then explain it back.",
    "Con GitOps, git guarda el estado deseado y un reconciliador en el clúster mantiene el estado en vivo igual a él: lee git, compara y sincroniza la diferencia. Eso hace de git la forma de cambiar las cosas, y lo que se cambia por fuera se deshace, se pisa más tarde o queda olvidado. Esta lección usa una oficina de planos, un reconciliador y un piso de clúster: mírala, predice lo que sorprende a la gente y después explícalo."),
  machine: {
    intro: t("The developer merges releases into GIT; the reconciler walks over to read git on its timer (or when the webhook bell rings) and syncs what differs; the on-call engineer edits the cluster with kubectl now and then. Flip self-heal and prune, switch to a webhook, put replicas in git, double the traffic, or merge, hotfix and delete things yourself. The settings act on the running machine.",
      "Quien desarrolla fusiona versiones en GIT; el reconciliador va a leer git con su temporizador (o cuando suena la campana del webhook) y sincroniza lo que difiere; la persona de guardia edita el clúster con kubectl de vez en cuando. Cambia self-heal y prune, pasa a un webhook, pon las réplicas en git, duplica el tráfico, o fusiona, haz hotfixes y borra cosas tú. Los ajustes actúan sobre la máquina en marcha."),
    plate: {
      title: t("Blueprint office", "Oficina de planos"),
      keys: [
        { mark: "lit", label: t("What differs from git right now: a counter's housing, a pod on another version, OUT OF SYNC, the worker's lamp; a card git changed that the reconciler hasn't read; whoever is acting", "Lo que difiere de git en este momento: el marco de un contador, un pod con otra versión, DESINCRONIZADA, la lámpara del worker; una ficha que git cambió y el reconciliador no leyó; quien está actuando") },
        { mark: "raised", label: t("Pods on WEB, their version on the front; a low pod is still starting", "Pods sobre WEB, con su versión al frente; un pod bajo todavía está arrancando") },
        { mark: "flat", label: t("The aisle the reconciler walks, between git and the cluster", "El pasillo que recorre el reconciliador, entre git y el clúster") },
      ],
      caption: t(
        "GIT's wall shows the head revision and one card per resource with the value git wants: web's version and replicas (HPA when git leaves them to it), config's LIMIT, and whether the worker exists. The reconciler's wall shows the revision it has read (HAS REV) and the seconds until it reads git again (NEXT CHECK); when the two revisions differ, git is ahead and the changed cards light. Once it has read a new revision, it walks to every resource that differs and applies git's value (an automated sync). With self-heal on it does the same, within seconds, for any live change, waiting longer each time the same drift comes back. With prune on, a sync also deletes what git no longer has. The HPA sets web's replicas from the load; each ready pod serves " + CAP + " requests a second, and what they can't serve, or what a bad version breaks, fails.",
        "La pared de GIT muestra la revisión de la cabeza y una ficha por recurso con el valor que quiere git: la versión y las réplicas de web (HPA cuando git las deja a su cargo), el LÍMITE de config y si el worker existe. La pared del reconciliador muestra la revisión que leyó (TIENE REV) y los segundos que faltan para que vuelva a leer git (REVISA EN); cuando las dos revisiones difieren, git va adelante y las fichas cambiadas se encienden. Al leer una revisión nueva, recorre cada recurso que difiere y aplica el valor de git (un sync automático). Con self-heal hace lo mismo, en segundos, ante cualquier cambio en vivo, y espera más cada vez que vuelve la misma deriva. Con prune, un sync también borra lo que git ya no tiene. El HPA fija las réplicas de web según la carga; cada pod listo atiende " + CAP + " solicitudes por segundo, y lo que no alcanzan a atender, o lo que rompe una versión mala, falla.",
      ),
      stage: { "data-gitops": "" },
      label: t("GitOps reconcile simulation. Space pauses or resumes.", "Simulación de reconciliación GitOps. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["rev", t("Git → read", "Git → leída"), "41 → 41"],
      ["out", t("Out of sync", "Desincronizada"), t("in sync", "sincronizada")],
      ["syncs", t("Syncs", "Syncs")],
      ["undone", t("Live edits undone", "Ediciones deshechas")],
      ["pods", t("Pods ready / replicas", "Pods listos / réplicas"), "3 / 3"],
      ["failed", t("Failed requests", "Solicitudes fallidas")],
    ],
    controls: [
      { seg: "selfHeal", label: t("Self-heal", "Self-heal"), options: [["on", t("On", "Sí")], ["off", t("Off", "No")]], value: "on" },
      { seg: "prune", label: t("Prune", "Prune"), options: [["on", t("On", "Sí")], ["off", t("Off", "No")]], value: "on" },
      { seg: "poll", label: t("Git check", "Lectura de git"), options: [["poll", t("Timer, 2–3 min", "Temporizador, 2–3 min")], ["hook", t("Webhook", "Webhook")]], value: "poll" },
      { seg: "replicas", label: t("web's replicas", "Réplicas de web"), options: [["hpa", t("Left to the HPA", "A cargo del HPA")], ["git", t("3, in git", "3, en git")]], value: "hpa" },
      { seg: "traffic", label: t("Traffic", "Tráfico"), options: [["normal", t("Normal", "Normal")], ["high", t("Double", "El doble")]], value: "normal" },
      { speed: true, options: [[1, "×1"], [4, "×4"], [15, "×15"], [60, "×60"]], value: 4 },
      { actions: [["release", t("Merge a release", "Fusionar una versión")], ["hotfix", t("Hotfix the cluster", "Hotfix en el clúster")], ["worker", t("Remove the worker in git", "Quitar el worker de git")], ["sync", t("Sync now", "Sincronizar ya")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The reconciler follows Argo CD's defaults: it reads git every 120 s plus up to 60 s, and repeated self-heals wait 2 s, then three times longer each time, up to 5 minutes. Pods take " + STARTUP + " s to start; the HPA checks every 15 s and here aims for pods 70% busy. Other times are illustrative. Speed ×4 to ×60 makes the timers come round quickly.",
      "El reconciliador sigue los valores por defecto de Argo CD: lee git cada 120 s más hasta 60 s, y las autorreparaciones repetidas esperan 2 s, luego tres veces más cada vez, hasta 5 minutos. Los pods tardan " + STARTUP + " s en arrancar; el HPA revisa cada 15 s y aquí apunta a pods ocupados al 70%. Los demás tiempos son ilustrativos. Las velocidades ×4 a ×60 hacen que los temporizadores lleguen rápido."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs: web serves " + LOAD.normal + " requests a second on 3 pods, and the engineer's hotfix raises config's LIMIT from " + LIMIT.git + " to " + LIMIT.hotfix + ".",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija: web atiende " + LOAD.normal + " solicitudes por segundo con 3 pods, y el hotfix sube el LÍMITE de config de " + LIMIT.git + " a " + LIMIT.hotfix + "."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The reconciler follows the behaviour and defaults documented for <a href="https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/" target="_blank" rel="noopener">Argo CD's automated sync</a>; Flux has the same ideas: each Kustomization has an interval and a prune setting.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. El reconciliador sigue el comportamiento y los valores por defecto documentados del <a href="https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/" target="_blank" rel="noopener">sync automático de Argo CD</a>; Flux tiene las mismas ideas: cada Kustomization tiene un intervalo y una opción de prune.`),
  css: `
.iso-stage [data-layer] text{pointer-events:none}
[data-gitops] [data-pod] .iso-face-text{font-weight:600}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    WALKER: walkerSvg(false),
    WALKER_LIT: litFill(walkerSvg(true)),
    POD_READY: podSvg(POD.h),
    POD_START: podSvg(POD.hStart),
  },
});
