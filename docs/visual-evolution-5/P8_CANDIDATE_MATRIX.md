# Visual Evolution V5 — P8: matriz de candidatura integrada (preflight)

> **CORTE OPERATIVO 28/oct/2026 — PR #204 DRAFT.** #203 es el plan; #204 contiene la integración P5+P6+P7 con 41 rutas P5 exclusivas y tres archivos compartidos reconciliados. El snapshot `f43e584` pasó **1016 pruebas Node locales**, con 0 fallos y 5 omisiones, pero su CI oficial aún fallaba en el paso de descarga SDK de Phase5; los demás jobs estaban en curso. Se prepararon reintentos estrictos del SDK y ajustes del emulador sin desactivar sus pruebas. **El APK real, 19 escenarios completos, required checks del SHA final y aprobación visual siguen SIN CERTIFICAR.** Las evidencias históricas no se transfieren a commits nuevos. No fusionar ni promover.


**Corte:** 28-oct-2026. **Estado actual:** `P8 EN EJECUCIÓN / NO CERTIFICADO`. La matriz incluye progreso de fuente y Node, pero **no certifica APK, evidencia visual ni release**. Ver `P8_LOCAL_VALIDATION_20261028.md` y `P8_CI_FAILURE_TRIAGE_20261028.md` para logs por SHA.

## Fuentes exactas verificadas

| Fuente | Rama / PR | SHA de referencia | Estado |
| --- | --- | --- | --- |
| Baseline | `desarrollo` | `bb03a0bd7e84901d0add76bd1e04e6c127eb6d5f` | No alterar |
| P5 Jardín V3.3 | `feat/visual-evolution-5-p5-living-moments` / #171 | `4c59adb761c13eeef882c7bae954ff759a30d01b` | `IMPLEMENTADO_PENDIENTE_QA_INTEGRAL_P8` |
| P6 | #179–#190, último #190 | `85feacdcbb890dfad61ecab246829be11e502b57` | Implementación en PRs DRAFT |
| P7 | #191–#202, último #202 | `ce296ec123663e2af40a09ba3e97c5f23d9dd6c7` | Implementación en PRs DRAFT; Node/CI del último SHA sin confirmar |
| Política P8 | Documento `P8_QA_CONSOLIDADA.md` en **rama P5**, no presente aún en P7 | `4c59adb761c13eeef882c7bae954ff759a30d01b` | Importar sin perder contenido al construir candidato |

**Bloqueo de integración demostrado:** comparación GitHub entre P5 y P7K = **diverged**, P7K 50 commits adelante y 129 detrás de P5; ninguno contiene al otro. Frente al baseline común, P5 modifica 44 archivos y P6/P7K 32. Hay **tres rutas editadas en ambos lados** que requieren resolución revisada: `android/app/src/main/assets/mobile/app.js`, `android/app/src/main/assets/mobile/index.html` y `scripts/qa-android-mobile.mjs`. No asumir que una simple promoción de #202 contiene P5, ni aplicar overwrite de estos archivos. El plan no declara conflictos Git sin ejecutar una integración real.

## Procedimiento seguro para construir UN SHA candidato

1. Congelar las cabezas reales de #171 y #202; comprobar que no haya PR posterior ni divergencia de `desarrollo`. No actualizar ni fusionar ramas protegidas.
2. Crear **rama temporal de integración revisable** a partir de la cabeza P7K aprobada para preparación; integrar selectivamente los commits/archivos P5 sin perder cambios P6/P7. Resolver manualmente las tres rutas solapadas, preservando el jardín V3.3, los controles de P7, carga de assets y gates Android.
3. Verificar en el árbol candidato que están presentes los assets P5 (`galaxy-garden-world-v3.js/.css`, puente Bond y lifecycle), P6 (`galaxy-memories-v5.js/.css`) y P7 (`galaxy-more-v5.js/.css`), además de sus imports en `index.html`. Confirmar que la integración no duplicó listeners, estilos, navegación ni fuentes de verdad.
4. Incorporar el documento `P8_QA_CONSOLIDADA.md` de P5 y reconciliar `ROADMAP.md` sin sobrescribir las decisiones del 28/oct. Comparar pruebas P5/P6/P7 y mantener todas las aserciones obligatorias.
5. Fijar **SHA único inmutable** para la campaña. Ejecutar pruebas y capturas solo sobre ese SHA. Si una corrección lo modifica, invalidar la aceptación anterior y generar nuevo candidato; no trasladar resultados entre commits.
6. Mantener todo en DRAFT; las aprobaciones humanas, los required checks verdes y la política `BRANCH_POLICY.md` son requisitos independientes antes de cualquier merge, `qa`, `prod` o P9.

## Matriz única de QA Android (sin resultados inventados)

| ID | Escenario y criterio verificable | Variantes / evidencias requeridas | Estado |
| --- | --- | --- | --- |
| P8-01 | Integridad de árbol, rutas P5+P6+P7 y ausencia de conflictos | Diff y lista de assets/imports del SHA candidato | **PASS_SOURCE** en `f43e584` (solo árbol/JS; no es aceptación de APK) |
| P8-02 | Node completo, contratos, privacidad, sintaxis y build Android | Logs y JUnit con SHA idéntico; no heredar PASS histórico | **PARTIAL**: Node local `f43e584` 1016/1021, 0 FAIL, 5 SKIP; build CI del mismo SHA aún sin certificar |
| P8-03 | 15 workflows obligatorios / required checks sin bypass | Run IDs, conclusiones, artefactos y SHA candidato | **FAIL / IN_PROGRESS** en `f43e584`: Phase5 bloqueado por ZIP de SDK corrupto, otros checks pendientes; nunca heredar 12/15 del SHA anterior |
| P8-04 | Inicio, Mapa, Momentos, Recuerdos y Más en APK real | Capturas framebuffer nativo, navegación ida/vuelta | NOT_EXECUTED |
| P8-05 | 320, 360, 393 y 412 px; texto Android 135% | Portrait, landscape, teclado, insets, seis etiquetas inferiores, FAB | NOT_EXECUTED |
| P8-06 | Siete temas reales y automático | daylight, cosmic, halloween, christmas, valentine, friendship, easter; contraste/foco | NOT_EXECUTED |
| P8-07 | Accesibilidad | TalkBack, orden foco, 44–48dp, zoom, reduced motion | NOT_EXECUTED |
| P8-08 | P5 Jardín V3.3 0/3/8 y crecimiento | Estados verdaderos o fixtures rotulados; screenshots y marcador físico | NOT_EXECUTED |
| P8-09 | P5 cinco áreas inferiores | Gestos, juegos/citas, cartas/notas, rituales y voz; scroll y estados vacíos | NOT_EXECUTED |
| P8-10 | P6 álbum y multimedia | Foto/video/audio reales, carga/error/offline, navegación y privacidad | NOT_EXECUTED |
| P8-11 | P6 Drive y recuerdos | Estado auténtico, reconexión, filtros, calendario, duplicados sin borrado | NOT_EXECUTED |
| P8-12 | P6 cápsulas/constelación | No filtrar títulos/cuerpos/preview de cápsulas cerradas; fechas reales | NOT_EXECUTED |
| P8-13 | P7 privacidad y GPS | Batería/música por perfil; GPS activo/pausado; exportar y BORRAR con confirmación | NOT_EXECUTED |
| P8-14 | P7 identidad, re-render y deep links | Borrador, foco/caret, versión de servidor, cambio perfil, unpair y accesos rápidos | NOT_EXECUTED |
| P8-15 | P7 dispositivos y respaldos | Revocar solo otro dispositivo; restauración con manifiesto y confirmación | NOT_EXECUTED |
| P8-16 | P7 temas, push, permisos, widget y actualización | No confundir permiso con entrega; callback nativo y estados reales | NOT_EXECUTED |
| P8-17 | Regresión transversal | Chat, GPS/ETA, FCM, auth, arranque, permisos, offline, foreground/background | NOT_EXECUTED |
| P8-18 | Riesgos antiguos #173–#177 | Clasificar framebuffer/ADB vs defecto real con logs y artefactos | **PARTIAL**: errores funcionales de Chat vs caída AVD y ZIP corrupto distinguidos en reporte forense; captura real y fix definitivo no certificados |
| P8-19 | Aprobación visual humana independiente | Evidencia sanitizada del APK integrada, firma de aceptación | NOT_EXECUTED |

## Reglas de evidencias y bloqueo

- `PASS` requiere ejecución real y trazabilidad **al SHA exacto**. `NOT_EXECUTED`, `BLOCKED`, `INFRA_FAILURE` y `FAIL` nunca equivalen a éxito.
- Capturas y fixtures **sintéticos**: prohibido incluir fotos, coordenadas, mensajes, audio, tokens o datos reales privados. El backend sigue siendo autoridad para permisos y cápsulas.
- Hallazgos críticos de autenticación, privacidad, GPS, pérdida de datos o arranque se corrigen **de inmediato**, aunque se posponga el resto de AVD.
- Sin reintentos rutinarios de los tres jobs Android fallidos de P5. Revisión controlada solo durante P8 sobre el candidato, sin desactivar protecciones.
- El PR #203 original contiene **únicamente el plan**. La rama derivada #204 contiene integración P5+P6+P7 **sin pruebas finales ni APK candidata certificada**. No ejecutar P9 ni desplegar.
