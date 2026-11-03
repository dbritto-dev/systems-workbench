// <wb-lesson slug="queues">: a lesson's machine and experiments (layouts/Lesson.astro). It loads the lesson's live
// code, src/lessons/<slug>/live.ts, when the machine or the experiments come near the screen or on the reader's
// first interaction, and calls its default export: mount(data, root), where data is the JSON page.ts put in the page
// and root is this element. Each lesson is its own chunk; shared code is split into chunks every lesson reuses.
//
// What live code gets from root:
//   root.figure                  <wb-figure>: .stage, .svg, .say(text)
//   root.stat(key, value)        a stat in the strip under the figure
//   root.seg(name)               a <wb-seg>: .value to read or press an option
//   root.press(name, value)      press an option of the segment(s) called name, without a "change" event (for a
//                                multi-select segment, a list or space-separated values: the options to have on)
//   root.button(name)            an action button <button data-act="name">, e.g. to relabel it
//   root.on(type, fn)            "change" (name, value, detail) from a segment, "action" (name, detail) from a
//                                button or Space on the figure, "watch" (watch, id) from an experiment card,
//                                "run" (id, respond) from a card without a build-time result
//   root.$(selector), root.$$(selector)   elements inside the lesson
//   root.ready                   resolves once mount() has run
import type { ChangeDetail, ActionDetail, WbSeg, WbStats, WbActions } from "./wb-controls";
import type { WbFigure } from "./wb-figure";
import type { RunDetail, WatchDetail } from "./wb-experiment";
import "./wb-controls";
import "./wb-figure";
import "./wb-experiment";

const LIVE = import.meta.glob<{ default: (data: any, root: WbLesson) => void }>("../lessons/*/live.ts");
const FIRST_TOUCH = ["pointerdown", "keydown", "focusin"] as const;

type Handlers = {
  change: (name: string, value: string, detail: ChangeDetail & { event: CustomEvent }) => void;
  action: (name: string, detail: ActionDetail & { event: CustomEvent }) => void;
  watch: (watch: any, id: string) => void;
  run: (id: string, respond: RunDetail["respond"]) => void;
};

export class WbLesson extends HTMLElement {
  #started = false;
  #mounted = false;
  #early: CustomEvent[] = [];
  #io: IntersectionObserver | null = null;
  #resolve!: () => void;
  readonly ready = new Promise<void>((r) => { this.#resolve = r; });

  get slug() { return this.getAttribute("slug") ?? ""; }
  get data() { return JSON.parse(this.querySelector("script[data-lesson-data]")?.textContent || "{}"); }
  get figure() { return this.querySelector<WbFigure>("wb-figure")!; }
  get stats() { return this.querySelector<WbStats>("wb-stats"); }

  $<E extends Element = HTMLElement>(sel: string) { return this.querySelector<E>(sel); }
  $$<E extends Element = HTMLElement>(sel: string) { return [...this.querySelectorAll<E>(sel)]; }
  stat(key: string, value: unknown) { this.stats?.set(key, value); }
  seg(name: string) { return this.querySelector<WbSeg>(`wb-seg[name="${name}"]`); }
  press(name: string, value: string | number | boolean | string[]) { this.querySelectorAll<WbSeg>(`wb-seg[name="${name}"]`).forEach((s) => { s.value = Array.isArray(value) ? value : String(value); }); }
  button(name: string) { return this.querySelector<WbActions>("wb-actions")?.button(name) ?? this.querySelector<HTMLButtonElement>(`button[data-act="${name}"]`); }

  on<K extends keyof Handlers>(type: K, fn: Handlers[K]) {
    const h = (e: Event) => {
      const ev = e as CustomEvent, d = ev.detail;
      if (type === "change") (fn as Handlers["change"])(d.name, d.value, { ...d, event: ev });
      else if (type === "action") (fn as Handlers["action"])(d.name, { ...d, event: ev });
      else if (type === "watch") (fn as Handlers["watch"])((d as WatchDetail).watch, d.id);
      else (fn as Handlers["run"])(d.id, (d as RunDetail).respond);
    };
    this.addEventListener(`wb-${type}`, h);
    return () => this.removeEventListener(`wb-${type}`, h);
  }

  connectedCallback() {
    if (this.#started) return;
    // A Watch click before the live code is in: keep it and send it again once mount() has run.
    this.addEventListener("wb-watch", this.#keepEarly);
    this.#io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) this.start(); }, { rootMargin: "600px 0px" });
    this.querySelectorAll(".iso-stage, .panel, wb-experiment").forEach((n) => this.#io!.observe(n));
    FIRST_TOUCH.forEach((t) => addEventListener(t, this.#touch, true));
  }
  disconnectedCallback() { this.#stopWatching(); }

  #touch = () => this.start();
  #keepEarly = (e: Event) => { if (!this.#mounted && !this.#early.includes(e as CustomEvent)) this.#early.push(e as CustomEvent); };
  #stopWatching() {
    this.#io?.disconnect();
    FIRST_TOUCH.forEach((t) => removeEventListener(t, this.#touch, true));
  }

  /** Load and mount the live code now (it otherwise waits for the machine to come into view). */
  start() {
    if (this.#started) return this.ready;
    this.#started = true;
    this.#stopWatching();
    const load = LIVE[`../lessons/${this.slug}/live.ts`];
    if (!load) return this.ready;
    load()
      .then((m) => {
        m.default(this.data, this);
        this.#mounted = true;
        this.removeEventListener("wb-watch", this.#keepEarly);
        this.#resolve();
        for (const e of this.#early.splice(0)) (e.target as Element).dispatchEvent(new CustomEvent(e.type, { bubbles: true, detail: e.detail }));
      })
      .catch((err) => console.error("lesson code failed to load", err));
    return this.ready;
  }
}

if (!customElements.get("wb-lesson")) customElements.define("wb-lesson", WbLesson);

declare global {
  interface HTMLElementTagNameMap {
    "wb-lesson": WbLesson;
  }
}
