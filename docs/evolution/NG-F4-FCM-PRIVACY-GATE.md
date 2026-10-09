# Fase 4 — FCM, privacidad del receptor Android

## Riesgo y mitigación
El servidor puede revocar tokens FCM, pero un mensaje ya enviado puede alcanzar el teléfono después de desvincularlo. El receptor `GalaxyFirebaseService` mostraba contenido antes de comprobar la vinculación local. La defensa nueva consulta `DeviceStore.pairedFast()` antes de procesar tipos de eventos, emitir broadcasts, vibrar o publicar una notificación.

## Validación reproducible
- `tests/ng-f4-fcm-privacy.test.mjs`: verificación de orden del guard y contratos de prueba.
- `GalaxyFcmPrivacyDeviceTest` (instrumentación API35): una notificación sintética no aparece si el dispositivo no está vinculado; una sesión pareada permite el procesamiento y genera un `PendingIntent` de chat; al limpiar el vínculo, un segundo mensaje en tránsito no muestra nada.
- Estos casos ejecutan el **mismo handler** nativo de los mensajes entrantes y no inyectan DOM ni acceden a datos personales.

## Preflight FCM remoto en staging OIDC\nEl script `scripts/qa-phase5-staging.mjs` exige ahora que ambos dispositivos temporales A/B obtengan `push-client-config` en Supabase QA y que reciban IDs de dispositivo distintos. Es una comprobación **real del servidor y configuración pública** en el siguiente RC de QA; no envía un push, no registra tokens FCM y no imprime credenciales. La prueba debe fallar si la configuración QA no está preparada.\n\n## Limitación estricta
Esta prueba **NO** equivale a una entrega FCM desde servidores de Firebase al dispositivo. La entrega foreground/background, la recreación por toque/deep link, los reintentos remotos y la revocación del token remoto deben comprobarse sobre un emulador con Google Play Services y credenciales de QA reales. Mantener `QA-FCM-01=PARCIAL/BLOCKED` y [issue #133](https://github.com/Berserky/Galaxia-de-girasoles/issues/133) abierto hasta dicha evidencia.

Sin despliegue de producción, versión estable ni cambios de credenciales.
