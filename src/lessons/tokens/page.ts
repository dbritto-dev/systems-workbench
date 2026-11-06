// @ts-nocheck: content in the style of the other lessons
// Systems lesson 80 · Token revocation: a festival gate that checks wristbands by their stamp.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one, n0, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, walkerSvg, denyCardSvg, flyCardSvg, P, GEOMETRY } from "./figure";
import { logoutRun, ttlRun, rotateRun, denyRun, resetRun, ROUNDS, THEFT, NOTICE, DAY } from "./sim";

// Experiment results, computed at build time from the same model the page runs (ROUNDS seeded rounds each).
const R = { logout: logoutRun(), ttl: ttlRun(), rotate: rotateRun(), deny: denyRun(), reset: resetRun() };

const min1 = (x) => (x > 0 && x < 0.05 ? "<0.1" : one(x)) + " min";
const hours = (x) => one(x / 60) + " h";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const per = (x) => one(x);
const THEFT_RANGE = THEFT[0] + "–" + (THEFT[0] + THEFT[1]);
const NOTICE_RANGE = NOTICE[0] + "–" + (NOTICE[0] + NOTICE[1]);
const between = ([a, d]) => "entre " + a + " y " + (a + d);
const DAY_H = String(DAY / 60);

// What each card shows after a run.
const RUNS = {
  logout: () => {
    const { stamp } = R.logout, m = top(stamp.max);
    return {
      verdict: t("After the logout, the copy still opened the gate in " + pct(stamp.share) + " of rounds: " + min1(stamp.window) + " on average, up to " + min1(stamp.max) + ", about " + n0(stamp.entries) + " entries per round. The thief was stopped only by the wristband's own expiry.",
        "Después del cierre de sesión, la copia siguió abriendo la entrada en el " + pct(stamp.share) + " de las rondas: " + min1(stamp.window) + " en promedio, hasta " + min1(stamp.max) + ", unas " + n0(stamp.entries) + " entradas por ronda. Al ladrón solo lo frenó el vencimiento de la propia pulsera."),
      bars: [[t("Window after logout, average", "Ventana tras cerrar sesión, promedio"), stamp.window / m, min1(stamp.window), true], [t("Window after logout, longest", "Ventana tras cerrar sesión, la más larga"), stamp.max / m, min1(stamp.max)], [t("Rounds where the copy still worked", "Rondas en que la copia siguió sirviendo"), stamp.share, pct(stamp.share)]],
    };
  },
  ttl: () => {
    const { long, short } = R.ttl, m = top(long.max), r = top(short.refreshes);
    return {
      verdict: t("1-hour wristbands: the copy worked " + min1(long.window) + " after the logout on average, up to " + min1(long.max) + ". 5-minute wristbands: " + min1(short.window) + ", up to " + min1(short.max) + ". The price: the box office signed " + per(short.refreshes) + " wristbands per user-hour instead of " + per(long.refreshes) + ".",
        "Pulseras de 1 hora: la copia sirvió " + min1(long.window) + " después del cierre de sesión en promedio, hasta " + min1(long.max) + ". Pulseras de 5 minutos: " + min1(short.window) + ", hasta " + min1(short.max) + ". El precio: la taquilla firmó " + per(short.refreshes) + " pulseras por usuario y hora en lugar de " + per(long.refreshes) + "."),
      groups: [
        { title: t("Window after logout, average (longest)", "Ventana tras cerrar sesión, promedio (la más larga)"), bars: [[t("1-hour wristbands", "Pulseras de 1 hora"), long.window / m, min1(long.window) + " (" + min1(long.max) + ")"], [t("5-minute wristbands", "Pulseras de 5 minutos"), short.window / m, min1(short.window) + " (" + min1(short.max) + ")", true]] },
        { title: t("Refreshes per user-hour", "Renovaciones por usuario y hora"), bars: [[t("1-hour wristbands", "Pulseras de 1 hora"), long.refreshes / r, per(long.refreshes)], [t("5-minute wristbands", "Pulseras de 5 minutos"), short.refreshes / r, per(short.refreshes), true]] },
      ],
    };
  },
  rotate: () => {
    const { reuse, rotate } = R.rotate, m = top(reuse.inside);
    return {
      verdict: t("Reusable pass: the thief was still walking in at the end of the day in " + pct(reuse.allDay) + " of rounds, " + hours(reuse.inside) + " after the theft on average. Rotated pass: the thief was out " + min1(rotate.inside) + " after the theft on average (at most " + min1(rotate.max) + "), and in " + pct(rotate.forced) + " of rounds the user had to log in again too.",
        "Pase reutilizable: el ladrón seguía entrando al final del día en el " + pct(reuse.allDay) + " de las rondas, " + hours(reuse.inside) + " después del robo en promedio. Pase rotado: el ladrón quedó afuera " + min1(rotate.inside) + " después del robo en promedio (" + min1(rotate.max) + " como máximo), y en el " + pct(rotate.forced) + " de las rondas el usuario también tuvo que volver a iniciar sesión."),
      groups: [
        { title: t("Thief inside after the theft, average", "Ladrón adentro tras el robo, promedio"), bars: [[t("Reusable pass", "Pase reutilizable"), reuse.inside / m, hours(reuse.inside), true], [t("Rotated pass, reuse detection", "Pase rotado, detección de reúso"), rotate.inside / m, min1(rotate.inside)]] },
        { title: t("Rounds where the user was logged out too", "Rondas en que el usuario también perdió la sesión"), bars: [[t("Reusable pass", "Pase reutilizable"), reuse.forced, pct(reuse.forced)], [t("Rotated pass, reuse detection", "Pase rotado, detección de reúso"), rotate.forced, pct(rotate.forced), true]] },
      ],
    };
  },
  deny: () => {
    const { stamp, deny } = R.deny, m = top(stamp.window);
    return {
      verdict: t("Stamp only: the copy worked " + min1(stamp.window) + " after the logout on average. With the deny list: " + min1(deny.window) + ", the thief was turned away at the first try. The gate made " + n0(deny.lookups) + " lookups per round, one for each of its " + n0(deny.requests) + " requests, and the list never held more than " + n0(deny.denyMax) + " entry.",
        "Solo el sello: la copia sirvió " + min1(stamp.window) + " después del cierre de sesión en promedio. Con la lista de bloqueo: " + min1(deny.window) + ", al ladrón lo rechazaron en el primer intento. La entrada hizo " + n0(deny.lookups) + " consultas por ronda, una por cada una de sus " + n0(deny.requests) + " solicitudes, y la lista nunca tuvo más de " + n0(deny.denyMax) + " entrada."),
      groups: [
        { title: t("Window after logout, average", "Ventana tras cerrar sesión, promedio"), bars: [[t("Stamp only", "Solo el sello"), stamp.window / m, min1(stamp.window)], [t("Stamp + deny list", "Sello + lista de bloqueo"), deny.window / m, min1(deny.window), true]] },
        { title: t("Lookups per request", "Consultas por solicitud"), bars: [[t("Stamp only", "Solo el sello"), stamp.lookups / Math.max(1, stamp.requests), one(stamp.lookups / Math.max(1, stamp.requests))], [t("Stamp + deny list", "Sello + lista de bloqueo"), deny.lookups / Math.max(1, deny.requests), one(deny.lookups / Math.max(1, deny.requests)), true]] },
      ],
    };
  },
  reset: () => {
    const { deny, version } = R.reset, m = top(deny.max);
    return {
      verdict: t("Deny list: after the reset the copy still worked " + min1(deny.window) + " on average, up to " + min1(deny.max) + ", in " + pct(deny.share) + " of rounds, as if the gate checked nothing. Token version: " + min1(version.window) + ", turned away at the first try.",
        "Lista de bloqueo: después del cambio de contraseña la copia siguió sirviendo " + min1(deny.window) + " en promedio, hasta " + min1(deny.max) + ", en el " + pct(deny.share) + " de las rondas, como si la entrada no revisara nada. Versión del token: " + min1(version.window) + ", rechazado en el primer intento."),
      bars: [[t("Deny list, average", "Lista de bloqueo, promedio"), deny.window / m, min1(deny.window), true], [t("Deny list, longest", "Lista de bloqueo, la más larga"), deny.max / m, min1(deny.max)], [t("Token version", "Versión del token"), version.window / m, min1(version.window)]],
    };
  },
};

const { logout: E1, ttl: E2, rotate: E3, deny: E4, reset: E5 } = R;
const WATCH = (o) => ({ ttl: 60, refresh: "rotate", check: "stamp", steal: "band", revoke: "logout", ...o });

const EXPERIMENTS = [
  {
    id: "logout",
    title: t("The user logs out", "El usuario cierra sesión"),
    change: t("Wristbands last 1 hour, renewed with a rotated refresh pass · the gate checks the stamp and the expiry, nothing else · the thief copies the wristband, and " + NOTICE_RANGE + " minutes later the user logs out (the box office revokes their pass)",
      "Las pulseras duran 1 hora y se renuevan con un pase rotado · la entrada revisa el sello y el vencimiento, nada más · el ladrón copia la pulsera, y " + between(NOTICE) + " minutos después el usuario cierra sesión (la taquilla revoca su pase)"),
    question: t("After the logout, what happens when the thief shows the copied wristband?", "Después del cierre de sesión, ¿qué pasa cuando el ladrón muestra la pulsera copiada?"),
    options: [
      t("Turned away: logging out ended the session that the wristband belongs to", "Lo rechazan: el cierre de sesión terminó la sesión a la que pertenece la pulsera"),
      t("Let in until the wristband expires: the gate never hears about the logout", "Lo dejan entrar hasta que la pulsera vence: la entrada nunca se entera del cierre"),
      t("Let in until the gate next checks with the box office, a minute or two", "Lo dejan entrar hasta que la entrada vuelve a consultar a la taquilla, uno o dos minutos"),
    ],
    answer: 1,
    why: t(
      "A wristband is a signed token (a JWT, RFC 7519): the gate checks the signature with the box office's key and compares the expiry with its own clock, without asking anyone. That's what makes it cheap and why logout can't reach it. Logout clears the user's copy and revokes the refresh pass, which only the box office ever sees; every copy of the wristband stays valid until its exp claim, here " + min1(E1.stamp.window) + " after the logout on average and up to " + min1(E1.stamp.max) + ". Nothing in the gate \"checks back\": with stamp-only checks, the expiry is the only revocation there is.",
      "Una pulsera es un token firmado (un JWT, RFC 7519): la entrada verifica la firma con la clave de la taquilla y compara el vencimiento con su propio reloj, sin preguntarle a nadie. Eso la hace barata, y por eso el cierre de sesión no la alcanza. Cerrar sesión borra la copia del usuario y revoca el pase de renovación, que solo ve la taquilla; toda copia de la pulsera sigue siendo válida hasta su claim exp, aquí " + min1(E1.stamp.window) + " después del cierre en promedio y hasta " + min1(E1.stamp.max) + ". Nada en la entrada \"vuelve a consultar\": si solo se revisa el sello, el vencimiento es la única revocación que existe.",
    ),
    watch: WATCH({}),
  },
  {
    id: "ttl",
    title: t("Shorter wristbands", "Pulseras más cortas"),
    change: t("The same theft and logout, with wristbands of 5 minutes instead of 1 hour · the user's app renews them at the box office with the refresh pass whenever one has run out",
      "El mismo robo y el mismo cierre de sesión, con pulseras de 5 minutos en lugar de 1 hora · la app del usuario las renueva en la taquilla con el pase cada vez que una se vence"),
    question: t("What do 5-minute wristbands buy, and what do they cost?", "¿Qué compran las pulseras de 5 minutos y qué cuestan?"),
    options: [
      t("A window of minutes at most, for many times the box office's signing work", "Una ventana de minutos como mucho, a cambio de muchas veces más firmas en la taquilla"),
      t("A window of minutes at most, at no extra cost: the gate still checks only stamps", "Una ventana de minutos como mucho, sin costo extra: la entrada sigue revisando solo sellos"),
      t("Nothing for the thief: a copy works for as long as the refresh pass behind it", "Nada contra el ladrón: una copia sirve mientras siga vivo el pase que la respalda"),
    ],
    answer: 0,
    why: t(
      "The window after a revocation is whatever life the stolen wristband has left, so it can't be longer than the lifetime: " + min1(E2.short.window) + " on average with 5 minutes against " + min1(E2.long.window) + " with 1 hour. A copied wristband can't be renewed without the pass, so the thief is out once it expires. The cost lands on the box office: the user now refreshes every time a wristband runs out, " + per(E2.short.refreshes) + " times per hour instead of " + per(E2.long.refreshes) + ", each a signature and a round trip, and the refresh pass is used far more often, so it's worth protecting (next experiment). Short lifetimes bound the window; they don't close it: a copy taken just before a logout would still have up to five minutes.",
      "La ventana después de una revocación es la vida que le queda a la pulsera robada, así que no puede ser más larga que la duración: " + min1(E2.short.window) + " en promedio con 5 minutos contra " + min1(E2.long.window) + " con 1 hora. Una pulsera copiada no se puede renovar sin el pase, así que el ladrón queda afuera cuando vence. El costo cae en la taquilla: el usuario ahora renueva cada vez que se vence una pulsera, " + per(E2.short.refreshes) + " veces por hora en lugar de " + per(E2.long.refreshes) + ", cada una con una firma y una ida y vuelta, y el pase se usa mucho más seguido, así que conviene protegerlo (siguiente experimento). Las duraciones cortas acotan la ventana; no la cierran: una copia tomada justo antes de un cierre de sesión todavía tendría hasta cinco minutos.",
    ),
    watch: WATCH({ ttl: 5 }),
  },
  {
    id: "rotate",
    title: t("The pass is stolen too", "También roban el pase"),
    change: t("5-minute wristbands · the thief copies the wristband and the refresh pass, and nobody notices for the rest of the " + DAY_H + "-hour day · a reusable pass vs a rotated pass (each refresh returns a new pass; showing a retired one revokes the whole family)",
      "Pulseras de 5 minutos · el ladrón copia la pulsera y el pase de renovación, y nadie lo nota en el resto del día de " + DAY_H + " horas · un pase reutilizable vs un pase rotado (cada renovación entrega un pase nuevo; mostrar uno retirado revoca toda la familia)"),
    question: t("With the rotated pass, how long does the thief keep getting in?", "Con el pase rotado, ¿cuánto tiempo sigue entrando el ladrón?"),
    options: [
      t("All day, as with the reusable pass: the copy refreshes just as well as the original", "Todo el día, como con el pase reutilizable: la copia renueva igual que el original"),
      t("Minutes: the first retired pass shown at the box office ends the family", "Minutos: el primer pase retirado que llega a la taquilla termina la familia"),
      t("Until the user logs out: rotation only changes what logout can revoke", "Hasta que el usuario cierra sesión: la rotación solo cambia lo que el cierre puede revocar"),
    ],
    answer: 1,
    why: t(
      "With a reusable pass, the copy is as good as the original for as long as the pass lives, so short wristbands don't help: the thief renews every five minutes and stays in all day, " + hours(E3.reuse.inside) + " on average here. With rotation the user and the thief hold the same pass, but only one of them can spend it: whoever refreshes second shows a pass the box office has already retired. It can't tell which of the two is the thief, so it revokes the family, and the thief is out once their last wristband expires, " + min1(E3.rotate.inside) + " after the theft on average. The user is logged out too (" + pct(E3.rotate.forced) + " of rounds) and has to log in again: that's the alarm. RFC 9700, the OAuth 2.0 security best current practice, asks public clients for exactly this, or for refresh tokens bound to a key the client holds (sender-constrained).",
      "Con un pase reutilizable, la copia vale lo mismo que el original mientras el pase viva, así que las pulseras cortas no ayudan: el ladrón renueva cada cinco minutos y se queda todo el día, " + hours(E3.reuse.inside) + " en promedio aquí. Con la rotación, el usuario y el ladrón tienen el mismo pase, pero solo uno puede gastarlo: el que renueva segundo muestra un pase que la taquilla ya retiró. Como no puede saber cuál de los dos es el ladrón, revoca la familia, y el ladrón queda afuera cuando vence su última pulsera, " + min1(E3.rotate.inside) + " después del robo en promedio. El usuario también pierde la sesión (" + pct(E3.rotate.forced) + " de las rondas) y tiene que volver a iniciarla: esa es la alarma. La RFC 9700, la mejor práctica actual de seguridad de OAuth 2.0, les pide esto a los clientes públicos, o tokens de renovación atados a una clave que el cliente guarda (sender-constrained).",
    ),
    watch: WATCH({ ttl: 5, steal: "both", revoke: "none" }),
  },
  {
    id: "deny",
    title: t("A deny list at the gate", "Una lista de bloqueo en la entrada"),
    change: t("Back to 1-hour wristbands, a copied wristband and a logout · the gate also looks every wristband's id up on a deny list, and logout puts the id of the wristband the user holds on it",
      "De vuelta a pulseras de 1 hora, una pulsera copiada y un cierre de sesión · la entrada además busca el id de cada pulsera en una lista de bloqueo, y el cierre de sesión agrega el id de la pulsera que tiene el usuario"),
    question: t("What does the deny list do to the window, and what does the gate pay for it?", "¿Qué le hace la lista de bloqueo a la ventana y qué paga la entrada por ella?"),
    options: [
      t("It closes at once; the gate now makes a lookup for every wristband it sees", "Se cierra de inmediato; la entrada ahora hace una consulta por cada pulsera que ve"),
      t("It closes at once; the gate looks up only the wristbands that were revoked", "Se cierra de inmediato; la entrada consulta solo las pulseras que fueron revocadas"),
      t("It closes at the next refresh: the box office reads the list when it signs", "Se cierra en la próxima renovación: la taquilla lee la lista cuando firma"),
    ],
    answer: 0,
    why: t(
      "The thief was turned away at the first try after the logout: " + min1(E4.deny.window) + " against " + min1(E4.stamp.window) + ". But the gate can't know a wristband is revoked without asking, so it looks up every one it sees, " + n0(E4.deny.lookups) + " lookups for " + n0(E4.deny.requests) + " requests: the token is stateless only until you want to revoke it. The list stays small, because an entry is needed only until the wristband would have expired anyway (store the id, the jti claim, with a time to live equal to its remaining life); here it never held more than " + n0(E4.deny.denyMax) + ". In production that lookup is a cache or a key-value store next to the gate, and how fast revocations reach it is now your window.",
      "Al ladrón lo rechazaron en el primer intento después del cierre: " + min1(E4.deny.window) + " contra " + min1(E4.stamp.window) + ". Pero la entrada no puede saber que una pulsera está revocada sin preguntar, así que consulta cada una que ve, " + n0(E4.deny.lookups) + " consultas para " + n0(E4.deny.requests) + " solicitudes: el token es sin estado solo hasta que quieres revocarlo. La lista queda chica, porque una entrada solo hace falta hasta que la pulsera habría vencido de todos modos (guarda el id, el claim jti, con un tiempo de vida igual a lo que le queda); aquí nunca tuvo más de " + n0(E4.deny.denyMax) + ". En producción esa consulta es una caché o un almacén clave-valor junto a la entrada, y lo rápido que le llegan las revocaciones pasa a ser tu ventana.",
    ),
    watch: WATCH({ check: "deny" }),
  },
  {
    id: "reset",
    title: t("A password reset", "Un cambio de contraseña"),
    change: t("Deny list on · instead of logging out, the user resets their password from another device: the box office revokes every pass, but nobody hands in a wristband · then the same reset with the gate comparing each wristband's version with the user's, which the reset bumps",
      "Lista de bloqueo activa · en lugar de cerrar sesión, el usuario cambia su contraseña desde otro dispositivo: la taquilla revoca todos los pases, pero nadie entrega una pulsera · después el mismo cambio con la entrada comparando la versión de cada pulsera con la del usuario, que el cambio incrementa"),
    question: t("With the deny list, what happens to the thief's copy after the reset?", "Con la lista de bloqueo, ¿qué pasa con la copia del ladrón después del cambio de contraseña?"),
    options: [
      t("Turned away at once: the reset revoked everything the user had", "La rechazan de inmediato: el cambio revocó todo lo que tenía el usuario"),
      t("It works until it expires: nobody ever handed its id to the list", "Sirve hasta que vence: nadie le entregó nunca su id a la lista"),
      t("It works until the thief's next refresh, which the box office refuses", "Sirve hasta la próxima renovación del ladrón, que la taquilla rechaza"),
    ],
    answer: 1,
    why: t(
      "A deny list only holds the ids someone hands it. Logout hands it the wristband the device carries; a reset from another device (or an admin locking the account) carries no wristband, and the box office didn't keep a record of the ones it signed, so the copy works on: " + min1(E5.deny.window) + " on average, the same as stamp-only checks. The revoked passes only stop renewals, and this thief never needed one. A token version per user fixes it: each wristband carries the version it was signed with, the reset bumps the user's, and the gate turns away anything older: " + min1(E5.version.window) + ". It's still a lookup per request, but of one small record per user, easy to cache, and one write revokes every session at once, which is also why a single-device logout needs a finer key, a version per session.",
      "Una lista de bloqueo solo tiene los ids que alguien le entrega. El cierre de sesión le entrega la pulsera que lleva el dispositivo; un cambio de contraseña desde otro dispositivo (o un administrador que bloquea la cuenta) no lleva ninguna pulsera, y la taquilla no guardó registro de las que firmó, así que la copia sigue sirviendo: " + min1(E5.deny.window) + " en promedio, lo mismo que revisando solo el sello. Los pases revocados solo impiden renovar, y este ladrón nunca necesitó uno. Una versión del token por usuario lo resuelve: cada pulsera lleva la versión con la que se firmó, el cambio incrementa la del usuario y la entrada rechaza todo lo anterior: " + min1(E5.version.window) + ". Sigue siendo una consulta por solicitud, pero de un registro pequeño por usuario, fácil de cachear, y una sola escritura revoca todas las sesiones a la vez, por eso cerrar sesión en un solo dispositivo necesita una clave más fina, una versión por sesión.",
    ),
    watch: WATCH({ check: "deny", revoke: "reset" }),
  },
];

const QUESTIONS = [
  [t("A teammate says: \"logout calls the API, so the JWT is revoked.\" What does logout actually change, and what keeps working?", "Alguien del equipo dice: \"el cierre de sesión llama a la API, así que el JWT queda revocado\". ¿Qué cambia realmente el cierre de sesión y qué sigue funcionando?"),
   t("Logout clears the token from the client and, if the server does its part, revokes the refresh token at the authorization server. The access token is a signed statement that every API verifies on its own with the issuer's key and its own clock, so any copy (in a log, a proxy, a stolen browser profile) keeps working until exp. Ending it earlier needs state the API consults on each request: a deny list of token ids, a version or session check, or opaque tokens the API asks about (token introspection, RFC 7662).",
     "El cierre de sesión borra el token del cliente y, si el servidor hace su parte, revoca el token de renovación en el servidor de autorización. El token de acceso es una afirmación firmada que cada API verifica por su cuenta con la clave del emisor y su propio reloj, así que cualquier copia (en un log, un proxy, un perfil de navegador robado) sigue sirviendo hasta exp. Terminarlo antes exige un estado que la API consulte en cada solicitud: una lista de bloqueo de ids de token, una revisión de versión o de sesión, o tokens opacos por los que la API pregunta (introspección de tokens, RFC 7662).")],
  [t("How do you choose an access token's lifetime?", "¿Cómo eliges la duración de un token de acceso?"),
   t("It bounds the window: after a theft or a revocation, a copy works for whatever life it has left. Shorter means more refreshes (authorization-server load, a round trip whenever one expires, a refresh token used more often) and tighter clock requirements. Many systems use minutes for access tokens and let refresh tokens carry the session; where minutes are still too long (payments, admin actions, a just-fired employee), add a lookup on those routes rather than shrinking every token.",
     "Acota la ventana: después de un robo o una revocación, una copia sirve por la vida que le queda. Más corta significa más renovaciones (carga en el servidor de autorización, una ida y vuelta cada vez que vence, un token de renovación usado más seguido) y requisitos de reloj más estrictos. Muchos sistemas usan minutos para los tokens de acceso y dejan que el token de renovación sostenga la sesión; donde unos minutos siguen siendo demasiado (pagos, acciones de administración, un empleado recién despedido), agrega una consulta en esas rutas en lugar de achicar todos los tokens.")],
  [t("Rotation with reuse detection logged out a user who had no thief. How can that happen, and what do you do about it?", "La rotación con detección de reúso le cerró la sesión a un usuario que no tenía ningún ladrón. ¿Cómo puede pasar y qué haces?"),
   t("Two refreshes with the same refresh token: two tabs or two parallel requests that both found the access token expired (a race, lesson 17, Race conditions), or a refresh whose response was lost so the client retried with the old token. The second one looks exactly like reuse. Allow one refresh in flight per client (share the pending promise; coordinate tabs, for example with the Web Locks API), retry with the new token once it arrives, and on the server consider a short grace period in which the token just replaced is still accepted, which many identity providers offer.",
     "Dos renovaciones con el mismo token de renovación: dos pestañas o dos solicitudes en paralelo que encontraron vencido el token de acceso (una carrera, lección 17, Condiciones de carrera), o una renovación cuya respuesta se perdió y el cliente reintentó con el token viejo. La segunda se ve exactamente como un reúso. Permite una sola renovación en vuelo por cliente (comparte la promesa pendiente; coordina las pestañas, por ejemplo con la API Web Locks), reintenta con el token nuevo cuando llegue y, en el servidor, considera un período de gracia corto en el que el token recién reemplazado todavía se acepte, algo que ofrecen muchos proveedores de identidad.")],
  [t("Your deny list lives in Redis and every API checks it on every request. How do you keep it small and fast, and what happens when Redis is down?", "Tu lista de bloqueo vive en Redis y cada API la consulta en cada solicitud. ¿Cómo la mantienes pequeña y rápida, y qué pasa cuando Redis se cae?"),
   t("Key each entry by the token id (jti) with a time to live equal to the token's remaining life, so entries vanish when the tokens would have expired anyway and the list never holds more than one lifetime of revocations. For speed, keep a copy in each process and push changes to it (pub/sub) or refresh it every few seconds: how stale that copy may be is now your revocation window (lesson 01, Caching). If the store is unreachable, decide per route whether to fail closed (refuse) or fail open (accept on the signature alone), and alert either way.",
     "Usa como clave de cada entrada el id del token (jti) con un tiempo de vida igual a lo que le queda al token, así las entradas desaparecen cuando el token habría vencido de todos modos y la lista nunca guarda más que una duración de revocaciones. Para que sea rápida, ten una copia en cada proceso y envíale los cambios (pub/sub) o refréscala cada pocos segundos: lo vieja que puede estar esa copia pasa a ser tu ventana de revocación (lección 01, Caché). Si el almacén no responde, decide por ruta si fallar cerrado (rechazar) o abierto (aceptar solo con la firma), y alerta en ambos casos.")],
  [t("The gate compares exp with its own clock. What goes wrong when the issuer's and the API's clocks disagree, and what's the usual fix?", "La entrada compara exp con su propio reloj. ¿Qué sale mal cuando los relojes del emisor y de la API no coinciden, y cuál es la solución habitual?"),
   t("An API whose clock is behind accepts tokens after they expire, which stretches the window; one that is ahead rejects fresh tokens early, and one that checks nbf or iat can reject a brand-new token as not yet valid, which shows up as refresh or login loops. Keep clocks synced (NTP) and allow a small leeway: RFC 7519 allows some, usually no more than a few minutes, and most JWT libraries take a leeway or clock-tolerance option. The leeway adds directly to the revocation window. Why clocks drift and what syncing can promise is lesson 61, Clocks & Last-Write-Wins.",
     "Una API con el reloj atrasado acepta tokens después de vencidos, lo que estira la ventana; una adelantada rechaza tokens nuevos antes de tiempo, y una que revisa nbf o iat puede rechazar un token recién emitido como todavía no válido, lo que aparece como bucles de renovación o de inicio de sesión. Mantén los relojes sincronizados (NTP) y permite un margen pequeño (leeway): la RFC 7519 admite uno, normalmente de no más de unos minutos, y la mayoría de las bibliotecas de JWT aceptan una opción de leeway o tolerancia de reloj. Ese margen se suma directamente a la ventana de revocación. Por qué se desvían los relojes y qué puede prometer la sincronización es la lección 61, Relojes y última escritura gana.")],
  [t("When would you choose opaque tokens with introspection over self-contained JWTs?", "¿Cuándo elegirías tokens opacos con introspección en lugar de JWT autocontenidos?"),
   t("When revoking at once matters more than a lookup per request: an opaque token is just a reference, so the API asks the authorization server about it (introspection, RFC 7662), and a revoked token stops working as soon as the answer changes, or once a short cache of the answer expires. JWTs let every service verify alone, with no call on the hot path, which is why they suit many internal services; the price is everything this lesson shows. A common middle ground: opaque tokens at the edge, swapped at the gateway for a short-lived JWT for the services behind it.",
     "Cuando revocar de inmediato importa más que una consulta por solicitud: un token opaco es solo una referencia, así que la API le pregunta por él al servidor de autorización (introspección, RFC 7662), y un token revocado deja de servir en cuanto cambia la respuesta, o cuando vence una caché corta de esa respuesta. Los JWT permiten que cada servicio verifique solo, sin llamadas en el camino crítico, por eso encajan en muchos servicios internos; el precio es todo lo que muestra esta lección. Un punto medio común: tokens opacos en el borde, cambiados en el gateway por un JWT de vida corta para los servicios de atrás.")],
];

export default defineLesson({
  title: t("Token Revocation Workbench", "Banco de trabajo: revocación de tokens"),
  eyebrow: t("Systems lesson 80 · Token revocation", "Lección de sistemas 80 · Revocación de tokens"),
  lede: t("A signed access token, such as a JWT, is checked by its signature and expiry alone, so logging out doesn't revoke it: any copy keeps working until it expires. Revoking it sooner takes state that the API consults on every request. This lesson turns it into a festival gate that checks wristbands by their stamp: watch it, predict what a stolen wristband can do, then explain it back.",
    "Un token de acceso firmado, como un JWT, se revisa solo por su firma y su vencimiento, así que cerrar sesión no lo revoca: cualquier copia sigue sirviendo hasta que vence. Revocarlo antes exige un estado que la API consulte en cada solicitud. Esta lección lo convierte en la entrada de un festival que revisa pulseras por su sello: mírala, predice qué puede hacer una pulsera robada y después explícala."),
  machine: {
    intro: t("The box office (the authorization server) signs wristbands (access tokens) and hands out refresh passes (refresh tokens). The gate (an API) lets in any wristband with a genuine stamp and an expiry later than its clock. A thief copies what the user carries; then the user logs out, resets their password, or notices nothing. Change what the gate checks, how long wristbands last and how passes work, or steal and log out yourself.",
      "La taquilla (el servidor de autorización) firma pulseras (tokens de acceso) y entrega pases de renovación (refresh tokens). La entrada (una API) deja pasar cualquier pulsera con un sello genuino y un vencimiento posterior a su reloj. Un ladrón copia lo que lleva el usuario; después el usuario cierra sesión, cambia su contraseña o no nota nada. Cambia lo que revisa la entrada, cuánto duran las pulseras y cómo funcionan los pases, o roba y cierra sesión tú."),
    plate: {
      title: t("Festival gate", "Entrada del festival"),
      keys: [
        { mark: "lit", label: t("The thief's copies, and whatever stops one: a scanner turning a wristband away, the deny list or the user record saying no, the box office revoking or refusing a pass", "Las copias del ladrón, y lo que frena una: un lector que rechaza una pulsera, la lista de bloqueo o el registro del usuario diciendo que no, la taquilla revocando o rechazando un pase") },
        { mark: "raised", label: t("The user and the thief, with their wristband (id, expiry) and refresh pass (P)", "El usuario y el ladrón, con su pulsera (id, vencimiento) y su pase de renovación (P)") },
        { mark: "flat", label: t("The lanes to the gate, and the wires from both scanners to the deny list and the user record", "Los carriles hacia la entrada, y los cables de los dos lectores a la lista de bloqueo y al registro del usuario") },
      ],
      caption: t(
        "One minute of festival time per second (change it under Speed). The user walks through the gate every few minutes, by the box office whenever their wristband has run out; once the thief has a copy, they try every couple of minutes. Both lanes get the same checks, and an arm rises for every wristband the gate accepts. Each wristband shows its id and the time it expires, which the gate compares with its CLOCK; when the gate checks versions, the id also shows the version it was signed with (v1). REFRESHES and LOGINS count the box office's work. The gate log counts the thief's entries after the revocation, the minutes from the revocation to the copy's last entry (WINDOW) and the gate's LOOKUPS. Times are illustrative.",
        "Un minuto de festival por segundo (cámbialo en Velocidad). El usuario cruza la entrada cada pocos minutos, pasando por la taquilla cuando se le vence la pulsera; cuando el ladrón tiene una copia, prueba cada par de minutos. Los dos carriles reciben las mismas revisiones, y una barrera se levanta para cada pulsera que la entrada acepta. Cada pulsera muestra su id y la hora a la que vence, que la entrada compara con su RELOJ; cuando la entrada revisa versiones, el id también muestra la versión con la que se firmó (v1). RENOVACIONES y LOGINS cuentan el trabajo de la taquilla. La bitácora de la entrada cuenta las entradas del ladrón tras la revocación, los minutos desde la revocación hasta la última entrada de la copia (VENTANA) y las CONSULTAS de la entrada. Los tiempos son ilustrativos.",
      ),
      stage: { "data-festival": "" },
      label: t("Token revocation simulation. Space pauses or resumes.", "Simulación de revocación de tokens. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["after", t("Thief in after revoke", "Entra ladrón tras revocar"), "0"],
      ["window", t("Window", "Ventana"), "0.0 min"],
      ["lookups", t("Lookups", "Consultas"), "0"],
      ["refreshes", t("Refreshes", "Renovaciones"), "0"],
      ["logins", t("Logins", "Logins"), "1"],
      ["thief", t("Thief", "Ladrón"), t("waiting", "esperando")],
    ],
    controls: [
      { seg: "ttl", label: t("Wristband lasts", "La pulsera dura"), options: [[5, "5 min"], [15, "15 min"], [60, "1 h"], [480, "8 h"]], value: 60 },
      { seg: "refresh", label: t("Refresh pass", "Pase de renovación"), options: [["off", t("None", "Ninguno")], ["reuse", t("Reusable", "Reutilizable")], ["rotate", t("Rotated", "Rotado")]], value: "rotate" },
      { seg: "check", label: t("Gate checks", "La entrada revisa"), options: [["stamp", t("Stamp only", "Solo el sello")], ["deny", t("+ deny list", "+ lista de bloqueo")], ["version", t("+ token version", "+ versión del token")]], value: "stamp" },
      { seg: "steal", label: t("Thief copies", "El ladrón copia"), options: [["band", t("Wristband", "La pulsera")], ["both", t("Wristband + pass", "Pulsera + pase")]], value: "band" },
      { seg: "revoke", label: t("Then the user", "Después el usuario"), options: [["logout", t("Logs out", "Cierra sesión")], ["reset", t("Resets password", "Cambia la contraseña")], ["none", t("Notices nothing", "No nota nada")]], value: "logout" },
      { speed: true, options: [[1, "1 min/s"], [3, "3 min/s"], [10, "10 min/s"]], value: 1 },
      { actions: [["steal", t("Steal now", "Robar ahora"), { primary: true }], ["logout", t("Log out", "Cerrar sesión")], ["resetpw", t("Reset password", "Cambiar contraseña")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts a new round. In a round the thief copies at the user's first scan 6 to 16 minutes in, and the user does what Then the user says 5 to 11 minutes later. Steal now has the thief copy at the user's next scan; Log out and Reset password act at once. Watch it in the figure has the thief copy after 3 minutes and the user act 3 minutes later, at 3 min/s. A round ends once the thief is locked out, or 2.5 hours after the theft.",
      "Cambiar un ajuste empieza una ronda nueva. En una ronda, el ladrón copia en el primer escaneo del usuario entre los minutos 6 y 16, y el usuario hace lo que dice Después el usuario de 5 a 11 minutos más tarde. Con Robar ahora el ladrón copia en el próximo escaneo del usuario; Cerrar sesión y Cambiar contraseña actúan en el momento. Míralo en la figura hace que el ladrón copie a los 3 minutos y que el usuario actúe 3 minutos después, a 3 min/s. Una ronda termina cuando el ladrón queda afuera, o 2.5 horas después del robo."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + ROUNDS + " seeded rounds: the thief copies at the user's first scan " + THEFT_RANGE + " minutes after login, and the user acts " + NOTICE_RANGE + " minutes later.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + ROUNDS + " rondas con semilla fija: el ladrón copia en el primer escaneo del usuario " + between(THEFT) + " minutos después del inicio de sesión, y el usuario actúa " + between(NOTICE) + " minutos más tarde."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. JWT claims (exp, jti, nbf, iat) follow RFC 7519; refresh-token rotation and reuse detection follow the OAuth 2.0 Security Best Current Practice (RFC 9700).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los claims de JWT (exp, jti, nbf, iat) siguen la RFC 7519; la rotación de tokens de renovación y la detección de reúso siguen la mejor práctica actual de seguridad de OAuth 2.0 (RFC 9700).`),
  css: LIT_FILL_CSS + `
.tok-pulse{fill:var(--anatomy-strong)}
.tok-window{fill:var(--anatomy-faint);stroke:var(--anatomy-lo);stroke-width:.6}
[data-band-id],[data-band-exp],[data-pass-id],[data-deny-id]{font-weight:600}
`,
  data: { P, G: GEOMETRY, USER_SVG: walkerSvg("user"), THIEF_SVG: walkerSvg("thief"), DENY_CARD_SVG: denyCardSvg(), FLY_SVG: flyCardSvg() },
});
