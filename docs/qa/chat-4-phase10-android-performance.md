# Galaxy Chat 4.0 — Fase 10: Android Performance

Base verificada: `origin/main@3ec7518b824fa196f8668ba987d2a5fc047cf338` (Merge Phase 9 Media Performance & Resource Loading). Rama: `perf/chat-4-phase-10-android`. No se despliega ni promueve producción estable.

## Cuellos Android y cambios

- El cleanup de temporales de cámara ejecutaba recorrido/borrado de disco desde `MainActivity.onCreate()`; ahora se difiere al executor de IO.
- El preview de audio usaba `MediaPlayer.prepare()` en UI thread; ahora usa `prepareAsync()` y libera player en pausa, low-memory y destroy.
- Cámara y selector multimedia inspeccionaban metadata y decodificaban bitmap de preview en UI thread; ambos caminos usan executor dedicado, generation guards y liberación explícita de `VideoView`/bitmap.
- WebView ahora tiene lifecycle explícito por instancia (`onPause/onResume`), renderer recovery, prioridad bound y cache normal. No se usan `pauseTimers/resumeTimers` porque congelan timers globales del proceso.
- El bridge mantiene un solo listener/origen permitido; `evaluateJavascript` descarta referencias WebView obsoletas.
- StrictMode queda disponible solo en debug y opt-in mediante `galaxy.strictMode`; detecta disk/network en main y leaked closables con `penaltyLog`, nunca `penaltyDeath`.
- Draft y outbox ya eran persistentes. Fase 10 añade persistencia acotada de metadata de adjuntos pendientes y elimina `url`/`thumbnailUrl` antes de guardar para no persistir signed URLs.
- `onTrimMemory` conserva el evento de presión a la capa web y libera preview nativo no esencial.

## Lifecycle, seguridad y bridge

- Rotación conserva MainActivity/WebView mediante la configuración existente; no se añadió recreación artificial.
- Background/foreground conserva estado, anchor y Delivery Engine existentes; no crea un canal Realtime adicional.
- `onRenderProcessGone` recupera un renderer muerto/liberado sin cerrar toda la app.
- Se mantienen file/content access deshabilitados, universal file access deshabilitado, mixed content bloqueado, Safe Browsing y allowlist de `appassets.androidplatform.net`.
- Cámara sigue ligada a lifecycle CameraX. Audio, video y bitmaps se liberan al salir/pausar/destruir.
- No se introducen WorkManager, foreground service, backend, polling ni retry paralelos nuevos.

## Cobertura y gates

- `tests/chat-4-phase10-android-performance.test.mjs`: 27/27 contratos verdes para los 25 escenarios obligatorios más seguridad WebView y StrictMode.
- Android local: `testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest` → BUILD SUCCESSFUL.
- Moto g75 5G: gate corto Phase 9 media + Phase 10 lifecycle/memory → 2/2 verdes.
- El benchmark de media fija 60 Hz solo durante la medición y restaura el ajuste al terminar. Sin ese control, Android había seleccionado 45 Hz y produjo 44.9 FPS con 0 frames >34 ms, exactamente el techo activo del panel.
- Recovery test destruye Activity/WebView y valida restauración de draft, outbox y adjunto pendiente; confirma que signed URLs no quedan en localStorage.
- Soak físico final: Moto g75 5G / Android 16, 30 minutos configurados (`phase10SoakMs=1800000`), 1/1 test aprobado; Gradle `BUILD SUCCESSFUL in 30m 25s`. El gate mantuvo la ventana de mensajes <=84, ejercitó lifecycle y presión de memoria durante la sesión y no reportó ANR/fallo de instrumentación.

El checkout Windows conserva dos fallos de test ya presentes en la base por CRLF/core.autocrlf (Phase 2 block matcher y `release-3.test.mjs`). Se verificaron contra el checkout limpio de Fase 9; el workflow Linux ejecuta la suite completa con LF.

## Profiling relevante

Fase 0 fijó warm open <500 ms, first messages <1.2 s cuando el entorno lo permite, scroll ~60 FPS, 0 saltos espontáneos y 0 bloqueos perceptibles. Fase 10 no cambia esos contratos ni aumenta la ventana virtual: 20.000 mensajes siguen renderizando como máximo 84 bubbles.

La validación física observa CPU/PSS, ventana renderizada, ciclos background/foreground, presión de memoria y frame pacing. No se aprueba crecimiento indefinido de memoria, ANR reproducible, suscripción Realtime duplicada ni trabajo pesado deliberado en UI thread.

## Cierre

La fase solo se mergea tras CI Linux/Android verde y gate físico completo. No inicia Fase 11 ni promueve una build estable.
