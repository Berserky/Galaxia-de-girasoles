# Fase 4 — Regresión integral
**Estado: matriz de QA preparada; NO es acta de ejecución.** SHA base `6361e4f90a43cdc17ea002086ac69d4d83d8ac89`.

## Evidencia heredada (NO reejecutada como parte de F4)
- F1: npm test 603/603 PASS; RC run [37808030670](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/37808030670) 7 jobs exitosos, 24 casos Android registrados y **2 CameraX SKIPPED**; staging OIDC de dos identidades y cleanup.
- F2: 606/606 tests Node PASS tras agregar 3 documentales (según acta F2).
- F3: PR #115 7/7 checks PASS, rama `desarrollo`, sin modificación de Android/Edge.
Estas evidencias **no** sustituyen pruebas después de nuevos cambios ni hacen PASS a módulos bloqueados.

## Casos obligatorios de integración
| ID | Preparación de QA / acción | Esperado | Estado F4 |
|---|---|---|---|
| QA-PRIV-01 | Parejas efímeras A/B y C/D; A lee recurso propio/compartido y C intenta leerlo por API/Storage | Acceso autorizado PASS y cruzado DENIED, sin datos filtrados | NOT RUN |
| QA-PRIV-02 | Expirar, reutilizar, revocar token invitación y desvincular un dispositivo | Rechazo consistente y ninguna asignación de perfil incorrecto | NOT RUN |
| QA-CHAT-01 | Dos emuladores vinculados, 1k mensajes, órdenes/IDs, offline/reintentos, mensajes programados/silenciosos | No perder ni duplicar; scroll/teclado estables, estados coherentes | NOT RUN |
| QA-MEDIA-01 | Cámara foto/video, negar/otorgar permisos, retake/cancel y rotar | Controles accesibles sin superposición, temporales limpios | NOT RUN |
| QA-MEDIA-02 | Adjuntar HEIC/HEIF/MP3/archivo inválido y voz; recepción entre usuarios | MIME real validado, errores accionables, autorización intacta | NOT RUN |
| QA-FCM-01 | Tokens de QA, foreground/background, deep link, cuenta cambiada | Entrega una vez, token antiguo inválido, ninguna fuga | NOT RUN |
| QA-GPS-01 | Consentimiento y revocación, GPS simulado, ETA/encuentros/ausencia señal | Mapa legible, aislamiento entre parejas y GPS desactivado sin consentimiento | NOT RUN |
| QA-UX-01 | Onboarding horizontal, modo oscuro/texto grande y navegación | CTA accesible y sin solapamiento, persistencia y a11y | NOT RUN |
| QA-PERF-01 | Línea base versus build de cambios con fixtures idénticos | Comparación real de latencia, jank, memoria y batería | NOT RUN |
| QA-DOC-01 | `node --test tests/ng-phase4-governance.test.mjs` | README de rama y triggers de candidate/stable coherentes | CI PENDING |

## Ejecución segura
Las pruebas vivas usarán solo infraestructura y fixtures de QA con cleanup explícito. Los negativos de RLS deben fallar el acceso incorrecto sin exponer contenidos en logs. No ejecutar migraciones destructivas sobre producción. Si no existe cámara física equivalente o credenciales QA de proveedor, mantener NOT RUN/BLOCKED y anotarlo.

**Resultado global:** no hay regresión funcional nueva demostrada en esta entrega documental; tampoco se ha verificado ausencia de regresiones en aplicación. La suite nueva aún requiere checks.


## Segunda pasada de evidencias ejecutadas — 2026-10-08 (Bogotá)

La matriz de arriba fue creada inicialmente en estado NOT RUN. Esta tabla anota **solamente la cobertura comprobada después** sin convertir automáticamente cada escenario completo en PASS.

| Caso | Evidencia posterior | Dictamen de caso completo |
|---|---|---|
| QA-PRIV-01 | RLS GPS [#118](https://github.com/Berserky/Galaxia-de-girasoles/pull/118), SQL QA outsider negativo; cápsulas [#132](https://github.com/Berserky/Galaxia-de-girasoles/pull/132) A/B C/D en DB aislada y rechazo externo QA | PARCIAL: Storage y separación E2E global sin certificar |
| QA-PRIV-02 | SQL de invitaciones [#120](https://github.com/Berserky/Galaxia-de-girasoles/pull/120); QA RC OIDC temporal + revocación tras smoke [#37875085269](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/37875085269) | PARCIAL: revocación/invitación E2E combinada pendiente |
| QA-CHAT-01 | QA RC #37875085269 staging real de dos identidades: envíos concurrentes, lectura, mapa, backup y limpieza; Android integration [#37881303122](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/37881303122) PASS | PARCIAL: 1k/offline/programados/silenciosos no cubiertos completamente |
| QA-MEDIA-01 | CameraX [#37881303411](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/37881303411): JPG/MP4, retake, cleanup, 3 casos ejecutados y 0 omisiones; AVD genérico integra 25 tests pero omite 2 CameraX por no tener cámara | PARCIAL: negar permisos/rotación/control físico no demostrados en esa prueba |
| QA-MEDIA-02 | Contratos MIME e integración Android CI OK | PARCIAL: recepción de todos los tipos en dos usuarios no demostrada |
| QA-FCM-01 | No existe evidencia de recepción push foreground/background/deep link en Android para F4; staging de chat no sirve como sustituto. [Issue #133](https://github.com/Berserky/Galaxia-de-girasoles/issues/133) | BLOCKED / NOT EXECUTED |
| QA-GPS-01 | Políticas de membresía RLS instaladas; smoke QA outsider denegado, Android RC mapa-state legible. [Issue #125](https://github.com/Berserky/Galaxia-de-girasoles/issues/125) | PARCIAL: consentimiento, ETA y revocación no probados E2E |
| QA-UX-01 | Onboarding visual/landscape tiene contratos y evidencia parcial en PRs F4 | PARCIAL: revisión de accesibilidad manual pendiente |
| QA-PERF-01 | Android Performance y Media Performance aprobados en [#130](https://github.com/Berserky/Galaxia-de-girasoles/pull/130) | PARCIAL: comparación antes/después representativa no medida |
| QA-DOC-01 | 12/12 workflows CI PASS del commit #130 `1943631`; 7/7 jobs QA RC #37875085269 PASS | PASS de gobernanza/CI de dichos SHA |

**Criterio de salida global:** NO GO hasta superar FCM, GPS, privacidad/resto de escenarios completos, medición representativa y autorización de release. Los estados NOT RUN de la matriz histórica inicial no se sobrescriben retrospectivamente.
