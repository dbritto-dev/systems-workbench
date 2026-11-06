// Interface strings, one table per language. Lesson content comes from the lessons themselves.
import type { Locale } from "./index";

const en = {
  "site.name": "Systems Workbench",
  "site.tagline": "How systems work, one machine at a time",
  "site.intro":
    "Each lesson turns one idea into a small machine you can watch and adjust: a cache becomes a card rack, a circuit breaker a switchboard, a rolling deploy a crane swapping modules. Watch the machine, predict what an experiment will do, run it, then explain it back.",
  "site.description": "Interactive lessons on systems concepts: one simulated machine per idea, with experiments to predict and run.",
  "stats.label": "Collection size",
  "stats.lessons": "Lessons",
  "stats.experiments": "Experiments",
  "stats.questions": "Questions",
  "theme.label": "Theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "lang.label": "Language",
  "filters.label": "Filter by area",
  "filters.all": "All",
  "filters.left": "Scroll filters left",
  "filters.right": "Scroll filters right",
  "search.label": "Search lessons",
  "search.placeholder": "Search, or filter by area, machine, experiments…",
  "search.showAll": "Show all areas",
  "search.clear": "Clear search",
  "card.lesson": "Lesson",
  "card.preview": "Preview",
  "card.previewOf": "Preview",
  "card.open": "Open lesson",
  "card.counts": "{e} experiments · {q} questions",
  "card.alt": "{machine}, the machine in {title}",
  "dialog.close": "Close",
  "footer.collection":
    'Machines drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Previews are screenshots of each machine running; the lessons are interactive.',
  "footer.gallery": "Parts gallery",
  "footer.source": "Source on GitHub",
  "lesson.parts.machine": "1 · The machine",
  "lesson.parts.predict": "2 · Predict, then run",
  "lesson.parts.explain": "3 · Explain it back",
  "lesson.machine": "The machine",
  "lesson.predict": "Predict, then run",
  "lesson.explain": "Explain it back",
  "lesson.explainIntro": 'Answer out loud or in writing before opening each one. These work well as a pairing exercise: one person explains, the other asks "why?" twice.',
  "lesson.footer":
    'Figure drawn with the <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT). Simulation written for this lesson.',
  "lesson.back": "All lessons",
  "lesson.related": "Related lessons",
  "exp.count": "Experiment {i} of {n}",
  "exp.prediction": "Your prediction",
  "exp.pick": "Pick a prediction, then run",
  "exp.watch": "Watch it in the figure",
  "q.n": "Q{i}",
  "q.covers": "A good answer covers",
  // ux-collection
  "search.shortcut": "Slash",
  // ux-chrome
  "chrome.skip": "Skip to content",
  "chrome.topNav": "Top navigation",
  "chrome.onPage": "On this page",
  "chrome.newTab": "(opens in a new tab)",
  // ux-lesson
  "exp.run": "Run the experiment",
  "exp.pickFirst": "Pick a prediction first",
} as const;

export type UiKey = keyof typeof en;

const es: Record<UiKey, string> = {
  "site.name": "Systems Workbench",
  "site.tagline": "Cómo funcionan los sistemas, una máquina a la vez",
  "site.intro":
    "Cada lección convierte una idea en una pequeña máquina que puedes observar y ajustar: una caché se vuelve un estante de fichas, un circuit breaker un conmutador, un despliegue gradual una grúa que cambia módulos. Observa la máquina, predice qué hará un experimento, ejecútalo y luego explícalo.",
  "site.description": "Lecciones interactivas de sistemas: una máquina simulada por idea, con experimentos para predecir y ejecutar.",
  "stats.label": "Tamaño de la colección",
  "stats.lessons": "Lecciones",
  "stats.experiments": "Experimentos",
  "stats.questions": "Preguntas",
  "theme.label": "Tema",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",
  "lang.label": "Idioma",
  "filters.label": "Filtrar por área",
  "filters.all": "Todas",
  "filters.left": "Desplazar filtros a la izquierda",
  "filters.right": "Desplazar filtros a la derecha",
  "search.label": "Buscar lecciones",
  "search.placeholder": "Busca o filtra por área, máquina, experimentos…",
  "search.showAll": "Ver todas las áreas",
  "search.clear": "Borrar búsqueda",
  "card.lesson": "Lección",
  "card.preview": "Vista previa",
  "card.previewOf": "Vista previa de",
  "card.open": "Abrir lección",
  "card.counts": "{e} experimentos · {q} preguntas",
  "card.alt": "{machine}, la máquina de {title}",
  "dialog.close": "Cerrar",
  "footer.collection":
    'Máquinas dibujadas con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Las vistas previas son capturas de cada máquina en marcha; las lecciones son interactivas.',
  "footer.gallery": "Galería de piezas",
  "footer.source": "Código en GitHub",
  "lesson.parts.machine": "1 · La máquina",
  "lesson.parts.predict": "2 · Predice y ejecuta",
  "lesson.parts.explain": "3 · Explícalo",
  "lesson.machine": "La máquina",
  "lesson.predict": "Predice y ejecuta",
  "lesson.explain": "Explícalo",
  "lesson.explainIntro": 'Responde en voz alta o por escrito antes de abrir cada una. Funcionan bien en pareja: una persona explica y la otra pregunta "¿por qué?" dos veces.',
  "lesson.footer":
    'Figura dibujada con el kit isométrico <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> (MIT). Simulación escrita para esta lección.',
  "lesson.back": "Todas las lecciones",
  "lesson.related": "Lecciones relacionadas",
  "exp.count": "Experimento {i} de {n}",
  "exp.prediction": "Tu predicción",
  "exp.pick": "Elige una predicción y ejecuta",
  "exp.watch": "Míralo en la figura",
  "q.n": "P{i}",
  "q.covers": "Una buena respuesta cubre",
  // ux-collection
  "search.shortcut": "Barra diagonal",
  // ux-chrome
  "chrome.skip": "Saltar al contenido",
  "chrome.topNav": "Navegación superior",
  "chrome.onPage": "En esta página",
  "chrome.newTab": "(se abre en una pestaña nueva)",
  // ux-lesson
  "exp.run": "Ejecutar el experimento",
  "exp.pickFirst": "Primero elige una predicción",
};

const TABLES: Record<Locale, Record<UiKey, string>> = { en, es };

/** t("card.counts", { e: 5, q: 6 }) in the given locale. */
export function useUi(locale: Locale) {
  const table = TABLES[locale];
  return (key: UiKey, vars: Record<string, string | number> = {}) =>
    table[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** Area names: the key is the area as written in lessons.json. */
export const AREAS = ["Fundamentals", "Data", "Concurrency", "Messaging", "Distributed", "Traffic", "Resilience", "Delivery", "Observability", "Frontend", "Search", "Security"] as const;
export type Area = (typeof AREAS)[number];
export const AREA_NAMES: Record<Area, { en: string; es: string }> = {
  Fundamentals: { en: "Fundamentals", es: "Fundamentos" },
  Data: { en: "Data", es: "Datos" },
  Concurrency: { en: "Concurrency", es: "Concurrencia" },
  Messaging: { en: "Messaging", es: "Mensajería" },
  Distributed: { en: "Distributed", es: "Distribuidos" },
  Traffic: { en: "Traffic", es: "Tráfico" },
  Resilience: { en: "Resilience", es: "Resiliencia" },
  Delivery: { en: "Delivery", es: "Despliegue" },
  Observability: { en: "Observability", es: "Observabilidad" },
  Frontend: { en: "Frontend", es: "Frontend" },
  Search: { en: "Search", es: "Búsqueda" },
  Security: { en: "Security", es: "Seguridad" },
};
