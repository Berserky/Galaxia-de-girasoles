# Fase 4 GPS ETA — Android UI QA hermética

Añadimos instrumentación Android que recorre **el WebView real** con fixtures sintéticos del servidor `QaHttpServer` local, sin tráfico a Supabase ni ubicaciones personales.

El test `gpsEta_onAndroidMapShowsLivePausedStaleAndOfflineStates` exige ver el cálculo ETA para dos ubicaciones frescas y compartidas, seguido por los estados donde la pareja pausa la ubicación, la del usuario queda obsoleta (1 hora) y ninguna persona comparte. El QA emulado comprueba los mensajes adecuados y que no muestre una ETA artificial cuando falta consentimiento o señal.

Las pruebas anteriores de RLS de ubicación y consentimiento en Android deben pasar además. Esto **no certifica precisión de GPS físico, rutas viales ni duración de batería**; para ello siguen pendientes mediciones representativas y mock de proveedor de ubicación, junto con condiciones de transporte.

Estado: PR de QA aislado. No producción ni APK estable.
