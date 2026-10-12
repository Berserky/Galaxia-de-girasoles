# V5-P0 — Ledger de ejecución y QA

**Épica:** #160 · **Fecha:** 2026-10-12 · **Rama P0:** `feat/visual-evolution-5-p0-baseline`.
**Fuente:** `prod@fde141d4c8e7622ac1d6f10f1abbfbda8e8e7d0c`, 4.1.2/code39; `qa` mismo SHA; `desarrollo@143d1e7885c860b21799938bc2208f696360ee10` contiene los commits de prod, ahead=3, behind=0, únicamente documentos respecto a `prod`. No se repite QA de release ni reconciliación ya ejecutadas.

## Registro sin falsos PASS

| Gate / criterio | Estado al abrir PR | Evidencia y condición de cierre |
|---|---|---|
| Precondición Git y política | **PASS — verificación remota** | Comparación GitHub `prod...desarrollo` ahead 3/behind 0; rama aislada desde SHA indicada |
| Arquitectura Android y alcance | **PASS — revisión estática** | `TECHNICAL_BASELINE.md`, `P0_DESIGN_CONTRACT.md`; paths reales e IA excluida |
| Tokens 8 temas / legibilidad teórica | **IMPLEMENTADO — ejecución CI pendiente** | `CELESTIAL_TOKENS.json`, `tests/visual-evolution-p0.test.mjs`; ratios calculados en Node |
| Boceto y matriz UX | **IMPLEMENTADO — aprobación de diseño pendiente** | `prototypes/celestial-shell.html`, `P0_DESIGN_CONTRACT.md` |
| Node 24 suite completa | **PENDIENTE de resultado remoto** | Acción `visual-evolution-p0.yml` ejecuta `npm test`, conservar URL de run |
| Android lint + unit + debug/release | **PENDIENTE de resultado remoto** | `android-companion.yml` se activa por cambio de `tests/`, consultar run del PR |
| Capturas *sintéticas* por viewport/tema | **PENDIENTE de resultado remoto** | Acción P0 produce 9 PNG de la maqueta (7 skins a 393; daylight 320 y 412) |
| Métricas estáticas | **IMPLEMENTADO — captura pendiente** | `scripts/visual-evolution-p0-baseline.mjs` mide bytes/líneas, rutas, temas; artefacto JSON en Actions |
| Capturas de **APK real** y comportamiento en pantalla | **BLOCKED — sin dispositivo/emulador disponible** | PC Bati-Compu OFFLINE; ejecutar después AVD hermético con identidades ficticias, conservar pantallas sanas |
| FPS de scroll, p95 frame time, cold start, memoria, batería | **NOT MEASURED** | Solo PASS con AVD/Perfetto/FrameMetrics/benchmark documentado (device, API, SHA, repeticiones); jamás inferir de bytes CSS |
| Contrato visual aprobado por PO | **PENDIENTE** | Aceptación visual de capturas del prototipo/variantes |
| Datos privados y producción | **PASS — alcance de cambios** | No tocar secrets ni datos, backend, APK, `qa` ni `prod`; cotejar diff del PR antes de merge |

> Las evidencias **estáticas, de compilación, de maqueta y de ejecución Android** no son equivalentes entre sí. `PASS` se concede exclusivamente a lo efectivamente verificado.

## Procedimiento reproducible

```sh
node --version # >=24, requisito de package.json
npm test
node scripts/visual-evolution-p0-baseline.mjs --out build/visual-evolution-p0-baseline.json
# Gradle 9.4.1 / JDK17 / Android SDK 36, según android-companion.yml
gradle -p android testDebugUnitTest lintDebug assembleDebug assembleRelease assembleQaDevice
```

En Android de pruebas, preferir `qaDevice` y proyecto QA, nunca cuentas ni datos privados productivos. Para métricas de rendimiento registrar cold start (mín. 5 iteraciones, excluir calentamientos), scroll (frame timeline / jank), memoria, GPU y batería con la misma AVD/API y fixture sintética; conectar indicadores a artefactos o logs y no inferir indicadores faltantes.

## Validación UX pendiente con APK QA

- Vistas: inicio, mapa, momentos, recuerdos (9 tipos), objetivos, IA **solo continuidad**, chat **solo continuidad**, más, modales/bottom sheets/notificaciones.
- Dimensiones: 320, 360, 393, 412 CSS px; portrait/landscape, escalado 1.0 y 1.3, teclado visible/oculto, pantalla sin vincular y vacía.
- Apariencias: automático + siete paletas, barras status/navigation Android y `prefers-reduced-motion`.
- Flujos invariantes: navegación, FAB/player/insets, estados GPS live/stale/sin permisos, FCM badge/deep-link, accesos álbum/fotos, privacidad de cápsulas, pairing y borrado con confirmación.
- Reportar cada fila como PASS/FAIL/PARTIAL/BLOCKED/NOT_TESTED con SHA, dispositivo, build variant, screenshot sanitizada, resultado esperado/observado y defectos asociados. No reabrir F4 como condición de P0.

## Cierre verificable

P0 solo puede declararse **CERRADA** cuando CI y Android necesarios estén verdes, la captura y medición **real** que se requiera esté evidenciada o su exclusión esté formalmente aceptada con riesgo explícito, y el propietario apruebe la dirección visual. Hasta entonces, el PR documenta el trabajo **ejecutado** pero no finge cierre; P1 podrá prepararse y revisarse sin empezar cambios productivos.

## Rollback

Revertir el PR P0 quita únicamente documentos, tests, prototipo y workflow P0. No requiere migraciones, rollback APK ni tocar `qa`/`prod`. No ejecutar release.
