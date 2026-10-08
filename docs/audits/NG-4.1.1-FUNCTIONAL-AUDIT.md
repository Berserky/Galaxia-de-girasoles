# Nuestra Galaxia 4.1.1 — Auditoría funcional integral (Fase 1/5)

**Fecha:** 2026-10-08 · **Tipo:** diagnóstico no destructivo · **Repo:** [Berserky/Galaxia-de-girasoles](https://github.com/Berserky/Galaxia-de-girasoles) · **Estado del informe:** auditoría técnica y smoke no autenticado completados; flujos emparejados documentados como BLOQUEADOS, no aprobados.

## 1. Resumen ejecutivo

- Inventario de **92 unidades verificables** en [matriz](NG-4.1.1-FUNCTIONAL-MATRIX.md): **19 PASS**, **65 BLOCKED**, **8 NOT TESTED**. Los PASS incluyen pruebas **de contrato/motor** y de instalación/onboarding; no significan 19 journeys completos de una pareja.
- Verificación Node local: **603 tests aprobados / 0 fallidos / 0 omitidos**; duración reportada ~3 segundos, ejecutados en copia aislada exactamente desde `desarrollo` actual. `npm test` se volvió a ejecutar solamente para validar la línea base local independiente y comprobar que la copia de trabajo es reproducible.
- [Android Release Candidate run 37808030670](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/37808030670): **SUCCESS**, 7 de 7 jobs. Los jobs ya aprobados de Android instrumentado, upgrade, lint y CI no se repitieron.
- APK `android-stable`: **4.1.1 / versionCode 38**, paquete `com.nuestragalaxia.companion`. Instalación limpia, pantalla de vinculación offline, giro a paisaje con scroll y reapertura **PASS** en AVD efímero Android API35; sin uso del móvil personal ni credenciales reales.
- **0 P0, 0 P1, 1 P2 (entorno QA), 2 P3 (documentación/UX)** observados con evidencia. No inferir que las áreas no probadas carecen de defectos.
- **Dictamen:** la base de código/CI y el arranque limpio son verificables; la auditoría **no puede declarar PASS integral de las funciones emparejadas** sin dos identidades efímeras QA y pruebas reales sobre backend aislado. Los bloqueos restantes están explícitos, no ocultos.

## 2. Ficha de línea base verificada

| Campo | Comprobación |
|---|---|
| desarrollo | `f5262991f3ab3fc65a6b39da2231915a453a9112` |
| qa | `f5262991f3ab3fc65a6b39da2231915a453a9112` |
| prod | `f5262991f3ab3fc65a6b39da2231915a453a9112` |
| main histórica | `8ab4f84bdf15e560e53b0e834dd418128d7b3fcc` |
| Tag anotada `release/android-4.1.1-source` | objeto tag `7a040541d4b9e95950969718b678aa7e57efbf69`; apunta al commit `8ab4f84b...` |
| Comparación source → prod | 4 commits adelante; archivos modificados de workflows, dependabot, tests y docs de gobernanza. **Ninguna diferencia funcional Android/app detectada** en el diff de GitHub. |
| Gradle / Android | `applicationId=com.nuestragalaxia.companion`, minSdk 26, targetSdk/compileSdk 36, version 4.1.1 code38 |
| APK oficial | [Android stable](https://github.com/Berserky/Galaxia-de-girasoles/releases/tag/android-stable), 16 347 926 bytes; SHA-256 local `4C10F614235D3ED509D89A4BC9EAF37631A7D4681943EA07F852628E1F15147F` |
| CI candidato | [37808030670](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/37808030670), `qa`, sha `f5262991`, success |
| PC autorizado | Windows, Git 2.55, Node 24.21, Java 17, ADB 37, SDK 36, Android AVD API35 |
| Herramienta local faltante | `gradle` no resolvió desde PATH; recompilación Android local omitida, con CI equivalente aprobada |

**Comandos de anclaje:** `git fetch origin --prune`; `git rev-parse origin/desarrollo origin/qa origin/prod origin/main`; `git status --short`; `npm test`; `adb devices`; `aapt dump badging`; `adb install`; `adb shell am start`; `adb shell dumpsys package`.

## 3. Jobs de CI ya aprobados (reutilización de evidencia)

| Job | Estado |
|---|---|
| DB migration replay | SUCCESS |
| Android instrumentation | SUCCESS |
| Android unit + lint | SUCCESS |
| Node + Deno + security | SUCCESS |
| Signed candidate + checksum | SUCCESS |
| Upgrade install over current stable | SUCCESS |
| Candidate staging smoke | SUCCESS |

Artifacts asociados: `android-candidate`, `android-candidate-evidence`, `android-candidate-instrumentation`, `android-candidate-upgrade-smoke`. Existían y no estaban vencidos al consultar el run. Para repeticiones, consultar el run antes de correr pruebas equivalentes.

## 4. Arquitectura examinada

- **Web / servidor:** `app/server.mjs`, `app/google.mjs`, `app/domain.mjs`, `script.js`, `style.css` y assets del sitio; OAuth y acceso de la web requieren QA autenticado.
- **Android:** Activities Java, `MainActivity.java`, `GalaxyBridge.java`, `DeviceStore.java`, `CloudMediaStore.java`, `PushManager.java`, `TrackingService.java`, `GalaxyFirebaseService.java`, `UpdateManager.java`. Recursos web empaquetados en `android/app/src/main/assets/mobile/` (se comprobó que existen `index.html`, `app.js`, `app.css`, motores chat/GPS/tema y sus dependencias).
- **Chat:** módulos separados de mensajes, scroll, composer, media, voz, motion, delivery y performance; tests Node dedicados y suite de instrumentación en CI.
- **Edge / seguridad:** `supabase/functions/android-companion/index.ts` con control de acciones; scripts de RLS, privacidad y migraciones en `tests/` y `supabase/`. Contratos pasan; no se ejecutó penetración contra QA o producción.
- **Dependencias externas:** Supabase Edge/DB/Storage, Firebase Cloud Messaging, proveedor GIPHY, servicios de IA, OAuth y proveedores musicales. No se leyeron/imprimieron secretos ni se modificó la infraestructura.

## 5. Resultado por dominio

| Dominio | Evidencia positiva | Restricción | Estado global prudente |
|---|---|---|---|
| Identidad | Pantalla y APK sin datos PASS; pruebas contratos | No se emitieron tokens ni se ejecutó doble usuario | BLOCKED para identidad real |
| Galaxy Chat | Motores y contratos automatizados PASS | Sin cuentas ni E2E de scroll/realtime | BLOCKED |
| Cámara y multimedia | Validación y contratos Node/CI | Sin flujo capturar-subir-recibir | BLOCKED |
| Música | Implementación/entradas identificadas | Sin pista QA ni proveedor real | BLOCKED |
| Mapas/GPS | Distancia, ETA y contratos PASS | Sin dos posiciones y sesión de tracking | BLOCKED |
| Objetivos y momentos | Contratos goals PASS; `goalsView` identificada | Sin navegación bajo vinculación | BLOCKED |
| IA | Motor de contratos PASS; nav define sección IA | Sin consultas autenticadas ni prueba privacidad real | BLOCKED |
| FCM y notificaciones | Contratos + CI Android PASS | Sin entregas foreground/background QA | BLOCKED |
| Onboarding / experiencia no vinculada | Instalación limpia, retrato, paisaje desplazable, reapertura | Módulos internos inaccesibles sin pareja | PASS limitado al onboarding |
| Privacidad/estabilidad | Tests automatizados y pantalla privada protegida pre-vínculo | Sin adversarial RLS viva, ANR prolongado, batería | BLOCKED para verificación integral |

**Importante:** no se diagnosticó como roto ningún módulo basándose únicamente en un reporte histórico. Tampoco se declaró resuelto por mera existencia de una función o un test de unidad.

## 6. Prueba Android independiente, segura y reproducible

1. Se creó un AVD temporal `NG_AUDIT_411_TEMP` desde la configuración Android API35, con imagen de usuario nueva, evitando modificar los AVD de QA existentes.
2. Se deshabilitaron conectividad Wi-Fi y datos **antes de instalar o abrir** el APK oficial. No hubo vinculación ni escritura remota a Supabase.
3. `adb install C:\\Users\\USUARIO_LOCAL\\NG-AUDIT-EVIDENCE\\NuestraGalaxia-android-stable.apk` → `Success`; `dumpsys package` → code38/name4.1.1.
4. `adb shell am start -n com.nuestragalaxia.companion/.MainActivity` abrió onboarding de código de vinculación sin mostrar contenido de pareja.
5. En horizontal el formulario requiere desplazamiento; una acción swipe permite acceder a input/CTA; ningún control quedó permanentemente fuera del alcance.
6. Se comprobó retorno desde Home, force-stop y nuevo arranque offline; transcurrida la carga inicial apareció de nuevo el onboarding. No se obtuvo una excepción fatal en el extracto de logcat revisado; **no es una prueba soak ni monitoreo exhaustivo de ANR**.
7. Se cerró el emulador temporal. No se usó el teléfono físico.

### Evidencias de pantalla

- [Inicio vertical](evidence/NG-411-ONBOARDING-PORTRAIT.png)
- [Inicio horizontal (primera pantalla)](evidence/NG-411-ONBOARDING-LANDSCAPE.png)
- [Horizontal tras desplazamiento (CTA alcanzable)](evidence/NG-411-LANDSCAPE-SCROLL.png)

### Incidencia aislada de entorno
El AVD anterior contenía 4.1.0 versionCode37 con firma incompatible para el APK estable; Android rechazó la actualización sobre esa instalación. El AVD **nuevo** instaló 4.1.1 y abrió sin problema. [NG-AUD-001](NG-4.1.1-FINDINGS.md) documenta la separación entre este problema QA y las pruebas oficiales de upgrade aprobadas por CI.

## 7. Seguridad, privacidad y rendimiento

**Comprobado:** configuración de paquete Android con permisos declarados, `allowBackup=false`, bloqueo de tráfico claro, presencia del sistema local WebView y servicio de tracking; presencia de lógica de tokens y almacenamiento, scripts RLS y tests automatizados; CI de Node+Deno+security / DB migration replay PASS.

**No demostrado:** que un usuario A nunca pueda leer una ubicación, imagen, audio o token de B mediante intentos adversariales reales; que todas las URLs firmadas expiren bajo ataques; que FCM desregistre tokens tras cambio de cuenta; que batería, memoria, ANR y reconexión sean aceptables en uso prolongado. Estas son obligaciones de la siguiente etapa de QA, no fallas declaradas.

**No se realizó:** lectura de secretos, modificación de RLS, deploy Edge, Firebase, web o APK, limpieza de datos privados reales ni promoción a `prod`.

## 8. Hallazgos y criterio de cierre

Consulte [hallazgos NG-AUD-001–003](NG-4.1.1-FINDINGS.md), [matriz de 92 unidades](NG-4.1.1-FUNCTIONAL-MATRIX.md) y [próximos pasos](NG-4.1.1-NEXT-STEPS.md).

**Cierre del trabajo ejecutable en entorno actual:** baseline, inventario, CI, tests Node, APK estable y flujo público/no vinculado obtenidos de forma reproducible. **Límite:** la condición original de verificación integral de *cada* flujo no puede certificarse con dos usuarios ausentes. No existe fundamento técnico para dar luz verde a una nueva versión basándose en los 19 PASS parciales. Plan de continuación detallado, sin inventar PASS, en NEXT-STEPS.
