# Galaxy Chat 4.1 — Crown Jewel · Bloque 1/4

## Base y alcance

- Repositorio: `Berserky/Galaxia-de-girasoles`.
- Base verificada: `origin/main = 0c54c09c485af41e352b868f6b332790fa99366d`.
- Rama única: `feat/galaxy-chat-4.1-crown-jewel`.
- No se modificó `main`, no se publicó `android-stable` y no se cambió `versionCode/versionName`.
- Se conservaron Message Engine, Scroll Engine, Delivery Engine, Composer y GalaxyChatVoice existentes.

## Decisiones

### Header 4.1
La cabecera conserva una única fila con Volver, avatar, contacto, Buscar y Más. Contenido compartido, Guardados y Ajustes del chat pasan al menú Más sin perder sus acciones existentes.

### Galaxy Surface System
`showModal()` y `showBottomSheet()` delegan en `showChatSurface()`, reutilizando el único `dialog#modal`. Las superficies de chat comparten encabezado, cierre, handle de bottom sheet, altura máxima, scroll interno y safe area.

### Intelligent Chat Search
La búsqueda inicial expone un único textbox. El input dispara `chat-search` con debounce de 280 ms; los filtros existentes quedan en un bloque progresivo y mantienen por defecto `sender=all`, `type=all` y `date=null`. Se conservan `nextBeforeSeq` y `jumpToChatMessage()`, por lo que no se carga el historial completo ni se crea navegación paralela.

Estados implementados: idle, searching, results, no-results y error; la paginación conserva su estado mediante el botón de resultados anteriores.

### Shared Hub
Las categorías Multimedia, Links, Música, Archivos, Ubicaciones, Fijados, Guardados y Álbumes se presentan en navegación horizontal contenida. La búsqueda se integra en la misma superficie y se actualiza con debounce. Multimedia usa grid visual; las demás categorías conservan listas compactas.

### Galaxy Message Actions
El long press sigue abriendo el menú Galaxy existente, ahora como bottom sheet. La WebView ya no gana la interacción mediante selección nativa/callout sobre el cuerpo del mensaje. Los descendientes interactivos quedan excluidos y swipe-to-reply conserva su gesto existente. Se añadió Copiar al menú Galaxy para no depender del menú nativo.

### Voice Composer / VIS-002
No se creó otro recorder. `GalaxyChatVoice` y su state machine siguen siendo la única fuente. El layout de grabación/preview se hace viewport-bounded con `min-width:0`, grid flexible, waveform contraíble y controles de al menos 44 px. `body`, shell y composer bloquean overflow horizontal.

### Design system
Los estilos nuevos extienden `--chat-*` y mapean colores/superficies a tokens Galaxy existentes; no se añadió una segunda paleta.

## Archivos modificados

- `android/app/src/main/assets/mobile/app.js`
- `android/app/src/main/assets/mobile/app.css`
- `tests/chat-4.1-crown-jewel-foundation.test.mjs`
- `docs/qa/chat-4.1-crown-jewel-block1.md`

## Pruebas y gates

El contrato 4.1 nuevo cubre:

- header con Search + More y acceso a Shared/Guardados/Ajustes;
- textbox único, debounce, estados, paginación y jump exacto;
- Shared tabs sin overflow y búsqueda integrada;
- long press, supresión de selección nativa, Copiar y swipe reply;
- reutilización de GalaxyChatVoice y límites de ancho;
- 320 / 360 / 390 px, landscape, safe areas y font scaling;
- reduced motion.

La rama se expone en un PR draft para disparar los workflows existentes que ejecutan `npm test`, `phase11-gate.mjs`, `qa-android-mobile.mjs`, Android unit/lint/build e instrumentación de estrés.

## Inspección visual y deuda real restante

El equipo autorizado `Bati-Compu` estaba offline durante este bloque, por lo que no fue posible realizar inspección manual en el WebView del teléfono físico ni ejecutar el Gradle local/ADB solicitado desde Desktop Commander. Esto se registra como deuda de validación, no como funcionalidad omitida.

La inspección estructural sí valida que las superficies quedan contenidas por viewport, safe areas y breakpoints, pero el cierre visual definitivo en hardware real debe confirmar especialmente: teclado abierto/cerrado, font scale del sistema y long press en WebView Android.

No se detectó ni se dejó conscientemente ningún P0/P1 funcional en el código modificado. Cualquier P0/P1 que aparezca en CI o smoke físico debe corregirse antes de dar por cerrado el bloque.
