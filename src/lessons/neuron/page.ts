// @ts-nocheck: content in the style of the other lessons
// Systems lesson 85 · Neuron: one artificial neuron as a weighing station, beside the board where its line falls.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, pctTenths } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, tokenSvg, ringSvg, P } from "./figure";
import { rulesRun, slopeRun, noiseRun, scaleRun, RATE, EPOCHS, SCALE_EPOCHS, CLOSE, N_LOANS, SEEDS, PROBE } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each).
const R = { bias: rulesRun(true), nobias: rulesRun(false), slope: slopeRun(), noise: noiseRun(), scale: scaleRun() };
const { bias: B, nobias: NB, slope: SL, noise: NO, scale: SC } = R;
// The verdicts and explanations below say "every run" and "never"; stop the build if the model stops bearing that out.
const need = (ok, what) => { if (!ok) throw new Error("neuron/page.ts: the model no longer gives " + what); };
need(["and", "or", "nand"].every((k) => B[k].settled === 1 && B[k].final === 1) && B.xor.settled === 0 && B.xor.line === 0.75, "experiment 1's outcome");
need(NB.or.settled === 1 && NB.or.final === 1 && NB.and.settled === 0 && NB.nand.settled === 0 && NB.and.line === 0.75 && NB.nand.line === 0.5, "experiment 2's outcome");
need(SL.step.nudges === 0 && SL.sigmoid.final === 1, "experiment 3's outcome");
need(NO.perceptron.move > 10 * NO.gradient.move, "experiment 4's outcome");
need(SC.norm.settled === 1 && SC.raw.settled === 0 && SC.rawSlow.settled === 0, "experiment 5's outcome");

const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const ep = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : one(x));
const two = (x) => x.toFixed(2);
const mv = (x) => pctTenths(x);
const zText = (SL.z < 0 ? "−" : "") + Math.abs(SL.z).toFixed(1);
const RULES = [["and", "AND"], ["or", "OR"], ["nand", "NAND"]];
const LOGIC_EPOCHS = EPOCHS.logic, LOAN_EPOCHS = EPOCHS.loans;

// What each card shows after a run.
const RUNS = {
  rules: () => ({
    verdict: t("AND, OR and NAND: every run reached 100% and settled, after " + ep(B.and.epochs) + ", " + ep(B.or.epochs) + " and " + ep(B.nand.epochs) + " epochs on average. XOR: no run settled in " + LOGIC_EPOCHS + " epochs, the last line got " + pct(B.xor.final) + " right on average, and no line gets more than " + pct(B.xor.line) + " (3 of 4).",
      "AND, OR y NAND: todas las ejecuciones llegaron al 100% y se asentaron, tras " + ep(B.and.epochs) + ", " + ep(B.or.epochs) + " y " + ep(B.nand.epochs) + " épocas en promedio. XOR: ninguna ejecución se asentó en " + LOGIC_EPOCHS + " épocas, la última línea acertó el " + pct(B.xor.final) + " en promedio, y ninguna línea acierta más del " + pct(B.xor.line) + " (3 de 4)."),
    bars: [
      ...RULES.map(([k, name]) => [t(name + ", right after training", name + ", aciertos tras entrenar"), B[k].final, pct(B[k].final)]),
      [t("XOR, right after " + LOGIC_EPOCHS + " epochs", "XOR, aciertos tras " + LOGIC_EPOCHS + " épocas"), B.xor.final, pct(B.xor.final), true],
      [t("XOR, the best any line can do", "XOR, lo mejor que logra una línea"), B.xor.line, pct(B.xor.line)],
    ],
  }),
  bias: () => ({
    verdict: t("Without the bias, OR still reached 100% and settled (" + ep(NB.or.epochs) + " epochs on average). AND never settled: the best line through the origin gets " + pct(NB.and.line) + ", and training ended at " + pct(NB.and.final) + " on average. NAND: at best " + pct(NB.nand.line) + ", ended at " + pct(NB.nand.final) + ".",
      "Sin el sesgo, OR igual llegó al 100% y se asentó (" + ep(NB.or.epochs) + " épocas en promedio). AND nunca se asentó: la mejor línea por el origen acierta el " + pct(NB.and.line) + ", y el entrenamiento terminó en " + pct(NB.and.final) + " en promedio. NAND: como mucho el " + pct(NB.nand.line) + ", terminó en " + pct(NB.nand.final) + "."),
    groups: [
      { title: t("The best any line can do", "Lo mejor que logra una línea"), bars: [
        [t("AND, with the bias", "AND, con sesgo"), B.and.line, pct(B.and.line)],
        [t("AND, through the origin", "AND, por el origen"), NB.and.line, pct(NB.and.line), true],
        [t("OR, through the origin", "OR, por el origen"), NB.or.line, pct(NB.or.line)],
        [t("NAND, through the origin", "NAND, por el origen"), NB.nand.line, pct(NB.nand.line), true],
      ] },
      { title: t("Right after " + LOGIC_EPOCHS + " epochs, no bias", "Aciertos tras " + LOGIC_EPOCHS + " épocas, sin sesgo"), bars: [
        [t("AND", "AND"), NB.and.final, pct(NB.and.final), true],
        [t("OR", "OR"), NB.or.final, pct(NB.or.final)],
        [t("NAND", "NAND"), NB.nand.final, pct(NB.nand.final), true],
      ] },
    ],
  }),
  slope: () => ({
    verdict: t("For a point just across an AND line (z = " + zText + "), the step reports " + SL.stepOut + " and the sigmoid " + two(SL.sigOut) + ", where its slope is " + two(SL.sigSlope) + "; the step's slope is 0. Trained by gradient for " + LOGIC_EPOCHS + " epochs from the same starting weights: the step made " + Math.round(SL.step.nudges) + " nudges and stayed at " + pct(SL.step.final) + "; the sigmoid made " + Math.round(SL.sigmoid.nudges) + " and reached " + pct(SL.sigmoid.final) + ".",
      "Para un punto justo al otro lado de una línea de AND (z = " + zText + "), el escalón responde " + SL.stepOut + " y la sigmoide " + two(SL.sigOut) + ", donde su pendiente es " + two(SL.sigSlope) + "; la pendiente del escalón es 0. Entrenadas por gradiente durante " + LOGIC_EPOCHS + " épocas desde los mismos pesos iniciales: el escalón hizo " + Math.round(SL.step.nudges) + " ajustes y se quedó en " + pct(SL.step.final) + "; la sigmoide hizo " + Math.round(SL.sigmoid.nudges) + " y llegó al " + pct(SL.sigmoid.final) + "."),
    groups: [
      { title: t("Output for the point just across", "Salida para el punto justo al otro lado"), bars: [
        [t("Step", "Escalón"), SL.stepOut, String(SL.stepOut), true],
        [t("Sigmoid", "Sigmoide"), SL.sigOut, two(SL.sigOut)],
      ] },
      { title: t("AND, right after " + LOGIC_EPOCHS + " epochs of gradient training", "AND, aciertos tras " + LOGIC_EPOCHS + " épocas de entrenamiento por gradiente"), bars: [
        [t("Step", "Escalón"), SL.step.final, pct(SL.step.final), true],
        [t("Sigmoid", "Sigmoide"), SL.sigmoid.final, pct(SL.sigmoid.final)],
      ] },
    ],
  }),
  noise: () => {
    const top = Math.max(NO.perceptron.move, NO.gradient.move) * 1.08;
    return {
      verdict: t("After " + LOAN_EPOCHS + " epochs on the noisy loans, the perceptron's line still moved " + mv(NO.perceptron.move) + " of the board per epoch over the last 50, and ended at " + pct(NO.perceptron.final) + " right. The sigmoid neuron trained by gradient moved " + mv(NO.gradient.move) + " and ended at " + pct(NO.gradient.final) + ". The best line gets " + pct(NO.perceptron.best) + ".",
        "Tras " + LOAN_EPOCHS + " épocas con los préstamos ruidosos, la línea del perceptrón todavía movía el " + mv(NO.perceptron.move) + " del tablero por época en las últimas 50, y terminó con " + pct(NO.perceptron.final) + " de aciertos. La neurona sigmoide entrenada por gradiente movía el " + mv(NO.gradient.move) + " y terminó con " + pct(NO.gradient.final) + ". La mejor línea acierta el " + pct(NO.perceptron.best) + "."),
      groups: [
        { title: t("Share of the board the line swept per epoch, last 50", "Parte del tablero que barrió la línea por época, últimas 50"), bars: [
          [t("Perceptron (step)", "Perceptrón (escalón)"), NO.perceptron.move / top, mv(NO.perceptron.move), true],
          [t("Sigmoid, by gradient", "Sigmoide, por gradiente"), NO.gradient.move / top, mv(NO.gradient.move)],
        ] },
        { title: t("Right after " + LOAN_EPOCHS + " epochs", "Aciertos tras " + LOAN_EPOCHS + " épocas"), bars: [
          [t("Perceptron (step)", "Perceptrón (escalón)"), NO.perceptron.final, pct(NO.perceptron.final), true],
          [t("Sigmoid, by gradient", "Sigmoide, por gradiente"), NO.gradient.final, pct(NO.gradient.final)],
          [t("The best line", "La mejor línea"), NO.perceptron.best, pct(NO.perceptron.best)],
        ] },
      ],
    };
  },
  scale: () => {
    const never = true;
    return {
      verdict: t("Normalised inputs: every run converged, in " + ep(SC.norm.at) + " epochs on average, ending at " + pct(SC.norm.final) + " right. Raw dollars at the same rate: " + (never ? "no run converged in " + SCALE_EPOCHS + " epochs" : pct(SC.raw.settled) + " of runs converged") + "; the line still swept " + mv(SC.raw.move) + " of the board per epoch at the end, at " + pct(SC.raw.final) + " right.",
        "Entradas normalizadas: todas las ejecuciones convergieron, en " + ep(SC.norm.at) + " épocas en promedio, y terminaron con " + pct(SC.norm.final) + " de aciertos. Dólares crudos con la misma tasa: " + (never ? "ninguna ejecución convergió en " + SCALE_EPOCHS + " épocas" : "convergió el " + pct(SC.raw.settled) + " de las ejecuciones") + "; al final la línea todavía barría el " + mv(SC.raw.move) + " del tablero por época, con " + pct(SC.raw.final) + " de aciertos."),
      groups: [
        { title: t("Epochs to converge (of " + SCALE_EPOCHS + ")", "Épocas hasta converger (de " + SCALE_EPOCHS + ")"), bars: [
          [t("Normalised", "Normalizadas"), SC.norm.at / SCALE_EPOCHS, ep(SC.norm.at)],
          [t("Raw dollars", "Dólares crudos"), 1, never ? t("never", "nunca") : ep(SC.raw.at), true],
        ] },
        { title: t("Right after " + SCALE_EPOCHS + " epochs", "Aciertos tras " + SCALE_EPOCHS + " épocas"), bars: [
          [t("Normalised", "Normalizadas"), SC.norm.final, pct(SC.norm.final)],
          [t("Raw dollars", "Dólares crudos"), SC.raw.final, pct(SC.raw.final), true],
        ] },
      ],
    };
  },
};

const EXPERIMENTS = [
  {
    id: "rules",
    title: t("Which rules can one neuron learn?", "¿Qué funciones puede aprender una neurona?"),
    change: t("Inputs 0 and 1, a step activation, the perceptron rule, the bias on · AND, OR, NAND and XOR, " + LOGIC_EPOCHS + " epochs each",
      "Entradas 0 y 1, activación escalón, regla del perceptrón, con sesgo · AND, OR, NAND y XOR, " + LOGIC_EPOCHS + " épocas cada una"),
    question: t("XOR says yes when exactly one input is 1. Where does training get it?", "XOR dice sí cuando exactamente una entrada es 1. ¿Hasta dónde llega el entrenamiento?"),
    options: [
      t("To 100%, it just takes more epochs than AND", "Al 100%, solo tarda más épocas que AND"),
      t("Nowhere stable: no line gets more than 3 of 4", "A ningún punto estable: ninguna línea acierta más de 3 de 4"),
      t("To 100%, once the rate is small enough", "Al 100%, cuando la tasa es lo bastante pequeña"),
      t("To 50%: it settles on guessing", "Al 50%: se asienta en adivinar"),
    ],
    answer: 1,
    why: t("Put XOR's four examples on the board: the yes ones, (0, 1) and (1, 0), sit on one diagonal, the no ones, (0, 0) and (1, 1), on the other. A straight line that has both yes corners on its yes side has at least one no corner there too, so the best one neuron can do is 3 of 4 (" + pct(B.xor.line) + "), and that holds for any weights, any rate, any number of epochs. The perceptron rule nudges the line at every mistake, and with XOR there is always a mistake, so it never settles: after " + LOGIC_EPOCHS + " epochs its last line got " + pct(B.xor.final) + " on average. AND, OR and NAND each have a line that separates them, and the perceptron convergence theorem (in Novikoff's 1962 proof) promises the rule finds one in a finite number of mistakes: here " + ep(B.and.epochs) + ", " + ep(B.or.epochs) + " and " + ep(B.nand.epochs) + " epochs. Minsky and Papert's book Perceptrons (1969) made the limit famous. Two lines and a neuron that combines them do get XOR: that is what a hidden layer is for.",
      "Pon los cuatro ejemplos de XOR en el tablero: los de sí, (0, 1) y (1, 0), quedan en una diagonal, y los de no, (0, 0) y (1, 1), en la otra. Una línea recta que deja las dos esquinas de sí de su lado del sí deja ahí también al menos una esquina de no, así que lo mejor que puede hacer una neurona es 3 de 4 (" + pct(B.xor.line) + "), y eso vale para cualquier peso, cualquier tasa y cualquier número de épocas. La regla del perceptrón mueve la línea en cada error, y con XOR siempre hay un error, así que nunca se asienta: tras " + LOGIC_EPOCHS + " épocas su última línea acertó el " + pct(B.xor.final) + " en promedio. AND, OR y NAND tienen cada una una línea que las separa, y el teorema de convergencia del perceptrón (en la demostración de Novikoff, de 1962) garantiza que la regla encuentra una en un número finito de errores: aquí " + ep(B.and.epochs) + ", " + ep(B.or.epochs) + " y " + ep(B.nand.epochs) + " épocas. El libro Perceptrons de Minsky y Papert (1969) hizo famoso ese límite. Dos líneas y una neurona que las combine sí resuelven XOR: para eso sirve una capa oculta."),
    watch: { task: "xor", act: "step", rule: "perceptron", bias: "on", speed: 8, warm: 90 },
  },
  {
    id: "bias",
    title: t("Take the bias away", "Quitar el sesgo"),
    change: t("The same rules and training · bias on vs bias off (the line must pass through the origin, x1 = x2 = 0, where a point counts as no)",
      "Las mismas funciones y el mismo entrenamiento · con sesgo vs sin sesgo (la línea tiene que pasar por el origen, x1 = x2 = 0, donde un punto cuenta como no)"),
    question: t("Without the bias, what happens to AND?", "Sin el sesgo, ¿qué le pasa a AND?"),
    options: [
      t("Nothing: the two weights can still place the line", "Nada: los dos pesos igual pueden ubicar la línea"),
      t("It learns it, only more slowly", "La aprende, solo que más lento"),
      t("It can't: (0, 0) is stuck on the line", "No puede: (0, 0) queda fija en la línea"),
      t("None of the four rules can be learned any more", "Ya no se puede aprender ninguna de las cuatro funciones"),
    ],
    answer: 2,
    why: t("The weights only turn the line; the bias is what moves it away from the origin. Without it, the sum at (0, 0) is 0 whatever the weights, so that corner always gets the same answer (no, here). AND also needs (1, 0) and (0, 1) to be no and (1, 1) yes: that takes both weights at or below zero and their sum above zero, which can't happen. The best line through the origin gets " + pct(NB.and.line) + ", and training never settled, ending at " + pct(NB.and.final) + " on average. OR is happy with (0, 0) as no, so it still reached 100% in " + ep(NB.or.epochs) + " epochs; NAND needs (0, 0) to be yes and tops out at " + pct(NB.nand.line) + ". So the bias isn't a detail: it's the third number of the line, the one that lets the rule's threshold sit anywhere. That's why every layer in PyTorch or Keras has one unless you turn it off, which people do when the next step re-centres the values anyway, such as batch normalisation.",
      "Los pesos solo hacen girar la línea; el sesgo es lo que la aleja del origen. Sin él, la suma en (0, 0) es 0 sean cuales sean los pesos, así que esa esquina siempre recibe la misma respuesta (no, aquí). AND además necesita que (1, 0) y (0, 1) sean no y (1, 1) sí: eso pide los dos pesos en cero o menos y su suma mayor que cero, y eso no puede pasar. La mejor línea por el origen acierta el " + pct(NB.and.line) + ", y el entrenamiento nunca se asentó: terminó en " + pct(NB.and.final) + " en promedio. A OR le sirve que (0, 0) sea no, así que igual llegó al 100% en " + ep(NB.or.epochs) + " épocas; NAND necesita que (0, 0) sea sí y llega como mucho al " + pct(NB.nand.line) + ". El sesgo no es un detalle: es el tercer número de la línea, el que deja que el umbral quede en cualquier lugar. Por eso toda capa de PyTorch o Keras lo trae salvo que lo apagues, cosa que se hace cuando el paso siguiente vuelve a centrar los valores de todos modos, como la normalización por lotes (batch normalization)."),
    watch: { task: "and", act: "step", rule: "perceptron", bias: "off", speed: 8, warm: 90 },
  },
  {
    id: "slope",
    title: t("Step or sigmoid", "Escalón o sigmoide"),
    change: t("A point just across an AND line (w = 1, 1, bias −1.5, the point (" + PROBE.x.join(", ") + ")) · then AND trained by gradient for " + LOGIC_EPOCHS + " epochs, through a step vs through a sigmoid, from the same starting weights",
      "Un punto justo al otro lado de una línea de AND (w = 1, 1, sesgo −1.5, el punto (" + PROBE.x.join(", ") + ")) · luego AND entrenada por gradiente durante " + LOGIC_EPOCHS + " épocas, a través de un escalón vs a través de una sigmoide, desde los mismos pesos iniciales"),
    question: t("Training by gradient nudges each weight by how much it would lower the error. What happens with the step?", "El entrenamiento por gradiente ajusta cada peso según cuánto bajaría el error. ¿Qué pasa con el escalón?"),
    options: [
      t("It learns AND too: a step is just a sharp sigmoid", "También aprende AND: un escalón es una sigmoide afilada"),
      t("It learns faster: a clean yes or no is a clearer signal", "Aprende más rápido: un sí o no limpio es una señal más clara"),
      t("It overshoots: the jump makes every nudge too big", "Se pasa de largo: el salto hace cada ajuste demasiado grande"),
      t("It never moves: its slope is 0, so every nudge is 0", "Nunca se mueve: su pendiente es 0, así que cada ajuste es 0"),
    ],
    answer: 3,
    why: t("A gradient asks: if this weight moved a little, how much would the output change? A step is flat on both sides of its jump, so the answer is 0 everywhere except at the jump, where there isn't one. Every nudge comes out 0: " + Math.round(SL.step.nudges) + " nudges in " + LOGIC_EPOCHS + " epochs, still at " + pct(SL.step.final) + ". A sigmoid always has a slope, steepest at the line (" + two(SL.sigSlope) + " for the point here), so every example pulls a little and it reached " + pct(SL.sigmoid.final) + ". It also reports how sure it is: " + two(SL.sigOut) + " for the point just across the line, where the step says a flat " + SL.stepOut + ". The perceptron rule gets around the flat step by using the mistake itself as the signal, which works for one neuron but not for neurons hidden inside a network, whose own target nobody knows; that is why networks use activations with a usable slope (sigmoid, tanh, ReLU) and train by gradient.",
      "Un gradiente pregunta: si este peso se moviera un poco, ¿cuánto cambiaría la salida? Un escalón es plano a ambos lados del salto, así que la respuesta es 0 en todas partes salvo en el salto, donde no hay respuesta. Cada ajuste sale 0: " + Math.round(SL.step.nudges) + " ajustes en " + LOGIC_EPOCHS + " épocas, y sigue en " + pct(SL.step.final) + ". Una sigmoide siempre tiene pendiente, más empinada en la línea (" + two(SL.sigSlope) + " para el punto de aquí), así que cada ejemplo tira un poco y llegó al " + pct(SL.sigmoid.final) + ". Además dice qué tan segura está: " + two(SL.sigOut) + " para el punto justo al otro lado de la línea, donde el escalón dice un " + SL.stepOut + " seco. La regla del perceptrón esquiva el escalón plano usando el error mismo como señal, y eso funciona para una neurona pero no para neuronas ocultas dentro de una red, cuyo objetivo propio nadie conoce; por eso las redes usan activaciones con una pendiente aprovechable (sigmoide, tanh, ReLU) y se entrenan por gradiente."),
    watch: { task: "and", act: "step", rule: "gradient", bias: "on", speed: 8, warm: 0 },
  },
  {
    id: "noise",
    title: t("Noisy data", "Datos ruidosos"),
    change: t(N_LOANS + " made-up loan applicants, a few decided against the rule · normalised inputs, the bias on, " + LOAN_EPOCHS + " epochs · a perceptron (step, nudged on mistakes) vs a sigmoid neuron trained by gradient",
      N_LOANS + " solicitantes de préstamo inventados, unos pocos decididos contra el criterio · entradas normalizadas, con sesgo, " + LOAN_EPOCHS + " épocas · un perceptrón (escalón, ajustado en los errores) vs una neurona sigmoide entrenada por gradiente"),
    question: t("No line separates these examples perfectly. After " + LOAN_EPOCHS + " epochs, whose line has stopped moving?", "Ninguna línea separa estos ejemplos a la perfección. Tras " + LOAN_EPOCHS + " épocas, ¿qué línea dejó de moverse?"),
    options: [
      t("The perceptron's: it stops once it has its best line", "La del perceptrón: se detiene cuando tiene su mejor línea"),
      t("The sigmoid's: it settles near the best line", "La de la sigmoide: se asienta cerca de la mejor línea"),
      t("Neither: noisy examples keep any line moving", "Ninguna: los ejemplos ruidosos mueven cualquier línea"),
      t("Both, on the same line", "Las dos, en la misma línea"),
    ],
    answer: 1,
    why: t("The perceptron rule stops only after a whole epoch without a mistake, and with noisy data that never comes. Every mistake gets a full-size nudge, however close the example is to the line, so the few applicants on the wrong side keep shoving it back and forth: it still moved " + mv(NO.perceptron.move) + " of the board per epoch at the end, and stopped at whatever line it happened to be on, " + pct(NO.perceptron.final) + " right. A smaller rate doesn't calm it: at a tenth of the rate it moved " + mv(NO.slow.move) + ", because a step's answers don't change when all the weights shrink together, so the weights just come out smaller and each nudge moves the line about as far. The sigmoid's nudge is the error times the input: large for an example it is sure about and wrong, small for one near the line, so the pulls from either side balance out where the error is lowest: it moved " + mv(NO.gradient.move) + " per epoch and ended at " + pct(NO.gradient.final) + ", against " + pct(NO.perceptron.best) + " for the best line. That neuron is logistic regression. A perceptron variant can keep the best line it has seen (Gallant's pocket algorithm, 1990), but it still never settles.",
      "La regla del perceptrón se detiene solo tras una época entera sin errores, y con datos ruidosos eso nunca llega. Cada error recibe un ajuste de tamaño completo, por cerca que esté el ejemplo de la línea, así que los pocos solicitantes del lado equivocado la empujan de un lado a otro: al final todavía movía el " + mv(NO.perceptron.move) + " del tablero por época, y se detuvo en la línea donde le tocó estar, con " + pct(NO.perceptron.final) + " de aciertos. Una tasa más pequeña no la calma: con un décimo de la tasa movía el " + mv(NO.slow.move) + ", porque las respuestas de un escalón no cambian cuando todos los pesos se achican juntos, así que los pesos solo salen más pequeños y cada ajuste mueve la línea más o menos lo mismo. El ajuste de la sigmoide es el error por la entrada: grande para un ejemplo del que está segura y se equivoca, pequeño para uno cerca de la línea, así que los tirones de cada lado se equilibran donde el error es menor: movía el " + mv(NO.gradient.move) + " por época y terminó con " + pct(NO.gradient.final) + ", contra " + pct(NO.perceptron.best) + " de la mejor línea. Esa neurona es la regresión logística. Una variante del perceptrón puede guardar la mejor línea que vio (el algoritmo de bolsillo, pocket algorithm, de Gallant, 1990), pero igual nunca se asienta."),
    watch: { task: "loans", act: "step", rule: "perceptron", bias: "on", inputs: "norm", speed: 40, warm: 193, cap: 200 },
  },
  {
    id: "scale",
    title: t("Unscaled inputs", "Entradas sin escalar"),
    change: t("The loans, a sigmoid neuron trained by gradient at rate " + RATE.gradient + ", " + SCALE_EPOCHS + " epochs · income in dollars a month (1,500 to 9,500) and a debt ratio (0.05 to 0.75) as they are vs both normalised · converged: the error (cross-entropy) within " + CLOSE + " of the lowest any line reaches, for 10 epochs running",
      "Los préstamos, una neurona sigmoide entrenada por gradiente con tasa " + RATE.gradient + ", " + SCALE_EPOCHS + " épocas · ingreso en dólares al mes (1,500 a 9,500) y una razón de deuda (0.05 a 0.75) tal como vienen vs las dos normalizadas · convergió: el error (entropía cruzada) a menos de " + CLOSE + " del mínimo que alcanza una línea, durante 10 épocas seguidas"),
    question: t("With the raw dollars, how does training go?", "Con los dólares crudos, ¿cómo va el entrenamiento?"),
    options: [
      t("The same: the weights just come out in other units", "Igual: los pesos solo salen en otras unidades"),
      t("Faster: big inputs make big, quick nudges", "Más rápido: entradas grandes dan ajustes grandes y rápidos"),
      t("It gets there, about ten times slower", "Llega, unas diez veces más lento"),
      t("It never converges: the line keeps swinging", "Nunca converge: la línea sigue dando bandazos"),
    ],
    answer: 3,
    why: t("A nudge to a weight is the rate × the error × that weight's input. Income runs in thousands, so its weight gets nudges thousands of times larger than the debt ratio's: one wrong answer swings the line across the board, the sigmoid saturates at 0 or 1, the next wrong answer swings it back. The line still swept " + mv(SC.raw.move) + " of the board per epoch after " + SCALE_EPOCHS + " epochs, at " + pct(SC.raw.final) + " right. A rate small enough to stop the swing doesn't save it: ten million times smaller, the line held still (" + mv(SC.rawSlow.move) + " an epoch) but the debt weight and the bias barely moved, and it stayed at " + pct(SC.rawSlow.final) + ". The same lines exist either way; one rate just can't suit inputs thousands of times apart. Normalised (each input minus its mean, divided by its standard deviation), both are about 1 and it converged in " + ep(SC.norm.at) + " epochs. Compute the mean and spread on the training data and apply the same ones when you predict: that's scikit-learn's StandardScaler, and LeCun and colleagues' advice in Efficient BackProp (1998).",
      "Un ajuste a un peso es la tasa × el error × la entrada de ese peso. El ingreso va en miles, así que su peso recibe ajustes miles de veces más grandes que el de la razón de deuda: una respuesta equivocada lleva la línea al otro lado del tablero, la sigmoide se satura en 0 o 1, y la siguiente respuesta equivocada la trae de vuelta. La línea todavía barría el " + mv(SC.raw.move) + " del tablero por época tras " + SCALE_EPOCHS + " épocas, con " + pct(SC.raw.final) + " de aciertos. Una tasa lo bastante pequeña para frenar los bandazos no la salva: diez millones de veces más pequeña, la línea se quedó quieta (" + mv(SC.rawSlow.move) + " por época) pero el peso de la deuda y el sesgo casi no se movieron, y se quedó en " + pct(SC.rawSlow.final) + ". Las mismas líneas existen en ambos casos; una sola tasa no le sirve a entradas que se diferencian miles de veces. Normalizadas (cada entrada menos su media, dividida por su desviación estándar), las dos rondan el 1 y convergió en " + ep(SC.norm.at) + " épocas. Calcula la media y la dispersión con los datos de entrenamiento y aplica las mismas al predecir: eso es el StandardScaler de scikit-learn, y el consejo de LeCun y sus colegas en Efficient BackProp (1998)."),
    watch: { task: "loans", act: "sigmoid", rule: "gradient", bias: "on", inputs: "raw", speed: 40, warm: 293, cap: 300 },
  },
];

const QUESTIONS = [
  [t("What does one artificial neuron compute, and where is what it has learned?", "¿Qué calcula una neurona artificial, y dónde está lo que aprendió?"),
    t("It multiplies each input by a weight, adds them up with a bias, and passes the sum through an activation: a step (yes when the sum is above 0) or a smooth curve such as the sigmoid. That's all. What it has learned is those numbers, here two weights and a bias; there is no memory of the examples and nothing else inside. A large network has billions of such numbers, but each unit does this same weighted sum.",
      "Multiplica cada entrada por un peso, las suma junto con un sesgo y pasa la suma por una activación: un escalón (sí cuando la suma es mayor que 0) o una curva suave como la sigmoide. Nada más. Lo que aprendió son esos números, aquí dos pesos y un sesgo; no guarda los ejemplos ni hay nada más adentro. Una red grande tiene miles de millones de esos números, pero cada unidad hace esta misma suma ponderada.")],
  [t("Why does a neuron with two inputs draw a straight line, and what do the weights and the bias each do to it?", "¿Por qué una neurona con dos entradas traza una línea recta, y qué le hacen los pesos y el sesgo?"),
    t("The answer flips where w1·x1 + w2·x2 + b = 0, and that equation is a straight line. The weights set its direction (the line runs across the vector (w1, w2), and the yes side is the side it points to); the bias slides it without turning it. With no bias it must pass through the origin. Doubling all three numbers leaves the line where it is: a step's answers don't change, while a sigmoid becomes surer on both sides. With more inputs the line becomes a flat plane (a hyperplane), but still flat.",
      "La respuesta cambia donde w1·x1 + w2·x2 + b = 0, y esa ecuación es una línea recta. Los pesos fijan su dirección (la línea va de través al vector (w1, w2), y el lado del sí es hacia donde apunta); el sesgo la desliza sin girarla. Sin sesgo tiene que pasar por el origen. Duplicar los tres números deja la línea donde está: las respuestas de un escalón no cambian, y una sigmoide se vuelve más segura a ambos lados. Con más entradas la línea se vuelve un plano (un hiperplano), pero sigue siendo plano.")],
  [t("Why can't one neuron learn XOR, however long it trains?", "¿Por qué una neurona no puede aprender XOR, por mucho que entrene?"),
    t("XOR's yes examples, (0, 1) and (1, 0), and its no examples, (0, 0) and (1, 1), sit on crossing diagonals of the square, and no straight line puts both yes corners on one side and both no corners on the other: the best is 3 of 4. Training can only move the line, so more epochs, another rate or another activation don't help. Minsky and Papert's Perceptrons (1969) made the point. It takes more than one line: a second neuron, or a feature such as x1·x2 given to the first; networks get there with a hidden layer.",
      "Los ejemplos de sí de XOR, (0, 1) y (1, 0), y los de no, (0, 0) y (1, 1), quedan en diagonales cruzadas del cuadrado, y ninguna línea recta pone las dos esquinas de sí de un lado y las dos de no del otro: lo mejor es 3 de 4. El entrenamiento solo puede mover la línea, así que más épocas, otra tasa u otra activación no ayudan. Minsky y Papert lo plantearon en Perceptrons (1969). Hace falta más de una línea: una segunda neurona, o una característica como x1·x2 dada a la primera; las redes lo logran con una capa oculta.")],
  [t("The perceptron rule and gradient training both add rate × error × input to a weight. What's the difference?", "La regla del perceptrón y el entrenamiento por gradiente suman ambos tasa × error × entrada a un peso. ¿Cuál es la diferencia?"),
    t("The error. For the perceptron it is the target minus the step's answer: 0 when right, ±1 when wrong, the same size however close the call. If a line separates the examples, the perceptron convergence theorem (in Novikoff's 1962 proof) says the rule stops after a finite number of mistakes; if none does, it never stops. For gradient training of a sigmoid neuron, the error is the target minus the sigmoid's output: never quite 0, small near the line, large for a confident mistake. That is the slope of the cross-entropy, so the weights head for its minimum and settle there, noisy data or not. That neuron is logistic regression.",
      "El error. Para el perceptrón es el objetivo menos la respuesta del escalón: 0 si acierta, ±1 si se equivoca, del mismo tamaño por cerca que esté. Si una línea separa los ejemplos, el teorema de convergencia del perceptrón (en la demostración de Novikoff, de 1962) dice que la regla se detiene tras un número finito de errores; si ninguna los separa, nunca se detiene. En el entrenamiento por gradiente de una neurona sigmoide, el error es el objetivo menos la salida de la sigmoide: nunca exactamente 0, pequeño cerca de la línea, grande para un error seguro. Esa es la pendiente de la entropía cruzada, así que los pesos van hacia su mínimo y se asientan ahí, con datos ruidosos o no. Esa neurona es la regresión logística.")],
  [t("One input is a salary in dollars, another a ratio between 0 and 1. What goes wrong, and what do you do?", "Una entrada es un salario en dólares y otra una razón entre 0 y 1. ¿Qué sale mal y qué haces?"),
    t("Each weight's nudge is proportional to its input, so the salary's weight gets nudges thousands of times larger: with a rate that suits the ratio, the line swings back and forth on the salary; with a rate that suits the salary, the ratio's weight and the bias crawl. Normalise: subtract each input's mean and divide by its standard deviation (or scale it to a fixed range), with the numbers computed on the training data and reused unchanged when the model predicts. Forgetting that second part, or computing them on all the data including the test set, are the classic bugs.",
      "El ajuste de cada peso es proporcional a su entrada, así que el peso del salario recibe ajustes miles de veces más grandes: con una tasa que le sirve a la razón, la línea va y viene por el salario; con una tasa que le sirve al salario, el peso de la razón y el sesgo apenas avanzan. Normaliza: resta la media de cada entrada y divide por su desviación estándar (o llévala a un rango fijo), con esos números calculados sobre los datos de entrenamiento y reusados sin cambios cuando el modelo predice. Olvidar esa segunda parte, o calcularlos con todos los datos incluido el conjunto de prueba, son los errores clásicos.")],
  [t("Where does a single neuron like this one still run in real systems?", "¿Dónde sigue funcionando una sola neurona como esta en sistemas reales?"),
    t("A sigmoid neuron trained on cross-entropy is logistic regression, still a standard model for yes-or-no predictions where each weight has to be explained, such as credit scoring, and the usual baseline to beat. The output unit of a network that answers yes or no is the same neuron, fed by the layers below instead of by raw inputs. And it is where the field started: Rosenblatt's Mark I Perceptron, demonstrated in 1960, kept its weights in potentiometers turned by electric motors, the riders of this machine in hardware.",
      "Una neurona sigmoide entrenada con entropía cruzada es la regresión logística, todavía un modelo estándar para predicciones de sí o no donde hay que explicar cada peso, como la evaluación de crédito, y la línea base habitual a superar. La unidad de salida de una red que responde sí o no es la misma neurona, alimentada por las capas de abajo en vez de por las entradas crudas. Y es donde empezó el campo: el Mark I Perceptron de Rosenblatt, presentado en 1960, guardaba sus pesos en potenciómetros girados por motores eléctricos, las pesas corredizas de esta máquina hechas hardware.")],
];

export default defineLesson({
  title: t("Neuron Workbench", "Banco de trabajo: neurona"),
  eyebrow: t("Systems lesson 85 · Neuron", "Lección de sistemas 85 · Neurona"),
  lede: t("An artificial neuron multiplies each input by a weight, adds a bias and passes the sum through an activation. With two inputs that draws a straight line across the input plane, yes on one side and no on the other, and training nudges the line after each mistake. One line is all it can draw: it learns AND, never XOR, and that limit is why networks have layers. This lesson turns it into a weighing station beside a decision board: watch it, predict what it can learn, then explain it back.",
    "Una neurona artificial multiplica cada entrada por un peso, suma un sesgo (bias) y pasa la suma por una activación. Con dos entradas eso traza una línea recta sobre el plano de las entradas, sí de un lado y no del otro, y el entrenamiento mueve la línea después de cada error. Una línea es todo lo que puede trazar: aprende AND, nunca XOR, y ese límite es la razón de que las redes tengan capas. Esta lección la convierte en una estación de pesaje junto a un tablero de decisión: mírala, predice qué puede aprender y después explícala."),
  machine: {
    intro: t("Each example is weighed in turn. The riders X1 and X2 carry its inputs and sit at the distance their weights set, in front of the fulcrum for a positive weight and behind it for a negative one; the bias rider always carries 1. The beam tilts by the sum, and the meter in front reads the activation: a step snaps to NO or YES, a sigmoid says how sure it is. On the board, the ruler lies where the sum is zero and the shaded side is yes. When training nudges the weights, the riders slide and the ruler moves. Try the four logic rules and the loans, the activation, the training rule, the bias, and raw or normalised inputs.",
      "Cada ejemplo se pesa por turno. Las pesas corredizas X1 y X2 llevan sus entradas y se ubican a la distancia que fijan sus pesos, delante del punto de apoyo si el peso es positivo y detrás si es negativo; la pesa del sesgo siempre lleva 1. La viga se inclina según la suma, y el medidor de adelante lee la activación: un escalón salta a NO o SÍ, una sigmoide dice qué tan segura está. En el tablero, el listón está donde la suma es cero y el lado sombreado es el sí. Cuando el entrenamiento ajusta los pesos, las pesas se deslizan y el listón se mueve. Prueba las cuatro funciones lógicas y los préstamos, la activación, la regla de entrenamiento, el sesgo y las entradas crudas o normalizadas."),
    plate: {
      title: t("Weighing station", "Estación de pesaje"),
      keys: [
        { mark: "lit", label: t("A mistake: an example on the wrong side of the line", "Un error: un ejemplo del lado equivocado de la línea") },
        { mark: "raised", label: t("The riders; on the board, a yes example (a round stud) and the ruler, where the sum is 0", "Las pesas; en el tablero, un ejemplo de sí (un perno redondo) y el listón, donde la suma es 0") },
        { mark: "flat", label: t("A no example (a square tile); the shaded side is where the neuron says yes", "Un ejemplo de no (una baldosa cuadrada); el lado sombreado es donde la neurona dice sí") },
        { mark: "dashed", label: t("With a sigmoid: where it says 0.1 and 0.9", "Con una sigmoide: donde dice 0.1 y 0.9") },
      ],
      caption: t(
        "The scale beside the beam reads the weights from −5 to +5; a rider whose weight is beyond the scale waits at its end. The beam tilts with the sum, up to 9°, and OUTPUT shows what the activation reports for the example in play (ringed on the board). RIGHT counts the examples on the correct side of the line, EPOCH the passes through all of them in a shuffled order, NUDGES the times training changed the weights. The logic rules have inputs 0 and 1; the dashed lines on their board are where each input is 0, crossing at the origin. The loans are " + N_LOANS + " made-up applicants, monthly income against debt ratio; the decisions follow a rule loosely, so a few went the other way. Rates: " + RATE.perceptron + " for the perceptron rule, " + RATE.gradient + " for gradient training.",
        "La escala junto a la viga lee los pesos de −5 a +5; una pesa cuyo peso se sale de la escala espera en su extremo. La viga se inclina con la suma, hasta 9°, y SALIDA muestra lo que responde la activación para el ejemplo en juego (con un anillo en el tablero). ACIERTOS cuenta los ejemplos del lado correcto de la línea, ÉPOCA las pasadas por todos ellos en orden mezclado, AJUSTES las veces que el entrenamiento cambió los pesos. Las funciones lógicas tienen entradas 0 y 1; las líneas punteadas de su tablero son donde cada entrada vale 0, y se cruzan en el origen. Los préstamos son " + N_LOANS + " solicitantes inventados, ingreso mensual contra razón de deuda; las decisiones siguen un criterio a grandes rasgos, así que unas pocas fueron al revés. Tasas: " + RATE.perceptron + " para la regla del perceptrón, " + RATE.gradient + " para el entrenamiento por gradiente.",
      ),
      stage: { "data-neuron": "" },
      label: t("Neuron simulation. Space pauses or resumes.", "Simulación de una neurona. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["right", t("Right", "Aciertos"), "–"],
      ["best", t("Best so far", "Lo mejor hasta ahora"), "–"],
      ["epoch", t("Epoch", "Época"), "0"],
      ["nudges", t("Nudges", "Ajustes"), "0"],
      ["weights", t("Weights: x1 · x2 · bias", "Pesos: x1 · x2 · sesgo"), "–"],
      ["moved", t("Line moved per epoch (last 10)", "Movimiento de la línea por época (últimas 10)"), "–"],
    ],
    controls: [
      { seg: "task", label: t("Examples", "Ejemplos"), options: [["and", "AND"], ["or", "OR"], ["nand", "NAND"], ["xor", "XOR"], ["loans", t("Loans", "Préstamos")]], value: "and" },
      { seg: "act", label: t("Activation", "Activación"), options: [["step", t("Step", "Escalón")], ["sigmoid", t("Sigmoid", "Sigmoide")]], value: "step" },
      { seg: "rule", label: t("Training", "Entrenamiento"), options: [["perceptron", t("Nudge on mistakes (perceptron)", "Ajustar en los errores (perceptrón)")], ["gradient", t("Follow the gradient", "Seguir el gradiente")]], value: "perceptron" },
      { seg: "bias", label: t("Bias", "Sesgo"), options: [["on", t("On", "Con sesgo")], ["off", t("Off", "Sin sesgo")]], value: "on" },
      { seg: "inputs", label: t("Inputs", "Entradas"), options: [["norm", t("Normalised", "Normalizadas")], ["raw", t("Raw dollars", "Dólares crudos")]], value: "norm", for: "loans", hidden: true },
      { speed: true, options: [[2, "2/s"], [8, "8/s"], [40, "40/s"], [200, "200/s"]], value: 2 },
      { actions: [["train", t("Train", "Entrenar"), { primary: true }], ["one", t("One example", "Un ejemplo")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Speed is in examples a second. Changing a setting starts the run again from the same starting weights; Start over draws new ones. Train starts or stops training; One example trains on the next example only. A run that settles, converges or reaches its last epoch (" + LOGIC_EPOCHS + " for the logic rules, " + SCALE_EPOCHS + " for the loans) rests a few seconds and starts over.",
      "La velocidad es en ejemplos por segundo. Cambiar un ajuste reinicia la ejecución desde los mismos pesos iniciales; Empezar de nuevo sortea otros. Entrenar inicia o detiene el entrenamiento; Un ejemplo entrena solo con el siguiente ejemplo. Una ejecución que se asienta, converge o llega a su última época (" + LOGIC_EPOCHS + " para las funciones lógicas, " + SCALE_EPOCHS + " para los préstamos) descansa unos segundos y empieza de nuevo."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs, each with its own starting weights and shuffling and, for the loans, its own " + N_LOANS + " applicants.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija, cada una con sus propios pesos iniciales y su propio orden y, en los préstamos, sus propios " + N_LOANS + " solicitantes."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; the loan applicants are made up. The perceptron rule is Rosenblatt's (<a href="https://pubmed.ncbi.nlm.nih.gov/13602029/" target="_blank" rel="noopener">Psychological Review, 1958</a>); the convergence theorem follows Novikoff's proof (1962); the Mark I Perceptron, its weights in motor-driven potentiometers, was built at the Cornell Aeronautical Laboratory and is now at the Smithsonian; the XOR limit is from Minsky and Papert's <em>Perceptrons</em> (1969); the pocket algorithm is Gallant's (1990); the advice on input scaling follows LeCun, Bottou, Orr and Müller, <a href="https://leon.bottou.org/papers/lecun-98x" target="_blank" rel="noopener">Efficient BackProp</a> (1998).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; los solicitantes de préstamo son inventados. La regla del perceptrón es de Rosenblatt (<a href="https://pubmed.ncbi.nlm.nih.gov/13602029/" target="_blank" rel="noopener">Psychological Review, 1958</a>); el teorema de convergencia sigue la demostración de Novikoff (1962); el Mark I Perceptron, con sus pesos en potenciómetros movidos por motores, se construyó en el Cornell Aeronautical Laboratory y hoy está en el Smithsonian; el límite de XOR, del libro <em>Perceptrons</em> de Minsky y Papert (1969); el algoritmo de bolsillo, de Gallant (1990); el consejo sobre escalar las entradas sigue a LeCun, Bottou, Orr y Müller, <a href="https://leon.bottou.org/papers/lecun-98x" target="_blank" rel="noopener">Efficient BackProp</a> (1998).`),
  css: LIT_FILL_CSS + `
.iso-stage [data-layer] text{pointer-events:none}
.nr-yes{fill:var(--anatomy-lo);opacity:.4;stroke:none}
`,
  data: {
    P,
    TOK: { logic: { yes: tokenSvg("yes", "logic"), no: tokenSvg("no", "logic") }, loans: { yes: tokenSvg("yes", "loans"), no: tokenSvg("no", "loans") } },
    RING: { logic: ringSvg("logic"), loans: ringSvg("loans") },
  },
});
