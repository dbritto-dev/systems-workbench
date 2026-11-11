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
/* Element defaults (bare tag selectors) sit in the workbench-base layer: above astryx-astro's reset, below its components (styles/layers.css), so an Astryx <button>, heading or paragraph keeps its own look. */
@layer workbench-base{
*{box-sizing:border-box}
h1{font-size:30px;line-height:1.2;font-weight:600;color:var(--anatomy-strong);margin:10px 0 12px;letter-spacing:-.01em}
h2{font-size:21px;font-weight:600;color:var(--anatomy-strong);margin:0 0 8px;letter-spacing:-.005em}
h3{font-size:16px;font-weight:600;color:var(--anatomy-strong);margin:0}
p{margin:0 0 12px}
strong{color:var(--anatomy-strong);font-weight:600}
code{font-family:var(--anatomy-mono);font-size:.88em;color:var(--anatomy-strong)}
section{margin-top:72px}
button{font:inherit;color:inherit}
footer{margin-top:72px;padding-top:16px;border-top:1px solid var(--anatomy-faint);font-size:12.5px;color:var(--anatomy-muted)}
footer a{color:inherit}
}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:15px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.page{width:min(780px,100% - 32px);margin:56px auto 96px;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
.mono{font-family:var(--anatomy-mono)}
.eyebrow{font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--anatomy-muted)}
.lede{font-size:17px;max-width:62ch}
.parts{display:flex;flex-wrap:wrap;gap:6px 18px;margin:18px 0 0;padding:0;list-style:none;font-family:var(--anatomy-mono);font-size:12px;color:var(--anatomy-muted)}
.parts a{color:inherit;text-decoration:none;border-bottom:1px solid var(--anatomy-faint)}
.parts a:hover{color:var(--anatomy-strong)}
.section-head{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;align-items:baseline;margin-bottom:18px}
.section-head .eyebrow{grid-row:span 2;padding-top:5px}
.section-head p{grid-column:2;margin:0;max-width:60ch}
/* The panel (components/lesson/Panel.astro): an Astryx Card (padding 0) holding the stats strip and the control rows. The controls are astryx-astro's, drawn in our look by styles/astryx-workbench.css; what is here is their place in the panel. */
.panel{margin-top:14px}
.stats{display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid var(--anatomy-faint)}
.stat{padding:10px 12px;border-right:1px solid var(--anatomy-faint)}
.stat:last-child{border-right:0}
.stat b{display:block;font:500 18px/1.2 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.stat span{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-muted)}
.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px 18px;padding:14px 12px;align-items:start}
.control{display:grid;gap:6px;align-content:start}
.control>span,.control .astryx-field-label{font-family:var(--anatomy-mono);font-size:10.5px;line-height:1.65;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted)}
.actions{--ux-hit-gap-block:4px;--ux-hit-gap-inline:4px}
/* A text box (TextInput): the row's label is the field's; at most 280px wide. Our ring: on the box, around the field, as for any wrapper of an input (src/lessons/README.md, "UX foundation"). */
.control .text-in{gap:6px;max-width:280px}
.text-in .ax-input-native:focus-visible{outline-style:none}
.text-in .ax-input:has(>.ax-input-native:focus-visible){outline-width:var(--ux-focus-width);outline-style:var(--ux-focus-style);outline-color:var(--ux-focus-color);outline-offset:var(--ux-focus-offset)}
/* A busy button (elements/wb-button.ts setBusy) refuses through aria-disabled but is not dimmed: Astryx dims only data-ax-disabled. */
.astryx-button[aria-busy="true"]{opacity:1}
.note{font-size:13px;color:var(--anatomy-muted);margin-top:10px}
/* An experiment card (components/lesson/Experiment.astro): an Astryx Card inside <wb-experiment>. */
wb-experiment{display:block;margin-top:14px}
/* Card padding includes its 1px border (Astryx), so these are our padding + 1. */
.exp-card{--astryx-card-padding-inline:19px;--astryx-card-padding-block-start:19px;--astryx-card-padding-block-end:17px}
.exp-head{align-items:baseline}
.exp-change{font-family:var(--anatomy-mono);font-size:12px;color:var(--anatomy-muted);margin:4px 0 12px}
.exp-q{color:var(--anatomy-strong);margin-bottom:10px}
/* Predictions: SelectableCards (radio) with a letter and the text; selected is the theme's ink ring. */
.choices{margin-bottom:12px}
.choice{display:flex;gap:10px;align-items:flex-start;--astryx-card-padding-inline:13px;--astryx-card-padding-block-start:10px;--astryx-card-padding-block-end:10px;color:var(--anatomy-text);font-size:14px;line-height:1.45}
.choice .mark{font-family:var(--anatomy-mono);font-size:11px;color:var(--anatomy-muted);padding-top:2px;flex:none}
.choice .text{flex:1;min-width:0}
@media (hover:hover){.choices:where(:not([aria-readonly="true"])) .choice:hover{color:var(--anatomy-strong)}}
.choice:has(>input:checked){color:var(--anatomy-strong)}
/* Without JavaScript Astryx can't forward a click on the card to its radio, so the (invisible) radio covers the card. The card's inline script marks the group data-shuffled, which only happens with JavaScript. */
.choices:not([data-shuffled]) .ax-selectable-card-input{inset:0;width:100%;height:100%;margin:0;clip:auto;opacity:0;cursor:pointer}
/* After a run the cards are locked: no hover or press paint. The verdict ring replaces the selection ring. */
.choices[aria-readonly="true"] .choice{cursor:default;--_press-overlay:transparent}
.choices[aria-readonly="true"] .choice:not([data-verdict]){border-color:var(--anatomy-lo)}
.choices .choice[data-verdict="right"]{border-color:var(--anatomy-green);--_card-ring:inset 0 0 0 1px var(--anatomy-green)}
.choices .choice[data-verdict="wrong"]{border-color:var(--anatomy-red);--_card-ring:inset 0 0 0 1px var(--anatomy-red)}
.choice .tag{flex:none;margin-inline-start:auto;padding-top:2px;font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-strong)}
.result{display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--anatomy-faint)}
wb-experiment[data-done] .result{display:block}
.verdict{font-weight:600;color:var(--anatomy-strong);margin-bottom:10px}
/* Result bars: Astryx ProgressBars laid out on one row (label, track, value); they grow from empty when the result appears (@starting-style; at once under reduced motion). */
.bars{display:grid;gap:8px;margin:4px 0 14px}
.bars .bar{display:grid;grid-template-columns:150px 1fr 64px;gap:10px;align-items:center}
.bars .bar .ax-progress-bar-header{display:contents}
.bars .bar .ax-progress-bar-label{grid-column:1;grid-row:1}
.bars .bar .ax-progress-bar-track-box{grid-column:2;grid-row:1}
.bars .bar .ax-progress-bar-value{grid-column:3;grid-row:1;text-align:right}
@starting-style{.bars .astryx-progress-bar-fill:not([data-ax-indeterminate]){transform:translateX(-100%)}}
.bar-group{font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);margin-top:6px}
.bar-group:first-child{margin-top:0}
/* Explain-back questions (components/lesson/Questions.astro): Astryx Collapsibles drawn as our cards; the trigger row holds the number and the question. */
.question{border:1px solid var(--anatomy-faint);background:var(--anatomy-card);margin-top:10px}
.question>.astryx-collapsible-trigger{padding:14px 16px;gap:12px}
.question>.astryx-collapsible-trigger[data-open]{border-bottom:1px solid var(--anatomy-faint)}
.question .ax-collapsible-label{display:flex;gap:12px;text-box:normal}
.question .n,details .n{font-family:var(--anatomy-mono);font-size:11px;color:var(--anatomy-muted);padding-top:3px;flex:none}
.question .q,details .q{flex:1;min-width:0}
.question>.astryx-collapsible-content{padding:0}
/* The chevron takes the room the CSS chevron of the <details> took, so a question wraps where it did. */
.question .ax-collapsible-chevron{width:11px;height:11px;font-size:11px}
.answer{padding:12px 16px 14px 44px;font-size:14px}
.answer .eyebrow{display:block;margin-bottom:4px}
/* Without JavaScript the questions are the <noscript> copy: native details in the same look. */
@media (scripting:none){.questions{display:none}}
details{border:1px solid var(--anatomy-faint);background:var(--anatomy-card);margin-top:10px}
summary{cursor:pointer;padding:14px 16px;color:var(--anatomy-strong);list-style:none;display:flex;gap:12px}
summary::-webkit-details-marker{display:none}
summary::after{content:"";box-sizing:content-box;flex:none;align-self:center;width:6px;height:6px;margin:0 2px 3px;border:solid var(--anatomy-muted);border-width:0 1.5px 1.5px 0;rotate:45deg}
details[open]>summary::after{rotate:225deg;margin-block:3px 0}
details[open] summary{border-bottom:1px solid var(--anatomy-faint)}
@media (forced-colors:active){.choice:has(>input:checked){border-color:Highlight;outline:2px solid Highlight;outline-offset:-3px}}
@media (max-width:640px){
  h1{font-size:25px}
  .stats{grid-template-columns:repeat(3,1fr)}
  .stat:nth-child(3){border-right:0}
  .stat:nth-child(-n+3){border-bottom:1px solid var(--anatomy-faint)}
  .bars .bar{grid-template-columns:96px 1fr 52px}
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
