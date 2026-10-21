# Systems Workbench

Interactive lessons that teach systems concepts, one small machine per idea. Each lesson is a single self-contained
HTML page with three parts:

1. **The machine**: an isometric figure driven by a seeded simulation. Watch it, change the controls, pause it.
2. **Predict, then run**: five experiments. Pick what you think will happen, then run the same model and compare.
3. **Explain it back**: questions to answer out loud or in pairs.

The figures are drawn with the [Anatomy](https://github.com/wheresryan22/anatomy) isometric kit (MIT), vendored in
`workbench/vendor-anatomy/` with its licence.

## Lessons

| # | Lesson | Area | Machine | What it teaches |
|---|---|---|---|---|
| 01 | [Cache](lessons/cache/cache-workbench.html) | Data | Records office | A cache is a small, fast shelf of copies in front of a big, slow store. |
| 02 | [Pub/Sub](lessons/pubsub/pubsub-workbench.html) | Messaging | Dispatch office | Publish/subscribe lets one part of a system announce something without knowing who listens. |
| 03 | [Load Balancer](lessons/loadbalancing/load-balancer-workbench.html) | Traffic | Sorting station | A load balancer decides which server gets each request, and that one decision sets how long users wait. |
| 04 | [Circuit Breaker](lessons/breaker/circuit-breaker-workbench.html) | Resilience | Switchboard | When a service you depend on gets slow or fails, the danger is not the failed calls: it is your own workers waiting on them. |
| 05 | [Rate Limiter](lessons/ratelimit/rate-limiter-workbench.html) | Traffic | Ticket dispenser | A rate limiter hands out permission at a fixed pace and says "not now" (HTTP 429) when it runs out. |
| 06 | [Retry Storm](lessons/retrystorm/retry-storm-workbench.html) | Resilience | Ticket office | Retries feel safe, but when many clients retry at once they keep a system overloaded long after the fault is gone. |
| 07 | [Hash Ring](lessons/hashring/hash-ring-workbench.html) | Data | Sorting carousel | When data is split across nodes, every key needs a home, and adding or losing a node should move as few keys as possible. |
| 08 | [Canary Deploy](lessons/canary/canary-deploy-workbench.html) | Delivery | Railway junction | A canary deploy sends a small share of real traffic to the new version, watches it, and either rolls it back or promotes it. |
| 09 | [Blue-Green](lessons/bluegreen/blue-green-workbench.html) | Delivery | Two press lines | Two full copies of production: deploy to the idle one, flip all traffic with one switch, keep the old one ready. |
| 10 | [Rolling Deploy](lessons/rolling/rolling-deploy-workbench.html) | Delivery | Module yard | A rolling deploy replaces a service one piece at a time, so it never has to stop. |
| 11 | [Index](lessons/indexes/index-workbench.html) | Data | Library | An index is a sorted copy of a few columns that points back to the rows: fast lookups, paid for on every write. |
| 12 | [Pagination](lessons/pagination/pagination-workbench.html) | Data | Filing machine | How a list API remembers where the last page ended decides how fast deep pages are and whether rows repeat or vanish. |
| 13 | [Concurrency](lessons/concurrency/concurrency-workbench.html) | Concurrency | Range and stirring head | Concurrency is one worker juggling many tasks by switching between them. It hides waiting but adds no extra hands. |
| 14 | [Parallelism](lessons/parallelism/parallelism-workbench.html) | Concurrency | Workshop | Parallelism is many pieces of work at the same instant. More workers help only as far as the work can be split. |
| 15 | [Async](lessons/async/async-workbench.html) | Concurrency | Restaurant pass | Async I/O lets one worker start many slow operations and handle each result when it's ready, instead of waiting. |
| 16 | [Event Loop](lessons/eventloop/event-loop-workbench.html) | Concurrency | Event loop | JavaScript runs your code on one thread, one task at a time. Timers, network replies and drawing all wait their turn. |
| 17 | [Race Condition](lessons/races/race-condition-workbench.html) | Concurrency | Bank office | Two requests read the same value, both write, and one quietly undoes the other. Nothing crashes, so it hides. |
| 18 | [Broadcast](lessons/broadcast/broadcast-workbench.html) | Distributed | Signal network | Broadcast means every node learns every value; the topology decides how many messages that costs and how long it takes. |
| 19 | [Gossip](lessons/gossip/gossip-workbench.html) | Distributed | Gossip village | Every round, whoever knows tells a few random others. Nobody coordinates, nothing is retried, and everyone hears it fast. |
| 20 | [Kafka Log](lessons/kafkalog/kafka-log-workbench.html) | Messaging | Rail yard | A log keeps records in arrival order and doesn't delete them on read; each consumer group keeps a bookmark instead. |
| 21 | [Counter](lessons/counter/counter-workbench.html) | Distributed | Branch tally | Counting sounds trivial until several machines count at once: lost updates, retries, and counters that never conflict. |
| 22 | [Feature Flag](lessons/featureflags/feature-flag-workbench.html) | Delivery | Lighting console | A feature flag ships new code switched off and lets you decide, at run time, who sees it. |
| 23 | [Health Probe](lessons/probes/health-probe-workbench.html) | Resilience | Shopping street | Readiness asks “can you take traffic now?”, liveness asks “do you need a restart?” Mix them up and blips become outages. |
| 24 | [Outbox](lessons/outbox/outbox-workbench.html) | Messaging | Order office | Save to the database and tell other services in two writes, and a crash between them loses or invents events. |
| 25 | [Idempotency](lessons/idempotency/idempotency-workbench.html) | Resilience | Payment counter | A lost reply makes the client pay again. An idempotency key lets the server spot the retry and replay the result. |
| 26 | [Saga](lessons/sagas/saga-workbench.html) | Distributed | Travel agency | Flight, hotel, car, card: no shared transaction, so when a late step fails a saga undoes the earlier ones in reverse. |
| 27 | [N+1 Query](lessons/nplusone/n-plus-one-workbench.html) | Data | Warehouse picker | One query for the list, then one per row. Each is a round trip, so it's invisible locally and slow in staging. |
| 28 | [Cache Stampede](lessons/stampede/cache-stampede-workbench.html) | Data | Bakery | When a hot cache entry expires, every request misses at once and the database takes the whole herd. |
| 29 | [Connection Pool](lessons/connpool/connection-pool-workbench.html) | Data | Taxi rank | Connections are slow to open and the database holds few. Most pool trouble is sizing, leaks and holding one too long. |
| 30 | [Cardinality](lessons/cardinality/sampling-cardinality-workbench.html) | Observability | Tally hall | Every metric label multiplies the series you store, and every trace costs space, so what you record must be chosen. |
| 31 | [Debounce](lessons/debounce/debounce-workbench.html) | Frontend | Elevator lobby | Wait until events stop, then act once. Every keystroke restarts the wait, so a burst becomes one request. |
| 32 | [Throttle](lessons/throttle/throttle-workbench.html) | Frontend | Metronome gate | Run the handler at most once per interval while events keep coming: steady updates during a scroll, the rest dropped. |
| 33 | [Queue](lessons/queues/queue-workbench.html) | Fundamentals | Parcel office | First in, first out. Between producers and workers a queue soaks up bursts and survives crashes, if you ack right. |
| 34 | [Stack](lessons/stacks/stack-workbench.html) | Fundamentals | Plate stacks | Last in, first out: every function call, every undo, and under overload, which users still get an answer in time. |

Open any `lessons/<slug>/*-workbench.html` file in a browser; it needs no server and no network. `workbench/collection/index.html`
is the catalogue page (it links to the published copies).

## Layout

```
workbench/            the shared layer (see workbench/README.md)
  kit.mjs             Anatomy kit re-export + helpers
  parts.mjs           shared parts: base plate, digit counters, people, dials, meters, cards, signs, pennants, lamps
  page.mjs            the page template: theme switch, panel, experiments, questions, lit highlight
  client.js           browser helpers (WB.loop, WB.experiments, WB.counter, ...)
  parts-gallery.html  every shared part in light and dark
  collection/         the catalogue page and its preview images
  vendor-anatomy/     the Anatomy kit (MIT)
lessons/<slug>/
  sim.js              the seeded model, shared by the figure and the experiments
  figure.mjs          the machine's geometry
  build.mjs           content + live script; writes <slug>-workbench.html
tools/                build-all, screenshot and baseline-compare scripts
```

## Working on it

Node 18+ builds every page; the screenshot tools need Playwright and sharp.

```sh
npm install                      # only needed for the screenshot/compare tools
npm run build                    # rebuild every lesson (or: node tools/build-all.mjs queues stacks)
node lessons/queues/build.mjs    # rebuild one lesson
npm run gallery                  # rebuild the parts gallery
npm run collection               # rebuild the catalogue from lessons.json
npm run previews -- queues       # re-shoot a lesson's catalogue preview (light + dark)
npm run shot -- lessons/queues/queue-workbench.html shot.png 2000
npm run compare -- baseline.html lessons/queues/queue-workbench.html
```

Set `CHROMIUM_PATH` if Playwright should use a browser other than its own.

### Adding a lesson

1. Create `lessons/<slug>/` with `sim.js`, `figure.mjs` and `build.mjs` (copy a recent lesson such as `queues`).
2. Build it and check the machine reads from a still frame: with no labels, a viewer should be able to name every part
   that matters and its state. Use or add shared parts in `workbench/parts.mjs` rather than drawing one-offs.
3. Add it to `workbench/collection/lessons.json` (with a `blurb` of at most ~120 characters), then
   `npm run collection` and `npm run previews -- <slug>`.
