# Fase 4 — Evaluación de preparación para Fase 5
**DICTAMEN: NO GO / FASE 4 NO CERRADA.** Fecha 2026-10-08. Base de trabajo `desarrollo` @ `6361e4f90a43cdc17ea002086ac69d4d83d8ac89`.

## Puertas
| Criterio | Estado y evidencia |
|---|---|
| Backlog priorizado | PREPARADO, alcance y criterios en NG-EVOLUTION-SCOPE.md |
| Correcciones P0/P1 reproducidas | F1 registró 0 P0/P1 confirmadas; controles preventivos RLS/identidad **no demostrados E2E** |
| Pruebas adversariales dos parejas | BLOCKED / NOT RUN para A/B frente a C/D |
| Cámara, FCM, GPS y multimedia | PARCIAL o BLOCKED según matriz F1; CameraX SKIPPED 2 |
| UX y accesibilidad | REVIEW INICIAL, NG-AUD-003 pendiente; sin aprobación visual integral |
| Rendimiento antes/después | NO MEDIDO en F4 |
| Seguridad, permisos, RLS | NO CERTIFICADO E2E |
| Cambios funcionales y regresión | 0 correcciones de negocio; matriz nueva de pruebas no ejecutada |
| PR de documentación F1 | #113 abierto/draft; evidencia visible pero no integrada |
| Release Android | PROHIBIDO EN F4; versionCode/firma/prod intactos |

## Riesgos residuales críticos
- RLS adversarial, invitación incorrecta/reutilizada, revocación de token y visibilidad de medios.
- Cámara/FCM/sensores sin cierre de escenarios necesarios; antigua respuesta 503 de `push-client-config` en prod **no revalidada** (no afirmar incidencia actual).
- Alertas transitivas Dependabot/SCA no verificadas; cambios AGP/Core/WorkManager incompatibles o sin pruebas verdes.
- 43 BLOCKED, 7 NOT TESTED y 11 PARTIAL heredados de F1 no autorizan publicación.

## Condiciones para cambiar a GO
Resolver/revisar F1 formalmente sin perder audit trail; ejecutar pruebas negativas QA dos parejas, invitación/revocación y regresión E2E de chat, multimedia, GPS/FCM; capturar mediciones comparables y pantallas UX; documentar evidencias de CI con SHAs exactos, PR por unidad; sin P0/P1 bloqueantes; validar seguridad y checklist de Fase 5. **No abrir puerta a Fase 5 solo por compilar.**

Este expediente de F4 es un punto de partida controlado y no certifica versión estable.


## Actualización verificable de Fase 4 — 2026-10-08

**DICTAMEN ACTUAL: NO GO para cierre de Fase 4, promoción QA/producción o publicación estable.** Esta actualización conserva la línea base y el informe inicial anteriores: la evidencia posterior reduce algunas incertidumbres, pero no transforma `BLOCKED` en `PASS` sin ejecución.

### Cambios ya integrados en desarrollo
- [PR #113](https://github.com/Berserky/Galaxia-de-girasoles/pull/113): auditoría y matriz F1 de 92 casos, **mergeado**.
- [PR #117](https://github.com/Berserky/Galaxia-de-girasoles/pull/117): documentación F4, README Android y dos tests de gobernanza, **14/14 checks, mergeado**. El check remoto dual-user de ese PR terminó verde pero reportó explícitamente `NOT_EXECUTED`; no es evidencia E2E.
- [PR #118](https://github.com/Berserky/Galaxia-de-girasoles/pull/118): parche RLS de GPS `NG-AUD-004`, prueba real en Supabase aislado con miembros A/B y externos autenticados C/D, **12/12 checks, mergeado**.
- [PR #120](https://github.com/Berserky/Galaxia-de-girasoles/pull/120): pruebas SQL de invitación válida, vencida, reemplazada, reutilizada, cuenta no verificada y protección de perfil propietario/invitado; **10/10 checks, mergeado**.
- [PR #119](https://github.com/Berserky/Galaxia-de-girasoles/pull/119): gate que exige CameraX foto y video **ejecutados** (no omitidos), con evidencia JUnit XML; **12/12 checks, mergeado**.
- [PR #121](https://github.com/Berserky/Galaxia-de-girasoles/pull/121): onboarding horizontal compactado con contrato CSS/DOM y CI. **Pendiente de último check Android al tomar esta instantánea**. No declarar mejora visual verificada con solo tests estáticos.

### Seguridad de ubicación aún por aplicar
**Comprobación read-only realizada el 2026-10-08 directamente en Supabase QA y PROD:** ambas bases registran 40 migraciones previas y **no contienen** la migración `20261008193000_ng_phase4_member_location_rls.sql`. Sus políticas SELECT efectivas aún permiten `sharing=true` o rutas dependientes de una ubicación compartida sin imponer en ambas ramas `galaxy_person() IS NOT NULL`. Esto **confirma un riesgo de autorización en la configuración**, no prueba accesos indebidos ni exposición efectiva de registros.

La protección está fusionada **solo en código**, sin desplegarse a QA/PROD. La aplicación de la migración y su verificación posterior requieren la ventana y la autorización formal de la fase de promoción; no ejecutarla incidentalmente con un merge de PR. Recomendar evitar compartir ubicación hasta mitigarla.

### Gates que todavía impiden GO
1. **QA real:** el proyecto Supabase QA existe, pero la corrida `Dual-user remote staging` sigue `NOT_EXECUTED` por faltar `QA_STAGING_EDGE_URL`, `QA_STAGING_PUBLISHABLE_KEY`, `QA_STAGING_TOKEN_0`, `QA_STAGING_TOKEN_1`. Prueba SQL con C/D ajenos no equivale a dos parejas distintas dentro de un tenant: la app actual es de una sola pareja.
2. **GPS:** despliegue autorizado de RLS y prueba de lectura negativa/positiva en QA, revocación de sharing, historial y permisos Android reales.
3. **FCM, deep links, entrega remota, E2E multimodal y revocación de tokens de dispositivos:** conservar bloqueos de F1 hasta ejecutar escenarios de extremo a extremo.
4. **UX:** falta evidencia visual antes/después de NG-AUD-003 en landscape; revisar accesibilidad del CTA e interacción con teclado.
5. **Rendimiento:** falta comparación F4 antes/después sobre hardware y red representativos; las suites CI verifican contratos/estrés pero no implican una mejora perceptual certificada.
6. **Gobernanza:** terminar y fusionar los PR F4 pendientes solo con sus checks verdes, registrar SHA final y conservar `qa`, `prod`, `main`, versionCode y APK estable intactos.

**Regla de interpretación:** CI verde permite integrar un PR de alcance acotado en `desarrollo`; no autoriza declarar terminada toda la Fase 4 ni preparar un release.
