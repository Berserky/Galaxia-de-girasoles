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

## P0: corrección de descarga Maven, sin bypass (29/oct/2026)

El commit anterior `78c748e` completó el workflow **Chat Correctness DB** con todos sus pasos SUCCESS, incluida la recuperación de puerto, ejecución SQL, concurrencia, `deno check` y rollback/reapply.

El workflow P0 `40838264708` terminó FAIL **antes de ejecutar Android** al descargar Maven desde `repo.maven.apache.org`: numerosos archivos POM devolvieron `HTTP 429 Too Many Requests`; `org.apache.httpcomponents:httpmime:4.5.6` fue la primera evidencia causal. No debe confundirse con pérdida del emulador ni con defecto de la app. `Node 24` y las 9 capturas de prototipo sintético sí pasaron; el job APK P0 no llegó a compilar.

Se actualizó **únicamente** `.github/workflows/visual-evolution-p0.yml`: la tarea original `assembleDebug` sigue siendo obligatoria, ahora ejecutada con `--max-workers=2` y hasta tres intentos espaciados (30/60 s) **solo si el log identifica errores transitorios de espejo (429/502/503, timeout o conexión reiniciada)**. Fallas normales de compilación salen inmediatamente sin repetirlas. `test "$built" -eq 1` mantiene el gate estricto si no se consigue APK. No se cambia la instrumentación real, PNG, `emulator-build` ni se agrega `continue-on-error`. El test contractual `P8 P0 transient Maven 429...` verifica que la compilación y el shell de capturas permanecen presentes.

**Estado:** contrato Node PASS, la eficacia de la recuperación Maven en Linux depende de nueva CI. Los fallos Android de Phase5 y Phase11 siguen sin ocultarse ni reinterpretarse.

## P6 álbum: error de imagen privada sin conexión ni pérdida de datos (29/oct/2026)

Se añadió un fallback seguro en `galaxy-memories-v5.js` para un problema real de WebView: la firma de una URL privada puede caducar después de obtener la lista de fotos, o el dispositivo puede quedarse sin conexión antes de cargar los bytes. El módulo ahora expone `albumImageFallback(image)`, que reemplaza **solo el botón de la miniatura fallida** o **solo el elemento <img> del visor** por un `role="status"` accesible con el texto «Foto no disponible. Revisa tu conexión y vuelve a abrir el álbum». Conserva los botones anterior/siguiente y cualquier confirmación previa a borrado. No modifica/elimina fotos, ni llama a la red, ni muestra rutas privadas ni URLs de firma. Las fotos de Chat, mapa y otros componentes no se intervienen.

En `app.js` el evento `error` de imágenes se escucha con `capture=true`, puesto que el fallo de carga de `<img>` no burbujea; no se introdujo HTML con `onerror` ni se relajó CSP. Se añadió altura mínima al mensaje del visor en `galaxy-memories-v5.css`.

**Pruebas locales del árbol no fusionado:** 10/10 casos del álbum PASS (6 históricos + 4 nuevos), incluyendo eventos de error simulados en miniatura y visor, fotos ajenas que no se tocan, ausencia de filtración de tokens/rutas, DOM accesible y cableado real de app. Suite Node íntegra **1049 total / 1044 PASS / 0 FAIL / 5 SKIP**; `qa-android-mobile` PASS. **P8-10 sigue PARTIAL**: hace falta comprobar el fallback en WebView de APK físico y la carga real de foto/video/audio con red, offline, permisos y caducidad efectiva. Esta prueba sintética de presentación no autoriza declarar el gate P8-10 aprobado.
