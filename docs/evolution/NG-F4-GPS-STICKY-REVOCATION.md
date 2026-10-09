# Fase 4 — consentimiento GPS frente a reinicio y revocación

**Riesgo identificado:** `TrackingService` devuelve `START_STICKY`. Android puede recrear ese servicio con `Intent == null` después de recuperar recursos. Antes de la corrección, el servicio iniciaba ubicación y persistía `tracking=true` sin comprobar si seguía activa la elección del usuario. También podían quedar callbacks o puntos en cola cuando la cuenta se desvinculaba o se detenía GPS.

**Corrección:** una recreación automática sin intención explícita requiere `DeviceStore.tracking()==true`; intent desconocido no activa GPS. El inicio voluntario de `MainActivity` mediante `ACTION_START` permanece permitido. El servicio comprueba vinculación y consentimiento antes de procesar cada punto; una tarea de red ya encolada vuelve a validar ambas condiciones antes de transmitir. Sin vínculo, también borra el consentimiento local.

**Regresión:** `GalaxyGpsConsentDeviceTest.stickyRestartCannotResumeAfterGpsConsentWasRevoked` prueba escenarios opt-out, opt-in, revocación y acción desconocida sin activar GPS real. `tests/ng-f4-gps-sticky-consent.test.mjs` impide mover las guardias después de tomar o enviar coordenadas.

**Limitaciones:** esto no sustituye el E2E de GPS simulado, precisión, batería, pérdida de señal y permisos Android en segundo plano en múltiples dispositivos. No prueba producción ni usa ubicación personal. El cierre de Fase 4 requiere esos gates y autorización de release por separado.
