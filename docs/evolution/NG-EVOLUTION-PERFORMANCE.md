# Fase 4 — Rendimiento y confiabilidad
**Estado: SIN BASELINE NUEVA NI OPTIMIZACIÓN MEDIDA.**

F1 contiene instrumentación WebView/scroll de 20k mensajes y tests Node previos, pero no hay datos comparables en este corte sobre cold start, latencia de abrir chat, CPU, batería GPS, frames, consumo de red y memoria en la misma configuración. Los artefactos de `scripts/benchmark-phase4.mjs` corresponden a otra fase histórica y no se extrapolan a una ganancia 4.1.1.

## Protocolo reproducible a ejecutar en QA
- Fijar SHA, APK, API Android, resolución, memoria AVD, carga de 1k/20k mensajes y condiciones de red.
- Capturar tiempos cold/warm start, apertura de chat p50/p95, render y frames perdidos, memoria pico/PSS, CPU, tamaño red y sincronización offline→online.
- En GPS, documentar intervalo, pantalla/foreground/background, coordenadas mock y batería; distinguir consumo emulado de medición física.
- Repetir escenarios 3+ veces con idénticos fixtures y guardar medianas/distribuciones, sin inventar porcentajes objetivo.
- Optimizar solo tras ubicar cuello de botella; comparar bajo mismas condiciones y revertir si hay regresión.

**Resultados de esta entrega:** mediciones antes/después nuevas = 0; mejoras cuantificadas = no verificadas; paso de gate rendimiento = PENDIENTE.
