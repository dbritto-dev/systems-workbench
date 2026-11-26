// @ts-nocheck: shared by the figure (build) and the live code (browser). The tubes themselves are the kit's
// (parts.mjs tube); this is the scale their columns of requests rise on.
// Tube height for a count, on a log scale shared by every rack: `ref` requests fill a tube.
export const heightOf = (count, ref, max) => (count > 0 ? Math.max(0.8, Math.min(max, (max * Math.log10(1 + count)) / Math.log10(1 + ref))) : 0);
