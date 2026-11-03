// <power-search>: a structured filter bar. Each filter is a token (field + operator + value); a typeahead suggests
// fields, field+operator pairs, finished filters ("area data" → Area is Data) and a free-text search; a token opens
// an editor (operator, value, Apply / Cancel / Remove). Markup from components/PowerSearch.astro; this element knows
// nothing about lessons. Modelled on Astryx's PowerSearch (MIT), reimplemented as a light-DOM custom element.
//
//   el.filters                  the filters (get, or set to replace them without an event)
//   el.resultCount = "12 …"     text shown at the end of the bar and announced politely
//   el.focusInput()
//   "ps-change"  { filters, changeType: "add" | "edit" | "remove" | "clear", index }
//   "ps-input"   { text, free }  the text being typed, debounced (150 ms, at least every 500 ms; at once when emptied);
//                               free: it reads as free text (the top suggestion is "Search for …"), not a filter
//                               being built ("area dat"), so a page can preview it as a search
//   "ps-submit"  {}             Enter in an empty box with no menu open (e.g. go to the first result)
import { debounce } from "../lib/timing";

// ---------- configuration ----------
export interface EnumItem { value: string; label: string }
export type OperatorValue =
  | { type: "empty" }
  | { type: "string" }
  | { type: "enum"; values: EnumItem[] }
  | { type: "enum_list"; values: EnumItem[] }
  | { type: "integer"; min?: number; max?: number };
export interface Operator { key: string; label: string; value: OperatorValue }
export interface Field {
  key: string;
  label: string;
  operators: Operator[];
  defaultOperator?: string;
  /** Heading the field is listed under when browsing. */
  group?: string;
  description?: string;
  /** Other words that find this field ("tag" for Area). */
  aliases?: string[];
  /** Suggest finished filters when the text after the field's name matches a value. Default true. */
  valueMatch?: boolean;
}
export interface Config {
  fields: Field[];
  /** The field free text goes to ("Search for “…”"), if any. */
  contentField?: string;
  maxResults?: number;
  maxTokenLength?: number;
}
export type FilterValue =
  | { type: "empty" }
  | { type: "string"; value: string }
  | { type: "enum"; value: string }
  | { type: "enum_list"; value: string[] }
  | { type: "integer"; value: number };
export interface Filter { field: string; operator: string; value: FilterValue }
export type ChangeType = "add" | "edit" | "remove" | "clear";
export interface ChangeDetail { filters: Filter[]; changeType: ChangeType; index: number }

/** Interface words, in the page's language. {x} placeholders are filled in. */
export interface Strings {
  searchFor: string;      // 'Search for “{q}”'
  filterBy: string;       // "Filter by"
  suggestions: string;    // "Suggestions"
  noMatch: string;        // "No filter matches “{q}”"
  editFilter: string;     // "Edit filter: {t}"
  removeFilter: string;   // "Remove filter: {t}"
  clearAll: string;
  apply: string;
  cancel: string;
  remove: string;
  operator: string;
  value: string;
  or: string;             // joins enum_list values in a token: "Data or Search"
  typeValue: string;      // placeholder of a text value
  between: string;        // "{min}–{max}"
}

// ---------- helpers ----------
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...kids: (Node | string)[]) => {
  const { class: cls, ...rest } = props as { class?: string };
  const node = Object.assign(document.createElement(tag), rest);
  if (cls) node.className = cls;
  node.append(...kids);
  return node;
};
let ids = 0;

interface Suggestion { kind: "content" | "field" | "op" | "value"; label: string; field: Field; op: Operator; value?: FilterValue; group: string }

export class PowerSearch extends HTMLElement {
  #config: Config = { fields: [] };
  #strings!: Strings;
  #filters: Filter[] = [];
  #items: Suggestion[] = [];
  #active = -1;
  #editing: { index: number | null; draft: Filter } | null = null;
  #id = ++ids;
  #emitInput = debounce((text: string) => this.#fire("ps-input", { text, free: this.#isFree(text) }), 150, { maxWait: 500 });

  get input() { return this.querySelector<HTMLInputElement>(".ps-input")!; }
  get #list() { return this.querySelector<HTMLElement>(".ps-tokens")!; }
  get #menu() { return this.querySelector<HTMLElement>(".ps-menu")!; }
  get #editor() { return this.querySelector<HTMLElement>(".ps-editor")!; }
  get #clear() { return this.querySelector<HTMLButtonElement>(".ps-clear")!; }
  get #count() { return this.querySelector<HTMLElement>(".ps-count")!; }

  get filters(): Filter[] { return this.#filters.map((f) => structuredClone(f)); }
  set filters(next: Filter[]) { this.#filters = next.filter((f) => this.#valid(f)).map((f) => structuredClone(f)); this.#renderTokens(); }
  set resultCount(text: string) { if (this.#count.textContent !== text) this.#count.textContent = text; }
  focusInput() { this.input.focus(); }

  connectedCallback() {
    if (this.dataset.ready !== undefined) return;
    this.dataset.ready = "";
    const data = JSON.parse(this.querySelector("script[data-ps]")?.textContent || "{}");
    this.#config = data.config ?? { fields: [] };
    this.#strings = data.strings;
    this.#filters = (data.filters ?? []).filter((f: Filter) => this.#valid(f));
    const input = this.input;
    input.id ||= `ps-input-${this.#id}`;
    this.#menu.id ||= `ps-menu-${this.#id}`;
    input.setAttribute("aria-controls", this.#menu.id);

    input.addEventListener("focus", () => this.#openMenu());
    input.addEventListener("click", () => this.#openMenu());
    input.addEventListener("input", (e) => {
      this.#active = -1;
      this.#openMenu();
      if ((e as InputEvent).isComposing) return;
      if (!input.value.trim()) { this.#emitInput.cancel(); this.#fire("ps-input", { text: "", free: false }); } else this.#emitInput(input.value);
    });
    input.addEventListener("compositionend", () => this.#emitInput(input.value));
    input.addEventListener("keydown", (e) => this.#inputKey(e));
    this.#menu.addEventListener("mousedown", (e) => e.preventDefault());   // keep focus in the box
    this.#menu.addEventListener("click", (e) => {
      const opt = (e.target as Element).closest<HTMLElement>("[data-i]");
      if (opt) this.#choose(this.#items[Number(opt.dataset.i)]);
    });
    this.#list.addEventListener("click", (e) => {
      const t = e.target as Element;
      const li = t.closest<HTMLElement>(".ps-token");
      if (!li) return;
      const i = Number(li.dataset.i);
      if (t.closest(".ps-token-remove")) this.#remove(i, true);
      else if (t.closest(".ps-token-edit")) this.#openEditor(i);
    });
    this.#list.addEventListener("keydown", (e) => this.#tokenKey(e));
    this.#clear.addEventListener("click", () => {
      this.#filters = [];
      this.#renderTokens();
      this.#fire("ps-change", { filters: this.filters, changeType: "clear", index: -1 } satisfies ChangeDetail);
      input.value = "";
      this.#fire("ps-input", { text: "", free: false });
      input.focus();
    });
    this.addEventListener("focusout", (e) => {
      const to = e.relatedTarget as Node | null;
      if (to && this.contains(to)) return;
      this.#closeMenu();
      if (this.#editing) this.#closeEditor(false);
    });
    this.querySelector(".ps-bar")!.addEventListener("click", (e) => { const t = e.target as Element; if (t.matches(".ps-bar, .ps-field, .ps-end, .ps-count")) input.focus(); });
    this.#renderTokens();
  }

  // ---------- events ----------
  #fire(type: string, detail: unknown) { this.dispatchEvent(new CustomEvent(type, { bubbles: true, detail })); }
  #isFree(text: string) { return !!text.trim() && this.#suggest(text)[0]?.kind === "content"; }

  // ---------- lookups ----------
  #field(key: string) { return this.#config.fields.find((f) => f.key === key); }
  #op(field: Field, key?: string) { return field.operators.find((o) => o.key === key) ?? field.operators.find((o) => o.key === field.defaultOperator) ?? field.operators[0]; }
  #valid(f: Filter) {
    const field = this.#field(f.field);
    const op = field && field.operators.find((o) => o.key === f.operator);
    return !!op && op.value.type === f.value.type && this.#complete(f.value, op);
  }
  #complete(v: FilterValue, op: Operator) {
    switch (v.type) {
      case "empty": return true;
      case "string": return v.value.trim() !== "";
      case "enum": return op.value.type === "enum" && op.value.values.some((x) => x.value === v.value);
      case "enum_list": return v.value.length > 0;
      case "integer": {
        const o = op.value as Extract<OperatorValue, { type: "integer" }>;
        return Number.isInteger(v.value) && (o.min === undefined || v.value >= o.min) && (o.max === undefined || v.value <= o.max);
      }
    }
  }
  #emptyValue(op: Operator): FilterValue {
    switch (op.value.type) {
      case "empty": return { type: "empty" };
      case "string": return { type: "string", value: "" };
      case "enum": return { type: "enum", value: "" };
      case "enum_list": return { type: "enum_list", value: [] };
      case "integer": return { type: "integer", value: NaN };
    }
  }

  // ---------- text of a filter ----------
  #valueText(v: FilterValue, op: Operator) {
    const max = this.#config.maxTokenLength ?? 40;
    const cut = (s: string) => ([...s].length > max + 3 ? [...s].slice(0, max).join("") + "…" : s);
    const label = (x: string) => (op.value.type === "enum" || op.value.type === "enum_list" ? op.value.values.find((i) => i.value === x)?.label ?? x : x);
    switch (v.type) {
      case "empty": return "";
      case "string": return `“${cut(v.value)}”`;
      case "enum": return label(v.value);
      case "enum_list": return cut(v.value.map(label).join(` ${this.#strings.or} `));
      case "integer": return String(v.value);
    }
  }
  #filterText(f: Filter) {
    const field = this.#field(f.field)!, op = this.#op(field, f.operator);
    return [field.label, op.label, this.#valueText(f.value, op)].filter(Boolean).join(" ");
  }

  // ---------- tokens ----------
  #renderTokens() {
    const s = this.#strings;
    this.#list.replaceChildren(...this.#filters.map((f, i) => {
      const field = this.#field(f.field)!, op = this.#op(field, f.operator), text = this.#filterText(f);
      const edit = el("button", { type: "button", class: "ps-token-edit", title: text },
        el("span", { class: "ps-token-field" }, field.label), " ",
        el("span", { class: "ps-token-op" }, op.label),
        ...(f.value.type === "empty" ? [] : [" ", el("span", { class: "ps-token-value" }, this.#valueText(f.value, op))]));
      edit.setAttribute("aria-label", fill(s.editFilter, { t: text }));
      const rm = el("button", { type: "button", class: "ps-token-remove" }, "×");
      rm.setAttribute("aria-label", fill(s.removeFilter, { t: text }));
      const li = el("li", { class: "ps-token" }, edit, rm);
      li.dataset.i = String(i);
      return li;
    }));
    this.#clear.hidden = this.#filters.length === 0;
    this.toggleAttribute("data-has-filters", this.#filters.length > 0);
  }
  #tokenButtons() { return [...this.#list.querySelectorAll<HTMLButtonElement>(".ps-token-edit")]; }
  #tokenKey(e: KeyboardEvent) {
    const btn = (e.target as Element).closest<HTMLButtonElement>(".ps-token-edit, .ps-token-remove");
    if (!btn) return;
    const i = Number(btn.closest<HTMLElement>(".ps-token")!.dataset.i);
    const tokens = this.#tokenButtons();
    if (e.key === "ArrowLeft") { e.preventDefault(); tokens[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); (tokens[i + 1] ?? this.input).focus(); }
    else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); this.#remove(i, true, e.key === "Backspace" ? i - 1 : i); }
  }
  #remove(i: number, refocus: boolean, focusAt = i) {
    this.#filters.splice(i, 1);
    this.#renderTokens();
    this.#fire("ps-change", { filters: this.filters, changeType: "remove", index: i } satisfies ChangeDetail);
    // Focus goes to the token asked for (the one before, after Backspace), else a neighbour, else the box.
    if (refocus) { const t = this.#tokenButtons(); (t[focusAt] ?? t[i] ?? t[i - 1] ?? this.input).focus(); }
  }
  #commit(f: Filter, index: number | null) {
    if (index === null) {
      this.#filters.push(f);
      this.#renderTokens();
      this.#fire("ps-change", { filters: this.filters, changeType: "add", index: this.#filters.length - 1 } satisfies ChangeDetail);
    } else {
      this.#filters[index] = f;
      this.#renderTokens();
      this.#fire("ps-change", { filters: this.filters, changeType: "edit", index } satisfies ChangeDetail);
    }
  }

  // ---------- the typeahead ----------
  #suggest(query: string): Suggestion[] {
    const s = this.#strings, q = fold(query.trim());
    const fields = this.#config.fields;
    const browse = s.filterBy, sug = s.suggestions;
    if (!q) return fields.map((field) => ({ kind: "field" as const, label: field.label, field, op: this.#op(field), group: field.group ?? browse }));
    const out: Suggestion[] = [];
    const seen = new Set<string>();
    const push = (x: Suggestion, id: string) => { if (!seen.has(id)) { seen.add(id); out.push(x); } };
    const valueMatches = (op: Operator, raw: string): FilterValue[] => {
      const r = raw.trim();
      if (!r) return [];
      switch (op.value.type) {
        case "string": return [{ type: "string", value: r }];
        case "enum": return op.value.values.filter((v) => fold(v.label).includes(fold(r))).map((v) => ({ type: "enum", value: v.value }));
        case "enum_list": return op.value.values.filter((v) => fold(v.label).includes(fold(r))).map((v) => ({ type: "enum_list", value: [v.value] }));
        case "integer": { const n = Number(r); return Number.isInteger(n) && this.#complete({ type: "integer", value: n }, op) ? [{ type: "integer", value: n }] : []; }
        default: return [];
      }
    };
    // Finished filters: "<field> <operator> <value>", or "<field> <value>" for every operator.
    for (const field of fields) {
      if (field.valueMatch === false) continue;
      const fl = fold(field.label);
      const names = [fl, ...(field.aliases ?? []).map(fold)];
      let exact = false;
      for (const op of field.operators) for (const name of names) {
        const prefix = `${name} ${fold(op.label)} `;
        if (q.startsWith(prefix) && q.length > prefix.length) {
          for (const v of valueMatches(op, query.trim().slice(prefix.length))) {
            exact = true;
            const f = { field: field.key, operator: op.key, value: v };
            push({ kind: "value", label: this.#filterText(f), field, op, value: v, group: sug }, `${field.key}:${op.key}:${JSON.stringify(v)}`);
          }
        }
      }
      if (exact) continue;
      for (const name of names) {
        const prefix = `${name} `;
        if (!q.startsWith(prefix) || q.length <= prefix.length) continue;
        const rest = q.slice(prefix.length);
        if (field.operators.some((op) => fold(op.label).startsWith(rest))) continue;   // still typing the operator
        for (const op of field.operators) for (const v of valueMatches(op, query.trim().slice(prefix.length))) {
          const f = { field: field.key, operator: op.key, value: v };
          push({ kind: "value", label: this.#filterText(f), field, op, value: v, group: sug }, `${field.key}:${op.key}:${JSON.stringify(v)}`);
        }
      }
    }
    // Fields and field+operator pairs whose names contain the text.
    for (const field of fields) {
      const fl = fold(field.label);
      if (fl.includes(q) || (field.aliases ?? []).some((a) => fold(a).includes(q))) push({ kind: "field", label: field.label, field, op: this.#op(field), group: sug }, field.key);
      for (const op of field.operators) {
        const both = `${field.label} ${op.label}`;
        if (fold(both).includes(q)) push({ kind: "op", label: both, field, op, group: sug }, `${field.key}:${op.key}`);
      }
    }
    // Free text goes first, unless the text is exactly a field's name, or after the finished filters it spells
    // ("area data" → Area is Data first: that is what the reader typed).
    const content = this.#config.contentField && this.#field(this.#config.contentField);
    const exactField = fields.some((f) => fold(f.label) === q || f.operators.some((o) => fold(`${f.label} ${o.label}`) === q));
    if (content && !exactField) {
      const op = this.#op(content);
      const at = out.findIndex((x) => x.kind !== "value");
      out.splice(at < 0 ? out.length : at, 0, { kind: "content", label: fill(s.searchFor, { q: query.trim() }), field: content, op, value: { type: "string", value: query.trim() }, group: sug });
    }
    return out.slice(0, this.#config.maxResults ?? 10);
  }

  #openMenu() {
    if (this.#editing) return;
    this.#items = this.#suggest(this.input.value);
    const menu = this.#menu, s = this.#strings;
    if (this.#active >= this.#items.length) this.#active = this.#items.length - 1;
    if (this.#active < 0 && this.input.value.trim() && this.#items.length) this.#active = 0;
    const rows: HTMLElement[] = [];
    let group: string | null = null;
    this.#items.forEach((it, i) => {
      if (it.group !== group) {
        group = it.group;
        rows.push(el("div", { class: "ps-group", role: "presentation" } as Partial<HTMLDivElement>, group));
      }
      const opt = el("div", { class: `ps-option ps-kind-${it.kind}`, id: `${menu.id}-${i}` },
        el("span", { class: "ps-option-label" }, it.label),
        ...(it.kind === "field" && it.field.description ? [el("span", { class: "ps-option-desc" }, it.field.description)] : []));
      opt.setAttribute("role", "option");
      opt.dataset.i = String(i);
      opt.setAttribute("aria-selected", String(i === this.#active));
      rows.push(opt);
    });
    if (!this.#items.length) rows.push(el("div", { class: "ps-empty", role: "presentation" } as Partial<HTMLDivElement>, fill(s.noMatch, { q: this.input.value.trim() })));
    menu.replaceChildren(...rows);
    menu.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.#syncActive();
  }
  #closeMenu() {
    this.#menu.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this.#active = -1;
  }
  #syncActive() {
    const opts = this.#menu.querySelectorAll<HTMLElement>(".ps-option");
    opts.forEach((o, i) => o.setAttribute("aria-selected", String(i === this.#active)));
    const cur = opts[this.#active];
    if (cur) { this.input.setAttribute("aria-activedescendant", cur.id); cur.scrollIntoView({ block: "nearest" }); }
    else this.input.removeAttribute("aria-activedescendant");
  }
  #move(by: number) {
    if (this.#menu.hidden) this.#openMenu();
    const n = this.#items.length;
    if (!n) return;
    this.#active = this.#active < 0 ? (by > 0 ? 0 : n - 1) : (this.#active + by + n) % n;
    this.#syncActive();
  }
  #choose(it: Suggestion | undefined) {
    if (!it) return;
    const input = this.input;
    const clearText = () => { input.value = ""; this.#emitInput.cancel(); this.#fire("ps-input", { text: "", free: false }); };
    if (it.value && this.#complete(it.value, it.op)) {
      clearText();
      this.#commit({ field: it.field.key, operator: it.op.key, value: it.value }, null);
      this.#closeMenu();
      input.focus();
      return;
    }
    if (it.op.value.type === "empty") {
      clearText();
      this.#commit({ field: it.field.key, operator: it.op.key, value: { type: "empty" } }, null);
      this.#closeMenu();
      return;
    }
    clearText();
    this.#closeMenu();
    this.#openEditor(null, { field: it.field.key, operator: it.op.key, value: this.#emptyValue(it.op) });
  }
  #inputKey(e: KeyboardEvent) {
    const input = this.input;
    const open = !this.#menu.hidden;
    if (e.isComposing) return;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); this.#move(1); break;
      case "ArrowUp": e.preventDefault(); this.#move(-1); break;
      case "Enter":
        if (open && this.#active >= 0) { e.preventDefault(); this.#choose(this.#items[this.#active]); }
        else if (!input.value.trim()) { e.preventDefault(); this.#closeMenu(); this.#fire("ps-submit", {}); }
        break;
      case "Escape":
        if (open) { e.preventDefault(); this.#closeMenu(); }
        else if (input.value) { e.preventDefault(); input.value = ""; this.#emitInput.cancel(); this.#fire("ps-input", { text: "", free: false }); }
        else input.blur();
        break;
      case "Tab": this.#closeMenu(); break;
      case "Backspace":
      case "ArrowLeft":
        if (input.selectionStart === 0 && input.selectionEnd === 0 && this.#filters.length) {
          e.preventDefault();
          this.#closeMenu();
          this.#tokenButtons().at(-1)!.focus();
        }
        break;
    }
  }

  // ---------- the editor ----------
  #openEditor(index: number | null, draft?: Filter) {
    const s = this.#strings;
    const f = structuredClone(draft ?? this.#filters[index!]);
    const field = this.#field(f.field)!;
    this.#editing = { index, draft: f };
    this.#closeMenu();
    const ed = this.#editor;
    const title = el("div", { class: "ps-editor-title" }, field.label);
    title.id = `ps-editor-title-${this.#id}`;
    ed.setAttribute("aria-labelledby", title.id);
    const body = el("div", { class: "ps-editor-body" });
    const opRow = el("div", { class: "ps-editor-ops", role: "radiogroup" } as Partial<HTMLDivElement>);
    opRow.setAttribute("aria-label", s.operator);
    const apply = el("button", { type: "button", class: "btn primary ps-apply" }, s.apply);
    const valueBox = el("div", { class: "ps-editor-value" });
    const update = () => {
      const op = this.#op(field, f.operator);
      apply.disabled = !this.#complete(f.value, op);
    };
    const renderValue = () => {
      const op = this.#op(field, f.operator);
      if (f.value.type !== op.value.type) f.value = this.#emptyValue(op);
      const v = op.value;
      valueBox.replaceChildren();
      if (v.type === "string") {
        const inp = el("input", { type: "text", class: "ps-text", value: (f.value as { value: string }).value, placeholder: s.typeValue, autocomplete: "off", spellcheck: false });
        inp.setAttribute("aria-label", s.value);
        inp.addEventListener("input", () => { f.value = { type: "string", value: inp.value }; update(); });
        valueBox.append(inp);
      } else if (v.type === "integer") {
        const cur = (f.value as { value: number }).value;
        const inp = el("input", { type: "number", class: "ps-text", value: Number.isFinite(cur) ? String(cur) : "", step: "1", inputMode: "numeric" });
        if (v.min !== undefined) inp.min = String(v.min);
        if (v.max !== undefined) inp.max = String(v.max);
        inp.setAttribute("aria-label", s.value);
        if (v.min !== undefined && v.max !== undefined) inp.placeholder = fill(s.between, { min: String(v.min), max: String(v.max) });
        inp.addEventListener("input", () => { f.value = { type: "integer", value: inp.value === "" ? NaN : Number(inp.value) }; update(); });
        valueBox.append(inp);
      } else if (v.type === "enum" || v.type === "enum_list") {
        const multi = v.type === "enum_list";
        const list = el("div", { class: "ps-choices", role: multi ? "group" : "radiogroup" } as Partial<HTMLDivElement>);
        list.setAttribute("aria-label", s.value);
        for (const item of v.values) {
          const on = multi ? (f.value as { value: string[] }).value.includes(item.value) : (f.value as { value: string }).value === item.value;
          const box = el("input", { type: multi ? "checkbox" : "radio", name: `ps-v-${this.#id}`, value: item.value, checked: on });
          box.addEventListener("change", () => {
            if (multi) {
              const cur = new Set((f.value as { value: string[] }).value);
              if (box.checked) cur.add(item.value); else cur.delete(item.value);
              f.value = { type: "enum_list", value: v.values.map((x) => x.value).filter((x) => cur.has(x)) };
            } else f.value = { type: "enum", value: item.value };
            update();
          });
          list.append(el("label", { class: "ps-choice" }, box, el("span", {}, item.label)));
        }
        valueBox.append(list);
      }
      update();
    };
    if (field.operators.length > 1) {
      for (const op of field.operators) {
        const b = el("button", { type: "button", class: "ps-op" }, op.label);
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(op.key === f.operator));
        b.addEventListener("click", () => {
          const before = this.#op(field, f.operator).value.type;
          f.operator = op.key;
          opRow.querySelectorAll(".ps-op").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
          if (before !== op.value.type) renderValue(); else update();
        });
        opRow.append(b);
      }
      body.append(opRow);
    }
    body.append(valueBox);
    const cancel = el("button", { type: "button", class: "btn ps-cancel" }, s.cancel);
    const actions = el("div", { class: "ps-editor-actions" });
    if (index !== null) {
      const del = el("button", { type: "button", class: "btn ps-delete" }, s.remove);
      del.addEventListener("click", () => { this.#closeEditor(false); this.#remove(index, true, index - 1); });
      actions.append(del);
    }
    actions.append(cancel, apply);
    cancel.addEventListener("click", () => this.#closeEditor(true));
    apply.addEventListener("click", () => this.#applyEditor());
    ed.replaceChildren(title, body, actions);
    ed.onkeydown = (e) => {
      if (e.isComposing) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.#closeEditor(true); }
      else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); this.#applyEditor(); }
    };
    renderValue();
    ed.hidden = false;
    this.#placeEditor(index);
    (ed.querySelector<HTMLElement>(".ps-text, .ps-choices input:checked, .ps-choices input, .ps-op[aria-checked=true]") ?? apply).focus();
  }
  #placeEditor(index: number | null) {
    const ed = this.#editor, bar = this.querySelector<HTMLElement>(".ps-bar")!;
    const anchor = index === null ? this.input : this.#list.children[index] as HTMLElement;
    const b = bar.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    const left = Math.max(0, Math.min(a.left - b.left, b.width - ed.offsetWidth));
    ed.style.left = `${left}px`;
  }
  #applyEditor() {
    if (!this.#editing) return;
    const { index, draft } = this.#editing;
    const field = this.#field(draft.field)!, op = this.#op(field, draft.operator);
    if (draft.value.type === "string") draft.value = { type: "string", value: draft.value.value.trim() };
    if (!this.#complete(draft.value, op)) return;
    this.#closeEditor(false);
    this.#commit(draft, index);
    (index === null ? this.input : this.#tokenButtons()[index] ?? this.input).focus();
  }
  #closeEditor(refocus: boolean) {
    const was = this.#editing;
    this.#editing = null;
    this.#editor.hidden = true;
    this.#editor.replaceChildren();
    if (refocus && was) (was.index === null ? this.input : this.#tokenButtons()[was.index] ?? this.input).focus();
  }
}

if (!customElements.get("power-search")) customElements.define("power-search", PowerSearch);

declare global {
  interface HTMLElementTagNameMap {
    "power-search": PowerSearch;
  }
}
