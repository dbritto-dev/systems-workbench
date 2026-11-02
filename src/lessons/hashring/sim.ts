// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Shared model for the figure and the experiments: 1,000 keys, nodes A–F, a hash ring or hash % n.
// Shared by the experiments (at build time) and the live figure (in the browser).
import { meanBy } from "../../lib/stats";

export const KEYS = 1000;
export const NODE_IDS = ["A", "B", "C", "D", "E", "F"];
export const HOT_KEY = 7;
export const HOT_SHARE = 0.3;
// FNV-1a, then a murmur3 finaliser so nearby strings land far apart.
export function hash32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
export const keyHash = (k) => hash32("key-" + k);
export const keyAngle = (k) => (keyHash(k) / 4294967296) * 360;
// Every node puts `vnodes` markers on the ring; salt stands for "a different cluster" in averaged runs.
export function ringPoints(nodes, vnodes, salt = 0) {
  const points = [];
  for (const node of nodes) for (let i = 0; i < vnodes; i++) points.push({ node, angle: (hash32(salt + ":" + node + "#" + i) / 4294967296) * 360 });
  return points.sort((a, b) => a.angle - b.angle);
}
// The first marker at or after the key's angle, wrapping round past 360°.
export function ownerOnRing(ring, angle) {
  let lo = 0, hi = ring.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ring[mid].angle < angle) lo = mid + 1; else hi = mid; }
  return ring[lo === ring.length ? 0 : lo];
}
export function assign({ mode = "ring", nodes, vnodes = 1, salt = 0 }) {
  const out = new Array(KEYS);
  if (mode === "modulo") { for (let k = 0; k < KEYS; k++) out[k] = nodes[keyHash(k) % nodes.length]; return out; }
  const ring = ringPoints(nodes, vnodes, salt);
  for (let k = 0; k < KEYS; k++) out[k] = ownerOnRing(ring, keyAngle(k)).node;
  return out;
}
export const weightOf = (k, hot) => (hot ? (k === HOT_KEY ? HOT_SHARE : (1 - HOT_SHARE) / (KEYS - 1)) : 1 / KEYS);
// Share of all traffic (or all keys, when nothing is hot) each node serves.
export function loads(owners, nodes, hot = false) {
  const share = Object.fromEntries(nodes.map((n) => [n, 0]));
  owners.forEach((node, k) => { share[node] += weightOf(k, hot); });
  return share;
}
export function spread(share) {
  const values = Object.values(share), avg = 1 / values.length;
  const max = Math.max(...values), min = Math.min(...values);
  return { max, min, avg, ratio: max / avg };
}
export function moved(before, after) {
  const from = {}, to = {}; let count = 0;
  for (let k = 0; k < KEYS; k++) if (before[k] !== after[k]) { count++; from[before[k]] = (from[before[k]] || 0) + 1; to[after[k]] = (to[after[k]] || 0) + 1; }
  return { count, share: count / KEYS, from, to };
}
// Averages over many clusters (salts 1..count): ring results depend on where the markers happened to land.
export const overClusters = (fn, count = 200) => meanBy(Array.from({ length: count }, (_, i) => i + 1), fn);

// ---------- experiments: computed once at build time from the same model ----------
const N = (n) => NODE_IDS.slice(0, n);
const moduloShare = () => moved(assign({ mode: "modulo", nodes: N(4) }), assign({ mode: "modulo", nodes: N(5) })).share;
export function moduloRun() { return { m: moduloShare() }; }
export function ringRun() {
  const m = moduloShare();
  const r = overClusters((s) => moved(assign({ nodes: N(4), salt: s }), assign({ nodes: N(5), salt: s })).share);
  const one = overClusters((s) => Object.keys(moved(assign({ nodes: N(4), salt: s }), assign({ nodes: N(5), salt: s })).from).length <= 1 ? 1 : 0);
  return { m, r, one };
}
export function balanceRun() {
  const ratio = (v) => overClusters((s) => spread(loads(assign({ nodes: N(5), vnodes: v, salt: s }), N(5))).ratio);
  return { r1: ratio(1), r10: ratio(10), r100: ratio(100) };
}
export function failRun() {
  const without = N(5).filter((n) => n !== "C");
  const receivers = (v) => overClusters((s) => Object.keys(moved(assign({ nodes: N(5), vnodes: v, salt: s }), assign({ nodes: without, vnodes: v, salt: s })).to).length);
  return { r1: receivers(1), r100: receivers(100) };
}
export function hotRun() {
  const busiest = (n) => overClusters((s) => spread(loads(assign({ nodes: N(n), vnodes: 100, salt: s }), N(n), true)).max, 50);
  return { b3: busiest(3), b6: busiest(6) };
}
