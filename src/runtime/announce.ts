// Screen-reader announcements: astryx-astro's live regions (astryx-astro/elements/runtime/announce, a port of
// Astryx's useAnnounce), under the names the site's code has always used, so the page has one set of regions for
// our messages and the Astryx components' alike.
//
//   announce("3 lessons")                      polite: read when the screen reader is idle
//   announce("Couldn't load", "assertive")     assertive: interrupts; errors and time-critical messages only
//   const say = announcer({ replace: true });  an owner: each message withdraws its own message that has not been
//   say(`${n} results`);                       read yet (typing faster than a frame says only the latest count)
//   clearAnnouncements()                       empties the regions now (the thing they described went away)
//
// Astryx's regions are visually hidden, aria-atomic, created empty on first use and kept mounted; a write clears the
// region and sets the text on the next frame (messages of one frame joined, a repeat kept once), and the region is
// cleared 2 s after the last write. While a modal <dialog> is open, messages go to regions inside it.
//
// Rules: one owner per message (an element that shows the same words must not have a live role of its own); announce
// changes after load, never what the page already shows at load; say it once per occasion (not on every re-render).
import {
  announce as astryxAnnounce,
  clearAnnouncements as astryxClear,
  createAnnouncer,
} from "astryx-astro/elements/runtime/announce";

export type Politeness = "polite" | "assertive";
export type Announce = (message: string, politeness?: Politeness) => void;

/** Says a message through the shared region for its urgency ("polite" unless it is an error or time-critical). */
export const announce: Announce = (message, politeness = "polite") => {
  const text = message.trim();
  if (text) astryxAnnounce(text, { politeness });
};

/** A message owner. With replace, each message withdraws this owner's previous one while it waits to be read; use
 *  one owner per state a component reports (a result count, a run's status). */
export function announcer({ replace = false }: { replace?: boolean } = {}): Announce {
  const say = createAnnouncer({ hasReplace: replace });
  return (message, politeness = "polite") => {
    const text = message.trim();
    if (text) say(text, { politeness });
  };
}

/** Empties a region now and drops what is waiting. Both regions by default. */
export function clearAnnouncements(politeness?: Politeness) {
  for (const p of politeness ? [politeness] : (["polite", "assertive"] as const)) astryxClear(p);
}
