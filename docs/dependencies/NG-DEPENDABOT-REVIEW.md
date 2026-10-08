# NG-DEPENDABOT-REVIEW — Evaluación individual #75–#82
Fecha 2026-10-08. Referencia base: desarrollo @ 86a12d7. Todos los PR #75–#82 seguían OPEN, base desarrollo, merged=false, y `mergeable=false` en la lectura de GitHub. Ninguno fue fusionado automáticamente. Las calificaciones son decisiones para la base actual; CI histórico no valida una combinación nueva de versiones.

| ID | PR | Dependencia | Actual → propuesta | Tipo | CI observado del head original | Decisión |
|---|---:|---|---|---|---|---|
| NG-DEP-001 | #75 | actions/deploy-pages | 4 → 5 | Major | qa SUCCESS; publish SKIPPED | POSPONER (publicación histórica solo manual) |
| NG-DEP-002 | #76 | actions/setup-node | 5 → 6 | Major | 9/9 checks SUCCESS en head previo | APTO PARA ACTUALIZAR en PR aislado con CI nuevo |
| NG-DEP-003 | #77 | actions/setup-java | 5 → 6 | Major | compilaciones SUCCESS; instrumentación y stress FAILURE | REQUIERE ADAPTACIÓN/VALIDACIÓN |
| NG-DEP-004 | #78 | androidx.core:core | 1.17.0 → 1.19.1 | Minor | build FAILURE; instrumentación FAILURE | POSPONER |
| NG-DEP-005 | #79 | Android Gradle Plugin | 9.2.0 → 9.4.1 | Minor | múltiples Android build/lint FAILURE | BLOQUEADO POR INCOMPATIBILIDAD |
| NG-DEP-006 | #80 | androidx.work:work-runtime | 2.11.2 → 2.12.0 | Minor | Android builds SUCCESS; instrumentación FAILURE | POSPONER |
| NG-DEP-007 | #81 | gradle/actions/setup-gradle | 4 → 6 | Major | la mayoría SUCCESS; instrumentación FAILURE | REQUIERE ADAPTACIÓN/VALIDACIÓN |
| NG-DEP-008 | #82 | actions/checkout | 5 → 7 | Major | head SHA histórico no consultable en endpoint check-runs (422) | POSPONER hasta revalidación |

## Hallazgos, prerequisitos y pruebas
- **NG-DEP-001**: Pages solo se activa por workflow_dispatch; no usar el despliegue para validar fase de dependencias. Exigir prueba del job de QA en PR y smoke manual NO productivo antes de autorizar; el step de publicación debe permanecer inactivo.
- **NG-DEP-002**: el nombre histórico de rama de #76 contiene 'setup-node-7', pero título y diff reales aplican **5→6**. Se seleccionó el diff equivalente en 7 archivos de workflows desde desarrollo actualizado. package.json no declara packageManager ni caché implícita habilitada por ese campo. Preservar Node 24, permisos y scripts originales. La verificación previa de 9 checks verdes es evidencia contextual, **no cierre de nueva rama**.
- **NG-DEP-003**: Temurin 17 permanece soportado en setup-java@v6 (upstream); investigar failures de instrumentación/stress y separar flakes de regresiones antes de tocar Android release workflows.
- **NG-DEP-004**: incremento minor AndroidX; CI muestra build/instrumentación fallidos, no clasificar como aprobado sin logs, compilación, lint, WebView/media y pruebas de regresión.
- **NG-DEP-005**: AGP 9.4 requiere **Gradle mínimo 9.6.0** (documentación Android Developers); el proyecto CI fija **Gradle 9.4.1**. El diff de #79 solo cambia AGP: combinación incompatible y explica un bloqueo reproducible de configuración, aunque no se analizaron logs línea a línea. Migración conjunta AGP + Gradle 9.6 (o superior compatible) en otro PR, con JDK 17, CI y emulador, nunca combinar directamente este PR.
- **NG-DEP-006**: WorkManager es crítico para tareas background/widgets/gestos; fallo de instrumentación impide certificación. Revalidar lifecycle, doze, scheduling, revocación y notificaciones.
- **NG-DEP-007**: update de acción del runner, no de distribución Gradle; verificar cambios de caché/seguridad de cadena de suministro, ejecutar matriz Android y estabilizar instrumentación antes de adoptar.
- **NG-DEP-008**: no asumir versión 7 aprobada por nombre de rama y title. Comparar head vigente, disponibilidad de commit, Node/runtime del runner y permisos; regenerar PR si resulta obsoleto.
  
## Fuente y criterio de seguridad
Revisión de metadatos y diffs de GitHub para cada PR; checks obtenidos por commit /check-runs con conclusiones individuales; referencia compatibilidad: https://developer.android.com/build/releases/about-agp y https://developer.android.com/build/releases/agp-9-4-0-release-notes. Para acciones consultar sus READMEs oficiales. No se ha confirmado ningún CVE específico por esta revisión, ni se presume que el resto esté libre de vulnerabilidades. Mantener todas las ramas y PR originales hasta decidir con evidencias actuales.
