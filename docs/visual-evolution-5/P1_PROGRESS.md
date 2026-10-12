# V5-P1 — Registro de ejecución · Slice 1, Celestial Shell

**Rama:** `feat/visual-evolution-5-p1-shell` desde `desarrollo@077089822b9a2775f4bdd8f4c6c5ab8fba11a697` (merge squash PR #166).
**Estado:** IMPLEMENTADO EN RAMA; VERIFICACIÓN DE PR PENDIENTE. No equivale al cierre total de P1.
**Instrucción del propietario:** 12 octubre de 2026, «Continua entonces»: autoriza avanzar con la implementación, pero no evidencia una inspección visual manual de las capturas.

## Hecho (slice inicial, no marcar VE cerradas aún)

| Área | Código actual | Cambio concreto | Prueba / riesgo |
|---|---|---|---|
| Temas y tokens | `theme.js`/siete paletas `app.css` | Nuevo `celestial-shell.css`, siete roles `--v5-action/--v5-on-action` anclados al JSON P0; sin sobrescribir elección `auto` | `visual-evolution-p1.test.mjs`; WCAG teórico P0; pendiente contraste screenshot en APK |
| UI compartida | `index.html`, `.header/.card/.action-card/.btn` | Carga de capa CSS posterior al estilo actual, superficies y jerarquía mejoradas, botones 44px | AVD APK sin vincular, 320/360/393/412 pendientes |
| Navegación | `renderNav()`, 6 entradas | Botones tipo button, indicador visual y `aria-current=page` en ruta activa | Test de seis entradas y preservación del render de ocho vistas |
| FAB/add/player | `#chatFab`, `.floating-add`, `#globalPlayer` | Carril flotante espaciado según qué controles existen y según reproductor; reserva inferior | CSS `:has` requiere WebView moderna; validar con 2 estados simultáneos y en 320px |
| Teclado y modo reducido | HTML nativo, CSS | Clase `v5-input-focused` para ocultar temporalmente la barra/flotantes durante edición fuera de chat; transiciones se desactivan si `prefers-reduced-motion` | Verificar teclado real; no altera `syncChatViewportHeight` |
| Modal global | `#modal`, `showChatSurface/showModal/showBottomSheet/closeModal` | Helper `celestial-shell.js` con foco inicial, `aria-labelledby`, retorno al invocador y Escape dirigido al cierre existente; soporte hoja inferior no-Chat | Test con DOM sintético; validar diálogo, voz, búsqueda, permisos, navegación atrás |
| Chat / IA / nativo | motores originales | **Sin cambios** a motor Chat, IA, bridge Java, Supabase, GPS, FCM, datos, API ni migraciones | Regresiones completas por CI y revisión diferencial |

## Gate de P1 (verdad por escenario)

| Gate | Estado |
|---|---|
| Integración en rama temporal desde desarrollo | **PASS** |
| Estilos semánticos, indicadores nav y helper accesible escritos | **IMPLEMENTADO; QA pendiente** |
| Tests P1 unitarios / suite Node | **NO PROBADO hasta CI nuevo** |
| Lint + unit + builds Android | **NO PROBADO hasta CI nuevo** |
| AVD sin vincular con screenshots & cinco arranques | **NO PROBADO hasta nuevo CI** |
| 8 rutas + 9 recuerdos + datos emparejados + teclado real | **NOT_TESTED**; no usar datos reales en runner |
| Contraste de todos los elementos + UX en 7 temas en APK | **NOT_TESTED**; un test de tokens no valida cada superficie |
| Comparación FPS/jank, memoria y batería del shell autenticado | **NOT_TESTED**; evitar inventar indicadores |
| Aprobación visual de P1 / cierre VE-001, 030–034, 059–060, 144 | **PENDIENTE** |
| `qa`/`prod`/APK estable sin modificación | **PASS** por alcance y políticas; verificar ramas al cierre |

## Reproducción y aceptación del slice

```bash
npm test
node --test tests/visual-evolution-p1.test.mjs
gradle -p android testDebugUnitTest lintDebug assembleDebug assembleRelease assembleQaDevice
# El workflow V5 baseline reutiliza API 35 AVD, 5 inicios, capturas no emparejadas
```

**Casos manuales pendientes** (no simular PASS): a 320/360/393/412, comprobar nav+FAB+add+player con y sin teclado, modal y sheet al abrir/cerrar/Escape, portrait/landscape, fuente 1.3, 7 temas y auto, onboarding, rutas conservadas, objetivos, 9 memorias, Chat fullscreen. Revisión UX antes de cerrar P1 y crear P2.

**Reversión:** revertir cambios del PR P1 (nueva hoja CSS y helper JS, enlaces de `index.html`, hooks de `app.js`, pruebas y docs). Sin cambio de base de datos ni de versionCode; sin reversiones de release. No promover a QA ni producción.
