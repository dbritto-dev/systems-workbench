# Systems Workbench

Interactive lessons that teach systems concepts, one small machine per idea. Each lesson is a single self-contained
HTML page with three parts:

1. **The machine**: an isometric figure driven by a seeded simulation. Watch it, change the controls, pause it.
2. **Predict, then run**: five experiments. Pick what you think will happen, then run the same model and compare.
3. **Explain it back**: questions to answer out loud or in pairs.

**Live site:** https://dbritto-dev.github.io/systems-workbench/ (deployed by `.github/workflows/pages.yml` on every push to `main`).

**English and Spanish:** every page exists in both languages: English at the root, Spanish under `/es/`, with EN / ES
links beside the theme switch. The Spanish is neutral Latin American Spanish; [workbench/I18N.md](workbench/I18N.md)
is the guide for translating a lesson, and `tools/i18n-check.cjs` checks one.

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
| 35 | [BM25](lessons/bm25/bm25-workbench.html) | Search | Assay bench | Rare words weigh more, repeats help less and less, long documents are discounted: why codes match and paraphrases don't. |
| 36 | [Semantic Search](lessons/semantic/semantic-search-workbench.html) | Search | Star-map table | Embeddings place text by meaning, so paraphrases match with no shared words, while exact codes and names slip away. |
| 37 | [Rank Fusion](lessons/rrf/rrf-workbench.html) | Search | Count room | Merge rankings by 1/(k + rank), not raw scores: no normalising, and two judges agreeing beats one judge's favourite. |
| 38 | [Hybrid Search](lessons/hybrid/hybrid-search-workbench.html) | Search | Sorting plant | Run keyword and meaning search together and merge: each covers the other's misses, if you fuse and size them right. |
| 39 | [Contextual Retrieval](lessons/contextual/contextual-retrieval-workbench.html) | Search | Print shop | Chunks lose their context when cut. Stamp each with a short summary before indexing, then rerank: far fewer misses. |
| 40 | [Hash Table](lessons/hashtable/hash-table-workbench.html) | Fundamentals | Pigeonhole rack | A hash table jumps straight to a bucket. It stays fast only while the hash spreads keys and buckets stay uncrowded. |
| 41 | [Priority Queue](lessons/heap/heap-workbench.html) | Fundamentals | Triage tree | A priority queue always serves the most important item next. A heap keeps it cheap: O(log n) to add or take the top. |
| 42 | [Ring Buffer](lessons/ringbuffer/ring-buffer-workbench.html) | Fundamentals | Ring table | A fixed array used as a queue: fast and allocation-free, until the writer catches the reader and something must give. |
| 43 | [Latency Numbers](lessons/latency/latency-numbers-workbench.html) | Fundamentals | Courier depot | Each step out from the CPU costs 10 to 1,000 times more. Where data lives often matters more than the code. |
| 44 | [Tail Latency](lessons/percentiles/tail-latency-workbench.html) | Fundamentals | Timing hall | Most requests are fast; users remember the slow ones. Percentiles show the tail, and fan-out multiplies it. |
| 45 | [Big-O](lessons/bigo/big-o-workbench.html) | Fundamentals | Race track | Big-O is how work grows with input size. Five real algorithms race on the same data: doubling, constants, worst case. |

The site is built with [Astro](https://astro.build) (pure `.astro` components, no UI framework) and deployed to
GitHub Pages: English at `/lessons/<slug>/`, Spanish at `/es/lessons/<slug>/`. Old `lessons/<slug>/*-workbench.html`
links forward to the new URLs. The standalone `*-workbench.html` files in `lessons/` still build and open offline.

## How the site is put together

Each lesson's `build.mjs` describes its page (text in English and Spanish, the figure, the panel, experiments,
questions, live script) and hands it to `writePage()`. `tools/export-lessons.mjs` runs every `build.mjs` and collects
that description instead of writing HTML, into `src/generated/` (not committed). Astro renders the pages from it:

```
src/
  content.config.ts         the "lessons" collection: lessons.json + each lesson's exported page data, validated
  i18n/                     locales, interface strings (ui.ts), localize() for one-language HTML
  layouts/Base.astro        document head, language alternates, theme before first paint, old ?lang= links
  layouts/Lesson.astro      a lesson page: header, machine, experiments, questions
  components/               Switches (EN/ES links, theme), lesson/ (Experiments, Questions), collection/ (cards,
                            toolbar, preview dialog)
  pages/[...lang]/          the collection (index.astro) and lesson pages (lessons/[slug]/), once per language
  pages/search-index.json.ts  every lesson's text in both languages, for search
  lib/                      lesson data helpers, the search engine (BM25F), the search index
  scripts/                  browser code: theme and language links, collection (filters, preview, search),
                            live-loader (loads a lesson's live code when its machine comes into view)
  styles/                   collection, lesson additions, switches
  generated/                written by tools/export-lessons.mjs: lesson data, live modules, shared runtime, CSS
```

What loads, and when:

- **Shared once, cached for every lesson:** the kit + `WB` runtime (about 5 KB gzipped) and the lesson stylesheet.
- **Per lesson, on demand:** the lesson's live code (model + animation) is its own chunk, loaded as the machine or
  the experiments come near the screen, or on the first interaction. The still frame is plain HTML/SVG.
- **Collection, on demand:** the search engine and index load on the first search, a `?q=` link or a preview.
  Card images are resized by `astro:assets` and lazy-loaded.

Built on Astro's own features rather than custom code wherever Astro has one: content collections (lesson data),
i18n routing and `astro:i18n` URL helpers, `astro:assets` (images), bundled `<script>` modules and
`import.meta.glob` (shared and per-lesson chunks), `prefetch` (lesson pages load on hover), `redirects` (old URLs)
and `@astrojs/sitemap` (both languages).

## Layout

```
src/                  the Astro site (above)
workbench/            the shared layer (see workbench/README.md)
  kit.mjs             Anatomy kit re-export + helpers
  parts.mjs           shared parts: base plate, digit counters, people, dials, meters, cards, signs, pennants, lamps
  page.mjs            the page template and helpers lessons build with (panel, segs, figure plate, experiments)
  client.js           browser helpers (WB.loop, WB.experiments, WB.counter, ...)
  parts-gallery.html  every shared part in light and dark
  collection/         lessons.json (the registry), preview images, preview tooling
  vendor-anatomy/     the Anatomy kit (MIT)
lessons/<slug>/
  sim.js              the seeded model, shared by the figure and the experiments
  figure.mjs          the machine's geometry
  build.mjs           content + live script; writePage() (exported for the site, or a standalone page)
tools/                export-lessons, site-check, build-all, screenshot and baseline-compare scripts
```

## Working on it

The site needs Node 22.23+ (see `.nvmrc`) and [pnpm](https://pnpm.io) (the version is pinned in `packageManager`;
`corepack enable` picks it up). The screenshot tools need Playwright and sharp.

```sh
pnpm install
pnpm dev                          # export lessons, then the Astro dev server
pnpm build                        # export lessons, then build the site into dist/ (what the Pages workflow runs)
pnpm preview                      # serve dist/ at http://localhost:4321/systems-workbench/
pnpm check:site                   # with preview running: every lesson in both languages, experiments, 390 px, search
pnpm export:lessons queues        # re-export one lesson after editing it (the dev server picks it up)
pnpm lessons                      # rebuild the standalone lesson pages (or: node tools/build-all.mjs queues stacks)
pnpm gallery                      # rebuild the parts gallery
pnpm previews queues              # re-shoot a lesson's catalogue preview (light + dark)
pnpm shot lessons/queues/queue-workbench.html shot.png 2000
pnpm compare baseline.html lessons/queues/queue-workbench.html
```

Set `CHROMIUM_PATH` if Playwright should use a browser other than its own.

### Adding a lesson

1. Create `lessons/<slug>/` with `sim.js`, `figure.mjs` and `build.mjs` (copy a recent lesson such as `queues`).
2. Build it and check the machine reads from a still frame: with no labels, a viewer should be able to name every part
   that matters and its state. Use or add shared parts in `workbench/parts.mjs` rather than drawing one-offs.
3. Add it to `workbench/collection/lessons.json` (with `blurb` and `blurb_es` of at most ~120 characters), then
   `pnpm previews <slug>` and `pnpm build`. The collection, search and both language routes pick it up.
