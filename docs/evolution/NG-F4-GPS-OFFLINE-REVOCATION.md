# Fase 4 — Revocación de GPS local y cola sin conexión

El servicio Android conservaba en `galaxy_pending.db` puntos de GPS recogidos antes de una pérdida de red. Para evitar que el siguiente perfil reciba posiciones antiguas, `DeviceStore.clear()` elimina esa cola cuando el teléfono se desvincula. `TrackingService.stopTracking()`, pérdida de permisos y denegación explícita de ubicación también la vacían.

Se añadieron comprobaciones en la recepción de callbacks FusedLocation y en el ejecutor asíncrono antes de subir coordenadas; si el usuario detuvo el seguimiento, estos trabajos dejan de publicar. `flush()` corta el reenvío si se retiró el consentimiento. Son defensas de mejor esfuerzo contra callbacks y colas, sin prometer cancelar una petición HTTP que ya estaba en curso; el comando server-side `location-stop` mantiene la responsabilidad de desactivar el estado remoto.

`GalaxyGpsConsentDeviceTest.unpairErasesOfflineGpsHistoryBeforeAnotherIdentityPairs` inyecta exclusivamente coordenadas sintéticas y comprueba que la cola quede vacía después de desvincular y volver a vincular como otra persona. El test estático `ng-f4-gps-revocation.test.mjs` verifica guardias y orden de operaciones.

**No es una prueba física de recepción GPS ni de consumo de batería.** Requiere CI Android verde y smoke de QA antes de integrar. No modificar Supabase producción ni publicar APK estable automáticamente.
