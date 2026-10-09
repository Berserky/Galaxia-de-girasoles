# Fase 4 — Registro de implementación
**Estado: PARCIAL / preparación segura, no evolución funcional finalizada.** Base `6361e4f90a43cdc17ea002086ac69d4d83d8ac89`.

## Cambio implementado en esta entrega
- NG-AUD-002 (P3): corregida la referencia obsoleta de `main` en `android/README.md`. Documenta `desarrollo → qa → prod`, candidate en `qa` y stable manual desde `prod`.
- Nueva regresión de gobernanza `tests/ng-phase4-governance.test.mjs`: asegura que el README siga alineado con los workflows y no atribuya candidate a `main`.
- Registro de alcance, UX, rendimiento, regresión y readiness en `docs/evolution/`, sin confundir documentación con producto implementado.

## Cambios NO realizados
- **0** cambios funcionales en chat, cámara, música, mapas, objetivos, IA, notificaciones, Edge, DB o RLS.
- **0** recuperaciones NG-LEG; **0** updates NG-DEP adicionales; **0** cambios de APK, firma, versionCode o credenciales.
- No declarar resueltos NG-AUD-001/003 ni riesgos adversariales.

## Trazabilidad
| Referencia | Archivo | Evidencia de aceptación | Estado |
|---|---|---|---|
| NG-AUD-002 | android/README.md; tests/ng-phase4-governance.test.mjs | suite Node en PR, diff y workflow `qa` | IMPLEMENTADO / pendiente validación CI |
| NG-AUD-001 | — | AVD limpio y prueba de firma | PENDIENTE / se mantiene gate |
| NG-AUD-003 | — | capturas onboarding landscape | PENDIENTE |
| NG-FNC-007–009, 090–091 | — | pruebas RLS A/B y C/D | BLOQUEADO QA |
| NG-LEG-001–028 | — | clasificación F2; criterios de recuperación | NO RECUPERADO |
| NG-DEP-001,003–008 | — | matriz F3 | DIFERIDO |

El commit y el enlace del PR que contienen esta documentación son la fuente autoritativa de trazabilidad; deben registrarse al integrarse. No afirmar merge o checks verdes antes de observarlos.


## Evidencia posterior a la preparación inicial (2026-10-08)
El apartado «0 cambios funcionales» anterior describe **exclusivamente la entrega documental original PR #117**, no todo lo que se integró después en `desarrollo`.

- **NG-AUD-004 (GPS):** corrección limitada a cuatro políticas SELECT en migración nueva, PR #118 mergeado; prueba adversarial A/B miembros y C/D externos aprobada en DB local. **No desplegada a QA/PROD**; hallazgo activo en SQL efectivo hasta cambio autorizado.
- **NG-FNC-007/008/009 (invitaciones):** PR #120 mergeado; suite SQL transaccional ejercita expiración, replacement, replay, correo no verificado, asignación perfil 0/1; no sustituye pruebas deep-link reales Android.
- **Cámara (cobertura):** PR #119 mergeado; `CAMERAX_QA_EVIDENCE` confirmó foto y video `passed`, `reportFiles=1`, `requiredCameraCases=2`; no permite `SKIPPED` como éxito.
- **NG-AUD-003 (onboarding):** PR #121 abrió corrección CSS landscape y etiquetado accesible del código de vinculación, pendiente validación final e inspección visual a la fecha de esta nota.
- **Trazabilidad:** PR #113 de auditoría F1 también mergeado. Los documentos anteriores conservan su baseline de 92 funcionalidades y decisiones históricas.

Quedan **sin realizar** la regresión integral F4 por módulo, el staging real dual-user con credenciales QA, validación FCM/GPS/privacidad remota e informe de rendimiento comparativo. Ningún dato de pareja ni ambiente productivo fue modificado por estos PR.
