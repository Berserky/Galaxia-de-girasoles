> **HANDOFF VIGENTE — 16/oct/2026 — V5-P4 Connected Journeys.** V5-P0, P1, P2, P3 ya fusionadas **solo en** `desarrollo` mediante PR #166–#169. Fase actual [PR #170 DRAFT](https://github.com/Berserky/Galaxia-de-girasoles/pull/170), rama `feat/visual-evolution-5-p4-connected-journeys` → `desarrollo`. P4A mapa inmersivo, P4B sesiones/alertas, P4C lugares/historial construidos en rama; P4D con **19 capturas reales Android aprobadas en un SHA anterior** pero **sin certificación 15/15 del HEAD actual**. El último commit de QA anterior `2f96e193` tuvo Phase5 FAIL por marcador de mapa perdido durante redibujo de tema daylight; el test fue reforzado para adjuntar temporalmente el marcador a `document.body` en rama posterior y debe pasar de nuevo las 15 pruebas. Hay 40 hallazgos VE-061–100: 38 implementados en rama, 2 parciales, 0 sin trabajo iniciado y 0 cerrados por aceptación. Leer primero [P4_PROGRESS.md](P4_PROGRESS.md) y [03-mapa.md](03-mapa.md) para acciones, archivos y evidencia; **los handoff históricos que siguen son obsoletos**. Mantener PR DRAFT, **NO** merge/QA/prod/APK sin 15/15 del SHA y aprobación estética humana. IA, Chat Engine, GPS/FCM nativos y backend fuera de alcance.

**Gate histórico certificado:** 15/15 workflows SUCCESS en `d3172763` (V5 AVD 19/19 PNG P4, Phase5 36 pruebas, Phase11 4); los cambios UX posteriores exigen repetir los gates del nuevo SHA. No heredar PASS entre commits. Los dos hallazgos parciales son VE-085 (entrega real push no disponible en API actual) y VE-093 (homogeneidad visual pendiente de aprobación). Nueva puerta Android: 23 capturas P4 por SHA, incluidas 4 enfocando lugares guardados. La aprobación visual y la autorización de merge siguen pendientes.

> **HANDOFF VIGENTE — V5-P3, 15 de octubre de 2026.** La fase P3 (Buscador y avisos Android) vive en [PR #169 DRAFT](https://github.com/Berserky/Galaxia-de-girasoles/pull/169) `feat/visual-evolution-5-p3-notifications-ux` → `desarrollo`. La implementación y corrección de toque nativo (HEAD de código `21aab245`) pasó **15/15 workflows**; el AVD produjo **ocho capturas reales de búsqueda/avisos a 320/360/393/412**, inspeccionadas, con 8/8 marcadores de framebuffer confirmados. Véase [P3_PROGRESS.md](P3_PROGRESS.md) para IDs VE, resultados, riesgos y evidencia. La edición documental posterior `e24ce64` debe aprobar sus propios checks, no heredar el PASS del código. **Pendiente aceptación estética del propietario, revisión específica de apariencia P3 por temas/fuente ampliada si se requiere y autorización de merge**. PR #168 (P2) ya fue fusionado; **no reiniciar P0/P1/P2**, ni mover `qa`/`prod`, ni publicar APK. **Las notas históricas siguientes están desactualizadas frente a este encabezado.**

> **ESTADO OPERATIVO ACTUAL — 13 de octubre de 2026:** Este archivo contiene debajo el handoff histórico P0; NO ejecutar sus instrucciones de crear P0 de nuevo. V5-P0 (PR #166) y P1 (PR #167) fueron fusionados a `desarrollo` con aprobación del propietario. **V5-P2 Inicio/Galaxy Welcome** se implementa en [PR #168 DRAFT](https://github.com/Berserky/Galaxia-de-girasoles/pull/168), rama `feat/visual-evolution-5-p2-galaxy-welcome` → `desarrollo`. HEAD de referencia `6fd71a4` tuvo **15/15 CI SUCCESS**, pero la auditoría de las capturas de scroll final encontró píxeles de pantalla idénticos a la cabecera: se reforzó la instrumentación con `awaitV5BottomFramePainted` y se reejecuta el CI en un HEAD posterior. Leer [P2_PROGRESS.md](P2_PROGRESS.md) para estado/archivos/VE pendientes, [issue #160](https://github.com/Berserky/Galaxia-de-girasoles/issues/160), y verificar SHA del PR antes de actuar. Pendiente evidencia visual veraz, aceptación humana P2 y revisión por temas/anchuras. **No fusionar PR #168 ni promover a QA/prod sin autorización**. IA fuera del alcance.

> **Actualización operativa P0 (12-oct-2026, posterior a cierre 4.1.2):** P0 tiene implementación **en la rama temporal** `feat/visual-evolution-5-p0-baseline` creada de `desarrollo@143d1e7885c860b21799938bc2208f696360ee10`. Consultar [ledger P0](P0_QA_LEDGER.md), [contrato](P0_DESIGN_CONTRACT.md), [prototipo](prototypes/celestial-shell.html), [P1](P1_EXECUTION.md) y el PR enlazado en el issue #160. **No reutilizar el prompt viejo para iniciar otra rama P0**; verificar los gates reales del PR. El PC remoto `Bati-Compu` está offline en esta sesión; screenshots del APK, FPS/batería, aceptación visual siguen pendientes salvo evidencia posterior. El texto siguiente es el handoff histórico anterior al inicio de P0.

# Handoff ejecutable — Visual Evolution 5.0

**Actualizado 2026-10-12.** **Fase de descubrimiento COMPLETADA** para los módulos seleccionados; IA diferida. **Implementación NO comenzada**. Ningún cambio CSS/JS/Java ni migración realizado por esta preparación. Todas las casillas VE siguen sin marcar.

## Estado Git confirmado — post cierre administrativo 12/10/2026

- **Referencia estable inmutable del upgrade:** `prod` = `qa` = `fde141d4c8e7622ac1d6f10f1abbfbda8e8e7d0c`, Android `4.1.2/code39`. RC #38307619766 y Stable Promotion #38310720521 SUCCESS.
- `desarrollo` **ya conciliada** tras PR #161: `d4eba8a1356c2a5e98ed5d2e40251f7903f668bd`. Comparación `prod...desarrollo` **ahead=2, behind=0, diff solo 11 archivos de docs** tras PR #159. **No repetir reconciliación** si la comparación actual confirma ese estado.
- Los tres tickets anteriores #129, #133 y #147 se cerraron por aceptación del propietario y publicación 4.1.2; #125 y #131 ya tenían mitigación QA+prod cerrada. Cierre administrativo no es PASS de toda prueba física imaginable.
- Backlogs separados y **no bloqueantes para V5-P0**: #162 estabilidad/push/GPS residual, #163 dependencias incompatibles/diferidas, #164 higiene de ramas/reglas/proveniencia APK. Siete PR Dependabot viejos cerrados sin merge.
- **Acta obligatoria:** [NG-4.1.2-PRE-V5-CLOSEOUT.md](../releases/NG-4.1.2-PRE-V5-CLOSEOUT.md).
- **Nunca** forzar ramas protegidas, promover QA/prod, publicar APK o modificar firmas/secrets sin sus gates y autorización.
- La siguiente acción es comenzar **V5-P0 en rama temporal nueva desde desarrollo actualizado**, no volver a ejecutar la Fase 4.

## Qué leer al iniciar

1. `docs/visual-evolution-5/README.md` (índice y alcance).
2. `docs/visual-evolution-5/TECHNICAL_BASELINE.md` (código real y límites).
3. `docs/visual-evolution-5/ROADMAP.md` (fases P0–P9 y DoD).
4. `docs/visual-evolution-5/01-inicio.md` … `06-mas.md` (260 ID estables).
5. `docs/BRANCH_POLICY.md`, `docs/RELEASE_GOVERNANCE.md`, `docs/qa/ng-f4-engineering-exit-20261012.md`, `docs/audits/NG-4.1.1-FUNCTIONAL-MATRIX.md` (históricos, no extrapolar PASS).

## Primera tarea de implementación propuesta — V5-P0

1. Confirmar SHA actual de `desarrollo` y que contiene `prod@fde141d4` por PR #161; no repetir el merge ya completado. Crear rama corta V5-P0 desde `desarrollo` actualizado; NO reusar ramas de documentación.
2. Ejecutar baseline hermético de `npm test`, Android lint/unit tests/build y mediciones iniciales de rendimiento/scroll. Registrar versión, SHA, build variant, emulador/OS, entorno y PASS/FAIL real. **Si no hay emulador o credenciales, anotar BLOCKED, nunca PASS ficticio.**
3. Levantar inventario de vistas desde `render()`: home/map/moments/memories/goals/ai/chat/more y modales; verificar visualmente shell, teclado, temas, barra status/navigation Android, chat FAB. QA con datos sintéticos que no expongan ubicación/fotos/conversaciones personales.
4. Establecer tokens visuales compartidos y especificación de tipografía, spacing, esquinas, elevación, superficies, estados, iconografía, materiales, animación (duración/easing), reduced motion y safe-area por los ocho temas. Crear matriz de componentes y screenshots de QA para aprobación antes de construir P1.
5. Preparar checklist PR P1 (VE-001/030/031/034/059/060, más VE-144 contraste global): requisitos, tests automatizables y regresiones sin tocar Chat Engine.

**No iniciar P2–P7 sin P1 aprobado**, excepto prototipos aislados sin tocar rama estable. Cada VE se cierra en PR cuando cumple test y evidencia, no por la mera existencia de diseño.

## Riesgos prioritarios

- Tema activo casi blanco con tipografía blanca (VE-144) y barra status white-on-light (VE-001): problemas de contraste observados, no medir hasta probar.
- FAB chat/nav tapan acciones en varias pantallas (VE-030/031/202); asegurar controles no obstruidos.
- API en `supabase/functions/android-companion` y Java bridge no se sustituyen; componente visual no puede inventar estado GPS, FCM, permisos, cápsula o notificación real.
- Cambios en `app.js` HTML string gigante (~3462 líneas) y CSS grande: modularizar prudentemente sin dejar handlers `data-action` huérfanos. Cada acción que se mueve debe tener test de alcance y funcionamiento.
- `Recuerdos` tiene nueve categorías + historia + constelación; validar fecha de evento vs creación, vínculos de fotos/medios y evitar eliminar datos repetidos que podrían ser intencionales.
- `Más`: gestión de dispositivos, backup, export/borrado GPS, perfil e invitaciones son superficies de alto riesgo; un diseño moderno no debe debilitar confirmaciones.
- La matriz funcional de 4.1.1 tiene estados BLOCKED/NOT TESTED; los gates F4 del 12 oct son acotados. Volver a verificar cambios actuales, sin reabrir ensayos físicos previos por razones meramente visuales.

## Prompt de arranque para el próximo chat

> Continúa Nuestra Galaxia Visual Evolution 5.0 desde la documentación en `docs/visual-evolution-5/README.md` del repositorio `Berserky/Galaxia-de-girasoles`. Lee `HANDOFF.md`, `TECHNICAL_BASELINE.md`, `ROADMAP.md` y los seis catálogos VE-001 a VE-260. Comprueba los PR documentados #159 y #161 ya fusionados y la línea base 4.1.2/code39, con acta en `docs/releases/NG-4.1.2-PRE-V5-CLOSEOUT.md`. No repetir reconciliaciones concluidas ni QA física antigua. **Ejecuta solo V5-P0**, creando su rama a partir de desarrollo conforme a la política. Establece baseline QA reproducible, mediciones, arquitectura de diseño y criterios del sistema visual; no cambies IA, backend, GPS, FCM, lógica de Galaxy Chat ni publiques prod. Documenta la evidencia y el estado de cada gate en GitHub; termina con el PR de P0 listo para revisión.

## Definición de listo para siguiente conversación

La documentación está integrada en `desarrollo` con IDs, arquitectura, release baseline sincronizado y plan. **Está habilitado comenzar V5-P0; no afirmar que la implementación visual está lista ni que pasó nueva QA.**
