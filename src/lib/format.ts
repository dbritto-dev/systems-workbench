// Number formatting for readouts, stats and verdicts.

/** One decimal, always shown: 3 → "3.0". */
export const one = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
/** Rounded to a whole number. */
export const n0 = (x: number) => String(Math.round(x));
/** A share as a whole percentage: 0.237 → "24%". */
export const pct = (x: number) => Math.round(100 * x) + "%";
/** Seconds: one decimal under 10, whole above. */
export const secs = (x: number) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + " s";
