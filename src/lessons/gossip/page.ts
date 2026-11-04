// @ts-nocheck: content ported as-is
// Systems lesson 19 · Gossip protocols: a village passing a rumour, and house 0's copy of the membership table.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { buildFigure, P, GEOMETRY } from "./figure";
import { spreadRun, spreadAverage, detectionAverage } from "./sim";
import { one, n0, pct } from "../../lib/format";

const EXPERIMENTS = [
  {
    id: "size",
    title: t("Ten times the village", "Diez veces el pueblo"),
    change: t("40 houses → 400 houses · push, each house tells 2 random houses per round · the machine shows 40; the 400 result is computed", "40 casas → 400 casas · push, cada casa avisa a 2 casas al azar por ronda · la máquina muestra 40; el resultado con 400 se calcula"),
    question: t("How many rounds until every house has heard the rumour?", "¿Cuántas rondas hasta que todas las casas hayan oído el rumor?"),
    options: [t("About ten times as many rounds", "Unas diez veces más rondas"), t("A few more rounds", "Unas pocas rondas más"), t("Exactly the same number of rounds", "Exactamente el mismo número de rondas")],
    answer: 1,
    why: t("The number of houses that know roughly triples every round (each tells two more), so covering ten times the houses only takes the few extra rounds it needs to triple a couple more times. Spreading time grows with the logarithm of the size: that is why gossip scales to thousands of nodes.", "La cantidad de casas que lo saben se triplica más o menos cada ronda (cada una avisa a dos más), así que cubrir diez veces más casas solo cuesta las pocas rondas extra que hacen falta para triplicar un par de veces más. El tiempo de propagación crece con el logaritmo del tamaño: por eso gossip escala a miles de nodos."),
    watch: { houses: 40, fanout: 2, mode: "push", loss: 0, timeout: 8, slow: 0 },
  },
  {
    id: "fanout",
    title: t("Tell more neighbours", "Avisa a más vecinos"),
    change: t("Fanout 1 → 3 · push, 40 houses", "Fanout 1 → 3 · push, 40 casas"),
    question: t("Each house now tells 3 random houses per round instead of 1. What happens?", "Ahora cada casa avisa a 3 casas al azar por ronda en vez de 1. ¿Qué pasa?"),
    options: [t("About three times faster, for the same total messages", "Unas tres veces más rápido, con los mismos mensajes en total"), t("Fewer rounds, but more messages in total", "Menos rondas, pero más mensajes en total"), t("Same rounds, three times the messages", "Las mismas rondas, el triple de mensajes")],
    answer: 1,
    why: t("With a bigger fanout the rumour reaches everyone in about half the rounds, but every informed house sends three messages a round, and many of them land on houses that already know. You trade bandwidth for speed. Per round the traffic triples, but the rumour finishes in about half the rounds, so the total grows only about a fifth. Real systems keep fanout small (often 2 to 4) and run rounds frequently.", "Con un fanout (a cuántas casas avisa cada una) más grande, el rumor llega a todos en más o menos la mitad de las rondas, pero cada casa informada manda tres mensajes por ronda, y muchos caen en casas que ya lo saben. Cambias ancho de banda por velocidad. Por ronda el tráfico se triplica, pero el rumor termina en más o menos la mitad de las rondas, así que el total crece solo alrededor de una quinta parte. Los sistemas reales mantienen un fanout pequeño (a menudo de 2 a 4) y hacen rondas frecuentes."),
    watch: { houses: 40, fanout: 3, mode: "push", loss: 0, timeout: 8, slow: 0 },
  },
  {
    id: "mode",
    title: t("Push, pull or both", "Push, pull o ambos"),
    change: t("Push vs pull vs push-pull · fanout 1, 40 houses", "Push vs pull vs push-pull · fanout 1, 40 casas"),
    question: t("Once half the village knows, which way reaches the last houses fastest?", "Cuando ya lo sabe la mitad del pueblo, ¿qué forma llega más rápido a las últimas casas?"),
    options: [t("Push: the houses that know do the work", "Push: las casas que lo saben hacen el trabajo"), t("Pull or push-pull: the houses that don't know go and ask", "Pull o push-pull: las casas que no lo saben van a preguntar"), t("All three take the same time", "Las tres tardan lo mismo")],
    answer: 1,
    why: t("With push, the last few houses only hear it if some informed house happens to pick them, and most pushes land on houses that already know. With pull, every uninformed house asks someone each round, and once most houses know, almost every question gets an answer. Push-pull combines both and finishes first. It costs more messages than push, because everyone keeps asking, but fewer than pull, because it finishes sooner.", "Con push (empujar), las últimas casas solo se enteran si alguna casa informada justo las elige, y la mayoría de los envíos caen en casas que ya lo saben. Con pull (pedir), cada casa sin informar le pregunta a alguien en cada ronda, y cuando la mayoría ya lo sabe, casi todas las preguntas obtienen respuesta. Push-pull combina ambos y termina primero. Cuesta más mensajes que push, porque todos siguen preguntando, pero menos que pull, porque termina antes."),
    watch: { houses: 40, fanout: 1, mode: "push-pull", loss: 0, timeout: 8, slow: 0 },
  },
  {
    id: "loss",
    title: t("Lose a third of the messages", "Pierde un tercio de los mensajes"),
    change: t("Message loss 0% → 30% · push-pull, fanout 2, 40 houses", "Mensajes perdidos 0% → 30% · push-pull, fanout 2, 40 casas"),
    question: t("Three in ten messages vanish on the way. What happens to the rumour?", "Tres de cada diez mensajes desaparecen en el camino. ¿Qué pasa con el rumor?"),
    options: [t("About 30% of houses never hear it", "Cerca del 30% de las casas nunca lo oye"), t("Everyone still hears it, a round or two later", "Todos lo oyen igual, una o dos rondas más tarde"), t("It stops spreading after a few rounds", "Deja de propagarse después de unas rondas")],
    answer: 1,
    why: t("Nobody depends on one particular message: every house hears the rumour from many directions, and lost messages are simply replaced by later random ones. Losing 30% only costs a round or so. This redundancy is why gossip works over unreliable networks without acknowledgements or retries.", "Nadie depende de un mensaje en particular: cada casa oye el rumor desde muchas direcciones, y los mensajes perdidos simplemente se reemplazan por otros al azar más tarde. Perder el 30% cuesta más o menos una ronda. Por esta redundancia gossip funciona sobre redes poco confiables sin acks ni reintentos."),
    watch: { houses: 40, fanout: 2, mode: "push-pull", loss: 0.3, timeout: 8, slow: 0 },
  },
  {
    id: "timeout",
    title: t("How long before \"dead\"", "Cuánto esperar antes de \"muerta\""),
    change: t("Failure timeout 4 → 8 → 16 rounds · heartbeats gossiped with fanout 2, slow links (3 in 10 messages arrive 1–3 rounds late)", "Tiempo límite (timeout) de falla 4 → 8 → 16 rondas · heartbeats propagados con fanout 2, enlaces lentos (3 de cada 10 mensajes llegan 1–3 rondas tarde)"),
    question: t("What does a short timeout do?", "¿Qué hace un tiempo límite corto?"),
    options: [t("Detects real failures sooner with no downside", "Detecta fallas reales antes, sin desventajas"), t("Detects sooner, but healthy houses get declared dead", "Detecta antes, pero declara muertas a casas sanas"), t("Nothing: with gossip the timeout doesn't matter", "Nada: con gossip el tiempo límite no importa")],
    answer: 1,
    why: t("A house's heartbeat needs a few rounds to travel through the gossip, more when links are slow. If the timeout is shorter than that, a perfectly healthy house looks silent and gets declared dead. A long timeout never cries wolf but takes longer to notice a real failure. The timeout has to cover the normal spreading time (which grows with the village size) plus slow links.", "El heartbeat (latido) de una casa necesita unas rondas para viajar por el gossip, más si los enlaces son lentos. Si el tiempo límite es más corto que eso, una casa perfectamente sana parece en silencio y se declara muerta. Un tiempo límite largo nunca da falsas alarmas, pero tarda más en notar una falla real. El tiempo límite tiene que cubrir el tiempo normal de propagación (que crece con el tamaño del pueblo) más los enlaces lentos."),
    watch: { houses: 40, fanout: 2, mode: "push", loss: 0, timeout: 4, slow: 0.3 },
  },
];

const QUESTIONS = [
  [t("Why does gossip reach a 10,000-node cluster in only a few more rounds than a 100-node cluster?", "¿Por qué gossip llega a un clúster de 10,000 nodos en solo unas rondas más que a uno de 100?"),
    t("Each round, every node that knows tells a few others, so the number that know multiplies (roughly by fanout + 1) until most know. Multiplying gets from 100 to 10,000 in a couple more steps: spreading time grows with log N, not with N.", "En cada ronda, cada nodo que lo sabe se lo cuenta a unos pocos, así que la cantidad que lo sabe se multiplica (más o menos por fanout + 1) hasta que casi todos lo saben. Multiplicando se pasa de 100 a 10,000 en un par de pasos más: el tiempo de propagación crece con log N, no con N.")],
  [t("Gossip never retries a lost message. Why does it still reach everyone?", "Gossip nunca reintenta un mensaje perdido. ¿Por qué igual llega a todos?"),
    t("Every node hears the news from many random senders, so no single message matters; a lost one is replaced by the next random contact. Redundancy replaces acknowledgements, which is what makes gossip robust to loss, slow links and nodes coming and going. Compare lesson 18, Broadcast, where a lost message stays lost unless it is retried until acknowledged.", "Cada nodo recibe la noticia de muchos remitentes al azar, así que ningún mensaje individual importa; uno perdido se reemplaza con el siguiente contacto al azar. La redundancia reemplaza a los acks, y eso hace que gossip resista la pérdida, los enlaces lentos y los nodos que entran y salen. Compáralo con la lección 18, Broadcast, donde un mensaje perdido queda perdido salvo que se reintente hasta recibir su ack.")],
  [t("What is the difference between push, pull and push-pull, and when does each shine?", "¿Cuál es la diferencia entre push, pull y push-pull, y cuándo brilla cada uno?"),
    t("Push: nodes that know send it out; fast at the start, slow to reach the last few. Pull: every node asks a random peer; slow at the start, but finishes the tail quickly. Push-pull exchanges both ways and is fastest overall. Pull-style anti-entropy also repairs nodes that missed updates while they were down, without the per-message acknowledgements of lesson 18, Broadcast.", "Push: los nodos que lo saben lo envían; rápido al principio, lento para llegar a los últimos. Pull: cada nodo le pregunta a un par al azar; lento al principio, pero termina la cola rápido. Push-pull intercambia en ambos sentidos y es el más rápido en total. La anti-entropía estilo pull también repara nodos que se perdieron actualizaciones mientras estaban caídos, sin los acks por mensaje de la lección 18, Broadcast.")],
  [t("What does a bigger fanout buy, and what does it cost?", "¿Qué te da un fanout más grande y qué cuesta?"),
    t("Fewer rounds to reach everyone, because the informed population grows faster, but more messages per round, many of them redundant. Most systems pick a small fanout (2 to 4) and a short round interval instead.", "Menos rondas para llegar a todos, porque la población informada crece más rápido, pero más mensajes por ronda, muchos redundantes. La mayoría de los sistemas elige en cambio un fanout pequeño (de 2 a 4) y un intervalo de ronda corto.")],
  [t("In gossip-based failure detection, why can't the timeout be just one or two rounds?", "En la detección de fallas basada en gossip, ¿por qué el tiempo límite (timeout) no puede ser de solo una o dos rondas?"),
    t("A node's heartbeat reaches others only by being passed along, which takes several rounds (about log N) and longer with slow links. A timeout shorter than that declares healthy nodes dead. Systems like Cassandra use a suspicion level (phi accrual) instead of a fixed cutoff, and SWIM asks other nodes to probe a suspect before declaring it dead.", "El heartbeat de un nodo llega a los demás solo pasando de mano en mano, lo que toma varias rondas (unas log N), y más con enlaces lentos. Un tiempo límite más corto que eso declara muertos a nodos sanos. Sistemas como Cassandra usan un nivel de sospecha (phi accrual) en vez de un corte fijo, y SWIM les pide a otros nodos que sondeen a un sospechoso antes de declararlo muerto.")],
  [t("Where is gossip used in practice?", "¿Dónde se usa gossip en la práctica?"),
    t("Cluster membership and failure detection (Consul/Serf with SWIM, Cassandra, Redis Cluster), spreading cluster state and metadata, anti-entropy repair between replicas, and eventually consistent data like counters and CRDTs (lesson 21, Distributed counters). It suits information everyone should learn eventually, not things that need an immediate, agreed answer (that needs consensus).", "Membresía del clúster y detección de fallas (Consul/Serf con SWIM, Cassandra, Redis Cluster), difusión del estado y los metadatos del clúster, reparación anti-entropía entre réplicas y datos con consistencia eventual como contadores y CRDTs (lección 21, Contadores distribuidos). Sirve para información que todos deben conocer tarde o temprano, no para cosas que necesitan una respuesta inmediata y acordada (eso requiere consenso).")],
];

// Experiment results. The standalone page ran these seeded runs in the browser when a card was run; they are
// deterministic, so they are computed here at build time from the same model.
const halfToAll = (opts) => {
  let half = 0, total = 0, messages = 0; const seeds = 60;
  for (let k = 1; k <= seeds; k++) { const r = spreadRun(opts, k * 31); half += r.rounds - r.curve.findIndex((c) => c >= 0.5); total += r.rounds; messages += r.messages; }
  return { half: half / seeds, total: total / seeds, messages: messages / seeds };
};
const RESULTS = {
  size: { a: spreadAverage({ n: 40, fanout: 2, mode: "push" }, 40), b: spreadAverage({ n: 400, fanout: 2, mode: "push" }, 20) },
  fanout: { a: spreadAverage({ n: 40, fanout: 1, mode: "push" }), b: spreadAverage({ n: 40, fanout: 3, mode: "push" }) },
  mode: { p: halfToAll({ n: 40, fanout: 1, mode: "push" }), l: halfToAll({ n: 40, fanout: 1, mode: "pull" }), b: halfToAll({ n: 40, fanout: 1, mode: "push-pull" }) },
  loss: { a: spreadAverage({ n: 40, fanout: 2, mode: "push-pull", loss: 0 }), b: spreadAverage({ n: 40, fanout: 2, mode: "push-pull", loss: 0.3 }) },
  timeout: [4, 8, 16].map((t) => ({ t, ...detectionAverage({ n: 40, fanout: 2, slow: 0.3, timeout: t }) })),
};

// What each card shows after a run.
const rds = (x) => t(one(x) + " rounds", one(x) + " rondas");
const RUNS = {
  size: () => {
    const { a, b } = RESULTS.size, top = b.rounds * 1.15;
    return { verdict: t("Rounds to reach every house: " + one(a.rounds) + " with 40 houses, " + one(b.rounds) + " with 400. Ten times the houses, " + one(b.rounds - a.rounds) + " more rounds.",
        "Rondas hasta llegar a todas las casas: " + one(a.rounds) + " con 40 casas, " + one(b.rounds) + " con 400. Diez veces las casas, " + one(b.rounds - a.rounds) + " rondas más."),
      bars: [[t("40 houses", "40 casas"), a.rounds / top, rds(a.rounds)], [t("400 houses", "400 casas"), b.rounds / top, rds(b.rounds), true]] };
  },
  fanout: () => {
    const { a, b } = RESULTS.fanout;
    const tr = Math.max(a.rounds, b.rounds) * 1.1, tm = Math.max(a.messages, b.messages) * 1.1;
    return { verdict: t("Rounds " + one(a.rounds) + " → " + one(b.rounds) + "; messages per rumour " + n0(a.messages) + " → " + n0(b.messages) + ".",
        "Rondas " + one(a.rounds) + " → " + one(b.rounds) + "; mensajes por rumor " + n0(a.messages) + " → " + n0(b.messages) + "."),
      bars: [[t("Rounds, fanout 1", "Rondas, fanout 1"), a.rounds / tr, one(a.rounds)], [t("Rounds, fanout 3", "Rondas, fanout 3"), b.rounds / tr, one(b.rounds), true], [t("Msgs, fanout 1", "Msjs, fanout 1"), a.messages / tm, n0(a.messages)], [t("Msgs, fanout 3", "Msjs, fanout 3"), b.messages / tm, n0(b.messages), true]] };
  },
  mode: () => {
    const { p, l, b } = RESULTS.mode, top = p.half * 1.15;
    return { verdict: t("From half the village to every house: push " + one(p.half) + " rounds, pull " + one(l.half) + ", push-pull " + one(b.half) + ". Messages per rumour: " + n0(p.messages) + ", " + n0(l.messages) + ", " + n0(b.messages) + ".",
        "De la mitad del pueblo a todas las casas: push " + one(p.half) + " rondas, pull " + one(l.half) + ", push-pull " + one(b.half) + ". Mensajes por rumor: " + n0(p.messages) + ", " + n0(l.messages) + ", " + n0(b.messages) + "."),
      bars: [["Push", p.half / top, rds(p.half)], ["Pull", l.half / top, rds(l.half), true], ["Push-pull", b.half / top, rds(b.half), true]] };
  },
  loss: () => {
    const { a, b } = RESULTS.loss, top = b.worst * 1.1;
    return { verdict: t("Every house heard it in " + pct(b.reached) + " of runs with 30% loss. Rounds " + one(a.rounds) + " → " + one(b.rounds) + " (slowest run " + a.worst + " → " + b.worst + ").",
        "Todas las casas lo oyeron en el " + pct(b.reached) + " de las ejecuciones con 30% de pérdida. Rondas " + one(a.rounds) + " → " + one(b.rounds) + " (ejecución más lenta " + a.worst + " → " + b.worst + ")."),
      bars: [[t("No loss", "Sin pérdida"), a.rounds / top, rds(a.rounds)], [t("30% lost", "30% perdidos"), b.rounds / top, rds(b.rounds), true]] };
  },
  timeout: () => {
    const rows = RESULTS.timeout;
    const td = Math.max(...rows.map((r) => r.detect)) * 1.1;
    return { verdict: t("Healthy houses that some house wrongly declared dead at least once in 110 rounds (out of 40): " + rows.map((r) => one(r.falseDead) + " with " + r.t).join(", ") + ". Rounds until everyone notices a real failure: " + rows.map((r) => one(r.detect)).join(", ") + ".",
        "Casas sanas que alguna casa declaró muertas por error al menos una vez en 110 rondas (de 40): " + rows.map((r) => one(r.falseDead) + " con " + r.t).join(", ") + ". Rondas hasta que todos notan una falla real: " + rows.map((r) => one(r.detect)).join(", ") + "."),
      bars: [
        ...rows.map((r) => [t("Ever wrongly dead, " + r.t, "Alguna vez muertas por error, " + r.t), r.falseDead / 40, one(r.falseDead), r.t === 4]),
        ...rows.map((r) => [t("Detect, " + r.t + " rounds", "Detección, " + r.t + " rondas"), r.detect / td, one(r.detect) + " rds", r.t === 16]),
      ] };
  },
};

export default defineLesson({
  title: t("Gossip Workbench", "Banco de trabajo: gossip"),
  eyebrow: t("Systems lesson 19 · Gossip protocols", "Lección de sistemas 19 · Protocolos de gossip"),
  lede: t("Gossip spreads information the way a rumour moves through a village: every round, whoever knows tells a few random others. Nobody coordinates, nothing is retried, and yet everyone hears it fast. This lesson builds that idea three ways: watch a machine do it, predict what breaks it, then explain it back.", "Gossip (chisme) propaga información como corre un rumor por un pueblo: en cada ronda, quien lo sabe se lo cuenta a unos pocos al azar. Nadie coordina, nada se reintenta, y aun así todos se enteran rápido. Esta lección construye esa idea de tres maneras: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Each lamp is a house that has heard the current rumour; the dots are messengers. The board in front of house 0, the big house at the back, shows which houses house 0 believes are alive; every house keeps its own copy. Change the fanout or the mode, lose messages, or stop a house and watch its peg drop.", "Cada lámpara es una casa que oyó el rumor actual; los puntos son mensajeros. El tablero frente a la casa 0, la casa grande del fondo, muestra qué casas cree vivas la casa 0; cada casa lleva su propia copia. Cambia el fanout o el modo, pierde mensajes o detén una casa y mira cómo baja su clavija."),
    plate: {
      title: t("Gossip village", "Pueblo del rumor"),
      keys: [
        { mark: "lit", label: t("Lit roof and lamp: the house has heard the rumour. Dot on a dashed arc: a messenger in flight", "Techo y lámpara encendidos: la casa oyó el rumor. Punto en un arco punteado: un mensajero en camino") },
        { mark: "raised", label: t("Pennant: house 0 suspects the house. Boards across the door: house 0 declared it dead", "Banderín: la casa 0 sospecha de la casa. Tablas en la puerta: la casa 0 la declaró muerta") },
        { mark: "flat", label: t("Grey house: stopped. Dial and digit wheels: rounds of the current rumour", "Casa gris: detenida. Dial y ruedas de dígitos: rondas del rumor actual") },
      ],
      caption:
        t("Every round, each house that knows the rumour sends messengers to random houses (push), or every house asks a random house (pull), or both. A lamp lights when its house hears. When the whole village knows, a new rumour starts somewhere else. Meanwhile every house gossips heartbeats too, and keeps its own table of who it thinks is alive, built only from the heartbeats it hears. Nobody holds the master list: the pegboard shows house 0's copy (tall peg alive, short peg suspected, empty hole dead), and house 0 is an ordinary member that happens to be drawn bigger. Each house is marked to match house 0's view: a pennant when it is suspected, boards across the door when it is declared dead. One house has already stopped when the page opens; stop another and watch it go grey, then get a pennant, then boards. A short peg on a house nobody stopped is a false suspicion: its heartbeat was just slow to arrive.", "En cada ronda, cada casa que conoce el rumor manda mensajeros a casas al azar (push), o cada casa le pregunta a una casa al azar (pull), o ambas cosas. Una lámpara se enciende cuando su casa se entera. Cuando todo el pueblo lo sabe, empieza un rumor nuevo en otro lugar. Mientras tanto, cada casa también propaga heartbeats (latidos) y lleva su propia tabla de quién cree que está viva, armada solo con los heartbeats que oye. Nadie tiene la lista maestra: el tablero de clavijas muestra la copia de la casa 0 (clavija alta: viva; clavija baja: sospechosa; hoyo vacío: muerta), y la casa 0 es un miembro común que solo está dibujado más grande. Cada casa se marca según lo que ve la casa 0: un banderín cuando es sospechosa, tablas en la puerta cuando se declara muerta. Al abrir la página ya hay una casa detenida; detén otra y mira cómo se pone gris, después recibe un banderín y después tablas. Una clavija baja en una casa que nadie detuvo es una sospecha falsa: su heartbeat solo tardó en llegar."),
      stage: { "data-office": "" },
      label: t("Gossip village simulation. Space pauses or resumes.", "Simulación del pueblo del rumor. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["round", t("Round", "Ronda")], ["know", t("Know it", "Lo saben"), "–"], ["messages", t("Messages", "Mensajes")], ["last", t("Last rumour", "Último rumor"), "–"], ["suspected", t("Suspected", "Sospechosas")], ["dead", t("Declared dead", "Declaradas muertas")]],
    controls: [
      { seg: "houses", label: t("Houses", "Casas"), options: [[20, "20"], [40, "40"]], value: 40 },
      { seg: "fanout", label: "Fanout", options: [[1, "1"], [2, "2"], [3, "3"]], value: 2 },
      { seg: "mode", label: t("Mode", "Modo"), options: [["push", "Push"], ["pull", "Pull"], ["push-pull", "Push-pull"]], value: "push" },
      { seg: "loss", label: t("Messages lost", "Mensajes perdidos"), options: [[0, "0%"], [0.1, "10%"], [0.3, "30%"]], value: 0 },
      { seg: "timeout", label: t("Failure timeout", "Tiempo límite de falla"), options: [[4, t("4 rounds", "4 rondas")], [8, "8"], [16, "16"]], value: 8 },
      { seg: "slow", label: t("Slow links", "Enlaces lentos"), options: [[0, t("Off", "No")], [0.3, t("On", "Sí")]], value: 0 },
      { speed: true },
      { actions: [["kill", t("Stop a house", "Detener una casa")], ["revive", t("Revive all", "Revivir todas")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over 12 to 60 seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre 12 a 60 ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  // Figure-specific styles: the lamp glow, stopped houses, hidden plots, peg states.
  css: `
.glow{fill:var(--anatomy-lit);stroke:none;opacity:0;transition:opacity .25s}
[data-lamp][data-on] .glow{opacity:1}
[data-lamp][data-on] .iso-solid>.iso-edge{stroke:var(--anatomy-lit)}
[data-house][data-dead] .iso-top,[data-house][data-dead] .iso-shade,[data-house][data-dead] .iso-fill{fill:var(--anatomy-faint)}
[data-house]>[data-flag],[data-house]>[data-boards]{display:none}
[data-house][data-view="suspected"]>[data-flag],[data-house][data-view="dead"]>[data-boards]{display:inline}
[data-boards] path{stroke-width:1.5;stroke:var(--anatomy-lo)}
.pennant{fill:var(--anatomy-mid);stroke:var(--anatomy-mid);stroke-width:.6;stroke-linejoin:round}
.roof>.iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit)}
.iso-face-text[data-tone="lit"]{fill:var(--anatomy-lit);font-weight:600}
.trail{fill:none;stroke:var(--anatomy-lit);stroke-width:.7;stroke-dasharray:1.6 1.6;opacity:.5}
[data-house][data-off]{display:none}
[data-peg]>[data-v]{display:none}
[data-peg][data-state="alive"]>[data-v="alive"],[data-peg][data-state="suspected"]>[data-v="suspected"]{display:inline}
[data-peg][data-off]{display:none}
.messenger{fill:var(--anatomy-lit);stroke:var(--anatomy-card);stroke-width:.6}
`,
  data: {
    TITLES: Object.fromEntries(EXPERIMENTS.map(({ id, title }) => [id, title])),
    P,
    G: GEOMETRY,
  },
});
