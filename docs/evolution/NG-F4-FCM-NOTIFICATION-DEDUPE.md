# Fase 4 — notificaciones FCM duplicadas y cambio de identidad

Al revisar la evidencia del RC QA #37981764489 (7/7 jobs success, FCM real 1 test ejecutado sin skips) se identificó una ruta no cubierta: entregar el mismo `eventId` de `chat_message` dos veces podía incrementar el contador y repetir el contenido en el historial Android, aunque el sistema actualizara una sola notificación visible.

La corrección añade deduplicación local, sincronizada y acotada a 128 claves opacas `persona|eventId`, sin almacenar cuerpo ni remitente en esa lista. Solo afecta `chat_message`. `DeviceStore.clear()`, `save()` cuando cambia la persona y `setPerson()` al cambiar de identidad vacían el historial privado de notificaciones, el contador y la caché de claves. No modifica FCM de servidor, mensajes del chat ni otras notificaciones.

La prueba Android `GalaxyFcmPrivacyDeviceTest.retriedChatEventDoesNotDuplicateAndAccountSwitchClearsPreviews` usa exclusivamente eventos sintéticos y comprueba que un reintento no incremente el contador, un ID diferente sí y que la historia cifrada desaparezca al cambiar de persona/desvincular. Contrato estático Node complementario. Esta prueba no simula ni declara transporte Google FCM real ni dos dispositivos simultáneos.

**Gates:** ejecutar los 12 workflows CI del último SHA de PR; luego promover a `qa` de manera independiente y validar Release Candidate y FCM real. No fusionar antes de verde. No modificar `prod`, Supabase producción ni `android-stable`. Fase 4 sigue NO GO global hasta los escenarios restantes de dos dispositivos, cold-process real, reintentos end-to-end, GPS físico/ETA y batería.
