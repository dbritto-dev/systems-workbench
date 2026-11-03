// The event queue of the discrete-event models: a binary min-heap ordered by less(a, b).

/**
 * A min-heap: pop() returns the entry no other entry is less() than. Equal entries come out in no promised order;
 * put a sequence number in the comparison when ties must come out first in, first out (connpool does).
 */
export function minHeap<T>(less: (a: T, b: T) => boolean) {
  const a: T[] = [];
  const up = (i: number) => {
    while (i > 0) { const p = (i - 1) >> 1; if (!less(a[i], a[p])) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  };
  const down = (i: number) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < a.length && less(a[l], a[m])) m = l;
      if (r < a.length && less(a[r], a[m])) m = r;
      if (m === i) break;
      [a[m], a[i]] = [a[i], a[m]];
      i = m;
    }
  };
  return {
    push(e: T) { a.push(e); up(a.length - 1); },
    pop(): T | undefined { const top = a[0], last = a.pop()!; if (a.length) { a[0] = last; down(0); } return top; },
    peek(): T | undefined { return a[0]; },
    get size() { return a.length; },
  };
}
