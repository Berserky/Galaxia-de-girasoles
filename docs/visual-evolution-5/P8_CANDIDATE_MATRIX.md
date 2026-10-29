# Visual Evolution V5 — P8: matriz de candidatura integrada (preflight)

> **CORTE OPERATIVO 29/oct/2026 — PR #204 DRAFT / P8 INCOMPLETO.** Integracion P5+P6+P7 en rama unica. El SHA 244148f cerro 12/15 workflows oficiales; tres fallaron en AVD Linux. Android local verifico 28/28 JUnit (24 Closure + 3 Media + 1 Voice), 21 capturas P5/P6/P7 y, posteriormente, 0/8 girasoles con 1/1 JUnit y 2 capturas adicionales. La expansion tras ocho flores, accesibilidad integral, casos sensibles P6/P7 y aprobacion visual siguen pendientes. No heredar PASS entre SHA ni fusionar o desplegar.


**Corte:** 28-oct-2026. **Estado actual:** `P8 EN EJECUCIÓN / NO CERTIFICADO`. Se adjunta evidencia local real de **Momentos P5 en APK Android**, junto con progresos de fuente y Node; **no certifica los 19 escenarios, una UI integrada aprobada ni release**. Ver `P8_LOCAL_VALIDATION_20261028.md` y `P8_CI_FAILURE_TRIAGE_20261028.md` para logs por SHA.

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
| P8-01 | Integridad de árbol, rutas P5+P6+P7 y ausencia de conflictos | Diff y lista de assets/imports del SHA candidato | **PASS_SOURCE**: integración P5/P6/P7 verificada en árbol 68b49d1; no equivale a QA funcional |
| P8-02 | Node completo, contratos, privacidad, sintaxis y build Android | Logs y JUnit con SHA identico; no heredar PASS historico | **PARTIAL**: SHA 244148f Node 1034 (1029 PASS, 0 FAIL, 5 SKIP), Android 28/28 PASS local; nuevo test de jardin 0/8 PASS aislado, aun sin validar el SHA final completo |
| P8-03 | 15 workflows obligatorios / required checks sin bypass | Run IDs, conclusiones, artefactos y SHA candidato | **FAIL**: CI SHA 244148f cerro 12/15 SUCCESS y 3 FAIL en AVD (Phase5, Phase11, V5 P0); evidencia local no modifica checks oficiales |
| P8-04 | Inicio, Mapa, Momentos, Recuerdos y Más en APK real | Capturas framebuffer nativo, navegación ida/vuelta | **PARTIAL**: recorrido Mapa/Momentos/Recuerdos/Más y capturas Android P5 + P6/P7; validación transversal completa pendiente |
| P8-05 | 320, 360, 393 y 412 px; texto Android 135% | Portrait, landscape, teclado, insets, seis etiquetas inferiores, FAB | **PARTIAL**: P5 físico 4 tamaños + 4 zoom 135% con capturas y JUnit PASS local; landscape, teclado y otras secciones pendientes |
| P8-06 | Siete temas reales y automático | daylight, cosmic, halloween, christmas, valentine, friendship, easter; contraste/foco | **PARTIAL**: 7 PNG reales Android P5 en temas, hashes distintos; tema automático, contraste, foco y secciones completas pendientes |
| P8-07 | Accesibilidad | TalkBack, orden foco, 44–48dp, zoom, reduced motion | **PARTIAL**: targets 44px y WebView 135% en P5 Android PASS; TalkBack, reduced motion y orden de foco pendientes |
| P8-08 | P5 Jardin V3.3 0/3/8 y crecimiento | Estados oficiales o fixtures rotulados; screenshots y marcador fisico | **PARTIAL**: etapas 0 y 8 verificadas en Android real con 1/1 JUnit y 2 PNG; etapa 3 validada anteriormente. Falta verificar expansion posterior a los 8 girasoles y aprobacion visual integral |
| P8-09 | P5 cinco áreas inferiores | Gestos, juegos/citas, cartas/notas, rituales y voz; scroll y estados vacíos | **PARTIAL**: 8 acciones/3 rituales, voz duración desconocida y secretos ausentes comprobados en P5 local; interacciones y vacíos aún pendientes |
| P8-10 | P6 álbum y multimedia | Foto/video/audio reales, carga/error/offline, navegación y privacidad | NOT_EXECUTED: álbum multimedia real, offline y permisos pendientes; hub Recuerdos no sustituye prueba de multimedia |
| P8-11 | P6 Drive y recuerdos | Estado auténtico, reconexión, filtros, calendario, duplicados sin borrado | **PARTIAL**: Recuerdos Descubrir/Colecciones/Historia y datos de calendario QA en Android con tres capturas; Drive/sincronización real pendientes |
| P8-12 | P6 cápsulas/constelación | No filtrar títulos/cuerpos/preview de cápsulas cerradas; fechas reales | **PARTIAL**: cápsula QA sellada accesible en test transversal y secretos P5 ausentes en DOM; constelación y fechas reales pendientes |
| P8-13 | P7 privacidad y GPS | Batería/música por perfil; GPS activo/pausado; exportar y BORRAR con confirmación | **PARTIAL**: panel Privacidad P7 real visible, compartir batería/escucha/GPS sin cambios al navegar; GPS y borrado efectivo pendientes |
| P8-14 | P7 identidad, re-render y deep links | Borrador, foco/caret, versión de servidor, cambio perfil, unpair y accesos rápidos | **PARTIAL**: deep link a privacidad y foco Android PASS; perfiles, borradores y unpair completos pendientes |
| P8-15 | P7 dispositivos y respaldos | Revocar solo otro dispositivo; restauración con manifiesto y confirmación | **PARTIAL**: panel Respaldos real y exportación/restauración hermética QA PASS; revocación y restauración productiva pendientes |
| P8-16 | P7 temas, push, permisos, widget y actualización | No confundir permiso con entrega; callback nativo y estados reales | **PARTIAL**: 7 temas P5 físicos, permisos y Sistema/Actualizar P7 visibles; entrega push, widget y actualización efectiva pendientes |
| P8-17 | Regresion transversal | Chat, GPS/ETA, FCM, auth, arranque, permisos, offline, foreground/background | **PARTIAL**: 28/28 metodos Android PASS, EXACTLY_ONCE en SHA 244148f local. Nuevo test 0/8 PASS focal; faltan nueva cobertura consolidada del SHA final y pruebas E2E externas que la bateria no cubre |
| P8-18 | Riesgos antiguos #173–#177 | Clasificar framebuffer/ADB vs defecto real con logs y artefactos | **PARTIAL**: crash QEMU Windows 0xc0000005 confirmado en GPU software, P5 host GPU PASS, CI Linux aún falla; ver triage |
| P8-19 | Aprobación visual humana independiente | Evidencia sanitizada del APK integrada, firma de aceptación | NOT_EXECUTED: 21 capturas QA reales disponibles en PC, aprobación visual humana independiente pendiente |

## Reglas de evidencias y bloqueo

- `PASS` requiere ejecución real y trazabilidad **al SHA exacto**. `NOT_EXECUTED`, `BLOCKED`, `INFRA_FAILURE` y `FAIL` nunca equivalen a éxito.
- Capturas y fixtures **sintéticos**: prohibido incluir fotos, coordenadas, mensajes, audio, tokens o datos reales privados. El backend sigue siendo autoridad para permisos y cápsulas.
- Hallazgos críticos de autenticación, privacidad, GPS, pérdida de datos o arranque se corrigen **de inmediato**, aunque se posponga el resto de AVD.
- Sin reintentos rutinarios de los tres jobs Android fallidos de P5. Revisión controlada solo durante P8 sobre el candidato, sin desactivar protecciones.
- El PR #203 original contiene **únicamente el plan**. La rama derivada #204 contiene integración P5+P6+P7 **sin pruebas finales ni APK candidata certificada**. No ejecutar P9 ni desplegar.
