# Nuestra Galaxia 4.1.1 — Próximos pasos y plan de corrección

**Origen:** Auditoría Fase 1/5 · 2026-10-08 · baseline `f5262991f3ab3fc65a6b39da2231915a453a9112`. Este archivo describe tareas futuras; **ninguna se implementó aquí**.

## Decisión principal

Se autoriza la comparación histórica no destructiva de Fase 2 con riesgos documentados; NO autorizar nuevas releases ni correcciones funcionales sin cerrar las pruebas críticas. Los 603 tests Node, los 7 jobs CI verdes y el onboarding 4.1.1 saludable son señales positivas, pero **43 de 92 unidades** requieren coberturas de proveedor, privacidad adversarial, hardware o UI aún no demostradas. No confundir ausencia de evidencia de fallo con evidencia de ausencia de fallos.

## Orden propuesto (dependencias y salidas)

| Orden | Prioridad | Trabajo futuro | Dependencias | Prueba mínima de aceptación | Salida |
|---:|---|---|---|---|---|
| 0 | P0 preventivo / imprescindible | Reutilizar la provisión OIDC de dos identidades ya verificada en QA, ampliarla a parejas separadas y fixtures sintéticos, y confirmar que cada APK/prueba apunta **solo** a QA, sin exponer secretos | Permisos/infra QA | Escrituras y lecturas QA no modifican producción; limpieza solo de fixtures sintéticos | Desbloquear 43 unidades sin comprometer privacidad |
| 1 | P0 preventivo / imprescindible | Validar límites RLS y acceso a chat, ubicaciones, fotos, notas, adjuntos y tokens entre A/B y no vinculados | Orden 0 | A puede leer lo suyo y lo compartido autorizado, B no puede leer datos privados de A; revocación efectiva | Evidencia adversarial reproducible, sin P0 abierto |
| 2 | P1 preventivo / imprescindible | Validar invitaciones, expiración, reúso, perfil incorrecto, reconexión, cierre/cambio de cuenta y revocación | Orden 0–1 | Token caducado/reutilizado rechazado; vínculo nunca se asigna al perfil equivocado | Seguridad de identidad comprobada |
| 3 | P1 / operación diaria | Validar Galaxy Chat extremo a extremo (dos emuladores, mensajes, entregas, respuestas, scroll 1k+ mensajes, teclado, offline/reconexión, borradores, notificaciones e interactividad) | Orden 0–2 | Sin pérdida/duplicado, scroll estable, trazas latencia y reintentos | Regresiones históricas 1,2,13,14 clasificadas de verdad |
| 4 | P1–P2 / medios | Cámara nativa, video, review, controles y permisos; HEIC/MIME; audios/adjuntos; GIPHY y stickers | Órdenes 0–3; archivos QA de muestra | Captura, cancelar, repetir y enviar/recibir; rechazos seguros; sin UI superpuesta | Regresiones 3–5,11 verificadas |
| 5 | P1–P2 / GPS y privacidad | Dos ubicaciones simuladas, distancia/ETA, modo/transporte, cercanía, tracking offline y consumo | Órdenes 0–2; mock GPS Android | ETA correcto/estable, ubicación únicamente consentida, historial aislado; métricas memoria/CPU/batería | Regresión 6 y riesgos de batería clasificados |
| 6 | P1–P2 / FCM | Registro/desregistro de tokens QA, foreground/background, deep link y deduplicación | Órdenes 0–3; Firebase QA | Evento entregado una sola vez, sin filtración de sesión/pareja | Regresión 12 clasificada |
| 7 | P2 / objetivos e IA | Abrir metas, CRUD y sincronización; nav principal IA, búsqueda semántica, filtros privados, calidad y fallback | Órdenes 0–2; corpus sintético | Acceso visible, operaciones E2E consistentes, resultados respetan RLS | Regresiones 7–8 clasificadas |
| 8 | P2 / música | MP3 y URLs soportadas, errores de proveedores, reproducción y segundo plano | Orden 0, servicios autorizados | Reproducción o error accionable, nunca estado engañoso | Regresión 10 clasificada |
| 9 | P3 / UX y gobernanza | Evaluar compactar CTA landscape [NG-AUD-003], corregir README desactualizado [NG-AUD-002], formalizar separación de firmas [NG-AUD-001] | Resultados previos | Capturas portrait/landscape y documentación consistente con workflows QA/prod | UX/gobernanza estabilizadas |
| 10 | Recuperación histórica / **Fase 2** | Comparar ramas/código histórico **solo después** de las pruebas críticas, seleccionar piezas recuperables con regresión | Línea base 4.1.1 documentada | Comparación basada en hashes, pruebas y cambios mínimos | Backlog de recuperación sin merges silenciosos |

## Qué corregir primero cuando exista evidencia

1. **P0 confirmado:** exposición de datos o pérdida de información → detener entrega, aislar, corregir y repetir pruebas negativas.
2. **P1 confirmado:** autenticación incorrecta, chat principal roto, sincronización perdida o fallos graves de cámara/FCM → corregir antes de cambios de diseño.
3. **P2 confirmado:** errores de ETA, audio, rendimiento, UX que bloquea acciones, configuraciones de proveedor.
4. **P3 confirmado:** detalles de diseño/documentación, como NG-AUD-002 y NG-AUD-003.

**No inventar correcciones**: la matriz no contiene P0/P1 reproducidos en esta auditoría; los niveles preventivos se refieren al riesgo que debe evaluarse antes de versionar.

## Estrategia automatizada sugerida

- **Dos emuladores API35** con AVD dedicado, certificados coherentes y suffix de aplicación QA cuando se use debug; sin dispositivos físicos personales salvo prueba técnicamente imposible de emular.
- **Fixtures desechables**: dos usuarios A/B, pares distintos, token válido/expirado/reutilizado, mensajes cortos/largos/multimedia, posiciones GPS simuladas, fotos/audio/HEIC sintéticos, datos RLS adversariales.
- **Automatización primero**: instrumentación Android + pruebas JS/Deno/SQL, pruebas visuales screenshot de pantallas con fixtures, latencia y ANR/CPU; guardar comandos y resultados con hashes de APK.
- **No repetir trabajos aprobados sin motivo**: el RC run 37808030670 pasó 7/7. Nuevas ejecuciones deben cubrir brechas no verificadas, nuevo SHA o errores reproducidos.
- **Trazabilidad**: un caso automatizado y evidencia por NG-AUD-*; no usar PASS si solo se leyó el código.

## Criterios verificables para cerrar la deuda de auditoría

- Los 43 BLOCKED tienen ejecución real de QA o justificación técnica individual para seguir bloqueados.
- Los 8 NOT TESTED se ejecutaron o tienen limitación demostrada (emulador frente a cámara/sensores físicos).
- Las 14 hipótesis históricas se reclasificaron usando resultados reales: RESUELTO Y VERIFICADO, REPRODUCIDO, PARCIALMENTE RESUELTO, NO REPRODUCIDO o NO VERIFICABLE EN ESTE ENTORNO.
- Pruebas negativas RLS/privacidad y autenticación pasan con dos identidades independientes.
- Las capturas de chat, cámara, video, objetivos e IA se comparan con UX prevista sin inventar funcionalidad.
- Cada problema reproducido tiene owner, prioridad, caso regresión y evidencia; sin P0/P1 abiertos antes de iniciar una release.
- La documentación puede revisarse en un PR exclusivo de auditoría dirigido a `desarrollo`, **sin fusión automática**. Promoción posterior: desarrollo → qa → prod bajo aprobaciones de gobernanza.

## Decisiones fuera de alcance

No crear funciones nuevas, no migrar código histórico, no refactorizar la app, no cambiar políticas RLS o claves, no añadir servicios pagos, no realizar despliegue ni modificar `qa`, `prod` o `main` durante la Fase 1. Mantener la tag inmutable de fuente 4.1.1 como ancla reproducible.

**Fuentes cruzadas:** [auditoría completa](NG-4.1.1-FUNCTIONAL-AUDIT.md) · [matriz](NG-4.1.1-FUNCTIONAL-MATRIX.md) · [hallazgos](NG-4.1.1-FINDINGS.md) · [CI](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/37808030670).


## Resolución del gate diagnóstico: Fase 2 permitida

**GO para Fase 2** — investigación no destructiva de ramas históricas, comparación de cambios, inventario de piezas recuperables y propuestas de integración; conservar el PR de auditoría en revisión. No crear, fusionar ni desplegar cambios funcionales dentro del PR actual.

**NO GO para nueva versión productiva** — quedan 43 funcionalidades BLOCKED, 7 NOT TESTED y 11 PARTIAL, principalmente integraciones no cubiertas, privacidad adversarial, FCM productivo y CameraX real. Priorizar los P0/P1 solo si aparecen evidencias reproducibles; no inferir P0/P1 por falta de ejecución.

**Corrección del plan original:** ya existe doble usuario QA remoto con OIDC y cleanup probado en el workflow #37808030670. El orden 0 no consiste en crear desde cero esa capacidad, sino **reutilizar/expandir** el harness existente con nuevos flujos adversariales, cámara/media y notificaciones de manera segura. No solicitar a la persona usuaria credenciales de producción para esas pruebas.

**Advertencia para release:** el preflight de 4.1.1 registró un 503 productivo de push-client-config, no revalidado. Debe atenderse antes de certificar notificaciones o promover cualquier nueva stable; tampoco equivale a un defecto reproducido durante esta auditoría.

**Trazabilidad:** CI Android job 113417339690 (24 finalizados, 2 SKIPPED), staging job 113422125384 (VERIFIED con limpieza), Node 603/603, matriz 92 entradas. Cada nueva fase conservará esta base sin repetir tests verdes que no hayan cambiado.
