// @ts-nocheck: content ported as-is
// Systems lesson 07 · Consistent hashing: a sorting carousel for a hash ring and hash mod n.
import { t } from "../../i18n";
import { defineLesson } from "../types";
import { buildFigure, cardSvg, P, GEOMETRY } from "./figure";
import { moduloRun, ringRun, balanceRun, failRun, hotRun } from "./sim";

// Experiment results, computed at build time from the same model the page runs (the standalone page computed them in
// the browser; they're deterministic, so the numbers are the same).
const RESULTS = { modulo: moduloRun(), ring: ringRun(), balance: balanceRun(), fail: failRun(), hot: hotRun() };

const EXPERIMENTS = [
  {
    id: "modulo",
    title: t("Add a node, modulo style", "Agregar un nodo, estilo módulo"),
    change: t("bin = hash mod n · nodes 4 → 5", "cajón = hash mod n · nodos 4 → 5"),
    question: t("One node joins a cluster of four. What share of the 1,000 keys has to move to a different node?", "Un nodo se une a un clúster de cuatro. ¿Qué parte de las 1,000 claves tiene que moverse a otro nodo?"),
    options: [
      t("About a fifth: the new node takes its fair share", "Más o menos una quinta parte: el nodo nuevo se lleva su parte justa"),
      t("About half", "Más o menos la mitad"),
      t("About four in five", "Más o menos cuatro de cada cinco"),
    ],
    answer: 2,
    why: t(
      "A key stays put only if hash mod 4 and hash mod 5 happen to agree, and that is true for just 4 numbers in every 20. Everything else is reshuffled, between every pair of nodes, not just toward the new one. On a cache cluster that means four in five reads suddenly miss.",
      "Una clave se queda donde está solo si hash mod 4 y hash mod 5 coinciden por casualidad, y eso pasa solo con 4 de cada 20 números. Todo lo demás se vuelve a repartir, entre cada par de nodos, no solo hacia el nuevo. En un clúster de caché, eso significa que de pronto cuatro de cada cinco lecturas fallan (miss).",
    ),
    watch: { mode: "modulo", count: 4, vnodes: 1, then: { count: 5 } },
  },
  {
    id: "ring",
    title: t("Add a node, on a ring", "Agregar un nodo, en un anillo"),
    change: t("Hash ring, 1 marker per node · nodes 4 → 5", "Anillo de hash, 1 marcador por nodo · nodos 4 → 5"),
    question: t("Same change, but keys go to the next marker clockwise. Which keys move?", "El mismo cambio, pero las claves van al siguiente marcador en sentido horario. ¿Qué claves se mueven?"),
    options: [
      t("About a fifth, all of them taken from one neighbour", "Más o menos una quinta parte, todas tomadas de un solo vecino"),
      t("About a fifth, taken evenly from all four nodes", "Más o menos una quinta parte, tomadas por igual de los cuatro nodos"),
      t("About four in five, the same as modulo", "Más o menos cuatro de cada cinco, igual que con módulo"),
    ],
    answer: 0,
    why: t(
      "The new node's marker lands somewhere on the ring and claims only the arc just before it. Those keys used to slide on to the next marker clockwise, so they all come from that one neighbour. Every other key still reaches the same marker as before.",
      "El marcador del nodo nuevo cae en algún punto del anillo y reclama solo el arco justo antes de él. Esas claves antes seguían hasta el siguiente marcador en sentido horario, así que todas vienen de ese único vecino. Todas las demás claves siguen llegando al mismo marcador que antes.",
    ),
    watch: { mode: "ring", count: 4, vnodes: 1, then: { count: 5 } },
  },
  {
    id: "balance",
    title: t("Is the ring fair?", "¿El anillo es justo?"),
    change: t("Hash ring, 5 nodes · 1 marker per node", "Anillo de hash, 5 nodos · 1 marcador por nodo"),
    question: t(
      "Five nodes, one marker each, placed by hashing. How much does the busiest node get compared with a fair fifth?",
      "Cinco nodos, un marcador cada uno, colocados con hashing. ¿Cuánto recibe el nodo más ocupado comparado con una quinta parte justa?",
    ),
    options: [
      t("About the same: hashing spreads things evenly", "Más o menos lo mismo: el hashing reparte todo de forma pareja"),
      t("About twice its fair share", "Más o menos el doble de su parte justa"),
      t("Nearly all the keys", "Casi todas las claves"),
    ],
    answer: 1,
    why: t(
      "Five random points cut the ring into five arcs of very different lengths, and each node owns one arc. Give every node many markers (virtual nodes) and each node owns many small arcs, which average out: with 100 markers the busiest node is close to fair.",
      "Cinco puntos al azar cortan el anillo en cinco arcos de largos muy distintos, y cada nodo es dueño de un arco. Dale a cada nodo muchos marcadores (nodos virtuales, virtual nodes) y cada nodo es dueño de muchos arcos pequeños, que se compensan: con 100 marcadores el nodo más ocupado queda cerca de lo justo.",
    ),
    watch: { mode: "ring", count: 5, vnodes: 1, then: { vnodes: 100 } },
  },
  {
    id: "fail",
    title: t("A node fails", "Un nodo falla"),
    change: t("Hash ring, 5 nodes, 1 marker per node · node C fails", "Anillo de hash, 5 nodos, 1 marcador por nodo · el nodo C falla"),
    question: t("C's keys must go somewhere. Where do they go?", "Las claves de C tienen que ir a algún lado. ¿A dónde van?"),
    options: [
      t("Spread evenly over the four survivors", "Se reparten por igual entre los cuatro sobrevivientes"),
      t("All to the next node clockwise", "Todas al siguiente nodo en sentido horario"),
      t("Nowhere: they are lost until C comes back", "A ningún lado: se pierden hasta que C vuelva"),
    ],
    answer: 1,
    why: t(
      "With one marker per node, C's whole arc now slides on to the next marker, so one neighbour takes all of C's work on top of its own, often the moment it can least afford it. With many markers C's arcs are scattered round the ring and their next markers belong to different nodes, so the work spreads over everyone.",
      "Con un marcador por nodo, todo el arco de C pasa al siguiente marcador, así que un solo vecino se lleva todo el trabajo de C además del suyo, a menudo justo cuando menos puede con él. Con muchos marcadores, los arcos de C están dispersos por el anillo y sus siguientes marcadores pertenecen a nodos distintos, así que el trabajo se reparte entre todos.",
    ),
    watch: { mode: "ring", count: 5, vnodes: 1, then: { failed: true } },
  },
  {
    id: "hot",
    title: t("One very popular key", "Una clave muy popular"),
    change: t("Hash ring, 100 markers per node · key 7 gets 30% of all requests", "Anillo de hash, 100 marcadores por nodo · la clave 7 recibe el 30% de todas las solicitudes"),
    question: t("Does consistent hashing spread a hot key's traffic?", "¿El hashing consistente reparte el tráfico de una clave caliente (hot key)?"),
    options: [
      t("Yes: its requests are spread around the ring", "Sí: sus solicitudes se reparten por el anillo"),
      t("No: one node serves all of that key, and adding nodes barely helps", "No: un solo nodo atiende toda esa clave, y agregar nodos casi no ayuda"),
      t("Yes, as long as you add enough nodes", "Sí, siempre que agregues suficientes nodos"),
    ],
    answer: 1,
    why: t(
      "Consistent hashing decides where each key lives, and a key lives on one node. The node that owns key 7 carries 30% of the traffic plus its own share of the rest, however many nodes you add. Hot keys need a different tool: replicate that key to several nodes, cache it closer to the callers, or split it into sub-keys.",
      "El hashing consistente decide dónde vive cada clave, y una clave vive en un solo nodo. El nodo dueño de la clave 7 carga el 30% del tráfico más su propia parte del resto, sin importar cuántos nodos agregues. Las claves calientes necesitan otra herramienta: replicar esa clave en varios nodos, cachearla más cerca de quienes la llaman o dividirla en subclaves.",
    ),
    watch: { mode: "ring", count: 3, vnodes: 100, hot: true, then: { count: 6 } },
  },
];

const QUESTIONS = [
  [t("Why does hash mod n move almost every key when n changes by one?",
     "¿Por qué hash mod n mueve casi todas las claves cuando n cambia en uno?"),
   t("A key keeps its node only when hash mod n and hash mod (n + 1) agree, which happens for about 1 in n + 1 keys. So going from 4 to 5 nodes keeps about 1 in 5 and moves the other 80%, between all pairs of nodes, not just onto the new one.",
     "Una clave conserva su nodo solo cuando hash mod n y hash mod (n + 1) coinciden, lo que pasa con más o menos 1 de cada n + 1 claves. Así que pasar de 4 a 5 nodos conserva más o menos 1 de cada 5 y mueve el otro 80%, entre todos los pares de nodos, no solo hacia el nuevo.")],
  [t("On a ring, exactly which keys move when a node is added, and where do they come from?",
     "En un anillo, ¿exactamente qué claves se mueven cuando se agrega un nodo y de dónde vienen?"),
   t("Only the keys in the arc between the new marker and the previous marker counter-clockwise. They used to slide on to the next marker clockwise, so they all come from that node. Every other key reaches the same marker as before.",
     "Solo las claves del arco entre el marcador nuevo y el marcador anterior en sentido antihorario. Antes seguían hasta el siguiente marcador en sentido horario, así que todas vienen de ese nodo. Todas las demás claves llegan al mismo marcador que antes.")],
  [t("What problem do virtual nodes solve? Name two.",
     "¿Qué problemas resuelven los nodos virtuales (virtual nodes)? Nombra dos."),
   t("Balance: a few random markers cut the ring into very uneven arcs (the busiest node had about 2.3× its fair share with one marker); many markers per node average out. Failure: with one marker a dead node's whole arc lands on one neighbour; with many, its arcs spread over all survivors. They also let a bigger machine take more markers.",
     "Equilibrio: unos pocos marcadores al azar cortan el anillo en arcos muy desiguales (con un marcador, el nodo más ocupado tenía unas 2.3× su parte justa); muchos marcadores por nodo se compensan. Fallas: con un marcador, todo el arco de un nodo caído va a parar a un solo vecino; con muchos, sus arcos se reparten entre todos los sobrevivientes. También permiten que una máquina más grande tome más marcadores.")],
  [t("You run a cache cluster in front of a database and add a node. Compare modulo and a ring.",
     "Tienes un clúster de caché delante de una base de datos y agregas un nodo. Compara módulo y un anillo."),
   t("With modulo about 80% of keys now map to a different node, so 80% of reads miss at once and hit the database: the same stampede as emptying the cache. With a ring only about 1 in n + 1 keys move, so the miss spike is small and lands on the keys of one neighbour.",
     "Con módulo, cerca del 80% de las claves pasan a otro nodo, así que el 80% de las lecturas fallan de golpe y van a la base de datos: la misma estampida que vaciar la caché. Con un anillo solo se mueve más o menos 1 de cada n + 1 claves, así que el pico de fallos es pequeño y cae sobre las claves de un solo vecino.")],
  [t("One key gets 30% of all requests and its node is overloaded. What would you do?",
     "Una clave recibe el 30% de todas las solicitudes y su nodo está sobrecargado. ¿Qué harías?"),
   t("Consistent hashing won't help: a key lives on one node. Replicate the hot key to several nodes and read from any of them, cache it closer to the callers (in-process), or split it into sub-keys (key#1…key#n) and combine the results. Also find out why one key is that hot.",
     "El hashing consistente no va a ayudar: una clave vive en un solo nodo. Replica la clave caliente en varios nodos y lee de cualquiera de ellos, cachéala más cerca de quienes la llaman (en el mismo proceso) o divídela en subclaves (key#1…key#n) y combina los resultados. Averigua también por qué una clave está tan caliente.")],
  [t("Where have you met consistent hashing in real systems?",
     "¿Dónde te has encontrado con el hashing consistente en sistemas reales?"),
   t("Memcached and Redis client-side sharding, Cassandra and DynamoDB partitioning, load balancers that keep a user on the same backend (Envoy ring hash, Maglev), and CDNs choosing which edge server holds an object. A good answer also notes that moving a key means moving its data, which is why moving fewer keys matters.",
     "En el sharding del lado del cliente de Memcached y Redis, el particionado de Cassandra y DynamoDB, los balanceadores de carga que mantienen a un usuario en el mismo backend (ring hash de Envoy, Maglev) y las CDN que eligen qué servidor de borde guarda un objeto. Una buena respuesta también señala que mover una clave significa mover sus datos; por eso importa mover menos claves.")],
];

export default defineLesson({
  title: t("Hash Ring Workbench", "Banco de trabajo: anillo de hash"),
  eyebrow: t("Systems lesson 07 · Consistent hashing", "Lección de sistemas 07 · Hashing consistente"),
  lede: t("When data is split across nodes, every key needs a home, and adding or losing a node should move as few keys as possible. This lesson compares two ways of choosing the home, hash mod n and a hash ring, three ways: watch a machine do it, predict what each change does, then explain it back.",
    "Cuando los datos se reparten entre nodos, cada clave necesita un hogar, y agregar o perder un nodo debería mover la menor cantidad posible de claves. Esta lección compara dos formas de elegir ese hogar, hash mod n y un anillo de hash (hash ring), de tres maneras: mira cómo lo hace una máquina, predice qué hace cada cambio y después explícalo."),
  machine: {
    intro: t("The turntable is the hash ring and the bins along the front are the nodes. Watch a few cards find their bin, then add a node, switch to hash mod n and add it again, and compare how many cards fly.",
      "La plataforma giratoria es el anillo de hash y los cajones del frente son los nodos. Mira cómo algunas tarjetas encuentran su cajón; luego agrega un nodo, cambia a hash mod n, agrégalo otra vez y compara cuántas tarjetas vuelan."),
    plate: {
      title: t("Sorting carousel", "Carrusel clasificador"),
      keys: [
        { mark: "lit", label: t("The card in play, and cards that move", "La tarjeta en juego y las tarjetas que se mueven") },
        { mark: "raised", label: t("Turntable: the hash ring, 0–360°", "Plataforma giratoria: el anillo de hash, 0–360°") },
        { mark: "flat", label: t("Bins A–F, left to right: stack height is each node's share", "Cajones A–F, de izquierda a derecha: la altura de la pila es la parte de cada nodo") },
      ],
      caption: t(
        "Each card is one of 1,000 keys. In ring mode it lands at its hash angle, slides clockwise to the next marker peg and goes to that peg's bin. Flip the lever to modulo and the drum picks bin number hash mod n instead. Change the cluster and only the cards that must move fly to their new bin.",
        "Cada tarjeta es una de 1,000 claves. En modo anillo cae en su ángulo de hash, se desliza en sentido horario hasta la siguiente clavija marcadora y va al cajón de esa clavija. Mueve la palanca a módulo y el tambor elige en su lugar el cajón número hash mod n. Cambia el clúster y solo las tarjetas que deben moverse vuelan a su nuevo cajón.",
      ),
      stage: { "data-office": "" },
      label: t("Sorting carousel simulation. Space pauses or resumes.", "Simulación del carrusel clasificador. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["nodes", t("Nodes", "Nodos"), "4"], ["moved", t("Moved, last change", "Movidas, último cambio"), "–"], ["ratio", t("Busiest ÷ fair", "Más ocupado ÷ justo"), "–"], ["busiest", t("Busiest node", "Nodo más ocupado"), "–"], ["quietest", t("Quietest node", "Nodo menos ocupado"), "–"], ["sorted", t("Cards sorted", "Tarjetas clasificadas")]],
    controls: [
      { seg: "mode", label: t("Sorting", "Clasificación"), options: [["ring", t("Hash ring", "Anillo de hash")], ["modulo", "hash mod n"]], value: "ring" },
      { seg: "count", label: t("Nodes", "Nodos"), options: [[3, "3"], [4, "4"], [5, "5"], [6, "6"]], value: 4 },
      { seg: "vnodes", label: t("Markers per node", "Marcadores por nodo"), options: [[1, "1"], [10, "10"], [100, "100"]], value: 1 },
      { seg: "failed", label: t("Node C", "Nodo C"), options: [["false", t("Up", "Activo")], ["true", t("Failed", "Caído")]], value: "false" },
      { seg: "hot", label: t("Hot key (30% of traffic)", "Clave caliente (30% del tráfico)"), options: [["false", t("Off", "No")], ["true", t("On", "Sí")]], value: "false" },
      { speed: true },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results use the machine's own model with 1,000 keys; ring results are averaged over 200 clusters, because they depend on where the markers happen to land.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados usan el mismo modelo de la máquina con 1,000 claves; los del anillo se promedian sobre 200 clústeres, porque dependen de dónde caen los marcadores."), experiments: EXPERIMENTS },
  explain: { questions: QUESTIONS },
  data: {
    P,
    G: GEOMETRY,
    CARD_SVG: cardSvg(),
    RESULTS,
    EXPERIMENTS: EXPERIMENTS.map(({ id, answer, watch }) => ({ id, answer, watch })),
  },
});
