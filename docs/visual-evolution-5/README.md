# NUESTRA GALAXIA — VISUAL EVOLUTION 5.0

**ESTADO:** Diseño planificado, implementación **NO iniciada**. **Fecha:** 12 oct 2026. **Referencia estable auditada:** `prod@fde141d4c8e7622ac1d6f10f1abbfbda8e8e7d0c` (Android `4.1.2`, `versionCode=39`), misma SHA en `qa` al consultar. **Rama de documentación:** `docs/visual-evolution-5-audit-20261012` derivada de `desarrollo` (ocho commits detrás de `prod` en ese momento). No tocar prod, QA ni releases en preparación.

## Entrar aquí en cualquier chat / Work / Codex

1. Leer [HANDOFF.md](HANDOFF.md) para el estado exacto, precondiciones y primera ejecución.
2. Leer [TECHNICAL_BASELINE.md](TECHNICAL_BASELINE.md) para ubicación real del código y reutilización.
3. Leer [ROADMAP.md](ROADMAP.md) para dependencias, orden de bloques y Definition of Done.
4. Ejecutar por fases los **260 VE enumerados** a continuación; todos están inicialmente **pendientes**, no son 260 bugs confirmados.

| Módulo | IDs | Entradas de auditoría |
|---|---|---|
| Inicio | VE-001–034 (34) | [01-inicio.md](01-inicio.md) |
| Buscador y notificaciones | VE-035–060 (26) | [02-busqueda-notificaciones.md](02-busqueda-notificaciones.md) |
| Mapa | VE-061–100 (40) | [03-mapa.md](03-mapa.md) |
| Momentos | VE-101–142 (42) | [04-momentos.md](04-momentos.md) |
| Recuerdos | VE-143–202 (60) | [05-recuerdos.md](05-recuerdos.md) |
| Más y configuración | VE-203–260 (58) | [06-mas.md](06-mas.md) |
| **Total** | **VE-001–260** | **260 entradas, 6 documentos** |

## Visión de producto

Una evolución visual integral para convertir el contenido actual en una experiencia moderna, emocional, intuitiva y fluida. **Celestial Design System** como base común; Inicio = bienvenida y resumen; Mapa = Connected Journeys; Momentos = Living Moments; Recuerdos = Living History/Photo Memories; Más = Control Center. Animaciones refinadas, y tematización completa en los ocho temas ya ofrecidos. **No sustituir estética por pérdida de funciones.** Evitar scroll interminable; dar contexto a datos; ofrecer estados fiables; mantener privacidad.

## Decisiones congeladas

- **IA fuera de este upgrade**: su propio rediseño profundo será otro proyecto. Los resultados inteligentes del buscador global pueden rediseñarse superficialmente sin tocar modelo, semántica ni algoritmos.
- **Galaxy Chat 4.1** ya evolucionado: solo coherencia global de FAB/safe-area/deep-links; no rehacer el chat.
- **GPS y FCM**: conservar implementaciones y pruebas previas; si algo en UI muestra una inconsistencia, abrir investigación independiente, no afirmar bug por imagen.
- **Datos**: no borrar registros ni fusionar duplicados aparentes, no filtrar datos privados, no modificar vínculo de perfiles sin prueba y autorización.
- **Tecnología**: Android empaqueta HTML/CSS/JS WebView; cambiar solo PWA no cambia el APK. Ver baseline.
- **Reglas de release**: [../BRANCH_POLICY.md](../BRANCH_POLICY.md) y [../RELEASE_GOVERNANCE.md](../RELEASE_GOVERNANCE.md).

## Fuente de observaciones

Inspección visual de 4 Inicio, 2 búsqueda/avisos, 5 Mapa, 5 Momentos, 15 Recuerdos, 6 Más (total **37 capturas**). Algunas capturas se superponen en scroll y pueden representar diferentes momentos. Las imágenes de usuarios son privadas y NO se copian al repo; el catálogo contiene hallazgos de interfaz solamente. Estado real, rutas del código y cobertura se contrastaron estáticamente con GitHub.

## Avance

- [x] Recopilar 260 VE a partir de capturas.
- [x] Inspeccionar árbol de producción y principales puntos de entrada/documentación/tests.
- [x] Definir roadmap, seguridad, pruebas, fases e instrucciones de continuación.
- [ ] Revisar/mergear PR documental, sincronizar baseline en desarrollo conforme a política.
- [ ] V5-P0 QA baseline + composición visual aprobada.
- [ ] V5-P1 sistema visual transversal.
- [ ] V5-P2/P3/P4/P5/P6/P7 mejoras por módulo.
- [ ] V5-P8 QA integral.
- [ ] V5-P9 release bajo aprobaciones expresas.

**Nota:** Los ítems [x] representan documentación completada, NO nuevas verificaciones ejecutadas en Android o en producción.
