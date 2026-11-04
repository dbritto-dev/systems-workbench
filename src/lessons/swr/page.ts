// @ts-nocheck: content in the style of the other lessons
// Systems lesson 57 · Stale-while-revalidate: a client data cache as a copy rack between the screen and the server.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, cardSvg, capsuleSvg, envelopeSvg, otherSvg, P, GEOMETRY, FIGURE_CSS, RES_LABEL } from "./figure";
import { awayRun, dedupeRun, gcRun, keyRun, saveRun, AWAY, GC, FLIP, SAVE, PAGES, DEFAULTS } from "./sim";

// Experiment results, computed at build time from the same model the page runs (8 seeds each).
const R = { away: awayRun(), dedupe: dedupeRun(), gc: gcRun(), key: keyRun(), save: saveRun() };

const s1 = (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " s";
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const n = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : one(x));
const top = (...xs) => Math.max(...xs) * 1.08;
const STAGGER = PAGES.feed.stagger;
const AWAY_BACK = AWAY.at + AWAY.secs;

// What each card shows after a run.
const RUNS = {
  away: () => {
    const { zero, five } = R.away, m = AWAY.watch;
    return { verdict: t("Coming back with staleTime 0: " + n(zero.requests) + " requests, and every tile caught up " + s1(zero.catchUp) + " later. With staleTime 5 min: " + n(five.requests) + " requests, and after " + AWAY.watch + " s the tiles were still behind the server (" + one(five.behind) + " versions on average when the user came back). Neither showed a spinner.",
        "Al volver con staleTime 0: " + n(zero.requests) + " solicitudes, y todos los paneles se pusieron al día " + s1(zero.catchUp) + " después. Con staleTime 5 min: " + n(five.requests) + " solicitudes, y después de " + AWAY.watch + " s los paneles seguían atrasados respecto del servidor (" + one(five.behind) + " versiones en promedio cuando el usuario volvió). Ninguno mostró un indicador de carga."),
      bars: [[t("Old data on screen after coming back, staleTime 0", "Datos viejos en pantalla al volver, staleTime 0"), zero.catchUp / m, s1(zero.catchUp)], [t("Old data on screen after coming back, staleTime 5 min", "Datos viejos en pantalla al volver, staleTime 5 min"), five.catchUp / m, t("all " + AWAY.watch + " s", "los " + AWAY.watch + " s"), true], [t("Requests on return, staleTime 0", "Solicitudes al volver, staleTime 0"), zero.requests / top(zero.requests, 1), n(zero.requests)], [t("Requests on return, staleTime 5 min", "Solicitudes al volver, staleTime 5 min"), five.requests / top(zero.requests, 1), n(five.requests), true]] };
  },
  dedupe: () => {
    const { own, zero, thirty } = R.dedupe, m = top(own.requests);
    return { verdict: t("Each component fetching: " + n(own.requests) + " requests and " + n(own.spinners) + " spinners. Shared query, staleTime 0: " + n(zero.requests) + " requests and " + one(zero.spinners) + " spinners. staleTime 30 s: " + n(thirty.requests) + " request and " + one(thirty.spinners) + " spinners.",
        "Cada componente pidiendo: " + n(own.requests) + " solicitudes y " + n(own.spinners) + " indicadores de carga. Consulta compartida, staleTime 0: " + n(zero.requests) + " solicitudes y " + one(zero.spinners) + " indicadores de carga. staleTime 30 s: " + n(thirty.requests) + " solicitud y " + one(thirty.spinners) + " indicadores de carga."),
      bars: [[t("Requests, each component", "Solicitudes, cada componente"), own.requests / m, n(own.requests)], [t("Requests, shared, staleTime 0", "Solicitudes, compartida, staleTime 0"), zero.requests / m, n(zero.requests), true], [t("Requests, shared, staleTime 30 s", "Solicitudes, compartida, staleTime 30 s"), thirty.requests / m, n(thirty.requests)], [t("Spinners, each component", "Indicadores de carga, cada componente"), own.spinners / m, n(own.spinners)], [t("Spinners, shared (either staleTime)", "Indicadores de carga, compartida (cualquier staleTime)"), zero.spinners / m, one(zero.spinners)]] };
  },
  gc: () => {
    const { short, long } = R.gc;
    return { verdict: t("gcTime 10 s: the todo page came back as a spinner for " + s1(short.spinner) + " and sent " + n(short.requests) + " requests. gcTime 5 min: no spinner and " + n(long.requests) + " requests: the cached copies were shown at once, still fresh.",
        "gcTime 10 s: la página de tareas volvió con un indicador de carga durante " + s1(short.spinner) + " y envió " + n(short.requests) + " solicitudes. gcTime 5 min: sin indicador de carga y " + n(long.requests) + " solicitudes: las copias de la caché se mostraron al instante, todavía frescas."),
      bars: [[t("Spinner on return, gcTime 10 s", "Carga al volver, gcTime 10 s"), short.spinner / top(short.spinner), s1(short.spinner), true], [t("Spinner on return, gcTime 5 min", "Carga al volver, gcTime 5 min"), long.spinner / top(short.spinner), s1(long.spinner)], [t("Requests on return, gcTime 10 s", "Solicitudes al volver, gcTime 10 s"), short.requests / top(short.requests), n(short.requests), true], [t("Requests on return, gcTime 5 min", "Solicitudes al volver, gcTime 5 min"), long.requests / top(short.requests), n(long.requests)]] };
  },
  key: () => {
    const { fixed, bug, bugZero } = R.key;
    return { verdict: t("Key ['user'], staleTime 30 s: the profile showed the other user " + pct(bug.profile) + " of the time and the header avatar " + pct(bug.header) + ". With staleTime 0: " + pct(bugZero.profile) + " and " + pct(bugZero.header) + ". Key ['user', id]: " + pct(fixed.profile) + " and " + pct(fixed.header) + ".",
        "Clave ['user'], staleTime 30 s: el perfil mostró al otro usuario el " + pct(bug.profile) + " del tiempo y el avatar del encabezado el " + pct(bug.header) + ". Con staleTime 0: " + pct(bugZero.profile) + " y " + pct(bugZero.header) + ". Clave ['user', id]: " + pct(fixed.profile) + " y " + pct(fixed.header) + "."),
      groups: [
        { title: t("Profile showing the other user", "Perfil mostrando al otro usuario"), bars: [[t("['user'], staleTime 30 s", "['user'], staleTime 30 s"), bug.profile, pct(bug.profile), true], [t("['user'], staleTime 0", "['user'], staleTime 0"), bugZero.profile, pct(bugZero.profile)], [t("['user', id]", "['user', id]"), fixed.profile, pct(fixed.profile)]] },
        { title: t("Header avatar showing user 2", "Avatar del encabezado mostrando al usuario 2"), bars: [[t("['user'], staleTime 30 s", "['user'], staleTime 30 s"), bug.header, pct(bug.header)], [t("['user'], staleTime 0", "['user'], staleTime 0"), bugZero.header, pct(bugZero.header), true], [t("['user', id]", "['user', id]"), fixed.header, pct(fixed.header)]] },
      ] };
  },
  save: () => {
    const { none, inval, noneZero } = R.save, m = top(none.seen, noneZero.seen);
    return { verdict: t("With nothing after the save, the list showed the edit " + s1(none.seen) + " after the click (" + s1(noneZero.seen) + " with staleTime 0). Invalidating the key: " + s1(inval.seen) + ".",
        "Sin nada después de guardar, la lista mostró el cambio " + s1(none.seen) + " después del clic (" + s1(noneZero.seen) + " con staleTime 0). Invalidando la clave: " + s1(inval.seen) + "."),
      bars: [[t("Edit on screen, nothing after the save", "Cambio en pantalla, nada después de guardar"), none.seen / m, s1(none.seen), true], [t("Same, staleTime 0", "Igual, staleTime 0"), noneZero.seen / m, s1(noneZero.seen)], [t("Edit on screen, invalidate", "Cambio en pantalla, invalidar"), inval.seen / m, s1(inval.seen)]] };
  },
};

const { away: N1, dedupe: N2, gc: N3, key: N4, save: N5 } = R;

const EXPERIMENTS = [
  {
    id: "away",
    title: t("Back after a minute away", "De vuelta tras un minuto fuera"),
    change: t("The todo page is open · the user switches to another tab for " + AWAY.secs + " s while other people edit (about once every " + DEFAULTS.editEvery + " s per resource) · then comes back · refetch on window focus is on (the default) · staleTime 0 vs 5 min",
      "La página de tareas está abierta · el usuario se va a otra pestaña durante " + AWAY.secs + " s mientras otras personas editan (más o menos una vez cada " + DEFAULTS.editEvery + " s por recurso) · después vuelve · volver a pedir al recuperar el foco está activado (el valor por defecto) · staleTime 0 vs 5 min"),
    question: t("With staleTime 5 min, what does the screen show when the user comes back?", "Con staleTime 5 min, ¿qué muestra la pantalla cuando el usuario vuelve?"),
    options: [
      t("A spinner, then the new data: coming back always refetches", "Un indicador de carga y después los datos nuevos: volver siempre vuelve a pedir"),
      t("The old data, then the new data a round trip later", "Los datos viejos, y los nuevos un viaje de ida y vuelta después"),
      t("The old data, and it stays that way", "Los datos viejos, y así se quedan"),
    ],
    answer: 2,
    why: t(
      "Refetching on focus only refetches stale queries. With staleTime 5 min the data fetched a minute ago still counts as fresh, so coming back sends nothing, and the tiles keep showing data " + one(N1.five.behind) + " versions behind the server for the whole " + AWAY.watch + " s we watched. With staleTime 0 the same return sends " + n(N1.zero.requests) + " requests, one per key in use (the two todo tiles share one), and the tiles catch up " + s1(N1.zero.catchUp) + " later; until then they show the old data, never a spinner. That is stale-while-revalidate: the cached copy is shown at once, and staleTime only decides whether a trigger (a component mounting, the window regaining focus, the network coming back) fetches a newer one.",
      "Volver a pedir al recuperar el foco solo vuelve a pedir las consultas viejas (stale). Con staleTime 5 min, los datos que se pidieron hace un minuto todavía cuentan como frescos, así que al volver no se envía nada, y los paneles siguen mostrando datos " + one(N1.five.behind) + " versiones atrás del servidor durante los " + AWAY.watch + " s que observamos. Con staleTime 0, la misma vuelta envía " + n(N1.zero.requests) + " solicitudes, una por clave en uso (los dos paneles de tareas comparten una), y los paneles se ponen al día " + s1(N1.zero.catchUp) + " después; hasta entonces muestran los datos viejos, nunca un indicador de carga. Eso es stale-while-revalidate: la copia en caché se muestra al instante, y staleTime solo decide si un disparador (un componente que se monta, la ventana que recupera el foco, la red que vuelve) pide una más nueva.",
    ),
    watch: { stale: 300, gc: 300, fetch: "shared", key: "id", save: "inval", scenario: "away", speed: 4 },
  },
  {
    id: "dedupe",
    title: t("Ten avatars, one user", "Diez avatares, un usuario"),
    change: t("A comment list renders ten avatars of the same user, one every " + STAGGER + " s · fetch in each component (in a useEffect) vs a shared query with staleTime 0 vs staleTime 30 s",
      "Una lista de comentarios dibuja diez avatares del mismo usuario, uno cada " + STAGGER + " s · pedir en cada componente (en un useEffect) vs una consulta compartida con staleTime 0 vs staleTime 30 s"),
    question: t("With the shared query and staleTime 0, how many requests do the ten avatars make?", "Con la consulta compartida y staleTime 0, ¿cuántas solicitudes hacen los diez avatares?"),
    options: [
      t("One: they share the key, so the cache dedupes them", "Una: comparten la clave, así que la caché las deduplica"),
      t("Ten: staleTime 0 means every mount fetches", "Diez: staleTime 0 significa que cada montaje pide"),
      t("A few: only mounts during a request share it", "Unas pocas: solo comparten los montajes durante una solicitud"),
    ],
    answer: 2,
    why: t(
      "Deduplication shares a request that is in flight: every avatar that mounts while it travels waits for the same answer. It doesn't stop the next one. With staleTime 0 the data is stale the moment it lands, so the first avatar to mount afterwards shows it at once and starts another background fetch: " + n(N2.zero.requests) + " requests for ten avatars, against " + n(N2.own.requests) + " when each component fetches on its own. With staleTime 30 s the answer stays fresh and later avatars just read it: " + n(N2.thirty.requests) + " request. The spinners are the same either way (" + one(N2.zero.spinners) + "): only avatars that mount before the first answer have nothing to show. SWR dedupes by time instead: the same key within its dedupingInterval (2 s by default) shares one request.",
      "La deduplicación comparte una solicitud que está en vuelo: cada avatar que se monta mientras viaja espera la misma respuesta. No evita la siguiente. Con staleTime 0, los datos quedan viejos en cuanto llegan, así que el primer avatar que se monta después los muestra al instante y empieza otra solicitud en segundo plano: " + n(N2.zero.requests) + " solicitudes para diez avatares, contra " + n(N2.own.requests) + " cuando cada componente pide por su cuenta. Con staleTime 30 s la respuesta sigue fresca y los avatares siguientes solo la leen: " + n(N2.thirty.requests) + " solicitud. Los indicadores de carga son los mismos en ambos casos (" + one(N2.zero.spinners) + "): solo los avatares que se montan antes de la primera respuesta no tienen nada que mostrar. SWR deduplica por tiempo: la misma clave dentro de su dedupingInterval (2 s por defecto) comparte una sola solicitud.",
    ),
    watch: { stale: 0, gc: 300, fetch: "shared", key: "id", save: "inval", scenario: "dedupe", speed: 0.5 },
  },
  {
    id: "gc",
    title: t("A gcTime shorter than staleTime", "Un gcTime más corto que staleTime"),
    change: t("staleTime 30 s · the user opens the todo page, goes to a profile at " + GC.leave + " s and comes back at " + GC.back + " s · gcTime 5 min vs 10 s",
      "staleTime 30 s · el usuario abre la página de tareas, va a un perfil a los " + GC.leave + " s y vuelve a los " + GC.back + " s · gcTime 5 min vs 10 s"),
    question: t("With gcTime 10 s, what does the todo page show when the user comes back?", "Con gcTime 10 s, ¿qué muestra la página de tareas cuando el usuario vuelve?"),
    options: [
      t("The cached data, with no request: it is under 30 s old, still fresh", "Los datos en caché, sin solicitud: tienen menos de 30 s, todavía están frescos"),
      t("A spinner: the cache already dropped the data", "Un indicador de carga: la caché ya borró los datos"),
      t("The cached data, plus a background refetch", "Los datos en caché, más una solicitud en segundo plano"),
    ],
    answer: 1,
    why: t(
      "staleTime and gcTime measure different things. staleTime is how long data counts as fresh. gcTime starts when the last component using a key unmounts, and when it runs out the entry is deleted, fresh or not. Here the todo tiles unmounted at " + GC.leave + " s and their entries were dropped at " + (GC.leave + 10) + " s, so the return at " + GC.back + " s starts from nothing: " + n(N3.short.requests) + " requests and " + s1(N3.short.spinner) + " of spinner. With gcTime 5 min the same return shows the cached copies at once and sends " + n(N3.long.requests) + " requests, because they are still fresh. Keep gcTime longer than staleTime, as TanStack Query's defaults do (staleTime 0, gcTime 5 min); v5 renamed the old cacheTime option to gcTime because the old name sounded like how long data is cached, when it only starts counting once nobody uses the key.",
      "staleTime y gcTime miden cosas distintas. staleTime es cuánto tiempo los datos cuentan como frescos. gcTime empieza cuando se desmonta el último componente que usa una clave, y cuando se agota la entrada se borra, fresca o no. Aquí los paneles de tareas se desmontaron a los " + GC.leave + " s y sus entradas se borraron a los " + (GC.leave + 10) + " s, así que la vuelta a los " + GC.back + " s empieza de cero: " + n(N3.short.requests) + " solicitudes y " + s1(N3.short.spinner) + " de indicador de carga. Con gcTime 5 min, la misma vuelta muestra las copias en caché al instante y envía " + n(N3.long.requests) + " solicitudes, porque todavía están frescas. Mantén gcTime más largo que staleTime, como hacen los valores por defecto de TanStack Query (staleTime 0, gcTime 5 min); la v5 renombró la vieja opción cacheTime a gcTime porque el nombre viejo sonaba a cuánto tiempo se guardan los datos, cuando solo empieza a contar cuando nadie usa la clave.",
    ),
    watch: { stale: 30, gc: 10, fetch: "shared", key: "id", save: "inval", scenario: "gc", speed: 1 },
  },
  {
    id: "key",
    title: t("A key without the id", "Una clave sin el id"),
    change: t("The user flips between the profiles of user 1 and user 2 every " + FLIP.dwell[0] + " to " + FLIP.dwell[1] + " s for a minute · the header avatar shows user 1 on every page · staleTime 30 s · key ['user', id] vs ['user']",
      "El usuario alterna entre los perfiles del usuario 1 y el usuario 2 cada " + FLIP.dwell[0] + " a " + FLIP.dwell[1] + " s durante un minuto · el avatar del encabezado muestra al usuario 1 en todas las páginas · staleTime 30 s · clave ['user', id] vs ['user']"),
    question: t("With the key ['user'], what does the profile show after a switch?", "Con la clave ['user'], ¿qué muestra el perfil después de un cambio?"),
    options: [
      t("A spinner, then the right user: the fetch function reads the new id", "Un indicador de carga y después el usuario correcto: la función que pide lee el id nuevo"),
      t("Often the other user's, while the entry is fresh", "Muchas veces el del otro usuario, mientras la entrada está fresca"),
      t("The other user's profile for a round trip, then the right one", "El perfil del otro usuario durante un viaje de ida y vuelta, y después el correcto"),
    ],
    answer: 1,
    why: t(
      "The key is all the cache knows about what the data is. Both profiles and the avatar read ['user'], so whatever was fetched last shows on all of them, and while it is fresh nothing refetches: the profile showed the other user " + pct(N4.bug.profile) + " of the time. The avatar, which never changes user, showed user 2 " + pct(N4.bug.header) + " of the time, after a stale switch to user 2 refetched the shared entry. A shorter staleTime moves the bug instead of fixing it: with staleTime 0 every switch refetches, so the profile is wrong only for a round trip (" + pct(N4.bugZero.profile) + "), but now the avatar shows user 2 whenever the profile does (" + pct(N4.bugZero.header) + "). With the id in the key each user has their own entry and nothing is ever wrong.",
      "La clave es todo lo que la caché sabe sobre qué son los datos. Los dos perfiles y el avatar leen ['user'], así que lo último que se pidió aparece en todos, y mientras está fresco nada vuelve a pedir: el perfil mostró al otro usuario el " + pct(N4.bug.profile) + " del tiempo. El avatar, que nunca cambia de usuario, mostró al usuario 2 el " + pct(N4.bug.header) + " del tiempo, después de que un cambio al usuario 2 con datos viejos volvió a pedir la entrada compartida. Un staleTime más corto mueve el error en lugar de arreglarlo: con staleTime 0 cada cambio vuelve a pedir, así que el perfil está mal solo durante un viaje de ida y vuelta (" + pct(N4.bugZero.profile) + "), pero ahora el avatar muestra al usuario 2 cada vez que lo hace el perfil (" + pct(N4.bugZero.header) + "). Con el id en la clave, cada usuario tiene su propia entrada y nada se muestra mal.",
    ),
    watch: { stale: 30, gc: 300, fetch: "shared", key: "bug", save: "inval", scenario: "key", speed: 1 },
  },
  {
    id: "save",
    title: t("Save, then look", "Guardar y mirar"),
    change: t("On the todo page the user saves an edit at " + SAVE.at + " s · switches to another tab at " + SAVE.leave + " s and comes back at " + SAVE.back + " s · staleTime 30 s · nothing after the save vs invalidating the todos key",
      "En la página de tareas el usuario guarda un cambio a los " + SAVE.at + " s · se va a otra pestaña a los " + SAVE.leave + " s y vuelve a los " + SAVE.back + " s · staleTime 30 s · nada después de guardar vs invalidar la clave de tareas"),
    question: t("With nothing after the save, when does the list show the user's own edit?", "Sin nada después de guardar, ¿cuándo muestra la lista el cambio del propio usuario?"),
    options: [
      t("As soon as the save succeeds: the server has it", "En cuanto el guardado tiene éxito: el servidor ya lo tiene"),
      t("A round trip after the save: a successful save refetches", "Un viaje de ida y vuelta después de guardar: un guardado exitoso vuelve a pedir"),
      t("Only once it is stale and something refetches it", "Solo cuando está vieja y algo la vuelve a pedir"),
    ],
    answer: 2,
    why: t(
      "A mutation changes the server, not the cache. The cache still holds the copy it fetched when the page opened, and nothing tells it that copy is out of date, so the list shows the old name until the copy is stale (after 30 s) and a trigger comes along: here the user coming back at " + SAVE.back + " s, " + s1(N5.none.seen) + " after the click. staleTime 0 doesn't help (" + s1(N5.noneZero.seen) + "): stale data still waits for a trigger. Invalidating the key after the save marks it stale and refetches it at once while it is in use, so the edit shows " + s1(N5.inval.seen) + " after the click, two round trips: the save and the refetch. Writing the save's response into the cache (setQueryData), or an optimistic update (lesson 58, Optimistic UI), saves the second one.",
      "Una mutación cambia el servidor, no la caché. La caché sigue guardando la copia que pidió cuando se abrió la página, y nada le avisa que esa copia está desactualizada, así que la lista muestra el nombre viejo hasta que la copia se vuelve vieja (después de 30 s) y llega un disparador: aquí, el usuario que vuelve a los " + SAVE.back + " s, " + s1(N5.none.seen) + " después del clic. staleTime 0 no ayuda (" + s1(N5.noneZero.seen) + "): los datos viejos igual esperan un disparador. Invalidar la clave después de guardar la marca como vieja y la vuelve a pedir de inmediato mientras está en uso, así que el cambio aparece " + s1(N5.inval.seen) + " después del clic, dos viajes de ida y vuelta: el guardado y la nueva solicitud. Escribir la respuesta del guardado en la caché (setQueryData), o una actualización optimista (lección 58, UI optimista), ahorra el segundo.",
    ),
    watch: { stale: 30, gc: 300, fetch: "shared", key: "id", save: "none", scenario: "save", speed: 3 },
  },
];

const QUESTIONS = [
  [t("TanStack Query's default staleTime is 0. Does that make the cache useless? What does it still do?",
     "El staleTime por defecto de TanStack Query es 0. ¿Eso hace inútil la caché? ¿Qué sigue haciendo?"),
   t("No. staleTime only decides whether a trigger refetches. With 0, every mount, focus or reconnect refetches in the background, but the cached copy is still shown at once, so going back to a page you have seen is instant instead of a spinner. Requests in flight are still shared, and unused data is still kept for gcTime. Raise staleTime for data that changes slowly to cut the background requests; keep it low where seeing the latest matters.",
     "No. staleTime solo decide si un disparador vuelve a pedir. Con 0, cada montaje, cada vez que vuelve el foco o la red, se vuelve a pedir en segundo plano, pero la copia en caché igual se muestra al instante, así que volver a una página que ya viste es inmediato en lugar de un indicador de carga. Las solicitudes en vuelo se siguen compartiendo, y los datos sin usar se siguen guardando durante gcTime. Sube staleTime para datos que cambian poco y así recortar las solicitudes en segundo plano; déjalo bajo donde importa ver lo último.")],
  [t("What do staleTime and gcTime each control, and what happens when gcTime is shorter than staleTime?",
     "¿Qué controla cada uno, staleTime y gcTime, y qué pasa cuando gcTime es más corto que staleTime?"),
   t("staleTime: how long after it arrives data counts as fresh, so triggers leave it alone. gcTime: how long an entry nobody uses stays in memory, counted from the moment its last component unmounts. If gcTime is shorter, data you leave can be deleted while it would still be fresh, and coming back means a spinner and a request you thought the cache would save. Data in use is never collected, however long it sits.",
     "staleTime: cuánto tiempo después de llegar los datos cuentan como frescos, así que los disparadores no los tocan. gcTime: cuánto tiempo queda en memoria una entrada que nadie usa, contado desde que se desmonta su último componente. Si gcTime es más corto, los datos que dejas se pueden borrar cuando todavía estarían frescos, y volver significa un indicador de carga y una solicitud que creías que la caché te ahorraba. Los datos en uso nunca se borran, por mucho tiempo que pase.")],
  [t("A response carries Cache-Control: max-age=60, stale-while-revalidate=300. What does a cache that supports it do with a request at 30 s, at 200 s and at 400 s?",
     "Una respuesta trae Cache-Control: max-age=60, stale-while-revalidate=300. ¿Qué hace una caché que lo soporta con una solicitud a los 30 s, a los 200 s y a los 400 s?"),
   t("At 30 s the response is fresh: served from the cache, no request. At 200 s it has been stale for 140 s, inside the 300 s window, so the cache may serve it at once and revalidate in the background (RFC 5861). At 400 s it is past the window: the cache revalidates before it answers, and the caller waits. It is the same idea one layer down, in the browser's HTTP cache or a CDN, measured in seconds since the response was generated. It knows nothing about your components, focus or invalidation; a client cache like TanStack Query sits on top, and when both cache, data can be older than either one suggests. Lesson 01 covers TTLs and hit ratio; lesson 28 serves stale on the server to stop a stampede.",
     "A los 30 s la respuesta está fresca: se sirve desde la caché, sin solicitud. A los 200 s lleva 140 s vieja, dentro de la ventana de 300 s, así que la caché puede servirla al instante y revalidarla en segundo plano (RFC 5861). A los 400 s ya pasó la ventana: la caché revalida antes de responder, y quien pide espera. Es la misma idea una capa más abajo, en la caché HTTP del navegador o en una CDN, medida en segundos desde que se generó la respuesta. No sabe nada de tus componentes, del foco ni de invalidaciones; una caché de cliente como TanStack Query va encima, y cuando las dos guardan copias, los datos pueden ser más viejos de lo que cualquiera de las dos sugiere. La lección 01 trata los TTL y la tasa de aciertos; la lección 28 sirve datos viejos en el servidor para frenar una estampida.")],
  [t("Why must a query key contain every input the fetch function reads? What goes wrong if one is missing, and how do you catch it?",
     "¿Por qué una clave de consulta tiene que contener cada entrada que lee la función que pide? ¿Qué sale mal si falta una, y cómo lo detectas?"),
   t("The key is the cache's identity for the data. Two calls with different inputs and the same key share one entry: the cache shows one's answer for the other, dedupes their requests together, and staleTime decides how long the wrong answer lasts. Put every variable the fetch reads (ids, filters, page, search term) in the key, build keys from one factory per resource, and lint for it: TanStack Query's ESLint plugin has an exhaustive-deps rule for query keys. A debounced search box (lesson 31) keyed by the term gets one entry per term, so going back to an earlier search is instant.",
     "La clave es la identidad de los datos para la caché. Dos llamadas con entradas distintas y la misma clave comparten una entrada: la caché muestra la respuesta de una para la otra, deduplica sus solicitudes juntas, y staleTime decide cuánto dura la respuesta equivocada. Pon en la clave cada variable que lee la función (ids, filtros, página, término de búsqueda), arma las claves desde una fábrica por recurso y revísalo con un linter: el plugin de ESLint de TanStack Query tiene una regla exhaustive-deps para las claves. Un buscador con debounce (lección 31) con el término en la clave tiene una entrada por término, así que volver a una búsqueda anterior es inmediato.")],
  [t("After a save succeeds, how do you get it on screen? Compare invalidating, writing the response into the cache, and an optimistic update.",
     "Después de que un guardado tiene éxito, ¿cómo lo llevas a la pantalla? Compara invalidar, escribir la respuesta en la caché y una actualización optimista."),
   t("Invalidating (invalidateQueries in TanStack Query, mutate(key) in SWR) marks the matching keys stale and refetches the ones in use: one more round trip, but whatever else changed on the server comes along. Writing the response into the cache (setQueryData) shows it without a request, if the response holds the whole object. An optimistic update writes the expected result before the server answers and rolls it back on error: instant, but you must undo it cleanly (lesson 58). A common pattern is optimistic or setQueryData first, then invalidate when the mutation settles.",
     "Invalidar (invalidateQueries en TanStack Query, mutate(key) en SWR) marca como viejas las claves que coinciden y vuelve a pedir las que están en uso: un viaje de ida y vuelta más, pero llega todo lo demás que cambió en el servidor. Escribir la respuesta en la caché (setQueryData) la muestra sin solicitud, si la respuesta trae el objeto completo. Una actualización optimista escribe el resultado esperado antes de que responda el servidor y lo revierte si hay error: inmediato, pero tienes que deshacerlo bien (lección 58). Un patrón común es optimista o setQueryData primero, y después invalidar cuando la mutación termina.")],
  [t("A dashboard tab stays open overnight. The user comes back at 9 a.m. What do they see first, what decides what happens next, and what does the server see?",
     "Una pestaña con un panel de control queda abierta toda la noche. El usuario vuelve a las 9 a. m. ¿Qué ve primero, qué decide lo que pasa después y qué ve el servidor?"),
   t("First, last night's data, at once: the page is still mounted and its entries are still in the cache. If the data is stale and refetch on window focus is on (revalidateOnFocus in SWR), each key in use refetches once in the background and the tiles swap as answers land; with a long staleTime nothing happens until the data goes stale and something triggers it. If the network dropped in the night, refetch on reconnect fires too, and each key's requests are still deduplicated. For data that must stay live while the tab is visible, add a refetchInterval. On the server, everyone arriving at 9 a.m. refetches together, a burst lesson 28 knows how to absorb.",
     "Primero, los datos de anoche, al instante: la página sigue montada y sus entradas siguen en la caché. Si los datos están viejos y volver a pedir al recuperar el foco está activado (revalidateOnFocus en SWR), cada clave en uso vuelve a pedir una vez en segundo plano y los paneles cambian a medida que llegan las respuestas; con un staleTime largo no pasa nada hasta que los datos se vuelven viejos y algo los dispara. Si la red se cortó durante la noche, también se dispara volver a pedir al reconectar, y las solicitudes de cada clave se siguen deduplicando. Para datos que deben mantenerse al día mientras la pestaña está visible, agrega un refetchInterval. En el servidor, todos los que llegan a las 9 a. m. vuelven a pedir juntos, una ráfaga que la lección 28 sabe cómo absorber.")],
];

export default defineLesson({
  title: t("Stale-While-Revalidate Workbench", "Banco de trabajo: stale-while-revalidate"),
  eyebrow: t("Systems lesson 57 · Stale-while-revalidate", "Lección de sistemas 57 · Stale-while-revalidate"),
  lede: t("A client data cache such as TanStack Query or SWR shows the copy it already has the moment a screen asks for it and refetches in the background, so screens appear instantly but can show old data for a while. This lesson builds that cache as a machine: watch it, predict what changes it, then explain it back.",
    "Una caché de datos en el cliente, como TanStack Query o SWR, muestra la copia que ya tiene en cuanto una pantalla la pide y la vuelve a pedir en segundo plano, así que las pantallas aparecen al instante pero pueden mostrar datos viejos (stale) por un rato. Esta lección arma esa caché como una máquina: mírala, predice qué la cambia y después explícala."),
  machine: {
    intro: t("A simulated user browses a small app: a todo page and two user profiles, with their own avatar in the header of every page. Each tile on the screen reads its data through a query key; the cache keeps one card per key and hands it to every tile that asks. When a card is stale and a tile mounts, the tab regains focus or the network comes back, one request goes out, and every tile using that key updates when the answer lands. Change staleTime and gcTime, break the key, or leave the tab yourself.",
      "Un usuario simulado recorre una app pequeña: una página de tareas y dos perfiles de usuario, con su propio avatar en el encabezado de cada página. Cada panel de la pantalla lee sus datos a través de una clave de consulta (query key); la caché guarda una tarjeta por clave y se la da a cada panel que la pide. Cuando una tarjeta está vieja y se monta un panel, la pestaña recupera el foco o vuelve la red, sale una solicitud, y cada panel que usa esa clave se actualiza cuando llega la respuesta. Cambia staleTime y gcTime, rompe la clave o sal tú mismo de la pestaña."),
    plate: {
      title: t("Copy rack", "Estante de copias"),
      keys: [
        { mark: "lit", label: t("A request on the network: a capsule (a fetch) or an envelope (a save)", "Una solicitud en la red: una cápsula (una lectura) o un sobre (un guardado)") },
        { mark: "raised", label: t("Copy cards: the last answer the cache holds for each key, with its version", "Tarjetas de copia: la última respuesta que guarda la caché para cada clave, con su versión") },
        { mark: "flat", label: t("Tiles on the screen: the resource each one wants and the version it shows", "Paneles en la pantalla: el recurso que quiere cada uno y la versión que muestra") },
      ],
      caption: t(
        "The server at the back holds four resources, each with a version counter that goes up when someone edits it. The cache in front keeps a card per query key, printed with the version it holds; the gauge beside it empties as the card ages and is empty once the card is stale; the counter shows how many tiles use the key, and with none left a gc countdown appears and the card is dropped when it runs out. Requests ride the network as lit capsules, saves as lit envelopes. On the screen, each tile names the resource it wants and shows the version it has: dashed while it waits with nothing to show, tagged OLD when the server has a newer version, WRONG when it shows another resource's data. A curtain drops while the user is in another tab; a barrier lies across the network while it is offline.",
        "El servidor, al fondo, guarda cuatro recursos, cada uno con un contador de versión que sube cuando alguien lo edita. La caché, adelante, guarda una tarjeta por clave de consulta, con la versión que tiene impresa; el indicador de al lado se vacía a medida que la tarjeta envejece y queda vacío cuando la tarjeta está vieja (stale); el contador muestra cuántos paneles usan la clave, y cuando no queda ninguno aparece una cuenta regresiva de gc y la tarjeta se descarta cuando se agota. Las solicitudes viajan por la red como cápsulas iluminadas, los guardados como sobres iluminados. En la pantalla, cada panel indica el recurso que quiere y muestra la versión que tiene: punteado mientras espera sin nada que mostrar, con la etiqueta VIEJO cuando el servidor tiene una versión más nueva, AJENO cuando muestra datos de otro recurso. Una cortina cae mientras el usuario está en otra pestaña; una barrera cruza la red mientras no hay conexión.",
      ),
      stage: { "data-rack": "" },
      label: t("Stale-while-revalidate simulation. Space pauses or resumes.", "Simulación de stale-while-revalidate. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["requests", t("Requests", "Solicitudes")],
      ["spinners", t("Spinners", "Indicadores de carga")],
      ["old", t("Old on screen", "Viejo en pantalla"), "–"],
      ["wrong", t("Wrong data", "Datos ajenos"), "–"],
      ["keys", t("Keys cached", "Claves en caché")],
      ["gc", t("Collected", "Borradas")],
    ],
    controls: [
      { seg: "stale", label: "staleTime", options: [[0, "0"], [30, "30 s"], [300, "5 min"]], value: 0 },
      { seg: "gc", label: "gcTime", options: [[10, "10 s"], [300, "5 min"]], value: 300 },
      { seg: "fetch", label: t("Data from", "Datos desde"), options: [["shared", t("Shared query cache", "Caché de consultas compartida")], ["own", t("Each component fetches", "Cada componente pide")]], value: "shared" },
      { seg: "key", label: t("User key", "Clave de usuario"), options: [["id", "['user', id]"], ["bug", "['user']"]], value: "id" },
      { seg: "save", label: t("After a save", "Después de guardar"), options: [["inval", t("Invalidate", "Invalidar")], ["none", t("Nothing", "Nada")]], value: "inval" },
      { speed: true, options: [[0.5, "×0.5"], [1, "×1"], [4, "×4"], [16, "×16"]], value: 1 },
      { actions: [["away", t("Leave the tab", "Salir de la pestaña")], ["offline", t("Drop the network", "Cortar la red")], ["edit", t("Save an edit", "Guardar un cambio")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Changing a setting starts the run again. Leave the tab keeps the user away for 20 s; Drop the network cuts it for 8 s; Save an edit saves the resource of the page on screen. The rules follow TanStack Query v5's defaults: cached data shows at once, and stale data refetches in the background when a component mounts, the window regains focus or the network reconnects. Old on screen and Wrong data are shares of tile time over the last 30 s.",
      "Cambiar un ajuste reinicia la ejecución. Salir de la pestaña deja al usuario fuera 20 s; Cortar la red la corta 8 s; Guardar un cambio guarda el recurso de la página en pantalla. Las reglas siguen los valores por defecto de TanStack Query v5: los datos en caché se muestran al instante, y los datos viejos se vuelven a pedir en segundo plano cuando se monta un componente, la ventana recupera el foco o la red se reconecta. Viejo en pantalla y Datos ajenos son partes del tiempo de los paneles en los últimos 30 s.",
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; its rules follow TanStack Query v5's documented defaults. The HTTP directive is defined in RFC 5861, "HTTP Cache-Control Extensions for Stale Content".`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; sus reglas siguen los valores por defecto documentados de TanStack Query v5. La directiva HTTP está definida en el RFC 5861, "HTTP Cache-Control Extensions for Stale Content".`),
  css: LIT_FILL_CSS + FIGURE_CSS,
  data: { P, G: GEOMETRY, RES_LABEL, CARD_SVG: cardSvg(), CAPSULE_SVG: capsuleSvg(), ENVELOPE_SVG: envelopeSvg(), OTHER_SVG: otherSvg() },
});
