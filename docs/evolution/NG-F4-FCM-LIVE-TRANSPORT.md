# Fase 4 — FCM transporte real desde Firebase a Android en QA

**Gate nuevo, no certificado todavía.**

El `Android Release Candidate` ya crea y revoca dos identidades efímeras de QA mediante GitHub OIDC. Esta propuesta ejecuta un AVD API35 con Google APIs en el **mismo job protegido** antes del paso incondicional de revocación.

## Prueba exigida
1. La cuenta 0 pide `push-client-config` a Supabase QA (sin exponer claves en logs), inicializa Firebase y obtiene de Firebase un **token FCM real**.
2. Registra el token con `push-token-register` del backend QA; la cuenta 1 envía un mensaje de chat sintético.
3. Con la app abierta, espera una notificación Android real con `PendingIntent` de chat; vuelve a enviar con la app en segundo plano y confirma la entrega.
4. Desregistra el token FCM, desvincula el dispositivo, envía un tercer mensaje y comprueba que no aparece notificación privada tardía.
5. Limpia los mensajes sintéticos y tokens FCM en `finally`; el propio workflow revoca los tokens OIDC siempre, aunque la prueba falle.

## Control de evidencia
- `GalaxyFcmTransportQaTest` es prueba de transporte Google Firebase real, **no** invoca el handler directamente. En suites genéricas sin tokens OIDC se omite por diseño.
- `scripts/qa-f4-fcm-live.sh` exige un resultado JUnit ejecutado, exactamente 1 caso y **sin skipped/failure/error**; solo entonces emite `F4_FCM_LIVE_GATE=VERIFIED`.
- Las credenciales se ocultan en logs CI y se revocan. La ejecución solo está permitida en el contexto OIDC `refs/heads/qa` / release candidate, nunca PR de fuente ni producción.

**No declarar QA-FCM-01 PASS ni GO por la existencia de este PR.** Requiere ejecución verde de CI del PR, integración a `desarrollo`, promoción a `qa` aprobada y ejecución del Release Candidate con el marcador `F4_FCM_LIVE_GATE=VERIFIED`. Si falla por Play Services/GMS o configuración Firebase, registrar como BLOCKED real en vez de simular entrega.

Otros controles: GPS ETA/mock/background/ausencia de señal, privacidad integral y rendimiento siguen independientes.
