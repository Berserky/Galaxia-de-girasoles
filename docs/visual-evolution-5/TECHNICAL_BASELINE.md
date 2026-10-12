# Visual Evolution 5.0 — baseline técnico auditado

**Fecha:** 2026-10-12. **Alcance:** lectura estática de árbol, archivos y documentación de GitHub, más capturas Android compartidas por el usuario; **no** compilación ni ejecución de suite durante esta preparación. **Fuente estable:** `prod@fde141d4c8e7622ac1d6f10f1abbfbda8e8e7d0c`, igual a `qa` al momento de consulta. Gradle de `prod`: **4.1.2 / versionCode 39**, package `com.nuestragalaxia.companion`. Default branch: `prod`. `desarrollo@15d196a4204a9dc435e31c29a94455d927c0d4d3` estaba 8 commits detrás de `prod` (comparación prod...desarrollo: behind, ahead=0). No asumir que `main` representa el APK actual.

## Regla esencial de arquitectura

**Android real = interfaz local Android WebView + puente Java + Edge Supabase**. Una edición de `app/public` sola no actualiza necesariamente el APK. La UI que muestran las capturas vive en:

- `android/app/src/main/assets/mobile/index.html`: host WebView, `#app`, `#bottomNav`, `#chatFab`, dialog `#modal`, `#toast`, reproductores y cargas de módulos JS.
- `android/app/src/main/assets/mobile/app.js`: renderizador JavaScript/HTML, routing por `view`, servicios, acciones de usuario y vistas. Revisión estática: aprox. 3462 líneas / 365 declaraciones de funciones. NO es React, no introducir otro framework sin aprobación técnica.
- `android/app/src/main/assets/mobile/app.css`: sistema visual y estilos de vistas (aprox. 1618 líneas); tokens `--bg`, `--surface`, `--surface2`, `--text`, `--muted`, `--accent`, `--border`, etc.; múltiples media queries y `prefers-reduced-motion` existentes. **Extender tokens, no hardcodear temas**. Cuidar CSS/JS no modularizados y efectos de render global.
- `android/app/src/main/assets/mobile/theme.js`: elección de paletas; `GalaxyTheme.applyTheme/getChoice` y sincronía con `GalaxyNative.setSystemTheme` desde `app.js`.
- `android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java`: WebView/Android, permisos, multimedia, picker, actualización, bridge y lifecycle.
- `android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java`: métodos del puente expuestos a JS. No exponer tokens ni cambiar contrato sin QA.
- `supabase/functions/android-companion/index.ts`: API móvil, identidad por dispositivo, contratos y protección de datos. Archivos `*-engine.ts`, `push-engine.ts`, `intelligence-*.ts` auxiliares. Cambios **no** autorizados para una modernización solo visual salvo necesidad justificada y nuevo gate.
- `supabase/migrations/`, `supabase/schema.sql`: persistencia, permisos/RLS y dominio. No migrar sin necesidad real, evidencia y rollback independiente.
- `app/public/` y `app/cloud/adapter.js`: variante web/PWA y Cloud Adapter distintos de Android; verificar coherencia de UX, no copiar estilos a ciegas.
- `app/server.mjs`, `app/store.mjs`: variante privada Node, no runtime de Pages; `scripts/build-pages.mjs` compone Pages a partir de `app/public`.

## Puntos de entrada de interfaz observados en app.js (líneas aproximadas a prod SHA)

| Ruta/función | Entrada | Mecanismo actual | Reutilizable para V5 |
|---|---|---|---|
| navegación principal | `header` ~346, `renderNav` ~350, `render` ~389, `go` ~372 | `view` asigna home/map/moments/memories/goals/ai/chat/more | Reusar router, añadir navegación secundaria; corregir scroll/viewport y safe areas |
| Inicio | `homeView` ~490, `dailyQuestionCard` ~912, `nowCard` ~219, `coupleDistanceCard` ~742, `etaCard` ~776 | tarjetas construidas como strings HTML desde `cloud` | Reusar origen de datos/acciones, extraer presentadores; nada de datos simulados |
| búsqueda global | `openUniversalSearch` ~881; `renderUniversalSearchResults` ~865 | modal + coincidencia local; petición `intelligence-search` con fallback clásico | Rediseñar modal/resultados, **no rediseñar motor IA** |
| avisos in-app | `openNotificationCenter` ~2549, `notificationIcon` ~2546, `routeGalaxyAction` ~2554 | `notifications-list` y badges `read_at`, routing por `action` | Reusar lista/deeplinks y mejorar agrupación/UI; entrega nativa Android es deuda separada |
| Mapa | `mapView` ~1179, `map.js`, `distance.js`, `eta.js`, `gps-history.js`, `encounters.js` | mapa + perfiles + GPS + sesiones + contexto + lugares + historia | Mantener consentimiento GPS; mapa expandible, paneles y timeline visual |
| Momentos | `momentsView` ~1091, `bondGardenVisual`, `gameCard`, `ritualCard`, `voiceCard` | `cloud.bond`, catálogo de gestos, garden, juegos/notas/voz | Evolucionar vistas preservando progreso permanente y privacidad |
| Recuerdos | `memoriesView` ~980; `itemList` ~987; `itemCard` ~1004 | 9 tabs: memory/album/music/event/plan/note/capsule/wish/journey | Conservar 9 tipos; hub, colecciones, historia, detalle y acciones contextualizadas |
| álbum | `albumView` ~1048, `driveAlbumCard` ~1015, `syncDriveAlbum` ~1039 | media.photo, Google Photos Picker, carpeta Drive | reusar capacidades; eliminar solo copia autorizada, no archivo externo |
| música | `musicView` ~1053, `rebuildMusicQueue`, `renderGlobalPlayer` ~70 | mp3 + enlaces Spotify/YouTube/directo | Fuente/plataforma correcta; no prometer playback embebido universal |
| cronología/constelación | `storyTimeline` ~1011, `constellationView` ~993 | mezcla de items con límite 12 timeline / 18 estrellas; orden por fecha | Extraer entidades temporales; no confundir fecha de evento y creación |
| ajustes | `moreView` ~2577, `themeSettingsCard` ~1327, `deviceProfilesCard` ~1248, `gpsHistoryPrivacyCard` ~1260 | página de tarjetas y formularios en una sola vista | Crear hub secundario sin cambiar permisos/contratos |
| objetivos | `goalsView` ~932 | accesible por acciones y conversiones, no tab principal | Mantener intacto; si se rediseñan accesos aplicar regresión |
| chat | `chatView` ~1808, JS `chat-*engine.js` | Galaxy Chat 4.1 con composer/scroll/delivery/media/motion | **NO reimplementar ni rediseñar Galaxy Chat**; aprovechar patrones de motion y sheets tras revisión |
| IA | `intelligenceHubView` ~2570 | entrada nav IA | **Fuera del alcance V5**, incluso si global search consume `intelligence-search` |
| modales | `showChatSurface`, `showModal`, `showBottomSheet` ~2627–2645 | `<dialog>`, sheets diferenciados para chat, motion propia chat | Patrón aprovechable para modales globales; evitar romper surfaces chat |

## Android nativo aprovechable

`GalaxyNotifications.java`, `GalaxyFirebaseService.java`, `PushManager.java`, `PushSyncWorker.java`, `GalaxyNotificationActionReceiver.java`: notificaciones y entrega. `TrackingService.java`, `MotionClassifier.java`, `PendingPointStore.java`: GPS. `BondWidget.java`, `WidgetConfigureActivity.java`, `WidgetPrefs.java`: widget. `GalaxyCameraActivity.java`, `GalaxyMediaReviewActivity.java`, `CloudMediaStore.java`: medios. `UpdateManager.java`: actualizaciones. **Solo tocar si un contrato de UI lo exige**, con pruebas correspondientes.

## Pruebas existentes para reutilizar

- `npm test` (Node >=24): `tests/*.test.mjs`; tests separados para `android-ui`, `android-theme`, `android-search`, `android-monthly`, `android-today-history`, `android-distance`, `android-eta`, `android-encounters`, `android-goals-engine`, `android-intelligence-engine`, `android-bond*`, `chat-4*`, `privacy-firewall*`, `post-audit-rc`, etc.
- `gradle -p android testDebugUnitTest assembleDebug`; instrumentation real en `android/app/src/androidTest/` (closure, FCM, GPS, CameraX, voice, media, onboarding).
- GitHub: `.github/workflows/android-companion.yml` CI; `android-release-candidate.yml` en QA y `android-release-stable.yml` manual.
- Referencias de evidencia: `docs/audits/NG-4.1.1-FUNCTIONAL-MATRIX.md` (92 items, estados y límites históricos), `docs/qa/ng-f4-engineering-exit-20261012.md` (gates acotados, riesgos), `docs/RELEASE_GOVERNANCE.md`.
- **No ejecutado en esta sesión**: npm/Gradle, Android/ADB, pruebas de captura, benchmarks ni conectividad real con Firebase/Supabase. No declarar PASS nuevo por inspección estática.

## Condiciones no negociables

- No alterar `applicationId`, keystore ni rutas de upgrade; la UI instalada mostraba 4.1.2 y fuente Gradle prod confirma 4.1.2/code39.
- No leer ni registrar mensajes/fotos reales o ubicaciones privadas en fixtures y evidencias.
- No alterar tokens, identidad, RLS, seguridad de cápsulas, GPS opt-in ni entrega FCM como parte de tareas visuales sin propuesta y aprobación aparte.
- No mezclar web/PWA, QA y prod. Preferir identidades sintéticas aisladas y pruebas herméticas.
- No marcar `VE-xxx` como implementado por captura, solo tras QA e integración.
