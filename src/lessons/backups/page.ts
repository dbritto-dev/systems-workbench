// @ts-nocheck: content in the style of the other lessons
// Systems lesson 84 · Backup and restore: a backup room with a log archive, a shelf of snapshots and a restore station.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, flyerSvg, P, GEOMETRY } from "./figure";
import {
  deleteRun, intervalRun, noArchiveRun, seedRun, gapRun, storageGB, dur,
  DAY, RATE, BACKUP, COPY, REPLAY_X, DB_GB, LOG_GB_DAY, KEEP_DAYS, LEADER_MBPS, NOTICE, DRILL, SEEDS, SAMPLES,
} from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const R = { del: deleteRun(), interval: intervalRun(), noarch: noArchiveRun(), seed: seedRun(), gap: gapRun() };

const int = (x) => Math.round(x).toLocaleString("en");
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const tb = (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " TB";
const gbOrMb = (gb) => (gb >= 1 ? int(gb) + " GB" : int(gb * 1024) + " MB");
const SCHED = [["hourly", t("Hourly", "Cada hora")], ["six", t("Every 6 h", "Cada 6 h")], ["daily", t("Daily", "Diaria")]];

// What each card shows after a run.
const RUNS = {
  del: () => {
    const d = R.del, mm = top(d.snapMissing);
    return {
      verdict: t("Promoting the replica: " + pct(d.repRows) + " of the deleted orders back. The last snapshot alone: " + pct(d.snapRows) + ", with " + int(d.snapMissing) + " good writes from before 14:05 missing. The snapshot plus the log replayed to 14:04:59: " + pct(d.pitrRows) + ", " + int(d.pitrMissing) + " missing, in " + dur(d.pitrMin) + ".",
        "Promover la réplica: el " + pct(d.repRows) + " de los pedidos borrados de vuelta. Solo la última instantánea: el " + pct(d.snapRows) + ", con " + int(d.snapMissing) + " escrituras buenas de antes de las 14:05 faltantes. La instantánea más el log reproducido hasta las 14:04:59: el " + pct(d.pitrRows) + ", " + int(d.pitrMissing) + " faltantes, en " + dur(d.pitrMin) + "."),
      groups: [
        { title: t("Deleted orders back", "Pedidos borrados de vuelta"), bars: [[t("Promote the replica", "Promover la réplica"), d.repRows, pct(d.repRows), true], [t("Last snapshot only", "Solo la última instantánea"), d.snapRows, pct(d.snapRows)], [t("Snapshot + log to 14:04:59", "Instantánea + log hasta 14:04:59"), d.pitrRows, pct(d.pitrRows)]] },
        { title: t("Good writes before 14:05 missing", "Escrituras buenas de antes de las 14:05 faltantes"), bars: [[t("Promote the replica", "Promover la réplica"), d.repMissing / mm, int(d.repMissing)], [t("Last snapshot only", "Solo la última instantánea"), d.snapMissing / mm, int(d.snapMissing), true], [t("Snapshot + log to 14:04:59", "Instantánea + log hasta 14:04:59"), d.pitrMissing / mm, int(d.pitrMissing)]] },
      ],
    };
  },
  interval: () => {
    const r = R.interval, ml = top(...SCHED.map(([k]) => r[k].lostMin), 5), mt = top(...SCHED.map(([k]) => r[k].total)), ms = top(...SCHED.map(([k]) => r[k].tb));
    return {
      verdict: t("Data lost: " + dur(r.hourly.lostMin) + ", " + dur(r.six.lostMin) + " and " + dur(r.daily.lostMin) + " on average with hourly, 6-hourly and daily snapshots. Restore time: " + dur(r.hourly.total) + ", " + dur(r.six.total) + " and " + dur(r.daily.total) + " (up to " + dur(r.daily.maxTotal) + " daily). Storage for 7 days: " + tb(r.hourly.tb) + ", " + tb(r.six.tb) + " and " + tb(r.daily.tb) + ".",
        "Datos perdidos: " + dur(r.hourly.lostMin) + ", " + dur(r.six.lostMin) + " y " + dur(r.daily.lostMin) + " en promedio con instantáneas cada hora, cada 6 h y diarias. Tiempo de restauración: " + dur(r.hourly.total) + ", " + dur(r.six.total) + " y " + dur(r.daily.total) + " (hasta " + dur(r.daily.maxTotal) + " la diaria). Almacenamiento para 7 días: " + tb(r.hourly.tb) + ", " + tb(r.six.tb) + " y " + tb(r.daily.tb) + "."),
      groups: [
        { title: t("Data lost, average (scale: 5 min)", "Datos perdidos, promedio (escala: 5 min)"), bars: SCHED.map(([k, l], i) => [l, r[k].lostMin / ml, dur(r[k].lostMin), i === 2]) },
        { title: t("Restore time, average", "Tiempo de restauración, promedio"), bars: SCHED.map(([k, l], i) => [l, r[k].total / mt, dur(r[k].total), i === 2]) },
        { title: t("Backup storage, 7 days", "Almacenamiento de respaldos, 7 días"), bars: SCHED.map(([k, l], i) => [l, r[k].tb / ms, tb(r[k].tb), i === 0]) },
      ],
    };
  },
  noarch: () => {
    const r = R.noarch, ml = top(...SCHED.map(([k]) => r[k].lostMin)), mt = top(...SCHED.map(([k]) => r[k].total), 60);
    return {
      verdict: t("Without the archive, data lost: " + dur(r.hourly.lostMin) + ", " + dur(r.six.lostMin) + " and " + dur(r.daily.lostMin) + " on average (up to " + dur(r.daily.maxLostMin) + " daily). Restore time: " + dur(r.hourly.total) + ", " + dur(r.six.total) + " and " + dur(r.daily.total) + ".",
        "Sin el archivo, datos perdidos: " + dur(r.hourly.lostMin) + ", " + dur(r.six.lostMin) + " y " + dur(r.daily.lostMin) + " en promedio (hasta " + dur(r.daily.maxLostMin) + " la diaria). Tiempo de restauración: " + dur(r.hourly.total) + ", " + dur(r.six.total) + " y " + dur(r.daily.total) + "."),
      groups: [
        { title: t("Data lost, average", "Datos perdidos, promedio"), bars: SCHED.map(([k, l], i) => [l, r[k].lostMin / ml, dur(r[k].lostMin), i === 2]) },
        { title: t("Restore time, average (scale: 1 h)", "Tiempo de restauración, promedio (escala: 1 h)"), bars: SCHED.map(([k, l], i) => [l, r[k].total / mt, dur(r[k].total)]) },
      ],
    };
  },
  seed: () => {
    const { six } = R.seed, mg = top(six.leaderGB), mt = top(six.leaderMin, six.shelfMin);
    return {
      verdict: t("From the leader: " + gbOrMb(six.leaderGB) + " read from it, ready in " + dur(six.leaderMin) + " on average. From the shelf: " + gbOrMb(six.shelfGB) + " from the leader, ready in " + dur(six.shelfMin) + " (up to " + dur(six.shelfMax) + ").",
        "Desde el líder: " + gbOrMb(six.leaderGB) + " leídos de él, lista en " + dur(six.leaderMin) + " en promedio. Desde el estante: " + gbOrMb(six.shelfGB) + " del líder, lista en " + dur(six.shelfMin) + " (hasta " + dur(six.shelfMax) + ")."),
      groups: [
        { title: t("Read from the leader", "Leído del líder"), bars: [[t("Copy from the leader", "Copiar del líder"), six.leaderGB / mg, gbOrMb(six.leaderGB)], [t("Restore from the shelf", "Restaurar del estante"), six.shelfGB / mg, gbOrMb(six.shelfGB), true]] },
        { title: t("Time until the replica is ready", "Tiempo hasta que la réplica está lista"), bars: [[t("Copy from the leader", "Copiar del líder"), six.leaderMin / mt, dur(six.leaderMin)], [t("Restore from the shelf", "Restaurar del estante"), six.shelfMin / mt, dur(six.shelfMin), true]] },
      ],
    };
  },
  gap: () => {
    const { none, drill, whole } = R.gap, ml = top(none.lost);
    return {
      verdict: t("Complete archive: " + dur(whole.lostMin) + " lost on average. One segment missing, no drill: " + dur(none.lost) + " (up to " + dur(none.maxLost) + "), with " + pct(none.stopped) + " of restores stopped at the gap. With a drill every 6 h: " + dur(drill.lost) + ", " + pct(drill.stopped) + " stopped at the gap.",
        "Archivo completo: " + dur(whole.lostMin) + " perdidos en promedio. Falta un segmento, sin simulacro: " + dur(none.lost) + " (hasta " + dur(none.maxLost) + "), con el " + pct(none.stopped) + " de las restauraciones detenidas en el hueco. Con un simulacro cada 6 h: " + dur(drill.lost) + ", el " + pct(drill.stopped) + " detenidas en el hueco."),
      groups: [
        { title: t("Data lost, average", "Datos perdidos, promedio"), bars: [[t("Complete archive", "Archivo completo"), whole.lostMin / ml, dur(whole.lostMin)], [t("Gap, no drill", "Hueco, sin simulacro"), none.lost / ml, dur(none.lost), true], [t("Gap, drill every 6 h", "Hueco, simulacro cada 6 h"), drill.lost / ml, dur(drill.lost)]] },
        { title: t("Restores stopped at the gap", "Restauraciones detenidas en el hueco"), bars: [[t("Gap, no drill", "Hueco, sin simulacro"), none.stopped, pct(none.stopped), true], [t("Gap, drill every 6 h", "Hueco, simulacro cada 6 h"), drill.stopped, pct(drill.stopped)]] },
      ],
    };
  },
};

const { del: D, interval: I, noarch: N, seed: SD, gap: G } = R;
const HOUR_REPLAY = Math.round(60 / REPLAY_X);
const DAILY = storageGB(DAY), HOURLY = storageGB(60);

const EXPERIMENTS = [
  {
    id: "del",
    title: t("A bad DELETE at 14:05", "Un DELETE malo a las 14:05"),
    change: t("Nightly snapshot at 00:00, log archived · at 14:05 a DELETE removes every order, and someone notices at 14:15 · promote the replica vs restore the last snapshot vs restore the snapshot plus the log replayed to 14:04:59",
      "Instantánea nocturna a las 00:00, log archivado · a las 14:05 un DELETE borra todos los pedidos, y alguien lo nota a las 14:15 · promover la réplica vs restaurar la última instantánea vs restaurar la instantánea más el log reproducido hasta las 14:04:59"),
    question: t("The replica is a second copy on another machine. Promoted at 14:15, how many of the deleted orders does it bring back?",
      "La réplica es una segunda copia en otra máquina. Promovida a las 14:15, ¿cuántos de los pedidos borrados trae de vuelta?"),
    options: [
      t("All of them: it is a separate copy", "Todos: es una copia aparte"),
      t("None: it applied the DELETE seconds later", "Ninguno: aplicó el DELETE segundos después"),
      t("Most: it trails the leader by a few minutes", "Casi todos: va unos minutos detrás del líder"),
    ],
    answer: 1,
    why: t(
      "A DELETE is a write, and a replica's job is to apply every write: this one reached it a second or two after the leader (lesson 60, Replication Lag), so promoting it brings back " + pct(D.repRows) + " of the orders. The nightly snapshot still has them (" + pct(D.snapRows) + " of the rows, all but the orders added since midnight), but restoring it alone throws away every good write since it was taken: " + int(D.snapMissing) + ". The snapshot plus the archived log, replayed with a recovery target of 14:04:59, stops one second before the DELETE: " + pct(D.pitrRows) + " of the orders, " + int(D.pitrMissing) + " good writes missing. That is point-in-time recovery. It isn't quick: " + dur(D.pitrMin) + " here, nearly all of it replaying 14 hours of log. And it doesn't replace production: restore it on another server and copy the orders back, so the " + int(D.after) + " writes made between 14:05 and 14:15 stay. In PostgreSQL that's recovery_target_time, or recovery_target_lsn to stop at the exact record, with recovery_target_inclusive = off so the target itself isn't replayed; MySQL replays its binary log with mysqlbinlog --stop-datetime.",
      "Un DELETE es una escritura, y el trabajo de una réplica es aplicar todas las escrituras: esta le llegó uno o dos segundos después que al líder (lección 60, Retraso de replicación), así que promoverla trae de vuelta el " + pct(D.repRows) + " de los pedidos. La instantánea nocturna todavía los tiene (el " + pct(D.snapRows) + " de las filas, todas menos los pedidos agregados desde la medianoche), pero restaurarla sola descarta cada escritura buena desde que se tomó: " + int(D.snapMissing) + ". La instantánea más el log archivado, reproducido con un objetivo de recuperación de 14:04:59, se detiene un segundo antes del DELETE: el " + pct(D.pitrRows) + " de los pedidos, " + int(D.pitrMissing) + " escrituras buenas faltantes. Eso es la recuperación a un punto en el tiempo (point-in-time recovery, PITR). No es rápida: " + dur(D.pitrMin) + " aquí, casi todo reproduciendo 14 horas de log. Y no reemplaza a producción: restáurala en otro servidor y copia los pedidos de vuelta, para que se queden las " + int(D.after) + " escrituras hechas entre las 14:05 y las 14:15. En PostgreSQL eso es recovery_target_time, o recovery_target_lsn para detenerse en el registro exacto, con recovery_target_inclusive = off para que el objetivo mismo no se reproduzca; MySQL reproduce su log binario con mysqlbinlog --stop-datetime.",
    ),
    watch: { snap: DAY, archive: "on", from: 14 * 60 + 3, plan: [["delete", 14 * 60 + 5]] },
  },
  {
    id: "interval",
    title: t("Snapshots more often", "Instantáneas más seguido"),
    change: t("Log archived, a segment every minute · the database and its replica are lost at a random moment · a snapshot every hour vs every 6 h vs once a day",
      "Log archivado, un segmento por minuto · la base de datos y su réplica se pierden en un momento al azar · una instantánea cada hora vs cada 6 h vs una vez al día"),
    question: t("Going from a daily snapshot to an hourly one, what changes when you restore?", "Al pasar de una instantánea diaria a una por hora, ¿qué cambia al restaurar?"),
    options: [
      t("It loses far less: an hour at most, not a day", "Pierde mucho menos: una hora como mucho, no un día"),
      t("It's faster, and loses the same few seconds", "Es más rápida, y pierde los mismos pocos segundos"),
      t("Both: it loses less and finishes sooner", "Las dos cosas: pierde menos y termina antes"),
    ],
    answer: 1,
    why: t(
      "With the log archived, a restore replays it up to the newest segment that reached the archive, however old the snapshot: what's lost is only what hadn't been archived yet, " + dur(I.hourly.lostMin) + " on average with every schedule (a segment closes every minute and takes seconds to upload). What the snapshot's age sets is how much log there is to replay. An hour of log replays in about " + HOUR_REPLAY + " minutes here, so a restore took " + dur(I.hourly.total) + " on average with hourly snapshots, " + dur(I.six.total) + " every 6 h and " + dur(I.daily.total) + " daily, up to " + dur(I.daily.maxTotal) + " late in the day. Frequent snapshots cost storage and load: each one reads the whole database, and 7 days of full copies take " + tb(I.hourly.tb) + " hourly against " + tb(I.daily.tb) + " daily. Incremental backups and copy-on-write snapshots (ZFS, EBS) store only the blocks that changed, which is what makes frequent ones affordable. It's the trade of checkpoints in lesson 66, Write-Ahead Log, one level up. Sizes and speeds are illustrative: a " + DB_GB + " GB database, " + LOG_GB_DAY + " GB of log a day, about " + COPY + " minutes to copy a snapshot back.",
      "Con el log archivado, una restauración lo reproduce hasta el segmento más nuevo que llegó al archivo, sin importar qué tan vieja sea la instantánea: se pierde solo lo que todavía no se había archivado, " + dur(I.hourly.lostMin) + " en promedio con cualquier frecuencia (un segmento se cierra cada minuto y tarda segundos en subir). Lo que fija la edad de la instantánea es cuánto log hay que reproducir. Una hora de log se reproduce en unos " + HOUR_REPLAY + " minutos aquí, así que una restauración tardó " + dur(I.hourly.total) + " en promedio con instantáneas cada hora, " + dur(I.six.total) + " cada 6 h y " + dur(I.daily.total) + " diarias, hasta " + dur(I.daily.maxTotal) + " al final del día. Las instantáneas frecuentes cuestan almacenamiento y carga: cada una lee la base de datos entera, y 7 días de copias completas ocupan " + tb(I.hourly.tb) + " cada hora contra " + tb(I.daily.tb) + " diarias. Los respaldos incrementales y las instantáneas copy-on-write (ZFS, EBS) guardan solo los bloques que cambiaron, y eso es lo que hace accesibles las frecuentes. Es el intercambio de los checkpoints de la lección 66, Registro de escritura anticipada, un nivel más arriba. Los tamaños y las velocidades son ilustrativos: una base de datos de " + DB_GB + " GB, " + LOG_GB_DAY + " GB de log por día, unos " + COPY + " minutos para copiar de vuelta una instantánea.",
    ),
    watch: { snap: DAY, archive: "on", from: 21 * 60 + 28, plan: [["lose", 21 * 60 + 30]] },
  },
  {
    id: "noarch",
    title: t("No log archive", "Sin log archivado"),
    change: t("The same loss and the same three schedules · the log isn't archived: a restore has only the snapshots",
      "La misma pérdida y las mismas tres frecuencias · el log no se archiva: una restauración solo tiene las instantáneas"),
    question: t("Without the archive, what does the snapshot interval decide?", "Sin el archivo, ¿qué decide el intervalo entre instantáneas?"),
    options: [
      t("Restore time, as before; losses stay at seconds", "El tiempo de restauración, como antes; se siguen perdiendo segundos"),
      t("What's lost: up to the whole interval, half on average", "Lo que se pierde: hasta el intervalo entero, la mitad en promedio"),
      t("Both, together: losses and restore time grow alike", "Las dos cosas a la vez: pérdida y restauración crecen igual"),
    ],
    answer: 1,
    why: t(
      "Without the log, the newest snapshot is the newest thing you can restore, and everything written after it is gone: half the interval on average, " + dur(N.hourly.lostMin) + " with hourly snapshots, " + dur(N.six.lostMin) + " every 6 h, " + dur(N.daily.lostMin) + " daily (up to " + dur(N.daily.maxLostMin) + ", " + int(N.daily.lostN) + " writes on average). The restore is the same copy every time, about " + dur(N.daily.total) + ", because there's nothing to replay. So \"a daily backup means we lose at most a day\" is true, and the day is the whole day. With snapshots alone, the interval is your recovery point objective (RPO, how much data you can lose); archive the log and RPO drops to seconds, and the interval goes back to setting the recovery time objective (RTO, how long the restore takes). Redis with RDB snapshots and no append-only file makes this trade on purpose.",
      "Sin el log, la instantánea más nueva es lo más nuevo que puedes restaurar, y todo lo escrito después se pierde: la mitad del intervalo en promedio, " + dur(N.hourly.lostMin) + " con instantáneas cada hora, " + dur(N.six.lostMin) + " cada 6 h, " + dur(N.daily.lostMin) + " diarias (hasta " + dur(N.daily.maxLostMin) + ", " + int(N.daily.lostN) + " escrituras en promedio). La restauración es la misma copia cada vez, unos " + dur(N.daily.total) + ", porque no hay nada que reproducir. Así que \"un respaldo diario significa que perdemos como mucho un día\" es cierto, y el día es el día entero. Con instantáneas solas, el intervalo es tu objetivo de punto de recuperación (recovery point objective, RPO: cuántos datos puedes perder); archiva el log y el RPO baja a segundos, y el intervalo vuelve a fijar el objetivo de tiempo de recuperación (recovery time objective, RTO: cuánto tarda la restauración). Redis con instantáneas RDB y sin archivo append-only hace este intercambio a propósito.",
    ),
    watch: { snap: DAY, archive: "off", from: 21 * 60 + 28, plan: [["lose", 21 * 60 + 30]] },
  },
  {
    id: "seed",
    title: t("Add a replica", "Agregar una réplica"),
    change: t("Snapshots every 6 h, log archived · a new replica copies the whole database from the leader (throttled to " + LEADER_MBPS + " MB/s) vs restores the latest snapshot from the shelf, replays the archive, then streams the rest from the leader",
      "Instantáneas cada 6 h, log archivado · una réplica nueva copia la base de datos entera del líder (limitada a " + LEADER_MBPS + " MB/s) vs restaura la última instantánea del estante, reproduce el archivo y luego recibe el resto del líder"),
    question: t("Seeded from the shelf, how much does the new replica read from the leader?", "Creada desde el estante, ¿cuánto lee la réplica nueva del líder?"),
    options: [
      t("All " + DB_GB + " GB again: it needs the live pages", "Los " + DB_GB + " GB otra vez: necesita las páginas vivas"),
      t("About half: the log since the snapshot", "Más o menos la mitad: el log desde la instantánea"),
      t("A few MB: the log that isn't archived yet", "Unos pocos MB: el log que aún no se archivó"),
    ],
    answer: 2,
    why: t(
      "The shelf already holds a consistent copy and every segment since: the new replica restores the snapshot, replays the archive, and asks the leader only for what hasn't been archived yet, " + gbOrMb(SD.six.shelfGB) + " on average against " + gbOrMb(SD.six.leaderGB) + " copied from the leader. It isn't necessarily faster: " + dur(SD.six.shelfMin) + " on average against " + dur(SD.six.leaderMin) + " from a leader throttled to " + LEADER_MBPS + " MB/s (pg_basebackup --max-rate), because the snapshot can be 6 hours old and that log has to be replayed; with hourly snapshots it was " + dur(SD.hourly.shelfMin) + ". What it buys is a leader that does nothing extra while you add replicas, which matters most when you add them because the leader is already busy, and a restore of your backups that gets tested every time it runs. Amazon RDS, for one, builds a read replica from a snapshot of the source. Throughput and replay speed here are illustrative.",
      "El estante ya tiene una copia consistente y cada segmento posterior: la réplica nueva restaura la instantánea, reproduce el archivo y le pide al líder solo lo que todavía no se archivó, " + gbOrMb(SD.six.shelfGB) + " en promedio contra " + gbOrMb(SD.six.leaderGB) + " copiados del líder. No es necesariamente más rápido: " + dur(SD.six.shelfMin) + " en promedio contra " + dur(SD.six.leaderMin) + " desde un líder limitado a " + LEADER_MBPS + " MB/s (pg_basebackup --max-rate), porque la instantánea puede tener 6 horas y ese log hay que reproducirlo; con instantáneas cada hora fueron " + dur(SD.hourly.shelfMin) + ". Lo que compra es un líder que no hace nada extra mientras agregas réplicas, lo que más importa cuando las agregas porque el líder ya está ocupado, y una restauración de tus respaldos que se prueba cada vez que corre. Amazon RDS, por ejemplo, crea una réplica de lectura a partir de una instantánea de la instancia de origen. El rendimiento y la velocidad de reproducción aquí son ilustrativos.",
    ),
    watch: { snap: 360, archive: "on", seed: "shelf", from: 16 * 60 + 58, plan: [["seed", 17 * 60]] },
  },
  {
    id: "gap",
    title: t("A segment goes missing", "Falta un segmento"),
    change: t("Nightly snapshots, log archived · at a random moment one segment never reaches the archive, though its upload reported success · the database is lost within the next 24 h · no restore drill vs a drill every 6 h that restores the latest snapshot on a spare machine, replays the archive and, if it finds a gap, takes a fresh snapshot",
      "Instantáneas nocturnas, log archivado · en un momento al azar un segmento nunca llega al archivo, aunque su subida informó éxito · la base de datos se pierde dentro de las 24 h siguientes · sin simulacro de restauración vs un simulacro cada 6 h que restaura la última instantánea en una máquina aparte, reproduce el archivo y, si encuentra un hueco, toma una instantánea nueva"),
    question: t("With no drill, how much does the restore lose when the database goes?", "Sin simulacro, ¿cuánto pierde la restauración cuando se pierde la base de datos?"),
    options: [
      t("About a minute, as usual: one segment is a minute", "Más o menos un minuto, como siempre: un segmento es un minuto"),
      t("Everything since the gap, until the next snapshot", "Todo desde el hueco, hasta la siguiente instantánea"),
      t("The whole day: the snapshot is useless without it", "El día entero: la instantánea no sirve sin él"),
    ],
    answer: 1,
    why: t(
      "Replay is strictly in order, each segment carrying on where the one before stopped, so a restore can't skip the missing one: it stops just before it, and nothing after the gap can be reached from an older snapshot. Only a snapshot taken after the gap gets past it. With nightly snapshots and no drill, " + pct(G.none.stopped) + " of the losses came before that next snapshot, and a restore lost " + dur(G.none.lost) + " on average (up to " + dur(G.none.maxLost) + "), against " + dur(G.whole.lostMin) + " with a complete archive. Nothing alerted, because the upload reported success. A drill every 6 hours found the gap before the loss in " + pct(G.drill.found) + " of the runs, and its fresh snapshot closed the window: " + dur(G.drill.lost) + " lost on average, " + pct(G.drill.stopped) + " of restores stopped at the gap. Real archiving helps: PostgreSQL retries archive_command until it succeeds, and backup tools like pgBackRest check that the log a backup needs reached the archive. But a segment removed later by a retention rule, or a bucket that isn't the one you think, shows up only when something restores from it. A backup nobody has restored is a guess.",
      "La reproducción va estrictamente en orden, cada segmento sigue donde se detuvo el anterior, así que una restauración no puede saltarse el que falta: se detiene justo antes, y nada después del hueco se alcanza desde una instantánea más vieja. Solo una instantánea tomada después del hueco lo deja atrás. Con instantáneas nocturnas y sin simulacro, el " + pct(G.none.stopped) + " de las pérdidas llegó antes de esa siguiente instantánea, y una restauración perdió " + dur(G.none.lost) + " en promedio (hasta " + dur(G.none.maxLost) + "), contra " + dur(G.whole.lostMin) + " con el archivo completo. Nada avisó, porque la subida informó éxito. Un simulacro cada 6 horas encontró el hueco antes de la pérdida en el " + pct(G.drill.found) + " de las ejecuciones, y su instantánea nueva cerró la ventana: " + dur(G.drill.lost) + " perdidos en promedio, el " + pct(G.drill.stopped) + " de las restauraciones detenidas en el hueco. El archivado real ayuda: PostgreSQL reintenta archive_command hasta que funciona, y herramientas de respaldo como pgBackRest verifican que el log que necesita un respaldo llegó al archivo. Pero un segmento que borró después una regla de retención, o un bucket que no es el que crees, aparece solo cuando algo restaura desde ahí. Un respaldo que nadie restauró es una suposición.",
    ),
    watch: { snap: DAY, archive: "gap", gapAt: 9 * 60, from: 8 * 60 + 58, plan: [["jump", 9 * 60 + 2.5, 16 * 60 + 59.5], ["lose", 17 * 60]] },
  },
];

const QUESTIONS = [
  [t("A replica, a snapshot, the archived log: which protects against what?", "Una réplica, una instantánea, el log archivado: ¿qué protege contra qué?"),
   t("A replica protects against losing a machine: promoted, it takes over in seconds, losing at most the acknowledged writes still in flight with asynchronous replication (lesson 60, Replication Lag, experiment 4, \"Lose the leader\"). But it copies every mistake just as fast (a bad DELETE, a dropped table, wrong data written by a bug). Snapshots with the archived log protect against mistakes and against losing everything: they take you back to a moment before the damage. A delayed replica (PostgreSQL's recovery_min_apply_delay, MySQL's SOURCE_DELAY) sits in between: it gives you, say, an hour to catch a mistake before it's applied, but it holds no history beyond that delay and lives next to the leader, so it doesn't replace backups.",
     "Una réplica protege contra perder una máquina: promovida, toma el mando en segundos y pierde como mucho las escrituras confirmadas que todavía iban en camino con replicación asíncrona (lección 60, Retraso de replicación, experimento 4, \"Perder al líder\"). Pero copia cada error igual de rápido (un DELETE malo, una tabla borrada, datos erróneos escritos por un bug). Las instantáneas con el log archivado protegen contra errores y contra perderlo todo: te llevan a un momento anterior al daño. Una réplica retrasada (recovery_min_apply_delay en PostgreSQL, SOURCE_DELAY en MySQL) queda en el medio: te da, por ejemplo, una hora para atrapar un error antes de que se aplique, pero no tiene historia más allá de ese retraso y vive junto al líder, así que no reemplaza a los respaldos.")],
  [t("Define RPO and RTO, and say which part of the backup setup sets each.", "Define RPO y RTO, y di qué parte de los respaldos fija cada uno."),
   t("Recovery point objective: how much data you can afford to lose, measured as time before the failure. Recovery time objective: how long you can be without the database. With the log archived, RPO is set by how often the log leaves the machine (archive_timeout, or streaming it with pg_receivewal for close to nothing); without it, by the snapshot interval. RTO is copy time plus replay time: the database's size, how fast the backups come back from where they're stored, and how much log has piled up since the snapshot, which the interval sets. Neither is real until a timed restore has met it.",
     "Objetivo de punto de recuperación: cuántos datos puedes permitirte perder, medido como tiempo antes de la falla. Objetivo de tiempo de recuperación: cuánto tiempo puedes estar sin la base de datos. Con el log archivado, el RPO lo fija la frecuencia con que el log sale de la máquina (archive_timeout, o enviarlo en streaming con pg_receivewal para casi nada); sin él, el intervalo entre instantáneas. El RTO es el tiempo de copia más el de reproducción: el tamaño de la base de datos, qué tan rápido vuelven los respaldos desde donde se guardan y cuánto log se acumuló desde la instantánea, que fija el intervalo. Ninguno es real hasta que una restauración cronometrada lo cumple.")],
  [t("The backup job has been green for a year. Name four things that can still make the restore fail on the day you need it, and what would catch them.", "El trabajo de respaldo lleva un año en verde. Nombra cuatro cosas que todavía pueden hacer fallar la restauración el día que la necesites, y qué las detectaría."),
   t("A gap in the archived log (a segment never uploaded, or removed by a retention rule). A snapshot that isn't consistent, or lacks the log its consistency needs. A lost encryption key or credential. Backups in the same account or region as the database, deleted by the same mistake or attacker. Retention shorter than the time it took to notice the damage. A restore that works but takes far longer than the RTO, or a runbook nobody has followed. A scheduled restore drill catches most of these: restore to a spare machine, replay to a recent target, check the data, time it. Building replicas and staging databases from the backups makes that routine.",
     "Un hueco en el log archivado (un segmento que nunca subió, o que borró una regla de retención). Una instantánea que no es consistente, o a la que le falta el log que su consistencia necesita. Una clave de cifrado o una credencial perdida. Respaldos en la misma cuenta o región que la base de datos, borrados por el mismo error o el mismo atacante. Una retención más corta que el tiempo que tardaste en notar el daño. Una restauración que funciona pero tarda mucho más que el RTO, o un procedimiento que nadie siguió nunca. Un simulacro de restauración programado atrapa la mayoría: restaurar en una máquina aparte, reproducir hasta un objetivo reciente, revisar los datos y cronometrarlo. Crear réplicas y bases de prueba desde los respaldos lo vuelve rutina.")],
  [t("Can you back up a running PostgreSQL by snapshotting its disk (EBS, LVM, ZFS)? When is that safe?", "¿Puedes respaldar un PostgreSQL en marcha tomando una instantánea de su disco (EBS, LVM, ZFS)? ¿Cuándo es seguro?"),
   t("Yes, if the snapshot is atomic across everything: the data directory and the WAL, every volume at the same instant. Restoring it is then like restarting after a power cut: PostgreSQL replays its WAL from the last checkpoint and comes up consistent (lesson 66, Write-Ahead Log). Volumes snapshotted one after another aren't consistent with each other. For those, or to replay the archived log on top for point-in-time recovery, take the snapshot between pg_backup_start() and pg_backup_stop(), or use pg_basebackup or a backup tool.",
     "Sí, si la instantánea es atómica sobre todo: el directorio de datos y el WAL, todos los volúmenes en el mismo instante. Restaurarla es entonces como reiniciar después de un corte de energía: PostgreSQL reproduce su WAL desde el último checkpoint y arranca consistente (lección 66, Registro de escritura anticipada). Volúmenes con instantáneas tomadas uno tras otro no son consistentes entre sí. Para esos, o para reproducir encima el log archivado y recuperar a un punto en el tiempo, toma la instantánea entre pg_backup_start() y pg_backup_stop(), o usa pg_basebackup o una herramienta de respaldo.")],
  [t("A bug has been writing wrong prices for three weeks, and your backups go back seven days. What now, and what would you change?", "Un bug lleva tres semanas escribiendo precios equivocados, y tus respaldos van siete días atrás. ¿Y ahora qué, y qué cambiarías?"),
   t("No backup you have holds the right prices, so point-in-time recovery can't help: rebuild them from another source (the upstream system, an audit table, application logs), and use the oldest backup to see what else the bug touched. Then make retention cover the time it takes to notice: keep some long-lived copies (weekly, monthly) beyond the point-in-time window, ideally immutable and in another account, so neither a mistake nor an attacker can delete them along with the database.",
     "Ningún respaldo que tengas guarda los precios correctos, así que recuperar a un punto en el tiempo no ayuda: reconstrúyelos desde otra fuente (el sistema de origen, una tabla de auditoría, los logs de la aplicación) y usa el respaldo más viejo para ver qué más tocó el bug. Después haz que la retención cubra el tiempo que se tarda en notarlo: guarda algunas copias de larga duración (semanales, mensuales) más allá de la ventana de recuperación, idealmente inmutables y en otra cuenta, para que ni un error ni un atacante puedan borrarlas junto con la base de datos.")],
  [t("You must undo a DELETE run at 14:05, but the database has taken writes since. Walk through the restore.", "Tienes que deshacer un DELETE ejecutado a las 14:05, pero la base de datos recibió escrituras desde entonces. Recorre la restauración."),
   t("Find the DELETE's exact point: its time, or better its transaction ID or LSN (from the logs, or pg_waldump on the archived WAL). Restore the last snapshot before it to a separate server, with recovery_target_xid or recovery_target_lsn set to it and recovery_target_inclusive = off, so replay stops just before. Check the rows are there, then copy them back into production (dump the rows, or INSERT … SELECT across servers) instead of replacing production with the restore, which would throw away every write since 14:05. With a nightly snapshot that's hours of replay, so start at once.",
     "Encuentra el punto exacto del DELETE: su hora o, mejor, su ID de transacción o su LSN (en los logs, o con pg_waldump sobre el WAL archivado). Restaura la última instantánea anterior en un servidor aparte, con recovery_target_xid o recovery_target_lsn en ese punto y recovery_target_inclusive = off, para que la reproducción se detenga justo antes. Revisa que las filas estén, y cópialas de vuelta a producción (un volcado de esas filas, o INSERT … SELECT entre servidores) en lugar de reemplazar producción con la restauración, que descartaría cada escritura desde las 14:05. Con una instantánea nocturna son horas de reproducción, así que empieza de inmediato.")],
];

export default defineLesson({
  title: t("Backup and Restore Workbench", "Banco de trabajo: respaldo y restauración"),
  eyebrow: t("Systems lesson 84 · Backup and restore", "Lección de sistemas 84 · Respaldo y restauración"),
  lede: t("A snapshot of a database brings it back to the moment the snapshot was taken; a snapshot plus the archived write-ahead log brings it back to any moment after that. Replicas don't replace either, and a backup counts only once something has restored from it. This lesson turns it into a backup room with a log archive, a shelf of snapshots and a restore station: watch it, predict what breaks it, then explain it back.",
    "Una instantánea (snapshot) de una base de datos la devuelve al momento en que se tomó; una instantánea más el log de escritura anticipada archivado la devuelve a cualquier momento posterior. Las réplicas no reemplazan a ninguno de los dos, y un respaldo cuenta solo cuando algo restauró desde él. Esta lección lo convierte en una sala de respaldos con un archivo del log, un estante de instantáneas y una estación de restauración: mírala, predice qué la rompe y después explícala."),
  machine: {
    intro: t("The leader takes named writes (W1, W2…), and the replica applies each one a second or two later. Every minute the open segment of the log closes and lands in the LOG ARCHIVE; on a schedule, a snapshot lands on the BACKUPS shelf. Run a bad DELETE, lose the database, or add a replica, and watch the restore station rebuild a copy from what's on the shelves.",
      "El líder recibe escrituras con nombre (W1, W2…), y la réplica aplica cada una uno o dos segundos después. Cada minuto el segmento abierto del log se cierra y llega al LOG ARCHIVADO; según la frecuencia elegida, una instantánea llega al estante de RESPALDOS. Lanza un DELETE malo, pierde la base de datos o agrega una réplica, y mira cómo la estación de restauración reconstruye una copia con lo que hay en los estantes."),
    plate: {
      title: t("Backup room", "Sala de respaldos"),
      keys: [
        { mark: "lit", label: t("The damage: the bad DELETE wherever it has reached, a node that is down, a segment missing from the archive", "El daño: el DELETE malo dondequiera que haya llegado, un nodo caído, un segmento que falta en el archivo") },
        { mark: "raised", label: t("Writes (W), log segments (crates, each with the last write it carries) and snapshots (S, with the time they hold up to)", "Escrituras (W), segmentos del log (cajas, cada una con la última escritura que lleva) e instantáneas (S, con la hora hasta la que llegan)") },
        { mark: "flat", label: t("Dashed: a write a copy doesn't have, a segment that never arrived", "Punteado: una escritura que una copia no tiene, un segmento que nunca llegó") },
      ],
      caption: t(
        "Time-lapse: the clock on the leader's front is the model's (change the pace under Speed); while the station works, it runs faster. Rates and sizes are illustrative and round: about " + RATE + " writes a minute; a segment closes every minute and lands in the archive 5–15 s later; a snapshot of the " + DB_GB + " GB database takes about " + BACKUP + " minutes and holds every write up to the time on its label; copying one back takes about " + COPY + " minutes, and an hour of log replays in about " + HOUR_REPLAY + ". The restore station's front: the last write the copy got back (UP TO), the writes made before its target that it doesn't have (LOST), and how long it took (TOOK). +N counts older crates on a shelf. LOAD is how hard the leader is working.",
        "Cámara rápida: el reloj del frente del líder es el del modelo (cambia el ritmo en Velocidad); mientras la estación trabaja, corre más rápido. Las tasas y los tamaños son ilustrativos y redondos: unas " + RATE + " escrituras por minuto; un segmento se cierra cada minuto y llega al archivo 5–15 s después; una instantánea de la base de datos de " + DB_GB + " GB tarda unos " + BACKUP + " minutos y guarda cada escritura hasta la hora de su etiqueta; copiarla de vuelta tarda unos " + COPY + " minutos, y una hora de log se reproduce en unos " + HOUR_REPLAY + ". El frente de la estación de restauración: la última escritura que recuperó la copia (HASTA), las escrituras anteriores a su objetivo que no tiene (PERDIDAS) y cuánto tardó (TARDÓ). +N cuenta las cajas más viejas de un estante. CARGA es cuánto está trabajando el líder.",
      ),
      stage: { "data-backup-room": "" },
      label: t("Backup and restore simulation. Space pauses or resumes.", "Simulación de respaldo y restauración. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["risk", t("Lost if it failed now", "Se perdería si fallara ya"), "–"],
      ["rto", t("A restore now would take", "Restaurar ahora tardaría"), "–"],
      ["store", t("Backup storage, 7 days", "Respaldos, 7 días"), "–"],
      ["upto", t("Last restore: up to", "Última restauración: hasta"), "–"],
      ["lost", t("Last restore: writes lost", "Última restauración: perdidas"), "–"],
      ["took", t("Last restore took", "La última restauración tardó"), "–"],
    ],
    controls: [
      { seg: "snap", label: t("Snapshot every", "Instantánea cada"), options: [[60, "1 h"], [360, "6 h"], [DAY, "24 h"]], value: 360 },
      { seg: "archive", label: t("Log archive", "Log archivado"), options: [["on", t("Every segment", "Todos los segmentos")], ["gap", t("One goes missing", "Falta uno")], ["drill", t("One missing, drill every 6 h", "Falta uno, simulacro cada 6 h")], ["off", t("Off", "Apagado")]], value: "on" },
      { seg: "seed", label: t("New replicas from", "Réplicas nuevas desde"), options: [["shelf", t("The shelf", "El estante")], ["leader", t("The leader", "El líder")]], value: "shelf" },
      { speed: true, options: [[1, "1 min/s"], [10, "10 min/s"], [60, "1 h/s"]], value: 10 },
      { actions: [["delete", t("Bad DELETE", "DELETE malo"), { primary: true }], ["lose", t("Lose the database", "Perder la base de datos")], ["seed", t("Add a replica", "Agregar una réplica")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Bad DELETE removes every order; " + NOTICE + " minutes later someone notices, and the station restores a copy to one second before it, beside the leader. Lose the database takes the leader and its replica together; the station restores the latest it can, and the copy takes over. Add a replica builds one at the station.",
      "Cambiar un ajuste reinicia la ejecución. DELETE malo borra todos los pedidos; " + NOTICE + " minutos después alguien lo nota, y la estación restaura una copia a un segundo antes, junto al líder. Perder la base de datos se lleva al líder y a su réplica juntos; la estación restaura lo más reciente que puede, y la copia toma el mando. Agregar una réplica crea una en la estación."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs, with " + SAMPLES + " moments at random per run where a moment is drawn.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija, con " + SAMPLES + " momentos al azar por ejecución donde se sortea un momento."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. Archiving and recovery targets follow the PostgreSQL documentation (continuous archiving and point-in-time recovery); sizes, rates and speeds are illustrative.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. El archivado y los objetivos de recuperación siguen la documentación de PostgreSQL (archivado continuo y recuperación a un punto en el tiempo); los tamaños, las tasas y las velocidades son ilustrativos.`),
  css: LIT_FILL_CSS,
  data: { P, G: GEOMETRY, FLY_SEG: flyerSvg("seg"), FLY_SNAP: flyerSvg("snap") },
});
