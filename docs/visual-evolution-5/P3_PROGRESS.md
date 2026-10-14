# V5-P3 — Buscador universal y avisos in-app

**Rama:** `feat/visual-evolution-5-p3-notifications-ux` → `desarrollo`. **Épica:** #160. **Estado:** implementación P3 inicial completa en rama; QA automatizado y evidencia visual Android aún por certificar.

## Inventario y límites
- Buscador original: `universalSearchRows` usa `GalaxySearch.searchUniverse`, con prioridad y acciones originales; `intelligence-search` es una llamada existente, sin alterar IA, relevancia, motor ni embeddings. Resultados directos se agrupan **visualmente en grupos contiguos de tipo** manteniendo exactamente el orden del motor; metadatos `subtitle` existentes se muestran sin truncación, tarjeta completa y deep link original conservado.
- Resultado semántico conserva `intelligenceSearchExtraMarkup` y su deduplicación actual. P3 incorpora estados de carga, error con fallback real a coincidencias directas y protección de race conditions mediante `intelligenceSearchNonce` actualizado antes de cualquier retorno.
- Centro de avisos: conserva `notifications-list`, `notifications-read` individual/masivo, `routeGalaxyAction` (chat/mapa/metas/etc.), `id` y `entityId`. Nuevo presentador puramente local con secciones contiguas por fecha/categoría, filtros Todas/Sin leer/Chat/Actividad **sin ocultar avisos de forma irreversible**, lectura de textos largos, indicadores sin leer, metadatos legibles y estado histórico de proximidad. Carga/errores y reintentos visibles; no inventa avisos ni altera push nativo.
- Componentes: `galaxy-discovery-v5.js` y `galaxy-discovery-v5.css` empaquetados después de P2, antes del runtime Android. Sólo se edita `app.js` para consumir renderizadores, modular de forma conservadora. Estado y estilos basados en tokens existentes y `prefers-reduced-motion`.
- **Fuera de alcance**: rediseño del módulo IA, Chat Engine, GPS/FCM, backend y permisos, alteración de datos o notificaciones reales.

## Matriz VE del incremento
| Hallazgos | Implementación | Estado |
|---|---|---|
| VE-035/036/044/046/059/060 | Modal buscador 100dvh, safe areas, foco único, scroll propio, reduced motion | Código; QA Android pendiente |
| VE-037/038/040/041/042/043 | Grupos visuales contiguos de resultados directos y relacionados existentes, labels por tipo, previews multilinea, metadatos disponibles | Código; revisar casos semánticos en Android |
| VE-039 | Ranking IA preservado; diagnóstico de relevancia deferido al upgrade independiente de IA | EXCLUIDO, no modificar motor |
| VE-045 | Búsqueda vacía/sin resultados/cargando/offline, fallback clásico y cancelación de respuestas obsoletas | Código; pruebas de fallos pendientes |
| VE-047/048/051/052/053/054/055/057/058 | Modal adaptable; scroll/insets; badges sin leer; CTA claro; fecha legible; categorías; body multilinea; filtros y estados vacíos/loading/error | Código; QA Android pendiente |
| VE-049/050/056 | Título original conservado para evitar información inventada, agrupación contigua de Chat sin colapsar acciones individuales y etiqueta de evento de proximidad antiguo | Parcial; no alterar semántica de backend |

**Regla de cierre:** no marcar hallazgos como DONE visual hasta comparar siete temas, 320/360/393/412 CSS px, teclado, fuente grande, rutas y aprobación del propietario.

## Pruebas/revert
- `tests/visual-evolution-p3.test.mjs`: asserts de HTML seguro, prioridad de búsqueda, filtros 4, read_at, 2 mensajes de chat independientes, onclick original, fases error/carga, accesibilidad/safe area y no regresión de motor.
- CI requerida: 15 workflows GitHub Actions con Node24, Android assemble/lint, Phase5, Phase11, screenshots. **Sin resultados aún en este commit**.
- Riesgos: modal WebView con teclado físico/virtual; estados API interrumpida; desplazamiento largo de aviso en 320; fuentes ampliadas. Se requieren capturas Android nuevas antes de dar por cerrada fase.
- Revert: revert PR de P3 sin migraciones ni pérdida de datos.
