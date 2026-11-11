// The collection's power search (Astryx's PowerSearch): which filters a reader can build, in the page's language.
// Field keys are what src/elements/lesson-collection.ts applies (and what the URL carries); labels and words are the
// reader's. The interface words (Apply, Cancel, Clear all…) come from Astryx's catalog (Spanish: src/i18n/astryx.ts).
import type { PowerSearchConfig } from "astryx-astro/components/PowerSearch/powerSearchModel";
import { pick, type Locale } from "../i18n";
import { AREAS, AREA_NAMES } from "../i18n/ui";

const T = (locale: Locale) => (en: string, es: string) => pick({ en, es }, locale);

export function lessonFilters(locale: Locale, areas: readonly string[], lessons: number): PowerSearchConfig {
  const L = T(locale);
  const contains = { key: "contains", label: L("contains", "contiene"), value: { type: "string" as const } };
  const mention = { key: "contains", label: L("mention", "mencionan"), value: { type: "string" as const } };
  const areaValues = AREAS.filter((a) => areas.includes(a)).map((a) => ({ value: a, label: AREA_NAMES[a][locale] }));
  const number = { type: "integer" as const, minValue: 1, maxValue: lessons };
  return {
    name: "lessons",
    // Free text ("Search for …", the first suggestion) is a Text filter.
    contentSearchFieldKey: "text",
    fields: [
      { key: "text", label: L("Text", "Texto"), icon: "search", description: L("Anywhere on the lesson's page", "En cualquier parte de la lección"), operators: [contains] },
      // Astryx matches labels as typed; the alias lets "area" find "Área" (and Spanish readers who skip the accent).
      { key: "area", label: L("Area", "Área"), typeaheadAliases: locale === "es" ? ["area", "tema"] : ["topic"], description: L("One or more areas", "Una o más áreas"),
        operators: [
          { key: "is", label: L("is", "es"), value: { type: "enum_list", values: areaValues } },
          { key: "not", label: L("is not", "no es"), value: { type: "enum_list", values: areaValues } },
        ] },
      { key: "title", label: L("Title", "Título"), typeaheadAliases: locale === "es" ? ["titulo"] : [], description: L("The lesson's name and concept", "El nombre y el concepto de la lección"), operators: [contains] },
      { key: "machine", label: L("Machine", "Máquina"), typeaheadAliases: locale === "es" ? ["maquina"] : [], description: L("The machine in the figure", "La máquina de la figura"), operators: [contains] },
      { key: "experiments", label: L("Experiments", "Experimentos"), description: L("The five predict-then-run experiments", "Los cinco experimentos de predecir y ejecutar"), operators: [mention] },
      { key: "questions", label: L("Questions", "Preguntas"), description: L("The explain-back questions", "Las preguntas para explicar"), operators: [mention] },
      { key: "lesson", label: L("Lesson", "Lección"), typeaheadAliases: locale === "es" ? ["leccion", "número"] : ["number"], description: L("By number", "Por número"),
        operators: [
          { key: "is", label: L("number", "número"), value: number },
          { key: "from", label: L("from", "desde"), value: number },
          { key: "to", label: L("up to", "hasta"), value: number },
        ] },
    ],
  };
}
