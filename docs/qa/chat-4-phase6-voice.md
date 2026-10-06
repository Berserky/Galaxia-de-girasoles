# Galaxy Chat 4.0 — Fase 6 Voice Messages 2.0

- Estado único: `GalaxyChatVoice` controla idle, permiso, hold, lock, pausa, preview, preparación, envío, cancelación y fallo.
- Captura Android: `MediaRecorder`, AAC-LC en contenedor MPEG-4/M4A. La captura existente se reutiliza; no hay recorder paralelo.
- Permiso: `RECORD_AUDIO` se solicita únicamente al iniciar una grabación.
- Temporales: cache local `voice-*.m4a`; cancel/delete/onDestroy eliminan el temporal. Un fallo de upload conserva el archivo para retry.
- Pipeline: record → preview integrado → `saveChatVoiceRecording` → upload existente → Delivery Engine.
- Playback: reproductor inline existente conserva play/pause, seek nativo del elemento audio y velocidades 1x/1.5x/2x; solo un audio se reproduce a la vez.
- Interrupciones: background detiene la captura de forma segura; destroy limpia recorder/player/temporal.
- Límite: 5 minutos en el controlador de UI; el límite nativo debe permanecer alineado con esta política.
- Rendimiento: timer/waveform se actualizan a 4 Hz, máximo 48 muestras visuales; el Scroll Engine envuelve los cambios de altura del Composer.
- Privacidad: no se inicia micrófono sin gesto explícito, no se sube antes de enviar y no se registra contenido.
- Limitación conocida: sensor de proximidad/media session no son requisito de esta fase; Bluetooth/headset dependen del routing multimedia normal de Android.
