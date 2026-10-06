# Galaxy Chat 4.0 — Fase 9: Media Performance

## Alcance cerrado

Fase 9 optimiza el pipeline multimedia sin crear un segundo sistema de chat, sin cambiar Realtime/Delivery/Scroll como fuentes de verdad y sin desplegar producción estable.

### Pipeline

- Fotos: el bubble consume thumbnailUrl; el original queda como referencia y solo se promueve al visor tras acción explícita.
- Videos: el bubble consume thumbnail/poster; preload none evita cargar el video original hasta pulsar reproducir.
- Audio: preload none y activación explícita al pulsar play.
- Android genera thumbnails JPEG acotados a 640 px de lado mayor y 1.5 MiB máximo para fotos/videos nuevos.
- Original y thumbnail viven en el bucket privado galaxy-chat-media; thumbnail_path sigue siendo la referencia canónica.
- cacheKey usa el ID estable del attachment. Los tokens de signed URL no son identidad de caché.

### Lazy loading, caché e invalidación

GalaxyChatMedia usa IntersectionObserver con el viewport del chat como root y 720 px de margen de precarga. La cola tiene máximo 4 cargas concurrentes. La caché está acotada a 96 entradas y usa recencia de acceso para eviction.

Se invalida/libera en eliminación de mensaje multimedia, salida del chat, background, presión de memoria Android y rerender de la ventana virtualizada. No se añadió CDN, Service Worker multimedia, IndexedDB ni una segunda capa persistente de blobs.

Si un thumbnail falla, el bubble conserva geometría reservada y permite un reintento explícito. Si falla el original al abrir el visor, se conserva la vista previa disponible.

## Validación

### Contratos automatizados

tests/chat-4-phase9-media-performance.test.mjs: 33/33 verdes. Cubre las 30 situaciones obligatorias, incluyendo 500 imágenes, múltiples videos, HEIC/WebP, retry, background/foreground, low-memory, eliminación, dos usuarios, Realtime y chat lógico de 20.000+ mensajes.

### Android físico

Moto g75 5G:
- GalaxyMediaPerformanceTest: imágenes reales 12 MP y 24 MP, thumbnail <= 640 px / <= 1.5 MiB y repetición con guard de PSS.
- GalaxyDeviceClosureTest#chatPhase9MediaPerformance_realWebView20kLazyCacheAndMemoryPressure: 20.000 mensajes lógicos, 500 visuales distribuidos, ventana renderizada de 84, cero originales inicializados antes de intención, caché <= 96, scroll >= 50 FPS en dispositivo físico, presión de memoria y lifecycle.
- Resultado final del gate físico: BUILD SUCCESSFUL, 0 failures.

### Transferencia modelada reproducible

scripts/chat-4-phase9-media-performance.mjs usa un dataset determinista y la misma ventana virtual de 84 mensajes.

| Métrica | Fase 8 | Fase 9 |
|---|---:|---:|
| Requests visuales en ventana | 3 | 3 |
| Originales descargados antes de intención | 3 | 0 |
| Bytes modelados | 26,635,303 | 300,351 |
| Ahorro modelado | — | 98.87% |

Los bytes son un modelo determinista de transferencia, no telemetría de operador/red. FPS/PSS/lifecycle se validan por instrumentation Android.

## Compatibilidad y seguridad

- No se modificó producción estable.
- No se añadió un canal Realtime ni un Message/Delivery/Scroll Engine alterno.
- El thumbnail reutiliza validación MIME, ownership, bucket privado y cleanup de media no referenciada existentes.
- qa-android-mobile.mjs solo amplía su allowlist con el nuevo script local chat-media-engine.js.
- npm test completo en este checkout Windows conserva un fallo preexistente de tests/release-3.test.mjs: el test busca LF literal en workflows que Git entrega localmente como CRLF por core.autocrlf=true. Los workflows de release no fueron modificados por Fase 9. El workflow CI Linux de Fase 9 ejecuta npm test con checkout LF.

## Criterio de cierre

Fase 9 queda lista para merge cuando el PR remoto confirme sus checks Linux/Android. No se debe iniciar Fase 10 ni promover producción estable desde esta fase.
