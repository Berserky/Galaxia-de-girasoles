# Contexto para agentes y nuevos chats — Nuestra Galaxia

El repositorio implementa una aplicación privada de pareja con **Android WebView local**, servicios nativos Java, Supabase/Edge y una variante web separada. La rama estable es `prod`; el trabajo nace desde `desarrollo`, pasa por `qa` y requiere gates/ aprobación para publicar. Leer siempre `docs/BRANCH_POLICY.md` y `docs/RELEASE_GOVERNANCE.md` antes de cualquier promoción.

## Proyecto activo: Visual Evolution 5.0 (documentación, pendiente de implementación)

**Punto de entrada obligatorio:** [docs/visual-evolution-5/README.md](docs/visual-evolution-5/README.md). Continuidad: [HANDOFF.md](docs/visual-evolution-5/HANDOFF.md). Código y fuentes: [TECHNICAL_BASELINE.md](docs/visual-evolution-5/TECHNICAL_BASELINE.md). Fases/DoD: [ROADMAP.md](docs/visual-evolution-5/ROADMAP.md). Catálogos por módulo: `01-inicio.md`, `02-busqueda-notificaciones.md`, `03-mapa.md`, `04-momentos.md`, `05-recuerdos.md`, `06-mas.md`, **VE-001–VE-260**.

**Prohibiciones del proyecto:** No tocar IA (upgrade separado), no reescribir Galaxy Chat 4.1, no simular datos privados ni cambiar GPS/FCM/seguridad sin autorización específica, no eliminar recuerdos/fotos por supuesta duplicidad, no promover o desplegar en prod durante la fase de diseño. La evaluación original fue visual/estática: **ningún VE constituye automáticamente un bug verificado o una prueba aprobada**.

Al comenzar el trabajo, verificar estado real de ramas y PR: el 12 oct de 2026 `prod` y `qa` coincidían en `fde141d4`, `desarrollo` estaba 8 commits atrás. No asumir que esa situación persiste.
