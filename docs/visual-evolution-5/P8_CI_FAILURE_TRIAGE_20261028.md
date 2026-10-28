# P8 — Auditoría de CI y estabilidad del emulador (28-oct-2026)

## Ejecución oficial investigada

- PR en borrador [#204](https://github.com/Berserky/Galaxia-de-girasoles/pull/204), rama `feat/visual-evolution-5-p8-integration-p5-20261028`, **SHA probado en GitHub:** `2aa68838b16431db4daa4d03d05818b49a206b63`.
- **15 workflows terminados: 12 SUCCESS, 3 FAILURE**. Android unit + lint + release build: **SUCCESS**; test Node 24 y tests estáticos: **SUCCESS**.
- Fallos exclusivos de jobs de emulador Android (no equivale a tres fallos de compilación):

| Workflow | Job que falló | Observación exacta |
|---|---|---|
| QA Phase 5 Real Integration | Android instrumentation + lifecycle | Una prueba de selector del sistema no encontró la marca pintada en el framebuffer real; otra prueba de navegación/Chat agotó el plazo. Se interrumpió la prueba P5 al quedar el emulador offline (`device 'emulator-5554' not found`). |
| Galaxy Chat 4 Phase 11 Torture | Android stress matrix | Agotó el plazo para abrir Chat desde navegación; después el emulador se desconectó durante instrumentación |
| V5 P0 baseline and synthetic visual preview | AVD QA unpaired APK | El emulador desapareció antes de concluir la prueba de Momentos; 79 capturas no pudieron transferirse. La demostración Chrome de nueve imágenes sintéticas pasó, **no es evidencia real de APK** |

## Cambios de resiliencia aplicados al candidato

1. **Sin falsos PASS:** conservar `connectedDebugAndroidTest`, la puerta real de capturas y sus fallos explícitos; no desactivar pruebas ni dar por válidos los screenshots sintéticos.
2. **AVD acotado:** incluir `-memory 3072 -no-snapshot` en los tres workflows. Hipótesis de estabilidad, **aún sin confirmar**; un resultado del SHA anterior no verifica este ajuste.
3. **Evidencia si falla:** ejecutar `scripts/p8-emulator-diagnostics.sh` únicamente en failure, antes de subir artefactos. Guardar RAM/disco, procesos por nombre y RSS, estado ADB y boot; jamás secretos, argumentos de procesos, mensajes, ubicación o credenciales.
4. **Menor presión gráfica:** reducir `takeScreenshot()` del guard de pintura de una iteración cada 200 ms a 500 ms, manteniendo el plazo de 15 segundos, el umbral de 20 píxeles cian y dos fotogramas reales consecutivos. No sustituir por validación DOM.
5. **Ruta de Chat verificable:** el helper Android debe activar el `#chatFab` auténtico y esperar que aparezca Chat; no saltarse el control con `go('chat')`. En fallos sólo registrar ruta genérica, existencia/visibilidad del FAB y bandera de capacidad Chat, nunca contenido privado.

## Pendientes obligatorios

- Repetir los checks oficiales **sobre el nuevo SHA final**. Si algún job falla, diagnosticar con los artefactos y corregir sólo la causa, sin omitir test o usar `continue-on-error`.
- No afirmar que la desconexión se explica únicamente por memoria: hay errores de interacción previos que requieren evidencia funcional.
- P8 sigue condicionado a APK instrumentado, recorridos de accesibilidad y 19 escenarios consolidados, revisión de las capturas reales y aprobación humana.
- **No se ha hecho merge ni promoción a `desarrollo`, `qa` o `prod`.**
