// @ts-nocheck: content ported as-is
// Systems lesson 01 · Caching: a records office with a card rack (the cache) in front of an archive chest.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, secs2 } from "../../lib/format";
import { buildFigure, P, GEOMETRY } from "./figure";
import { experimentResults } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page ran them in
// the browser on click; they are seeded, so the numbers are the same).
const RESULTS = experimentResults();

// What each card shows after a run.
const RUNS = {
  ttl: () => { const a = RESULTS.base, b = RESULTS.ttl; return {
    verdict: t("Hit rate " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", average wait " + secs2(a.avgTime) + " → " + secs2(b.avgTime) + ".",
      "Tasa de aciertos " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", espera media " + secs2(a.avgTime) + " → " + secs2(b.avgTime) + "."),
    bars: [[t("TTL 60 s", "TTL 60 s"), a.hitRate, pct(a.hitRate)], [t("TTL 6 s", "TTL 6 s"), b.hitRate, pct(b.hitRate), true]] }; },
  size: () => { const a = RESULTS.base, b = RESULTS.size; return {
    verdict: t("Room fell to a third; hit rate only fell from " + pct(a.hitRate) + " to " + pct(b.hitRate) + ".",
      "El espacio cayó a un tercio; la tasa de aciertos solo bajó de " + pct(a.hitRate) + " a " + pct(b.hitRate) + "."),
    bars: [[t("12 slots", "12 lugares"), a.hitRate, pct(a.hitRate)], [t("4 slots", "4 lugares"), b.hitRate, pct(b.hitRate), true]] }; },
  even: () => { const a = RESULTS.base, b = RESULTS.even; return {
    verdict: t("Hit rate " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", close to 12 of 40 records (30%).",
      "Tasa de aciertos " + pct(a.hitRate) + " → " + pct(b.hitRate) + ", cerca de 12 de 40 registros (30%)."),
    bars: [[t("Popular traffic", "Tráfico popular"), a.hitRate, pct(a.hitRate)], [t("Even traffic", "Tráfico parejo"), b.hitRate, pct(b.hitRate), true]] }; },
  flush: () => { const { warm, first, later } = RESULTS.flush; const top = Math.max(warm, first, later) * 1.1; const more = Math.round(100 * (first / warm - 1)); return {
    verdict: t("The first 10 requests after emptying took " + more + "% longer on average; requests 11 to 30 were already back to " + secs2(later) + ".",
      "Las primeras 10 solicitudes después de vaciar tardaron en promedio " + more + "% más; las solicitudes 11 a 30 ya habían vuelto a " + secs2(later) + "."),
    bars: [[t("Never emptied", "Nunca vaciado"), warm / top, secs2(warm)], [t("First 10 after", "Primeras 10 después"), first / top, secs2(first), true], [t("Requests 11–30", "Solicitudes 11–30"), later / top, secs2(later)]] }; },
  stale: () => { const { off, on } = RESULTS.stale; return {
    verdict: t(pct(off) + " of rack reads of #1 were stale. With invalidate on write: " + pct(on) + ".",
      pct(off) + " de las lecturas de #1 desde el estante fueron obsoletas. Con invalidar al escribir: " + pct(on) + "."),
    bars: [[t("Invalidate off", "Invalidar: no"), off, pct(off), true], [t("Invalidate on", "Invalidar: sí"), on, pct(on)]] }; },
};

const EXPERIMENTS = [
  {
    id: "ttl",
    title: t("Shorter freshness", "Frescura más corta"),
    change: t("TTL 60 s → 6 s · a card now leaves the rack ten times sooner", "TTL 60 s → 6 s · ahora una ficha sale del estante diez veces antes"),
    question: t("What happens to the share of requests answered from the rack?", "¿Qué pasa con la parte de las solicitudes que se responden desde el estante?"),
    options: [
      t("It barely moves: the popular cards are still asked for all the time", "Casi no cambia: las fichas populares se siguen pidiendo todo el tiempo"),
      t("It falls by about half", "Cae más o menos a la mitad"),
      t("It falls to almost nothing", "Cae casi a cero"),
    ],
    answer: 1,
    why: t("A copy only helps if the same record is asked for again before it expires. The most popular record is almost half of all requests, so it still hits. The next ones come back every 20 seconds to a couple of minutes, long after a 6 s card has gone. A shorter TTL buys freshness with trips to the archive.",
      "Una copia solo sirve si alguien vuelve a pedir el mismo registro antes de que caduque. El registro más popular es casi la mitad de todas las solicitudes, así que sigue acertando. Los siguientes vuelven cada 20 segundos a un par de minutos, mucho después de que una ficha de 6 s se fue. Un TTL más corto paga la frescura con viajes al archivo."),
    watch: { ttl: 6, slots: 12, traffic: "popular" },
  },
  {
    id: "size",
    title: t("A smaller rack", "Un estante más pequeño"),
    change: t("Rack 12 slots → 4 slots · a third of the room", "Estante de 12 lugares → 4 lugares · un tercio del espacio"),
    question: t("The rack can now hold 4 of the 40 records. The hit rate…", "Ahora el estante guarda 4 de los 40 registros. La tasa de aciertos…"),
    options: [
      t("Falls to a third of what it was, like the room", "Cae a un tercio de lo que era, igual que el espacio"),
      t("Drops, but much less than the room did", "Baja, pero mucho menos que el espacio"),
      t("Stays the same", "Se mantiene igual"),
    ],
    answer: 1,
    why: t("When the rack is full, the card that has gone unused longest is taken out (least recently used). The few popular records are used all the time, so they stay; it is the rarely asked records that get pushed out, and they were rarely hits anyway.",
      "Cuando el estante está lleno, sale la ficha que lleva más tiempo sin usarse (menos usada recientemente, least recently used, LRU). Los pocos registros populares se usan todo el tiempo, así que se quedan; los que salen son los que casi nadie pide, y esos casi nunca eran aciertos."),
    watch: { ttl: 60, slots: 4, traffic: "popular" },
  },
  {
    id: "even",
    title: t("No favourites", "Sin favoritos"),
    change: t("Popular traffic → even traffic · every record equally likely", "Tráfico popular → tráfico parejo · todos los registros igual de probables"),
    question: t("Same rack, same TTL, but no record is more popular than another. The hit rate…", "Mismo estante, mismo TTL, pero ningún registro es más popular que otro. La tasa de aciertos…"),
    options: [
      t("Stays about the same: the rack is the same size", "Queda más o menos igual: el estante es del mismo tamaño"),
      t("Falls to roughly the share of records the rack can hold", "Cae a más o menos la parte de los registros que cabe en el estante"),
      t("Falls to zero", "Cae a cero"),
    ],
    answer: 1,
    why: t("With even traffic, the chance that the record you want is in the rack is about the share of records the rack holds: 12 of 40 is 30%. Caches pay off because real traffic is uneven: a few things are asked for constantly.",
      "Con tráfico parejo, la probabilidad de que el registro que buscas esté en el estante es más o menos la parte de los registros que el estante guarda: 12 de 40 es 30%. Las cachés rinden porque el tráfico real es desigual: unas pocas cosas se piden todo el tiempo."),
    watch: { ttl: 60, slots: 12, traffic: "even" },
  },
  {
    id: "flush",
    title: t("The rack is emptied", "Se vacía el estante"),
    change: t("Empty the rack while traffic flows · a deploy, a restart, a flush", "Vacía el estante mientras llega tráfico · un despliegue, un reinicio, un vaciado (flush)"),
    question: t("Right after the rack is emptied, how long do requests take?", "Justo después de vaciar el estante, ¿cuánto tardan las solicitudes?"),
    options: [
      t("The same as before: the archive still has everything", "Lo mismo que antes: el archivo todavía tiene todo"),
      t("Slower for a short while, then back to normal", "Más lentas por un rato y luego vuelven a la normalidad"),
      t("Slow until every card has expired once, about a minute", "Lentas hasta que cada ficha haya caducado una vez, cerca de un minuto"),
    ],
    answer: 1,
    why: t("Every request becomes a trip to the archive until the popular cards are back. With skewed traffic that takes only a handful of requests. In a real system those trips arrive all at once, and if they are more than the database can serve, a short refill turns into a queue: a cache stampede (lesson 28, Cache stampede).",
      "Cada solicitud se vuelve un viaje al archivo hasta que regresan las fichas populares. Con tráfico sesgado eso toma solo unas cuantas solicitudes. En un sistema real esos viajes llegan todos a la vez, y si son más de los que la base de datos puede atender, un llenado corto se convierte en una cola: una estampida de caché (lección 28, Cache stampede)."),
    watch: { ttl: 60, slots: 12, traffic: "popular", flush: true },
  },
  {
    id: "stale",
    title: t("A record changes", "Cambia un registro"),
    change: t("Record #1 is updated in the archive · its card is still in the rack", "El registro #1 se actualiza en el archivo · su ficha sigue en el estante"),
    question: t("Over the next 30 requests, of the reads of #1 answered from the rack, how many show the old version?", "En las siguientes 30 solicitudes, de las lecturas de #1 que responde el estante, ¿cuántas muestran la versión vieja?"),
    options: [
      t("All of them: nothing tells the rack", "Todas: nada le avisa al estante"),
      t("About half: the popular card is refetched often", "Más o menos la mitad: la ficha popular se vuelve a traer seguido"),
      t("Most of them: the card expires partway", "Casi todas: la ficha caduca a mitad de camino"),
    ],
    answer: 2,
    why: t("The rack has no idea the archive changed, so it keeps serving its copy until the TTL runs out. Not all of them, though: the card was filed up to a minute before the change, so it often expires during the 30 requests, and the copy fetched after that is the new version. Turning on invalidate on write takes the card out when the record changes, so the next read fetches the new version.",
      "El estante no tiene idea de que el archivo cambió, así que sigue sirviendo su copia hasta que se acaba el TTL. Pero no todas: la ficha se guardó hasta un minuto antes del cambio, así que muchas veces caduca durante las 30 solicitudes, y la copia que se trae después ya es la versión nueva. Si activas invalidar al escribir, la ficha sale cuando cambia el registro, así que la siguiente lectura trae la versión nueva."),
    watch: { ttl: 60, slots: 12, traffic: "popular", invalidate: false, change: true },
  },
];

const QUESTIONS = [
  [t("In the figure a hit takes 0.7 s and a miss 2.75 s. Why does the average wait depend mostly on the hit rate?",
    "En la figura un acierto tarda 0.7 s y un fallo 2.75 s. ¿Por qué la espera media depende sobre todo de la tasa de aciertos?"),
    t("Because misses are four times as expensive. Average wait = hit rate × 0.7 + (1 − hit rate) × 2.75, so each point of hit rate removes about 0.02 s. Making hits faster would barely help; avoiding misses is what matters.",
    "Porque los fallos cuestan cuatro veces más. Espera media = tasa de aciertos × 0.7 + (1 − tasa de aciertos) × 2.75, así que cada punto de tasa de aciertos quita unos 0.02 s. Hacer más rápidos los aciertos casi no ayudaría; lo que importa es evitar los fallos.")],
  [t("The rack holds 12 of 40 records but answers about two-thirds of requests. What about the traffic makes that possible, and what would break it?",
    "El estante guarda 12 de 40 registros pero responde cerca de dos tercios de las solicitudes. ¿Qué tiene el tráfico que lo hace posible, y qué lo rompería?"),
    t("The traffic is skewed: a few records get most of the requests, and those stay in the rack. Even traffic breaks it (hit rate falls to about the rack's share, 30%), and so would a key space so large that even the popular part doesn't fit.",
    "El tráfico está sesgado: unos pocos registros reciben la mayoría de las solicitudes, y esos se quedan en el estante. El tráfico parejo lo rompe (la tasa de aciertos cae a más o menos la parte del estante, 30%), y también un espacio de claves tan grande que ni siquiera la parte popular cabe.")],
  [t("A teammate wants TTL = 1 s \"so prices are always fresh\". What happens, and what would you suggest instead?",
    "Alguien del equipo quiere TTL = 1 s \"para que los precios estén siempre frescos\". ¿Qué pasa, y qué propondrías en su lugar?"),
    t("Most copies expire before anyone asks again, so the hit rate collapses and the database takes nearly all reads. Keep a longer TTL and invalidate the key when the price changes, so freshness comes from the write, not from expiry.",
    "La mayoría de las copias caducan antes de que alguien vuelva a pedirlas, así que la tasa de aciertos se desploma y la base de datos recibe casi todas las lecturas. Deja un TTL más largo e invalida la clave cuando cambie el precio, para que la frescura venga de la escritura y no de la caducidad.")],
  [t("Invalidate on write fixed the stale reads here. Name one way a stale value can still be served.",
    "Invalidar al escribir resolvió aquí las lecturas obsoletas. Nombra una forma en que todavía se puede servir un valor obsoleto."),
    t("A writer that skips the app (a migration, an admin script, another service) doesn't delete the key. Or a race: a reader misses, reads the old row, the writer updates and deletes the key, then the reader stores the old row it read. The TTL is the backstop for both.",
    "Quien escribe sin pasar por la app (una migración, un script de administración, otro servicio) no borra la clave. O una carrera: un lector falla, lee la fila vieja, el escritor actualiza y borra la clave, y luego el lector guarda la fila vieja que leyó. El TTL es la red de seguridad para ambos casos.")],
  [t("Redis restarts during peak traffic. What do you expect in the first seconds, and what would you do before the next deploy?",
    "Redis se reinicia en hora pico. ¿Qué esperas en los primeros segundos, y qué harías antes del próximo despliegue?"),
    t("Every read misses at once, the database gets more reads than it can serve, requests queue and latency jumps. Warm the cache before switching traffic, add capacity headroom on the database, and consider request coalescing (lesson 28, Cache stampede) so one miss per key goes to the database.",
    "Todas las lecturas fallan a la vez, la base de datos recibe más lecturas de las que puede atender, las solicitudes hacen cola y la latencia se dispara. Calienta la caché antes de pasar el tráfico, deja margen de capacidad en la base de datos y considera agrupar solicitudes (request coalescing; lección 28, Cache stampede) para que a la base de datos llegue un solo fallo por clave.")],
  [t("This rack only files a copy after a miss (cache-aside). What changes if the app also writes the new value into the cache on every write (write-through)?",
    "Este estante solo guarda una copia después de un fallo (cache-aside). ¿Qué cambia si la app además escribe el valor nuevo en la caché en cada escritura (write-through)?"),
    t("Reads right after a write hit and see the new value, so the first reader doesn't pay a miss. The cost moves to writes: each one updates two stores, and values that are written but rarely read take up room. The two writes are still separate, so a failure or a race between them can leave the cache out of step; keep a TTL as the backstop.",
    "Las lecturas justo después de una escritura aciertan y ven el valor nuevo, así que el primer lector no paga un fallo. El costo pasa a las escrituras: cada una actualiza dos lugares, y los valores que se escriben pero casi no se leen ocupan espacio. Las dos escrituras siguen siendo separadas, así que una falla o una carrera entre ellas puede dejar la caché desfasada; deja un TTL como red de seguridad.")],
];

export default defineLesson({
  title: t("Cache Workbench", "Banco de trabajo: cachés"),
  eyebrow: t("Systems lesson 01 · Caching", "Lección de sistemas 01 · Caché"),
  lede: t("A cache is a small, fast shelf of copies in front of a big, slow store. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "Una caché es un estante pequeño y rápido de copias frente a un almacén grande y lento. Esta lección arma esa idea de tres maneras: mira una máquina hacerlo, predice qué la rompe y luego explícalo con tus palabras."),
  machine: {
    intro: t("The rack on the right is the cache. The chest on the left is the database. Watch a few requests, then change the settings below and see what the counters do.",
      "El estante de la derecha es la caché. El archivo de la izquierda es la base de datos. Mira algunas solicitudes, luego cambia los ajustes de abajo y observa qué hacen los contadores."),
    plate: {
      title: t("Records office", "Oficina de registros"),
      keys: [
        { mark: "lit", label: t("The record in play", "El registro en juego") },
        { mark: "raised", label: t("Card rack: the cache, 12 slots, fast", "Estante de fichas: la caché, 12 lugares, rápido") },
        { mark: "flat", label: t("Archive chest: the database, every record, slow", "Archivo: la base de datos, todos los registros, lento") },
      ],
      caption: t(
        "Each press of the button asks for one of 40 records. If its card is in the rack, it is a hit and is answered in 0.7 s. If not, the carriage fetches it from the archive (2.75 s) and leaves a copy in the rack. The strip on each card is its time to live; the dial marked 1 MIN turns once a minute.",
        "Cada vez que se pulsa el botón se pide uno de 40 registros. Si su ficha está en el estante, es un acierto (hit) y se responde en 0.7 s. Si no, es un fallo (miss): el carro lo trae del archivo (2.75 s) y deja una copia en el estante. La franja de cada ficha es su tiempo de vida (time to live, TTL); el reloj marcado 1 MIN da una vuelta por minuto."),
      stage: { "data-office": "" },
      label: t("Records office simulation. Space pauses or resumes.", "Simulación de la oficina de registros. La barra espaciadora pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["requests", t("Requests", "Solicitudes")], ["hits", t("From rack", "Del estante")], ["misses", t("From archive", "Del archivo")], ["rate", t("Hit rate", "Tasa de aciertos"), "–"], ["wait", t("Avg wait", "Espera media"), "–"], ["stale", t("Stale reads", "Obsoletas")]],
    controls: [
      { seg: "ttl", label: t("Time to live", "Tiempo de vida"), options: [[6, "6 s"], [20, "20 s"], [60, "60 s"]], value: 60 },
      { seg: "slots", label: t("Rack size", "Tamaño del estante"), options: [[4, t("4 slots", "4 lugares")], [12, t("12 slots", "12 lugares")]], value: 12 },
      { seg: "traffic", label: t("Traffic", "Tráfico"), options: [["popular", t("Popular", "Popular")], ["even", t("Even", "Parejo")]], value: "popular" },
      { seg: "invalidate", label: t("Invalidate on write", "Invalidar al escribir"), options: [["false", t("Off", "No")], ["true", t("On", "Sí")]], value: "false" },
      { speed: true },
      { actions: [["change", t("Change record #1", "Cambiar el registro #1")], ["flush", t("Empty rack", "Vaciar estante")], ["reset", t("Reset counts", "Reiniciar conteos")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results are averaged over 9,000 simulated requests of the same machine; the figure's starting point is a 67% hit rate.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados son el promedio de 9,000 solicitudes simuladas de la misma máquina; la figura arranca con una tasa de aciertos de 67%."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  // Figure-specific styles: empty slots hide their card, the TTL strip fill, blanking covers.
  css: `
.slot [data-lift]{transition:opacity .35s var(--anatomy-ease)}
.slot[data-empty] [data-lift]{opacity:0}
.ttl-fill{fill:var(--anatomy-mid);stroke:none}
.cover{display:none}
.cover[data-on]{display:inline}
`,
  data: {
    P,
    G: GEOMETRY,
  },
});
