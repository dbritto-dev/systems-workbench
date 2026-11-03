# Systems Workbench

Interactive lessons that teach systems concepts, one small machine per idea. Each lesson is a single self-contained
HTML page with three parts:

1. **The machine**: an isometric figure driven by a seeded simulation. Watch it, change the controls, pause it.
2. **Predict, then run**: five experiments. Pick what you think will happen, then run the same model and compare.
3. **Explain it back**: questions to answer out loud or in pairs.

**Live site:** https://dbritto-dev.github.io/systems-workbench/ (deployed by `.github/workflows/pages.yml` on every push to `main`).

**English and Spanish:** every page exists in both languages: English at the root, Spanish under `/es/`, with EN / ES
links beside the theme switch. The Spanish is neutral Latin American Spanish; [workbench/I18N.md](workbench/I18N.md)
is the guide for translating a lesson, and `tools/site-check.cjs` checks both languages.

The figures are drawn with the [Anatomy](https://github.com/wheresryan22/anatomy) isometric kit (MIT), vendored in
`workbench/vendor-anatomy/` with its licence.

## Lessons

| # | Lesson | Area | Machine | What it teaches |
|---|---|---|---|---|
| 01 | [Cache](https://dbritto-dev.github.io/systems-workbench/lessons/cache/) | Data | Records office | A cache is a small, fast shelf of copies in front of a big, slow store. |
| 02 | [Pub/Sub](https://dbritto-dev.github.io/systems-workbench/lessons/pubsub/) | Messaging | Dispatch office | Publish/subscribe lets one part of a system announce something without knowing who listens. |
| 03 | [Load Balancer](https://dbritto-dev.github.io/systems-workbench/lessons/loadbalancing/) | Traffic | Sorting station | A load balancer decides which server gets each request, and that one decision sets how long users wait. |
| 04 | [Circuit Breaker](https://dbritto-dev.github.io/systems-workbench/lessons/breaker/) | Resilience | Switchboard | When a service you depend on gets slow or fails, the danger is not the failed calls: it is your own workers waiting on them. |
| 05 | [Rate Limiter](https://dbritto-dev.github.io/systems-workbench/lessons/ratelimit/) | Traffic | Ticket dispenser | A rate limiter hands out permission at a fixed pace and says "not now" (HTTP 429) when it runs out. |
| 06 | [Retry Storm](https://dbritto-dev.github.io/systems-workbench/lessons/retrystorm/) | Resilience | Ticket office | Retries feel safe, but when many clients retry at once they keep a system overloaded long after the fault is gone. |
| 07 | [Hash Ring](https://dbritto-dev.github.io/systems-workbench/lessons/hashring/) | Data | Sorting carousel | When data is split across nodes, every key needs a home, and adding or losing a node should move as few keys as possible. |
| 08 | [Canary Deploy](https://dbritto-dev.github.io/systems-workbench/lessons/canary/) | Delivery | Railway junction | A canary deploy sends a small share of real traffic to the new version, watches it, and either rolls it back or promotes it. |
| 09 | [Blue-Green](https://dbritto-dev.github.io/systems-workbench/lessons/bluegreen/) | Delivery | Two press lines | Two full copies of production: deploy to the idle one, flip all traffic with one switch, keep the old one ready. |
| 10 | [Rolling Deploy](https://dbritto-dev.github.io/systems-workbench/lessons/rolling/) | Delivery | Module yard | A rolling deploy replaces a service one piece at a time, so it never has to stop. |
| 11 | [Index](https://dbritto-dev.github.io/systems-workbench/lessons/indexes/) | Data | Library | An index is a sorted copy of a few columns that points back to the rows: fast lookups, paid for on every write. |
| 12 | [Pagination](https://dbritto-dev.github.io/systems-workbench/lessons/pagination/) | Data | Filing machine | How a list API remembers where the last page ended decides how fast deep pages are and whether rows repeat or vanish. |
| 13 | [Concurrency](https://dbritto-dev.github.io/systems-workbench/lessons/concurrency/) | Concurrency | Range and stirring head | Concurrency is one worker juggling many tasks by switching between them. It hides waiting but adds no extra hands. |
| 14 | [Parallelism](https://dbritto-dev.github.io/systems-workbench/lessons/parallelism/) | Concurrency | Workshop | Parallelism is many pieces of work at the same instant. More workers help only as far as the work can be split. |
| 15 | [Async](https://dbritto-dev.github.io/systems-workbench/lessons/async/) | Concurrency | Restaurant pass | Async I/O lets one worker start many slow operations and handle each result when it's ready, instead of waiting. |
| 16 | [Event Loop](https://dbritto-dev.github.io/systems-workbench/lessons/eventloop/) | Concurrency | Event loop | JavaScript runs your code on one thread, one task at a time. Timers, network replies and drawing all wait their turn. |
| 17 | [Race Condition](https://dbritto-dev.github.io/systems-workbench/lessons/races/) | Concurrency | Bank office | Two requests read the same value, both write, and one quietly undoes the other. Nothing crashes, so it hides. |
| 18 | [Broadcast](https://dbritto-dev.github.io/systems-workbench/lessons/broadcast/) | Distributed | Signal network | Broadcast means every node learns every value; the topology decides how many messages that costs and how long it takes. |
| 19 | [Gossip](https://dbritto-dev.github.io/systems-workbench/lessons/gossip/) | Distributed | Gossip village | Every round, whoever knows tells a few random others. Nobody coordinates, nothing is retried, and everyone hears it fast. |
| 20 | [Kafka Log](https://dbritto-dev.github.io/systems-workbench/lessons/kafkalog/) | Messaging | Rail yard | A log keeps records in arrival order and doesn't delete them on read; each consumer group keeps a bookmark instead. |
| 21 | [Counter](https://dbritto-dev.github.io/systems-workbench/lessons/counter/) | Distributed | Branch tally | Counting sounds trivial until several machines count at once: lost updates, retries, and counters that never conflict. |
| 22 | [Feature Flag](https://dbritto-dev.github.io/systems-workbench/lessons/featureflags/) | Delivery | Lighting console | A feature flag ships new code switched off and lets you decide, at run time, who sees it. |
| 23 | [Health Probe](https://dbritto-dev.github.io/systems-workbench/lessons/probes/) | Resilience | Shopping street | Readiness asks “can you take traffic now?”, liveness asks “do you need a restart?” Mix them up and blips become outages. |
| 24 | [Outbox](https://dbritto-dev.github.io/systems-workbench/lessons/outbox/) | Messaging | Order office | Save to the database and tell other services in two writes, and a crash between them loses or invents events. |
| 25 | [Idempotency](https://dbritto-dev.github.io/systems-workbench/lessons/idempotency/) | Resilience | Payment counter | A lost reply makes the client pay again. An idempotency key lets the server spot the retry and replay the result. |
| 26 | [Saga](https://dbritto-dev.github.io/systems-workbench/lessons/sagas/) | Distributed | Travel agency | Flight, hotel, car, card: no shared transaction, so when a late step fails a saga undoes the earlier ones in reverse. |
| 27 | [N+1 Query](https://dbritto-dev.github.io/systems-workbench/lessons/nplusone/) | Data | Warehouse picker | One query for the list, then one per row. Each is a round trip, so it's invisible locally and slow in staging. |
| 28 | [Cache Stampede](https://dbritto-dev.github.io/systems-workbench/lessons/stampede/) | Data | Bakery | When a hot cache entry expires, every request misses at once and the database takes the whole herd. |
| 29 | [Connection Pool](https://dbritto-dev.github.io/systems-workbench/lessons/connpool/) | Data | Taxi rank | Connections are slow to open and the database holds few. Most pool trouble is sizing, leaks and holding one too long. |
| 30 | [Cardinality](https://dbritto-dev.github.io/systems-workbench/lessons/cardinality/) | Observability | Tally hall | Every metric label multiplies the series you store, and every trace costs space, so what you record must be chosen. |
| 31 | [Debounce](https://dbritto-dev.github.io/systems-workbench/lessons/debounce/) | Frontend | Elevator lobby | Wait until events stop, then act once. Every keystroke restarts the wait, so a burst becomes one request. |
| 32 | [Throttle](https://dbritto-dev.github.io/systems-workbench/lessons/throttle/) | Frontend | Metronome gate | Run the handler at most once per interval while events keep coming: steady updates during a scroll, the rest dropped. |
| 33 | [Queue](https://dbritto-dev.github.io/systems-workbench/lessons/queues/) | Fundamentals | Parcel office | First in, first out. Between producers and workers a queue soaks up bursts and survives crashes, if you ack right. |
| 34 | [Stack](https://dbritto-dev.github.io/systems-workbench/lessons/stacks/) | Fundamentals | Plate stacks | Last in, first out: every function call, every undo, and under overload, which users still get an answer in time. |
| 35 | [BM25](https://dbritto-dev.github.io/systems-workbench/lessons/bm25/) | Search | Assay bench | Rare words weigh more, repeats help less and less, long documents are discounted: why codes match and paraphrases don't. |
| 36 | [Semantic Search](https://dbritto-dev.github.io/systems-workbench/lessons/semantic/) | Search | Star-map table | Embeddings place text by meaning, so paraphrases match with no shared words, while exact codes and names slip away. |
| 37 | [Rank Fusion](https://dbritto-dev.github.io/systems-workbench/lessons/rrf/) | Search | Count room | Merge rankings by 1/(k + rank), not raw scores: no normalising, and two judges agreeing beats one judge's favourite. |
| 38 | [Hybrid Search](https://dbritto-dev.github.io/systems-workbench/lessons/hybrid/) | Search | Sorting plant | Run keyword and meaning search together and merge: each covers the other's misses, if you fuse and size them right. |
| 39 | [Contextual Retrieval](https://dbritto-dev.github.io/systems-workbench/lessons/contextual/) | Search | Print shop | Chunks lose their context when cut. Stamp each with a short summary before indexing, then rerank: far fewer misses. |
| 40 | [Hash Table](https://dbritto-dev.github.io/systems-workbench/lessons/hashtable/) | Fundamentals | Pigeonhole rack | A hash table jumps straight to a bucket. It stays fast only while the hash spreads keys and buckets stay uncrowded. |
| 41 | [Priority Queue](https://dbritto-dev.github.io/systems-workbench/lessons/heap/) | Fundamentals | Triage tree | A priority queue always serves the most important item next. A heap keeps it cheap: O(log n) to add or take the top. |
| 42 | [Ring Buffer](https://dbritto-dev.github.io/systems-workbench/lessons/ringbuffer/) | Fundamentals | Ring table | A fixed array used as a queue: fast and allocation-free, until the writer catches the reader and something must give. |
| 43 | [Latency Numbers](https://dbritto-dev.github.io/systems-workbench/lessons/latency/) | Fundamentals | Courier depot | Each step out from the CPU costs 10 to 1,000 times more. Where data lives often matters more than the code. |
| 44 | [Tail Latency](https://dbritto-dev.github.io/systems-workbench/lessons/percentiles/) | Fundamentals | Timing hall | Most requests are fast; users remember the slow ones. Percentiles show the tail, and fan-out multiplies it. |
| 45 | [Big-O](https://dbritto-dev.github.io/systems-workbench/lessons/bigo/) | Fundamentals | Race track | Big-O is how work grows with input size. Five real algorithms race on the same data: doubling, constants, worst case. |

The site is built with [Astro](https://astro.build) (pure `.astro` components, no UI framework) and deployed to
GitHub Pages: English at `/lessons/<slug>/`, Spanish at `/es/lessons/<slug>/`. Old `lessons/<slug>/*-workbench.html`
links forward to the new URLs.

## How the site is put together

Each lesson is a folder in `src/lessons/<slug>/` (see [src/lessons/README.md](src/lessons/README.md)): `sim.ts` (the
seeded model), `figure.ts` (the machine, drawn at build time), `page.ts` (text in both languages, controls,
experiments, questions) and `live.ts` (the animation, loaded in the browser). Everything else is shared:

```
src/
  content.config.ts         the "lessons" collection: workbench/collection/lessons.json (number, area, card blurbs)
  lessons/                  one folder per lesson, plus types.ts (defineLesson) and the README
  lib/                      shared code: random, stats, tween, format, draw (figure shorthands), the lesson list,
                            the search engine (BM25F) and its index
  elements/                 the custom elements every page is built from: wb-lesson (loads a lesson's live code),
                            wb-figure, wb-stats, wb-seg, wb-actions, wb-experiment; site-switches,
                            lesson-collection, lesson-preview
  runtime/                  shared browser code for live code: wb.ts (loop, counters, dials, meters, L/T),
                            dom.ts (show, setText, setD, setLit, playPause)
  i18n/                     locales, interface strings (ui.ts), localize() for figures drawn in both languages
  layouts/                  Base (head, language alternates, theme) and Lesson (header, machine, experiments, questions)
  components/               Switches, lesson/ (FigurePlate, Panel, Experiments, Questions), collection/ (cards,
                            toolbar, preview dialog)
  pages/[...lang]/          the collection and the lesson pages, once per language
  pages/workbench/          the parts gallery
  pages/search-index.json.ts  every lesson's text in both languages, for search
  styles/                   collection, lesson additions, switches
workbench/                  the drawing layer the figures build on: the Anatomy kit (vendored), shared parts,
                            digits, the lesson stylesheet (served as virtual:workbench.css)
```

What loads, and when:

- **Shared once, cached for every lesson:** the kit + `WB` runtime (about 5 KB gzipped) and the lesson stylesheet.
- **Per lesson, on demand:** the lesson's live code (model + animation) is its own chunk, which `<wb-lesson>` loads
  as the machine or the experiments come near the screen, or on the first interaction. The still frame is plain
  HTML/SVG, and the experiment cards carry their results from the build, so they run without the lesson's code.
- **Collection, on demand:** the search engine and index load on the first search, a `?q=` link or a preview.
  Card images are resized by `astro:assets` and lazy-loaded.

Built on Astro's own features rather than custom code wherever Astro has one: content collections (lesson data),
i18n routing and `astro:i18n` URL helpers, `astro:assets` (images), bundled `<script>` modules and
`import.meta.glob` (shared and per-lesson chunks), `prefetch` (lesson pages load on hover), `redirects` (old URLs)
and `@astrojs/sitemap` (both languages).

## Working on it

The site needs Node 22.23+ (see `.nvmrc`) and [pnpm](https://pnpm.io) (the version is pinned in `packageManager`;
`corepack enable` picks it up). The check and screenshot tools use Playwright.

```sh
pnpm install
pnpm dev                          # the Astro dev server
pnpm build                        # build the site into dist/ (what the Pages workflow runs)
pnpm preview                      # serve dist/ at http://localhost:4321/systems-workbench/
pnpm check:site                   # with preview running: every lesson in both languages, experiments, 390 px, search
pnpm previews queues              # with preview running: re-shoot a lesson's card image (light + dark)
pnpm shot queues shot.png 2000    # with preview running: screenshot a lesson's figure
```

Set `CHROMIUM_PATH` if Playwright should use a browser other than its own.

### Adding a lesson

1. Create `src/lessons/<slug>/` with `sim.ts`, `figure.ts`, `page.ts` and `live.ts`; copy a recent lesson such as
   `queues` and import shared code instead of copying it (the table in `src/lessons/README.md`).
2. Check the machine reads from a still frame: with no labels, a viewer should be able to name every part that
   matters and its state. Use or add shared parts in `workbench/parts.mjs` rather than drawing one-offs.
3. Add it to `workbench/collection/lessons.json` (with `blurb` and `blurb_es` of at most ~120 characters), then
   `pnpm build`, `pnpm preview`, `pnpm previews <slug>` and `pnpm check:site <slug>`. The collection, search and both
   language routes pick it up.
