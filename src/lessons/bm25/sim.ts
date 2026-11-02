// @ts-nocheck: model code ported as-is; shared helpers come from src/lib.
// BM25 over a small knowledge base: the exact formula, with the per-term breakdown the figure draws.
//   score(D, Q) = Σ_t∈Q  IDF(t) · tf·(k1+1) / (tf + k1·(1 − b + b·|D|/avgdl))
//   IDF(t)      = ln(1 + (N − n_t + 0.5) / (n_t + 0.5))
// Tokens are lowercased runs of letters, digits, _ and -; no stemming, no stop-word list.

import { mean, sum } from "../../lib/stats";

export const DOCS = [
  ["D01", "Kernel panic on boot after the update: the system halts with \"not syncing\" before the login screen."],
  ["D02", "If the laptop shows a kernel panic, boot an older kernel from the GRUB menu and remove the new driver."],
  ["D03", "A kernel panic is the operating system stopping itself because it cannot recover safely."],
  ["D04", "Boot order: set the SSD first in the firmware menu so the machine does not try the network card."],
  ["D05", "The printer shows offline after the update. Restart the print spooler and add the printer again."],
  ["D06", "Printer offline? Check the cable, then the queue, then the driver."],
  ["D07", "To share a printer on the office network, open the printer settings and turn on sharing for the team."],
  ["D08", "Chrome shows ERR_CONNECTION_RESET when the proxy closes the socket in the middle of a request."],
  ["D09", "The website loads slowly on the guest network because the captive portal checks every new connection."],
  ["D10", "Reset your password from the sign-in page; the link in the email works for one hour."],
  ["D11", "Order replacement batteries with part number SKU-4471 for the warehouse scanners."],
  ["D12", "The warehouse scanner will not charge if the dock contacts are dirty; clean them with alcohol."],
  ["D13", "How to request a new laptop: fill in the form, get your manager to approve it, and IT will order it."],
  ["D14", "VPN drops every few minutes on hotel wifi. Switch the VPN protocol to TCP in the client settings."],
  ["D15", "The meeting room display does not wake up; press the input button twice to wake the screen."],
  ["D16", "Cheap flights to Lisbon in spring, booked through the travel portal with the company card."],
  ["D17", "Expense reports are due on the fifth of the month; attach every receipt as a photo or a PDF."],
  ["D18", "The build fails with \"out of memory\" on the CI runner; raise the heap size in the job settings."],
  ["D19", "Disk full on the build server: delete old artifacts and docker images older than two weeks."],
  ["D20", "On a kernel panic the screen shows a stack trace; take a photo of it before you reboot and send it to IT."],
  ["D21", "Laptop will not boot at all: hold the power button for ten seconds, unplug the charger, then try again."],
  ["D22", "Email will not sync on the phone after the password change; remove the account and add it again."],
  ["D23", "The car park barrier opens with your badge; visitors get a ticket at the front desk."],
  ["D24", "Your automobile allowance is paid monthly with your salary once the car form is approved."],
  ["D25", "Install the printer driver from the self-service portal; you do not need admin rights for it."],
  ["D26", "Two-factor codes stop working when the phone clock is wrong; set the time to update automatically."],
  ["D27", "The office is closed on public holidays; the help desk answers urgent calls by phone."],
  ["D28", "Shared drives are mapped at sign-in. If a drive is missing, sign out and in again or ask the help desk."],
  ["D29", "Wifi in the north wing is slow in the afternoon because of the number of people on the same access point."],
  ["D30", "Bluetooth headsets pair once per laptop; forget the device and pair it again if the audio cuts out."],
  ["D31", "Monitor flickers on the docking station: replace the cable or lower the refresh rate to 60 Hz."],
  ["D32", "Backups run every night at two; files can be restored from the last thirty days on request."],
  ["D33", "For a printer jam, open the side door, pull the paper out gently and close the door again."],
  ["D34", "Database timeout errors in the reporting app mean the query took more than thirty seconds."],
  ["D35", "The guide to the office: where the kitchen is, where the printers are, how the heating works, who to ask about the lockers, when the cleaners come, what to do in a fire drill, where to park a bike, how to book a desk for the day, and how to find the meeting rooms on each floor. It also covers the rules for the quiet zone, the coffee machine, the plants and the shared fridge, and it lists the names of the floor wardens and the first aiders."],
  ["D36", "Security bulletin: a crafted file can trigger a kernel panic on unpatched machines. The patch is in this month's update; it is rolled out automatically over the next week, and machines that miss it are flagged in the weekly compliance report sent to every team lead, along with the steps to install it by hand if the automatic install does not finish."],
];

export const QUERIES = [
  ["panic", "kernel panic on boot"],
  ["code", "ERR_CONNECTION_RESET"],
  ["printer", "printer offline after update"],
  ["para", "browser keeps dropping the link to the website"],
  ["the", "the kernel panic"],
  ["cheap", "cheap flights"],
];

export const tokens = (text) => (text.toLowerCase().match(/[a-z0-9_]+(?:-[a-z0-9_]+)*/g) || []);

export function makeIndex(docs = DOCS) {
  const toks = docs.map(([, text]) => tokens(text));
  const tf = toks.map((t) => { const m = new Map(); for (const w of t) m.set(w, (m.get(w) || 0) + 1); return m; });
  const df = new Map();
  for (const m of tf) for (const w of m.keys()) df.set(w, (df.get(w) || 0) + 1);
  const len = toks.map((t) => t.length);
  const avg = mean(len);
  return { docs, toks, tf, df, len, avg, N: docs.length };
}

export const idfOf = (ix, term) => { const n = ix.df.get(term) || 0; return Math.log(1 + (ix.N - n + 0.5) / (n + 0.5)); };

// one term's contribution for a document with term frequency tf and length len
export function part(idf, tf, len, avg, k1, b) {
  if (!tf) return 0;
  return idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * len / avg));
}

export const queryTerms = (q) => [...new Set(tokens(q))];

// Every document's score for a query, with the breakdown, sorted best first (ties by id).
export function rank(ix, q, k1 = 1.2, b = 0.75) {
  const terms = queryTerms(q).map((t) => ({ term: t, idf: idfOf(ix, t), df: ix.df.get(t) || 0 }));
  const rows = ix.docs.map(([id, text], d) => {
    const parts = terms.map((t) => { const f = ix.tf[d].get(t.term) || 0; return { term: t.term, tf: f, score: part(t.idf, f, ix.len[d], ix.avg, k1, b) }; });
    return { d, id, text, len: ix.len[d], parts, score: sum(parts.map((p) => p.score)) };
  });
  rows.sort((a, b2) => b2.score - a.score || a.d - b2.d);
  return { terms, rows };
}

// ---------- experiments ----------
const IX = makeIndex();

export function rareRun() {
  const q = "the printer";
  const { terms, rows } = rank(IX, q);
  const the = terms.find((t) => t.term === "the"), printer = terms.find((t) => t.term === "printer");
  const guide = rows.find((r) => r.id === "D35"), d06 = rows.find((r) => r.id === "D06");
  const pos = (id) => rows.findIndex((r) => r.id === id) + 1;
  return { idfThe: the.idf, dfThe: the.df, idfPrinter: printer.idf, dfPrinter: printer.df, guideThe: IX.tf[34].get("the"), guideScore: guide.score, guideRank: pos("D35"), d06Score: d06.score, d06Rank: pos("D06"), N: IX.N };
}

// Stuffing: D16 ("Cheap flights to Lisbon …") with "cheap" repeated n times; each repeat is one more word.
export function stuffRun() {
  const base = IX.tf[15].get("cheap"), baseLen = IX.len[15];
  const idf = idfOf(IX, "cheap");
  const at = (n, k1, b) => part(idf, n, baseLen + (n - base), IX.avg, k1, b);
  const curve = (k1, b) => [1, 2, 3, 5, 10, 20].map((n) => ({ n, s: at(n, k1, b) }));
  return { idf, avg: IX.avg, k12: curve(1.2, 0.75), k0: curve(0, 0.75), k3: curve(3, 0.75), b0: curve(1.2, 0), cap12: idf * 2.2, cap3: idf * 4 };
}

// Length: the same two matches ("kernel" and "panic" once each) in the short D03 and the long D36.
export function lengthRun() {
  const q = "kernel panic";
  const pick = (k1, b) => { const { rows } = rank(IX, q, k1, b); const s = rows.find((r) => r.id === "D03"), l = rows.find((r) => r.id === "D36"); return { short: s.score, long: l.score, ratio: s.score / l.score }; };
  return { lenShort: IX.len[2], lenLong: IX.len[35], avg: IX.avg, b0: pick(1.2, 0), b75: pick(1.2, 0.75), b1: pick(1.2, 1) };
}

// Exact token vs paraphrase: the ERR_CONNECTION_RESET article for the code, and for a description with no shared words.
export function exactRun() {
  const code = rank(IX, "ERR_CONNECTION_RESET"), para = rank(IX, "browser keeps dropping the link to the website");
  const pos = (r) => r.rows.findIndex((x) => x.id === "D08") + 1;
  const d08 = (r) => r.rows.find((x) => x.id === "D08");
  return {
    codeRank: pos(code), codeScore: d08(code).score, codeNext: code.rows[1].score,
    paraRank: pos(para), paraScore: d08(para).score, paraTop: para.rows[0].id, paraTopScore: para.rows[0].score,
    paraTopTerms: para.rows[0].parts.filter((p) => p.tf).map((p) => p.term),
    paraShared: d08(para).parts.filter((p) => p.tf).map((p) => p.term),
  };
}

// Stop words: the same query with and without "the". IDF makes a word that is in every document nearly weightless.
export function stopRun() {
  const a = rank(IX, "kernel panic"), b = rank(IX, "the kernel panic");
  const top = (r) => r.rows.slice(0, 5).map((x) => x.id);
  const the = b.terms.find((t) => t.term === "the");
  const gain = b.rows[0].parts.find((p) => p.term === "the").score;
  return { idfThe: the.idf, dfThe: the.df, N: IX.N, same: top(a).join() === top(b).join(), topA: a.rows[0].score, topB: b.rows[0].score, gain, order: top(b), idfKernel: a.terms[0].idf };
}
