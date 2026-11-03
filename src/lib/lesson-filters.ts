// The collection's power search: which filters a reader can build, in the page's language. Field keys are what
// src/elements/lesson-collection.ts applies (and what the URL carries); labels and words are the reader's.
import type { Config, Strings } from "../elements/power-search";
import { pick, type Locale } from "../i18n";
import { AREAS, AREA_NAMES } from "../i18n/ui";

const T = (locale: Locale) => (en: string, es: string) => pick({ en, es }, locale);

export function lessonFilters(locale: Locale, areas: readonly string[], lessons: number): Config {
  const L = T(locale);
  const contains = { key: "contains", label: L("contains", "contiene"), value: { type: "string" as const } };
  const mention = { key: "contains", label: L("mention", "mencionan"), value: { type: "string" as const } };
  const areaValues = AREAS.filter((a) => areas.includes(a)).map((a) => ({ value: a, label: AREA_NAMES[a][locale] }));
  return {
    contentField: "text",
    maxResults: 10,
    maxTokenLength: 32,
    fields: [
      { key: "text", label: L("Text", "Texto"), description: L("Anywhere on the lesson's page", "En cualquier parte de la lección"), operators: [contains] },
      { key: "area", label: L("Area", "Área"), aliases: [L("topic", "tema")], description: L("One or more areas", "Una o más áreas"),
        operators: [
          { key: "is", label: L("is", "es"), value: { type: "enum_list", values: areaValues } },
          { key: "not", label: L("is not", "no es"), value: { type: "enum_list", values: areaValues } },
        ] },
      { key: "title", label: L("Title", "Título"), description: L("The lesson's name and concept", "El nombre y el concepto de la lección"), operators: [contains] },
      { key: "machine", label: L("Machine", "Máquina"), description: L("The machine in the figure", "La máquina de la figura"), operators: [contains] },
      { key: "experiments", label: L("Experiments", "Experimentos"), description: L("The five predict-then-run experiments", "Los cinco experimentos de predecir y ejecutar"), operators: [mention] },
      { key: "questions", label: L("Questions", "Preguntas"), description: L("The explain-back questions", "Las preguntas para explicar"), operators: [mention] },
      { key: "lesson", label: L("Lesson", "Lección"), description: L("By number", "Por número"), aliases: [L("number", "número")],
        operators: [
          { key: "is", label: L("number", "número"), value: { type: "integer", min: 1, max: lessons } },
          { key: "from", label: L("from", "desde"), value: { type: "integer", min: 1, max: lessons } },
          { key: "to", label: L("up to", "hasta"), value: { type: "integer", min: 1, max: lessons } },
        ] },
    ],
  };
}

export function lessonFilterStrings(locale: Locale): Strings {
  const L = T(locale);
  return {
    searchFor: L("Search for “{q}”", "Buscar “{q}”"),
    filterBy: L("Filter by", "Filtrar por"),
    suggestions: L("Suggestions", "Sugerencias"),
    noMatch: L("No filter matches “{q}”", "Ningún filtro coincide con “{q}”"),
    editFilter: L("Edit filter: {t}", "Editar filtro: {t}"),
    removeFilter: L("Remove filter: {t}", "Quitar filtro: {t}"),
    clearAll: L("Clear search and filters", "Borrar búsqueda y filtros"),
    apply: L("Apply", "Aplicar"),
    cancel: L("Cancel", "Cancelar"),
    remove: L("Remove", "Quitar"),
    operator: L("Operator", "Operador"),
    value: L("Value", "Valor"),
    or: L("or", "o"),
    typeValue: L("Type a word or phrase", "Escribe una palabra o frase"),
    between: L("{min}–{max}", "{min}–{max}"),
  };
}
