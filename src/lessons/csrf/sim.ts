// @ts-nocheck: model code in the style of the other lessons; shared helpers come from src/lib.
// CSRF as a bank counter. The customer's browser is a courier that runs every errand a page asks for, and it brings
// the customer's ID card (the bank's session cookie) whenever the cookie's SameSite rule lets it go to the bank. The
// bank then checks, in order: the card (a payment needs one; a page view without it is served signed out), the
// origin (Sec-Fetch-Site, or Origin where the browser sends no Fetch Metadata), the CSRF token, and at the teller
// whether the action exists for that method.
//
// Three pages are open in the customer's browser:
//   bank   www.bank.example    the bank's own page: same origin as the bank
//   forum  forum.bank.example  a sibling subdomain (user content, or one taken over): same site, other origin
//   other  other.example       any other site: cross-site
//
// Requests (every one is a top-level navigation: a form submit or a followed link):
//   own    the customer's own transfer, a form POST from the bank's page, carrying the page's token   (legit)
//   visit  the customer follows a link to the bank from another site: a GET page view                (legit)
//   form   other.example auto-submits a hidden form: POST /pay                                         (forged)
//   link   other.example sends the browser to GET /pay?to=… (a link or a redirect)                    (forged)
//   forum  a page on forum.bank.example submits a form: POST /pay                                      (forged)
//
// cfg:
//   samesite  "none" | "lax" | "strict"     the session cookie's SameSite attribute
//   token     "off" | "copy" | "session"    no token; a double-submit token (the form repeats a csrf cookie's value);
//                                            a synchronizer token kept with the session on the server
//   origin    "off" | "site" | "origin"     no check; refuse cross-site unsafe requests; refuse any unsafe request
//                                            that isn't same-origin (http.CrossOriginProtection in Go 1.25 does this)
//   getPay    true | false                  the bank still has an old GET /pay endpoint that moves money
//   errand    "form" | "link" | "forum" | "mix"   what the hostile pages send (mix: the three in turn, at random)
// Rates are per second of machine time; they only set how busy the road is.

import { rngMixed, exponential } from "../../lib/random";
import { averageOver } from "../../lib/stats";

export const DEFAULTS = { samesite: "lax", token: "off", origin: "off", getPay: true, errand: "mix", own: 0.12, visit: 0.06, forged: 0.3 };

export const KINDS = {
  own: { from: "bank", method: "POST", forged: false, pay: true },
  visit: { from: "other", method: "GET", forged: false, pay: false },
  form: { from: "other", method: "POST", forged: true, pay: true },
  link: { from: "other", method: "GET", forged: true, pay: true },
  forum: { from: "forum", method: "POST", forged: true, pay: true },
};
export const FORGED = ["form", "link", "forum"];
export const REL = { bank: "same-origin", forum: "same-site", other: "cross-site" };

/** What the browser and the bank do with one request. The browser decides whether the card goes along; the bank's
 *  gates refuse in order. stop: the first gate that refused (null: it reached the teller and was carried out). */
export function decide(kind, cfg) {
  const k = KINDS[kind], rel = REL[k.from];
  // SameSite: None sends the cookie everywhere; Lax adds cross-site top-level navigations with a safe method (GET);
  // Strict sends it only when the request comes from the same site. Every request here is a top-level navigation.
  const card = cfg.samesite === "none" || rel !== "cross-site" || (cfg.samesite === "lax" && k.method === "GET");
  const unsafe = k.method !== "GET";
  let stop = null;
  // Without the card a payment is refused at the CARD gate; a plain page view is served, signed out.
  if (!card && k.pay) stop = "card";
  // Origin / Fetch Metadata checks, like CSRF middleware, look only at unsafe methods.
  else if (unsafe && cfg.origin !== "off" && (rel === "cross-site" || (cfg.origin === "origin" && rel !== "same-origin"))) stop = "origin";
  // Token checks skip safe methods too (Django, Rails and most frameworks do the same). A plain double-submit token
  // (not signed, not bound to the session) only proves the request can write cookies for the site, which a sibling
  // subdomain can; OWASP recommends a session-bound or signed token instead. Another site can't pass either check.
  else if (unsafe && cfg.token !== "off" && !(k.from === "bank" || (cfg.token === "copy" && k.from === "forum"))) stop = "token";
  else if (k.pay && k.method === "GET" && !cfg.getPay) stop = "teller";
  const outcome = k.forged ? (stop ? "blocked" : "paid") : stop ? "refused" : card ? "ok" : "signedout";
  return { card, stop, outcome };
}

export function makeSim(cfgIn, seed = 1) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rnd = rngMixed(seed);
  const exp = (rate) => (rate > 0 ? exponential(rnd, 1 / rate) : Infinity);
  const reqs = [];
  const st = { sent: 0, paid: 0, blocked: 0, ok: 0, signedout: 0, refused: 0, own: 0, visit: 0, byKind: Object.fromEntries(Object.keys(KINDS).map((k) => [k, { n: 0, paid: 0, blocked: 0, ok: 0, signedout: 0, card: 0 }])) };
  let t = 0, nextId = 1;
  const next = { own: exp(cfg.own), visit: exp(cfg.visit), forged: exp(cfg.forged) };
  const pickForged = () => (cfg.errand === "mix" ? FORGED[Math.floor(rnd() * 3)] : cfg.errand);

  function send(at, kind) {
    const d = decide(kind, cfg);
    const r = { id: nextId++, t: at, kind, ...d };
    reqs.push(r);
    const b = st.byKind[kind];
    b.n++; b[d.outcome] = (b[d.outcome] || 0) + 1; if (d.card) b.card++;
    st[d.outcome]++;
    if (KINDS[kind].forged) st.sent++; else st[kind]++;
    return r;
  }

  function runTo(until) {
    for (;;) {
      const which = next.own <= next.visit && next.own <= next.forged ? "own" : next.visit <= next.forged ? "visit" : "forged";
      const when = next[which];
      if (when > until) break;
      t = when;
      send(t, which === "forged" ? pickForged() : which);
      next[which] = t + exp(cfg[which]);
    }
    t = until;
  }

  return {
    cfg, reqs, st, runTo,
    /** One forged errand now (the "Send a forged errand" button): the errand setting, or one at random for mix. */
    forge: (at, kind) => { runTo(at); return send(at, kind || pickForged()); },
    visit: (at) => { runTo(at); return send(at, "visit"); },
    get t() { return t; },
  };
}

// ---------- experiments: headless runs averaged over seeds ----------
export const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89];
export const RUN_S = 600;   // ten minutes of machine time per run
const run = (cfg) => averageOver(SEEDS, (seed) => {
  const m = makeSim(cfg, seed);
  m.runTo(RUN_S);
  const out = { sent: m.st.sent, paid: m.st.paid, blocked: m.st.blocked, ok: m.st.ok, own: m.st.own, visit: m.st.visit, signedout: m.st.signedout, refused: m.st.refused };
  for (const [k, b] of Object.entries(m.st.byKind)) { out[k + "N"] = b.n; out[k + "Paid"] = b.paid || 0; out[k + "Card"] = b.card; out[k + "Signedout"] = b.signedout || 0; }
  return out;
});
const share = (a, b) => (b > 0 ? a / b : 0);
const shares = (r) => ({ ...r, paidShare: share(r.paid, r.sent), formShare: share(r.formPaid, r.formN), linkShare: share(r.linkPaid, r.linkN), forumShare: share(r.forumPaid, r.forumN), outShare: share(r.signedout, r.visit), okShare: share(r.ok, r.own + r.visit) });

const BASE = { samesite: "none", token: "off", origin: "off", getPay: true };
export const SETUPS = {
  cors: { ...BASE, errand: "form" },
  lax: { ...BASE, samesite: "lax", errand: "mix" },
  strict: { ...BASE, samesite: "strict", errand: "forum" },
  tokens: { ...BASE, samesite: "strict", token: "copy", errand: "forum" },
  get: { samesite: "lax", token: "session", origin: "origin", getPay: true, errand: "link" },
};

// 1. SameSite=None, no other defence; other.example auto-submits a form.
export const corsRun = () => shares(run(SETUPS.cors));
// 2. SameSite=Lax; the three forged errands, at random.
export const laxRun = () => shares(run(SETUPS.lax));
// 3. The forum's form, under Lax and under Strict; and what Strict costs the customer's own link visits.
export const strictRun = () => ({ lax: shares(run({ ...SETUPS.strict, samesite: "lax" })), strict: shares(run(SETUPS.strict)) });
// 4. Strict, the forum's form: a double-submit copy vs a session token vs a same-origin check.
export const tokensRun = () => ({ copy: shares(run(SETUPS.tokens)), session: shares(run({ ...SETUPS.tokens, token: "session" })), origin: shares(run({ ...SETUPS.tokens, token: "off", origin: "origin" })) });
// 5. Every defence on, other.example's link to GET /pay: the old GET endpoint vs POST only.
export const getRun = () => ({ old: shares(run(SETUPS.get)), postOnly: shares(run({ ...SETUPS.get, getPay: false })) });
