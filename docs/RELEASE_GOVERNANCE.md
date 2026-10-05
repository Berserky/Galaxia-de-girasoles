# Release governance

Este documento describe el proceso operativo vigente de Nuestra Galaxia desde la Fase 6. La promoción Android queda separada del desarrollo normal para que ningún push ordinario pueda sustituir silenciosamente el canal estable.

## Flujo

**PR → CI → main → candidate → staging/smoke → approval explícito → stable**

### 1. PR → CI

Los pull requests ejecutan las comprobaciones correspondientes al área modificada. Para Android, `.github/workflows/android-companion.yml` es CI puro:

- Deno type checks y pruebas del Edge Function;
- QA de JavaScript móvil;
- Android unit tests;
- Android Lint;
- build debug y release no firmado.

La Fase 5 conserva la instrumentation real, lifecycle, permisos, orientación, font scaling, dark mode y demás cobertura de dispositivo.

El workflow de CI no tiene `contents: write`, no escucha pushes de `main` y no contiene comandos de publicación de `android-stable`.

### 2. main → candidate

Cada commit de `main` activa `.github/workflows/android-release-candidate.yml`.

Antes de producir el candidate se exigen:

- suite Node completa;
- security regressions;
- Deno/type checks y tests;
- replay limpio de migraciones Supabase/PostgreSQL;
- RLS/chat DB smoke;
- Android unit tests;
- Android instrumentation y lifecycle;
- Android Lint;
- firma con el keystore de release;
- verificación criptográfica de la firma;
- SHA-256 del APK.

El resultado es el artefacto privado de Actions `android-candidate`. No es una GitHub Release y no modifica `android-stable`.

### 3. candidate → staging/smoke

El mismo run debe superar el smoke remoto usando un entorno QA separado de producción:

- `QA_STAGING_EDGE_URL`;
- `QA_STAGING_PUBLISHABLE_KEY`;
- `QA_STAGING_TOKEN_0`;
- `QA_STAGING_TOKEN_1`.

El smoke reutiliza el probe dual-user de Fase 5 y debe terminar con estado `VERIFIED`. La ausencia de staging ya no cuenta como éxito para un release candidate: el run queda bloqueado y por tanto no puede promoverse.

Al completar todos los gates se publica el artefacto `android-candidate-evidence` con el ledger de gates y la evidencia del smoke.

### 4. approval explícito → stable

`.github/workflows/android-release-stable.yml` es el único workflow autorizado para ejecutar:

`gh release upload android-stable ... --clobber`

Solo se inicia manualmente mediante `workflow_dispatch`. Requiere:

1. el Run ID de un `Android Release Candidate`;
2. confirmar `GOOGLE_ONLY_OR_LEAK_PROTECTION_ENABLED` después de revisar Auth;
3. confirmar `PROMOTE_ANDROID_STABLE`;
4. pasar el environment `android-stable`.

Antes de escribir la release vuelve a comprobar:

- que el run proviene de un `push` a `main`;
- que concluyó en `success`;
- que el SHA del artefacto coincide con el SHA del run;
- todos los gates del ledger;
- staging smoke `VERIFIED`;
- checksum SHA-256;
- firma APK válida;
- continuidad del certificado de firma respecto al APK estable actual;
- `versionCode` estrictamente mayor al publicado.

El environment `android-stable` debe configurarse en GitHub con required reviewer cuando la configuración del repositorio/plan lo permita. El dispatch manual y las dos confirmaciones siguen siendo obligatorios aunque exista ese reviewer.

## NG-QA-007 — protección de android-stable

Antes de Fase 6, `android-companion.yml` reaccionaba a cambios en `main` y podía ejecutar `gh release upload android-stable --clobber` cuando detectaba una nueva versión. Ese comportamiento se eliminó.

Regla operativa: **un push normal a `main` puede producir un candidate, nunca reemplazar `android-stable`.**

## NG-QA-019 — password leak protection

Revisión productiva realizada el 5 de octubre de 2026:

- Supabase Auth contiene identidades Google;
- existen **0 usuarios con contraseña**;
- la aplicación usa Google OAuth como modelo efectivo actual;
- la UI conserva `signInWithPassword` como capacidad disponible;
- el Security Advisor de Supabase reporta `Leaked Password Protection Disabled`.

La protección de contraseñas filtradas no protege el flujo Google OAuth y hoy no existe una credencial de contraseña productiva a la cual aplicarla. Por eso el warning no bloquea por sí solo mientras el modelo real siga siendo Google-only.

Sin embargo, si se crea cualquier usuario con contraseña o se decide operar login por contraseña, **stable queda bloqueado hasta habilitar Leaked Password Protection** en Supabase Auth. La confirmación manual `GOOGLE_ONLY_OR_LEAK_PROTECTION_ENABLED` obliga a revisar esta condición antes de cada promoción.

No se debe interpretar esa confirmación como sustituto de la revisión: quien promueve debe comprobar el Security Advisor y el modelo de identidades vigente.

## NG-QA-020 — arquitectura operativa vigente

### Web

GitHub Pages se construye desde `app/public` + `app/cloud` y usa Supabase para Auth/datos. El workflow `pages.yml` publica la web desde `main`; este despliegue es independiente del canal Android estable.

### Backend

Supabase/PostgreSQL mantiene datos, RLS, Storage y migraciones. `android-companion` concentra el contrato móvil/Edge. Los workflows DB validan replay, privacidad e invariantes antes de cambios relevantes.

La Fase 6 **no despliega** migraciones ni Edge Functions a producción como efecto lateral.

### Android

La app empaqueta su UI móvil local, usa bridge nativo y consume `android-companion`. El updater solo consulta `android-stable/update.json`; el candidate no se presenta a usuarios finales.

## Operación de una release

1. Mergear el cambio a `main`.
2. Abrir Actions → **Android Release Candidate**.
3. Confirmar que el run terminó `success`; si staging falta o falla, corregir staging y generar un nuevo candidate válido.
4. Revisar Security Advisor/Auth. Si hay usuarios con contraseña, confirmar que Leaked Password Protection está habilitado.
5. Comprobar que `versionCode` es mayor al stable actual.
6. Ejecutar manualmente **Android Stable Promotion** con el Run ID.
7. Introducir las dos confirmaciones requeridas.
8. Aprobar el environment `android-stable` si tiene reviewer configurado.
9. Verificar después de la promoción que `update.json` y el APK publicado comparten checksum y versión esperados.

## Regla de esta fase

La Fase 6 modifica únicamente la gobernanza de release y su documentación/pruebas. No incrementa `versionCode`/`versionName` y no ejecuta la promoción estable.
