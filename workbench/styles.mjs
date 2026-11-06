// The lesson page stylesheet: the kit's palette as light/dark themes, the page layout, the shared parts, the lit
// accent and the language rule. src/styles/workbench-css.mjs serves it to the site as virtual:workbench.css.
import * as k from "./kit.mjs";
import { PARTS_CSS, LIT_FILL_PAGE_CSS } from "./parts.mjs";
import { LANG_CSS } from "./i18n.mjs";

const light = k.ISO_CSS.match(/\.iso\[data-theme="light"\]\{([^}]*)\}/)[1];
const dark = k.ISO_CSS.match(/\.iso\{([^}]*)\}/)[1];

// Light by default; dark from the device, or forced either way by the theme switch (data-theme on <html>).
export const THEME_CSS = `
:root{color-scheme:light;}
.iso{${light}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark}:root:not([data-theme="light"]) .iso{${dark}}}
:root[data-theme="dark"]{color-scheme:dark}
:root[data-theme="dark"] .iso{${dark}}
`;

export const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:15px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.page{width:min(780px,100% - 32px);margin:56px auto 96px;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
.mono{font-family:var(--anatomy-mono)}
.eyebrow{font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--anatomy-muted)}
h1{font-size:30px;line-height:1.2;font-weight:600;color:var(--anatomy-strong);margin:10px 0 12px;letter-spacing:-.01em}
h2{font-size:21px;font-weight:600;color:var(--anatomy-strong);margin:0 0 8px;letter-spacing:-.005em}
h3{font-size:16px;font-weight:600;color:var(--anatomy-strong);margin:0}
p{margin:0 0 12px}
strong{color:var(--anatomy-strong);font-weight:600}
code{font-family:var(--anatomy-mono);font-size:.88em;color:var(--anatomy-strong)}
.lede{font-size:17px;max-width:62ch}
.parts{display:flex;flex-wrap:wrap;gap:6px 18px;margin:18px 0 0;padding:0;list-style:none;font-family:var(--anatomy-mono);font-size:12px;color:var(--anatomy-muted)}
.parts a{color:inherit;text-decoration:none;border-bottom:1px solid var(--anatomy-faint)}
.parts a:hover{color:var(--anatomy-strong)}
section{margin-top:72px}
.section-head{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;align-items:baseline;margin-bottom:18px}
.section-head .eyebrow{grid-row:span 2;padding-top:5px}
.section-head p{grid-column:2;margin:0;max-width:60ch}
.panel{margin-top:14px;border:1px solid var(--anatomy-faint);background:var(--anatomy-card)}
.stats{display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid var(--anatomy-faint)}
.stat{padding:10px 12px;border-right:1px solid var(--anatomy-faint)}
.stat:last-child{border-right:0}
.stat b{display:block;font:500 18px/1.2 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.stat span{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-muted)}
.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px 18px;padding:14px 12px;align-items:start}
.control{display:grid;gap:6px;align-content:start}
.control>span,.control>label{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted)}
.wb-vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;pointer-events:none;user-select:none}
.seg{display:flex;flex-wrap:wrap;gap:0;align-items:flex-start}
button{font:inherit;color:inherit}
/* Controls behave like Astryx's (src/lessons/README.md, "UX foundation"; elements/wb-controls.ts, wb-button.ts). Press feedback: an overlay under the label, at once on pointerdown (data-pressed), fading on release; never on a disabled control, nor on a selected segment. */
wb-seg>button,.btn,.choice{position:relative;isolation:isolate}
wb-seg>button::before,.btn::before,.choice::before{content:"";position:absolute;inset:0;z-index:-1;background:currentColor;opacity:0;pointer-events:none;transition:opacity var(--ux-duration-exit) var(--ux-ease-exit)}
wb-seg>button[data-pressed]:not([aria-checked="true"],[aria-pressed="true"])::before,.btn[data-pressed]::before,.choice[data-pressed]::before{opacity:.1;transition:none}
/* A segmented control (one of N, radiogroup) or a toggle group (multiple): joined mono segments, the selected one ink-filled. */
wb-seg{position:relative;isolation:isolate}
wb-seg>button{appearance:none;border:1px solid var(--anatomy-lo);background:transparent;color:var(--anatomy-text);font-family:var(--anatomy-mono);font-size:12px;padding:6px 10px;cursor:pointer;line-height:1.2;min-height:32px;transition:color var(--ux-duration-fast) var(--ux-ease-standard),border-color var(--ux-duration-fast) var(--ux-ease-standard)}
wb-seg[multiple]>button{transition-property:color,border-color,background-color}
wb-seg>button+button{margin-inline-start:-1px}
wb-seg>button:is([aria-checked="true"],[aria-pressed="true"]){background:var(--anatomy-strong);border-color:var(--anatomy-strong);color:var(--anatomy-card);z-index:1}
@media (hover:hover){wb-seg:where(:not([aria-disabled="true"]))>button:where(:not([aria-disabled="true"],[aria-checked="true"],[aria-pressed="true"])):hover{border-color:var(--anatomy-hi);color:var(--anatomy-strong);z-index:2}}
/* The selected surface slides (transform only) from the old option to the new one; the rest of the time the selected option paints its own fill. */
wb-seg::before{content:"";position:absolute;z-index:0;left:var(--wb-sx,0);top:var(--wb-sy,0);width:var(--wb-sw,0);height:var(--wb-sh,0);background:var(--anatomy-strong);transform-origin:0 0;transform:var(--wb-st,none);opacity:0;pointer-events:none}
wb-seg[data-slide]::before{opacity:1}
wb-seg[data-slide="to"]::before{transition:transform var(--ux-duration-fast) var(--ux-ease-standard)}
wb-seg[data-slide]>button[aria-checked="true"]{background:transparent;border-color:var(--anatomy-lo)}
/* Focus in a joined row: the ring sits on a plate-coloured gap, so its side next to an ink-filled neighbour still shows. */
:root:not([data-ux-modality="pointer"]) wb-seg>button:focus-visible{z-index:3;box-shadow:0 0 0 calc(var(--ux-focus-offset) + var(--ux-focus-width)) var(--anatomy-card)}
/* Buttons: hover on hover-capable pointers, the press overlay and a 0.98 scale while pressed (none under reduced motion), disabled at half opacity (ux.css), busy at full opacity with a delayed spinner over the hidden label. */
.btn{appearance:none;border:1px solid var(--anatomy-lo);background:transparent;color:var(--anatomy-text);font-family:var(--anatomy-mono);font-size:12px;padding:6px 10px;cursor:pointer;line-height:1.2;min-height:32px;transition:color var(--ux-duration-fast) var(--ux-ease-standard),border-color var(--ux-duration-fast) var(--ux-ease-standard),background-color var(--ux-duration-fast) var(--ux-ease-standard),transform var(--ux-duration-fast) var(--ux-ease-standard)}
@media (hover:hover){.btn:where(:not([aria-disabled="true"])):hover{border-color:var(--anatomy-hi);color:var(--anatomy-strong)}}
.btn.primary,.btn[aria-pressed="true"]{background:var(--anatomy-strong);border-color:var(--anatomy-strong);color:var(--anatomy-card)}
.btn[data-pressed]{transform:scale(.98)}
.btn[aria-busy="true"][data-busy-refuses]{opacity:1;cursor:progress}
.btn[data-busy]{color:transparent}
.wb-spin{position:absolute;inset:0;margin:auto;width:12px;height:12px;border:1.5px solid var(--anatomy-text);border-inline-end-color:transparent;border-radius:50%;animation:wb-spin-in var(--ux-duration-fast) var(--ux-ease-standard) both,wb-spin .8s linear infinite}
.btn.primary .wb-spin{border-color:var(--anatomy-card);border-inline-end-color:transparent}
@keyframes wb-spin{to{rotate:1turn}}
@keyframes wb-spin-in{from{opacity:0}}
.actions{display:flex;flex-wrap:wrap;gap:8px;--ux-hit-gap-block:4px;--ux-hit-gap-inline:4px}
.text-in{font:inherit;font-size:13px;padding:6px 8px;min-height:32px;min-width:0;width:100%;max-width:280px;background:transparent;color:inherit;border:1px solid var(--anatomy-lo);border-radius:0}
@media (hover:hover){.text-in:where(:not([aria-disabled="true"])):hover{border-color:var(--anatomy-hi)}}
@media (pointer:coarse){.text-in{font-size:16px}}
/* A disabled control's reason (elements/wb-button.ts): in the top layer, above the control. */
.wb-tip{position:fixed;inset:auto;margin:0;max-width:300px;padding:4px 8px;border:1px solid var(--anatomy-lo);background:var(--anatomy-card);color:var(--anatomy-strong);font:500 12px/1.4 var(--anatomy-mono);letter-spacing:.02em;opacity:0;transition:opacity 150ms,display 150ms allow-discrete,overlay 150ms allow-discrete}
.wb-tip:popover-open{opacity:1}
@starting-style{.wb-tip:popover-open{opacity:0}}
.note{font-size:13px;color:var(--anatomy-muted);margin-top:10px}
.exp{border:1px solid var(--anatomy-faint);background:var(--anatomy-card);padding:18px 18px 16px;margin-top:14px}
.exp-head{display:flex;gap:12px;align-items:baseline;justify-content:space-between;flex-wrap:wrap}
.exp-change{font-family:var(--anatomy-mono);font-size:12px;color:var(--anatomy-muted);margin:4px 0 12px}
.exp-q{color:var(--anatomy-strong);margin-bottom:10px}
/* Predictions: selectable cards, each a label around a visually hidden radio; selected is a 2 px ink ring drawn inside (border + inset shadow), so nothing moves. One focus ring, on the card. */
.choices{display:grid;gap:6px;margin-bottom:12px}
.choice{display:flex;gap:10px;align-items:flex-start;text-align:left;border:1px solid var(--anatomy-lo);background:transparent;padding:9px 12px;cursor:pointer;color:var(--anatomy-text);font-size:14px;line-height:1.45;transition:color var(--ux-duration-fast) var(--ux-ease-standard),border-color var(--ux-duration-fast) var(--ux-ease-standard),box-shadow var(--ux-duration-fast) var(--ux-ease-standard)}
.choice>input{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;appearance:none;outline-style:none}
@media (hover:hover){.choices:where(:not([aria-readonly="true"])) .choice:hover{border-color:var(--anatomy-hi);color:var(--anatomy-strong)}}
.choice .mark{font-family:var(--anatomy-mono);font-size:11px;color:var(--anatomy-muted);padding-top:2px;flex:none}
.choice .text{flex:1;min-width:0}
.choice:has(>input:checked){border-color:var(--anatomy-strong);color:var(--anatomy-strong);box-shadow:inset 0 0 0 1px var(--anatomy-strong)}
:root:not([data-ux-modality="pointer"]) .choice:has(>input:focus-visible){outline-width:var(--ux-focus-width);outline-style:var(--ux-focus-style);outline-color:var(--ux-focus-color);outline-offset:var(--ux-focus-offset)}
.choices[aria-readonly="true"] .choice{cursor:default}
.choices[aria-readonly="true"] .choice::before{display:none}
.choice[data-verdict="right"]{border-color:var(--anatomy-green);box-shadow:inset 0 0 0 1px var(--anatomy-green)}
.choice[data-verdict="wrong"]{border-color:var(--anatomy-red);box-shadow:inset 0 0 0 1px var(--anatomy-red)}
.choice .tag{flex:none;margin-inline-start:auto;padding-top:2px;font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-strong)}
.result{display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--anatomy-faint)}
.exp[data-done] .result{display:block}
.verdict{font-weight:600;color:var(--anatomy-strong);margin-bottom:10px}
/* Result bars: role="meter"; the fill is full width, moved by transform, so a new value animates on the compositor (and lands at once under reduced motion). */
.bars{display:grid;gap:8px;margin:4px 0 14px}
.bar{display:grid;grid-template-columns:150px 1fr 64px;gap:10px;align-items:center;font-family:var(--anatomy-mono);font-size:12px}
.bar .track{height:12px;border:1px solid var(--anatomy-lo);position:relative;overflow:hidden}
.bar .fill{position:absolute;inset:0;background:var(--anatomy-mid);transform:translateX(calc(var(--fill,0%) - 100%));transition:transform var(--ux-duration-medium) var(--ux-ease-standard)}
.bar .track:dir(rtl) .fill{transform:translateX(calc(100% - var(--fill,0%)))}
.bar[data-after] .fill{background:var(--anatomy-strong)}
.bar b{font-weight:500;color:var(--anatomy-strong);text-align:right;font-variant-numeric:tabular-nums}
details{border:1px solid var(--anatomy-faint);background:var(--anatomy-card);margin-top:10px}
summary{cursor:pointer;padding:14px 16px;color:var(--anatomy-strong);list-style:none;display:flex;gap:12px}
summary::-webkit-details-marker{display:none}
summary .n{font-family:var(--anatomy-mono);font-size:11px;color:var(--anatomy-muted);padding-top:3px;flex:none}
details[open] summary{border-bottom:1px solid var(--anatomy-faint)}
.answer{padding:12px 16px 14px 44px;font-size:14px}
.answer .eyebrow{display:block;margin-bottom:4px}
@media (forced-colors:active){wb-seg>button:is([aria-checked="true"],[aria-pressed="true"]),.btn[aria-pressed="true"]{forced-color-adjust:none;background:Highlight;border-color:Highlight;color:HighlightText}wb-seg::before{background:Highlight}.choice:has(>input:checked){border-color:Highlight;outline:2px solid Highlight;outline-offset:-3px}}
@media (prefers-reduced-motion:reduce){.btn[data-pressed]{transform:none}}
footer{margin-top:72px;padding-top:16px;border-top:1px solid var(--anatomy-faint);font-size:12.5px;color:var(--anatomy-muted)}
footer a{color:inherit}
.theme-switch{display:flex;justify-content:flex-end;margin:-36px 0 18px}
.theme-switch .seg{display:flex}
.theme-switch .lang-seg{margin-right:10px}
.theme-switch button{appearance:none;border:1px solid var(--anatomy-lo);background:transparent;color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.06em;padding:5px 10px;min-height:28px;cursor:pointer;line-height:1.2}
.theme-switch button+button{margin-left:-1px}
.theme-switch button:hover{color:var(--anatomy-strong);border-color:var(--anatomy-hi);position:relative;z-index:2}
.theme-switch button[aria-pressed="true"]{background:var(--anatomy-strong);border-color:var(--anatomy-strong);color:var(--anatomy-card);position:relative;z-index:1}
@media (max-width:640px){
  h1{font-size:25px}
  .stats{grid-template-columns:repeat(3,1fr)}
  .stat:nth-child(3){border-right:0}
  .stat:nth-child(-n+3){border-bottom:1px solid var(--anatomy-faint)}
  .bar{grid-template-columns:96px 1fr 52px}
  .section-head{grid-template-columns:1fr}
  .section-head .eyebrow{grid-row:auto;padding:0}
  .section-head p{grid-column:1}
  .answer{padding-left:16px}
}
`;


/** Everything a lesson page needs, in order. */
export const LESSON_CSS = () => `${k.ISO_CSS}${THEME_CSS}${PAGE_CSS}${PARTS_CSS}${LIT_FILL_PAGE_CSS}${LANG_CSS}`;

/** The kit's light and dark palettes on :root, for pages outside the lesson template (the collection). */
export const TOKENS_CSS = () => `:root{${light};color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark};color-scheme:dark}}
:root[data-theme="dark"]{${dark};color-scheme:dark}
`;
