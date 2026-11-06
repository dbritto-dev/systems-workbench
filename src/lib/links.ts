// Links inside HTML strings (footers, credits).

/** Marks every link that opens a new tab (target="_blank") the way Astryx's Link does: rel="noopener noreferrer",
 *  a small decorative ↗ after the text, and visually hidden text that says so ("(opens in a new tab)"). The classes
 *  ext-icon and chrome-vh are styled in styles/chrome.css. */
export function markNewTabLinks(html: string, newTab: string): string {
  return html.replace(/<a\b([^>]*\btarget="_blank"[^>]*)>([\s\S]*?)<\/a>/g, (_, attrs: string, inner: string) => {
    const rest = attrs.replace(/\s+rel="[^"]*"/, "");
    return `<a${rest} rel="noopener noreferrer">${inner}<span class="ext-icon" aria-hidden="true">↗</span><span class="chrome-vh"> ${newTab}</span></a>`;
  });
}
