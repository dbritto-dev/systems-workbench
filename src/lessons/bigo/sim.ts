// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// Big-O lesson model: real algorithms that count their own steps on seeded data. A step is one comparison
// (or one hash-set operation), so "how many steps" is something each function measures, not a formula.
// Used by page.ts at build time (the figure's lanes and every experiment) and by live.ts in the browser.
import { lcg } from "../../lib/random";
import { averageOver } from "../../lib/stats";

// n distinct even numbers (0, 2, 4, …) in random, sorted or reversed order. Odd numbers are never present.
export function makeData(n, seed = 1, shape = "random") {
  const a = Array.from({ length: n }, (_, i) => i * 2);
  if (shape === "sorted") return a;
  if (shape === "reversed") return a.reverse();
  const r = lcg(seed);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
  return a;
}

// O(1): read the item at a known position.
export function readAt(a, k) { return { steps: 1, value: a[k] }; }

// O(n): look at items one by one until the value turns up (all n when it isn't there).
export function linearSearch(a, x) {
  let steps = 0;
  for (let i = 0; i < a.length; i++) { steps++; if (a[i] === x) return { steps, found: true }; }
  return { steps, found: false };
}

// O(log n): halve a sorted range each step.
export function binarySearch(sorted, x) {
  let lo = 0, hi = sorted.length - 1, steps = 0;
  while (lo <= hi) {
    steps++;
    const mid = (lo + hi) >> 1;
    if (sorted[mid] === x) return { steps, found: true };
    if (sorted[mid] < x) lo = mid + 1; else hi = mid - 1;
  }
  return { steps, found: false };
}

// O(n log n): merge sort. Counts comparisons, element moves (copies into halves and back) and calls.
export function mergeSort(a) {
  const ops = { cmp: 0, move: 0, calls: 0 };
  const sort = (arr) => {
    ops.calls++;
    if (arr.length <= 1) return arr;
    const mid = arr.length >> 1;
    ops.move += arr.length;                       // copying the two halves out
    const l = sort(arr.slice(0, mid)), r = sort(arr.slice(mid));
    const out = [];
    let i = 0, j = 0;
    while (i < l.length && j < r.length) { ops.cmp++; out.push(l[i] <= r[j] ? l[i++] : r[j++]); ops.move++; }
    while (i < l.length) { out.push(l[i++]); ops.move++; }
    while (j < r.length) { out.push(r[j++]); ops.move++; }
    return out;
  };
  const sorted = sort(a.slice());
  return { sorted, ...ops };
}

// O(n²) worst case, O(n) on sorted input: insertion sort. Counts comparisons and moves.
export function insertionSort(input) {
  const a = input.slice();
  let cmp = 0, move = 0;
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0) { cmp++; if (a[j] > key) { a[j + 1] = a[j]; move++; j--; } else break; }
    a[j + 1] = key; move++;
  }
  return { sorted: a, cmp, move };
}

// For each order, is its customer on the list? Array scan per order (a loop hiding inside .includes) vs a Set.
export function includesInLoop(orders, list) {
  let steps = 0, hits = 0;
  for (const o of orders) { const r = linearSearch(list, o); steps += r.steps; if (r.found) hits++; }
  return { steps, hits };
}
export function setLookups(orders, list) {
  const set = new Set();
  let steps = 0, hits = 0;
  for (const c of list) { set.add(c); steps++; }     // building the set: one step per insert
  for (const o of orders) { steps++; if (set.has(o)) hits++; }
  return { steps, hits };
}

// The five lanes of the machine, each a real algorithm run on n items. The two sorts sort the same shuffled items
// and count comparisons, so the merge-sort constant on the machine can show where insertion sort wins.
export const LANES = ["1", "log", "n", "nlog", "n2"];
export function laneSteps(n, seed = 7) {
  const data = makeData(n, seed);
  const sorted = makeData(n, seed, "sorted");
  const absent = 2 * Math.floor(n / 3) + 1;          // an odd number: never in the data
  return {
    "1": readAt(data, n >> 1).steps,
    log: binarySearch(sorted, absent).steps,
    n: linearSearch(data, absent).steps,
    nlog: mergeSort(data).cmp,
    n2: insertionSort(data).cmp,
  };
}

// Crossover: time in "units" with every comparison and move costing 1, and each merge-sort call an extra
// CALL_COST (making its two halves, the call itself). Averaged over seeds.
export const CALL_COST = 12;
export function sortCosts(n, seeds = [1, 2, 3, 4, 5, 6, 7, 8]) {
  return averageOver(seeds, (s) => {
    const d = makeData(n, s);
    const i = insertionSort(d), m = mergeSort(d);
    return { insertion: i.cmp + i.move, merge: m.cmp + m.move + CALL_COST * m.calls };
  });
}

// Amortising: q lookups in n unsorted items, half the targets present. Scan every time, or sort once and
// binary-search each time.
export function lookupPlans(n, q, seed = 3) {
  const data = makeData(n, seed);
  const r = lcg(seed * 31 + q);
  const targets = Array.from({ length: q }, () => Math.floor(r() * 2 * n));   // even (present) or odd (absent)
  let scan = 0;
  for (const x of targets) scan += linearSearch(data, x).steps;
  const ms = mergeSort(data);
  let sortThen = ms.cmp;
  for (const x of targets) sortThen += binarySearch(ms.sorted, x).steps;
  return { scan, sortThen, sortCost: ms.cmp };
}

// A step count in a few characters, for the carriages and the readout: 2,000 · 50K · 4.9M · 50M.
// Shared by the figure (build time) and the live code.
export const compact = (v) => (v < 10000 ? v.toLocaleString("en") : v < 1e6 ? Math.round(v / 1000) + "K" : (v < 1e7 ? (v / 1e6).toFixed(1) : Math.round(v / 1e6)) + "M");
