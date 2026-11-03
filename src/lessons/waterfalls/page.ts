// @ts-nocheck: content in the style of the other lessons
// Systems lesson 55 · Request waterfalls: a relay track where each request is a runner, and most wait for another.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { int, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, P, GEOMETRY, FIGURE_CSS } from "./figure";
import { experimentResults, SEEDS, RTT, KB, SERVER, SLOW_NOTIFS, BW, EXEC_PER_KB, RENDER, INNER_RTT, HOVER } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const R = experimentResults();

const ms = (x) => int(x) + " ms";
const top = (...xs) => Math.max(...xs) * 1.08;
const MBIT = Math.round((BW * 8 * 1000) / 1000);          // KB per ms → Mbit/s (1 KB = 8 kbit)

// What each card shows after a run.
const RUNS = {
  faster: () => {
    const { normal, fast } = R.faster, travel = Math.round(normal.chain) * RTT, m = top(normal.comments, fast.comments);
    return {
      verdict: t("Comments on screen: " + ms(normal.comments) + " → " + ms(fast.comments) + ", " + pct(1 - fast.comments / normal.comments) + " sooner. The chain is still " + Math.round(normal.chain) + " round trips in a row: " + ms(travel) + " of travel either way.",
        "Comentarios en pantalla: " + ms(normal.comments) + " → " + ms(fast.comments) + ", " + pct(1 - fast.comments / normal.comments) + " antes. La cadena sigue siendo de " + Math.round(normal.chain) + " viajes de ida y vuelta seguidos: " + ms(travel) + " de viaje en ambos casos."),
      bars: [[t("Comments, APIs as usual", "Comentarios, APIs como siempre"), normal.comments / m, ms(normal.comments)], [t("Comments, APIs 2× faster", "Comentarios, APIs 2× más rápidas"), fast.comments / m, ms(fast.comments), true], [t("Round trips alone", "Solo los viajes de ida y vuelta"), travel / m, ms(travel)]],
    };
  },
  parallel: () => {
    const { render, parallel, loader } = R.parallel, m = top(render.comments);
    return {
      verdict: t("Comments on screen: " + ms(render.comments) + " fetching on render, " + ms(parallel.comments) + " with App starting the three together, " + ms(loader.comments) + " with a route loader. Round trips in a row: " + Math.round(render.chain) + " → " + Math.round(parallel.chain) + ".",
        "Comentarios en pantalla: " + ms(render.comments) + " con fetch al renderizar, " + ms(parallel.comments) + " con App iniciando las tres juntas, " + ms(loader.comments) + " con un loader de la ruta. Viajes en cadena: " + Math.round(render.chain) + " → " + Math.round(parallel.chain) + "."),
      bars: [[t("Fetch on render", "Fetch al renderizar"), render.comments / m, ms(render.comments)], [t("Parallel in App", "En paralelo en App"), parallel.comments / m, ms(parallel.comments), true], [t("Route loader", "Loader de la ruta"), loader.comments / m, ms(loader.comments)]],
    };
  },
  split: () => {
    const { bundle, lazy, loaderBundle, loaderLazy } = R.split, m = top(lazy.comments);
    return {
      verdict: t("Fetch on render: comments at " + ms(bundle.comments) + " with Comments in main.js, " + ms(lazy.comments) + " as a lazy chunk (" + Math.round(bundle.chain) + " → " + Math.round(lazy.chain) + " round trips in a row). Route loader: " + ms(loaderBundle.comments) + " → " + ms(loaderLazy.comments) + ".",
        "Fetch al renderizar: comentarios a los " + ms(bundle.comments) + " con Comments en main.js, " + ms(lazy.comments) + " como chunk diferido (" + Math.round(bundle.chain) + " → " + Math.round(lazy.chain) + " viajes en cadena). Loader de la ruta: " + ms(loaderBundle.comments) + " → " + ms(loaderLazy.comments) + "."),
      bars: [[t("Fetch on render, in main.js", "Fetch al renderizar, en main.js"), bundle.comments / m, ms(bundle.comments)], [t("Fetch on render, lazy chunk", "Fetch al renderizar, chunk diferido"), lazy.comments / m, ms(lazy.comments), true], [t("Route loader, in main.js", "Loader de la ruta, en main.js"), loaderBundle.comments / m, ms(loaderBundle.comments)], [t("Route loader, lazy chunk", "Loader de la ruta, chunk diferido"), loaderLazy.comments / m, ms(loaderLazy.comments)]],
    };
  },
  prefetch: () => {
    const { click, hover, renderClick, renderHover } = R.prefetch, m = top(renderClick.comments);
    return {
      verdict: t("Comments after the click: " + ms(click.comments) + " with the route loader, " + ms(hover.comments) + " when it starts on hover, " + ms(click.comments - hover.comments) + " sooner. Fetch on render: " + ms(renderClick.comments) + " without the hover, " + ms(renderHover.comments) + " with it.",
        "Comentarios después del clic: " + ms(click.comments) + " con el loader de la ruta, " + ms(hover.comments) + " cuando arranca con el hover, " + ms(click.comments - hover.comments) + " antes. Fetch al renderizar: " + ms(renderClick.comments) + " sin hover, " + ms(renderHover.comments) + " con hover."),
      bars: [[t("Route loader, on click", "Loader de la ruta, al hacer clic"), click.comments / m, ms(click.comments)], [t("Route loader, from the hover", "Loader de la ruta, desde el hover"), hover.comments / m, ms(hover.comments), true], [t("Fetch on render, with or without hover", "Fetch al renderizar, con o sin hover"), renderHover.comments / m, ms(renderHover.comments)]],
    };
  },
  bff: () => {
    const { loader, bff, loaderSlow, bffSlow } = R.bff;
    return {
      verdict: t("Normal day: everything on screen at " + ms(bff.all) + " with /page and " + ms(loader.all) + " with the loader, but the header waits until " + ms(bff.user) + " instead of " + ms(loader.user) + ". Slow /notifs: with /page the posts show at " + ms(bffSlow.posts) + "; with the loader at " + ms(loaderSlow.posts) + ", and only the sidebar waits (" + ms(loaderSlow.notifs) + ").",
        "Día normal: todo en pantalla a los " + ms(bff.all) + " con /page y a los " + ms(loader.all) + " con el loader, pero el encabezado espera hasta los " + ms(bff.user) + " en lugar de " + ms(loader.user) + ". /notifs lento: con /page las publicaciones aparecen a los " + ms(bffSlow.posts) + "; con el loader a los " + ms(loaderSlow.posts) + ", y solo espera la barra lateral (" + ms(loaderSlow.notifs) + ")."),
      groups: [
        { title: t("Normal day", "Día normal"), bars: [[t("Everything, route loader", "Todo, loader de la ruta"), loader.all / top(bffSlow.all), ms(loader.all)], [t("Everything, one /page", "Todo, un solo /page"), bff.all / top(bffSlow.all), ms(bff.all), true]] },
        { title: t("Slow /notifs", "/notifs lento"), bars: [[t("Posts, route loader", "Publicaciones, loader de la ruta"), loaderSlow.posts / top(bffSlow.all), ms(loaderSlow.posts)], [t("Posts, one /page", "Publicaciones, un solo /page"), bffSlow.posts / top(bffSlow.all), ms(bffSlow.posts), true]] },
      ],
    };
  },
};

const { faster: F, parallel: Pa, split: Sp, prefetch: Pf, bff: B } = R;
const first = { start: "first", split: "bundle", rtt: RTT, servers: "normal" };

const EXPERIMENTS = [
  {
    id: "faster",
    title: t("Make every API twice as fast", "Hacer cada API el doble de rápida"),
    change: t("First visit · fetch on render · " + RTT + " ms round trip · /user, /posts, /notifs and /comments each answer in half their usual time",
      "Primera visita · fetch al renderizar · " + RTT + " ms de ida y vuelta · /user, /posts, /notifs y /comments responden cada una en la mitad de su tiempo habitual"),
    question: t("How much sooner are the comments on screen?", "¿Cuánto antes aparecen los comentarios en pantalla?"),
    options: [
      t("About twice as soon: the servers were the slow part", "Más o menos el doble de rápido: los servidores eran la parte lenta"),
      t("Under a tenth sooner: most of the wait is round trips, and they didn't change", "Menos de una décima parte antes: casi toda la espera son viajes de ida y vuelta, y esos no cambiaron"),
      t("No sooner at all: only the network matters", "Nada antes: solo importa la red"),
    ],
    answer: 1,
    why: t(
      "The comments sit at the end of " + Math.round(F.normal.chain) + " requests in a row: the HTML, main.js, /user, /posts, /comments. Each one starts only when the one before it is in, and each costs a full round trip before its server even starts, so " + Math.round(F.normal.chain) + " × " + RTT + " ms = " + ms(Math.round(F.normal.chain) * RTT) + " of the " + ms(F.normal.comments) + " is travel; the rest is server time, downloading and running main.js, and renders. Halving the API time saves half of each API's server time, only on the links of the chain: " + ms(F.normal.comments - F.fast.comments) + ". To go faster, cut links, not milliseconds.",
      "Los comentarios están al final de " + Math.round(F.normal.chain) + " solicitudes en fila: el HTML, main.js, /user, /posts, /comments. Cada una empieza recién cuando llegó la anterior, y cada una cuesta un viaje de ida y vuelta completo antes de que su servidor siquiera empiece, así que " + Math.round(F.normal.chain) + " × " + RTT + " ms = " + ms(Math.round(F.normal.chain) * RTT) + " de los " + ms(F.normal.comments) + " son viaje; el resto es tiempo de servidor, descargar y ejecutar main.js, y renders. Reducir a la mitad el tiempo de las APIs ahorra la mitad del tiempo de servidor de cada API, y solo en los eslabones de la cadena: " + ms(F.normal.comments - F.fast.comments) + ". Para ir más rápido, quita eslabones, no milisegundos.",
    ),
    watch: { after: { ...first, mode: "render", servers: "fast" }, before: { ...first, mode: "render" } },
  },
  {
    id: "parallel",
    title: t("Start independent requests together", "Iniciar juntas las solicitudes independientes"),
    change: t("First visit · " + RTT + " ms round trip · fetch on render vs App starting /user, /posts and /notifs together when it mounts (/posts and /notifs only need the URL and the session)",
      "Primera visita · " + RTT + " ms de ida y vuelta · fetch al renderizar vs App iniciando /user, /posts y /notifs juntas cuando se monta (/posts y /notifs solo necesitan la URL y la sesión)"),
    question: t("How much sooner are the comments on screen?", "¿Cuánto antes aparecen los comentarios en pantalla?"),
    options: [
      t("No sooner: the comments still wait for the posts", "Nada antes: los comentarios siguen esperando a las publicaciones"),
      t("About one round trip sooner: /posts no longer waits for /user, but /comments still waits for /posts", "Más o menos un viaje de ida y vuelta antes: /posts ya no espera a /user, pero /comments sigue esperando a /posts"),
      t("Several times sooner: now everything loads at once", "Varias veces antes: ahora todo carga a la vez"),
    ],
    answer: 1,
    why: t(
      "Fetching on render, /posts waited for /user only because Posts couldn't mount until App had the user: a false dependency, made by the component tree, not by the data. Starting the three together removes that link (" + Math.round(Pa.render.chain) + " → " + Math.round(Pa.parallel.chain) + " round trips in a row), and the comments land at " + ms(Pa.parallel.comments) + " instead of " + ms(Pa.render.comments) + ". /comments needs the post ids, a true dependency, so it still waits for /posts; only the server can remove that one (the last experiment). A route loader that starts the same requests before the first render gets " + ms(Pa.loader.comments) + ": a few renders sooner, not another round trip.",
      "Con fetch al renderizar, /posts esperaba a /user solo porque Posts no podía montarse hasta que App tuviera el usuario: una dependencia falsa, creada por el árbol de componentes, no por los datos. Iniciar las tres juntas quita ese eslabón (" + Math.round(Pa.render.chain) + " → " + Math.round(Pa.parallel.chain) + " viajes en cadena), y los comentarios llegan a los " + ms(Pa.parallel.comments) + " en lugar de " + ms(Pa.render.comments) + ". /comments necesita los ids de las publicaciones, una dependencia real, así que sigue esperando a /posts; solo el servidor puede quitar esa (el último experimento). Un loader de la ruta que inicia las mismas solicitudes antes del primer render logra " + ms(Pa.loader.comments) + ": unos renders antes, no otro viaje de ida y vuelta.",
    ),
    watch: { after: { ...first, mode: "parallel" }, before: { ...first, mode: "render" } },
  },
  {
    id: "split",
    title: t("Split Comments into a lazy chunk", "Separar Comments en un chunk diferido"),
    change: t("First visit · Comments moves out of main.js (" + KB.main + " → " + KB.mainSplit + " KB) into comments.js (" + KB.chunk + " KB), loaded with React.lazy · fetch on render, then a route loader that starts comments.js along with the data",
      "Primera visita · Comments sale de main.js (" + KB.main + " → " + KB.mainSplit + " KB) y pasa a comments.js (" + KB.chunk + " KB), cargado con React.lazy · fetch al renderizar, y luego un loader de la ruta que inicia comments.js junto con los datos"),
    question: t("Fetching on render, what happens to the comments?", "Con fetch al renderizar, ¿qué pasa con los comentarios?"),
    options: [
      t("They land sooner: there's less JavaScript to download and run first", "Llegan antes: hay menos JavaScript que descargar y ejecutar primero"),
      t("They land later: comments.js is requested only when Comments first renders, and /comments only after it has run", "Llegan más tarde: comments.js se pide recién cuando Comments se renderiza por primera vez, y /comments recién después de que corrió"),
      t("No change: the chunk downloads in parallel with the data", "Ningún cambio: el chunk se descarga en paralelo con los datos"),
    ],
    answer: 1,
    why: t(
      "A lazy component's code is requested the first time it renders, and Comments only renders when the posts do; its own fetch then waits for its code to run. So the split adds a link, comments.js before /comments (" + Math.round(Sp.bundle.chain) + " → " + Math.round(Sp.lazy.chain) + " round trips in a row), and the comments land at " + ms(Sp.lazy.comments) + " instead of " + ms(Sp.bundle.comments) + ", even though the smaller main.js ran sooner. A route loader knows the page needs comments.js and starts it with the data, so its download hides behind /posts: " + ms(Sp.loaderLazy.comments) + ", now a little sooner than without the split (" + ms(Sp.loaderBundle.comments) + ").",
      "El código de un componente diferido se pide la primera vez que se renderiza, y Comments solo se renderiza cuando lo hacen las publicaciones; su propio fetch espera después a que corra su código. Así que separar agrega un eslabón, comments.js antes de /comments (" + Math.round(Sp.bundle.chain) + " → " + Math.round(Sp.lazy.chain) + " viajes en cadena), y los comentarios llegan a los " + ms(Sp.lazy.comments) + " en lugar de " + ms(Sp.bundle.comments) + ", aunque el main.js más chico corrió antes. Un loader de la ruta sabe que la página necesita comments.js y lo inicia junto con los datos, así que su descarga se esconde detrás de /posts: " + ms(Sp.loaderLazy.comments) + ", ahora un poco antes que sin separar (" + ms(Sp.loaderBundle.comments) + ").",
    ),
    watch: { after: { ...first, mode: "render", split: "lazy" }, before: { ...first, mode: "render" } },
  },
  {
    id: "prefetch",
    title: t("Prefetch on hover", "Precargar con hover"),
    change: t("A click on a link in an app that's already running · route loader · the pointer rests on the link " + HOVER + " ms before the click, and the router starts the loader on hover",
      "Un clic en un enlace de una app que ya está corriendo · loader de la ruta · el puntero se posa en el enlace " + HOVER + " ms antes del clic, y el router arranca el loader con el hover"),
    question: t("How much sooner are the comments on screen after the click?", "¿Cuánto antes aparecen los comentarios en pantalla después del clic?"),
    options: [
      t("At once: everything was fetched during the hover", "De inmediato: todo se descargó durante el hover"),
      t("About " + HOVER + " ms sooner: the hover is a head start as long as itself, no more", "Unos " + HOVER + " ms antes: el hover es una ventaja tan larga como él mismo, no más"),
      t("No sooner: data can't be fetched before the navigation", "Nada antes: los datos no se pueden pedir antes de la navegación"),
    ],
    answer: 1,
    why: t(
      "Prefetching starts the same waterfall earlier; it doesn't shorten it. The loader's chain here is " + Math.round(Pf.click.chain) + " round trips in a row (/posts, then /comments), " + ms(Pf.click.comments) + " after the click; starting " + HOVER + " ms early lands the comments at " + ms(Pf.hover.comments) + ". A prefetch hides a waterfall only when the hover lasts longer than the waterfall. It also needs the route to know its requests up front: fetching on render, they live inside components that haven't rendered yet (the route's code is already loaded here), so the router has nothing to start, and the comments land at " + ms(Pf.renderHover.comments) + " with or without the hover.",
      "Precargar inicia la misma cascada antes; no la acorta. La cadena del loader aquí es de " + Math.round(Pf.click.chain) + " viajes de ida y vuelta seguidos (/posts y luego /comments), " + ms(Pf.click.comments) + " después del clic; empezar " + HOVER + " ms antes hace que los comentarios lleguen a los " + ms(Pf.hover.comments) + ". Una precarga esconde una cascada solo cuando el hover dura más que la cascada. Además necesita que la ruta conozca sus solicitudes de antemano: con fetch al renderizar, viven dentro de componentes que todavía no se renderizaron (aquí el código de la ruta ya está cargado), así que el router no tiene nada que iniciar, y los comentarios llegan a los " + ms(Pf.renderHover.comments) + " con o sin hover.",
    ),
    watch: { after: { ...first, mode: "loader", start: "hover" }, before: { ...first, mode: "loader", start: "click" } },
  },
  {
    id: "bff",
    title: t("One request for everything", "Una sola solicitud para todo"),
    change: t("First visit · route loader vs one /page request to a backend for frontend (BFF) that calls the services itself, " + INNER_RTT + " ms away, and returns everything nested · then /notifs has a slow day (about " + SLOW_NOTIFS + " ms)",
      "Primera visita · loader de la ruta vs una sola solicitud /page a un backend for frontend (BFF) que llama a los servicios él mismo, a " + INNER_RTT + " ms, y devuelve todo anidado · luego /notifs tiene un día lento (unos " + SLOW_NOTIFS + " ms)"),
    question: t("On the slow day, when do the posts show with the one /page request?", "En el día lento, ¿cuándo aparecen las publicaciones con la única solicitud /page?"),
    options: [
      t("On time: the posts don't need the notifications", "A tiempo: las publicaciones no necesitan las notificaciones"),
      t("Only once the notifications are ready: one response waits for its slowest part", "Recién cuando están listas las notificaciones: una respuesta espera a su parte más lenta"),
      t("Sooner than with the loader: one round trip always beats several", "Antes que con el loader: un viaje de ida y vuelta siempre le gana a varios"),
    ],
    answer: 1,
    why: t(
      "The backend for frontend keeps the waterfall but moves it into the data center: /comments still waits for /posts, " + INNER_RTT + " ms away instead of " + RTT + ". On a normal day that wins: everything lands at " + ms(B.bff.all) + " against " + ms(B.loader.all) + " with the loader, at the cost of the header, which waits until " + ms(B.bff.user) + " instead of " + ms(B.loader.user) + ", because nothing renders until the whole response is in. And a response is as slow as its slowest part: on the slow day the posts wait for the notifications, " + ms(B.bffSlow.posts) + " against " + ms(B.loaderSlow.posts) + " with the loader, where only the sidebar is late. Streaming the parts as they become ready gets some of both.",
      "El backend for frontend mantiene la cascada pero la muda al centro de datos: /comments sigue esperando a /posts, a " + INNER_RTT + " ms en lugar de " + RTT + ". En un día normal eso gana: todo llega a los " + ms(B.bff.all) + " contra " + ms(B.loader.all) + " con el loader, a costa del encabezado, que espera hasta los " + ms(B.bff.user) + " en lugar de " + ms(B.loader.user) + ", porque nada se renderiza hasta que llega la respuesta completa. Y una respuesta es tan lenta como su parte más lenta: en el día lento las publicaciones esperan a las notificaciones, " + ms(B.bffSlow.posts) + " contra " + ms(B.loaderSlow.posts) + " con el loader, donde solo se atrasa la barra lateral. Enviar las partes a medida que están listas (streaming) da algo de ambas cosas.",
    ),
    watch: { after: { ...first, mode: "bff", servers: "slow" }, before: { ...first, mode: "loader", servers: "slow" } },
  },
];

const QUESTIONS = [
  [t("What makes a request waterfall, and why doesn't a faster server fix it?", "¿Qué produce una cascada de solicitudes y por qué un servidor más rápido no la arregla?"),
    t("Each request in a chain starts only after another one has finished, so the page pays for every link in turn, and each link costs at least one round trip whatever the server does. Four links on a 150 ms round trip spend 600 ms traveling before any server time. HTTP/2 lets many requests share one connection (lesson 49), but it can't send a request the page hasn't asked for yet. Cut the number of links, or shorten the trip (serve from closer to the user). If the largest element on screen sits at the end of the chain, Largest Contentful Paint (LCP) waits for the whole chain.",
      "Cada solicitud de una cadena empieza recién cuando otra terminó, así que la página paga cada eslabón por turno, y cada eslabón cuesta al menos un viaje de ida y vuelta, haga lo que haga el servidor. Cuatro eslabones con 150 ms de ida y vuelta gastan 600 ms viajando antes de cualquier tiempo de servidor. HTTP/2 deja que muchas solicitudes compartan una conexión (lección 49), pero no puede enviar una solicitud que la página todavía no pidió. Quita eslabones, o acorta el viaje (sirve desde más cerca del usuario). Si el elemento más grande de la pantalla está al final de la cadena, el Largest Contentful Paint (LCP) espera toda la cadena.")],
  [t("How do you find the waterfalls on a real page?", "¿Cómo encuentras las cascadas en una página real?"),
    t("Open the Network panel in DevTools and read its waterfall column: a bar that starts where another ends is a link in a chain, and the Initiator column shows which script or request started each one. Throttle the network so round trips dominate the way they do on a phone, and look for requests that only start after a render or after a chunk has run. Lighthouse flags chains of critical requests too. Then ask of each link: does it need data from the one before, or does it only wait for a component to render?",
      "Abre el panel Network de las DevTools y lee su columna de cascada (waterfall): una barra que empieza donde termina otra es un eslabón de una cadena, y la columna Initiator muestra qué script o solicitud inició cada una. Limita la red (throttling) para que los viajes de ida y vuelta dominen como en un teléfono, y busca solicitudes que solo empiezan después de un render o después de que corrió un chunk. Lighthouse también marca cadenas de solicitudes críticas. Después pregúntate por cada eslabón: ¿necesita datos del anterior, o solo espera a que se renderice un componente?")],
  [t("Some dependencies are real and some are accidents of the component tree. Give an example of each, and say who can remove it.", "Algunas dependencias son reales y otras son accidentes del árbol de componentes. Da un ejemplo de cada una y di quién puede quitarla."),
    t("Real: the request needs a value from another response, like comments that need the post ids. False: the request only waits because the component that makes it can't render yet, like posts behind a spinner that waits for the user, or a lazy chunk that must run before its component can fetch. The client removes false ones: start independent requests together, hoist them into a route loader, preload chunks with their data. Only the server removes real ones: accept what the client already knows (the URL, the session), or resolve the chain itself (a nested endpoint, a backend for frontend, a GraphQL query).",
      "Real: la solicitud necesita un valor de otra respuesta, como los comentarios que necesitan los ids de las publicaciones. Falsa: la solicitud solo espera porque el componente que la hace todavía no puede renderizarse, como las publicaciones detrás de un spinner que espera al usuario, o un chunk diferido que tiene que correr antes de que su componente pueda pedir datos. El cliente quita las falsas: iniciar juntas las solicitudes independientes, subirlas a un loader de la ruta, precargar los chunks con sus datos. Solo el servidor quita las reales: aceptar lo que el cliente ya sabe (la URL, la sesión), o resolver la cadena él mismo (un endpoint anidado, un backend for frontend, una consulta GraphQL).")],
  [t("What does a route loader (render-as-you-fetch) change compared with fetching in each component?", "¿Qué cambia un loader de la ruta (render-as-you-fetch) frente a pedir los datos en cada componente?"),
    t("The route declares what it needs, so the requests start when the navigation starts, before any component renders: all the independent ones at once, and each dependent one the moment its input arrives instead of after a render. Components then read data that is already on its way, behind Suspense or a loading state. It also makes prefetching possible, because a router that knows the loader can start it on hover. React Router, Remix and TanStack Router have loaders like this; with React Query, prefetching the queries in the route does the same job.",
      "La ruta declara lo que necesita, así que las solicitudes empiezan cuando empieza la navegación, antes de que se renderice cualquier componente: todas las independientes a la vez, y cada dependiente en cuanto llega su dato de entrada en lugar de después de un render. Los componentes leen datos que ya vienen en camino, detrás de Suspense o de un estado de carga. También hace posible precargar, porque un router que conoce el loader puede arrancarlo con el hover. React Router, Remix y TanStack Router tienen loaders así; con React Query, precargar las consultas en la ruta cumple la misma función.")],
  [t("Code splitting made the bundle smaller and the page slower. How, and what keeps the split without the cost?", "Separar el código hizo el bundle más chico y la página más lenta. ¿Cómo, y qué conserva la separación sin el costo?"),
    t("A lazy component's chunk is requested the first time it renders, which is often after its parent's data arrives, and its own fetch waits for the chunk to run: chunk, then data, two links where there was none. Start the chunk with the data (a route that lists its chunks, an import() started in the loader, or a modulepreload link), and fetch the component's data in the loader so it doesn't depend on the code. Split where the code isn't on the path to first content: below the fold, behind an interaction.",
      "El chunk de un componente diferido se pide la primera vez que se renderiza, que suele ser después de que llegan los datos de su padre, y su propio fetch espera a que el chunk corra: chunk y después datos, dos eslabones donde no había ninguno. Inicia el chunk junto con los datos (una ruta que declara sus chunks, un import() iniciado en el loader o un link modulepreload), y pide los datos del componente en el loader para que no dependan del código. Separa donde el código no está en el camino al primer contenido: más abajo en la página, detrás de una interacción.")],
  [t("When is one aggregated request (a backend for frontend, or a GraphQL query) worth it, and what does it cost?", "¿Cuándo vale la pena una sola solicitud agregada (un backend for frontend o una consulta GraphQL) y qué cuesta?"),
    t("It turns several client round trips into one and moves the dependent calls next to the services, where a hop costs a few milliseconds: a big win on slow or distant networks. The costs: the response is as late as its slowest part unless the server streams it; there's one more endpoint per screen to own and change with the UI; caching gets coarser, since one changed field invalidates the whole response. Inside the server, the same calls can turn into N + 1 queries (lesson 27), and a page that fans out to many services waits for the slowest of them, so their tail latency becomes yours (lesson 44).",
      "Convierte varios viajes de ida y vuelta del cliente en uno y muda las llamadas dependientes junto a los servicios, donde un salto cuesta unos pocos milisegundos: una gran ganancia en redes lentas o lejanas. Los costos: la respuesta llega tan tarde como su parte más lenta, salvo que el servidor la envíe por partes (streaming); hay un endpoint más por pantalla que mantener y cambiar junto con la interfaz; el caché se vuelve más grueso, porque un campo que cambia invalida la respuesta entera. Dentro del servidor, las mismas llamadas pueden convertirse en N + 1 consultas (lección 27), y una página que reparte trabajo entre muchos servicios espera al más lento, así que su latencia de cola pasa a ser la tuya (lección 44).")],
];

export default defineLesson({
  title: t("Request Waterfalls Workbench", "Banco de trabajo: cascadas de solicitudes"),
  eyebrow: t("Systems lesson 55 · Request waterfalls", "Lección de sistemas 55 · Cascadas de solicitudes"),
  lede: t("When each component fetches its own data after it renders, requests line up: the page waits for the HTML, then the JavaScript, then the parent's data, then the child's. Each link costs at least a round trip, so four links on a 150 ms round trip spend 600 ms traveling, however fast the servers are. This lesson runs that as a relay race: watch it, predict what shortens it, then explain it back.",
    "Cuando cada componente pide sus datos después de renderizarse, las solicitudes se ponen en fila: la página espera el HTML, luego el JavaScript, luego los datos del padre y luego los del hijo (una cascada de solicitudes, request waterfall). Cada eslabón cuesta al menos un viaje de ida y vuelta, así que cuatro eslabones con 150 ms de ida y vuelta gastan 600 ms viajando, por rápidos que sean los servidores. Esta lección lo corre como una carrera de relevos: mírala, predice qué la acorta y luego explícalo."),
  machine: {
    intro: t("Each runner is a request. It waits at the start line until the page asks for it, runs to the server and back, and its crate lands on the browser's bench. Fetching on render, most runners can't leave until another crate is in, and the board behind them draws that wait as a staircase. Time runs five times slower than real life at ×1; dashed outlines on the board are the same load with your previous settings.",
      "Cada corredor es una solicitud. Espera en la línea de salida hasta que la página la pide, corre al servidor y vuelve, y su caja cae en la mesa del navegador. Con fetch al renderizar, casi ningún corredor puede salir hasta que llegue otra caja, y el tablero de atrás dibuja esa espera como una escalera. El tiempo corre cinco veces más lento que en la vida real en ×1; los contornos punteados del tablero son la misma carga con tus ajustes anteriores."),
    plate: {
      title: t("Relay track", "Pista de relevos"),
      keys: [
        { mark: "lit", label: t("In flight: a running request and its bar; the service at work; the part of the page that just landed", "En vuelo: una solicitud corriendo y su barra; el servicio trabajando; la parte de la página que acaba de llegar") },
        { mark: "raised", label: t("Runners are requests, one lane each; crates are their responses", "Los corredores son solicitudes, un carril cada una; las cajas son sus respuestas") },
        { mark: "flat", label: t("Dashed outlines: the previous settings' load; thin bars in the service rows: the calls /page makes on the server", "Contornos punteados: la carga con los ajustes anteriores; barras finas en las filas de los servicios: las llamadas que /page hace en el servidor") },
      ],
      caption: t(
        "A request costs a round trip, plus its server time, plus its bytes at " + MBIT + " Mbit/s. Median server times: /user " + SERVER.user + " ms, /posts " + SERVER.posts + ", /notifs " + SERVER.notifs + ", /comments " + SERVER.comments + ", the HTML " + SERVER.html + " and the JavaScript files " + SERVER.main + " from a CDN, each varying about ±30% from load to load. main.js is " + KB.main + " KB (" + KB.mainSplit + " KB when Comments is its own " + KB.chunk + " KB chunk); running JavaScript takes " + EXEC_PER_KB + " ms per KB and every render " + RENDER + " ms, one at a time on the main thread. One HTTP/2 connection is already open, so requests in flight don't wait for each other (lesson 49 covers when they do). /comments needs the post ids from /posts; every other request needs only the URL and the session. The backend for frontend behind /page is " + INNER_RTT + " ms from each service.",
        "Una solicitud cuesta un viaje de ida y vuelta, más su tiempo de servidor, más sus bytes a " + MBIT + " Mbit/s. Tiempos de servidor medianos: /user " + SERVER.user + " ms, /posts " + SERVER.posts + ", /notifs " + SERVER.notifs + ", /comments " + SERVER.comments + ", el HTML " + SERVER.html + " y los archivos JavaScript " + SERVER.main + " desde una CDN, y cada uno varía alrededor de ±30% de una carga a otra. main.js pesa " + KB.main + " KB (" + KB.mainSplit + " KB cuando Comments es su propio chunk de " + KB.chunk + " KB); ejecutar JavaScript toma " + EXEC_PER_KB + " ms por KB y cada render " + RENDER + " ms, de a uno en el hilo principal. Ya hay una conexión HTTP/2 abierta, así que las solicitudes en vuelo no se esperan entre sí (la lección 49 cubre cuándo sí). /comments necesita los ids de las publicaciones de /posts; todas las demás solicitudes solo necesitan la URL y la sesión. El backend for frontend detrás de /page está a " + INNER_RTT + " ms de cada servicio.",
      ),
      stage: { "data-relay": "" },
      label: t("Request waterfall simulation. Space pauses or resumes.", "Simulación de cascada de solicitudes. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["user", t("Header on screen", "Encabezado en pantalla"), "–"],
      ["comments", t("Comments on screen", "Comentarios en pantalla"), "–"],
      ["all", t("Everything on screen", "Todo en pantalla"), "–"],
      ["chain", t("Round trips in a row", "Viajes en cadena"), "–"],
      ["requests", t("Requests", "Solicitudes"), "–"],
      ["flight", t("Most in flight at once", "Máximo en vuelo a la vez"), "–"],
    ],
    controls: [
      { seg: "mode", label: t("Data loading", "Carga de datos"), options: [["render", t("Fetch on render", "Fetch al renderizar")], ["parallel", t("Parallel in App", "En paralelo en App")], ["loader", t("Route loader", "Loader de la ruta")], ["bff", t("One request (BFF)", "Una solicitud (BFF)")]], value: "render" },
      { seg: "split", label: t("Comments code", "Código de Comments"), options: [["bundle", t("In main.js", "En main.js")], ["lazy", t("Lazy chunk", "Chunk diferido")]], value: "bundle" },
      { seg: "start", label: t("Load", "Carga"), options: [["first", t("First visit", "Primera visita")], ["click", t("Click a link", "Clic en un enlace")], ["hover", t("Hover, then click", "Hover y luego clic")]], value: "first" },
      { seg: "rtt", label: t("Round trip", "Ida y vuelta"), options: [[40, "40 ms"], [150, "150 ms"], [300, "300 ms"]], value: 150 },
      { seg: "servers", label: t("Servers", "Servidores"), options: [["normal", t("Normal", "Normales")], ["fast", t("APIs 2× faster", "APIs 2× más rápidas")], ["slow", t("Slow /notifs", "/notifs lento")]], value: "normal" },
      { speed: true },
      { actions: [["reload", t("Load again", "Cargar de nuevo")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Changing a setting starts a new load and keeps the old settings as dashed outlines on the board, run with the same server times. After each load the machine waits a moment and loads again. A click starts in an app that is already running: the HTML and main.js are in, and the route's code is too.",
      "Cambiar un ajuste inicia una carga nueva y deja los ajustes anteriores como contornos punteados en el tablero, con los mismos tiempos de servidor. Después de cada carga la máquina espera un momento y vuelve a cargar. Un clic empieza en una app que ya está corriendo: el HTML y main.js ya llegaron, y el código de la ruta también.",
    ),
  },
  predict: {
    intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, at a " + RTT + " ms round trip, averaged over " + SEEDS.length + " seeded loads.",
      "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, con " + RTT + " ms de ida y vuelta, promediados sobre " + SEEDS.length + " cargas con semilla fija."),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; its timings are a model, not measurements of any site, browser or framework.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; sus tiempos son un modelo, no mediciones de ningún sitio, navegador ni framework.`),
  css: LIT_FILL_CSS + FIGURE_CSS,
  data: { P, G: GEOMETRY },
});
