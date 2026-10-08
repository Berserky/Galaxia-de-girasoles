# Nuestra Galaxia 4.1.1 — Acta de cierre de investigación y traspaso de Fase 2/5

**Fecha:** 2026-10-08. **Base inmutable:** desarrollo @ `f5262991f3ab3fc65a6b39da2231915a453a9112`.
**Auditoría previa:** PR #113 / `60b46e3ad97a628ccbea066f0f3db2fe522d75ea`, documentación F1 en borrador.
**Trabajo F2:** PR #114 / `docs/ng-4.1.1-phase2-legacy-recovery-20261008`.

## Alcance completado (verificado)
- 6 ramas `legacy/*` inventariadas y contrastadas con implementación Android/WebView.
- 80/80 referencias `archive/2026-10-08/*` comprobadas contra el CSV histórico; recorrido reproducible por SHA, merge-base y rutas modificadas en `scripts/phase2-audit-archive.mjs`, resultados en `NG-4.1.1-ARCHIVE-80-LEDGER.md`.
- 28 candidatas NG-LEG-001–028 con decisión documentada: **15 YA EXISTE (en código)**, **6 MODERNIZAR ANTES DE RECUPERAR**, **5 POSPONER**, **2 DESCARTAR**, **0 RECUPERAR AHORA**. Estas categorías NO certifican experiencia E2E.
- Migraciones antiguas halladas por ausencia de ruta en el tag: **no** restauradas. Se comprobó el mecanismo de manifest canónico protegido por pruebas.
- Cinco entregables originales generados y extendidos con ledger estático. Backlog ordenado de seguridad y recuperación.
- Pruebas localizadas: **606/606 Node PASS (0 fail)**, incluidas 3 nuevas de trazabilidad documental. `git diff --check` PASS.
- **0 cambios de negocio/Android/Edge/DB; 0 PR funcional, 0 APK nuevo; ninguna rama qa/prod/main modificada; ningún dato privado consultado**.

## Evaluación por criterio original

| Criterio de F2 | Estado | Evidencia / reserva |
|---|---|---|
| Referencias históricas relevantes | PASS documental | seis legacy y 80 tags por Git; ledger reproducible |
| Inventario trazable y comparación | PASS documental | NG-LEG y comparación actual/antigua por módulo |
| Decisión de cada candidato | PASS documental | matriz 28/28, razón y prueba |
| Recuperaciones elegidas viables | BLOCKED JUSTIFICADO, ninguna seleccionada | gate F1 impide cambios funcionales de riesgo hasta QA privacidad/identidad |
| Pruebas de cambios integrados | PASS solo documentación | Node 606; no tests E2E nuevos de funciones |
| No perder funciones modernas | PASS por ausencia de cambio funcional | no se ha editado producto |
| Datos privados preservados | PASS para actividad F2 | lectura de fuentes no de registros privados |
| Backlog a Fase 4 | PASS | RECOVERY-BACKLOG.md |
| qa/prod/APK estable protegidos | PASS | rama aislada docs, sin release |

**Dictamen:** **FIN DE INVESTIGACIÓN Y CLASIFICACIÓN DE F2, CON RECUPERACIONES FUNCIONALES EXPLÍCITAMENTE BLOQUEADAS/POSPUESTAS.** Conforme al criterio «implementadas y verificadas, o explícitamente bloqueadas por una causa documentada», puede darse por concluido el alcance seguro de Fase 2 **sin afirmar que se recuperaron funcionalidades**. No es «recuperación completa» de todas las funciones históricas, porque está pendiente la ejecución de las candidatas de modernización.

## Puerta de entrada a Fase 3

**GO restringido:** iniciar la Fase 3 únicamente para diagnóstico, estabilización, preparación de fixtures, pruebas negativas, validación de calidad y tareas aisladas seguras desde desarrollo.

**NO GO:** aplicar nuevas funciones con datos de parejas, modificaciones destructivas, integración sensible sin tests de privacidad, promoción a QA/prod o publicación APK.

Los siguientes controles permanecen **obligatorios**: (1) aislamiento adversarial dos parejas A/B y C/D, ubicaciones/medios/tokens y RLS; (2) revocación e invitaciones con tokens válidos, vencidos y reutilizados; (3) CameraX foto/video en dispositivo o entorno equivalente; (4) FCM foreground/background y 503 productivo anterior sin deducir su estado actual; (5) GPS real/simulado consentido, rendimiento/batería; (6) equivalencia UX de regalo, widgets y dedicatorias, según NG-LEG.

Los 43 BLOCKED, 11 PARTIAL y 7 NOT TESTED de F1 no se resuelven mediante el barrido de Git. **Ningún PASS documental se debe interpretar como PASS E2E.**

## Condiciones de gobernanza

No mergear el PR #113 de F1: mantiene su instrucción de permanecer en borrador. El PR #114 es exclusivamente documental. Si se acepta integrarlo, hacerlo mediante PR y comprobación de su diff/pruebas; nunca push directo a ramas protegidas. Fase 5 reserva cualquier promoción de APK a producción.
