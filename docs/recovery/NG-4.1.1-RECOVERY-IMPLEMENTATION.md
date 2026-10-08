# NG-4.1.1 — Ejecución y validación de recuperación

**Nuestra Galaxia 4.1.1 — Fase 2/5** · 2026-10-08 · investigación sin cambios de código de producto.

Base: `desarrollo` @ `f5262991f3ab3fc65a6b39da2231915a453a9112`. Auditoría F1: [PR #113](https://github.com/Berserky/Galaxia-de-girasoles/pull/113) @ `60b46e3ad97a628ccbea066f0f3db2fe522d75ea` (draft, NO fusionado). La auditoría autoriza **solo comparación histórica no destructiva**; el gate de implementación/merge funcional/release permanece **NO GO**. 92 verificaciones F1: 31 PASS, 11 PARTIAL, 43 BLOCKED, 7 NOT TESTED; no extrapolar PASS parcial a módulos completos.

> Alcance honesto: inventario de **28 candidatos de recuperación evaluados por referencia y presencia de componentes**, no declaración de que las 80 etiquetas hayan sido auditadas una a una o de que las funciones respondan en E2E. Estado **PRELIMINAR / FASE 2 NO CERRADA**. Ninguna feature se recuperó ni se modificaron prod, qa, main, APK o datos personales.

## Estado real de cambios
- **Código productivo nuevo/modificado:** 0 archivos.
- **Recuperaciones implementadas:** 0; **recuperaciones funcionales validadas:** 0.
- **Migraciones, RLS, permisos, app, Android, assets/mobile, firmware/APK:** sin modificar.
- **Rama documental:** `docs/ng-4.1.1-phase2-legacy-recovery-20261008` creada desde el SHA anclado de desarrollo.
- **PR previsto:** documental draft, a `desarrollo`; mantener aislado mientras F1 PR #113 sigue abierto.

## Verificaciones realizadas en esta subfase
- Consulta remota GitHub de HEADs: desarrollo/qa/prod = `f5262991...` al iniciar la inspección, main = `8ab4f84...`.
- PR #113 de F1: draft y no fusionado, baseline y gate leídos, cuatro informes obtenidos.
- Árboles de 6 ramas legacy y árbol de desarrollo revisados; 80 tags existentes bajo `archive/2026-10-08/*` listadas y varias ramas archivadas de hogar/RPG verificadas.
- Diferencias de presencia de archivos y SHA del regalo original comprobadas; inspección puntual de módulos actuales y antiguos.
- No se ejecutaron nuevos builds/tests Android, ya que no se tocó producto y el gate funcional permanece cerrado.

## Evidencia PREEXISTENTE heredada de Fase 1 (no repetir como prueba propia F2)
- Suite Node de F1: **603/603 PASS** en baseline `f5262991`.
- CI RC run [37808030670](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/37808030670): 7 jobs SUCCESS; instrumentación 24 tests registrados / 2 CameraX SKIPPED; staging dos identidades OIDC VERIFIED con cleanup.
- APK 4.1.1 code38 onboarding AVD API35 offline PASS (alcance limitado); no certifica funciones de pareja con backend real.
- Matriz F1: 31 PASS, 11 PARTIAL, 43 BLOCKED, 7 NOT TESTED. Cero P0/P1 confirmados con su cobertura, pero **riesgos preventivos no despejados**.

## Bloqueos que impiden PR funcional
1. F1 PR #113 pendiente de fusión o cierre formal sin perder evidencia.
2. Falta de QA adversarial con identidades de dos parejas, datos sintéticos, revocación y RLS de medios/ubicación/tokens.
3. Casos CameraX físicos omitidos por emulador, FCM real y proveedor GIPHY/IA/música sin certificación E2E.
4. HTTP 503 histórico de push-client-config productivo no revalidado en F1, no afirmar corrección ni defecto actual.
5. No completado barrido semántico de 80 tags archivo; se trata de inventario preliminar, no recuperación exhaustiva.

## Criterio de reversión futuro
Cada propuesta posterior deberá limitarse a un módulo, fijar SHA base, evitar migraciones destructivas, contar con pruebas negativas, y revertir el commit/PR de forma aislada sin alterar datos persistentes ni la firma APK. Si se detecta P0/P1, detener integración y abrir hallazgo con reproducción.

## Registro de regresiones propio F2
**Regresiones nuevas comprobadas: ninguna**, ya que no se realizaron cambios ni E2E nuevos. No interpretar esta frase como ausencia de defectos. Hallazgos preexistentes: NG-AUD-001 (P2 entorno), NG-AUD-002/003 (P3) en PR #113.


## Segunda ejecución local de validación — 2026-10-08

Worktree autorizado `C:\\Users\\juans\\NG-RECOVERY-411` sobre rama de revisión local sin tocar ramas permanentes. `npm.cmd test` ejecutó **603 PASS / 0 FAIL** sobre los archivos de producto aún sin cambios. Se generó `docs/recovery/NG-4.1.1-ARCHIVE-80-LEDGER.md` mediante `node scripts/phase2-audit-archive.mjs` (80 refs inspeccionadas, 0 desajustes, 35 apariciones de rutas ausentes) y se agregó `tests/phase2-legacy-audit.test.mjs` con 3 verificaciones **PASS**: SHA de 80 tags, integridad de NG-LEG-001–028, y reglas de gate documentadas. Ejecutar suite global después de incluir las pruebas en el PR; publicar aquí el recuento real.

Se inspeccionó el inventario canónico de migraciones y el test de historia que prohíbe alias viejos. **No** se restauró ninguna SQL histórica. La compilación Android/emulador no se repitió porque ningún archivo funcional fue modificado, y la prueba física CameraX sigue pendiente de recursos de QA autorizados. Los resultados de F1 en CI se conservan como evidencia previa, no como pruebas nuevas de funcionalidades recuperadas.

**Estado de cierre:** entregables y rastreo documental de las 80 referencias completados. Recuperaciones funcionales **0**, por criterio de bloqueo de F1. No afirmar recuperación completa ni habilitar una release.
