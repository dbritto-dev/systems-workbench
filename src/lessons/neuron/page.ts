// @ts-nocheck: content in the style of the other lessons
// Systems lesson 85 · Neuron: one neuron doing a real AI job, sorting animals into CAT or DOG from two clues (how heavy,
// and pointy or floppy ears). The machine is a rolling board: each animal rolls down the middle line, three kickers
// push it sideways by how much each clue counts, and which side of the line it ends on decides its pen. Written for
// someone who has never programmed and never heard of a neuron.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { figures, FIG_CSS } from "./figure";
import { bestCut, handRun, learnRun, unscaledRun, rightOf, SETS, RANGE, ROUNDS, SEEDS } from "./sim";

// Results, worked out at build time from the same model the machine runs.
const N = SETS.easy.length, NH = SETS.hard.length;                       // 8 and 10 animals
const ONE = { kg: bestCut("easy", { ears: false }), ears: bestCut("easy", { kg: false }), both: bestCut("easy") };
const H = handRun("easy"), H0 = handRun("easy", false), HH = handRun("hard");   // every setting the steppers reach
const NOLEAN = bestCut("easy", { lean: false });
const L = learnRun("easy"), L0 = learnRun("easy", false), LH = learnRun("hard");  // trained from 0, 8 runs each
const U = unscaledRun("easy");                                            // the same, reading plain kg
// experiment 2's four settings: [10 kg (tenths), floppy ears, lean]
const OPTS = [[10, 1, -1], [30, 1, -2], [10, 1, 0], [50, 0, -2]];
const OPT_RIGHT = OPTS.map(([w10, ears, lean]) => rightOf({ w10, ears, lean }, "easy"));
// The texts below say "only", "every" and "never"; stop the build if the model stops bearing that out.
const need = (ok, what) => { if (!ok) throw new Error("neuron/page.ts: the model no longer gives " + what); };
need(ONE.kg === N - 1 && ONE.ears === N - 2 && ONE.both === N, "experiment 1's outcome");
need(OPT_RIGHT.filter((r) => r === N).length === 1 && OPT_RIGHT[1] === N && H.works.every(([kg, ears, lean]) => kg >= 1.5 && ears >= 1 && lean < 0 && lean >= -3), "experiment 2's outcome");
need(H0.all === 0 && H0.best === N - 2 && NOLEAN === N - 2 && L0.settled === 0, "experiment 3's outcome");
need(L.settled === 1 && L.right === N && L.mistakesMax < 15 && U.mistakes > 3 * L.mistakes, "experiment 4's outcome");
need(HH.all === 0 && HH.best === NH - 2 && bestCut("hard") === NH - 2 && LH.settled === 0, "experiment 5's outcome");
need([L, L0, LH].every((r) => r.peak.kg <= RANGE.kg.max && r.peak.ears <= RANGE.ears.max && r.peak.lean <= RANGE.lean.max), "training staying within the steppers' range");

const n1 = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1));
const of = (a, b) => t(`${a} of ${b}`, `${a} de ${b}`);
const sg = (v, d = 0) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
// a setting in the board's order: the lean, then 10 kg, then ears
const setting = ([w10, ears, lean]) => t(`lean ${sg(lean)}, 10 kg ${sg(w10 / 10, 1)}, ears ${sg(ears)}`, `tendencia ${sg(lean)}, 10 kg ${sg(w10 / 10, 1)}, orejas ${sg(ears)}`);

// What each card shows after a run.
const RUNS = {
  clues: () => ({
    verdict: t(`The best the board can do with the 10 kg kicker alone is ${ONE.kg} of ${N}, and with the ears kicker alone ${ONE.ears} of ${N}. With both clues, it sorts all ${N}.`,
      `Lo mejor que logra el tablero solo con el empujador de 10 kg es ${ONE.kg} de ${N}, y solo con el de las orejas ${ONE.ears} de ${N}. Con las dos pistas, separa los ${N}.`),
    groups: [{ title: t(`Most of the ${N} animals sorted right, with the best setting`, `Más de los ${N} animales bien separados, con el mejor ajuste`), bars: [
      [t("10 kg only", "Solo 10 kg"), ONE.kg / N, of(ONE.kg, N), true],
      [t("Ears only", "Solo las orejas"), ONE.ears / N, of(ONE.ears, N), true],
      [t("Both clues", "Las dos pistas"), ONE.both / N, of(ONE.both, N)],
    ] }],
  }),
  dials: () => ({
    verdict: t(`Only ${setting(OPTS[1]).en} sorts all ${N}. Of all ${H.settings.toLocaleString("en")} settings the three steppers can make, ${H.all} do, and in every one of them 10 kg counts at least +1.5, floppy ears at least +1, and the lean is between −1 and −3.`,
      `Solo ${setting(OPTS[1]).es} separa los ${N}. De los ${H.settings.toLocaleString("en")} ajustes que permiten los tres controles, ${H.all} lo logran, y en todos 10 kg cuenta al menos +1.5, las orejas caídas al menos +1 y la tendencia está entre −1 y −3.`),
    groups: [{ title: t(`Animals sorted right, of ${N}`, `Animales bien separados, de ${N}`), bars: OPTS.map((o, i) => [setting(o), OPT_RIGHT[i] / N, of(OPT_RIGHT[i], N), OPT_RIGHT[i] < N]) }],
  }),
  lean: () => ({
    verdict: t(`With the lean taken away, none of the ${H0.settings} settings sorts all ${N}: the best get ${H0.best}. With it, ${H.all} settings do. Trained for ${ROUNDS} rounds without the lean, no run ever settled: they ended at ${n1(L0.right)} of ${N} on average and were still making about ${n1(L0.lastTen / 10)} mistakes a round.`,
      `Sin la tendencia, ninguno de los ${H0.settings} ajustes separa los ${N}: los mejores aciertan ${H0.best}. Con ella, ${H.all} ajustes lo logran. Entrenado ${ROUNDS} vueltas sin tendencia, ninguna ejecución se asentó: terminaron en ${n1(L0.right)} de ${N} en promedio y todavía cometían unos ${n1(L0.lastTen / 10)} errores por vuelta.`),
    groups: [
      { title: t(`Most sorted right by hand, of ${N}`, `Más bien separados a mano, de ${N}`), bars: [[t("With the lean", "Con tendencia"), H.best / N, of(H.best, N)], [t("Without it", "Sin ella"), H0.best / N, of(H0.best, N), true]] },
      { title: t(`Sorted right after ${ROUNDS} rounds of training (average of ${SEEDS.length} runs)`, `Bien separados tras ${ROUNDS} vueltas de entrenamiento (promedio de ${SEEDS.length} ejecuciones)`), bars: [[t("With the lean", "Con tendencia"), L.right / N, of(n1(L.right), N)], [t("Without it", "Sin ella"), L0.right / N, of(n1(L0.right), N), true]] },
    ],
  }),
  learn: () => ({
    verdict: t(`Every run sorted all ${N} after ${n1(L.mistakes)} mistakes on average (${L.mistakesMin} to ${L.mistakesMax}), within ${L.roundsMax} rounds, and then never changed again. Reading plain kg instead of tens of kg, the same training took ${n1(U.mistakes)} mistakes on average.`,
      `Todas las ejecuciones separaron los ${N} tras ${n1(L.mistakes)} errores en promedio (de ${L.mistakesMin} a ${L.mistakesMax}), en ${L.roundsMax} vueltas o menos, y después no cambiaron más. Leyendo kilos en vez de decenas de kilos, el mismo entrenamiento tomó ${n1(U.mistakes)} errores en promedio.`),
    groups: [{ title: t(`Mistakes until it sorted all ${N} (from 0, average of ${SEEDS.length} runs)`, `Errores hasta separar los ${N} (desde 0, promedio de ${SEEDS.length} ejecuciones)`), bars: [
      [t("Reading tens of kg", "Leyendo decenas de kilos"), L.mistakes / U.mistakes, n1(L.mistakes)],
      [t("Reading plain kg", "Leyendo kilos"), 1, n1(U.mistakes), true],
    ] }],
  }),
  limit: () => ({
    verdict: t(`By hand, none of the ${HH.settings.toLocaleString("en")} settings sorts all ${NH}; the best get ${HH.best}. Trained for ${ROUNDS} rounds, no run settled: they were still making about ${n1(LH.lastTen / 10)} mistakes a round and ended at ${n1(LH.right)} of ${NH} on average. The first ${N} alone: every run learned them.`,
      `A mano, ninguno de los ${HH.settings.toLocaleString("en")} ajustes separa los ${NH}; los mejores aciertan ${HH.best}. Entrenado ${ROUNDS} vueltas, ninguna ejecución se asentó: todavía cometían unos ${n1(LH.lastTen / 10)} errores por vuelta y terminaron en ${n1(LH.right)} de ${NH} en promedio. Los primeros ${N} solos: todas las ejecuciones los aprendieron.`),
    groups: [
      { title: t("Share sorted right, best setting by hand", "Parte bien separada, mejor ajuste a mano"), bars: [[t(`The ${N}`, `Los ${N}`), H.best / N, of(H.best, N)], [t(`The ${NH}`, `Los ${NH}`), HH.best / NH, of(HH.best, NH), true]] },
      { title: t(`Share sorted right after ${ROUNDS} rounds of training`, `Parte bien separada tras ${ROUNDS} vueltas de entrenamiento`), bars: [[t(`The ${N}`, `Los ${N}`), L.right / N, of(n1(L.right), N)], [t(`The ${NH}`, `Los ${NH}`), LH.right / NH, of(n1(LH.right), NH), true]] },
    ],
  }),
};

const EXPERIMENTS = [
  {
    id: "clues",
    title: t("One clue isn't enough", "Una pista no basta"),
    change: t(`The ${N} animals · the 10 kg kicker alone (floppy ears set to 0), the ears kicker alone (10 kg set to 0), then both · every setting of the others`, `Los ${N} animales · solo el empujador de 10 kg (orejas caídas en 0), solo el de las orejas (10 kg en 0), luego los dos · todos los ajustes de los demás`),
    question: t(`Can the board sort all ${N} animals using just one clue?`, `¿Puede el tablero separar los ${N} animales con una sola pista?`),
    options: [
      t("Yes, how heavy: dogs are heavier than cats", "Sí, cuánto pesa: los perros pesan más que los gatos"),
      t("Yes, the ears: floppy ears mean dog", "Sí, las orejas: orejas caídas quiere decir perro"),
      t("No: each clue alone gets some wrong, but both together get all of them", "No: cada pista sola falla en algunos, pero las dos juntas aciertan todos"),
      t("No: not even both clues together are enough", "No: ni las dos pistas juntas alcanzan"),
    ],
    answer: 2,
    why: t(`With weight alone, the animals end in order of weight, so the line can only split them into lighter and heavier. The small floppy-eared dog weighs 5 kg, less than the big house cat (6 kg): no split puts that dog with the dogs and that cat with the cats, ${ONE.kg} of ${N} at best. The fox-like dog and the husky have pointy ears, like every cat. If the ears kicker is all there is, they roll straight down the middle with the cats: ${ONE.ears} of ${N} at best. Together the clues cover each other's gaps: heavy, or floppy-eared, means dog. That's why real AI looks at many clues at once.`,
      `Solo con el peso, los animales terminan en orden de peso, así que la línea solo puede partirlos en más livianos y más pesados. El perro pequeño de orejas caídas pesa 5 kg, menos que el gato de casa grande (6 kg): ningún corte deja a ese perro con los perros y a ese gato con los gatos, ${ONE.kg} de ${N} como mucho. El perro con cara de zorro y el husky tienen orejas paradas, igual que todos los gatos. Si solo está el empujador de las orejas, ruedan derecho por el medio junto con los gatos: ${ONE.ears} de ${N} como mucho. Juntas, cada pista tapa el hueco de la otra: pesado, u orejas caídas, quiere decir perro. Por eso la IA real mira muchas pistas a la vez.`),
    watch: { set: "easy", lean: "on", hand: [[3, 0, -2], [0, 1, 0], [3, 1, -2]] },
  },
  {
    id: "dials",
    title: t("How much each clue counts", "Cuánto cuenta cada pista"),
    change: t(`The ${N} animals · four settings of the three kickers · then every setting the steppers can make`, `Los ${N} animales · cuatro ajustes de los tres empujadores · luego todos los ajustes posibles`),
    question: t(`Which setting sorts all ${N} animals right?`, `¿Qué ajuste separa bien los ${N} animales?`),
    options: OPTS.map(setting),
    answer: 1,
    why: t(`Each kicker pushes by how much its clue counts, times how much of the clue the animal has. The 10 kg kicker at +3.0 pushes a 22 kg husky (2.2 tens of kg) 6.6 toward DOG, and a 3 kg cat only 0.9. The ears kicker pushes floppy-eared animals by its setting and leaves pointy ears alone. The starting lean pushes everyone the same. With −2, +3.0 and +1, every cat ends at 0 or on the CAT side (a 6 kg cat: −2 + 1.8 = −0.2) and every dog on the DOG side (the fox-like dog, 8 kg: −2 + 2.4 = +0.4). The settings work together: turn 10 kg up and the heavier cats get pushed toward DOG too, so the lean has to pull everyone back. Of all ${H.settings.toLocaleString("en")} settings, ${H.all} work. AI people call "how much it counts" a weight.`,
      `Cada empujador empuja según cuánto cuenta su pista, por cuánto de esa pista tiene el animal. El empujador de 10 kg en +3.0 empuja a un husky de 22 kg (2.2 decenas de kilos) 6.6 hacia PERRO, y a un gato de 3 kg solo 0.9. El de las orejas empuja a los de orejas caídas según su ajuste y no toca a los de orejas paradas. La tendencia inicial empuja a todos igual. Con −2, +3.0 y +1, todos los gatos terminan en 0 o del lado GATO (un gato de 6 kg: −2 + 1.8 = −0.2) y todos los perros del lado PERRO (el perro con cara de zorro, 8 kg: −2 + 2.4 = +0.4). Los ajustes trabajan juntos: si subes 10 kg, los gatos más pesados también se acercan a PERRO, así que la tendencia tiene que tirar de todos hacia atrás. De los ${H.settings.toLocaleString("en")} ajustes, ${H.all} funcionan. En IA, "cuánto cuenta" se llama peso (weight).`),
    watch: { set: "easy", lean: "on", hand: [[1, 1, -1], [3, 1, -1], [3, 1, -2]] },
  },
  {
    id: "lean",
    title: t("The starting lean", "La tendencia inicial"),
    change: t(`The ${N} animals · the starting lean taken away (no first push) · every setting of the other two kickers, then ${ROUNDS} rounds of training`, `Los ${N} animales · sin tendencia inicial (sin primer empujón) · todos los ajustes de los otros dos empujadores, luego ${ROUNDS} vueltas de entrenamiento`),
    question: t(`Without the starting lean, can the board still sort all ${N}?`, `Sin la tendencia inicial, ¿puede el tablero separar los ${N}?`),
    options: [
      t("Yes: just turn 10 kg up high", "Sí: basta con subir mucho 10 kg"),
      t("Yes, but only by training it", "Sí, pero solo entrenándolo"),
      t("No: every animal with pointy ears ends on the same side, light or heavy", "No: todos los animales de orejas paradas terminan del mismo lado, livianos o pesados"),
      t("No: without the lean every animal ends on the line", "No: sin la tendencia todos los animales terminan sobre la línea"),
    ],
    answer: 2,
    why: t(`Without the lean, every animal reaches the 10 kg kicker still on the middle line. Every animal weighs more than 0, so that kicker pushes all of them the same way: toward DOG if its setting is above 0, toward CAT if below. A pointy-eared animal gets no other push, so all of them, cats and dogs, light or heavy, end on one side: with 10 kg above 0, every cat goes to DOG; at 0 or below, the husky goes to CAT. The lean is what lets weight decide: with −2 first, a pointy-eared animal needs more than about 6.7 kg (at +3.0) to cross the line. So the lean says how much evidence it takes before the board says DOG. AI people call it the bias. Without it the best is ${H0.best} of ${N}, and training goes round in circles.`,
      `Sin la tendencia, todos los animales llegan al empujador de 10 kg todavía sobre la línea del medio. Todo animal pesa más de 0, así que ese empujador los empuja a todos para el mismo lado: hacia PERRO si su ajuste es mayor que 0, hacia GATO si es menor. Un animal de orejas paradas no recibe otro empujón, así que todos, gatos y perros, livianos o pesados, terminan del mismo lado: con 10 kg por encima de 0, todos los gatos van a PERRO; en 0 o menos, el husky va a GATO. La tendencia es lo que deja decidir al peso: con −2 primero, un animal de orejas paradas necesita más de unos 6.7 kg (con +3.0) para cruzar la línea. O sea, la tendencia dice cuánta evidencia hace falta antes de que el tablero diga PERRO. En IA se la llama sesgo (bias). Sin ella lo mejor es ${H0.best} de ${N}, y el entrenamiento da vueltas en círculo.`),
    watch: { set: "easy", lean: "off", hand: [[3, 1, 0], [-1, 1, 0]], train: true, pace: 0.22 },
  },
  {
    id: "learn",
    title: t("Learning from mistakes", "Aprender de los errores"),
    change: t(`The ${N} animals · every kicker starts at 0 · Train: after each animal sorted into the wrong pen, each kicker that took part moves toward the right answer · ${SEEDS.length} runs, each with its own shuffled order`, `Los ${N} animales · todos los empujadores empiezan en 0 · Entrenar: después de cada animal que cae en el corral equivocado, cada empujador que participó se mueve hacia la respuesta correcta · ${SEEDS.length} ejecuciones, cada una con su propio orden`),
    question: t(`Every kicker starts at 0 and you press Train. What happens?`, `Todos los empujadores empiezan en 0 y pulsas Entrenar. ¿Qué pasa?`),
    options: [
      t("It never gets there: each fix breaks another animal", "Nunca lo logra: cada arreglo estropea otro animal"),
      t(`After about ${Math.round(L.mistakes)} mistakes it sorts all ${N}, then stops changing`, `Tras unos ${Math.round(L.mistakes)} errores separa los ${N}, y deja de cambiar`),
      t(`It sorts all ${N}, but keeps moving the kickers forever`, `Separa los ${N}, pero sigue moviendo los empujadores para siempre`),
      t("Only if you set the lean yourself first", "Solo si antes pones tú la tendencia"),
    ],
    answer: 1,
    why: t(`After a wrong sort, each kicker moves toward the right answer by as much as its clue was there: a dog that landed with the cats moves 10 kg up by its tens of kg (a 5 kg dog: +0.5), the ears up by 1 if its ears are floppy, and the lean up by 1. A cat that landed with the dogs moves them all down. A right sort changes nothing. Each move can send another animal to the wrong side, which gets fixed in turn; but when some setting sorts every animal right, the moves are sure to reach one and then stop (this was proven in the early 1960s: the perceptron convergence theorem). Here it took ${n1(L.mistakes)} mistakes on average. The board reads weight in tens of kg so the two clues are numbers of the same size. In plain kg, a husky would move 10 kg by 22 at once while the lean moved by 1, and learning took ${n1(U.mistakes)} mistakes. Measure clues in the same size of units.`,
      `Después de un error, cada empujador se mueve hacia la respuesta correcta tanto como estaba su pista: un perro que cayó con los gatos sube 10 kg según sus decenas de kilos (un perro de 5 kg: +0.5), las orejas 1 si tiene orejas caídas, y la tendencia 1. Un gato que cayó con los perros los baja a todos. Un acierto no cambia nada. Cada movimiento puede mandar a otro animal al lado equivocado, que se arregla después; pero si existe un ajuste que separa bien a todos, los movimientos siempre llegan a uno y ahí se detienen (se demostró a principios de los años sesenta: el teorema de convergencia del perceptrón). Aquí tomó ${n1(L.mistakes)} errores en promedio. El tablero lee el peso en decenas de kilos para que las dos pistas sean números del mismo tamaño. En kilos, un husky movería 10 kg en 22 de golpe mientras la tendencia se mueve 1, y aprender tomó ${n1(U.mistakes)} errores. Mide las pistas en unidades del mismo tamaño.`),
    watch: { set: "easy", lean: "on", hand: [[0, 0, 0]], train: true, pace: 0.2, seed: 59 },
  },
  {
    id: "limit",
    title: t("The limit of one neuron", "El límite de una neurona"),
    change: t(`The ${N} animals plus a chihuahua (2 kg, pointy ears) and a big fluffy cat (9 kg, pointy ears) · every setting by hand · then ${ROUNDS} rounds of training, ${SEEDS.length} runs`, `Los ${N} animales más un chihuahua (2 kg, orejas paradas) y un gato grande y peludo (9 kg, orejas paradas) · todos los ajustes a mano · luego ${ROUNDS} vueltas de entrenamiento, ${SEEDS.length} ejecuciones`),
    question: t(`Add the chihuahua and the big fluffy cat. Can the board sort all ${NH}?`, `Agrega el chihuahua y el gato grande y peludo. ¿Puede el tablero separar los ${NH}?`),
    options: [
      t("Yes, it just needs more training", "Sí, solo necesita más entrenamiento"),
      t("Yes: make floppy ears count a lot more", "Sí: que las orejas caídas cuenten mucho más"),
      t(`No: one neuron makes one straight cut between the two clues; at best ${HH.best} of ${NH}`, `No: una neurona hace un solo corte recto entre las dos pistas; como mucho ${HH.best} de ${NH}`),
      t(`No, and now it can't even sort the first ${N}`, `No, y ahora ni siquiera separa los primeros ${N}`),
    ],
    answer: 2,
    why: t(`A pointy-eared animal gets only two pushes: the lean, the same for all, and 10 kg, which grows with weight. So among pointy ears, where an animal ends depends only on how heavy it is, and the line splits them at one weight: lighter on one side, heavier on the other. Line them up by weight: the chihuahua (2 kg, dog), the cats (3 to 6 kg), the fox-like dog (8 kg), the big fluffy cat (9 kg), the husky (22 kg). The answer flips dog, cat, dog, cat, dog. No single weight puts all of them on the right side, so at least two are always wrong, whatever the settings. Floppy ears can't help: none of these have them. One neuron can only make one straight cut between the two clues. Training keeps fixing one and breaking another, forever. Sorting these takes more neurons working together, each making its own cut: that is what real AI does.`,
      `Un animal de orejas paradas recibe solo dos empujones: la tendencia, igual para todos, y 10 kg, que crece con el peso. Así que entre los de orejas paradas, dónde termina un animal depende solo de cuánto pesa, y la línea los parte en un peso: más livianos de un lado, más pesados del otro. Ordénalos por peso: el chihuahua (2 kg, perro), los gatos (de 3 a 6 kg), el perro con cara de zorro (8 kg), el gato grande y peludo (9 kg), el husky (22 kg). La respuesta salta perro, gato, perro, gato, perro. Ningún peso deja a todos del lado correcto, así que siempre fallan al menos dos, digan lo que digan los ajustes. Las orejas caídas no ayudan: ninguno las tiene. Una neurona solo puede hacer un corte recto entre las dos pistas. El entrenamiento arregla uno y estropea otro, para siempre. Separar estos animales necesita más neuronas trabajando juntas, cada una con su propio corte: eso hace la IA real.`),
    watch: { set: "hard", lean: "on", hand: [[3, 1, -2]], hold: 2600, train: true, pace: 0.2 },
  },
];

const QUESTIONS = [
  [t("What happens to each animal on the board?", "¿Qué le pasa a cada animal en el tablero?"),
    t("It rolls down the middle line and three kickers push it sideways: the starting lean pushes every animal by its setting; 10 kg pushes by its setting times the animal's tens of kg; floppy ears push by their setting, only if its ears are floppy. Where it ends is the sum of the pushes, its score. Past the line on the DOG side (above 0), it goes to the DOG pen; on the line or the CAT side (0 or less), to the CAT pen. That's all one neuron does: add up evidence and compare with 0.",
      "Rueda por la línea del medio y tres empujadores lo mueven de lado: la tendencia inicial empuja a todo animal según su ajuste; 10 kg empuja según su ajuste por las decenas de kilos del animal; las orejas caídas empujan según su ajuste, solo si tiene las orejas caídas. Donde termina es la suma de los empujones, su puntaje. Pasada la línea del lado PERRO (más de 0), va al corral de los perros; sobre la línea o del lado GATO (0 o menos), al de los gatos. Eso es todo lo que hace una neurona: sumar evidencia y comparar con 0.")],
  [t("What does \"how much it counts\" mean?", "¿Qué quiere decir \"cuánto cuenta\"?"),
    t("How hard a kicker pushes for each bit of its clue. A bigger number pushes harder toward DOG; 0 means the board ignores that clue; a negative number pushes toward CAT. AI people call these numbers weights, which is why the lesson says \"how heavy\" for the animal's kg.",
      "Cuánto empuja un empujador por cada parte de su pista. Un número más grande empuja más hacia PERRO; 0 quiere decir que el tablero ignora esa pista; un número negativo empuja hacia GATO. En IA a estos números se les llama pesos, por eso la lección dice \"cuánto pesa\" para los kilos del animal.")],
  [t("What is the starting lean for?", "¿Para qué sirve la tendencia inicial?"),
    t("It sets how much evidence it takes before the board says DOG. Without it, every pointy-eared animal, light or heavy, gets pushed the same way by the 10 kg kicker and ends on the same side. With a lean of −2, an animal has to be pushed more than 2 toward DOG to cross the line. AI people call it the bias.",
      "Fija cuánta evidencia hace falta antes de que el tablero diga PERRO. Sin ella, todos los animales de orejas paradas, livianos o pesados, reciben el empujón de 10 kg para el mismo lado y terminan del mismo lado. Con una tendencia de −2, un animal tiene que recibir más de 2 hacia PERRO para cruzar la línea. En IA se la llama sesgo.")],
  [t("How does the board learn?", "¿Cómo aprende el tablero?"),
    t("One animal at a time. When one lands in the wrong pen, each kicker that took part moves toward the right answer by as much as its clue was there: up if it should have been DOG, down if CAT. A right sort changes nothing. If some setting sorts every animal right, the moves always reach one and then stop.",
      "Un animal a la vez. Cuando uno cae en el corral equivocado, cada empujador que participó se mueve hacia la respuesta correcta tanto como estaba su pista: hacia arriba si debía ser PERRO, hacia abajo si GATO. Un acierto no cambia nada. Si existe un ajuste que separa bien a todos, los movimientos siempre llegan a uno y ahí se detienen.")],
  [t("Why does the board read tens of kg instead of kg?", "¿Por qué el tablero lee decenas de kilos y no kilos?"),
    t("So both clues are numbers of about the same size (ears are 0 or 1). In plain kg, a 22 kg husky would move the 10 kg kicker 22 times as far as the lean on every mistake, and learning would take several times as many mistakes.",
      "Para que las dos pistas sean números de un tamaño parecido (las orejas son 0 o 1). En kilos, un husky de 22 kg movería el empujador de 10 kg 22 veces más que la tendencia en cada error, y aprender tomaría varias veces más errores.")],
  [t("Why can't one neuron sort the chihuahua and the big fluffy cat?", "¿Por qué una neurona no puede separar al chihuahua y al gato grande y peludo?"),
    t("One neuron makes one straight cut between the two clues. Among pointy-eared animals, where an animal ends depends only on its weight, and the answer flips dog, cat, dog, cat, dog going up in weight; one cut can't follow that. Real AI uses many neurons in layers, each making its own cut, and the next ones combine their answers.",
      "Una neurona hace un solo corte recto entre las dos pistas. Entre los animales de orejas paradas, dónde termina uno depende solo de su peso, y la respuesta salta perro, gato, perro, gato, perro al subir de peso; un corte no puede seguir eso. La IA real usa muchas neuronas en capas, cada una con su propio corte, y las siguientes combinan sus respuestas.")],
];

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export default defineLesson({
  title: t("Neuron Workbench", "Banco de trabajo: neurona"),
  eyebrow: t("Systems lesson 85 · Neuron", "Lección de sistemas 85 · Neurona"),
  lede: t("A photo app that tells a cat from a dog is built from tiny parts called neurons, and each one does something simple: it adds up clues and says yes or no. Here one neuron sorts animals by two clues, how heavy each is and whether its ears are floppy, and learns from its own mistakes. You'll also meet two animals no single neuron can sort, which is why real AI uses many.",
    "Una app de fotos que distingue un gato de un perro está hecha de piezas pequeñas llamadas neuronas, y cada una hace algo simple: suma pistas y dice sí o no. Aquí una neurona separa animales con dos pistas, cuánto pesa cada uno y si tiene las orejas caídas, y aprende de sus propios errores. También vas a conocer dos animales que ninguna neurona sola puede separar: por eso la IA real usa muchas."),
  machine: {
    intro: t("Each animal rolls down the board along the middle line. Three kickers cross the board, and each pushes it sideways, toward the DOG half or the CAT half, by how much its clue counts: the starting lean pushes every animal, 10 kg pushes harder the heavier the animal is, and floppy ears push only an animal with floppy ears. Where it ends is the sum of the pushes: past the line on the DOG side, a divider sends it to the DOG pen; on the line or the CAT side, to the CAT pen. An animal in the wrong pen lights up. Start with the 8 animals: press − and + until no animal is lit. Then Start over and Train: after each wrong sort, each kicker that took part moves a notch toward the right answer. AI people call \"how much it counts\" a weight.",
      "Cada animal rueda por el tablero a lo largo de la línea del medio. Tres empujadores cruzan el tablero, y cada uno lo mueve de lado, hacia la mitad PERRO o la mitad GATO, según cuánto cuenta su pista: la tendencia inicial empuja a todo animal, 10 kg empuja más cuanto más pesa el animal, y orejas caídas empuja solo a un animal de orejas caídas. Donde termina es la suma de los empujones: pasada la línea del lado PERRO, un divisor lo manda al corral de los perros; sobre la línea o del lado GATO, al de los gatos. Un animal en el corral equivocado se enciende. Empieza con los 8 animales: pulsa − y + hasta que no quede ningún animal encendido. Después Empezar de nuevo y Entrenar: tras cada error, cada empujador que participó avanza un paso hacia la respuesta correcta. En IA, \"cuánto cuenta\" se llama peso."),
    plate: {
      title: t("One neuron", "Una neurona"),
      keys: [
        { mark: "lit", label: t("An animal in the wrong pen (on the wide board, with its real kind on a tag)", "Un animal en el corral equivocado (en el tablero ancho, con lo que es de verdad en una etiqueta)") },
        { mark: "raised", label: t("A kicker: its shoe rides in the slot; when it pushes the animal in play, its arm runs out as far as that push. Hollow: it doesn't push this one. A chip on a sign: the notch it moves after a mistake", "Un empujador: su base corre por la ranura; cuando empuja al animal en juego, su brazo sale tanto como ese empujón. Hueco: a este no lo empuja. Una ficha en un letrero: el paso que avanza tras un error") },
        { mark: "flat", label: t("The bold path: where the animal in play went; by hand, every animal's path, faint. The shaded half is the DOG side", "El camino en negrita: por dónde fue el animal en juego; a mano, el camino de cada animal, tenue. La mitad sombreada es el lado PERRO") },
        { mark: "dashed", label: t("After a mistake: the push the same animal would get once the kickers have moved", "Tras un error: el empujón que recibiría el mismo animal cuando los empujadores se hayan movido") },
      ],
      caption: t("The signs show how much each clue counts: STARTING LEAN (every animal), EVERY 10 KG (times the animal's tens of kg: a 5 kg animal gets half) and FLOPPY EARS (only floppy ears). The faint lanes are one point apart. The tag on the animal in play shows its kg. A score of exactly 0 ends on the line, which counts as CAT. Each pen counts its animals. RIGHT counts this round's animals in the right pen; while it learns, ROUND counts its trips through all the animals (in a shuffled order) and MISTAKES the wrong sorts so far.",
        "Los letreros muestran cuánto cuenta cada pista: TENDENCIA INICIAL (todo animal), CADA 10 KG (por las decenas de kilos del animal: uno de 5 kg recibe la mitad) y OREJAS CAÍDAS (solo orejas caídas). Los carriles tenues están a un punto de distancia. La etiqueta del animal en juego muestra sus kilos. Un puntaje de exactamente 0 termina sobre la línea, que cuenta como GATO. Cada corral cuenta sus animales. BIEN cuenta los animales de esta vuelta en el corral correcto; mientras aprende, VUELTA cuenta sus pasadas por todos los animales (en orden mezclado) y ERRORES los errores hasta ahora."),
      stage: { "data-neuron": "" },
      label: t("A board that sorts cats from dogs, run by one neuron. Space pauses or resumes.", "Un tablero que separa gatos de perros, manejado por una neurona. Espacio pausa o reanuda."),
    },
    svg: figures(),
    stats: [
      ["right", t("Sorted right", "Bien separados"), "–"],
      ["rounds", t("Rounds", "Vueltas"), "–"],
      ["mistakes", t("Mistakes", "Errores"), "–"],
    ],
    controls: [
      { seg: "set", label: t("Animals", "Animales"), options: [["easy", t(`The ${N}`, `Los ${N}`)], ["hard", t("+ a chihuahua and a big fluffy cat", "+ un chihuahua y un gato grande")]], value: "easy" },
      { nums: [["lean", t("Starting lean", "Tendencia inicial"), 0, { ...RANGE.lean, digits: 0 }], ["kg", t("Every 10 kg", "Cada 10 kg"), 0, { ...RANGE.kg, digits: 1 }], ["ears", t("Floppy ears", "Orejas caídas"), 0, { ...RANGE.ears, digits: 0 }]], label: t("How much it counts (AI: the weights; the lean is the bias)", "Cuánto cuenta (en IA: los pesos; la tendencia es el sesgo)"), min: -5, max: 5, step: 1, digits: 0 },
      { seg: "use", label: t("Use the starting lean?", "¿Usar la tendencia inicial?"), options: [["on", t("Yes", "Sí")], ["off", t("No, take it away", "No, quitarla")]], value: "on" },
      { actions: [["train", t("Train", "Entrenar"), { primary: true }], ["one", t("One animal", "Un animal")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Press − and + (or ↑ ↓ on a number): every animal runs again at once. Train starts from the settings you made and moves them after each wrong sort; it stops once a whole round is right. A run that never gets there rests after 12 rounds and starts over from 0. One animal sends just the next one. Start over puts every setting back to 0.",
      "Pulsa − y + (o ↑ ↓ sobre un número): todos los animales vuelven a rodar al instante. Entrenar parte de los ajustes que hiciste y los mueve tras cada error; se detiene cuando acierta una vuelta entera. Si nunca lo logra, descansa tras 12 vueltas y empieza de nuevo desde 0. Un animal manda solo el siguiente. Empezar de nuevo vuelve todos los ajustes a 0."),
  },
  predict: { intro: t(`Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results by hand try every setting the three steppers can make; results from training average ${SEEDS.length} runs, each starting from 0 with its own shuffled order. The animals are illustrative, with round weights inside real ranges.`,
    `Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados a mano prueban todos los ajustes que permiten los tres controles; los del entrenamiento promedian ${SEEDS.length} ejecuciones, cada una desde 0 y con su propio orden. Los animales son ilustrativos, con pesos redondos dentro de rangos reales.`), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the ${A("https://github.com/wheresryan22/anatomy", "Anatomy")} isometric kit (MIT). Simulation written for this lesson; the animals are illustrative, with round weights inside the ranges given by ${A("https://www.petmd.com/cat/general-health/average-weight-cats", "PetMD")} (house cats 8–12 lb, Maine Coon males 12–20+ lb) and the ${A("https://www.akc.org/expert-advice/nutrition/breed-weight-chart/", "AKC breed weight chart")} (Chihuahua up to 6 lb, Shih Tzu 9–16 lb, Shiba Inu 17–23 lb, Cocker Spaniel 20–30 lb, Siberian Husky 35–60 lb). The way in follows ${A("https://www.cs.cmu.edu/~dst/NeuronSandbox/docs/Neural_Networks_in_Middle_School.pdf", "Neuron Sandbox")} (Touretzky, Chen and Pawar, <em>ACM Inroads</em> 15(3), 2024: a real decision, small numbers, set by hand first), Michael Nielsen's ${A("http://neuralnetworksanddeeplearning.com/chap1.html", "device that makes decisions by weighing up evidence")}, 3Blue1Brown's ${A("https://www.3blue1brown.com/lessons/neural-networks", "But what is a neural network?")}, and cs4fn's ${A("https://www.cs4fn.org/machinelearning/trainaneuron.php", "Train a neuron")} game (Curzon and McOwan, Queen Mary University of London: after a wrong answer, add or take a coin on each input that took part). The learning rule is Rosenblatt's perceptron (${A("https://pubmed.ncbi.nlm.nih.gov/13602029/", "Psychological Review, 1958")}); what one such unit can't tell apart is the subject of Minsky and Papert's <em>Perceptrons</em> (1969).`,
    `Figura dibujada con el kit isométrico ${A("https://github.com/wheresryan22/anatomy", "Anatomy")} (MIT). Simulación escrita para esta lección; los animales son ilustrativos, con pesos redondos dentro de los rangos de ${A("https://www.petmd.com/cat/general-health/average-weight-cats", "PetMD")} (gatos de casa 8–12 lb, Maine Coon machos 12–20+ lb) y de la ${A("https://www.akc.org/expert-advice/nutrition/breed-weight-chart/", "tabla de pesos por raza del AKC")} (Chihuahua hasta 6 lb, Shih Tzu 9–16 lb, Shiba Inu 17–23 lb, Cocker Spaniel 20–30 lb, Husky siberiano 35–60 lb). La forma de entrar sigue a ${A("https://www.cs.cmu.edu/~dst/NeuronSandbox/docs/Neural_Networks_in_Middle_School.pdf", "Neuron Sandbox")} (Touretzky, Chen y Pawar, <em>ACM Inroads</em> 15(3), 2024: una decisión real, números pequeños, primero a mano), el ${A("http://neuralnetworksanddeeplearning.com/chap1.html", "dispositivo que decide sopesando evidencias")} de Michael Nielsen, ${A("https://www.3blue1brown.com/lessons/neural-networks", "But what is a neural network?")} de 3Blue1Brown y el juego ${A("https://www.cs4fn.org/machinelearning/trainaneuron.php", "Train a neuron")} de cs4fn (Curzon y McOwan, Queen Mary University of London: tras una respuesta equivocada, poner o quitar una moneda en cada entrada que participó). La regla de aprendizaje es el perceptrón de Rosenblatt (${A("https://pubmed.ncbi.nlm.nih.gov/13602029/", "Psychological Review, 1958")}); lo que una sola unidad así no puede distinguir es el tema de <em>Perceptrons</em> de Minsky y Papert (1969).`),
  css: LIT_FILL_CSS + FIG_CSS + `
.iso-stage [data-layer] text{pointer-events:none}
#machine:has([data-neuron]) .controls>.control:has(wb-seg[name="set"]){grid-column:1/-1}
/* On a phone the steppers sit right under the machine. The plate's legend and the stats strip move below the controls
   (visual order only; nothing focusable moves, so the focus order is unchanged). */
@media (max-width:560px){
  #machine:has([data-neuron]){display:flex;flex-direction:column}
  #machine:has([data-neuron])>wb-figure,#machine:has([data-neuron])>wb-figure>figure.iso-figure{display:contents}
  #machine:has([data-neuron])>.section-head{order:0}
  #machine:has([data-neuron]) .iso-plate{order:1}
  #machine:has([data-neuron])>.panel{order:2;display:flex;flex-direction:column}
  #machine:has([data-neuron])>.panel>wb-controls{order:1}
  #machine:has([data-neuron])>.panel>wb-stats{order:2}
  #machine:has([data-neuron])>.panel>.panel-note{order:3}
  #machine:has([data-neuron]) .iso-legend{order:3;margin-top:14px}
}
`,
  data: {},
});
