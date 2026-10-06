# Galaxy Chat — Fase 8: motion

## Tokens

Definidos en `android/app/src/main/assets/mobile/app.css`; consumidos por `GalaxyChatMotion` y Scroll Engine.

| Token | Valor |
| --- | --- |
| duration-fast / normal / slow | 100 / 160 / 220 ms |
| easing-standard | cubic-bezier(.2,0,0,1) |
| easing-enter | cubic-bezier(.2,.8,.2,1) |
| easing-exit | cubic-bezier(.4,0,1,1) |
| scale-feedback | .97 |
| opacity | .75 → 1 |
| distance | 6 px |

Duraciones principales limitadas a 300 ms. Los tokens se reutilizan y se invalidan al cambiar preferencia nativa, visibilidad o degradación; no se consulta estilo en cada cambio del Composer.

## Reglas y patrones permitidos

- Mensaje optimista inmediato, antes de respuesta remota. Motion nunca bloquea envío, retry, apertura o dismiss.
- Solo eventos nuevos explícitos y visibles reciben entrada. La señal expira a los 500 ms, se consume una vez y se descarta fuera del viewport. No depende del montaje del DOM.
- 1–3 mensajes al fondo permiten entrada sutil. Ráfagas mayores cancelan efectos y actualizan directamente. Leer historial conserva anchor y actualiza el indicador.
- Opacidad/transform cortos en burbuja, icono, acciones, reply, indicador y sheet. Micrófono/enviar anima únicamente el icono; conserva dimensiones.
- Una animación por elemento: feedback repetido reemplaza el efecto anterior. Sin capas permanentes de will-change.
- Message Engine limita a 84 filas; no se aplica segunda virtualización CSS que cambie alturas durante motion. Motion solo mide IDs pendientes, nunca geometría del historial sin eventos.
- Scroll animado hasta dos alturas del viewport, con duración slow. Distancias mayores, reduced motion y degradación hacen salto controlado. Input interrumpe el movimiento. Callbacks obsoletos no liberan el desplazamiento posterior.
- Intención bottom vinculada al elemento. Render completo la transfiere y consume. Anchor virtual enfoca historial únicamente en preserve. Restauración no reproduce entradas.
- Multiline/teclado/reply cambian geometría sin animar height; Scroll Engine conserva posición. Waveform: 32 barras fijas, scaleY y actualización existente de 250 ms, sin recrear DOM en cada muestra. Playback conserva progreso real.
- Cámara/preview mantienen captura, revisión, confirmar/cancelar nativos y motion mínimo. Cards, reacción, errores y delivery mantienen texto/iconos comprensibles y feedback corto.

## Reduced motion y degradación

Combina prefers-reduced-motion del WebView con ANIMATOR_DURATION_SCALE de Android, leída directamente al generar estado nativo. Elimina escala/desplazamiento y scroll animado; conserva opacidad, texto e iconos. Los estados siguen siendo inmediatos.

Memoria declarada ≤2 GB: omite efectos no esenciales. Tres frames lentos recurrentes (>33 ms) cancelan efectos y los suspenden 5 segundos. El monitor solo funciona durante animación. Background cancela señales/efectos; no se reproducen al regresar.

## Patrones prohibidos

Bounce, partículas, confetti nuevo, flashes, skeleton pulsante, spinners decorativos infinitos, fades masivos al paginar, entradas de filas recicladas, restauración animada, blur pesado en sheets/menús, animar top/left/width/height/shadow o retener interacción hasta terminar un efecto.

## Métricas

Moto G75 5G / Android 16 / WebView real por USB/ADB. Base Fase 7 `origin/main 55686ad`. Misma prueba: 20.000 mensajes lógicos, 84 filas, scroll 100 px y empty/text cada 6 frames, carga JS adicional 4 ms/frame. Tres muestras de 1.200 ms tras 1.500 ms de estabilización; pantalla fijada temporalmente a 60 Hz y restaurada después.

| Mediana | Fase 7 | Fase 8 |
| --- | ---: | ---: |
| FPS | 59,84 | 59,84 |
| Frame | 16,71 ms | 16,71 ms |
| Frames >34 ms | 0 | 0 |
| CPU proceso Android | 549 ms | 567 ms (+3,3 %) |
| PSS final proceso | 245.611 KB | 247.564 KB (+0,8 %) |
| Long tasks | 0 | 0 |
| Layout shifts | 0 | 0 |

Envío visual: 29,4 ms. Motion bajo carga: 59,84 FPS, 0 frames perdidos, anchor dentro de 4 px. Solicitud hasta finished: fast 130,1 / normal 183,2 / slow 250,4 ms frente a tokens 100/160/220 ms. Feedback del icono en benchmark: 104,6–111,8 ms para fast 100 ms.

[Muestras comparativas](qa/chat-4-phase8-motion-metrics.json). CPU/PSS son contadores del proceso Android. Los umbrales de FPS/envío se verifican en hardware físico. CI con render por software verifica semántica, reduced motion, restauración y degradación de 2 GB; registra métricas sin atribuirle rendimiento de hardware real.
