# Nuestra Galaxia 4.1.1 — Fase 4: acta de salida técnica a desarrollo

**Fecha:** 12 octubre 2026 (America/Bogota)  
**Tipo de decisión:** **APTO PARA INICIAR LA SIGUIENTE FASE DE DESARROLLO** con controles; **NO GO PARA DESPLEGAR PRODUCCIÓN NI PUBLICAR ANDROID STABLE**.  
**Objeto:** separar la conclusión de tareas de ingeniería/QA verificables de los criterios adicionales de aceptación física y publicación.

## 1. Identidad del candidato y límites

- Rama de código evaluada: `qa@ab891a8532dd66dbb2440a78e809287554875b02`; `desarrollo@9194962afd929757c4d3105ea3816ab7132015e1`.
- Android Release Candidate [run #38018135138](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38018135138): **7/7 jobs SUCCESS**. Comprobados `F4_QA_REMOTE_GATE=VERIFIED`, `F4_FCM_LIVE_GATE=VERIFIED` y limpieza de identidades efímeras QA en CI.
- APK final firmada de QA: paquete `com.nuestragalaxia.companion.qa`, versión `4.1.1-qa` / code38, SHA256 `762c9e771f07eefdb8b834c904e2efa69e6d8c4f697c22a74a7866c7bd6c4ca7`. NO confundir con `android-candidate` (release con backend productivo).
- QA backend: `vwtcncvmwjfywrzjmskw` (independiente de producción); ambos perfiles del backend QA **comparten historial y fan-out por persona**. No crear pares sintéticos ni emitir live push mientras exista dispositivo/token activo no clasificado.
- Evidencia íntegra local: `C:\Users\juans\Galaxia-QA-20261009-artifacts\RC-38018135138\physical-20261010\round2\PHYSICAL-RESULTS.md`, `physical-20261012\RESULTS.md`, y `physical-20261012\hermetic\*.txt`. Esta acta NO copia tokens, medios, mensajes, coordenadas ni nombres de dispositivos privados.

## 2. Evidencia afirmativa

| Área | Resultado | Nivel de cobertura |
|---|---|---|
| GitHub Android RC / instrumentación / QA remoto y proveedor Firebase | **PASS** | 7/7 CI del SHA final, 4 gates y firma/hash |
| Moto g75 5G Android16 ↔ AVD Android15, SMS/chat FCM y bandeja | **PASS acotado** | Trabajo físico 10/oct: FCM foreground, ambos sentidos background, notificación con proceso ausente tras `am kill` en Moto, tap a chat correcto; perfiles sintéticos revocados |
| GPS físico: consentimiento, muestra, servicio y pausa/revocación | **PASS acotado** | 10/oct: una muestra del Moto, servicio detenido y contador estable; no recorrido real |
| Cámara foto/video nativo, revisión, descarte, picker | **PASS smoke** | 10/oct: sin upload ni medio personal; no sustituye estrés de CameraX |
| Arranque de APK firmada en Moto + AVD nuevo vacío | **PASS** | 12/oct: ambos ADB simultáneos, app QA separada, AVD cold start 4294 ms |
| Ciclo foreground/background, offline/restablecimiento y rotación en AVD | **PASS acotado** | 12/oct: modo avión 0→1→0, Activity viva; rotación 1/0/3/0 con configuración restaurada |
| Repetibilidad de foco WebView, composer y cámara/picker | **PASS 9/9** | Tres ejecuciones seguidas de cada uno de tres métodos de `GalaxyDeviceClosureTest`; archivos de instrumentación, `OK (1 test)` / `INSTRUMENTATION_CODE: -1` = éxito Android |
| QA simulado: ETA live/paused/stale/offline, consentimiento y stop GPS, deeplink por destinatario, 13 tarjetas/send | **PASS 4/4** | `QaHttpServer` local, sin tráfico de escritura a QA backend. Subtotal instrumentación incremental **13/13 PASS** |
| Política RLS GPS QA | **PASS estructural** | 12/oct lectura de las cuatro políticas SELECT: `galaxy_person() IS NOT NULL` en formato SQL normalizado `((SELECT galaxy_person()) IS NOT NULL)`; no contenido privado |
| Higiene permisos durante tests | **PASS** | Tras instrumentación se revocaron cámara, mic, coarse/fine GPS y notificaciones de la app hermética en emulador; APK QA permaneció con permisos denegados |

**Precisión sobre compilaciones:** Las 13 ejecuciones herméticas corrieron sobre un APK de test local `com.nuestragalaxia.companion.f4qatest` derivado del checkout QA anterior (incluyendo cambios locales de harness), configurado exclusivamente a `http://127.0.0.1:18765`; **no deben atribuirse como tests repetidos del binario firmado final**. El RC del SHA final sí aprobó su instrumentación CI; y las comprobaciones de instalación/lifecycle del APK final se hicieron independientemente en ambos dispositivos.

## 3. Riesgos residuales y responsable

**Bloquean publicación a producción / Android stable, pero no la creación de ramas para nuevas funcionalidades:**

1. [#147](https://github.com/Berserky/Galaxia-de-girasoles/issues/147): recorrido GPS/ETA real en movimiento, continuidad de segundo plano y autonomía de batería **sin USB** (necesita sesión consentida de campo); segundo móvil físico adicional si se exige diversidad OEM.
2. [#133](https://github.com/Berserky/Galaxia-de-girasoles/issues/133): pruebas de replay deliberado de `eventId`, offline/reconexión de chat entregado por proveedor y cambio de identidad con FCM tardío. No enviar a los perfiles compartidos mientras exista token QA activo no atribuido; preferir simulador hermético para funcionalidad, y un envío proveedor dirigido solo si se demuestra aislamiento.
3. [#129](https://github.com/Berserky/Galaxia-de-girasoles/issues/129): intermitencia histórica de foco/CameraX CI. Tres rondas locales PASS disminuyen incertidumbre, no establecen causa raíz; falta estrés prolongado real y picker/upload con medios íntegramente sintéticos.
4. [#131](https://github.com/Berserky/Galaxia-de-girasoles/issues/131): guardia NULL de cápsulas verificada en QA, **no autorizada/comprobada en producción en esta sesión**. Revisión de seguridad y plan de despliegue independiente.
5. [#125](https://github.com/Berserky/Galaxia-de-girasoles/issues/125): cuatro SELECT GPS revisadas en QA; falta confirmación y evidencia de aprobación/verificación de producción bajo ventana separada.
6. Pruebas de performance sostenida, bloqueo de errores P0/P1 y aceptación explícita de release con rollback siguen siendo **criterios independientes**. Un `7/7` CI no reemplaza aprobación de producción.

## 4. Decisión de avance / control de release

- **GO al siguiente desarrollo:** se pueden crear nuevas ramas desde `desarrollo` conforme a gobernanza, manteniendo QA/stable existentes intactos. La deuda anterior se conserva como issues con responsable y evidencia; cualquier funcionalidad que toque FCM/GPS/cámara debe incorporar regresión específica y no degradar los controles.
- **NO GO a release productiva:** prohibido promover `qa→prod`, ejecutar migraciones/Edge productivas, cambiar `android-stable` o reemplazar APK estable sin gate separado y aprobación explícita.
- El issue #147 permanece abierto como **acta del gate físico y de producción**; no lo cerrar para sugerir que todas las pruebas de campo están completas. El issue #129 permanece abierto como **deuda de flakiness**.
- Esta PR es **solo documentación**. No cambia fuentes Android, esquemas, funciones, workflows ni configuraciones.
