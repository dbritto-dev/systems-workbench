// Timing helpers for UI code.

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Run now if a call is waiting (and forget the wait). */
  flush(): void;
  /** Drop a waiting call. */
  cancel(): void;
  readonly pending: boolean;
}

/**
 * Trailing debounce: fn runs `wait` ms after the last call. With `maxWait`, it also runs at least that often while
 * calls keep coming, so a long burst (fast typing) still shows progress. The Debounce lesson (src/lessons/debounce)
 * explains both settings.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number, { maxWait }: { maxWait?: number } = {}): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let first = 0;
  let args: A | null = null;
  const run = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    first = 0;
    const a = args;
    args = null;
    if (a) fn(...a);
  };
  const d = ((...a: A) => {
    args = a;
    const now = performance.now();
    if (!first) first = now;
    if (timer) clearTimeout(timer);
    const left = maxWait === undefined ? wait : Math.min(wait, Math.max(0, first + maxWait - now));
    timer = setTimeout(run, left);
  }) as Debounced<A>;
  d.flush = () => { if (args) run(); };
  d.cancel = () => { if (timer) clearTimeout(timer); timer = null; first = 0; args = null; };
  Object.defineProperty(d, "pending", { get: () => args !== null });
  return d;
}
