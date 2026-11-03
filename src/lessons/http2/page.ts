// @ts-nocheck: content in the style of the other lessons
// Systems lesson 49 · HTTP/1.1 vs HTTP/2: an order depot whose conveyor tracks are connections.
import { t } from "../../i18n";
import { defineLesson, withResults } from "../types";
import { n0, pct } from "../../lib/format";
import { LIT_FILL_CSS } from "../../../workbench/parts.mjs";
import { buildFigure, packetSvg, cardSvg, P, GEOMETRY } from "./figure";
import { experimentResults, SEEDS } from "./sim";

// Experiment results, computed at build time from the same model the page runs (24 seeds each).
const R = experimentResults();
const ms = (x) => n0(x) + " ms";

// What each card shows after a run.
const RUNS = {
  many: () => {
    const { h1, h2 } = R.many, top = Math.max(h1.load, h2.load);
    return {
      verdict: t("Page load: " + ms(h1.load) + " over HTTP/1.1, " + ms(h2.load) + " over HTTP/2. The link was busy " + pct(h1.busy) + " of the time under HTTP/1.1 and " + pct(h2.busy) + " under HTTP/2.",
        "Carga de la página: " + ms(h1.load) + " con HTTP/1.1, " + ms(h2.load) + " con HTTP/2. El enlace estuvo ocupado el " + pct(h1.busy) + " del tiempo con HTTP/1.1 y el " + pct(h2.busy) + " con HTTP/2."),
      bars: [
        [t("Load, HTTP/1.1", "Carga, HTTP/1.1"), h1.load / top, ms(h1.load)],
        [t("Load, HTTP/2", "Carga, HTTP/2"), h2.load / top, ms(h2.load), true],
        [t("Link busy, HTTP/1.1", "Enlace ocupado, HTTP/1.1"), h1.busy, pct(h1.busy)],
        [t("Link busy, HTTP/2", "Enlace ocupado, HTTP/2"), h2.busy, pct(h2.busy), true],
      ],
    };
  },
  rtt: () => {
    const r = R.rtt, top = Math.max(r.base.load, r.h2base.load);
    const group = (title, a, b, c) => ({ title, bars: [
      [t("10 Mbps, 100 ms", "10 Mbps, 100 ms"), a.load / top, ms(a.load)],
      [t("50 Mbps, 100 ms", "50 Mbps, 100 ms"), b.load / top, ms(b.load)],
      [t("10 Mbps, 20 ms", "10 Mbps, 20 ms"), c.load / top, ms(c.load), true],
    ] });
    return {
      verdict: t("HTTP/1.1: " + ms(r.base.load) + " → " + ms(r.bw.load) + " with 5× the bandwidth, " + ms(r.near.load) + " with a 5× shorter round trip. HTTP/2: " + ms(r.h2base.load) + " → " + ms(r.h2bw.load) + " and " + ms(r.h2near.load) + ".",
        "HTTP/1.1: " + ms(r.base.load) + " → " + ms(r.bw.load) + " con 5× el ancho de banda, " + ms(r.near.load) + " con un viaje de ida y vuelta 5× más corto. HTTP/2: " + ms(r.h2base.load) + " → " + ms(r.h2bw.load) + " y " + ms(r.h2near.load) + "."),
      groups: [group(t("HTTP/1.1", "HTTP/1.1"), r.base, r.bw, r.near), group(t("HTTP/2", "HTTP/2"), r.h2base, r.h2bw, r.h2near)],
    };
  },
  slow: () => {
    const s = R.slow, top = Math.max(s.h1s.others, s.h1.others);
    return {
      verdict: t("The other 39 files were done at " + ms(s.h1.others) + " → " + ms(s.h1s.others) + " over HTTP/1.1, and " + ms(s.h2.others) + " → " + ms(s.h2s.others) + " over HTTP/2. The whole page waits for the slow file either way: " + ms(s.h1s.load) + " and " + ms(s.h2s.load) + ".",
        "Los otros 39 archivos terminaron a los " + ms(s.h1.others) + " → " + ms(s.h1s.others) + " con HTTP/1.1, y a los " + ms(s.h2.others) + " → " + ms(s.h2s.others) + " con HTTP/2. La página completa espera al archivo lento de todos modos: " + ms(s.h1s.load) + " y " + ms(s.h2s.load) + "."),
      bars: [
        [t("Other 39, HTTP/1.1, no slow file", "Otros 39, HTTP/1.1, sin archivo lento"), s.h1.others / top, ms(s.h1.others)],
        [t("Other 39, HTTP/1.1, slow file", "Otros 39, HTTP/1.1, archivo lento"), s.h1s.others / top, ms(s.h1s.others), true],
        [t("Other 39, HTTP/2, no slow file", "Otros 39, HTTP/2, sin archivo lento"), s.h2.others / top, ms(s.h2.others)],
        [t("Other 39, HTTP/2, slow file", "Otros 39, HTTP/2, archivo lento"), s.h2s.others / top, ms(s.h2s.others), true],
      ],
    };
  },
  loss: () => {
    const l = R.loss, top = Math.max(l.h1x.load, l.h2x.load);
    const group = (title, a, b, c) => ({ title, bars: [
      [t("No loss", "Sin pérdida"), a.load / top, ms(a.load)],
      [t("2% lost", "2% perdido"), b.load / top, ms(b.load), true],
      [t("5% lost", "5% perdido"), c.load / top, ms(c.load), true],
    ] });
    return {
      verdict: t("HTTP/1.1: " + ms(l.h1.load) + " → " + ms(l.h1l.load) + " → " + ms(l.h1x.load) + " at 0%, 2% and 5% loss. HTTP/2: " + ms(l.h2.load) + " → " + ms(l.h2l.load) + " → " + ms(l.h2x.load) + ". At 2%, " + n0(l.h2l.heldOther) + " packets per load waited behind another file's lost packet over HTTP/2, " + n0(l.h1l.heldOther) + " over HTTP/1.1.",
        "HTTP/1.1: " + ms(l.h1.load) + " → " + ms(l.h1l.load) + " → " + ms(l.h1x.load) + " con 0%, 2% y 5% de pérdida. HTTP/2: " + ms(l.h2.load) + " → " + ms(l.h2l.load) + " → " + ms(l.h2x.load) + ". Con 2%, " + n0(l.h2l.heldOther) + " paquetes por carga esperaron detrás del paquete perdido de otro archivo con HTTP/2, " + n0(l.h1l.heldOther) + " con HTTP/1.1."),
      groups: [group(t("HTTP/1.1", "HTTP/1.1"), l.h1, l.h1l, l.h1x), group(t("HTTP/2", "HTTP/2"), l.h2, l.h2l, l.h2x)],
    };
  },
  shard: () => {
    const s = R.shard, top = s.h1.load;
    return {
      verdict: t("Page load: " + ms(s.h1.load) + " with 6 connections, " + ms(s.h18.load) + " with 18, " + ms(s.h2.load) + " for HTTP/2 on one. Handshakes: " + n0(s.h1.handshakes) + ", " + n0(s.h18.handshakes) + " and " + n0(s.h2.handshakes) + ". With 2% loss: " + ms(s.h18l.load) + " for 18 connections, " + ms(s.h2l.load) + " for HTTP/2.",
        "Carga de la página: " + ms(s.h1.load) + " con 6 conexiones, " + ms(s.h18.load) + " con 18, " + ms(s.h2.load) + " con HTTP/2 en una. Handshakes: " + n0(s.h1.handshakes) + ", " + n0(s.h18.handshakes) + " y " + n0(s.h2.handshakes) + ". Con 2% de pérdida: " + ms(s.h18l.load) + " con 18 conexiones, " + ms(s.h2l.load) + " con HTTP/2."),
      bars: [
        [t("HTTP/1.1, 6 connections", "HTTP/1.1, 6 conexiones"), s.h1.load / top, ms(s.h1.load)],
        [t("HTTP/1.1, 18 connections", "HTTP/1.1, 18 conexiones"), s.h18.load / top, ms(s.h18.load), true],
        [t("HTTP/2, 1 connection", "HTTP/2, 1 conexión"), s.h2.load / top, ms(s.h2.load)],
        [t("Handshakes, 18 connections (of 18)", "Handshakes, 18 conexiones (de 18)"), s.h18.handshakes / 18, n0(s.h18.handshakes), true],
        [t("Handshakes, HTTP/2 (of 18)", "Handshakes, HTTP/2 (de 18)"), s.h2.handshakes / 18, n0(s.h2.handshakes)],
      ],
    };
  },
};

const BASE_WATCH = { proto: "h1", files: 40, rtt: 100, mbps: 10, loss: 0, conns: 6, slow: 0 };
const EXPERIMENTS = [
  {
    id: "many",
    title: t("A page of 40 small files", "Una página de 40 archivos pequeños"),
    change: t("HTTP/1.1 on 6 connections → HTTP/2 on 1 · 40 files of 1.5 to 10.5 KB · 100 ms round trip, 10 Mbps", "HTTP/1.1 en 6 conexiones → HTTP/2 en 1 · 40 archivos de 1.5 a 10.5 KB · viaje de ida y vuelta de 100 ms, 10 Mbps"),
    question: t("Same files, same bytes, same link. What happens to the load time?", "Mismos archivos, mismos bytes, mismo enlace. ¿Qué le pasa al tiempo de carga?"),
    options: [
      t("About the same: the same bytes cross the same link", "Más o menos igual: los mismos bytes cruzan el mismo enlace"),
      t("HTTP/2 is much faster: HTTP/1.1 spends most of the load waiting on round trips, not sending", "HTTP/2 es mucho más rápido: HTTP/1.1 pasa casi toda la carga esperando viajes de ida y vuelta, no enviando"),
      t("HTTP/1.1 is faster: six connections move more at once than one", "HTTP/1.1 es más rápido: seis conexiones mueven más a la vez que una"),
    ],
    answer: 1,
    why: t(
      "Each HTTP/1.1 connection carries one request at a time, so 40 files on 6 connections means about 7 requests in a row on each, and every request costs at least a round trip before its first byte comes back. The 5 new connections also spend 2 round trips on their TCP and TLS handshakes first. HTTP/2 sends all 40 requests at once, as separate streams on the connection that is already open, so the requests cost about one round trip in total; after that it waits on the link and on TCP's slow start. Watch the link meter: under HTTP/1.1 the link sits idle most of the time.",
      "Cada conexión HTTP/1.1 lleva una solicitud a la vez, así que 40 archivos en 6 conexiones son unas 7 solicitudes seguidas en cada una, y cada solicitud cuesta al menos un viaje de ida y vuelta (round trip) antes de que vuelva su primer byte. Las 5 conexiones nuevas además gastan primero 2 viajes de ida y vuelta en sus handshakes de TCP y TLS. HTTP/2 envía las 40 solicitudes de una vez, como flujos (streams) separados en la conexión que ya está abierta, así que las solicitudes cuestan en total más o menos un viaje de ida y vuelta; después espera al enlace y al arranque lento (slow start) de TCP. Mira el medidor del enlace: con HTTP/1.1 el enlace pasa casi todo el tiempo sin hacer nada.",
    ),
    watch: { ...BASE_WATCH },
  },
  {
    id: "rtt",
    title: t("More bandwidth or a shorter round trip?", "¿Más ancho de banda o un viaje de ida y vuelta más corto?"),
    change: t("40 files · bandwidth 10 → 50 Mbps, or round trip 100 → 20 ms · on HTTP/1.1 and on HTTP/2", "40 archivos · ancho de banda de 10 → 50 Mbps, o viaje de ida y vuelta de 100 → 20 ms · en HTTP/1.1 y en HTTP/2"),
    question: t("Both are five times better. Which one makes the page load faster?", "Las dos son cinco veces mejores. ¿Cuál hace que la página cargue más rápido?"),
    options: [
      t("The bandwidth: loading a page is moving bytes", "El ancho de banda: cargar una página es mover bytes"),
      t("The shorter round trip: with small files, most of the time is spent waiting, not sending", "El viaje más corto: con archivos pequeños, casi todo el tiempo se va en esperar, no en enviar"),
      t("About the same: either way the network is five times better", "Más o menos lo mismo: de cualquier forma la red es cinco veces mejor"),
    ],
    answer: 1,
    why: t(
      "A small file is a few packets, so most of its time is the round trip: the request going out and the first byte coming back. More bandwidth only shortens the sending, which was already a small part. A shorter round trip shrinks every handshake, every request and every step of slow start, which is most of the load. It's the same reason HTTP/2 helps: it saves round trips, not bytes. To shorten the round trip itself, move the server closer to the user (a CDN), or make fewer trips.",
      "Un archivo pequeño son unos pocos paquetes, así que casi todo su tiempo es el viaje de ida y vuelta: la solicitud que sale y el primer byte que vuelve. Más ancho de banda solo acorta el envío, que ya era una parte pequeña. Un viaje de ida y vuelta más corto achica cada handshake, cada solicitud y cada paso del arranque lento, que son casi toda la carga. Es la misma razón por la que ayuda HTTP/2: ahorra viajes de ida y vuelta, no bytes. Para acortar el viaje en sí, acerca el servidor al usuario (una CDN) o haz menos viajes.",
    ),
    watch: { ...BASE_WATCH, rtt: 20 },
  },
  {
    id: "slow",
    title: t("One slow response", "Una respuesta lenta"),
    change: t("The server takes 1 s to produce file 3; the other 39 are ready at once · HTTP/1.1 on 6 connections vs HTTP/2", "El servidor tarda 1 s en producir el archivo 3; los otros 39 están listos de inmediato · HTTP/1.1 en 6 conexiones vs HTTP/2"),
    question: t("What happens to the other 39 files?", "¿Qué les pasa a los otros 39 archivos?"),
    options: [
      t("HTTP/2 suffers most: every stream shares one connection, and the slow one holds it", "HTTP/2 sufre más: todos los flujos comparten una conexión, y el lento la retiene"),
      t("HTTP/1.1 loses one of its connections while it waits, so the rest finish later; on HTTP/2 the other streams carry on", "HTTP/1.1 pierde una de sus conexiones mientras espera, así que el resto termina más tarde; en HTTP/2 los otros flujos siguen"),
      t("Nothing in either: the slow response only delays itself", "Nada en ninguno: la respuesta lenta solo se retrasa a sí misma"),
    ],
    answer: 1,
    why: t(
      "An HTTP/1.1 connection can't carry anything else while it waits for a response, so for that second the other files share 5 connections instead of 6: the requests behind it wait for a free connection. That's head-of-line blocking at the HTTP layer. On HTTP/2 a waiting stream sends nothing and holds nothing: the server keeps interleaving the streams that have data. The page as a whole still waits for the slow file on both; only a faster server fixes that.",
      "Una conexión HTTP/1.1 no puede llevar nada más mientras espera una respuesta, así que durante ese segundo los otros archivos se reparten 5 conexiones en lugar de 6: las solicitudes de atrás esperan una conexión libre. Ese es el bloqueo en la cabeza de la fila (head-of-line blocking) en la capa de HTTP. En HTTP/2, un flujo que espera no envía nada ni retiene nada: el servidor sigue intercalando los flujos que tienen datos. La página completa igual espera al archivo lento en los dos; eso solo lo arregla un servidor más rápido.",
    ),
    watch: { ...BASE_WATCH, proto: "h2", slow: 1000 },
  },
  {
    id: "loss",
    title: t("Packets get lost", "Se pierden paquetes"),
    change: t("2% of packets lost, then 5% · HTTP/1.1 on 6 connections vs HTTP/2 on 1 · 40 files, 100 ms, 10 Mbps", "Se pierde el 2% de los paquetes, luego el 5% · HTTP/1.1 en 6 conexiones vs HTTP/2 en 1 · 40 archivos, 100 ms, 10 Mbps"),
    question: t("Which protocol does the loss hurt more?", "¿A qué protocolo le hace más daño la pérdida?"),
    options: [
      t("HTTP/1.1: more connections, more packets to lose", "HTTP/1.1: más conexiones, más paquetes que perder"),
      t("HTTP/2: one lost packet holds up every stream on its one connection, and that connection slows down", "HTTP/2: un paquete perdido detiene todos los flujos de su única conexión, y esa conexión se frena"),
      t("Neither more than the other: TCP resends the lost packets on both", "Ninguno más que el otro: TCP reenvía los paquetes perdidos en los dos"),
    ],
    answer: 1,
    why: t(
      "TCP hands a connection's data to the browser only in order. When a packet is lost, everything behind it on that connection waits at the browser's end until the packet comes again, about a round trip later. On HTTP/1.1 that holds up one file; on HTTP/2 it holds up every stream, because they all ride the same TCP connection: head-of-line blocking at the TCP layer, which HTTP/2 can't fix from above. A loss also halves that connection's congestion window: for HTTP/2 that's half of all its sending, for HTTP/1.1 half of one connection out of six. HTTP/3 runs over QUIC, which keeps order per stream, so a lost packet holds up only the streams it carried.",
      "TCP le entrega al navegador los datos de una conexión solo en orden. Cuando se pierde un paquete, todo lo que viene detrás en esa conexión espera en el extremo del navegador hasta que el paquete llega de nuevo, más o menos un viaje de ida y vuelta después. En HTTP/1.1 eso detiene un archivo; en HTTP/2 detiene todos los flujos, porque todos van por la misma conexión TCP: bloqueo en la cabeza de la fila en la capa de TCP, que HTTP/2 no puede arreglar desde arriba. Una pérdida además reduce a la mitad la ventana de congestión (congestion window) de esa conexión: para HTTP/2 es la mitad de todo lo que envía, para HTTP/1.1 la mitad de una conexión de seis. HTTP/3 funciona sobre QUIC, que mantiene el orden por flujo, así que un paquete perdido solo detiene los flujos que llevaba.",
    ),
    watch: { ...BASE_WATCH, proto: "h2", loss: 0.02 },
  },
  {
    id: "shard",
    title: t("Open more connections", "Abrir más conexiones"),
    change: t("HTTP/1.1 on 6 → 18 connections (the files spread over 3 hostnames, \"domain sharding\") · compared with HTTP/2 on 1", "HTTP/1.1 en 6 → 18 conexiones (los archivos repartidos en 3 nombres de host, \"domain sharding\") · comparado con HTTP/2 en 1"),
    question: t("Can HTTP/1.1 catch up with HTTP/2 by opening more connections?", "¿Puede HTTP/1.1 alcanzar a HTTP/2 abriendo más conexiones?"),
    options: [
      t("No: the protocol is the problem, not the number of connections", "No: el problema es el protocolo, no la cantidad de conexiones"),
      t("Roughly, on a clean link, but it takes 18 handshakes to HTTP/2's one", "Más o menos, en un enlace limpio, pero le cuesta 18 handshakes contra uno de HTTP/2"),
      t("It gets slower: 18 connections fight over the same bandwidth", "Se vuelve más lento: 18 conexiones se pelean el mismo ancho de banda"),
    ],
    answer: 1,
    why: t(
      "With 18 connections, 40 files need only about 3 requests in a row on each. And every new connection starts with its own congestion window of 10 packets, so 18 of them can send far more in the first round trips than HTTP/2's one. That's why sharding was a standard HTTP/1.1 trick. The cost is 17 extra TCP and TLS handshakes (plus DNS lookups for the extra hostnames, which this model leaves out), memory on both ends, and connections that compete with each other and with everyone else on the link. Loss hurts the sharded page less than HTTP/2, for the same reason as in the previous experiment. On HTTP/2, sharding mostly works against you: it brings the handshakes back and splits the streams one connection was meant to carry.",
      "Con 18 conexiones, 40 archivos necesitan solo unas 3 solicitudes seguidas en cada una. Además, cada conexión nueva arranca con su propia ventana de congestión de 10 paquetes, así que 18 conexiones pueden enviar mucho más en los primeros viajes que la única de HTTP/2. Por eso el sharding era un truco estándar en HTTP/1.1. El costo son 17 handshakes de TCP y TLS extra (más las búsquedas de DNS de los nombres de host extra, que este modelo deja fuera), memoria en los dos extremos y conexiones que compiten entre sí y con todos los demás en el enlace. La pérdida le hace menos daño a la página repartida que a HTTP/2, por la misma razón que en el experimento anterior. En HTTP/2, el sharding sobre todo juega en contra: trae de vuelta los handshakes y reparte los flujos que una sola conexión debía llevar.",
    ),
    watch: { ...BASE_WATCH, conns: 18 },
  },
];

const QUESTIONS = [
  [t("Why do browsers open about six connections per hostname over HTTP/1.1, and what does each one cost?",
     "¿Por qué los navegadores abren unas seis conexiones por nombre de host con HTTP/1.1, y qué cuesta cada una?"),
   t("An HTTP/1.1 connection carries one request at a time, so the only way to have several in flight is several connections. Pipelining (sending requests back to back) exists, but responses must come back in request order, so one slow response holds up the rest, and broken proxies made it unreliable; browsers don't use it. Each connection costs a TCP handshake (one round trip) and a TLS handshake (one more with TLS 1.3, two with TLS 1.2) before its first request, starts with a small congestion window, and takes memory on both ends. Reusing connections instead of opening new ones is the same idea as a connection pool (the connection pooling lesson, 29).",
     "Una conexión HTTP/1.1 lleva una solicitud a la vez, así que la única forma de tener varias en curso es tener varias conexiones. Existe el pipelining (enviar solicitudes una tras otra), pero las respuestas tienen que volver en el orden de las solicitudes, así que una respuesta lenta detiene a las demás, y los proxies defectuosos lo hicieron poco confiable; los navegadores no lo usan. Cada conexión cuesta un handshake de TCP (un viaje de ida y vuelta) y uno de TLS (uno más con TLS 1.3, dos con TLS 1.2) antes de su primera solicitud, arranca con una ventana de congestión pequeña y ocupa memoria en los dos extremos. Reutilizar conexiones en lugar de abrir nuevas es la misma idea que un pool de conexiones (la lección de pool de conexiones, 29).")],
  [t("What does HTTP/2 multiplexing change, concretely?",
     "¿Qué cambia, en concreto, la multiplexación de HTTP/2?"),
   t("Many requests share one connection as independent streams. Each message is cut into frames tagged with its stream id, and frames from different streams interleave on the wire, so a request never waits for another response to finish, and responses can complete in any order. That removes the per-request round trips and the extra handshakes. Headers are also compressed (HPACK). It doesn't change TCP underneath: one connection, one congestion window, one ordered byte stream.",
     "Muchas solicitudes comparten una conexión como flujos (streams) independientes. Cada mensaje se corta en tramas (frames) marcadas con el id de su flujo, y las tramas de distintos flujos se intercalan en el cable, así que una solicitud nunca espera a que termine otra respuesta, y las respuestas pueden terminar en cualquier orden. Eso elimina los viajes de ida y vuelta por solicitud y los handshakes extra. Las cabeceras además van comprimidas (HPACK). No cambia el TCP de abajo: una conexión, una ventana de congestión, un flujo de bytes ordenado.")],
  [t("Head-of-line blocking happens at two layers. Which are they, and which one does HTTP/2 remove?",
     "El bloqueo en la cabeza de la fila ocurre en dos capas. ¿Cuáles son, y cuál elimina HTTP/2?"),
   t("At the HTTP layer: on HTTP/1.1 a connection is busy until its response is done, so requests queue behind slow responses (and with pipelining, responses queue behind each other). HTTP/2 removes that with streams. At the TCP layer: TCP delivers bytes in order, so one lost packet stalls everything after it on the connection, including every other HTTP/2 stream. HTTP/2 can't remove that; HTTP/3 does, by running over QUIC, which orders data per stream.",
     "En la capa de HTTP: en HTTP/1.1 una conexión está ocupada hasta que termina su respuesta, así que las solicitudes hacen fila detrás de las respuestas lentas (y con pipelining, las respuestas hacen fila unas detrás de otras). HTTP/2 lo elimina con los flujos. En la capa de TCP: TCP entrega los bytes en orden, así que un paquete perdido detiene todo lo que viene después en la conexión, incluidos todos los demás flujos de HTTP/2. HTTP/2 no puede eliminar eso; HTTP/3 sí, porque funciona sobre QUIC, que ordena los datos por flujo.")],
  [t("Users on a flaky mobile network say your site got slower after you turned on HTTP/2. Is that plausible?",
     "Usuarios en una red móvil inestable dicen que tu sitio se volvió más lento después de activar HTTP/2. ¿Es creíble?"),
   t("Yes. With packet loss, every loss stalls all of the page's streams on the one connection and halves that connection's sending rate, while HTTP/1.1's six connections spread the damage. On clean links HTTP/2 wins; on lossy ones the gap closes and can reverse. Measure it on real user data rather than guessing. Options: HTTP/3 where clients support it, fewer and smaller files on the critical path, and a CDN closer to users so each recovery costs a shorter round trip.",
     "Sí. Con pérdida de paquetes, cada pérdida detiene todos los flujos de la página en la única conexión y reduce a la mitad su ritmo de envío, mientras que las seis conexiones de HTTP/1.1 reparten el daño. En enlaces limpios gana HTTP/2; en enlaces con pérdida la diferencia se cierra y puede invertirse. Mídelo con datos de usuarios reales en lugar de adivinar. Opciones: HTTP/3 donde los clientes lo soporten, menos archivos y más pequeños en la ruta crítica, y una CDN más cerca de los usuarios para que cada recuperación cueste un viaje de ida y vuelta más corto.")],
  [t("Your page loads 60 small files. Would you rather double the bandwidth or halve the round-trip time? Why?",
     "Tu página carga 60 archivos pequeños. ¿Prefieres duplicar el ancho de banda o reducir a la mitad el tiempo de ida y vuelta? ¿Por qué?"),
   t("Halve the round trip. Small files are dominated by waiting: handshakes, the request's trip out, the response's first byte, and slow start's ramp are all counted in round trips, and the bytes themselves take little link time. Doubling bandwidth helps big downloads (video, large images). In practice you shorten round trips by serving from a CDN near the user, reusing connections, and cutting the number of sequential requests (HTTP/2, preloading what the page will need).",
     "Reducir el viaje de ida y vuelta. En los archivos pequeños domina la espera: los handshakes, la ida de la solicitud, el primer byte de la respuesta y la subida del arranque lento se cuentan en viajes de ida y vuelta, y los bytes en sí ocupan poco el enlace. Duplicar el ancho de banda ayuda a las descargas grandes (video, imágenes pesadas). En la práctica, el viaje se acorta sirviendo desde una CDN cerca del usuario, reutilizando conexiones y reduciendo las solicitudes en serie (HTTP/2, precargar lo que la página va a necesitar).")],
  [t("Which HTTP/1.1-era tricks should you revisit once you serve over HTTP/2?",
     "¿Qué trucos de la época de HTTP/1.1 deberías revisar cuando sirves con HTTP/2?"),
   t("Domain sharding: on HTTP/2 it adds handshakes and splits the streams that one connection would multiplex. Spriting and concatenating everything into one big file: they existed to save requests; on HTTP/2 extra requests are cheap, while one giant file breaks caching (one change invalidates it all). Some bundling still pays, since every request has some cost. Inlining small files: also less useful, for the same reason. Keep what still helps on any protocol: fewer bytes, caching, and a CDN.",
     "El domain sharding: en HTTP/2 agrega handshakes y reparte los flujos que una sola conexión multiplexaría. Los sprites y concatenar todo en un solo archivo grande: existían para ahorrar solicitudes; en HTTP/2 las solicitudes extra son baratas, mientras que un archivo gigante rompe la caché (un cambio lo invalida todo). Algo de empaquetado (bundling) todavía conviene, porque cada solicitud tiene algún costo. Incrustar archivos pequeños en la página: también sirve menos, por lo mismo. Mantén lo que ayuda con cualquier protocolo: menos bytes, caché y una CDN.")],
];

export default defineLesson({
  title: t("HTTP/2 Workbench", "Banco de trabajo: HTTP/2"),
  eyebrow: t("Systems lesson 49 · HTTP/1.1 vs HTTP/2", "Lección de sistemas 49 · HTTP/1.1 vs HTTP/2"),
  lede: t("HTTP/1.1 carries one request at a time per connection, so browsers open several connections and still spend most of a page load waiting on round trips. HTTP/2 sends every request at once as streams over one connection, but that connection is still one TCP stream, so a lost packet stalls them all. This lesson loads one page's files over both: watch a machine do it, predict what changes it, then explain it back.",
    "HTTP/1.1 lleva una solicitud a la vez por conexión, así que los navegadores abren varias conexiones y aun así pasan casi toda la carga de una página esperando viajes de ida y vuelta. HTTP/2 envía todas las solicitudes a la vez como flujos sobre una conexión, pero esa conexión sigue siendo un solo flujo TCP, así que un paquete perdido los detiene a todos. Esta lección carga los archivos de una página con los dos: mira cómo lo hace una máquina, predice qué lo cambia y después explícalo."),
  machine: {
    intro: t("The browser at its desk has just received a page's HTML and now orders its files from the warehouse. Each track between them is one connection: a new one gets its rail after two round trips of handshakes (TCP, then TLS). Order slips ride out, packets ride back, and each finished file fills a tile in the page tray. Switch between HTTP/1.1 and HTTP/2, change the round trip, the bandwidth and the loss, or drop a packet yourself and watch what waits behind it.",
      "El navegador en su escritorio acaba de recibir el HTML de una página y ahora pide sus archivos al almacén. Cada pista entre ellos es una conexión: una nueva recibe su riel después de dos viajes de ida y vuelta de handshakes (TCP, luego TLS). Las órdenes salen, los paquetes vuelven, y cada archivo terminado llena una ficha en la bandeja de la página. Cambia entre HTTP/1.1 y HTTP/2, cambia el viaje de ida y vuelta, el ancho de banda y la pérdida, o tira un paquete tú mismo y mira qué espera detrás."),
    plate: {
      title: t("Order depot", "Depósito de pedidos"),
      keys: [
        { mark: "lit", label: t("A packet that fell off or waits behind a gap; a slow response", "Un paquete que se cayó o espera detrás de un hueco; una respuesta lenta") },
        { mark: "raised", label: t("Packets (a band marks every other file), order slips, handshake tokens", "Paquetes (una banda marca un archivo sí y otro no), órdenes, fichas de handshake") },
        { mark: "flat", label: t("Tracks: one per connection, railed once open", "Pistas: una por conexión, con riel cuando está abierta") },
      ],
      caption: t(
        "Each track is one TCP connection between the browser (left) and the server (right). Opening one costs two round trips: a TCP token, then a TLS token, out and back. HTTP/1.1 sends one GET slip per track and waits for the whole file before the next; the slips still on the desk are the files waiting for a free connection. HTTP/2 sends every GET at once on its one track and interleaves the files' packets. Packets leave the warehouse one at a time through a shared link (the meter shows how busy it is) and take half a round trip to arrive. TCP hands data on only in order: when a packet falls off, the packets behind it on its track wait in a lit column at the browser's end until the warehouse sends it again. The tray fills a tile as each file completes.",
        "Cada pista es una conexión TCP entre el navegador (izquierda) y el servidor (derecha). Abrir una cuesta dos viajes de ida y vuelta: una ficha de TCP y luego una de TLS, de ida y de vuelta. HTTP/1.1 envía una orden GET por pista y espera el archivo completo antes de la siguiente; las órdenes que siguen en el escritorio son los archivos que esperan una conexión libre. HTTP/2 envía todos los GET de una vez en su única pista e intercala los paquetes de los archivos. Los paquetes salen del almacén de a uno por un enlace compartido (el medidor muestra qué tan ocupado está) y tardan medio viaje de ida y vuelta en llegar. TCP entrega los datos solo en orden: cuando un paquete se cae, los que vienen detrás en su pista esperan en una columna iluminada en el extremo del navegador hasta que el almacén lo reenvía. La bandeja llena una ficha cada vez que termina un archivo.",
      ),
      stage: { "data-depot": "" },
      label: t("HTTP/1.1 and HTTP/2 page load simulation. Space pauses or resumes.", "Simulación de carga de una página con HTTP/1.1 y HTTP/2. Espacio pausa o reanuda."),
    },
    svg: buildFigure(),
    stats: [
      ["load", t("Page load", "Carga de la página"), "–"],
      ["loaded", t("Files loaded", "Archivos cargados"), "–"],
      ["handshakes", t("Handshakes", "Handshakes")],
      ["waiting", t("Waiting for a connection", "Esperando conexión")],
      ["resent", t("Resent", "Reenviados")],
      ["held", t("Held behind a gap", "Detenidos tras un hueco")],
    ],
    controls: [
      { seg: "proto", label: t("Protocol", "Protocolo"), options: [["h1", "HTTP/1.1"], ["h2", "HTTP/2"]], value: "h1" },
      { seg: "conns", label: t("HTTP/1.1 connections", "Conexiones HTTP/1.1"), options: [[2, "2"], [6, "6"], [18, t("18 (sharded)", "18 (sharding)")]], value: 6 },
      { seg: "files", label: t("Files on the page", "Archivos en la página"), options: [[20, "20"], [40, "40"], [80, "80"]], value: 40 },
      { seg: "rtt", label: t("Round trip", "Ida y vuelta"), options: [[20, "20 ms"], [100, "100 ms"], [300, "300 ms"]], value: 100 },
      { seg: "mbps", label: t("Bandwidth", "Ancho de banda"), options: [[2, "2 Mbps"], [10, "10 Mbps"], [50, "50 Mbps"]], value: 10 },
      { seg: "loss", label: t("Packet loss", "Pérdida de paquetes"), options: [[0, "0%"], [0.02, "2%"], [0.05, "5%"]], value: 0 },
      { seg: "slow", label: t("File 3", "Archivo 3"), options: [[0, t("Ready at once", "Listo de inmediato")], [1000, t("Takes the server 1 s", "Al servidor le toma 1 s")]], value: 0 },
      { speed: true },
      { actions: [["drop", t("Drop a packet", "Tirar un paquete")], ["reset", t("Load again", "Cargar de nuevo")], ["pause", t("Pause", "Pausa")]], label: t("Do something", "Haz algo") },
    ],
    note: t("Time runs a tenth of real speed at ×1: a 100 ms round trip takes a second to watch. Each load starts with the HTML's connection already open; changing a setting starts a new load.",
      "A ×1 el tiempo corre a un décimo de la velocidad real: un viaje de ida y vuelta de 100 ms tarda un segundo en verse. Cada carga empieza con la conexión del HTML ya abierta; cambiar un ajuste empieza una carga nueva."),
  },
  predict: {
    intro: t("Each experiment changes one thing. Choose what you expect <em>before</em> running it. Results come from the same model as the machine, averaged over " + SEEDS.length + " seeded page loads (each seed gives its own file sizes and losses).",
      "Cada experimento cambia una sola cosa. Elige lo que esperas <em>antes</em> de ejecutarlo. Los resultados salen del mismo modelo que la máquina, promediados sobre " + SEEDS.length + " cargas con semilla fija (cada semilla da sus propios tamaños de archivo y sus pérdidas)."),
    experiments: withResults(EXPERIMENTS, RUNS),
  },
  explain: { questions: QUESTIONS },
  footer: t(`Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson. It keeps TCP and TLS 1.3 handshakes, one request at a time per HTTP/1.1 connection, round-robin HTTP/2 streams, a shared bottleneck link, in-order delivery per connection, slow start from 10 packets (RFC 6928) and halving on loss. It leaves out DNS, request and ack loss, header sizes, stream priorities and TCP's finer timers. HTTP/2 is RFC 9113; HTTP/3 is RFC 9114, over QUIC (RFC 9000).`,
    `Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección. Incluye los handshakes de TCP y TLS 1.3, una solicitud a la vez por conexión HTTP/1.1, flujos de HTTP/2 por turnos (round robin), un enlace compartido como cuello de botella, entrega en orden por conexión, arranque lento desde 10 paquetes (RFC 6928) y reducción a la mitad ante una pérdida. Deja fuera el DNS, la pérdida de solicitudes y de acks, el tamaño de las cabeceras, las prioridades de los flujos y los temporizadores finos de TCP. HTTP/2 es el RFC 9113; HTTP/3 es el RFC 9114, sobre QUIC (RFC 9000).`),
  css: `
.iso-stage [data-track] text{pointer-events:none}
${LIT_FILL_CSS}
`,
  data: {
    P,
    G: GEOMETRY,
    PACKET_SVG: packetSvg(),
    CARD_SVG: cardSvg(),
  },
});
