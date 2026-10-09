# Nuestra Galaxia 4.1.1 — Fase 4/5: alcance y backlog maestro
**Estado: PREPARACIÓN / NO GO para integrar cambios funcionales sensibles y para release.** Fecha: 2026-10-08. Base observada: `desarrollo` @ `6361e4f90a43cdc17ea002086ac69d4d83d8ac89`. Trabajo aislado en `chore/ng-phase4-scope-gates-20261008`. Este documento no constituye aprobación del producto ni de publicación.

## Evidencia de entrada
- F1: [PR #113](https://github.com/Berserky/Galaxia-de-girasoles/pull/113) **draft abierto**, commit `60b46e3`; 92 verificaciones = 31 PASS / 11 PARTIAL / 43 BLOCKED / 7 NOT TESTED; hallazgos reproducidos P0=0, P1=0, P2=1, P3=2. No interpretar BLOCKED como fallo ni PASS de contrato como E2E completo.
- F2: [acta de recuperación](../recovery/NG-4.1.1-PHASE2-HANDOFF.md): 80 referencias archivadas verificadas, 28 NG-LEG clasificados, 0 recuperaciones funcionales por gates pendientes.
- F3: [matriz](../dependencies/NG-COMPATIBILITY-MATRIX.md) y [changelog](../dependencies/NG-DEPENDENCY-CHANGELOG.md). PR #115 integrado; otras actualizaciones pospuestas por incompatibilidad/falta de cobertura.
- Los reportes F1 viven en un PR no fusionado, no asumir su presencia en `desarrollo`.

## Backlog priorizado (las prioridades preventivas NO son fallos demostrados)
| Orden | Referencia | Área / riesgo | Prioridad | Dependencia | Aceptación / prueba / regresión |
|---|---|---|---|---|---|
| G0 | PR #113, NG-AUD | Cerrar trazabilidad formal de F1 | Gate | revisión de auditoría | acta, matriz 92/92 y decisión de PR sin pérdida de evidencia |
| G1 | NG-FNC-007–009, 090–091 | Identidad, RLS, tokens, medios y parejas cruzadas | P0 preventivo | fixtures OIDC dos parejas distintas A/B y C/D, entorno QA aislado | permitir solo datos autorizados; rechazar acceso cruzado, token vencido/reutilizado, y revocación; guardar resultados sin datos privados |
| G2 | NG-FNC-011–023 | Chat, reintentos, scroll, delivery, sincronización | P1 preventivo | G1 | dos perfiles, online/offline, orden sin pérdida/duplicado, scroll/teclado; logs QA redactados |
| G3 | NG-FNC-025–035, 071–076 | CameraX, archivos, FCM | P1/P2 preventivo | G1 y dispositivo virtual con capacidad apropiada | pruebas capture/retake/cancel/permisos; FCM foreground/background; SKIPPED reportados |
| G4 | NG-FNC-046–053, NG-LEG-017–021 | GPS/ETA/batería | P1/P2 preventivo | G1, opt-in y GPS simulado | ETA coherente, revocación, privacidad y métricas con baseline |
| G5 | NG-FNC-036–042, 054–069 | Música, objetivos, IA, recuerdos | P2 | G1 y proveedor QA aprobado | pruebas por módulo de uso real; nunca exponer datos de pareja |
| G6 | NG-AUD-001 | Conflicto de certificados QA | P2 solo infraestructura | AVD fresco/sufijo QA | instalación limpia y upgrade con misma firma |
| G7 | NG-AUD-002 | README Android rama obsoleta | P3 | ninguna | alinear README con workflow qa/prod y prueba de regresión en PR aislado |
| G8 | NG-AUD-003 | CTA de onboarding landscape bajo pliegue | P3 | captura AVD con acceso a pantalla | viewport landscape con CTA/pista de scroll legible; screenshot y accesibilidad antes/después |
| G9 | NG-DEP-001,003–008 | Dependencias diferidas | P2 mantenimiento | compatibilidad + CI específico | no fusionar sin checks de SDK, Gradle, Android instrumentation y proveedor |

## Reglas de ejecución
1. Rama temporal desde el último SHA de `desarrollo`; PR pequeño hacia `desarrollo`, CI y revisión antes de integrar. Sin pushes directos a ramas protegidas.
2. P0/P1 solo se declaran **confirmados** con reproducción. Detener integraciones si aparecen regresiones bloqueantes. No tocar datos personales ni crear credenciales de producción.
3. Regresión obligatoria con identidades QA efímeras y cleanup, Node/Deno/Android cuando aplique; distinguir emulador de dispositivo físico.
4. Priorizar pruebas G0–G4 antes de modernizaciones decorativas. Hogar/RPG/tienda (NG-LEG-024–026) no son iniciativas aprobadas.
5. `qa`, `prod`, `main`, stable Android y versionCode quedan intactos durante F4.

## Exclusiones actuales
No reemplazar motor de chat, rehacer app, recuperar SQL antigua, instalar dependencias incompatibles, promover APK, activar proveedores pagos o borrar capacidades existentes. Ningún P0/P1 ha sido confirmado en F1.
