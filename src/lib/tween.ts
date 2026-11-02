// Interpolation and easing for the animations.
type Vec = readonly number[];

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpVec = (a: Vec, b: Vec, t: number) => a.map((v, i) => v + (b[i] - v) * t);
/** The share of the way to a target to move this frame, for a smooth chase at the given rate (per second). */
export const approach = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

export const smoothstep = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
