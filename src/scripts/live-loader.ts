// Loads a lesson's live code (its model and animation) when it's needed: as the machine or the experiments come
// near the screen, or on the first interaction. Each lesson is its own chunk; the shared runtime (kit + WB) is one
// chunk that every lesson reuses from the browser cache.
const modules = import.meta.glob("../generated/live/*.js");

export function loadLive() {
  const marker = document.querySelector<HTMLElement>("[data-live]");
  const load = marker && modules[`../generated/live/${marker.dataset.live}.js`];
  if (!load) return;
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
