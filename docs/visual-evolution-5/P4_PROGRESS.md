# V5-P4 — Connected Journeys / Mapa Android

**Épica:** [#160](https://github.com/Berserky/Galaxia-de-girasoles/issues/160). **Referencia de salida:** `desarrollo@1d3c997c259c7a63b12ac54f3599023638bec6cd` tras P3 PR #169 (15/15 CI SUCCESS y fusionado). **Rama:** `feat/visual-evolution-5-p4-connected-journeys` → `desarrollo`. **Estado:** P4A implementado en rama; CI Android y revisión visual P4 pendientes. **No** merge ni QA/prod.

## Alcance congelado

- Sólo interfaz Android WebView en `android/app/src/main/assets/mobile`: conservar clases `GalaxyMap`, `GalaxyDistance`, `GalaxyEta`, `GalaxyGpsHistory` y acciones nativas y API originales.
- No cambiar permisos, consentimiento, inicio/detención de GPS, privacidad, precisión, tracks persistidos, mapas base, FCM, motor de IA ni backend.
- Nunca inferir GPS en tiempo real de una posición antigua, ni mostrar coordenadas personales en fixtures o logs. Datos geográficos sintéticos y anónimos únicamente en pruebas.
- Mantener `map.js` original (OpenStreetMap con atribución) y callbacks `map-refresh`, `couple-distance-focus`, `eta-focus`, `status-menu`, `transport-set`, `trip-toggle`, `place-new`, `destination`.

## P4A implementado (pendiente de QA)

| VE | Mejora | Código | Estado |
|---|---|---|---|
| 061 | Mapa resumen y modo inmersivo reversible | `app.js` + `galaxy-journeys-v5.css` | Implementado, test en CI pendiente |
| 063, 065 | Marcadores diferenciados y controles 44px/foco | `app.css` | Implementado en rama, evaluación visual pendiente |
| 066, 069, 071 | Estados recientes/históricos/pausados sin coordenadas | `galaxy-journeys-v5.js`, `app.js` | Implementado, debe pasar Android |
| 072, 073, 075 | Distancia y llegada unificadas en Journey Companion sin reescribir cálculos | `app.js`, CSS | Implementado, QA de datos offline/stale pendiente |
| 079, 080 | Selector Automático/Moto/Transporte con `aria-pressed`, touch >=44px | `app.js`, CSS | Implementado, contraste en 7 temas pendiente |
| Otros VE-062, 064, 067–068, 070, 074, 076–078, 081–100 | Evaluación y mejoras por lotes | Auditar e implementar | PENDIENTE |

**Hechos comprobados antes del PR:** código JavaScript compilable sintácticamente en V8; presentador de frescura ejecutado con casos recientes/históricos/pausados. Esto **no equivale** a `npm test`, Gradle o QA real. Tests nuevos `tests/visual-evolution-p4.test.mjs` verifican estado de señales, privacidad del marcado HTML, escape, rutas existentes, viewport/foco/reduced-motion y coordenadas ausentes o inválidas.

## Plan de bloques de P4

- **P4A · Cartografía inmersiva y Journey Companion:** panel principal, estados honestos, accesibilidad y preservación de rutas. Terminar nodo Node 24, Android build/lint, instrumentación WebView real, imágenes 320/360/393/412, 7 temas y fuente grande. No declarar PASS sin artefactos.
- **P4B · Contexto, movilidad, alertas y sesión:** jerarquizar proximidad/llegada, retiro de texto de versión técnica, histórico vs estado actual, botones de acción segura. Reutilizar `contextEnginePanel`; no llamar alertas activas sin entrega comprobada. Verificar rutas `context-*`, `trip-toggle`, destinos.
- **P4C · Lugares e historial:** diseños compactos, selección/centrado marcador y timeline por fechas/metadatos existentes; paginación/mostrar más sin consultar localización nueva. Probar navegación y privacidad.
- **P4D · QA cierre:** matriz de los 40 VE uno a uno, perfiles 0/1, sin datos/con datos, stale, offline, usuario sin GPS o sin permisos, destino ausente, inicio/cierre de recorrido, 7 temas, 4 anchos CSS, teclado, fuente grande y screenshot real. Revisar checks del SHA exacto, aceptar visualmente y sólo después considerar fusionar a `desarrollo`.

## Pruebas y riesgos

**Pruebas ejecutables:** `node --test tests/visual-evolution-p4.test.mjs`; `npm test`; workflows GitHub/Android que correspondan al PR. El test Node es de contrato/presentador; no sustituye prueba de píxeles o AVD. Mantener además suites preexistentes de GPS, ETA, historial, Chat y seguridad.

**Riesgos conocidos:** la vista se re-renderiza con actualizaciones remotas; el modo inmersivo mantiene bandera local pero debe salir al abandonar Mapa, y el `ResizeObserver` de `GalaxyMap` debe reposicionar tiles tras expandir/reducir. El test Android debe confirmar que mapa de pantalla completa no tapa su botón de cierre y que Esc retorna correctamente. Los perfiles y el motor ETA usan frescura de 10 minutos; no aproximar datos stale como actuales.

**Revert:** revertir P4 por PR sin cambios de esquema o datos; restaurar HTML/CSS/JS empaquetados. No reemplazar map.js ni GPS; `qa`, `prod` y versión estable quedan intactos.

**Handoff:** continuar desde este documento y `docs/visual-evolution-5/03-mapa.md`; verificar primero HEAD de la rama, PR activo y CI del SHA, no reiniciar P0–P3 ni asumir que los casos físicos antiguos certifican P4.
