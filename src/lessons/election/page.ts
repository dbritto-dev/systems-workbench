// @ts-nocheck: content in the style of the other lessons
// Systems lesson 63 · Leader election: five signal towers that elect a leader by majority vote, Raft-style.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, n0, one, msFromSecs } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, ballSvg, ballotSvg, writeSvg, P, GEOMETRY } from "./figure";
import { cutRun, failoverRun, sizeRun, soloRun, CUT, SOLO, FAILOVERS, SEEDS, GIVE_UP, FIXED, ELECTION, HEARTBEAT, DELAY, RATE, CLIENT_TIMEOUT, NOISE } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each).
const R = {
  cut: cutRun("majority"),
  takeover: cutRun("takeover"),
  random: failoverRun("random"),
  fixed: failoverRun("fixed"),
  size: Object.fromEntries([3, 4, 5].map((n) => [n, { one: sizeRun(n, 1), two: sizeRun(n, 2), cut: sizeRun(n, 0, true) }])),
  off: soloRun(false),
  on: soloRun(true),
};

const ms = (x) => msFromSecs(x);
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const range = ([a, b]) => Math.round(1000 * a) + "–" + Math.round(1000 * (a + b)) + " ms";
const ELECTION_RANGE = range(ELECTION);
const DELAY_RANGE = range(DELAY);
const FIXED_MS = Math.round(1000 * FIXED) + " ms";
const NOISE_MS = Math.round(1000 * NOISE) + " ms";
const CRASHES = SEEDS.length * FAILOVERS;
const slow = (x) => (x >= GIVE_UP ? "> " + GIVE_UP + " s" : x < 1 ? ms(x) : x.toFixed(1) + " s");

// What each card shows after a run.
const RUNS = {
  cut: () => {
    const c = R.cut, m = top(c.writes);
    return {
      verdict: t("During the " + CUT.len + " s cut, the C D E side had a new leader " + ms(c.failover) + " in and acknowledged " + n0(c.right) + " writes. A, still leading term 1 in its own eyes, acknowledged " + n0(c.left) + "; the " + n0(c.dropped) + " entries it had taken were dropped at the heal. Acknowledged writes lost: " + n0(c.lost) + ".",
        "Durante los " + CUT.len + " s de corte, el lado C D E tuvo una líder nueva a los " + ms(c.failover) + " y confirmó " + n0(c.right) + " escrituras. A, que seguía liderando el mandato 1 según ella, confirmó " + n0(c.left) + "; las " + n0(c.dropped) + " entradas que había tomado se descartaron al sanar la red. Escrituras confirmadas perdidas: " + n0(c.lost) + "."),
      bars: [
        [t("Acked on the C D E side", "Confirmadas del lado C D E"), c.right / m, n0(c.right), true],
        [t("Acked on A's side", "Confirmadas del lado de A"), c.left / m, n0(c.left)],
        [t("Taken by A, dropped at the heal", "Tomadas por A, descartadas al sanar"), c.dropped / m, n0(c.dropped)],
        [t("Acked, then lost", "Confirmadas y perdidas"), c.lost / m, n0(c.lost)],
      ],
    };
  },
  takeover: () => {
    const k = R.takeover, c = R.cut, m = top(k.left, k.right, k.lost);
    return {
      verdict: t("Taking over on silence: both sides acknowledged writes for the whole cut, " + n0(k.left) + " on A's side and " + n0(k.right) + " on the other. At the heal the higher term's log overwrote A's and B's, and " + n0(k.lost) + " acknowledged writes were lost. Majority vote, same cut: " + n0(c.lost) + ".",
        "Tomando el mando ante el silencio: los dos lados confirmaron escrituras durante todo el corte, " + n0(k.left) + " del lado de A y " + n0(k.right) + " del otro. Al sanar, el registro del mandato más alto sobrescribió los de A y B, y se perdieron " + n0(k.lost) + " escrituras confirmadas. Voto por mayoría, el mismo corte: " + n0(c.lost) + "."),
      bars: [
        [t("Acked on A's side", "Confirmadas del lado de A"), k.left / m, n0(k.left)],
        [t("Acked on the C D E side", "Confirmadas del lado C D E"), k.right / m, n0(k.right)],
        [t("Acked, then lost: take over", "Confirmadas y perdidas: tomar el mando"), k.lost / m, n0(k.lost), true],
        [t("Acked, then lost: majority", "Confirmadas y perdidas: mayoría"), c.lost / m, n0(c.lost)],
      ],
    };
  },
  fixed: () => {
    const r = R.random, f = R.fixed;
    const share = (x) => Math.min(1, x / GIVE_UP), mr = top(f.rounds, r.rounds);
    return {
      verdict: t("Random timeouts: a new leader " + ms(r.p50) + " after the crash at the median, " + ms(r.p95) + " at p95, after " + one(r.rounds) + " terms on average. Fixed " + FIXED_MS + ": " + pct(f.gaveUp) + " of the " + CRASHES + " crashes still had no leader after " + GIVE_UP + " s, after " + n0(f.rounds) + " terms on average.",
        "Tiempos límite al azar: una líder nueva " + ms(r.p50) + " después de la caída en la mediana y " + ms(r.p95) + " en el p95, tras " + one(r.rounds) + " mandatos en promedio. Fijo de " + FIXED_MS + ": el " + pct(f.gaveUp) + " de las " + CRASHES + " caídas seguía sin líder después de " + GIVE_UP + " s, tras " + n0(f.rounds) + " mandatos en promedio."),
      groups: [
        { title: t("Crash to new leader (scale: " + GIVE_UP + " s)", "De la caída a la líder nueva (escala: " + GIVE_UP + " s)"), bars: [
          [t("Random, median", "Al azar, mediana"), share(r.p50), ms(r.p50)],
          [t("Random, p95", "Al azar, p95"), share(r.p95), ms(r.p95)],
          [t("Fixed, median", "Fijo, mediana"), share(f.p50), slow(f.p50), true],
        ] },
        { title: t("Terms tried per crash", "Mandatos intentados por caída"), bars: [
          [t("Random", "Al azar"), r.rounds / mr, one(r.rounds)],
          [t("Fixed", "Fijo"), f.rounds / mr, n0(f.rounds), true],
        ] },
      ],
    };
  },
  size: () => {
    const s = R.size;
    const row = (key, n, after) => [t(n + " towers", n + " torres"), s[n][key].acked, pct(s[n][key].acked), after];
    return {
      verdict: t("One follower down: " + pct(s[3].one.acked) + ", " + pct(s[4].one.acked) + " and " + pct(s[5].one.acked) + " of writes acknowledged with 3, 4 and 5 towers. Two down: " + pct(s[3].two.acked) + ", " + pct(s[4].two.acked) + " and " + pct(s[5].two.acked) + ". Network cut at the fence: " + pct(s[3].cut.acked) + ", " + pct(s[4].cut.acked) + " and " + pct(s[5].cut.acked) + ".",
        "Una seguidora caída: se confirmó el " + pct(s[3].one.acked) + ", " + pct(s[4].one.acked) + " y " + pct(s[5].one.acked) + " de las escrituras con 3, 4 y 5 torres. Dos caídas: " + pct(s[3].two.acked) + ", " + pct(s[4].two.acked) + " y " + pct(s[5].two.acked) + ". Red cortada en la cerca: " + pct(s[3].cut.acked) + ", " + pct(s[4].cut.acked) + " y " + pct(s[5].cut.acked) + "."),
      groups: [
        { title: t("Writes acked, two followers down", "Escrituras confirmadas, dos seguidoras caídas"), bars: [row("two", 3), row("two", 4, true), row("two", 5)] },
        { title: t("Writes acked, network cut at the fence", "Escrituras confirmadas, red cortada en la cerca"), bars: [row("cut", 3), row("cut", 4, true), row("cut", 5)] },
      ],
    };
  },
  solo: () => {
    const { off, on } = R, mg = top(off.gap, on.gap, 0.01), mf = top(off.failed, on.failed, 1);
    return {
      verdict: t("Without Pre-Vote, E came back at term " + n0(off.eTerm) + " on average, the cluster at " + n0(off.others) + "; the leader stepped down, the cluster went " + ms(off.gap) + " without a leader and " + one(off.failed) + " writes failed in the next second. E won " + pct(off.eWon) + " of those elections. With Pre-Vote: E stayed at term " + n0(on.eTerm) + ", " + ms(on.gap) + " without a leader, " + one(on.failed) + " failed.",
        "Sin prevoto, E volvió en el mandato " + n0(off.eTerm) + " en promedio, el clúster en el " + n0(off.others) + "; la líder dejó de liderar, el clúster pasó " + ms(off.gap) + " sin líder y fallaron " + one(off.failed) + " escrituras en el segundo siguiente. E ganó el " + pct(off.eWon) + " de esas elecciones. Con prevoto: E se quedó en el mandato " + n0(on.eTerm) + ", " + ms(on.gap) + " sin líder, " + one(on.failed) + " fallidas."),
      groups: [
        { title: t("Without a leader after E is back", "Sin líder después de que E vuelve"), bars: [[t("Pre-Vote off", "Prevoto apagado"), off.gap / mg, ms(off.gap), true], [t("Pre-Vote on", "Prevoto encendido"), on.gap / mg, ms(on.gap)]] },
        { title: t("Writes failed in the next second", "Escrituras fallidas en el segundo siguiente"), bars: [[t("Pre-Vote off", "Prevoto apagado"), off.failed / mf, one(off.failed), true], [t("Pre-Vote on", "Prevoto encendido"), on.failed / mf, one(on.failed)]] },
      ],
    };
  },
};

const C = R.cut, K = R.takeover, RN = R.random, FX = R.fixed, Z = R.size, OFF = R.off, ON = R.on;

const EXPERIMENTS = [
  {
    id: "cut",
    title: t("Cut the network in two", "Cortar la red en dos"),
    change: t("Majority vote · A leads term 1 · a fence goes up between B and C for " + CUT.len + " s: A and B on one side, C, D and E on the other · clients keep writing on both sides",
      "Voto por mayoría · A lidera el mandato 1 · se levanta una cerca entre B y C durante " + CUT.len + " s: A y B de un lado, C, D y E del otro · los clientes siguen escribiendo de los dos lados"),
    question: t("While the network is cut, which writes get acknowledged?", "Mientras la red está cortada, ¿qué escrituras se confirman?"),
    options: [
      t("Writes on both sides: each side keeps or elects its own leader", "Las de los dos lados: cada lado conserva o elige su propia líder"),
      t("Only the three-tower side's, once it elects a leader; A's side waits", "Solo las del lado de tres torres, cuando elige líder; el lado de A espera"),
      t("None: the cluster refuses every write until the network heals", "Ninguna: el clúster rechaza toda escritura hasta que la red sana"),
    ],
    answer: 1,
    why: t(
      "Nothing tells A it has been replaced, so it goes on leading term 1 and taking writes from its side. But a write commits only when three of the five towers hold it, and A can reach only B: it acknowledged " + n0(C.left) + ", its clients timed out, and the " + n0(C.dropped) + " entries it had taken were thrown away when the fence came down and A saw term 2. On the other side, C, D and E stopped hearing heartbeats; the first timer to run out won three votes, and a new leader was elected " + ms(C.failover) + " after the cut; it acknowledged " + n0(C.right) + " writes. Both sides had a tower calling itself leader, but only one could commit, because any two majorities of five share at least one tower, and a tower votes once per term. Acknowledged writes lost: " + n0(C.lost) + ".",
      "Nada le avisa a A que la reemplazaron, así que sigue liderando el mandato 1 y tomando escrituras de su lado. Pero una escritura se confirma solo cuando tres de las cinco torres la tienen, y A solo llega a B: confirmó " + n0(C.left) + ", sus clientes agotaron el tiempo de espera y las " + n0(C.dropped) + " entradas que había tomado se descartaron cuando bajó la cerca y A vio el mandato 2. Del otro lado, C, D y E dejaron de oír latidos (heartbeats); el primer temporizador que se agotó ganó tres votos, y una líder nueva quedó elegida " + ms(C.failover) + " después del corte; confirmó " + n0(C.right) + " escrituras. Los dos lados tenían una torre que se creía líder, pero solo uno podía confirmar, porque dos mayorías de cinco siempre comparten al menos una torre, y una torre vota una sola vez por mandato. Escrituras confirmadas perdidas: " + n0(C.lost) + ".",
    ),
    watch: { rule: "majority", timeouts: "random", n: 5, prevote: "off", script: "cut" },
  },
  {
    id: "takeover",
    title: t("Take over on silence", "Tomar el mando ante el silencio"),
    change: t("The same " + CUT.len + " s cut · the rule changes: a tower that misses heartbeats takes over at once, with no vote, and a leader commits once every tower it can still reach holds the entry",
      "El mismo corte de " + CUT.len + " s · cambia la regla: una torre que deja de oír latidos toma el mando de inmediato, sin votación, y una líder confirma cuando todas las torres que todavía alcanza tienen la entrada"),
    question: t("When the network heals, what happens to the writes acknowledged during the cut?", "Cuando la red sana, ¿qué pasa con las escrituras confirmadas durante el corte?"),
    options: [
      t("Both sides' writes survive: the logs are merged at the heal", "Sobreviven las de los dos lados: los registros se combinan al sanar"),
      t("One side's acknowledged writes are overwritten and lost", "Las escrituras confirmadas de un lado se sobrescriben y se pierden"),
      t("Nothing is lost: A stepped down as soon as the fence went up", "No se pierde nada: A dejó de liderar apenas subió la cerca"),
    ],
    answer: 1,
    why: t(
      "Without a majority, each side looks healthy to itself. C, D and E heard nothing for one timeout and one of them took term 2 (" + ms(K.failover) + " after the cut); A still had B, so A kept committing with B. Two leaders acknowledged writes for the whole cut, " + n0(K.left) + " on A's side and " + n0(K.right) + " on the other: that is split brain. When the fence came down, A saw term 2 and stepped down, and the term-2 log overwrote A's and B's. A replicated log can't merge the two, because both sides put different writes in the same positions: " + n0(K.lost) + " writes that clients had been told were saved disappeared. With the majority rule, the same cut lost " + n0(C.lost) + ".",
      "Sin mayoría, cada lado se ve sano a sí mismo. C, D y E no oyeron nada durante un tiempo límite y una de ellas tomó el mandato 2 (" + ms(K.failover) + " después del corte); A todavía tenía a B, así que A siguió confirmando con B. Dos líderes confirmaron escrituras durante todo el corte, " + n0(K.left) + " del lado de A y " + n0(K.right) + " del otro: eso es el cerebro dividido (split brain). Cuando bajó la cerca, A vio el mandato 2 y dejó de liderar, y el registro del mandato 2 sobrescribió los de A y B. Un registro replicado no puede combinar los dos, porque cada lado puso escrituras distintas en las mismas posiciones: desaparecieron " + n0(K.lost) + " escrituras que a los clientes se les había dicho que estaban guardadas. Con la regla de mayoría, el mismo corte perdió " + n0(C.lost) + ".",
    ),
    watch: { rule: "takeover", timeouts: "random", n: 5, prevote: "off", script: "cut" },
  },
  {
    id: "fixed",
    title: t("Everyone waits the same", "Todas esperan lo mismo"),
    change: t("Majority vote · the leader crashes · every election timeout is a fixed " + FIXED_MS + " (timers still fire up to " + NOISE_MS + " late) vs drawn at random between " + ELECTION_RANGE + " · " + CRASHES + " crashes each",
      "Voto por mayoría · la líder se cae · todos los tiempos límite de elección son de " + FIXED_MS + " fijos (los temporizadores igual se disparan hasta " + NOISE_MS + " tarde) vs sorteados entre " + ELECTION_RANGE + " · " + CRASHES + " caídas en cada caso"),
    question: t("With the fixed timeout, how long until the cluster has a new leader?", "Con el tiempo límite fijo, ¿cuánto tarda el clúster en tener una líder nueva?"),
    options: [
      t("About one timeout: the first tower to run out wins", "Más o menos un tiempo límite: gana la primera torre que se agota"),
      t("Less than with random ones: no tower waits longer than it must", "Menos que al azar: ninguna torre espera más de lo necesario"),
      t("Seconds or longer: the towers keep splitting the vote", "Segundos o más: las torres siguen dividiendo el voto"),
    ],
    answer: 2,
    why: t(
      "The followers heard the last heartbeat within a few milliseconds of each other, so with the same timeout they all run out together: each votes for itself and asks the others, who have already voted. No one reaches three votes, the term ends without a leader (a split vote), and since every timer restarts at the same length, the next term splits the same way. Only the " + NOISE_MS + " of timer noise slowly pulls them apart: " + pct(FX.gaveUp) + " of crashes still had no leader after " + GIVE_UP + " s. With random timeouts one tower usually runs out first and collects its votes before the others wake: " + ms(RN.p50) + " at the median, " + ms(RN.p95) + " at p95. That is why Raft draws every timeout from a range (the paper's example is 150–300 ms) instead of using one value.",
      "Las seguidoras oyeron el último latido con pocos milisegundos de diferencia, así que con el mismo tiempo límite se agotan todas juntas: cada una vota por sí misma y les pide el voto a las demás, que ya votaron. Nadie llega a tres votos, el mandato termina sin líder (un voto dividido, split vote) y, como cada temporizador vuelve a empezar con la misma duración, el mandato siguiente se divide igual. Solo los " + NOISE_MS + " de ruido de los temporizadores las separan, poco a poco: el " + pct(FX.gaveUp) + " de las caídas seguía sin líder después de " + GIVE_UP + " s. Con tiempos límite al azar, casi siempre una torre se agota primero y junta sus votos antes de que las demás despierten: " + ms(RN.p50) + " en la mediana, " + ms(RN.p95) + " en el p95. Por eso Raft sortea cada tiempo límite dentro de un rango (el ejemplo del artículo es 150–300 ms) en lugar de usar un solo valor.",
    ),
    watch: { rule: "majority", timeouts: "fixed", n: 5, prevote: "off", script: "crash" },
  },
  {
    id: "size",
    title: t("Add a fourth tower", "Agregar una cuarta torre"),
    change: t("Majority vote · 3 towers (A, C, E), 4 (A, B, D, E) or 5 · then crash one follower, or two, or cut the network at the fence between B and C",
      "Voto por mayoría · 3 torres (A, C, E), 4 (A, B, D, E) o 5 · después se tumba una seguidora, o dos, o se corta la red en la cerca entre B y C"),
    question: t("How many crashed towers can four towers survive and still acknowledge writes?", "¿Cuántas torres caídas aguantan cuatro torres sin dejar de confirmar escrituras?"),
    options: [
      t("Two: half of the towers is still enough", "Dos: la mitad de las torres todavía alcanza"),
      t("One, the same as three towers", "Una, lo mismo que tres torres"),
      t("Two, but every write takes a little longer", "Dos, pero cada escritura tarda un poco más"),
    ],
    answer: 1,
    why: t(
      "A majority of 4 is 3. With two down, the two left can't commit anything: " + pct(Z[4].two.acked) + " of writes acknowledged, the same as three towers with two down (" + pct(Z[3].two.acked) + "), while five survive two (" + pct(Z[5].two.acked) + "). A cluster of 2f + 1 tolerates f failures; the fourth tower is one more machine that can fail and one more vote to wait for, not one more failure it survives. An even count also splits evenly: cut A B | D E and neither side has 3 of 4, so nothing commits (" + pct(Z[4].cut.acked) + "), while three towers cut A | C E keep going on the C E side (" + pct(Z[3].cut.acked) + ", the writes that reached C or E). That is why etcd, Consul and ZooKeeper are run with 3 or 5 voting members.",
      "La mayoría de 4 es 3. Con dos caídas, las dos que quedan no pueden confirmar nada: se confirmó el " + pct(Z[4].two.acked) + " de las escrituras, lo mismo que tres torres con dos caídas (" + pct(Z[3].two.acked) + "), mientras que cinco aguantan dos (" + pct(Z[5].two.acked) + "). Un clúster de 2f + 1 tolera f fallas; la cuarta torre es una máquina más que puede fallar y un voto más que esperar, no una falla más que aguanta. Un número par además se divide parejo: con el corte A B | D E ningún lado tiene 3 de 4, así que nada se confirma (" + pct(Z[4].cut.acked) + "), mientras que tres torres cortadas A | C E siguen funcionando del lado C E (" + pct(Z[3].cut.acked) + ", las escrituras que llegaron a C o a E). Por eso etcd, Consul y ZooKeeper se corren con 3 o 5 miembros con voto.",
    ),
    watch: { rule: "majority", timeouts: "random", n: 4, prevote: "off", script: "crash2" },
  },
  {
    id: "solo",
    title: t("A tower comes back", "Una torre vuelve"),
    change: t("Majority vote · E is fenced off alone for " + SOLO.len + " s, then the fence comes down · Pre-Vote off vs on",
      "Voto por mayoría · E queda aislada detrás de una cerca durante " + SOLO.len + " s, y después la cerca baja · prevoto (Pre-Vote) apagado vs encendido"),
    question: t("Without Pre-Vote, what does E do to the healthy cluster when it comes back?", "Sin prevoto, ¿qué le hace E al clúster sano cuando vuelve?"),
    options: [
      t("Nothing: it catches up quietly as a follower", "Nada: se pone al día en silencio como seguidora"),
      t("It makes the leader step down and forces an election", "Hace que la líder deje de liderar y fuerza una elección"),
      t("It takes over as leader: its term is the highest", "Toma el mando como líder: su mandato es el más alto"),
    ],
    answer: 1,
    why: t(
      "Alone, E kept timing out and starting elections no one could hear, moving to a new term each time: it came back at term " + n0(OFF.eTerm) + " while the cluster was still at " + n0(OFF.others) + ". A higher term always wins an argument in Raft, so the first message E sent or answered made the leader step down: " + ms(OFF.gap) + " without a leader and " + one(OFF.failed) + " failed writes, for nothing. E itself never won (" + pct(OFF.eWon) + "): the others refused it their votes because its log was behind, so one of them led the next term. Pre-Vote (from Raft's dissertation, on by default in etcd) has a tower ask first whether it could win; the others say no while they still hear a leader, so E never raised its term and rejoined quietly (" + ms(ON.gap) + " without a leader).",
      "Sola, E siguió agotando su tiempo y empezando elecciones que nadie oía, pasando a un mandato nuevo cada vez: volvió en el mandato " + n0(OFF.eTerm) + " mientras el clúster seguía en el " + n0(OFF.others) + ". En Raft un mandato más alto siempre se impone, así que el primer mensaje que E envió o respondió hizo que la líder dejara de liderar: " + ms(OFF.gap) + " sin líder y " + one(OFF.failed) + " escrituras fallidas, para nada. E nunca ganó (" + pct(OFF.eWon) + "): las demás le negaron el voto porque su registro estaba atrasado, así que una de ellas lideró el mandato siguiente. El prevoto (Pre-Vote, de la tesis de Raft, encendido por defecto en etcd) hace que una torre pregunte primero si podría ganar; las demás dicen que no mientras todavía oyen a una líder, así que E nunca subió su mandato y volvió en silencio (" + ms(ON.gap) + " sin líder).",
    ),
    watch: { rule: "majority", timeouts: "random", n: 5, prevote: "off", script: "solo" },
  },
];

const QUESTIONS = [
  [t("Why does Raft need a majority both to elect a leader and to commit a write, and what does that cost?", "¿Por qué Raft necesita una mayoría tanto para elegir líder como para confirmar una escritura, y qué cuesta eso?"),
   t("Any two majorities of the same cluster share at least one member, and a member votes once per term, so a term has at most one leader. A write committed on a majority is held by at least one member of every future majority, and voters refuse a candidate whose log is less up to date, so every later leader has every committed write. The cost: a side without a majority can't elect or commit at all during a partition (Raft chooses consistency over availability there), and every write waits for the majority's round trip.",
     "Dos mayorías cualesquiera del mismo clúster comparten al menos un miembro, y un miembro vota una sola vez por mandato, así que un mandato tiene a lo sumo una líder. Una escritura confirmada en una mayoría está en al menos un miembro de cada mayoría futura, y los votantes rechazan a una candidata con un registro menos actualizado, así que toda líder posterior tiene todas las escrituras confirmadas. El costo: un lado sin mayoría no puede elegir ni confirmar nada durante una partición (ahí Raft elige consistencia por sobre disponibilidad), y cada escritura espera la ida y vuelta de la mayoría.")],
  [t("During a partition, the old leader on the minority side still believes it leads. Why is that harmless for writes, and when isn't it harmless?", "Durante una partición, la líder vieja del lado de la minoría todavía cree que lidera. ¿Por qué eso no daña las escrituras, y cuándo sí hace daño?"),
   t("It can't commit, so its writes time out and are later thrown away; no client was told they were saved. It is harmful when it answers reads from its own state (they can be stale: Raft systems confirm leadership with a majority before a linearizable read, as etcd's ReadIndex does, or rely on a time-bounded lease), and when it acts outside the log, writing to a database or calling another service: that needs fencing tokens checked by the resource (lesson 62, Leases & Fencing Tokens). Many implementations also step a leader down when it hasn't heard from a majority for an election timeout (CheckQuorum in etcd's Raft library).",
     "No puede confirmar, así que sus escrituras agotan el tiempo de espera y después se descartan; a ningún cliente se le dijo que estaban guardadas. Hace daño cuando responde lecturas desde su propio estado (pueden estar viejas: los sistemas con Raft confirman su liderazgo con una mayoría antes de una lectura linealizable, como hace ReadIndex en etcd, o se apoyan en un arrendamiento acotado en el tiempo), y cuando actúa fuera del registro, escribiendo en una base de datos o llamando a otro servicio: eso necesita tokens de cerco que verifique el recurso (lección 62, Arrendamientos y tokens de cerco). Muchas implementaciones además hacen que una líder deje de liderar si no oye a una mayoría durante un tiempo límite de elección (CheckQuorum en la biblioteca de Raft de etcd).")],
  [t("What is a term, and why does every Raft message carry one?", "¿Qué es un mandato (term) y por qué cada mensaje de Raft lleva uno?"),
   t("A term is a number that only goes up: every election starts a new one, and each term has at most one leader. Carrying it on every message lets any server spot stale information: a message with a lower term is rejected, and one with a higher term makes the receiver adopt that term and step down to follower. That's how a replaced leader finds out it was replaced the moment it talks to anyone, and also why a node that bumped its term alone in a partition disrupts the cluster when it returns, unless Pre-Vote stops it.",
     "Un mandato es un número que solo sube: cada elección empieza uno nuevo, y cada mandato tiene a lo sumo una líder. Llevarlo en cada mensaje permite que cualquier servidor detecte información vieja: un mensaje con un mandato más bajo se rechaza, y uno con un mandato más alto hace que quien lo recibe adopte ese mandato y pase a seguidora. Así una líder reemplazada se entera apenas habla con alguien, y también por eso un nodo que subió su mandato solo durante una partición desordena el clúster cuando vuelve, a menos que el prevoto lo impida.")],
  [t("How do you choose the election timeout?", "¿Cómo eliges el tiempo límite de elección?"),
   t("Much longer than the heartbeat interval and the round trip between members, so that a heartbeat or two delayed by the network, a GC pause or a slow disk write doesn't start a needless election, and short enough that failover is quick. Draw it from a range so that timers rarely run out together. etcd's defaults are a 100 ms heartbeat and a 1,000 ms election timeout, and its docs say to tune them to the measured round trip. The same trade-off between false alarms and slow detection is the subject of lesson 19, Gossip protocols; in Raft, every false alarm also costs an election with no leader.",
     "Mucho más largo que el intervalo de latidos y que la ida y vuelta entre miembros, para que uno o dos latidos demorados por la red, una pausa de GC o una escritura lenta a disco no inicien una elección innecesaria, y lo bastante corto para que el relevo sea rápido. Sortéalo dentro de un rango para que los temporizadores casi nunca se agoten juntos. Los valores por defecto de etcd son un latido de 100 ms y un tiempo límite de elección de 1,000 ms, y su documentación indica ajustarlos a la ida y vuelta medida. El mismo equilibrio entre falsas alarmas y detección lenta es el tema de la lección 19, Protocolos de gossip; en Raft, cada falsa alarma además cuesta una elección sin líder.")],
  [t("Why do clusters run 3 or 5 voting members rather than 4, 6 or 9?", "¿Por qué los clústeres corren 3 o 5 miembros con voto y no 4, 6 o 9?"),
   t("2f + 1 members tolerate f failures, so an even count adds a machine without adding tolerance (4 survives one, like 3) and can split into two halves with no majority. Larger clusters tolerate more but make every write wait for more acknowledgements and send more heartbeats. Five is common because it survives one planned and one unplanned outage at once. To scale reads, systems add members that replicate without voting, such as ZooKeeper observers.",
     "2f + 1 miembros toleran f fallas, así que un número par agrega una máquina sin agregar tolerancia (4 aguanta una, como 3) y puede partirse en dos mitades sin mayoría. Los clústeres más grandes toleran más, pero cada escritura espera más confirmaciones y se mandan más latidos. Cinco es común porque aguanta a la vez una caída planificada y una inesperada. Para escalar lecturas, los sistemas agregan miembros que replican sin votar, como los observers de ZooKeeper.")],
  [t("A primary database and its replica use \"if the primary misses heartbeats, the replica promotes itself\". What goes wrong, and how do real setups avoid it?", "Una base de datos primaria y su réplica usan \"si la primaria deja de mandar latidos, la réplica se promueve\". ¿Qué sale mal y cómo lo evitan las instalaciones reales?"),
   t("A network split between them makes both primaries: each keeps accepting writes, and when the link returns one side's writes are lost or need manual reconciliation (split brain). Two nodes can't form a majority on their own, so real setups let a third party decide: a consensus store holding a leader key with a lease (Patroni keeps it in etcd, Consul or ZooKeeper for PostgreSQL), or a witness or arbiter node that breaks the tie. They also stop the old primary from writing: it demotes itself when it can't renew the lease, and fencing (lesson 62) or STONITH shuts it out if it doesn't.",
     "Una partición de red entre las dos las convierte en dos primarias: cada una sigue aceptando escrituras, y cuando vuelve el enlace las escrituras de un lado se pierden o hay que reconciliarlas a mano (cerebro dividido). Dos nodos no pueden formar una mayoría por sí solos, así que las instalaciones reales dejan que decida un tercero: un almacén de consenso que guarda una clave de líder con un arrendamiento (Patroni la guarda en etcd, Consul o ZooKeeper para PostgreSQL), o un nodo testigo o árbitro que desempata. Además impiden que la primaria vieja escriba: se degrada sola cuando no puede renovar el arrendamiento, y el cerco (lección 62) o STONITH la dejan afuera si no lo hace.")],
];

export default defineLesson({
  title: t("Leader Election Workbench", "Banco de trabajo: elección de líder"),
  eyebrow: t("Systems lesson 63 · Leader election", "Lección de sistemas 63 · Elección de líder"),
  lede: t("Leader election lets a cluster agree on one node to take the writes, and replace it when it fails. Noticing that the leader is gone is the easy part; the hard part is making sure two nodes can't both act as leader when the network splits. This lesson turns Raft's election into five signal towers that vote by majority: watch it, predict what breaks it, then explain it back.",
    "La elección de líder permite que un clúster se ponga de acuerdo en un nodo que reciba las escrituras, y que lo reemplace cuando falla. Notar que la líder ya no está es lo fácil; lo difícil es asegurar que dos nodos no puedan actuar como líder a la vez cuando la red se parte. Esta lección convierte la elección de Raft en cinco torres de señales que votan por mayoría: mírala, predice qué la rompe y después explícala."),
  machine: {
    intro: t("A leads term 1 and sends heartbeats to the other towers. Each follower's dial is its election timer: a heartbeat sends the needle back to zero, and if the needle comes all the way round, the tower becomes a candidate for the next term and asks for votes. A majority of votes makes it the leader. Clients send writes to any tower they can reach; a write is acknowledged once a majority holds it. Cut the network, crash towers, change the rule or the timeouts.",
      "A lidera el mandato 1 y les manda latidos (heartbeats) a las demás torres. El dial de cada seguidora es su temporizador de elección: un latido devuelve la aguja a cero, y si la aguja da toda la vuelta, la torre se vuelve candidata para el mandato siguiente y pide votos. Una mayoría de votos la convierte en líder. Los clientes mandan escrituras a cualquier torre que alcancen; una escritura se confirma cuando la tiene una mayoría. Corta la red, tumba torres, cambia la regla o los tiempos límite."),
    plate: {
      title: t("Signal towers", "Torres de señales"),
      keys: [
        { mark: "lit", label: t("The leader's pennant; a granted vote", "El banderín de la líder; un voto concedido") },
        { mark: "raised", label: t("Log tiles: the term that wrote each entry, solid once committed; +N, the older entries", "Fichas del registro: el mandato que escribió cada entrada, sólida cuando se confirmó; +N, las entradas anteriores") },
        { mark: "flat", label: t("Fence: messages can't cross it", "Cerca: los mensajes no la cruzan") },
      ],
      caption: t(
        "Played at 1/20 of real speed (change it under Speed). The numbers are illustrative and round: a message takes " + DELAY_RANGE + " one way, the leader sends heartbeats every " + Math.round(1000 * HEARTBEAT) + " ms, an election timeout is drawn between " + ELECTION_RANGE + ", and clients send about " + RATE + " writes a second, giving up after " + Math.round(1000 * CLIENT_TIMEOUT) + " ms. Balls are heartbeats and their replies; ballots are vote requests, lit when the vote is granted; small cubes are writes on their way to a tower. The board counts writes acknowledged (ACKED), failed (FAILED), and acknowledged but later overwritten (LOST).",
        "Se reproduce a 1/20 de la velocidad real (cámbiala en Velocidad). Las cifras son ilustrativas y redondas: un mensaje tarda " + DELAY_RANGE + " de ida, la líder manda latidos cada " + Math.round(1000 * HEARTBEAT) + " ms, el tiempo límite de elección se sortea entre " + ELECTION_RANGE + " y los clientes mandan unas " + RATE + " escrituras por segundo y se rinden a los " + Math.round(1000 * CLIENT_TIMEOUT) + " ms. Las bolas son latidos y sus respuestas; las boletas son pedidos de voto, encendidas cuando se concede el voto; los cubitos son escrituras en camino a una torre. El tablero cuenta las escrituras confirmadas (CONFIRMADAS), fallidas (FALLIDAS), y confirmadas pero después sobrescritas (PERDIDAS).",
      ),
      stage: { "data-towers": "" },
      label: t("Leader election simulation. Space pauses or resumes.", "Simulación de elección de líder. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["leader", t("Leader", "Líder"), "A"],
      ["term", t("Highest term", "Mandato más alto"), "1"],
      ["elections", t("Elections", "Elecciones"), "0"],
      ["acked", t("Acked", "Confirmadas"), "0"],
      ["failed", t("Failed", "Fallidas"), "0"],
      ["lost", t("Acked, then lost", "Confirmadas y perdidas"), "0"],
    ],
    controls: [
      { seg: "rule", label: t("Rule", "Regla"), options: [["majority", t("Majority vote", "Voto por mayoría")], ["takeover", t("Take over on silence", "Tomar el mando ante el silencio")]], value: "majority" },
      { seg: "net", label: t("Network", "Red"), options: [["whole", t("Whole", "Completa")], ["cut", t("Cut A B | C D E", "Corte A B | C D E")], ["solo", t("E alone", "E aislada")]], value: "whole" },
      { seg: "timeouts", label: t("Election timeout", "Tiempo límite de elección"), options: [["random", t("Random " + ELECTION_RANGE, "Al azar " + ELECTION_RANGE)], ["fixed", t("Fixed " + FIXED_MS, "Fijo " + FIXED_MS)]], value: "random" },
      { seg: "n", label: t("Towers", "Torres"), options: [[3, "3"], [4, "4"], [5, "5"]], value: 5 },
      { seg: "prevote", label: t("Pre-Vote", "Prevoto"), options: [["off", t("Off", "Apagado")], ["on", t("On", "Encendido")]], value: "off" },
      { speed: true, options: [[0.02, "1/50"], [0.05, "1/20"], [0.1, "1/10"]], value: 0.05 },
      { actions: [["crash", t("Crash the leader", "Tumbar a la líder"), { primary: true }], ["crashFollower", t("Crash a follower", "Tumbar una seguidora")], ["restart", t("Restart towers", "Levantar las torres")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The network changes at once; changing the rule, the timeout, the towers or Pre-Vote starts the run again. With 3 towers the cluster is A, C and E; with 4, A, B, D and E. A crashed tower keeps its term and its log, as Raft keeps them on disk.",
      "La red cambia al instante; cambiar la regla, el tiempo límite, las torres o el prevoto reinicia la ejecución. Con 3 torres el clúster es A, C y E; con 4, A, B, D y E. Una torre caída conserva su mandato y su registro, como Raft los guarda en disco."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson, following Raft (Ongaro and Ousterhout, 2014) without log compaction or membership changes.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección, según Raft (Ongaro y Ousterhout, 2014), sin compactación del registro ni cambios de membresía.`),
  css: LIT_FILL_CSS + `
[data-tower] [data-role-word],[data-tower] [data-flag]{display:none}
[data-tower][data-role="leader"] [data-role-word="leader"],[data-tower][data-role="candidate"] [data-role-word="candidate"],[data-tower][data-role="follower"] [data-role-word="follower"],[data-tower][data-role="down"] [data-role-word="down"]{display:inline}
[data-tower][data-role="leader"] [data-flag="lit"],[data-tower][data-role="candidate"] [data-flag="plain"]{display:inline}
[data-tower][data-role="down"] .iso-top,[data-tower][data-role="down"] .iso-shade,[data-tower][data-role="down"] .iso-fill{fill:var(--anatomy-faint)}
[data-tower][data-role="down"] .wb-needle{display:none}
[data-tower][data-off]{display:none}
[data-tile] [data-v]{display:none}
[data-tile][data-state="commit"] [data-v="commit"],[data-tile][data-state="pending"] [data-v="pending"]{display:inline}
[data-tile-text]{font-weight:600}
`,
  data: { P, G: GEOMETRY, BALL: ballSvg(2.3, "hi"), REPLY: ballSvg(1.5, "mid"), BALLOT: ballotSvg(false), WRITE: writeSvg() },
});
