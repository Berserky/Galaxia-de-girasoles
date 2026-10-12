# Handoff ejecutable — Visual Evolution 5.0

**Actualizado 2026-10-12.** **Fase de descubrimiento COMPLETADA** para los módulos seleccionados; IA diferida. **Implementación NO comenzada**. Ningún cambio CSS/JS/Java ni migración realizado por esta preparación. Todas las casillas VE siguen sin marcar.

## Estado Git confirmado

- Repo: [Berserky/Galaxia-de-girasoles](https://github.com/Berserky/Galaxia-de-girasoles).
- Fuente estable: `prod@fde141d4c8e7622ac1d6f10f1abbfbda8e8e7d0c`; `qa` misma SHA al auditar. Android `4.1.2` / `versionCode 39` en Gradle.
- Rama principal en GitHub: `prod`. `main` histórica.
- `desarrollo@15d196a4204a9dc435e31c29a94455d927c0d4d3` estaba detrás de `prod` por 8 commits sin divergencias propias.
- Rama de **documentación solamente**: `docs/visual-evolution-5-audit-20261012`, nacida de `desarrollo`; contiene este catálogo y plan. El siguiente chat debe verificar su PR/merge, cambios de HEAD y nueva comparación antes de iniciar PR de implementación.
- **Nunca** forzar ramas protegidas, promover QA/prod, publicar APK, modificar firmas/secrets ni declarar cerrado release sin sus gates.

## Qué leer al iniciar

1. `docs/visual-evolution-5/README.md` (índice y alcance).
2. `docs/visual-evolution-5/TECHNICAL_BASELINE.md` (código real y límites).
3. `docs/visual-evolution-5/ROADMAP.md` (fases P0–P9 y DoD).
4. `docs/visual-evolution-5/01-inicio.md` … `06-mas.md` (260 ID estables).
5. `docs/BRANCH_POLICY.md`, `docs/RELEASE_GOVERNANCE.md`, `docs/qa/ng-f4-engineering-exit-20261012.md`, `docs/audits/NG-4.1.1-FUNCTIONAL-MATRIX.md` (históricos, no extrapolar PASS).

## Primera tarea de implementación propuesta — V5-P0

1. Consultar branches/PR y confirmar fuente. Revisar y fusionar documentación a `desarrollo` tras CI/revisión; resolver que `desarrollo` estaba ocho commits detrás del baseline estable por vía segura conforme a gobernanza (no forzar `prod`). Crear rama corta de implementación desde `desarrollo` actualizado; NO reusar la rama de documentación.
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

> Continúa Nuestra Galaxia Visual Evolution 5.0 desde la documentación en `docs/visual-evolution-5/README.md` del repositorio `Berserky/Galaxia-de-girasoles`. Lee `HANDOFF.md`, `TECHNICAL_BASELINE.md`, `ROADMAP.md` y los seis catálogos VE-001 a VE-260. Comprueba el PR documental y reconciliación de `desarrollo` con la base estable prod 4.1.2/code39 sin forzar ramas. **Ejecuta solo V5-P0**, creando su rama a partir de desarrollo conforme a la política. Establece baseline QA reproducible, mediciones, arquitectura de diseño y criterios del sistema visual; no cambies IA, backend, GPS, FCM, lógica de Galaxy Chat ni publiques prod. Documenta la evidencia y el estado de cada gate en GitHub; termina con el PR de P0 listo para revisión.

## Definición de listo para siguiente conversación

La documentación está disponible en una rama del repo con IDs, arquitectura y plan. **No afirmar que la implementación está lista ni que pasó QA**, solo que su ejecución tiene un punto de arranque rastreable.
