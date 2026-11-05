// @ts-nocheck: content in the style of the other lessons
// Systems lesson 66 · Write-Ahead Log: a ledger room with a power switch; a log shelf and a page cabinet on disk.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, slipSvg, P, GEOMETRY } from "./figure";
import { noLogRun, writeRun, groupRun, ckptRun, asyncRun, FSYNC, WORK, THINK, OS_FLUSH, WRITER, PAGE_W, REPLAY, SEEDS, RUN_MS, CRASHES } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const R = { nolog: noLogRun(), write: writeRun(), group: groupRun(), ckpt: ckptRun(), async: asyncRun() };

const int = (x) => Math.round(x).toLocaleString("en");
const ms = (x) => (x < 10 ? x.toFixed(1) : int(x)) + " ms";
const one = (x) => x.toFixed(1);
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const PER_S = 1000 / REPLAY;

// What each card shows after a run.
const RUNS = {
  nolog: () => {
    const { off, on } = R.nolog, m = top(off.lostP, 1);
    return {
      verdict: t("No log: " + int(off.lostP) + " acknowledged commits lost per power cut on average, covering up to the last " + ms(off.maxWinP) + ". Log on, OK after the flush: " + int(on.lostP) + ".",
        "Sin log: " + int(off.lostP) + " commits confirmados perdidos por corte de energía en promedio, de hasta los últimos " + ms(off.maxWinP) + ". Con log y OK tras la escritura a disco: " + int(on.lostP) + "."),
      bars: [[t("No log", "Sin log"), off.lostP / m, int(off.lostP), true], [t("Log, group commit", "Log, commit en grupo"), on.lostP / m, int(on.lostP)]],
    };
  },
  write: () => {
    const { write } = R.write, m = top(write.lostP, 1);
    return {
      verdict: t("OK after write(), before fsync: a process crash lost " + int(write.lostK) + " acknowledged commits; a power cut lost " + int(write.lostP) + " on average, covering up to the last " + ms(write.maxWinP) + ".",
        "OK tras write(), antes de fsync: un proceso matado perdió " + int(write.lostK) + " commits confirmados; un corte de energía perdió " + int(write.lostP) + " en promedio, de hasta los últimos " + ms(write.maxWinP) + "."),
      bars: [[t("Process crash", "Proceso matado"), write.lostK / m, int(write.lostK)], [t("Power cut", "Corte de energía"), write.lostP / m, int(write.lostP), true]],
    };
  },
  group: () => {
    const { each, group, one: lone } = R.group, m = top(group.rate), ml = top(each.p50);
    return {
      verdict: t("16 clients: " + int(each.rate) + " commits/s with one fsync per commit (median OK in " + ms(each.p50) + "), " + int(group.rate) + " with group commit (" + one(group.perFlush) + " commits per flush, median " + ms(group.p50) + "). One client alone: " + ms(lone.p50) + ".",
        "16 clientes: " + int(each.rate) + " commits/s con un fsync por commit (OK mediano en " + ms(each.p50) + "), " + int(group.rate) + " con commit en grupo (" + one(group.perFlush) + " commits por escritura, mediana " + ms(group.p50) + "). Un cliente solo: " + ms(lone.p50) + "."),
      groups: [
        { title: t("Commits per second", "Commits por segundo"), bars: [[t("fsync per commit", "fsync por commit"), each.rate / m, int(each.rate)], [t("Group commit", "Commit en grupo"), group.rate / m, int(group.rate), true]] },
        { title: t("Median commit → OK", "Commit → OK mediano"), bars: [[t("fsync per commit", "fsync por commit"), each.p50 / ml, ms(each.p50)], [t("Group commit", "Commit en grupo"), group.p50 / ml, ms(group.p50), true], [t("One client, group", "Un cliente, en grupo"), lone.p50 / ml, ms(lone.p50)]] },
      ],
    };
  },
  ckpt: () => {
    const { short, long } = R.ckpt, m = top(long.replay), mp = top(short.pagesPer1000);
    return {
      verdict: t("Every 1,000 records: " + int(short.replay) + " records replayed per crash (" + ms(short.replayMs) + "), " + int(short.lostP) + " commits lost. Every 10,000: " + int(long.replay) + " replayed (" + ms(long.replayMs) + "), " + int(long.lostP) + " lost. Page writes per 1,000 commits: " + one(short.pagesPer1000) + " and " + one(long.pagesPer1000) + ".",
        "Cada 1,000 registros: " + int(short.replay) + " registros reproducidos por caída (" + ms(short.replayMs) + "), " + int(short.lostP) + " commits perdidos. Cada 10,000: " + int(long.replay) + " reproducidos (" + ms(long.replayMs) + "), " + int(long.lostP) + " perdidos. Escrituras de página cada 1,000 commits: " + one(short.pagesPer1000) + " y " + one(long.pagesPer1000) + "."),
      groups: [
        { title: t("Records replayed per crash", "Registros reproducidos por caída"), bars: [[t("Every 1,000", "Cada 1,000"), short.replay / m, int(short.replay)], [t("Every 10,000", "Cada 10,000"), long.replay / m, int(long.replay), true]] },
        { title: t("Page writes per 1,000 commits", "Escrituras de página cada 1,000 commits"), bars: [[t("Every 1,000", "Cada 1,000"), short.pagesPer1000 / mp, one(short.pagesPer1000)], [t("Every 10,000", "Cada 10,000"), long.pagesPer1000 / mp, one(long.pagesPer1000), true]] },
      ],
    };
  },
  async: () => {
    const { async: a, group: g } = R.async, mr = top(a.rate, g.rate), ml = top(a.lostP, 1);
    return {
      verdict: t("Asynchronous commit: " + int(a.lostP) + " acknowledged commits lost per power cut on average, never older than " + ms(a.maxWinP) + "; " + int(a.rate) + " commits/s against " + int(g.rate) + " with group commit, which lost " + int(g.lostP) + ".",
        "Commit asíncrono: " + int(a.lostP) + " commits confirmados perdidos por corte de energía en promedio, nunca de hace más de " + ms(a.maxWinP) + "; " + int(a.rate) + " commits/s contra " + int(g.rate) + " con commit en grupo, que perdió " + int(g.lostP) + "."),
      groups: [
        { title: t("Acknowledged commits lost per crash", "Commits confirmados perdidos por caída"), bars: [[t("Asynchronous", "Asíncrono"), a.lostP / ml, int(a.lostP), true], [t("Group commit", "Commit en grupo"), g.lostP / ml, int(g.lostP)]] },
        { title: t("Commits per second", "Commits por segundo"), bars: [[t("Asynchronous", "Asíncrono"), a.rate / mr, int(a.rate), true], [t("Group commit", "Commit en grupo"), g.rate / mr, int(g.rate)]] },
      ],
    };
  },
};

const { nolog: N, write: W, group: G, ckpt: K, async: A } = R;
const WATCH = (o) => ({ log: "on", commit: "group", ckpt: 1000, clients: 4, speed: 0.01, crashes: [], ...o });

const EXPERIMENTS = [
  {
    id: "nolog",
    title: t("No log", "Sin log"),
    change: t("Log off: a commit updates its page in memory and the client gets its OK at once · a checkpoint writes the changed pages to disk every 1,000 commits · then a power cut at a random moment",
      "Log apagado: un commit actualiza su página en memoria y el cliente recibe su OK de inmediato · un checkpoint escribe en disco las páginas cambiadas cada 1,000 commits · luego un corte de energía en un momento al azar"),
    question: t("The database said OK to every one of those commits. After the power cut, which of them are still there?", "La base de datos le dijo OK a cada uno de esos commits. Después del corte de energía, ¿cuáles siguen ahí?"),
    options: [
      t("All of them: each one was acknowledged", "Todos: cada uno fue confirmado"),
      t("Only those whose pages reached disk", "Solo los que tenían su página en disco"),
      t("All but the few that were in flight", "Todos menos los pocos que estaban en vuelo"),
    ],
    answer: 1,
    why: t(
      "Without a log, an acknowledged commit lives only in a page in memory until a checkpoint writes that page out, and a power cut takes memory with it: " + int(N.off.lostP) + " acknowledged commits lost per crash on average, everything since the last page write, up to the last " + ms(N.off.maxWinP) + ". With the log on and the OK sent after the log is flushed, " + int(N.on.lostP) + ". Writing every changed page at each commit would also close the gap, but pages are large random writes, and a commit that changes several pages can be cut halfway through. The log turns that into one small sequential append per commit: once its record is on disk, the change can be redone from it, however late the page itself is written. A store that only takes periodic snapshots, like Redis with RDB and no append-only file, makes this same trade on purpose.",
      "Sin log, un commit confirmado vive solo en una página en memoria hasta que un checkpoint (punto de control) escribe esa página, y un corte de energía se lleva la memoria: " + int(N.off.lostP) + " commits confirmados perdidos por caída en promedio, todo lo posterior a la última escritura de páginas, hasta los últimos " + ms(N.off.maxWinP) + ". Con el log encendido y el OK enviado después de escribir el log a disco, " + int(N.on.lostP) + ". Escribir cada página cambiada en cada commit también cerraría el hueco, pero las páginas son escrituras grandes y aleatorias, y un commit que cambia varias páginas puede quedar cortado a la mitad. El log lo convierte en un agregado pequeño y secuencial por commit: una vez que su registro está en disco, el cambio se puede rehacer desde ahí, por tarde que se escriba la página. Un almacén que solo toma instantáneas periódicas, como Redis con RDB y sin archivo append-only, hace este mismo intercambio a propósito.",
    ),
    watch: WATCH({ log: "off", crashes: [["power", 9]] }),
  },
  {
    id: "write",
    title: t("OK before the fsync", "OK antes del fsync"),
    change: t("Log on · the record is handed to the operating system (write(), no fsync) and the OK goes out at once; the log is flushed to disk once a second, like InnoDB's innodb_flush_log_at_trx_commit = 2 · a process crash (kill -9) vs a power cut, at the same moments",
      "Log encendido · el registro se entrega al sistema operativo (write(), sin fsync) y el OK sale de inmediato; el log se escribe a disco una vez por segundo, como innodb_flush_log_at_trx_commit = 2 en InnoDB · un proceso matado (kill -9) vs un corte de energía, en los mismos momentos"),
    question: t("Which of the two crashes loses acknowledged commits?", "¿Cuál de las dos caídas pierde commits confirmados?"),
    options: [
      t("Both: the log hadn't been flushed yet", "Las dos: el log todavía no se había escrito a disco"),
      t("Only the power cut: the OS still had it", "Solo el corte de energía: el SO todavía lo tenía"),
      t("Neither: write() had put it in the log", "Ninguna: write() ya lo había puesto en el log"),
    ],
    answer: 1,
    why: t(
      "write() copies the record into the operating system's page cache and returns; the kernel writes it to disk later, or when someone calls fsync. If only the database process dies, the kernel keeps running and its cache still reaches disk: " + int(W.write.lostK) + " acknowledged commits lost per crash. If the power goes, the cache goes with it: " + int(W.write.lostP) + " per crash on average, from up to the last " + ms(W.write.maxWinP) + " (the flush runs once a second, and each checkpoint forces one). That is InnoDB's documented trade for setting 2: a crash of mysqld loses nothing, an operating system crash or a power outage can lose about the last second. And a flush is only as good as the disk under it: a drive with a volatile write cache that doesn't honour flushes can still lose it, which is why servers use SSDs with power-loss protection or a battery-backed controller.",
      "write() copia el registro en la caché de páginas del sistema operativo (page cache) y vuelve; el kernel lo escribe a disco más tarde, o cuando alguien llama a fsync. Si solo muere el proceso de la base de datos, el kernel sigue corriendo y su caché igual llega al disco: " + int(W.write.lostK) + " commits confirmados perdidos por caída. Si se va la energía, la caché se va con ella: " + int(W.write.lostP) + " por caída en promedio, de hasta los últimos " + ms(W.write.maxWinP) + " (la escritura a disco corre una vez por segundo, y cada checkpoint fuerza una). Es el intercambio documentado de InnoDB para el valor 2: una caída de mysqld no pierde nada, una caída del sistema operativo o un corte de energía puede perder más o menos el último segundo. Y una escritura a disco vale lo que vale el disco: una unidad con caché de escritura volátil que no respeta los flush todavía puede perderla, por eso los servidores usan SSD con protección contra pérdida de energía o una controladora con batería.",
    ),
    watch: WATCH({ commit: "write", crashes: [["process", 7], ["power", 8]] }),
  },
  {
    id: "group",
    title: t("Sixteen clients", "Dieciséis clientes"),
    change: t("16 clients · the OK waits until the log is flushed (fsync, " + FSYNC + " ms) · one fsync per commit, one after another, vs group commit: one fsync carries every commit waiting when it starts",
      "16 clientes · el OK espera a que el log se escriba a disco (fsync, " + FSYNC + " ms) · un fsync por commit, uno tras otro, vs commit en grupo (group commit): un fsync lleva todos los commits que esperan cuando empieza"),
    question: t("With group commit, what happens to the commits per second?", "Con commit en grupo, ¿qué pasa con los commits por segundo?"),
    options: [
      t("About the same: the disk flushes one at a time", "Casi lo mismo: el disco hace una escritura a la vez"),
      t("Several times more: one flush carries many", "Varias veces más: una escritura lleva muchos"),
      t("More, but each commit waits far longer", "Más, pero cada commit espera mucho más"),
    ],
    answer: 1,
    why: t(
      "A flush costs about the same whether it carries one record or ten, so a log that flushes once per commit is capped by the disk's flush rate: " + int(G.each.rate) + " commits a second, and each of the 16 clients queued behind the others for a median of " + ms(G.each.p50) + " to its OK. With group commit, a commit that arrives during a flush waits for the next one, which takes everything waiting: " + one(G.group.perFlush) + " commits per flush, " + int(G.group.rate) + " commits a second, and a median of " + ms(G.group.p50) + ". The cost is the wait for the flush already under way: a client alone gets its OK in " + ms(G.one.p50) + ", one flush. PostgreSQL, InnoDB and most databases with a log do this on their own; PostgreSQL's commit_delay can even hold a flush back a little to gather more commits.",
      "Una escritura a disco cuesta casi lo mismo si lleva un registro o diez, así que un log que escribe una vez por commit queda limitado por las escrituras por segundo del disco: " + int(G.each.rate) + " commits por segundo, y cada uno de los 16 clientes hizo fila detrás de los demás una mediana de " + ms(G.each.p50) + " hasta su OK. Con commit en grupo, un commit que llega durante una escritura espera a la siguiente, que lleva todo lo que espera: " + one(G.group.perFlush) + " commits por escritura, " + int(G.group.rate) + " commits por segundo y una mediana de " + ms(G.group.p50) + ". El costo es esperar la escritura que ya está en curso: un cliente solo recibe su OK en " + ms(G.one.p50) + ", una escritura. PostgreSQL, InnoDB y la mayoría de las bases de datos con log lo hacen por su cuenta; commit_delay en PostgreSQL incluso puede retrasar un poco una escritura para juntar más commits.",
    ),
    watch: WATCH({ clients: 16 }),
  },
  {
    id: "ckpt",
    title: t("Checkpoints further apart", "Checkpoints más espaciados"),
    change: t("Log on, group commit · a checkpoint every 1,000 log records vs every 10,000 · a power cut at a random moment",
      "Log encendido, commit en grupo · un checkpoint cada 1,000 registros del log vs cada 10,000 · un corte de energía en un momento al azar"),
    question: t("Checkpoints ten times further apart. What changes after the crash?", "Checkpoints diez veces más espaciados. ¿Qué cambia después de la caída?"),
    options: [
      t("Recovery takes longer; no more commits are lost", "La recuperación tarda más; no se pierden más commits"),
      t("More commits are lost: pages sit in memory longer", "Se pierden más commits: las páginas pasan más tiempo en memoria"),
      t("Nothing: recovery only redoes commits in flight", "Nada: la recuperación solo rehace commits en vuelo"),
    ],
    answer: 0,
    why: t(
      "Dirty pages in memory aren't at risk: every change in them is already in the log on disk. What a checkpoint buys is a shorter log to replay. Recovery starts at the redo point of the last complete checkpoint and replays every record after it: " + int(K.short.replay) + " records per crash on average with a checkpoint every 1,000 (" + ms(K.short.replayMs) + " here), " + int(K.long.replay) + " with one every 10,000 (" + ms(K.long.replayMs) + "); lost commits, " + int(K.short.lostP) + " and " + int(K.long.lostP) + ". The other side of the trade: each checkpoint writes every page that changed since the last one, however many times it changed, so frequent checkpoints write more: " + one(K.short.pagesPer1000) + " page writes per 1,000 commits against " + one(K.long.pagesPer1000) + ", and " + one(K.tiny.pagesPer1000) + " with one every 100 records. PostgreSQL also logs a full copy of each page the first time it changes after a checkpoint (full_page_writes), so frequent checkpoints grow the log too. Its defaults, checkpoint_timeout = 5 min and max_wal_size = 1 GB, put crash recovery in seconds to minutes; the replay rate here, " + int(PER_S) + " records a second, is illustrative.",
      "Las páginas sucias (dirty pages) en memoria no están en riesgo: cada cambio que tienen ya está en el log en disco. Lo que compra un checkpoint es un log más corto que reproducir. La recuperación empieza en el punto de rehacer (redo point) del último checkpoint completo y reproduce cada registro posterior: " + int(K.short.replay) + " registros por caída en promedio con un checkpoint cada 1,000 (" + ms(K.short.replayMs) + " aquí), " + int(K.long.replay) + " con uno cada 10,000 (" + ms(K.long.replayMs) + "); commits perdidos, " + int(K.short.lostP) + " y " + int(K.long.lostP) + ". El otro lado del intercambio: cada checkpoint escribe cada página que cambió desde el anterior, sin importar cuántas veces cambió, así que los checkpoints frecuentes escriben más: " + one(K.short.pagesPer1000) + " escrituras de página cada 1,000 commits contra " + one(K.long.pagesPer1000) + ", y " + one(K.tiny.pagesPer1000) + " con uno cada 100 registros. PostgreSQL además guarda en el log una copia completa de cada página la primera vez que cambia después de un checkpoint (full_page_writes), así que los checkpoints frecuentes también agrandan el log. Sus valores por defecto, checkpoint_timeout = 5 min y max_wal_size = 1 GB, dejan la recuperación tras una caída en segundos o minutos; la velocidad de reproducción de aquí, " + int(PER_S) + " registros por segundo, es ilustrativa.",
    ),
    watch: WATCH({ ckpt: 100, speed: 0.04, crashes: [["power", 12]] }),
  },
  {
    id: "async",
    title: t("Asynchronous commit", "Commit asíncrono"),
    change: t("Log on · 4 clients · the OK goes out before the log is written; a log writer writes and flushes it every " + WRITER + " ms (PostgreSQL's synchronous_commit = off) vs group commit · a power cut at a random moment",
      "Log encendido · 4 clientes · el OK sale antes de escribir el log; un escritor del log lo escribe a disco cada " + WRITER + " ms (synchronous_commit = off en PostgreSQL) vs commit en grupo · un corte de energía en un momento al azar"),
    question: t("With asynchronous commit, what does a power cut cost?", "Con commit asíncrono, ¿qué cuesta un corte de energía?"),
    options: [
      t("Every commit since the last checkpoint", "Cada commit desde el último checkpoint"),
      t("The last moments of commits; the rest is intact", "Los commits de los últimos instantes; el resto queda intacto"),
      t("Recent commits, and tables may come back corrupt", "Commits recientes, y las tablas pueden volver corruptas"),
    ],
    answer: 1,
    why: t(
      "The log still reaches disk in order, only later. A crash loses the commits acknowledged since the last flush: " + int(A.async.lostP) + " per power cut on average, none older than " + ms(A.async.maxWinP) + " (a process crash loses them too, since they wait in the database's own memory). Everything before replays to a consistent state: the log is replayed in commit order, so a later commit can't survive while an earlier one it built on is lost. In exchange the OK doesn't wait for a flush: " + int(A.async.rate) + " commits a second against " + int(A.group.rate) + " with group commit, same 4 clients. PostgreSQL bounds the window at three times wal_writer_delay (200 ms by default) and lets you choose per transaction: SET LOCAL synchronous_commit = off for a page-view counter, on for a payment. That's not fsync = off, which skips every flush, pages included, and after a power cut can leave a database that recovery can't repair.",
      "El log igual llega a disco en orden, solo que más tarde. Una caída pierde los commits confirmados desde la última escritura a disco: " + int(A.async.lostP) + " por corte de energía en promedio, ninguno de hace más de " + ms(A.async.maxWinP) + " (un proceso matado también los pierde, porque esperan en la memoria de la propia base de datos). Todo lo anterior se reproduce hasta un estado consistente: el log se reproduce en orden de commit, así que un commit posterior no puede sobrevivir si se pierde uno anterior del que dependía. A cambio, el OK no espera una escritura a disco: " + int(A.async.rate) + " commits por segundo contra " + int(A.group.rate) + " con commit en grupo, con los mismos 4 clientes. PostgreSQL acota la ventana a tres veces wal_writer_delay (200 ms por defecto) y deja elegir por transacción: SET LOCAL synchronous_commit = off para un contador de visitas, on para un pago. No es lo mismo que fsync = off, que se salta todas las escrituras a disco, páginas incluidas, y tras un corte de energía puede dejar una base de datos que la recuperación no puede reparar.",
    ),
    watch: WATCH({ commit: "async", crashes: [["power", 12]] }),
  },
];

const QUESTIONS = [
  [t("In one or two sentences, what is the write-ahead rule, and why does it make an acknowledged commit survive a crash?", "En una o dos oraciones, ¿qué es la regla de escritura anticipada (write-ahead) y por qué hace que un commit confirmado sobreviva a una caída?"),
   t("A change's log record must be on disk before the page it changed is, and the commit is acknowledged only once its records are on disk. After any crash the log holds every acknowledged change, so recovery can redo whatever the pages on disk are missing; the pages themselves can be written late, in any order.",
     "El registro de un cambio tiene que estar en disco antes que la página que cambió, y el commit se confirma solo cuando sus registros están en disco. Tras cualquier caída el log tiene cada cambio confirmado, así que la recuperación puede rehacer lo que les falte a las páginas en disco; las páginas mismas se pueden escribir tarde y en cualquier orden.")],
  [t("Why is appending to a log and flushing it cheaper than writing the changed pages at commit?", "¿Por qué agregar al log y escribirlo a disco es más barato que escribir las páginas cambiadas en el commit?"),
   t("A commit's records are small and go at the end of one file, so the flush is one sequential write; the pages it touched are whole blocks (8 KB in PostgreSQL, 16 KB in InnoDB) scattered across the data files. One flush can carry many commits (group commit), while a hot page changed a thousand times is written once per checkpoint. And a transaction that changes several pages would need all of them written atomically; with the log, one record on disk is enough to redo them all.",
     "Los registros de un commit son pequeños y van al final de un solo archivo, así que la escritura a disco es una escritura secuencial; las páginas que tocó son bloques enteros (8 KB en PostgreSQL, 16 KB en InnoDB) repartidos por los archivos de datos. Una escritura puede llevar muchos commits (commit en grupo), mientras que una página caliente que cambió mil veces se escribe una vez por checkpoint. Y una transacción que cambia varias páginas necesitaría escribirlas todas de forma atómica; con el log, basta un registro en disco para rehacerlas todas.")],
  [t("Your service gets an OK from the database, and then the machine loses power. Which settings decide whether that write survives?", "Tu servicio recibe un OK de la base de datos y luego la máquina se queda sin energía. ¿Qué ajustes deciden si esa escritura sobrevive?"),
   t("Whether the commit waits for a flush: synchronous_commit in PostgreSQL (and never fsync = off), innodb_flush_log_at_trx_commit, and sync_binlog for the binary log, in MySQL, appendfsync in Redis. Whether the flush is real: the drive's write cache and power-loss protection, and storage layers (some virtual disks, some network file systems) that acknowledge before data is durable. And if the whole machine can be lost, whether the commit also waits for a replica: synchronous replication in PostgreSQL, or acks = all with min.insync.replicas in Kafka. Asynchronous replicas can be behind (lesson 60, Replication Lag).",
     "Si el commit espera una escritura a disco: synchronous_commit en PostgreSQL (y nunca fsync = off), innodb_flush_log_at_trx_commit y sync_binlog para el log binario en MySQL, appendfsync en Redis. Si la escritura es real: la caché de escritura de la unidad y su protección contra pérdida de energía, y capas de almacenamiento (algunos discos virtuales, algunos sistemas de archivos en red) que confirman antes de que el dato sea durable. Y si se puede perder la máquina entera, si el commit también espera a una réplica: replicación síncrona en PostgreSQL, o acks = all con min.insync.replicas en Kafka. Las réplicas asíncronas pueden ir atrasadas (lección 60, Retraso de réplica).")],
  [t("With the same settings, a process crash loses no acknowledged commits and a power cut does. How can that be?", "Con los mismos ajustes, un proceso que se cae no pierde commits confirmados y un corte de energía sí. ¿Cómo puede ser?"),
   t("The commit was acknowledged after write() and before fsync: its record sits in the operating system's page cache, not on disk. The page cache belongs to the kernel, so it outlives the database process and is written out later; a power cut or a kernel panic takes it away. The reverse is true for asynchronous commit: the records wait in the database's own memory, so a process crash loses them as well.",
     "El commit se confirmó después de write() y antes de fsync: su registro está en la caché de páginas del sistema operativo, no en disco. Esa caché es del kernel, así que sobrevive al proceso de la base de datos y se escribe después; un corte de energía o un kernel panic se la llevan. Con commit asíncrono pasa lo contrario: los registros esperan en la memoria de la propia base de datos, así que un proceso que se cae también los pierde.")],
  [t("What does a checkpoint do, and what are you trading when you make checkpoints more or less frequent?", "¿Qué hace un checkpoint y qué intercambias al hacerlos más o menos frecuentes?"),
   t("It notes a redo point in the log, makes sure the log is on disk up to there, writes every page that changed since the last checkpoint, and then records that it's complete; recovery can start at that redo point and the older log can be recycled. Frequent checkpoints mean less log to replay and less log to keep, but more page writes (a hot page is written again every checkpoint) and, in PostgreSQL, more full-page images in the log. Rare ones write less but make recovery and the log on disk longer. Most databases also spread a checkpoint's writes over time, so they don't stall commits.",
     "Anota un punto de rehacer en el log, se asegura de que el log esté en disco hasta ahí, escribe cada página que cambió desde el último checkpoint y luego registra que terminó; la recuperación puede empezar en ese punto y el log anterior se puede reciclar. Checkpoints frecuentes significan menos log que reproducir y que guardar, pero más escrituras de página (una página caliente se vuelve a escribir en cada checkpoint) y, en PostgreSQL, más imágenes de página completa en el log. Los espaciados escriben menos pero alargan la recuperación y el log en disco. La mayoría de las bases de datos además reparten las escrituras de un checkpoint en el tiempo, para no frenar los commits.")],
  [t("Where else do you meet the same idea, a log written first and state rebuilt from it?", "¿Dónde más te encuentras la misma idea, un log que se escribe primero y un estado que se reconstruye desde él?"),
   t("An LSM tree writes each change to a write-ahead log and to a memtable in memory, and replays the log into the memtable after a crash (RocksDB, Cassandra's commit log; lesson 67, LSM Tree vs B-Tree). In Kafka the log is the data itself (lesson 20, Kafka Log); it relies on replication rather than an fsync per message for durability. Replication ships the log: PostgreSQL's streaming replicas replay the same WAL, and change data capture tools like Debezium read it to publish events, the relay side of lesson 24, Outbox. File systems journal their metadata the same way.",
     "Un árbol LSM escribe cada cambio en un log de escritura anticipada y en una memtable en memoria, y tras una caída reproduce el log en la memtable (RocksDB, el commit log de Cassandra; lección 67, Árbol LSM vs árbol B). En Kafka el log es el dato mismo (lección 20, Log de Kafka); para la durabilidad se apoya en la replicación más que en un fsync por mensaje. La replicación envía el log: las réplicas por streaming de PostgreSQL reproducen el mismo WAL, y herramientas de captura de cambios (change data capture) como Debezium lo leen para publicar eventos, el lado del reenviador (relay) de la lección 24, Outbox. Los sistemas de archivos registran sus metadatos en un journal de la misma forma.")],
];

export default defineLesson({
  title: t("Write-Ahead Log Workbench", "Banco de trabajo: registro de escritura anticipada"),
  eyebrow: t("Systems lesson 66 · Write-Ahead Log", "Lección de sistemas 66 · Registro de escritura anticipada"),
  lede: t("When PostgreSQL or InnoDB says a commit is done, with default settings it means the commit's record is on disk in the write-ahead log; the pages themselves are written later, and after a crash the log is replayed to rebuild them. Acknowledge before that record is flushed, or keep no log, and a confirmed write can vanish. This lesson turns it into a ledger room with a power switch: watch it, predict what breaks it, then explain it back.",
    "Cuando PostgreSQL o InnoDB dicen que un commit está hecho, con los ajustes por defecto quiere decir que el registro del commit está en disco, en el registro de escritura anticipada (write-ahead log, WAL); las páginas se escriben después, y tras una caída se reproduce el log para reconstruirlas. Confirma antes de que ese registro esté en disco, o no tengas log, y una escritura confirmada puede desaparecer. Esta lección lo convierte en una sala de libros contables con un interruptor de energía: míralo, predice qué lo rompe y después explícalo."),
  machine: {
    intro: t("Clients commit at the desk: each commit updates a page card in memory and drops a record in the LOG BUFFER. Depending on the commit setting, the record goes through the OS CACHE to the LOG ON DISK before or after the client gets its OK; a lit sheet holds commits that were acknowledged but aren't on disk yet. Checkpoints pull out the drawers to write the pages. Pull POWER or press KILL at any moment, and watch what recovery brings back.",
      "Los clientes hacen commit en el escritorio: cada commit actualiza una tarjeta de página en memoria y deja un registro en el BÚFER DEL LOG. Según el ajuste de commit, el registro pasa por la CACHÉ DEL SO hasta el LOG EN DISCO antes o después de que el cliente reciba su OK; una hoja encendida tiene commits ya confirmados que todavía no están en disco. Los checkpoints abren los cajones para escribir las páginas. Baja la palanca de ENERGÍA o aprieta MATAR en cualquier momento y mira qué trae de vuelta la recuperación."),
    plate: {
      title: t("Ledger room", "Sala de libros"),
      keys: [
        { mark: "lit", label: t("Acknowledged, not on disk yet: a sheet in a tray, a page card with no log; in recovery, the clerk and the book he replays", "Confirmado y todavía no en disco: una hoja en una bandeja, una tarjeta de página sin log; en la recuperación, el empleado y el libro que reproduce") },
        { mark: "raised", label: t("Books: log records on disk since the checkpoint's redo point (the pennant); sheets: records in memory or in the OS cache", "Libros: registros del log en disco desde el punto de rehacer del checkpoint (el banderín); hojas: registros en memoria o en la caché del SO") },
        { mark: "flat", label: t("Drawers: the pages on disk, pulled out while a checkpoint writes them", "Cajones: las páginas en disco, abiertos mientras un checkpoint las escribe") },
      ],
      caption: t(
        "Played 100 times slower than real time (change it under Speed). Times are illustrative and round: a transaction works " + WORK + " ms before it commits, a client pauses " + THINK + " ms on average between transactions, a flush to disk (fsync) takes " + FSYNC + " ms, writing a page at a checkpoint " + PAGE_W + " ms, and recovery replays " + int(PER_S) + " records a second. Write, no fsync: the log is flushed once a second. Async: the log writer runs every " + WRITER + " ms. A pennant on a page card: the page is newer in memory than on disk. Each book stands for a twentieth of the checkpoint interval. Counters: commits the clients got an OK for (ACKED), how many of them are ON DISK and would survive a power cut, and acknowledged commits LOST in the last crash.",
        "Se reproduce 100 veces más lento que el tiempo real (cámbialo en Velocidad). Los tiempos son ilustrativos y redondos: una transacción trabaja " + WORK + " ms antes del commit, un cliente hace una pausa de " + THINK + " ms en promedio entre transacciones, una escritura a disco (fsync) tarda " + FSYNC + " ms, escribir una página en un checkpoint " + PAGE_W + " ms, y la recuperación reproduce " + int(PER_S) + " registros por segundo. Write, sin fsync: el log se escribe a disco una vez por segundo. Asíncrono: el escritor del log corre cada " + WRITER + " ms. Un banderín en una tarjeta de página: la página es más nueva en memoria que en disco. Cada libro representa la vigésima parte del intervalo entre checkpoints. Contadores: commits por los que los clientes recibieron un OK (CONFIRMADOS), cuántos de ellos están EN DISCO y sobrevivirían a un corte de energía, y commits confirmados PERDIDOS en la última caída.",
      ),
      stage: { "data-ledger-room": "" },
      label: t("Write-ahead log simulation. Space pauses or resumes.", "Simulación de un registro de escritura anticipada. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["acked", t("Acknowledged", "Confirmados")],
      ["risk", t("Not on disk yet", "Aún no en disco")],
      ["rate", t("Commits/s", "Commits/s"), "–"],
      ["lat", t("Commit → OK", "Commit → OK"), "–"],
      ["flush", t("Commits per fsync", "Commits por fsync"), "–"],
      ["lost", t("Lost in last crash", "Perdidos en la última caída"), "0"],
    ],
    controls: [
      { seg: "log", label: t("Log", "Log"), options: [["on", t("On", "Encendido")], ["off", t("Off", "Apagado")]], value: "on" },
      { seg: "commit", label: t("OK after", "OK tras"), options: [["each", t("fsync, one each", "fsync, uno a uno")], ["group", t("Group commit", "Commit en grupo")], ["write", t("write, no fsync", "write, sin fsync")], ["async", t("Nothing (async)", "Nada (asíncrono)")]], value: "group" },
      { seg: "ckpt", label: t("Checkpoint every", "Checkpoint cada"), options: [[100, t("100 records", "100 registros")], [1000, "1,000"], [10000, "10,000"]], value: 1000 },
      { seg: "clients", label: t("Clients", "Clientes"), options: [[1, "1"], [4, "4"], [16, "16"]], value: 4 },
      { speed: true, options: [[0.0025, "1/400"], [0.01, "1/100"], [0.04, "1/25"]], value: 0.01 },
      { actions: [["power", t("Cut the power", "Cortar la energía"), { primary: true }], ["kill", t("Kill the process", "Matar el proceso")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. With the log off, OK after has no effect: the OK goes out once the page in memory is updated. Not on disk yet counts acknowledged commits a power cut would lose right now.",
      "Cambiar un ajuste reinicia la ejecución. Con el log apagado, OK tras no tiene efecto: el OK sale apenas se actualiza la página en memoria. Aún no en disco cuenta los commits confirmados que un corte de energía perdería ahora mismo."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs of " + RUN_MS / 1000 + " seconds of traffic each, with " + CRASHES + " crashes at random moments per run.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija de " + RUN_MS / 1000 + " segundos de tráfico cada una, con " + CRASHES + " caídas en momentos al azar por ejecución."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Commit settings follow the PostgreSQL documentation (WAL, asynchronous commit, checkpoints) and the MySQL InnoDB documentation; the write-ahead rule and redo from a checkpoint follow ARIES (Mohan et al., 1992).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los ajustes de commit siguen la documentación de PostgreSQL (WAL, commit asíncrono, checkpoints) y la de InnoDB en MySQL; la regla de escritura anticipada y el rehacer desde un checkpoint siguen ARIES (Mohan et al., 1992).`),
  css: LIT_FILL_CSS,
  data: { P, G: GEOMETRY, SLIP_SVG: slipSvg() },
});
