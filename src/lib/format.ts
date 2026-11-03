// Number formatting for readouts, stats and verdicts.

/** One decimal, always shown: 3 → "3.0". */
export const one = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
/** Rounded to a whole number. */
export const n0 = (x: number) => String(Math.round(x));
/** A share as a whole percentage: 0.237 → "24%". */
export const pct = (x: number) => Math.round(100 * x) + "%";
/** A whole number with thousands separators: 3600 → "3,600". */
export const int = (x: number) => Math.round(x).toLocaleString("en");
/** One decimal under 10, whole from 10 up: 3.14 → "3.1", 42.5 → "43". */
export const oneUnder10 = (x: number) => (x < 10 ? x.toFixed(1) : String(Math.round(x)));
/** Seconds: one decimal under 10, whole above. */
export const secs = (x: number) => oneUnder10(x) + " s";
/** Seconds, always one decimal: 2 → "2.0 s". Rounds like toFixed, not like one(): 0.35 → "0.3 s" (one() gives "0.4"). */
export const secs1 = (x: number) => x.toFixed(1) + " s";
/** Seconds, always two decimals: 0.5 → "0.50 s". */
export const secs2 = (x: number) => x.toFixed(2) + " s";
/** Seconds shown as whole milliseconds: 0.25 → "250 ms". */
export const msFromSecs = (x: number) => Math.round(x * 1000) + " ms";
/** Seconds as whole milliseconds under one second, two decimals of a second from there: 0.25 → "250 ms", 1.5 → "1.50 s". */
export const msOrSecs = (x: number) => (x < 1 ? msFromSecs(x) : secs2(x));
/** Milliseconds (a value already in ms): one decimal under 10, whole above: 3.25 → "3.3 ms", 120.4 → "120 ms". */
export const millis = (x: number) => oneUnder10(x) + " ms";
/** A share as a percentage with one decimal under 10%: 0.042 → "4.2%", 0.37 → "37%". */
export const pctTenths = (x: number) => (100 * x).toFixed(x < 0.1 ? 1 : 0) + "%";
