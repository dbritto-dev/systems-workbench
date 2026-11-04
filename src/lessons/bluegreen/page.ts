// @ts-nocheck: content ported as-is
// Systems lesson 09 · Blue-green deploys: two press lines behind one gate.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, secs1 } from "../../lib/format";
import { buildFigure, P, GEOMETRY } from "./figure";
import { EXP } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const RESULTS = { rollback: EXP.rollback(), shutdown: EXP.shutdown(), cold: EXP.cold(), drain: EXP.drain(), migration: EXP.migration() };

// What each card shows after a run.
const RUNS = {
  rollback: () => { const r = RESULTS.rollback, top = r.rolling * 1.05; return {
    verdict: t("Errors stopped " + Math.round(r.flip) + " s after the bad flip with blue-green (15 s of it waiting for the alarm), against " + Math.round(r.rolling) + " s with a rolling redeploy. Failed requests: " + Math.round(r.flipErrors) + " against " + Math.round(r.rollingErrors) + ".",
      "Con azul-verde, los errores pararon " + Math.round(r.flip) + " s después del cambio malo (15 s de eso esperando la alarma), contra " + Math.round(r.rolling) + " s con un redespliegue gradual. Solicitudes fallidas: " + Math.round(r.flipErrors) + " contra " + Math.round(r.rollingErrors) + "."),
    bars: [[t("Flip back", "Volver atrás"), r.flip / top, Math.round(r.flip) + " s", true], [t("Rolling redeploy", "Redespliegue gradual"), r.rolling / top, Math.round(r.rolling) + " s"]] }; },
  shutdown: () => { const r = RESULTS.shutdown, top = Math.max(r.kept.stop, r.down.stop) * 1.05; return {
    verdict: t("From the alarm until errors stopped: " + secs1(r.kept.stop) + " with blue kept running, " + Math.round(r.down.stop) + " s with blue shut down (" + r.redeploy + " s to rebuild it, then a cold cache). Requests failed after the alarm: " + Math.round(r.kept.failed) + " against " + Math.round(r.down.failed) + ".",
      "Desde la alarma hasta que pararon los errores: " + secs1(r.kept.stop) + " con azul en marcha, " + Math.round(r.down.stop) + " s con azul apagado (" + r.redeploy + " s para reconstruirlo, y luego una caché fría). Solicitudes fallidas después de la alarma: " + Math.round(r.kept.failed) + " contra " + Math.round(r.down.failed) + "."),
    bars: [[t("Blue kept running", "Azul en marcha"), r.kept.stop / top, secs1(r.kept.stop)], [t("Blue shut down", "Azul apagado"), r.down.stop / top, Math.round(r.down.stop) + " s", true]] }; },
  cold: () => { const r = RESULTS.cold, top = Math.max(r.cold.p95, r.warm.p95) * 1.1; return {
    verdict: t("In the 30 s after the flip, p95 latency was " + secs1(r.warm.p95) + " with a warm green and " + secs1(r.cold.p95) + " with a cold one, and the cold flip turned away about " + Math.round(r.cold.turned) + " requests (warm: " + Math.round(r.warm.turned) + ").",
      "En los 30 s después del cambio, la latencia p95 fue de " + secs1(r.warm.p95) + " con un verde precalentado y de " + secs1(r.cold.p95) + " con uno frío, y el cambio en frío rechazó unas " + Math.round(r.cold.turned) + " solicitudes (precalentado: " + Math.round(r.warm.turned) + ")."),
    bars: [[t("Before the flip", "Antes del cambio"), r.warm.before / top, secs1(r.warm.before)], [t("Warm green", "Verde precalentado"), r.warm.p95 / top, secs1(r.warm.p95)], [t("Cold green", "Verde frío"), r.cold.p95 / top, secs1(r.cold.p95), true]] }; },
  drain: () => { const r = RESULTS.drain, top = Math.max(r.off, 1) * 1.1; return {
    verdict: t("Without draining, about " + r.off.toFixed(1) + " requests failed at each flip. With draining: " + Math.round(r.on) + ".",
      "Sin drenado, fallaron unas " + r.off.toFixed(1) + " solicitudes en cada cambio. Con drenado: " + Math.round(r.on) + "."),
    bars: [[t("Draining off", "Sin drenado"), r.off / top, r.off.toFixed(1), true], [t("Draining on", "Con drenado"), r.on / top, String(Math.round(r.on))]] }; },
  migration: () => { const r = RESULTS.migration; return {
    verdict: t("After the rollback, blue failed " + pct(r.breaking) + " of requests with the breaking migration, and " + pct(r.compatible) + " with a compatible one.",
      "Después del rollback, azul hizo fallar el " + pct(r.breaking) + " de las solicitudes con la migración incompatible, y el " + pct(r.compatible) + " con una compatible."),
    bars: [[t("Breaking", "Incompatible"), r.breaking, pct(r.breaking), true], [t("Compatible", "Compatible"), r.compatible, pct(r.compatible)]] }; },
};

const EXPERIMENTS = [
  {
    id: "rollback",
    title: t("Roll back a bad release", "Revertir una versión mala"),
    change: t("Green ships with a bug that fails 40% of requests · the alarm fires 15 s after the flip", "Verde sale con un bug que hace fallar el 40% de las solicitudes · la alarma suena 15 s después del cambio"),
    question: t("You roll back by flipping the gate back to blue. How long until errors stop, compared with redeploying the old version server by server (one minute each)?", "Haces el rollback devolviendo la compuerta a azul. ¿Cuánto tardan en parar los errores, comparado con redesplegar la versión anterior servidor por servidor (un minuto cada uno)?"),
    options: [
      t("About the same: the old code must come back", "Más o menos lo mismo: el código anterior tiene que volver"),
      t("Seconds, against minutes for the redeploy", "Segundos, contra minutos con el redespliegue"),
      t("Longer: flipping back drops everything in flight", "Más: volver atrás descarta todo lo que está en curso"),
    ],
    answer: 1,
    why: t("Blue never went away. It is still running the old version, with a warm cache, so flipping back is just a change of route. A rolling redeploy has to rebuild each server (lesson 10, Rolling deploys), and every minute it takes, the servers still on the bad version keep failing requests.", "Azul nunca se fue. Sigue ejecutando la versión anterior, con la caché caliente, así que volver es solo un cambio de ruta. Un redespliegue gradual tiene que reconstruir cada servidor (lección 10, Despliegues graduales), y en cada minuto que tarda, los servidores que siguen en la versión mala siguen haciendo fallar solicitudes."),
    watch: { release: "bad", warm: "on", draining: "on", migration: "compatible", script: [[3, "flip"], [18, "flip"]] },
  },
  {
    id: "shutdown",
    title: t("Shut blue down to save money", "Apagar azul para ahorrar"),
    change: t("Green fails 40% of requests, and the alarm fires 40 s after the flip · blue kept running → shut down 20 s after the flip", "Verde hace fallar el 40% de las solicitudes, y la alarma suena 40 s después del cambio · azul en marcha → apagado 20 s después del cambio"),
    question: t("Idle blue doubles the bill, so it is shut down soon after the flip. The alarm fires and you roll back to blue. How long until errors stop?", "Azul inactivo duplica la factura, así que se apaga poco después del cambio. Suena la alarma y haces el rollback a azul. ¿Cuánto tardan en parar los errores?"),
    options: [
      t("Seconds: flip the gate back, as before", "Segundos: devuelves la compuerta, como antes"),
      t("Over a minute: blue must be rebuilt first", "Más de un minuto: antes hay que reconstruir azul"),
      t("Seconds, then a burst of cache misses", "Segundos, y luego una ráfaga de fallos de caché"),
    ],
    answer: 1,
    why: t("The instant rollback is the idle copy. Once blue is gone, rolling back means deploying the old version again: here a minute to bring its three servers back, then a cold cache that turns requests away while it fills, and green keeps failing requests all that time. That is the trade: a second copy of production, doing no work, buys a rollback in seconds. Shut blue down only once green has proved itself, or keep a smaller warm copy and accept a slower rollback.", "El rollback instantáneo es la copia inactiva. Cuando azul ya no está, revertir significa desplegar otra vez la versión anterior: aquí un minuto para recuperar sus tres servidores, y luego una caché fría que rechaza solicitudes mientras se llena, y verde sigue haciendo fallar solicitudes todo ese tiempo. Ese es el intercambio: una segunda copia de producción, sin hacer nada, compra un rollback en segundos. Apaga azul solo cuando verde ya demostró que funciona, o mantén una copia caliente más pequeña y acepta un rollback más lento."),
    watch: { release: "bad", warm: "on", draining: "on", migration: "compatible", keep: "off", script: [[3, "flip"], [43, "flip"]] },
  },
  {
    id: "cold",
    title: t("A cold green", "Un verde en frío"),
    change: t("Green starts with an empty cache · you flip as soon as it is up", "Verde arranca con la caché vacía · cambias en cuanto está arriba"),
    question: t("Right after the flip, what happens to latency?", "Justo después del cambio, ¿qué pasa con la latencia?"),
    options: [
      t("Nothing: green runs the same code paths", "Nada: verde ejecuta el mismo código"),
      t("It spikes until green's cache fills", "Se dispara hasta que se llena la caché de verde"),
      t("It drops: a fresh process is faster", "Baja: un proceso nuevo es más rápido"),
    ],
    answer: 1,
    why: t("Every request misses on a cold cache, misses take four times longer, and three workers can't keep up with the traffic until the cache fills. The queue fills, and once it is full new requests are turned away. Warming green first (replaying traffic, or preloading the hot keys) makes the flip a non-event.", "Con la caché fría cada solicitud es un fallo de caché (miss), cada fallo tarda cuatro veces más, y tres workers no dan abasto con el tráfico hasta que la caché se llena. La cola se llena, y cuando está llena las solicitudes nuevas se rechazan. Precalentar verde antes (repitiendo tráfico o cargando las claves más usadas) hace que el cambio pase desapercibido."),
    watch: { release: "good", warm: "off", draining: "on", migration: "compatible", script: [[3, "flip"]] },
  },
  {
    id: "drain",
    title: t("Flip without draining", "Cambiar sin drenar"),
    change: t("Draining off · blue stops the moment the gate flips", "Drenado desactivado · azul se detiene en cuanto cambia la compuerta"),
    question: t("What happens to the requests already on blue's lane, in its queue or under its presses?", "¿Qué pasa con las solicitudes que ya están en el carril de azul, en su cola o bajo sus prensas?"),
    options: [
      t("They finish on blue anyway", "Terminan en azul de todas formas"),
      t("They move over to green", "Se pasan a verde"),
      t("They fail with errors", "Fallan con errores"),
    ],
    answer: 2,
    why: t("Those requests were already routed. If blue stops at the flip, they are cut off and their clients get errors. With connection draining, blue takes no new requests but finishes the ones it has, so the switch drops nothing.", "Esas solicitudes ya estaban enrutadas. Si azul se detiene en el cambio, se cortan y sus clientes reciben errores. Con el drenado de conexiones (connection draining), azul no acepta solicitudes nuevas pero termina las que tiene, así que el cambio no pierde nada."),
    watch: { release: "good", warm: "on", draining: "off", migration: "compatible", script: [[3, "flip"]] },
  },
  {
    id: "migration",
    title: t("A migration blue can't read", "Una migración que azul no puede leer"),
    change: t("Green's migration drops a column blue still reads · then green turns out to be bad", "La migración de verde elimina una columna que azul todavía lee · y luego verde resulta mala"),
    question: t("You flip back to blue. What happens?", "Vuelves a azul. ¿Qué pasa?"),
    options: [
      t("Rollback works: blue is untouched", "El rollback funciona: azul está intacto"),
      t("Blue fails almost every request", "Azul hace fallar casi todas las solicitudes"),
      t("Only requests for new records fail", "Solo fallan las solicitudes de registros nuevos"),
    ],
    answer: 1,
    why: t("The database is shared. Green's migration changed it for both sides, so the rollback brings back code that no longer matches the schema. Blue-green only rolls back code. Migrations have to work for both versions: add the new column first (expand), switch the code, and drop the old one only after blue is gone for good (contract). Lesson 10, Rolling deploys, shows the same trap in a rolling deploy.", "La base de datos es compartida. La migración de verde la cambió para los dos lados, así que el rollback trae de vuelta código que ya no coincide con el esquema. Azul-verde solo revierte el código. Las migraciones tienen que funcionar con las dos versiones: primero agrega la columna nueva (expandir, expand), cambia el código y elimina la anterior solo cuando azul ya no vaya a volver (contraer, contract). La lección 10, Despliegues graduales, muestra la misma trampa en un despliegue gradual."),
    watch: { release: "bad", warm: "on", draining: "on", migration: "breaking", script: [[3, "flip"], [18, "flip"]] },
  },
];

const QUESTIONS = [
  [t("Why is rolling back a blue-green deploy so much faster than rolling back a rolling deploy?", "¿Por qué revertir un despliegue azul-verde es mucho más rápido que revertir un despliegue gradual?"),
    t("Blue is still running the old version, warm, so rollback is only a change of route at the gate. A rolling rollback has to rebuild servers one by one, and the bad version keeps serving traffic until the last one is replaced (lesson 10, Rolling deploys).", "Azul sigue ejecutando la versión anterior, en caliente, así que el rollback es solo un cambio de ruta en la compuerta. Un rollback gradual tiene que reconstruir los servidores uno por uno, y la versión mala sigue atendiendo tráfico hasta que se reemplaza el último (lección 10, Despliegues graduales).")],
  [t("Your manager asks why the deploy doubles the cloud bill for an hour. How do you explain it, and when is it worth it?", "Tu jefa pregunta por qué el despliegue duplica la factura de la nube durante una hora. ¿Cómo lo explicas, y cuándo vale la pena?"),
    t("Both sides are full production while the old one is kept for rollback, and the idle one does no work. It is worth it when a bad release is expensive and you need to undo it in seconds; shutting the idle side down early saves money but turns the rollback into a redeploy; for small, low-risk services, a rolling or canary deploy may be the better trade.", "Los dos lados son producción completa mientras se conserva el anterior para el rollback, y el inactivo no hace trabajo. Vale la pena cuando una versión mala sale cara y necesitas deshacerla en segundos; apagar pronto el lado inactivo ahorra dinero pero convierte el rollback en un redespliegue; para servicios pequeños y de bajo riesgo, un despliegue gradual o canario (canary) puede ser mejor negocio.")],
  [t("What would you do before flipping to a freshly deployed green, and why?", "¿Qué harías antes de cambiar a un verde recién desplegado, y por qué?"),
    t("Warm it: let its caches fill, open its connection pools, run smoke tests against it. Otherwise the first minute after the flip runs on cold caches with slow misses, latency spikes and requests may be turned away.", "Precalentarlo: dejar que se llenen sus cachés, abrir sus pools de conexiones, ejecutar pruebas de humo (smoke tests) contra él. Si no, el primer minuto después del cambio funciona con cachés frías y fallos de caché (misses) lentos, la latencia se dispara y algunas solicitudes pueden rechazarse.")],
  [t("What is connection draining, and what goes wrong without it?", "¿Qué es el drenado de conexiones (connection draining), y qué sale mal sin él?"),
    t("The old side stops taking new requests but finishes the ones it already has before shutting down. Without it, requests that were routed just before the flip are cut off and fail.", "El lado anterior deja de aceptar solicitudes nuevas pero termina las que ya tiene antes de apagarse. Sin él, las solicitudes enrutadas justo antes del cambio se cortan y fallan.")],
  [t("Green needs to rename a column. How do you ship that with blue-green and still be able to roll back?", "Verde necesita renombrar una columna. ¿Cómo lo publicas con azul-verde y sigues pudiendo hacer rollback?"),
    t("Expand and contract: add the new column and write both, deploy green reading the new one, keep the old column until blue is gone and rollback is no longer needed, then drop it in a later deploy.", "Expandir y contraer (expand and contract): agrega la columna nueva y escribe en las dos, despliega verde leyendo la nueva, conserva la columna anterior hasta que azul ya no exista y no haga falta el rollback, y elimínala en un despliegue posterior.")],
  [t("Blue-green flips all traffic at once. What risk does that leave that a canary deploy reduces?", "Azul-verde cambia todo el tráfico de una vez. ¿Qué riesgo deja eso que un despliegue canario reduce?"),
    t("Every user hits the new version at the same moment, so a bug that only shows under real traffic affects everyone until the rollback. A canary sends a small share first, so only a few users see the bug (lesson 08, Canary deploys).", "Todos los usuarios llegan a la versión nueva al mismo tiempo, así que un bug que solo aparece con tráfico real afecta a todos hasta el rollback. Un canario manda primero una parte pequeña, así que solo unos pocos usuarios ven el bug (lección 08, Despliegues canario).")],
];

export default defineLesson({
  title: t("Blue-Green Workbench", "Banco de trabajo: despliegues azul-verde"),
  eyebrow: t("Systems lesson 09 · Blue-green deploys", "Lección de sistemas 09 · Despliegues azul-verde"),
  lede: t("Run two complete copies of production. Deploy the new version to the idle one, then move all traffic over with one switch, and keep the old one ready to switch back. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.", "Mantén dos copias completas de producción. Despliega la versión nueva en la que está inactiva, mueve todo el tráfico con un solo cambio y deja la anterior lista para volver. Esto es un despliegue azul-verde (blue-green deploy). Esta lección construye la idea de tres formas: mira cómo lo hace una máquina, predice qué la rompe y luego explícalo con tus palabras."),
  machine: {
    intro: t("The back line, engraved BLUE, is the version in production. The front line, engraved GREEN, is the new version, already deployed and waiting; the idle line is dimmed. Flip the gate and watch where the requests go, then try a bad release, a cold cache, no draining, or shutting blue down after the flip.", "La línea del fondo, grabada AZUL, es la versión en producción. La línea del frente, grabada VERDE, es la versión nueva, ya desplegada y esperando; la línea inactiva se ve atenuada. Cambia la compuerta y mira adónde van las solicitudes; luego prueba una versión mala, una caché fría, quitar el drenado o apagar azul después del cambio."),
    plate: {
      title: t("Two press lines", "Dos líneas de prensas"),
      keys: [
        { mark: "lit", label: t("Requests on green, the new version, and the live line's presses", "Solicitudes en verde, la versión nueva, y las prensas de la línea en vivo") },
        { mark: "raised", label: t("Two press lines, BLUE and GREEN; the idle one is dimmed", "Dos líneas de prensas, AZUL y VERDE; la inactiva se ve atenuada") },
        { mark: "flat", label: t("Records cabinet: the shared database", "Archivero de registros: la base de datos compartida") },
      ],
      caption: t("Requests ride the infeed to the gate. The gate's arm points at the live line, and every request that reaches it goes there. Each line has its own cache tray (the cards are how full it is), three presses, an outfeed tray for served requests and a reject bin for errors. Both lines read and write the same records cabinet. With \"Blue after the flip\" set to shut down, blue's servers are gone 20 s after the flip, and flipping back means rebuilding them first.", "Las solicitudes viajan por la banda de entrada hasta la compuerta. El brazo de la compuerta apunta a la línea en vivo, y cada solicitud que llega va hacia allá. Cada línea tiene su propia bandeja de caché (las tarjetas muestran qué tan llena está), tres prensas, una bandeja de salida para las solicitudes atendidas y una caja de descarte para los errores. Las dos líneas leen y escriben en el mismo archivero de registros. Con \"Azul tras el cambio\" en apagado, los servidores de azul desaparecen 20 s después del cambio, y volver significa reconstruirlos primero."),
      stage: { "data-office": "" },
      label: t("Blue-green deploy simulation. Space pauses or resumes.", "Simulación de despliegue azul-verde. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["served", t("Served", "Atendidas")], ["errors", t("Errors", "Errores")], ["p95", t("p95 latency", "Latencia p95"), "–"], ["recover", t("Time to recover", "Tiempo de recuperación"), "–"], ["running", t("Servers running", "Servidores activos"), "6"], ["busy", t("Presses busy", "Prensas ocupadas"), "0"]],
    controls: [
      { seg: "release", label: t("Green release", "Versión verde"), options: [["good", t("Good", "Buena")], ["bad", t("Bad", "Mala")]], value: "good" },
      { seg: "warm", label: t("Warm green first", "Precalentar verde"), options: [["on", t("On", "Sí")], ["off", t("Off", "No")]], value: "on" },
      { seg: "draining", label: t("Connection draining", "Drenado de conexiones"), options: [["on", t("On", "Sí")], ["off", t("Off", "No")]], value: "on" },
      { seg: "migration", label: t("Green's migration", "Migración de verde"), options: [["compatible", "Compatible"], ["breaking", t("Breaking", "Incompatible")]], value: "compatible" },
      { seg: "keep", label: t("Blue after the flip", "Azul tras el cambio"), options: [["on", t("Kept running", "En marcha")], ["off", t("Shut down after 20 s", "Apagado a los 20 s")]], value: "on" },
      { speed: true },
      { actions: [["flip", t("Flip to green", "Cambiar a verde"), { primary: true }], ["redeploy", t("Redeploy green", "Redesplegar verde")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the figure, averaged over six runs: requests arrive at 5 per second, and each line has three presses.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la figura, promediados en seis ejecuciones: llegan 5 solicitudes por segundo y cada línea tiene tres prensas."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  // The idle line is dimmed (a shut-down one more); the item pool is hidden until placed.
  css: `
[data-line]{transition:opacity .3s}
[data-line][data-idle]{opacity:.45}
[data-line][data-down]{opacity:.2}
[data-pool]{display:none}
`,
  data: {
    P,
    G: GEOMETRY,
    // The Watch handler names the experiment in the readout.
    TITLES: Object.fromEntries(EXPERIMENTS.map(({ id, title }) => [id, title])),
  },
});
