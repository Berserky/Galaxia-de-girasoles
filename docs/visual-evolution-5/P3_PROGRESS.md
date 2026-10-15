# V5-P3 — Buscador universal y avisos in-app

**Rama:** `feat/visual-evolution-5-p3-notifications-ux` → `desarrollo`. **Épica:** #160. **Estado:** implementación P3 completada en rama; **15/15 workflows SUCCESS en código `21aab245` (15-oct-2026)** y ocho capturas Android P3 verificadas contra framebuffer. **Aprobación estética del propietario y merge todavía pendientes**. La documentación posterior crea un HEAD nuevo, que necesita sus propios checks para elegibilidad de merge.

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
- CI requerida: 15 workflows GitHub Actions con Node24, Android assemble/lint, Phase5, Phase11, screenshots. **15/15 SUCCESS verificados en `21aab245`; si se modifica el HEAD repetir CI y registrar el resultado nuevo**.
- Riesgos: modal WebView con teclado físico/virtual; estados API interrumpida; desplazamiento largo de aviso en 320; fuentes ampliadas. Se requieren capturas Android nuevas antes de dar por cerrada fase.
- Revert: revert PR de P3 sin migraciones ni pérdida de datos.

## Seguimiento CI — 14 oct 2026, HEAD de7e8bcd
- Se consultaron 15 workflows de GitHub Actions del HEAD indicado: **14 SUCCESS, 1 FAILURE**. Esto no equivale a aprobación visual ni a cierre de P3.
- Fallo localizado en [Galaxy Chat 4 Phase 11 Torture, run 38636002484](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38636002484): job `P0/P1 gate` SUCCESS (npm, phase11-gate, qa-android-mobile), job `Android stress matrix` FAILURE en paso **Torture instrumentation**; Gradle unit/lint/assemble y preparación Android SUCCESS. No atribuir causa raíz al código P3 sin revisar logs/artefacto `phase11-android-stress` (ID 11928621893).
- Se solicitó **rerun únicamente de los jobs fallidos** del run 38636002484 mediante GitHub Actions. Resultado de la segunda ejecución **pendiente de comprobar**.
- Artefacto de capturas Android del baseline [11929185729](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38636002535) disponible, pero **sin inspección visual certificada**. Faltan revisión de capturas P3 en anchos y temas, teclado, fuente grande, rutas y autorización del propietario antes de merge.
- PR #169 permanece draft; `desarrollo`, `qa` y `prod` sin promoción por esta comprobación.

## Cierre de QA técnica P3 — 15 oct 2026, commit de código `21aab245a8ae983b244ad95535e7aba0a58cb0ae`

### Gates automatizados y evidencia (sin extrapolar a otros commits)
- **15/15 GitHub Actions SUCCESS** del mismo commit: Node, Android CI, Phase 0–5/8–11, DB, Phase5 integración real, onboarding landscape y V5 P0 Android AVD. [Conjunto de ejecución](https://github.com/Berserky/Galaxia-de-girasoles/actions?query=branch%3Afeat%2Fvisual-evolution-5-p3-notifications-ux).
- **Android AVD PASS**: [run 38682208348](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38682208348), [artefacto real 11948837359](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38682208348/artifacts/11948837359). 8 PNG de pantalla: búsqueda y notificaciones × 320/360/393/412 CSS px. Los ocho archivos se inspeccionaron: los dos modales son visibles, los contenidos sintéticos son legibles y no aparecen capturas recicladas de Inicio. Hashes distintos.
- En logcat real, **8/8 marcadores P3 pintados** sobre framebuffer con al menos dos muestras estables; delta real medido del 9.0% al 14.0%, no inferido solo del DOM. Las cuatro pulsaciones Android a `#universalSearchInput` tienen `targetHit:true`, geometría visible y foco verificado. Se inyecta texto mediante entrada Android y la instrumentación exige IME visible, campo dentro de `visualViewport` y ausencia de desbordamiento, en los cuatro anchos.
- Notificaciones: cuatro filtros probados individualmente y alcanzables horizontalmente, objetivos táctiles >=44 px, scroll vertical dentro del modal, dos acciones de destino independientes, estados no leídos. La última pestaña queda parcialmente fuera del área visible en 320 px **de forma intencional y desplazable**.
- Temas P1/contrastes: 7 paletas y un botón genérico medidos en WebView Android, contraste entre 5.51 y 11.27 (>=4.5), con capturas reales de Inicio. **No equivale a tener 14 capturas P3 específicas para cada tema**. La compatibilidad estética transversal de los dos modales con las siete paletas sigue necesitando revisión final.
- La captura de búsqueda a 320 px fue tomada **antes** del paso de teclado nativo (por eso el teclado no aparece en ese PNG); la verificación automatizada posterior de entrada Android e IME sí pasó. No presentar esa imagen como evidencia visual del teclado abierto.

### Matriz de cierre / faltantes honestos
| Criterio | Estado | Evidencia/alcance |
|---|---|---|
| API/contratos preservados; Node y seguridad HTML | PASS automatizado | Tests P3 + Android CI y DB |
| Build/lint y regresión Chat/Media/Phase11 | PASS automatizado | 15/15 workflows del commit de código indicado |
| Buscador y avisos Android, 4 anchos | PASS automatizado y revisión visual de 8 PNG | Marcadores reales, modal, textos y scroll |
| Teclado nativo, input y viewport en 4 anchos | PASS automatizado | Taps Android + IME y DOM/viewport; captura post-IME pendiente de comparación estética |
| Todas las apariencias P3 y tamaño de letra ampliado P3 | PARTIAL | P1 temas y onboarding large-font PASS; falta comparación específica de estos paneles |
| QA con cuentas reales, notificaciones FCM reales, batería física | NOT TESTED / fuera de alcance P3 | No declarar realizadas ni inventar datos |
| Aceptación visual del propietario | PENDING | Presentar 8 imágenes sintéticas sin datos privados y obtener aprobación |
| Merge a `desarrollo` | BLOCKED hasta aprobación | PR #169 sigue DRAFT; no promover QA/prod |

### Handoff concreto
1. Confirmar HEAD y sus 15 checks antes del merge (los checks de `21aab245` no prueban automáticamente un commit posterior de documentación).
2. Obtener aceptación visual del propietario de búsqueda y notificaciones en 320/360/393/412; si desea revisión específica por tema y fuente ampliada, generar y examinar evidencia adicional sin saltarse las reglas visuales.
3. Solo después del DoD y autorización correspondiente: marcar PR listo para revisión, comprobar checks y fusionar en `desarrollo`; no desplegar a `qa` ni `prod`. Después iniciar P4 desde el estado integrado.
