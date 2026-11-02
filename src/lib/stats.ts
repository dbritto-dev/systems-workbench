// Small statistics the models and experiments share.

export const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: readonly number[]) => (xs.length ? sum(xs) / xs.length : 0);
/** The mean of f(x) over xs, e.g. meanBy(runs, (r) => r.wait). */
export const meanBy = <T>(xs: readonly T[], f: (x: T) => number) => (xs.length ? xs.reduce((a, x) => a + f(x), 0) / xs.length : 0);
/** Run fn once per seed and average every numeric field of the results. */
export function averageOver<R extends Record<string, number>>(seeds: readonly number[], fn: (seed: number) => R): R {
  const runs = seeds.map(fn);
  return Object.fromEntries(Object.keys(runs[0]).map((k) => [k, meanBy(runs, (r) => r[k])])) as R;
}
/** The q-quantile (0..1) by the nearest-rank-below rule the lessons use: sorted[floor(q * (n - 1))]. */
export function percentile(xs: readonly number[], q: number) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))];
}
export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
