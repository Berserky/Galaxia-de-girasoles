# NG-DEFERRED-UPDATES — Deuda justificada y pasos siguientes
Fecha: 2026-10-08. Las actualizaciones pendientes NO se interpretan como descartadas, seguras por defecto ni obsoletas.

| NG-DEP | PR | Postergación/bloqueo exacto | Combinación compatible conservada | Ruta segura siguiente | Impacto de posponer |
|---|---:|---|---|---|---|
| 001 | #75 | workflow publica Pages solo manualmente; prueba de publish prohibida en fase | deploy-pages v4 | QA del workflow en PR, prueba aislada sin publicación y después autorización de release | conserva versión actual de despliegue |
| 003 | #77 | failures instrumentación/stress en head histórico | setup-java v5, JDK 17 | distinguir flake vs regresión, reejecutar Android QA y lint en base actual | se retrasa runtime de acción |
| 004 | #78 | checkDebugAarMetadata: AndroidX Core 1.19.1 requiere compileSdk37 y proyecto usa 36 | androidx.core 1.17.0 / compileSdk36 | evaluar PR separado de compileSdk37 (target36 conservado), unit/lint e instrumentación Media/WebView | minor no adoptada hasta migración SDK compatible |
| 005 | #79 | AGP 9.4.1 requiere Gradle >=9.6.0, actual CI=9.4.1 | AGP 9.2.0 / Gradle 9.4.1 | PR conjunto controlado Gradle>=9.6 y AGP 9.4.1, verificar JDK 17, build+emulador | herramienta anterior aunque compatible |
| 006 | #80 | instrumentación Android falla; background de WorkManager es relevante | WorkManager 2.11.2 | reproducir tests lifecycle/background/gestos, permisos, revocación | correcciones minor sin adoptar |
| 007 | #81 | instrumentación Android falla; nueva acción cambia infraestructura de cache/build | setup-gradle v4 / Gradle 9.4.1 | inspección changelog upstream, build/lint/instrumentación sobre rama aislada | no se adopta action major |
| 008 | #82 | head histórico no resolvió endpoint check-runs, falta verificación | checkout v5 | actualizar referencia, comparar el diff real, validar permisos/runtime/CI | se retrasa action major |

NG-DEP-002 (#76) **INTEGRADO POR REEMPLAZO**: PR #115 fusionado a `desarrollo` (`0bab4e1`) con 7/7 checks SUCCESS, cambios equivalentes verificados (8 referencias/7 archivos). PR #76 cerrado con comentario de trazabilidad; ninguna otra actualización debe cerrarse sin verificación de su reemplazo o bloqueo.

## Riesgos de producto independientes
El documento F2 `docs/recovery/NG-4.1.1-PHASE2-HANDOFF.md` autoriza solo estabilización aislada, no QA/prod. PR #113 conserva el diagnóstico F1 como borrador y 43 BLOCKED + 7 NOT TESTED. No autorizar integración funcional sensible, migraciones, ni release por el hecho de haber auditado dependencias. Casos inaplazables: aislamiento entre parejas/RLS, invitación y revocación, FCM, CameraX y GPS.
