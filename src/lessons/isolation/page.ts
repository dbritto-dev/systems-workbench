// @ts-nocheck: content in the style of the other lessons
// Systems lesson 65 · Isolation levels: a records office where clerks (or doctors) run transactions against shared rows,
// with a timeline of every read and write.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, n0 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, markSvgs, P, GEOMETRY } from "./figure";
import { deposits, nights, PER, NIGHTS, WORK, TAIL, IDLE, NIGHT, BACKOFF } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each).
const R = {
  rc: deposits({ level: "rc", write: "rmw", people: 2 }),
  rr: deposits({ level: "rr", write: "rmw", people: 2 }),
  rr4: deposits({ level: "rr", write: "rmw", people: 4 }),
  atomicRc: deposits({ level: "rc", write: "atomic", people: 2 }),
  atomicRr: deposits({ level: "rr", write: "atomic", people: 2 }),
  skew: nights({ level: "rr", check: "plain", people: 2 }),
  ser: nights({ level: "ser", check: "plain", people: 2 }),
  ser4: nights({ level: "ser", check: "plain", people: 4 }),
  lock: nights({ level: "rc", check: "lock", people: 2 }),
};

const TOTAL = 2 * PER;
const per100 = (x) => n0(x);
const ms = (s) => Math.round(1000 * s) + " ms";
const sec = (s) => s.toFixed(2) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const range = ([a, b], unit = "ms") => (unit === "ms" ? Math.round(1000 * a) + "–" + Math.round(1000 * (a + b)) + " ms" : a.toFixed(1) + "–" + (a + b).toFixed(1) + " s");
const WORK_RANGE = range(WORK);
const IDLE_RANGE = range(IDLE, "s");

// What each card shows after a run.
const RUNS = {
  txn: () => {
    const lost = Math.round(R.rc.lost), on = TOTAL - lost;
    return {
      verdict: t(lost + " of " + TOTAL + " deposits lost (" + pct(R.rc.lostShare) + "). All " + TOTAL + " COMMITs succeeded, and none raised an error.",
        lost + " de " + TOTAL + " depósitos perdidos (" + pct(R.rc.lostShare) + "). Los " + TOTAL + " COMMIT salieron bien y ninguno dio error."),
      bars: [[t("Deposits committed", "Depósitos confirmados"), 1, String(TOTAL)], [t("Deposits in the balance", "Depósitos en el saldo"), on / TOTAL, String(on), true]],
    };
  },
  snapshot: () => {
    const m = top(R.rr4.aborts);
    return {
      verdict: t("Lost: " + Math.round(R.rc.lost) + " under READ COMMITTED, " + Math.round(R.rr.lost) + " under REPEATABLE READ. Failed and retried: " + per100(R.rr.aborts) + " per 100 deposits with 2 clerks, " + per100(R.rr4.aborts) + " with 4. A deposit took " + sec(R.rc.time) + " on average under READ COMMITTED, " + sec(R.rr.time) + " under REPEATABLE READ.",
        "Perdidos: " + Math.round(R.rc.lost) + " con READ COMMITTED, " + Math.round(R.rr.lost) + " con REPEATABLE READ. Fallados y reintentados: " + per100(R.rr.aborts) + " cada 100 depósitos con 2 empleados, " + per100(R.rr4.aborts) + " con 4. Un depósito tardó " + sec(R.rc.time) + " en promedio con READ COMMITTED y " + sec(R.rr.time) + " con REPEATABLE READ."),
      groups: [
        { title: t("Deposits lost, of " + TOTAL, "Depósitos perdidos, de " + TOTAL), bars: [["READ COMMITTED", R.rc.lostShare, String(Math.round(R.rc.lost))], ["REPEATABLE READ", R.rr.lostShare, String(Math.round(R.rr.lost)), true]] },
        { title: t("Retried per 100 deposits, REPEATABLE READ", "Reintentados cada 100 depósitos, REPEATABLE READ"), bars: [[t("2 clerks", "2 empleados"), R.rr.aborts / m, per100(R.rr.aborts), true], [t("4 clerks", "4 empleados"), R.rr4.aborts / m, per100(R.rr4.aborts)]] },
      ],
    };
  },
  atomic: () => {
    const m = top(R.atomicRr.aborts, R.atomicRc.waits);
    return {
      verdict: t("READ COMMITTED: " + Math.round(R.atomicRc.lost) + " lost, " + per100(R.atomicRc.aborts) + " retried per 100 deposits; " + per100(R.atomicRc.waits) + " in 100 waited for the row lock, " + ms(R.atomicRc.wait) + " on average. REPEATABLE READ: " + Math.round(R.atomicRr.lost) + " lost, " + per100(R.atomicRr.aborts) + " retried per 100 deposits.",
        "READ COMMITTED: " + Math.round(R.atomicRc.lost) + " perdidos, " + per100(R.atomicRc.aborts) + " reintentados cada 100 depósitos; " + per100(R.atomicRc.waits) + " de cada 100 esperaron el bloqueo de la fila, " + ms(R.atomicRc.wait) + " en promedio. REPEATABLE READ: " + Math.round(R.atomicRr.lost) + " perdidos, " + per100(R.atomicRr.aborts) + " reintentados cada 100 depósitos."),
      groups: [
        { title: t("Retried per 100 deposits", "Reintentados cada 100 depósitos"), bars: [["READ COMMITTED", R.atomicRc.aborts / m, per100(R.atomicRc.aborts)], ["REPEATABLE READ", R.atomicRr.aborts / m, per100(R.atomicRr.aborts), true]] },
        { title: t("Waited for the lock, per 100 deposits", "Esperaron el bloqueo, cada 100 depósitos"), bars: [["READ COMMITTED", R.atomicRc.waits / m, per100(R.atomicRc.waits)], ["REPEATABLE READ", R.atomicRr.waits / m, per100(R.atomicRr.waits)]] },
      ],
    };
  },
  skew: () => ({
    verdict: t("Nobody on call at the end of " + pct(R.skew.broken) + " of nights. The two requests overlapped on " + pct(R.skew.overlap) + " of nights. Serialization failures: " + per100(R.skew.aborts) + ".",
      "Nadie de guardia al final del " + pct(R.skew.broken) + " de las noches. Las dos solicitudes se superpusieron en el " + pct(R.skew.overlap) + " de las noches. Fallos de serialización: " + per100(R.skew.aborts) + "."),
    bars: [[t("Requests overlapped", "Solicitudes superpuestas"), R.skew.overlap, pct(R.skew.overlap)], [t("Nobody on call", "Nadie de guardia"), R.skew.broken, pct(R.skew.broken), true], [t("Serialization failures", "Fallos de serialización"), 0, per100(R.skew.aborts)]],
  }),
  serial: () => {
    const m = top(R.ser4.aborts, R.lock.waits);
    return {
      verdict: t("Nobody on call: " + pct(R.skew.broken) + " of nights under REPEATABLE READ, " + pct(R.ser.broken) + " under SERIALIZABLE, " + pct(R.lock.broken) + " with SELECT … FOR UPDATE at READ COMMITTED. SERIALIZABLE failed " + per100(R.ser.aborts) + " requests in 100 (" + per100(R.ser4.aborts) + " with 4 doctors); FOR UPDATE failed " + per100(R.lock.aborts) + " and made " + per100(R.lock.waits) + " in 100 wait.",
        "Nadie de guardia: " + pct(R.skew.broken) + " de las noches con REPEATABLE READ, " + pct(R.ser.broken) + " con SERIALIZABLE, " + pct(R.lock.broken) + " con SELECT … FOR UPDATE en READ COMMITTED. SERIALIZABLE hizo fallar " + per100(R.ser.aborts) + " solicitudes de cada 100 (" + per100(R.ser4.aborts) + " con 4 médicos); FOR UPDATE hizo fallar " + per100(R.lock.aborts) + " e hizo esperar a " + per100(R.lock.waits) + " de cada 100."),
      groups: [
        { title: t("Nights with nobody on call", "Noches sin nadie de guardia"), bars: [["REPEATABLE READ", R.skew.broken, pct(R.skew.broken)], ["SERIALIZABLE", R.ser.broken, pct(R.ser.broken), true], ["FOR UPDATE", R.lock.broken, pct(R.lock.broken)]] },
        { title: t("Per 100 requests", "Cada 100 solicitudes"), bars: [[t("SERIALIZABLE, failed", "SERIALIZABLE, fallidas"), R.ser.aborts / m, per100(R.ser.aborts), true], [t("SERIALIZABLE, 4 doctors, failed", "SERIALIZABLE, 4 médicos, fallidas"), R.ser4.aborts / m, per100(R.ser4.aborts)], [t("FOR UPDATE, waited", "FOR UPDATE, esperaron"), R.lock.waits / m, per100(R.lock.waits)]] },
      ],
    };
  },
};

const DEP = { scenario: "deposits", check: "plain", people: 2 };
const ROTA = { scenario: "rota", write: "rmw", people: 2 };

const EXPERIMENTS = [
  {
    id: "txn",
    title: t("Wrap it in a transaction", "Envolverlo en una transacción"),
    change: t("2 clerks × " + PER + " deposits · each runs BEGIN; SELECT the balance; " + WORK_RANGE + " of app work; UPDATE … SET balance = what it read + 10; COMMIT · READ COMMITTED, PostgreSQL's default",
      "2 empleados × " + PER + " depósitos · cada uno ejecuta BEGIN; SELECT del saldo; " + WORK_RANGE + " de trabajo en la app; UPDATE … SET saldo = lo que leyó + 10; COMMIT · READ COMMITTED, el nivel por defecto de PostgreSQL"),
    question: t("Every deposit committed without an error. How many of the " + TOTAL + " are missing from the balance?", "Cada depósito hizo COMMIT sin errores. ¿Cuántos de los " + TOTAL + " faltan en el saldo?"),
    options: [
      t("None: BEGIN and COMMIT make the read and the write one unit", "Ninguno: BEGIN y COMMIT hacen de la lectura y la escritura una unidad"),
      t("A handful, when two COMMITs land at the same instant", "Unos pocos, cuando dos COMMIT llegan en el mismo instante"),
      t("Dozens: the transaction never held back the other clerk", "Decenas: la transacción nunca frenó al otro empleado"),
    ],
    answer: 2,
    why: t(
      "READ COMMITTED promises that each statement sees only committed data; it promises nothing about the gap between two statements. Both clerks read the same balance, both write it plus 10, and the second write replaces the first: " + Math.round(R.rc.lost) + " of " + TOTAL + " deposits vanished while every COMMIT succeeded. The UPDATE does take a row lock, but only from the UPDATE on, after the stale read; a clerk who has to wait for it then writes its stale sum anyway. A transaction makes your writes all-or-nothing; it doesn't make other people's writes wait. It's the lost update of lesson 17, Race conditions, inside a transaction.",
      "READ COMMITTED promete que cada sentencia ve solo datos confirmados; no promete nada sobre el hueco entre dos sentencias. Los dos empleados leen el mismo saldo, los dos escriben ese saldo más 10, y la segunda escritura reemplaza a la primera: " + Math.round(R.rc.lost) + " de " + TOTAL + " depósitos desaparecieron mientras cada COMMIT salía bien. El UPDATE sí toma un bloqueo (lock) de la fila, pero solo desde el UPDATE en adelante, después de la lectura vieja; un empleado que tiene que esperarlo igual escribe después su suma vieja. Una transacción hace que tus escrituras sean todo o nada; no hace esperar a las escrituras de los demás. Es la actualización perdida (lost update) de la lección 17, Condiciones de carrera, dentro de una transacción.",
    ),
    watch: { ...DEP, level: "rc", write: "rmw" },
  },
  {
    id: "snapshot",
    title: t("Raise the level to REPEATABLE READ", "Subir el nivel a REPEATABLE READ"),
    change: t("The same 2 clerks and the same read, then write · READ COMMITTED → REPEATABLE READ, as PostgreSQL implements it (snapshot isolation) · the app retries a transaction that fails",
      "Los mismos 2 empleados y el mismo leer y escribir · READ COMMITTED → REPEATABLE READ, tal como lo implementa PostgreSQL (aislamiento de instantánea, snapshot isolation) · la app reintenta una transacción que falla"),
    question: t("The second clerk's UPDATE reaches a row the first clerk changed after the second clerk's snapshot. What happens?", "El UPDATE del segundo empleado llega a una fila que el primero cambió después de la instantánea del segundo. ¿Qué pasa?"),
    options: [
      t("It waits for the first clerk, then writes on top, losing nothing", "Espera al primer empleado y después escribe encima, sin perder nada"),
      t("It fails with a serialization error the app must retry", "Falla con un error de serialización que la app debe reintentar"),
      t("It overwrites the first deposit, the same as under READ COMMITTED", "Sobrescribe el primer depósito, igual que con READ COMMITTED"),
    ],
    answer: 1,
    why: t(
      "Under REPEATABLE READ every statement reads the snapshot taken at the transaction's first statement. When the UPDATE finds that a newer version of the row was committed since then, PostgreSQL won't write over a version this transaction never saw: it fails with \"could not serialize access due to concurrent update\" (SQLSTATE 40001). Nothing is lost (" + Math.round(R.rr.lost) + " of " + TOTAL + "), but " + per100(R.rr.aborts) + " in every 100 deposits failed and ran again from BEGIN, re-reading the new balance, and with 4 clerks it was " + per100(R.rr4.aborts) + " per 100: some deposits failed more than once. The level turned a silent wrong answer into an error, and the retry is the app's job. MySQL's InnoDB doesn't do this: at its REPEATABLE READ the UPDATE writes over the newer row and the deposit is lost, so the name of a level doesn't tell you what your engine does.",
      "Con REPEATABLE READ cada sentencia lee la instantánea (snapshot) tomada en la primera sentencia de la transacción. Cuando el UPDATE encuentra que desde entonces se confirmó una versión más nueva de la fila, PostgreSQL no escribe encima de una versión que esta transacción nunca vio: falla con \"could not serialize access due to concurrent update\" (SQLSTATE 40001). No se pierde nada (" + Math.round(R.rr.lost) + " de " + TOTAL + "), pero " + per100(R.rr.aborts) + " de cada 100 depósitos fallaron y se ejecutaron otra vez desde BEGIN, releyendo el saldo nuevo, y con 4 empleados fueron " + per100(R.rr4.aborts) + " cada 100: algunos depósitos fallaron más de una vez. El nivel convirtió una respuesta equivocada y silenciosa en un error, y el reintento es trabajo de la app. InnoDB de MySQL no hace esto: en su REPEATABLE READ el UPDATE escribe encima de la fila más nueva y el depósito se pierde, así que el nombre de un nivel no te dice qué hace tu motor.",
    ),
    watch: { ...DEP, level: "rr", write: "rmw" },
  },
  {
    id: "atomic",
    title: t("An atomic UPDATE at each level", "Un UPDATE atómico en cada nivel"),
    change: t("2 clerks · the write becomes one statement, UPDATE … SET balance = balance + 10 · each transaction still reads the balance first, to show the customer · READ COMMITTED vs REPEATABLE READ",
      "2 empleados · la escritura pasa a ser una sola sentencia, UPDATE … SET saldo = saldo + 10 · cada transacción igual lee primero el saldo, para mostrárselo al cliente · READ COMMITTED vs REPEATABLE READ"),
    question: t("With the atomic UPDATE, what does REPEATABLE READ add over READ COMMITTED?", "Con el UPDATE atómico, ¿qué agrega REPEATABLE READ frente a READ COMMITTED?"),
    options: [
      t("Nothing changes: the atomic UPDATE is safe at both levels", "No cambia nada: el UPDATE atómico es seguro en los dos niveles"),
      t("Serialization errors, where READ COMMITTED only waits", "Errores de serialización, donde READ COMMITTED solo espera"),
      t("Safety: READ COMMITTED still loses some atomic deposits", "Seguridad: READ COMMITTED todavía pierde algunos depósitos atómicos"),
    ],
    answer: 1,
    why: t(
      "Under READ COMMITTED an UPDATE that waits for a row lock goes on, once the lock is free, against the newest committed version of the row, so balance + 10 adds to the latest balance: " + Math.round(R.atomicRc.lost) + " lost and no failures, only short waits (" + per100(R.atomicRc.waits) + " in 100 deposits, " + ms(R.atomicRc.wait) + " on average). Under REPEATABLE READ the same UPDATE finds the row changed since its snapshot and fails, exactly as the read-then-write did: " + per100(R.atomicRr.aborts) + " retries per 100 deposits, and here they buy nothing, because the UPDATE was already correct. A stricter level isn't free: choose the write and the level together. For a single-row change, an atomic UPDATE at READ COMMITTED is the cheapest correct choice.",
      "Con READ COMMITTED, un UPDATE que espera un bloqueo de fila sigue, cuando el bloqueo se libera, contra la versión confirmada más nueva de la fila, así que saldo + 10 suma sobre el último saldo: " + Math.round(R.atomicRc.lost) + " perdidos y ningún fallo, solo esperas cortas (" + per100(R.atomicRc.waits) + " de cada 100 depósitos, " + ms(R.atomicRc.wait) + " en promedio). Con REPEATABLE READ el mismo UPDATE encuentra la fila cambiada desde su instantánea y falla, igual que leer y escribir: " + per100(R.atomicRr.aborts) + " reintentos cada 100 depósitos, y aquí no compran nada, porque el UPDATE ya era correcto. Un nivel más estricto no es gratis: elige la escritura y el nivel juntos. Para un cambio sobre una sola fila, un UPDATE atómico en READ COMMITTED es la opción correcta más barata.",
    ),
    watch: { ...DEP, level: "rr", write: "atomic" },
  },
  {
    id: "skew",
    title: t("Two doctors, one rule", "Dos médicos, una regla"),
    change: t("A ward rota · rule: at least one doctor on call · each night both doctors start on call and each asks to go off: count who is on call, " + WORK_RANGE + " of app work, go off only if 2 or more are · a plain SELECT · REPEATABLE READ",
      "La guardia de un hospital · regla: al menos un médico de guardia · cada noche los dos médicos empiezan de guardia y cada uno pide irse: cuenta quién está de guardia, " + WORK_RANGE + " de trabajo en la app, se va solo si hay 2 o más · un SELECT simple · REPEATABLE READ"),
    question: t("REPEATABLE READ stopped the lost deposit. How often does the ward end a night with nobody on call?", "REPEATABLE READ evitó el depósito perdido. ¿Qué tan seguido termina la noche sin nadie de guardia?"),
    options: [
      t("Never: the second change is refused, as with the deposits", "Nunca: el segundo cambio se rechaza, como con los depósitos"),
      t("Whenever the two requests overlap, and with no error", "Cada vez que las dos solicitudes se superponen, y sin ningún error"),
      t("Rarely: only when both COMMITs land at the same instant", "Rara vez: solo cuando los dos COMMIT llegan en el mismo instante"),
    ],
    answer: 1,
    why: t(
      "Each doctor reads both rows from a snapshot that shows two on call, and each writes only their own row. The writes never touch the same row, so there's no lock to wait for and no concurrent update to refuse: both COMMITs succeed and nobody is on call, on " + pct(R.skew.broken) + " of nights, the same as the share of nights the two requests overlapped (" + pct(R.skew.overlap) + "). That's write skew. Snapshot isolation checks writes against writes; a decision based on rows you read but didn't write isn't protected. Two bookings that each check a room is free, then insert a reservation, have the same shape.",
      "Cada médico lee las dos filas desde una instantánea que muestra a dos de guardia, y cada uno escribe solo su propia fila. Las escrituras nunca tocan la misma fila, así que no hay bloqueo que esperar ni actualización concurrente que rechazar: los dos COMMIT salen bien y no queda nadie de guardia, en el " + pct(R.skew.broken) + " de las noches, lo mismo que la parte de las noches en que las dos solicitudes se superpusieron (" + pct(R.skew.overlap) + "). Eso es una escritura sesgada (write skew). El aislamiento de instantánea compara escrituras con escrituras; una decisión basada en filas que leíste pero no escribiste no está protegida. Dos reservas que verifican que una sala está libre y después insertan la reserva tienen la misma forma.",
    ),
    watch: { ...ROTA, level: "rr", check: "plain" },
  },
  {
    id: "serial",
    title: t("SERIALIZABLE, or lock what you read", "SERIALIZABLE, o bloquear lo que lees"),
    change: t("The same rota · REPEATABLE READ → SERIALIZABLE (in PostgreSQL, serializable snapshot isolation) · compared with SELECT … FOR UPDATE of the on-call rows at READ COMMITTED",
      "La misma guardia · REPEATABLE READ → SERIALIZABLE (en PostgreSQL, aislamiento de instantánea serializable) · comparado con SELECT … FOR UPDATE de las filas de guardia en READ COMMITTED"),
    question: t("How does SERIALIZABLE keep a doctor on call?", "¿Cómo mantiene SERIALIZABLE a un médico de guardia?"),
    options: [
      t("It makes the second doctor wait for the first, like a lock", "Hace que el segundo médico espere al primero, como un bloqueo"),
      t("It fails one COMMIT; the retry finds one left and stays", "Hace fallar un COMMIT; el reintento encuentra a uno solo y se queda"),
      t("It can't: the two transactions write different rows", "No puede: las dos transacciones escriben filas distintas"),
    ],
    answer: 1,
    why: t(
      "SERIALIZABLE also keeps track of what each transaction read. At COMMIT it found a pattern no serial order could produce: each doctor had read a row the other one wrote. The second to commit failed with a serialization error (40001); its retry counted one doctor on call and stayed. Nights with nobody on call went from " + pct(R.skew.broken) + " to " + pct(R.ser.broken) + ", for " + per100(R.ser.aborts) + " failed requests in 100, and " + per100(R.ser4.aborts) + " with four doctors asking at once: contention multiplies the retries. SELECT … FOR UPDATE at READ COMMITTED also gave " + pct(R.lock.broken) + ", with no failures: the second doctor waited for the first one's locks (" + per100(R.lock.waits) + " requests in 100), then counted again. The lock only works if every code path takes it on the right rows, and it can't lock a row that doesn't exist yet, such as a new booking; SERIALIZABLE covers every transaction running at that level, but every one of them must be ready to retry.",
      "SERIALIZABLE además lleva la cuenta de lo que leyó cada transacción. En el COMMIT encontró un patrón que ningún orden en serie podría producir: cada médico había leído una fila que escribió el otro. El segundo en confirmar falló con un error de serialización (40001); su reintento contó a un médico de guardia y se quedó. Las noches sin nadie de guardia pasaron del " + pct(R.skew.broken) + " al " + pct(R.ser.broken) + ", a cambio de " + per100(R.ser.aborts) + " solicitudes fallidas de cada 100, y " + per100(R.ser4.aborts) + " con cuatro médicos pidiendo a la vez: la contención multiplica los reintentos. SELECT … FOR UPDATE en READ COMMITTED también dio " + pct(R.lock.broken) + ", sin fallos: el segundo médico esperó los bloqueos del primero (" + per100(R.lock.waits) + " solicitudes de cada 100) y después volvió a contar. El bloqueo solo funciona si cada camino del código lo toma sobre las filas correctas, y no puede bloquear una fila que todavía no existe, como una reserva nueva; SERIALIZABLE cubre cada transacción que corre en ese nivel, pero todas tienen que estar listas para reintentar.",
    ),
    watch: { ...ROTA, level: "ser", check: "plain" },
  },
];

const QUESTIONS = [
  [t("What does READ COMMITTED promise, and what doesn't it?", "¿Qué promete READ COMMITTED, y qué no?"),
    t("Each statement sees only data committed before that statement began: no dirty reads. Nothing holds across statements: two SELECTs in one transaction can see different data, and a value you read can change before your UPDATE, so read, then write, loses updates. A single statement that does its own reading, UPDATE … SET x = x + 10, is safe: after waiting for the row lock it works on the newest committed version.",
      "Cada sentencia ve solo datos confirmados antes de que empezara: no hay lecturas sucias (dirty reads). Nada se sostiene entre sentencias: dos SELECT en una transacción pueden ver datos distintos, y un valor que leíste puede cambiar antes de tu UPDATE, así que leer y después escribir pierde actualizaciones. Una sola sentencia que hace su propia lectura, UPDATE … SET x = x + 10, es segura: después de esperar el bloqueo de la fila, trabaja sobre la versión confirmada más nueva.")],
  [t("After a move to REPEATABLE READ on PostgreSQL, the logs fill with \"could not serialize access due to concurrent update\". What happened, and what should the code do?", "Después de pasar a REPEATABLE READ en PostgreSQL, los logs se llenan de \"could not serialize access due to concurrent update\". ¿Qué pasó, y qué debería hacer el código?"),
    t("Two transactions updated the same row, and the one whose snapshot predates the other's COMMIT was refused rather than allowed to write over a version it never saw. Catch SQLSTATE 40001 and retry the whole transaction from BEGIN, so it reads again from a fresh snapshot; retrying only the failed statement can't work, because the transaction is already aborted. Cap the retries, back off between them, and keep side effects (emails, calls to other services) out of the transaction or make them safe to repeat (lesson 25, Idempotency keys), since a retry runs everything again.",
      "Dos transacciones actualizaron la misma fila, y la que tenía una instantánea anterior al COMMIT de la otra fue rechazada en vez de escribir encima de una versión que nunca vio. Atrapa SQLSTATE 40001 y reintenta la transacción entera desde BEGIN, para que vuelva a leer desde una instantánea nueva; reintentar solo la sentencia que falló no sirve, porque la transacción ya está abortada. Limita los reintentos, espera entre ellos, y deja los efectos secundarios (correos, llamadas a otros servicios) fuera de la transacción o haz que sea seguro repetirlos (lección 25, Claves de idempotencia), porque un reintento vuelve a ejecutar todo.")],
  [t("Explain write skew with the on-call example, and why snapshot isolation lets it through.", "Explica la escritura sesgada (write skew) con el ejemplo de la guardia, y por qué el aislamiento de instantánea la deja pasar."),
    t("Both doctors read the same snapshot (two on call), each decides it's safe to leave, and each updates only their own row. Snapshot isolation only stops two transactions writing the same row; these write sets don't overlap, so both commit and the rule breaks. The decision rested on rows each read but didn't write. Fixes: SERIALIZABLE; SELECT … FOR UPDATE on the rows the decision reads; or turn the conflict into a write both must make, such as updating a per-ward row, so the same-row check catches it; or a constraint the database enforces, when the rule can be written as one.",
      "Los dos médicos leen la misma instantánea (dos de guardia), cada uno decide que puede irse y cada uno actualiza solo su propia fila. El aislamiento de instantánea solo impide que dos transacciones escriban la misma fila; estos conjuntos de escritura no se cruzan, así que las dos confirman y la regla se rompe. La decisión se apoyaba en filas que cada una leyó pero no escribió. Soluciones: SERIALIZABLE; SELECT … FOR UPDATE sobre las filas que lee la decisión; o convertir el conflicto en una escritura que las dos tengan que hacer, como actualizar una fila por sala, para que la comprobación de misma fila lo detecte; o una restricción que la base de datos haga cumplir, cuando la regla se puede escribir como una.")],
  [t("Does the same read, then write code behave the same on MySQL (InnoDB) at REPEATABLE READ?", "¿El mismo código de leer y después escribir se comporta igual en MySQL (InnoDB) con REPEATABLE READ?"),
    t("No. REPEATABLE READ is InnoDB's default, and its plain SELECTs read a snapshot, but an UPDATE reads and locks the newest committed row and raises no error when it changed, so SET balance = what I read + 10 still loses the deposit. There, use an atomic UPDATE or SELECT … FOR UPDATE. The level names come from the SQL standard, which defines them by the anomalies they must prevent; what each engine actually does at each level differs, so read your engine's documentation, not the name.",
      "No. REPEATABLE READ es el nivel por defecto de InnoDB, y sus SELECT simples leen una instantánea, pero un UPDATE lee y bloquea la fila confirmada más nueva y no da ningún error si cambió, así que SET saldo = lo que leí + 10 igual pierde el depósito. Ahí, usa un UPDATE atómico o SELECT … FOR UPDATE. Los nombres de los niveles vienen del estándar SQL, que los define por las anomalías que deben impedir; lo que hace cada motor en cada nivel es distinto, así que lee la documentación de tu motor, no el nombre.")],
  [t("When would you pick SERIALIZABLE over SELECT … FOR UPDATE, and what does each cost?", "¿Cuándo elegirías SERIALIZABLE en vez de SELECT … FOR UPDATE, y qué cuesta cada uno?"),
    t("FOR UPDATE is explicit and cheap when you know exactly which existing rows a decision rests on, and a conflict waits instead of failing. But every code path must lock the same rows, in the same order or risk deadlocks, and it can't lock rows that don't exist yet, so \"is the room free? then insert a booking\" still races. SERIALIZABLE covers those cases without your finding every read that matters, but conflicts fail and must be retried, contention multiplies the retries, PostgreSQL can fail transactions that weren't truly in conflict, and its guarantee only covers transactions that all run at SERIALIZABLE.",
      "FOR UPDATE es explícito y barato cuando sabes exactamente en qué filas existentes se apoya una decisión, y un conflicto espera en vez de fallar. Pero cada camino del código tiene que bloquear las mismas filas, en el mismo orden o arriesgarse a bloqueos mutuos (deadlocks), y no puede bloquear filas que todavía no existen, así que \"¿la sala está libre? entonces inserta una reserva\" sigue compitiendo. SERIALIZABLE cubre esos casos sin que tengas que encontrar cada lectura que importa, pero los conflictos fallan y hay que reintentarlos, la contención multiplica los reintentos, PostgreSQL puede hacer fallar transacciones que en realidad no estaban en conflicto, y su garantía solo cubre transacciones que corren todas en SERIALIZABLE.")],
  [t("A report runs two SELECTs, one per account, while transfers move money between the accounts. Why can its total come out wrong under READ COMMITTED, and what fixes it?", "Un reporte ejecuta dos SELECT, uno por cuenta, mientras transferencias mueven dinero entre las cuentas. ¿Por qué el total puede salir mal con READ COMMITTED, y qué lo arregla?"),
    t("Under READ COMMITTED each SELECT sees the data committed when it starts. A transfer that commits between the two can be seen half done: the first account read before it, the second after, so the total is off by the amount moved (read skew). Under REPEATABLE READ both SELECTs read one snapshot, so the report sees each transfer entirely or not at all. A single statement, SELECT sum(balance) over both accounts, also reads one snapshot even under READ COMMITTED.",
      "Con READ COMMITTED cada SELECT ve los datos confirmados cuando empieza. Una transferencia que confirma entre los dos se puede ver a medias: la primera cuenta leída antes, la segunda después, así que el total queda desviado por el monto movido (lectura sesgada, read skew). Con REPEATABLE READ los dos SELECT leen una sola instantánea, así que el reporte ve cada transferencia completa o nada. Una sola sentencia, SELECT sum(saldo) sobre las dos cuentas, también lee una sola instantánea incluso con READ COMMITTED.")],
];

export default defineLesson({
  title: t("Isolation Levels Workbench", "Banco de trabajo: niveles de aislamiento"),
  eyebrow: t("Systems lesson 65 · Isolation levels", "Lección de sistemas 65 · Niveles de aislamiento"),
  lede: t("An isolation level decides what a transaction sees of the others running beside it, and which of their clashes the database stops. READ COMMITTED, PostgreSQL's default, stops fewer than most people expect; REPEATABLE READ stops more, some only as errors your app must retry; and one kind of clash gets past both. This lesson turns it into a records office with a timeline of every read and write: watch it, predict what breaks it, then explain it back.",
    "Un nivel de aislamiento decide qué ve una transacción de las otras que corren a su lado, y cuáles de sus choques detiene la base de datos. READ COMMITTED, el nivel por defecto de PostgreSQL, detiene menos de lo que se suele creer; REPEATABLE READ detiene más, algunos solo como errores que tu app tiene que reintentar; y un tipo de choque pasa por los dos. Esta lección lo convierte en una oficina de registros con una línea de tiempo de cada lectura y escritura: mírala, predice qué la rompe y después explícala."),
  machine: {
    intro: t("Each desk runs one transaction at a time against the database at the back, and the tape records every read, write, COMMIT and ROLLBACK as it happens. Switch between deposits into one account and an on-call rota with a rule, change the isolation level and how the write is done, and add desks.",
      "Cada escritorio ejecuta una transacción a la vez contra la base de datos del fondo, y la cinta registra cada lectura, escritura, COMMIT y ROLLBACK a medida que ocurren. Cambia entre depósitos en una cuenta y una guardia de hospital con una regla, cambia el nivel de aislamiento y la forma de escribir, y agrega escritorios."),
    plate: {
      title: t("Records office", "Oficina de registros"),
      keys: [
        { mark: "lit", label: t("A deposit written over; a night left with nobody on call", "Un depósito sobrescrito; una noche que quedó sin nadie de guardia") },
        { mark: "raised", label: t("Writes on the tape, lock tags under the rows, flags on doctors on call", "Escrituras en la cinta, etiquetas de bloqueo bajo las filas, banderas de los médicos de guardia") },
        { mark: "flat", label: t("Reads on the tape, with the value read", "Lecturas en la cinta, con el valor leído") },
      ],
      caption: t(
        "Played at a quarter of app time (change it under Speed); the times are illustrative and round. A transaction reads, does " + WORK_RANGE + " of app work (a call to another service, say), writes, and commits " + Math.round(1000 * TAIL) + " ms later; a clerk starts the next deposit " + IDLE_RANGE + " after one commits. In the rota, each doctor asks within " + NIGHT.window.toFixed(1) + " s of the night starting. The level is printed on the cabinet; a slip shows what the desk's transaction read. On the tape, time runs right to left: each tile ends at the moment it happened, a post is a COMMIT, a cross a ROLLBACK (a serialization failure; the app retries after " + range(BACKOFF) + "), a dashed stretch a wait for a row lock, whose holder's letter hangs under the row. Counters: deposits or nights, ROLLBACKS, and deposits LOST or nights with NOBODY on call.",
        "Se reproduce a un cuarto del tiempo de la app (cámbialo en Velocidad); los tiempos son ilustrativos y redondos. Una transacción lee, hace " + WORK_RANGE + " de trabajo en la app (una llamada a otro servicio, por ejemplo), escribe y hace COMMIT " + Math.round(1000 * TAIL) + " ms después; un empleado empieza el siguiente depósito " + IDLE_RANGE + " después de confirmar uno. En la guardia, cada médico pide irse dentro de los " + NIGHT.window.toFixed(1) + " s del comienzo de la noche. El nivel está impreso en el gabinete; una boleta muestra lo que leyó la transacción del escritorio. En la cinta el tiempo corre de derecha a izquierda: cada ficha termina en el momento en que ocurrió, un poste es un COMMIT, una cruz un ROLLBACK (un fallo de serialización; la app reintenta después de " + range(BACKOFF) + "), un tramo punteado una espera por un bloqueo de fila, cuyo dueño cuelga con su letra bajo la fila. Contadores: depósitos o noches, ROLLBACKS, y depósitos PERDIDOS o noches sin NADIE de guardia.",
      ),
      stage: { "data-records": "" },
      label: t("Isolation levels simulation. Space pauses or resumes.", "Simulación de niveles de aislamiento. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["done", t("Deposits", "Depósitos")],
      ["lost", t("Lost", "Perdidos")],
      ["aborts", t("Rollbacks", "Rollbacks")],
      ["waits", t("Lock waits", "Esperas de bloqueo")],
      ["time", t("Avg time", "Tiempo prom."), "–"],
    ],
    controls: [
      { seg: "scenario", label: t("Scenario", "Escenario"), options: [["deposits", t("Deposits", "Depósitos")], ["rota", t("On-call rota", "Guardia")]], value: "deposits" },
      { seg: "level", label: t("Isolation level", "Nivel de aislamiento"), options: [["rc", "Read committed"], ["rr", "Repeatable read"], ["ser", "Serializable"]], value: "rc" },
      { seg: "write", for: "deposits", label: t("Write", "Escritura"), options: [["rmw", t("Read, then write", "Leer y escribir")], ["atomic", t("Atomic UPDATE", "UPDATE atómico")], ["lock", "SELECT … FOR UPDATE"]], value: "rmw" },
      { seg: "check", for: "rota", hidden: true, label: t("Count with", "Contar con"), options: [["plain", t("Plain SELECT", "SELECT simple")], ["lock", "SELECT … FOR UPDATE"]], value: "plain" },
      { seg: "people", label: t("Desks", "Escritorios"), options: [[2, "2"], [3, "3"], [4, "4"]], value: 2 },
      { speed: true, options: [[0.1, "1/10"], [0.25, "1/4"], [1, t("App time", "Tiempo de la app")]], value: 0.25 },
      { actions: [["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. The app retries every transaction that fails with a serialization error. In the rota, the people at the desks are the doctors, and the run goes night after night.",
      "Cambiar un ajuste reinicia la ejecución. La app reintenta cada transacción que falla con un error de serialización. En la guardia, las personas de los escritorios son los médicos, y la ejecución sigue noche tras noche."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of " + PER + " deposits per clerk or " + NIGHTS + " nights.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de " + PER + " depósitos por empleado o " + NIGHTS + " noches."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The levels behave as PostgreSQL's <a href="https://www.postgresql.org/docs/current/transaction-iso.html" target="_blank" rel="noopener">Transaction Isolation</a> chapter describes; the SERIALIZABLE check is a simplified version of its serializable snapshot isolation (Cahill, Röhm and Fekete, 2008; Ports and Grittner, 2012).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los niveles se comportan como lo describe el capítulo <a href="https://www.postgresql.org/docs/current/transaction-iso.html" target="_blank" rel="noopener">Transaction Isolation</a> de PostgreSQL; la verificación de SERIALIZABLE es una versión simplificada de su aislamiento de instantánea serializable (Cahill, Röhm y Fekete, 2008; Ports y Grittner, 2012).`),
  css: LIT_FILL_CSS + `
[data-slip-text],[data-mark-text],[data-tag-text]{font-weight:600}
[data-level]{font-weight:600;letter-spacing:.02em}
`,
  data: { P, G: GEOMETRY, MARKS: markSvgs() },
});
