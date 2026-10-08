# Fase 4 — Prueba remota QA obligatoria (puerta GO)

El job existente `Dual-user remote staging` es **informativo**: cuando faltan credenciales, `scripts/qa-phase5-staging.mjs` devuelve código 78 y el job puede terminar verde pero indicando **NOT_EXECUTED**. Ese resultado NUNCA es un PASS E2E.

## Nuevo cierre estricto

- `node scripts/qa-phase4-strict-staging.mjs`: reutiliza el probe real. Si el probe devuelve 78 (credenciales faltantes), falla con código 1. Solo marca `F4_QA_REMOTE_GATE=VERIFIED` después de que el probe termine en 0.
- `QA_STAGING_EDGE_URL` debe ser exactamente el Edge endpoint HTTPS del proyecto **Nuestra Galaxia QA** `vwtcncvmwjfywrzjmskw`; así no se filtran tokens de dispositivos hacia hosts no autorizados. Se bloquea el proyecto productivo `zqiknzivfahvvadmxrvt`, URLs con credenciales o parámetros y tokens de perfiles duplicados.
- `.github/workflows/ng-phase4-qa-gate.yml`: los tests offline se ejecutan en PR; el job de E2E estricto se ejecuta cuando la variable GitHub `QA_STAGING_REQUIRED` se establece en `true` para la revisión formal de cierre.
- Las pruebas offline **no** establecen sesión remota, no crean mensajes ni completan QA real. El job obligatorio no puede estar considerado satisfecho si está omitido.
- Para GO se requiere E2E real con dos tokens distintos de QA (`QA_STAGING_TOKEN_0` y `QA_STAGING_TOKEN_1`), clave publishable QA y `QA_STAGING_EDGE_URL`; el script envía mensajes sintéticos, verifica lectura concurrente/mapa/backup y los elimina.
- Ningún secreto se debe guardar en documentación, comentarios de PR o artefactos CI. La acción `workflow_dispatch` solo estará disponible por defecto una vez que el workflow exista en la rama predeterminada de GitHub (actualmente `prod`); durante desarrollo, use el disparador PR y el gate que se habilita por variable. Esto no autoriza promover el PR a prod.

**Estado actual:** credenciales QA no confirmadas en GitHub; E2E obligatorio **NOT_EXECUTED**, GO prohibido.
