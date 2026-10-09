# NG-F4: enlace de notificación vinculado a identidad (QA)

## Protección
Cada `PendingIntent` creado por `GalaxyNotifications` incluye el perfil que recibió el evento, y su request code contiene ese perfil para evitar colisiones entre cuentas. `MainActivity` valida esa identidad contra `DeviceStore` al recibir la intención y **otra vez** justo antes de emitir el evento al WebView. Si se desvincula el teléfono, se cambia de perfil o llega un enlace antiguo sin destinatario explícito, se descarta. El backend mantiene sus comprobaciones de autenticación de forma independiente.

## Prueba obligatoria
La instrumentación `GalaxyDeviceClosureTest.notificationDeepLink_opensChatAfterColdLaunch` confirma que una apertura desde actividad nueva lleva a la vista `chat` y ejecuta `chat-state` cuando el receptor sigue vinculado. `notificationDeepLink_deniesUnpairedAndChangedAccount` verifica rechazo del enlace al cambiar de perfil, desvincular y volver a vincular como otra identidad. `tests/ng-f4-notification-recipient.test.mjs` comprueba que la defensa permanece en el código.

**Limitación:** esta prueba todavía no simula un toque físico de notificación en bandeja después de un arranque frío del proceso ni casos de duplicado de transporte. La prueba de entrega desde Google Firebase ya pasó en RC QA #37966322021 con `F4_FCM_LIVE_GATE=VERIFIED`; distinguir entrega de apertura y navegación. No desplegar en producción ni publicar APK estable por este cambio.
