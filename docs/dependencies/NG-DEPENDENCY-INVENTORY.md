# NG-DEPENDENCY-INVENTORY — Nuestra Galaxia 4.1.1
Fecha de revisión: 2026-10-08. Base: desarrollo @ 86a12d7e8e892f4eef8880554c0310b9cd4e8bd6; verificación de GitHub remoto. Inventario estático de dependencias declaradas y cadena de CI. No equivale a SBOM transitiva ni a escaneo de vulnerabilidades completo.

## Cadena de herramientas verificada
| Área | Componente | Versión/configuración comprobada | Evidencia |
|---|---|---|---|
| Android | Android Gradle Plugin | com.android.application 9.2.0 | android/build.gradle.kts |
| Android | Gradle ejecutado por CI | 9.4.1 | .github/workflows/android-companion.yml y android-release-candidate.yml |
| Android | JDK y bytecode Java | Temurin 17 / Java 17 | workflows, android/app/build.gradle.kts |
| Android | SDK | compileSdk 36, targetSdk 36, minSdk 26, build tools 36.0.0 | android/app/build.gradle.kts y CI |
| Android | Versión de producto inalterada | 4.1.1 / versionCode 38 | android/app/build.gradle.kts |
| Node | Node 24 en CI; engines >=24 | sin paquetes externos declarados | package.json; workflows |
| Node | Gestor/bloqueo | npm para scripts; no package-lock.json encontrado | árbol Git de desarrollo, 409 entradas |
| Deno | denoland/setup-deno@v2, deno-version v2.x | runtime no fijado a patch; sin deno.lock identificado | Android CI / árbol |
| Supabase | supabase-js | npm:@supabase/supabase-js@2.117.2 | supabase/functions/android-companion/index.ts |
| Supabase CLI | supabase/setup-cli@v1 | versión exacta CLI no fijada en workflow | .github/workflows/android-release-candidate.yml |
| Firebase | firebase-messaging | 25.1.3 | android/app/build.gradle.kts |
| Ubicación | play-services-location | 21.4.0 | android/app/build.gradle.kts |
| GitHub Actions | checkout, setup-node, setup-java, gradle setup-gradle | v5, v5/v6, v5, v4 en base | .github/workflows/*.yml |
| GitHub Actions | denoland/setup-deno, supabase/setup-cli | v2, v1 | workflows Android |
| GitHub Actions | upload/download artifact | upload v7, download v5 en workflows revisados | workflows Android |
| GitHub Actions | Android emulator runner | reactivecircus/android-emulator-runner@v2 | android-release-candidate.yml |
| GitHub Actions | despliegue Pages manual | actions/deploy-pages@v4 | .github/workflows/pages.yml |

No existe android/gradle/wrapper/gradle-wrapper.properties en el árbol de desarrollo. El Gradle activo procede de la instalación explícita en CI. No confundir un wrapper ausente con Gradle ausente.

## Dependencias Android declaradas directamente
| Familia | Artefacto | Versión |
|---|---|---|
| AndroidX Core | androidx.core:core | 1.17.0 |
| AndroidX Activity | androidx.activity:activity | 1.13.0 |
| AndroidX Fragment | androidx.fragment:fragment | 1.9.1 |
| AndroidX Biometric | androidx.biometric:biometric | 1.1.0 |
| AndroidX WorkManager | androidx.work:work-runtime | 2.11.2 |
| AndroidX WebKit | androidx.webkit:webkit | 1.15.0 |
| CameraX | camera-core, camera-camera2, camera-lifecycle, camera-view, camera-video | 1.5.3 cada una |
| JUnit | junit:junit | 4.13.2 |
| Android test | androidx.test:core, runner, rules | 1.7.0 cada una |
| Android test | androidx.test.ext:junit | 1.3.0 |
| Android test | androidx.test.espresso:espresso-core | 3.7.0 |
| Android test | androidx.test.uiautomator:uiautomator | 2.4.0 |
| Cloud | Firebase Messaging | 25.1.3 |
| Google Play | Play services location | 21.4.0 |

## Integraciones y límites del inventario
Android Java/WebViewAssetLoader, puente JavaScript-nativo, cámara, audio, geolocalización, widgets, FCM, GIPHY y Supabase Edge Functions/SQL/Auth/Realtime/Storage forman un sistema acoplado. Supabase JS usa una importación npm con versión explícita; otras importaciones Edge locales están en supabase/functions/android-companion. No se identificaron dependencias npm directas en package.json. No se han calculado aún las transitivas de Gradle, las versiones resueltas de Deno ni hashes de artefactos: requieren `dependencies`, lock reproducible, SBOM o escaneo en ejecución. Las variables/credenciales no se inventarían en texto.

## Línea base y trazabilidad
- desarrollo: 86a12d7e8e892f4eef8880554c0310b9cd4e8bd6
- qa y prod: f5262991f3ab3fc65a6b39da2231915a453a9112
- main: 8ab4f84bdf15e560e53b0e834dd418128d7b3fcc
- PR #113 (auditoría F1) permanece abierto, NO fusionar por ser referencia de diagnóstico.
- PR #114 (F2) fusionado en desarrollo y habilita únicamente estabilización aislada, no promoción.
- CI anterior PR #114: cinco workflows consultados en SHA 0404de92 terminados SUCCESS; se requiere comprobar de nuevo cualquier commit con dependencias.
