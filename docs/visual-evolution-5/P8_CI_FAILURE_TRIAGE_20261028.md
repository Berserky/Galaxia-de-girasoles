# P8 — Auditoría de CI y estabilidad del emulador (28-oct-2026)

## Ejecución oficial investigada

- PR en borrador [#204](https://github.com/Berserky/Galaxia-de-girasoles/pull/204), rama `feat/visual-evolution-5-p8-integration-p5-20261028`, **SHA probado en GitHub:** `2aa68838b16431db4daa4d03d05818b49a206b63`.
- **15 workflows terminados: 12 SUCCESS, 3 FAILURE**. Android unit + lint + release build: **SUCCESS**; test Node 24 y tests estáticos: **SUCCESS**.
- Fallos exclusivos de jobs de emulador Android (no equivale a tres fallos de compilación):

| Workflow | Job que falló | Observación exacta |
|---|---|---|
| QA Phase 5 Real Integration | Android instrumentation + lifecycle | Una prueba de selector del sistema no encontró la marca pintada en el framebuffer real; otra prueba de navegación/Chat agotó el plazo. Se interrumpió la prueba P5 al quedar el emulador offline (`device 'emulator-5554' not found`). |
| Galaxy Chat 4 Phase 11 Torture | Android stress matrix | Agotó el plazo para abrir Chat desde navegación; después el emulador se desconectó durante instrumentación |
| V5 P0 baseline and synthetic visual preview | AVD QA unpaired APK | El emulador desapareció antes de concluir la prueba de Momentos; 79 capturas no pudieron transferirse. La demostración Chrome de nueve imágenes sintéticas pasó, **no es evidencia real de APK** |

## Cambios de resiliencia aplicados al candidato

1. **Sin falsos PASS:** conservar `connectedDebugAndroidTest`, la puerta real de capturas y sus fallos explícitos; no desactivar pruebas ni dar por válidos los screenshots sintéticos.
2. **AVD acotado:** incluir `-memory 3072 -no-snapshot` en los tres workflows. Hipótesis de estabilidad, **aún sin confirmar**; un resultado del SHA anterior no verifica este ajuste.
3. **Evidencia si falla:** ejecutar `scripts/p8-emulator-diagnostics.sh` únicamente en failure, antes de subir artefactos. Guardar RAM/disco, procesos por nombre y RSS, estado ADB y boot; jamás secretos, argumentos de procesos, mensajes, ubicación o credenciales.
4. **Menor presión gráfica:** reducir `takeScreenshot()` del guard de pintura de una iteración cada 200 ms a 500 ms, manteniendo el plazo de 15 segundos, el umbral de 20 píxeles cian y dos fotogramas reales consecutivos. No sustituir por validación DOM.
5. **Ruta de Chat verificable:** el helper Android debe activar el `#chatFab` auténtico y esperar que aparezca Chat; no saltarse el control con `go('chat')`. En fallos sólo registrar ruta genérica, existencia/visibilidad del FAB y bandera de capacidad Chat, nunca contenido privado.

## Pendientes obligatorios

- Repetir los checks oficiales **sobre el nuevo SHA final**. Si algún job falla, diagnosticar con los artefactos y corregir sólo la causa, sin omitir test o usar `continue-on-error`.
- No afirmar que la desconexión se explica únicamente por memoria: hay errores de interacción previos que requieren evidencia funcional.
- P8 sigue condicionado a APK instrumentado, recorridos de accesibilidad y 19 escenarios consolidados, revisión de las capturas reales y aprobación humana.
- **No se ha hecho merge ni promoción a `desarrollo`, `qa` o `prod`.**

## Segunda ronda y corrección focalizada del acceso a Chat

- SHA histórico **`4ccc48e22e43b65f752eee64d49fae21f7f77e3e`**: **11/15 workflows SUCCESS; 4 FAILURE**. Las cuatro fallas son las tres instrumentaciones AVD anteriores y `Galaxy Chat 4 Phase 9 Media Performance`; Node 24 y compilación Android pasan.
- En los registros de esta ronda `chatPhase9` y `chatPhase4` agotaron el callback WebView de 5 segundos durante `#chatFab.click()`; `dailyGoals...` seguía en `view='more'` tras 30 segundos. No confundir estos fallos de interacción con una desconexión del emulador.
- La tercera ronda propuesta no desactiva la entrada original, ningún permiso ni screenshot. Se agregó `chatOpenPending` para impedir aperturas duplicadas; sólo tras desbloqueo del dispositivo se cede un cuadro de ejecución (16 ms) antes de construir el Chat completo. El handler vuelve a comprobar autenticación, capacidad Chat y si el usuario cambió de pantalla. Las pruebas Node verifican clic concurrente, rechazo de biometría, desvinculación y navegación mientras espera.
- Tres workflows AVD pasan de `-memory 3072` a `-memory 1536` manteniendo `-no-snapshot`, con el objetivo de dejar memoria al runner para Gradle y gráficos. **Hipótesis, no arreglo demostrado**: revisar emulador y artefactos antes de declarar PASS. No se añade `continue-on-error`.
- Node Windows del nuevo árbol local: **1.021 tests: 1.016 PASS / 0 FAIL / 5 SKIP**, QA móvil estática PASS, con tests de click seguro `tests/visual-evolution-p8-chat-open.test.mjs`. Estas cifras no certifican el runtime Android.

**Regla:** el resultado 11/15 del SHA `4ccc48e` se mantiene como fallo histórico hasta que todos los checks necesarios de un SHA posterior se ejecuten y pasen. No promoción, no merge, no release.

## Tercera ronda y hallazgo de descarga SDK

- SHA `f43e584463056665fb488fb1eaa552afa174d040`: el job Phase 5 falló en el paso **Preparar Android SDK**, antes de iniciar Gradle/instrumentación, debido a `Error reading Zip content from a SeekableByteChannel` mientras descargaba el paquete Android Emulator. Es una incidencia observable del repositorio remoto de SDK; **no corresponde a un test de la app**.
- Se preparó recuperación acotada con 3 intentos, validación estricta `sdk_ok=1` y mensajes de advertencia. Se agrega el mismo patrón a los jobs de emulador Phase11 y Phase9 para disminuir interrupciones por ZIP corruptos; P0 ya contaba con política de reintentos.
- AVD de los tres workflows con mayor incidencia de pérdida de `emulator-5554` usa ahora `swiftshader_indirect`, `-memory 1536`, `-no-snapshot`, alineando el perfil gráfico/software con otros jobs Android del repositorio. **Aún no comprobado en GitHub**, sin retirar captura de framebuffer ni instrumentación.
- Nueva prueba de contrato: cada SDK sigue siendo obligatorio y un tercer error impide declarar verde el job. No se marca `FAIL` como `SKIP`.

## Verificación local del ajuste SDK / GPU antes de publicar nuevo SHA

- `npm.cmd test`: **1.022 tests, 1.017 PASS, 0 FAIL, 5 SKIP**.
- `node scripts/qa-android-mobile.mjs`: **PASS**.
- `git diff --check`: **PASS**.
- Los workflows Phase5, Phase11 y Phase9 reintentan `sdkmanager` 3 veces, pero **fallan** después de la tercera descarga defectuosa. La regla no convierte un bloqueo en éxito.
- Los tres jobs históricos con pérdida del framebuffer cambian a `-gpu swiftshader_indirect -memory 1536 -no-snapshot` por consistencia con otros jobs Android; las pruebas instrumentadas y capturas reales son obligatorias.
- **Esta verificación es solo local.** La ejecución Android/CI del SHA posterior sigue pendiente y define la admisión de P8.

## Triage con evidencia JUnit y logcat del SHA 6042f4d

- GitHub CI del **SHA `6042f4d7b996289b1cd7c02f3a1a269577bc9195`** concluyó con **12/15 SUCCESS y 3 FAILURE**: Phase5 Android, Phase11 Android stress y V5 P0 AVD.
- Evidencia específica: artefacto `qa-phase5-android-device-closure` (GitHub artifact **12847105556**), XML de JUnit y `qa-artifacts/logcat-live.txt`.
- El fallo `dailyGoalsPlansEventsCapsulesMapContextBackupAndUpdate_areReachable` fue en **línea 1642**, **antes de llamar `launchChat()`**. La aserción buscaba `Copia de nuestra galaxia` en `document.body.innerText`; P7 ahora pone esa sección dentro de `details[data-group=backups]` **colapsado**. Lo mismo aplica al grupo `system` para Actualizaciones. Corregido el test para navegar a Más, abrir ambos grupos auténticos con `GalaxyMoreV5.revealGroup` y exigir los controles existentes. **No se cambió el runtime de Chat para este problema.**
- La desconexión del `emulator-5554` sigue pendiente: el logcat registra cierres/recreaciones de renderers WebView durante tests (no demuestra por sí solo fallo de la app ni OOM). MemAvailable del host al finalizar ≈12,4 GB y no hay señal OOM en el artefacto, por lo que **la hipótesis de RAM es insuficiente**.
- Para la prueba P5 se agregaron marcadores Android `NG_P8_VISUAL` sin datos privados, antes/después de montar Momentos y por viewport de 320/360/393/412. El script P0/P1 conserva estos marcadores en un artefacto aunque el emulador desaparezca. **No se ha quitado ninguna comprobación de píxeles, JUnit, privacidad, 135% ni de 7 temas.**

**Estado:** corrección del falso negativo de P7 verificada por contratos Node; falta repetir instrumentación Android y recuperar todas las capturas nativas en el SHA nuevo. No confundir logs guardados con un resultado PASS.
