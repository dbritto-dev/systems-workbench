// Strings for astryx-astro's components in our Spanish. The components translate on the server from Astryx's own
// catalogs; Spanish there is es-ES (Spain), and ours is neutral Latin American (workbench/I18N.md). src/middleware.ts
// hands this map to the components as Astro.locals.astryxOverrides, which they read before their catalog, so a key
// listed here replaces Astryx's string for "es". Add a key when a component we use says something in a way I18N.md
// rules out (vosotros, ordenador, coger…) or that reads differently from the rest of the site.
// Keys and their English: node_modules/astryx-astro/src/locales/en.json; Spain's: es-ES.json.
export const ASTRYX_OVERRIDES: Record<string, Record<string, string>> = {
  es: {
    // lesson

    // collection

    // chrome

    // shared
    "@astryx.listInput.reorderInstructions":
      "Usa Flecha arriba o Flecha abajo para mover este elemento una posición. Presiona Espacio o Enter para tomarlo y acceder a más opciones para reordenar con el teclado.",
    "@astryx.transferList.reorderInstructions":
      "Presiona Espacio o Enter para tomar un elemento. Usa Flecha arriba, Flecha abajo, Inicio o Fin para moverlo. Presiona Espacio o Enter para soltarlo, o Escape para cancelar.",
  },
};
