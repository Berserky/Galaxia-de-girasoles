# NG-SECURITY-ASSESSMENT — Dependencias y cadena de suministro
Fecha: 2026-10-08. Revisión limitada a manifiestos/CI/diffs y estado de checks GitHub; no lectura de secretos ni datos reales.

## Hallazgos
| ID | Componente | Riesgo comprobado / incertidumbre | Gravedad operativa | Acción |
|---|---|---|---|---|
| SEC-DEP-01 | AGP 9.4.1 sobre Gradle 9.4.1 | configuración oficialmente incompatible (requiere Gradle >=9.6) | ALTA disponibilidad CI | bloquear PR #79, plan de actualización coordinada |
| SEC-DEP-02 | WorkManager y AndroidX Core | CI de PR #78/#80 incluye failures de instrumentación; no atribuir sin logs | ALTA en regresión Android | posponer, realizar tests de permisos, background, identidad y media |
| SEC-DEP-03 | GitHub Actions major updates | potenciales cambios de runtime, permisos, cache y confianza | MEDIA | lotes aislados, permitir sólo CI verificado, documentar hashes |
| SEC-DEP-04 | Supabase JS/npm import Edge | fijado a versión directa 2.117.2, resolución transitiva no auditada | DESCONOCIDA | resolver grafo / escáner SCA y comparar lock reproducible |
| SEC-DEP-05 | Dependencias Gradle transitivas | no existe SBOM resuelta a partir de esta inspección | DESCONOCIDA | Gradle dependencies + escáner de composición |
| SEC-DEP-06 | FCM/media/ubicación | privacidad y permisos relevantes y dependencia de servicios externos | ALTA funcional | datos sintéticos y aislamiento RLS, no enviar tokens a logs |
| SEC-DEP-07 | Falta evidencia E2E crítica F1 | 43 BLOCKED, 7 NOT TESTED y 11 PARTIAL en diagnóstico F1 | CRÍTICA para promoción | preservar NO GO de lanzamiento |
| SEC-DEP-08 | GitHub Dependabot alerts/Advisories | endpoint de alertas no consultado; vulnerabilidades conocidas no enumeradas | INDETERMINADA | revisar en Security > Dependabot con acceso adecuado y registrar CVE/GHSA, impacto de paths y versiones |

## Controles
1. Las variables de firma, FCM y keys privadas no se modificaron ni se volcaron a documentos. Las claves *publishable* no equivalen a secreto, pero tampoco se reproducen en este reporte.
2. Nunca dar por remediado un CVE por cambio de versión sin prueba del código efectivo y dependencias transitivas.
3. No ejecutar migraciones sobre Supabase productivo, ni deploy Edge/Pages/Android Stable como prueba de una actualización.
4. Los tests adversariales RLS con dos parejas sintéticas, revocación/invitaciones, cámara y background siguen siendo un gate independiente.
5. Mantener permisos mínimos de GitHub Actions, revisar scripts remotos, pin de commits y publisher oficial; cambios de major deben evaluarse con diff real.
6. Cualquier alerta crítica explotable en dependencias productivas no mitigada bloquea cierre de fase, incluso si el PR documental está verde.

## Estatus de vulnerabilidades
**No cuantificado / no verificado**, no equivale a cero CVE. No hay un informe SCA de transitivas ni un listado autorizado de GitHub Dependabot alerts en esta ejecución. Este reporte identifica riesgos y una incompatibilidad concreta, no certifica ausencia de exposición.
