// English / Spanish for the workbench pages. Both languages ship in the page; CSS shows one.
//
//   t("The machine", "La máquina")   a bilingual string ({ en, es }); plain strings stay the same in both
//   tx(v)                            HTML for v: two spans (data-l="en" / "es") when bilingual, v itself otherwise
//   tx(v, true)                      the same, HTML-escaped (for text fields)
//   enOf(v), esOf(v)                 one language of v (plain strings return themselves)
//   ariaLabel(v)                     an aria-label attribute that follows the language switch
//
// In the browser, WB.lang() is "en" or "es", WB.L(v) or WB.L(en, es) picks the current one, and
// WB.onLang(fn) runs fn when the reader switches, so live text (readouts, verdicts) can be redrawn.
// The language comes from ?lang=es|en, then the reader's last choice, then the browser's language.

const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escHtml(s).replace(/"/g, "&quot;");

export const t = (en, es) => ({ en, es });
export const isT = (v) => v != null && typeof v === "object" && "en" in v && "es" in v;
export const enOf = (v) => (isT(v) ? v.en : v);
export const esOf = (v) => (isT(v) ? v.es : v);
export const tx = (v, escape = false) => {
  if (v == null) return "";
  const f = escape ? escHtml : (s) => s;
  return isT(v) ? `<span data-l="en">${f(v.en)}</span><span data-l="es" lang="es">${f(v.es)}</span>` : f(v);
};
export const ariaLabel = (v) => (isT(v)
  ? `aria-label="${escAttr(v.en)}" data-aria-en="${escAttr(v.en)}" data-aria-es="${escAttr(v.es)}"`
  : `aria-label="${escAttr(v)}"`);

// Hides the other language everywhere, HTML and SVG alike.
export const LANG_CSS = `
:root:not([data-lang="es"]) [data-l="es"],:root[data-lang="es"] [data-l="en"]{display:none!important}
`;

// Runs in <head> before the page paints, so the first frame is already in the right language.
export const LANG_HEAD = `<script>(function(){var r=document.documentElement,l=null;try{var q=new URLSearchParams(location.search).get("lang");if(q==="es"||q==="en")l=q;}catch(e){}
if(!l){try{var s=localStorage.getItem("workbench-lang");if(s==="es"||s==="en")l=s;}catch(e){}}
if(!l){var n=(navigator.languages&&navigator.languages[0])||navigator.language||"en";l=/^es\\b/i.test(n)?"es":"en";}
r.setAttribute("data-lang",l);r.setAttribute("lang",l);})();</script>`;

// The EN / ES switch; sits beside the theme switch.
export const langSwitchHtml = () => `<div class="seg lang-seg" role="group" aria-label="Language" data-aria-en="Language" data-aria-es="Idioma"><button type="button" data-lang-choice="en" lang="en">EN</button><button type="button" data-lang-choice="es" lang="es">ES</button></div>`;

// After the body: wires the switch, keeps aria-labels and the document title in the current language,
// keeps ?lang in the address bar in step, and tells the page (wb-lang event) so live text can redraw.
export const LANG_SCRIPT = `<script>(function(){
var r=document.documentElement,btns=document.querySelectorAll("[data-lang-choice]"),title=document.querySelector("title");
function cur(){return r.getAttribute("data-lang")==="es"?"es":"en";}
function apply(){var l=cur();
btns.forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-lang-choice")===l));});
document.querySelectorAll("[data-aria-es]").forEach(function(e){var v=e.getAttribute("data-aria-"+l);if(v!=null)e.setAttribute("aria-label",v);});
if(title&&title.hasAttribute("data-es"))document.title=title.getAttribute("data-"+l)||document.title;}
btns.forEach(function(b){b.addEventListener("click",function(){var l=b.getAttribute("data-lang-choice");if(l===cur())return;
r.setAttribute("data-lang",l);r.setAttribute("lang",l);
try{localStorage.setItem("workbench-lang",l);}catch(e){}
try{var u=new URL(location.href);if(u.searchParams.has("lang")){u.searchParams.set("lang",l);history.replaceState(null,"",u);}}catch(e){}
apply();document.dispatchEvent(new CustomEvent("wb-lang",{detail:l}));});});
apply();})();</script>`;

// <title> with both languages; LANG_SCRIPT swaps document.title.
export const titleTag = (v) => (isT(v)
  ? `<title data-en="${escAttr(v.en)}" data-es="${escAttr(v.es)}">${escHtml(v.en)}</title>`
  : `<title>${escHtml(v)}</title>`);
