# P8 — Expansión auténtica del jardín después de ocho girasoles

**Estado 29-oct-2026:** implementada en rama PR #204, validada localmente. **Sin desplegar a QA ni producción.**

## Autoridad y compatibilidad

- Los nueve estados originales de Bond, del 0 al 8, se mantienen: hitos en 0, 1, 7, 14, 30, 60, 100, 180 y 365 días de participación conjunta. No cambian las etiquetas, rachas, hitos anteriores, `next`, progreso acumulado ni permisos.
- `supabase/functions/android-companion/bond-engine.ts` entrega ahora un campo **aditivo `garden.bloomTotal`**. Antes de 365 días equivale a la etapa vigente (0–7); desde 365 días comienza con 8 y suma **una flor por cada 30 días adicionales de participación conjunta verificada**. Se limita a 186 flores. El conteo se calcula con los registros que prueban que **ambas personas** participaron, no con el reloj del teléfono.
- Cuando el backend anterior no incluye `bloomTotal`, la app muestra exactamente la cantidad oficial 0–8 que ya soportaba; nunca deduce días ni flores desde el frontend. El puente acepta cantidades nuevas sólo con `stage=8`, enteros numéricos de 8 a 186, y nunca acepta `previewBloomTotal`, `demo:true`, strings o valores inválidos.
- El motor nativo muestra a las 8 flores el jardín íntimo, con 9 flores la **pradera compartida**, con 23 el **valle vivo** y luego las etapas Región/Planeta/Constelación que ya existían como diseño. La expansión no cambia la identidad ni las posiciones de las primeras ocho flores.
- El encabezado sigue usando la etiqueta recibida del servidor cuando está presente; además muestra una línea secundaria con el número real de flores nuevas para evitar que la expansión quede etiquetada únicamente como etapa ocho. No se exponen mensajes, fotos o ubicación.

## Evidencia

- Tests Node de contrato `tests/visual-evolution-p8-official-garden-expansion.test.mjs`: **4/4 PASS**. Casos 365/394/395/785/815/5705 días, defensa ante conteos manipulados y prueba de remontaje según el nuevo conteo.
- Prueba Android instrumentada `visualEvolutionP8_realAuthenticatedGardenExpansionAfterEight`: **1/1 JUnit PASS, 0 FAIL, 0 ERROR, 0 SKIP**, en AVD API35 aislado con GPU host. Comprueba 8/9/22/23, los capítulos `garden/meadow/valley`, `data-demo=false`, el número de plantas reales, el contador accesible y los píxeles del framebuffer.
- Capturas PNG físicas **1080 × 2400**, cuatro imágenes únicas, más XML JUnit, guardados sólo en `build/p8-local-avd/p8-authenticated-expansion-evidence/`, fuera del repositorio. Fixtures Android sintéticos de Bond, sin escrituras a servicios ni datos de pareja.
- `npm test` del árbol modificado: **1040 total, 1035 PASS, 0 FAIL, 5 SKIP**. `node scripts/qa-android-mobile.mjs` PASS.
- El SHA candidato final debe volver a superar CI y la matriz completa. Los **30 métodos Android** actuales (26 Closure, 3 Media y 1 Voice) todavía necesitan **un recibo consolidado del mismo SHA**, no contar las dos pruebas nuevas sobre binarios distintos como si fueran el mismo ensayo.

## Riesgos y restricciones

La expansión es una nueva decisión funcional calculada en servidor. Si se desea otro ritmo (distinto de 30 días), debe versionarse y revisarse antes de publicar; jamás ajustar `bloomTotal` arbitrariamente en cliente o activar el campo sólo desde preferencias. El nuevo código no modifica una base de datos ni cambia políticas de autorización. **PR en DRAFT; no merge, QA, prod ni P9** sin pruebas faltantes y aprobación.
