// @ts-nocheck: content in the style of the other lessons
// Systems lesson 81 · Timing attacks: a combination checker whose answer takes longer the more dials match, a
// stopwatch that averages it out of the noise, and the constant-time comparison that leaves nothing to average.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { int, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, P, GEOMETRY } from "./figure";
import { bruteRun, noiseRun, constRun, delayRun, lengthRun, NOISES, SAMPLE_STEPS, DELAY, MANY, CHANCE, LENGTHS, DIALS, BASE, STEP, DEFAULTS, RUN_COUNT } from "./sim";

// Experiment results, computed at build time from the same checker the machine runs (200 seeded runs each).
const R = { brute: bruteRun(), noise: noiseRun(), cons: constRun(), delay: delayRun(), length: lengthRun() };

const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const ONE_IN = int(1 / CHANCE);
// A constant-time result as a count of runs, so one lucky run reads as luck, not as a leak.
const ofRuns = (rate) => int(rate * RUN_COUNT) + " of " + RUN_COUNT + " runs";
const deEjecuciones = (rate) => int(rate * RUN_COUNT) + " de " + RUN_COUNT + " ejecuciones abiertas";
const slash = (rate) => int(rate * RUN_COUNT) + "/" + RUN_COUNT;
const S0 = DEFAULTS.samples;
const rowOf = (noise, samples) => R.noise.find((g) => g.noise === noise).rows.find((r) => r.samples === samples).rate;

const RUNS = {
  brute: () => {
    const { four, eight } = R.brute, m = top(Math.log10(eight.brute));
    const lg = (x) => Math.log10(x) / m;
    return {
      verdict: t("4 dials: brute force needs " + int(four.brute) + " tries on average, the listener took " + int(four.listen) + " readings and opened " + pct(four.rate) + " of runs. 8 dials: " + int(eight.brute) + " tries against " + int(eight.listen) + " readings, " + pct(eight.rate) + " opened.",
        "4 diales: la fuerza bruta necesita " + int(four.brute) + " intentos en promedio; quien escucha tomó " + int(four.listen) + " lecturas y abrió el " + pct(four.rate) + " de las ejecuciones. 8 diales: " + int(eight.brute) + " intentos contra " + int(eight.listen) + " lecturas, " + pct(eight.rate) + " abiertas."),
      groups: [
        { title: t("4 dials (bars on a log scale)", "4 diales (barras en escala logarítmica)"), bars: [[t("Brute force, tries", "Fuerza bruta, intentos"), lg(four.brute), int(four.brute)], [t("Listener, readings", "Quien escucha, lecturas"), lg(four.listen), int(four.listen)]] },
        { title: t("8 dials (bars on a log scale)", "8 diales (barras en escala logarítmica)"), bars: [[t("Brute force, tries", "Fuerza bruta, intentos"), lg(eight.brute), int(eight.brute)], [t("Listener, readings", "Quien escucha, lecturas"), lg(eight.listen), int(eight.listen), true]] },
      ],
    };
  },
  noise: () => ({
    verdict: t("Runs opened, by readings per digit: " + R.noise.map((g) => "noise " + g.noise + ": " + g.rows.map((r) => int(r.samples) + " → " + pct(r.rate)).join(", ")).join("; ") + ".",
      "Ejecuciones abiertas, por lecturas por dígito: " + R.noise.map((g) => "ruido " + g.noise + ": " + g.rows.map((r) => int(r.samples) + " → " + pct(r.rate)).join(", ")).join("; ") + "."),
    groups: R.noise.map((g) => ({
      title: t("Noise " + g.noise + " (one dial = " + STEP + ")", "Ruido " + g.noise + " (un dial = " + STEP + ")"),
      bars: g.rows.map((r) => [t(int(r.samples) + " readings per digit", int(r.samples) + " lecturas por dígito"), r.rate, pct(r.rate), g.noise === 8 && r.samples === 1280]),
    })),
  }),
  cons: () => {
    const { early, cons, samples } = R.cons;
    return {
      verdict: t("With " + int(samples) + " readings per digit: early exit opened " + pct(early) + " of runs, constant time " + ofRuns(cons) + ". Blind luck opens 1 run in " + ONE_IN + ".",
        "Con " + int(samples) + " lecturas por dígito: la salida temprana abrió el " + pct(early) + " de las ejecuciones; con tiempo constante, " + deEjecuciones(cons) + ". La suerte a ciegas abre 1 ejecución de cada " + ONE_IN + "."),
      bars: [[t("Early exit", "Salida temprana"), early, pct(early)], [t("Constant time", "Tiempo constante"), cons, slash(cons), true]],
    };
  },
  delay: () => {
    const { none, delayFew, delayMany, cons } = R.delay;
    return {
      verdict: t("Early exit with no delay, " + int(S0) + " readings per digit: " + pct(none) + " opened. With the 0–" + DELAY + " delay: " + pct(delayFew) + " at " + int(S0) + ", " + pct(delayMany) + " at " + int(MANY) + ". Constant time, no delay, " + int(MANY) + " readings: " + ofRuns(cons) + ", the luck of blind picks (1 in " + ONE_IN + ").",
        "Salida temprana sin espera, " + int(S0) + " lecturas por dígito: " + pct(none) + " abiertas. Con la espera de 0–" + DELAY + ": " + pct(delayFew) + " con " + int(S0) + " y " + pct(delayMany) + " con " + int(MANY) + ". Tiempo constante, sin espera, " + int(MANY) + " lecturas: " + deEjecuciones(cons) + ", la suerte de elegir a ciegas (1 de cada " + ONE_IN + ")."),
      bars: [[t("No delay, " + int(S0), "Sin espera, " + int(S0)), none, pct(none)], [t("Delay, " + int(S0), "Espera, " + int(S0)), delayFew, pct(delayFew)], [t("Delay, " + int(MANY), "Espera, " + int(MANY)), delayMany, pct(delayMany), true], [t("Constant time, " + int(MANY), "Tiempo constante, " + int(MANY)), cons, slash(cons)]],
    };
  },
  length: () => {
    const { raw, fixed, chance, samples } = R.length;
    return {
      verdict: t("With " + samples + " readings per length, the listener found the secret's length in " + pct(raw) + " of runs comparing raw inputs, and in " + pct(fixed) + " comparing fixed-length digests, about the " + pct(chance) + " of a blind pick among " + LENGTHS.length + " lengths.",
        "Con " + samples + " lecturas por longitud, quien escucha encontró la longitud del secreto en el " + pct(raw) + " de las ejecuciones comparando las entradas tal cual, y en el " + pct(fixed) + " comparando resúmenes de longitud fija, cerca del " + pct(chance) + " de elegir a ciegas entre " + LENGTHS.length + " longitudes."),
      bars: [[t("Raw inputs", "Entradas tal cual"), raw, pct(raw), true], [t("Fixed-length digests", "Resúmenes de longitud fija"), fixed, pct(fixed)], [t("Blind pick", "Elegir a ciegas"), chance, pct(chance)]],
    };
  },
};

const { brute: B, cons: C, delay: D, length: N } = R;

const EXPERIMENTS = [
  {
    id: "brute",
    title: t("Guess blind, or listen", "Adivinar a ciegas, o escuchar"),
    change: t("An early-exit checker · noise 4 · " + int(S0) + " readings per digit · a secret of 4 dials, then 8 · brute force (try every combination) vs the listener (time each digit, keep the slowest)",
      "Un verificador con salida temprana · ruido 4 · " + int(S0) + " lecturas por dígito · un secreto de 4 diales, después de 8 · fuerza bruta (probar todas las combinaciones) vs quien escucha (medir cada dígito y quedarse con el más lento)"),
    question: t("Going from 4 dials to 8, how does the listener's work grow?", "Al pasar de 4 diales a 8, ¿cómo crece el trabajo de quien escucha?"),
    options: [
      t("About ×10,000, like brute force: each dial multiplies the work", "Unas ×10,000, como la fuerza bruta: cada dial multiplica el trabajo"),
      t("A bit over ×2: each dial adds about the same work", "Algo más de ×2: cada dial suma más o menos el mismo trabajo"),
      t("Not at all: the work doesn't depend on the length", "Nada: el trabajo no depende de la longitud"),
    ],
    answer: 1,
    why: t(
      "An early-exit comparison stops at the first wrong dial, so a guess whose first dials are right takes one step longer. That answers one dial at a time: the listener times each of ten digits, keeps the slowest, and moves on. Its work adds up per dial, " + int(B.four.listen) + " readings at 4 dials and " + int(B.eight.listen) + " at 8, while brute force multiplies by ten per dial: " + int(B.four.brute) + " tries on average at 4, " + int(B.eight.brute) + " at 8. At 4 dials, guessing blind is actually cheaper; at 8, listening is thousands of times cheaper. The leak turns about 10ⁿ work into about n × 10 × samples, so it matters more as secrets get longer, not less. (The last dial leaves no trace, since right or wrong the checker looks at all of them, so it is tried by hand: ten tries.)",
      "Una comparación con salida temprana se detiene en el primer dial equivocado, así que un intento cuyos primeros diales están bien tarda un paso más. Eso responde un dial a la vez: quien escucha mide cada uno de los diez dígitos, se queda con el más lento y sigue. Su trabajo se suma por dial, " + int(B.four.listen) + " lecturas con 4 diales y " + int(B.eight.listen) + " con 8, mientras la fuerza bruta se multiplica por diez por dial: " + int(B.four.brute) + " intentos en promedio con 4, " + int(B.eight.brute) + " con 8. Con 4 diales, adivinar a ciegas en realidad sale más barato; con 8, escuchar es miles de veces más barato. La fuga convierte un trabajo de unos 10ⁿ en unos n × 10 × muestras, así que importa más cuanto más largo es el secreto, no menos. (El último dial no deja rastro, porque bien o mal el verificador los revisa todos, así que se prueba a mano: diez intentos.)",
    ),
    watch: { compare: "early", noise: 4, samples: 320, delay: 0, probe: "dials", input: "raw", speed: 64, warm: 2600 },
  },
  {
    id: "noise",
    title: t("A noisier stopwatch", "Un cronómetro con más ruido"),
    change: t("Early exit · one dial adds " + STEP + " unit to a check of about " + BASE + " · noise " + NOISES.join(", ") + " (the spread of each reading) · " + SAMPLE_STEPS.map(int).join(", ") + " readings per digit",
      "Salida temprana · un dial suma " + STEP + " unidad a una comprobación de unas " + BASE + " · ruido " + NOISES.join(", ") + " (la dispersión de cada lectura) · " + SAMPLE_STEPS.map(int).join(", ") + " lecturas por dígito"),
    question: t("When the noise doubles, how many readings per digit does the listener need to open the lock as often?", "Cuando el ruido se duplica, ¿cuántas lecturas por dígito necesita quien escucha para abrir la cerradura igual de seguido?"),
    options: [
      t("Twice as many: noise and readings trade one for one", "El doble: el ruido y las lecturas se compensan uno a uno"),
      t("About four times as many: averaging cuts noise by a square root", "Unas cuatro veces más: promediar reduce el ruido con una raíz cuadrada"),
      t("No number: noise bigger than the signal hides it for good", "Ninguna cantidad: un ruido mayor que la señal la esconde para siempre"),
    ],
    answer: 1,
    why: t(
      "The average of n readings has a spread of noise ÷ √n, so to see the same one-unit difference with twice the noise you need four times the readings: noise 2 with 80 readings opened " + pct(rowOf(2, 80)) + ", noise 4 with 320 " + pct(rowOf(4, 320)) + ", noise 8 with 1,280 " + pct(rowOf(8, 1280)) + ". Even noise eight times the signal gives way. That is what people get wrong about network jitter: it doesn't hide a small difference, it only raises the number of samples, and samples are cheap to someone who can send requests. It is the same averaging lesson 44, Percentiles, uses on latency, turned around.",
      "El promedio de n lecturas tiene una dispersión de ruido ÷ √n, así que para ver la misma diferencia de una unidad con el doble de ruido hacen falta cuatro veces más lecturas: ruido 2 con 80 lecturas abrió el " + pct(rowOf(2, 80)) + ", ruido 4 con 320 el " + pct(rowOf(4, 320)) + " y ruido 8 con 1,280 el " + pct(rowOf(8, 1280)) + ". Incluso un ruido ocho veces mayor que la señal termina cediendo. En eso se equivoca la gente con la variación aleatoria (jitter) de la red: no esconde una diferencia pequeña, solo sube la cantidad de muestras, y las muestras son baratas para quien puede enviar solicitudes. Es el mismo promedio que usa la lección 44, Percentiles, con la latencia, visto al revés.",
    ),
    watch: { compare: "early", noise: 8, samples: 1280, delay: 0, probe: "dials", input: "raw", speed: 64, warm: 9600 },
  },
  {
    id: "cons",
    title: t("Check every dial", "Revisar todos los diales"),
    change: t("Constant-time comparison: the checker looks at all " + DIALS + " dials whatever the guess · noise 4 · " + int(C.samples) + " readings per digit",
      "Comparación en tiempo constante: el verificador revisa los " + DIALS + " diales sea cual sea el intento · ruido 4 · " + int(C.samples) + " lecturas por dígito"),
    question: t("How often does the listener open the lock now?", "¿Qué tan seguido abre la cerradura quien escucha ahora?"),
    options: [
      t("As often as before, only slower: the difference is still there", "Igual que antes, solo más lento: la diferencia sigue ahí"),
      t("Less often, until more readings bring the difference back", "Menos seguido, hasta que más lecturas traen de vuelta la diferencia"),
      t("About as often as blind luck: there's nothing left to average", "Más o menos como la suerte a ciegas: no queda nada que promediar"),
    ],
    answer: 2,
    why: t(
      "Now every guess costs the same: the time no longer depends on how many dials match. Averaging can only find a difference that exists, so the bars settle level and each pick is a blind guess: " + ofRuns(C.cons) + " opened, against " + pct(C.early) + " with early exit (blind luck is 1 run in " + ONE_IN + " here). In code, compare secrets with the library's constant-time function: crypto.timingSafeEqual in Node.js, hmac.compare_digest in Python, subtle.ConstantTimeCompare in Go. They look at every byte and combine the differences without branching on them. A plain == on strings or byte arrays usually returns at the first difference, and a hand-written loop can be turned back into an early exit by the compiler, so use the library.",
      "Ahora cada intento cuesta lo mismo: el tiempo ya no depende de cuántos diales coinciden. Promediar solo encuentra una diferencia que existe, así que las barras quedan parejas y cada elección es a ciegas: " + deEjecuciones(C.cons) + ", contra el " + pct(C.early) + " con salida temprana (la suerte a ciegas abre 1 ejecución de cada " + ONE_IN + " aquí). En el código, compara secretos con la función de tiempo constante de la biblioteca: crypto.timingSafeEqual en Node.js, hmac.compare_digest en Python, subtle.ConstantTimeCompare en Go. Revisan cada byte y combinan las diferencias sin ramificar según ellas. Un == común sobre cadenas o arreglos de bytes suele volver en la primera diferencia, y un bucle escrito a mano puede volver a convertirse en salida temprana por obra del compilador, así que usa la biblioteca.",
    ),
    watch: { compare: "const", noise: 4, samples: 320, delay: 0, probe: "dials", input: "raw", speed: 64, warm: 2600 },
  },
  {
    id: "delay",
    title: t("Add a random delay", "Agregar una espera al azar"),
    change: t("Early exit · before answering, the checker waits a random 0–" + DELAY + " units, " + DELAY + " times what one dial adds · " + int(S0) + " readings per digit, then " + int(MANY),
      "Salida temprana · antes de responder, el verificador espera al azar de 0 a " + DELAY + " unidades, " + DELAY + " veces lo que suma un dial · " + int(S0) + " lecturas por dígito, después " + int(MANY)),
    question: t("With the random delay and " + int(MANY) + " readings per digit, how often does the listener open the lock?", "Con la espera al azar y " + int(MANY) + " lecturas por dígito, ¿qué tan seguido abre la cerradura quien escucha?"),
    options: [
      t("Almost never: the delay buries a one-unit difference", "Casi nunca: la espera entierra una diferencia de una unidad"),
      t("Almost always: the delay averages out like other noise", "Casi siempre: la espera se promedia como cualquier otro ruido"),
      t("About half the time: the delay hides some of the dials", "Más o menos la mitad: la espera esconde algunos diales"),
    ],
    answer: 1,
    why: t(
      "A random delay is just more noise: every guess gets the same delay on average, so the difference between a right and a wrong digit survives in the means. It only raises the readings needed: " + pct(D.none) + " opened with no delay, " + pct(D.delayFew) + " with it at " + int(S0) + " readings, " + pct(D.delayMany) + " at " + int(MANY) + ". Meanwhile every honest request got slower. The fix is to remove the difference, not to blur it: with constant time, " + ofRuns(D.cons) + " opened at " + int(MANY) + " readings, the luck of blind picks. Limiting how many checks one client can make (lesson 05, Rate limiting) is a good second layer, because it caps the samples anyone gets.",
      "Una espera al azar es solo más ruido: cada intento recibe la misma espera en promedio, así que la diferencia entre un dígito correcto y uno equivocado sobrevive en los promedios. Solo sube las lecturas necesarias: se abrió el " + pct(D.none) + " sin espera, el " + pct(D.delayFew) + " con ella y " + int(S0) + " lecturas, y el " + pct(D.delayMany) + " con " + int(MANY) + ". Mientras tanto, cada solicitud legítima se volvió más lenta. La solución es quitar la diferencia, no difuminarla: con tiempo constante, " + deEjecuciones(D.cons) + " con " + int(MANY) + " lecturas, la suerte de elegir a ciegas. Limitar cuántas comprobaciones puede hacer un cliente (lección 05, Limitación de tasa) es una buena segunda capa, porque pone un tope a las muestras que alguien consigue.",
    ),
    watch: { compare: "early", noise: 4, samples: 2560, delay: 40, probe: "dials", input: "raw", speed: 64, warm: 21000 },
  },
  {
    id: "length",
    title: t("The length gives itself away", "La longitud se delata"),
    change: t("Constant-time comparison of the dials · the listener times guesses " + LENGTHS[0] + " to " + LENGTHS[LENGTHS.length - 1] + " dials long · compare the raw inputs (a guess of the wrong length is rejected before any dial) vs an HMAC of both sides first (fixed-length digests) · " + N.samples + " readings per length",
      "Comparación de los diales en tiempo constante · quien escucha mide intentos de " + LENGTHS[0] + " a " + LENGTHS[LENGTHS.length - 1] + " diales · comparar las entradas tal cual (un intento de longitud equivocada se rechaza antes de revisar diales) vs un HMAC de ambos lados primero (resúmenes de longitud fija) · " + N.samples + " lecturas por longitud"),
    question: t("Comparing the raw inputs, how often does the listener find the secret's length?", "Comparando las entradas tal cual, ¿qué tan seguido encuentra quien escucha la longitud del secreto?"),
    options: [
      t("About as often as a blind pick: the comparison is constant time", "Como elegir a ciegas: la comparación es de tiempo constante"),
      t("Every time: only the right length goes on to compare", "Siempre: solo la longitud correcta pasa a comparar"),
      t("Some of the time: " + N.samples + " readings are too few to tell", "Algunas veces: " + N.samples + " lecturas son muy pocas para saberlo"),
    ],
    answer: 1,
    why: t(
      "Constant-time functions are constant time only for inputs of the same length. A guess of the wrong length is turned away before any dial is compared, so it comes back sooner, and the right length stands out: found in " + pct(N.raw) + " of runs. The library functions handle this differently: Node.js's timingSafeEqual throws when the lengths differ, Go's ConstantTimeCompare returns 0 at once, and Python's documentation says compare_digest may reveal the lengths, though not the contents. Comparing an HMAC of each side (or a hash, for a token you store) makes both inputs the same fixed length, and the digest's bytes no longer follow the guess's: " + pct(N.fixed) + ", about the " + pct(N.chance) + " of a blind pick.",
      "Las funciones de tiempo constante lo son solo para entradas de la misma longitud. Un intento de longitud equivocada se rechaza antes de comparar ningún dial, así que vuelve antes, y la longitud correcta resalta: se encontró en el " + pct(N.raw) + " de las ejecuciones. Las funciones de biblioteca lo manejan distinto: timingSafeEqual de Node.js lanza un error si las longitudes difieren, ConstantTimeCompare de Go devuelve 0 de inmediato, y la documentación de Python dice que compare_digest puede revelar las longitudes, aunque no el contenido. Comparar un HMAC de cada lado (o un hash, para un token que guardas) hace que las dos entradas tengan la misma longitud fija, y los bytes del resumen ya no siguen a los del intento: " + pct(N.fixed) + ", cerca del " + pct(N.chance) + " de elegir a ciegas.",
    ),
    watch: { compare: "const", noise: 4, samples: 20, delay: 0, probe: "length", input: "raw" },
  },
];

const QUESTIONS = [
  [t("Why does comparing a secret with == leak it, when the answer is only yes or no?", "¿Por qué comparar un secreto con == lo filtra, si la respuesta es solo sí o no?"),
    t("Because the time is a second answer. A comparison that returns at the first difference takes longer the more leading bytes match, so how long the no took tells the caller how close the guess was. That lets someone learn the secret one byte at a time, work that grows with its length instead of with every possible value.",
      "Porque el tiempo es una segunda respuesta. Una comparación que vuelve en la primera diferencia tarda más cuantos más bytes iniciales coinciden, así que lo que tardó el no le dice a quien llama qué tan cerca estuvo el intento. Eso permite aprender el secreto un byte a la vez, un trabajo que crece con su longitud en lugar de con todos los valores posibles.")],
  [t("Your service is behind a network with much more jitter than a byte comparison takes. Why isn't that enough?", "Tu servicio está detrás de una red con mucha más variación que lo que tarda comparar un byte. ¿Por qué eso no alcanza?"),
    t("Jitter is noise, and noise averages out: the mean of n timings has a spread that shrinks with √n, so a small, consistent difference shows up with enough samples. Doubling the noise only means four times the samples. Treat any secret-dependent timing difference as observable, however small.",
      "La variación es ruido, y el ruido se promedia: la media de n mediciones tiene una dispersión que baja con √n, así que una diferencia pequeña y constante aparece con suficientes muestras. Duplicar el ruido solo significa cuatro veces más muestras. Trata cualquier diferencia de tiempo que dependa del secreto como observable, por pequeña que sea.")],
  [t("What does a constant-time comparison do differently, and why use the library's instead of writing one?", "¿Qué hace distinto una comparación en tiempo constante y por qué usar la de la biblioteca en lugar de escribir una?"),
    t("It looks at every byte whatever it finds, combining the differences (for example OR-ing the XOR of each pair) and deciding only at the end, so the time depends on the length, not the contents. Compilers and runtimes can optimise a hand-written loop back into an early exit, and the library versions are written and reviewed to avoid that: crypto.timingSafeEqual (Node.js), hmac.compare_digest (Python), subtle.ConstantTimeCompare (Go).",
      "Revisa cada byte encuentre lo que encuentre, combina las diferencias (por ejemplo, un OR del XOR de cada par) y decide solo al final, así que el tiempo depende de la longitud, no del contenido. Los compiladores y entornos de ejecución pueden optimizar un bucle escrito a mano hasta volverlo salida temprana, y las versiones de biblioteca están escritas y revisadas para evitarlo: crypto.timingSafeEqual (Node.js), hmac.compare_digest (Python), subtle.ConstantTimeCompare (Go).")],
  [t("A teammate proposes adding a random sleep to the check instead. What do you tell them?", "Alguien del equipo propone agregar una espera al azar a la comprobación. ¿Qué le dices?"),
    t("That it adds noise, and noise averages out: every guess gets the same delay on average, so the difference is still in the means and only more samples are needed, while every legitimate request gets slower. Remove the difference with a constant-time comparison, and add rate limiting or lockouts so no one gets the millions of samples a small difference needs.",
      "Que agrega ruido, y el ruido se promedia: cada intento recibe la misma espera en promedio, así que la diferencia sigue en los promedios y solo hacen falta más muestras, mientras cada solicitud legítima se vuelve más lenta. Quita la diferencia con una comparación en tiempo constante, y agrega limitación de tasa o bloqueos para que nadie consiga los millones de muestras que necesita una diferencia pequeña.")],
  [t("Where in a typical web service should comparisons be constant time?", "¿Dónde, en un servicio web típico, las comparaciones deberían ser de tiempo constante?"),
    t("Wherever a value supplied by a caller is compared with a secret: API keys, HMAC signatures on webhooks or signed URLs, session and CSRF tokens, password-reset and invite codes. Passwords are compared through the password-hashing library's verify function (lesson 79, Password Hashing). A secret used as a lookup key in a database is better stored as a hash and looked up by the hash.",
      "Donde un valor que manda quien llama se compara con un secreto: claves de API, firmas HMAC de webhooks o URL firmadas, tokens de sesión y de CSRF, códigos para restablecer la contraseña o de invitación. Las contraseñas se comparan con la función de verificación de la biblioteca de hash de contraseñas (lección 79, Hash de contraseñas). Un secreto que se usa como clave de búsqueda en una base de datos conviene guardarlo como hash y buscarlo por el hash.")],
  [t("timingSafeEqual is constant time, yet the length of your API keys can still leak. How, and what do you do about it?", "timingSafeEqual es de tiempo constante, pero la longitud de tus claves de API igual puede filtrarse. ¿Cómo, y qué haces al respecto?"),
    t("The functions are constant time only for equal lengths, so the code around them often checks the length first and returns early, or the function itself does. Hash or HMAC both sides first and compare the digests: they are always the same length, and their bytes don't follow the input's. Fixed-length secrets, such as random tokens of a set size, help too.",
      "Las funciones son de tiempo constante solo con longitudes iguales, así que el código que las rodea suele revisar la longitud primero y volver antes, o lo hace la propia función. Aplica un hash o un HMAC a ambos lados primero y compara los resúmenes: siempre tienen la misma longitud y sus bytes no siguen a los de la entrada. Los secretos de longitud fija, como tokens aleatorios de un tamaño dado, también ayudan.")],
];

export default defineLesson({
  title: t("Timing Attacks Workbench", "Banco de trabajo: ataques de tiempo"),
  eyebrow: t("Systems lesson 81 · Timing attacks", "Lección de sistemas 81 · Ataques de tiempo"),
  lede: t("A comparison that stops at the first wrong byte answers yes or no, and also how close the guess was: it takes longer the more bytes match. Averaging many timings pulls that small difference out of the noise, so secrets must be compared in constant time. This lesson builds a combination checker and a stopwatch: watch the difference appear, predict what hides it and what doesn't, then explain it back.",
    "Una comparación que se detiene en el primer byte equivocado responde sí o no, y también qué tan cerca estuvo el intento: tarda más cuantos más bytes coinciden. Promediar muchas mediciones saca esa diferencia pequeña del ruido, así que los secretos hay que compararlos en tiempo constante. Esta lección arma un verificador de combinaciones y un cronómetro: mira cómo aparece la diferencia, predice qué la esconde y qué no, y después explícalo."),
  machine: {
    intro: t("The checker holds a secret of four dials. The listener times guesses: for the next dial, each digit many times, and the bars show the average reading for each digit. With early exit, the right digit's bar stands a step taller once enough readings are in; with constant time they all settle level. Try more noise, fewer readings, a random delay, and timing guess lengths instead of digits.",
      "El verificador guarda un secreto de cuatro diales. Quien escucha mide intentos: para el siguiente dial, cada dígito muchas veces, y las barras muestran la lectura promedio de cada dígito. Con salida temprana, la barra del dígito correcto queda un escalón más alta cuando hay suficientes lecturas; con tiempo constante, todas quedan parejas. Prueba más ruido, menos lecturas, una espera al azar y medir longitudes de intento en lugar de dígitos."),
    plate: {
      title: t("Combination checker", "Verificador de combinaciones"),
      keys: [
        { mark: "lit", label: t("The check in play: the dials the latest check looked at, the column being timed, and the lamp when the lock opens", "La comprobación en juego: los diales que revisó la última comprobación, la columna que se está midiendo y la lámpara cuando la cerradura abre") },
        { mark: "raised", label: t("Bars: the average reading per digit so far; cards: the dials the listener has settled on", "Barras: la lectura promedio de cada dígito hasta ahora; tarjetas: los diales que ya fijó quien escucha") },
        { mark: "flat", label: t("The checker, the stopwatch and the tally board", "El verificador, el cronómetro y el tablero de conteo") },
      ],
      caption: t(
        "A check costs about " + BASE + " units plus " + STEP + " for each dial it looks at, and every reading adds noise; one dial stands for the few nanoseconds one more byte takes. Early exit looks at dials until the first wrong one; constant time always looks at all four. For each dial the listener times every digit, keeps the slowest average and lays its card on the rail; the last dial leaves no timing trace, so it is tried by hand. A bar rises one step for each unit above a wrong guess's cost; in the length probe the bars are guess lengths 2 to 7. Counters: RUNS and how many OPENED (FOUND the length), the last READING and READINGS taken, the DIAL being learned with the readings of the column being timed, and the tries brute force needs on average.",
        "Una comprobación cuesta unas " + BASE + " unidades más " + STEP + " por cada dial que revisa, y cada lectura suma ruido; un dial representa los pocos nanosegundos que tarda un byte más. La salida temprana revisa diales hasta el primero equivocado; el tiempo constante siempre revisa los cuatro. Para cada dial, quien escucha mide todos los dígitos, se queda con el promedio más lento y pone su tarjeta en el riel; el último dial no deja rastro de tiempo, así que se prueba a mano. Una barra sube un escalón por cada unidad sobre el costo de un intento equivocado; en la prueba de longitud las barras son longitudes de intento de 2 a 7. Contadores: EJECUCIONES y cuántas quedaron ABIERTAS (HALLADAS, la longitud), la última LECTURA y las LECTURAS tomadas, el DIAL que se aprende con las lecturas de la columna que se mide, y los intentos promedio de la fuerza bruta.",
      ),
      stage: { "data-timing": "" },
      label: t("Timing attack simulation. Space pauses or resumes.", "Simulación de un ataque de tiempo. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["readings", t("Readings", "Lecturas")],
      ["dial", t("Dial", "Dial"), "1 / 4"],
      ["opened", t("Opened", "Abiertas"), "0 / 0"],
      ["brute", t("Brute force, average", "Fuerza bruta, promedio"), int(10 ** DIALS / 2)],
      ["last", t("Last reading", "Última lectura"), "–"],
    ],
    controls: [
      { seg: "compare", label: t("Comparison", "Comparación"), options: [["early", t("Early exit", "Salida temprana")], ["const", t("Constant time", "Tiempo constante")]], value: "early" },
      { seg: "noise", label: t("Noise", "Ruido"), options: [[2, "2"], [4, "4"], [8, "8"]], value: 4 },
      { seg: "samples", label: t("Readings per digit", "Lecturas por dígito"), options: [[20, "20"], [80, "80"], [320, "320"], [1280, "1,280"], [2560, "2,560"]], value: 320 },
      { seg: "delay", label: t("Random delay", "Espera al azar"), options: [[0, t("None", "Ninguna")], [40, "0–40"]], value: 0 },
      { seg: "probe", label: t("Listener times", "Quien escucha mide"), options: [["dials", t("Digits, dial by dial", "Dígitos, dial por dial")], ["length", t("Guess lengths", "Longitudes de intento")]], value: "dials" },
      { seg: "input", label: t("Compare", "Comparar"), options: [["raw", t("Raw inputs", "Entradas tal cual")], ["digest", t("HMAC digests", "Resúmenes HMAC")]], value: "raw", for: "length" },
      { speed: true, options: [[1, "1×"], [4, "4×"], [16, "16×"], [64, "64×"]], value: 16 },
      { actions: [["secret", t("New secret", "Nuevo secreto"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts a new run with a new secret. At 1× the stopwatch takes 30 readings a second. A run ends when the lock opens or the last dial runs out of digits, and the next one starts on its own. Watch it in the figure takes the first readings of dial 1 at once and speeds up.",
      "Cambiar un ajuste empieza una ejecución nueva con un secreto nuevo. A 1× el cronómetro toma 30 lecturas por segundo. Una ejecución termina cuando la cerradura abre o el último dial se queda sin dígitos, y la siguiente empieza sola. Míralo en la figura toma de una vez las primeras lecturas del dial 1 y acelera."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same checker as the machine, averaged over 200 seeded runs, each with its own secret.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo verificador que la máquina, promediados sobre 200 ejecuciones con semilla fija, cada una con su propio secreto."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: a toy checker with illustrative units, not a model of any real system.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección: un verificador de juguete con unidades ilustrativas, no un modelo de ningún sistema real.`),
  css: `
[data-timing] [data-card] .iso-face-text,[data-timing] [data-col]{font-weight:600}
[data-timing] .iso-face-text[data-tone="mid"]{fill:var(--anatomy-muted)}
${LIT_FILL_CSS}
`,
  data: { P, G: GEOMETRY, LENGTHS, DIALS, BASE, STEP },
});
