// @ts-nocheck: content in the style of the other lessons
// Systems lesson 83 · SQL injection: a records room where pasted words can turn into SQL, and how to keep them data.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { one, n0, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, visitorSvg, P, GEOMETRY } from "./figure";
import { aposRun, classicRun, escapeRun, sortRun, accountRun, REQUESTS, TABLE, ATTACK, TAMPER } from "./sim";
const A6 = String(ATTACK), T6 = String(TAMPER);

// Experiment results, computed at build time from the same model the page runs (eight seeded runs of 120 requests).
const R = { apos: aposRun(), classic: classicRun(), escape: escapeRun(), sort: sortRun(), account: accountRun() };
const per = (a, b) => (b ? a / b : 0);
const N = String(REQUESTS);

// What each card shows after a run.
const RUNS = {
  apos: () => {
    const { paste } = R.apos;
    const aposFail = per(paste.aposErr, paste.apos), plainFail = per(paste.plainErr, paste.plain);
    return {
      verdict: t("Pasted in: " + one(paste.errors) + " of the " + N + " requests failed with a syntax error, on average. Every lookup for O'Neil or D'Souza failed (" + pct(aposFail) + "); the lookups for the other four customers failed " + pct(plainFail) + " of the time and each got its " + TABLE.perCustomer + " orders.",
        "Pegado: " + one(paste.errors) + " de las " + N + " solicitudes fallaron con un error de sintaxis, en promedio. Fallaron todas las búsquedas de O'Neil o D'Souza (" + pct(aposFail) + "); las de los otros cuatro clientes fallaron el " + pct(plainFail) + " de las veces y cada una recibió sus " + TABLE.perCustomer + " pedidos."),
      bars: [[t("Failed, O'Neil and D'Souza", "Fallidas, O'Neil y D'Souza"), aposFail, pct(aposFail), true], [t("Failed, the other customers", "Fallidas, los otros clientes"), plainFail, pct(plainFail)]],
    };
  },
  classic: () => {
    const { paste, param } = R.classic;
    const pr = per(paste.attackRows, paste.attacks), pl = per(paste.attackLeak, paste.attacks), qr = per(param.attackRows, param.attacks);
    const top = TABLE.rows;
    return {
      verdict: t("Pasted in: each ' OR '1'='1 request got " + n0(pr) + " rows" + (pr === TABLE.rows ? ", the whole table, " : ", ") + n0(pl) + " of them from other shops. As a parameter it got " + n0(qr) + " rows. Syntax errors per " + N + " requests: " + one(paste.errors) + " pasted in, " + one(param.errors) + " with parameters.",
        "Pegado: cada solicitud con ' OR '1'='1 recibió " + n0(pr) + " filas" + (pr === TABLE.rows ? ", la tabla entera, " : ", ") + n0(pl) + " de ellas de otras tiendas. Como parámetro recibió " + n0(qr) + " filas. Errores de sintaxis cada " + N + " solicitudes: " + one(paste.errors) + " pegando, " + one(param.errors) + " con parámetros."),
      bars: [[t("Rows per attack, pasted in", "Filas por ataque, pegado"), pr / top, n0(pr), true], [t("Other shops' rows per attack, pasted in", "Filas de otras tiendas por ataque, pegado"), pl / top, n0(pl), true], [t("Rows per attack, parameter", "Filas por ataque, parámetro"), qr / top, n0(qr)]],
    };
  },
  escape: () => {
    const { escape, param, same } = R.escape;
    const er = per(escape.attackRows, escape.attacks);
    if (escape.aposErr || escape.errors) throw new Error("injection: the escape verdict says the apostrophe names worked");
    const top = Math.max(escape.texts, param.texts);
    return {
      verdict: t("Quotes escaped: each attack got " + n0(er) + " rows, O'Neil and D'Souza got their orders, and " + pct(same) + " of the requests got the same rows as with parameters. The difference was elsewhere: in a run of " + N + " requests the database parsed about " + n0(escape.texts) + " different statement texts with escaping, " + n0(param.texts) + " with parameters.",
        "Comillas escapadas: cada ataque recibió " + n0(er) + " filas, O'Neil y D'Souza recibieron sus pedidos, y el " + pct(same) + " de las solicitudes recibió las mismas filas que con parámetros. La diferencia estuvo en otro lado: en una ejecución de " + N + " solicitudes la base de datos analizó unos " + n0(escape.texts) + " textos de sentencia distintos con escape y " + n0(param.texts) + " con parámetros."),
      bars: [[t("Same rows as parameters", "Mismas filas que con parámetros"), same, pct(same), true], [t("Statement texts, quotes escaped", "Textos de sentencia, comillas escapadas"), escape.texts / top, n0(escape.texts)], [t("Statement texts, parameters", "Textos de sentencia, parámetros"), param.texts / top, n0(param.texts)]],
    };
  },
  sort: () => {
    const { escape, param, allow } = R.sort;
    const code = per(escape.tamperCode, escape.tampered), un = (x) => per(x.honestUnsorted, x.honestLists), rej = per(allow.tamperRejected, allow.tampered);
    if (un(allow) || rej < 1) throw new Error("injection: the sort why says the allowlist sorted every list and refused every edited one");
    return {
      verdict: t("Quotes escaped: every list was sorted, and " + pct(code) + " of the edited requests put cost into the statement untouched. Parameter: " + pct(un(param)) + " of the lists came back in storage order instead of the order asked. Allowlist: " + pct(un(allow)) + " unsorted, and " + pct(rej) + " of the edited requests refused.",
        "Comillas escapadas: todas las listas salieron ordenadas, y el " + pct(code) + " de las solicitudes editadas metió cost en la sentencia sin cambios. Parámetro: el " + pct(un(param)) + " de las listas volvió en el orden guardado en lugar del pedido. Lista permitida: " + pct(un(allow)) + " sin orden, y el " + pct(rej) + " de las solicitudes editadas rechazado."),
      groups: [
        { title: t("Lists not in the order asked", "Listas fuera del orden pedido"), bars: [[t("Quotes escaped", "Comillas escapadas"), un(escape), pct(un(escape))], [t("Parameter", "Parámetro"), un(param), pct(un(param)), true], [t("Allowlist", "Lista permitida"), un(allow), pct(un(allow))]] },
        { title: t("Edited sort values that reached the statement", "Órdenes editados que llegaron a la sentencia"), bars: [[t("Quotes escaped", "Comillas escapadas"), code, pct(code), true], [t("Parameter", "Parámetro"), per(param.tamperCode, param.tampered), pct(per(param.tamperCode, param.tampered))], [t("Allowlist", "Lista permitida"), per(allow.tamperCode, allow.tampered), pct(per(allow.tamperCode, allow.tampered))]] },
      ],
    };
  },
  account: () => {
    const { full, rls } = R.account;
    const fl = per(full.attackLeak, full.attacks), rl = per(rls.attackLeak, rls.attacks), rr = per(rls.attackRows, rls.attacks);
    if (full.attackCode !== rls.attackCode) throw new Error("injection: the account verdict says both runs rewrote the same statements");
    const top = TABLE.rows;
    return {
      verdict: t("Every shop visible: each attack got " + n0(per(full.attackRows, full.attacks)) + " rows, " + n0(fl) + " from other shops. Row policy: " + n0(rr) + " rows, all of the attacker's own shop, " + n0(rl) + " from others. The statements were rewritten just the same: " + one(rls.attackCode) + " requests per " + N + " turned words into code, with or without the policy.",
        "Todas las tiendas visibles: cada ataque recibió " + n0(per(full.attackRows, full.attacks)) + " filas, " + n0(fl) + " de otras tiendas. Política de filas: " + n0(rr) + " filas, todas de la tienda del atacante, " + n0(rl) + " de otras. Las sentencias se reescribieron igual: en " + one(rls.attackCode) + " solicitudes de cada " + N + " las palabras se volvieron código, con o sin la política."),
      bars: [[t("Other shops' rows per attack, every shop visible", "Filas de otras tiendas por ataque, todas visibles"), fl / top, n0(fl), true], [t("Other shops' rows per attack, row policy", "Filas de otras tiendas por ataque, política de filas"), rl / top, n0(rl)], [t("Rows per attack, row policy", "Filas por ataque, política de filas"), rr / top, n0(rr)]],
    };
  },
};

const EXPERIMENTS = [
  {
    id: "apos",
    title: t("A customer called O'Neil", "Una clienta llamada O'Neil"),
    change: t("Name box: pasted in · ordinary customers only, two of the six with an apostrophe in their name (O'Neil, D'Souza) · " + N + " requests",
      "Casilla del nombre: pegado · solo clientes comunes, dos de los seis con un apóstrofo en el nombre (O'Neil, D'Souza) · " + N + " solicitudes"),
    question: t("What happens to the lookups for O'Neil and D'Souza?", "¿Qué pasa con las búsquedas de O'Neil y D'Souza?"),
    options: [
      t("They work: an apostrophe is just a letter in the name", "Funcionan: un apóstrofo es solo una letra del nombre"),
      t("They fail: the database refuses the statement", "Fallan: la base de datos rechaza la sentencia"),
      t("They come back with another customer's orders", "Vuelven con los pedidos de otro cliente"),
    ],
    answer: 1,
    why: t(
      "The statement is text, and the app pasted the name between its two quotes: name = 'O'Neil'. The parser reads 'O' as the whole string, then the stray word Neil, then a quote that never closes, so it refuses the statement. Nobody attacked anything: real names break a query built by pasting, which is why the bug often shows up first as a support ticket from a customer with an apostrophe in their name. The error is also the warning sign. If a character in the input can end the string, what comes after it is read as SQL.",
      "La sentencia es texto, y la app pegó el nombre entre sus dos comillas: name = 'O'Neil'. El analizador lee 'O' como el texto completo, después la palabra suelta Neil y luego una comilla que nunca se cierra, así que rechaza la sentencia. Nadie atacó nada: los nombres reales rompen una consulta armada pegando, por eso el bug suele aparecer primero como un reclamo de un cliente con un apóstrofo en el nombre. El error también es la señal de alarma. Si un carácter de la entrada puede cerrar el texto, lo que viene después se lee como SQL.",
    ),
    watch: { name: "paste", sort: "allow", account: "full", attack: "0", tamper: "0", force: "apos" },
  },
  {
    id: "classic",
    title: t("The textbook input", "La entrada de manual"),
    change: t("1 request in 6 types ' OR '1'='1 into the name box · pasted in vs sent as a parameter ($2)", "1 de cada 6 solicitudes escribe ' OR '1'='1 en la casilla del nombre · pegado vs enviado como parámetro ($2)"),
    question: t("Pasted in, what does that request get back?", "Pegado, ¿qué recibe esa solicitud?"),
    options: [
      t("A syntax error, like the lookup for O'Neil", "Un error de sintaxis, como la búsqueda de O'Neil"),
      t("No rows at all: no customer has that name", "Ninguna fila: ningún cliente tiene ese nombre"),
      t("Every row in the table, all three shops", "Todas las filas de la tabla, de las tres tiendas"),
    ],
    answer: 2,
    why: t(
      "Pasted in, the line reads name = '' OR '1'='1'. The input's first quote closes the string the app opened, OR '1'='1' becomes a condition, and the app's own closing quote completes the last string, so the statement is valid this time. AND binds tighter than OR, so the WHERE clause is (shop = 'A' AND name = '') OR '1'='1', true for every row, the other shops' included. With a parameter, the statement reaches the database with $2 in it and is parsed before any value is looked at. The value only fills that slot: the column is compared with the whole text, quotes and all, and nobody has that name. The apostrophe names work for the same reason.",
      "Pegado, la línea dice name = '' OR '1'='1'. La primera comilla de la entrada cierra el texto que abrió la app, OR '1'='1' se vuelve una condición y la comilla de cierre de la propia app completa el último texto, así que esta vez la sentencia es válida. AND tiene más precedencia que OR, así que el WHERE queda (shop = 'A' AND name = '') OR '1'='1', verdadero para todas las filas, también las de otras tiendas. Con un parámetro, la sentencia llega a la base de datos con $2 adentro y se analiza antes de mirar ningún valor. El valor solo llena esa casilla: la columna se compara con el texto entero, comillas incluidas, y nadie se llama así. Los nombres con apóstrofo funcionan por la misma razón.",
    ),
    watch: { name: "paste", sort: "allow", account: "full", attack: A6, tamper: "0", force: "attack" },
  },
  {
    id: "escape",
    title: t("Double the quotes instead", "Duplicar las comillas"),
    change: t("Same requests, ' OR '1'='1 in 1 in 6 · name box: quotes escaped (each ' written as '') vs a parameter", "Las mismas solicitudes, ' OR '1'='1 en 1 de cada 6 · casilla del nombre: comillas escapadas (cada ' escrita como '') vs un parámetro"),
    question: t("With the quotes escaped, how do O'Neil and the attacker do?", "Con las comillas escapadas, ¿cómo les va a O'Neil y al atacante?"),
    options: [
      t("Like parameters: O'Neil gets her orders, the attack none", "Como con parámetros: O'Neil recibe sus pedidos; el ataque, nada"),
      t("O'Neil gets her orders; the attack still gets every row", "O'Neil recibe sus pedidos; el ataque igual recibe todas las filas"),
      t("Both fail: the doubled quotes break the whole statement", "Ambos fallan: las comillas duplicadas rompen toda la sentencia"),
    ],
    answer: 0,
    why: t(
      "Inside a quoted string, '' means one quote character, so the escaped input stays one string: the database looks for a customer whose name is that odd text, and finds none. In this spot escaping holds. The catch is everything around it. It only protects text that sits between quotes, so a number or a column name pasted without quotes has nothing to escape (the next experiment). It depends on the exact rules of that database and its settings: MySQL, by default, also reads a backslash as an escape, so doubling quotes alone isn't enough there. And it has to be remembered at every place a query is built. OWASP's cheat sheet calls escaping fragile and strongly discourages it. With parameters the value never passes through the SQL text at all. A side effect: the database saw far fewer distinct statements, so it can parse and plan each one once and reuse it.",
      "Dentro de un texto entre comillas, '' significa una comilla, así que la entrada escapada queda como un solo texto: la base de datos busca un cliente con ese nombre raro y no encuentra ninguno. En este lugar el escape funciona. El problema es todo lo demás. Solo protege texto que está entre comillas, así que un número o un nombre de columna pegado sin comillas no tiene nada que escapar (el próximo experimento). Depende de las reglas exactas de esa base de datos y su configuración: MySQL, por defecto, también lee la barra invertida como escape, así que duplicar comillas no basta ahí. Y hay que acordarse de hacerlo en cada lugar donde se arma una consulta. La guía de OWASP (cheat sheet) dice que escapar es frágil y lo desaconseja con fuerza. Con parámetros el valor nunca pasa por el texto SQL. Un efecto secundario: la base de datos vio muchas menos sentencias distintas, así que puede analizar y planificar cada una una vez y reutilizarla.",
    ),
    watch: { name: "escape", sort: "allow", account: "full", attack: A6, tamper: "0", force: "attack" },
  },
  {
    id: "sort",
    title: t("The sort column", "La columna de orden"),
    change: t("Name box: parameter · 1 request in 6 has its sort value edited to cost, a column the page doesn't offer · sort box: quotes escaped vs a parameter ($3) vs an allowlist of day, total and item",
      "Casilla del nombre: parámetro · 1 de cada 6 solicitudes trae el orden editado a cost, una columna que la página no ofrece · casilla del orden: comillas escapadas vs un parámetro ($3) vs una lista permitida (allowlist) de day, total e item"),
    question: t("With the sort column sent as a parameter, like the name, what comes back?", "Con la columna de orden enviada como parámetro, igual que el nombre, ¿qué vuelve?"),
    options: [
      t("Lists sorted as asked, with cost safely ignored", "Listas ordenadas como se pidió, y cost ignorado sin riesgo"),
      t("Lists in storage order: it sorts by a constant", "Listas en el orden guardado: ordena por una constante"),
      t("Lists sorted as asked, but cost sorts too", "Listas ordenadas como se pidió, pero cost también ordena"),
    ],
    answer: 1,
    why: t(
      "A parameter is a value, never a name. ORDER BY $3 sorts every row by the same text, 'day', so the rows come back in whatever order the scan found them (PostgreSQL treats a typed parameter as a constant; an untyped one is refused as of unknown type). Escaping doesn't help either: a column name has no quotes, so cost went into the statement untouched and sorted the list by a column the page never shows. ORDER BY accepts any expression, so text pasted there is as open as the WHERE clause. The fix for identifiers (columns, tables, directions) is an allowlist: map the request to one of a few names written in the code, and refuse anything else. Here it sorted every list and refused every edited one.",
      "Un parámetro es un valor, nunca un nombre. ORDER BY $3 ordena todas las filas por el mismo texto, 'day', así que vuelven en el orden en que las encontró el recorrido (PostgreSQL trata un parámetro con tipo como una constante; uno sin tipo lo rechaza por no poder deducir su tipo). Escapar tampoco ayuda: un nombre de columna no lleva comillas, así que cost entró a la sentencia sin cambios y ordenó la lista por una columna que la página nunca muestra. ORDER BY acepta cualquier expresión, así que el texto pegado ahí queda tan expuesto como el WHERE. La solución para los identificadores (columnas, tablas, sentidos de orden) es una lista permitida (allowlist): asocia lo pedido con uno de unos pocos nombres escritos en el código y rechaza todo lo demás. Aquí ordenó todas las listas y rechazó todas las editadas.",
    ),
    watch: { name: "param", sort: "param", account: "full", attack: "0", tamper: T6, force: "sort" },
  },
  {
    id: "account",
    title: t("Limit what the account can see", "Limitar lo que ve la cuenta"),
    change: t("Name box: pasted in, the hole left open · ' OR '1'='1 in 1 in 6 · the app's database account sees every shop vs a row policy that shows it only the signed-in shop's rows",
      "Casilla del nombre: pegado, el hueco sigue abierto · ' OR '1'='1 en 1 de cada 6 · la cuenta de la app en la base de datos ve todas las tiendas vs una política de filas que solo le muestra las de la tienda que inició sesión"),
    question: t("With the row policy on, what does the attack get?", "Con la política de filas activa, ¿qué recibe el ataque?"),
    options: [
      t("Still every row: the statement says OR '1'='1'", "Igual todas las filas: la sentencia dice OR '1'='1'"),
      t("Every row of the attacker's own shop, and no more", "Todas las filas de la tienda del atacante, y nada más"),
      t("An error: the policy refuses a statement like that", "Un error: la política rechaza una sentencia así"),
    ],
    answer: 1,
    why: t(
      "The injection works exactly as before: the statement is rewritten and the condition is true for every row. But the database applies the policy to every query from that account, whatever its WHERE clause says, so the most it can reach is the signed-in shop's rows. That is least privilege: the account gets only what the app needs, so a hole leaks less. In PostgreSQL a row policy is row-level security, and the table's owner skips it unless the table is set to FORCE ROW LEVEL SECURITY, so the app should connect as a role that doesn't own the tables. The policy must rest on something the injected SQL can't change: a session setting that any statement can overwrite isn't enough. The same idea covers the rest of the damage: an account with read-only grants can't change or drop anything. It limits the damage; it doesn't close the hole.",
      "La inyección funciona igual que antes: la sentencia se reescribe y la condición es verdadera para todas las filas. Pero la base de datos aplica la política a toda consulta de esa cuenta, diga lo que diga su WHERE, así que lo máximo que alcanza son las filas de la tienda que inició sesión. Eso es mínimo privilegio (least privilege): la cuenta tiene solo lo que la app necesita, así que un hueco filtra menos. En PostgreSQL una política de filas es la seguridad a nivel de fila (row-level security), y el dueño de la tabla se la salta salvo que la tabla tenga FORCE ROW LEVEL SECURITY, así que la app debería conectarse con un rol que no sea dueño de las tablas. La política tiene que basarse en algo que el SQL inyectado no pueda cambiar: una variable de sesión que cualquier sentencia puede sobrescribir no alcanza. La misma idea cubre el resto del daño: una cuenta con permisos de solo lectura no puede cambiar ni borrar nada. Limita el daño; no cierra el hueco.",
    ),
    watch: { name: "paste", sort: "allow", account: "rls", attack: A6, tamper: "0", force: "attack" },
  },
];

const QUESTIONS = [
  [t("Why do parameters stop injection, when escaping only stops it most of the time?", "¿Por qué los parámetros frenan la inyección, si escapar solo la frena casi siempre?"),
    t("With a parameterized query the statement and the values travel separately: the database parses the statement, with its placeholders, before it looks at any value, so a value can only ever be data in the slot it fills. Escaping keeps data and code in one string and relies on getting every quoting rule right, in every place, for every type. Some drivers fill placeholders on the client instead of sending them separately; that is still safe as long as the driver does it, because the driver owns the quoting rules for every type, and your code never builds SQL text.",
      "Con una consulta con parámetros, la sentencia y los valores viajan por separado: la base de datos analiza la sentencia, con sus marcadores, antes de mirar ningún valor, así que un valor solo puede ser un dato en la casilla que llena. Escapar deja datos y código en un mismo texto y depende de acertar con cada regla de comillas, en cada lugar y para cada tipo. Algunos drivers llenan los marcadores del lado del cliente en lugar de mandarlos aparte; eso sigue siendo seguro mientras lo haga el driver, porque el driver conoce las reglas de comillas de cada tipo, y tu código nunca arma texto SQL.")],
  [t("You use an ORM. Can you still be injected?", "Usas un ORM. ¿Te pueden inyectar igual?"),
    t("Yes, wherever you hand it text. Its query builder binds values for you, but raw-SQL helpers, string-built WHERE fragments, ORDER BY from a request and string formatting before the call are concatenation again. In Python with psycopg, cursor.execute(\"... WHERE name = %s\", (name,)) binds the value; cursor.execute(\"... WHERE name = '%s'\" % name) pastes it, though the two look alike. Stored procedures are the same: safe when they take parameters, unsafe when they build dynamic SQL inside from their arguments.",
      "Sí, donde le pases texto. Su generador de consultas enlaza los valores por ti, pero los helpers de SQL crudo, los fragmentos de WHERE armados con texto, el ORDER BY sacado de la solicitud y el formateo de texto antes de la llamada vuelven a ser concatenación. En Python con psycopg, cursor.execute(\"... WHERE name = %s\", (name,)) enlaza el valor; cursor.execute(\"... WHERE name = '%s'\" % name) lo pega, aunque se parezcan. Los procedimientos almacenados (stored procedures) son igual: seguros si reciben parámetros, inseguros si adentro arman SQL dinámico con sus argumentos.")],
  [t("A list page lets the user choose the sort column and direction. How do you build that query?", "Una página de lista deja que el usuario elija la columna y el sentido de orden. ¿Cómo armas esa consulta?"),
    t("Identifiers and keywords can't be parameters: a bound value in ORDER BY is a constant. Keep a map in the code from what the page offers to fixed column names (date → created_at, total → total_cents) and from a direction flag to ASC or DESC, and refuse anything that isn't in it. Quoting an identifier (quote_ident, format('%I') in PostgreSQL) stops it from breaking out, but it still lets the user pick any column, hidden ones included; the allowlist decides which.",
      "Los identificadores y las palabras clave no pueden ser parámetros: un valor enlazado en ORDER BY es una constante. Ten en el código un mapa de lo que ofrece la página a nombres de columna fijos (fecha → created_at, total → total_cents) y de una marca de sentido a ASC o DESC, y rechaza todo lo que no esté ahí. Poner comillas a un identificador (quote_ident, format('%I') en PostgreSQL) evita que se escape, pero igual deja elegir cualquier columna, también las ocultas; la lista permitida decide cuáles.")],
  [t("An id comes from the URL, /orders?id=42, and the code pastes it into WHERE id = …. Is escaping quotes enough?", "Un id llega en la URL, /orders?id=42, y el código lo pega en WHERE id = …. ¿Alcanza con escapar comillas?"),
    t("No. A number is pasted without quotes around it, so there is no string to stay inside: the input doesn't need a quote to add words of its own, and escaping quotes changes nothing. Bind it as a parameter, and parse it as an integer first, so a bad id is a 400 and not a query. Type checks and input validation are a useful second layer, not the fix: OWASP lists allowlist validation as a defence in its own right only where a parameter can't be used.",
      "No. Un número se pega sin comillas alrededor, así que no hay texto del que no salir: la entrada no necesita una comilla para agregar palabras propias, y escapar comillas no cambia nada. Enlázalo como parámetro, y conviértelo antes a entero, para que un id malo sea un 400 y no una consulta. Revisar tipos y validar la entrada sirve como segunda capa, no como solución: OWASP pone la validación con lista permitida como defensa propia solo donde no se puede usar un parámetro.")],
  [t("A name was saved with a parameterized INSERT. Months later a report job reads it back and pastes it into another query. What happens?", "Un nombre se guardó con un INSERT con parámetros. Meses después un proceso de reportes lo lee y lo pega en otra consulta. ¿Qué pasa?"),
    t("The same injection, later: second-order injection. The parameter kept the name from being code when it was stored; it is still whatever the user typed, and any later query that pastes it turns it into SQL then. Data from your own database isn't trusted input just because it is yours. Every query that builds SQL text from a value is a place to bind it, whatever the value's origin.",
      "La misma inyección, más tarde: inyección de segundo orden (second-order injection). El parámetro evitó que el nombre fuera código al guardarlo; sigue siendo lo que escribió el usuario, y cualquier consulta posterior que lo pegue lo convierte en SQL en ese momento. Los datos de tu propia base no son confiables por ser tuyos. Cada consulta que arma texto SQL con un valor es un lugar donde enlazarlo, venga de donde venga el valor.")],
  [t("If you already use parameters everywhere, why also limit the database account?", "Si ya usas parámetros en todos lados, ¿para qué limitar también la cuenta de la base de datos?"),
    t("Because \"everywhere\" is a claim about all the code, including the next change, a raw query in a migration script or a reporting endpoint someone adds in a hurry. Least privilege decides how bad the miss is: an app account with no admin rights, read-only where reads are all it does, grants on the tables or views it needs, a separate account per application, and row policies where tenants share tables. It turns \"the whole database\" into \"what this account could already see\".",
      "Porque \"en todos lados\" es una afirmación sobre todo el código, incluido el próximo cambio, una consulta cruda en un script de migración o un endpoint de reportes que alguien agrega con apuro. El mínimo privilegio decide qué tan grave es el descuido: una cuenta de la app sin permisos de administrador, de solo lectura donde solo lee, con permisos sobre las tablas o vistas que necesita, una cuenta aparte por aplicación, y políticas de filas donde los clientes comparten tablas. Convierte \"toda la base de datos\" en \"lo que esta cuenta ya podía ver\".")],
];

export default defineLesson({
  title: t("SQL Injection Workbench", "Banco de trabajo: inyección SQL"),
  eyebrow: t("Systems lesson 83 · SQL injection", "Lección de sistemas 83 · Inyección SQL"),
  lede: t("SQL injection happens when a program pastes what a user typed into the text of a query, so a quote in the input can end the data and start code. Parameters keep the words out of the statement, an allowlist picks column names, and a narrow database account limits what a miss can reach. This lesson runs a records room that builds its queries three ways: watch a machine do it, predict what breaks it, then explain it back.",
    "La inyección SQL ocurre cuando un programa pega lo que escribió el usuario en el texto de una consulta, así que una comilla en la entrada puede terminar el dato y empezar código. Los parámetros dejan las palabras fuera de la sentencia, una lista permitida (allowlist) elige los nombres de columna y una cuenta de base de datos acotada limita lo que alcanza un descuido. Esta lección usa una sala de archivo que arma sus consultas de tres formas: mira cómo lo hace una máquina, predice qué la rompe y después explícalo."),
  machine: {
    intro: t("Shop staff come to the window one at a time and look up a customer's orders by name, sorted by a column they pick. The clerk turns each request into a statement on the big board, the database runs it against the orders cabinet, and the rows it returns slide out and are laid in the tray in the order they came back. Change how the name and the sort column reach the statement, send the textbook input or a name with an apostrophe, edit the sort value, and narrow what the app's database account can see. The SQL engine is real enough to be honest: it tokenizes, parses and runs exactly the text on the board.",
      "Empleados de las tiendas llegan a la ventanilla uno a la vez y buscan los pedidos de un cliente por nombre, ordenados por una columna que eligen. El empleado de la sala convierte cada solicitud en una sentencia en el tablero grande, la base de datos la ejecuta contra el mueble de pedidos, y las filas que devuelve salen y se ponen en la bandeja en el orden en que volvieron. Cambia cómo llegan el nombre y la columna de orden a la sentencia, envía la entrada de manual o un nombre con apóstrofo, edita el orden y acota lo que ve la cuenta de la app en la base de datos. El motor SQL es lo bastante real como para ser honesto: separa en tokens, analiza y ejecuta exactamente el texto del tablero."),
    plate: {
      title: t("Records room", "Sala de archivo"),
      keys: [
        { mark: "lit", label: t("The visitor's words: on a strip in the statement when pasted, in a value box when sent as a parameter; a row from another shop; a refused statement", "Las palabras del visitante: en una franja de la sentencia si se pegan, en una casilla de valores si van como parámetro; una fila de otra tienda; una sentencia rechazada") },
        { mark: "raised", label: t("Drawers, one per row of the orders table, six per shop; result cards; the staff in line", "Cajones, uno por fila de la tabla de pedidos, seis por tienda; tarjetas de resultado; los empleados en fila") },
        { mark: "flat", label: t("The result tray: rows in the order the database returned them", "La bandeja de resultado: las filas en el orden en que las devolvió la base de datos") },
      ],
      caption: t(
        "The stand on the desk shows what the visitor at the window typed: their shop, a customer's name and a sort column. The board shows the statement the app sends. Pasted words sit inline on a lit strip, so you can see a quote in them end the app's string; with parameters the statement keeps $1, $2 and $3 and the words sit in the lit boxes of the values board. The database parses the text: a statement it can't parse lights SYNTAX ERROR. Otherwise the rows it matches slide out of their drawers and appear in the tray, each card showing the value the list was sorted by, lit if the row belongs to another shop. AS CODE counts requests whose words changed the statement's shape. With the row policy on, shutters close over the other shops' drawers for each visitor.",
        "El atril del mostrador muestra lo que escribió el visitante de la ventanilla: su tienda, el nombre de un cliente y una columna de orden. El tablero muestra la sentencia que envía la app. Las palabras pegadas van en línea sobre una franja encendida, así se ve cómo una comilla en ellas cierra el texto de la app; con parámetros la sentencia conserva $1, $2 y $3, y las palabras van en las casillas encendidas del tablero de valores. La base de datos analiza el texto: una sentencia que no puede analizar enciende ERROR DE SINTAXIS. Si no, las filas que coinciden salen de sus cajones y aparecen en la bandeja, cada tarjeta con el valor por el que se ordenó la lista, encendida si la fila es de otra tienda. COMO CÓDIGO cuenta las solicitudes cuyas palabras cambiaron la forma de la sentencia. Con la política de filas activa, unas persianas cierran los cajones de las otras tiendas para cada visitante.",
      ),
      stage: { "data-records": "" },
      label: t("SQL injection simulation. Space pauses or resumes.", "Simulación de inyección SQL. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["requests", t("Requests", "Solicitudes")],
      ["errors", t("Errors", "Errores")],
      ["leaked", t("Other shops' rows", "Filas de otras tiendas")],
      ["asCode", t("As code", "Como código")],
      ["unsorted", t("Unsorted", "Sin orden")],
      ["rejected", t("Rejected", "Rechazados")],
    ],
    controls: [
      { seg: "name", label: t("Name box", "Casilla del nombre"), options: [["paste", t("Paste in", "Pegar")], ["escape", t("Escape quotes", "Escapar comillas")], ["param", t("Parameter", "Parámetro")]], value: "paste" },
      { seg: "sort", label: t("Sort box", "Casilla del orden"), options: [["paste", t("Paste in", "Pegar")], ["escape", t("Escape quotes", "Escapar comillas")], ["param", t("Parameter", "Parámetro")], ["allow", t("Allowlist", "Lista permitida")]], value: "allow" },
      { seg: "account", label: t("Database account", "Cuenta en la base"), options: [["full", t("Sees every shop", "Ve todas las tiendas")], ["rls", t("Row policy: own shop", "Política de filas: su tienda")]], value: "full" },
      { seg: "attack", label: "' OR '1'='1", options: [["0", t("Never", "Nunca")], [A6, t("1 request in 6", "1 de cada 6 solicitudes")]], value: "0" },
      { seg: "tamper", label: t("Edited sort value", "Orden editado"), options: [["0", t("Never", "Nunca")], [T6, t("1 request in 6", "1 de cada 6 solicitudes")]], value: "0" },
      { speed: true },
      { actions: [["apos", t("Send O'Neil", "Enviar a O'Neil")], ["attack", t("Send ' OR '1'='1", "Enviar ' OR '1'='1")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("The orders table has 18 rows: three shops, two customers each, three orders per customer. An edited sort value asks for cost, a real column the page never offers. Changing a setting starts the run again.",
      "La tabla de pedidos tiene 18 filas: tres tiendas, dos clientes cada una, tres pedidos por cliente. Un orden editado pide cost, una columna real que la página nunca ofrece. Cambiar un ajuste reinicia la ejecución."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs of " + N + " requests each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija de " + N + " solicitudes cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson: a small SQL tokenizer, parser and evaluator, not a real database. The defences follow the <a href="https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html" target="_blank" rel="noopener">OWASP SQL Injection Prevention Cheat Sheet</a>.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección: un pequeño separador de tokens, analizador y evaluador de SQL, no una base de datos real. Las defensas siguen la <a href="https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html" target="_blank" rel="noopener">guía de prevención de inyección SQL de OWASP</a>.`),
  css: LIT_FILL_CSS + `
.inj-strip{fill:var(--anatomy-lit)}
.inj-sql{white-space:pre}
.inj-sql tspan[data-in]{fill:var(--anatomy-page)}
.inj-sql tspan[data-slot]{font-weight:700}
`,
  data: { P, G: GEOMETRY, VISITOR_SVG: visitorSvg() },
});
