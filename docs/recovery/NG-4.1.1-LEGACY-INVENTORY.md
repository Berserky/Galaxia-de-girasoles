# NG-4.1.1 — Inventario histórico recuperable

**Nuestra Galaxia 4.1.1 — Fase 2/5** · 2026-10-08 · investigación sin cambios de código de producto.

Base: `desarrollo` @ `f5262991f3ab3fc65a6b39da2231915a453a9112`. Auditoría F1: [PR #113](https://github.com/Berserky/Galaxia-de-girasoles/pull/113) @ `60b46e3ad97a628ccbea066f0f3db2fe522d75ea` (draft, NO fusionado). La auditoría autoriza **solo comparación histórica no destructiva**; el gate de implementación/merge funcional/release permanece **NO GO**. 92 verificaciones F1: 31 PASS, 11 PARTIAL, 43 BLOCKED, 7 NOT TESTED; no extrapolar PASS parcial a módulos completos.

> Alcance honesto: inventario de **28 candidatos de recuperación evaluados por referencia y presencia de componentes**, no declaración de que las 80 etiquetas hayan sido auditadas una a una o de que las funciones respondan en E2E. Estado **PRELIMINAR / FASE 2 NO CERRADA**. Ninguna feature se recuperó ni se modificaron prod, qa, main, APK o datos personales.

## Referencias verificadas
| Rama | SHA de referencia | Fecha commit (UTC) | Nota |
|---|---|---|---|
| legacy/regalo-galaxia-original | d517e0a505a8efd11376a1bb9b03d34996102b1d | 2026-10-01 | Regalo web original |
| legacy/revisar-momentos-widgets | 6f7922ca8f044c9d1588c1e28847ef6f7f65e7cc | 2026-10-02 | Bond, widget, rituales |
| legacy/revisar-reproductor-musica | 086b63c44d663631b56896197c3e7c4f355e51c1 | 2026-10-02 | Reproductor web persistente |
| legacy/revisar-mapas-privacidad | b5e386e25d04a8cb4bba2382a0d1db1d0c6920e4 | 2026-10-02 | Ubicación web/mapa |
| legacy/revisar-diseno-contemporaneo | c67b9cdbb8518e449a8628d4b02ea5c9bfc187a9 | 2026-10-02 | Diseño móvil |
| legacy/revisar-universo-2-1 | 322bf6bab9e07d4ff400dadba38eff6ffc7b2272 | 2026-10-03 | Android/voz/widgets |
| archive/2026-10-08/aegiron/nuestro-hogar-v1 | 6f1d886ce95832fa4f7970f6b2a8cb8a0c222296 | Sin fecha extraída | Hogar web |
| archive/2026-10-08/aegiron/rpg-indoors-v1 | 3d5ef50900276ff3b8390470ad5e4761ee32729a | Sin fecha extraída | RPG y assets |
| archive/2026-10-08/aegiron/curated-shop-v30 | 3dc3d7ea666255a439758fad72cb6427bed6a4ff | Sin fecha extraída | Tienda/catalogación |

Las seis ramas legacy y las 80 refs `archive/2026-10-08/*` se comprobaron como existentes. Se inspeccionaron árboles completos de seis ramas, desarrollo y algunas tags representativas; queda un recorrido sistemático de las 80 tags para cierre exhaustivo. El diff de GitHub entre historia y desarrollo tiene cientos de cambios y puede truncar la lista en 300 archivos; **no** es apto para cherry-pick masivo.

## Identidades de archivos originales
- `index.html` original/actual: blob idéntico `658e7a615f0db5a2101e932f7cea2b0459fd9df9`.
- `recuerdos.js` original/actual: blob idéntico `b7e76c719227e318de7e82096750d32237579b0f` (contiene recuerdos personales; no incluir su texto en artefactos derivados).
- `musica.mp3` original/actual: blob idéntico `98937a257bef1c92685a8764665b7597438dc32c`.
- `girasol.js` original/actual: blob idéntico `21f23145501f8203647bc94ea94692ce6400c9d9`.
- `script.js` cambió respecto al original: blobs `7954cf5...` / `6755c93...`; exige diff selectivo, no asumir identidad completa.

## Candidatos trazables
| ID | Capacidad histórica | Ref concreta | Archivos origen | Equivalente actual (código) |
|---|---|---|---|---|
| NG-LEG-001 | Inicio narrativo del regalo | `legacy/regalo-galaxia-original @ d517e0a` | `index.html; script.js` | `assets/mobile/app.js: welcomeStep/welcomeGift` |
| NG-LEG-002 | Seis girasoles y recuerdos interactivos | `legacy/regalo-galaxia-original @ d517e0a` | `script.js; recuerdos.js` | `assets/mobile/app.js: welcome/memories` |
| NG-LEG-003 | Narración y carta histórica personalizada | `legacy/regalo-galaxia-original @ d517e0a` | `recuerdos.js; index.html` | `index.html/recuerdos.js conservados; sección memories` |
| NG-LEG-004 | Animación, redimensionado y reduce-motion del regalo | `legacy/regalo-galaxia-original @ d517e0a` | `script.js: motion/ajustar` | `assets/mobile/app.css; welcome en app.js` |
| NG-LEG-005 | Álbum e historia de recuerdos | `legacy/regalo-galaxia-original @ d517e0a` | `app/public/app.js: album/memories` | `assets/mobile/app.js: memories y media` |
| NG-LEG-006 | Audio de fondo en bienvenida | `legacy/regalo-galaxia-original @ d517e0a` | `index.html: musicaFondo; musica.mp3` | `assets/mobile/app.js: welcomeMusic; musica.mp3 idéntico SHA` |
| NG-LEG-007 | Gestos abrazo/beso/te extraño | `legacy/revisar-momentos-widgets @ 6f7922c` | `app/public/bond-ui.js; app/bond-store.mjs` | `BondActionReceiver; BondWorker; bond-engine.ts` |
| NG-LEG-008 | Widget nativo foto/fecha/abrazo | `legacy/revisar-momentos-widgets @ 6f7922c` | `BondWidget.java; widget_bond.xml` | `BondWidget.java; WidgetConfigureActivity.java` |
| NG-LEG-009 | Widget dinámico configurable | `legacy/revisar-universo-2-1 @ 322bf6b` | `BondWidget.java; widget_bond.xml` | `WidgetPrefs.java: 9 módulos; BondWidget.java` |
| NG-LEG-010 | Rituales, quiz y notas compartidas | `legacy/revisar-momentos-widgets @ 6f7922c` | `docs/MOMENTOS.md; app/public/bond-ui.js` | `app/bond-store.mjs; app/public/bond-ui.js; bond-engine.ts` |
| NG-LEG-011 | Dedicatorias de voz dentro de momentos | `legacy/revisar-momentos-widgets @ 6f7922c` | `docs/MOMENTOS.md; bond audio` | `chat-voice-engine.js; vínculo bond separado` |
| NG-LEG-012 | Sincronización periódica de gestos | `legacy/revisar-momentos-widgets @ 6f7922c` | `BondWorker.java` | `BondWorker.java; GalaxyNotifications.java` |
| NG-LEG-013 | Reproductor flotante persistente | `legacy/revisar-reproductor-musica @ 086b63c` | `app/public/app.js: bgAudio/updateMiniPlayer` | `assets/mobile/app.js: globalPlayer/musicQueue` |
| NG-LEG-014 | Biblioteca privada de MP3 | `legacy/revisar-reproductor-musica @ 086b63c` | `app/public/app.js; persistencia musical` | `assets/mobile/app.js; migration 20261002065616*` |
| NG-LEG-015 | Reproducción desde URL externas | `legacy/revisar-reproductor-musica @ 086b63c` | `app/public/app.js` | `assets/mobile/app.js: spotify/youtube/detectMusicPlatform` |
| NG-LEG-016 | Audio musical en segundo plano Android | `legacy/revisar-reproductor-musica @ 086b63c` | `mini player web/PWA` | `assets/mobile/app.js; sin evidencia MediaSession foreground` |
| NG-LEG-017 | Distancia y ETA por desplazamiento | `legacy/revisar-mapas-privacidad @ b5e386e` | `app/public/app.js: map/distance` | `assets/mobile/distance.js; eta.js; map.js` |
| NG-LEG-018 | Casa/trabajo y eventos de llegada | `legacy/revisar-mapas-privacidad @ b5e386e` | `app/public/app.js: detectSmartPlace/mapPlaces` | `assets/mobile/gps-history.js; map.js; funciones Edge` |
| NG-LEG-019 | Historial GPS, viajes, exportación/borrado | `legacy/revisar-mapas-privacidad @ b5e386e` | `app/public/app.js: map/history` | `assets/mobile/gps-history.js; migraciones map v2` |
| NG-LEG-020 | Encuentros y cercanía entre ambos | `legacy/revisar-mapas-privacidad @ b5e386e` | `app/public/app.js: insights/arrival` | `assets/mobile/encounters.js; TrackingService.java` |
| NG-LEG-021 | Compartir ubicación y privacidad por pareja | `legacy/revisar-mapas-privacidad @ b5e386e` | `app/public/app.js: start/stopLocationSharing` | `TrackingService.java; DeviceStore.java; Edge/RLS` |
| NG-LEG-022 | Temas contemporáneos/estacionales | `legacy/revisar-diseno-contemporaneo @ c67b9cd` | `app/public/theme.js; app.css` | `assets/mobile/theme.js: 8 temas; app.css` |
| NG-LEG-023 | Navegación móvil y menús de exploración | `legacy/revisar-diseno-contemporaneo @ c67b9cd` | `app/public/app.js; diseño 2026-10-02` | `assets/mobile/app.js: Inicio/Mapa/Momentos/IA/Recuerdos/Más` |
| NG-LEG-024 | Hogar compartido decorable | `archive/2026-10-08/aegiron/nuestro-hogar-v1 @ 6f1d886` | `app/public/app.js; app/public/app.css` | `migraciones shared_home; UI actual no certificada` |
| NG-LEG-025 | Interiores RPG y coleccionables | `archive/2026-10-08/aegiron/rpg-indoors-v1 @ 3d5ef50` | `app/public/assets/home/rpg-indoors.js` | `migraciones catálogo RPG retenidas` |
| NG-LEG-026 | Catálogo/taller/tienda histórica masiva | `archive/2026-10-08/aegiron/curated-shop-v30 @ 3dc3d7e` | `archive curated-shop-v30; catálogo home` | `migraciones catálogo 20261002*` |
| NG-LEG-027 | Mensajes de voz modernos | `legacy/revisar-universo-2-1 @ 322bf6b` | `historial Android voice` | `assets/mobile/chat-voice-engine.js; pruebas CI chat-4-phase6` |
| NG-LEG-028 | Cache/service worker de la PWA antigua | `legacy/regalo-galaxia-original @ d517e0a` | `app/public/sw.js y manifest web` | `Android WebViewAssetLoader y assets/mobile` |

## Método y límites
Fuentes: GitHub refs y árboles, archivos textuales selectivos, documentos `docs/BRANCH_POLICY.md`, `docs/MOMENTOS.md`, auditoría F1 en PR #113. No se ejecutó `git fetch` sobre PC, tests nuevos, emulador ni CI para este documento: las comprobaciones son lectura de GitHub remoto. No se accedió a secretos, datos de usuarios ni servicios privados.

## Conciliación del índice de rescate del 8-oct

El archivo histórico [`docs/branch-audit-2026-10-08.csv`](../branch-audit-2026-10-08.csv) contiene **113 registros**: **80** con estado `unique` y **33** con estado `included`. Se cruzaron por **nombre y SHA** los **80** registros `archive/2026-10-08/*` de GitHub contra el CSV: **80/80 coinciden, 0 ausentes/discordantes**. Este resultado certifica la integridad del *índice de referencias de rescate*, **no** una revisión semántica de todos sus árboles/funciones. Para ese cierre, cada tag todavía debe recibir lectura de diff por módulo y decisión de paridad.

Ejemplos incluidos en el índice: `aegiron/nuestro-hogar-v1`, `aegiron/rpg-indoors-v1`, `aegiron/music-player-v2` y `aegiron/map-insights-privacy`. No modificar estas referencias.
