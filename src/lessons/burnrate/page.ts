// @ts-nocheck: content in the style of the other lessons
// Systems lesson 72 · Burn-rate alerts: an error-budget tank between a static threshold and a burn-rate alarm.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, one, int } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, P, GEOMETRY } from "./figure";
import { blipsRun, leakRun, holdRun, partialRun, resetRun, BLIP, BASE, FAULTS, RPM, BUDGET_ERRORS, RESET_LEN } from "./sim";

// Experiment results, computed at build time from the same model the page runs (eight seeds each).
const R = { blips: blipsRun(), leak: leakRun(), hold: holdRun(), partial: partialRun(), reset: resetRun() };

const pc = (x) => (x < 0.1 ? (100 * x).toFixed(1) : String(Math.round(100 * x))) + "%";
const top = (...xs) => Math.max(...xs) * 1.08 || 1;
const h1 = (x) => x.toFixed(1) + " h";
const mins = (x) => n0(x) + " min";
const BLIP_RANGE = Math.round(100 * BLIP.rate[0]) + "–" + Math.round(100 * BLIP.rate[1]) + "%";
const BLIP_MINS = BLIP.mins[0] + "–" + BLIP.mins[1];
const OUTAGE_ERRORS = RESET_LEN * RPM;

// What each card shows after a run.
const RUNS = {
  blips: () => {
    const { blips, staticPages, pages, tickets, used } = R.blips, m = top(blips);
    return {
      verdict: t("In 30 days: " + n0(blips) + " blips. The static alarm paged " + n0(staticPages) + " times; the burn-rate alarm paged " + n0(pages) + " times and opened " + n0(tickets) + " tickets. The whole month used " + pc(used) + " of its error budget.",
        "En 30 días: " + n0(blips) + " picos. La alarma fija avisó " + n0(staticPages) + " veces; la alarma por tasa de consumo avisó " + n0(pages) + " veces y abrió " + n0(tickets) + " tickets. El mes completo usó el " + pc(used) + " de su presupuesto de errores."),
      groups: [
        { title: t("Pages in 30 days", "Avisos en 30 días"), bars: [[t("Static alarm", "Alarma fija"), staticPages / m, n0(staticPages), true], [t("Burn-rate alarm", "Alarma por tasa de consumo"), pages / m, n0(pages)]] },
        { title: t("Error budget used", "Presupuesto de errores usado"), bars: [[t("The whole month", "El mes completo"), used, pc(used)]] },
      ],
    };
  },
  leak: () => {
    const { staticPages, pages, ticketH, usedAtTicket, emptyDay } = R.leak, m = (emptyDay - 1) * 24;
    return {
      verdict: t("Static alarm: " + n0(staticPages) + " pages. Burn-rate alarm: " + n0(pages) + " pages, and a ticket " + h1(ticketH) + " after the leak began, with " + pc(usedAtTicket) + " of the budget spent. Left alone, the leak emptied the budget on day " + one(emptyDay) + ".",
        "Alarma fija: " + n0(staticPages) + " avisos. Alarma por tasa de consumo: " + n0(pages) + " avisos, y un ticket " + h1(ticketH) + " después de que empezó la fuga, con el " + pc(usedAtTicket) + " del presupuesto gastado. Sin arreglo, la fuga vació el presupuesto el día " + one(emptyDay) + "."),
      groups: [
        { title: t("Hours from the start of the leak", "Horas desde que empezó la fuga"), bars: [[t("Burn-rate ticket", "Ticket por tasa de consumo"), ticketH / m, h1(ticketH)], [t("Budget empty", "Presupuesto vacío"), 1, h1(m), true]] },
        { title: t("Pages", "Avisos"), bars: [[t("Static alarm", "Alarma fija"), 0, n0(staticPages), true], [t("Burn-rate alarm", "Alarma por tasa de consumo"), 0, n0(pages)]] },
      ],
    };
  },
  hold: () => {
    const { quietPages, loudPages, staticMin, staticSpent, burnMin, burnSpent } = R.hold, m = top(loudPages);
    return {
      verdict: t("Waiting 30 minutes, the static alarm paged " + n0(quietPages) + " times for blips in 30 days (" + n0(loudPages) + " without the wait). In the outage it paged after " + mins(staticMin) + ", with " + pc(staticSpent) + " of the month's budget spent; the burn-rate alarm paged after " + mins(burnMin) + ", with " + pc(burnSpent) + ".",
        "Esperando 30 minutos, la alarma fija avisó " + n0(quietPages) + " veces por picos en 30 días (" + n0(loudPages) + " sin la espera). En la caída avisó después de " + mins(staticMin) + ", con el " + pc(staticSpent) + " del presupuesto del mes gastado; la alarma por tasa de consumo avisó después de " + mins(burnMin) + ", con el " + pc(burnSpent) + "."),
      groups: [
        { title: t("Blip pages in 30 days", "Avisos por picos en 30 días"), bars: [[t("Static, no wait", "Fija, sin espera"), loudPages / m, n0(loudPages)], [t("Static, 30-min wait", "Fija, espera de 30 min"), quietPages / m, n0(quietPages)]] },
        { title: t("Budget spent before the outage page", "Presupuesto gastado antes del aviso de la caída"), bars: [[t("Static, 30-min wait", "Fija, espera de 30 min"), staticSpent, pc(staticSpent), true], [t("Burn-rate alarm", "Alarma por tasa de consumo"), burnSpent, pc(burnSpent)]] },
      ],
    };
  },
  partial: () => {
    const { staticPages, pageH, spentAtPage, burn, lastsDays } = R.partial, m = lastsDays * 24;
    return {
      verdict: t("The 1-hour tier never fired. The 6-hour tier paged " + h1(pageH) + " after the outage began, with " + pc(spentAtPage) + " of the budget spent; at " + one(burn) + "× the whole budget lasts " + one(lastsDays) + " days. The static alarm fired " + n0(staticPages) + " times in the two days, on noise around its 1% line.",
        "El nivel de 1 hora nunca se disparó. El nivel de 6 horas avisó " + h1(pageH) + " después de que empezó la caída, con el " + pc(spentAtPage) + " del presupuesto gastado; a " + one(burn) + "× el presupuesto completo dura " + one(lastsDays) + " días. La alarma fija se disparó " + n0(staticPages) + " veces en los dos días, por ruido alrededor de su línea de 1%."),
      groups: [
        { title: t("Hours to the page", "Horas hasta el aviso"), bars: [[t("Burn-rate, 6-hour tier", "Tasa de consumo, nivel de 6 h"), pageH / m, h1(pageH), true], [t("Budget empty, at this pace", "Presupuesto vacío, a este ritmo"), 1, h1(m)]] },
        { title: t("Static alarm, two days", "Alarma fija, dos días"), bars: [[t("Times it fired", "Veces que se disparó"), Math.min(1, staticPages / 100), n0(staticPages), true]] },
      ],
    };
  },
  reset: () => {
    const { multi, long } = R.reset, m = top(long.offMin);
    return {
      verdict: t("Both paged " + mins(multi.pageMin) + " into the outage. Long and short windows: the page cleared " + mins(multi.offMin) + " after the fix. Long windows only: " + mins(long.offMin) + " (" + h1(long.offMin / 60) + "), and the ticket stayed open " + h1(long.ticketOffH) + " (" + h1(multi.ticketOffH) + " with short windows). The static alarm cleared after " + mins(multi.staticOff) + ".",
        "Las dos avisaron " + mins(multi.pageMin) + " después de empezar la caída. Ventanas larga y corta: el aviso se cerró " + mins(multi.offMin) + " después del arreglo. Solo ventanas largas: " + mins(long.offMin) + " (" + h1(long.offMin / 60) + "), y el ticket siguió abierto " + h1(long.ticketOffH) + " (" + h1(multi.ticketOffH) + " con ventanas cortas). La alarma fija se cerró " + mins(multi.staticOff) + " después del arreglo."),
      bars: [[t("Page open after the fix, long only", "Aviso abierto tras el arreglo, solo largas"), long.offMin / m, mins(long.offMin), true], [t("Page open after the fix, long and short", "Aviso abierto tras el arreglo, larga y corta"), multi.offMin / m, mins(multi.offMin)], [t("Static alarm open after the fix", "Alarma fija abierta tras el arreglo"), multi.staticOff / m, mins(multi.staticOff)]],
    };
  },
};

const { blips: B, leak: K, hold: H, partial: Q, reset: Z } = R;
const BASE_PCT = (100 * BASE).toFixed(2) + "%";

const EXPERIMENTS = [
  {
    id: "blips",
    title: t("A month of blips", "Un mes de picos"),
    change: t("No fault · about 1.5 blips a day, each failing " + BLIP_RANGE + " of requests for " + BLIP_MINS + " minutes · 30 days · the static alarm vs the burn-rate alarm",
      "Sin falla · unos 1.5 picos al día, cada uno con el " + BLIP_RANGE + " de las solicitudes fallando durante " + BLIP_MINS + " minutos · 30 días · la alarma fija vs la alarma por tasa de consumo"),
    question: t("Over the 30 days, how often does each alarm page?", "En los 30 días, ¿cuántas veces avisa cada alarma?"),
    options: [
      t("Neither pages: blips this short don't reach either line", "Ninguna avisa: picos tan cortos no llegan a ninguna línea"),
      t("The static alarm pages most days; the burn-rate one never does", "La fija avisa casi todos los días; la de tasa de consumo, nunca"),
      t("Both page on the bigger blips, the static one a bit more often", "Las dos avisan en los picos grandes, la fija un poco más seguido"),
    ],
    answer: 1,
    why: t(
      "A 2-minute blip at 5% lifts the 5-minute error rate to 2%, over the static line, so the static alarm paged " + n0(B.staticPages) + " times in the month for failures nobody had to act on. The whole month, blips and background together, used " + pc(B.used) + " of the budget. The burn-rate alarm measures failures against the budget: even a 3-minute blip at 8% fails 240 requests, 0.4% of the hour's traffic, a burn of 4× over the hour, far under the 14.4× line. A page should mean the budget is in danger, and none of these blips put it there.",
      "Un pico de 2 minutos al 5% sube la tasa de error de 5 minutos al 2%, por encima de la línea fija, así que la alarma fija avisó " + n0(B.staticPages) + " veces en el mes por fallos que nadie tenía que atender. El mes completo, picos y fondo juntos, usó el " + pc(B.used) + " del presupuesto. La alarma por tasa de consumo mide los fallos contra el presupuesto: hasta un pico de 3 minutos al 8% hace fallar 240 solicitudes, el 0.4% del tráfico de la hora, un consumo de 4× en la hora, muy por debajo de la línea de 14.4×. Un aviso debería significar que el presupuesto está en peligro, y ninguno de estos picos lo puso ahí.",
    ),
    watch: { blips: "on", static: "0", windows: "multi", fault: "none", speed: 360 },
  },
  {
    id: "leak",
    title: t("A slow leak", "Una fuga lenta"),
    change: t("Blips off · from day 1, a bad config fails " + pc(FAULTS.leak) + " of requests, twice the pace the budget allows, and nobody fixes it · 30 days",
      "Picos apagados · desde el día 1, una configuración mala hace fallar el " + pc(FAULTS.leak) + " de las solicitudes, el doble del ritmo que permite el presupuesto, y nadie lo arregla · 30 días"),
    question: t("Which alarm notices the leak, and when?", "¿Qué alarma nota la fuga, y cuándo?"),
    options: [
      t("The static alarm, within minutes of the leak starting", "La alarma fija, a los pocos minutos de empezar la fuga"),
      t("Neither: a leak this small is under both lines for good", "Ninguna: una fuga tan pequeña queda bajo las dos líneas"),
      t("The burn-rate alarm, with a ticket after a day or so", "La de tasa de consumo, con un ticket después de un día o algo así"),
    ],
    answer: 2,
    why: t(
      "0.2% never comes near the 1% line, so the static alarm stays quiet while the tank empties: the budget ran out on day " + one(K.emptyDay) + ". Measured against the budget, the same leak (plus the " + BASE_PCT + " background) is a burn of 2.2×, and the 1× tier's 3-day window crosses its line once enough of the leak has filled it: a ticket " + h1(K.ticketH) + " in, with " + pc(K.usedAtTicket) + " of the budget spent, the share the Google SRE Workbook's table gives that tier (1× for 3 days of 30). It's a ticket, not a page: at this pace someone has days to fix it in working hours. A static line low enough to catch 0.2% would also page on every blip.",
      "El 0.2% nunca se acerca a la línea de 1%, así que la alarma fija calla mientras el tanque se vacía: el presupuesto se acabó el día " + one(K.emptyDay) + ". Medida contra el presupuesto, la misma fuga (más el " + BASE_PCT + " de fondo) es un consumo de 2.2×, y la ventana de 3 días del nivel de 1× cruza su línea cuando ya se llenó con suficiente fuga: un ticket después de " + h1(K.ticketH) + ", con el " + pc(K.usedAtTicket) + " del presupuesto gastado, la parte que la tabla del Google SRE Workbook le da a ese nivel (1× durante 3 días de 30). Es un ticket, no un aviso: a este ritmo alguien tiene días para arreglarlo en horario laboral. Una línea fija lo bastante baja para ver el 0.2% también avisaría en cada pico.",
    ),
    watch: { blips: "off", static: "0", windows: "multi", fault: "leak", speed: 360 },
  },
  {
    id: "hold",
    title: t("Make the static alarm wait", "Hacer esperar a la alarma fija"),
    change: t("To stop the blip pages, the static alarm pages only once its 5-minute rate has stayed over 1% for 30 minutes (a for: clause) · on day 10, a bad deploy fails every request",
      "Para frenar los avisos por picos, la alarma fija avisa solo cuando su tasa de 5 minutos lleva 30 minutos sobre 1% (una cláusula for:) · el día 10, un despliegue malo hace fallar todas las solicitudes"),
    question: t("Once the outage starts, what does the 30-minute wait cost?", "Cuando empieza la caída, ¿cuánto cuesta la espera de 30 minutos?"),
    options: [
      t("Little: an outage this big still pages within minutes", "Poco: una caída así de grande igual avisa en minutos"),
      t("Most of the month's budget is gone before it pages", "Casi todo el presupuesto del mes se va antes del aviso"),
      t("It pages at once: the wait only applies to small spikes", "Avisa de inmediato: la espera solo aplica a picos pequeños"),
    ],
    answer: 1,
    why: t(
      "The wait does stop the blip pages (" + n0(H.quietPages) + " in the month, against " + n0(H.loudPages) + "): no blip keeps the 5-minute rate over 1% for half an hour. But a full outage has to wait too: the static alarm paged after " + mins(H.staticMin) + ", with " + pc(H.staticSpent) + " of the month's budget already failed. The burn-rate alarm paged after " + mins(H.burnMin) + ", at " + pc(H.burnSpent) + ": at 1,000× the budget's pace, the 1-hour window passes 14.4× within the first minute. A duration clause makes every alert wait the same time; a burn-rate threshold waits for a share of the budget, so the faster the burn, the sooner the page.",
      "La espera sí frena los avisos por picos (" + n0(H.quietPages) + " en el mes, contra " + n0(H.loudPages) + "): ningún pico mantiene la tasa de 5 minutos sobre 1% durante media hora. Pero una caída total también tiene que esperar: la alarma fija avisó después de " + mins(H.staticMin) + ", con el " + pc(H.staticSpent) + " del presupuesto del mes ya fallado. La alarma por tasa de consumo avisó después de " + mins(H.burnMin) + ", con el " + pc(H.burnSpent) + ": a 1,000× el ritmo del presupuesto, la ventana de 1 hora pasa 14.4× en el primer minuto. Una cláusula de duración hace esperar lo mismo a toda alerta; un umbral de tasa de consumo espera una parte del presupuesto, así que cuanto más rápido se consume, antes llega el aviso.",
    ),
    watch: { blips: "on", static: "30", windows: "multi", fault: "none", outage: 40, speed: 10 },
  },
  {
    id: "partial",
    title: t("A partial outage", "Una caída parcial"),
    change: t("Blips off · from day 1, one bad replica makes " + pc(FAULTS.partial) + " of requests fail, 8× the budget's pace · not fixed",
      "Picos apagados · desde el día 1, una réplica mala hace fallar el " + pc(FAULTS.partial) + " de las solicitudes, 8× el ritmo del presupuesto · sin arreglo"),
    question: t("What does the burn-rate alarm do?", "¿Qué hace la alarma por tasa de consumo?"),
    options: [
      t("Pages within the hour: 8× empties the budget in days", "Avisa en menos de una hora: 8× vacía el presupuesto en días"),
      t("Opens a ticket only: 8× is under the 14.4× page line", "Solo abre un ticket: 8× está bajo la línea de aviso de 14.4×"),
      t("Pages after a few hours, through its 6-hour tier", "Avisa después de unas horas, por su nivel de 6 horas"),
    ],
    answer: 2,
    why: t(
      one(Q.burn) + "× (with the background) is under 14.4×, so the 1-hour tier never fires. The 6-hour tier pages once its long window averages more than 6×: after " + h1(Q.pageH) + ", with " + pc(Q.spentAtPage) + " of the budget spent, the share that row of the table is built for (6× for 6 hours of 720). That is early enough: at this pace the whole budget lasts " + one(Q.lastsDays) + " days. Each tier fires at about the same share of the budget whatever the burn, so a slower burn gets a later page, and the slowest gets a ticket. The static alarm, meanwhile, flapped: at 0.82% the 5-minute rate wanders across 1% on noise alone, and it fired " + n0(Q.staticPages) + " times in two days.",
      one(Q.burn) + "× (con el fondo) está bajo 14.4×, así que el nivel de 1 hora nunca se dispara. El nivel de 6 horas avisa cuando su ventana larga promedia más de 6×: después de " + h1(Q.pageH) + ", con el " + pc(Q.spentAtPage) + " del presupuesto gastado, la parte para la que está hecha esa fila de la tabla (6× durante 6 horas de 720). Es suficientemente pronto: a este ritmo el presupuesto completo dura " + one(Q.lastsDays) + " días. Cada nivel se dispara con más o menos la misma parte del presupuesto gastada, sea cual sea el consumo, así que un consumo más lento recibe un aviso más tarde, y el más lento, un ticket. Mientras tanto, la alarma fija oscilaba: al 0.82%, la tasa de 5 minutos cruza el 1% solo por ruido, y se disparó " + n0(Q.staticPages) + " veces en dos días.",
    ),
    watch: { blips: "off", static: "0", windows: "multi", fault: "partial", speed: 60 },
  },
  {
    id: "reset",
    title: t("After the fix", "Después del arreglo"),
    change: t("Blips off · a " + RESET_LEN + "-minute full outage, then fixed · the burn-rate alarm with long and short windows vs long windows only",
      "Picos apagados · una caída total de " + RESET_LEN + " minutos, luego arreglada · la alarma por tasa de consumo con ventanas larga y corta vs solo ventanas largas"),
    question: t("With long windows only, how long does the page stay open after the fix?", "Con solo ventanas largas, ¿cuánto sigue abierto el aviso después del arreglo?"),
    options: [
      t("A few minutes, like the static alarm", "Unos minutos, como la alarma fija"),
      t("About an hour, the length of the 1-hour window", "Cerca de una hora, lo que dura la ventana de 1 hora"),
      t("Hours: the 6-hour window still holds the outage", "Horas: la ventana de 6 horas todavía contiene la caída"),
    ],
    answer: 2,
    why: t(
      "A long window remembers. The outage failed " + int(OUTAGE_ERRORS) + " requests, " + pc(OUTAGE_ERRORS / BUDGET_ERRORS) + " of the month's budget, and while they sit inside the 6-hour window its average stays over 6×. With long windows only, the page stayed open " + mins(Z.long.offMin) + " after the fix, and the ticket " + h1(Z.long.ticketOffH) + ": alerts for a burn that had already stopped. The short windows end it: each tier fires only while its short window, 1/12 of the long one, also burns past the line, and the 6-hour tier's 30-minute window is clear of the outage half an hour after the fix (" + mins(Z.multi.offMin) + "). The 1-hour tier's 5-minute window had let go after 5.",
      "Una ventana larga recuerda. La caída hizo fallar " + int(OUTAGE_ERRORS) + " solicitudes, el " + pc(OUTAGE_ERRORS / BUDGET_ERRORS) + " del presupuesto del mes, y mientras estén dentro de la ventana de 6 horas su promedio sigue sobre 6×. Con solo ventanas largas, el aviso siguió abierto " + mins(Z.long.offMin) + " después del arreglo, y el ticket " + h1(Z.long.ticketOffH) + ": alertas por un consumo que ya había terminado. Las ventanas cortas lo cierran: cada nivel se dispara solo mientras su ventana corta, 1/12 de la larga, también consume por encima de la línea, y la ventana de 30 minutos del nivel de 6 horas queda libre de la caída media hora después del arreglo (" + mins(Z.multi.offMin) + "). La ventana de 5 minutos del nivel de 1 hora ya la había soltado a los 5.",
    ),
    watch: { blips: "off", static: "0", windows: "long", fault: "none", outage: RESET_LEN, speed: 60 },
  },
];

const QUESTIONS = [
  [t("What is a burn rate, and what does \"14.4× over 1 hour\" mean for a 99.9% SLO over 30 days?", "¿Qué es la tasa de consumo, y qué significa \"14.4× en 1 hora\" para un SLO de 99.9% en 30 días?"),
    t("The burn rate is the error rate divided by the error rate the SLO allows (here 0.1%). At 1× the budget lasts exactly the 30 days; at 14.4× it would last 720 ÷ 14.4 = 50 hours. An hour at 14.4× spends 14.4 of the budget's 720 hours, 2%, which is why that tier pages: keep it up for two days and the month's budget is gone.",
      "La tasa de consumo es la tasa de error dividida por la tasa de error que permite el SLO (aquí 0.1%). A 1×, el presupuesto dura exactamente los 30 días; a 14.4× duraría 720 ÷ 14.4 = 50 horas. Una hora a 14.4× gasta 14.4 de las 720 horas del presupuesto, el 2%, y por eso ese nivel avisa: si sigue así dos días, se acaba el presupuesto del mes.")],
  [t("Why does a fixed threshold on the error rate page on harmless blips and still miss a leak that empties the budget?", "¿Por qué un umbral fijo sobre la tasa de error avisa en picos inofensivos y aun así no ve una fuga que vacía el presupuesto?"),
    t("It looks at the rate in a short window, not at what the failures cost. A spike of a few minutes crosses the line while spending a fraction of a percent of the budget; a steady rate under the line can still be several times the pace the budget allows. Moving the line only trades one mistake for the other: lower, it pages on more blips; higher, it misses more leaks.",
      "Mira la tasa en una ventana corta, no lo que cuestan los fallos. Un pico de pocos minutos cruza la línea gastando una fracción de un por ciento del presupuesto; una tasa estable bajo la línea puede ser varias veces el ritmo que permite el presupuesto. Mover la línea solo cambia un error por otro: más baja, avisa en más picos; más alta, deja pasar más fugas.")],
  [t("Each tier checks a long and a short window. What does each window do?", "Cada nivel revisa una ventana larga y una corta. ¿Qué hace cada una?"),
    t("The long window decides significance: it fires only once a real share of the budget (2%, 5%, 10%) has burned, so a short spike can't page. The short window, about 1/12 of the long one, decides the reset: the tier stops firing soon after the burn stops, instead of paging for an outage that is already over while the long window still holds it.",
      "La ventana larga decide si importa: se dispara solo cuando ya se consumió una parte real del presupuesto (2%, 5%, 10%), así que un pico corto no avisa. La ventana corta, cerca de 1/12 de la larga, decide cuándo se apaga: el nivel deja de dispararse poco después de que termina el consumo, en lugar de avisar por una caída que ya pasó mientras la ventana larga todavía la contiene.")],
  [t("Why several tiers instead of one burn-rate threshold?", "¿Por qué varios niveles en lugar de un solo umbral de tasa de consumo?"),
    t("One fast tier (14.4× over 1 hour) never sees a steady 8× burn that empties the budget in under four days; one slow tier pages hours late on a full outage. Each tier fires after about the same share of the budget whatever the burn rate, so detection time scales with severity: a full outage pages within minutes, a moderate burn within hours, a slow leak gets a ticket for working hours.",
      "Un solo nivel rápido (14.4× en 1 hora) nunca ve un consumo estable de 8× que vacía el presupuesto en menos de cuatro días; un solo nivel lento avisa horas tarde ante una caída total. Cada nivel se dispara con más o menos la misma parte del presupuesto gastada sea cual sea la tasa, así que el tiempo de detección se ajusta a la gravedad: una caída total avisa en minutos, un consumo moderado en horas, una fuga lenta recibe un ticket para el horario laboral.")],
  [t("At night your service gets 50 requests an hour. What goes wrong with these alerts, and what can you do?", "De noche tu servicio recibe 50 solicitudes por hora. ¿Qué sale mal con estas alertas y qué puedes hacer?"),
    t("One failure in 50 is a 2% error rate, a burn of 20×: a single failed request pages. The ratio is fine; there just isn't enough traffic for it to mean much. Options: add synthetic traffic (probes) so there is always enough to measure, group small services under one SLO, require a minimum number of failures before paging, or measure over a longer window and accept slower detection.",
      "Un fallo en 50 es una tasa de error de 2%, un consumo de 20×: una sola solicitud fallida avisa. La proporción está bien; solo que no hay tráfico suficiente para que signifique mucho. Opciones: agregar tráfico sintético (sondas) para que siempre haya suficiente que medir, agrupar servicios pequeños bajo un solo SLO, exigir un mínimo de fallos antes de avisar, o medir en una ventana más larga y aceptar una detección más lenta.")],
  [t("How would you write the 14.4× page as a Prometheus alert, and does it need a for: clause?", "¿Cómo escribirías el aviso de 14.4× como alerta de Prometheus, y necesita una cláusula for:?"),
    t("Record the error ratio over 1 h and over 5 m, e.g. sum(rate(http_requests_total{code=~\"5..\"}[1h])) / sum(rate(http_requests_total[1h])), and alert on ratio_1h > 14.4 * 0.001 and ratio_5m > 14.4 * 0.001; likewise 6× over 6 h and 30 m. The windows already filter blips, so a long for: only delays the page. Tools such as Sloth and Pyrra generate these rules from an SLO definition. A latency SLO works the same way if you count slow requests as bad ones (lesson 44, Percentiles).",
      "Registra la proporción de errores en 1 h y en 5 m, por ejemplo sum(rate(http_requests_total{code=~\"5..\"}[1h])) / sum(rate(http_requests_total[1h])), y alerta con ratio_1h > 14.4 * 0.001 and ratio_5m > 14.4 * 0.001; lo mismo para 6× en 6 h y 30 m. Las ventanas ya filtran los picos, así que un for: largo solo retrasa el aviso. Herramientas como Sloth y Pyrra generan estas reglas a partir de la definición de un SLO. Un SLO de latencia funciona igual si cuentas las solicitudes lentas como malas (lección 44, Percentiles).")],
];

export default defineLesson({
  title: t("Burn-Rate Alerts Workbench", "Banco de trabajo: alertas por tasa de consumo"),
  eyebrow: t("Systems lesson 72 · Burn-rate alerts", "Lección de sistemas 72 · Alertas por tasa de consumo"),
  lede: t("An SLO turns reliability into an error budget: at 99.9% over 30 days, 0.1% of requests may fail, and the burn rate says how fast you are spending it. Alerting on the burn rate, over a long and a short window, pages for what threatens the budget and stays quiet for what doesn't. This lesson puts an error-budget tank between a static threshold and a burn-rate alarm: watch both, predict which one pages, then explain it back.",
    "Un SLO convierte la confiabilidad en un presupuesto de errores (error budget): con 99.9% en 30 días puede fallar el 0.1% de las solicitudes, y la tasa de consumo (burn rate) dice qué tan rápido lo estás gastando. Alertar sobre la tasa de consumo, en una ventana larga y una corta, avisa por lo que amenaza el presupuesto y calla ante lo que no. Esta lección pone un tanque de presupuesto de errores entre un umbral fijo y una alarma por tasa de consumo: mira las dos, predice cuál avisa y después explícalo."),
  machine: {
    intro: t("A service takes 1,000 requests a minute against a 99.9% availability SLO, so its error budget for 30 days is 43,200 failed requests: the water in the tank. A few requests fail all the time, and about one and a half times a day a blip fails a few percent of them for one to three minutes. The static alarm on the left pages whenever the error rate over the last 5 minutes passes 1%. The burn-rate console on the right divides the error rate by the 0.1% the SLO allows, so 1× spends the budget in exactly 30 days; its three tiers follow the Google SRE Workbook. Switch on a fault, cause a blip or an outage, and watch which alarm notices.",
      "Un servicio recibe 1,000 solicitudes por minuto con un SLO de disponibilidad de 99.9%, así que su presupuesto de errores para 30 días es de 43,200 solicitudes fallidas: el agua del tanque. Unas pocas solicitudes fallan todo el tiempo, y cerca de una vez y media al día un pico hace fallar un pequeño porcentaje durante uno a tres minutos. La alarma fija de la izquierda avisa a la guardia (page) cada vez que la tasa de error de los últimos 5 minutos pasa del 1%. La consola de la derecha divide la tasa de error por el 0.1% que permite el SLO, así que 1× gasta el presupuesto en exactamente 30 días; sus tres niveles siguen el Google SRE Workbook. Activa una falla, provoca un pico o una caída, y mira qué alarma lo nota."),
    plate: {
      title: t("Error-budget tank", "Tanque de presupuesto"),
      keys: [
        { mark: "lit", label: t("A firing alarm: the static lamp, a tier's beacon; the pager the engineer on call holds up while a page is open", "Una alarma disparada: la lámpara fija, la baliza de un nivel; el buscapersonas que levanta la persona de guardia mientras hay un aviso abierto") },
        { mark: "raised", label: t("The recorder (static alarm), the tank (error budget) and the console (burn-rate alarm)", "El registrador (alarma fija), el tanque (presupuesto de errores) y la consola (alarma por tasa de consumo)") },
        { mark: "flat", label: t("The drain: every failed request leaves the tank through it", "El desagüe: cada solicitud fallida sale del tanque por ahí") },
      ],
      caption: t(
        "Time runs at one hour a second by default (change it under Speed). The numbers are illustrative and round: 1,000 requests a minute, " + BASE_PCT + " failing in the background, blips of " + BLIP_RANGE + " for " + BLIP_MINS + " minutes. The recorder plots the 5-minute error rate over the last 24 hours against its dashed 1% line, and its clock shows the time of day. The tank holds what is left of the budget for the last 30 days. On the console, each tier has a meter for its long window (top) and its short window (bottom); a needle in the shaded half is past the tier's line, and the beacon lights while both are (with long windows only, the top one alone). Counters: pages from each alarm, tickets, the day, and the budget left in percent.",
        "El tiempo corre a una hora por segundo por defecto (cámbialo en Velocidad). Los números son ilustrativos y redondos: 1,000 solicitudes por minuto, " + BASE_PCT + " fallando de fondo, picos de " + BLIP_RANGE + " durante " + BLIP_MINS + " minutos. El registrador grafica la tasa de error de 5 minutos de las últimas 24 horas contra su línea punteada de 1%, y su reloj muestra la hora del día. El tanque guarda lo que queda del presupuesto de los últimos 30 días. En la consola, cada nivel tiene un medidor para su ventana larga (arriba) y otro para su ventana corta (abajo); una aguja en la mitad sombreada pasó la línea del nivel, y la baliza se enciende mientras las dos lo están (con solo ventanas largas, basta la de arriba). Contadores: avisos de cada alarma, tickets, el día y el presupuesto que queda en porcentaje.",
      ),
      stage: { "data-budget-tank": "" },
      label: t("Burn-rate alerting simulation. Space pauses or resumes.", "Simulación de alertas por tasa de consumo. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["day", t("Day", "Día"), "2 · 00:00"],
      ["left", t("Budget left", "Presupuesto restante")],
      ["burn", t("Burn rate, 1 h", "Tasa de consumo, 1 h")],
      ["staticPages", t("Static pages", "Avisos fijos")],
      ["pages", t("Burn-rate pages", "Avisos por consumo")],
      ["tickets", t("Tickets", "Tickets")],
    ],
    controls: [
      { seg: "fault", label: t("Fault", "Falla"), options: [["none", t("None", "Ninguna")], ["leak", t("Leak, 0.2%", "Fuga, 0.2%")], ["partial", t("Partial, 0.8%", "Parcial, 0.8%")], ["outage", t("Outage, 100%", "Caída, 100%")]], value: "none" },
      { seg: "blips", label: t("Blips", "Picos"), options: [["on", t("1.5 a day", "1.5 al día")], ["off", t("Off", "Apagados")]], value: "on" },
      { seg: "static", label: t("Static alarm", "Alarma fija"), options: [["0", t("Page at once", "Avisar de inmediato")], ["30", t("After 30 min over", "Tras 30 min encima")]], value: "0" },
      { seg: "windows", label: t("Burn-rate windows", "Ventanas de consumo"), options: [["multi", t("Long and short", "Larga y corta")], ["long", t("Long only", "Solo larga")]], value: "multi" },
      { speed: true, options: [[10, "10 min/s"], [60, "1 h/s"], [360, "6 h/s"]], value: 60 },
      { actions: [["blip", t("Blip now", "Pico ahora")], ["outage", t("10-min outage", "Caída de 10 min")], ["reset", t("Start over", "Empezar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("A fault starts the moment you pick it and runs until you pick None. Changing the blips or an alarm starts the run again, two days in.",
      "Una falla empieza en cuanto la eliges y sigue hasta que eliges Ninguna. Cambiar los picos o una alarma reinicia la ejecución, dos días adentro."),
  },
  predict: { intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over eight seeded runs.",
    "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre ocho ejecuciones con semilla fija."), experiments: withResults(EXPERIMENTS, RUNS) },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. The three tiers and their windows follow the chapter "Alerting on SLOs" of the Google SRE Workbook.`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Los tres niveles y sus ventanas siguen el capítulo "Alerting on SLOs" del Google SRE Workbook.`),
  css: LIT_FILL_CSS + `
.br-trace{fill:none;stroke:var(--anatomy-strong);stroke-width:1.1;stroke-linejoin:round}
.br-drop{fill:var(--anatomy-mid)}
.iso-solid.br-water>.iso-fill,.iso-solid.br-water>.iso-top{fill:var(--anatomy-faint)}
.iso-solid.br-water>.iso-shade{fill:color-mix(in srgb,var(--anatomy-faint) 60%,var(--anatomy-lo))}
`,
  data: { P, G: GEOMETRY },
});
