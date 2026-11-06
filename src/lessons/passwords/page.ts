// @ts-nocheck: content in the style of the other lessons
// Systems lesson 79 · Password hashing: a vault of hashes, the login desk that checks them, and a cracking rig that
// guesses against a stolen copy.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { int, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, slipSvg, tagSvg, P, GEOMETRY } from "./figure";
import { fastRun, saltRun, workRun, spikeRun, lengthRun, dur, rigRate, hashSecs, N, CORES, DAY } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each).
const R = { fast: fastRun(), salt: saltRun(), work: workRun(), spike: spikeRun(), length: lengthRun() };

const D = (s) => dur(s);                                  // { en, es }
const both = (f) => t(f("en"), f("es"));                   // build one sentence per language from the same numbers
const ms = (s) => (s < 1e-3 ? Math.round(s * 1e6) + " µs" : Math.round(s * 1000) + " ms");
const logShare = (s, top) => Math.max(0.02, Math.min(1, Math.log10(Math.max(1, s)) / Math.log10(top)));
const big = (r, lang) => (r >= 1e9 ? Math.round(r / 1e9) + (lang === "en" ? " billion" : " mil millones") : int(r));
const pts = (a, b) => Math.round(100 * (a - b));
const { fast: F, salt: SA, work: W, spike: SP, length: LE } = R;

// What each card shows after a run.
const RUNS = {
  fast: () => {
    const top = Math.max(F.argon.half, F.bcrypt.half) * 3;
    return {
      verdict: both((l) => l === "en"
        ? "Half of the 1,000 rows fell in " + D(F.sha.half).en + " with SHA-256, " + D(F.bcrypt.half).en + " with bcrypt and " + D(F.argon.half).en + " with Argon2id. In the first day: " + pct(F.sha.day) + ", " + pct(F.bcrypt.day) + " and " + pct(F.argon.day) + " of the table."
        : "La mitad de las 1,000 filas cayó en " + D(F.sha.half).es + " con SHA-256, " + D(F.bcrypt.half).es + " con bcrypt y " + D(F.argon.half).es + " con Argon2id. En el primer día: " + pct(F.sha.day) + ", " + pct(F.bcrypt.day) + " y " + pct(F.argon.day) + " de la tabla."),
      bars: [
        [t("Half the table, SHA-256 (log scale)", "Mitad de la tabla, SHA-256 (escala log)"), logShare(F.sha.half, top), D(F.sha.half), true],
        [t("Half the table, bcrypt (log scale)", "Mitad de la tabla, bcrypt (escala log)"), logShare(F.bcrypt.half, top), D(F.bcrypt.half)],
        [t("Half the table, Argon2id (log scale)", "Mitad de la tabla, Argon2id (escala log)"), logShare(F.argon.half, top), D(F.argon.half)],
      ],
    };
  },
  salt: () => {
    const top = SA.on.half * 3;
    return {
      verdict: both((l) => l === "en"
        ? "No salt: half the table fell in " + D(SA.off.half).en + ", and " + Math.round(SA.off.shared) + " rows shared their hash with another row. A salt per user: " + D(SA.on.half).en + ", " + Math.round(SA.ratio) + " times longer, and no two rows alike."
        : "Sin sal: la mitad de la tabla cayó en " + D(SA.off.half).es + ", y " + Math.round(SA.off.shared) + " filas compartían su hash con otra. Una sal por usuario: " + D(SA.on.half).es + ", " + Math.round(SA.ratio) + " veces más, y ninguna fila igual a otra."),
      bars: [
        [t("Half the table, no salt (log scale)", "Mitad de la tabla, sin sal (escala log)"), logShare(SA.off.half, top), D(SA.off.half), true],
        [t("Half the table, salt per user (log scale)", "Mitad de la tabla, sal por usuario (escala log)"), logShare(SA.on.half, top), D(SA.on.half)],
        [t("Rows sharing a hash, no salt (of 1,000)", "Filas con hash compartido, sin sal (de 1,000)"), Math.min(1, SA.off.shared / 200), String(Math.round(SA.off.shared)), true],
      ],
    };
  },
  work: () => ({
    verdict: both((l) => l === "en"
      ? "Cracked in 30 days: " + pct(W.w1.month) + " of the table at ×1, " + pct(W.w4.month) + " at ×4, " + pct(W.w16.month) + " at ×16; " + pct(W.w1.common) + " had picked a common password. One login's hash: " + ms(W.w1.login) + ", " + ms(W.w4.login) + ", " + ms(W.w16.login) + "."
      : "Adivinadas en 30 días: " + pct(W.w1.month) + " de la tabla con ×1, " + pct(W.w4.month) + " con ×4, " + pct(W.w16.month) + " con ×16; el " + pct(W.w1.common) + " había elegido una contraseña común. El hash de un login: " + ms(W.w1.login) + ", " + ms(W.w4.login) + ", " + ms(W.w16.login) + "."),
    groups: [
      { title: t("Cracked in 30 days", "Adivinadas en 30 días"), bars: [[t("Work ×1", "Trabajo ×1"), W.w1.month, pct(W.w1.month)], [t("Work ×4", "Trabajo ×4"), W.w4.month, pct(W.w4.month)], [t("Work ×16", "Trabajo ×16"), W.w16.month, pct(W.w16.month), true]] },
      { title: t("One login's hash (of 1 s)", "El hash de un login (de 1 s)"), bars: [[t("Work ×1", "Trabajo ×1"), W.w1.login, ms(W.w1.login)], [t("Work ×16", "Trabajo ×16"), Math.min(1, W.w16.login), ms(W.w16.login), true]] },
    ],
  }),
  spike: () => ({
    verdict: both((l) => l === "en"
      ? "At 20 logins a second the cores were " + pct(SP.calm.cpu) + " busy and a login took " + ms(SP.calm.late) + ". At 200: CPU " + pct(SP.spike.cpu) + ", " + Math.round(SP.spike.served) + " logins a second got through, " + int(SP.spike.line) + " were waiting after the minute, and a login arriving then waited " + Math.round(SP.spike.wait60) + " s."
      : "A 20 logins por segundo los núcleos estaban " + pct(SP.calm.cpu) + " ocupados y un login tardaba " + ms(SP.calm.late) + ". A 200: CPU al " + pct(SP.spike.cpu) + ", pasaron " + Math.round(SP.spike.served) + " logins por segundo, " + int(SP.spike.line) + " esperaban al cabo del minuto, y un login que llegaba entonces esperaba " + Math.round(SP.spike.wait60) + " s."),
    bars: [
      [t("Login time at 20/s (of 100 s)", "Tiempo de login a 20/s (de 100 s)"), Math.max(0.01, SP.calm.late / 100), ms(SP.calm.late)],
      [t("Login time at 200/s, after a minute (of 100 s)", "Tiempo de login a 200/s, tras un minuto (de 100 s)"), Math.min(1, SP.spike.wait60 / 100), Math.round(SP.spike.wait60) + " s", true],
      [t("CPU at 200/s", "CPU a 200/s"), SP.spike.cpu, pct(SP.spike.cpu), true],
    ],
  }),
  length: () => {
    const top = LE.r12.half * 3;
    return {
      verdict: both((l) => l === "en"
        ? "Half the table fell in " + D(LE.r8.half).en + " with 8 characters from all 94, and in " + D(LE.r12.half).en + " with 12 lowercase letters, " + Math.round(LE.r12.half / LE.r8.half) + " times longer. One account attacked alone: " + D(LE.r8.one).en + " and " + D(LE.r12.one).en + " on average."
        : "La mitad de la tabla cayó en " + D(LE.r8.half).es + " con 8 caracteres de los 94, y en " + D(LE.r12.half).es + " con 12 minúsculas, " + Math.round(LE.r12.half / LE.r8.half) + " veces más. Una cuenta atacada sola: " + D(LE.r8.one).es + " y " + D(LE.r12.one).es + " en promedio."),
      bars: [
        [t("Half the table, 8 of 94 (log scale)", "Mitad de la tabla, 8 de 94 (escala log)"), logShare(LE.r8.half, top), D(LE.r8.half), true],
        [t("Half the table, 12 a–z (log scale)", "Mitad de la tabla, 12 a–z (escala log)"), logShare(LE.r12.half, top), D(LE.r12.half)],
      ],
    };
  },
};

const BCRYPT_MS = ms(hashSecs("bcrypt"));
const CAPACITY = Math.round(SP.capacity);

const EXPERIMENTS = [
  {
    id: "fast",
    title: t("A fast hash or a slow one", "Un hash rápido o uno lento"),
    change: t("A stolen table of 1,000 users, a salt per user, one GPU · SHA-256 vs bcrypt (cost 10) vs Argon2id (19 MiB) · speeds are illustrative orders of magnitude",
      "Una tabla robada de 1,000 usuarios, una sal por usuario, una GPU · SHA-256 vs bcrypt (costo 10) vs Argon2id (19 MiB) · las velocidades son órdenes de magnitud ilustrativos"),
    question: t("With SHA-256, how long until half of the table is cracked?", "Con SHA-256, ¿cuánto tarda en caer la mitad de la tabla?"),
    options: [
      t("Years: nobody knows how to reverse SHA-256", "Años: nadie sabe cómo invertir SHA-256"),
      t("A minute or two: the rig just guesses very fast", "Un minuto o dos: el equipo solo adivina muy rápido"),
      t("A few days: a salt per user slows it right down", "Unos días: una sal por usuario lo frena mucho"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "Nobody reverses the hash: the rig hashes guesses, most common first, and compares. A GPU computes on the order of " + big(rigRate("sha256"), l) + " SHA-256 hashes a second, so even with a salt per user it works through the common passwords and the word-and-digits patterns of 1,000 users in " + D(F.sha.half).en + ". SHA-256 is built to be fast; a password hash is built to be slow. bcrypt and Argon2id manage about " + int(rigRate("bcrypt")) + " and " + int(rigRate("argon2id")) + " hashes a second on the same GPU here, so the same half takes " + D(F.bcrypt.half).en + " and " + D(F.argon.half).en + ". The strongest passwords survive either way and the most common fall either way; the hash decides the fate of everyone in between."
      : "Nadie invierte el hash: el equipo calcula el hash de cada intento, los más comunes primero, y compara. Una GPU calcula del orden de " + big(rigRate("sha256"), l) + " hashes SHA-256 por segundo, así que incluso con una sal por usuario recorre las contraseñas comunes y los patrones de palabra y dígitos de 1,000 usuarios en " + D(F.sha.half).es + ". SHA-256 está hecho para ser rápido; un hash de contraseñas está hecho para ser lento. bcrypt y Argon2id logran unos " + int(rigRate("bcrypt")) + " y " + int(rigRate("argon2id")) + " hashes por segundo en la misma GPU aquí, así que la misma mitad tarda " + D(F.bcrypt.half).es + " y " + D(F.argon.half).es + ". Las contraseñas más fuertes sobreviven en ambos casos y las más comunes caen en ambos; el hash decide la suerte de todas las del medio."),
    watch: { hash: "sha256", work: "1", salt: "on", policy: "people", logins: "20", stop: "half" },
  },
  {
    id: "salt",
    title: t("No salt", "Sin sal"),
    change: t("PBKDF2 (600,000 iterations), 1,000 users, one GPU · a salt per user vs no salt",
      "PBKDF2 (600,000 iteraciones), 1,000 usuarios, una GPU · una sal por usuario vs sin sal"),
    question: t("How much longer does half the table hold out with a salt per user?", "¿Cuánto más resiste la mitad de la tabla con una sal por usuario?"),
    options: [
      t("About the same: the salt is stored next to the hash", "Casi lo mismo: la sal se guarda junto al hash"),
      t("Hundreds of times longer: each guess tests one row", "Cientos de veces más: cada intento prueba una sola fila"),
      t("A few times longer: a salt only adds some characters", "Unas pocas veces más: la sal solo agrega unos caracteres"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "The salt isn't secret and doesn't need to be. Without one, a single hash of a guess is compared with all 1,000 rows at once, and everyone with the same password has the same hash: " + Math.round(SA.off.shared) + " rows here shared theirs with another row, so cracking one cracks them all (look at the SAME HASH counter); an attacker can even look hashes up in tables computed in advance. One salt shared by every row is no better: it is the same for everyone, so equal passwords still hash alike. With a salt per user, each guess has to be hashed again for every row still standing, so half the table took " + Math.round(SA.ratio) + " times longer: " + D(SA.off.half).en + " against " + D(SA.on.half).en + ". A salt multiplies the attacker's work by the number of users, but does nothing for one account attacked alone; that's the slow hash's job. bcrypt and Argon2id make and store the salt for you."
      : "La sal no es secreta ni necesita serlo. Sin ella, un solo hash de un intento se compara con las 1,000 filas a la vez, y todos los que tienen la misma contraseña tienen el mismo hash: aquí " + Math.round(SA.off.shared) + " filas compartían el suyo con otra, así que adivinar una es adivinarlas todas (mira el contador MISMO HASH); el atacante hasta puede buscar los hashes en tablas calculadas de antemano. Una sola sal compartida por todas las filas no es mejor: es la misma para todos, así que contraseñas iguales siguen dando el mismo hash. Con una sal por usuario, cada intento hay que calcularlo de nuevo para cada fila que sigue en pie, así que la mitad de la tabla tardó " + Math.round(SA.ratio) + " veces más: " + D(SA.off.half).es + " contra " + D(SA.on.half).es + ". La sal multiplica el trabajo del atacante por el número de usuarios, pero no hace nada por una cuenta atacada sola; eso le toca al hash lento. bcrypt y Argon2id generan y guardan la sal por ti."),
    watch: { hash: "pbkdf2", work: "1", salt: "off", policy: "people", logins: "20", stop: "half" },
  },
  {
    id: "work",
    title: t("Turn up the work factor", "Subir el factor de trabajo"),
    change: t("bcrypt with a salt per user, 1,000 users, one GPU for 30 days · work factor ×1 → ×16 (cost 10 → 14)",
      "bcrypt con una sal por usuario, 1,000 usuarios, una GPU durante 30 días · factor de trabajo ×1 → ×16 (costo 10 → 14)"),
    question: t("How much of the table does the ×16 work factor save from a 30-day attack?", "¿Cuánto de la tabla salva el factor ×16 de un ataque de 30 días?"),
    options: [
      t("Most of it: 16× the work cracks about a 16th as much", "Casi toda: 16× el trabajo adivina cerca de un dieciseisavo"),
      t("Some: the common passwords still fall within the month", "Algo: las contraseñas comunes igual caen dentro del mes"),
      t("None: a higher cost only slows your own logins", "Nada: un costo mayor solo frena tus propios logins"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "A work factor divides how far down the guess list the rig gets in 30 days: by 16, a bit more than one power of ten, on a list that spans twenty. The " + pct(W.w1.common) + " of users who picked a common password sit at the top of that list, and they fall within the month whatever the cost; ×16 only saved the patterns in between: " + pct(W.w1.month) + " cracked at ×1, " + pct(W.w16.month) + " at ×16, " + pts(W.w1.month, W.w16.month) + " points. Meanwhile each login went from " + ms(W.w1.login) + " to " + ms(W.w16.login) + " of CPU: at 20 logins a second that keeps " + Math.round(20 * W.w16.login) + " cores busy, and the machine's desk has " + CORES + ", so its line grows (experiment 4). So raise the cost as far as your login budget allows (OWASP's floor for bcrypt is cost 10), rehash a user's password at the next login after you raise it, and protect the top of the list another way: refuse common and breached passwords at sign-up, and limit online guessing."
      : "Un factor de trabajo divide qué tan abajo en la lista de intentos llega el equipo en 30 días: entre 16, poco más de una potencia de diez, en una lista que abarca veinte. El " + pct(W.w1.common) + " de usuarios que eligió una contraseña común está arriba de esa lista, y cae dentro del mes sea cual sea el costo; ×16 solo salvó los patrones del medio: " + pct(W.w1.month) + " adivinadas con ×1, " + pct(W.w16.month) + " con ×16, " + pts(W.w1.month, W.w16.month) + " puntos. Mientras tanto cada login pasó de " + ms(W.w1.login) + " a " + ms(W.w16.login) + " de CPU: a 20 logins por segundo eso ocupa " + Math.round(20 * W.w16.login) + " núcleos, y el mostrador de la máquina tiene " + CORES + ", así que su fila crece (experimento 4). Así que sube el costo hasta donde te lo permita tu presupuesto de login (el piso de OWASP para bcrypt es costo 10), vuelve a calcular el hash de cada usuario en su siguiente login después de subirlo, y protege la parte de arriba de la lista de otra forma: rechaza contraseñas comunes y filtradas al registrarse, y limita los intentos en línea."),
    watch: { hash: "bcrypt", work: "16", salt: "on", policy: "people", logins: "20", stop: 30 * DAY },
  },
  {
    id: "spike",
    title: t("A login spike", "Un pico de logins"),
    change: t("bcrypt (cost 10, about " + BCRYPT_MS + " a hash) on " + CORES + " cores · 20 logins a second → 200 a second for one minute, say a credential-stuffing run",
      "bcrypt (costo 10, unos " + BCRYPT_MS + " por hash) en " + CORES + " núcleos · 20 logins por segundo → 200 por segundo durante un minuto, por ejemplo un ataque de relleno de credenciales (credential stuffing)"),
    question: t("What happens to a real user who logs in at the end of that minute?", "¿Qué le pasa a un usuario real que inicia sesión al final de ese minuto?"),
    options: [
      t("A little slower: a hash is a small part of a request", "Un poco más lento: un hash es una parte pequeña de la solicitud"),
      t("A long wait: logins pile up faster than they're hashed", "Una espera larga: los logins se acumulan más rápido de lo que se calculan"),
      t("Nothing: the hash's cost falls on attackers, not you", "Nada: el costo del hash lo pagan los atacantes, no tú"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? CORES + " cores at about " + BCRYPT_MS + " a hash can check about " + CAPACITY + " logins a second. At 20 a second they're " + pct(SP.calm.cpu) + " busy. At 200 the CPU is pinned at " + pct(SP.spike.cpu) + ", " + Math.round(SP.spike.served) + " a second get through and the rest join the line: after the minute " + int(SP.spike.line) + " are waiting and a new login waits " + Math.round(SP.spike.wait60) + " s, longer than most clients will. With SHA-256 the same spike would have kept the cores " + (100 * SP.sha.cpu).toFixed(3) + "% busy. The slowness you pay for is real CPU on every attempt, an attacker's included. So limit attempts before the hash runs (per account and per IP address; lesson 05, Rate limiting), and size the work factor to your peak: logins per second × seconds per hash = cores kept busy."
      : CORES + " núcleos a unos " + BCRYPT_MS + " por hash pueden verificar unos " + CAPACITY + " logins por segundo. A 20 por segundo están " + pct(SP.calm.cpu) + " ocupados. A 200 la CPU queda clavada al " + pct(SP.spike.cpu) + ", pasan " + Math.round(SP.spike.served) + " por segundo y el resto se suma a la fila: al cabo del minuto esperan " + int(SP.spike.line) + " y un login nuevo espera " + Math.round(SP.spike.wait60) + " s, más de lo que aguanta la mayoría de los clientes. Con SHA-256 el mismo pico habría dejado los núcleos ocupados un " + (100 * SP.sha.cpu).toFixed(3) + "%. La lentitud que pagas es CPU real en cada intento, también en los del atacante. Así que limita los intentos antes de que corra el hash (por cuenta y por dirección IP; lección 05, Limitación de tasa), y dimensiona el factor de trabajo para tu pico: logins por segundo × segundos por hash = núcleos ocupados."),
    // the desk runs in slow motion, so the Watch skips to the end of the spike's minute
    watch: { hash: "bcrypt", work: "1", salt: "on", policy: "people", logins: "200", desk: 60 },
  },
  {
    id: "length",
    title: t("Long or complex?", "¿Larga o compleja?"),
    change: t("Every user gets a random password · SHA-256 with a salt per user, 1,000 users, one GPU · 8 characters from all 94 printable vs 12 lowercase letters",
      "Cada usuario recibe una contraseña aleatoria · SHA-256 con una sal por usuario, 1,000 usuarios, una GPU · 8 caracteres de los 94 imprimibles vs 12 letras minúsculas"),
    question: t("Which policy keeps half the table standing longer?", "¿Con cuál política resiste más la mitad de la tabla?"),
    options: [
      t("8 of 94: each character has over 3× the choices", "8 de 94: cada carácter tiene más de 3× las opciones"),
      t("12 lowercase: four more characters beat a bigger set", "12 minúsculas: cuatro caracteres más le ganan a un conjunto mayor"),
      t("About the same: both are random, so both are strong", "Más o menos igual: las dos son aleatorias, así que fuertes"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "Brute force has to cover the space: 94^8 ≈ 6 × 10^15 passwords for 8 characters from all 94 printable ones, 26^12 ≈ 10^17 for 12 lowercase letters. A bigger alphabet multiplies each character's choices by 3.6; each extra character multiplies the whole space by the alphabet's size. So half the table fell in " + D(LE.r8.half).en + " with 8 of 94 and " + D(LE.r12.half).en + " with 12 lowercase. And these are truly random; people told to add a digit and a symbol write Password1!, which is near the top of every guess list. That's why NIST SP 800-63B (2025) drops composition rules in favour of length and a check against common and breached passwords."
      : "La fuerza bruta tiene que cubrir el espacio: 94^8 ≈ 6 × 10^15 contraseñas para 8 caracteres de los 94 imprimibles, 26^12 ≈ 10^17 para 12 letras minúsculas. Un alfabeto mayor multiplica las opciones de cada carácter por 3.6; cada carácter extra multiplica el espacio entero por el tamaño del alfabeto. Así que la mitad de la tabla cayó en " + D(LE.r8.half).es + " con 8 de 94 y en " + D(LE.r12.half).es + " con 12 minúsculas. Y estas son de verdad aleatorias; a la gente que le piden agregar un dígito y un símbolo escribe Password1!, que está cerca del principio de toda lista de intentos. Por eso NIST SP 800-63B (2025) deja las reglas de composición y pide longitud y una verificación contra contraseñas comunes y filtradas."),
    watch: { hash: "sha256", work: "1", salt: "on", policy: "rand8", logins: "20", stop: "half" },
  },
];

const QUESTIONS = [
  [t("SHA-256 has no known weakness. Why is it still the wrong way to store passwords?", "SHA-256 no tiene debilidades conocidas. ¿Por qué igual es la forma equivocada de guardar contraseñas?"),
    t("Its strength is against reversing a hash or finding collisions, and nobody cracks passwords that way: they guess, hash each guess and compare. SHA-256 is designed to be fast, so a GPU tries billions of guesses a second, and human passwords come from a small, predictable set. A password hash (Argon2id, scrypt, bcrypt, PBKDF2) is deliberately slow and tunable, takes a salt, and in Argon2id's and scrypt's case needs memory too, so each guess costs the attacker the same as one of your logins.",
      "Su fortaleza es contra invertir un hash o encontrar colisiones, y nadie descubre contraseñas así: se adivina, se calcula el hash de cada intento y se compara. SHA-256 está diseñado para ser rápido, así que una GPU prueba miles de millones de intentos por segundo, y las contraseñas humanas salen de un conjunto pequeño y predecible. Un hash de contraseñas (Argon2id, scrypt, bcrypt, PBKDF2) es lento a propósito y ajustable, lleva una sal y, en el caso de Argon2id y scrypt, además necesita memoria, así que cada intento le cuesta al atacante lo mismo que uno de tus logins.")],
  [t("What does a salt protect against, and what doesn't it?", "¿Contra qué protege una sal y contra qué no?"),
    t("A random salt per user, stored in the clear next to the hash, makes equal passwords hash differently: no groups of identical hashes, no tables computed in advance, and every guess has to be hashed once per user, so the attacker's work grows with the number of users. It doesn't slow down guessing one account, and it isn't a secret. A pepper, a secret key kept outside the database (an HMAC, or encrypting the hashes), is an optional extra that helps only if the database leaks without the key.",
      "Una sal aleatoria por usuario, guardada en claro junto al hash, hace que contraseñas iguales den hashes distintos: no hay grupos de hashes idénticos, no sirven tablas calculadas de antemano, y cada intento hay que calcularlo una vez por usuario, así que el trabajo del atacante crece con el número de usuarios. No frena los intentos contra una sola cuenta, y no es un secreto. Una pimienta (pepper), una clave secreta guardada fuera de la base de datos (un HMAC, o cifrar los hashes), es un extra opcional que solo ayuda si la base se filtra sin la clave.")],
  [t("How do you choose a work factor, and how do you raise it later?", "¿Cómo eliges un factor de trabajo y cómo lo subes después?"),
    t("Measure on your production hardware and pick the highest setting your login latency and peak CPU allow (lesson 05's rate limits help keep that peak bounded). OWASP's floors today: Argon2id with 19 MiB of memory, 2 iterations and parallelism 1; bcrypt cost 10; PBKDF2-HMAC-SHA256 with 600,000 iterations. The parameters are stored inside the hash string ($2b$10$… for bcrypt, $argon2id$v=19$m=19456,t=2,p=1$… for Argon2), so old and new hashes can live side by side: when a user logs in with a hash on old settings, verify it, then hash the password again with the new ones. Hashes of users who never log in can be wrapped (hash the old hash) to upgrade them at once.",
      "Mide en tu hardware de producción y elige el valor más alto que permitan tu latencia de login y tu CPU en el pico (los límites de tasa de la lección 05 ayudan a acotar ese pico). Los mínimos de OWASP hoy: Argon2id con 19 MiB de memoria, 2 iteraciones y paralelismo 1; bcrypt con costo 10; PBKDF2-HMAC-SHA256 con 600,000 iteraciones. Los parámetros se guardan dentro de la cadena del hash ($2b$10$… en bcrypt, $argon2id$v=19$m=19456,t=2,p=1$… en Argon2), así que hashes viejos y nuevos conviven: cuando un usuario inicia sesión con un hash de ajustes viejos, verifícalo y vuelve a calcular el hash de la contraseña con los nuevos. Los hashes de usuarios que nunca vuelven se pueden envolver (calcular el hash del hash viejo) para mejorarlos de una vez.")],
  [t("Why does Argon2id use memory, and how do the four algorithms compare?", "¿Por qué Argon2id usa memoria y cómo se comparan los cuatro algoritmos?"),
    t("A GPU has thousands of cores but little fast memory per core. A hash that must fill and reread tens of MiB per guess limits how many guesses run in parallel, so the attacker's hardware gains much less over your server than with a hash that only burns CPU. OWASP's order of preference: Argon2id; then scrypt; bcrypt for legacy systems (it reads only the first 72 bytes of a password); PBKDF2 when FIPS-140 compliance requires it, with a high iteration count, since it is CPU-only and GPU-friendly.",
      "Una GPU tiene miles de núcleos pero poca memoria rápida por núcleo. Un hash que tiene que llenar y releer decenas de MiB por intento limita cuántos intentos corren en paralelo, así que el hardware del atacante le saca mucha menos ventaja a tu servidor que con un hash que solo gasta CPU. El orden de preferencia de OWASP: Argon2id; luego scrypt; bcrypt para sistemas heredados (solo lee los primeros 72 bytes de la contraseña); PBKDF2 cuando lo exige el cumplimiento de FIPS-140, con muchas iteraciones, porque solo usa CPU y a las GPU les va bien con él.")],
  [t("Your login endpoint uses bcrypt. What does a credential-stuffing attack do to it, and what do you do about it?", "Tu endpoint de login usa bcrypt. ¿Qué le hace un ataque de relleno de credenciales y qué haces al respecto?"),
    t("Each attempt, right or wrong, costs a full hash, so thousands of attempts a second pin your CPU and real users queue behind them. Limit attempts before hashing: per account, per IP address and globally (lesson 05, Rate limiting); shed or delay the excess rather than queue it. Offer multi-factor authentication and check passwords against breached lists, so the stuffed credentials that match don't get in. Keep enough cores for peak logins × hash time.",
      "Cada intento, correcto o no, cuesta un hash completo, así que miles de intentos por segundo saturan tu CPU y los usuarios reales hacen fila detrás. Limita los intentos antes del hash: por cuenta, por dirección IP y en total (lección 05, Limitación de tasa); descarta o demora el exceso en vez de encolarlo. Ofrece autenticación multifactor y verifica las contraseñas contra listas de filtraciones, para que las credenciales que coinciden no entren. Ten núcleos suficientes para logins en el pico × tiempo de hash.")],
  [t("Given how cracking works, what should a password policy ask of users?", "Sabiendo cómo funciona el ataque, ¿qué debería pedirles una política de contraseñas a los usuarios?"),
    t("Attackers guess in order of popularity, so the most common passwords fall in minutes whatever the hash. Block them at sign-up with a list of common and breached passwords. Ask for length, not composition rules: a long passphrase beats a short password with a digit and a symbol, and rules push people to Password1!. Don't force periodic changes, allow paste so password managers work, and add a second factor. NIST SP 800-63B says much the same.",
      "Los atacantes adivinan en orden de popularidad, así que las contraseñas más comunes caen en minutos sea cual sea el hash. Bloquéalas al registrarse con una lista de contraseñas comunes y filtradas. Pide longitud, no reglas de composición: una frase larga le gana a una contraseña corta con un dígito y un símbolo, y las reglas empujan a la gente a Password1!. No obligues a cambiarla cada cierto tiempo, permite pegar para que funcionen los gestores de contraseñas, y agrega un segundo factor. NIST SP 800-63B dice más o menos lo mismo.")],
];

export default defineLesson({
  title: t("Password Hashing Workbench", "Banco de trabajo: hash de contraseñas"),
  eyebrow: t("Systems lesson 79 · Password hashing", "Lección de sistemas 79 · Hash de contraseñas"),
  lede: t("When a table of password hashes leaks, nobody reverses the hashes: the attacker guesses, hashes each guess and compares, as fast as their hardware allows. A password hash has one job, to make every guess expensive: slow, salted and, ideally, memory-hard. This lesson puts a stolen vault in front of a cracking rig, with your login desk paying the same price per login: watch it, predict what each setting buys, then explain it back.",
    "Cuando se filtra una tabla de hashes de contraseñas, nadie invierte los hashes: el atacante adivina, calcula el hash de cada intento y compara, tan rápido como le permite su hardware. Un hash de contraseñas tiene un solo trabajo, encarecer cada intento: lento, con sal y, de ser posible, exigente en memoria. Esta lección pone una bóveda robada frente a un equipo de ataque, con tu mostrador de login pagando el mismo precio por cada login: míralo, predice qué compra cada ajuste y después explícalo."),
  machine: {
    intro: t("The vault in the centre holds 1,000 user rows; its drawers show eight of them, from the most common password to the strongest, with each row's stored hash and salt. A copy has been stolen: the rig on the right guesses against it, and a drawer lights when its row is cracked. The rig's clock runs on a log scale, ten times more attacker time every 1.6 s, from a millisecond to a thousand years, and then the table is stolen again. On the left, your login desk hashes every login the same way, in slow motion (20× slower than real time). Speeds are illustrative, rounded orders of magnitude for one high-end GPU and one server core. Try the hash, the work factor, the salt, the passwords and the login rate.",
      "La bóveda del centro guarda 1,000 filas de usuarios; sus cajones muestran ocho, desde la contraseña más común hasta la más fuerte, con el hash guardado y la sal (salt) de cada fila. Alguien robó una copia: el equipo de ataque (cracking rig) de la derecha intenta adivinar (crackear) sus contraseñas, y un cajón se enciende cuando su fila queda adivinada. El reloj del equipo corre en escala logarítmica, diez veces más tiempo de ataque cada 1.6 s, desde un milisegundo hasta mil años, y luego se roba la tabla de nuevo. A la izquierda, tu mostrador de login calcula el hash de cada login de la misma forma, en cámara lenta (20× más lento que el tiempo real). Las velocidades son órdenes de magnitud ilustrativos y redondeados para una GPU de gama alta y un núcleo de servidor. Prueba el hash, el factor de trabajo (work factor), la sal, las contraseñas y la tasa de logins."),
    plate: {
      title: t("Vault, desk and rig", "Bóveda, mostrador y equipo"),
      keys: [
        { mark: "lit", label: t("A cracked row", "Una fila adivinada") },
        { mark: "raised", label: t("Login slips with the user's letter, on the lane or on the core hashing them; guess tags on the rig's rail", "Papeletas de login con la letra del usuario, en el carril o sobre el núcleo que las calcula; fichas de intentos en el riel del equipo") },
        { mark: "flat", label: t("Drawers: row letter, stored hash (first 4 hex digits) and salt", "Cajones: letra de la fila, hash guardado (primeros 4 dígitos hex) y sal") },
      ],
      caption: t(
        "Each drawer is one user row: its letter, the first four hex digits of its stored hash, and its salt. Without a salt, rows with the same password show the same hash, and the SAME HASH counter on the plinth counts them across all 1,000 rows. The rig tries guesses in the order that cracks the most accounts first (common passwords, then patterns, then brute force); GUESSES shows how far down that list it has got, as a number times a power of ten (with a salt per user each guess costs a hash for every row still standing), and CRACKED how many rows have fallen. On the desk, login slips wait on the lane, a core takes one and spins while it hashes, and the counters show how many wait, how long the oldest has waited and what one hash costs.",
        "Cada cajón es una fila de usuario: su letra, los primeros cuatro dígitos hex de su hash guardado y su sal. Sin sal, las filas con la misma contraseña muestran el mismo hash, y el contador MISMO HASH del zócalo las cuenta en las 1,000 filas. El equipo prueba intentos en el orden que adivina más cuentas primero (contraseñas comunes, luego patrones, luego fuerza bruta); INTENTOS muestra hasta dónde llegó en esa lista, como un número por una potencia de diez (con una sal por usuario, cada intento cuesta un hash por cada fila que sigue en pie), y ADIVINADAS cuántas filas cayeron. En el mostrador, las papeletas de login esperan en el carril, un núcleo toma una y gira mientras calcula el hash, y los contadores muestran cuántas esperan, cuánto lleva esperando la más antigua y cuánto cuesta un hash.",
      ),
      stage: { "data-vault": "" },
      label: t("Password hashing simulation. Space pauses or resumes.", "Simulación de hash de contraseñas. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["cracked", t("Cracked, of 1,000", "Adivinadas, de 1,000")],
      ["clock", t("Rig clock", "Reloj del equipo")],
      ["half", t("Half the table falls in", "La mitad de la tabla cae en")],
      ["rig", t("Hashes a second, one GPU", "Hashes por segundo, una GPU")],
      ["login", t("One login's hash", "El hash de un login")],
      ["cpu", t("Server CPU", "CPU del servidor")],
    ],
    controls: [
      { seg: "hash", label: t("Hash", "Hash"), options: [["sha256", "SHA-256"], ["pbkdf2", "PBKDF2"], ["bcrypt", "bcrypt"], ["argon2id", "Argon2id"]], value: "sha256" },
      { seg: "work", label: t("Work factor", "Factor de trabajo"), options: [["1", "×1"], ["4", "×4"], ["16", "×16"]], value: "1", for: "slow" },
      { seg: "salt", label: t("Salt", "Sal"), options: [["on", t("One per user", "Una por usuario")], ["off", t("None", "Ninguna")]], value: "on" },
      { seg: "policy", label: t("Passwords", "Contraseñas"), options: [["people", t("As people pick them", "Como las elige la gente")], ["rand8", t("8 random, of 94", "8 al azar, de 94")], ["rand12", t("12 random, a–z", "12 al azar, a–z")]], value: "people" },
      { seg: "logins", label: t("Logins", "Logins"), options: [["20", "20/s"], ["200", "200/s"]], value: "20" },
      { speed: true },
      { actions: [["steal", t("Steal it again", "Robarla de nuevo"), { primary: true }], ["burst", t("300 logins at once", "300 logins de golpe")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Work factor ×4 is bcrypt cost +2, or 4× the PBKDF2 iterations or Argon2id passes; SHA-256 has none. The base settings: PBKDF2 with 600,000 iterations, bcrypt cost 10, Argon2id with 19 MiB and 2 passes. Changing a setting starts the run again.",
      "Factor de trabajo ×4 es costo de bcrypt +2, o 4× las iteraciones de PBKDF2 o las pasadas de Argon2id; SHA-256 no tiene. Los ajustes base: PBKDF2 con 600,000 iteraciones, bcrypt con costo 10, Argon2id con 19 MiB y 2 pasadas. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded tables of 1,000 users.", "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho tablas de 1,000 usuarios con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  css: `
.iso-stage [data-layer] text{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    SLIP_SVG: slipSvg(),
    TAG_SVG: tagSvg(),
  },
});
