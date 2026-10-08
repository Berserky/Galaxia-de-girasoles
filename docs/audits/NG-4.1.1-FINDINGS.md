# Nuestra Galaxia 4.1.1 — Registro de hallazgos

Fecha: 2026-10-08 | Rama base: `f5262991f3ab3fc65a6b39da2231915a453a9112` | Solo diagnóstico.

## Distribución de hallazgos con evidencia

| Severidad | Cantidad | Aclaración |
|---|---:|---|
| P0 | 0 | Ninguna pérdida/exposición reproducida. No equivale a ausencia definitiva de riesgos. |
| P1 | 0 | No se reprodujo caída de una función principal con la cobertura disponible. |
| P2 | 1 | Colisión de firmas en entorno previo de QA, **no** regresión de producción. |
| P3 | 2 | Desactualización documental y usabilidad de onboarding horizontal. |

Los 14 errores históricos se revisaron como hipótesis, **no** se añadieron al conteo de defectos sin reproducción. Los módulos vinculados siguen pendientes de E2E.

## NG-AUD-001 — Choque de firmas al mezclar APK QA antiguo y APK estable
- **Módulo / función:** QA Android / instalación sobre un APK previo.
- **Severidad:** P2 de **infraestructura de pruebas**; impacto productivo no demostrado.
- **Estado comprobado:** REPRODUCIDO únicamente en el AVD QA preexistente; RESUELTO PARA LA PRUEBA mediante AVD temporal limpio (sin cambiar código).
- **Descripción:** `adb install` de `NuestraGalaxia-android-stable.apk` sobre `com.nuestragalaxia.companion` 4.1.0 instalado previamente devolvió `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. El paquete previo declaró `versionCode 37`; el APK oficial 4.1.1 declara 38.
- **Pasos para reproducir:** 1) Usar el AVD `NuestraGalaxia_QA_API35` con APK previo 4.1.0 y distinta firma. 2) Instalar el APK stable oficial con `adb install`. 3) Observar rechazo. 4) Repetir en el AVD temporal vacío: instalación correcta.
- **Esperado:** Las pruebas de APK estable deben ejecutarse en un AVD limpio o en una instalación con certificado de firma compatible.
- **Obtenido:** Incompatibilidad de firmas en AVD antiguo; `Success` con instalación fresca y arranque funcional 4.1.1.
- **Evidencia:** Salida de ADB registrada durante auditoría; `adb dumpsys package` 37 antes y 38 después en el AVD temporal; <https://github.com/Berserky/Galaxia-de-girasoles/releases/tag/android-stable>.
- **Componente:** `android/app/build.gradle.kts` (debug usa `QA_APPLICATION_SUFFIX` opcional con valor vacío de reserva); imagen de emulador heredada.
- **Causa confirmada:** Certificados de firma no coinciden en el AVD antiguo. **Hipótesis separada:** el uso del mismo `applicationId` en QA sin sufijo propició la colisión; verificar procedencia exacta del APK anterior.
- **Impacto / riesgo:** Bloquea pruebas QA y puede confundirse con una regresión de actualizador. No afecta el upgrade oficial certificado por CI.
- **Recomendación:** Estándar QA con `applicationIdSuffix` explícito y/o AVD limpio; nunca mezclar APK de firmas distintas. Mantener prueba de upgrade usando binarios de la misma familia de certificados.
- **Prueba de regresión:** Instalar desde cero en AVD efímero; upgrade solo entre certificados coincidentes; comprobar rechazo esperado de firma ajena.

## NG-AUD-002 — README Android alude a rama histórica `main`
- **Módulo / función:** Gobernanza / documentación del proceso de release.
- **Severidad:** P3.
- **Estado comprobado:** REPRODUCIDO por inspección de documentación y workflow.
- **Descripción:** `android/README.md` aún afirma que `main` genera el Release Candidate, mientras que `.github/workflows/android-release-candidate.yml` se ejecuta en `qa` y la rama base de desarrollo es `desarrollo`.
- **Pasos:** Abrir README Android y comparar con el trigger `on.push.branches: [qa]` del workflow.
- **Esperado:** Instrucciones coherentes con desarrollo → qa → prod y main histórica.
- **Obtenido:** Referencia histórica engañosa.
- **Evidencia:** <https://github.com/Berserky/Galaxia-de-girasoles/blob/prod/android/README.md> y <https://github.com/Berserky/Galaxia-de-girasoles/blob/prod/.github/workflows/android-release-candidate.yml>.
- **Componente:** `android/README.md`.
- **Causa confirmada:** Texto de documentación no migrado; no implica funcionamiento defectuoso del workflow.
- **Impacto / riesgo:** Desorientación durante futuras publicaciones y uso de rama incorrecta por colaboradores.
- **Recomendación:** Actualizar documentación durante fase autorizada de corrección documental; no tocar pipelines en esta auditoría.
- **Regresión:** Test documental que valide los nombres de ramas contra los triggers reales.

## NG-AUD-003 — Acción de vinculación fuera de la primera pantalla horizontal
- **Módulo / función:** Onboarding Android / responsive.
- **Severidad:** P3 (oportunidad UX; **no** bloqueo funcional).
- **Estado comprobado:** REPRODUCIDO visualmente en el AVD limpio, Android API35 y APK stable 4.1.1.
- **Descripción:** Al girar a horizontal, el primer viewport muestra encabezado y párrafo; el campo y CTA quedan inicialmente bajo el pliegue. Un swipe vertical permite llegar al formulario íntegro.
- **Pasos:** 1) Instalar APK stable en AVD limpio. 2) Sin vincular, girar horizontal. 3) Observar el primer viewport. 4) Deslizar hacia arriba.
- **Esperado:** CTA visible o indicación clara de que hay contenido más abajo, especialmente en paisaje.
- **Obtenido:** CTA accesible solo tras desplazarse; no hay recorte permanente.
- **Evidencia:** [Captura inicial](evidence/NG-411-ONBOARDING-LANDSCAPE.png) y [captura tras desplazamiento](evidence/NG-411-LANDSCAPE-SCROLL.png).
- **Componente:** `android/app/src/main/assets/mobile/app.css` y vista de onboarding en `app.js`.
- **Causa probable (no confirmada):** Tarjeta central y tipografía dimensionadas principalmente para vertical.
- **Impacto / riesgo:** Fricción menor para una primera vinculación horizontal.
- **Recomendación:** Compactar onboarding para landscape o incorporar pista de scroll; no rediseñar en fase diagnóstica.
- **Regresión:** Screenshot test API35 portrait/landscape con campo y CTA accesibles sin superposición del sistema.

## Comprobación de las 14 regresiones históricas

| # | Hipótesis | Clasificación | Justificación |
|---:|---|---|---|
| 1 | Saltos del scroll de Galaxy Chat | NO VERIFICABLE EN ESTE ENTORNO | Motor Node PASS; no conversación E2E emparejada |
| 2 | Apertura lenta de conversaciones | NO VERIFICABLE EN ESTE ENTORNO | Sin medición de apertura real de hilo |
| 3 | Permisos de cámara y micrófono | NO VERIFICABLE EN ESTE ENTORNO | Bloqueado por vinculación QA |
| 4 | Controles superpuestos de foto/video | NO VERIFICABLE EN ESTE ENTORNO | No capturas de las actividades de cámara 4.1.1 |
| 5 | Adjuntar multimedia | NO VERIFICABLE EN ESTE ENTORNO | Contratos y CI PASS; UI real no probada |
| 6 | Mapa sin distancia/ETA | NO VERIFICABLE EN ESTE ENTORNO | Cálculos distance/eta Node PASS; no dos ubicaciones QA |
| 7 | IA escondida | NO VERIFICABLE EN ESTE ENTORNO | Nav contiene botón IA, no probada con sesión |
| 8 | Nuestros objetivos no abre | NO VERIFICABLE EN ESTE ENTORNO | goalsView y pruebas motor existen, navegación real no ejecutada |
| 9 | Token de invitación asigna perfil incorrecto | NO VERIFICABLE EN ESTE ENTORNO | Sin dos identidades QA ni token efímero |
| 10 | Música por URL | NO VERIFICABLE EN ESTE ENTORNO | Sin streaming ni perfil vinculado |
| 11 | Stickers/GIF compatibilidad producción | NO VERIFICABLE EN ESTE ENTORNO | Atribución GIPHY en contratos PASS, proveedor real no probado |
| 12 | FCM y registro de dispositivos | NO VERIFICABLE EN ESTE ENTORNO | CI pasa, sin entrega push real |
| 13 | Pérdida de estado con orientación | NO VERIFICABLE EN ESTE ENTORNO | Onboarding giró bien; estado de sesiones activas no probado |
| 14 | Sincronización entre dos usuarios | NO VERIFICABLE EN ESTE ENTORNO | Dos identidades QA no aprovisionadas |

## Riesgos en estudio, NO declarados como defectos
- **P0 potencial:** aislamiento RLS de ubicaciones, archivos y tokens. Existe cobertura automatizada pero **no** hubo pruebas adversariales reales con dos identidades efímeras; no se puede emitir PASS de aislamiento E2E.
- **P1 potencial:** sincronización, pérdida de mensajes, perfiles y notificaciones; dependiente de dos cuentas QA.
- **P2 potencial:** tiempos del Chat, batería del GPS y uso de memoria en sesiones prolongadas; sin perfiles dinámicos.
- **Integraciones:** validez de proveedor GIPHY, FCM y modelos de IA en QA/producción; no consultar secretos ni modificar políticas en esta fase.

## Precisión de la evidencia
- Los 603 tests Node y siete jobs CI pasan. Son evidencia de contratos, migraciones e instrumentación en CI, no equivalen a pruebas manuales completas de toda la UI.
- El APK oficial SHA256 comprobado localmente: `4C10F614235D3ED509D89A4BC9EAF37631A7D4681943EA07F852628E1F15147F`.
- Ninguna característica que solo apareció en el código fue clasificada como completamente funcional por mera presencia.
