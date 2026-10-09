# NG-DEPENDENCY-CHANGELOG — Fase 3/5
Fecha: 2026-10-08. Base original: desarrollo 86a12d7e8e892f4eef8880554c0310b9cd4e8bd6.

## Cambios implementados e integrados
- Rama **chore/ng-phase3-dependency-control-20261008** creada desde SHA exacto de desarrollo.
- NG-DEP-002: migración `actions/setup-node@v5` → `actions/setup-node@v6` en:
  - .github/workflows/chat-4-phase0-baseline.yml
  - .github/workflows/chat-4-phase1-message-engine.yml
  - .github/workflows/chat-4-phase2-scroll-engine.yml
  - .github/workflows/chat-4-phase3-delivery.yml
  - .github/workflows/chat-4-phase4-composer.yml
  - .github/workflows/pages.yml (2 usos)
  - .github/workflows/performance-phase4.yml
- Se conservan Node 24 y los comandos de workflow; no hay actualización de npm packages por ausencia de dependencias declaradas.
- El PR original #76 registraba nueve checks SUCCESS. El PR sustituto #115 ejecutó y aprobó siete checks nuevos (Node baseline, fases chat 1–4, benchmark y Android runtime) sobre el SHA definitivo `d586fb575f536b762b53159e7ae3160a07b28388`.
- Este directorio contiene el inventario, la revisión Dependabot, compatibilidad, seguridad, changelog y posposiciones.

## Estado de integración y verificaciones
**INTEGRADO**: PR #115 fusionado mediante squash a `desarrollo` en commit `0bab4e1d60a1a8b0e382a6724b49bf3730dc4ef8`. Los **7/7 checks del SHA final** concluyeron SUCCESS, incluyendo Android runtime; PR #76 cerrado como duplicado técnicamente equivalente, tras cotejar sus ocho sustituciones y dejar comentario de trazabilidad. Ninguna modificación afecta el contenido de Android, SQL, WebView, Supabase Edge ni Android signing. No se publicó APK ni se incrementó Android 4.1.1. Se respetan los NO GO de F1/F2.

## Comprobaciones requeridas para cerrar
1. COMPLETADO en #115: diff equivalente a #76 y base `desarrollo` fijada al abrir PR.
2. COMPLETADO: 7/7 checks del SHA final `d586fb575f536b762b53159e7ae3160a07b28388` SUCCESS, incluido `npm test` en baseline y rendimiento Android.
3. COMPLETADO: squash #115 a desarrollo `0bab4e1`; sin cambios qa/prod/main.
4. COMPLETADO: desarrollo `0bab4e1`; qa/prod `f526299`; main `8ab4f84`.
5. PRs #75, #77–#82 permanecen diferidos/abiertos; #76 cerrado como reemplazado. Las alertas de seguridad transitivas continúan sin auditar: NO GO de cierre integral hasta resolver visibilidad.
6. Revisar decisiones pospuestas y señalar que la Fase 4 solo puede comenzar bajo gate restringido y sin despliegue.

## Recomendación Fase 4
Preparar QA funcional aislada del producto: identidad y revocación con dos parejas sintéticas, RLS de chat/multimedia/GPS, CameraX emulada, FCM foreground/background y consumo de batería. No saltar de documentación de dependencias a release ni restaurar ramas históricas.
