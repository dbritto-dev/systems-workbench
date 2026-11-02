// Seeded random numbers for the models. Every lesson's experiments are averaged over fixed seeds, so the same seed
// must give the same numbers on every machine and in every build.

/**
 * The generator most lessons use: xorshift32 written with a signed right shift (s >> 17). Not textbook xorshift
 * (that is xorshift32 below), but it's what the published numbers were computed with, so it stays.
 */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Textbook xorshift32 (unsigned shifts). */
export function xorshift32(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/**
 * xorshift with the seed scrambled first. Plain xorshift started from seeds 1, 2, 3… gives near-identical first
 * values; use this when seeds are small consecutive numbers and the first draws matter.
 */
export function rngMixed(seed: number) {
  let s = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** A linear congruential generator (Numerical Recipes constants). */
export function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** A standard normal draw (Box–Muller) from a uniform generator. */
export function normal(r: () => number) {
  const u = Math.max(1e-12, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** An exponential draw with the given mean. */
export const exponential = (r: () => number, mean: number) => -Math.log(1 - r()) * mean;
