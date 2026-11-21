// @ts-nocheck: content in the style of the other lessons
// Systems lesson 86 · Decision models: a writing desk that answers in tokens and a parser that checks them, beside a
// sorting desk that scores every option in one pass.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { pct, int, one, msOrSecs } from "../../lib/format";
import { buildFigure, slipSvg, ticketSvg, P, GEOMETRY } from "./figure";
import { latencyRun, invalidRun, offListRun, questionsRun, countRun, SEEDS, TICKETS, FLOOR, CONFIDENT } from "./sim";

// Experiment results, computed at build time from the same model the page runs.
const R = { lat: latencyRun(), inv: invalidRun(), off: offListRun(), q: questionsRun(), count: countRun() };

const s = (x) => msOrSecs(x);
const per = (x) => String(Math.round(x));
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const both = (f) => t(f("en"), f("es"));
const { lat: LT, inv: IV, off: OF, q: QS, count: CT } = R;
const SORT = LT.json;                       // the sorting desk doesn't depend on the writing desk's format
const FLOOR_PCT = pct(FLOOR), SURE_PCT = pct(CONFIDENT);
const COUNT_ONLY = t("Only the count", "Solo el número");
const LABELS = {
  label: t("Bare label", "Solo la etiqueta"), json: t("JSON", "JSON"), reason: t("Reasoning first", "Razonar primero"), sort: t("Sorting desk", "Mesa de clasificación"),
};

// What each card shows after a run.
const RUNS = {
  latency: () => {
    const m = top(LT.reason.w99);
    const row = (key) => [[LABELS.label, LT.label[key] / m, s(LT.label[key])], [LABELS.json, LT.json[key] / m, s(LT.json[key])], [LABELS.reason, LT.reason[key] / m, s(LT.reason[key]), true], [LABELS.sort, SORT[key === "w50" ? "s50" : "s99"] / m, s(SORT[key === "w50" ? "s50" : "s99"])]];
    return {
      verdict: both((l) => l === "en"
        ? "Median and p99: bare label " + s(LT.label.w50) + " and " + s(LT.label.w99) + ", JSON " + s(LT.json.w50) + " and " + s(LT.json.w99) + ", reasoning first " + s(LT.reason.w50) + " and " + s(LT.reason.w99) + "; the sorting desk " + s(SORT.s50) + " and " + s(SORT.s99) + ". Reasoning first spent " + pct(LT.reason.writeShare) + " of its time writing " + int(LT.reason.tokens) + " tokens on average."
        : "Mediana y p99: solo la etiqueta " + s(LT.label.w50) + " y " + s(LT.label.w99) + ", JSON " + s(LT.json.w50) + " y " + s(LT.json.w99) + ", razonar primero " + s(LT.reason.w50) + " y " + s(LT.reason.w99) + "; la mesa de clasificación " + s(SORT.s50) + " y " + s(SORT.s99) + ". Razonar primero pasó el " + pct(LT.reason.writeShare) + " de su tiempo escribiendo " + int(LT.reason.tokens) + " tokens en promedio."),
      groups: [
        { title: t("Median", "Mediana"), bars: row("w50") },
        { title: t("p99", "p99"), bars: row("w99") },
      ],
    };
  },
  invalid: () => {
    const mr = top(IV.free.rejected), mt = top(IV.free.w99);
    return {
      verdict: both((l) => l === "en"
        ? "Replies the parser rejected, per 1,000 tickets: " + per(IV.free.rejected) + " in free text, " + per(IV.strict.rejected) + " constrained, none from the sorting desk (" + per(IV.free64.rejected) + " in free text with 64 queues). p99: " + s(IV.free.w99) + " free, " + s(IV.strict.w99) + " constrained, " + s(IV.strict.s99) + " for the sorting desk. The median: " + s(IV.free.w50) + " and " + s(IV.strict.w50) + "."
        : "Respuestas que rechazó el parser, por cada 1,000 tickets: " + per(IV.free.rejected) + " en texto libre, " + per(IV.strict.rejected) + " restringida, ninguna de la mesa de clasificación (" + per(IV.free64.rejected) + " en texto libre con 64 colas). p99: " + s(IV.free.w99) + " libre, " + s(IV.strict.w99) + " restringida, " + s(IV.strict.s99) + " la mesa de clasificación. La mediana: " + s(IV.free.w50) + " y " + s(IV.strict.w50) + "."),
      groups: [
        { title: t("Rejected replies, per 1,000 tickets", "Respuestas rechazadas, por cada 1,000 tickets"), bars: [[t("Free text", "Texto libre"), IV.free.rejected / mr, per(IV.free.rejected), true], [t("Constrained", "Restringida"), IV.strict.rejected / mr, per(IV.strict.rejected)], [LABELS.sort, 0, "0"]] },
        { title: t("p99", "p99"), bars: [[t("Free text", "Texto libre"), IV.free.w99 / mt, s(IV.free.w99)], [t("Constrained", "Restringida"), IV.strict.w99 / mt, s(IV.strict.w99), true], [LABELS.sort, IV.strict.s99 / mt, s(IV.strict.s99)]] },
      ],
    };
  },
  offlist: () => {
    const { forced: F, guard: G } = OF, m = top(F.offWrong), mo = top(G.onReview, F.offWrong);
    return {
      verdict: both((l) => l === "en"
        ? "Made to pick one of the 12: all " + per(F.offWrong) + " unlisted tickets per 1,000 went to a listed queue, " + per(F.offSure) + " of them at " + SURE_PCT + " or more. With NONE OF THESE and the " + FLOOR_PCT + " floor: " + per(G.offWrong) + " still went to a listed queue and " + per(G.offReview) + " went to review, and so did " + per(G.onReview) + " tickets whose queue was listed."
        : "Obligada a elegir una de las 12: los " + per(F.offWrong) + " tickets sin cola en la lista, por cada 1,000, fueron a una cola de la lista, " + per(F.offSure) + " de ellos con " + SURE_PCT + " o más. Con NINGUNA y el umbral de " + FLOOR_PCT + ": " + per(G.offWrong) + " igual fueron a una cola de la lista y " + per(G.offReview) + " fueron a revisión, y también " + per(G.onReview) + " tickets cuya cola sí estaba en la lista."),
      groups: [
        { title: t("Unlisted tickets, per 1,000 tickets", "Tickets sin cola en la lista, por cada 1,000"), bars: [
          [t("Must pick: to a listed queue", "Obligada: a una cola de la lista"), F.offWrong / m, per(F.offWrong), true],
          [t("Must pick: at " + SURE_PCT + " or more", "Obligada: con " + SURE_PCT + " o más"), F.offSure / m, per(F.offSure)],
          [t("NONE + floor: to a listed queue", "NINGUNA + umbral: a una cola de la lista"), G.offWrong / m, per(G.offWrong)],
          [t("NONE + floor: to review", "NINGUNA + umbral: a revisión"), G.offReview / m, per(G.offReview)],
        ] },
        { title: t("Listed tickets sent to review, per 1,000", "Tickets con cola en la lista enviados a revisión, por cada 1,000"), bars: [
          [t("Must pick", "Obligada"), 0, "0"],
          [t("NONE + floor", "NINGUNA + umbral"), G.onReview / mo, per(G.onReview)],
        ] },
      ],
    };
  },
  questions: () => {
    const m = top(QS.q6.w50);
    return {
      verdict: both((l) => l === "en"
        ? "Median time with 1, 3 and 6 questions: the sorting desk " + s(QS.q1.s50) + ", " + s(QS.q3.s50) + " and " + s(QS.q6.s50) + "; the writing desk, every answer in one JSON reply, " + s(QS.q1.w50) + ", " + s(QS.q3.w50) + " and " + s(QS.q6.w50) + " (p99 " + s(QS.q6.w99) + " at 6). One call per question, side by side: " + s(QS.q6.sep50) + " at 6, with " + one(QS.q6.sepCalls) + " calls per ticket."
        : "Tiempo mediano con 1, 3 y 6 preguntas: la mesa de clasificación " + s(QS.q1.s50) + ", " + s(QS.q3.s50) + " y " + s(QS.q6.s50) + "; la mesa de escritura, todas las respuestas en una respuesta JSON, " + s(QS.q1.w50) + ", " + s(QS.q3.w50) + " y " + s(QS.q6.w50) + " (p99 " + s(QS.q6.w99) + " con 6). Una llamada por pregunta, en paralelo: " + s(QS.q6.sep50) + " con 6, con " + one(QS.q6.sepCalls) + " llamadas por ticket."),
      groups: [
        { title: t("Median, 1 question", "Mediana, 1 pregunta"), bars: [[t("Writing desk", "Mesa de escritura"), QS.q1.w50 / m, s(QS.q1.w50)], [LABELS.sort, QS.q1.s50 / m, s(QS.q1.s50)]] },
        { title: t("Median, 6 questions", "Mediana, 6 preguntas"), bars: [
          [t("Writing desk, one reply", "Mesa de escritura, una respuesta"), QS.q6.w50 / m, s(QS.q6.w50)],
          [t("Writing desk, a call per question", "Mesa de escritura, una llamada por pregunta"), QS.q6.sep50 / m, s(QS.q6.sep50)],
          [LABELS.sort, QS.q6.s50 / m, s(QS.q6.s50), true],
        ] },
      ],
    };
  },
  count: () => {
    const { label: A, reason: B } = CT, m = top(B.w50);
    return {
      verdict: both((l) => l === "en"
        ? "Counts right: the sorting desk " + pct(A.s) + " (" + pct(A.sShort) + " on orders of up to 6 lines, " + pct(A.sLong) + " on 10 or more), the writing desk giving only the count " + pct(A.w) + ", the writing desk reasoning first " + pct(B.w) + ". Median time: " + s(A.s50) + ", " + s(A.w50) + " and " + s(B.w50) + ". The sorting desk's average confidence: " + pct(A.sConf) + "."
        : "Conteos correctos: la mesa de clasificación " + pct(A.s) + " (" + pct(A.sShort) + " en pedidos de hasta 6 líneas, " + pct(A.sLong) + " en los de 10 o más), la mesa de escritura dando solo el número " + pct(A.w) + ", la mesa de escritura razonando primero " + pct(B.w) + ". Tiempo mediano: " + s(A.s50) + ", " + s(A.w50) + " y " + s(B.w50) + ". La confianza promedio de la mesa de clasificación: " + pct(A.sConf) + "."),
      groups: [
        { title: t("Counts right", "Conteos correctos"), bars: [[LABELS.sort, A.s, pct(A.s), true], [COUNT_ONLY, A.w, pct(A.w)], [LABELS.reason, B.w, pct(B.w)]] },
        { title: t("Median time", "Tiempo mediano"), bars: [[LABELS.sort, A.s50 / m, s(A.s50)], [COUNT_ONLY, A.w50 / m, s(A.w50)], [LABELS.reason, B.w50 / m, s(B.w50)]] },
      ],
    };
  },
};

const EXPERIMENTS = [
  {
    id: "latency",
    title: t("One decision, timed", "Una decisión, cronometrada"),
    change: t("12 queues, one question per ticket, free text · the writing desk replies with the bare label, with JSON, or with its reasoning and then the label, vs the sorting desk's one pass · the times are illustrative: 0.4 s to read the ticket and start, 20 ms a token, 0.15 s for a pass",
      "12 colas, una pregunta por ticket, texto libre · la mesa de escritura responde con solo la etiqueta, con JSON, o con su razonamiento y luego la etiqueta, vs la pasada única de la mesa de clasificación · los tiempos son ilustrativos: 0.4 s para leer el ticket y empezar, 20 ms por token, 0.15 s por pasada"),
    question: t("Reasoning first, where does most of the writing desk's time go?", "Razonando primero, ¿en qué se va la mayor parte del tiempo de la mesa de escritura?"),
    options: [
      t("Reading the ticket: a model that big is slow to read", "En leer el ticket: un modelo tan grande lee lento"),
      t("Writing about a hundred tokens, one after another", "En escribir unos cien tokens, uno tras otro"),
      t("Retrying the replies the parser rejects", "En reintentar las respuestas que rechaza el parser"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "A model reads its input in one parallel pass, but it writes one token at a time, each waiting for the one before. Reading the ticket and starting took about " + s(LT.reason.readW) + " whatever the format; what grew was the writing: " + int(LT.json.tokens) + " tokens for the JSON, " + int(LT.reason.tokens) + " for reasoning first, at 20 ms each. So reasoning first took " + s(LT.reason.w50) + " at the median, " + pct(LT.reason.writeShare) + " of it writing, against " + s(LT.label.w50) + " for the bare label, whose time is nearly all reading. Retries are real but rare (" + pct(LT.reason.retried) + " of tickets here): they set the p99, " + s(LT.reason.w99) + ", not the median. The sorting desk writes nothing: one pass reads the ticket and scores every option, " + s(SORT.s50) + " at the median and " + s(SORT.s99) + " at p99. Its pass is also quicker than the writer's read here, but the gap that grows with the reply is the writing. TypeSafe reports 70 to 500 ms per call for its decision model, Jev, against 3 to 329 s for frontier LLMs on the same tasks: the vendor's own figures, not a benchmark."
      : "Un modelo lee su entrada en una pasada en paralelo, pero escribe un token a la vez, cada uno esperando al anterior. Leer el ticket y empezar tomó unos " + s(LT.reason.readW) + " con cualquier formato; lo que creció fue la escritura: " + int(LT.json.tokens) + " tokens para el JSON, " + int(LT.reason.tokens) + " para razonar primero, a 20 ms cada uno. Así, razonar primero tardó " + s(LT.reason.w50) + " en la mediana, el " + pct(LT.reason.writeShare) + " de eso escribiendo, contra " + s(LT.label.w50) + " de solo la etiqueta, cuyo tiempo es casi todo lectura. Los reintentos existen pero son pocos (el " + pct(LT.reason.retried) + " de los tickets aquí): fijan el p99, " + s(LT.reason.w99) + ", no la mediana. La mesa de clasificación no escribe nada: una pasada lee el ticket y puntúa todas las opciones, " + s(SORT.s50) + " en la mediana y " + s(SORT.s99) + " en el p99. Su pasada también es más rápida que la lectura de la otra mesa aquí, pero la diferencia que crece con la respuesta es la escritura. TypeSafe reporta de 70 a 500 ms por llamada para su modelo de decisión, Jev, contra 3 a 329 s de los LLM de frontera en las mismas tareas: cifras del propio proveedor, no un benchmark."),
    watch: { task: "route", options: "12", unlisted: "none", format: "reason", output: "free", questions: "1" },
  },
  {
    id: "invalid",
    title: t("Answers that aren't an option", "Respuestas que no son una opción"),
    change: t("JSON replies, 12 queues · free text, parsed afterwards and written again when it isn't one of the options, vs constrained decoding, which can only write the schema's options, vs the sorting desk · the error rates are illustrative",
      "Respuestas JSON, 12 colas · texto libre, analizado después y escrito de nuevo cuando no es una de las opciones, vs decodificación restringida (constrained decoding), que solo puede escribir las opciones del esquema, vs la mesa de clasificación · las tasas de error son ilustrativas"),
    question: t("Constrained, the writing desk can no longer write an invalid reply. What happens to its p99?", "Restringida, la mesa de escritura ya no puede escribir una respuesta inválida. ¿Qué pasa con su p99?"),
    options: [
      t("It falls to about the sorting desk's: retries were the slow part", "Baja a más o menos el de la mesa de clasificación: los reintentos eran lo lento"),
      t("It falls, but stays several times the sorting desk's", "Baja, pero sigue siendo varias veces el de la mesa de clasificación"),
      t("Nothing changes: rejected replies were too rare to matter", "No cambia: las respuestas rechazadas eran muy pocas para importar"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "A rejected reply costs a whole second call, reading included. Only " + pct(IV.free.retried) + " of tickets needed one, which leaves the median alone and lands squarely on the p99: that's the slowest 1%, and the retried tickets fill it (lesson 44, Percentiles). Constrained decoding removes them: at every step the decoder masks the tokens the schema doesn't allow, so the reply is always one of the options. OpenAI's Structured Outputs turns a JSON schema into a grammar this way, and llama.cpp takes a GBNF grammar. The p99 fell from " + s(IV.free.w99) + " to " + s(IV.strict.w99) + ", but the median stayed at " + s(IV.strict.w50) + ": the desk still reads the ticket and writes every token, " + int(IV.strict.tokens) + " for a JSON reply here. The sorting desk's p99 was " + s(IV.strict.s99) + ". Neither makes the answer right: the writing desk picked the wrong queue for " + pct(IV.strict.wWrong) + " of tickets with or without constraints. More options mean more near-misses: with 64 queues, free text was rejected " + per(IV.free64.rejected) + " times per 1,000 tickets. And a constrained reply can still break when it is cut off at its token limit."
      : "Una respuesta rechazada cuesta una segunda llamada entera, lectura incluida. Solo el " + pct(IV.free.retried) + " de los tickets la necesitó, lo que deja quieta la mediana y cae justo en el p99: es el 1% más lento, y lo llenan los tickets reintentados (lección 44, Percentiles). La decodificación restringida los elimina: en cada paso el decodificador descarta los tokens que el esquema no permite, así que la respuesta siempre es una de las opciones. Structured Outputs de OpenAI convierte así un esquema JSON en una gramática, y llama.cpp acepta una gramática GBNF. El p99 bajó de " + s(IV.free.w99) + " a " + s(IV.strict.w99) + ", pero la mediana quedó en " + s(IV.strict.w50) + ": la mesa igual lee el ticket y escribe cada token, " + int(IV.strict.tokens) + " para una respuesta JSON aquí. El p99 de la mesa de clasificación fue " + s(IV.strict.s99) + ". Ninguna de las dos hace correcta la respuesta: la mesa de escritura eligió la cola equivocada en el " + pct(IV.strict.wWrong) + " de los tickets, con o sin restricción. Más opciones traen más respuestas casi correctas: con 64 colas, el texto libre fue rechazado " + per(IV.free64.rejected) + " veces por cada 1,000 tickets. Y una respuesta restringida todavía puede romperse si se corta en su límite de tokens."),
    watch: { task: "route", options: "12", unlisted: "none", format: "json", output: "free", questions: "1", find: "rejected" },
  },
  {
    id: "offlist",
    title: t("The right queue isn't on the list", "La cola correcta no está en la lista"),
    change: t("12 queues, and 1 ticket in 10 belongs to a queue that isn't on the list · the sorting desk must pick one of the 12, vs a 13th option, NONE OF THESE, plus a floor: an answer under " + FLOOR_PCT + " goes to human review · the writing desk constrained to the options",
      "12 colas, y 1 ticket de cada 10 es de una cola que no está en la lista · la mesa de clasificación debe elegir una de las 12, vs una opción 13, NINGUNA, más un umbral: una respuesta con menos de " + FLOOR_PCT + " va a revisión humana · la mesa de escritura restringida a las opciones"),
    question: t("With no way to say \"none\", what does the sorting desk do with the tickets whose queue isn't listed?", "Sin forma de decir \"ninguna\", ¿qué hace la mesa de clasificación con los tickets cuya cola no está en la lista?"),
    options: [
      t("Spreads its probability thin, so they're easy to spot", "Reparte su probabilidad, así que son fáciles de detectar"),
      t("Puts each in a listed queue, most at " + SURE_PCT + " or more", "Pone cada uno en una cola de la lista, la mayoría con " + SURE_PCT + " o más"),
      t("Rejects them: no option fits, so there's no valid answer", "Los rechaza: ninguna opción calza, así que no hay respuesta válida"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "A forced choice can't say \"none of these\": its probabilities are shares of the options it was given, and they add up to 1. A ticket that looks more like one listed queue than the others gets most of the share, so the desk was sure of a wrong answer: " + per(OF.forced.offSure) + " of the " + per(OF.forced.offWrong) + " unlisted tickets per 1,000 went to a listed queue at " + SURE_PCT + " or more, and its average confidence on them was " + pct(OF.forced.offConf) + ", against " + pct(OF.forced.onConf) + " on tickets whose queue was listed. The type was always valid; the answer wasn't. Constrained decoding is the same forced choice: the writing desk sent " + per(OF.forced.wOffWrong) + " of them to a listed queue too. Give the desk a way out, an explicit NONE OF THESE option and a floor under which a person decides: then " + per(OF.guard.offWrong) + " still went to a listed queue and " + per(OF.guard.offReview) + " went to review, and " + per(OF.guard.onReview) + " tickets whose queue was listed went to review as well. That's the floor's price, and it also caught wrong answers: listed tickets sent to the wrong queue fell from " + per(OF.forced.onWrong) + " to " + per(OF.guard.onWrong) + " per 1,000. Set the floor on labelled tickets. Real models do this too: in figures compiled by Convai, which makes a rival model, Jev gave the true label zero probability on 16% of examples in a six-way emotion task (as reported on HackerNoon)."
      : "Una elección forzada no puede decir \"ninguna\": sus probabilidades son partes de las opciones que recibió, y suman 1. Un ticket que se parece más a una cola de la lista que a las demás se lleva la mayor parte, así que la mesa estuvo segura de una respuesta errónea: " + per(OF.forced.offSure) + " de los " + per(OF.forced.offWrong) + " tickets sin cola en la lista, por cada 1,000, fueron a una cola de la lista con " + SURE_PCT + " o más, y su confianza promedio en ellos fue " + pct(OF.forced.offConf) + ", contra " + pct(OF.forced.onConf) + " en los tickets cuya cola estaba en la lista. El tipo siempre fue válido; la respuesta no. La decodificación restringida es la misma elección forzada: la mesa de escritura también mandó " + per(OF.forced.wOffWrong) + " a una cola de la lista. Dale a la mesa una salida, una opción explícita NINGUNA y un umbral por debajo del cual decide una persona: entonces " + per(OF.guard.offWrong) + " igual fueron a una cola de la lista y " + per(OF.guard.offReview) + " fueron a revisión, y " + per(OF.guard.onReview) + " tickets cuya cola estaba en la lista también fueron a revisión. Ese es el precio del umbral, que además atrapó respuestas erróneas: los tickets de la lista enviados a la cola equivocada bajaron de " + per(OF.forced.onWrong) + " a " + per(OF.guard.onWrong) + " por cada 1,000. Fija el umbral con tickets etiquetados. A los modelos reales también les pasa: en cifras recopiladas por Convai, que hace un modelo rival, Jev le dio probabilidad cero a la etiqueta correcta en el 16% de los ejemplos de una tarea de emociones con seis opciones (según HackerNoon)."),
    watch: { task: "route", options: "12", unlisted: "some", format: "json", output: "constrained", questions: "1", find: "offwrong" },
  },
  {
    id: "questions",
    title: t("Many questions, one ticket", "Muchas preguntas, un ticket"),
    change: t("JSON replies, 12 options per question, free text · 1, 3 or 6 questions about each ticket (the queue, the urgency, the language…) · the writing desk answers them all in one reply; the bars add a writer making one call per question, side by side",
      "Respuestas JSON, 12 opciones por pregunta, texto libre · 1, 3 o 6 preguntas sobre cada ticket (la cola, la urgencia, el idioma…) · la mesa de escritura las responde todas en una respuesta; las barras agregan una mesa que hace una llamada por pregunta, en paralelo"),
    question: t("From one question to six, what happens to the sorting desk's time?", "De una pregunta a seis, ¿qué pasa con el tiempo de la mesa de clasificación?"),
    options: [
      t("About six times as long: six answers, six times the work", "Unas seis veces más: seis respuestas, seis veces el trabajo"),
      t("Barely changes: one reading answers every question", "Casi no cambia: una lectura responde todas las preguntas"),
      t("About twice as long: the reading is shared, the answers aren't", "Más o menos el doble: la lectura se comparte, las respuestas no"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "The sorting desk reads the ticket once and scores every question against that same reading, so six questions took " + s(QS.q6.s50) + " at the median against " + s(QS.q1.s50) + " for one; here each extra question adds 5 ms. TypeSafe's documentation says Jev \"processes the state once and evaluates all questions against it in parallel\"; its architecture isn't published, so this desk models only that. The writing desk writes every answer, " + int(QS.q6.tokens) + " tokens for six against " + int(QS.q1.tokens) + " for one, so its median went from " + s(QS.q1.w50) + " to " + s(QS.q6.w50) + ", and one bad answer sends the whole reply back: " + per(QS.q6.rejected) + " rejected per 1,000 tickets, against " + per(QS.q1.rejected) + ". A call per question, side by side, brought its median down to " + s(QS.q6.sep50) + ", but it made " + one(QS.q6.sepCalls) + " calls per ticket, each reading the ticket again and paid for, and the ticket waits for the slowest. The price of one pass: each question is answered on its own, so no answer can depend on another (the urgency can't take the queue into account), and nothing stops two answers from contradicting each other."
      : "La mesa de clasificación lee el ticket una vez y puntúa cada pregunta contra esa misma lectura, así que seis preguntas tardaron " + s(QS.q6.s50) + " en la mediana contra " + s(QS.q1.s50) + " para una; aquí cada pregunta extra suma 5 ms. La documentación de TypeSafe dice que Jev \"procesa el estado una vez y evalúa todas las preguntas contra él en paralelo\"; su arquitectura no está publicada, así que esta mesa modela solo eso. La mesa de escritura escribe cada respuesta, " + int(QS.q6.tokens) + " tokens para seis contra " + int(QS.q1.tokens) + " para una, así que su mediana pasó de " + s(QS.q1.w50) + " a " + s(QS.q6.w50) + ", y una respuesta mala devuelve la respuesta entera: " + per(QS.q6.rejected) + " rechazadas por cada 1,000 tickets, contra " + per(QS.q1.rejected) + ". Una llamada por pregunta, en paralelo, bajó su mediana a " + s(QS.q6.sep50) + ", pero hizo " + one(QS.q6.sepCalls) + " llamadas por ticket, cada una leyendo el ticket otra vez y pagándolo, y el ticket espera a la más lenta. El precio de una sola pasada: cada pregunta se responde por separado, así que ninguna respuesta puede depender de otra (la urgencia no puede tener en cuenta la cola), y nada impide que dos respuestas se contradigan."),
    watch: { task: "route", options: "12", unlisted: "none", format: "json", output: "free", questions: "6" },
  },
  {
    id: "count",
    title: t("When to generate", "Cuándo generar"),
    change: t("Count the flagged lines of an order of 4 to 12 lines: 8 options, 0 to 7+ · the sorting desk vs the writing desk giving the bare count vs the writing desk reasoning first, a line at a time · output constrained to the options",
      "Contar las líneas marcadas de un pedido de 4 a 12 líneas: 8 opciones, de 0 a 7+ · la mesa de clasificación vs la mesa de escritura dando solo el número vs la mesa de escritura razonando primero, una línea a la vez · salida restringida a las opciones"),
    question: t("How does the sorting desk's accuracy compare with the writing desk reasoning first?", "¿Cómo se compara la precisión de la mesa de clasificación con la de la mesa de escritura que razona primero?"),
    options: [
      t("About the same, and far faster: calibration makes up for it", "Más o menos igual, y mucho más rápida: la calibración lo compensa"),
      t("Much lower: one pass can't count line by line", "Mucho menor: una pasada no puede contar línea por línea"),
      t("Higher: writing out reasoning adds chances to slip", "Mayor: escribir el razonamiento agrega oportunidades de error"),
    ],
    answer: 1,
    why: both((l) => l === "en"
      ? "Counting is a sequence of steps: look at a line, decide, add one, carry the total. One pass sees the order as a whole and has to recognize the count, which works for short orders and fails as they grow: " + pct(CT.label.sShort) + " right on up to 6 lines, " + pct(CT.label.sLong) + " on 10 or more. A writing desk that gives only the count does no better (" + pct(CT.label.w) + "): with nothing written before the answer, it has no steps either. Writing the reasoning first keeps each line's verdict and the running total in the tokens, and got " + pct(CT.reason.w) + " right, at " + s(CT.reason.w50) + " a ticket against " + s(CT.label.s50) + ". The sorting desk's probabilities did warn: its average confidence was " + pct(CT.label.sConf) + ", so a floor would have sent most counts to review. TypeSafe lists counting and arithmetic among Jev's known weaknesses, and a benchmark of Jev against 19 LLMs found it last on MathQA, math word problems: 75.0 against a frontier median of 92.7 (Li et al., arXiv 2610.11978). Use the fast desk for judgements that fit in one look, and send counting, arithmetic, dates and multi-step logic to a model that writes its working, or to code."
      : "Contar es una secuencia de pasos: mirar una línea, decidir, sumar uno, llevar el total. Una pasada ve el pedido completo y tiene que reconocer el número, lo que funciona con pedidos cortos y falla a medida que crecen: " + pct(CT.label.sShort) + " de aciertos con hasta 6 líneas, " + pct(CT.label.sLong) + " con 10 o más. Una mesa de escritura que da solo el número no lo hace mejor (" + pct(CT.label.w) + "): sin nada escrito antes de la respuesta, tampoco tiene pasos. Escribir primero el razonamiento guarda el veredicto de cada línea y el total parcial en los tokens, y acertó el " + pct(CT.reason.w) + ", a " + s(CT.reason.w50) + " por ticket contra " + s(CT.label.s50) + ". Las probabilidades de la mesa de clasificación sí avisaron: su confianza promedio fue " + pct(CT.label.sConf) + ", así que un umbral habría mandado a revisión la mayoría de los conteos. TypeSafe incluye contar y la aritmética entre las debilidades conocidas de Jev, y un benchmark de Jev contra 19 LLM lo encontró último en MathQA, problemas de matemática con enunciado: 75.0 contra una mediana de 92.7 de los modelos de frontera (Li et al., arXiv 2610.11978). Usa la mesa rápida para juicios que caben en una mirada, y manda contar, la aritmética, las fechas y la lógica de varios pasos a un modelo que escriba su razonamiento, o a código."),
    watch: { task: "count", format: "reason", output: "constrained", questions: "1", find: "countwrong" },
  },
];

const QUESTIONS = [
  [t("A decision model and a generative model are both asked which of 12 queues a ticket belongs to. What does each one do, and what does your code get back?", "A un modelo de decisión y a uno generativo se les pregunta a cuál de 12 colas pertenece un ticket. ¿Qué hace cada uno, y qué recibe tu código?"),
    t("The generative model reads the prompt and writes a reply a token at a time, each depending on the ones before; your code gets text, and has to parse it, check it's one of the 12, and retry or fall back when it isn't. The decision model reads the ticket and the options once and returns a score for every option from the same pass; your code gets a typed value, one of the 12, with a probability for each. TypeSafe's Jev offers this as Choice (one of up to 255 options), Score (2 to 10 ordered levels) and a yes/no with a probability; how it computes them isn't published.",
      "El modelo generativo lee el prompt y escribe una respuesta un token a la vez, cada uno dependiendo de los anteriores; tu código recibe texto, y tiene que analizarlo, verificar que sea una de las 12, y reintentar o tomar otro camino cuando no lo es. El modelo de decisión lee el ticket y las opciones una vez y devuelve un puntaje para cada opción de esa misma pasada; tu código recibe un valor con tipo, una de las 12, con una probabilidad para cada una. Jev, de TypeSafe, lo ofrece como Choice (una de hasta 255 opciones), Score (de 2 a 10 niveles ordenados) y un sí/no con una probabilidad; cómo los calcula no está publicado.")],
  [t("Where does the time of a generative classification call go, and what shortens it?", "¿En qué se va el tiempo de una llamada generativa de clasificación, y qué lo acorta?"),
    t("Reading the input runs over all of it in parallel; writing runs one token at a time, so time grows with the reply: reasoning, a JSON wrapper, long label names, several answers. To shorten it, ask for short codes, drop the reasoning where the task doesn't need it, ask every question in one call (or in parallel calls, paying for each read), and set a token limit. Streaming doesn't help: your code can't act until the label is complete. Or don't generate: a decision model returns every option's score in one pass.",
      "Leer la entrada recorre todo en paralelo; escribir va un token a la vez, así que el tiempo crece con la respuesta: el razonamiento, un envoltorio JSON, nombres de etiqueta largos, varias respuestas. Para acortarlo, pide códigos cortos, quita el razonamiento donde la tarea no lo necesita, haz todas las preguntas en una llamada (o en llamadas en paralelo, pagando cada lectura) y fija un límite de tokens. Recibir la respuesta en streaming no ayuda: tu código no puede actuar hasta que la etiqueta esté completa. O no generes: un modelo de decisión devuelve el puntaje de cada opción en una pasada.")],
  [t("Your router uses JSON-schema structured outputs, so every reply parses. Is the router right? What would you measure?", "Tu enrutador usa salidas estructuradas con esquema JSON, así que toda respuesta se puede analizar. ¿El enrutador acierta? ¿Qué medirías?"),
    t("Parsing proves the type, not the answer; OpenAI's own announcement of Structured Outputs notes that values inside the JSON can still be wrong. Measure accuracy on a labelled sample of real tickets, per option, and keep measuring as tickets change; measure how often the right answer isn't an option at all; and if you have probabilities, check their calibration. Watch for truncation too: a reply cut off at its token limit can still fail the schema.",
      "Que se pueda analizar prueba el tipo, no la respuesta; el propio anuncio de Structured Outputs de OpenAI advierte que los valores dentro del JSON pueden estar mal. Mide la precisión con una muestra etiquetada de tickets reales, por opción, y sigue midiendo a medida que cambian los tickets; mide qué tan seguido la respuesta correcta ni siquiera es una opción; y si tienes probabilidades, revisa su calibración. Cuida también los cortes: una respuesta cortada en su límite de tokens todavía puede no cumplir el esquema.")],
  [t("The sorting desk says Q7 at 92%. What does a calibrated 92% promise, and what doesn't it?", "La mesa de clasificación dice Q7 con 92%. ¿Qué promete un 92% calibrado, y qué no?"),
    t("Calibrated means that across many answers given at about 92%, about 92% are right. It's a statement about the options it was given and about inputs like the ones it was calibrated on: when the right answer isn't among the options, the probabilities still add up to 1 over the wrong ones, and they can drift when your tickets change. It doesn't promise that this answer is right. Check calibration on your own labelled tickets, with a reliability diagram or the expected calibration error, before you set a floor on it; TypeSafe hasn't published a reliability diagram for Jev, per Victor Dibia's review.",
      "Calibrado significa que, entre muchas respuestas dadas con cerca de 92%, cerca del 92% son correctas. Es una afirmación sobre las opciones que recibió y sobre entradas como aquellas con las que se calibró: cuando la respuesta correcta no está entre las opciones, las probabilidades igual suman 1 entre las equivocadas, y pueden desviarse cuando cambian tus tickets. No promete que esta respuesta sea correcta. Revisa la calibración con tus propios tickets etiquetados, con un diagrama de confiabilidad (reliability diagram) o el error de calibración esperado (ECE), antes de fijar un umbral sobre ella; TypeSafe no ha publicado un diagrama de confiabilidad para Jev, según la revisión de Victor Dibia.")],
  [t("How do you let a decision model say \"none of these\", and what does it cost?", "¿Cómo dejas que un modelo de decisión diga \"ninguna\", y qué cuesta?"),
    t("Add it as an explicit option with a clear description, and set a confidence floor under which a person or a slower model decides. Choose the floor on labelled tickets: a higher floor catches more wrong answers and unlisted tickets, and sends more right ones to review, which needs people, so price it in. Keep the list honest: if many tickets land in \"none\", the list is missing a queue. A list too long for one choice can be split in two stages, a coarse choice and then a fine one; that's how TypeSafe describes handling more than 255 options.",
      "Agrégala como una opción explícita con una descripción clara, y fija un umbral de confianza por debajo del cual decide una persona o un modelo más lento. Elige el umbral con tickets etiquetados: un umbral más alto atrapa más respuestas erróneas y tickets sin cola en la lista, y manda más respuestas correctas a revisión, que necesita personas, así que inclúyelo en el costo. Mantén honesta la lista: si muchos tickets caen en \"ninguna\", a la lista le falta una cola. Una lista demasiado larga para una sola elección se puede dividir en dos etapas, una elección gruesa y luego una fina; así describe TypeSafe el manejo de más de 255 opciones.")],
  [t("Which decisions should stay with a model that writes, or with code, and why?", "¿Qué decisiones deberían quedarse con un modelo que escribe, o con código, y por qué?"),
    t("Anything that needs steps the model has to carry: counting, arithmetic, comparing dates, following one instruction to another, answers that depend on each other. TypeSafe's own list of Jev's known weaknesses includes counting, arithmetic and dates, taking instructions literally, and accuracy that falls as irrelevant text grows. Anything with open-ended output: a summary, a reply, code. Anything you must explain to an auditor: a decision model gives a probability, not a written rationale. And where a rule is exact (a total over a threshold), compute it in code and ask the model only for the judgement.",
      "Todo lo que necesita pasos que el modelo tiene que llevar: contar, la aritmética, comparar fechas, seguir una instrucción hasta otra, respuestas que dependen entre sí. La propia lista de TypeSafe de debilidades conocidas de Jev incluye contar, la aritmética y las fechas, tomar las instrucciones al pie de la letra, y una precisión que baja a medida que crece el texto irrelevante. Todo lo que tiene una salida abierta: un resumen, una respuesta, código. Todo lo que debas explicarle a un auditor: un modelo de decisión da una probabilidad, no una justificación escrita. Y donde una regla es exacta (un total por encima de un límite), calcúlala en código y pídele al modelo solo el juicio.")],
];

export default defineLesson({
  title: t("Scoring vs Generating Workbench", "Banco de trabajo: puntuar o generar"),
  eyebrow: t("Systems lesson 86 · Decision models", "Lección de sistemas 86 · Modelos de decisión"),
  lede: t("Many AI calls in a system are decisions, not prose: which of 12 queues gets this ticket, is this message a prompt injection, which tool runs next. A generative model writes its answer a token at a time and your code parses it, and sometimes the text isn't one of the options; a decision model scores a fixed set of options in one pass and returns a typed answer with probabilities, valid every time and not always right. This lesson puts the two at desks side by side on the same tickets: watch them, predict what each costs and where each goes wrong, then explain it back.",
    "Muchas llamadas a IA en un sistema son decisiones, no prosa: a cuál de 12 colas va este ticket, si este mensaje es una inyección de prompt, qué herramienta se ejecuta después. Un modelo generativo escribe su respuesta un token a la vez y tu código la analiza, y a veces el texto no es una de las opciones; un modelo de decisión puntúa un conjunto fijo de opciones en una pasada y devuelve una respuesta con tipo y probabilidades, válida siempre y no siempre correcta. Esta lección pone a los dos en mesas, uno al lado del otro, con los mismos tickets: míralos, predice cuánto cuesta cada uno y dónde se equivoca, y después explícalo."),
  machine: {
    intro: t("Each ticket arrives at the inbox and both desks get a copy. At the writing desk, on the left, the scribe reads it and then writes the reply token by token, each token a tile on the bed; the parser at the end checks that the reply is one of the options, and a slip it rejects goes back to be written again. At the sorting desk, on the right, the reader reads the ticket once and every bin gets its score at the same moment, and the scores are turned into probabilities that add up to 1; the tallest bar takes the ticket. TypeSafe hasn't published how its decision model, Jev, works inside, so this desk is the general mechanism: a fixed set of options scored in one pass. Try the reply format, constrained output, more options or questions, tickets whose queue isn't listed, and a task that needs counting.",
      "Cada ticket llega a la bandeja y las dos mesas reciben una copia. En la mesa de escritura, a la izquierda, el escriba lo lee y luego escribe la respuesta token por token, cada token una ficha en la cama; el analizador (parser) del final verifica que la respuesta sea una de las opciones, y una papeleta que rechaza vuelve a escribirse. En la mesa de clasificación, a la derecha, el lector lee el ticket una vez y cada cajón recibe su puntaje en el mismo instante, y los puntajes se convierten en probabilidades que suman 1; la barra más alta se lleva el ticket. TypeSafe no ha publicado cómo funciona por dentro su modelo de decisión, Jev, así que esta mesa es el mecanismo general: un conjunto fijo de opciones puntuado en una pasada. Prueba el formato de la respuesta, la salida restringida, más opciones o preguntas, tickets cuya cola no está en la lista y una tarea que necesita contar."),
    plate: {
      title: t("Two desks", "Dos mesas"),
      keys: [
        { mark: "lit", label: t("Wrong: a reply the parser rejected, an accepted reply with the wrong answer, and a bin, with its bar, holding a ticket that isn't its own", "Mal: una respuesta que rechazó el parser, una respuesta aceptada pero errónea, y un cajón, con su barra, que tiene un ticket que no es el suyo") },
        { mark: "raised", label: t("Tickets (number and right answer), the reply slip, the bins and their bars: each bar is the probability its option got", "Tickets (número y respuesta correcta), la papeleta de respuesta, los cajones y sus barras: cada barra es la probabilidad que recibió su opción") },
        { mark: "flat", label: t("Token tiles: one per token written, in order; +N past the end of the bed", "Fichas de tokens: una por token escrito, en orden; +N pasado el final de la cama") },
      ],
      caption: t(
        "Slow motion: at Speed 1/2 a second of the model takes two on the page; the gate and the moving cards take a moment of their own, which the clocks don't count. The constants are illustrative and round: the writing desk takes about 0.4 s to read a ticket and start, then 20 ms a token; the sorting desk's one pass takes about 0.15 s, plus 5 ms for each extra question. A routing reply is a label of 2–3 tokens; JSON adds a few more per answer, and reasoning first adds 60–140. A ticket card shows its number and its right answer, which neither desk sees; a queue past the end of the list (Q13 with 12 queues) isn't on it. MS counts this ticket's milliseconds and TOKENS the tokens written for it, retries included; REJECTED, WRONG and TO REVIEW count every ticket since the run started, the 1,000 sent at once included. A bar's height is the probability its option got; past eight options the bins show the eight most likely, and +N counts the rest.",
        "Cámara lenta: con Velocidad 1/2, un segundo del modelo toma dos en la página; la barrera y las tarjetas en movimiento toman un momento propio, que los relojes no cuentan. Las constantes son ilustrativas y redondas: la mesa de escritura tarda unos 0.4 s en leer un ticket y empezar, y luego 20 ms por token; la pasada única de la mesa de clasificación tarda unos 0.15 s, más 5 ms por cada pregunta extra. Una respuesta de enrutamiento es una etiqueta de 2–3 tokens; JSON agrega unos pocos más por respuesta, y razonar primero agrega 60–140. Una tarjeta de ticket muestra su número y su respuesta correcta, que ninguna mesa ve; una cola más allá del final de la lista (Q13 con 12 colas) no está en ella. MS cuenta los milisegundos de este ticket y TOKENS los tokens escritos para él, reintentos incluidos; RECHAZADAS, ERRÓNEAS y A REVISIÓN cuentan cada ticket desde que empezó la ejecución, incluidos los 1,000 enviados de golpe. La altura de una barra es la probabilidad que recibió su opción; con más de ocho opciones los cajones muestran las ocho más probables, y +N cuenta el resto.",
      ),
      stage: { "data-decision-desks": "" },
      label: t("Decision models simulation. Space pauses or resumes.", "Simulación de modelos de decisión. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["wnow", t("Writing desk, this ticket", "Mesa de escritura, este ticket"), "–"],
      ["snow", t("Sorting desk, this ticket", "Mesa de clasificación, este ticket"), "–"],
      ["wlat", t("Writing desk p50 · p99", "Mesa de escritura p50 · p99"), "–"],
      ["slat", t("Sorting desk p50 · p99", "Mesa de clasificación p50 · p99"), "–"],
      ["rejected", t("Replies rejected", "Respuestas rechazadas"), "–"],
      ["wrong", t("Wrong: writing · sorting", "Erróneas: escritura · clasificación"), "–"],
    ],
    controls: [
      { seg: "task", label: t("Task", "Tarea"), options: [["route", t("Route to a queue", "Elegir una cola")], ["count", t("Count flagged lines", "Contar líneas marcadas")]], value: "route" },
      { seg: "options", label: t("Queues", "Colas"), options: [["4", "4"], ["12", "12"], ["64", "64"]], value: "12" },
      { seg: "unlisted", label: t("Unlisted queues", "Colas fuera de la lista"), options: [["none", t("None", "Ninguna")], ["some", t("1 ticket in 10", "1 ticket de cada 10")], ["guard", t("1 in 10, with NONE and a " + FLOOR_PCT + " floor", "1 de cada 10, con NINGUNA y umbral de " + FLOOR_PCT)]], value: "none" },
      { seg: "format", label: t("The writing desk replies with", "La mesa de escritura responde con"), options: [["label", t("The bare label", "Solo la etiqueta")], ["json", "JSON"], ["reason", t("Reasoning, then the label", "Razonamiento, luego la etiqueta")]], value: "json" },
      { seg: "output", label: t("Its output is", "Su salida es"), options: [["free", t("Free text", "Texto libre")], ["constrained", t("Constrained to the options", "Restringida a las opciones")]], value: "free" },
      { seg: "questions", label: t("Questions per ticket", "Preguntas por ticket"), options: [["1", "1"], ["3", "3"], ["6", "6"]], value: "1" },
      { speed: true, options: [[0.25, "1/4"], [0.5, "1/2"], [1, t("Real time", "Tiempo real")]], value: 0.5 },
      { actions: [["burst", t("Send 1,000 tickets", "Enviar 1,000 tickets"), { primary: true }], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Changing a setting starts the run again. Send 1,000 tickets runs them through the same model at once and adds them to the counts; the machine carries on one ticket at a time. Counting always has 8 options, 0 to 6 and 7+, so the queue settings don't apply to it. An unlisted ticket belongs to a queue past the end of the list.",
      "Cambiar un ajuste reinicia la ejecución. Enviar 1,000 tickets los pasa por el mismo modelo de golpe y los suma a las cuentas; la máquina sigue con un ticket a la vez. Contar siempre tiene 8 opciones, de 0 a 6 y 7+, así que los ajustes de colas no se aplican. Un ticket fuera de la lista es de una cola más allá del final de la lista."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded runs of " + int(TICKETS) + " tickets each.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " ejecuciones con semilla fija de " + int(TICKETS) + " tickets cada una."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson; its times, error rates and accuracies are illustrative, not measurements of any product. Facts about Jev come from TypeSafe's documentation and launch post as reported in <a href="https://newsletter.victordibia.com/p/how-jev-works-calibrated-decision" target="_blank" rel="noopener">Victor Dibia, "How Jev works"</a>, <a href="https://hackernoon.com/inside-jev-how-decision-models-trade-text-generation-for-typed-calibrated-answers" target="_blank" rel="noopener">"Inside Jev" (HackerNoon)</a> and <a href="https://nexos.ai/blog/what-is-jev/" target="_blank" rel="noopener">nexos.ai, "What is Jev"</a>, and from <a href="https://arxiv.org/pdf/2610.11978" target="_blank" rel="noopener">Li et al., "Specialized Decision Models vs. General-Purpose LLMs: Benchmarking Jev" (arXiv 2610.11978)</a>. Constrained decoding: <a href="https://openai.com/index/introducing-structured-outputs-in-the-api/" target="_blank" rel="noopener">OpenAI, "Introducing Structured Outputs in the API"</a> and <a href="https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md" target="_blank" rel="noopener">llama.cpp's GBNF grammars</a>.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección; sus tiempos, tasas de error y precisiones son ilustrativos, no mediciones de ningún producto. Los datos sobre Jev vienen de la documentación y el anuncio de TypeSafe tal como los reportan <a href="https://newsletter.victordibia.com/p/how-jev-works-calibrated-decision" target="_blank" rel="noopener">Victor Dibia, "How Jev works"</a>, <a href="https://hackernoon.com/inside-jev-how-decision-models-trade-text-generation-for-typed-calibrated-answers" target="_blank" rel="noopener">"Inside Jev" (HackerNoon)</a> y <a href="https://nexos.ai/blog/what-is-jev/" target="_blank" rel="noopener">nexos.ai, "What is Jev"</a>, y de <a href="https://arxiv.org/pdf/2610.11978" target="_blank" rel="noopener">Li et al., "Specialized Decision Models vs. General-Purpose LLMs: Benchmarking Jev" (arXiv 2610.11978)</a>. Decodificación restringida: <a href="https://openai.com/index/introducing-structured-outputs-in-the-api/" target="_blank" rel="noopener">OpenAI, "Introducing Structured Outputs in the API"</a> y <a href="https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md" target="_blank" rel="noopener">las gramáticas GBNF de llama.cpp</a>.`),
  css: `
.iso-stage [data-layer] text{pointer-events:none}
`,
  data: { P, G: GEOMETRY, SLIP_SVG: slipSvg(), TICKET_SVG: ticketSvg() },
});
