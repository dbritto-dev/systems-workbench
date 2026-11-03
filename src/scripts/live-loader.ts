// Loads a lesson's live code (its model and animation) when it's needed: as the machine or the experiments come
// near the screen, or on the first interaction. Each lesson is its own chunk; shared code (src/runtime, src/lib,
// the kit) is split into chunks every lesson reuses from the browser cache.
// Each lesson's src/lessons/<slug>/live.ts exports mount(data); data is the JSON page.ts put in the page.
const lessons = import.meta.glob<{ default: (data: unknown) => void }>("../lessons/*/live.ts");

export function loadLive() {
  const marker = document.querySelector<HTMLElement>("[data-live]");
  const slug = marker?.dataset.live;
  if (!slug) return;
  const mod = lessons[`../lessons/${slug}/live.ts`];
  if (!mod) return;
  const load = () => mod().then((m) => m.default(JSON.parse(document.querySelector("[data-lesson-data]")?.textContent || "{}")));
  let started = false;
  const events = ["pointerdown", "keydown", "focusin"] as const;
  const start = () => {
    if (started) return;
    started = true;
    io.disconnect();
    events.forEach((e) => removeEventListener(e, start, true));
    load().catch((err) => console.error("lesson code failed to load", err));
  };
  const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) start(); }, { rootMargin: "600px 0px" });
  document.querySelectorAll(".iso-stage, .panel, .exp").forEach((n) => io.observe(n));
  events.forEach((e) => addEventListener(e, start, true));
}
