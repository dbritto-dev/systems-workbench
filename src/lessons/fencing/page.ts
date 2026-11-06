// @ts-nocheck: content in the style of the other lessons
// Systems lesson 62 · Leases & fencing tokens: a key office that hands out a timed key, workers who can freeze while
// holding it, and a vault that can refuse a key with an old number.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { oneUnder10, n0 } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, keyTagSvg, slipSvg, P, GEOMETRY } from "./figure";
import { pauseRun, checkRun, fenceRun, ttlRun, writesRun, WORK, UPLOAD, SHORT, LONG, PAUSE_EVERY, CRASH_EVERY, DOWN } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeded runs of an hour each).
const R = { pause: pauseRun(), check: checkRun(), fence: fenceRun(), ttl: ttlRun(), writes: writesRun() };

const k1 = (x) => (x === 0 ? "0" : oneUnder10(x));     // per thousand jobs
const s0 = (x) => n0(x) + " s";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const range = ([a, b], d = 1) => a.toFixed(d) + "–" + (a + b).toFixed(d) + " s";
const WORK_RANGE = range(WORK), UPLOAD_RANGE = range(UPLOAD), SHORT_RANGE = range(SHORT);
const LONG_RANGE = range(LONG.len, 0);
const LONG_EVERY = Math.round(1 / LONG.share);

// What each card shows after a run.
const RUNS = {
  pause: () => {
    const { short, long } = R.pause, m = top(long.over, 1);
    return {
      verdict: t("Short pauses: " + k1(short.over) + " overwrites per 1,000 jobs. Long pauses: " + k1(long.over) + " per 1,000 jobs, about " + n0(long.overN) + " an hour, and the key went to a new holder " + n0(long.two) + " times an hour while the old one, paused, still thought it held it. The key office never had two leases out at once.",
        "Pausas cortas: " + k1(short.over) + " sobrescrituras cada 1000 tareas. Pausas largas: " + k1(long.over) + " cada 1000 tareas, unas " + n0(long.overN) + " por hora, y la llave pasó a un dueño nuevo " + n0(long.two) + " veces por hora mientras el anterior, en pausa, seguía creyendo que la tenía. La oficina de llaves nunca tuvo dos arrendamientos a la vez."),
      bars: [[t("Overwrites, short pauses", "Sobrescrituras, pausas cortas"), short.over / m, k1(short.over)], [t("Overwrites, long pauses", "Sobrescrituras, pausas largas"), long.over / m, k1(long.over), true]],
    };
  },
  check: () => {
    const { none, check } = R.check, m = top(none.over);
    return {
      verdict: t("No check: " + k1(none.over) + " overwrites per 1,000 jobs. Checking the lease before the write: " + k1(check.over) + " per 1,000 jobs, while the check stopped " + k1(check.stopped) + " jobs per 1,000 whose lease had already run out.",
        "Sin verificar: " + k1(none.over) + " sobrescrituras cada 1000 tareas. Verificando el arrendamiento antes de escribir: " + k1(check.over) + " cada 1000 tareas, mientras la verificación detuvo " + k1(check.stopped) + " tareas cada 1000 cuyo arrendamiento ya había vencido."),
      bars: [[t("Overwrites, no check", "Sobrescrituras, sin verificar"), none.over / m, k1(none.over)], [t("Overwrites, check first", "Sobrescrituras, verificando"), check.over / m, k1(check.over), true], [t("Jobs stopped by the check", "Tareas detenidas al verificar"), check.stopped / m, k1(check.stopped)]],
    };
  },
  fence: () => {
    const { none, fence } = R.fence, m = top(none.over, fence.rejected);
    return {
      verdict: t("The vault ignores tokens: " + k1(none.over) + " overwrites per 1,000 jobs. The vault compares tokens: " + k1(fence.over) + ", and it refused " + k1(fence.rejected) + " calls per 1,000 jobs from workers whose lease had run out.",
        "La bóveda ignora los tokens: " + k1(none.over) + " sobrescrituras cada 1000 tareas. La bóveda compara tokens: " + k1(fence.over) + ", y rechazó " + k1(fence.rejected) + " llamadas cada 1000 tareas de trabajadores cuyo arrendamiento había vencido."),
      bars: [[t("Overwrites, tokens ignored", "Sobrescrituras, tokens ignorados"), none.over / m, k1(none.over)], [t("Overwrites, tokens compared", "Sobrescrituras, tokens comparados"), fence.over / m, k1(fence.over), true], [t("Calls refused, tokens compared", "Llamadas rechazadas, comparando"), fence.rejected / m, k1(fence.rejected)]],
    };
  },
  ttl: () => {
    const { ten, sixty } = R.ttl, mo = top(ten.over), mi = top(sixty.idlePerCrash), mj = top(ten.perMin);
    return {
      verdict: t("TTL 10 s: " + k1(ten.over) + " overwrites per 1,000 jobs, the key sat unusable " + s0(ten.idlePerCrash) + " after each crash, " + n0(ten.perMin) + " jobs a minute. TTL 60 s: " + k1(sixty.over) + " overwrites, " + s0(sixty.idlePerCrash) + " after each crash, " + n0(sixty.perMin) + " jobs a minute.",
        "TTL de 10 s: " + k1(ten.over) + " sobrescrituras cada 1000 tareas, la llave quedó inutilizable " + s0(ten.idlePerCrash) + " después de cada caída, " + n0(ten.perMin) + " tareas por minuto. TTL de 60 s: " + k1(sixty.over) + " sobrescrituras, " + s0(sixty.idlePerCrash) + " después de cada caída, " + n0(sixty.perMin) + " tareas por minuto."),
      groups: [
        { title: t("Overwrites per 1,000 jobs", "Sobrescrituras cada 1000 tareas"), bars: [[t("TTL 10 s", "TTL de 10 s"), ten.over / mo, k1(ten.over)], [t("TTL 60 s", "TTL de 60 s"), sixty.over / mo, k1(sixty.over), true]] },
        { title: t("Key unusable after a crash", "Llave inutilizable tras una caída"), bars: [[t("TTL 10 s", "TTL de 10 s"), ten.idlePerCrash / mi, s0(ten.idlePerCrash)], [t("TTL 60 s", "TTL de 60 s"), sixty.idlePerCrash / mi, s0(sixty.idlePerCrash), true]] },
        { title: t("Jobs a minute", "Tareas por minuto"), bars: [[t("TTL 10 s", "TTL de 10 s"), ten.perMin / mj, n0(ten.perMin)], [t("TTL 60 s", "TTL de 60 s"), sixty.perMin / mj, n0(sixty.perMin), true]] },
      ],
    };
  },
  writes: () => {
    const { writes, all, none } = R.writes, m = top(writes.over, 0.5);
    return {
      verdict: t("Tokens on every call: " + k1(all.over) + " overwrites per 1,000 jobs. Tokens on writes only: " + k1(writes.over) + " per 1,000 jobs, about " + one(writes.overN) + " an hour, against " + k1(none.over) + " with no tokens.",
        "Tokens en todas las llamadas: " + k1(all.over) + " sobrescrituras cada 1000 tareas. Tokens solo en las escrituras: " + k1(writes.over) + " cada 1000 tareas, unas " + one(writes.overN) + " por hora, contra " + k1(none.over) + " sin tokens."),
      bars: [[t("Every call", "Todas las llamadas"), all.over / m, k1(all.over)], [t("Writes only", "Solo escrituras"), writes.over / m, k1(writes.over), true]],
    };
  },
};
function one(x) { return x.toFixed(1); }

const { pause: A, check: C, fence: F, ttl: Q, writes: W } = R;

const EXPERIMENTS = [
  {
    id: "pause",
    title: t("A pause longer than the lease", "Una pausa más larga que el arrendamiento"),
    change: t("Lease TTL 10 s, renewed every third of it · no check, no tokens · each worker pauses every " + PAUSE_EVERY + " s on average: every pause " + SHORT_RANGE + " vs one pause in " + LONG_EVERY + " lasting " + LONG_RANGE,
      "TTL del arrendamiento de 10 s, renovado cada tercio · sin verificar, sin tokens · cada trabajador hace una pausa cada " + PAUSE_EVERY + " s en promedio: todas de " + SHORT_RANGE + " vs una de cada " + LONG_EVERY + " de " + LONG_RANGE),
    question: t("With the long pauses, does the lease still keep the workers' writes apart?", "Con las pausas largas, ¿el arrendamiento sigue separando las escrituras de los trabajadores?"),
    options: [
      t("Yes: the key office never grants two leases at once", "Sí: la oficina de llaves nunca da dos arrendamientos a la vez"),
      t("No: a woken holder writes after its key has moved on", "No: un dueño que despierta escribe cuando su llave ya pasó a otro"),
      t("Partly: the paused job is lost, but nobody else's", "En parte: se pierde la tarea en pausa, pero la de nadie más"),
    ],
    answer: 1,
    why: t(
      "The key office kept its promise: by its own clock, no two leases ever overlapped. But a lease is a promise about time, and a paused process can't see time pass. The worker stopped mid-job, its renewals didn't happen, the lease ran out and the key went to the next worker in line. When it woke, it carried on from the line of code where it had stopped, with a read that was now out of date, and its write landed on top of the new holder's (or the new holder's on top of its own): " + k1(A.long.over) + " overwrites per 1,000 jobs. Short pauses never outlast the lease, since each renewal leaves at least two thirds of it, so they cost nothing. It takes one pause longer than what's left: a stop-the-world GC, a paused or migrating VM, a swapped-out process. The pauses here come far more often than in a healthy system, so that an hour shows enough of them.",
      "La oficina de llaves cumplió su promesa: según su propio reloj, nunca hubo dos arrendamientos superpuestos. Pero un arrendamiento (lease) es una promesa sobre el tiempo, y un proceso en pausa no ve pasar el tiempo. El trabajador se detuvo a mitad de la tarea, sus renovaciones no ocurrieron, el arrendamiento venció y la llave pasó al siguiente en la fila. Al despertar siguió desde la línea de código donde se había detenido, con una lectura que ya estaba desactualizada, y su escritura cayó encima de la del dueño nuevo (o la del dueño nuevo encima de la suya): " + k1(A.long.over) + " sobrescrituras cada 1000 tareas. Las pausas cortas nunca duran más que el arrendamiento, porque cada renovación deja al menos dos tercios, así que no cuestan nada. Basta una pausa más larga que lo que queda: una pausa del recolector de basura (GC) que detiene todo, una VM pausada o en migración, un proceso enviado a swap. Aquí las pausas ocurren mucho más seguido que en un sistema sano, para que una hora muestre suficientes.",
    ),
    watch: { pauses: "long", ttl: "10", check: "off", fence: "off", crashes: "off", stage: "freeze", extra: 3 },
  },
  {
    id: "check",
    title: t("Check the lease before writing", "Verificar el arrendamiento antes de escribir"),
    change: t("Long pauses · after the work, the worker checks that its lease is still valid and only then sends the write, which takes " + UPLOAD_RANGE + " to send",
      "Pausas largas · después del trabajo, el trabajador verifica que su arrendamiento siga vigente y solo entonces envía la escritura, que tarda " + UPLOAD_RANGE + " en enviarse"),
    question: t("How many overwrites per 1,000 jobs are left?", "¿Cuántas sobrescrituras quedan cada 1000 tareas?"),
    options: [
      t("None: the check catches every expired lease", "Ninguna: la verificación atrapa todo arrendamiento vencido"),
      t("A few: a pause after the check still gets through", "Unas pocas: una pausa después de verificar igual pasa"),
      t("About as many: the check runs too early to help", "Casi las mismas: la verificación llega demasiado pronto"),
    ],
    answer: 1,
    why: t(
      "The check catches every pause that ends before it: the worker sees its lease has run out and drops the job (" + k1(C.check.stopped) + " jobs per 1,000 here). But a pause can also start right after the check, while the write is on its way. The worker checked something that was true, then stopped, and the write it had already decided to send lands when the lease belongs to someone else: " + k1(C.check.over) + " overwrites per 1,000 jobs, down from " + k1(C.none.over) + ". Any gap between the check and the write landing at the storage has the same hole: a pause, a slow network, a retransmitted packet. It's check-then-act from lesson 17, Race conditions, with time as the other party. A shorter gap makes it rarer, never impossible.",
      "La verificación atrapa toda pausa que termina antes de ella: el trabajador ve que su arrendamiento venció y deja la tarea (" + k1(C.check.stopped) + " tareas cada 1000 aquí). Pero una pausa también puede empezar justo después de verificar, mientras la escritura va en camino. El trabajador verificó algo que era cierto, se detuvo, y la escritura que ya había decidido enviar llega cuando el arrendamiento es de otro: " + k1(C.check.over) + " sobrescrituras cada 1000 tareas, contra " + k1(C.none.over) + ". Cualquier hueco entre la verificación y el momento en que la escritura llega al almacenamiento tiene el mismo problema: una pausa, una red lenta, un paquete retransmitido. Es el verificar-y-después-actuar (check-then-act) de la lección 17, Condiciones de carrera, con el tiempo como el otro participante. Un hueco más corto lo vuelve más raro, nunca imposible.",
    ),
    watch: { pauses: "long", ttl: "10", check: "on", fence: "off", crashes: "off", stage: "freeze", extra: 3 },
  },
  {
    id: "fence",
    title: t("Number the keys", "Numerar las llaves"),
    change: t("Long pauses, no check · every key carries a token, one higher than the last, and every call to the vault carries it · the vault ignores tokens vs refuses any call whose token is lower than the highest it has seen",
      "Pausas largas, sin verificar · cada llave lleva un token, uno más que el anterior, y cada llamada a la bóveda lo lleva · la bóveda ignora los tokens vs rechaza toda llamada con un token menor que el más alto que vio"),
    question: t("With the vault comparing tokens, what happens to the woken worker's write?", "Con la bóveda comparando tokens, ¿qué pasa con la escritura del trabajador que despierta?"),
    options: [
      t("It's refused: the vault has seen a higher token", "Se rechaza: la bóveda ya vio un token más alto"),
      t("It lands: its token was valid when it was issued", "Entra: su token era válido cuando se emitió"),
      t("It waits until the new holder hands the key back", "Espera a que el dueño nuevo devuelva la llave"),
    ],
    answer: 0,
    why: t(
      "The key office can't stop a paused worker, but the vault sees every call, in order. The new holder's token reaches the vault with its first read, so when the woken worker's older token arrives, the vault knows a newer holder exists and refuses it; the worker learns it lost the lease and drops the job. Overwrites go from " + k1(F.none.over) + " per 1,000 jobs to " + k1(F.fence.over) + ", and " + k1(F.fence.rejected) + " calls per 1,000 jobs are refused. A stale call that arrives before the new holder has touched the vault is accepted, and that's harmless: the vault still sees one holder after another. This is the fencing token from Martin Kleppmann's \"How to do distributed locking\" (2016); Chubby's sequencers do the same job. The token must come from the lock service and only go up: with ZooKeeper, the zxid or the znode version can serve. Safety no longer depends on how long a pause lasts.",
      "La oficina de llaves no puede detener a un trabajador en pausa, pero la bóveda ve cada llamada, en orden. El token del dueño nuevo llega a la bóveda con su primera lectura, así que cuando llega el token más viejo del trabajador que despertó, la bóveda sabe que existe un dueño más nuevo y lo rechaza; el trabajador se entera de que perdió el arrendamiento y deja la tarea. Las sobrescrituras pasan de " + k1(F.none.over) + " cada 1000 tareas a " + k1(F.fence.over) + ", y se rechazan " + k1(F.fence.rejected) + " llamadas cada 1000 tareas. Una llamada vieja que llega antes de que el dueño nuevo toque la bóveda se acepta, y eso no hace daño: la bóveda igual ve un dueño después de otro. Es el token de cerco (fencing token) de \"How to do distributed locking\" de Martin Kleppmann (2016); los secuenciadores (sequencers) de Chubby hacen lo mismo. El token tiene que venir del servicio de bloqueo y solo subir: con ZooKeeper sirven el zxid o la versión del znode. La seguridad ya no depende de cuánto dure una pausa.",
    ),
    watch: { pauses: "long", ttl: "10", check: "off", fence: "all", crashes: "off", stage: "freeze", extra: 3 },
  },
  {
    id: "ttl",
    title: t("A longer lease", "Un arrendamiento más largo"),
    change: t("Long pauses, no check, no tokens · a holder crashes in one job in " + CRASH_EVERY + " (back after " + DOWN + " s), and its lease stays until it runs out · TTL 10 s vs 60 s",
      "Pausas largas, sin verificar, sin tokens · un dueño se cae en una de cada " + CRASH_EVERY + " tareas (vuelve a los " + DOWN + " s), y su arrendamiento sigue hasta que vence · TTL de 10 s vs 60 s"),
    question: t("With a 60 s lease, what changes?", "Con un arrendamiento de 60 s, ¿qué cambia?"),
    options: [
      t("No overwrites, and nothing else: live holders renew", "Ninguna sobrescritura, y nada más: los dueños vivos renuevan"),
      t("No overwrites, but each crash stalls everyone far longer", "Ninguna sobrescritura, pero cada caída frena a todos mucho más"),
      t("Hardly any change: long pauses still outlast it", "Casi nada: las pausas largas igual lo superan"),
    ],
    answer: 1,
    why: t(
      "A longer lease outlasts more pauses; none of the pauses here reaches 60 s, so overwrites go from " + k1(Q.ten.over) + " per 1,000 jobs to " + k1(Q.sixty.over) + ". But the TTL is also how long everyone waits when a holder really dies, because the key office can't tell a crashed holder from a paused one: both just stop renewing. Every crash left the key unusable for " + s0(Q.sixty.idlePerCrash) + " instead of " + s0(Q.ten.idlePerCrash) + ", and the workers did " + n0(Q.sixty.perMin) + " jobs a minute instead of " + n0(Q.ten.perMin) + ". And no TTL is safe against every pause, since nothing bounds a GC pause or a VM migration. With fencing tokens, the TTL stops being a safety setting and becomes a trade between failover time and needless handovers.",
      "Un arrendamiento más largo sobrevive a más pausas; ninguna de las pausas de aquí llega a 60 s, así que las sobrescrituras pasan de " + k1(Q.ten.over) + " cada 1000 tareas a " + k1(Q.sixty.over) + ". Pero el TTL también es cuánto esperan todos cuando un dueño de verdad se cae, porque la oficina de llaves no distingue un dueño caído de uno en pausa: los dos simplemente dejan de renovar. Cada caída dejó la llave inutilizable " + s0(Q.sixty.idlePerCrash) + " en lugar de " + s0(Q.ten.idlePerCrash) + ", y los trabajadores hicieron " + n0(Q.sixty.perMin) + " tareas por minuto en lugar de " + n0(Q.ten.perMin) + ". Y ningún TTL es seguro contra toda pausa, porque nada acota una pausa de GC o una migración de VM. Con tokens de cerco, el TTL deja de ser un ajuste de seguridad y pasa a ser un equilibrio entre el tiempo de recuperación y los traspasos innecesarios.",
    ),
    watch: { pauses: "long", ttl: "60", check: "off", fence: "off", crashes: "on", stage: "crash" },
  },
  {
    id: "writes",
    title: t("Tokens on writes only", "Tokens solo en las escrituras"),
    change: t("Long pauses, no check · the vault compares tokens on every call vs on writes only: reads go unchecked and leave no mark",
      "Pausas largas, sin verificar · la bóveda compara tokens en todas las llamadas vs solo en las escrituras: las lecturas no se verifican y no dejan marca"),
    question: t("With tokens checked on writes only, how many overwrites are left?", "Con tokens verificados solo en las escrituras, ¿cuántas sobrescrituras quedan?"),
    options: [
      t("None: every stale write meets a higher token", "Ninguna: toda escritura vieja se cruza con un token más alto"),
      t("A few: a stale write can beat the new holder's", "Unas pocas: una escritura vieja puede ganarle a la nueva"),
      t("Most of them: a write alone can't tell stale from new", "Casi todas: una escritura sola no distingue vieja de nueva"),
    ],
    answer: 1,
    why: t(
      "Each job is a read-modify-write. If only writes carry the token, the new holder's read leaves no mark at the vault. A woken worker's write can then land after the new holder has read and before it has written: the vault has seen no higher token on a write yet, so it takes the old one, and the new holder's write, computed from its earlier read, overwrites it. Usually the new holder has already written by the time the old one wakes, so this is rare: " + k1(W.writes.over) + " per 1,000 jobs instead of " + k1(W.none.over) + " with no tokens, but not " + k1(W.all.over) + ". The vault must see the token on every call the holder's decision depends on, or make the write conditional on what was read (the version check of lesson 17). And a vault that ignores tokens protects nothing: the check only works at the resource itself.",
      "Cada tarea es un leer-modificar-escribir. Si solo las escrituras llevan el token, la lectura del dueño nuevo no deja marca en la bóveda. La escritura de un trabajador que despierta puede caer después de que el dueño nuevo leyó y antes de que escribiera: la bóveda todavía no vio un token más alto en una escritura, así que acepta el viejo, y la escritura del dueño nuevo, calculada a partir de su lectura anterior, lo sobrescribe. Casi siempre el dueño nuevo ya escribió cuando el viejo despierta, así que es raro: " + k1(W.writes.over) + " cada 1000 tareas contra " + k1(W.none.over) + " sin tokens, pero no " + k1(W.all.over) + ". La bóveda tiene que ver el token en cada llamada de la que depende la decisión del dueño, o hacer la escritura condicional a lo que se leyó (el chequeo de versión de la lección 17). Y una bóveda que ignora los tokens no protege nada: la verificación solo funciona en el propio recurso.",
    ),
    watch: { pauses: "long", ttl: "10", check: "off", fence: "writes", crashes: "off", stage: "freeze", extra: 1 },
  },
];

const QUESTIONS = [
  [t("A lock service grants leases and never lets two overlap. How can two workers still write as holders at the same time?", "Un servicio de bloqueo da arrendamientos y nunca deja que dos se superpongan. ¿Cómo pueden igual dos trabajadores escribir como dueños al mismo tiempo?"),
   t("The guarantee holds on the lock service's clock, not in the holder's head. A holder can pause (a GC pause, a VM pause, swapping) or its request can sit in the network; while it's stopped, its renewals stop, the lease runs out and the lock goes to someone else. When it resumes it doesn't know time has passed, so it acts on a lease it no longer has. Nothing failed, and the lock service did exactly what it promised.",
     "La garantía vale según el reloj del servicio de bloqueo, no en la cabeza del dueño. Un dueño puede quedar en pausa (una pausa de GC, una VM pausada, swap) o su solicitud puede quedar demorada en la red; mientras está detenido, sus renovaciones se detienen, el arrendamiento vence y el bloqueo pasa a otro. Cuando sigue, no sabe que pasó el tiempo, así que actúa con un arrendamiento que ya no tiene. Nada falló, y el servicio de bloqueo hizo exactamente lo que prometió.")],
  [t("Why doesn't \"check that I still hold the lease, then write\" fix it?", "¿Por qué \"verificar que sigo teniendo el arrendamiento y después escribir\" no lo arregla?"),
   t("Because checking and the write landing are two moments. A pause, a slow network or a retransmission can fall between them, so the write arrives after the lease is gone, sent by code that checked correctly. Shortening the gap makes it rarer; only a check made by the resource, when it applies the write, closes it.",
     "Porque verificar y que la escritura llegue son dos momentos distintos. Una pausa, una red lenta o una retransmisión pueden caer entre ellos, así que la escritura llega cuando el arrendamiento ya no existe, enviada por código que verificó bien. Acortar el hueco lo vuelve más raro; solo una verificación que haga el recurso, al aplicar la escritura, lo cierra.")],
  [t("How does a fencing token work, and what must the storage do with it?", "¿Cómo funciona un token de cerco (fencing token) y qué tiene que hacer el almacenamiento con él?"),
   t("Each time the lock service grants the lock it hands out a number higher than any before (ZooKeeper's zxid or the znode version can serve; Chubby calls it a sequencer). The holder sends it with every call to the protected resource, and the resource remembers the highest token it has seen and refuses any lower one, so a stale holder's late write is refused however long it paused. The resource must make the check itself, on every operation the holder's decision depends on (the read too, in a read-modify-write). A resource that ignores tokens gets no protection from them.",
     "Cada vez que el servicio de bloqueo da el bloqueo, entrega un número más alto que todos los anteriores (con ZooKeeper sirven el zxid o la versión del znode; Chubby lo llama secuenciador, sequencer). El dueño lo manda en cada llamada al recurso protegido, y el recurso recuerda el token más alto que vio y rechaza cualquiera menor, así que la escritura tardía de un dueño viejo se rechaza por larga que haya sido su pausa. El recurso tiene que hacer la verificación él mismo, en cada operación de la que depende la decisión del dueño (también la lectura, en un leer-modificar-escribir). Un recurso que ignora los tokens no gana ninguna protección con ellos.")],
  [t("How would you choose a lease's TTL?", "¿Cómo elegirías el TTL de un arrendamiento?"),
   t("A short TTL means fast failover when a holder dies, but more expiries on live holders that merely paused; a long one means fewer false expiries, but every crash leaves the lock unusable for up to the TTL. Renew well before it runs out (a third of the TTL is common), so one late renewal doesn't lose the lease. Without fencing, the TTL is a bet that no pause will outlast it, which nothing guarantees; with fencing, it only trades failover time against wasted work.",
     "Un TTL corto significa recuperación rápida cuando un dueño se cae, pero más vencimientos en dueños vivos que solo hicieron una pausa; uno largo significa menos vencimientos falsos, pero cada caída deja el bloqueo inutilizable hasta un TTL completo. Renueva mucho antes de que venza (un tercio del TTL es común), para que una sola renovación tardía no haga perder el arrendamiento. Sin cerco, el TTL es una apuesta a que ninguna pausa dure más, y nada lo garantiza; con cerco, solo equilibra el tiempo de recuperación contra el trabajo desperdiciado.")],
  [t("Your storage already supports a conditional write on a version (compare-and-set). Do you still need fencing tokens?", "Tu almacenamiento ya permite una escritura condicional sobre una versión (compare-and-set). ¿Igual necesitas tokens de cerco?"),
   t("For one record updated by read-modify-write, the conditional write already refuses a write computed from an old read: the version is doing the fencing (lesson 17, Race conditions). Tokens are the general form: they order holders across everything the lock protects (many records, files, calls to other services), and they refuse a stale holder even on a blind write that read nothing first. If the resource supports neither, the lock alone can't make it safe: a lease only makes a double run rare.",
     "Para un solo registro actualizado con leer-modificar-escribir, la escritura condicional ya rechaza una escritura calculada a partir de una lectura vieja: la versión hace de cerco (lección 17, Condiciones de carrera). Los tokens son la forma general: ordenan a los dueños en todo lo que protege el bloqueo (muchos registros, archivos, llamadas a otros servicios) y rechazan a un dueño viejo incluso en una escritura a ciegas que no leyó nada antes. Si el recurso no permite ninguna de las dos cosas, el bloqueo solo no lo vuelve seguro: un arrendamiento solo hace que una doble ejecución sea rara.")],
  [t("When is a lease without fencing good enough, and when isn't it?", "¿Cuándo alcanza con un arrendamiento sin cerco, y cuándo no?"),
   t("Kleppmann splits locks in two. A lock for efficiency (don't do the same work twice, send one reminder email) can live with an occasional double run, so a simple lease, even a single Redis key with an expiry, is fine. A lock for correctness (no lost updates, no two leaders writing) needs a lock service built on consensus, such as ZooKeeper or etcd, and fencing at the resource; he argued that Redlock is unsafe for that because it relies on timing assumptions and produces no fencing token, and Redis's author, Salvatore Sanfilippo, disputed parts of that analysis. A leader elected with a lease has the same problem: lesson 63, Leader Election, covers who becomes leader, and the old leader's writes still need fencing.",
     "Kleppmann divide los bloqueos en dos. Un bloqueo por eficiencia (no hacer dos veces el mismo trabajo, mandar un solo correo de recordatorio) tolera una doble ejecución ocasional, así que alcanza con un arrendamiento simple, incluso una sola clave de Redis con expiración. Un bloqueo por corrección (sin actualizaciones perdidas, sin dos líderes escribiendo) necesita un servicio de bloqueo basado en consenso, como ZooKeeper o etcd, y cerco en el recurso; él sostuvo que Redlock no es seguro para eso porque depende de supuestos de tiempo y no produce un token de cerco, y el autor de Redis, Salvatore Sanfilippo, discutió partes de ese análisis. Un líder elegido con un arrendamiento tiene el mismo problema: la lección 63, Elección de líder, trata quién llega a ser líder, y las escrituras del líder viejo igual necesitan cerco.")],
];

export default defineLesson({
  title: t("Leases & Fencing Tokens Workbench", "Banco de trabajo: arrendamientos y tokens de cerco"),
  eyebrow: t("Systems lesson 62 · Leases & fencing tokens", "Lección de sistemas 62 · Arrendamientos y tokens de cerco"),
  lede: t("A lease is a lock with a timer: if the holder stops renewing it, it runs out and the next worker gets the key, so a crashed holder can't block everyone forever. But a holder that only paused doesn't know its lease ran out, and wakes up writing as if it still held it. This lesson turns it into a key office, a vault and three workers: watch a frozen holder wake up and write, predict what stops it, then explain it back.",
    "Un arrendamiento (lease) es un bloqueo (lock) con temporizador: si el dueño deja de renovarlo, vence y el siguiente trabajador recibe la llave, así que un dueño caído no puede bloquear a todos para siempre. Pero un dueño que solo hizo una pausa no sabe que su arrendamiento venció, y despierta escribiendo como si todavía lo tuviera. Esta lección lo convierte en una oficina de llaves, una bóveda y tres trabajadores: mira cómo un dueño congelado despierta y escribe, predice qué lo detiene y después explícalo."),
  machine: {
    intro: t("Workers A, B and C take turns with the key: read the record at the vault, work on it, write it back, hand the key in. The dial on the key office shows what's left of the lease; the holder renews it as it works. Make the pauses long, freeze the holder as it starts its write, and try the check, a longer TTL and fencing tokens at the vault.",
      "Los trabajadores A, B y C se turnan la llave: leen el registro en la bóveda, trabajan con él, lo vuelven a escribir y devuelven la llave. El dial de la oficina de llaves muestra lo que le queda al arrendamiento; el dueño lo renueva mientras trabaja. Alarga las pausas, congela al dueño al empezar su escritura y prueba la verificación, un TTL más largo y los tokens de cerco en la bóveda."),
    plate: {
      title: t("Key office", "Oficina de llaves"),
      keys: [
        { mark: "lit", label: t("A paused worker and its desk's plate; a key tag or slip whose lease has run out; the vault's lamp when a write overwrites", "Un trabajador en pausa y la placa de su escritorio; una etiqueta o un papel cuyo arrendamiento venció; la lámpara de la bóveda cuando una escritura sobrescribe") },
        { mark: "raised", label: t("Keys and slips carry the token: a key flies to its holder's desk, slips fly to the vault", "Llaves y papeles llevan el token: una llave vuela al escritorio de su dueño, los papeles van a la bóveda") },
        { mark: "flat", label: t("Desks at the front, the key office and the vault at the back", "Escritorios adelante, la oficina de llaves y la bóveda al fondo") },
      ],
      caption: t(
        "Played in real time (change it under Speed). The key office grants a lease of TTL seconds (the dial) with a token one higher than the last (TOKEN). The holder renews it every third of the TTL; a paused worker can't, so its lease can run out and the key move on while the old holder still has its key on the desk (TWO HOLDERS). A job: a read slip to the vault and back, " + WORK_RANGE + " of work, then the write, which takes " + UPLOAD_RANGE + " to send. VERSION goes up with every write the vault takes; OVERWRITES counts writes computed from an older version than the one stored, an update lost. With fencing on, the vault's panel shows the highest token it has seen; slips it refuses drop into REJECTED. Times are illustrative and round, and pauses come far more often than in a healthy system.",
        "Se reproduce en tiempo real (cámbialo en Velocidad). La oficina de llaves da un arrendamiento de TTL segundos (el dial) con un token uno más alto que el anterior (TOKEN). El dueño lo renueva cada tercio del TTL; un trabajador en pausa no puede, así que su arrendamiento puede vencer y la llave pasar a otro mientras el dueño anterior sigue con su llave en el escritorio (DOS DUEÑOS). Una tarea: un papel de lectura a la bóveda y de vuelta, " + WORK_RANGE + " de trabajo y después la escritura, que tarda " + UPLOAD_RANGE + " en enviarse. VERSIÓN sube con cada escritura que acepta la bóveda; SOBRESCRITURAS cuenta las escrituras calculadas a partir de una versión más vieja que la guardada, una actualización perdida. Con el cerco activado, el panel de la bóveda muestra el token más alto que vio; los papeles que rechaza caen en RECHAZADAS. Los tiempos son ilustrativos y redondos, y las pausas ocurren mucho más seguido que en un sistema sano.",
      ),
      stage: { "data-key-office": "" },
      label: t("Leases and fencing tokens simulation. Space pauses or resumes.", "Simulación de arrendamientos y tokens de cerco. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["version", t("Version", "Versión")],
      ["over", t("Overwrites", "Sobrescrituras")],
      ["rejected", t("Rejected", "Rechazadas")],
      ["stopped", t("Stopped by check", "Detenidas al verificar")],
      ["two", t("Two holders", "Dos dueños")],
      ["idle", t("Key idle after crashes", "Llave sin uso tras caídas"), "0 s"],
    ],
    controls: [
      { seg: "pauses", label: t("Pauses", "Pausas"), options: [["none", t("None", "Ninguna")], ["short", t("Short", "Cortas")], ["long", t("Some long", "Algunas largas")]], value: "long" },
      { seg: "ttl", label: "TTL", options: [["3", "3 s"], ["10", "10 s"], ["60", "60 s"]], value: "10" },
      { seg: "check", label: t("Lease check", "Verificar arrendamiento"), options: [["off", t("Off", "No")], ["on", t("Before the write", "Antes de escribir")]], value: "off" },
      { seg: "fence", label: t("Vault checks tokens", "La bóveda verifica tokens"), options: [["off", t("No", "No")], ["writes", t("On writes", "En escrituras")], ["all", t("On every call", "En toda llamada")]], value: "off" },
      { seg: "crashes", label: t("Holder crashes", "Caídas del dueño"), options: [["off", t("Never", "Nunca")], ["on", t("1 job in " + CRASH_EVERY, "1 de cada " + CRASH_EVERY + " tareas")]], value: "off" },
      { speed: true },
      { actions: [["freeze", t("Freeze the holder", "Congelar al dueño"), { primary: true }], ["crash", t("Crash the holder", "Tumbar al dueño")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Freeze the holder pauses it as it starts its next write (right after its check, when the check is on), until its lease has run out and 3 s more. Pauses strike each worker every " + PAUSE_EVERY + " s on average; with Some long, one in " + LONG_EVERY + " lasts " + LONG_RANGE + ".",
      "Cambiar un ajuste reinicia la ejecución. Congelar al dueño lo pausa al empezar su próxima escritura (justo después de verificar, si la verificación está activa), hasta que vence su arrendamiento y 3 s más. Las pausas le llegan a cada trabajador cada " + PAUSE_EVERY + " s en promedio; con Algunas largas, una de cada " + LONG_EVERY + " dura " + LONG_RANGE + "."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of an hour each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de una hora cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Fencing tokens follow Martin Kleppmann's <a href="https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html" target="_blank" rel="noopener">How to do distributed locking</a> (2016).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los tokens de cerco siguen <a href="https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html" target="_blank" rel="noopener">How to do distributed locking</a> de Martin Kleppmann (2016).`),
  css: LIT_FILL_CSS + `
[data-tag-text],[data-slip-text],[data-status]{font-weight:600}
`,
  data: {
    P, G: GEOMETRY, KEY_SVG: keyTagSvg(), SLIP_SVG: slipSvg(),
    STATUS: {
      idle: t("IDLE", "LIBRE"), waits: t("WAITS", "ESPERA"), reads: t("READS", "LEE"), works: t("WORKS", "TRABAJA"),
      writes: t("WRITES", "ESCRIBE"), paused: t("PAUSED", "EN PAUSA"), down: t("DOWN", "CAÍDO"),
    },
  },
});
