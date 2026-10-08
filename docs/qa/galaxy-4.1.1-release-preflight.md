# Nuestra Galaxia 4.1.1 — GIPHY / FCM / Egress

## Why versionCode 38
- Current immutable stable before this patch: Android 4.1.0, versionCode 37, SHA `114a50c57a5114927a4846eafde223880faab6fc`, candidate run `37721755932` (verified from published `android-stable/update.json`).
- The incoming QA integration cannot reuse `versionCode 37`; must increase to 38 for Android in-place updates.
- Release version is `4.1.1` (patch update); preserve historical 4.1.0 milestone reports.

## Gates
1. PR CI 17/17 PASS on version bump HEAD.
2. GitHub Actions main-push signed candidate with upgrade 4.1.0 -> 4.1.1, OIDC dual-user staging, security and DB replay all PASS.
3. Supabase production Edge Function updated from same reviewed commit; verify JWT behavior remains custom device-token based, `verify_jwt=false` unchanged.
4. Production Firebase credentials and public client config independently verified available from authenticated `push-client-config`.
5. GitHub Stable Promotion only after candidate gate ledger, signing continuity, and Auth posture; release update.json SHA/version must match APK.

## Current blocking finding
- On 2026-10-08, the existing production Supabase Edge Function v26 returned HTTP 503 for an authenticated `push-client-config` request. QA version does respond and E2E FCM PASS. Do not report production FCM PASS until production secrets are configured and verified. The temporary production preflight device token was revoked and destroyed.
- GIPHY API beta keys are rate limited; production key status must be reviewed for scale.
- Current Supabase Free egress already exceeded monthly transfer allowance; mitigation cannot be declared effective before production measurements.
