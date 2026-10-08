# NG-4.1.1 — Backlog de recuperación y Fase 4

**Nuestra Galaxia 4.1.1 — Fase 2/5** · 2026-10-08 · investigación sin cambios de código de producto.

Base: `desarrollo` @ `f5262991f3ab3fc65a6b39da2231915a453a9112`. Auditoría F1: [PR #113](https://github.com/Berserky/Galaxia-de-girasoles/pull/113) @ `60b46e3ad97a628ccbea066f0f3db2fe522d75ea` (draft, NO fusionado). La auditoría autoriza **solo comparación histórica no destructiva**; el gate de implementación/merge funcional/release permanece **NO GO**. 92 verificaciones F1: 31 PASS, 11 PARTIAL, 43 BLOCKED, 7 NOT TESTED; no extrapolar PASS parcial a módulos completos.

> Alcance honesto: inventario de **28 candidatos de recuperación evaluados por referencia y presencia de componentes**, no declaración de que las 80 etiquetas hayan sido auditadas una a una o de que las funciones respondan en E2E. Estado **PRELIMINAR / FASE 2 NO CERRADA**. Ninguna feature se recuperó ni se modificaron prod, qa, main, APK o datos personales.

## Priorización por gate (antes de funcionalidades)
| Prioridad | Entrega / dependencia | Bloquea | Criterio de salida |
|---|---|---|---|
| G0 | Cierre y trazabilidad F1 PR #113 | Implementación F2 | Resolución formal, matriz y SHAs íntegros |
| G1 | QA dos parejas aisladas OIDC con fixtures efímeros | GPS/gestos/medios | A/B y C/D, RLS negativo, revocación, cleanup, **nada de prod** |
| G2 | Identidad, FCM y CameraX / permisos | Deploy y funciones sensibles | Negativos perfil/token, notificación una vez, pruebas físicas necesarias identificadas |
| G3 | Inspección restante de las 80 tags | Afirmación de inventario completo | Planilla de tag → commit → archivos → valor → decisión |

## Candidatos por valor una vez abierto el gate
| Orden | ID | Objetivo | Alcance propuesto y dependencia | Prueba de aceptación |
|---|---|---|---|---|
| 1 | NG-LEG-001/002/004 | Regalo interactivo ligero y accesible | Componente aislado en bienvenida, no alterar pairing ni datos | Animaciones sin jank, reduce-motion, horizontal, retorno |
| 2 | NG-LEG-003 | Carta y recuerdos originales con protección | Contenido local existente, acceso explícito privado | Sin fuga en logs/estado no vinculado; persistencia |
| 3 | NG-LEG-011 | Dedicatorias de voz Bond | Distinguir de mensajes de voz Galaxy Chat | Grabar-cancelar-enviar-revocar, MIME/size |
| 4 | NG-LEG-018 | Eventos de llegada | Reusar TrackingService y permisos, no migrar web geofences | Mock GPS, opt-in/out, expiración, sin false arrivals |
| 5 | NG-LEG-013/014 | Resiliencia de música | Revalidar lo existente antes de cambiarlo | Playlist privada, pause/reanudar, pérdida de red |
| 6 | NG-LEG-017/019/020/021 | Ubicación, encuentros, historial | PRIVACIDAD G1 imprescindible | A/B/C/D, ETA, export/borrado, RLS negativo |
| 7 | NG-LEG-015/016 | Audio externo y segundo plano | Revisar APIs/TOS y MediaSession Android | Proveedor y lifecycle autorizados, fallback |
| 8 | NG-LEG-024/025 | Hogar y RPG de pareja | **Fase 4**: aprobación de producto y arquitectura | Concepto validado, MVP, telemetría y límites |
| 9 | NG-LEG-026 | Tienda histórica masiva | Descartada por defecto; sólo nueva iniciativa aprobada | No restoration silenciosa |

## Flujo seguro cuando se autorice desarrollar
1. `git fetch origin --prune`, validar baseline, evitar usar SHA viejo si desarrollo avanzó.
2. Seleccionar máximo una unidad NG-LEG por PR o un conjunto fuertemente dependiente.
3. Abrir rama `feat/ng-411-recover-<module>` desde último origin/desarrollo.
4. Diseñar contrato; escribir casos fallidos y fixtures sintéticos; implementar adaptación mínima nativa/WebView sin eliminar `assets/mobile`.
5. Ejecutar Node+Deno/unit Android+instrumentación, pruebas manuales en emulador, negativas RLS y comparación de rendimiento del módulo.
6. Añadir evidencia de PR, cambios de estado NG-LEG y matriz NG-FNC; merge sólo con CI y revisión, nunca directo a ramas protegidas.
7. **No promover QA/prod ni APK hasta Fase 5** y gate de release independiente.

## Métricas pendientes para cierre F2
- 28 candidatos preclasificados; **0** recuperados, **0** modernizados, **0** tests nuevos de recuperación, **0** PR funcional.
- Archivo de tags y paridad E2E todavía pendientes; la Fase 2 **permanece abierta**.
