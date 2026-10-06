# Galaxy Chat 4.0 — Phase 4 Composer 2.0

## Arquitectura del Composer
- `chat-composer.js` es la única fuente de estado de composición.
- `app.js` mantiene la integración visual y reutiliza Message Engine, Scroll Engine y Delivery Engine.
- El historial no se vuelve a renderizar al escribir, responder, cancelar reply ni añadir/quitar adjuntos; `chatRenderComposer()` reemplaza únicamente el Composer.
- El recorder actual queda detrás de `recordingIntent` para que una fase posterior pueda sustituir su UI sin cambiar el contrato del Composer.

## Estados
`ChatComposer` centraliza:
- texto;
- reply target;
- attachment intent;
- recording intent;
- disabled/sending;
- multiline y altura;
- keyboard abierto/altura;
- clave de conversación para draft.

Los binarios/metadata ya capturados continúan en la infraestructura existente de adjuntos; el Composer solo mantiene la intención y su contexto visual.

## Delivery Engine
`queueCurrentChat()` aplica el guard de doble tap y `queueChatMessage()` delega exclusivamente en `chatDeliveryEngine.queue(row)`.
El mensaje optimista se pinta desde el outbox local sin esperar round-trip. Al aceptar la cola local se limpian texto/reply/adjuntos del Composer. Los fallos y retry permanecen en Delivery Engine y en el mensaje fallido; el texto no vuelve automáticamente al input.

## Drafts
Los borradores de texto se guardan por clave de conversación con prefijo `nuestra-galaxia.chat-draft.v4`.
El borrador v3 se migra una sola vez al contexto activo. Reply targets y adjuntos no se persisten en almacenamiento.
Navegar fuera conserva el texto; una aceptación local de envío limpia solo el draft activo.

## Attachment Launcher
El botón `+` abre un único bottom sheet integrado.
Expone únicamente capacidades existentes: Cámara, Fotos, Video, Archivo, Ubicación, Galaxy Card, Acompáñame, Encuesta, Checklist y GIF/stickers.
La captura avanzada sigue usando los flujos nativos actuales; no se reemplaza CameraX ni se introduce un segundo pipeline multimedia.

## Keyboard y Scroll Engine
Los cambios de altura del textarea, reply y adjuntos se envuelven con `beforeViewportChange/afterViewportChange`.
`visualViewport`, focus y blur alimentan el estado de teclado del Composer.
Si el usuario está leyendo historial, el anchor visual se conserva; si está en el presente, Scroll Engine mantiene su política existente.
El textarea usa 16 px, altura limitada y scroll interno. Los controles principales mantienen targets de 44–48 px y respetan safe-area inferior.

## Decisiones relevantes
- No existe segundo canal de envío ni backend nuevo.
- No se rediseñaron bubbles ni Galaxy Cards.
- No se reemplazó el recorder avanzado ni la cámara.
- El attachment sheet reutiliza el `dialog` existente con una presentación específica desde abajo.
- Reduced motion desactiva las transiciones añadidas por esta fase.
