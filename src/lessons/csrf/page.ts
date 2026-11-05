// @ts-nocheck: content in the style of the other lessons
// Systems lesson 82 · CSRF & SameSite: a bank street where the browser is a courier that brings the customer's ID card.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, courierSvg, cardSvg, P, GEOMETRY } from "./figure";
import { corsRun, laxRun, strictRun, tokensRun, getRun, SETUPS, RUN_S } from "./sim";

// Experiment results, computed at build time from the same model the machine runs (eight seeded runs of ten minutes).
const R = { cors: corsRun(), lax: laxRun(), strict: strictRun(), tokens: tokensRun(), get: getRun() };
const MIN = RUN_S / 60;

// What each card shows after a run.
const RUNS = {
  cors: () => {
    const r = R.cors;
    return {
      verdict: t("Of about " + n0(r.formN) + " forged form POSTs per run, the bank paid " + pct(r.formShare) + ". Every one carried the customer's card; the customer's own requests worked too (" + pct(r.okShare) + ").",
        "De unos " + n0(r.formN) + " POST de formulario falsos por ejecución, el banco pagó el " + pct(r.formShare) + ". Todos llevaban la tarjeta del cliente; las solicitudes propias del cliente también funcionaron (" + pct(r.okShare) + ")."),
      bars: [[t("Forged form POSTs paid", "POST falsos pagados"), r.formShare, pct(r.formShare), true], [t("Carried the card", "Llevaban la tarjeta"), r.formCard / (r.formN || 1), pct(r.formCard / (r.formN || 1))]],
    };
  },
  lax: () => {
    const r = R.lax;
    return {
      verdict: t("With Lax: other.example's form POSTs " + pct(r.formShare) + " paid, its links to GET /pay " + pct(r.linkShare) + ", the forum's form POSTs " + pct(r.forumShare) + ". " + pct(r.paidShare) + " of all forged errands went through.",
        "Con Lax: POST de formulario de other.example, " + pct(r.formShare) + " pagados; sus enlaces a GET /pay, " + pct(r.linkShare) + "; POST de formulario del foro, " + pct(r.forumShare) + ". Pasó el " + pct(r.paidShare) + " de todos los encargos falsos."),
      bars: [[t("Form POST, other.example", "POST de formulario, other.example"), r.formShare, pct(r.formShare)], [t("Link to GET /pay, other.example", "Enlace a GET /pay, other.example"), r.linkShare, pct(r.linkShare), true], [t("Form POST, forum.bank.example", "POST de formulario, forum.bank.example"), r.forumShare, pct(r.forumShare), true]],
    };
  },
  strict: () => {
    const { lax, strict } = R.strict;
    return {
      verdict: t("The forum's forged POSTs paid: " + pct(lax.forumShare) + " with Lax, " + pct(strict.forumShare) + " with Strict. The customer's visits that followed a link from another site arrived signed out: " + pct(lax.outShare) + " with Lax, " + pct(strict.outShare) + " with Strict.",
        "POST falsos del foro pagados: " + pct(lax.forumShare) + " con Lax, " + pct(strict.forumShare) + " con Strict. Visitas del cliente que siguieron un enlace desde otro sitio y llegaron sin sesión: " + pct(lax.outShare) + " con Lax, " + pct(strict.outShare) + " con Strict."),
      groups: [
        { title: t("Forum's forged POSTs paid", "POST falsos del foro pagados"), bars: [[t("Lax", "Lax"), lax.forumShare, pct(lax.forumShare)], [t("Strict", "Strict"), strict.forumShare, pct(strict.forumShare), true]] },
        { title: t("Link visits arriving signed out", "Visitas por enlace sin sesión"), bars: [[t("Lax", "Lax"), lax.outShare, pct(lax.outShare)], [t("Strict", "Strict"), strict.outShare, pct(strict.outShare), true]] },
      ],
    };
  },
  tokens: () => {
    const { copy, session, origin } = R.tokens;
    return {
      verdict: t("Strict, the forum's forged POSTs: " + pct(copy.forumShare) + " paid with a plain double-submit copy, " + pct(session.forumShare) + " with a token kept in the session, " + pct(origin.forumShare) + " with a same-origin check and no token. The customer's own transfers worked in all three.",
        "Strict, POST falsos del foro: " + pct(copy.forumShare) + " pagados con una copia double-submit simple, " + pct(session.forumShare) + " con un token guardado en la sesión y " + pct(origin.forumShare) + " con una comprobación de mismo origen y sin token. Las transferencias propias del cliente funcionaron en los tres casos."),
      bars: [[t("Double-submit copy", "Copia double-submit"), copy.forumShare, pct(copy.forumShare), true], [t("Session token", "Token de sesión"), session.forumShare, pct(session.forumShare)], [t("Same-origin check", "Comprobación de mismo origen"), origin.forumShare, pct(origin.forumShare)]],
    };
  },
  get: () => {
    const { old, postOnly } = R.get;
    return {
      verdict: t("Lax, a session token and a same-origin check, and other.example links to GET /pay: " + pct(old.linkShare) + " paid while the old GET endpoint exists, " + pct(postOnly.linkShare) + " once paying takes a POST.",
        "Lax, un token de sesión y una comprobación de mismo origen, y other.example enlaza a GET /pay: " + pct(old.linkShare) + " pagados mientras existe el viejo endpoint GET y " + pct(postOnly.linkShare) + " cuando pagar exige un POST."),
      bars: [[t("Old GET /pay endpoint", "Viejo endpoint GET /pay"), old.linkShare, pct(old.linkShare), true], [t("POST only", "Solo POST"), postOnly.linkShare, pct(postOnly.linkShare)]],
    };
  },
};

const w = (s) => ({ samesite: s.samesite, token: s.token, origin: s.origin, getpay: s.getPay ? "on" : "off", errand: s.errand });

const EXPERIMENTS = [
  {
    id: "cors",
    title: t("The card rides along", "La tarjeta va con el mensajero"),
    change: t("Session cookie with SameSite=None · no token, no origin check · the bank sends no CORS headers, so other.example's scripts can't read its answers · other.example auto-submits a hidden form: POST /pay",
      "Cookie de sesión con SameSite=None · sin token ni comprobación de origen · el banco no envía encabezados CORS, así que los scripts de other.example no pueden leer sus respuestas · other.example envía por su cuenta un formulario oculto: POST /pay"),
    question: t("Of the forged form POSTs, how many does the bank pay?", "De los POST de formulario falsos, ¿cuántos paga el banco?"),
    options: [
      t("None: without CORS permission the browser won't send a cross-origin POST", "Ninguno: sin permiso CORS el navegador no envía un POST a otro origen"),
      t("All: the browser sends the form with the card; CORS only guards reading", "Todos: el navegador envía el formulario con la tarjeta; CORS solo protege la lectura"),
      t("Few: browsers now block cookies on requests that other sites start", "Pocos: los navegadores ya bloquean cookies en solicitudes que inician otros sitios"),
    ],
    answer: 1,
    why: t(
      "The browser attaches a cookie because of where a request goes, not who asked for it, and a session cookie is all the bank uses to know who is asking. A form submit is a plain navigation: no CORS preflight, nothing for CORS to refuse. CORS decides only whether a script on other.example may read the answer, and the money has already moved by then: " + pct(R.cors.formShare) + " of the forged POSTs were paid. Blocking third-party cookies doesn't help either: a form that navigates the whole tab to bank.example is a first-party visit, so the bank's cookies go along. That is cross-site request forgery (CSRF): the request is real, signed in and forged at the same time.",
      "El navegador adjunta una cookie según a dónde va la solicitud, no según quién la pidió, y la cookie de sesión es lo único que usa el banco para saber quién pide. Enviar un formulario es una navegación común: sin verificación previa (preflight) de CORS, nada que CORS pueda rechazar. CORS solo decide si un script de other.example puede leer la respuesta, y para entonces el dinero ya se movió: se pagó el " + pct(R.cors.formShare) + " de los POST falsos. Bloquear las cookies de terceros tampoco ayuda: un formulario que lleva toda la pestaña a bank.example es una visita de primera parte, así que las cookies del banco van con ella. Eso es la falsificación de solicitudes entre sitios (cross-site request forgery, CSRF): la solicitud es real, tiene sesión y es falsa a la vez.",
    ),
    watch: w(SETUPS.cors),
  },
  {
    id: "lax",
    title: t("SameSite=Lax", "SameSite=Lax"),
    change: t("Session cookie with SameSite=Lax · the bank still has an old GET /pay?to=… link that moves money · forged errands at random: other.example's hidden form (POST), other.example's link to GET /pay, and a form on forum.bank.example (POST)",
      "Cookie de sesión con SameSite=Lax · el banco todavía tiene un viejo enlace GET /pay?to=… que mueve dinero · encargos falsos al azar: el formulario oculto de other.example (POST), el enlace de other.example a GET /pay y un formulario en forum.bank.example (POST)"),
    question: t("Which of the three forged errands still get paid?", "¿Cuáles de los tres encargos falsos se siguen pagando?"),
    options: [
      t("None: Lax keeps the card off anything another page starts", "Ninguno: Lax deja la tarjeta fuera de todo lo que inicia otra página"),
      t("The link to GET /pay and the forum's form", "El enlace a GET /pay y el formulario del foro"),
      t("Only the forum's form: a link sends no form data to act on", "Solo el formulario del foro: un enlace no envía datos de formulario"),
    ],
    answer: 1,
    why: t(
      "Lax keeps the card off cross-site requests except top-level navigations with a safe method. The hidden form POST from other.example arrived without the card (" + pct(R.lax.formShare) + " paid). A link is a top-level GET, so it carries the card, and an endpoint that moves money on GET pays it (" + pct(R.lax.linkShare) + "). The forum's POST isn't cross-site at all: forum.bank.example and www.bank.example share the registrable domain bank.example, so to SameSite it's the same site (" + pct(R.lax.forumShare) + "). Lax closes the most common hole, a cross-site form POST, and nothing else. Chromium browsers apply Lax to a cookie that sets no SameSite (still sending a cookie set in the last two minutes on cross-site top-level POSTs); Firefox and Safari don't, so set it yourself.",
      "Lax deja la tarjeta fuera de las solicitudes de otro sitio, salvo en navegaciones de nivel superior con un método seguro. El POST del formulario oculto de other.example llegó sin tarjeta (" + pct(R.lax.formShare) + " pagados). Un enlace es un GET de nivel superior, así que lleva la tarjeta, y un endpoint que mueve dinero con GET lo paga (" + pct(R.lax.linkShare) + "). El POST del foro ni siquiera es de otro sitio: forum.bank.example y www.bank.example comparten el dominio registrable bank.example, así que para SameSite son el mismo sitio (" + pct(R.lax.forumShare) + "). Lax cierra el hueco más común, un POST de formulario de otro sitio, y nada más. Los navegadores Chromium aplican Lax a una cookie que no define SameSite (aunque una cookie creada en los últimos dos minutos todavía viaja en los POST de nivel superior de otro sitio); Firefox y Safari no, así que defínelo tú."),
    watch: w(SETUPS.lax),
  },
  {
    id: "strict",
    title: t("Strict, and the forum", "Strict, y el foro"),
    change: t("The forum's form POST only · SameSite=Lax vs SameSite=Strict · the customer also follows links to the bank from other sites (an email, a search result)",
      "Solo el POST de formulario del foro · SameSite=Lax vs SameSite=Strict · el cliente además sigue enlaces al banco desde otros sitios (un correo, un resultado de búsqueda)"),
    question: t("With Strict, how many of the forum's forged POSTs get paid?", "Con Strict, ¿cuántos POST falsos del foro se pagan?"),
    options: [
      t("None: Strict sends the card only from the bank's own pages", "Ninguno: Strict envía la tarjeta solo desde las páginas del banco"),
      t("About half: Strict only adds checks on top of Lax", "Cerca de la mitad: Strict solo agrega controles sobre Lax"),
      t("All of them: the forum is on the same site", "Todos: el foro está en el mismo sitio"),
    ],
    answer: 2,
    why: t(
      "Strict means same site, not same origin. A site is the scheme plus the registrable domain (from the Public Suffix List), so every subdomain of bank.example counts: " + pct(R.strict.strict.forumShare) + " of the forum's POSTs were paid with Strict. A forum with user content, a forgotten subdomain someone took over, or a marketing page on a hosted service can all send the card along. Strict does stop the link to GET /pay, but at a cost: every visit that followed a link from another site arrived signed out (" + pct(R.strict.strict.outShare) + ", against " + pct(R.strict.lax.outShare) + " with Lax), because that navigation started cross-site. Many sites pair a Lax session cookie with a separate Strict cookie for sensitive actions.",
      "Strict significa mismo sitio, no mismo origen. Un sitio es el esquema más el dominio registrable (según la Public Suffix List), así que cuenta cualquier subdominio de bank.example: con Strict se pagó el " + pct(R.strict.strict.forumShare) + " de los POST del foro. Un foro con contenido de usuarios, un subdominio olvidado que alguien tomó o una página de marketing en un servicio alojado pueden hacer que la tarjeta vaya. Strict sí detiene el enlace a GET /pay, pero con un costo: cada visita que siguió un enlace desde otro sitio llegó sin sesión (" + pct(R.strict.strict.outShare) + ", contra " + pct(R.strict.lax.outShare) + " con Lax), porque esa navegación empezó en otro sitio. Muchos sitios combinan una cookie de sesión Lax con otra cookie Strict aparte para las acciones sensibles."),
    watch: w(SETUPS.strict),
  },
  {
    id: "tokens",
    title: t("A token the page must carry", "Un token que la página debe llevar"),
    change: t("SameSite=Strict · the forum's form POST · a plain double-submit token (the form repeats the value of a csrf cookie) vs a token stored with the session on the server · and, for comparison, no token but a same-origin check",
      "SameSite=Strict · el POST de formulario del foro · un token double-submit simple (el formulario repite el valor de una cookie csrf) vs un token guardado con la sesión en el servidor · y, para comparar, sin token pero con comprobación de mismo origen"),
    question: t("With the plain double-submit copy, how many of the forum's forged POSTs get paid?", "Con la copia double-submit simple, ¿cuántos POST falsos del foro se pagan?"),
    options: [
      t("None: the forum can't read the bank's cookies, so it can't copy one", "Ninguno: el foro no puede leer las cookies del banco, así que no puede copiar una"),
      t("All of them: a sibling subdomain can satisfy a plain copy check", "Todos: un subdominio hermano puede cumplir una comprobación de copia simple"),
      t("Only those sent while the customer has the bank's page open", "Solo los enviados mientras el cliente tiene abierta la página del banco"),
    ],
    answer: 1,
    why: t(
      "A plain double-submit check asks whether the form's value equals a cookie's value. It never asks whether the bank chose that value for this session. A sibling subdomain can't read the bank's cookies, but it can write cookies for the whole of bank.example, so it can make the two values agree: " + pct(R.tokens.copy.forumShare) + " paid. A token the server keeps with the session (the synchronizer token pattern) is something only the bank's own pages receive, and the same-origin policy keeps the forum from reading those pages: " + pct(R.tokens.session.forumShare) + ". If you want a stateless token, sign it with a server key and bind it to the session (OWASP's signed double-submit), and name the cookie with the __Host- prefix so subdomains can't set it. A check on Sec-Fetch-Site or Origin that accepts only the bank's own origin stops the forum too (" + pct(R.tokens.origin.forumShare) + "), because the forum is same-site but not same-origin.",
      "Una comprobación double-submit simple pregunta si el valor del formulario es igual al de una cookie. Nunca pregunta si el banco eligió ese valor para esta sesión. Un subdominio hermano no puede leer las cookies del banco, pero sí puede escribir cookies para todo bank.example, así que puede hacer que los dos valores coincidan: " + pct(R.tokens.copy.forumShare) + " pagados. Un token que el servidor guarda con la sesión (el patrón de token sincronizador, synchronizer token) solo lo reciben las páginas del propio banco, y la política del mismo origen (same-origin policy) impide que el foro las lea: " + pct(R.tokens.session.forumShare) + ". Si quieres un token sin estado, fírmalo con una clave del servidor y átalo a la sesión (el double-submit firmado de OWASP), y nombra la cookie con el prefijo __Host- para que los subdominios no puedan fijarla. Una comprobación de Sec-Fetch-Site u Origin que solo acepta el origen del banco también detiene al foro (" + pct(R.tokens.origin.forumShare) + "), porque el foro es del mismo sitio pero no del mismo origen."),
    watch: w(SETUPS.tokens),
  },
  {
    id: "get",
    title: t("Every defence on, and one GET", "Todas las defensas, y un GET"),
    change: t("SameSite=Lax · a session token · a same-origin check · other.example links to GET /pay?to=… · the old GET endpoint still exists vs paying needs a POST",
      "SameSite=Lax · un token de sesión · una comprobación de mismo origen · other.example enlaza a GET /pay?to=… · el viejo endpoint GET todavía existe vs pagar exige un POST"),
    question: t("While the old GET endpoint exists, how many forged links get paid?", "Mientras existe el viejo endpoint GET, ¿cuántos enlaces falsos se pagan?"),
    options: [
      t("None: with three defences on, one of them stops it", "Ninguno: con tres defensas activas, alguna lo detiene"),
      t("Only some: the token gate catches the ones without a token", "Solo algunos: la barrera del token atrapa los que no tienen token"),
      t("All of them: every one of the three lets a GET through", "Todos: las tres defensas dejan pasar un GET"),
    ],
    answer: 2,
    why: t(
      "All three defences are built around one promise: GET, HEAD and OPTIONS don't change anything (RFC 9110 calls them safe methods). Lax sends the card on a top-level GET so links into the bank keep working; CSRF middleware in Django, Rails and most frameworks checks tokens only on unsafe methods; origin checks, such as Go 1.25's http.CrossOriginProtection, let safe methods through. So a GET that moves money passes them all: " + pct(R.get.old.linkShare) + " paid. Once paying needs a POST, the same link only reaches a page that can't pay: " + pct(R.get.postOnly.linkShare) + ". Putting a token in a GET URL is no fix either, since URLs end up in logs, history and Referer headers. Keep state changes on POST, PUT, PATCH and DELETE, and the defences above cover them.",
      "Las tres defensas se apoyan en una promesa: GET, HEAD y OPTIONS no cambian nada (la RFC 9110 los llama métodos seguros). Lax envía la tarjeta en un GET de nivel superior para que los enlaces al banco sigan funcionando; el middleware CSRF de Django, Rails y la mayoría de los frameworks revisa tokens solo en métodos no seguros; las comprobaciones de origen, como http.CrossOriginProtection de Go 1.25, dejan pasar los métodos seguros. Así que un GET que mueve dinero las pasa todas: " + pct(R.get.old.linkShare) + " pagados. Cuando pagar exige un POST, el mismo enlace solo llega a una página que no puede pagar: " + pct(R.get.postOnly.linkShare) + ". Poner un token en una URL GET tampoco arregla nada, porque las URL terminan en logs, en el historial y en encabezados Referer. Deja los cambios de estado en POST, PUT, PATCH y DELETE, y las defensas de arriba los cubren."),
    watch: w(SETUPS.get),
  },
];

const QUESTIONS = [
  [t("In one sentence, why can another site make the bank move money, and what does the bank lack?", "En una oración, ¿por qué otro sitio puede hacer que el banco mueva dinero, y qué le falta al banco?"),
   t("The browser attaches cookies to a request because of where it's going, not which page started it, so a session cookie alone proves who the customer is but not that they meant to send this request. The bank needs a second signal that the request came from its own pages: a cookie that isn't sent cross-site (SameSite), a token only its pages have, or a check on the Origin or Sec-Fetch-Site header.",
     "El navegador adjunta las cookies a una solicitud según a dónde va, no según qué página la inició, así que una cookie de sesión prueba quién es el cliente pero no que quiso enviar esa solicitud. El banco necesita una segunda señal de que la solicitud vino de sus propias páginas: una cookie que no se envía desde otros sitios (SameSite), un token que solo tienen sus páginas o una comprobación del encabezado Origin o Sec-Fetch-Site.")],
  [t("What is the difference between same-site and same-origin, and which subdomains of your company count as the same site?", "¿Qué diferencia hay entre mismo sitio y mismo origen, y qué subdominios de tu empresa cuentan como el mismo sitio?"),
   t("An origin is scheme, host and port: https://www.bank.example and https://forum.bank.example are different origins. A site is the scheme plus the registrable domain, the label just under a public suffix from the Public Suffix List: both are the site https://bank.example. So every subdomain counts, including user-content hosts, staging, a vendor-hosted help center and any dangling DNS record someone could take over. SameSite cookies trust all of them; a same-origin check or a session-bound token doesn't.",
     "Un origen es esquema, host y puerto: https://www.bank.example y https://forum.bank.example son orígenes distintos. Un sitio es el esquema más el dominio registrable, la etiqueta justo debajo de un sufijo público de la Public Suffix List: los dos son el sitio https://bank.example. Así que cuenta cualquier subdominio, incluidos los hosts de contenido de usuarios, staging, un centro de ayuda alojado por un proveedor y cualquier registro DNS colgado que alguien pueda tomar. Las cookies SameSite confían en todos ellos; una comprobación de mismo origen o un token atado a la sesión no.")],
  [t("A teammate says \"we set SameSite=Lax, so CSRF is solved.\" What is still open?", "Alguien del equipo dice \"pusimos SameSite=Lax, así que el CSRF está resuelto\". ¿Qué queda abierto?"),
   t("Anything that changes state on a GET, because Lax still sends the cookie on top-level GET navigations. Anything a same-site page can send: sibling subdomains are trusted. Browsers that don't apply it: it's an attribute the browser enforces, so it only helps where it's set and supported (Chromium defaults unset cookies to Lax, with a two-minute exception for top-level POSTs; Firefox and Safari don't). Keep it as a strong layer, and still check a token or the request's origin for unsafe methods.",
     "Todo lo que cambia estado con un GET, porque Lax sigue enviando la cookie en navegaciones GET de nivel superior. Todo lo que pueda enviar una página del mismo sitio: los subdominios hermanos son de confianza. Los navegadores que no lo aplican: es un atributo que hace cumplir el navegador, así que solo ayuda donde está definido y soportado (Chromium trata como Lax las cookies sin el atributo, con una excepción de dos minutos para los POST de nivel superior; Firefox y Safari no). Mantenlo como una capa fuerte y, aun así, revisa un token o el origen de la solicitud en los métodos no seguros.")],
  [t("Your API takes JSON, authenticates with a bearer token in the Authorization header, and has no cookies. Does it need CSRF protection?", "Tu API recibe JSON, se autentica con un token bearer en el encabezado Authorization y no usa cookies. ¿Necesita protección CSRF?"),
   t("Not for CSRF: the browser never adds an Authorization header on its own, so a page on another site has nothing to borrow, and a script that wanted to set that header would need a CORS preflight your server can refuse. The trade-off moves elsewhere: a token that page script can read can be stolen by cross-site scripting (XSS), and it stays valid until it expires unless you can revoke it (lesson 80, Token Revocation). Once you put that token in a cookie for convenience, you're back to needing CSRF defences.",
     "No por CSRF: el navegador nunca agrega por su cuenta un encabezado Authorization, así que una página de otro sitio no tiene nada que tomar prestado, y un script que quisiera fijar ese encabezado necesitaría una verificación previa (preflight) de CORS que tu servidor puede rechazar. El costo pasa a otro lado: un token que el script de la página puede leer se puede robar con cross-site scripting (XSS), y sigue siendo válido hasta que vence salvo que puedas revocarlo (lección 80, Revocación de tokens). Si después guardas ese token en una cookie por comodidad, vuelves a necesitar defensas contra CSRF.")],
  [t("How does a Fetch Metadata check work, and why can it stand next to tokens or replace them?", "¿Cómo funciona una comprobación con Fetch Metadata, y por qué puede ir junto a los tokens o reemplazarlos?"),
   t("Browsers send Sec-Fetch-Site with every request to an HTTPS (or localhost) origin: same-origin, same-site, cross-site, or none (the user typed the URL or used a bookmark). The server refuses unsafe methods unless the value is same-origin or none, with an allowlist for origins it trusts, and falls back to comparing the Origin header with its own host when Sec-Fetch-Site is missing; Go 1.25's http.CrossOriginProtection works this way. It needs no state or form changes, and every major browser released since early 2023 sends the header. Requests with neither header don't come from a browser, so they can't ride a victim's cookies. A token still helps where old browsers or odd proxies matter, and neither defence survives XSS on your own origin.",
     "Los navegadores envían Sec-Fetch-Site en cada solicitud a un origen HTTPS (o localhost): same-origin, same-site, cross-site o none (el usuario escribió la URL o usó un marcador). El servidor rechaza los métodos no seguros salvo que el valor sea same-origin o none, con una lista de orígenes de confianza, y si falta Sec-Fetch-Site compara el encabezado Origin con su propio host; http.CrossOriginProtection de Go 1.25 funciona así. No necesita estado ni cambios en los formularios, y todos los navegadores principales publicados desde comienzos de 2023 envían el encabezado. Las solicitudes sin ninguno de los dos encabezados no vienen de un navegador, así que no pueden usar las cookies de una víctima. Un token sigue sirviendo donde importan navegadores viejos o proxies raros, y ninguna de las dos defensas resiste un XSS en tu propio origen.")],
  [t("You inherit an app with a plain double-submit CSRF cookie. What would you change, and why?", "Heredas una app con una cookie CSRF double-submit simple. ¿Qué cambiarías y por qué?"),
   t("A plain copy only proves the sender can make a cookie and a form field agree, and any sibling subdomain can write cookies for the parent domain. Bind the token to the session: either store it server-side (synchronizer token) or sign it with a server key over the session id (signed double-submit). Give the cookie the __Host- prefix, which requires Secure, Path=/ and no Domain attribute, so subdomains can't set it. Add a Sec-Fetch-Site or Origin check for unsafe methods, and keep state changes off GET.",
     "Una copia simple solo prueba que quien envía puede hacer que coincidan una cookie y un campo del formulario, y cualquier subdominio hermano puede escribir cookies para el dominio padre. Ata el token a la sesión: guárdalo en el servidor (token sincronizador) o fírmalo con una clave del servidor junto con el id de sesión (double-submit firmado). Ponle a la cookie el prefijo __Host-, que exige Secure, Path=/ y ningún atributo Domain, para que los subdominios no puedan fijarla. Agrega una comprobación de Sec-Fetch-Site u Origin en los métodos no seguros, y deja los cambios de estado fuera de GET.")],
];

export default defineLesson({
  title: t("CSRF & SameSite Workbench", "Banco de trabajo: CSRF y SameSite"),
  eyebrow: t("Systems lesson 82 · CSRF & SameSite", "Lección de sistemas 82 · CSRF y SameSite"),
  lede: t("A browser sends a site's cookies with every request to that site, whichever page asked for it, so a page on another site can make a signed-in customer's browser submit a real, authenticated request. This lesson turns it into a bank street where the browser is a courier carrying the customer's ID card: watch SameSite, CSRF tokens and origin checks each close part of the gap, predict what still gets through, then explain it back.",
    "Un navegador envía las cookies de un sitio en cada solicitud a ese sitio, sin importar qué página la pidió, así que una página de otro sitio puede hacer que el navegador de un cliente con sesión envíe una solicitud real y autenticada. Esta lección lo convierte en una calle con un banco donde el navegador es un mensajero que lleva la tarjeta de identidad del cliente: mira cómo SameSite, los tokens CSRF y las comprobaciones de origen cierran cada uno parte del hueco, predice qué sigue pasando y después explícalo."),
  machine: {
    intro: t("Three pages are open in the customer's browser: the bank's own page, a forum on a subdomain of the bank, and another site. Each errand a page asks for, the courier carries down the road. At the cookie jar it takes the customer's card if the cookie's SameSite rule allows; then the bank's gates check the card, where the request came from, and the CSRF token. The hostile pages send forged errands on their own; send more, or follow a link to the bank as the customer.",
      "Hay tres páginas abiertas en el navegador del cliente: la propia página del banco, un foro en un subdominio del banco y otro sitio. Cada encargo que pide una página, el mensajero lo lleva por la calle. En el frasco de cookies toma la tarjeta del cliente si la regla SameSite de la cookie lo permite; después las barreras del banco revisan la tarjeta, de dónde vino la solicitud y el token CSRF. Las páginas hostiles envían encargos falsos por su cuenta; envía más, o sigue un enlace al banco como el cliente."),
    plate: {
      title: t("Bank street", "Calle del banco"),
      keys: [
        { mark: "lit", label: t("The customer's ID card (the session cookie), a gate that refuses, the teller paying a forged errand", "La tarjeta del cliente (la cookie de sesión), una barrera que rechaza, el cajero pagando un encargo falso") },
        { mark: "raised", label: t("Couriers: the browser running each errand, POST or GET", "Mensajeros: el navegador haciendo cada encargo, POST o GET") },
        { mark: "flat", label: t("The road from the pages to the bank's window", "La calle de las páginas a la ventanilla del banco") },
      ],
      caption: t(
        "Hosts: www.bank.example (the bank and its page), forum.bank.example (same site, other origin), other.example (cross-site). Every request here is a top-level navigation: a form submit or a followed link. The customer sends their own transfers from the bank's page, with its token, and now and then follows a link to the bank from another site. Gates check only unsafe methods except CARD, which every request needs. Counters: forged errands the bank paid (FORGED PAID), errands refused at a gate or the window (BLOCKED), and the customer's link visits that arrived without the card (SIGNED OUT). Rates are illustrative.",
        "Hosts: www.bank.example (el banco y su página), forum.bank.example (mismo sitio, otro origen), other.example (otro sitio). Cada solicitud aquí es una navegación de nivel superior: el envío de un formulario o un enlace seguido. El cliente envía sus propias transferencias desde la página del banco, con su token, y de vez en cuando sigue un enlace al banco desde otro sitio. Las barreras revisan solo los métodos no seguros, salvo TARJETA, que toda solicitud necesita. Contadores: encargos falsos que el banco pagó (FALSAS PAGADAS), encargos rechazados en una barrera o en la ventanilla (BLOQUEADAS) y visitas del cliente por enlace que llegaron sin la tarjeta (SIN SESIÓN). Las tasas son ilustrativas.",
      ),
      stage: { "data-bank-street": "" },
      label: t("CSRF simulation. Space pauses or resumes.", "Simulación de CSRF. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["sent", t("Forged sent", "Falsas enviadas")],
      ["paid", t("Forged paid", "Falsas pagadas")],
      ["blocked", t("Blocked", "Bloqueadas")],
      ["ok", t("Customer OK", "Cliente OK")],
      ["signedout", t("Signed out", "Sin sesión")],
    ],
    controls: [
      { seg: "samesite", label: "SameSite", options: [["none", "None"], ["lax", "Lax"], ["strict", "Strict"]], value: "lax" },
      { seg: "token", label: t("CSRF token", "Token CSRF"), options: [["off", t("Off", "Apagado")], ["copy", t("Cookie copy", "Copia en cookie")], ["session", t("Session", "De sesión")]], value: "off" },
      { seg: "origin", label: t("Origin check", "Comprobar origen"), options: [["off", t("Off", "Apagada")], ["site", t("Same site", "Mismo sitio")], ["origin", t("Same origin", "Mismo origen")]], value: "off" },
      { seg: "getpay", label: t("GET /pay", "GET /pay"), options: [["on", t("Old link works", "Enlace viejo activo")], ["off", t("POST only", "Solo POST")]], value: "on" },
      { seg: "errand", label: t("Forged errand", "Encargo falso"), options: [["form", t("Form POST", "Formulario POST")], ["link", t("Link GET", "Enlace GET")], ["forum", t("Forum POST", "POST del foro")], ["mix", t("All three", "Los tres")]], value: "mix" },
      { speed: true },
      { actions: [["forge", t("Send a forged errand", "Enviar un encargo falso"), { primary: true }], ["visit", t("Follow a link to the bank", "Seguir un enlace al banco")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Same site lets the forum through and refuses other.example; Same origin accepts only www.bank.example. Cookie copy is a plain double-submit token; Session is a token the server keeps with the session.",
      "Cambiar un ajuste reinicia la ejecución. Mismo sitio deja pasar al foro y rechaza other.example; Mismo origen acepta solo www.bank.example. Copia en cookie es un token double-submit simple; De sesión es un token que el servidor guarda con la sesión."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of " + MIN + " minutes each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de " + MIN + " minutos cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The defences follow the OWASP Cross-Site Request Forgery Prevention Cheat Sheet; SameSite as browsers implement it today.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Las defensas siguen la OWASP Cross-Site Request Forgery Prevention Cheat Sheet; SameSite como lo implementan hoy los navegadores.`),
  css: LIT_FILL_CSS + `
[data-method]{font-weight:600}
`,
  data: { P, G: GEOMETRY, COURIER_SVG: courierSvg(), CARD_SVG: cardSvg() },
});
