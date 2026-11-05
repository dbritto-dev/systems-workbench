// @ts-nocheck: content in the style of the other lessons
// Systems lesson 71 · Consumer groups: a sorting hall where a coordinator hands six lanes (partitions) to its workers.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, one } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, recordSvg, P, GEOMETRY, FIGURE_CSS } from "./figure";
import { unevenRun, joinRun, stormRun, deployRun, crashRun, UNEVEN, JOIN, STORM, DEPLOY, CRASH, DEFAULTS } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each).
const R = { uneven: unevenRun(), join: joinRun(), storm: stormRun(), deploy: deployRun(), crash: crashRun() };

const s1 = (x) => one(x) + " s";
const top = (...xs) => Math.max(...xs, 0.01) * 1.05;
const meanOf = (o, ids) => ids.reduce((a, i) => a + o["l" + i], 0) / ids.length;

const RUNS = {
  uneven: () => {
    const { three, four, six } = R.uneven;
    const busy3 = meanOf(three, [0, 1, 2, 3]), busy4 = meanOf(four, [0, 1, 2, 3]), light3 = meanOf(three, [4, 5]), light4 = meanOf(four, [4, 5]);
    const m = top(busy3, busy4);
    return {
      verdict: t("Lag after 2 minutes on lanes 1 to 4: about " + n0(busy3) + " records a lane with three workers, " + n0(busy4) + " with four. On lanes 5 and 6: " + n0(light3) + " → " + n0(light4) + ". All six lanes together: " + n0(three.total) + " with three workers, " + n0(four.total) + " with four, " + n0(six.total) + " with six.",
        "Lag a los 2 minutos en los carriles 1 a 4: unos " + n0(busy3) + " registros por carril con tres trabajadores, " + n0(busy4) + " con cuatro. En los carriles 5 y 6: " + n0(light3) + " → " + n0(light4) + ". Los seis carriles juntos: " + n0(three.total) + " con tres trabajadores, " + n0(four.total) + " con cuatro y " + n0(six.total) + " con seis."),
      bars: [[t("Lanes 1–4, three workers", "Carriles 1–4, tres trabajadores"), busy3 / m, n0(busy3)], [t("Lanes 1–4, four workers", "Carriles 1–4, cuatro trabajadores"), busy4 / m, n0(busy4), true], [t("Lanes 5–6, four workers", "Carriles 5–6, cuatro trabajadores"), light4 / m, n0(light4)], [t("Any lane, six workers", "Cualquier carril, seis trabajadores"), six.total / 6 / m, n0(six.total / 6)]],
    };
  },
  join: () => {
    const { eager, coop } = R.join, m = top(eager.laneSecs, coop.laneSecs);
    return {
      verdict: t("Eager: " + n0(eager.lanes) + " of 6 lanes stopped, " + one(eager.laneSecs) + " lane-seconds in all, each for up to " + s1(eager.longest) + "; the rebalance took " + s1(eager.busy) + ". Cooperative: " + n0(coop.lanes) + " lane stopped, " + one(coop.laneSecs) + " lane-seconds, up to " + s1(coop.longest) + "; the rebalance took " + s1(coop.busy) + " over two rounds.",
        "Eager: se detuvieron " + n0(eager.lanes) + " de 6 carriles, " + one(eager.laneSecs) + " carril-segundos en total, cada uno hasta " + s1(eager.longest) + "; el rebalanceo tardó " + s1(eager.busy) + ". Cooperativo: se detuvo " + n0(coop.lanes) + " carril, " + one(coop.laneSecs) + " carril-segundos, hasta " + s1(coop.longest) + "; el rebalanceo tardó " + s1(coop.busy) + " en dos rondas."),
      groups: [
        { title: t("Lanes that stopped (of 6)", "Carriles que se detuvieron (de 6)"), bars: [[t("Eager", "Eager"), eager.lanes / 6, n0(eager.lanes)], [t("Cooperative", "Cooperativo"), coop.lanes / 6, n0(coop.lanes), true]] },
        { title: t("Lane-seconds stopped", "Carril-segundos detenidos"), bars: [[t("Eager", "Eager"), eager.laneSecs / m, one(eager.laneSecs)], [t("Cooperative", "Cooperativo"), coop.laneSecs / m, one(coop.laneSecs), true]] },
      ],
    };
  },
  storm: () => {
    const { short, long } = R.storm, m = top(long.committed, short.duplicates);
    return {
      verdict: t("Poll limit 60 s: " + n0(long.committed) + " records committed in 2 minutes, " + n0(long.rebalances) + " rebalances, " + n0(long.duplicates) + " done twice. Poll limit 10 s: " + n0(short.committed) + " committed, " + n0(short.rebalances) + " rebalances after " + n0(short.kicks) + " workers were dropped, and " + n0(short.duplicates) + " records done again.",
        "Límite de poll de 60 s: " + n0(long.committed) + " registros confirmados en 2 minutos, " + n0(long.rebalances) + " rebalanceos, " + n0(long.duplicates) + " hechos dos veces. Límite de 10 s: " + n0(short.committed) + " confirmados, " + n0(short.rebalances) + " rebalanceos tras " + n0(short.kicks) + " expulsiones de trabajadores, y " + n0(short.duplicates) + " registros hechos otra vez."),
      bars: [[t("Committed, 60 s limit", "Confirmados, límite de 60 s"), long.committed / m, n0(long.committed)], [t("Committed, 10 s limit", "Confirmados, límite de 10 s"), short.committed / m, n0(short.committed), true], [t("Done again, 10 s limit", "Hechos otra vez, límite de 10 s"), short.duplicates / m, n0(short.duplicates), true]],
    };
  },
  deploy: () => {
    const { dynamic: d, static: s } = R.deploy, m = top(d.laneSecs, s.laneSecs), w = top(d.longest, s.longest);
    return {
      verdict: t("Dynamic members: " + n0(d.rebalances) + " rebalances, lanes stopped " + n0(d.laneSecs) + " lane-seconds in all, never more than " + s1(d.longest) + " at a time. Static ids: " + n0(s.rebalances) + " rebalances, " + n0(s.laneSecs) + " lane-seconds, but up to " + s1(s.longest) + " at a time. The longest a record waited: " + s1(d.maxWait) + " vs " + s1(s.maxWait) + ".",
        "Miembros dinámicos: " + n0(d.rebalances) + " rebalanceos, carriles detenidos " + n0(d.laneSecs) + " carril-segundos en total, nunca más de " + s1(d.longest) + " seguidos. Ids estáticos: " + n0(s.rebalances) + " rebalanceos, " + n0(s.laneSecs) + " carril-segundos, pero hasta " + s1(s.longest) + " seguidos. Lo más que esperó un registro: " + s1(d.maxWait) + " contra " + s1(s.maxWait) + "."),
      groups: [
        { title: t("Rebalances during the deploy", "Rebalanceos durante el despliegue"), bars: [[t("Dynamic", "Dinámicos"), d.rebalances / 8, n0(d.rebalances)], [t("Static ids", "Ids estáticos"), s.rebalances / 8, n0(s.rebalances), true]] },
        { title: t("Longest stop of one lane", "Detención más larga de un carril"), bars: [[t("Dynamic", "Dinámicos"), d.longest / w, s1(d.longest)], [t("Static ids", "Ids estáticos"), s.longest / w, s1(s.longest), true]] },
      ],
    };
  },
  crash: () => {
    const { long, short } = R.crash, m = top(long.unread, short.unread), p = top(long.peak, short.peak);
    return {
      verdict: t("45 s session timeout: worker 2's lanes went unread for " + s1(long.unread) + " and their lag peaked at " + n0(long.peak) + " records; the longest a record waited was " + s1(long.maxWait) + ". 10 s: " + s1(short.unread) + ", a peak of " + n0(short.peak) + ", " + s1(short.maxWait) + ". The other lanes stopped for at most " + s1(long.others) + ", in the rebalance.",
        "Tiempo límite de sesión de 45 s: los carriles del trabajador 2 quedaron sin leer " + s1(long.unread) + " y su lag llegó a " + n0(long.peak) + " registros; lo más que esperó un registro fue " + s1(long.maxWait) + ". Con 10 s: " + s1(short.unread) + ", un pico de " + n0(short.peak) + " y " + s1(short.maxWait) + ". Los otros carriles se detuvieron como mucho " + s1(long.others) + ", durante el rebalanceo."),
      groups: [
        { title: t("Worker 2's lanes unread", "Carriles del trabajador 2 sin leer"), bars: [[t("Timeout 45 s", "Límite de 45 s"), long.unread / m, s1(long.unread), true], [t("Timeout 10 s", "Límite de 10 s"), short.unread / m, s1(short.unread)]] },
        { title: t("Peak lag on those lanes", "Pico de lag en esos carriles"), bars: [[t("Timeout 45 s", "Límite de 45 s"), long.peak / p, n0(long.peak), true], [t("Timeout 10 s", "Límite de 10 s"), short.peak / p, n0(short.peak)]] },
      ],
    };
  },
};

const { join: J, storm: X, deploy: Dp, crash: C } = R;
const PER_WORKER = n0(1 / DEFAULTS.service);

const EXPERIMENTS = [
  {
    id: "uneven",
    title: t("A fourth worker for six lanes", "Un cuarto trabajador para seis carriles"),
    change: t(UNEVEN.rate + " records/s spread evenly over 6 lanes · a worker does about " + PER_WORKER + " a second · workers 3 → 4 (and 6, to compare) · 2 minutes",
      UNEVEN.rate + " registros/s repartidos por igual en 6 carriles · un trabajador hace unos " + PER_WORKER + " por segundo · trabajadores 3 → 4 (y 6, para comparar) · 2 minutos"),
    question: t("Three workers fall behind. Four can do " + UNEVEN.rate + " a second between them: what does the lag do?", "Tres trabajadores se atrasan. Cuatro pueden hacer " + UNEVEN.rate + " por segundo entre todos: ¿qué hace el lag?"),
    options: [
      t("It stops growing: four workers match what arrives", "Deja de crecer: cuatro trabajadores igualan lo que llega"),
      t("It grows a third slower, on every lane", "Crece un tercio más lento, en cada carril"),
      t("Four lanes keep growing as fast as before", "Cuatro carriles siguen creciendo igual que antes"),
    ],
    answer: 2,
    why: t(
      "A lane goes to one worker whole, so six lanes over four workers split 2, 2, 1, 1. The two workers with two lanes still get 4 records a second each and can do about 3, exactly as with three workers, so their four lanes fall behind at the same pace, while the other two workers sit idle a third of the time. Capacity added to the group isn't capacity where the backlog is. Six workers, one lane each, keep up. So pick the partition count up front with the group sizes in mind: a number with many divisors (12, 24, 60) splits evenly over more of them. Adding partitions later changes which partition a key lands on, and with it the per-key order (lesson 20, Logs and offsets); more workers than lanes just stand by.",
      "Un carril va entero a un solo trabajador, así que seis carriles entre cuatro trabajadores quedan 2, 2, 1, 1. Los dos trabajadores con dos carriles siguen recibiendo 4 registros por segundo cada uno y pueden hacer unos 3, igual que con tres trabajadores, así que sus cuatro carriles se atrasan al mismo ritmo, mientras los otros dos trabajadores quedan ociosos un tercio del tiempo. La capacidad que se suma al grupo no es capacidad donde está el atraso. Seis trabajadores, un carril cada uno, sí alcanzan. Por eso conviene elegir la cantidad de particiones desde el principio pensando en los tamaños del grupo: un número con muchos divisores (12, 24, 60) se reparte parejo entre más de ellos. Agregar particiones después cambia a qué partición va cada clave, y con eso el orden por clave (lección 20, Logs y offsets); más trabajadores que carriles solo quedan esperando.",
    ),
    watch: { workers: 4, rate: 12, protocol: "eager", members: "dynamic", session: 45, pollLimit: 10, slow: 1, speed: 3 },
  },
  {
    id: "join",
    title: t("A worker joins", "Se suma un trabajador"),
    change: t("Three workers keeping up with 6 records/s · a fourth joins · eager rebalance (every worker gives up all its lanes, then they're handed out again) vs cooperative (lanes stay where they are unless they must move)",
      "Tres trabajadores que alcanzan con 6 registros/s · se suma un cuarto · rebalanceo eager (cada trabajador suelta todos sus carriles y luego se reparten de nuevo) vs cooperativo (los carriles se quedan donde están salvo los que deben moverse)"),
    question: t("With the cooperative protocol, how many of the six lanes stop while the lanes are handed out?", "Con el protocolo cooperativo, ¿cuántos de los seis carriles se detienen mientras se reparten los carriles?"),
    options: [
      t("All six, briefly: a rebalance always pauses the group", "Los seis, un momento: un rebalanceo siempre pausa al grupo"),
      t("Only the one lane that changes hands", "Solo el carril que cambia de dueño"),
      t("None: the new worker picks up a spare lane", "Ninguno: el trabajador nuevo toma un carril libre"),
    ],
    answer: 1,
    why: t(
      "In an eager rebalance every member drops all its lanes when it joins the round and waits for the new plan, so all six lanes stop together, " + one(J.eager.laneSecs) + " lane-seconds here, although only one lane ends up moving. With cooperative rebalancing (Kafka's CooperativeStickyAssignor, KIP-429) members keep their lanes and keep working: the plan leaves every lane where it is if it can, and the one lane the new worker gets is revoked by its owner and handed over in a second round. That lane stops for about as long as in an eager rebalance, and the rebalance as a whole takes longer, " + s1(J.coop.busy) + " against " + s1(J.eager.busy) + ", but nothing else stops. There are no spare lanes: every lane already has an owner, so the newcomer only gets work when someone gives some up. Kafka 4.0's new group protocol (KIP-848, opted into with group.protocol=consumer) goes further: the broker works out the assignment, and no round waits for the whole group.",
      "En un rebalanceo eager, cada miembro suelta todos sus carriles cuando entra a la ronda y espera el plan nuevo, así que los seis carriles se detienen juntos, " + one(J.eager.laneSecs) + " carril-segundos aquí, aunque al final solo se mueve un carril. Con el rebalanceo cooperativo (el CooperativeStickyAssignor de Kafka, KIP-429), los miembros conservan sus carriles y siguen trabajando: el plan deja cada carril donde está si puede, y el carril que recibe el trabajador nuevo lo revoca su dueño y se entrega en una segunda ronda. Ese carril se detiene más o menos lo mismo que en un rebalanceo eager, y el rebalanceo completo tarda más, " + s1(J.coop.busy) + " contra " + s1(J.eager.busy) + ", pero nada más se detiene. No hay carriles libres: cada carril ya tiene dueño, así que el recién llegado solo recibe trabajo cuando alguien suelta algo. El nuevo protocolo de grupos de Kafka 4.0 (KIP-848, que se activa con group.protocol=consumer) va más allá: el broker calcula la asignación y ninguna ronda espera a todo el grupo.",
    ),
    watch: { workers: 3, rate: 6, protocol: "coop", members: "dynamic", session: 45, pollLimit: 10, slow: 1, speed: 1, then: "add" },
  },
  {
    id: "storm",
    title: t("Batches that outlast the poll limit", "Lotes que duran más que el límite de poll"),
    change: t("Each record takes 4× longer (a slow downstream call), so a batch of 10 takes about 13 s · poll limit (max.poll.interval.ms) 60 s vs 10 s · 2 minutes",
      "Cada registro tarda 4× más (una llamada lenta a otro servicio), así que un lote de 10 tarda unos 13 s · límite de poll (max.poll.interval.ms) de 60 s vs 10 s · 2 minutos"),
    question: t("With the 10 s poll limit, how much work gets committed in 2 minutes?", "Con el límite de poll de 10 s, ¿cuánto trabajo se confirma en 2 minutos?"),
    options: [
      t("About as much as with 60 s: the work is just slower", "Más o menos lo mismo que con 60 s: el trabajo solo es más lento"),
      t("Almost none: the same batches are redone over and over", "Casi nada: los mismos lotes se rehacen una y otra vez"),
      t("More: stuck workers get swapped out sooner", "Más: los trabajadores trabados se reemplazan antes"),
    ],
    answer: 1,
    why: t(
      "A worker that doesn't poll within the limit is taken for stuck: it leaves the group, a rebalance hands its lanes to the others, and when it finally finishes, its commit fails, so its batch is redone from the last committed offset. Every batch now outlasts the limit, so every worker is dropped before it can commit, rejoins, gets a batch and is dropped again: a rebalance storm. The work gets done, and done again (" + n0(X.short.duplicates) + " times here), but almost nothing is committed, and the lag grows without end. With 60 s the same slow work committed " + n0(X.long.committed) + " records. Keep a batch's worst case well under the limit: fewer records per poll (max.poll.records), a longer limit, or the slow call moved out of the poll loop. Kafka's defaults are 500 records and 5 minutes; the machine scales both down.",
      "Un trabajador que no hace poll dentro del límite se da por trabado: sale del grupo, un rebalanceo reparte sus carriles entre los demás y, cuando por fin termina, su commit falla, así que su lote se rehace desde el último offset confirmado. Ahora cada lote dura más que el límite, así que cada trabajador queda fuera antes de poder confirmar, vuelve a entrar, recibe un lote y queda fuera otra vez: una tormenta de rebalanceos. El trabajo se hace, y se rehace (" + n0(X.short.duplicates) + " veces aquí), pero casi nada se confirma, y el lag crece sin fin. Con 60 s, el mismo trabajo lento confirmó " + n0(X.long.committed) + " registros. Mantén el peor caso de un lote muy por debajo del límite: menos registros por poll (max.poll.records), un límite más largo, o la llamada lenta fuera del bucle de poll. Los valores por defecto de Kafka son 500 registros y 5 minutos; la máquina reduce los dos a escala.",
    ),
    watch: { workers: 3, rate: 6, protocol: "eager", members: "dynamic", session: 45, pollLimit: 10, slow: 4, speed: 3 },
  },
  {
    id: "deploy",
    title: t("A rolling restart", "Un reinicio escalonado"),
    change: t("A deploy: four workers restarted one at a time, " + DEPLOY.gap + " s apart, each down 8 s · eager rebalancing · dynamic members vs static ids (group.instance.id), with the 45 s session timeout",
      "Un despliegue: cuatro trabajadores reiniciados uno a la vez, cada " + DEPLOY.gap + " s, cada uno fuera 8 s · rebalanceo eager · miembros dinámicos vs ids estáticos (group.instance.id), con el tiempo límite de sesión de 45 s"),
    question: t("With static ids, what does the deploy do to the lanes?", "Con ids estáticos, ¿qué le hace el despliegue a los carriles?"),
    options: [
      t("Nothing: no rebalances, so no lane ever stops", "Nada: sin rebalanceos, ningún carril se detiene"),
      t("No rebalances, but each worker's lanes wait out its restart", "Sin rebalanceos, pero los carriles de cada trabajador esperan su reinicio"),
      t("The same rebalances as before, only quicker", "Los mismos rebalanceos que antes, solo que más rápidos"),
    ],
    answer: 1,
    why: t(
      "A dynamic member leaves the group when it shuts down and joins as a new member when it comes back, so each restart costs two rebalances, " + n0(Dp.dynamic.rebalances) + " in all, and with eager rebalancing each one stops all six lanes for a moment. With a static id the coordinator keeps the member's place until its session timeout runs out: it comes back to the same lanes and nothing rebalances. The price is that its own lanes go unread for the whole restart, up to " + s1(Dp.static.longest) + " here against " + s1(Dp.dynamic.longest) + " at a time with rebalances, and a worker that never comes back holds its lanes until the timeout. Static membership pays off when moving lanes is expensive: big groups, eager assignors, workers that rebuild local state or warm a cache for every lane they get (Kafka Streams state stores, for example).",
      "Un miembro dinámico sale del grupo cuando se apaga y entra como miembro nuevo cuando vuelve, así que cada reinicio cuesta dos rebalanceos, " + n0(Dp.dynamic.rebalances) + " en total, y con el rebalanceo eager cada uno detiene los seis carriles un momento. Con un id estático, el coordinador le guarda el lugar al miembro hasta que vence su tiempo límite de sesión: vuelve a los mismos carriles y nada se rebalancea. El precio es que sus propios carriles quedan sin leer durante todo el reinicio, hasta " + s1(Dp.static.longest) + " aquí contra " + s1(Dp.dynamic.longest) + " seguidos con rebalanceos, y un trabajador que nunca vuelve retiene sus carriles hasta que vence el tiempo. La membresía estática vale la pena cuando mover carriles es caro: grupos grandes, asignadores eager, trabajadores que reconstruyen estado local o calientan una caché por cada carril que reciben (los state stores de Kafka Streams, por ejemplo).",
    ),
    watch: { workers: 4, rate: 6, protocol: "eager", members: "static", session: 45, pollLimit: 10, slow: 1, speed: 3, then: "rolling" },
  },
  {
    id: "crash",
    title: t("A worker dies without a word", "Un trabajador muere sin avisar"),
    change: t("Three workers · worker 2 is killed (kill -9, a lost machine) and says nothing to the coordinator · session timeout 45 s (Kafka's default) vs 10 s",
      "Tres trabajadores · el trabajador 2 muere de golpe (kill -9, una máquina perdida) y no le avisa nada al coordinador · tiempo límite de sesión de 45 s (el valor por defecto de Kafka) vs 10 s"),
    question: t("With the 45 s default, how long do worker 2's lanes go unread?", "Con los 45 s por defecto, ¿cuánto tiempo quedan sin leer los carriles del trabajador 2?"),
    options: [
      t("A second or two: the broker sees the connection drop", "Un segundo o dos: el broker ve que se cae la conexión"),
      t("About 45 s, until its session runs out", "Unos 45 s, hasta que vence su sesión"),
      t("Until worker 2 is restarted", "Hasta que reinicien al trabajador 2"),
    ],
    answer: 1,
    why: t(
      "The coordinator knows a member is alive only from its heartbeats. A worker that shuts down cleanly says goodbye and the rebalance starts at once; a killed one just goes quiet, and the coordinator waits out the session timeout before it drops it and hands its lanes out: " + s1(C.long.unread) + " here, with up to " + n0(C.long.peak) + " records piling up on its two lanes. A 10 s timeout cut that to " + s1(C.short.unread) + ". The other side: a short timeout also drops live workers during a long garbage-collection pause or a network blip, and each false alarm costs two rebalances (out, then back in). Kafka raised the default from 10 s to 45 s in version 3.0 (KIP-735) for that reason. Heartbeats come from a background thread, so a slow batch doesn't miss them; catching that is the poll limit's job.",
      "El coordinador sabe que un miembro está vivo solo por sus latidos (heartbeats). Un trabajador que se apaga bien se despide y el rebalanceo empieza de inmediato; uno que muere de golpe simplemente se calla, y el coordinador espera a que venza el tiempo límite de sesión antes de sacarlo y repartir sus carriles: " + s1(C.long.unread) + " aquí, con hasta " + n0(C.long.peak) + " registros acumulados en sus dos carriles. Un tiempo límite de 10 s lo bajó a " + s1(C.short.unread) + ". La otra cara: un tiempo corto también saca a trabajadores vivos durante una pausa larga de recolección de basura (garbage collection) o un corte breve de red, y cada falsa alarma cuesta dos rebalanceos (sale y vuelve a entrar). Kafka subió el valor por defecto de 10 s a 45 s en la versión 3.0 (KIP-735) por eso. Los heartbeats salen de un hilo en segundo plano, así que un lote lento no los pierde; detectar eso le toca al límite de poll.",
    ),
    watch: { workers: 3, rate: 6, protocol: "eager", members: "dynamic", session: 45, pollLimit: 10, slow: 1, speed: 3, then: "crash" },
  },
];

const QUESTIONS = [
  [t("A topic has 6 partitions and the group has 4 consumers. Why isn't it a third faster than with 3, and how do you choose a partition count?", "Un topic tiene 6 particiones y el grupo tiene 4 consumidores. ¿Por qué no es un tercio más rápido que con 3, y cómo eliges la cantidad de particiones?"),
    t("A partition is the unit of assignment: one consumer reads it whole. Six over four splits 2, 2, 1, 1, so two consumers carry exactly the load they carried before and the group is as slow as its busiest member. Choose a partition count that divides evenly over the group sizes you expect, with headroom (12, 24 or 60 have many divisors), because consumers beyond the partition count sit idle and adding partitions later remaps keys to partitions, breaking per-key order across the change (lesson 20, Logs and offsets). Skew inside one partition, a hot key, isn't fixed by any count.",
      "Una partición es la unidad de asignación: la lee entera un solo consumidor. Seis entre cuatro quedan 2, 2, 1, 1, así que dos consumidores cargan exactamente lo mismo que antes y el grupo va tan lento como su miembro más cargado. Elige una cantidad de particiones que se reparta pareja entre los tamaños de grupo que esperas, con margen (12, 24 o 60 tienen muchos divisores), porque los consumidores que pasan de la cantidad de particiones quedan ociosos y agregar particiones después cambia a qué partición va cada clave, y rompe el orden por clave durante el cambio (lección 20, Logs y offsets). El desbalance dentro de una partición, una clave caliente (hot key), no lo arregla ninguna cantidad.")],
  [t("What happens in an eager rebalance, and what does cooperative rebalancing change?", "¿Qué pasa en un rebalanceo eager y qué cambia el rebalanceo cooperativo?"),
    t("Eager: when a rebalance starts, every member finishes its current batch, commits, gives up all its partitions and rejoins; nothing is read until the new assignment comes back, and the round waits for the slowest member. Cooperative (incremental): members keep their partitions and keep reading; a sticky assignment moves only what must move, those partitions are revoked and reassigned in a follow-up round. Fewer partitions stop, at the cost of two rounds. Kafka 4.0's consumer protocol (KIP-848) moves the assignment to the broker and drops the group-wide barrier altogether.",
      "Eager: cuando empieza un rebalanceo, cada miembro termina su lote actual, confirma, suelta todas sus particiones y vuelve a entrar; no se lee nada hasta que llega la asignación nueva, y la ronda espera al miembro más lento. Cooperativo (incremental): los miembros conservan sus particiones y siguen leyendo; una asignación sticky mueve solo lo que hace falta mover, y esas particiones se revocan y se reasignan en una segunda ronda. Se detienen menos particiones, a cambio de dos rondas. El protocolo de consumidores de Kafka 4.0 (KIP-848) lleva la asignación al broker y elimina la barrera de todo el grupo.")],
  [t("A consumer that is alive keeps getting kicked out of its group. What is going on, and what do you tune?", "Un consumidor que está vivo queda fuera de su grupo una y otra vez. ¿Qué está pasando y qué ajustas?"),
    t("It isn't polling often enough: processing one batch takes longer than max.poll.interval.ms, so the client leaves the group, its partitions move, its commit fails and the batch is redone; it rejoins and the cycle repeats. Liveness (heartbeats, session.timeout.ms) and progress (the poll limit) are checked separately. Make a batch's worst case fit: lower max.poll.records, raise max.poll.interval.ms, or move slow work off the polling thread (pausing the partitions meanwhile). Watch for rising rebalance counts and CommitFailedException.",
      "No está haciendo poll con la frecuencia necesaria: procesar un lote tarda más que max.poll.interval.ms, así que el cliente sale del grupo, sus particiones se mueven, su commit falla y el lote se rehace; vuelve a entrar y el ciclo se repite. La señal de vida (heartbeats, session.timeout.ms) y el progreso (el límite de poll) se revisan por separado. Haz que el peor caso de un lote quepa: baja max.poll.records, sube max.poll.interval.ms o saca el trabajo lento del hilo que hace poll (pausando las particiones mientras tanto). Vigila si suben los rebalanceos y aparece CommitFailedException.")],
  [t("What does the session timeout trade off, and how should a consumer shut down?", "¿Qué equilibra el tiempo límite de sesión y cómo debería apagarse un consumidor?"),
    t("A short timeout notices a dead consumer sooner, so its partitions wait less; a long one rides out GC pauses and network blips without false evictions, each of which costs two rebalances. Kafka's default is 45 s since 3.0. Whatever the value, a clean shutdown shouldn't depend on it: close the consumer on SIGTERM (commit, then leave the group) so the rebalance starts at once, and give the process enough grace period to do it.",
      "Un tiempo corto detecta antes a un consumidor muerto, así que sus particiones esperan menos; uno largo aguanta pausas de GC y cortes breves de red sin expulsiones falsas, y cada una cuesta dos rebalanceos. El valor por defecto de Kafka es 45 s desde la 3.0. Sea cual sea, un apagado limpio no debería depender de él: cierra el consumidor al recibir SIGTERM (confirma y sale del grupo) para que el rebalanceo empiece de inmediato, y dale al proceso tiempo de gracia suficiente para hacerlo.")],
  [t("When is static group membership worth it, and what does it cost?", "¿Cuándo vale la pena la membresía estática en un grupo y qué cuesta?"),
    t("With group.instance.id set, a consumer that restarts within the session timeout gets its partitions back without a rebalance, so rolling restarts stop shuffling the whole group. It pays off when a rebalance is expensive: large groups, eager assignors, consumers that rebuild per-partition state or caches. The cost: while that consumer is down its partitions are read by no one, a consumer that dies holds them until the timeout (often set longer for static members), and ids must be unique and stable, such as a StatefulSet pod name.",
      "Con group.instance.id configurado, un consumidor que se reinicia dentro del tiempo límite de sesión recupera sus particiones sin rebalanceo, así que los reinicios escalonados dejan de revolver a todo el grupo. Vale la pena cuando un rebalanceo es caro: grupos grandes, asignadores eager, consumidores que reconstruyen estado o cachés por partición. El costo: mientras ese consumidor está caído nadie lee sus particiones, uno que muere las retiene hasta que vence el tiempo (que suele ser más largo para miembros estáticos), y los ids deben ser únicos y estables, como el nombre de un pod de un StatefulSet.")],
  [t("After a rebalance, some records are processed twice. Why, and what keeps that safe?", "Después de un rebalanceo, algunos registros se procesan dos veces. ¿Por qué, y qué hace que eso sea seguro?"),
    t("The new owner starts from the last committed offset. Whatever the old owner processed but hadn't committed, because it crashed, was dropped mid-batch, or kept working after it was kicked, is processed again: consumer groups give at-least-once delivery. Commit when partitions are revoked (onPartitionsRevoked) to cover clean handovers, and make the handler idempotent for the rest (lesson 25, Idempotency keys; lesson 69, Delivery guarantees). A kicked consumer that is still writing is a zombie; fencing its writes is lesson 62, Leases & fencing tokens.",
      "El dueño nuevo empieza desde el último offset confirmado. Lo que el dueño anterior procesó pero no había confirmado, porque se cayó, lo sacaron a mitad de un lote o siguió trabajando después de que lo expulsaran, se procesa otra vez: los consumer groups dan entrega al menos una vez (at-least-once). Confirma cuando te revocan particiones (onPartitionsRevoked) para cubrir los traspasos limpios, y haz el handler idempotente para el resto (lección 25, Claves de idempotencia; lección 69, Garantías de entrega). Un consumidor expulsado que sigue escribiendo es un zombi; cercar sus escrituras es la lección 62, Arrendamientos y tokens de cerco.")],
];

export default defineLesson({
  title: t("Consumer Group Workbench", "Banco de trabajo: grupos de consumidores"),
  eyebrow: t("Systems lesson 71 · Consumer groups", "Lección de sistemas 71 · Grupos de consumidores"),
  lede: t("A consumer group shares out a topic's partitions, one consumer per partition, and every time a member joins, leaves or goes quiet, the group stops to share them out again: a rebalance. This lesson runs a sorting hall where a coordinator hands six lanes to its workers: watch a machine do it, predict what breaks it, then explain it back.",
    "Un grupo de consumidores (consumer group) reparte las particiones de un topic, un consumidor por partición, y cada vez que un miembro entra, sale o se queda callado, el grupo se detiene para repartirlas otra vez: un rebalanceo (rebalance). Esta lección usa una sala de clasificación donde un coordinador reparte seis carriles entre sus trabajadores: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Each lane is a partition and each worker a consumer. A worker polls a batch of up to 10 records from its lanes, works them one at a time and commits them at its next poll. Add, stop, crash or restart workers and watch the coordinator hand the lanes out again: the lamp on its booth lights while it does, and the gate drops on every lane nobody reads. Try both rebalance protocols, static ids, the session timeout and a slower downstream.",
      "Cada carril es una partición y cada trabajador, un consumidor. Un trabajador hace poll de un lote de hasta 10 registros de sus carriles, los procesa uno a la vez y los confirma (commit) en su siguiente poll. Suma, detén, tumba o reinicia trabajadores y mira cómo el coordinador reparte otra vez los carriles: la lámpara de su caseta se enciende mientras lo hace, y la barrera baja en cada carril que nadie lee. Prueba los dos protocolos de rebalanceo, los ids estáticos, el tiempo límite de sesión y un servicio de destino más lento."),
    plate: {
      title: t("Sorting hall", "Sala de clasificación"),
      keys: [
        { mark: "lit", label: t("A record being worked; a lane's gate while nobody reads it; the coordinator's lamp during a rebalance; a crashed worker, or one dropped from the group", "Un registro en proceso; la barrera de un carril mientras nadie lo lee; la lámpara del coordinador durante un rebalanceo; un trabajador caído o expulsado del grupo") },
        { mark: "raised", label: t("Records: offset on top; slips on a desk: the batch worked but not committed", "Registros: offset arriba; comprobantes en un escritorio: el lote procesado pero sin confirmar") },
        { mark: "flat", label: t("Six lanes (partitions): the topic at the back, the owner's sign at the front end", "Seis carriles (particiones): el topic atrás, el letrero del dueño en el extremo delantero") },
      ],
      caption: t(
        "Records arrive at random on all six lanes, about one a second each, and a worker does about three a second (illustrative, round numbers; the batch and the poll limit are scaled down from Kafka's defaults of 500 records and 5 minutes). The sign at the front of each lane shows the worker that owns it. A worker takes a record from one of its lanes, works it on its desk and piles the slip; the pile is its batch, worked but not committed, and it clears at the next poll. The lag counter over each lane counts its records not yet committed. The meter on a desk shows the time since its last poll against the poll limit. During a rebalance the coordinator's lamp lights and a gate drops on every lane that has stopped; the dial on the booth runs a silent worker's session down. Workers outside the group wait on the bench.",
        "Los registros llegan al azar a los seis carriles, cerca de uno por segundo en cada uno, y un trabajador hace unos tres por segundo (números ilustrativos y redondos; el lote y el límite de poll están reducidos a escala desde los valores por defecto de Kafka, 500 registros y 5 minutos). El letrero al frente de cada carril muestra al trabajador dueño. Un trabajador toma un registro de uno de sus carriles, lo procesa en su escritorio y apila el comprobante; la pila es su lote, procesado pero sin confirmar, y se vacía en el siguiente poll. El contador de lag sobre cada carril cuenta sus registros todavía sin confirmar. El medidor de un escritorio muestra el tiempo desde su último poll contra el límite de poll. Durante un rebalanceo se enciende la lámpara del coordinador y baja una barrera en cada carril detenido; el dial de la caseta descuenta la sesión de un trabajador que se quedó callado. Los trabajadores fuera del grupo esperan en la banca.",
      ),
      stage: { "data-hall": "" },
      label: t("Consumer group simulation. Space pauses or resumes.", "Simulación de un grupo de consumidores. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [["lag", "Lag"], ["rate", t("Committed /s", "Confirmados/s")], ["rebalances", t("Rebalances", "Rebalanceos")], ["stopped", t("Lanes stopped", "Carriles detenidos")], ["twice", t("Done twice", "Hechos dos veces")], ["members", t("In the group", "En el grupo")]],
    controls: [
      { seg: "workers", label: t("Workers at the start", "Trabajadores al inicio"), options: [[2, "2"], [3, "3"], [4, "4"], [6, "6"]], value: 3 },
      { seg: "rate", label: t("Records arriving", "Registros que llegan"), options: [[6, "6/s"], [12, "12/s"]], value: 6 },
      { seg: "protocol", label: t("Rebalance", "Rebalanceo"), options: [["eager", t("Eager (all stop)", "Eager (todos paran)")], ["coop", t("Cooperative", "Cooperativo")]], value: "eager" },
      { seg: "members", label: t("Members", "Miembros"), options: [["dynamic", t("Dynamic", "Dinámicos")], ["static", t("Static ids", "Ids estáticos")]], value: "dynamic" },
      { seg: "session", label: t("Session timeout", "Tiempo límite de sesión"), options: [[10, "10 s"], [45, "45 s"]], value: 45 },
      { seg: "pollLimit", label: t("Poll limit", "Límite de poll"), options: [[10, "10 s"], [60, "60 s"]], value: 10 },
      { seg: "slow", label: t("Work per record", "Trabajo por registro"), options: [[1, t("Normal", "Normal")], [4, t("4× slower", "4× más lento")]], value: 1 },
      { speed: true },
      { actions: [["add", t("Add a worker", "Sumar un trabajador"), { primary: true }], ["remove", t("Stop a worker", "Detener un trabajador")], ["crash", t("Crash a worker", "Tumbar un trabajador")], ["rolling", t("Rolling restart", "Reinicio escalonado")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Batches of 10 records; a restart keeps a worker down 8 s; the coordinator takes 1 s to hand the lanes out once everyone has joined. Changing a setting starts the run again.", "Lotes de 10 registros; un reinicio deja a un trabajador fuera 8 s; el coordinador tarda 1 s en repartir los carriles cuando todos entraron. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
${FIGURE_CSS}
.iso-stage [data-layer] text{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    RECORD_SVG: recordSvg(),
  },
});
