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
