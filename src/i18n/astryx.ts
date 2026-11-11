// Strings for astryx-astro's components in our Spanish. The components translate on the server from Astryx's own
// catalogs; Spanish there is es-ES (Spain), and ours is neutral Latin American (workbench/I18N.md). src/middleware.ts
// hands this map to the components as Astro.locals.astryxOverrides, which they read before their catalog, so a key
// listed here replaces Astryx's string for "es". Add a key when a component we use says something in a way I18N.md
// rules out (vosotros, ordenador, coger…) or that reads differently from the rest of the site.
// Keys and their English: node_modules/astryx-astro/src/locales/en.json; Spain's: es-ES.json.
export const ASTRYX_OVERRIDES: Record<string, Record<string, string>> = {
  es: {
    // lesson

    // collection: PowerSearch (with its Tokenizer, Typeahead, Selector and value editors), Kbd, Dialog, EmptyState.
    // es-ES says "añadir" and "introducir" and uses the Spanish perfect ("se ha añadido"); some keys it lacks fall
    // back to English.
    "@astryx.powersearch.allFiltersRemoved": "Se quitaron todos los filtros",
    "@astryx.powersearch.editableFiltersRemoved": "Se quitaron los filtros editables",
    "@astryx.powersearch.editor.addFilter": "+ Agregar filtro",
    "@astryx.powersearch.operator.startsWith": "empieza con",
    "@astryx.powersearch.operator.notStartsWith": "no empieza con",
    "@astryx.powersearch.valueEditor.addValuesPlaceholder": "Agregar valores…",
    "@astryx.powersearch.valueEditor.enterNumberPlaceholder": "Escribe un número…",
    "@astryx.powersearch.valueEditor.enterValuePlaceholder": "Escribe un valor…",
    "@astryx.numberInput.invalidNumber": "Número no válido",
    "@astryx.inputClearButton.tooltip": "Borrar",
    "@astryx.tokenizer.add": "Agregar",
    "@astryx.tokenizer.addValue": "Agregar {value}",
    "@astryx.tokenizer.allRemoved": "Se quitaron todos los elementos",
    "@astryx.tokenizer.tokenAdded": "Se agregó {label}",
    "@astryx.tokenizer.tokenRemoved": "Se quitó {label}",
    "@astryx.typeahead.emptySearchResults": "No se encontraron resultados",
    "@astryx.selector.emptySearchResults": "No se encontraron resultados",
    "@astryx.kbd.key.alt": "Alt",
    "@astryx.kbd.key.backspace": "Retroceso",
    "@astryx.kbd.key.command": "Comando",
    "@astryx.kbd.key.control": "Control",
    "@astryx.kbd.key.controlShort": "Ctrl",
    "@astryx.kbd.key.down": "Flecha abajo",
    "@astryx.kbd.key.enter": "Enter",
    "@astryx.kbd.key.escape": "Escape",
    "@astryx.kbd.key.escapeShort": "Esc",
    "@astryx.kbd.key.plus": "Más",
    "@astryx.kbd.key.shift": "Mayús",
    "@astryx.kbd.key.tab": "Tab",
    "@astryx.kbd.key.up": "Flecha arriba",

    // chrome: TopNav ("Navegación superior"), Link ("(se abre en una pestaña nueva)"), the SegmentedControl's keyboard
    // hint ("para navegar") read fine. Astryx's es-ES has no names for the hint's arrow keys, so they fell back to
    // English (inside the aria-hidden hint, but still English on a Spanish page).
    "@astryx.kbd.key.left": "Flecha izquierda",
    "@astryx.kbd.key.right": "Flecha derecha",

    // shared
    "@astryx.listInput.reorderInstructions":
      "Usa Flecha arriba o Flecha abajo para mover este elemento una posición. Presiona Espacio o Enter para tomarlo y acceder a más opciones para reordenar con el teclado.",
    "@astryx.transferList.reorderInstructions":
      "Presiona Espacio o Enter para tomar un elemento. Usa Flecha arriba, Flecha abajo, Inicio o Fin para moverlo. Presiona Espacio o Enter para soltarlo, o Escape para cancelar.",
  },
};
