# NG-COMPATIBILITY-MATRIX — Android, WebView, backend y CI
Revisión: 2026-10-08. Estado de la fase: evaluación parcial, sin autorización de release.

| Superficie | Configuración inicial | Evaluada | Adoptada / resultado | Riesgo | Evidencia / gate |
|---|---|---|---|---|---|
| AGP + Gradle | AGP 9.2.0 / Gradle CI 9.4.1 | AGP 9.4.1 solo | MANTENER 9.2.0 / 9.4.1 | ALTO | AGP 9.4 requiere Gradle >=9.6.0; #79 bloqueado |
| JDK | 17 Temurin | setup-java@v6 con JDK17 | MANTENER setup-java@v5 | MEDIO | #77 builds verdes pero emulador/stress fallidos |
| SDK | compile/target 36; min26 | sin cambios | CONSERVAR | ALTO | Android release gate |
| Core | androidx.core 1.17.0 / compileSdk36 | 1.19.1 exige compileSdk37 | MANTENER 1.17.0 / compileSdk36 | ALTO | #78 AAR metadata falla por API 37; migración aislada a compileSdk37 + QA |
| WorkManager | 2.11.2 | 2.12.0 | MANTENER 2.11.2 | ALTO | #80 falla instrumentación; procesos en background |
| CameraX | 1.5.3 en cinco módulos | sin cambio | CONSERVAR | ALTO | Cámara foto/video nativa, pruebas emulador/físicas según cobertura |
| WebKit | androidx.webkit 1.15.0 | sin cambio | CONSERVAR | ALTO | Puente JS, assets, navegación, media, permisos |
| Firebase Messaging | 25.1.3 | sin cambio | CONSERVAR | ALTO | FCM foreground/background, sin credenciales expuestas |
| Play location | 21.4.0 | sin cambio | CONSERVAR | ALTO | GPS, permisos, revocación y batería |
| Node CI | Node 24 + setup-node v5/v6 | setup-node@v6 | PROPUESTO v6 (PR aislado) | BAJO-MEDIO | necesita checks del SHA nuevo, base en package.json |
| Gradle Action | setup-gradle@v4 | v6 | MANTENER v4 | MEDIO | #81 tiene un FAILURE de instrumentación |
| Checkout | checkout@v5 | v7 | MANTENER v5 | MEDIO | #82: no se pudo comprobar checks del head |
| Pages | deploy-pages@v4 | v5 | MANTENER v4 | ALTO | publicar es operación separada no autorizada |
| Deno | setup-deno@v2; v2.x | sin cambio | CONSERVAR | MEDIO | deno check/test Edge en CI |
| Supabase JS | npm:supabase-js@2.117.2 | sin cambio | CONSERVAR | ALTO | Auth, RLS, Realtime, Storage y Edge contratos |
| Supabase CLI | setup-cli@v1 | sin cambio | CONSERVAR | ALTO | migraciones solo en entorno efímero de pruebas |
| Firma Android | workflow y secretos firmantes existentes | sin cambio | INTACTA | CRÍTICO | nunca acceder/cambiar certificados ni publicar APK |

## Pruebas mínimas por dominio, no ejecutadas por solo leer CI histórico
- **Android/Java**: build debug/release sin signing productivo, unit test, lint, instrumentación CameraX, WebView JS bridge, permisos, notificaciones y background; upgrade instalado solo en escenario controlado.
- **Node/Web**: `npm test`, build estático, bench de fases 0–4, 9, 11, navegación/chat/multimedia; sin desactivar tests.
- **Deno/Supabase**: `deno check --node-modules-dir=auto`, pruebas de validación de medios, migraciones canónicas en DB aislada, casos negativos de RLS dos parejas, revocación y token expiry.
- **Cadena de suministro**: lockfiles cuando aplique, dependencias transitivas, SHA/attestation de actions y secretos acotados.
- **Política de integración**: PR desde rama temporal hacia desarrollo; no merges de PR con checks requeridos fallando. qa/prod/main y Android stable preservados.

El cierre documental de Fase 2 garantiza integridad de inventario 80/80, pero no demuestra QA funcional. F1 registra 31 PASS, 11 PARTIAL, 43 BLOCKED y 7 NOT TESTED; F3 no puede reinterpretar esos estados.
