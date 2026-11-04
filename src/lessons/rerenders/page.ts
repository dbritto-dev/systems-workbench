// @ts-nocheck: content in the style of the other lessons
// Systems lesson 54 · Re-render cascades: a component board where one state change lights everything below it.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, P, GEOMETRY } from "./figure";
import { averaged, N, NODES, FIRST, CARDS, READER_COUNT, SEEDS, COUNT } from "./sim";

// Experiment results, computed at build time from the same model the page runs (8 seeds × 40 interactions each).
const R = {
  top: averaged({ source: "top", memo: "off" }, "key"),
  down: averaged({ source: "down", memo: "off" }, "key"),
  ctxOne: averaged({ source: "context", memo: "stable" }, "cart"),
  ctxSplit: averaged({ source: "split", memo: "stable" }, "cart"),
  pickSplit: averaged({ source: "split", memo: "off" }, "pick"),
  pickStore: averaged({ source: "store", memo: "off" }, "pick"),
  pickProps: averaged({ source: "down", memo: "stable" }, "pick"),
  memoInline: averaged({ source: "down", memo: "inline" }, "key"),
  memoStable: averaged({ source: "down", memo: "stable" }, "key"),
};

const FRAME = 1000 / 60;                                         // ms: one frame at 60 Hz
const cnt = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : one(x));
const ms = (x) => (x < 1 ? x.toFixed(2) : x.toFixed(1)) + " ms";
const us = (x) => Math.round(x * 1000) + " µs";
const CHART_MS = String(NODES[FIRST.PriceChart].cost / 1000);    // the price chart's render cost, in ms
const LINK_US = NODES[FIRST.NavLink].cost, CARD_US = NODES[FIRST.ResultCard].cost;
const FILTERS = NODES.filter((n) => n.name === "Filter").length;
const WORK_TOP = Math.max(R.top.work, R.ctxOne.work, FRAME) * 1.1;

// What each card shows after a run.
const RUNS = {
  cascade: () => {
    const r = R.top, over = r.work > FRAME;
    return {
      verdict: t("All " + cnt(r.rendered) + " components rendered on every keystroke; " + cnt(r.commits) + " DOM changes on average, so " + cnt(r.wasted) + " renders changed nothing. Work per keystroke: " + ms(r.work) + (over ? ", more than a frame at 60 Hz (" + ms(FRAME) + ")." : "."),
        "Los " + cnt(r.rendered) + " componentes se renderizaron en cada pulsación; " + cnt(r.commits) + " cambios en el DOM en promedio, así que " + cnt(r.wasted) + " renders no cambiaron nada. Trabajo por pulsación: " + ms(r.work) + (over ? ", más que un cuadro a 60 Hz (" + ms(FRAME) + ")." : ".")),
      bars: [
        [t("Components rendered", "Componentes renderizados"), r.rendered / N, cnt(r.rendered), true],
        [t("DOM changes", "Cambios DOM"), r.commits / N, cnt(r.commits)],
        [t("Work per keystroke", "Trabajo por pulsación"), r.work / WORK_TOP, ms(r.work), true],
        [t("One frame at 60 Hz", "Un cuadro a 60 Hz"), FRAME / WORK_TOP, ms(FRAME)],
      ],
    };
  },
  down: () => {
    const a = R.top, b = R.down;
    return {
      verdict: t("Renders per keystroke: " + cnt(a.rendered) + " → " + cnt(b.rendered) + ", " + cnt(b.cardsRendered) + " of them result cards. Work: " + ms(a.work) + " → " + ms(b.work) + ".",
        "Renders por pulsación: " + cnt(a.rendered) + " → " + cnt(b.rendered) + ", " + cnt(b.cardsRendered) + " de ellos tarjetas de resultados. Trabajo: " + ms(a.work) + " → " + ms(b.work) + "."),
      bars: [
        [t("Renders, state in App", "Renders, estado en App"), a.rendered / N, cnt(a.rendered)],
        [t("Renders, moved down", "Renders, más abajo"), b.rendered / N, cnt(b.rendered), true],
        [t("Work, state in App", "Trabajo, estado en App"), a.work / WORK_TOP, ms(a.work)],
        [t("Work, moved down", "Trabajo, más abajo"), b.work / WORK_TOP, ms(b.work), true],
      ],
    };
  },
  context: () => {
    const a = R.ctxOne, b = R.ctxSplit;
    return {
      verdict: t("One cart click: " + cnt(a.rendered) + " renders with one context, " + cnt(b.rendered) + " with split contexts (App and CartBadge). Work: " + ms(a.work) + " → " + ms(b.work) + ". DOM changes in both cases: " + cnt(a.commits) + ".",
        "Un clic en el carrito: " + cnt(a.rendered) + " renders con un contexto, " + cnt(b.rendered) + " con contextos separados (App y CartBadge). Trabajo: " + ms(a.work) + " → " + ms(b.work) + ". Cambios en el DOM en los dos casos: " + cnt(a.commits) + "."),
      bars: [
        [t("Renders, one context", "Renders, un contexto"), a.rendered / N, cnt(a.rendered), true],
        [t("Renders, split contexts", "Renders, contextos separados"), b.rendered / N, cnt(b.rendered)],
        [t("Work, one context", "Trabajo, un contexto"), a.work / WORK_TOP, ms(a.work), true],
        [t("Work, split contexts", "Trabajo, contextos separados"), b.work / WORK_TOP, ms(b.work)],
      ],
    };
  },
  store: () => {
    const a = R.pickSplit, b = R.pickStore, c = R.pickProps;
    return {
      verdict: t("Cards rendered per pick: " + cnt(a.cardsRendered) + " with a selection context, " + cnt(b.cardsRendered) + " with store selectors, while all " + cnt(b.selectors) + " selectors ran. Work: " + ms(a.work) + " → " + ms(b.work) + ". Props with React.memo also get " + cnt(c.cardsRendered) + " cards, after " + cnt(c.compares) + " props comparisons.",
        "Tarjetas renderizadas por elección: " + cnt(a.cardsRendered) + " con un contexto de selección, " + cnt(b.cardsRendered) + " con selectores del store, mientras corrían los " + cnt(b.selectors) + " selectores. Trabajo: " + ms(a.work) + " → " + ms(b.work) + ". Props con React.memo también logran " + cnt(c.cardsRendered) + " tarjetas, tras " + cnt(c.compares) + " comparaciones de props."),
      bars: [
        [t("Cards rendered, context", "Tarjetas renderizadas, contexto"), a.cardsRendered / CARDS, cnt(a.cardsRendered)],
        [t("Cards rendered, store", "Tarjetas renderizadas, store"), b.cardsRendered / CARDS, cnt(b.cardsRendered), true],
        [t("Selectors run, store", "Selectores ejecutados, store"), b.selectors / N, cnt(b.selectors)],
        [t("Work, context", "Trabajo, contexto"), a.work / WORK_TOP, ms(a.work)],
        [t("Work, store", "Trabajo, store"), b.work / WORK_TOP, ms(b.work), true],
      ],
    };
  },
  memo: () => {
    const a = R.down, b = R.memoInline, c = R.memoStable;
    return {
      verdict: t("Renders per keystroke: " + cnt(a.rendered) + " without memo, " + cnt(b.rendered) + " with memo and inline props, " + cnt(c.rendered) + " with stable props. Work: " + ms(a.work) + ", " + ms(b.work) + " (" + cnt(b.compares) + " comparisons, " + us(b.work - a.work) + " more), " + ms(c.work) + ".",
        "Renders por pulsación: " + cnt(a.rendered) + " sin memo, " + cnt(b.rendered) + " con memo y props inline, " + cnt(c.rendered) + " con props estables. Trabajo: " + ms(a.work) + ", " + ms(b.work) + " (" + cnt(b.compares) + " comparaciones, " + us(b.work - a.work) + " más), " + ms(c.work) + "."),
      bars: [
        [t("Renders, no memo", "Renders, sin memo"), a.rendered / N, cnt(a.rendered)],
        [t("Renders, inline props", "Renders, props inline"), b.rendered / N, cnt(b.rendered), true],
        [t("Renders, stable props", "Renders, props estables"), c.rendered / N, cnt(c.rendered)],
        [t("Work, inline props", "Trabajo, props inline"), b.work / WORK_TOP, ms(b.work), true],
        [t("Work, stable props", "Trabajo, props estables"), c.work / WORK_TOP, ms(c.work)],
      ],
    };
  },
};

const EXPERIMENTS = [
  {
    id: "cascade",
    title: t("One keystroke, state in App", "Una pulsación, estado en App"),
    change: t("The search text lives in useState in App and goes down as props · no React.memo · type one key",
      "El texto de búsqueda vive en un useState de App y baja como props · sin React.memo · teclea una vez"),
    question: t("Only SearchInput and Suggestions show the text. On one keystroke, how many of the " + N + " components render, and how much of the DOM changes?",
      "Solo SearchInput y Suggestions muestran el texto. En una pulsación, ¿cuántos de los " + N + " componentes se renderizan y cuánto cambia el DOM?"),
    options: [
      t("Two components render, and their DOM changes", "Se renderizan dos componentes, y cambia su DOM"),
      t("All " + N + " render, and the browser redraws every one of them", "Se renderizan los " + N + ", y el navegador redibuja cada uno"),
      t("All " + N + " render, but React changes the DOM for only one or two", "Se renderizan los " + N + ", pero React cambia el DOM de solo uno o dos"),
    ],
    answer: 2,
    why: t(
      "setState in App renders App, and a render creates new elements, with new props objects, for every child it returns. Without React.memo each child renders, and its children, all the way down: all " + cnt(R.top.rendered) + ", the " + CHART_MS + " ms PriceChart and the " + CARDS + " ResultCards included. Rendering means calling the component and comparing what it returns with last time; React then commits to the DOM only the differences: the input's text, and the suggestions when they change, " + cnt(R.top.commits) + " DOM changes per keystroke on average. The DOM is fine. The cost is the render work itself, " + ms(R.top.work) + " of main-thread time per keystroke, and " + cnt(R.top.wasted) + " of the renders returned exactly what they returned before.",
      "setState en App renderiza App, y un render crea elementos nuevos, con objetos de props nuevos, para cada hijo que devuelve. Sin React.memo cada hijo se renderiza, y sus hijos, hasta abajo: los " + cnt(R.top.rendered) + ", incluidos el PriceChart de " + CHART_MS + " ms y las " + CARDS + " tarjetas. Renderizar es llamar al componente y comparar lo que devuelve con la vez anterior; después React aplica al DOM solo las diferencias: el texto del input, y las sugerencias cuando cambian, " + cnt(R.top.commits) + " cambios en el DOM por pulsación en promedio. El DOM está bien. El costo es el trabajo de renderizar, " + ms(R.top.work) + " del hilo principal por pulsación, y " + cnt(R.top.wasted) + " de los renders devolvieron exactamente lo mismo que antes.",
    ),
    watch: { source: "top", memo: "off", input: "key" },
  },
  {
    id: "down",
    title: t("Move the state down", "Bajar el estado"),
    change: t("The search text moves from App into SearchPanel, the closest component that contains both components that read it · no React.memo · type one key",
      "El texto de búsqueda pasa de App a SearchPanel, el componente más cercano que contiene a los dos componentes que lo leen · sin React.memo · teclea una vez"),
    question: t("How many components render on a keystroke now?", "¿Cuántos componentes se renderizan ahora en una pulsación?"),
    options: [
      t("Two: SearchInput and Suggestions, the ones that read the text", "Dos: SearchInput y Suggestions, los que leen el texto"),
      t("About fifty: SearchPanel and everything it renders, the " + CARDS + " cards included", "Unos cincuenta: SearchPanel y todo lo que renderiza, incluidas las " + CARDS + " tarjetas"),
      t("Still all " + N + ": the keystroke still starts at the top", "Todavía los " + N + ": la pulsación sigue empezando arriba"),
    ],
    answer: 1,
    why: t(
      "State can only move as low as the closest component that contains everything that reads or sets it; for the search text that is SearchPanel. The update now starts there: Header, Sidebar with its " + CHART_MS + " ms PriceChart, and Footer no longer render, and the work per keystroke drops from " + ms(R.top.work) + " to " + ms(R.down.work) + ". But SearchPanel also renders ResultList, so the list and its " + CARDS + " cards still render on every keystroke without reading the text: " + cnt(R.down.rendered) + " renders, most of the cost. To go further, give the input and its suggestions a component of their own that owns the text, pass the list in as children, or keep the list from rendering with React.memo (experiment 5).",
      "El estado solo puede bajar hasta el componente más cercano que contiene todo lo que lo lee o lo cambia; para el texto de búsqueda es SearchPanel. Ahora la actualización empieza ahí: Header, Sidebar con su PriceChart de " + CHART_MS + " ms y Footer ya no se renderizan, y el trabajo por pulsación baja de " + ms(R.top.work) + " a " + ms(R.down.work) + ". Pero SearchPanel también renderiza ResultList, así que la lista y sus " + CARDS + " tarjetas se siguen renderizando en cada pulsación sin leer el texto: " + cnt(R.down.rendered) + " renders, casi todo el costo. Para ir más lejos, dales al input y a sus sugerencias un componente propio que tenga el texto, pasa la lista como children, o evita que la lista se renderice con React.memo (experimento 5).",
    ),
    watch: { source: "down", memo: "off", input: "key" },
  },
  {
    id: "context",
    title: t("One context for everything", "Un solo contexto para todo"),
    change: t("App holds all the state, shares it in one context value { query, selected, cart, user, filters } and renders {children} · React.memo with stable props on Header, Sidebar, ResultList, ResultCard and Footer · add one item to the cart",
      "App tiene todo el estado, lo comparte en un solo valor de contexto { query, selected, cart, user, filters } y renderiza {children} · React.memo con props estables en Header, Sidebar, ResultList, ResultCard y Footer · agrega un producto al carrito"),
    question: t("Only CartBadge shows the cart count. How many components render?", "Solo CartBadge muestra la cantidad del carrito. ¿Cuántos componentes se renderizan?"),
    options: [
      t("Just CartBadge, and App: React.memo stops the rest", "Solo CartBadge, y App: React.memo frena el resto"),
      t("Every component that reads the context, whatever field it reads, and what those render", "Todo componente que lee el contexto, lea el campo que lea, y lo que esos renderizan"),
      t("All " + N + ": the provider re-renders the whole tree", "Los " + N + ": el proveedor vuelve a renderizar todo el árbol"),
    ],
    answer: 1,
    why: t(
      "A context has one value, and every component that calls useContext on it renders when that value changes, compared with Object.is. App builds a new object on every render, so a cart change reaches all " + READER_COUNT + " readers, the " + CARDS + " cards among them, plus what they render: Sidebar takes its " + CHART_MS + " ms PriceChart and " + FILTERS + " Filters along. That is " + cnt(R.ctxOne.rendered) + " renders, " + ms(R.ctxOne.work) + ". React.memo does not help: it compares the props a parent passes, and a context change renders a component whatever its props are. App's own render stops at {children}: those elements were created outside App and are the same as last time, which is why it isn't all " + N + ". Split the context by what changes together (the cart, the search text, the selection, the setters in a context of their own) and the same click renders " + cnt(R.ctxSplit.rendered) + " components.",
      "Un contexto tiene un solo valor, y todo componente que llama a useContext con él se renderiza cuando ese valor cambia, comparado con Object.is. App arma un objeto nuevo en cada render, así que un cambio del carrito llega a los " + READER_COUNT + " lectores, entre ellos las " + CARDS + " tarjetas, más lo que renderizan: Sidebar arrastra su PriceChart de " + CHART_MS + " ms y sus " + FILTERS + " componentes Filter. Son " + cnt(R.ctxOne.rendered) + " renders, " + ms(R.ctxOne.work) + ". React.memo no ayuda: compara las props que pasa el padre, y un cambio de contexto renderiza al componente sean cuales sean sus props. El render de App se detiene en {children}: esos elementos se crearon fuera de App y son los mismos que la vez anterior, por eso no son los " + N + ". Separa el contexto por lo que cambia junto (el carrito, el texto de búsqueda, la selección, y los setters en un contexto propio) y el mismo clic renderiza " + cnt(R.ctxSplit.rendered) + " componentes.",
    ),
    watch: { source: "context", memo: "stable", input: "cart" },
  },
  {
    id: "store",
    title: t("Selectors in a store", "Selectores en un store"),
    change: t("Pick a card · with split contexts every card reads a selection context · with a store, each card subscribes with useStore((s) => s.selectedId === id)",
      "Elige una tarjeta · con contextos separados cada tarjeta lee un contexto de selección · con un store, cada tarjeta se suscribe con useStore((s) => s.selectedId === id)"),
    question: t("With the store, how many cards render when you pick one?", "Con el store, ¿cuántas tarjetas se renderizan cuando eliges una?"),
    options: [
      t("All " + CARDS + ": the store notifies every subscriber of every change", "Las " + CARDS + ": el store avisa a cada suscriptor de cada cambio"),
      t("Two: the card that lost the selection and the one that got it", "Dos: la tarjeta que perdió la selección y la que la ganó"),
      t("One: the card you clicked", "Una: la tarjeta en la que hiciste clic"),
    ],
    answer: 1,
    why: t(
      "A store's set() does notify every subscriber: all " + cnt(R.pickStore.selectors) + " selectors run, a function call and an Object.is each. Underneath, useSyncExternalStore re-renders a component only when the value its selector returns differs from the last one, and s.selectedId === id changes for exactly two cards. With the selection in a context, all " + CARDS + " cards read the same value, so all " + CARDS + " render: React has no built-in way to subscribe to part of a context. Work per pick: " + ms(R.pickSplit.work) + " → " + ms(R.pickStore.work) + ". Props can get the same two cards (selected={selectedId === item.id} on a memoized card), but the list has to render and compare all " + CARDS + " cards' props to find them.",
      "El set() de un store sí avisa a cada suscriptor: corren los " + cnt(R.pickStore.selectors) + " selectores, una llamada a función y un Object.is cada uno. Por debajo, useSyncExternalStore vuelve a renderizar un componente solo cuando el valor que devuelve su selector difiere del anterior, y s.selectedId === id cambia en exactamente dos tarjetas. Con la selección en un contexto, las " + CARDS + " tarjetas leen el mismo valor, así que se renderizan las " + CARDS + ": React no trae una forma de suscribirse a una parte de un contexto. Trabajo por elección: " + ms(R.pickSplit.work) + " → " + ms(R.pickStore.work) + ". Con props se pueden lograr las mismas dos tarjetas (selected={selectedId === item.id} en una tarjeta con memo), pero la lista tiene que renderizarse y comparar las props de las " + CARDS + " tarjetas para encontrarlas.",
    ),
    watch: { source: "store", memo: "off", input: "pick" },
  },
  {
    id: "memo",
    title: t("React.memo with inline props", "React.memo con props inline"),
    change: t("State moved down, as in experiment 2 · React.memo on ResultList and ResultCard · SearchPanel renders <ResultList onAdd={(id) => addToCart(id)} /> and the list gives each card onSelect={() => select(item.id)} · type one key",
      "Estado más abajo, como en el experimento 2 · React.memo en ResultList y ResultCard · SearchPanel renderiza <ResultList onAdd={(id) => addToCart(id)} /> y la lista le da a cada tarjeta onSelect={() => select(item.id)} · teclea una vez"),
    question: t("How many components render on a keystroke now?", "¿Cuántos componentes se renderizan ahora en una pulsación?"),
    options: [
      t("Three: SearchPanel, SearchInput and Suggestions; memo skips the list", "Tres: SearchPanel, SearchInput y Suggestions; memo se salta la lista"),
      t("The same " + cnt(R.down.rendered) + " as without memo, plus a props comparison for each memoized component", "Los mismos " + cnt(R.down.rendered) + " que sin memo, más una comparación de props por cada componente con memo"),
      t("Fewer: memo skips the cards whose props didn't change", "Menos: memo se salta las tarjetas cuyas props no cambiaron"),
    ],
    answer: 1,
    why: t(
      "React.memo compares each prop with Object.is, and an arrow function written in a render is a new function every time. ResultList's onAdd never matches, so the list renders, and the arrows it writes for each card defeat every card's memo the same way: " + cnt(R.memoInline.rendered) + " renders, as without memo. The memo wasn't free either: " + cnt(R.memoInline.compares) + " comparisons, " + us(R.memoInline.work - R.down.work) + " more per keystroke, for nothing. Keep the callbacks stable (useCallback, or give each card its id and one shared handler) and the list's props match: " + cnt(R.memoStable.rendered) + " renders, " + ms(R.memoStable.work) + ". Memo pays only where a component costs more to render than to compare and its parent often renders it with equal props; one inline object or function anywhere in its props undoes it, silently. React Compiler (1.0 since October 2025) does this memoization for you at build time: it caches the elements, callbacks and objects a component creates, so children whose inputs didn't change are skipped without React.memo or useCallback. It can't stop a context: every component that reads a context whose value changed still renders (experiment 3).",
      "React.memo compara cada prop con Object.is, y una función flecha escrita en un render es una función nueva cada vez. El onAdd de ResultList nunca coincide, así que la lista se renderiza, y las flechas que escribe para cada tarjeta anulan el memo de cada tarjeta de la misma forma: " + cnt(R.memoInline.rendered) + " renders, como sin memo. El memo tampoco salió gratis: " + cnt(R.memoInline.compares) + " comparaciones, " + us(R.memoInline.work - R.down.work) + " más por pulsación, para nada. Mantén estables los callbacks (useCallback, o dale a cada tarjeta su id y un solo handler compartido) y las props de la lista coinciden: " + cnt(R.memoStable.rendered) + " renders, " + ms(R.memoStable.work) + ". Memo rinde solo donde un componente cuesta más renderizarlo que comparar sus props y su padre lo renderiza seguido con props iguales; un solo objeto o función inline en sus props lo anula, sin aviso. React Compiler (1.0 desde octubre de 2025) hace esta memoización por ti al compilar: guarda los elementos, callbacks y objetos que crea un componente, así que los hijos cuyas entradas no cambiaron se saltan sin React.memo ni useCallback. No puede frenar un contexto: todo componente que lee un contexto cuyo valor cambió se sigue renderizando (experimento 3).",
    ),
    watch: { source: "down", memo: "inline", input: "key" },
  },
];

const QUESTIONS = [
  [t("A profiler shows " + N + " components rendering on every keystroke, but only one or two DOM changes. Is that a problem, and how do you find out?",
     "Un profiler muestra " + N + " componentes renderizándose en cada pulsación, pero solo uno o dos cambios en el DOM. ¿Es un problema y cómo lo averiguas?"),
   t("Rendering is calling the components and comparing their output; React commits only the differences, so the DOM isn't the issue. The render work is: it runs on the main thread for every keystroke, and when it nears a frame (" + ms(FRAME) + " at 60 Hz), typing starts to drop frames and interaction latency (INP) grows. Measure first: the React DevTools Profiler shows which components rendered, why, and how long each took. Debouncing the input (lesson 31) doesn't help here, because the input must show every keystroke; cut the cascade instead, and if some work is still long, split it (lessons 16 and 51; lesson 51, Frame budget, shows how INP is measured).",
     "Renderizar es llamar a los componentes y comparar su salida; React aplica solo las diferencias, así que el DOM no es el problema. El trabajo de render sí: corre en el hilo principal en cada pulsación, y cuando se acerca a un cuadro (" + ms(FRAME) + " a 60 Hz), escribir empieza a perder cuadros y la latencia de interacción (INP) crece. Mide primero: el Profiler de React DevTools muestra qué componentes se renderizaron, por qué y cuánto tardó cada uno. Aplicar debounce al input (lección 31) no ayuda aquí, porque el input tiene que mostrar cada pulsación; corta la cascada, y si algún trabajo sigue siendo largo, divídelo (lecciones 16 y 51; la lección 51, Presupuesto de cuadro, muestra cómo se mide el INP).")],
  [t("Name the reasons a component renders. Why isn't \"its props changed\" one of them?",
     "Nombra las razones por las que un componente se renderiza. ¿Por qué \"cambiaron sus props\" no es una de ellas?"),
   t("Its own state changed (useState, useReducer); the component that created its element rendered; a context it reads got a new value; or an external store it subscribes to (useSyncExternalStore) returned a different value. Props only change because the parent rendered, and once the parent renders, the child renders whether its props changed or not, unless it is wrapped in React.memo and every prop is equal.",
     "Cambió su propio estado (useState, useReducer); se renderizó el componente que creó su elemento; un contexto que lee recibió un valor nuevo; o un store externo al que está suscrito (useSyncExternalStore) devolvió un valor distinto. Las props solo cambian porque el padre se renderizó, y una vez que el padre se renderiza, el hijo se renderiza hayan cambiado sus props o no, salvo que esté envuelto en React.memo y todas sus props sean iguales.")],
  [t("How far down can you move a piece of state, and what do you do when that is still too high?",
     "¿Hasta dónde puedes bajar un estado y qué haces cuando eso sigue siendo demasiado arriba?"),
   t("To the closest component that contains everything that reads or sets it. If that is still near the top, restructure: pull the part that changes into a component of its own, or pass the expensive part in as children. Elements created by a component that didn't render are the same objects as last time, and React skips them; that is why a provider that holds state and renders {children} doesn't re-render the whole tree.",
     "Hasta el componente más cercano que contiene todo lo que lo lee o lo cambia. Si eso sigue cerca de la raíz, reestructura: saca la parte que cambia a un componente propio, o pasa la parte costosa como children. Los elementos creados por un componente que no se renderizó son los mismos objetos que la vez anterior, y React se los salta; por eso un proveedor que guarda estado y renderiza {children} no vuelve a renderizar todo el árbol.")],
  [t("Why doesn't React.memo stop a context update, and how do you fix one big context?",
     "¿Por qué React.memo no frena una actualización de contexto y cómo arreglas un contexto grande?"),
   t("Memo only compares the props a parent passes; a component that calls useContext renders whenever the context's value changes (Object.is), whatever its props. Fixes: build the value with useMemo, so a provider that renders for another reason doesn't hand out a new object; split the context by what changes together; put the setters in a context of their own, so components that only write don't render on every change; or move state that changes often into a store with selectors.",
     "Memo solo compara las props que pasa el padre; un componente que llama a useContext se renderiza cada vez que cambia el valor del contexto (Object.is), sean cuales sean sus props. Soluciones: arma el valor con useMemo, para que un proveedor que se renderiza por otro motivo no entregue un objeto nuevo; separa el contexto por lo que cambia junto; pon los setters en un contexto propio, para que los componentes que solo escriben no se rendericen con cada cambio; o mueve el estado que cambia seguido a un store con selectores.")],
  [t("In Zustand, how does useStore(selector) decide whether to re-render, and what goes wrong with useStore((s) => ({ a: s.a, b: s.b }))?",
     "En Zustand, ¿cómo decide useStore(selector) si volver a renderizar, y qué falla con useStore((s) => ({ a: s.a, b: s.b }))?"),
   t("Every set() calls every subscriber. React's useSyncExternalStore then runs the component's selector on the new state and compares the result with the last one using Object.is; only a different result schedules a render. A selector that builds a new object never returns the same value twice. In Zustand v4 that meant a render on every store update, whatever changed; v5 hands the selector straight to useSyncExternalStore, which expects the same value while the store hasn't changed, so it can loop until React throws \"Maximum update depth exceeded\". Select the fields one by one, or wrap the selector in useShallow, which compares the object field by field.",
     "Cada set() llama a cada suscriptor. Después, useSyncExternalStore de React corre el selector del componente sobre el estado nuevo y compara el resultado con el anterior usando Object.is; solo un resultado distinto programa un render. Un selector que arma un objeto nuevo nunca devuelve el mismo valor dos veces. En Zustand v4 eso significaba un render en cada actualización del store, cambiara lo que cambiara; v5 le pasa el selector directo a useSyncExternalStore, que espera el mismo valor mientras el store no cambió, así que puede entrar en un bucle hasta que React lanza \"Maximum update depth exceeded\". Selecciona los campos uno por uno, o envuelve el selector en useShallow, que compara el objeto campo por campo.")],
  [t("When is React.memo worth it, and what does it cost?", "¿Cuándo vale la pena React.memo y cuánto cuesta?"),
   t("When the component is expensive to render, its parent renders often, and its props are usually equal: the comparison is cheap next to the render it skips. It costs a props comparison on every parent render, keeps the last props in memory, and asks every caller to keep the props stable (useCallback, useMemo, no inline objects or arrows), which is easy to break without noticing. Check in the Profiler that it really skips renders, and try moving state down or passing children first: they need no comparison at all. With React Compiler, the compiler memoizes components and the values they pass for you, so hand-written memo, useMemo and useCallback are rarely needed; it doesn't change how context works, so splitting a context or using a store with selectors still matters.",
     "Cuando el componente es costoso de renderizar, su padre se renderiza seguido y sus props suelen ser iguales: la comparación es barata al lado del render que se ahorra. Cuesta una comparación de props en cada render del padre, guarda en memoria las últimas props y exige que cada quien que lo use mantenga estables las props (useCallback, useMemo, sin objetos ni flechas inline), algo fácil de romper sin darse cuenta. Comprueba en el Profiler que de verdad se salta renders, y prueba antes bajar el estado o pasar children: no necesitan ninguna comparación. Con React Compiler, el compilador memoiza los componentes y los valores que pasan por ti, así que pocas veces hace falta escribir memo, useMemo y useCallback a mano; no cambia cómo funciona el contexto, así que separar un contexto o usar un store con selectores sigue importando.")],
];

export default defineLesson({
  title: t("Re-render Workbench", "Banco de trabajo: re-renders"),
  eyebrow: t("Systems lesson 54 · Re-render cascades", "Lección de sistemas 54 · Cascadas de re-renders"),
  lede: t("When state changes in React, the component that holds it renders again, and by default so does everything it renders, all the way down. With the state high in the tree, or in one big context, a single keystroke renders dozens of components that read nothing that changed. This lesson lays a shop page out as a board of components: watch the cascade, predict which fix stops it, then explain it back.",
    "Cuando cambia el estado en React, el componente que lo tiene se vuelve a renderizar, y por defecto también todo lo que renderiza, hasta abajo. Con el estado arriba en el árbol, o en un solo contexto grande, una sola pulsación renderiza decenas de componentes que no leen nada de lo que cambió. Esta lección despliega la página de una tienda como un tablero de componentes: mira la cascada, predice qué la detiene y después explícalo."),
  machine: {
    intro: t("The board is the page's component tree: App at the back, each row of children nearer the front, down to " + CARDS + " result cards. A block lights when its component renders, and the light runs down the wires to everything it renders. The page lying at the front is the DOM: only what changed flashes there. Choose where the state lives, switch React.memo on, and watch what a keystroke, a pick or an item added to the cart costs.",
      "El tablero es el árbol de componentes de la página: App al fondo, cada fila de hijos más adelante, hasta " + CARDS + " tarjetas de resultados. Un bloque se ilumina cuando su componente se renderiza, y la luz baja por los cables hasta todo lo que renderiza. La página que está adelante es el DOM: ahí solo destella lo que cambió. Elige dónde vive el estado, activa React.memo y mira cuánto cuesta una pulsación, una elección o un producto agregado al carrito. Los nombres de los productos están en inglés, como en el modelo."),
    plate: {
      title: t("Component board", "Tablero de componentes"),
      keys: [
        { mark: "lit", label: t("A component rendering; a memo gate skipping one; on the page, a DOM change", "Un componente renderizándose; una compuerta de memo que se salta uno; en la página, un cambio en el DOM") },
        { mark: "raised", label: t("Components: blocks, and studs on trays for the ones that come many at a time", "Componentes: bloques, y pernos en bandejas para los que vienen en grupo") },
        { mark: "flat", label: t("Wires from each component to the ones it renders; the page (the DOM)", "Cables de cada componente a los que renderiza; la página (el DOM)") },
      ],
      caption: t(
        "STATE plaques lie on the components that hold state, or on the store when a store holds it (that one lights when the store changes). Gates on the wires to Header, Sidebar, ResultList, the cards and Footer are React.memo: a gate that lifts let a render through because a prop differed; one that stays down and lights skipped it because every prop was equal. The console counts the renders and DOM changes of the last update; its meter shows that update's work, with the zone starting at one frame at 60 Hz (" + ms(FRAME) + "). The store's counter shows how many selectors the last update ran. Render costs are the model's: " + LINK_US + " µs for a link, " + CARD_US + " µs for a card, " + CHART_MS + " ms for PriceChart.",
        "Las placas ESTADO están sobre los componentes que guardan estado, o sobre el store cuando lo guarda un store (esa se ilumina cuando el store cambia). Las compuertas en los cables hacia Header, Sidebar, ResultList, las tarjetas y Footer son React.memo: una compuerta que se levanta dejó pasar un render porque una prop era distinta; una que se queda baja y se ilumina se lo saltó porque todas las props eran iguales. La consola cuenta los renders y los cambios en el DOM de la última actualización; su medidor muestra el trabajo de esa actualización, con la zona que empieza en un cuadro (frame) a 60 Hz (" + ms(FRAME) + "). El contador del store muestra cuántos selectores corrió la última actualización. Los costos de render son los del modelo: " + LINK_US + " µs por enlace, " + CARD_US + " µs por tarjeta, " + CHART_MS + " ms para PriceChart.",
      ),
      stage: { "data-board": "" },
      label: t("Re-render simulation. Space pauses or resumes.", "Simulación de re-renders. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["renders", t("Renders", "Renders"), "–"],
      ["dom", t("DOM changes", "Cambios DOM"), "–"],
      ["wasted", t("Changed nothing", "No cambiaron nada"), "–"],
      ["compares", t("Memo compares", "Comparaciones memo"), "–"],
      ["selectors", t("Selectors run", "Selectores ejecutados"), "–"],
      ["work", t("Work", "Trabajo"), "–"],
    ],
    controls: [
      { seg: "source", label: t("State", "Estado"), options: [["top", t("useState in App", "useState en App")], ["down", t("Moved down", "Más abajo")], ["context", t("One context", "Un contexto")], ["split", t("Split contexts", "Contextos separados")], ["store", t("Store + selectors", "Store + selectores")]], value: "top" },
      { seg: "memo", label: "React.memo", options: [["off", t("Off", "Apagado")], ["stable", t("Stable props", "Props estables")], ["inline", t("Inline props", "Props inline")]], value: "off" },
      { seg: "input", label: t("The user keeps", "El usuario sigue"), options: [["key", t("Typing", "Escribiendo")], ["pick", t("Picking cards", "Eligiendo tarjetas")], ["cart", t("Adding to cart", "Agregando al carrito")]], value: "key" },
      { speed: true },
      { actions: [["key", t("Type a key", "Teclear")], ["pick", t("Pick a card", "Elegir tarjeta")], ["cart", t("Add to cart", "Al carrito")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t(
      "Changing a setting starts over. The stats are for the last update. Inline props are callbacks written as arrow functions in the render, a new function every time; stable props keep the same function (useCallback).",
      "Cambiar un ajuste empieza de nuevo. Las estadísticas son de la última actualización. Las props inline son callbacks escritos como funciones flecha dentro del render, una función nueva cada vez; las props estables mantienen la misma función (useCallback).",
    ),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs of " + COUNT + " interactions each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija de " + COUNT + " interacciones cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: it applies React's rules for when a component renders, and its render costs are illustrative. The other frontend lessons are 31, 32, 51–53 and 55–58; lesson 51 covers the frame budget and the INP this render work eats into.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección: aplica las reglas de React sobre cuándo se renderiza un componente, y sus costos de render son ilustrativos. Las otras lecciones de frontend son la 31, la 32, de la 51 a la 53 y de la 55 a la 58; la lección 51 trata el presupuesto de cuadro y el INP que consume este trabajo de render.`),
  css: LIT_FILL_CSS + `
.rr-edge{fill:none;stroke:var(--anatomy-lo);stroke-width:1;stroke-linejoin:round}
.rr-edge[data-on]{stroke:var(--anatomy-lit);stroke-width:2}
.rr-dom{fill:none;stroke:var(--anatomy-lo);stroke-width:.6}
.rr-dom.rr-static{stroke:var(--anatomy-faint)}
.rr-dom[data-on]{fill:color-mix(in srgb,var(--anatomy-lit) 28%,transparent);stroke:var(--anatomy-lit);stroke-width:1.6}
.rr-dom[data-sel]{fill:var(--anatomy-mid)}
`,
  data: { P, G: GEOMETRY },
});
