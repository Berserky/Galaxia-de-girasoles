# Visual Evolution 5.0 — P1 · Celestial Shell — registro vivo

**Repositorio:** `Berserky/Galaxia-de-girasoles` · **rama:** `feat/visual-evolution-5-p1-shell` · **PR:** [#167](https://github.com/Berserky/Galaxia-de-girasoles/pull/167) (**DRAFT**).
**Base:** `desarrollo@077089822b9a2775f4bdd8f4c6c5ab8fba11a697` (P0 fusionado, PR #166).
**Objetivo:** modernizar interfaz compartida Android WebView sin reescribir Galaxy Chat, IA, GPS, FCM, backend, datos ni contratos de puente nativo.
**Estado al 13 octubre 2026 UTC:** ingeniería del primer slice de P1 implementada; 15/15 workflows PASS en HEAD `24e8464`; se incorporó una nueva auditoría de cuatro anchos Android físicos en HEAD posterior, **todavía pendiente de CI**. **P1 no cerrado ni fusionado**; sigue pendiente aprobación estética y cobertura manual/validación de dispositivos.

## Cambios implementados

| Área | Implementación | Aseguramiento |
|---|---|---|
| 7 paletas `daylight/cosmic/halloween/christmas/valentine/friendship/easter` | `celestial-shell.css` añade variables de acción, texto y elevación sin sustituir `theme.js`; conserva elección `auto` | Contraste AA para botón primario en 7 temas dentro de WebView Android y tests Node |
| Shell visual (tarjetas, encabezado, controles) | Capa CSS cargada por `index.html`, botones táctiles y transiciones/reduced-motion | Capturas APK y pruebas estáticas; juicio estético del propietario pendiente |
| Navegación | Seis pestañas existentes, indicador visual y `aria-current=page` | Instrumentación recorre las seis rutas |
| Chat FAB, añadir, reproductor | Separación de carriles con CSS `:has`, ajustes a teclado y safe areas | Medición de rectángulos reales del WebView con jugador y botón extra sintéticos |
| Modal no Chat | `celestial-shell.js` prioriza entrada editable sobre botón `Cerrar`; etiqueta modal y restaura foco; sincronización programática de `v5-input-focused` | Android modal search/cancel y regresiones Node; Chat conserva sus propios controles |
| Inicio y temas Android | Prueba aislada con `QaHttpServer`, `DeviceStore` ficticio y suffix `.v5p1qa` | Screenshots de siete paletas en pantalla **idéntica**, gated por píxeles reales; no cuenta emparejada |

## Evidencia efectiva

1. **[Run V5 P0/P1 38338089833](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38338089833)**: trabajos Node, prototipo Chrome y Android emulado en verde sobre revisión `6c98431a81c03e56a678462a3ec205835ede724d`.
2. **[Artefacto Android 11786510726](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38338089833/artifacts/11786510726)**: Android JUnit XML `tests=1 failures=0 errors=0`, 7 PNGs a 1080×2400, 7 hashes distintos, screenshot unpaired vertical/horizontal y fuente ampliada.
3. Revisión manual del artefacto: **las siete capturas son de la pantalla Inicio emparejada de QA**, sin que `daylight` muestre el formulario de vinculación. Cada PNG tiene marcador de paint sintético `#07e1f7` (210 muestras al recorrer los primeros 260 píxeles de la imagen); **el marcador existe solo en instrumentación, no en la app productiva**. A diferencia del run anterior 38333402325 (captura inicial incorrecta), esta evidencia es homogénea.
4. El gate `awaitV5QaPainted()` verifica dos frames sucesivos de `UiAutomation.takeScreenshot()` y falla si el emulador muestra otro contexto, un diálogo del launcher o una WebView no pintada. La captura solo procede cuando el display real muestra la pantalla de QA. El workflow también comprueba la visibilidad del onboarding sin vincular, dimensiones horizontal/vertical y 5 arranques `am start -W`.
5. En la revisión inmediatamente anterior de P1, **15/15 workflows GitHub PASS**; tras cualquier nuevo commit **consultar de nuevo los estados**, no trasladar el PASS anterior automáticamente.

## Gate real por dominio

| Gate | Estado |
|---|---|
| 658 pruebas Node; CSS/módulo nav/modal en suite | **PASS** en V5 run 38338089833 |
| Android instrumentado: 7 temas y WCAG AA de acción primaria, solapamientos, rutas, foco modal | **PASS** en run 38338089833 |
| Capturas APK homogéneas con evidencia de pantalla realmente pintada | **PASS técnico**, 7/7 inspeccionadas |
| AVD no emparejado, 5 arranques y capturas portrait/landscape/font | **PASS técnico** en HEAD `24e8464` |
| Vista emparejada 320/360/393/412 px CSS: barra, FAB, reproductor, botón añadir, targets >=44, límites de pantalla | **IMPLEMENTADO EN INSTRUMENTACIÓN; nuevo CI pendiente**, no declarar PASS |
| IME/teclado físico en cuatro anchos y aceptación de dispositivo real | **PENDIENTE** |
| Android lint, unit, debug/release y Chat CI completo | **PASS en revisión previa**; revalidar CI sobre el HEAD antes de merge |
| Contraste de absolutamente todos los componentes y tamaño táctil por dispositivo | **PENDIENTE**; solo acción primaria y shell medidos en gate actual |
| Inspección estética manual 320/360/393/412, fuentes grandes y teclado real | **PENDIENTE**; los tests automatizados no sustituyen la revisión humana |
| Funciones autenticadas completas (Chat, mapas, memorias, objetivos, integraciones) | **NO VALIDADO POR ESTA PRUEBA VISUAL**; suite regresiva de otras fases no equivale a aceptación de diseño |
| Rendimiento visual/FPS-jank/batería de todo P1 en dispositivo objetivo | **PENDIENTE**; no extrapolar métricas parciales |
| Aprobación estética del propietario, cierre de P1/VE issues, merge a desarrollo | **NO REALIZADO** |
| Promoción a `qa` / `prod` | **PROHIBIDA** hasta aceptación; ramas sin modificación deliberada |

## Cómo continuar en otro chat

1. Consultar **HEAD del PR #167 y sus 15 workflows de ese SHA**, especialmente V5 Android y Galaxy Chat Phase 11; nunca asumir que el PASS de un SHA anterior aplica al siguiente.
2. Abrir artifact `v5-p0-android-unpaired-avd-evidence` del HEAD; verificar 7 capturas, `p1-device-summary.json` y Android JUnit, además de los resultados de la comparación visual. El marcador turquesa es intencional, únicamente QA.
3. Ejecutar o coordinar aceptación manual del propietario de los siete temas y estados sensibles (modal, teclado, carriles flotantes) antes de fusionar. Reservar P2 y la futura IA avanzada como upgrades independientes.
4. Revisar `build/p0-avd/p1-responsive-viewports/*.png` (cuatro anchos físicos con contenido QA sintético), y el JSON de resultados, generados solo si la nueva instrumentación aprueba. Registrar eventuales bugs de solapamiento en CSS y reejecutar QA tras corregir.
5. Documentar pendientes en [issue #160](https://github.com/Berserky/Galaxia-de-girasoles/issues/160) y PR #167; **no declarar cerrado** sin evidencia de los gates pendientes.

**Reproducción básica:** `node --test tests/visual-evolution-p1.test.mjs`, `npm test`; en GitHub, workflow `.github/workflows/visual-evolution-p0.yml` con AVD Android QA aislado. **Rollback:** revertir PR P1 antes de su merge, sin migraciones ni cambios en versión estable.
