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
/** The q-quantile (0..1) as sorted[floor(q * (n - 1))]: rank counted over the gaps between values. See rankQuantile. */
export function percentile(xs: readonly number[], q: number) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))];
}
/**
 * The q-quantile (0..1) by rank floor(q · n): sorted[min(n - 1, floor(q * n))], or `empty` when there are no values.
 * Most lessons' published numbers use this rule. It is not percentile(), which takes sorted[floor(q * (n - 1))]:
 * of 20 values, the p95 here is the largest (index 19) and percentile()'s the second largest (index 18); of an even
 * count, the median here is the upper of the two middle values. Sorts a copy.
 */
export function rankQuantile(xs: readonly number[], q: number, empty = 0) {
  if (!xs.length) return empty;
  return rankQuantileSorted([...xs].sort((a, b) => a - b), q);
}
/** rankQuantile() of values already sorted ascending. */
export const rankQuantileSorted = (sorted: readonly number[], q: number, empty = 0) =>
  (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : empty);
/** The median, taking the upper middle value of an even count: sorted[floor(n / 2)] (rankQuantile at 0.5). */
export const upperMedian = (xs: readonly number[], empty = 0) => rankQuantile(xs, 0.5, empty);
export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
