# NG-DEPENDENCY-CHANGELOG — Fase 3/5
Fecha: 2026-10-08. Base original: desarrollo 86a12d7e8e892f4eef8880554c0310b9cd4e8bd6.

## Cambios realizados en rama temporal
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
- Evaluación anterior: #76 tenía nueve checks SUCCESS, pero eso **no es verificación nueva** de la rama rebasada en desarrollo.
- Este directorio contiene el inventario, la revisión Dependabot, compatibilidad, seguridad, changelog y posposiciones.

## Estado de integración y verificaciones
Los cambios de la rama temporal son **candidatos** hasta un PR aprobado y CI nuevo en el SHA final. No marcar como merged/estable antes de obtener pruebas. Ninguna modificación afecta el contenido de Android, SQL, WebView, Supabase Edge ni Android signing. No se publicó APK ni se incrementó Android 4.1.1. Se respetan los NO GO de F1/F2.

## Comprobaciones requeridas para cerrar
1. Confirmar diff exacto y que el PR tiene base `desarrollo` actual.
2. Obtener `npm test` y checks de workflows relacionados sobre nuevo SHA; usar los resultados de GitHub, no suponer PASS.
3. Si es verde, fusionar **solo a desarrollo** con SHA esperado; no tocar qa/prod/main.
4. Comprobar nuevamente SHA de ramas protegidas y anotarlo en resultado final.
5. Mantener PR no seleccionados abiertos; cualquier vulnerabilidad crítica sin resolver bloquea la fase.
6. Revisar decisiones pospuestas y señalar que la Fase 4 solo puede comenzar bajo gate restringido y sin despliegue.

## Recomendación Fase 4
Preparar QA funcional aislada del producto: identidad y revocación con dos parejas sintéticas, RLS de chat/multimedia/GPS, CameraX emulada, FCM foreground/background y consumo de batería. No saltar de documentación de dependencias a release ni restaurar ramas históricas.
