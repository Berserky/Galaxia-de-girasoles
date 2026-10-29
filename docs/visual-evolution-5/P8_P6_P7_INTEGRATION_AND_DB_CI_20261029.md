# P8 — Protección integrada P6/P7 y recuperación de CI de base de datos

**29-oct-2026 — PR #204 en DRAFT; no fusionar a desarrollo ni desplegar a qa/prod.**

## Causa forense y solución Chat Correctness DB

En el run oficial `40836021332`, SHA `28b82ae6b9348576a3d40e1538ddc0d3b2b8be1f`, el paso `supabase start` falló **antes de ejecutar SQL**: Docker no pudo reservar `0.0.0.0:54322/tcp` por estar ocupado. No se trató de una regresión demostrada de funciones de Chat ni de Bond.

El workflow `.github/workflows/chat-correctness-db.yml` ahora crea su configuración Supabase aislada, detecta un puerto libre del runner, lo fija en `supabase/config.toml`, exige que el cambio sea real, publica `QA_DB_URL` sólo para los pasos de ese job y hace que **los tests SQL, la prueba de concurrencia y el rollback + reapply usen la misma URL**. No elimina ninguna comprobación, no usa `continue-on-error` y conserva `supabase stop --no-backup` incluso al fallar.

El resultado CI real de esta nueva configuración **sigue pendiente de una nueva ejecución**. El puerto libre reduce el conflicto observado, pero no se certifica antes de probarlo con Docker.

## P6/P7: pruebas funcionales de seguridad integradas

Se añadió `tests/visual-evolution-p8-p6-p7-integrated-privacy.test.mjs` con **tres casos reales de funciones de presentación**:

1. Una cápsula con cuerpo, ruta de almacenamiento y categoría sintéticas secretas, pero título público, no debe filtrar esos secretos en **Descubrir, estantería de cápsulas, Historia, Constelación ni Filtros**. Los callbacks de detalle nunca reciben esa cápsula mientras `locked=true`.
2. Una sincronización Drive en estado `working`, `error` o sin recibo nunca debe presentarse como exitosa; un resultado parcial debe informar sus tres contadores reales sin convertir errores en éxitos.
3. P7 no debe permitir revocar el dispositivo actual, uno ya revocado ni otro que no pertenece al listado. Una revocación válida necesita contexto y confirmación **antes** del endpoint `device-revoke`.

**Suite local en el árbol modificado: 1044 tests, 1039 PASS, 0 FAIL, 5 SKIP.** `node scripts/qa-android-mobile.mjs` PASS y `git diff --check` PASS. Son contratos de UI, no pruebas de entrega real de Drive ni de revocación contra un servidor de producción.

## Lo que no queda aprobado por estas pruebas

La ejecución nativa anterior del SHA `28b82ae` probó **30/30 Android, 0 errores, 0 skips**; informe y XML local en `build/p8-local-avd/p8-final30-same-sha/`. La CI oficial terminó **14/18 verdes y cuatro fallos**: Chat Correctness DB (puerto ocupado), P0/Phase11/Phase5 (emulador `emulator-5554` perdido, incluyendo marcadores de framebuffer rechazados). El nuevo SHA cambiará sólo workflow/contratos/documentación y requiere nueva CI; no se hereda automáticamente el PASS de un SHA anterior.

Quedan sin certificar los escenarios P6/P7 que dependen de servicios externos (Drive auténtico, push, GPS, permisos específicos, borrado restauración efectivos), TalkBack completo y revisión humana visual. **P8 continúa abierto**.
