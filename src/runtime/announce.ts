// Screen-reader announcements through the page's shared live regions (Astryx's useAnnounce).
//
//   announce("3 lessons")                      polite: read when the screen reader is idle
//   announce("Couldn't load", "assertive")     assertive: interrupts; errors and time-critical messages only
//   const say = announcer({ replace: true });  an owner: each message withdraws its own message that has not been
//   say(`${n} results`);                       read yet (typing faster than a frame says only the latest count)
//
// The page has one polite region (role="status") and one assertive region (role="alert"), both aria-atomic,
// visually hidden with inline CSS (they work without a stylesheet), appended to <body> empty and kept mounted: many
// screen readers ignore a live region created with its text, but read a change in one already there. A write clears
// the region, sets the text on the next frame (an immediate re-set can be merged with the clear, and identical text
// ignored), joins the messages written in the same frame with spaces (an identical one is kept once), and clears the
// region 2 s after the last write, so stale text doesn't linger. While a modal <dialog> is open the rest of the page
// is inert, so messages go to a pair of regions inside the topmost one.
//
// Rules: one owner per message (an element that shows the same words must not have a live role of its own); announce
// changes after load, never what the page already shows at load; say it once per occasion (not on every re-render).

export type Politeness = "polite" | "assertive";
export type Announce = (message: string, politeness?: Politeness) => void;

const CLEAR_MS = 2000;
const HIDDEN =
  "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);" +
  "white-space:nowrap;border:0;inset-block-start:0;inset-inline-start:0;pointer-events:none;user-select:none;";

interface Pending { text: string; owners: Set<object> }
interface Channel { el: HTMLElement; pending: Pending[]; frame: number | null; timer: ReturnType<typeof setTimeout> | null }
type Regions = Record<Politeness, Channel>;

const hosts = new WeakMap<Element, Regions>();

function region(host: Element, politeness: Politeness): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-ux-live", politeness);
  el.setAttribute("role", politeness === "assertive" ? "alert" : "status");
  el.setAttribute("aria-live", politeness);
  el.setAttribute("aria-atomic", "true");
  el.style.cssText = HIDDEN;
  host.append(el);
  return el;
}

/** The regions messages go to now: inside the topmost open modal dialog, else on <body>. */
function regions(): Regions | null {
  if (typeof document === "undefined" || !document.body) return null;
  let host: Element = document.body;
  try {
    const modals = document.querySelectorAll("dialog:modal");
    if (modals.length) host = modals[modals.length - 1];
  } catch { /* no :modal support: the body's regions */ }
  let r = hosts.get(host);
  if (!r) {
    const channel = (p: Politeness): Channel => ({ el: region(host, p), pending: [], frame: null, timer: null });
    r = { polite: channel("polite"), assertive: channel("assertive") };
    hosts.set(host, r);
  }
  for (const c of Object.values(r)) if (!c.el.isConnected) host.append(c.el);
  return r;
}

const shared = {};
const lastByOwner = new WeakMap<object, { channel: Channel; pending: Pending }>();

function write(message: string, politeness: Politeness, owner: object, replace: boolean) {
  const text = message.trim();
  const r = regions();
  if (!r || !text) return;
  const c = r[politeness === "assertive" ? "assertive" : "polite"];
  // Replace: take back this owner's last message if the region hasn't exposed it yet.
  const last = lastByOwner.get(owner);
  if (replace && last && last.channel.pending.includes(last.pending)) {
    last.pending.owners.delete(owner);
    if (!last.pending.owners.size) last.channel.pending.splice(last.channel.pending.indexOf(last.pending), 1);
  }
  let p = c.pending.find((m) => m.text === text);
  if (p) p.owners.add(owner);
  else c.pending.push((p = { text, owners: new Set([owner]) }));
  lastByOwner.set(owner, { channel: c, pending: p });
  if (c.frame === null) {
    c.el.textContent = "";
    c.frame = requestAnimationFrame(() => {
      c.frame = null;
      c.el.textContent = c.pending.map((m) => m.text).join(" ");
      c.pending = [];
    });
  }
  if (c.timer !== null) clearTimeout(c.timer);
  c.timer = setTimeout(() => { c.timer = null; c.el.textContent = ""; }, CLEAR_MS);
}

/** Says a message through the shared region for its urgency ("polite" unless it is an error or time-critical). */
export const announce: Announce = (message, politeness = "polite") => write(message, politeness, shared, false);

/** A message owner. With replace, each message withdraws this owner's previous one while it waits to be read; use
 *  one owner per state a component reports (a result count, a run's status). */
export function announcer({ replace = false }: { replace?: boolean } = {}): Announce {
  const owner = {};
  return (message, politeness = "polite") => write(message, politeness, owner, replace);
}

/** Empties a region now and drops what is waiting (the thing it described went away). Both regions by default. */
export function clearAnnouncements(politeness?: Politeness) {
  const r = regions();
  if (!r) return;
  for (const p of politeness ? [politeness] : (["polite", "assertive"] as const)) {
    const c = r[p];
    if (c.frame !== null) cancelAnimationFrame(c.frame);
    if (c.timer !== null) clearTimeout(c.timer);
    c.frame = c.timer = null;
    c.pending = [];
    c.el.textContent = "";
  }
}

// Mount the page's regions as soon as a page uses this module (module scripts run after parsing; a classic script in
// the head waits for the body), so they are in the accessibility tree, empty, well before the first message.
if (typeof document !== "undefined") {
  if (document.body) regions();
  else document.addEventListener("DOMContentLoaded", () => regions(), { once: true });
}
